import test from "node:test";
import assert from "node:assert/strict";
import plugin from "../src/index.js";
import { parseArguments } from "../src/parse.js";
import { createCommandHandler, renderResult, HELP, UNAVAILABLE, UNCONFIRMED } from "../src/command.js";
import { forkWithHost, destinationUrl, canFallback } from "../src/policy.js";

const context = (args, extra = {}) => ({ isAuthorizedSender: true, channel: "fixture", args, ...extra });
const ready = (extra = {}) => ({ status: "ready", ticket: "opaque-fixture-ticket", child: true, current: true, shared: false, source: "tip", ...extra });
const placed = (extra = {}) => ({ status: "placed", placement: "child", returnReady: true, shared: false, source: "tip", replay: "none", destinationUrl: "https://example.test/thread/123", ...extra });
function fixture({ plan = ready(), results = [placed()], back = { status: "no_previous" }, status = { status: "idle" } } = {}) {
  const calls = [];
  let index = 0;
  const host = {
    version: 1,
    async prepare(input) { calls.push(["prepare", input]); return plan; },
    async execute(input) { calls.push(["execute", input]); const value = results[index++]; if (value instanceof Error) throw value; return value; },
    async back() { calls.push(["back"]); return back; },
    async status() { calls.push(["status"]); return status; },
  };
  return { calls, host, handle: createCommandHandler({ resolveHost: () => host }) };
}

for (const args of [undefined, "", " \t\n"]) test(`empty arguments fork (${JSON.stringify(args)})`, () => assert.deepEqual(parseArguments(args), { kind: "fork" }));
for (const [args, kind] of [["--help", "help"], [" --back ", "back"], ["--status", "status"]]) test(`exact control ${kind}`, () => assert.deepEqual(parseArguments(args), { kind }));
for (const value of [null, false, {}, 1, "--wat", "--back title", "title --back", "--", "--help --back", "\u0000", "test\u202efake", "\u200b", "a".repeat(101), " ".repeat(2049), "\ud800"]) {
  test(`invalid arguments ${JSON.stringify(value).slice(0, 55)}`, () => assert.deepEqual(parseArguments(value), { kind: "invalid" }));
}
test("title NFC/whitespace normalization", () => assert.deepEqual(parseArguments(" cafe\u0301\n  choice "), { kind: "fork", title: "café choice" }));
test("emoji limit counts codepoints", () => { assert.equal(parseArguments("🦞".repeat(100)).kind, "fork"); assert.equal(parseArguments("🦞".repeat(101)).kind, "invalid"); });
test("literal option title requires separator", () => assert.deepEqual(parseArguments("-- --back"), { kind: "fork", title: "--back" }));
test("inline hyphens remain a title", () => assert.deepEqual(parseArguments("state--machine"), { kind: "fork", title: "state--machine" }));

for (const auth of [false, undefined, "true", 1]) test(`auth fails closed (${String(auth)})`, async () => {
  let calls = 0;
  const handle = createCommandHandler({ resolveHost: () => { calls++; throw new Error("must not run"); } });
  assert.match((await handle(context("--back", { isAuthorizedSender: auth }))).text, /not authorized/);
  assert.equal(calls, 0);
});
for (const args of ["--help", "--oops"]) test(`${args} never resolves host`, async () => {
  let calls = 0;
  const result = await createCommandHandler({ resolveHost: () => { calls++; } })(context(args));
  assert.equal(calls, 0); assert.equal(typeof result.text, "string");
});
for (const host of [undefined, {}, { version: 2 }, { version: 1, prepare() {} }]) test(`incompatible host ${JSON.stringify(host)}`, async () => {
  assert.equal((await createCommandHandler({ resolveHost: () => host })(context())).text, UNAVAILABLE);
});
test("registered production commands use only the invocation-bound fork capability", async () => {
  const commands = []; plugin.register({ registerCommand: (command) => commands.push(command) });
  assert.deepEqual(commands.map((c) => c.name), ["fork", "split"]);
  for (const command of commands) {
    assert.equal(command.requireAuth, true); assert.equal(command.acceptsArgs, true); assert.equal(command.channels, undefined);
    for (const args of [undefined, "a title", "--back", "--status"]) {
      const ctx = context(args);
      ctx.runtimeContext = {};
      assert.equal((await command.handler(ctx)).text, UNAVAILABLE);
    }
    assert.equal((await command.handler(context("--help"))).text, HELP);
  }
});
test("prefer child without a current switch", async () => {
  const f = fixture(); assert.equal((await forkWithHost(f.host, "tangent")).placement, "child");
  assert.deepEqual(f.calls, [["prepare", { title: "tangent" }], ["execute", { ticket: "opaque-fixture-ticket", placement: "child" }]]);
});
test("supported flat chat goes straight to current", async () => {
  const f = fixture({ plan: ready({ child: false }), results: [placed({ placement: "current" })] });
  assert.match((await f.handle(context())).text, /Forked in this conversation/);
  assert.equal(f.calls[1][1].placement, "current"); assert.equal(f.calls.length, 2);
});
test("unsupported placements never fork", async () => {
  const f = fixture({ plan: ready({ child: false, current: false }) });
  assert.equal((await forkWithHost(f.host)).status, "unsupported"); assert.equal(f.calls.length, 1);
});
for (const reason of ["unsupported", "permission_denied", "creation_failed"]) test(`definite no-effect fallback: ${reason}`, async () => {
  const f = fixture({ results: [{ status: "not_placed", effect: "none", reason }, placed({ placement: "current" })] });
  const result = await forkWithHost(f.host); assert.equal(result.fallbackReason, reason);
  assert.deepEqual(f.calls.slice(1).map((c) => c[1]), [{ ticket: "opaque-fixture-ticket", placement: "child" }, { ticket: "opaque-fixture-ticket", placement: "current" }]);
});
test("a session-only child failure reuses the same prepared fork for current placement", async () => {
  const f = fixture({ results: [{ status: "not_placed", effect: "session_only", reason: "creation_failed" }, placed({ placement: "current" })] });
  const result = await forkWithHost(f.host); assert.equal(result.fallbackReason, "creation_failed");
  assert.equal(f.calls.length, 3);
});
for (const result of [null, {}, { status: "pending" }, { status: "not_placed", reason: "unsupported" }, { status: "not_placed", effect: "partial", reason: "creation_failed" }, { status: "not_placed", effect: "none", reason: "timeout" }, new Error("secret-data"), placed({ returnReady: false }), placed({ shared: true }), placed({ replay: "submitted" }), placed({ placement: "current" })]) {
  test(`never blindly fallback from ${JSON.stringify(result)}`, async () => {
    const f = fixture({ results: [result, placed({ placement: "current" })] });
    const response = await f.handle(context()); assert.doesNotMatch(response.text, /Forked in this conversation|Fork created/);
    assert.equal(f.calls.length, 2); assert.equal(canFallback(result), false);
  });
}
test("child blocked admission stays a definite refusal", async () => {
  const f = fixture({ results: [{ status: "blocked", reason: "active_run" }] });
  assert.match((await f.handle(context())).text, /active run/); assert.equal(f.calls.length, 2);
});
test("no fallback when current is unavailable", async () => {
  const f = fixture({ plan: ready({ current: false }), results: [{ status: "not_placed", effect: "none", reason: "permission_denied" }] });
  assert.equal((await forkWithHost(f.host)).status, "unsupported"); assert.equal(f.calls.length, 2);
});
for (const patch of [{ ticket: "" }, { ticket: 1 }, { source: "assistant" }, { child: undefined }, { current: "true" }, { shared: undefined }]) {
  test(`invalid preparation ${JSON.stringify(patch)}`, async () => {
    const f = fixture({ plan: ready(patch) }); assert.equal((await forkWithHost(f.host)).status, "unconfirmed"); assert.equal(f.calls.length, 1);
  });
}
for (const reason of ["unauthorized", "active_run", "policy_disabled", "reply_unavailable", "media_unavailable", "unsupported"]) test(`preflight refusal: ${reason}`, async () => {
  const f = fixture({ plan: { status: "blocked", reason } });
  assert.doesNotMatch((await f.handle(context())).text, /Fork created|Forked in this conversation/); assert.equal(f.calls.length, 1);
});
test("prepared pending operation does not execute again", async () => {
  const f = fixture({ plan: { status: "pending" } }); assert.match((await f.handle(context())).text, /reconciling/); assert.equal(f.calls.length, 1);
});
test("reply success requires one host-confirmed submission", async () => {
  const f = fixture({ plan: ready({ source: "reply" }), results: [placed({ source: "reply", replay: "submitted" })] });
  assert.match((await f.handle(context())).text, /submitted once/);
});
test("missing replay admission cannot claim success", async () => {
  const f = fixture({ plan: ready({ source: "reply" }), results: [placed({ source: "reply" })] });
  assert.equal((await f.handle(context())).text, UNCONFIRMED); assert.equal(f.calls.length, 2);
});
test("shared in-place switch is visibly shared", async () => {
  const f = fixture({ plan: ready({ child: false, shared: true }), results: [placed({ placement: "current", shared: true })] });
  const result = await f.handle(context()); assert.match(result.text, /shared conversation/); assert.match(result.text, /\/fork --back/);
});
test("child success links branch without telling source chat to unbind", async () => {
  const result = await fixture().handle(context()); assert.match(result.text, /Open branch/); assert.doesNotMatch(result.text, /Return:|unbind/);
});
for (const [back, phrase] of [[{ status: "returned", mode: "restored", shared: true }, /previous conversation route/], [{ status: "returned", mode: "navigate", destinationUrl: "https://example.test/original" }, /Open previous branch/], [{ status: "no_previous" }, /No previous/], [{ status: "conflict" }, /refused/], [{ status: "pending" }, /reconciling/]]) {
  test(`back result ${back.status}/${back.mode}`, async () => {
    const f = fixture({ back }); assert.match((await f.handle(context("--back"))).text, phrase); assert.deepEqual(f.calls, [["back"]]);
  });
}
test("back refuses a misplaced fork success receipt", async () => {
  const f = fixture({ back: placed() }); assert.equal((await f.handle(context("--back"))).text, UNCONFIRMED);
});
test("status reads only, never prepares or retries", async () => {
  const f = fixture({ status: { status: "pending" } }); assert.match((await f.handle(context("--status"))).text, /reconciling/); assert.deepEqual(f.calls, [["status"]]);
});
for (const status of [placed(), placed({ placement: "current", shared: true }), { status: "returned", mode: "restored", shared: true }, { status: "returned", mode: "navigate", destinationUrl: "https://example.test/original" }, { status: "blocked", reason: "active_run" }]) {
  test(`status labels historical ${status.status}/${status.placement ?? status.mode ?? status.reason}`, async () => {
    const f = fixture({ status }); const result = await f.handle(context("--status"));
    assert.match(result.text, /Read-only/); assert.match(result.text, /recorded/);
    assert.match(result.text, /not.*current route/);
    assert.doesNotMatch(result.text, /Fork created|This switches|This restores|Return:/);
    assert.deepEqual(f.calls, [["status"]]);
  });
}
for (const child of [false, true]) {
  test(`definite current failure stays definite (child=${child})`, async () => {
    const failure = { status: "not_placed", effect: "none", reason: "creation_failed" };
    const f = fixture({ plan: ready({ child }), results: child ? [failure, failure] : [failure] });
    const result = await f.handle(context());
    assert.match(result.text, /could not be placed/); assert.match(result.text, /confirmed no/);
    assert.doesNotMatch(result.text, /unconfirmed|reconciling|Fork created|Forked in/);
    assert.equal(f.calls.length, child ? 3 : 2);
  });
}
test("partial current failure remains unconfirmed with no retry", async () => {
  const f = fixture({ plan: ready({ child: false }), results: [{ status: "not_placed", effect: "partial", reason: "creation_failed" }] });
  assert.equal((await f.handle(context())).text, UNCONFIRMED); assert.equal(f.calls.length, 2);
});
test("exceptions and unknown reasons do not echo details", async () => {
  const handle = createCommandHandler({ resolveHost: () => { throw new Error("credential:secret-token path:/private/state"); } });
  assert.equal((await handle(context())).text, UNCONFIRMED);
  assert.doesNotMatch(renderResult({ status: "blocked", reason: "secret-token" }), /secret-token/);
  assert.equal(typeof renderResult({ status: "blocked", reason: "__proto__" }), "string");
});
for (const url of ["http://example.test", "javascript:alert(1)", "file:///tmp/a", "https://u:password@example.test/", "https://example.test/\nlink", "https://example.test/<b>", "https://example.test/\\x", "https://example.test/\u0000", undefined, "https://example.test/" + "x".repeat(2048)]) {
  test(`reject unsafe URL ${JSON.stringify(url)?.slice(0, 60)}`, () => assert.equal(destinationUrl(url), undefined));
}
test("URL parentheses cannot escape Markdown link", () => assert.equal(destinationUrl("https://example.test/(branch)"), "https://example.test/%28branch%29"));
for (const result of [null, {}, placed({ returnReady: false }), placed({ shared: undefined }), placed({ replay: "bad" }), placed({ placement: "unknown" }), { status: "returned", mode: "restored" }, { status: "returned", mode: "navigate", destinationUrl: "http://bad.test" }]) {
  test(`invalid render receipt ${JSON.stringify(result)}`, () => assert.equal(renderResult(result), UNCONFIRMED));
}
