#!/usr/bin/env python3
"""Analyze the 5 calib3 logs with WAVE 7749.82 telemetry."""
import re
import os

LOG_DIR = r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm"

FIELDS = ['SnareE','UnG','RawDelta','Flux','WNS','fBL','Gate','Veto',
          'BassE','BassDelta','k','Res','cFx','bFct','sEF','Drive',
          'dynTh','sd','hE','hhDlt','ghst','OutSnare','OutKick']

def parse_log(filepath):
    audits = []
    onsets = []
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            if '[FINESSE_AUDIT]' not in line:
                continue
            entry = {'frameIdx': len(audits)}
            for field in FIELDS:
                m = re.search(rf'{field}:([-\d.]+)', line)
                entry[field] = float(m.group(1)) if m else 0.0
            entry['isOnset'] = '[ONSET]' in line
            entry['isKick'] = '[KICK]' in line
            audits.append(entry)
            if entry['isOnset']:
                onsets.append(entry)
    return audits, onsets

def analyze(name, audits, onsets):
    print(f"\n{'='*70}")
    print(f"  {name.upper()} — {len(audits)} frames, {len(onsets)} onsets")
    print(f"{'='*70}")
    if not audits:
        print("  NO DATA")
        return

    sds = [a['sd'] for a in audits]
    hEs = [a['hE'] for a in audits]
    dynThs = [a['dynTh'] for a in audits]
    
    print(f"\n  MACRO VARIABLES:")
    print(f"    sd  (spectralDensity):  {min(sds):.3f} — {max(sds):.3f}  mean={sum(sds)/len(sds):.3f}")
    print(f"    hE  (hh_energy):        {min(hEs):.3f} — {max(hEs):.3f}  mean={sum(hEs)/len(hEs):.3f}")
    print(f"    dynTh:                  {min(dynThs):.3f} — {max(dynThs):.3f}  mean={sum(dynThs)/len(dynThs):.3f}")
    
    hhDlt_nz = sum(1 for a in audits if a['hhDlt'] > 0.001)
    ghst_nz = sum(1 for a in audits if a['ghst'] > 0.001)
    print(f"\n  GHOST PATH:")
    print(f"    hhDlt > 0.001: {hhDlt_nz}/{len(audits)} ({100*hhDlt_nz/len(audits):.1f}%)")
    print(f"    ghst  > 0.001: {ghst_nz}/{len(audits)} ({100*ghst_nz/len(audits):.1f}%)")
    
    print(f"\n  ONSET ANALYSIS ({len(onsets)} onsets):")
    strong = [o for o in onsets if o['Drive'] > 0.05]
    weak = [o for o in onsets if o['Drive'] <= 0.05]
    kick_onsets = [o for o in onsets if o['isKick']]
    print(f"    Strong (Drive>0.05): {len(strong)}")
    print(f"    Weak   (Drive<=0.05): {len(weak)}")
    print(f"    Kick-coincident: {len(kick_onsets)}")
    
    doubles = 0
    for i in range(1, len(onsets)):
        gap = onsets[i]['frameIdx'] - onsets[i-1]['frameIdx']
        if gap <= 4:
            doubles += 1
    print(f"    Potential doubles (gap<=4 frames): {doubles}")
    
    # Show all onsets
    for i, o in enumerate(onsets):
        gap = ""
        if i > 0:
            g = o['frameIdx'] - onsets[i-1]['frameIdx']
            if g <= 4:
                gap = f" <<DOUBLE (gap={g})>>"
            elif g > 20:
                gap = f" [gap={g}]"
        print(f"    [{i:2d}] f={o['frameIdx']:3d} D:{o['Drive']:.4f} th:{o['dynTh']:.3f} "
              f"SnE:{o['SnareE']:.3f} Res:{o['Res']:.3f} cFx:{o['cFx']:.3f} "
              f"bF:{o['bFct']:.3f} sEF:{o['sEF']:.3f} "
              f"sd:{o['sd']:.3f} hE:{o['hE']:.3f}"
              f"{' [KICK]' if o['isKick'] else ''}{gap}")
    
    ks = [a['k'] for a in audits]
    print(f"\n  NLMS k: {min(ks):.3f}—{max(ks):.3f} mean={sum(ks)/len(ks):.3f}")

def main():
    files = [
        ('gravitycalib3 (Brejcha)', 'gravitycalib3.md'),
        ('tiestocalib3 (Tiesto DARK)', 'tiestocalib3.md'),
        ('tiestocalib31 (Tiesto LIGHT)', 'tiestocalib31.md'),
        ('techhousecalib3 (TechHouse)', 'techhousecalib3.md'),
        ('minimalcalib3 (Minimal)', 'minimalcalib3.md'),
    ]
    for name, fname in files:
        path = os.path.join(LOG_DIR, fname)
        if os.path.exists(path):
            audits, onsets = parse_log(path)
            analyze(name, audits, onsets)
        else:
            print(f"\n  {name}: FILE NOT FOUND")

if __name__ == '__main__':
    main()
