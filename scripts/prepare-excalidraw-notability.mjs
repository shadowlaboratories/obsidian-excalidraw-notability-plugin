import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directRepoDir = path.resolve(rootDir, "..", "excalidraw-notability");
const vendorDir = path.join(rootDir, "vendor", "excalidraw-notability");
const bundleDir = path.join(rootDir, "dist", "excalidraw-notability");
const typesDir = path.join(rootDir, "dist", "excalidraw-notability-types");
const directRepoAvailable = existsSync(path.join(directRepoDir, "package.json"));
const repoDir = directRepoAvailable ? directRepoDir : vendorDir;
const bunLock = path.join(vendorDir, "bun.lock");
const excalidrawTypesEntry = path.join(
  repoDir,
  "packages",
  "excalidraw",
  "dist",
  "types",
  "excalidraw",
  "index.d.ts",
);
const excalidrawTypesDir = path.join(
  repoDir,
  "packages",
  "excalidraw",
  "dist",
  "types",
);

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
  run("git", [
    "submodule",
    "update",
    "--init",
    "--recursive",
    "vendor/excalidraw-notability",
  ]);
  run("bun", ["install", "--cwd", vendorDir]);
}

if (!existsSync(path.join(repoDir, "package.json"))) {
  console.error("Missing excalidraw-notability checkout.");
  process.exit(1);
}

if (!existsSync(excalidrawTypesEntry)) {
  run("bun", [
    "run",
    "--cwd",
    path.join(repoDir, "packages/excalidraw"),
    "gen:types",
  ]);
}

const repoRequire = createRequire(path.join(repoDir, "package.json"));
const { build } = repoRequire("esbuild");
const { sassPlugin } = repoRequire("esbuild-sass-plugin");
const { parseEnvVariables } = repoRequire("./packages/excalidraw/env.cjs");

const resolveRelativePath = (importPath, sourceFile) => {
  const sourceDir = path.dirname(sourceFile);
  const extensions = [".scss", ".css", ""];

  for (const ext of extensions) {
    const fullPath = path.resolve(sourceDir, importPath + ext);
    if (existsSync(fullPath)) {
      return fullPath;
    }

    const partialPath = path.join(
      path.dirname(fullPath),
      `_${path.basename(fullPath)}`,
    );
    if (existsSync(partialPath)) {
      return partialPath;
    }
  }

  return null;
};

const precompile = (source, sourcePath) =>
  source.replace(
    /(@use|@forward)\s+["'](\.[^"']+)["']/g,
    (match, directive, importPath) => {
      const resolvedPath = resolveRelativePath(importPath, sourcePath);
      return resolvedPath ? `${directive} "${resolvedPath}"` : match;
    },
  );

const sharedBuildOptions = {
  entryPoints: [path.join(repoDir, "packages/excalidraw/index.tsx")],
  bundle: true,
  format: "iife",
  globalName: "ExcalidrawLib",
  platform: "browser",
  target: "es2020",
  external: ["react", "react-dom"],
  alias: {
    "@excalidraw/common": path.join(repoDir, "packages/common/src"),
    "@excalidraw/element": path.join(repoDir, "packages/element/src"),
    "@excalidraw/math": path.join(repoDir, "packages/math/src"),
    "@excalidraw/utils": path.join(repoDir, "packages/utils/src"),
  },
  loader: {
    ".woff2": "file",
  },
  assetNames: "[name]-[hash]",
  plugins: [
    sassPlugin({
      precompile,
    }),
  ],
};

const buildTargets = [
  {
    envFile: ".env.development",
    outfile: path.join(bundleDir, "excalidraw-notability.development.js"),
    minify: false,
    define: { DEV: true },
  },
  {
    envFile: ".env.production",
    outfile: path.join(bundleDir, "excalidraw-notability.production.min.js"),
    minify: true,
    define: { PROD: true },
  },
];

const main = async () => {
  rmSync(bundleDir, { recursive: true, force: true });
  rmSync(typesDir, { recursive: true, force: true });
  mkdirSync(bundleDir, { recursive: true });
  mkdirSync(typesDir, { recursive: true });

  cpSync(excalidrawTypesDir, typesDir, { recursive: true });

  for (const target of buildTargets) {
    const env = {
      ...parseEnvVariables(path.join(repoDir, target.envFile)),
      ...target.define,
    };

    await build({
      ...sharedBuildOptions,
      outfile: target.outfile,
      minify: target.minify,
      define: {
        "import.meta.env": JSON.stringify(env),
      },
    });
  }

  if (existsSync(bunLock)) {
    rmSync(bunLock);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
