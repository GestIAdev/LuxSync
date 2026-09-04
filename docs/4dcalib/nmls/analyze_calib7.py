#!/usr/bin/env python3
"""Analyze calib7 — onset density & sensitivity tuning."""
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
    "BREJCHA": r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\gravitycalib7.md",
    "TECHHOUSE": r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\techhouse7.md",
    "TIESTO": r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\tiestocalib7.md",
}

for name, path in TRACKS.items():
    rows = parse(path)
    onsets = [(i, r) for i, r in enumerate(rows) if r["ONSET"]]
    duration_s = len(rows) / 44.0

    print("=" * 80)
    print(f"TRACK: {name} -- {len(rows)} frames ({duration_s:.1f}s), {len(onsets)} onsets ({len(onsets)/duration_s:.1f}/s)")
    print("=" * 80)

    # ── 1. ONSET DENSITY ──
    print(f"\n  1. ONSET DENSITY: {len(onsets)} onsets in {duration_s:.1f}s = {len(onsets)/duration_s:.1f} onsets/sec")

    # ── 2. DOUBLE TRIGGERS ──
    doubles = 0
    prev = -100
    for idx, r in onsets:
        gap = idx - prev
        if gap < 10:
            doubles += 1
        prev = idx
    print(f"  2. DOUBLE TRIGGERS (gap<10f): {doubles}")

    # ── 3. ONSET STRENGTH DISTRIBUTION ──
    drives = [r["Drive"] for _, r in onsets]
    snareEs = [r["SnareE"] for _, r in onsets]
    print(f"\n  3. ONSET STRENGTH:")
    print(f"    Drive: min={min(drives):.3f} max={max(drives):.3f} mean={statistics.mean(drives):.3f} median={statistics.median(drives):.3f}")
    print(f"    SnareE: min={min(snareEs):.3f} max={max(snareEs):.3f} mean={statistics.mean(snareEs):.3f} median={statistics.median(snareEs):.3f}")

    # ── 4. WEAK ONSETS (the "imperceptible" ones) ──
    weak = [(i, r) for i, r in onsets if r["Drive"] < 0.05]
    medium = [(i, r) for i, r in onsets if 0.05 <= r["Drive"] < 0.15]
    strong = [(i, r) for i, r in onsets if r["Drive"] >= 0.15]
    print(f"\n  4. ONSET STRENGTH BREAKDOWN:")
    print(f"    Weak   (Drive < 0.05): {len(weak)} ({100*len(weak)/max(1,len(onsets)):.0f}%)")
    print(f"    Medium (0.05-0.15):    {len(medium)} ({100*len(medium)/max(1,len(onsets)):.0f}%)")
    print(f"    Strong (>= 0.15):      {len(strong)} ({100*len(strong)/max(1,len(onsets)):.0f}%)")

    # ── 5. PATH BREAKDOWN ──
    ghost = [(i, r) for i, r in onsets if r["ghst"] > r["Res"] * r["cFx"] * r["bFct"] * r["sEF"]]
    crack = [(i, r) for i, r in onsets if r["ghst"] <= r["Res"] * r["cFx"] * r["bFct"] * r["sEF"]]
    print(f"\n  5. PATH BREAKDOWN:")
    print(f"    Crack-path: {len(crack)}")
    print(f"    Ghost-path: {len(ghost)}")

    # ── 6. WEAK ONSET DETAILS (what would a threshold kill?) ──
    print(f"\n  6. SENSITIVITY THRESHOLD SIMULATION:")
    for thresh in [0.03, 0.05, 0.08, 0.10, 0.15]:
        kept = [(i, r) for i, r in onsets if r["Drive"] >= thresh]
        killed = len(onsets) - len(kept)
        doubles_new = 0
        prev = -100
        for idx, r in kept:
            gap = idx - prev
            if gap < 10:
                doubles_new += 1
            prev = idx
        print(f"    Drive >= {thresh:.2f}: {len(kept)} onsets (killed {killed}), {len(kept)/duration_s:.1f}/s, doubles={doubles_new}")

    # ── 7. GHOST-PATH WEAK ONSETS ──
    ghost_weak = [(i, r) for i, r in ghost if r["Drive"] < 0.05]
    ghost_strong = [(i, r) for i, r in ghost if r["Drive"] >= 0.05]
    print(f"\n  7. GHOST ONSET STRENGTH:")
    print(f"    Ghost weak (Drive<0.05): {len(ghost_weak)}")
    print(f"    Ghost strong (>=0.05):   {len(ghost_strong)}")
    if ghost_weak:
        hhDlts = [r["hhDlt"] for _, r in ghost_weak]
        snareEs_w = [r["SnareE"] for _, r in ghost_weak]
        print(f"    Weak ghost hhDlt: min={min(hhDlts):.4f} max={max(hhDlts):.4f} mean={statistics.mean(hhDlts):.4f}")
        print(f"    Weak ghost SnareE: min={min(snareEs_w):.3f} max={max(snareEs_w):.3f} mean={statistics.mean(snareEs_w):.3f}")

    # ── 8. dynTh ANALYSIS ──
    dynThs = [r["dynTh"] for r in rows]
    print(f"\n  8. dynTh: min={min(dynThs):.4f} max={max(dynThs):.4f} mean={statistics.mean(dynThs):.4f}")

    print()
