# WAVE 2124: THE UNIVERSAL FLUX — Spectral Onset Detection

**Commit:** `509f75c`  
**Fecha:** 2026-03-04  
**Archivo:** `electron-app/src/workers/senses.ts`  
**Tests:** 25/25 ✅ (tracker intacto — cambio solo en la entrada)  
**Directiva de:** PunkArchytect (GeminiPunk 3.1)  
**Ejecutada por:** PunkOpus

---

## 📋 PROBLEMA

El motor de autocorrelación (WAVE 2123) es matemáticamente perfecto. Pero la señal que le alimentamos — `rawBassEnergy` (energía absoluta de graves) — **no contiene un patrón a 126 BPM**.

### Prueba irrefutable del log de producción (`atortasconelBPM.md`)

126 BPM = bombo cada 476ms = **Lag 41** a virtualDur=11.61ms.

| Frame | Correlación en L43 (~120 BPM) | Veredicto |
|-------|-------------------------------|-----------|
| 960   | **-0.229** | ❌ NEGATIVA |
| 1080  | **-0.170** | ❌ NEGATIVA |
| 1200  | **-0.040** | ❌ ~CERO |
| 1320  | **+0.154** | ⚠️ Apenas positiva |
| 1440  | **-0.254** | ❌ NEGATIVA |
| 1560  | **-0.131** | ❌ NEGATIVA |
| 1620  | **-0.324** | ❌ NEGATIVA |
| 1680  | **-0.362** | ❌ NEGATIVA |

**7 de 8 scans con correlación NEGATIVA en la fundamental real.** El motor no encuentra 126 BPM porque, en la energía bruta, ese patrón literalmente no existe.

### ¿Por qué no existe?

El Tech House de Brejcha tiene:
1. **Bajo rodante sostenido** — energía constante entre kicks → aplana los valles
2. **Contratiempos a alta energía** — offbeats que rellenan los 325ms entre kicks
3. **AGC** — comprime la dinámica residual

Resultado: la señal de energía es una meseta con modulación lenta a ~170 BPM (la frecuencia de modulación del bajo), no una serie de impulsos a 126 BPM.

---

## 🔧 LA SOLUCIÓN: SPECTRAL FLUX POSITIVO

### Antes (WAVE 2122.2)
```typescript
const trackerEnergy = spectrum.rawBassEnergy / (agcGain * agcGain);
godEarBPMTracker.process(trackerEnergy, ...);
```
→ Energía absoluta. Un bajo sostenido = montaña gigante que aplasta kicks.

### Después (WAVE 2124)
```typescript
const currentTrackerEnergy = (
  spectrum.rawBassEnergy + spectrum.mid * 0.5
) / (agcGain * agcGain);

const energyDelta = currentTrackerEnergy - state.prevTrackerEnergy;
const transientFlux = Math.max(0, energyDelta);
state.prevTrackerEnergy = currentTrackerEnergy;

godEarBPMTracker.process(transientFlux, ...);
```
→ Solo ATAQUES. Un bajo sostenido = delta ≈ 0. Un kick = delta enorme.

### ¿Por qué funciona?

| Evento | Energía absoluta | Spectral flux |
|--------|-----------------|---------------|
| Kick (4-on-floor) | 0.1 → 0.8 | **0.7** ✅ |
| Bajo rodante | 0.4 → 0.5 | 0.1 (ignorable) |
| Decay post-kick | 0.8 → 0.3 | **0.0** (clamped) |
| Silencio | 0.0 → 0.0 | 0.0 |

El `Math.max(0, delta)` es la clave: elimina los decays y retiene SOLO los ataques. Esto convierte la señal en una serie de **impulsos aislados** cuya periodicidad es el tempo real.

### ¿Por qué incluir 50% de medios?

```typescript
spectrum.rawBassEnergy + spectrum.mid * 0.5
```

Los kicks acústicos de Rock/Pop tienen su "click" de ataque en 200-500Hz (banda mid). Sin esta inclusión, esos kicks serían invisibles. El 50% evita que los medios dominen en géneros electrónicos.

---

## 📐 JUSTIFICACIÓN ARQUITECTÓNICA

Esta es la técnica estándar de la industria:

- **Pioneer CDJ/DJM:** Onset detection via spectral flux
- **Rekordbox:** Spectral difference function + peak picking
- **Serato:** Multi-band onset detection with half-wave rectification

Todos miden "cuánto y qué tan rápido **aumentó** la energía", no "cuánta energía hay".

---

## 🎯 PREDICCIÓN PARA PRODUCCIÓN

Con spectral flux, la señal que entra a la autocorrelación será una serie de picos estrechos en los momentos de kick. El lag 41 (~126 BPM) debería mostrar correlación **fuertemente positiva** porque los picos se repiten cada 476ms.

El WAVE 2123 (octave lock + sieve) sigue activo como red de seguridad contra armónicos. Ahora con input limpio, la correlación en lag 41 debería dominar sobre lag 28 (186 BPM) porque el spectral flux no genera "mesetas" que el lag corto pueda correlacionar.

---

## 🔗 GENEALOGÍA

```
WAVE 2122   → Autocorrelation engine (rawBassEnergy → ~185 BPM)
WAVE 2122.2 → AGC decompensation (eliminó ~95 BPM, pero ~180 persiste)
WAVE 2122.3 → 4× temporal upsampling (octave bounce 186↔93)
WAVE 2123   → Octave-aware sieve + octave lock (estabiliza octava)
WAVE 2124   → Spectral flux onset detection (alimenta ATAQUES al tracker)
```

**La cadena completa:**
```
Audio → AGC → FFT → rawBands → spectral flux (WAVE 2124)
  → AGC decompensation (WAVE 2122.2)
  → GodEarBPMTracker.process()
    → 4× upsample (WAVE 2122.3)
    → mean-center
    → autocorrelation
    → octave-aware sieve (WAVE 2123)
    → octave-locked EMA smoothing (WAVE 2123)
  → stableBpm
```
