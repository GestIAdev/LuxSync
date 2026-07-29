/**
 * WAVE 8005 R3 — Roll validation.
 *
 * Closes the one open question from the R2 report: does a sustained snare roll
 * cross ACTIVATION_THRESHOLD while an isolated kick does not?
 *
 * Splits samples/redobles by filename prefix into pure rolls vs composite
 * kick+snare fills, and contrasts them against the one-shot baseline.
 */
import * as fs from 'fs';
import * as path from 'path';

const CAL_DIR = path.join(process.cwd(), 'calibration');
const OUT_PATH = path.join(process.cwd(), 'roll_validation.txt');

// Must mirror StrobeEngine
const ACTIVATION_THRESHOLD = 0.40;
const DEACTIVATION_THRESH = 0.22;

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

const lines: string[] = [];
function out(s: string) { console.log(s); lines.push(s); }

function load(file: string): Record<string, Peaks> {
  const p = path.join(CAL_DIR, file);
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

// ─── Roll groups (filename prefix within redobles.json) ─────────────────────
const rolls = load('redobles.json');
const ROLL_GROUPS: Record<string, Peaks[]> = {
  'ROLL_Snare_pure': [],
  'ROLL_Ludwig_pure': [],
  'FILL_KikSnr_A': [],
  'FILL_KikSnr_B': [],
};
for (const [name, p] of Object.entries(rolls)) {
  if (name.startsWith('IF_SnareRoll')) ROLL_GROUPS['ROLL_Snare_pure'].push(p);
  else if (name.startsWith('IF_LudSnrRoll')) ROLL_GROUPS['ROLL_Ludwig_pure'].push(p);
  else if (name.startsWith('IF_KikSnrFillA')) ROLL_GROUPS['FILL_KikSnr_A'].push(p);
  else if (name.startsWith('IF_KikSnrFillB')) ROLL_GROUPS['FILL_KikSnr_B'].push(p);
}

// ─── One-shot baseline groups ───────────────────────────────────────────────
const ONESHOT: Record<string, string[]> = {
  'ONESHOT_Kicks': ['samples_kicks__techno', 'Kicks_Acoustic', 'Kicks_Kes_Kick', 'Kicks_Loose_Kick'],
  'ONESHOT_Snares': ['Snares_Acoustic', 'Snares_Ludwig_A', 'Snares_Ludwig_B', 'Snares_Ludwig_C',
                     'Snares_Piccolo_Sidestick', 'Snares_Sonor_Force_3000', 'Snares_Tama_Wood',
                     'Snares_Wooden_Piccolo'],
  'ONESHOT_Hihats': ['Hi_Hats_Acoustic', 'Hi_Hats_Sabian_B8', 'Hi_Hats_Zildjian_K_Hats'],
  'ONESHOT_Melodic': ['samples_bass_melodies', 'samples_pads_melodies'],
};
const ALL: Record<string, Peaks[]> = { ...ROLL_GROUPS };
for (const [grp, cats] of Object.entries(ONESHOT)) {
  const arr: Peaks[] = [];
  for (const c of cats) arr.push(...Object.values(load(`${c}.json`)));
  ALL[grp] = arr;
}

function stats(v: number[]) {
  const s = [...v].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return {
    n: s.length, min: s[0], p25: q(0.25), med: q(0.5), p75: q(0.75),
    max: s[s.length - 1], mean: s.reduce((a, b) => a + b, 0) / s.length,
  };
}
const f = (x: number) => x.toFixed(4);

function table(label: string, pick: (p: Peaks) => number) {
  out(`\n### ${label}`);
  out('Group                n      min      p25      med      p75      max     mean');
  out('──────────────────────────────────────────────────────────────────────────────');
  for (const [grp, arr] of Object.entries(ALL)) {
    if (!arr.length) continue;
    const s = stats(arr.map(pick));
    out(
      `${grp.padEnd(19)} ${String(s.n).padStart(3)}  ${f(s.min).padStart(8)} ${f(s.p25).padStart(8)} ` +
      `${f(s.med).padStart(8)} ${f(s.p75).padStart(8)} ${f(s.max).padStart(8)} ${f(s.mean).padStart(8)}`
    );
  }
}

out('═══════════════════════════════════════════════════════════════════════════════');
out('  WAVE 8005 R3 — ROLL VALIDATION');
out(`  ACTIVATION_THRESHOLD = ${ACTIVATION_THRESHOLD}   DEACTIVATION = ${DEACTIVATION_THRESH}`);
out('═══════════════════════════════════════════════════════════════════════════════');

table('transientDensity (temporal, 500ms window)', p => p.transientDensity);
table('strobeDriveRaw (instantaneous)', p => p.strobeDriveRaw);
table('strobeDrive (smoothed — this is what gates activation)', p => p.strobeDrive);
table('flatness', p => p.flatness);
table('whiteNoiseScore', p => p.whiteNoiseScore);

// ─── The decisive test ──────────────────────────────────────────────────────
out('');
out('═══════════════════════════════════════════════════════════════════════════════');
out('  DECISIVE TEST — % of samples whose smoothed drive crosses activation');
out('═══════════════════════════════════════════════════════════════════════════════');
out('');
const thrs = [0.25, 0.30, 0.35, 0.40, 0.45, 0.50];
out('Group                ' + thrs.map(t => t.toFixed(2).padStart(8)).join(''));
out('─────────────────────' + '────────'.repeat(thrs.length));
for (const [grp, arr] of Object.entries(ALL)) {
  if (!arr.length) continue;
  const row = thrs.map(t => {
    const pct = 100 * arr.filter(p => p.strobeDrive >= t).length / arr.length;
    return (pct.toFixed(0) + '%').padStart(8);
  }).join('');
  out(grp.padEnd(21) + row);
}

// ─── Separation margin at the shipped threshold ─────────────────────────────
out('');
out('═══════════════════════════════════════════════════════════════════════════════');
out(`  SEPARATION @ ACTIVATION_THRESHOLD = ${ACTIVATION_THRESHOLD}`);
out('═══════════════════════════════════════════════════════════════════════════════');
out('');
const rollAll = [
  ...ROLL_GROUPS['ROLL_Snare_pure'], ...ROLL_GROUPS['ROLL_Ludwig_pure'],
  ...ROLL_GROUPS['FILL_KikSnr_A'], ...ROLL_GROUPS['FILL_KikSnr_B'],
];
const pureRolls = [...ROLL_GROUPS['ROLL_Snare_pure'], ...ROLL_GROUPS['ROLL_Ludwig_pure']];
const kicks = ALL['ONESHOT_Kicks'];

const firePct = (arr: Peaks[], t = ACTIVATION_THRESHOLD) =>
  100 * arr.filter(p => p.strobeDrive >= t).length / arr.length;

out(`  Pure rolls  (n=${pureRolls.length})  fire: ${firePct(pureRolls).toFixed(0)}%   ` +
    `drive max=${f(Math.max(...pureRolls.map(p => p.strobeDrive)))}`);
out(`  All rolls   (n=${rollAll.length})  fire: ${firePct(rollAll).toFixed(0)}%   ` +
    `drive max=${f(Math.max(...rollAll.map(p => p.strobeDrive)))}`);
out(`  Isolated kicks (n=${kicks.length}) fire: ${firePct(kicks).toFixed(0)}%   ` +
    `drive max=${f(Math.max(...kicks.map(p => p.strobeDrive)))}`);
out('');
out(`  Kick ceiling  : ${f(Math.max(...kicks.map(p => p.strobeDrive)))}`);
out(`  Roll floor    : ${f(Math.min(...rollAll.map(p => p.strobeDrive)))}`);
out(`  Roll median   : ${f(stats(rollAll.map(p => p.strobeDrive)).med)}`);

// ─── Optimal threshold given the real roll data ─────────────────────────────
out('');
out('═══════════════════════════════════════════════════════════════════════════════');
out('  THRESHOLD RE-OPTIMIZATION WITH REAL ROLLS');
out('  score = rollFire - 1.5*kickFire - 1.0*melodicFire');
out('═══════════════════════════════════════════════════════════════════════════════');
out('');
const melodic = ALL['ONESHOT_Melodic'];
out('  THR  | rollFire  pureRoll  kickFire  melodFire | score');
out('-------|-----------------------------------------|------');
let best = { t: 0, score: -Infinity };
for (let t = 0.20; t <= 0.55001; t += 0.01) {
  const r = firePct(rollAll, t) / 100;
  const pr = firePct(pureRolls, t) / 100;
  const k = firePct(kicks, t) / 100;
  const m = firePct(melodic, t) / 100;
  const score = r - 1.5 * k - 1.0 * m;
  if (score > best.score) best = { t, score };
  if (Math.abs(t * 100 - Math.round(t * 100)) < 1e-6 && Math.round(t * 100) % 2 === 0) {
    out(
      `  ${t.toFixed(2)} | ${(100*r).toFixed(0).padStart(7)}% ${(100*pr).toFixed(0).padStart(8)}% ` +
      `${(100*k).toFixed(0).padStart(8)}% ${(100*m).toFixed(0).padStart(9)}% | ${score.toFixed(3)}`
    );
  }
}
out('');
out(`  >>> Best threshold: ${best.t.toFixed(2)} (score ${best.score.toFixed(3)})`);

fs.writeFileSync(OUT_PATH, lines.join('\n'));
out(`\nWritten to ${OUT_PATH}`);
