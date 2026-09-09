#!/usr/bin/env python3
"""Analyze both Teminite (impossible track) and Opus build (snare roll died)."""
import re
from pathlib import Path

PAT = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+Raw\u0394:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+Bass\u0394:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+fFloor:(?P<fFloor>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+rGate:(?P<rGate>[-\d.]+)\s+gRefr:(?P<gRefr>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)"
)

def parse(path):
    rows = []
    text = Path(path).read_text(encoding="utf-8", errors="replace")
    for line in text.splitlines():
        if "[FINESSE_AUDIT]" not in line: continue
        m = PAT.search(line)
        if not m: continue
        d = {k: float(v) for k, v in m.groupdict().items()}
        d['onset'] = '[ONSET]' in line
        d['kick'] = '[KICK]' in line
        rows.append(d)
    return rows

# ============ TEMINITE ============
print("="*80)
print("TEMINITE & PANDA EYES - HIGH SCORE")
print("="*80)
rows = parse(r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\teminitepandaeyeshighscore.md")
onsets = [i for i, r in enumerate(rows) if r['onset']]
kicks = [i for i, r in enumerate(rows) if r['kick']]
print(f"  {len(rows)} frames, {len(onsets)} snares, {len(kicks)} kick frames")

print(f"\n  KEY OBSERVATION: hE=0.000 on ALL frames!")
print(f"  This is NOT techno - it's EDM/bass music with NO hi-hat energy")
print(f"  The 'kick' is a synth bass, the 'snare' is a synth stab")

print(f"\nALL ONSETS:")
for n, idx in enumerate(onsets, 1):
    r = rows[idx]
    print(f"  #{n:2d} f{idx:3d}: SnareE={r['SnareE']:.3f} UnG={r['UnG']:.3f} "
          f"Res={r['Res']:.3f} Drive={r['Drive']:.4f} "
          f"Flux={r['Flux']:.3f} WNS={r['WNS']:.3f} "
          f"BassE={r['BassE']:.3f} Veto={r['Veto']:.3f} "
          f"gH={r['gH']:.3f}")

# Profile
if onsets:
    print(f"\n  ONSET PROFILE (min/avg/max):")
    for f in ['SnareE','UnG','Res','Drive','Flux','WNS','BassE','Veto','gH','hE']:
        vals = [rows[i][f] for i in onsets]
        print(f"    {f:>8}: {min(vals):.3f} / {sum(vals)/len(vals):.3f} / {max(vals):.3f}")

# ============ OPUS BUILD ============
print("\n\n" + "="*80)
print("OPUS BUILD 10 - snare roll died?")
print("="*80)
rows2 = parse(r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\oppusbuild10.md")
onsets2 = [i for i, r in enumerate(rows2) if r['onset']]
kicks2 = [i for i, r in enumerate(rows2) if r['kick']]
print(f"  {len(rows2)} frames, {len(onsets2)} snares, {len(kicks2)} kick frames")

print(f"\nALL ONSETS:")
for n, idx in enumerate(onsets2, 1):
    r = rows2[idx]
    crackD = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
    print(f"  #{n:2d} f{idx:3d}: SnareE={r['SnareE']:.3f} UnG={r['UnG']:.3f} "
          f"Res={r['Res']:.3f} cFx={r['cFx']:.3f} bFct={r['bFct']:.3f} "
          f"Drive={r['Drive']:.4f} crackD={crackD:.4f} "
          f"Flux={r['Flux']:.3f} WNS={r['WNS']:.3f} "
          f"gH={r['gH']:.3f} fFloor={r['fFloor']:.3f}")

# Spacings
if len(onsets2) > 1:
    spacings = [onsets2[i+1] - onsets2[i] for i in range(len(onsets2)-1)]
    print(f"\n  Spacings: {spacings}")

# Find MISSED snares in Opus build - frames with strong signature but no onset
print(f"\n  MISSED SNARES (UnG>0.3 AND Res>0.2 AND RawD>0.15, no onset):")
for i, r in enumerate(rows2):
    if r['onset']: continue
    if r['UnG'] > 0.3 and r['Res'] > 0.2 and r['RawD'] > 0.15:
        crackD = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
        wns_gate = r['gH'] > 0.1 and r['WNS'] < 0.05 and r['Flux'] < 0.25
        bypass = (r['UnG'] > 0.4 and r['Res'] > 0.3 and r['RawD'] > 0.2 and
                  r['Flux'] > 0.20 and not (r['SnareE'] < 0.2 and r['hE'] > 0.5))
        print(f"  f{i:3d}: SnareE={r['SnareE']:.3f} UnG={r['UnG']:.3f} "
              f"Res={r['Res']:.3f} RawD={r['RawD']:.3f} "
              f"Drive={r['Drive']:.4f} crackD={crackD:.4f} "
              f"Flux={r['Flux']:.3f} WNS={r['WNS']:.3f} "
              f"gH={r['gH']:.3f} gRefr={r['gRefr']:.0f} "
              f"fFloor={r['fFloor']:.3f} "
              f"wns_gate={wns_gate} bypass={bypass}")

# Profile
if onsets2:
    print(f"\n  ONSET PROFILE (min/avg/max):")
    for f in ['SnareE','UnG','Res','Drive','Flux','WNS','BassE','Veto','gH','hE','fFloor']:
        vals = [rows2[i][f] for i in onsets2]
        print(f"    {f:>8}: {min(vals):.3f} / {sum(vals)/len(vals):.3f} / {max(vals):.3f}")

# Key question: is the ghost path dead in Opus?
print(f"\n  GHOST PATH ANALYSIS (Opus):")
ghost_frames = [(i, r) for i, r in enumerate(rows2) if r['ghst'] > 0.001]
print(f"  Frames with ghst > 0.001: {len(ghost_frames)}")
if ghost_frames:
    for i, r in ghost_frames[:10]:
        print(f"    f{i:3d}: ghst={r['ghst']:.4f} gH={r['gH']:.3f} "
              f"UnG={r['UnG']:.3f} Res={r['Res']:.3f} "
              f"hhDlt={r['hhDlt']:.4f} Flux={r['Flux']:.3f}")
