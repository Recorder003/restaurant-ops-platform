CREATE TABLE menu_bundles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_sold_out BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE menu_bundle_items (
  bundle_id UUID NOT NULL REFERENCES menu_bundles(id) ON DELETE CASCADE,
  menu_item_variant_id UUID NOT NULL REFERENCES menu_item_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  PRIMARY KEY (bundle_id, menu_item_variant_id)
);

ALTER TABLE order_items
ADD COLUMN bundle_id UUID REFERENCES menu_bundles(id) ON DELETE SET NULL;

INSERT INTO menu_bundles (name, price_cents, is_available, is_sold_out)
VALUES ('Lunch Combo', 2380, TRUE, FALSE);

INSERT INTO menu_bundle_items (bundle_id, menu_item_variant_id, quantity)
SELECT bundle.id, variant.id, 1
FROM menu_bundles bundle
JOIN menu_items item ON item.name = 'Grilled Chicken Rice Bowl'
JOIN menu_item_variants variant ON variant.menu_item_id = item.id AND variant.name = 'Regular'
WHERE bundle.name = 'Lunch Combo';

INSERT INTO menu_bundle_items (bundle_id, menu_item_variant_id, quantity)
SELECT bundle.id, variant.id, 1
FROM menu_bundles bundle
JOIN menu_items item ON item.name = 'Salt and Pepper Calamari'
JOIN menu_item_variants variant ON variant.menu_item_id = item.id AND variant.name = 'Regular'
WHERE bundle.name = 'Lunch Combo';

INSERT INTO menu_bundle_items (bundle_id, menu_item_variant_id, quantity)
SELECT bundle.id, variant.id, 1
FROM menu_bundles bundle
JOIN menu_items item ON item.name = 'Lemon Iced Tea'
JOIN menu_item_variants variant ON variant.menu_item_id = item.id AND variant.name = 'Regular'
WHERE bundle.name = 'Lunch Combo';

CREATE INDEX idx_menu_bundle_items_bundle_id ON menu_bundle_items(bundle_id);
CREATE INDEX idx_order_items_bundle_id ON order_items(bundle_id);
