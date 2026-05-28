import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import pg from 'pg';

dotenv.config();

const scryptAsync = promisify(scrypt);
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
    await seedUsers(client);
  } finally {
    await client.end();
  }
}

async function seedUsers(client) {
  const users = [
    {
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'Admin123!',
      role: 'admin'
    },
    {
      name: 'Staff User',
      email: 'staff@example.com',
      password: 'Staff123!',
      role: 'staff'
    }
  ];

  for (const user of users) {
    await client.query(
      `
        INSERT INTO users (name, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
      `,
      [user.name, user.email, await hashPassword(user.password), user.role]
    );
  }

  console.log('Seeded default users: admin@example.com / Admin123!, staff@example.com / Staff123!');
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);

  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
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
