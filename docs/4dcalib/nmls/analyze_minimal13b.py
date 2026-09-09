#!/usr/bin/env python3
"""Analyze minimalcalib13 — check instantGateDead impact and ghost path dominance."""
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

print(f"MINIMAL CALIB 13 - {len(rows)} frames, {sum(1 for r in rows if r['onset'])} onsets")
print("="*80)

# 1. instantGateDead frames (SnareE < 0.05 AND UnG > 0.3)
instant_dead = [i for i, r in enumerate(rows) if r['SnareE'] < 0.05 and r['UnG'] > 0.3]
print(f"\n1. instantGateDead frames (SnareE<0.05 AND UnG>0.3): {len(instant_dead)}")
for i in instant_dead:
    r = rows[i]
    print(f"   frame {i}: SnareE={r['SnareE']:.3f} UnG={r['UnG']:.3f} sEF={r['sEF']:.3f} "
          f"Drive={r['Drive']:.4f} ghst={r['ghst']:.4f} onset={r['onset']}")

# 2. Ghost vs crack dominance
print("\n" + "="*80)
print("2. ONSET PATH ANALYSIS — ghost vs crack dominance")
print("="*80)
onsets = [i for i, r in enumerate(rows) if r['onset']]
ghost_driven = 0
crack_driven = 0
both = 0
for i in onsets:
    r = rows[i]
    # Drive = max(crackDrive, trebleGhost)
    # ghst = trebleGhost
    # crackDrive = Drive if Drive != ghst (approximately)
    if r['ghst'] > 0.001 and abs(r['Drive'] - r['ghst']) < 0.02:
        ghost_driven += 1
        path = "GHOST"
    elif r['ghst'] < 0.001:
        crack_driven += 1
        path = "CRACK"
    else:
        both += 1
        path = "BOTH (crack>ghost)"
    print(f"   frame {i}: Drive={r['Drive']:.4f} ghst={r['ghst']:.4f} "
          f"SnareE={r['SnareE']:.3f} hhDlt={r['hhDlt']:.4f} -> {path}")

print(f"\n   Ghost-driven: {ghost_driven}")
print(f"   Crack-driven: {crack_driven}")
print(f"   Both: {both}")

# 3. What if ghost was gated by (1-gateHealth)?
print("\n" + "="*80)
print("3. SIMULATION: ghost × (1-gateHealth)")
print("="*80)
suppressed = 0
surviving = 0
for i in onsets:
    r = rows[i]
    ghostGated = r['ghst'] * (1.0 - r['gH'])
    if ghostGated < 0.001:
        suppressed += 1
    else:
        surviving += 1
print(f"   gH range: {min(rows[i]['gH'] for i in onsets):.3f} - {max(rows[i]['gH'] for i in onsets):.3f}")
print(f"   Onsets that would be SUPPRESSED: {suppressed}")
print(f"   Onsets that would SURVIVE: {surviving}")

# 4. Check if surviving onsets (crack-driven) would still trigger
print("\n" + "="*80)
print("4. CRACK-ONLY DRIVE for ghost-driven onsets")
print("="*80)
for i in onsets:
    r = rows[i]
    if r['ghst'] > 0.001 and abs(r['Drive'] - r['ghst']) < 0.02:
        # Ghost-driven — what would crackDrive be?
        # crackDrive = Res * cFx * bFct * sEF
        crackDrive = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
        print(f"   frame {i}: crackDrive={crackDrive:.4f} vs floor={r['fFloor']:.3f} "
              f"-> {'WOULD TRIGGER' if crackDrive >= r['fFloor'] else 'MISSED'} "
              f"(Res={r['Res']:.3f} cFx={r['cFx']:.3f} bFct={r['bFct']:.3f} sEF={r['sEF']:.3f})")
