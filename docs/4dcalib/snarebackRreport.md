Voy a extraer todo el pipeline del snare para techno, desde el input hasta el Back R output.

Ahora tengo el pipeline completo. Déjame también ver los parámetros del perfil techno relevantes al snare:

Ahora tengo todo. Aquí está el reporte:

---

# REPORTE DE CONTEXTO: Algoritmo Snare Back R — Perfil TECHNO

## 1. Arquitectura General del Motor

El motor `LiquidEngineBase` recibe un `LiquidInput` por frame (~44Hz) con estas señales clave para el snare:

| Campo | Origen | Descripción |
|---|---|---|
| `snare_energy` | GodEarFFT RhythmicPercussionTracker | EMA continua (0-1) de body (150-250Hz) + crack (2-5kHz) |
| `raw_snare_delta` | GodEarFFT raw pre-EMA | Delta frame-a-frame de la energía cruda del snare |
| `photon.spectralFlux` | GodEarFFT | Tasa de cambio espectral (0-1) — impulso vs sustain |
| `photon.whiteNoiseScore` (WNS) | GodEarFFT | HF broadband noise (0-1) — sizzle de snare vs vocal/synth |
| `pureBassEnergy` (BassE) | Calculado en motor | `max(0, bands.bass - lowMid*0.40)` |
| `bassDelta` | Calculado en motor | `pureBassEnergy - prevBassEnergy` |
| `agcGainFactor` | GodEarFFT AGC | Factor de ganancia (1.0-3.5x) |
| `flatness` | GodEarFFT | Wiener entropy (0=tonal, 1=noise) |

El pipeline del snare tiene **4 etapas**:
1. **Onset Detection** (rawOnset = true/false)
2. **Impulse Decay** (hybridSnare = impulso binario con decay)
3. **Sustain Choke** (mata colas de vocal/synth)
4. **Tonality Veto** (filtra tonal vs noise)

---

## 2. Etapa 1: Onset Detection — Los 5 Paths

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngineBase.ts" lines="806-955" />

### Gate de entrada (L806)
```
rawSnareDelta > finalSnareThreshold && spectralFlux > dynamicFluxGate && _snareImpulse < 0.15
```
- `finalSnareThreshold`: dinámico, 0.06-0.12 según `_fluxBaseline` (densidad espectral)
- `dynamicFluxGate`: dinámico, 0.08-0.15 según `_fluxBaseline`
- `_snareImpulse < 0.15`: anti-retrigger (no disparar si el impulso anterior aún no ha decaído)

Si el gate de entrada pasa, evalúa los paths en orden (OR — el primero que pase dispara):

### Path 1: WNS-confirmed (L816)
```
wns > 0.3 && (snareEnergy > 0.15 || (bassE > 0.40 && bassDelta > 0.005))
```
- **Para techno:** WNS > 0.3 es raro. Los snares sintetizados de minimal techno tienen WNS = 0.
- El `bassDelta > 0.005` (WAVE 7749.64, nuestro cambio) bloquea hi-hats que surfean el bass.
- **Sin TCT guard** — no requiere `_snareReArmed`.

### Path 2: High-Flux Bypass (L824)
```
spectralFlux > 0.20 && _snareReArmed && (
  snareEnergy > 0.45 ||                                    // Clause A
  (snareEnergy > 0.15 && wns > 0.05) ||                    // Clause B
  (wns > 0.10 && bassE > 0.40 && snareEnergy > 0.05)       // Clause C
)
```
- **El path principal para techno.** Snares sintetizados con WNS=0 pero Flux > 0.20 y SnareE > 0.45 pasan por Clause A.
- `_snareReArmed` requiere que el delta anterior haya vuelto a ~0 (TCT lockout).
- Clause A es la que atrapa snares sintetizados fuertes (Anyma, Brejcha).
- Clause C es la que atrapa snares con algo de WNS + contexto de bass.

### Path 3: WNS-confirmed soft snare (L907)
```
_snareReArmed && wns > 0.50 && snareEnergy > 0.10 && rawSnareDelta > 0.05 && spectralFlux > dynamicFluxGate && _snareImpulse < 0.15
```
- Para snares suaves con WNS muy alto (latin genres). En techno casi nunca se dispara (WNS > 0.50 es rarísimo).

### Path 4: Hybrid Minimal Snare (L928)
```
_snareReArmed && snareEnergy > 0.25 && rawSnareDelta > 0.05 && spectralFlux > 0.10 && agcGain < 2.5
```
- Para snares de Brejcha en el "valley of death" (SnareE 0.25-0.45, Flux 0.10-0.20, WNS 0).
- El `agcGain < 2.5` bloquea kicks amplificados por AGC en breakdowns.

### Pending WNS (L894)
```
_snarePendingWns && wns > 0.05 && rawSnareDelta > 0.02 && (snareEnergy > 0.15 || bassE > 0.40) && _snareImpulse < 0.15
```
- Confirmación 1-frame-late para WNS con latencia.

---

## 3. Etapa 2: Impulse Decay (L959-977)

```typescript
if (rawOnset) this._snareImpulse = 1.0
const snareImpulseThisFrame = this._snareImpulse
this._snareImpulse *= (p.snareImpulseDecay ?? 0.65)  // techno: 0.65
hybridSnare = snareImpulseThisFrame
```

- Techno: `snareImpulseDecay = 0.65` → decay 1.0→0.65→0.42→0.27→0.18 (~200ms)
- En 4.1 override: `0.65` también

---

## 4. Etapa 3: Sustain Choke (L996-1017)

```typescript
if (snareOnsetThisFrame) {
  _snareSustainFrames = 0; _snareChokeFactor = 1.0
} else {
  _snareSustainFrames++
  if (_snareSustainFrames > chokeThreshold && rawSnareEnergy < 0.15) {
    _snareChokeFactor *= (p.snareChokeRate ?? 0.70)  // techno: 0.85
  } else if (rawSnareEnergy >= 0.15) {
    _snareChokeFactor = 1.0  // percussion active, hold
  }
}
hybridSnare *= _snareChokeFactor
```

- Techno: `snareChokeFrames = 15` (~300ms antes de choke), `snareChokeRate = 0.85`
- **HIGH-ENERGY GUARD:** Si `snareEnergy >= 0.15`, NO chokea — asume percussion activa.
- Esto es clave: en techno denso, snare_energy EMA se mantiene > 0.15 entre hits → el choke nunca se activa → el impulso decae naturalmente con `snareImpulseDecay`.

---

## 5. Etapa 4: Tonality Veto (L1035-1091)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngineBase.ts" lines="1040-1091" />

Tres ejes con rampa lineal floor→knee:

| Eje | Techno Floor | Techno Knee | Descripción |
|---|---|---|---|
| Flatness | 0.04 | 0.10 | Wiener entropy (tonal vs noise) |
| WNS | 0.04 | 0.20 | HF broadband (snare sizzle vs vocal) |
| Flux | 0.05 | 0.20 | Spectral change (impulso vs sustain) |

```typescript
vetoFactor = (flatnessGate + wnsGate + fluxGate) / 3.0  // AVERAGE, no AND
hybridSnare *= (vetoFactor > 0.15 ? 1.0 : (vetoFactor / 0.15))
```

- **Average (no multiplication):** Permite que 1 eje fuerte compense 2 débiles.
- En techno denso: flatness y WNS suelen estar cerca de 0 (sub-bass aplasta todo), solo Flux sobrevive.
- Ejemplo del comentario: `flatnessGate=0.34, wnsGate=0, fluxGate=0.97 → avg=0.44 → PASSES`
- Si `vetoFactor < 0.15`, se aplica rampa lineal `(vetoFactor / 0.15)` que reduce el hybridSnare.

---

## 6. Parámetros TECHNO relevantes al Snare

<ref_file file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\profiles\techno.ts" />

| Parámetro | Valor Techno | Default | Notas |
|---|---|---|---|
| `envelopeSnare.gateOn` | 0.28 | — | Re-disparar fácil entre redobles |
| `envelopeSnare.decayBase` | 0.32 | — | Snap industrial brutal (~90ms a negro) |
| `envelopeSnare.boost` | 2.5 | — | Ganancia efectiva igualada a Latino |
| `snareVetoFlatnessFloor` | 0.04 | 0.04 | |
| `snareVetoFlatnessKnee` | 0.10 | 0.25 | Knee más agresivo que default |
| `snareVetoWnsFloor` | 0.04 | 0.04 | |
| `snareVetoWnsKnee` | 0.20 | 0.35 | Knee más agresivo |
| `snareVetoFluxFloor` | 0.05 | 0.05 | |
| `snareVetoFluxKnee` | 0.20 | 0.30 | Knee más agresivo |
| `snareChokeFrames` | 15 | 2 | 300ms antes de choke (techno denso) |
| `snareChokeRate` | 0.85 | 0.70 | Choke suave |
| `snareImpulseDecay` | 0.65 | 0.04 | Tail suave cohesivo |
| `snarePath1BassDeltaFloor` | 0.005 | 0 | Anti-hi-hat surfer (nuestro cambio) |

---

## 7. El Problema con los Datos

De los logs `imposiblesnare.md` y `imposiblesnare2.md`:

- **61 onsets en ~570 frames** (4.7 onsets/segundo a 123 BPM = 2.3 onsets/beat)
- Espaciado: 1-32 frames, sin patrón rítmico
- 32 onsets con SnareE >= 0.45, 22 con SnareE 0.15-0.45, 7 con SnareE < 0.15
- El patrón esperado es **off-beat 16ths** — snares sintetizados entre kicks

**Lo que está pasando:** El detector dispara en **cada transient con SnareE > 0.25 y Flux > 0.20** — incluyendo synth stabs, claps, FX, y ruido textural del minimal techno. En minimal techno, la textura está llena de micro-transients con energía en 2-5kHz (SnareE moderado) y flux alto. El Path 2 Clause A (`SnareE > 0.45`) los atrapa a todos porque los synth stabs de minimal tienen SnareE 0.45-0.80.

**Por qué Latino no tiene este problema:** La música latina tiene snares acústicos reales con WNS alto (0.5-1.0) que Path 1 atrapa limpiamente. Los synth stabs de regueton tienen SnareE bajo (< 0.30) porque no tienen energía en 2-5kHz. La textura latina es más limpia espectralmente en la banda del snare.

---

## 8. Observaciones clave para un rediseño

1. **SnareE no discrimina en techno.** Tanto snares reales como synth stabs tienen SnareE 0.45-0.80. La banda 2-5kHz no es exclusiva del snare en minimal techno.

2. **WNS es casi siempre 0 en techno.** Los snares sintetizados no producen broadband HF noise. Path 1 y Path 3 son inútiles. Todo pasa por Path 2 (Flux bypass).

3. **Flux > 0.20 es demasiado permisivo.** Cualquier transient espectral lo supera — synth stabs, claps, FX sweeps.

4. **No hay acceso al BPM/beat phase.** El motor no sabe dónde está el beat. No puede hacer beat-locking.

5. **El `_snareReArmed` (TCT) es el único anti-retrigger.** Pero solo previene re-disparos rápidos, no discrimina snare vs no-snare.

6. **El Tonality Veto usa average de 3 ejes.** En techno, 2 de 3 ejes (flatness, WNS) están siempre cerca de 0 → el veto depende casi exclusivamente de Flux → no filtra nada porque Flux es alto en todos los transients.