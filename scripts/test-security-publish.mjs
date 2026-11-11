import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const archiveTool = resolve("scripts/image-archive.py");
const publisher = resolve("scripts/publish-scanned-images.sh");
const seed = `import io,json,tarfile,hashlib,sys,pathlib
r=pathlib.Path(sys.argv[1]); a=sys.argv[2]; c=json.dumps({'architecture':a,'os':'linux'}).encode(); h=hashlib.sha256(c).hexdigest(); m=json.dumps([{'Config':h+'.json','RepoTags':['lotto-security:test-'+a]}]).encode()
with tarfile.open(r/'image.tar','w') as t:
 for name,data in [(h+'.json',c),('manifest.json',m)]:
  i=tarfile.TarInfo(name);i.size=len(data);t.addfile(i,io.BytesIO(data))
(r/'trivy-image.json').write_text(json.dumps({'SchemaVersion':2,'ArtifactType':'container_image','Metadata':{'ImageID':'sha256:'+h,'ImageConfig':{'architecture':a}},'Results':[{'Class':'os-pkgs','Packages':[{'Name':'zlib'}]},{'Class':'lang-pkgs','Packages':[{'Name':'next','FilePath':'app/node_modules/next/package.json'}]}]}))`;

test("publisher validates both platforms before any write and only promotes inspected digests", () => {
  const root = mkdtempSync(join(tmpdir(), "lotto-publish-test-"));
  const bin = join(root, "bin"); mkdirSync(bin);
  const events = join(root, "events");
  try {
    const ids = {};
    for (const arch of ["amd64", "arm64"]) {
      const dir = join(root, arch); mkdirSync(dir);
      assert.equal(spawnSync("python3", ["-c", seed, dir, arch]).status, 0);
      assert.equal(spawnSync("python3", [archiveTool, "record", dir, arch]).status, 0);
      ids[arch] = JSON.parse(readFileSync(join(dir, "archive.json"), "utf8")).ids[0];
    }
    const docker = join(bin, "docker");
    writeFileSync(docker, `#!/bin/bash
set -euo pipefail
printf '%s\\n' "$*" >> "$FAKE_EVENTS"
case "$1 $2" in
  'image inspect')
    if [ "\${FAKE_WRONG_ID:-}" = 1 ]; then printf 'sha256:%064d\\n' 0
    elif [[ "\${!#}" == *-amd64 ]]; then echo "$FAKE_AMD64_ID"; else echo "$FAKE_ARM64_ID"; fi;;
  'buildx imagetools')
    if [ "$3" = inspect ]; then printf 'Digest: sha256:%064d\\n' 1; fi;;
esac
`);
    chmodSync(docker, 0o755);
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_EVENTS: events, FAKE_AMD64_ID: ids.amd64, FAKE_ARM64_ID: ids.arm64 };
    const run = (extraEnv = {}) => {
      writeFileSync(events, "");
      return spawnSync("bash", [publisher, "ghcr.io/kasumil/lotto-nextjs", root, "audit-test"], { env: { ...env, ...extraEnv }, encoding: "utf8" });
    };
    let result = run(); assert.equal(result.status, 0, result.stderr);
    let log = readFileSync(events, "utf8");
    assert.equal(log.split("\n").filter((s) => s.startsWith("push ")).length, 2);
    assert.match(log, /buildx imagetools create --tag ghcr.io\/kasumil\/lotto-nextjs:audit-test ghcr.io\/kasumil\/lotto-nextjs@sha256:/);
    assert.doesNotMatch(log, /buildx build/);
    result = run({ FAKE_WRONG_ID: "1" }); assert.notEqual(result.status, 0);
    assert.doesNotMatch(readFileSync(events, "utf8"), /^push |imagetools create/m);
    const armReport = join(root, "arm64", "trivy-image.json");
    const clean = readFileSync(armReport, "utf8"); const report = JSON.parse(clean);
    report.Results[0].Vulnerabilities = [{ Severity: "LOW", VulnerabilityID: "CVE-test" }];
    writeFileSync(armReport, JSON.stringify(report));
    result = run(); assert.notEqual(result.status, 0);
    assert.equal(readFileSync(events, "utf8"), "");
    writeFileSync(armReport, clean);
    const recorded = join(root, "arm64", "archive.json");
    const altered = JSON.parse(readFileSync(recorded, "utf8")); altered.sha256 = "tampered";
    writeFileSync(recorded, JSON.stringify(altered));
    result = run(); assert.notEqual(result.status, 0);
    assert.equal(readFileSync(events, "utf8"), "");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
