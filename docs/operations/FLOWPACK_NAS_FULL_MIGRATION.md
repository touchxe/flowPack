# FlowPack private NAS full-migration runbook

This runbook implements the approved CP-007 boundary: the application,
PostgreSQL data, credentials continuity, and owned media move to the NAS and
are served through Tailscale HTTPS. NAS, DSM, SSH, Docker, application, and
database ports are not exposed publicly.

## Required browser sessions

Prepare DSM, Tailscale Admin, GitHub, Neon, and the current Vercel project.
Prepare Cloudinary only if the inventory proves it owns live assets. Prepare
Google, Kakao, Apple, Meta, X, LinkedIn, Toss, Resend, OpenAI, and connected
WordPress admin sessions only for providers that are actually enabled.

Do not paste a key or URL into chat. Laptop deployment coordinates live in the
Git-ignored `.env.nas-operator.local`. NAS runtime and database secrets live
only in `<flowpack-root>/.env.nas.local` and
`<flowpack-root>/.env.nas.db.local`; both are mode-`600` files whose variable names start from
`app/ops/nas/env.example`.

Preserve the existing `AUTH_SECRET` and `SOCIAL_TOKEN_ENCRYPTION_KEY` until
password login and every retained encrypted social token have been tested.
Database dumps contain password hashes, provider tokens, billing records, and
possibly plaintext WordPress/AI credentials; treat every dump as a secret.

Before copying any runtime value, inspect the currently deployed Vercel
environment-variable **names** and each enabled provider dashboard. Write a
sorted, mode-`600` private manifest under `app/.nas-migration/` that records
names and retain/disable decisions only. It must contain no value, URL,
account identity, client ID, project ID, or exported provider data. Preserve a
variable in `.env.nas.local` only when all three facts agree: the deployed
source has the name, the provider/integration is active, and this repository
supports that exact name. `ops/nas/env.example` lists the supported optional
Google/Kakao/Apple and outbound integration names with empty values. Empty or
inactive entries stay absent from the real NAS file; public callbacks, public
media, and the scheduler remain false.

Hash the canonical name-only manifest and bind that digest to the source-freeze
approval and final cutover report. The live adapter re-reads the mode-`600`
manifest at freeze and final binding and rejects drift; a completed provider
inventory alone still does not authorize cutover. The observed Neon source has
one production branch and the application tables are in `public`; the logical
database path remains exact `public` only and fails closed when any unreviewed
non-system schema is discovered.

Create `app/.nas-migration/` with mode `700`. Copy
`app/ops/nas/source-db.env.example` to
`app/.nas-migration/source-db.env` and
`app/ops/nas/offsite-profile.example.json` to
`app/.nas-migration/offsite-profile.json`; replace placeholders locally and
set both files to mode `600`. The offsite root must be a mounted mode-`700`
directory outside the project workspace **and on a different filesystem
device** from the rehearsal workspace. A different folder on the laptop's
same disk is rejected and does not satisfy the off-NAS copy gate. Generate the
encryption key without printing it:

```bash
npm run nas:db:key:init -- "$PWD/.nas-migration/backup.key"
```

Keep a second protected copy of the key apart from the encrypted dump. The DB
rehearsal accepts only absolute paths and an existing ledger at
`STAGED`. Source database configuration fails closed unless `sslmode` is
`require`, `verify-ca`, or `verify-full`; the insecure loopback exception exists
only for the synthetic integration drill. The rehearsal discovers every
non-system schema, permits only the reviewed `public` allowlist, inventories
broad schema objects, database locale, and PostgreSQL large objects, and omits
only `public._prisma_migrations` for the reviewed FlowPack baseline procedure.

The operator encrypts both the custom-format dump and its canonical evidence
bundle with AES-256-GCM, copies both plus the manifest off NAS, reads and
decrypts them back, then binds the actual dump, manifest, and artifact-report
digests into `ARTIFACTS_VERIFIED`. Only after that binding does it perform the
exact network-isolated scratch restore and advance to
`RESTORE_DRILL_PASSED`. Service credentials, plaintext dump/list/inventory,
plaintext evidence, and plaintext readback files are removed in a `finally`
cleanup path on success or failure.

The repository now contains a guarded cutover boundary for remote exclusive
locking, encrypted existing-NAS backup on a distinct filesystem, source freeze
receipt binding, final dump binding, candidate restore, crash-safe database
renames, owner/runtime-role bootstrap, `ANALYZE`, and an `app_ro`/scheduler-zero
Tailscale HTTPS smoke. Its phase tests deliberately stop at
`ZERO_WRITE_SMOKE_PASSED`; `commit` and `finalize` remain fail-closed because
post-write reconciliation is not implemented.

The executable cutover path remains unavailable as well. The guarded core now
requires one media generation to bind all of the following under the same
database migration ID, release, token digest, candidate database, and remote
database-lock identity before any database rename:

- an opaque sealed artifact-handle digest bound to the migration, immutable
  release, source freeze/snapshot, database attestation, and remote lock;
- media evidence schema v2 and the four candidate-attestation hashes;
- the source snapshot records digest and reviewed evidence manifest;
- the deterministic transfer bundle and manifest digests;
- an encrypted offsite copy on a separate physical device, authenticated
  readback to the original bundle digest, and completed fsync boundaries;
- the `media.receive` restricted-gateway receipt, exact streamed payload
  bytes/digest, pinned helper/policy/protocol/action-set digests, and local
  durable upload-receipt digest;
- the remote `candidate-complete` receipt digest and full candidate-object
  verification digest;
- the SERIALIZABLE candidate-only database rewrite execution digest and its
  durable remote receipt; and
- an additive, content-addressed canonical-media publication receipt produced
  with full readback and verified **before** the candidate database can be
  renamed canonical.

The candidate-media preparation and publication reports are mode `600`, and
their digests become part of the remote database rename evidence and the
`DESTINATION_RESTORED` report digest recorded in the migration ledger. This
ordering keeps the old database usable while new immutable objects are being
published and prevents a new database from becoming visible before all of its
objects are durable. Pre-write rollback restores the old database; additive
unreferenced objects cannot expose a mixed application generation.

The repository now implements and tests the application-level primitives: an
AES-GCM sealed random-artifact handle with strict private-file and crash-resume
checks; a no-argument framed upload receiver that writes only the derived fixed
incoming object with exclusive mode-`600` creation, fsync, full readback, and a
durable receipt; and an additive-only candidate-to-content-addressed publisher
that never overwrites or deletes canonical objects and binds its durable
receipt to the candidate rewrite, preparation report, candidate verification,
release, and database lock. Exact replay is allowed only for identical bytes
and evidence; symlink, unrelated hardlink, collision, drift, and tamper states
fail closed.

The standard client uses `restricted-gateway-v1`: a four-byte big-endian
canonical-JSON header length, an ASCII-key-lexicographic UTF-8 header, and an
exact backpressure-streamed payload where the action permits one. It sends no
SSH remote command and accepts only the digest-only response envelope. Its
private schema-v2 profile fixes project `flowpack-v2`, pins the installed
protocol/action-set/helper/policy digests, and sets every legacy flag (raw
shell, direct Docker, scp, SFTP, remote command, caller paths) to false. The
tracked migration config records SHA-256/64-hex requirements, the exact action
list, and only the reviewed common contract digest. The exact canonical,
no-newline contract is `app/deploy/restricted-gateway-v1.contract.json` with
SHA-256 `aec60b603fc80fa2741e406b133c99cee79206b5419509a3c875e66c71d35cf9`.
Installed action-set/helper/policy pins live only in the Git-ignored operator
env/profile; a locally invented pin never authorizes deployment.

DSM may require an approved administrators-group SSH username, but root login
is forbidden. Standard work uses a separate `flowpack_gateway_ed25519` key
whose root-owned authorized-key entry runs exactly `--gateway --project
flowpack-v2`, with PTY, agent, port, and X11 forwarding disabled. Existing
unrestricted administrator identities are emergency-management only. The
root daemon maps the authenticated peer UID to this single project and rejects
cross-project requests.

Application-release helpers are not an NAS authorization boundary. Activation
remains blocked until the reviewed root-owned gateway and exact action handlers
are installed outside every release. Root-owned policy derives all paths and
executables; callers supply no path, root, shell, subcommand, or generic
argument. Unimplemented mutations return `ACTION_NOT_ENABLED`.

The live media binding now connects the sealed source session, `media.receive`
receipt, candidate DB rewrite receipt, and additive `media.promote` evidence,
and the retained-provider manifest digest is bound into freeze/final evidence.
The root-owned server mutation handlers and full live system operation mapping
are still unavailable. Therefore
`npm run nas:db:cutover` and every direct mutating
invocation of `scripts/nas-live-cutover.mjs` fail with the internal boundary
`FLOWPACK_MEDIA_SOURCE_HANDOFF_AND_PROMOTION_NOT_IMPLEMENTED`. Do not bypass
this stop with a release-owned helper, generic SSH command, scp/SFTP, direct
Docker/Compose, manual `pg_restore`, `ALTER DATABASE`, file copying, or generic ledger
advancement. The migration must remain at `RESTORE_DRILL_PASSED`.

The guarded adapter's future control file is mode `600` and includes only
absolute paths. It expects separate mode-`600` NAS runtime variants
`.env.nas.ro.local` and `.env.nas.rw.local`; the former pairs
`FLOWPACK_WRITE_MODE=read-only` with database role `flowpack_app_ro`, keeps all
callbacks/media/scheduling disabled, and temporarily enables the credential
smoke. The latter pairs `read-write` with `flowpack_app_rw` but is not activated
by the current code. Credential-smoke email/password/token and the separate
social-token-smoke operator token belong in one mode-`600` JSON input, never in
the control, report, command line, or Git. The read-only environment must set
both `FLOWPACK_AUTH_SMOKE_ENABLED=true` and
`FLOWPACK_SOCIAL_TOKEN_SMOKE_ENABLED=true`; the read-write environment must set
both to `false`, while `FLOWPACK_PUBLIC_CALLBACKS_ENABLED` remains `false` in
both variants. Preparing these files does not authorize cutover.

Run the reviewed rehearsal migration ID from `app/` with:

```bash
npm run nas:db:rehearse -- \
  --migration-id "$MIGRATION_ID" \
  --compose "$PWD/docker-compose.nas.yml" \
  --source-config "$PWD/.nas-migration/source-db.env" \
  --backup-key "$PWD/.nas-migration/backup.key" \
  --offsite-profile "$PWD/.nas-migration/offsite-profile.json" \
  --journal "$PWD/.nas-migration/$MIGRATION_ID.journal.jsonl" \
  --workspace "$PWD/.nas-migration/work/$MIGRATION_ID"
```

## Authentication and approvals to prepare

Use one Chrome profile and sign in before the migration window. Complete MFA
inside the provider page. Never paste a password, API key, database URL,
recovery code, private key, OAuth client secret, or exported record into chat.

- DSM: an administrator session for Docker, storage permissions, Task
  Scheduler, and the Tailscale package. SSH remains key-only under the
  deployment account.
- Tailscale Admin: permission to edit Grants, tags, Services, MagicDNS, and
  HTTPS and to approve Service advertisements.
- GitHub and Vercel: repository/project administration, runtime-variable and
  scheduler inventory, maintenance/read-only control, and rollback retention.
- Neon: project administration for the current direct PostgreSQL connection,
  branch/history/snapshot status, database roles/extensions, and schema
  inventory. Do not use a pooled endpoint for `pg_dump`.
- Cloudinary: only if the URL inventory proves that live owned media is stored
  there; retain originals during the rollback window.
- Google, Kakao, Apple, Meta, X, LinkedIn, Toss, Resend, OpenAI, and WordPress:
  only for integrations found enabled in the source inventory. Private NAS
  mode keeps public callbacks disabled until a separate public-relay change is
  approved.

The source currently names the legacy secret `NEXTAUTH_SECRET`. During the
first NAS cutover, copy that exact value to `AUTH_SECRET`; if no distinct
`SOCIAL_TOKEN_ENCRYPTION_KEY` existed, initialize it to that same legacy value.
Rotating either value before login and social-token decryption tests would
invalidate continuity.

The zero-write HTTPS smoke uses a second exact operator-only POST path to read
all active `social_accounts.accessToken` values with `flowpack_app_ro`. The
query requests one row beyond the fixed 10,000-row cap and fails closed on
overflow. Every `enc:v1` value must decrypt with
`SOCIAL_TOKEN_ENCRYPTION_KEY ?? AUTH_SECRET`; one failure blocks cutover.
Legacy plaintext values are counted and classified only. The handler returns
only `204` on success and never returns or logs a token, decrypted value,
account identity, provider URL, or row count. Middleware permits only the exact
POST smoke paths while the corresponding read-only flags are enabled.

### Private OAuth decision gate

Do not assume that a private Tailscale Service hostname can replace every
existing OAuth callback. Google and Apple require exact HTTPS redirect URLs
and impose domain registration or verification rules. Inventory users with a
password hash separately from social-only users. Before source freeze, prove
one of these reviewed paths for every retained account: password login or a
provider callback that has passed a real browser rehearsal. There is no
Tailscale-to-application identity mapping implementation in this repository.
If neither path passes, keep social OAuth disabled on NAS and do not cut over
that account. Adding a public callback relay is outside this private migration.

The operator stops before each state-changing provider action. Explicit
approval is required for the Tailscale policy/tag update, source write freeze,
final dump, destination restore, traffic commit, and any rollback after NAS
writes. Before `SOURCE_FROZEN`, name one verified off-NAS backup target
(external disk, another NAS, Synology C2, S3, or B2).

## Private HTTPS service

Use a dedicated `svc:flowpack` Tailscale Service backed only by the NAS
loopback port. Add the SSH and service Grants before applying the required host
tag, approve the advertisement in Tailscale Admin, verify
`tailscale serve get-config --all`, and require an empty
`tailscale funnel status --json`. A node-wide path proxy is a temporary
fallback only.

## NAS data boundary

Use a dedicated root with a sentinel whose exact project ID is
`flowpack-nas`.

```text
<flowpack-root>/
  postgres/        # live PGDATA
  media/           # owned durable objects under opaque keys
  backups/         # dumps and manifests, replicated off NAS
  releases/        # immutable committed source releases
  state/           # migration journal and exclusive lock
  current          # promoted release reference
```

PostgreSQL has no published port. The web port binds to NAS loopback and is
proxied by Tailscale Serve. External API access is outbound only. Until a
separate public relay is approved, Toss/Meta inbound callbacks and publishing
that requires an Internet-retrievable NAS media URL stay disabled.

## Root-owned future release boundary

Before release activation, root-owned policy must derive and validate the
`flowpack-nas` sentinel, private runtime/DB env files, immutable release
namespace, incoming namespace, state/lock area, Compose executable, and cached
images. None of those NAS paths or executables may appear in the operator env
or request header. The private gateway profile pins the NAS SSH host key in
`known_hosts`; preparing these server objects does not enable deployment.

### Restricted gateway preflight and blocked deployment

The standard operator has no Docker, Compose, raw SSH-command, SCP/SFTP, remote
root, remote executable, runtime-env path, or HTTPS coordinate. Its private
operator env contains only the local mode-`700` gateway profile selector and
the four installed SHA-256 pins. The profile owns host/known-host data, the
approved DSM administrators-group username, and the exact dedicated
`flowpack_gateway_ed25519` forced-command identity. Root and unrestricted
management keys are rejected.

`nas:check` performs local config/profile/Compose/HEAD boundary validation and
then exactly one `system.preflight` gateway request. It does not probe Docker,
run a remote shell, or create a remote stage. The gateway config distinguishes
wire project `flowpack-v2` from Compose and ledger project `flowpack-nas`, lists
the exact action set including `media.receive`/`media.promote`, and fixes every
legacy route to false.

Run from `app/` with a clean checkout:

```bash
npm run nas:check
npm run nas:dry-run
# run the repository quality gates and review the intended tracked changes
```

`nas:dry-run` performs no network operation. `nas:deploy` currently stops with
`RESTRICTED_GATEWAY_RELEASE_STREAMING_NOT_ENABLED` before any quality, remote,
or mutation operation; `nas:verify` likewise remains action-disabled. Do not
replace these stops with the removed legacy transport. Activation requires the
async backpressure-streamed `release.receive` path, exact size/hash/EOF checks,
root-owned release/Compose handlers, canonical receipts, and rollback evidence.

The future gateway source handler must never write runtime/DB environment files, `postgres/`,
`media/`, `backups/`, or the migration journal. DB/file restore and cutover are
separate ledger-controlled operations. Before first deploy, capture a redacted
read-only `get-config` result from the real NAS. If a future Tailscale release
changes the documented schema, update parser fixtures rather than falling back
to human-output grep.

## PostgreSQL baseline gate

The checked-in legacy migrations contain SQLite SQL and must never be executed
against NAS PostgreSQL. Do not move, delete, resolve, or replace them until all
of the following evidence exists:

1. Neon source version, extensions, schemas, tables, indexes, constraints,
   enums, triggers, and `_prisma_migrations` state are inventoried.
2. `prisma db pull --print` has been captured without the connection URL.
3. `prisma migrate diff` from the live datasource to `schema.prisma` exits with
   no drift.
4. CP-003's user/platform/account composite uniqueness exists in both live
   schema and the candidate baseline.
5. A PostgreSQL baseline generated from empty to canonical schema has been
   reviewed and restored into a scratch PostgreSQL 17 database.

The source logical dump excludes `_prisma_migrations`; after restore, mark only
the reviewed PostgreSQL baseline as applied and run `prisma migrate status`.
Future production schema changes use `prisma migrate deploy`; `prisma db push`
is prohibited.

## Media inventory and migration

Build a manifest covering `media_files.url`, `media_files.blobKey`,
`content_images.url`, `contents.thumbnailUrl`, and URLs embedded in content
body/slides. Classify entries as Cloudinary, data URL, OpenAI temporary URL,
Vercel Blob, or other external URL.

Only owned/licensed content is copied. Each object is downloaded into a staging
directory, scanned/validated, assigned an opaque NAS key, and recorded with
byte size, MIME, and SHA-256. Update DB references in one transaction only
after all referenced files verify. Preserve the encrypted source-reference
mapping for rollback; do not include source filenames or URLs in normal logs.

## Rehearsal and cutover state

Every migration ID advances through:

```text
PLANNED -> STAGED -> ARTIFACTS_VERIFIED -> RESTORE_DRILL_PASSED
-> SOURCE_FROZEN -> DESTINATION_RESTORED -> ZERO_WRITE_SMOKE_PASSED
-> CUTOVER_COMMITTED -> FINALIZED
```

The scratch restore compares table counts, normalized non-PII aggregates,
sequences, FK/unique/index/enum definitions, Prisma baseline status, media
count/bytes/checksums, credentials login, admin authorization, social-token
decryption, upload/read/delete, AI, WordPress, and Tailscale HTTPS.

At final cutover, place the source in maintenance/read-only mode, stop source
scheduler/upload/payment processing, wait for in-flight writes, and produce a
final DB dump and media delta. The source scheduler inventory must identify
every trigger, owner, last-run evidence, and disable control; a screenshot or
operator assertion alone is insufficient. Restore and smoke-test NAS with
writes and scheduler disabled.

This repository has no NAS scheduler service or singleton lease. The Compose
contract contains only `db` and `web`, `FLOWPACK_SCHEDULER_ENABLED` is fixed to
false, and the NAS runtime policy ignores attempts to set it true. Scheduled
work remains unavailable after cutover until a separately reviewed singleton
owner, lease/fencing rule, retry semantics, and duplicate-execution test are
implemented. Do not enable a source or NAS scheduler merely because the
zero-write smoke passed.

The source can be frozen only after the PostgreSQL baseline review, successful
scratch restore, verified off-NAS copy, credential-login rehearsal, and an
operator-confirmed maintenance window. Otherwise remain at
`RESTORE_DRILL_PASSED` or earlier.

## Rollback and retention

Before NAS writes, traffic and provider callbacks can return to the preserved
source after the NAS scheduler is disabled. After NAS writes, freeze both sides
and reverse-migrate/reconcile the NAS delta; switching the frontend alone is
not a data-safe rollback.

Keep Neon, Cloudinary originals, the last Vercel deployment, final source
dump, storage manifest, and last known-good NAS release for at least 30 days.
Deletion and key rotation are separate, explicit post-stabilization actions.
