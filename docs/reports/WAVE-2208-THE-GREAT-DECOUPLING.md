# WAVE 2208 — THE GREAT DECOUPLING
**Status**: ✅ COMPLETE  
**Date**: 2026-03-14  
**Engineer**: PunkOpus  
**Trigger**: Pre-Beta crisis — WAVE 2206/2207 fixes caused field regressions  
**Severity**: CRITICAL — mechanical stuttering on every kick, deformed geometries

---

## 🚨 El Problema

Tras las WAVE 2206 (conectar baseFrequency al acumulador de fase) y 2207 (flywheel inercial BPM), el operador en pista reportó:

1. **Tirones mecánicos con cada kick** — los fixtures daban micro-sacudidas sincronizadas con el bombo
2. **Geometrías deformadas** — un círculo no era círculo, un square no era square
3. **Chill-lounge violado** — modo que debería ser glacial seguía percibido como demasiado activo

### Root Cause: BPM en el acumulador de fase

```
godearFFT → audio.bpm (varía kick-a-kick)
  → getSafeBPM() → safeBPM (clamped [60,200])
    → EMA factor 0.03 → smoothedBPM (still moves ~3.6 BPM/frame on jitter)
      → Flywheel ±0.5 BPM/frame → phaseBPM (STILL moves, just slower)
        → phaseDelta = phaseBPM/60 × dt × 2π/period × frequencyScale
          → phaseAccumulator += phaseDelta (VARIABLE frame-to-frame)
            → pattern position JITTERS → mechanical micro-stuttering
```

**El problema no era CUÁNTO suavizábamos el BPM. El problema era que el BPM estaba DENTRO del cálculo de fase.** Cualquier variación — por mínima que sea — se acumula en la fase y produce micro-variaciones en la posición angular del patrón. El ojo humano (y los servomotores de un moving head) detectan estas variaciones como TIRONES.

El acumulador de fase monotónico de WAVE 2088.10 fue una genialidad arquitectónica. Pero alimentarlo con un BPM variable arruinó su principal virtud: la monotonía.

---

## 🔧 Las 3 Cirugías Destructivas

### CIRUGÍA 1 — DESACOPLAMIENTO ABSOLUTO DEL BPM

**Eliminado del código:**
- `private smoothedBPM: number = 120` — ELIMINADO
- `private readonly BPM_SMOOTH_FACTOR = 0.03` — ELIMINADO
- `private phaseBPM: number = 120` — ELIMINADO
- `private readonly PHASE_BPM_MAX_SLEW = 0.5` — ELIMINADO
- `getSafeBPM()` llamada en el acumulador — ELIMINADA
- Toda la arquitectura de filtrado de 2 etapas (EMA + flywheel) — ELIMINADA

**Nueva fórmula del acumulador de fase:**
```typescript
// ANTES (WAVE 2207):
const beatsPerSecond = this.phaseBPM / 60                     // ← BPM VARIABLE
const phasePerBeat = (2 * Math.PI) / patternPeriod
const frequencyScale = config.baseFrequency / 0.20
const phaseDelta = beatsPerSecond * frameDeltaTime * phasePerBeat * frequencyScale

// DESPUÉS (WAVE 2208):
const angularVelocity = config.baseFrequency * (2 * Math.PI) / patternPeriod  // ← CONSTANTE
const phaseDelta = frameDeltaTime * angularVelocity                           // ← SOLO dt
```

**Las únicas variables en la fase son ahora:**
| Variable | Tipo | Origen |
|----------|------|--------|
| `frameDeltaTime` | Wall-clock dt | `Date.now()` delta, cap 100ms |
| `config.baseFrequency` | Constante per-vibe | `VIBE_CONFIG` hardcoded |
| `patternPeriod` | Constante per-pattern | `PATTERN_PERIOD` hardcoded |

**Resultado**: La fase avanza como un oscilador de cristal. Cero jitter. Cero dependencia del audio.

### Velocidad de fase por vibe (ciclo completo de 2π):

| Vibe | baseFrequency | patternPeriod (típico) | Ciclo completo |
|------|--------------|----------------------|---------------|
| techno-club | 0.25 | 16 | **64 segundos** |
| fiesta-latina | 0.15 | 16 | **107 segundos** |
| pop-rock | 0.20 | 16 | **80 segundos** |
| idle | 0.02 | 16 | **800 segundos (~13 min)** |

---

### CIRUGÍA 2 — ROTACIÓN DE PATRONES PURAMENTE CRONOLÓGICA

**Eliminado:**
- `barCount` como fuente de rotación — ELIMINADO del selectPattern()
- `beatPhrase = Math.floor(this.barCount / 8)` — ELIMINADO

**Nueva fórmula:**
```typescript
// ANTES:
const beatPhrase = Math.floor(this.barCount / 8)  // beat-driven
const timePhrase = Math.floor(this.time / 30)     // time fallback
const phrase = Math.max(beatPhrase, timePhrase)    // winner takes all

// DESPUÉS:
const phrase = Math.floor(this.time / 30)  // PURELY chronological. Period.
```

**Resultado:**
- Patrón cambia exactamente cada 30 segundos reales
- Techno (4 patrones): ciclo completo = 2 minutos
- Chill: NO usa selectPattern — ver Cirugía 3
- El beat tracker puede morir, jittear, o alucinar — da exactamente igual

---

### CIRUGÍA 3 — BYPASS COMPLETO DE CHILL-LOUNGE

**Guard clause al inicio de `generateIntent()`:**

```typescript
if (vibeId === 'chill-lounge') {
  const phi = 1.618033988749
  const sqrt2 = Math.SQRT2
  const driftX = Math.sin(this.time * 0.035 * phi) * 0.035
  const driftY = Math.sin(this.time * 0.025 * sqrt2) * 0.020
  return { x: driftX, y: driftY, pattern: 'drift', ... }
}
```

**Lo que bypasea:**
- ❌ Phase accumulator — NO
- ❌ Pattern functions — NO
- ❌ Gearbox — NO
- ❌ Phrase envelope — NO
- ❌ Stereo rotation — NO
- ❌ LERP transitions — NO

**Lo que usa:**
- ✅ `this.time` — puro wall-clock, acumulado desde frameDeltaTime
- ✅ Dos sinusoides con frecuencias incomensurables (φ × √2) — drift no-repetitivo
- ✅ Amplitud: ±3.5% X, ±2% Y — casi imperceptible, GENUINAMENTE glacial

**Propiedades del drift:**
- Pseudo-período X: `2π / (0.035 × φ)` ≈ **111 segundos**
- Pseudo-período Y: `2π / (0.025 × √2)` ≈ **178 segundos**
- Como φ y √2 son incomensurables, la trayectoria **nunca se repite exactamente**
- Amplitud máxima: 3.5% del rango → un moving head de 540° se mueve ±19° (imperceptible)

---

## ✅ Resultados de Tests

```
Test Files  2 passed (2)
     Tests  129 passed (129)  ← ZERO REGRESIONES
  Duration  1.10s
```

**6 tests adaptados** a la nueva realidad temporal:
- `square`: simulación extendida a 100s (antes 2.2s)
- `chase_position`: simulación extendida a 100s
- `figure8`: simulación extendida a 120s
- `circle_big`: simulación extendida a 100s
- `Latino snake`: fase pre-acumulada 30s antes de comparar L/R
- `Pattern rotation`: simulación extendida a 120s

Todos los tests validan la MISMA geometría — solo necesitan más tiempo simulado porque la fase avanza por wall-clock, no por BPM.

---

## 📊 Comparativa Arquitectónica

| Aspecto | WAVE 2088 (original) | WAVE 2206/2207 | WAVE 2208 |
|---------|---------------------|----------------|-----------|
| Fuente de fase | smoothedBPM × dt | phaseBPM (flywheel) × dt | **dt × baseFrequency** |
| Jitter BPM → fase | SÍ (directo) | REDUCIDO (flywheel) | **CERO** |
| Variables en phaseDelta | 4 (BPM, dt, period, freq) | 4 (phaseBPM, dt, period, freq) | **2 (dt, constantes)** |
| Rotación patrones | barCount (beat-driven) | barCount + time fallback | **time ONLY** |
| Chill-lounge | Pattern engine | Pattern engine (lento) | **BYPASS TOTAL** |
| Dependencia audio en fase | Total | Filtrada | **CERO** |
| Geometría | Deformada por jitter | Menos deformada | **Matemáticamente perfecta** |

---

## 🎯 Filosofía Final

> *"Un reloj no necesita saber a qué BPM suena la música para dar la hora."*

El audio sigue modulando la **amplitud** (cuánto se mueve) vía el Gearbox y el Phrase Envelope. Sigue modulando el **freeze** (Ghost Protocol en silencio). Sigue alimentando el `beatCount` para el barCount (que aún se mantiene para debug y futuro uso opcional).

Pero la **fase** — la esencia de la forma geométrica, la cosa que define si un círculo es un círculo y un square es un square — es ahora **pura matemática temporal**. Inmune al beat tracker. Inmune al godearFFT. Inmune a todo.

Los patrones son ahora lo que siempre debieron ser: **ecuaciones platónicas ejecutadas con precisión de reloj suizo**.

---

*WAVE 2208 complete. The Great Decoupling. Audio drives amplitude. Time drives geometry.*
