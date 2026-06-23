import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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
assert.match(server, /def make_deploy_check\(/);
assert.match(server, /def build_ue_export_plugin_files\(/);
assert.match(server, /def deploy_ue_export_tools\(/);
assert.match(server, /def do_POST\(self\):/);
assert.match(server, /path == ["']\/api\/environment-check["']/);
assert.match(server, /path == ["']\/api\/deploy-ue-export-tools["']/);
assert.match(server, /json\.dumps\(build_environment_check\(\)/);
assert.match(server, /deploy_ue_export_tools\(payload\.get\(["']uprojectPath["']\)\)/);
assert.match(server, /self\.send_json\(200,\s*result\)/);
assert.match(server, /"status": status/);
assert.match(server, /"tools\/unreal\/sync_selected_static_mesh_rocks\.py"/);
assert.match(server, /"public\/src\/ue-rock-sync\.js"/);
assert.match(server, /"public\/ue-sync\/scene\.manifest\.json"/);
assert.match(server, /"public\/ue-sync\/semantic\.rules\.json"/);
assert.match(server, /"public\/ue-sync\/meshes\/\*\.glb"/);
assert.match(server, /"public\/ue-sync\/"/);
assert.match(server, /project_dir\s*\/\s*["']Plugins["']\s*\/\s*["']CompositionPipelineExporter["']/);
assert.match(server, /CompositionPipelineExporter\.uplugin/);
assert.match(server, /init_unreal\.py/);
assert.match(server, /subprocess\.run/);
assert.doesNotMatch(server, /pip\s+install/);
assert.doesNotMatch(server, /if path == ["']\/api\/environment-check["'][\s\S]{0,240}sync_selected_static_mesh_rocks\(\)/);

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

const tempRoot = mkdtempSync(join(tmpdir(), "composition-pipeline-ue-project-"));
try {
  const projectDir = join(tempRoot, "ExampleProject");
  const uproject = join(projectDir, "ExampleProject.uproject");

  await import("node:fs").then(({ mkdirSync, writeFileSync }) => {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(uproject, "{\"FileVersion\":3}\n", "utf8");
  });

  const deployScript = `
import importlib.util
import json
import pathlib

root = pathlib.Path(r"${root.replaceAll("\\", "/")}")
uproject = pathlib.Path(r"${uproject.replaceAll("\\", "/")}")
spec = importlib.util.spec_from_file_location("composition_server", root / "server.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
payload = module.deploy_ue_export_tools(str(uproject))
print(json.dumps(payload))
`;

  const deployOutput = execFileSync("python", ["-c", deployScript], {
    cwd: root,
    encoding: "utf8"
  });
  const deployPayload = JSON.parse(deployOutput);
  const pluginDir = join(projectDir, "Plugins", "CompositionPipelineExporter");
  const initPath = join(pluginDir, "Content", "Python", "init_unreal.py");
  const configPath = join(pluginDir, "Content", "Python", "composition_pipeline_config.json");
  const exporterPath = join(pluginDir, "Content", "Python", "sync_selected_static_mesh_rocks.py");

  assert.equal(deployPayload.ok, true);
  assert.ok(existsSync(join(pluginDir, "CompositionPipelineExporter.uplugin")));
  assert.ok(existsSync(initPath));
  assert.ok(existsSync(configPath));
  assert.ok(existsSync(exporterPath));
  assert.match(readFileSync(initPath, "utf8"), /spec_from_file_location\("composition_pipeline_exporter_runtime"/);
  assert.doesNotMatch(readFileSync(initPath, "utf8"), /importlib\.reload\(sync_selected_static_mesh_rocks\)/);
  assert.equal(JSON.parse(readFileSync(configPath, "utf8")).outputRoot, "E:/CompositionPipeline/public/ue-sync");
  assert.match(readFileSync(exporterPath, "utf8"), /load_output_root\(\)/);
  assert.doesNotMatch(readFileSync(exporterPath, "utf8"), /D:\/CompositionPipeline\/public\/ue-sync/);
  assert.ok(deployPayload.checks.some((check) => check.id === "plugin-files"));

  const invalidScript = `
import importlib.util
import json
import pathlib

root = pathlib.Path(r"${root.replaceAll("\\", "/")}")
spec = importlib.util.spec_from_file_location("composition_server", root / "server.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
payload = module.deploy_ue_export_tools("")
print(json.dumps(payload))
`;
  const invalidOutput = execFileSync("python", ["-c", invalidScript], {
    cwd: root,
    encoding: "utf8"
  });
  const invalidPayload = JSON.parse(invalidOutput);

  assert.equal(invalidPayload.ok, false);
  assert.ok(invalidPayload.checks.some((check) => check.status === "error"));
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
