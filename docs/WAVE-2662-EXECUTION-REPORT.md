# WAVE 2662 — EL ÁRBITRO ABSOLUTO (SINGLE SOURCE OF TRUTH)
## Execution Report

**Status:** ✅ COMPLETADO  
**TypeScript Compilation:** ✅ CLEAN (0 errors)  
**Archivos modificados:** 4  
**Líneas eliminadas:** ~500  
**Líneas añadidas:** ~200  

---

## 📐 ARQUITECTURA ANTES vs DESPUÉS

### ANTES (el fantasma):
```
Brain → Engine → Arbiter → HAL.renderFromTarget() → DMX
                                    ↓
                           EffectManager muta fixtureStates POST-HAL
                                    ↓
                           UI Hot Frame (datos mutados = fantasma)
                           DMX (NO re-envía sin Hephaestus = silencio)
```
**Problema:** EffectManager modificaba `fixtureStates` DESPUÉS de que HAL ya había enviado al DMX. La UI leía los datos mutados (fantasma visible), pero el hardware nunca recibía la actualización (fantasma invisible).

### DESPUÉS (WAVE 2662):
```
Brain → Engine → EffectManager.getCombinedOutput()
                        ↓
              Zone Resolution → EffectIntentMap (per-fixture)
                        ↓
              MasterArbiter.setEffectIntents(intentMap)
                        ↓
              MasterArbiter.arbitrate() ← Layer 3 ahora incluye EffectIntents
                        ↓
              HAL.renderFromTarget() → DMX (COMPLETO, con efectos incluidos)
                        ↓
              UI Hot Frame (mismos datos que DMX = verdad única)
```
**Solución:** Los efectos entran como Layer 3 inputs ANTES del arbitraje. El `FinalLightingTarget` que sale del arbiter YA contiene las contribuciones de efectos. HAL envía datos completos. UI y DMX leen la misma verdad.

---

## 📦 ARCHIVOS MODIFICADOS

### 1. `arbiter/types.ts`
- **EffectIntent** (nueva interfaz): dimmer, color (RGBOutput), white, amber, movement, mixBus, globalComposition
- **EffectIntentMap** (nuevo tipo): `Map<string, EffectIntent>`
- **_layerActivity**: añadido `effectIntentCount?: number`

### 2. `arbiter/index.ts`
- Exporta `EffectIntent` y `EffectIntentMap`

### 3. `arbiter/MasterArbiter.ts`
**Campo nuevo:**
- `layer3_effectIntents: EffectIntentMap` — almacén efímero (cleared cada frame)

**Método nuevo:**
- `setEffectIntents(intents)` — inyección pre-arbitraje

**Método nuevo (privado):**
- `getIntentValueForChannel(intent, channel)` — mapea EffectIntent → valor por canal

**`mergeChannelForFixture()` modificado:**
- Bloque WAVE 2662 insertado DESPUÉS de Manual Override y ANTES de legacy `getEffectValueForChannel()`
- `mixBus='global'` → LERP (alpha blending con base Titan)
- `mixBus='htp'` → HTP para dimmer, LTP para color
- Return directo cuando intent aplica

**`arbitrateFixture()` modificado:**
- Después de `getAdjustedPosition()`: overlay de movement intents
- Variables `effectAdjustedPan/Tilt` reemplazan `rawPan/rawTilt` en release fade
- VIP PASSPORT: `movementFromEffect` como source `ControlLayer.EFFECTS`

**`arbitrate()` modificado:**
- `effectIntentCount` añadido a `_layerActivity`
- `layer3_effectIntents.clear()` después de construir output (frame freshness)

### 4. `orchestrator/TitanOrchestrator.ts`
**BLOQUE AÑADIDO (~160 líneas) — ANTES de `masterArbiter.arbitrate()`:**
- Llama `effectManager.getCombinedOutput()` (movido de post-HAL)
- Obtiene `chronosFixtureIds` para protección Chronos
- Si `hasActiveEffects`: construye `EffectIntentMap`
  - **Path zoneOverrides:** itera zones activas → `getFixtureIdsByZone()` → HSL→RGB, dimmer 0-1→0-255, white/amber con Iron Curtain, movement conversion, HTP merge multi-zone
  - **Path brocha gorda:** sin zones pero con dimmerOverride → fixtures por match stereo
  - **Path movement global:** movers sin movement zone-specific
- Llama `masterArbiter.setEffectIntents(intentMap)`
- Telemetry throttled cada 60 frames

**BLOQUE ELIMINADO (~500 líneas) — Post-HAL mutation:**
- ❌ Zone overrides processing (WAVE 725/740/780/800/991/993)
- ❌ Brocha gorda legacy (WAVE 635/692/700)
- ❌ Stereo movement (WAVE 930.2)
- ❌ Movement override (WAVE 700.7)
- ❌ Duplicate `chronosFixtureIds`/`isChronosPlaying` declarations
- ❌ Duplicate `effectManager`/`effectOutput` declarations
- ❌ Toda mutación directa de `fixtureStates` por effectos

**PRESERVADO:**
- ✅ Hephaestus merge (sistema separado con `sendStatesWithPhysics()`)
- ✅ Tactical logging
- ✅ Hot Frame broadcast
- ✅ Full Truth broadcast

---

## 🧬 DISEÑO DE EffectIntent

```typescript
interface EffectIntent {
  dimmer?: number          // 0-255
  color?: RGBOutput        // {r, g, b} 0-255
  white?: number           // 0-255
  amber?: number           // 0-255
  movement?: {
    pan?: number           // 0-255
    tilt?: number          // 0-255
    isAbsolute?: boolean
  }
  mixBus: 'htp' | 'global'
  globalComposition: number  // 0-1
}

type EffectIntentMap = Map<string, EffectIntent>
```

**Decisiones de diseño:**
1. **Pre-resolved:** Zones se resuelven a fixture IDs concretos en el Orchestrator, NO en el Arbiter
2. **DMX-ready values:** Todas las conversiones (HSL→RGB, 0-1→0-255) ocurren ANTES de inyectar
3. **Efímero:** El map se limpia después de cada `arbitrate()` — frame freshness garantizado
4. **HTP merge:** Si un fixture pertenece a múltiples zones, dimmer = max, color = LTP

---

## 🔒 PROTECCIONES MANTENIDAS

| Protección | Status | Ubicación |
|---|---|---|
| Chronos Gate | ✅ | Orchestrator: skip fixture si `chronosFixtureIds.has()` |
| Iron Curtain (WAVE 993) | ✅ | Orchestrator: white=0, amber=0 bajo global bus sin override |
| Manual Override (Layer 2) | ✅ | MasterArbiter: return directo antes de Layer 3 |
| VIP PASSPORT | ✅ | MasterArbiter: `movementFromEffect` registrado como source |
| DMX Aduana | ✅ | HAL: per-channel gate sin cambios |
| Hephaestus | ✅ | Sistema separado, post-HAL con re-send propio |
| License Tier Gate | ✅ | Hephaestus block: DJ_FOUNDER filter sin cambios |

---

## 🎯 ENTREGABLES CUMPLIDOS

### Entregable 1: EffectManager deja de mutar fixtureStates post-arbitraje
**✅ COMPLETADO** — El bloque de ~500 líneas que mutaba `fixtureStates` después de `HAL.renderFromTarget()` ha sido eliminado por completo. `getCombinedOutput()` sigue siendo pure functional — nunca mutó nada, solo producía datos. Ahora esos datos se consumen ANTES del arbitraje.

### Entregable 2: MasterArbiter consume EffectIntents como Layer 3
**✅ COMPLETADO** — `setEffectIntents()` recibe el `EffectIntentMap`. `mergeChannelForFixture()` consulta intents como fuente Layer 3 primaria. `arbitrateFixture()` aplica movement intents. Todo el merge respeta la jerarquía de 5 capas.

### Entregable 3: Tick loop unidireccional limpio
**✅ COMPLETADO** — El flujo es ahora:
```
Brain.tick() → Engine.update() → EffectManager.getCombinedOutput()
  → Zone Resolution → EffectIntentMap
  → MasterArbiter.setEffectIntents()
  → MasterArbiter.arbitrate()
  → HAL.renderFromTarget()
  → [Hephaestus post-merge con re-send propio]
  → Hot Frame broadcast
  → Full Truth broadcast
```
Cascada unidireccional. Sin backflows. Sin mutaciones post-HAL de efectos.

---

## ⚠️ NOTAS

- **EffectManager.ts:** Sin cambios. Ya era pure functional. `getCombinedOutput()` produce datos, no muta estado.
- **HardwareAbstraction.ts:** Sin cambios. `renderFromTarget()` recibe targets completos. La Aduana DMX opera igual.
- **Legacy `getEffectValueForChannel()`:** Preservado en MasterArbiter para strobe/blinder/flash/freeze effects (Layer 3 legacy). Los EffectIntents tienen prioridad y hacen return antes de llegar al legacy path.

---

*WAVE 2662 — El fantasma ha muerto. La verdad es una sola.*
