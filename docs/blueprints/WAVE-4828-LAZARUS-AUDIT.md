# WAVE-4828-LAZARUS-AUDIT.md
## THE LAZARUS PROTOCOL — Forensic Audit of the Execution Gap

> **Status:** Auditoría forense + diseño técnico
> **Predecesor:** WAVE 4822 (Surgical Transplant — Registry conectado, .lfx ingestados)
> **Síntoma raíz:** Selene aprueba clips, pero el pipeline físico no los traduce correctamente. `oro_solido` monopoliza con `RSK=0.00`. Color y strobe se filtran o desaparecen.
> **Entregable:** Diagnóstico crudo de tres fallos sistémicos + diseño del reproductor que faltaba.

---

## §0. RESUMEN EJECUTIVO (TL;DR)

| Síntoma | Causa raíz real | Severidad | Fix |
|---|---|---|---|
| `RSK=0.00` o `0.10` constante en latina effects | `simulationMeta.fatigueImpact` y `gpuCost` migrados a valores **mínimos por defecto** (0.06/0.30) en TODOS los .lfx — no se diferencian entre efectos | 🔴 Crítico | Re-derivar fatigue/gpuCost desde la categoría/archetype durante la migración |
| `oro_solido` gana 70% de los slots | RSK=0.00 + `validSections` vacío + `aggressionRange` = `[agg, agg]` puntual (no rango) → no penaliza nada | 🔴 Crítico | Inflar rangos por archetype, restaurar fatigue real, validar `validSections` no-vacío en G4 |
| Color de los .lfx se "pierde" | `HephaestusAetherAdapter` SÍ traduce color → r/g/b normalizado a `NodeFamily.COLOR`, pero **SOLO si `output.normalizedRgb` está populado**. `HephaestusRuntime.tickWithPhase()` populiza el scratch buffer **compartido y mutable**, y al iterar múltiples fixturas el último output sobreescribe el normalizedRgb de los anteriores. **Bug zero-alloc** | 🔴 Crítico | Cada `writeOutput()` con color debe copiar el RGB normalizado a un slot per-output, no compartir `_normRgbBuf` |
| Strobe no llega al Smart Gate | El adaptador escribe `values.strobe` correctamente, pero la curva del .lfx encoded como `strobe` (binary 0/1 hold-pattern) se entrega como `normalizedValue` 0..1 continuo. El NodeArbiter trata `strobe` como **STRICT_PRIORITY** pero no como **digital gate** — necesita umbral binario | 🟠 Alto | Introducir un canal `strobe_gate` digital o un threshold en el adapter (>0.5 → 1.0) |
| Movimiento ausente en clips legacy migrados | El migrador (WAVE 4821) generó la mayoría de .lfx con `spatialBehavior:'static'` y curvas de pan/tilt vacías. El runtime evalúa lo que hay — si no hay curva, no hay movimiento. **No es un bug, es ausencia de datos** | 🟡 Esperado | Re-migrar efectos con movement real (acid_sweep, cyber_dualism) a `spatialBehavior:'absolute'` con keyframes |

**El "Curve Player" que el usuario cree que falta SÍ EXISTE** (`HephaestusRuntime` + `CurveEvaluator` + `HephaestusAetherAdapter`), pero tiene tres fallos de implementación que parecen ausencia total. La pregunta correcta no es "¿debemos compilar a `.lux`?" sino "¿por qué el runtime existente está sangrando datos?".

---

## §1. EL ABISMO DE EJECUCIÓN — DIAGNÓSTICO DEL CURVE PLAYER

### 1.1 La cadena completa (lo que YA existe)

```
.lfx file (disk)
    ↓ HephaestusRuntime.loadClip() → JSON.parse → deserializeHephClip → Map<paramId, HephCurve>
    ↓ HephaestusRuntime.play() → ActiveHephClip { evaluator, startTimeMs, durationMs }
    ↓ TitanOrchestrator.tick() (44Hz)
    ↓ HephaestusRuntime.tick(now) → tickWithPhase | tickLegacy
    ↓     CurveEvaluator.getValue(paramId, t) → cursor cache O(1) → bezier interp
    ↓     CurveEvaluator.getColorValue(paramId, t) → HSL interp → hslToRgb → mutate _normRgbBuf
    ↓     writeOutput(fixtureId, paramName, scaledValue, rgb, normalizedRgb=_normRgbBuf, ...)
    ↓ outputBuffer: HephFixtureOutput[] (preallocated)
    ↓ HephaestusAetherAdapter.ingest(outputs, arbiter)
    ↓     for each output where isCustomClip:
    ↓         _resolveSpatialBehavior(clipId) from Registry
    ↓         _populateValues(intent.values, param, output, behavior) → dimmer/red/green/blue/strobe/pan_offset/tilt_offset
    ↓         arbiter.setHephaestusIntents(intents[])
    ↓ NodeArbiter.arbitrate()
    ↓     L3 hephaestus → _l3DominatedChannels.add(channel)
    ↓     LTP universal → record[channel] = incoming
    ↓ ArbitratedNodeMap → NodeResolver → DMX
```

**Conclusión arquitectónica:** El reproductor ya está construido (WAVE 2030 + WAVE 3521). El problema NO es que falte un evaluator. Son **tres bugs concretos** dentro del pipeline existente.

### 1.2 Decisión: Runtime Evaluator vs Compile-to-Flat

El usuario plantea: "¿Construimos un `LfxRuntimeEvaluator` o compilamos a `.lux`?"

**Veredicto: ni uno ni otro — REPARAR el `HephaestusRuntime` actual.**

| Opción | Pros | Contras | Veredicto |
|---|---|---|---|
| **A. Construir nuevo `LfxRuntimeEvaluator`** | Diseño limpio | Duplicación masiva de código que ya funciona; aún tendríamos `HephaestusRuntime` para Diamond Data path | ❌ Re-invención |
| **B. Compilar a `.lux` flat** | Cero CPU en hot path | Pérdida de tiempo real (Selene escala intensity/duration al disparar — un .lux pre-compilado pierde esa flexibilidad); explosión de tamaño en disco; pierde phase distribution | ❌ Pierde cognitive features |
| **C. Reparar `HephaestusRuntime` existente** | Es el evaluator correcto, ya hace bezier + cursor cache + zero-alloc | Tres bugs por arreglar | ✅ **Camino correcto** |

### 1.3 Los Tres Bugs del Curve Player

#### BUG #1 — _normRgbBuf compartido entre fixturas

**Ubicación:** `HephaestusRuntime.tickWithPhase()` y `tickLegacy()`.

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\hephaestus\runtime\HephaestusRuntime.ts:541-556
      const isCustomThisClip = active.clip.effectType === 'heph_custom'
      for (const [paramName, curve] of active.clip.curves) {
        if (curve.valueType === 'color') {
          const hsl = active.evaluator.getColorValue(paramName, fixtureTimeMs)
          // Intensity modulates lightness (dim the color, don't destroy hue/sat)
          const modulatedL = (hsl.l / 100) * active.intensity
          const rgb = hslToRgb(hsl.h, hsl.s / 100, modulatedL)
          // WAVE 3521: normalized RGB for Aether adapter (shared scratch buf)
          this._normRgbBuf.r = rgb.r / 255
          this._normRgbBuf.g = rgb.g / 255
          this._normRgbBuf.b = rgb.b / 255

          this.writeOutput(fp.fixtureId, 'all', paramName, 0, rgb, undefined, 0, this._normRgbBuf, isCustomThisClip, active.clip.id)
```

**El crimen:** `_normRgbBuf` es un objeto único en la clase. `writeOutput` guarda la **referencia** en `out.normalizedRgb`. Cuando se procesa la siguiente fixtura (o el siguiente paramName, o el siguiente clip), `_normRgbBuf.r/g/b` son sobrescritos. Cuando el adapter lee `output.normalizedRgb` un instante después, lee el ÚLTIMO color escrito, no el de SU fixtura.

**Para clips con phase distribution monocromática** este bug es invisible (todos los outputs comparten el mismo color del clip). **Para clips con color cambiante o cuando hay 2+ clips activos simultáneos**, el último gana — la fuga de color reportada.

**Fix correcto:** El pool de `outputBuffer` ya es zero-alloc. Cada `HephFixtureOutput` debe tener su propio `normalizedRgb: { r, g, b }` pre-asignado (ya lo hace `ensureOutputCapacity` en línea 666–678 — el campo se inicializa como `undefined`). Cambiar a:

```typescript
// En ensureOutputCapacity():
normalizedRgb: { r: 0, g: 0, b: 0 },  // pre-allocated per slot

// En writeOutput():
if (normalizedRgb) {
  out.normalizedRgb!.r = normalizedRgb.r
  out.normalizedRgb!.g = normalizedRgb.g
  out.normalizedRgb!.b = normalizedRgb.b
} else {
  // marker: no color this output
  out.normalizedRgb = undefined
}
```

#### BUG #2 — strobe como número continuo, no gate digital

**Ubicación:** `HephaestusAetherAdapter._populateValues()`.

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\HephaestusAetherAdapter.ts:225-227
    case 'strobe':
      values['strobe'] = output.normalizedValue
      break
```

El `NodeArbiter` clasifica `strobe` como `STRICT_PRIORITY_CHANNELS` y lo pasa con LTP estricto entre capas. Pero el VALOR que llega es la curva de Hephaestus interpolada — **un float continuo** entre 0 y 1, no un binario.

Para los .lfx migrados con `interpolation:'hold'` (square wave), la curva sí produce 0 o 1 limpios — funciona. Pero para clips con `bezier` o `linear` en strobe, el adapter le pasa al NodeResolver un valor como 0.47 que el driver DMX convierte a un brillo estático del shutter, **no a un strobe**.

**Fix:** Tras leer el valor strobe, aplicar threshold + sample-and-hold a la frecuencia del clip:

```typescript
case 'strobe': {
  // Strobe gating: threshold binario para evitar interpolación continua
  values['strobe'] = output.normalizedValue >= 0.5 ? 1.0 : 0.0
  break
}
```

O mejor, encodear el strobe como **frecuencia Hz directa** en otro paramId (`strobe_hz`) y dejar que el NodeResolver implemente el oscilador, manteniendo `strobe` como binary gate.

#### BUG #3 — Curvas de pan/tilt vacías post-migración

**No es un bug del runtime — es un bug del migrador (WAVE 4821).**

El migrador (siguiendo el blueprint WAVE 4820) decidió `spatialBehavior:'static'` para los 47 efectos legacy porque:
- `LEGACY-PHYSICS-MAPPING.md` documentó muchos efectos con "movement PURGED"
- La heurística conservadora marcó casi todo como static

**Resultado en disco:** los `.lfx` no tienen curvas pan/tilt. El runtime evalúa lo que hay → no hay output de movimiento → el adapter no emite intents pan/tilt → **el mover queda gobernado por L0**.

Esto es **comportamiento correcto** dado el input (LEGACY-PHYSICS-MAPPING dijo que no hay movimiento). Si el usuario quiere movimiento en los clips migrados, debe re-correr el migrador con un mapping corregido.

### 1.4 La Arquitectura Final (lo que NO hay que construir)

```
┌─────────────────────────────────────────────────────────────────┐
│  NO construir un nuevo LfxRuntimeEvaluator.                     │
│  NO compilar .lfx → .lux flat.                                  │
│                                                                  │
│  REPARAR los 3 bugs en HephaestusRuntime + HephaestusAetherAdapter │
│  y el reproductor existente vuelve a la vida.                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## §2. EL MONOPOLIO DEL RIESGO CERO — BUG COGNITIVO

### 2.1 Forensia del log del usuario

Del microlog (`docs/logs/4321.md`):

```
1. corazon_latino       SCORE=1.000 | DNA=0.76 DIV=1.00 VIB=0.60 RSK=0.10 dist=0.42
2. glitch_guaguanco     SCORE=1.000 | DNA=0.62 DIV=1.00 VIB=0.60 RSK=0.30 dist=0.66
3. latina_meltdown      SCORE=1.000 | DNA=0.55 DIV=1.00 VIB=0.60 RSK=0.30 dist=0.77
4. machete_spark        SCORE=1.000 | DNA=0.62 DIV=1.00 VIB=0.60 RSK=0.10 dist=0.66
5. salsa_fire           SCORE=1.000 | DNA=0.74 DIV=1.00 VIB=0.60 RSK=0.10 dist=0.45

1. oro_solido           SCORE=0.796 | DNA=0.63 DIV=1.00 VIB=0.60 RSK=0.00 dist=0.64
```

Observaciones:
- **`RSK` casi siempre vale 0.00 o 0.10**. Solo glitch_guaguanco y latina_meltdown llegan a 0.30. El espacio de variación es minúsculo.
- **`DIV=1.00` siempre**. La diversidad nunca penaliza nada — todos los efectos parten "frescos".
- **`VIB=0.60` constante** en toda la lista. La coherencia de vibe no diferencia.
- **`DNA` entre 0.55 y 0.82**. Único axis con varianza real.

Resultado: el ranking colapsa a `score ≈ DNA*0.35 + 0.20 + 0.15 + (1-RSK)*0.13 + 0.05`. Como `RSK` es plano, todos terminan en `SCORE=1.000` (truncated to 1.0).

### 2.2 Causa raíz — el migrador no diferenció risk metadata

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\arsenal\lfxTypes.ts:259-273
export const DEFAULT_SIMULATION_META: Readonly<SimulationMeta> = Object.freeze({
  beautyWeights: Object.freeze({ base: 0.50, energyMultiplier: 1.00, vibeBonus: 0.00 }),
  gpuCost: 0.30,
  fatigueImpact: 0.06,
  minDurationMs: 1000,
  cooldownMs: 7000,
  isStrobe: false,
  isDivineCandidate: false,
  isHeavyCandidate: false,
  zScoreGuards: Object.freeze({
    requireRising: false,
    minimumZ: null,
    minimumEnergy: null,
  }),
}) as Readonly<SimulationMeta>
```

Cuando el migrador no especifica `simulationMeta` en el .lfx, **todo el catálogo migrado hereda los defaults**: `gpuCost=0.30`, `fatigueImpact=0.06`. Idéntico para los 47 efectos.

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\dream\EffectDreamSimulator.ts:771-810
  private calculateRisk(
    effect: EffectCandidate,
    state: SystemState,
    context: AudienceSafetyContext
  ): number {
    let risk = 0.0
    
    // GPU overload risk
    const simMeta = getDynamicEffectRegistry().getSimMeta(effect.effect)
    const gpuCost = simMeta?.gpuCost ?? 0.15
    const projectedGpuLoad = context.gpuLoad + gpuCost * effect.intensity
    
    if (projectedGpuLoad > 0.8) {
      risk += 0.3
    } else if (projectedGpuLoad > 0.6) {
      risk += 0.1
    }
    
    // Audience fatigue risk
    const fatigueImpact = simMeta?.fatigueImpact ?? 0.05
    const projectedFatigue = context.audienceFatigue + fatigueImpact * effect.intensity
    
    if (projectedFatigue > 0.8) {
      risk += 0.4
    } else if (projectedFatigue > 0.6) {
      risk += 0.2
    }
    ...
```

Con `gpuCost=0.30` y `intensity=1`, `projectedGpuLoad ≈ context.gpuLoad + 0.30`. Si la GPU base está en 0.4, llega a 0.7 → +0.1 de risk. Si está en 0.55 → llega a 0.85 → +0.3. Mismo cálculo para los 47 efectos. Risk colapsa a un escalón binario por estado del sistema, no por efecto.

`oro_solido` gana porque:
1. Tiene tags `'divine'` + alto aggression (0.74 dna en log) → buen DNA score frente al spike DNA target.
2. Hereda `fatigueImpact=0.06` (default) → bajo fatigue projected → `RSK=0.00`.
3. No tiene `validSections` declaradas → no rebota nunca.
4. Su `cooldownMs` default 7000ms es bajo para un efecto destructivo → re-elegible rápido.

### 2.3 Parche al `calculateRisk()` — hacer que diferencie

#### Parche 2.3a — Risk derivado del archetype/DNA

En lugar de leer `simulationMeta` (que está plano post-migración), derivar el riesgo desde la cognitiveDNA real:

```typescript
private calculateRisk(
  effect: EffectCandidate,
  state: SystemState,
  context: AudienceSafetyContext
): number {
  let risk = 0.0
  
  const entry = getDynamicEffectRegistry().getEntry(effect.effect)
  if (!entry) return 0.5  // unknown → neutral
  
  // ── DNA-DRIVEN RISK (replaces flat simulationMeta) ──────────────
  // High aggression → high physical strain on movers + audience
  // High chaos → unpredictable load
  // Low organicity → mechanical, more fatiguing
  const dnaRisk =
    entry.dna.aggression * 0.40 +
    entry.dna.chaos * 0.25 +
    (1 - entry.dna.organicity) * 0.20
  
  // ── ARCHETYPE PENALTY (canonical risk by category) ──────────────
  const archetypePenalty =
    entry.simMeta.isStrobe ? 0.30 :
    entry.simMeta.isHeavyCandidate ? 0.20 :
    entry.simMeta.isDivineCandidate ? 0.15 :
    0.05  // utility / ambient — minimal risk
  
  risk = dnaRisk * 0.6 + archetypePenalty
  
  // ── CONTEXT MODIFIERS (existing logic, preserved) ───────────────
  if (context.epilepsyMode && entry.simMeta.isStrobe) risk += 0.5
  if (state.activeCooldowns.has(effect.effect)) risk += 0.2
  if (effect.intensity > 0.9) risk += 0.1
  
  // ── ENERGY MISMATCH PENALTY ─────────────────────────────────────
  // Effect designed for 'peak' fired in 'valley' → high risk
  const energyMin = ENERGY_ZONE_VALUES[entry.energyZone.min] ?? 0
  const energyMax = ENERGY_ZONE_VALUES[entry.energyZone.max] ?? 1
  if (context.energy < energyMin - 0.15) risk += 0.25
  if (context.energy > energyMax + 0.15) risk += 0.15
  
  return Math.min(1.0, risk)
}
```

Con este parche, los 47 efectos producen risks distintos: `oro_solido` (divine, A=0.92, C=0.40, O=0.30) → `dnaRisk = 0.42*0.40 + 0.40*0.25 + 0.70*0.20 = 0.31`, + `archetypePenalty=0.15` (divine) = `0.34`. Mientras `cumbia_moon` (ambient, A=0.20, C=0.15, O=0.85) → `dnaRisk = 0.05`, + `archetypePenalty=0.05` = `0.07`. **Diferenciación real**.

#### Parche 2.3b — Anti-Monopoly Penalty

Aún con el parche A, un efecto con buen DNA puede ganar muchas veces seguidas si la diversidad no escala con la frecuencia. Agregar un **multiplier de monopolio**:

```typescript
// En calculateScore() (donde se ensambla el FinalScore):

// Anti-Monopoly: efectos que han ganado ≥3 veces en los últimos 10 slots
const recentWins = state.recentWinHistory.get(effect.effect) ?? 0
if (recentWins >= 3) {
  score *= 0.5   // 50% penalty — fuerza rotación
}
if (recentWins >= 5) {
  score *= 0.2   // 80% penalty — soft-ban temporal
}
```

Y mantener un buffer circular de los últimos 10 efectos disparados en `state.recentWinHistory`.

#### Parche 2.3c — Validación G4 endurecida en el Registry

```typescript
// En DynamicEffectRegistry.registerEffect(), antes de _buildEntry:

if (dna.compatibleVibes.length === 0) { /* ya existe */ return null }

// NUEVO: G4.1 — validSections no puede ser ['*'] ni ['']
if (dna.validSections.length === 0 || dna.validSections.includes('*' as any)) {
  console.warn(`[DynamicEffectRegistry ⚠️] G4.1 fail: validSections wildcard for "${clip.clip.id}"`)
  return null
}

// NUEVO: G4.2 — aggressionRange must be a real range, not a point
if (dna.aggressionRange.max - dna.aggressionRange.min < 0.10) {
  console.warn(`[DynamicEffectRegistry ⚠️] G4.2 fail: aggressionRange too narrow for "${clip.clip.id}"`)
  return null
}

// NUEVO: G4.3 — simulationMeta must not be flat defaults
if (
  dna.simulationMeta?.gpuCost === DEFAULT_SIMULATION_META.gpuCost &&
  dna.simulationMeta?.fatigueImpact === DEFAULT_SIMULATION_META.fatigueImpact
) {
  console.warn(`[DynamicEffectRegistry ⚠️] G4.3 warning: "${clip.clip.id}" using default sim meta — risk scoring will be flat`)
  // No reject — solo warning. Permite migración progresiva.
}
```

### 2.4 Re-migrar simulationMeta desde el archetype

En el script `migrateLegacyToLfx.ts`, derivar `simulationMeta` por archetype en lugar de usar defaults:

```typescript
const SIM_META_BY_ARCHETYPE: Record<UserArchetype, Partial<SimulationMeta>> = {
  strobe:  { gpuCost: 0.20, fatigueImpact: 0.18, cooldownMs: 6000, isStrobe: true },
  divine:  { gpuCost: 0.35, fatigueImpact: 0.22, cooldownMs: 12000, isDivineCandidate: true },
  heavy:   { gpuCost: 0.40, fatigueImpact: 0.15, cooldownMs: 8000, isHeavyCandidate: true },
  ambient: { gpuCost: 0.10, fatigueImpact: 0.03, cooldownMs: 3000 },
  utility: { gpuCost: 0.15, fatigueImpact: 0.05, cooldownMs: 5000 },
}
```

---

## §3. LA FUGA DE COLOR Y ESTROBOS — DIAGNÓSTICO QUIRÚRGICO

### 3.1 El path completo del color

```
.lfx curve "color" (HSL keyframes)
    ↓ CurveEvaluator.getColorValue() → HSL (referencia a _hslResult interno)
    ↓ hslToRgb(hsl.h, hsl.s/100, modulatedL) → { r, g, b } 0-255
    ↓ this._normRgbBuf.r/g/b = rgb.x / 255  ⚠️ MUTAR BUFFER COMPARTIDO
    ↓ writeOutput(..., rgb=rgb (object), ..., normalizedRgb=this._normRgbBuf)
    ↓     out.rgb = rgb               ⚠️ rgb es un objeto fresco creado por hslToRgb — esto SÍ es por-output
    ↓     out.normalizedRgb = this._normRgbBuf   ⚠️ TODOS los outputs comparten la MISMA referencia
    ↓ HephaestusAetherAdapter.ingest()
    ↓     output.normalizedRgb → values.red/green/blue
```

**Veredicto:** `out.rgb` se preserva (es objeto nuevo de `hslToRgb`), pero el **`normalizedRgb` que el adapter consume está corrupto** porque comparte buffer.

### 3.2 Verificación contra el TitanOrchestrator legacy path

El bloque legacy en `TitanOrchestrator` (líneas 1660-1690) lee `output.rgb` directamente — **NO usa `normalizedRgb`**. Por eso el path legacy funciona y el path Aether (vía adapter) sangra. Esto explica por qué algunos efectos se ven bien (cuando van por path legacy) y otros no (cuando van por path Aether — fixturas registradas en NodeGraph).

### 3.3 Fix definitivo del color — buffer per-slot

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\hephaestus\runtime\HephaestusRuntime.ts:658-680
  private ensureOutputCapacity(needed: number): void {
    if (needed <= this.outputCapacity) return

    const newCapacity = Math.max(needed, this.outputCapacity * 2, 256)

    for (let i = this.outputCapacity; i < newCapacity; i++) {
      this.outputBuffer[i] = {
        fixtureId: '',
        zone: 'all',
        parameter: '',
        value: 0,
        rgb: undefined,
        fine: undefined,
        source: 'hephaestus-runtime',
        normalizedValue: 0,
        normalizedRgb: undefined,  // ← CAMBIO: { r:0, g:0, b:0 } pre-allocated
        isCustomClip: false,
        clipId: undefined,
      }
    }
    this.outputCapacity = newCapacity
  }
```

**Fix:**
1. Pre-allocate `normalizedRgb: { r: 0, g: 0, b: 0 }` por slot en `ensureOutputCapacity`.
2. En `writeOutput`, **copiar** los componentes en lugar de asignar la referencia:

```typescript
private writeOutput(
  fixtureId: string, zone: ..., parameter: string, value: number,
  rgb?: { r: number; g: number; b: number }, fine?: number,
  normalizedValue?: number,
  normalizedRgb?: { r: number; g: number; b: number },
  isCustomClip?: boolean, clipId?: string,
): void {
  if (this.outputCursor >= this.outputCapacity) {
    this.ensureOutputCapacity(this.outputCursor + 64)
  }

  const out = this.outputBuffer[this.outputCursor++]
  out.fixtureId = fixtureId
  out.zone = zone
  out.parameter = parameter
  out.value = value
  out.rgb = rgb  // OK: rgb is a fresh object from hslToRgb
  out.fine = fine
  out.normalizedValue = normalizedValue ?? 0
  
  // 🔧 LAZARUS FIX: COPY components, don't share reference
  if (normalizedRgb) {
    if (!out.normalizedRgb) out.normalizedRgb = { r: 0, g: 0, b: 0 }
    out.normalizedRgb.r = normalizedRgb.r
    out.normalizedRgb.g = normalizedRgb.g
    out.normalizedRgb.b = normalizedRgb.b
  } else {
    // No color this output — use sentinel
    if (out.normalizedRgb) {
      out.normalizedRgb.r = -1  // sentinel: no color
    }
  }
  
  out.isCustomClip = isCustomClip ?? false
  out.clipId = clipId
}
```

Y en el adapter, chequear el sentinel:

```typescript
case 'color': {
  const nr = output.normalizedRgb
  if (nr && nr.r >= 0) {  // sentinel check
    values['red'] = nr.r
    values['green'] = nr.g
    values['blue'] = nr.b
  }
  break
}
```

### 3.4 El Strobe como Smart Gate — diseño correcto

El `NodeArbiter` ya tiene `STRICT_PRIORITY_CHANNELS` que incluye `strobe`. El SmartGate funciona a nivel de canal escrito. El problema es el **valor**, no el routing.

**Diseño propuesto — dos opciones:**

#### Opción A — Threshold binario en el adapter (mínimo cambio)

```typescript
case 'strobe': {
  // Binary gate: thresholding at 0.5 — el shutter es ON/OFF físicamente
  values['strobe'] = output.normalizedValue >= 0.5 ? 1.0 : 0.0
  break
}
```

Esto preserva el routing existente y obliga al `.lfx` a usar `interpolation:'hold'` para sus keyframes de strobe (lo que el migrador ya hace). El threshold es safety contra interpolaciones espurias.

#### Opción B — Canal `strobe_hz` con oscilador en NodeResolver (architectural)

Reservar un nuevo canal `strobe_hz: number ∈ [0, 25]` que el `.lfx` puede setear estático (vía `staticParams`) o como curva. El `NodeResolver` implementa el oscilador real:

```typescript
// In NodeResolver, before final DMX write:
if ('strobe_hz' in record && record['strobe_hz'] > 0) {
  const phase = (now * record['strobe_hz']) % 1
  record['strobe'] = phase < 0.5 ? 1.0 : 0.0
}
```

**Ventaja A:** zero risk, fix inmediato.
**Ventaja B:** semánticamente correcto (el clip declara frecuencia, no patrón).

**Recomendación:** A para WAVE 4828 (Lazarus). B para una WAVE futura cuando se reescriba el oscilador del shutter.

---

## §4. PLAN DE EJECUCIÓN — ORDEN DE OPERACIONES

```
┌────────────────────────────────────────────────────────────────┐
│  WAVE 4828 — LAZARUS PROTOCOL                                  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  PASO 1 — REPARAR EL CURVE PLAYER (1 archivo)                  │
│  ├─ HephaestusRuntime.ts                                       │
│  │   ├─ ensureOutputCapacity: pre-alloc normalizedRgb per slot │
│  │   └─ writeOutput: copy normalizedRgb components             │
│  └─ Verificar: clips con color HSL→RGB llegan al adapter sin   │
│     contaminación cruzada. Test con 2+ fixturas + 2 colores.   │
│                                                                │
│  PASO 2 — STROBE GATE (1 archivo)                              │
│  └─ HephaestusAetherAdapter.ts                                 │
│      └─ case 'strobe': threshold 0.5 → binary 0/1              │
│                                                                │
│  PASO 3 — REWRITE calculateRisk() (1 archivo)                  │
│  └─ EffectDreamSimulator.ts                                    │
│      ├─ DNA-driven risk en lugar de simMeta plano              │
│      ├─ Archetype penalty                                      │
│      └─ Energy mismatch penalty                                │
│                                                                │
│  PASO 4 — ANTI-MONOPOLY (1 archivo)                            │
│  └─ EffectDreamSimulator.ts                                    │
│      ├─ recentWinHistory: Map<effectId, count> (ring buffer)   │
│      └─ score *= 0.5/0.2 cuando wins ≥ 3/5                     │
│                                                                │
│  PASO 5 — ENDURECER REGISTRY GATES (1 archivo)                 │
│  └─ DynamicEffectRegistry.ts                                   │
│      ├─ G4.1: validSections no wildcard                        │
│      ├─ G4.2: aggressionRange.max - min ≥ 0.10                 │
│      └─ G4.3: warning (no reject) si simMeta = defaults        │
│                                                                │
│  PASO 6 — RE-MIGRACIÓN PARCIAL (1 script)                      │
│  └─ migrateLegacyToLfx.ts                                      │
│      ├─ SIM_META_BY_ARCHETYPE table                            │
│      ├─ aggressionRange: ±0.10 alrededor del genome            │
│      └─ validSections derivados del energyZone                 │
│                                                                │
│  PASO 7 — VALIDACIÓN E2E                                       │
│  └─ Reproducir log de fiesta-latina:                           │
│      ├─ RSK debe variar 0.05..0.85 según efecto                │
│      ├─ oro_solido NO debe ganar >2 veces en 10 slots          │
│      ├─ Color de oro_solido debe llegar a movers + pars        │
│      └─ Strobe de industrial_strobe debe ser 0/1, no 0.47      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## §5. CHECKLIST DE VERIFICACIÓN

| Test | Cómo verificarlo | Pass criteria |
|---|---|---|
| Color leak | Disparar 2 clips simultáneos con colores distintos sobre fixturas distintas | Cada fixtura recibe SU color, no el último escrito |
| Strobe gate | Disparar `industrial_strobe.lfx`, observar canal DMX de shutter | Solo valores 0 o 255 (binary), no intermedios |
| Risk variance | Revisar log `[DREAM_RANKING]` en sesión de 60 segundos | RSK varía ≥ 0.30 entre top 5 |
| Anti-monopoly | Sesión de 30 drops latinos | Ningún efecto gana >25% (era 70%+ con oro_solido) |
| L3 dominance preserved | Disparar `cumbia_moon` durante L0 activo | Color L3 visible en pars; L0 silenciado en canales tocados |
| Migration health | Re-ejecutar migrador, contar warnings G4.3 | < 5/47 con flat sim meta tras parche |

---

## §6. NOTAS ARQUITECTÓNICAS FINALES

### 6.1 Lo que el usuario asumía mal

> "El motor de ejecución actual de LuxSync no sabe interpretar Curvas de Bézier en tiempo real."

**Falso.** `CurveEvaluator` interpreta Bézier desde WAVE 2030 con cursor cache O(1). Es production-grade.

> "Esperaba objetos matemáticos legacy o frames .lux."

**Verdadero solo parcialmente.** El path Aether (NodeGraph fixtures) consume `HephFixtureOutput` vía adapter — funciona. El path legacy (no-NodeGraph fixtures) consume el mismo array vía mutación directa en `TitanOrchestrator` — también funciona. Lo que sangra es el **buffer interno del color**.

### 6.2 Lo que el usuario detectó correctamente

> "El algoritmo cognitivo está roto (oro_solido domina con RSK=0.00)."

**Verdadero y crítico.** Causa raíz identificada: simulationMeta defaults idénticos en los 47 .lfx migrados.

### 6.3 Decisión de no construir un compilador `.lfx → .lux`

Compilar a flat frames (60fps × 5s × 47 fixturas × 8 channels) = 705,600 valores por clip × 47 clips = **33M valores** en disco. Versus el formato actual (keyframes + bezier handles) que ocupa <1KB por clip. Además, perder el tiempo real impide:
- Escalado de duración por intensity
- Phase distribution dinámica por número de fixturas
- Interpolación entre live BPM y BPM de referencia

**Veredicto: el formato vivo es el correcto.** Solo hay que reparar al reproductor.

---

## §7. ANEXO — ENLACES A CITACIONES CLAVE

- Curve Player core: `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\hephaestus\runtime\HephaestusRuntime.ts:477-518`
- Color buffer leak: `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\hephaestus\runtime\HephaestusRuntime.ts:551-566`
- Adapter strobe path: `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\HephaestusAetherAdapter.ts:215-280`
- Risk calc: `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\dream\EffectDreamSimulator.ts:767-811`
- Score ensemble: `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\dream\EffectDreamSimulator.ts:1340-1404`
- Default sim meta: `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\arsenal\lfxTypes.ts:259-273`
- Registry gates: `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\arsenal\DynamicEffectRegistry.ts:81-112`

---

*Audit sellada. WAVE 4828 — THE LAZARUS PROTOCOL.*
*Próximo paso: implementación del plan §4 en una sola pasada.*
