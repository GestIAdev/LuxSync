#!/usr/bin/env python3
"""Analyze calib8 — studio versions, post 0.08 floor."""
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
    "BREJCHA": r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\brejchacalib8.md",
    "TECHHOUSE": r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\techhouse8.md",
    "TIESTO": r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\tiestocalib8.md",
    "DEEPHOUSE": r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\deephouse8.md",
}

print("=" * 90)
print(f"{'TRACK':<12} {'frames':>6} {'dur_s':>6} {'onsets':>6} {'/s':>5} {'doubles':>7} {'weak%':>6} {'med%':>6} {'str%':>6} {'ghost':>6} {'crack':>6}")
print("=" * 90)

for name, path in TRACKS.items():
    try:
        rows = parse(path)
    except Exception as e:
        print(f"  {name}: ERROR {e}")
        continue
    onsets = [(i, r) for i, r in enumerate(rows) if r["ONSET"]]
    duration_s = len(rows) / 44.0
    if not onsets:
        print(f"  {name}: no onsets")
        continue

    doubles = 0
    prev = -100
    for idx, r in onsets:
        gap = idx - prev
        if gap < 10:
            doubles += 1
        prev = idx

    drives = [r["Drive"] for _, r in onsets]
    weak = sum(1 for d in drives if d < 0.05)
    med = sum(1 for d in drives if 0.05 <= d < 0.15)
    strong = sum(1 for d in drives if d >= 0.15)
    n = len(onsets)

    ghost = sum(1 for _, r in onsets if r["ghst"] > r["Res"] * r["cFx"] * r["bFct"] * r["sEF"])
    crack = n - ghost

    print(f"  {name:<12} {len(rows):>6} {duration_s:>6.1f} {n:>6} {n/duration_s:>5.1f} {doubles:>7} {100*weak/n:>5.0f}% {100*med/n:>5.0f}% {100*strong/n:>5.0f}% {ghost:>6} {crack:>6}")

print()
print("=" * 90)
print("DETAILED PER-TRACK")
print("=" * 90)

for name, path in TRACKS.items():
    try:
        rows = parse(path)
    except: continue
    onsets = [(i, r) for i, r in enumerate(rows) if r["ONSET"]]
    if not onsets: continue
    duration_s = len(rows) / 44.0

    print(f"\n--- {name} ({len(onsets)} onsets, {duration_s:.1f}s) ---")

    # Onset list with path
    print(f"  {'#':>3} {'frame':>5} {'SnareE':>7} {'Drive':>7} {'ghst':>7} {'hhDlt':>7} {'gH':>5} {'rGate':>6} {'gRefr':>5} {'path':>6} {'flags':>10}")
    prev = -100
    for i, (idx, r) in enumerate(onsets):
        crackDrive = r["Res"] * r["cFx"] * r["bFct"] * r["sEF"]
        is_ghost = r["ghst"] > crackDrive
        path_type = "GHOST" if is_ghost else "CRACK"
        gap = idx - prev
        flags = ""
        if r["KICK"]: flags += "[KICK]"
        if gap < 10 and i > 0: flags += " **DT**"
        print(f"  {i+1:>3} {idx:>5} {r['SnareE']:>7.3f} {r['Drive']:>7.3f} {r['ghst']:>7.4f} {r['hhDlt']:>7.4f} {r['gH']:>5.2f} {r['rGate']:>6.2f} {r['gRefr']:>5.0f} {path_type:>6} {flags:>10}")
        prev = idx

    # gH trajectory
    gHs = [r["gH"] for r in rows]
    print(f"  gH: start={gHs[0]:.3f} end={gHs[-1]:.3f} min={min(gHs):.3f} max={max(gHs):.3f} mean={statistics.mean(gHs):.3f}")
    print(f"  gH>0.8: {sum(1 for v in gHs if v>0.8)}/{len(gHs)}  gH<0.3: {sum(1 for v in gHs if v<0.3)}/{len(gHs)}")
