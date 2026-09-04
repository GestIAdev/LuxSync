import re, statistics

path = r'docs/4dcalib/nmls/brejchaverse3.md'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

pat = re.compile(
    r'\[FINESSE_AUDIT\] SnareE:([\d.]+) UnG:([\d.]+) RawΔ:([\d.-]+) Flux:([\d.]+) '
    r'WNS:([\d.]+) fBL:([\d.]+) Gate:([\d.]+) Veto:([\d.]+) BassE:([\d.]+) '
    r'BassΔ:([\d.-]+) k:([\d.]+) Res:([\d.]+) cFx:([\d.]+) '
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

# SnareE analysis: does the gate agree with the MACD?
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

print('=== SnareE > 0.3 (gate agrees = real snares) ===')
for r in sorted(snaree_high, key=lambda x: x['line']):
    ratio = r['cFx']/max(r['Flux'],1e-6)
    print(f'  L{r["line"]}: SnareE={r["SnareE"]:.3f} D={r["Drive"]:.4f} cFx={r["cFx"]:.3f} Flux={r["Flux"]:.3f} ratio={ratio:.2f} UnG={r["UnG"]:.3f}')
print()

print('=== SnareE < 0.1 (gate disagrees = likely false positives) ===')
for r in sorted(snaree_low, key=lambda x: x['line']):
    ratio = r['cFx']/max(r['Flux'],1e-6)
    print(f'  L{r["line"]}: SnareE={r["SnareE"]:.3f} D={r["Drive"]:.4f} cFx={r["cFx"]:.3f} Flux={r["Flux"]:.3f} ratio={ratio:.2f} UnG={r["UnG"]:.3f} BassE={r["BassE"]:.3f}')
print()

# Rate with gate agreement
total_frames = len(rows)
fps = 44
duration_s = total_frames / fps
bpm = 129
beats = duration_s * bpm / 60
print(f'=== ONSET RATE with gate filter ===')
print(f'  Total onsets: {len(onsets)} ({len(onsets)/beats:.2f}/beat)')
print(f'  Gate agrees (SnareE>0.3): {len(snaree_high)} ({len(snaree_high)/beats:.2f}/beat)')
print(f'  Gate disagrees (SnareE<0.1): {len(snaree_low)} ({len(snaree_low)/beats:.2f}/beat)')
print(f'  Expected: 1-2/beat')
print()

# Cross-check: what do the false positives (SnareE<0.1) look like?
print('=== FALSE POSITIVE profile (SnareE<0.1) ===')
if snaree_low:
    cfx_vals = [r['cFx'] for r in snaree_low]
    flux_vals = [r['Flux'] for r in snaree_low]
    ung_vals = [r['UnG'] for r in snaree_low]
    res_vals = [r['Res'] for r in snaree_low]
    print(f'  cFx:  median={statistics.median(cfx_vals):.3f} range=[{min(cfx_vals):.3f}-{max(cfx_vals):.3f}]')
    print(f'  Flux: median={statistics.median(flux_vals):.3f} range=[{min(flux_vals):.3f}-{max(flux_vals):.3f}]')
    print(f'  UnG:  median={statistics.median(ung_vals):.3f} range=[{min(ung_vals):.3f}-{max(ung_vals):.3f}]')
    print(f'  Res:  median={statistics.median(res_vals):.3f} range=[{min(res_vals):.3f}-{max(res_vals):.3f}]')
print()

# Cross-check: what do the real snares (SnareE>0.3) look like?
print('=== REAL SNARE profile (SnareE>0.3) ===')
if snaree_high:
    cfx_vals = [r['cFx'] for r in snaree_high]
    flux_vals = [r['Flux'] for r in snaree_high]
    ung_vals = [r['UnG'] for r in snaree_high]
    res_vals = [r['Res'] for r in snaree_high]
    print(f'  cFx:  median={statistics.median(cfx_vals):.3f} range=[{min(cfx_vals):.3f}-{max(cfx_vals):.3f}]')
    print(f'  Flux: median={statistics.median(flux_vals):.3f} range=[{min(flux_vals):.3f}-{max(flux_vals):.3f}]')
    print(f'  UnG:  median={statistics.median(ung_vals):.3f} range=[{min(ung_vals):.3f}-{max(ung_vals):.3f}]')
    print(f'  Res:  median={statistics.median(res_vals):.3f} range=[{min(res_vals):.3f}-{max(res_vals):.3f}]')
