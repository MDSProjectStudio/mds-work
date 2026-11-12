import { defineConfig } from "vitest/config";
import path from "node:path";

/** Prove su PostgreSQL locale e isolato (Fase 1 · M2). Avvio: npm run test:pg */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "server-only": path.resolve(__dirname, "tests/unit/_server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/pg/**/*.test.ts"],
    globalSetup: ["tests/pg/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
});
