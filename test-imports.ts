/**
 * Simple runner - compiles to JS first, then runs
 */

import { SignalGenerator } from './electron-app/src/core/calibration/SignalGenerator'
import { CalibrationRunner } from './electron-app/src/core/calibration/CalibrationRunner'
import { SeleneBrainAdapter } from './electron-app/src/core/calibration/SeleneBrainAdapter'

console.log('✅ Modules loaded successfully!')
console.log('  - SignalGenerator:', typeof SignalGenerator)
console.log('  - CalibrationRunner:', typeof CalibrationRunner)
console.log('  - SeleneBrainAdapter:', typeof SeleneBrainAdapter)

const generator = new SignalGenerator()
console.log('\n✅ SignalGenerator instantiated!')

const brain = new SeleneBrainAdapter()
console.log('✅ SeleneBrainAdapter instantiated!')

const runner = new CalibrationRunner()
console.log('✅ CalibrationRunner instantiated!')

console.log('\n🎯 All components work! Ready to run calibration.')
