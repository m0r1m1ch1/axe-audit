// @ts-check
import { defineConfig } from "axe-audit";

export default defineConfig({
  dist: "dist",
  buildCommand: undefined,
  noBuild: false,
  port: 3000,
  json: false,
  csv: false,
  showIncomplete: false,
  showPasses: false,
  showInapplicable: false,
  excludePages: [],
  axe: {
    tags: undefined,
    locale: "ja",
    aaa: false,
    experimental: false,
    disableRules: [],
    include: [],
    exclude: [],
  },
});
