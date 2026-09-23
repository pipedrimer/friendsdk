import { build } from "esbuild";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(__dirname, "economy-sim.ts");
const bundle = path.join(__dirname, ".economy-sim.bundle.mjs");

try {
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    outfile: bundle,
  });
  execSync(`node "${bundle}"`, { stdio: "inherit", env: process.env });
} finally {
  try {
    rmSync(bundle, { force: true });
  } catch {}
}