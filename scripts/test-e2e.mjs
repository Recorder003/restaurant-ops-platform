import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import pg from 'pg';

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const CLIENT_DIR = fileURLToPath(new URL('../client', import.meta.url));
const VITE_BIN = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const TEST_DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/restaurant_orders_e2e';
const API_PORT = Number(process.env.E2E_API_PORT ?? 4200);
const CLIENT_PORT = Number(process.env.E2E_CLIENT_PORT ?? 5175);
const API_URL = `http://127.0.0.1:${API_PORT}/api`;
const CLIENT_URL = `http://127.0.0.1:${CLIENT_PORT}`;
const TAX_RATE = 0.086;

let apiServer;
let clientServer;
let browser;

try {
  if (process.env.SKIP_DOCKER_POSTGRES !== '1') {
    logStep('Starting PostgreSQL');
    await startPostgres();
  }
  await waitForPostgres();
  logStep('Initializing E2E database');
  await runCommand(process.execPath, ['scripts/init-db.mjs'], {
    DATABASE_URL: TEST_DATABASE_URL
  });

  logStep('Starting API server');
  apiServer = spawn(process.execPath, ['server/dist/index.js'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      PORT: String(API_PORT),
      CLIENT_ORIGIN: CLIENT_URL
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  pipeProcessOutput(apiServer, 'api');
  await waitForUrl(`${API_URL}/health`);

  logStep('Starting Vite client');
  clientServer = spawn(process.execPath, [VITE_BIN, '--host', '127.0.0.1', '--port', String(CLIENT_PORT), '--strictPort'], {
    cwd: CLIENT_DIR,
    env: {
      ...process.env,
      VITE_API_URL: API_URL
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  pipeProcessOutput(clientServer, 'client');
  await waitForUrl(CLIENT_URL);

  logStep('Running browser workflow');
  await runBrowserFlow();
  console.log('E2E browser tests passed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (browser) {
    await browser.close().catch(() => {});
  }
  stopProcess(clientServer);
  stopProcess(apiServer);
}

async function runBrowserFlow() {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  logStep('Logging in as staff and creating order');
  await page.goto(CLIENT_URL);
  await expectVisible(page.getByRole('heading', { name: 'Staff Sign In' }), 'login heading');
  await login(page, 'staff@example.com', 'Staff123!');

  await expectVisible(page.getByRole('heading', { name: 'New Order' }), 'staff new order panel');
  await page.getByRole('button', { name: /Dine-in/i }).click();
  await page.getByRole('button', { name: 'T1 Available 2 seats' }).click();
  await page.locator('form.order-wizard').getByRole('button', { name: 'Next' }).click();
  await page.locator('form.order-wizard').getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Signature Beef Noodles/i }).click();
  await page.getByRole('button', { name: 'Submit Order' }).click();
  await expectText(page, 'Order Board');
  await expectText(page, 'Table T1 / 2 guests');

  logStep('Completing kitchen workflow as chef');
  await page.getByRole('button', { name: 'Sign Out' }).click();
  await login(page, 'chef@example.com', 'Chef123!');
  await expectVisible(page.getByRole('heading', { name: 'Kitchen Board' }), 'kitchen board');
  await page.getByRole('button', { name: 'Start' }).click();
  await expectVisible(page.locator('.order-card-header .status.preparing'), 'preparing status badge');
  await page.getByRole('button', { name: 'Mark Done' }).click();

  await page.getByRole('button', { name: 'Sign Out' }).click();

  logStep('Serving and checking out as staff');
  await login(page, 'staff@example.com', 'Staff123!');
  await expectVisible(page.locator('.order-card-header .status.ready'), 'ready status badge');
  await page.locator('.order-actions').getByRole('button', { name: 'Served' }).click();
  await expectVisible(page.locator('.order-card-header .status.served'), 'served status badge');

  await page.getByRole('button', { name: 'Checkout' }).click();
  await expectVisible(page.getByRole('heading', { name: 'Checkout' }), 'checkout modal');
  await page.getByRole('button', { name: '15%' }).click();
  await page.getByRole('button', { name: 'Confirm Payment' }).click();
  await expectVisible(page.locator('.payment-status.paid'), 'paid status badge');

  await page.getByRole('button', { name: 'Receipt' }).click();
  await expectVisible(page.getByRole('heading', { name: 'Receipt' }), 'receipt modal');
  await expectText(page, 'Restaurant Ops');
  await expectText(page, 'Order Receipt');

  const orderTotal = await getOrderTotalFromApi();
  const expectedTax = Math.round(orderTotal * TAX_RATE);
  assert(expectedTax > 0, 'Expected checkout tax to be positive');
}

function logStep(message) {
  console.log(`[e2e] ${message}`);
}

async function getOrderTotalFromApi() {
  const token = await loginApi('admin@example.com', 'Admin123!');
  const response = await fetch(`${API_URL}/orders?page=1&limit=1`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await response.json();
  assert(response.status === 200 && body.orders.length === 1, 'Expected one order from API after E2E flow');
  assert(body.orders[0].paymentStatus === 'paid', 'Expected E2E order to be paid');
  return body.orders[0].totalCents;
}

async function login(page, email, password) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expectVisible(page.getByRole('heading', { name: 'Restaurant Order Manager' }), `logged in as ${email}`);
}

async function loginApi(email, password) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const body = await response.json();
  assert(response.status === 200, `API login failed for ${email}`);
  return body.accessToken;
}

async function expectVisible(locator, label) {
  await locator.waitFor({ state: 'visible', timeout: 10000 }).catch((error) => {
    throw new Error(`Expected ${label} to be visible: ${error.message}`);
  });
}

async function expectText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 }).catch((error) => {
    throw new Error(`Expected text "${text}" to be visible: ${error.message}`);
  });
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

function stopProcess(child) {
  if (!child || child.killed) {
    return;
  }

  child.kill('SIGTERM');
}

function pipeProcessOutput(child, label) {
  child.stdout.on('data', (chunk) => {
    if (process.env.E2E_DEBUG) {
      process.stdout.write(`[${label}] ${chunk}`);
    }
  });
  child.stderr.on('data', (chunk) => {
    if (process.env.E2E_DEBUG) {
      process.stderr.write(`[${label}] ${chunk}`);
    }
  });
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
