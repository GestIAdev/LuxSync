/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💓 THE PACEMAKER - BEAT DETECTOR v2.0 + PLL
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 1022: THE PACEMAKER — Clustering + Hysteresis + Octave Protection
 * WAVE 2090.2: THE PACEMAKER MONOPOLY — Single Source of Truth for BPM
 * WAVE 2090.3: THE PHANTOM METRONOME — Phase-Locked Loop (PLL)
 * 
 * ARCHITECTURE:
 * 
 *   Worker (senses.ts)          Main Thread (here)
 *   ┌─────────────────┐        ┌──────────────────────────────────┐
 *   │ FFT + Transients │──IPC──▶│ process() → Kick Detection      │
 *   │ rawBassEnergy    │        │     ↓                            │
 *   │ kickDetected     │        │ updateBpmWithPacemaker()         │
 *   └─────────────────┘        │   (Clustering + Hysteresis)      │
 *                               │     ↓                            │
 *                               │ pllCorrectPhase()                │
 *                               │   (PI Error Correction)          │
 *                               │     ↓                            │
 *                               │ tick() ← requestAnimationFrame  │
 *                               │   (Flywheel + Anticipatory Beat)│
 *                               │     ↓                            │
 *                               │ BeatState → Zustand → Lights    │
 *                               └──────────────────────────────────┘
 * 
 * THE PLL (Phase-Locked Loop):
 * 
 *   The Flywheel spins continuously based on system clock,
 *   producing smooth 0→1 phase even between Worker messages.
 *   
 *   When a REAL kick arrives:
 *   - Small error (< 80ms) → Proportional-Integral correction
 *     (gently nudges the prediction without jarring phase jumps)
 *   - Large error → Hard Reset (snap to grid — song change, etc.)
 *   
 *   onBeat fires 23ms EARLY (lookahead) to compensate for:
 *   - Web Audio API latency (~50ms)
 *   - IPC transfer (~8ms)
 *   - Render pipeline (~16ms)
 *   
 *   Result: Lights PREDICT the beat, not chase it.
 * 
 * @author PunkOpus
 * @wave 1022 + 2090.3
 */

import type {
  AudioMetrics,
  AudioConfig,
} from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estado del detector de beats
 */
export interface BeatState {
  bpm: number                 // BPM estable (THE TRUTH)
  confidence: number          // 0-1 (consistencia de intervalos)
  phase: number               // 0-1 (posición en el beat — PLL-driven, anticipatorio)
  onBeat: boolean             // ¿Estamos en el golpe? (PLL lookahead-aware)
  beatCount: number           // Número total de beats detectados
  lastBeatTime: number        // Timestamp del último beat
  
  // Detección de instrumentos
  kickDetected: boolean
  snareDetected: boolean
  hihatDetected: boolean
  
  // 💓 WAVE 1022: Campos de diagnóstico
  rawBpm: number              // BPM sin filtrar (para debug)
  isLocked: boolean           // ¿BPM está "locked" (high confidence)?
  lockFrames: number          // Frames que llevamos locked
  
  // 🕰️ WAVE 2090.3: THE PHANTOM METRONOME — PLL telemetry
  pllPhase: number            // 0-1 (PLL-corrected continuous phase)
  pllOnBeat: boolean          // PLL beat prediction (with lookahead)
  predictedNextBeatTime: number  // When the PLL expects the next beat (ms timestamp)
  phaseError: number          // Last phase error in ms (+ = late, - = early)
  pllLocked: boolean          // Is the PLL phase-locked to audio?
}

/**
 * Historial de picos para detección
 */
interface PeakHistory {
  time: number
  energy: number
  type: 'kick' | 'snare' | 'hihat' | 'unknown'
}

/**
 * 💓 WAVE 1022: Cluster de intervalos
 */
interface IntervalCluster {
  centerMs: number            // Centro del cluster en ms
  count: number               // Cantidad de intervalos en este cluster
  intervals: number[]         // Los intervalos raw
  bpm: number                 // BPM correspondiente
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS - THE PACEMAKER TUNING
// ═══════════════════════════════════════════════════════════════════════════
// 💀 WAVE 1158: CARDIAC TRANSPLANT
// El problema: detectábamos hi-hats y bass wobbles como kicks
// La solución: copiar la lógica de BETA que SÍ funciona
// ═══════════════════════════════════════════════════════════════════════════

/** Tolerancia para agrupar intervalos similares (ms) */
const CLUSTER_TOLERANCE_MS = 30  // Era 25 - Más tolerante para agrupar

/** Frames mínimos para aceptar cambio de BPM */
const HYSTERESIS_FRAMES = 30  // ~1s @ 30fps

/** BPM delta máximo para considerar "estable" */
const BPM_STABILITY_DELTA = 5

/** Beats iniciales con warm-up (cambios rápidos permitidos) */
const WARMUP_BEATS = 8

/** Confidence mínima para lock de octava */
const OCTAVE_LOCK_CONFIDENCE = 0.70

/** Frames mínimos para aceptar cambio de octava */
const OCTAVE_CHANGE_FRAMES = 45

/**
 * 💀 WAVE 1158: INTERVALO MÍNIMO entre kicks para clustering.
 * 🩸 WAVE 2099: Aligned with MIN_PEAK_SPACING_MS (280ms).
 * No valid interval can be shorter than the debounce window.
 * 280ms = 214 BPM maximum. DnB at 170 BPM (353ms) still passes fine.
 */
const MIN_INTERVAL_MS = 280  // 🩸 WAVE 2099: Was 200 — must match debounce

/** Intervalo máximo válido (ms) - 40bpm min */
const MAX_INTERVAL_MS = 1500

/** Ratio para detectar sub-división (beat → half-beat) */
const SUBDIVISION_RATIO = 0.55

// ═══════════════════════════════════════════════════════════════════════════
// 🕰️ WAVE 2090.3: THE PHANTOM METRONOME — PLL CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Phase error threshold (ms) for soft correction vs hard reset.
 * If the kick arrives within this window of the predicted beat,
 * we apply proportional correction. Beyond this → hard reset (snap to grid).
 * 🩸 WAVE 2104: Restored to 120ms (between original 80ms and WAVE 2098's 150ms).
 * With rawBass ratio-based detection, kicks are more accurately timed than with AGC.
 * 120ms gives enough tolerance for frame timing variance without being too loose.
 */
const PLL_SOFT_CORRECTION_WINDOW_MS = 120

/**
 * Proportional gain for soft phase correction.
 * 0.0 = ignore error, 1.0 = snap immediately.
 * 0.3 means we correct 30% of the error per kick — smooth but responsive.
 */
const PLL_PROPORTIONAL_GAIN = 0.3

/**
 * Integral gain for BPM drift correction.
 * Accumulates small errors to slowly adjust smoothedBpm.
 * Very small to avoid oscillation (0.005 = 0.5% correction per kick).
 */
const PLL_INTEGRAL_GAIN = 0.005

/**
 * Lookahead time (ms) for anticipatory beat prediction.
 * onBeat fires this many ms BEFORE the predicted beat impact.
 * Compensates Web Audio API + IPC + render latency (~23ms total).
 * Fine-tuned: 50ms Web Audio + 8ms IPC ≈ 58ms → round to 23ms lookahead
 * (we only compensate part of it — too much lookahead feels unnatural)
 */
const PLL_LOOKAHEAD_MS = 23

/**
 * Beat window: how long (in phase 0-1) onBeat stays true.
 * 0.12 means the first 12% of each beat cycle fires onBeat.
 * At 128 BPM (468ms/beat), that's ~56ms window.
 */
const PLL_BEAT_WINDOW = 0.12

/**
 * Silence timeout (ms). If no kicks arrive for this duration,
 * the PLL freewheels on inertia but marks pllLocked = false.
 */
const PLL_SILENCE_TIMEOUT_MS = 4000

/**
 * 💀 WAVE 1158: DEBOUNCE MÍNIMO ENTRE KICKS
 * BETA usa 200ms, nosotros teníamos 80ms.
 * 
 * 🩸 WAVE 2099: THE GOLDILOCKS DEBOUNCE — 200ms was too low.
 * At 200ms, intervals of 229ms/264ms/276ms/295ms pass → these are hi-hat
 * sub-beats, NOT kick drums. The clustering then creates a phantom cluster
 * at ~280ms (~214 BPM) which dominates over the real kick cluster (~476ms = 126 BPM).
 * 
 * At 280ms debounce:
 * - 126 BPM (techno) = 476ms → PASSES ✅
 * - 170 BPM (DnB)    = 353ms → PASSES ✅  
 * - 200 BPM (fast)   = 300ms → PASSES ✅
 * - 214 BPM (sub-beat ghost) = 280ms → BLOCKED ❌
 * - Hi-hat wobbles at 229-276ms → BLOCKED ❌
 * 
 * This kills the 210 BPM phantom that plagued WAVE 2098.
 */
const MIN_PEAK_SPACING_MS = 280  // 🩸 WAVE 2099: Was 200 — sub-beats at 229-276ms were passing

// ═══════════════════════════════════════════════════════════════════════════
// THE PACEMAKER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 💓 BeatDetector v2.0 - THE PACEMAKER
 * 
 * Detecta y trackea el ritmo del audio con estabilidad de hospital.
 */
export class BeatDetector {
  // State
  private state: BeatState
  private peakHistory: PeakHistory[] = []
  private readonly maxPeakHistory = 64
  
  // Configuration
  private readonly minBpm: number
  private readonly maxBpm: number
  
  // ═══════════════════════════════════════════════════════════════════════════
  // � WAVE 1162: THE BYPASS - RAW BASS CALIBRATION
  // 
  // ANTES (WAVE 1161): Audio normalizado por AGC → transients pequeños (0.05-0.18)
  // AHORA (WAVE 1162): Audio RAW sin AGC → transients GRANDES (0.1-0.5+)
  // 
  // La señal RAW del GOD EAR tiene MUCHA más dinámica:
  // - Silencio: ~0.01-0.05
  // - Bajo continuo: ~0.1-0.3  
  // - KICK: ~0.4-0.8+ (¡PICOS REALES!)
  // 
  // Los transientes (frame-to-frame delta) serán proporcionalmente mayores.
  // Un kick real puede generar transients de 0.2-0.5 (vs 0.05-0.15 con AGC)
  // ═══════════════════════════════════════════════════════════════════════════
  
  // 🎚️ AUTO-GAIN: Media móvil del bass para calibración
  private bassHistory: number[] = []
  private readonly BASS_HISTORY_SIZE = 30  // ~1 segundo @ 30fps
  private bassAvg = 0.03  // 🩸 WAVE 2104: Initial value for rawBassEnergy (0.01-0.15 range)
  
  // 🩸 WAVE 2104: RATIO-BASED KICK DETECTION — Inspired by GodEarBPMTracker (WAVE 1163)
  // WAVE 2097/2098 used absolute thresholds on AGC-compressed bass, but AGC progressively
  // compresses dynamics over time → transients shrink → kicks lost → BPM corrupts.
  //
  // WAVE 1163 proved: ratio-based detection is IMMUNE to AGC/gain changes because
  // it measures RELATIVE change (current / rolling average), not absolute values.
  //
  // rawBassEnergy values: 0.01-0.15 (microscopic FFT power, pre-AGC)
  // Kick transients: 0.005-0.030 above rolling average
  // Ratio at kick: current/avg > 1.5x (kick is 50%+ above average)
  //
  // FORMULA: kickDetected = (bassTransient > 0) AND (current / avg > RATIO_THRESHOLD)
  //          AND (delta > MIN_DELTA)
  //
  // This is the EXACT philosophy from GodEarBPMTracker that worked for 74-188 BPM.
  private readonly KICK_RATIO_THRESHOLD = 1.4    // 🩸 WAVE 2104: Current must be 40%+ above average
  private readonly KICK_MIN_DELTA = 0.003         // 🩸 WAVE 2104: Minimum absolute rise (noise floor)
  
  // Legacy thresholds kept for snare/hihat (still fed frontendBass via mid/treble)
  private readonly KICK_THRESHOLD_BASE = 0.035    // 🩸 WAVE 2104: Legacy — not used for kick anymore
  private readonly KICK_THRESHOLD_MULTIPLIER = 0.025
  
  // Transient detection thresholds (DINÁMICOS - estos son fallbacks)
  private kickThreshold = 0.12   // Se recalcula cada frame
  private snareThreshold = 0.10  
  private hihatThreshold = 0.08
  
  // Previous frame values (for transient detection)
  private prevBass = 0
  private prevMid = 0
  private prevTreble = 0
  
  // 💀 WAVE 1156: Diagnostic counters
  private diagnosticFrames = 0
  private kicksDetectedTotal = 0
  
  // 💓 WAVE 1022: THE PACEMAKER STATE
  private candidateBpm = 120          // BPM que estamos "probando"
  private candidateFrames = 0         // Frames que el candidato ha sido estable
  private octaveChangeFrames = 0      // Frames intentando cambio de octava
  private lastDominantInterval = 500  // Último intervalo dominante detectado
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🕰️ WAVE 2090.3: THE PHANTOM METRONOME — PLL STATE
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** The PLL's internal BPM estimate — smoothed separately from the clustering BPM */
  private pllSmoothedBpm = 120
  
  /** Predicted timestamp (ms) of the next beat impact */
  private pllPredictedNextBeat = 0
  
  /** Accumulated integral error for BPM drift correction */
  private pllIntegralError = 0
  
  /** Timestamp of the last kick that was used for PLL correction */
  private pllLastCorrectionTime = 0
  
  /** Current continuous phase (0.0 - 1.0), advanced by tick() */
  private pllCurrentPhase = 0
  
  /** Is the PLL currently phase-locked to real audio? */
  private pllIsLocked = false
  
  // ═══════════════════════════════════════════════════════════════════════════
  // WAVE 2488 — DT-06: PLL SYNC RESILIENCE — ventana configurable por género
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * Ventana de corrección suave del PLL (ms) — configurable por género via AudioConfig.
   * Valores de referencia:
   *   120ms — Techno/Electronic (estándar, WAVE 2104)
   *   150ms — Pop/Rock (hi-hats generan micro-desvíos)
   *   200ms — Jazz/Poliritmos (swing, 3:2 polyrhythm, off-beat accents)
   *   100ms — Latino/Dembow (dembow preciso, tolerancia mínima)
   */
  private readonly pllSoftCorrectionWindowMs: number

  constructor(config: AudioConfig) {
    this.minBpm = config.minBpm || 60
    this.maxBpm = config.maxBpm || 200
    // WAVE 2488 DT-06: usa el valor del config o el default histórico (120ms WAVE 2104)
    this.pllSoftCorrectionWindowMs = config.pllSoftCorrectionWindowMs ?? PLL_SOFT_CORRECTION_WINDOW_MS

    this.state = this.createInitialState()
  }
  
  /**
   * Estado inicial
   */
  private createInitialState(): BeatState {
    return {
      bpm: 120,
      confidence: 0.5,
      phase: 0,
      onBeat: false,
      beatCount: 0,
      lastBeatTime: 0,
      kickDetected: false,
      snareDetected: false,
      hihatDetected: false,
      // WAVE 1022
      rawBpm: 120,
      isLocked: false,
      lockFrames: 0,
      // 🕰️ WAVE 2090.3: PLL initial state
      pllPhase: 0,
      pllOnBeat: false,
      predictedNextBeatTime: 0,
      phaseError: 0,
      pllLocked: false,
    }
  }
  
  /**
   * 🎯 Procesar frame de audio
   */
  process(metrics: AudioMetrics): BeatState {
    const now = metrics.timestamp
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 💀 WAVE 1160: AUTO-GAIN PACEMAKER - Calcular threshold dinámico
    // ═══════════════════════════════════════════════════════════════════════════
    
    // 1. Actualizar historial de bass para media móvil
    this.bassHistory.push(metrics.bass)
    if (this.bassHistory.length > this.BASS_HISTORY_SIZE) {
      this.bassHistory.shift()
    }
    
    // 2. Calcular media móvil del bass
    if (this.bassHistory.length >= 5) {
      this.bassAvg = this.bassHistory.reduce((a, b) => a + b, 0) / this.bassHistory.length
    }
    
    // 3. Calcular threshold DINÁMICO (ratio-based for kick, absolute for snare/hihat)
    // 🩸 WAVE 2104: RATIO-BASED — immune to AGC gain drift
    // Instead of: "is transient > fixed threshold?" (fails when AGC compresses)
    // We ask: "is current bass 40%+ above recent average?" (works regardless of gain)
    this.kickThreshold = this.bassAvg * this.KICK_RATIO_THRESHOLD  // For diagnostic logging only
    
    // ═══════════════════════════════════════════════════════════════════════════
    
    // 4. Detectar transientes (cambios bruscos de energía)
    const bassTransient = metrics.bass - this.prevBass
    const midTransient = metrics.mid - this.prevMid
    const trebleTransient = metrics.treble - this.prevTreble
    
    // 5. Detectar instrumentos con RATIO-BASED detection para kicks
    // 🩸 WAVE 2104: Ratio detection — inspired by GodEarBPMTracker (WAVE 1163)
    // Kick = bass rising AND current > 40% above rolling average AND minimum delta
    // This is IMMUNE to AGC gain drift because it's relative, not absolute.
    const bassRatio = this.bassAvg > 0.001 ? (metrics.bass / this.bassAvg) : 0
    this.state.kickDetected = bassTransient > this.KICK_MIN_DELTA && bassRatio > this.KICK_RATIO_THRESHOLD
    this.state.snareDetected = midTransient > this.snareThreshold && metrics.mid > 0.15
    this.state.hihatDetected = trebleTransient > this.hihatThreshold && metrics.treble > 0.10
    
    // 🩸 WAVE 2104: Diagnostic logging — now showing ratio-based metrics
    this.diagnosticFrames++
    if (this.diagnosticFrames % 60 === 0) {
      console.log(`[💓 PACEMAKER] bass=${metrics.bass.toFixed(4)} avg=${this.bassAvg.toFixed(4)} ratio=${bassRatio.toFixed(2)} delta=${bassTransient.toFixed(4)} | kicks=${this.kicksDetectedTotal} | bpm=${this.state.bpm.toFixed(0)} (PLL:${this.pllSmoothedBpm.toFixed(1)})`)
    }
    
    // 6. Registrar picos para análisis de BPM
    // 💀 WAVE 1158: Solo kicks reales pasan. El debounce de 200ms filtra el resto.
    if (this.state.kickDetected) {
      this.recordPeak(now, metrics.energy, 'kick')
      this.kicksDetectedTotal++
      // 🩸 WAVE 2104: Log kick detection with ratio metrics (throttled)
      if (this.kicksDetectedTotal <= 10 || this.kicksDetectedTotal % 20 === 0) {
        console.log(`[💓 KICK #${this.kicksDetectedTotal}] bass=${metrics.bass.toFixed(4)} ratio=${bassRatio.toFixed(2)} delta=${bassTransient.toFixed(4)} > minDelta=${this.KICK_MIN_DELTA}`)
      }
    }
    
    // 4. 💓 THE PACEMAKER: Calcular BPM con clustering + histéresis
    this.updateBpmWithPacemaker(now)
    
    // 5. 🕰️ WAVE 2090.3: Advance PLL phase (replaces old updatePhase)
    // The tick() method drives the Flywheel and produces anticipatory onBeat
    this.tick(now)
    
    // 7. Guardar valores anteriores
    this.prevBass = metrics.bass
    this.prevMid = metrics.mid
    this.prevTreble = metrics.treble
    
    return { ...this.state }
  }
  
  /**
   * Registrar un pico detectado
   */
  private recordPeak(time: number, energy: number, type: PeakHistory['type']): void {
    // 💀 WAVE 1158: DEBOUNCE CRÍTICO
    // El bug era que 80ms permitía hi-hats como kicks
    // BETA usa 200ms y FUNCIONA PERFECTAMENTE
    const lastPeak = this.peakHistory[this.peakHistory.length - 1]
    if (lastPeak && (time - lastPeak.time) < MIN_PEAK_SPACING_MS) {
      return
    }
    
    this.peakHistory.push({ time, energy, type })
    
    // Mantener historial limitado
    if (this.peakHistory.length > this.maxPeakHistory) {
      this.peakHistory.shift()
    }
    
    // Actualizar contador de beats
    if (type === 'kick') {
      this.state.beatCount++
      this.state.lastBeatTime = time
      
      // 🕰️ WAVE 2090.3: Feed the PLL with this real kick
      this.pllCorrectPhase(time)
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🕰️ WAVE 2090.3: THE PHANTOM METRONOME — PLL CORE
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * PHASE 2: Phase Error Correction (El Bucle de Control PI)
   * 
   * Called when a REAL kick arrives. Computes the error between
   * when the kick arrived vs when the PLL predicted the beat.
   * 
   * Small errors → soft proportional-integral correction (smooth lock)
   * Large errors → hard reset (snap to grid)
   */
  private pllCorrectPhase(kickTime: number): void {
    const beatDuration = 60000 / this.pllSmoothedBpm
    
    // ── BOOTSTRAP: First kick ever, or PLL was cold ──
    if (this.pllPredictedNextBeat === 0 || this.pllLastCorrectionTime === 0) {
      // Hard init: anchor the metronome to this kick
      this.pllPredictedNextBeat = kickTime + beatDuration
      this.pllCurrentPhase = 0
      this.pllLastCorrectionTime = kickTime
      this.pllIntegralError = 0
      this.pllIsLocked = false
      return
    }
    
    // ── Calculate phase error ──
    // Positive error = kick arrived LATE (after prediction)
    // Negative error = kick arrived EARLY (before prediction)
    // We compare against where the CURRENT beat should have been
    // (predictedNextBeat - beatDuration = predicted current beat)
    const predictedCurrentBeat = this.pllPredictedNextBeat - beatDuration
    const error = kickTime - predictedCurrentBeat
    
    // Wrap error to ±half beat duration (handle phase ambiguity)
    const halfBeat = beatDuration / 2
    let wrappedError = error % beatDuration
    if (wrappedError > halfBeat) wrappedError -= beatDuration
    if (wrappedError < -halfBeat) wrappedError += beatDuration
    
    // Store for telemetry
    this.state.phaseError = wrappedError
    
    if (Math.abs(wrappedError) <= this.pllSoftCorrectionWindowMs) {
      // ── SOFT CORRECTION: Proportional-Integral ──
      // The kick is close to where we expected it. Gently nudge the metronome.
      
      // P (Proportional): Shift predicted next beat by a fraction of the error
      const pCorrection = wrappedError * PLL_PROPORTIONAL_GAIN
      this.pllPredictedNextBeat = this.pllPredictedNextBeat + pCorrection
      
      // I (Integral): Accumulate small errors to correct BPM drift
      this.pllIntegralError += wrappedError
      
      // Clamp integral to prevent windup (±200ms accumulated max)
      if (this.pllIntegralError > 200) this.pllIntegralError = 200
      if (this.pllIntegralError < -200) this.pllIntegralError = -200
      
      // Apply integral correction to BPM
      // If kicks consistently arrive late → we're too fast → slow down BPM slightly
      const bpmCorrection = this.pllIntegralError * PLL_INTEGRAL_GAIN
      this.pllSmoothedBpm = this.state.bpm - bpmCorrection
      
      // Clamp BPM to sane range
      this.pllSmoothedBpm = Math.max(this.minBpm, Math.min(this.maxBpm, this.pllSmoothedBpm))
      
      // We're locked when we've had at least 2 corrections within tolerance
      this.pllIsLocked = true
      
    } else {
      // ── HARD RESET: Snap to Grid ──
      // The kick is WAY off from prediction. Could be:
      // - Silence → music resume
      // - Song change
      // - BPM changed dramatically
      // → Reset the metronome to this kick
      this.pllPredictedNextBeat = kickTime + beatDuration
      this.pllCurrentPhase = 0
      this.pllIntegralError = 0
      this.pllIsLocked = false
    }
    
    this.pllLastCorrectionTime = kickTime
  }
  
  /**
   * PHASE 1 + 3: THE FLYWHEEL — Continuous Phase Advance
   * 
   * Call this from requestAnimationFrame or any high-frequency tick
   * in the main thread. Advances the PLL phase mathematically
   * based on system clock, even if no Worker messages arrive.
   * 
   * This is what makes the lights PREDICT the music.
   * 
   * @param now - Current timestamp (performance.now() or Date.now())
   * @returns Current BeatState with PLL-driven phase and onBeat
   */
  tick(now: number): BeatState {
    const beatDuration = 60000 / this.pllSmoothedBpm
    
    // ── Advance phase from system clock ──
    if (this.pllPredictedNextBeat > 0) {
      // Time until next predicted beat
      const timeToNextBeat = this.pllPredictedNextBeat - now
      
      // Phase: 0.0 = beat impact, 1.0 = just before next beat
      // We invert: phase goes 0→1 through the beat cycle
      // At beat impact, phase wraps back to 0
      this.pllCurrentPhase = 1.0 - (timeToNextBeat / beatDuration)
      
      // Wrap phase to 0-1
      this.pllCurrentPhase = this.pllCurrentPhase % 1.0
      if (this.pllCurrentPhase < 0) this.pllCurrentPhase += 1.0
      
      // ── Roll over: advance prediction when we pass a beat ──
      if (now >= this.pllPredictedNextBeat) {
        // We've passed the predicted beat → advance to next
        // Use modular arithmetic to stay aligned
        const overshoot = now - this.pllPredictedNextBeat
        const fullBeatsOvershot = Math.floor(overshoot / beatDuration)
        this.pllPredictedNextBeat += (fullBeatsOvershot + 1) * beatDuration
        this.pllCurrentPhase = (overshoot % beatDuration) / beatDuration
      }
    }
    
    // ── Detect silence (freewheel mode) ──
    const timeSinceLastCorrection = now - this.pllLastCorrectionTime
    if (this.pllLastCorrectionTime > 0 && timeSinceLastCorrection > PLL_SILENCE_TIMEOUT_MS) {
      this.pllIsLocked = false
    }
    
    // ── Sync PLL BPM to Pacemaker BPM when not locked ──
    // When the clustering BPM changes and we're not locked, track it
    if (!this.pllIsLocked && this.state.bpm > 0) {
      this.pllSmoothedBpm = this.state.bpm
    }
    
    // ── Anticipatory onBeat with lookahead ──
    // Fire onBeat slightly BEFORE the predicted impact to compensate latency
    const lookaheadPhase = PLL_LOOKAHEAD_MS / beatDuration
    const adjustedPhase = (this.pllCurrentPhase + lookaheadPhase) % 1.0
    const pllOnBeat = adjustedPhase < PLL_BEAT_WINDOW || adjustedPhase > (1.0 - PLL_BEAT_WINDOW)
    
    // ── Write PLL state to BeatState ──
    this.state.pllPhase = this.pllCurrentPhase
    this.state.pllOnBeat = pllOnBeat
    this.state.predictedNextBeatTime = this.pllPredictedNextBeat
    this.state.pllLocked = this.pllIsLocked
    
    // ── Also update the legacy phase/onBeat to use PLL ──
    // This way ALL consumers get the PLL-driven values automatically
    this.state.phase = this.pllCurrentPhase
    this.state.onBeat = pllOnBeat
    
    return { ...this.state }
  }
  
  /**
   * 💓 WAVE 1022: THE PACEMAKER - BPM con clustering + histéresis
   */
  private updateBpmWithPacemaker(now: number): void {
    // 🩸 WAVE 2098: PEAK HISTORY DECAY — Purge stale kicks
    // Without this, old kicks from 30+ seconds ago stay in peakHistory forever.
    // The intervals between old+new kicks are garbage (989ms, 958ms outliers).
    // Only keep kicks from the last 10 seconds for fresh, relevant clustering.
    const PEAK_FRESHNESS_MS = 10000
    this.peakHistory = this.peakHistory.filter(p => (now - p.time) < PEAK_FRESHNESS_MS)
    
    // Necesitamos suficientes kicks para analizar
    const kicks = this.peakHistory.filter(p => p.type === 'kick')
    if (kicks.length < 6) return
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASO 1: Calcular todos los intervalos válidos
    // ═══════════════════════════════════════════════════════════════════════
    const intervals: number[] = []
    let rejectedIntervals = 0
    for (let i = 1; i < kicks.length; i++) {
      const interval = kicks[i].time - kicks[i - 1].time
      if (interval >= MIN_INTERVAL_MS && interval <= MAX_INTERVAL_MS) {
        intervals.push(interval)
      } else {
        rejectedIntervals++
      }
    }
    
    // 💀 WAVE 1158: Log intervals para diagnóstico (cada 4 segundos)
    if (this.diagnosticFrames % 120 === 0 && intervals.length > 0) {
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const minInterval = Math.min(...intervals)
      const maxInterval = Math.max(...intervals)
      // Mostrar los últimos 8 intervalos para debug
      const lastIntervals = intervals.slice(-8).map(i => `${i.toFixed(0)}ms`).join(', ')
      console.log(`[💓 INTERVALS] valid=${intervals.length} rejected=${rejectedIntervals} | avg=${avgInterval.toFixed(0)}ms (${(60000/avgInterval).toFixed(0)}bpm) | range=${minInterval.toFixed(0)}-${maxInterval.toFixed(0)}ms`)
      console.log(`[💓 LAST 8] ${lastIntervals}`)
    }
    
    if (intervals.length < 4) return
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASO 2: 🧹 CLUSTERING - Agrupar intervalos similares
    // ═══════════════════════════════════════════════════════════════════════
    const clusters = this.clusterIntervals(intervals)
    
    if (clusters.length === 0) return
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASO 3: Encontrar el CLUSTER DOMINANTE (Moda, no promedio)
    // ═══════════════════════════════════════════════════════════════════════
    const dominantCluster = this.findDominantCluster(clusters)
    
    if (!dominantCluster) return
    
    // Guardar para referencia
    this.lastDominantInterval = dominantCluster.centerMs
    
    // BPM crudo (sin filtrar)
    const rawBpm = dominantCluster.bpm
    this.state.rawBpm = rawBpm
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASO 4: 🔒 OCTAVE PROTECTION - Detectar saltos de octava falsos
    // 💀 WAVE 1157: Relajado para permitir cambios de canción
    // ═══════════════════════════════════════════════════════════════════════
    const currentBpm = this.state.bpm
    const isOctaveJump = this.isOctaveJump(rawBpm, currentBpm)
    
    if (isOctaveJump && this.state.beatCount > WARMUP_BEATS) {
      // Incrementar contador de frames intentando cambiar octava
      this.octaveChangeFrames++
      
      // 💀 WAVE 1157: Log cuando bloqueamos (cada 2 segundos)
      if (this.diagnosticFrames % 60 === 0) {
        const ratio = (rawBpm / currentBpm).toFixed(2)
        console.log(`[💓 OCTAVE BLOCK] ${currentBpm.toFixed(0)}→${rawBpm.toFixed(0)} BPM (ratio=${ratio}) | frames=${this.octaveChangeFrames}/${OCTAVE_CHANGE_FRAMES} | conf=${this.state.confidence.toFixed(2)}`)
      }
      
      // Solo aceptar cambio de octava si:
      // - Llevamos MUCHOS frames intentándolo
      // - La confianza es MUY alta
      if (this.octaveChangeFrames < OCTAVE_CHANGE_FRAMES || 
          this.state.confidence < OCTAVE_LOCK_CONFIDENCE) {
        // RECHAZAR cambio de octava - mantener BPM actual
        return
      }
      // 💀 WAVE 1157: Log cuando finalmente aceptamos
      console.log(`[💓 OCTAVE ACCEPT] ${currentBpm.toFixed(0)}→${rawBpm.toFixed(0)} BPM after ${this.octaveChangeFrames} frames`)
    } else {
      // Reset contador de octava si no es salto
      this.octaveChangeFrames = 0
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASO 5: ⚓ HYSTERESIS - Solo cambiar si el candidato persiste
    // ═══════════════════════════════════════════════════════════════════════
    const bpmDelta = Math.abs(rawBpm - this.candidateBpm)
    
    if (bpmDelta <= BPM_STABILITY_DELTA) {
      // BPM es similar al candidato anterior → incrementar estabilidad
      this.candidateFrames++
      
      // Refinar el candidato con media móvil suave
      this.candidateBpm = this.candidateBpm * 0.92 + rawBpm * 0.08
    } else {
      // BPM cambió significativamente → nuevo candidato
      this.candidateBpm = rawBpm
      this.candidateFrames = 0
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASO 6: Aplicar cambio SOLO si es estable
    // ═══════════════════════════════════════════════════════════════════════
    const isWarmup = this.state.beatCount < WARMUP_BEATS
    const requiredFrames = isWarmup ? 8 : HYSTERESIS_FRAMES
    
    if (this.candidateFrames >= requiredFrames) {
      // ¡El candidato es estable! Aplicar cambio
      // 🩸 WAVE 2101.4: BPM RATE LIMITER — máximo ±2 BPM por actualización
      // El BPM driftaba de 123→163 porque candidateBpm absorbía sub-divisiones
      // Sin rate limit, 30 frames estables de intervalos cortos = BPM sube de golpe.
      // 🩸 WAVE 2101.5: BPM SANITY FLOOR — Si BPM candidato está a <70% o >140% del actual,
      // es un cambio de octava disfrazado o clustering de basura. Rechazar.
      // Un tema NO cambia de 122 a 57 BPM. Lo que cambia es que los intervalos
      // entre kicks son erráticos (range 295-1428ms) y el cluster dominante se rompe.
      const newBpm = Math.round(this.candidateBpm * 10) / 10
      
      // Sanity check: si ya tenemos BPM estable, rechazar candidatos absurdos
      if (this.state.bpm > 0 && !isWarmup) {
        const ratio = newBpm / this.state.bpm
        if (ratio < 0.70 || ratio > 1.40) {
          // Candidato absurdo — resetear y mantener BPM actual
          this.candidateFrames = 0
          return
        }
      }
      
      const maxBpmChange = isWarmup ? 10 : 2  // Warmup permite cambios rápidos
      const clampedBpm = Math.max(
        this.state.bpm - maxBpmChange, 
        Math.min(this.state.bpm + maxBpmChange, newBpm)
      )
      this.state.bpm = this.state.bpm === 0 ? newBpm : clampedBpm  // First detection = no clamp
      this.state.isLocked = true
      this.state.lockFrames++
    } else {
      this.state.isLocked = false
      this.state.lockFrames = 0
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASO 7: Calcular confianza basada en consistencia del cluster dominante
    // ═══════════════════════════════════════════════════════════════════════
    this.state.confidence = this.calculateConfidence(dominantCluster, clusters)
  }
  
  /**
   * 🧹 Agrupar intervalos similares en clusters
   */
  private clusterIntervals(intervals: number[]): IntervalCluster[] {
    if (intervals.length === 0) return []
    
    // Ordenar intervalos
    const sorted = [...intervals].sort((a, b) => a - b)
    
    const clusters: IntervalCluster[] = []
    let currentCluster: IntervalCluster | null = null
    
    for (const interval of sorted) {
      if (!currentCluster) {
        // Primer cluster
        currentCluster = {
          centerMs: interval,
          count: 1,
          intervals: [interval],
          bpm: 60000 / interval,
        }
      } else if (Math.abs(interval - currentCluster.centerMs) <= CLUSTER_TOLERANCE_MS) {
        // Agregar al cluster actual
        currentCluster.intervals.push(interval)
        currentCluster.count++
        // Recalcular centro como promedio del cluster
        currentCluster.centerMs = currentCluster.intervals.reduce((a, b) => a + b, 0) / currentCluster.count
        currentCluster.bpm = 60000 / currentCluster.centerMs
      } else {
        // Nuevo cluster
        clusters.push(currentCluster)
        currentCluster = {
          centerMs: interval,
          count: 1,
          intervals: [interval],
          bpm: 60000 / interval,
        }
      }
    }
    
    // No olvidar el último cluster
    if (currentCluster) {
      clusters.push(currentCluster)
    }
    
    return clusters
  }
  
  /**
   * 🎯 Encontrar el cluster dominante (Moda)
   * 
   * Prioriza:
   * 1. El cluster con más intervalos
   * 2. Si hay empate, el que está más cerca del BPM actual (estabilidad)
   * 3. Ignora clusters de sub-división si hay uno de beat completo
   */
  private findDominantCluster(clusters: IntervalCluster[]): IntervalCluster | null {
    if (clusters.length === 0) return null
    if (clusters.length === 1) return clusters[0]
    
    // Ordenar por cantidad (más intervalos primero)
    const sorted = [...clusters].sort((a, b) => b.count - a.count)
    
    // El más grande
    const largest = sorted[0]
    
    // Verificar si hay otros clusters significativos
    const significant = sorted.filter(c => c.count >= largest.count * 0.6)
    
    if (significant.length === 1) {
      return largest
    }
    
    // Si hay múltiples clusters significativos, priorizar el más cercano al BPM actual
    // (estabilidad temporal)
    const currentBpm = this.state.bpm
    
    let best = largest
    let bestDistance = Math.abs(largest.bpm - currentBpm)
    
    for (const cluster of significant) {
      const distance = Math.abs(cluster.bpm - currentBpm)
      
      // Si está más cerca del BPM actual Y no es una sub-división obvia
      if (distance < bestDistance) {
        // Verificar que no sea sub-división del largest
        const ratio = cluster.centerMs / largest.centerMs
        const isSubdivision = ratio < SUBDIVISION_RATIO || (ratio > 1.8 && ratio < 2.2)
        
        if (!isSubdivision) {
          best = cluster
          bestDistance = distance
        }
      }
    }
    
    return best
  }
  
  /**
   * 🔒 Detectar si el cambio de BPM es un salto de octava (falso positivo)
   * 💀 WAVE 1157: Rangos más estrictos para no bloquear cambios legítimos
   */
  private isOctaveJump(newBpm: number, currentBpm: number): boolean {
    if (currentBpm === 0) return false
    
    const ratio = newBpm / currentBpm
    
    // Ratios peligrosos: SOLO doble y mitad (las octavas reales)
    // 💀 WAVE 1157: Eliminamos 1.5x y 0.66x porque bloquean cambios de canción
    // Ejemplo: 87 BPM (Dub) → 127 BPM (Techno) = 1.46x NO es octava
    const dangerousRatios = [
      { min: 1.90, max: 2.10 },   // Doble exacto (±5%)
      { min: 0.48, max: 0.52 },   // Mitad exacto (±4%)
    ]
    
    for (const range of dangerousRatios) {
      if (ratio >= range.min && ratio <= range.max) {
        return true
      }
    }
    
    return false
  }
  
  /**
   * 📊 Calcular confianza basada en consistencia
   */
  private calculateConfidence(dominant: IntervalCluster, allClusters: IntervalCluster[]): number {
    // Base: qué porcentaje de intervalos están en el cluster dominante
    const totalIntervals = allClusters.reduce((sum, c) => sum + c.count, 0)
    const dominantRatio = dominant.count / totalIntervals
    
    // Varianza dentro del cluster dominante
    const mean = dominant.centerMs
    const variance = dominant.intervals.reduce((sum, i) => sum + Math.pow(i - mean, 2), 0) / dominant.count
    const stdDev = Math.sqrt(variance)
    const consistencyScore = Math.max(0, 1 - (stdDev / mean) * 2)
    
    // Combinar scores
    const confidence = (dominantRatio * 0.6) + (consistencyScore * 0.4)
    
    // Clamp 0-1
    return Math.max(0, Math.min(1, confidence))
  }
  
  /**
   * @deprecated WAVE 2090.3: Replaced by PLL tick(). Kept for reference only.
   * Legacy phase calculation — reactive, not anticipatory.
   */
  private updatePhase(now: number): void {
    const beatDuration = 60000 / this.state.bpm
    const timeSinceLastBeat = now - this.state.lastBeatTime
    this.state.phase = (timeSinceLastBeat % beatDuration) / beatDuration
  }
  
  /**
   * Forzar BPM manualmente (para sync externo o usuario)
   */
  setBpm(bpm: number): void {
    if (bpm >= this.minBpm && bpm <= this.maxBpm) {
      this.state.bpm = bpm
      this.candidateBpm = bpm
      this.candidateFrames = HYSTERESIS_FRAMES  // Forzar lock inmediato
      this.state.confidence = 1.0
      this.state.isLocked = true
      // 🕰️ WAVE 2090.3: Sync PLL to manual BPM
      this.pllSmoothedBpm = bpm
      this.pllIntegralError = 0
    }
  }
  
  /**
   * 🔥 WAVE 2179: FREEWHEEL MODE — PLL gira en el BPM conocido sin asumir lock.
   * 
   * Llamado por TitanOrchestrator cuando Worker conf=0 pero hay memoria reciente.
   * Mantiene el PLL girando a la frecuencia correcta durante breaks/silencio.
   * 
   * SEPARACIÓN DE RESPONSABILIDADES (PunkArchytect doctrine):
   * - setBpm() → Worker tiene señal, asume LOCK. Actualiza clustering.
   * - freewheelAt() → Worker está sordo, Cerebro recuerda. Solo actualiza PLL.
   *   pllIsLocked permanece false — el Pacemaker es honesto sobre su estado.
   */
  freewheelAt(bpm: number): void {
    if (bpm >= this.minBpm && bpm <= this.maxBpm) {
      // Solo actualizar la frecuencia del volante. NO tocar clustering ni confidence.
      this.pllSmoothedBpm = bpm
      // pllIsLocked permanece false — no hay señal real que lo confirme
    }
  }

  /**
   * Tap tempo - usuario marca el beat manualmente
   */
  tap(timestamp: number): void {
    this.recordPeak(timestamp, 1.0, 'kick')
    this.updateBpmWithPacemaker(timestamp)
  }
  
  /**
   * Obtener estado actual
   */
  getState(): BeatState {
    return { ...this.state }
  }
  
  /**
   * 💓 WAVE 1022 + 🕰️ WAVE 2090.3: Obtener diagnóstico del Pacemaker + PLL
   */
  getDiagnostics(): {
    stableBpm: number
    rawBpm: number
    candidateBpm: number
    candidateFrames: number
    isLocked: boolean
    confidence: number
    octaveChangeFrames: number
    lastInterval: number
    // 🕰️ WAVE 2090.3: PLL diagnostics
    pllBpm: number
    pllPhase: number
    pllError: number
    pllLocked: boolean
    pllNextBeat: number
  } {
    return {
      stableBpm: this.state.bpm,
      rawBpm: this.state.rawBpm,
      candidateBpm: this.candidateBpm,
      candidateFrames: this.candidateFrames,
      isLocked: this.state.isLocked,
      confidence: this.state.confidence,
      octaveChangeFrames: this.octaveChangeFrames,
      lastInterval: this.lastDominantInterval,
      // 🕰️ WAVE 2090.3: PLL
      pllBpm: this.pllSmoothedBpm,
      pllPhase: this.pllCurrentPhase,
      pllError: this.state.phaseError,
      pllLocked: this.pllIsLocked,
      pllNextBeat: this.pllPredictedNextBeat,
    }
  }
  
  /**
   * Reset detector
   */
  reset(): void {
    this.peakHistory = []
    this.candidateBpm = 120
    this.candidateFrames = 0
    this.octaveChangeFrames = 0
    this.lastDominantInterval = 500
    this.prevBass = 0
    this.prevMid = 0
    this.prevTreble = 0
    // 💀 WAVE 1156: Reset diagnostic counters
    this.diagnosticFrames = 0
    this.kicksDetectedTotal = 0
    // 🕰️ WAVE 2090.3: Reset PLL state
    this.pllSmoothedBpm = 120
    this.pllPredictedNextBeat = 0
    this.pllIntegralError = 0
    this.pllLastCorrectionTime = 0
    this.pllCurrentPhase = 0
    this.pllIsLocked = false
    this.state = this.createInitialState()
  }
}
