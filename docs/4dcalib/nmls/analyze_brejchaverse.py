import re, statistics

path = r'docs/4dcalib/nmls/brejchaverse.md'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

pat = re.compile(
    r'\[FINESSE_AUDIT\] SnareE:([\d.]+) UnG:([\d.]+) RawΔ:([\d.-]+) Flux:([\d.]+) '
    r'WNS:([\d.]+) fBL:([\d.]+) Gate:([\d.]+) Veto:([\d.]+) BassE:([\d.]+) '
    r'BassΔ:([\d.-]+) k:([\d.]+) Res:([\d.]+) Flat:([\d.]+) Drive:([\d.]+) '
    r'OutSnare:([\d.]+) OutKick:([\d.]+)(.*)'
)

rows = []
for i, line in enumerate(lines):
    m = pat.search(line.strip())
    if m:
        rows.append({
            'line': i+1,
            'SnareE': float(m.group(1)),
            'UnG': float(m.group(2)),
            'RawDelta': float(m.group(3)),
            'Flux': float(m.group(4)),
            'WNS': float(m.group(5)),
            'fBL': float(m.group(6)),
            'Gate': float(m.group(7)),
            'Veto': float(m.group(8)),
            'BassE': float(m.group(9)),
            'BassDelta': float(m.group(10)),
            'k': float(m.group(11)),
            'Res': float(m.group(12)),
            'Flat': float(m.group(13)),
            'Drive': float(m.group(14)),
            'OutSnare': float(m.group(15)),
            'OutKick': float(m.group(16)),
            'tags': m.group(17).strip(),
        })

print(f'Total FINESSE_AUDIT lines: {len(rows)}')
print()

onsets = [r for r in rows if '[ONSET]' in r['tags']]
kicks  = [r for r in rows if '[KICK]' in r['tags']]
both   = [r for r in rows if '[ONSET]' in r['tags'] and '[KICK]' in r['tags']]
neither= [r for r in rows if '[ONSET]' not in r['tags'] and '[KICK]' not in r['tags']]

print(f'[ONSET] (snare):  {len(onsets)}')
print(f'[KICK]:           {len(kicks)}')
print(f'[ONSET]+[KICK]:   {len(both)}')
print(f'Neither:          {len(neither)}')
print()

onset_drives = [r['Drive'] for r in onsets]
non_drives   = [r['Drive'] for r in rows if '[ONSET]' not in r['tags']]

print('=== DRIVE distribution ===')
print(f'ONSET  Drive: min={min(onset_drives):.3f} max={max(onset_drives):.3f} mean={statistics.mean(onset_drives):.3f} median={statistics.median(onset_drives):.3f}')
print(f'NON    Drive: min={min(non_drives):.3f} max={max(non_drives):.3f} mean={statistics.mean(non_drives):.3f} median={statistics.median(non_drives):.3f}')
print()

onset_flats = [r['Flat'] for r in onsets]
non_flats   = [r['Flat'] for r in rows if '[ONSET]' not in r['tags']]
print('=== FLAT distribution ===')
print(f'ONSET  Flat: min={min(onset_flats):.3f} max={max(onset_flats):.3f} mean={statistics.mean(onset_flats):.3f} median={statistics.median(onset_flats):.3f}')
print(f'NON    Flat: min={min(non_flats):.3f} max={max(non_flats):.3f} mean={statistics.mean(non_flats):.3f} median={statistics.median(non_flats):.3f}')
print()

onset_res = [r['Res'] for r in onsets]
non_res   = [r['Res'] for r in rows if '[ONSET]' not in r['tags']]
print('=== RES distribution ===')
print(f'ONSET  Res: min={min(onset_res):.3f} max={max(onset_res):.3f} mean={statistics.mean(onset_res):.3f} median={statistics.median(onset_res):.3f}')
print(f'NON    Res: min={min(non_res):.3f} max={max(non_res):.3f} mean={statistics.mean(non_res):.3f} median={statistics.median(non_res):.3f}')
print()

ks = [r['k'] for r in rows]
print('=== k evolution ===')
print(f'k: start={ks[0]:.3f} end={ks[-1]:.3f} min={min(ks):.3f} max={max(ks):.3f} mean={statistics.mean(ks):.3f}')
print()

# Separability: ratio of onset median to non-onset median
sep_drive = statistics.median(onset_drives) / max(statistics.median(non_drives), 1e-6)
sep_res   = statistics.median(onset_res)   / max(statistics.median(non_res), 1e-6)
sep_flat  = statistics.median(onset_flats) / max(statistics.median(non_flats), 1e-6)
print('=== SEPARABILITY (onset median / non-onset median) ===')
print(f'Drive: {sep_drive:.2f}x')
print(f'Res:   {sep_res:.2f}x')
print(f'Flat:  {sep_flat:.2f}x')
print()

# OutSnare for onsets
onset_outs = [r['OutSnare'] for r in onsets]
full_onsets = [r for r in onsets if r['OutSnare'] >= 0.999]
print(f'=== OutSnare for ONSETs ===')
print(f'min={min(onset_outs):.3f} max={max(onset_outs):.3f} mean={statistics.mean(onset_outs):.3f}')
print(f'OutSnare=1.0: {len(full_onsets)}/{len(onsets)}')
print()

# High-drive non-onsets (potential missed detections or MACD not firing)
high_drive_non = [r for r in rows if '[ONSET]' not in r['tags'] and r['Drive'] > 0.08]
print(f'=== NON-ONSET with Drive>0.08: {len(high_drive_non)} ===')
for r in high_drive_non[:20]:
    print(f'  L{r["line"]}: D={r["Drive"]:.3f} R={r["Res"]:.3f} F={r["Flat"]:.3f} UnG={r["UnG"]:.3f} Flux={r["Flux"]:.3f} OutS={r["OutSnare"]:.3f} tags=[{r["tags"]}]')
print()

# Onsets with low drive (potential false positives)
low_drive_onset = [r for r in onsets if r['Drive'] < 0.07]
print(f'=== ONSET with Drive<0.07 (weak triggers): {len(low_drive_onset)} ===')
for r in low_drive_onset[:20]:
    print(f'  L{r["line"]}: D={r["Drive"]:.3f} R={r["Res"]:.3f} F={r["Flat"]:.3f} UnG={r["UnG"]:.3f} Flux={r["Flux"]:.3f} OutS={r["OutSnare"]:.3f} tags=[{r["tags"]}]')
print()

# Inter-onset interval (in lines, ~proxy for time)
onset_lines = [r['line'] for r in onsets]
intervals = [onset_lines[i+1]-onset_lines[i] for i in range(len(onset_lines)-1)]
print(f'=== Inter-onset intervals (lines) ===')
print(f'min={min(intervals)} max={max(intervals)} mean={statistics.mean(intervals):.1f} median={statistics.median(intervals):.1f}')
# Distribution of intervals
from collections import Counter
ic = Counter(intervals)
print('Interval histogram:')
for k in sorted(ic.keys()):
    print(f'  {k}: {"#"*ic[k]} ({ic[k]})')
