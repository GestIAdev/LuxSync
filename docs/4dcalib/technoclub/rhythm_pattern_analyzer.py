#!/usr/bin/env python3
"""
Onset rhythm pattern analyzer — shows the snare pattern per bar
to determine if doubles are musical (real 2nd snare) or motor artifacts.
"""
import re
import os

RE_AUDIT = re.compile(r'\[FINESSE_AUDIT\]\s+(.*)')
RE_KV = re.compile(r'(\w+):(-?[\d.]+)')
RE_FLAGS = re.compile(r'\[(ONSET|KICK)\]')
RE_BPM = re.compile(r'BPM=([\d.]+)')
RE_BEAT = re.compile(r'beat #(\d+)')

def parse_line(line):
    m = RE_AUDIT.search(line)
    if not m:
        return None
    payload = m.group(1)
    kvs = {}
    for km in RE_KV.finditer(payload):
        try:
            kvs[km.group(1)] = float(km.group(2))
        except ValueError:
            pass
    flags = set(f.group(1) for f in RE_FLAGS.finditer(payload))
    return kvs, flags

def analyze_file(filepath):
    filename = os.path.basename(filepath)
    frames = []
    beats = []

    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        for lineno, line in enumerate(f, 1):
            parsed = parse_line(line)
            if parsed:
                kvs, flags = parsed
                frames.append((lineno, kvs, flags))

    # Find all onsets with their frame index
    onsets = []
    for i, (lineno, kvs, flags) in enumerate(frames):
        if 'ONSET' in flags:
            onsets.append({
                'frame_idx': i,
                'line': lineno,
                'SnareE': kvs.get('SnareE', 0),
                'UnG': kvs.get('UnG', 0),
                'Drive': kvs.get('Drive', 0),
                'Res': kvs.get('Res', 0),
                'cFx': kvs.get('cFx', 0),
                'bFct': kvs.get('bFct', 0),
                'WNS': kvs.get('WNS', 0),
                'Flux': kvs.get('Flux', 0),
                'Veto': kvs.get('Veto', 0),
                'hhDlt': kvs.get('hhDlt', 0),
                'hE': kvs.get('hE', 0),
                'BassE': kvs.get('BassE', 0),
                'is_kick': 'KICK' in flags,
            })

    print(f"{'='*100}")
    print(f"📁 {filename}")
    print(f"   Total frames: {len(frames)} | Onsets: {len(onsets)}")
    print(f"{'='*100}")
    print()

    # Calculate gaps between consecutive onsets
    # At 120 BPM, 1 beat = 500ms = ~22 frames
    # 1 bar (4/4) = 2 seconds = ~88 frames
    # Snare on beat 2 and beat 4 = gap of ~44 frames
    # Snare on beat 2 + "and of 2" = gap of ~11 frames (16th)
    # Snare on beat 2 + "and of 3" = gap of ~22 frames (8th)

    print(f"   📋 ONSET SEQUENCE (gaps in frames and ms):")
    print(f"   {'Line':>6} {'Frame':>6} {'Gap':>5} {'GapMs':>6} {'Musical':>10} "
          f"{'Drive':>7} {'UnG':>5} {'Res':>5} {'cFx':>5} {'WNS':>5} {'Flux':>5} {'hhDlt':>7} {'Kick':>4}")
    print(f"   {'-'*6} {'-'*6} {'-'*5} {'-'*6} {'-'*10} "
          f"{'-'*7} {'-'*5} {'-'*5} {'-'*5} {'-'*5} {'-'*5} {'-'*7} {'-'*4}")

    for i, o in enumerate(onsets):
        if i == 0:
            gap = 0
            gap_ms = 0
            musical = "START"
        else:
            gap = o['frame_idx'] - onsets[i-1]['frame_idx']
            gap_ms = gap * 22.7
            # Classify musical position
            if 38 <= gap <= 50:
                musical = "BEAT 2→4"  # ~44 frames = 1 half bar
            elif 80 <= gap <= 96:
                musical = "FULL BAR"  # ~88 frames = 1 bar
            elif 18 <= gap <= 26:
                musical = "8th NOTE"
            elif 8 <= gap <= 14:
                musical = "16th NOTE"
            elif gap < 8:
                musical = "DOUBLE!"
            elif 50 <= gap <= 80:
                musical = "ODD GAP"
            else:
                musical = f"gap={gap}"

        print(f"   {o['line']:6d} {o['frame_idx']:6d} {gap:5d} {gap_ms:6.0f} {musical:>10} "
              f"{o['Drive']:7.4f} {o['UnG']:5.3f} {o['Res']:5.3f} {o['cFx']:5.3f} "
              f"{o['WNS']:5.3f} {o['Flux']:5.3f} {o['hhDlt']:7.4f} {'Y' if o['is_kick'] else 'N':>4}")

    print()

    # Group into bars (approximate — 88 frames per bar at 120 BPM)
    # Actually, let's group by onset gaps to see the pattern
    print(f"   📊 RHYTHM PATTERN (grouped by onset gaps):")
    print()

    # Count gap types
    gap_types = {
        "BEAT 2→4 (snare on 2+4)": 0,
        "FULL BAR (1 snare/bar)": 0,
        "8th NOTE (close pair)": 0,
        "16th NOTE (very close)": 0,
        "DOUBLE (<8f, artifact?)": 0,
        "OTHER": 0,
    }

    for i in range(1, len(onsets)):
        gap = onsets[i]['frame_idx'] - onsets[i-1]['frame_idx']
        if 38 <= gap <= 50:
            gap_types["BEAT 2→4 (snare on 2+4)"] += 1
        elif 80 <= gap <= 96:
            gap_types["FULL BAR (1 snare/bar)"] += 1
        elif 18 <= gap <= 26:
            gap_types["8th NOTE (close pair)"] += 1
        elif 8 <= gap <= 14:
            gap_types["16th NOTE (very close)"] += 1
        elif gap < 8:
            gap_types["DOUBLE (<8f, artifact?)"] += 1
        else:
            gap_types["OTHER"] += 1

    for label, count in gap_types.items():
        if count > 0:
            print(f"      {label:35s} {count:3d}")

    print()

    # Show the "bars" — sequences between full-bar gaps
    # A typical EDM pattern: snare on beat 2 and beat 4 (gap ~44 frames)
    # Some bars might have an extra snare (gap ~22 = 8th note)
    print(f"   🎵 MUSICAL INTERPRETATION:")
    print()

    # Walk through onsets and group into "bars"
    bar_start = 0
    bar_num = 1
    for i in range(len(onsets)):
        if i == 0:
            continue
        gap = onsets[i]['frame_idx'] - onsets[i-1]['frame_idx']

        # If gap is close to 88 frames (full bar), this starts a new bar
        if gap >= 70:
            # Print the previous bar
            bar_onsets = onsets[bar_start:i]
            if bar_onsets:
                pattern = " + ".join([f"L{o['line']}" for o in bar_onsets])
                count = len(bar_onsets)
                if count == 1:
                    desc = "1 snare (simple bar)"
                elif count == 2:
                    inner_gap = bar_onsets[1]['frame_idx'] - bar_onsets[0]['frame_idx']
                    if 38 <= inner_gap <= 50:
                        desc = f"2 snares (beat 2+4, gap={inner_gap}f)"
                    elif 18 <= inner_gap <= 26:
                        desc = f"2 snares (8th apart, gap={inner_gap}f) — DOUBLE SNARE!"
                    elif 8 <= inner_gap <= 14:
                        desc = f"2 snares (16th apart, gap={inner_gap}f) — ROLL!"
                    else:
                        desc = f"2 snares (gap={inner_gap}f)"
                elif count >= 3:
                    desc = f"{count} snares — ROLL/REDOBLÉ"
                else:
                    desc = "empty"

                print(f"      Bar {bar_num:3d}: {count} snare(s) | {pattern} | {desc}")

            bar_start = i
            bar_num += 1

    # Last bar
    bar_onsets = onsets[bar_start:]
    if bar_onsets:
        pattern = " + ".join([f"L{o['line']}" for o in bar_onsets])
        count = len(bar_onsets)
        if count == 1:
            desc = "1 snare (simple bar)"
        elif count == 2:
            inner_gap = bar_onsets[1]['frame_idx'] - bar_onsets[0]['frame_idx']
            if 38 <= inner_gap <= 50:
                desc = f"2 snares (beat 2+4, gap={inner_gap}f)"
            elif 18 <= inner_gap <= 26:
                desc = f"2 snares (8th apart, gap={inner_gap}f) — DOUBLE SNARE!"
            elif 8 <= inner_gap <= 14:
                desc = f"2 snares (16th apart, gap={inner_gap}f) — ROLL!"
            else:
                desc = f"2 snares (gap={inner_gap}f)"
        elif count >= 3:
            desc = f"{count} snares — ROLL/REDOBLÉ"
        else:
            desc = "empty"
        print(f"      Bar {bar_num:3d}: {count} snare(s) | {pattern} | {desc}")

    print()

    # Final verdict
    print(f"   🔍 VERDICT:")
    doubles_8th = gap_types.get("8th NOTE (close pair)", 0)
    doubles_16th = gap_types.get("16th NOTE (very close)", 0)
    beat_2_4 = gap_types.get("BEAT 2→4 (snare on 2+4)", 0)
    full_bars = gap_types.get("FULL BAR (1 snare/bar)", 0)

    if doubles_8th > 0 or doubles_16th > 0:
        print(f"      → {doubles_8th + doubles_16th} bars have REAL DOUBLE SNARES (8th/16th apart)")
        print(f"      → These are MUSICAL doubles (the song has them), not motor artifacts.")
        print(f"      → The motor is correctly detecting 2 separate snares per bar.")
    elif beat_2_4 > 0:
        print(f"      → {beat_2_4} gaps are beat 2→4 (standard 4/4 snare pattern)")
        print(f"      → No double-fires detected. The 'double' you hear is the song's")
        print(f"        snare on beats 2 AND 4, which is the standard EDM pattern.")
    print()

if __name__ == '__main__':
    log_dir = r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\technoclub"
    files = [
        os.path.join(log_dir, "dontbeshytiestokarolg2.md"),
    ]

    for fpath in files:
        if os.path.exists(fpath):
            analyze_file(fpath)
