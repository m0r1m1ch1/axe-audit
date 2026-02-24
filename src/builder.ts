import { execSync } from "node:child_process";
import { detectPackageManager } from "./detect.js";
import { type ResolvedConfig, AuditError } from "./types.js";

export function runBuild(config: ResolvedConfig, cwd: string = process.cwd()): void {
  if (config.noBuild) {
    console.log("Skipping build (noBuild is set).");
    return;
  }

  let command: string;
  if (config.buildCommand) {
    command = config.buildCommand;
  } else {
    const pm = detectPackageManager(cwd);
    command = `${pm} run build`;
    console.log(`Detected package manager: ${pm}`);
  }

  console.log(`Running build: ${command}`);

  try {
    execSync(command, { cwd, stdio: "inherit" });
  } catch {
    throw new AuditError(`Build command failed: ${command}`);
  }
}
