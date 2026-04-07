import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import path from 'path';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        electron([
            {
                entry: 'electron/main.ts',
                vite: {
                    build: {
                        outDir: 'dist-electron',
                        rollupOptions: {
                            // 🧠 WAVE 10: Excluir módulos nativos del bundle
                            // bytenode también es externo — registra el handler .jsc en runtime
                            external: ['better-sqlite3', 'serialport', 'bytenode'],
                        },
                    },
                },
            },
            {
                entry: 'electron/preload.ts',
                onstart(options) {
                    options.reload();
                },
                vite: {
                    build: {
                        outDir: 'dist-electron',
                    },
                },
            },
            // 🧠 WAVE 10/254: Trinity Workers - BETA (Senses) and GAMMA (Mind)
            {
                entry: 'src/workers/senses.ts',
                vite: {
                    build: {
                        outDir: 'dist-electron',
                        lib: {
                            entry: 'src/workers/senses.ts',
                            formats: ['cjs'],
                            fileName: () => 'senses.js',
                        },
                        rollupOptions: {
                            external: ['worker_threads', 'better-sqlite3'],
                        },
                    },
                },
            },
            {
                entry: 'src/workers/mind.ts',
                vite: {
                    build: {
                        outDir: 'dist-electron',
                        lib: {
                            entry: 'src/workers/mind.ts',
                            formats: ['cjs'],
                            fileName: () => 'mind.js',
                        },
                        rollupOptions: {
                            external: ['worker_threads', 'better-sqlite3'],
                        },
                    },
                },
            },
            // 👻 WAVE 2021.1: DMX Phantom Worker — bit-banging aislado del Event Loop
            {
                entry: 'src/hal/drivers/strategies/openDmxWorker.ts',
                vite: {
                    build: {
                        outDir: 'dist-electron',
                        lib: {
                            entry: 'src/hal/drivers/strategies/openDmxWorker.ts',
                            formats: ['cjs'],
                            fileName: () => 'openDmxWorker.js',
                        },
                        rollupOptions: {
                            external: ['worker_threads', 'serialport'],
                        },
                    },
                },
            },
        ]),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@components': path.resolve(__dirname, './src/components'),
            '@stores': path.resolve(__dirname, './src/stores'),
            '@hooks': path.resolve(__dirname, './src/hooks'),
            '@styles': path.resolve(__dirname, './src/styles'),
        },
    },
    server: {
        port: 5173,
    },
});
