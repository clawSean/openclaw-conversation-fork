import { readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const manifest = JSON.parse(readFileSync("openclaw.plugin.json", "utf8"));
const plugin = (await import("../src/index.js")).default;
assert.equal(manifest.id, plugin.id);
assert.equal(pkg.version, manifest.version);
assert.equal(manifest.activation.onStartup, true);
assert.equal(manifest.configSchema.additionalProperties, false);
assert.deepEqual(pkg.openclaw.extensions, ["./src/index.js"]);
for (const directory of ["src", "test", "scripts"]) {
  for (const name of readdirSync(directory)) {
    const path = `${directory}/${name}`;
    if (!statSync(path).isFile() || !/\.m?js$/u.test(name)) continue;
    const result = spawnSync(process.execPath, ["--check", path], { stdio: "inherit" });
    assert.equal(result.status, 0, `Syntax check failed: ${path}`);
  }
}
console.log("Manifest, entry, version, and syntax checks passed.");
