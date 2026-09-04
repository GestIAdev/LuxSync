#!/usr/bin/env python3
"""Analyze gravitycalib5.md (Brejcha) — post WAVE 7749.85 metrics."""
import re, sys, statistics
from pathlib import Path

LOG = Path(r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\gravitycalib5.md")
text = LOG.read_text(encoding="utf-8", errors="replace")

# Parse all FINESSE_AUDIT lines
pat = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+RawΔ:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+BassΔ:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)(?P<flags>.*)"
)

rows = []
for line in text.splitlines():
    if "[FINESSE_AUDIT]" not in line:
        continue
    m = pat.search(line)
    if not m:
        continue
    d = m.groupdict()
    for k in d:
        try:
            d[k] = float(d[k]) if k != "flags" else d[k]
        except (ValueError, TypeError):
            pass
    d["ONSET"] = "[ONSET]" in d["flags"]
    d["KICK"] = "[KICK]" in d["flags"]
    rows.append(d)

print(f"Total FINESSE_AUDIT frames parsed: {len(rows)}")
print()

# ── 1. GHOST FEED VALIDATION ──
hhDlt = [r["hhDlt"] for r in rows]
ghst  = [r["ghst"]  for r in rows]
nonzero_hh = sum(1 for v in hhDlt if v > 0.0001)
nonzero_gh = sum(1 for v in ghst  if v > 0.0001)
print("═" * 70)
print("1. GHOST FEED (raw_hh_delta) — WAVE 7749.85 plumbing fix")
print("═" * 70)
print(f"  hhDlt > 0.0001 : {nonzero_hh}/{len(rows)} = {100*nonzero_hh/len(rows):.1f}%")
print(f"  ghst > 0.0001  : {nonzero_gh}/{len(rows)} = {100*nonzero_gh/len(rows):.1f}%")
print(f"  hhDlt mean     : {statistics.mean(hhDlt):.4f}")
print(f"  hhDlt max      : {max(hhDlt):.4f}")
print(f"  ghst  mean     : {statistics.mean(ghst):.4f}")
print(f"  ghst  max      : {max(ghst):.4f}")
print(f"  → ANTES (calib4): hhDlt=0.0000 en 100% frames. AHORA vivo.")
print()

# ── 2. GATE HEALTH TRAJECTORY ──
gH = [r["gH"] for r in rows]
print("═" * 70)
print("2. GATE HEALTH (gateHealth) — EMA trajectory")
print("═" * 70)
gH_start_str = ", ".join("%.3f" % v for v in gH[:10])
gH_end_str   = ", ".join("%.3f" % v for v in gH[-10:])
print(f"  gH start (first 10) : [{gH_start_str}]")
print(f"  gH peak             : {max(gH):.3f}  (frame {gH.index(max(gH))})")
print(f"  gH end   (last 10)  : [{gH_end_str}]")
print(f"  gH mean             : {statistics.mean(gH):.3f}")
print(f"  gH median           : {statistics.median(gH):.3f}")
# Phase split: first 30% vs last 30%
n = len(rows)
early = gH[:int(n*0.3)]
late  = gH[int(n*0.7):]
print(f"  gH early 30% mean   : {statistics.mean(early):.3f}")
print(f"  gH late  30% mean   : {statistics.mean(late):.3f}")
print(f"  → Esperado: empieza alto (SnareE sano), decae a ~0 (gate muere)")
print()

# ── 3. ONSET INVENTORY ──
onsets = [r for r in rows if r["ONSET"]]
kicks  = [r for r in rows if r["KICK"] and not r["ONSET"]]
print("═" * 70)
print("3. ONSET INVENTORY")
print("═" * 70)
print(f"  Total ONSETS  : {len(onsets)}")
print(f"  Total KICK-only frames: {len(kicks)}")
print()
print("  Onset details (frame# | SnareE | hhDlt | ghst | gH | Drive | path):")
for i, r in enumerate(onsets):
    idx = rows.index(r)
    # Determine path: crack vs ghost
    crackDrive = r["Res"] * r["cFx"] * r["bFct"] * r["sEF"]
    ghostDrive = r["ghst"]
    path = "GHOST" if ghostDrive > crackDrive else "CRACK"
    print(f"    #{i+1:2d} f={idx:3d} | SnareE={r['SnareE']:.3f} | hhDlt={r['hhDlt']:.4f} | ghst={r['ghst']:.4f} | gH={r['gH']:.3f} | Drive={r['Drive']:.3f} | {path} | {'[KICK]' if r['KICK'] else ''}")
print()

# ── 4. ONSET PATH BREAKDOWN (crack vs ghost) ──
print("═" * 70)
print("4. ONSET PATH BREAKDOWN (crack vs ghost rescue)")
print("═" * 70)
crack_onsets = 0
ghost_onsets = 0
for r in onsets:
    crackDrive = r["Res"] * r["cFx"] * r["bFct"] * r["sEF"]
    ghostDrive = r["ghst"]
    if ghostDrive > crackDrive:
        ghost_onsets += 1
    else:
        crack_onsets += 1
print(f"  Crack-path onsets  : {crack_onsets}  (SnareE alto, gate vivo)")
print(f"  Ghost-path onsets  : {ghost_onsets}  (SnareE≈0, rescued by treble)")
print()

# ── 5. SnareE DISTRIBUTION AT ONSETS ──
print("═" * 70)
print("5. SnareE AT ONSETS — gate viability check")
print("═" * 70)
snareE_onsets = [r["SnareE"] for r in onsets]
dead_gate = sum(1 for v in snareE_onsets if v < 0.05)
weak_gate = sum(1 for v in snareE_onsets if 0.05 <= v < 0.20)
alive     = sum(1 for v in snareE_onsets if v >= 0.20)
print(f"  SnareE < 0.05  (gate dead)    : {dead_gate}/{len(onsets)}")
print(f"  SnareE 0.05-0.20 (weak)       : {weak_gate}/{len(onsets)}")
print(f"  SnareE >= 0.20 (alive)        : {alive}/{len(onsets)}")
print()

# ── 6. FALSE POSITIVE HEURISTIC ──
# A "suspicious" onset: SnareE < 0.05 AND no [KICK] flag AND hhDlt is the main driver
print("═" * 70)
print("6. SUSPICIOUS ONSETS (potential FPs)")
print("═" * 70)
print("  Heuristic: SnareE < 0.05 AND NOT [KICK] AND ghost-path")
suspicious = []
for i, r in enumerate(onsets):
    crackDrive = r["Res"] * r["cFx"] * r["bFct"] * r["sEF"]
    is_ghost = r["ghst"] > crackDrive
    if r["SnareE"] < 0.05 and not r["KICK"] and is_ghost:
        idx = rows.index(r)
        suspicious.append((i+1, idx, r))
print(f"  Count: {len(suspicious)}")
for n, idx, r in suspicious:
    print(f"    #{n:2d} f={idx:3d} | SnareE={r['SnareE']:.3f} | UnG={r['UnG']:.3f} | Flux={r['Flux']:.3f} | hhDlt={r['hhDlt']:.4f} | ghst={r['ghst']:.4f} | gH={r['gH']:.3f} | Drive={r['Drive']:.3f}")
print()

# ── 7. COMPARISON vs CALIB4 (22 onsets) ──
print("═" * 70)
print("7. BREJCHA CALIB4 → CALIB5 COMPARISON")
print("═" * 70)
print(f"  Calib4 onsets : 22  (pre-fix, ghost dead, unconditional relaxation)")
print(f"  Calib5 onsets : {len(onsets)}  (post WAVE 7749.85)")
print(f"  Delta         : {len(onsets) - 22:+d}")
print()

# ── 8. sEF BEHAVIOR ──
print("═" * 70)
print("8. sEF BEHAVIOR — relaxation scaling check")
print("═" * 70)
sEF_onsets = [r["sEF"] for r in onsets]
sEF_all = [r["sEF"] for r in rows]
print(f"  sEF at onsets: min={min(sEF_onsets):.3f} max={max(sEF_onsets):.3f} mean={statistics.mean(sEF_onsets):.3f}")
print(f"  sEF all frames: mean={statistics.mean(sEF_all):.3f}")
# Check if sEF is tracking SnareE*2 (alive) or relaxation floor (dead)
relaxed_count = 0
strict_count = 0
for r in rows:
    strict = min(1.0, r["SnareE"] * 2.0)
    if r["sEF"] > strict + 0.01:
        relaxed_count += 1
    else:
        strict_count += 1
print(f"  Frames where sEF > strict(SnareE*2)+0.01 (relaxation active): {relaxed_count}/{len(rows)} = {100*relaxed_count/len(rows):.1f}%")
print()

# ── 9. GATE HEALTH vs SNAREE EMA ──
print("═" * 70)
print("9. GATE HEALTH vs SnareE — sanity check")
print("═" * 70)
# Reconstruct EMA
ema = 0.0
alpha = 0.01
ema_traj = []
for r in rows:
    ema += alpha * (r["SnareE"] - ema)
    ema_traj.append(ema)
print(f"  Reconstructed SnareE EMA: start={ema_traj[0]:.4f} end={ema_traj[-1]:.4f} min={min(ema_traj):.4f} max={max(ema_traj):.4f}")
print(f"  Expected gH = min(1, EMA/0.15): end={min(1.0, ema_traj[-1]/0.15):.3f}")
print(f"  Actual gH end: {gH[-1]:.3f}")
print()

# ── 10. TIMELINE: gH decay phases ──
print("═" * 70)
print("10. GATE HEALTH DECAY TIMELINE")
print("═" * 70)
milestones = [0.9, 0.7, 0.5, 0.3, 0.1]
for ms in milestones:
    for i, v in enumerate(gH):
        if v <= ms:
            print(f"  gH drops below {ms:.1f} at frame {i} (SnareE={rows[i]['SnareE']:.3f})")
            break
    else:
        print(f"  gH never drops below {ms:.1f}")
