import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Optional source override permits testing a candidate without copying library code here.
export default defineConfig({
  cacheDir: process.env.KOBALTE_TRANSITION_SOURCE ? "node_modules/.vite-candidate" : "node_modules/.vite-published",
  build: { rollupOptions: { input: { standalone: fileURLToPath(new URL("./index.html", import.meta.url)), react: fileURLToPath(new URL("./react/index.html", import.meta.url)) } } },
  resolve: {
    alias: process.env.KOBALTE_TRANSITION_SOURCE
      ? { "@kobalte/utils": process.env.KOBALTE_TRANSITION_SOURCE }
      : {},
  },
});
