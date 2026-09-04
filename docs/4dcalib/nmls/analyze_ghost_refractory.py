#!/usr/bin/env python3
"""Simulate ghost-specific refractory on calib6 logs."""
import re
from pathlib import Path

PAT = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+Raw\u0394:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+Bass\u0394:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+rGate:(?P<rGate>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)(?P<flags>.*)"
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

BREJCHA = r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\gravitycalib6.md"
TECHHOUSE = r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\techhouse6.md"

for name, path in [("BREJCHA", BREJCHA), ("TECHHOUSE", TECHHOUSE)]:
    rows = parse(path)

    # Identify original onsets and their path
    orig_onsets = []
    for i, r in enumerate(rows):
        if r["ONSET"]:
            crackDrive = r["Res"] * r["cFx"] * r["bFct"] * r["sEF"]
            is_ghost = r["ghst"] > crackDrive
            orig_onsets.append((i, "GHOST" if is_ghost else "CRACK", r))

    # Simulate: ghost refractory of N frames after ANY onset
    for gRefr in [8, 10, 12]:
        ghost_refractory = 0
        new_onsets = []
        killed = 0
        for i, r in enumerate(rows):
            crackDrive = r["Res"] * r["cFx"] * r["bFct"] * r["sEF"]
            is_ghost_onset = r["ghst"] > crackDrive

            # Check if this frame would still be an onset
            if r["ONSET"]:
                if is_ghost_onset and ghost_refractory > 0:
                    # Ghost suppressed by refractory
                    killed += 1
                else:
                    new_onsets.append((i, "GHOST" if is_ghost_onset else "CRACK", r))
                    # After any onset, set ghost refractory
                    ghost_refractory = gRefr

            if ghost_refractory > 0:
                ghost_refractory -= 1

        # Count double triggers in new onsets
        doubles = 0
        prev = -100
        for idx, path_type, r in new_onsets:
            gap = idx - prev
            if gap < 10:
                doubles += 1
            prev = idx

        print(f"  {name} gRefr={gRefr}: {len(orig_onsets)} -> {len(new_onsets)} onsets (killed {killed}), doubles: {doubles}")

    # Show which onsets would be killed with gRefr=10
    print(f"\n  {name} DETAIL with gRefr=10:")
    ghost_refractory = 0
    for i, r in enumerate(rows):
        crackDrive = r["Res"] * r["cFx"] * r["bFct"] * r["sEF"]
        is_ghost_onset = r["ghst"] > crackDrive
        if r["ONSET"]:
            if is_ghost_onset and ghost_refractory > 0:
                print(f"    f={i} KILLED (ghost, gRefr={ghost_refractory}) SnareE={r['SnareE']:.3f} hhDlt={r['hhDlt']:.4f}")
            else:
                print(f"    f={i} KEPT ({'GHOST' if is_ghost_onset else 'CRACK'}) SnareE={r['SnareE']:.3f}")
                ghost_refractory = 10
        if ghost_refractory > 0:
            ghost_refractory -= 1
    print()
