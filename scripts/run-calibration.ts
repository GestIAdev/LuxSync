#!/usr/bin/env ts-node
/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║           SELENE LAB - CALIBRATION CLI                        ║
 * ║                                                               ║
 * ║  WAVE 670.5 - RUN THE TRUTH EXTRACTOR                         ║
 * ║                                                               ║
 * ║  Usage:                                                       ║
 * ║    npx ts-node scripts/run-calibration.ts                     ║
 * ║    npx ts-node scripts/run-calibration.ts --output report.md  ║
 * ║    npx ts-node scripts/run-calibration.ts --json              ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import * as fs from 'fs'
import * as path from 'path'

import {
  SignalGenerator,
  CalibrationRunner,
  SeleneBrainAdapter,
  formatReportAsMarkdown,
  formatReportAsJSON,
  formatReportAsSummary,
} from '../electron-app/src/core/calibration'

// Parse CLI arguments
const args = process.argv.slice(2)
const outputPath = args.includes('--output') 
  ? args[args.indexOf('--output') + 1]
  : null
const jsonOutput = args.includes('--json')
const verbose = args.includes('--verbose') || args.includes('-v')

console.log('╔══════════════════════════════════════════════════════════════╗')
console.log('║            🔬 SELENE LAB - CALIBRATION SUITE                ║')
console.log('║                                                              ║')
console.log('║  "Feed synthetic signals. Extract mathematical truth."      ║')
console.log('╠══════════════════════════════════════════════════════════════╣')
console.log('║  WAVE 670.5 - THE TRUTH EXTRACTOR                           ║')
console.log('╚══════════════════════════════════════════════════════════════╝')
console.log('')

// Configuration
const config = {
  sampleRate: 44100,
  duration: 30,      // 30 seconds per signal
  bufferSize: 2048,  // FFT window size
}

console.log(`[Config] Sample Rate: ${config.sampleRate} Hz`)
console.log(`[Config] Duration: ${config.duration}s per signal`)
console.log(`[Config] Buffer Size: ${config.bufferSize}`)
console.log('')

// Create components
console.log('[Init] Creating Signal Generator...')
const signalGenerator = new SignalGenerator(config)

console.log('[Init] Creating Calibration Runner...')
const runner = new CalibrationRunner(config, 10) // Snapshot every 10 buffers

console.log('[Init] Creating Brain Adapter (REAL PIPELINE)...')
const brain = new SeleneBrainAdapter({
  sampleRate: config.sampleRate,
  bufferSize: config.bufferSize,
})

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

// Output results
if (jsonOutput) {
  const json = formatReportAsJSON(report)
  if (outputPath) {
    fs.writeFileSync(outputPath, json)
    console.log(`[Output] JSON report saved to: ${outputPath}`)
  } else {
    console.log(json)
  }
} else {
  // Summary to console
  console.log(formatReportAsSummary(report))
  console.log('')
  
  // Full markdown to file
  const markdown = formatReportAsMarkdown(report)
  const defaultPath = path.join(__dirname, '..', 'docs', 'CALIBRATION-REPORT.md')
  const finalPath = outputPath || defaultPath
  
  fs.writeFileSync(finalPath, markdown)
  console.log(`[Output] Full report saved to: ${finalPath}`)
}

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
}

console.log('')
console.log('╔══════════════════════════════════════════════════════════════╗')
console.log('║  Calibration complete. Review the report for threshold       ║')
console.log('║  adjustments to make Selene\'s perception match reality.      ║')
console.log('╚══════════════════════════════════════════════════════════════╝')
