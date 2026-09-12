#!/usr/bin/env python3
"""
Monte Carlo -- Stage 5: falsification.

Two questions the raw fitness number cannot answer:
  1. WHICH code path emits the low-evidence onsets? Tuning the MACD floor is
     pointless if the garbage arrives through the bypass or density rescue.
  2. Does the champion generalise, or did the search memorise 12 logs?
     Answered with a split-half protocol: optimise on one half, score the
     untouched half.
"""
import os, sys, random, json

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from _mc_sim import Params, CAPTURE, simulate
from _mc_run import (load_corpus, fitness, sample, perturb, SPACE, FIXED,
                     score_track, WEIGHTS)


def path_attribution(corpus, p, tag):
    print("=" * 104)
    print(f"PATH ATTRIBUTION -- {tag}")
    print("=" * 104)
    print(f"{'track':<26}{'cat':<12}{'MACD':>14}{'BYPASS':>14}"
          f"{'DENSITY':>14}{'lowEv%':>9}")
    print("-" * 104)
    agg = {}
    for t in corpus:
        sim = simulate(t['frames'], p)
        ev = t['ev']
        buckets = {'MACD': [], 'BYPASS': [], 'DENSITY': []}
        for i, s in enumerate(sim):
            if s['onset']:
                buckets[s['path']].append(ev[i])
        row = f"{t['name']:<26}{t['cat']:<12}"
        n_all = sum(len(v) for v in buckets.values())
        n_low = sum(1 for v in buckets.values() for e in v if e < 0.35)
        for k in ('MACD', 'BYPASS', 'DENSITY'):
            v = buckets[k]
            a = agg.setdefault(k, [0, 0.0, 0])
            a[0] += len(v); a[1] += sum(v)
            a[2] += sum(1 for e in v if e < 0.35)
            row += f"{len(v):>6} ev{(sum(v)/len(v) if v else 0):>6.2f}"
        row += f"{(100*n_low/n_all if n_all else 0):>8.0f}%"
        print(row)
    print("-" * 104)
    print(f"{'CORPUS TOTAL':<38}", end='')
    for k in ('MACD', 'BYPASS', 'DENSITY'):
        n, s, lo = agg[k]
        print(f"{n:>6} ev{(s/n if n else 0):>6.2f}", end='')
    print()
    tn = sum(agg[k][0] for k in agg)
    tl = sum(agg[k][2] for k in agg)
    print(f"\nonsets={tn}   low-evidence (ev<0.35)={tl} ({100*tl/tn:.0f}%)")
    for k in ('MACD', 'BYPASS', 'DENSITY'):
        n, s, lo = agg[k]
        if n:
            print(f"   {k:<8} {n:>4} onsets, {lo:>4} low-evidence "
                  f"({100*lo/n:>3.0f}% of path, {100*lo/tn:>3.0f}% of all)")
    print()
    return agg


def search(corpus, iters_a, iters_b, seed):
    rng = random.Random(seed)
    best = [(fitness(corpus, CAPTURE), CAPTURE)]
    for _ in range(iters_a):
        p = sample(rng)
        best.append((fitness(corpus, p), p))
        if len(best) > 200:
            best.sort(key=lambda x: -x[0]); best = best[:20]
    best.sort(key=lambda x: -x[0]); pool = best[:8]
    for i in range(iters_b):
        sig = 0.18 * (1 - i / max(1, iters_b)) + 0.02
        p = perturb(rng, pool[rng.randrange(len(pool))][1], sig)
        pool.append((fitness(corpus, p), p))
        if len(pool) > 60:
            pool.sort(key=lambda x: -x[0]); pool = pool[:8]
    pool.sort(key=lambda x: -x[0])
    return pool[0]


def main():
    corpus = load_corpus()
    champ = Params(**json.load(open(os.path.join(HERE, 'mc_result.json')))['params'])

    path_attribution(corpus, CAPTURE, 'BASELINE (WAVE 7774)')
    path_attribution(corpus, champ, 'MONTE CARLO CHAMPION')

    # ---------------- split-half generalisation ---------------------------
    print("=" * 104)
    print("SPLIT-HALF VALIDATION (optimise on one half, score the other)")
    print("=" * 104)
    order = sorted(corpus, key=lambda t: (t['cat'], t['name']))
    A = [t for i, t in enumerate(order) if i % 2 == 0]
    B = [t for i, t in enumerate(order) if i % 2 == 1]
    print(f"fold A: {', '.join(t['name'][:20] for t in A)}")
    print(f"fold B: {', '.join(t['name'][:20] for t in B)}\n")

    rows = []
    for name, tr, te, seed in (('A->B', A, B, 11), ('B->A', B, A, 22)):
        f_tr, p_tr = search(tr, 2500, 1500, seed)
        base_te = fitness(te, CAPTURE)
        held_te = fitness(te, p_tr)
        champ_te = fitness(te, champ)
        rows.append((name, base_te, held_te, champ_te))
        print(f"{name}:  train_fit={f_tr:.4f}   "
              f"held-out baseline={base_te:.4f}   "
              f"held-out tuned={held_te:.4f} ({100*(held_te-base_te)/base_te:+.1f}%)   "
              f"held-out full-champion={champ_te:.4f}")

    print("\n" + "-" * 104)
    gen = sum(r[2] - r[1] for r in rows) / len(rows)
    print(f"mean held-out gain of an independently-trained set: {gen:+.4f}")
    if gen > 0.005:
        print("VERDICT: the gain transfers to unseen tracks -- signal, not memorisation.")
    else:
        print("VERDICT: the gain does NOT transfer -- the search is fitting noise.")


if __name__ == '__main__':
    main()
