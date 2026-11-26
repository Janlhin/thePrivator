import { defineConfig } from "@playwright/test";

// E2E smoke for the web shell. The packaged Tauri window is still driven by
// scripts/verify-s06.mjs over WebDriver; this channel only mounts the frontend
// in a real browser against the Vite dev server and asserts the shell renders
// without an uncaught error.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    headless: true,
    // Reuse the Chrome already installed on the host; no Playwright browser
    // binary is downloaded.
    channel: "chrome",
    trace: "off",
  },
  webServer: {
    command: "node node_modules/vite-plus/dist/bin.js dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
