import { existsSync } from "node:fs";
import { resolve } from "node:path";

type PackageManager = "bun" | "pnpm" | "yarn" | "npm";

const LOCK_FILES: Array<{ files: string[]; pm: PackageManager }> = [
  { files: ["bun.lockb", "bun.lock"], pm: "bun" },
  { files: ["pnpm-lock.yaml"], pm: "pnpm" },
  { files: ["yarn.lock"], pm: "yarn" },
  { files: ["package-lock.json"], pm: "npm" },
];

export function detectPackageManager(cwd: string = process.cwd()): PackageManager {
  for (const { files, pm } of LOCK_FILES) {
    for (const file of files) {
      if (existsSync(resolve(cwd, file))) {
        return pm;
      }
    }
  }
  return "npm";
}
