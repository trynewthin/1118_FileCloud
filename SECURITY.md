# Security notes for this hardening

This is scoped hardening of file access, paths and recycle-bin behavior. It is not a complete security audit or a claim that all routes and integrations are safe for untrusted multi-tenant deployment.

## Filesystem policy and compatibility

- `FS_ALLOWED_PATHS` is an optional comma-separated allowlist. Empty/unset still means **no global root restriction**, intentionally preserving existing behavior. Set explicit trusted roots when a deployment needs that restriction. Empty comma segments no longer implicitly add the working directory.
- Library operations still enforce the individual library boundary. Canonical path checks cover existing paths, missing descendants and symlink escapes; lexical string prefixes alone are insufficient.
- Mutation paths reject symlink traversal. Recursive directory mutation preflight rejects trees containing symlinks, including links whose targets remain inside the library, rather than risking copy/delete behavior that follows an unexpected target. This can reject directories previously accepted; handle those links explicitly outside the application.
- Checks do not guarantee safety against a hostile local process swapping paths or symlinks between validation and filesystem operations. Run FileCloud with a least-privileged OS account and trusted filesystem permissions. Do not give untrusted local users concurrent write access to its library roots or internal metadata.

## Recycle bin and rollout

New deletions use unique internal trash locations recorded in `file_trash_locations`; restoring into an occupied destination fails rather than overwriting it. Legacy trash entries without saved location metadata still use the prior name-based layout as a compatibility fallback. Old name-based storage cannot reconstruct data already overwritten before this fix.

The source and schema changes require restarting the backend so startup schema initialization can run. The implementation work does not restart the currently running backend or migrate its live data. Before rollout, back up the SQLite database and file libraries together, stop/restart in an authorized maintenance window, and run application-level smoke checks on representative data. A filesystem copy and a SQLite update are not a single atomic transaction; this change does not provide crash-recovery guarantees for all partially completed operations.

See [architecture](docs/architecture.md) for ownership/dependency rules and [verification](docs/verification.md) for the tests and remaining verification gaps.
