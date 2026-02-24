import { existsSync } from "node:fs";
import { resolve } from "node:path";
const LOCK_FILES = [
    { files: ["bun.lockb", "bun.lock"], pm: "bun" },
    { files: ["pnpm-lock.yaml"], pm: "pnpm" },
    { files: ["yarn.lock"], pm: "yarn" },
    { files: ["package-lock.json"], pm: "npm" },
];
export function detectPackageManager(cwd = process.cwd()) {
    for (const { files, pm } of LOCK_FILES) {
        for (const file of files) {
            if (existsSync(resolve(cwd, file))) {
                return pm;
            }
        }
    }
    return "npm";
}
