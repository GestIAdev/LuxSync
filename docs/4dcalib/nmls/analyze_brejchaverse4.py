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
            'RawDelta': float(m.group(3)), 'Flux': float(m.group(4)),
            'WNS': float(m.group(5)), 'fBL': float(m.group(6)),
            'Gate': float(m.group(7)), 'Veto': float(m.group(8)),
            'BassE': float(m.group(9)), 'BassDelta': float(m.group(10)),
            'k': float(m.group(11)), 'Res': float(m.group(12)),
            'cFx': float(m.group(13)), 'Drive': float(m.group(14)),
            'OutSnare': float(m.group(15)), 'OutKick': float(m.group(16)),
            'tags': m.group(17).strip(),
        })

print(f'=== BREJCHAVERSE 4 (post-Option C: cFx + NLMS 0.015) ===')
print(f'Total FINESSE_AUDIT lines: {len(rows)}')
print()

onsets = [r for r in rows if '[ONSET]' in r['tags']]
kicks  = [r for r in rows if '[KICK]' in r['tags']]
both   = [r for r in rows if '[ONSET]' in r['tags'] and '[KICK]' in r['tags']]
neither= [r for r in rows if '[ONSET]' not in r['tags'] and '[KICK]' not in r['tags']]

print(f'[ONSET] (snare):  {len(onsets)}')
print(f'[KICK]:           {len(kicks)}')
print(f'[ONSET]+[KICK]:   {len(both)}  ({100*len(both)/max(len(onsets),1):.0f}% de onsets)')
print(f'Neither:          {len(neither)}')
print()

# ── COMPARACION ──
print('=== COMPARACION LOG 2 / LOG 3 / LOG 4 ===')
print(f'  Log 2 (Res*Flux gl):  675 frames, 90 onsets, 20 onset+kick (22%)')
print(f'  Log 3 (Res*cFx+NLMS): 276 frames, 49 onsets, 8 onset+kick (16%)')
print(f'  Log 4 (Res*cFx+NLMS): {len(rows)} frames, {len(onsets)} onsets, {len(both)} onset+kick ({100*len(both)/max(len(onsets),1):.0f}%)')
print()

# ── CRITICAL: SnareE check ──
snaree_nonzero = [r for r in rows if r['SnareE'] > 0.001]
snaree_zero = [r for r in rows if r['SnareE'] <= 0.001]
print(f'=== SnareE (gated) CHECK ===')
print(f'  SnareE > 0.001: {len(snaree_nonzero)} frames')
print(f'  SnareE = 0.000: {len(snaree_zero)} frames')
if snaree_nonzero:
    se_vals = [r['SnareE'] for r in snaree_nonzero]
    print(f'  SnareE nonzero range: [{min(se_vals):.3f}, {max(se_vals):.3f}]')
else:
    print(f'  >>> ALL SnareE = 0.000 <<< GATE COMPLETELY CLOSED')
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

# ── k evolution ──
ks = [r['k'] for r in rows]
print(f'=== k evolution (NLMS mu_up=0.015) ===')
print(f'k: start={ks[0]:.3f} end={ks[-1]:.3f} min={min(ks):.3f} max={max(ks):.3f} mean={statistics.mean(ks):.3f}')
print(f'  Log 2 k mean=0.107, Log 3 k mean=0.198, Log 4 k mean={statistics.mean(ks):.3f}')
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
onset_flux = [r['Flux'] for r in onsets]
non_flux   = [r['Flux'] for r in non]
print('=== cFx vs Flux (global) comparison ===')
print(f'ONSET  Flux(global): median={statistics.median(onset_flux):.4f}  cFx(crack): median={statistics.median(onset_cfx):.4f}  ratio={statistics.median(onset_cfx)/max(statistics.median(onset_flux),1e-6):.2f}')
print(f'NON    Flux(global): median={statistics.median(non_flux):.4f}  cFx(crack): median={statistics.median(non_cfx):.4f}  ratio={statistics.median(non_cfx)/max(statistics.median(non_flux),1e-6):.2f}')
print()

# ── DRIVE histogram ──
def hist(vals, label, lo=0, hi=0.12, step=0.012):
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

# ── Inter-onset intervals ──
onset_lines = [r['line'] for r in onsets]
intervals = [onset_lines[i+1]-onset_lines[i] for i in range(len(onset_lines)-1)]
print(f'=== Inter-onset intervals (lines) ===')
if intervals:
    print(f'min={min(intervals)} max={max(intervals)} mean={statistics.mean(intervals):.1f} median={statistics.median(intervals):.1f}')
    from collections import Counter
    ic = Counter(intervals)
    fps = 44
    print('Interval histogram:')
    for k in sorted(ic.keys()):
        ms = k * 1000 / fps
        note = ''
        if 110 <= ms <= 125: note = '~ 1/16 @128bpm'
        elif 225 <= ms <= 245: note = '~ 1/8 @128bpm'
        elif 450 <= ms <= 480: note = '~ 1/4 @128bpm'
        print(f'  {k:2d} frames ({ms:5.0f}ms): {"#"*ic[k]} ({ic[k]}) {note}')
print()

# ── ONSET+KICK ──
print(f'=== ONSET+KICK (snare pegado al kick): {len(both)} ===')
for r in both:
    ratio = r['cFx']/max(r['Flux'],1e-6)
    print(f'  L{r["line"]}: D={r["Drive"]:.4f} R={r["Res"]:.4f} cFx={r["cFx"]:.3f} Flux={r["Flux"]:.3f} ratio={ratio:.2f} UnG={r["UnG"]:.4f} BassE={r["BassE"]:.4f} BassD={r["BassDelta"]:.4f} k={r["k"]:.3f}')
print()

# ── ONSET ONLY with cFx/Flux ratio ──
onset_only = [r for r in onsets if r not in both]
print(f'=== ONSET ONLY ({len(onset_only)}): cFx/Flux ratio analysis ===')
both_ratios = [r['cFx']/max(r['Flux'],1e-6) for r in both]
only_ratios = [r['cFx']/max(r['Flux'],1e-6) for r in onset_only]
if both_ratios:
    print(f'ONSET+KICK cFx/Flux: median={statistics.median(both_ratios):.2f} range=[{min(both_ratios):.2f}-{max(both_ratios):.2f}]')
if only_ratios:
    print(f'ONSET ONLY  cFx/Flux: median={statistics.median(only_ratios):.2f} range=[{min(only_ratios):.2f}-{max(only_ratios):.2f}]')
print()

# ── Rate analysis ──
total_frames = len(rows)
fps = 44
duration_s = total_frames / fps
bpm = 127
beats = duration_s * bpm / 60
print(f'=== ONSET RATE ===')
print(f'  Frames: {total_frames}, Duration: {duration_s:.1f}s, Beats: {beats:.1f}')
print(f'  Onsets: {len(onsets)}, Per beat: {len(onsets)/beats:.2f}')
print(f'  Expected (minimal techno): 1-2/beat')
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

# ── BassDelta discriminator ──
print('=== BassDelta: onset+kick vs onset only ===')
bd_both = [r['BassDelta'] for r in both]
bd_only = [r['BassDelta'] for r in onset_only]
if bd_both:
    print(f'ONSET+KICK BassDelta: min={min(bd_both):.3f} max={max(bd_both):.3f} median={statistics.median(bd_both):.3f}')
if bd_only:
    print(f'ONSET ONLY BassDelta: min={min(bd_only):.3f} max={max(bd_only):.3f} median={statistics.median(bd_only):.3f}')

# Combined discriminator
kick_like = [r for r in onsets if r['cFx']/max(r['Flux'],1e-6) > 2.0 and r['BassDelta'] > 0.05]
snare_like = [r for r in onsets if not (r['cFx']/max(r['Flux'],1e-6) > 2.0 and r['BassDelta'] > 0.05)]
print(f'\n=== Combined discriminator: cFx/Flux > 2.0 AND BassDelta > 0.05 ===')
print(f'  Kick-like: {len(kick_like)}  (of these, {sum(1 for r in kick_like if "[KICK]" in r["tags"])} have [KICK] tag)')
print(f'  Snare-like: {len(snare_like)}  (of these, {sum(1 for r in snare_like if "[KICK]" in r["tags"])} have [KICK] tag)')
print(f'  Snare-like rate: {len(snare_like)/beats:.2f}/beat')
