import { type ResolvedConfig } from "./types.js";
export declare function generateHtmlReport(tmpDir: string, config: Pick<ResolvedConfig, "showIncomplete" | "showPasses" | "showInapplicable">, cwd?: string): void;
