#!/usr/bin/env node
import { parseArgs } from "node:util";
import { readFileSync, existsSync, copyFileSync } from "node:fs";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, validateConfig, mergeCliOptions, CONFIG_FILENAME, getToolVersion } from "./config.js";
import { runBuild } from "./builder.js";
import { discoverPages, generateTestFiles, cleanupTmpDir } from "./test-generator.js";
import { runPlaywrightTests } from "./runner.js";
import { generateJsonReport } from "./json.js";
import { generateCsvReport } from "./csv.js";
import { generateHtmlReport } from "./html.js";
import { AuditError } from "./types.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
function parseCli() {
    const { values, positionals } = parseArgs({
        args: process.argv.slice(2),
        options: {
            "no-build": { type: "boolean", default: false },
            json: { type: "boolean", default: false },
            csv: { type: "boolean", default: false },
            help: { type: "boolean", default: false },
            version: { type: "boolean", default: false },
        },
        allowPositionals: true,
        strict: true,
    });
    if (values.help) {
        printHelp();
        process.exit(0);
    }
    if (values.version) {
        console.log(`axe-audit v${getToolVersion()}`);
        process.exit(0);
    }
    return {
        noBuild: values["no-build"],
        json: values.json,
        csv: values.csv,
        subcommand: positionals[0],
    };
}
function printHelp() {
    console.log(`
axe-audit - Zero-config accessibility audit CLI

Usage:
  axe-audit              Run accessibility audit
  axe-audit init         Generate config file
  axe-audit --help       Show this help
  axe-audit --version    Show version

Options:
  --no-build    Skip the build step
  --json        Also output JSON report (report.json)
  --csv         Also output CSV report (report.csv)
`.trim());
}
function handleInit(cwd) {
    const targetPath = resolve(cwd, CONFIG_FILENAME);
    if (existsSync(targetPath)) {
        console.log(`${CONFIG_FILENAME} already exists. Skipping.`);
        return;
    }
    const templatePath = resolve(__dirname, "..", "templates", CONFIG_FILENAME);
    if (!existsSync(templatePath)) {
        throw new AuditError("Config template not found.");
    }
    copyFileSync(templatePath, targetPath);
    console.log(`Created ${CONFIG_FILENAME}`);
}
function openInBrowser(url) {
    if (process.platform === "win32") {
        spawnSync("cmd", ["/c", "start", "", url], { stdio: "ignore" });
    }
    else if (process.platform === "darwin") {
        const chromeCheck = spawnSync("mdfind", [
            "kMDItemCFBundleIdentifier == 'com.google.Chrome'",
        ], { encoding: "utf-8" });
        const chromeInstalled = (chromeCheck.stdout?.trim().length ?? 0) > 0;
        if (chromeInstalled) {
            spawnSync("osascript", [
                "-e", `tell application "Google Chrome" to activate`,
                "-e", `tell application "Google Chrome" to open location "${url}"`,
            ], { stdio: "ignore" });
        }
        else {
            spawnSync("/usr/bin/open", [url], { stdio: "ignore" });
        }
    }
    else {
        spawnSync("xdg-open", [url], { stdio: "ignore" });
    }
}
function serveAndOpen(htmlPath) {
    const html = readFileSync(htmlPath, "utf-8");
    return new Promise((resolve) => {
        let done = false;
        const server = createServer((_req, res) => {
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(html);
            if (!done) {
                done = true;
                setTimeout(() => server.close(() => resolve()), 2000);
            }
        });
        server.listen(0, "127.0.0.1", () => {
            const addr = server.address();
            const port = typeof addr === "object" && addr ? addr.port : 0;
            const url = `http://127.0.0.1:${port}/`;
            openInBrowser(url);
            const t = setTimeout(() => {
                if (!done) {
                    done = true;
                    server.close(() => resolve());
                }
            }, 30000);
            t.unref();
        });
    });
}
async function main() {
    const cwd = process.cwd();
    const cli = parseCli();
    // Handle init subcommand
    if (cli.subcommand === "init") {
        handleInit(cwd);
        return;
    }
    // Step 1-2: Load and validate config, merge with CLI options
    const userConfig = await loadConfig(cwd);
    const validatedConfig = validateConfig(userConfig);
    const config = mergeCliOptions(validatedConfig, cli);
    // Step 3-4: Build
    runBuild(config, cwd);
    // Step 5-6: Discover pages
    const distDir = resolve(cwd, config.dist);
    const pages = discoverPages(distDir, config.port);
    console.log(`\nFound ${pages.length} HTML page(s) to audit.`);
    // Step 7: Generate test files in temp directory
    const tmpDir = generateTestFiles(config, pages, cwd);
    // Signal handling for cleanup
    let cleanedUp = false;
    const cleanup = (signal) => {
        if (cleanedUp)
            return;
        cleanedUp = true;
        console.log(`\nReceived ${signal}. Cleaning up...`);
        cleanupTmpDir(tmpDir);
        const code = signal === "SIGINT" ? 130 : 143;
        process.exit(code);
    };
    process.on("SIGINT", () => cleanup("SIGINT"));
    process.on("SIGTERM", () => cleanup("SIGTERM"));
    // Step 8: Run Playwright tests (tests always pass; violations are reported separately)
    const testExitCode = runPlaywrightTests(tmpDir);
    // Step 9: Determine exit code from axe-results.json
    let hasViolations = false;
    const resultsPath = join(tmpDir, "axe-results.json");
    if (existsSync(resultsPath)) {
        try {
            const raw = JSON.parse(readFileSync(resultsPath, "utf-8"));
            hasViolations = raw.some((entry) => (entry.axeResults?.violations?.length ?? 0) > 0);
        }
        catch {
            // If we can't read the results, treat as failure
            hasViolations = true;
        }
    }
    // クリーンアップ前に結果ファイルの存在を確認（削除後は常に false になるため）
    const hadResultsFile = existsSync(resultsPath);
    // Step 10: Generate reports
    const htmlPath = resolve(cwd, "axe-audit", "report.html");
    generateHtmlReport(tmpDir, config, cwd);
    if (config.json) {
        generateJsonReport(tmpDir, cwd);
    }
    if (config.csv) {
        generateCsvReport(tmpDir, cwd);
    }
    // Step 11: Cleanup temp directory
    cleanupTmpDir(tmpDir);
    // Step 12: Serve report on localhost and open in browser
    if (!process.env.CI) {
        await serveAndOpen(htmlPath);
    }
    // Exit with appropriate code
    // Playwright 自体がクラッシュした場合（結果ファイルが生成されなかった場合）はその exit code を伝播
    if (testExitCode !== 0 && !hadResultsFile) {
        process.exit(testExitCode);
    }
    process.exit(hasViolations ? 1 : 0);
}
main().catch((err) => {
    if (err instanceof AuditError) {
        console.error(`Error: ${err.message}`);
        process.exit(err.exitCode);
    }
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
});
