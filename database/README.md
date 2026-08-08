# Database

Ordered SQL files in `migrations/` are the authoritative schema history. The migration runner records each filename and SHA-256 checksum in `schema_migrations`; an applied migration must never be edited. Add a new numbered migration for every schema change.

Migration `001_foundation.sql` creates users, organizations, memberships, roles, permissions, locations, and revocable sessions.

Migration `002_product_catalog.sql` adds brands, hierarchical categories, products, product variants, SKUs, typed barcode identifiers, product image metadata, catalog permissions, search indexes, archive states, and category-cycle protection. It deliberately adds no quantity, price, supplier, purchasing, sales, inventory movement, or accounting tables.

Migration `003_suppliers_purchasing.sql` adds suppliers, supplier-to-SKU relationships, supplier price history, purchase orders and historical line costs, goods receipts with partial/rejected quantities, purchasing permissions, location composite ownership, server-search indexes, and workflow constraints. Goods receipts do not create inventory ledger movements; Task 4 will reference accepted receipt items as posting sources.
