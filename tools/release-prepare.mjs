import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version ?? "")) {
  throw new Error("A valid release version is required.");
}

const packagePaths = ["packages/core/package.json", "packages/react/package.json", "packages/vue/package.json"];
const packages = [];

for (const packagePath of packagePaths) {
  const fullPath = path.join(root, packagePath);
  const manifest = JSON.parse(await readFile(fullPath, "utf8"));
  manifest.version = version;
  delete manifest.private;

  if (packagePath !== packagePaths[0]) {
    manifest.peerDependencies["virtual-site-tour"] = `^${version}`;
  }

  await writeFile(fullPath, `${JSON.stringify(manifest, null, 2)}\n`);
  packages.push(manifest);
}

execFileSync("npm", ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"], {
  cwd: root,
  stdio: "inherit"
});

if (packages.some(({ scripts = {} }) => ![scripts.prepublish, scripts.prepublishOnly, scripts.prepack].some((script) => script?.includes("build")))) {
  execFileSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
}
