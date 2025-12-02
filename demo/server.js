/**
 * 🎪 LUXSYNC DEMO SERVER
 * 
 * Servidor con headers de permisos para captura de audio de escritorio.
 * 
 * Uso: node server.js
 * Abre: http://localhost:3000/index-v2.html
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  // Default a index-v2.html
  let filePath = req.url === '/' ? '/index-v2.html' : req.url;
  filePath = path.join(__dirname, filePath);
  
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('404 - Archivo no encontrado');
      } else {
        res.writeHead(500);
        res.end('500 - Error del servidor');
      }
      return;
    }
    
    // Headers de seguridad para permitir captura de pantalla/audio
    res.writeHead(200, {
      'Content-Type': contentType,
      // Permitir display-capture para audio de escritorio
      'Permissions-Policy': 'display-capture=(self), microphone=(self), camera=(self)',
      // Permitir cross-origin isolation para SharedArrayBuffer (audio processing)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      // Cache control
      'Cache-Control': 'no-cache',
    });
    
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  🎪 ═══════════════════════════════════════════════════════');
  console.log('  🎪   LUXSYNC DEMO SERVER');
  console.log('  🎪 ═══════════════════════════════════════════════════════');
  console.log('');
  console.log(`  🌐 Local:    http://localhost:${PORT}/`);
  console.log(`  🌐 Demo V2:  http://localhost:${PORT}/index-v2.html`);
  console.log('');
  console.log('  ✅ Permisos habilitados:');
  console.log('     - 🖥️  Captura de pantalla (Audio Escritorio)');
  console.log('     - 🎤 Micrófono');
  console.log('     - 🌙 Selene AI');
  console.log('');
  console.log('  🛑 Ctrl+C para detener');
  console.log('  🎪 ═══════════════════════════════════════════════════════');
  console.log('');
});
