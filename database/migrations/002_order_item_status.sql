ALTER TABLE order_items
ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'preparing', 'ready', 'served')),
ADD COLUMN prepared_at TIMESTAMPTZ,
ADD COLUMN served_at TIMESTAMPTZ;

CREATE INDEX idx_order_items_status ON order_items(status);
