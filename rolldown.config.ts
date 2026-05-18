import { defineConfig } from "rolldown";

export default defineConfig([
  {
    input: {
      index: "src/index.ts",
      "esp-partition-table": "src/cli/esp-partition-table.ts",
    },
    external: [/^node:/],
    output: {
      dir: "dist/esm",
      format: "esm",
      entryFileNames: "[name].js",
      chunkFileNames: "[name].js",
    },
    resolve: {
      extensions: [".ts", ".js"],
    },
  },
  {
    input: {
      index: "src/index.ts",
      "esp-partition-table": "src/cli/esp-partition-table.ts",
    },
    external: [/^node:/],
    output: {
      dir: "dist/cjs",
      format: "cjs",
      entryFileNames: "[name].cjs",
      chunkFileNames: "[name].cjs",
    },
    resolve: {
      extensions: [".ts", ".js"],
    },
  },
]);
