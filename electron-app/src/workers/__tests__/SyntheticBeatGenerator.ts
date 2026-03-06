/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎰 THE MOCK EAR — Synthetic Beat Buffer Generator
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 2113: THE AUTOMATON
 * 
 * Generates deterministic arrays of rawBassEnergy frames that simulate
 * real audio without any Web Audio API or mp3 files. Pure math.
 * 
 * Each "frame" represents one GodEarFFT output cycle (~21ms @ 48kHz/4096).
 * The array index IS the frame index; multiply by FRAME_DURATION_MS to get time.
 * 
 * NO random numbers. NO simulation. NO heuristics.
 * Every output is 100% deterministic and reproducible.
 * 
 * @author PunkOpus
 * @wave 2113
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Duration of one FFT frame in ms (4096 samples @ 48kHz ≈ 85.3ms, but overlap = ~21ms) */
export const FRAME_DURATION_MS = 21

/** Default "floor" noise energy — simulates room noise + bass rumble.
 *  WAVE 2131: Calibrated to production rawSubBassEnergy values observed in
 *  debugBPM.md: silence frames 0.0047-0.0191, typical mid-energy ~0.010. */
const NOISE_FLOOR = 0.010

/** Noise variation range (floor ± this value) — NOT random, uses sine modulation */
const NOISE_VARIATION = 0.004

/** Default kick peak energy.
 *  WAVE 2131: Production kicks measured at 0.040-0.055 rawSubBassEnergy.
 *  Using 0.050 as canonical kick peak — well above 70% of P90 threshold. */
const DEFAULT_KICK_ENERGY = 0.050

/** Kick "tail" decay — how many frames the kick energy takes to decay to floor */
const KICK_TAIL_FRAMES = 3

/** Decay multiplier per frame after kick peak */
const KICK_DECAY_RATE = 0.40

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface SyntheticFrame {
  /** rawBassEnergy value for this frame */
  energy: number
  /** Timestamp in ms for this frame */
  timestamp: number
  /** Whether this frame is a kick peak (for test assertions) */
  isKickFrame: boolean
}

export interface SyntheticBuffer {
  /** All frames in order */
  frames: SyntheticFrame[]
  /** Total duration in ms */
  durationMs: number
  /** Number of kick peaks injected */
  kickCount: number
  /** BPM that was used to generate this buffer */
  sourceBpm: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a synthetic beat buffer with kicks at exact BPM intervals.
 * 
 * @param bpm - Target BPM for kick placement
 * @param durationSeconds - Duration of the buffer in seconds
 * @param options - Optional overrides
 * @returns Deterministic SyntheticBuffer
 */
export function generateSyntheticBeatBuffer(
  bpm: number,
  durationSeconds: number,
  options: {
    kickEnergy?: number
    noiseFloor?: number
    noiseVariation?: number
    /** Start time offset in ms (for chaining segments) */
    startTimeMs?: number
  } = {}
): SyntheticBuffer {
  const kickEnergy = options.kickEnergy ?? DEFAULT_KICK_ENERGY
  const noiseFloor = options.noiseFloor ?? NOISE_FLOOR
  const noiseVariation = options.noiseVariation ?? NOISE_VARIATION
  const startTimeMs = options.startTimeMs ?? 0
  
  const totalFrames = Math.ceil((durationSeconds * 1000) / FRAME_DURATION_MS)
  const beatIntervalMs = 60000 / bpm
  
  const frames: SyntheticFrame[] = []
  let kickCount = 0
  
  // Pre-calculate all kick timestamps (deterministic)
  const kickTimestamps: number[] = []
  let nextKickTime = startTimeMs + beatIntervalMs // First kick after one interval
  const endTime = startTimeMs + (durationSeconds * 1000)
  
  while (nextKickTime < endTime) {
    kickTimestamps.push(nextKickTime)
    nextKickTime += beatIntervalMs
  }
  
  // Generate each frame
  for (let i = 0; i < totalFrames; i++) {
    const timestamp = startTimeMs + (i * FRAME_DURATION_MS)
    
    // Deterministic "noise" modulation using sine waves
    // Two sine waves at different frequencies create organic-looking variation
    const sineModA = Math.sin(i * 0.17) * noiseVariation * 0.6
    const sineModB = Math.sin(i * 0.43) * noiseVariation * 0.4
    const baseEnergy = noiseFloor + sineModA + sineModB
    
    // Check if this frame coincides with a kick
    let energy = Math.max(0.01, baseEnergy)
    let isKickFrame = false
    
    for (const kickTime of kickTimestamps) {
      const framesSinceKick = (timestamp - kickTime) / FRAME_DURATION_MS
      
      if (framesSinceKick >= 0 && framesSinceKick < 1) {
        // THIS is the kick frame
        energy = kickEnergy
        isKickFrame = true
        kickCount++
        break
      } else if (framesSinceKick >= 1 && framesSinceKick < 1 + KICK_TAIL_FRAMES) {
        // Kick tail decay
        const decayFrames = framesSinceKick - 1
        const tailEnergy = kickEnergy * Math.pow(KICK_DECAY_RATE, decayFrames)
        energy = Math.max(energy, tailEnergy)
        break
      }
    }
    
    frames.push({ energy, timestamp, isKickFrame })
  }
  
  return {
    frames,
    durationMs: durationSeconds * 1000,
    kickCount,
    sourceBpm: bpm,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VARIANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate half-time buffer: kicks at half the apparent BPM.
 * Simulates Trap/Dubstep where bass hits at half the "felt" tempo.
 * 
 * @param bpm - The FULL tempo (e.g., 140 for a trap track)
 * @param durationSeconds - Duration
 * @returns Buffer with kicks at bpm/2 intervals
 */
export function generateHalfTimeBuffer(
  bpm: number,
  durationSeconds: number,
  options: { startTimeMs?: number } = {}
): SyntheticBuffer {
  // Half-time: kicks land every OTHER beat
  const halfBpm = bpm / 2
  const buffer = generateSyntheticBeatBuffer(halfBpm, durationSeconds, {
    kickEnergy: 0.055, // Half-time kicks tend to be heavier (production: ~0.055)
    startTimeMs: options.startTimeMs,
  })
  // Tag with the musical BPM, not the kick rate
  return { ...buffer, sourceBpm: bpm }
}

/**
 * Generate breakdown/silence buffer: just noise floor, no kicks.
 * Simulates the breakdown section of EDM where drums drop out.
 * 
 * @param durationSeconds - Duration of silence
 * @param startTimeMs - Start offset for chaining
 * @returns Buffer with only noise, zero kicks
 */
export function generateBreakdownBuffer(
  durationSeconds: number,
  options: {
    startTimeMs?: number
    /** Lower noise floor for "real" breakdown feel */
    noiseFloor?: number
  } = {}
): SyntheticBuffer {
  const noiseFloor = options.noiseFloor ?? 0.006 // Lower than normal — energy drops in breakdown (production: silence ~0.005)
  const startTimeMs = options.startTimeMs ?? 0
  const totalFrames = Math.ceil((durationSeconds * 1000) / FRAME_DURATION_MS)
  
  const frames: SyntheticFrame[] = []
  
  for (let i = 0; i < totalFrames; i++) {
    const timestamp = startTimeMs + (i * FRAME_DURATION_MS)
    
    // Deterministic slow wave — breakdowns have gentle movement
    const sineModA = Math.sin(i * 0.07) * 0.03
    const sineModB = Math.sin(i * 0.23) * 0.02
    const energy = Math.max(0.01, noiseFloor + sineModA + sineModB)
    
    frames.push({ energy, timestamp, isKickFrame: false })
  }
  
  return {
    frames,
    durationMs: durationSeconds * 1000,
    kickCount: 0,
    sourceBpm: 0,
  }
}

/**
 * Generate variable-amplitude buffer: same BPM but kick peaks vary.
 * Simulates compressed/dynamic tracks (Brejcha style rolling bass).
 * Uses deterministic sine modulation on kick amplitude.
 * 
 * @param bpm - Target BPM
 * @param durationSeconds - Duration
 * @param amplitudeRange - [min, max] for kick peak energy
 * @returns Buffer with varying kick amplitudes
 */
export function generateVariableAmplitudeBuffer(
  bpm: number,
  durationSeconds: number,
  amplitudeRange: [number, number] = [0.35, 0.90],
  options: { startTimeMs?: number } = {}
): SyntheticBuffer {
  const startTimeMs = options.startTimeMs ?? 0
  const totalFrames = Math.ceil((durationSeconds * 1000) / FRAME_DURATION_MS)
  const beatIntervalMs = 60000 / bpm
  const [minAmp, maxAmp] = amplitudeRange
  
  const frames: SyntheticFrame[] = []
  let kickCount = 0
  
  // Pre-calculate kick timestamps
  const kickTimestamps: number[] = []
  let nextKickTime = startTimeMs + beatIntervalMs
  const endTime = startTimeMs + (durationSeconds * 1000)
  
  while (nextKickTime < endTime) {
    kickTimestamps.push(nextKickTime)
    nextKickTime += beatIntervalMs
  }
  
  for (let i = 0; i < totalFrames; i++) {
    const timestamp = startTimeMs + (i * FRAME_DURATION_MS)
    
    // Noise floor
    const sineModA = Math.sin(i * 0.17) * NOISE_VARIATION * 0.6
    const sineModB = Math.sin(i * 0.43) * NOISE_VARIATION * 0.4
    let energy = Math.max(0.01, NOISE_FLOOR + sineModA + sineModB)
    let isKickFrame = false
    
    for (let k = 0; k < kickTimestamps.length; k++) {
      const kickTime = kickTimestamps[k]
      const framesSinceKick = (timestamp - kickTime) / FRAME_DURATION_MS
      
      if (framesSinceKick >= 0 && framesSinceKick < 1) {
        // Deterministic amplitude variation using kick index
        // Sine wave modulates amplitude — NO random
        const ampModulation = Math.sin(k * 0.73) * 0.5 + 0.5 // 0-1
        const kickEnergy = minAmp + ampModulation * (maxAmp - minAmp)
        
        energy = kickEnergy
        isKickFrame = true
        kickCount++
        break
      } else if (framesSinceKick >= 1 && framesSinceKick < 1 + KICK_TAIL_FRAMES) {
        const ampModulation = Math.sin(k * 0.73) * 0.5 + 0.5
        const kickEnergy = minAmp + ampModulation * (maxAmp - minAmp)
        const decayFrames = framesSinceKick - 1
        const tailEnergy = kickEnergy * Math.pow(KICK_DECAY_RATE, decayFrames)
        energy = Math.max(energy, tailEnergy)
        break
      }
    }
    
    frames.push({ energy, timestamp, isKickFrame })
  }
  
  return {
    frames,
    durationMs: durationSeconds * 1000,
    kickCount,
    sourceBpm: bpm,
  }
}

/**
 * Chain multiple buffers together sequentially.
 * Automatically handles timestamp continuity between segments.
 * 
 * @param segments - Array of buffer generator functions
 * @returns Combined SyntheticBuffer
 */
export function chainBuffers(
  ...segments: Array<(startTimeMs: number) => SyntheticBuffer>
): SyntheticBuffer {
  const allFrames: SyntheticFrame[] = []
  let currentTime = 0
  let totalKicks = 0
  let lastSourceBpm = 0
  
  for (const segmentFn of segments) {
    const segment = segmentFn(currentTime)
    allFrames.push(...segment.frames)
    totalKicks += segment.kickCount
    currentTime += segment.durationMs
    if (segment.sourceBpm > 0) lastSourceBpm = segment.sourceBpm
  }
  
  return {
    frames: allFrames,
    durationMs: currentTime,
    kickCount: totalKicks,
    sourceBpm: lastSourceBpm,
  }
}

/**
 * 🔧 WAVE 2116: Generate buffer with sub-beats (offbeats between main kicks).
 * 
 * Simulates Brejcha-style productions where:
 * - Main kicks land on every beat at the true BPM (e.g., 125 BPM)
 * - Offbeats (bass synth pulses, hats with low-end bleed) land between kicks
 * - The bass floor is high (0.18) due to continuous rolling bass
 * - Offbeats have energy 0.40-0.55 — enough to fool a loose ratio detector
 *   (0.45 / 0.18 = 2.5×, but real kicks are 0.80 / 0.18 = 4.4×)
 * 
 * This is THE test that caught the 161 BPM bug.
 * 
 * @param bpm - Target BPM for MAIN kicks (the true tempo)
 * @param durationSeconds - Duration
 * @param options - Optional overrides
 * @returns Buffer with kicks AND sub-beats
 */
export function generateSubBeatBuffer(
  bpm: number,
  durationSeconds: number,
  options: {
    kickEnergy?: number
    subBeatEnergy?: number
    noiseFloor?: number
    startTimeMs?: number
  } = {}
): SyntheticBuffer {
  const kickEnergy = options.kickEnergy ?? 0.050
  const subBeatEnergy = options.subBeatEnergy ?? 0.028  // Sub-beats ~55% of kick (production: offbeats ~0.025-0.030)
  const noiseFloor = options.noiseFloor ?? 0.012  // Higher floor — continuous bass (production: low-mid bass roll ~0.010-0.015)
  const startTimeMs = options.startTimeMs ?? 0
  
  const totalFrames = Math.ceil((durationSeconds * 1000) / FRAME_DURATION_MS)
  const beatIntervalMs = 60000 / bpm
  const halfBeatMs = beatIntervalMs / 2  // Sub-beat at the halfway point
  
  const frames: SyntheticFrame[] = []
  let kickCount = 0
  
  // Pre-calculate main kick timestamps
  const kickTimestamps: number[] = []
  let nextKickTime = startTimeMs + beatIntervalMs
  const endTime = startTimeMs + (durationSeconds * 1000)
  
  while (nextKickTime < endTime) {
    kickTimestamps.push(nextKickTime)
    nextKickTime += beatIntervalMs
  }
  
  // Pre-calculate sub-beat timestamps (halfway between kicks)
  const subBeatTimestamps: number[] = []
  for (const kickTime of kickTimestamps) {
    subBeatTimestamps.push(kickTime + halfBeatMs)
  }
  
  for (let i = 0; i < totalFrames; i++) {
    const timestamp = startTimeMs + (i * FRAME_DURATION_MS)
    
    // Higher noise floor with organic modulation
    const sineModA = Math.sin(i * 0.13) * 0.003
    const sineModB = Math.sin(i * 0.37) * 0.002
    let energy = Math.max(0.005, noiseFloor + sineModA + sineModB)
    let isKickFrame = false
    
    // Check main kicks first
    for (const kickTime of kickTimestamps) {
      const framesSinceKick = (timestamp - kickTime) / FRAME_DURATION_MS
      if (framesSinceKick >= 0 && framesSinceKick < 1) {
        energy = kickEnergy
        isKickFrame = true
        kickCount++
        break
      } else if (framesSinceKick >= 1 && framesSinceKick < 1 + KICK_TAIL_FRAMES) {
        const tailEnergy = kickEnergy * Math.pow(KICK_DECAY_RATE, framesSinceKick - 1)
        energy = Math.max(energy, tailEnergy)
        break
      }
    }
    
    // Check sub-beats (only if not already a kick)
    if (!isKickFrame) {
      for (const subTime of subBeatTimestamps) {
        const framesSinceSub = (timestamp - subTime) / FRAME_DURATION_MS
        if (framesSinceSub >= 0 && framesSinceSub < 1) {
          energy = Math.max(energy, subBeatEnergy)
          break
        } else if (framesSinceSub >= 1 && framesSinceSub < 1 + 2) {
          // Sub-beats have shorter decay (2 frames vs 4)
          const tailEnergy = subBeatEnergy * Math.pow(0.35, framesSinceSub - 1)
          energy = Math.max(energy, tailEnergy)
          break
        }
      }
    }
    
    frames.push({ energy, timestamp, isKickFrame })
  }
  
  return {
    frames,
    durationMs: durationSeconds * 1000,
    kickCount,
    sourceBpm: bpm,
  }
}
