import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/shinkansen/",
  build: {
    rollupOptions: {
      // トップ・しんかんせん・でんしゃ の 3 ページ (パスはプロジェクトルートから)
      input: { index: "index.html", shinkansen: "shinkansen.html", densha: "densha.html" },
    },
  },
  test: {
    environment: "node",
  },
});
