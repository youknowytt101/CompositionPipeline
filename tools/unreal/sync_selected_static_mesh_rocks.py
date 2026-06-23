from __future__ import annotations

import hashlib
import json
import re
import traceback
from pathlib import Path

import unreal


OUTPUT_ROOT = Path(r"D:/CompositionPipeline/public/ue-sync")
MESH_OUTPUT_DIR = OUTPUT_ROOT / "meshes"
LEGACY_MANIFEST_PATH = OUTPUT_ROOT / "rocks.instances.json"
SCENE_MANIFEST_PATH = OUTPUT_ROOT / "scene.manifest.json"
SEMANTIC_RULES_PATH = OUTPUT_ROOT / "semantic.rules.json"
DEBUG_LOG_PATH = OUTPUT_ROOT / "export-debug.log"
ASSETS_BASE_URL = "/ue-sync/meshes/"
SEMANTIC_RULES_URL = "/ue-sync/semantic.rules.json"
CENTIMETERS_PER_SCENE_UNIT = 100.0
DEFAULT_GRID_SIZE_METERS = 5000
LANDSCAPE_ACTOR_CLASS_NAMES = ("Landscape", "LandscapeProxy", "LandscapeStreamingProxy")
LANDSCAPE_PROXY_COMPONENT_TYPE = "LandscapeStreamingProxy"
DEFAULT_SEMANTIC_RULES = {
    "classes": {
        "unclassified": {"id": 0, "color": "#ff00ff"},
        "tree": {"id": 1, "color": "#2f7d32"},
        "shrub": {"id": 2, "color": "#57a65a"},
        "grass": {"id": 3, "color": "#8bbf3d"},
        "rock": {"id": 4, "color": "#8e8e8e"},
        "human_made": {"id": 5, "color": "#d18b4b"},
        "terrain": {"id": 6, "color": "#6f8f55"},
    },
    "rules": [
        {"if": {"blueprintClassContains": "Landscape"}, "semantic": "terrain"},
        {"if": {"blueprintClassContains": "LandscapeStreamingProxy"}, "semantic": "terrain"},
        {"if": {"actorLabelContains": "Landscape"}, "semantic": "terrain"},
        {"if": {"tagContains": "tree"}, "semantic": "tree"},
        {"if": {"blueprintClassContains": "Tree"}, "semantic": "tree"},
        {"if": {"assetPathContains": "Tree"}, "semantic": "tree"},
        {"if": {"assetPathContains": "Trunk"}, "semantic": "tree"},
        {"if": {"assetPathContains": "Branch"}, "semantic": "tree"},
        {"if": {"assetPathContains": "Canopy"}, "semantic": "tree"},
        {"if": {"tagContains": "shrub"}, "semantic": "shrub"},
        {"if": {"assetPathContains": "Bush"}, "semantic": "shrub"},
        {"if": {"assetPathContains": "Shrub"}, "semantic": "shrub"},
        {"if": {"assetPathContains": "Hedge"}, "semantic": "shrub"},
        {"if": {"tagContains": "grass"}, "semantic": "grass"},
        {"if": {"assetPathContains": "Grass"}, "semantic": "grass"},
        {"if": {"assetPathContains": "Foliage"}, "semantic": "grass"},
        {"if": {"materialContains": "Grass"}, "semantic": "grass"},
        {"if": {"tagContains": "human_made"}, "semantic": "human_made"},
        {"if": {"assetPathContains": "Wall"}, "semantic": "human_made"},
        {"if": {"assetPathContains": "Building"}, "semantic": "human_made"},
        {"if": {"assetPathContains": "House"}, "semantic": "human_made"},
        {"if": {"assetPathContains": "Fence"}, "semantic": "human_made"},
        {"if": {"assetPathContains": "Road"}, "semantic": "human_made"},
        {"if": {"assetPathContains": "Bridge"}, "semantic": "human_made"},
        {"if": {"assetPathContains": "Stair"}, "semantic": "human_made"},
        {"if": {"assetPathContains": "Door"}, "semantic": "human_made"},
        {"if": {"assetPathContains": "Window"}, "semantic": "human_made"},
        {"if": {"assetPathContains": "Prop"}, "semantic": "human_made"},
        {"if": {"assetPathContains": "Ruin"}, "semantic": "human_made"},
        {"if": {"folderPathContains": "Building"}, "semantic": "human_made"},
        {"if": {"tagContains": "rock"}, "semantic": "rock"},
        {"if": {"assetPathContains": "Rock"}, "semantic": "rock"},
        {"if": {"assetPathContains": "Stone"}, "semantic": "rock"},
        {"if": {"assetPathContains": "Cliff"}, "semantic": "rock"},
        {"if": {"assetPathContains": "Boulder"}, "semantic": "rock"},
    ],
}


def log(message: str) -> None:
    unreal.log(f"[CompositionPipeline UE Sync] {message}")


def warn(message: str) -> None:
    unreal.log_warning(f"[CompositionPipeline UE Sync] {message}")


def debug_file(message: str) -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

    with DEBUG_LOG_PATH.open("a", encoding="utf-8") as file:
        file.write(message)
        file.write("\n")


def reset_debug_log() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    DEBUG_LOG_PATH.write_text("", encoding="utf-8")


def sanitize_filename(value: str) -> str:
    sanitized = re.sub(r"[^A-Za-z0-9_.-]+", "_", value).strip("_")
    return sanitized or "StaticMesh"


def selected_level_actors():
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if subsystem:
        return list(subsystem.get_selected_level_actors())

    return list(unreal.EditorLevelLibrary.get_selected_level_actors())


def static_mesh_components_for_actor(actor):
    components = []
    seen = set()

    if isinstance(actor, unreal.StaticMeshActor):
        component = actor.static_mesh_component
        if component and component.static_mesh:
            components.append(component)
            seen.add(component.get_path_name() if hasattr(component, "get_path_name") else component.get_name())

    for component in actor.get_components_by_class(unreal.StaticMeshComponent):
        if not component or not component.static_mesh:
            continue

        component_key = component.get_path_name() if hasattr(component, "get_path_name") else component.get_name()
        if component_key in seen:
            continue

        components.append(component)
        seen.add(component_key)

    return components


def is_landscape_actor(actor) -> bool:
    actor_class = actor_class_name(actor)

    if any(class_name.lower() in actor_class.lower() for class_name in LANDSCAPE_ACTOR_CLASS_NAMES):
        return True

    for unreal_class_name in LANDSCAPE_ACTOR_CLASS_NAMES:
        unreal_class = getattr(unreal, unreal_class_name, None)

        if unreal_class is not None and isinstance(actor, unreal_class):
            return True

    return False


def asset_path_for_mesh(static_mesh) -> str:
    if hasattr(static_mesh, "get_path_name"):
        return static_mesh.get_path_name()

    return str(static_mesh.get_name())


def mesh_filename(static_mesh) -> str:
    asset_path = asset_path_for_mesh(static_mesh)
    digest = hashlib.sha1(asset_path.encode("utf-8")).hexdigest()[:10]
    return f"{sanitize_filename(static_mesh.get_name())}_{digest}.glb"


def make_gltf_exporter():
    exporter_class = getattr(unreal, "GLTFStaticMeshExporter", None)
    if exporter_class is None:
        raise RuntimeError("Enable Unreal's glTF Exporter plugin before running this script.")

    return exporter_class()


def make_gltf_export_options():
    options_class = getattr(unreal, "GLTFExportOptions", None)
    if options_class is None:
        return None

    options = options_class()

    for property_name, value in {
        "export_materials": False,
        "export_vertex_colors": False,
        "export_uniform_scale": 1.0,
        "adjust_normalmaps": False,
    }.items():
        if hasattr(options, property_name):
            setattr(options, property_name, value)

    return options


def export_static_mesh(static_mesh, output_path: Path) -> bool:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    task = unreal.AssetExportTask()
    task.object = static_mesh
    task.filename = str(output_path)
    task.automated = True
    task.prompt = False
    task.replace_identical = True
    task.selected = False
    task.exporter = make_gltf_exporter()

    options = make_gltf_export_options()
    if options is not None:
        task.options = options

    return bool(unreal.Exporter.run_asset_export_task(task))


def vector_to_list(vector) -> list[float]:
    return [float(vector.x), float(vector.y), float(vector.z)]


def zero_extent_list() -> list[float]:
    return [0.0, 0.0, 0.0]


def scale_to_list(vector) -> list[float]:
    return [float(vector.x), float(vector.y), float(vector.z)]


def rotator_to_scene_euler(rotator) -> list[float]:
    return [float(rotator.roll), float(rotator.pitch), float(rotator.yaw)]


def quat_to_list(quat) -> list[float]:
    return [float(quat.x), float(quat.y), float(quat.z), float(quat.w)]


def transform_property(transform, property_name: str):
    if hasattr(transform, "get_editor_property"):
        try:
            return transform.get_editor_property(property_name)
        except Exception:
            pass

    if hasattr(transform, property_name):
        return getattr(transform, property_name)

    return None


def transform_scale(transform):
    scale = transform_property(transform, "scale3d")
    if scale is not None:
        return scale

    scale = transform_property(transform, "scale")
    if scale is not None:
        return scale

    raise AttributeError("Transform object has no scale3d or scale property.")


def transform_quaternion(transform):
    quaternion = transform_property(transform, "rotation")
    if quaternion is not None:
        return quaternion

    get_rotation = getattr(transform, "get_rotation", None)
    if callable(get_rotation):
        return get_rotation()

    raise AttributeError("Transform object has no rotation property.")


def transform_location(transform):
    location = transform_property(transform, "translation")
    if location is not None:
        return location

    location = transform_property(transform, "location")
    if location is not None:
        return location

    raise AttributeError("Transform object has no translation or location property.")


def component_world_transform(actor, component):
    for method_name in [
        "get_component_transform",
        "get_world_transform",
        "get_component_to_world",
    ]:
        method = getattr(component, method_name, None)
        if callable(method):
            return method()

    component_to_world = editor_property(component, "component_to_world", None)
    if component_to_world is not None:
        return component_to_world

    # StaticMeshActor components often share the actor transform, and some UE
    # Python builds do not expose SceneComponent world-transform helpers.
    return actor.get_actor_transform()


def editor_property(source, property_name: str, default=None):
    if hasattr(source, "get_editor_property"):
        try:
            value = source.get_editor_property(property_name)
            if value is not None:
                return value
        except Exception:
            pass

    if hasattr(source, property_name):
        value = getattr(source, property_name)
        if value is not None:
            return value

    return default


def string_list(values) -> list[str]:
    return [str(value) for value in (values or []) if str(value)]


def actor_label(actor) -> str:
    if hasattr(actor, "get_actor_label"):
        return actor.get_actor_label()

    return actor.get_name()


def actor_class_name(actor) -> str:
    get_class = getattr(actor, "get_class", None)
    actor_class = get_class() if callable(get_class) else None

    if actor_class and hasattr(actor_class, "get_name"):
        return actor_class.get_name()

    return actor.__class__.__name__


def actor_folder_path(actor) -> str:
    get_folder_path = getattr(actor, "get_folder_path", None)

    if callable(get_folder_path):
        return str(get_folder_path())

    return str(editor_property(actor, "folder_path", ""))


def actor_tags(actor) -> list[str]:
    return string_list(editor_property(actor, "tags", []))


def component_tags(component) -> list[str]:
    return string_list(editor_property(component, "component_tags", editor_property(component, "tags", [])))


def material_slot_names(static_mesh) -> list[str]:
    static_materials = editor_property(static_mesh, "static_materials", [])
    names = []

    for static_material in static_materials or []:
        slot_name = editor_property(static_material, "material_slot_name", None)
        if slot_name is not None:
            names.append(str(slot_name))

    return names


def semantic_class_id(semantic: str) -> int:
    semantic_class = DEFAULT_SEMANTIC_RULES["classes"].get(semantic)

    if not semantic_class:
        return DEFAULT_SEMANTIC_RULES["classes"]["unclassified"]["id"]

    return int(semantic_class.get("id", 0))


def semantic_for_metadata(
    asset_path="",
    actor_class="",
    actor_label_value="",
    folder_path="",
    tags=None,
    material_slots=None,
):
    haystacks = {
        "assetPathContains": asset_path.lower(),
        "blueprintClassContains": actor_class.lower(),
        "actorLabelContains": actor_label_value.lower(),
        "folderPathContains": folder_path.lower(),
        "tagContains": " ".join(tags or []).lower(),
        "materialContains": " ".join(material_slots or []).lower(),
    }

    for rule in DEFAULT_SEMANTIC_RULES["rules"]:
        conditions = rule.get("if", {})
        if all(str(expected).lower() in haystacks.get(key, "") for key, expected in conditions.items()):
            return rule["semantic"]

    return "unclassified"


def actor_scene_origin_location(actor):
    if is_landscape_actor(actor):
        center, _extent = actor_bounds(actor)
        return center

    return actor.get_actor_location()


def selected_scene_origin(actors) -> list[float]:
    locations = [actor_scene_origin_location(actor) for actor in actors]

    if not locations:
        return [0.0, 0.0, 0.0]

    min_x = min(location.x for location in locations)
    max_x = max(location.x for location in locations)
    min_y = min(location.y for location in locations)
    max_y = max(location.y for location in locations)
    min_z = min(location.z for location in locations)
    max_z = max(location.z for location in locations)
    return [(min_x + max_x) * 0.5, (min_y + max_y) * 0.5, (min_z + max_z) * 0.5]


def component_record(actor, component, mesh_file: str, index: int) -> dict:
    static_mesh = component.static_mesh
    transform = component_world_transform(actor, component)
    location = transform_location(transform)
    scale = transform_scale(transform)
    quaternion = transform_quaternion(transform)

    return {
        "id": f"{actor.get_name()}_{component.get_name()}_{index + 1}",
        "label": f"{actor_label(actor)} / {component.get_name()}",
        "mesh": mesh_file,
        "meshAssetPath": asset_path_for_mesh(static_mesh),
        "location": vector_to_list(location),
        "rotation": [0.0, 0.0, 0.0],
        "quaternion": quat_to_list(quaternion),
        "scale": scale_to_list(scale),
        "source": "unreal-selected-static-mesh-component",
    }


def transform_record_from_transform(transform) -> dict:
    location = transform_location(transform)
    scale = transform_scale(transform)
    quaternion = transform_quaternion(transform)

    return {
        "location": vector_to_list(location),
        "rotation": [0.0, 0.0, 0.0],
        "quaternion": quat_to_list(quaternion),
        "scale": scale_to_list(scale),
    }


def transform_record_from_location(location) -> dict:
    return {
        "location": vector_to_list(location),
        "rotation": [0.0, 0.0, 0.0],
        "quaternion": [0.0, 0.0, 0.0, 1.0],
        "scale": [1.0, 1.0, 1.0],
    }


def actor_bounds(actor):
    get_actor_bounds = getattr(actor, "get_actor_bounds", None)

    if callable(get_actor_bounds):
        try:
            origin, extent = get_actor_bounds(False)
            return origin, extent
        except TypeError:
            try:
                origin, extent = get_actor_bounds(only_colliding_components=False)
                return origin, extent
            except Exception:
                pass
        except Exception:
            pass

    return actor.get_actor_location(), None


def terrain_record_for_actor(actor) -> dict:
    center, extent = actor_bounds(actor)
    extent_list = vector_to_list(extent) if extent is not None else zero_extent_list()
    size = [extent_list[0] * 2.0, extent_list[1] * 2.0]

    return {
        "id": actor.get_name(),
        "label": actor_label(actor),
        "name": actor.get_name(),
        "type": actor_class_name(actor) or LANDSCAPE_PROXY_COMPONENT_TYPE,
        "mesh": None,
        "meshAssetPath": None,
        "materialSlots": [],
        "tags": actor_tags(actor),
        "semantic": "terrain",
        "colorId": semantic_class_id("terrain"),
        "transform": transform_record_from_location(center),
        "terrain": {
            "center": vector_to_list(center),
            "extent": extent_list,
            "size": size,
        },
        "sourceMetadata": {
            "actorClass": actor_class_name(actor),
            "actorLabel": actor_label(actor),
            "folderPath": actor_folder_path(actor),
        },
    }


def scene_component_record(actor, component, mesh_file: str, index: int) -> dict:
    static_mesh = component.static_mesh
    transform = component_world_transform(actor, component)
    asset_path = asset_path_for_mesh(static_mesh)
    material_slots = material_slot_names(static_mesh)
    semantic = semantic_for_metadata(
        asset_path=asset_path,
        actor_class=actor_class_name(actor),
        actor_label_value=actor_label(actor),
        folder_path=actor_folder_path(actor),
        tags=[*actor_tags(actor), *component_tags(component)],
        material_slots=material_slots,
    )

    return {
        "id": f"{actor.get_name()}_{component.get_name()}_{index + 1}",
        "label": f"{actor_label(actor)} / {component.get_name()}",
        "name": component.get_name(),
        "type": "StaticMeshComponent",
        "mesh": mesh_file,
        "meshAssetPath": asset_path,
        "materialSlots": material_slots,
        "tags": component_tags(component),
        "semantic": semantic,
        "colorId": semantic_class_id(semantic),
        "transform": transform_record_from_transform(transform),
        "sourceMetadata": {
            "actorClass": actor_class_name(actor),
            "actorLabel": actor_label(actor),
            "folderPath": actor_folder_path(actor),
        },
    }


def actor_record(actor, children: list[dict]) -> dict:
    transform = actor.get_actor_transform()
    location = actor.get_actor_location()
    rotation = actor.get_actor_rotation()
    scale = transform_scale(transform)
    quaternion = transform_quaternion(transform)

    return {
        "id": actor.get_name(),
        "label": actor_label(actor),
        "mesh": None,
        "meshAssetPath": None,
        "location": vector_to_list(location),
        "rotation": rotator_to_scene_euler(rotation),
        "quaternion": quat_to_list(quaternion),
        "scale": scale_to_list(scale),
        "children": children,
        "source": "unreal-selected-actor-static-mesh-group",
    }


def scene_actor_record(actor, components: list[dict], source: str = "unreal-selected-actor-static-mesh-group") -> dict:
    transform = actor.get_actor_transform()
    semantic = next(
        (component["semantic"] for component in components if component.get("semantic") != "unclassified"),
        "unclassified",
    )

    return {
        "id": actor.get_name(),
        "label": actor_label(actor),
        "class": actor_class_name(actor),
        "folderPath": actor_folder_path(actor),
        "tags": actor_tags(actor),
        "semantic": semantic,
        "colorId": semantic_class_id(semantic),
        "transform": transform_record_from_transform(transform),
        "components": components,
        "source": source,
    }


def build_manifest(instances: list[dict]) -> dict:
    return {
        "schema": "composition-pipeline.ue-rock-sync.v1",
        "unit": "centimeter",
        "meshUnit": "centimeter",
        "sceneUnit": "meter",
        "centimetersPerSceneUnit": CENTIMETERS_PER_SCENE_UNIT,
        "coordinateSystem": "unreal-z-up",
        "assetsBaseUrl": ASSETS_BASE_URL,
        "instances": instances,
    }


def build_scene_manifest(actors: list[dict], scene_origin: list[float]) -> dict:
    return {
        "schema": "composition-pipeline.ue-scene.v2",
        "unit": "centimeter",
        "meshUnit": "centimeter",
        "sceneUnit": "meter",
        "centimetersPerSceneUnit": CENTIMETERS_PER_SCENE_UNIT,
        "coordinateSystem": "unreal-z-up",
        "sceneOrigin": scene_origin,
        "gridSizeMeters": DEFAULT_GRID_SIZE_METERS,
        "assetsBaseUrl": ASSETS_BASE_URL,
        "semanticRulesUrl": SEMANTIC_RULES_URL,
        "actors": actors,
    }


def sync_selected_static_mesh_rocks() -> dict:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    MESH_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    reset_debug_log()

    selected_actors = selected_level_actors()
    debug_file(f"Selected actors: {len(selected_actors)}")
    scene_origin = selected_scene_origin(selected_actors)
    instances = []
    scene_actors = []
    exported_meshes = {}
    skipped_components = 0

    for actor in selected_actors:
        components = static_mesh_components_for_actor(actor)
        debug_file(f"Actor {actor.get_name()} components: {len(components)}")

        if not components:
            if is_landscape_actor(actor):
                terrain_component = terrain_record_for_actor(actor)
                scene_actors.append(scene_actor_record(
                    actor,
                    [terrain_component],
                    source="unreal-selected-landscape-terrain",
                ))
                debug_file(f"Completed terrain actor {actor.get_name()}")
                continue

            warn(f"Skipping {actor.get_name()}: no StaticMeshComponent with a StaticMesh.")
            continue

        children = []
        scene_components = []

        for index, component in enumerate(components):
            try:
                debug_file(f"Exporting component {actor.get_name()} / {component.get_name()}")
                static_mesh = component.static_mesh
                asset_path = asset_path_for_mesh(static_mesh)
                mesh_file = exported_meshes.get(asset_path)

                if mesh_file is None:
                    mesh_file = mesh_filename(static_mesh)
                    mesh_path = MESH_OUTPUT_DIR / mesh_file

                    if not export_static_mesh(static_mesh, mesh_path):
                        raise RuntimeError(f"Failed to export {asset_path} to {mesh_path}")

                    exported_meshes[asset_path] = mesh_file

                children.append(component_record(actor, component, mesh_file, index))
                scene_components.append(scene_component_record(actor, component, mesh_file, index))
                debug_file(f"Completed component {actor.get_name()} / {component.get_name()}")
            except Exception as error:
                skipped_components += 1
                debug_file(
                    f"FAILED component {actor.get_name()} / {component.get_name()}: "
                    f"{error}\n{traceback.format_exc()}"
                )
                warn(
                    f"Skipping component {actor.get_name()} / {component.get_name()}: "
                    f"{error}"
                )
                continue

        if not children and not scene_components:
            warn(f"Skipping {actor.get_name()}: no exportable StaticMeshComponent completed successfully.")
            continue

        instances.append(actor_record(actor, children))
        scene_actors.append(scene_actor_record(actor, scene_components))

    manifest = build_manifest(instances)
    scene_manifest = build_scene_manifest(scene_actors, scene_origin)
    semantic_rules = DEFAULT_SEMANTIC_RULES

    with LEGACY_MANIFEST_PATH.open("w", encoding="utf-8") as file:
        json.dump(manifest, file, ensure_ascii=False, indent=2)
        file.write("\n")

    with SCENE_MANIFEST_PATH.open("w", encoding="utf-8") as file:
        json.dump(scene_manifest, file, ensure_ascii=False, indent=2)
        file.write("\n")

    with SEMANTIC_RULES_PATH.open("w", encoding="utf-8") as file:
        json.dump(semantic_rules, file, ensure_ascii=False, indent=2)
        file.write("\n")

    log(f"Wrote {len(instances)} selected actor static mesh groups to {LEGACY_MANIFEST_PATH}")
    log(f"Wrote {len(scene_actors)} scene actors to {SCENE_MANIFEST_PATH}")
    log(f"Wrote semantic rules to {SEMANTIC_RULES_PATH}")
    log(f"Exported {len(exported_meshes)} unique meshes to {MESH_OUTPUT_DIR}")
    if skipped_components:
        warn(f"Skipped {skipped_components} selected static mesh components")
    debug_file(f"Wrote actors: {len(scene_actors)}")
    debug_file(f"Skipped components: {skipped_components}")
    return scene_manifest


if __name__ == "__main__":
    try:
        sync_selected_static_mesh_rocks()
    except Exception as error:
        debug_file(f"FATAL: {error}\n{traceback.format_exc()}")
        raise
