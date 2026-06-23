import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const server = readFileSync(join(root, "server.py"), "utf8");

assert.match(server, /def build_environment_check\(\):/);
assert.match(server, /def run_environment_checks\(\):/);
assert.match(server, /def check_git_state\(\):/);
assert.match(server, /def check_project_files\(\):/);
assert.match(server, /def check_python_compile\(\):/);
assert.match(server, /def check_ue_sync_exports\(\):/);
assert.match(server, /def check_ue_sync_ignore\(\):/);
assert.match(server, /path == ["']\/api\/environment-check["']/);
assert.match(server, /json\.dumps\(build_environment_check\(\)/);
assert.match(server, /"status": status/);
assert.match(server, /"tools\/unreal\/sync_selected_static_mesh_rocks\.py"/);
assert.match(server, /"public\/src\/ue-rock-sync\.js"/);
assert.match(server, /"public\/ue-sync\/scene\.manifest\.json"/);
assert.match(server, /"public\/ue-sync\/semantic\.rules\.json"/);
assert.match(server, /"public\/ue-sync\/meshes\/\*\.glb"/);
assert.match(server, /"public\/ue-sync\/"/);
assert.match(server, /subprocess\.run/);
assert.doesNotMatch(server, /pip\s+install/);
assert.doesNotMatch(server, /sync_selected_static_mesh_rocks\(\)/);

const pythonScript = `
import importlib.util
import json
import pathlib

root = pathlib.Path(r"${root.replaceAll("\\", "/")}")
spec = importlib.util.spec_from_file_location("composition_server", root / "server.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
payload = module.build_environment_check()
print(json.dumps(payload))
`;

const { execFileSync } = await import("node:child_process");
const output = execFileSync("python", ["-c", pythonScript], {
  cwd: root,
  encoding: "utf8"
});
const payload = JSON.parse(output);

assert.equal(typeof payload.ok, "boolean");
assert.equal(typeof payload.summary, "string");
assert.ok(Array.isArray(payload.checks));
assert.ok(payload.checks.length >= 5);
assert.ok(payload.checks.every((check) => ["ok", "warning", "error"].includes(check.status)));
assert.ok(payload.checks.some((check) => check.id === "git-state"));
assert.ok(payload.checks.some((check) => check.id === "project-files"));
assert.ok(payload.checks.some((check) => check.id === "python-compile"));
assert.ok(payload.checks.some((check) => check.id === "ue-sync-exports"));
assert.ok(payload.checks.some((check) => check.id === "ue-sync-ignore"));
