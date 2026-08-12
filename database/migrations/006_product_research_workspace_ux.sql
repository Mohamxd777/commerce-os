-- Task 6: Product Research workspace UX support.
-- These additions enrich the existing Task 5 records without duplicating its domain logic.

ALTER TABLE product_candidates
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS model_number VARCHAR(120),
  ADD COLUMN IF NOT EXISTS gtin VARCHAR(32),
  ADD COLUMN IF NOT EXISTS planned_selling_price NUMERIC(19, 4),
  ADD COLUMN IF NOT EXISTS planned_price_currency VARCHAR(3);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_candidates_workspace_fields_check') THEN
    ALTER TABLE product_candidates ADD CONSTRAINT product_candidates_workspace_fields_check CHECK (
      (model_number IS NULL OR LENGTH(BTRIM(model_number)) BETWEEN 1 AND 120)
      AND (gtin IS NULL OR gtin ~ '^[0-9]{8,14}$')
      AND (planned_selling_price IS NULL OR planned_selling_price > 0)
      AND (planned_price_currency IS NULL OR planned_price_currency ~ '^[A-Z]{3}$')
      AND ((planned_selling_price IS NULL) = (planned_price_currency IS NULL))
    );
  END IF;
END $$;

ALTER TABLE product_candidate_market_snapshots
  ADD COLUMN IF NOT EXISTS listing_title VARCHAR(500),
  ADD COLUMN IF NOT EXISTS seller_brand VARCHAR(200),
  ADD COLUMN IF NOT EXISTS original_price NUMERIC(19, 4),
  ADD COLUMN IF NOT EXISTS recent_sales_signal VARCHAR(240),
  ADD COLUMN IF NOT EXISTS bestseller_rank_text VARCHAR(240),
  ADD COLUMN IF NOT EXISTS fulfillment_badge VARCHAR(120);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'research_snapshots_workspace_fields_check') THEN
    ALTER TABLE product_candidate_market_snapshots
      ADD CONSTRAINT research_snapshots_workspace_fields_check CHECK (
        (listing_title IS NULL OR LENGTH(BTRIM(listing_title)) BETWEEN 1 AND 500)
        AND (seller_brand IS NULL OR LENGTH(BTRIM(seller_brand)) BETWEEN 1 AND 200)
        AND (original_price IS NULL OR original_price >= 0)
        AND (recent_sales_signal IS NULL OR LENGTH(BTRIM(recent_sales_signal)) BETWEEN 1 AND 240)
        AND (bestseller_rank_text IS NULL OR LENGTH(BTRIM(bestseller_rank_text)) BETWEEN 1 AND 240)
        AND (fulfillment_badge IS NULL OR LENGTH(BTRIM(fulfillment_badge)) BETWEEN 1 AND 120)
      );
  END IF;
END $$;

ALTER TABLE candidate_supplier_options
  ADD COLUMN IF NOT EXISTS model_variant VARCHAR(200),
  ADD COLUMN IF NOT EXISTS same_price_all_quantities BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS price_qty_1 NUMERIC(19, 4),
  ADD COLUMN IF NOT EXISTS price_qty_5 NUMERIC(19, 4),
  ADD COLUMN IF NOT EXISTS price_qty_10 NUMERIC(19, 4),
  ADD COLUMN IF NOT EXISTS price_qty_20 NUMERIC(19, 4),
  ADD COLUMN IF NOT EXISTS price_qty_50 NUMERIC(19, 4),
  ADD COLUMN IF NOT EXISTS price_qty_100 NUMERIC(19, 4),
  ADD COLUMN IF NOT EXISTS warranty_text VARCHAR(500),
  ADD COLUMN IF NOT EXISTS defective_unit_replacement BOOLEAN,
  ADD COLUMN IF NOT EXISTS invoice_available BOOLEAN,
  ADD COLUMN IF NOT EXISTS sample_available BOOLEAN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'candidate_supplier_options_workspace_fields_check') THEN
    ALTER TABLE candidate_supplier_options
      ADD CONSTRAINT candidate_supplier_options_workspace_fields_check CHECK (
        (model_variant IS NULL OR LENGTH(BTRIM(model_variant)) BETWEEN 1 AND 200)
        AND (warranty_text IS NULL OR LENGTH(BTRIM(warranty_text)) BETWEEN 1 AND 500)
        AND (price_qty_1 IS NULL OR price_qty_1 >= 0)
        AND (price_qty_5 IS NULL OR price_qty_5 >= 0)
        AND (price_qty_10 IS NULL OR price_qty_10 >= 0)
        AND (price_qty_20 IS NULL OR price_qty_20 >= 0)
        AND (price_qty_50 IS NULL OR price_qty_50 >= 0)
        AND (price_qty_100 IS NULL OR price_qty_100 >= 0)
      );
  END IF;
END $$;

ALTER TABLE product_samples
  ADD COLUMN IF NOT EXISTS workflow_state VARCHAR(20) NOT NULL DEFAULT 'not_requested';

UPDATE product_samples
SET workflow_state = CASE
  WHEN result = 'pass' THEN 'passed'
  WHEN result = 'fail' THEN 'failed'
  WHEN received_at IS NOT NULL THEN 'testing'
  WHEN ordered_at IS NOT NULL THEN 'purchased'
  ELSE 'not_requested'
END
WHERE workflow_state = 'not_requested';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_samples_workflow_state_check') THEN
    ALTER TABLE product_samples ADD CONSTRAINT product_samples_workflow_state_check
      CHECK (workflow_state IN ('not_requested', 'requested', 'purchased', 'testing', 'passed', 'failed'));
  END IF;
END $$;

ALTER TABLE candidate_unit_economics
  ADD COLUMN IF NOT EXISTS supplier_option_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'candidate_unit_economics_supplier_option_same_org_fk') THEN
    ALTER TABLE candidate_unit_economics
      ADD CONSTRAINT candidate_unit_economics_supplier_option_same_org_fk
      FOREIGN KEY (supplier_option_id, organization_id)
      REFERENCES candidate_supplier_options (id, organization_id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS research_snapshots_market_summary_idx
  ON product_candidate_market_snapshots (organization_id, candidate_id, selling_price)
  WHERE selling_price IS NOT NULL;

CREATE INDEX IF NOT EXISTS candidate_supplier_options_supplier_filter_idx
  ON candidate_supplier_options (organization_id, supplier_id, candidate_id);

