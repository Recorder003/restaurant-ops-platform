# Authentication and Role-Based Access Control

## 1. Goal

The goal of authentication and authorization is to protect system resources and make sure users can only perform actions allowed by their role.

The system has three primary roles:

```txt
customer
staff
admin
```

2. Authentication vs Authorization

Authentication answers:

Who is this user?

Authorization answers:

What is this user allowed to do?

Example:

A user may be logged in, but that does not mean they are allowed to access admin features.

3. Authentication Flow
User submits login form
        |
        v
Backend verifies credentials
        |
        v
Backend returns access token
        |
        v
Frontend stores token
        |
        v
Frontend sends token with API requests
        |
        v
Backend verifies token on protected routes
4. Password Handling

Passwords should never be stored as plain text.

Planned approach:

Hash passwords before storage
Use bcrypt or a similar password hashing library
Compare hashed password during login
Never expose password hash to the frontend
5. Role Permissions
Customer

Customers can:

Browse menu items
Create orders
View their own orders
Cancel their own pending orders if allowed

Customers cannot:

View all orders
Update kitchen status
Manage menu items
Manage staff roles
Access admin dashboard
Staff

Staff can:

View active restaurant orders
Accept or reject orders
Update order preparation status
Mark orders as ready or completed

Staff cannot:

Manage staff roles
Modify restaurant settings
Access admin-only reports
Change menu prices unless granted admin access
Admin

Admins can:

Manage menu items
Manage staff roles
View order history
View operational metrics
Access staff dashboard

Admins still cannot:

Bypass core data consistency rules
Force invalid order state transitions
Access server secrets from the frontend
6. Frontend Route Protection

Frontend route protection improves user experience but is not enough for security.

Example route groups:

/customer/*
/staff/*
/admin/*

Frontend should:

Redirect unauthenticated users to login
Hide navigation links based on role
Prevent obvious access to unauthorized pages
Show loading state while checking current user

However, the backend must still enforce all permissions.

7. Backend Authorization

Backend authorization should be implemented with middleware.

Example middleware:

requireAuth
requireRole("admin")
requireRole("staff", "admin")

Example endpoint protection:

POST /orders                    customer
GET /orders/my                  customer
GET /staff/orders               staff, admin
PATCH /staff/orders/:id/status  staff, admin
POST /admin/menu-items          admin
PATCH /admin/menu-items/:id     admin
8. Resource Ownership Checks

Role checks are not always enough.

Example:

A customer should only view their own orders.

The backend must check:

order.user_id === currentUser.id

Without this check, one customer might access another customer's order by changing the order ID in the URL.

9. Common Security Mistakes to Avoid
Mistake 1: Only hiding buttons in the frontend

Hiding an admin button does not secure the admin API.

The backend must reject unauthorized requests.

Mistake 2: Trusting role from request body

The client should not be able to send:

{
  "role": "admin"
}

and gain admin access.

Roles must come from trusted backend data.

Mistake 3: Trusting frontend price calculations

The frontend can display prices, but the backend must calculate final order totals using database prices.

Mistake 4: Missing ownership checks

A customer should not access another customer's order by changing an ID in the URL.

10. Future Improvements

Possible future improvements:

HTTP-only cookie authentication
Refresh tokens
More granular permissions
Login rate limiting
Audit logs for staff/admin actions
Multi-restaurant role support