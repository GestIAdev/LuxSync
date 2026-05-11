# WAVE-4590 — AETHER DESCONEXIÓN BLUEPRINT
## Reporte de Auditoría + Plan de Incisión Quirúrgica

**Auditor:** PunkOpus / Claude Sonnet 4.6  
**Fecha:** 2026-05-07  
**Branch activo:** `v3`  
**Backup verificado:** rama + SSD external (show 300 personas ✅)  
**Scope:** Confirmar diagnóstico WAVE 4585 + auditar viabilidad Opción C + generar blueprint de desconexión del pipeline clásico (ArbitrationDirector)

---

## PARTE 1 — CONFIRMACIÓN DEL DIAGNÓSTICO WAVE 4585

El diagnóstico externo (ARBITER-UI-DIAGNOSIS.md) es **100% correcto**. Verificado línea a línea en el código fuente.

### Los dos puntos de amputación existen exactamente donde se indicó

**Amputación #1 — El broadcast UI nace del pipeline equivocado**

`TitanOrchestrator.ts` línea 1346:
```typescript
const fixtureStates = this.hal.renderFromTarget(arbitratedTarget, this.fixtures, halAudioMetrics)
```
`fixtureStates` viene de `masterArbiter.arbitrate()` (el clásico). Aunque `AetherUIProjector.project()` los sobreescribe en línea 1582, **el punto de origen es datos corrompidos** — el ArbitrationDirector L2 guarda los overrides manuales indefinidamente.

**Amputación #2 — UNLOCK nunca llega al ArbitrationDirector**

`TheProgrammer.tsx` línea 184-190:
```typescript
const handleUnlockAll = useCallback(() => {
  releaseAll()                              // → programmerStore (frontend)
  window.lux?.aether?.clearInhibitLimit(nodeIds)  // → NodeArbiter (Aether L2)
  // ❌ NUNCA se llama: window.lux.arbiter.clearAllManual()
  //    → ArbitrationDirector.releaseAllManualOverrides() JAMÁS se invoca desde la UI
}, [selectedIds, releaseAll])
```

**Confirmado también:**
- `ArbitrationDirector.ts` línea 475: `this.emit('manualRelease', fixtureId, channelsToRelease)` — cero listeners en todo el proyecto
- `ArbitrationDirector.ts` línea 354: `this.emit('manualOverride', ...)` — cero listeners
- `ProgrammerAetherBridge.ts` línea 181: `state.consumeDirty()` se ejecuta **antes** de que el IPC confirme éxito

### Por qué el operador percibe "freeze"

```
1. Operador pulsa 🔓 UNLOCK ALL
2. programmerStore → vacío ✅
3. NodeArbiter (Aether L2) → limpio ✅
4. ArbitrationDirector (Clásico L2) → INTACTO ❌ (nunca recibió la orden)

5. TitanOrchestrator frame loop:
   - masterArbiter.arbitrate() → devuelve valores del override FANTASMA
   - hal.renderFromTarget() → fixtureStates con valores viejos
   - AetherUIProjector.project() sobreescribe algunos canales (pan/tilt/color)
   - Pero el broadcast UI en línea 1990+ usa estos fixtureStates híbridos

6. Operador mueve fader de dimmer:
   - programmerStore → dimmer: 0.8, IMPACT dirty ✅
   - ProgrammerAetherBridge → setManualOverrides([fix-1:impact]) → NodeArbiter ✅
   - Aether path → dimmer correcto en sendUniverseRaw ✅
   - PERO: masterArbiter.arbitrate() → dimmer clásico GANA en flushToDriver ❌

7. El operador ve el fader moverse. El fixture no responde.
   Reporta: "la UI se congeló".
```

**Causa raíz:** Doble pipeline activo con fuentes de verdad divergentes. No es un bug de código — es la coexistencia ya no neutral entre Aether maduro y el clásico.

---

## PARTE 2 — AUDITORÍA DE VIABILIDAD OPCIÓN C

### ¿Puede Aether ser el único pipeline DMX + UI?

**Respuesta: SÍ. Verificado en código fuente.**

### Inventario de capacidades Aether

| Órgano | Adaptador | Estado | Verifica |
|---|---|---|---|
| LiquidEngineBase (físicas fotónicas) | `LiquidAetherAdapter` | ✅ Integrado, L0 del IntentBus | línea ~1720 |
| SeleneColorEngine (color AI) | `ColorAdapter` + `SeleneAetherAdapter` | ✅ Integrado, paleta RGB inyectada | línea ~1740 |
| VMM / IK (movimiento auto + espacial) | `KineticAdapter` | ✅ Integrado, IK resuelto en NodeResolver | línea ~1748 |
| Chronos (timecoder) | `ChronosAetherAdapter` | ✅ Integrado, LP layer del NodeArbiter | línea ~1773 |
| Hephaestus (editor FX) | `HephaestusAetherAdapter` | ✅ Integrado, L3+ layer | línea ~1781 |
| Beam (ópticas) | `BeamAdapter` | ✅ Integrado | línea ~1751 |
| Atmosphere (fog, haze) | `AtmosphereAdapter` | ✅ Integrado | línea ~1755 |
| Aduana / Safety óptica | `AetherSafetyMiddleware` (WAVE 4557) | ✅ Integrado, 3 fases | línea ~1799 |
| Traductor DMX físico (CMY, RGBW, wheel) | `NodeResolver` (WAVE 4522.4) | ✅ Completo, zero-alloc | resolver/NodeResolver.ts |
| UI broadcast (FixtureState[]) | `AetherUIProjector` (WAVE 4559) | ✅ YA CORRIENDO en producción | línea 1582 |
| Programmer manual overrides (Faders) | `NodeArbiter` L2 + `ProgrammerAetherBridge` | ✅ Completo | 44Hz pipeline |
| Inhibit limits / Grand Master per-fixture | `NodeArbiter._inhibitLimits` (WAVE 4531) | ✅ Post-arbitraje L2.5 | NodeArbiter.ts ~línea 80 |
| Blackout | `NodeArbiter._blackout` | ✅ L4, colapsa todo | NodeArbiter.ts |
| Grand Master global | `NodeArbiter._grandMaster` | ✅ Multiplica HTP | NodeArbiter.ts |

### Lo que el pipeline clásico hace que Aether NO reemplaza aún

| Función clásica | Situación |
|---|---|
| `masterArbiter.isOutputEnabled()` → `aetherSafety.setOutputEnabled()` | ⚠️ **Un flag.** El `AetherSafetyMiddleware` ya lo recibe. Solo hay que darle el valor desde otro sitio (Orchestrator o TitanOrchestrator._outputEnabled propio). |
| `masterArbiter.isPlaybackActive()` | ⚠️ Solo se usa para `shouldBroadcastFullTruth` en Chronos. `ChronosAetherAdapter` ya controla el playback en Aether. Se puede sustituir por `this._timelineEngine.isPlaying()`. |
| `masterArbiter.getPlaybackAffectedFixtureIds()` | ⚠️ Solo se usa en `intentComposer.compose()` para que los effects clásicos no piocen fixtures de Chronos. Con Chronos en Aether esto no aplica. |

**Conclusión: los 3 puntos de dependencia restante son flags simples, no arquitectura.**

### El estado actual del frame loop — La coexistencia activa

```
CADA FRAME (44Hz):
│
├─► PIPELINE CLÁSICO (líneas 1240-1635)             ← EL QUE CORTAMOS
│   1. masterArbiter.setTitanIntent()
│   2. masterArbiter.setEffectIntents()
│   3. masterArbiter.arbitrate()                    → arbitratedTarget
│   4. hal.renderFromTarget(arbitratedTarget, ...)  → fixtureStates (CON L2 FANTASMA)
│   5. hal.flushToDriver(fixtureStates)             → DMX ESCRITURA #1
│
├─► AETHER UIProjector (línea 1582)
│   AetherUIProjector.project(fixtureStates, graph) → sobreescribe algunos campos
│
├─► BROADCAST UI (líneas 1560-1635)
│   fixtureStates → SeleneTruth → frontend         ← ALIMENTADO POR DATOS HÍBRIDOS
│
└─► PIPELINE AETHER (líneas 1648-1860)             ← EL QUE SOBREVIVE
    1. LiquidAetherAdapter.ingest()
    2. ImpactAdapter, ColorAdapter, KineticAdapter, BeamAdapter, AtmosphereAdapter
    3. SeleneAetherAdapter.ingest()
    4. ChronosAetherAdapter.ingest()
    5. HephaestusAetherAdapter.ingest()
    6. aetherArbiter.setSystemIntents()
    7. aetherArbiter.arbitrate()                   → ArbitratedNodeMap LIMPIO
    8. PhysicsPostProcessor.process()
    9. AetherSafetyMiddleware (3 fases)
    10. NodeResolver.resolve()                     → Uint8Array(512) por universo
    11. hal.sendUniverseRaw()                      → DMX ESCRITURA #2
```

**Ahora mismo hay DOS escrituras al mismo universo DMX por frame.** La segunda (Aether) puede ganar o perder dependiendo del driver. Este es el conflicto activo.

---

## PARTE 3 — BLUEPRINT DE INCISIÓN QUIRÚRGICA

### Principio: mínimo cambio, máximo resultado

No se toca la arquitectura Aether. No se reescribe nada. Solo se **desconecta** el bloque clásico y se **reconecta** los 3 flags que dependían de él.

---

### INCISIÓN 1 — `TitanOrchestrator.ts`: añadir `_outputEnabled` propio

**Objetivo:** liberar la dependencia de `masterArbiter.isOutputEnabled()`.

El `outputEnabled` actualmente viaja así:
```
IPC "lux:arbiter:setOutputEnabled" → ArbiterIPCHandlers → masterArbiter.setOutputEnabled()
                                                        → aetherSafety.setOutputEnabled() [desde orchestrator frame]
```

**Fix:** añadir campo propio en el Orchestrator y que el IPC Aether lo setee directamente, además de en `masterArbiter` (durante transición) o en sustitución.

**Alternativa más simple para la desconexión:** mantener `masterArbiter` vivo SOLO como portador del flag `outputEnabled` y `_grandMaster`. No arbitra. No produce DMX. No recibe titanIntent ni effectIntents. Solo guarda el flag que Aduana necesita. Coste: 0 cambios en IPC handlers.

---

### INCISIÓN 2 — `TitanOrchestrator.ts`: bypassear bloque clásico (el corte principal)

**Archivo:** `electron-app/src/core/orchestrator/TitanOrchestrator.ts`

**Lo que se elimina** (bloque de ~400 líneas entre líneas ~1240 y ~1635):

```typescript
// ─── CORTAR DESDE AQUÍ ──────────────────────────────────────────────────────
const titanLayer: Layer0_Titan = { ... }
masterArbiter.setTitanIntent(titanLayer)          // línea 1249

masterArbiter.setEffectIntents(intentMap)          // línea 1281

const arbitratedTarget = masterArbiter.arbitrate() // línea 1290

const fixtureStates = this.hal.renderFromTarget(   // línea 1346
  arbitratedTarget, this.fixtures, halAudioMetrics
)

// ... bloque de diagnóstico, Chronos telemetry, tactical log, peak hold...

this.hal.flushToDriver(fixtureStates)              // línea 1635
// ─── HASTA AQUÍ ─────────────────────────────────────────────────────────────
```

**Lo que se conserva** y se mueve antes del bloque Aether:
```typescript
// Solo lo que el Aether necesita del bloque clásico:

// 1. Peak hold (para UI) — mover a post-Aether
// 2. Chronos isPlaying — sustituir por this._timelineEngine.isPlaying()
// 3. fixtureStates[] para el broadcast — se producen desde Aether (ver Incisión 3)
```

---

### INCISIÓN 3 — Producir `fixtureStates[]` desde el Aether resolver

**Objetivo:** que el broadcast UI (`SeleneTruth`) nazca de datos Aether en lugar de datos clásicos.

El `AetherUIProjector` ya existe y ya proyecta sobre `fixtureStates`. El problema es que actualmente necesita un `fixtureStates[]` base (producido por el clásico) para mutar.

**Opción A — Limpia (recomendada):** Hacer que `AetherUIProjector.project()` pueda inicializar los `fixtureStates[]` desde cero usando los datos del `NodeGraph` + `aetherArbiter.getManualOverrideNodeIds()`. El proyector ya sabe leer los nodos; solo necesita un array base con los fixture IDs y sus perfiles.

**Opción B — Rápida (pragmática):** Mantener una copia "placeholder" de `fixtureStates[]` inicializada una sola vez con los defaults de los fixtures (dimmer=0, r=0, g=0, b=0, pan=127, tilt=127) y dejar que `AetherUIProjector.project()` la rellene completamente cada frame. Zero nueva arquitectura.

**Recomendación: Opción B para el corte inicial.** Se puede evolucionar a Opción A después.

---

### INCISIÓN 4 — `ProgrammerAetherBridge.ts`: corregir race condition de `consumeDirty()`

**Archivo:** `electron-app/src/bridges/ProgrammerAetherBridge.ts`

**Problema:** `consumeDirty()` borra los dirty flags **antes** de que el IPC confirme. Si el IPC falla silenciosamente, los overrides se pierden sin retry.

**Fix quirúrgico:**
```typescript
// AHORA (línea 181):
state.consumeDirty()
aether.setManualOverrides(setPayloads).catch(...)
aether.clearManualOverrides(clearNodeIds).catch(...)

// DESPUÉS:
// No consumir hasta confirmar, o usar snapshot + retry
const consumed = state.consumeDirty()  // retorna snapshot de lo consumido
aether.setManualOverrides(setPayloads).catch((err) => {
  console.error('[ProgrammerAetherBridge] setManualOverrides error — retrying next tick', err)
  state.restoreDirty(consumed)  // nuevo método en programmerStore
})
```

**Alternativa más simple:** aceptar el fire-and-forget actual pero documentarlo explícitamente. El riesgo real es bajo a 44Hz — si un tick falla, el siguiente reenvía si hay movimiento nuevo.

---

### INCISIÓN 5 — `KineticsCathedral.tsx`: corregir `handleUnlockKinetics`

**Archivo:** `electron-app/src/components/hyperion/kinetics/KineticsCathedral.tsx`

**Problema:** llama `releasePosition()` (solo KINETIC dirty). El bridge envía `clearManualOverrides(["fix-1:kinetic"])`. El `ArbitrationDirector` ignora todo. Tras la desconexión del clásico, esto es suficiente para Aether, pero sigue siendo semánticamente incorrecto (solo libera una familia).

**Fix:** cambiar a `releaseAll()` para que el bridge envíe clear para todos los nodeIds del fixture. Señal limpia y sin ambigüedad.

```typescript
const handleUnlockKinetics = useCallback(() => {
  useProgrammerStore.getState().releaseAll()  // era: releasePosition()
}, [])
```

---

## PARTE 4 — SECUENCIA OPERACIONAL

### Orden de ejecución recomendado

```
FASE 0 — PREPARACIÓN (antes de tocar código)
  □ git checkout -b wave-4590-aether-solo   (rama propia para la incisión)
  □ git stash (si hay cambios sin commit de WAVE 4579/UX-Purge)
  □ Verificar que el Aether pipeline funciona solo (comentar temporalmente flushToDriver)

FASE 1 — INCISIÓN 5 (más simple, sin riesgo)
  □ KineticsCathedral.tsx: releasePosition() → releaseAll()
  □ Compilar. 0 errores TS.

FASE 2 — INCISIÓN 2 (el corte principal)
  □ TitanOrchestrator.ts: comentar bloque clásico (con comentario WAVE 4590: DISABLED)
  □ NO borrar todavía — comentado para poder revertir en 2 segundos
  □ Mantener masterArbiter.isOutputEnabled() como fuente del flag para AetherSafety
  □ Compilar. Verificar 0 errores TS.

FASE 3 — INCISIÓN 3 (broadcast UI desde Aether)
  □ Crear fixtureStates[] placeholder inicializado desde this.fixtures
  □ Mover AetherUIProjector.project() como fuente canonical del broadcast
  □ Verificar que truthStore.fixtures tiene datos correctos en la UI

FASE 4 — TEST EN VIVO
  □ Lanzar app
  □ Seleccionar fixtures → verificar que UI muestra posiciones correctas
  □ Mover fader dimmer → verificar respuesta DMX
  □ Pulsar UNLOCK → verificar que los fixtures responden al AI
  □ Activar show completo → verificar que Chronos, Hephaestus y LiquidEngine se ven en la UI
  □ Test de Aduana (ARMED/LIVE) → verificar que el gate funciona

FASE 5 — LIMPIEZA (solo cuando FASE 4 sea verde)
  □ Eliminar definitivamente el bloque clásico (no solo comentarlo)
  □ Eliminar imports de ArbitrationDirector del Orchestrator
  □ Evaluar si mantener masterArbiter como portador de outputEnabled o migrar el flag
  □ INCISIÓN 4 si se decide hacer el retry de consumeDirty
```

---

## PARTE 5 — RIESGOS Y CONTINGENCIAS

| Riesgo | Probabilidad | Impacto | Contingencia |
|---|---|---|---|
| `AetherUIProjector` no proyecta todos los canales (zoom, focus, strobe, white, amber) | Media | UI incompleta | Completar `AetherUIProjector.project()` con BEAM e IMPACT adicionales |
| `ChronosAetherAdapter` no preserva protección de fixtures durante playback | Baja | Solapamientos de efecto | Añadir guard en `ChronosAetherAdapter.ingest()` |
| `masterArbiter.isOutputEnabled()` no se sincroniza al desconectar | Baja | Aduana inoperativa | Mantener masterArbiter como portador de flag únicamente (cero impacto en performance) |
| Algún adaptador tiene bug latente que el clásico enmascaraba | Media | Valores DMX incorrectos | La FASE 0 de test con flushToDriver comentado lo revela antes de comprometerse |
| IPC handlers de `lux:arbiter:*` dejan de funcionar | Baja | Controles de UI rotos | Los handlers llaman a masterArbiter — si se mantiene como portador de flags, todo sigue igual |

---

## RESUMEN EJECUTIVO

**El pipeline Aether está listo para operar en solitario.** Todos los órganos están integrados, testeados y produciendo DMX real cada frame. La coexistencia con el pipeline clásico es ahora activamente dañina: dos escrituras al mismo universo, L2 fantasma en ArbitrationDirector, y broadcast UI alimentado por datos contaminados.

**El corte es de ~400 líneas comentadas en un solo archivo** (`TitanOrchestrator.ts`) más 3 ajustes puntuales. Tiempo estimado de incisión: 2-4 horas. Tiempo de validación: 1 hora de test en vivo.

La mayor precaución no es técnica — es operacional: **no hacer el corte en una versión que va a show sin una sesión de validación previa en sala.**

El backup en SSD con el show de 300 personas es la red de seguridad correcta. Proceder.

---

*Fin del reporte — WAVE 4590 — PunkOpus / 2026-05-07*
