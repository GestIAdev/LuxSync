#!/usr/bin/env python3
"""
Rhythm Gate simulation — WAVE 7749.86.
Parse TitanOrchestrator beat markers, interpolate musical phase per frame,
apply rhythmMultiplier to ghost-path onsets.
"""
import re, statistics, math
from pathlib import Path

PAT_AUDIT = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+Raw\u0394:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+Bass\u0394:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)(?P<flags>.*)"
)

PAT_BEAT = re.compile(
    r"BPM=(?P<bpm>[\d.]+).*PLL=(?P<pll>\w+).*phase=(?P<phase>[\d.]+).*beat\s+#(?P<beat>\d+)"
)

def parse_log_with_beats(path):
    """Parse log, interleaving beat markers with FINESSE_AUDIT frames.
    Each frame gets a sequential index. Beat markers update the running
    beat/phase state. Between beats, we interpolate phase assuming ~44fps
    and the BPM at the last beat marker."""
    text = Path(path).read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()

    frames = []
    beat_markers = []  # (frame_idx, bpm, phase, beat_num, pll_locked)

    current_bpm = 120.0
    current_phase = 0.0
    current_beat = 0
    pll_locked = False

    frame_idx = 0
    for line in lines:
        if "[FINESSE_AUDIT]" in line:
            m = PAT_AUDIT.search(line)
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
            d["frame_idx"] = frame_idx
            d["bpm"] = current_bpm
            d["beat_num"] = current_beat
            d["pll_locked"] = pll_locked
            # Interpolate phase: advance by 1/fps_per_beat per frame
            # beat_duration_frames = 60/bpm * 44 (approx fps)
            beat_dur_frames = 60.0 / current_bpm * 44.0
            # We'll store the phase at the last beat marker and advance
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

    # Now interpolate phase for each frame
    # We know beat markers at specific frame indices with known phase.
    # Between markers, phase advances linearly at rate = 44fps / (60/bpm * 44) = bpm/60 per frame
    # phase wraps [0, 1) per beat
    for i, f in enumerate(frames):
        # Find the last beat marker at or before frame i
        last_marker = None
        next_marker = None
        for bm in beat_markers:
            if bm[0] <= i:
                last_marker = bm
            elif bm[0] > i and next_marker is None:
                next_marker = bm

        if last_marker:
            bpm_at = last_marker[1]
            phase_at = last_marker[2]
            beat_at = last_marker[3]
            frames_since = i - last_marker[0]
            beat_dur_frames = 60.0 / bpm_at * 44.0
            phase_advance = frames_since / beat_dur_frames
            f["interp_phase"] = (phase_at + phase_advance) % 1.0
            f["interp_beat"] = beat_at + int((phase_at + phase_advance) // 1.0)
            f["bar_position"] = (f["interp_beat"] % 4) + f["interp_phase"]
            # bar_position: 0.0 = beat 1 start, 1.0 = beat 2 start, 2.0 = beat 3, 3.0 = beat 4
            f["beat_in_bar"] = f["interp_beat"] % 4  # 0=beat1, 1=beat2, 2=beat3, 3=beat4
        else:
            f["interp_phase"] = 0.0
            f["interp_beat"] = 0
            f["bar_position"] = 0.0
            f["beat_in_bar"] = 0

    return frames, beat_markers

# ─── Rhythm Gate logic ───
def rhythm_multiplier(frame, window_frames=3, backbeat_mult=1.0, offbeat_mult=0.10):
    """Compute rhythm multiplier based on bar position.
    Backbeats = beats 2 and 4 (beat_in_bar = 1 and 3).
    Window = ±N frames around the exact beat boundary.
    """
    if not frame.get("pll_locked", False):
        return 1.0  # No PLL lock = no rhythm gate

    beat_in_bar = frame["beat_in_bar"]
    phase = frame["interp_phase"]

    # Distance to nearest backbeat boundary (beat 2 = bar_pos 1.0, beat 4 = bar_pos 3.0)
    # bar_position = beat_in_bar + phase
    bar_pos = beat_in_bar + phase

    # Backbeat positions in the bar: 1.0 (beat 2) and 3.0 (beat 4)
    # Also consider 0.0 (beat 1, downbeat) and 2.0 (beat 3) as "on-beat" but not backbeat
    distances_to_backbeat = []
    for bb in [1.0, 3.0]:
        d = abs(bar_pos - bb)
        if d > 2.0:
            d = 4.0 - d  # wrap
        distances_to_backbeat.append(d)

    # Also distance to any on-beat (0, 1, 2, 3)
    distances_to_any_beat = []
    for ob in [0.0, 1.0, 2.0, 3.0]:
        d = abs(bar_pos - ob)
        if d > 2.0:
            d = 4.0 - d
        distances_to_any_beat.append(d)

    min_dist_backbeat = min(distances_to_backbeat)
    min_dist_any = min(distances_to_any_beat)

    # Convert distance in bar fractions to frames
    # 1 bar = 4 beats = 4 * beat_dur_frames
    bpm = frame.get("bpm", 120)
    beat_dur_frames = 60.0 / bpm * 44.0
    bar_dur_frames = 4 * beat_dur_frames
    dist_in_frames = min_dist_backbeat * bar_dur_frames / 4.0  # dist is in beats

    if dist_in_frames <= window_frames:
        return backbeat_mult  # On backbeat
    elif min_dist_any * beat_dur_frames <= window_frames:
        return 0.30  # On-beat but not backbeat (beat 1 or 3) — mild suppression
    else:
        return offbeat_mult  # Off-beat (corcheas intermedias) — severe suppression

# ─── Main ───
BREJCHA = r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\gravitycalib5.md"
MINIMAL = r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\minimalcalib5.md"

print("=" * 80)
print("RHYTHM GATE SIMULATION — WAVE 7749.86")
print("=" * 80)

for track_name, track_path in [("BREJCHA", BREJCHA), ("MINIMAL", MINIMAL)]:
    frames, beat_markers = parse_log_with_beats(track_path)
    onsets = [f for f in frames if f["ONSET"]]

    print(f"\n{'=' * 80}")
    print(f"TRACK: {track_name}")
    print(f"{'=' * 80}")
    print(f"  Frames: {len(frames)}, Onsets: {len(onsets)}")
    print(f"  Beat markers: {len(beat_markers)}")
    if beat_markers:
        print(f"  First beat: bpm={beat_markers[0][1]}, beat#{beat_markers[0][3]}, pll={'LOCKED' if beat_markers[0][4] else 'FREE'}")
        print(f"  Last beat:  bpm={beat_markers[-1][1]}, beat#{beat_markers[-1][3]}, pll={'LOCKED' if beat_markers[-1][4] else 'FREE'}")

    # Classify onsets
    print(f"\n  ONSET RHYTHM ANALYSIS:")
    print(f"  {'#':>3} {'frame':>5} {'SnareE':>7} {'ghst':>7} {'Drive':>7} {'bar_pos':>8} {'beat_in_bar':>12} {'rMult':>6} {'path':>6} {'verdict':>10}")

    ghost_survivors = 0
    ghost_killed = 0
    crack_survivors = 0

    for i, f in enumerate(onsets):
        crackDrive = f["Res"] * f["cFx"] * f["bFct"] * f["sEF"]
        originalGhost = f["ghst"]
        is_ghost = originalGhost > crackDrive

        rMult = rhythm_multiplier(f, window_frames=3)
        newGhost = originalGhost * rMult
        newDrive = max(crackDrive, newGhost)

        bar_pos = f["beat_in_bar"] + f["interp_phase"]
        beat_label = f["beat_in_bar"] + 1  # 1-indexed

        if is_ghost:
            if newGhost < f["Drive"] * 0.3:
                verdict = "KILLED"
                ghost_killed += 1
            elif newGhost < f["Drive"] * 0.7:
                verdict = "WEAKENED"
                ghost_survivors += 1
            else:
                verdict = "SURVIVES"
                ghost_survivors += 1
            path = "GHOST"
        else:
            verdict = "SURVIVES"
            crack_survivors += 1
            path = "CRACK"

        # Only print first 30 and suspicious ones
        if i < 30 or (is_ghost and f["SnareE"] < 0.05 and not f["KICK"]):
            print(f"  {i+1:>3} {f['frame_idx']:>5} {f['SnareE']:>7.3f} {f['ghst']:>7.4f} {f['Drive']:>7.3f} {bar_pos:>8.3f} {beat_label:>12} {rMult:>6.2f} {path:>6} {verdict:>10}")

    print(f"\n  SUMMARY:")
    print(f"    Crack-path onsets (untouched): {crack_survivors}")
    print(f"    Ghost-path onsets surviving:   {ghost_survivors}")
    print(f"    Ghost-path onsets killed:      {ghost_killed}")
    print(f"    Total surviving:               {crack_survivors + ghost_survivors}")

    # Bar position histogram for ghost onsets
    ghost_onsets = [f for f in onsets if f["ghst"] > f["Res"] * f["cFx"] * f["bFct"] * f["sEF"]]
    if ghost_onsets:
        print(f"\n  GHOST ONSET BAR POSITION DISTRIBUTION:")
        print(f"  (0.0=beat1, 1.0=beat2, 2.0=beat3, 3.0=beat4)")
        bins = [0, 0.125, 0.375, 0.625, 0.875, 1.125, 1.375, 1.625, 1.875, 2.125, 2.375, 2.625, 2.875, 3.125, 3.375, 3.625, 3.875, 4.0]
        labels = ["1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "1.0"]
        for i in range(len(bins)-1):
            lo, hi = bins[i], bins[i+1]
            count = sum(1 for f in ghost_onsets if lo <= (f["beat_in_bar"] + f["interp_phase"]) < hi)
            if count > 0:
                bar = "#" * count
                beat_pos = lo
                is_backbeat = (0.875 <= lo <= 1.125) or (2.875 <= lo <= 3.125)
                marker = " <== BACKBEAT" if is_backbeat else ""
                print(f"    bar_pos [{lo:.3f}, {hi:.3f}) : {count:2d} {bar}{marker}")

# ─── Sweep window sizes ───
print(f"\n{'=' * 80}")
print(f"WINDOW SIZE SWEEP (backbeat tolerance)")
print(f"{'=' * 80}")
print(f"  {'window':>7} {'BREJCHA':>20} {'MINIMAL':>20}")
for window in [1, 2, 3, 4, 5, 6]:
    for track_name, track_path in [("BREJCHA", BREJCHA), ("MINIMAL", MINIMAL)]:
        frames, _ = parse_log_with_beats(track_path)
        onsets = [f for f in frames if f["ONSET"]]
        ghost_surv = 0
        ghost_kill = 0
        crack_surv = 0
        for f in onsets:
            crackDrive = f["Res"] * f["cFx"] * f["bFct"] * f["sEF"]
            is_ghost = f["ghst"] > crackDrive
            rMult = rhythm_multiplier(f, window_frames=window)
            newGhost = f["ghst"] * rMult
            if is_ghost:
                if newGhost < f["Drive"] * 0.3:
                    ghost_kill += 1
                else:
                    ghost_surv += 1
            else:
                crack_surv += 1
        total_surv = ghost_surv + crack_surv
        if track_name == "BREJCHA":
            br_str = f"{total_surv}/{len(onsets)} ({ghost_kill} killed)"
        else:
            mn_str = f"{total_surv}/{len(onsets)} ({ghost_kill} killed)"
    print(f"  {window:>5}fr {br_str:>20} {mn_str:>20}")
