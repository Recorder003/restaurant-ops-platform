CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('staff', 'admin', 'chef')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_sold_out BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE restaurant_tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  capacity INTEGER NOT NULL DEFAULT 4 CHECK (capacity > 0),
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'occupied', 'needs_cleaning')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_source TEXT NOT NULL DEFAULT 'in_person'
    CHECK (order_source IN ('in_person', 'phone')),
  fulfillment_type TEXT NOT NULL DEFAULT 'dine_in'
    CHECK (fulfillment_type IN ('dine_in', 'to_go', 'pickup', 'delivery')),
  table_number TEXT,
  party_size INTEGER CHECK (party_size IS NULL OR party_size > 0),
  phone_number TEXT,
  server_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'preparing', 'ready', 'served', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('cash', 'card')),
  payment_subtotal_cents INTEGER CHECK (payment_subtotal_cents IS NULL OR payment_subtotal_cents >= 0),
  payment_tax_cents INTEGER CHECK (payment_tax_cents IS NULL OR payment_tax_cents >= 0),
  payment_tip_cents INTEGER CHECK (payment_tip_cents IS NULL OR payment_tip_cents >= 0),
  payment_total_cents INTEGER CHECK (payment_total_cents IS NULL OR payment_total_cents >= 0),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('order_created', 'order_updated', 'status_changed', 'payment_recorded')),
  from_status TEXT CHECK (from_status IS NULL OR from_status IN ('pending', 'preparing', 'ready', 'served', 'cancelled')),
  to_status TEXT CHECK (to_status IS NULL OR to_status IN ('pending', 'preparing', 'ready', 'served', 'cancelled')),
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('cash', 'card')),
  payment_total_cents INTEGER CHECK (payment_total_cents IS NULL OR payment_total_cents >= 0),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('staff', 'admin', 'chef')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0)
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_events_order_id ON order_events(order_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_restaurant_tables_status ON restaurant_tables(status);

INSERT INTO menu_items (name, category, price_cents, is_available) VALUES
  ('Signature Beef Noodles', 'Entrees', 1380, TRUE),
  ('Grilled Chicken Rice Bowl', 'Entrees', 1580, TRUE),
  ('Garlic Broccoli', 'Vegetables', 880, TRUE),
  ('Salt and Pepper Calamari', 'Small Plates', 1280, TRUE),
  ('Lemon Iced Tea', 'Drinks', 480, TRUE),
  ('Mango Pudding', 'Desserts', 580, TRUE);

INSERT INTO restaurant_tables (name, capacity, status) VALUES
  ('T1', 2, 'available'),
  ('T2', 2, 'available'),
  ('T3', 4, 'available'),
  ('T4', 4, 'available'),
  ('T5', 4, 'available'),
  ('T6', 4, 'available'),
  ('T7', 6, 'available'),
  ('T8', 6, 'available'),
  ('T9', 4, 'available'),
  ('T10', 4, 'available'),
  ('T11', 8, 'available'),
  ('T12', 8, 'available');
