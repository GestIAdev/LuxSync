/**
 * 🔬 WAVE 2145.5: CLEAN Cooley-Tukey Radix-2 DIT — the simplest possible FFT
 * 
 * If THIS fails, there's something fundamentally wrong with my bit-reversal
 * or butterfly formulation. This is the textbook implementation, nothing fancy.
 */

function dft(re: Float32Array): { re: Float32Array, im: Float32Array } {
  const N = re.length;
  const outRe = new Float32Array(N);
  const outIm = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    let sRe = 0, sIm = 0;
    for (let n = 0; n < N; n++) {
      const angle = 2 * Math.PI * k * n / N;
      sRe += re[n] * Math.cos(angle);
      sIm += -re[n] * Math.sin(angle);
    }
    outRe[k] = sRe;
    outIm[k] = sIm;
  }
  return { re: outRe, im: outIm };
}

function bitReverse(n: number): Uint16Array {
  const bits = Math.log2(n) | 0;
  const table = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    let rev = 0, x = i;
    for (let b = 0; b < bits; b++) {
      rev = (rev << 1) | (x & 1);
      x >>= 1;
    }
    table[i] = rev;
  }
  return table;
}

/**
 * Classic Cooley-Tukey Radix-2 DIT FFT.
 * 
 * 1. Bit-reverse the input
 * 2. Bottom-up butterflies with twiddle factors
 * 
 * This is the most standard FFT implementation possible.
 */
function radix2DIT(samples: Float32Array, outRe: Float32Array, outIm: Float32Array): void {
  const N = samples.length;
  const br = bitReverse(N);
  
  // Bit-reverse copy
  for (let i = 0; i < N; i++) {
    outRe[i] = samples[br[i]];
    outIm[i] = 0;
  }
  
  // Bottom-up DIT stages
  for (let size = 2; size <= N; size <<= 1) {
    const halfSize = size >> 1;
    const twoPiOverSize = -2 * Math.PI / size; // negative for forward DFT
    
    for (let groupStart = 0; groupStart < N; groupStart += size) {
      for (let j = 0; j < halfSize; j++) {
        const angle = twoPiOverSize * j;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);
        
        const evenIdx = groupStart + j;
        const oddIdx = groupStart + j + halfSize;
        
        // Twiddle the odd element
        const tRe = wr * outRe[oddIdx] - wi * outIm[oddIdx];
        const tIm = wr * outIm[oddIdx] + wi * outRe[oddIdx];
        
        // Butterfly
        outRe[oddIdx] = outRe[evenIdx] - tRe;
        outIm[oddIdx] = outIm[evenIdx] - tIm;
        outRe[evenIdx] = outRe[evenIdx] + tRe;
        outIm[evenIdx] = outIm[evenIdx] + tIm;
      }
    }
  }
}

const RADIX2_TELEMETRY_INTERVAL_FRAMES = 60;

function getBandEnergy(
  outRe: Float32Array,
  outIm: Float32Array,
  sampleRate: number,
  fftSize: number,
  lowHz: number,
  highHz: number
): number {
  const nyquistBin = fftSize >> 1;
  const hzPerBin = sampleRate / fftSize;
  const startBin = Math.max(1, Math.floor(lowHz / hzPerBin));
  const endBin = Math.min(nyquistBin, Math.ceil(highHz / hzPerBin));

  if (endBin < startBin) return 0;

  let sum = 0;
  for (let k = startBin; k <= endBin; k++) {
    const mag2 = outRe[k] * outRe[k] + outIm[k] * outIm[k];
    sum += mag2;
  }

  return Math.sqrt(sum);
}

function getRawBands(
  outRe: Float32Array,
  outIm: Float32Array,
  sampleRate: number,
  fftSize: number
): { sub: number; bass: number; mid: number; highMid: number } {
  return {
    sub: getBandEnergy(outRe, outIm, sampleRate, fftSize, 20, 60),
    bass: getBandEnergy(outRe, outIm, sampleRate, fftSize, 60, 250),
    mid: getBandEnergy(outRe, outIm, sampleRate, fftSize, 500, 2000),
    highMid: getBandEnergy(outRe, outIm, sampleRate, fftSize, 2000, 6000),
  };
}

function logRadix2Raw(frame: number, bands: { sub: number; bass: number; mid: number; highMid: number }): void {
  if (frame % RADIX2_TELEMETRY_INTERVAL_FRAMES !== 0) return;

  const peak = Math.max(bands.sub, bands.bass, bands.mid, bands.highMid);
  console.log(
    `[RADIX2 RAW] Peak: ${peak.toFixed(6)} | Bands: ` +
    `sub=${bands.sub.toFixed(6)} bass=${bands.bass.toFixed(6)} ` +
    `mid=${bands.mid.toFixed(6)} highMid=${bands.highMid.toFixed(6)}`
  );
}

function runAgnosticFeedCalibrator(): void {
  const sampleRate = 44100;
  const fftSize = 4096;
  const amplitude = 0.6;
  const outRe = new Float32Array(fftSize);
  const outIm = new Float32Array(fftSize);

  const buildTone = (freqHz: number): Float32Array => {
    const tone = new Float32Array(fftSize);
    for (let n = 0; n < fftSize; n++) {
      tone[n] = amplitude * Math.sin(2 * Math.PI * freqHz * n / sampleRate);
    }
    return tone;
  };

  const tone60 = buildTone(60);
  const tone2500 = buildTone(2500);

  radix2DIT(tone60, outRe, outIm);
  const bands60 = getRawBands(outRe, outIm, sampleRate, fftSize);
  logRadix2Raw(60, bands60);

  radix2DIT(tone2500, outRe, outIm);
  const bands2500 = getRawBands(outRe, outIm, sampleRate, fftSize);
  logRadix2Raw(120, bands2500);

  console.log(
    `[RADIX2 TEST] 60Hz amp=0.6 => bass=${bands60.bass.toFixed(6)} ` +
    `highMid=${bands60.highMid.toFixed(6)}`
  );
  console.log(
    `[RADIX2 TEST] 2500Hz amp=0.6 => bass=${bands2500.bass.toFixed(6)} ` +
    `highMid=${bands2500.highMid.toFixed(6)}`
  );
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

function testFFT(signal: number[], label: string): boolean {
  const N = signal.length;
  const input = new Float32Array(signal);
  const outRe = new Float32Array(N);
  const outIm = new Float32Array(N);
  
  radix2DIT(input, outRe, outIm);
  const truth = dft(input);
  
  let maxErr = 0;
  for (let k = 0; k < N; k++) {
    const err = Math.max(
      Math.abs(outRe[k] - truth.re[k]),
      Math.abs(outIm[k] - truth.im[k])
    );
    if (err > maxErr) maxErr = err;
    
    if (N <= 8) {
      console.log(
        `  X[${k}]: FFT=(${outRe[k].toFixed(4)}, ${outIm[k].toFixed(4)}) ` +
        `DFT=(${truth.re[k].toFixed(4)}, ${truth.im[k].toFixed(4)}) ` +
        `err=${err.toExponential(2)}`
      );
    }
  }
  
  const tol = Math.max(N * 2e-5, 1e-3);
  const passed = maxErr < tol;
  console.log(`${label} (N=${N}): max_err=${maxErr.toExponential(3)} ${passed ? '✅' : '❌'}`);
  return passed;
}

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  CLASSIC RADIX-2 DIT FFT — GROUND TRUTH VERIFICATION       ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

let ok = true;
ok = testFFT([1, 2, 3, 4], 'Simple4') && ok;
ok = testFFT([1, 2, 3, 4, 5, 6, 7, 8], 'Simple8') && ok;

const imp16 = new Array(16).fill(0); imp16[0] = 1;
ok = testFFT(imp16, 'Impulse16') && ok;

ok = testFFT(new Array(64).fill(1), 'DC64') && ok;

for (const N of [64, 256, 1024, 4096]) {
  const sig: number[] = [];
  for (let n = 0; n < N; n++) sig.push(Math.cos(2 * Math.PI * 5 * n / N));
  ok = testFFT(sig, `Cosine_f5_N${N}`) && ok;
}

const mt4k: number[] = [];
for (let n = 0; n < 4096; n++) {
  mt4k.push(Math.cos(2*Math.PI*3*n/4096) + 0.5*Math.cos(2*Math.PI*100*n/4096));
}
ok = testFFT(mt4k, 'MultiTone4096') && ok;

console.log('\n--- Agnostic Feed Calibrator (60Hz vs 2500Hz @ amp=0.6) ---');
runAgnosticFeedCalibrator();

// Performance
console.log('\n--- Performance (N=4096) ---');
const perfBuf = new Float32Array(4096);
for (let n = 0; n < 4096; n++) perfBuf[n] = Math.sin(Math.PI * n * n / 4096);
const oR = new Float32Array(4096);
const oI = new Float32Array(4096);

for (let i = 0; i < 50; i++) radix2DIT(perfBuf, oR, oI);

const times: number[] = [];
for (let i = 0; i < 500; i++) {
  const t0 = performance.now();
  radix2DIT(perfBuf, oR, oI);
  times.push(performance.now() - t0);
}
const avg = times.reduce((a, b) => a + b) / times.length;
const minT = Math.min(...times);
const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
console.log(`  Avg: ${avg.toFixed(3)}ms | Min: ${minT.toFixed(3)}ms | P95: ${p95.toFixed(3)}ms`);

// Parseval
radix2DIT(perfBuf, oR, oI);
let tE = 0, fE = 0;
for (let n = 0; n < 4096; n++) tE += perfBuf[n] * perfBuf[n];
for (let k = 0; k < 4096; k++) fE += oR[k] * oR[k] + oI[k] * oI[k];
fE /= 4096;
console.log(`  Parseval: rel_err=${(Math.abs(tE - fE) / tE).toExponential(3)}`);

console.log(`\n${ok ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

// ═══════════════════════════════════════════════════════════════
// WAVE 8001: V3 PHASE 0 TESTS — LUT Parity + Power Spectrum + Parseval
// ═══════════════════════════════════════════════════════════════

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  WAVE 8001: V3 PHASE 0 — LUT PARITY + POWER SPECTRUM       ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// ─── Test 1: LUT Twiddle Factor Parity ───────────────────────────
// Compare FFT results using Math.cos/sin (hot-path) vs LUT pre-computed values.
// Tolerance: < 1e-5 (strict)

function initTwiddleLUT(n: number): { cos: Float32Array; sin: Float32Array } {
  const half = n >> 1;
  const cos = new Float32Array(half);
  const sin = new Float32Array(half);
  const step = -2 * Math.PI / n;
  for (let k = 0; k < half; k++) {
    cos[k] = Math.cos(step * k);
    sin[k] = Math.sin(step * k);
  }
  return { cos, sin };
}

function radix2DIT_LUT(
  samples: Float32Array,
  outRe: Float32Array,
  outIm: Float32Array,
  tw: { cos: Float32Array; sin: Float32Array }
): void {
  const N = samples.length;
  const br = bitReverse(N);

  for (let i = 0; i < N; i++) {
    outRe[i] = samples[br[i]];
    outIm[i] = 0;
  }

  for (let size = 2; size <= N; size <<= 1) {
    const halfSize = size >> 1;
    const stride = N / size;

    for (let groupStart = 0; groupStart < N; groupStart += size) {
      for (let j = 0; j < halfSize; j++) {
        const wr = tw.cos[j * stride];
        const wi = tw.sin[j * stride];

        const evenIdx = groupStart + j;
        const oddIdx = groupStart + j + halfSize;

        const tRe = wr * outRe[oddIdx] - wi * outIm[oddIdx];
        const tIm = wr * outIm[oddIdx] + wi * outRe[oddIdx];

        outRe[oddIdx] = outRe[evenIdx] - tRe;
        outIm[oddIdx] = outIm[evenIdx] - tIm;
        outRe[evenIdx] = outRe[evenIdx] + tRe;
        outIm[evenIdx] = outIm[evenIdx] + tIm;
      }
    }
  }
}

function testLUTParity(signal: number[], label: string): boolean {
  const N = signal.length;
  const input = new Float32Array(signal);
  const reHot = new Float32Array(N);
  const imHot = new Float32Array(N);
  const reLUT = new Float32Array(N);
  const imLUT = new Float32Array(N);

  radix2DIT(input, reHot, imHot);

  const tw = initTwiddleLUT(N);
  radix2DIT_LUT(input, reLUT, imLUT, tw);

  let maxErr = 0;
  for (let k = 0; k < N; k++) {
    const err = Math.max(
      Math.abs(reHot[k] - reLUT[k]),
      Math.abs(imHot[k] - imLUT[k])
    );
    if (err > maxErr) maxErr = err;
  }

  const TOL = 1e-5;
  const passed = maxErr < TOL;
  console.log(`LUT Parity ${label} (N=${N}): max_err=${maxErr.toExponential(3)} ${passed ? '✅' : '❌'}`);
  return passed;
}

let lutOk = true;
lutOk = testLUTParity([1, 2, 3, 4, 5, 6, 7, 8], 'Simple8') && lutOk;

const lutSig64: number[] = [];
for (let n = 0; n < 64; n++) lutSig64.push(Math.cos(2 * Math.PI * 3 * n / 64));
lutOk = testLUTParity(lutSig64, 'Cosine_f3_N64') && lutOk;

const lutSig256: number[] = [];
for (let n = 0; n < 256; n++) lutSig256.push(Math.sin(2 * Math.PI * 10 * n / 256) + 0.3 * Math.cos(2 * Math.PI * 50 * n / 256));
lutOk = testLUTParity(lutSig256, 'MultiTone_N256') && lutOk;

const lutSig4k: number[] = [];
for (let n = 0; n < 4096; n++) lutSig4k.push(Math.cos(2*Math.PI*3*n/4096) + 0.5*Math.cos(2*Math.PI*100*n/4096));
lutOk = testLUTParity(lutSig4k, 'MultiTone_N4096') && lutOk;

// ─── Test 2: Parseval's Theorem in Power Domain ──────────────────
// For DFT: Σ|x[n]|² = (1/N) Σ|X[k]|²
// In power domain: P[k] = |X[k]|², so Σ P[k] = N · Σ|x[n]|²
// We verify: Σ P[k] / N ≈ Σ |x[n]|²

console.log('\n--- Parseval in Power Domain (N=4096) ---');
const parseBuf = new Float32Array(4096);
for (let n = 0; n < 4096; n++) parseBuf[n] = Math.sin(Math.PI * n * n / 4096);
const pR = new Float32Array(4096);
const pI = new Float32Array(4096);
const tw4k = initTwiddleLUT(4096);
radix2DIT_LUT(parseBuf, pR, pI, tw4k);

let timeEnergy = 0;
for (let n = 0; n < 4096; n++) timeEnergy += parseBuf[n] * parseBuf[n];

let freqPowerSum = 0;
for (let k = 0; k < 4096; k++) freqPowerSum += pR[k] * pR[k] + pI[k] * pI[k];

const parsevalPower = freqPowerSum / 4096;
const parsevalErr = Math.abs(timeEnergy - parsevalPower) / timeEnergy;
console.log(`  Time energy:  ${timeEnergy.toExponential(6)}`);
console.log(`  Freq power/N: ${parsevalPower.toExponential(6)}`);
console.log(`  Rel error:    ${parsevalErr.toExponential(3)}`);
const parsevalPass = parsevalErr < 1e-5;
console.log(`  Parseval Power: ${parsevalPass ? '✅' : '❌'}`);

// ─── Test 3: Band Energy V2 (magnitude) vs V3 (power) Equivalence ─
// Verify that extractBandPower(power, mask) == extractBandEnergy(magnitude, mask)
// where power[k] = magnitude[k]² (same normalization).

console.log('\n--- Band Energy V2 (magnitude) vs V3 (power) Equivalence ---');

// Simulate magnitude spectrum and power spectrum
const N = 4096;
const numBins = N >> 1;
const testMag = new Float32Array(numBins + 1);
const testPow = new Float32Array(numBins + 1);

// Fill with a realistic spectrum: a few peaks + noise floor
for (let k = 0; k <= numBins; k++) {
  const val = 0.001 + 0.5 * Math.abs(Math.sin(k * 0.01)) + (k === 100 ? 0.8 : 0) + (k === 500 ? 0.6 : 0);
  testMag[k] = val;
  testPow[k] = val * val;
}

// V2 extractBandEnergy (magnitude domain)
function extractBandEnergyV2(magnitudes: Float32Array, mask: Float32Array): number {
  let energy = 0;
  let weightSum = 0;
  for (let bin = 0; bin < magnitudes.length && bin < mask.length; bin++) {
    const weight = mask[bin];
    if (weight > 0.001) {
      energy += magnitudes[bin] * magnitudes[bin] * weight;
      weightSum += weight;
    }
  }
  if (weightSum > 0) energy /= weightSum;
  return Math.sqrt(energy);
}

// V3 extractBandPower (power domain)
function extractBandPowerV3(power: Float32Array, mask: Float32Array): number {
  let energy = 0;
  let weightSum = 0;
  for (let bin = 0; bin < power.length && bin < mask.length; bin++) {
    const weight = mask[bin];
    if (weight > 0.001) {
      energy += power[bin] * weight;
      weightSum += weight;
    }
  }
  if (weightSum > 0) energy /= weightSum;
  return Math.sqrt(energy);
}

// Generate simple rectangular masks for testing (like LR4 but simpler)
function makeRectMask(start: number, end: number, len: number): Float32Array {
  const m = new Float32Array(len);
  for (let i = start; i <= end && i < len; i++) m[i] = 1.0;
  return m;
}

const bands = [
  { name: 'subBass', start: 2, end: 6 },    // ~20-60Hz
  { name: 'bass',    start: 6, end: 23 },   // ~60-250Hz
  { name: 'mid',     start: 46, end: 185 }, // ~500-2000Hz
  { name: 'treble',  start: 557, end: 1485 } // ~6-16kHz
];

let bandOk = true;
for (const band of bands) {
  const mask = makeRectMask(band.start, band.end, numBins + 1);
  const v2 = extractBandEnergyV2(testMag, mask);
  const v3 = extractBandPowerV3(testPow, mask);
  const err = Math.abs(v2 - v3);
  const relErr = v2 > 0 ? err / v2 : 0;
  const pass = relErr < 1e-5;
  console.log(`  ${band.name}: V2=${v2.toFixed(8)} V3=${v3.toFixed(8)} rel_err=${relErr.toExponential(3)} ${pass ? '✅' : '❌'}`);
  bandOk = bandOk && pass;
}

// ─── Test 4: LUT Performance Comparison ──────────────────────────
console.log('\n--- LUT vs Hot-Path Trig Performance (N=4096, 500 iterations) ---');
const perfLUT = new Float32Array(4096);
for (let n = 0; n < 4096; n++) perfLUT[n] = Math.sin(Math.PI * n * n / 4096);
const lR = new Float32Array(4096);
const lI = new Float32Array(4096);
const twPerf = initTwiddleLUT(4096);

// Warmup
for (let i = 0; i < 50; i++) {
  radix2DIT(perfLUT, lR, lI);
  radix2DIT_LUT(perfLUT, lR, lI, twPerf);
}

const hotTimes: number[] = [];
const lutTimes: number[] = [];
for (let i = 0; i < 500; i++) {
  let t0 = performance.now();
  radix2DIT(perfLUT, lR, lI);
  hotTimes.push(performance.now() - t0);

  t0 = performance.now();
  radix2DIT_LUT(perfLUT, lR, lI, twPerf);
  lutTimes.push(performance.now() - t0);
}

const hotAvg = hotTimes.reduce((a, b) => a + b) / hotTimes.length;
const lutAvg = lutTimes.reduce((a, b) => a + b) / lutTimes.length;
const speedup = (hotAvg / lutAvg - 1) * 100;
console.log(`  Hot-path trig: avg=${hotAvg.toFixed(3)}ms`);
console.log(`  LUT twiddle:   avg=${lutAvg.toFixed(3)}ms`);
console.log(`  Speedup:       ${speedup.toFixed(1)}% ${speedup > 0 ? '✅' : '⚠️'}`);

// ─── V3 Phase 0 Summary ──────────────────────────────────────────
const v3Pass = lutOk && parsevalPass && bandOk;
console.log(`\nWAVE 8001 Phase 0: ${v3Pass ? '✅ ALL V3 TESTS PASSED' : '❌ SOME V3 TESTS FAILED'}`);
console.log(`  LUT Parity:     ${lutOk ? '✅' : '❌'}`);
console.log(`  Parseval Power: ${parsevalPass ? '✅' : '❌'}`);
console.log(`  Band V2=V3:     ${bandOk ? '✅' : '❌'}`);
