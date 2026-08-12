-- Task 6.1: research automation, managed image storage and purchasing continuity.

ALTER TABLE product_candidate_market_snapshots
  ADD COLUMN IF NOT EXISTS canonical_url VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS availability VARCHAR(120),
  ADD COLUMN IF NOT EXISTS key_specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS model_number VARCHAR(160),
  ADD COLUMN IF NOT EXISTS gtin VARCHAR(32),
  ADD COLUMN IF NOT EXISTS main_image_url VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extraction_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE candidate_supplier_options
  ADD COLUMN IF NOT EXISTS contact_person VARCHAR(200),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(80),
  ADD COLUMN IF NOT EXISTS supplier_linked_at TIMESTAMPTZ;

ALTER TABLE supplier_products
  ADD COLUMN IF NOT EXISTS warranty_text VARCHAR(500),
  ADD COLUMN IF NOT EXISTS defective_unit_replacement BOOLEAN,
  ADD COLUMN IF NOT EXISTS last_quote_date DATE,
  ADD COLUMN IF NOT EXISTS research_supplier_option_id UUID,
  ADD COLUMN IF NOT EXISTS sample_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_products_research_option_same_org_fk') THEN
    ALTER TABLE supplier_products ADD CONSTRAINT supplier_products_research_option_same_org_fk
      FOREIGN KEY (research_supplier_option_id, organization_id)
      REFERENCES candidate_supplier_options (id, organization_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_products_sample_same_org_fk') THEN
    ALTER TABLE supplier_products ADD CONSTRAINT supplier_products_sample_same_org_fk
      FOREIGN KEY (sample_id, organization_id)
      REFERENCES product_samples (id, organization_id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS local_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  relative_path VARCHAR(500) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(20) NOT NULL,
  byte_size BIGINT NOT NULL,
  source VARCHAR(20) NOT NULL,
  source_url VARCHAR(1000),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT local_images_org_fk FOREIGN KEY (organization_id)
    REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT local_images_creator_fk FOREIGN KEY (created_by)
    REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT local_images_path_unique UNIQUE (relative_path),
  CONSTRAINT local_images_fields_check CHECK (
    mime_type IN ('image/png', 'image/jpeg')
    AND source IN ('upload', 'noon_import')
    AND byte_size > 0
    AND relative_path !~ '(^|[\\/])\.\.([\\/]|$)'
  ),
  CONSTRAINT local_images_same_org_unique UNIQUE (id, organization_id)
);

CREATE TABLE IF NOT EXISTS local_image_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  image_id UUID NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id UUID NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT local_image_links_image_same_org_fk FOREIGN KEY (image_id, organization_id)
    REFERENCES local_images (id, organization_id) ON DELETE CASCADE,
  CONSTRAINT local_image_links_creator_fk FOREIGN KEY (created_by)
    REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT local_image_links_entity_check CHECK (
    entity_type IN ('candidate', 'supplier_option', 'sample', 'marketplace_observation')
  ),
  CONSTRAINT local_image_links_entity_unique UNIQUE (organization_id, image_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS local_image_links_entity_idx
  ON local_image_links (organization_id, entity_type, entity_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS local_image_links_one_primary_idx
  ON local_image_links (organization_id, entity_type, entity_id)
  WHERE is_primary = TRUE;
