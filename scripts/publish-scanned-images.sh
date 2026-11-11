#!/bin/bash
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"
IMAGE=${1:?image repository required}
ARTIFACTS=${2:?artifact directory required}
shift 2
[ "$#" -gt 0 ] || { echo "At least one release tag required" >&2; exit 1; }
[[ "$IMAGE" == "ghcr.io/kasumil/lotto-nextjs" ]] || { echo "Unexpected image repository" >&2; exit 1; }
for tag in "$@"; do [[ "$tag" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$ ]] || exit 1; done
# Recheck BOTH artifacts before the first registry write; never rebuild here.
for arch in amd64 arm64; do
  node scripts/check-image-report.mjs "$ARTIFACTS/$arch/trivy-image.json" "$arch"
  python3 scripts/image-archive.py verify "$ARTIFACTS/$arch" "$arch" > /dev/null
done
sources=()
run_id="${GITHUB_RUN_ID:-manual-$(date +%s)}-${GITHUB_RUN_ATTEMPT:-1}"
for arch in amd64 arm64; do
  dir="$ARTIFACTS/$arch"
  local_tag=$(python3 scripts/image-archive.py verify "$dir" "$arch")
  docker load --input "$dir/image.tar"
  loaded_id=$(docker image inspect --format '{{.Id}}' "$local_tag")
  python3 scripts/image-archive.py verify "$dir" "$arch" "$loaded_id" > /dev/null
  candidate="$IMAGE:scanned-$run_id-$arch"
  docker tag "$local_tag" "$candidate"
  docker push "$candidate"
  digest=$(docker buildx imagetools inspect "$candidate" | awk '/^Digest:/ {print $2; exit}')
  [[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo "Missing registry image digest" >&2; exit 1; }
  sources+=("$IMAGE@$digest")
done
tags=()
for tag in "$@"; do tags+=(--tag "$IMAGE:$tag"); done
docker buildx imagetools create "${tags[@]}" "${sources[@]}"
