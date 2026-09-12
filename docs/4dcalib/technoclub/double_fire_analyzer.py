#!/usr/bin/env python3
"""
Double-fire analyzer — finds snare onsets that fire too close together
and diagnoses whether they're real snares, hi-hat bleed, or reverb tails.
"""
import re
import sys
import os
from collections import defaultdict

RE_AUDIT = re.compile(r'\[FINESSE_AUDIT\]\s+(.*)')
RE_KV = re.compile(r'(\w+):(-?[\d.]+)')
RE_FLAGS = re.compile(r'\[(ONSET|KICK)\]')

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

    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        for lineno, line in enumerate(f, 1):
            parsed = parse_line(line)
            if parsed is None:
                continue
            kvs, flags = parsed
            frames.append((lineno, kvs, flags))

    # Find all onsets
    onsets = []
    for i, (lineno, kvs, flags) in enumerate(frames):
        if 'ONSET' in flags:
            onsets.append({
                'index': i,
                'line': lineno,
                'SnareE': kvs.get('SnareE', 0),
                'UnG': kvs.get('UnG', 0),
                'RawΔ': kvs.get('RawΔ', 0),
                'Flux': kvs.get('Flux', 0),
                'WNS': kvs.get('WNS', 0),
                'Veto': kvs.get('Veto', 0),
                'Res': kvs.get('Res', 0),
                'cFx': kvs.get('cFx', 0),
                'bFct': kvs.get('bFct', 0),
                'sEF': kvs.get('sEF', 0),
                'Drive': kvs.get('Drive', 0),
                'fFloor': kvs.get('fFloor', 0),
                'dynTh': kvs.get('dynTh', 0),
                'hhDlt': kvs.get('hhDlt', 0),
                'ghst': kvs.get('ghst', 0),
                'gH': kvs.get('gH', 0),
                'hE': kvs.get('hE', 0),
                'BassE': kvs.get('BassE', 0),
                'is_kick': 'KICK' in flags,
            })

    # Find double-fires (onsets within 8 frames of each other)
    doubles = []
    for i in range(1, len(onsets)):
        gap = onsets[i]['index'] - onsets[i-1]['index']
        if gap <= 8:
            doubles.append({
                'gap_frames': gap,
                'gap_ms': gap * 22.7,  # ~44fps
                'prev': onsets[i-1],
                'curr': onsets[i],
            })

    # Also find "echo" patterns: onset followed by high OutSnare (>0.5) within 2-4 frames
    # but no ONSET flag — these are the decay tail, not doubles
    echo_frames = []
    for i, (lineno, kvs, flags) in enumerate(frames):
        if 'ONSET' in flags:
            # Check next 6 frames for high OutSnare without ONSET
            for j in range(1, min(7, len(frames) - i)):
                _, next_kvs, next_flags = frames[i + j]
                out_snare = next_kvs.get('OutSnare', 0)
                if out_snare > 0.5 and 'ONSET' not in next_flags:
                    echo_frames.append({
                        'onset_line': lineno,
                        'echo_line': frames[i+j][0],
                        'echo_frame': j,
                        'OutSnare': out_snare,
                        'gRefr': int(next_kvs.get('gRefr', 0)),
                        'Drive': next_kvs.get('Drive', 0),
                        'hhDlt': next_kvs.get('hhDlt', 0),
                    })

    # Classify each double-fire
    print(f"{'='*100}")
    print(f"📁 {filename}")
    print(f"   Total frames: {len(frames)}")
    print(f"   Total onsets: {len(onsets)}")
    print(f"   Double-fires (gap ≤8 frames): {len(doubles)}")
    print(f"{'='*100}")
    print()

    if not doubles:
        print("   No double-fires detected.")
        print()

        # Still show echo analysis
        if echo_frames:
            print(f"   📊 DECAY ECHO ANALYSIS (high OutSnare post-onset, no ONSET flag):")
            print(f"   These are NOT double-fires — they're the envelope decay tail.")
            print(f"   Total echo frames: {len(echo_frames)}")
            for e in echo_frames[:10]:
                print(f"      Onset L{e['onset_line']:5d} → Echo L{e['echo_line']:5d} "
                      f"(+{e['echo_frame']}f) OutSnare={e['OutSnare']:.3f} "
                      f"gRefr={e['gRefr']} Drive={e['Drive']:.4f} hhDlt={e['hhDlt']:.4f}")
            print()
        return

    # Classify doubles
    print(f"   🔥 DOUBLE-FIRE ANALYSIS:")
    print()

    for d in doubles:
        prev = d['prev']
        curr = d['curr']
        gap = d['gap_frames']

        # Classify the second hit
        if curr['hhDlt'] > 0.3 and curr['Drive'] < prev['Drive'] * 0.5:
            cause = "REVERB_TAIL"
            confidence = "HIGH"
        elif curr['hE'] > 0.5 and curr['SnareE'] < 0.2:
            cause = "HIHAT_BLEED"
            confidence = "MEDIUM"
        elif curr['Drive'] > 0.05 and curr['UnG'] > 0.5:
            cause = "REAL_SNARE"
            confidence = "HIGH"
        elif curr['ghst'] > 0.05:
            cause = "GHOST_RESCUE"
            confidence = "MEDIUM"
        elif curr['WNS'] > 0.3 and curr['Flux'] > 0.1:
            cause = "REAL_SNARE"
            confidence = "HIGH"
        else:
            cause = "UNKNOWN"
            confidence = "LOW"

        print(f"   ┌─ Double-fire @ gap={gap} frames ({d['gap_ms']:.0f}ms)")
        print(f"   │  PREV L{prev['line']:5d}: Drive={prev['Drive']:.4f} UnG={prev['UnG']:.3f} "
              f"Res={prev['Res']:.3f} cFx={prev['cFx']:.3f} bFct={prev['bFct']:.3f} "
              f"hhDlt={prev['hhDlt']:.4f} {'[KICK]' if prev['is_kick'] else ''}")
        print(f"   │  CURR L{curr['line']:5d}: Drive={curr['Drive']:.4f} UnG={curr['UnG']:.3f} "
              f"Res={curr['Res']:.3f} cFx={curr['cFx']:.3f} bFct={curr['bFct']:.3f} "
              f"hhDlt={curr['hhDlt']:.4f} WNS={curr['WNS']:.3f} Flux={curr['Flux']:.3f} "
              f"ghst={curr['ghst']:.4f} {'[KICK]' if curr['is_kick'] else ''}")
        print(f"   └─ → {cause} (confidence: {confidence})")
        print()

    # Summary
    cause_counts = defaultdict(int)
    for d in doubles:
        prev = d['prev']
        curr = d['curr']
        if curr['hhDlt'] > 0.3 and curr['Drive'] < prev['Drive'] * 0.5:
            cause_counts["REVERB_TAIL"] += 1
        elif curr['hE'] > 0.5 and curr['SnareE'] < 0.2:
            cause_counts["HIHAT_BLEED"] += 1
        elif curr['Drive'] > 0.05 and curr['UnG'] > 0.5:
            cause_counts["REAL_SNARE"] += 1
        elif curr['ghst'] > 0.05:
            cause_counts["GHOST_RESCUE"] += 1
        elif curr['WNS'] > 0.3 and curr['Flux'] > 0.1:
            cause_counts["REAL_SNARE"] += 1
        else:
            cause_counts["UNKNOWN"] += 1

    print(f"   📊 DOUBLE-FIRE CAUSE DISTRIBUTION:")
    for cause, count in sorted(cause_counts.items(), key=lambda x: -x[1]):
        print(f"      {cause:20s} {count:3d}")
    print()

    # Gap distribution
    gap_counts = defaultdict(int)
    for d in doubles:
        gap_counts[d['gap_frames']] += 1
    print(f"   📏 GAP DISTRIBUTION (frames between onsets):")
    for gap in sorted(gap_counts.keys()):
        print(f"      {gap} frames ({gap*22.7:.0f}ms): {gap_counts[gap]:3d} doubles")
    print()

    # Echo analysis
    if echo_frames:
        print(f"   📊 DECAY ECHO (high OutSnare post-onset, NOT a double-fire):")
        print(f"   These are the envelope decay tail — normal behavior.")
        print(f"   Total echo frames: {len(echo_frames)}")
        for e in echo_frames[:15]:
            print(f"      Onset L{e['onset_line']:5d} → Echo L{e['echo_line']:5d} "
                  f"(+{e['echo_frame']}f) OutSnare={e['OutSnare']:.3f} "
                  f"gRefr={e['gRefr']} Drive={e['Drive']:.4f} hhDlt={e['hhDlt']:.4f}")
        print()

    # All onsets list for reference
    print(f"   📋 ALL ONSETS ({len(onsets)} total):")
    for o in onsets:
        print(f"      L{o['line']:5d} Drive={o['Drive']:.4f} UnG={o['UnG']:.3f} "
              f"Res={o['Res']:.3f} cFx={o['cFx']:.3f} bFct={o['bFct']:.3f} "
              f"WNS={o['WNS']:.3f} Flux={o['Flux']:.3f} Veto={o['Veto']:.3f} "
              f"hhDlt={o['hhDlt']:.4f} {'[KICK]' if o['is_kick'] else ''}")
    print()

if __name__ == '__main__':
    log_dir = r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\technoclub"
    files = [
        os.path.join(log_dir, "dontbeshytiestokarolg2.md"),
    ]

    for fpath in files:
        if os.path.exists(fpath):
            analyze_file(fpath)
