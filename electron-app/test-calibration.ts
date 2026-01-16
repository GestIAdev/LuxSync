/**
 * 🔬 SELENE LAB - Full Calibration Suite Runner
 * 
 * Runs all synthetic signals through the brain pipeline
 */

import { SignalGenerator } from './src/core/calibration/SignalGenerator'
import { CalibrationRunner } from './src/core/calibration/CalibrationRunner'
import { SeleneBrainAdapter } from './src/core/calibration/SeleneBrainAdapter'
import {
  formatReportAsSummary,
  formatReportAsMarkdown
} from './src/core/calibration/CalibrationReport'
import * as fs from 'fs'
import * as path from 'path'

console.log('╔══════════════════════════════════════════════════════════════╗')
console.log('║            🔬 SELENE LAB - FULL CALIBRATION SUITE           ║')
console.log('║                                                              ║')
console.log('║  "Feed synthetic signals. Extract mathematical truth."      ║')
console.log('╠══════════════════════════════════════════════════════════════╣')
console.log('║  WAVE 670.5 - THE TRUTH EXTRACTOR                           ║')
console.log('╚══════════════════════════════════════════════════════════════╝')
console.log('')

// Configuration - shorter duration for faster testing
const config = {
  sampleRate: 44100,
  duration: 10,      // 10 seconds per signal (was 30)
  bufferSize: 2048,
}

console.log(`[Config] Sample Rate: ${config.sampleRate} Hz`)
console.log(`[Config] Duration: ${config.duration}s per signal`)
console.log(`[Config] Buffer Size: ${config.bufferSize}`)
console.log('')

// Create components
console.log('[Init] Creating Brain Adapter (REAL PIPELINE)...')
const brain = new SeleneBrainAdapter(config)

console.log('[Init] Creating Calibration Runner...')
const runner = new CalibrationRunner(config, 5) // Snapshot every 5 buffers

console.log('')
console.log('═══════════════════════════════════════════════════════════════')
console.log('  RUNNING CALIBRATION SUITE')
console.log('═══════════════════════════════════════════════════════════════')
console.log('')

// Run calibration
const startTime = Date.now()
const report = runner.runAllSignals(brain)
const elapsed = Date.now() - startTime

console.log('')
console.log(`[Done] Calibration completed in ${(elapsed / 1000).toFixed(1)}s`)
console.log('')

// Summary to console
console.log(formatReportAsSummary(report))
console.log('')

// Full markdown to file
const markdown = formatReportAsMarkdown(report)
const reportPath = path.join(__dirname, '..', 'docs', 'CALIBRATION-REPORT.md')

fs.writeFileSync(reportPath, markdown)
console.log(`[Output] Full report saved to: ${reportPath}`)

// Print recommendations
if (report.analysis.recommendations.length > 0) {
  console.log('')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  ⚠️  THRESHOLD RECOMMENDATIONS')
  console.log('═══════════════════════════════════════════════════════════════')
  for (const rec of report.analysis.recommendations) {
    console.log(`  • ${rec.parameter}:`)
    console.log(`      Current: ${rec.currentValue}`)
    console.log(`      Suggested: ${rec.suggestedValue.toFixed(4)}`)
    console.log(`      Reason: ${rec.reasoning}`)
    console.log('')
  }
} else {
  console.log('')
  console.log('✅ All thresholds within expected ranges!')
}

console.log('')
console.log('╔══════════════════════════════════════════════════════════════╗')
console.log('║  Calibration complete. Review the report for threshold       ║')
console.log('║  adjustments to make Selene\'s perception match reality.      ║')
console.log('╚══════════════════════════════════════════════════════════════╝')

