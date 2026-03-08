import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directRepoDir = path.resolve(rootDir, "..", "notability-to-excalidraw");
const vendorDir = path.join(rootDir, "vendor", "notability-to-excalidraw");
const stagedEntry = path.join(vendorDir, "index.js");
const directRepoAvailable = existsSync(path.join(directRepoDir, "package.json"));

const run = (command, args, cwd = rootDir) => {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

if (!directRepoAvailable) {
  if (!existsSync(stagedEntry)) {
    console.error("Missing notability-to-excalidraw checkout.");
    process.exit(1);
  }
  process.exit(0);
}

const distDir = path.join(directRepoDir, "dist");
const distEntry = path.join(distDir, "index.js");

if (!existsSync(distEntry)) {
  run(
    "bunx",
    ["tsup", "src/index.ts", "--format", "esm", "--dts", "--out-dir", "dist", "--clean"],
    directRepoDir,
  );
}

rmSync(vendorDir, { recursive: true, force: true });
mkdirSync(vendorDir, { recursive: true });
cpSync(distDir, vendorDir, { recursive: true });
