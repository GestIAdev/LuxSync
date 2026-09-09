#!/usr/bin/env python3
"""Analyze calib8b — techhouse roll + opus prytdz snare loss."""
import re, statistics
from pathlib import Path

PAT = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+Raw\u0394:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+Bass\u0394:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+rGate:(?P<rGate>[-\d.]+)\s+gRefr:(?P<gRefr>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)(?P<flags>.*)"
)

def parse(path):
    text = Path(path).read_text(encoding="utf-8", errors="replace")
    rows = []
    for line in text.splitlines():
        if "[FINESSE_AUDIT]" not in line: continue
        m = PAT.search(line)
        if not m: continue
        d = m.groupdict()
        for k in d:
            if k == "flags": continue
            try: d[k] = float(d[k])
            except: d[k] = 0.0
        d["ONSET"] = "[ONSET]" in d["flags"]
        d["KICK"] = "[KICK]" in d["flags"]
        rows.append(d)
    return rows

TRACKS = {
    "TECHHOUSE8": r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\techhouse8.md",
    "OPUS_PRYTDZ": r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\opuspyrytdz8.md",
    "MINIMAL8": r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\minimalcalib8.md",
}

for name, path in TRACKS.items():
    try:
        rows = parse(path)
    except Exception as e:
        print(f"  {name}: ERROR {e}")
        continue
    onsets = [(i, r) for i, r in enumerate(rows) if r["ONSET"]]
    duration_s = len(rows) / 44.0

    print("=" * 90)
    print(f"TRACK: {name} -- {len(rows)} frames ({duration_s:.1f}s), {len(onsets)} onsets ({len(onsets)/duration_s:.1f}/s)")
    print("=" * 90)

    # ── 1. ONSET DENSITY ──
    print(f"\n  1. ONSET DENSITY: {len(onsets)} onsets in {duration_s:.1f}s = {len(onsets)/duration_s:.1f} onsets/sec")

    # ── 2. Drive distribution of ALL frames (not just onsets) ──
    all_drives = [r["Drive"] for r in rows]
    above_floor = sum(1 for d in all_drives if d >= 0.08)
    below_floor = sum(1 for d in all_drives if d < 0.08)
    print(f"\n  2. DRIVE vs FLOOR (0.08):")
    print(f"    Frames above floor: {above_floor} ({100*above_floor/len(rows):.0f}%)")
    print(f"    Frames below floor: {below_floor} ({100*below_floor/len(rows):.0f}%)")

    # ── 3. What the floor killed: frames with crossover (isCrossover) but Drive < 0.08 ──
    # We can't detect crossover directly, but we can find frames where Drive is 0.00-0.08
    # but Res*cFx*bFct*sEF (crackDrive) or ghst (ghostDrive) is non-trivial
    killed = []
    for i, r in enumerate(rows):
        crackDrive = r["Res"] * r["cFx"] * r["bFct"] * r["sEF"]
        ghostDrive = r["ghst"]
        maxDrive = max(crackDrive, ghostDrive)
        if 0.03 <= maxDrive < 0.08 and r["gRefr"] == 0:  # not in refractory, would have fired
            killed.append((i, r, crackDrive, ghostDrive))

    print(f"\n  3. POTENTIAL KILLED ONSETS (maxDrive 0.03-0.08, not refractory):")
    print(f"    Count: {len(killed)}")
    if killed:
        print(f"    {'#':>3} {'frame':>5} {'SnareE':>7} {'crackD':>7} {'ghostD':>7} {'Flux':>7} {'Res':>7} {'hhDlt':>7} {'Veto':>7} {'gH':>5}")
        for i, (idx, r, cd, gd) in enumerate(killed[:30]):
            print(f"    {i+1:>3} {idx:>5} {r['SnareE']:>7.3f} {cd:>7.4f} {gd:>7.4f} {r['Flux']:>7.3f} {r['Res']:>7.3f} {r['hhDlt']:>7.4f} {r['Veto']:>7.3f} {r['gH']:>5.2f}")

    # ── 4. Onset list ──
    print(f"\n  4. ONSET LIST:")
    print(f"    {'#':>3} {'frame':>5} {'SnareE':>7} {'Drive':>7} {'ghst':>7} {'hhDlt':>7} {'gH':>5} {'gRefr':>5} {'flags':>10}")
    prev = -100
    for i, (idx, r) in enumerate(onsets):
        flags = ""
        if r["KICK"]: flags += "[KICK]"
        gap = idx - prev
        if gap < 10 and i > 0: flags += " **DT**"
        print(f"    {i+1:>3} {idx:>5} {r['SnareE']:>7.3f} {r['Drive']:>7.3f} {r['ghst']:>7.4f} {r['hhDlt']:>7.4f} {r['gH']:>5.2f} {r['gRefr']:>5.0f} {flags:>10}")
        prev = idx

    # ── 5. Floor simulation ──
    print(f"\n  5. FLOOR SIMULATION (what if floor was lower?):")
    for floor in [0.03, 0.05, 0.08]:
        # Count frames that would be onsets: Drive >= floor AND gRefr == 0 AND isCrossover
        # We can't detect crossover, but we can approximate: frames where maxDrive >= floor
        # and the frame is a "peak" (Drive > previous Drive)
        count = 0
        for i, r in enumerate(rows):
            crackDrive = r["Res"] * r["cFx"] * r["bFct"] * r["sEF"]
            ghostDrive = r["ghst"]
            maxDrive = max(crackDrive, ghostDrive)
            if maxDrive >= floor and r["gRefr"] == 0:
                # Check if this is a crossover (approximate: Drive jumped up)
                if i > 0:
                    prev_r = rows[i-1]
                    prev_max = max(prev_r["Res"]*prev_r["cFx"]*prev_r["bFct"]*prev_r["sEF"], prev_r["ghst"])
                    if maxDrive > prev_max * 1.3:  # significant increase
                        count += 1
        print(f"    Floor {floor:.2f}: ~{count} potential onsets ({count/duration_s:.1f}/s)")

    print()
