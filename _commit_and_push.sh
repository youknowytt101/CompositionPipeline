#!/usr/bin/env bash
# One-shot commit + push helper. Safe to delete after use.
set -e
cd "$(dirname "$0")"

echo "=== repo: $(pwd) ==="

# Clear any stale git lock left by an interrupted process.
if [ -f .git/index.lock ]; then
  echo "Removing stale .git/index.lock"
  rm -f .git/index.lock
fi

echo "=== branch ==="
git branch --show-current

echo "=== staging all changes ==="
git add -A

echo "=== status (short) ==="
git status --short

echo "=== committing ==="
git commit -m "Add toon rendering, environment color, play-mode camera, shadow/occluder fixes, and minimal UE export

- Toon (cel) material: 3-step ramp + inverted-hull outline on cube/sphere/character
- Controllable environment color tinting object dark areas (live update)
- Third-person play camera: pointer lock + per-frame damped free rotation
- Shadow frustum and opaque ground occluder fixes; reduced shadow shimmer
- UE export trimmed to mesh + transform + semantic; browser classification kept
- Region-sync / instancing composition design doc"

echo "=== pushing to origin ==="
git push origin HEAD

echo "=== DONE ==="
git log --oneline -1
