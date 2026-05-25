# WAVE-4842 — IMPEDANCE MISMATCH REPORT
## Auditoría Estática: `.lfx v2.1` Schema vs. Selene Brain Real

**Autor:** PunkOpus  
**Scope:** Solo lectura. Cero cambios de código.  
**Archivos auditados:**
- `electron-app/src/core/arsenal/lfxTypes.ts`
- `electron-app/src/core/arsenal/DynamicEffectRegistry.ts`
- `electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts`
- `electron-app/src/core/intelligence/think/DecisionMaker.ts`
- `electron-app/src/core/intelligence/conscience/VisualEthicalValues.ts`
- `electron-app/src/core/aether/adapters/HephaestusAetherAdapter.ts`
- `electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts`
- Los 49 `.lfx` files en `src/core/arsenal/builtins/` (patched en WAVE 4829)

---

## RESUMEN EJECUTIVO

Se encontraron **13 mismatches** entre el schema `.lfx v2.1` y lo que los subsistemas de Selene realmente leen en runtime. De estos:

| Categoría | Cantidad | Impacto |
|---|---|---|
| Campos **muertos** (escritos, no leídos) | 5 | Metadata que no influencia ninguna decisión |
| Campos con **desacoplamiento** schema/consumer | 4 | El campo existe y se lee, pero el patrón de lectura no coincide con la semántica declarada |
| Bugs **ya resueltos** (histórico) | 2 | Documentado para trazabilidad |
| **Violaciones Axioma** Anti-Simulación | 1 | `Math.random()` en VisualEthicalValues |
| Correcto y funcional | 1 | gpuCost / fatigueImpact post-WAVE 4829 |

---

## ÁREA 1: Zone/Energy Evaluation — Hunt Block

### M1 ❌ `cognitiveDNA.energyZone` — CAMPO MUERTO

**Schema `.lfx`:**
```json
"cognitiveDNA": {
  "energyZone": { "min": "peak", "max": "peak" }
}
```
El tipo es `EnergyZoneRange: { min: EnergyZone, max: EnergyZone }` donde `EnergyZone` es el literal string del termómetro Selene (`'silence' | 'valley' | 'ambient' | 'gentle' | 'active' | 'intense' | 'peak'`).

**Lo que Selene realmente hace:**

`DynamicEffectRegistry._buildEntry()` copia el campo a `entry.energyZone` y lo congela. Hasta ahí bien. Pero `EffectDreamSimulator.filterByZone()` **no lee `entry.energyZone`**. El código real:

```typescript
// EffectDreamSimulator.ts ≈ línea 510
const aggressionLimits: Record<string, { min: number; max: number }> = {
  'silence': { min: 0,    max: 0.30 },
  'valley':  { min: 0,    max: 0.50 },
  'ambient': { min: 0,    max: 0.70 },
  'gentle':  { min: 0,    max: 0.85 },
  'active':  { min: 0.20, max: 1.00 },
  'intense': { min: 0.45, max: 1.00 },
  'peak':    { min: 0.70, max: 1.00 },
}
// Filtra por: entry.dna.aggression (número escalar, no EnergyZoneRange)
return entry.dna.aggression >= limits.min && entry.dna.aggression <= limits.max
```

La tabla de `aggressionLimits` es **hardcodeada en el fuente**. El campo `energyZone` del `.lfx` no influencia nunca esta decisión.

**Consecuencia concreta:** Si declaras `energyZone: {min:'peak', max:'peak'}` en un efecto con `genome.aggression=0.55` (ej. `cyber_dualism`), Selene lo seleccionará en zona `ambient/gentle` (aggression 0.55 ≤ 0.85). El `energyZone` declarado no restringe nada.

**¿Dónde SÍ se usa?** Solo en `GatekeeperLinter.ts` (tool offline de linting) y en `LfxClipInstance.ts` (sistema legado pre-WAVE 2482, alimentado por `ContextualEffectSelector` que ya fue desplazado). En la pipeline activa de Selene: **cero consumidores**.

---

### M2 ⚠️ `cognitiveDNA.aggressionRange` — Solo Gate de Validación

**Schema `.lfx` (post WAVE 4829):**
```json
"aggressionRange": { "min": 0.40, "max": 0.70 }
```

**Expectativa implícita del schema:** que Selene use el rango para decidir en qué zona de energía aplica el efecto.

**Realidad:** `DynamicEffectRegistry._validateGenomeRanges()` valida que `min ∈ [0,1]`, `max ∈ [0,1]`, `min ≤ max`. Esto es el **gate G3** — rechaza el `.lfx` si el rango es inválido. El rango pasa al `RegistryEntry.aggressionRange`. 

`filterByZone()` ignora el rango y usa solo `entry.dna.aggression` (el punto escalar del genoma). El rango `[min, max]` en el `.lfx` no amplía ni restringe la ventana de zonificación en runtime.

**Consecuencia concreta:** El WAVE 4829 populó aggressionRange con bandas `±0.15` alrededor del genoma. Esto mejoró la validación G3 (evita puntos degenerados `[x,x]`) pero no cambia ninguna decisión de selección en runtime.

---

### M3 ⚠️ `clip.zones` (Fixture Targeting) — No consultado durante selección Selene

**Schema `.lfx`:**
```json
"clip": {
  "zones": ["movers", "zone-front"]
}
```

**Expectativa:** que Selene use este campo para decidir si seleccionar el efecto según qué fixtures están disponibles/activos.

**Realidad — dos sistemas paralelos con semánticas distintas:**

1. **Sistema Selene** (`EffectDreamSimulator.generateCandidates()`): hardcodea `zones: ['all']` en cada `EffectCandidate`. El campo `clip.zones` del `.lfx` **no se lee durante la evaluación de candidatos**.

2. **Sistema HephaestusRuntime** (`tickLegacy()`): SÍ lee `clip.zones` para resolver los fixture ID físicos a los que envía DMX vía `resolveZoneTags()`. Este sistema opera **después** de que Selene ya eligió el efecto.

**Consecuencia concreta:** Selene puede seleccionar `corazon_latino` (que tiene `"zones": ["all"]`) y `ambient_strobe` (que tiene `"zones": ["pars"]`) con exactamente el mismo criterio de zona — el targeting de fixture no influye en la competición de selección. La diferencia solo aparece en la capa física después de la decisión.

Si el sistema tuviera un efecto declarado `"zones": ["strobes"]` pero no hay fixtures strobe activos, Selene lo seleccionaría igualmente. HephaestusRuntime luego emitiría output para un conjunto vacío de fixtures — efecto silencioso.

---

## ÁREA 2: Sections y Timing

### M4 ❌ `cognitiveDNA.validSections` — CAMPO MUERTO EN RUNTIME

**Schema `.lfx` (post WAVE 4829):**
```json
"validSections": ["drop", "peak"]           // strobe archetype
"validSections": ["intro", "breakdown"]     // ambient archetype
```

**Búsqueda exhaustiva en toda la pipeline activa:**

| Módulo | ¿Lee validSections para decidir? |
|---|---|
| `EffectDreamSimulator.filterByZone()` | ❌ No |
| `EffectDreamSimulator.generateCandidates()` | ❌ No |
| `EffectDreamSimulator.calculateDNARelevance()` | ❌ No |
| `DecisionMaker.determineDecisionType()` | ❌ No |
| `DecisionMaker.generateDivineStrikeDecision()` | ❌ No |
| `VisualEthicalValues` (7 valores, 15 reglas) | ❌ No |
| `DynamicEffectRegistry._buildEntry()` | ✅ Copia/almacena |
| `RegistryEntry.validSections` | ✅ Almacena (frozen) |

**Único lugar donde existe el campo en runtime:** `RegistryEntry.validSections` (congelado, accesible vía `registry.getEntry(id).validSections`). Cero módulos lo leen para tomar decisiones.

**La protección de sección real** está hardcodeada en `DecisionMaker.ts`:
- `section === 'breakdown'` → `return 'hold'` (siempre, sin consultar el efecto candidato)
- `section === 'buildup' && HEAVY_ARSENAL_EFFECTS.has(proposedEffect)` → bloquear
- `zone === 'valley' || zone === 'silence'` con `Z < 0` → `return 'hold'`

`HEAVY_ARSENAL_EFFECTS` es un `ReadonlySet` hardcodeado: `core_meltdown, industrial_strobe, gatling_raid, neon_blinder, strobe_storm, latina_meltdown, thunder_struck, feedback_storm`.

**Consecuencia concreta:** Si un efecto tiene `validSections: ['intro', 'outro']` pero NO está en `HEAVY_ARSENAL_EFFECTS`, podría dispararse durante un `drop`. Y si tiene `validSections: ['drop', 'peak']` pero Selene lo selecciona durante un `intro` (porque su DNA está en rango y la zona es compatible), se dispara igual.

El WAVE 4829 populó validSections con valores correctos. Nadie los lee.

---

### M5 ⚠️ `simulationMeta.zScoreGuards` — Hardcoded en generateCandidates, no per-efecto

**Schema `.lfx` (DEFAULT_SIMULATION_META):**
```json
"zScoreGuards": {
  "requireRising": false,
  "minimumZ": null,
  "minimumEnergy": null
}
```

**Intención declarada:** Configuración per-efecto de los Z-Score guards que protegen contra disparos en momentos inapropiados.

**Realidad en `generateCandidates()`:**
```typescript
// Guards hardcodeados para categorías de efectos, no por zScoreGuards del .lfx
// STROBE Z-GUARD: todos los effectos con entry.simMeta.isStrobe === true
if (entry.simMeta.isStrobe && zScore <= 0) continue // guard fijo, no minimumZ del .lfx

// GATLING guard: hardcodeado por nombre, no por zScoreGuards
if (effect.includes('gatling') && (intensity < 0.65 || zScore < 0.8)) continue
```

El `simMeta.zScoreGuards.minimumZ` del `.lfx` no se lee en ningún guard de runtime. El campo `isStrobe: true` SÍ se lee (para el STROBE Z-GUARD) pero el threshold del guard (`zScore <= 0`) es siempre el mismo independientemente de lo que diga el .lfx.

**Consecuencia concreta:** No es posible declarar `minimumZ: 2.5` en el `.lfx` para que un efecto específico solo se dispare cuando Z > 2.5σ. El sistema aplica los mismos guards para todos los efectos de la misma categoría.

---

## ÁREA 3: Static vs Dynamic Loss

### M6 ✅ `gpuCost` y `fatigueImpact` — CORRECTO post WAVE 4829

`calculateGpuImpact()` y `calculateFatigueImpact()` en EffectDreamSimulator leen:
```typescript
getDynamicEffectRegistry().getSimMeta(effect.effect)?.gpuCost ?? 0.15
getDynamicEffectRegistry().getSimMeta(effect.effect)?.fatigueImpact ?? 0.05
```

Post WAVE 4829, los 49 `.lfx` tienen valores diferenciados por archetype:
- strobe: gpuCost=0.60, fatigueImpact=0.85
- heavy: gpuCost=0.40, fatigueImpact=0.50
- ambient: gpuCost=0.20, fatigueImpact=0.10
- utility: gpuCost=0.30, fatigueImpact=0.30

Estos valores SÍ influyen en `riskLevel` y en los conflictos de hardware detectados. **Pipeline funcional.**

---

### M7 ⚠️ `simulationMeta.beautyWeights` — Sin diferenciación efectiva

**Schema `.lfx` (todos los 49 efectos, post WAVE 4829):**
```json
"beautyWeights": { "base": 0.50, "energyMultiplier": 1.00, "vibeBonus": 0.00 }
```

El patcher WAVE 4829 no modificó `beautyWeights` (no era parte del scope). El resultado: todos los efectos tienen **exactamente los mismos beautyWeights**.

`projectBeauty()` en EffectDreamSimulator usa estos valores:
```typescript
const weights = entry.simMeta.beautyWeights
const projected = weights.base + (weights.energyMultiplier * state.energy) + weights.vibeBonus
```

Con todos los efectos teniendo `base=0.50`, `energyMultiplier=1.00`, `vibeBonus=0.00`, la belleza proyectada es `0.50 + energy` para TODOS los efectos. La diferenciación de belleza per-efecto (intención del campo) es cero en la práctica.

**Consecuencia concreta:** El score `projectedBeauty` no discrimina entre efectos — es función solo de la energía del momento, no de la identidad del efecto. El subpeso de `aesthetic_beauty` en VisualConscienceEngine no aporta diferenciación.

---

### M8 ⚠️ `execHints.selectionBias` — Campo fantasma (no existe en RegistryEntry)

En `calculateDNARelevance()` de EffectDreamSimulator:
```typescript
const selectionBias = (effectEntry as any).selectionBias ?? 1
relevance = Math.max(0, Math.min(1, (relevance - textureCheck.penalty) * selectionBias))
```

`RegistryEntry` (ver `lfxTypes.ts`) no tiene campo `selectionBias`. `ExecutionHints` tampoco. El cast `as any` siempre retorna `undefined`, por lo que `selectionBias` es siempre `1`. Esta línea es **código muerto** — nunca amplifica ni atenúa la relevancia.

Si la intención era leer `execHints.selectionBias`, este campo debería declararse en `ExecutionHints` y copiarse en `RegistryEntry`. Actualmente no existe el campo.

---

## ÁREA 4: Physical Mapping

### M9 ✅ Color Leak `_normRgbBuf` — RESUELTO en WAVE 4830

El bug original: `writeOutput()` asignaba `out.normalizedRgb = this._normRgbBuf` (referencia compartida), causando que la siguiente iteración de fixture sobrescribiera el color de todos los slots anteriores.

**Fix aplicado (WAVE 4830):**
- `ensureOutputCapacity()` pre-aloca per-slot `normalizedRgb: {r:0, g:0, b:0}` objects
- `writeOutput()` copia valores en-place:
  ```typescript
  out.normalizedRgb.r = normalizedRgb.r
  out.normalizedRgb.g = normalizedRgb.g
  out.normalizedRgb.b = normalizedRgb.b
  ```

**Status: CORRECTO.** Cada slot del output buffer tiene su propio objeto RGB independiente.

---

### M10 ✅ Strobe path en HephaestusAetherAdapter — RESUELTO en WAVE 4830

El bug original: el adapter solo escribía `values['strobe'] = output.normalizedValue`, dejando el shutter mecánico cerrado → strobe silencioso en hardware.

**Fix aplicado (WAVE 4830):**
```typescript
case 'strobe':
  values['strobeRate'] = output.normalizedValue
  if (output.normalizedValue > 0) {
    values['shutter'] = 1.0  // abre el obturador mecánico
  }
  break
```

Replica el contrato semántico de `LiquidAetherAdapter` (L0): strobe activo implica shutter abierto. **Status: CORRECTO.**

---

## VIOLACIONES AL AXIOMA ANTI-SIMULACIÓN

### M11 🔴 `Math.random()` en VisualEthicalValues — VIOLACIÓN AXIOMA

**Archivo:** `electron-app/src/core/intelligence/conscience/VisualEthicalValues.ts`  
**Línea:** regla `allow_experimental` en VALUE 7 `RISK_CREATIVITY`

```typescript
{
  id: 'allow_experimental',
  severity: 'low',
  check: (context, effect) => {
    // 10% de las veces, permitir efecto "fuera de zona"
    if (Math.random() < 0.1 && effect.riskLevel && effect.riskLevel < 0.7) {
      return { passed: true, boost: 0.1, reason: 'Experimental effect allowed (10% creativity budget)' }
    }
    return { passed: true }
  }
},
```

**Axioma violado:** "Se prohíbe el uso de Math.random() o cualquier heurística para simular lógica de negocio. Toda función debe ser real, medible y determinista."

Esta regla usa `Math.random()` para dar boost de +0.10 al score en el 10% de los frames. Comportamiento no reproducible, no auditable, y no determinista. A diferencia del `explorationBoost` de `calculateScenarioScore()` (que usa timestamp + hash del nombre del efecto — determinista y reproducible), este `Math.random()` viola el Axioma.

**Impacto práctico:** Bajo — la regla es `severity: 'low'`, `weight: 0.5` (el valor más bajo de los 7), y el boost es solo `0.10`. Pero es una violación doctrinal.

---

## ESTADO CONSOLIDADO DE CAMPOS DEL .LFX

| Campo `.lfx` | En RegistryEntry | Leído en decisión | Efecto real |
|---|---|---|---|
| `clip.zones` | No (solo HephRuntime) | ❌ No consulted by Selene | Solo targeting físico post-selección |
| `cognitiveDNA.genome.*` | `entry.dna.*` | ✅ Sí (filterByZone, calculateDNARelevance) | **Activo** — núcleo del scoring DNA |
| `cognitiveDNA.textureAffinity` | `entry.textureAffinity` | ✅ Sí (checkTextureCompatibility) | **Activo** |
| `cognitiveDNA.compatibleVibes` | `entry.compatibleVibes` | ✅ Sí (getEffectsForVibe, projectConsonance) | **Activo** |
| `cognitiveDNA.validSections` | `entry.validSections` | ❌ Solo almacenado | **CAMPO MUERTO** |
| `cognitiveDNA.energyZone` | `entry.energyZone` | ❌ Solo almacenado | **CAMPO MUERTO** |
| `cognitiveDNA.aggressionRange` | `entry.aggressionRange` | ❌ Solo validación G3 | Estructura, no selección |
| `cognitiveDNA.spatialBehavior` | `entry.spatialBehavior` | ✅ Sí (AetherAdapter _resolveSpatialBehavior) | **Activo** |
| `simulationMeta.gpuCost` | `entry.simMeta.gpuCost` | ✅ Sí (calculateGpuImpact) | **Activo** |
| `simulationMeta.fatigueImpact` | `entry.simMeta.fatigueImpact` | ✅ Sí (calculateFatigueImpact) | **Activo** |
| `simulationMeta.beautyWeights` | `entry.simMeta.beautyWeights` | ✅ Sí (projectBeauty) | Activo pero sin variación entre efectos |
| `simulationMeta.isStrobe` | `entry.simMeta.isStrobe` | ✅ Sí (STROBE Z-GUARD) | **Activo** |
| `simulationMeta.isDivineCandidate` | `entry.simMeta.isDivineCandidate` | ✅ Sí (getDivineArsenal) | **Activo** |
| `simulationMeta.isHeavyCandidate` | `entry.simMeta.isHeavyCandidate` | ✅ Sí (getHeavyArsenal) | **Activo** |
| `simulationMeta.zScoreGuards` | `entry.simMeta.zScoreGuards` | ❌ No leído | Guards hardcodeados en generateCandidates |
| `simulationMeta.cooldownMs` | `entry.simMeta.cooldownMs` | Verificar — probable uso en cooldown logic | — |
| `executionHints.selectionBias` | ❌ No existe en RegistryEntry | `(effectEntry as any).selectionBias` siempre undefined | **CAMPO FANTASMA** |
| `executionHints.fixtureTargeting` | `entry.execHints.fixtureTargeting` | Probable en SeleneHephBridge | — |

---

## ACCIONES RECOMENDADAS

### Criticidad Alta

**A1 [DEAD FIELD]** `validSections`: Decidir el destino. Opciones:
- **Opción A** — Implementar consumer: añadir filtro en `generateCandidates()` que excluya efectos cuyo `validSections` no incluye la sección actual de `pattern.section`. Requiere mapeo section_name → validSection_label.
- **Opción B** — Deprecar el campo: removerlo del schema .lfx y del RegistryEntry. El sistema de secciones de DecisionMaker ya cubre la lógica correcta con `HEAVY_ARSENAL_EFFECTS` y `breakdown → hold`.

**A2 [AXIOMA]** `Math.random()` en `RISK_CREATIVITY.allow_experimental`: Reemplazar con la misma mecánica determinista del `explorationBoost` (timestamp + hash del effectId), o eliminar la regla si el valor 7 ya es cubierto por el explorationBoost del DreamSimulator.

### Criticidad Media

**A3 [DEAD FIELD]** `energyZone`: Evaluar si la semántica label-based (`'peak'`) aporta información que el aggression escalar no captura. Si no, deprecar. Si sí, implementar un gate en `filterByZone` que intersecte el `aggressionLimits[zone]` con los límites numéricos derivados de `entry.energyZone`.

**A4 [DEAD CODE]** `selectionBias`: Declarar el campo en `ExecutionHints` y en `RegistryEntry`, o eliminar la línea `(effectEntry as any).selectionBias ?? 1` del simulator.

**A5 [UNDIFFERENTIATED]** `beautyWeights`: El WAVE 4829 no los tocó. Necesitan valores by-archetype para que `projectBeauty()` aporte diferenciación real. Propuesta:
- strobe: `{base: 0.30, energyMultiplier: 1.50, vibeBonus: 0.10}`
- heavy: `{base: 0.40, energyMultiplier: 1.20, vibeBonus: 0.10}`
- ambient: `{base: 0.70, energyMultiplier: 0.60, vibeBonus: 0.20}`
- utility: `{base: 0.55, energyMultiplier: 0.90, vibeBonus: 0.10}`

### Criticidad Baja

**A6** `zScoreGuards`: Si se quiere control per-efecto de los guards, implementar lectura de `entry.simMeta.zScoreGuards.minimumZ` en `generateCandidates()`. Si no, documentar que los guards son categoría-based (por `isStrobe`) y no per-effect.

**A7** `clip.zones` para Selene: Si se quiere que el targeting de fixture influya en la selección (ej., no seleccionar un efecto de movers si solo hay PAR disponibles), añadir un gate en `generateCandidates()` que valide `clip.zones` contra el fixture manifest activo.

---

## NOTAS DE CONTEXTO

- El sistema de texture coherence (`aesthetic_beauty.texture_coherence`) fue **desactivado explícitamente en WAVE 4840-B**. `textureAffinity` del .lfx solo opera a través de `checkTextureCompatibility()` en EffectDreamSimulator, no en VisualEthicalValues.
- El DecisionMaker tiene un sistema de zone validation (`WAVE 4866: HUNT STRIKE ZONE PROTECTION`) que usa `EFFECT_ZONE_MAP` (un mapa estático en `EffectManager.ts`) — otro sistema de zona paralelo, independiente del `energyZone` del .lfx.
- Post WAVE 4830, el pipeline de color y strobe físico es correcto. No hay bugs pendientes en la capa de HephaestusRuntime → HephaestusAetherAdapter.

---
*WAVE-4842 — Auditoría cerrada. Cero cambios realizados.*
