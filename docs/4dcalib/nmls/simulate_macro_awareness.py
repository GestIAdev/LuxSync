import re, statistics
from collections import Counter

def parse_log(path):
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # FINESSE_AUDIT parser
    audit_pat = re.compile(
        r'\[FINESSE_AUDIT\] SnareE:([\d.]+) UnG:([\d.]+) Raw\u0394:([\d.-]+) Flux:([\d.]+) '
        r'WNS:([\d.]+) fBL:([\d.]+) Gate:([\d.]+) Veto:([\d.]+) BassE:([\d.]+) '
        r'Bass\u0394:([\d.-]+) k:([\d.]+) Res:([\d.]+) cFx:([\d.]+) '
        r'bFct:([\d.]+) sEF:([\d.]+) Drive:([\d.]+) OutSnare:([\d.]+) OutKick:([\d.]+)(.*)'
    )
    # MSST section parser
    msst_trans = re.compile(r'\[MSST\] \ud83d\udccd (\w+) \u2192 (\w+)')
    msst_stat  = re.compile(r'\[MSST\] \ud83d\udcca section=(\w+)')

    rows = []
    current_section = 'verse'

    for i, line in enumerate(lines):
        # Track section transitions
        m_trans = msst_trans.search(line)
        if m_trans:
            current_section = m_trans.group(2)
            continue
        m_stat = msst_stat.search(line)
        if m_stat:
            current_section = m_stat.group(1)
            continue

        m = audit_pat.search(line.strip())
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
                'section': current_section,
            })
    return rows

def clamp01(x):
    return max(0.0, min(1.0, x))

# ── Macro-aware MACD simulator ──
def simulate_macro_macd(rows, beats, aF, aS, reset_th, reset_ratio,
                        silence_frames, use_macro=True, use_smart_sef=True):
    """
    Macro-aware MACD with:
    - dynamic momoTh based on spectralDensity (harsh proxy + flat proxy + hh proxy)
    - smart sEF with treble bypass
    - section bonus for drop/chorus
    """
    emaF = 0
    emaS = 0
    prev_mom = 0
    silence_counter = 0
    crossings = []
    dynamic_ths = []  # track dynamic threshold per crossing
    smart_sefs = []
    drives = []

    for r in rows:
        # ── Compute macro context ──
        if use_macro:
            # Proxies from logged variables:
            #   harshness ~ cFx (crack flux = 2-5kHz energy, proxy for highMid density)
            #   flatness  ~ Veto (multi-axis veto includes flatness component)
            #   hh_energy ~ WNS (broadband HF white noise score)
            harsh_proxy = clamp01(r['cFx'])
            flat_proxy  = clamp01(r['Veto'] * 0.5)  # veto is ~2x flatness
            hh_proxy    = clamp01(r['WNS'])

            spectral_density = clamp01(0.4 * harsh_proxy + 0.3 * flat_proxy + 0.3 * hh_proxy)

            # Dynamic threshold: 0.010 (clean) → 0.035 (chaotic)
            dynamic_momo_th = 0.010 + 0.025 * spectral_density

            # Section bonus
            if r['section'] in ('drop', 'chorus'):
                dynamic_momo_th *= 1.2
        else:
            dynamic_momo_th = 0.010  # original fixed threshold

        # ── Smart sEF with treble bypass ──
        if use_smart_sef:
            treble_presence = clamp01(r['WNS'] * 2.0)
            relaxed_min_sef = 0.05 + 0.35 * treble_presence
            smart_sef = max(relaxed_min_sef, min(1.0, r['SnareE'] * 2.0))
        else:
            smart_sef = r['sEF']

        # ── Reconstruct Drive with smart sEF ──
        drive = r['Res'] * r['cFx'] * r['bFct'] * smart_sef

        # ── MACD ──
        emaF += aF * (drive - emaF)
        emaS += aS * (drive - emaS)
        mom = emaF - emaS

        is_cross = mom > dynamic_momo_th and prev_mom <= dynamic_momo_th and drive >= 0.005
        if is_cross:
            crossings.append(r['line'])
            dynamic_ths.append(dynamic_momo_th)
            smart_sefs.append(smart_sef)
        drives.append(drive)

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
        else:
            silence_counter = 0

    return crossings, dynamic_ths, smart_sefs, drives

# ── Main ──
logs = [
    ('MINIMAL 3', r'docs/4dcalib/nmls/minimalverse3.md', 120),
    ('MINIMAL 4', r'docs/4dcalib/nmls/minimalverse4basssynth.md', 124),
    ('BREJCHA 6', r'docs/4dcalib/nmls/brejchaverse6caos.md', 128),
    ('TIESTO 1', r'docs/4dcalib/nmls/djtiesto1.md', 136),
]

aF = 1.00
aS = 0.05
reset_th = 0.15
reset_ratio = 0.70
silence_frames = 8

print('='*90)
print('  MACRO-AWARENESS SIMULATION: Dynamic momoTh + Smart sEF + Section Bonus')
print('='*90)

all_results = []

for name, path, bpm in logs:
    rows = parse_log(path)
    if not rows:
        print(f'\n  {name}: NO DATA')
        continue

    beats = len(rows) / 44 * bpm / 60
    log_onsets = [r['line'] for r in rows if '[ONSET]' in r['tags']]

    # Sections present
    sections = Counter(r['section'] for r in rows)

    print(f'\n{"="*90}')
    print(f'  {name} (bpm={bpm}, beats={beats:.1f}, log onsets={len(log_onsets)})')
    print(f'  Sections: {dict(sections)}')
    print(f'{"="*90}')

    # ── Config matrix ──
    configs = [
        ('ORIG (fixed th=0.01, orig sEF)',     False, False),
        ('MACRO ONLY (dyn th, orig sEF)',       True,  False),
        ('SMART sEF ONLY (fixed th, smart)',    False, True),
        ('FULL MACRO (dyn th + smart sEF)',     True,  True),
    ]

    print(f'\n  {"Config":<45s} {"Cross":>6s} {"/beat":>7s} {"Dbl":>5s} {"New":>5s} {"Lost":>5s}')
    print(f'  {"-"*45:<45s} {"-"*6:>6s} {"-"*7:>7s} {"-"*5:>5s} {"-"*5:>5s} {"-"*5:>5s}')

    orig_crosses = None
    for label, use_macro, use_smart in configs:
        crosses, dths, sefs, drives = simulate_macro_macd(
            rows, beats, aF, aS, reset_th, reset_ratio, silence_frames,
            use_macro=use_macro, use_smart_sef=use_smart)

        intervals = [crosses[i+1]-crosses[i] for i in range(len(crosses)-1)]
        doubles = sum(1 for iv in intervals if iv < 6)

        if orig_crosses is None:
            orig_crosses = crosses
            new_count = 0
            lost_count = 0
        else:
            new_count = len(set(crosses) - set(orig_crosses))
            lost_count = len(set(orig_crosses) - set(crosses))

        print(f'  {label:<45s} {len(crosses):>6d} {len(crosses)/beats:>7.2f} {doubles:>5d} {new_count:>5d} {lost_count:>5d}')

        if use_macro and use_smart:
            all_results.append({
                'name': name, 'beats': beats, 'crosses': len(crosses),
                'doubles': doubles, 'new': new_count, 'lost': lost_count,
                'dyn_ths': dths, 'smart_sefs': sefs,
            })

    # ── Detail: Dynamic threshold behavior ──
    full_crosses, full_dths, full_sefs, full_drives = simulate_macro_macd(
        rows, beats, aF, aS, reset_th, reset_ratio, silence_frames,
        use_macro=True, use_smart_sef=True)

    if full_dths:
        print(f'\n  Dynamic momoTh at crossings:')
        print(f'    min={min(full_dths):.4f} max={max(full_dths):.4f} '
              f'median={statistics.median(full_dths):.4f} mean={statistics.mean(full_dths):.4f}')

    # ── Per-frame spectral density distribution ──
    densities = []
    for r in rows:
        harsh_proxy = clamp01(r['cFx'])
        flat_proxy = clamp01(r['Veto'] * 0.5)
        hh_proxy = clamp01(r['WNS'])
        sd = clamp01(0.4 * harsh_proxy + 0.3 * flat_proxy + 0.3 * hh_proxy)
        densities.append(sd)

    print(f'\n  Spectral density (per-frame proxy):')
    print(f'    min={min(densities):.4f} max={max(densities):.4f} '
          f'median={statistics.median(densities):.4f} mean={statistics.mean(densities):.4f}')
    buckets = [(0, 0.1), (0.1, 0.2), (0.2, 0.3), (0.3, 0.5), (0.5, 1.0)]
    for lo, hi in buckets:
        c = sum(1 for d in densities if lo <= d < hi)
        print(f'    {lo:.1f}-{hi:.1f}: {"#"*min(c,50)} ({c}, {100*c/len(densities):.0f}%)')

    # ── Smart sEF impact ──
    sef_changes = 0
    sef_uplifts = []
    for r in rows:
        treble_presence = clamp01(r['WNS'] * 2.0)
        relaxed_min_sef = 0.05 + 0.35 * treble_presence
        smart_sef = max(relaxed_min_sef, min(1.0, r['SnareE'] * 2.0))
        if smart_sef > r['sEF'] + 0.01:
            sef_changes += 1
            sef_uplifts.append((r['line'], r['sEF'], smart_sef, r['SnareE'], r['WNS'], r['cFx']))

    print(f'\n  Smart sEF: {sef_changes} frames uplifted ({100*sef_changes/len(rows):.0f}%)')
    if sef_uplifts and sef_changes <= 15:
        for ln, old, new, se, wns, cfx in sef_uplifts[:15]:
            print(f'    L{ln:4d}: sEF {old:.3f}->{new:.3f} | SnareE={se:.3f} WNS={wns:.3f} cFx={cfx:.3f}')

    # ── NEW onsets from FULL MACRO (especially Tiesto) ──
    new_onsets = set(full_crosses) - set(orig_crosses)
    if new_onsets:
        print(f'\n  NEW onsets from macro-awareness ({len(new_onsets)}):')
        for ln in sorted(new_onsets)[:15]:
            r = next((x for x in rows if x['line'] == ln), None)
            if r:
                treble_presence = clamp01(r['WNS'] * 2.0)
                relaxed_min_sef = 0.05 + 0.35 * treble_presence
                smart_sef = max(relaxed_min_sef, min(1.0, r['SnareE'] * 2.0))
                orig_drive = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
                new_drive = r['Res'] * r['cFx'] * r['bFct'] * smart_sef
                harsh_p = clamp01(r['cFx'])
                flat_p = clamp01(r['Veto'] * 0.5)
                hh_p = clamp01(r['WNS'])
                sd = clamp01(0.4*harsh_p + 0.3*flat_p + 0.3*hh_p)
                dyn_th = 0.010 + 0.025 * sd
                if r['section'] in ('drop','chorus'):
                    dyn_th *= 1.2
                print(f'    L{ln:4d}: SnareE={r["SnareE"]:.3f} sEF={r["sEF"]:.3f}->smart={smart_sef:.3f} '
                      f'Drive={orig_drive:.4f}->{new_drive:.4f} '
                      f'specDens={sd:.3f} dynTh={dyn_th:.4f} '
                      f'WNS={r["WNS"]:.3f} cFx={r["cFx"]:.3f} sect={r["section"]}')

    # ── LOST onsets ──
    lost_onsets = set(orig_crosses) - set(full_crosses)
    if lost_onsets:
        print(f'\n  LOST onsets ({len(lost_onsets)}):')
        for ln in sorted(lost_onsets)[:10]:
            r = next((x for x in rows if x['line'] == ln), None)
            if r:
                harsh_p = clamp01(r['cFx'])
                flat_p = clamp01(r['Veto'] * 0.5)
                hh_p = clamp01(r['WNS'])
                sd = clamp01(0.4*harsh_p + 0.3*flat_p + 0.3*hh_p)
                dyn_th = 0.010 + 0.025 * sd
                if r['section'] in ('drop','chorus'):
                    dyn_th *= 1.2
                print(f'    L{ln:4d}: SnareE={r["SnareE"]:.3f} Drive={r["Drive"]:.4f} '
                      f'specDens={sd:.3f} dynTh={dyn_th:.4f} (vs 0.010) sect={r["section"]}')

# ── Cross-log summary ──
print(f'\n{"="*90}')
print(f'  CROSS-LOG SUMMARY: FULL MACRO vs ORIGINAL')
print(f'{"="*90}')
print(f'  {"Log":<15s} {"Orig":>6s} {"Macro":>7s} {"Orig Dbl":>9s} {"Macro Dbl":>10s} {"New":>5s} {"Lost":>5s} {"DynTh med":>10s}')
for r in all_results:
    print(f'  {r["name"]:<15s} {len(orig_crosses):>6d} {r["crosses"]:>7d} {"?":>9s} {r["doubles"]:>10d} {r["new"]:>5d} {r["lost"]:>5d} {statistics.median(r["dyn_ths"]):>10.4f}')

# ── Key insight: does dynamic threshold breathe correctly? ──
print(f'\n{"="*90}')
print(f'  KEY QUESTION: Does dynamicMomoTh contract for Tiesto and expand for Brejcha?')
print(f'{"="*90}')
for name, path, bpm in logs:
    rows = parse_log(path)
    if not rows:
        continue
    # Compute per-frame dynamic threshold
    dyn_ths_all = []
    for r in rows:
        harsh_p = clamp01(r['cFx'])
        flat_p = clamp01(r['Veto'] * 0.5)
        hh_p = clamp01(r['WNS'])
        sd = clamp01(0.4*harsh_p + 0.3*flat_p + 0.3*hh_p)
        dth = 0.010 + 0.025 * sd
        if r['section'] in ('drop','chorus'):
            dth *= 1.2
        dyn_ths_all.append(dth)
    print(f'  {name:<15s}: dynTh median={statistics.median(dyn_ths_all):.4f} '
          f'min={min(dyn_ths_all):.4f} max={max(dyn_ths_all):.4f} '
          f'(range={max(dyn_ths_all)-min(dyn_ths_all):.4f})')
