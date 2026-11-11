#!/bin/bash
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
FIXTURE=$(mktemp -d)
trap 'rm -rf -- "$FIXTURE"' EXIT
mkdir "$FIXTURE/bin" "$FIXTURE/scripts"
cp "$ROOT/build.sh" "$FIXTURE/build.sh"
cat > "$FIXTURE/bin/git" <<'MOCK'
#!/bin/bash
printf '%040d\n' 1
MOCK
cat > "$FIXTURE/bin/npm" <<'MOCK'
#!/bin/bash
echo audit >> "$FAKE_EVENTS"
exit "${FAKE_AUDIT_EXIT:-0}"
MOCK
cat > "$FIXTURE/scripts/build-scan-image.sh" <<'MOCK'
#!/bin/bash
echo "scan $1" >> "$FAKE_EVENTS"
if [ "${FAKE_FAIL_ARCH:-}" = "$1" ]; then exit 17; fi
MOCK
cat > "$FIXTURE/scripts/publish-scanned-images.sh" <<'MOCK'
#!/bin/bash
echo "publish $1 $3" >> "$FAKE_EVENTS"
exit "${FAKE_PUBLISH_EXIT:-0}"
MOCK
chmod +x "$FIXTURE/bin/"*
export PATH="$FIXTURE/bin:$PATH" FAKE_EVENTS="$FIXTURE/events"
for stage in audit amd64 arm64 publish; do
  printf '1.2.3\n' > "$FIXTURE/version.txt"
  : > "$FAKE_EVENTS"
  export FAKE_AUDIT_EXIT=0 FAKE_FAIL_ARCH='' FAKE_PUBLISH_EXIT=0
  case "$stage" in audit) export FAKE_AUDIT_EXIT=17;; amd64|arm64) export FAKE_FAIL_ARCH="$stage";; publish) export FAKE_PUBLISH_EXIT=17;; esac
  if bash "$FIXTURE/build.sh" > "$FIXTURE/output" 2>&1; then echo "Expected $stage failure" >&2; exit 1; else result=$?; fi
  [ "$result" -eq 17 ]
  [ "$(cat "$FIXTURE/version.txt")" = '1.2.3' ]
  ! grep -q 'Done!' "$FIXTURE/output"
  [ "$stage" = publish ] || ! grep -q '^publish' "$FAKE_EVENTS"
  [ -z "$(find "$FIXTURE" -name 'version.txt.tmp.*' -print)" ]
done
export FAKE_AUDIT_EXIT=0 FAKE_FAIL_ARCH='' FAKE_PUBLISH_EXIT=0
: > "$FAKE_EVENTS"
bash "$FIXTURE/build.sh" > "$FIXTURE/output" 2>&1
[ "$(cat "$FIXTURE/version.txt")" = '1.2.4' ]
[ "$(cat "$FAKE_EVENTS")" = $'audit\nscan amd64\nscan arm64\npublish ghcr.io/kasumil/lotto-nextjs 1.2.4' ]
! grep -q ':latest\| latest' "$FAKE_EVENTS"
grep -q 'Done! Image pushed:' "$FIXTURE/output"
printf 'invalid\n' > "$FIXTURE/version.txt"
: > "$FAKE_EVENTS"
if bash "$FIXTURE/build.sh" > "$FIXTURE/output" 2>&1; then exit 1; fi
[ ! -s "$FAKE_EVENTS" ]
[ "$(cat "$FIXTURE/version.txt")" = invalid ]
rm "$FIXTURE/version.txt"
export FAKE_AUDIT_EXIT=17
if bash "$FIXTURE/build.sh" > "$FIXTURE/output" 2>&1; then exit 1; fi
[ ! -e "$FIXTURE/version.txt" ]
echo 'Manual publication: audit/platform/publish failure blocks, version unchanged, exact order, no latest PASS'
