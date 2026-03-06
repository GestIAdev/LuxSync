/**
 * 🔬 WAVE 2145.3: ITERATIVE Split-Radix DIT FFT — Zero-allocation production version
 *
 * Based on the VERIFIED recursive implementation from 2145.2.
 *
 * Strategy:
 *   1. Pre-compute the Split-Radix input permutation (NOT standard bit-reversal)
 *   2. Apply permutation to reorder input
 *   3. Bottom-up butterfly stages (DIT: small → big)
 *   4. Output in natural order
 *
 * The Split-Radix DIT permutation reorders data as:
 *   Level 0: all evens first, then odd-1s, then odd-3s
 *   Applied recursively at each level.
 *
 * This is equivalent to the "digit-reversal" in mixed-radix {2,4,4,...} base.
 */
// ═══════════════════════════════════════════════════════════════
// Ground truth
// ═══════════════════════════════════════════════════════════════
function dft(re, im) {
    const N = re.length;
    const outRe = new Array(N).fill(0);
    const outIm = new Array(N).fill(0);
    for (let k = 0; k < N; k++) {
        for (let n = 0; n < N; n++) {
            const angle = 2 * Math.PI * k * n / N;
            outRe[k] += re[n] * Math.cos(angle) + im[n] * Math.sin(angle);
            outIm[k] += -re[n] * Math.sin(angle) + im[n] * Math.cos(angle);
        }
    }
    return { re: outRe, im: outIm };
}
// ═══════════════════════════════════════════════════════════════
// Split-Radix input permutation generator
// ═══════════════════════════════════════════════════════════════
/**
 * Generate the Split-Radix DIT input permutation table.
 *
 * The recursive Split-Radix DIT decomposes:
 *   - x[even]  → DFT of size N/2
 *   - x[4n+1]  → DFT of size N/4
 *   - x[4n+3]  → DFT of size N/4
 *
 * This function computes the flat index ordering recursively.
 */
function generateSplitRadixPermutation(N) {
    const perm = new Uint16Array(N);
    function fillPerm(output, outOffset, start, stride, size) {
        if (size === 1) {
            output[outOffset] = start;
            return;
        }
        if (size === 2) {
            output[outOffset] = start;
            output[outOffset + 1] = start + stride;
            return;
        }
        const half = size >> 1;
        const quarter = size >> 2;
        // Even indices: offset 0, stride*2, size N/2
        fillPerm(output, outOffset, start, stride * 2, half);
        // Odd-1 indices (4n+1): offset stride, stride*4, size N/4
        fillPerm(output, outOffset + half, start + stride, stride * 4, quarter);
        // Odd-3 indices (4n+3): offset 3*stride, stride*4, size N/4
        fillPerm(output, outOffset + half + quarter, start + 3 * stride, stride * 4, quarter);
    }
    fillPerm(perm, 0, 0, 1, N);
    return perm;
}
// ═══════════════════════════════════════════════════════════════
// ITERATIVE Split-Radix DIT — PRODUCTION VERSION
// ═══════════════════════════════════════════════════════════════
/**
 * Iterative Split-Radix DIT FFT.
 *
 * DIT approach: permute input, then butterfly from bottom up.
 *
 * Stage structure (bottom-up):
 *   1. Radix-2 butterflies on pairs (size 2)
 *   2. Split-Radix recombination at each level (sizes 4, 8, 16, ..., N)
 *      For each group of size m:
 *        - First half = N/2 sub-DFT result (U)
 *        - Next quarter = N/4 sub-DFT result (Z, odd-1)
 *        - Last quarter = N/4 sub-DFT result (Z', odd-3)
 *        Apply the recombination:
 *          X[k]       = U[k]       + (W^k·Z[k] + W^{3k}·Z'[k])
 *          X[k+N/2]   = U[k]       - (W^k·Z[k] + W^{3k}·Z'[k])
 *          X[k+N/4]   = U[k+N/4]   - j·(W^k·Z[k] - W^{3k}·Z'[k])
 *          X[k+3N/4]  = U[k+N/4]   + j·(W^k·Z[k] - W^{3k}·Z'[k])
 */
function iterativeSplitRadixDIT(samples, outReal, outImag, perm) {
    const N = samples.length;
    // Step 1: Apply Split-Radix permutation
    for (let i = 0; i < N; i++) {
        outReal[i] = samples[perm[i]];
        outImag[i] = 0;
    }
    // Step 2: Radix-2 butterflies (size 2)
    for (let i = 0; i < N; i += 2) {
        const aRe = outReal[i];
        const aIm = outImag[i];
        const bRe = outReal[i + 1];
        const bIm = outImag[i + 1];
        outReal[i] = aRe + bRe;
        outImag[i] = aIm + bIm;
        outReal[i + 1] = aRe - bRe;
        outImag[i + 1] = aIm - bIm;
    }
    // Step 3: Split-Radix recombination, bottom-up (m = 4, 8, 16, ..., N)
    // At each level m, we have groups laid out as:
    //   [U: m/2 elements] [Z: m/4 elements] [Z': m/4 elements]
    // But this layout is what the permutation produced RECURSIVELY.
    //
    // The key insight: after the radix-2 pass, we need to combine:
    //   - The first m/2 elements of each group are U (the even sub-DFT, already done)
    //   - The next m/4 are Z (odd-1 sub-DFT, already done)
    //   - The last m/4 are Z' (odd-3 sub-DFT, already done)
    //
    // We recombine them IN-PLACE using the 4-way butterfly.
    for (let m = 4; m <= N; m <<= 1) {
        const mHalf = m >> 1;
        const mQuart = m >> 2;
        const twoPiOverM = 2 * Math.PI / m;
        for (let groupStart = 0; groupStart < N; groupStart += m) {
            // Indices within this group:
            //   U[k]   at groupStart + k           (k = 0..mHalf-1)
            //   Z[k]   at groupStart + mHalf + k   (k = 0..mQuart-1)
            //   Z'[k]  at groupStart + mHalf + mQuart + k  (k = 0..mQuart-1)
            const uBase = groupStart;
            const zBase = groupStart + mHalf;
            const zpBase = groupStart + mHalf + mQuart;
            for (let k = 0; k < mQuart; k++) {
                const angle1 = twoPiOverM * k;
                const w1r = Math.cos(angle1);
                const w1i = -Math.sin(angle1);
                const angle3 = 3 * twoPiOverM * k;
                const w3r = Math.cos(angle3);
                const w3i = -Math.sin(angle3);
                // Read Z[k] and Z'[k]
                const zkRe = outReal[zBase + k];
                const zkIm = outImag[zBase + k];
                const zpkRe = outReal[zpBase + k];
                const zpkIm = outImag[zpBase + k];
                // W^k · Z[k]
                const wzRe = w1r * zkRe - w1i * zkIm;
                const wzIm = w1r * zkIm + w1i * zkRe;
                // W^{3k} · Z'[k]
                const wzpRe = w3r * zpkRe - w3i * zpkIm;
                const wzpIm = w3r * zpkIm + w3i * zpkRe;
                // sum = W^k·Z + W^{3k}·Z'
                const sumRe = wzRe + wzpRe;
                const sumIm = wzIm + wzpIm;
                // diff = W^k·Z - W^{3k}·Z'
                const diffRe = wzRe - wzpRe;
                const diffIm = wzIm - wzpIm;
                // Read U[k] and U[k+N/4]
                const ukRe = outReal[uBase + k];
                const ukIm = outImag[uBase + k];
                const uk4Re = outReal[uBase + mQuart + k];
                const uk4Im = outImag[uBase + mQuart + k];
                // X[k] = U[k] + sum → write to position k
                outReal[uBase + k] = ukRe + sumRe;
                outImag[uBase + k] = ukIm + sumIm;
                // X[k+N/4] = U[k+N/4] - j·diff → write to position k+mQuart
                // -j·(a+jb) = b - ja
                outReal[uBase + mQuart + k] = uk4Re + diffIm;
                outImag[uBase + mQuart + k] = uk4Im - diffRe;
                // X[k+N/2] = U[k] - sum → write to position zBase + k
                outReal[zBase + k] = ukRe - sumRe;
                outImag[zBase + k] = ukIm - sumIm;
                // X[k+3N/4] = U[k+N/4] + j·diff → write to position zpBase + k
                // j·(a+jb) = -b + ja
                outReal[zpBase + k] = uk4Re - diffIm;
                outImag[zpBase + k] = uk4Im + diffRe;
            }
        }
    }
}
// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════
function test(signal, label) {
    const N = signal.length;
    const perm = generateSplitRadixPermutation(N);
    const outRe = new Float32Array(N);
    const outIm = new Float32Array(N);
    iterativeSplitRadixDIT(new Float32Array(signal), outRe, outIm, perm);
    const truth = dft(signal, new Array(N).fill(0));
    let maxErr = 0;
    for (let k = 0; k < N; k++) {
        const err = Math.max(Math.abs(outRe[k] - truth.re[k]), Math.abs(outIm[k] - truth.im[k]));
        if (err > maxErr)
            maxErr = err;
        if (N <= 8) {
            console.log(`  X[${k}]: SR=(${outRe[k].toFixed(4)}, ${outIm[k].toFixed(4)}) ` +
                `DFT=(${truth.re[k].toFixed(4)}, ${truth.im[k].toFixed(4)}) ` +
                `err=${err.toExponential(2)}`);
        }
    }
    // Float32 tolerance: ~1e-3 for N=4096 (accumulated rounding)
    const tol = N * 1e-5;
    const passed = maxErr < tol;
    console.log(`${label} (N=${N}): max_err=${maxErr.toExponential(3)} tol=${tol.toExponential(2)} ${passed ? '✅' : '❌'}`);
    return passed;
}
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  ITERATIVE SPLIT-RADIX DIT — CORRECTNESS + PERFORMANCE     ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');
// Show permutation for small sizes
console.log('Permutation N=8:', Array.from(generateSplitRadixPermutation(8)).join(', '));
console.log('Permutation N=16:', Array.from(generateSplitRadixPermutation(16)).join(', '));
let allPassed = true;
console.log('\n--- Basic tests ---');
allPassed = test([1, 2, 3, 4], 'Simple4') && allPassed;
allPassed = test([1, 2, 3, 4, 5, 6, 7, 8], 'Simple8') && allPassed;
console.log('\n--- Impulse tests ---');
const imp16 = new Array(16).fill(0);
imp16[0] = 1;
allPassed = test(imp16, 'Impulse16') && allPassed;
const imp256 = new Array(256).fill(0);
imp256[0] = 1;
allPassed = test(imp256, 'Impulse256') && allPassed;
console.log('\n--- DC tests ---');
allPassed = test(new Array(64).fill(1), 'DC64') && allPassed;
allPassed = test(new Array(1024).fill(1), 'DC1024') && allPassed;
console.log('\n--- Cosine tests ---');
for (const N of [64, 256, 1024, 4096]) {
    const sig = [];
    for (let n = 0; n < N; n++)
        sig.push(Math.cos(2 * Math.PI * 5 * n / N));
    allPassed = test(sig, `Cosine_f5_N${N}`) && allPassed;
}
console.log('\n--- Multi-tone test ---');
const mt = [];
for (let n = 0; n < 4096; n++) {
    mt.push(Math.cos(2 * Math.PI * 3 * n / 4096) +
        0.5 * Math.cos(2 * Math.PI * 100 * n / 4096) +
        0.25 * Math.cos(2 * Math.PI * 500 * n / 4096));
}
allPassed = test(mt, 'MultiTone4096') && allPassed;
console.log('\n--- Chirp test ---');
const ch = [];
for (let n = 0; n < 4096; n++)
    ch.push(Math.sin(Math.PI * n * n / 4096));
allPassed = test(ch, 'Chirp4096') && allPassed;
// Performance
console.log('\n--- Performance ---');
const perm4k = generateSplitRadixPermutation(4096);
const perfBuf = new Float32Array(4096);
for (let n = 0; n < 4096; n++)
    perfBuf[n] = Math.sin(Math.PI * n * n / 4096);
const oR = new Float32Array(4096);
const oI = new Float32Array(4096);
// Warmup
for (let i = 0; i < 20; i++)
    iterativeSplitRadixDIT(perfBuf, oR, oI, perm4k);
const perfTimes = [];
for (let i = 0; i < 200; i++) {
    const t0 = performance.now();
    iterativeSplitRadixDIT(perfBuf, oR, oI, perm4k);
    perfTimes.push(performance.now() - t0);
}
const perfAvg = perfTimes.reduce((a, b) => a + b) / perfTimes.length;
const perfMin = Math.min(...perfTimes);
const p95 = perfTimes.sort((a, b) => a - b)[Math.floor(perfTimes.length * 0.95)];
console.log(`  Avg: ${perfAvg.toFixed(3)}ms | Min: ${perfMin.toFixed(3)}ms | P95: ${p95.toFixed(3)}ms`);
console.log(`  Target: <2ms ${perfAvg < 2.0 ? '✅' : '❌'}`);
// Parseval
console.log('\n--- Parseval energy conservation ---');
let timeEnergy = 0;
for (let n = 0; n < 4096; n++)
    timeEnergy += perfBuf[n] * perfBuf[n];
iterativeSplitRadixDIT(perfBuf, oR, oI, perm4k);
let freqEnergy = 0;
for (let k = 0; k < 4096; k++)
    freqEnergy += oR[k] * oR[k] + oI[k] * oI[k];
freqEnergy /= 4096;
const relErr = Math.abs(timeEnergy - freqEnergy) / timeEnergy;
console.log(`  Time energy:  ${timeEnergy.toFixed(4)}`);
console.log(`  Freq energy:  ${freqEnergy.toFixed(4)}`);
console.log(`  Relative err: ${relErr.toExponential(3)} ${relErr < 1e-4 ? '✅' : '❌'}`);
console.log(`\n${'═'.repeat(60)}`);
console.log(`  FINAL: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
console.log(`${'═'.repeat(60)}`);
