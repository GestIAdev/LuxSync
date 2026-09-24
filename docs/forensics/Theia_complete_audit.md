# WAVE 8206 — THEIA COMPLETE AUDIT
## Auditoría Forense del Motor Generativo Theia (theta.worker → HDMI)

**Autor:** Devin (Cognition)
**Fecha:** 2026-09-24
**Alcance:** `electron-app/src/theia/*`, `src/core/theia/*`, `src/types/theiaTypes.ts`, stores Theia, `electron/TheiaWindowManager.ts`, `TheiaOutputView`, `TheiaEngineView`, puntos de integración en `TitanOrchestrator`/`TickEngine`/`main.ts`/`preload.ts`, blueprints WAVE-4850/4871 y forensics WAVE-5033.
**Estado del módulo:** 🟡 **ARQUITECTURA COMPLETA — CABLEADO SEVERADO.** Código maduro (~3.800 LOC), pipeline real de vídeo implementado, pero desconectado del flujo principal por **5 cortes deliberados o accidentales** que este documento enumera.

---

## 0. RESUMEN EJECUTIVO

Theia **no es un módulo a medio construir en el sentido de "falta código"**: el worker existe, decodifica vídeo vía WebCodecs/MediaStreamTrackProcessor, tiene máquina de estados, crossfade, doble salida SAB (full-res + thumb 64×64), ventana de proyección frameless con anti-poltergeist, y un bridge cognitivo completo con Selene. Lo que falta es **la unión operacional**: el módulo fue killswitcheado (WAVE 4933.1) tras una serie de incidentes de memoria (OILPAN OOM, WAVE-7569), y durante el exorcismo posterior (WAVE-5033) se retiró del hot-path quedando en cuarentena.

**Veredicto de resurrección:** la arquitectura es sólida y coherente con la doctrina LuxSync (tick 44Hz, SAB lock-free, cero IPC en hot-path). Sin embargo, hoy existen **cinco rupturas encadenadas** que impiden que cualquier píxel llegue a pantalla aunque se active el flag:

| # | Ruptura | Ubicación | Naturaleza |
|---|---------|-----------|------------|
| R1 | `ENABLE_THETA_ORCHESTRATOR = false` | `ThetaOrchestrator.ts:87` | Killswitch deliberado (WAVE 4933.1) |
| R2 | `theia:get-frame-context` → `null` siempre | `IPCHandlers.ts:190-195` | Stub defensivo → SAB local zombie |
| R3 | `theia:get-video-sab` → `null` siempre | `TheiaWindowManager.ts:219-223` | Stub defensivo → output window negra |
| R4 | Puente cognitivo Selene→Theia nunca conectado | `attachSeleneTheia` sin callers; `_seleneThetaBridge` congelado en `null` | Bug de boundary + dead code |
| R5 | Tab `theia` en `ALPHA_LOCKED_TABS` | `navigationStore.ts:256` | UI inaccesible para el operador |

**Conclusión clave:** incluso si el operador activara manualmente el flag R1, el worker **seguiría sin renderizar** porque el FrameContext SAB que recibe es un fallback local que nadie escribe (R2). El reloj maestro sí se está escribiendo en main a 44Hz (`TickEngine:333` → `trinity.advanceFrameContext`), pero el SAB físicamente no cruza la frontera de proceso. Esta es la ruptura arquitectónica principal, no el killswitch.

---

## 1. TOPOLOGÍA DE PROCESOS — LO QUE EXISTE VS LO QUE SE CREYÓ

```
┌─ ELECTRON MAIN PROCESS ──────────────────────────────────────────────────┐
│                                                                          │
│  TrinityOrchestrator (worker mgr)     TitanOrchestrator                  │
│  ├─ frameContextSAB (16B)  ◄──escribe──┤ TickEngine.processFrame() @44Hz │
│  │   frameContextWriter               │   advanceFrameContext() ✓ VIVO   │
│  │                                    │                                  │
│  │                                    │ _seleneThetaBridge = null ❹ DEAD │
│  │                                    │ theiaBridgeManager (dead)        │
│  │                                    │                                  │
│  ├─ SeleneTitanConscious (en TitanEngine)                                │
│  │   emits: 'energyOverride', 'contextualEffectSelected'                 │
│  │   NUNCA emite 'cognitiveOutput' ❹                                    │
│  │                                                                      │
│  └─ TheiaWindowManager ✓ registrado (main.ts:1587)                       │
│      ├─ videoSAB (16.6MB) lazy — NUNCA creado (IPC devuelve null) ❸      │
│      ├─ openOutput() → BrowserWindow frameless/fullscreen ✓ implementado │
│      └─ IPC: open-output / close-output / is-output-open ✓ funcionan     │
│            theia:get-frame-context → null ❷  theia:get-video-sab → null ❸│
│                                                                          │
│  Vanguard Launcher (electron/launcher/) — performance tier probe.        │
│  CERO referencias a Theia — no la gatea ni la conoce.                    │
└──────────────────────────────────────────────────────────────────────────┘
                                    ║ IPC (contextBridge → window.lux.theia)
                                    ║ SAB NO cruzan (invoke devuelve null)
┌─ RENDERER PRINCIPAL (React, main window) ────────────────────────────────┐
│                                                                          │
│  ThetaOrchestrator (singleton) — ENABLE_THETA_ORCHESTRATOR=false ❶       │
│  ├─ spawn: new Worker(new URL('./theta.worker.ts'), {type:'module'}) ⚠️  │
│  ├─ hidden <video> + captureStream() + MediaStreamTrackProcessor         │
│  ├─ heartbeat 1s / timeout 3s / circuit 3fails→5s / Phoenix max 5        │
│  ├─ thumbPixelSAB (16KB) creado eager — huerfano (nadie lo consume)      │
│  ├─ playAtom(intent) ✓ implementado — idempotente, lazy-load .mp4        │
│  └─ forceState() → postMessage al worker                                 │
│                                                                          │
│  SeleneTheiaBridge (hysteresis FSM) — attach() llamado SOLO desde        │
│  TheiaEngineView useEffect (aiEnabled). notify() dead: nadie lo invoca   │
│  desde TickEngine porque _seleneThetaBridge siempre null.                │
│                                                                          │
│  SeleneTheiaWiring (EventTarget 'theia:play-atom' bus) — attachSeleneTheia│
│  NUNCA llamado en ningún boot path.                                      │
│                                                                          │
│  TheiaEngineView — tab 'theia' en router pero ALPHA_LOCKED ❺             │
│  ├─ Viewport: transfiere canvas real vía transferControlToOffscreen ✓    │
│  ├─ LiveDeck/WorkshopDeck/TheiaDNALab/TheiaTrimmer ✓ funcionales         │
│  └─ MOCK_CLIPS + heartbeat fake aún presentes en el monitor de sección   │
│                                                                          │
│  ┌─ theta.worker.ts (Web Worker, IIFE bundle en dist/assets/) ─────────┐ │
│  │  FrameContextReader.readIfChanged() — SAB LOCAL sin escritor ❷      │ │
│  │  → renderCurrentFrame() NUNCA se ejecuta                            │ │
│  │  Frame pump (ReadableStream<VideoFrame>) ✓ implementado            │ │
│  │  AssetStateMachine + CrossfadeUnit ✓ implementados                  │ │
│  │  VideoFrameWriter → videoFrameSAB (null) · ThumbFrameWriter ✓      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
                                    ║ SAB videoFrameSAB — NUNCA llega ❸
┌─ RENDERER SECUNDARIO (Theia Output Window, ?theia-output=1) ─────────────┐
│  main.tsx detecta flag → monta TheiaOutputView (NO AppCommander) ✓        │
│  getVideoFrameBufferSAB() → null → return antes del rAF → pantalla negra │
│  (si se abre la ventana: frameless, fullscreen, focusable:false,          │
│   skipTaskbar, backgroundThrottling:false, ESC cierra — todo correcto)   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Corrección de un error documental previo:** el header de `SeleneTheiaWiring.ts` afirma que "`SeleneTitanConscious` corre en el RENDERER". **Falso.** `SeleneTitanConscious` se instancia dentro de `TitanEngine` (`TitanEngine.ts:338`), que vive dentro de `TitanOrchestrator`, instanciado en `electron/main.ts:730` — **proceso main**. El blueprint WAVE-4871 ya diagnosticó esta ruptura de frontera; el comentario del wiring es incorrecto.

---

## 2. AUDITORÍA FORENSE DEL `theta.worker.ts`

### 2.1 Construcción y entorno

- **Tipo:** Web Worker browser-side, bundle IIFE emitido por Vite (`worker.format:'iife'` en `vite.config.ts:28-30`). El spawn usa `{ type:'module' }` (`ThetaOrchestrator.ts:705-708`) — **⚠️ riesgo de producción**: bajo `file://` Chromium rechaza workers `type:'module'` (opaque origin, sin headers MIME). El proyecto ya sufrió y corrigió esto para otros workers en WAVE-7790, pero el flag `type:'module'` de theta quedó. En dev (HTTP) funciona; en build empaquetado puede no arrancar. **Recomendación:** `{ type:'classic' }` — el bundle IIFE es compatible con ambos.
- **Aislamiento real del hilo UI:** ✅ sí. Todo el trabajo de vídeo (decode pump, drawImage, getImageData, downscale, SAB writes) ocurre en el worker. El hilo UI solo hace `postMessage` ocasional y gestiona el `<video>` oculto. Hephaestus no degrada framerate por Theia mientras el budget se respete.
- **OffscreenCanvas:** ✅ `payload.offscreenCanvas` (transferido desde el `Viewport` vía `transferControlToOffscreen`) + un segundo canvas interno `thumbCanvas` (64×64) creado en el propio worker.
- **Límite de seguridad (OILPAN GUARD, WAVE-7569):** canvas clampeado a `MAX_CANVAS_WIDTH×HEIGHT = 1920×1080` — previene `getImageData` de 33MB+/tick en fuentes 4K.

### 2.2 Ciclo de vida (message loop)

| Mensaje | Handler | Qué hace |
|---------|---------|----------|
| `theia:init` | `handleInit` | Adopta frameContextSAB, canvas, videoFrameSAB, thumbPixelSAB; crea ctx 2D + thumb ctx; arranca poll loop + state reports; emite `theia:ready` |
| `theia:heartbeat` | `handleHeartbeat` | Responde `theia:heartbeat-ack` con latencia |
| `theia:load-stream` | `handleLoadStream` | Adopta `ReadableStream<VideoFrame>` transferida, arranca `runFramePump()`, boot FSM→ambient |
| `theia:unload-stream` | `teardownVideoStream` | Cancela reader, cierra frame pendiente |
| `theia:force-state` | `handleForceState` | FSM.transition → snapshot → CrossfadeUnit.start |
| `theia:seek` | `handleSeek` | snapshot del canvas + crossfade programado + `theia:seek-ack` |
| `theia:shutdown` | `handleShutdown` | Para todo, limpia writers, FSM reset |

Errores: `self.onerror`/`unhandledrejection` → `theia:error` (fatal flag). Errores de publish SAB son soft (log, no muerte).

### 2.3 Timing y memoria

- **Poll loop:** `setInterval(pollFrameContext, 22ms)` ≈ 44Hz. Lee `FrameContextReader.readIfChanged()` — **este es el punto de ruptura R2**: si `generation` no cambia (nadie escribe el SAB), `readIfChanged` devuelve `null` y `renderCurrentFrame()` nunca corre.
- **Frame pump:** `async runFramePump()` — `await reader.read()` en loop; estrategia latest-frame-wins (cierra frames no consumidos → sin leaks de VideoFrame/GPU).
- **Budget por tick (sano):** drawImage (GPU) + getImageData 1080p (~8MB alloc, mitigado a buffer cacheado) + write SAB 8.3MB + thumb drawImage+getImageData 16KB ≈ **3-6ms** — cabe en el slot de 23ms a 44Hz.
- **Memoria:** SAB video 16.6MB (solo si IPC lo entregara — hoy null) + thumb 16KB + prevSnapshot canvas 8.3MB + ImageData cacheado ~8MB ≈ **~33MB por worker** — aceptable.
- **State reports:** cada 1000ms (`theia:state-report` con lastTickId/ticksObserved/errors/uptime).

### 2.4 Estado de vídeo

`videoState: 'idle'|'streaming'|'ended'|'error'`, `framesDecoded`, `framesDropped` — reportados vía `theia:video-status`. El orchestrator loguea el primer frame recibido (`hasLoggedFirstFrame`).

---

## 3. SISTEMA DE TIPOS `.theia v2.0` Y PIPELINE V3

### 3.1 El átomo

`ITheiaAtom` (`types/theiaTypes.ts:88-136`) — paradigma atómico WAVE-4921:

```
id, packId, filePath            → identidad + .mp4 en disco
aggression, chaos, organicity   → genoma 3D ∈ [0,1]³ (cubo unitario cognitivo)
energyZone {min, max}           → ventana del termómetro Selene (7 zonas)
validSections[]                 → secciones musicales elegibles
trim {startMs, endMs}           → el LOOP (≥250ms, gate A2)
compatibleVibes[]               → vibes Selene elegibles (gate A5)
isDivineCandidate?, isHeavyCandidate?
```

`ITheiaPack` agrupa átomos por carpeta del filesystem. `ITheiaPackManifest` (`pack.theiapack.json`) opcional — el pack se reconstruye zero-conf si falta.

### 3.2 Ingesta y validación

`TheiaFileLoader` (gates A1-A5) + `TheiaRegistry` (índice `_byId` + `_byVibe`, matching euclidiano 3D con distancia² — sqrt solo al ganador, ~0.02ms). `useTheiaPackStore.ingestFiles` separa `.mp4` (rawClips) de `.theia` (parse→atom→pack). **Nota:** existen DOS validadores — el pack store tiene su propio `_isValidTheiaAtom` además del loader. Duplicación menor a unificar.

**Gap de runtime detectado:** el contrato `trim.endMs` ("el vídeo vuelve a `startMs` al llegar a `endMs`") **no se enforcea en ningún sitio**. `playAtom` hace `currentTime = startMs` y reproduce, pero no hay listener `timeupdate` ni wrap en `endMs`. El átomo "loop" es una declaración sin ejecutor — el vídeo simplemente sigue hasta el final del .mp4. **R-gap para el roadmap.**

### 3.3 ¿Listo para telemetría FFT / vibe / energyZone en tiempo real?

**Respuesta corta: NO — el contrato no existe en el protocolo del worker.**

- `.theia` es **metadato estático** (qué átomo elegir), no un canal de datos en vivo.
- El worker recibe únicamente: `tickId`+`timestamp`+`generation` (FrameContextRing, 16B) y mensajes de control (`force-state`, `seek`, `load-stream`).
- `protocol.ts` no define payload para: FFT bands, energyZone, vibe, beatPhase, ni parámetros de shader.
- `ISeleneTheiaInput` (adapter) sí modela `decision/targetDNA/energyZone/vibe/section` — pero es un contrato **renderer-side para selección de átomo**, no llega al worker.
- `CrossfadeUnit.waitAnchor` está diseñado para anclar en downbeat pero **el FrameContextRing no transporta `beatPhase`** — el campo existe como concepto documentado ("cuando llegue el bus de MusicalContext") sin implementación.

**Veredicto:** la infraestructura de matching cognitivo estático está completa (registry→adapter→intent→playAtom→seek). El canal de **telemetría continua** (FFT, energy, zone, vibe por tick) es lo que falta — y es exactamente lo que un shader reactivo necesitaría. Ver §7 propuesta `TheiaTelemetryRing`.

---

## 4. PIPELINE DE SALIDA (worker → HDMI/proyector)

### 4.1 Cadena implementada

```
theta.worker renderCurrentFrame()
  → ctx.drawImage(VideoFrame)  [canvas 1920×1080 clamp]
  → ctx.getImageData()         [8MB, buffer cacheado]
  → VideoFrameWriter.publish() → videoFrameSAB (double-buffer, ~16.6MB)
                                        │
main.ts: TheiaWindowManager             │ (SAB compartido — NUNCA ENTREGADO)
  → 'theia:open-output' IPC             │
  → BrowserWindow {frameless, fullscreen, #000, show:false,
                   focusable:false, skipTaskbar, backgroundThrottling:false}
  → loadURL('?theia-output=1')
  → 'ready-to-show' → show()  [anti-poltergeist]
                                        │
main.tsx: isTheiaOutputWindow           ▼
  → <TheiaOutputView/> (sin AppCommander)
  → getVideoFrameBufferSAB() → VideoFrameReader.resync()
  → rAF loop: readIfChanged() → ensureImageData → putImageData → drawImage scaled (letterbox)
```

### 4.2 Estado real de cada eslabón

| Eslabón | Estado | Nota |
|---------|--------|------|
| Worker → videoSAB write | ✅ código completo | pero `videoFrameSAB` siempre `null` (R3) |
| `theia:open-output` IPC | ✅ funciona | ventana se abre realmente |
| `theia:get-video-sab` IPC | ❌ devuelve `null` | stub: "structured clone no fiable en file://" |
| OutputView SAB attach | ❌ nunca ocurre | `if (!sab) return` → sale antes del rAF |
| Selección de display | ⚠️ heurística | `pickTargetDisplay()`: primer display con `bounds.x/y ≠ 0`. Sin selector de usuario, sin EDID/nombre. Si el proyector está en coords (0,0) o hay >2 pantallas, falla silenciosamente |
| ESC → close | ✅ | `before-input-event` |
| Blackout al cerrar | ✅ implícito | `VideoFrameWriter.clear()` en shutdown; sin frame nuevo = último frame persiste (hold-frame) — **el blackout real depende de que el worker escriba negro, no de cerrar la ventana** |
| Fallo de ventana | ⚠️ | `closed` → null; no hay auto-recovery ni re-open al reconectar HDMI |

### 4.3 Hallazgo clave — el SAB sí podría cruzar

`main.ts:1570-1579` fuerza `COOP: same-origin` + `COEP: require-corp` en `session.defaultSession` (WAVE 4910.9-B) **precisamente para habilitar SAB por IPC**. El stub `return null` en ambos handlers es conservadurismo residual — con `crossOriginIsolated` ya activo, devolver el SAB real probablemente funcione hoy. **Verificar en build empaquetado** antes de descartar la vía `invoke`. Fallbacks: (a) push model `webContents.send('theia:video-sab', sab)` al abrir la ventana, (b) el output window podría crear el SAB y publicarlo a main→renderer (mismo problema inverso).

---

## 5. INTEGRACIÓN SELENE — TRES CAPAS, TODAS MUERTAS

El módulo acumuló **tres diseños de puente** en sucesivas waves, ninguno operativo hoy:

### 5.1 `SeleneTheiaBridge` (WAVE-4869) — observer de hysteresis

Clase renderer que recibe `{energy, sectionType, dropImminent, frameIndex}` y llama `theta.forceState()` con Schmitt-trigger + dwell 26 ticks + confirmación 3 frames. **Estado: dead×3.**

1. `TickEngine.ts:815` llama `this._seleneThetaBridge.notify(...)` — pero el campo viene del contexto de `TitanOrchestrator`, construido como **snapshot en frío** (`_seleneThetaBridge: this._seleneThetaBridge` en el object literal, línea 706 — no es getter, se evalúa una vez → `null` para siempre).
2. `attachSeleneTheiaBridge(bridge)` (TitanOrchestrator:817) escribe en `theiaBridgeManager._seleneThetaBridge` — **campo distinto del que TickEngine lee**. Ni siquiera conectaría si alguien lo llamara.
3. **Nadie llama `attachSeleneTheiaBridge`** en ningún punto del código.
4. Aunque se conectara: el bridge corre en main (TickEngine) pero su `theta` es `getThetaOrchestrator()` — singleton que en main crearía un `ThetaOrchestrator` sin DOM (`document.createElement` no existe) → `forceState()` haría warn+return silencioso. Boundary bug (WAVE-4871 §3 lo diagnosticó).

### 5.2 `SeleneTheiaWiring` + `SeleneTheiaAdapter` (WAVE-4902/4903) — cognitive cue-jump

La capa "correcta" por diseño: Selene emite `ConsciousnessOutput` → wiring traduce a `ISeleneTheiaInput` → `SeleneTheiaAdapter.process()` (match 3D + energyZone filter + throttle 2s + crossfade derivado) → `TheiaPlayAtomBus` (EventTarget interno) → `orchestrator.playAtom()` → seek + `theia:seek` al worker. **Estado: nunca conectado.**

- `attachSeleneTheia()` tiene **cero callers** en el codebase.
- `SeleneTitanConscious` (main) **nunca emite `'cognitiveOutput'`** — solo `energyOverride` y `contextualEffectSelected`. El evento que el wiring escucha no existe.
- El wiring asume que Selene es un EventEmitter accesible desde el renderer — **es main**. Aunque se llamara `attachSeleneTheia` desde el renderer, no hay objeto `selene` con `.on('cognitiveOutput')` al alcance.

### 5.3 `TheiaBridgeManager` (WAVE-4959) — twin-output DMX

Attach de `TheiaVideoRenderer` (lee thumb SAB → AetherCanvas → PixelMapAdapter → fixtures LED). Implementado y correcto, pero `attachTheiaRenderer()` **sin callers** — el hot-path `tick()` en TickEngine fue exorcizado en WAVE-5033 (con razón: era `if(null)` evaluado a 44Hz). La infraestructura "el vídeo pinta las luces" está construida pero desenchufada.

### 5.4 Qué dice WAVE-4871 (aún vigente)

Blueprint correcto propuesto y nunca ejecutado: `TheiaStateResolver` en main (recibe `context.section?.type` + `energy` a 44Hz de `processFrame`, aplica hysteresis) → `webContents.send('theia:force-state', state)` → preload `onForceState` → `theta.forceState()` en renderer. La decisión abierta (criterio propio de Theia vs seguir L3 de Selene vs canal de intent dedicado en `.lfx`) sigue sin resolverse — **recomendación: opción 3 a largo plazo (intent explícito en ConsciousnessOutput), opción 1 para desbloquear ya.**

---

## 6. VANGUARD / AISLAMIENTO DE PROCESOS

### 6.1 Qué es Vanguard hoy

`electron/launcher/` = **pre-boot launcher** (WAVE-7580): ventana HTML que prueba hardware (`probeHardware`), puntúa (`scoreHardware`), y persiste el `PerformanceTier` (HQ/eco) elegido. Controla `performanceStore`/`eco-mode` en runtime. **No tiene ninguna referencia a Theia** — no la lanza, no la gatea, no la conoce.

### 6.2 El aislamiento real actual

- **No existe proceso dedicado para Theia.** El worker vive en el renderer principal (bien para `OffscreenCanvas`/`WebCodecs`/`captureStream`, que no existen en main).
- El único aislamiento es el killswitch constante + el guard de `TrinityProvider` (WAVE-5033: no instancia orquestador ni OffscreenCanvas cuando está off).
- Vanguard **debería** ser quien decida si Theia arranca: el tier de performance es exactamente el tipo de gate que el módulo necesita (video decode + 16MB SAB + posible WebGL es un feature HQ-only). **Gap de integración Vanguard↔Theia identificado.**

### 6.3 Límites de proceso deseados (propuesta)

```
Main:   TitanOrchestrator + Selene + FrameContextWriter + TheiaWindowManager
        + Vanguard gate (tier HQ → Theia enabled)
UI:     ThetaOrchestrator (renderer) + Selene wiring listener (IPC-fed)
Worker: theta.worker — video decode/crossfade/shader — aislado de React
Output: TheiaOutputView — rAF blit, solo lectura SAB, backgroundThrottling:false
```

Killswitch recomendado por capas: `ENABLE_THETA` (const) → `performanceTier ≥ X` (Vanguard) → `aiEnabled` (runtime) → heartbeat/circuit/Phoenix (ya existe).

---

## 7. VIABILIDAD DE SHADERS WEBGL/GLSL — RESPUESTA A LA PREGUNTA CLAVE

### 7.1 ¿Cabe un contexto WebGL en theta.worker?

**Sí, técnicamente viable sin dependencias externas:**

- `OffscreenCanvas.getContext('webgl2')` (y `'webgl'`) están disponibles dentro de Web Workers en Chromium desde hace años. Electron 32 = Chromium 128 — soporte pleno.
- `gl.createShader`/`compileShader`/`linkProgram` con fuentes GLSL ES 3.00 — API nativa, cero deps.
- El worker ya posee un `OffscreenCanvas` transferido (viewport in-app) — pero ver §7.3.

### 7.2 El problema del contrato de salida

El pipeline actual escribe **píxeles RGBA al videoFrameSAB** (8.3MB/frame) porque el consumidor (TheiaOutputView) solo blittea con `putImageData`. Con WebGL hay dos caminos:

**Opción A — Render en worker, readPixels → SAB (conserva contrato actual):**
```
worker: gl canvas → render shader → gl.readPixels(x,y,w,h,RGBA,UNSIGNED_BYTE, sabView)
        → publish meta → output window blittea igual que hoy
```
- ✅ Cero cambios en output window, thumb path y protocolo SAB.
- ✅ `readPixels` acepta `Uint8Array` vista del SAB → **zero-copy al buffer compartido** (mejor que getImageData — sin alloc de 8MB/tick).
- ⚠️ `readPixels` es sync-point GPU→CPU: ~2-6ms a 1080p — cabe en 23ms pero come budget.
- ✅ El thumb 64×64 puede seguir existiendo: `gl.readPixels` a la región mip o framebuffer separado → ThumbFrameWriter igual.

**Opción B — Shader corre en la OUTPUT window, worker solo envía telemetría (arquitectura generativa pura):**
```
main: telemetry SAB (~256B: energy, bass/mid/treble, beatPhase, vibe, zone, tickId, time)
output window: WebGL propio → lee telemetría SAB → renderiza directo a su <canvas> fullscreen
worker (opcional): sigue gestionando video clips / thumb para DMX
```
- ✅ GPU vive en el proceso de salida — sin copia de píxeles por IPC/SAB. 1080p@60fps shader coste típico 1-4ms GPU, ~0 CPU.
- ✅ Latencia menor: la telemetría son ~200 bytes, no 8MB.
- ⚠️ El thumb→DMX twin-output requeriría que la output window también escribiera thumb SAB o un readback 64×64 — o que el worker mantenga un render espejo de baja resolución (barato: shader a 64×64 FBO → readPixels → thumbSAB).
- ⚠️ Duplica el código de shaders en dos procesos (o comparte fuente vía IPC/asset).

**Recomendación: Opción A para Fase inicial** (conserva todo: twin-output DMX, output window, contrato SAB, protocolo). **Opción B como arquitectura objetivo** si Theia evoluciona a motor generativo primario — la telemetría es el payload natural, no los píxeles.

### 7.3 Conflicto de contexto en el canvas del viewport

Un canvas solo puede tener UN tipo de contexto. El viewport canvas actual usa `'2d'`. En modo shader habría que:
- Crear un segundo `OffscreenCanvas` WebGL interno en el worker (no el del viewport) para el render GLSL, y blittealo al canvas 2D del viewport vía `ctx.drawImage(glCanvas)` — drawImage acepta canvas WebGL como fuente, coste GPU→GPU ~0.
- O cambiar el viewport a WebGL cuando el modo sea `shader` (protocolo `theia:init` necesitaría un campo `renderMode: 'video'|'shader'|'hybrid'`).

### 7.4 Telemetría necesaria para reactividad (propuesta de contrato)

El worker no tiene hoy ningún canal de datos musicales por tick. Propuesta `TheiaTelemetryRing` (SAB adicional, ~128-256B, escritor=main TickEngine, reader=worker):

```
[Int32 meta] seq, tickId, flags(shaderDirty, blackout), reserved
[Float32 data] energy, bass, mid, treble, subBass, beatPhase, bpmNorm,
               aggression, chaos, organicity (del átomo activo),
               vibeHash, energyZoneOrd, sectionConfidence, spectralCentroid...
               + opcional: N bandas FFT reducidas (ej. 16 bins log-scale)
```

Escrito por `advanceFrameContext` extendido (o un `advanceTelemetry` hermano) en `TickEngine` a 44Hz; leído por el worker con `readIfChanged` igual que el reloj. **Uniforms GLSL directos** (`u_energy`, `u_beatPhase`, `u_genome`…).

Protocolo aditivo sugerido:
- `theia:shader-load { fragmentSrc, uniformsSchema }` → compile+link, ack/error
- `theia:shader-unload` → vuelve a modo video
- `theia:render-mode { mode }` en init o runtime
- Worker→orch: `theia:shader-status { compiled, errorLog, contextLost }`

### 7.5 Seguridad y resiliencia de shaders

- **Compilación:** `getShaderInfoLog`/`getProgramInfoLog` → forward como `theia:error` no-fatal; fallback automático a modo video si compile falla.
- **Context loss:** `webglcontextlost`/`webglcontextrestored` listeners en worker; política Phoenix existente cubre muerte del worker entero; context loss debe reportarse y reinit el programa (o degradar a video).
- **Hot-reload:** shader source como string en postMessage — trivial; versioning por `shaderId` para ack correlacionado.
- **Seguridad:** el GLSL se compila en GPU sandbox del renderer — riesgo limitado a DoS visual (shader infinito = worker lento → heartbeat timeout → Phoenix). No aceptar shaders de fuentes externas sin sanitizar; limitar uniforms al schema.
- **Performance:** readPixels sync (Opción A) o sin readback (Opción B); en ambos casos el trabajo no toca React/UI thread.

---

## 8. GAPS Y REGISTRO DE RIESGOS

| ID | Gap/Riesgo | Severidad | Nota |
|----|-----------|-----------|------|
| G1 | Killswitch `ENABLE_THETA_ORCHESTRATOR=false` | 🔴 bloqueante | Apagar = módulo zombie |
| G2 | `theia:get-frame-context` → null | 🔴 bloqueante | Con killswitch off, worker renderiza 0 frames — SAB local sin escritor |
| G3 | `theia:get-video-sab` → null | 🔴 bloqueante | Output window negra aunque se abra |
| G4 | `attachSeleneTheia` sin callers + `cognitiveOutput` nunca emitido | 🔴 bloqueante | Loop cognitivo Selene→Theia inexistente end-to-end |
| G5 | `_seleneThetaBridge` snapshot congelado en TickEngine ctx | 🟠 | Tres niveles de rotura (ver §5.1) |
| G6 | Proceso boundary Selene(main)↔Theta(renderer) sin resolver | 🟠 | WAVE-4871 propuso fix, no implementado |
| G7 | Loop `trim.endMs` no enforceado | 🟠 | El átomo no loopea — playAtom solo seek+play |
| G8 | Tab `theia` en `ALPHA_LOCKED_TABS` | 🟡 | UI inaccesible — la feature existe pero está oculta |
| G9 | Worker `type:'module'` + bundle IIFE + `file://` | 🟡 | Riesgo prod-packaging (WAVE-7790 fix aplicado al contenido, no al flag) |
| G10 | `pickTargetDisplay` heurístico | 🟡 | Sin selector de pantalla; multi-display >2 o proyector en (0,0) fallan |
| G11 | `attachTheiaRenderer` (DMX twin-output) sin callers | 🟡 | Feature "video→luces" construida, desconectada |
| G12 | No hay tests del módulo Theia | 🟡 | `find` devuelve 0 — worker/FSM/crossfade/adapter/registry sin cobertura |
| G13 | `vite-env.d.ts`: `exportAsset` declarado dos veces | 🟢 | Typo de merge, TS lo tolera |
| G14 | `MOCK_CLIPS` + heartbeat fake en EngineView | 🟢 | Monitor de sección alimenta de seno+ruido, no de datos reales |
| G15 | `theia:seek` nunca hace seek real en worker | 🟢 | Diseño consistente (orch hace `currentTime`, worker solo crossfade) pero hay que saberlo |
| G16 | No hay `.theia` de muestra ni packs en repo | 🟢 | Zero assets de prueba — desarrollo ciego de contenido |
| G17 | Output window: blit por `putImageData`→`drawImage` escalado | 🟢 | ~500MB/s de copia CPU a 60fps para 1080p — funcional pero WebGL `texSubImage2D` lo optimizaría |
| G18 | `SeleneTheiaAdapter.process` depende de `livePackId` del store | 🟢 | Standby silencioso si no hay pack marcado live — comportamiento correcto pero invisible |

---

## 9. ROADMAP DE RESURRECCIÓN RECOMENDADO

**F0 — Verificación de transporte SAB (sin código nuevo, solo pruebas):**
1. `theia:get-frame-context` → devolver `trinity.getFrameContextSAB()` real; verificar llegada del SAB en dev y **en build empaquetado** (COOP/COEP ya activos).
2. Ídem `theia:get-video-sab` → `TheiaWindowManager.getVideoFrameSAB()`.
3. Si `invoke` falla en packaged: fallback `webContents.send` push en `did-finish-load` de ambas ventanas.

**F1 — Reencendido mínimo (path vídeo, sin Selene):**
1. `ENABLE_THETA_ORCHESTRATOR = true` (o convertir en flag de Vanguard/tier).
2. Worker spawn `type:'classic'` (match IIFE bundle, fix file://).
3. Loop enforcement: `timeupdate` listener en orchestrator → `if (t >= endMs) currentTime = startMs`.
4. Desbloquear tab `theia` (quitar de ALPHA_LOCKED o gatear por licencia/tier).
5. E2E: cargar .mp4 en TheiaEngineView → viewport muestra frames → OUTPUT abre ventana → proyector blittea.

**F2 — Cableado cognitivo (la decisión WAVE-4871 pendiente):**
1. Implementar `TheiaStateResolver` en main (hysteresis sobre `context.section?.type` + `energy` a 44Hz — reutilizar lógica de `SeleneTheiaBridge` movida a main).
2. `webContents.send('theia:force-state'|'theia:play-atom', ...)` + `ipcRenderer.on` en preload → `theta.forceState()`/`orchestrator.playAtom()` en renderer.
3. Alternativa completa: hacer que `SeleneTitanConscious` emita `cognitiveOutput` en main + IPC fan-out al renderer.
4. Corregir el triple-dead-code de `attachSeleneTheiaBridge`/`_seleneThetaBridge` (o eliminarlo — es lo que recomienda WAVE-4871 §6).

**F3 — Output robustecido:**
1. Selector de display (lista `screen.getAllDisplays()` con nombre/resolución, persistencia en config).
2. Auto-reopen si HDMI se desconecta/reconecta (`display-added/removed` events de `screen`).
3. Blackout real: mensaje `theia:blackout` → worker escribe frame negro (hoy el "blackout" depende de pausar vídeo, no de pintar negro).
4. Optimizar blit: `texSubImage2D` WebGL en output window si el `putImageData` resulta cuello.

**F4 — Modo generativo (WebGL):**
1. `TheiaTelemetryRing` SAB (~256B) + writer en TickEngine + reader en worker.
2. `theia:init` campo `renderMode` + protocolo `theia:shader-load/unload/status`.
3. Implementación Opción A (shader en worker → `readPixels`→SAB) — conserva twin-output DMX.
4. Evaluar Opción B (shader nativo en output window alimentado por telemetría) como arquitectura objetivo para generativo puro.

**F5 — Vanguard integration:**
1. `launcher:probe`/`performanceTiers` exponen `theiaCapable: boolean` (GPU probe → tier HQ).
2. `ENABLE_THETA_ORCHESTRATOR` deja de ser constante → `config.performance.theiaEnabled` decidido por Vanguard.
3. `launcher.html` muestra Theia como feature opcional del tier.

---

## 10. DEFINITION OF DONE — "THEIA CONECTADO"

- [ ] `ENABLE_THETA_ORCHESTRATOR` removido o convertido a config de Vanguard.
- [ ] `theia:get-frame-context` devuelve el SAB real (worker observa `generation` incrementando — verificable vía `ticksObserved` en state-report > 0).
- [ ] `theia:get-video-sab` devuelve SAB real (output window entra en rAF loop — `hasFrame()` true).
- [ ] `trim.endMs` enforceado — un átomo loopea visualmente sin drift.
- [ ] Selene `section.type`/`energy` llega a `theta.forceState()` o `playAtom()` — verificable cambiando de sección musical real.
- [ ] Output window abre en display externo correcto con selector de usuario.
- [ ] Tab `theia` accesible (sin ALPHA badge o tras el gate elegido).
- [ ] Tests: `theta.worker` FSM transitions, `SeleneTheiaAdapter` matching, `TheiaFileLoader` gates A1-A5, SAB writer/reader roundtrip.
- [ ] Typecheck `tsc --noEmit` limpio + build prod ejecuta el worker (no solo dev).
- [ ] (Opcional F4) `theia:shader-load` compila un fragment GLSL mínimo (`void main(){gl_FragColor=vec4(u_energy,0.,1.-u_energy,1.);}`) y pinta reactividad a `energy` a 44Hz.

---

## 11. INVENTARIO DE ARCHIVOS CON ESTADO

| Archivo | LOC | Rol | Estado |
|---------|-----|-----|--------|
| `src/theia/theta.worker.ts` | 729 | Web Worker: decode pump, render, FSM, crossfade, SAB writers | ✅ completo, 🟡 spawn-blocked |
| `src/theia/ThetaOrchestrator.ts` | 917 | Renderer manager: spawn, heartbeat, Phoenix, video element, playAtom, output API | ✅ completo, 🔴 killswitch |
| `src/theia/protocol.ts` | 216 | Catálogo de mensajes orchestrator↔worker | ✅ completo, falta telemetría/shader |
| `src/theia/FrameContextRing.ts` | 144 | SAB reloj maestro 16B tickId/ts/gen | ✅ completo, 🔴 sin writer alcanzable |
| `src/theia/SharedVideoFrameBuffer.ts` | 232 | SAB video 16.6MB double-buffer | ✅ completo, 🔴 nunca creado |
| `src/theia/TheiaThumbBuffer.ts` | 147 | SAB thumb 64×64 → AetherCanvas | ✅ completo, 🟡 consumidor nunca attachado |
| `src/theia/AssetStateMachine.ts` | 122 | FSM ambient/buildup/drop/decay | ✅ completo |
| `src/theia/CrossfadeUnit.ts` | 156 | Curvas de blend por ticks | ✅ completo, ⚠️ waitAnchor sin beat signal |
| `src/theia/SeleneTheiaBridge.ts` | 201 | Observer hysteresis energy→state | ✅ completo, 🔴 dead×3 |
| `src/theia/index.ts` | 75 | Barrel exports | ✅ |
| `src/core/theia/TheiaRegistry.ts` | 349 | Índice átomos + matching 3D | ✅ completo |
| `src/core/theia/TheiaFileLoader.ts` | 213 | Parser/validador .theia gates A1-A5 | ✅ completo |
| `src/core/theia/SeleneTheiaAdapter.ts` | 307 | Cognitive→CueJumpIntent | ✅ completo, 🔴 nunca invocado |
| `src/core/theia/SeleneTheiaWiring.ts` | 171 | EventTarget bus + attach | ✅ completo, 🔴 nunca attachado |
| `src/core/orchestrator/theia/TheiaBridgeManager.ts` | 108 | Twin-output DMX attach | ✅ completo, 🔴 sin callers |
| `src/types/theiaTypes.ts` | 212 | `.theia v2.0` types + guards | ✅ completo |
| `src/stores/useTheiaEditorStore.ts` | 278 | Draft atom, editorMode live/workshop | ✅ completo |
| `src/stores/useTheiaPackStore.ts` | 358 | Packs, rawClips, ingest, livePackId | ✅ completo |
| `electron/TheiaWindowManager.ts` | 246 | Ventana proyector main-side | ✅ completo, 🔴 SAB stub null |
| `src/components/views/TheiaEngineView/` | ~800 | Command deck UI | 🟡 funcional con mocks residuales |
| `src/components/views/TheiaOutputView/` | 183 | rAF blit SAB→canvas | ✅ completo, 🔴 SAB null |
| `src/components/theia/{LiveDeck,WorkshopDeck,TheiaDNALab,TheiaTrimmer}.tsx` | ~1.400 | Deck UI + DNA editor + trimmer | ✅ completo |
| `src/core/aether/canvas/renderers/TheiaVideoRenderer.ts` | 130 | thumb→AetherCanvas producer | ✅ completo, 🔴 sin attach caller |

**Total:** ~3.800 LOC de módulo funcional en cuarentena.

---

## 12. NOTAS FINALES PARA EL ARQUITECTO

1. **El módulo no es vaporware.** El diseño es más avanzado de lo que sugiere su estado: doble salida SAB (pantalla + DMX pixel-map), crossfade anclable a downbeat, matching cognitivo 3D, FSM con protección de drop, Phoenix/circuit-breaker pari passu con Trinity. Quien lo construyó (waves 4850-4924) conocía la doctrina.

2. **La causa de muerte fue de operación, no de diseño.** OOM por `getImageData` a 44Hz sobre 4K (WAVE-7569 mitigó con clamp+reuse), luego exorcismo del hot-path (WAVE-5033) como medida de higiene mientras se estabilizaba el backend. El killswitch quedó puesto "temporalmente" y nunca se levantó.

3. **La ruptura real no es el killswitch** — es que el reloj maestro (FrameContext SAB) y el bus de vídeo (videoFrameSAB) **físicamente no cruzan main↔renderer** porque los handlers IPC devuelven `null` por cautela ante structured-clone en packaged builds. Con COOP/COEP ya activos (main.ts:1570), probablemente funcione hoy — nadie lo verificó.

4. **El puente Selene fue diseñado tres veces** (4869 bridge, 4871 blueprint correcto, 4903 wiring+bus) y ninguna cruzó la frontera de proceso: Selene vive en main, Theta en renderer. La pieza que falta es trivial (un `webContents.send` + `ipcRenderer.on`), pero nadie la escribió.

5. **Para el objetivo WebGL/GLSL:** la respuesta es **sí, viable sin deps**. `OffscreenCanvas.getContext('webgl2')` en worker funciona; `readPixels` escribe directo a la vista del SAB (mejor que el `getImageData` actual — elimina el problema OILPAN de raíz). Lo único que falta es un canal de telemetría por tick (propuesta `TheiaTelemetryRing`, §7.4) y 4 mensajes nuevos en `protocol.ts`.

6. **Riesgo principal de la resurrección:** hacerlo todo a la vez. El roadmap F0→F5 propone primero devolver el vídeo al proyector (F0+F1 son ~100 LOC de cambios), validar E2E, y solo entonces meter cognición y shaders. El módulo soporta esa progresión porque cada capa está ya separada.

---

*Documento forense — WAVE 8206. Generado por Devin. Auditoría de solo-lectura; ningún archivo de código fue modificado.*
