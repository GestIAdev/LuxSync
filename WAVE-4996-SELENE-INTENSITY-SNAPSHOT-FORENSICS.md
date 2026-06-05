# WAVE 4996 — Selene Intensity Snapshot: Auditoría Forense

**Fecha:** 2026-06-03  
**Auditor:** KIMI / DEEPSEEK (Forensic Auditor Only)  
**Estado:** SOLO LECTURA — ZERO CODE GENERATION  
**Clasificación:** 🔒 Confidencial — Core Surgery Pending

---

## 1. Resumen Ejecutivo

Cuando Selene dispara un efecto `.lfx` de forma autónoma, la **intensidad del efecto queda congelada ("locked") durante toda su duración** al nivel de energía del instante exacto del disparo. Si el disparo ocurre en un beat débil, el efecto se ve apagado de principio a fin. Los disparos manuales (UI / MIDI / Chronos) se ven a intensidad completa porque bypassan este cálculo.

### Hallazgo Clave
El sistema no implementa **escalado dinámico de energía en tiempo de ejecución** (`energyDriven`). En su lugar, Selene calcula un **escalar único** (`intensity = predictedEnergy`, que en realidad es `context.pattern.energy`) en el milisegundo del disparo, lo inyecta en `HephaestusRuntime.play(...)` como opción estática, y ese valor se multiplica *frame a frame* sobre la curva del JSON. La curva nunca se re-escala; solo se atenúa.

---

## 2. Cadena de Custodia del "Snapshot"

### Paso 1: Cálculo de Intensidad en Selene (DreamEngineIntegrator)

`DreamEngineIntegrator.dreamEffects()` construye un `MusicalPrediction` cuyo campo `predictedEnergy` **no es una predicción futura**, sino el valor de energía *actual* del patrón musical en ese frame:

```typescript
@/electron-app/src/core/intelligence/integration/DreamEngineIntegrator.ts:437
const energy = context.pattern.energy ?? 0.5
```

Luego pasa ese `energy` al `EffectDreamSimulator` como `predictedEnergy`:

```typescript
@/electron-app/src/core/intelligence/integration/DreamEngineIntegrator.ts:459
const musicalPrediction: MusicalPrediction = {
  predictedEnergy: energy,
  ...
}
```

### Paso 2: EfectDreamSimulator — Cálculo de Intensidad Base

`EffectDreamSimulator.calculateIntensity()` toma `predictedEnergy` (que es la energía actual) y la usa como intensidad base, con ajustes por tipo de efecto:

```typescript
@/electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:766-779
private calculateIntensity(predictedEnergy: number, effect: string): number {
  // Intensidad base de la energía predicha
  let intensity = predictedEnergy

  // Ajustar por tipo de efecto
  if (effect.includes('strobe') || effect.includes('laser')) {
    intensity = Math.min(1.0, predictedEnergy * 1.1)
  } else if (effect.includes('wave') || effect.includes('cascade')) {
    intensity = predictedEnergy * 0.8
  }

  return Math.max(0, Math.min(1, intensity))
}
```

**Interpretación forense:** Si `context.pattern.energy = 0.25` (beat débil), `calculateIntensity` devuelve **0.25** (o menos para efectos suaves). No hay lookahead ni proyección de subida de energía.

### Paso 3: Ajuste por Mood (MoodController.applyIntensity)

`DreamEngineIntegrator` pasa la intensidad cruda por `MoodController.applyIntensity()`, que la clampa según el perfil de mood actual:

```typescript
@/electron-app/src/core/mood/MoodController.ts:326-338
applyIntensity(baseIntensity: number): number {
  const profile = this.getCurrentProfile();
  let intensity = baseIntensity;

  // Aplicar máximo
  intensity = Math.min(intensity, profile.maxIntensity);

  // Aplicar mínimo (solo PUNK tiene esto)
  if (profile.minIntensity !== undefined) {
    intensity = Math.max(intensity, profile.minIntensity);
  }

  return intensity;
}
```

**Efecto colateral:** Si el mood es `CALM` con `maxIntensity = 0.6`, un disparo en un pico de `energy = 0.9` se recorta a `0.6`. Pero lo crítico es lo opuesto: si `energy = 0.2` y no hay `minIntensity`, la intensidad sale **0.2**.

### Paso 4: DecisionMaker — Embalaje en ConsciousnessOutput

`DecisionMaker` recibe el `dreamIntegration` y empaqueta la decisión en `output.effectDecision`:

```typescript
@/electron-app/src/core/intelligence/think/DecisionMaker.ts:887-892
output.effectDecision = {
  effectType: dnaEffect.effect,
  intensity: dnaEffect.intensity,   // ← valor congelado aquí
  zones: dnaEffect.zones as (...),
  reason: `🧬 DNA: ${dreamIntegration.dreamRecommendation}...`,
  confidence: dreamIntegration.ethicalVerdict?.ethicalScore ?? 0.85,
}
```

Este objeto `effectDecision` viaja inmutable por `SeleneTitanConscious` y llega a `TitanEngine`.

### Paso 5: TitanEngine — Disparo Autónomo

En el hot-path de `TitanEngine`, si `consciousnessOutput.effectDecision` existe, se dispara:

```typescript
@/electron-app/src/engine/TitanEngine.ts:1026-1049
else if (consciousnessOutput.effectDecision) {
  const { effectType, intensity, reason, confidence } = consciousnessOutput.effectDecision

  if (confidence > 0.6) {
    this.effectManager.trigger({
      effectType,
      intensity,       // ← snapshot inyectado en EffectManager
      source: consciousnessOutput.source,
      reason,
      musicalContext: processedContext as any,
    })
  }
}
```

### Paso 6: EffectManager — Construcción de ConsciousnessEffectDecision

`EffectManager.trigger()` recibe el `config` y construye un `ConsciousnessEffectDecision` que se pasa al `SeleneHephBridge`:

```typescript
@/electron-app/src/core/effects/EffectManager.ts:444-452
const decision: ConsciousnessEffectDecision = {
  effectType: config.effectType,
  intensity: shieldResult.degraded && shieldResult.constraints?.maxIntensity !== undefined
    ? Math.min(config.intensity, shieldResult.constraints.maxIntensity)
    : config.intensity,
  zones: config.zones as any,
  reason: config.reason,
  confidence: 1.0,
}
```

### Paso 7: SeleneHephBridge — Resolución de PlayParams

El bridge recibe la decisión y resuelve `ResolvedPlayParams`. La lógica es crítica:

```typescript
@/electron-app/src/core/arsenal/SeleneHephBridge.ts:317-323
function _resolvePlayParams(...) {
  // Intensity scaling: 'fixed' ignora la intensity de Selene.
  const intensity =
    entry.execHints.intensityScaling === 'fixed'
      ? 1.0
      : _clamp01(decision.intensity)

  return {
    effectId: entry.id,
    filePath: entry.filePath,
    intensity,               // ← valor final inyectado al runtime
    ...
    intensityScaling: entry.execHints.intensityScaling,
    ...
  }
}
```

**Nota clave:** El tipo `IntensityScaling` admite `'proportional' | 'fixed' | 'energyDriven'`, pero en la práctica solo `'fixed'` tiene tratamiento especial. `'energyDriven'` cae al mismo `_clamp01(decision.intensity)` que `'proportional'`, lo que significa que **no existe escalado dinámico en runtime**.

### Paso 8: HephaestusRuntime — Recepción del Snapshot

`HephaestusRuntime.play()` recibe `options.intensity` y lo almacena en el `ActiveHephClip`:

```typescript
@/electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts:481-491
const activeClip: ActiveHephClip = {
  instanceId,
  filePath,
  clip,
  tracks,
  startTimeMs: now,
  durationMs,
  intensity: options.intensity ?? 1.0,   // ← snapshot congelado
  loop: options.loop ?? false,
  phaseConfig,
}
```

### Paso 9: Tick — Multiplicación Estática Frame a Frame

Durante cada frame, `tickActive` lee `active.intensity` (el mismo valor del paso 8) y lo pasa a `_emitTrackSample`:

```typescript
@/electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts:674-677
private tickActive(active: ActiveHephClip, baseClipTimeMs: number): void {
  const intensity = active.intensity   // ← valor del snapshot, NUNCA actualizado
  ...
  this._emitTrackSample(track, ..., intensity, ...)
}
```

Y dentro de `_emitTrackSample`, el snapshot se multiplica sobre el valor de la curva:

**Para parámetros numéricos (intensidad, dimmer, etc.):**

```typescript
@/electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts:764-770
} else {
  const rawValue = evaluator.getValue(paramName, timeMs)
  const withIntensity = rawValue * intensity          // ← multiplicación estática
  const scaledValue = scaleToDMX(paramName, withIntensity)
  ...
  this.writeOutput(fixtureId, 'all', paramName, scaledValue, ...)
}
```

**Para colores (HSL → RGB):**

```typescript
@/electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts:754-762
if (track.valueType === 'color') {
  const hsl = evaluator.getColorValue(paramName, timeMs)
  // Intensity modula lightness — preserva hue/sat
  const modulatedL = (hsl.l / 100) * intensity       // ← atenúa el lightness
  const rgb = hslToRgb(hsl.h, hsl.s / 100, modulatedL)
  ...
  this.writeOutput(...)
}
```

**Conclusión técnica:** El valor `intensity` es un **escalar estático inmutable** durante toda la vida del clip. No se recalcula en función de la energía musical posterior, ni siquiera se consulta `context.pattern.energy` nuevamente. Es un **snapshot**.

---

## 3. Vía Manual — Contraste Forense

### Disparo Manual (UI / Botón FORCE STRIKE)

```typescript
@/electron-app/src/engine/TitanEngine.ts:1629-1632
public forceStrikeNextFrame(config: ForceStrikeConfig): void {
  this.manualStrikePending = config
  console.log(`[TitanEngine] 🧨 ... strike queued: ${config.effect} @ ${config.intensity.toFixed(2)}`)
}
```

En el main loop, el manual strike tiene **prioridad absoluta** sobre la IA:

```typescript
@/electron-app/src/engine/TitanEngine.ts:1008-1023
if (this.manualStrikePending) {
  const { effect, intensity, source, hephCurves, scope } = this.manualStrikePending

  this.effectManager.trigger({
    effectType: effect,
    intensity,              // ← valor explícito del operador (típicamente 1.0)
    source: source || 'manual',
    reason: 'Manual strike from FORCE STRIKE button',
    ...
  })
  ...
}
```

### Disparo UI (QuickActions)

Los botones de efecto rápido en la UI envían parámetros con `intensity: 1.0` hardcodeado:

```typescript
@/electron-app/src/components/commandDeck/QuickActions.tsx:88-95
function getEffectParams(effectId: EffectId): Record<string, number> {
  switch (effectId) {
    case 'strobe': return { rate: 10, intensity: 1.0 }
    case 'blinder': return { intensity: 1.0, dimmer: 255 }
    case 'smoke': return { amount: 1.0, duration: 3000 }
    default: return {}
  }
}
```

Aunque `EffectManager.trigger()` recibe la intensidad del config directamente, el punto clave es que **el operador humano nunca pasa por `predictedEnergy` ni `MoodController.applyIntensity`**. El humano manda un escalar explícito (generalmente `1.0`), y ese es el que llega al HephaestusRuntime.

### Disparo Chronos (Timeline)

```typescript
@/electron-app/src/engine/TitanEngine.ts:551-559
this.effectManager.trigger({
  effectType: trigger.effectId,
  intensity: trigger.intensity,   // ← valor del timeline, generalmente 1.0
  zones: trigger.zones,
  source: 'chronos',
  reason: `Chronos Timeline [clip: ${trigger.sourceClipId}]`,
  ...
})
```

Chronos también bypassa el cálculo de energía de Selene.

---

## 4. Tabla Comparativa

| Canal | Intensidad calculada por | Valor típico en beat débil (E=0.25) | Valor típico en pico (E=0.9) | ¿Mutable durante clip? |
|-------|--------------------------|--------------------------------------|------------------------------|------------------------|
| **Autónomo (Selene)** | `predictedEnergy = context.pattern.energy` | **0.25** | 0.9 (clampado por mood) | **NO — snapshot** |
| **Manual (UI)** | Operador humano | **1.0** | 1.0 | NO — explícito |
| **Chronos** | Timeline keyframe | **1.0** | 1.0 | NO — explícito |
| **DIVINE Strike** | Hardcode `intensity: 1.0` | **1.0** | 1.0 | NO — hardcode |

---

## 5. Veredicto de Causa Raíz

**BUG CLASS:** Snapshot Intensity Lock (SIL)

**MECANISMO:**
1. `EffectDreamSimulator.calculateIntensity()` deriva la intensidad de `context.pattern.energy`, que es la energía *instantánea* del frame de disparo.
2. `MoodController.applyIntensity()` puede recortar el techo (`maxIntensity`) o elevar el piso (`minIntensity`), pero nunca re-escribe el valor en runtime.
3. `HephaestusRuntime` recibe `options.intensity` en `play()` y lo almacena en `ActiveHephClip.intensity`.
4. En cada `tick()`, `_emitTrackSample()` multiplica el valor de la curva por ese escalar inmutable.

**RESULTADO OBSERVABLE:**
- Si Selene decide disparar en un valle de energía (`energy = 0.2`), el efecto `.lfx` se reproduce al 20% de brillo durante **todos sus 4000 ms** de duración, incluso si la música sube a un drop 500 ms después.
- Los disparos manuales nunca sufren esto porque el operador envía `intensity = 1.0`.

**NOTA SOBRE `energyDriven`:**
El tipo `IntensityScaling` incluye `'energyDriven'`, pero `SeleneHephBridge._resolvePlayParams()` no implementa lógica diferente para él. Fallback a `_clamp01(decision.intensity)` como `'proportional'`. **La infraestructura para re-escalar dinámicamente no existe.**

---

## 6. Blancoquirúrgico Recomendado (NO IMPLEMENTAR — solo referencia)

Si en WAVE posterior se autoriza cirugía, el fix mínimo es:

1. **En `HephaestusRuntime.tickActive()`:** Leer `active.intensity` NO del `ActiveHephClip`, sino consultando el `TitanOrchestrator` o `MoodController` por la energía *actual* en cada frame, **si y solo si** `entry.execHints.intensityScaling === 'energyDriven'`.
2. **En `SeleneHephBridge._resolvePlayParams()`:** Implementar la rama `energyDriven` para que pase `intensity = 1.0` (o un escalar base) y señalice al runtime que debe re-escalar por energía en vivo.
3. **Alternativa no invasiva:** En `EffectDreamSimulator.calculateIntensity()`, usar `max(predictedEnergy, someMinimum)` para evitar disparos "fantasma" en valles profundos.

---

*Fin del informe forense WAVE 4996.*
