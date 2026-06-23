import json
import os
import py_compile
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "public"
PREFERRED_PORT = int(os.environ.get("PORT", "5173"))

reload_condition = threading.Condition()
reload_version = 0


DEV_RELOAD_SCRIPT = b"""
const events = new EventSource("/__reload");
events.addEventListener("reload", () => location.reload());
"""


MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
}


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


def run_command(args):
    return subprocess.run(
        args,
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=5,
        check=False,
    )


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


def notify_reload():
    global reload_version
    with reload_condition:
        reload_version += 1
        reload_condition.notify_all()


def snapshot_files():
    watched_files = [Path(__file__).resolve()]
    watched_files.extend(path for path in PUBLIC_DIR.rglob("*") if path.is_file())
    snapshot = {}

    for path in watched_files:
        try:
            stat = path.stat()
        except OSError:
            continue
        snapshot[str(path)] = (stat.st_mtime_ns, stat.st_size)

    return snapshot


def watch_files():
    previous = snapshot_files()

    while True:
        time.sleep(0.25)
        current = snapshot_files()

        if current == previous:
            continue

        changed_paths = {
            Path(path)
            for path in set(current).symmetric_difference(previous)
            | {path for path in current if previous.get(path) != current.get(path)}
        }
        previous = current

        notify_reload()

        if Path(__file__).resolve() in changed_paths:
            time.sleep(0.15)
            os.execv(sys.executable, [sys.executable, *sys.argv])


def safe_public_path(request_path):
    decoded_path = unquote(request_path)
    relative_path = decoded_path.lstrip("/") or "index.html"
    file_path = (PUBLIC_DIR / relative_path).resolve()

    if not file_path.is_relative_to(PUBLIC_DIR):
        return None

    return file_path


class Handler(BaseHTTPRequestHandler):
    def send_body(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/api/health":
            body = json.dumps({"ok": True}).encode("utf-8")
            self.send_body(200, body, MIME_TYPES[".json"])
            return

        if path == "/api/environment-check":
            body = json.dumps(build_environment_check()).encode("utf-8")
            self.send_body(200, body, MIME_TYPES[".json"])
            return

        if path == "/__reload":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache, no-transform")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            self.wfile.write(b"\n")
            self.wfile.flush()

            seen_version = reload_version
            while True:
                with reload_condition:
                    reload_condition.wait_for(lambda: reload_version != seen_version)
                    seen_version = reload_version

                try:
                    self.wfile.write(b"event: reload\ndata: now\n\n")
                    self.wfile.flush()
                except OSError:
                    break
            return

        if path == "/__dev-reload.js":
            self.send_body(200, DEV_RELOAD_SCRIPT, MIME_TYPES[".js"])
            return

        file_path = safe_public_path(path)
        if file_path is None:
            self.send_body(403, b"Forbidden", "text/plain; charset=utf-8")
            return

        if not file_path.exists() or file_path.is_dir():
            file_path = PUBLIC_DIR / "index.html"

        try:
            body = file_path.read_bytes()
        except OSError:
            self.send_body(404, b"Not Found", "text/plain; charset=utf-8")
            return

        content_type = MIME_TYPES.get(file_path.suffix.lower(), "application/octet-stream")
        self.send_body(200, body, content_type)

    def log_message(self, format, *args):
        return


def serve(port):
    try:
        server = ThreadingHTTPServer(("localhost", port), Handler)
    except OSError:
        if port < PREFERRED_PORT + 20:
            return serve(port + 1)
        raise

    try:
        print(f"http://localhost:{port}", flush=True)
    except OSError:
        pass

    server.serve_forever()


if __name__ == "__main__":
    threading.Thread(target=watch_files, daemon=True).start()
    serve(PREFERRED_PORT)
