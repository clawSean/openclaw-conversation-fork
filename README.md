# Conversation Fork for OpenClaw

![Status: integration candidate](https://img.shields.io/badge/status-integration%20candidate-orange)
![JavaScript ESM](https://img.shields.io/badge/JavaScript-ESM-yellow)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

Explore a tangent without losing the conversation you started from.

**This is an integration candidate, not a live-qualified release.** The plugin
works only with the matching invocation-bound OpenClaw host patch. Stock OpenClaw
fails closed without changing sessions or bindings. Nothing here has been
activated on a live Gateway yet.

## Intended behavior

- `/fork [title]`: preserve the original history and branch at the current tip,
  without starting another model turn.
- Reply to a saved text-only user prompt with `/fork`: branch before that exact
  prompt, then submit it once in the new destination. Media replay fails closed
  until exact media preservation is implemented.
- Prefer a new native topic/thread; otherwise safely continue in the current
  conversation with a clear reason and a working `/fork --back` return path.
- `/fork --status`: inspect the scoped operation without retrying it.
- `/split`: secondary alias. DMs and multiple channels are in scope; no transport
  is claimed supported until native integration and routing proof exist.

## Implemented and source-proven

- Authenticated command definitions and bounded Unicode-aware argument parsing.
- Child-first placement policy, explicit shared-chat messages and result validation.
- No blind fallback after timeouts, uncertain effects or incomplete success receipts.
- Historical, read-only status messages and definite no-effect failure handling.
- Invocation-bound native host capability; unauthorized and retained invocations
  fail closed.
- Official tip and persisted-message fork owners, child-first placement, one-use
  reply replay, exact prior-route metadata, and generation-fenced Back.
- Telegram supergroup topics plus Bot API admission for private-chat topics;
  unsupported child creation can fall back to the current conversation.
- Return handling and bounded error messages. Stock hosts remain unavailable.
- Dependency-free tests covering positive and negative command paths.

The exact-head proof uses OpenClaw `2026.9.6` source at
`9698f3467649107d28d69b9137ad7cf2c9bf33e1`. It is source/integration evidence,
not live Telegram or Discord qualification and not proof of restart recovery.

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

The unpacked candidate passed public-SDK command registration, text dispatch,
native catalog dispatch and unauthorized-sender rejection on patched OpenClaw
`2026.9.6`. That
probe uses a disposable state directory, no inherited credentials, and blocked
network access. Telegram/Discord are synthetic dispatcher inputs—not live-channel
qualification. Full plugin loader/install and live fork/return proof remain open.

## Native integration boundary

The native patch keeps session creation, transcript access, lifecycle admission,
binding persistence and reply dispatch inside their existing OpenClaw owners.
The plugin receives only a versioned capability bound to one admitted command;
it does not receive general Gateway privileges or create another transcript store.

See the [proposed host contract](docs/host-contract.md) and
[OpenClaw design issue #157627](https://github.com/openclaw/openclaw/issues/157627).
General historical-session browsing remains a separate upstream discussion.

Before activation, live proof must still cover actual next-turn routing, restart
survival, nested forks, channel-native buttons, and media replay. See the
[post-update retest matrix](docs/update-retest.md); it is mandatory after every
OpenClaw update until the native patch lands upstream.

## Layout

- `src/`: command interface, parser, policy and native-adapter boundary.
- `test/`: fixture-based plugin regression tests.
- `scripts/check.mjs`: manifest, entry and syntax checks.
- `docs/host-contract.md`: proposed interface and native proof requirements.
- `docs/update-retest.md`: exact update/rebase/retest obligations.

Private Active Initiative Docs and research receipts are maintained beside the
code in the authoring checkout and excluded from publication.
