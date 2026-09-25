# Native host contract experiment

This is an implemented candidate interface, **not a released OpenClaw SDK API**.
`src/native-host.js` resolves only `runtimeContext.conversationFork`; stock hosts
do not expose it and therefore fail closed. There is no configuration setting
that bypasses that boundary.

## Ownership

The plugin parses authenticated commands, selects child placement before a safe
current-chat fallback, and renders bounded results. It does not own transcripts,
a session registry, binding persistence, provider calls, or credentials.

A future native adapter must be bound to the admitted command invocation. Never
accept source/return session selectors or authority fields from command arguments.
The native session and binding owners must revalidate authorization, account,
agent, conversation, audience, retention, active work and their own lifecycles.
A conversation tuple or successful comparison alone is not a mutation lease.

## Candidate package-local version 1

The object carries `version: 1` and these asynchronous methods:

- `prepare({title?})`: no effects. Resolve native reply metadata if present,
  verify its exact persisted active user prompt and required media, authorize
  the operation and inspect this conversation's capabilities. Return `ready`
  with opaque invocation-bound `ticket`, booleans `child`, `current`, `shared`,
  and `source: tip|reply`; or `blocked`/`pending`.
- `execute({ticket, placement: child|current})`: compose native forking and
  placement, revalidating authority at mutation time. The candidate reuses one
  prepared session for child-to-current fallback and clears successful tickets;
  durable crash/restart idempotency remains a live-proof requirement.
- `back()`: restore the prior binding/default selection using an owner-issued
  mutation fence, target session lifetime and current route observations. A
  child branch may return a verified link to its original conversation instead.
  No arbitrary historical-session navigation or blind `unbind` substitution.
- `status()`: inspect the latest recorded operation in this conversation without
  mutation, retrying, touching a lease, or submitting a prompt. A recorded success
  is historical evidence, not a fresh observation of the current conversation route.

## Result protocol

### Successful placement

`placed` requires `placement`, `returnReady: true`, `shared`, `source`, and
`replay: none|submitted`. A reply-selected fork submits the returned text prompt
once **after** binding. Media-bearing prompts currently return
`media_unavailable`. A tip fork must not start another model turn.

Child placement may include a verified transport-generated HTTPS
`destinationUrl` for the same audience. Telegram supergroup topics can generate
one; transports without a verified URL do not invent one. Current placement
returns a text `/fork --back` route.
Channel-native buttons remain an integration step, not proven UI in this preview.

### Fallback and uncertainty

`not_placed`, `effect: session_only`, with a bounded reason permits current-chat
placement using the same prepared fork session. `effect: none` also permits a
fresh safe fallback. Reuse the same ticket; the host must not create a duplicate
destination session.
After current placement, the same narrowly validated no-effect failure is terminal:
report a definite failure, without another fallback, replay, or reconciliation claim.

Timeouts, malformed receipts, partial creation, persistence errors and exceptions
are unconfirmed. Stop without blind fallback or replay. `pending` means the native
owner is reconciling the operation. `/fork --status` must not itself replay it.

`blocked` is strictly a pre-effect refusal. Known reasons are `unauthorized`,
`active_run`, `policy_disabled`, `reply_unavailable`, `media_unavailable`, and
`unsupported`. Never label an uncertain post-effect error as a no-change refusal.
Raw errors, identifiers, tickets and arbitrary reason strings are not shown in chat.

### Return and inspection

`returned` carries `mode: restored` with `shared`, or `mode: navigate` with a
verified HTTPS `destinationUrl`. Additional states are `idle`, `no_previous`,
`conflict`, `pending` and `blocked`. A Back call cannot return a fork success receipt.

Preserve the prior target and applicable lifecycle policy; refuse expired,
reset, deleted, conflicting or unauthorized targets instead of renewing them.
The existing owners need non-reusable observations: a session key, binding ID,
timestamp or full-record equality is not sufficient to detect replacement and
reset races. Nested return, restart survival and changes to configured default
routing must be covered before enabling this contract.

## Proof boundary

The plugin test suite injects this interface. It proves parsing, control flow,
result validation and safe failure messages—not native session transactions,
next-turn routing, durable return, channel capabilities or real buttons.

Native enablement is implemented as an exact-head candidate under the upstream
[design issue](https://github.com/openclaw/openclaw/issues/157627). The adapter
uses an admitted invocation-bound capability, not general Gateway privileges or
operator secrets. Live qualification is still pending.
