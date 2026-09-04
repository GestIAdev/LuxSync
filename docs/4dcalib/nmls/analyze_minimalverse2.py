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
                'WNS': float(m.group(5)), 'Veto': float(m.group(8)),
                'BassE': float(m.group(9)), 'BassDelta': float(m.group(10)),
                'k': float(m.group(11)), 'Res': float(m.group(12)),
                'cFx': float(m.group(13)), 'bFct': float(m.group(14)),
                'sEF': float(m.group(15)), 'Drive': float(m.group(16)),
                'OutSnare': float(m.group(17)), 'OutKick': float(m.group(18)),
                'tags': m.group(19).strip(),
            })
    return rows, lines

def analyze(name, path, bpm):
    rows, lines = parse_log(path)
    if not rows:
        print(f'\n!!! {name}: no FINESSE_AUDIT lines parsed !!!')
        return

    onsets = [r for r in rows if '[ONSET]' in r['tags']]
    kicks  = [r for r in rows if '[KICK]' in r['tags']]
    both   = [r for r in rows if '[ONSET]' in r['tags'] and '[KICK]' in r['tags']]
    onset_only = [r for r in onsets if r not in both]
    non = [r for r in rows if '[ONSET]' not in r['tags']]

    total_frames = len(rows)
    fps = 44
    duration_s = total_frames / fps
    beats = duration_s * bpm / 60

    print(f'\n{"="*70}')
    print(f'  {name} (bpm={bpm})')
    print(f'{"="*70}')
    print(f'  Frames: {total_frames}, Duration: {duration_s:.1f}s, Beats: {beats:.1f}')
    print(f'  [ONSET]: {len(onsets)} ({len(onsets)/beats:.2f}/beat)')
    print(f'  [KICK]:  {len(kicks)} ({len(kicks)/beats:.2f}/beat)')
    print(f'  [ONSET]+[KICK]: {len(both)} ({100*len(both)/max(len(onsets),1):.0f}% de onsets)')
    print(f'  [ONSET] only: {len(onset_only)} ({len(onset_only)/beats:.2f}/beat)')

    # ── sEF analysis ──
    print(f'\n  === sEF (SnareEnergyFactor) distribution ===')
    onset_sef = [r['sEF'] for r in onsets]
    non_sef   = [r['sEF'] for r in non]
    print(f'  ONSET sEF: min={min(onset_sef):.3f} max={max(onset_sef):.3f} median={statistics.median(onset_sef):.3f} mean={statistics.mean(onset_sef):.3f}')
    print(f'  NON   sEF: min={min(non_sef):.3f} max={max(non_sef):.3f} median={statistics.median(non_sef):.3f} mean={statistics.mean(non_sef):.3f}')

    # sEF histogram for onsets
    sef_buckets = [(0.0, 0.1), (0.1, 0.2), (0.2, 0.3), (0.3, 0.4), (0.4, 0.5),
                   (0.5, 0.6), (0.6, 0.8), (0.8, 1.0), (1.0, 1.01)]
    print(f'  ONSET sEF histogram:')
    for lo, hi in sef_buckets:
        c = sum(1 for b in onset_sef if lo <= b < hi)
        label = f'{lo:.1f}-{hi:.1f}' if hi <= 1.0 else '1.0 (cap)'
        print(f'    {label:12s}: {"#"*min(c,60)} ({c})')

    # ── SnareE gate analysis ──
    print(f'\n  === SnareE gate vs MACD ===')
    snaree_high = [r for r in onset_only if r['SnareE'] > 0.3]
    snaree_mid  = [r for r in onset_only if 0.1 <= r['SnareE'] <= 0.3]
    snaree_low  = [r for r in onset_only if r['SnareE'] < 0.1]
    print(f'  SnareE > 0.3 (gate AGREE):   {len(snaree_high)} ({len(snaree_high)/beats:.2f}/beat)')
    print(f'  SnareE 0.1-0.3 (partial):    {len(snaree_mid)} ({len(snaree_mid)/beats:.2f}/beat)')
    print(f'  SnareE < 0.1 (gate DISAGREE):{len(snaree_low)} ({len(snaree_low)/beats:.2f}/beat)')

    # ── The KEY analysis: ONSET+KICK doubling ──
    print(f'\n  === ONSET+KICK DOUBLING ({len(both)} cases) ===')
    print(f'  These are snares firing SIMULTANEOUSLY with kicks.')
    print(f'  In minimal techno 4/4, snare should be on off-beats (2&4), kick on 1&3.')
    print(f'  Doubling rate: {100*len(both)/max(len(onsets),1):.0f}% of onsets fire WITH kick')
    print()
    for r in both:
        print(f'    L{r["line"]}: SnareE={r["SnareE"]:.3f} sEF={r["sEF"]:.3f} bFct={r["bFct"]:.3f} '
              f'Drive={r["Drive"]:.4f} Res={r["Res"]:.4f} cFx={r["cFx"]:.3f} '
              f'BassE={r["BassE"]:.3f} BassD={r["BassDelta"]:.4f} k={r["k"]:.3f}')

    # ── Profile: ONSET+KICK vs ONSET-only ──
    print(f'\n  === ONSET+KICK vs ONSET-only profile ===')
    if both and onset_only:
        for key in ['SnareE', 'sEF', 'bFct', 'Drive', 'Res', 'cFx', 'Flux', 'BassE', 'BassDelta', 'k', 'UnG', 'WNS']:
            both_vals = [r[key] for r in both]
            only_vals = [r[key] for r in onset_only]
            ratio = statistics.median(only_vals) / max(statistics.median(both_vals), 1e-6)
            print(f'    {key:10s}: double={statistics.median(both_vals):.4f} only={statistics.median(only_vals):.4f} ratio={ratio:.2f}x')

    # ── Separabilidad ──
    def sep(key):
        o = [r[key] for r in onsets]
        n = [r[key] for r in non]
        return statistics.median(o) / max(statistics.median(n), 1e-6), statistics.median(o), statistics.median(n)

    print(f'\n  === Separabilidad (onset median / non median) ===')
    for key in ['UnG', 'Flux', 'Res', 'cFx', 'bFct', 'sEF', 'Drive']:
        s, om, nm = sep(key)
        print(f'    {key:8s}: {s:.2f}x  (onset={om:.4f}, non={nm:.4f})')

    # ── WNS analysis ──
    print(f'\n  === WNS (synth contamination) ===')
    onset_wns = [r['WNS'] for r in onsets]
    wns_high = [r for r in onsets if r['WNS'] > 0.1]
    wns_zero = [r for r in onsets if r['WNS'] < 0.01]
    print(f'  ONSET WNS: median={statistics.median(onset_wns):.3f} mean={statistics.mean(onset_wns):.3f}')
    print(f'  ONSET with WNS > 0.1 (synth-like): {len(wns_high)} ({100*len(wns_high)/max(len(onsets),1):.0f}%)')
    print(f'  ONSET with WNS < 0.01 (clean):     {len(wns_zero)} ({100*len(wns_zero)/max(len(onsets),1):.0f}%)')

    # ── FALSE POSITIVES profile ──
    print(f'\n  === FALSE POSITIVES (SnareE<0.1) profile ===')
    if snaree_low:
        for key in ['cFx', 'bFct', 'sEF', 'Res', 'Drive', 'Flux', 'WNS', 'UnG', 'BassE', 'BassDelta', 'k']:
            vals = [r[key] for r in snaree_low]
            print(f'    {key:10s}: median={statistics.median(vals):.4f} range=[{min(vals):.4f}-{max(vals):.4f}]')

    # ── REAL SNARES profile ──
    print(f'\n  === REAL SNARES (SnareE>0.3) profile ===')
    if snaree_high:
        for key in ['cFx', 'bFct', 'sEF', 'Res', 'Drive', 'Flux', 'WNS', 'UnG', 'BassE', 'BassDelta', 'k']:
            vals = [r[key] for r in snaree_high]
            print(f'    {key:10s}: median={statistics.median(vals):.4f} range=[{min(vals):.4f}-{max(vals):.4f}]')

    # ── sEF vs SnareE correlation ──
    print(f'\n  === sEF vs SnareE: does sEF track the gate? ===')
    if snaree_high and snaree_low:
        sef_real = [r['sEF'] for r in snaree_high]
        sef_false = [r['sEF'] for r in snaree_low]
        print(f'  SnareE>0.3 (real):     sEF median={statistics.median(sef_real):.3f} range=[{min(sef_real):.3f}-{max(sef_real):.3f}]')
        print(f'  SnareE<0.1 (false):    sEF median={statistics.median(sef_false):.3f} range=[{min(sef_false):.3f}-{max(sef_false):.3f}]')
        ratio = statistics.median(sef_real) / max(statistics.median(sef_false), 1e-6)
        print(f'  sEF separability real/false: {ratio:.2f}x')

    # ── Inter-onset intervals ──
    print(f'\n  === Inter-onset intervals ===')
    onset_lines = [r['line'] for r in onsets]
    intervals = [onset_lines[i+1]-onset_lines[i] for i in range(len(onset_lines)-1)]
    if intervals:
        print(f'  min={min(intervals)} max={max(intervals)} mean={statistics.mean(intervals):.1f} median={statistics.median(intervals):.1f}')
        ic = Counter(intervals)
        for k in sorted(ic.keys())[:15]:
            ms = k * 1000 / fps
            note = ''
            if bpm > 100:
                if 90 <= ms <= 130: note = '~ 1/16'
                elif 180 <= ms <= 260: note = '~ 1/8'
                elif 380 <= ms <= 520: note = '~ 1/4'
                elif 900 <= ms <= 1100: note = '~ 1/2'
            print(f'    {k:2d} frames ({ms:5.0f}ms): {"#"*min(ic[k],40)} ({ic[k]}) {note}')

    # ── Doubling analysis: what fraction of onsets are on kick beats? ──
    print(f'\n  === DOUBLING DEEP DIVE ===')
    # Check if onset_only (no kick) have different BassE pattern
    print(f'  ONSET-only ({len(onset_only)}): BassE median={statistics.median([r["BassE"] for r in onset_only]):.3f}')
    print(f'  ONSET+KICK ({len(both)}):      BassE median={statistics.median([r["BassE"] for r in both]):.3f}')
    print(f'  ONSET-only: BassDelta median={statistics.median([r["BassDelta"] for r in onset_only]):.4f}')
    print(f'  ONSET+KICK: BassDelta median={statistics.median([r["BassDelta"] for r in both]):.4f}')

    # Are the doubled onsets real snares that happen on kick beats?
    both_real = [r for r in both if r['SnareE'] > 0.3]
    both_fp   = [r for r in both if r['SnareE'] < 0.1]
    print(f'\n  ONSET+KICK split by SnareE:')
    print(f'    Real (SnareE>0.3): {len(both_real)} — genuine snares on kick beats')
    print(f'    FP (SnareE<0.1):   {len(both_fp)} — kick bleed triggering snare')
    if both_real:
        print(f'    Real doubled: sEF median={statistics.median([r["sEF"] for r in both_real]):.3f} Drive median={statistics.median([r["Drive"] for r in both_real]):.4f}')
    if both_fp:
        print(f'    FP doubled:   sEF median={statistics.median([r["sEF"] for r in both_fp]):.3f} Drive median={statistics.median([r["Drive"] for r in both_fp]):.4f}')

    # ── NLMS k analysis: is the bleed filter converging? ──
    print(f'\n  === NLMS bleed coefficient k ===')
    all_k = [r['k'] for r in rows]
    onset_k = [r['k'] for r in onsets]
    print(f'  k: min={min(all_k):.3f} max={max(all_k):.3f} median={statistics.median(all_k):.3f}')
    print(f'  k at onsets: median={statistics.median(onset_k):.3f}')
    print(f'  k at ONSET+KICK: median={statistics.median([r["k"] for r in both]):.3f}')
    print(f'  k at ONSET-only: median={statistics.median([r["k"] for r in onset_only]):.3f}')

    return rows

# ── Run ──
print('='*70)
print('  MINIMALVERSE 2 — Post-sEF Analysis')
print('='*70)
r = analyze('MINIMALVERSE 2', r'docs/4dcalib/nmls/minimalverse2.md', 124)

print(f'\n{"="*70}')
print(f'  CROSS-LOG EVOLUTION')
print(f'{"="*70}')
print(f'  Log 4 (pre-bFct):     112 onsets, 3.06/beat, 76 FP (77%), 14 real (0.38/beat)')
print(f'  Log 5 (brejcha+bFct): 104 onsets, 7.26/beat, 23 FP (22%), 55 real (3.84/beat)')
print(f'  Log S (synth+bFct):   89 onsets,  3.94/beat, 21 FP (24%), 44 real (1.95/beat)')
print(f'  Log V2 (minimal+sEF): see above')
