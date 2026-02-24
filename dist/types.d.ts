export interface AxeNodeResult {
    html: string;
    target: string[];
    failureSummary?: string;
    impact?: string;
    any: Array<{
        id: string;
        data: unknown;
        relatedNodes: unknown[];
    }>;
    all: Array<{
        id: string;
        data: unknown;
        relatedNodes: unknown[];
    }>;
    none: Array<{
        id: string;
        data: unknown;
        relatedNodes: unknown[];
    }>;
}
export interface AxeRuleResult {
    id: string;
    impact?: string;
    tags: string[];
    description: string;
    help: string;
    helpUrl: string;
    nodes: AxeNodeResult[];
}
export interface AxeResults {
    toolOptions: unknown;
    testEngine: {
        name: string;
        version: string;
    };
    testRunner: {
        name: string;
    };
    testEnvironment: unknown;
    url: string;
    timestamp: string;
    violations: AxeRuleResult[];
    incomplete: AxeRuleResult[];
    passes: AxeRuleResult[];
    inapplicable: AxeRuleResult[];
}
export interface AxeConfig {
    tags?: string[];
    locale?: string;
    aaa?: boolean;
    experimental?: boolean;
    disableRules?: string[];
    include?: string[];
    exclude?: string[];
}
export interface AxeAuditConfig {
    dist?: string;
    buildCommand?: string;
    noBuild?: boolean;
    port?: number;
    json?: boolean;
    csv?: boolean;
    showIncomplete?: boolean;
    showPasses?: boolean;
    showInapplicable?: boolean;
    axe?: AxeConfig;
}
export interface ResolvedConfig {
    dist: string;
    buildCommand: string | undefined;
    noBuild: boolean;
    port: number;
    json: boolean;
    csv: boolean;
    showIncomplete: boolean;
    showPasses: boolean;
    showInapplicable: boolean;
    axe: {
        tags: string[] | undefined;
        locale: string | undefined;
        aaa: boolean;
        experimental: boolean;
        disableRules: string[];
        include: string[];
        exclude: string[];
    };
}
export interface PageInfo {
    path: string;
    url: string;
}
export interface AuditPageResult {
    url: string;
    violations: AxeRuleResult[];
    incomplete: AxeRuleResult[];
    passes: AxeRuleResult[];
    inapplicable: AxeRuleResult[];
}
export interface AuditSummary {
    totalPages: number;
    totalViolations: number;
    totalIncomplete: number;
    pagesWithViolations: number;
    pagesWithErrors: number;
}
export interface AuditReport {
    metadata: {
        axeVersion: string;
        timestamp: string;
        toolVersion: string;
    };
    pages: AuditPageResult[];
    summary: AuditSummary;
}
export interface CliOptions {
    noBuild: boolean;
    json: boolean;
    csv: boolean;
    subcommand?: string;
}
export declare class AuditError extends Error {
    exitCode: number;
    constructor(message: string, exitCode?: number);
}
export declare const VALID_LOCALES: readonly ["da", "de", "el", "es", "eu", "fr", "he", "it", "ja", "ko", "nl", "no_NB", "pl", "pt_BR", "pt_PT", "ru", "zh_CN", "zh_TW"];
export declare const DEFAULT_CONFIG: ResolvedConfig;
export declare function defineConfig(config: AxeAuditConfig): AxeAuditConfig;
