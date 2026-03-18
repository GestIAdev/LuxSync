# ARQUITECTURA_ACTUAL — LuxSync Audit
> Auditoría de solo lectura. Sin modificaciones de código.
> Radwulf, esto es el mapa del territorio real. Cada línea tiene coordenada o tiene evidencia.

---

## ÍNDICE

1. [Punto 1 — Gate `outputEnabled` en MasterArbiter](#punto-1)
2. [Punto 2 — Bug Audio IN: false positive "ACTIVE"](#punto-2)
3. [Punto 3 — Jerarquía de Vibes: por qué no existe toggle-off](#punto-3)
4. [Punto 4 — Orden de resolución: Physics loop vs Manual Override](#punto-4)
5. [Punto 5 — Secuencia de arranque en frío → estado ARMED](#punto-5)

---

## PUNTO 1 — Gate `outputEnabled` en MasterArbiter {#punto-1}

### Qué hace el gate

**Archivo:** `src/core/arbiter/MasterArbiter.ts`

```
Línea 114:  private _outputEnabled: boolean = false
```

El arbiter **arranca siempre con output deshabilitado**. No hay ningún auto-enable en el constructor. El estado sólo cambia cuando el renderer llama explícitamente a los IPC handlers del arbiter.

### La compuerta exacta (línea 1409)

```typescript
// L1409 — PRIMERA COMPROBACIÓN dentro de arbitrateFixture()
if (!this._outputEnabled && !manualOverride) {
  return createOutputGateBlackout()   // → todos los canales a 0
}
```

**Qué pasa si `_outputEnabled = false` Y hay `manualOverride` activo:**
El `if` falla (porque `!manualOverride` es false) → el blackout del gate NO se ejecuta → el frame continúa normalmente hasta `mergeChannelForFixture()` donde el override se aplica. **Los paneles TestPanel y CalibrationView funcionan en estado ARMED exactamente por esta excepción.**

### Layer4 Blackout — NO tiene excepción manual (línea 1426)

```typescript
// L1426 — SEGUNDA COMPROBACIÓN, DESPUÉS del gate de output
if (this.layer4_blackout) {
  return createBlackoutTarget()   // → todos los canales a 0, sin excepción
}
```

**Crítico:** El Layer4 Blackout (botón de emergencia del operador) **gana siempre**, incluso sobre un manual override activo en TestPanel. No hay `&& !manualOverride`. Esto es comportamiento intencional (blackout = emergencia de seguridad), pero hay que saberlo porque puede sorprender si el técnico tiene una fixture en manual y el operador pulsa blackout.

### Diagrama de estados del gate

```
App arranca
    │
    ▼
_outputEnabled = false         ← COLD (backend arrancado, sin señal)
    │
    │  DMX interface conectada (IPC: dmx:connect)
    ▼
_outputEnabled = false         ← ARMED (motor corre, DMX bloqueado)
    │                              TitanOrchestrator.start() → setInterval(16ms)
    │  Operador pulsa GO button (IPC: lux:arbiter:setOutputEnabled {enabled: true})
    ▼
_outputEnabled = true          ← LIVE (DMX fluye a fixtures reales)
```

### Qué comandos bloquea el gate (estado ARMED)

| Origen | ¿Bloqueado por gate? | Razón |
|--------|----------------------|-------|
| Motor Titan (Selene, Physics, EffectManager) | **SÍ** | No hay manualOverride → blackout |
| Chronos playback | **SÍ** | No hay manualOverride en playback |
| TestPanel `setManual()` | **NO** | Activa manualOverride → excepción L1409 |
| CalibrationView sliders | **NO** | Idem — usa `setManual()` |
| Layer4 Blackout | N/A | Se ejecuta DESPUÉS del gate, sin excepción |

---

## PUNTO 2 — Bug Audio IN: false positive "ACTIVE" {#punto-2}

### Síntoma
Cuando el sistema arranca, el indicador "Audio IN" en SystemsCheck.tsx muestra **"ACTIVE"** aunque el audio esté en cola OFF o simplemente no haya seleccionado nada todavía.

### Causa raíz: dos capas de bug

#### Capa 1 — `useState` hardcodeado a `'online'`

**Archivo:** `src/components/views/DashboardView/components/SystemsCheck.tsx`

```typescript
// Línea 381 — INICIALIZACIÓN DEL ESTADO LOCAL
const [status, setStatus] = useState<SystemStatus>({
  audio: 'online',   // ← HARDCODED. Muestra "ACTIVE" desde el primer render.
  dmx: 'offline',
  // ...
})
```

El componente arranca mostrando "ACTIVE" **antes de que Trinity haya reportado nada**. El estado correcto sería `'offline'` como default pesimista.

#### Capa 2 — `trinity.stopAudio()` no actualiza `isAudioActive`

**Archivo:** `src/providers/TrinityProvider.tsx`

```typescript
// Línea ~280 — Contexto expuesto
const contextValue = {
  // ...
  stopAudio: stopCapture,   // stopCapture = función de useAudioCapture
  // ...
}
```

```typescript
// Línea ~420 — startTrinity()
state.isAudioActive = true   // se pone en true aquí

// Línea ~480 — stopTrinity()
state.isAudioActive = false  // se pone en false SOLO aquí
```

Cuando el usuario selecciona `audioSource: 'off'` en SystemsCheck:
```typescript
// handleAudioChange en SystemsCheck (línea ~460)
if (source === 'off') {
  trinity.stopAudio()     // llama a stopCapture() de useAudioCapture
  setAudioSource('off')   // actualiza setupStore (UI cache only)
}
// FALTA: no hay nada que ponga TrinityProvider.state.isAudioActive = false
```

`stopCapture()` (de `useAudioCapture`) para la captura real pero **no toca `state.isAudioActive`** en TrinityProvider. La variable `isAudioActive` sólo se vuelve `false` cuando se llama a `stopTrinity()` completa (powerState → OFFLINE).

#### Capa 3 — setupStore.audioSource no tiene side effects

**Archivo:** `src/stores/setupStore.ts`

```typescript
// setAudioSource() — líneas ~90-95
setAudioSource: (source) => {
  set({ audioSource: source, hasUnsavedChanges: true })
  // ← NADA MÁS. No llama a Trinity. No emite IPC. Es UI cache puro.
}
```

`setupStore.audioSource = 'off'` es solo una nota en el estado de configuración. El motor de audio no escucha este store.

### Flujo del bug visualizado

```
App mount
  → useState({ audio: 'online' })     ← ya muestra "ACTIVE" (BUG #1)
  → Trinity no ha conectado aún

Trinity conecta → startTrinity()
  → state.isAudioActive = true
  → useEffect en SystemsCheck detecta: trinity.state.isAudioActive === true
  → setStatus({ audio: 'online' })    ← correcto, pero llegamos igual que antes

Operador selecciona audioSource = 'off'
  → trinity.stopAudio() = stopCapture()
    → isCapturing (useAudioCapture) = false → captura real para
    → state.isAudioActive EN TRINITYPROVIDER: SIGUE EN true   (BUG #2)
  → useEffect no detecta cambio (isAudioActive no cambió)
  → status.audio SIGUE en 'online' → UI sigue mostrando "ACTIVE"
```

---

## PUNTO 3 — Jerarquía de Vibes: por qué no existe toggle-off {#punto-3}

### Dónde vive el estado del vibe

```
Backend:  HardwareAbstraction.ts:115  → private currentVibeId: string = 'idle'
          FixturePhysicsDriver.ts:129 → private currentVibeId: string = 'idle'
          
Frontend: vibeStore.ts (Zustand)
          └─ currentVibe: VibeId = 'idle'     (single source of truth UI)
          └─ getVisualVibe(): VibeVisualId | null   (null = botón apagado)
```

**Tipos divergentes entre hook y store:**

```typescript
// vibeStore.ts:19
export type VibeId = 'idle' | 'techno-club' | 'fiesta-latina' | 'pop-rock' | 'chill-lounge'

// useSeleneVibe.ts:30 — SOLO EL HOOK tiene el tipo restringido
type VibeId = 'techno-club' | 'fiesta-latina' | 'pop-rock' | 'chill-lounge'
// ← 'idle' NO ESTÁ en el VibeId del hook. Sólo en el store y en types/VibeProfile.ts
```

El backend (`TitanOrchestrator`, `EffectManager`, `VibeMovementManager`) trabaja siempre con el tipo completo que incluye `'idle'`. El hook de UI tiene un tipo reducido sin `'idle'`.

### El bug del toggle-off

**Archivo:** `src/hooks/useSeleneVibe.ts`, **línea 165**

```typescript
const setVibe = useCallback((vibeId: VibeId) => {
  // ...
  if (vibeId === visualVibe) {
    return   // ← EARLY EXIT. Mismo botón = no hace nada. NO hay toggle a 'idle'.
  }
  // ...
  window.lux.setVibe(vibeId)
}, [visualVibe])
```

**Por qué no hay toggle:** La UI sólo puede llamar a `window.lux.setVibe(vibeId: VibeId)` donde `VibeId` del hook excluye `'idle'`. No existe ningún `clearVibe()`, `setVibeIdle()`, ni `setVibe(null)` en la API pública del hook.

**El backend SÍ soporta idle.** Cuando el backend envía `'idle'` via `onVibeChange`, el store lo recibe y `getVisualVibe()` retorna `null`. Los botones del selector se apagan correctamente. El problema es unidireccional: **UI → Backend no tiene ruta para enviar 'idle'**.

### Flujo de propagación del vibe (cuando funciona)

```
VibeSelectorCompact (click)
  → setVibe('techno-club')          [useSeleneVibe]
  → window.lux.setVibe('techno-club') [IPC preload]
  → IPCHandlers.ts: handleSetVibe()
  → TitanOrchestrator.setVibe('techno-club')
  → backend: HardwareAbstraction.currentVibeId = 'techno-club'
  → backend emite: onVibeChange('techno-club')
  → vibeStore.setCurrentVibe('techno-club')
  → activeVibe = getVisualVibe() = 'techno-club'
  → botón se ilumina
```

### Flujo de desactivación (sólo viene del backend)

```
Backend fuerza vibe = 'idle'   [ej: Sistema se apaga, o señal manual]
  → onVibeChange('idle')
  → vibeStore.setCurrentVibe('idle')
  → getVisualVibe() retorna null
  → activeVibe = null → todos los botones se apagan
  
Error si el usuario hace click en el botón ya activo:
  setVibe('techno-club')
  → vibeId === visualVibe ('techno-club' === 'techno-club')
  → return   ← no pasa nada. El botón no se apaga.
```

---

## PUNTO 4 — Orden de resolución: Physics loop vs Manual Override {#punto-4}

### El render loop

**Archivo:** `src/core/orchestrator/TitanOrchestrator.ts`

```typescript
// Línea 358
this.mainLoopInterval = setInterval(() => {
  this.processFrame()
}, 16)  // ← ~60fps (comment dice 30fps pero el interval es 16ms)
```

Cada 16ms se ejecuta `processFrame()`, que llama:
```
1. TitanEngine.update(context)          → produce LightingTarget (capa 0-3)
2. masterArbiter.arbitrate(target)      → aplica jerarquía de capas
3. hal.renderFromTarget(arbitrated)     → produce FixtureState[]
4. UniversalDMXDriver.sendAll()         → envía buffer DMX por serial/ArtNet
```

### Orden de prioridad dentro de `arbitrateFixture()` (MasterArbiter.ts)

```
PRIORIDAD DECRECIENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

① L1409: OUTPUT GATE
   if (!_outputEnabled && !manualOverride) → blackout completo
   Excepción: si hay manualOverride activo, el gate no bloquea

② L1426: LAYER 4 BLACKOUT (emergencia operador)
   if (layer4_blackout) → blackout absoluto, SIN excepción para override
   ← El manual override NO puede bypassar el blackout de emergencia

③ mergeChannelForFixture() — por canal DMX:

   a) MANUAL OVERRIDE (máxima prioridad dentro del merge)
      if (manualOverride && overrideChannels.includes(channel))
        → RETURN DIRECTO con el valor del operador
        → Ninguna capa más se consulta para este canal
   
   b) Titan AI (capa base)
      Valores calculados por TitanEngine / Selene physics
   
   c) Layer 3: Effects (EffectManager)
      Overrides de zona, color constitutions, efectos de strobe/pulse
   
   d) LTP Merge (Latest Takes Precedence)
      Mezcla capas 0-3 con LTP standard
   
   e) Grand Master aplicado al dimmer:
      channel_dimmer = clampDMX(dimmer * this.grandMaster)

④ PHANTOM CHANNELS
   Resueltos por phantomChannels map (canales virtuales → DMX real)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### HAL: renderFromTarget (post-arbitraje)

```
arbitratedTarget (FinalLightingTarget)
  └─ HAL.renderFromTarget()
       └─ FixtureMapper: mapea canales lógicos a offset DMX
       └─ FixturePhysicsDriver: aplica física de movimiento (pan/tilt inertia)
       └─ SeleneColorEngine: traduce HSV → RGB DMX con constituciones de vibe
       └─ produce FixtureState[] → buffer DMX 512 bytes
```

**Nota sobre physics:** `FixturePhysicsDriver` corre en el HAL, **DESPUÉS** del arbitraje. Esto significa que la física de movimiento (inercia, aceleración) se aplica siempre, incluido cuando hay un manual override de pan/tilt. El manual override da el *destino*, la física es la *trayectoria*.

### Timing DMX

```
UniversalDMXDriver:
  - NO tiene outputLoop propio (líneas 401-403: "El HAL es el único dueño del timing")
  - Cada vez que HAL llama sendAll() → escribe al driver activo
  - OpenDMX: port.set({brk:true}) → setTimeout(2ms) → port.set({brk:false})
             → setTimeout(1ms) → port.write(buffer) → resolve()
  - ArtNet: UDP immediate send con rate limiting ~30Hz (línea 267)
```

---

## PUNTO 5 — Secuencia de arranque en frío → estado ARMED {#punto-5}

### Orden de inicialización en el proceso principal

**Archivo:** `electron/main.ts`

```
app.ready
  │
  ├─1─ StagePersistence.init()              [L317] — carga fixtures/shows del disco
  │
  ├─2─ HephaestusFileIO.init()              [L323] — I/O shows Chronos
  │
  ├─3─ PhantomWorker.init()                 [L328] — worker audio analysis (GodEarFFT)
  │
  ├─4─ EffectsEngine.init()                 [L340] — EffectManager, library de efectos
  │
  ├─5─ new TitanOrchestrator(deps)          [L348] — instancia (no arranca aún)
  │      deps: { hal, engine, arbiter, ... }
  │
  ├─6─ registerTitanOrchestrator()          [L354] — registra singleton global
  │
  ├─7─ titanOrchestrator.init()             [L356] — inicializa HAL, fixtures vacíos
  │      MasterArbiter._outputEnabled = false  ← ESTADO: COLD
  │
  ├─8─ setBroadcastCallback()               [L360] — conecta IPC→renderer broadcast
  │
  ├─9─ setLogCallback()                     [L373] — conecta tactical log
  │
  ├─10─ titanOrchestrator.start()           [L383] — arranca setInterval(16ms)
  │       ESTADO: ARMED (loop corre, DMX bloqueado)
  │       Mensaje de boot: "DMX OUTPUT .......... ARMED"
  │
  ├─11─ setupIPCHandlers(deps)              [L385] — registra handlers IPC del renderer
  │
  ├─12─ registerArbiterHandlers(arbiter)    [L419] — registra IPC handlers del arbiter
  │
  └─13─ createWindow()                      [L555] — crea BrowserWindow, carga renderer
```

### Secuencia en el renderer (después de `createWindow`)

```
React mount
  │
  ├─ usePowerStore.powerState = 'OFFLINE'    ← default del store
  │
  ├─ CommandDeck.mount()
  │    → fetch('lux:arbiter:getStatus')
  │    → syncroniza outputEnabled del backend al store frontend
  │
  ├─ TrinityProvider.mount()
  │    → escucha cambios de powerState
  │    → NO inicia nada aún (powerState = 'OFFLINE')
  │
  └─ SystemsCheck.mount()
       → useState({ audio: 'online', ... })   ← BUG: ya muestra "ACTIVE"

Operador hace click en GO / POWER button
  │
  ├─ useSystemPower.powerOn()
  │    → setPowerState('STARTING')
  │    → [sync] DMX check, fixture load, etc.
  │    → setPowerState('ONLINE')
  │
  ├─ TrinityProvider detecta powerState === 'ONLINE'
  │    → startTrinity()
  │    → startCapture()              ← audio empieza a capturar
  │    → state.isAudioActive = true
  │
  └─ GO button → setOutputEnabled(true)
       → IPC: lux:arbiter:setOutputEnabled { enabled: true }
       → MasterArbiter._outputEnabled = true
       → ESTADO: LIVE — DMX fluye
```

### Diagrama de estados completo

```
                    PROCESO MAIN (Node.js)
                    ─────────────────────
 app.ready
    │
    ▼
 COLD: MasterArbiter init
 _outputEnabled = false
 TitanOrchestrator NO inicializado
    │
    │ titanOrchestrator.init() + .start()
    ▼
 ARMED: _outputEnabled = false
 setInterval(16ms) corriendo
 HAL inicializado, fixtures vacíos
 DMX: blackout por gate (sin manual override activo)
    │
    │ Renderer → IPC: setOutputEnabled(true)
    ▼
 LIVE: _outputEnabled = true
 DMX fluye a fixtures según Titan/Selene/Effects
 
                    RENDERER (React)
                    ───────────────
 React mount → powerState = 'OFFLINE'
 Trinity dormida
    │
    │ powerOn() → 'STARTING' → 'ONLINE'
    ▼
 Trinity activa (startCapture)
 audio = en captura real (si audioSource != 'off')
    │
    │ Usuario pulsa GO button
    ▼
 IPC → setOutputEnabled(true)
 Backend = LIVE
```

---

## RESUMEN DE BUGS IDENTIFICADOS

| # | Severidad | Archivo | Línea | Descripción |
|---|-----------|---------|-------|-------------|
| B1 | Media | `SystemsCheck.tsx` | 381 | `useState({ audio: 'online' })` hardcodeado — muestra "ACTIVE" antes de que Trinity conecte |
| B2 | Media | `TrinityProvider.tsx` | ~480 | `stopAudio()` llama a `stopCapture()` pero NO actualiza `state.isAudioActive` — UI no refleja estado real |
| B3 | Baja | `useSeleneVibe.ts` | 165 | `setVibe(vibeId)` early-exit si misma vibe — no hay toggle-off a 'idle' desde UI |
| B4 | Baja | `useSeleneVibe.ts` | 30 | Tipo `VibeId` del hook excluye `'idle'` — no hay ruta UI→Backend para enviar 'idle' |

## ASIMETRÍAS DE DISEÑO DOCUMENTADAS (no bugs, decisiones intencionales)

| Elemento | Comportamiento | Por qué es intencional |
|----------|----------------|----------------------|
| Layer4 Blackout sin excepción de manual | Blackout gana sobre TestPanel/CalibrationView | Blackout = emergencia de seguridad. Debe ser absoluto. |
| Physics aplicada post-arbitraje | Manual override da destino, física da trayectoria | Inercia natural aunque el operador controle el destino final |
| UniversalDMXDriver sin loop propio | HAL es el único dueño del timing | Evita "choque de trenes" — dos loops compitiendo por el mismo puerto serial |
| `setupStore.audioSource` sin side effects | Es UI cache, no afecta Trinity | Separación de concerns: store = preferencias guardadas, Trinity = estado runtime |

---

*Generado en Wave ??? — Auditoría PunkOpus. Ningún archivo modificado.*
