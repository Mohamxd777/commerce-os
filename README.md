# Commerce OS

Commerce OS is a readable, production-oriented foundation for a long-term commerce management system. Task 1 provides a React interface, an Express REST API, PostgreSQL migrations, secure session authentication, organizations, users, roles, permissions, and locations.

Products, inventory, purchasing, sales, accounting, and marketplace integrations are intentionally outside this task.

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

Current tests cover the reusable BusinessTerm tooltip, API health, shared validation and error responses, and password hashing/verification. Cross-layer tests that require a real database belong in `tests/` as domain workflows are introduced.

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
- Use PostgreSQL `NUMERIC`/`DECIMAL` for authoritative monetary values in future modules.
- Preserve operational and financial history through statuses, archives, and reversal records.
- Model stock through an immutable inventory movement ledger when the inventory task begins.
- Add sales channels behind integration boundaries instead of embedding marketplace logic in core modules.
- Keep every applied migration unchanged and auditable.

See `docs/architecture.md` for the Task 1 boundaries and tenancy model.
