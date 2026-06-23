import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function assertFile(relativePath) {
  assert.ok(existsSync(join(root, relativePath)), `Expected ${relativePath} to exist`);
}

assertFile("tools/unreal/sync_selected_static_mesh_rocks.py");

const gitignore = read(".gitignore");
assert.match(gitignore, /^public\/ue-sync\/$/m);

const script = read("tools/unreal/sync_selected_static_mesh_rocks.py");

assert.match(script, /import\s+os/);
assert.match(script, /CONFIG_PATH\s*=\s*Path\(__file__\)\.resolve\(\)\.with_name\(["']composition_pipeline_config\.json["']\)/);
assert.match(script, /def load_output_root\(\)/);
assert.match(script, /COMPOSITION_PIPELINE_UE_SYNC_DIR/);
assert.match(script, /outputRoot/);
assert.match(script, /OUTPUT_ROOT\s*=\s*load_output_root\(\)/);
assert.doesNotMatch(script, /D:\/CompositionPipeline\/public\/ue-sync/);
assert.match(script, /MESH_OUTPUT_DIR\s*=\s*OUTPUT_ROOT\s*\/\s*["']meshes["']/);
assert.match(script, /LEGACY_MANIFEST_PATH\s*=\s*OUTPUT_ROOT\s*\/\s*["']rocks\.instances\.json["']/);
assert.doesNotMatch(
  script,
  /^MANIFEST_PATH\s*=/m,
  "Legacy rock manifest should use LEGACY_MANIFEST_PATH only, not a duplicate MANIFEST_PATH alias"
);
assert.match(script, /SCENE_MANIFEST_PATH\s*=\s*OUTPUT_ROOT\s*\/\s*["']scene\.manifest\.json["']/);
assert.match(script, /SEMANTIC_RULES_PATH\s*=\s*OUTPUT_ROOT\s*\/\s*["']semantic\.rules\.json["']/);
assert.match(script, /ASSETS_BASE_URL\s*=\s*["']\/ue-sync\/meshes\/["']/);
assert.match(script, /SEMANTIC_RULES_URL\s*=\s*["']\/ue-sync\/semantic\.rules\.json["']/);
assert.match(script, /DEFAULT_GRID_SIZE_METERS\s*=\s*5000/);
assert.match(script, /get_selected_level_actors/);
assert.match(script, /StaticMeshComponent/);
assert.match(script, /def static_mesh_components_for_actor\(actor\)/);
assert.match(script, /get_components_by_class\(unreal\.StaticMeshComponent\)/);
assert.match(script, /GLTFStaticMeshExporter/);
assert.match(script, /AssetExportTask/);
assert.match(script, /Exporter\.run_asset_export_task/);
assert.match(script, /"assetsBaseUrl":\s*ASSETS_BASE_URL/);
assert.match(script, /"meshUnit":\s*["']centimeter["']/);
assert.match(script, /"meshAssetPath"/);
assert.match(script, /"children"/);
assert.match(script, /def component_record\(actor, component, mesh_file: str, index: int\)/);
assert.match(script, /component_world_transform\(actor,\s*component\)/);
assert.doesNotMatch(
  script,
  /component_relative_transform/,
  "Child component records should store component world transforms; the browser converts them into grouped local transforms"
);
assert.match(script, /"location"/);
assert.match(script, /"rotation"/);
assert.match(script, /"quaternion"/);
assert.doesNotMatch(script, /get_actor_quat/);
assert.doesNotMatch(script, /get_scale3d/);
assert.match(script, /def transform_scale\(transform\)/);
assert.match(script, /def transform_quaternion\(transform\)/);
assert.match(script, /def actor_label\(actor\)/);
assert.match(script, /def actor_class_name\(actor\)/);
assert.match(script, /def actor_folder_path\(actor\)/);
assert.match(script, /def actor_tags\(actor\)/);
assert.match(script, /def component_tags\(component\)/);
assert.match(script, /def material_slot_names\(static_mesh\)/);
assert.match(script, /def component_world_transform\(actor, component\)/);
assert.match(script, /for method_name in \[/);
assert.match(script, /get_world_transform/);
assert.match(script, /get_component_to_world/);
assert.match(script, /return actor\.get_actor_transform\(\)/);
assert.match(script, /def selected_scene_origin\(actors\)/);
assert.match(script, /def semantic_for_metadata\(/);
assert.match(script, /"tree":\s*\{"id":\s*1,\s*"color":\s*"#2f7d32"\}/);
assert.match(script, /"shrub":\s*\{"id":\s*2,\s*"color":\s*"#57a65a"\}/);
assert.match(script, /"grass":\s*\{"id":\s*3,\s*"color":\s*"#8bbf3d"\}/);
assert.match(script, /"rock":\s*\{"id":\s*4,\s*"color":\s*"#8e8e8e"\}/);
assert.match(script, /"human_made":\s*\{"id":\s*5,\s*"color":\s*"#d18b4b"\}/);
assert.match(script, /"terrain":\s*\{"id":\s*6,\s*"color":\s*"#6f8f55"\}/);
assert.match(script, /\{"if":\s*\{"blueprintClassContains":\s*"Tree"\},\s*"semantic":\s*"tree"\}/);
assert.match(script, /\{"if":\s*\{"assetPathContains":\s*"Bush"\},\s*"semantic":\s*"shrub"\}/);
assert.match(script, /\{"if":\s*\{"assetPathContains":\s*"Grass"\},\s*"semantic":\s*"grass"\}/);
assert.match(script, /\{"if":\s*\{"assetPathContains":\s*"Rock"\},\s*"semantic":\s*"rock"\}/);
assert.match(script, /\{"if":\s*\{"assetPathContains":\s*"Wall"\},\s*"semantic":\s*"human_made"\}/);
assert.match(script, /"scale"/);
assert.match(script, /"schema":\s*["']composition-pipeline\.ue-scene\.v2["']/);
assert.match(script, /"sceneOrigin"/);
assert.match(script, /"gridSizeMeters"/);
assert.match(script, /"semanticRulesUrl":\s*SEMANTIC_RULES_URL/);
assert.match(script, /"actors"/);
assert.match(script, /"components"/);
assert.match(script, /def is_landscape_actor\(actor\)/);
assert.match(script, /def terrain_record_for_actor\(actor\)/);
assert.match(script, /LANDSCAPE_PROXY_COMPONENT_TYPE\s*=\s*["']LandscapeStreamingProxy["']/);
assert.match(script, /"type":\s*actor_class_name\(actor\)\s*or\s*LANDSCAPE_PROXY_COMPONENT_TYPE/);
assert.match(script, /"terrain"/);
assert.match(script, /"extent"/);
assert.match(script, /"size"/);
assert.match(script, /"materialSlots"/);
assert.match(script, /"semantic"/);
assert.match(script, /with\s+LEGACY_MANIFEST_PATH\.open/);
assert.match(script, /json\.dump\(manifest,/);
assert.match(script, /json\.dump\(scene_manifest,/);
assert.match(script, /json\.dump\(semantic_rules,/);
assert.match(script, /def cleanup_unused_mesh_exports\(used_mesh_files: set\[str\]\) -> int:/);
assert.match(script, /for mesh_path in MESH_OUTPUT_DIR\.glob\(["']\*\.glb["']\)/);
assert.match(script, /if mesh_path\.name in used_mesh_files:/);
assert.match(script, /mesh_path\.unlink\(\)/);
assert.match(script, /removed_meshes = cleanup_unused_mesh_exports\(set\(exported_meshes\.values\(\)\)\)/);
assert.match(script, /Removed \{removed_meshes\} unused exported GLB files/);
assert.match(script, /skipped_components\s*=\s*0/);
assert.match(script, /except Exception as error:/);
assert.match(script, /Skipping component/);
assert.match(script, /skipped_components\s*\+=\s*1/);
assert.match(script, /if not children and not scene_components:/);
assert.match(script, /Skipping .*: no exportable StaticMeshComponent completed successfully/);
assert.match(script, /Skipped \{skipped_components\} selected static mesh components/);
assert.match(script, /ensure_ascii=False/);
