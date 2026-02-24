import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import {
  type AxeAuditConfig,
  type CliOptions,
  type ResolvedConfig,
  AuditError,
  DEFAULT_CONFIG,
  VALID_LOCALES,
} from "./types.js";

export const CONFIG_FILENAME = "axe-audit.config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getToolVersion(): string {
  try {
    const pkgPath = resolve(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

export async function loadConfig(cwd: string = process.cwd()): Promise<AxeAuditConfig> {
  const configPath = resolve(cwd, CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const fileUrl = pathToFileURL(configPath).href;
    const mod = await import(fileUrl);
    return mod.default ?? {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AuditError(`Failed to load config file "${CONFIG_FILENAME}":\n${message}`);
  }
}

export function mergeCliOptions(config: ResolvedConfig, cli: CliOptions): ResolvedConfig {
  return {
    ...config,
    noBuild: cli.noBuild || config.noBuild,
    json: cli.json || config.json,
    csv: cli.csv || config.csv,
  };
}

export function validateConfig(userConfig: AxeAuditConfig): ResolvedConfig {
  const config: ResolvedConfig = { ...DEFAULT_CONFIG };
  const axe = { ...DEFAULT_CONFIG.axe };

  // Top-level properties
  if (userConfig.dist !== undefined) {
    if (typeof userConfig.dist !== "string") {
      throw new AuditError("config 'dist' must be a string.");
    }
    config.dist = userConfig.dist;
  }

  if (userConfig.buildCommand !== undefined) {
    if (typeof userConfig.buildCommand !== "string") {
      throw new AuditError("config 'buildCommand' must be a string.");
    }
    config.buildCommand = userConfig.buildCommand;
  }

  if (userConfig.noBuild !== undefined) {
    if (typeof userConfig.noBuild !== "boolean") {
      throw new AuditError("config 'noBuild' must be a boolean.");
    }
    config.noBuild = userConfig.noBuild;
  }

  if (userConfig.port !== undefined) {
    const p = userConfig.port;
    if (typeof p !== "number" || !Number.isInteger(p) || p < 1 || p > 65535) {
      throw new AuditError("config 'port' must be an integer between 1 and 65535.");
    }
    config.port = p;
  }

  if (userConfig.json !== undefined) {
    if (typeof userConfig.json !== "boolean") {
      throw new AuditError("config 'json' must be a boolean.");
    }
    config.json = userConfig.json;
  }

  if (userConfig.csv !== undefined) {
    if (typeof userConfig.csv !== "boolean") {
      throw new AuditError("config 'csv' must be a boolean.");
    }
    config.csv = userConfig.csv;
  }

  if (userConfig.showIncomplete !== undefined) {
    if (typeof userConfig.showIncomplete !== "boolean") {
      throw new AuditError("config 'showIncomplete' must be a boolean.");
    }
    config.showIncomplete = userConfig.showIncomplete;
  }

  if (userConfig.showPasses !== undefined) {
    if (typeof userConfig.showPasses !== "boolean") {
      throw new AuditError("config 'showPasses' must be a boolean.");
    }
    config.showPasses = userConfig.showPasses;
  }

  if (userConfig.showInapplicable !== undefined) {
    if (typeof userConfig.showInapplicable !== "boolean") {
      throw new AuditError("config 'showInapplicable' must be a boolean.");
    }
    config.showInapplicable = userConfig.showInapplicable;
  }

  // axe config
  if (userConfig.axe !== undefined) {
    const ua = userConfig.axe;

    if (ua.tags !== undefined) {
      if (!Array.isArray(ua.tags) || !(ua.tags as unknown[]).every((t) => typeof t === "string")) {
        throw new AuditError("config 'axe.tags' must be an array of strings.");
      }
      axe.tags = ua.tags;
    }

    if ("locale" in ua) {
      if (ua.locale === undefined) {
        // 明示的に undefined を指定した場合は英語（ロケールなし）
        axe.locale = undefined;
      } else {
        if (typeof ua.locale !== "string") {
          throw new AuditError("config 'axe.locale' must be a string.");
        }
        if (!(VALID_LOCALES as readonly string[]).includes(ua.locale)) {
          throw new AuditError(
            `Invalid locale "${ua.locale}". Valid locales: ${VALID_LOCALES.join(", ")}`
          );
        }
        axe.locale = ua.locale;
      }
    }

    if (ua.aaa !== undefined) {
      if (typeof ua.aaa !== "boolean") {
        throw new AuditError("config 'axe.aaa' must be a boolean.");
      }
      axe.aaa = ua.aaa;
    }

    if (ua.experimental !== undefined) {
      if (typeof ua.experimental !== "boolean") {
        throw new AuditError("config 'axe.experimental' must be a boolean.");
      }
      axe.experimental = ua.experimental;
    }

    if (ua.disableRules !== undefined) {
      if (!Array.isArray(ua.disableRules) || !(ua.disableRules as unknown[]).every((t) => typeof t === "string")) {
        throw new AuditError("config 'axe.disableRules' must be an array of strings.");
      }
      axe.disableRules = ua.disableRules;
    }

    if (ua.include !== undefined) {
      if (!Array.isArray(ua.include) || !(ua.include as unknown[]).every((t) => typeof t === "string")) {
        throw new AuditError("config 'axe.include' must be an array of strings.");
      }
      axe.include = ua.include;
    }

    if (ua.exclude !== undefined) {
      if (!Array.isArray(ua.exclude) || !(ua.exclude as unknown[]).every((t) => typeof t === "string")) {
        throw new AuditError("config 'axe.exclude' must be an array of strings.");
      }
      axe.exclude = ua.exclude;
    }

    // Warn about unknown keys
    const knownKeys = new Set(["tags", "locale", "aaa", "experimental", "disableRules", "include", "exclude"]);
    for (const key of Object.keys(ua)) {
      if (!knownKeys.has(key)) {
        console.warn(`Warning: Unknown config key "axe.${key}" (typo?)`);
      }
    }
  }

  config.axe = axe;

  // Warn about unknown top-level keys
  const knownTopKeys = new Set(["dist", "buildCommand", "noBuild", "port", "json", "csv", "showIncomplete", "showPasses", "showInapplicable", "axe"]);
  for (const key of Object.keys(userConfig)) {
    if (!knownTopKeys.has(key)) {
      console.warn(`Warning: Unknown config key "${key}" (typo?)`);
    }
  }

  return config;
}
