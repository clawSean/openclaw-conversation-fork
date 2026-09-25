# OpenClaw update retest matrix

This is mandatory after every OpenClaw update until the native host capability
lands upstream. A green result from an older OpenClaw head does not qualify a
new installation.

## Rebase and rebuild

1. Record the new OpenClaw version and exact commit.
2. Create a fresh isolated worktree at that commit. Do not reuse generated
   `dist/`, dependencies, or receipts from the previous head.
3. Install the frozen lockfile with a supported Node version after explicit
   dependency-install approval. Verify the manifest and lockfile bytes did not
   change.
4. Reapply or port the native patch. Expect conflicts around plugin-command
   runtime/types/execution, session creation and message rewind, transcript
   transport metadata, session-binding identity/CAS, and Telegram bindings.
5. Regenerate the source patch, file manifest, hashes, package archive, and all
   proof receipts. Never relabel an old receipt with the new version.
6. Run the complete OpenClaw build and public plugin-SDK export check.

## Required automated proof

- Plugin syntax/manifest checks and every plugin unit test.
- Exact archive contents, source-byte parity, dependency closure, entry
  invocation, and SDK command/catalog probe against the newly built host.
- Invocation authority: unauthorized, unresolved, retired, expired, and
  retained command capabilities fail closed.
- Tip fork: official parent-session fork, no extra model turn.
- Reply fork: native message ID maps to an active persisted user entry, forks at
  that entry, and submits text once. Media-bearing prompts must fail closed until
  exact media replay is implemented.
- Placement: child success, child `session_only` failure followed by same-ticket
  current fallback, and no duplicate session creation.
- Back: exact prior route restoration, stale generation/ABA rejection, reset or
  deleted target rejection, TTL handling, and no overwrite after another actor
  changes the binding.
- Lifecycle: active/queued work fencing, owner revocation, exceptions, retry,
  nested forks, restart recovery, and status reads with no mutation.
- Channel adapters: Telegram supergroup topic, Telegram bot-DM topic, flat DM
  current fallback, and at least one non-Telegram current/child adapter.
- Formatting, scoped lint, changed-file checks, typecheck, and `git diff --check`.

## Live qualification (separate approval)

Installing or enabling the plugin, applying a native patch to the live OpenClaw
installation, changing configuration, or restarting the Gateway requires fresh
explicit approval. Use the Gateway watchdog dry run first. Then prove on the
actual channels: fork, next message routes to the fork, Back, next message routes
to the original, restart survival, permission-denied fallback, and duplicate
delivery protection. Capture message/session/binding receipts without secrets.

## Update invalidation rule

An OpenClaw update invalidates the native build and live qualification until this
matrix passes on the new exact head. If the update replaces locally patched core
files or the built SDK, rebuild/reapply the patch and reinstall the plugin only
after approval. The package's command tests remain useful, but they do not prove
host compatibility by themselves.
