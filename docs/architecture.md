# Architecture and dependency boundaries

## Keep the modular monolith

FileCloud remains one backend process, one SQLite database and a separately built browser application. This change does not add microservices, a message broker or a repository-wide rewrite.

- `backend/src/server.ts` is the composition root: database initialization, module registration, task-service injection, task execution, HTTP and remote-proxy startup.
- `backend/src/app.ts` creates the Express application. `backend/src/modules/index.ts` selects and orders the active business modules.
- `backend/src/core/` provides infrastructure and shared policies: database/schema setup, authentication, middleware, configuration, logging, the module loader and task executor. Existing shared entry/library middleware still performs database queries; it is not a pure domain layer.
- `backend/src/modules/<name>/` owns business behavior. A module definition binds its routes, lifecycle hooks and task handlers. Routes translate HTTP requests, enforce access and call service logic. Services and task handlers perform the operation.
- `frontend/src/lib/api/` owns browser HTTP clients and local API types; hooks, pages and components consume them. Frontend and backend communicate over APIs, not source imports.

Main areas are authentication/settings/system; libraries/files/entries/tags; file content/media; AI orchestration; tasks/activity logs; backgrounds; and remote proxying. `modules/coreServices/` is a business-support module despite its name, not part of `core/`. Its watcher is registered in the module lifecycle and probes enabled library roots asynchronously without enumerating their contents.

## Enforced rules

Run `cd backend && bun run check:boundaries`. `scripts/check-boundaries.mjs` uses the installed TypeScript parser and resolver, including each application's path aliases.

1. Frontend and backend production source must not import each other's files.
2. Core must not import business modules or the application/composition entry points.
3. Business modules must not import `app.ts`, `server.ts` or the central module registry.
4. All imports between different business modules must use the destination's top-level `index.ts`. A nested `private/index.ts`, `service.ts`, `router.ts` or `module.ts` is not a public API.
5. `scripts/boundary-baseline.json` is empty. Production regression tests require zero deep-import exceptions, so adding an exception is not a way to bypass the public API rule.

The two composition roots may wire modules directly. Within a business module, internal imports are allowed. Shared core APIs remain usable by business modules. Avoid putting business logic into core simply to bypass the rules.

The checker covers `.ts`, `.tsx`, JavaScript and their module variants under both `src` directories. It checks static imports, re-exports, type imports, import-equals, literal `require()` and dynamic `import()` expressions. Computed `require`/`import` arguments and unresolved local imports fail rather than disappearing from the graph. Comments and string contents are not interpreted as imports. Test files (`*.test.*`, `*.spec.*`, `tests/`, `__tests__/`) are excluded so tests can exercise private code.

This is an import-boundary check, not a security sandbox or an API compatibility proof. It does not check SQL table ownership, HTTP calls, runtime reflection, frontend feature layering or new symbols imported along an already recorded edge. Typechecking and security regression tests are independent checks.

## Public APIs and resolved deep imports

All 22 remaining grandfathered deep-import edges have been migrated, after the earlier files-router extraction removed the first of the original 23. AI uses the settings read capability, file reads/search/security and task submission; library services use task submission and stable file task identifiers; media uses file reads/security; file tasks use media maintenance.

- `settings/index.ts` exposes only `getSetting`.
- `tasks/index.ts` exposes only `createTask`.
- `files/index.ts` exposes selected entry reads, full-text search, existing security checks and the eight stable file task identifiers.
- `files/taskTypes.ts` contains only identifiers, with no imports. The handler modules re-export their former constants for internal compatibility, but the public API never imports those handler modules.
- `fileContent/index.ts` exposes only thumbnail generation and entry/library transcode cleanup. It does not export HTTP routes or module startup.

Files and media still call each other's capabilities, but their actual source import paths are acyclic: file task handlers → media public API → file public reads. The file public API does not load file task handlers or media implementations. Simply re-exporting constants from `indexTasks.ts` or `fileOpsTasks.ts` would reintroduce the runtime cycle, so the identifiers have been separated from implementation instead.

The boundary regression suite reads the production import graph without running application code or opening the database. It requires an empty baseline, checks the task contract's unchanged persisted identifiers, follows public APIs transitively to reject cycles, and ensures the migrated APIs do not load routes or module startup. These graph checks conservatively include type and dynamic imports too.

For a new cross-module need, expose a small capability or data contract through the owning module's top-level `index.ts`. Export specific symbols rather than every internal file. Public APIs must not start watchers, register routes or execute tasks on import. Prefer composition-root injection if a capability would otherwise introduce a source cycle. Existing shared database connections and table access are separate concerns; this migration does not establish table ownership or make public capabilities authorization-free.

There is deliberately no automatic baseline-update or ignore flag. The checker still validates historical fixture baselines for malformed, wildcard, duplicate and stale entries, but production must pass with no exceptions. Do not add violations merely to turn CI green.

## Security responsibilities

- Authenticate at the request boundary, then check the acting user's access to the actual library/entry. A valid token alone is not object authorization.
- Recheck ownership and authorization for operations performed later by task handlers or via AI/remote-proxy paths. Do not trust caller-supplied paths or user IDs merely because the request was authenticated.
- Keep filesystem operations constrained to configured roots, including canonical path and symlink handling. Share the same core path policy rather than reimplementing lexical prefix checks in each router.
- Keep secrets out of URLs and routine logs. A module boundary check cannot substitute for these runtime safeguards.

These are design requirements for ongoing work, not a claim that every legacy route has been security-audited. See the security tests and the verification report for the behavior actually checked in this change.

## Small file-command boundary

File mutations now have two ordinary function modules rather than a new framework:

- `files/router.ts` keeps authentication middleware, HTTP parsing/status codes and read/download handlers. Its mutation handlers call the application functions and translate errors once. It does not write SQL/files or create tasks directly.
- `files/application.ts` owns folder creation and submission of rename/move/copy/delete/restore/destroy/index commands. These functions accept an actor and plain values, validate inputs and recheck current authorization. `createFolder` compensates an unsuccessful SQLite insert by removing only the empty directory it just created.
- `files/uploadService.ts` owns multipart receipt, safe destination selection, exclusive filename reservation and completion of writes before index submission. Failed requests clean up their own created files and do not schedule indexing. Streaming input is a Node readable, not an Express request contract.
- `tasks/index.ts` exposes only `createTask`. These new application callers use that public capability; the old files-router → task-service baseline exception has been removed.
- `files/fileOps.ts` and existing task handlers continue to own actual asynchronous file operations and execution-time checks. Task payloads, SQLite and the in-process executor remain in place.

The route guard is part of `check:boundaries`, not a separate optional command. For the migrated files router it rejects database/task imports and filesystem capabilities other than the download reads. This is a targeted architectural regression check, not a filesystem sandbox or proof that arbitrary code has no side effects. It checks API capabilities, not custom stream options or all possible runtime arguments. Password updates already call the existing security service; remaining query/download handlers are deliberately not reorganized in this batch.

Keep dependencies flowing HTTP → file application/upload functions → existing policies, services and task submission. Do not import routers from these functions or put request/response objects into them. Add another ordinary function here when a new file command needs shared orchestration; do not introduce a generic command bus, DI container, repository framework or extra process for this personal-project scale.

## Frontend state and loading

Routes use React.lazy and a Suspense fallback so optional pages and heavy markdown/media code load on demand. This uses existing React/router facilities, not a new framework or a larger Vite warning threshold.

The file browser derives the active library and folder from the URL. Its local `fileBrowser/useBrowserLocation` helper owns cache restoration and persistence; a failed library fetch does not invalidate a deep link. File-list hooks share a small async loading helper with request-generation and mounted checks, so an older response or a completed operation from an old folder cannot overwrite a newer navigation. Dialog state and typed rendering remain local to their existing components.

## Startup, migration and shutdown

SQLite bootstrap uses the official Drizzle Bun SQLite migrator, pinned to 0.45.4, with versioned SQL files and existing raw-SQL business queries. A small startup wrapper validates the complete history/checksums and recognized legacy schema, serializes migrators using a crash-released SQLite lock, and verifies a WAL-aware pre-upgrade snapshot before pending changes. Drizzle commits pending SQL and history together or rolls them back. Unknown/future histories and backup failures stop startup. See [database-upgrades.md](database-upgrades.md) for release and restore procedures; no production database is migrated during development checks.

Library polling is sequential and schedules the next probe only after the current pass completes. It retains root/symlink policy checks, rechecks library membership after asynchronous I/O and evicts disabled/deleted cache entries. Stop invalidates in-flight writes and drains the current pass. Task-executor shutdown stops admitting new tasks, removes polling/listener hooks and waits for active tasks; SIGINT/SIGTERM close HTTP and remote-proxy admission and run module cleanup. Proxy shutdown drains admitted requests, suppresses reconnects and closes WebSocket peers. A 30-second process deadline bounds stuck storage/tasks.

## Asynchronous filesystem work

Request handlers, authorization/root checks, directory scans, watcher probes, uploads,
background-image storage, AI conversation files, thumbnail generation and transcode
maintenance use asynchronous filesystem APIs. Disk-touching public services return
promises; routes, AI tools and task handlers await them before responding or marking
work complete. Path configuration getters only compute paths. Storage operations
create their own directories asynchronously when needed.

Only `core/db/connection.ts` and `core/db/migrations.ts` intentionally retain
synchronous filesystem work. Their directory creation, migration-file loading,
backup permissions and fsync happen during SQLite bootstrap before serving HTTP or
starting background workers. SQLite itself remains the synchronous Bun driver; this
filesystem migration does not replace the database driver or guarantee that all CPU
or database work is nonblocking.

Async directory scans remain sequential, bounding storage pressure. A small
process-local per-library queue protects file mutations, folder creation, uploads
through stream closure/rollback, and indexing. It preserves state-transition ordering
when filesystem awaits yield. Separate libraries remain independent. Registrations
are serialized around canonical-root ownership validation and insertion, preventing
two concurrent users from registering overlapping roots.

Uploads atomically reserve filenames with asynchronous exclusive open. They track
pending opens and every stream through close, react to disconnects during path checks
and reservation, remove only their own created paths on failure, and queue indexing
only after successful completion. Nested upload tasks retain the legacy relativePath
and additionally carry parentEntryId; execution resolves that indexed directory's
current path under the same library guard. Deleted or reassigned parents fail closed;
older path-only tasks remain supported.

Rename/move/restore transfers never overwrite a destination appearing after the
existence check. Files use an exclusive hard link followed by source removal on
supported same-filesystem storage; cross-device or unsupported-link storage falls
back to COPYFILE_EXCL. Directory transfers reserve a fresh destination and copy before
removing the source, so moving large directories costs O(total data) and needs extra
free space. A failed source removal preserves source data and can leave a duplicate
for recovery. SQLite/filesystem commits and directory transfers are not distributed
or crash-atomic. The in-process queue does not coordinate other FileCloud processes or
external filesystem writers; exclusive target creation still protects their existing
files, while external path/symlink replacement remains an OS-level limitation.

Direct and periodic watcher probes recheck library membership after asynchronous I/O.
Stopping invalidates results, drains outstanding probes and closes directory handles
before clearing state. Media subprocess handlers await completion and asynchronous
publication/cleanup instead of throwing from event callbacks.

The async-filesystem regression suite statically forbids synchronous filesystem APIs
outside the two startup files and executes real temporary-file workflows with blocking
filesystem methods disabled. Additional tests exercise pending-open aborts, competing
writers, concurrent upload/parent rename, ownership registration races, fallback
transfers, failed source removal and delayed media/storage responses.

## Deliberate limits

This remains a personal-project modular monolith with shared database access. Request and background filesystem work uses asynchronous APIs; synchronous filesystem operations are restricted to database startup/upgrade before serving. Cross-module deep imports have been removed; file/media capability calls remain separated from their acyclic public import graph. Move/copy uses independent source and destination credentials with deliberate legacy compatibility; see [move-copy-api.md](move-copy-api.md). Cross-library move/copy is still rejected, and task submission is not operation completion. The changes do not establish distributed filesystem/SQLite atomicity, cross-process file-operation serialization, or power-loss recovery for every filesystem operation. A stuck storage/task operation can still hit the 30-second shutdown deadline. Browser interaction and a real production upgrade require deployment validation.
