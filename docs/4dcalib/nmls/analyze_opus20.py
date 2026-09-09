#!/usr/bin/env python3
"""Analyze opusbuild20 — snares fade before climax."""
import re
from pathlib import Path

PAT = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+Raw\u0394:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+Bass\u0394:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+fFloor:(?P<fFloor>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+rGate:(?P<rGate>[-\d.]+)\s+gRefr:(?P<gRefr>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)"
)

rows = []
text = Path(r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\opusbuild20.md").read_text(encoding="utf-8", errors="replace")
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
print(f"OPUS BUILD 20 - {len(rows)} frames, {len(onsets)} snares, {len(kicks)} kick frames")
print("="*80)

# Show all onsets with frame index
print(f"\nALL {len(onsets)} ONSETS:")
for n, idx in enumerate(onsets, 1):
    r = rows[idx]
    crackD = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
    print(f"  #{n:2d} f{idx:3d}: UnG={r['UnG']:.3f} Res={r['Res']:.3f} "
          f"Drive={r['Drive']:.4f} crackD={crackD:.4f} "
          f"Flux={r['Flux']:.3f} WNS={r['WNS']:.3f} "
          f"gH={r['gH']:.3f} fFloor={r['fFloor']:.3f} "
          f"fBL={r['fBL']:.3f} ghst={r['ghst']:.4f}")

# Spacings
if len(onsets) > 1:
    spacings = [onsets[i+1] - onsets[i] for i in range(len(onsets)-1)]
    print(f"\n  Spacings: {spacings}")

# Profile
if onsets:
    print(f"\n  ONSET PROFILE (min/avg/max):")
    for f in ['SnareE','UnG','Res','Drive','Flux','WNS','gH','fFloor','fBL','Veto','ghst']:
        vals = [rows[i][f] for i in onsets]
        print(f"    {f:>8}: {min(vals):.3f} / {sum(vals)/len(vals):.3f} / {max(vals):.3f}")

# CRITICAL: divide the track into thirds and count onsets per third
print(f"\n{'='*80}")
print(f"SNARE DENSITY BY THIRD (does it fade?)")
print(f"{'='*80}")
n = len(rows)
t1_end = n // 3
t2_end = 2 * n // 3
t1 = sum(1 for i in onsets if i < t1_end)
t2 = sum(1 for i in onsets if t1_end <= i < t2_end)
t3 = sum(1 for i in onsets if i >= t2_end)
print(f"  Third 1 (f0-{t1_end}): {t1} snares")
print(f"  Third 2 (f{t1_end}-{t2_end}): {t2} snares")
print(f"  Third 3 (f{t2_end}-{n}): {t3} snares")

# Look at the LAST 100 frames — the "dark" zone before climax
print(f"\n{'='*80}")
print(f"LAST 100 FRAMES (the dark zone before climax)")
print(f"{'='*80}")
last_100 = rows[-100:]
last_onsets = [i for i, r in enumerate(last_100) if r['onset']]
print(f"  Onsets in last 100 frames: {len(last_onsets)}")

# What does fBL, Drive, fFloor look like in the dark zone?
print(f"\n  Dark zone averages:")
for f in ['UnG','Res','Drive','Flux','WNS','gH','fFloor','fBL','ghst','Veto']:
    vals = [r[f] for r in last_100]
    print(f"    {f:>8}: {min(vals):.3f} / {sum(vals)/len(vals):.3f} / {max(vals):.3f}")

# KEY: what's happening with fBL in the dark zone vs the bright zone?
print(f"\n{'='*80}")
print(f"fBL TRAJECTORY (every 20 frames)")
print(f"{'='*80}")
for i in range(0, n, max(1, n//30)):
    r = rows[i]
    o = '*' if r['onset'] else ' '
    print(f"  f{i:3d}: fBL={r['fBL']:.3f} fFloor={r['fFloor']:.3f} "
          f"Drive={r['Drive']:.4f} UnG={r['UnG']:.3f} "
          f"Flux={r['Flux']:.3f} ghst={r['ghst']:.4f} {o}")

# MISSED frames in the dark zone (last 100)
print(f"\n{'='*80}")
print(f"MISSED FRAMES in dark zone (UnG>0.45, no onset, gRefr==0)")
print(f"{'='*80}")
missed_dark = []
for i in range(max(0, n-100), n):
    r = rows[i]
    if r['onset']: continue
    if r['UnG'] > 0.45 and r['gRefr'] == 0:
        missed_dark.append(i)
        if len(missed_dark) <= 20:
            crackD = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
            print(f"  f{i:3d}: UnG={r['UnG']:.3f} Res={r['Res']:.3f} "
                  f"Drive={r['Drive']:.4f} Flux={r['Flux']:.3f} "
                  f"fFloor={r['fFloor']:.3f} fBL={r['fBL']:.3f} "
                  f"ghst={r['ghst']:.4f} Veto={r['Veto']:.3f}")

print(f"\n  Total missed in dark zone: {len(missed_dark)}")

# Compare bright zone (first 100) vs dark zone (last 100)
print(f"\n{'='*80}")
print(f"BRIGHT (first 100) vs DARK (last 100)")
print(f"{'='*80}")
first_100 = rows[:100]
print(f"  {'field':>8} {'bright_avg':>10} {'dark_avg':>10} {'diff':>8}")
for f in ['UnG','Res','Drive','Flux','WNS','gH','fFloor','fBL','ghst','Veto','cFx','bFct','sEF']:
    bv = sum(r[f] for r in first_100) / len(first_100)
    dv = sum(r[f] for r in last_100) / len(last_100)
    print(f"  {f:>8} {bv:>10.3f} {dv:>10.3f} {bv-dv:>8.3f}")
