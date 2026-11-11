import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { assessAudit, runAudits } from "./audit-dependencies.mjs";
import { assessImage } from "./check-image-report.mjs";

const audit = (severity) => {
  const vulnerabilities = severity ? { example: { severity } } : {};
  const counts = Object.fromEntries(["info", "low", "moderate", "high", "critical"].map((s) => [s, Number(s === severity)]));
  return { auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: { ...counts, total: severity ? 1 : 0 } } };
};
const image = () => ({
  SchemaVersion: 2, ArtifactType: "container_image",
  Metadata: { ImageID: `sha256:${"a".repeat(64)}`, ImageConfig: { architecture: "amd64" } },
  Results: [
    { Class: "os-pkgs", Packages: [{ Name: "zlib" }] },
    { Class: "lang-pkgs", Packages: [{ Name: "next", FilePath: "app/node_modules/next/package.json" }] },
  ],
});

test("audit allows zero and blocks every non-info severity", () => {
  assert.equal(assessAudit(JSON.stringify(audit()), 0).blocked, 0);
  for (const severity of ["low", "moderate", "high", "critical"]) {
    assert.equal(assessAudit(JSON.stringify(audit(severity)), 1).blocked, 1);
  }
});
test("audit fails closed on errors, malformed schema and inconsistent exits", () => {
  for (const text of ["", "null", "{}", '{"error":{"code":"ENOAUDIT"}}', "not JSON"]) {
    assert.throws(() => assessAudit(text, 0));
  }
  assert.throws(() => assessAudit(JSON.stringify(audit()), 2));
  assert.throws(() => assessAudit(JSON.stringify(audit("low")), 0));
  const mismatched = audit(); mismatched.metadata.vulnerabilities.total = 1;
  assert.throws(() => assessAudit(JSON.stringify(mismatched), 0));
});
test("audit keeps both reports and blocks registry/process failures", () => {
  const dir = mkdtempSync(join(tmpdir(), "lotto-audit-test-"));
  try {
    let calls = 0;
    assert.equal(runAudits({ reportDir: dir, run: () => (++calls, { status: null, error: new Error("offline"), stdout: "", stderr: "offline" }) }), 1);
    assert.equal(calls, 2);
    assert.equal(readFileSync(join(dir, "npm-audit-production.stderr.txt"), "utf8"), "offline");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test("image permits zero CVEs and blocks every severity, including unknown", () => {
  assert.equal(assessImage(image(), "amd64").blocked, 0);
  for (const Severity of ["UNKNOWN", "LOW", "MEDIUM", "HIGH", "CRITICAL"]) {
    const report = image(); report.Results[0].Vulnerabilities = [{ Severity, VulnerabilityID: "CVE-test" }];
    assert.equal(assessImage(report, "amd64").blocked, 1);
  }
});
test("image requires the expected platform and both OS and app coverage", () => {
  assert.throws(() => assessImage(image(), "arm64"));
  for (const report of [null, {}, { ...image(), Results: [] }, { ...image(), Results: [image().Results[0]] }]) {
    assert.throws(() => assessImage(report, "amd64"));
  }
  const report = image(); report.Results[1].Packages[0].FilePath = "not-app/next/package.json";
  assert.throws(() => assessImage(report, "amd64"));
});
test("image refuses runtime package managers and invalid finding lists", () => {
  const report = image(); report.Results[1].Packages.push({ Name: "npm", FilePath: "usr/local/lib/node_modules/npm/package.json" });
  assert.throws(() => assessImage(report, "amd64"));
  const malformed = image(); malformed.Results[0].Vulnerabilities = {};
  assert.throws(() => assessImage(malformed, "amd64"));
});
test("archive identity binds scan, architecture, bytes and loaded Docker ID", () => {
  const dir = mkdtempSync(join(tmpdir(), "lotto-image-test-"));
  const script = resolve("scripts/image-archive.py");
  const create = `import io,json,tarfile,hashlib,sys,pathlib\nr=pathlib.Path(sys.argv[1]); c=json.dumps({'architecture':'amd64','os':'linux'}).encode(); h=hashlib.sha256(c).hexdigest(); m=json.dumps([{'Config':h+'.json','RepoTags':['lotto-security:test-amd64']}]).encode()\nwith tarfile.open(r/'image.tar','w') as t:\n for name,data in [(h+'.json',c),('manifest.json',m)]:\n  i=tarfile.TarInfo(name);i.size=len(data);t.addfile(i,io.BytesIO(data))\n(r/'trivy-image.json').write_text(json.dumps({'Metadata':{'ImageID':'sha256:'+h}}))`;
  try {
    assert.equal(spawnSync("python3", ["-c", create, dir]).status, 0);
    const run = (...args) => spawnSync("python3", [script, ...args], { encoding: "utf8" });
    assert.equal(run("record", dir, "amd64").status, 0);
    assert.equal(run("verify", dir, "amd64").status, 0);
    assert.notEqual(run("verify", dir, "arm64").status, 0);
    assert.notEqual(run("verify", dir, "amd64", `sha256:${"b".repeat(64)}`).status, 0);
    const record = JSON.parse(readFileSync(join(dir, "archive.json"), "utf8")); record.sha256 = "changed";
    writeFileSync(join(dir, "archive.json"), JSON.stringify(record));
    assert.notEqual(run("verify", dir, "amd64").status, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
