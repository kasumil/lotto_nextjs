#!/bin/bash
set -euo pipefail

# Run one publisher at a time; version replacement does not serialize concurrent builds.
# Work relative to this script even when invoked from another directory.
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
VERSION_FILE="version.txt"
CURRENT_VERSION="1.0.0"
if [ -f "$VERSION_FILE" ]; then
  CURRENT_VERSION=$(cat "$VERSION_FILE")
fi
if [[ ! "$CURRENT_VERSION" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  echo "Invalid version.txt: expected MAJOR.MINOR.PATCH" >&2
  exit 1
fi
MAJOR="${BASH_REMATCH[1]}"
MINOR="${BASH_REMATCH[2]}"
PATCH="${BASH_REMATCH[3]}"
NEW_VERSION="$MAJOR.$MINOR.$((10#$PATCH + 1))"
IMAGE_NAME="ghcr.io/kasumil/lotto-nextjs:$NEW_VERSION"

# Prepare local state before publishing, but commit it only after Docker succeeds.
VERSION_TEMP=$(mktemp "${VERSION_FILE}.tmp.XXXXXX")
trap 'rm -f -- "$VERSION_TEMP"' EXIT
printf '%s\n' "$NEW_VERSION" > "$VERSION_TEMP"
echo "Building and pushing Docker image: $IMAGE_NAME"
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t "$IMAGE_NAME" \
  --push \
  .
mv -- "$VERSION_TEMP" "$VERSION_FILE"
echo "Done! Image pushed: $IMAGE_NAME"
