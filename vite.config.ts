import { defineConfig } from "vite";

export default defineConfig({
  // 使用相对路径，构建后 dist/index.html 可以直接双击打开
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        stats: "stats.html",
      },
    },
  },
  server: {
    // 同时监听 IPv4 和 IPv6 的 localhost，避免 127.0.0.1 无法访问
    host: true,
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
