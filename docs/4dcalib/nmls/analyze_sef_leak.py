#!/usr/bin/env python3
"""Prove the sEF relaxation (WAVE 7749.81) is what lets kick clicks through."""
import re
import os

LOG_DIR = r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm"

FIELD_RE = {
    'SnareE': r'SnareE:([-\d.]+)', 'UnG': r'UnG:([-\d.]+)',
    'Res': r'Res:([-\d.]+)', 'cFx': r'cFx:([-\d.]+)', 'bFct': r'bFct:([-\d.]+)',
    'sEF': r'sEF:([-\d.]+)', 'Drive': r'Drive:([-\d.]+)',
    'BassE': r'BassE:([-\d.]+)', 'k': r' k:([-\d.]+)',
    'dynTh': r'dynTh:([-\d.]+)', 'sd': r'sd:([-\d.]+)', 'hE': r'hE:([-\d.]+)',
    'WNS': r'WNS:([-\d.]+)', 'Flux': r'Flux:([-\d.]+)',
    'hhDlt': r'hhDlt:([-\d.]+)', 'ghst': r'ghst:([-\d.]+)',
}

def parse(path):
    out = []
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            if '[FINESSE_AUDIT]' not in line:
                continue
            e = {n: (float(m.group(1)) if (m := re.search(rx, line)) else 0.0)
                 for n, rx in FIELD_RE.items()}
            e['onset'] = '[ONSET]' in line
            out.append(e)
    return out

def analyze(name, audits):
    print("=" * 78)
    print(f"  {name}")
    print("=" * 78)
    onsets = [(i, a) for i, a in enumerate(audits) if a['onset']]

    # Reconstruct sEF components and test: what if relaxation were removed?
    print(f"\n  {len(onsets)} onsets. Testing removal of the sEF relaxation floor.")
    print("  strictSef = min(1, SnareE*2)   [no relaxation]")
    print("  relaxed   = 0.05 + 0.35*min(1,hE*2)*(1-sd)   [current WAVE 7749.81]")
    print()
    killed = kept = 0
    rows = []
    for i, a in onsets:
        treble = min(1.0, a['hE'] * 2.0)
        gate = 1.0 - a['sd']
        relaxed = 0.05 + 0.35 * treble * gate
        strict = min(1.0, a['SnareE'] * 2.0)
        # Drive with strict sEF only
        base = a['Res'] * a['cFx'] * a['bFct']
        drive_strict = base * strict
        fires = drive_strict >= a['dynTh']
        if fires:
            kept += 1
        else:
            killed += 1
        rows.append((i, a, relaxed, strict, drive_strict, fires))

    print(f"  Result: {kept} onsets survive, {killed} would be KILLED by removing relaxation")
    print()
    print("   frame  SnE    sEF_now relax strict  Drive_now -> Drive_strict  th     verdict")
    for i, a, relaxed, strict, ds, fires in rows:
        driven_by_relax = a['sEF'] <= relaxed + 1e-6
        flag = "RELAX-DRIVEN" if driven_by_relax else ""
        print(f"   f={i:3d} {a['SnareE']:.3f}  {a['sEF']:.3f}  {relaxed:.3f} {strict:.3f}  "
              f"{a['Drive']:.4f} -> {ds:.4f}  {a['dynTh']:.3f}  "
              f"{'KEEP' if fires else 'KILL'} {flag}")

    # Separability of SnareE at onsets
    lo = sorted(a['SnareE'] for _, a in onsets)
    print(f"\n  SnareE at onsets: min={lo[0]:.3f} p25={lo[len(lo)//4]:.3f} "
          f"med={lo[len(lo)//2]:.3f} max={lo[-1]:.3f}")
    zero = sum(1 for v in lo if v < 0.05)
    print(f"  onsets with SnareE < 0.05 (no crack-band coincidence): {zero}/{len(lo)}")

    # Is the ghost path alive?
    gh = sum(1 for a in audits if a['hhDlt'] > 0 or a['ghst'] > 0)
    print(f"  frames with live treble-ghost (hhDlt or ghst > 0): {gh}/{len(audits)}")

def main():
    for name, fname in [('MINIMAL calib4', 'minimalcalib4.md'),
                        ('BREJCHA calib4', 'gravitycalib4.md'),
                        ('TIESTO calib4', 'tiestocalib4.md'),
                        ('TECHHOUSE calib4', 'techhouse4.md')]:
        path = os.path.join(LOG_DIR, fname)
        if os.path.exists(path):
            analyze(name, parse(path))
            print()

if __name__ == '__main__':
    main()
