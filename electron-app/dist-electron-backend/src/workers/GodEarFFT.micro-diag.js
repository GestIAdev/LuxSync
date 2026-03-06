/**
 * 🔬 WAVE 2145: MICRO-DIAGNOSIS — Split-Radix DIF debugging on N=8
 *
 * We compare our algorithm step-by-step against brute-force DFT
 * to find EXACTLY where the butterfly breaks.
 */
// Brute-force DFT (ground truth)
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
    return { outRe, outIm };
}
// Our Split-Radix DIF implementation (matching GodEarFFT.ts exactly)
function splitRadixDIF(inputRe) {
    const n = inputRe.length;
    const outRe = [...inputRe];
    const outIm = new Array(n).fill(0);
    // Twiddles
    const half = n >> 1;
    const w1re = [];
    const w1im = [];
    const w3re = [];
    const w3im = [];
    for (let k = 0; k < half; k++) {
        const a1 = 2 * Math.PI * k / n;
        w1re.push(Math.cos(a1));
        w1im.push(-Math.sin(a1));
        const a3 = 3 * 2 * Math.PI * k / n;
        w3re.push(Math.cos(a3));
        w3im.push(-Math.sin(a3));
    }
    // Bit-reversal table
    const bits = Math.log2(n) | 0;
    const bitRev = [];
    for (let i = 0; i < n; i++) {
        let rev = 0, x = i;
        for (let b = 0; b < bits; b++) {
            rev = (rev << 1) | (x & 1);
            x >>= 1;
        }
        bitRev.push(rev);
    }
    console.log(`\n=== Split-Radix DIF on N=${n} ===`);
    console.log(`Input: [${outRe.map(v => v.toFixed(3)).join(', ')}]`);
    // DIF stages: m goes from n down to 4
    for (let m = n; m > 2; m >>= 1) {
        const mHalf = m >> 1;
        const mQuart = m >> 2;
        const twStep = n / m;
        console.log(`\n--- Stage m=${m}, mHalf=${mHalf}, mQuart=${mQuart}, twStep=${twStep} ---`);
        for (let gs = 0; gs < n; gs += m) {
            for (let j = 0; j < mQuart; j++) {
                const i0 = gs + j;
                const i1 = i0 + mHalf;
                const i2 = gs + mQuart + j;
                const i3 = i2 + mHalf;
                const twIdx = j * twStep;
                console.log(`  group@${gs} j=${j}: i0=${i0} i1=${i1} i2=${i2} i3=${i3} twIdx=${twIdx}`);
                console.log(`    BEFORE: re[${i0}]=${outRe[i0].toFixed(4)} re[${i1}]=${outRe[i1].toFixed(4)} re[${i2}]=${outRe[i2].toFixed(4)} re[${i3}]=${outRe[i3].toFixed(4)}`);
                const r1Re = outRe[i0] - outRe[i1];
                const r1Im = outIm[i0] - outIm[i1];
                outRe[i0] += outRe[i1];
                outIm[i0] += outIm[i1];
                const r2Re = outRe[i2] - outRe[i3];
                const r2Im = outIm[i2] - outIm[i3];
                outRe[i2] += outRe[i3];
                outIm[i2] += outIm[i3];
                const uRe = r1Re + r2Im;
                const uIm = r1Im - r2Re;
                const vRe = r1Re - r2Im;
                const vIm = r1Im + r2Re;
                outRe[i1] = uRe * w1re[twIdx] - uIm * w1im[twIdx];
                outIm[i1] = uRe * w1im[twIdx] + uIm * w1re[twIdx];
                outRe[i3] = vRe * w3re[twIdx] - vIm * w3im[twIdx];
                outIm[i3] = vRe * w3im[twIdx] + vIm * w3re[twIdx];
                console.log(`    r1=(${r1Re.toFixed(4)},${r1Im.toFixed(4)}) r2=(${r2Re.toFixed(4)},${r2Im.toFixed(4)})`);
                console.log(`    u=(${uRe.toFixed(4)},${uIm.toFixed(4)}) v=(${vRe.toFixed(4)},${vIm.toFixed(4)})`);
                console.log(`    W1[${twIdx}]=(${w1re[twIdx].toFixed(4)},${w1im[twIdx].toFixed(4)}) W3[${twIdx}]=(${w3re[twIdx].toFixed(4)},${w3im[twIdx].toFixed(4)})`);
                console.log(`    AFTER: re[${i0}]=${outRe[i0].toFixed(4)} re[${i1}]=${outRe[i1].toFixed(4)} re[${i2}]=${outRe[i2].toFixed(4)} re[${i3}]=${outRe[i3].toFixed(4)}`);
            }
        }
        console.log(`  State after stage: [${outRe.map(v => v.toFixed(4)).join(', ')}]`);
    }
    // Final radix-2
    console.log(`\n--- Final radix-2 ---`);
    for (let i = 0; i < n; i += 2) {
        const tRe = outRe[i + 1];
        const tIm = outIm[i + 1];
        outRe[i + 1] = outRe[i] - tRe;
        outIm[i + 1] = outIm[i] - tIm;
        outRe[i] += tRe;
        outIm[i] += tIm;
    }
    console.log(`  Before bit-rev: [${outRe.map(v => v.toFixed(4)).join(', ')}]`);
    // Bit reversal
    for (let i = 0; i < n; i++) {
        const j = bitRev[i];
        if (j > i) {
            let tmp = outRe[i];
            outRe[i] = outRe[j];
            outRe[j] = tmp;
            tmp = outIm[i];
            outIm[i] = outIm[j];
            outIm[j] = tmp;
        }
    }
    console.log(`  After bit-rev: [${outRe.map(v => v.toFixed(4)).join(', ')}]`);
    console.log(`  Bit-rev table: [${bitRev.join(', ')}]`);
    return { outRe, outIm };
}
// ═════ TEST with N=8 ═════
console.log('╔══════════════════════════════════════════════════════╗');
console.log('║  MICRO-DIAGNOSIS: N=8 Split-Radix DIF              ║');
console.log('╚══════════════════════════════════════════════════════╝');
// Simple test: impulse at position 1 → X[k] = exp(-j2πk/N)
const N = 8;
const testSignal = [1, 2, 3, 4, 5, 6, 7, 8]; // Use a clear signal
console.log('\n=== BRUTE-FORCE DFT (GROUND TRUTH) ===');
const truth = dft(testSignal, new Array(N).fill(0));
for (let k = 0; k < N; k++) {
    console.log(`  X[${k}] = (${truth.outRe[k].toFixed(4)}, ${truth.outIm[k].toFixed(4)}) mag=${Math.sqrt(truth.outRe[k] ** 2 + truth.outIm[k] ** 2).toFixed(4)}`);
}
const sr = splitRadixDIF(testSignal);
console.log('\n=== SPLIT-RADIX RESULT ===');
for (let k = 0; k < N; k++) {
    const errRe = Math.abs(sr.outRe[k] - truth.outRe[k]);
    const errIm = Math.abs(sr.outIm[k] - truth.outIm[k]);
    const maxErr = Math.max(errRe, errIm);
    console.log(`  X[${k}] = (${sr.outRe[k].toFixed(4)}, ${sr.outIm[k].toFixed(4)}) | DFT=(${truth.outRe[k].toFixed(4)}, ${truth.outIm[k].toFixed(4)}) | err=${maxErr.toFixed(6)} ${maxErr < 0.01 ? '✅' : '❌'}`);
}
// Also test N=4 (minimal split-radix case)
console.log('\n\n╔══════════════════════════════════════════════════════╗');
console.log('║  MICRO-DIAGNOSIS: N=4 Split-Radix DIF              ║');
console.log('╚══════════════════════════════════════════════════════╝');
const test4 = [1, 2, 3, 4];
const truth4 = dft(test4, new Array(4).fill(0));
console.log('\n=== BRUTE-FORCE DFT ===');
for (let k = 0; k < 4; k++) {
    console.log(`  X[${k}] = (${truth4.outRe[k].toFixed(4)}, ${truth4.outIm[k].toFixed(4)})`);
}
const sr4 = splitRadixDIF(test4);
console.log('\n=== COMPARISON ===');
for (let k = 0; k < 4; k++) {
    const err = Math.max(Math.abs(sr4.outRe[k] - truth4.outRe[k]), Math.abs(sr4.outIm[k] - truth4.outIm[k]));
    console.log(`  X[${k}]: SR=(${sr4.outRe[k].toFixed(4)}, ${sr4.outIm[k].toFixed(4)}) DFT=(${truth4.outRe[k].toFixed(4)}, ${truth4.outIm[k].toFixed(4)}) err=${err.toFixed(6)} ${err < 0.01 ? '✅' : '❌'}`);
}
