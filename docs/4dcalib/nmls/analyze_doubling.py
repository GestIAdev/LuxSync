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
                'WNS': float(m.group(5)), 'Veto': float(m.group(8)),
                'BassE': float(m.group(9)), 'BassDelta': float(m.group(10)),
                'k': float(m.group(11)), 'Res': float(m.group(12)),
                'cFx': float(m.group(13)), 'bFct': float(m.group(14)),
                'sEF': float(m.group(15)), 'Drive': float(m.group(16)),
                'OutSnare': float(m.group(17)), 'OutKick': float(m.group(18)),
                'tags': m.group(19).strip(),
            })
    return rows

rows = parse_log(r'docs/4dcalib/nmls/minimalverse2.md')
onsets = [r for r in rows if '[ONSET]' in r['tags']]
real = [r for r in onsets if r['SnareE'] > 0.3]
bpm = 124
fps = 44

print('='*70)
print('  DOUBLING FORENSIC — minimalverse2')
print('='*70)

# ── 1. Inter-onset interval clusters ──
print(f'\n  === Inter-onset interval analysis ===')
onset_lines = [r['line'] for r in onsets]
intervals = [(onset_lines[i+1]-onset_lines[i], i) for i in range(len(onset_lines)-1)]

# Classify: double-trigger (< 6 frames = 136ms) vs legit
double_triggers = [(iv, i) for iv, i in intervals if iv < 6]
legit_intervals = [(iv, i) for iv, i in intervals if iv >= 6]

print(f'  Total onsets: {len(onsets)}')
print(f'  Double-trigger pairs (<6 frames, <136ms): {len(double_triggers)}')
print(f'  Legit intervals (>=6 frames): {len(legit_intervals)}')
print(f'  If we remove double-triggers: ~{len(onsets) - len(double_triggers)} onsets')

# ── 2. Profile the double-trigger pairs ──
print(f'\n  === Double-trigger pair profiles ===')
print(f'  (First = real snare, Second = re-trigger)')
for iv, idx in double_triggers:
    first = onsets[idx]
    second = onsets[idx+1]
    print(f'\n  Pair @ L{first["line"]}->L{second["line"]} ({iv} frames = {iv*1000/fps:.0f}ms):')
    print(f'    FIRST:  SnareE={first["SnareE"]:.3f} sEF={first["sEF"]:.3f} Drive={first["Drive"]:.4f} '
          f'Res={first["Res"]:.4f} cFx={first["cFx"]:.3f} Flux={first["Flux"]:.3f} '
          f'WNS={first["WNS"]:.3f} BassD={first["BassDelta"]:.4f} tags={first["tags"]}')
    print(f'    SECOND: SnareE={second["SnareE"]:.3f} sEF={second["sEF"]:.3f} Drive={second["Drive"]:.4f} '
          f'Res={second["Res"]:.4f} cFx={second["cFx"]:.3f} Flux={second["Flux"]:.3f} '
          f'WNS={second["WNS"]:.3f} BassD={second["BassDelta"]:.4f} tags={second["tags"]}')

# ── 3. What does the real snare pattern look like? ──
print(f'\n  === Expected vs actual snare rate ===')
beats = len(rows) / fps * bpm / 60
print(f'  Duration: {len(rows)/fps:.1f}s, Beats: {beats:.1f}')
print(f'  Actual onsets: {len(onsets)} ({len(onsets)/beats:.2f}/beat)')
print(f'  Real (SnareE>0.3): {len(real)} ({len(real)/beats:.2f}/beat)')
print(f'  After removing doubles: ~{len(onsets)-len(double_triggers)} ({(len(onsets)-len(double_triggers))/beats:.2f}/beat)')
print(f'  Expected minimal techno: ~0.5-1.0/beat (snare on 2&4)')

# ── 4. The frames BETWEEN onsets — what does snareDrive look like? ──
print(f'\n  === snareDrive trace between double-trigger pairs ===')
# For each double-trigger pair, show the frames between them
for iv, idx in double_triggers[:3]:
    first = onsets[idx]
    second = onsets[idx+1]
    start_line = first['line']
    end_line = second['line']
    print(f'\n  Trace L{start_line}->L{end_line}:')
    for r in rows:
        if start_line <= r['line'] <= end_line:
            tag = 'ONSET' if '[ONSET]' in r['tags'] else '      '
            print(f'    L{r["line"]:4d}: Drive={r["Drive"]:.5f} Res={r["Res"]:.4f} cFx={r["cFx"]:.4f} '
                  f'Flux={r["Flux"]:.4f} bFct={r["bFct"]:.3f} sEF={r["sEF"]:.3f} '
                  f'SnareE={r["SnareE"]:.3f} {tag}')

# ── 5. MACD momentum reconstruction ──
print(f'\n  === MACD momentum reconstruction ===')
# Reconstruct emaFast/emaSlow from snareDrive
aF = 0.50  # snareMomentumAlphaFast
aS = 0.05  # snareMomentumAlphaSlow
emaF = 0
emaS = 0
prev_mom = 0
momoTh = 0.015  # typical threshold for techno

print(f'  alphaFast={aF}, alphaSlow={aS}, threshold={momoTh}')
print(f'  Showing frames where momentum > {momoTh*0.5} (near threshold):')

crossings = 0
for r in rows:
    drive = r['Drive']
    emaF += aF * (drive - emaF)
    emaS += aS * (drive - emaS)
    mom = emaF - emaS
    is_cross = mom > momoTh and prev_mom <= momoTh
    if is_cross:
        crossings += 1
    if mom > momoTh * 0.5 or is_cross or '[ONSET]' in r['tags']:
        tag = 'CROSS' if is_cross else ('ONSET' if '[ONSET]' in r['tags'] else '     ')
        print(f'    L{r["line"]:4d}: Drive={drive:.5f} emaF={emaF:.5f} emaS={emaS:.5f} '
              f'mom={mom:.5f} {tag}')
    prev_mom = mom

print(f'\n  Total MACD crossings (reconstructed): {crossings}')
print(f'  Total [ONSET] tags in log: {len(onsets)}')

# ── 6. What if we raise alphaSlow? ──
print(f'\n  === Simulated MACD with higher alphaSlow (faster decay) ===')
for test_aS in [0.05, 0.08, 0.10, 0.15, 0.20]:
    emaF = 0
    emaS = 0
    prev_mom = 0
    crossings = 0
    for r in rows:
        drive = r['Drive']
        emaF += aF * (drive - emaF)
        emaS += test_aS * (drive - emaS)
        mom = emaF - emaS
        is_cross = mom > momoTh and prev_mom <= momoTh
        if is_cross:
            crossings += 1
        prev_mom = mom
    rate = crossings / beats
    print(f'  alphaSlow={test_aS:.2f}: crossings={crossings} ({rate:.2f}/beat)')

# ── 7. What if we raise the threshold? ──
print(f'\n  === Simulated MACD with higher threshold ===')
for test_th in [0.015, 0.020, 0.025, 0.030, 0.040, 0.050]:
    emaF = 0
    emaS = 0
    prev_mom = 0
    crossings = 0
    for r in rows:
        drive = r['Drive']
        emaF += aF * (drive - emaF)
        emaS += aS * (drive - emaS)
        mom = emaF - emaS
        is_cross = mom > test_th and prev_mom <= test_th
        if is_cross:
            crossings += 1
        prev_mom = mom
    rate = crossings / beats
    print(f'  threshold={test_th:.3f}: crossings={crossings} ({rate:.2f}/beat)')
