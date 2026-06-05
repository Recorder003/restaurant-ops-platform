# Deployment Guide

This project is split into two deployable parts:

- `server`: Express API connected to PostgreSQL
- `client`: Vite React app that calls the API

The recommended portfolio deployment target is AWS:

```txt
User
 |
 v
CloudFront HTTPS URL
 |
 v
S3 static React app
 |
 v
Elastic Beanstalk Node.js API
 |
 v
RDS PostgreSQL
```

## Required Environment Variables

### Server

Set these variables in the backend hosting environment:

```txt
NODE_ENV=production
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DATABASE
PORT=4000
CLIENT_ORIGIN=https://your-cloudfront-or-domain.example
AUTH_TOKEN_SECRET=use-a-long-random-production-secret
```

Notes:

- `DATABASE_URL` should point to the production RDS PostgreSQL database.
- `CLIENT_ORIGIN` must match the deployed frontend origin so CORS allows browser requests.
- `AUTH_TOKEN_SECRET` must be a long private value. Do not reuse the development value.

### Client

Set this before building the frontend:

```txt
VITE_API_URL=https://your-api-domain.example/api
```

Vite embeds `VITE_API_URL` at build time. If the API URL changes, rebuild and redeploy the frontend.

## Local Production Smoke Test

Install dependencies:

```bash
npm install
```

Build both workspaces:

```bash
npm run build
```

Run database migrations:

```bash
npm run db:migrate
```

Start the production API:

```bash
npm run start
```

Open:

```txt
http://localhost:4000/api/health
```

The health endpoint returns `200` only when the API is running and PostgreSQL is reachable.

## AWS Deployment Plan

### 1. Create An RDS PostgreSQL Database

Create an Amazon RDS PostgreSQL instance.

Recommended learning/demo settings:

- Engine: PostgreSQL
- Instance size: smallest practical development tier
- Public access: disabled if the backend is in the same AWS network; restricted if temporary public access is needed
- Database name: `restaurant_orders`
- Username/password: store securely

After creation, collect:

```txt
RDS host
RDS port
Database name
Username
Password
```

Then construct:

```txt
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/restaurant_orders
```

### 2. Configure Security Groups

The backend must be able to connect to RDS on port `5432`.

For a clean AWS setup:

- Allow inbound PostgreSQL traffic to RDS only from the backend security group.
- Do not leave RDS open to the whole internet.
- Allow public HTTP/HTTPS traffic to the API only through the deployed backend environment.

### 3. Deploy The Backend To Elastic Beanstalk

Create an Elastic Beanstalk application using the Node.js platform.

Use these deployment settings:

```txt
Build command: npm install && npm run build
Start command: npm run db:migrate && npm run start
Health check path: /api/health
```

The repository includes a root `Procfile` with this same startup command, which helps Node hosting platforms run the API with migrations before startup.

Set backend environment variables:

```txt
NODE_ENV=production
DATABASE_URL=postgres://USER:PASSWORD@RDS_HOST:5432/restaurant_orders
CLIENT_ORIGIN=https://your-frontend-domain.example
AUTH_TOKEN_SECRET=your-generated-secret
```

After deployment, verify:

```txt
https://your-api-domain.example/api/health
```

### 4. Deploy The Frontend To S3

Build the frontend with the production API URL:

```bash
VITE_API_URL=https://your-api-domain.example/api npm run build --workspace client
```

On Windows PowerShell:

```powershell
$env:VITE_API_URL="https://your-api-domain.example/api"
npm run build --workspace client
```

Upload the contents of:

```txt
client/dist
```

to an S3 bucket configured for static website assets.

### 5. Put CloudFront In Front Of S3

Create a CloudFront distribution for the frontend bucket.

Recommended settings:

- Viewer protocol policy: redirect HTTP to HTTPS
- Default root object: `index.html`
- Custom error response for SPA routing:
  - `403` -> `/index.html`
  - `404` -> `/index.html`

Use the CloudFront URL as the public demo link.

### 6. Update Backend CORS

After CloudFront is ready, update the backend environment:

```txt
CLIENT_ORIGIN=https://your-cloudfront-domain.cloudfront.net
```

Restart/redeploy the backend after changing environment variables.

## Demo Accounts

The migration/seed flow creates demo users:

```txt
admin@example.com / Admin123!
staff@example.com / Staff123!
chef@example.com / Chef123!
```

For a public portfolio demo, consider changing passwords before sharing the link broadly.

## Deployment Checklist

Before sharing the demo link:

- Run `npm run typecheck`
- Run `npm run test`
- Run `npm run test:e2e`
- Run `npm run build`
- Verify `/api/health` returns `200`
- Verify frontend can log in as admin, staff, and chef
- Create a test order
- Move items through kitchen statuses
- Complete checkout
- Confirm admin menu, combo, table, and staff management work
- Confirm no local-only URL such as `localhost` is used by the deployed frontend

## Cost Notes

For a small demo, the main AWS costs are usually:

- RDS PostgreSQL
- Elastic Beanstalk underlying compute
- CloudFront/S3 traffic and storage

Use small instance sizes while learning, set AWS Billing Alerts, and stop/delete unused resources after testing.

## Non-AWS Alternative

If you need a fast demo before learning AWS:

- Frontend: Vercel or Netlify
- Backend: Render or Railway
- Database: Supabase, Neon, Railway, or Render PostgreSQL

The same environment variables still apply.
