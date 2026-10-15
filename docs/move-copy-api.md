# Move/copy credentials

`POST /files/entries/:id/move` and `POST /files/entries/:id/copy` accept
independent credentials in the JSON request body:

```json
{
  "targetParentId": "destination-folder-id",
  "sourcePassword": "source-entry-password",
  "targetPassword": "destination-folder-password"
}
```

Copy also accepts optional `newName`. An omitted or null `targetParentId` means
the source library's root, which has no entry password. Cross-library transfers
remain unsupported and are rejected before creating a task, including for
administrators. Copying directories remains unsupported.

## Validation and compatibility

- Only current administrators may submit file mutations. The source entry and
  destination directory must exist, be active, and belong to the same enabled
  library. A password does not grant ownership or elevate an account's role.
- `sourcePassword` authorizes the source entry. `targetPassword` independently
  authorizes the exact destination directory. These are entry-level passwords;
  this change does not introduce inherited ancestor-password protection.
- A credential can be omitted for an unprotected endpoint. Incorrect or missing
  protected-endpoint credentials return HTTP 403, identifying the source or
  target in the message. Non-string values other than null return HTTP 400.
- Deprecated `password` is retained for existing clients. Each omitted role
  field independently falls back to `password`. An explicit role field always
  wins, including null or an empty string, which deliberately suppress fallback.
  New clients should send only the two role fields. For example, a legacy source
  password plus an explicit target password is accepted; a wrong explicit source
  password cannot be rescued by a correct legacy password.
- Passwords are checked before enqueueing and are never written into task
  payloads or task responses. Execution rechecks the creator's current role and
  resource access. An already-authorized queued command does not store a password
  to revalidate later password changes.

The 201 response and operation task payloads remain unchanged: `entryId`,
`targetParentId`, and optional copy `newName`. Rejected commands enqueue nothing.
Credentials should be sent in the POST body, never inserted into operation URLs.

## Browser behavior

The move/copy dialog, file preview, browser hooks, and API types use the split
contract. Each batch source has its own password field. Destination passwords
are scoped to the exact selected folder; navigating to another folder or the
root never reuses a different target's credential. Passwords remain transient
dialog state and clear when the dialog closes.

An explicit "unlock and browse" action uses that target's password to read its
details and children. Credentialed metadata/list reads use read-only POST aliases
of `/files/entries/:id` and `/files/library/:libraryId/entries`, with `password`
and optional list `parentId` in JSON. They share the GET handlers and authorization;
existing GET query credentials stay compatible. No password is sent on each
keystroke or added to new metadata/list URLs. A failed destination challenge keeps
the intended folder selected and never silently redirects a transfer to root.

Batch selection is snapshotted when the dialog opens so a list reload after the
first move cannot lose later entries. If a later submission is rejected, the
dialog keeps the error visible and a retry skips acknowledged submissions.
This is not an atomic batch or a server-side idempotency guarantee: an interrupted
response can leave an unknown submission result. Submitted tasks can be checked
in the task center. The dialog confirms submission, not task completion.

## Regression coverage

- `backend/tests/move-copy-credentials.test.ts`: isolated temporary database and
  HTTP fixture, current/stale roles, same/cross-library targets, disabled/deleted
  targets, distinct and equal passwords, legacy/mixed/null precedence, malformed
  inputs, roots, absence of credentials from persisted tasks, and credentialed
  read authorization/GET compatibility
- `frontend/tests/move-copy-credentials.test.ts`: per-entry/per-target mapping,
  root behavior, API payload forwarding, password-free read URLs, and
  partial-batch retry behavior
