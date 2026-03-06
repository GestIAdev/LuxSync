/**
 * 🔬 WAVE 2145.5: CLEAN Cooley-Tukey Radix-2 DIT — the simplest possible FFT
 *
 * If THIS fails, there's something fundamentally wrong with my bit-reversal
 * or butterfly formulation. This is the textbook implementation, nothing fancy.
 */
function dft(re) {
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
function bitReverse(n) {
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
function radix2DIT(samples, outRe, outIm) {
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
// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════
function testFFT(signal, label) {
    const N = signal.length;
    const input = new Float32Array(signal);
    const outRe = new Float32Array(N);
    const outIm = new Float32Array(N);
    radix2DIT(input, outRe, outIm);
    const truth = dft(input);
    let maxErr = 0;
    for (let k = 0; k < N; k++) {
        const err = Math.max(Math.abs(outRe[k] - truth.re[k]), Math.abs(outIm[k] - truth.im[k]));
        if (err > maxErr)
            maxErr = err;
        if (N <= 8) {
            console.log(`  X[${k}]: FFT=(${outRe[k].toFixed(4)}, ${outIm[k].toFixed(4)}) ` +
                `DFT=(${truth.re[k].toFixed(4)}, ${truth.im[k].toFixed(4)}) ` +
                `err=${err.toExponential(2)}`);
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
const imp16 = new Array(16).fill(0);
imp16[0] = 1;
ok = testFFT(imp16, 'Impulse16') && ok;
ok = testFFT(new Array(64).fill(1), 'DC64') && ok;
for (const N of [64, 256, 1024, 4096]) {
    const sig = [];
    for (let n = 0; n < N; n++)
        sig.push(Math.cos(2 * Math.PI * 5 * n / N));
    ok = testFFT(sig, `Cosine_f5_N${N}`) && ok;
}
const mt4k = [];
for (let n = 0; n < 4096; n++) {
    mt4k.push(Math.cos(2 * Math.PI * 3 * n / 4096) + 0.5 * Math.cos(2 * Math.PI * 100 * n / 4096));
}
ok = testFFT(mt4k, 'MultiTone4096') && ok;
// Performance
console.log('\n--- Performance (N=4096) ---');
const perfBuf = new Float32Array(4096);
for (let n = 0; n < 4096; n++)
    perfBuf[n] = Math.sin(Math.PI * n * n / 4096);
const oR = new Float32Array(4096);
const oI = new Float32Array(4096);
for (let i = 0; i < 50; i++)
    radix2DIT(perfBuf, oR, oI);
const times = [];
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
for (let n = 0; n < 4096; n++)
    tE += perfBuf[n] * perfBuf[n];
for (let k = 0; k < 4096; k++)
    fE += oR[k] * oR[k] + oI[k] * oI[k];
fE /= 4096;
console.log(`  Parseval: rel_err=${(Math.abs(tE - fE) / tE).toExponential(3)}`);
console.log(`\n${ok ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
