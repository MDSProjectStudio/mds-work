import { defineConfig } from "vitest/config";
import path from "node:path";

// Test unitari della dashboard (Fase 1 · M1). Solo dati sintetici, nessun servizio esterno.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // "server-only" blocca l'import fuori dal server React: nei test è un modulo vuoto
      "server-only": path.resolve(__dirname, "tests/unit/_server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
