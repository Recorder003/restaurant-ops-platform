import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });
dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/restaurant_orders',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'
};
