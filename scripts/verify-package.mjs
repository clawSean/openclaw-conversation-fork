import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
assert.ok(process.argv[2], "Usage: node scripts/verify-package.mjs <archive.tgz> [openclaw-package-root]");
const archive = resolve(process.argv[2]);
const expected = [
  "LICENSE", "README.md", "docs/host-contract.md", "docs/update-retest.md", "openclaw.plugin.json", "package.json",
  "src/command.js", "src/index.js", "src/native-host.js", "src/parse.js", "src/policy.js",
].sort();
const listing = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" }).trim().split("\n");
assert.deepEqual(listing.toSorted(), expected.map((file) => `package/${file}`).sort(), "Unexpected or missing archive entries");
const verbose = execFileSync("tar", ["-tvzf", archive], { encoding: "utf8" }).trim().split("\n");
assert.ok(verbose.every((line) => line.startsWith("-")), "Only regular files are allowed in this package");
const temp = mkdtempSync(join(tmpdir(), "conversation-fork-package-"));
try {
  execFileSync("tar", ["-xzf", archive, "-C", temp]);
  const unpacked = join(temp, "package");
  const hashes = {};
  for (const file of expected) {
    const bytes = readFileSync(join(unpacked, file));
    assert.deepEqual(bytes, readFileSync(join(root, file)), `Archive differs from canonical source: ${file}`);
    hashes[file] = createHash("sha256").update(bytes).digest("hex");
  }
  const pkg = JSON.parse(readFileSync(join(unpacked, "package.json"), "utf8"));
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);
  assert.equal(Object.keys(pkg.optionalDependencies ?? {}).length, 0);
  assert.deepEqual(pkg.openclaw.extensions, ["./src/index.js"]);
  const plugin = (await import(pathToFileURL(join(unpacked, "src/index.js")).href)).default;
  const { UNAVAILABLE } = await import(pathToFileURL(join(unpacked, "src/command.js")).href);
  const commands = [];
  plugin.register({ registerCommand(command) { commands.push(command); } });
  assert.deepEqual(commands.map((command) => command.name), ["fork", "split"]);
  for (const command of commands) {
    for (const args of [undefined, "--back", "--status"]) {
      const result = await command.handler({ isAuthorizedSender: true, channel: "synthetic", args });
      assert.equal(result.text, UNAVAILABLE);
      assert.notEqual(result.continueAgent, true);
    }
    const denied = await command.handler({ isAuthorizedSender: false, channel: "synthetic" });
    assert.match(denied.text, /not authorized/);
  }
  if (process.argv[3]) {
    const sdkProbe = spawnSync(process.execPath, [join(root, "scripts/probe-sdk.mjs"), resolve(process.argv[3]), unpacked], {
      encoding: "utf8", timeout: 45_000,
    });
    process.stdout.write(sdkProbe.stdout ?? "");
    process.stderr.write(sdkProbe.stderr ?? "");
    if (sdkProbe.error) throw sdkProbe.error;
    assert.equal(sdkProbe.status, 0, "Packaged SDK command probe failed");
  }
  console.log(JSON.stringify({
    proof: "exact offline npm archive contents, byte parity, dependency closure, and entry invocation",
    archiveSha256: createHash("sha256").update(readFileSync(archive)).digest("hex"),
    files: hashes,
    result: "passed",
    nativeExecution: "not exercised: direct package invocation has no resolved conversation/session capability",
    limitations: "No installation, loader discovery, live transport, fork, routing, or return proof. Native source proof is recorded separately.",
  }, null, 2));
} finally {
  // Remove only this invocation's disposable extraction, never the canonical tree.
  rmSync(temp, { recursive: true, force: true });
}
