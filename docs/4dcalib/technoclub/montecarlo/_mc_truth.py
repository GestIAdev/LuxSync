#!/usr/bin/env python3
"""
Monte Carlo — Stage 2: Ground-truth construction.

The detector under test is the MACD/Drive chain (Res x cFx x bFct x sEF).
To avoid a circular fitness we need labels that come from a DIFFERENT code
path. Two independent sources exist in the telemetry:

  A) SnareE  -- the GodEarFFT AND-gate (body > 2.0x bodyEMA AND crack > 1.8x
                crackEMA), computed in the FFT worker. Completely independent
                of the MACD chain. Trustworthy ONLY when the gate is alive.

  B) hhDlt   -- raw 5-15kHz transient delta, pre-EMA, also from the worker.
                Independent of Res/cFx/bFct. Usable when the gate is dead.

This stage builds candidate impact labels from A/B, then validates them
against the metric grid (BPM) to prove they are musical events and not noise.
"""
import os, sys, statistics as st
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _mc_parse import parse_file, DIR, q

FPS = 44.0

# Track taxonomy driven by the Stage-1 inventory (gate health + snare energy).
CATEGORY = {
    'carlcoxacid.md':           'PERCUSSIVE',   # Tech House acid, gate alive
    'borisgravity.md':          'PERCUSSIVE',
    'minimaldroplex.md':        'PERCUSSIVE',   # Minimal, aggressive hi-hats
    'florianpicasso.md':        'PERCUSSIVE',
    'purplenoisebrejcha.md':    'PERCUSSIVE',   # Brejcha minimal
    'thebussinesstiesto.md':    'COMMERCIAL',
    'dontbeshytiestokarolg2.md':'COMMERCIAL',   # vocals (Karol G)
    'edm3.md':                  'COMMERCIAL',
    'iloveiticonapop.md':       'COMMERCIAL',   # vocals, brickwall
    'edm1.md':                  'COMMERCIAL',
    'edm2.md':                  'COMMERCIAL',
    'buildredoblemimnimal.md':  'DENSITY',      # white-noise buildup + roll
}


def rising_edges(vals, lo, hi, min_gap=3):
    """Indices where a signal crosses from below `lo` up through `hi`."""
    out, armed, last = [], True, -99
    for i, v in enumerate(vals):
        if v < lo:
            armed = True
        elif v >= hi and armed and (i - last) >= min_gap:
            out.append(i)
            armed = False
            last = i
    return out


def impact_labels(frames):
    """
    Independent impact candidates.
      gate alive (gH>0.30): SnareE rising edge  -- GodEarFFT AND-gate
      gate dead:            hhDlt spike + UnG   -- raw treble transient
    """
    n = len(frames)
    gh = [f.get('gH', 0) for f in frames]
    alive = st.median(gh) > 0.30

    if alive:
        sne = [f.get('SnareE', 0) for f in frames]
        peak = q([v for v in sne if v > 0.01], 0.75) or 0.3
        idx = rising_edges(sne, lo=0.55 * peak, hi=0.90 * peak, min_gap=4)
        src = 'SnareE-gate'
    else:
        hh = [f.get('hhDlt', 0) for f in frames]
        ung = [f.get('UnG', 0) for f in frames]
        hi = max(0.18, q([v for v in hh if v > 0.001], 0.70))
        idx = [i for i in rising_edges(hh, lo=0.35 * hi, hi=hi, min_gap=4)
               if ung[i] > 0.45]
        src = 'hhDlt-transient'
    return idx, src, alive


def grid_alignment(frames, idx):
    """
    Fraction of labelled impacts that land on a 16th-note grid position.
    Uses the median BPM of the log; phase is fitted by brute force so we do
    not depend on the PLL beat counter being correct.
    """
    if len(idx) < 4:
        return 0.0, 0.0
    bpm = st.median([f['_bpm'] for f in frames]) or 120.0
    sixteenth = (60.0 / bpm) * FPS / 4.0          # frames per 16th
    best = 0.0
    for k in range(64):                            # phase sweep
        ph = k * sixteenth / 64.0
        hits = 0
        for i in idx:
            r = ((i - ph) % sixteenth) / sixteenth
            d = min(r, 1.0 - r) * sixteenth        # frames to nearest 16th
            if d <= 1.6:
                hits += 1
        best = max(best, hits / len(idx))
    return best, sixteenth


def main():
    files = sorted(x for x in os.listdir(DIR) if x.endswith('.md'))
    print("=" * 112)
    print("GROUND TRUTH -- independent impact labels + metric-grid validation")
    print("=" * 112)
    print(f"{'file':<26}{'cat':<12}{'src':<17}{'imp':>5}{'imp/s':>7}"
          f"{'grid16':>8}{'ons':>5}{'ons/s':>7}{'bpm':>6}{'16th_f':>8}")
    print("-" * 112)

    store = {}
    for fn in files:
        fr = parse_file(os.path.join(DIR, fn))
        if not fr:
            continue
        idx, src, alive = impact_labels(fr)
        grid, sixteenth = grid_alignment(fr, idx)
        ons = sum(1 for f in fr if f['_onset'])
        secs = len(fr) / FPS
        cat = CATEGORY.get(fn, '?')
        store[fn] = {'frames': fr, 'impacts': idx, 'cat': cat, 'alive': alive}
        print(f"{fn:<26}{cat:<12}{src:<17}{len(idx):>5}{len(idx)/secs:>7.2f}"
              f"{grid:>8.2f}{ons:>5}{ons/secs:>7.2f}"
              f"{st.median([f['_bpm'] for f in fr]):>6.0f}{sixteenth:>8.2f}")
    print("-" * 112)

    # ---- Feature separability: labelled impacts vs. quiet tonal frames ----
    print("\nFEATURE SEPARABILITY (median at labelled impact  vs  median at "
          "high-UnG non-impact)")
    print("-" * 112)
    print(f"{'file':<26}{'Raw\u0394':>14}{'cFx':>14}{'Res':>14}{'WNS':>14}"
          f"{'Flux':>14}{'hhDlt':>14}")
    print("-" * 112)
    for fn, d in store.items():
        fr, idx = d['frames'], set(d['impacts'])
        near = set()
        for i in idx:
            near.update(range(i - 2, i + 3))
        pos = [fr[i] for i in idx if 0 <= i < len(fr)]
        neg = [f for j, f in enumerate(fr)
               if j not in near and f.get('UnG', 0) > 0.45]
        if not pos or not neg:
            continue
        row = f"{fn:<26}"
        for k in ['Raw\u0394', 'cFx', 'Res', 'WNS', 'Flux', 'hhDlt']:
            mp = st.median([f.get(k, 0) for f in pos])
            mn = st.median([f.get(k, 0) for f in neg])
            row += f"{mp:>7.3f}/{mn:<6.3f}"
        print(row)
    print("-" * 112)
    return store


if __name__ == '__main__':
    main()
