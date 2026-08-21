Ahora veo dónde `oracleBpm` se asigna a `detectedBpm` (línea 1278-1317 mencionada en el grep):

Ahora veo dónde `oracleBpm` se propaga al `detectedBpm` final del `LuxAnalysisV3` (línea 1752 mencionada en el grep inicial):

Ahora veo dónde `beatGrid.bpm` (que es el `oracleBpm` propagado) se mapea a `LuxAnalysisV3.detectedBpm` en el store:

Tengo toda la cadena. Reportando los bloques de código solicitados, sin análisis ni fix.

---

## EXTRACCIÓN: Reducción escalar offline (WAVE 7564.4)

### Bloque 1 — Acumulación en el loop principal
`electron-app/src/chronos/analysis/analysisPipeline.ts` líneas 335-412:

```ts
  const odfRateHz = 1000 / config.heatmapResolutionMs
  const oracle = new TempoOracle(odfRateHz)
  // Pre-allocated collection buffers — zero per-frame allocation.
  // Sized to numPoints (worst case: every frame clears the gate).
  const bpmSamples = new Float64Array(numPoints)
  const confSamples = new Float64Array(numPoints)
  let sampleCount = 0

  // 🌊 WAVE 7563: TEMPO CURVE collection buffer.
  //
  // NOTE the difference from `bpmSamples` above: that array is PACKED — only
  // confident frames land in it, contiguously, so `bpmSamples[k]` has no
  // relationship to frame k. It exists purely to be reduced to a scalar.
  //
  // `tempoRaw` is SPARSE-BY-INDEX: `tempoRaw[i]` is the Oracle's reading at
  // frame i, or 0 if that frame failed the confidence gate. Preserving the
  // time axis is the whole point — a tempo curve that is not co-indexable
  // with the heatmap is useless to Hephaestus.
  const tempoRaw = new Float64Array(numPoints)

  for (let i = 0; i < numPoints; i++) {
    const start = i * resolutionSamples
    const end = Math.min(start + actualFftSize, samples.length)

    // Reuse pre-allocated window buffer — zero out then copy new samples
    const copyLength = Math.min(actualFftSize, end - start)
    windowBuffer.fill(0, copyLength)
    windowBuffer.set(samples.subarray(start, start + copyLength))

    // 🩻 Run REAL FFT analysis through GodEarAnalyzer
    const spectrum = analyzer.analyze(windowBuffer)

    // Extract 7 tactical bands (already LR4-equivalent masked, zero overlap)
    subBassArr[i] = spectrum.bands.subBass
    bassRealArr[i] = spectrum.bands.bass
    lowMidArr[i] = spectrum.bands.lowMid
    midArr[i] = spectrum.bands.mid
    highMidArr[i] = spectrum.bands.highMid
    trebleArr[i] = spectrum.bands.treble
    ultraAirArr[i] = spectrum.bands.ultraAir

    // Spectral metrics
    centroidArr[i] = spectrum.spectral.centroid
    flatnessArr[i] = spectrum.spectral.flatness

    // 🩻 GODEAR UNLEASHED Phase 3: Semantic enrichment telemetry
    // photon block is optional (undefined on V2 fallback) — guard with ?.
    saturationArr[i] = spectrum.photon?.saturation ?? 0
    whiteNoiseArr[i] = spectrum.photon?.whiteNoiseScore ?? 0
    rhythmicVoidArr[i] = spectrum.rhythmic?.rhythmic_void ?? 0
    rolloffArr[i] = spectrum.spectral.rolloff

    // 🩻 GODEAR UNLEASHED Phase 2: 3-band transient event collection
    // GodEar's SlopeBasedOnsetDetector already applies 80ms refractory
    // internally, so consecutive frames won't double-fire. We apply an
    // additional heatmap-resolution-aware debounce for safety.
    const frameTimeMs = i * config.heatmapResolutionMs

    // 🔮 CHRONOS PURE MEDIAN ANALYSER: Feed TempoOracle with the per-frame
    // ODF needle (subBass + bassReal = 20-250 Hz onset detection function
    // proxy). The Oracle runs NSDF autocorrelation + harmonic ladder +
    // sub-frame parabolic interpolation internally, zero allocation.
    // Deterministic timestamp = offline clock.
    oracle.process(
      spectrum.bands.subBass + spectrum.bands.bass,
      frameTimeMs,
    )

    // Accumulate BPM only when the Oracle's confidence exceeds CONF_FLOOR.
    // This rejects intro/outro silence and low-periodicity noise frames
    // from the statistical reduction at track end.
    if (oracle.confidence > CONF_FLOOR && oracle.bpm > 0) {
      bpmSamples[sampleCount] = oracle.bpm
      confSamples[sampleCount] = oracle.confidence
      sampleCount++
      // 🌊 WAVE 7563: same reading, stored against the TIME axis this time.
      tempoRaw[i] = oracle.bpm
    }
```
<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\analysis\analysisPipeline.ts" lines="335-412" />

### Bloque 2 — Llamada al reductor y asignación a `oracleBpm`
`analysisPipeline.ts` líneas 560-582:

```ts
  const { bpm: oracleBpm, confidence: oracleConfidence } =
    computeConfidenceWeightedMedian(bpmSamples, confSamples, sampleCount)

  // ═══════════════════════════════════════════════════════════════════════
  // 🌊 WAVE 7563: TEMPO CURVE — gap-fill + median-smooth the per-frame track
  // ═══════════════════════════════════════════════════════════════════════
  // The scalar above answers "what tempo is this track?". The curve answers
  // "what tempo is this track RIGHT HERE?" — which is the question a beat
  // tracker, a ritardando, and a DJ pitch-ride all actually ask.
  const tempoCurve = buildTempoCurve(
    tempoRaw,
    numPoints,
    oracleBpm > 0 ? oracleBpm : TEMPO_FALLBACK_BPM,
  )

  return {
    heatmap,
    transientEvents,
    transients: transientsLegacy,
    oracleBpm,
    oracleConfidence,
    tempoCurve,
  }
```
<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\analysis\analysisPipeline.ts" lines="560-582" />

### Bloque 3 — `computeConfidenceWeightedMedian` (función completa)
`analysisPipeline.ts` líneas 707-756:

```ts
function computeConfidenceWeightedMedian(
  bpmSamples: Float64Array,
  confSamples: Float64Array,
  count: number,
): { bpm: number; confidence: number } {
  if (count === 0) {
    return { bpm: 0, confidence: 0 }
  }

  // Collect valid (bpm, conf) pairs into a sortable array.
  // This allocation happens ONCE at track end — not in the hot loop.
  const pairs: Array<{ bpm: number; conf: number }> = new Array(count)
  let totalConf = 0
  for (let i = 0; i < count; i++) {
    const bpm = bpmSamples[i]
    const conf = confSamples[i]
    pairs[i] = { bpm, conf }
    totalConf += conf
  }

  if (totalConf <= 0) {
    // All-zero confidence edge case: unweighted median.
    pairs.sort((a, b) => a.bpm - b.bpm)
    const mid = count >> 1
    const medianBpm = count % 2 === 0
      ? (pairs[mid - 1].bpm + pairs[mid].bpm) / 2
      : pairs[mid].bpm
    return { bpm: medianBpm, confidence: 0 }
  }

  // Sort by BPM ascending — enables the weighted-median walk.
  pairs.sort((a, b) => a.bpm - b.bpm)

  // Walk until cumulative confidence crosses 50% of total.
  const halfConf = totalConf / 2
  let cumConf = 0
  let weightedMedianBpm = pairs[0].bpm
  for (let i = 0; i < count; i++) {
    cumConf += pairs[i].conf
    if (cumConf >= halfConf) {
      weightedMedianBpm = pairs[i].bpm
      break
    }
  }

  // Aggregate confidence = mean of collected confidences.
  const aggregateConfidence = totalConf / count

  return { bpm: weightedMedianBpm, confidence: aggregateConfidence }
}
```
<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\analysis\analysisPipeline.ts" lines="707-756" />

### Bloque 4 — Propagación `oracleBpm` → `beatGrid.bpm` → `detectedBpm`

**4a.** `oracleBpm` entra en `detectBeats` y se asigna al campo `bpm` del `BeatGridData` retornado. `analysisPipeline.ts` líneas 1281-1318:

```ts
export function detectBeats(
  samples: Float32Array,
  sampleRate: number,
  heatmap: HeatmapData,
  config: OfflineAnalysisConfig,
  /** Definitive scalar BPM from the TempoOracle confidence-weighted median. */
  oracleBpm: number,
  /** Aggregate confidence of the oracle BPM (0-1). */
  oracleConfidence: number,
  /** 🌊 WAVE 7563: per-frame tempo curve driving the DP target period. */
  tempoCurve: number[],
): BeatGridData {
  // ... onsets legacy ...

  // 🔮 The oracleBpm remains the definitive scalar. Fall back to the
  // deprecated histogram only when the Oracle produced zero confident frames.
  const bpm = oracleBpm > 0 ? oracleBpm : estimateBpm(onsets)
  const msPerBeat = 60000 / bpm
```
<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\analysis\analysisPipeline.ts" lines="1281-1318" />

**4b.** `detectBeats` es invocado con `heatmapResult.oracleBpm` desde el pipeline principal. `analysisPipeline.ts` líneas 1750-1754:

```ts
  const beatGrid = detectBeats(
    monoSamples, sampleRate, energyHeatmap, config,
    heatmapResult.oracleBpm, heatmapResult.oracleConfidence,
    heatmapResult.tempoCurve,
  )
```
<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\analysis\analysisPipeline.ts" lines="1750-1754" />

**4c.** `beatGrid.bpm` se asigna a `LuxAnalysisV3.detectedBpm` en `LuxFileV3.factories.ts` línea 496:

```ts
  const analysis: LuxAnalysisV3 = {
    detectedBpm: data.beatGrid.bpm,
    bpmConfidence: data.beatGrid.confidence,
    firstBeatMs: data.beatGrid.firstBeatMs,
    beatGrid: data.beatGrid.beats ?? [],
    sections,
    transients,
    heatmap,
    waveform,
  }
```
<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\core\LuxFileV3.factories.ts" lines="495-504" />

**4d.** Y finalmente `lux.detectedBpm` se escribe en `project.audio.detectedBpm` (el campo que lee el UI) en `ChronosStore.ts` líneas 364-371:

```ts
  setAnalysisData(analysisData: AnalysisData): void {
    const lux = analysisDataToLuxAnalysisV3(analysisData)
    this.project.analysis = lux

    if (this.project.audio) {
      this.project.audio.detectedBpm = lux.detectedBpm
      this.project.audio.bpmConfidence = lux.bpmConfidence
    }
```
<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\core\ChronosStore.ts" lines="364-371" />

---

Cadena completa de la reducción extraída. Sin fix, sin análisis matemático, según la directiva. Listo para auditoría del Architect.