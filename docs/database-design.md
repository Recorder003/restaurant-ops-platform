# Database Design

## 1. Database Choice

PostgreSQL is planned for this project.

The restaurant ordering domain contains relational data:

- Users create orders
- Orders contain multiple order items
- Order items reference menu items
- Staff belong to restaurants
- Payments belong to orders

A relational database helps preserve data consistency and makes the system easier to query.

## 2. Core Tables

The MVP will include the following tables:

- users
- restaurants
- staff_roles
- menu_categories
- menu_items
- orders
- order_items
- payments

## 3. Users Table

Purpose:

Stores account information for customers, staff, and admins.

Important fields:

```txt
id
name
email
password_hash
role
created_at
updated_at

Rules:

Email should be unique.
Passwords should be hashed.
Role should be limited to valid values.

Possible roles:

customer
staff
admin

## 4. Restaurants Table

Purpose:

Stores restaurant-level information.

Important fields:

id
name
address
phone
is_active
created_at
updated_at

For the MVP, the app may support one restaurant, but this table makes future multi-restaurant support easier.

## 5. Menu Categories Table

Purpose:

Groups menu items by category.

Important fields:

id
restaurant_id
name
display_order
is_active
created_at
updated_at

Example categories:

Appetizers
Main Dishes
Drinks
Desserts

## 6. Menu Items Table

Purpose:

Stores menu item information.

Important fields:

id
restaurant_id
category_id
name
description
price
is_available
is_active
created_at
updated_at

Important decision:

Menu items should be disabled instead of hard deleted.

Reason:

Historical orders may reference old menu items. Hard deleting menu items could break order history.

## 7. Orders Table

Purpose:

Stores order-level information.

Important fields:

id
user_id
restaurant_id
status
order_type
subtotal
tax
total
created_at
updated_at
completed_at
cancelled_at

Possible status values:

pending
accepted
preparing
ready
completed
cancelled
rejected

Possible order types:

dine_in
pickup

## 8. Order Items Table

Purpose:

Stores individual items within an order.

Important fields:

id
order_id
menu_item_id
item_name_snapshot
unit_price_snapshot
quantity
line_total
created_at

Important decision:

Store item name and price snapshots.

Reason:

If menu prices change later, historical orders should still show the original item name and price.

## 9. Payments Table

Purpose:

Tracks payment information for an order.

Important fields:

id
order_id
payment_provider
provider_payment_id
status
amount
created_at
updated_at

Possible payment statuses:

unpaid
pending
paid
failed
refunded

Important decision:

Order status and payment status should be separate.

Reason:

Payment may fail, be retried, or be refunded independently from kitchen preparation status.

## 10. Staff Roles Table

Purpose:

Supports restaurant staff permissions.

Important fields:

id
user_id
restaurant_id
role
created_at
updated_at

Possible role values:

staff
manager
admin

11. Indexing Strategy

Potential indexes:

users.email
orders.user_id
orders.restaurant_id
orders.status
orders.created_at
order_items.order_id
menu_items.restaurant_id
menu_items.category_id
menu_items.is_available

Why indexes matter:

Staff dashboard frequently queries active orders.
Customers need to view their own order history.
Menu pages need to load active items by category.
Admins may filter orders by status and date.
12. Data Consistency Rules

The system should prevent:

Orders without order items
Order item quantity less than 1
Completed orders being cancelled
Cancelled orders returning to preparation
Historical order prices changing after menu price updates
13. Transaction Considerations

Order creation should use a database transaction.

Flow:

Start transaction
Create order
Create order items
Calculate subtotal and total
Save order total
Commit transaction

If any step fails:

Rollback transaction
Return error response
14. Future Improvements

Possible future database improvements:

Audit logs
Inventory tracking
Refund records
Discount codes
Restaurant table reservations
Multi-location support