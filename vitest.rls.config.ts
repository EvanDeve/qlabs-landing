import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Config aparte para los tests de integración: hablan con el proyecto Supabase
// real, así que van en su propio comando (npm run test:rls) y nunca se cuelan
// en el `npm test` de todos los días.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/rls/**/*.test.ts"],
    // Crean y borran cuentas: si corrieran en paralelo se pisarían entre sí.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
});
