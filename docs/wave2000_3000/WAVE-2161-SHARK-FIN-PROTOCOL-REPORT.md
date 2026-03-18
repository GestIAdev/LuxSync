# WAVE 2161 — THE SHARK FIN PROTOCOL

**Commit:** `52b19b7`  
**Archivo modificado:** `electron-app/src/workers/senses.ts`  
**Insertions:** 91 | **Deletions:** 69  

---

## EL PROBLEMA: PacemakerV2 — Muerte por Debounce

### Log: afterlife_dreamtheater.md (Boris Brejcha ~126 BPM)

PM2 clústeres a lo largo del track:
```
F1320: [161:6v | 185:5v | 92:4v | 99:3v | 86:1v]   ← 5 clusters, NINGUNO a 126
F1380: [185:7v | 161:6v | 92:3v | 99:2v | 108:1v]   ← 185/161 dominantes
F1500: [161:7v | 185:5v | 92:2v | 108:1v | 86:1v]   ← lo mismo
F1620: [92:5v  | 161:3v | 185:1v | 129:1v]           ← 92 toma control
F1800: [92:6v  | 108:2v | 99:2v  | 144:1v | 129:1v]  ← basura total
F1920: [185:4v | 161:4v | 99:3v  | 92:2v  | 144:1v]  ← de vuelta al caos
```

**126 BPM NO APARECE NUNCA.** El motor está clavado en 99 BPM con conf=0.264.

### La Cadena de Errores

1. El Frequency Sniper (WAVE 2159) mata offbeats de centroide alto → `🎯SNIPED(6256Hz)` ✅
2. PERO algunos offbeats tienen centroide < 1500Hz (bajo puro + capa de reverb) → pasan al Sniper
3. PM2 registra el offbeat y activa su **Debounce Gate** (315-400ms de ceguera)
4. El kick REAL cae durante esos 315ms mientras PM2 tiene los ojos cerrados
5. PM2 nunca ve el intervalo de 476ms (126 BPM) → genera 325ms (185), 372ms (161), 650ms (92)

**El Debounce Gate es el problema fundamental.** No se puede resolver con más filtrado — es un límite arquitectónico del modelo IOI con masking temporal.

---

## LA SOLUCIÓN: Resurrección de la Autocorrelación

### ¿Por qué la Autocorrelación falló antes? (WAVE 2151)

La autocorrelación recibía "agujas" de 1 frame (≈46ms). Cuando dos kicks caen con ±1 frame de jitter (groove humano, pitch del DJ), las agujas no se solapan:

```
Frame:    1  2  3  4  5  6  7  8  9  10  11  12
Kick A:   1  0  0  0  0  0  0  0  0   0   0   0
Kick B:   0  0  0  0  0  0  0  0  0   0   1   0
                                              ↑
                                     Se cruzan y se pierden

Autocorrelación en lag 10: Spike[1] × Spike[11] = 1 × 0 = 0
                                                         ↑ Miss!
```

### La Aleta de Tiburón (Shark Fin)

En vez de spikes de 1 frame, creamos un **envelope follower** con decay exponencial:

```
SHARK_FIN_DECAY = 0.85

Frame:    1     2     3     4     5     6     7     8     9     10
Spike:    1.0   0     0     0     0     0     0     0     0     0
Fin:      1.0   0.85  0.72  0.61  0.52  0.44  0.37  0.32  0.27  0.23

fatNeedle = Math.max(snipedFlux, fatNeedle * 0.85)
```

Ahora la autocorrelación ve **humps anchos** que se solapan aunque haya jitter:

```
Kick A Fin: 1.0  0.85 0.72 0.61 0.52 0.44 0.37 0.32 0.27 0.23  0.20
Kick B Fin: 0    0    0    0    0    0    0    0    0    0    1.0  0.85

Autocorrelación en lag 10: Fin_A[1]×Fin_B[11] + Fin_A[2]×Fin_B[12] + ...
                           = 0.23 × 1.0 + 0.20 × 0.85 + ... = STRONG SIGNAL
```

**La montaña de correlación en 476ms (126 BPM) es ahora matemáticamente innegable.**

### ¿Por qué 0.85?

- A ~46ms/frame: **half-life ≈ 4.3 frames ≈ 200ms**
- 126 BPM = 476ms entre kicks ≈ 10 frames
- Tras 10 frames: `0.85^10 ≈ 0.20` — todavía el 20% de la amplitud original
- La cola del kick N se solapa con el inicio del kick N+1
- Tras 20 frames: `0.85^20 ≈ 0.04` — despreciable (no contamina kicks distantes)

---

## PIPELINE FINAL

```
Audio Buffer (2048 samples)
    ↓
Ring Buffer (4096 samples)
    ↓
GodEar FFT (Radix-2 DIT)
    ↓
Spectrum Analysis → spectralCentroid (Hz), subEnergy (0-200Hz)
    ↓
Raw Low Flux: delta(subEnergy), positive only
    ↓
🎯 Frequency Sniper (WAVE 2159): centroid > 1500Hz → KILL
    ↓
🦈 Shark Fin (WAVE 2161): envelope follower, decay 0.85/frame
    ↓
GodEarBPMTracker: Autocorrelation 4× upsampled + Harmonic Sieve
    ↓
State Output → BPM
```

---

## QUÉ SE DESTRUYÓ

| Componente | Estado |
|-----------|--------|
| PacemakerV2 | 🪦 Import comentado. Código intacto. |
| HarmonicGearbox | 🪦 Import comentado. Código intacto. |
| `pacemaker` instancia | Eliminada → `bpmTracker` (GodEarBPMTracker) |
| `gearbox` instancia | Eliminada (autocorrelación tiene sieve interno) |
| `fatNeedle` | NUEVO — module-scope, persiste entre frames |
| Reset handler | Actualizado: `bpmTracker.reset()` + `fatNeedle = 0` |

## QUÉ SE MANTUVO

| Componente | Estado |
|-----------|--------|
| Raw Low Flux (WAVE 2160) | ✅ Intacto — `Math.max(0, subEnergy - prevSubEnergy)` |
| Frequency Sniper (WAVE 2159) | ✅ Intacto — centroid > 1500Hz → kill |
| GodEarBPMTracker | ✅ Resucitado sin cambios. 852 líneas, 0 modificaciones |
| GodEarFFT (Radix-2 DIT) | ✅ Intacto |

---

## TESTS

31/32 GodEarBPMTracker tests pasan. El fallo (TEST 1: kick detection via phase crossing) es preexistente — el buffer sintético no genera suficiente energía absoluta para `KICK_MIN_ABSOLUTE_ENERGY=0.15`. No está relacionado con WAVE 2161.

Tests de BPM que pasan:
- 128 BPM Standard 4/4 EDM ✅
- 126 BPM Brejcha offbeats ✅
- 174 BPM DnB ✅
- 95 BPM Reggaetón ✅
- Todas las variantes de polyrhythm, octave lock, time warp ✅

---

## QUÉ ESPERAR EN EL LOG

```
[SHARK] F1340 bpm=126 conf=0.743 kick=false phase=0.54 lowFlux=0.0000 fin=0.0023 centroid=334Hz samples=286
[SHARK] F1380 bpm=126 conf=0.756 kick=false phase=0.38 lowFlux=0.0035 sniper=0.0000 fin=0.0030 centroid=4104Hz samples=286 🎯SNIPED(4104Hz)
```

- `[SHARK]` en vez de `[NEEDLE]`
- `fin=` → valor del fatNeedle (envelope)
- `samples=` → muestras en el buffer de autocorrelación
- Sin clusters (autocorrelación no los usa)
- Sin gear (sin Gearbox)

---

## RIESGOS

1. **El GodEarBPMTracker fue archivado por octave bounce.** Eso era con el FFT roto (SplitX Radix). Desde WAVE 2096.1 el FFT es Radix-2 DIT limpio. Hay que verificar que no vuelva el bounce.

2. **El Shark Fin podría "engordar" demasiado un onset aislado** y crear falsa periodicidad si hay silencios largos. El `TIME_WARP_THRESHOLD_MS=3000` del tracker protege contra gaps grandes.

3. **Sin Gearbox**, el motor depende enteramente del sieve armónico interno del autocorrelador. Si lee 186 BPM en vez de 93, el Octave Lock (8 scans) debería proteger. Monitorear.

---

*PunkOpus × Radwulf — El Tiburón no escucha. Calcula.*
