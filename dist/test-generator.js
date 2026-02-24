import { existsSync, mkdtempSync, readdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { AuditError } from "./types.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const _require = createRequire(import.meta.url);
export function discoverPages(distDir, port) {
    if (!existsSync(distDir)) {
        throw new AuditError(`Build output directory "${distDir}" does not exist.\n` +
            `Set the "dist" option in axe-audit.config.mjs to specify your build output directory.`);
    }
    const files = readdirSync(distDir, { recursive: true, encoding: "utf-8" });
    const htmlFiles = files
        .filter((f) => f.endsWith(".html"))
        .sort();
    if (htmlFiles.length === 0) {
        throw new AuditError(`No HTML files found in "${distDir}".`);
    }
    const baseUrl = `http://localhost:${port}`;
    return htmlFiles.map((f) => {
        const normalized = f.replace(/\\/g, "/");
        let pagePath;
        if (normalized === "index.html" || normalized.endsWith("/index.html")) {
            pagePath = "/" + normalized.replace(/\/?index\.html$/, "");
            if (pagePath === "")
                pagePath = "/";
            if (pagePath !== "/" && !pagePath.endsWith("/"))
                pagePath += "/";
        }
        else {
            pagePath = "/" + normalized;
        }
        // URL encode non-ASCII characters in each segment
        const encodedPath = pagePath
            .split("/")
            .map((segment) => (segment ? encodeURIComponent(segment) : ""))
            .join("/");
        return {
            path: pagePath,
            url: baseUrl + encodedPath,
        };
    });
}
export function generateTestFiles(config, pages, cwd = process.cwd()) {
    const tmpDir = mkdtempSync(join(tmpdir(), "axe-audit-"));
    // Create node_modules symlink so generated files can resolve dependencies
    const ownNodeModules = resolve(__dirname, "..", "node_modules");
    const parentNodeModules = resolve(__dirname, "..", "..");
    const symlinkTarget = existsSync(join(ownNodeModules, "@playwright"))
        ? ownNodeModules
        : parentNodeModules;
    try {
        symlinkSync(symlinkTarget, join(tmpDir, "node_modules"));
    }
    catch {
        // Best effort — runner.ts NODE_PATH fallback will handle this
    }
    // Resolve serve path for webServer command
    let servePath;
    try {
        servePath = _require.resolve("serve/build/main.js");
    }
    catch {
        servePath = _require.resolve("serve");
    }
    const distAbsolute = resolve(cwd, config.dist);
    // axe-core のメインファイルを解決し、その親ディレクトリ（node_modules）を取得
    const axeCorePath = _require.resolve("axe-core");
    const nodeModulesDir = dirname(dirname(axeCorePath)); // node_modules ディレクトリ
    // 1. Generate playwright.config.ts
    const playwrightConfig = generatePlaywrightConfig(config, servePath, distAbsolute, tmpDir);
    writeFileSync(join(tmpDir, "playwright.config.ts"), playwrightConfig);
    // 2. Generate axe-results-reporter.ts (custom reporter for data collection)
    const reporterCode = generateResultsReporter();
    writeFileSync(join(tmpDir, "axe-results-reporter.ts"), reporterCode);
    // 3. Generate axe-audit.spec.ts
    const specCode = generateSpec(config, pages, nodeModulesDir);
    writeFileSync(join(tmpDir, "axe-audit.spec.ts"), specCode);
    return tmpDir;
}
export function cleanupTmpDir(tmpDir) {
    try {
        rmSync(tmpDir, { recursive: true, force: true });
    }
    catch {
        // Best effort cleanup
    }
}
function generatePlaywrightConfig(config, servePath, distAbsolute, tmpDir) {
    const resultsPath = join(tmpDir, "axe-results.json").replace(/\\/g, "/");
    return `
export default {
  testDir: ".",
  testMatch: "axe-audit.spec.ts",
  reporter: [
    ["./axe-results-reporter.ts", { outputFile: "${resultsPath}" }],
  ],
  use: {
    baseURL: "http://localhost:${config.port}",
    bypassCSP: true,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: "node \\"${servePath.replace(/\\/g, "/")}\\" \\"${distAbsolute.replace(/\\/g, "/")}\\" --listen ${config.port}",
    url: "http://localhost:${config.port}",
    reuseExistingServer: false,
  },
};
`.trimStart();
}
function generateResultsReporter() {
    return `
import type {
  Reporter,
  TestCase,
  TestResult,
  FullResult,
} from "@playwright/test/reporter";
import { writeFileSync } from "node:fs";

interface AxeViolationNode {
  target: string[];
}

interface AxeViolation {
  id: string;
  impact?: string;
  help: string;
  helpUrl: string;
  nodes: AxeViolationNode[];
}

interface AxePageResults {
  violations: AxeViolation[];
  incomplete: Array<{ id: string }>;
}

interface CollectedResult {
  url: string;
  axeResults: AxePageResults | null;
  error: string | null;
}

class AxeResultsReporter implements Reporter {
  private results: CollectedResult[] = [];
  private outputFile: string;

  constructor(options: { outputFile: string }) {
    this.outputFile = options.outputFile;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const titleParts = test.titlePath();
    const pagePath = titleParts[titleParts.length - 2] || "";

    let axeResults: AxePageResults | null = null;
    let error: string | null = null;

    for (const attachment of result.attachments) {
      if (attachment.name === "axe-results" && attachment.body) {
        try {
          axeResults = JSON.parse(attachment.body.toString("utf-8"));
        } catch {
          // ignore parse errors
        }
      }
    }

    if (result.status === "failed" || result.status === "timedOut") {
      const errorMessages = result.errors.map((e) => e.message || String(e)).join("\\n");
      if (!axeResults) {
        error = errorMessages || "Test failed without axe results";
      }
    }

    this.results.push({ url: pagePath, axeResults, error });
  }

  onEnd(_result: FullResult): void {
    writeFileSync(this.outputFile, JSON.stringify(this.results, null, 2));

    let totalViolations = 0;
    let totalIncomplete = 0;
    const lines: string[] = [];

    for (const entry of this.results) {
      if (entry.error) {
        lines.push("");
        lines.push("  \\u2717 " + entry.url);
        lines.push("    Error: " + entry.error);
        lines.push("");
        continue;
      }

      if (!entry.axeResults) continue;
      const { violations, incomplete } = entry.axeResults;
      totalIncomplete += incomplete.length;

      if (violations.length === 0) continue;
      totalViolations += violations.length;

      lines.push("");
      lines.push("  \\u2717 " + entry.url);
      lines.push("");

      for (const v of violations) {
        const impact = v.impact ?? "unknown";
        lines.push("    [" + impact + "] " + v.id);
        lines.push("    " + v.help);
        for (const node of v.nodes) {
          lines.push("    \\u2192 " + node.target.join(", "));
        }
        lines.push("    " + v.helpUrl);
        lines.push("");
      }
    }

    const pageCount = this.results.length;
    const sep = "  \\u2500\\u2500\\u2500";

    if (lines.length > 0) {
      lines.push(sep);
    }
    lines.push("");
    lines.push("  " + pageCount + " pages audited | " + totalViolations + " violation" + (totalViolations === 1 ? "" : "s") + " | " + totalIncomplete + " incomplete");
    lines.push("");

    console.log(lines.join("\\n"));
  }
}

export default AxeResultsReporter;
`.trimStart();
}
function generateSpec(config, pages, nodeModulesDir) {
    const pagesJson = JSON.stringify(pages, null, 2);
    const axeConfig = config.axe;
    // Build axeSource with locale if needed
    let axeSourceSetup;
    if (axeConfig.locale) {
        const requireBasePath = JSON.stringify(nodeModulesDir + "/index.js");
        const localePath = JSON.stringify("axe-core/locales/" + axeConfig.locale + ".json");
        axeSourceSetup = `
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const _require = createRequire(${requireBasePath});
const axeCoreSource = readFileSync(_require.resolve("axe-core"), "utf-8");
const localeData = JSON.parse(
  readFileSync(_require.resolve(${localePath}), "utf-8")
);
const axeSource = axeCoreSource + "\\naxe.configure({ locale: " + JSON.stringify(localeData) + " });";
`;
    }
    else {
        axeSourceSetup = `
const axeSource = undefined;
`;
    }
    // Build tags logic
    let tagsCode;
    if (axeConfig.tags) {
        const tags = [...axeConfig.tags];
        if (axeConfig.aaa)
            tags.push("wcag2aaa");
        if (axeConfig.experimental)
            tags.push("experimental");
        tagsCode = `const tags: string[] | undefined = ${JSON.stringify(tags)};`;
    }
    else {
        const extraTags = [];
        if (axeConfig.aaa)
            extraTags.push("wcag2aaa");
        if (axeConfig.experimental)
            extraTags.push("experimental");
        if (extraTags.length > 0) {
            const allTags = [
                "wcag2a", "wcag2aa", "wcag21a", "wcag21aa",
                "best-practice", "section508", ...extraTags,
            ];
            tagsCode = `const tags: string[] | undefined = ${JSON.stringify(allTags)};`;
        }
        else {
            tagsCode = `const tags: string[] | undefined = undefined;`;
        }
    }
    const disableRulesJson = JSON.stringify(axeConfig.disableRules);
    const includeJson = JSON.stringify(axeConfig.include);
    const excludeJson = JSON.stringify(axeConfig.exclude);
    return `
import { test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
${axeSourceSetup}

const pages = ${pagesJson};

${tagsCode}
const disableRules: string[] = ${disableRulesJson};
const includeSelectors: string[] = ${includeJson};
const excludeSelectors: string[] = ${excludeJson};

for (const p of pages) {
  test.describe(p.path, () => {
    test("accessibility", async ({ page }, testInfo) => {
      const response = await page.goto(p.url);

      if (!response) {
        throw new Error(\`No response received for \${p.url}\`);
      }
      if (!response.ok()) {
        throw new Error(\`HTTP \${response.status()} for \${p.url}\`);
      }

      let builder = axeSource
        ? new AxeBuilder({ page, axeSource })
        : new AxeBuilder({ page });

      if (tags) {
        builder = builder.withTags(tags);
      }

      if (disableRules.length > 0) {
        builder = builder.disableRules(disableRules);
      }

      for (const selector of includeSelectors) {
        builder = builder.include(selector);
      }
      for (const selector of excludeSelectors) {
        builder = builder.exclude(selector);
      }

      const results = await builder.analyze();

      await testInfo.attach("axe-results", {
        body: JSON.stringify(results, null, 2),
        contentType: "application/json",
      });
    });
  });
}
`.trimStart();
}
