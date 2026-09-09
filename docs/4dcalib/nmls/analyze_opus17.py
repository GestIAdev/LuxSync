#!/usr/bin/env python3
"""Analyze opusbuild17 — why is the roll still dead?"""
import re
from pathlib import Path

PAT = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+Raw\u0394:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+Bass\u0394:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+fFloor:(?P<fFloor>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+rGate:(?P<rGate>[-\d.]+)\s+gRefr:(?P<gRefr>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)"
)

rows = []
text = Path(r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\opusbuild17.md").read_text(encoding="utf-8", errors="replace")
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
print(f"OPUS BUILD 17 - {len(rows)} frames, {len(onsets)} snares, {len(kicks)} kick frames")
print(f"  Ratio: {len(kicks)/max(len(onsets),1):.1f} kicks per snare")
print("="*80)

# Show all onsets
print(f"\nALL {len(onsets)} ONSETS:")
for n, idx in enumerate(onsets, 1):
    r = rows[idx]
    crackD = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
    bypass = (r['UnG'] > 0.4 and r['Res'] > 0.3 and r['RawD'] > 0.2 and
              r['Flux'] > (0.08 if r['gH'] < 0.1 else 0.20) and
              not (r['SnareE'] < 0.2 and r['hE'] > 0.5))
    print(f"  #{n:2d} f{idx:3d}: UnG={r['UnG']:.3f} Res={r['Res']:.3f} "
          f"Drive={r['Drive']:.4f} crackD={crackD:.4f} "
          f"Flux={r['Flux']:.3f} WNS={r['WNS']:.3f} "
          f"gH={r['gH']:.3f} gRefr={r['gRefr']:.0f} "
          f"fFloor={r['fFloor']:.3f} bypass={bypass}")

# Profile
if onsets:
    print(f"\n  ONSET PROFILE (min/avg/max):")
    for f in ['SnareE','UnG','Res','Drive','Flux','WNS','gH','fFloor','Veto','ghst']:
        vals = [rows[i][f] for i in onsets]
        print(f"    {f:>8}: {min(vals):.3f} / {sum(vals)/len(vals):.3f} / {max(vals):.3f}")

# THE KEY QUESTION: what do MISSED frames look like?
# Frames with UnG > 0.45 AND no onset AND gRefr==0 (not refractory blocked)
print(f"\n{'='*80}")
print(f"MISSED SNARES — UnG>0.45, no onset, gRefr==0 (not refractory)")
print(f"{'='*80}")
missed = []
for i, r in enumerate(rows):
    if r['onset']: continue
    if r['UnG'] > 0.45 and r['gRefr'] == 0:
        crackD = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
        bypass = (r['UnG'] > 0.4 and r['Res'] > 0.3 and r['RawD'] > 0.2 and
                  r['Flux'] > (0.08 if r['gH'] < 0.1 else 0.20) and
                  not (r['SnareE'] < 0.2 and r['hE'] > 0.5))
        missed.append(i)
        if len(missed) <= 30:
            print(f"  f{i:3d}: UnG={r['UnG']:.3f} Res={r['Res']:.3f} "
                  f"RawD={r['RawD']:.3f} Drive={r['Drive']:.4f} "
                  f"crackD={crackD:.4f} Flux={r['Flux']:.3f} "
                  f"gH={r['gH']:.3f} fFloor={r['fFloor']:.3f} "
                  f"ghst={r['ghst']:.4f} Veto={r['Veto']:.3f} "
                  f"bypass={bypass}")

print(f"\n  Total missed candidates: {len(missed)}")

# Compare: why do ONSETS fire but MISSED don't?
if onsets and missed:
    print(f"\n{'='*80}")
    print(f"COMPARISON: ONSETS vs MISSED")
    print(f"{'='*80}")
    print(f"  {'field':>8} {'onset_avg':>10} {'missed_avg':>10} {'diff':>8}")
    for f in ['UnG','Res','RawD','Drive','Flux','WNS','gH','fFloor','Veto','ghst','cFx','bFct','sEF']:
        o_vals = [rows[i][f] for i in onsets]
        m_vals = [rows[i][f] for i in missed]
        oa = sum(o_vals)/len(o_vals)
        ma = sum(m_vals)/len(m_vals)
        print(f"  {f:>8} {oa:>10.3f} {ma:>10.3f} {oa-ma:>8.3f}")

# KEY: the bypass rescue requires Res > 0.3, but Opus snares have Res ~0.10
# Let's check how many missed frames would be rescued if we lower Res threshold
print(f"\n{'='*80}")
print(f"WHAT IF we lower bypass Res threshold?")
print(f"{'='*80}")
for res_th in [0.3, 0.25, 0.20, 0.15, 0.10]:
    rescued = 0
    for i in missed:
        r = rows[i]
        if (r['UnG'] > 0.4 and r['Res'] > res_th and r['RawD'] > 0.2 and
            r['Flux'] > (0.08 if r['gH'] < 0.1 else 0.20) and
            not (r['SnareE'] < 0.2 and r['hE'] > 0.5)):
            rescued += 1
    print(f"  Res > {res_th:.2f}: would rescue {rescued} missed frames")

# Also check: what about RawD threshold?
print(f"\n  What if we also lower RawD threshold?")
for rawd_th in [0.2, 0.15, 0.10, 0.05]:
    rescued = 0
    for i in missed:
        r = rows[i]
        if (r['UnG'] > 0.4 and r['Res'] > 0.15 and r['RawD'] > rawd_th and
            r['Flux'] > (0.08 if r['gH'] < 0.1 else 0.20) and
            not (r['SnareE'] < 0.2 and r['hE'] > 0.5)):
            rescued += 1
    print(f"  Res > 0.15 AND RawD > {rawd_th:.2f}: would rescue {rescued} missed frames")

# Check the ghost path - is ghst contributing?
print(f"\n{'='*80}")
print(f"GHOST PATH (ghst > 0.005)")
print(f"{'='*80}")
ghost_active = [(i, r) for i, r in enumerate(rows) if r['ghst'] > 0.005]
print(f"  Frames with ghst > 0.005: {len(ghost_active)}")
if ghost_active:
    for i, r in ghost_active[:10]:
        print(f"  f{i:3d}: ghst={r['ghst']:.4f} Drive={r['Drive']:.4f} "
              f"UnG={r['UnG']:.3f} Res={r['Res']:.3f} "
              f"hhDlt={r['hhDlt']:.4f} onset={r['onset']}")
