# OMNI-GATE v2 — Análisis Post-OMNI-GATE v4

## Logs analizados
- `gravitypostomnigate.md` — Brejcha "Gravity" (128 BPM, plano, sin violines/synths)
- `tehnominimalpostomnigate.md` — Tehnominimal (122 BPM, con violines y synths)

## Diagnóstico raíz

**Path 2 (High-Flux bypass) era el único path sin gate contextual.**

El OMNI-GATE v4 blindó Path 1, Path 3 y Pending-WNS con gates contextuales, pero dejó Path 2 con solo `Flux > 0.20 && _snareReArmed`. Todo lo que falla los otros paths cae a Path 2 sin filtro adicional.

### Problema 1: Gravity (Brejcha) — el metrónomo roto

**SnareE=0.000 en TODO el log de Gravity.** Los snares reales de Gravity no tienen crack band (2-5kHz); se detectan por WNS + Flux. El OMNI-GATE v4 subió Path 1 de WNS>0.05 a WNS>0.3, empujando los snares reales (WNS 0.12-0.29) a Path 2.

Path 2 sin gate contextual deja pasar kicks con Flux alto:

| Línea | SnareE | WNS | Flux | BassE | Tipo | ¿Debería pasar? |
|-------|--------|-----|------|-------|------|-----------------|
| 23 | 0.000 | 0.175 | 0.232 | 0.796 | ✅ snare | Sí |
| 50 | 0.000 | 0.282 | 0.278 | 0.810 | ✅ snare | Sí |
| 125 | 0.000 | **0.000** | 0.269 | 0.843 | ❌ kick | **No** |
| 189 | 0.000 | **0.038** | 0.272 | 0.841 | ❌ kick | **No** |
| 214 | 0.000 | **0.000** | 0.287 | 0.790 | ❌ kick | **No** |
| 228 | 0.000 | **0.000** | 0.275 | 0.820 | ❌ kick | **No** |
| 241 | 0.000 | **0.000** | 0.303 | 0.824 | ❌ kick | **No** |

**Discriminador:** WNS. Snares reales tienen WNS 0.12-0.29. Kicks falsos tienen WNS 0.00-0.05. Gap limpio en 0.08-0.10.

### Problema 2: Tehnominimal — sweeps en breakdown

Sweeps sintéticos en breakdowns pasan por Path 2 con Flux > 0.20:

| Línea | SnareE | WNS | Flux | BassE | Sección | Tipo |
|-------|--------|-----|------|-------|---------|------|
| 121 | 0.110 | 0.629 | 0.218 | 0.299 | breakdown | ❌ sweep |
| 126 | 0.067 | 0.614 | 0.252 | 0.325 | breakdown | ❌ sweep |
| 133 | 0.025 | 1.000 | 0.272 | 0.170 | breakdown | ❌ sweep |
| 139 | 0.009 | 0.617 | 0.335 | 0.321 | breakdown | ❌ sweep |
| 147 | 0.003 | 0.594 | 0.346 | 0.196 | breakdown | ❌ sweep |

**Discriminador:** SnareE < 0.15 AND BassE < 0.40. Los sweeps tienen ambos bajos. Los snares reales del drop tienen SnareE 0.40-1.0.

## Fix: OMNI-GATE v2 — Gate contextual para Path 2

```
Path 2 (antes):  Flux > 0.20 AND _snareReArmed
Path 2 (v2):    Flux > 0.20 AND _snareReArmed AND (SnareE > 0.15 OR (WNS > 0.10 AND BassE > 0.40))
```

### Verificación contra datos empíricos

| Caso | SnareE | WNS | BassE | ¿Pasa v2? | Correcto |
|------|--------|-----|-------|-----------|----------|
| Gravity snare real | 0.000 | 0.12-0.29 | 0.70+ | ✅ WNS>0.10 AND BassE>0.40 | ✅ |
| Gravity kick falso | 0.000 | 0.00-0.05 | 0.80+ | ❌ WNS<0.10 | ✅ bloqueado |
| Tehnominimal sweep | 0.003-0.11 | 0.59-1.0 | 0.17-0.33 | ❌ SnareE<0.15, BassE<0.40 | ✅ bloqueado |
| Anyma synth snare | 0.46-0.78 | 0.000 | 0.65 | ✅ SnareE>0.15 | ✅ |
| Tehnominimal drop snare | 0.62-1.0 | 0.14-0.81 | 0.53-0.70 | ✅ SnareE>0.15 | ✅ |
| Gravity snare Path 1 (WNS>0.3) | 0.000 | 0.30+ | 0.70+ | ✅ Path 1 (sin cambio) | ✅ |

### WNS threshold: 0.10 (no 0.05)

- Gravity kicks falsos: WNS 0.000-0.054
- Gravity snares reales: WNS 0.120-0.294
- **Gap limpio en 0.08-0.10** — 0.10 da margen de seguridad

## Estado del OMNI-GATE v2 (todos los paths blindados)

| Path | Condición | Gate contextual | TCT |
|------|-----------|-----------------|-----|
| **Path 1** (WNS) | WNS > 0.3 | SnareE > 0.15 OR BassE > 0.40 | No (WNS prueba broadband) |
| **Path 2** (Flux) | Flux > 0.20 | SnareE > 0.15 OR (WNS > 0.10 AND BassE > 0.40) | Sí |
| **Path 3** (Energy) | SnareE > 0.40 | SnareE > 0.80 OR AGC < 2.5 OR WNS > 0.15 | Sí |
| **Pending WNS** | WNS > 0.05 | SnareE > 0.15 OR BassE > 0.40 | No |

## Archivos modificados
- `electron-app/src/hal/physics/LiquidEngineBase.ts` — Path 2 contextual gate (WAVE 7749.55)

## Pendiente hardware
- Micro-jittering en back R (envelopes, no detección) — pendiente de revisión
