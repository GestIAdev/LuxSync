# WAVE 2489 — THE OBSIDIAN VAULT
## Blueprint Arquitectónico: Sistema de Licencias Offline Inviolable

```
CLASIFICACIÓN:   CONFIDENCIAL — Solo para Cónclave
AUTOR:           PunkOpus — Arquitecto Senior DSP
SOLICITANTE:     Dirección de Arquitectura (Gemini / Radwulg)
FECHA:           2026-04-06
ESTADO:          BLUEPRINT — Código NO incluido
WAVE:            2489
CODENAME:        THE OBSIDIAN VAULT
```

---

## ÍNDICE

1. [Visión General y Principios](#1-visión-general-y-principios)
2. [Extracción Quirúrgica — Veritas RSA](#2-extracción-quirúrgica--veritas-rsa)
3. [Payload de Licencia (.luxlicense)](#3-payload-de-licencia-luxlicense)
4. [La Forja de Llaves — Generador Offline](#4-la-forja-de-llaves--generador-offline)
5. [Two-Gate Bootloader Pattern](#5-two-gate-bootloader-pattern)
6. [La Bóveda V8 — Operación "Código Oscuro"](#6-la-bóveda-v8--operación-código-oscuro)
7. [Árbol de Ficheros Final](#7-árbol-de-ficheros-final)
8. [Flujo Completo — Secuencia Temporal](#8-flujo-completo--secuencia-temporal)
9. [Modelo de Amenazas y Contramedidas](#9-modelo-de-amenazas-y-contramedidas)
10. [Decisiones Arquitectónicas y Razonamiento](#10-decisiones-arquitectónicas-y-razonamiento)

---

## 1. Visión General y Principios

### La Premisa

LuxSync es software de iluminación profesional. La Beta se distribuye a DJs fundadores y early adopters. Necesitamos un sistema de licencias que:

- Funcione **100% offline** — los DJs están en garitos sin WiFi, no en oficinas con fibra
- Sea **inviolable por script kiddies** — que desempaquetar el `.asar` no sirva de nada
- Sea **zero-dependencia** — ni APIs externas, ni servidores de licencias, ni telemetría
- Sea **humano** — si un DJ cambia de portátil, no pierde su licencia para siempre

### El Patrón: Two-Gate + V8 Bytecode

```
┌─────────────────────────────────────────────────────┐
│                  ELECTRON main.ts                    │
│                                                      │
│   app.whenReady() ──►  LicenseValidator.jsc          │
│                        (V8 Bytecode — ilegible)      │
│                              │                       │
│                    ┌─────────┴─────────┐             │
│                    │                   │             │
│               GATE 1              GATE 2             │
│           Hardware ID         RSA Signature          │
│          (MAC / mobo)        (SHA-256 + RSA)         │
│                    │                   │             │
│                    └─────────┬─────────┘             │
│                              │                       │
│                    ┌─────────┴─────────┐             │
│                    │                   │             │
│              AMBOS PASS           ALGUNO FALLA       │
│                    │                   │             │
│              initTitan()      showLicenseError()     │
│              createWindow()   (modal con HW ID)       │
│                                app.quit()            │
└─────────────────────────────────────────────────────┘
```

### Axioma Anti-Simulación

Todo el sistema usa criptografía **real** de Node.js `crypto`. Cero mocks. Cero stubs. RSA-2048 con SHA-256. Si la firma no verifica, la app no arranca. Punto.

---

## 2. Extracción Quirúrgica — Veritas RSA

### Origen: `Veritas.ts` (Dentiagest)

El archivo Veritas.ts tiene 2337 líneas. Contiene:
- Merkle Trees (NO nos interesa)
- Zero-Knowledge Proofs pesadas con circuitos (NO nos interesa)
- Blockchain-style certificate chains (NO nos interesa)
- **Firma RSA con `crypto.sign()` y `crypto.verify()`** ← ESTO

### Qué extraemos exactamente

De la clase `RealCryptoSignatures` (líneas 85-205 de Veritas.ts), extraemos **dos operaciones**:

| Operación | Método Veritas | Uso en LuxSync |
|-----------|---------------|----------------|
| **Firmar** | `signCertificate(dataHash)` → `crypto.sign('sha256', Buffer.from(dataHash), privateKey)` | Solo en el CLI offline (`generate-license.ts`) |
| **Verificar** | `verifyCertificate(dataHash, signature)` → `crypto.verify('sha256', Buffer.from(dataHash), publicKey, Buffer.from(signature, 'hex'))` | Solo en `LicenseValidator.ts` (dentro de Electron) |

### Qué NO extraemos

- `crypto.generateKeyPairSync()` — Las llaves se generan UNA VEZ manualmente y se guardan como archivos PEM. No se generan dinámicamente.
- Toda la clase `HeavyZKProofs` — No aplica
- `MerkleNode`, `TruthBlock`, `TruthCertificate` — No aplica
- `SeleneVeritas` entera — Solo nos llevamos las dos llamadas de `crypto`

### Interfaz aislada

```typescript
// electron/license/LicenseValidator.ts

interface LuxLicense {
  client: string
  hardwareId: string
  tier: 'DJ_FOUNDER' | 'FULL_SUITE'
  issuedAt: string      // ISO 8601
  signature: string     // hex-encoded RSA signature
}

// La única función pública:
function validateLicense(licensePath: string): LicenseValidationResult
```

La lógica RSA queda encapsulada en ~60 líneas. El resto de Veritas.ts no cruza la frontera.

---

## 3. Payload de Licencia (.luxlicense)

### Formato: JSON firmado

El archivo `.luxlicense` es un JSON plano con firma RSA embebida. No es binario, no está cifrado — la protección viene de la firma, no de la ofuscación del payload.

### Estructura del Payload

```json
{
  "client": "DJ_RadWulf",
  "hardwareId": "a1:b2:c3:d4:e5:f6",
  "tier": "DJ_FOUNDER",
  "issuedAt": "2026-04-06T12:00:00.000Z",
  "signature": "3a4f7b8c...hex...512chars"
}
```

### Campos

| Campo | Tipo | Descripción | Validación |
|-------|------|-------------|------------|
| `client` | `string` | Nombre/alias del licenciatario. Puramente informativo. | No vacío. Max 128 chars. |
| `hardwareId` | `string` | Huella hardware de la máquina del DJ. Formato: MAC address normalizada (lowercase, separada por `:`) o UUID de placa base. | Debe coincidir con el hardware ID detectado en Gate 1. |
| `tier` | `enum` | Nivel de licencia. `DJ_FOUNDER` = Beta cerrada. `FULL_SUITE` = futuro post-launch. | Debe ser uno de los valores del enum. |
| `issuedAt` | `string` | Timestamp ISO 8601 de emisión. | Debe parsear como Date válida. |
| `signature` | `string` | Firma RSA-2048/SHA-256 hex-encoded del payload (excluyendo el propio campo `signature`). | Debe verificar contra la clave pública embebida. |

### Proceso de firma

El string que se firma es el **hash SHA-256 del payload sin el campo `signature`**:

```
payload = { client, hardwareId, tier, issuedAt }
dataToSign = sha256(JSON.stringify(payload))  // con keys ordenadas
signature = rsa_sign(dataToSign, privateKey)
```

Las keys se ordenan alfabéticamente (`JSON.stringify` con `Object.keys().sort()`) para garantizar determinismo. Axioma Anti-Simulación: misma entrada → misma firma, siempre.

### Ubicación del archivo

| Plataforma | Ruta |
|------------|------|
| Windows | `%APPDATA%/luxsync-electron/license/license.luxlicense` |
| macOS | `~/Library/Application Support/luxsync-electron/license/license.luxlicense` |
| Linux | `~/.config/luxsync-electron/license/license.luxlicense` |

Se usa `app.getPath('userData')` + `/license/` como directorio canónico. El usuario también podrá colocar el archivo en el directorio raíz de la app (fallback).

---

## 4. La Forja de Llaves — Generador Offline

### Arquitectura del CLI

`generate-license.ts` es un script TypeScript independiente que se ejecuta offline en NUESTRA máquina (la de Radwulf). **Nunca se distribuye.** Nunca se empaqueta. Vive en `scripts/` del repo.

```
scripts/
  generate-license.ts     ← La Forja
  keys/
    luxsync-private.pem   ← 🔒 NUNCA sale de esta carpeta. En .gitignore.
    luxsync-public.pem    ← Se embebe en LicenseValidator.ts
```

### Flujo de generación

```
PASO 1 — GENERACIÓN DE LLAVES (una sola vez, manual)
═══════════════════════════════════════════════════════

  $ openssl genrsa -out scripts/keys/luxsync-private.pem 2048
  $ openssl rsa -in scripts/keys/luxsync-private.pem -pubout -out scripts/keys/luxsync-public.pem

  AVISO: La clave privada se añade a .gitignore ANTES de commitear.
         Si la privada se filtra, todo el sistema queda comprometido.


PASO 2 — EMISIÓN DE LICENCIA (por cada DJ)
═══════════════════════════════════════════

  $ npx tsx scripts/generate-license.ts \
      --client "DJ_RadWulf" \
      --hwid "a1:b2:c3:d4:e5:f6" \
      --tier DJ_FOUNDER \
      --out ./licenses/DJ_RadWulf.luxlicense
```

### Interfaz del CLI

```typescript
// scripts/generate-license.ts

// Argumentos CLI (parseados con process.argv, sin dependencias externas)
interface CLIArgs {
  client: string       // --client "nombre"
  hwid: string         // --hwid "mac:address"
  tier: string         // --tier DJ_FOUNDER | FULL_SUITE
  out: string          // --out "ruta/salida.luxlicense"
}

// Flujo:
// 1. Parsear argumentos
// 2. Cargar clave privada de scripts/keys/luxsync-private.pem
// 3. Construir payload { client, hardwareId, tier, issuedAt }
// 4. Serializar con keys ordenadas → JSON string
// 5. sha256(jsonString) → dataHash
// 6. crypto.sign('sha256', Buffer.from(dataHash), privateKey) → signature hex
// 7. Añadir signature al payload
// 8. Escribir JSON a --out
// 9. Imprimir por consola: cliente, tier, hash, primeros 32 chars de firma
```

### Dependencias

**Cero.** Solo Node.js `crypto` y `fs`. Sin npm install. Sin paquetes externos.

### Seguridad de la Clave Privada

```gitignore
# .gitignore — OBLIGATORIO
scripts/keys/luxsync-private.pem
*.luxlicense
```

La clave privada **JAMÁS** se commitea. Si se necesita backup, se cifra con passphrase y se guarda en un lugar seguro offline (USB cifrado, etc). No en la nube. No en el repo.

---

## 5. Two-Gate Bootloader Pattern

### Punto de Inserción en `main.ts`

El Two-Gate se ejecuta **ANTES** de todo lo demás. Actualmente el flujo de arranque es:

```typescript
// main.ts — FLUJO ACTUAL (sin licencia)
app.whenReady().then(async () => {
  configManager.load()        // Preferencias
  // ... PATHFINDER ...       // Librería de fixtures
  await initTitan()           // Orquestación completa
  createWindow()              // Ventana principal
})
```

El Two-Gate se inserta como **primer checkpoint**:

```typescript
// main.ts — FLUJO CON OBSIDIAN VAULT
app.whenReady().then(async () => {
  // ═══════════════════════════════════════════════
  // 🛡️ WAVE 2489: THE OBSIDIAN VAULT — License Gate
  // Antes de CUALQUIER inicialización, validar licencia.
  // Si falla, no hay Titan, no hay ventana, no hay nada.
  // ═══════════════════════════════════════════════
  const licenseResult = validateLicense()   // ← require('./license/LicenseValidator.jsc')

  if (!licenseResult.valid) {
    showLicenseError(licenseResult)         // Modal nativo con Hardware ID
    return                                  // app.quit() se llama dentro
  }

  // --- Si llegamos aquí, la licencia es válida ---
  configManager.load()
  // ... PATHFINDER ...
  await initTitan()
  createWindow()
})
```

### Gate 1 — Hardware Fingerprint

#### Estrategia de captura del Hardware ID

Se captura la **MAC address de la interfaz de red principal** (la primera no-interna, no-loopback). Razones:

| Alternativa | Pros | Contras | Decisión |
|-------------|------|---------|----------|
| MAC Address | Zero-dependencia (Node.js `os.networkInterfaces()`), multiplataforma nativa | Cambia si el DJ cambia tarjeta de red. VMs pueden falsearla. | ✅ **ELEGIDA** |
| UUID placa base | Más persistente | Requiere `wmic` en Windows, `dmidecode` en Linux (sudo), `ioreg` en macOS. Tres codepaths, frágil. | ❌ Descartada |
| Combinación hash | Combina MAC + hostname + cpuModel | Cambia si modifica cualquiera de los tres | ❌ Sobre-ingeniería |
| Volume Serial | Disco-específico | Cambia si formatea | ❌ Descartada |

#### Algoritmo de obtención (pseudocódigo)

```
function getHardwareId():
  interfaces = os.networkInterfaces()
  
  for each interface in interfaces:
    for each address in interface:
      if address.family == 'IPv4'
         && !address.internal
         && address.mac != '00:00:00:00:00:00':
        return normalizeMAC(address.mac)  // lowercase, separada por ':'
  
  // Fallback: si no hay interfaz de red (raro pero posible)
  throw HARDWARE_DETECTION_FAILED
```

#### Comparación

```
licenseHwId = license.hardwareId           // Del .luxlicense
detectedHwId = getHardwareId()             // De os.networkInterfaces()

GATE 1 PASS = (licenseHwId === detectedHwId)
```

**Exacta.** No hay fuzzy matching. No hay tolerancia. Si el hardware no coincide, Gate 1 falla.

### Gate 2 — Verificación RSA

#### Clave Pública embebida

La clave pública RSA-2048 se hardcodea como string literal dentro de `LicenseValidator.ts`. Cuando se compile a `.jsc`, quedará ofuscada dentro del bytecode V8.

```typescript
// LicenseValidator.ts (antes de compilar a .jsc)
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
...base64 de la PEM...
-----END PUBLIC KEY-----`
```

#### Algoritmo de verificación

```
function verifySignature(license):
  // 1. Extraer el payload sin signature
  payload = { client, hardwareId, tier, issuedAt }   // Mismos campos, misma ordenación
  
  // 2. Recalcular el hash SHA-256
  dataHash = sha256(JSON.stringify(payload, sortedKeys))
  
  // 3. Verificar firma RSA con clave pública embebida
  isValid = crypto.verify(
    'sha256',
    Buffer.from(dataHash),
    PUBLIC_KEY,
    Buffer.from(license.signature, 'hex')
  )
  
  GATE 2 PASS = isValid
```

#### Resultado combinado

```
validateLicense() returns:
  {
    valid: boolean           // GATE 1 && GATE 2
    gate1: boolean           // Hardware match
    gate2: boolean           // Signature valid
    detectedHwId: string     // Para mostrar en modal de error
    client?: string          // Si la licencia existe
    tier?: string            // Si la licencia existe
    error?: string           // Descripción del fallo
  }
```

### UX de Fallo — Modal de Error

Si la validación falla, se muestra un **dialog nativo de Electron** (no una ventana Chromium — no se carga renderer):

```typescript
import { dialog } from 'electron'

function showLicenseError(result: LicenseValidationResult): void {
  let message: string
  let detail: string

  if (!result.gate1 && result.gate2) {
    // Licencia válida pero hardware incorrecto
    message = 'Hardware no autorizado'
    detail = [
      'La licencia no corresponde a este equipo.',
      '',
      `Tu Hardware ID: ${result.detectedHwId}`,
      '',
      'Copia este ID y envíalo a soporte para obtener',
      'una licencia actualizada para tu equipo.',
    ].join('\n')
  } else if (!result.gate2) {
    // Firma rota o licencia manipulada
    message = 'Licencia inválida'
    detail = [
      'El archivo de licencia no tiene una firma válida.',
      '',
      `Tu Hardware ID: ${result.detectedHwId}`,
      '',
      'Contacta con soporte para obtener una licencia legítima.',
    ].join('\n')
  } else {
    // No se encontró archivo de licencia
    message = 'Licencia no encontrada'
    detail = [
      'No se encontró un archivo de licencia válido.',
      '',
      `Tu Hardware ID: ${result.detectedHwId}`,
      '',
      'Envía este ID a soporte para que te generen tu licencia.',
      '',
      `Ubicación esperada:`,
      `${expectedLicensePath}`,
    ].join('\n')
  }

  dialog.showMessageBoxSync({
    type: 'error',
    title: 'LuxSync — Licencia',
    message,
    detail,
    buttons: ['Copiar Hardware ID', 'Cerrar'],
  })

  // Si elige "Copiar Hardware ID", copiar al clipboard
  // clipboard.writeText(result.detectedHwId)

  app.quit()
}
```

**Detalles UX**:
- El modal es **sincrónico** (`showMessageBoxSync`) — bloquea el proceso principal
- Se muestra el Hardware ID **siempre**, incluso si el fallo es de firma
- Botón "Copiar Hardware ID" → copia al portapapeles para enviar por WhatsApp/email
- Después del diálogo, `app.quit()` — no hay forma de saltarse el gate

---

## 6. La Bóveda V8 — Operación "Código Oscuro"

### Objetivo

Convertir `LicenseValidator.ts` en bytecode V8 compilado (`.jsc`) para que:
- La clave pública RSA no sea legible como texto plano en el `.asar`
- La lógica de validación no sea modificable (no puedes parchear un `return true` en bytecode)
- Sea ejecutable por Node.js/Electron pero ilegible para humanos

### Herramienta: `bytenode`

[bytenode](https://github.com/nicolo-ribaudo/bytenode) compila archivos `.js` a bytecode V8 (`.jsc`). Es el estándar de facto para ofuscación de Electron.

```bash
# Dependencia de desarrollo
npm install --save-dev bytenode
```

### Pipeline de Compilación

El build actual de LuxSync es:

```
tsc -p tsconfig.node.json  →  vite build  →  copy:phantom  →  electron-builder
```

Se añade un paso intermedio **después de vite build y antes de electron-builder**:

```
tsc  →  vite build  →  copy:phantom  →  🛡️ FORGE JSC  →  electron-builder
```

#### Paso "FORGE JSC" en detalle:

```
PASO 1: Vite ya compiló electron/main.ts → dist-electron/main.js
        Pero LicenseValidator NO está en el bundle de Vite.
        Se compila APARTE.

PASO 2: Compilar LicenseValidator.ts → LicenseValidator.js
        $ tsc electron/license/LicenseValidator.ts \
            --target ES2020 \
            --module commonjs \
            --outDir dist-electron/license/

PASO 3: Compilar .js → .jsc con bytenode
        $ npx bytenode -c dist-electron/license/LicenseValidator.js

PASO 4: Eliminar el .js intermedio (que SÍ es legible)
        $ del dist-electron/license/LicenseValidator.js

RESULTADO:
  dist-electron/
    license/
      LicenseValidator.jsc    ← Bytecode V8 (ilegible)
    main.js                   ← Requiere el .jsc via bytenode
    preload.js
    senses.js
    mind.js
    ...
```

### Script de build (`scripts/forge-jsc.js`)

```javascript
// scripts/forge-jsc.js — Se ejecuta en el pipeline de build
// Compila LicenseValidator.js → LicenseValidator.jsc y elimina el .js

const bytenode = require('bytenode')
const fs = require('fs')
const path = require('path')

const jsPath = path.join(__dirname, '../dist-electron/license/LicenseValidator.js')
const jscPath = jsPath.replace('.js', '.jsc')

// Compilar a bytecode V8
bytenode.compileFile(jsPath, jscPath)

// Eliminar source legible
fs.unlinkSync(jsPath)

console.log('[FORGE] ✅ LicenseValidator.jsc forged — source destroyed')
```

### Integración en `package.json`

```json
{
  "scripts": {
    "build:license": "tsc electron/license/LicenseValidator.ts --target ES2020 --module commonjs --outDir dist-electron/license/",
    "forge:jsc": "node scripts/forge-jsc.js",
    "build": "tsc -p tsconfig.node.json && vite build && npm run copy:phantom && npm run build:license && npm run forge:jsc && electron-builder"
  }
}
```

### Cómo `main.ts` carga el `.jsc`

```typescript
// main.ts — al inicio, ANTES de cualquier import de la app

// Registrar bytenode para poder require() archivos .jsc
require('bytenode')

// Cargar el validador compilado
const { validateLicense } = require('./license/LicenseValidator.jsc')
```

`bytenode` registra un hook en `require()` que intercepta extensiones `.jsc` y las ejecuta como bytecode V8 nativo. No hay decompilación. No hay source maps. El proceso de carga es:

```
require('bytenode')          ← Registra handler para .jsc
require('./LicenseValidator.jsc')
  → bytenode lee bytes raw
  → V8 ejecuta bytecode directamente (sin parseo JS)
  → module.exports disponible con validateLicense()
```

### Compatibility V8 Engine

**CRÍTICO**: El `.jsc` compilado está atado a la versión de V8 del Electron usado en el build. Si actualizamos Electron, hay que **recompilar** el `.jsc`.

| Electron 28.x | V8 11.8 | ← Versión actual de LuxSync |
|----------------|---------|-----|

Si se actualiza Electron, re-ejecutar `npm run build:license && npm run forge:jsc`.

### Qué ve un atacante al desempaquetar el .asar

```
dist-electron/
  main.js                     ← Legible. Verá el require('./license/...jsc')
                                 y la función showLicenseError(). No hay secretos aquí.
  license/
    LicenseValidator.jsc      ← Binario. ~4KB de bytecode V8 incomprensible.
                                 La clave pública está DENTRO pero es bytes, no texto.
  preload.js                  ← No tiene nada de licencias
  ...
```

**El atacante ve** que existe un sistema de licencias. **No puede ver** la clave pública ni la lógica de validación. Tendría que:
1. Descompilar bytecode V8 (extremadamente difícil, no hay herramientas públicas fiables)
2. O parchear `main.js` para saltar el `require()` — contramedida en §9

---

## 7. Árbol de Ficheros Final

```
LuxSync/
├── electron-app/
│   ├── electron/
│   │   ├── license/
│   │   │   └── LicenseValidator.ts        ← SOURCE (compilado a .jsc en build)
│   │   ├── main.ts                        ← Two-Gate insertion point
│   │   ├── preload.ts
│   │   └── ...
│   ├── dist-electron/                     ← BUILD OUTPUT
│   │   ├── license/
│   │   │   └── LicenseValidator.jsc       ← BYTECODE (el .js se elimina)
│   │   ├── main.js
│   │   └── ...
│   └── package.json                       ← Build scripts actualizados
│
├── scripts/
│   ├── generate-license.ts                ← LA FORJA (offline, privado)
│   ├── forge-jsc.js                       ← Compilador bytenode
│   └── keys/
│       ├── luxsync-private.pem            ← 🔒 En .gitignore
│       └── luxsync-public.pem            ← Se copia al LicenseValidator.ts
│
├── licenses/                              ← Output de generate-license.ts
│   └── (*.luxlicense)                     ← 🔒 En .gitignore
│
└── .gitignore                             ← Actualizado con excludes
```

### Nuevos ficheros a crear

| Fichero | Líneas estimadas | Propósito |
|---------|-----------------|-----------|
| `electron/license/LicenseValidator.ts` | ~120 | Two-Gate validation logic + embebida RSA pubkey |
| `scripts/generate-license.ts` | ~80 | CLI para firmar licencias offline |
| `scripts/forge-jsc.js` | ~20 | Build step para bytecode compilation |

### Ficheros a modificar

| Fichero | Cambio |
|---------|--------|
| `electron/main.ts` | Insertar `require('bytenode')` + `validateLicense()` + `showLicenseError()` al inicio del `app.whenReady()` |
| `electron-app/package.json` | Añadir `bytenode` a devDeps. Añadir scripts `build:license` y `forge:jsc` al pipeline |
| `.gitignore` (raíz) | Añadir `scripts/keys/luxsync-private.pem`, `licenses/`, `*.luxlicense` |

---

## 8. Flujo Completo — Secuencia Temporal

### Fase 1: Setup Inicial (Una sola vez — Radwulf)

```
1. $ openssl genrsa -out scripts/keys/luxsync-private.pem 2048
2. $ openssl rsa -in scripts/keys/luxsync-private.pem -pubout -out scripts/keys/luxsync-public.pem
3. Copiar contenido de luxsync-public.pem al const PUBLIC_KEY de LicenseValidator.ts
4. Guardar luxsync-private.pem en lugar seguro (USB, caja fuerte digital)
5. Añadir a .gitignore
```

### Fase 2: Onboarding de un DJ

```
1. DJ instala LuxSync Beta
2. LuxSync arranca → Gate 1 falla (no hay .luxlicense)
3. Modal muestra: "Tu Hardware ID: a1:b2:c3:d4:e5:f6"
4. DJ copia el ID → lo envía por WhatsApp/email a Radwulf
5. Radwulf ejecuta:
   $ npx tsx scripts/generate-license.ts \
       --client "DJ_Pepito" \
       --hwid "a1:b2:c3:d4:e5:f6" \
       --tier DJ_FOUNDER \
       --out ./licenses/DJ_Pepito.luxlicense
6. Radwulf envía el .luxlicense al DJ
7. DJ coloca el archivo en:
   Windows: %APPDATA%/luxsync-electron/license/license.luxlicense
8. DJ reinicia LuxSync → Gate 1 ✅ Gate 2 ✅ → App arranca
```

### Fase 3: DJ cambia de portátil

```
1. DJ instala LuxSync en portátil nuevo
2. Modal muestra nuevo Hardware ID
3. DJ envía nuevo ID a Radwulf
4. Radwulf genera nueva licencia con el nuevo hwid
5. DJ coloca nueva licencia → funciona
6. La licencia vieja del portátil anterior ya no funciona
   (hwid no coincide → Gate 1 falla)
```

### Fase 4: Build para distribución

```
1. $ cd electron-app
2. $ npm run build
   Ejecuta:
     tsc -p tsconfig.node.json
     vite build
     copy:phantom
     build:license         ← Compila LicenseValidator.ts → .js
     forge:jsc             ← .js → .jsc, borra .js
     electron-builder      ← Empaqueta con .jsc dentro
3. El .exe/.dmg resultante contiene LicenseValidator.jsc (ilegible)
```

---

## 9. Modelo de Amenazas y Contramedidas

### Vector 1: Desempaquetar .asar y parchear main.js

**Ataque**: `npx asar extract app.asar ./unpacked` → editar main.js → quitar el `require` del validador → reempaquetar.

**Contramedida**: Integridad del main.js via hash check. Antes del gate, `main.js` calcula su propio hash y lo compara con un hash embebido en el `.jsc`. Si difiere, el `.jsc` retorna `{ valid: false }`.

```
LicenseValidator.jsc internamente:
  const EXPECTED_MAIN_HASH = 'sha256:abc123...'
  const actualMainHash = sha256(fs.readFileSync(__dirname + '/../main.js'))
  if (actualMainHash !== EXPECTED_MAIN_HASH) → TAMPER DETECTED
```

**Nota**: Esto requiere que `forge-jsc.js` calcule el hash de `main.js` DESPUÉS de la compilación Vite y lo inyecte en el `LicenseValidator.js` ANTES de compilar a `.jsc`. El orden en el build sería: `vite build` → generar main.js → calcular hash → inyectar en LicenseValidator.js → forge `.jsc` → borrar `.js`.

### Vector 2: Modificar el .luxlicense

**Ataque**: Editar el JSON para cambiar el `hardwareId`.

**Contramedida**: Gate 2. La firma RSA se invalida con cualquier cambio en el payload. Sin la clave privada, no se puede generar una firma nueva válida. RSA-2048 no se rompe con hardware de consumo.

### Vector 3: Clonar la MAC address

**Ataque**: Cambiar la MAC de la tarjeta de red para que coincida con la del `.luxlicense`.

**Contramedida parcial**: Este es el vector más realista. Un DJ técnico puede cambiar su MAC. Aceptamos este riesgo conscientemente:
- Requiere conocimiento técnico no trivial
- Cada reinstalación del SO restaura la MAC original
- Para la Beta con DJs fundadores, el riesgo es aceptable
- Post-Beta se puede hardening con fingerprint combinado (MAC + disk serial + hostname hash)

### Vector 4: Compartir el .luxlicense

**Ataque**: DJ comparte su archivo `.luxlicense` con otro DJ.

**Contramedida**: Gate 1. El `hardwareId` no coincidirá con la máquina del segundo DJ. El archivo es inútil en otro hardware.

### Vector 5: Decompilación del .jsc

**Ataque**: Intentar decompilar el bytecode V8 para extraer la clave pública.

**Contramedida**: No existen herramientas públicas confiables para decompilar V8 bytecode a JavaScript legible. El bytecode es una representación intermedia de bajo nivel. Existe `v8-to-istanbul` y herramientas de profiling, pero no decompiladores funcionales. 

Nivel de dificultad: **Muy alto.** Requeriría un experto en internals de V8.

### Matriz de riesgo

| Vector | Dificultad | Impacto | Riesgo | Mitigado |
|--------|-----------|---------|--------|----------|
| Parchear main.js | Baja | Alto | ALTO | ✅ Hash check en .jsc |
| Modificar .luxlicense | Trivial | Nulo | NULO | ✅ RSA firma |
| Clonar MAC | Media | Medio | MEDIO | ⚠️ Aceptado para Beta |
| Compartir .luxlicense | Trivial | Nulo | NULO | ✅ Hardware bind |
| Decompilar .jsc | Muy alta | Alto | BAJO | ✅ No hay herramientas viables |

---

## 10. Decisiones Arquitectónicas y Razonamiento

### ¿Por qué MAC y no UUID de placa base?

Zero-dependencia. `os.networkInterfaces()` es nativo de Node.js en todas las plataformas. No necesitamos `child_process.exec('wmic bios get serialnumber')` ni sudo en Linux. La laptop de 16GB de Radwulf con Windows ejecuta esto en 0ms. Cero binarios externos. Cero forks. Cero permisos elevados.

### ¿Por qué RSA-2048 y no Ed25519?

Node.js `crypto` soporta ambos. RSA-2048 porque:
- Veritas.ts ya lo implementa — código probado, zero riesgo
- Las firmas son ~256 bytes en hex — aceptable para un JSON de licencia
- 2048 bits son suficientes hasta ~2030 según NIST
- Ed25519 es más elegante y rápido, pero la verificación ocurre UNA sola vez al arranque — la velocidad es irrelevante

### ¿Por qué `.luxlicense` es JSON plano y no binario/cifrado?

La seguridad no viene de la ofuscación del payload. Viene de la firma RSA. El DJ puede leer su licencia, ver su nombre, su hardware ID. No hay nada que ocultar en el payload. Lo que NO puede hacer es generarse una licencia con firma válida. Transparencia > falsa seguridad.

### ¿Por qué bytenode y no webpack obfuscation?

Webpack obfuscation (por ejemplo, `javascript-obfuscator`) produce JavaScript legible con esfuerzo. Variables renombradas, strings codificados en base64 — todo reversible con paciencia. Bytenode produce **bytecode V8 real** — no es JavaScript, es la representación interna que V8 ejecuta. No hay "bonito" que aplicar a bytes raw.

### ¿Por qué no un servidor de licencias online?

Radwulf. DJs. Garitos. Raves al aire libre. Furgonetas sin cobertura. España profunda. Portugal rural. Festival en un campo con generador diésel. **Nuestra app NO PUEDE depender de Internet.** Si la licencia necesita "llamar a casa", la app falla en el momento más crítico. Inaceptable.

### ¿Por qué Gate 1 antes de Gate 2?

Gate 1 (hardware) es instantáneo — `os.networkInterfaces()` tarda 0ms. Gate 2 (RSA verify) tarda ~2-5ms. Se ejecutan secuencialmente, no en paralelo, porque Gate 1 fallando ya es suficiente para rechazar. Pero el orden real importa poco — ambos deben pasar. Gate 1 primero porque si no hay hardware match, no tiene sentido gastar CPU en verificar la firma. Optimización trivial pero correcta.

### ¿Qué pasa en desarrollo (`isDev`)?

**Opción elegida**: En development (`!app.isPackaged || process.env.NODE_ENV === 'development'`), el Two-Gate se **SALTA completamente**. Razones:
- En dev no hay `.jsc` — hay `.ts` ejecutado por Vite/ESBuild
- No necesitamos licencia para desarrollar
- El bypass es explícito y solo existe en dev mode
- En producción (packaged), el bypass NO existe

```typescript
// main.ts — dev bypass
if (isDev) {
  // WAVE 2489: License validation skipped in development
} else {
  const licenseResult = validateLicense()
  if (!licenseResult.valid) {
    showLicenseError(licenseResult)
    return
  }
}
```

---

## APÉNDICE A — Interfaces TypeScript Canónicas

```typescript
// ══════════════════════════════════════════════════
// electron/license/LicenseValidator.ts — INTERFACES
// ══════════════════════════════════════════════════

/** Tiers de licencia */
type LicenseTier = 'DJ_FOUNDER' | 'FULL_SUITE'

/** Payload del archivo .luxlicense */
interface LuxLicense {
  client: string
  hardwareId: string
  tier: LicenseTier
  issuedAt: string
  signature: string
}

/** Payload sin firma (para hashing y verificación) */
type LuxLicensePayload = Omit<LuxLicense, 'signature'>

/** Resultado de la validación */
interface LicenseValidationResult {
  valid: boolean
  gate1: boolean          // Hardware ID match
  gate2: boolean          // RSA signature valid
  detectedHwId: string    // Siempre presente, para el modal de error
  client?: string
  tier?: LicenseTier
  error?: string
}

/** Exports del módulo (lo que main.ts consume) */
interface LicenseValidatorModule {
  validateLicense: (licensePath?: string) => LicenseValidationResult
  getHardwareId: () => string
}
```

## APÉNDICE B — Checklist de Implementación

```
[ ] Generar par de llaves RSA-2048 con openssl
[ ] Añadir exclusiones a .gitignore
[ ] Crear electron/license/LicenseValidator.ts con:
    [ ] getHardwareId() usando os.networkInterfaces()
    [ ] Carga y parseo del .luxlicense
    [ ] Gate 1: comparación hwid
    [ ] Gate 2: crypto.verify() con PUBLIC_KEY embebida
    [ ] module.exports compatible con CommonJS (para bytenode)
[ ] Crear scripts/generate-license.ts con:
    [ ] Parseo de CLI args (sin dependencias)
    [ ] Carga de clave privada
    [ ] Serialización determinista del payload
    [ ] crypto.sign() + escritura del .luxlicense
[ ] Crear scripts/forge-jsc.js con:
    [ ] Hash de main.js post-build
    [ ] Inyección del hash en LicenseValidator.js
    [ ] Compilación bytenode .js → .jsc
    [ ] Eliminación del .js intermedio
[ ] Modificar electron/main.ts:
    [ ] require('bytenode') al inicio
    [ ] validateLicense() antes de initTitan()
    [ ] showLicenseError() con dialog nativo
    [ ] dev bypass con isDev check
[ ] Modificar electron-app/package.json:
    [ ] Añadir bytenode a devDependencies
    [ ] Añadir build:license y forge:jsc a scripts
    [ ] Actualizar script build con pasos intermedios
[ ] Test manual:
    [ ] Build completo sin errores
    [ ] .jsc presente en dist-electron/license/
    [ ] .js NO presente en dist-electron/license/
    [ ] App arranca sin licencia → muestra modal con HW ID
    [ ] App arranca con licencia válida → funciona
    [ ] App arranca con licencia de otro HW → Gate 1 falla
    [ ] App arranca con licencia manipulada → Gate 2 falla
```

---

```
FIN DEL BLUEPRINT — WAVE 2489: THE OBSIDIAN VAULT

El código se escribe EN LA PRÓXIMA WAVE.
Este documento define QUÉ se construye y POR QUÉ.
No hay incertidumbre. No hay ambigüedad.
Solo queda forjar.

— PunkOpus
```
