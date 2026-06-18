# Restaurant Operations & Order Management Platform

## Live Demo

Public demo: [http://restaurant-ops-api.us-west-1.elasticbeanstalk.com](http://restaurant-ops-api.us-west-1.elasticbeanstalk.com)

Demo accounts:

- Admin: `admin@example.com / Admin123!`
- Staff: `staff@example.com / Staff123!`
- Chef: `chef@example.com / Chef123!`

A full-stack restaurant operations platform designed to support customer ordering, staff order management, menu administration, role-based access control, and order lifecycle tracking.

This project is not intended to be a simple CRUD demo. The goal is to build a realistic web application that demonstrates end-to-end product thinking, frontend architecture, API design, database modeling, authentication, authorization, deployment awareness, and engineering trade-offs.

## Project Status

Currently implemented as a working full-stack prototype with realistic restaurant operations flows.

The app currently includes:

- Role-based sign-in for admin, staff, and chef users
- Step-by-step staff ordering for dine-in, to-go, phone pickup, and phone delivery
- Item-level kitchen workflow for chefs, with order status automatically summarized from dish progress
- Menu, table, employee, order history, checkout, receipt, and sold-out management
- PostgreSQL-backed persistence with database migrations
- Realtime order, table, and menu refresh using an authenticated event stream
- Security headers, request size limits, and login failure rate limiting
- Structured request logs with request id tracing
- Frontend session expiry handling, request reference errors, and duplicate-submit protection
- API integration tests, browser E2E tests, and GitHub Actions CI

## Why This Project

Many beginner full-stack projects focus mainly on building pages and basic CRUD features. Real-world software engineering requires more than that.

A production-style web application needs to consider:

- User roles and permissions
- API boundaries
- Database consistency
- Error handling
- Deployment configuration
- Security
- Performance
- Maintainability
- Business rules

This project is designed to demonstrate those skills through a realistic restaurant operations use case.

## Problem Statement

Small and mid-sized restaurants need a lightweight system to manage customer orders, kitchen workflows, menu updates, and staff permissions.

A simple ordering page is not enough. Restaurant operations also require internal tools for staff and managers, such as order queues, status updates, menu management, and access control.

## Target Users

### Customer

Customers can browse the menu, place orders, and track order status.

### Staff

Staff can view incoming orders, accept orders, update preparation status, and complete orders.

### Admin

Admins can manage menu items, staff roles, restaurant settings, and view order history.

## Implemented Features

### Staff Features

- Create guided orders across service types
- Select tables from the configured restaurant floor
- Enforce table capacity plus limited extra-chair flexibility
- Edit and cancel pending orders
- Serve ready orders, checkout paid orders, and print receipts

### Chef Features

- View pending and preparing kitchen orders
- Start pending orders
- Mark preparing orders as ready
- Mark menu items as sold out

### Admin Features

- Create, update, delete, and disable menu items
- Manage staff roles
- Manage restaurant tables
- View order history
- View operational metrics and receipts

## Tech Stack

### Frontend

- React
- TypeScript
- Vite

### Backend

- Node.js
- Express.js
- TypeScript
- REST API
- Token authentication
- Role-based authorization

### Database

- PostgreSQL
- SQL schema and migration scripts

### Deployment

- AWS deployment target: S3, CloudFront, Elastic Beanstalk, and RDS PostgreSQL
- Environment-based frontend/API configuration
- GitHub Actions for CI checks

## High-Level Architecture

```txt
User
 |
 v
React Frontend
 |
 v
REST API Server
 |
 v
PostgreSQL Database
```

## Key Engineering Focus Areas

- Designing a realistic full-stack architecture
- Modeling relational data correctly
- Enforcing order status rules on the backend
- Separating customer, staff, and admin permissions
- Handling API errors consistently
- Planning for deployment and environment configuration
- Documenting engineering trade-offs

## Documentation

Detailed planning documents are available in the docs folder:

- product-requirements.md
- architecture.md
- database-design.md
- api-design.md
- auth-rbac.md
- engineering-decisions.md

## Local Development

Copy the example environment file before running the app locally:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Start the project from VS Code with `Terminal > Run Task > Start project`.

That task starts the Docker PostgreSQL container, runs pending database migrations, and starts both the API and Vite client.

To apply database changes without starting the app, run `Terminal > Run Task > Migrate PostgreSQL database`.

`Init PostgreSQL database` is a local reset task. It rebuilds the development database from `database/schema.sql`, so use it only when you intentionally want fresh seed data.

## Production Readiness

The project includes a production-oriented startup path:

```bash
npm run build
npm run db:migrate
npm run start
```

The API exposes `GET /api/health`, which checks both the server process and PostgreSQL connection.

Deployment notes, AWS architecture, and required environment variables are documented in `docs/deployment.md`.

## Deployment Preview Plan

The intended public-demo deployment is:

```txt
React/Vite client -> S3 static hosting -> CloudFront HTTPS URL
Express API       -> Elastic Beanstalk Node.js environment
PostgreSQL        -> Amazon RDS PostgreSQL
```

The frontend uses `VITE_API_URL` at build time to call the hosted API. The backend uses `DATABASE_URL`, `CLIENT_ORIGIN`, and `AUTH_TOKEN_SECRET` from the hosting environment.

For an HR-facing demo, seed accounts are available after database migration:

- `admin@example.com / Admin123!`
- `staff@example.com / Staff123!`
- `chef@example.com / Chef123!`

Do not reuse development secrets in production. Generate a new `AUTH_TOKEN_SECRET` before deploying.

## Testing

Run the API integration test suite with:

```bash
npm.cmd run test
```

Run the client unit tests for extracted business rules with:

```bash
npm.cmd run test:unit
```

Run the browser end-to-end workflow test with:

```bash
npm.cmd run test:e2e
```

Run the local API performance benchmark with:

```bash
npm.cmd run test:perf
```

The test command starts the local Docker PostgreSQL container, builds the server, initializes a separate PostgreSQL database named `restaurant_orders_test`, starts the API on port `4100`, and verifies the core restaurant workflow: authentication, table occupancy, party size limits, role permissions, kitchen status transitions, checkout, order history, table cleaning, and sold-out item protection.

The test database is reset by the test command and does not affect the normal local development database.

The E2E command uses a separate database named `restaurant_orders_e2e`, starts the API on port `4200`, starts the Vite client on port `5175`, and drives a real browser through the staff order flow, chef kitchen flow, checkout, and receipt preview.

The performance command uses a separate database named `restaurant_orders_perf`, starts the API on port `4300`, and reports local avg/p50/p95/max response times for health, menu, login, order listing, filtered order listing, and deep pagination scenarios.

By default it benchmarks `500`, `5000`, and `10000` synthetic orders. You can override that with:

```bash
PERF_ORDER_COUNTS=500,2000,5000 npm.cmd run test:perf
```

## Continuous Integration

GitHub Actions runs the project quality gate on pushes and pull requests:

- `npm run typecheck`
- `npm run build`
- `npm run test:unit`
- `npm run test`
- `npm run test:e2e`

The CI workflow uses a PostgreSQL service container and sets `SKIP_DOCKER_POSTGRES=1`, so the test scripts connect to the CI database service instead of trying to start the local Docker container.

## Future Improvements

Potential future improvements include:

- Stripe test-mode payment integration
- Admin analytics dashboard
- Audit logs for staff/admin actions
- Multi-restaurant support
- AWS production deployment with S3, CloudFront, Elastic Beanstalk, and RDS

Author
