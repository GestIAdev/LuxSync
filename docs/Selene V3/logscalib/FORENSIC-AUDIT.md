# Auditoría Forense: La Ceguera Musical de Selene

**Fecha:** 9 Jul 2026  
**Log fuente:** `crazyselene.md`  
**Código fuente auditado:** `SeleneTitanConscious.ts`, `ContextualMemory.ts`, `CognitiveFluidState.ts`, `SensorFusionChamber.ts`, `IgnitionChamber.ts`, `ILiquidCognitionProfile.ts`

---

## 1. El Agujero de Cassandra — Disparo con Z-Score negativo

### Síntoma del log

```
L333: [SeleneTitanConscious] 🔮👑 CASSANDRA SOVEREIGN CLOCK: firing "Abyssal Rise" | overdue=10ms
L340: [EffectManager 🔥] Abyssal Rise [abyssal_rise] FIRED [hunt] in techno-club ⚡[HEPH-BRIDGE] | I:1.00 Z:-1.4
```

**Abyssal Rise dispara con Z=-1.4σ (energía por los suelos) e I=1.00 (intensidad máxima).**

### Evidencia forense en código

El Sovereign Clock vive en `SeleneTitanConscious.ts:583-690`. Cuando la ventana soberana se cumple (`withinSovereignWindow`), el sistema extrae el candidato pre-bufferizado y construye un `sovereignOutput` con **bypass total** de HuntEngine, Fuzzy y EnergyOverride (línea 646: `"bypassing HuntEngine + Fuzzy + EnergyOverride"`).

El único seguro de energía que existe es el **DIVINE LEAK FIX B** (líneas 612-633):

```typescript
// SeleneTitanConscious.ts:622
const registryEntry = getDynamicEffectRegistry().getEntry(candidate.effect)
if (registryEntry?.simMeta.isDivineCandidate) {   // ← SOLO divine candidates
  const energyTooLow = titanState.rawEnergy < 0.50
  if (v3EpicnessNow <= V3_EPSILON_DIVINE || energyTooLow) {
    divineAborted = true
  }
}
```

**El bug:** El guardia `isDivineCandidate` solo protege contra efectos divinos. `abyssal_rise` NO es un divine candidate — es un efecto de categoría menor. El guardia no se aplica, y el efecto se dispara a ciegas sin importar la energía.

### Contraste con Binary Glitch (que SÍ es divine)

El log muestra dos casos donde Binary Glitch (divine candidate) SÍ fue abortado correctamente:

```
L516: [Sovereign Clock 🛡️] DIVINE ABORTED: "Binary Glitch" V3 epicness=0.004 ≤ ε=0.6 → buffer cleared
L610: [Sovereign Clock 🛡️] DIVINE ABORTED: "Binary Glitch" V3 epicness=0.000 ≤ ε=0.6 OR energy=0.31 < 0.50
```

**Conclusión:** El seguro funciona para efectos divinos. Pero deja un agujero completo para TODO el resto del arsenal. Cassandra puede disparar cualquier efecto no-divino en cualquier valle energético.

### Línea de tiempo del incidente Abyssal Rise

| Línea log | Evento | Energía |
|---|---|---|
| L181-182 | Oracle predice `drop_incoming` conf=0.696, timeToEvent=4000ms | — |
| L189 | Pre-buffer almacenado: "Abyssal Rise" para drop en ~4s | — |
| L206 | `E:-2.4σ B:-1.9σ H:-2.7σ` → valle profundo | E≈0.22 |
| L207-211 | FAST PATH libera abyssal_rise, Gatekeeper bloquea (epicness=0.000) | — |
| L280 | `E:-2.3σ B:-2.0σ H:-1.7σ` → sigue en valle | — |
| L333 | **SOVEREIGN CLOCK dispara Abyssal Rise** (overdue=10ms) | Z=-1.4 |
| L340 | **FIRED** I:1.00 Z:-1.4 | E≈0.22 |

El Gatekeeper bloqueó el efecto dos veces (L211, L279) cuando intentó pasar por el pipeline normal. Pero Cassandra lo disparó por la puerta trasera del Sovereign Clock, saltándose el Gatekeeper también.

---

## 2. La Alucinación de la Memoria Contextual — CLIMAX en silencio total

### Síntoma del log

```
L235: [MEMORY 🧠] E:-2.2σ 🟡 B:-1.8σ 🟡 H:-1.8σ 🟡 | Phase: CLIMAX | normal
```

**Energía, graves y agudos a -2 desviaciones estándar (silencio casi total), pero la fase es CLIMAX.**

Otros ejemplos en el mismo log:

```
L13:  E:-1.1σ B:-0.5σ H:+0.5σ | Phase: CLIMAX    (energía baja, fase climax)
L227: E:-0.2σ B:-0.9σ H:-0.1σ | Phase: CLIMAX    (todo negativo, fase climax)
L390: E:-0.8σ B:-1.4σ H:+0.1σ | Phase: CLIMAX    (graves a -1.4σ, fase climax)
```

### Evidencia forense en código

La fase narrativa se calcula en `ContextualMemory.ts:400-424`:

```typescript
// ContextualMemory.ts:400
private inferNarrativePhase(history: SectionHistoryEntry[], current: SectionType): NarrativePhase {
  // Fase directa por sección actual
  if (current === 'intro') return 'intro'
  if (current === 'outro') return 'outro'
  if (current === 'drop' || current === 'chorus') return 'climax'   // ← MAPEO CIEGO
  if (current === 'breakdown' || current === 'bridge') return 'release'
  // ...
}
```

**El bug:** La fase se deriva **exclusivamente del `sectionType`** que reporta `MusicalPatternSensor`. No consulta energía, Z-scores, ni bandas de frecuencia. Si el sensor de secciones dice `"drop"`, la fase es `"climax"` automáticamente, aunque la música esté en silencio.

### Propagación del daño

La fase narrativa alimenta el cálculo de **epicness** en `CognitiveFluidState.ts:263-270`:

```typescript
// CognitiveFluidState.ts:263
const phase = input.contextualPhase
const phaseModifier = phase === 'climax' ? 1.0       // ← Multiplicador PLENO
  : phase === 'building' ? 0.5
  : phase === 'release' ? 0.7
  : phase === 'intro' ? 0.3
  : phase === 'outro' ? 0.3
  : 0.5
this._epicness = clamp01(baseEpicness * energyFactor * phaseModifier)
```

Cuando la fase es `climax`, el `phaseModifier = 1.0` — **sin penalización**. En un valle real (E≈0.22), `energyFactor = clamp01((0.22 - 0.30) / 0.40) = 0`, lo que salva el epicness a 0. Pero el `phaseModifier` sigue dando el **máximo multiplicador** a un momento que debería ser `release` o `valley`.

El problema se agranta por `energyFactor` en este caso, pero el diagnóstico de fase es **falso** y contamina la telemetría, el logging, y cualquier consumidor futuro que confíe en `narrativePhase`.

### Por qué el sensor de secciones miente

`MusicalPatternSensor.ts:202-204` clasifica la sección desde `state.sectionType` que viene del TitanEngine/FFT:

```typescript
function classifySection(sectionType: string): SectionClassification {
  const normalized = sectionType.toLowerCase().trim()
  return SECTION_MAP[normalized] ?? 'verse'
}
```

Es un **mapeo estático de strings**. No hay validación energética. Si el FFT dice `"drop"`, es `"drop"` aunque los graves hayan desaparecido. La sección se determina por estructura de la pista (marcadores, beatgrid), no por el contenido sonoro real en tiempo de ejecución.

---

## 3. La Idolatría de los Graves — Impacto ciego a texturas agudas

### Síntoma del log

En el momento del disparo de Abyssal Rise (L333-340), el FFT muestra:

```
L224: [FFT X-RAY 🎧] 3s Avg -> LOW: 0.370 | MID: 0.084 | HIGH: 0.018 | TOTAL: 0.283
L237: [FFT X-RAY 🎧] 3s Avg -> LOW: 0.353 | MID: 0.255 | HIGH: 0.069 | TOTAL: 0.346
```

**TOTAL cae a 0.28-0.35** porque los graves (LOW) colapsaron de ~0.85 a ~0.37. Los agudos (HIGH) son irrelevantes (0.02-0.07). Para Selene, esto es un valle.

Pero si la música hubiera hecho un "drop hacia arriba" (cortar graves, entrar voz chillando), los agudos subirían pero TOTAL caería igual. Selene no lo vería.

### Evidencia forense en código

La fórmula de Impacto vive en `CognitiveFluidState.ts:173-177`:

```typescript
// CognitiveFluidState.ts:173
// 3. Impacto I(t) = w_z·ẑ + w_cf·CF̂ + w_e·Ê
const zHat = Math.tanh(input.zScore / p.z_ref)
const eHat = input.rawEnergy / Math.max(input.energyMaxHistoric, 0.01)
this._impact = clamp01(p.w_z * zHat + p.w_cf * cfHat + p.w_e * eHat)
```

Con los pesos del perfil (`ILiquidCognitionProfile.ts:151-153`):

```typescript
w_z: 0.45,   // Z-Score de ENERGÍA TOTAL
w_cf: 0.30,  // Factor de Cresta sobre ENERGÍA TOTAL
w_e: 0.25,   // Energía cruda normalizada
```

**Tres términos, todos dependientes de la energía total:**

1. **`ẑ` (w_z=0.45):** Es `tanh(zScore / z_ref)` donde `zScore` es el Z-Score de **energía total** de `ContextualMemory.energyStats`. No hay Z-Score de agudos ni de graves por separado. Cuando los graves caen, `zScore` va negativo, y `tanh(-1.4/3.0) = -0.42`, contribuyendo **-0.19** al impacto.

2. **`CF̂` (w_cf=0.30):** El factor de cresta se calcula en `CognitiveFluidState.ts:157-170`:
   ```typescript
   this._rmsEnergy += ALPHA_RMS * (input.rawEnergy - this._rmsEnergy)
   if (input.rawEnergy > this._peakEnergyWindow) {
     this._peakEnergyWindow = input.rawEnergy
   }
   const cfRaw = this._rmsEnergy > 0.001 ? this._peakEnergyWindow / this._rmsEnergy : 1.0
   ```
   Usa `rawEnergy` (energía total). Un pico vocal en agudos que no mueva la aguja de energía total no genera cresta. El "chillido" es invisible.

3. **`Ê` (w_e=0.25):** `rawEnergy / energyMaxHistoric`. Si la energía total cae, este término cae.

### Lo que existe pero NO se usa en Impacto

`FluidStateInput` (líneas 45-71) recibe `bassPresence` y `midPresence`, pero **no `highPresence`**. Y los que recibe solo se usan en `SensorFusionChamber` para el filtro anti-voz `s_V` (líneas 146-151):

```typescript
// SensorFusionChamber.ts:148
const midBassRatio = input.midPresence / (input.bassPresence + EPSILON)
const vocalSig = 1 / (1 + Math.exp(-(p.kappa_v * (midBassRatio - p.rho_v))))
const vocalDominance = vocalSig * (1 - input.crestFactor)
const s_V = 1 - p.kappa_vmax * vocalDominance
```

Este filtro **penaliza** la presencia de voz (mid > bass), reduciendo `s_V` y por tanto la confianza `C(t)`. Es decir: cuando una voz entra y los graves bajan, el sistema **reduce** la confianza en lugar de reconocer un cambio de textura. Un "drop hacia arriba" es doblemente invisible: el impacto cae (energía total baja) y la confianza cae (filtro anti-voz activado).

### ContextualMemory sí tiene harshness Z-Score... pero no se usa

`ContextualMemory.ts:259` calcula `harshnessStats` con Z-Score propio. Pero este Z-Score **nunca llega al cálculo de Impacto**. Solo se usa en `detectAnomaly` (línea 460) para clasificar anomalías. El impacto vive en un módulo separado (`CognitiveFluidState`) que solo recibe `zScore` de energía.

### Resumen de la ceguera

| Señal musical | ¿Selene la ve? | Dónde debería verse |
|---|---|---|
| Drop de graves (bass ↑) | ✅ Sí | `zScore` positivo + `rawEnergy` alto |
| Valle de graves (bass ↓) | ✅ Sí (como valle) | `zScore` negativo + `rawEnergy` bajo |
| Drop hacia arriba (graves ↓, agudos ↑) | ❌ No | `zScore` negativo mata el impacto |
| Chillido vocal (agudos ↑↑, graves →) | ❌ No | `s_V` lo penaliza como "voz" |
| Cambio de textura (spectral shift) | ❌ No en impacto | `harshness` Z-Score existe pero no alimenta `I(t)` |

---

## Resumen de las 3 raíces

| # | Bug | Archivo | Línea | Causa raíz |
|---|---|---|---|---|
| 1 | Sovereign Clock sin guardia energética para efectos no-divinos | `SeleneTitanConscious.ts` | 622 | `isDivineCandidate` gate deja pasar todo el arsenal no-divino |
| 2 | Phase = CLIMAX sin validar energía | `ContextualMemory.ts` | 404 | `inferNarrativePhase` mapea `sectionType` → fase sin consultar Z-scores |
| 3 | Impacto sordo a agudos y crestas vocales | `CognitiveFluidState.ts` | 173-177 | `I(t)` usa solo energía total + Z-score de energía total + cresta de energía total |

**Los tres bugs comparten la misma patología arquitectónica:** Selene oye el mundo a través de un solo canal (energía total / graves) y trata las texturas espectrales como ruido a filtrar, no como señales a interpretar.
