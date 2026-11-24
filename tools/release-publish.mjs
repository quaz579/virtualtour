import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const version = process.argv[2];
const packages = ["virtualtour", "virtualtour-react", "virtualtour-vue"];
const buildOutputs = ["packages/core/dist/index.js", "packages/react/dist/index.js", "packages/vue/dist/index.js"];

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version ?? "")) {
  throw new Error("A valid release version is required.");
}

if (buildOutputs.some((buildOutput) => !existsSync(buildOutput))) {
  execFileSync("npm", ["run", "build"], { stdio: "inherit" });
}

for (const name of packages) {
  const current = spawnSync("npm", ["view", `${name}@${version}`, "version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  });

  if (current.status === 0 && current.stdout.trim() === version) {
    process.stdout.write(`${name}@${version} is already published; skipping.\n`);
    continue;
  }

  const publish = spawnSync("npm", ["publish", "--workspace", name, "--access", "public", "--provenance"], {
    stdio: "inherit"
  });

  if (publish.error) {
    throw publish.error;
  }

  if (publish.status !== 0) {
    process.exit(publish.status ?? 1);
  }
}
