# 🏛️ WAVE 2481 — INFINITE ARSENAL · AUDITORÍA & BLUEPRINT V2

**Versión**: 2.0 (auditoría de WAVE 2480)
**Auditor**: Cascade
**Fecha**: 19 mayo 2026
**Referencia**: `docs/blueprints/WAVE-2480-INFINITE-ARSENAL-BLUEPRINT.md` (abril 2026)

---

## RESUMEN EJECUTIVO

El blueprint WAVE 2480 sigue siendo **conceptualmente válido**: Selene gana arsenal infinito vía `.lfx` con `cognitiveDNA`, el `DynamicEffectRegistry` es zero-alloc, la migración progresiva es factible. Sin embargo, **3 capas críticas del motor de salida mutaron entre abril y mayo 2026**:

1. **`MasterArbiter` → `NodeArbiter` (Aether)**. Merge per-node/per-channel con Smart Gate, MoverShield, Manual Hard Lock, Gimbal Lock fade y **Fusión Aditiva Relativa de pan/tilt** (WAVE 4914/4916).
2. **Consciencia espacial IK (WAVE 4912)**. Fixtures controlados con targets `{x,y,z}`. Un `.lfx` con `pan: 0.7` colisiona con la base IK.
3. **Hephaestus↔Aether ya está conectado**. Existe `HephaestusAetherAdapter` que ingiere `HephFixtureOutput[]` y los emite al slot **L3+ (`hephaestusIntents`)** del NodeArbiter — separado de L3 (`effectIntents`) que ocupa el `EffectManager`. El "Layer 3 unificado" del blueprint v1 ya no existe.

`cognitiveDNA` sigue ausente, `DynamicEffectRegistry` y `SeleneHephBridge` no existen, `EFFECT_DNA_REGISTRY` y `DIVINE_ARSENAL` siguen hardcodeados. El alcance COG-13 **creció**: hay un duplicado de `EFFECTS_BY_VIBE` en `ContextualEffectSelector`.

**Veredicto**: blueprint v1 es **~70% reutilizable**. Las correcciones afectan principalmente: estructura de `cognitiveDNA` (hints espaciales), punto de inyección (L3+ vía adapter existente, NO nueva capa), y delegación explícita de seguridad al `AetherSafetyMiddleware`.

---

# PARTE A — GAP REPORT

## A.1 Divergencias punto-a-punto

| # | Blueprint v1 | Estado Actual | Severidad |
|---|---|---|---|
| 1 | `MasterArbiter` Layer 3 unificado, HTP/LTP simple | `NodeArbiter` capas `system`/`selene`/`playback`/`effect`/`hephaestus`/`manual`/`blackout` con Smart Gate per-channel | 🔴 ALTA |
| 2 | `EffectsEngine` con 13 primitivas DMX | `EffectManager` (`core/effects/EffectManager.ts`) con ~50 efectos en `core/effects/library/{techno,fiestalatina,poprock}/` | 🟡 MEDIA |
| 3 | `EFFECTS_BY_VIBE` solo en `EffectDreamSimulator` (~200 LOC) | **DUPLICADO**: también en `ContextualEffectSelector.ts:893-970`. **Aumenta** el alcance de COG-13 | 🟡 MEDIA |
| 4 | Selene dispara `effectId` → MasterArbiter Layer 3 | Selene escribe `effectDecision` en `ConsciousnessOutput` → `EffectManager` ejecuta → `selene-aether-adapter` traduce a intents L3 | 🟡 MEDIA |
| 5 | HephaestusRuntime opcional, integrado vía Layer 3 igual que EffectsEngine | `HephaestusRuntime` ya existe + `HephaestusAetherAdapter` (`core/aether/adapters/HephaestusAetherAdapter.ts`) inyecta L3+ con prioridad superior a L3 (effects). **El puente ya existe parcialmente** | 🟢 BAJA (favorable) |
| 6 | Layer 3 = última autoridad antes de blackout | `_hephaestusIntents` (L3+) sobrepasa a `_effectIntents` (L3) que sobrepasa a L2 manual. **Manual Hard Lock** post-L3 reaplica overrides del operador en canales no-orbit | 🔴 ALTA |
| 7 | Pan/tilt absoluto en `.lfx` (curva genera DMX directo) | `KineticAdapter` emite `pan_offset`/`tilt_offset` ∈ [-1,+1]; `NodeArbiter._applyRelativeOffsetFusion` suma con base IK. Un `.lfx` escribiendo `pan` absoluto **bypassa** la fusión y rompe convergencia espacial | 🔴 ALTA |
| 8 | Sin consciencia espacial; targets son zonas (`'front'`, `'back'`) | `InverseKinematicsEngine` resuelve `{x,y,z}` → DMX. `_motorKineticOverrides` y `_spatialDistanceScales` viven en NodeArbiter. Los `.lfx` actuales no entienden coordenadas espaciales | 🔴 ALTA |
| 9 | Safety abstracta ("merge rules") | `AetherSafetyMiddleware` con `clampKineticVelocity` (DMX/s rev-limit per-vibe), `applyAirbag` (margen 5 DMX), `darkSpinFilter`, `aduanaGate`. **Defense-in-depth ya operativa** | 🟢 BAJA (favorable) |
| 10 | `cognitiveDNA` en `.lfx v2.0.0` | **Inexistente**. Schema `.lfx` actual (`HephAutomationClipSerialized`) tiene `vibeCompat`, `tags`, `category`, `mixBus`, `priority` pero NO genoma 3D | 🔴 ALTA |
| 11 | `DynamicEffectRegistry` singleton con scan de `/builtin-effects/` y `/user-effects/` | **Inexistente**. `.lfx` se cargan vía `HephFileIO` para el editor, no hay registry global | 🔴 ALTA |
| 12 | `SeleneHephBridge` con dual routing | **Inexistente**. `selene-aether-adapter.ts` consume `effectOutput` directamente. Sin lookup en registry | 🔴 ALTA |
| 13 | `DIVINE_ARSENAL` reemplazado por `Registry.getDivineArsenal(vibe)` | `DIVINE_ARSENAL` y `HEAVY_ARSENAL_EFFECTS` siguen hardcodeados en `DecisionMaker.ts:73-132` | 🟡 MEDIA |
| 14 | `EFFECT_DNA_REGISTRY` reemplazado por `Registry.getDNA()` | Sigue hardcodeado en `EffectDNA.ts:169+` con ~47 entradas | 🟡 MEDIA |
| 15 | Frame budget 5.30ms → 5.66ms (+0.36ms) | Stack actual incluye además: NodeArbiter Smart Gate, IK solve, Safety Middleware. Budget real medido ~6-8ms en peak. Holgura sigue cómoda (deadline 16.67ms) | 🟢 BAJA |

## A.2 Las 3 hipótesis de conflicto del directive — resueltas

### Hipótesis 1: El Genoma (`cognitiveDNA`) y la Consciencia Espacial

**Diagnóstico**: el blueprint v1 asume que las curvas controlan dimmer + colores + pan/tilt absolutos. **No basta hoy**.

El motor moderno expone tres clases de canal con semánticas distintas:

- **Canales escalares HTP** (`dimmer`, `brightness`): el `.lfx` controla absoluto sin colisión.
- **Canales de color** (`r`, `g`, `b`, `white`, `amber`): igual — control absoluto OK, MoverShield protege ruedas físicas.
- **Canales espaciales** (`pan`, `tilt`): **no son absolutos**; son fusión `clamp01(pan_base + pan_offset · amp · aspect · distScale · gimbalFactor)`. Un `.lfx` escribiendo `pan: 0.7` directo **rompe la convergencia IK**.

**Conclusión**: `cognitiveDNA` necesita un campo nuevo `spatialBehavior` que declare cómo el clip se comporta respecto a la base IK:

| `spatialBehavior` | Significado |
|---|---|
| `'static'` | El clip NO toca pan/tilt. Solo dimmer/color. Compatible con cualquier IK. |
| `'orbital'` | El clip emite `pan_offset`/`tilt_offset` ∈ [-1,+1] (NO `pan`/`tilt` absolutos). Se **suma** a la base IK como una órbita relativa al target espacial. |
| `'absolute'` | El clip secuestra pan/tilt absolutos. Solo válido cuando NO hay IK target activo. Si hay IK, el clip queda **silenciado en pan/tilt** (no en color/dimmer). |
| `'spatial'` | El clip emite trayectoria 3D `(targetX, targetY, targetZ)` que el IK resuelve por fixture. Reemplaza la base IK durante el clip. |

### Hipótesis 2: El Routing — ¿pasa por NodeArbiter?

**Diagnóstico**: SÍ, **obligatoriamente**. Y de hecho **ya existe el cableado parcial**:

```
HephaestusRuntime.tick()
  → HephFixtureOutput[]  (DMX scaled, isCustomClip flag)
  → HephaestusAetherAdapter.ingest(outputs, arbiter)
  → arbiter.setHephaestusIntents(intents)  // slot L3+
  → NodeArbiter.arbitrate() merge per-channel
  → NodeResolver → AetherSafetyMiddleware → HAL → DMX
```

El `HephaestusAetherAdapter` solo procesa outputs con `isCustomClip === true` (efectos `heph_custom`). El blueprint v1 hablaba de "secuestro temporal del motor líquido" — eso ya ocurre en el sentido de que L3+ pisa a L0/L1/L2 (manual hard lock excepto canales orbit) per-channel.

**Lo que falta**:
- `SeleneHephBridge` que reciba `ConsciousnessEffectDecision` de Selene, busque el `.lfx` en el `DynamicEffectRegistry`, y dispare `HephaestusRuntime.play(filePath, params)`. El motor de ejecución y el adapter ya existen — el bridge es el orquestador faltante.
- Los `.lfx` de `spatialBehavior: 'orbital'` deben emitir intents en `pan_offset`/`tilt_offset` (NO en `pan`/`tilt`). Esto requiere un nuevo `paramId` en `HephParamId` o un mapeo en el `HephaestusAetherAdapter` que reescriba el canal.

### Hipótesis 3: Físicas y Límites — Safety

**Diagnóstico**: el `AetherSafetyMiddleware` es el escudo final. Aplica:

- `clampKineticVelocity`: límite por-frame en DMX/s (350 DMX/s cap absoluto, rev-limits per-vibe).
- `applyAirbag`: margen mecánico 5 DMX en pan/tilt para evitar rebote contra topes.
- `darkSpinFilter`: blackout durante tránsito de rueda de gobo.
- `aduanaGate`: bloqueo si `outputEnabled === false` o `isVirtual === true`.
- `clamp01` en NodeArbiter (capa 2 de defense-in-depth).
- Resolver clamp 0–255 (capa 3).

**Conclusión**: un `.lfx` salvaje **no puede** romper hardware (velocidad, rebote, blackout) gracias al middleware. Pero **sí puede** producir patrones epilépticos si no respetamos los gates de strobe. La validación adicional necesaria a nivel `.lfx`:

- **Strobe rate cap**: parsear las curvas de `intensity`/`strobe` en ingesta y rechazar `.lfx` cuya frecuencia local pico exceda 4Hz cuando `simMeta.isStrobe === false`. Si `isStrobe === true`, los gates de epilepsia del `VisualConscienceEngine` ya gestionan el filtrado.
- **GPU cost trust-but-verify**: el `gpuCost` declarado en `simMeta` es honor system. Para community untrusted, calcular un `derivedGpuCost` post-ingesta basado en `numCurves × numKeyframes × clipDurationMs` y exigir consistencia ±30%. Si discrepa, log warning y usar el derivado.

## A.3 Hallazgos colaterales (no previstos en blueprint v1)

1. **Doble fuente de verdad para `EFFECTS_BY_VIBE`** — duplicado entre `EffectDreamSimulator.ts:753-953` y `ContextualEffectSelector.ts:893-970`. La WAVE 2481 debe consolidar ambos en el Registry o COG-13 sólo se resolvería a medias.
2. **`EFFECT_ZONE_MAP`** importado por `DecisionMaker` desde `EffectManager.ts` — otra fuente hardcodeada. Debería migrarse al `cognitiveDNA.energyZone`.
3. **`HephAutomationClip.effectType`** acepta tanto `'heph_custom'` como nombres legacy (`'acid_sweep'`, etc.). El `HephaestusAetherAdapter` solo enruta `isCustomClip` (custom). **Para que los 47 efectos legacy migrados funcionen vía Hephaestus, todos deben tener `effectType: 'heph_custom'`**, no su nombre cognitivo. Esto contradice una nota del blueprint v1 §5.1.
4. **`pan_offset`/`tilt_offset` no son `HephParamId`** todavía. Hay que añadirlos al type union (`@/electron-app/src/core/aether/effects/types.ts`) o el adapter debe traducir `pan` → `pan_offset` cuando el clip declara `spatialBehavior: 'orbital'`.

---

# PARTE B — BLUEPRINT V2 MODERNIZADO

## B.1 Esquema `.lfx v2.1.0` corregido

```json
{
  "$schema": "hephaestus/v2.1",
  "version": "2.1.0",
  "clip": {
    "id": "heph-...",
    "name": "Acid Sweep",
    "author": "PunkOpus",
    "category": "composite",
    "tags": ["sweep", "techno"],
    "zones": ["all"],
    "mixBus": "htp",
    "priority": 75,
    "durationMs": 4000,
    "effectType": "heph_custom",
    "curves": {
      "intensity": { ... },
      "pan_offset":  { "range": [-1, 1], "valueType": "number", ... },
      "tilt_offset": { "range": [-1, 1], "valueType": "number", ... },
      "color": { ... }
    },
    "staticParams": {},
    "selector": { ... },

    "cognitiveDNA": {
      "genome": { "aggression": 0.70, "chaos": 0.45, "organicity": 0.25 },
      "textureAffinity": "universal",
      "compatibleVibes": ["techno-club", "techno", "industrial"],
      "validSections": ["drop", "buildup", "chorus", "peak"],
      "energyZone": { "min": "ambient", "max": "peak" },
      "aggressionRange": { "min": 0.25, "max": 1.00 },

      "spatialBehavior": "orbital",
      "ikCompatibility": {
        "respectsTarget": true,
        "orbitAmplitude": 1.0,
        "fallbackOnNoTarget": "static"
      }
    },

    "simulationMeta": {
      "beautyWeights": { "base": 0.75, "energyMultiplier": 1.20, "vibeBonus": 0.15 },
      "gpuCost": 0.25,
      "fatigueImpact": 0.06,
      "minDurationMs": 2000,
      "cooldownMs": 7000,
      "isStrobe": false,
      "isDivineCandidate": false,
      "isHeavyCandidate": false,
      "zScoreGuards": { "requireRising": false, "minimumZ": null, "minimumEnergy": null }
    },

    "executionHints": {
      "overlayMode": "absolute",
      "phaseConfig": { "spread": 0.3, "symmetry": "mirror", "wings": 1, "direction": 1 },
      "intensityScaling": "proportional",
      "fixtureTargeting": "movers"
    },

    "safetyDeclaration": {
      "maxStrobeFreqHz": 0,
      "containsRapidFlash": false,
      "communityTrusted": false
    }
  },
  "checksum": "sha256..."
}
```

### Cambios respecto a v2.0.0 del blueprint v1

| Bloque | Cambio | Justificación |
|---|---|---|
| `curves.pan` / `curves.tilt` | **Sustituidos** por `pan_offset` / `tilt_offset` cuando `spatialBehavior === 'orbital'` | El NodeArbiter espera offsets ∈ [-1,+1] que se suman a la base IK (WAVE 4914) |
| `cognitiveDNA.spatialBehavior` | **NUEVO**: `'static'` / `'orbital'` / `'absolute'` / `'spatial'` | Declara la relación del clip con el motor IK |
| `cognitiveDNA.ikCompatibility` | **NUEVO**: `respectsTarget`, `orbitAmplitude`, `fallbackOnNoTarget` | Permite al `HephaestusAetherAdapter` decidir el routing por frame |
| `safetyDeclaration` | **NUEVO**: declaración auto-firmada de strobe + flag `communityTrusted` | El Registry valida `maxStrobeFreqHz` post-ingesta y rechaza inconsistencias |
| `effectType` | **Restricción**: efectos compatibles con Selene IA deben tener `'heph_custom'` | Solo los `isCustomClip` entran al pipeline L3+ del NodeArbiter |

## B.2 Routing actualizado

```
┌─ Selene DecisionMaker ─┐    ConsciousnessEffectDecision { effectType: 'acid_sweep', intensity, ... }
└────────┬───────────────┘
         ▼
┌─ SeleneHephBridge (NUEVO) ──────────────────────────────────────────┐
│  1. entry = DynamicEffectRegistry.getEntry(effectType)              │
│  2. if !entry.filePath → fallback EffectManager (legacy 13 prim.)   │
│  3. if entry.cognitiveDNA.spatialBehavior === 'absolute'            │
│        AND arbiter.getMotorKineticOverride(nodeId) exists           │
│      → silenciar pan/tilt del clip (mantener intensity/color)       │
│  4. HephaestusRuntime.play(entry.filePath, { intensity, fixtureIds, │
│       overlayMode: entry.execHints.overlayMode })                   │
└────────┬────────────────────────────────────────────────────────────┘
         ▼
┌─ HephaestusRuntime.tick() ──┐  emite HephFixtureOutput[] (DMX scaled)
└────────┬─────────────────────┘
         ▼
┌─ HephaestusAetherAdapter.ingest() ──────────────────────────────────┐
│  • isCustomClip filter                                              │
│  • Translation paramId → channel:                                   │
│      'pan'/'tilt'      (spatialBehavior=absolute)                   │
│      'pan_offset'/'tilt_offset' (spatialBehavior=orbital)           │
│      'targetX/Y/Z'     (spatialBehavior=spatial — futuro)           │
│  • arbiter.setHephaestusIntents(intents)  // L3+                    │
└────────┬────────────────────────────────────────────────────────────┘
         ▼
┌─ NodeArbiter.arbitrate() ───────────────────────────────────────────┐
│  L0 system → L1 selene → LP playback → L3 effect → L3+ hephaestus   │
│  → L2 manual hard lock → relative offset fusion → inhibit limits    │
└────────┬────────────────────────────────────────────────────────────┘
         ▼
┌─ NodeResolver → AetherSafetyMiddleware → HAL → DMX ─────────────────┐
│  velClamp / airbag / darkSpin / aduana                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Decisiones clave**:
- `SeleneHephBridge` es **un módulo nuevo y pequeño** (~150 LOC). NO crea nueva capa. Solo conecta Selene con el HephaestusRuntime existente y filtra por `spatialBehavior` antes de disparar.
- `HephaestusAetherAdapter` necesita un **patch menor** (~50 LOC) para mapear `pan`/`tilt` → `pan_offset`/`tilt_offset` según `spatialBehavior` del clip activo.
- El NodeArbiter **NO se toca**. Sus slots `setHephaestusIntents` y `_applyRelativeOffsetFusion` ya soportan el flujo correctamente.

## B.3 Contrato de seguridad reforzado

| Capa | Mecanismo | Aplicado por |
|---|---|---|
| Pre-ingesta | Schema validation (G1), checksum SHA-256 (G2), DNA range (G3), vibe valid (G4), curve sanity (G5) | `DynamicEffectRegistry.ingest()` |
| Pre-ingesta NUEVO | **G6**: `safetyDeclaration.maxStrobeFreqHz` debe coincidir con análisis de la curva `intensity` ±0.5Hz | Registry validator |
| Pre-ingesta NUEVO | **G7**: si `cognitiveDNA.spatialBehavior === 'orbital'`, las curvas `pan_offset`/`tilt_offset` deben estar en [-1,+1] estricto (no en [0,1]) | Registry validator |
| Runtime per-frame | `clamp01` en NodeArbiter (canales [0,1]) | NodeArbiter |
| Runtime per-frame | Manual Hard Lock — operador humano siempre gana | NodeArbiter |
| Runtime per-frame | Smart Gate — L3+ no escribe canales que L2 manual ya tocó | NodeArbiter |
| Egress | `clampKineticVelocity` (350 DMX/s cap, rev-limit per-vibe) | AetherSafetyMiddleware |
| Egress | `applyAirbag` (5 DMX margen mecánico pan/tilt) | AetherSafetyMiddleware |
| Egress | `darkSpinFilter` blackout durante tránsito de rueda | AetherSafetyMiddleware |
| Egress | `aduanaGate` `outputEnabled` / `isVirtual` | AetherSafetyMiddleware |
| Ético | 7 valores éticos (epilepsy, intensity, diversity, coherence, novelty, ...) | VisualConscienceEngine |
| Ético NUEVO | Para efectos `communityTrusted: false` → epilepsy threshold +50% (modo "untrusted") | VisualConscienceEngine |

**Garantía**: un `.lfx` malicioso que declare `pan_offset: 5.0` en una curva → el clamp01 del NodeArbiter lo recorta a 1.0 → el VelClamp limita la derivada a 350 DMX/s → el Airbag asegura los 5 DMX de margen. Cuatro capas de defensa, ninguna confía en la siguiente.

## B.4 Plan de migración secuencial

### Fase 0 — Preparación (zero breaking changes)

1. Añadir `pan_offset`, `tilt_offset` al type `HephParamId` (`@/electron-app/src/core/aether/effects/types.ts`).
2. Extender `HephAutomationClipSerialized` con campos opcionales: `cognitiveDNA?`, `simulationMeta?`, `executionHints?`, `safetyDeclaration?`.
3. Crear `DynamicEffectRegistry` singleton vacío con API pública.
4. Tests unitarios del Registry (ingesta, validación G1-G7, hot reload atómico).

**Estado final**: el sistema funciona idéntico. Registry existe pero está vacío.

### Fase 1 — SeleneHephBridge

1. Crear `@/electron-app/src/core/aether/SeleneHephBridge.ts`.
2. API: `executeEffect(decision: ConsciousnessEffectDecision): number`.
3. Lookup en Registry → si tiene `.lfx` → `HephaestusRuntime.play()` → si no → `EffectManager.triggerEffect()` (legacy).
4. Conectar el bridge desde `selene-aether-adapter.ts` para que las decisiones de Selene atraviesen el dual routing.
5. Patch al `HephaestusAetherAdapter`: si el clip activo tiene `spatialBehavior: 'orbital'`, mapear `pan` → `pan_offset` y `tilt` → `tilt_offset` antes de emitir el intent.

**Estado final**: dual path operativo. Registry sigue vacío → todos los efectos pasan por el path legacy. Sin regresión.

### Fase 2 — Migración de los ~50 efectos builtin

1. Crear `.lfx v2.1.0` por cada efecto de las librerías `core/effects/library/{techno,fiestalatina,poprock}/`.
2. Cada `.lfx`:
   - `cognitiveDNA.genome` = copia de `EFFECT_DNA_REGISTRY[id]`.
   - `cognitiveDNA.spatialBehavior` decidido por inspección manual (la mayoría serán `'orbital'` o `'static'`).
   - `simulationMeta` = copia de constantes en `EffectDreamSimulator`.
   - `curves` diseñadas en Hephaestus Editor para replicar comportamiento DMX.
3. Colocar en `/builtin-effects/`. Verificar carga por Registry.
4. Activar la rama Hephaestus en `SeleneHephBridge` para los efectos con `.lfx` válido.

**Trabajo crítico**: diseño manual de curvas Bézier por lightjockey, NO por programador.

### Fase 3 — Limpieza COG-13 ampliada

1. Eliminar `EFFECTS_BY_VIBE` de `EffectDreamSimulator.ts:753`.
2. Eliminar `EFFECTS_BY_VIBE` de `ContextualEffectSelector.ts:893` (**duplicado nuevo**).
3. Eliminar `EFFECT_DNA_REGISTRY` de `EffectDNA.ts:169`.
4. Eliminar `DIVINE_ARSENAL` y `HEAVY_ARSENAL_EFFECTS` de `DecisionMaker.ts:73-132`.
5. Eliminar `EFFECT_ZONE_MAP` de `EffectManager.ts` (hallazgo colateral).
6. Tests E2E de regresión: las decisiones de Selene en escenarios canónicos deben ser idénticas pre/post migración.

**Estado final**: ~1100 LOC eliminadas (más que las 850 del blueprint v1, gracias a los duplicados).

### Fase 4 — Editor + Comunidad

1. Panel CognitiveDNA en Hephaestus Editor (cubo 3D, vibes, secciones, sliders).
2. Hot-reload de `/user-effects/` con shadow buffer atómico.
3. Drag-and-drop de `.lfx` en UI.
4. Modo "untrusted": `communityTrusted: false` activa epilepsy threshold +50% en `VisualConscienceEngine`.

### Fase 5 — Optimización (si N > 1000)

- k-d tree 3D sobre coords (A,C,O) para `rankEffects()` → O(log N).
- Per-vibe pre-ranking cache invalidado on hot-reload.

---

## DECISIONES ARQUITECTÓNICAS V2 (delta vs v1)

| # | Decisión V2 | Razón |
|---|---|---|
| D11 | `spatialBehavior` campo obligatorio en `cognitiveDNA` | Sin él, el adapter no sabe si el clip respeta el IK |
| D12 | `pan_offset`/`tilt_offset` como `HephParamId` de primera clase | NodeArbiter ya consume estos canales (WAVE 4914) |
| D13 | `SeleneHephBridge` como módulo nuevo, NO modifica NodeArbiter | El NodeArbiter es estable y crítico — minimizar superficie de cambio |
| D14 | Reusar `HephaestusAetherAdapter` existente (parch menor) | Ya existe el cableado L3+; solo falta routing por `spatialBehavior` |
| D15 | `safetyDeclaration` con `maxStrobeFreqHz` cross-checked | Honor system del blueprint v1 era insuficiente para community |
| D16 | Eliminar `EFFECTS_BY_VIBE` de **dos** archivos (no uno) | Duplicado descubierto en auditoría — alcance COG-13 ampliado |
| D17 | Confiar en `AetherSafetyMiddleware` para hardware safety | Defense-in-depth ya operativa, el Registry NO valida velocidades DMX |

---

## MÉTRICAS DE ÉXITO V2 (delta vs v1)

| Métrica | Blueprint v1 | Blueprint V2 |
|---|---|---|
| LOC hardcodeadas eliminadas | ~850 | **~1100** (incluye `ContextualEffectSelector` + `EFFECT_ZONE_MAP`) |
| Archivos nuevos a crear | 3 (Registry, Bridge, Editor) | **2** (Registry, Bridge — Editor reutiliza panel existente) |
| Archivos a modificar | 4 (DNA, Dream, Decision, EffectsEngine) | **6** (los 4 + ContextualEffectSelector + HephaestusAetherAdapter patch) |
| Frame budget delta | +0.36ms | **+0.40ms** (+0.04ms del lookup `spatialBehavior`) |
| Compatibilidad con IK (WAVE 4912) | ❌ no contemplada | ✅ Nativa vía `spatialBehavior` |
| Compatibilidad con Fusión Relativa (WAVE 4914) | ❌ no contemplada | ✅ Nativa vía `pan_offset`/`tilt_offset` |
| Defense-in-depth contra `.lfx` salvajes | 5 gates + ético | **5 gates + 2 nuevos (G6/G7) + 4 capas runtime + ético untrusted** |

---

## CONCLUSIÓN

El blueprint WAVE 2480 v1 sigue siendo el norte arquitectónico correcto: **`.lfx` como unidad atómica, Registry zero-alloc, dual routing legacy/Hephaestus**. Las correcciones V2 son adaptaciones a la realidad del motor Aether (consciencia espacial + fusión aditiva + Smart Gate) sin tocar la espina dorsal cognitiva (los 15 submotores de Selene siguen mayormente intactos: 10/15 sin cambios).

**Punto fuerte descubierto**: `HephaestusAetherAdapter` ya conecta Hephaestus con NodeArbiter L3+. El "gap de ejecución" del blueprint v1 §5.1 ya está parcialmente cerrado — solo falta el `SeleneHephBridge` que orqueste decisiones cognitivas hacia el runtime.

**Riesgo principal**: la Fase 2 (migración manual de ~50 efectos) requiere lightjockey, no programador. Es trabajo creativo, no técnico, y no puede comprimirse.

**Recomendación operacional**: ejecutar Fase 0 + Fase 1 inmediatamente (~1-2 semanas con Registry + Bridge vacíos en paralelo al sistema actual). Esto valida la arquitectura sin riesgo. La Fase 2 puede irse migrando gradualmente, efecto por efecto, durante meses.

---

*Auditoría WAVE 2481 — La arquitectura de abril sigue siendo correcta; solo necesita actualizar sus mapas a la geografía de mayo.*
