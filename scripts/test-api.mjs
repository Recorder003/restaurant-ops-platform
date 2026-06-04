import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/restaurant_orders_test';
const TEST_PORT = Number(process.env.TEST_PORT ?? 4100);
const API_URL = `http://127.0.0.1:${TEST_PORT}/api`;
const TAX_RATE = 0.086;

let server;

try {
  if (process.env.SKIP_DOCKER_POSTGRES !== '1') {
    await startPostgres();
  }
  await waitForPostgres();
  await runCommand(process.execPath, ['scripts/init-db.mjs'], {
    DATABASE_URL: TEST_DATABASE_URL
  });

  server = spawn(process.execPath, ['server/dist/index.js'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      PORT: String(TEST_PORT),
      CLIENT_ORIGIN: 'http://localhost:5173'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let serverOutput = '';
  server.stdout.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });
  server.stderr.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });

  await waitForHealth();
  await runApiTests();

  console.log('API integration tests passed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (server && !server.killed) {
    server.kill('SIGTERM');
  }
}

async function runApiTests() {
  await assertSecurityControls();

  const admin = await login('admin@example.com', 'Admin123!');
  const staff = await login('staff@example.com', 'Staff123!');
  const chef = await login('chef@example.com', 'Chef123!');

  const { response: menuResponse, body: menu } = await request('/menu-items');
  assert(menuResponse.status === 200 && menu.length > 0, 'Public menu should load');
  const menuItem = menu[0];
  const secondMenuItem = menu[1] ?? menuItem;

  const itemWorkflowOrder = await request('/orders', {
    method: 'POST',
    token: staff,
    body: {
      orderSource: 'in_person',
      fulfillmentType: 'to_go',
      serverName: 'Kent',
      items: [
        { menuItemId: menuItem.id, quantity: 1 },
        { menuItemId: secondMenuItem.id, quantity: 1 }
      ]
    }
  });
  assert(itemWorkflowOrder.response.status === 201, 'Item workflow order should be created');
  assert(itemWorkflowOrder.body.items.every((item) => item.status === 'pending'), 'New order items should start pending');
  const firstWorkflowItem = itemWorkflowOrder.body.items[0];
  const secondWorkflowItem = itemWorkflowOrder.body.items[1];

  const itemPreparing = await request(`/orders/${itemWorkflowOrder.body.id}/items/${firstWorkflowItem.id}/status`, {
    method: 'PATCH',
    token: chef,
    body: { status: 'preparing' }
  });
  assert(itemPreparing.response.status === 200, 'Chef should start an individual item');
  assert(itemPreparing.body.status === 'preparing', 'Order should become preparing when one item starts');
  assert(findOrderItem(itemPreparing.body, firstWorkflowItem.id).status === 'preparing', 'Started item should be preparing');
  assert(findOrderItem(itemPreparing.body, secondWorkflowItem.id).status === 'pending', 'Other item should remain pending');

  const itemReady = await request(`/orders/${itemWorkflowOrder.body.id}/items/${firstWorkflowItem.id}/status`, {
    method: 'PATCH',
    token: chef,
    body: { status: 'ready' }
  });
  assert(itemReady.response.status === 200, 'Chef should mark an individual item ready');
  assert(findOrderItem(itemReady.body, firstWorkflowItem.id).status === 'ready', 'Item should become ready');

  const itemServed = await request(`/orders/${itemWorkflowOrder.body.id}/items/${firstWorkflowItem.id}/status`, {
    method: 'PATCH',
    token: staff,
    body: { status: 'served' }
  });
  assert(itemServed.response.status === 200, 'Staff should serve an individual ready item');
  assert(findOrderItem(itemServed.body, firstWorkflowItem.id).status === 'served', 'Item should become served');
  assert(itemServed.body.status === 'preparing', 'Order should remain preparing while other items are not ready');

  const staffBadItemTransition = await request(`/orders/${itemWorkflowOrder.body.id}/items/${secondWorkflowItem.id}/status`, {
    method: 'PATCH',
    token: staff,
    body: { status: 'preparing' }
  });
  assert(staffBadItemTransition.response.status === 403, 'Staff should not start kitchen item preparation');

  const cancelledItemWorkflowOrder = await request(`/orders/${itemWorkflowOrder.body.id}/status`, {
    method: 'PATCH',
    token: admin,
    body: { status: 'cancelled' }
  });
  assert(cancelledItemWorkflowOrder.response.status === 200, 'Admin should cancel item workflow test order');

  const splitQuantityOrder = await request('/orders', {
    method: 'POST',
    token: staff,
    body: {
      orderSource: 'in_person',
      fulfillmentType: 'to_go',
      serverName: 'Kent',
      items: [{ menuItemId: menuItem.id, quantity: 2 }]
    }
  });
  assert(splitQuantityOrder.response.status === 201, 'Quantity split order should be created');
  assert(splitQuantityOrder.body.items.length === 2, 'Quantity 2 should create two independently trackable items');
  assert(splitQuantityOrder.body.items.every((item) => item.quantity === 1), 'Split items should each represent one dish');

  const firstSplitItem = splitQuantityOrder.body.items[0];
  const secondSplitItem = splitQuantityOrder.body.items[1];
  const splitItemPreparing = await request(`/orders/${splitQuantityOrder.body.id}/items/${firstSplitItem.id}/status`, {
    method: 'PATCH',
    token: chef,
    body: { status: 'preparing' }
  });
  assert(splitItemPreparing.response.status === 200, 'Chef should prepare one split item');
  assert(findOrderItem(splitItemPreparing.body, firstSplitItem.id).status === 'preparing', 'First split item should be preparing');
  assert(findOrderItem(splitItemPreparing.body, secondSplitItem.id).status === 'pending', 'Second split item should remain pending');

  const cancelledSplitQuantityOrder = await request(`/orders/${splitQuantityOrder.body.id}/status`, {
    method: 'PATCH',
    token: admin,
    body: { status: 'cancelled' }
  });
  assert(cancelledSplitQuantityOrder.response.status === 200, 'Admin should cancel split quantity test order');

  let { response: tablesResponse, body: tables } = await request('/tables', { token: staff });
  assert(tablesResponse.status === 200, 'Staff should fetch tables');
  let t1 = findTable(tables, 'T1');
  const t2 = findTable(tables, 'T2');
  const t3 = findTable(tables, 'T3');
  const realtime = await createRealtimeWaiter(staff, (event) => event.type === 'order_changed' && event.action === 'created');

  const created = await request('/orders', {
    method: 'POST',
    token: staff,
    body: {
      orderSource: 'in_person',
      fulfillmentType: 'dine_in',
      tableNumber: 'T1',
      partySize: 4,
      serverName: 'Kent',
      items: [{ menuItemId: menuItem.id, quantity: 1 }]
    }
  });
  assert(created.response.status === 201, `Dine-in order should be created: ${created.response.status}`);
  const order = created.body;
  const realtimeEvent = await realtime.next;
  realtime.close();
  assert(realtimeEvent.resourceId === order.id, 'Order creation should emit a realtime event');

  const duplicateTable = await request('/orders', {
    method: 'POST',
    token: staff,
    body: {
      orderSource: 'in_person',
      fulfillmentType: 'dine_in',
      tableNumber: 'T1',
      partySize: 2,
      serverName: 'Kent',
      items: [{ menuItemId: menuItem.id, quantity: 1 }]
    }
  });
  assert(duplicateTable.response.status === 400, 'Occupied table should reject a second dine-in order');

  const tooManyGuests = await request('/orders', {
    method: 'POST',
    token: staff,
    body: {
      orderSource: 'in_person',
      fulfillmentType: 'dine_in',
      tableNumber: 'T2',
      partySize: t2.capacity + 3,
      serverName: 'Kent',
      items: [{ menuItemId: menuItem.id, quantity: 1 }]
    }
  });
  assert(tooManyGuests.response.status === 400, 'Party size above table capacity plus extra chairs should be rejected');

  const staffBadTablePatch = await request(`/tables/${t3.id}`, {
    method: 'PATCH',
    token: staff,
    body: { status: 'occupied' }
  });
  assert(staffBadTablePatch.response.status === 403, 'Staff should not set arbitrary table status');

  const staffHistory = await request(`/orders/${order.id}/events`, { token: staff });
  assert(staffHistory.response.status === 403, 'Staff should not read admin-only order history');

  const preparing = await request(`/orders/${order.id}/status`, {
    method: 'PATCH',
    token: chef,
    body: { status: 'preparing' }
  });
  assert(preparing.response.status === 200 && preparing.body.status === 'preparing', 'Chef should start pending order');

  const ready = await request(`/orders/${order.id}/status`, {
    method: 'PATCH',
    token: chef,
    body: { status: 'ready' }
  });
  assert(ready.response.status === 200 && ready.body.status === 'ready', 'Chef should mark preparing order ready');

  const staffInvalidTransition = await request(`/orders/${order.id}/status`, {
    method: 'PATCH',
    token: staff,
    body: { status: 'cancelled' }
  });
  assert(staffInvalidTransition.response.status === 403, 'Staff should not cancel a ready order');

  const served = await request(`/orders/${order.id}/status`, {
    method: 'PATCH',
    token: staff,
    body: { status: 'served' }
  });
  assert(served.response.status === 200 && served.body.status === 'served', 'Staff should serve ready order');

  const wrongTax = await request(`/orders/${order.id}/checkout`, {
    method: 'POST',
    token: staff,
    body: {
      paymentMethod: 'card',
      subtotalCents: served.body.totalCents,
      taxCents: 0,
      tipCents: 0,
      totalCents: served.body.totalCents
    }
  });
  assert(wrongTax.response.status === 409, 'Checkout should reject incorrect tax');

  const taxCents = Math.round(served.body.totalCents * TAX_RATE);
  const paid = await request(`/orders/${order.id}/checkout`, {
    method: 'POST',
    token: staff,
    body: {
      paymentMethod: 'card',
      subtotalCents: served.body.totalCents,
      taxCents,
      tipCents: 100,
      totalCents: served.body.totalCents + taxCents + 100
    }
  });
  assert(paid.response.status === 200 && paid.body.paymentStatus === 'paid', 'Checkout should mark order paid');

  const duplicateCheckout = await request(`/orders/${order.id}/checkout`, {
    method: 'POST',
    token: staff,
    body: {
      paymentMethod: 'cash',
      subtotalCents: served.body.totalCents,
      taxCents,
      tipCents: 0,
      totalCents: served.body.totalCents + taxCents
    }
  });
  assert(duplicateCheckout.response.status === 409, 'Paid order should not be checked out twice');

  const activeOrders = await request('/orders?page=1&limit=100&activeOnly=true', { token: staff });
  assert(activeOrders.response.status === 200, 'Staff should fetch active orders');
  assert(
    activeOrders.body.orders.every((item) => item.status !== 'cancelled' && item.paymentStatus !== 'paid'),
    'Active order filter should exclude cancelled and paid orders'
  );

  const events = await request(`/orders/${order.id}/events`, { token: admin });
  assert(events.response.status === 200, 'Admin should read order history');
  assert(events.body.some((event) => event.eventType === 'payment_recorded'), 'History should include payment event');

  ({ response: tablesResponse, body: tables } = await request('/tables', { token: staff }));
  assert(tablesResponse.status === 200, 'Tables should reload after checkout flow');
  t1 = findTable(tables, 'T1');
  assert(t1.status === 'needs_cleaning', 'Served dine-in table should need cleaning');

  const cleaned = await request(`/tables/${t1.id}`, {
    method: 'PATCH',
    token: staff,
    body: { status: 'available' }
  });
  assert(cleaned.response.status === 200 && cleaned.body.status === 'available', 'Staff should mark needs-cleaning table available');

  const soldOut = await request(`/menu-items/${menuItem.id}/sold-out`, {
    method: 'PATCH',
    token: chef,
    body: { isSoldOut: true }
  });
  assert(soldOut.response.status === 200 && soldOut.body.isSoldOut, 'Chef should mark menu item sold out');

  const soldOutOrder = await request('/orders', {
    method: 'POST',
    token: staff,
    body: {
      orderSource: 'in_person',
      fulfillmentType: 'to_go',
      serverName: 'Kent',
      items: [{ menuItemId: menuItem.id, quantity: 1 }]
    }
  });
  assert(soldOutOrder.response.status === 400, 'Sold-out menu item should be rejected in new orders');

  console.log(JSON.stringify({
    checked: [
      'auth',
      'menu',
      'table occupancy',
      'capacity limits',
      'role boundaries',
      'status transitions',
      'item-level kitchen workflow',
      'split quantity item tracking',
      'checkout tax validation',
      'duplicate checkout prevention',
      'active order filtering',
      'admin history',
      'table cleaning',
      'sold-out ordering guard',
      'security headers',
      'request id header',
      'realtime order events',
      'login rate limiting',
      'request body size limit'
    ]
  }, null, 2));
}

async function assertSecurityControls() {
  const health = await request('/health');
  assert(health.response.headers.get('x-content-type-options') === 'nosniff', 'Helmet should set security headers');
  assert(Boolean(health.response.headers.get('x-request-id')), 'API responses should include a request id');

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failed = await request('/auth/login', {
      method: 'POST',
      body: { email: 'rate-limit@example.com', password: 'wrong-password' }
    });
    assert(failed.response.status === 401, 'Invalid login should be rejected before lockout');
  }

  const limited = await request('/auth/login', {
    method: 'POST',
    body: { email: 'rate-limit@example.com', password: 'wrong-password' }
  });
  assert(limited.response.status === 429, 'Repeated failed logins should be rate limited');

  const oversized = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'large-payload@example.com',
      password: 'x'.repeat(120_000)
    })
  });
  assert(oversized.status === 413, 'Oversized JSON requests should be rejected');
}

async function login(email, password) {
  const { response, body } = await request('/auth/login', {
    method: 'POST',
    body: { email, password }
  });

  assert(response.status === 200, `Login failed for ${email}: ${response.status}`);
  return body.accessToken;
}

async function createRealtimeWaiter(token, predicate) {
  const controller = new AbortController();
  const response = await fetch(`${API_URL}/events`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: controller.signal
  });

  assert(response.status === 200 && response.body, 'Realtime event stream should connect');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const next = new Promise((resolve, reject) => {
    async function read() {
      try {
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();

          if (done) {
            reject(new Error('Realtime stream closed before expected event'));
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() ?? '';

          for (const chunk of chunks) {
            const dataLine = chunk.split('\n').find((line) => line.startsWith('data: '));

            if (!dataLine) {
              continue;
            }

            const event = JSON.parse(dataLine.slice('data: '.length));

            if (predicate(event)) {
              resolve(event);
              return;
            }
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          reject(error);
        }
      }
    }

    void read();
  });

  return {
    next,
    close() {
      controller.abort();
    }
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

async function waitForHealth() {
  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    try {
      const { response } = await request('/health');
      if (response.status === 200) {
        return;
      }
    } catch {
      await delay(250);
    }
  }

  throw new Error(`API server did not become ready on port ${TEST_PORT}`);
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
  const adminUrl = new URL(TEST_DATABASE_URL);
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

function findTable(tables, name) {
  const table = tables.find((item) => item.name === name);
  assert(table, `Expected table ${name} to exist`);
  return table;
}

function findOrderItem(order, itemId) {
  const item = order.items.find((candidate) => candidate.id === itemId);
  assert(item, `Expected order item ${itemId} to exist`);
  return item;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
