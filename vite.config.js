import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'demo',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    port: 3000,
    open: '/demo/index.html'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@selene': path.resolve(__dirname, './src/engines/selene')
    }
  }
});
