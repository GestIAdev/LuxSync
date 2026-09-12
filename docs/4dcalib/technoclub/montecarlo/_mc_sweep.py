#!/usr/bin/env python3
"""
Monte Carlo -- Stage 6: single-axis sweeps.

The 12-D champion only half-transfers across a split-half test, so the joint
optimum is partly noise. This stage moves ONE coefficient at a time and
reports physical outcomes rather than a scalar fitness, so we can keep the
changes that are real and discard the ones the corpus cannot identify.

Reported per setting:
  fit    global fitness
  recP   gain-weighted recall on PERCUSSIVE tracks (Carl Cox, Brejcha, ...)
  recC   gain-weighted recall on COMMERCIAL tracks
  lowEv  onsets fired with no percussive evidence  (the FP proxy)
  dens   onsets emitted by the density rescue path (must survive)
  ons    total onsets
"""
import os, sys, json

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from _mc_sim import Params, CAPTURE, simulate
from _mc_run import load_corpus, fitness, score_track

CORPUS = None


def metrics(p):
    fit = fitness(CORPUS, p)
    recP = recC = nP = nC = 0.0
    low = dens = ons = 0
    for t in CORPUS:
        sim = simulate(t['frames'], p)
        r, _, _, n_on, n_dn = score_track(t, sim)
        if t['cat'] == 'PERCUSSIVE':
            recP += r * len(t['impacts']); nP += len(t['impacts'])
        elif t['cat'] == 'COMMERCIAL':
            recC += r * len(t['impacts']); nC += len(t['impacts'])
        ons += n_on; dens += n_dn
        ev = t['ev']
        low += sum(1 for i, s in enumerate(sim) if s['onset'] and ev[i] < 0.35)
    return fit, recP / max(nP, 1), recC / max(nC, 1), low, dens, ons


AXES = [
    ('floor',         [0.020, 0.030, 0.040, 0.045, 0.050, 0.060, 0.070]),
    ('floor_min',     [0.001, 0.002, 0.005, 0.010, 0.020]),
    ('bfct_floor',    [0.300, 0.400, 0.500, 0.700, 1.000]),
    ('s_refr',        [2, 3, 4, 5, 6, 8]),
    ('g_refr',        [2, 3, 4, 5, 6, 8, 10]),
    ('wns_floor',     [0.020, 0.040, 0.070, 0.100, 0.150, 0.250]),
    ('wns_knee',      [0.150, 0.250, 0.350, 0.500]),
    ('flux_floor',    [0.020, 0.050, 0.080, 0.120]),
    ('flux_knee',     [0.150, 0.250, 0.350, 0.500]),
    ('crack_wns_th',  [0.020, 0.050, 0.080, 0.120, 0.150]),
    ('crack_flux_th', [0.150, 0.250, 0.330, 0.400]),
    ('crack_atten',   [0.100, 0.200, 0.300, 0.450, 0.600]),
]


def main():
    global CORPUS
    CORPUS = load_corpus()
    b = metrics(CAPTURE)
    print("=" * 96)
    print("SINGLE-AXIS SWEEPS   (baseline marked *)")
    print(f"BASELINE  fit={b[0]:.4f}  recP={b[1]:.3f}  recC={b[2]:.3f}  "
          f"lowEv={b[3]}  dens={b[4]}  ons={b[5]}")
    print("=" * 96)

    verdicts = []
    for name, vals in AXES:
        print(f"\n--- {name} " + "-" * (88 - len(name)))
        print(f"{'value':>10}{'fit':>9}{'dfit':>9}{'recP':>8}{'recC':>8}"
              f"{'lowEv':>7}{'dens':>6}{'ons':>6}")
        rows = []
        for v in vals:
            kw = CAPTURE.as_dict(); kw[name] = v
            m = metrics(Params(**kw))
            rows.append((v, m))
            star = ' *' if abs(v - getattr(CAPTURE, name)) < 1e-9 else '  '
            print(f"{v:>10}{m[0]:>9.4f}{m[0]-b[0]:>+9.4f}{m[1]:>8.3f}"
                  f"{m[2]:>8.3f}{m[3]:>7}{m[4]:>6}{m[5]:>6}{star}")
        spread = max(r[1][0] for r in rows) - min(r[1][0] for r in rows)
        bestv = max(rows, key=lambda r: r[1][0])
        verdicts.append((spread, name, bestv[0], bestv[1][0] - b[0]))

    print("\n" + "=" * 96)
    print("IDENTIFIABILITY RANKING (fitness spread across the axis)")
    print("=" * 96)
    print(f"{'axis':<16}{'spread':>9}{'best':>10}{'gain':>9}   verdict")
    for sp, name, bv, g in sorted(verdicts, reverse=True):
        v = ('IDENTIFIABLE' if sp > 0.010 else
             'weak' if sp > 0.004 else 'NOT IDENTIFIABLE from this corpus')
        print(f"{name:<16}{sp:>9.4f}{bv:>10}{g:>+9.4f}   {v}")


if __name__ == '__main__':
    main()
