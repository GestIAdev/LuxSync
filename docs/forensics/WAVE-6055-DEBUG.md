# WAVE-6055-DEBUG — GOBO HUNTER & MECHANICS BYPASS FORENSICS

> **Fecha:** 2026-06-13  
> **Rol:** Ingeniero Core — Operación: Gobo Hunter & Mechanics Bypass  
> **Estado:** CRÍTICO — Hallazgos confirmados, bloques de código culpables localizados.

---

## 1. BÚSQUEDA Y DESTRUCCIÓN — AUTOMATISMO DE GOBOS

### 1.1 CULPABLE PRINCIPAL: `BeamAdapter.ts` (Aether L0 — Optic Bridge)

El adaptador óptico del pipeline Aether **automatiza gobos y prismas para TODOS los vibes**, incluyendo `chill-lounge`. No hay guard de vibe ni excepción para chill.

**Archivo:** `electron-app/src/core/aether/adapters/BeamAdapter.ts`

**BLOQUE GOBO (líneas 217–239):**

```typescript@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/adapters/BeamAdapter.ts:217-239
      // ── GOBO — Mechanical Hold Guard ──────────────────────────────────
      let goboValue = 0
      if (node.hasGobo) {
        const lastGoboMs  = this._goboLastChangeMs.get(nodeId)!
        const goboHeld    = (nowMs - lastGoboMs) < GOBO_HOLD_MS
        const currentIdx  = this._currentGoboIndex.get(nodeId)!

        if (!goboHeld && beamExpress > 0.3) {
          // Calcular nuevo índice basado en sectionElapsedMs
          const newIdx = Math.floor(sectionElapsedMs / GOBO_SECTION_INTERVAL_MS) % GOBO_COUNT

          if (newIdx !== currentIdx) {
            // Cambio de gobo permitido — registrar tiempo
            this._goboLastChangeMs.set(nodeId, nowMs)
            this._currentGoboIndex.set(nodeId, newIdx)
            goboValue = newIdx / (GOBO_COUNT - 1)  // Normalizado 0-1
          } else {
            goboValue = currentIdx / (GOBO_COUNT - 1)
          }
        } else {
          // En hold o poca expressiveness — mantener índice actual
          goboValue = currentIdx / (GOBO_COUNT - 1)
        }
      }
```

**Constantes del automatismo:**

| Constante | Valor | Significado |
|---|---|---|
| `GOBO_HOLD_MS` | `2000` | Debounce mecánico entre cambios |
| `GOBO_SECTION_INTERVAL_MS` | `8000` | **Cada 8 segundos de sección musical avanza un índice** |
| `GOBO_COUNT` | `6` | Rueda de 6 gobos (índices 0–5) |
| `PRISM_HOLD_MS` | `1500` | Debounce del prisma |
| `PRISM_EXPRESSIVENESS_THRESHOLD` | `0.6` | Umbral para activar prisma |

**BLOQUE PRISMA (líneas 242–257):**

```typescript@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/adapters/BeamAdapter.ts:242-257
      // ── PRISM — Mechanical Hold Guard ─────────────────────────────────
      let prismValue = 0
      if (node.hasPrism) {
        const lastPrismMs   = this._prismLastChangeMs.get(nodeId)!
        const prismHeld     = (nowMs - lastPrismMs) < PRISM_HOLD_MS
        const isPrismActive = this._prismActive.get(nodeId)!

        if (!prismHeld && wantPrism !== isPrismActive) {
          // Cambio de estado permitido — registrar tiempo
          this._prismLastChangeMs.set(nodeId, nowMs)
          this._prismActive.set(nodeId, wantPrism)
          prismValue = wantPrism ? 1.0 : 0.0
        } else {
          prismValue = isPrismActive ? 1.0 : 0.0
        }
      }
```

**Trigger de prisma (línea 193):**

```typescript@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/adapters/BeamAdapter.ts:193
    const wantPrism = dropImminent && beamExpress >= PRISM_EXPRESSIVENESS_THRESHOLD
```

### 1.2 CULPABLE SECUNDARIO (LEGACY): `EffectsEngine.ts` (`OpticEngine`)

El `OpticEngine` dentro de `EffectsEngine` también automatiza gobos basado en `texture` y `entropy`, pero este path **solo se activa si alguien llama `setOptics()` o `update()` con `texture > 0.1`**.

**Archivo:** `electron-app/src/engine/color/EffectsEngine.ts`

```typescript@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/color/EffectsEngine.ts:596-611
  setTarget(opticsMood: { beamWidth?: number; texture?: number; fragmentation?: number }, entropy = 0): void {
    const { beamWidth = 0.5, texture = 0, fragmentation = 0 } = opticsMood

    this.targetState.zoomValue = beamWidth
    this.targetState.focusValue = 1.0 - beamWidth * 0.3
    this.targetState.prismActive = fragmentation > 0.5

    if (texture < 0.1) {
      this.targetState.goboIndex = 0
    } else {
      const goboCount = Object.keys(this.goboPresets).length - 1
      const selectedGobo = 1 + Math.floor((entropy % 1000) / 1000 * goboCount)
      this.targetState.goboIndex = Math.min(selectedGobo, goboCount)
    }
  }
```

> **Veredicto:** `TitanEngine.calculateEffects()` (línea 1830) solo genera strobos, no gobos. El `EffectsEngine` legacy **no está en el hot-path Aether** desde WAVE 3505. El culpable vivo y activo es `BeamAdapter.ts`.

### 1.3 ¿Dónde NO está el automatismo?

| Archivo | Resultado |
|---|---|
| `LiquidEngineBase.ts` | ✅ Limpio — no toca gobos |
| `LiquidEngine71.ts` | ✅ Limpio — no toca gobos |
| `VibeMovementManager.ts` | ✅ Limpio — no toca gobos |
| `SeleneLux.ts` | ✅ Limpio — no toca gobos |
| `TitanEngine.ts` | ✅ Limpio — `calculateEffects()` solo strobe |

---

## 2. DIAGNÓSTICO DEL MECHANICS BYPASS

### 2.1 Flujo Esperado vs. Flujo Real

```
ESPERADO (WAVE 1046 / WAVE 6055):
┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐
│SeleneLux    │────▶│TitanEngine  │────▶│buildMechanicsBypass │
│deepFieldMech│     │.movement    │     │  mechanicsL/R [0,1]  │
└─────────────┘     └─────────────┘     └─────────────────────┘
                                                  │
                                                  ▼
                                      ┌─────────────────────┐
                                      │  NodeArbiter L0     │
                                      │  pan/tilt channels   │
                                      └─────────────────────┘
                                                  │
                                                  ▼
                                           ┌──────────┐
                                           │  Movers  │
                                           └──────────┘

REAL (WAVE 6055 DEBUG):
┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐
│SeleneLux    │────▶│TitanEngine  │────▶│LightingIntent       │
│deepFieldMech│     │.movement    │     │  .movement ignored!  │
└─────────────┘     └─────────────┘     └─────────────────────┘
                                                  │
                                                  ▼ (NUNCA LEÍDO)
                                      ┌─────────────────────┐
                                      │  TickEngine Aether  │
                                      │  block @ line 779+  │
                                      └─────────────────────┘
                                                  │
                    ┌─────────────────────────────┘
                    ▼
        ┌─────────────────────┐
        │ KineticAdapter.ts   │ ◀── Genera PAN/TILT por su cuenta
        │ LFO de hielo (WAVE  │     (incluye LFO chill propio)
        │ 4845) + VMM offsets │
        └─────────────────────┘
```

### 2.2 Punto de Fractura Confirmado: `TickEngine.ts`

El `LightingIntent` se produce en línea 412, pero **el bloque Aether (línea 779+) nunca accede a `intent.movement`**.

```typescript@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/tick/TickEngine.ts:411-412
    // 3. Engine processes context -> produces LightingIntent
    const intent = await this.engine.update(context, engineAudioMetrics)
```

Dentro del bloque Aether (línea 779+), `intent` se usa solo para:
- `intent.palette` → `FrameContext._v.palette` (línea 831)
- `intent.masterIntensity` → `FrameContext._v.intensity` (línea 833)

**NUNCA** se lee `intent.movement` ni `intent.movement.mechanicsL` / `mechanicsR`.

### 2.3 `KineticAdapter.ts` — El "otro" LFO que compite

Para chill vibe, el `KineticAdapter` tiene su **propio** LFO de hielo (WAVE 4845) que emite `pan_offset` / `tilt_offset` en L0:

```typescript@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/adapters/KineticAdapter.ts:268-284
      if (isChillVibe) {
        // WAVE 4845: Movimiento de hielo — LFO paramétrico ultra-lento + lerp perezoso.
        const tSec = context.nowMs / 1000
        const total = node.stereoTotal > 0 ? node.stereoTotal : 1
        const frac = node.stereoIndex / total
        const phase = frac * TWO_PI + phaseOffset * 0.25
        const targetPan = BaseSystem.clamp01(0.5 + Math.sin((TWO_PI * tSec) / 180 + phase) * 0.15)
        const targetTilt = BaseSystem.clamp01(0.5 + Math.cos((TWO_PI * tSec) / 240 + phase) * 0.10)
        const pan = node.currentPosition.pan + (targetPan - node.currentPosition.pan) * GLACIER_LERP_ALPHA
        const tilt = node.currentPosition.tilt + (targetTilt - node.currentPosition.tilt) * GLACIER_LERP_ALPHA
        // Convertir [0,1] → [-1,+1] (offset relativo centrado en 0).
        this._valuesDict['pan_offset']  = clamp(pan  * 2 - 1, -1, 1)
        this._valuesDict['tilt_offset'] = clamp(tilt * 2 - 1, -1, 1)
        this._valuesDict['speed'] = 0.05
      }
```

Este LFO tiene períodos de **180s (pan)** y **240s (tilt)** — similar a lo que intentamos con WAVE 6055, pero **sin sincronización** con el `ChillAmbientEngine`. Los movers reciben dos señales diferentes que se superponen en el `NodeArbiter`.

### 2.4 `SeleneAetherAdapter` — Movimiento explícitamente descartado

Línea 394 del adaptador L3:

```typescript@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/adapters/selene-aether-adapter.ts:394
      // ❌ override.movement → DESCARTADO (Regla L3: movimiento ≡ KineticAdapter)
```

### 2.5 Formato de Datos del Bypass (CORRECTO, pero inutilizado)

**`buildMechanicsBypassIntent()`** en `MovementGenerators.ts`:

```typescript@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/generators/MovementGenerators.ts:171-198
export function buildMechanicsBypassIntent(
  mechL: { pan: number; tilt: number },
  mechR: { pan: number; tilt: number },
): ProtocolMovementIntent {
  const avgPan  = Math.max(0, Math.min(1, (mechL.pan  + mechR.pan)  / 2))
  const avgTilt = Math.max(0, Math.min(1, (mechL.tilt + mechR.tilt) / 2))

  return {
    pattern: 'CELESTIAL_MOVERS' as ProtocolMovementIntent['pattern'],
    speed: 0.1,
    amplitude: 0.5,
    centerX: avgPan,
    centerY: avgTilt,
    beatSync: false,
    mechanicsL: { pan: Math.max(0, Math.min(1, mechL.pan)),  tilt: Math.max(0, Math.min(1, mechL.tilt))  },
    mechanicsR: { pan: Math.max(0, Math.min(1, mechR.pan)),  tilt: Math.max(0, Math.min(1, mechR.tilt))  },
  }
}
```

- **Entrada:** `pan`/`tilt` en `[0, 1]` normalizado.
- **Salida:** `mechanicsL` / `mechanicsR` con `pan`/`tilt` en `[0, 1]`.
- **El `NodeArbiter` espera:** `pan`/`tilt` en `[0, 1]` o `pan_offset`/`tilt_offset` en `[-1, 1]`.

**El formato es correcto. El problema no es escala ni unidad. El problema es que los datos nunca llegan al pipeline Aether.**

### 2.6 ¿Falta algún flag `overrideL2`?

**No.** No hay ningún flag `overrideL2` que deba activarse. El `NodeArbiter` (WAVE 4829) ya implementa:
- `MANUAL_HARD_LOCK_EXCLUDED_CHANNELS` excluye `pan_base`/`tilt_base` del hard lock.
- La prioridad L0 (10) vs L2 (manual overrides) funciona por secuencia de arbitrate.

El problema es arquitectónico: **el `LightingIntent` no fluye al pipeline Aether**. Los adapters Aether generan sus propios valores sin conocer el bypass.

---

## 3. RECOMENDACIONES DE CORRECCIÓN

### 3.1 GOBO HUNTER — Fulminación Inmediata

**Opción A (Mínima — para show de hoy):**
Añadir guard de vibe en `BeamAdapter.ts::process()` para que **chill-lounge nunca toque gobos ni prismas**:

```typescript
// Al inicio de process():
const isChill = vibe.name === 'chill-lounge' || vibe.name === 'chill'
if (isChill) {
  // Chill = ópticas estáticas. BeamAdapter solo escribe zoom/focus si existen.
  // gobo = 0, prism = 0, gobo_rotation = 0, prism_rotation = 0
}
```

**Opción B (Completa — post-show):**
Añadir configuración per-vibe en `VibeProfile` para `beamExpressiveness` y `allowAutoGobo`. Para chill:
- `beamExpressiveness = 0` (o `< 0.3` para que el guard `beamExpress > 0.3` falle)
- `allowAutoGobo = false`

### 3.2 MECHANICS BYPASS — Reconexión Arquitectónica

**Opción A (Mínima — inyectar en TickEngine):**
En `TickEngine.ts`, entre la línea 412 (`const intent = ...`) y el bloque Aether (línea 779), extraer `intent.movement.mechanicsL` / `mechanicsR` y pasarlos como parámetro adicional a `kineticAdapter.process()` o inyectarlos directamente al `_aetherBus` como `INodeIntent`s con `pan`/`tilt` antes de que el `KineticAdapter` corra.

```typescript
// En TickEngine.ts, antes de kineticAdapter.process():
if (intent.movement?.mechanicsL && intent.movement?.mechanicsR) {
  // Inyectar directamente al bus como INodeIntent para los nodos KINETIC
  // de los movers izquierdo y derecho, con pan/tilt en [0,1]
  // Marcar con source='selene-bypass' y priority=5 (entre L0=10 y manual L2)
}
```

**Opción B (Completa — modificar KineticAdapter):**
Modificar `KineticAdapter.ts` para que:
1. Acepte un campo `mechanicsBypass` en `FrameContext` (o lea de un side-channel global seguro para 44Hz).
2. Si `mechanicsBypass` está presente y el vibe es chill, **emitir `pan`/`tilt` directos en lugar de `pan_offset`/`tilt_offset`**.
3. Si no hay bypass, fallback al VMM/LFO de hielo actual.

Esto elimina la doble señal y permite que `ChillAmbientEngine` sea la fuente única de verdad para movers en chill.

---

## 4. RESUMEN EJECUTIVO

| Hallazgo | Severidad | Ubicación | Fix Sugerido |
|---|---|---|---|
| Gobo automático cada 8s | **CRÍTICO** | `BeamAdapter.ts:217-239` | Guard `isChill` → skip gobo/prisma |
| Prisma automático en drop | **CRÍTICO** | `BeamAdapter.ts:242-257` | Guard `isChill` → skip gobo/prisma |
| Mechanics bypass ignorado | **CRÍTICO** | `TickEngine.ts` + `KineticAdapter.ts` | Inyectar `intent.movement` al bus Aether |
| LFO de hielo competidor | **ALTO** | `KineticAdapter.ts:268-284` | Reemplazar por bypass de ChillAmbientEngine |

---

*Reporte generado para WAVE 6055 — Operación Océano.*
*Siguiente paso: decidir entre fix mínimo (guard de vibe) o refactor arquitectónico (inyección de mechanics al Aether bus).*
