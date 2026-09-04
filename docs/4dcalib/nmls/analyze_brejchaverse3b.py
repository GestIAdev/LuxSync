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
            'RawDelta': float(m.group(3)), 'Flux': float(m.group(4)),
            'WNS': float(m.group(5)), 'fBL': float(m.group(6)),
            'Gate': float(m.group(7)), 'Veto': float(m.group(8)),
            'BassE': float(m.group(9)), 'BassDelta': float(m.group(10)),
            'k': float(m.group(11)), 'Res': float(m.group(12)),
            'cFx': float(m.group(13)), 'Drive': float(m.group(14)),
            'OutSnare': float(m.group(15)), 'OutKick': float(m.group(16)),
            'tags': m.group(17).strip(),
        })

onsets = [r for r in rows if '[ONSET]' in r['tags']]
both   = [r for r in rows if '[ONSET]' in r['tags'] and '[KICK]' in r['tags']]
onset_only = [r for r in onsets if r not in both]

# cFx/Flux ratio analysis
print('=== cFx/Flux RATIO: the kick discriminator ===')
print()

onset_only_ratios = [r['cFx']/max(r['Flux'],1e-6) for r in onset_only]
both_ratios = [r['cFx']/max(r['Flux'],1e-6) for r in both]

print(f'ONSET+KICK ({len(both)}): cFx/Flux ratio: min={min(both_ratios):.2f} max={max(both_ratios):.2f} median={statistics.median(both_ratios):.2f} mean={statistics.mean(both_ratios):.2f}')
print(f'ONSET ONLY ({len(onset_only)}): cFx/Flux ratio: min={min(onset_only_ratios):.2f} max={max(onset_only_ratios):.2f} median={statistics.median(onset_only_ratios):.2f} mean={statistics.mean(onset_only_ratios):.2f}')
print()

# Histogram of ratios
def ratio_hist(vals, label, lo=0, hi=4, step=0.25):
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
    print(f'{label}:')
    for j,(a,b) in enumerate(buckets):
        print(f'  {a:.2f}-{b:.2f}: {"#"*min(c[j],60)} ({c[j]})')

print('=== cFx/Flux RATIO histogram ===')
ratio_hist(both_ratios, 'ONSET+KICK')
ratio_hist(onset_only_ratios, 'ONSET ONLY')
print()

# Detail: onset only with their ratios
print('=== ONSET ONLY (no kick) — sorted by cFx/Flux ratio ===')
onset_only_sorted = sorted(onset_only, key=lambda r: r['cFx']/max(r['Flux'],1e-6), reverse=True)
for r in onset_only_sorted[:20]:
    ratio = r['cFx']/max(r['Flux'],1e-6)
    print(f'  L{r["line"]}: cFx/Flux={ratio:.2f}  cFx={r["cFx"]:.3f} Flux={r["Flux"]:.3f} D={r["Drive"]:.4f} R={r["Res"]:.4f} UnG={r["UnG"]:.4f} BassE={r["BassE"]:.4f} BassD={r["BassDelta"]:.4f}')
print()

# BassDelta analysis
print('=== BassDelta: onset+kick vs onset only ===')
bd_both = [r['BassDelta'] for r in both]
bd_only = [r['BassDelta'] for r in onset_only]
print(f'ONSET+KICK BassDelta: min={min(bd_both):.3f} max={max(bd_both):.3f} median={statistics.median(bd_both):.3f}')
print(f'ONSET ONLY BassDelta: min={min(bd_only):.3f} max={max(bd_only):.3f} median={statistics.median(bd_only):.3f}')
print()

# Combined: cFx/Flux ratio AND BassDelta
print('=== Combined discriminator: cFx/Flux > 2.0 AND BassDelta > 0.05 ===')
kick_like = [r for r in onsets if r['cFx']/max(r['Flux'],1e-6) > 2.0 and r['BassDelta'] > 0.05]
snare_like = [r for r in onsets if not (r['cFx']/max(r['Flux'],1e-6) > 2.0 and r['BassDelta'] > 0.05)]
print(f'  Kick-like (cFx/Flux>2 AND BassD>0.05): {len(kick_like)}  (of these, {sum(1 for r in kick_like if "[KICK]" in r["tags"])} have [KICK] tag)')
print(f'  Snare-like (rest):                     {len(snare_like)}  (of these, {sum(1 for r in snare_like if "[KICK]" in r["tags"])} have [KICK] tag)')
print()

# Rate analysis
total_frames = len(rows)
fps = 44
duration_s = total_frames / fps
bpm = 129
bps = bpm / 60
beats = duration_s * bps
print(f'=== ONSET RATE ===')
print(f'  Frames: {total_frames}, Duration: {duration_s:.1f}s, Beats: {beats:.1f}')
print(f'  Onsets: {len(onsets)}, Per beat: {len(onsets)/beats:.2f}')
print(f'  Expected (minimal techno, 1/8 off-beat): ~{beats:.0f} onsets (1/beat)')
print(f'  Expected (with 1/16 rolls): ~{beats*2:.0f} onsets (2/beat)')
print(f'  Actual: {len(onsets)} ({len(onsets)/beats:.2f}/beat)')
print()

# What if we filter out kick-like?
print(f'=== IF WE FILTER OUT kick-like (cFx/Flux>2 AND BassD>0.05) ===')
print(f'  Remaining onsets: {len(snare_like)} ({len(snare_like)/beats:.2f}/beat)')
print(f'  Of those, onset+kick: {sum(1 for r in snare_like if "[KICK]" in r["tags"])}')
print()

# Temporal pattern: are onsets at regular 1/16 intervals?
onset_lines = [r['line'] for r in onsets]
intervals = [onset_lines[i+1]-onset_lines[i] for i in range(len(onset_lines)-1)]
from collections import Counter
ic = Counter(intervals)
print('=== Inter-onset interval histogram (frames) ===')
for k in sorted(ic.keys()):
    ms = k * 1000 / fps
    note = ''
    if 110 <= ms <= 125: note = '~ 1/16 @128bpm'
    elif 225 <= ms <= 245: note = '~ 1/8 @128bpm'
    elif 450 <= ms <= 480: note = '~ 1/4 @128bpm'
    print(f'  {k:2d} frames ({ms:5.0f}ms): {"#"*ic[k]} ({ic[k]}) {note}')
