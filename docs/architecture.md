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

## Deferred domains

Task 2 extends the same boundaries with brands, categories, products, variants, SKUs, barcode identifiers, and product image metadata. Catalog writes remain in services and PostgreSQL transactions; controllers only translate HTTP concerns.

Inventory movements, physical serial instances, suppliers, purchasing, sales, returns, marketplace integrations, expenses, settlements, and accounting remain deferred. Their future business rules belong in services and their authoritative history in PostgreSQL.
