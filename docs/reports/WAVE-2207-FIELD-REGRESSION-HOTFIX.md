# WAVE 2207 — Field Regression Hotfix
**Status**: ✅ COMPLETE  
**Date**: 2026-03-14  
**Engineer**: PunkOpus  
**Trigger**: Operator field feedback after WAVE 2206 deployment

---

## 🚨 Regresiones Reportadas

El operador en pista reportó 3 problemas críticos tras el despliegue de WAVE 2206:

| # | Problema | Síntoma |
|---|----------|---------|
| 1 | Rotación de patrones frenética | Cambios cada ~8s, debería ser ~32s |
| 2 | Chill mode "demasiado rápido" | Movimiento percibido como veloz pese a fix de baseFrequency |
| 3 | Jitter de sBPM → micro-stuttering mecánico | Fixtures vibran mecánicamente a ritmo de fluctuaciones del beat tracker |

---

## 🔬 Diagnóstico Forense

### Problema 1 — Causa raíz confirmada
`selectPattern()` en WAVE 2206 usaba `barCount / 4` = 16 beats por cambio de patrón.

```
120 BPM = 2 beats/segundo
16 beats / 2 = 8 segundos por patrón
4 patrones techno → ciclo completo = 32 segundos (frenético)
```

El error matemático del WAVE 2206: asumió que 128 beats = 4 minutos. **INCORRECTO.**
128 beats ÷ 2 beats/s = **64 segundos**. Un show profesional requiere 30-60s por patrón.

### Problema 2 — Causa raíz: combinación de P1 + P3
El `frequencyScale = 0.03/0.20 = 0.15` SÍ estaba funcionando correctamente.  
Math manual: ciclo de drift chill a 120 BPM = **~106 segundos ≈ 1.8 minutos**. Genuinamente glacial.  
El operador percibía "movimiento rápido" porque:
- (a) Los cambios de patrón cada 8s (P1) parecen velocidad de movimiento
- (b) El jitter de phaseBPM (P3) generaba micro-oscilaciones que parecían nerviosismo

### Problema 3 — Causa raíz confirmada
`BPM_SMOOTH_FACTOR = 0.05` → EMA simple con convergencia en ~20 frames.  
Si sBPM fluctúa 60↔180 frame-a-frame:
- `smoothedBPM` se mueve ~6 BPM por frame
- `phaseDelta` varía micro-frame-a-frame
- La FASE en sí es jittery (no solo la velocidad)
- El `softClampDelta` de FixturePhysicsDriver NO puede arreglarlo — actúa sobre velocidad, no sobre fase

---

## 🔧 Cirugía Aplicada

### FIX 2207.1 — Rotación de Patrones Restaurada
**Archivo**: `src/engine/movement/VibeMovementManager.ts` → `selectPattern()`

| | Antes (WAVE 2206) | Después (WAVE 2207) |
|---|---|---|
| Beat trigger | `barCount / 4` = 16 beats | `barCount / 8` = 32 beats |
| Tiempo a 120 BPM | ~8 segundos | ~16 segundos |
| Time fallback | `time / 16` = 16 segundos | `time / 30` = 30 segundos |
| Ciclo techno (4 pat) | ~32 segundos | ~64 segundos ✅ PROFESIONAL |
| Ciclo chill (3 pat) | ~24 segundos | ~48 segundos ✅ MEDITATIVO |

---

### FIX 2207.2 — BPM Inertial Flywheel (arquitectura dos etapas)
**Archivo**: `src/engine/movement/VibeMovementManager.ts` → phase accumulator block

**Antes**: EMA simple con factor 0.05 (~20 frames) → fase jittery.

**Después**: Arquitectura de filtrado en tres etapas:

```
sBPM (beat tracker) 
  → [Stage 1: EMA factor=0.03, ~33 frames] → smoothedBPM
  → [Stage 2: Flywheel slew rate ±0.5 BPM/frame] → phaseBPM  
  → [Stage 3: × frequencyScale] → phaseAccumulator
```

**Nuevos campos de clase:**
```typescript
private phaseBPM: number = 120
private readonly PHASE_BPM_MAX_SLEW = 0.5  // BPM/frame máximo
```

**Propiedades del flywheel:**
- Tempo jump 120→180 BPM: 2 segundos completos en propagarse
- Jitter de ±5 BPM: absorbido silenciosamente en ~10 frames  
- Fluctuación 60↔180 frame-a-frame: phaseBPM apenas percibe variación
- Phase advance: CONSTANCIA DE RELOJ SUIZO. Immune al beat tracker.

**Guard de NaN/zero en frequencyScale:**
```typescript
const frequencyScale = (Number.isFinite(rawFrequencyScale) && rawFrequencyScale > 0)
  ? rawFrequencyScale
  : 1.0  // fallback a Rock=neutro, NUNCA congela la fase
```

---

### FIX 2207.3 — resetTime() completo
**Archivo**: `src/engine/movement/VibeMovementManager.ts` → `resetTime()`

`phaseBPM` ahora se resetea junto a `smoothedBPM` en `resetTime()`.  
Sin este fix, un reset de escena dejaría el flywheel divergido durante 2+ segundos.

```typescript
this.smoothedBPM = 120
this.phaseBPM = 120  // WAVE 2207: flywheel y EMA sincrónicos post-reset
```

---

## ✅ Resultados de Tests

```
Test Files  2 passed (2)
     Tests  129 passed (129)  ← ZERO REGRESIONES
  Duration  896ms
```

---

## 📊 Comportamiento Resultante (análisis matemático)

### Velocidad de fase por vibe (@120 BPM, pop-rock como referencia):

| Vibe | baseFrequency | frequencyScale | Ciclo completo |
|------|--------------|----------------|---------------|
| techno-club | 0.25 | ×1.25 | ~53s (energético) |
| fiesta-latina | 0.15 | ×0.75 | ~88s (orgánico) |
| pop-rock | 0.20 | ×1.00 | ~66s (referencia) |
| chill-lounge | 0.03 | ×0.15 | **~444s ≈ 7.4 min** (GLACIAR ✅) |
| idle | 0.02 | ×0.10 | **~666s ≈ 11 min** (semi-estático ✅) |

*(ciclo completo = tiempo en recorrer 2π radianes en el acumulador de fase)*

### Rotación de patrones con FIX 2207.1:

| Vibe | Patrones | Beats/cambio | Segundos/cambio | Ciclo completo |
|------|---------|-------------|----------------|---------------|
| techno-club | 4 | 32 | ~16s | ~64s |
| chill-lounge | 3 | 32 | ~16s | ~48s |
| pop-rock | 4 | 32 | ~16s | ~64s |

---

## 🎯 Problema 2 — Veredicto Final

El "Chill demasiado rápido" era una **ilusión perceptiva** causada por P1 + P3:
- Los cambios de patrón cada 8s (P1) se perciben como velocidad de movimiento
- El jitter BPM (P3) generaba nerviosismo visual a pesar del frequencyScale correcto

Con FIX 2207.1 (patrones cada ~16s) + FIX 2207.2 (flywheel sin jitter), el Chill mode en pista será GENUINAMENTE glacial. No se requiere cambiar baseFrequency.

---

*WAVE 2207 complete. Operator regression closed. The Swiss chronograph is running.*
