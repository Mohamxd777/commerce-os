# Commerce OS architecture

Commerce OS is a JavaScript monorepo with a React client, an Express REST API, and PostgreSQL migrations.

## Boundaries

- Routes declare HTTP paths and middleware.
- Controllers translate HTTP requests and responses.
- Services coordinate use cases and transactions.
- Models contain parameterized SQL access.
- Validators define request contracts with Zod.
- Middleware handles authentication, authorization, validation, errors, rate limits, and security headers.
- Database migrations are append-only history.

## Identity and tenancy

A user may belong to multiple organizations through memberships. A membership may hold multiple roles, and roles may contain multiple permissions. Locations belong to an organization and are not limited to one warehouse. Authentication uses an opaque random cookie; only its SHA-256 hash is stored in PostgreSQL so sessions can be expired or revoked.

## Catalog and purchasing domains

Task 2 extends the same boundaries with brands, categories, products, variants, SKUs, barcode identifiers, and product image metadata. Task 3 adds suppliers, supplier-specific offers and price history, purchase orders, historical PO line costs, and goods receipts. Catalog and purchasing transactions live in services; controllers only translate HTTP concerns and models only perform parameterized database access.

Financial authority stays in PostgreSQL `NUMERIC` calculations. Purchase-order workflow changes use explicit service actions. Receiving locks the PO and its lines before accepted quantities are checked and persisted.

## Deferred domains

Goods receipts are safe future inventory sources but do not directly change stock. Inventory ledger movements, physical serial instances, landed-cost allocation, sales, returns, marketplace integrations, expenses, settlements, and accounting remain deferred. Their future business rules belong in services and their authoritative history in PostgreSQL.
