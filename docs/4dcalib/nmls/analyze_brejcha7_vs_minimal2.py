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

def analyze(name, path, bpm):
    rows = parse_log(path)
    if not rows:
        print(f'\n!!! {name}: no FINESSE_AUDIT lines parsed !!!')
        return None

    onsets = [r for r in rows if '[ONSET]' in r['tags']]
    kicks  = [r for r in rows if '[KICK]' in r['tags']]
    both   = [r for r in rows if '[ONSET]' in r['tags'] and '[KICK]' in r['tags']]
    onset_only = [r for r in onsets if r not in both]
    non = [r for r in rows if '[ONSET]' not in r['tags']]

    fps = 44
    beats = len(rows) / fps * bpm / 60

    print(f'\n{"="*70}')
    print(f'  {name} (bpm={bpm})')
    print(f'{"="*70}')
    print(f'  Frames: {len(rows)}, Duration: {len(rows)/fps:.1f}s, Beats: {beats:.1f}')
    print(f'  [ONSET]: {len(onsets)} ({len(onsets)/beats:.2f}/beat)')
    print(f'  [KICK]:  {len(kicks)} ({len(kicks)/beats:.2f}/beat)')
    print(f'  [ONSET]+[KICK]: {len(both)} ({100*len(both)/max(len(onsets),1):.0f}% de onsets)')
    print(f'  [ONSET] only: {len(onset_only)} ({len(onset_only)/beats:.2f}/beat)')

    # ── SnareE classification ──
    real = [r for r in onset_only if r['SnareE'] > 0.3]
    partial = [r for r in onset_only if 0.1 <= r['SnareE'] <= 0.3]
    fp = [r for r in onset_only if r['SnareE'] < 0.1]
    print(f'\n  SnareE > 0.3 (real):     {len(real)} ({len(real)/beats:.2f}/beat)')
    print(f'  SnareE 0.1-0.3 (partial):{len(partial)} ({len(partial)/beats:.2f}/beat)')
    print(f'  SnareE < 0.1 (FP):       {len(fp)} ({len(fp)/beats:.2f}/beat)')

    # ── ONSET+KICK doubling ──
    print(f'\n  === ONSET+KICK DOUBLING ({len(both)} cases) ===')
    both_real = [r for r in both if r['SnareE'] > 0.3]
    both_fp   = [r for r in both if r['SnareE'] < 0.1]
    print(f'  Real doubled (SnareE>0.3): {len(both_real)}')
    print(f'  FP doubled (SnareE<0.1):   {len(both_fp)}')
    for r in both:
        print(f'    L{r["line"]}: SnareE={r["SnareE"]:.3f} sEF={r["sEF"]:.3f} bFct={r["bFct"]:.3f} '
              f'Drive={r["Drive"]:.4f} Res={r["Res"]:.4f} cFx={r["cFx"]:.3f} '
              f'BassE={r["BassE"]:.3f} BassD={r["BassDelta"]:.4f}')

    # ── Inter-onset intervals ──
    print(f'\n  === Inter-onset intervals ===')
    onset_lines = [r['line'] for r in onsets]
    intervals = [onset_lines[i+1]-onset_lines[i] for i in range(len(onset_lines)-1)]
    if intervals:
        print(f'  min={min(intervals)} max={max(intervals)} mean={statistics.mean(intervals):.1f} median={statistics.median(intervals):.1f}')
        ic = Counter(intervals)
        for k in sorted(ic.keys())[:18]:
            ms = k * 1000 / fps
            note = ''
            if bpm > 100:
                if 90 <= ms <= 130: note = '~ 1/16'
                elif 180 <= ms <= 260: note = '~ 1/8'
                elif 380 <= ms <= 520: note = '~ 1/4'
                elif 900 <= ms <= 1100: note = '~ 1/2'
            print(f'    {k:2d} frames ({ms:5.0f}ms): {"#"*min(ic[k],40)} ({ic[k]}) {note}')

        double_triggers = sum(1 for iv in intervals if iv < 6)
        print(f'  Double-trigger pairs (<6 frames, <136ms): {double_triggers}')
        print(f'  After removing doubles: ~{len(onsets) - double_triggers} onsets ({(len(onsets)-double_triggers)/beats:.2f}/beat)')

    # ── sEF distribution ──
    print(f'\n  === sEF distribution ===')
    onset_sef = [r['sEF'] for r in onsets]
    print(f'  ONSET sEF: min={min(onset_sef):.3f} max={max(onset_sef):.3f} median={statistics.median(onset_sef):.3f}')
    sef_buckets = [(0.0, 0.1), (0.1, 0.2), (0.2, 0.3), (0.3, 0.5), (0.5, 0.8), (0.8, 1.0), (1.0, 1.01)]
    for lo, hi in sef_buckets:
        c = sum(1 for b in onset_sef if lo <= b < hi)
        label = f'{lo:.1f}-{hi:.1f}' if hi <= 1.0 else '1.0 (cap)'
        print(f'    {label:12s}: {"#"*min(c,60)} ({c})')

    # ── All onsets detailed ──
    print(f'\n  === ALL ONSETS (detailed) ===')
    for r in onsets:
        tag = 'BOTH' if '[KICK]' in r['tags'] else 'ONSET'
        print(f'  L{r["line"]:4d}: SnareE={r["SnareE"]:.3f} sEF={r["sEF"]:.3f} bFct={r["bFct"]:.3f} '
              f'Drive={r["Drive"]:.4f} Res={r["Res"]:.4f} cFx={r["cFx"]:.3f} Flux={r["Flux"]:.3f} '
              f'WNS={r["WNS"]:.3f} BassE={r["BassE"]:.3f} BassD={r["BassDelta"]:.4f} k={r["k"]:.3f} [{tag}]')

    # ── Veto analysis ──
    print(f'\n  === Veto (Tonality Veto) analysis ===')
    onset_veto = [r['Veto'] for r in onsets]
    non_veto = [r['Veto'] for r in non]
    print(f'  ONSET Veto: median={statistics.median(onset_veto):.3f} mean={statistics.mean(onset_veto):.3f}')
    print(f'  NON   Veto: median={statistics.median(non_veto):.3f} mean={statistics.mean(non_veto):.3f}')
    veto_high_onset = [r for r in onsets if r['Veto'] > 0.3]
    print(f'  ONSET with Veto > 0.3: {len(veto_high_onset)} ({100*len(veto_high_onset)/max(len(onsets),1):.0f}%)')

    # ── fBL (flux baseline) ──
    print(f'\n  === fBL (flux baseline) ===')
    all_fbl = [r['fBL'] for r in rows]
    print(f'  fBL: min={min(all_fbl):.3f} max={max(all_fbl):.3f} median={statistics.median(all_fbl):.3f}')

    # ── k (NLMS bleed) ──
    print(f'\n  === k (NLMS bleed coefficient) ===')
    all_k = [r['k'] for r in rows]
    print(f'  k: min={min(all_k):.3f} max={max(all_k):.3f} median={statistics.median(all_k):.3f}')
    print(f'  k at onsets: median={statistics.median([r["k"] for r in onsets]):.3f}')

    # ── WNS analysis ──
    print(f'\n  === WNS ===')
    onset_wns = [r['WNS'] for r in onsets]
    print(f'  ONSET WNS: median={statistics.median(onset_wns):.3f} mean={statistics.mean(onset_wns):.3f}')
    wns_high = [r for r in onsets if r['WNS'] > 0.1]
    wns_zero = [r for r in onsets if r['WNS'] < 0.01]
    print(f'  WNS > 0.1: {len(wns_high)} ({100*len(wns_high)/max(len(onsets),1):.0f}%)')
    print(f'  WNS < 0.01: {len(wns_zero)} ({100*len(wns_zero)/max(len(onsets),1):.0f}%)')

    # ── Separabilidad ──
    def sep(key):
        o = [r[key] for r in onsets]
        n = [r[key] for r in non]
        return statistics.median(o) / max(statistics.median(n), 1e-6), statistics.median(o), statistics.median(n)

    print(f'\n  === Separabilidad (onset/non) ===')
    for key in ['UnG', 'Flux', 'Res', 'cFx', 'bFct', 'sEF', 'Drive', 'Veto', 'WNS']:
        s, om, nm = sep(key)
        print(f'    {key:8s}: {s:.2f}x  (onset={om:.4f}, non={nm:.4f})')

    return rows

# ── Run both ──
print('='*70)
print('  BREJCHAVERSE 7 vs MINIMALVERSE 2 — Comparative Analysis')
print('='*70)

r7 = analyze('BREJCHAVERSE 7', r'docs/4dcalib/nmls/brejchaverse7.md', 128)
r2 = analyze('MINIMALVERSE 2', r'docs/4dcalib/nmls/minimalverse2.md', 124)

# ── Cross-comparison ──
if r7 and r2:
    print(f'\n{"="*70}')
    print(f'  CROSS-LOG COMPARISON')
    print(f'{"="*70}')

    def stats(rows, name):
        onsets = [r for r in rows if '[ONSET]' in r['tags']]
        onset_only = [r for r in onsets if '[KICK]' not in r['tags']]
        real = [r for r in onset_only if r['SnareE'] > 0.3]
        fp = [r for r in onset_only if r['SnareE'] < 0.1]
        both = [r for r in onsets if '[KICK]' in r['tags']]
        onset_lines = [r['line'] for r in onsets]
        intervals = [onset_lines[i+1]-onset_lines[i] for i in range(len(onset_lines)-1)]
        doubles = sum(1 for iv in intervals if iv < 6)
        return {
            'name': name,
            'total': len(onsets),
            'real': len(real),
            'fp': len(fp),
            'both': len(both),
            'doubles': doubles,
            'drive_median': statistics.median([r['Drive'] for r in onsets]),
            'sef_median': statistics.median([r['sEF'] for r in onsets]),
            'bfct_median': statistics.median([r['bFct'] for r in onsets]),
            'veto_median': statistics.median([r['Veto'] for r in onsets]),
            'k_median': statistics.median([r['k'] for r in onsets]),
            'snaree_median': statistics.median([r['SnareE'] for r in onsets]),
        }

    s7 = stats(r7, 'BREJCHA 7')
    s2 = stats(r2, 'MINIMAL 2')

    print(f'\n  {"Metric":<25s} {"BREJCHA 7":>15s} {"MINIMAL 2":>15s}')
    print(f'  {"-"*55}')
    for key in ['total', 'real', 'fp', 'both', 'doubles']:
        print(f'  {key:<25s} {s7[key]:>15d} {s2[key]:>15d}')
    for key in ['drive_median', 'sef_median', 'bfct_median', 'veto_median', 'k_median', 'snaree_median']:
        print(f'  {key:<25s} {s7[key]:>15.4f} {s2[key]:>15.4f}')
