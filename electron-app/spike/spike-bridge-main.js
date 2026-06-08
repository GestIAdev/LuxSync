"use strict";
// WAVE-6005-SPIKE-2: Main Process — Crea SAB, lo envía al Renderer vía IPC, escribe a 44Hz.
// REGLA DE ORO: El Main NUNCA toca serialport. Solo maneja el SAB y la ventana.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const SAB_BYTES = 1024 * 1024; // 1 MB
const INTERVAL_MS = 22; // ~44Hz
let mainWindow = null;
let sab;
let view;
let tick = 0;
let timer = null;
function createSAB() {
    sab = new SharedArrayBuffer(SAB_BYTES);
    view = new Int32Array(sab);
    console.log(`[MAIN] SAB creado: ${(SAB_BYTES / 1024).toFixed(0)} KB`);
}
function startWriting() {
    timer = setInterval(() => {
        tick++;
        Atomics.store(view, 0, tick);
        Atomics.store(view, 1, (tick * 7 + 13) & 0xff);
        if (tick % 100 === 0) {
            console.log(`[MAIN] tick=${tick} | SAB[0]=${Atomics.load(view, 0)} SAB[1]=${Atomics.load(view, 1)}`);
        }
    }, INTERVAL_MS);
}
function createWindow() {
    const preloadPath = node_path_1.default.join(__dirname, 'spike-bridge-preload.js');
    mainWindow = new electron_1.BrowserWindow({
        width: 600,
        height: 400,
        title: 'WAVE-6005-SPIKE-2 — Glass Bridge',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: preloadPath,
            backgroundThrottling: false,
        },
    });
    mainWindow.webContents.on('did-finish-load', () => {
        console.log('[MAIN] did-finish-load — enviando SAB via MessageChannelMain');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
        const { port1, port2 } = new electron_1.MessageChannelMain();
        mainWindow.webContents.postMessage('glass-bridge-port', null, [port2]);
        port1.postMessage(sab);
        port1.close();
        startWriting();
    });
    mainWindow.on('closed', () => {
        if (timer)
            clearInterval(timer);
        mainWindow = null;
    });
    // Cargar HTML local
    const htmlPath = node_path_1.default.join(__dirname, 'spike-bridge-renderer.html');
    void mainWindow.loadFile(htmlPath);
}
electron_1.app.whenReady().then(() => {
    createSAB();
    createWindow();
});
electron_1.app.on('window-all-closed', () => {
    if (timer)
        clearInterval(timer);
    electron_1.app.quit();
});
