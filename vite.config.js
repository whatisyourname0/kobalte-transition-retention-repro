import { defineConfig } from "vite";

// Optional source override permits testing a candidate without copying library code here.
export default defineConfig({
  cacheDir: process.env.KOBALTE_TRANSITION_SOURCE ? "node_modules/.vite-candidate" : "node_modules/.vite-published",
  resolve: {
    alias: process.env.KOBALTE_TRANSITION_SOURCE
      ? { "@kobalte/utils": process.env.KOBALTE_TRANSITION_SOURCE }
      : {},
  },
});
