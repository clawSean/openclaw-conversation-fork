# Conversation Fork for OpenClaw

![Status: development preview](https://img.shields.io/badge/status-development%20preview-orange)
![JavaScript ESM](https://img.shields.io/badge/JavaScript-ESM-yellow)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

Explore a tangent without losing the conversation you started from.

**This is a development preview, not a working native fork integration.**
The command shell and placement policy are implemented and tested. The production
adapter intentionally reports unavailable and changes no sessions or bindings.
Do not install this expecting session forks to execute yet.

## Intended behavior

- `/fork [title]`: preserve the original history and branch at the current tip,
  without starting another model turn.
- Reply to a saved user prompt with `/fork`: branch before that exact prompt,
  then submit the prompt and required media once in the new destination.
- Prefer a new native topic/thread; otherwise safely continue in the current
  conversation with a clear reason and a working `/fork --back` return path.
- `/fork --status`: inspect the scoped operation without retrying it.
- `/split`: secondary alias. DMs and multiple channels are in scope; no transport
  is claimed supported until native integration and routing proof exist.

## Implemented in this preview

- Authenticated command definitions and bounded Unicode-aware argument parsing.
- Child-first placement policy, explicit shared-chat messages and result validation.
- No blind fallback after timeouts, uncertain effects or incomplete success receipts.
- Historical, read-only status messages and definite no-effect failure handling.
- Return handling, safe error messages and an unavailable-by-default native adapter.
- Dependency-free tests covering positive and negative command paths.

The test host is an injected fixture. It is **not** evidence of real forks,
persistence, exactly-once delivery, live Telegram/DM support or working buttons.

## Development

Use Node 24.16+ (validated locally with Node 26.7). No dependency install is needed:

```sh
npm test
npm run check
```

The entry point is authored ESM JavaScript at `src/index.js`; no generated build
or runtime dependency is required. Package contents are explicitly allowlisted.
No installation, configuration change, credentials or Gateway restart is part
of these checks.

Optional boundary checks use an **existing** OpenClaw package and a locally packed
archive; they do not install either one:

```sh
node scripts/probe-sdk.mjs /path/to/openclaw
node scripts/verify-package.mjs /path/to/package.tgz /path/to/openclaw
```

The unpacked preview passed public-SDK command registration, text dispatch, native
catalog dispatch and unauthorized-sender rejection on OpenClaw `2026.9.4`. That
probe uses a disposable state directory, no inherited credentials, and blocked
network access. Telegram/Discord are synthetic dispatcher inputs—not live-channel
qualification. Full plugin loader/install and real fork/return proof remain open.

## Native integration boundary

Existing OpenClaw session-fork and conversation-binding owners should do the real
work. Ordinary third-party plugins cannot simply invoke privileged Gateway APIs.
This project does not bypass that restriction or create another transcript store.

See the [proposed host contract](docs/host-contract.md) and
[OpenClaw design issue #157627](https://github.com/openclaw/openclaw/issues/157627).
General historical-session browsing remains a separate upstream discussion.

Before activation, native proof must cover authority and audience isolation,
actual next-turn routing, return to prior nondefault/default routes, nested forks,
reset/deletion and expiry races, active work, restart survival, prompt media,
idempotency, and partial native-topic failures.

## Layout

- `src/`: command interface, parser, policy and native-adapter boundary.
- `test/`: fixture-based plugin regression tests.
- `scripts/check.mjs`: manifest, entry and syntax checks.
- `docs/host-contract.md`: proposed interface and native proof requirements.

Private Active Initiative Docs and research receipts are maintained beside the
code in the authoring checkout and excluded from publication.
