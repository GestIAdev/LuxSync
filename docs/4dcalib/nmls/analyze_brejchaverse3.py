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
            'cFx': float(m.group(13)),
            'Drive': float(m.group(14)),
            'OutSnare': float(m.group(15)),
            'OutKick': float(m.group(16)),
            'tags': m.group(17).strip(),
        })

print(f'=== BREJCHAVERSE 3 (Crack-Band Flux + NLMS 0.015) ===')
print(f'Total FINESSE_AUDIT lines: {len(rows)}')
print()

onsets = [r for r in rows if '[ONSET]' in r['tags']]
kicks  = [r for r in rows if '[KICK]' in r['tags']]
both   = [r for r in rows if '[ONSET]' in r['tags'] and '[KICK]' in r['tags']]
neither= [r for r in rows if '[ONSET]' not in r['tags'] and '[KICK]' not in r['tags']]

print(f'[ONSET] (snare):  {len(onsets)}')
print(f'[KICK]:           {len(kicks)}')
print(f'[ONSET]+[KICK]:   {len(both)}  <-- snare pegado al kick ({100*len(both)/max(len(onsets),1):.0f}% de onsets)')
print(f'Neither:          {len(neither)}')
print()

# ── COMPARACIÓN ──
print('=== COMPARACION LOG 1 / LOG 2 / LOG 3 ===')
print(f'  Log 1 (Res*Flat):     320 frames, 55 onsets, 5 onset+kick (9%)')
print(f'  Log 2 (Res*Flux gl):  675 frames, 90 onsets, 20 onset+kick (22%)')
print(f'  Log 3 (Res*cFx+NLMS): {len(rows)} frames, {len(onsets)} onsets, {len(both)} onset+kick ({100*len(both)/max(len(onsets),1):.0f}%)')
print()

# ── SEPARABILIDAD ──
non = [r for r in rows if '[ONSET]' not in r['tags']]
def sep(key):
    o = [r[key] for r in onsets]
    n = [r[key] for r in non]
    return statistics.median(o) / max(statistics.median(n), 1e-6), statistics.median(o), statistics.median(n)

print('=== SEPARABILIDAD (onset median / non-onset median) ===')
for key in ['UnG', 'RawDelta', 'Flux', 'WNS', 'BassE', 'k', 'Res', 'cFx', 'Drive']:
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

# ── cFx distribution ──
onset_cfx = [r['cFx'] for r in onsets]
non_cfx   = [r['cFx'] for r in non]
print('=== cFx (crackFlux) distribution ===')
print(f'ONSET  cFx: min={min(onset_cfx):.4f} max={max(onset_cfx):.4f} mean={statistics.mean(onset_cfx):.4f} median={statistics.median(onset_cfx):.4f}')
print(f'NON    cFx: min={min(non_cfx):.4f} max={max(non_cfx):.4f} mean={statistics.mean(non_cfx):.4f} median={statistics.median(non_cfx):.4f}')
print()

# ── cFx vs Flux comparison ──
print('=== cFx vs Flux (global) comparison ===')
onset_flux = [r['Flux'] for r in onsets]
non_flux   = [r['Flux'] for r in non]
print(f'ONSET  Flux(global): median={statistics.median(onset_flux):.4f}  cFx(crack): median={statistics.median(onset_cfx):.4f}  ratio={statistics.median(onset_cfx)/max(statistics.median(onset_flux),1e-6):.2f}')
print(f'NON    Flux(global): median={statistics.median(non_flux):.4f}  cFx(crack): median={statistics.median(non_cfx):.4f}  ratio={statistics.median(non_cfx)/max(statistics.median(non_flux),1e-6):.2f}')
print()

# ── k evolution ──
ks = [r['k'] for r in rows]
print(f'=== k evolution (NLMS mu_up=0.015) ===')
print(f'k: start={ks[0]:.3f} end={ks[-1]:.3f} min={min(ks):.3f} max={max(ks):.3f} mean={statistics.mean(ks):.3f}')
print(f'  Log 2 k mean was 0.107; Log 3 k mean = {statistics.mean(ks):.3f}')
print()

# ── DRIVE histogram ──
def hist(vals, label, lo=0, hi=0.15, step=0.015):
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
        print(f'  {a:.3f}-{b:.3f}: {"#"*min(c[j],80)} ({c[j]})')

print('=== DRIVE histogram ===')
hist(onset_drives, 'ONSET Drive')
hist(non_drives, 'NON Drive')
print()

# ── cFx histogram ──
print('=== cFx histogram ===')
hist(onset_cfx, 'ONSET cFx', 0, 0.6, 0.05)
hist(non_cfx, 'NON cFx', 0, 0.6, 0.05)
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
    print(f'  L{r["line"]}: D={r["Drive"]:.4f} R={r["Res"]:.4f} cFx={r["cFx"]:.4f} Flux={r["Flux"]:.4f} UnG={r["UnG"]:.4f} BassE={r["BassE"]:.4f} BassD={r["BassDelta"]:.4f} k={r["k"]:.3f} OutS={r["OutSnare"]:.3f} OutK={r["OutKick"]:.3f}')
print()

# ── Non-onset with high Drive ──
high_drive_non = [r for r in non if r['Drive'] > 0.02]
print(f'=== NON-ONSET with Drive>0.02: {len(high_drive_non)} ===')
for r in high_drive_non[:15]:
    print(f'  L{r["line"]}: D={r["Drive"]:.4f} R={r["Res"]:.4f} cFx={r["cFx"]:.4f} Flux={r["Flux"]:.4f} UnG={r["UnG"]:.4f} OutS={r["OutSnare"]:.3f} tags=[{r["tags"]}]')
print()

# ── Onsets with low Drive ──
low_drive_onset = [r for r in onsets if r['Drive'] < 0.02]
print(f'=== ONSET with Drive<0.02 (weak triggers): {len(low_drive_onset)} ===')
for r in low_drive_onset:
    print(f'  L{r["line"]}: D={r["Drive"]:.4f} R={r["Res"]:.4f} cFx={r["cFx"]:.4f} Flux={r["Flux"]:.4f} UnG={r["UnG"]:.4f} OutS={r["OutSnare"]:.3f} tags=[{r["tags"]}]')
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
print()

# ── cFx vs Flux scatter (onset+kick only) ──
print('=== ONSET+KICK: cFx vs Flux (is cFx isolating?) ===')
for r in both:
    ratio = r['cFx']/max(r['Flux'],1e-6)
    print(f'  L{r["line"]}: cFx={r["cFx"]:.3f} Flux={r["Flux"]:.3f} ratio={ratio:.2f} {"<<< cFx>Flux" if r["cFx"]>r["Flux"] else "<<< cFx<Flux"}')
