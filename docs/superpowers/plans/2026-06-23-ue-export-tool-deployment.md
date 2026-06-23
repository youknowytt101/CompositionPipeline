# UE Export Tool Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a UE panel button that deploys the CompositionPipeline exporter into a selected Unreal project as a project-level Python plugin.

**Architecture:** `server.py` provides a narrow POST endpoint that validates a `.uproject` path and writes a generated plugin under that project's `Plugins/CompositionPipelineExporter/` directory. The browser UE panel collects the path, calls the endpoint, and renders deployment status. The deployed plugin registers a UE menu item that runs the exporter and writes output to this workspace's `public/ue-sync`.

**Tech Stack:** Python `http.server`, browser-native ES modules, Unreal Python Editor API, static Node-style `.mjs` tests, Python executable tests.

---

## File Structure

- Modify `server.py`: add JSON POST handling, deployment helpers, plugin template generation, and structured deploy responses.
- Modify `public/index.html`: add UE project path input, deploy button, and deployment result styles/markup inside the existing UE panel.
- Modify `public/src/editor.js`: query new DOM elements, call `/api/deploy-ue-export-tools`, and render deploy status.
- Modify `tools/unreal/sync_selected_static_mesh_rocks.py`: make the source exporter's default output root derive from `COMPOSITION_PIPELINE_UE_SYNC_DIR` with the current tracked fallback preserved until tests are updated.
- Modify `tests/environment-check.test.mjs`: assert server deployment helpers and endpoint exist, and run executable path-validation checks.
- Modify `tests/editor-architecture.test.mjs`: assert UE deploy UI and frontend endpoint wiring.
- Modify `tests/unreal-export-script.test.mjs`: assert the exporter supports `COMPOSITION_PIPELINE_UE_SYNC_DIR`.

## Task 1: Server Deployment Endpoint

**Files:**
- Modify: `server.py`
- Test: `tests/environment-check.test.mjs`

- [ ] **Step 1: Add failing server tests**

Append tests that assert `server.py` contains:

```javascript
assert.match(server, /def build_ue_export_plugin_files\(/);
assert.match(server, /def deploy_ue_export_tools\(/);
assert.match(server, /def do_POST\(self\):/);
assert.match(server, /path == ["']\/api\/deploy-ue-export-tools["']/);
assert.match(server, /Plugins\\s*\/\\s*["']CompositionPipelineExporter["']/);
assert.match(server, /CompositionPipelineExporter\.uplugin/);
assert.match(server, /init_unreal\.py/);
```

Add an executable Python check that creates a temporary `.uproject`, calls `deploy_ue_export_tools`, and verifies:

```python
payload = module.deploy_ue_export_tools(str(uproject))
assert payload["ok"] is True
plugin_dir = project / "Plugins" / "CompositionPipelineExporter"
assert (plugin_dir / "CompositionPipelineExporter.uplugin").exists()
assert (plugin_dir / "Content" / "Python" / "init_unreal.py").exists()
assert (plugin_dir / "Content" / "Python" / "sync_selected_static_mesh_rocks.py").exists()
assert str(module.PUBLIC_DIR / "ue-sync").replace("\\\\", "/") in (plugin_dir / "Content" / "Python" / "sync_selected_static_mesh_rocks.py").read_text(encoding="utf-8")
```

Expected first run: FAIL because the deployment helpers do not exist.

- [ ] **Step 2: Implement minimal server helpers**

In `server.py`, add:

```python
def build_ue_export_plugin_files(output_root):
    normalized_output = str(output_root).replace("\\", "/")
    exporter_source = (ROOT / "tools" / "unreal" / "sync_selected_static_mesh_rocks.py").read_text(encoding="utf-8")
    exporter_source = re.sub(
        r'OUTPUT_ROOT\s*=\s*Path\(r["\'][^"\']+["\']\)',
        f'OUTPUT_ROOT = Path(r"{normalized_output}")',
        exporter_source,
        count=1,
    )
    return {
        "CompositionPipelineExporter.uplugin": json.dumps({
            "FileVersion": 3,
            "Version": 1,
            "VersionName": "1.0.0",
            "FriendlyName": "Composition Pipeline Exporter",
            "Description": "Exports selected Unreal scene proxies for CompositionPipeline.",
            "Category": "Editor",
            "CanContainContent": True,
            "EnabledByDefault": True,
            "Modules": []
        }, indent=2) + "\n",
        "Content/Python/init_unreal.py": INIT_UNREAL_TEMPLATE,
        "Content/Python/sync_selected_static_mesh_rocks.py": exporter_source,
    }
```

Also add `INIT_UNREAL_TEMPLATE`, `make_deploy_check`, `deploy_ue_export_tools(uproject_path)`, and `do_POST`.

- [ ] **Step 3: Run server tests**

Run:

```powershell
node tests/environment-check.test.mjs
python -m py_compile server.py
```

Expected: PASS.

## Task 2: UE Panel Markup

**Files:**
- Modify: `public/index.html`
- Test: `tests/editor-architecture.test.mjs`

- [ ] **Step 1: Add failing markup tests**

Add assertions:

```javascript
assert.match(index, /id="ue-project-path-input"/);
assert.match(index, /id="deploy-ue-export-tools-button"/);
assert.match(index, />Deploy UE Export Tools</);
assert.match(index, /id="ue-export-deploy-status"/);
assert.match(index, /id="ue-export-deploy-results"/);
```

Expected first run: FAIL because the UI does not exist.

- [ ] **Step 2: Add markup and styles**

Inside the UE panel after `local-setup-check-button`, add:

```html
<label class="ue-project-path-field">
  <span>UE Project</span>
  <input id="ue-project-path-input" class="ue-project-path-input" type="text" placeholder="D:\Path\Project.uproject" autocomplete="off" />
</label>
<button id="deploy-ue-export-tools-button" class="ue-rock-sync-button" type="button" data-deploy-ue-export-tools>
  Deploy UE Export Tools
</button>
<div id="ue-export-deploy-status" class="ue-rock-sync-status">Exporter tools are not deployed yet</div>
<div id="ue-export-deploy-results" class="local-setup-check-results" hidden></div>
```

Add compact dark-panel styles for `.ue-project-path-field` and `.ue-project-path-input`.

- [ ] **Step 3: Run markup tests**

Run:

```powershell
node tests/editor-architecture.test.mjs
```

Expected: PASS for the new assertions.

## Task 3: Frontend Deployment Controller

**Files:**
- Modify: `public/src/editor.js`
- Test: `tests/editor-architecture.test.mjs`

- [ ] **Step 1: Add failing frontend tests**

Add assertions:

```javascript
assert.match(editor, /const\s+ueProjectPathInput\s*=\s*document\.querySelector\(\s*["']#ue-project-path-input["']\s*\)/);
assert.match(editor, /const\s+deployUeExportToolsButton\s*=\s*document\.querySelector\(\s*["']#deploy-ue-export-tools-button["']\s*\)/);
assert.match(editor, /async\s+function\s+deployUeExportTools\(\)/);
assert.match(editor, /fetch\(\s*["']\/api\/deploy-ue-export-tools["'][\s\S]*method:\s*["']POST["']/);
assert.match(editor, /deployUeExportToolsButton\?\.addEventListener\(\s*["']click["'],\s*deployUeExportTools\)/);
```

Expected first run: FAIL because the controller does not exist.

- [ ] **Step 2: Implement UI behavior**

Add DOM queries near existing UE setup queries. Reuse local setup rendering helpers where possible. Implement:

```javascript
function setUeExportDeployBusy(busy) {
  if (deployUeExportToolsButton) {
    deployUeExportToolsButton.disabled = busy;
    deployUeExportToolsButton.textContent = busy ? "Deploying..." : "Deploy UE Export Tools";
  }
}

function renderUeExportDeployResult(payload) {
  if (ueExportDeployStatus) {
    ueExportDeployStatus.textContent = payload.summary || "UE export tool deployment finished";
  }
  if (ueExportDeployResults) {
    ueExportDeployResults.hidden = false;
    ueExportDeployResults.replaceChildren(...(payload.checks || []).map(createLocalSetupCheckItem));
  }
}

async function deployUeExportTools() {
  setUeExportDeployBusy(true);
  try {
    const response = await fetch("/api/deploy-ue-export-tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uprojectPath: ueProjectPathInput?.value || "" })
    });
    const payload = await response.json();
    renderUeExportDeployResult(payload);
  } catch (error) {
    renderUeExportDeployResult({
      ok: false,
      summary: "UE export tool deployment failed",
      checks: [{ id: "deploy-error", label: "Deployment", status: "error", message: error.message || `${error}` }]
    });
  } finally {
    setUeExportDeployBusy(false);
  }
}
```

Wire `deployUeExportToolsButton?.addEventListener("click", deployUeExportTools);`.

- [ ] **Step 3: Run frontend tests**

Run:

```powershell
node tests/editor-architecture.test.mjs
```

Expected: PASS.

## Task 4: Exporter Path Override

**Files:**
- Modify: `tools/unreal/sync_selected_static_mesh_rocks.py`
- Test: `tests/unreal-export-script.test.mjs`

- [ ] **Step 1: Add failing exporter tests**

Change the old hard-coded output assertion to require:

```javascript
assert.match(script, /import\s+os/);
assert.match(script, /DEFAULT_OUTPUT_ROOT\s*=\s*Path\(r["']D:\/CompositionPipeline\/public\/ue-sync["']\)/);
assert.match(script, /OUTPUT_ROOT\s*=\s*Path\(os\.environ\.get\(["']COMPOSITION_PIPELINE_UE_SYNC_DIR["'],\s*str\(DEFAULT_OUTPUT_ROOT\)\)\)/);
```

Expected first run: FAIL because the source script does not support an env override.

- [ ] **Step 2: Implement path override**

At the top of the exporter:

```python
import os
```

Replace:

```python
OUTPUT_ROOT = Path(r"D:/CompositionPipeline/public/ue-sync")
```

with:

```python
DEFAULT_OUTPUT_ROOT = Path(r"D:/CompositionPipeline/public/ue-sync")
OUTPUT_ROOT = Path(os.environ.get("COMPOSITION_PIPELINE_UE_SYNC_DIR", str(DEFAULT_OUTPUT_ROOT)))
```

Keep deployment patching focused on the generated plugin copy so the installed plugin points to the active workspace.

- [ ] **Step 3: Run exporter tests**

Run:

```powershell
node tests/unreal-export-script.test.mjs
python -m py_compile tools\unreal\sync_selected_static_mesh_rocks.py
```

Expected: PASS.

## Task 5: Browser Verification

**Files:**
- Verify: `public/index.html`, `public/src/editor.js`, `server.py`

- [ ] **Step 1: Restart or reuse local server**

Run:

```powershell
python server.py
```

Expected: local app available at `http://localhost:5173`.

- [ ] **Step 2: Verify UI in browser**

Open `http://localhost:5173`, switch to the UE tab, and confirm:

- `Deploy UE Export Tools` appears below `Check Local Setup`.
- The `.uproject` path input appears above the deploy button.
- Clicking with an empty path displays a structured error.

- [ ] **Step 3: Verify deployment with a temporary project**

Create a temporary folder with `TempProject.uproject`, paste that path into the UI, click deploy, and confirm the plugin folder is created with three files.

Expected plugin files:

```text
Plugins/CompositionPipelineExporter/CompositionPipelineExporter.uplugin
Plugins/CompositionPipelineExporter/Content/Python/init_unreal.py
Plugins/CompositionPipelineExporter/Content/Python/sync_selected_static_mesh_rocks.py
```

## Task 6: Final Verification

**Files:**
- Verify all changed files

- [ ] **Step 1: Run all available tests**

Run:

```powershell
node tests/environment-check.test.mjs
node tests/editor-architecture.test.mjs
node tests/ue-rock-sync.test.mjs
node tests/unreal-export-script.test.mjs
node tests/play-mode-controls.test.mjs
python -m py_compile server.py tools\unreal\sync_selected_static_mesh_rocks.py
```

Expected: PASS.

- [ ] **Step 2: Review diff**

Run:

```powershell
git diff -- server.py public/index.html public/src/editor.js tools/unreal/sync_selected_static_mesh_rocks.py tests/environment-check.test.mjs tests/editor-architecture.test.mjs tests/unreal-export-script.test.mjs
```

Expected: changes are limited to deployment feature, tests, and docs.

## Self-Review

- Spec coverage: The plan covers UI, server deployment, generated plugin files, output path configuration, error handling, and verification.
- Placeholder scan: No `TBD`, `TODO`, or unbounded implementation steps remain.
- Type consistency: The endpoint is consistently named `/api/deploy-ue-export-tools`, the request field is `uprojectPath`, and the plugin is consistently named `CompositionPipelineExporter`.
