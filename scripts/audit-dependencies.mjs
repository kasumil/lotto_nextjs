import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const severities = ["info", "low", "moderate", "high", "critical"];

// npm can exit 1 for findings OR registry errors. A nonempty, valid audit v2
// report is required before interpreting severity counts. Never treat an error
// response, interrupted process, or empty stdout as a clean audit.
export function assessAudit(stdout, status) {
  if (status !== 0 && status !== 1) {
    throw new Error(`npm audit did not complete normally (exit ${status})`);
  }
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    throw new Error("npm audit returned invalid or empty JSON");
  }
  if (!report || report.error || report.auditReportVersion !== 2) {
    throw new Error("npm audit returned an error or unsupported report schema");
  }
  const counts = report.metadata?.vulnerabilities;
  const findings = report.vulnerabilities;
  if (!counts || !findings || typeof findings !== "object" || Array.isArray(findings)) {
    throw new Error("npm audit is missing vulnerability data");
  }
  const actual = Object.fromEntries(severities.map((severity) => [severity, 0]));
  for (const finding of Object.values(findings)) {
    if (!finding || !severities.includes(finding.severity)) {
      throw new Error("npm audit contains an invalid severity");
    }
    actual[finding.severity] += 1;
  }
  for (const severity of severities) {
    if (!Number.isSafeInteger(counts[severity]) || counts[severity] < 0 || counts[severity] !== actual[severity]) {
      throw new Error(`npm audit contains inconsistent ${severity} counts`);
    }
  }
  if (counts.total !== Object.keys(findings).length) {
    throw new Error("npm audit contains an inconsistent total");
  }
  const blocked = counts.low + counts.moderate + counts.high + counts.critical;
  if ((blocked > 0) !== (status === 1)) {
    throw new Error("npm audit exit status disagrees with the low severity threshold");
  }
  return { counts, blocked };
}

export function runAudits({ run = spawnSync, reportDir = "security-reports" } = {}) {
  mkdirSync(reportDir, { recursive: true });
  let failed = false;
  for (const [scope, extraArgs] of [["all", []], ["production", ["--omit=dev"]]]) {
    const result = run("npm", ["audit", "--package-lock-only", "--ignore-scripts", "--audit-level=low", "--json", ...extraArgs], {
      encoding: "utf8",
      timeout: 180_000,
      maxBuffer: 32 * 1024 * 1024,
    });
    writeFileSync(resolve(reportDir, `npm-audit-${scope}.json`), result.stdout ?? "");
    writeFileSync(resolve(reportDir, `npm-audit-${scope}.stderr.txt`), result.stderr ?? "");
    try {
      if (result.error || result.signal) {
        throw new Error(result.error?.message ?? `npm audit terminated by ${result.signal}`);
      }
      const { counts, blocked } = assessAudit(result.stdout, result.status);
      console.log(`${scope}: ${JSON.stringify(counts)}; low+ gate: ${blocked ? "FAIL" : "PASS"}`);
      failed ||= blocked > 0;
    } catch (error) {
      console.error(`${scope}: audit unavailable, publication blocked: ${error.message}`);
      failed = true;
    }
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runAudits();
}
