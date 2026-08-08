-- Task 2: organization-isolated product catalog foundation.
-- Inventory quantities, costs, supplier data, and operational serial instances are deliberately absent.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

INSERT INTO permissions (code, description) VALUES
  ('catalog.read', 'View brands, categories, products, variants, SKUs, and identifiers'),
  ('catalog.manage', 'Create and maintain catalog records')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code IN ('catalog.read', 'catalog.manage')
WHERE roles.slug IN ('owner', 'administrator')
  AND roles.organization_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code = 'catalog.read'
WHERE roles.slug = 'member'
  AND roles.organization_id IS NULL
ON CONFLICT DO NOTHING;

CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name VARCHAR(160) NOT NULL,
  normalized_name VARCHAR(160)
    GENERATED ALWAYS AS (LOWER(REGEXP_REPLACE(BTRIM(name), '\s+', ' ', 'g'))) STORED,
  website_url VARCHAR(500),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  UNIQUE (organization_id, normalized_name),
  CHECK (LENGTH(BTRIM(name)) BETWEEN 1 AND 160)
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  parent_id UUID,
  name VARCHAR(160) NOT NULL,
  normalized_name VARCHAR(160)
    GENERATED ALWAYS AS (LOWER(REGEXP_REPLACE(BTRIM(name), '\s+', ' ', 'g'))) STORED,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT categories_parent_same_organization_fk
    FOREIGN KEY (parent_id, organization_id)
    REFERENCES categories (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT categories_not_self_parent
    CHECK (parent_id IS NULL OR parent_id <> id),
  CHECK (LENGTH(BTRIM(name)) BETWEEN 1 AND 160)
);

CREATE UNIQUE INDEX categories_root_name_unique
  ON categories (organization_id, normalized_name)
  WHERE parent_id IS NULL;

CREATE UNIQUE INDEX categories_child_name_unique
  ON categories (organization_id, parent_id, normalized_name)
  WHERE parent_id IS NOT NULL;

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  brand_id UUID,
  category_id UUID NOT NULL,
  name VARCHAR(200) NOT NULL,
  model_number VARCHAR(120),
  description TEXT,
  warranty_months INTEGER,
  default_weight_grams INTEGER,
  default_length_mm INTEGER,
  default_width_mm INTEGER,
  default_height_mm INTEGER,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('active', 'draft', 'archived')),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT products_brand_same_organization_fk
    FOREIGN KEY (brand_id, organization_id)
    REFERENCES brands (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT products_category_same_organization_fk
    FOREIGN KEY (category_id, organization_id)
    REFERENCES categories (id, organization_id)
    ON DELETE RESTRICT,
  CHECK (LENGTH(BTRIM(name)) BETWEEN 1 AND 200),
  CHECK (model_number IS NULL OR LENGTH(BTRIM(model_number)) BETWEEN 1 AND 120),
  CHECK (warranty_months IS NULL OR warranty_months BETWEEN 0 AND 600),
  CHECK (default_weight_grams IS NULL OR default_weight_grams > 0),
  CHECK (default_length_mm IS NULL OR default_length_mm > 0),
  CHECK (default_width_mm IS NULL OR default_width_mm > 0),
  CHECK (default_height_mm IS NULL OR default_height_mm > 0),
  CHECK (
    (status = 'archived' AND archived_at IS NOT NULL)
    OR (status <> 'archived' AND archived_at IS NULL)
  )
);

CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL,
  name VARCHAR(160) NOT NULL,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  weight_grams INTEGER,
  length_mm INTEGER,
  width_mm INTEGER,
  height_mm INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT product_variants_product_same_organization_fk
    FOREIGN KEY (product_id, organization_id)
    REFERENCES products (id, organization_id)
    ON DELETE RESTRICT,
  CHECK (LENGTH(BTRIM(name)) BETWEEN 1 AND 160),
  CHECK (JSONB_TYPEOF(attributes) = 'object'),
  CHECK (weight_grams IS NULL OR weight_grams > 0),
  CHECK (length_mm IS NULL OR length_mm > 0),
  CHECK (width_mm IS NULL OR width_mm > 0),
  CHECK (height_mm IS NULL OR height_mm > 0)
);

CREATE UNIQUE INDEX product_variants_name_unique
  ON product_variants (product_id, LOWER(name));

CREATE TABLE skus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  product_variant_id UUID NOT NULL,
  sku_code VARCHAR(64) NOT NULL,
  manufacturer_part_number VARCHAR(160),
  serial_tracking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CONSTRAINT skus_variant_same_organization_fk
    FOREIGN KEY (product_variant_id, organization_id)
    REFERENCES product_variants (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT skus_organization_code_unique UNIQUE (organization_id, sku_code),
  CHECK (sku_code = UPPER(sku_code)),
  CHECK (sku_code ~ '^[A-Z0-9][A-Z0-9._/-]{2,63}$'),
  CHECK (
    manufacturer_part_number IS NULL
    OR LENGTH(BTRIM(manufacturer_part_number)) BETWEEN 1 AND 160
  )
);

CREATE TABLE sku_barcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  sku_id UUID NOT NULL,
  identifier_type VARCHAR(30) NOT NULL
    CHECK (identifier_type IN ('internal', 'manufacturer', 'ean', 'upc', 'gtin')),
  value VARCHAR(64) NOT NULL,
  normalized_value VARCHAR(64)
    GENERATED ALWAYS AS (UPPER(BTRIM(value))) STORED,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sku_barcodes_sku_same_organization_fk
    FOREIGN KEY (sku_id, organization_id)
    REFERENCES skus (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT sku_barcodes_organization_identifier_unique
    UNIQUE (organization_id, identifier_type, normalized_value),
  CHECK (LENGTH(BTRIM(value)) BETWEEN 3 AND 64)
);

CREATE UNIQUE INDEX sku_barcodes_one_primary
  ON sku_barcodes (sku_id)
  WHERE is_primary = TRUE AND is_active = TRUE;

CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  original_filename VARCHAR(255),
  media_type VARCHAR(120),
  alt_text VARCHAR(240),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_images_product_same_organization_fk
    FOREIGN KEY (product_id, organization_id)
    REFERENCES products (id, organization_id)
    ON DELETE RESTRICT,
  CHECK (LENGTH(BTRIM(storage_key)) BETWEEN 1 AND 500),
  CHECK (sort_order >= 0)
);

CREATE UNIQUE INDEX product_images_one_primary
  ON product_images (product_id)
  WHERE is_primary = TRUE AND is_active = TRUE;

CREATE OR REPLACE FUNCTION prevent_category_cycle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'CATEGORY_CYCLE: a category cannot be its own parent'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT category.id, category.parent_id
      FROM categories AS category
      WHERE category.id = NEW.parent_id
        AND category.organization_id = NEW.organization_id

      UNION ALL

      SELECT parent.id, parent.parent_id
      FROM categories AS parent
      JOIN ancestors ON ancestors.parent_id = parent.id
      WHERE parent.organization_id = NEW.organization_id
    )
    SELECT 1
    FROM ancestors
    WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'CATEGORY_CYCLE: parent assignment would create a cycle'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER categories_prevent_cycle
  BEFORE INSERT OR UPDATE OF parent_id ON categories
  FOR EACH ROW EXECUTE FUNCTION prevent_category_cycle();

CREATE TRIGGER brands_set_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER product_variants_set_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER skus_set_updated_at
  BEFORE UPDATE ON skus
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER sku_barcodes_set_updated_at
  BEFORE UPDATE ON sku_barcodes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER product_images_set_updated_at
  BEFORE UPDATE ON product_images
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX brands_organization_active_idx
  ON brands (organization_id, is_active, name);

CREATE INDEX brands_name_search_idx
  ON brands USING GIN (normalized_name gin_trgm_ops);

CREATE INDEX categories_organization_active_idx
  ON categories (organization_id, is_active, parent_id);

CREATE INDEX categories_name_search_idx
  ON categories USING GIN (normalized_name gin_trgm_ops);

CREATE INDEX products_organization_filters_idx
  ON products (organization_id, status, category_id, brand_id);

CREATE INDEX products_name_search_idx
  ON products USING GIN (name gin_trgm_ops);

CREATE INDEX products_model_search_idx
  ON products USING GIN (model_number gin_trgm_ops);

CREATE INDEX product_variants_product_idx
  ON product_variants (product_id, is_active);

CREATE INDEX skus_organization_active_idx
  ON skus (organization_id, is_active, product_variant_id);

CREATE INDEX skus_code_search_idx
  ON skus USING GIN (sku_code gin_trgm_ops);

CREATE INDEX sku_barcodes_sku_idx
  ON sku_barcodes (sku_id, is_active);

CREATE INDEX product_images_product_idx
  ON product_images (product_id, sort_order)
  WHERE is_active = TRUE;
