/**
 * Round-2 constant optimizer.
 * Grid-searches strobe weights + flatness mapping to maximize separation between
 * "should strobe" (snare rolls, hihats, cymbals) and "should NOT strobe"
 * (isolated kicks, pads, bass).
 */
import * as fs from 'fs';
import * as path from 'path';

const CAL_DIR = path.join(process.cwd(), 'calibration');
const OUT_PATH = path.join(process.cwd(), 'calibration_optimization.txt');

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

const GROUPS: Record<string, string[]> = {
  KICKS: ['samples_kicks__techno', 'Kicks_Acoustic', 'Kicks_Kes_Kick', 'Kicks_Loose_Kick'],
  SNARES: ['Snares_Acoustic', 'Snares_Ludwig_A', 'Snares_Ludwig_B', 'Snares_Ludwig_C',
           'Snares_Piccolo_Sidestick', 'Snares_Sonor_Force_3000', 'Snares_Tama_Wood', 'Snares_Wooden_Piccolo'],
  HIHATS: ['Hi_Hats_Acoustic', 'Hi_Hats_Sabian_B8', 'Hi_Hats_Zildjian_K_Hats'],
  CYMBALS: ['samples_Cymbals'],
  MELODIC: ['samples_bass_melodies', 'samples_pads_melodies'],
  FULLKIT: ['samples_kit_acustic'],
};

const byCategory: Record<string, Peaks[]> = {};
for (const file of fs.readdirSync(CAL_DIR).filter(f => f.endsWith('.json'))) {
  const raw = JSON.parse(fs.readFileSync(path.join(CAL_DIR, file), 'utf-8')) as Record<string, Peaks>;
  byCategory[file.replace('.json', '')] = Object.values(raw);
}

function groupData(grp: string): Peaks[] {
  const arr: Peaks[] = [];
  for (const c of GROUPS[grp]) if (byCategory[c]) arr.push(...byCategory[c]);
  return arr;
}

const clamp01 = (x: number) => x < 0 ? 0 : x > 1 ? 1 : x;

// ─── Part 1: Flatness mapping search ────────────────────────────────────────
out('═══════════════════════════════════════════════════════════════════════════');
out('  PART 1 — FLATNESS_OFFSET / FLATNESS_SCALE SEARCH');
out('  Goal: cymbals+hihats → ~1.0 ; kicks → 0 ; pads → low');
out('═══════════════════════════════════════════════════════════════════════════');
out('');
out('OFF   SCALE |  KICKS   SNARES  HIHATS  CYMBAL  MELODIC | score');
out('------------|----------------------------------------- |------');

interface FlatCand { off: number; scale: number; score: number; means: Record<string, number>; }
const flatCands: FlatCand[] = [];

for (const off of [0.06, 0.08, 0.10, 0.12, 0.14, 0.16]) {
  for (const scale of [0.10, 0.14, 0.18, 0.22, 0.26, 0.30]) {
    const means: Record<string, number> = {};
    for (const grp of Object.keys(GROUPS)) {
      const d = groupData(grp);
      means[grp] = d.reduce((a, p) => a + clamp01((p.flatness - off) / scale), 0) / d.length;
    }
    // Want hihats+cymbals high, kicks low, melodic lowish
    const score = (means.HIHATS + means.CYMBALS) / 2 - means.KICKS - 0.5 * means.MELODIC;
    flatCands.push({ off, scale, score, means });
  }
}
flatCands.sort((a, b) => b.score - a.score);
for (const c of flatCands.slice(0, 14)) {
  out(
    `${c.off.toFixed(2)}  ${c.scale.toFixed(2)}  | ` +
    `${c.means.KICKS.toFixed(3)}   ${c.means.SNARES.toFixed(3)}   ` +
    `${c.means.HIHATS.toFixed(3)}   ${c.means.CYMBALS.toFixed(3)}   ` +
    `${c.means.MELODIC.toFixed(3)}   | ${c.score.toFixed(3)}`
  );
}

// ─── Part 2: Strobe weight + threshold search ───────────────────────────────
out('');
out('═══════════════════════════════════════════════════════════════════════════');
out('  PART 2 — STROBE WEIGHTS + ACTIVATION THRESHOLD SEARCH');
out('  PASS target : HIHATS, CYMBALS, SNARES (rolls)');
out('  BLOCK target: KICKS (4/4 seco), MELODIC (pads/bass)');
out('═══════════════════════════════════════════════════════════════════════════');
out('');

const BEST_OFF = 0.10;
const BEST_SCALE = 0.22;

interface WCand {
  wt: number; wn: number; wf: number; fFloor: number; thr: number;
  pass: Record<string, number>; score: number;
}
const wCands: WCand[] = [];

for (const wt of [0.20, 0.30, 0.40, 0.50]) {
  for (const wn of [0.30, 0.40, 0.50, 0.60]) {
    const wf = Math.round((1 - wt - wn) * 100) / 100;
    if (wf < 0.05 || wf > 0.35) continue;
    for (const fFloor of [0.90, 0.95, 0.97]) {
      const fRange = 1 - fFloor;
      const drive = (p: Peaks) =>
        wt * p.transientDensity +
        wn * clamp01((p.flatness - BEST_OFF) / BEST_SCALE) +
        wf * clamp01((p.spectralFluxV3 - fFloor) / fRange);

      for (const thr of [0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55]) {
        const pass: Record<string, number> = {};
        for (const grp of Object.keys(GROUPS)) {
          const d = groupData(grp);
          pass[grp] = d.filter(p => drive(p) >= thr).length / d.length;
        }
        // Reward percussive-bright pass, penalize kick + melodic false positives heavily
        const score =
          0.40 * pass.HIHATS + 0.30 * pass.CYMBALS + 0.30 * pass.SNARES
          - 1.20 * pass.KICKS - 0.80 * pass.MELODIC;
        wCands.push({ wt, wn, wf, fFloor, thr, pass, score });
      }
    }
  }
}
wCands.sort((a, b) => b.score - a.score);

out('  wT    wN    wF  fFloor  THR |  KICKS  SNARE  HIHAT  CYMB  MELOD  KIT | score');
out('------------------------------|-------------------------------------- |------');
for (const c of wCands.slice(0, 18)) {
  out(
    `${c.wt.toFixed(2)}  ${c.wn.toFixed(2)}  ${c.wf.toFixed(2)}  ${c.fFloor.toFixed(2)}  ${c.thr.toFixed(2)} | ` +
    `${(100*c.pass.KICKS).toFixed(0).padStart(5)}% ${(100*c.pass.SNARES).toFixed(0).padStart(5)}% ` +
    `${(100*c.pass.HIHATS).toFixed(0).padStart(5)}% ${(100*c.pass.CYMBALS).toFixed(0).padStart(4)}% ` +
    `${(100*c.pass.MELODIC).toFixed(0).padStart(5)}% ${(100*c.pass.FULLKIT).toFixed(0).padStart(4)}% | ${c.score.toFixed(3)}`
  );
}

// ─── Part 3: AGC headroom re-verification ───────────────────────────────────
out('');
out('═══════════════════════════════════════════════════════════════════════════');
out('  PART 3 — AGC HEADROOM RE-CHECK (post fixes)');
out('═══════════════════════════════════════════════════════════════════════════');
for (const grp of Object.keys(GROUPS)) {
  const v = groupData(grp).map(p => p.scaledKick);
  const over = (t: number) => v.filter(x => x > t).length;
  out(
    `${grp.padEnd(9)} n=${String(v.length).padStart(3)} | ` +
    `>1.0: ${String(over(1.0)).padStart(3)} (${(100*over(1.0)/v.length).toFixed(1)}%) | ` +
    `>1.2: ${String(over(1.2)).padStart(3)} | >1.25: ${String(over(1.25)).padStart(3)} | ` +
    `>1.5: ${String(over(1.5)).padStart(3)} | absMax=${Math.max(...v).toFixed(4)}`
  );
}

// ─── Part 4: Chroma snap gate matrix ────────────────────────────────────────
out('');
out('═══════════════════════════════════════════════════════════════════════════');
out('  PART 4 — CHROMA SNAP: threshold x tonalRatio matrix');
out('  Want: MELODIC high pass, CYMBALS/HIHATS/SNARES ~0');
out('═══════════════════════════════════════════════════════════════════════════');
out('');
out('cfT     R   |  KICKS  SNARE  HIHAT  CYMB  MELOD  KIT | melodic-noise');
out('------------|-------------------------------------- |--------------');
for (const cfT of [0.010, 0.012, 0.013, 0.015, 0.018]) {
  for (const R of [1.0, 2.0, 3.0, 5.0]) {
    const pass: Record<string, number> = {};
    for (const grp of Object.keys(GROUPS)) {
      const d = groupData(grp);
      pass[grp] = d.filter(p =>
        p.chromaFlux > cfT && (p.scaledKick / (p.scaledHighs + 1e-6)) > R
      ).length / d.length;
    }
    const noise = (pass.SNARES + pass.HIHATS + pass.CYMBALS) / 3;
    out(
      `${cfT.toFixed(3)} ${R.toFixed(1)} | ` +
      `${(100*pass.KICKS).toFixed(0).padStart(5)}% ${(100*pass.SNARES).toFixed(0).padStart(5)}% ` +
      `${(100*pass.HIHATS).toFixed(0).padStart(5)}% ${(100*pass.CYMBALS).toFixed(0).padStart(4)}% ` +
      `${(100*pass.MELODIC).toFixed(0).padStart(5)}% ${(100*pass.FULLKIT).toFixed(0).padStart(4)}% | ` +
      `${(pass.MELODIC - noise).toFixed(3)}`
    );
  }
}

fs.writeFileSync(OUT_PATH, lines.join('\n'));
out(`\nWritten to ${OUT_PATH}`);
