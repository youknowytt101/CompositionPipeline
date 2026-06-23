# Local Setup Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a UE-panel `Check Local Setup` button that calls a read-only server endpoint and shows whether the current machine is ready for the project workflow.

**Architecture:** `server.py` owns machine-local checks and returns structured JSON at `/api/environment-check`. `public/index.html` owns the UE panel markup and result container. `public/src/editor.js` triggers the endpoint, renders compact statuses, and keeps the workflow diagnostic-only.

**Tech Stack:** Python `http.server`, browser-native ES modules, static Node-style `.mjs` tests run through Codex Node REPL, and in-app browser verification at `http://localhost:5173/?right-handle-test=1`.

## Global Constraints

- The feature must not install software.
- The feature must not change system settings.
- The feature must not run Unreal.
- The feature must not copy large scene data automatically.
- The server endpoint must be read-only.
- Missing `public/ue-sync/` data is a warning because that directory is intentionally ignored by Git.
- Python compile failure is an error.
- The UI stays inside the existing UE panel.

---

## File Structure

- Modify `server.py`: add reusable environment-check helpers and route `/api/environment-check`.
- Modify `public/index.html`: add `Check Local Setup` button, result container, and compact status styles.
- Modify `public/src/editor.js`: query new elements, call `/api/environment-check`, render status rows, and handle request failure.
- Modify `tests/editor-architecture.test.mjs`: add static checks for markup and frontend wiring.
- Create `tests/environment-check.test.mjs`: static and live-ish Python checks for the endpoint contract without starting a long-running server.

## Task 1: Add Failing Environment Check Tests

**Files:**
- Create: `tests/environment-check.test.mjs`
- Modify: `tests/editor-architecture.test.mjs`

**Interfaces:**
- Consumes: `server.py` text and Python import path.
- Produces expected Python functions: `build_environment_check() -> dict`, `run_environment_checks() -> list[dict]`, `check_git_state() -> dict`, `check_project_files() -> dict`, `check_python_compile() -> dict`, `check_ue_sync_exports() -> dict`, `check_ue_sync_ignore() -> dict`.

- [ ] **Step 1: Write failing server contract test**

Create `tests/environment-check.test.mjs`:

```js
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
assert.match(server, /"status": "ok"/);
assert.match(server, /"status": "warning"/);
assert.match(server, /"status": "error"/);
assert.match(server, /"tools\/unreal\/sync_selected_static_mesh_rocks\.py"/);
assert.match(server, /"public\/src\/ue-rock-sync\.js"/);
assert.match(server, /"public\/ue-sync\/scene\.manifest\.json"/);
assert.match(server, /"public\/ue-sync\/semantic\.rules\.json"/);
assert.match(server, /"public\/ue-sync\/meshes"/);
assert.match(server, /"public\/ue-sync\/"/);
assert.match(server, /subprocess\.run/);
assert.doesNotMatch(server, /pip\s+install/);
assert.doesNotMatch(server, /sync_selected_static_mesh_rocks\(\)/);
```

- [ ] **Step 2: Add failing Python behavior smoke test**

Append to `tests/environment-check.test.mjs`:

```js
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
```

- [ ] **Step 3: Add failing editor architecture checks**

Append to `tests/editor-architecture.test.mjs` near existing UE panel checks:

```js
assert.match(index, /id="local-setup-check-button"/);
assert.match(index, /data-local-setup-check/);
assert.match(index, />Check Local Setup<\/button>/);
assert.match(index, /id="local-setup-check-status"/);
assert.match(index, /id="local-setup-check-results"/);
assert.match(index, /class="local-setup-check-results"/);
assert.match(index, /\.local-setup-check-item/);
assert.match(index, /\.local-setup-check-item\.is-ok/);
assert.match(index, /\.local-setup-check-item\.is-warning/);
assert.match(index, /\.local-setup-check-item\.is-error/);

assert.match(editor, /const\s+localSetupCheckButton\s*=\s*document\.querySelector\(\s*["']#local-setup-check-button["']\s*\)/);
assert.match(editor, /const\s+localSetupCheckStatus\s*=\s*document\.querySelector\(\s*["']#local-setup-check-status["']\s*\)/);
assert.match(editor, /const\s+localSetupCheckResults\s*=\s*document\.querySelector\(\s*["']#local-setup-check-results["']\s*\)/);
assert.match(editor, /async\s+function\s+runLocalSetupCheck\(\)/);
assert.match(editor, /fetch\(\s*["']\/api\/environment-check["']/);
assert.match(editor, /function\s+renderLocalSetupChecks\(payload\)/);
assert.match(editor, /function\s+renderLocalSetupCheckFailure\(error\)/);
assert.match(editor, /localSetupCheckButton\?\.addEventListener\(\s*["']click["'],\s*runLocalSetupCheck\)/);
```

- [ ] **Step 4: Run RED verification**

Run through Codex Node REPL:

```js
for (const test of [
  "file:///D:/CompositionPipeline/tests/environment-check.test.mjs",
  "file:///D:/CompositionPipeline/tests/editor-architecture.test.mjs"
]) {
  await import(`${test}?red=${Date.now()}-${Math.random()}`);
}
```

Expected: import fails because the server endpoint and UI wiring do not exist yet.

## Task 2: Implement Read-Only Server Environment Check

**Files:**
- Modify: `server.py`
- Test: `tests/environment-check.test.mjs`

**Interfaces:**
- Produces: `build_environment_check() -> dict` with keys `ok`, `summary`, `checks`.
- Produces: check records with keys `id`, `label`, `status`, `message`, optional `details`, optional `command`.
- Consumes: project root constants `ROOT` and `PUBLIC_DIR`.

- [ ] **Step 1: Import needed modules**

Add imports near the top of `server.py`:

```python
import py_compile
import subprocess
```

- [ ] **Step 2: Add check record helper**

Add after `MIME_TYPES`:

```python
def make_check(check_id, label, status, message, details=None, command=None):
    check = {
        "id": check_id,
        "label": label,
        "status": status,
        "message": message,
    }

    if details:
        check["details"] = details

    if command:
        check["command"] = command

    return check
```

- [ ] **Step 3: Add safe command helper**

Add:

```python
def run_command(args):
    return subprocess.run(
        args,
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=5,
        check=False,
    )
```

- [ ] **Step 4: Add Git check**

Add:

```python
def check_git_state():
    try:
        inside = run_command(["git", "rev-parse", "--is-inside-work-tree"])
    except (OSError, subprocess.SubprocessError) as error:
        return make_check(
            "git-state",
            "Git repository",
            "warning",
            "Git is not available from this server process.",
            str(error),
            "Install Git or open this project from a Git checkout.",
        )

    if inside.returncode != 0 or inside.stdout.strip() != "true":
        return make_check(
            "git-state",
            "Git repository",
            "error",
            "This folder is not a Git worktree.",
            inside.stderr.strip(),
            "Clone or pull the project repository on this machine.",
        )

    branch = run_command(["git", "branch", "--show-current"]).stdout.strip() or "detached HEAD"
    head = run_command(["git", "rev-parse", "HEAD"]).stdout.strip()
    origin = run_command(["git", "rev-parse", "origin/main"])

    if origin.returncode != 0:
        return make_check(
            "git-state",
            "Git repository",
            "warning",
            f"Git worktree is on {branch}, but origin/main was not found.",
            "Remote sync could not be checked.",
            "Run git remote -v and git fetch origin on the target machine.",
        )

    origin_head = origin.stdout.strip()
    if head != origin_head:
        return make_check(
            "git-state",
            "Git repository",
            "warning",
            f"Git worktree is on {branch}, but HEAD differs from origin/main.",
            f"HEAD {head[:7]}, origin/main {origin_head[:7]}",
            "Run git pull origin main or checkout the pushed feature branch.",
        )

    return make_check(
        "git-state",
        "Git repository",
        "ok",
        f"Git worktree is on {branch} and matches origin/main.",
        f"HEAD {head[:7]}",
    )
```

- [ ] **Step 5: Add project file check**

Add:

```python
def check_project_files():
    required_files = [
        "server.py",
        "tools/unreal/sync_selected_static_mesh_rocks.py",
        "public/index.html",
        "public/app.js",
        "public/src/editor.js",
        "public/src/ue-rock-sync.js",
    ]
    missing = [path for path in required_files if not (ROOT / path).exists()]

    if missing:
        return make_check(
            "project-files",
            "Project files",
            "error",
            "Required tracked project files are missing.",
            ", ".join(missing),
            "Run git pull or reclone the repository.",
        )

    return make_check(
        "project-files",
        "Project files",
        "ok",
        "Required tracked project files are present.",
        ", ".join(required_files),
    )
```

- [ ] **Step 6: Add Python compile check**

Add:

```python
def check_python_compile():
    files = [
        ROOT / "server.py",
        ROOT / "tools/unreal/sync_selected_static_mesh_rocks.py",
    ]

    try:
        for path in files:
            py_compile.compile(str(path), doraise=True)
    except py_compile.PyCompileError as error:
        return make_check(
            "python-compile",
            "Python compile",
            "error",
            "Python failed to compile a project script.",
            str(error),
            "Fix the syntax error before running the local workflow.",
        )

    return make_check(
        "python-compile",
        "Python compile",
        "ok",
        "Server and UE Python scripts compile.",
        "Checked server.py and tools/unreal/sync_selected_static_mesh_rocks.py",
    )
```

- [ ] **Step 7: Add UE sync export check**

Add:

```python
def check_ue_sync_exports():
    sync_dir = PUBLIC_DIR / "ue-sync"
    manifest = sync_dir / "scene.manifest.json"
    semantic_rules = sync_dir / "semantic.rules.json"
    mesh_dir = sync_dir / "meshes"
    glb_files = list(mesh_dir.glob("*.glb")) if mesh_dir.exists() else []
    total_bytes = sum(path.stat().st_size for path in glb_files if path.exists())
    missing = []

    if not manifest.exists():
        missing.append("public/ue-sync/scene.manifest.json")

    if not semantic_rules.exists():
        missing.append("public/ue-sync/semantic.rules.json")

    if not glb_files:
        missing.append("public/ue-sync/meshes/*.glb")

    if missing:
        return make_check(
            "ue-sync-exports",
            "UE sync export data",
            "warning",
            "UE export data is missing or incomplete on this machine.",
            ", ".join(missing),
            "Run tools/unreal/sync_selected_static_mesh_rocks.py inside Unreal Editor or copy public/ue-sync from the source machine.",
        )

    size_mb = round(total_bytes / (1024 * 1024), 1)
    return make_check(
        "ue-sync-exports",
        "UE sync export data",
        "ok",
        f"UE export data is available with {len(glb_files)} GLB files.",
        f"Approximate mesh data size: {size_mb} MB",
    )
```

- [ ] **Step 8: Add ignore check and payload builder**

Add:

```python
def check_ue_sync_ignore():
    gitignore = ROOT / ".gitignore"
    contents = gitignore.read_text(encoding="utf-8") if gitignore.exists() else ""

    if "public/ue-sync/" not in contents:
        return make_check(
            "ue-sync-ignore",
            "UE export Git ignore",
            "warning",
            "public/ue-sync/ is not listed in .gitignore.",
            "Large exported scene data may accidentally be committed.",
            "Add public/ue-sync/ to .gitignore.",
        )

    return make_check(
        "ue-sync-ignore",
        "UE export Git ignore",
        "ok",
        "public/ue-sync/ is ignored by Git.",
        "Exported UE data must be regenerated or copied on another machine.",
    )


def run_environment_checks():
    return [
        check_git_state(),
        check_project_files(),
        check_python_compile(),
        check_ue_sync_exports(),
        check_ue_sync_ignore(),
    ]


def build_environment_check():
    checks = run_environment_checks()
    attention_count = sum(1 for check in checks if check["status"] != "ok")
    error_count = sum(1 for check in checks if check["status"] == "error")
    summary = "All local setup checks passed" if attention_count == 0 else f"{attention_count} checks need attention"

    return {
        "ok": error_count == 0,
        "summary": summary,
        "checks": checks,
    }
```

- [ ] **Step 9: Add HTTP route**

In `Handler.do_GET`, after `/api/health`, add:

```python
if path == "/api/environment-check":
    body = json.dumps(build_environment_check()).encode("utf-8")
    self.send_body(200, body, MIME_TYPES[".json"])
    return
```

- [ ] **Step 10: Run GREEN verification**

Run:

```js
await import(`file:///D:/CompositionPipeline/tests/environment-check.test.mjs?green=${Date.now()}`);
```

Expected: import completes without throwing.

## Task 3: Implement UE Panel UI And Frontend Rendering

**Files:**
- Modify: `public/index.html`
- Modify: `public/src/editor.js`
- Test: `tests/editor-architecture.test.mjs`

**Interfaces:**
- Consumes: `GET /api/environment-check`.
- Produces: `runLocalSetupCheck()`, `renderLocalSetupChecks(payload)`, `renderLocalSetupCheckFailure(error)`.

- [ ] **Step 1: Add UE panel markup**

In the UE card, directly after `ue-semantic-mode-button`, add:

```html
<button id="local-setup-check-button" class="ue-rock-sync-button" type="button" data-local-setup-check>
  Check Local Setup
</button>
```

After the existing synced actors line, add:

```html
<div id="local-setup-check-status" class="local-setup-check-status">Local setup not checked</div>
<div id="local-setup-check-results" class="local-setup-check-results" hidden></div>
```

- [ ] **Step 2: Add compact status CSS**

In `public/index.html`, near UE sync card styles, add:

```css
.local-setup-check-status {
  color: rgba(255, 255, 255, 0.62);
  font-size: 12px;
  line-height: 1.35;
}

.local-setup-check-results {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.local-setup-check-results[hidden] {
  display: none;
}

.local-setup-check-item {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-left-width: 3px;
  border-radius: 6px;
  padding: 7px 8px;
  background: rgba(0, 0, 0, 0.14);
}

.local-setup-check-item.is-ok {
  border-left-color: #57a65a;
}

.local-setup-check-item.is-warning {
  border-left-color: #d18b4b;
}

.local-setup-check-item.is-error {
  border-left-color: #ff4d4d;
}

.local-setup-check-label,
.local-setup-check-message,
.local-setup-check-detail,
.local-setup-check-command {
  display: block;
  font-size: 11px;
  line-height: 1.35;
}

.local-setup-check-label {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 650;
}

.local-setup-check-message {
  color: rgba(255, 255, 255, 0.72);
}

.local-setup-check-detail,
.local-setup-check-command {
  color: rgba(255, 255, 255, 0.5);
}
```

- [ ] **Step 3: Query frontend elements**

In `public/src/editor.js`, near existing UE sync queries, add:

```js
const localSetupCheckButton = document.querySelector("#local-setup-check-button");
const localSetupCheckStatus = document.querySelector("#local-setup-check-status");
const localSetupCheckResults = document.querySelector("#local-setup-check-results");
```

- [ ] **Step 4: Add rendering helpers**

Add near `setImportedSceneDisplayMode`:

```js
function setLocalSetupCheckBusy(busy) {
  if (localSetupCheckButton) {
    localSetupCheckButton.disabled = busy;
    localSetupCheckButton.textContent = busy ? "Checking..." : "Check Local Setup";
  }
}

function createLocalSetupCheckItem(check) {
  const item = document.createElement("div");
  const label = document.createElement("span");
  const message = document.createElement("span");

  item.className = `local-setup-check-item is-${check.status}`;
  label.className = "local-setup-check-label";
  message.className = "local-setup-check-message";
  label.textContent = check.label;
  message.textContent = check.message;
  item.append(label, message);

  if (check.details) {
    const details = document.createElement("span");
    details.className = "local-setup-check-detail";
    details.textContent = check.details;
    item.append(details);
  }

  if (check.command) {
    const command = document.createElement("span");
    command.className = "local-setup-check-command";
    command.textContent = check.command;
    item.append(command);
  }

  return item;
}

function renderLocalSetupChecks(payload) {
  if (localSetupCheckStatus) {
    localSetupCheckStatus.textContent = payload.summary || "Local setup checked";
  }

  if (!localSetupCheckResults) {
    return;
  }

  const checks = Array.isArray(payload.checks) ? payload.checks : [];

  localSetupCheckResults.hidden = checks.length === 0;
  localSetupCheckResults.replaceChildren(...checks.map(createLocalSetupCheckItem));
}

function renderLocalSetupCheckFailure(error) {
  if (localSetupCheckStatus) {
    localSetupCheckStatus.textContent = `Local setup check failed: ${error.message || error}`;
  }
}
```

- [ ] **Step 5: Add endpoint call**

Add:

```js
async function runLocalSetupCheck() {
  setLocalSetupCheckBusy(true);

  try {
    const response = await fetch("/api/environment-check", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    renderLocalSetupChecks(await response.json());
  } catch (error) {
    renderLocalSetupCheckFailure(error);
  } finally {
    setLocalSetupCheckBusy(false);
  }
}
```

- [ ] **Step 6: Wire button**

Near the other click handlers, add:

```js
localSetupCheckButton?.addEventListener("click", runLocalSetupCheck);
```

- [ ] **Step 7: Run GREEN verification**

Run:

```js
await import(`file:///D:/CompositionPipeline/tests/editor-architecture.test.mjs?green=${Date.now()}`);
```

Expected: import completes without throwing.

## Task 4: Full Verification And Browser Smoke Test

**Files:**
- Verify all changed files.

**Interfaces:**
- Consumes: implemented API and UI.
- Produces: verified local setup check in browser.

- [ ] **Step 1: Run all JS tests**

Run through Codex Node REPL:

```js
for (const test of [
  "file:///D:/CompositionPipeline/tests/environment-check.test.mjs",
  "file:///D:/CompositionPipeline/tests/ue-rock-sync.test.mjs",
  "file:///D:/CompositionPipeline/tests/unreal-export-script.test.mjs",
  "file:///D:/CompositionPipeline/tests/editor-architecture.test.mjs",
  "file:///D:/CompositionPipeline/tests/play-mode-controls.test.mjs"
]) {
  await import(`${test}?verify=${Date.now()}-${Math.random()}`);
}
```

Expected: all imports complete without throwing.

- [ ] **Step 2: Run Python compile check**

Run:

```powershell
python -m py_compile server.py tools\unreal\sync_selected_static_mesh_rocks.py
```

Expected: exit code `0`.

- [ ] **Step 3: Run endpoint smoke check**

Run:

```powershell
python -c "import importlib.util,json,pathlib; root=pathlib.Path(r'D:\CompositionPipeline'); spec=importlib.util.spec_from_file_location('composition_server', root/'server.py'); module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module); print(json.dumps(module.build_environment_check())[:200])"
```

Expected: prints JSON beginning with `{"ok":`.

- [ ] **Step 4: Run Git whitespace check**

Run:

```powershell
git diff --check
```

Expected: exit code `0`.

- [ ] **Step 5: Browser verification**

Use the in-app browser at:

```text
http://localhost:5173/?right-handle-test=1
```

Reload after code changes. Click the UE tab, then click `Check Local Setup`.

Expected: button becomes busy briefly, then the UE panel shows a compact local setup summary and at least five status items.

- [ ] **Step 6: Commit implementation**

Run:

```powershell
git status --short
git add server.py public/index.html public/src/editor.js tests/environment-check.test.mjs tests/editor-architecture.test.mjs docs/superpowers/plans/2026-06-23-local-setup-check.md
git commit -m "Add local setup check"
```

Expected: commit succeeds on `codex/local-setup-check`.

## Self-Review

- Spec coverage: The plan covers the read-only API, UE panel button, status list, Git/project/Python/export/ignore checks, endpoint failure handling, and full verification.
- Placeholder scan: No unresolved marker text or undefined future behavior is intentionally left in this plan.
- Type consistency: The endpoint returns `ok`, `summary`, and `checks`; frontend functions consume that exact shape; tests assert the same IDs and function names.
