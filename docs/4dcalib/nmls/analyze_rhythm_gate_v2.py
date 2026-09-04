#!/usr/bin/env python3
"""
Rhythm Gate v2 — SOLO aplica cuando gateHealth es bajo (gate muerto).
Cuando gateHealth=1 (Minimal, gate vivo), no filtrar.
Cuando gateHealth=0 (Brejcha breakdown, gate muerto), aplicar filtro rítmico.
"""
import re, statistics
from pathlib import Path

PAT_AUDIT = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+Raw\u0394:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+Bass\u0394:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)(?P<flags>.*)"
)
PAT_BEAT = re.compile(r"BPM=(?P<bpm>[\d.]+).*PLL=(?P<pll>\w+).*phase=(?P<phase>[\d.]+).*beat\s+#(?P<beat>\d+)")

def parse_log(path):
    text = Path(path).read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    frames = []
    beat_markers = []
    current_bpm, current_phase, current_beat, pll_locked = 120.0, 0.0, 0, False
    frame_idx = 0
    for line in lines:
        if "[FINESSE_AUDIT]" in line:
            m = PAT_AUDIT.search(line)
            if not m: continue
            d = m.groupdict()
            for k in d:
                if k == "flags": continue
                try: d[k] = float(d[k])
                except: d[k] = 0.0
            d["ONSET"] = "[ONSET]" in d["flags"]
            d["KICK"] = "[KICK]" in d["flags"]
            d["frame_idx"] = frame_idx
            d["bpm"] = current_bpm
            d["beat_num"] = current_beat
            d["pll_locked"] = pll_locked
            frames.append(d)
            frame_idx += 1
        elif "[TitanOrchestrator]" in line:
            m = PAT_BEAT.search(line)
            if m:
                current_bpm = float(m.group("bpm"))
                current_phase = float(m.group("phase"))
                current_beat = int(m.group("beat"))
                pll_locked = "LOCKED" in m.group("pll")
                beat_markers.append((frame_idx, current_bpm, current_phase, current_beat, pll_locked))
    # Interpolate phase
    for i, f in enumerate(frames):
        last_marker = None
        for bm in beat_markers:
            if bm[0] <= i: last_marker = bm
            else: break
        if last_marker:
            bpm_at = last_marker[1]
            phase_at = last_marker[2]
            beat_at = last_marker[3]
            frames_since = i - last_marker[0]
            beat_dur_frames = 60.0 / bpm_at * 44.0
            phase_advance = frames_since / beat_dur_frames
            f["interp_phase"] = (phase_at + phase_advance) % 1.0
            f["interp_beat"] = beat_at + int((phase_at + phase_advance) // 1.0)
            f["beat_in_bar"] = f["interp_beat"] % 4
        else:
            f["interp_phase"] = 0.0
            f["interp_beat"] = 0
            f["beat_in_bar"] = 0
    return frames, beat_markers

def rhythm_mult(f, window=3):
    if not f.get("pll_locked"): return 1.0
    bar_pos = f["beat_in_bar"] + f["interp_phase"]
    bpm = f.get("bpm", 120)
    beat_dur_frames = 60.0 / bpm * 44.0
    # Distance to backbeat (beat 2 = 1.0, beat 4 = 3.0)
    min_dist_bb = min(abs(bar_pos - bb) if abs(bar_pos - bb) <= 2 else 4 - abs(bar_pos - bb) for bb in [1.0, 3.0])
    # Distance to any beat (0, 1, 2, 3)
    min_dist_any = min(abs(bar_pos - ob) if abs(bar_pos - ob) <= 2 else 4 - abs(bar_pos - ob) for ob in [0.0, 1.0, 2.0, 3.0])
    dist_frames_bb = min_dist_bb * beat_dur_frames
    dist_frames_any = min_dist_any * beat_dur_frames
    if dist_frames_bb <= window: return 1.0
    elif dist_frames_any <= window: return 0.30
    else: return 0.10

BREJCHA = r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\gravitycalib5.md"
MINIMAL = r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\minimalcalib5.md"

print("=" * 80)
print("RHYTHM GATE v2: gateHealth-gated rhythm filter")
print("  rhythmMultiplier = lerp(1.0, rhythmMult(f), 1.0 - gateHealth)")
print("  When gateHealth=1 (alive): no rhythm filter (trust SnareE)")
print("  When gateHealth=0 (dead):  full rhythm filter (trust PLL)")
print("=" * 80)

for track_name, track_path in [("BREJCHA", BREJCHA), ("MINIMAL", MINIMAL)]:
    frames, _ = parse_log(track_path)
    onsets = [f for f in frames if f["ONSET"]]

    print(f"\n{'=' * 80}")
    print(f"TRACK: {track_name} — {len(onsets)} onsets")
    print(f"{'=' * 80}")

    # gH distribution at onsets
    gH_vals = [f["gH"] for f in onsets]
    print(f"  gH at onsets: min={min(gH_vals):.3f} max={max(gH_vals):.3f} mean={statistics.mean(gH_vals):.3f}")
    print(f"  gH > 0.8 (gate alive):    {sum(1 for v in gH_vals if v > 0.8)}/{len(onsets)}")
    print(f"  gH 0.3-0.8 (transition):  {sum(1 for v in gH_vals if 0.3 <= v <= 0.8)}/{len(onsets)}")
    print(f"  gH < 0.3 (gate dead):     {sum(1 for v in gH_vals if v < 0.3)}/{len(onsets)}")

    # v1: unconditional rhythm gate
    v1_surv = 0; v1_kill = 0
    # v2: gateHealth-gated rhythm filter
    v2_surv = 0; v2_kill = 0
    # v2 details
    v2_details = []

    for f in onsets:
        crackDrive = f["Res"] * f["cFx"] * f["bFct"] * f["sEF"]
        is_ghost = f["ghst"] > crackDrive
        rMult_raw = rhythm_mult(f, window=3)

        # v1: unconditional
        newGhost_v1 = f["ghst"] * rMult_raw if is_ghost else f["ghst"]
        if is_ghost and newGhost_v1 < f["Drive"] * 0.3:
            v1_kill += 1
        else:
            v1_surv += 1

        # v2: gateHealth-gated
        # effective rhythm multiplier = lerp(1.0, rMult_raw, 1.0 - gH)
        gH = f["gH"]
        rMult_v2 = 1.0 * gH + rMult_raw * (1.0 - gH)
        newGhost_v2 = f["ghst"] * rMult_v2 if is_ghost else f["ghst"]
        if is_ghost and newGhost_v2 < f["Drive"] * 0.3:
            v2_kill += 1
            v2_details.append((f, "KILLED", rMult_raw, rMult_v2, newGhost_v2))
        else:
            v2_surv += 1
            if is_ghost:
                v2_details.append((f, "SURVIVES", rMult_raw, rMult_v2, newGhost_v2))

    print(f"\n  v1 (unconditional rhythm gate):  {v1_surv}/{len(onsets)} survive ({v1_kill} killed)")
    print(f"  v2 (gateHealth-gated rhythm):    {v2_surv}/{len(onsets)} survive ({v2_kill} killed)")

    # Show v2 details for ghost-path onsets
    print(f"\n  v2 GHOST-PATH ONSET DETAILS:")
    print(f"  {'#':>3} {'frame':>5} {'SnareE':>7} {'gH':>5} {'bar_pos':>8} {'beat':>5} {'rMult_raw':>10} {'rMult_v2':>9} {'ghst_new':>9} {'verdict':>10}")
    ghost_details = [d for d in v2_details if d[1] in ("KILLED", "SURVIVES")]
    for i, (f, verdict, rm_raw, rm_v2, ng) in enumerate(ghost_details):
        bar_pos = f["beat_in_bar"] + f["interp_phase"]
        beat_label = f["beat_in_bar"] + 1
        # Only show first 20 + all killed
        if i < 20 or verdict == "KILLED":
            print(f"  {i+1:>3} {f['frame_idx']:>5} {f['SnareE']:>7.3f} {f['gH']:>5.3f} {bar_pos:>8.3f} {beat_label:>5} {rm_raw:>10.2f} {rm_v2:>9.2f} {ng:>9.4f} {verdict:>10}")

# ─── Sweep: gateHealth threshold + window ───
print(f"\n{'=' * 80}")
print(f"SWEEP: gateHealth threshold below which rhythm gate activates")
print(f"  (rhythm filter only applies when gH < threshold)")
print(f"{'=' * 80}")
print(f"  {'gH_thresh':>10} {'window':>7} {'BREJCHA':>20} {'MINIMAL':>20}")

for gH_thresh in [1.0, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2]:
    for window in [3, 5]:
        results = {}
        for track_name, track_path in [("BREJCHA", BREJCHA), ("MINIMAL", MINIMAL)]:
            frames, _ = parse_log(track_path)
            onsets = [f for f in frames if f["ONSET"]]
            surv = 0; kill = 0
            for f in onsets:
                crackDrive = f["Res"] * f["cFx"] * f["bFct"] * f["sEF"]
                is_ghost = f["ghst"] > crackDrive
                rMult_raw = rhythm_mult(f, window=window)
                # Only apply rhythm filter when gH < threshold
                if f["gH"] < gH_thresh:
                    rMult_eff = rMult_raw
                else:
                    rMult_eff = 1.0
                newGhost = f["ghst"] * rMult_eff if is_ghost else f["ghst"]
                if is_ghost and newGhost < f["Drive"] * 0.3:
                    kill += 1
                else:
                    surv += 1
            results[track_name] = (surv, len(onsets), kill)
        br = results["BREJCHA"]
        mn = results["MINIMAL"]
        print(f"  {gH_thresh:>10.1f} {window:>5}fr {f'{br[0]}/{br[1]} ({br[2]} killed)':>20} {f'{mn[0]}/{mn[1]} ({mn[2]} killed)':>20}")

# ─── Continuous lerp version ───
print(f"\n{'=' * 80}")
print(f"CONTINUOUS LERP: rMult_eff = 1.0 * gH + rMult_raw * (1 - gH)")
print(f"{'=' * 80}")
print(f"  {'window':>7} {'BREJCHA':>20} {'MINIMAL':>20}")
for window in [3, 4, 5, 6]:
    results = {}
    for track_name, track_path in [("BREJCHA", BREJCHA), ("MINIMAL", MINIMAL)]:
        frames, _ = parse_log(track_path)
        onsets = [f for f in frames if f["ONSET"]]
        surv = 0; kill = 0
        for f in onsets:
            crackDrive = f["Res"] * f["cFx"] * f["bFct"] * f["sEF"]
            is_ghost = f["ghst"] > crackDrive
            rMult_raw = rhythm_mult(f, window=window)
            rMult_eff = 1.0 * f["gH"] + rMult_raw * (1.0 - f["gH"])
            newGhost = f["ghst"] * rMult_eff if is_ghost else f["ghst"]
            if is_ghost and newGhost < f["Drive"] * 0.3:
                kill += 1
            else:
                surv += 1
        results[track_name] = (surv, len(onsets), kill)
    br = results["BREJCHA"]
    mn = results["MINIMAL"]
    print(f"  {window:>5}fr {f'{br[0]}/{br[1]} ({br[2]} killed)':>20} {f'{mn[0]}/{mn[1]} ({mn[2]} killed)':>20}")
