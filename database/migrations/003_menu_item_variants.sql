CREATE TABLE menu_item_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (menu_item_id, name)
);

INSERT INTO menu_item_variants (menu_item_id, name, price_cents, is_default)
SELECT id, 'Regular', price_cents, TRUE
FROM menu_items;

INSERT INTO menu_item_variants (menu_item_id, name, price_cents, is_default)
SELECT id, 'Small', 1080, FALSE
FROM menu_items
WHERE name = 'Signature Beef Noodles';

INSERT INTO menu_item_variants (menu_item_id, name, price_cents, is_default)
SELECT id, 'Large', 1680, FALSE
FROM menu_items
WHERE name = 'Signature Beef Noodles';

INSERT INTO menu_item_variants (menu_item_id, name, price_cents, is_default)
SELECT id, 'Small', 1280, FALSE
FROM menu_items
WHERE name = 'Grilled Chicken Rice Bowl';

INSERT INTO menu_item_variants (menu_item_id, name, price_cents, is_default)
SELECT id, 'Large', 1880, FALSE
FROM menu_items
WHERE name = 'Grilled Chicken Rice Bowl';

ALTER TABLE order_items
ADD COLUMN menu_item_variant_id UUID REFERENCES menu_item_variants(id) ON DELETE RESTRICT;

UPDATE order_items oi
SET menu_item_variant_id = variants.id
FROM menu_item_variants variants
WHERE variants.menu_item_id = oi.menu_item_id
  AND variants.is_default = TRUE;

ALTER TABLE order_items
ALTER COLUMN menu_item_variant_id SET NOT NULL;

CREATE INDEX idx_menu_item_variants_menu_item_id ON menu_item_variants(menu_item_id);
CREATE INDEX idx_order_items_menu_item_variant_id ON order_items(menu_item_variant_id);
