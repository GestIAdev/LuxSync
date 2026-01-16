/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║         CALIBRATION RUNNER - THE TRUTH EXTRACTOR              ║
 * ║                                                               ║
 * ║  "Feed synthetic signals. Record what the brain sees."        ║
 * ║                                                               ║
 * ║  No assertions. No expectations. Just cold, hard telemetry.   ║
 * ╚═══════════════════════════════════════════════════════════════╝
 * 
 * WAVE 670.5 - THE SELENE LAB
 * 
 * This runner feeds synthetic signals through the entire
 * Selene pipeline and records every internal metric.
 */

import { SignalGenerator, GeneratedSignal, SignalConfig } from './SignalGenerator'

// ============================================================
// METRIC SNAPSHOTS - What we observe at each moment
// ============================================================

export interface MetricSnapshot {
  timestamp: number           // Sample position
  bufferIndex: number         // Which buffer we're on
  
  // Raw metrics from AGC
  rawEnergy: number
  normalizedEnergy: number
  agcGain: number
  
  // Spectral analysis
  bassEnergy: number
  midEnergy: number
  highEnergy: number
  spectralCentroid: number
  spectralFlatness: number
  harshness: number
  
  // Contextual memory
  energyZScore: number
  bassZScore: number
  brightnessZScore: number
  
  // Detection states
  kickDetected: boolean
  snareDetected: boolean
  
  // Section classification
  sectionType: string
  sectionConfidence: number
  
  // Fuzzy outputs
  fuzzyAction: string
  fuzzyConfidence: number
  fuzzyReasoning: string
  
  // Drop bridge
  dropBridgeTriggered: boolean
  dropBridgeReason: string
}

export interface SignalReport {
  signalName: string
  description: string
  duration: number
  sampleRate: number
  buffersProcessed: number
  
  // Aggregate statistics
  stats: {
    energy: StatSummary
    harshness: StatSummary
    bassEnergy: StatSummary
    midEnergy: StatSummary
    highEnergy: StatSummary
    spectralFlatness: StatSummary
    energyZScore: StatSummary
  }
  
  // Peak moments
  peaks: {
    maxEnergy: MetricSnapshot
    maxHarshness: MetricSnapshot
    maxZScore: MetricSnapshot
    maxBass: MetricSnapshot
  }
  
  // Detection counts
  detections: {
    kickCount: number
    snareCount: number
    dropBridgeTriggers: number
    fuzzyStrikes: number
    fuzzyHolds: number
  }
  
  // Section distribution (% of time in each)
  sectionDistribution: Record<string, number>
  
  // Raw snapshots (for detailed analysis)
  snapshots: MetricSnapshot[]
}

export interface StatSummary {
  min: number
  max: number
  avg: number
  stdDev: number
  p10: number   // 10th percentile
  p50: number   // Median
  p90: number   // 90th percentile
}

export interface CalibrationReport {
  timestamp: string
  config: SignalConfig
  signals: SignalReport[]
  
  // Cross-signal analysis
  analysis: {
    // What energy level does silence produce?
    silenceBaseline: number
    
    // What's the max energy from techno kick?
    technoMaxEnergy: number
    
    // What's the max Z-Score from "The Drop"?
    dropMaxZScore: number
    
    // Harshness: White noise vs Techno
    whiteNoiseHarshness: number
    technoHarshness: number
    
    // Recommendations for threshold tuning
    recommendations: ThresholdRecommendation[]
  }
}

export interface ThresholdRecommendation {
  parameter: string
  currentValue: number
  suggestedValue: number
  reasoning: string
}

// ============================================================
// METRIC COLLECTOR - Adapter for the brain
// ============================================================

/**
 * Interface that the real brain components must implement
 * to be testable by the calibration suite
 */
export interface BrainMetricProvider {
  // Process a single buffer and return current state
  processBuffer(buffer: Float32Array): void
  
  // Get current metrics
  getMetrics(): {
    rawEnergy: number
    normalizedEnergy: number
    agcGain: number
    bassEnergy: number
    midEnergy: number
    highEnergy: number
    spectralCentroid: number
    spectralFlatness: number
    harshness: number
    energyZScore: number
    bassZScore: number
    brightnessZScore: number
    kickDetected: boolean
    snareDetected: boolean
    sectionType: string
    sectionConfidence: number
    fuzzyAction: string
    fuzzyConfidence: number
    fuzzyReasoning: string
    dropBridgeTriggered: boolean
    dropBridgeReason: string
  }
  
  // Reset state between signals
  reset(): void
}

// ============================================================
// CALIBRATION RUNNER
// ============================================================

export class CalibrationRunner {
  private signalGenerator: SignalGenerator
  private snapshotInterval: number // How many buffers between snapshots

  constructor(config: Partial<SignalConfig> = {}, snapshotInterval: number = 10) {
    this.signalGenerator = new SignalGenerator(config)
    this.snapshotInterval = snapshotInterval
  }

  /**
   * Run calibration on a single signal
   */
  runSignal(signal: GeneratedSignal, brain: BrainMetricProvider): SignalReport {
    brain.reset()
    
    const snapshots: MetricSnapshot[] = []
    let bufferIndex = 0
    let samplePosition = 0

    // Process each buffer
    for (const buffer of signal.buffers) {
      brain.processBuffer(buffer)
      
      // Take snapshot at intervals
      if (bufferIndex % this.snapshotInterval === 0) {
        const metrics = brain.getMetrics()
        snapshots.push({
          timestamp: samplePosition,
          bufferIndex,
          ...metrics
        })
      }
      
      bufferIndex++
      samplePosition += buffer.length
    }

    // Compute statistics
    return this.computeReport(signal, snapshots)
  }

  /**
   * Run calibration on all standard signals
   */
  runAllSignals(brain: BrainMetricProvider): CalibrationReport {
    const signals = this.signalGenerator.generateAllStandardSignals()
    const reports: SignalReport[] = []

    for (const signal of signals) {
      console.log(`[CalibrationRunner] Processing: ${signal.name}`)
      const report = this.runSignal(signal, brain)
      reports.push(report)
    }

    return this.generateCalibrationReport(reports, signals[0].config)
  }

  /**
   * Compute statistics from snapshots
   */
  private computeReport(signal: GeneratedSignal, snapshots: MetricSnapshot[]): SignalReport {
    const stats = {
      energy: this.computeStats(snapshots.map(s => s.normalizedEnergy)),
      harshness: this.computeStats(snapshots.map(s => s.harshness)),
      bassEnergy: this.computeStats(snapshots.map(s => s.bassEnergy)),
      midEnergy: this.computeStats(snapshots.map(s => s.midEnergy)),
      highEnergy: this.computeStats(snapshots.map(s => s.highEnergy)),
      spectralFlatness: this.computeStats(snapshots.map(s => s.spectralFlatness)),
      energyZScore: this.computeStats(snapshots.map(s => s.energyZScore))
    }

    // Find peak moments
    const maxEnergySnapshot = this.findMax(snapshots, s => s.normalizedEnergy)
    const maxHarshnessSnapshot = this.findMax(snapshots, s => s.harshness)
    const maxZScoreSnapshot = this.findMax(snapshots, s => Math.abs(s.energyZScore))
    const maxBassSnapshot = this.findMax(snapshots, s => s.bassEnergy)

    // Count detections
    const kickCount = snapshots.filter(s => s.kickDetected).length
    const snareCount = snapshots.filter(s => s.snareDetected).length
    const dropBridgeTriggers = snapshots.filter(s => s.dropBridgeTriggered).length
    const fuzzyStrikes = snapshots.filter(s => 
      s.fuzzyAction === 'strike' || s.fuzzyAction === 'force_strike'
    ).length
    const fuzzyHolds = snapshots.filter(s => s.fuzzyAction === 'hold').length

    // Section distribution
    const sectionCounts: Record<string, number> = {}
    for (const snapshot of snapshots) {
      sectionCounts[snapshot.sectionType] = (sectionCounts[snapshot.sectionType] || 0) + 1
    }
    const totalSnapshots = snapshots.length
    const sectionDistribution: Record<string, number> = {}
    for (const [section, count] of Object.entries(sectionCounts)) {
      sectionDistribution[section] = count / totalSnapshots
    }

    return {
      signalName: signal.name,
      description: signal.description,
      duration: signal.config.duration,
      sampleRate: signal.config.sampleRate,
      buffersProcessed: signal.buffers.length,
      stats,
      peaks: {
        maxEnergy: maxEnergySnapshot,
        maxHarshness: maxHarshnessSnapshot,
        maxZScore: maxZScoreSnapshot,
        maxBass: maxBassSnapshot
      },
      detections: {
        kickCount,
        snareCount,
        dropBridgeTriggers,
        fuzzyStrikes,
        fuzzyHolds
      },
      sectionDistribution,
      snapshots
    }
  }

  /**
   * Compute statistical summary
   */
  private computeStats(values: number[]): StatSummary {
    if (values.length === 0) {
      return { min: 0, max: 0, avg: 0, stdDev: 0, p10: 0, p50: 0, p90: 0 }
    }

    const sorted = [...values].sort((a, b) => a - b)
    const sum = values.reduce((a, b) => a + b, 0)
    const avg = sum / values.length
    
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2))
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length
    const stdDev = Math.sqrt(variance)

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg,
      stdDev,
      p10: sorted[Math.floor(values.length * 0.1)],
      p50: sorted[Math.floor(values.length * 0.5)],
      p90: sorted[Math.floor(values.length * 0.9)]
    }
  }

  /**
   * Find snapshot with maximum value
   */
  private findMax(snapshots: MetricSnapshot[], getter: (s: MetricSnapshot) => number): MetricSnapshot {
    let maxSnapshot = snapshots[0]
    let maxValue = getter(maxSnapshot)

    for (const snapshot of snapshots) {
      const value = getter(snapshot)
      if (value > maxValue) {
        maxValue = value
        maxSnapshot = snapshot
      }
    }

    return maxSnapshot
  }

  /**
   * Generate cross-signal analysis report
   */
  private generateCalibrationReport(reports: SignalReport[], config: SignalConfig): CalibrationReport {
    // Find specific signals
    const silence = reports.find(r => r.signalName === 'SILENCE')
    const techno = reports.find(r => r.signalName.includes('TECHNO_KICK'))
    const whiteNoise = reports.find(r => r.signalName === 'WHITE_NOISE')
    const drop = reports.find(r => r.signalName === 'THE_DROP')

    const recommendations: ThresholdRecommendation[] = []

    // Analyze silence baseline
    const silenceBaseline = silence?.stats.energy.avg ?? 0
    if (silenceBaseline > 0.05) {
      recommendations.push({
        parameter: 'SILENCE_THRESHOLD',
        currentValue: 0.01,
        suggestedValue: silenceBaseline * 1.5,
        reasoning: `Silence produces ${silenceBaseline.toFixed(3)} energy. Threshold should be above this.`
      })
    }

    // Analyze Z-Score from drop
    const dropMaxZScore = drop?.stats.energyZScore.max ?? 0
    if (dropMaxZScore < 3.0) {
      recommendations.push({
        parameter: 'EPIC_ZSCORE_THRESHOLD',
        currentValue: 3.0,
        suggestedValue: dropMaxZScore * 0.85,
        reasoning: `"The Drop" only reaches Z-Score of ${dropMaxZScore.toFixed(2)}. Threshold should be lower to detect epic moments.`
      })
    }

    // Harshness comparison
    const technoHarshness = techno?.stats.harshness.avg ?? 0
    const whiteNoiseHarshness = whiteNoise?.stats.harshness.avg ?? 0
    
    if (whiteNoiseHarshness < technoHarshness * 1.5) {
      recommendations.push({
        parameter: 'HARSHNESS_DETECTION',
        currentValue: 0.5,
        suggestedValue: (technoHarshness + whiteNoiseHarshness) / 2,
        reasoning: `White noise (${whiteNoiseHarshness.toFixed(2)}) should be much harsher than techno (${technoHarshness.toFixed(2)}). Check harshness algorithm.`
      })
    }

    return {
      timestamp: new Date().toISOString(),
      config,
      signals: reports,
      analysis: {
        silenceBaseline,
        technoMaxEnergy: techno?.stats.energy.max ?? 0,
        dropMaxZScore,
        whiteNoiseHarshness,
        technoHarshness,
        recommendations
      }
    }
  }
}

export default CalibrationRunner
