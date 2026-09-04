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
            'UnG': float(m.group(2)),
            'RawDelta': float(m.group(3)),
            'Flux': float(m.group(4)),
            'WNS': float(m.group(5)),
            'BassE': float(m.group(9)),
            'k': float(m.group(11)),
            'Res': float(m.group(12)),
            'Flat': float(m.group(13)),
            'Drive': float(m.group(14)),
            'OutSnare': float(m.group(15)),
            'OutKick': float(m.group(16)),
            'tags': m.group(17).strip(),
        })

onsets = [r for r in rows if '[ONSET]' in r['tags']]
non    = [r for r in rows if '[ONSET]' not in r['tags']]

def sep(key):
    o = [r[key] for r in onsets]
    n = [r[key] for r in non]
    return statistics.median(o) / max(statistics.median(n), 1e-6), statistics.median(o), statistics.median(n)

print('=== SEPARABILITY for ALL fields ===')
for key in ['UnG', 'RawDelta', 'Flux', 'WNS', 'BassE', 'k', 'Res', 'Flat', 'Drive']:
    s, om, nm = sep(key)
    print(f'  {key:8s}: {s:.2f}x  (onset={om:.3f}, non={nm:.3f})')

print()
print('=== FLAT: detailed histogram ===')
from collections import Counter
def hist(vals, label):
    buckets = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
    c = [0]*(len(buckets)-1)
    for v in vals:
        for j in range(len(buckets)-1):
            if buckets[j] <= v < buckets[j+1]:
                c[j] += 1
                break
    print(f'{label}:')
    for j in range(len(buckets)-1):
        print(f'  {buckets[j]:.1f}-{buckets[j+1]:.1f}: {"#"*c[j]} ({c[j]})')

hist([r['Flat'] for r in onsets], 'ONSET Flat')
hist([r['Flat'] for r in non], 'NON Flat')

print()
print('=== RES: detailed histogram ===')
hist([r['Res'] for r in onsets], 'ONSET Res')
hist([r['Res'] for r in non], 'NON Res')

print()
print('=== DRIVE: detailed histogram ===')
hist([r['Drive'] for r in onsets], 'ONSET Drive')
hist([r['Drive'] for r in non], 'NON Drive')

# Check: what if we use Res alone (without Flat) as the drive?
# The separability of Res is 2.36x, same as Drive. So Flat adds nothing.
# What about Res * Flux? or Res * UnG?
print()
print('=== Alternative drives: separability ===')
for name, func in [
    ('Res*Flat', lambda r: r['Res']*r['Flat']),
    ('Res*Flux', lambda r: r['Res']*r['Flux']),
    ('Res*UnG',  lambda r: r['Res']*r['UnG']),
    ('Res only', lambda r: r['Res']),
    ('Res*Flat*Flux', lambda r: r['Res']*r['Flat']*r['Flux']),
    ('Res*(Flat^2)', lambda r: r['Res']*r['Flat']*r['Flat']),
    ('Res*(1-Flat)', lambda r: r['Res']*(1-r['Flat'])),  # inverse: prefer tonal? no
    ('Res*max(Flat,0.3)', lambda r: r['Res']*max(r['Flat'],0.3)),  # floor flat
]:
    o = [func(r) for r in onsets]
    n = [func(r) for r in non]
    s = statistics.median(o) / max(statistics.median(n), 1e-6)
    print(f'  {name:20s}: sep={s:.2f}x  (onset_med={statistics.median(o):.3f}, non_med={statistics.median(n):.3f})')

# Check temporal pattern: are onsets aligned with beats?
# Beats appear at lines with [TitanOrchestrator]
beat_lines = []
for i, line in enumerate(lines):
    if 'TitanOrchestrator' in line and 'beat #' in line:
        m = re.search(r'beat #(\d+)', line)
        if m:
            beat_lines.append((i+1, int(m.group(1))))

print()
print('=== Beat markers ===')
for bl, bn in beat_lines:
    print(f'  L{bl}: beat #{bn}')

# Find onsets closest to each beat
print()
print('=== Onset positions relative to beats ===')
onset_lines = [r['line'] for r in onsets]
for bl, bn in beat_lines:
    # find onsets between this beat and next
    next_bl = next((x[0] for x in beat_lines if x[0] > bl), bl+50)
    beat_onsets = [ol for ol in onset_lines if bl <= ol < next_bl]
    offsets = [ol - bl for ol in beat_onsets]
    print(f'  beat #{bn} (L{bl}): onsets at offsets {offsets}')
