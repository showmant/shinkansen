import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/shinkansen/",
  test: {
    environment: "node",
  },
});
