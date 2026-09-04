import re, statistics

path = r'docs/4dcalib/nmls/brejchaverse4.md'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

pat = re.compile(
    r'\[FINESSE_AUDIT\] SnareE:([\d.]+) UnG:([\d.]+) Raw\u0394:([\d.-]+) Flux:([\d.]+) '
    r'WNS:([\d.]+) fBL:([\d.]+) Gate:([\d.]+) Veto:([\d.]+) BassE:([\d.]+) '
    r'Bass\u0394:([\d.-]+) k:([\d.]+) Res:([\d.]+) cFx:([\d.]+) '
    r'Drive:([\d.]+) OutSnare:([\d.]+) OutKick:([\d.]+)(.*)'
)

rows = []
for i, line in enumerate(lines):
    m = pat.search(line.strip())
    if m:
        rows.append({
            'line': i+1,
            'SnareE': float(m.group(1)), 'UnG': float(m.group(2)),
            'Flux': float(m.group(4)), 'BassE': float(m.group(9)),
            'BassDelta': float(m.group(10)), 'k': float(m.group(11)),
            'Res': float(m.group(12)), 'cFx': float(m.group(13)),
            'Drive': float(m.group(14)),
            'tags': m.group(17).strip(),
        })

onsets = [r for r in rows if '[ONSET]' in r['tags']]
both   = [r for r in rows if '[ONSET]' in r['tags'] and '[KICK]' in r['tags']]
onset_only = [r for r in onsets if r not in both]

# SnareE gate analysis
print('=== SnareE (gated) vs MACD onset detection ===')
print()

snaree_high = [r for r in onset_only if r['SnareE'] > 0.3]
snaree_mid  = [r for r in onset_only if 0.1 <= r['SnareE'] <= 0.3]
snaree_low  = [r for r in onset_only if r['SnareE'] < 0.1]

print(f'ONSET ONLY ({len(onset_only)}):')
print(f'  SnareE > 0.3  (gate AGREES):   {len(snaree_high)}  -- likely real snares')
print(f'  SnareE 0.1-0.3 (gate partial):  {len(snaree_mid)}  -- ambiguous')
print(f'  SnareE < 0.1  (gate DISAGREES): {len(snaree_low)}  -- likely false positives')
print()

# Rate with gate filter
total_frames = len(rows)
fps = 44
duration_s = total_frames / fps
bpm = 127
beats = duration_s * bpm / 60
print(f'=== ONSET RATE with gate filter ===')
print(f'  Total onsets: {len(onsets)} ({len(onsets)/beats:.2f}/beat)')
print(f'  Gate agrees (SnareE>0.3): {len(snaree_high)} ({len(snaree_high)/beats:.2f}/beat)')
print(f'  Gate partial (0.1-0.3): {len(snaree_mid)} ({len(snaree_mid)/beats:.2f}/beat)')
print(f'  Gate disagrees (<0.1): {len(snaree_low)} ({len(snaree_low)/beats:.2f}/beat)')
print(f'  Expected: 1-2/beat')
print()

# Profile comparison
print('=== FALSE POSITIVE profile (SnareE<0.1) ===')
if snaree_low:
    cfx_vals = [r['cFx'] for r in snaree_low]
    flux_vals = [r['Flux'] for r in snaree_low]
    ung_vals = [r['UnG'] for r in snaree_low]
    res_vals = [r['Res'] for r in snaree_low]
    drive_vals = [r['Drive'] for r in snaree_low]
    print(f'  cFx:   median={statistics.median(cfx_vals):.3f} range=[{min(cfx_vals):.3f}-{max(cfx_vals):.3f}]')
    print(f'  Flux:  median={statistics.median(flux_vals):.3f} range=[{min(flux_vals):.3f}-{max(flux_vals):.3f}]')
    print(f'  UnG:   median={statistics.median(ung_vals):.3f} range=[{min(ung_vals):.3f}-{max(ung_vals):.3f}]')
    print(f'  Res:   median={statistics.median(res_vals):.3f} range=[{min(res_vals):.3f}-{max(res_vals):.3f}]')
    print(f'  Drive: median={statistics.median(drive_vals):.3f} range=[{min(drive_vals):.3f}-{max(drive_vals):.3f}]')
print()

print('=== REAL SNARE profile (SnareE>0.3) ===')
if snaree_high:
    cfx_vals = [r['cFx'] for r in snaree_high]
    flux_vals = [r['Flux'] for r in snaree_high]
    ung_vals = [r['UnG'] for r in snaree_high]
    res_vals = [r['Res'] for r in snaree_high]
    drive_vals = [r['Drive'] for r in snaree_high]
    print(f'  cFx:   median={statistics.median(cfx_vals):.3f} range=[{min(cfx_vals):.3f}-{max(cfx_vals):.3f}]')
    print(f'  Flux:  median={statistics.median(flux_vals):.3f} range=[{min(flux_vals):.3f}-{max(flux_vals):.3f}]')
    print(f'  UnG:   median={statistics.median(ung_vals):.3f} range=[{min(ung_vals):.3f}-{max(ung_vals):.3f}]')
    print(f'  Res:   median={statistics.median(res_vals):.3f} range=[{min(res_vals):.3f}-{max(res_vals):.3f}]')
    print(f'  Drive: median={statistics.median(drive_vals):.3f} range=[{min(drive_vals):.3f}-{max(drive_vals):.3f}]')
print()

# Separability between real snares and false positives
print('=== SEPARABILITY: real (SnareE>0.3) vs false (SnareE<0.1) ===')
if snaree_high and snaree_low:
    for key in ['cFx', 'Flux', 'UnG', 'Res', 'Drive']:
        real_vals = [r[key] for r in snaree_high]
        false_vals = [r[key] for r in snaree_low]
        ratio = statistics.median(real_vals) / max(statistics.median(false_vals), 1e-6)
        print(f'  {key:8s}: real={statistics.median(real_vals):.4f} false={statistics.median(false_vals):.4f} ratio={ratio:.2f}x')
print()

# The key question: can ANY combination of available metrics separate real from false?
print('=== MULTI-VARIATE: can we separate real from false? ===')
if snaree_high and snaree_low:
    # Try UnG threshold
    ung_thresholds = [0.25, 0.30, 0.35, 0.40]
    for t in ung_thresholds:
        real_pass = sum(1 for r in snaree_high if r['UnG'] > t)
        false_pass = sum(1 for r in snaree_low if r['UnG'] > t)
        print(f'  UnG > {t}: real={real_pass}/{len(snaree_high)} false={false_pass}/{len(snaree_low)}')

    print()
    # Try Drive threshold
    drive_thresholds = [0.03, 0.04, 0.05, 0.06, 0.07, 0.08]
    for t in drive_thresholds:
        real_pass = sum(1 for r in snaree_high if r['Drive'] > t)
        false_pass = sum(1 for r in snaree_low if r['Drive'] > t)
        print(f'  Drive > {t:.3f}: real={real_pass}/{len(snaree_high)} false={false_pass}/{len(snaree_low)}')

    print()
    # Try cFx threshold
    cfx_thresholds = [0.20, 0.25, 0.30, 0.35]
    for t in cfx_thresholds:
        real_pass = sum(1 for r in snaree_high if r['cFx'] > t)
        false_pass = sum(1 for r in snaree_low if r['cFx'] > t)
        print(f'  cFx > {t}: real={real_pass}/{len(snaree_high)} false={false_pass}/{len(snaree_low)}')
