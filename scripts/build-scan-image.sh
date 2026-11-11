#!/bin/bash
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"
ARCH=${1:?architecture required}
OUTPUT=${2:?output directory required}
REVISION=${3:?source revision required}
case "$ARCH" in amd64|arm64) ;; *) echo "Unsupported platform" >&2; exit 1;; esac
[[ "$REVISION" =~ ^[a-f0-9]{40}$ ]] || { echo "Expected source commit SHA" >&2; exit 1; }
mkdir -p "$OUTPUT"
trivy --version | tee "$OUTPUT/trivy-version.txt"
grep -qx 'Version: 0.76.2' "$OUTPUT/trivy-version.txt"
docker buildx build --platform "linux/$ARCH" --pull --no-cache \
  --output "type=docker,dest=$OUTPUT/image.tar" \
  --tag "lotto-security:$REVISION-$ARCH" \
  --label "org.opencontainers.image.source=https://github.com/kasumil/lotto_nextjs" \
  --label "org.opencontainers.image.revision=$REVISION" .
trivy image --input "$OUTPUT/image.tar" --scanners vuln --ignorefile /dev/null \
  --severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL --ignore-unfixed=false \
  --format json --output "$OUTPUT/trivy-image.json" --timeout 15m
trivy --version > "$OUTPUT/trivy-version.txt"
node scripts/check-image-report.mjs "$OUTPUT/trivy-image.json" "$ARCH"
python3 scripts/image-archive.py record "$OUTPUT" "$ARCH"
