import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    // Los de integración se corren aparte (npm run test:rls) porque escriben en
    // el proyecto Supabase real — ver tests/rls/README.md.
    include: ["tests/unit/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
});
