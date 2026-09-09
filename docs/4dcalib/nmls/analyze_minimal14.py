#!/usr/bin/env python3
"""Analyze minimalcalib14 — find misses (high UnG/Res but no onset)."""
import re
from pathlib import Path

PAT = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+Raw\u0394:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+Bass\u0394:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+fFloor:(?P<fFloor>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+rGate:(?P<rGate>[-\d.]+)\s+gRefr:(?P<gRefr>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)"
)

rows = []
text = Path(r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\minimalcalib14.md").read_text(encoding="utf-8", errors="replace")
for line in text.splitlines():
    if "[FINESSE_AUDIT]" not in line: continue
    m = PAT.search(line)
    if not m: continue
    d = {k: float(v) for k, v in m.groupdict().items()}
    d['onset'] = '[ONSET]' in line
    rows.append(d)

onsets = [i for i, r in enumerate(rows) if r['onset']]
print(f"MINIMAL CALIB 14 - {len(rows)} frames, {len(onsets)} onsets ({len(onsets)/len(rows)*44:.1f}/s)")
print("="*80)

# Spacings
if len(onsets) > 1:
    spacings = [onsets[i+1] - onsets[i] for i in range(len(onsets)-1)]
    print(f"Spacings: min={min(spacings)} max={max(spacings)} mean={sum(spacings)/len(spacings):.1f}")
    print(f"  <6: {sum(1 for s in spacings if s<6)}, <8: {sum(1 for s in spacings if s<8)}, <11: {sum(1 for s in spacings if s<11)}")

# Find MISSES: frames with strong snare signature but no onset
# Signature: UnG > 0.3 AND Res > 0.2 AND not onset AND gRefr == 0
print("\n" + "="*80)
print("MISSES — strong snare signature (UnG>0.3 AND Res>0.2) but no onset")
print("="*80)
misses = []
for i, r in enumerate(rows):
    if r['onset']: continue
    if r['UnG'] > 0.3 and r['Res'] > 0.2 and r['gRefr'] == 0:
        # Calculate what crackDrive would be
        crackDrive = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
        misses.append(i)
        print(f"  frame {i}: SnareE={r['SnareE']:.3f} UnG={r['UnG']:.3f} "
              f"Res={r['Res']:.3f} cFx={r['cFx']:.3f} bFct={r['bFct']:.3f} "
              f"sEF={r['sEF']:.3f} Drive={r['Drive']:.4f} "
              f"crackDrive={crackDrive:.4f} floor={r['fFloor']:.3f} "
              f"gRefr={r['gRefr']:.0f} Flux={r['Flux']:.3f} "
              f"hhDlt={r['hhDlt']:.4f} ghst={r['ghst']:.4f}")

print(f"\nTotal misses: {len(misses)}")

# Also check misses blocked by refractory
print("\n" + "="*80)
print("MISSES BLOCKED BY REFRACTORY (UnG>0.3 AND Res>0.2 AND gRefr>0)")
print("="*80)
refr_misses = []
for i, r in enumerate(rows):
    if r['onset']: continue
    if r['UnG'] > 0.3 and r['Res'] > 0.2 and r['gRefr'] > 0:
        refr_misses.append(i)
        print(f"  frame {i}: SnareE={r['SnareE']:.3f} UnG={r['UnG']:.3f} "
              f"Res={r['Res']:.3f} Drive={r['Drive']:.4f} "
              f"gRefr={r['gRefr']:.0f} (blocked by refractory)")

print(f"\nTotal refractory-blocked: {len(refr_misses)}")

# Check instantGateDead misses (SnareE<0.05 AND UnG>0.3)
print("\n" + "="*80)
print("instantGateDead MISSES (SnareE<0.05 AND UnG>0.3 AND no onset)")
print("="*80)
igd_misses = []
for i, r in enumerate(rows):
    if r['onset']: continue
    if r['SnareE'] < 0.05 and r['UnG'] > 0.3:
        igd_misses.append(i)
        crackDrive = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
        print(f"  frame {i}: SnareE={r['SnareE']:.3f} UnG={r['UnG']:.3f} "
              f"Res={r['Res']:.3f} cFx={r['cFx']:.3f} sEF={r['sEF']:.3f} "
              f"crackDrive={crackDrive:.4f} floor={r['fFloor']:.3f} "
              f"Drive={r['Drive']:.4f} gRefr={r['gRefr']:.0f}")

print(f"\nTotal instantGateDead misses: {len(igd_misses)}")

# Onset details
print("\n" + "="*80)
print("ALL ONSETS")
print("="*80)
for idx in onsets:
    r = rows[idx]
    crackDrive = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
    print(f"  frame {idx}: SnareE={r['SnareE']:.3f} UnG={r['UnG']:.3f} "
          f"Res={r['Res']:.3f} cFx={r['cFx']:.3f} bFct={r['bFct']:.3f} "
          f"sEF={r['sEF']:.3f} Drive={r['Drive']:.4f} "
          f"crackDrive={crackDrive:.4f}")
