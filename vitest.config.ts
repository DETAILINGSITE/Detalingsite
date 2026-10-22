import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname), "server-only": path.resolve(import.meta.dirname, "tests/support/server-only-stub.ts") },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globalSetup: ["tests/support/global-setup.ts"],
    pool: "forks",
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    reporters: process.env.CI ? ["default", "json"] : ["default"],
    outputFile: { json: "test-results/vitest.json" },
    env: {
      NODE_ENV: "test",
      TOKEN_PEPPER: "test-pepper-0123456789abcdef",
      PAYMENTS_DRIVER: "fake",
      NOTIFY_DRIVER: "capture",
      STORAGE_DRIVER: "local",
      CAPTCHA_DRIVER: "test",
      TEST_CLOCK: "1",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    },
  },
});
