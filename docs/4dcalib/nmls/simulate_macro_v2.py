import re, statistics
from collections import Counter

def parse_log(path):
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    audit_pat = re.compile(
        r'\[FINESSE_AUDIT\] SnareE:([\d.]+) UnG:([\d.]+) Raw\u0394:([\d.-]+) Flux:([\d.]+) '
        r'WNS:([\d.]+) fBL:([\d.]+) Gate:([\d.]+) Veto:([\d.]+) BassE:([\d.]+) '
        r'Bass\u0394:([\d.-]+) k:([\d.]+) Res:([\d.]+) cFx:([\d.]+) '
        r'bFct:([\d.]+) sEF:([\d.]+) Drive:([\d.]+) OutSnare:([\d.]+) OutKick:([\d.]+)(.*)'
    )
    msst_trans = re.compile(r'\[MSST\] \ud83d\udccd (\w+) \u2192 (\w+)')
    msst_stat  = re.compile(r'\[MSST\] \ud83d\udcca section=(\w+)')
    rows = []
    current_section = 'verse'
    for i, line in enumerate(lines):
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

# ── Rolling window density ──
class RollingDensity:
    """Rolling window (N frames) to get SUSTAINED density, not per-frame transient."""
    def __init__(self, window=44):  # 44 frames = 1 second
        self.window = window
        self.buf = []
        self.sum_flux = 0
        self.sum_wns = 0
        self.sum_cfx = 0
        self.sum_k = 0
        self.sum_bass = 0

    def update(self, flux, wns, cfx, k, bass):
        v = (flux, wns, cfx, k, bass)
        self.buf.append(v)
        self.sum_flux += flux
        self.sum_wns += wns
        self.sum_cfx += cfx
        self.sum_k += k
        self.sum_bass += bass
        if len(self.buf) > self.window:
            old = self.buf.pop(0)
            self.sum_flux -= old[0]
            self.sum_wns -= old[1]
            self.sum_cfx -= old[2]
            self.sum_k -= old[3]
            self.sum_bass -= old[4]

    def density(self):
        n = len(self.buf)
        if n == 0:
            return 0
        avg_flux = self.sum_flux / n
        avg_wns = self.sum_wns / n
        avg_cfx = self.sum_cfx / n
        avg_k = self.sum_k / n
        avg_bass = self.sum_bass / n
        # Density = how much HF activity + how much transient activity + how much NLMS adaptation
        # Use rolling averages (sustained measures, not per-frame transients)
        hf_density = clamp01(avg_cfx * 3.0 + avg_wns * 5.0)  # scale up since these are sparse
        transient_density = clamp01(avg_flux * 4.0)
        bass_density = clamp01(avg_bass * 1.2)
        # Combined: tracks with lots of HF transients = dense
        spectral_density = clamp01(0.4 * hf_density + 0.4 * transient_density + 0.2 * bass_density)
        return spectral_density

# ── Macro-aware MACD with rolling density ──
def simulate_macro_macd(rows, beats, aF, aS, reset_th, reset_ratio,
                        silence_frames, use_macro=True, use_smart_sef=True,
                        window=44):
    emaF = 0
    emaS = 0
    prev_mom = 0
    silence_counter = 0
    crossings = []
    dyn_ths_at_cross = []
    densities_at_cross = []
    all_densities = []
    all_dyn_ths = []
    roller = RollingDensity(window)

    for r in rows:
        roller.update(r['Flux'], r['WNS'], r['cFx'], r['k'], r['BassE'])
        sd = roller.density()
        all_densities.append(sd)

        if use_macro:
            dynamic_momo_th = 0.010 + 0.025 * sd
            if r['section'] in ('drop', 'chorus'):
                dynamic_momo_th *= 1.2
        else:
            dynamic_momo_th = 0.010
        all_dyn_ths.append(dynamic_momo_th)

        # Smart sEF
        if use_smart_sef:
            # Use rolling WNS as hh_energy proxy (sustained, not per-frame)
            n = len(roller.buf)
            avg_wns = roller.sum_wns / n if n > 0 else 0
            treble_presence = clamp01(avg_wns * 8.0)  # scale up: avg WNS is ~0.01-0.05
            relaxed_min_sef = 0.05 + 0.35 * treble_presence
            smart_sef = max(relaxed_min_sef, min(1.0, r['SnareE'] * 2.0))
        else:
            smart_sef = r['sEF']

        drive = r['Res'] * r['cFx'] * r['bFct'] * smart_sef

        emaF += aF * (drive - emaF)
        emaS += aS * (drive - emaS)
        mom = emaF - emaS

        is_cross = mom > dynamic_momo_th and prev_mom <= dynamic_momo_th and drive >= 0.005
        if is_cross:
            crossings.append(r['line'])
            dyn_ths_at_cross.append(dynamic_momo_th)
            densities_at_cross.append(sd)

        if is_cross and reset_th is not None and mom > reset_th:
            emaS += reset_ratio * (emaF - emaS)
            mom = emaF - emaS
        prev_mom = mom

        if emaS > 0.10 and drive < 0.01:
            silence_counter += 1
            if silence_counter >= silence_frames:
                emaF = 0; emaS = 0; prev_mom = 0; silence_counter = 0
        else:
            silence_counter = 0

    return crossings, dyn_ths_at_cross, densities_at_cross, all_densities, all_dyn_ths

# ── Main ──
logs = [
    ('MINIMAL 3', r'docs/4dcalib/nmls/minimalverse3.md', 120),
    ('MINIMAL 4', r'docs/4dcalib/nmls/minimalverse4basssynth.md', 124),
    ('BREJCHA 6', r'docs/4dcalib/nmls/brejchaverse6caos.md', 128),
    ('TIESTO 1', r'docs/4dcalib/nmls/djtiesto1.md', 136),
]

aF = 1.00; aS = 0.05; reset_th = 0.15; reset_ratio = 0.70; silence_frames = 8

print('='*95)
print('  MACRO-AWARENESS v2: Rolling Window Density (1s) + Smart sEF + Section Bonus')
print('='*95)

for name, path, bpm in logs:
    rows = parse_log(path)
    if not rows:
        continue
    beats = len(rows) / 44 * bpm / 60
    log_onsets = [r['line'] for r in rows if '[ONSET]' in r['tags']]

    print(f'\n{"="*95}')
    print(f'  {name} (bpm={bpm}, beats={beats:.1f}, log onsets={len(log_onsets)})')
    print(f'{"="*95}')

    configs = [
        ('ORIG (fixed th=0.01, orig sEF)',     False, False),
        ('FULL MACRO v2 (rolling dens+smart)',  True,  True),
    ]

    print(f'\n  {"Config":<45s} {"Cross":>6s} {"/beat":>7s} {"Dbl":>5s} {"New":>5s} {"Lost":>5s}')
    orig_crosses = None
    for label, use_macro, use_smart in configs:
        crosses, dths, densities, all_d, all_t = simulate_macro_macd(
            rows, beats, aF, aS, reset_th, reset_ratio, silence_frames,
            use_macro=use_macro, use_smart_sef=use_smart, window=44)
        intervals = [crosses[i+1]-crosses[i] for i in range(len(crosses)-1)]
        doubles = sum(1 for iv in intervals if iv < 6)
        if orig_crosses is None:
            orig_crosses = crosses; new_c = 0; lost_c = 0
        else:
            new_c = len(set(crosses) - set(orig_crosses))
            lost_c = len(set(orig_crosses) - set(crosses))
        print(f'  {label:<45s} {len(crosses):>6d} {len(crosses)/beats:>7.2f} {doubles:>5d} {new_c:>5d} {lost_c:>5d}')

    # ── Rolling density profile ──
    full_crosses, full_dths, full_dens, all_dens, all_ths = simulate_macro_macd(
        rows, beats, aF, aS, reset_th, reset_ratio, silence_frames,
        use_macro=True, use_smart_sef=True, window=44)

    print(f'\n  Rolling spectral density (1s window):')
    print(f'    median={statistics.median(all_dens):.4f} mean={statistics.mean(all_dens):.4f} '
          f'min={min(all_dens):.4f} max={max(all_dens):.4f}')
    buckets = [(0, 0.05), (0.05, 0.1), (0.1, 0.2), (0.2, 0.3), (0.3, 0.5), (0.5, 1.0)]
    for lo, hi in buckets:
        c = sum(1 for d in all_dens if lo <= d < hi)
        print(f'    {lo:.2f}-{hi:.2f}: {"#"*min(c,50)} ({c}, {100*c/len(all_dens):.0f}%)')

    print(f'\n  Dynamic momoTh (per-frame):')
    print(f'    median={statistics.median(all_ths):.4f} mean={statistics.mean(all_ths):.4f} '
          f'min={min(all_ths):.4f} max={max(all_ths):.4f}')
    if full_dths:
        print(f'    At crossings: median={statistics.median(full_dths):.4f} '
              f'range=[{min(full_dths):.4f}, {max(full_dths):.4f}]')

    # ── New onsets ──
    new_onsets = set(full_crosses) - set(orig_crosses)
    if new_onsets:
        print(f'\n  NEW onsets ({len(new_onsets)}):')
        for ln in sorted(new_onsets)[:10]:
            r = next((x for x in rows if x['line'] == ln), None)
            if r:
                idx = next(i for i, x in enumerate(rows) if x['line'] == ln)
                print(f'    L{ln:4d}: SnareE={r["SnareE"]:.3f} sEF={r["sEF"]:.3f} '
                      f'Drive={r["Drive"]:.4f} dens={all_dens[idx]:.3f} '
                      f'dynTh={all_ths[idx]:.4f} WNS={r["WNS"]:.3f} cFx={r["cFx"]:.3f}')

    # ── Lost onsets ──
    lost_onsets = set(orig_crosses) - set(full_crosses)
    if lost_onsets:
        print(f'\n  LOST onsets ({len(lost_onsets)}):')
        for ln in sorted(lost_onsets)[:10]:
            r = next((x for x in rows if x['line'] == ln), None)
            if r:
                idx = next(i for i, x in enumerate(rows) if x['line'] == ln)
                print(f'    L{ln:4d}: SnareE={r["SnareE"]:.3f} Drive={r["Drive"]:.4f} '
                      f'dens={all_dens[idx]:.3f} dynTh={all_ths[idx]:.4f} (vs 0.010)')

# ── Cross-log comparison: does threshold breathe correctly? ──
print(f'\n{"="*95}')
print(f'  KEY: Does dynamicMomoTh EXPAND for Brejcha and CONTRACT for Tiesto?')
print(f'{"="*95}')
print(f'  {"Log":<15s} {"Density med":>12s} {"Density mean":>13s} {"DynTh med":>11s} {"DynTh range":>13s}')
for name, path, bpm in logs:
    rows = parse_log(path)
    if not rows:
        continue
    _, _, _, all_d, all_t = simulate_macro_macd(
        rows, len(rows)/44*bpm/60, aF, aS, reset_th, reset_ratio, silence_frames,
        use_macro=True, use_smart_sef=True, window=44)
    print(f'  {name:<15s} {statistics.median(all_d):>12.4f} {statistics.mean(all_d):>13.4f} '
          f'{statistics.median(all_t):>11.4f} [{min(all_t):.4f}-{max(all_t):.4f}]')

# ── Verdict ──
print(f'\n{"="*95}')
print(f'  VERDICT')
print(f'{"="*95}')
