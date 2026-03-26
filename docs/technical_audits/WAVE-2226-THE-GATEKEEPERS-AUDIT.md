# WAVE 2226: THE GATEKEEPER'S AUDIT — Architecture Recon

**Fecha**: 2026-03-25  
**Agente**: PunkOpus  
**Tipo**: Auditoría de reconocimiento (sin modificación de código)  
**Estado**: COMPLETADO — Listo para implementación

---

## RESUMEN EJECUTIVO

Se identifican **3 fugas arquitectónicas** y **1 problema de UX** que violan las Leyes del Arquitecto. El Output Gate ("GO") tiene agujeros, el disarm no limpia estado, y el HyperionView está encadenado al Gate sin necesidad.

---

## OBJETIVO 1: EL OUTPUT GATE POROSO

### Anatomía del Gate Actual

El flujo DMX sigue esta cadena:

```
TitanEngine.update()     →  Genera intent (colores, posiciones, dimmer)
MasterArbiter.arbitrate() →  Arbitra layers (Titan L0, Manual L2, Effects L3, Blackout L4)
HAL.renderFromTarget()    →  Physics + driver.send() ← PRIMER ENVÍO DMX
  ↓
EffectsEngine overlay     →  Aplica efectos (strobo, hephaestus)
HAL.sendStatesWithPhysics() ← SEGUNDO ENVÍO DMX (si hay clips Hephaestus)
  ↓
Visual Gate               →  Zerifica fixtureStates para UI broadcast
  ↓
IPC Broadcast → truthStore → HyperionView
```

### Dónde SÍ funciona el Gate

**MasterArbiter.arbitrateFixture()** — Línea ~1415:
```typescript
if (!this._outputEnabled && !manualOverride) {
  return this.createOutputGateBlackout(fixtureId)  // dimmer=0, pan/tilt=center
}
```

Cuando `outputEnabled=false` y NO hay manual override → envía blackout (dimmer=0, RGB negro, pan/tilt frozen en última posición conocida). **Esto funciona correctamente para DMX físico.**

### Dónde está la FUGA 1: El Bypass de Calibración

**MasterArbiter.arbitrateFixture()** — La condición `!manualOverride` crea un bypass:

```typescript
// Si outputEnabled=false PERO hay manualOverride → CONTINÚA PROCESO NORMAL
const manualOverride = this.layer2_manualOverrides.get(fixtureId)
if (!this._outputEnabled && !manualOverride) {
  return this.createOutputGateBlackout(fixtureId)
}
// ↑ Si manualOverride existe, SALTA este gate y procesa TODOS los canales
```

**Comportamiento intencional**: Permite calibración con Output OFF — el técnico puede mover un fixture manualmente sin que el Layer 0 (AI) interfiera.

**Pero**: Si el operador tiene un override manual activo en UN canal (ej: solo dimmer), el fixture recibe también pan/tilt/color del Layer 0 para los canales no-overrideados. Esto es **correcto por diseño** — el merge channel-level hace que los canales sin override tomen su valor Titan.

**VEREDICTO FUGA 1**: No es fuga real. Es diseño intencional de calibración. ✅

### Dónde está la FUGA 2: Hephaestus Post-Render Re-send

**TitanOrchestrator.processFrame()** — Línea ~1426:

```typescript
// Hephaestus overlays APLICADOS (pero ANTES del Visual Gate)
if (hephOutputs.length > 0) {
  this.hal.sendStatesWithPhysics(fixtureStates)  // ← RE-ENVÍA AL DRIVER
}

// Visual Gate se aplica DESPUÉS
if (!masterArbiter.isOutputEnabled()) {
  fixtureStates = fixtureStates.map(f => ({...f, dimmer: 0, r:0, g:0, b:0, ...}))
}
```

**¿Es fuga real?** Solo si hay clips Hephaestus activos, lo cual requiere que el usuario los active manualmente. En condiciones normales (sin Hephaestus), esta ruta no se ejecuta. **Potencial menor pero existe.**

### Dónde está la FUGA 3: EL VERDADERO PROBLEMA

**El Gate está en el lugar EQUIVOCADO para la UI.**

El `renderFromTarget()` del HAL SIEMPRE envía DMX al driver — y el Arbiter SÍ lo bloquea correctamente (blackout para fixtures sin manual override). Hasta aquí bien.

**Pero el Visual Gate en TitanOrchestrator (línea ~1437) hace demasiado:**

```typescript
if (!masterArbiter.isOutputEnabled()) {
  fixtureStates = fixtureStates.map(f => ({
    ...f,
    dimmer: 0, r: 0, g: 0, b: 0,
    pan: 128, tilt: 128,
  }))
}
```

Esto DESTRUYE los datos visuales antes del broadcast. El HyperionView recibe todo negro. **El usuario no puede "previsualizar" su show en el simulador sin abrir la salida DMX.**

---

## OBJETIVO 2: LA BASURA DEL REACTOR (ARM STATE)

### Flujo de Disarm (powerOff)

```
CommandDeck.handleArmToggle() → togglePower()
  → useSystemPower.powerOff()
    → useControlStore.setGlobalMode(null)     // Reset modo
    → window.lux.stop()                        // IPC a backend
      → TitanOrchestrator.stop()
        → HAL.setBlackout(true)               // Blackout lógico
        → universalDMX.blackout()             // Ceros al buffer
        → universalDMX.sendAll()              // Flush al chip FTDI
        → clearInterval(mainLoopInterval)     // Mata el loop
        → isRunning = false
```

### Estado que queda VIVO (zombies):

| Componente | ¿Se limpia? | Estado residual |
|---|---|---|
| `TitanEngine` | ❌ NO | Vibe activo, color state, dimmer state, todo el engine state congelado |
| `VibeMovementManager` | ❌ NO | `resetTime()` EXISTE pero NADIE lo llama. `time`, `barCount`, `phaseAccumulator`, `smoothedBPM`, `lastPattern`, `lastPosition` — todo vivo |
| `MasterArbiter` | ❌ NO | `reset()` EXISTE pero NADIE lo llama. Layer 0 titan intent, Layer 2 manual overrides, Layer 3 effects, positionReleaseFades, lastKnownPositions, fixtureOrigins — todo vivo |
| `TrinityBrain` | ❌ NO | Estado emocional, decisiones previas congeladas |
| `BeatDetector` | ❌ NO | BPM acumulado, historial de peaks |
| `HAL` | ✅ Parcial | `setBlackout(true)` pero physics driver conserva estado (posiciones, velocidades) |
| `CrossfadeEngine` | ❌ NO | Crossfades activos podrían quedar pendientes |

### ¿Qué pasa al re-armar?

```typescript
// IPCHandlers.ts — lux:start
ipcMain.handle('lux:start', () => {
  if (titanOrchestrator && !titanOrchestrator.getState().isRunning) {
    titanOrchestrator.start()  // Solo reanuda el setInterval
  }
  return { success: true, inputGain: savedGain }
})
```

`start()` solo hace `setInterval(() => this.processFrame(), 40)`. **No resetea NADA.** El engine retoma exactamente donde lo dejó: misma vibe, mismo BPM acumulado, mismos acumuladores de fase del VMM, mismas posiciones "fantasma" en el Arbiter.

**Consecuencia observable**: Al desarmar y rearmar, los fixtures pueden saltar a posiciones inesperadas porque el VMM continúa desde su fase `time` congelada en vez de empezar limpio.

### VibeMovementManager.resetTime() — Existe pero nadie lo invoca

```typescript
// VibeMovementManager.ts — Línea 994
resetTime(): void {
  this.time = 0
  this.lastUpdate = Date.now()
  this.barCount = 0
  this.lastBeatCount = 0
  this.phaseAccumulator = 0
  this.smoothedBPM = 120
  this.lastPattern = null
  this.lastPosition = { x: 0, y: 0 }
  this.isTransitioning = false
}
```

Reset completo del VMM. Limpia tiempo, fase, BPM, pattern de transición. **Es exactamente lo que necesitamos** — solo hay que conectar el cable.

### MasterArbiter.reset() — Existe pero nadie lo invoca en disarm

```typescript
// MasterArbiter.ts — Línea 2452
reset(): void {
  this.layer0_titan = null
  this.layer1_consciousness = null
  this.layer2_manualOverrides.clear()
  this.layer3_effects = []
  this.layer4_blackout = false
  this._outputEnabled = false
  this.crossfadeEngine.clearAll()
  this.frameNumber = 0
}
```

**Problema**: Este reset es NUCLEAR — borra manual overrides, resetea outputEnabled. **No queremos esto completo al disarm** — solo limpiar los caches de AI (Layer 0, positionReleaseFades, lastKnownPositions, fixtureOrigins).

---

## OBJETIVO 3: HYPERIONVIEW Y EL GATE VISUAL

### Cadena de datos actual

```
TitanOrchestrator.processFrame()
  → [Engine + Arbiter + HAL producen fixtureStates reales]
  → Visual Gate: if (!outputEnabled) → TODO a negro   ← AQUÍ SE MATA
  → IPC broadcast → truthStore.fixtures
  → useFixtureData() → TacticalCanvas / VisualizerCanvas
```

### El problema

El HyperionView **no tiene gate propio**. Renderiza incondicionalmente lo que le llega por `truthStore.fixtures`. Y como el Visual Gate en TitanOrchestrator ZERIFICA todo antes del broadcast cuando `outputEnabled=false`, el simulador ve negro.

**El usuario quiere**: Ver el show corriendo en el simulador ("preview privado") mientras Output está OFF (DMX no sale al mundo real).

---

## DISEÑO DEL PARCHE: LAS LEYES DEL GATEKEEPER

### Ley 1: Separar Gate DMX del Gate Visual

**Principio**: El Gate de DMX físico ya funciona en el Arbiter (`createOutputGateBlackout`). El Visual Gate en TitanOrchestrator es REDUNDANTE para DMX y DAÑINO para la UI.

**Parche**:
Eliminar (o condicionalizar) el Visual Gate en TitanOrchestrator. Los `fixtureStates` que se broadcastean al frontend deben ser los valores REALES del engine, sin importar si `outputEnabled` es true o false.

```
// TitanOrchestrator.processFrame() — ANTES:
if (!masterArbiter.isOutputEnabled()) {
  fixtureStates = fixtureStates.map(f => ({...f, dimmer: 0, r:0, g:0, b:0, pan:128, tilt:128}))
}

// DESPUÉS: ELIMINAR este bloque
// El Arbiter ya controla el DMX real.
// La UI recibe datos vivos para previsualización.
```

El DMX físico sigue protegido por:
1. `MasterArbiter.arbitrateFixture()` → blackout para fixtures sin manual override
2. El driver USB/ArtNet ya recibe ceros del Arbiter

La UI ahora puede mostrar el show "privado" mientras DMX no sale.

### Ley 2: Cleanup Real en Disarm

**Parche en TitanOrchestrator.stop()**:

```typescript
async stop(): Promise<void> {
  // Paso 1: Blackout lógico en HAL
  if (this.hal) {
    this.hal.setBlackout(true)
  }

  // Paso 2: Buffer de ceros al driver serial
  universalDMX.blackout()
  await universalDMX.sendAll()

  // Paso 3: Drenar chip FTDI
  await new Promise<void>(resolve => setTimeout(resolve, 30))

  // Paso 4: Matar el loop
  if (this.mainLoopInterval) {
    clearInterval(this.mainLoopInterval)
    this.mainLoopInterval = null
  }
  this.isRunning = false

  // ═══════════════════════════════════════════════════════════════════
  // WAVE 2226: CLEANUP REAL — PURGAR ESTADO RESIDUAL
  // ═══════════════════════════════════════════════════════════════════

  // Purgar acumuladores de fase del movement engine
  if (this.engine) {
    const vmm = this.engine.getVibeMovementManager?.()
    if (vmm?.resetTime) {
      vmm.resetTime()
    }
  }

  // Purgar caches del Arbiter (pero NO manual overrides ni outputEnabled)
  // → Necesitamos un método selectivo, no el reset() nuclear
  masterArbiter.clearTitanState()  // NUEVO MÉTODO (ver abajo)

  // Purgar beat detector accumulated state
  if (this.beatDetector) {
    this.beatDetector.reset?.()
  }
}
```

### Ley 3: MasterArbiter.clearTitanState() — Reset Selectivo

**Nuevo método** — limpia SOLO el estado AI sin tocar la configuración del operador:

```typescript
clearTitanState(): void {
  this.layer0_titan = null
  this.positionReleaseFades.clear()
  this.lastKnownPositions.clear()
  this.fixtureOrigins.clear()
  this.crossfadeEngine.clearAll()
  this.frameNumber = 0
  // NO tocar: _outputEnabled, layer2_manualOverrides, layer3_effects,
  //           layer4_blackout, grandMaster, activePatterns, activeFormations
  console.log('[MasterArbiter] 🧹 Titan state cleared (operator state preserved)')
}
```

### Ley 4: Acceso al VMM desde TitanEngine

Verificar si `TitanEngine` expone `getVibeMovementManager()`. Si no, añadir getter:

```typescript
// TitanEngine.ts
getVibeMovementManager(): VibeMovementManager | null {
  return this.vibeMovementManager ?? null
}
```

---

## MAPA DE ARCHIVOS A MODIFICAR

| Archivo | Cambio | Prioridad |
|---|---|---|
| `TitanOrchestrator.ts` ~L1437 | Eliminar Visual Gate (el bloque `if (!masterArbiter.isOutputEnabled())`) | **ALTA** |
| `TitanOrchestrator.ts` `stop()` ~L404 | Añadir cleanup de VMM + Arbiter + BeatDetector | **ALTA** |
| `MasterArbiter.ts` | Nuevo método `clearTitanState()` | **ALTA** |
| `TitanEngine.ts` | Getter `getVibeMovementManager()` (si no existe) | **MEDIA** |

---

## DIAGRAMA DE ESTADO TARGET

```
COLD (default)
  ↓ [ARM] → TitanOrchestrator.start()
ARMED (engine corre, DMX=gate cerrada)
  │
  │  → Engine calcula → Arbiter bloquea Layer 0 → HAL envía ceros
  │  → Broadcast al frontend CONSERVA datos reales → HyperionView muestra show
  │  → Manual overrides (L2) SÍ pasan al DMX (calibración)
  │
  ↓ [GO] → MasterArbiter.setOutputEnabled(true)
LIVE (engine corre, DMX=gate abierta)
  │
  │  → Engine calcula → Arbiter mezcla layers → HAL envía DMX real
  │  → Broadcast al frontend = datos reales → HyperionView muestra show
  │
  ↓ [DISARM] → TitanOrchestrator.stop()
COLD
  → HAL blackout + buffer flush
  → VMM.resetTime() → fase, BPM, patterns limpios
  → Arbiter.clearTitanState() → Layer 0 null, caches purgados
  → BeatDetector.reset()
  → Loop muerto, isRunning=false
  → NEXT ARM arranca LIMPIO
```

---

## RIESGOS Y NOTAS

1. **Eliminar el Visual Gate NO afecta DMX real**: El Arbiter ya lo controla en `arbitrateFixture()`. El Gate visual era una redundancia para "seguridad visual" que se convirtió en restricción de UX.

2. **El cleanup del disarm NO debe borrar manual overrides**: Si el operador tiene overrides pendientes, deben sobrevivir al ciclo ARM/DISARM. Solo el estado AI se purga.

3. **Hephaestus re-send**: La fuga menor de `sendStatesWithPhysics` cuando hay clips activos. Si se quiere blindar, envolver en `if (masterArbiter.isOutputEnabled())`. Pero es bajo riesgo porque los clips Hephaestus requieren activación manual.

4. **`VibeMovementManager.resetTime()` usa `Date.now()`** — Línea: `this.lastUpdate = Date.now()`. Esto podría ser otro candidato para auditoria cross-domain (como el bug de WAVE 2225), pero en el VMM el `lastUpdate` se compara contra `Date.now()` consistentemente en `generateIntent()`, así que **no es bug**.

---

*"La puerta más fuerte no es la que bloquea todo — es la que sabe exactamente QUÉ dejar pasar."*

— PunkOpus, WAVE 2226
