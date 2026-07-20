import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const PERF_DATABASE_URL = process.env.PERF_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/restaurant_orders_perf';
const PERF_PORT = Number(process.env.PERF_PORT ?? 4300);
const API_URL = `http://127.0.0.1:${PERF_PORT}/api`;
const ORDER_COUNTS = (process.env.PERF_ORDER_COUNTS ?? process.env.PERF_ORDER_COUNT ?? '500,5000,10000')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value > 0)
  .sort((left, right) => left - right);
const SAMPLE_COUNT = Number(process.env.PERF_SAMPLE_COUNT ?? 40);
const WARMUP_COUNT = Number(process.env.PERF_WARMUP_COUNT ?? 5);
const PAGE_LIMIT = Number(process.env.PERF_PAGE_LIMIT ?? 8);
const REDIS_KEY_PREFIX = `restaurant-ops:perf:${Date.now()}`;

let server;

try {
  if (process.env.SKIP_DOCKER_POSTGRES !== '1') {
    logStep('Starting PostgreSQL');
    await startPostgres();
  }

  await waitForPostgres();
  logStep('Initializing performance database');
  await runCommand(process.execPath, ['scripts/init-db.mjs'], {
    DATABASE_URL: PERF_DATABASE_URL
  });

  const firstOrderCount = ORDER_COUNTS[0] ?? 500;
  logStep(`Seeding ${firstOrderCount} synthetic orders`);
  await seedOrders(firstOrderCount, 0);

  logStep('Starting API server');
  server = spawn(process.execPath, ['server/dist/index.js'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      DATABASE_URL: PERF_DATABASE_URL,
      REDIS_URL: process.env.PERF_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://localhost:6379',
      REDIS_KEY_PREFIX,
      PORT: String(PERF_PORT),
      CLIENT_ORIGIN: 'http://localhost:5173'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  pipeProcessOutput(server, 'api');

  await waitForUrl(`${API_URL}/health`);

  logStep('Running API performance checks');
  const token = await loginForToken();
  const baselineResults = [];
  const cacheResults = [];
  const orderResultsByDataset = [];
  let seededOrders = firstOrderCount;

  baselineResults.push(await measureScenario('GET /health', () => request('/health')));
  baselineResults.push(await measureScenario('POST /auth/login', () => loginRequest()));
  cacheResults.push(...await measureMenuCacheScenarios(token));

  for (const orderCount of ORDER_COUNTS) {
    if (orderCount > seededOrders) {
      logStep(`Adding ${orderCount - seededOrders} synthetic orders for ${orderCount}-order dataset`);
      await seedOrders(orderCount - seededOrders, seededOrders);
      seededOrders = orderCount;
    }

    orderResultsByDataset.push({
      seededOrders: orderCount,
      scenarios: await measureOrderScenarios(token, orderCount)
    });
  }

  console.log(JSON.stringify({
    database: 'restaurant_orders_perf',
    datasets: ORDER_COUNTS,
    pageLimit: PAGE_LIMIT,
    samplesPerScenario: SAMPLE_COUNT,
    warmupsPerScenario: WARMUP_COUNT,
    unit: 'milliseconds',
    redisKeyPrefix: REDIS_KEY_PREFIX,
    baselineResults,
    cacheResults,
    orderResultsByDataset
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (server && !server.killed) {
    server.kill('SIGTERM');
  }
}

async function measureMenuCacheScenarios(token) {
  const editableMenuItem = await getEditableMenuItem(token);
  const scenarios = [
    {
      name: 'GET /menu-items',
      path: '/menu-items'
    },
    {
      name: 'GET /menu-items/bundles',
      path: '/menu-items/bundles'
    }
  ];
  const results = [];

  for (const scenario of scenarios) {
    const cold = await measureScenario(
      `${scenario.name} cold cache`,
      () => request(scenario.path),
      {
        beforeEach: () => invalidateMenuCacheViaApi(token, editableMenuItem)
      }
    );

    await invalidateMenuCacheViaApi(token, editableMenuItem);
    await request(scenario.path);

    const warm = await measureScenario(`${scenario.name} warm Redis cache`, () => request(scenario.path));

    results.push({
      route: scenario.name,
      coldCache: cold,
      warmRedisCache: warm,
      p95ReductionPercent: calculateReductionPercent(cold.p95, warm.p95),
      avgReductionPercent: calculateReductionPercent(cold.avg, warm.avg)
    });
  }

  return results;
}

async function measureOrderScenarios(token, orderCount) {
  const scenarios = [
    {
      name: 'GET /orders page 1',
      path: `/orders?page=1&limit=${PAGE_LIMIT}`
    },
    {
      name: 'GET /orders pending filter',
      path: `/orders?page=1&limit=${PAGE_LIMIT}&status=pending`
    },
    {
      name: 'GET /orders server filter',
      path: `/orders?page=1&limit=${PAGE_LIMIT}&serverName=Kent`
    }
  ];

  for (const page of getDeepPages(orderCount)) {
    scenarios.push({
      name: `GET /orders page ${page}`,
      path: `/orders?page=${page}&limit=${PAGE_LIMIT}`
    });
  }

  const results = [];

  for (const scenario of scenarios) {
    results.push(await measureScenario(scenario.name, () => request(scenario.path, token)));
  }

  return results;
}

async function measureScenario(name, fn, options = {}) {
  for (let index = 0; index < WARMUP_COUNT; index += 1) {
    if (options.beforeEach) {
      await options.beforeEach();
    }

    await fn();
  }

  const timings = [];

  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    if (options.beforeEach) {
      await options.beforeEach();
    }

    const startedAt = performance.now();
    const response = await fn();
    const durationMs = performance.now() - startedAt;

    if (!response.ok) {
      throw new Error(`${name} failed with status ${response.status}`);
    }

    timings.push(durationMs);
  }

  timings.sort((left, right) => left - right);

  return {
    name,
    min: round(timings[0]),
    avg: round(timings.reduce((total, value) => total + value, 0) / timings.length),
    p50: round(percentile(timings, 0.5)),
    p95: round(percentile(timings, 0.95)),
    max: round(timings[timings.length - 1])
  };
}

async function getEditableMenuItem(token) {
  const response = await request('/menu-items/admin', token);
  const menuItems = await response.json();

  if (!response.ok) {
    throw new Error(`Admin menu lookup failed with status ${response.status}`);
  }

  const protectedNames = new Set(['Lemon Iced Tea', 'Signature Beef Noodles']);
  const editable = menuItems.find((item) => !protectedNames.has(item.name)) ?? menuItems[0];

  if (!editable) {
    throw new Error('Performance cache test requires at least one menu item.');
  }

  return editable;
}

async function invalidateMenuCacheViaApi(token, menuItem) {
  const response = await request(`/menu-items/${menuItem.id}`, token, {
    method: 'PATCH',
    body: {
      priceCents: menuItem.priceCents
    }
  });

  if (!response.ok) {
    throw new Error(`Menu cache invalidation update failed with status ${response.status}`);
  }
}

async function loginForToken() {
  const response = await loginRequest();
  const body = await response.json();

  if (!response.ok || !body.accessToken) {
    throw new Error(`Login failed with status ${response.status}`);
  }

  return body.accessToken;
}

async function loginRequest() {
  return request('/auth/login', undefined, {
    method: 'POST',
    body: {
      email: 'admin@example.com',
      password: 'Admin123!'
    }
  });
}

async function request(path, token, options = {}) {
  return fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
}

async function seedOrders(count, startIndex) {
  const client = new pg.Client({ connectionString: PERF_DATABASE_URL });

  await client.connect();

  try {
    const menuResult = await client.query(`
      SELECT
        mi.id,
        miv.id AS variant_id,
        miv.price_cents
      FROM menu_items mi
      JOIN menu_item_variants miv ON miv.menu_item_id = mi.id
      WHERE miv.is_default = TRUE
      ORDER BY mi.name
    `);
    const userResult = await client.query("SELECT id, name, role FROM users WHERE email = 'admin@example.com'");
    const menuItems = menuResult.rows;
    const actor = userResult.rows[0];

    if (menuItems.length === 0 || !actor) {
      throw new Error('Performance seed requires menu items and admin user.');
    }

    await client.query('BEGIN');

    for (let index = startIndex; index < startIndex + count; index += 1) {
      const status = getSeedStatus(index);
      const orderSource = index % 3 === 0 ? 'phone' : 'in_person';
      const fulfillmentType = orderSource === 'phone' ? (index % 2 === 0 ? 'delivery' : 'pickup') : 'to_go';
      const isPaid = status === 'served' && index % 2 === 0;
      const createdAt = new Date(Date.now() - index * 60_000);

      const orderResult = await client.query(
        `
          INSERT INTO orders (
            order_source,
            fulfillment_type,
            phone_number,
            server_name,
            status,
            payment_status,
            payment_method,
            payment_subtotal_cents,
            payment_tax_cents,
            payment_tip_cents,
            payment_total_cents,
            paid_at,
            notes,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
          RETURNING id
        `,
        [
          orderSource,
          fulfillmentType,
          orderSource === 'phone' ? `555-${String(index).padStart(4, '0')}` : null,
          index % 2 === 0 ? 'Kent' : 'Mitch',
          status,
          isPaid ? 'paid' : 'unpaid',
          isPaid ? 'card' : null,
          isPaid ? 1500 : null,
          isPaid ? 129 : null,
          isPaid ? 200 : null,
          isPaid ? 1829 : null,
          isPaid ? createdAt : null,
          index % 10 === 0 ? 'Performance test order' : null,
          createdAt
        ]
      );

      const orderId = orderResult.rows[0].id;
      const itemCount = 1 + (index % 3);

      for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
        const menuItem = menuItems[(index + itemIndex) % menuItems.length];
        await client.query(
          `
            INSERT INTO order_items (order_id, menu_item_id, menu_item_variant_id, quantity, price_cents)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [orderId, menuItem.id, menuItem.variant_id, 1 + ((index + itemIndex) % 2), menuItem.price_cents]
        );
      }

      await client.query(
        `
          INSERT INTO order_events (order_id, event_type, actor_user_id, actor_name, actor_role, created_at)
          VALUES ($1, 'order_created', $2, $3, $4, $5)
        `,
        [orderId, actor.id, actor.name, actor.role, createdAt]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

function getSeedStatus(index) {
  const statuses = ['pending', 'preparing', 'ready', 'served', 'cancelled'];
  return statuses[index % statuses.length];
}

function getDeepPages(orderCount) {
  const lastPage = Math.ceil(orderCount / PAGE_LIMIT);
  return Array.from(new Set([50, 500, lastPage]))
    .filter((page) => page > 1 && page <= lastPage)
    .sort((left, right) => left - right);
}

function percentile(sortedValues, fraction) {
  const index = Math.ceil(sortedValues.length * fraction) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function calculateReductionPercent(before, after) {
  if (before <= 0) {
    return 0;
  }

  return round(((before - after) / before) * 100);
}

function logStep(message) {
  console.log(`[perf] ${message}`);
}

function runCommand(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      env: { ...process.env, ...env },
      stdio: 'inherit'
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

function startPostgres() {
  if (process.platform === 'win32') {
    return runCommand('cmd.exe', ['/c', 'scripts\\start-postgres.cmd']);
  }

  return runCommand('sh', ['scripts/start-postgres.cmd']);
}

async function waitForPostgres() {
  const adminUrl = new URL(PERF_DATABASE_URL);
  adminUrl.pathname = '/postgres';
  const deadline = Date.now() + 30000;
  let lastError;

  while (Date.now() < deadline) {
    const client = new pg.Client({ connectionString: adminUrl.toString() });

    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => {});
      await delay(500);
    }
  }

  throw lastError ?? new Error('PostgreSQL did not become ready');
}

async function waitForUrl(url) {
  const deadline = Date.now() + 30000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }

  throw lastError ?? new Error(`${url} did not become ready`);
}

function pipeProcessOutput(child, label) {
  child.stdout.on('data', (chunk) => {
    if (process.env.PERF_DEBUG) {
      process.stdout.write(`[${label}] ${chunk}`);
    }
  });
  child.stderr.on('data', (chunk) => {
    if (process.env.PERF_DEBUG) {
      process.stderr.write(`[${label}] ${chunk}`);
    }
  });
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
