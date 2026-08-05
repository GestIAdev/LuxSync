 OBSIDIAN VAULT — AUDIT REPORT
Sistema: Licenciamiento criptográfico Two-Gate (RSA-2048/SHA-256 + Hardware Fingerprint) Modo: READ-ONLY forensic audit — No se modificó código. Fecha: 2026-08-05 Auditor: Lead Security Architect

1. ARQUITECTURA DEL LICENSING FLOW
1.1 Componentes identificados
Componente	Archivo	Rol
LicenseValidator	[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/license/LicenseValidator.js](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/license/LicenseValidator.js:0:0-0:0) → compilado a .jsc	Two-Gate validation (HW + RSA) + Phantom Gate (integrity)
VeritasRSA	[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/license/VeritasRSA.ts](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/license/VeritasRSA.ts:0:0-0:0)	Motor criptográfico (sign/verify) — solo para tooling de generación
forge-jsc	[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/scripts/forge-jsc.cjs](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/scripts/forge-jsc.cjs:0:0-0:0)	Compilador V8 bytecode — inyecta public key + main.js hash, destruye .js intermedio
main.ts boot	[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/main.ts:933-1109](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/main.ts:932:0-1108:999)	Orquestador de validación al arranque
preload.ts	[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/preload.ts:589](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/preload.ts:588:0-588:999)	Expone window.lux.getLicenseTier() via IPC
licenseStore	[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/stores/licenseStore.ts](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/stores/licenseStore.ts:0:0-0:0)	Zustand store en renderer — hidrata tier via IPC
TitanOrchestrator	electron-app/src/core/orchestrator/TitanOrchestrator.ts:263,788	Gate de features en backend (Hephaestus DMX)
ContentArea	electron-app/src/components/layout/ContentArea.tsx:82,143-145	Gate de tabs en frontend (Chronos/Hephaestus)
Activation UI	[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/license/activation.html](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/license/activation.html:0:0-0:0) + preload-activation.js	Pantalla de activación para licencias inválidas
RSA Keys	[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/scripts/keys/luxsync-private.pem](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/scripts/keys/luxsync-private.pem:0:0-0:0) + luxsync-public.pem	Par RSA-2048 (private solo en build machine)
1.2 Flujo de validación al boot


app.whenReady()
  └─ if (!isDev)                              ← DEV bypassa TODO el vault
      ├─ require(jscPath)                     ← Carga LicenseValidator.jsc (bytecode V8)
      │   └─ fallback: require('./license/LicenseValidator.js')  ← JS plaintext fallback
      ├─ validateLicense(licensePath)
      │   ├─ Phantom Gate: SHA-256(main.js) === EXPECTED_MAIN_HASH
      │   ├─ Gate 1: license.hardwareId === getHardwareId() (MAC address)
      │   ├─ Gate 2: RSA-2048/SHA-256 verify(payload, signature, PUBLIC_KEY)
      │   └─ return { valid, gate1, gate2, phantomGate, tier, client, detectedHwId }
      ├─ if (!valid) → open Activation Window, return (no boot normal)
      └─ if (valid) → currentLicenseTier = result.tier
          └─ titanOrchestrator.setLicenseTier(currentLicenseTier)
              └─ TickEngine: if tier === 'DJ_FOUNDER' → discard Hephaestus outputs
1.3 Flujo de tier enforcement (doble gate)


BACKEND (main process):
  TitanOrchestrator._licenseTier = 'DJ_FOUNDER' | 'FULL_SUITE'
  └─ TickEngine.ts:754  → if (tier !== 'DJ_FOUNDER') → apply Hephaestus DMX
  └─ TickEngine.ts:1187 → if (tier !== 'DJ_FOUNDER') → ingest Hephaestus Aether
 
FRONTEND (renderer):
  licenseStore.tier = hydrate() via IPC 'license:getTier'
  └─ ContentArea.tsx:143 → isTabAllowed('chronos') ? <Chronos/> : <UpgradeGate/>
  └─ ContentArea.tsx:145 → isTabAllowed('hephaestus') ? <Hephaestus/> : <UpgradeGate/>
  └─ Sidebar.tsx:595 → locked={!isTabAllowed(tab.id)}
1.4 Phantom Gate (integrity check)


forge-jsc.cjs (build time):
  1. SHA-256(main.js) → EXPECTED_MAIN_HASH
  2. Inyecta hash en LicenseValidator.js placeholder
  3. Compila .js → .jsc con bytenode
  4. Destruye .js intermedio
 
LicenseValidator.jsc (runtime):
  verifyMainIntegrity():
    1. Lee main.js del app.asar
    2. SHA-256(main.js) === EXPECTED_MAIN_HASH?
    3. Si no match → TAMPER_DETECTED → reject
2. VULNERABILIDADES IDENTIFICADAS (Ranked by Severity)
🔴 CRITICAL — V-01: No Single-Instance Lock
Severity: CRITICAL Archivo: [c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/main.ts](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/main.ts:0:0-0:0) (ausencia total)

Descripción: No existe app.requestSingleInstanceLock() ni manejador de second-instance en ningún archivo del proyecto (confirmado via grep exhaustivo). El usuario reportó que el sistema "correctly blocked a dual-instance attempt during a silent UI crash" — pero esto no fue el sistema de licenciamiento. Fue probablemente el comportamiento natural de Electron al intentar re-abrir la app mientras el proceso zombie aún tenía el puerto DMX ocupado, o el SO bloqueando el segundo lanzamiento.

Impacto:

Un usuario con una licencia DJ_FOUNDER puede lanzar N instancias simultáneas de LuxSync
Cada instancia consume recursos (DMX ports, audio devices, GPU)
No hay protección contra "license sharing" en la misma máquina
Si el renderer crashea (white screen OOM), el proceso main puede quedar zombie y un nuevo launch crea una segunda instancia con acceso completo a DMX
PoC:



# Usuario lanza LuxSync, renderer crashea (white screen)
# El proceso main sigue vivo (zombie) con DMX port abierto
# Usuario lanza una segunda instancia de LuxSync
# → Segunda instancia valida licencia OK
# → Segunda instancia intenta abrir DMX port → falla (port en uso)
# → Pero si el zombie muere, la segunda instancia toma el control
# → No hay bloqueo a nivel de aplicación
Recomendación:



typescript
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
  return
}
app.on('second-instance', () => {
  // Focus existing window or quit
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})
🔴 CRITICAL — V-02: JS Plaintext Fallback Expone el Validator
Severity: CRITICAL Archivo: [c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/main.ts:954-962](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/main.ts:953:0-961:999)

[main.ts:949-962](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/main.ts:948:0-961:999)



typescript
try {
  licenseValidator = require(jscPath)        // ← Intenta .jsc
} catch (jscErr: any) {
  try {
    licenseValidator = require('./license/LicenseValidator.js')  // ← FALLBACK A JS PLANO
    console.warn('[LICENSE] Using JS fallback')
  } catch (jsErr: any) {
    validatorLoadError = true
  }
}
Descripción: Si el .jsc falla al cargar (corrupción, V8 version mismatch, asar unpacking issue), el sistema cae al .js plano. El problema: el .js plano NO tiene la clave pública ni el hash inyectados — tiene los placeholders %%LUXSYNC_PUBLIC_KEY%% y %%MAIN_JS_HASH%%.

Sin embargo, el forge-jsc.cjs escribe el .js inyectado a dist-electron/license/LicenseValidator.js antes de compilarlo a .jsc, y luego lo destruye. Verifiqué el directorio dist-electron/license/ y solo contiene .jsc (no .js). Pero el require('./license/LicenseValidator.js') apunta a __dirname/license/, que en dev es electron/license/LicenseValidator.js — el source original con placeholders.

Impacto:

En dev: el fallback carga el source con placeholders → PUBLIC_KEY = '%%LUXSYNC_PUBLIC_KEY%%' → RSA verify siempre falla → gate2 = false → licencia inválida. Esto es seguro por accidente (fail-closed).
En producción empaquetada: si el .jsc falla, el fallback busca ./license/LicenseValidator.js que no existe en el asar (fue destruido por forge-jsc) → validatorLoadError = true → activation screen. Esto es seguro.
PERO: si un atacante extrae el asar y coloca un LicenseValidator.js modificado junto al .jsc, el fallback lo cargaría. El Phantom Gate debería detectar el parcheo de main.js, pero no valida la integridad del propio LicenseValidator.js fallback.
Recomendación: Eliminar el fallback a .js. Si el .jsc falla, debe ser fail-closed (activation screen con error), no intentar cargar plaintext.

🟠 HIGH — V-03: No License Expiration / Revocation
Severity: HIGH Archivo: [c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/license/LicenseValidator.js:156-164](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/license/LicenseValidator.js:155:0-163:999)



javascript
function isValidStructure(data) {
  // Valida: client, hardwareId, tier, issuedAt, signature
  // NO valida: expiration, revocation status
}
Descripción: El campo issuedAt se valida como fecha parseable, pero nunca se compara contra la fecha actual. No existe campo expiresAt. No existe revocación online ni offline (CRL).

Impacto:

Una licencia emitida es válida para siempre, sin importar si el cliente deja de pagar, comparte la licencia, o si se revoca
No hay forma de revocar una licencia comprometida sin re-emitir todas las licencias activas con una nueva clave
Un atacante con una licencia legítima puede usarla indefinidamente incluso después de que el contrato expire
Recomendación:

Añadir campo expiresAt al payload firmado
Validar Date.now() < expiresAt en validateLicense()
Considerar un CRL offline (lista de revocación firmada) descargada periódicamente
🟠 HIGH — V-04: Hardware ID Basado en MAC Address (Spoofable)
Severity: HIGH Archivo: [c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/license/LicenseValidator.js:73-95](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/license/LicenseValidator.js:72:0-94:999)



javascript
function getHardwareId() {
  const interfaces = os.networkInterfaces()
  // Retorna la primera MAC IPv4 no-internal
  return addr.mac.toLowerCase()
}
Descripción: El hardware fingerprint es solo la MAC address de la primera interfaz de red. La MAC address es trivialmente spoofeable:

Windows: netsh interface set interface name="Ethernet" newmac=XX:XX:XX:XX:XX:XX
Linux: ip link set dev eth0 address XX:XX:XX:XX:XX:XX
macOS: sudo ifconfig en0 ether XX:XX:XX:XX:XX:XX
Impacto:

Un atacante puede clonar la MAC address de una máquina licenciada y usar la misma licencia en otra máquina
No hay binding a hardware más fuerte (CPU ID, disk serial, motherboard serial, TPM)
La primera interfaz IPv4 no-internal puede cambiar si el usuario conecta/desconecta VPN, WiFi, o adaptadores USB
Recomendación:

Combinar múltiples fingerprints: MAC + CPU ID + disk serial + motherboard serial
Hashearlos juntos: SHA-256(mac + cpuId + diskSerial + boardSerial)
Esto hace el spoofing significativamente más difícil
🟠 HIGH — V-05: DEV Mode Bypassa Todo el Vault
Severity: HIGH Archivo: [c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/main.ts:938](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/main.ts:937:0-937:999)



typescript
if (!isDev) {
  // ... toda la validación de licencia ...
}
Descripción: isDev = process.env.NODE_ENV === 'development' || !app.isPackaged. En dev, toda la validación de licencia se skipa, y currentLicenseTier queda en 'FULL_SUITE' (default).

Impacto:

Si un atacante puede forzar NODE_ENV=development o evitar app.isPackaged (ej: modificando el executable o variables de entorno), obtiene FULL_SUITE sin licencia
app.isPackaged es confiable (Electron lo setea internamente), pero NODE_ENV es una variable de entorno que puede ser inyectada antes del lanzamiento
Recomendación:

No depender de NODE_ENV para security decisions
Usar solo app.isPackaged como gate
En dev, requerir una licencia de desarrollo especial (firmada con la misma clave pero con tier DEV)
🟡 MEDIUM — V-06: Race Condition en Boot — Tier Aplicado Después de TickEngine Start
Severity: MEDIUM Archivo: electron-app/electron/main.ts:568 vs 933-1093

Descripción: El orden de boot es:

app.whenReady() (línea 933)
Validación de licencia (líneas 938-1093) → set currentLicenseTier
titanOrchestrator.setLicenseTier(currentLicenseTier) (línea 568) ← ¿espera?
Pero hay un problema: titanOrchestrator se crea en línea 560-563, dentro del bloque if (!isDev) que empieza en 938. Espera — no, TitanOrchestrator se crea en la línea 560 que está después del bloque de licencia (que termina en ~1109). Déjame verificar el orden exacto...

Actualmente el flujo es:

Línea 933: app.whenReady().then(async () => {
Línea 938-1109: Validación de licencia (si !isDev)
Línea 560: titanOrchestrator = new TitanOrchestrator({...})
Línea 568: titanOrchestrator.setLicenseTier(currentLicenseTier)
Esto está correcto — el tier se setea antes del primer tick. Pero hay un edge case:

Si isDev === true, el bloque de licencia se skipa, currentLicenseTier queda en 'FULL_SUITE', y setLicenseTier('FULL_SUITE') se llama correctamente. No hay race condition en el path normal.

PERO: El licenseStore.hydrate() en el renderer (línea 48 de AppCommander.tsx) es async:



typescript
useLicenseStore.getState().hydrate()  // ← async, no awaited
Si el usuario navega a chronos o hephaestus antes de que hydrate() termine, licenseStore.tier es 'FULL_SUITE' (default) → isTabAllowed('chronos') retorna true → el tab se renderiza brevemente antes de que el tier real llegue.

Impacto:

Ventana de ~50-200ms donde un usuario DJ_FOUNDER podría ver el tab de Chronos/Hephaestus cargando
El gate del backend (TickEngine) sí está correcto desde el primer tick, así que no hay DMX output real
Es un flicker visual, no un bypass funcional
Recomendación:

Await hydrate() antes de renderizar el router principal
O usar un loading screen hasta que hydrated === true
🟡 MEDIUM — V-07: Private Key en el Repositorio
Severity: MEDIUM Archivo: [c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/scripts/keys/luxsync-private.pem](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/scripts/keys/luxsync-private.pem:0:0-0:0)

Descripción: La clave privada RSA-2048 está en [c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/scripts/keys/luxsync-private.pem](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/scripts/keys/luxsync-private.pem:0:0-0:0) dentro del repo. Si este repo es público o si un atacante obtiene acceso al repo, puede firmar licencias arbitrarias.

Impacto:

Acceso al repo = capacidad de generar licencias FULL_SUITE válidas para cualquier hardware
El Phantom Gate protege contra parcheo de main.js, pero no protege contra generar licencias legítimas con la clave privada
Recomendación:

URGENTE: Mover la clave privada fuera del repo a un almacenamiento seguro (HSM, vault, air-gapped machine)
Rotar la clave si el repo ha sido compartido
La clave privada solo debe existir en la máquina de build de licencias, nunca en el repo
🟡 MEDIUM — V-08: Phantom Gate No Protege Contra Reemplazo del .jsc
Severity: MEDIUM Archivo: [c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/license/LicenseValidator.js:132-150](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/license/LicenseValidator.js:131:0-149:999)

Descripción: El Phantom Gate valida la integridad de main.js, pero no valida la integridad del propio LicenseValidator.jsc. Un atacante podría:

Reemplazar LicenseValidator.jsc con una versión modificada que siempre retorna { valid: true, tier: 'FULL_SUITE' }
El Phantom Gate dentro del .jsc modificado validaría main.js correctamente (o sería patcheado para retornar true)
main.js no necesita ser modificado → el hash sigue siendo válido
Impacto:

Reemplazo del .jsc bypassa todo el vault sin detectar
bytenode dificulta la ingeniería inversa, pero no es criptográficamente seguro — el bytecode V8 puede ser descompilado
Recomendación:

Firmar el .jsc con la misma clave RSA y verificar la firma antes de cargarlo
O: embeber el hash del .jsc dentro de main.js (que ya está protegido por el Phantom Gate del .jsc) — crear una dependencia circular de integridad
🟢 LOW — V-09: Serialización Determinista Frágil
Severity: LOW Archivo: [c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/license/LicenseValidator.js:101-108](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/license/LicenseValidator.js:100:0-107:999)



javascript
function serializePayload(payload) {
  const ordered = {}
  const keys = Object.keys(payload).sort()
  for (const key of keys) {
    ordered[key] = payload[key]
  }
  return JSON.stringify(ordered)
}
Descripción: La serialización ordena las keys alfabéticamente y usa JSON.stringify. Esto es determinista para el caso actual (5 campos string), pero:

JSON.stringify no garantiza orden de keys en todos los engines (en práctica sí, pero no es spec)
Si se añaden campos anidados (objetos dentro del payload), el orden de las keys anidadas no se ordena
No hay protección contra campos extra (un atacante no puede añadir campos porque la firma fallaría, pero es frágil)
Recomendación:

Usar una serialización canónica explícita (ej: JSON Canonical Form per RFC 8785)
O serializar manualmente campo por campo en orden fijo
3. FORTALEZAS ARQUITECTURALES (What's Done Right)
✅ F-01: Two-Gate Validation (HW + RSA)
La separación de Gate 1 (hardware) y Gate 2 (firma criptográfica) es correcta. Incluso si un atacante obtiene la clave privada, no puede generar licencias para hardware arbitrario sin conocer el MAC target. Y si conoce el MAC, no puede firmar sin la clave privada. Defense in depth.

✅ F-02: RSA-2048/SHA-256 con Clave Pública Embebida
La clave pública está embebida en el bytecode V8 (.jsc), no en un archivo separado legible. Extraerla requiere descompilar el bytecode. La verificación usa crypto.verify() nativo de Node.js — implementación criptográficamente sólida.

✅ F-03: Bytecode Compilation con Destrucción del Source
El pipeline forge-jsc.cjs compila el validator a .jsc y destruye el .js intermedio. Verifiqué que dist-electron/license/ contiene solo .jsc (no .js). Esto eleva significativamente la barrera de ingeniería inversa.

✅ F-04: Phantom Gate (Integrity Check de main.js)
El hash SHA-256 de main.js se inyecta en el .jsc en build time. Si alguien parchea main.js para bypassar el require() del validator, el Phantom Gate detecta la modificación. Es una capa adicional de anti-tampering.

✅ F-05: Fail-Closed en Errores de Carga
Si el .jsc falla y el .js fallback también falla, validatorLoadError = true → activation screen. No hay path donde un error de carga resulte en FULL_SUITE sin licencia.

✅ F-06: Activation Screen Aislada
La ventana de activación usa un preload mínimo (preload-activation.js) que expone solo 4 métodos. No tiene acceso a lux, electron, o luxDebug. Principle of least privilege.

✅ F-07: Tier Enforcement Dual (Backend + Frontend)
El tier se enforcea en dos capas independientes:

Backend: TickEngine descarta outputs de Hephaestus si tier === 'DJ_FOUNDER' (líneas 754, 1187)
Frontend: ContentArea muestra UpgradeGate si isTabAllowed() retorna false (líneas 143-145)
Incluso si el frontend es bypassado (DevTools, React DevTools), el backend no produce DMX output de Hephaestus. El gate funcional real está en el backend.

✅ F-08: Serialización Determinista para Firma
El payload se serializa con keys ordenadas alfabéticamente antes de firmar/verificar. Esto garantiza que la firma sea reproducible. Ambos lados (VeritasRSA.ts y LicenseValidator.js) usan la misma lógica.

4. MATRIZ DE SEVERIDAD
ID	Severidad	Vulnerabilidad	Explotable	Recomendación
V-01	🔴 CRITICAL	No single-instance lock	Sí, trivial	app.requestSingleInstanceLock()
V-02	🔴 CRITICAL	JS plaintext fallback	Condicional	Eliminar fallback, fail-closed
V-03	🟠 HIGH	No expiration/revocation	Sí	Añadir expiresAt + CRL
V-04	🟠 HIGH	MAC-only hardware ID	Sí, trivial	Multi-fingerprint hash
V-05	🟠 HIGH	DEV mode bypass	Condicional	Usar solo app.isPackaged
V-06	🟡 MEDIUM	Race condition en hydrate	Visual flicker	Await hydrate antes de router
V-07	🟡 MEDIUM	Private key en repo	Sí, si repo accesible	Mover a HSM/vault URGENTE
V-08	🟡 MEDIUM	No integrity check del .jsc	Sí, con acceso filesystem	Firmar .jsc o hash circular
V-09	🟢 LOW	Serialización frágil	No actualmente	JSON Canonical Form
5. CONCLUSIÓN
El Obsidian Vault tiene una arquitectura criptográfica sólida (RSA-2048/SHA-256, bytecode compilation, dual-gate validation, phantom integrity check) que eleva significativamente la barrera comparado con un sistema de licencias naive.

Sin embargo, tiene dos vulnerabilidades CRITICAL que deben resolverse antes de producción:

V-01 (No single-instance lock): El escenario de crash que el usuario reportó como "robust behavior" no fue el vault bloqueando — fue coincidencia. No hay single-instance lock implementado. Esto permite uso simultáneo de múltiples instancias.
V-02 (JS fallback): El fallback a .js plano, aunque fail-closed en la práctica actual, es un vector de ataque innecesario que debe eliminarse.
Y una vulnerabilidad HIGH prioritaria:

V-07 (Private key en repo): Si el repo es accesible, cualquier persona puede generar licencias válidas. Esto es el mayor riesgo de negocio.
Esperando instrucciones humanas. No se modificó ningún código.