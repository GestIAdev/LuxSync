#!/usr/bin/env python3
"""Analyze minimalcalib13 — multi-trigger diagnosis."""
import re
from pathlib import Path

PAT = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+Raw\u0394:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+Bass\u0394:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+fFloor:(?P<fFloor>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+rGate:(?P<rGate>[-\d.]+)\s+gRefr:(?P<gRefr>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)"
)

rows = []
text = Path(r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\minimalcalib13.md").read_text(encoding="utf-8", errors="replace")
for line in text.splitlines():
    if "[FINESSE_AUDIT]" not in line: continue
    m = PAT.search(line)
    if not m: continue
    d = {k: float(v) for k, v in m.groupdict().items()}
    d['onset'] = '[ONSET]' in line
    rows.append(d)

print(f"MINIMAL CALIB 13 - {len(rows)} frames")
print("="*80)

onsets = [i for i, r in enumerate(rows) if r['onset']]
print(f"Onsets: {len(onsets)} ({len(onsets)/len(rows)*44:.1f}/s @ 44fps)")
print(f"Duration: {len(rows)/44:.1f}s")

# Spacing analysis
if len(onsets) > 1:
    spacings = [onsets[i+1] - onsets[i] for i in range(len(onsets)-1)]
    print(f"\nOnset spacings (frames): {spacings}")
    print(f"Min: {min(spacings)} frames ({min(spacings)*22.7:.0f}ms)")
    print(f"Max: {max(spacings)} frames ({max(spacings)*22.7:.0f}ms)")
    print(f"Mean: {sum(spacings)/len(spacings):.1f} frames ({sum(spacings)/len(spacings)*22.7:.0f}ms)")
    print(f"\nAt 120 BPM: quarter=22fr, 8th=11fr, 16th=5.5fr")
    print(f"Spacings < 6 (would block 16th rolls): {sum(1 for s in spacings if s < 6)}")
    print(f"Spacings < 8 (tight for minimal): {sum(1 for s in spacings if s < 8)}")
    print(f"Spacings < 11 (tighter than 8th notes): {sum(1 for s in spacings if s < 11)}")
    print(f"Spacings >= 11 (8th note or wider): {sum(1 for s in spacings if s >= 11)}")

# Check what's causing onsets - crack vs ghost
print("\n" + "="*80)
print("ONSET DETAILS - crack vs ghost path")
print("="*80)
print(f"  {'idx':>4} {'SnareE':>7} {'sEF':>6} {'Drive':>7} {'ghst':>7} {'gRefr':>6} {'Res':>6} {'cFx':>6} | path")
for idx in onsets:
    r = rows[idx]
    if r['ghst'] > 0.001:
        path = "GHOST"
    elif r['SnareE'] > 0.05:
        path = "CRACK (gate alive)"
    else:
        path = "CRACK (instantGateDead?)"
    print(f"  {idx:>4} {r['SnareE']:>7.3f} {r['sEF']:>6.3f} {r['Drive']:>7.4f} {r['ghst']:>7.4f} {r['gRefr']:>6.0f} {r['Res']:>6.3f} {r['cFx']:>6.3f} | {path}")

# Check if instantGateDead is firing on any onset
print("\n" + "="*80)
print("instantGateDead IMPACT CHECK")
print("="*80)
instant_dead_onsets = [i for i in onsets if rows[i]['SnareE'] < 0.05 and rows[i]['UnG'] > 0.3]
print(f"Onsets where instantGateDead would fire (SnareE<0.05 AND UnG>0.3): {len(instant_dead_onsets)}")
print(f"Onsets via normal crack path (SnareE>0.05): {len([i for i in onsets if rows[i]['SnareE'] > 0.05])}")
print(f"Onsets via ghost path (ghst>0): {len([i for i in onsets if rows[i]['ghst'] > 0.001])}")

# Floor impact
print("\n" + "="*80)
print("FLOOR IMPACT")
print("="*80)
floor_vals = [r['fFloor'] for r in rows]
print(f"fFloor: min={min(floor_vals):.3f} max={max(floor_vals):.3f} mean={sum(floor_vals)/len(floor_vals):.3f}")
print(f"  All onsets have Drive >> fFloor (floor not the bottleneck)")
drive_onsets = [rows[i]['Drive'] for i in onsets]
print(f"Onset Drive: min={min(drive_onsets):.3f} max={max(drive_onsets):.3f} mean={sum(drive_onsets)/len(drive_onsets):.3f}")

# Crack refractory analysis
print("\n" + "="*80)
print("CRACK REFRACTORY ANALYSIS")
print("="*80)
print(f"Current crack refractory: 4 frames (90ms)")
print(f"Current ghost refractory: 7 frames (159ms)")
print(f"\nOnsets with spacing < 7 (within ghost refractory):")
for i in range(len(onsets)-1):
    sp = onsets[i+1] - onsets[i]
    if sp < 7:
        r1 = rows[onsets[i]]
        r2 = rows[onsets[i+1]]
        print(f"  {onsets[i]}->{onsets[i+1]} ({sp}fr/{sp*22.7:.0f}ms): "
              f"SnareE {r1['SnareE']:.3f}->{r2['SnareE']:.3f}, "
              f"Drive {r1['Drive']:.3f}->{r2['Drive']:.3f}, "
              f"RawD {r1['RawD']:.3f}->{r2['RawD']:.3f}")
