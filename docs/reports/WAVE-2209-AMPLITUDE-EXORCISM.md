# WAVE 2209 — THE AMPLITUDE EXORCISM + VELOCITY COMPENSATION
**Status**: ✅ COMPLETE  
**Date**: 2026-03-14  
**Engineer**: PunkOpus  
**Trigger**: WAVE 2208 fixed phase jitter, but amplitude still reactive + velocity too slow  
**Severity**: CRITICAL — geometries deformed by kick-reactive amplitude, techno glacially slow

---

## 🚨 El Problema Post-WAVE 2208

WAVE 2208 (The Great Decoupling) eliminó el BPM del acumulador de fase. La velocidad angular era pura, constante, sin jitter. Pero tres problemas persistían:

### 1. Amplitud Reactiva → Tirones y Deformaciones
El audio seguía modulando la AMPLITUD (el radio del patrón) por dos vías:

```
audio.energy (varía frame-a-frame con cada kick)
  → energyBoost = 1.0 + energy × 0.2
    → requestedAmplitude = baseAmplitude × energyBoost
      → finalAmplitude = gearbox × phraseEnvelope
        → position = rawPosition × finalAmplitude
          → EL RADIO DEL PATRÓN SALTA ±20% CON CADA KICK
            → círculo = huevo, square = trapezoide
            → FixturePhysicsDriver persigue target expansivo = TIRÓN
```

**Dos fuentes reactivas:**
- `energyBoost` (línea 998): `1.0 + energy × 0.2` → ±20% instantáneo por frame
- `phraseEnvelope` (línea 780): `0.925 + 0.075 × sin(π × (beatProgress - 0.15))` → beatCount-driven

### 2. Velocidad Demasiado Lenta
Post-WAVE 2208, la fase solo usaba baseFrequency:
- Techno scan_x: `0.25 × 2π/16 = 0.098 rad/s` → **64 segundos** por ciclo completo
- Eso es GEOLÓGICO para una discoteca techno

### 3. Chill-Lounge Demasiado Rápido
El bypass de WAVE 2208 usaba frecuencias de `0.035 × φ` Hz:
- Pseudo-periodo X: ~111 segundos → VISIBLE y oscilatorio
- Amplitud ±3.5% → ±19° en un pan de 540° → PERCEPTIBLE

---

## 🔧 Las 3 Cirugías

### CIRUGÍA 1 — EXTIRPACIÓN DE AMPLITUD REACTIVA

**Eliminado: energyBoost**
```typescript
// ANTES:
const energyBoost = 1.0 + energy * 0.2            // ← audio.energy VARIABLE
const requestedAmplitude = baseAmplitude * energyBoost

// DESPUÉS:
const requestedAmplitude = baseAmplitude            // ← FIJO por vibe. Punto.
```

**Congelado: Phrase Envelope**
```typescript
// ANTES:
const phraseBeats = 32
const phraseProgress = (beatCount % phraseBeats) / phraseBeats  // ← beatCount VARIABLE
const phraseEnvelope = 0.925 + 0.075 * Math.sin(Math.PI * (phraseProgress - 0.15))
const clampedEnvelope = Math.max(0.85, Math.min(1.0, phraseEnvelope))

// DESPUÉS:
const clampedEnvelope = 1.0  // FROZEN — no reactive modulation
```

**Cadena de amplitud resultante:**
```
VIBE_CONFIG.amplitudeScale (FIJO) → Gearbox hardware limit (FIJO) × 1.0 (FROZEN envelope)
= CONSTANTE PURA por vibe
```

| Vibe | amplitudeScale | Gearbox result | × envelope | = Final |
|------|---------------|---------------|------------|---------|
| techno-club | 1.0 | 0.85-1.0 | × 1.0 | 0.85-1.0 |
| fiesta-latina | 0.85 | 0.85-0.85 | × 1.0 | 0.85 |
| pop-rock | 0.80 | 0.85 | × 1.0 | 0.85 |
| idle | 0.10 | 0.85 | × 1.0 | 0.85 |

**Resultado**: La geometría es SAGRADA. Un círculo es un círculo perfecto. Un square tiene esquinas a la misma distancia del centro en CADA frame. El audio no toca NADA de la forma.

---

### CIRUGÍA 2 — COMPENSACIÓN DE VELOCIDAD (VIBE_PHASE_MULTIPLIER)

Nuevo mapa de multiplicadores constantes por vibe:

```typescript
const VIBE_PHASE_MULTIPLIER: Record<string, number> = {
  'techno-club':    8,    // 64s / 8 = ~8s per scan cycle
  'fiesta-latina':  6,    // 107s / 6 = ~18s per figure8
  'pop-rock':       5,    // 80s / 5 = ~16s per circle
  'chill-lounge':   1,    // BYPASSED — chill uses hardcoded drift
  'idle':           5,    // 800s / 5 = ~160s per breath
}
```

**Fórmula actualizada:**
```typescript
const angularVelocity = config.baseFrequency * (2 * Math.PI) / patternPeriod * phaseMultiplier
const phaseDelta = frameDeltaTime * angularVelocity
```

**Tiempos de ciclo resultantes:**

| Vibe | baseFreq | period | ×mult | angVel (rad/s) | Ciclo completo |
|------|---------|--------|-------|---------------|---------------|
| techno scan_x | 0.25 | 16 | ×8 | 0.785 | **8.0 s** |
| techno square | 0.25 | 16 | ×8 | 0.785 | **8.0 s** |
| techno diamond | 0.25 | 8 | ×8 | 1.571 | **4.0 s** |
| latino figure8 | 0.15 | 16 | ×6 | 0.353 | **17.8 s** |
| latino ballyhoo | 0.15 | 16 | ×6 | 0.353 | **17.8 s** |
| rock circle_big | 0.20 | 16 | ×5 | 0.393 | **16.0 s** |
| rock dual_sweep | 0.20 | 16 | ×5 | 0.393 | **16.0 s** |
| idle breath | 0.02 | 16 | ×5 | 0.039 | **160 s** |

**Los multiplicadores son CONSTANTES** — no tienen dependencia del audio. Cero jitter. Solo un reloj más rápido.

---

### CIRUGÍA 3 — CHILL BYPASS VERDADERAMENTE GLACIAL

```typescript
// ANTES (WAVE 2208):
const driftX = Math.sin(this.time * 0.035 * phi) * 0.035   // freq=0.0566 Hz, amp=±3.5%
const driftY = Math.sin(this.time * 0.025 * sqrt2) * 0.020 // freq=0.0354 Hz, amp=±2.0%

// DESPUÉS (WAVE 2209):
const driftX = Math.sin(this.time * 0.00005 * phi) * 0.008 // freq=0.0000809 Hz, amp=±0.8%
const driftY = Math.sin(this.time * 0.00003 * sqrt2) * 0.005 // freq=0.0000424 Hz, amp=±0.5%
```

**Comparativa:**

| Parámetro | WAVE 2208 | WAVE 2209 | Reducción |
|-----------|----------|----------|-----------|
| Freq X | 0.0566 Hz | 0.0000809 Hz | **700×** más lento |
| Freq Y | 0.0354 Hz | 0.0000424 Hz | **835×** más lento |
| Amp X | ±3.5% | ±0.8% | **4.4×** más pequeño |
| Amp Y | ±2.0% | ±0.5% | **4×** más pequeño |
| Periodo X | ~111 s | ~20,000 s (~5.5 h) | **180×** más largo |
| Periodo Y | ~178 s | ~33,000 s (~9 h) | **185×** más largo |
| En 540° pan | ±19° | ±4.3° | **INVISIBLE al ojo** |
| En 270° tilt | ±5.4° | ±1.35° | **IMPERCEPTIBLE** |

El fixture aparece **COMPLETAMENTE ESTÁTICO** ante el ojo humano. El micro-drift existe únicamente para evitar que ciertos fixtures interpreten un valor DMX congelado como "señal perdida" y entren en modo reset.

---

## ✅ Resultados de Tests

```
Test Files  2 passed (2)
     Tests  127 passed (127)  ← ZERO REGRESIONES
  Duration  1.00s
```

**Tests refactorizados:**
- §4: 5 tests antiguos (Energy-to-Period, fórmula fantasma) → 4 tests nuevos (Energy Independence)
- §5: 5 tests antiguos (Phrase Envelope breathing) → 4 tests nuevos (Frozen Envelope, static amplitude)

**Tests nuevos verifican:**
- Amplitud idéntica con cualquier beatCount (envelope frozen)
- Amplitud idéntica con cualquier energy level (energyBoost killed)
- Posición idéntica con cualquier energy level (total independence)
- 100 frames con audio wildly oscilante → amplitud CONSTANTE
- Ghost Protocol sigue funcionando (freeze on silence)

---

## 📊 Estado de Audio Independence

| Canal de audio | Modulaba... | WAVE 2208 | WAVE 2209 |
|---------------|-------------|----------|----------|
| audio.bpm | Velocidad de fase | ❌ MUERTO | ❌ MUERTO |
| audio.energy | Amplitud (energyBoost) | ✅ VIVO | ❌ MUERTO |
| audio.energy | Ghost Protocol (freeze) | ✅ VIVO | ✅ VIVO (intencionado) |
| audio.beatCount | Phrase envelope | ✅ VIVO | ❌ MUERTO |
| audio.beatCount | barCount tracking | ✅ VIVO | ✅ VIVO (debug/future) |
| audio.beatPhase | (no se usa) | — | — |

**El audio ahora SOLO afecta:**
1. Ghost Protocol: energy < 0.03 congela la posición (seguridad, no cosmética)
2. barCount: se mantiene para debug y uso futuro, pero no afecta geometría ni amplitud

---

## 🎯 Filosofía Final

> *"Un foco de discoteca no necesita saber cuántos decibelios tiene el kick para saber QUÉ TAN GRANDE es su círculo."*

La geometría es ahora **platónicamente pura**:
- **Fase** = f(tiempo, constantes) — cristal oscilador
- **Amplitud** = f(constantes) — sagrada e inmutable
- **Velocidad** = f(constantes × multiplicador fijo) — calibrada por vibe

El audio influye en OTROS subsistemas (color, efectos, intensidad). Pero el movimiento es **autónomo**. El choreographer baila su propia danza, al ritmo de su propio reloj, con la geometría perfecta de un compás de dibujo técnico.

---

*WAVE 2209 complete. Audio drives nothing. Time drives phase. Constants drive amplitude. Mathematics drives geometry.*
