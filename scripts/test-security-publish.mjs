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
    writeFileSync(docker, `#!/usr/bin/env node
const fs = require("node:fs"), crypto = require("node:crypto");
const args = process.argv.slice(2), env = process.env;
fs.appendFileSync(env.FAKE_EVENTS, JSON.stringify(args) + "\\n");
const digest = (text) => "sha256:" + crypto.createHash("sha256").update(text).digest("hex");
const imageType = "application/vnd.oci.image.manifest.v1+json";
const configs = { amd64: env.FAKE_AMD64_ID, arm64: env.FAKE_ARM64_ID };
const images = {};
for (const arch of ["amd64", "arm64"]) {
  const config = env.FAKE_WRONG_CONFIG === arch ? configs.amd64 : configs[arch];
  const raw = JSON.stringify({schemaVersion:2,mediaType:imageType,config:{mediaType:"application/vnd.oci.image.config.v1+json",digest:config,size:100},layers:[{mediaType:"application/vnd.oci.image.layer.v1.tar+gzip",digest:"sha256:"+"c".repeat(64),size:10}]});
  images[arch] = {raw,digest:digest(raw)};
}
const descriptors = ["amd64", "arm64"].map(arch => ({mediaType:imageType,digest:images[arch].digest,size:images[arch].raw.length,platform:{os:"linux",architecture:arch}}));
if (env.FAKE_BAD_INDEX === "duplicate-platform") descriptors[1].platform.architecture = "amd64";
if (env.FAKE_BAD_INDEX === "wrong-image") descriptors[1].digest = "sha256:"+"d".repeat(64);
const index = JSON.stringify({schemaVersion:2,mediaType:"application/vnd.oci.image.index.v1+json",manifests:descriptors});
const indexDigest = digest(index);
const last = args.at(-1);
if (args[0] === "image" && args[1] === "inspect") {
  const arch = last.endsWith("-amd64") ? "amd64" : "arm64";
  console.log(env.FAKE_WRONG_ID ? "sha256:"+"0".repeat(64) : configs[arch]);
} else if (args[0] === "buildx" && args[1] === "imagetools" && args[2] === "inspect") {
  if (args.includes("--raw")) {
    const requested = last.split("@")[1];
    let raw = requested === indexDigest ? index : Object.values(images).find(x => x.digest === requested)?.raw;
    if (!raw) process.exit(2);
    if (env.FAKE_TAMPER_RAW) raw += " ";
    process.stdout.write(raw);
  } else {
    let value = last.endsWith("-amd64") ? images.amd64.digest : last.endsWith("-arm64") ? images.arm64.digest : indexDigest;
    if (env.FAKE_DUPLICATE_DIGEST && last.endsWith("-arm64")) value = images.amd64.digest;
    if (env.FAKE_WRONG_RELEASE && last.endsWith(":audit-test")) value = "sha256:"+"f".repeat(64);
    console.log("Digest: " + value);
  }
}
`);
    chmodSync(docker, 0o755);
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_EVENTS: events, FAKE_AMD64_ID: ids.amd64, FAKE_ARM64_ID: ids.arm64 };
    const run = (extraEnv = {}) => {
      writeFileSync(events, "");
      return spawnSync("bash", [publisher, "ghcr.io/kasumil/lotto-nextjs", root, "audit-test"], { env: { ...env, ...extraEnv }, encoding: "utf8" });
    };
    let result = run(); assert.equal(result.status, 0, result.stderr);
    const readEvents = () => readFileSync(events, "utf8").trim().split("\n").filter(Boolean).map((s) => JSON.parse(s));
    let log = readEvents();
    assert.equal(log.filter((a) => a[0] === "push").length, 2);
    const releases = () => readEvents().filter((a) => a[2] === "create" && a.includes("ghcr.io/kasumil/lotto-nextjs:audit-test"));
    assert.equal(releases().length, 1);
    assert.equal(releases()[0].length, 6); // one verified index source, never two unchecked image sources
    assert.equal(log.some((a) => a[0] === "buildx" && a[1] === "build"), false);
    result = run({ FAKE_WRONG_ID: "1" }); assert.notEqual(result.status, 0);
    assert.equal(readEvents().some((a) => a[0] === "push" || a[2] === "create"), false);
    for (const failure of [
      { FAKE_WRONG_CONFIG: "arm64" }, { FAKE_DUPLICATE_DIGEST: "1" },
      { FAKE_TAMPER_RAW: "1" }, { FAKE_BAD_INDEX: "duplicate-platform" },
      { FAKE_BAD_INDEX: "wrong-image" },
    ]) {
      result = run(failure);
      assert.notEqual(result.status, 0, JSON.stringify(failure));
      assert.equal(releases().length, 0, `Release tag changed after ${JSON.stringify(failure)}`);
    }
    result = run({ FAKE_WRONG_RELEASE: "1" });
    assert.notEqual(result.status, 0, "Final release tag identity mismatch must be reported");
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
