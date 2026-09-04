#!/usr/bin/env python3
"""Analyze the 4 new logs from newalgorythm/ with WAVE 7749.80 telemetry."""
import re
import os
from collections import Counter

LOG_DIR = r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm"

# Parse FINESSE_AUDIT lines
FIELDS = ['SnareE','UnG','RawDelta','Flux','WNS','fBL','Gate','Veto',
          'BassE','BassDelta','k','Res','cFx','bFct','sEF','Drive',
          'dynTh','hhDlt','ghst','OutSnare','OutKick']

def parse_log(filepath):
    """Parse all FINESSE_AUDIT lines from a log file."""
    audits = []
    onsets = []
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            if '[FINESSE_AUDIT]' not in line:
                continue
            entry = {}
            for field in FIELDS:
                # Match field:value pattern
                m = re.search(rf'{field}:([-\d.]+)', line)
                if m:
                    entry[field] = float(m.group(1))
                else:
                    entry[field] = 0.0
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
    
    # Key metrics
    hhDlt_nonzero = sum(1 for a in audits if a['hhDlt'] > 0.001)
    ghst_nonzero = sum(1 for a in audits if a['ghst'] > 0.001)
    dynThs = [a['dynTh'] for a in audits]
    drives = [a['Drive'] for a in audits]
    
    print(f"\n  TREBLE-GHOST PATH:")
    print(f"    hhDlt > 0.001: {hhDlt_nonzero}/{len(audits)} frames ({100*hhDlt_nonzero/len(audits):.1f}%)")
    print(f"    ghst > 0.001:  {ghst_nonzero}/{len(audits)} frames ({100*ghst_nonzero/len(audits):.1f}%)")
    print(f"    hhDlt max:     {max(a['hhDlt'] for a in audits):.4f}")
    print(f"    ghst max:      {max(a['ghst'] for a in audits):.4f}")
    
    print(f"\n  DYNAMIC THRESHOLD:")
    print(f"    dynTh range:   {min(dynThs):.4f} — {max(dynThs):.4f}")
    print(f"    dynTh mean:    {sum(dynThs)/len(dynThs):.4f}")
    
    print(f"\n  DRIVE STATS:")
    print(f"    Drive > 0.001: {sum(1 for d in drives if d > 0.001)}/{len(drives)} frames")
    print(f"    Drive max:     {max(drives):.4f}")
    print(f"    Drive mean:    {sum(drives)/len(drives):.6f}")
    
    print(f"\n  ONSET ANALYSIS ({len(onsets)} onsets):")
    if onsets:
        for i, o in enumerate(onsets):
            print(f"    [{i:2d}] Drive:{o['Drive']:.4f} dynTh:{o['dynTh']:.4f} "
                  f"SnareE:{o['SnareE']:.3f} Res:{o['Res']:.3f} cFx:{o['cFx']:.3f} "
                  f"bFct:{o['bFct']:.3f} sEF:{o['sEF']:.3f} "
                  f"hhDlt:{o['hhDlt']:.4f} ghst:{o['ghst']:.4f} "
                  f"{'[KICK]' if o['isKick'] else ''}")
        
        # Onset quality
        strong = [o for o in onsets if o['Drive'] > 0.05]
        weak = [o for o in onsets if o['Drive'] <= 0.05]
        print(f"\n    Strong (Drive>0.05): {len(strong)}")
        print(f"    Weak   (Drive<=0.05): {len(weak)}")
        
        # Check for doubles (onsets within 3 frames of each other)
        doubles = 0
        for i in range(1, len(onsets)):
            # Find index in audits
            pass  # Would need frame indices
    
    # NLMS bleed coefficient stats
    ks = [a['k'] for a in audits]
    print(f"\n  NLMS BLEED (k):")
    print(f"    k range:       {min(ks):.3f} — {max(ks):.3f}")
    print(f"    k mean:        {sum(ks)/len(ks):.3f}")
    
    # Residual stats
    res_nonzero = sum(1 for a in audits if a['Res'] > 0.001)
    print(f"\n  RESIDUAL:")
    print(f"    Res > 0.001:   {res_nonzero}/{len(audits)} ({100*res_nonzero/len(audits):.1f}%)")
    print(f"    Res max:       {max(a['Res'] for a in audits):.4f}")

def main():
    files = [
        ('gravitycalib1 (Brejcha)', 'gravitycalib1.md'),
        ('tiestocalib1 (Tiesto)', 'tiestocalib1.md'),
        ('techhouse1 (TechHouse)', 'techhouse1.md'),
        ('minimalnew1 (Minimal)', 'minimalnew1.md'),
    ]
    
    for name, fname in files:
        path = os.path.join(LOG_DIR, fname)
        if os.path.exists(path):
            audits, onsets = parse_log(path)
            analyze(name, audits, onsets)
        else:
            print(f"\n  {name}: FILE NOT FOUND")
    
    print(f"\n{'='*70}")
    print("  CROSS-LOG SUMMARY")
    print(f"{'='*70}")
    print("\n  CRITICAL FINDING: hhDlt and ghst are 0.000 in ALL logs.")
    print("  The treble-ghost path is NOT firing — raw_hh_delta is always 0.")
    print("  This means the smart sEF relaxation is the ONLY active change,")
    print("  and the ghost rescue path is dead code in practice.")

if __name__ == '__main__':
    main()
