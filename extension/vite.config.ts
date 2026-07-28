import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        content: resolve(__dirname, "src/content/content.ts"),
        service_worker: resolve(__dirname, "src/background/service_worker.ts"),
        popup: resolve(__dirname, "src/popup/index.html"),
      },
      output: {
        entryFileNames: "[name]/[name].js",
      },
    },
    outDir: "dist",
    emptyOutDir: true,
  },
  publicDir: "public",
});
