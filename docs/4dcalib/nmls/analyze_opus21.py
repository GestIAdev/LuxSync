#!/usr/bin/env python3
"""Analyze opusbuild21 — verify density path is working correctly."""
import re
from pathlib import Path

PAT = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+Raw\u0394:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+Bass\u0394:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+fFloor:(?P<fFloor>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+rGate:(?P<rGate>[-\d.]+)\s+gRefr:(?P<gRefr>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)"
)

rows = []
text = Path(r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\opusbuild21.md").read_text(encoding="utf-8", errors="replace")
for line in text.splitlines():
    if "[FINESSE_AUDIT]" not in line: continue
    m = PAT.search(line)
    if not m: continue
    d = {k: float(v) for k, v in m.groupdict().items()}
    d['onset'] = '[ONSET]' in line
    d['kick'] = '[KICK]' in line
    rows.append(d)

onsets = [i for i, r in enumerate(rows) if r['onset']]
kicks = [i for i, r in enumerate(rows) if r['kick']]
n = len(rows)
print(f"OPUS BUILD 21 - {n} frames, {len(onsets)} snares, {len(kicks)} kick frames")
print(f"  Ratio: {len(kicks)/max(len(onsets),1):.1f} kicks per snare")
print("="*80)

# Compare with previous builds
print(f"\n  COMPARISON:")
print(f"    build17 (floorMin=0.020):  38 snares / 601 frames = 1 snare / 15.8 frames")
print(f"    build20 (floorMin=0.005, no density): 21 snares / 351 frames = 1 snare / 16.7 frames")
print(f"    build21 (density path):    {len(onsets)} snares / {n} frames = 1 snare / {n/max(len(onsets),1):.1f} frames")

# Spacings
if len(onsets) > 1:
    spacings = [onsets[i+1] - onsets[i] for i in range(len(onsets)-1)]
    print(f"\n  Spacings: {spacings}")
    max_gap = max(spacings)
    print(f"  Max gap: {max_gap} frames (build20 had 66!)")
    gaps_over_20 = [s for s in spacings if s > 20]
    print(f"  Gaps > 20 frames: {len(gaps_over_20)} -> {gaps_over_20}")

# Classify each onset: which path fired?
print(f"\n{'='*80}")
print(f"ONSET CLASSIFICATION (which path fired?)")
print(f"{'='*80}")
print(f"  MACD crossover: isCrossover && Drive >= floor")
print(f"  Bypass rescue: UnG>0.4, Res>0.3, RawD>0.2, Flux>bypassTh")
print(f"  Density path: fBL>0.09, gH<0.05, UnG>0.45, Drive>=floor")
print(f"  Path 1 (WNS): WNS>0.3, SnareE>0.15 or BassE>0.40")
print(f"  Path 2 (High-Flux): Flux>0.20, reArmed, SnareE>0.45 or ...")
print()

macd_count = 0
bypass_count = 0
density_count = 0
path1_count = 0
path2_count = 0
unknown_count = 0

for n_i, idx in enumerate(onsets, 1):
    r = rows[idx]
    # Check density path conditions
    density_eligible = (r['fBL'] > 0.09 and r['gH'] < 0.05 and r['UnG'] > 0.45 and r['Drive'] >= r['fFloor'])
    # Check bypass rescue conditions
    bypass_flux_th = 0.08 if r['gH'] < 0.1 else 0.20
    bypass_eligible = (r['UnG'] > 0.4 and r['Res'] > 0.3 and r['RawD'] > 0.2 and
                       r['Flux'] > bypass_flux_th and
                       not (r['SnareE'] < 0.2 and r['hE'] > 0.5))
    # Check Path 1 (WNS)
    path1_eligible = (r['WNS'] > 0.3 and (r['SnareE'] > 0.15 or (r['BassE'] > 0.40 and r['BassD'] > 0.005)))
    # Check Path 2 (High-Flux) — needs Flux > 0.20
    path2_eligible = (r['Flux'] > 0.20 and r['SnareE'] > 0.45)
    
    # Determine most likely path
    if path1_eligible:
        path = "Path1-WNS"
        path1_count += 1
    elif path2_eligible:
        path = "Path2-HiFlux"
        path2_count += 1
    elif bypass_eligible:
        path = "Bypass"
        bypass_count += 1
    elif density_eligible:
        path = "DENSITY"
        density_count += 1
    else:
        path = "MACD?"
        macd_count += 1
    
    if n_i <= 30 or density_eligible:
        print(f"  #{n_i:2d} f{idx:3d}: {path:>12} UnG={r['UnG']:.3f} "
              f"Res={r['Res']:.3f} Drive={r['Drive']:.4f} "
              f"Flux={r['Flux']:.3f} WNS={r['WNS']:.3f} "
              f"fBL={r['fBL']:.3f} gH={r['gH']:.3f} "
              f"RawD={r['RawD']:.3f}")

print(f"\n  PATH DISTRIBUTION:")
print(f"    DENSITY path:  {density_count}")
print(f"    Bypass rescue: {bypass_count}")
print(f"    Path 1 (WNS):  {path1_count}")
print(f"    Path 2 (Flux): {path2_count}")
print(f"    MACD/other:    {macd_count}")

# Density path safety check: are there any frames where density path
# WOULD fire but shouldn't (false positive risk)?
print(f"\n{'='*80}")
print(f"DENSITY PATH SAFETY CHECK")
print(f"{'='*80}")
# All frames where density path conditions are met
density_frames = []
for i, r in enumerate(rows):
    if r['fBL'] > 0.09 and r['gH'] < 0.05 and r['UnG'] > 0.45 and r['Drive'] >= r['fFloor']:
        density_frames.append(i)
print(f"  Frames meeting density criteria: {len(density_frames)}")
print(f"  Frames that are onsets: {sum(1 for i in density_frames if rows[i]['onset'])}")
print(f"  Frames that are NOT onsets (refractory blocked): {sum(1 for i in density_frames if not rows[i]['onset'])}")

# Check: are ALL frames in this log from a dense buildup? (fBL > 0.09 everywhere?)
fBL_vals = [r['fBL'] for r in rows]
print(f"\n  fBL range: {min(fBL_vals):.3f} - {max(fBL_vals):.3f}")
print(f"  fBL > 0.09 on {sum(1 for v in fBL_vals if v > 0.09)}/{n} frames ({100*sum(1 for v in fBL_vals if v > 0.09)/n:.0f}%)")
print(f"  gH < 0.05 on {sum(1 for r in rows if r['gH'] < 0.05)}/{n} frames ({100*sum(1 for r in rows if r['gH'] < 0.05)/n:.0f}%)")

# This is the key safety question: would density path fire in NON-buildup tracks?
print(f"\n  WARNING: This log is 100% buildup (fBL > 0.09 everywhere).")
print(f"  The density path will ONLY fire in tracks with fBL > 0.09 + gH < 0.05.")
print(f"  Normal techno has fBL 0.04-0.06. Silence has fBL < 0.04.")
print(f"  Only dense buildups reach fBL > 0.09.")

# Profile
if onsets:
    print(f"\n  ONSET PROFILE (min/avg/max):")
    for f in ['SnareE','UnG','Res','Drive','Flux','WNS','gH','fFloor','fBL','Veto','ghst']:
        vals = [rows[i][f] for i in onsets]
        print(f"    {f:>8}: {min(vals):.3f} / {sum(vals)/len(vals):.3f} / {max(vals):.3f}")

# Density by third
print(f"\n  SNARE DENSITY BY THIRD:")
t1_end = n // 3
t2_end = 2 * n // 3
t1 = sum(1 for i in onsets if i < t1_end)
t2 = sum(1 for i in onsets if t1_end <= i < t2_end)
t3 = sum(1 for i in onsets if i >= t2_end)
print(f"    Third 1 (f0-{t1_end}): {t1} snares")
print(f"    Third 2 (f{t1_end}-{t2_end}): {t2} snares")
print(f"    Third 3 (f{t2_end}-{n}): {t3} snares")
