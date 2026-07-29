# STROBE ENGINE — Forensic Report (FFT V3)

> **Fecha:** 2025-01-30  
> **Módulos analizados:** `GodEarFFT.ts`, `LiquidEngineBase.ts`, `LiquidAetherAdapter.ts`, `SeleneLux.ts`, `IntervalBPMTracker.ts`  
> **Log telemetría:** `docs/forensics/backfrontstrobe.md` (Eric Prydz — back channel, ~447 frames)

---

## 1. Arquitectura del Strobe — Dos Sistemas Paralelos

El sistema tiene **dos motores de strobe independientes** que convergen en el pipeline:

### 1.1 StrobeEngine (Photon Block — FFT V3)

**Ubicación:** `GodEarFFT.ts` — clase `StrobeEngine`

Motor de strobe moderno basado en **densidad de transientes + ruido blanco + flux espectral**. Opera en el dominio del análisis FFT y produce un estado de strobe con rate Hz y duty cycle.

**Inputs:**
- `transientDensity` [0,1] — tasa de onsets en ventana deslizante 500ms (`SlopeBasedOnsetDetector`)
- `whiteNoiseScore` [0,1] — indicador de ruido broadband (spectral flatness)
- `spectralFlux` [0,~1] — flux V3 normalizado (floored+expanded)
- `tonalRatio` — `kickSignal / (scaledBands.treble + 1e-6)` — ratio bass/agudos

**Pesos (WAVE 8005 R3 — grid search 27 rolls + 63 kicks + 37 melodic):**
- `WEIGHT_TRANSIENT = 0.50` — densidad de transientes (carries roll detection)
- `WEIGHT_NOISE = 0.15` — ruido blanco (cut: melodic exploits flatness)
- `WEIGHT_FLUX = 0.35` — flux espectral (compensates)

**Thresholds:**
- `ACTIVATION_THRESHOLD = 0.60` — 0% kicks fire, 44% all rolls, 55% pure rolls
- `DEACTIVATION_THRESH = 0.30` — hysteresis band
- `MAX_RATE_HZ = 12` — cap fotosensible
- `MIN_RATE_HZ = 2` — below = no strobe

**Tonal Gate:**
- `TONAL_GATE_KNEE = 3.0` — sin penalización
- `TONAL_GATE_RATIO = 5.0` — penalización total
- Escala down `transientDensity` cuando el signal es overwhelmingly tonal (bass/synth sostenido). White noise y flux pasan intactos → snares/hi-hats sobre bassline siguen disparando.

**Smoothing:**
- Attack: `k = 0.35` (subida rápida)
- Release: `k = 0.06` (caída lenta)
- Cooldown: 200ms post-desactivación (anti-flicker)

**Output:** `{ active, rateHz, duty, drive }`
- `rateHz` mapeado de `[ACTIVATION_THRESHOLD, 1.0]` → `[MIN_RATE, MAX_RATE]`
- `duty` inverso al rate: high drive → 8-15%, low drive → 20-30%

### 1.2 calculateStrobe (Physics Engine — Legacy)

**Ubicación:** `LiquidEngineBase.ts` — método `calculateStrobe()`

Motor de strobe binario legacy basado en **picos de treble + ultraAir**.

**Parámetros (techno profile):**
- `strobeThreshold = 0.80` — umbral de treble puro
- `strobeDuration = 30` — ms de duración del strobe
- `strobeNoiseDiscount = 0.80` — factor de descuento en modo noise

**Lógica:**
- `isPureTreblePeak = treble > effectiveThreshold`
- `isUltraAirCombo = ultraAir > 0.70 && treble > 0.60`
- Si cualquiera es true y no está activo → activa por 30ms
- Intensidad binaria: 1.0 o 0

**WAVE 4826.5 — Güiro Effect Override:**
- Si `isDrop` (bass < 0.35 && lowMid < 0.4) y `trebleDelta > 0.25`:
  - Fuerza `strobeResult.active = true`
  - `strobeResult.intensity = min(1.0, intensity + trebleDelta * 2.0)`
  - Inyecta flashes dorados en Tungsten durante drops

---

## 2. Flujo de Datos — Pipeline Completo

```
GodEarFFT.analyze()
  ├─ SlopeBasedOnsetDetector.detectOnset('kick', subBass + bass*0.5)
  ├─ SlopeBasedOnsetDetector.detectOnset('snare', mid + lowMid*0.5)
  ├─ SlopeBasedOnsetDetector.detectOnset('hihat', treble + highMid*0.3)
  ├─ transients.any = kick || snare || hihat
  ├─ transientDensity = onsetDetector.updateTemporalDensity(transients.any, deltaMs)
  ├─ tonalRatio = kickSignal / (scaledBands.treble + 1e-6)
  ├─ strobeState = strobeEngine.process(transientDensity, whiteNoiseScore, spectralFlux, deltaMs, tonalRatio)
  └─ photon.strobe = strobeState

LiquidEngineBase.process()
  ├─ calculateStrobe(treble, ultraAir, noiseMode)  ← legacy binary strobe
  ├─ Güiro override (drop detection)
  └─ result.strobeActive / result.strobeIntensity

SeleneLux.process()
  ├─ if photon.strobe.active → strobeOverride = { rate, duty }  ← PHOTON TIENE PRIORIDAD
  ├─ isStrobeActive = true
  └─ lastOutput.strobeOverride = strobeOverride

LiquidAetherAdapter.ingest()
  ├─ if result.strobeActive → _routeStrobeNodes(result, bus)
  └─ _routeStrobeNodes:
      ├─ Filtra zonas: floor/ambient/air = BLOCKED
      ├─ Filtra nodos sin canal shutter
      └─ Push intent: shutter=1.0, strobeRate=intensity
```

---

## 3. Densidad de Transientes — El Corazón del Roll Detection

**Clase:** `SlopeBasedOnsetDetector`

### 3.1 Detección de Onsets

Cada banda (kick, snare, hihat) mantiene un historial circular de 8 valores de energía. El onset se detecta cuando:
- `shortTermSlope > slopeThreshold` (pendiente corta, 2 frames)
- `longTermSlope > slopeThreshold * 0.5` (pendiente larga, 4 frames)
- `slopeThreshold = max(avgEnergy * 0.05, avgEnergy * 0.3)`

### 3.2 Densidad Temporal

- **Ventana:** 500ms sliding window
- **Saturación:** 6 onsets = densidad 1.0
- **Base:** 1 onset = 0.15
- **Capacidad:** 32 onsets (ring buffer zero-alloc)

**Mapping:** 0 hits → 0.0 | 1 hit → 0.15 | 6+ hits → 1.0 (linear)

Esto es lo que distingue un **redoble** (6+ onsets en 500ms = densidad 1.0) de un **kick aislado** (1 onset = densidad 0.15).

---

## 4. Kick Detection — Doble Sistema

### 4.1 GodEarFFT Onset Detector (alimenta strobe)

- Detecta onsets en banda `kick` usando `subBass + bass * 0.5`
- **No tiene debounce adaptativo** — detecta cada frame donde la pendiente supera el threshold
- Cada onset kick incrementa `transientDensity` → alimenta `StrobeEngine`

### 4.2 IntervalBPMTracker (alimenta front channel)

- Detecta kicks basado en `rawBassEnergy` vs rolling average
- **Tiene debounce adaptativo** + peak discriminator
- `MIN_INTERVAL_MS = 200ms` — anti double-trigger
- `PEAK_DISCRIMINATOR_RATIO = 0.65` — acepta kicks suaves
- `MIN_KICK_ENERGY = 0.150` — floor anti-rumble

### 4.3 Front Channel Kick Edge (LiquidEngineBase / LiquidStereoPhysics)

- `isKick` viene del `IntervalBPMTracker`
- `isKickEdge = isKick && _kickIntervalMs > p.kickEdgeMinInterval`
- `kickEdgeMinInterval = 80ms` (techno profile)
- `kickVetoFrames = 0` (desactivado en techno — WAVE 2419)
- `kickSignal = isKick ? pureBassEnergy : 0` → alimenta `envKick`

**Problema conocido:** Si `isKick` se dispara por dobles bombos o subbajo rodante, `isKickEdge` puede saltar en intervalos > 80ms, produciendo un "ministrobe doble" en el front channel.

---

## 5. Análisis de Telemetría — Back Channel (Eric Prydz)

### 5.1 Estructura del Log

```
[BACK-TEL] sB:0.307 bass:0.716 mid:0.641 hM:0.501 tr:0.308 | isK:0 isKE:0 percRaw:0.000 | morph:1.000 brk:0 strict:1 | bL_in:0.303 bL_gate:0.335 bL_sq:0.150 bL_pow:0.000 bL_ign:0 | bR_in:0.000 bR_gate:0.360 bR_sq:0.100 bR_pow:0.000 bR_ign:0 | outBL:0.465 outBR:0.216 outPar:0.465
```

**Campos:**
- `sB` = subBass, `bass`, `mid`, `hM` = highMid, `tr` = treble
- `isK` = isKick, `isKE` = isKickEdge
- `percRaw` = percRaw (hybrid snare impulse)
- `morph` = morphFactor, `brk` = breakdown, `strict` = strict mode
- `bL_in/bL_gate/bL_sq/bL_pow/bL_ign` = Back Left input/gate/squeeze/power/ignore
- `bR_in/bR_gate/bR_sq/bR_pow/bR_ign` = Back Right input/gate/squeeze/power/ignore
- `outBL/outBR/outPar` = output Back Left / Back Right / Par

### 5.2 Patrones Observados

#### Fase 1: Intro sin rolls (frames 1-3)
- `percRaw:0.000`, `isK:0`, `isKE:0`
- Back Right gate = 0.360, output decay suave
- No hay strobe activo

#### Fase 2: Roll burst inicial (frames 4-7)
- `percRaw:1.000` — hybrid snare impulse saturado
- `bR_in:1.000`, `bR_pow:1.000`, `bR_ign:1` — back right ignicion total
- `outBL:1.000 outBR:1.000 outPar:1.000` — output máximo
- **Strobe visual:** back right + par a 1.000 = flash blanco total

#### Fase 3: Roll sostenido con kicks (frames 13-17)
- `isK:1 isKE:1` → `isK:1 isKE:0` (solo primer kick = edge)
- `percRaw:1.000` sostenido
- Back Right se mantiene en 1.000 mientras percRaw = 1.000
- Cuando percRaw cae a 0.000, back right decae gradualmente (0.600 → 0.360 → 0.216 → 0.130 → 0.073 → 0.016 → 0.003 → 0.000)

#### Fase 4: Roll extendido (frames 86-103)
- `isK:0 isKE:0` pero `percRaw:1.000` sostenido por ~18 frames
- Back Right permanece en 1.000 todo el tiempo
- **Esto es el comportamiento esperado:** el strobe photon detecta densidad de transientes alta y mantiene el flash

#### Fase 5: Build-up con subbass creciente (frames 366-431)
- `sB` sube de 0.288 → 0.936
- `bass` llega a 1.000
- `isK:1 isKE:0` continuo (kicks detectados pero sin edge — intervalo < 80ms)
- `percRaw:0.000` — no hay rolls de percusión
- Back Right decae a 0.000 (no hay strobe)
- **morph** baja de 1.000 → 0.906 (compresión por bass dominante)

### 5.3 Observaciones Clave

1. **percRaw es binario** (0.000 o 1.000) — no hay gradación. Esto viene del `_lastHybridSnare` que ahora usa `Math.max(percRaw, _snareImpulse)`.

2. **Back Right = strobe proxy** — cuando `percRaw:1.000`, `bR_in:1.000` y `outBR:1.000`. El strobe del back channel está directamente acoplado a la detección de percusión.

3. **isKickEdge rara vez se dispara** — solo en frames donde `isK:1` AND el intervalo desde el último kick > 80ms. En rolls rápidos, `isKE:0` siempre.

4. **No se observan falsos ministrobe dobles** en este log de back channel. El problema reportado es específico del **front channel**.

5. **Decaimiento de Back Right** sigue un patrón de escalera: 1.000 → 0.600 → 0.360 → 0.216 → 0.130 → 0.073 → 0.016 → 0.003 → 0.000. Esto corresponde al envelope decay del back right, no al strobe engine.

---

## 6. Problema Identificado — Falsos Double Kick Strobe en Front Channel

### 6.1 Síntoma

El usuario reporta "ministrobe doble" en el front channel causado por:
- Dobles bombos (double bass drum)
- Subbajo rodante que se cuela como kick

### 6.2 Cadena Causal

```
Subbasso rodante / double bass
  → IntervalBPMTracker.detectKick() dispara isKick=true
  → LiquidEngineBase: isKick=true, _kickIntervalMs > 80ms
  → isKickEdge = true
  → kickSignal = pureBassEnergy (bands.bass directo)
  → envKick.process(kickSignal) → impulso en frontRight
  → Si ocurre 2x en rápida sucesión → "ministrobe doble"
```

### 6.3 Por qué el back channel no tiene este problema

El back channel usa `percRaw` (hybrid snare impulse) que viene del `StrobeEngine` photon, no del `IntervalBPMTracker`. El strobe photon requiere **densidad de transientes alta** (6+ onsets en 500ms) para activarse, lo que filtra dobles bombos aislados.

### 6.4 Por qué el front channel sí lo tiene

El front channel (`LiquidEngineBase`) usa `isKick` del `IntervalBPMTracker` directamente, sin pasar por el `StrobeEngine`. El `kickEdgeMinInterval = 80ms` es demasiado permisivo para subbass rodante a 135 BPM (intervalo entre beats = 444ms, pero sub-armónicos pueden disparar cada ~200-300ms).

---

## 7. Zonas Strobe — Gating por Zona (WAVE 4752)

**STROBE_BLOCKED_ZONES:** `floor`, `ambient`, `air`

El strobe solo se enruta a nodos IMPACT con canal `shutter` en zonas no bloqueadas. Esto significa:
- **Zonas permitidas:** front, flash, movers, heat, etc.
- **Zonas bloqueadas:** floor, ambient, air (luz base, no strobe)

---

## 8. DMX Safety — Hardware Protection

**HardwareSafetyLayer:** Solo debounce pasivo. Sin chaos latch, sin strobe delegation.
- `delegateToStrobe = false` (siempre)
- `suggestedShutter = 255` (siempre open)
- DarkSpinFilter maneja blackout mecánico durante tránsito de color
- `maxStrobeHz = 12` para fixtures mecánicos (shutter físico)

**DMXPersonalityRemapper:** Para hardware no estándar:
- `strobeOpenValue = 255` (luz continua)
- `strobeRangeMin = 4, strobeRangeMax = 207`
- Fórmula: `Math.floor(4 + strobeIntent * 203)`

---

## 9. Parámetros Actuales — Techno Profile

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| `strobeThreshold` | 0.80 | Umbral treble (legacy) |
| `strobeDuration` | 30 ms | Duración strobe legacy |
| `strobeNoiseDiscount` | 0.80 | Descuento en noise mode |
| `kickEdgeMinInterval` | 80 ms | Intervalo mínimo para kick edge |
| `kickVetoFrames` | 0 | Veto desactivado (WAVE 2419) |
| `ACTIVATION_THRESHOLD` | 0.60 | Drive threshold StrobeEngine |
| `DEACTIVATION_THRESH` | 0.30 | Hysteresis floor |
| `MAX_RATE_HZ` | 12 | Cap fotosensible |
| `WEIGHT_TRANSIENT` | 0.50 | Peso densidad transientes |
| `WEIGHT_NOISE` | 0.15 | Peso ruido blanco |
| `WEIGHT_FLUX` | 0.35 | Peso flux espectral |
| `DENSITY_WINDOW_MS` | 500 | Ventana densidad onsets |
| `DENSITY_SATURATION_HITS` | 6 | Onsets para densidad 1.0 |
| `DENSITY_BASE` | 0.15 | Densidad con 1 onset |

---

## 10. Conclusiones

1. **El StrobeEngine (photon) funciona correctamente para rolls** — la densidad de transientes distingue rolls de kicks aislados con 0% falsos kicks en grid search.

2. **El strobe legacy (calculateStrobe) es binario y menos sofisticado** — se activa por picos de treble/ultraAir con duración fija de 30ms. El override Güiro inyecta flashes en drops.

3. **El problema de "ministrobe doble" está en el front channel**, no en el back. El front channel usa `isKickEdge` del `IntervalBPMTracker` con `kickEdgeMinInterval = 80ms`, que es demasiado permisivo para subbass rodante.

4. **Posibles fixes (no implementados aún):**
   - Aumentar `kickEdgeMinInterval` a 150-200ms para subbass rodante
   - Requerir que `isKickEdge` pase por el `StrobeEngine` photon en lugar del `IntervalBPMTracker` directo
   - Añadir veto frames específico para front channel cuando `tonalRatio` es alto (bass dominante)
   - Conectar el front channel strobe al `photon.strobe.active` en lugar del `isKickEdge` binario
