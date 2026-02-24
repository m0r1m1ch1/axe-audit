import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { AuditError } from "./types.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const _require = createRequire(import.meta.url);
function getNodeModulesPaths() {
    const sep = process.platform === "win32" ? ";" : ":";
    // Own node_modules (when deps are nested inside axe-audit)
    const own = resolve(__dirname, "..", "node_modules");
    // Parent node_modules (when deps are hoisted to project root)
    const parent = resolve(__dirname, "..", "..");
    return [own, parent].join(sep);
}
function resolvePlaywrightCli() {
    try {
        return _require.resolve("@playwright/test/cli");
    }
    catch {
        throw new AuditError("Could not resolve @playwright/test CLI. Make sure @playwright/test is installed.");
    }
}
export function runPlaywrightTests(tmpDir) {
    const playwrightCliPath = resolvePlaywrightCli();
    console.log("\nRunning accessibility audit...\n");
    const nodeModulesPaths = getNodeModulesPaths();
    const env = {
        ...process.env,
        NODE_PATH: nodeModulesPaths,
    };
    const result = spawnSync(process.execPath, [playwrightCliPath, "test", "--config", "playwright.config.ts"], {
        cwd: tmpDir,
        stdio: "inherit",
        env,
    });
    return result.status ?? 1;
}
