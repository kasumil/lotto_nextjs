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
REMOTE_REPORTS=$(mktemp -d)
trap 'rm -rf -- "$REMOTE_REPORTS"' EXIT
read_digest() {
  # GHCR can briefly return an error just after creating a tag. Read the
  # complete response so pipefail cannot turn awk's early exit into SIGPIPE.
  # Every attempt must still yield a well-formed digest; callers compare it
  # with the already verified release index before reporting success.
  local report digest attempt
  for attempt in 1 2 3 4 5; do
    if report=$(docker buildx imagetools inspect "$1" 2>/dev/null); then
      digest=$(printf '%s\n' "$report" | awk '/^Digest:/ && !seen {print $2; seen=1}')
      if [[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]]; then
        printf '%s\n' "$digest"
        return 0
      fi
    fi
    if (( attempt < 5 )); then sleep 2; fi
  done
  echo "Could not read registry digest after five attempts" >&2
  return 1
}
sources=()
platform_digests=()
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
  digest=$(read_digest "$candidate")
  [[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo "Missing registry image digest" >&2; exit 1; }
  docker buildx imagetools inspect --raw "$IMAGE@$digest" > "$REMOTE_REPORTS/$arch.json"
  python3 scripts/verify-registry-manifest.py image "$REMOTE_REPORTS/$arch.json" \
    "$digest" "$dir/archive.json" "$arch"
  sources+=("$IMAGE@$digest")
  platform_digests+=("$arch=$digest")
done
[ "${sources[0]}" != "${sources[1]}" ] || { echo "Duplicate platform digests" >&2; exit 1; }
# Assemble under an unmonitored, unique candidate tag first. Validate both
# platform descriptors before touching any release tag (especially latest).
index_candidate="$IMAGE:scanned-$run_id-index"
docker buildx imagetools create --tag "$index_candidate" "${sources[@]}"
index_digest=$(read_digest "$index_candidate")
[[ "$index_digest" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo "Missing release index digest" >&2; exit 1; }
docker buildx imagetools inspect --raw "$IMAGE@$index_digest" > "$REMOTE_REPORTS/index.json"
python3 scripts/verify-registry-manifest.py index "$REMOTE_REPORTS/index.json" \
  "$index_digest" "${platform_digests[@]}"
tags=()
for tag in "$@"; do tags+=(--tag "$IMAGE:$tag"); done
# A single existing index is copied without rebuilding or changing its contents.
docker buildx imagetools create "${tags[@]}" "$IMAGE@$index_digest"
for tag in "$@"; do
  published_digest=$(read_digest "$IMAGE:$tag")
  [ "$published_digest" = "$index_digest" ] || { echo "Published tag digest mismatch: $tag" >&2; exit 1; }
done
