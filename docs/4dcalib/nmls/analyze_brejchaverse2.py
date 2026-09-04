import re, statistics

path = r'docs/4dcalib/nmls/brejchaverse2.md'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

pat = re.compile(
    r'\[FINESSE_AUDIT\] SnareE:([\d.]+) UnG:([\d.]+) RawΔ:([\d.-]+) Flux:([\d.]+) '
    r'WNS:([\d.]+) fBL:([\d.]+) Gate:([\d.]+) Veto:([\d.]+) BassE:([\d.]+) '
    r'BassΔ:([\d.-]+) k:([\d.]+) Res:([\d.]+) Drive:([\d.]+) '
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
            'Drive': float(m.group(13)),
            'OutSnare': float(m.group(14)),
            'OutKick': float(m.group(15)),
            'tags': m.group(16).strip(),
        })

print(f'=== BREJCHAVERSE 2 (Flux-Drive) ===')
print(f'Total FINESSE_AUDIT lines: {len(rows)}')
print()

onsets = [r for r in rows if '[ONSET]' in r['tags']]
kicks  = [r for r in rows if '[KICK]' in r['tags']]
both   = [r for r in rows if '[ONSET]' in r['tags'] and '[KICK]' in r['tags']]
neither= [r for r in rows if '[ONSET]' not in r['tags'] and '[KICK]' not in r['tags']]

print(f'[ONSET] (snare):  {len(onsets)}')
print(f'[KICK]:           {len(kicks)}')
print(f'[ONSET]+[KICK]:   {len(both)}  <-- snare pegado al kick')
print(f'Neither:          {len(neither)}')
print()

# ── COMPARACIÓN CON LOG 1 ──
print('=== COMPARACIÓN LOG 1 vs LOG 2 ===')
print(f'  Log 1: 320 frames, 55 onsets, 5 onset+kick (9% de onsets pegados)')
print(f'  Log 2: {len(rows)} frames, {len(onsets)} onsets, {len(both)} onset+kick ({100*len(both)/max(len(onsets),1):.0f}% de onsets pegados)')
print()

# ── SEPARABILIDAD ──
non = [r for r in rows if '[ONSET]' not in r['tags']]
def sep(key):
    o = [r[key] for r in onsets]
    n = [r[key] for r in non]
    return statistics.median(o) / max(statistics.median(n), 1e-6), statistics.median(o), statistics.median(n)

print('=== SEPARABILIDAD (onset median / non-onset median) ===')
for key in ['UnG', 'RawDelta', 'Flux', 'WNS', 'BassE', 'k', 'Res', 'Drive']:
    s, om, nm = sep(key)
    print(f'  {key:8s}: {s:.2f}x  (onset={om:.4f}, non={nm:.4f})')
print()

# ── DRIVE distribution ──
onset_drives = [r['Drive'] for r in onsets]
non_drives   = [r['Drive'] for r in non]
print('=== DRIVE distribution ===')
print(f'ONSET  Drive: min={min(onset_drives):.4f} max={max(onset_drives):.4f} mean={statistics.mean(onset_drives):.4f} median={statistics.median(onset_drives):.4f}')
print(f'NON    Drive: min={min(non_drives):.4f} max={max(non_drives):.4f} mean={statistics.mean(non_drives):.4f} median={statistics.median(non_drives):.4f}')
print()

# ── FLUX distribution ──
onset_flux = [r['Flux'] for r in onsets]
non_flux   = [r['Flux'] for r in non]
print('=== FLUX distribution ===')
print(f'ONSET  Flux: min={min(onset_flux):.4f} max={max(onset_flux):.4f} mean={statistics.mean(onset_flux):.4f} median={statistics.median(onset_flux):.4f}')
print(f'NON    Flux: min={min(non_flux):.4f} max={max(non_flux):.4f} mean={statistics.mean(non_flux):.4f} median={statistics.median(non_flux):.4f}')
print()

# ── RES distribution ──
onset_res = [r['Res'] for r in onsets]
non_res   = [r['Res'] for r in non]
print('=== RES distribution ===')
print(f'ONSET  Res: min={min(onset_res):.4f} max={max(onset_res):.4f} mean={statistics.mean(onset_res):.4f} median={statistics.median(onset_res):.4f}')
print(f'NON    Res: min={min(non_res):.4f} max={max(non_res):.4f} mean={statistics.mean(non_res):.4f} median={statistics.median(non_res):.4f}')
print()

# ── k evolution ──
ks = [r['k'] for r in rows]
print(f'=== k evolution ===')
print(f'k: start={ks[0]:.3f} end={ks[-1]:.3f} min={min(ks):.3f} max={max(ks):.3f} mean={statistics.mean(ks):.3f}')
print()

# ── DRIVE histogram ──
def hist(vals, label, lo=0, hi=0.2, step=0.02):
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
        print(f'  {a:.3f}-{b:.3f}: {"#"*c[j]} ({c[j]})')

print('=== DRIVE histogram ===')
hist(onset_drives, 'ONSET Drive')
hist(non_drives, 'NON Drive')
print()

# ── Inter-onset intervals ──
onset_lines = [r['line'] for r in onsets]
intervals = [onset_lines[i+1]-onset_lines[i] for i in range(len(onset_lines)-1)]
print(f'=== Inter-onset intervals (lines) ===')
if intervals:
    print(f'min={min(intervals)} max={max(intervals)} mean={statistics.mean(intervals):.1f} median={statistics.median(intervals):.1f}')
    from collections import Counter
    ic = Counter(intervals)
    print('Interval histogram:')
    for k in sorted(ic.keys()):
        print(f'  {k}: {"#"*ic[k]} ({ic[k]})')
print()

# ── ONSET+KICK: los pegados al kick ──
print(f'=== ONSET+KICK (snare pegado al kick): {len(both)} ===')
for r in both:
    print(f'  L{r["line"]}: D={r["Drive"]:.4f} R={r["Res"]:.4f} Flux={r["Flux"]:.4f} UnG={r["UnG"]:.4f} BassE={r["BassE"]:.4f} BassD={r["BassDelta"]:.4f} OutS={r["OutSnare"]:.3f} OutK={r["OutKick"]:.3f}')
print()

# ── Non-onset with high Drive (potential false positives that MACD didn't fire) ──
high_drive_non = [r for r in non if r['Drive'] > 0.03]
print(f'=== NON-ONSET with Drive>0.03: {len(high_drive_non)} ===')
for r in high_drive_non[:15]:
    print(f'  L{r["line"]}: D={r["Drive"]:.4f} R={r["Res"]:.4f} Flux={r["Flux"]:.4f} UnG={r["UnG"]:.4f} OutS={r["OutSnare"]:.3f} tags=[{r["tags"]}]')
print()

# ── Onsets with low Drive (weak triggers) ──
low_drive_onset = [r for r in onsets if r['Drive'] < 0.02]
print(f'=== ONSET with Drive<0.02 (weak triggers): {len(low_drive_onset)} ===')
for r in low_drive_onset:
    print(f'  L{r["line"]}: D={r["Drive"]:.4f} R={r["Res"]:.4f} Flux={r["Flux"]:.4f} UnG={r["UnG"]:.4f} OutS={r["OutSnare"]:.3f} tags=[{r["tags"]}]')
print()

# ── Beat alignment ──
beat_lines = []
for i, line in enumerate(lines):
    if 'TitanOrchestrator' in line and 'beat #' in line:
        m = re.search(r'beat #(\d+)', line)
        if m:
            beat_lines.append((i+1, int(m.group(1))))

print(f'=== Beat markers ({len(beat_lines)}) ===')
for bl, bn in beat_lines:
    next_bl = next((x[0] for x in beat_lines if x[0] > bl), bl+60)
    beat_onsets = [ol for ol in onset_lines if bl <= ol < next_bl]
    beat_both = [r for r in both if bl <= r['line'] < next_bl]
    offsets = [ol - bl for ol in beat_onsets]
    print(f'  beat #{bn} (L{bl}): onsets at offsets {offsets}  | onset+kick: {len(beat_both)}')
