#!/usr/bin/env -S npx tsx
import path from "node:path";
const filePath = process.argv[2];
if (!filePath) {
    console.error("Usage: gen <config.ts>");
    process.exit(1);
}
const resolved = path.resolve(process.cwd(), filePath);
const mod = await import(resolved);
const config = mod.default ?? mod;
process.stdout.write(JSON.stringify(config, null, 2) + "\n");
//# sourceMappingURL=manifest2package.mjs.map