import { type PageInfo, type ResolvedConfig } from "./types.js";
export declare function discoverPages(distDir: string, port: number): PageInfo[];
export declare function generateTestFiles(config: ResolvedConfig, pages: PageInfo[], cwd?: string): string;
export declare function cleanupTmpDir(tmpDir: string): void;
