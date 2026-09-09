#!/usr/bin/env python3
"""Diagnose why Opus still has no snares despite fFloor=0.005."""
import re
from pathlib import Path

PAT = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+Raw\u0394:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+Bass\u0394:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+fFloor:(?P<fFloor>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+rGate:(?P<rGate>[-\d.]+)\s+gRefr:(?P<gRefr>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)"
)

rows = []
text = Path(r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\opubuildclimax9.md").read_text(encoding="utf-8", errors="replace")
for line in text.splitlines():
    if "[FINESSE_AUDIT]" not in line: continue
    m = PAT.search(line)
    if not m: continue
    d = {k: float(v) for k, v in m.groupdict().items()}
    rows.append(d)

print(f"OPUS BUILDUP/CLIMAX 9 — {len(rows)} frames")
print("="*80)

# Key stats
for key in ['SnareE', 'sEF', 'hE', 'gH', 'Res', 'cFx', 'bFct', 'hhDlt', 'Drive', 'fFloor', 'dynTh', 'sd', 'ghst']:
    vals = [r[key] for r in rows]
    print(f"  {key:>8}: min={min(vals):.4f} max={max(vals):.4f} mean={sum(vals)/len(vals):.4f}")

print("\n" + "="*80)
print("BOTTLENECK ANALYSIS")
print("="*80)

# sEF is stuck at 0.050?
sef_vals = set(r['sEF'] for r in rows)
print(f"\n  sEF unique values: {sorted(sef_vals)[:10]}")
print(f"  sEF is STUCK at 0.050: {all(abs(r['sEF'] - 0.050) < 0.001 for r in rows)}")

# hE is always 0?
print(f"  hE is always 0: {all(r['hE'] == 0.0 for r in rows)}")
print(f"  hE max: {max(r['hE'] for r in rows):.4f}")

# gH (gateHealth) is near 0?
print(f"  gH max: {max(r['gH'] for r in rows):.4f} (gate is {'DEAD' if max(r['gH'] for r in rows) < 0.01 else 'ALIVE'})")

# What Drive WOULD be if sEF were higher
print("\n  WHAT IF sEF WERE HIGHER?")
print(f"  {'frame':>5} {'Res':>7} {'cFx':>7} {'bFct':>7} {'sEF':>7} {'hhDlt':>7} {'Drive':>7} {'fFloor':>7} | {'sEF=0.3':>8} {'sEF=0.5':>8} {'sEF=1.0':>8}")
# Top frames by Res (most likely real snares)
top_res = sorted(enumerate(rows), key=lambda x: x[1]['Res'], reverse=True)[:15]
for idx, r in top_res:
    crack_now = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
    ghost_now = r['ghst']
    drive_now = max(crack_now, ghost_now)
    # Simulate with higher sEF
    crack_03 = r['Res'] * r['cFx'] * r['bFct'] * 0.30
    ghost_03 = r['hhDlt'] * 0.30 * (1 - r['sd']) * r['rGate']
    drive_03 = max(crack_03, ghost_03)
    crack_05 = r['Res'] * r['cFx'] * r['bFct'] * 0.50
    ghost_05 = r['hhDlt'] * 0.50 * (1 - r['sd']) * r['rGate']
    drive_05 = max(crack_05, ghost_05)
    crack_10 = r['Res'] * r['cFx'] * r['bFct'] * 1.00
    ghost_10 = r['hhDlt'] * 1.00 * (1 - r['sd']) * r['rGate']
    drive_10 = max(crack_10, ghost_10)
    print(f"  {idx:>5} {r['Res']:>7.3f} {r['cFx']:>7.3f} {r['bFct']:>7.3f} {r['sEF']:>7.3f} {r['hhDlt']:>7.4f} {drive_now:>7.4f} {r['fFloor']:>7.3f} | {drive_03:>8.4f} {drive_05:>8.4f} {drive_10:>8.4f}")

# How many frames would fire with sEF=0.3?
print("\n  FRAMES THAT WOULD FIRE (Drive >= fFloor AND momentum would cross):")
for sef_sim in [0.05, 0.15, 0.30, 0.50, 1.00]:
    would_fire = 0
    for r in rows:
        crack = r['Res'] * r['cFx'] * r['bFct'] * sef_sim
        ghost = r['hhDlt'] * sef_sim * (1 - r['sd']) * r['rGate']
        drive = max(crack, ghost)
        if drive >= r['fFloor']:
            would_fire += 1
    print(f"    sEF={sef_sim:.2f}: {would_fire}/{len(rows)} frames above fFloor ({100*would_fire/len(rows):.0f}%)")

# The sEF relaxation formula
print("\n  sEF RELAXATION ANALYSIS:")
print(f"  Current: relaxedMinSef = 0.05 + 0.35 * treblePresence * densityGate * (1-gateHealth)")
for r in rows[:5]:
    treblePresence = min(1.0, r['hE'] * 2.0)
    densityGate = 1.0 - r['sd']
    gateHealth = r['gH']
    relaxed = 0.05 + 0.35 * treblePresence * densityGate * (1 - gateHealth)
    print(f"    frame: hE={r['hE']:.3f} treblePres={treblePresence:.3f} densGate={densityGate:.3f} gH={gateHealth:.3f} → relaxedMinSef={relaxed:.4f} (STUCK at 0.05 because treblePresence=0)")

print("\n  PROPOSED FIX: add dead-gate rescue without treblePresence requirement")
print(f"  New: relaxedMinSef = 0.05 + max(treble_rescue, 0.30 * (1-gateHealth) * densityGate)")
for r in rows[:5]:
    treblePresence = min(1.0, r['hE'] * 2.0)
    densityGate = 1.0 - r['sd']
    gateHealth = r['gH']
    treble_rescue = 0.35 * treblePresence * densityGate * (1 - gateHealth)
    dead_gate_rescue = 0.30 * (1 - gateHealth) * densityGate
    relaxed = 0.05 + max(treble_rescue, dead_gate_rescue)
    print(f"    frame: gH={gateHealth:.3f} densGate={densityGate:.3f} → treble_rescue={treble_rescue:.4f} dead_gate_rescue={dead_gate_rescue:.4f} → relaxedMinSef={relaxed:.4f}")
