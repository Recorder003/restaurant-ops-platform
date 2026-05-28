import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import pg from 'pg';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/restaurant_orders';
const targetUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(targetUrl.pathname.replace(/^\//, ''));

if (!databaseName) {
  throw new Error('DATABASE_URL must include a database name.');
}

const adminUrl = new URL(databaseUrl);
adminUrl.pathname = '/postgres';

try {
  await ensureDatabase(adminUrl.toString(), databaseName);
  await runSchema(databaseUrl);
  console.log(`Database "${databaseName}" is ready.`);
} catch (error) {
  if (isConnectionRefused(error)) {
    console.error('Cannot connect to PostgreSQL at localhost:5432.');
    console.error('Start PostgreSQL first, or run this VS Code task: "Start PostgreSQL with Docker".');
    console.error('Then run "Init PostgreSQL database" again.');
    process.exit(1);
  }

  throw error;
}

async function ensureDatabase(connectionString, dbName) {
  const client = new pg.Client({ connectionString });

  await client.connect();

  try {
    const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);

    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE ${quoteIdentifier(dbName)}`);
      console.log(`Created database "${dbName}".`);
    }
  } finally {
    await client.end();
  }
}

async function runSchema(connectionString) {
  const schema = await fs.readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
  const client = new pg.Client({ connectionString });

  await client.connect();

  try {
    await client.query(schema);
  } finally {
    await client.end();
  }
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function isConnectionRefused(error) {
  if (error?.code === 'ECONNREFUSED') {
    return true;
  }

  return Array.isArray(error?.errors) && error.errors.some((item) => item?.code === 'ECONNREFUSED');
}
