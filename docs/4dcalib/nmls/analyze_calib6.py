#!/usr/bin/env python3
"""Analyze calib6 logs — double trigger + Brejcha residual over-triggering."""
import re, statistics
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
    onsets = [(i, r) for i, r in enumerate(rows) if r["ONSET"]]

    print("=" * 80)
    print(f"TRACK: {name} — {len(rows)} frames, {len(onsets)} onsets")
    print("=" * 80)

    # ── 1. ONSET SPACING — double trigger detection ──
    print(f"\n  1. ONSET SPACING (double trigger detection):")
    print(f"  {'#':>3} {'frame':>5} {'SnareE':>7} {'Drive':>7} {'ghst':>7} {'hhDlt':>7} {'gH':>5} {'rGate':>6} {'gap_f':>6} {'gap_ms':>7} {'path':>6} {'flags':>10}")
    prev_onset_frame = -100
    double_triggers = []
    for i, (idx, r) in enumerate(onsets):
        gap = idx - prev_onset_frame
        gap_ms = gap * 1000 / 44
        crackDrive = r["Res"] * r["cFx"] * r["bFct"] * r["sEF"]
        is_ghost = r["ghst"] > crackDrive
        path = "GHOST" if is_ghost else "CRACK"
        flags = ""
        if r["KICK"]: flags += "[KICK]"
        # Double trigger: gap < 10 frames (~227ms)
        is_double = gap < 10 and i > 0
        if is_double:
            double_triggers.append((i, idx, gap, gap_ms, r, prev_onset_frame))
            flags += " *** DOUBLE ***"
        print(f"  {i+1:>3} {idx:>5} {r['SnareE']:>7.3f} {r['Drive']:>7.3f} {r['ghst']:>7.4f} {r['hhDlt']:>7.4f} {r['gH']:>5.3f} {r['rGate']:>6.2f} {gap:>6} {gap_ms:>7.0f} {path:>6} {flags:>10}")
        prev_onset_frame = idx

    print(f"\n  Double triggers (gap < 10 frames / 227ms): {len(double_triggers)}")
    for i, idx, gap, gap_ms, r, prev in double_triggers:
        prev_r = rows[prev]
        crackDrive_prev = prev_r["Res"] * prev_r["cFx"] * prev_r["bFct"] * prev_r["sEF"]
        prev_path = "GHOST" if prev_r["ghst"] > crackDrive_prev else "CRACK"
        crackDrive_curr = r["Res"] * r["cFx"] * r["bFct"] * r["sEF"]
        curr_path = "GHOST" if r["ghst"] > crackDrive_curr else "CRACK"
        print(f"    #{i+1}: f={prev}({prev_path},SnareE={prev_r['SnareE']:.3f}) -> f={idx}({curr_path},SnareE={r['SnareE']:.3f}) gap={gap}f/{gap_ms:.0f}ms")

    # ── 2. GHOST-PATH ANALYSIS ──
    ghost_onsets = [(i, r) for i, r in onsets if r["ghst"] > r["Res"] * r["cFx"] * r["bFct"] * r["sEF"]]
    crack_onsets = [(i, r) for i, r in onsets if r["ghst"] <= r["Res"] * r["cFx"] * r["bFct"] * r["sEF"]]
    print(f"\n  2. PATH BREAKDOWN:")
    print(f"    Crack-path: {len(crack_onsets)}")
    print(f"    Ghost-path: {len(ghost_onsets)}")

    # ── 3. rGate EFFECTIVENESS ──
    print(f"\n  3. rGate AT GHOST ONSETS:")
    if ghost_onsets:
        rGates = [r["rGate"] for _, r in ghost_onsets]
        print(f"    rGate: min={min(rGates):.2f} max={max(rGates):.2f} mean={statistics.mean(rGates):.2f}")
        print(f"    rGate < 0.30: {sum(1 for v in rGates if v < 0.30)}")
        print(f"    rGate < 0.50: {sum(1 for v in rGates if v < 0.50)}")
        print(f"    rGate >= 0.80: {sum(1 for v in rGates if v >= 0.80)}")
        # Check: would a harder rGate kill them?
        for thresh in [0.20, 0.30, 0.50]:
            killed = 0
            for _, r in ghost_onsets:
                if r["rGate"] < thresh:
                    newGhost = r["ghst"] * thresh / r["rGate"] if r["rGate"] > 0 else 0
                else:
                    newGhost = r["ghst"]
                if newGhost < r["Drive"] * 0.3:
                    killed += 1
            print(f"    If rGate capped at {thresh}: {killed}/{len(ghost_onsets)} ghost onsets killed")

    # ── 4. gH TRAJECTORY ──
    gH_vals = [r["gH"] for r in rows]
    print(f"\n  4. gH TRAJECTORY:")
    print(f"    start: {gH_vals[0]:.3f}, end: {gH_vals[-1]:.3f}")
    print(f"    gH > 0.8: {sum(1 for v in gH_vals if v > 0.8)}/{len(gH_vals)}")
    print(f"    gH < 0.3: {sum(1 for v in gH_vals if v < 0.3)}/{len(gH_vals)}")

    # ── 5. DOUBLE TRIGGER ROOT CAUSE ──
    print(f"\n  5. DOUBLE TRIGGER ROOT CAUSE:")
    for i, (n, idx, gap, gap_ms, r, prev) in enumerate(double_triggers):
        prev_r = rows[prev]
        print(f"    DT#{i+1}: prev f={prev} -> curr f={idx} (gap={gap}f)")
        print(f"      PREV: SnareE={prev_r['SnareE']:.3f} Drive={prev_r['Drive']:.3f} ghst={prev_r['ghst']:.4f} hhDlt={prev_r['hhDlt']:.4f}")
        print(f"      CURR: SnareE={r['SnareE']:.3f} Drive={r['Drive']:.3f} ghst={r['ghst']:.4f} hhDlt={r['hhDlt']:.4f}")
        # Was the ghost re-firing on the reverb tail?
        if r["hhDlt"] > 0.05 and r["SnareE"] < prev_r["SnareE"] * 0.7:
            print(f"      -> DIAGNOSIS: Ghost re-firing on reverb tail (hhDlt={r['hhDlt']:.4f}, SnareE dropped {prev_r['SnareE']:.3f}->{r['SnareE']:.3f})")
        elif r["SnareE"] > 0.3:
            print(f"      -> DIAGNOSIS: Real second snare (SnareE={r['SnareE']:.3f} still high)")
        else:
            print(f"      -> DIAGNOSIS: Marginal re-trigger")

    print()
