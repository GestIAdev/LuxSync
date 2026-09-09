#!/usr/bin/env python3
"""Analyze the 4 calib4 logs with WAVE 7749.83 telemetry."""
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
    print(f"  {name.upper()} - {len(audits)} frames, {len(onsets)} onsets")
    print(f"{'='*70}")
    if not audits:
        print("  NO DATA")
        return

    sds = [a['sd'] for a in audits]
    hEs = [a['hE'] for a in audits]
    dynThs = [a['dynTh'] for a in audits]
    bFs = [a['bFct'] for a in audits]

    print(f"\n  MACRO VARIABLES:")
    print(f"    sd  mean={sum(sds)/len(sds):.3f}  range={min(sds):.3f}-{max(sds):.3f}")
    print(f"    hE  mean={sum(hEs)/len(hEs):.3f}  range={min(hEs):.3f}-{max(hEs):.3f}")
    print(f"    dynTh mean={sum(dynThs)/len(dynThs):.3f}")
    print(f"    bF  mean={sum(bFs)/len(bFs):.3f}  range={min(bFs):.3f}-{max(bFs):.3f}")

    # minBF = 0.3 + 0.7*sd
    minBFs = [0.3 + 0.7*a['sd'] for a in audits]
    print(f"    minBF mean={sum(minBFs)/len(minBFs):.3f}  range={min(minBFs):.3f}-{max(minBFs):.3f}")

    print(f"\n  ONSET ANALYSIS ({len(onsets)} onsets):")
    strong = [o for o in onsets if o['Drive'] > 0.05]
    weak = [o for o in onsets if o['Drive'] <= 0.05]
    kick_onsets = [o for o in onsets if o['isKick']]
    print(f"    Strong: {len(strong)}  Weak: {len(weak)}  Kick-coincident: {len(kick_onsets)}")

    # Check for blocked candidates: frames with high SnareE/Res/cFx but bF < minBF
    blocked = []
    for a in audits:
        if a['isOnset']: continue
        minBF = 0.3 + 0.7 * a['sd']
        if a['bFct'] < minBF and a['Res'] > 0.15 and a['cFx'] > 0.15:
            # This frame had crack energy but was blocked by body shield
            blocked.append(a)

    print(f"\n  BLOCKED BY BODY SHIELD (Res>0.15, cFx>0.15, bF<minBF): {len(blocked)}")
    for b in blocked[:15]:
        minBF = 0.3 + 0.7 * b['sd']
        print(f"    f={b['frameIdx']:3d} SnE={b['SnareE']:.3f} Res={b['Res']:.3f} cFx={b['cFx']:.3f} "
              f"bF={b['bFct']:.3f} minBF={minBF:.3f} sd={b['sd']:.3f} hE={b['hE']:.3f} "
              f"Dr={b['Drive']:.4f}")

    # Show all onsets
    print(f"\n  ALL ONSETS:")
    for i, o in enumerate(onsets):
        minBF = 0.3 + 0.7 * o['sd']
        gap = ""
        if i > 0:
            g = o['frameIdx'] - onsets[i-1]['frameIdx']
            if g <= 4: gap = f" <<DOUBLE gap={g}>>"
            elif g > 20: gap = f" [gap={g}]"
        print(f"    [{i:2d}] f={o['frameIdx']:3d} D:{o['Drive']:.4f} th:{o['dynTh']:.3f} "
              f"SnE:{o['SnareE']:.3f} Res:{o['Res']:.3f} cFx:{o['cFx']:.3f} "
              f"bF:{o['bFct']:.3f} minBF:{minBF:.3f} "
              f"sd:{o['sd']:.3f} hE:{o['hE']:.3f}"
              f"{' [KICK]' if o['isKick'] else ''}{gap}")

def main():
    files = [
        ('gravitycalib4 (Brejcha)', 'gravitycalib4.md'),
        ('tiestocalib4 (Tiesto)', 'tiestocalib4.md'),
        ('techhouse4 (TechHouse)', 'techhouse4.md'),
        ('minimalcalib4 (Minimal)', 'minimalcalib4.md'),
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
