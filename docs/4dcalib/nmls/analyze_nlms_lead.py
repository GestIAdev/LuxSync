#!/usr/bin/env python3
"""Diagnose whether kick's HF click LEADS the LF bass, defeating the memoryless NLMS."""
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

def analyze_lead(name, audits):
    print("=" * 78)
    print(f"  {name}  ({len(audits)} frames)")
    print("=" * 78)
    onsets = [(i, a) for i, a in enumerate(audits) if a['onset']]

    print("\n  HYPOTHESIS: kick's HF click hits crack band BEFORE the LF bass peaks.")
    print("  A memoryless predictor k*bassE[n] cannot cancel a bleed that LEADS bassE.")
    print()
    lead = 0
    for i, a in onsets:
        future = [audits[j]['BassE'] for j in range(i + 1, min(i + 4, len(audits)))]
        rises = any(f > a['BassE'] + 0.03 for f in future)
        pred = a['k'] * a['BassE']
        maxfut = max(future) if future else a['BassE']
        predfut = a['k'] * maxfut
        tag = ""
        if rises:
            lead += 1
            tag = f"  <<CLICK LEADS: bassE {a['BassE']:.3f}->{maxfut:.3f}, pred would be {predfut:.3f}"
        print(f"    f={i:3d} UnG={a['UnG']:.3f} k={a['k']:.3f} bE={a['BassE']:.3f} "
              f"pred={pred:.3f} Res={a['Res']:.3f} bD={a['BassDelta']:+.3f} "
              f"Dr={a['Drive']:.4f}{tag}")
    print(f"\n  Onsets where bass rises AFTER onset (click leads): {lead}/{len(onsets)}")

    # How much residual would vanish if we used the FORWARD-LOOKING max bass?
    print("\n  COUNTERFACTUAL: residual if predictor used max(bassE) over [n, n+3]:")
    killed = 0
    for i, a in onsets:
        window = [audits[j]['BassE'] for j in range(i, min(i + 4, len(audits)))]
        maxb = max(window)
        pred_fwd = a['k'] * maxb
        res_fwd = max(0.0, a['UnG'] - pred_fwd)
        drive_fwd = res_fwd * a['cFx'] * a['bFct'] * a['sEF']
        verdict = ""
        if drive_fwd < a['dynTh'] and a['Drive'] >= a['dynTh']:
            killed += 1
            verdict = "  <<WOULD BE KILLED"
        elif drive_fwd < a['Drive'] * 0.5:
            verdict = "  (halved)"
        print(f"    f={i:3d} Res {a['Res']:.3f}->{res_fwd:.3f}  "
              f"Drive {a['Drive']:.4f}->{drive_fwd:.4f}  th={a['dynTh']:.3f}{verdict}")
    print(f"\n  Onsets that a look-ahead predictor would kill: {killed}/{len(onsets)}")

def main():
    for name, fname in [('MINIMAL calib4', 'minimalcalib4.md'),
                        ('BREJCHA calib4', 'gravitycalib4.md')]:
        path = os.path.join(LOG_DIR, fname)
        if os.path.exists(path):
            analyze_lead(name, parse(path))
            print()

if __name__ == '__main__':
    main()
