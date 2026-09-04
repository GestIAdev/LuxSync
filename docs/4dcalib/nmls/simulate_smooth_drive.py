import re, statistics
from collections import Counter

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
                'SnareE': float(m.group(1)), 'UnG': float(m.group(2)),
                'RawDelta': float(m.group(3)), 'Flux': float(m.group(4)),
                'WNS': float(m.group(5)), 'fBL': float(m.group(6)),
                'Gate': float(m.group(7)), 'Veto': float(m.group(8)),
                'BassE': float(m.group(9)), 'BassDelta': float(m.group(10)),
                'k': float(m.group(11)), 'Res': float(m.group(12)),
                'cFx': float(m.group(13)), 'bFct': float(m.group(14)),
                'sEF': float(m.group(15)), 'Drive': float(m.group(16)),
                'OutSnare': float(m.group(17)), 'OutKick': float(m.group(18)),
                'tags': m.group(19).strip(),
            })
    return rows

# ── MACD simulator with configurable params ──
def simulate_macd(rows, beats, aF, aS, th, floor, reset_th, reset_ratio,
                  silence_frames, use_envelope=False, env_decay=0.70,
                  drive_override=None):
    """
    If drive_override is provided, use it instead of rows[i]['Drive'].
    If use_envelope, apply peak-hold envelope to the drive signal.
    """
    emaF = 0
    emaS = 0
    prev_mom = 0
    silence_counter = 0
    crossings = []
    env = 0

    for r in rows:
        raw_drive = drive_override(r) if drive_override else r['Drive']

        if use_envelope:
            env = max(raw_drive, env * env_decay)
            drive = env
        else:
            drive = raw_drive

        emaF += aF * (drive - emaF)
        emaS += aS * (drive - emaS)
        mom = emaF - emaS

        is_cross = mom > th and prev_mom <= th and drive >= floor
        if is_cross:
            crossings.append(r['line'])

        # Hybrid reset
        if is_cross and reset_th is not None and mom > reset_th:
            emaS += reset_ratio * (emaF - emaS)
            mom = emaF - emaS

        prev_mom = mom

        # Silence reset with frame counter
        if emaS > 0.10 and drive < 0.01:
            silence_counter += 1
            if silence_counter >= silence_frames:
                emaF = 0
                emaS = 0
                prev_mom = 0
                silence_counter = 0
                env = 0
        else:
            silence_counter = 0

    return crossings

# ── Smart sEF: treble bypass ──
def smart_sef(snare_energy_factor, crack_flux):
    """
    If crackFlux is exceptionally high (>0.5), bypass the sEF punishment.
    treble_bypass = min(1.0, crackFlux * 2.0)
    smart_sEF = max(snareEnergyFactor, treble_bypass)
    """
    treble_bypass = min(1.0, crack_flux * 2.0)
    return max(snare_energy_factor, treble_bypass)

# ── Reconstruct Drive from components ──
def reconstruct_drive(r, use_smart_sef=False):
    """
    Drive = Residual * crackFlux * bodyFactor * sEF
    We have Res, cFx, bFct, sEF in the log.
    For smart_sEF, replace sEF with smart_sef(sEF, cFx).
    """
    sef = smart_sef(r['sEF'], r['cFx']) if use_smart_sef else r['sEF']
    drive = r['Res'] * r['cFx'] * r['bFct'] * sef
    return drive

# ── Analyze crossings vs log onsets ──
def analyze_crossings(name, crossings, log_onsets, beats):
    log_lines = set(log_onsets)
    cross_lines = set(crossings)

    matched = cross_lines & log_lines
    cross_only = cross_lines - log_lines
    log_only = log_lines - cross_lines

    # Double-triggers in crossings
    intervals = [crossings[i+1]-crossings[i] for i in range(len(crossings)-1)]
    doubles = sum(1 for iv in intervals if iv < 6)

    print(f'    Crossings: {len(crossings)} ({len(crossings)/beats:.2f}/beat)')
    print(f'    Doubles (<6f): {doubles}')
    print(f'    After removing doubles: ~{len(crossings)-doubles} ({(len(crossings)-doubles)/beats:.2f}/beat)')
    print(f'    Matched log onsets: {len(matched)}')
    print(f'    Cross-only (new): {len(cross_only)}')
    print(f'    Log-only (lost): {len(log_only)}')

    return len(crossings), doubles, len(log_only)

# ── Main ──
logs = [
    ('MINIMAL 3', r'docs/4dcalib/nmls/minimalverse3.md', 120),
    ('MINIMAL 4', r'docs/4dcalib/nmls/minimalverse4basssynth.md', 124),
    ('BREJCHA 6', r'docs/4dcalib/nmls/brejchaverse6caos.md', 128),
    ('TIESTO 1', r'docs/4dcalib/nmls/djtiesto1.md', 136),
]

# MACD params
aF = 1.00
aS = 0.05
reset_th = 0.15
reset_ratio = 0.70
silence_frames = 8

print('='*80)
print('  SIMULATION: FAST-ENVELOPE (0.70) + THRESHOLD 0.025 + SMART sEF')
print('='*80)

for name, path, bpm in logs:
    rows = parse_log(path)
    if not rows:
        print(f'\n  {name}: NO DATA')
        continue

    beats = len(rows) / 44 * bpm / 60
    log_onsets = [r['line'] for r in rows if '[ONSET]' in r['tags']]

    print(f'\n{"="*80}')
    print(f'  {name} (bpm={bpm}, beats={beats:.1f}, log onsets={len(log_onsets)})')
    print(f'{"="*80}')

    # ── PART 1: Envelope + threshold sweep (original Drive) ──
    print(f'\n  --- PART 1: Envelope 0.70 + threshold sweep (original Drive) ---')
    print(f'  {"Config":<35s} {"Cross":>6s} {"/beat":>7s} {"Dbl":>5s} {"Lost":>5s}')
    for env_decay, th, use_env in [
        (0.70, 0.010, False),  # baseline: no envelope, th=0.01
        (0.70, 0.025, False),  # th only
        (0.70, 0.025, True),   # envelope + th
        (0.75, 0.025, True),   # envelope 0.75 + th
        (0.80, 0.025, True),   # envelope 0.80 + th
        (0.85, 0.025, True),   # envelope 0.85 + th
    ]:
        crossings = simulate_macd(rows, beats, aF, aS, th, 0.005,
                                   reset_th, reset_ratio, silence_frames,
                                   use_envelope=use_env, env_decay=env_decay)
        intervals = [crossings[i+1]-crossings[i] for i in range(len(crossings)-1)]
        doubles = sum(1 for iv in intervals if iv < 6)
        log_set = set(log_onsets)
        lost = len(log_set - set(crossings))
        label = f'env={env_decay if use_env else "OFF"} th={th:.3f}'
        print(f'  {label:<35s} {len(crossings):>6d} {len(crossings)/beats:>7.2f} {doubles:>5d} {lost:>5d}')

    # ── PART 2: Smart sEF (treble bypass) ──
    print(f'\n  --- PART 2: Smart sEF (treble bypass) ---')
    print(f'  Reconstructing Drive with smart_sEF = max(sEF, min(1.0, cFx*2.0))')
    print(f'  {"Config":<45s} {"Cross":>6s} {"/beat":>7s} {"Dbl":>5s} {"Lost":>5s}')

    for use_smart, use_env, th, env_decay in [
        (False, False, 0.010, 0.70),  # baseline original
        (True,  False, 0.010, 0.70),  # smart_sEF only
        (True,  True,  0.025, 0.70),  # smart_sEF + envelope + th
        (True,  True,  0.025, 0.75),  # smart_sEF + envelope 0.75
    ]:
        drive_fn = lambda r: reconstruct_drive(r, use_smart_sef=use_smart)
        crossings = simulate_macd(rows, beats, aF, aS, th, 0.005,
                                   reset_th, reset_ratio, silence_frames,
                                   use_envelope=use_env, env_decay=env_decay,
                                   drive_override=drive_fn)
        intervals = [crossings[i+1]-crossings[i] for i in range(len(crossings)-1)]
        doubles = sum(1 for iv in intervals if iv < 6)
        log_set = set(log_onsets)
        lost = len(log_set - set(crossings))
        smart_label = 'smart_sEF' if use_smart else 'orig_sEF'
        env_label = f'env={env_decay}' if use_env else 'env=OFF'
        label = f'{smart_label} {env_label} th={th:.3f}'
        print(f'  {label:<45s} {len(crossings):>6d} {len(crossings)/beats:>7.2f} {doubles:>5d} {lost:>5d}')

    # ── PART 3: Detailed comparison for this log ──
    print(f'\n  --- PART 3: Detailed frame comparison (best config) ---')

    # Best config: smart_sEF + envelope 0.70 + th 0.025
    drive_fn = lambda r: reconstruct_drive(r, use_smart_sef=True)
    best_cross = simulate_macd(rows, beats, aF, aS, 0.025, 0.005,
                                reset_th, reset_ratio, silence_frames,
                                use_envelope=True, env_decay=0.70,
                                drive_override=drive_fn)

    # Original (current production)
    orig_cross = simulate_macd(rows, beats, aF, aS, 0.010, 0.005,
                                reset_th, reset_ratio, silence_frames,
                                use_envelope=False, drive_override=None)

    print(f'  Current production:     {len(orig_cross):3d} crossings ({len(orig_cross)/beats:.2f}/beat)')
    print(f'  Best config (smart+env): {len(best_cross):3d} crossings ({len(best_cross)/beats:.2f}/beat)')

    # Show new onsets that appear with smart_sEF (especially for Tiesto)
    new_onsets = set(best_cross) - set(orig_cross)
    if new_onsets:
        print(f'\n  NEW onsets from smart_sEF ({len(new_onsets)}):')
        for ln in sorted(new_onsets)[:15]:
            r = next((x for x in rows if x['line'] == ln), None)
            if r:
                smart = smart_sef(r['sEF'], r['cFx'])
                orig_drive = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
                new_drive = r['Res'] * r['cFx'] * r['bFct'] * smart
                print(f'    L{ln:4d}: SnareE={r["SnareE"]:.3f} cFx={r["cFx"]:.3f} '
                      f'sEF={r["sEF"]:.3f}->smart={smart:.3f} '
                      f'Drive={orig_drive:.4f}->{new_drive:.4f} '
                      f'WNS={r["WNS"]:.3f} Flux={r["Flux"]:.3f}')

    # Show lost onsets
    lost_onsets = set(orig_cross) - set(best_cross)
    if lost_onsets:
        print(f'\n  LOST onsets ({len(lost_onsets)}):')
        for ln in sorted(lost_onsets)[:10]:
            r = next((x for x in rows if x['line'] == ln), None)
            if r:
                print(f'    L{ln:4d}: SnareE={r["SnareE"]:.3f} cFx={r["cFx"]:.3f} '
                      f'sEF={r["sEF"]:.3f} Drive={r["Drive"]:.4f}')

    # ── PART 4: Smart sEF impact on Drive values ──
    if name == 'TIESTO 1':
        print(f'\n  --- PART 4: TIESTO Drive resuscitation ---')
        print(f'  Frames where smart_sEF > orig_sEF (treble bypass activated):')
        activated = 0
        for r in rows:
            smart = smart_sef(r['sEF'], r['cFx'])
            if smart > r['sEF'] + 0.01:  # bypass made a difference
                activated += 1
                orig_drive = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
                new_drive = r['Res'] * r['cFx'] * r['bFct'] * smart
                if activated <= 20:
                    print(f'    L{r["line"]:4d}: SnareE={r["SnareE"]:.3f} cFx={r["cFx"]:.3f} '
                          f'sEF={r["sEF"]:.3f}->smart={smart:.3f} '
                          f'Drive={orig_drive:.4f}->{new_drive:.4f} '
                          f'Flux={r["Flux"]:.3f} WNS={r["WNS"]:.3f}')
        print(f'  Total frames with treble bypass activated: {activated}/{len(rows)} ({100*activated/len(rows):.0f}%)')

        # Show the cFx distribution for Tiesto
        all_cfx = [r['cFx'] for r in rows]
        print(f'\n  cFx distribution (ALL frames):')
        print(f'    min={min(all_cfx):.4f} max={max(all_cfx):.4f} median={statistics.median(all_cfx):.4f}')
        cfx_buckets = [(0, 0.1), (0.1, 0.2), (0.2, 0.3), (0.3, 0.5), (0.5, 1.0)]
        for lo, hi in cfx_buckets:
            c = sum(1 for v in all_cfx if lo <= v < hi)
            print(f'    {lo:.1f}-{hi:.1f}: {"#"*min(c,50)} ({c})')

# ── Summary table ──
print(f'\n{"="*80}')
print(f'  SUMMARY: Best config = smart_sEF + envelope 0.70 + th 0.025')
print(f'{"="*80}')
print(f'  {"Log":<15s} {"Orig":>8s} {"Best":>8s} {"Orig Dbl":>10s} {"Best Dbl":>10s} {"New Onsets":>11s}')
for name, path, bpm in logs:
    rows = parse_log(path)
    if not rows:
        continue
    beats = len(rows) / 44 * bpm / 60

    orig_cross = simulate_macd(rows, beats, aF, aS, 0.010, 0.005,
                                reset_th, reset_ratio, silence_frames,
                                use_envelope=False, drive_override=None)
    drive_fn = lambda r: reconstruct_drive(r, use_smart_sef=True)
    best_cross = simulate_macd(rows, beats, aF, aS, 0.025, 0.005,
                                reset_th, reset_ratio, silence_frames,
                                use_envelope=True, env_decay=0.70,
                                drive_override=drive_fn)

    orig_intervals = [orig_cross[i+1]-orig_cross[i] for i in range(len(orig_cross)-1)]
    best_intervals = [best_cross[i+1]-best_cross[i] for i in range(len(best_cross)-1)]
    orig_dbl = sum(1 for iv in orig_intervals if iv < 6)
    best_dbl = sum(1 for iv in best_intervals if iv < 6)
    new = len(set(best_cross) - set(orig_cross))

    print(f'  {name:<15s} {len(orig_cross):>8d} {len(best_cross):>8d} {orig_dbl:>10d} {best_dbl:>10d} {new:>11d}')
