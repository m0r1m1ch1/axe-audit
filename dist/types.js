export class AuditError extends Error {
    exitCode;
    constructor(message, exitCode = 2) {
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
];
export const DEFAULT_CONFIG = {
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
export function defineConfig(config) {
    return config;
}
