import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  // popup/index.html의 출력 경로가 manifest.json의 "popup/index.html"과 일치하도록
  // root를 src/popup으로 맞춘다. 다른 엔트리(content, service_worker)는 절대 경로로
  // 지정하므로 root 변경의 영향을 받지 않는다.
  root: resolve(__dirname, "src"),
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
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  publicDir: resolve(__dirname, "public"),
});
