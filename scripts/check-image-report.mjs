import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function assessImage(report, architecture) {
  if (!report || report.SchemaVersion !== 2 || report.ArtifactType !== "container_image" ||
      !/^sha256:[a-f0-9]{64}$/.test(report.Metadata?.ImageID ?? "") ||
      report.Metadata?.ImageConfig?.architecture !== architecture || !Array.isArray(report.Results)) {
    throw new Error("Invalid, empty or wrong-platform image report");
  }
  const os = report.Results.filter((r) => r.Class === "os-pkgs");
  const lang = report.Results.filter((r) => r.Class === "lang-pkgs");
  if (!os.some((r) => r.Packages?.length > 0) ||
      !lang.some((r) => r.Packages?.some((p) => p.Name === "next" && p.FilePath?.startsWith("app/")))) {
    throw new Error("Image scan is missing OS or application package coverage");
  }
  if (lang.some((r) => r.Packages?.some((p) => /^(usr\/local\/lib\/node_modules\/npm|opt\/yarn-)/.test(p.FilePath ?? "")))) {
    throw new Error("Unused package managers must not ship in the runtime image");
  }
  const severities = ["UNKNOWN", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const findings = [];
  for (const result of report.Results) {
    if (result.Vulnerabilities !== undefined && !Array.isArray(result.Vulnerabilities)) {
      throw new Error("Invalid vulnerability list");
    }
    for (const finding of result.Vulnerabilities ?? []) {
      if (!severities.includes(finding.Severity) || !finding.VulnerabilityID) {
        throw new Error("Invalid vulnerability entry");
      }
      findings.push(finding);
    }
  }
  const counts = Object.fromEntries(severities.map((s) => [s, findings.filter((f) => f.Severity === s).length]));
  return { counts, blocked: findings.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = assessImage(JSON.parse(readFileSync(process.argv[2], "utf8")), process.argv[3]);
    console.log(`All-severity image gate: ${JSON.stringify(result.counts)}`);
    process.exitCode = result.blocked ? 1 : 0;
  } catch (error) {
    console.error(`Image scan unavailable; publication blocked: ${error.message}`);
    process.exitCode = 1;
  }
}
