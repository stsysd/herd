import { defineConfig } from "vitest/config";

export default defineConfig({
  // GitHub Pages ではサブパス(/herd/)で配信されるので、相対パスで出力する
  base: "./",
  test: {
    environment: "node",
  },
});
