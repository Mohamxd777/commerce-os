-- Task 4: immutable inventory ledger, transactional balance projection, transfers,
-- adjustments, reorder planning, and controlled Goods Receipt posting.

INSERT INTO permissions (code, description) VALUES
  ('inventory.read', 'View stock balances, movement history, transfers, and reorder rules'),
  ('inventory.manage', 'Manage inventory planning settings and controlled receipt posting'),
  ('inventory.transfer', 'Create, ship, receive, and cancel inventory transfers'),
  ('inventory.adjust', 'Record audited inventory adjustments and bucket movements')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code IN (
  'inventory.read',
  'inventory.manage',
  'inventory.transfer',
  'inventory.adjust'
)
WHERE roles.slug IN ('owner', 'administrator')
  AND roles.organization_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code = 'inventory.read'
WHERE roles.slug = 'member'
  AND roles.organization_id IS NULL
ON CONFLICT DO NOTHING;

ALTER TABLE goods_receipts
  ADD COLUMN inventory_posted_at TIMESTAMPTZ,
  ADD COLUMN inventory_posted_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT goods_receipts_inventory_posting_state_check CHECK (
    (inventory_posted_at IS NULL AND inventory_posted_by IS NULL)
    OR (inventory_posted_at IS NOT NULL AND inventory_posted_by IS NOT NULL)
  );

-- Existing receipts intentionally remain unposted. They require the same explicit,
-- permission-checked posting operation as new receipts; migration never invents stock.

CREATE TABLE inventory_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  sku_id UUID NOT NULL,
  location_id UUID NOT NULL,
  stock_bucket VARCHAR(20) NOT NULL
    CHECK (stock_bucket IN ('available', 'reserved', 'quarantine', 'damaged')),
  quantity NUMERIC(19, 4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT inventory_balances_dimension_unique
    UNIQUE (organization_id, sku_id, location_id, stock_bucket),
  CONSTRAINT inventory_balances_sku_same_organization_fk
    FOREIGN KEY (sku_id, organization_id)
    REFERENCES skus (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT inventory_balances_location_same_organization_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES locations (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT inventory_balances_nonnegative CHECK (quantity >= 0)
);

CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  sku_id UUID NOT NULL,
  location_id UUID NOT NULL,
  movement_type VARCHAR(40) NOT NULL CHECK (movement_type IN (
    'PURCHASE_RECEIPT',
    'TRANSFER_OUT',
    'TRANSFER_IN',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'DAMAGE',
    'QUARANTINE_IN',
    'QUARANTINE_OUT',
    'RELEASE_FROM_QUARANTINE',
    'RESERVATION',
    'RESERVATION_RELEASE',
    'SALE',
    'SALE_RETURN'
  )),
  quantity NUMERIC(19, 4) NOT NULL CHECK (quantity <> 0),
  stock_bucket VARCHAR(20) NOT NULL
    CHECK (stock_bucket IN ('available', 'reserved', 'quarantine', 'damaged')),
  reference_type VARCHAR(40) CHECK (reference_type IN (
    'goods_receipt',
    'inventory_transfer',
    'inventory_adjustment',
    'future_sale',
    'future_sale_return'
  )),
  reference_id UUID,
  correlation_id UUID,
  idempotency_key VARCHAR(240),
  reason VARCHAR(240),
  notes TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT inventory_movements_sku_same_organization_fk
    FOREIGN KEY (sku_id, organization_id)
    REFERENCES skus (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT inventory_movements_location_same_organization_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES locations (id, organization_id)
    ON DELETE RESTRICT,
  CHECK (
    (reference_type IS NULL AND reference_id IS NULL)
    OR (reference_type IS NOT NULL AND reference_id IS NOT NULL)
  ),
  CHECK (idempotency_key IS NULL OR LENGTH(BTRIM(idempotency_key)) BETWEEN 1 AND 240),
  CHECK (reason IS NULL OR LENGTH(BTRIM(reason)) BETWEEN 1 AND 240)
);

CREATE UNIQUE INDEX inventory_movements_idempotency_unique
  ON inventory_movements (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE inventory_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  transfer_number VARCHAR(80) NOT NULL,
  source_location_id UUID NOT NULL,
  destination_location_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_transit', 'received', 'cancelled')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  shipped_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  received_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  shipped_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT inventory_transfers_organization_number_unique
    UNIQUE (organization_id, transfer_number),
  CONSTRAINT inventory_transfers_source_same_organization_fk
    FOREIGN KEY (source_location_id, organization_id)
    REFERENCES locations (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT inventory_transfers_destination_same_organization_fk
    FOREIGN KEY (destination_location_id, organization_id)
    REFERENCES locations (id, organization_id)
    ON DELETE RESTRICT,
  CHECK (source_location_id <> destination_location_id),
  CHECK (LENGTH(BTRIM(transfer_number)) BETWEEN 1 AND 80),
  CHECK (
    (status = 'draft' AND shipped_at IS NULL AND received_at IS NULL)
    OR (status = 'cancelled' AND received_at IS NULL)
    OR (status = 'in_transit' AND shipped_at IS NOT NULL AND shipped_by IS NOT NULL AND received_at IS NULL)
    OR (
      status = 'received'
      AND shipped_at IS NOT NULL
      AND shipped_by IS NOT NULL
      AND received_at IS NOT NULL
      AND received_by IS NOT NULL
      AND received_at >= shipped_at
    )
  )
);

CREATE TABLE inventory_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  inventory_transfer_id UUID NOT NULL,
  sku_id UUID NOT NULL,
  quantity NUMERIC(19, 4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT inventory_transfer_items_transfer_same_organization_fk
    FOREIGN KEY (inventory_transfer_id, organization_id)
    REFERENCES inventory_transfers (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT inventory_transfer_items_sku_same_organization_fk
    FOREIGN KEY (sku_id, organization_id)
    REFERENCES skus (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT inventory_transfer_items_one_sku_unique
    UNIQUE (inventory_transfer_id, sku_id),
  CHECK (quantity > 0)
);

CREATE TABLE inventory_reorder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  sku_id UUID NOT NULL,
  location_id UUID NOT NULL,
  reorder_point NUMERIC(19, 4) NOT NULL DEFAULT 0,
  safety_stock NUMERIC(19, 4) NOT NULL DEFAULT 0,
  target_stock NUMERIC(19, 4),
  preferred_supplier_product_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT inventory_reorder_rules_dimension_unique
    UNIQUE (organization_id, sku_id, location_id),
  CONSTRAINT inventory_reorder_rules_sku_same_organization_fk
    FOREIGN KEY (sku_id, organization_id)
    REFERENCES skus (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT inventory_reorder_rules_location_same_organization_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES locations (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT inventory_reorder_rules_supplier_product_same_organization_fk
    FOREIGN KEY (preferred_supplier_product_id, organization_id)
    REFERENCES supplier_products (id, organization_id)
    ON DELETE RESTRICT,
  CHECK (reorder_point >= 0),
  CHECK (safety_stock >= 0),
  CHECK (target_stock IS NULL OR target_stock >= 0),
  CHECK (target_stock IS NULL OR target_stock >= reorder_point)
);

-- inventory_balances is a rebuildable projection. Only the movement trigger may
-- mutate it; application code inserts immutable movements instead.
CREATE OR REPLACE FUNCTION protect_inventory_balance_projection()
RETURNS TRIGGER AS $$
BEGIN
  IF CURRENT_SETTING('commerce.inventory_projection_write', TRUE) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'INVENTORY_BALANCE_DIRECT_WRITE: balances are ledger projections'
      USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_balances_protect_direct_write
  BEFORE INSERT OR UPDATE OR DELETE ON inventory_balances
  FOR EACH ROW EXECUTE FUNCTION protect_inventory_balance_projection();

CREATE OR REPLACE FUNCTION project_inventory_movement()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM SET_CONFIG('commerce.inventory_projection_write', 'on', TRUE);

  -- Create a zero projection row first. A negative movement cannot use its own
  -- quantity as the INSERT candidate because CHECK constraints are evaluated
  -- before PostgreSQL resolves ON CONFLICT.
  INSERT INTO inventory_balances (
    organization_id, sku_id, location_id, stock_bucket, quantity, updated_at
  ) VALUES (
    NEW.organization_id, NEW.sku_id, NEW.location_id,
    NEW.stock_bucket, 0, NOW()
  )
  ON CONFLICT (organization_id, sku_id, location_id, stock_bucket)
  DO NOTHING;

  UPDATE inventory_balances
  SET quantity = quantity + NEW.quantity,
      updated_at = NOW()
  WHERE organization_id = NEW.organization_id
    AND sku_id = NEW.sku_id
    AND location_id = NEW.location_id
    AND stock_bucket = NEW.stock_bucket;

  PERFORM SET_CONFIG('commerce.inventory_projection_write', 'off', TRUE);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM SET_CONFIG('commerce.inventory_projection_write', 'off', TRUE);
  RAISE;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_movements_project_balance
  AFTER INSERT ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION project_inventory_movement();

CREATE OR REPLACE FUNCTION protect_inventory_movement_immutability()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'INVENTORY_LEDGER_IMMUTABLE: record a corrective movement instead'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_movements_immutable
  BEFORE UPDATE OR DELETE ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION protect_inventory_movement_immutability();

CREATE TRIGGER inventory_transfers_set_updated_at
  BEFORE UPDATE ON inventory_transfers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER inventory_reorder_rules_set_updated_at
  BEFORE UPDATE ON inventory_reorder_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX inventory_movements_organization_occurred_idx
  ON inventory_movements (organization_id, occurred_at DESC, id DESC);

CREATE INDEX inventory_movements_sku_history_idx
  ON inventory_movements (organization_id, sku_id, occurred_at DESC);

CREATE INDEX inventory_movements_location_history_idx
  ON inventory_movements (organization_id, location_id, occurred_at DESC);

CREATE INDEX inventory_movements_reference_idx
  ON inventory_movements (organization_id, reference_type, reference_id);

CREATE INDEX inventory_balances_stock_lookup_idx
  ON inventory_balances (organization_id, location_id, sku_id, stock_bucket);

CREATE INDEX inventory_transfers_status_idx
  ON inventory_transfers (organization_id, status, created_at DESC);

CREATE INDEX inventory_transfers_number_search_idx
  ON inventory_transfers USING GIN (transfer_number gin_trgm_ops);

CREATE INDEX inventory_transfer_items_transfer_idx
  ON inventory_transfer_items (organization_id, inventory_transfer_id);

CREATE INDEX inventory_reorder_rules_active_idx
  ON inventory_reorder_rules (organization_id, is_active, location_id, sku_id);

CREATE INDEX goods_receipts_inventory_posting_idx
  ON goods_receipts (organization_id, inventory_posted_at, received_date DESC);
