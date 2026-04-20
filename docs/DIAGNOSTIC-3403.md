# DIAGNOSTIC-3403 — WAVE 3403.1: Post-Merge Investigation

**Fecha:** WAVE 3403.1  
**Estado:** RESUELTO — ambas anomalías diagnosticadas e implementadas  
**Commit base:** `2ae1ae29` (WAVE 3403 — UI & Sensory Polish)

---

## ANOMALÍA 1: Gauge Fantasma (Ring Buffer Indicator invisible)

### Hipótesis de Radwulf
> "Posible omisión en AudioSpectrumTitan.css (falta de width, height, posicionamiento o color de fondo), o el ref no se está adjuntando correctamente al nodo del DOM."

### Diagnóstico: PARCIALMENTE CORRECTA / CAUSA DIFERENTE

El JSX, los refs y el CSS del gauge son estructuralmente correctos. El `.audio-spectrum-titan__ring-gauge` (8x32px) existe en el DOM y el ref se adjunta. El RAF muta `style.height` en cada frame.

**La causa real:** `SharedRingBufferWriter.fillLevel = available / RING_SIZE`. En steady-state normal, el BETA Worker (senses.ts) consume todos los samples disponibles en cada poll cycle. El fill level resultante es **≈ 0-3%** incluso cuando el audio fluye perfectamente — porque el consumer es más rápido que el producer. `3% × 32px = ~1px`. El fill bar existe pero mide 0-1px: invisible a simple vista.

Adicionalmente, el color inicial del fill era `#22d3ee` pero `height: 0%` lo hacía invisible. No había fallback visual para el estado "ring buffer activo pero vacío".

### Fix implementado

**`AudioSpectrumTitan.css`** → `min-height: 3px` en `.audio-spectrum-titan__ring-fill` + color baseline `rgba(255,255,255,0.2)` para estado idle.

**`AudioSpectrumTitan.tsx` RAF** → Color del fill en 4 estados:
- `fill > 0.85` → `#ef4444` (rojo — overflow inminente, consumer muy lento)
- `fill > 0.6`  → `#fbbf24` (amarillo — backpressure moderado)
- `fill > 0.01` → `#22d3ee` (cyan — rango normal de actividad)
- `fill ≤ 0.01` → `rgba(255,255,255,0.2)` (blanco tenue — sin actividad / idle)

**Resultado:** El gauge es siempre visible (nunca fantasma). El color indica salud del pipeline, no solo fill level.

---

## ANOMALÍA 2: BPM 120 fallback + DMX congelado

### Hipótesis de Radwulf
> "El AGC del AudioMatrix está destruyendo el rango dinámico del VirtualWire, elevando el `rollingAverage` de forma que el umbral 1.6x del IntervalBPMTracker nunca se satisface."

### Diagnóstico: HIPÓTESIS REFUTADA

**No existe AGC en AudioMatrix ni en VirtualWireProvider.**

El `AutoGainProcessor` **solo existe en `USBDirectLinkProvider.ts`** (líneas 27, 50, 101). AudioMatrix implementa exclusivamente `crossfadeGain` (0.0–1.0) para transiciones de hot-swap — no altera el rango dinámico. VirtualWireProvider pasa el audio raw a `onAudioData()` sin ningún procesamiento.

El AGC en `senses.ts` (`getAGC()` de `./utils/AutomaticGainControl`) se aplica en Phase 1.5 (post-FFT) para la visualización UI. El `IntervalBPMTracker` consume la aguja `needle` derivada de `rawBassFlux` (valores `bandsRaw.*` pre-AGC). El AGC **nunca toca** la entrada del BPM tracker.

### Causa real: VirtualWireProvider en error → AudioMatrix bloquea todo el audio

```
Usuario clickea "VIRTUAL WIRE" en SystemsCheck
         │
         ▼
AudioMatrix.forceSource('virtual-wire')
   → forcedSource = 'virtual-wire'
   → provider.start() → VirtualWireProvider.start()
         │
         ▼
VirtualWireProvider requiere NativeAudioBridge (addon C++ nativo)
   → Addon NO compilado → require() falla → state: 'error'
         │
         ▼
AudioMatrix.ingestAudio() [ANTES del fix]:
   const accepted = source === this.forcedSource   // 'virtual-wire'
   // LegacyBridge envía source: 'legacy-bridge'
   // → accepted = false → DESCARTADO SIN LOG
         │
         ▼
SharedRingBuffer: cero escrituras
         │
         ▼
BETA Worker (senses.ts) → sabReader.available === 0 → nullret
         │
         ▼
Cero mensajes AUDIO_ANALYSIS a TitanOrchestrator
         │
         ▼
TitanOrchestrator usa lastKnownBpm = 120 (fallback inicial)
         │
         ▼
TitanEngine: cero beats → cero cambios DMX → Hyperion congelado
```

El Spectrum en la UI mostraba actividad porque `useAudioCapture` (Web Audio API + `getDisplayMedia`) sigue capturando y enviando IPC `lux:audio-buffer`. Pero esos datos son descartados silenciosamente por AudioMatrix — el renderer no ve el rechazo.

### Fix implementado

**`AudioMatrix.ts`** → `ingestAudio()` ahora evalúa si el `forcedSource` está en estado `error` o `disposed`. Si lo está, hace fallback a `activeSource` (el mejor provider disponible en la cadena de prioridad):

```typescript
// WAVE 3403.1: Si el forced source está en error, cae a activeSource
let effectiveSource: InputSourceType | null = this.forcedSource
if (this.forcedSource) {
  const forcedProvider = this.providers.get(this.forcedSource)
  if (
    !forcedProvider ||
    forcedProvider.status.state === 'error' ||
    forcedProvider.status.state === 'disposed'
  ) {
    effectiveSource = this.activeSource
  }
} else {
  effectiveSource = this.activeSource
}

if (source !== effectiveSource) return
```

**`AudioMatrix.ts`** → `forceSource()` ahora loguea un warning explícito cuando el provider objetivo está en error, en lugar de configurar el forced source silenciosamente y dejar que el audio muera:

```
[AudioMatrix] forceSource('virtual-wire'): provider is error.
Audio will fall back to active source until provider recovers.
```

**Comportamiento resultante:**
- Usuario fuerza 'virtual-wire' → VirtualWireProvider en error → AudioMatrix acepta audio de legacy-bridge → BETA Worker recibe datos → FFT → BPM → DMX
- La UI del SystemsCheck mostrará la fuente como 'virtual-wire' (intent del usuario registrado) pero el audio fluye desde legacy-bridge
- Cuando VirtualWireProvider esté disponible (addon compilado), el forcing funcionará como antes — no hay regresión

---

## AGC Architecture Clarification (definitiva)

| Componente | AGC | Notas |
|---|---|---|
| `AudioMatrix.ts` | ❌ NO | Solo `crossfadeGain` (0-1) para hot-swap |
| `VirtualWireProvider.ts` | ❌ NO | Audio raw → `onAudioData()` directo |
| `OSCNexusProvider.ts` | ❌ NO | PCM vía OSC → `onAudioData()` directo |
| `LegacyBridgeProvider.ts` | ❌ NO | IPC buffer → `onAudioData()` directo |
| `USBDirectLinkProvider.ts` | ✅ SÍ | `AutoGainProcessor` con `targetRMS` y `maxGain` |
| `senses.ts` (Phase 1.5) | ✅ SÍ | `getAGC()` post-FFT, solo para UI y harmony/rhythm |
| `IntervalBPMTracker` | ❌ NO toca AGC | Recibe `needle` = `rawBassFlux` pre-AGC |

La directiva de Radwulf "deshabilitar AGC para fuentes de audio interno y de red" es **arquitecturalmente el estado actual** — VirtualWire, OSCNexus y LegacyBridge ya operan sin AGC por diseño. No requiere código adicional.

---

## Files modificados

| Archivo | Cambio |
|---|---|
| `electron-app/src/core/audio/AudioMatrix.ts` | `ingestAudio()`: fallback a activeSource cuando forcedSource en error. `forceSource()`: warning explícito. |
| `electron-app/src/components/views/SensoryView/AudioSpectrumTitan.css` | `min-height: 3px` + `background: rgba(255,255,255,0.2)` baseline en ring fill |
| `electron-app/src/components/views/SensoryView/AudioSpectrumTitan.tsx` | RAF: 4-estado color coding del ring buffer fill |

---

## Tests impactados

Los tests existentes de `AudioMatrix.spec.ts` cubren el comportamiento de `forceSource`. El nuevo comportamiento (fallback cuando provider en error) requiere un nuevo test case en el describe `AudioMatrix -- forceSource override`. Ver WAVE 3403.1 test additions.
