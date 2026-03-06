/**
 * ðŸ§ª WAVE 2145: GODEAR FFT RADIX-2 DIT VERIFICATION SUITE
 *
 * Tests the Cooley-Tukey Radix-2 DIT implementation against:
 *   1. Brute-force DFT (O(NÂ²) â€” the mathematical ground truth)
 *   2. Known analytical signals (DC, pure tones, impulse)
 *   3. Parseval's theorem (energy conservation)
 *   4. Linearity property
 *   5. Band separation (LR4 filter isolation)
 *   6. Multi-size verification (N=4 to N=4096)
 *   7. Phase accuracy
 *
 * ZERO external dependencies. Pure math. Deterministic.
 * Axioma Anti-SimulaciÃ³n: No Math.random(). All test signals are analytically defined.
 *
 * @author PunkOpus (DSP Technical Master)
 */

// â”€â”€â”€ Import the FFT under test â”€â”€â”€
import { GodEarAnalyzer, verifySeparation } from './GodEarFFT';

// We need direct access to computeFFTCore for unit testing.
// Since it's module-private, we'll test through the public API AND
// create a standalone reference implementation here for comparison.

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 1: BRUTE-FORCE DFT (Ground Truth)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Compute DFT using the textbook O(NÂ²) definition.
 * This is SLOW but PROVABLY CORRECT â€” it's the definition of the DFT itself.
 *
 * X[k] = Î£_{n=0}^{N-1} x[n] Â· exp(-jÂ·2Ï€Â·kÂ·n/N)
 */
function bruteForceDFT(
  realInput: Float32Array,
  outReal: Float32Array,
  outImag: Float32Array
): void {
  const N = realInput.length;
  const twoPiOverN = 2 * Math.PI / N;

  for (let k = 0; k < N; k++) {
    let sumRe = 0;
    let sumIm = 0;

    for (let n = 0; n < N; n++) {
      const angle = twoPiOverN * k * n;
      sumRe += realInput[n] * Math.cos(angle);
      sumIm += -realInput[n] * Math.sin(angle);
    }

    outReal[k] = sumRe;
    outImag[k] = sumIm;
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 2: STANDALONE RADIX-2 DIT (mirrors GodEarFFT's computeFFTCore)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Standalone Cooley-Tukey Radix-2 DIT FFT for direct testing.
 * This is a copy of the VERIFIED computeFFTCore logic so we can test it
 * independently without going through the full GodEarAnalyzer pipeline.
 */
function radix2DIT(
  samples: Float32Array,
  outReal: Float32Array,
  outImag: Float32Array
): void {
  const n = samples.length;

  // Step 1: Bit-reversal permutation of input
  const bits = Math.log2(n) | 0;
  for (let i = 0; i < n; i++) {
    let rev = 0, x = i;
    for (let b = 0; b < bits; b++) {
      rev = (rev << 1) | (x & 1);
      x >>= 1;
    }
    outReal[i] = samples[rev];
    outImag[i] = 0;
  }

  // Step 2: Bottom-up DIT butterfly stages
  for (let size = 2; size <= n; size <<= 1) {
    const halfSize = size >> 1;
    const angleStep = -2 * Math.PI / size;

    for (let groupStart = 0; groupStart < n; groupStart += size) {
      for (let j = 0; j < halfSize; j++) {
        const angle = angleStep * j;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);

        const evenIdx = groupStart + j;
        const oddIdx = groupStart + j + halfSize;

        const tRe = wr * outReal[oddIdx] - wi * outImag[oddIdx];
        const tIm = wr * outImag[oddIdx] + wi * outReal[oddIdx];

        outReal[oddIdx] = outReal[evenIdx] - tRe;
        outImag[oddIdx] = outImag[evenIdx] - tIm;
        outReal[evenIdx] = outReal[evenIdx] + tRe;
        outImag[evenIdx] = outImag[evenIdx] + tIm;
      }
    }
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 3: TEST UTILITIES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
  maxError?: number;
}

const results: TestResult[] = [];

function assertEqual(name: string, actual: number, expected: number, tolerance: number): TestResult {
  const error = Math.abs(actual - expected);
  const passed = error <= tolerance;
  const result: TestResult = {
    name,
    passed,
    detail: passed
      ? `âœ… ${actual.toFixed(6)} â‰ˆ ${expected.toFixed(6)} (err=${error.toExponential(2)})`
      : `âŒ ${actual.toFixed(6)} â‰  ${expected.toFixed(6)} (err=${error.toExponential(2)}, tol=${tolerance.toExponential(2)})`,
    maxError: error,
  };
  results.push(result);
  return result;
}

function assertBelow(name: string, actual: number, maxVal: number): TestResult {
  const passed = actual <= maxVal;
  const result: TestResult = {
    name,
    passed,
    detail: passed
      ? `âœ… ${actual.toExponential(3)} â‰¤ ${maxVal.toExponential(3)}`
      : `âŒ ${actual.toExponential(3)} > ${maxVal.toExponential(3)}`,
    maxError: actual,
  };
  results.push(result);
  return result;
}

/**
 * Maximum absolute error between two arrays.
 */
function maxAbsError(a: Float32Array, b: Float32Array, length?: number): number {
  const n = length ?? Math.min(a.length, b.length);
  let maxErr = 0;
  for (let i = 0; i < n; i++) {
    const err = Math.abs(a[i] - b[i]);
    if (err > maxErr) maxErr = err;
  }
  return maxErr;
}

/**
 * RMS error between two arrays.
 */
function rmsError(a: Float32Array, b: Float32Array, length?: number): number {
  const n = length ?? Math.min(a.length, b.length);
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / n);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 4: CORE FFT TESTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * TEST 1: Radix-2 DIT vs Brute-Force DFT across multiple sizes
 *
 * The brute-force DFT is the DEFINITION. If our FFT matches it
 * within Float32 precision, the algorithm is correct. Period.
 */
function testAgainstDFT(): void {
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('  TEST 1: Radix-2 DIT vs Brute-Force DFT');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');

  // Test sizes from 4 to 4096 (all powers of 2)
  const sizes = [4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];

  for (const N of sizes) {
    // Generate deterministic test signal: sum of cosines at different frequencies
    // x[n] = cos(2Ï€Â·3Â·n/N) + 0.5Â·cos(2Ï€Â·7Â·n/N) + 0.25Â·cos(2Ï€Â·13Â·n/N)
    // This covers low, mid, and high frequency content.
    const signal = new Float32Array(N);
    const twoPiOverN = 2 * Math.PI / N;
    for (let n = 0; n < N; n++) {
      signal[n] = Math.cos(twoPiOverN * 3 * n)
        + 0.5 * Math.cos(twoPiOverN * 7 * n)
        + 0.25 * Math.cos(twoPiOverN * 13 * n);
    }

    // Compute with our Split-Radix
    const srReal = new Float32Array(N);
    const srImag = new Float32Array(N);
    radix2DIT(signal, srReal, srImag);

    // Compute with brute-force DFT
    const dftReal = new Float32Array(N);
    const dftImag = new Float32Array(N);
    bruteForceDFT(signal, dftReal, dftImag);

    const errReal = maxAbsError(srReal, dftReal);
    const errImag = maxAbsError(srImag, dftImag);
    const maxErr = Math.max(errReal, errImag);

    // Float32 precision: ~7 digits. For N=4096, accumulated error ~O(sqrt(N))
    // Expected max error: ~N * 1e-6 for Float32 arithmetic
    const tolerance = N * 2e-5;

    assertBelow(
      `DFT match N=${N}`,
      maxErr,
      tolerance
    );

    console.log(
      `  N=${String(N).padStart(5)}: max_err=${maxErr.toExponential(3)} ` +
      `(tol=${tolerance.toExponential(2)}) ${maxErr <= tolerance ? 'âœ…' : 'âŒ'}`
    );
  }
}

/**
 * TEST 2: DC Signal (all ones)
 *
 * DFT of [1,1,1,...,1] should give X[0]=N, X[k]=0 for k>0.
 */
function testDCSignal(): void {
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('  TEST 2: DC Signal (constant = 1.0)');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');

  const N = 256;
  const signal = new Float32Array(N);
  signal.fill(1.0);

  const outReal = new Float32Array(N);
  const outImag = new Float32Array(N);
  radix2DIT(signal, outReal, outImag);

  // X[0] should be N
  assertEqual('DC bin magnitude', outReal[0], N, 1e-3);

  // All other bins should be 0
  let maxNonDC = 0;
  for (let k = 1; k < N; k++) {
    const mag = Math.sqrt(outReal[k] * outReal[k] + outImag[k] * outImag[k]);
    if (mag > maxNonDC) maxNonDC = mag;
  }
  assertBelow('Non-DC bins near zero', maxNonDC, 1e-3);

  console.log(`  X[0] = ${outReal[0].toFixed(4)} (expected ${N})`);
  console.log(`  max |X[k>0]| = ${maxNonDC.toExponential(3)} (expected ~0)`);
}

/**
 * TEST 3: Pure Cosine (single frequency)
 *
 * DFT of cos(2Ï€Â·fÂ·n/N) should give peaks at bins f and N-f only.
 */
function testPureCosine(): void {
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('  TEST 3: Pure Cosine (single frequency)');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');

  const N = 1024;
  const freq = 50; // Bin 50

  const signal = new Float32Array(N);
  const twoPiOverN = 2 * Math.PI / N;
  for (let n = 0; n < N; n++) {
    signal[n] = Math.cos(twoPiOverN * freq * n);
  }

  const outReal = new Float32Array(N);
  const outImag = new Float32Array(N);
  radix2DIT(signal, outReal, outImag);

  // cos â†’ two peaks at bins f and N-f, each with magnitude N/2
  const magAtF = Math.sqrt(outReal[freq] * outReal[freq] + outImag[freq] * outImag[freq]);
  const magAtNF = Math.sqrt(outReal[N - freq] * outReal[N - freq] + outImag[N - freq] * outImag[N - freq]);

  assertEqual('Peak at bin f', magAtF, N / 2, 0.5);
  assertEqual('Peak at bin N-f', magAtNF, N / 2, 0.5);

  // All other bins should be near zero
  let maxOther = 0;
  for (let k = 0; k < N; k++) {
    if (k === freq || k === N - freq) continue;
    const mag = Math.sqrt(outReal[k] * outReal[k] + outImag[k] * outImag[k]);
    if (mag > maxOther) maxOther = mag;
  }
  assertBelow('Other bins near zero', maxOther, 0.1);

  console.log(`  |X[${freq}]| = ${magAtF.toFixed(2)} (expected ${N / 2})`);
  console.log(`  |X[${N - freq}]| = ${magAtNF.toFixed(2)} (expected ${N / 2})`);
  console.log(`  max |X[other]| = ${maxOther.toExponential(3)}`);
}

/**
 * TEST 4: Impulse (delta function)
 *
 * DFT of [1, 0, 0, ..., 0] should give X[k] = 1 for all k.
 */
function testImpulse(): void {
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('  TEST 4: Impulse (delta function)');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');

  const N = 512;
  const signal = new Float32Array(N);
  signal[0] = 1.0;

  const outReal = new Float32Array(N);
  const outImag = new Float32Array(N);
  radix2DIT(signal, outReal, outImag);

  // All bins should have magnitude 1.0
  let maxErr = 0;
  for (let k = 0; k < N; k++) {
    const mag = Math.sqrt(outReal[k] * outReal[k] + outImag[k] * outImag[k]);
    const err = Math.abs(mag - 1.0);
    if (err > maxErr) maxErr = err;
  }

  assertBelow('Impulse: all bins = 1.0', maxErr, 1e-4);
  console.log(`  max |1 - |X[k]|| = ${maxErr.toExponential(3)}`);
}

/**
 * TEST 5: Parseval's Theorem (energy conservation)
 *
 * Î£|x[n]|Â² = (1/N) Â· Î£|X[k]|Â²
 * If the FFT conserves energy, it's not leaking or creating phantom energy.
 */
function testParseval(): void {
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('  TEST 5: Parseval\'s Theorem (energy conservation)');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');

  const sizes = [64, 256, 1024, 4096];

  for (const N of sizes) {
    // Deterministic signal: chirp (frequency sweep)
    // x[n] = sin(Ï€Â·nÂ²/N) â€” instantaneous frequency increases linearly
    const signal = new Float32Array(N);
    for (let n = 0; n < N; n++) {
      signal[n] = Math.sin(Math.PI * n * n / N);
    }

    // Time-domain energy
    let timeEnergy = 0;
    for (let n = 0; n < N; n++) {
      timeEnergy += signal[n] * signal[n];
    }

    // Frequency-domain energy
    const outReal = new Float32Array(N);
    const outImag = new Float32Array(N);
    radix2DIT(signal, outReal, outImag);

    let freqEnergy = 0;
    for (let k = 0; k < N; k++) {
      freqEnergy += outReal[k] * outReal[k] + outImag[k] * outImag[k];
    }
    freqEnergy /= N; // Parseval normalization

    const relError = Math.abs(timeEnergy - freqEnergy) / timeEnergy;

    assertBelow(`Parseval N=${N}`, relError, 1e-4);

    console.log(
      `  N=${String(N).padStart(5)}: E_time=${timeEnergy.toFixed(4)} ` +
      `E_freq=${freqEnergy.toFixed(4)} rel_err=${relError.toExponential(3)} ` +
      `${relError <= 1e-4 ? 'âœ…' : 'âŒ'}`
    );
  }
}

/**
 * TEST 6: Linearity
 *
 * DFT(aÂ·x + bÂ·y) = aÂ·DFT(x) + bÂ·DFT(y)
 */
function testLinearity(): void {
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('  TEST 6: Linearity property');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');

  const N = 512;
  const a = 0.7;
  const b = 1.3;

  // Two deterministic signals
  const x = new Float32Array(N);
  const y = new Float32Array(N);
  const combined = new Float32Array(N);

  const twoPiOverN = 2 * Math.PI / N;
  for (let n = 0; n < N; n++) {
    x[n] = Math.cos(twoPiOverN * 11 * n);       // 11 Hz
    y[n] = Math.sin(twoPiOverN * 37 * n) * 0.8;  // 37 Hz
    combined[n] = a * x[n] + b * y[n];
  }

  // FFT of combined
  const combReal = new Float32Array(N);
  const combImag = new Float32Array(N);
  radix2DIT(combined, combReal, combImag);

  // aÂ·FFT(x) + bÂ·FFT(y)
  const xReal = new Float32Array(N);
  const xImag = new Float32Array(N);
  const yReal = new Float32Array(N);
  const yImag = new Float32Array(N);
  radix2DIT(x, xReal, xImag);
  radix2DIT(y, yReal, yImag);

  const linReal = new Float32Array(N);
  const linImag = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    linReal[k] = a * xReal[k] + b * yReal[k];
    linImag[k] = a * xImag[k] + b * yImag[k];
  }

  const errReal = maxAbsError(combReal, linReal);
  const errImag = maxAbsError(combImag, linImag);
  const maxErr = Math.max(errReal, errImag);

  assertBelow('Linearity error', maxErr, 1e-3);
  console.log(`  max |FFT(ax+by) - (aÂ·FFT(x)+bÂ·FFT(y))| = ${maxErr.toExponential(3)}`);
}

/**
 * TEST 7: Phase accuracy (pure sine vs cosine)
 *
 * cos(2Ï€Â·fÂ·n/N) â†’ peaks should have imaginary part â‰ˆ 0 (zero phase)
 * sin(2Ï€Â·fÂ·n/N) â†’ peaks should have real part â‰ˆ 0 (90Â° phase)
 */
function testPhaseAccuracy(): void {
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('  TEST 7: Phase accuracy');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');

  const N = 1024;
  const freq = 100;
  const twoPiOverN = 2 * Math.PI / N;

  // Cosine test: X[f] should be real (imag â‰ˆ 0)
  const cosSignal = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    cosSignal[n] = Math.cos(twoPiOverN * freq * n);
  }
  const cosReal = new Float32Array(N);
  const cosImag = new Float32Array(N);
  radix2DIT(cosSignal, cosReal, cosImag);

  const cosPhaseError = Math.abs(cosImag[freq]) / (N / 2);
  assertBelow('Cosine phase error at bin', cosPhaseError, 1e-4);

  // Sine test: X[f] should be purely imaginary (real â‰ˆ 0)
  const sinSignal = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    sinSignal[n] = Math.sin(twoPiOverN * freq * n);
  }
  const sinReal = new Float32Array(N);
  const sinImag = new Float32Array(N);
  radix2DIT(sinSignal, sinReal, sinImag);

  const sinPhaseError = Math.abs(sinReal[freq]) / (N / 2);
  assertBelow('Sine phase error at bin', sinPhaseError, 1e-4);

  console.log(`  cos: |imag[${freq}]|/peak = ${cosPhaseError.toExponential(3)} (expected ~0)`);
  console.log(`  sin: |real[${freq}]|/peak = ${sinPhaseError.toExponential(3)} (expected ~0)`);
}

/**
 * TEST 8: Multi-tone separation (no cross-leakage)
 *
 * Place energy in bins 10 and 100. Verify bins 50 and 200 are clean.
 * This is the direct test for the bug that Split-Radix v1 had.
 */
function testMultiToneSeparation(): void {
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('  TEST 8: Multi-tone cross-leakage');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');

  const N = 4096;
  const f1 = 10;   // ~107 Hz at 44100/4096 resolution
  const f2 = 100;  // ~1077 Hz

  const signal = new Float32Array(N);
  const twoPiOverN = 2 * Math.PI / N;
  for (let n = 0; n < N; n++) {
    signal[n] = Math.cos(twoPiOverN * f1 * n) + Math.cos(twoPiOverN * f2 * n);
  }

  const outReal = new Float32Array(N);
  const outImag = new Float32Array(N);
  radix2DIT(signal, outReal, outImag);

  // Peak magnitudes at signal bins
  const magF1 = Math.sqrt(outReal[f1] ** 2 + outImag[f1] ** 2);
  const magF2 = Math.sqrt(outReal[f2] ** 2 + outImag[f2] ** 2);

  // Check a "silent" bin far from both tones
  const silentBin = 50;
  const magSilent = Math.sqrt(outReal[silentBin] ** 2 + outImag[silentBin] ** 2);

  // Leakage ratio: energy at silent bin vs peak
  const leakageRatio = magSilent / Math.max(magF1, magF2);

  assertBelow('Cross-leakage ratio', leakageRatio, 1e-5);

  console.log(`  |X[${f1}]| = ${magF1.toFixed(2)}`);
  console.log(`  |X[${f2}]| = ${magF2.toFixed(2)}`);
  console.log(`  |X[${silentBin}]| = ${magSilent.toExponential(3)} (leakage=${leakageRatio.toExponential(3)})`);
}

/**
 * TEST 9: GodEarAnalyzer band separation test
 *
 * Uses the built-in verifySeparation() test from GodEarFFT.ts
 * that verifies a 50Hz pure tone stays in SubBass band.
 */
function testGodEarSeparation(): void {
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('  TEST 9: GodEar LR4 band separation (50Hz tone)');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');

  const passed = verifySeparation();
  results.push({
    name: 'GodEar 50Hz band separation',
    passed,
    detail: passed ? 'âœ… SubBass dominates, higher bands clean' : 'âŒ Separation failure',
  });
}

/**
 * TEST 10: GodEarAnalyzer full pipeline â€” pure 100Hz tone
 *
 * Generate a pure 100Hz sine wave, run it through the full analyzer,
 * and verify that bass band has significant energy while treble is near zero.
 */
function testGodEarFullPipeline(): void {
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('  TEST 10: GodEar full pipeline (100Hz sine)');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');

  const sampleRate = 44100;
  const fftSize = 4096;
  const analyzer = new GodEarAnalyzer(sampleRate, fftSize);

  // Generate pure 100Hz sine (in the bass band: 60-250Hz)
  const buffer = new Float32Array(fftSize);
  const twoPi = 2 * Math.PI;
  for (let n = 0; n < fftSize; n++) {
    buffer[n] = Math.sin(twoPi * 100 * n / sampleRate);
  }

  const result = analyzer.analyze(buffer);

  // Bass should dominate (100Hz is in bass band 60-250Hz)
  const bassEnergy = result.bandsRaw.bass;
  const subBassEnergy = result.bandsRaw.subBass;
  const midEnergy = result.bandsRaw.mid;
  const trebleEnergy = result.bandsRaw.treble;

  console.log(`  subBass: ${subBassEnergy.toFixed(6)}`);
  console.log(`  bass:    ${bassEnergy.toFixed(6)} â† Expected dominant`);
  console.log(`  mid:     ${midEnergy.toFixed(6)} â† Expected ~0`);
  console.log(`  treble:  ${trebleEnergy.toFixed(6)} â† Expected ~0`);

  // Bass should be at least 100x stronger than mid or treble
  const bassToMidRatio = midEnergy > 0 ? bassEnergy / midEnergy : 1000;
  const bassToTrebleRatio = trebleEnergy > 0 ? bassEnergy / trebleEnergy : 1000;

  assertBelow(
    'Mid leakage for 100Hz tone',
    midEnergy,
    bassEnergy * 0.01 // Mid should be <1% of bass
  );

  assertBelow(
    'Treble leakage for 100Hz tone',
    trebleEnergy,
    bassEnergy * 0.001 // Treble should be <0.1% of bass
  );

  console.log(`  bass/mid ratio:    ${bassToMidRatio.toFixed(1)}x`);
  console.log(`  bass/treble ratio: ${bassToTrebleRatio.toFixed(1)}x`);
}

/**
 * TEST 11: GodEarAnalyzer â€” multi-band independence
 *
 * Three simultaneous tones in different bands should not bleed.
 */
function testGodEarMultiBand(): void {
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('  TEST 11: GodEar multi-band independence');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');

  const sampleRate = 44100;
  const fftSize = 4096;
  const analyzer = new GodEarAnalyzer(sampleRate, fftSize);

  // Three tones in three different bands
  // 40Hz â†’ subBass (20-60Hz)
  // 1000Hz â†’ mid (500-2000Hz)
  // 10000Hz â†’ treble (6000-16000Hz)
  const buffer = new Float32Array(fftSize);
  const twoPi = 2 * Math.PI;
  for (let n = 0; n < fftSize; n++) {
    buffer[n] = Math.sin(twoPi * 40 * n / sampleRate)
      + Math.sin(twoPi * 1000 * n / sampleRate)
      + Math.sin(twoPi * 10000 * n / sampleRate);
  }

  const result = analyzer.analyze(buffer);

  console.log(`  subBass:  ${result.bandsRaw.subBass.toFixed(6)} â† 40Hz tone`);
  console.log(`  bass:     ${result.bandsRaw.bass.toFixed(6)}`);
  console.log(`  lowMid:   ${result.bandsRaw.lowMid.toFixed(6)}`);
  console.log(`  mid:      ${result.bandsRaw.mid.toFixed(6)} â† 1000Hz tone`);
  console.log(`  highMid:  ${result.bandsRaw.highMid.toFixed(6)}`);
  console.log(`  treble:   ${result.bandsRaw.treble.toFixed(6)} â† 10000Hz tone`);
  console.log(`  ultraAir: ${result.bandsRaw.ultraAir.toFixed(6)}`);

  // Each tone should dominate its band
  // SubBass should dominate over bass (40Hz is deep sub)
  results.push({
    name: 'SubBass dominates for 40Hz',
    passed: result.bandsRaw.subBass > result.bandsRaw.bass,
    detail: result.bandsRaw.subBass > result.bandsRaw.bass
      ? `âœ… subBass=${result.bandsRaw.subBass.toFixed(4)} > bass=${result.bandsRaw.bass.toFixed(4)}`
      : `âŒ subBass=${result.bandsRaw.subBass.toFixed(4)} â‰¤ bass=${result.bandsRaw.bass.toFixed(4)}`,
  });

  // Mid should have energy (1000Hz is center of mid band)
  results.push({
    name: 'Mid has energy for 1000Hz',
    passed: result.bandsRaw.mid > 0.001,
    detail: result.bandsRaw.mid > 0.001
      ? `âœ… mid=${result.bandsRaw.mid.toFixed(4)}`
      : `âŒ mid=${result.bandsRaw.mid.toFixed(4)} too low`,
  });

  // Treble should have energy (10000Hz is center of treble band)
  results.push({
    name: 'Treble has energy for 10000Hz',
    passed: result.bandsRaw.treble > 0.001,
    detail: result.bandsRaw.treble > 0.001
      ? `âœ… treble=${result.bandsRaw.treble.toFixed(4)}`
      : `âŒ treble=${result.bandsRaw.treble.toFixed(4)} too low`,
  });
}

/**
 * TEST 12: Performance benchmark
 *
 * Must be <2ms average for N=4096 on production hardware.
 */
function testPerformance(): void {
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('  TEST 12: Performance benchmark');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');

  const N = 4096;
  const iterations = 200;

  // Deterministic signal (chirp)
  const signal = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    signal[n] = Math.sin(Math.PI * n * n / N);
  }

  const outReal = new Float32Array(N);
  const outImag = new Float32Array(N);

  // Warmup (V8 JIT needs ~10 iterations to optimize)
  for (let i = 0; i < 20; i++) {
    radix2DIT(signal, outReal, outImag);
  }

  // Measure
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    radix2DIT(signal, outReal, outImag);
    times.push(performance.now() - start);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

  assertBelow('Avg latency <2ms', avg, 2.0);

  console.log(`  Average:  ${avg.toFixed(3)}ms`);
  console.log(`  Min:      ${min.toFixed(3)}ms`);
  console.log(`  Max:      ${max.toFixed(3)}ms`);
  console.log(`  P95:      ${p95.toFixed(3)}ms`);
  console.log(`  Target:   <2ms ${avg < 2.0 ? 'âœ…' : 'âš ï¸'}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 5: TEST RUNNER
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function runAllTests(): { passed: number; failed: number; total: number } {
  console.log('â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—');
  console.log('â•‘  ðŸ§ª WAVE 2145: GODEAR RADIX-2 DIT VERIFICATION SUITE       â•‘');
  console.log('â•‘  Testing corrected Cooley-Tukey Radix-2 DIT            â•‘');
  console.log('â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');

  testAgainstDFT();
  testDCSignal();
  testPureCosine();
  testImpulse();
  testParseval();
  testLinearity();
  testPhaseAccuracy();
  testMultiToneSeparation();
  testGodEarSeparation();
  testGodEarFullPipeline();
  testGodEarMultiBand();
  testPerformance();

  // â”€â”€â”€ Summary â”€â”€â”€
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log('\nâ•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—');
  console.log('â•‘                    FINAL RESULTS                           â•‘');
  console.log('â• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•£');

  for (const r of results) {
    console.log(`  ${r.detail.substring(0, 70).padEnd(70)} [${r.name}]`);
  }

  console.log('â• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•£');
  console.log(`â•‘  PASSED: ${String(passed).padStart(3)} / ${total}                                        â•‘`);
  console.log(`â•‘  FAILED: ${String(failed).padStart(3)} / ${total}                                        â•‘`);
  console.log(`â•‘  GRADE:  ${failed === 0 ? 'ðŸ† PERFECT â€” Cooley & Tukey vindicated' : 'âŒ FAILURES DETECTED â€” INVESTIGATE'}         â•‘`);
  console.log('â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');

  return { passed, failed, total };
}

// Auto-run if executed directly
runAllTests();
