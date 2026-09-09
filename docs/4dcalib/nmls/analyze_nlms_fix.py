#!/usr/bin/env python3
"""Validate the kick-click veto: hold snare 1 frame, veto if bass booms next frame."""
import re
import os

LOG_DIR = r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm"

# NOTE: the log uses unicode delta for RawDelta/BassDelta
FIELD_RE = {
    'SnareE': r'SnareE:([-\d.]+)',
    'UnG': r'UnG:([-\d.]+)',
    'RawD': r'Raw[\u0394\u2206D][a-z]*:([-\d.]+)',
    'Res': r'Res:([-\d.]+)',
    'cFx': r'cFx:([-\d.]+)',
    'bFct': r'bFct:([-\d.]+)',
    'sEF': r'sEF:([-\d.]+)',
    'Drive': r'Drive:([-\d.]+)',
    'BassE': r'BassE:([-\d.]+)',
    'BassD': r'Bass[\u0394\u2206D][a-z]*:([-\d.]+)',
    'k': r' k:([-\d.]+)',
    'dynTh': r'dynTh:([-\d.]+)',
    'sd': r'sd:([-\d.]+)',
    'hE': r'hE:([-\d.]+)',
    'WNS': r'WNS:([-\d.]+)',
    'Flux': r'Flux:([-\d.]+)',
}

def parse(path):
    audits = []
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            if '[FINESSE_AUDIT]' not in line:
                continue
            e = {}
            for name, rx in FIELD_RE.items():
                m = re.search(rx, line)
                e[name] = float(m.group(1)) if m else 0.0
            e['onset'] = '[ONSET]' in line
            e['kick'] = '[KICK]' in line
            audits.append(e)
    return audits

def corr(xs, ys):
    n = len(xs)
    if n < 2:
        return 0.0
    mx, my = sum(xs)/n, sum(ys)/n
    num = sum((x-mx)*(y-my) for x, y in zip(xs, ys))
    dx = sum((x-mx)**2 for x in xs)**0.5
    dy = sum((y-my)**2 for y in ys)**0.5
    return num/(dx*dy) if dx > 0 and dy > 0 else 0.0

def analyze(name, audits):
    print("=" * 78)
    print(f"  {name}  ({len(audits)} frames)")
    print("=" * 78)

    ung = [a['UnG'] for a in audits]
    print("\n  REGRESSOR CORRELATIONS with raw crack (UnG):")
    for fld in ['BassE', 'BassD', 'RawD', 'Flux']:
        print(f"    corr(UnG, {fld:6s}) = {corr(ung, [a[fld] for a in audits]):+.3f}")

    onsets = [(i, a) for i, a in enumerate(audits) if a['onset']]
    print(f"\n  KICK-CLICK VETO TEST on {len(onsets)} onsets")
    print("  Rule: veto if bassE rises > TH within the next 2 frames (kick boom follows click)")
    print()
    for th in (0.05, 0.08, 0.10, 0.15):
        vetoed_real = 0   # SnareE >= 0.30 => likely real snare
        vetoed_fp = 0     # SnareE <  0.30 => likely kick click / synth
        kept_real = 0
        kept_fp = 0
        for i, a in onsets:
            fut = [audits[j]['BassE'] for j in range(i+1, min(i+3, len(audits)))]
            boom = any(f - a['BassE'] > th for f in fut)
            real = a['SnareE'] >= 0.30
            if boom:
                if real: vetoed_real += 1
                else:    vetoed_fp += 1
            else:
                if real: kept_real += 1
                else:    kept_fp += 1
        tot_real = vetoed_real + kept_real
        tot_fp = vetoed_fp + kept_fp
        print(f"    TH={th:.2f}: vetoed {vetoed_real+vetoed_fp:2d}  "
              f"| real snares lost {vetoed_real}/{tot_real}  "
              f"| FP/clicks killed {vetoed_fp}/{tot_fp}")

    # Show per-onset detail at TH=0.08
    print("\n  DETAIL (TH=0.08):")
    for i, a in onsets:
        fut = [audits[j]['BassE'] for j in range(i+1, min(i+3, len(audits)))]
        rise = max((f - a['BassE'] for f in fut), default=0.0)
        boom = rise > 0.08
        real = a['SnareE'] >= 0.30
        mark = "VETO" if boom else "keep"
        kind = "REAL" if real else "susp"
        print(f"    f={i:3d} {mark} [{kind}] SnE={a['SnareE']:.3f} bE={a['BassE']:.3f} "
              f"rise=+{rise:.3f} Res={a['Res']:.3f} Dr={a['Drive']:.4f} WNS={a['WNS']:.3f}")

def main():
    for name, fname in [('MINIMAL calib4', 'minimalcalib4.md'),
                        ('BREJCHA calib4', 'gravitycalib4.md'),
                        ('TECHHOUSE calib4', 'techhouse4.md'),
                        ('TIESTO calib4', 'tiestocalib4.md')]:
        path = os.path.join(LOG_DIR, fname)
        if os.path.exists(path):
            analyze(name, parse(path))
            print()

if __name__ == '__main__':
    main()
