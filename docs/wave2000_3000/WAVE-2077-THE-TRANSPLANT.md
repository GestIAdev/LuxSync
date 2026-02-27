# ⚡ WAVE 2077: THE TRANSPLANT — GodEarFFT Integration into Chronos

**Status:** IN PROGRESS  
**Fecha:** Febrero 2026  
**Tipo:** Architectural Upgrade — DSP Core Transplant

---

## 🎯 OBJETIVO

Reemplazar el análisis espectral FALSO de `GodEarOffline.ts` (zero-crossing rate) con el GodEarFFT REAL (Cooley-Tukey + Blackman-Harris + Linkwitz-Riley LR4).

## 📊 ANTES vs DESPUÉS

| Aspecto | ANTES (Zero-Crossing) | DESPUÉS (GodEarFFT) |
|---------|----------------------|---------------------|
| Bass detection | `zcRate * 50` heurística | LR4 SubBass 20-60Hz + Bass 60-250Hz |
| High detection | `zcRate * 20` heurística | LR4 Treble 6-16kHz + UltraAir 16-22kHz |
| Bandas | 2 (bass, high) | 7 tácticas (subBass→ultraAir) |
| FFT | ❌ NO HAY | Cooley-Tukey Radix-2, 4096 bins |
| Windowing | ❌ NO HAY | Blackman-Harris 4-term (-92dB) |
| Flux | `|energy - prevEnergy|` | Spectral flux real entre frames |
| Métricas | Ninguna | Centroid, Flatness, Rolloff, Clarity |

## 🏗️ PUNTOS DE INTERVENCIÓN

### 1. `GodEarOffline.ts` (src/chronos/analysis/)
- Importar `GodEarAnalyzer` desde `../../workers/GodEarFFT`
- Reescribir `extractEnergyHeatmap()` — loop ventana-por-ventana con FFT real
- Mejorar `detectBeats()` — alimentar con subBass+bass reales
- Mejorar `detectTransients()` — usar slope detection del FFT

### 2. `phantomWorker.html` (electron/workers/)
- El HTML embebe su propia copia del análisis (JavaScript plain)
- Actualizar `extractEnergyHeatmap()` con FFT inline
- Mantener como JavaScript (no TypeScript — es un HTML inline script)

### 3. `types.ts` (src/chronos/core/)
- Extender `HeatmapData` con bandas tácticas opcionales
- Backwards compatible — bass/high/energy/flux se mantienen

## 🛡️ COMPATIBILIDAD

- `HeatmapData.bass` y `.high` siguen existiendo (legacy)
- Se agregan campos opcionales para las 7 bandas
- `detectBeats()` usa subBass+bass reales en vez del bass fake
- `WaveformLayer.tsx` solo usa `energyHeatmap.energy` — no se rompe
- `detectSections()` mejora pero mantiene misma interfaz

## ⚠️ DECISIÓN CLAVE: phantomWorker.html

El Phantom es JavaScript inline (no puede importar TypeScript).
Opciones:
- **A)** Copiar las funciones FFT esenciales como JS inline en el HTML
- **B)** Pre-compilar GodEarFFT a JS y cargarlo con require() en el phantom

**Decisión: B)** — El phantom ya usa `require('electron')`, puede hacer `require()` de un JS compilado. Menos duplicación.

---

*"2077 — el año en que Chronos dejó de fingir que escuchaba."*
