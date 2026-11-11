#!/bin/bash
set -euo pipefail
# One publisher at a time. This script never updates the live :latest tag.
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
VERSION_FILE="version.txt"
CURRENT_VERSION="1.0.0"
if [ -f "$VERSION_FILE" ]; then CURRENT_VERSION=$(cat "$VERSION_FILE"); fi
if [[ ! "$CURRENT_VERSION" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  echo "Invalid version.txt: expected MAJOR.MINOR.PATCH" >&2
  exit 1
fi
MAJOR="${BASH_REMATCH[1]}"; MINOR="${BASH_REMATCH[2]}"; PATCH="${BASH_REMATCH[3]}"
NEW_VERSION="$MAJOR.$MINOR.$((10#$PATCH + 1))"
VERSION_TEMP=$(mktemp "${VERSION_FILE}.tmp.XXXXXX")
ARTIFACTS=$(mktemp -d)
trap 'rm -f -- "$VERSION_TEMP"; rm -rf -- "$ARTIFACTS"' EXIT
printf '%s\n' "$NEW_VERSION" > "$VERSION_TEMP"
REVISION=$(git rev-parse HEAD)
npm run security:audit
for arch in amd64 arm64; do
  bash scripts/build-scan-image.sh "$arch" "$ARTIFACTS/$arch" "$REVISION"
done
bash scripts/publish-scanned-images.sh ghcr.io/kasumil/lotto-nextjs "$ARTIFACTS" "$NEW_VERSION"
mv -- "$VERSION_TEMP" "$VERSION_FILE"
echo "Done! Image pushed: ghcr.io/kasumil/lotto-nextjs:$NEW_VERSION"
