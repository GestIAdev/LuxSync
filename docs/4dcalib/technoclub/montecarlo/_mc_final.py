#!/usr/bin/env python3
"""
Monte Carlo -- Stage 7: candidate arbitration.

The 12-D champion only half-transfers, so instead of shipping 12 tuned
numbers we test small, physically-motivated change sets and keep the one
that (a) captures most of the gain and (b) survives the split-half test.

Also quantifies the brightness question the sweeps exposed: relaxing the
flux veto raises the delivered gain on REAL hits -- does it raise the gain
on the garbage by as much?
"""
import os, sys, json

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from _mc_sim import Params, CAPTURE, simulate
from _mc_run import load_corpus, fitness, score_track

CORPUS = load_corpus()
CHAMP = Params(**json.load(open(os.path.join(HERE, 'mc_result.json')))['params'])


def mk(**kw):
    d = CAPTURE.as_dict(); d.update(kw); return Params(**d)


CANDIDATES = [
    ('BASELINE (WAVE 7774)',      CAPTURE),
    ('A veto-flux only',          mk(flux_floor=0.02, flux_knee=0.15)),
    ('B A + floor 0.045->0.040',  mk(flux_floor=0.02, flux_knee=0.15, floor=0.040)),
    ('C B + gRefr 4->6',          mk(flux_floor=0.02, flux_knee=0.15, floor=0.040,
                                     g_refr=6)),
    ('D C + sRefr 4->5',          mk(flux_floor=0.02, flux_knee=0.15, floor=0.040,
                                     g_refr=6, s_refr=5)),
    ('E D + wns_floor->0.04',     mk(flux_floor=0.02, flux_knee=0.15, floor=0.040,
                                     g_refr=6, s_refr=5, wns_floor=0.04)),
    ('12-D champion',             CHAMP),
]


def detail(p, subset=None):
    corp = subset or CORPUS
    fit = fitness(corp, p)
    recP = recC = nP = nC = 0.0
    low = dens = ons = 0
    g_hi = [0.0, 0]; g_lo = [0.0, 0]
    for t in corp:
        sim = simulate(t['frames'], p)
        r, _, _, n_on, n_dn = score_track(t, sim)
        if t['cat'] == 'PERCUSSIVE':
            recP += r * len(t['impacts']); nP += len(t['impacts'])
        elif t['cat'] == 'COMMERCIAL':
            recC += r * len(t['impacts']); nC += len(t['impacts'])
        ons += n_on; dens += n_dn
        ev = t['ev']
        for i, s in enumerate(sim):
            if not s['onset']:
                continue
            if ev[i] < 0.35:
                low += 1; g_lo[0] += s['gain']; g_lo[1] += 1
            elif ev[i] > 0.60:
                g_hi[0] += s['gain']; g_hi[1] += 1
    return {
        'fit': fit, 'recP': recP / max(nP, 1), 'recC': recC / max(nC, 1),
        'low': low, 'dens': dens, 'ons': ons,
        'gain_real': g_hi[0] / max(g_hi[1], 1),
        'gain_junk': g_lo[0] / max(g_lo[1], 1),
    }


order = sorted(CORPUS, key=lambda t: (t['cat'], t['name']))
FOLD_A = [t for i, t in enumerate(order) if i % 2 == 0]
FOLD_B = [t for i, t in enumerate(order) if i % 2 == 1]

print("=" * 106)
print("CANDIDATE ARBITRATION")
print("=" * 106)
print(f"{'candidate':<26}{'fit':>8}{'dfit':>8}{'recP':>7}{'recC':>7}"
      f"{'lowEv':>7}{'dens':>6}{'ons':>6}{'gReal':>7}{'gJunk':>7}"
      f"{'foldA':>7}{'foldB':>7}")
print("-" * 106)
base = detail(CAPTURE)
bA, bB = fitness(FOLD_A, CAPTURE), fitness(FOLD_B, CAPTURE)
for name, p in CANDIDATES:
    d = detail(p)
    fA, fB = fitness(FOLD_A, p), fitness(FOLD_B, p)
    print(f"{name:<26}{d['fit']:>8.4f}{d['fit']-base['fit']:>+8.4f}"
          f"{d['recP']:>7.3f}{d['recC']:>7.3f}{d['low']:>7}{d['dens']:>6}"
          f"{d['ons']:>6}{d['gain_real']:>7.3f}{d['gain_junk']:>7.3f}"
          f"{fA-bA:>+7.4f}{fB-bB:>+7.4f}")
print("-" * 106)
print("gReal = mean delivered brightness on onsets WITH percussive evidence (ev>0.60)")
print("gJunk = mean delivered brightness on onsets WITHOUT evidence (ev<0.35)")
print("foldA/foldB = fitness delta on each half, both must be >0 to be robust")

# ---- per-track effect of the recommended set -------------------------------
REC = dict(CANDIDATES)['C B + gRefr 4->6']
print("\n" + "=" * 106)
print("PER-TRACK EFFECT OF CANDIDATE C")
print("=" * 106)
print(f"{'track':<26}{'cat':<12}{'recall':>16}{'onsets':>14}"
      f"{'lowEv':>12}{'gReal':>14}")
print("-" * 106)
for t in CORPUS:
    d0 = detail(CAPTURE, [t]); d1 = detail(REC, [t])
    r0 = d0['recP'] if t['cat'] == 'PERCUSSIVE' else d0['recC']
    r1 = d1['recP'] if t['cat'] == 'PERCUSSIVE' else d1['recC']
    if t['cat'] == 'DENSITY':
        r0 = r1 = float('nan')
    print(f"{t['name']:<26}{t['cat']:<12}"
          f"{r0:>7.3f}->{r1:<8.3f}{d0['ons']:>6}->{d1['ons']:<7}"
          f"{d0['low']:>5}->{d1['low']:<6}"
          f"{d0['gain_real']:>6.3f}->{d1['gain_real']:<7.3f}")
print("-" * 106)
