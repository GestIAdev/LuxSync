/**
 * 🧪 GOD EAR VALIDATION TESTS
 * WAVE 1016 - Phase 1 Verification
 * 
 * Ejecutar con: npx ts-node test-god-ear.ts
 */

import { GodEarAnalyzer, verifySeparation, benchmarkPerformance } from './src/workers/GodEarFFT.js';

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('        🩻 GOD EAR VALIDATION TESTS - WAVE 1016 🩻');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

// ═══════════════════════════════════════════════════════════════
// TEST 1: LR4 Filter Separation
// ═══════════════════════════════════════════════════════════════
console.log('┌─────────────────────────────────────────────────────────────┐');
console.log('│ TEST 1: LINKWITZ-RILEY 4TH ORDER SEPARATION                │');
console.log('└─────────────────────────────────────────────────────────────┘');

const separationPassed = verifySeparation();
console.log('');

// ═══════════════════════════════════════════════════════════════
// TEST 2: Performance Benchmark
// ═══════════════════════════════════════════════════════════════
console.log('┌─────────────────────────────────────────────────────────────┐');
console.log('│ TEST 2: PERFORMANCE BENCHMARK                              │');
console.log('└─────────────────────────────────────────────────────────────┘');

benchmarkPerformance(100);
console.log('');

// ═══════════════════════════════════════════════════════════════
// TEST 3: Full Analysis Pipeline
// ═══════════════════════════════════════════════════════════════
console.log('┌─────────────────────────────────────────────────────────────┐');
console.log('│ TEST 3: FULL ANALYSIS PIPELINE                             │');
console.log('└─────────────────────────────────────────────────────────────┘');

const analyzer = new GodEarAnalyzer(44100, 4096);
console.log(`[TEST] Analyzer info: ${analyzer.getInfo()}`);

// Generate test signal: 50Hz + 1000Hz + 8000Hz (SubBass + Mid + Treble)
const sampleRate = 44100;
const fftSize = 4096;
const testBuffer = new Float32Array(fftSize);

for (let i = 0; i < fftSize; i++) {
  const t = i / sampleRate;
  // Mix of frequencies
  testBuffer[i] = 
    0.5 * Math.sin(2 * Math.PI * 50 * t) +   // SubBass (50Hz)
    0.3 * Math.sin(2 * Math.PI * 1000 * t) + // Mid (1kHz)
    0.2 * Math.sin(2 * Math.PI * 8000 * t);  // Treble (8kHz)
}

const result = analyzer.analyze(testBuffer);

console.log('[TEST] Analysis result for mixed signal (50Hz + 1kHz + 8kHz):');
console.log('');
console.log('  📊 BANDS (AGC processed):');
console.log(`     subBass:  ${(result.bands.subBass * 100).toFixed(1)}%`);
console.log(`     bass:     ${(result.bands.bass * 100).toFixed(1)}%`);
console.log(`     lowMid:   ${(result.bands.lowMid * 100).toFixed(1)}%`);
console.log(`     mid:      ${(result.bands.mid * 100).toFixed(1)}%`);
console.log(`     highMid:  ${(result.bands.highMid * 100).toFixed(1)}%`);
console.log(`     treble:   ${(result.bands.treble * 100).toFixed(1)}%`);
console.log(`     ultraAir: ${(result.bands.ultraAir * 100).toFixed(1)}%`);
console.log('');
console.log('  📊 BANDS (RAW - no AGC):');
console.log(`     subBass:  ${(result.bandsRaw.subBass * 100).toFixed(1)}%`);
console.log(`     bass:     ${(result.bandsRaw.bass * 100).toFixed(1)}%`);
console.log(`     lowMid:   ${(result.bandsRaw.lowMid * 100).toFixed(1)}%`);
console.log(`     mid:      ${(result.bandsRaw.mid * 100).toFixed(1)}%`);
console.log(`     highMid:  ${(result.bandsRaw.highMid * 100).toFixed(1)}%`);
console.log(`     treble:   ${(result.bandsRaw.treble * 100).toFixed(1)}%`);
console.log(`     ultraAir: ${(result.bandsRaw.ultraAir * 100).toFixed(1)}%`);
console.log('');
console.log('  🎯 SPECTRAL METRICS:');
console.log(`     Centroid:    ${result.spectral.centroid.toFixed(0)} Hz`);
console.log(`     Flatness:    ${result.spectral.flatness.toFixed(3)}`);
console.log(`     Rolloff:     ${result.spectral.rolloff.toFixed(0)} Hz`);
console.log(`     Crest Factor: ${result.spectral.crestFactor.toFixed(2)}`);
console.log(`     Clarity:     ${(result.spectral.clarity * 100).toFixed(1)}%`);
console.log('');
console.log('  ⚡ TRANSIENTS:');
console.log(`     Kick:   ${result.transients.kick ? '✅' : '❌'}`);
console.log(`     Snare:  ${result.transients.snare ? '✅' : '❌'}`);
console.log(`     HiHat:  ${result.transients.hihat ? '✅' : '❌'}`);
console.log(`     Strength: ${result.transients.strength.toFixed(2)}`);
console.log('');
console.log('  📝 METADATA:');
console.log(`     Frame:       ${result.meta.frameIndex}`);
console.log(`     Latency:     ${result.meta.processingLatencyMs.toFixed(2)} ms`);
console.log(`     Window:      ${result.meta.windowFunction}`);
console.log(`     Filter Order: ${result.meta.filterOrder}`);
console.log(`     Version:     ${result.meta.version}`);
console.log('');

// ═══════════════════════════════════════════════════════════════
// FINAL VERDICT
// ═══════════════════════════════════════════════════════════════
console.log('═══════════════════════════════════════════════════════════════');
console.log('                    🏆 FINAL VERDICT 🏆                        ');
console.log('═══════════════════════════════════════════════════════════════');

const latencyOK = result.meta.processingLatencyMs < 2.0;
const allTestsPassed = separationPassed && latencyOK;

console.log(`  LR4 Separation:  ${separationPassed ? '✅ PASS' : '❌ FAIL'}`);
console.log(`  Latency <2ms:    ${latencyOK ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

if (allTestsPassed) {
  console.log('  🩻💀 GOD EAR PHASE 1: CORE FFT - ✅ ALL TESTS PASSED 💀🩻');
  console.log('');
  console.log('  "We can now hear like gods."');
} else {
  console.log('  ⚠️ SOME TESTS FAILED - REVIEW IMPLEMENTATION');
}

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
