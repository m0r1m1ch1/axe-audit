import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadCollectedResults } from "./json.js";
const BOM = "\uFEFF";
const HEADERS = [
    "page",
    "type",
    "impact",
    "ruleId",
    "help",
    "html",
    "target",
    "failureSummary",
    "wcag",
    "helpUrl",
];
function escapeCsvField(value) {
    if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
        return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
}
function ruleToRows(pageUrl, type, rule) {
    const wcag = (rule.tags ?? [])
        .filter((t) => t.startsWith("wcag") || t === "best-practice" || t === "section508")
        .join("; ");
    const nodes = rule.nodes ?? [];
    if (nodes.length === 0) {
        return [[
                pageUrl,
                type,
                rule.impact ?? "",
                rule.id ?? "",
                rule.help ?? "",
                "",
                "",
                "",
                wcag,
                rule.helpUrl ?? "",
            ]];
    }
    return nodes.map((node) => [
        pageUrl,
        type,
        rule.impact ?? "",
        rule.id ?? "",
        rule.help ?? "",
        node.html ?? "",
        (node.target ?? []).join("; "),
        node.failureSummary ?? "",
        wcag,
        rule.helpUrl ?? "",
    ]);
}
export function generateCsvReport(tmpDir, cwd = process.cwd()) {
    const collected = loadCollectedResults(tmpDir);
    const rows = [HEADERS];
    for (const item of collected) {
        if (!item.axeResults)
            continue;
        const pageUrl = item.axeResults.url ?? item.url;
        const types = [
            { key: "violations", data: (item.axeResults.violations ?? []) },
            { key: "incomplete", data: (item.axeResults.incomplete ?? []) },
            { key: "passes", data: (item.axeResults.passes ?? []) },
            { key: "inapplicable", data: (item.axeResults.inapplicable ?? []) },
        ];
        for (const { key, data } of types) {
            for (const rule of data) {
                rows.push(...ruleToRows(pageUrl, key, rule));
            }
        }
    }
    const csvContent = BOM + rows
        .map((row) => row.map(escapeCsvField).join(","))
        .join("\r\n") + "\r\n";
    const outputDir = resolve(cwd, "axe-audit");
    mkdirSync(outputDir, { recursive: true });
    const outputPath = resolve(outputDir, "report.csv");
    writeFileSync(outputPath, csvContent, "utf-8");
    console.log(`CSV report saved: ${outputPath}`);
}
