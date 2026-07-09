import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });
dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/restaurant_orders',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  authTokenSecret: process.env.AUTH_TOKEN_SECRET ?? 'dev-only-change-me',
  openaiApiKey: process.env.OPENAI_API_KEY,
  aiSummaryModel: process.env.AI_SUMMARY_MODEL ?? 'gpt-4o-mini'
};

if (config.nodeEnv === 'production') {
  const unsafeDefaults = [
    config.authTokenSecret === 'dev-only-change-me' ? 'AUTH_TOKEN_SECRET' : null,
    config.databaseUrl === 'postgres://postgres:postgres@localhost:5432/restaurant_orders' ? 'DATABASE_URL' : null
  ].filter(Boolean);

  if (unsafeDefaults.length > 0) {
    throw new Error(`Production environment is missing safe values for: ${unsafeDefaults.join(', ')}`);
  }
}
