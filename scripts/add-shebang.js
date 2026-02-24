import { readFileSync, writeFileSync } from "node:fs";

const filePath = new URL("../dist/index.js", import.meta.url);
const content = readFileSync(filePath, "utf-8");
const shebang = "#!/usr/bin/env node\n";

if (!content.startsWith(shebang)) {
  writeFileSync(filePath, shebang + content);
}
