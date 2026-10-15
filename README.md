# FileCloud

A Bun/Express + SQLite modular monolith, with a separate React/Vite frontend.

## Development

Use Bun 1.3.2 (the version pinned in CI). Install each application's locked dependencies:

```sh
(cd backend && bun install --frozen-lockfile)
(cd frontend && bun install --frozen-lockfile)
```

Run the backend and frontend in separate terminals:

```sh
cd backend && bun run dev
cd frontend && bun run dev
```

The backend defaults to port 3001; Vite defaults to port 5173. Configure deployment-specific paths and secrets locally; do not commit environment files or databases. See `backend/src/core/config/paths.ts` for supported storage/path configuration. SQLite and generated content default to the root `database/` directory.

## Checks

After installing both applications, run all strict checks with `cd backend && bun run check`. This includes frontend lint with zero warnings allowed. Individual checks, from the repository root:

```sh
(cd backend && bun run test)
(cd backend && bun run typecheck)
(cd backend && bun run test:boundaries && bun run check:boundaries)
(cd frontend && bun run test)
(cd frontend && bun run build)
(cd frontend && bun run lint)
```

The architecture check reads source imports without starting the server or opening a database. Its tests use temporary source fixtures. Backend security tests must use temporary databases/storage rather than a developer's configured data.

See [architecture and boundary policy](docs/architecture.md), [security and rollout notes](SECURITY.md), and [verification status](docs/verification.md). The existing package READMEs are framework scaffolding; use the commands above for this repository.

## Database upgrades

SQLite upgrades use pinned Drizzle migrations, verified pre-upgrade snapshots, and strict history checks. Read [the upgrade and recovery guide](docs/database-upgrades.md) before deployment.
