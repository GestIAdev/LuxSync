Entendido. Auditoría READ-ONLY. Voy a rastrear el pipeline de detección de snare, el `rawDelta`, el `fLb`, y los cambios del 5 AM. Déjame empezar localizando el `LiquidEngineBase` y los componentes de detección de audio.

Buen inicio. Déjame leer las secciones clave en detalle — el `RhythmicPercussionTracker` completo, el `LiquidEngineBase` para `fLb`, y cualquier referencia a `rawDelta`:

Déjame buscar `fLb` más específicamente — podría ser una abreviatura de variable. Y también buscar el `fluxBaseline` y la lógica de detección de snare completa:

Ahora tengo el núcleo. Déjame leer el bloque completo de detección de snare 4D en `LiquidEngineBase.ts` (líneas 638-840) y la definición de bandas del `RhythmicPercussionTracker` en `GodEarFFT.ts`:

Ahora déjame leer el `RhythmicPercussionTracker` en `GodEarFFT.ts` — la definición de bandas y la lógica de detección:

Ahora déjame revisar el `spectralFlux` y `whiteNoiseScore` (photon) — de dónde vienen y cómo se calculan:

Déjame ver cómo se calcula exactamente el `spectralFlux` y el `whiteNoiseScore` — el photon block:

Ahora déjame verificar la definición de bandas de frecuencia en GodEarFFT y el `tonalSquelch` en LiquidEngineBase:

Ahora déjame encontrar las frecuencias exactas de las bandas (subBass, bass, lowMid, mid, highMid, treble):

Tengo la definición completa de bandas. Ahora déjame verificar si hay algún cooldown restante en el path del snare en `LiquidEngineBase` — el `_snareImpulse < 0.15` actúa como retrigger guard:

Tengo el cuadro completo. Ahora voy a compilar el reporte de diagnóstico.

---

## WAVE 7749.41 — DIAGNÓSTICO: LA ESQUIZOFRENIA DEL SNARE (READ-ONLY)

### Arquitectura del pipeline de detección de snare

```
GodEarFFT.ts (Worker, ~44Hz)
├── RhythmicPercussionTracker
│   ├── Bandas: snareBody (150-250Hz), snareCrack (2-5kHz), hh (5-15kHz)
│   ├── extractSubBandRaw() → energía UNCLAMPED de crack
│   ├── crackDelta = snareCrack - _prevSnareCrackRaw  (frame-to-frame)
│   └── Exporta: { snare_energy (EMA), raw_snare_delta (=crackDelta) }
│
├── computeSpectralFlux() → spectralFlux V3 (half-wave rectified, whitened)
├── calculateSpectralFlatness() → flatness → whiteNoiseScore
└── photon = { spectralFlux, whiteNoiseScore, ... }

LiquidEngineBase.ts (Main thread, ~44Hz)
├── tonalSquelch = ratio percussive/harmonic (0.0 / 0.30 / 0.50 / 1.0)
├── rawSnare = bands.highMid * tonalSquelch - bassLeakage  (path legacy, NO usado para 4D)
│
├── WAVE 7749.7: 4D ONSET DETECTION (el path activo)
│   ├── rawSnareDelta = input.raw_snare_delta  (crackDelta del worker)
│   ├── spectralFlux = photon?.spectralFlux ?? 1  ← FALLBACK PERMISSIVE
│   ├── wns = photon?.whiteNoiseScore ?? 1         ← FALLBACK PERMISSIVE
│   ├── _fluxBaseline = EMA lenta de spectralFlux (~500ms)
│   │
│   ├── finalSnareThreshold = max(0.06, 0.12 - (fBL-0.05)*2.0)  [DINÁMICO]
│   ├── dynamicFluxGate    = max(0.10, 0.15 - (fBL-0.05)*1.0)  [DINÁMICO]
│   │
│   └── rawOnset = true si:
│       rawSnareDelta > finalSnareThreshold
│       AND spectralFlux > dynamicFluxGate
│       AND _snareImpulse < 0.15  (retrigger guard)
│       AND (wns > 0.05  OR  spectralFlux > 0.20  OR  snareEnergy > 0.40)
│
├── Sustain Choke: si no hay onset y E < 0.15 → choke exponencial
└── Tonality Veto: (flatnessGate + wnsGate + fluxGate) / 3 → soft-knee 0.15
```

---

### HALLAZGO 1: Las bandas de frecuencia NO fueron ensanchadas — el problema NO está aquí

**Estado:** Las bandas del `RhythmicPercussionTracker` están correctamente definidas:
- `snareBody`: 150-250Hz (cuerpo del redoblante, saturado por kick en techno)
- `snareCrack`: **2000-5000Hz** (el "snap" del redoblante)
- `hh`: 5000-15000Hz (hi-hats/cymbals)

La banda `highMid` del GodEarBands (2000-6000Hz) se usa en el path legacy `rawSnare = bands.highMid * tonalSquelch - bassLeakage`, pero **ese path ya no alimenta el 4D onset detection**. El 4D usa exclusivamente `raw_snare_delta` (crackDelta del worker), que viene de la banda 2-5kHz. Esto es correcto y estrecho.

**Veredicto:** ❌ No es la causa. Las bandas están bien.

---

### HALLAZGO 2: Los umbrales dinámicos colapsan a casi cero durante buildups — **ESTA ES LA CAUSA PRINCIPAL**

El arquitecto del 5AM implementó **dos umbrales dinámicos** que se escalan con `_fluxBaseline` (fBL):

```typescript
// WAVE 7749.22: DYNAMIC FBL THRESHOLD
this._fluxBaseline = this._fluxBaseline * 0.98 + spectralFlux * 0.02  // tau ~500ms
const dynamicSnareThreshold = 0.12 - (Math.max(0, this._fluxBaseline - 0.05) * 2.0)
const finalSnareThreshold = Math.max(0.06, dynamicSnareThreshold)

// WAVE 7749.23: DYNAMIC FLUX GATE
const dynamicFluxGate = Math.max(0.10, 0.15 - (Math.max(0, this._fluxBaseline - 0.05) * 1.0))
```

**El problema:** `spectralFlux` mide la tasa de cambio espectral de **toda la banda** (no solo percusión). Un synth lead sostenido con vibrato/modulación produce `spectralFlux` continuo de 0.06-0.10. Durante una sección densa con sintetizadores + percussion:

| Escenario | fBL | finalSnareThreshold | dynamicFluxGate |
|-----------|-----|---------------------|-----------------|
| Normal (solo drums) | 0.05 | **0.12** | **0.15** |
| Buildup con synths | 0.08 | **0.06** | **0.12** |
| Drop con synth lead | 0.10+ | **0.06** (clamped) | **0.10** (clamped) |

Cuando `finalSnareThreshold` cae a **0.06** y `dynamicFluxGate` cae a **0.10**, cualquier synth lead con:
- `crackDelta` > 0.06 (un synth con contenido en 2-5kHz que modula ligeramente)
- `spectralFlux` > 0.10 (casi cualquier señal activa)

...**dispara como snare onset**. El `crackDelta` es un delta frame-a-frame de la energía en 2-5kHz — un synth lead con filter sweeps o vibrato produce deltas de 0.06-0.15 constantemente.

**Veredicto:** ✅ **CAUSA PRINCIPAL.** Los umbrales dinámicos se diseñaron para atrapar redobles de snare en buildups donde la compresión AGC aplasta los transientes. Pero el colateral es que durante buildups/drops con synth leads, el umbral cae tanto que los leads disparan continuamente.

---

### HALLAZGO 3: El retrigger guard (`_snareImpulse < 0.15`) es insuficiente

```typescript
if (rawSnareDelta > finalSnareThreshold && spectralFlux > dynamicFluxGate && this._snareImpulse < 0.15) {
```

El `_snareImpulse` decay rate es `0.40` por frame (~120ms para 1.0→0.01). Esto significa que después de un onset:
- Frame 0: impulse = 1.0
- Frame 1: impulse = 0.40
- Frame 2: impulse = 0.16
- Frame 3: impulse = 0.064 → **< 0.15, re-armado**

A ~44Hz, 3 frames = **~68ms**. El retrigger guard permite un nuevo onset cada ~68ms. Para redobles de snare (8-16 hits/segundo = 62-125ms entre hits), esto es correcto. **Pero para un synth lead sostenido**, que produce `crackDelta > 0.06` continuamente, esto significa que **cada 68ms hay un nuevo "onset"** → el back par strobea a ~15Hz.

**Veredicto:** ⚠️ **CAUSA SECUNDARIA.** El retrigger guard fue diseñado para redobles (correcto), pero no discrimina entre un redoblante real y un synth lead que produce deltas continuos.

---

### HALLAZGO 4: Los fallbacks permissivos del photon abren una puerta trasera

```typescript
const spectralFlux = photon?.spectralFlux ?? 1  // fallback: allow if no photon
const wns = photon?.whiteNoiseScore ?? 1        // fallback: allow if no photon
```

Si por cualquier razón el `photon` no llega (IPC drop, worker lag, primer frame), `spectralFlux = 1` y `wns = 1`. Esto significa que **cualquier `rawSnareDelta > 0.06` dispara como snare** sin ningún filtro espectral. En condiciones normales el photon llega, pero durante glitches de IPC o CPU spikes, esta puerta trasera puede causar ráfagas de falsos positivos.

**Veredicto:** ⚠️ **CAUSA TERCIARIA.** No es el problema principal pero agrava los glitches.

---

### HALLAZGO 5: El bypass de "synthesized snare" (Flux > 0.20) no discrimina synth lead de synth snare

```typescript
} else if (spectralFlux > 0.20) {
  // WAVE 7749.18: HIGH-FLUX BYPASS — Synthesized snare detection
  rawOnset = true
}
```

Este bypass fue diseñado para snares sintetizados en melodic techno (Anyma) que tienen WNS=0 pero Flux explosivo. El problema: un **synth stab** con attack rápido o un **filter sweep** que cruza frecuencias también produce `spectralFlux > 0.20` en un frame. El bypass no verifica que el flux sea **transitorio** (pico y caída) vs **sostenido** (alto continuo).

**Veredicto:** ⚠️ **CAUSA SECUNDARIA en melodic techno.** Un synth lead con filter modulation puede disparar el bypass de Flux > 0.20 periódicamente.

---

### HALLAZGO 6: El "Energy-Conditioned Border Zone Bypass" (E > 0.40) es un bypass adicional sin discriminación transitoria

```typescript
} else if (snareEnergy > 0.40) {
  // WAVE 7749.19: ENERGY-CONDITIONED BORDER ZONE BYPASS
  rawOnset = true
}
```

`snareEnergy` es la EMA del `RhythmicPercussionTracker` con attack 0.85 / release 0.06. Un synth lead fuerte con contenido en 2-5kHz puede mantener `snareEnergy > 0.40` de forma sostenida. Cuando el `dynamicFluxGate` cae a 0.10-0.12, este bypass se activa continuamente.

**Veredicto:** ⚠️ **CAUSA SECUNDARIA.** Otro bypass que asume que E > 0.40 = snare real, pero los synth leads en 2-5kHz también alcanzan esa energía.

---

### HALLAZGO 7: El Tonality Veto está calibrado para no matar snares reales — pero tampoco mata synth leads

```typescript
const vetoFactor = (flatnessGate + wnsGate + fluxGate) / 3.0
hybridSnare *= (vetoFactor > 0.15 ? 1.0 : (vetoFactor / 0.15))
```

Los floors del veto son extremadamente bajos:
- `flatFloor = 0.04`, `flatKnee = 0.25`
- `wnsFloor = 0.04`, `wnsKnee = 0.35`
- `fluxFloor = 0.05`, `fluxKnee = 0.30`

Un synth lead con vibrato puede tener `flatness = 0.08` (gate = 0.19), `wns = 0.02` (gate = 0), `flux = 0.15` (gate = 0.40). Veto = (0.19 + 0 + 0.40) / 3 = **0.20** → **pasa sin penalización** (0.20 > 0.15).

El veto fue diseñado para matar vocales consonants y bass pops (señales muy tonales con flatness < 0.04), no para matar synth leads con contenido broadband moderado.

**Veredicto:** ⚠️ **El veto no atrapa synth leads.** Los synth leads modernos (supersaw, wavetable) tienen suficiente contenido armónico para pasar el veto.

---

### HALLAZGO 8: El Sustain Choke tiene un agujero para energía alta

```typescript
if (this._snareSustainFrames > chokeThreshold && rawSnareEnergy < 0.15) {
  this._snareChokeFactor *= (p.snareChokeRate ?? 0.70)
} else if (rawSnareEnergy >= 0.15) {
  this._snareChokeFactor = 1.0  // ← HOLD: no choke si energía alta
}
```

Un synth lead fuerte en 2-5kHz mantiene `snareEnergy > 0.15` continuamente → el choke **nunca se activa** → `hybridSnare` se mantiene en 1.0 entre "onsets" del synth lead → el back par no se apaga entre falso-onsets.

**Veredicto:** ⚠️ **El choke no ayuda con synths fuertes.** El guard de `E >= 0.15` fue diseñado para techno con percussion continua, pero también aplica a synth leads fuertes.

---

## RESUMEN DE DIAGNÓSTICO

| # | Componente | Estado | Impacto |
|---|-----------|--------|---------|
| 1 | Bandas de frecuencia (2-5kHz crack) | ✅ Correctas | No es la causa |
| 2 | **Umbrales dinámicos fBL (7749.22/23)** | 🔴 **Colapsan a 0.06/0.10** | **CAUSA PRINCIPAL** |
| 3 | Retrigger guard (_snareImpulse < 0.15) | ⚠️ 68ms re-arm | No discrimina redoblante vs synth |
| 4 | Fallbacks permissivos (?? 1) | ⚠️ Puerta trasera | Causa terciaria (IPC glitches) |
| 5 | High-Flux bypass (> 0.20) | ⚠️ No verifica transitoriedad | Causa secundaria (melodic techno) |
| 6 | Energy bypass (E > 0.40) | ⚠️ No verifica transitoriedad | Causa secundaria |
| 7 | Tonality Veto (floors 0.04) | ⚠️ Dejado pasar synth leads | No atrapa el problema |
| 8 | Sustain Choke (E >= 0.15 hold) | ⚠️ Agujero para synths fuertes | No apaga entre falsos onsets |

---

## ESTRATEGIA DSP PROPUESTA (sin implementar)

El problema fundamental es que **el sistema no distingue un transitorio percusivo (pico y caída rápida) de una modulación sostenida de synth lead**. Ambos producen `crackDelta > 0.06` y `spectralFlux > 0.10`. Las fixes del 5AM abrieron la puerta para atrapar redobles de snare (transientes comprimidos), pero el colateral es que los synth leads también entran.

**Estrategia: Transient Confirmability Test (TCT)**

1. **Delta Decay Test:** Un transitorio percusivo real tiene `crackDelta` que cae >50% en el siguiente frame. Un synth lead mantiene `crackDelta` elevado. Requerir que `crackDelta[frame+1] < crackDelta[frame] * 0.5` para confirmar onset (1-frame latency, igual que el WNS pending window).

2. **Spectral Flatness Delta:** Un snare real produce un pico de `flatness` (ruido broadband) que cae rápido. Un synth lead produce `flatness` estable. Medir `Δflatness = flatness[t] - flatness[t-1]`; requerir `Δflatness > 0.02` (el snare añade ruido, el synth no).

3. **Crack-to-HH Ratio:** Un snare real tiene energía simultánea en crack (2-5kHz) y HH (5-15kHz). Un synth lead típicamente no tiene contenido en 5-15kHz. Requerir `hhEnergy > 0.5 * crackEnergy` para confirmar snare.

4. **Re-armar el retrigger guard con discriminación:** En lugar de `_snareImpulse < 0.15` (que solo mira el envelope del impulso), requerir que `crackDelta` haya caído a < 0.02 antes de permitir un nuevo onset. Esto previene re-triggering continuo por synth leads.

5. **Clampar los umbrales dinámicos más altos:** El `finalSnareThreshold` mínimo de 0.06 es demasiado bajo. Subir el clamp a 0.08-0.09. El `dynamicFluxGate` mínimo de 0.10 es demasiado bajo. Subir el clamp a 0.12. Esto sacrifica algunos redobles comprimidos pero mata los falsos positivos de synth leads.

6. **Photon fallback estricto:** Cambiar `?? 1` por `?? 0` en spectralFlux y wns. Si no hay photon, no hay onset — fail-closed, no fail-open.

La estrategia más efectiva con menor colateral es probablemente **(1) Delta Decay Test + (6) photon fallback estricto**, porque ataca directamente la diferencia física entre transitorio percusivo y modulación sostenida sin subir umbrales universales.