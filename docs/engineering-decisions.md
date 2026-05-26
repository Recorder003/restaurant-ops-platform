# Engineering Decisions

This document records important design decisions and the reasoning behind them.

The goal is not to claim every decision is perfect. The goal is to show that each technical choice was made intentionally, with trade-offs considered.

## Decision 1: Use PostgreSQL Instead of MongoDB

## Context

The system includes users, restaurants, menu items, orders, order items, payments, and staff roles. These entities have clear relationships.

## Decision

Use PostgreSQL as the primary database.

## Reasoning

PostgreSQL is a good fit because:

- Orders contain multiple order items.
- Order items reference menu items.
- Users have roles.
- Historical order data needs consistency.
- SQL queries are useful for reporting and dashboard features.
- Relational constraints can protect data integrity.

## Trade-Off

MongoDB may allow faster prototyping, but this project benefits more from relational modeling and consistency.

## Decision 2: Store Price Snapshots in Order Items

## Context

Menu item prices may change over time.

If an item price changes after a customer places an order, historical orders should still show the original price.

## Decision

Store `unit_price_snapshot` and `item_name_snapshot` in the `order_items` table.

## Reasoning

This prevents historical orders from changing when menu items are updated.

## Trade-Off

This duplicates some data, but it protects historical accuracy.

## Decision 3: Enforce Order Status Transitions on the Backend

## Context

Orders follow a lifecycle. Allowing any status to change into any other status can create invalid business states.

## Decision

Define valid order status transitions and enforce them on the backend.

## Reasoning

Examples of invalid states:

- Completed order becomes cancelled
- Cancelled order becomes preparing
- Rejected order becomes accepted
- Ready order goes back to pending

The backend should reject invalid transitions.

## Trade-Off

This adds more business logic, but it makes the system safer and closer to real-world workflows.

## Decision 4: Use Role-Based Access Control

## Context

The system has customers, staff, and admins.

Each group needs different permissions.

## Decision

Use role-based access control for the MVP.

## Reasoning

RBAC is simple and understandable for this system.

Example:

- Customers create orders
- Staff update order status
- Admins manage menu items and staff roles

## Trade-Off

RBAC is less flexible than permission-based access control. In a larger system, a more granular permission model may be better.

## Decision 5: Organize Frontend by Feature

## Context

A common beginner structure separates files only by file type:

```txt
components/
pages/
services/
```

This can become hard to maintain as the app grows.

Decision

Organize frontend code by feature.

Example:

features/
  auth/
  menu/
  orders/
  staff-dashboard/
  admin-dashboard/
Reasoning

Feature-based structure keeps related UI, hooks, services, and types close together.

This makes the codebase easier to understand and maintain.

Trade-Off

For very small apps, this may feel like extra organization. However, this project is designed to demonstrate scalable frontend architecture.

Decision 6: Use REST API for MVP
Context

The frontend needs to communicate with the backend.

Decision

Use REST APIs for the MVP.

Reasoning

The domain has clear resources:

users
menu items
orders
staff
payments

REST is simple, widely understood, and easy to document.

Trade-Off

GraphQL may offer more flexible data fetching, but it adds complexity that is not necessary for the MVP.

Decision 7: Start with Polling Before Real-Time Updates
Context

Kitchen staff and customers benefit from live order updates.

Decision

Start with API refetching or polling, then consider WebSocket or Server-Sent Events later.

Reasoning

Polling is easier to implement and debug for the MVP.

Real-time updates can be added after the core order lifecycle is stable.

Trade-Off

Polling is less efficient and less immediate than WebSocket or Server-Sent Events, but it reduces early complexity.

Decision 8: Soft Delete Menu Items
Context

Admins may want to remove menu items from the active menu.

However, old orders may reference those menu items.

Decision

Use is_active or is_available instead of hard deleting menu items.

Reasoning

Historical orders should remain readable.

Hard deleting menu items could break order history.

Trade-Off

Soft deletion requires filtering inactive items in queries, but it improves data integrity.

Decision 9: Validate Input on the Backend
Context

Frontend validation improves user experience, but frontend code can be bypassed.

Decision

All important validation must happen on the backend.

Reasoning

The backend must protect the system from invalid or malicious requests.

Examples:

Invalid quantities
Invalid order status
Unauthorized role changes
Incorrect item prices
Trade-Off

This may duplicate some validation between frontend and backend, but it is necessary for security and reliability.

Decision 10: Document Before Coding
Context

Many portfolio projects start directly with implementation and later become hard to explain.

Decision

Write product and architecture documentation before implementation.

Reasoning

This helps clarify:

What problem the project solves
Who the users are
What the system boundaries are
What trade-offs were considered
How the project should be discussed in interviews
Trade-Off

Documentation takes time before visible code exists, but it improves project direction and communication.


---

# 8. `.gitignore`

```gitignore
node_modules
dist
build
.env
.env.local
.DS_Store
coverage
.vscode