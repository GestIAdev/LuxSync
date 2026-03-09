# 🔬 WAVE 2167: SUB-BASS SCALPEL

## Fecha: 2025-01-XX
## Autor: PunkOpus
## Estado: ✅ COMPILADO + 31/32 TESTS PASS (misma falla pre-existente)

---

## 🎯 PROBLEMA

WAVE 2166 (Naked Autocorrelator) alimentó rawLowFlux = **subBass + bass (0-250Hz)** directamente al autocorrelador. Resultados:

- ✅ Energía fluye (needle=0.0576, 0.2277 — ya no hay zeros)
- ❌ BPM lee **95-97** en vez de **126** BPM para Boris Brejcha

## 🔬 DIAGNÓSTICO

### Análisis del log (1032 líneas, 78 eventos SIEVE/OCTAVE)

| Fase | Frames | BPM | Sieve | Problema |
|------|--------|-----|-------|----------|
| 1 | F72-F152 | 182-184 | `183bpm:0.220, 85bpm:0.101` | Sieve ve ~183 y ~85 |
| 2 | F188-F452 | 95-97 | Solo `95-97bpm` | Octave lock: 184→97 |
| 3 | F480-F532→fin | 170-173→81 | `171bpm:0.221` → `81bpm:0.384` | Salta y colapsa |

### HALLAZGO CRÍTICO
**126 BPM NUNCA aparece en NINGÚN SIEVE de todo el log.**

Los picos que el autocorrelador ve son:
- **~183-187 BPM** (lag ~28 en espacio upsampled)
- **~85-97 BPM** (lag ~53-55)
- **~81-84 BPM** (lag ~64)

### CAUSA RAÍZ

`subEnergy = rawSubBassEnergy + rawBassOnlyEnergy` captura **0-250Hz completo**.

En Brejcha:
- **Kick** (20-60Hz) golpea en el **beat**
- **Bajo rodante** (60-250Hz) golpea en el **offbeat**
- Ambos tienen **amplitud similar** en 0-250Hz combinado

El autocorrelador ve onsets cada **half-beat** (~238ms ≈ 252 BPM), que en el lag grid aparece como **~183-187 BPM**. El fundamental (476ms = 126 BPM) es **invisible** porque el offbeat-bass crea un onset indistinguible del kick.

### INSIGHT RETROACTIVO

La epifanía de WAVE 2166 ("Si kick y bass están en beat/offbeat, AMBOS repiten cada 476ms → autocorrelación será MÁXIMA en 126 BPM") era **INCORRECTA**.

Repiten individualmente cada 476ms, sí. Pero **SUMADOS** crean picos cada 238ms (la mitad). El autocorrelador ve la suma como una señal con periodo de 238ms → ~183 BPM.

---

## 🔧 SOLUCIÓN: SUB-BASS SCALPEL

### Cambio quirúrgico: UNA LÍNEA

```
// ANTES (WAVE 2166):
const subEnergy = spectrum.rawSubBassEnergy + spectrum.rawBassOnlyEnergy;  // 0-250Hz

// DESPUÉS (WAVE 2167):
const subEnergy = spectrum.rawSubBassEnergy;  // 20-60Hz SOLO
```

### Por qué funciona

GodEarFFT separa las bandas con precisión quirúrgica:
- `rawSubBassEnergy`: **20-60Hz** → Donde vive el KICK de Brejcha
- `rawBassOnlyEnergy`: **60-250Hz** → Donde vive el BAJO RODANTE (el contaminante)

Al excluir la banda bass (60-250Hz), el offbeat-bass **desaparece** del análisis. Solo queda el kick, que golpea una vez por beat a 476ms = 126 BPM. La autocorrelación debería ver UN pico limpio.

### Cambios adicionales
- **Telemetría**: `lowFlux` → `subFlux` (20-60Hz) + `bassFlux` (60-250Hz, solo diagnóstico)
- **Variable**: Añadida `prevBassOnlyEnergy` para calcular bassFlux
- **Reset handler**: Incluye `prevBassOnlyEnergy = 0` en Amnesia Protocol

---

## 📊 RESULTADOS

| Métrica | Estado |
|---------|--------|
| TSC | ✅ EXIT 0 — sin errores |
| Tests | ✅ 31/32 (misma falla pre-existente: kick phase crossing) |
| Archivos modificados | `senses.ts` únicamente |
| Cambio neto | ~5 líneas de lógica, ~50 líneas de comentarios/postmortem |

---

## 🧬 CEMENTERIO DE FILTROS (ACTUALIZADO)

| WAVE | Filtro | Muerte |
|------|--------|--------|
| 2159 | Centroid Sniper >1500Hz | Mató kicks reales |
| 2160 | Raw low flux only | PM2 debounce comía offbeats |
| 2161 | GodEar + Shark Fin | Spikes delgados, BPM errático |
| 2162 | FFT pre-AGC + fire Sniper | Hi-hats inundaron |
| 2163 | Restore Sniper only | Bajo rodante pasó ambos gates |
| 2164 | √(low×mid) multiplicative | Aplastó 65% de energía real |
| 2165 | Gatekeeper midFlux>0.001 | midFlux=0 en kicks reales |
| **2166** | **Naked (sub+bass 0-250Hz)** | **Offbeat bass → half-beat → ~183→97 BPM** |
| **2167** | **Sub-bass Scalpel (20-60Hz)** | **🧪 PENDIENTE TEST** |

---

## 🔮 PREDICCIÓN

Si el kick de Brejcha vive realmente en 20-60Hz (sub-bass puro), el autocorrelador debería ver:
- Un pico dominante en **~126 BPM** (lag ~41 en upsampled space)
- Posiblemente un armónico en **~252 BPM** (fuera de MAX_BPM=190, ignorado)
- Posiblemente un sub-armónico en **~63 BPM** (fuera de MIN_BPM=70, ignorado)

### Riesgos
1. Si el kick NO tiene suficiente energía en 20-60Hz → la señal será muy débil (needle ≈ 0)
2. Si el rolloff del 85% de energía es 172Hz (como vimos en F80), la mayoría de energía está >60Hz → sub-bass sola podría ser insuficiente

**Si falla**: Explorar alimentar rawSubBassEnergy con un poco de rawLowMidEnergy (250-500Hz) como "condimento" para capturar el click del kick sin capturar el bajo.
