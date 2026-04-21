# BLUEPRINT: UNIFIED AUDIO PIPELINE — WAVE 3418
**Estado**: PROPUESTA — Pendiente de aprobación antes de codificar  
**Autor**: PunkOpus  
**Fecha**: 2026-04-21  
**Commit telemetría asociado**: (pendiente)

---

## 0. RESUMEN EJECUTIVO

El diagnóstico post-WAVE-3416 revela que el pipeline de audio tiene tres defectos estructurales que se acumulan:

| Bug | Impacto | Severidad |
|---|---|---|
| **A — Downmix incompleto** | `lowMid` (250-500Hz) y `highMid` (2-6kHz) no alimentan fixtures | CRÍTICO |
| **B — AGC `maxGain` insuficiente** | Señal de loopback (VW) ~60% más débil que MIC; el AGC no compensa | ALTO |
| **C — `AdaptiveEnergyNormalizer` independiente** | `energy` puede alcanzar 0.95 mientras las bandas individuales se quedan en 0.15 | MEDIO |

El parche puntual de cada bug de forma individual es insostenible. Este blueprint propone una refactorización limpia del pipeline en tres capas.

---

## 1. INVENTARIO DEL ESTADO ACTUAL

### 1.1 Topología de entrada de señal

```
WASAPI/VB-Cable (VirtualWire)
    │  Float32 [-1, +1]  raw WASAPI shared mode
    ▼
VirtualWireProvider.onAudioData()
    │  Escribe en SharedArrayBuffer (SAB)
    ▼
senses.ts → pollSharedRingBuffer()  [SAB path — 21ms poll]
    │  slice de samplesRead samples crudos
    ▼
processAudioBuffer(incomingBuffer)   ← ENTRADA CRUDA, sin pre-gain
    │
    ├─ ringBuffer (4096 samples overlap)
    ├─ GodEarAnalyzer.analyze(buffer)  → GodEarSpectrum (7 bandas)
    ├─ toLegacyFormat(spectrum)        → LegacyBandEnergy  ← BUG A aquí
    ├─ AGCTrustZone.process()          → bandas post-AGC    ← BUG B aquí
    └─ AdaptiveEnergyNormalizer        → energy             ← BUG C aquí

WebAudio/Mic (LegacyBridge)
    │  Float32 normalizado [-1, +1] via WebAudioAPI
    ▼
TitanOrchestrator.processAudioFrame()
    │  Llama feedAudioBuffer() → IPC postMessage
    ▼
senses.ts → case AUDIO_BUFFER         [IPC path]
    │  buffer IPC (misma ruta abajo)
    ▼
processAudioBuffer(incomingBuffer)    ← MISMA FUNCIÓN, diferente amplitud
```

### 1.2 Problema de escala de entrada

WASAPI shared mode entrega Float32 con amplitud típica de `peak ≈ 0.15-0.40` para audio de YouTube a volumen medio.  
WebAudio `getByteFrequencyData` re-normaliza a `[0, 1]` con headroom completo antes de enviar al Worker.  

**Resultado medido (estimado pre-telemetría)**: VW llega con `peak ≈ 0.15-0.25`, MIC llega con `peak ≈ 0.30-0.60`. Diferencia: ~60%. La telemetría de WAVE 3418 (`[🔬 PEAK-SAB]` vs `[🔬 PEAK-IPC]`) confirmará este ratio exacto.

### 1.3 Downmix actual de `toLegacyFormat()`

```typescript
// ESTADO ACTUAL — GodEarFFT.ts línea 1636
{
  bass:   spectrum.bands.bass   + spectrum.bands.subBass  * 0.5,   // 20-60, 60-250 Hz ✅
  lowMid: spectrum.bands.lowMid,                                    // 250-500 Hz — campo side, NUNCA leído por processFrame ❌
  mid:    spectrum.bands.mid,                                       // 500-2000 Hz ✅ (pero estrecho)
  highMid: spectrum.bands.highMid + spectrum.bands.treble * 0.3,   // 2-6kHz — campo side, NUNCA leído por processFrame ❌
  treble: spectrum.bands.treble + spectrum.bands.ultraAir * 0.5,   // 6-22kHz ✅
}
```

`processFrame()` en `TitanOrchestrator.ts` solo lee:
```typescript
bass  = lastAudioData.bass  * inputGain   // ← OK
mid   = lastAudioData.mid   * inputGain   // ← lee solo 500-2000Hz, pierde 250-500 y 2-6kHz
high  = lastAudioData.high  * inputGain   // ← se mapea a levels.treble (6kHz+)
```

**Frecuencias huérfanas para Brejcha/Techno**:
- `lowMid` 250-500Hz: warmth del kick, punch del sintetizador de bajo
- `highMid` 2-6kHz: presencia vocal, melodía del sintetizador (zona más importante del techno)

### 1.4 AGC — Ventana de historia y caps

```
historyLength = 20 frames  (~425ms warm-up @ 47fps)
bass:    targetRMS=0.45, maxGain=2.5   → max amplificación: 2.5×
mid:     targetRMS=0.50, maxGain=2.0   → max amplificación: 2.0×
highMid: targetRMS=0.45, maxGain=2.5
treble:  targetRMS=0.40, maxGain=3.0
```

Señal VW con `peak=0.18`, `avgRMS~=0.05`:  
`targetGain = 0.45 / 0.05 = 9.0` → bloqueado a `maxGain=2.5` → resultado: `0.05 × 2.5 = 0.125`. Bien por debajo del targetRMS.

**El AGC no converge porque el cap es más restrictivo que el gap de señal.**

---

## 2. PROPUESTA ARQUITECTÓNICA

### PILAR 1 — Hardware-Independent Normalization Layer (HINL)

#### Principio
Toda fuente de audio debe entregar señal al Worker con la misma "presión digital". La normalización debe ocurrir **antes** que el ring buffer, no después del FFT.

#### Implementación propuesta: `InputNormalizer` en la escritura del SAB

**Ubicación**: `VirtualWireProvider.ts`, en el callback `onAudioData`, antes de escribir al SAB.

**Estrategia**: Peak-hold con decay lento + pre-gain normalizado al target de -12dBFS (≈ 0.25 lineal).

```typescript
// PSEUDOCÓDIGO — No codificar hasta aprobación
class InputNormalizer {
  private peakHold = 0.0;
  private readonly TARGET_LEVEL = 0.25;  // -12dBFS lineal
  private readonly PEAK_DECAY = 0.9995;  // ~22s a 44100Hz para soltar el peak
  private readonly MIN_PEAK = 0.01;      // evitar división por cero

  normalize(buffer: Float32Array): void {
    // 1. Actualizar peak-hold
    for (let i = 0; i < buffer.length; i++) {
      const abs = Math.abs(buffer[i]);
      if (abs > this.peakHold) this.peakHold = abs;
    }
    this.peakHold = Math.max(this.peakHold * this.PEAK_DECAY, this.MIN_PEAK);

    // 2. Aplicar ganancia in-place
    const gain = this.TARGET_LEVEL / this.peakHold;
    // Clamp: no amplificar más de 8× (evita explosión en silencio)
    const clampedGain = Math.min(gain, 8.0);
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.max(-1.0, Math.min(1.0, buffer[i] * clampedGain));
    }
  }

  reset(): void { this.peakHold = 0.0; }
}
```

**Cuándo aplicar**: Solo en el path SAB (VirtualWire, USB DirectLink, OSC Nexus). El LegacyBridge ya entrega señal normalizada vía WebAudio.

**Integración con Amnesia Protocol**: `reset()` debe llamarse en el mismo punto que `resetPacemaker()` al cambiar de fuente.

#### Alternativa más simple (si HINL se aprueba después)

Subir el `maxGain` del AGC para VW como paso intermedio:
```
bass:    maxGain: 2.5 → 5.0
mid:     maxGain: 2.0 → 4.0
highMid: maxGain: 2.5 → 5.0
treble:  maxGain: 3.0 → 5.0
```
Esta alternativa **no es la solución correcta** — el AGC opera post-FFT y no ayuda al BPMTracker que necesita raw bass pre-AGC. Se menciona solo como workaround temporal si el HINL se retrasa.

---

### PILAR 2 — GodEarFFT Downmix Refactor (Bug A)

#### Fórmula propuesta para `toLegacyFormat()`

Principio: las 7 bandas del GodEar deben alimentar los 3 canales de fixture con **cobertura espectral continua y sin agujeros**.

```typescript
// PROPUESTA — toLegacyFormat() refactorizado
export function toLegacyFormat(spectrum: GodEarSpectrum): LegacyBandEnergy {
  return {
    // BASS = graves + sub-graves + warmth del punch (lowMid se lleva al bass por 40%)
    // → 20Hz – 500Hz continuo
    bass:    spectrum.bands.bass    + spectrum.bands.subBass  * 0.5
                                    + spectrum.bands.lowMid   * 0.4,

    // MID = presencia media + textura de synths y voces (highMid al mid por 60%)
    // → 500Hz – 6kHz continuo
    mid:     spectrum.bands.mid     + spectrum.bands.highMid  * 0.6,

    // TREBLE = brillo + aire (sin cambio)
    // → 6kHz – 22kHz continuo
    treble:  spectrum.bands.treble  + spectrum.bands.ultraAir * 0.5,

    // Campos side: preservados para análisis downstream (BPMTracker, MoodSynth)
    lowMid:   spectrum.bands.lowMid,
    highMid:  spectrum.bands.highMid + spectrum.bands.treble * 0.3,
    subBass:  spectrum.bands.subBass,
    dominantFrequency: spectrum.dominantFrequency,
    spectralCentroid:  spectrum.spectral.centroid,
    harshness:         spectrum.bands.highMid,
    spectralFlatness:  spectrum.spectral.flatness,
  };
}
```

#### Justificación de los coeficientes

| Blend | Valor | Razonamiento |
|---|---|---|
| `lowMid → bass × 0.4` | 40% | `lowMid` 250-500Hz es el "cuerpo" del kick y el punch del bass synth. Pertenece al canal bass conceptualmente. No es 1.0 porque evitamos solapamiento excesivo con `mid`. |
| `highMid → mid × 0.6` | 60% | `highMid` 2-6kHz es la zona de presencia vocal y melodía de synth. Conceptualmente pertenece al canal mid. No es 1.0 porque el filtro LR4 ya tiene crossover suave con `treble`. |
| `ultraAir → treble × 0.5` | 50% | Sin cambio respecto al estado actual. |
| `treble → highMid side × 0.3` | 30% | Sin cambio en el campo side. |

#### Impacto en fixtures

| Fixture | Banda usada | Antes | Después |
|---|---|---|---|
| FrontPars | bass | ✅ kicks | ✅ kicks + punch synth |
| Movers | mid | ❌ 500-2k solo | ✅ 500-6kHz completo |
| Back | high | ✅ brillo | ✅ brillo (sin cambio) |

---

### PILAR 3 — AGC Refactor (Ventana y Respuesta al Transitorio)

#### Problema raíz

La ventana de 20 frames (`historyLength=20`) a 47fps = **~425ms de warm-up**. Un kick de electronic a 126 BPM tiene un intervalo de 476ms entre beats. El AGC aún está ajustando la ganancia cuando llega el siguiente kick.

Además, el mecanismo de attack/release basado en `attackMs`/`releaseMs` opera sobre la ganancia, pero el historial de RMS acumula 20 frames antes de que `targetGain` sea significativo.

#### Propuesta: Historia asimétrica por banda

```typescript
// PSEUDOCÓDIGO — configuración propuesta
const AGC_CONFIG_V2 = {
  //           attackMs  releaseMs  targetRMS  maxGain  historyLen
  subBass:   { attack: 80,  release: 30,  targetRMS: 0.4,  maxGain: 5.0, history: 8  },
  bass:      { attack: 60,  release: 30,  targetRMS: 0.45, maxGain: 5.0, history: 8  },
  lowMid:    { attack: 80,  release: 60,  targetRMS: 0.5,  maxGain: 4.0, history: 12 },
  mid:       { attack: 60,  release: 80,  targetRMS: 0.5,  maxGain: 4.0, history: 12 },
  highMid:   { attack: 50,  release: 100, targetRMS: 0.45, maxGain: 5.0, history: 15 },
  treble:    { attack: 30,  release: 120, targetRMS: 0.4,  maxGain: 5.0, history: 15 },
  ultraAir:  { attack: 25,  release: 150, targetRMS: 0.3,  maxGain: 6.0, history: 20 },
};
```

**Principios**:
- Bajos (sub/bass): historia corta (8 frames ≈ 170ms) para capturar kicks agresivos desde el primer compás
- Agudos (treble/ultraAir): historia larga (15-20 frames) porque los transitorios son más rápidos y el AGC necesita ser selectivo
- `maxGain` subido de 2.5 → 5.0 en graves para compensar la debilidad de VW sin HINL
- Los valores de `attackMs`/`releaseMs` se acortan en bajos para respuesta inmediata al transitorio

#### Estrategia alternativa: AGC bypass para BPMTracker

El `IntervalBPMTracker` ya recibe `rawSubBassEnergy` (pre-AGC). El AGC es para la señal que va a fixtures y visuales. Separar explícitamente las dos ramas:

```
GodEarAnalyzer.analyze(buffer)
    │
    ├─ bandsRaw (pre-AGC) → IntervalBPMTracker    ← PRESERVAR
    └─ bands (post-AGC)   → toLegacyFormat → fixtures ← REFACTORIZAR
```

Esta separación ya existe en el código (`spectrum.bandsRaw` vs `spectrum.bands`). Lo que falta es asegurar que el AGC no interfiere con los transitorios del BPM tracker.

---

## 3. SECUENCIA DE IMPLEMENTACIÓN PROPUESTA

```
FASE 1 (sin cambios en lógica, solo observación):
  ✅ WAVE 3418 — Telemetría PEAK-SAB vs PEAK-IPC activa
  → Confirmar ratio de señal real VW vs LegacyBridge
  → Confirmar que [🔬 BPM-TELEMETRY] muestra ratio < 1.6 con VW

FASE 2 (impacto mínimo, máximo beneficio):
  🔲 WAVE 3419 — Downmix refactor en toLegacyFormat()
  → Reconectar lowMid + highMid a bass/mid
  → Test: movers y back fixtures deben reaccionar a Brejcha synths
  → TypeScript clean, sin tocar AGC ni normalizer

FASE 3 (condicionada a telemetría de FASE 1):
  🔲 WAVE 3420 — InputNormalizer en SAB path
  → Implementar en VirtualWireProvider.onAudioData()
  → Llamar reset() en Amnesia Protocol
  → Test: PEAK-SAB debe acercarse a PEAK-IPC

FASE 4 (si FASE 3 no es suficiente):
  🔲 WAVE 3421 — AGC historia adaptativa
  → Subir maxGain en graves
  → Reducir historyLength a 8 frames para bass/subBass
  → Test: kicks de Anyma desde compás cero deben superar 0.30 en bass
```

---

## 4. RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Downmix refactor satura canal bass | Media | Los coeficientes (0.4, 0.6) son conservadores. Bass máximo teórico = 1.0+0.5+0.4 = 1.9 → clamp a 1.0 en processFrame |
| InputNormalizer distorsiona señal silenciosa | Media | `MIN_PEAK = 0.01` + `maxGain = 8.0` evitan explosión. El gain solo actúa si hay señal |
| AGC historia corta causa pumping | Baja | Separación AGC-BPMTracker ya existe. Pumping solo afecta visuales, no el BPM tracking |
| Reset del AdaptiveEnergyNormalizer pierde contexto | Baja | La ventana de 15s se recupera rápido. El efecto es que `energy` arranca bajo los primeros 2s tras cambio de fuente — aceptable |

---

## 5. CRITERIOS DE ACEPTACIÓN

Una vez implementadas las fases, la señal estará correcta cuando:

1. `[🔬 PEAK-SAB] peak` sea ≥ 0.20 con YouTube a volumen 100%
2. `[🔬 BPM-TELEMETRY] ratio` alcance ≥ 1.6 en al menos 30% de los frames durante un kick de bass
3. Los movers reaccionan visiblemente a la melodía de synth (highMid > 0.15 visible en UI)
4. `bass` en `lastAudioData` supera 0.50 en los kicks de Anyma
5. El BPM se bloquea en 120-126 BPM dentro de los primeros 8 kicks

---

*Blueprint generado por PunkOpus — WAVE 3418 — Pendiente de revisión por Dirección de Arquitectura Conjunta*
