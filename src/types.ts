// axe-core の結果型（axe-core パッケージの型から必要な部分を抽出）
export interface AxeNodeResult {
  html: string;
  target: string[];
  failureSummary?: string;
  impact?: string;
  any: Array<{ id: string; data: unknown; relatedNodes: unknown[] }>;
  all: Array<{ id: string; data: unknown; relatedNodes: unknown[] }>;
  none: Array<{ id: string; data: unknown; relatedNodes: unknown[] }>;
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
  testEngine: { name: string; version: string };
  testRunner: { name: string };
  testEnvironment: unknown;
  url: string;
  timestamp: string;
  violations: AxeRuleResult[];
  incomplete: AxeRuleResult[];
  passes: AxeRuleResult[];
  inapplicable: AxeRuleResult[];
}

// 設定ファイルの型
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

// デフォルトとマージ済みの設定
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

export class AuditError extends Error {
  exitCode: number;
  constructor(message: string, exitCode: number = 2) {
    super(message);
    this.name = "AuditError";
    this.exitCode = exitCode;
  }
}

// axe-core 公式ロケール一覧
export const VALID_LOCALES = [
  "da", "de", "el", "es", "eu", "fr", "he", "it",
  "ja", "ko", "nl", "no_NB", "pl", "pt_BR", "pt_PT",
  "ru", "zh_CN", "zh_TW",
] as const;

export const DEFAULT_CONFIG: ResolvedConfig = {
  dist: "dist",
  buildCommand: undefined,
  noBuild: false,
  port: 3000,
  json: false,
  csv: false,
  showIncomplete: false,
  showPasses: false,
  showInapplicable: false,
  axe: {
    tags: undefined,
    locale: "ja",
    aaa: false,
    experimental: false,
    disableRules: [],
    include: [],
    exclude: [],
  },
};

export function defineConfig(config: AxeAuditConfig): AxeAuditConfig {
  return config;
}
