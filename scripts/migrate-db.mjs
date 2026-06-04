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
  await runMigrations(databaseUrl);
  console.log(`Database "${databaseName}" migrations are up to date.`);
} catch (error) {
  if (isConnectionRefused(error)) {
    console.error('Cannot connect to PostgreSQL at localhost:5432.');
    console.error('Start PostgreSQL first, or run this VS Code task: "Start PostgreSQL with Docker".');
    console.error('Then run "Migrate PostgreSQL database" again.');
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

async function runMigrations(connectionString) {
  const client = new pg.Client({ connectionString });
  const migrations = await getMigrations();

  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const applied = await getAppliedMigrations(client);

    if (applied.size === 0) {
      await baselineExistingSchemaIfNeeded(client, migrations);
    }

    const refreshedApplied = await getAppliedMigrations(client);

    for (const migration of migrations) {
      if (refreshedApplied.has(migration.filename)) {
        continue;
      }

      console.log(`Applying migration ${migration.filename}...`);
      await client.query('BEGIN');

      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [migration.filename]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    await seedDefaultUsers(client);
  } finally {
    await client.end();
  }
}

async function getMigrations() {
  const migrationsUrl = new URL('../database/migrations/', import.meta.url);
  const filenames = (await fs.readdir(migrationsUrl))
    .filter((filename) => filename.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(
    filenames.map(async (filename) => ({
      filename,
      sql: await fs.readFile(new URL(filename, migrationsUrl), 'utf8')
    }))
  );
}

async function getAppliedMigrations(client) {
  const result = await client.query('SELECT filename FROM schema_migrations');
  return new Set(result.rows.map((row) => row.filename));
}

async function baselineExistingSchemaIfNeeded(client, migrations) {
  const existingTables = await getExistingCoreTables(client);

  if (existingTables.size === 0) {
    return;
  }

  const requiredTables = ['users', 'menu_items', 'restaurant_tables', 'orders', 'order_events', 'order_items'];
  const missingTables = requiredTables.filter((tableName) => !existingTables.has(tableName));

  if (missingTables.length > 0) {
    throw new Error(`Database has a partial schema. Missing tables: ${missingTables.join(', ')}`);
  }

  for (const migration of migrations) {
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [migration.filename]);
  }

  console.log('Existing schema detected; migrations were baselined without changing data.');
}

async function getExistingCoreTables(client) {
  const result = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> 'schema_migrations'
  `);

  return new Set(result.rows.map((row) => row.table_name));
}

async function seedDefaultUsers(client) {
  const users = [
    {
      name: 'Mitch',
      email: 'admin@example.com',
      password: 'Admin123!',
      role: 'admin'
    },
    {
      name: 'Kent',
      email: 'staff@example.com',
      password: 'Staff123!',
      role: 'staff'
    },
    {
      name: 'Sparky',
      email: 'chef@example.com',
      password: 'Chef123!',
      role: 'chef'
    }
  ];

  for (const user of users) {
    await client.query(
      `
        INSERT INTO users (name, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO UPDATE SET
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          is_active = TRUE
      `,
      [user.name, user.email, await hashPassword(user.password), user.role]
    );
  }

  console.log('Default users are available: admin@example.com, staff@example.com, chef@example.com');
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
