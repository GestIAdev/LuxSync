#!/usr/bin/env python3
"""Analyze minimalcorto17 — find the 2nd and 4th misses."""
import re
from pathlib import Path

PAT = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+Raw\u0394:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+Bass\u0394:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+fFloor:(?P<fFloor>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+rGate:(?P<rGate>[-\d.]+)\s+gRefr:(?P<gRefr>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)"
)

rows = []
text = Path(r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\minimalcorto17.md").read_text(encoding="utf-8", errors="replace")
for line in text.splitlines():
    if "[FINESSE_AUDIT]" not in line: continue
    m = PAT.search(line)
    if not m: continue
    d = {k: float(v) for k, v in m.groupdict().items()}
    d['onset'] = '[ONSET]' in line
    rows.append(d)

onsets = [i for i, r in enumerate(rows) if r['onset']]
print(f"MINIMALCORTO17 - {len(rows)} frames, {len(onsets)} onsets")
print("="*80)

# Show all onsets with context
print("\nALL ONSETS:")
for n, idx in enumerate(onsets, 1):
    r = rows[idx]
    print(f"  #{n} (frame {idx}): UnG={r['UnG']:.3f} Res={r['Res']:.3f} "
          f"cFx={r['cFx']:.3f} bFct={r['bFct']:.3f} sEF={r['sEF']:.3f} "
          f"Drive={r['Drive']:.4f} Flux={r['Flux']:.3f} RawD={r['RawD']:.3f} "
          f"hhDlt={r['hhDlt']:.4f} ghst={r['ghst']:.4f} fFloor={r['fFloor']:.3f}")

# Spacings
if len(onsets) > 1:
    spacings = [onsets[i+1] - onsets[i] for i in range(len(onsets)-1)]
    print(f"\nSpacings: {spacings}")

# Find MISSES: high UnG (>0.5) + high Res (>0.3) + high RawD (>0.2) but no onset
print("\n" + "="*80)
print("POTENTIAL MISSES (UnG>0.5 AND Res>0.3 AND RawD>0.2 AND no onset)")
print("="*80)
for i, r in enumerate(rows):
    if r['onset']: continue
    if r['UnG'] > 0.5 and r['Res'] > 0.3 and r['RawD'] > 0.2:
        crackDrive = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
        # Find nearest preceding onset
        prev_onset = max((o for o in onsets if o < i), default=-1)
        gap = i - prev_onset if prev_onset >= 0 else -1
        print(f"  frame {i}: UnG={r['UnG']:.3f} Res={r['Res']:.3f} "
              f"cFx={r['cFx']:.3f} bFct={r['bFct']:.3f} sEF={r['sEF']:.3f} "
              f"Drive={r['Drive']:.4f} crackDrive={crackDrive:.4f} "
              f"Flux={r['Flux']:.3f} RawD={r['RawD']:.3f} "
              f"hhDlt={r['hhDlt']:.4f} ghst={r['ghst']:.4f} "
              f"gRefr={r['gRefr']:.0f} gap_from_prev={gap}")

# Also check frames with high UnG but blocked by refractory
print("\n" + "="*80)
print("HIGH-ENERGY FRAMES BLOCKED BY REFRACTORY (UnG>0.5 AND gRefr>0)")
print("="*80)
for i, r in enumerate(rows):
    if r['onset']: continue
    if r['UnG'] > 0.5 and r['gRefr'] > 0:
        prev_onset = max((o for o in onsets if o < i), default=-1)
        gap = i - prev_onset if prev_onset >= 0 else -1
        print(f"  frame {i}: UnG={r['UnG']:.3f} Res={r['Res']:.3f} "
              f"Drive={r['Drive']:.4f} gRefr={r['gRefr']:.0f} "
              f"gap_from_prev={gap} Flux={r['Flux']:.3f} RawD={r['RawD']:.3f}")
