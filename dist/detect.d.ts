type PackageManager = "bun" | "pnpm" | "yarn" | "npm";
export declare function detectPackageManager(cwd?: string): PackageManager;
export {};
