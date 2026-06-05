CREATE TABLE order_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card')),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  tax_cents INTEGER NOT NULL CHECK (tax_cents >= 0),
  tip_cents INTEGER NOT NULL CHECK (tip_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('staff', 'admin', 'chef')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_payment_items (
  payment_id UUID NOT NULL REFERENCES order_payments(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  PRIMARY KEY (payment_id, order_item_id),
  UNIQUE (order_item_id)
);

ALTER TABLE orders
DROP CONSTRAINT orders_payment_status_check,
ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid', 'refunded'));

INSERT INTO order_payments (
  order_id,
  payment_method,
  subtotal_cents,
  tax_cents,
  tip_cents,
  total_cents,
  actor_user_id,
  actor_name,
  actor_role,
  created_at
)
SELECT
  o.id,
  o.payment_method,
  o.payment_subtotal_cents,
  o.payment_tax_cents,
  o.payment_tip_cents,
  o.payment_total_cents,
  NULL,
  'System',
  'admin',
  COALESCE(o.paid_at, o.updated_at)
FROM orders o
WHERE o.payment_status = 'paid'
  AND o.payment_method IS NOT NULL
  AND o.payment_subtotal_cents IS NOT NULL
  AND o.payment_tax_cents IS NOT NULL
  AND o.payment_tip_cents IS NOT NULL
  AND o.payment_total_cents IS NOT NULL;

INSERT INTO order_payment_items (payment_id, order_item_id)
SELECT op.id, oi.id
FROM order_payments op
JOIN order_items oi ON oi.order_id = op.order_id;

CREATE INDEX idx_order_payments_order_id ON order_payments(order_id);
CREATE INDEX idx_order_payment_items_order_item_id ON order_payment_items(order_item_id);
