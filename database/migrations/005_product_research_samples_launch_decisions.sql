-- Task 5: organization-isolated product research, samples, and launch decisions.
-- Research records remain separate from the operational catalog until an explicit conversion.

INSERT INTO permissions (code, description) VALUES
  ('research.read', 'View product candidates, research evidence, samples, and launch decisions'),
  ('research.manage', 'Create and maintain product research records and settings'),
  ('research.evaluate', 'Calculate unit economics, record launch decisions, and convert approved candidates')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code IN ('research.read', 'research.manage', 'research.evaluate')
WHERE roles.slug IN ('owner', 'administrator')
  AND roles.organization_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code = 'research.read'
WHERE roles.slug = 'member'
  AND roles.organization_id IS NULL
ON CONFLICT DO NOTHING;

CREATE TABLE product_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  category_id UUID,
  name VARCHAR(200) NOT NULL,
  brand_name VARCHAR(160),
  marketplace_url VARCHAR(1000),
  status VARCHAR(30) NOT NULL DEFAULT 'research'
    CHECK (status IN ('research', 'shortlisted', 'sourcing', 'sampling', 'approved', 'rejected', 'launched')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  catalog_product_id UUID,
  converted_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT product_candidates_category_same_organization_fk
    FOREIGN KEY (category_id, organization_id)
    REFERENCES categories (id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT product_candidates_product_same_organization_fk
    FOREIGN KEY (catalog_product_id, organization_id)
    REFERENCES products (id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT product_candidates_one_conversion UNIQUE (organization_id, catalog_product_id),
  CHECK (LENGTH(BTRIM(name)) BETWEEN 1 AND 200),
  CHECK (brand_name IS NULL OR LENGTH(BTRIM(brand_name)) BETWEEN 1 AND 160),
  CHECK (
    (catalog_product_id IS NULL AND converted_by IS NULL AND converted_at IS NULL AND status <> 'launched')
    OR (catalog_product_id IS NOT NULL AND converted_by IS NOT NULL AND converted_at IS NOT NULL AND status = 'launched')
  )
);

CREATE TABLE product_candidate_market_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  candidate_id UUID NOT NULL,
  marketplace VARCHAR(100) NOT NULL,
  listing_url VARCHAR(1000) NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  selling_price NUMERIC(19, 4),
  currency VARCHAR(3),
  rating NUMERIC(3, 2),
  review_count INTEGER,
  demand_score SMALLINT,
  competition_score SMALLINT,
  evidence_notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT research_snapshots_candidate_same_organization_fk
    FOREIGN KEY (candidate_id, organization_id)
    REFERENCES product_candidates (id, organization_id) ON DELETE RESTRICT,
  CHECK (LENGTH(BTRIM(marketplace)) BETWEEN 1 AND 100),
  CHECK (selling_price IS NULL OR selling_price >= 0),
  CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  CHECK (rating IS NULL OR rating BETWEEN 0 AND 5),
  CHECK (review_count IS NULL OR review_count >= 0),
  CHECK (demand_score IS NULL OR demand_score BETWEEN 1 AND 5),
  CHECK (competition_score IS NULL OR competition_score BETWEEN 1 AND 5)
);

CREATE TABLE candidate_supplier_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  candidate_id UUID NOT NULL,
  supplier_id UUID,
  lead_name VARCHAR(200),
  contact_url VARCHAR(1000),
  quoted_unit_cost NUMERIC(19, 4) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  moq NUMERIC(19, 4) NOT NULL DEFAULT 1,
  lead_time_days INTEGER NOT NULL DEFAULT 0,
  quote_date DATE,
  quote_valid_until DATE,
  preferred BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT candidate_supplier_options_candidate_same_organization_fk
    FOREIGN KEY (candidate_id, organization_id)
    REFERENCES product_candidates (id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT candidate_supplier_options_supplier_same_organization_fk
    FOREIGN KEY (supplier_id, organization_id)
    REFERENCES suppliers (id, organization_id) ON DELETE RESTRICT,
  CHECK (supplier_id IS NOT NULL OR LENGTH(BTRIM(lead_name)) BETWEEN 1 AND 200),
  CHECK (quoted_unit_cost >= 0),
  CHECK (currency ~ '^[A-Z]{3}$'),
  CHECK (moq > 0),
  CHECK (lead_time_days >= 0),
  CHECK (quote_valid_until IS NULL OR quote_date IS NULL OR quote_valid_until >= quote_date)
);

CREATE UNIQUE INDEX candidate_supplier_options_one_preferred
  ON candidate_supplier_options (organization_id, candidate_id)
  WHERE preferred = TRUE;

CREATE TABLE product_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  candidate_id UUID NOT NULL,
  supplier_option_id UUID,
  reference_code VARCHAR(100),
  ordered_at DATE,
  received_at DATE,
  sample_cost NUMERIC(19, 4),
  currency VARCHAR(3),
  result VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (result IN ('pending', 'pass', 'fail', 'retest')),
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  evaluated_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  evaluated_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT product_samples_candidate_same_organization_fk
    FOREIGN KEY (candidate_id, organization_id)
    REFERENCES product_candidates (id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT product_samples_supplier_option_same_organization_fk
    FOREIGN KEY (supplier_option_id, organization_id)
    REFERENCES candidate_supplier_options (id, organization_id) ON DELETE RESTRICT,
  CHECK (received_at IS NULL OR ordered_at IS NULL OR received_at >= ordered_at),
  CHECK (sample_cost IS NULL OR sample_cost >= 0),
  CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  CHECK (JSONB_TYPEOF(checklist) = 'array'),
  CHECK (
    (result = 'pending' AND evaluated_by IS NULL AND evaluated_at IS NULL)
    OR (result <> 'pending' AND evaluated_by IS NOT NULL AND evaluated_at IS NOT NULL)
  )
);

CREATE TABLE candidate_fee_assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  candidate_id UUID NOT NULL,
  fee_name VARCHAR(160) NOT NULL,
  fee_type VARCHAR(20) NOT NULL CHECK (fee_type IN ('percentage', 'fixed')),
  fee_value NUMERIC(19, 4) NOT NULL,
  currency VARCHAR(3),
  effective_from DATE NOT NULL,
  effective_to DATE,
  source_url VARCHAR(1000),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT candidate_fee_assumptions_candidate_same_organization_fk
    FOREIGN KEY (candidate_id, organization_id)
    REFERENCES product_candidates (id, organization_id) ON DELETE RESTRICT,
  CHECK (LENGTH(BTRIM(fee_name)) BETWEEN 1 AND 160),
  CHECK (fee_value >= 0),
  CHECK (fee_type <> 'percentage' OR fee_value <= 100),
  CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE candidate_unit_economics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  candidate_id UUID NOT NULL,
  currency VARCHAR(3) NOT NULL,
  selling_price NUMERIC(19, 4) NOT NULL,
  supplier_unit_cost NUMERIC(19, 4) NOT NULL,
  local_transport_cost NUMERIC(19, 4) NOT NULL DEFAULT 0,
  packaging_cost NUMERIC(19, 4) NOT NULL DEFAULT 0,
  referral_fee_percentage NUMERIC(9, 4) NOT NULL DEFAULT 0,
  referral_fee_fixed NUMERIC(19, 4) NOT NULL DEFAULT 0,
  fulfillment_fee NUMERIC(19, 4) NOT NULL DEFAULT 0,
  shipping_reimbursement NUMERIC(19, 4) NOT NULL DEFAULT 0,
  advertising_cost NUMERIC(19, 4) NOT NULL DEFAULT 0,
  estimated_return_reserve NUMERIC(19, 4) NOT NULL DEFAULT 0,
  other_variable_costs NUMERIC(19, 4) NOT NULL DEFAULT 0,
  target_margin_percentage NUMERIC(9, 4),
  target_roi_percentage NUMERIC(9, 4),
  total_variable_cost NUMERIC(19, 4) NOT NULL,
  gross_profit NUMERIC(19, 4) NOT NULL,
  net_contribution NUMERIC(19, 4) NOT NULL,
  net_margin_percentage NUMERIC(19, 4),
  roi_percentage NUMERIC(19, 4),
  break_even_price NUMERIC(19, 4) NOT NULL,
  max_purchase_price_for_target_margin NUMERIC(19, 4),
  max_purchase_price_for_target_roi NUMERIC(19, 4),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT candidate_unit_economics_candidate_same_organization_fk
    FOREIGN KEY (candidate_id, organization_id)
    REFERENCES product_candidates (id, organization_id) ON DELETE RESTRICT,
  CHECK (currency ~ '^[A-Z]{3}$'),
  CHECK (selling_price > 0),
  CHECK (supplier_unit_cost >= 0),
  CHECK (local_transport_cost >= 0 AND packaging_cost >= 0),
  CHECK (referral_fee_percentage BETWEEN 0 AND 99.9999),
  CHECK (referral_fee_fixed >= 0 AND fulfillment_fee >= 0),
  CHECK (shipping_reimbursement >= 0 AND advertising_cost >= 0),
  CHECK (estimated_return_reserve >= 0 AND other_variable_costs >= 0),
  CHECK (target_margin_percentage IS NULL OR target_margin_percentage BETWEEN 0 AND 100),
  CHECK (target_roi_percentage IS NULL OR target_roi_percentage >= 0)
);

CREATE TABLE candidate_launch_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  candidate_id UUID NOT NULL,
  unit_economics_id UUID,
  recommendation VARCHAR(30) NOT NULL
    CHECK (recommendation IN ('buy', 'maybe', 'reject', 'needs_more_research')),
  risk_level VARCHAR(10) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  target_selling_price NUMERIC(19, 4) NOT NULL,
  target_unit_cost NUMERIC(19, 4) NOT NULL,
  target_margin_percentage NUMERIC(9, 4) NOT NULL,
  target_roi_percentage NUMERIC(9, 4) NOT NULL,
  launch_quantity NUMERIC(19, 4) NOT NULL,
  planned_capital NUMERIC(19, 4) NOT NULL,
  projected_profit NUMERIC(19, 4) NOT NULL,
  rationale TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT candidate_launch_evaluations_candidate_same_organization_fk
    FOREIGN KEY (candidate_id, organization_id)
    REFERENCES product_candidates (id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT candidate_launch_evaluations_economics_same_organization_fk
    FOREIGN KEY (unit_economics_id, organization_id)
    REFERENCES candidate_unit_economics (id, organization_id) ON DELETE RESTRICT,
  CHECK (target_selling_price > 0 AND target_unit_cost >= 0),
  CHECK (target_margin_percentage BETWEEN -1000 AND 100),
  CHECK (target_roi_percentage >= -1000),
  CHECK (launch_quantity > 0 AND planned_capital >= 0),
  CHECK (LENGTH(BTRIM(rationale)) BETWEEN 3 AND 10000)
);

CREATE TABLE research_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  minimum_margin_percentage NUMERIC(9, 4) NOT NULL DEFAULT 20,
  minimum_roi_percentage NUMERIC(9, 4) NOT NULL DEFAULT 25,
  maximum_capital_allocation NUMERIC(19, 4) NOT NULL DEFAULT 100000,
  maximum_defect_risk VARCHAR(10) NOT NULL DEFAULT 'medium'
    CHECK (maximum_defect_risk IN ('low', 'medium', 'high')),
  minimum_demand_score SMALLINT NOT NULL DEFAULT 3,
  launch_budget NUMERIC(19, 4) NOT NULL DEFAULT 100000,
  currency VARCHAR(3) NOT NULL DEFAULT 'EGP',
  updated_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id),
  CHECK (minimum_margin_percentage BETWEEN 0 AND 100),
  CHECK (minimum_roi_percentage >= 0),
  CHECK (maximum_capital_allocation >= 0 AND launch_budget >= 0),
  CHECK (minimum_demand_score BETWEEN 1 AND 5),
  CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE TABLE product_candidate_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  candidate_id UUID NOT NULL,
  evidence_type VARCHAR(30) NOT NULL CHECK (evidence_type IN ('url', 'file', 'screenshot')),
  title VARCHAR(240) NOT NULL,
  source_url VARCHAR(1000),
  storage_key VARCHAR(500),
  original_filename VARCHAR(255),
  media_type VARCHAR(120),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT product_candidate_evidence_candidate_same_organization_fk
    FOREIGN KEY (candidate_id, organization_id)
    REFERENCES product_candidates (id, organization_id) ON DELETE RESTRICT,
  CHECK (LENGTH(BTRIM(title)) BETWEEN 1 AND 240),
  CHECK (source_url IS NOT NULL OR storage_key IS NOT NULL)
);

CREATE TRIGGER product_candidates_set_updated_at BEFORE UPDATE ON product_candidates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER candidate_supplier_options_set_updated_at BEFORE UPDATE ON candidate_supplier_options
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER product_samples_set_updated_at BEFORE UPDATE ON product_samples
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER research_settings_set_updated_at BEFORE UPDATE ON research_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX product_candidates_filters_idx
  ON product_candidates (organization_id, status, category_id, created_at DESC);
CREATE INDEX product_candidates_name_search_idx
  ON product_candidates USING GIN (name gin_trgm_ops);
CREATE INDEX product_candidates_brand_search_idx
  ON product_candidates USING GIN (brand_name gin_trgm_ops);
CREATE INDEX research_snapshots_candidate_idx
  ON product_candidate_market_snapshots (organization_id, candidate_id, observed_at DESC);
CREATE INDEX candidate_supplier_options_candidate_idx
  ON candidate_supplier_options (organization_id, candidate_id, quoted_unit_cost);
CREATE INDEX product_samples_candidate_idx
  ON product_samples (organization_id, candidate_id, result, created_at DESC);
CREATE INDEX candidate_fee_assumptions_history_idx
  ON candidate_fee_assumptions (organization_id, candidate_id, effective_from DESC);
CREATE INDEX candidate_unit_economics_history_idx
  ON candidate_unit_economics (organization_id, candidate_id, created_at DESC);
CREATE INDEX candidate_launch_evaluations_history_idx
  ON candidate_launch_evaluations (organization_id, candidate_id, created_at DESC);
CREATE INDEX candidate_launch_evaluations_capital_idx
  ON candidate_launch_evaluations (organization_id, recommendation, created_at DESC);
CREATE INDEX product_candidate_evidence_candidate_idx
  ON product_candidate_evidence (organization_id, candidate_id, created_at DESC);
