import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: './demo',
  publicDir: false,
  server: {
    port: 5173,
    open: true,
    strictPort: false
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './dist'),
      '@luxsync': path.resolve(__dirname, './dist/engines/selene/luxsync')
    }
  }
});
