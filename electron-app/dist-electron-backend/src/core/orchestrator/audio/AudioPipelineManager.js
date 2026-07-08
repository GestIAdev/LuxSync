/**
 * WAVE 4963 PHASE 7: AUDIO PIPELINE MANAGER
 *
 * Encapsula toda la ingestion de audio, staleness detection, beat detection,
 * y metricas FFT. Extraido de TitanOrchestrator.ts processFrame + processAudioFrame
 * + processAudioBuffer + brain.on('audio-levels').
 *
 * @module AudioPipelineManager
 */
import { BeatDetector } from '../../../engine/audio/BeatDetector';
import { SyncSmoother } from '../metrics/SyncSmoother';
// ---------------------------------------------------------------------------
// AudioPipelineManager
// ---------------------------------------------------------------------------
export class AudioPipelineManager {
    constructor(ctx) {
        // ---- Audio State (encapsulated) ----
        this.lastAudioData = {
            bass: 0, mid: 0, high: 0, energy: 0
        };
        this.hasRealAudio = false;
        this.lastAudioTimestamp = 0;
        this.AUDIO_STALENESS_THRESHOLD_MS = 500;
        // ---- Beat Detection ----
        this.beatDetector = null;
        this.syncSmoother = new SyncSmoother();
        // ---- Freewheel Memory ----
        this.lastStableWorkerBpm = 0;
        this.lastStableWorkerBpmFrame = 0;
        this.FREEWHEEL_TIMEOUT_FRAMES = 125; // ~5s a 25fps
        // 🔧 WAVE 7002.4 (T2): Track last BPM passed to setBpm() to avoid redundant calls
        this.lastSetBpm = 0;
        // ---- Diagnostics ----
        this.hasLoggedFirstAudio = false;
        this.audioBufferRejectCount = 0;
        this._audioSondaCount = 0;
        this._audioSondaTotal = 0;
        this.ctx = ctx;
    }
    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------
    /**
     * Initialize beat detector (called from orchestrator init).
     */
    initBeatDetector() {
        this.beatDetector = new BeatDetector({
            sampleRate: 44100,
            fftSize: 2048,
            smoothingTimeConstant: 0.8,
            minBpm: 60,
            maxBpm: 200,
        });
    }
    /**
     * Wire the brain.on('audio-levels') handler.
     * Must be called after brain is created and connected to trinity.
     */
    wireAudioLevelsHandler() {
        const brain = this.ctx.brain;
        if (!brain)
            return;
        brain.on('audio-levels', (levels) => {
            const matrixStatus = this.ctx.trinity?.getAudioMatrix()?.getStatus();
            const activeSource = matrixStatus?.activeSource ?? null;
            const OMNI_SOURCES = new Set(['virtual-wire', 'usb-directlink', 'osc-nexus']);
            const isOmniActive = activeSource ? OMNI_SOURCES.has(activeSource) : false;
            if (isOmniActive) {
                const smoothedOmni = this.syncSmoother.smooth({
                    bass: levels.bass, mid: levels.mid, high: levels.treble,
                    energy: levels.energy,
                    harshness: levels.harshness, spectralFlatness: levels.spectralFlatness,
                    spectralCentroid: levels.spectralCentroid, subBass: levels.subBass,
                    lowMid: levels.lowMid, highMid: levels.highMid, crestFactor: levels.crestFactor,
                }, true /* omniPath */);
                this.lastAudioData = {
                    ...this.lastAudioData,
                    bass: smoothedOmni.bass,
                    mid: smoothedOmni.mid,
                    high: smoothedOmni.high,
                    energy: smoothedOmni.energy,
                    subBass: levels.subBass ?? this.lastAudioData.subBass,
                    lowMid: levels.lowMid ?? this.lastAudioData.lowMid,
                    highMid: levels.highMid ?? this.lastAudioData.highMid,
                    harshness: levels.harshness ?? this.lastAudioData.harshness,
                    spectralFlatness: levels.spectralFlatness ?? this.lastAudioData.spectralFlatness,
                    spectralCentroid: levels.spectralCentroid ?? this.lastAudioData.spectralCentroid,
                    crestFactor: levels.crestFactor ?? this.lastAudioData.crestFactor,
                    kickDetected: levels.kickDetected ?? this.lastAudioData.kickDetected,
                    snareDetected: levels.snareDetected ?? this.lastAudioData.snareDetected,
                    hihatDetected: levels.hihatDetected ?? this.lastAudioData.hihatDetected,
                    rawBassEnergy: levels.rawBassEnergy ?? this.lastAudioData.rawBassEnergy,
                    workerBpm: (levels.bpm != null && levels.bpm > 0) ? levels.bpm : this.lastAudioData.workerBpm,
                    workerBpmConfidence: (levels.bpmConfidence != null && levels.bpmConfidence > 0) ? levels.bpmConfidence : this.lastAudioData.workerBpmConfidence,
                    workerOnBeat: levels.onBeat ?? this.lastAudioData.workerOnBeat,
                    workerBeatPhase: levels.beatPhase ?? this.lastAudioData.workerBeatPhase,
                    workerBeatStrength: levels.beatStrength ?? this.lastAudioData.workerBeatStrength,
                    workerKickCount: (levels.kickCount != null && levels.kickCount > 0) ? levels.kickCount : this.lastAudioData.workerKickCount,
                    inputPeakAbs: levels.inputPeakAbs ?? this.lastAudioData.inputPeakAbs,
                    inputRMS: levels.inputRMS ?? this.lastAudioData.inputRMS,
                    rawTreble: levels.rawTreble ?? this.lastAudioData.rawTreble,
                    ultraAir: levels.ultraAir ?? this.lastAudioData.ultraAir,
                };
                const wasActive = this.hasRealAudio;
                this.hasRealAudio = true;
                this.lastAudioTimestamp = Date.now();
                if (!wasActive && !this.hasLoggedFirstAudio) {
                    this.hasLoggedFirstAudio = true;
                    this.ctx.log('System', `WAVE 3416: Audio LIVE via ${activeSource} — Selene is now listening!`);
                }
                else if (!wasActive) {
                    this.ctx.log('System', `Audio restored via ${activeSource}`);
                }
            }
            else {
                this.lastAudioData = {
                    ...this.lastAudioData,
                    subBass: levels.subBass ?? this.lastAudioData.subBass,
                    lowMid: levels.lowMid ?? this.lastAudioData.lowMid,
                    highMid: levels.highMid ?? this.lastAudioData.highMid,
                    harshness: levels.harshness ?? this.lastAudioData.harshness,
                    spectralFlatness: levels.spectralFlatness ?? this.lastAudioData.spectralFlatness,
                    spectralCentroid: levels.spectralCentroid ?? this.lastAudioData.spectralCentroid,
                    crestFactor: levels.crestFactor ?? this.lastAudioData.crestFactor,
                    kickDetected: levels.kickDetected ?? this.lastAudioData.kickDetected,
                    snareDetected: levels.snareDetected ?? this.lastAudioData.snareDetected,
                    hihatDetected: levels.hihatDetected ?? this.lastAudioData.hihatDetected,
                    rawBassEnergy: levels.rawBassEnergy ?? this.lastAudioData.rawBassEnergy,
                    workerBpm: (levels.bpm != null && levels.bpm > 0) ? levels.bpm : this.lastAudioData.workerBpm,
                    workerBpmConfidence: (levels.bpmConfidence != null && levels.bpmConfidence > 0) ? levels.bpmConfidence : this.lastAudioData.workerBpmConfidence,
                    workerOnBeat: levels.onBeat ?? this.lastAudioData.workerOnBeat,
                    workerBeatPhase: levels.beatPhase ?? this.lastAudioData.workerBeatPhase,
                    workerBeatStrength: levels.beatStrength ?? this.lastAudioData.workerBeatStrength,
                    workerKickCount: (levels.kickCount != null && levels.kickCount > 0)
                        ? levels.kickCount
                        : this.lastAudioData.workerKickCount,
                    inputPeakAbs: levels.inputPeakAbs ?? this.lastAudioData.inputPeakAbs,
                    inputRMS: levels.inputRMS ?? this.lastAudioData.inputRMS,
                    rawTreble: levels.rawTreble ?? this.lastAudioData.rawTreble,
                    ultraAir: levels.ultraAir ?? this.lastAudioData.ultraAir,
                };
            }
        });
    }
    /**
     * Process incoming audio frame from frontend (IPC path, 30fps).
     */
    processAudioFrame(data) {
        if (!this.ctx.brain)
            return;
        const bass = typeof data.bass === 'number' ? data.bass : this.lastAudioData.bass;
        const mid = typeof data.mid === 'number' ? data.mid : this.lastAudioData.mid;
        const high = typeof data.treble === 'number' ? data.treble :
            typeof data.high === 'number' ? data.high : this.lastAudioData.high;
        const energy = typeof data.energy === 'number' ? data.energy : this.lastAudioData.energy;
        this.lastAudioData = {
            bass,
            mid,
            high,
            energy,
            harshness: this.lastAudioData.harshness,
            spectralFlatness: this.lastAudioData.spectralFlatness,
            spectralCentroid: this.lastAudioData.spectralCentroid,
            subBass: this.lastAudioData.subBass,
            lowMid: this.lastAudioData.lowMid,
            highMid: this.lastAudioData.highMid,
            kickDetected: this.lastAudioData.kickDetected,
            snareDetected: this.lastAudioData.snareDetected,
            hihatDetected: this.lastAudioData.hihatDetected,
            rawBassEnergy: this.lastAudioData.rawBassEnergy,
            crestFactor: this.lastAudioData.crestFactor,
            workerBpm: this.lastAudioData.workerBpm,
            workerBpmConfidence: this.lastAudioData.workerBpmConfidence,
            workerOnBeat: this.lastAudioData.workerOnBeat,
            workerBeatPhase: this.lastAudioData.workerBeatPhase,
            workerBeatStrength: this.lastAudioData.workerBeatStrength,
            workerKickCount: this.lastAudioData.workerKickCount,
        };
        const wasAudioActive = this.hasRealAudio;
        this.hasRealAudio = energy > 0.01;
        if (this.hasRealAudio && !this.hasLoggedFirstAudio) {
            this.hasLoggedFirstAudio = true;
            this.ctx.log('System', 'AUDIO DETECTED - Selene is now listening!');
        }
        else if (!this.hasRealAudio && wasAudioActive) {
            this.ctx.log('System', 'AUDIO LOST - Waiting for signal...');
        }
        this.lastAudioTimestamp = Date.now();
    }
    /**
     * Process raw audio buffer from frontend (Worker path).
     */
    processAudioBuffer(buffer) {
        const _audioStart = performance.now();
        if (!this.ctx.brain) {
            this.audioBufferRejectCount++;
            if (this.audioBufferRejectCount % 60 === 1) {
                console.warn(`[AudioPipeline] audioBuffer REJECTED #${this.audioBufferRejectCount}`);
            }
            return;
        }
        this.lastAudioTimestamp = Date.now();
        if (this.ctx.trinity) {
            const _matrix = this.ctx.trinity.getAudioMatrix();
            if (_matrix) {
                const _matrixStatus = _matrix.getStatus();
                if (_matrixStatus.activeSource && _matrixStatus.activeSource !== 'legacy-bridge') {
                    return;
                }
            }
        }
        if (this.ctx.trinity) {
            this.ctx.trinity.feedAudioBuffer(buffer);
        }
        else {
            console.warn('[AudioPipeline] trinity is null! Buffer discarded.');
        }
        const _audioCostMs = performance.now() - _audioStart;
        this._audioSondaCount++;
        this._audioSondaTotal += _audioCostMs;
        if (this._audioSondaCount % 40 === 0) {
            const _avg = (this._audioSondaTotal / 40).toFixed(3);
            console.warn(`[SONDA AUDIO] avg:${_avg}ms last:${_audioCostMs.toFixed(3)}ms`);
            this.ctx.log('Error', `[SONDA AUDIO] avg:${_avg}ms last:${_audioCostMs.toFixed(3)}ms`);
            this._audioSondaCount = 0;
            this._audioSondaTotal = 0;
        }
    }
    /**
     * Check audio staleness and reset if stale.
     * Called at the beginning of each processFrame tick.
     * Returns true if audio was just marked stale this frame.
     */
    checkStaleness(frameCount, shouldLog) {
        const now = Date.now();
        const matrixStatusForStaleness = this.ctx.trinity?.getAudioMatrix()?.getStatus();
        const activeSourceForStaleness = matrixStatusForStaleness?.activeSource ?? null;
        const OMNI_SOURCES_STALENESS = new Set(['virtual-wire', 'usb-directlink', 'osc-nexus']);
        const isOmniForStaleness = activeSourceForStaleness ? OMNI_SOURCES_STALENESS.has(activeSourceForStaleness) : false;
        const effectiveStalenessThreshold = isOmniForStaleness ? 2000 : this.AUDIO_STALENESS_THRESHOLD_MS;
        if (this.hasRealAudio && (now - this.lastAudioTimestamp) > effectiveStalenessThreshold) {
            if (shouldLog) {
                console.warn(`[AudioPipeline] AUDIO STALE - no data for ${now - this.lastAudioTimestamp}ms, switching to silence`);
            }
            this.hasRealAudio = false;
            this.lastAudioData = {
                bass: 0, mid: 0, high: 0, energy: 0,
                harshness: undefined, spectralFlatness: undefined, spectralCentroid: undefined,
                subBass: undefined, lowMid: undefined, highMid: undefined,
                kickDetected: undefined, snareDetected: undefined, hihatDetected: undefined,
                rawBassEnergy: undefined,
                workerBpm: this.lastAudioData.workerBpm,
                workerBpmConfidence: this.lastAudioData.workerBpmConfidence,
                workerOnBeat: false,
                workerBeatPhase: this.lastAudioData.workerBeatPhase,
                workerBeatStrength: 0,
                workerKickCount: this.lastAudioData.workerKickCount,
            };
            return true;
        }
        return false;
    }
    /**
     * Tick the beat detector and return beat state.
     * Encapsulates Worker BPM + PLL + Freewheel logic.
     */
    tickBeatDetector(now, frameCount) {
        let beatState = {
            bpm: 120,
            phase: 0,
            beatCount: 0,
            onBeat: false,
            confidence: 0,
            kickDetected: false,
            snareDetected: false,
            hihatDetected: false,
            pllPhase: 0,
            pllOnBeat: false,
            predictedNextBeatTime: 0,
            phaseError: 0,
            pllLocked: false,
        };
        const workerBpm = this.lastAudioData.workerBpm ?? 0;
        const workerConfidence = this.lastAudioData.workerBpmConfidence ?? 0;
        const workerOnBeat = this.lastAudioData.workerOnBeat ?? false;
        if (this.beatDetector && this.hasRealAudio) {
            if (workerBpm > 0 && workerConfidence > 0.2) {
                // 🔧 WAVE 7002.4 (T2): Only call setBpm() when BPM actually changes
                if (this.lastSetBpm !== workerBpm) {
                    this.beatDetector.setBpm(workerBpm);
                    this.lastSetBpm = workerBpm;
                }
                this.lastStableWorkerBpm = workerBpm;
                this.lastStableWorkerBpmFrame = frameCount;
            }
            else {
                const framesSinceStable = frameCount - this.lastStableWorkerBpmFrame;
                if (this.lastStableWorkerBpm > 0 && framesSinceStable <= this.FREEWHEEL_TIMEOUT_FRAMES) {
                    this.beatDetector.freewheelAt(this.lastStableWorkerBpm);
                }
            }
            beatState = this.beatDetector.tick(now);
            if (workerOnBeat) {
                beatState.onBeat = true;
                beatState.kickDetected = true;
            }
            if (frameCount % 60 === 0) {
                const pllInfo = beatState.pllLocked ? 'LOCKED' : 'FREEWHEEL';
                const syncInfo = this.syncSmoother.currentSyncopation.toFixed(2);
                const _framesSinceLog = frameCount - this.lastStableWorkerBpmFrame;
                const freewheelTag = (!beatState.pllLocked && this.lastStableWorkerBpm > 0 && _framesSinceLog <= this.FREEWHEEL_TIMEOUT_FRAMES)
                    ? ` [mem=${this.lastStableWorkerBpm.toFixed(0)}@-${_framesSinceLog}f]`
                    : '';
                const rawEnergy = (this.lastAudioData.rawBassEnergy ?? 0).toFixed(4);
                const sabFill = this.ctx.trinity?.getAudioMatrix()?.getStatus()?.ringBufferFillLevel?.toFixed(3) ?? 'n/a';
                const inputPeak = (this.lastAudioData.inputPeakAbs ?? 0).toFixed(5);
                const inputRms = (this.lastAudioData.inputRMS ?? 0).toFixed(5);
                console.log(`[AudioPipeline] WORKER BPM=${workerBpm.toFixed(0)} conf=${workerConfidence.toFixed(2)} | PLL=${pllInfo}${freewheelTag} phase=${beatState.pllPhase.toFixed(2)} sync=${syncInfo} | beat #${this.lastAudioData.workerKickCount ?? 0} | bass=${rawEnergy} sab=${sabFill} | in_peak=${inputPeak} in_rms=${inputRms}`);
            }
        }
        else if (this.beatDetector) {
            beatState = this.beatDetector.tick(now);
        }
        return beatState;
    }
    /**
     * Get the effective bass/mid/high/energy values with gain applied.
     */
    getEffectiveBands() {
        const inputGain = this.ctx.getInputGain();
        if (this.hasRealAudio) {
            return {
                bass: this.lastAudioData.bass * inputGain,
                mid: this.lastAudioData.mid * inputGain,
                high: this.lastAudioData.high * inputGain,
                energy: this.lastAudioData.energy * inputGain,
            };
        }
        return { bass: 0, mid: 0, high: 0, energy: 0 };
    }
    /**
     * Reset beat detector state (called on stop).
     */
    resetBeatDetector() {
        if (this.beatDetector) {
            this.beatDetector.reset();
        }
    }
}
