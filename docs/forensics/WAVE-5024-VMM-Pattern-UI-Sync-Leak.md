# WAVE 5024 — VMM Pattern → UI Synchronization Leak (CONFIRMED)

## Estado
- **Severidad:** HIGH — UI permanently out of sync with automatic choreography
- **Impacto:** Operator sees stale / static pattern while VMM rotates dynamically
- **Componente afectado:** Aether Pipeline L0 → UI Projection
- **Regresión introducida:** Orchestrator modularization (WAVE 3505.4 / WAVE 4592)

---

## Síntoma reportado

> "Solo hay un patrón de movimiento en la UI. Cuando cambia en el backend, NO cambia en la UI el patrón del VMM. Cambiar la vibe no cambia nada. Hay movimiento sí, pero es el mismo patrón una y otra vez eternamente."

---

## Diagnóstico confirmado: DATA LEAK — NO EXISTE CANAL L0→UI PARA PATRÓN ACTIVO

### 1. El VMM SÍ rota patrones automáticamente

```typescript
// @electron-app/src/engine/movement/VibeMovementManager.ts:977-1007
if (currentPatternCfg && this.manualPatternOverride === null && config.patterns.length > 1) {
  if (this.schedulerState.sceneBeatsElapsed >= currentPatternCfg.phraseDuration) {
    const TWO_PI = 2 * Math.PI
    const normalizedPhase = ((this.schedulerState.phase % TWO_PI) + TWO_PI) % TWO_PI
    const distFromHarbor = Math.abs(normalizedPhase - currentPatternCfg.safeHarborPhase)
    const inHarbor = distFromHarbor < currentPatternCfg.safeHarborWindow
    const hardDeadline = this.schedulerState.sceneBeatsElapsed >=
      currentPatternCfg.phraseDuration + currentPatternCfg.hardDeadlineExtra
    if (inHarbor || hardDeadline) {
      const oldIndex = this.schedulerState.patternIndex
      this.schedulerState.patternIndex = (oldIndex + 1) % config.patterns.length
      this.schedulerState.sceneBeatsElapsed = 0
      const newPattern = config.patterns[this.schedulerState.patternIndex]
      console.log(
        `[SCHED] 🌊 ${currentPatternName} → ${newPattern}` +
        ` | harbor:${inHarbor} deadline:${hardDeadline}` +
        ` | phase:${Math.round(normalizedPhase * 180 / Math.PI)}°`
      )
    }
  }
}
```

El scheduler avanza `sceneBeatsElapsed`, evalúa `safeHarborPhase`, y cuando se cumplen las condiciones rota `patternIndex` e imprime `[SCHED] 🌊 old → new`. El backend genera dinámicamente.

### 2. El KineticAdapter emite SOLO offsets numéricos

```typescript
// @electron-app/src/core/aether/adapters/KineticAdapter.ts (extracto del hot-path)
// El adapter llama vmm.generateIntent() y emite:
intentBus.push('kinetic', nodeId, 10, {
  pan_offset: pan,
  tilt_offset: tilt,
})
```

El `IntentBus` (`_systemBus`) solo transporta canales `pan_offset` / `tilt_offset` (y `speed`). **No existe un campo `pattern` en el bus L0.**

### 3. NodeArbiter solo arbitra valores numéricos

```typescript
// @electron-app/src/core/aether/NodeArbiter.ts:775-913
// _applyRelativeOffsetFusion() opera sobre:
//   record['pan']  = basePan + panOffset * ampPan * distScale * gimbalFactor
//   record['tilt'] = baseTilt + tiltOffset * ampTilt * distScale
// Nunca toca un campo 'pattern' porque no existe en el ArbitratedNodeMap.
```

### 4. AetherUIProjector proyecta solo pan/tilt físicos al hotFrame

```typescript
// @electron-app/src/core/aether/resolver/AetherUIProjector.ts:135-161
// En la rama KINETIC:
fixture.pan = kn.currentPosition.pan
fixture.tilt = kn.currentPosition.tilt
fixture.physicalPan = panDmx / 255
fixture.physicalTilt = tiltDmx / 255
```

Solo números. No hay string `pattern` en el `FixtureState`.

### 5. TickEngine.emitHotFrame() no incluye pattern

```typescript
// @electron-app/src/core/orchestrator/tick/TickEngine.ts:716-754
const hotFrame = {
  frameNumber: this.frameCount,
  timestamp: now,
  onBeat: engineAudioMetrics.isBeat,
  fixtures: fixtureStates.map((f, i) => ({
    pan: f.pan / 255,
    tilt: f.tilt / 255,
    physicalPan: (f.physicalPan ?? f.pan) / 255,
    physicalTilt: (f.physicalTilt ?? f.tilt) / 255,
    dimmer: f.dimmer / 255,
    // ... color, zoom, etc.
  }))
}
```

**Campo `pattern` ausente.** El hotFrame es el único vehículo de 44Hz del backend al frontend para estado fixture. Como no lleva patrón, la UI nunca se entera.

### 6. transientStore solo consume campos numéricos del hotFrame

```typescript
// @electron-app/src/stores/transientStore.ts:145-204
// Inyecta hotFrame en transientRef.current.hardware.fixtures:
//   pan, tilt, physicalPan, physicalTilt, dimmer, color.r/g/b
// No hay pattern.
```

### 7. kineticHydrationStore es un espejo L2-MOTOR exclusivamente

```typescript
// @electron-app/src/stores/kineticHydrationStore.ts:1-31
/**
 * Espejo read-only del estado L2-MOTOR per-fixture, poblado por
 * KineticsBridge tras llamar `window.lux.aether.getKineticNodeStates(...)`.
 *
 * El bridge NUNCA se SUSCRIBE a este store — solo escribe. Como el bridge
 * solo dispara IPC en respuesta a cambios de `movementStore` (intent del
 * operador), la hidratación aquí es completamente silenciosa.
 */
```

Este store se alimenta exclusivamente del **motor manual nativo L2** (`AetherKineticEngine`). El VMM (L0) nunca escribe aquí.

### 8. PatternArsenal lee del hydration store — solo L2

```typescript
// @electron-app/src/components/hyperion/kinetics/PatternArsenal.tsx:36-58
export const PatternArsenal: React.FC<PatternArsenalProps> = ({
  activePattern,  // ← viene de kineticHydrationStore.aggregate.pattern
  onChange,
}) => {
  const handleClick = useCallback((id: PatternType) => {
    if (activePattern === null) { onChange(id); return }
    onChange(id === activePattern ? 'none' : id)
  }, [activePattern, onChange])
```

Y en `KineticsCathedral.tsx`:

```typescript
// @electron-app/src/components/hyperion/kinetics/KineticsCathedral.tsx:76-79
const aggregate = useKineticHydrationStore(s => s.aggregate)
const activePattern    = aggregate.pattern    // PatternType | null
const patternSpeed     = aggregate.speed
const patternAmplitude = aggregate.amplitude
```

**Cuando no hay patrón L2 activo, `aggregate.pattern` es `null` o el último patrón manual que se hidrató.** El VMM automático no tiene forma de escribir en este store.

---

## ¿Por qué los patrones manuales SÍ funcionan?

### Flujo L2 (manual) — COMPLETO:

```
UI click PatternArsenal
  → movementStore.setActivePattern('sweep')
  → KineticsBridge._flushPattern()
  → IPC window.lux.aether.setManualPattern({ pattern: 'sweep', ... })
  → AetherIPCHandlers.ts
  → aetherKineticEngine.setManualKinetics(nodeIds, 'sweep', ...)
  → AetherKineticEngine.tick() escribe pan_base/tilt_base en NodeArbiter L2
  → NodeResolver → AetherUIProjector → hotFrame → UI ✓
  → KineticsBridge._hydrateFromBackend() lee estado L2
  → kineticHydrationStore.setNodeStates() ← UI muestra 'sweep' ✓
```

### Flujo L0 (automático VMM) — FALTA ÚLTIMO PASO:

```
TickEngine.process()
  → KineticAdapter.process()
  → vibeMovementManager.generateIntent('fiesta-latina', audio, ...)
  → VMM scheduler rota patternIndex (figure8 → wave_y → ballyhoo)
  → KineticAdapter emite pan_offset/tilt_offset al IntentBus L0
  → NodeArbiter arbitra y fusiona con base L2 (o 0.5 si no hay manual)
  → NodeResolver resuelve currentPosition.pan/tilt
  → AetherUIProjector proyecta pan/tilt al hotFrame
  → emitHotFrame(fixtureStates) ← pan/tilt físicos llegan ✓
  → transientStore recibe pan/tilt ← movimiento visible ✓
  → ❌ NOMBRE DEL PATRÓN NUNCA VIAJA AL FRONTEND
  → ❌ kineticHydrationStore.aggregate.pattern sigue siendo null/stale
  → UI muestra "--" o patrón manual viejo eternamente
```

---

## Causa raíz (Root Cause)

**Durante la modularización del orquestador (WAVE 3505.4 / WAVE 4592) se diseccionó el pipeline en componentes aislados (TickEngine, NodeArbiter, AetherUIProjector, PhysicsPostProcessor, etc.). Cada pieza hace su trabajo correctamente, pero nadie tiene la responsabilidad de transmitir el *metadato* del patrón activo del VMM desde el engine al frontend.**

El patrón era un campo implícito en el motor monolítico anterior; al separar capas, ese metadato se quedó en el vacío entre L0 y la UI.

---

## Evidencia de código faltante (lo que NO existe)

| Lugar donde debería existir | Estado actual |
|-----------------------------|---------------|
| `MovementIntent` debería propagarse al hotFrame | Solo `pan`/`tilt` viajan |
| `IntentBus.push()` debería soportar metadata de patrón | No soporta strings |
| `ArbitratedNodeMap` debería tener entry `pattern` | Solo canales numéricos |
| `AetherUIProjector.project()` debería inyectar `pattern` a `FixtureState` | No inyecta |
| `TickEngine.emitHotFrame()` debería incluir `pattern` por fixture | Campo ausente |
| `transientStore.injectTransientTruth()` debería aplicar `pattern` | No aplica |
| Debería existir `window.lux.aether.getVmmPattern()` o evento `onVmmPatternChange` | No existe |
| `kineticHydrationStore` debería tener fuente L0 | Solo L2 |

---

## Nota sobre el fix anterior (WAVE 5024-1)

El fix aplicado en `AetherIPCHandlers.ts` (línea 430) corrige un bug relacionado pero **DISTINTO**: el "ghost anchor" L2 que bloquea offsets L0 tras un Unlock cuando el frontend envía `pattern: 'hold'`. Eso resuelve el **congelamiento físico** post-Unlock, pero **NO** resuelve la falta de sincronización del nombre del patrón automático en la UI.

---

## Recomendación de arquitectura para el fix

1. **VMM:** Exponer `getCurrentPattern(vibeId, audio): string` público (sin generar intent completo).
2. **TickEngine:** Cada frame (o con throttle de 1s) comparar `lastVmmPattern !== currentVmmPattern`. Si cambió, emitir evento IPC al renderer.
3. **IPCHandlers:** Escuchar cambio de patrón VMM y enviar `safeWebSend(mainWindow, 'lux:vmm-pattern-change', { pattern, vibeId })`.
4. **Frontend:** Suscribirse a `lux:vmm-pattern-change`, traducir nombre engine→UI, y escribir en `kineticHydrationStore` o `movementStore` para que `PatternArsenal` lo refleje.

Alternativa más ligera: incluir `pattern` como campo opcional en el `hotFrame.fixtures[]` (primera fixture o metadato global) y que `transientStore` lo propague a un nuevo campo en el store.

---

## Referencias clave

- `VibeMovementManager.ts:977-1007` — Scheduler rotation logic
- `KineticAdapter.ts` — L0 intent generation (no pattern metadata)
- `NodeArbiter.ts:775-913` — Fusion logic (numeric only)
- `AetherUIProjector.ts:135-161` — KINETIC projection (no pattern)
- `TickEngine.ts:716-754` — hotFrame emission (no pattern field)
- `transientStore.ts:145-204` — hotFrame ingestion (no pattern)
- `kineticHydrationStore.ts:1-31` — L2-only mirror architecture
- `KineticsCathedral.tsx:76-79` — UI reads from hydration store
