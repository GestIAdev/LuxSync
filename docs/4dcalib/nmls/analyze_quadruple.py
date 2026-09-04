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

    real = [r for r in onset_only if r['SnareE'] > 0.3]
    partial = [r for r in onset_only if 0.1 <= r['SnareE'] <= 0.3]
    fp = [r for r in onset_only if r['SnareE'] < 0.1]

    # Double-triggers
    onset_lines = [r['line'] for r in onsets]
    intervals = [onset_lines[i+1]-onset_lines[i] for i in range(len(onset_lines)-1)]
    doubles = sum(1 for iv in intervals if iv < 6)

    # SnareE distribution across ALL frames
    all_snaree = [r['SnareE'] for r in rows]
    snaree_zero = sum(1 for s in all_snaree if s < 0.01)
    snaree_low = sum(1 for s in all_snaree if 0.01 <= s < 0.1)
    snaree_mid = sum(1 for s in all_snaree if 0.1 <= s < 0.3)
    snaree_high = sum(1 for s in all_snaree if s >= 0.3)

    # k (NLMS bleed)
    all_k = [r['k'] for r in rows]

    # BassE
    all_bass = [r['BassE'] for r in rows]

    # WNS
    all_wns = [r['WNS'] for r in rows]
    wns_high_frames = sum(1 for w in all_wns if w > 0.1)

    # fBL
    all_fbl = [r['fBL'] for r in rows]

    print(f'\n{"="*70}')
    print(f'  {name} (bpm={bpm})')
    print(f'{"="*70}')
    print(f'  Frames: {len(rows)}, Duration: {len(rows)/fps:.1f}s, Beats: {beats:.1f}')
    print(f'  [ONSET]: {len(onsets)} ({len(onsets)/beats:.2f}/beat)')
    print(f'  [KICK]:  {len(kicks)} ({len(kicks)/beats:.2f}/beat)')
    print(f'  [ONSET]+[KICK]: {len(both)} ({100*len(both)/max(len(onsets),1):.0f}%)')
    print(f'  Double-triggers (<6f): {doubles}')
    print(f'  After removing doubles: ~{len(onsets)-doubles} ({(len(onsets)-doubles)/beats:.2f}/beat)')

    print(f'\n  SnareE classification:')
    print(f'    Real (>0.3):   {len(real)} ({len(real)/beats:.2f}/beat)')
    print(f'    Partial (0.1-0.3): {len(partial)} ({len(partial)/beats:.2f}/beat)')
    print(f'    FP (<0.1):     {len(fp)} ({len(fp)/beats:.2f}/beat)')

    print(f'\n  SnareE distribution (ALL frames):')
    print(f'    SnareE < 0.01 (zero):    {snaree_zero:4d} ({100*snaree_zero/len(rows):.0f}%)')
    print(f'    SnareE 0.01-0.1 (low):   {snaree_low:4d} ({100*snaree_low/len(rows):.0f}%)')
    print(f'    SnareE 0.1-0.3 (mid):    {snaree_mid:4d} ({100*snaree_mid/len(rows):.0f}%)')
    print(f'    SnareE >= 0.3 (high):    {snaree_high:4d} ({100*snaree_high/len(rows):.0f}%)')

    print(f'\n  Key metrics (ALL frames median):')
    print(f'    SnareE:  {statistics.median(all_snaree):.4f}  (range {min(all_snaree):.3f}-{max(all_snaree):.3f})')
    print(f'    BassE:   {statistics.median(all_bass):.4f}  (range {min(all_bass):.3f}-{max(all_bass):.3f})')
    print(f'    k:       {statistics.median(all_k):.4f}  (range {min(all_k):.3f}-{max(all_k):.3f})')
    print(f'    fBL:     {statistics.median(all_fbl):.4f}  (range {min(all_fbl):.3f}-{max(all_fbl):.3f})')
    print(f'    WNS:     {statistics.median(all_wns):.4f}  (frames WNS>0.1: {wns_high_frames} = {100*wns_high_frames/len(rows):.0f}%)')

    if onsets:
        print(f'\n  ONSET profile (median):')
        for key in ['SnareE', 'sEF', 'bFct', 'Drive', 'Res', 'cFx', 'Flux', 'WNS', 'BassE', 'k', 'Veto']:
            vals = [r[key] for r in onsets]
            print(f'    {key:8s}: {statistics.median(vals):.4f}')

    # For djtiesto: show the few onsets that DO fire
    if len(onsets) <= 5 and onsets:
        print(f'\n  === ALL ONSETS (rare in this log) ===')
        for r in onsets:
            print(f'    L{r["line"]}: SnareE={r["SnareE"]:.3f} sEF={r["sEF"]:.3f} bFct={r["bFct"]:.3f} '
                  f'Drive={r["Drive"]:.4f} Res={r["Res"]:.4f} cFx={r["cFx"]:.3f} '
                  f'Flux={r["Flux"]:.3f} WNS={r["WNS"]:.3f} BassE={r["BassE"]:.3f} tags={r["tags"]}')

    # For basssynth: show FPs
    if fp and len(fp) <= 10:
        print(f'\n  === FALSE POSITIVES (SnareE<0.1) ===')
        for r in fp:
            print(f'    L{r["line"]}: SnareE={r["SnareE"]:.3f} sEF={r["sEF"]:.3f} bFct={r["bFct"]:.3f} '
                  f'Drive={r["Drive"]:.4f} Res={r["Res"]:.4f} cFx={r["cFx"]:.3f} '
                  f'Flux={r["Flux"]:.3f} WNS={r["WNS"]:.3f} BassE={r["BassE"]:.3f} k={r["k"]:.3f}')

    # For caos: show all onsets
    if name == 'BREJCHA 6 CAOS':
        print(f'\n  === ALL ONSETS ===')
        for r in onsets:
            tag = 'BOTH' if '[KICK]' in r['tags'] else 'ONSET'
            print(f'    L{r["line"]:4d}: SnareE={r["SnareE"]:.3f} sEF={r["sEF"]:.3f} bFct={r["bFct"]:.3f} '
                  f'Drive={r["Drive"]:.4f} Res={r["Res"]:.4f} cFx={r["cFx"]:.3f} '
                  f'Flux={r["Flux"]:.3f} WNS={r["WNS"]:.3f} BassE={r["BassE"]:.3f} [{tag}]')

    return {
        'name': name, 'rows': len(rows), 'beats': beats, 'bpm': bpm,
        'onsets': len(onsets), 'kicks': len(kicks), 'both': len(both),
        'doubles': doubles, 'real': len(real), 'partial': len(partial), 'fp': len(fp),
        'snaree_median': statistics.median(all_snaree),
        'bass_median': statistics.median(all_bass),
        'k_median': statistics.median(all_k),
        'fbl_median': statistics.median(all_fbl),
        'wns_pct': 100*wns_high_frames/len(rows),
        'snaree_zero_pct': 100*snaree_zero/len(rows),
        'snaree_high_pct': 100*snaree_high/len(rows),
        'onset_drive_median': statistics.median([r['Drive'] for r in onsets]) if onsets else 0,
        'onset_sef_median': statistics.median([r['sEF'] for r in onsets]) if onsets else 0,
        'onset_snaree_median': statistics.median([r['SnareE'] for r in onsets]) if onsets else 0,
    }

# ── Run all 4 ──
print('='*70)
print('  QUADRUPLE LOG ANALYSIS — 4 Textures of Techno')
print('='*70)

results = []
results.append(analyze('MINIMAL 3 (clear snare)', r'docs/4dcalib/nmls/minimalverse3.md', 120))
results.append(analyze('MINIMAL 4 (bass synth)', r'docs/4dcalib/nmls/minimalverse4basssynth.md', 124))
results.append(analyze('BREJCHA 6 CAOS', r'docs/4dcalib/nmls/brejchaverse6caos.md', 128))
results.append(analyze('DJ TIESTO 1 (dead snare)', r'docs/4dcalib/nmls/djtiesto1.md', 136))

# ── Cross-comparison table ──
print(f'\n{"="*70}')
print(f'  CROSS-LOG COMPARISON TABLE')
print(f'{"="*70}')

headers = ['Metric', 'MIN 3', 'MIN 4', 'BRJ 6', 'TIESTO']
keys = [
    ('bpm', 'bpm'),
    ('beats', 'beats'),
    ('onsets', 'onsets'),
    ('onsets/beat', 'onsets_per_beat'),
    ('doubles', 'doubles'),
    ('real', 'real'),
    ('partial', 'partial'),
    ('fp', 'fp'),
    ('SnareE med', 'snaree_median'),
    ('SnareE 0% ', 'snaree_zero_pct'),
    ('SnareE hi%', 'snaree_high_pct'),
    ('BassE med', 'bass_median'),
    ('k med', 'k_median'),
    ('fBL med', 'fbl_median'),
    ('WNS>0.1 %', 'wns_pct'),
    ('Drive med', 'onset_drive_median'),
    ('sEF med', 'onset_sef_median'),
]

for label, key in keys:
    vals = []
    for r in results:
        if r is None:
            vals.append('N/A')
            continue
        if key == 'onsets_per_beat':
            vals.append(f'{r["onsets"]/r["beats"]:.2f}')
        elif 'pct' in key:
            vals.append(f'{r[key]:.0f}%')
        elif 'med' in key:
            vals.append(f'{r[key]:.3f}')
        else:
            vals.append(f'{r[key]:.1f}' if isinstance(r[key], float) else str(r[key]))
    print(f'  {label:15s} {vals[0]:>10s} {vals[1]:>10s} {vals[2]:>10s} {vals[3]:>10s}')

# ── Diagnosis per log ──
print(f'\n{"="*70}')
print(f'  DIAGNOSIS')
print(f'{"="*70}')
print(f'''
  MINIMAL 3 (clear snare, 120bpm):
    - Good onset rate, low FP
    - This is the "working" baseline

  MINIMAL 4 (bass synth contamination):
    - Bass synth bleeds into crack band
    - k (NLMS) may not converge fast enough
    - Check if FPs have high BassE + high k

  BREJCHA 6 (caos, live hihats):
    - Live hihats flood the crack band (2-5kHz)
    - High Flux from continuous percussion
    - k may over-adapt to hihat bleed

  DJ TIESTO (dead snare, 136bpm):
    - SnareE = 0 across almost ALL frames
    - The GodEarFFT gate is SHUT — body AND crack
      never exceed 2.0x and 1.8x EMA simultaneously
    - This track has NO acoustic snare, or the snare
      is synthesized without body resonance (150-250Hz)
    - sEF = 0.05 (floor) → Drive = 0 → no crossings
    - The detector is CORRECT: there is nothing to detect
''')
