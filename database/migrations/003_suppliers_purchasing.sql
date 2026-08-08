-- Task 3: organization-isolated suppliers, purchasing, and goods receipts.
-- Goods receipt quantities are operational evidence only; inventory ledger posting is deferred to Task 4.

INSERT INTO permissions (code, description) VALUES
  ('purchasing.read', 'View suppliers, supplier pricing, purchase orders, and receipts'),
  ('purchasing.manage', 'Create and maintain suppliers, supplier pricing, and draft purchase orders'),
  ('purchasing.approve', 'Approve purchase orders and mark approved orders as ordered'),
  ('purchasing.receive', 'Record controlled goods receipts against ordered purchase orders')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code IN (
  'purchasing.read',
  'purchasing.manage',
  'purchasing.approve',
  'purchasing.receive'
)
WHERE roles.slug IN ('owner', 'administrator')
  AND roles.organization_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code = 'purchasing.read'
WHERE roles.slug = 'member'
  AND roles.organization_id IS NULL
ON CONFLICT DO NOTHING;

ALTER TABLE locations
  ADD CONSTRAINT locations_id_organization_unique UNIQUE (id, organization_id);

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name VARCHAR(200) NOT NULL,
  normalized_name VARCHAR(200)
    GENERATED ALWAYS AS (LOWER(REGEXP_REPLACE(BTRIM(name), '\s+', ' ', 'g'))) STORED,
  legal_name VARCHAR(240),
  contact_person VARCHAR(160),
  phone VARCHAR(40),
  email VARCHAR(320),
  website_url VARCHAR(500),
  address TEXT,
  tax_number VARCHAR(100),
  notes TEXT,
  payment_terms_days INTEGER,
  preferred_currency VARCHAR(3) NOT NULL DEFAULT 'EGP',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT suppliers_organization_name_unique UNIQUE (organization_id, normalized_name),
  CHECK (LENGTH(BTRIM(name)) BETWEEN 1 AND 200),
  CHECK (legal_name IS NULL OR LENGTH(BTRIM(legal_name)) BETWEEN 1 AND 240),
  CHECK (email IS NULL OR email = LOWER(email)),
  CHECK (payment_terms_days IS NULL OR payment_terms_days >= 0),
  CHECK (preferred_currency ~ '^[A-Z]{3}$')
);

CREATE TABLE supplier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  supplier_id UUID NOT NULL,
  sku_id UUID NOT NULL,
  supplier_sku_code VARCHAR(120),
  current_unit_cost NUMERIC(19, 4) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  moq NUMERIC(19, 4) NOT NULL DEFAULT 1,
  lead_time_days INTEGER NOT NULL DEFAULT 0,
  preferred BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT supplier_products_supplier_same_organization_fk
    FOREIGN KEY (supplier_id, organization_id)
    REFERENCES suppliers (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT supplier_products_sku_same_organization_fk
    FOREIGN KEY (sku_id, organization_id)
    REFERENCES skus (id, organization_id)
    ON DELETE RESTRICT,
  CHECK (
    supplier_sku_code IS NULL
    OR LENGTH(BTRIM(supplier_sku_code)) BETWEEN 1 AND 120
  ),
  CHECK (current_unit_cost >= 0),
  CHECK (currency ~ '^[A-Z]{3}$'),
  CHECK (moq > 0),
  CHECK (lead_time_days >= 0)
);

CREATE UNIQUE INDEX supplier_products_active_relationship_unique
  ON supplier_products (organization_id, supplier_id, sku_id)
  WHERE is_active = TRUE;

CREATE UNIQUE INDEX supplier_products_one_preferred_per_sku
  ON supplier_products (organization_id, sku_id)
  WHERE preferred = TRUE AND is_active = TRUE;

CREATE TABLE supplier_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  supplier_product_id UUID NOT NULL,
  unit_cost NUMERIC(19, 4) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  source VARCHAR(160),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT supplier_price_history_product_same_organization_fk
    FOREIGN KEY (supplier_product_id, organization_id)
    REFERENCES supplier_products (id, organization_id)
    ON DELETE RESTRICT,
  CHECK (unit_cost >= 0),
  CHECK (currency ~ '^[A-Z]{3}$'),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE UNIQUE INDEX supplier_price_history_one_current_price
  ON supplier_price_history (supplier_product_id)
  WHERE effective_to IS NULL;

CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  supplier_id UUID NOT NULL,
  po_number VARCHAR(80) NOT NULL,
  order_date DATE NOT NULL,
  expected_delivery_date DATE,
  currency VARCHAR(3) NOT NULL,
  payment_terms_days INTEGER,
  notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'approved',
      'ordered',
      'partially_received',
      'received',
      'cancelled'
    )),
  subtotal NUMERIC(19, 4) NOT NULL DEFAULT 0,
  discount_total NUMERIC(19, 4) NOT NULL DEFAULT 0,
  tax_total NUMERIC(19, 4) NOT NULL DEFAULT 0,
  shipping_cost NUMERIC(19, 4) NOT NULL DEFAULT 0,
  other_cost NUMERIC(19, 4) NOT NULL DEFAULT 0,
  grand_total NUMERIC(19, 4) NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT purchase_orders_organization_number_unique UNIQUE (organization_id, po_number),
  CONSTRAINT purchase_orders_supplier_same_organization_fk
    FOREIGN KEY (supplier_id, organization_id)
    REFERENCES suppliers (id, organization_id)
    ON DELETE RESTRICT,
  CHECK (LENGTH(BTRIM(po_number)) BETWEEN 1 AND 80),
  CHECK (currency ~ '^[A-Z]{3}$'),
  CHECK (payment_terms_days IS NULL OR payment_terms_days >= 0),
  CHECK (expected_delivery_date IS NULL OR expected_delivery_date >= order_date),
  CHECK (
    subtotal >= 0
    AND discount_total >= 0
    AND tax_total >= 0
    AND shipping_cost >= 0
    AND other_cost >= 0
    AND grand_total >= 0
  ),
  CHECK (
    grand_total = ROUND(
      subtotal - discount_total + tax_total + shipping_cost + other_cost,
      4
    )
  ),
  CHECK (
    status NOT IN ('approved', 'ordered', 'partially_received', 'received')
    OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  )
);

CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  purchase_order_id UUID NOT NULL,
  sku_id UUID NOT NULL,
  supplier_product_id UUID,
  quantity_ordered NUMERIC(19, 4) NOT NULL,
  unit_cost NUMERIC(19, 4) NOT NULL,
  discount_amount NUMERIC(19, 4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(19, 4) NOT NULL DEFAULT 0,
  line_total NUMERIC(19, 4) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT purchase_order_items_po_same_organization_fk
    FOREIGN KEY (purchase_order_id, organization_id)
    REFERENCES purchase_orders (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT purchase_order_items_sku_same_organization_fk
    FOREIGN KEY (sku_id, organization_id)
    REFERENCES skus (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT purchase_order_items_supplier_product_same_organization_fk
    FOREIGN KEY (supplier_product_id, organization_id)
    REFERENCES supplier_products (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT purchase_order_items_one_sku_per_order UNIQUE (purchase_order_id, sku_id),
  CHECK (quantity_ordered > 0),
  CHECK (unit_cost >= 0),
  CHECK (discount_amount >= 0),
  CHECK (tax_amount >= 0),
  CHECK (discount_amount <= ROUND(quantity_ordered * unit_cost, 4)),
  CHECK (
    line_total = ROUND(
      quantity_ordered * unit_cost - discount_amount + tax_amount,
      4
    )
  ),
  CHECK (line_total >= 0)
);

CREATE TABLE goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  purchase_order_id UUID NOT NULL,
  receipt_number VARCHAR(80) NOT NULL,
  received_date DATE NOT NULL,
  location_id UUID NOT NULL,
  notes TEXT,
  received_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT goods_receipts_organization_number_unique UNIQUE (organization_id, receipt_number),
  CONSTRAINT goods_receipts_po_same_organization_fk
    FOREIGN KEY (purchase_order_id, organization_id)
    REFERENCES purchase_orders (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT goods_receipts_location_same_organization_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES locations (id, organization_id)
    ON DELETE RESTRICT,
  CHECK (LENGTH(BTRIM(receipt_number)) BETWEEN 1 AND 80)
);

CREATE TABLE goods_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  goods_receipt_id UUID NOT NULL,
  purchase_order_item_id UUID NOT NULL,
  sku_id UUID NOT NULL,
  quantity_received NUMERIC(19, 4) NOT NULL,
  quantity_rejected NUMERIC(19, 4) NOT NULL DEFAULT 0,
  condition_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT goods_receipt_items_receipt_same_organization_fk
    FOREIGN KEY (goods_receipt_id, organization_id)
    REFERENCES goods_receipts (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT goods_receipt_items_po_item_same_organization_fk
    FOREIGN KEY (purchase_order_item_id, organization_id)
    REFERENCES purchase_order_items (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT goods_receipt_items_sku_same_organization_fk
    FOREIGN KEY (sku_id, organization_id)
    REFERENCES skus (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT goods_receipt_items_one_po_line_per_receipt
    UNIQUE (goods_receipt_id, purchase_order_item_id),
  CHECK (quantity_received >= 0),
  CHECK (quantity_rejected >= 0),
  CHECK (quantity_received > 0 OR quantity_rejected > 0)
);

CREATE TRIGGER suppliers_set_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER supplier_products_set_updated_at
  BEFORE UPDATE ON supplier_products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER purchase_orders_set_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER purchase_order_items_set_updated_at
  BEFORE UPDATE ON purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX suppliers_organization_active_idx
  ON suppliers (organization_id, is_active, name);

CREATE INDEX suppliers_name_search_idx
  ON suppliers USING GIN (normalized_name gin_trgm_ops);

CREATE INDEX supplier_products_supplier_idx
  ON supplier_products (organization_id, supplier_id, is_active);

CREATE INDEX supplier_products_sku_idx
  ON supplier_products (organization_id, sku_id, is_active);

CREATE INDEX supplier_price_history_product_idx
  ON supplier_price_history (organization_id, supplier_product_id, effective_from DESC);

CREATE INDEX purchase_orders_organization_filters_idx
  ON purchase_orders (
    organization_id,
    status,
    order_date DESC,
    expected_delivery_date,
    supplier_id
  );

CREATE INDEX purchase_orders_number_search_idx
  ON purchase_orders USING GIN (po_number gin_trgm_ops);

CREATE INDEX purchase_order_items_order_idx
  ON purchase_order_items (organization_id, purchase_order_id);

CREATE INDEX goods_receipts_order_idx
  ON goods_receipts (organization_id, purchase_order_id, received_date DESC);

CREATE INDEX goods_receipts_number_search_idx
  ON goods_receipts USING GIN (receipt_number gin_trgm_ops);

CREATE INDEX goods_receipt_items_receipt_idx
  ON goods_receipt_items (organization_id, goods_receipt_id);

CREATE INDEX goods_receipt_items_po_line_idx
  ON goods_receipt_items (organization_id, purchase_order_item_id);
