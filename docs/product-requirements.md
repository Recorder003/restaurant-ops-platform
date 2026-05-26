# Product Requirements

## 1. Overview

The Restaurant Operations & Order Management Platform is a full-stack web application for managing restaurant ordering workflows.

The system supports three main user groups:

- Customers
- Staff
- Admins

The goal is to design a realistic restaurant operations system that goes beyond basic CRUD functionality.

## 2. Product Problem

Restaurants need more than a simple menu and checkout page. They also need tools to manage order flow, kitchen status, staff permissions, menu availability, and historical order data.

This project focuses on solving the following problems:

- Customers need a clear way to place and track orders.
- Staff need a reliable dashboard to process incoming orders.
- Admins need tools to manage menus and staff access.
- The system needs to prevent invalid order states.
- Historical order data should remain accurate even if menu items change later.

## 3. Target Users

## Customer

A customer can:

- Browse menu items
- Add items to cart
- Place an order
- View order status
- Cancel an order if it has not entered preparation

A customer cannot:

- View other customers' orders
- Update kitchen status
- Manage menu items
- Access staff or admin dashboards

## Staff

A staff member can:

- View active orders
- Accept or reject new orders
- Update order preparation status
- Mark orders as ready or completed

A staff member cannot:

- Manage staff roles
- Change restaurant-level settings
- Access admin-only reports

## Admin

An admin can:

- Create and update menu items
- Disable unavailable items
- Manage staff roles
- View order history
- View basic operational metrics

Admins still cannot bypass core business rules such as invalid order status transitions.

## 4. Core User Stories

## Customer Stories

- As a customer, I want to browse menu items so I can decide what to order.
- As a customer, I want to see item availability so I do not order unavailable items.
- As a customer, I want to place an order so the restaurant can prepare it.
- As a customer, I want to track order status so I know when my order is ready.
- As a customer, I want to cancel my order before preparation begins.

## Staff Stories

- As staff, I want to view incoming orders so I can start processing them.
- As staff, I want to update order status so the kitchen workflow stays organized.
- As staff, I want invalid status changes to be blocked so mistakes are reduced.

## Admin Stories

- As an admin, I want to manage menu items so the menu stays accurate.
- As an admin, I want to disable items instead of deleting them so order history remains valid.
- As an admin, I want to manage staff roles so access is controlled.
- As an admin, I want to view order history so I can understand restaurant activity.

## 5. MVP Scope

The MVP will include:

- User registration and login
- Customer menu browsing
- Cart and order creation
- Staff order dashboard
- Order status updates
- Admin menu management
- Role-based access control
- PostgreSQL database schema
- REST API design
- Basic deployment plan

## 6. Out of Scope for MVP

The first version will not include:

- Real production payment processing
- Delivery driver logistics
- Inventory forecasting
- Complex tax calculation
- Native mobile apps
- Multi-location enterprise support
- Advanced analytics

These features may be considered in future versions.

## 7. Business Rules

Important business rules include:

- A customer can only view their own orders.
- Staff can update order status but cannot manage menu prices.
- Admins can manage menu items and staff roles.
- Completed orders cannot be cancelled.
- Cancelled orders cannot return to active preparation.
- Menu items should be disabled instead of hard deleted if they appear in historical orders.
- Historical orders should preserve the item name and price at the time of purchase.

## 8. Success Criteria

This project will be considered successful if it demonstrates:

- Clear product requirements
- Realistic user workflows
- Thoughtful database design
- Secure role-based permissions
- Consistent API design
- Backend-enforced business rules
- Maintainable frontend architecture
- Clear engineering trade-offs