import re, statistics

def parse_log(path):
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    pat = re.compile(
        r'\[FINESSE_AUDIT\] SnareE:([\d.]+) UnG:([\d.]+) Raw\u0394:([\d.-]+) Flux:([\d.]+) '
        r'WNS:([\d.]+) fBL:([\d.]+) Gate:([\d.]+) Veto:([\d.]+) BassE:([\d.]+) '
        r'Bass\u0394:([\d.-]+) k:([\d.]+) Res:([\d.]+) cFx:([\d.]+) '
        r'bFct:([\d.]+) sEF:([\d.]+) Drive:([\d.]+) OutSnare:([\d.]+) OutKick:([\d.]+)(.*)'
    )
    rows = []
    for i, line in enumerate(lines):
        m = pat.search(line.strip())
        if m:
            rows.append({
                'line': i+1,
                'SnareE': float(m.group(1)), 'Drive': float(m.group(16)),
                'tags': m.group(19).strip(),
            })
    return rows

def simulate(rows, beats, aF, aS, th, floor, reset_th, reset_ratio,
             silence_drive_thresh, silence_ema_thresh, silence_frames_required):
    """Full MACD reconstruction with silence reset frame counter."""
    emaF = 0
    emaS = 0
    prev_mom = 0
    crossings = 0
    silence_counter = 0
    onset_lines = []
    reset_fired = 0

    for r in rows:
        drive = r['Drive']
        emaF += aF * (drive - emaF)
        emaS += aS * (drive - emaS)
        mom = emaF - emaS

        is_cross = mom > th and prev_mom <= th and drive >= floor
        if is_cross:
            crossings += 1
            onset_lines.append(r['line'])

        # Hybrid reset
        if is_cross and reset_th is not None and mom > reset_th:
            emaS += reset_ratio * (emaF - emaS)
            mom = emaF - emaS

        prev_mom = mom

        # Silence reset with frame counter
        if emaS > silence_ema_thresh and drive < silence_drive_thresh:
            silence_counter += 1
            if silence_counter >= silence_frames_required:
                emaF = 0
                emaS = 0
                prev_mom = 0
                silence_counter = 0
                reset_fired += 1
        else:
            silence_counter = 0

    return crossings, onset_lines, reset_fired

# ── Load both logs ──
r7 = parse_log(r'docs/4dcalib/nmls/brejchaverse7.md')
r2 = parse_log(r'docs/4dcalib/nmls/minimalverse2.md')
beats7 = len(r7) / 44 * 128 / 60
beats2 = len(r2) / 44 * 124 / 60

# Real params
aF = 1.00
aS = 0.05
th = 0.01
floor = 0.005
reset_th = 0.15
reset_ratio = 0.70

print('='*70)
print('  SILENCE RESET FORENSIC — The Contamination Source')
print('='*70)

# ── Current: silence resets after 1 frame ──
print(f'\n  === BREJCHA 7 (beats={beats7:.1f}) ===')
for label, sdt, set_, sf in [
    ('Current (1 frame)', 0.01, 0.10, 1),
    ('4 frames (90ms)',   0.01, 0.10, 4),
    ('6 frames (136ms)',  0.01, 0.10, 6),
    ('8 frames (182ms)',  0.01, 0.10, 8),
    ('10 frames (227ms)', 0.01, 0.10, 10),
]:
    c, ol, rf = simulate(r7, beats7, aF, aS, th, floor, reset_th, reset_ratio, sdt, set_, sf)
    log_onsets = [r['line'] for r in r7 if '[ONSET]' in r['tags']]
    print(f'  {label:20s}: crossings={c:3d} ({c/beats7:.2f}/beat)  resets={rf}  log={len(log_onsets)}')

print(f'\n  === MINIMAL 2 (beats={beats2:.1f}) ===')
for label, sdt, set_, sf in [
    ('Current (1 frame)', 0.01, 0.10, 1),
    ('4 frames (90ms)',   0.01, 0.10, 4),
    ('6 frames (136ms)',  0.01, 0.10, 6),
    ('8 frames (182ms)',  0.01, 0.10, 8),
    ('10 frames (227ms)', 0.01, 0.10, 10),
]:
    c, ol, rf = simulate(r2, beats2, aF, aS, th, floor, reset_th, reset_ratio, sdt, set_, sf)
    log_onsets = [r['line'] for r in r2 if '[ONSET]' in r['tags']]
    print(f'  {label:20s}: crossings={c:3d} ({c/beats2:.2f}/beat)  resets={rf}  log={len(log_onsets)}')

# ── Show the silence reset firing pattern ──
print(f'\n  === Silence reset trace (BREJCHA 7, current 1-frame) ===')
print(f'  Showing frames where Drive < 0.01 AND emaSlow > 0.10 (reset conditions):')
emaF = 0
emaS = 0
prev_mom = 0
silence_counter = 0
for r in r7:
    drive = r['Drive']
    emaF += aF * (drive - emaF)
    emaS += aS * (drive - emaS)
    mom = emaF - emaS
    is_cross = mom > th and prev_mom <= th and drive >= floor
    if is_cross and mom > reset_th:
        emaS += reset_ratio * (emaF - emaS)
        mom = emaF - emaS
    prev_mom = mom

    is_silence = emaS > 0.10 and drive < 0.01
    if is_silence:
        silence_counter += 1
        will_reset = silence_counter >= 1
        tag = 'RESET!' if will_reset else ''
        if silence_counter <= 3 or will_reset:
            print(f'  L{r["line"]:4d}: Drive={drive:.5f} emaS={emaS:.5f} silence_count={silence_counter} {tag}')
    else:
        if silence_counter > 0:
            print(f'  L{r["line"]:4d}: Drive={drive:.5f} emaS={emaS:.5f} SILENCE BROKEN (was {silence_counter} frames)')
        silence_counter = 0

    if is_cross:
        print(f'  L{r["line"]:4d}: *** CROSSING *** Drive={drive:.5f} mom={mom:.5f} emaS={emaS:.5f}')

# ── Show the 4-frame version for comparison ──
print(f'\n  === Silence reset trace (BREJCHA 7, 4-frame counter) ===')
print(f'  Showing only crossings and resets:')
emaF = 0
emaS = 0
prev_mom = 0
silence_counter = 0
crossings = 0
resets = 0
for r in r7:
    drive = r['Drive']
    emaF += aF * (drive - emaF)
    emaS += aS * (drive - emaS)
    mom = emaF - emaS
    is_cross = mom > th and prev_mom <= th and drive >= floor
    if is_cross:
        crossings += 1
        print(f'  L{r["line"]:4d}: *** CROSSING *** Drive={drive:.5f} mom={mom:.5f} emaS={emaS:.5f}')
    if is_cross and mom > reset_th:
        emaS += reset_ratio * (emaF - emaS)
        mom = emaF - emaS
    prev_mom = mom

    if emaS > 0.10 and drive < 0.01:
        silence_counter += 1
        if silence_counter >= 4:
            emaF = 0
            emaS = 0
            prev_mom = 0
            silence_counter = 0
            resets += 1
            print(f'  L{r["line"]:4d}: --- RESET (4 frames silence) ---')
    else:
        silence_counter = 0

print(f'\n  Total crossings (4-frame): {crossings} ({crossings/beats7:.2f}/beat)')
print(f'  Total resets (4-frame): {resets}')

# ── Combined: 4-frame silence + threshold sweep ──
print(f'\n  === Combined: 4-frame silence + threshold sweep ===')
for th_test in [0.010, 0.015, 0.020, 0.025, 0.030]:
    c7, _, _ = simulate(r7, beats7, aF, aS, th_test, floor, reset_th, reset_ratio, 0.01, 0.10, 4)
    c2, _, _ = simulate(r2, beats2, aF, aS, th_test, floor, reset_th, reset_ratio, 0.01, 0.10, 4)
    print(f'  th={th_test:.3f}: BREJCHA={c7:3d} ({c7/beats7:.2f}/beat)  MINIMAL={c2:3d} ({c2/beats2:.2f}/beat)')
