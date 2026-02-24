import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { getToolVersion } from "./config.js";
function loadCollectedResults(tmpDir) {
    const resultsPath = join(tmpDir, "axe-results.json");
    try {
        const raw = readFileSync(resultsPath, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return [];
    }
}
export function generateJsonReport(tmpDir, cwd = process.cwd()) {
    const collected = loadCollectedResults(tmpDir);
    const pages = [];
    let axeVersion = "";
    let pagesWithErrors = 0;
    for (const item of collected) {
        if (item.axeResults) {
            if (!axeVersion && item.axeResults.testEngine?.version) {
                axeVersion = item.axeResults.testEngine.version;
            }
            pages.push({
                url: item.axeResults.url ?? item.url,
                violations: (item.axeResults.violations ?? []),
                incomplete: (item.axeResults.incomplete ?? []),
                passes: (item.axeResults.passes ?? []),
                inapplicable: (item.axeResults.inapplicable ?? []),
            });
        }
        else {
            pagesWithErrors++;
        }
    }
    const summary = {
        totalPages: collected.length,
        totalViolations: pages.reduce((sum, p) => sum + p.violations.length, 0),
        totalIncomplete: pages.reduce((sum, p) => sum + p.incomplete.length, 0),
        pagesWithViolations: pages.filter((p) => p.violations.length > 0).length,
        pagesWithErrors,
    };
    const report = {
        metadata: {
            axeVersion: axeVersion || "unknown",
            timestamp: new Date().toISOString(),
            toolVersion: getToolVersion(),
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
export { loadCollectedResults };
