import json
import os
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
