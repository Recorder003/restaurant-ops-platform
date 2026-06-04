# Deployment Guide

This project is split into two deployable parts:

- `server`: Express API connected to PostgreSQL
- `client`: Vite React app that calls the API

## Required Environment Variables

### Server

```txt
NODE_ENV=production
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DATABASE
PORT=4000
CLIENT_ORIGIN=https://your-frontend-domain.example
AUTH_TOKEN_SECRET=use-a-long-random-secret
```

`AUTH_TOKEN_SECRET` must be a long private value. Do not reuse the development value in production.

### Client

```txt
VITE_API_URL=https://your-api-domain.example/api
```

Vite embeds this value at build time, so set it before building the client.

## Build Commands

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

## Health Check

Use this endpoint for deployment platform health checks:

```txt
GET /api/health
```

It returns `200` only when the API is running and PostgreSQL is reachable.

## Suggested Hosting Setup

### API

Use Render, Railway, Fly.io, or another Node-capable host.

- Build command: `npm install && npm run build`
- Start command: `npm run db:migrate && npm run start`
- Health check path: `/api/health`

### Frontend

Use Vercel, Netlify, or any static web host.

- Build command: `npm install && npm run build --workspace client`
- Publish directory: `client/dist`
- Environment variable: `VITE_API_URL`

## Local Production Smoke Test

After building, you can smoke test the API locally:

```bash
npm run db:migrate
npm run start
```

Then open:

```txt
http://localhost:4000/api/health
```
