#!/bin/bash
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
FIXTURE=$(mktemp -d)
trap 'rm -rf -- "$FIXTURE"' EXIT
mkdir "$FIXTURE/bin"
cp "$ROOT/build.sh" "$FIXTURE/build.sh"
cat > "$FIXTURE/bin/docker" <<'MOCK'
#!/bin/bash
printf '%s\n' "$@" > "$FAKE_DOCKER_ARGS"
exit "${FAKE_DOCKER_EXIT:-0}"
MOCK
chmod +x "$FIXTURE/bin/docker"
export PATH="$FIXTURE/bin:$PATH" FAKE_DOCKER_ARGS="$FIXTURE/args"
printf '1.2.3\n' > "$FIXTURE/version.txt"
export FAKE_DOCKER_EXIT=17
if bash "$FIXTURE/build.sh" > "$FIXTURE/output" 2>&1; then echo 'Expected Docker failure' >&2; exit 1; else result=$?; fi
[ "$result" -eq 17 ]
[ "$(cat "$FIXTURE/version.txt")" = '1.2.3' ]
! grep -q 'Done!' "$FIXTURE/output"
[ -z "$(find "$FIXTURE" -name 'version.txt.tmp.*' -print)" ]
export FAKE_DOCKER_EXIT=0
bash "$FIXTURE/build.sh" > "$FIXTURE/output" 2>&1
[ "$(cat "$FIXTURE/version.txt")" = '1.2.4' ]
grep -qx 'ghcr.io/kasumil/lotto-nextjs:1.2.4' "$FIXTURE/args"
! grep -q ':latest' "$FIXTURE/args"
grep -q 'Done! Image pushed:' "$FIXTURE/output"
printf 'invalid\n' > "$FIXTURE/version.txt"
rm "$FIXTURE/args"
if bash "$FIXTURE/build.sh" > "$FIXTURE/output" 2>&1; then exit 1; fi
[ ! -e "$FIXTURE/args" ]
[ "$(cat "$FIXTURE/version.txt")" = 'invalid' ]
rm "$FIXTURE/version.txt"
export FAKE_DOCKER_EXIT=17
if bash "$FIXTURE/build.sh" > "$FIXTURE/output" 2>&1; then exit 1; fi
[ ! -e "$FIXTURE/version.txt" ]
echo 'Manual build: failure propagation, unchanged version, success commit, no latest, invalid/missing version PASS'
