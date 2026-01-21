/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║         SELENE BRAIN ADAPTER - THE BRIDGE TO TRUTH            ║
 * ║                                                               ║
 * ║  "Connect synthetic signals to the real brain."               ║
 * ║                                                               ║
 * ║  This adapter implements BrainMetricProvider interface,       ║
 * ║  allowing the CalibrationRunner to feed synthetic signals     ║
 * ║  through the REAL Selene analysis pipeline.                   ║
 * ╚═══════════════════════════════════════════════════════════════╝
 * 
 * WAVE 670.5 - THE SELENE LAB
 * 
 * ARCHITECTURE:
 *   Synthetic Buffer (Float32Array)
 *         │
 *         ▼
 *   ┌─────────────────┐
 *   │ AGC (normalize) │
 *   └─────────────────┘
 *         │
 *         ▼
 *   ┌─────────────────┐
 *   │ FFT (spectrum)  │
 *   └─────────────────┘
 *         │
 *         ▼
 *   ┌─────────────────┐
 *   │ ContextualMemory│ (Z-Scores)
 *   └─────────────────┘
 *         │
 *         ▼
 *   ┌─────────────────┐
 *   │ FuzzyDecisionMkr│
 *   └─────────────────┘
 *         │
 *         ▼
 *   MetricSnapshot (telemetry)
 */

import { BrainMetricProvider } from './CalibrationRunner'

// FFT Analyzer - The mathematical core
import { FFTAnalyzer } from '../../workers/FFT'

// Contextual Memory - Z-Score calculation (in memory/ folder)
import { 
  ContextualMemory, 
  SectionType as MemorySectionType
} from '../intelligence/memory/ContextualMemory'

// Fuzzy Decision Maker
import { 
  FuzzyDecisionMaker, 
  FuzzyDecision
} from '../intelligence/think/FuzzyDecisionMaker'

// Drop Bridge
import { DropBridge, DropBridgeResult } from '../intelligence/think/DropBridge'

// 🔋 WAVE 932: Import energy context helpers para calibración
import { createDefaultEnergyContext } from '../protocol/MusicalContext'

// Section type from engine (for compatibility)
import { SectionType as EngineSectionType } from '../../engine/types'

/**
 * Configuration for the brain adapter
 */
export interface BrainAdapterConfig {
  sampleRate: number
  bufferSize: number
  
  // AGC parameters
  agcEnabled: boolean
  agcTargetLevel: number
  agcAttackTime: number
  agcReleaseTime: number
}

const DEFAULT_CONFIG: BrainAdapterConfig = {
  sampleRate: 44100,
  bufferSize: 2048,
  agcEnabled: true,
  agcTargetLevel: 0.5,
  agcAttackTime: 0.005,
  agcReleaseTime: 0.1
}

/**
 * Metrics extracted from a single buffer
 */
interface ExtractedMetrics {
  // Raw from buffer
  rawEnergy: number
  peakLevel: number
  rmsLevel: number
  
  // AGC output
  normalizedEnergy: number
  agcGain: number
  
  // FFT spectrum
  bassEnergy: number
  midEnergy: number
  highEnergy: number
  subBass: number
  spectralCentroid: number
  spectralFlatness: number
  harshness: number
  dominantFrequency: number
  kickDetected: boolean
  snareDetected: boolean
  
  // Context (Z-Scores) - extracted from ContextualMemoryOutput
  energyZScore: number
  bassZScore: number
  harshnessZScore: number
  
  // Fuzzy
  fuzzyDecision: FuzzyDecision | null
  
  // Drop Bridge
  dropBridgeResult: DropBridgeResult | null
}

/**
 * Maps memory section type to engine section type
 * (handles 'unknown' which only exists in memory module)
 */
function mapSectionType(section: MemorySectionType): EngineSectionType {
  if (section === 'unknown') return 'intro'
  return section as EngineSectionType
}

/**
 * SeleneBrainAdapter - Real brain for calibration testing
 */
export class SeleneBrainAdapter implements BrainMetricProvider {
  private config: BrainAdapterConfig
  
  // Core components
  private fftAnalyzer: FFTAnalyzer
  private contextualMemory: ContextualMemory
  private fuzzyDecisionMaker: FuzzyDecisionMaker
  private dropBridge: DropBridge
  
  // AGC state (simple implementation)
  private agcGain: number = 1.0
  private agcPeakHold: number = 0.001
  
  // Current metrics
  private currentMetrics: ExtractedMetrics
  
  // Section tracking (simplified for calibration)
  private currentSection: MemorySectionType = 'intro'
  private sectionConfidence: number = 0.5
  private frameCount: number = 0
  private energyHistory: number[] = []
  
  constructor(config: Partial<BrainAdapterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    
    // Initialize components
    this.fftAnalyzer = new FFTAnalyzer()
    this.contextualMemory = new ContextualMemory()
    this.fuzzyDecisionMaker = new FuzzyDecisionMaker()
    this.dropBridge = new DropBridge()
    
    // Initialize metrics with zeros
    this.currentMetrics = this.createEmptyMetrics()
  }
  
  /**
   * Process a single audio buffer through the entire pipeline
   */
  processBuffer(buffer: Float32Array): void {
    this.frameCount++
    
    // Step 1: Calculate raw energy from buffer
    const { rawEnergy, peakLevel, rmsLevel } = this.calculateBufferEnergy(buffer)
    
    // Step 2: Apply AGC (simple implementation)
    const { normalizedEnergy, agcGain } = this.applyAGC(rawEnergy, peakLevel)
    
    // Step 3: FFT Analysis (only takes buffer, not sample rate)
    const spectrum = this.fftAnalyzer.analyze(buffer)
    
    // Step 4: Update section tracking (simplified heuristic)
    this.updateSection(normalizedEnergy, spectrum.bass)
    
    // Step 5: Contextual Memory - Get Z-Scores
    const contextOutput = this.contextualMemory.update({
      energy: normalizedEnergy,
      bass: spectrum.bass,
      harshness: spectrum.harshness,
      sectionType: this.currentSection,
      timestamp: Date.now(),
      hasTransient: spectrum.kickDetected
    })
    
    // Extract Z-Scores from the output
    const energyZScore = contextOutput.stats.energy.zScore
    const bassZScore = contextOutput.stats.bass.zScore
    const harshnessZScore = contextOutput.stats.harshness.zScore
    
    // Step 6: Fuzzy Decision (use mapped section type)
    // 🔋 WAVE 932: Pass neutral energyContext for calibration
    // (Calibration doesn't use real energy consciousness, just neutral values)
    const mappedSection = mapSectionType(this.currentSection)
    const fuzzyDecision = this.fuzzyDecisionMaker.evaluate({
      energy: normalizedEnergy,
      harshness: spectrum.harshness,
      zScore: energyZScore,
      sectionType: mappedSection,
      huntScore: 0.5, // Neutral for calibration
      beauty: 0.5,    // Neutral for calibration
      energyContext: createDefaultEnergyContext()  // 🔋 WAVE 932: Neutral context
    })
    
    // Step 7: Drop Bridge check
    const dropBridgeResult = this.dropBridge.check({
      energyZScore: energyZScore,
      sectionType: mappedSection,
      rawEnergy: normalizedEnergy,
      hasKick: spectrum.kickDetected
    })
    
    // Store all metrics
    this.currentMetrics = {
      rawEnergy,
      peakLevel,
      rmsLevel,
      normalizedEnergy,
      agcGain,
      bassEnergy: spectrum.bass,
      midEnergy: spectrum.mid,
      highEnergy: spectrum.treble,
      subBass: spectrum.subBass,
      spectralCentroid: spectrum.spectralCentroid,
      spectralFlatness: spectrum.spectralFlatness,
      harshness: spectrum.harshness,
      dominantFrequency: spectrum.dominantFrequency,
      kickDetected: spectrum.kickDetected,
      snareDetected: spectrum.snareDetected ?? false,
      energyZScore,
      bassZScore,
      harshnessZScore,
      fuzzyDecision,
      dropBridgeResult
    }
  }
  
  /**
   * Get current metrics for the CalibrationRunner
   */
  getMetrics() {
    const m = this.currentMetrics
    const fz = m.fuzzyDecision
    const db = m.dropBridgeResult
    
    return {
      rawEnergy: m.rawEnergy,
      normalizedEnergy: m.normalizedEnergy,
      agcGain: m.agcGain,
      bassEnergy: m.bassEnergy,
      midEnergy: m.midEnergy,
      highEnergy: m.highEnergy,
      spectralCentroid: m.spectralCentroid,
      spectralFlatness: m.spectralFlatness,
      harshness: m.harshness,
      energyZScore: m.energyZScore,
      bassZScore: m.bassZScore,
      brightnessZScore: m.harshnessZScore, // Map harshness to brightness for compatibility
      kickDetected: m.kickDetected,
      snareDetected: m.snareDetected,
      sectionType: this.currentSection,
      sectionConfidence: this.sectionConfidence,
      fuzzyAction: fz?.action ?? 'hold',
      fuzzyConfidence: fz?.confidence ?? 0,
      fuzzyReasoning: fz?.reasoning ?? '',
      dropBridgeTriggered: db?.shouldForceStrike ?? false,
      dropBridgeReason: db?.reason ?? ''
    }
  }
  
  /**
   * Reset all state between signals
   */
  reset(): void {
    this.frameCount = 0
    this.agcGain = 1.0
    this.agcPeakHold = 0.001
    this.currentSection = 'intro'
    this.sectionConfidence = 0.5
    this.energyHistory = []
    
    // Reset components
    this.contextualMemory.reset()
    this.fuzzyDecisionMaker.reset()
    this.dropBridge.reset()
    
    // Reset FFT analyzer
    this.fftAnalyzer.reset()
    
    // Reset metrics
    this.currentMetrics = this.createEmptyMetrics()
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Calculate energy metrics from raw buffer
   */
  private calculateBufferEnergy(buffer: Float32Array): {
    rawEnergy: number
    peakLevel: number
    rmsLevel: number
  } {
    let sumSquares = 0
    let peak = 0
    
    for (let i = 0; i < buffer.length; i++) {
      const sample = Math.abs(buffer[i])
      sumSquares += sample * sample
      if (sample > peak) peak = sample
    }
    
    const rmsLevel = Math.sqrt(sumSquares / buffer.length)
    
    // Raw energy is RMS normalized to 0-1 range
    // Typical audio has RMS around 0.1-0.3 for loud parts
    const rawEnergy = Math.min(1, rmsLevel * 3)
    
    return { rawEnergy, peakLevel: peak, rmsLevel }
  }
  
  /**
   * Apply Automatic Gain Control
   */
  private applyAGC(rawEnergy: number, peakLevel: number): {
    normalizedEnergy: number
    agcGain: number
  } {
    if (!this.config.agcEnabled) {
      return { normalizedEnergy: rawEnergy, agcGain: 1.0 }
    }
    
    // Update peak hold with decay
    const peakDecay = 0.995 // Slow decay
    this.agcPeakHold = Math.max(
      peakLevel,
      this.agcPeakHold * peakDecay
    )
    
    // Prevent division by zero
    const safePeak = Math.max(this.agcPeakHold, 0.001)
    
    // Calculate target gain
    const targetGain = this.config.agcTargetLevel / safePeak
    
    // Smooth gain changes
    const attackCoef = 1 - Math.exp(-1 / (this.config.agcAttackTime * this.config.sampleRate / this.config.bufferSize))
    const releaseCoef = 1 - Math.exp(-1 / (this.config.agcReleaseTime * this.config.sampleRate / this.config.bufferSize))
    
    if (targetGain < this.agcGain) {
      // Attack (fast)
      this.agcGain += (targetGain - this.agcGain) * attackCoef
    } else {
      // Release (slow)
      this.agcGain += (targetGain - this.agcGain) * releaseCoef
    }
    
    // Clamp gain
    this.agcGain = Math.max(0.1, Math.min(10, this.agcGain))
    
    // Apply gain and clamp output
    const normalizedEnergy = Math.min(1, rawEnergy * this.agcGain)
    
    return { normalizedEnergy, agcGain: this.agcGain }
  }
  
  /**
   * Simple section detection based on energy patterns
   */
  private updateSection(energy: number, bass: number): void {
    // Keep short energy history
    this.energyHistory.push(energy)
    if (this.energyHistory.length > 60) {
      this.energyHistory.shift()
    }
    
    // Need some history first
    if (this.energyHistory.length < 10) {
      return
    }
    
    // Calculate recent average
    const recentAvg = this.energyHistory.slice(-10).reduce((a, b) => a + b, 0) / 10
    const overallAvg = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length
    
    // Determine section based on energy patterns
    if (energy < 0.1 && recentAvg < 0.15) {
      // Very low energy = intro/outro
      this.currentSection = this.frameCount < 300 ? 'intro' : 'outro'
      this.sectionConfidence = 0.8
    } else if (energy > overallAvg * 1.5 && bass > 0.5) {
      // High energy with strong bass = drop
      this.currentSection = 'drop'
      this.sectionConfidence = 0.9
    } else if (energy > overallAvg * 1.2) {
      // Elevated energy = chorus
      this.currentSection = 'chorus'
      this.sectionConfidence = 0.7
    } else if (recentAvg > overallAvg * 0.8 && recentAvg < overallAvg * 1.2) {
      // Medium energy = verse
      this.currentSection = 'verse'
      this.sectionConfidence = 0.6
    } else if (recentAvg < overallAvg && this.isRisingTrend()) {
      // Rising trend from low = buildup
      this.currentSection = 'buildup'
      this.sectionConfidence = 0.7
    }
  }
  
  /**
   * Check if energy is trending upward
   */
  private isRisingTrend(): boolean {
    if (this.energyHistory.length < 20) return false
    
    const first10 = this.energyHistory.slice(-20, -10).reduce((a, b) => a + b, 0) / 10
    const last10 = this.energyHistory.slice(-10).reduce((a, b) => a + b, 0) / 10
    
    return last10 > first10 * 1.1
  }
  
  /**
   * Create empty metrics structure
   */
  private createEmptyMetrics(): ExtractedMetrics {
    return {
      rawEnergy: 0,
      peakLevel: 0,
      rmsLevel: 0,
      normalizedEnergy: 0,
      agcGain: 1.0,
      bassEnergy: 0,
      midEnergy: 0,
      highEnergy: 0,
      subBass: 0,
      spectralCentroid: 0,
      spectralFlatness: 0,
      harshness: 0,
      dominantFrequency: 0,
      kickDetected: false,
      snareDetected: false,
      energyZScore: 0,
      bassZScore: 0,
      harshnessZScore: 0,
      fuzzyDecision: null,
      dropBridgeResult: null
    }
  }
}
