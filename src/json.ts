import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { getToolVersion } from "./config.js";
import type { AuditReport, AuditPageResult, AuditSummary, PageInfo } from "./types.js";

interface CollectedResult {
  url: string;
  axeResults: {
    testEngine?: { version?: string };
    url?: string;
    violations?: unknown[];
    incomplete?: unknown[];
    passes?: unknown[];
    inapplicable?: unknown[];
  } | null;
  error: string | null;
}

function loadCollectedResults(tmpDir: string): CollectedResult[] {
  const resultsPath = join(tmpDir, "axe-results.json");
  try {
    const raw = readFileSync(resultsPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function generateJsonReport(
  tmpDir: string,
  auditedPages: PageInfo[],
  excludedPages: PageInfo[],
  cwd: string = process.cwd()
): void {
  const collected = loadCollectedResults(tmpDir);

  const pages: AuditPageResult[] = [];
  let axeVersion = "";
  let pagesWithErrors = 0;

  for (const item of collected) {
    if (item.axeResults) {
      if (!axeVersion && item.axeResults.testEngine?.version) {
        axeVersion = item.axeResults.testEngine.version;
      }
      pages.push({
        url: item.axeResults.url ?? item.url,
        violations: (item.axeResults.violations ?? []) as AuditPageResult["violations"],
        incomplete: (item.axeResults.incomplete ?? []) as AuditPageResult["incomplete"],
        passes: (item.axeResults.passes ?? []) as AuditPageResult["passes"],
        inapplicable: (item.axeResults.inapplicable ?? []) as AuditPageResult["inapplicable"],
      });
    } else {
      pagesWithErrors++;
    }
  }

  const summary: AuditSummary = {
    totalPages: collected.length,
    totalViolations: pages.reduce((sum, p) => sum + p.violations.length, 0),
    totalIncomplete: pages.reduce((sum, p) => sum + p.incomplete.length, 0),
    pagesWithViolations: pages.filter((p) => p.violations.length > 0).length,
    pagesWithErrors,
  };

  const report: AuditReport = {
    metadata: {
      axeVersion: axeVersion || "unknown",
      timestamp: new Date().toISOString(),
      toolVersion: getToolVersion(),
      auditedPages: auditedPages.map((p) => p.path),
      excludedPages: excludedPages.length > 0 ? excludedPages.map((p) => p.path) : undefined,
    },
    pages,
    summary,
  };

  const outputDir = resolve(cwd, "axe-audit");
  mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, "report.json");
  writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`JSON report saved: ${outputPath}`);
}

// Export for csv.ts to reuse
export { loadCollectedResults, type CollectedResult };
