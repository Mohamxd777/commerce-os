# Database

Ordered SQL files in `migrations/` are the authoritative schema history. The migration runner records each filename and SHA-256 checksum in `schema_migrations`; an applied migration must never be edited. Add a new numbered migration for every schema change.

The initial migration creates only Task 1 foundations: users, organizations, memberships, roles, permissions, locations, and revocable sessions. Product, inventory, purchasing, sales, and accounting tables intentionally do not exist yet.
