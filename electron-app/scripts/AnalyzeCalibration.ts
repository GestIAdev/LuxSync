/**
 * Calibration data aggregator — computes per-category statistics
 * from the JSON files produced by GodEarCalibrator.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const CAL_DIR = path.join(process.cwd(), 'calibration');
const OUT_PATH = path.join(process.cwd(), 'calibration_analysis.txt');

interface Peaks {
  scaledKick: number;
  scaledHighs: number;
  transientDensity: number;
  spectralFluxV3: number;
  strobeDrive: number;
  strobeDriveRaw: number;
  chromaFlux: number;
  flatness: number;
  whiteNoiseScore: number;
}

const METRICS: (keyof Peaks)[] = [
  'scaledKick', 'scaledHighs', 'transientDensity',
  'spectralFluxV3', 'strobeDrive', 'strobeDriveRaw',
  'chromaFlux', 'flatness', 'whiteNoiseScore',
];

const lines: string[] = [];
function out(s: string) { console.log(s); lines.push(s); }

function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const q = (p: number) => sorted[Math.min(n - 1, Math.floor(p * (n - 1)))];
  const mean = values.reduce((a, b) => a + b, 0) / n;
  return {
    n,
    min: sorted[0],
    p25: q(0.25),
    median: q(0.5),
    p75: q(0.75),
    p90: q(0.90),
    p95: q(0.95),
    p99: q(0.99),
    max: sorted[n - 1],
    mean,
  };
}

function fmt(v: number): string {
  return v >= 100 ? v.toFixed(1) : v.toFixed(4);
}

const files = fs.readdirSync(CAL_DIR).filter(f => f.endsWith('.json')).sort();
const byCategory: Record<string, Peaks[]> = {};

for (const file of files) {
  const raw = JSON.parse(fs.readFileSync(path.join(CAL_DIR, file), 'utf-8')) as Record<string, Peaks>;
  const cat = file.replace('.json', '');
  byCategory[cat] = Object.values(raw);
}

out('═══════════════════════════════════════════════════════════════════════════════');
out('  GOD EAR V3 — CALIBRATION DATA ANALYSIS');
out('═══════════════════════════════════════════════════════════════════════════════');
out('');

for (const metric of METRICS) {
  out(`\n### METRIC: ${metric}`);
  out('Category                        n     min      p25      med      p75      p90      p95      max      mean');
  out('─────────────────────────────────────────────────────────────────────────────────────────────────────────');
  for (const [cat, arr] of Object.entries(byCategory)) {
    const s = stats(arr.map(p => p[metric]));
    out(
      `${cat.padEnd(30)} ${String(s.n).padStart(3)}  ` +
      `${fmt(s.min).padStart(8)} ${fmt(s.p25).padStart(8)} ${fmt(s.median).padStart(8)} ` +
      `${fmt(s.p75).padStart(8)} ${fmt(s.p90).padStart(8)} ${fmt(s.p95).padStart(8)} ` +
      `${fmt(s.max).padStart(8)} ${fmt(s.mean).padStart(8)}`
    );
  }
}

// ─── Grouped analysis: KICKS vs PERCUSSION vs MELODIC ─────────────────────────
const GROUPS: Record<string, string[]> = {
  KICKS: ['samples_kicks__techno', 'Kicks_Acoustic', 'Kicks_Kes_Kick', 'Kicks_Loose_Kick'],
  SNARES: ['Snares_Acoustic', 'Snares_Ludwig_A', 'Snares_Ludwig_B', 'Snares_Ludwig_C',
           'Snares_Piccolo_Sidestick', 'Snares_Sonor_Force_3000', 'Snares_Tama_Wood', 'Snares_Wooden_Piccolo'],
  HIHATS: ['Hi_Hats_Acoustic', 'Hi_Hats_Sabian_B8', 'Hi_Hats_Zildjian_K_Hats'],
  CYMBALS: ['samples_Cymbals'],
  MELODIC: ['samples_bass_melodies', 'samples_pads_melodies'],
  FULLKIT: ['samples_kit_acustic'],
};

out('\n\n═══════════════════════════════════════════════════════════════════════════════');
out('  GROUPED ANALYSIS');
out('═══════════════════════════════════════════════════════════════════════════════');

for (const metric of METRICS) {
  out(`\n### ${metric} — BY GROUP`);
  out('Group        n     min      p25      med      p75      p90      p95      max      mean');
  out('──────────────────────────────────────────────────────────────────────────────────────');
  for (const [grp, cats] of Object.entries(GROUPS)) {
    const vals: number[] = [];
    for (const c of cats) {
      if (byCategory[c]) vals.push(...byCategory[c].map(p => p[metric]));
    }
    if (vals.length === 0) continue;
    const s = stats(vals);
    out(
      `${grp.padEnd(11)} ${String(s.n).padStart(3)}  ` +
      `${fmt(s.min).padStart(8)} ${fmt(s.p25).padStart(8)} ${fmt(s.median).padStart(8)} ` +
      `${fmt(s.p75).padStart(8)} ${fmt(s.p90).padStart(8)} ${fmt(s.p95).padStart(8)} ` +
      `${fmt(s.max).padStart(8)} ${fmt(s.mean).padStart(8)}`
    );
  }
}

// ─── Overshoot analysis for AGC ───────────────────────────────────────────────
out('\n\n═══════════════════════════════════════════════════════════════════════════════');
out('  AGC OVERSHOOT ANALYSIS (scaledKick > 1.0)');
out('═══════════════════════════════════════════════════════════════════════════════');
for (const [grp, cats] of Object.entries(GROUPS)) {
  const vals: number[] = [];
  for (const c of cats) if (byCategory[c]) vals.push(...byCategory[c].map(p => p.scaledKick));
  if (!vals.length) continue;
  const over10 = vals.filter(v => v > 1.0).length;
  const over12 = vals.filter(v => v > 1.2).length;
  const over15 = vals.filter(v => v > 1.5).length;
  out(`${grp.padEnd(11)} n=${String(vals.length).padStart(3)} | >1.0: ${String(over10).padStart(3)} (${(100*over10/vals.length).toFixed(1)}%) | >1.2: ${String(over12).padStart(3)} (${(100*over12/vals.length).toFixed(1)}%) | >1.5: ${String(over15).padStart(3)} (${(100*over15/vals.length).toFixed(1)}%) | absMax=${fmt(Math.max(...vals))}`);
}

// ─── Separation analysis: how many false positives at various thresholds ──────
out('\n\n═══════════════════════════════════════════════════════════════════════════════');
out('  STROBE THRESHOLD SWEEP — % of samples above threshold');
out('═══════════════════════════════════════════════════════════════════════════════');
const thresholds = [0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50];
out('Group        ' + thresholds.map(t => t.toFixed(2).padStart(7)).join(''));
out('─────────────' + '───────'.repeat(thresholds.length));
for (const [grp, cats] of Object.entries(GROUPS)) {
  const vals: number[] = [];
  for (const c of cats) if (byCategory[c]) vals.push(...byCategory[c].map(p => p.strobeDrive));
  if (!vals.length) continue;
  const row = thresholds.map(t => {
    const pct = 100 * vals.filter(v => v >= t).length / vals.length;
    return pct.toFixed(0).padStart(6) + '%';
  }).join('');
  out(grp.padEnd(13) + row);
}

out('\n\n═══════════════════════════════════════════════════════════════════════════════');
out('  TRANSIENT DENSITY SWEEP — % of samples above threshold');
out('═══════════════════════════════════════════════════════════════════════════════');
const tdThresholds = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40];
out('Group        ' + tdThresholds.map(t => t.toFixed(2).padStart(7)).join(''));
out('─────────────' + '───────'.repeat(tdThresholds.length));
for (const [grp, cats] of Object.entries(GROUPS)) {
  const vals: number[] = [];
  for (const c of cats) if (byCategory[c]) vals.push(...byCategory[c].map(p => p.transientDensity));
  if (!vals.length) continue;
  const row = tdThresholds.map(t => {
    const pct = 100 * vals.filter(v => v >= t).length / vals.length;
    return pct.toFixed(0).padStart(6) + '%';
  }).join('');
  out(grp.padEnd(13) + row);
}

// ─── Round 2: flatness sweep for FLATNESS_OFFSET calibration ─────────────────
out('\n\n═══════════════════════════════════════════════════════════════════════════════');
out('  FLATNESS SWEEP — % of samples above threshold');
out('═══════════════════════════════════════════════════════════════════════════════');
const flThresholds = [0.02, 0.04, 0.06, 0.08, 0.10, 0.12, 0.15, 0.18];
out('Group        ' + flThresholds.map(t => t.toFixed(2).padStart(7)).join(''));
out('─────────────' + '───────'.repeat(flThresholds.length));
for (const [grp, cats] of Object.entries(GROUPS)) {
  const vals: number[] = [];
  for (const c of cats) if (byCategory[c]) vals.push(...byCategory[c].map(p => p.flatness));
  if (!vals.length) continue;
  const row = flThresholds.map(t => {
    const pct = 100 * vals.filter(v => v >= t).length / vals.length;
    return pct.toFixed(0).padStart(6) + '%';
  }).join('');
  out(grp.padEnd(13) + row);
}

// ─── Round 2: strobeDriveRaw sweep ───────────────────────────────────────────
out('\n\n═══════════════════════════════════════════════════════════════════════════════');
out('  STROBE DRIVE RAW SWEEP — % of samples above threshold');
out('═══════════════════════════════════════════════════════════════════════════════');
const drThresholds = [0.20, 0.21, 0.22, 0.23, 0.25, 0.28, 0.30, 0.35];
out('Group        ' + drThresholds.map(t => t.toFixed(2).padStart(7)).join(''));
out('─────────────' + '───────'.repeat(drThresholds.length));
for (const [grp, cats] of Object.entries(GROUPS)) {
  const vals: number[] = [];
  for (const c of cats) if (byCategory[c]) vals.push(...byCategory[c].map(p => p.strobeDriveRaw));
  if (!vals.length) continue;
  const row = drThresholds.map(t => {
    const pct = 100 * vals.filter(v => v >= t).length / vals.length;
    return pct.toFixed(0).padStart(6) + '%';
  }).join('');
  out(grp.padEnd(13) + row);
}

// ─── Round 2: simulate re-weighted driveRaw with candidate constants ─────────
const SIM_FLAT_OFFSET = 0.04;
const SIM_FLAT_SCALE = 0.13;
const SIM_W_TRANSIENT = 0.60;
const SIM_W_NOISE = 0.30;
const SIM_W_FLUX = 0.10;
const SIM_FLUX_FLOOR = 0.90;
const SIM_FLUX_RANGE = 0.10;

out('\n\n═══════════════════════════════════════════════════════════════════════════════');
out('  SIMULATED driveRaw — candidate weights + recalibrated WNS');
out('═══════════════════════════════════════════════════════════════════════════════');
out(`WNS  = clamp((flatness - ${SIM_FLAT_OFFSET}) / ${SIM_FLAT_SCALE})`);
out(`FLUX = clamp((fluxNorm - ${SIM_FLUX_FLOOR}) / ${SIM_FLUX_RANGE})`);
out(`drive = ${SIM_W_TRANSIENT}*td + ${SIM_W_NOISE}*wns + ${SIM_W_FLUX}*flux\n`);

function simWns(p: Peaks): number {
  return Math.max(0, Math.min(1, (p.flatness - SIM_FLAT_OFFSET) / SIM_FLAT_SCALE));
}
function simDrive(p: Peaks): number {
  const fx = Math.max(0, Math.min(1, (p.spectralFluxV3 - SIM_FLUX_FLOOR) / SIM_FLUX_RANGE));
  return SIM_W_TRANSIENT * p.transientDensity + SIM_W_NOISE * simWns(p) + SIM_W_FLUX * fx;
}

function groupTable(label: string, fn: (p: Peaks) => number) {
  out(`\n### ${label}`);
  out('Group        n     min      p25      med      p75      p90      p95      max      mean');
  out('──────────────────────────────────────────────────────────────────────────────────────');
  for (const [grp, cats] of Object.entries(GROUPS)) {
    const vals: number[] = [];
    for (const c of cats) if (byCategory[c]) vals.push(...byCategory[c].map(fn));
    if (!vals.length) continue;
    const s = stats(vals);
    out(
      `${grp.padEnd(11)} ${String(s.n).padStart(3)}  ` +
      `${fmt(s.min).padStart(8)} ${fmt(s.p25).padStart(8)} ${fmt(s.median).padStart(8)} ` +
      `${fmt(s.p75).padStart(8)} ${fmt(s.p90).padStart(8)} ${fmt(s.p95).padStart(8)} ` +
      `${fmt(s.max).padStart(8)} ${fmt(s.mean).padStart(8)}`
    );
  }
}

groupTable('SIMULATED driveRaw — BY GROUP', simDrive);
groupTable('SIMULATED whiteNoiseScore — BY GROUP', simWns);

out('\n### SIMULATED driveRaw SWEEP — % above threshold');
const simThresholds = [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45];
out('Group        ' + simThresholds.map(t => t.toFixed(2).padStart(7)).join(''));
out('─────────────' + '───────'.repeat(simThresholds.length));
for (const [grp, cats] of Object.entries(GROUPS)) {
  const vals: number[] = [];
  for (const c of cats) if (byCategory[c]) vals.push(...byCategory[c].map(simDrive));
  if (!vals.length) continue;
  const row = simThresholds.map(t => {
    const pct = 100 * vals.filter(v => v >= t).length / vals.length;
    return pct.toFixed(0).padStart(6) + '%';
  }).join('');
  out(grp.padEnd(13) + row);
}

// ─── Round 2: Tonal gate verification ────────────────────────────────────────
out('\n\n═══════════════════════════════════════════════════════════════════════════════');
out('  TONAL GATE — scaledKick / (scaledHighs + 1e-6)');
out('═══════════════════════════════════════════════════════════════════════════════');
groupTable('TONAL RATIO — BY GROUP', p => p.scaledKick / (p.scaledHighs + 1e-6));

out('\n### COLOR SNAP GATE — % passing (chromaFlux > 0.0130 AND tonalRatio > R)');
const snapT = 0.0130;
for (const R of [0.5, 1.0, 2.0, 5.0]) {
  out(`\n  tonalRatio > ${R.toFixed(1)}`);
  for (const [grp, cats] of Object.entries(GROUPS)) {
    const arr: Peaks[] = [];
    for (const c of cats) if (byCategory[c]) arr.push(...byCategory[c]);
    if (!arr.length) continue;
    const pass = arr.filter(p =>
      p.chromaFlux > snapT && (p.scaledKick / (p.scaledHighs + 1e-6)) > R
    ).length;
    out(`    ${grp.padEnd(11)} ${String(pass).padStart(3)}/${String(arr.length).padStart(3)}  ${(100*pass/arr.length).toFixed(0).padStart(3)}%`);
  }
}

out('\n\n═══════════════════════════════════════════════════════════════════════════════');
out('  CHROMA FLUX SWEEP — % of samples above threshold');
out('═══════════════════════════════════════════════════════════════════════════════');
const cfThresholds = [0.005, 0.008, 0.010, 0.012, 0.015, 0.018, 0.020, 0.025];
out('Group        ' + cfThresholds.map(t => t.toFixed(3).padStart(7)).join(''));
out('─────────────' + '───────'.repeat(cfThresholds.length));
for (const [grp, cats] of Object.entries(GROUPS)) {
  const vals: number[] = [];
  for (const c of cats) if (byCategory[c]) vals.push(...byCategory[c].map(p => p.chromaFlux));
  if (!vals.length) continue;
  const row = cfThresholds.map(t => {
    const pct = 100 * vals.filter(v => v >= t).length / vals.length;
    return pct.toFixed(0).padStart(6) + '%';
  }).join('');
  out(grp.padEnd(13) + row);
}

fs.writeFileSync(OUT_PATH, lines.join('\n'));
out(`\n\nAnalysis written to ${OUT_PATH}`);
