CHRONOS × TEMPO ORACLE — ARCHITECTURE INSPECTION REPORT
1. How Chronos currently sets its tempo
Chronos uses a three-tier BPM resolution documented at [LuxFileV3.ts:22-25](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/core/LuxFileV3.ts:21:0-24:999):

audio.detectedBpm — base BPM detected by the offline GodEar FFT worker, persisted into the .lux file ([LuxFileV3.ts:207-211](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/core/LuxFileV3.ts:206:0-210:999)).
runtimeBpm — ephemeral runtime field, normally the live rBPM from the Senses Worker ([LuxFileV3.ts:466-470](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/core/LuxFileV3.ts:465:0-469:999)).
manualBpmOverride — operator override, wins when present (runtime only, not serialized).
The single read site in the engine hot path is [ChronosEngine.ts:1053-1055](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/core/ChronosEngine.ts:1052:0-1054:999):



ts
const bpm = this.project?.runtimeBpm ?? this.project?.audio?.detectedBpm ?? 120
this.clockSources.tickMIDIMaster(bpm)
This runs every frame inside updateTime() and is what drives the outbound MIDI Clock Master. There is no beat-grid construction inside ChronosEngine — the engine only consumes a scalar BPM. The actual beat grid (the beats[] / downbeats[] arrays) is built offline, in the analysis pipeline, and embedded into project.analysis.beatGrid.

2. Where the offline BPM is actually computed (the real target)
The mission brief assumes bpmDerivation.ts is the offline path. It is not. bpmDerivation.ts is the live MIDI-Clock slave sliding-window estimator (PPQ pulse intervals) — unrelated to file analysis.

The true offline BPM path is:

Entry: analyzeAudioFile() in [GodEarOffline.ts](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/analysis/GodEarOffline.ts:0:0-0:0) (Worker-first, main-thread fallback).
Orchestration: runAnalysisPipeline() in [analysisPipeline.ts:982-1037](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/analysis/analysisPipeline.ts:981:0-1036:999).
BPM source today: IntervalBPMTracker (imported from workers/IntervalBPMTracker), instantiated and fed per FFT frame inside extractEnergyHeatmap() at [analysisPipeline.ts:257-311](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/analysis/analysisPipeline.ts:256:0-310:999). It is fed subBass + bassReal (20–250 Hz) with a deterministic frameTimeMs as the offline clock.
BPM consumption: detectBeats() at [analysisPipeline.ts:535-644](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/analysis/analysisPipeline.ts:534:0-643:999) picks musicalBpm ?? bpmTrackerResult.bpm (lines 577-580), falling back to the deprecated estimateBpm() histogram only when the tracker never stabilized. It then builds the beats[] grid from msPerBeat = 60000 / bpm and aligns firstBeatMs to the onset set.
3. TempoOracle standalone feasibility
TempoOracle ([TempoOracle.ts](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/senses/bpm/TempoOracle.ts:0:0-0:0)) is fully instantiable standalone for offline use:

Constructor new TempoOracle(odfRateHz?) allocates all buffers once (zero-GC hot path). Passing an explicit odfRateHz skips calibration.
Public API is exactly what offline needs: process(needle, deterministicTsMs) per ODF frame, then read oracle.bpm / oracle.confidence / oracle.lagFrames.
It is a pure frequency estimator — it consumes an ODF needle, not raw audio. The blueprint comment is explicit: "Oracle owns frequency, gate owns phase."
Critical constraint: it does not replace IntervalBPMTracker's octave folding. TempoOracle's BPM_MIN/MAX band is 60–200 BPM with an MPM shortest-peak octave resolver, but the dance-pocket folding (dotted 4:3, tresillo 3:2, double/triple/quad) currently lives in IntervalBPMTracker.getMusicalBpm(). If we swap the estimator, the musical-BPM folding must either be retained from the tracker or reimplemented on top of oracle.bpm.
The needle it expects is the GatedNeedlePipeline output (≥0 onset detection function). In the offline pipeline we already produce spectrum.bands.subBass + spectrum.bands.bass per frame — that is a usable ODF proxy, but the Oracle was tuned against the gated needle, not raw band energy. Feeding raw bass energy will likely need either (a) a lightweight onset-needle derivation in the offline loop, or (b) re-calibration of CONF_FLOOR/CONF_CEIL (the file's own warning at lines 204-216).

4. The manual BPM input field — live wire, not dead
The manual BPM input is fully wired and live:

UI: <input className="ct-bpm-input"> in [TransportBar.tsx:598-611](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/ui/transport/TransportBar.tsx:597:0-610:999), with onBpmChange clamped to [20, 300].
State owner: const [bpm, setBpm] = useState(120) in [ChronosLayout.tsx:156-158](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/ui/ChronosLayout.tsx:155:0-157:999).
It is passed down at [ChronosLayout.tsx:1314-1318](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/ui/ChronosLayout.tsx:1313:0-1317:999) (bpm={bpm} onBpmChange={setBpm}).
It is seeded from analysis at [ChronosLayout.tsx:209-214](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/ui/ChronosLayout.tsx:208:0-213:999): setBpm(Math.round(audioLoader.result.analysisData.beatGrid.bpm)).
It is propagated globally to useAudioStore at [ChronosLayout.tsx:221-225](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/ui/ChronosLayout.tsx:220:0-224:999) so Hephaestus sees it.
Gap to note: this bpm state in ChronosLayout is a local UI echo. It is not written back to project.audio.detectedBpm or project.runtimeBpm — the engine reads those project fields directly (ChronosEngine.ts:1054), not the React state. So the manual input currently influences useTimelineClips (snap/quantize grid) and the global audioStore, but it does not flow into ChronosEngine.tickMIDIMaster unless something else writes runtimeBpm. That is a latent wire-break worth flagging, but it is out of scope for the offline-analysis injection.

5. Exact injection point for the offline pre-analysis hook
Primary injection site: extractEnergyHeatmap() in analysisPipeline.ts, lines 257–311.

This is where IntervalBPMTracker is instantiated and fed per frame. The minimal-surface integration is:

Instantiate new TempoOracle(1000 / config.heatmapResolutionMs) alongside the existing bpmTracker (the ODF rate is known deterministically here — no calibration needed).
Inside the per-frame loop (around line 307), call oracle.process(needle, frameTimeMs) where needle is derived from the same frame. The cleanest needle source is spectrum.bands.subBass + spectrum.bands.bass (already computed), ideally half-wave rectified and possibly smoothed to match the Oracle's expected ODF character.
After the loop, read oracle.bpm / oracle.confidence and thread them into the return object at [analysisPipeline.ts:450-462](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/analysis/analysisPipeline.ts:449:0-461:999) as a new field (e.g. oracleResult), parallel to bpmTrackerResult / musicalBpm.
In detectBeats() (lines 577-580), add the Oracle as a preferred source in the resolution chain — e.g. oracle.bpm (when oracle.confidence clears a threshold) → musicalBpm → bpmTrackerResult.bpm → estimateBpm(onsets). This preserves the existing fallback ladder.
Secondary (optional) injection site: runAnalysisPipeline() at [analysisPipeline.ts:1003-1012](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/analysis/analysisPipeline.ts:1002:0-1011:999) — if the Oracle is run as a separate pass rather than inline in the heatmap loop, it would be instantiated here and fed the heatmap's bass-band arrays post-hoc. This is cleaner separation but loses the single-pass zero-allocation benefit.

No changes needed in: ChronosEngine.ts (it already reads detectedBpm/runtimeBpm generically), ChronosStore.setAnalysisData() (it already maps analysis.detectedBpm → audio.detectedBpm at [ChronosStore.ts:364-374](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/core/ChronosStore.ts:363:0-373:999)), or the UI seeding path. The Oracle's output flows through the existing beatGrid.bpm → analysisData.beatGrid.bpm → setBpm() → detectedBpm channel automatically once detectBeats returns it.

6. Open risks to flag before mutating
Octave folding ownership: TempoOracle's MPM rule resolves octave ties but does not perform the musical dance-pocket folding that IntervalBPMTracker.getMusicalBpm() does. A straight swap risks regressing tresillo/dotted tracks. Recommend keeping IntervalBPMTracker as the octave folder and using the Oracle as the period estimator that feeds it, or porting the folding logic.
Needle character mismatch: the Oracle was tuned on the gated needle, not raw subBass+bass. The two empirical constants CONF_FLOOR/CONF_CEIL (TempoOracle.ts:215-216) are explicitly flagged as needing re-fitting per blueprint §9 before sign-off.
odfRateHz contract: the offline ODF rate is 1000 / config.heatmapResolutionMs (deterministic). Pass it to the constructor to skip the 48-frame calibration window and freeze the lag band immediately.
Worker boundary: godear-offline.worker.ts runs the pipeline off the main thread. TempoOracle is allocation-free and worker-safe (no DOM/AudioContext deps), so it can be imported directly into the worker — no main-thread bridge needed.
No code was modified. Ready for the integration plan on your go-ahead.