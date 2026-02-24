import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadCollectedResults, type CollectedResult } from "./json.js";

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

function escapeCsvField(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

interface AxeNode {
  target?: string[];
  html?: string;
  failureSummary?: string;
}

interface AxeRule {
  id?: string;
  impact?: string;
  description?: string;
  help?: string;
  helpUrl?: string;
  tags?: string[];
  nodes?: AxeNode[];
}

function ruleToRows(
  pageUrl: string,
  type: string,
  rule: AxeRule,
): string[][] {
  const wcag = (rule.tags ?? [])
    .filter((t: string) => t.startsWith("wcag") || t === "best-practice" || t === "section508")
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

export function generateCsvReport(
  tmpDir: string,
  cwd: string = process.cwd()
): void {
  const collected = loadCollectedResults(tmpDir);

  const rows: string[][] = [HEADERS];

  for (const item of collected) {
    if (!item.axeResults) continue;

    const pageUrl = item.axeResults.url ?? item.url;
    const types: Array<{ key: string; data: AxeRule[] }> = [
      { key: "violations", data: (item.axeResults.violations ?? []) as AxeRule[] },
      { key: "incomplete", data: (item.axeResults.incomplete ?? []) as AxeRule[] },
      { key: "passes", data: (item.axeResults.passes ?? []) as AxeRule[] },
      { key: "inapplicable", data: (item.axeResults.inapplicable ?? []) as AxeRule[] },
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
