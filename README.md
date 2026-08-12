# Commerce OS

Commerce OS is a readable, production-oriented foundation for a long-term commerce management system. Task 1 provides secure identity, organizations, permissions, and locations. Task 2 adds an organization-isolated product catalog. Task 3 adds suppliers and purchasing. Task 4 adds an immutable inventory ledger and stock control. Task 5 adds the product research domain, economics, decisions, comparison, and explicit catalog conversion. Task 6 turns that domain into a focused sourcing workspace with Quick Capture and a guided Noon Egypt research workflow.

Sales, accounting, inventory valuation, landed-cost allocation, marketplace integrations, and physical serial-number instances remain intentionally deferred.

## Technology

- React 19 and Vite
- Node.js and Express 5
- PostgreSQL with plain, append-only SQL migrations
- Zod request validation
- Opaque, revocable authentication sessions stored as SHA-256 hashes
- Node test runner, Vitest, Testing Library, and ESLint

## Prerequisites

Install:

- Node.js 22 or newer
- npm 10 or newer
- PostgreSQL 15 or newer
- Git

Check the installed versions:

```sh
node --version
npm --version
psql --version
git --version
```

## Initial setup

1. Clone the repository and enter it.

   ```sh
   git clone <repository-url> commerce-os
   cd commerce-os
   ```

2. Install the locked dependencies.

   ```sh
   npm install
   ```

3. Create the local environment file.

   Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   macOS or Linux:

   ```sh
   cp .env.example .env
   ```

4. Replace `change_me` in `.env` with a local PostgreSQL password. Never commit `.env`.

## Database setup

Sign in to PostgreSQL as an administrator:

```sh
psql -U postgres
```

Create a development role and database. Use a unique local password, then put that same password in `DATABASE_URL` inside `.env`.

```sql
CREATE ROLE commerce_os WITH LOGIN PASSWORD 'replace_with_a_local_password';
CREATE DATABASE commerce_os OWNER commerce_os;
\q
```

Verify the connection and apply every pending migration:

```sh
npm run db:check
npm run db:migrate
```

The migration runner:

- applies `database/migrations/*.sql` in filename order;
- records filenames and SHA-256 checksums in `schema_migrations`;
- uses a PostgreSQL advisory lock so two runners cannot migrate concurrently;
- refuses to continue if an already-applied migration was edited.

Never modify a migration after it has been applied. Add a new numbered SQL file instead.

## Development

Run the React and Express development servers together:

```sh
npm run dev
```

Open:

- React application: http://localhost:5173
- API health: http://localhost:4000/api/health
- PostgreSQL health: http://localhost:4000/api/health/database

Run one side only when needed:

```sh
npm run dev:client
npm run dev:server
```

Vite proxies `/api` requests to the Express server during local development.

## Product catalog

The catalog follows this identity hierarchy:

```text
Brand → Product → Variant → SKU
```

A product describes the shared item, a variant describes a sellable version such as a color or layout, and a SKU is the organization-unique inventory identity. Quantity and prices do not belong on any of these identity records.

Task 2 adds these authenticated, organization-scoped endpoints:

- `GET|POST /api/brands` and `GET|PATCH /api/brands/:id`
- `GET|POST /api/categories` and `GET|PATCH /api/categories/:id`
- `GET|POST /api/products` and `GET|PATCH /api/products/:id`
- `GET|POST /api/skus` and `GET|PATCH /api/skus/:id`

List endpoints support server-side pagination and relevant search/filter query parameters. Every request requires the authenticated user's active organization in `x-organization-id`.

Run Task 2 migrations with the same append-only command:

```sh
npm run db:migrate
```

See [`docs/product-catalog.md`](docs/product-catalog.md) for the product model, SKU guidance, barcode and image decisions, full endpoint behavior, and examples.

## Suppliers and purchasing

Task 3 separates stable SKU identity from supplier-specific commercial offers:

```text
Supplier → Supplier Product ← SKU
Supplier → Purchase Order → PO Item → Goods Receipt Item
```

Supplier products hold current cost, currency, MOQ, lead time, and preference. Price changes preserve append-only effective history. PO items copy the agreed cost so later supplier-price changes cannot rewrite an order.

Purchase-order totals are calculated server-side with PostgreSQL `NUMERIC`. Controlled actions move a PO from draft to approved, ordered, partially received, and received. Goods receipts preserve accepted and rejected quantities. Task 4 adds a separate idempotent action that posts only accepted quantities.

Key authenticated endpoints include:

- `GET|POST /api/suppliers` and `GET|PATCH /api/suppliers/:id`
- `GET|POST /api/supplier-products`, `PATCH /api/supplier-products/:id`, and `POST /api/supplier-products/:id/price`
- `GET /api/skus/:id/suppliers`
- `GET|POST /api/purchase-orders` and `GET|PATCH /api/purchase-orders/:id`
- PO approval, ordered, cancellation, and receipt action endpoints
- `GET /api/goods-receipts` and `GET /api/goods-receipts/:id`
- `GET /api/purchasing-summary`

See [`docs/purchasing.md`](docs/purchasing.md) for the data model, financial rules, workflow, partial receiving, permissions, and full endpoint table.

## Inventory ledger and stock control

Task 4 keeps the movement ledger authoritative:

```text
Accepted Goods Receipt → PURCHASE_RECEIPT → transactional balance projection
Draft Transfer → TRANSFER_OUT at shipment → in transit → TRANSFER_IN at receipt
Physical correction or bucket change → audited adjustment movements
```

Stock is separated into `available`, `reserved`, `quarantine`, and `damaged` buckets. Available stock cannot become negative. Duplicate receipt and transfer requests are protected by database idempotency, and the projection can be reconciled against ledger sums at any time.

The React Inventory navigation provides Overview, Stock, Movements, Transfers, and Reorder Rules. Key API routes begin at `/api/inventory`; accepted receipts post through `POST /api/goods-receipts/:id/post-inventory`.

See [`docs/inventory.md`](docs/inventory.md) for sign conventions, movement types, buckets, locking, transfers, adjustments, idempotency, reconciliation, permissions, the full API, and deferred serial-instance design.

## Product research and launch decisions

Task 5 keeps product hypotheses outside the operational catalog until they pass a controlled research workflow:

```text
Candidate → market and supplier evidence → sample → unit economics → launch evaluation
Approved candidate → explicit reviewed transaction → draft Product + Variant + SKU
```

The Product Research navigation now opens a focused Task 6 workspace with fast search/filters, mobile Quick Capture, a seven-stage workflow indicator, and candidate tabs for Overview, Suppliers, Marketplace, Economics, Samples, and Decision. Supplier quantity tiers do not require repeated input when prices are identical; manual Noon observations remain distinct from the planned selling price. Monetary calculations still use Task 5 PostgreSQL `NUMERIC` logic. Conversion never creates stock, a supplier-product relationship, or a purchase order.

See [`docs/product-research.md`](docs/product-research.md) for formulas, status transitions, tables, permissions, API routes, comparison rules, capital allocation, and conversion behavior.

### Create the first owner

After migrations are applied, create the first user and organization through the registration endpoint:

```sh
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@example.com","password":"ReplaceThis123","displayName":"Owner","organizationName":"My Business"}'
```

The response sets an HTTP-only session cookie. The raw token is never stored in PostgreSQL; only its SHA-256 hash is retained. Other authentication endpoints are:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Organization-scoped authorization uses memberships, roles, and permissions. Protected organization operations should pass the organization ID in the `x-organization-id` header and use the shared authentication and authorization middleware.

## Testing and quality checks

Run all lint rules, automated tests, and the production client build:

```sh
npm run verify
```

Or run each stage separately:

```sh
npm run lint
npm run test
npm run build
```

Current tests cover reusable business terms, catalog and purchasing workflows, inventory ledger safety, and the research workflow: Quick Capture, supplier quantity pricing/comparison, multiple Noon observations, planned price separation, selected-supplier economics, sample states, decisions, permissions, organization isolation, and atomic non-duplicate catalog conversion.

## Project structure

```text
commerce-os/
├── client/                 React application
│   └── src/
│       ├── components/     Reusable UI and layout components
│       └── test/           Client test configuration
├── server/                 Express REST API
│   ├── src/
│   │   ├── config/         Environment and PostgreSQL configuration
│   │   ├── controllers/    HTTP request/response translation
│   │   ├── middleware/     Auth, authorization, validation, errors, limits
│   │   ├── models/         Parameterized SQL access
│   │   ├── routes/         REST route declarations
│   │   ├── services/       Use cases and transactions
│   │   ├── utils/          Shared technical helpers
│   │   └── validators/     Zod request contracts
│   └── tests/              API and server unit tests
├── database/
│   ├── migrations/         Append-only SQL schema history
│   └── scripts/            Migration and connectivity tools
├── tests/                  Future cross-layer workflow tests
├── docs/                   Architecture and technical decisions
├── .env.example            Safe configuration template
└── package.json            npm workspace commands
```

## Environment variables

| Variable | Purpose | Local example |
| --- | --- | --- |
| `NODE_ENV` | Runtime behavior | `development` |
| `PORT` | Express port | `4000` |
| `CLIENT_ORIGIN` | Allowed browser origin | `http://localhost:5173` |
| `DATABASE_URL` | PostgreSQL connection string | Placeholder in `.env.example` |
| `DATABASE_SSL` | Require validated TLS for PostgreSQL | `false` locally |
| `COOKIE_NAME` | Authentication cookie name | `commerce_os_session` |
| `SESSION_TTL_HOURS` | Session lifetime | `168` |
| `BCRYPT_ROUNDS` | Password hashing cost | `12` |

For production, use a secrets manager, set `NODE_ENV=production`, serve only through HTTPS, and provide a PostgreSQL connection with verified TLS. Do not put real credentials in source control.

## Engineering rules

- Keep business logic in services, not routes or React components.
- Use parameterized SQL and database constraints.
- Use PostgreSQL `NUMERIC`/`DECIMAL` for authoritative monetary values and calculate purchasing and research economics server-side.
- Preserve operational and financial history through statuses, archives, and reversal records.
- Model stock through an immutable inventory movement ledger when the inventory task begins.
- Add sales channels behind integration boundaries instead of embedding marketplace logic in core modules.
- Keep every applied migration unchanged and auditable.

See `docs/architecture.md` for the application boundaries and tenancy model, `docs/product-catalog.md` for Task 2 decisions, and `docs/purchasing.md` for Task 3 decisions.
