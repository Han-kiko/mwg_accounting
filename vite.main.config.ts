import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // better-sqlite3 是原生模块（含 .node 二进制），必须保持外部引用、不打进包里
      external: ['better-sqlite3'],
    },
  },
});
