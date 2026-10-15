# Verification status

This file preserves chronological verification batches. Earlier counts and remaining-debt notes are historical; the final section records the latest combined result.

## Reproducible checks

Install both applications with `bun install --frozen-lockfile`, then run the strict aggregate check:

```sh
cd backend
bun run check
```

It runs backend tests, backend TypeScript checking, boundary-checker tests, the production import-boundary check, strict frontend lint (zero warnings), frontend unit tests and the frontend TypeScript/Vite build, stopping on a failed stage. All commands are also individually available in the root README.

`.github/workflows/ci.yml` runs these checks as six independent jobs with fail-fast disabled, read-only repository permissions and Bun 1.3.2. Dependencies are installed with frozen lockfiles. No job uses `continue-on-error`, ignored exit codes or automatic exception updates. The new workflow has only been configured locally; a remote GitHub Actions result requires an authorized push.

## Pre-change baseline

Checks performed against the checkout before source hardening on 2026-10-15, based on revision `173ae4d`:

- Backend `tsc --noEmit`: passed.
- Frontend `bun run build`: passed. Vite reported an existing JavaScript chunk of about 1.07 MB (about 325 kB gzip), above its 500 kB advisory limit.
- Frontend `bun run lint`: failed with 177 problems: 161 errors and 16 warnings. Common categories are explicit `any`, synchronous React state updates in effects, React fast-refresh exports and hook dependencies. Frontend source and ESLint rules were not changed by this hardening.
- Production source boundary analysis: 320 files and 23 existing cross-module deep-import edges. The exact edges were collected from the original Git revision, not from concurrently edited source. They are recorded with migration reasons in `scripts/boundary-baseline.json`.

The initial hardening batch excluded frontend lint from its gate because of that backlog. The subsequent cleanup adds `bun run lint` with `--max-warnings 0` to both the aggregate command and CI. The historical results below describe their respective batches; the latest result is recorded at the end.

## Scope of confidence

A passing aggregate check establishes that the current backend tests, TypeScript checks, import policy, strict frontend lint and production frontend build pass. It does not establish full security coverage, browser behavior, absence of dependency vulnerabilities or a remotely passing CI run. The boundary scanner itself is tested with temporary source fixtures, including negative cases for reverse dependencies, deep imports, aliases, computed imports and invalid/stale exceptions.

No live backend restart, browser verification, external publication or deployment is part of these checks. Security tests should isolate their SQLite database, file libraries and user fixtures from configured running data.

## Final local result (2026-10-15)

After the final recycle recovery fixes, `cd backend && bun run check` passed:

- 18 backend tests across five files, including subprocess-isolated HTTP/AI, path-service, tag/task/index and recycle fixtures with multiple assertions
- Backend TypeScript check
- 18 boundary-checker tests
- Boundary scan of 324 production source files with the same 23 recorded legacy edges
- Frontend TypeScript/Vite build: 2,620 modules transformed and assets emitted
- `git diff --check`: passed

Recycle fixtures include occupied file/directory restores, repeated same-name deletions, independent child deletions, permanently destroyed children, legacy trash, missing sources, symlink mutation rejection, injected SQLite mapping/state failures, and retry preservation after interrupted child/ancestor deletions. A focused independent review found no remaining high-severity blocker in this batch; this is not a whole-application audit.

Frontend lint remains the preexisting failure described above, and the build retains the existing large-chunk advisory. Changes are local source changes only: no remote CI run, backend restart, browser verification or deployment was performed.

## Lightweight file-command refactor (2026-10-15)

The next local batch preserves the prior security changes and moves folder creation,
streamed upload and file/index task submission out of `files/router.ts`. The route
file drops from 975 to 579 lines without a framework, extra process, schema change
or frontend refactor.

The aggregate check passed after this extraction:

- 20 backend tests across seven files, including two new isolated command/upload fixtures
- Backend TypeScript check
- 88 boundary-checker tests, including route persistence/task-import and filesystem-capability negative cases
- 327 production source files checked, with 22 remaining exact legacy edges
- Frontend TypeScript/Vite build and unchanged large-chunk advisory

Command fixtures exercise direct-call authorization, invalid input/parent/path,
missing-root bootstrap, folder-insert compensation, protected entries, task payloads
and creator identity, all eight task submission routes, folder HTTP responses and
real HTTP multipart upload. Upload fixtures force delayed disk close, duplicate and
concurrent filenames, malformed multipart input, injected write failure and request
abort/error/early close; failed uploads schedule no index task and remove only their
new files. The fixtures refuse to load database code without their isolated paths.

An independent focused review reran command/upload tests and found no remaining
must-fix issue in this extraction; this is not a whole-application audit.

These are local checks, not a production-data migration, live-server restart,
browser verification, deployment or remote CI result. The existing frontend lint
backlog is unchanged. Source and destination currently share one password field in
move/copy requests (preexisting API constraint); this refactor does not redesign
that contract.


## Frontend cleanup and lifecycle hardening (2026-10-15)

The latest batch retains both earlier security and file-command changes. Frontend
lint has been repaired without disabling rules or adding blanket exclusions and
now runs with `--max-warnings 0` in the aggregate command and CI. Frontend unit
tests are also mandatory. All six CI jobs remain local configuration until an
authorized push runs them remotely.

Route-level lazy loading reduces the largest JavaScript chunk from 1,072.17 kB
(324.86 kB gzip) to 308.00 kB (97.44 kB gzip); Vite's 500 kB advisory no longer
fires, and its threshold was not increased. This is a bundle-size measurement,
not a browser performance benchmark. FileBrowserPage drops from 1,095 to 982
lines with URL state/restoration isolated into local helpers; it deliberately
remains a single ordinary page rather than a new framework.

The frontend tests cover URL/root/Back-state derivation, invalid cache values,
failed library fetches, stale and out-of-order requests, unmount/Strict Mode
invalidation, old-navigation callbacks and structured error narrowing. These are
unit tests, not rendered browser or end-to-end interaction tests. A focused
independent review caught and verified the fix for repeated remote-client
selection leaving a dialog indefinitely loading.

Backend fixtures cover transactional schema adoption/rollback, sequential polling
and cancellation, enabled/deleted/root-changed watcher state, executor admission
and draining, and remote-proxy/HTTP shutdown. The remote fixture runs ephemeral
loopback peers with stub handlers and confirms admitted requests finish, later
requests are rejected, reconnect stays disabled and upgraded sockets close.
It exposed Bun 1.3.2's HTTP close callback stalling after upgrades; the server now
tracks admitted responses explicitly instead of depending on that callback.

No configured application database, running service, browser, remote branch or
production deployment was changed. Before a real rollout, back up SQLite: the
next startup adopts the initial version ledger transactionally. The ledger does
not repair arbitrary legacy schema drift or provide migration checksums. Some
synchronous filesystem work, 22 baseline deep-import edges and the shared
move/copy password contract remain documented design debt. A stuck task/storage
operation may still hit the 30-second shutdown deadline and require recovery on
next startup.

Final aggregate `cd backend && bun run check` passed after all edits:

- 28 backend tests across 12 files
- Backend TypeScript check
- 88 boundary-checker tests and 347 production files scanned, 22 unchanged legacy edges
- Frontend lint: zero errors and zero warnings
- 12 frontend unit tests across three files
- Frontend TypeScript and production Vite build, no oversized-chunk advisory
- `git diff --check`: clean

The tooling still prints a non-failing baseline-browser-mapping data-age notice;
this is separate from ESLint diagnostics. No dependencies or lockfiles were
updated merely to silence that advisory.


## Public module API migration (2026-10-15)

All 22 remaining cross-module deep-import edges now use narrow public APIs, and
`scripts/boundary-baseline.json` is empty. File task identifiers were extracted
into an import-free contract without changing their stored values. The file
public API does not re-export task-handler implementations, avoiding a runtime
files/media cycle.

Focused checks passed after this migration:

- 94 boundary-checker tests, including six production public-API regressions
- Production source scan with zero grandfathered edges
- Backend TypeScript check before the concurrent async-filesystem migration

The new regressions inspect source only: they do not import application modules
or open the configured database. They verify an empty baseline, unchanged task
identifiers, acyclic public API dependencies, and exclusion of routes/startup
and file handlers from the corresponding APIs. The combined branch still needs
its aggregate check after the concurrent migrations finish; these focused
results are not a claim about those other edits.


## Asynchronous filesystem migration (2026-10-15)

- Production filesystem scan: synchronous APIs remain only in database connection
  bootstrap and migration/backup initialization, before request/background work
- Backend TypeScript check passed after Promise propagation through auth, middleware,
  file/library services, media, AI callers and watcher probes
- Existing path-boundary, REST/AI authorization, recycle, watcher, file-command and
  multipart-upload regressions pass with awaited service APIs
- New async-filesystem tests execute temporary workflows with blocking filesystem
  APIs disabled, verify no-clobber transfers and cross-device fallback, and preserve
  source data when removal fails
- New delayed media/storage tests verify completion ordering for AI files, HTTP
  uploads, backgrounds, thumbnail/transcode publication and cleanup, including
  subprocess failure/cancellation
- Upload tests additionally cover abort while open is pending, parent relocation
  during upload success/rollback, and deferred indexing by stable parent entry
- Concurrent registration and recycle tests preserve ownership/recovery invariants;
  watcher stop drains direct probes without publishing disabled/stale state

All data-dependent checks use isolated temporary databases and storage. No production
services, databases or browser sessions are used. The final combined check below (or
in the concluding task report) supersedes the earlier staged test counts.

## Final combined migration and remaining-debt result (2026-10-15)

After all code and regression fixtures settled, the complete
`cd backend && bun run check` passed again:

- 43 backend tests across 15 files
- Backend TypeScript check
- 94 boundary-checker tests; 353 production files scanned with **zero** legacy edges
- Frontend lint with zero errors/warnings, 16 unit tests across four files
- Frontend TypeScript and production build; largest JavaScript chunk 308.00 kB
  (97.43 kB gzip), no oversized-chunk advisory
- `git diff --check` clean

The mature migration implementation is pinned Drizzle 0.45.4, without rewriting
business queries or building a custom migration executor. Its independent review
passed 14 focused migration tests/157 assertions, plus 320 simultaneous application
startups across 40 fresh temporary databases. That review corrected quoted-SQL
comparison, reserved-name matching, incomplete old-ledger adoption and WAL setup
outside the migration lock. The frozen historical schema fixture and real SIGKILL
before migration COMMIT exercise upgrade retention and crash recovery independently
of the new baseline SQL. See [database-upgrades.md](database-upgrades.md).

The 22 legacy deep imports are gone, request/background filesystem operations are
asynchronous, and move/copy has independent endpoint credentials with documented
legacy compatibility. Further review found destination-navigation and competing
upload/rename issues; fixes have dedicated regressions. See
[move-copy-api.md](move-copy-api.md) and [architecture.md](architecture.md).

Limits remain explicit: per-library filesystem queues are process-local; directory
moves may require copying all data and extra free space; SQLite and filesystem
changes are not one atomic transaction; old application instances must stop before
database upgrades. Browser interaction, real deployment/restore and remote CI were
not exercised. No configured database, running service, remote branch or production
data was changed. The optional browser-mapping age notice remains non-failing.
These checks establish the tested scope, not a claim that every possible bug is gone.
