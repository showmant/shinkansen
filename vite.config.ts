import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/shinkansen/",
  build: {
    rollupOptions: {
      // トップ・しんかんせん・でんしゃ・くいず の 4 ページ (パスはプロジェクトルートから)
      input: { index: "index.html", shinkansen: "shinkansen.html", densha: "densha.html", quiz: "quiz.html" },
    },
  },
  test: {
    environment: "node",
  },
});
