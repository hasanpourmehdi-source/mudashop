import { defineConfig } from "vitest/config";
import path from "node:path";
import { transformWithOxc } from "vite";

const rootDir = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(rootDir, "src") },
  },
  plugins: [
    {
      name: "strict-jsx-transform",
      enforce: "pre",
      async transform(code, id) {
        if (!/\.[jt]sx$/.test(id)) return;
        const result = await transformWithOxc(code, id, {
          jsx: { runtime: "automatic", importSource: "react", development: true },
        });
        return { code: result.code, map: result.map };
      },
    },
  ],
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/component/**/*.test.{ts,tsx}"],
    environment: "node",
    globals: false,
    isolate: true,
  },
});