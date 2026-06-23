# Local Setup Check Design

## Goal

Add a local setup check to the UE panel so the project can be opened on another computer and quickly verify whether the machine is ready for the current UE scene proxy workflow.

The first pass is a diagnostic and guidance feature. It should not install software, change system settings, run Unreal, or copy large scene data automatically.

## User Workflow

1. Start the local server.
2. Open the editor.
3. Go to the UE panel.
4. Click `Check Local Setup`.
5. Read a compact status list that identifies what is ready, what is missing, and what to do next.

This is intended for moving between work and home machines, where the Git-tracked project files may exist but ignored UE export data may not.

## Scope

The check should report:

- repository state: Git is available, the project is a Git worktree, branch name, and whether local `HEAD` matches `origin/main` when that information is available;
- required project files: `tools/unreal/sync_selected_static_mesh_rocks.py`, `server.py`, and the UE sync runtime files;
- Python availability: the server and UE Python script compile with the local Python used to run the server;
- UE sync export data: `public/ue-sync/scene.manifest.json`, `public/ue-sync/semantic.rules.json`, and `.glb` files under `public/ue-sync/meshes`;
- ignore behavior: `public/ue-sync/` remains ignored so users know exported data does not travel through Git;
- actionable next steps for missing export data, such as running the UE script again or manually copying `public/ue-sync/` from the source machine.

## Architecture

`server.py` adds a read-only JSON endpoint:

```text
GET /api/environment-check
```

The endpoint runs local checks from the project root and returns a structured payload. It may invoke safe read-only commands such as Git status commands and Python compile checks. It must not run package installation, mutate files, call Unreal, or execute the UE export script.

`public/src/editor.js` adds a small UE-panel controller for triggering the endpoint and rendering results. The UI stays inside the existing UE card in `public/index.html`.

## Response Shape

The API returns:

```json
{
  "ok": false,
  "summary": "2 checks need attention",
  "checks": [
    {
      "id": "ue-sync-data",
      "label": "UE sync export data",
      "status": "warning",
      "message": "No exported GLB files found.",
      "details": "Run the Unreal Python export script or copy public/ue-sync from the source machine.",
      "command": "Run tools/unreal/sync_selected_static_mesh_rocks.py inside Unreal Editor"
    }
  ]
}
```

`status` values are `ok`, `warning`, and `error`.

Warnings are for expected cross-machine gaps, such as missing ignored UE export data. Errors are for missing tracked project files or a local environment that cannot run the project server.

## UI Design

The UE panel gets one button below the semantic mode button:

```text
Check Local Setup
```

After clicking, the panel displays a list of checks. Each item uses a compact label, status text, and optional detail line. The layout follows the existing dark, utilitarian UE card style and avoids adding a new page or modal.

The button shows a busy state while the endpoint is running and a failure message if the local server endpoint cannot be reached.

## Error Handling

- If Git is not available, the Git check becomes a warning with a direct message.
- If `origin/main` does not exist, the remote sync check becomes a warning, not a hard failure.
- If `public/ue-sync/` is missing, the project is still usable; the check reports the specific export-data gap.
- If Python compilation fails, report the failing file and compiler output as an error.
- If the API request itself fails, show a single UI error and leave previous results visible if they exist.

## Testing

Add tests for:

- `server.py` exposes `/api/environment-check` and returns structured checks;
- the endpoint includes tracked script, Python compile, Git, ignored UE data, manifest, semantic rules, and GLB checks;
- `public/index.html` contains the button and result container;
- `public/src/editor.js` queries the new UI elements, calls `/api/environment-check`, renders check statuses, and handles request failure;
- existing editor, UE sync, play mode, and exporter tests remain green.

## Non-Goals

- Installing Git, Python, Unreal plugins, or Node.
- Running the Unreal export script from the browser.
- Copying `public/ue-sync/` between machines.
- Storing machine-specific setup state in Git.
