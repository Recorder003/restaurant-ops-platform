# API Design

## 1. API Design Goals

The API should be predictable, consistent, and secure.

Goals:

- Use RESTful resource naming
- Validate request bodies
- Return consistent response formats
- Use meaningful HTTP status codes
- Enforce authentication and authorization
- Keep business rules on the backend
- Support pagination for large lists

## 2. Base URL

Development:

```txt
http://localhost:4000/api

Production:

https://api.example.com/api
3. Standard Response Format

Successful response:

{
  "data": {
    "id": "order_123",
    "status": "pending"
  }
}

List response:

{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}

Error response:

{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body.",
    "details": []
  }
}
4. HTTP Status Codes
200 OK                  Successful read or update
201 Created             Resource created
204 No Content          Successful delete or disable operation
400 Bad Request         Invalid request
401 Unauthorized        User is not logged in
403 Forbidden           User is logged in but not allowed
404 Not Found           Resource not found
409 Conflict            Business rule conflict
422 Unprocessable Entity Validation failed
500 Internal Server Error Unexpected server error
5. Authentication APIs
Register
POST /auth/register

Request:

{
  "name": "Mingqi Wang",
  "email": "ming@example.com",
  "password": "password123"
}
Login
POST /auth/login

Request:

{
  "email": "ming@example.com",
  "password": "password123"
}

Response:

{
  "data": {
    "accessToken": "jwt_token",
    "user": {
      "id": "user_123",
      "role": "customer"
    }
  }
}
Get Current User
GET /auth/me

Authorization:

customer, staff, admin
6. Menu APIs
Get Public Menu
GET /menu-items

Query parameters:

category
available
page
limit

Purpose:

Returns active menu items visible to customers.

Create Menu Item
POST /admin/menu-items

Authorization:

admin

Request:

{
  "name": "Chicken Rice Bowl",
  "description": "Grilled chicken with rice and vegetables.",
  "categoryId": "cat_123",
  "price": 12.99,
  "isAvailable": true
}
Update Menu Item
PATCH /admin/menu-items/:id

Authorization:

admin
Disable Menu Item
DELETE /admin/menu-items/:id

Authorization:

admin

Important:

This should soft-delete or disable the item instead of hard deleting it.

7. Order APIs
Create Order
POST /orders

Authorization:

customer

Request:

{
  "orderType": "dine_in",
  "items": [
    {
      "menuItemId": "item_123",
      "quantity": 2
    }
  ]
}

Backend responsibilities:

Verify user identity
Validate item IDs
Check item availability
Fetch current prices from database
Create order and order items in a transaction
Store price snapshots
Return created order
Get My Orders
GET /orders/my

Authorization:

customer

Purpose:

Returns orders created by the current logged-in customer.

Get Staff Orders
GET /staff/orders

Authorization:

staff, admin

Query parameters:

status
page
limit

Purpose:

Returns active restaurant orders for staff dashboard.

Update Order Status
PATCH /staff/orders/:id/status

Authorization:

staff, admin

Request:

{
  "status": "preparing"
}

Backend responsibilities:

Verify staff or admin role
Fetch current order
Check if requested status transition is valid
Update order status
Return updated order
8. Order Status Transition Rules

Valid transitions:

pending -> accepted
pending -> rejected
pending -> cancelled
accepted -> preparing
accepted -> cancelled
preparing -> ready
ready -> completed

Invalid transitions should return:

409 Conflict

Example response:

{
  "error": {
    "code": "INVALID_ORDER_STATUS_TRANSITION",
    "message": "Order cannot move from completed to cancelled."
  }
}
9. Admin APIs
Get Staff List
GET /admin/staff

Authorization:

admin
Update Staff Role
PATCH /admin/staff/:userId/role

Authorization:

admin

Request:

{
  "role": "staff"
}
Get Order History
GET /admin/orders

Authorization:

admin

Query parameters:

status
fromDate
toDate
page
limit
10. Validation Strategy

The backend should validate:

Required fields
Field types
String lengths
Positive quantities
Valid enum values
Valid IDs
User permissions

Recommended validation tool:

Zod
11. Security Considerations

The backend should not trust frontend input for:

User role
Item price
Order total
Payment status
Order ownership
Permission checks

Sensitive values should always be verified on the backend.