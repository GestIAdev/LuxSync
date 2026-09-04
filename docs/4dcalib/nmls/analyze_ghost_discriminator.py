#!/usr/bin/env python3
"""
Ghost discriminator simulation — WAVE 7749.86 prep.
Tests crackFlux-anchored ghost filtering on Brejcha (FP-heavy) and Minimal (clean).
"""
import re, statistics
from pathlib import Path

# ─── Parse helper ───
PAT = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+Raw\u0394:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+Bass\u0394:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)(?P<flags>.*)"
)

def parse_log(path):
    text = Path(path).read_text(encoding="utf-8", errors="replace")
    rows = []
    for line in text.splitlines():
        if "[FINESSE_AUDIT]" not in line:
            continue
        m = PAT.search(line)
        if not m:
            continue
        d = m.groupdict()
        for k in d:
            if k == "flags":
                continue
            try:
                d[k] = float(d[k])
            except (ValueError, TypeError):
                d[k] = 0.0
        d["ONSET"] = "[ONSET]" in d["flags"]
        d["KICK"] = "[KICK]" in d["flags"]
        rows.append(d)
    return rows

# ─── Simulate ghost variants ───
def simulate(rows, variant="current", crack_gate_threshold=0.10, flatness_source=None):
    """
    Reconstruct the snareDrive and onset decision for each frame.
    variant: 'current' | 'A' | 'B' | 'A_flat' | 'B_flat'
    """
    # We need to reconstruct MACD state to know if an onset would fire.
    # But the log already tells us [ONSET]. We can't re-run the MACD.
    # Instead, we check: for each frame that WAS an onset, would the variant
    # have produced a trebleGhost >= snareFloor (0.0 typically)?
    # And for the crack path, the crackDrive is unchanged.
    #
    # The key insight: snareDrive = max(crackDrive, trebleGhost).
    # If variant reduces trebleGhost below crackDrive, the onset survives (crack-driven).
    # If variant reduces trebleGhost below snareFloor AND crackDrive < snareFloor,
    # the onset is killed.
    #
    # We approximate: onset survives if max(crackDrive, newGhost) >= snareFloor
    # where snareFloor is the dynTh at that frame.
    # Actually the real gate is: isCrossover && snareDrive >= snareFloor.
    # We can't recompute isCrossover without the full MACD state.
    #
    # SIMPLIFICATION: For ghost-path onsets (ghost > crack), if the variant
    # reduces ghost below the ORIGINAL Drive value, we mark it as "killed"
    # because the MACD crossover was driven by that ghost signal.
    # If ghost stays >= original Drive, it survives.
    # For crack-path onsets, they always survive (ghost variant doesn't affect crack).

    results = []
    for r in rows:
        if not r["ONSET"]:
            continue
        crackDrive = r["Res"] * r["cFx"] * r["bFct"] * r["sEF"]
        originalGhost = r["ghst"]
        originalDrive = r["Drive"]
        is_ghost_path = originalGhost > crackDrive

        # Compute new ghost
        if variant == "current":
            newGhost = originalGhost
        elif variant == "A":
            # Variant A: trebleGhost = rawHhDelta * crackFlux * smartSef * (1 - sd)
            newGhost = r["hhDlt"] * r["cFx"] * r["sEF"] * (1.0 - r["sd"])
        elif variant == "B":
            # Variant B: hard gate, if cFx < threshold, ghost = 0
            if r["cFx"] < crack_gate_threshold:
                newGhost = 0.0
            else:
                newGhost = originalGhost
        elif variant == "A_flat":
            # Variant A + flatness fusion
            flat = flatness_source(r) if flatness_source else 0.5
            newGhost = r["hhDlt"] * r["cFx"] * r["sEF"] * (1.0 - r["sd"]) * flat
        elif variant == "B_flat":
            if r["cFx"] < crack_gate_threshold:
                newGhost = 0.0
            else:
                flat = flatness_source(r) if flatness_source else 0.5
                newGhost = originalGhost * flat
        else:
            newGhost = originalGhost

        newDrive = max(crackDrive, newGhost)

        # Heuristic: if ghost-path onset and newGhost < originalDrive * 0.5,
        # the MACD momentum would have been much lower → likely no crossover
        # → onset killed. If newGhost >= originalDrive * 0.8, likely survives.
        if is_ghost_path:
            if newGhost < originalDrive * 0.3:
                status = "KILLED"
            elif newGhost < originalDrive * 0.7:
                status = "WEAKENED"
            else:
                status = "SURVIVES"
        else:
            status = "SURVIVES (crack path)"

        results.append({
            "frame": rows.index(r),
            "SnareE": r["SnareE"],
            "cFx": r["cFx"],
            "hhDlt": r["hhDlt"],
            "ghst_orig": originalGhost,
            "ghst_new": newGhost,
            "Drive_orig": originalDrive,
            "Drive_new": newDrive,
            "crackDrive": crackDrive,
            "is_ghost": is_ghost_path,
            "status": status,
            "KICK": r["KICK"],
        })
    return results

# ─── Main ───
BREJCHA = r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\gravitycalib5.md"
MINIMAL = r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\minimalcalib5.md"

brejcha = parse_log(BREJCHA)
minimal = parse_log(MINIMAL)

print("=" * 80)
print("GHOST DISCRIMINATOR SIMULATION — WAVE 7749.86 prep")
print("=" * 80)
print(f"  Brejcha: {len(brejcha)} frames, {sum(1 for r in brejcha if r['ONSET'])} onsets")
print(f"  Minimal: {len(minimal)} frames, {sum(1 for r in minimal if r['ONSET'])} onsets")
print()

# ─── 1. HYPOTHESIS VALIDATION: cFx at onsets ───
print("=" * 80)
print("1. HYPOTHESIS VALIDATION: cFx (Crack Flux) at ghost-path onsets")
print("=" * 80)

brejcha_onsets = [r for r in brejcha if r["ONSET"]]
minimal_onsets = [r for r in minimal if r["ONSET"]]

# Classify: ghost-path vs crack-path
brejcha_ghost = []
brejcha_crack = []
for r in brejcha_onsets:
    cd = r["Res"] * r["cFx"] * r["bFct"] * r["sEF"]
    if r["ghst"] > cd:
        brejcha_ghost.append(r)
    else:
        brejcha_crack.append(r)

minimal_ghost = []
minimal_crack = []
for r in minimal_onsets:
    cd = r["Res"] * r["cFx"] * r["bFct"] * r["sEF"]
    if r["ghst"] > cd:
        minimal_ghost.append(r)
    else:
        minimal_crack.append(r)

print(f"\n  BREJCHA ghost-path onsets: {len(brejcha_ghost)}")
print(f"    cFx: min={min(r['cFx'] for r in brejcha_ghost):.3f} max={max(r['cFx'] for r in brejcha_ghost):.3f} mean={statistics.mean(r['cFx'] for r in brejcha_ghost):.3f} median={statistics.median(r['cFx'] for r in brejcha_ghost):.3f}")
print(f"    cFx < 0.10: {sum(1 for r in brejcha_ghost if r['cFx'] < 0.10)}/{len(brejcha_ghost)}")
print(f"    cFx < 0.15: {sum(1 for r in brejcha_ghost if r['cFx'] < 0.15)}/{len(brejcha_ghost)}")
print(f"    cFx < 0.20: {sum(1 for r in brejcha_ghost if r['cFx'] < 0.20)}/{len(brejcha_ghost)}")
print(f"    cFx >= 0.20: {sum(1 for r in brejcha_ghost if r['cFx'] >= 0.20)}/{len(brejcha_ghost)}")

print(f"\n  BREJCHA crack-path onsets: {len(brejcha_crack)}")
if brejcha_crack:
    print(f"    cFx: min={min(r['cFx'] for r in brejcha_crack):.3f} max={max(r['cFx'] for r in brejcha_crack):.3f} mean={statistics.mean(r['cFx'] for r in brejcha_crack):.3f}")

print(f"\n  MINIMAL ghost-path onsets: {len(minimal_ghost)}")
if minimal_ghost:
    print(f"    cFx: min={min(r['cFx'] for r in minimal_ghost):.3f} max={max(r['cFx'] for r in minimal_ghost):.3f} mean={statistics.mean(r['cFx'] for r in minimal_ghost):.3f}")
    print(f"    cFx < 0.10: {sum(1 for r in minimal_ghost if r['cFx'] < 0.10)}/{len(minimal_ghost)}")
    print(f"    cFx < 0.15: {sum(1 for r in minimal_ghost if r['cFx'] < 0.15)}/{len(minimal_ghost)}")

print(f"\n  MINIMAL crack-path onsets: {len(minimal_crack)}")
if minimal_crack:
    print(f"    cFx: min={min(r['cFx'] for r in minimal_crack):.3f} max={max(r['cFx'] for r in minimal_crack):.3f} mean={statistics.mean(r['cFx'] for r in minimal_crack):.3f}")

# ─── Detailed: Brejcha 29 suspicious onsets ───
print(f"\n  BREJCHA suspicious onsets (SnareE < 0.05, ghost-path, no KICK):")
suspicious = [r for r in brejcha_ghost if r["SnareE"] < 0.05 and not r["KICK"]]
print(f"    Count: {len(suspicious)}")
if suspicious:
    cfx_vals = [r["cFx"] for r in suspicious]
    print(f"    cFx: min={min(cfx_vals):.3f} max={max(cfx_vals):.3f} mean={statistics.mean(cfx_vals):.3f} median={statistics.median(cfx_vals):.3f}")
    print(f"    cFx < 0.05: {sum(1 for v in cfx_vals if v < 0.05)}")
    print(f"    cFx < 0.10: {sum(1 for v in cfx_vals if v < 0.10)}")
    print(f"    cFx < 0.15: {sum(1 for v in cfx_vals if v < 0.15)}")
    print(f"    cFx >= 0.15: {sum(1 for v in cfx_vals if v >= 0.15)}")

# ─── 2. VARIANT A: Multiplication ───
print("\n" + "=" * 80)
print("2. VARIANT A: trebleGhost = rawHhDelta * crackFlux * smartSef * (1 - sd)")
print("=" * 80)

for name, rows, onsets in [("BREJCHA", brejcha, brejcha_onsets), ("MINIMAL", minimal, minimal_onsets)]:
    res = simulate(rows, variant="A")
    killed = sum(1 for r in res if "KILLED" in r["status"])
    weakened = sum(1 for r in res if "WEAKENED" in r["status"])
    survives = sum(1 for r in res if "SURVIVES" in r["status"])
    print(f"\n  {name}: {len(res)} onsets → {survives} survive, {weakened} weakened, {killed} killed")
    # Show killed details
    for r in res:
        if "KILLED" in r["status"]:
            print(f"    KILLED f={r['frame']:3d} | SnareE={r['SnareE']:.3f} | cFx={r['cFx']:.3f} | hhDlt={r['hhDlt']:.4f} | ghst_orig={r['ghst_orig']:.4f} | ghst_new={r['ghst_new']:.4f}")

# ─── 3. VARIANT B: Hard Gate ───
print("\n" + "=" * 80)
print("3. VARIANT B: if (crackFlux < 0.10) trebleGhost = 0")
print("=" * 80)

for name, rows, onsets in [("BREJCHA", brejcha, brejcha_onsets), ("MINIMAL", minimal, minimal_onsets)]:
    res = simulate(rows, variant="B", crack_gate_threshold=0.10)
    killed = sum(1 for r in res if "KILLED" in r["status"])
    weakened = sum(1 for r in res if "WEAKENED" in r["status"])
    survives = sum(1 for r in res if "SURVIVES" in r["status"])
    print(f"\n  {name}: {len(res)} onsets → {survives} survive, {weakened} weakened, {killed} killed")
    for r in res:
        if "KILLED" in r["status"]:
            print(f"    KILLED f={r['frame']:3d} | SnareE={r['SnareE']:.3f} | cFx={r['cFx']:.3f} | hhDlt={r['hhDlt']:.4f} | ghst_orig={r['ghst_orig']:.4f}")

# ─── 3b. VARIANT B with different thresholds ───
print("\n" + "=" * 80)
print("3b. VARIANT B: threshold sweep (0.05, 0.08, 0.10, 0.12, 0.15)")
print("=" * 80)

for thresh in [0.05, 0.08, 0.10, 0.12, 0.15]:
    br = simulate(brejcha, variant="B", crack_gate_threshold=thresh)
    mn = simulate(minimal, variant="B", crack_gate_threshold=thresh)
    br_killed = sum(1 for r in br if "KILLED" in r["status"])
    mn_killed = sum(1 for r in mn if "KILLED" in r["status"])
    br_total = len(br)
    mn_total = len(mn)
    print(f"  thresh={thresh:.2f} | BREJCHA: {br_total - br_killed}/{br_total} survive ({br_killed} killed) | MINIMAL: {mn_total - mn_killed}/{mn_total} survive ({mn_killed} killed)")

# ─── 4. FLATNESS FUSION ───
# The log doesn't have a direct flatness field, but we can use WNS (White Noise Score)
# as a proxy for flatness. WNS is the spectral flatness measure.
print("\n" + "=" * 80)
print("4. FLATNESS FUSION (using WNS as proxy for spectral flatness)")
print("=" * 80)

def get_flatness(r):
    """WNS = White Noise Score, proxy for spectral flatness in the crack band."""
    return r["WNS"]

# Check WNS at Brejcha suspicious onsets vs Minimal onsets
print("\n  WNS distribution at ghost-path onsets:")
brejcha_ghost_wns = [r["WNS"] for r in brejcha_ghost]
minimal_ghost_wns = [r["WNS"] for r in minimal_ghost] if minimal_ghost else []
print(f"    BREJCHA ghost: WNS min={min(brejcha_ghost_wns):.3f} max={max(brejcha_ghost_wns):.3f} mean={statistics.mean(brejcha_ghost_wns):.3f}")
if minimal_ghost_wns:
    print(f"    MINIMAL ghost: WNS min={min(minimal_ghost_wns):.3f} max={max(minimal_ghost_wns):.3f} mean={statistics.mean(minimal_ghost_wns):.3f}")
else:
    print(f"    MINIMAL ghost: (none)")

# WNS at suspicious onsets
suspicious_wns = [r["WNS"] for r in suspicious]
print(f"    BREJCHA suspicious: WNS min={min(suspicious_wns):.3f} max={max(suspicious_wns):.3f} mean={statistics.mean(suspicious_wns):.3f}")
print(f"    WNS > 0.3: {sum(1 for v in suspicious_wns if v > 0.3)}/{len(suspicious_wns)}")
print(f"    WNS > 0.5: {sum(1 for v in suspicious_wns if v > 0.5)}/{len(suspicious_wns)}")

# Variant A + flatness
print("\n  Variant A + flatness (WNS):")
for name, rows in [("BREJCHA", brejcha), ("MINIMAL", minimal)]:
    res = simulate(rows, variant="A_flat", flatness_source=get_flatness)
    killed = sum(1 for r in res if "KILLED" in r["status"])
    survives = sum(1 for r in res if "SURVIVES" in r["status"])
    print(f"    {name}: {len(res)} onsets → {survives} survive, {killed} killed")

# Variant B + flatness
print("\n  Variant B (thresh=0.10) + flatness (WNS):")
for name, rows in [("BREJCHA", brejcha), ("MINIMAL", minimal)]:
    res = simulate(rows, variant="B_flat", crack_gate_threshold=0.10, flatness_source=get_flatness)
    killed = sum(1 for r in res if "KILLED" in r["status"])
    survives = sum(1 for r in res if "SURVIVES" in r["status"])
    print(f"    {name}: {len(res)} onsets → {survives} survive, {killed} killed")

# ─── 5. SUMMARY TABLE ───
print("\n" + "=" * 80)
print("5. SUMMARY: Onset survival by variant")
print("=" * 80)
print(f"  {'Variant':<25} {'BREJCHA (56 orig)':<25} {'MINIMAL':<20}")
print(f"  {'-'*25} {'-'*25} {'-'*20}")

variants = [
    ("current", {}, {}),
    ("A", {}, {}),
    ("B (0.10)", {"variant": "B", "crack_gate_threshold": 0.10}, {}),
    ("B (0.15)", {"variant": "B", "crack_gate_threshold": 0.15}, {}),
    ("A + flatness", {"variant": "A_flat", "flatness_source": get_flatness}, {}),
    ("B (0.10) + flat", {"variant": "B_flat", "crack_gate_threshold": 0.10, "flatness_source": get_flatness}, {}),
]

for vname, vparams, _ in variants:
    br = simulate(brejcha, **vparams)
    mn = simulate(minimal, **vparams)
    br_killed = sum(1 for r in br if "KILLED" in r["status"])
    mn_killed = sum(1 for r in mn if "KILLED" in r["status"])
    br_surv = len(br) - br_killed
    mn_surv = len(mn) - mn_killed
    print(f"  {vname:<25} {br_surv}/{len(br)} ({br_killed} killed)     {mn_surv}/{len(mn)} ({mn_killed} killed)")

# ─── 6. BREJCHA GHOST ONSET cFx HISTOGRAM ───
print("\n" + "=" * 80)
print("6. BREJCHA ghost-path onsets — cFx histogram (the smoking gun)")
print("=" * 80)
bins = [0, 0.02, 0.05, 0.08, 0.10, 0.15, 0.20, 0.30, 0.50, 1.0]
for i in range(len(bins)-1):
    lo, hi = bins[i], bins[i+1]
    count = sum(1 for r in brejcha_ghost if lo <= r["cFx"] < hi)
    suspicious_count = sum(1 for r in suspicious if lo <= r["cFx"] < hi)
    bar = "#" * count
    print(f"  cFx [{lo:.2f}, {hi:.2f}) : {count:3d} onsets ({suspicious_count} suspicious) {bar}")

print("\n  MINIMAL ghost-path onsets — cFx histogram:")
if minimal_ghost:
    for i in range(len(bins)-1):
        lo, hi = bins[i], bins[i+1]
        count = sum(1 for r in minimal_ghost if lo <= r["cFx"] < hi)
        bar = "#" * count
        print(f"  cFx [{lo:.2f}, {hi:.2f}) : {count:3d} onsets {bar}")
else:
    print("  (no ghost-path onsets in Minimal)")
