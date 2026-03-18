# WAVE 2119: THE BEATER CLICK 🥁

**Commit:** `c9dda22`  
**Archivos modificados:** `senses.ts`, `GodEarBPMTracker.ts`  
**Tests:** 18/18 ✅  
**Compilación:** 0 errores  
**Performance:** 8.04ms / 60s audio  

---

## 🩺 DIAGNÓSTICO POST-WAVE 2118

### Log `atortasconelBPM.md` — La Evidencia

WAVE 2118 (`subBass×1.5 + bass×0.4`) **NO fue suficiente**. El log muestra:

| Frame | BPM | Conf | Intervalos | Veredicto |
|-------|-----|------|------------|-----------|
| 131-225 | 117 | 0.43 | — | BPM bajo, conf baja, warmup |
| 226-238 | 119→144 | 0.80 | `[511,418,325,325]` | Rampa ascendente — offbeats infiltrándose |
| 250-261 | 142→117 | 0.39 | — | Cae brevemente |
| 280-300 | 114→131 | 0.47-0.53 | — | Oscila sin converger |
| 360 | 117 | 0.58 | `[697,697,325,372,697,697]` | Intervalos mixtos: 325/372 = offbeats |
| 480 | 144 | 0.54 | `[279,418,325,325,325,743]` | **279ms back!** Sub-beats vivos |
| 600 | 117 | 0.58 | `[836,511,325,372,697,697]` | 325/372 = contaminación offbeat |
| 660-720 | 144→161 | 0.54→0.61 | `[372,325,279,372,557,511]` | **161 BPM LOCKED** |
| 840+ | 161 | 0.65+ | `[557,511,372,325,372,325]` | Bloqueado hasta fin del log |

### ¿Por qué falló WAVE 2118?

**El "rumble bass" de Brejcha inunda el subBass.** No solo la banda `bass` (60-250Hz) — el rumble tiene armónicos fundamentales que bajan hasta 40-50Hz, aterrizando en `subBass`. La ponderación `subBass×1.5 + bass×0.4` amplificaba TAMBIÉN el rumble del contratiempo.

---

## 🥁 LA CIRUGÍA: Multi-Band Coincidence

### Insight del Arquitecto

> "El 'click' del bombo vive en los medios. El bajo rodante no tiene medios."

Un kick de bombo real tiene **dos componentes**:
1. **Cuerpo** → subBass (20-60Hz) — la presión de aire
2. **Beater click** → mid (500-2000Hz) + highMid (2000-6000Hz) — el impacto del parche

Un rumble bass rodante tiene **solo uno**:
1. **Cuerpo** → subBass + bass (20-250Hz) — frecuencia grave pura
2. **NO tiene click** → mid/highMid ≈ 0

### Fórmula

```typescript
const beaterClick = godEarRaw.bandsRaw.mid + godEarRaw.bandsRaw.highMid;
const trackerEnergy = rawSubBass * (1.0 + (beaterClick * 5.0));
```

### Matemática del Abismo

| Evento | subBass | beaterClick | Multiplicador | trackerEnergy |
|--------|---------|-------------|---------------|---------------|
| **Kick real** | 0.25 | 0.50 | 3.50 | **0.875** |
| **Rumble bass** | 0.20 | 0.05 | 1.25 | **0.250** |
| **Noise floor** | 0.02 | 0.01 | 1.05 | 0.021 |

- **Ratio kick/rumble = 3.5:1** → KICK_RATIO_THRESHOLD=1.7 lo aplasta
- El multiplicador es **exponencial**: si no hay click, la energía queda plana
- Si hay click (kick real), la energía se dispara ×3.5

### Implementación

```typescript
// En processAudioBuffer(), reemplazando WAVE 2118:
const godEarRaw = spectrumAnalyzer.getLastGodEarResult();
const rawSubBass = godEarRaw ? godEarRaw.bandsRaw.subBass : spectrum.rawSubBassEnergy;
const beaterClick = godEarRaw
  ? godEarRaw.bandsRaw.mid + godEarRaw.bandsRaw.highMid
  : 0;
const trackerEnergy = rawSubBass * (1.0 + (beaterClick * 5.0));
```

Accedemos a `getLastGodEarResult()` directamente para obtener las bandas raw de mid/highMid sin exponer campos extra en el return del analyze.

---

## 📐 ARQUITECTURA

```
GodEarFFT.analyze(buffer)
  ↓ bandsRaw.subBass   (20-60Hz)   → cuerpo del kick + rumble
  ↓ bandsRaw.mid       (500-2kHz)  → beater click del kick
  ↓ bandsRaw.highMid   (2-6kHz)    → ataque del beater
  ↓
processAudioBuffer()
  ↓
  beaterClick = mid + highMid       → 🥁 WAVE 2119: detector de click
  trackerEnergy = subBass × (1 + click × 5)
  ↓
GodEarBPMTracker.process(trackerEnergy, kickDetected, timestamp)
  ↓ ratio > 1.7 → KICK!
  ↓ intervals → IQR filter → median → BPM
```

---

## 📊 EVOLUCIÓN

| WAVE | Fórmula | Resultado |
|------|---------|-----------|
| 1162 | `subBass + bass` | BPM=161 (offbeats = kicks) |
| 2116 | ratio=2.0, delta=0.03 | BPM=0 (demasiado agresivo) |
| 2117 | ratio=1.7, delta=0.015 | BPM=161 (offbeats siguen) |
| 2118 | `subBass×1.5 + bass×0.4` | BPM=161 (rumble inunda subBass) |
| **2119** | **`subBass × (1 + (mid+highMid)×5)`** | **Pending deploy** |

---

## ⚠️ DEPLOY & VERIFICACIÓN

1. `npm run build` en electron-app
2. Reproducir Brejcha (~126 BPM)
3. **Esperar:** BPM debería converger a ~124-128
4. **Los intervalos del GODEAR BPM log deben mostrar ~480ms** (no 325/372)
5. **El conf debería subir >0.7** (intervalos limpios = baja varianza)

**Si sigue en 161:** Significaría que `bandsRaw.mid` + `bandsRaw.highMid` NO son suficientemente altos durante kicks reales, o que el rumble bass de Brejcha SÍ tiene componentes mid. En ese caso, la siguiente estrategia sería **autocorrelación temporal** (no energía instantánea).

---

*PunkOpus — WAVE 2119 — The Beater Click*
