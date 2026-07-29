/**
 * WAVE 8005 R3 — Re-optimization with real roll data.
 *
 * The temporal transientDensity refactor changed the metric distributions, so
 * the R2 weights/threshold must be re-derived now that genuine rolls exist.
 *
 * Also evaluates whether a tonal gate (scaledKick / scaledHighs) can suppress
 * the melodic false positives that neither transientDensity nor flatness can.
 */
import * as fs from 'fs';
import * as path from 'path';

const CAL_DIR = path.join(process.cwd(), 'calibration');
const OUT_PATH = path.join(process.cwd(), 'roll_optimization.txt');

interface Peaks {
  scaledKick: number; scaledHighs: number; transientDensity: number;
  spectralFluxV3: number; strobeDrive: number; strobeDriveRaw: number;
  chromaFlux: number; flatness: number; whiteNoiseScore: number;
}

const lines: string[] = [];
function out(s: string) { console.log(s); lines.push(s); }
const clamp01 = (x: number) => x < 0 ? 0 : x > 1 ? 1 : x;
const f = (x: number) => x.toFixed(4);

function load(file: string): Peaks[] {
  const p = path.join(CAL_DIR, file);
  if (!fs.existsSync(p)) return [];
  return Object.values(JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, Peaks>);
}

const rollsRaw = JSON.parse(
  fs.readFileSync(path.join(CAL_DIR, 'redobles.json'), 'utf-8')
) as Record<string, Peaks>;

const ROLLS: Peaks[] = [];
const PURE_ROLLS: Peaks[] = [];
for (const [name, p] of Object.entries(rollsRaw)) {
  ROLLS.push(p);
  if (name.startsWith('IF_SnareRoll') || name.startsWith('IF_LudSnrRoll')) PURE_ROLLS.push(p);
}

const KICKS = [
  ...load('samples_kicks__techno.json'), ...load('Kicks_Acoustic.json'),
  ...load('Kicks_Kes_Kick.json'), ...load('Kicks_Loose_Kick.json'),
];
const SNARES1 = [
  ...load('Snares_Acoustic.json'), ...load('Snares_Ludwig_A.json'),
  ...load('Snares_Ludwig_B.json'), ...load('Snares_Ludwig_C.json'),
  ...load('Snares_Piccolo_Sidestick.json'), ...load('Snares_Sonor_Force_3000.json'),
  ...load('Snares_Tama_Wood.json'), ...load('Snares_Wooden_Piccolo.json'),
];
const HIHATS = [
  ...load('Hi_Hats_Acoustic.json'), ...load('Hi_Hats_Sabian_B8.json'),
  ...load('Hi_Hats_Zildjian_K_Hats.json'),
];
const CYMBALS = load('samples_Cymbals.json');
const MELODIC = [...load('samples_bass_melodies.json'), ...load('samples_pads_melodies.json')];

const tonal = (p: Peaks) => p.scaledKick / (p.scaledHighs + 1e-6);

// ─── Part 0: tonal ratio of rolls vs everything ─────────────────────────────
out('═══════════════════════════════════════════════════════════════════════════');
out('  PART 0 — TONAL RATIO (scaledKick / scaledHighs)');
out('  Can it separate rolls from melodic? Rolls should be LOW, melodic HIGH.');
out('═══════════════════════════════════════════════════════════════════════════');
out('');
function pstats(label: string, arr: Peaks[]) {
  const v = arr.map(tonal).sort((a, b) => a - b);
  const q = (p: number) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  out(`${label.padEnd(18)} n=${String(v.length).padStart(3)}  min=${f(v[0]).padStart(10)}  ` +
      `p25=${f(q(0.25)).padStart(10)}  med=${f(q(0.5)).padStart(10)}  ` +
      `p75=${f(q(0.75)).padStart(10)}  max=${f(v[v.length-1]).padStart(12)}`);
}
pstats('ROLLS (all)', ROLLS);
pstats('ROLLS (pure)', PURE_ROLLS);
pstats('MELODIC', MELODIC);
pstats('KICKS', KICKS);
pstats('SNARES 1-shot', SNARES1);
pstats('HIHATS', HIHATS);

// ─── Part 1: full grid search, with and without tonal gate ──────────────────
interface Cand {
  wt: number; wn: number; wf: number; thr: number; gate: number;
  roll: number; pure: number; kick: number; mel: number; hh: number; sn: number;
  score: number;
}

const FLAT_OFF = 0.10, FLAT_SCALE = 0.10, FLUX_FLOOR = 0.95, FLUX_RANGE = 0.05;

// driveRaw is what the engine computes; driveSmooth converges toward it on
// sustained material. We evaluate on a reconstructed driveRaw so the weight
// search is not confounded by smoother charge time.
function mkDrive(wt: number, wn: number, wf: number) {
  return (p: Peaks) =>
    wt * p.transientDensity +
    wn * clamp01((p.flatness - FLAT_OFF) / FLAT_SCALE) +
    wf * clamp01((p.spectralFluxV3 - FLUX_FLOOR) / FLUX_RANGE);
}

const cands: Cand[] = [];
for (const wt of [0.40, 0.50, 0.55, 0.60, 0.70]) {
  for (const wn of [0.15, 0.20, 0.25, 0.30, 0.40]) {
    const wf = Math.round((1 - wt - wn) * 100) / 100;
    if (wf < 0.05 || wf > 0.35) continue;
    const drive = mkDrive(wt, wn, wf);
    for (let thr = 0.30; thr <= 0.60001; thr += 0.05) {
      for (const gate of [Infinity, 8.0, 5.0, 3.0]) {
        const fire = (arr: Peaks[]) =>
          arr.filter(p => drive(p) >= thr && tonal(p) < gate).length / arr.length;
        const roll = fire(ROLLS), pure = fire(PURE_ROLLS), kick = fire(KICKS);
        const mel = fire(MELODIC), hh = fire(HIHATS), sn = fire(SNARES1);
        // Rolls must fire; kicks and isolated snares must not; melodic must not.
        const score = 0.6 * roll + 0.4 * pure - 1.5 * kick - 1.0 * mel - 0.5 * sn;
        cands.push({ wt, wn, wf, thr, gate, roll, pure, kick, mel, hh, sn, score });
      }
    }
  }
}
cands.sort((a, b) => b.score - a.score);

out('');
out('═══════════════════════════════════════════════════════════════════════════');
out('  PART 1 — WEIGHT + THRESHOLD + TONAL GATE SEARCH (on driveRaw)');
out('  score = 0.6*roll + 0.4*pureRoll - 1.5*kick - 1.0*melodic - 0.5*snare1shot');
out('═══════════════════════════════════════════════════════════════════════════');
out('');
out('  wT   wN   wF   THR  gate |  ROLL  PURE  KICK  MELO   HH  SN1 | score');
out('-------------------------- |----------------------------------|------');
for (const c of cands.slice(0, 20)) {
  const g = c.gate === Infinity ? ' off' : c.gate.toFixed(1).padStart(4);
  out(
    ` ${c.wt.toFixed(2)} ${c.wn.toFixed(2)} ${c.wf.toFixed(2)} ${c.thr.toFixed(2)} ${g} |` +
    `${(100*c.roll).toFixed(0).padStart(5)}%${(100*c.pure).toFixed(0).padStart(5)}%` +
    `${(100*c.kick).toFixed(0).padStart(5)}%${(100*c.mel).toFixed(0).padStart(5)}%` +
    `${(100*c.hh).toFixed(0).padStart(4)}%${(100*c.sn).toFixed(0).padStart(4)}% | ${c.score.toFixed(3)}`
  );
}

// ─── Part 2: detail on the incumbent vs the winner ──────────────────────────
out('');
out('═══════════════════════════════════════════════════════════════════════════');
out('  PART 2 — INCUMBENT (R2 shipped) vs BEST CANDIDATE, on driveRaw');
out('═══════════════════════════════════════════════════════════════════════════');
out('');
function report(label: string, wt: number, wn: number, wf: number, thr: number, gate: number) {
  const drive = mkDrive(wt, wn, wf);
  const fire = (arr: Peaks[]) =>
    100 * arr.filter(p => drive(p) >= thr && tonal(p) < gate).length / arr.length;
  const g = gate === Infinity ? 'off' : gate.toFixed(1);
  out(`${label}`);
  out(`  wT=${wt} wN=${wn} wF=${wf} THR=${thr} tonalGate=${g}`);
  out(`    ROLLS all   : ${fire(ROLLS).toFixed(0)}%`);
  out(`    ROLLS pure  : ${fire(PURE_ROLLS).toFixed(0)}%`);
  out(`    KICKS 1-shot: ${fire(KICKS).toFixed(0)}%   <-- must be 0`);
  out(`    SNARE 1-shot: ${fire(SNARES1).toFixed(0)}%`);
  out(`    HIHATS      : ${fire(HIHATS).toFixed(0)}%`);
  out(`    CYMBALS     : ${fire(CYMBALS).toFixed(0)}%`);
  out(`    MELODIC     : ${fire(MELODIC).toFixed(0)}%   <-- false positive source`);
  out('');
}
report('[INCUMBENT R2]', 0.40, 0.30, 0.30, 0.40, Infinity);
const b = cands[0];
report('[BEST]', b.wt, b.wn, b.wf, b.thr, b.gate);

fs.writeFileSync(OUT_PATH, lines.join('\n'));
out(`Written to ${OUT_PATH}`);
