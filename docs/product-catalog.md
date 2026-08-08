# Product catalog foundation

Task 2 adds the catalog identities needed before inventory, purchasing, sales, or accounting can be built.

## Product model

```text
Brand
└── Product
    └── Variant
        └── SKU
            └── Barcode identifiers
```

- **Brand** identifies the manufacturer or commercial brand. It can be deactivated while referenced products remain intact.
- **Product** contains shared identity and specifications, such as model, description, default dimensions, and warranty.
- **Variant** contains a sellable version's variable attributes, such as color, keyboard layout, or switch type.
- **SKU** is the organization-unique identity for a sellable inventory unit.

A product is not a stock record. Products, variants, and SKUs contain no quantity, purchase cost, supplier price, or permanent selling price. A future inventory ledger will derive stock from movements.

## SKU guidance

A SKU code should be short, readable, stable, and unique within its organization. The UI may suggest:

```text
CATEGORY-BRAND-MODEL-VARIANT
MOU-LOG-G102-BLK
```

The suggestion is never saved silently. The user reviews and may replace it before creation.

The API trims and normalizes SKU codes to uppercase and accepts 3–64 characters containing letters, numbers, dots, underscores, slashes, and hyphens. The normal PATCH endpoint deliberately does not accept `skuCode`. Exceptional SKU renames should later use a controlled, audited migration.

Changing quantity, price, supplier, or location must never change a SKU code.

## Barcode identifiers

Barcodes use the dedicated `sku_barcodes` table rather than one column on `skus`. A SKU can therefore hold several typed identifiers:

- internal
- manufacturer
- EAN
- UPC
- GTIN

The table can gain identifier types without changing the SKU identity, supports one active primary identifier per SKU, and prevents duplicate type/value pairs inside an organization. EAN, UPC, and GTIN values receive type-specific digit and length validation.

## Organization isolation

Every catalog table carries `organization_id`. Composite foreign keys enforce same-organization relationships for:

- category → parent category
- product → brand
- product → category
- variant → product
- SKU → variant
- barcode → SKU
- image metadata → product

The API additionally requires authentication, an active membership, `catalog.read` or `catalog.manage`, and the `x-organization-id` header. A record in another organization is returned as not found rather than exposed.

## Categories

Categories form a parent-child hierarchy. PostgreSQL prevents self-parenting with a check constraint and prevents deeper cycles with the `prevent_category_cycle` trigger. Services perform an ancestor check first so API clients receive a readable `CATEGORY_CYCLE` error.

Sibling category names and root names are unique within their organization. Categories are deactivated instead of deleted.

## Transactional product creation

`POST /api/products` accepts the product, one or more variants, one or more SKUs per variant, and optional barcode identifiers. The service writes all records inside one PostgreSQL transaction. Any invalid reference or duplicate identifier rolls the entire structure back.

Variants use JSONB only for product-type-specific attributes. Critical relationships and dimensions remain typed relational columns.

## Product images

`product_images` stores only attachment metadata:

- storage key
- original filename and media type
- alt text
- display order
- primary/active flags

Image binary data is never stored in PostgreSQL. Uploads and cloud storage are deferred until the shared attachment/storage boundary is implemented.

## Search, filters, and pagination

All list filtering happens in PostgreSQL.

`GET /api/products` supports:

- `search` across product name, model, brand, and SKU
- `categoryId`
- `brandId`
- `status`
- `page` and `limit`

`GET /api/skus` supports search, product, active-status, and serial-tracking filters. Brand and category lists support search, active status, and pagination. Limits are capped at 100 records.

PostgreSQL trigram indexes support future catalog growth without moving full-catalog filtering into the browser.

## API endpoints

All endpoints require a valid session and `x-organization-id`.

| Method | Endpoint | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/api/brands` | `catalog.read` | Paginated brand list |
| POST | `/api/brands` | `catalog.manage` | Create a brand |
| GET | `/api/brands/:id` | `catalog.read` | Brand detail |
| PATCH | `/api/brands/:id` | `catalog.manage` | Edit/deactivate a brand |
| GET | `/api/categories` | `catalog.read` | Paginated hierarchy |
| POST | `/api/categories` | `catalog.manage` | Create a category |
| GET | `/api/categories/:id` | `catalog.read` | Category detail |
| PATCH | `/api/categories/:id` | `catalog.manage` | Edit/reparent/deactivate |
| GET | `/api/products` | `catalog.read` | Search/filter products |
| POST | `/api/products` | `catalog.manage` | Transactional product creation |
| GET | `/api/products/:id` | `catalog.read` | Product, variants, SKUs, identifiers |
| PATCH | `/api/products/:id` | `catalog.manage` | Edit/archive a product |
| GET | `/api/skus` | `catalog.read` | Search/filter SKUs |
| POST | `/api/skus` | `catalog.manage` | Add a SKU to a variant |
| GET | `/api/skus/:id` | `catalog.read` | SKU and identifiers |
| PATCH | `/api/skus/:id` | `catalog.manage` | Change metadata, identifiers, or active state |

A paginated response has the form:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 25,
    "total": 0,
    "totalPages": 0
  }
}
```

## Migrations and verification

Apply all pending migrations:

```sh
npm run db:check
npm run db:migrate
```

Run the same migration command again to confirm that both migrations report `Already applied`. Never edit migration 001 or 002 after application; create the next numbered migration.

Run all verification:

```sh
npm run lint
npm run test
npm run build
```
