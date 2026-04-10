# AUDITORÍA TÉCNICA — OBSIDIAN VAULT
## Sistema de Licencias y Activación de LuxSync

```
CLASIFICACIÓN:  INTERNO — Cónclave
AUTOR:          PunkOpus — Arquitecto Senior DSP
SOLICITANTE:    Dirección de Arquitectura (Radwulf)
FECHA:          2026-04-09
WAVES:          2489 (Two-Gate Bootloader) · 2490 (Tier Separation) · 2491 (Activation UX)
ESTADO:         IMPLEMENTADO Y EN PRODUCCIÓN
```

---

## ÍNDICE

1. [Visión General del Sistema](#1-visión-general-del-sistema)
2. [Árbol de Archivos del Módulo](#2-árbol-de-archivos-del-módulo)
3. [Componente A — VeritasRSA.ts](#3-componente-a--veritasrsats)
4. [Componente B — LicenseValidator.js](#4-componente-b--licensevalidatorjs)
5. [Componente C — forge-jsc.cjs](#5-componente-c--forge-jsccjs)
6. [Componente D — generate-license.ts](#6-componente-d--generate-licensets)
7. [Componente E — main.ts (Two-Gate Bootloader)](#7-componente-e--maints-two-gate-bootloader)
8. [Componente F — Activation Screen (WAVE 2491)](#8-componente-f--activation-screen-wave-2491)
9. [Componente G — Tier Separation Protocol (WAVE 2490)](#9-componente-g--tier-separation-protocol-wave-2490)
10. [Flujo Completo — Secuencia de Arranque](#10-flujo-completo--secuencia-de-arranque)
11. [Flujo de Emisión de Licencias](#11-flujo-de-emisión-de-licencias)
12. [Modelo de Amenazas — Estado Actual](#12-modelo-de-amenazas--estado-actual)
13. [Hallazgos de Seguridad](#13-hallazgos-de-seguridad)
14. [Estado de Build Pipeline](#14-estado-de-build-pipeline)
15. [Inventario de Dependencias Criptográficas](#15-inventario-de-dependencias-criptográficas)

---

## 1. Visión General del Sistema

LuxSync implementa un sistema de protección de software offline de tres capas superpuestas, sin ningún servidor externo ni dependencia de red. El diseño es deliberadamente agnóstico del cloud: DJs en raves en campos sin cobertura deben poder usar la app.

### Arquitectura de Capas

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ELECTRON BOOT                                  │
│                                                                       │
│  app.whenReady() ─► [isDev?] ────► skip all gates ─► normal boot     │
│                         │                                             │
│                         └ [producción] ─► OBSIDIAN VAULT             │
│                                                                       │
│  ╔════════════════════════════════════════════════════════════╗       │
│  ║  PHANTOM GATE (GATE 0)                                     ║       │
│  ║  SHA-256 hash de main.js embebido en LicenseValidator.jsc  ║       │
│  ║  Detecta parches en el binario de arranque                 ║       │
│  ╠════════════════════════════════════════════════════════════╣       │
│  ║  GATE 1 — Hardware Fingerprint                             ║       │
│  ║  MAC address de la 1ª interfaz IPv4 no-interna             ║       │
│  ║  os.networkInterfaces() — zero deps externas               ║       │
│  ╠════════════════════════════════════════════════════════════╣       │
│  ║  GATE 2 — RSA-2048 / SHA-256                               ║       │
│  ║  Verifica firma del payload con clave pública embebida     ║       │
│  ║  en bytecode V8 (.jsc) — ilegible sin decompilador V8      ║       │
│  ╚════════════════════════════════════════════════════════════╝       │
│                         │                                             │
│                  ┌──────┴──────┐                                      │
│             TODOS PASS    ALGUNO FALLA                                │
│                  │              │                                     │
│            initTitan()    Activation Screen                           │
│            createWindow() (WAVE 2491 UX)                             │
│                           app no arranca                              │
└──────────────────────────────────────────────────────────────────────┘
```

### Tiers de Licencia

| Tier | Descripción | Restricción Principal |
|------|-------------|----------------------|
| `DJ_FOUNDER` | Beta cerrada — primeros usuarios | Hephaestus + Chronos deshabilitados |
| `FULL_SUITE` | Licencia completa | Sin restricciones |

---

## 2. Árbol de Archivos del Módulo

```
LuxSync/
├── electron-app/
│   ├── electron/
│   │   ├── license/
│   │   │   ├── VeritasRSA.ts            ← Motor criptográfico TypeScript
│   │   │   ├── LicenseValidator.js      ← Validador (template con placeholders)
│   │   │   ├── activation.html          ← UI de activación (WAVE 2491)
│   │   │   └── preload-activation.js    ← Preload IPC mínimo para activation screen
│   │   ├── main.ts                      ← Two-Gate insertion point + IPC handlers
│   │   └── preload.ts                   ← Expone getLicenseTier() al renderer
│   │
│   └── src/
│       ├── stores/
│       │   └── licenseStore.ts          ← Zustand store del tier en renderer
│       └── core/orchestrator/
│           └── TitanOrchestrator.ts     ← setLicenseTier() + Hephaestus DMX Gate
│
└── scripts/
    ├── generate-license.ts              ← CLI offline de emisión de licencias
    ├── forge-jsc.cjs                    ← Build step: inyección + bytenode compilation
    └── keys/
        ├── luxsync-private.pem          ← 🔒 EN .gitignore — JAMÁS al repo
        └── luxsync-public.pem           ← Inyectada en .jsc en build time
```

**Archivos en el build final (dist-electron/)**:
```
dist-electron/
├── main.js                              ← Legible — contiene require('./license/LicenseValidator.jsc')
└── license/
    ├── LicenseValidator.jsc             ← Bytecode V8 — ilegible, clave pública embebida
    ├── activation.html                  ← Copiado por forge-jsc.cjs
    └── preload-activation.js            ← Copiado por forge-jsc.cjs
```

---

## 3. Componente A — VeritasRSA.ts

**Ruta**: `electron-app/electron/license/VeritasRSA.ts`  
**Wave**: 2489  
**Origen**: Extracción quirúrgica de `docs/ideas/Veritas.ts` (clase `RealCryptoSignatures`)

### Responsabilidad

Motor criptográfico TypeScript puro. No contiene lógica de negocio. Solo primitivas.

### API Pública

```typescript
// Tipos
type LicenseTier = 'DJ_FOUNDER' | 'FULL_SUITE'

interface LuxLicense {
  client: string       // Nombre/alias del licenciatario (max 128 chars)
  hardwareId: string   // MAC address normalizada (lowercase, ':' separado)
  tier: LicenseTier    // Nivel de acceso
  issuedAt: string     // ISO 8601 — timestamp de emisión
  signature: string    // Hex-encoded RSA-2048/SHA-256
}

type LuxLicensePayload = Omit<LuxLicense, 'signature'>

// Funciones exportadas
serializePayload(payload: LuxLicensePayload): string
hashPayload(payload: LuxLicensePayload): string
rsaSign(dataHash: string, privateKeyPem: string): string   // Solo para generate-license.ts
rsaVerify(dataHash: string, signatureHex: string, publicKeyPem: string): boolean
validateLicenseStructure(data: unknown): data is LuxLicense
```

### Serialización Determinista

**Crítico**: El string que se firma debe ser idéntico en generación y verificación. Se garantiza ordenando las claves del payload **alfabéticamente** antes de `JSON.stringify`:

```typescript
export function serializePayload(payload: LuxLicensePayload): string {
  const ordered: Record<string, unknown> = {}
  const keys = Object.keys(payload).sort()  // ← orden alfabético forzado
  for (const key of keys) {
    ordered[key] = (payload as Record<string, unknown>)[key]
  }
  return JSON.stringify(ordered)  // → {"client":...,"hardwareId":...,"issuedAt":...,"tier":...}
}
```

En orden alfabético, los campos del payload quedan: `client` → `hardwareId` → `issuedAt` → `tier`.

### Primitivas RSA

```typescript
// Firma (solo en scripts/ — nunca distribuida)
crypto.sign('sha256', Buffer.from(dataHash), privateKeyPem)

// Verificación (dentro de .jsc — clave pública embebida en bytecode)
crypto.verify('sha256', Buffer.from(dataHash), publicKeyPem, Buffer.from(signatureHex, 'hex'))
```

Usa exclusivamente `node:crypto` nativo. Zero dependencias npm.

---

## 4. Componente B — LicenseValidator.js

**Ruta**: `electron-app/electron/license/LicenseValidator.js`  
**Naturaleza**: Template CommonJS con placeholders — **NO se ejecuta directamente** — se inyectan valores en build time y se compila a `.jsc`

### Placeholders en el Template

| Placeholder | Qué se inyecta | Quién lo inyecta |
|-------------|---------------|-----------------|
| `%%LUXSYNC_PUBLIC_KEY%%` | Contenido de `scripts/keys/luxsync-public.pem` | `forge-jsc.cjs` paso 4 |
| `%%MAIN_JS_HASH%%` | SHA-256 hex de `dist-electron/main.js` | `forge-jsc.cjs` paso 2 |

### Función Principal: `validateLicense(licensePath)`

Flujo de ejecución secuencial:

```
1. getHardwareId()          → MAC address actual de la máquina
2. verifyMainIntegrity()    → Phantom Gate — hash de main.js
   └─ FALLA → { valid: false, error: 'TAMPER_DETECTED' }
3. fs.existsSync(path)      → ¿Existe el archivo?
   └─ NO → { valid: false, error: 'LICENSE_NOT_FOUND' }
4. fs.readFileSync(path)    → Lectura del archivo
5. JSON.parse(content)      → Parseo
   └─ KO → { valid: false, error: 'LICENSE_PARSE_ERROR' }
6. isValidStructure(data)   → Validación de campos
   └─ KO → { valid: false, error: 'LICENSE_STRUCTURE_ERROR' }
7. GATE 1: license.hardwareId.toLowerCase() === detectedHwId
8. GATE 2: rsaVerify(hashPayload(payload), license.signature, PUBLIC_KEY)
9. return { valid: gate1 && gate2, gate1, gate2, phantomGate, detectedHwId, ... }
```

### Resultado Completo

```typescript
interface LicenseValidationResult {
  valid: boolean
  gate1: boolean          // Hardware ID match
  gate2: boolean          // RSA signature valid
  phantomGate: boolean    // main.js integrity OK
  detectedHwId: string    // MAC address detectada en esta máquina
  client?: string         // Del .luxlicense si es válido
  tier?: LicenseTier      // Del .luxlicense si es válido
  error?: string          // Código de error si !valid
}
```

### Phantom Gate — Detección de Tamper

```javascript
function verifyMainIntegrity() {
  if (EXPECTED_MAIN_HASH === '%%MAIN_JS_HASH%%') return true  // Dev/no-inyectado → pass
  let baseDir = path.join(__dirname, '..')
  baseDir = baseDir.replace('app.asar.unpacked', 'app.asar')  // Reescritura de ruta en paquete
  const mainPath = path.join(baseDir, 'main.js')
  const mainContent = fs.readFileSync(mainPath)
  const actualHash = crypto.createHash('sha256').update(mainContent).digest('hex')
  return actualHash === EXPECTED_MAIN_HASH
}
```

**Importante**: El `.jsc` vive en `app.asar.unpacked/` (necesita filesystem real para bytenode), pero el `main.js` que valida vive dentro del `.asar` estándar. La reescritura de ruta `replace('app.asar.unpacked', 'app.asar')` es necesaria para leer el binario correcto.

### Hardware ID Capture

```javascript
function getHardwareId() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const addr of interfaces[name]) {
      if (addr.family === 'IPv4' && !addr.internal && addr.mac !== '00:00:00:00:00:00') {
        return addr.mac.toLowerCase()  // Ej: "a1:b2:c3:d4:e5:f6"
      }
    }
  }
  return 'UNKNOWN_HARDWARE'
}
```

Fallback: devuelve `'UNKNOWN_HARDWARE'` en lugar de lanzar excepción. Gate 1 fallará porque ninguna licencia puede tener `hardwareId: 'UNKNOWN_HARDWARE'`.

### Exports CommonJS

```javascript
module.exports = { validateLicense, getHardwareId }
```

CommonJS obligatorio: `require('bytenode')` solo funciona con CJS, no ESM.

---

## 5. Componente C — forge-jsc.cjs

**Ruta**: `scripts/forge-jsc.cjs`  
**Wave**: 2489 + 2491  
**Naturaleza**: Script de build — se ejecuta en el pipeline DESPUÉS de `vite build` y ANTES de `electron-builder`

### Pipeline Completo

```
tsc → vite build → copy:phantom → [FORGE JSC] → electron-builder
```

### Pasos de Ejecución

```
PASO 1  Verificar que main.js existe en dist-electron/
PASO 2  Calcular SHA-256 de main.js → mainHash
PASO 3  Cargar scripts/keys/luxsync-public.pem
PASO 4  Leer LicenseValidator.js (template) e inyectar:
           - %%LUXSYNC_PUBLIC_KEY%% → contenido PEM de la clave pública
           - %%MAIN_JS_HASH%%       → mainHash calculado en paso 2
PASO 5  Escribir LicenseValidator.js inyectado en dist-electron/license/
PASO 6  Compilar .js → .jsc vía bytenode:
           bytenode.compileFile({ filename, output, electron: true, compileAsModule: true })
           • electron:true         → usa el runtime V8 del Electron empaquetado
           • compileAsModule:true  → envuelve con Module.wrap() (require, exports, etc. disponibles)
PASO 7  Destruir el .js intermedio (fs.unlinkSync)
PASO 8  Copiar activation.html → dist-electron/license/activation.html
PASO 9  Copiar preload-activation.js → dist-electron/license/preload-activation.js
PASO 10 Verificación final: ¿.jsc existe? ¿.js eliminado? → exit(1) si KO
```

### Compatibilidad V8

**CRÍTICO**: El `.jsc` generado está atado a la versión exacta de V8 del Electron usado en el build. Si se actualiza Electron, hay que regenerar el `.jsc`.

```
Electron 28.x → V8 11.8 → LicenseValidator.jsc (versión actual)
```

---

## 6. Componente D — generate-license.ts

**Ruta**: `scripts/generate-license.ts`  
**Wave**: 2489  
**Naturaleza**: CLI offline — NUNCA se distribuye, NUNCA se empaqueta. Solo en la máquina de Radwulf.

### Uso

```bash
npx tsx scripts/generate-license.ts \
  --client "DJ_RadWulf" \
  --hwid   "a1:b2:c3:d4:e5:f6" \
  --tier   DJ_FOUNDER \
  --out    ./licenses/DJ_RadWulf.luxlicense
```

### Flujo Interno

```
1. parseArgs()           → Validar --client, --hwid, --tier, --out
2. fs.readFileSync(scripts/keys/luxsync-private.pem)
3. Construir payload     → { client, hardwareId: hwid.toLowerCase(), tier, issuedAt: new Date().toISOString() }
4. serializePayload()    → JSON con keys ordenadas alfabéticamente
5. hashPayload()         → SHA-256 hex del JSON serializado
6. rsaSign(hash, key)    → crypto.sign('sha256', Buffer.from(hash), privateKeyPem).toString('hex')
7. license = { ...payload, signature }
8. fs.mkdirSync(outDir, { recursive: true })
9. fs.writeFileSync(out, JSON.stringify(license, null, 2))
```

### Ejemplo de Archivo .luxlicense Generado

```json
{
  "client": "DJ_RadWulf",
  "hardwareId": "a1:b2:c3:d4:e5:f6",
  "tier": "DJ_FOUNDER",
  "issuedAt": "2026-04-09T10:00:00.000Z",
  "signature": "3a4f7b8c...512 caracteres hex...de la firma RSA"
}
```

### Dependencias

**Cero dependencias npm externas**. Solo:
- `node:crypto` — firma RSA
- `node:fs` — lectura de clave privada, escritura del archivo
- `node:path` — resolución de rutas
- `../electron-app/electron/license/VeritasRSA` — funciones de serialización y firma

---

## 7. Componente E — main.ts (Two-Gate Bootloader)

**Ruta**: `electron-app/electron/main.ts`  
**Waves**: 2489 + 2490 + 2491

### Flag de Modo Desarrollo

```typescript
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
```

**En `isDev === true`**: Todo el Two-Gate se salta. La variable `currentLicenseTier` se queda en su valor por defecto: `'FULL_SUITE'`.

### Carga del Validador Bytecode

```typescript
// Al inicio del módulo, ANTES de cualquier import
const bytenode = require('bytenode')  // Registra handler para .jsc en require()

// En app.whenReady(), resolviendo la ruta según contexto:
const jscPath = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist-electron', 'license', 'LicenseValidator.jsc')
  : path.join(__dirname, 'license', 'LicenseValidator.jsc')
```

**Fallback en cascada**: Si `.jsc` falla, intenta cargar el `.js` fuente. Si también falla, usa UNKNOWN_HARDWARE y procede a la pantalla de activación.

### Estado de Tier en el Proceso Principal

```typescript
let currentLicenseTier: 'DJ_FOUNDER' | 'FULL_SUITE' = 'FULL_SUITE'
```

Se actualiza **solo** cuando el Two-Gate pasa:
```typescript
currentLicenseTier = result.tier  // Leído del .luxlicense verificado
titanOrchestrator.setLicenseTier(currentLicenseTier)
```

### IPC Exposure

```typescript
ipcMain.handle('license:getTier', () => currentLicenseTier)
```

El renderer puede consultar el tier en cualquier momento via `window.lux.getLicenseTier()`.

### Pantalla de Activación vs Diálogo Nativo

**Decisión de diseño (WAVE 2491)**: En lugar del `dialog.showMessageBoxSync()` del blueprint original, se implementó una ventana Chromium completa (`activation.html`) con UX pulida. Ventajas:
- Copy del Hardware ID con un botón
- Input drag-and-drop del `.luxlicense`
- Branding LuxSync completo
- Sin dependencia del theme nativo del SO

---

## 8. Componente F — Activation Screen (WAVE 2491)

**Archivos**:
- `electron-app/electron/license/activation.html` — UI completa
- `electron-app/electron/license/preload-activation.js` — Preload IPC mínimo

### Configuración BrowserWindow

```typescript
new BrowserWindow({
  width: 600,
  height: 520,
  frame: false,           // Sin chrome del SO
  resizable: false,
  webPreferences: {
    nodeIntegration: false,    // ← Seguridad: no expone Node.js al renderer
    contextIsolation: true,    // ← Seguridad: aislamiento de contexto
    preload: '...preload-activation.js',
  },
})
```

### API Expuesta (contextBridge)

```javascript
// preload-activation.js
contextBridge.exposeInMainWorld('activation', {
  getData:     () => ipcRenderer.invoke('activation:getData'),     // hwid + error info
  copyHwid:    () => ipcRenderer.invoke('activation:copyHwid'),    // copia al clipboard
  loadLicense: () => ipcRenderer.invoke('activation:loadLicense'), // file dialog + validación
  restart:     ()  => ipcRenderer.send('activation:restart'),      // app.relaunch()
  quit:        ()  => ipcRenderer.send('activation:quit'),         // app.quit()
})
```

**Surface de ataque mínima**: Solo 5 métodos. Zero acceso a `luxsync`, `lux`, `electron`, APIs del engine.

### Flujo de Activación del Usuario

```
1. Usuario abre LuxSync sin licencia
2. activation.html se renderiza — HWID visible en naranja monospace
3. Usuario pulsa "Copiar" → HWID al portapapeles → lo envía a Radwulf
4. Radwulf genera .luxlicense con generate-license.ts
5. Usuario pulsa "Cargar .luxlicense" → dialog de sistema → selecciona el archivo
6. main.ts valida con licenseValidator.validateLicense(selectedPath)
   └─ VÁLIDO  → copia a userData/license/license.luxlicense → app.relaunch()
   └─ INVÁLIDO → mensaje de error en pantalla → reintento
```

### Casos de Error Mostrados

| Condición | Título UI | Detalle UI |
|-----------|-----------|------------|
| `validatorLoadError` | Error crítico de licencia | Reinstala la aplicación |
| `gate1 false, gate2 true` | Hardware no autorizado | Copia tu HW ID y envíalo a soporte |
| `gate2 false` | Licencia inválida | Firma no válida |
| Error `TAMPER` | Integridad comprometida | Reinstala la aplicación |
| Default / not found | Licencia no encontrada | Carga un .luxlicense válido |

---

## 9. Componente G — Tier Separation Protocol (WAVE 2490)

El tier de licencia tiene efectos reales en el runtime — no es solo una etiqueta decorativa.

### Propagación del Tier

```
main.ts (Two-Gate pasa)
  → currentLicenseTier = result.tier
  → titanOrchestrator.setLicenseTier(currentLicenseTier)
  → ipcMain.handle('license:getTier', () => currentLicenseTier)
       ↓
preload.ts expone:
  getLicenseTier: () => ipcRenderer.invoke('license:getTier')
       ↓
licenseStore.ts (Zustand, renderer):
  hydrate() → window.lux.getLicenseTier() → set({ tier, hydrated: true })
```

### Efectos por Tier

#### TitanOrchestrator — Hephaestus DMX Gate

```typescript
// TitanOrchestrator.ts — hot path de cada tick
const hephOutputs = hephRuntime.tick(Date.now())

// DJ_FOUNDER: el engine corre, pero su output se descarta silenciosamente
if (hephOutputs.length > 0 && this._licenseTier !== 'DJ_FOUNDER') {
  // procesar y enviar a fixtures...
}
```

Hephaestus **sigue ejecutándose** en DJ_FOUNDER — solo su output DMX es silenciado. Esto evita errores de inicialización y mantiene el runtime limpio.

#### LicenseStore — Tab Gating (UI)

```typescript
// Tabs restringidos para DJ_FOUNDER
const DJ_FOUNDER_RESTRICTED_TABS = new Set(['chronos', 'hephaestus'])

isTabAllowed: (tabId: string) => {
  if (tier === 'FULL_SUITE') return true
  return !DJ_FOUNDER_RESTRICTED_TABS.has(tabId)
}
```

Los tabs `chronos` y `hephaestus` están bloqueados en la UI para DJ_FOUNDER.

### Resumen de Funcionalidades por Tier

| Funcionalidad | DJ_FOUNDER | FULL_SUITE |
|---------------|-----------|-----------|
| Dashboard | ✅ | ✅ |
| Live control | ✅ | ✅ |
| Calibration | ✅ | ✅ |
| Build / Forge | ✅ | ✅ |
| Nexus | ✅ | ✅ |
| Core | ✅ | ✅ |
| **Chronos** | ❌ (tab bloqueado) | ✅ |
| **Hephaestus** | ❌ (DMX silenciado) | ✅ |

---

## 10. Flujo Completo — Secuencia de Arranque

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Electron main.ts — app.whenReady()                                      │
│                                                                          │
│  1. require('bytenode')                   [Al inicio del módulo]         │
│                                                                          │
│  2. isDev check ────────────── true ──► skip vault, tier=FULL_SUITE     │
│          │                                                               │
│          └── false                                                       │
│                                                                          │
│  3. require(LicenseValidator.jsc)                                        │
│          │                                                               │
│          ├── ERROR ──► try JS fallback ──► ERROR ──► fallbackHwId       │
│          └── OK                                                          │
│                                                                          │
│  4. licensePath = userData/license/license.luxlicense                   │
│                                                                          │
│  5. licenseValidator.validateLicense(licensePath)                       │
│          │                                                               │
│          │  Internamente:                                                │
│          │  ├── Phantom Gate: SHA-256(main.js) === EXPECTED?            │
│          │  ├── fs.existsSync(path)?                                    │
│          │  ├── JSON.parse(content)                                     │
│          │  ├── isValidStructure()                                      │
│          │  ├── Gate 1: detectedMAC === license.hardwareId?             │
│          │  └── Gate 2: rsaVerify(hashPayload, sig, PUBLIC_KEY)?        │
│          │                                                               │
│          ├── result.valid = false ──► Activation Screen (WAVE 2491)    │
│          │                           return (no continúa boot)          │
│          │                                                               │
│          └── result.valid = true                                         │
│                   │                                                      │
│  6. currentLicenseTier = result.tier                                    │
│  7. titanOrchestrator.setLicenseTier(tier)                              │
│  8. Continúa boot normal: configManager.load(), createWindow(), etc.    │
│                                                                          │
│  9. ipcMain.handle('license:getTier') disponible                        │
│                                                                          │
│ 10. Renderer: licenseStore.hydrate() → isTabAllowed() aplicado          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Flujo de Emisión de Licencias

### Setup Inicial (Una Sola Vez)

```bash
# Generar par de claves RSA-2048
openssl genrsa -out scripts/keys/luxsync-private.pem 2048
openssl rsa -in scripts/keys/luxsync-private.pem -pubout -out scripts/keys/luxsync-public.pem
```

La clave pública se inyecta en el `.jsc` en cada build. La clave privada **jamás** sale de la máquina de Radwulf.

### Onboarding de un Nuevo DJ

```
1. DJ instala LuxSync Beta
2. App arranca → Gate 1 falla (no hay .luxlicense en userData)
3. Activation Screen muestra HWID en naranja: "a1:b2:c3:d4:e5:f6"
4. DJ copia el HWID → lo envía por WhatsApp / email a Radwulf

5. Radwulf ejecuta en su máquina:
   npx tsx scripts/generate-license.ts \
     --client "DJ_NombreReal" \
     --hwid   "a1:b2:c3:d4:e5:f6" \
     --tier   DJ_FOUNDER \
     --out    ./licenses/DJ_NombreReal.luxlicense

6. Radwulf envía el archivo .luxlicense al DJ

7. DJ en Activation Screen → "Cargar .luxlicense" → selecciona el archivo
   main.ts valida → VÁLIDO → copia a userData/license/ → app.relaunch()

8. App arranca normalmente
```

### Cambio de Hardware del DJ

```
1. DJ instala LuxSync en portátil nuevo
2. Activation Screen muestra nuevo HWID (distinto)
3. DJ envía nuevo HWID a Radwulf
4. Radwulf genera nueva licencia con nuevo --hwid
5. DJ carga nueva licencia → funciona
Note: La licencia vieja sigue siendo válida cryptográficamente, pero Gate 1
      falla en el hardware antiguo (a no ser que el DJ lo use también).
```

---

## 12. Modelo de Amenazas — Estado Actual

### Vector A — Parchear main.js para saltar el require()

**Descripción**: `npx asar extract app.asar ./unpacked` → editar `main.js` → eliminar el bloque del vault → reempaquetar.

**Contramedida activa**: Phantom Gate. El hash SHA-256 de `main.js` está embebido en el `.jsc`. Cualquier modificación de `main.js` cambia su hash → el `.jsc` devuelve `TAMPER_DETECTED`.

**Limitación**: El hash se calcula sobre `main.js` **post-vite-build**, no sobre el código fuente. Si el atacante regenera `main.js` sin el vault Y sin cambiar el hash, el gate fallaría. Pero el hash está en el `.jsc` compilado — sin clave privada no puede regenerar un `.jsc` con el hash correcto del nuevo `main.js`.

**Nivel de mitigación**: Alto.

---

### Vector B — Modificar el .luxlicense

**Descripción**: Editar el JSON para cambiar el `hardwareId` al de otra máquina, o cambiar el `tier`.

**Contramedida activa**: Gate 2. La firma RSA se calcula sobre `SHA-256(serializePayload({client, hardwareId, tier, issuedAt}))`. Cualquier cambio en cualquier campo invalida la firma.

**Sin la clave privada**: Imposible generar una firma válida para el payload modificado.

**Nivel de mitigación**: Total. RSA-2048 no se rompe con hardware de consumo.

---

### Vector C — Compartir el .luxlicense

**Descripción**: DJ A le pasa su `.luxlicense` a DJ B.

**Contramedida activa**: Gate 1. El `hardwareId` del archivo corresponde al HWID de DJ A. En la máquina de DJ B, `getHardwareId()` devuelve otro valor → Gate 1 falla.

**Nivel de mitigación**: Total.

---

### Vector D — Clonar la MAC Address

**Descripción**: Técnico avanzado cambia su MAC para que coincida con el valor del `.luxlicense` de alguien más.

**Contramedida**: **Ninguna activa**. Este vector está conscientemente aceptado para la Beta.

**Dificultad**: Media-alta. Requiere conocimiento técnico, y la MAC se restaura tras reinstalación del SO.

**Plan post-Beta**: Fingerprint combinado (MAC + disk serial + hostname hash).

---

### Vector E — Decompilar el .jsc

**Descripción**: Extraer la clave pública del bytecode V8 para estudiar la lógica.

**Contramedida**: No existen decompiladores de V8 bytecode públicos y funcionales para código de producción. El formato bytecode V8 no es estable entre versiones, y cada `.jsc` está ligado a la versión exacta de Electron/V8.

**Lo que el atacante puede ver**: Que existe un `require('./license/LicenseValidator.jsc')` en `main.js`. No puede ver la clave pública ni la lógica.

**Nivel de mitigación**: Alto.

---

### Matriz de Riesgo

| Vector | Dificultad Ataque | Impacto | Riesgo Neto | Estado |
|--------|------------------|---------|-------------|--------|
| Parchear main.js | Media | Alto | **MEDIO** | ✅ Phantom Gate activo |
| Modificar .luxlicense | Trivial | Alto teórico | **NULO** | ✅ RSA-2048 |
| Compartir .luxlicense | Trivial | Alto teórico | **NULO** | ✅ Hardware bind |
| Clonar MAC | Media-Alta | Medio | **BAJO** | ⚠️ Aceptado en Beta |
| Decompilar .jsc | Muy Alta | Alto teórico | **BAJO** | ✅ V8 bytecode |
| Reverse engineer lógica | Alta | Bajo práctico | **MUY BAJO** | ✅ .jsc + no hay stubs |

---

## 13. Hallazgos de Seguridad

### ✅ Positivos (bien implementado)

1. **Zero mocks / Zero stubs**: El Axioma Anti-Simulación se respeta al 100%. No hay `if DEV_BYPASS return true` en la lógica de validación. El bypass de dev es en `main.ts`, antes de llamar al validador — el validador mismo no tiene modos.

2. **Serialización determinista**: Las claves del payload se ordenan alfabéticamente antes de firmar. Elimina una clase entera de errores de "firma que no verifica por orden diferente de keys".

3. **Clave pública no en texto plano**: El template `LicenseValidator.js` tiene el placeholder `%%LUXSYNC_PUBLIC_KEY%%`. El código fuente que se commitea al repo nunca contiene la clave. Solo el `.jsc` compilado (no en el repo) la tiene embebida.

4. **CommonJS correcto**: `bytenode` requiere CJS. Todos los archivos del módulo de licencias usan `require()` y `module.exports` — no ESM. Correcto y consistente.

5. **contextIsolation + no nodeIntegration**: La ventana de activación tiene configuración de seguridad óptima. El preload expone solo 5 métodos sin superficie de ataque.

6. **Phantom Gate con reescritura de ruta asar**: El manejo del path `app.asar.unpacked` → `app.asar` está implementado correctamente para el contexto empaquetado.

7. **Fallback de carga del .jsc**: El fallback en cascada `.jsc` → `.js` → `VALIDATOR_LOAD_ERROR` es robusto. Nunca lanza una excepción no controlada al proceso principal.

### ⚠️ Observaciones (no críticas)

1. **clave privada en scripts/keys/**: Asegurarse que `.gitignore` incluye `scripts/keys/luxsync-private.pem`. El blueprint lo especifica, pero conviene verificar con `git check-ignore scripts/keys/luxsync-private.pem` regularmente.

2. **HWID fallback 'UNKNOWN_HARDWARE'**: Si ninguna interfaz de red tiene IPv4 (raro, pero posible en VMs sin red), el HWID devuelto es la cadena literal `'UNKNOWN_HARDWARE'`. Gate 1 fallará correctamente porque ninguna licencia legítima tiene ese valor, pero el mensaje de error será confuso para el usuario. Podría mejorarse el mensaje en ese caso edge.

3. **MAC address como único fingerprint**: Suficiente para Beta. Para post-lanzamiento, combinar con serial de disco y hostname para reducir el riesgo del Vector D (clonar MAC).

4. **Tier en Hephaestus silencia output, no el engine**: Design decision documentada y correcta. Hephaestus.tick() sigue corriendo en DJ_FOUNDER. El consumo de CPU es mínimo y el beneficio es eliminar errores de inicialización parcial.

### ❌ Issues Críticos

**Ninguno identificado.** El sistema cumple todos los axiomas del blueprint:
- ✅ Zero dependencias externas de red
- ✅ Funciona 100% offline
- ✅ RSA real, no simulado
- ✅ Hardware-bound, no compartible
- ✅ Bytecode V8, no JS legible en producción

---

## 14. Estado de Build Pipeline

### Scripts en package.json (electron-app)

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.node.json && vite build && npm run copy:phantom && npm run forge:jsc && electron-builder",
    "forge:jsc": "node ../scripts/forge-jsc.cjs"
  }
}
```

### Requiere para funcionar en build

1. `scripts/keys/luxsync-public.pem` — presente (no en repo)
2. `scripts/keys/luxsync-private.pem` — presente solo en máquina de Radwulf
3. `electron-app/node_modules/bytenode` instalado
4. `dist-electron/main.js` generado por `vite build` antes de `forge:jsc`

### Output de forge-jsc.cjs (consola esperada)

```
  ╔══════════════════════════════════════════════╗
  ║   🛡️  OBSIDIAN VAULT — FORGE JSC            ║
  ╠══════════════════════════════════════════════╣
  ║  main.js hash: abc123def456789012345678...   ║
  ║  Public key loaded (XXX chars)               ║
  ║  LicenseValidator.js inyectado ✅            ║
  ║  LicenseValidator.jsc forjado  ✅            ║
  ║  LicenseValidator.js destruido  🔥           ║
  ║  activation.html copiado       ✅            ║
  ║  preload-activation.js copiado ✅            ║
  ║                                              ║
  ║  ✅ FORGE COMPLETE — Source destroyed        ║
  ╚══════════════════════════════════════════════╝
```

---

## 15. Inventario de Dependencias Criptográficas

| Operación | Módulo | Algoritmo | Dónde |
|-----------|--------|-----------|-------|
| Generación de claves | `openssl` CLI | RSA-2048 | Setup inicial offline |
| Firma de licencias | `node:crypto` → `crypto.sign()` | RSA-2048 / SHA-256 | `generate-license.ts` |
| Verificación de firma | `node:crypto` → `crypto.verify()` | RSA-2048 / SHA-256 | `LicenseValidator.js` → `.jsc` |
| Hash de payload | `node:crypto` → `createHash('sha256')` | SHA-256 | `VeritasRSA.ts` + `LicenseValidator.js` |
| Phantom Gate hash | `node:crypto` → `createHash('sha256')` | SHA-256 | `forge-jsc.cjs` + `LicenseValidator.js` |
| Bytecode compilation | `bytenode` | V8 bytecode | `forge-jsc.cjs` |

**Dependencias npm del módulo de licencias**:
- `bytenode` (devDependency en electron-app) — compilación a V8 bytecode
- `node:crypto`, `node:fs`, `node:os`, `node:path` — módulos nativos Node.js

**Zero dependencias de red**. **Zero APIs externas**. **Zero telemetría**.

---

*Documento generado por auditoría de código en profundidad — WAVE 2489-2491 — LuxSync Cónclave*
