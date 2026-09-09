#!/usr/bin/env python3
"""Analyze missedsnare.md frame-by-frame — find the 2 missed snares."""
import re
from pathlib import Path

PAT = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+Raw\u0394:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+Bass\u0394:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+fFloor:(?P<fFloor>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+rGate:(?P<rGate>[-\d.]+)\s+gRefr:(?P<gRefr>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)"
)

rows = []
text = Path(r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\missedsnare.md").read_text(encoding="utf-8", errors="replace")
for line in text.splitlines():
    if "[FINESSE_AUDIT]" not in line: continue
    m = PAT.search(line)
    if not m: continue
    d = {k: float(v) for k, v in m.groupdict().items()}
    d['onset'] = '[ONSET]' in line
    rows.append(d)

onsets = [i for i, r in enumerate(rows) if r['onset']]
print(f"MISSEDSNARE FBF - {len(rows)} frames, {len(onsets)} onsets")
print("="*80)

# Show all onsets
print("\nALL ONSETS:")
for n, idx in enumerate(onsets, 1):
    r = rows[idx]
    print(f"  #{n:2d} frame {idx:3d}: UnG={r['UnG']:.3f} Res={r['Res']:.3f} "
          f"cFx={r['cFx']:.3f} bFct={r['bFct']:.3f} sEF={r['sEF']:.3f} "
          f"Drive={r['Drive']:.4f} RawD={r['RawD']:.3f} Flux={r['Flux']:.3f} "
          f"hhDlt={r['hhDlt']:.4f} gRefr={r['gRefr']:.0f}")

# Spacings
if len(onsets) > 1:
    spacings = [onsets[i+1] - onsets[i] for i in range(len(onsets)-1)]
    print(f"\nSpacings: {spacings}")

# Find ALL frames with strong snare signature (UnG>0.3 AND Res>0.15)
# that are NOT onsets — these are the misses
print("\n" + "="*80)
print("STRONG SNARE-LIKE FRAMES (UnG>0.3 AND Res>0.15) — including misses")
print("="*80)
print(f"  {'fr':>3} {'UnG':>6} {'Res':>6} {'cFx':>6} {'bFct':>6} {'sEF':>6} {'Drive':>7} {'RawD':>6} {'Flux':>6} {'hhDlt':>7} {'ghst':>7} {'gRefr':>5} {'onset':>5} {'gap':>4}")
strong_frames = []
for i, r in enumerate(rows):
    if r['UnG'] > 0.3 and r['Res'] > 0.15:
        prev_onset = max((o for o in onsets if o < i), default=-1)
        gap = i - prev_onset if prev_onset >= 0 else -1
        is_onset = "ONSET" if r['onset'] else ""
        strong_frames.append(i)
        crackDrive = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
        print(f"  {i:>3} {r['UnG']:>6.3f} {r['Res']:>6.3f} {r['cFx']:>6.3f} {r['bFct']:>6.3f} {r['sEF']:>6.3f} {r['Drive']:>7.4f} {r['RawD']:>6.3f} {r['Flux']:>6.3f} {r['hhDlt']:>7.4f} {r['ghst']:>7.4f} {r['gRefr']:>5.0f} {is_onset:>5} {gap:>4}  crackD={crackDrive:.4f}")

# Specifically find misses: strong snare signature, no onset, gRefr=0
print("\n" + "="*80)
print("MISSES (UnG>0.3 AND Res>0.15 AND no onset AND gRefr=0)")
print("="*80)
for i, r in enumerate(rows):
    if r['onset']: continue
    if r['UnG'] > 0.3 and r['Res'] > 0.15 and r['gRefr'] == 0:
        crackDrive = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
        prev_onset = max((o for o in onsets if o < i), default=-1)
        next_onset = min((o for o in onsets if o > i), default=-1)
        gap_prev = i - prev_onset if prev_onset >= 0 else -1
        gap_next = next_onset - i if next_onset >= 0 else -1
        print(f"  frame {i}: UnG={r['UnG']:.3f} Res={r['Res']:.3f} "
              f"cFx={r['cFx']:.3f} bFct={r['bFct']:.3f} sEF={r['sEF']:.3f} "
              f"Drive={r['Drive']:.4f} crackDrive={crackDrive:.4f} "
              f"RawD={r['RawD']:.3f} Flux={r['Flux']:.3f} "
              f"hhDlt={r['hhDlt']:.4f} ghst={r['ghst']:.4f} "
              f"gap_prev={gap_prev} gap_next={gap_next}")

# Also find misses blocked by refractory
print("\n" + "="*80)
print("MISSES BLOCKED BY REFRACTORY (UnG>0.3 AND Res>0.15 AND gRefr>0)")
print("="*80)
for i, r in enumerate(rows):
    if r['onset']: continue
    if r['UnG'] > 0.3 and r['Res'] > 0.15 and r['gRefr'] > 0:
        prev_onset = max((o for o in onsets if o < i), default=-1)
        gap = i - prev_onset if prev_onset >= 0 else -1
        print(f"  frame {i}: UnG={r['UnG']:.3f} Res={r['Res']:.3f} "
              f"Drive={r['Drive']:.4f} gRefr={r['gRefr']:.0f} gap={gap} "
              f"RawD={r['RawD']:.3f} Flux={r['Flux']:.3f}")
