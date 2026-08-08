# Task 1 architecture

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

Products, variants, SKUs, inventory, suppliers, purchasing, sales, returns, marketplace integrations, expenses, settlements, and accounting are deliberately deferred beyond Task 1. Their future business rules belong in services and their authoritative history in PostgreSQL.
