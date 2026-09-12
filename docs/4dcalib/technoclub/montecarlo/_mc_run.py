#!/usr/bin/env python3
"""
Monte Carlo -- Stage 4: fitness + stochastic search.

FITNESS DESIGN
  reward   : recall of independently-labelled percussive impacts, weighted by
             the post-veto brightness actually delivered (a snare detected but
             vetoed down to 10% is only 10% of a hit).
  penalise : onsets fired on frames with no percussive evidence -- the synth
             stabs, vocal consonants and brickwall pumping of commercial EDM.
  preserve : the density rescue path used by white-noise buildups.

Ground-truth labels and the per-frame evidence score both come from worker
signals (SnareE gate, RawD, cFx, hhDlt) that are NOT part of the tuned
Res x cFx x bFct x sEF chain, which keeps the objective non-circular.
"""
import os, sys, random, statistics as st, json, math

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from _mc_parse import parse_file, DIR, q
from _mc_truth import impact_labels, CATEGORY
from _mc_sim import Params, CAPTURE, recover_flatness, simulate

FPS = 44.0
MATCH_W = 3            # +/- frames an onset may sit from a labelled impact

# Category weights: (w_recall, w_purity, w_rate)
WEIGHTS = {
    'PERCUSSIVE': (1.00, 0.70, 0.30),   # Carl Cox / Brejcha: must not miss
    'COMMERCIAL': (0.45, 1.60, 0.45),   # Icona Pop / Guetta: must not invent
    'DENSITY':    (1.15, 0.25, 0.15),   # Prydz buildups: keep painting light
}


# ---------------------------------------------------------------------------
def build_evidence(frames, impacts):
    """
    Per-frame percussive evidence in [0,1], normalised against the amplitude
    the labelled impacts actually exhibit in THIS track (genres differ wildly
    in absolute transient scale).
    """
    n = len(frames)
    ref = [frames[i] for i in impacts] or frames

    def scale(key, lo):
        v = q([abs(f.get(key, 0)) for f in ref], 0.75)
        return max(v, lo)

    s_raw = scale('Raw\u0394', 0.15)
    s_cfx = scale('cFx', 0.08)
    s_hh  = scale('hhDlt', 0.10)

    inst = []
    for f in frames:
        r = max(0.0, f.get('Raw\u0394', 0.0)) / s_raw
        c = f.get('cFx', 0.0) / s_cfx
        h = f.get('hhDlt', 0.0) / s_hh
        e = 0.50 * min(1.0, r) + 0.30 * min(1.0, c) + 0.20 * min(1.0, h)
        inst.append(min(1.0, e))

    # a transient may be logged 1-2 frames off the onset decision
    ev = []
    for i in range(n):
        ev.append(max(inst[max(0, i - 2):min(n, i + 3)]))
    return ev


def load_corpus():
    corpus = []
    for fn in sorted(x for x in os.listdir(DIR) if x.endswith('.md')):
        fr = parse_file(os.path.join(DIR, fn))
        if not fr:
            continue
        recover_flatness(fr)
        impacts, _, _ = impact_labels(fr)
        ev = build_evidence(fr, impacts)
        base = simulate(fr, CAPTURE)
        corpus.append({
            'name': fn,
            'cat': CATEGORY.get(fn, 'COMMERCIAL'),
            'frames': fr,
            'impacts': impacts,
            'ev': ev,
            'secs': len(fr) / FPS,
            'base_density': sum(1 for s in base if s['path'] == 'DENSITY'),
            'base_onsets': sum(1 for s in base if s['onset']),
        })
    return corpus


def score_track(track, sim):
    """Return (recall, purity, rate_score, n_onsets, n_density)."""
    ev, impacts = track['ev'], track['impacts']
    n = len(sim)
    onsets = [i for i, s in enumerate(sim) if s['onset']]

    # -- recall, weighted by delivered brightness --------------------------
    if impacts:
        got = 0.0
        for i in impacts:
            best = 0.0
            for d in range(-MATCH_W, MATCH_W + 1):
                j = i + d
                if 0 <= j < n and sim[j]['onset']:
                    best = max(best, sim[j]['gain'])
            got += best
        recall = got / len(impacts)
    else:
        recall = 1.0

    # -- purity: was there percussive evidence where we fired? -------------
    if onsets:
        purity = sum(ev[i] * sim[i]['gain'] + (1.0 - sim[i]['gain']) * 0.5
                     for i in onsets) / len(onsets)
    else:
        purity = 0.0

    # -- firing rate plausibility ------------------------------------------
    # musical snare density sits between the backbeat (~1/s) and a
    # sixteenth-note roll (~4.2/s at 126 BPM). Reference = labelled impacts.
    rate = len(onsets) / track['secs']
    ref = max(0.8, len(impacts) / track['secs'])
    ratio = rate / ref
    if ratio <= 1.0:
        rate_score = ratio
    elif ratio <= 2.2:                      # rolls / ghost notes are legitimate
        rate_score = 1.0
    else:
        rate_score = max(0.0, 1.0 - (ratio - 2.2) / 3.0)

    n_dens = sum(1 for s in sim if s['path'] == 'DENSITY')
    return recall, purity, rate_score, len(onsets), n_dens


def fitness(corpus, p, detail=False):
    total, rows = 0.0, []
    dens_ok = True
    for t in corpus:
        sim = simulate(t['frames'], p)
        rec, pur, rat, n_on, n_dn = score_track(t, sim)
        wr, wp, wt = WEIGHTS[t['cat']]
        s = (wr * rec + wp * pur + wt * rat) / (wr + wp + wt)
        total += s
        if t['cat'] == 'DENSITY' and t['base_density'] > 0:
            if n_dn < 0.80 * t['base_density']:
                dens_ok = False
        if detail:
            rows.append((t['name'], t['cat'], rec, pur, rat, n_on,
                         t['base_onsets'], len(t['impacts']), n_dn,
                         t['base_density'], s))
    total /= len(corpus)
    if not dens_ok:                      # hard constraint: keep the rescue path
        total *= 0.75
    return (total, rows) if detail else total


# ---------------------------------------------------------------------------
SPACE = {
    'floor':         (0.010, 0.070),
    'floor_min':     (0.001, 0.020),
    'bfct_floor':    (0.300, 1.000),
    's_refr':        (2, 8),
    'g_refr':        (2, 10),
    'wns_floor':     (0.020, 0.250),
    'wns_knee':      (0.150, 0.600),
    'flux_floor':    (0.020, 0.150),
    'flux_knee':     (0.150, 0.500),
    'crack_wns_th':  (0.020, 0.150),
    'crack_flux_th': (0.150, 0.400),
    'crack_atten':   (0.100, 0.600),
}
INTS = {'s_refr', 'g_refr'}
# flatness is censored in the telemetry (capture floor == knee == 0.10), so
# snareVetoFlatnessFloor/Knee are held fixed and reported as non-identifiable.
FIXED = {'flat_floor': 0.10, 'flat_knee': 0.10}


def sample(rng):
    kw = dict(FIXED)
    for k, (lo, hi) in SPACE.items():
        kw[k] = rng.randint(lo, hi) if k in INTS else rng.uniform(lo, hi)
    return Params(**kw)


def perturb(rng, base, sigma):
    kw = dict(FIXED)
    for k, (lo, hi) in SPACE.items():
        cur = getattr(base, k)
        if k in INTS:
            v = cur + rng.choice([-1, 0, 1]) if rng.random() < sigma else cur
            kw[k] = max(lo, min(hi, int(v)))
        else:
            v = cur + rng.gauss(0, sigma * (hi - lo))
            kw[k] = max(lo, min(hi, v))
    return Params(**kw)


def main():
    rng = random.Random(0xC1AB)
    corpus = load_corpus()
    print("=" * 100)
    print("MONTE CARLO -- CLUB SNARE COEFFICIENTS")
    print("=" * 100)
    print(f"corpus: {len(corpus)} logs | "
          f"{sum(len(t['frames']) for t in corpus)} frames | "
          f"{sum(len(t['impacts']) for t in corpus)} labelled impacts")

    base_fit, base_rows = fitness(corpus, CAPTURE, detail=True)
    print(f"baseline (WAVE 7774) fitness = {base_fit:.4f}\n")

    # ---- Stage A: coarse random exploration ------------------------------
    N_A = 7000
    best = [(base_fit, CAPTURE)]
    for i in range(N_A):
        p = sample(rng)
        f = fitness(corpus, p)
        best.append((f, p))
        if (i + 1) % 1000 == 0:
            best.sort(key=lambda x: -x[0])
            best = best[:40]
            print(f"  stage A {i+1:>5}/{N_A}   best={best[0][0]:.4f}")
    best.sort(key=lambda x: -x[0])
    best = best[:12]
    print(f"stage A done -> {best[0][0]:.4f}\n")

    # ---- Stage B: simulated annealing around the elite -------------------
    N_B = 4500
    pool = list(best)
    for i in range(N_B):
        sigma = 0.18 * (1.0 - i / N_B) + 0.02
        seed = pool[rng.randrange(min(6, len(pool)))][1]
        p = perturb(rng, seed, sigma)
        f = fitness(corpus, p)
        pool.append((f, p))
        if (i + 1) % 750 == 0:
            pool.sort(key=lambda x: -x[0])
            pool = pool[:12]
            print(f"  stage B {i+1:>5}/{N_B}   best={pool[0][0]:.4f}  sigma={sigma:.3f}")
    pool.sort(key=lambda x: -x[0])
    champ_fit, champ = pool[0]

    print("\n" + "=" * 100)
    print(f"CHAMPION  fitness={champ_fit:.4f}   (baseline {base_fit:.4f}, "
          f"{100*(champ_fit-base_fit)/base_fit:+.1f}%)")
    print("=" * 100)
    for k in list(SPACE) + list(FIXED):
        cur, new = getattr(CAPTURE, k), getattr(champ, k)
        mark = '' if abs(cur - new) < 1e-9 else '  <-- CHANGED'
        if k in INTS:
            print(f"  {k:<16} {cur:>8}  ->  {new:>8}{mark}")
        else:
            print(f"  {k:<16} {cur:>8.4f}  ->  {new:>8.4f}{mark}")

    # ---- per-track report -------------------------------------------------
    _, rows = fitness(corpus, champ, detail=True)
    print("\n" + "-" * 100)
    print(f"{'track':<26}{'cat':<12}{'recall':>8}{'purity':>8}{'rate':>7}"
          f"{'ons':>6}{'was':>6}{'imp':>5}{'dens':>6}{'score':>7}")
    print("-" * 100)
    for (n, c, r, pu, ra, no, bo, ni, nd, bd, s), b in zip(rows, base_rows):
        print(f"{n:<26}{c:<12}{r:>8.3f}{pu:>8.3f}{ra:>7.3f}"
              f"{no:>6}{bo:>6}{ni:>5}{nd:>6}{s:>7.3f}")
    print("-" * 100)
    print(f"{'BASELINE for comparison':<38}{'recall':>8}{'purity':>8}{'rate':>7}")
    for r in base_rows:
        print(f"  {r[0]:<36}{r[2]:>8.3f}{r[3]:>8.3f}{r[4]:>7.3f}   score={r[10]:.3f}")

    # ---- sensitivity: how much does each axis matter alone? --------------
    print("\n" + "-" * 100)
    print("SENSITIVITY (champion with one axis reverted to baseline)")
    print("-" * 100)
    sens = []
    for k in SPACE:
        kw = champ.as_dict(); kw[k] = getattr(CAPTURE, k)
        sens.append((champ_fit - fitness(corpus, Params(**kw)), k))
    for d, k in sorted(sens, reverse=True):
        bar = '#' * max(0, int(d * 900))
        print(f"  {k:<16}{d:>+9.4f}  {bar}")

    with open(os.path.join(HERE, 'mc_result.json'), 'w') as fh:
        json.dump({'fitness': champ_fit, 'baseline': base_fit,
                   'params': champ.as_dict(),
                   'runners_up': [{'fitness': f, 'params': p.as_dict()}
                                  for f, p in pool[1:6]]}, fh, indent=2)
    print(f"\nwritten: mc_result.json")


if __name__ == '__main__':
    main()
