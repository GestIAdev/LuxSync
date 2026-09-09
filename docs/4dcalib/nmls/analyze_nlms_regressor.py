#!/usr/bin/env python3
"""Is bassE the right regressor for kick bleed? Test bassE (level) vs bassDelta (transient)."""
import re
import os

LOG_DIR = r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm"
FIELDS = ['SnareE','UnG','RawDelta','Res','cFx','bFct','sEF','Drive',
          'BassE','BassDelta','k','dynTh','sd','hE']

def parse(path):
    audits = []
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            if '[FINESSE_AUDIT]' not in line:
                continue
            e = {}
            for fld in FIELDS:
                m = re.search(rf'{fld}:([-\d.]+)', line)
                e[fld] = float(m.group(1)) if m else 0.0
            e['onset'] = '[ONSET]' in line
            e['kick'] = '[KICK]' in line
            audits.append(e)
    return audits

def corr(xs, ys):
    n = len(xs)
    if n < 2:
        return 0.0
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = sum((x - mx) ** 2 for x in xs) ** 0.5
    dy = sum((y - my) ** 2 for y in ys) ** 0.5
    return num / (dx * dy) if dx > 0 and dy > 0 else 0.0

def analyze(name, audits):
    print("=" * 78)
    print(f"  {name}  ({len(audits)} frames)")
    print("=" * 78)

    ung = [a['UnG'] for a in audits]
    bE = [a['BassE'] for a in audits]
    bD = [a['BassDelta'] for a in audits]

    print("\n  REGRESSOR QUALITY (correlation with raw crack UnG):")
    print(f"    corr(UnG, bassE)     = {corr(ung, bE):+.3f}   <- what NLMS uses")
    print(f"    corr(UnG, bassDelta) = {corr(ung, bD):+.3f}   <- the transient")

    # Is bassE saturated (continuous bassline)?
    print("\n  IS bassE SATURATED (continuous bassline = useless regressor)?")
    hi = sum(1 for b in bE if b > 0.65)
    print(f"    frames with bassE > 0.65: {hi}/{len(bE)} = {100*hi/len(bE):.0f}%")
    print(f"    bassE mean={sum(bE)/len(bE):.3f}  min={min(bE):.3f}  max={max(bE):.3f}")
    print(f"    bassE dynamic range = {max(bE)-min(bE):.3f}")

    # What does k converge to vs what it SHOULD be?
    # On non-onset, non-snare frames (SnareE < 0.05), all crack is bleed:
    # k_true = UnG / bassE
    pure = [a for a in audits if a['SnareE'] < 0.05 and a['BassE'] > 0.3 and not a['onset']]
    if pure:
        ratios = sorted(a['UnG'] / a['BassE'] for a in pure)
        ks = [a['k'] for a in pure]
        print(f"\n  TRUE COUPLING on bleed-only frames (SnareE<0.05, {len(pure)} frames):")
        print(f"    UnG/bassE  median={ratios[len(ratios)//2]:.3f}  "
              f"p90={ratios[int(len(ratios)*0.9)]:.3f}  max={ratios[-1]:.3f}")
        print(f"    k actual   mean={sum(ks)/len(ks):.3f}")
        print(f"    => k is {'UNDER' if sum(ks)/len(ks) < ratios[int(len(ratios)*0.9)] else 'OVER'}-converged "
              f"vs p90 coupling")

    # The asymmetric-mu bias test: how often is bleedErr negative?
    # bleedErr < 0 => mu=0.05 (FAST DOWN). If this dominates, k is dragged down.
    neg = sum(1 for a in audits if a['UnG'] < a['k'] * a['BassE'])
    pos = len(audits) - neg
    print(f"\n  ASYMMETRIC-MU BIAS (mu_up=0.015 slow, mu_down=0.05 fast):")
    print(f"    frames with bleedErr < 0 (k pulled DOWN fast): {neg}/{len(audits)} = {100*neg/len(audits):.0f}%")
    print(f"    frames with bleedErr > 0 (k pushed UP slow):   {pos}/{len(audits)} = {100*pos/len(audits):.0f}%")
    eff_down = neg * 0.05
    eff_up = pos * 0.015
    print(f"    effective pull: DOWN={eff_down:.1f} vs UP={eff_up:.1f} "
          f"=> k biased {'DOWNWARD' if eff_down > eff_up else 'UPWARD'}")

    # Residual on bleed-only frames: is the filter even working?
    if pure:
        res_pure = [a['Res'] for a in pure]
        leaked = sum(1 for r in res_pure if r > 0.10)
        print(f"\n  FILTER EFFECTIVENESS on bleed-only frames:")
        print(f"    Res mean={sum(res_pure)/len(res_pure):.3f}")
        print(f"    frames leaking Res>0.10: {leaked}/{len(pure)} = {100*leaked/len(pure):.0f}%")

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
