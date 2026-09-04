import re, statistics
from collections import Counter

def parse_log(path):
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    pat = re.compile(
        r'\[FINESSE_AUDIT\] SnareE:([\d.]+) UnG:([\d.]+) Raw\u0394:([\d.-]+) Flux:([\d.]+) '
        r'WNS:([\d.]+) fBL:([\d.]+) Gate:([\d.]+) Veto:([\d.]+) BassE:([\d.]+) '
        r'Bass\u0394:([\d.-]+) k:([\d.]+) Res:([\d.]+) cFx:([\d.]+) '
        r'bFct:([\d.]+) Drive:([\d.]+) OutSnare:([\d.]+) OutKick:([\d.]+)(.*)'
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
                'Drive': float(m.group(15)),
                'OutSnare': float(m.group(16)), 'OutKick': float(m.group(17)),
                'tags': m.group(18).strip(),
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
    print(f'  [KICK]:  {len(kicks)}')
    print(f'  [ONSET]+[KICK]: {len(both)} ({100*len(both)/max(len(onsets),1):.0f}% de onsets)')
    print(f'  [ONSET] only: {len(onset_only)}')

    # ── bFct analysis ──
    print(f'\n  === bFct (Body Factor) distribution ===')
    onset_bfct = [r['bFct'] for r in onsets]
    non_bfct   = [r['bFct'] for r in non]
    print(f'  ONSET bFct: min={min(onset_bfct):.3f} max={max(onset_bfct):.3f} median={statistics.median(onset_bfct):.3f} mean={statistics.mean(onset_bfct):.3f}')
    print(f'  NON   bFct: min={min(non_bfct):.3f} max={max(non_bfct):.3f} median={statistics.median(non_bfct):.3f} mean={statistics.mean(non_bfct):.3f}')

    # bFct histogram for onsets
    bfct_buckets = [(0.1, 0.3), (0.3, 0.5), (0.5, 0.8), (0.8, 1.0), (1.0, 1.5), (1.5, 2.0), (2.0, 2.01)]
    print(f'  ONSET bFct histogram:')
    for lo, hi in bfct_buckets:
        c = sum(1 for b in onset_bfct if lo <= b < hi)
        label = f'{lo:.1f}-{hi:.1f}' if hi <= 2.0 else '2.0 (cap)'
        print(f'    {label:12s}: {"#"*min(c,60)} ({c})')

    # ── SnareE gate analysis ──
    print(f'\n  === SnareE gate vs MACD ===')
    snaree_high = [r for r in onset_only if r['SnareE'] > 0.3]
    snaree_mid  = [r for r in onset_only if 0.1 <= r['SnareE'] <= 0.3]
    snaree_low  = [r for r in onset_only if r['SnareE'] < 0.1]
    print(f'  SnareE > 0.3 (gate AGREE):   {len(snaree_high)} ({len(snaree_high)/beats:.2f}/beat)')
    print(f'  SnareE 0.1-0.3 (partial):    {len(snaree_mid)} ({len(snaree_mid)/beats:.2f}/beat)')
    print(f'  SnareE < 0.1 (gate DISAGREE):{len(snaree_low)} ({len(snaree_low)/beats:.2f}/beat)')

    # ── Separabilidad ──
    def sep(key):
        o = [r[key] for r in onsets]
        n = [r[key] for r in non]
        return statistics.median(o) / max(statistics.median(n), 1e-6), statistics.median(o), statistics.median(n)

    print(f'\n  === Separabilidad (onset median / non median) ===')
    for key in ['UnG', 'Flux', 'Res', 'cFx', 'bFct', 'Drive']:
        s, om, nm = sep(key)
        print(f'    {key:8s}: {s:.2f}x  (onset={om:.4f}, non={nm:.4f})')

    # ── WNS analysis (synth contamination indicator) ──
    print(f'\n  === WNS (White Noise Score) — synth contamination ===')
    onset_wns = [r['WNS'] for r in onsets]
    non_wns   = [r['WNS'] for r in non]
    print(f'  ONSET WNS: min={min(onset_wns):.3f} max={max(onset_wns):.3f} median={statistics.median(onset_wns):.3f} mean={statistics.mean(onset_wns):.3f}')
    print(f'  NON   WNS: min={min(non_wns):.3f} max={max(non_wns):.3f} median={statistics.median(non_wns):.3f} mean={statistics.mean(non_wns):.3f}')
    wns_high = [r for r in onsets if r['WNS'] > 0.1]
    wns_zero = [r for r in onsets if r['WNS'] < 0.01]
    print(f'  ONSET with WNS > 0.1 (synth-like): {len(wns_high)} ({100*len(wns_high)/max(len(onsets),1):.0f}%)')
    print(f'  ONSET with WNS < 0.01 (clean):     {len(wns_zero)} ({100*len(wns_zero)/max(len(onsets),1):.0f}%)')

    # ── Profile: synth-contaminated onsets vs clean onsets ──
    print(f'\n  === Profile: WNS>0.1 (synth) vs WNS<0.01 (clean) ===')
    if wns_high and wns_zero:
        for key in ['cFx', 'bFct', 'Res', 'Drive', 'Flux', 'UnG', 'SnareE']:
            synth_vals = [r[key] for r in wns_high]
            clean_vals = [r[key] for r in wns_zero]
            ratio = statistics.median(clean_vals) / max(statistics.median(synth_vals), 1e-6)
            print(f'    {key:8s}: synth={statistics.median(synth_vals):.4f} clean={statistics.median(clean_vals):.4f} ratio={ratio:.2f}x')

    # ── bFct vs SnareE correlation ──
    print(f'\n  === bFct vs SnareE: does bFct track the gate? ===')
    if snaree_high and snaree_low:
        bfct_real = [r['bFct'] for r in snaree_high]
        bfct_false = [r['bFct'] for r in snaree_low]
        print(f'  SnareE>0.3 (real):     bFct median={statistics.median(bfct_real):.3f} range=[{min(bfct_real):.3f}-{max(bfct_real):.3f}]')
        print(f'  SnareE<0.1 (false):    bFct median={statistics.median(bfct_false):.3f} range=[{min(bfct_false):.3f}-{max(bfct_false):.3f}]')
        ratio = statistics.median(bfct_real) / max(statistics.median(bfct_false), 1e-6)
        print(f'  bFct separability real/false: {ratio:.2f}x')

    # ── Drive histogram ──
    print(f'\n  === DRIVE histogram ===')
    onset_drives = [r['Drive'] for r in onsets]
    non_drives   = [r['Drive'] for r in non]
    def hist(vals, label, lo=0, hi=0.30, step=0.03):
        buckets = []
        v = lo
        while v < hi:
            buckets.append((v, v+step))
            v += step
        c = [0]*len(buckets)
        for val in vals:
            for j,(a,b) in enumerate(buckets):
                if a <= val < b:
                    c[j] += 1
                    break
        print(f'  {label}:')
        for j,(a,b) in enumerate(buckets):
            print(f'    {a:.3f}-{b:.3f}: {"#"*min(c[j],60)} ({c[j]})')
    hist(onset_drives, 'ONSET Drive')
    hist(non_drives, 'NON Drive')

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
            else:
                if 180 <= ms <= 260: note = '~ 1/16 @64bpm'
                elif 380 <= ms <= 520: note = '~ 1/8 @64bpm'
                elif 800 <= ms <= 1000: note = '~ 1/4 @64bpm'
            print(f'    {k:2d} frames ({ms:5.0f}ms): {"#"*min(ic[k],40)} ({ic[k]}) {note}')

    # ── ONSET+KICK ──
    print(f'\n  === ONSET+KICK ({len(both)}) ===')
    for r in both:
        ratio = r['cFx']/max(r['Flux'],1e-6)
        print(f'    L{r["line"]}: D={r["Drive"]:.4f} R={r["Res"]:.4f} cFx={r["cFx"]:.3f} bFct={r["bFct"]:.3f} Flux={r["Flux"]:.3f} ratio={ratio:.2f} BassD={r["BassDelta"]:.4f} SnareE={r["SnareE"]:.3f}')

    # ── The key question: what are the false positives? ──
    print(f'\n  === FALSE POSITIVES (SnareE<0.1) profile ===')
    if snaree_low:
        for key in ['cFx', 'bFct', 'Res', 'Drive', 'Flux', 'WNS', 'UnG', 'BassE']:
            vals = [r[key] for r in snaree_low]
            print(f'    {key:8s}: median={statistics.median(vals):.4f} range=[{min(vals):.4f}-{max(vals):.4f}]')
        # WNS breakdown of false positives
        fp_wns_high = [r for r in snaree_low if r['WNS'] > 0.1]
        fp_wns_low  = [r for r in snaree_low if r['WNS'] < 0.01]
        print(f'    FP with WNS>0.1 (synth noise): {len(fp_wns_high)} ({100*len(fp_wns_high)/max(len(snaree_low),1):.0f}%)')
        print(f'    FP with WNS<0.01 (no synth):   {len(fp_wns_low)} ({100*len(fp_wns_low)/max(len(snaree_low),1):.0f}%)')

    # ── REAL SNARES (SnareE>0.3) profile ──
    print(f'\n  === REAL SNARES (SnareE>0.3) profile ===')
    if snaree_high:
        for key in ['cFx', 'bFct', 'Res', 'Drive', 'Flux', 'WNS', 'UnG', 'BassE']:
            vals = [r[key] for r in snaree_high]
            print(f'    {key:8s}: median={statistics.median(vals):.4f} range=[{min(vals):.4f}-{max(vals):.4f}]')
        rs_wns_high = [r for r in snaree_high if r['WNS'] > 0.1]
        rs_wns_low  = [r for r in snaree_high if r['WNS'] < 0.01]
        print(f'    Real with WNS>0.1 (synth noise): {len(rs_wns_high)} ({100*len(rs_wns_high)/max(len(snaree_high),1):.0f}%)')
        print(f'    Real with WNS<0.01 (clean):      {len(rs_wns_low)} ({100*len(rs_wns_low)/max(len(snaree_high),1):.0f}%)')

    return rows

# ── Run both ──
print('='*70)
print('  BREJCHAVERSE 5 vs MINIMAL SYNTH — Post-BodyFactor Analysis')
print('='*70)

r5 = analyze('BREJCHAVERSE 5', r'docs/4dcalib/nmls/brejchaverse5.md', 64)
rs = analyze('MINIMAL SYNTH', r'docs/4dcalib/nmls/minimalsynth.md', 121)

# ── Cross-log comparison ──
print(f'\n{"="*70}')
print(f'  CROSS-LOG COMPARISON')
print(f'{"="*70}')
print(f'  Log 4 (pre-bFct): 112 onsets, 3.06/beat, 76 FP (77%), 14 real (0.38/beat)')
print(f'  Log 5 (brejcha):  see above')
print(f'  Log S (synth):    see above')
