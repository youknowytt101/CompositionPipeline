# UE Export Tool Deployment Design

## Goal

Add a `Deploy UE Export Tools` control to the browser UE panel that installs the CompositionPipeline exporter into a user-selected Unreal project as a project-level Python plugin.

The first version focuses on reliable local deployment. It should create or update plugin files in the target UE project's `Plugins/CompositionPipelineExporter/` folder and report whether Unreal should be restarted before the menu appears.

## User Workflow

1. Open the local CompositionPipeline app.
2. Go to the UE panel.
3. Enter or paste the current Unreal project's `.uproject` path.
4. Click `Deploy UE Export Tools`.
5. The app validates the path and writes the plugin files into that project.
6. Restart Unreal if the plugin was newly installed or UE does not pick up the plugin immediately.
7. In Unreal, use `Tools > Composition Pipeline > Export Selected Scene Proxies`.

## Scope

Included:

- A UE panel text input for a `.uproject` path.
- A deploy button below `Check Local Setup`.
- A local server endpoint that performs path validation and writes project-local plugin files.
- A generated `.uplugin` manifest.
- A generated `Content/Python/init_unreal.py` menu registration script.
- A generated copy of the exporter script.
- Export output configured to this CompositionPipeline workspace's `public/ue-sync` directory.
- A compact deployment status list in the UE panel.

Excluded:

- Installing Unreal Engine plugins globally.
- Enabling Unreal's built-in `Python Editor Script Plugin` or `glTF Exporter` automatically.
- Detecting the currently focused UE editor process.
- Copying large exported scene data.
- Running the export from the browser.
- Guaranteeing the menu appears without restarting Unreal.

## Architecture

`server.py` owns the deployment operation because writing into a UE project is a local filesystem side effect. The browser sends a JSON request to a new endpoint:

```text
POST /api/deploy-ue-export-tools
```

The endpoint validates that the supplied path exists, ends in `.uproject`, and writes only under that project's `Plugins/CompositionPipelineExporter/` directory.

`public/index.html` owns the UE panel markup. It adds a project path input, deploy button, and deploy result container below the existing local setup check controls.

`public/src/editor.js` owns the UI behavior. It reads the `.uproject` path, calls the endpoint, disables the button while deploying, and renders success or error details.

## Plugin Layout

The deployed plugin uses this structure:

```text
<UE project>/
  Plugins/
    CompositionPipelineExporter/
      CompositionPipelineExporter.uplugin
      Content/
        Python/
          init_unreal.py
          sync_selected_static_mesh_rocks.py
```

`init_unreal.py` registers a menu entry at:

```text
Tools > Composition Pipeline > Export Selected Scene Proxies
```

The menu entry imports and reloads `sync_selected_static_mesh_rocks.py`, then calls `sync_selected_static_mesh_rocks()`.

## Export Path

The generated exporter must write to the current CompositionPipeline workspace:

```text
E:/CompositionPipeline/public/ue-sync
```

The source script should no longer require a hard-coded `D:/CompositionPipeline` path when deployed. The server can patch the generated plugin copy with the current `PUBLIC_DIR / "ue-sync"` path.

## Response Shape

Successful deployment returns:

```json
{
  "ok": true,
  "summary": "UE export tools deployed",
  "pluginDir": "D:/UnrealProjects/MyProject/Plugins/CompositionPipelineExporter",
  "menuPath": "Tools > Composition Pipeline > Export Selected Scene Proxies",
  "checks": [
    {
      "id": "plugin-files",
      "label": "Plugin files",
      "status": "ok",
      "message": "CompositionPipelineExporter plugin files were written."
    }
  ]
}
```

Failures return `ok: false`, a short summary, and checks that identify the invalid path or write failure.

## Error Handling

- Empty path: return an error telling the user to paste a `.uproject` path.
- Missing file: return an error with the missing path.
- Wrong extension: return an error requiring a `.uproject` file.
- Path traversal: resolve all target paths and ensure they stay under the target project's `Plugins/CompositionPipelineExporter` folder.
- Filesystem write failure: return the exception message as an error check.
- Existing plugin: overwrite the generated files in place and report that the plugin was updated.

## Testing

Add or update static and executable tests for:

- The server exposes `POST /api/deploy-ue-export-tools`.
- Deployment writes only under `<project>/Plugins/CompositionPipelineExporter`.
- Invalid `.uproject` paths return structured errors.
- Generated plugin files include `.uplugin`, `init_unreal.py`, and the exporter script.
- Generated exporter points to the current workspace `public/ue-sync`.
- The UE panel contains the path input, deploy button, and result container.
- `editor.js` calls the deploy endpoint and renders deployment results.

## Risks

The server now performs local writes outside the CompositionPipeline workspace when the user supplies a UE project path. The implementation must keep the operation narrow, explicit, and limited to the plugin directory inside that project.
