# SQLite upgrades

## Tooling and source of truth

Database startup uses the official `drizzle-orm/bun-sqlite/migrator`, pinned to
`drizzle-orm` **0.45.4** in `backend/package.json` and `backend/bun.lock`. Application
queries continue using `bun:sqlite` and existing SQL. There is no ORM conversion
and no home-grown migration execution engine.

`backend/drizzle/*.sql` and `backend/drizzle/meta/_journal.json` are the migration
source of truth. The former schema declaration modules are no longer executed at
startup. Do not edit an applied SQL file, rename/reorder journal entries, remove
history, or use schema `push` against a deployed database. Append a new SQL file
and journal entry with a unique, strictly increasing timestamp. Separate each
statement with Drizzle's `--> statement-breakpoint` delimiter. Test upgrades from
all supported historical fixtures before release. The two initial files represent
the original schema and the trash-location addition separately.

Drizzle owns statement execution and commits all pending migrations with their
history rows in one transaction. Its empty ledger table is created before that
transaction and may remain after a failed first migration; no applied-history
rows are retained. Its stock SQLite migrator does not validate
all old hashes or take backups. The small application startup wrapper adds those
safety checks; this is not a claim that installing Drizzle alone provides them.

Official references:
- https://orm.drizzle.team/docs/get-started/bun-sqlite-new
- https://orm.drizzle.team/docs/migrations
- https://github.com/drizzle-team/drizzle-orm/blob/0.45.4/drizzle-orm/src/sqlite-core/dialect.ts
- https://sqlite.org/lang_vacuum.html

## Before upgrading

1. Stop every application instance using this database, including older versions.
   Back up the file-library contents separately; a SQLite snapshot contains
   metadata, not the user's files.
2. Preserve the previous application version and ensure sufficient free disk
   space for a full database snapshot plus migration working space.
3. Deploy the complete backend, including the `drizzle` folder, and install from
   the committed lockfile. Start the new backend normally. Migrations run before
   HTTP serving and task startup.

Migrators sharing the same canonical database path serialize through a separate
`<database>.migration-lock` SQLite file with a 30-second busy timeout. SQLite's OS
lock is released on process death. Never unlink that lock file while processes
are running; this would create two separate lock domains. This lock coordinates
new migrators, not arbitrary SQL writers or old application versions. Network
filesystems must provide SQLite's required locking semantics.
WAL journal negotiation also happens inside this lock. Connection construction
only opens the database and configures its busy timeout: setting a timeout alone
does not prevent concurrent journal-mode lock-upgrade failures on a fresh file.

For any nonempty database needing an upgrade, startup first checks SQLite
integrity and writes a unique snapshot under `<database>.backups/`. `VACUUM INTO`
reads committed WAL contents as part of the database; it does not copy the live
main file in isolation. The snapshot is independently opened, integrity checked,
and fsynced before migrations run. New snapshots use mode 0600 and newly created
backup directories use mode 0700. No migrations run if snapshot creation or
verification fails. Backups are never automatically pruned or overwritten: monitor
free disk space and retain/delete them according to your recovery policy.

Unversioned databases are adopted only if their complete SQLite schema matches
the recognized original layout, optionally including the trash table. The prior
custom version-one ledger is recognized and retained for audit. Unknown tables,
partial schemas, changed constraints/indexes, incompatible old ledgers, missing
history entries, changed migration checksums, and newer migration histories stop
startup for investigation. Automatic adoption does not repair arbitrary drift.
The old custom ledger requires its complete layout, including the trash table;
an empty database containing only that ledger is refused. Schema comparison
preserves quoted values, including their case and whitespace.

## Failure and recovery

- SQL failure: Drizzle rolls back pending DDL/data changes and history together.
  Startup stops. Diagnose the failing unapplied migration, correct it in a new
  application build, and retry. Never edit an already applied migration.
- Process crash: SQLite rolls back an incomplete transaction when reopened and
  releases the migration lock. Restarting retries unapplied migrations.
- History mismatch: deploy the matching or newer application build. Do not erase
  history or force an older application to start.
- Integrity failure or an application rollback requiring an older schema: stop
  **all** instances before restoring. Keep the failed database and its `-wal` and
  `-shm` sidecars together in a separate recovery directory. Verify the selected
  snapshot with SQLite `PRAGMA integrity_check` (must return `ok`), then copy it to
  the original database path. Do not leave the failed database's old `-wal`/`-shm`
  files beside the restored copy. Restore matching file-library state if needed,
  use the application build matching that snapshot, and start one instance first.
  Restoration discards changes since the snapshot; review that consequence before
  doing it. This repository never performs automatic destructive restoration.

Do not restore or copy over an open SQLite database. A successful integrity check
proves database structural consistency, not business correctness or a distributed
transaction between files and metadata. Backups mitigate upgrade failures but are
not a substitute for tested off-host backups or power-loss-safe storage.

## Verification

`cd backend && bun test tests/migrations.test.ts` uses only disposable databases.
It checks fresh startup, legacy adoption, WAL-contained rows in standalone backups,
backup failure, ordered upgrade rollback/retry, history tampering/future versions,
concurrent application startups and crash-released migration locks. The original
legacy fixture is frozen from Git `173ae4d94820d26354b82d6321efbb01cc0736b4`,
independent of the new migration files. Retention checks include accounts,
libraries, entries, tags/links, queued tasks, settings, FTS documents and trash
locations. A child is killed with SIGKILL immediately before Drizzle commits,
after confirming its DDL and history writes exist inside the open transaction;
the test verifies recovery and successful retry. No configured database or running
application is touched by these tests.
