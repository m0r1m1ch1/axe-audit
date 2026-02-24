interface CollectedResult {
    url: string;
    axeResults: {
        testEngine?: {
            version?: string;
        };
        url?: string;
        violations?: unknown[];
        incomplete?: unknown[];
        passes?: unknown[];
        inapplicable?: unknown[];
    } | null;
    error: string | null;
}
declare function loadCollectedResults(tmpDir: string): CollectedResult[];
export declare function generateJsonReport(tmpDir: string, cwd?: string): void;
export { loadCollectedResults, type CollectedResult };
