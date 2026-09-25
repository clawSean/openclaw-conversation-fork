import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

// Explicit opt-in: uses an existing host package, never installs or activates one.
// The subprocess has a disposable HOME/state/config and no inherited credentials.
const self = fileURLToPath(import.meta.url);
if (process.argv[2] !== "--isolated") {
  assert.ok(process.argv[2], "Usage: node scripts/probe-sdk.mjs <openclaw-package-root> [plugin-package-root]");
  const hostRoot = resolve(process.argv[2]);
  const pluginRoot = resolve(process.argv[3] ?? join(self, "../.."));
  const state = mkdtempSync(join(tmpdir(), "conversation-fork-sdk-"));
  try {
    const config = join(state, "openclaw.json");
    writeFileSync(config, "{}\n");
    const child = spawnSync(process.execPath, [self, "--isolated", hostRoot, pluginRoot], {
      env: {
        HOME: state,
        OPENCLAW_STATE_DIR: state,
        OPENCLAW_CONFIG_PATH: config,
        OPENCLAW_SKIP_CHANNELS: "1",
        NODE_ENV: "test",
        TMPDIR: state,
      },
      cwd: state,
      encoding: "utf8",
      timeout: 30_000,
    });
    process.stdout.write(child.stdout ?? "");
    process.stderr.write(child.stderr ?? "");
    if (child.error) throw child.error;
    assert.equal(child.status, 0, "Isolated SDK probe failed");
  } finally {
    // Only the disposable directory created by this invocation is removed.
    rmSync(state, { recursive: true, force: true });
  }
} else {
  const [, , , hostRoot, pluginRoot] = process.argv;
  const { syncBuiltinESMExports } = await import("node:module");
  const net = (await import("node:net")).default;
  const denied = () => { throw new Error("Network is disabled in the SDK probe"); };
  net.Socket.prototype.connect = denied;
  net.connect = denied;
  net.createConnection = denied;
  globalThis.fetch = denied;
  syncBuiltinESMExports();

  const hostPackage = JSON.parse(readFileSync(join(hostRoot, "package.json"), "utf8"));
  const exportPath = hostPackage.exports["./plugin-sdk/plugin-runtime"];
  const publicEntry = typeof exportPath === "string" ? exportPath : exportPath?.default ?? exportPath?.import;
  assert.equal(typeof publicEntry, "string", "Host lacks the documented public plugin-runtime SDK");
  const sdk = await import(pathToFileURL(resolve(hostRoot, publicEntry)).href);
  const nativeExport = hostPackage.exports["./plugin-sdk/plugin-command-runtime"];
  const nativeEntry = typeof nativeExport === "string" ? nativeExport : nativeExport?.default ?? nativeExport?.import;
  assert.equal(typeof nativeEntry, "string", "Host lacks the public native-command runtime SDK");
  const nativeSdk = await import(pathToFileURL(resolve(hostRoot, nativeEntry)).href);
  const plugin = (await import(pathToFileURL(join(pluginRoot, "src/index.js")).href)).default;
  const { HELP, UNAVAILABLE } = await import(pathToFileURL(join(pluginRoot, "src/command.js")).href);
  let assertions = 0;
  let handlerCalls = 0;
  sdk.clearPluginCommands();
  try {
    plugin.register({
      registerCommand(command) {
        const result = sdk.registerPluginCommand(plugin.id, {
          ...command,
          handler(context) { handlerCalls++; return command.handler(context); },
        }, { pluginName: plugin.name, pluginRoot });
        assert.equal(result.ok, true, result.error); assertions++;
      },
    });
    for (const channel of ["telegram", "discord"]) {
      for (const body of ["/fork", "/split", "/fork --back", "/fork --status", "/fork --help", "/fork --bad", "/fork tangent"]) {
        const selected = sdk.matchPluginCommand(body, { channel });
        assert.ok(selected, `SDK did not match ${body} on ${channel}`); assertions++;
        const result = await sdk.executePluginCommand({
          ...selected,
          channel,
          commandBody: body,
          config: {},
          accountId: "synthetic-account",
          senderId: "synthetic-sender",
          isAuthorizedSender: true,
        });
        const expected = body.endsWith("--help") ? HELP : body.endsWith("--bad") ? undefined : UNAVAILABLE;
        if (expected) assert.equal(result.text, expected);
        else assert.match(result.text, /Invalid arguments/);
        assert.notEqual(result.continueAgent, true);
        assert.notEqual(result.suppressReply, true);
        assertions += 3;
      }
      const selected = sdk.matchPluginCommand("/fork", { channel });
      const beforeDenial = handlerCalls;
      const deniedResult = await sdk.executePluginCommand({ ...selected, channel, commandBody: "/fork", config: {}, isAuthorizedSender: false });
      assert.match(deniedResult.text, /requires authorization/i);
      assert.equal(handlerCalls, beforeDenial, "SDK must refuse before entering the plugin handler"); assertions += 2;
      const native = nativeSdk.createPluginCommandRuntime().listNativeCandidates(channel);
      for (const name of ["fork", "split"]) {
        const candidate = native.find((entry) => entry.name === name);
        assert.ok(candidate, `Native catalog missing ${name}`);
        const dispatch = candidate.prepareDispatch("--status");
        assert.equal(dispatch.kind, "plugin");
        const nativeResult = await dispatch.execute({ channel, commandBody: `/${name} --status`, config: {}, isAuthorizedSender: true });
        assert.equal(nativeResult.text, UNAVAILABLE);
        const beforeNativeDenial = handlerCalls;
        const deniedNative = await dispatch.execute({ channel, commandBody: `/${name} --status`, config: {}, isAuthorizedSender: false });
        assert.match(deniedNative.text, /requires authorization/i);
        assert.equal(handlerCalls, beforeNativeDenial);
        assertions += 5;
      }
      for (const body of ["a sentence containing /fork", "/forked", "/splitter"]) {
        assert.equal(sdk.matchPluginCommand(body, { channel }), null); assertions++;
      }
    }
  } finally {
    sdk.clearPluginCommands();
  }
  console.log(JSON.stringify({
    proof: "installed public SDK registration, text dispatch, and native catalog dispatch",
    hostVersion: hostPackage.version,
    nodeVersion: process.version,
    assertions,
    channels: ["telegram", "discord"],
    result: "passed",
    nativeExecution: "not exercised: synthetic dispatch has no resolved conversation/session capability",
    limitations: "No plugin loader/install, live transport, session persistence, fork, routing, or return proof. Channel strings are dispatch inputs only.",
  }, null, 2));
}
