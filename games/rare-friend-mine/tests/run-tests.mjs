import { build } from "esbuild";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testEntry = path.join(__dirname, "engine.test.mjs");
const testBundle = path.join(__dirname, ".bundle.test.mjs");

try {
  await build({
    entryPoints: [testEntry],
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    outfile: testBundle,
  });

  execSync(`node --test "${testBundle}"`, { stdio: "inherit" });
} finally {
  try {
    rmSync(testBundle, { force: true });
    rmSync(path.join(__dirname, "bundle.test.mjs"), { force: true });
  } catch {}
}
