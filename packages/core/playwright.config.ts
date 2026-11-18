import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const edgeCandidates = [
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/opt/microsoft/msedge/msedge",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const edgeMissing = !edgeCandidates.some((path) => existsSync(path));

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev --workspace virtualtour-demo",
    cwd: "../..",
    url: "http://localhost:4173/e2e.html",
    reuseExistingServer: !process.env["CI"],
    timeout: 60_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "edge",
      use: { ...devices["Desktop Edge"], channel: "msedge" },
      metadata: { edgeMissing },
    },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
