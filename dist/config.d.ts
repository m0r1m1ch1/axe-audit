import { type AxeAuditConfig, type CliOptions, type ResolvedConfig } from "./types.js";
export declare const CONFIG_FILENAME = "axe-audit.config.mjs";
export declare function getToolVersion(): string;
export declare function loadConfig(cwd?: string): Promise<AxeAuditConfig>;
export declare function mergeCliOptions(config: ResolvedConfig, cli: CliOptions): ResolvedConfig;
export declare function validateConfig(userConfig: AxeAuditConfig): ResolvedConfig;
