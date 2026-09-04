import re, statistics

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
                'SnareE': float(m.group(1)), 'Drive': float(m.group(16)),
                'tags': m.group(19).strip(),
            })
    return rows

rows = parse_log(r'docs/4dcalib/nmls/minimalverse2.md')
bpm = 124
fps = 44
beats = len(rows) / fps * bpm / 60

# ── REAL parameters from techno.ts ──
aF_real = 1.00  # snareMomentumAlphaFast
aS_real = 0.05  # snareMomentumAlphaSlow
th_real = 0.01  # snareMomentumThreshold
floor_real = 0.005  # snareMomentumFloor

print('='*70)
print('  MACD RECONSTRUCTION WITH REAL PARAMETERS')
print('='*70)
print(f'  alphaFast={aF_real}, alphaSlow={aS_real}, threshold={th_real}, floor={floor_real}')
print(f'  Beats: {beats:.1f}')

# ── Reconstruct with real params ──
def simulate(aF, aS, th, floor, reset_th=None, reset_ratio=None):
    emaF = 0
    emaS = 0
    prev_mom = 0
    crossings = 0
    onset_lines = []
    for r in rows:
        drive = r['Drive']
        emaF += aF * (drive - emaF)
        emaS += aS * (drive - emaS)
        mom = emaF - emaS
        is_cross = mom > th and prev_mom <= th and drive >= floor
        if is_cross:
            crossings += 1
            onset_lines.append(r['line'])
        # Hybrid reset
        if reset_th is not None and reset_ratio is not None and mom > reset_th:
            emaS = emaS + reset_ratio * (emaF - emaS)
        prev_mom = mom
    return crossings, onset_lines

# Current params
c, ol = simulate(aF_real, aS_real, th_real, floor_real, 0.15, 0.70)
print(f'\n  Current (th=0.01, aF=1.0, aS=0.05, reset@0.15/0.70): {c} crossings ({c/beats:.2f}/beat)')

# Without hybrid reset
c_nr, ol_nr = simulate(aF_real, aS_real, th_real, floor_real)
print(f'  Without hybrid reset: {c_nr} crossings ({c_nr/beats:.2f}/beat)')

# ── Threshold sweep ──
print(f'\n  === Threshold sweep (with hybrid reset) ===')
for th in [0.005, 0.010, 0.015, 0.020, 0.025, 0.030, 0.040, 0.050, 0.060, 0.080, 0.100]:
    c, _ = simulate(aF_real, aS_real, th, floor_real, 0.15, 0.70)
    print(f'  th={th:.3f}: {c:3d} crossings ({c/beats:.2f}/beat)')

# ── alphaSlow sweep ──
print(f'\n  === alphaSlow sweep (th=0.01, with hybrid reset) ===')
for aS in [0.03, 0.05, 0.08, 0.10, 0.15, 0.20, 0.30]:
    c, _ = simulate(aF_real, aS, th_real, floor_real, 0.15, 0.70)
    print(f'  aS={aS:.2f}: {c:3d} crossings ({c/beats:.2f}/beat)')

# ── Floor sweep ──
print(f'\n  === Floor sweep (th=0.01, with hybrid reset) ===')
for floor in [0.005, 0.010, 0.015, 0.020, 0.030, 0.040, 0.050]:
    c, _ = simulate(aF_real, aS_real, th_real, floor, 0.15, 0.70)
    print(f'  floor={floor:.3f}: {c:3d} crossings ({c/beats:.2f}/beat)')

# ── Combined: threshold + floor ──
print(f'\n  === Combined threshold + floor sweep ===')
for th in [0.020, 0.030, 0.040, 0.050]:
    for floor in [0.010, 0.020, 0.030]:
        c, _ = simulate(aF_real, aS_real, th, floor, 0.15, 0.70)
        print(f'  th={th:.3f} floor={floor:.3f}: {c:3d} crossings ({c/beats:.2f}/beat)')

# ── Show the actual onset log vs reconstructed ──
print(f'\n  === Log [ONSET] vs reconstructed crossings ===')
log_onsets = [r['line'] for r in rows if '[ONSET]' in r['tags']]
_, recon_onsets = simulate(aF_real, aS_real, th_real, floor_real, 0.15, 0.70)
print(f'  Log [ONSET] count: {len(log_onsets)}')
print(f'  Reconstructed crossings: {len(recon_onsets)}')
print(f'  Log onsets not in reconstruction: {len(set(log_onsets) - set(recon_onsets))}')
print(f'  Reconstruction not in log: {len(set(recon_onsets) - set(log_onsets))}')

# Show first 20 mismatches
log_set = set(log_onsets)
recon_set = set(recon_onsets)
print(f'\n  First 15 log ONSETs not in reconstruction:')
miss = sorted(set(log_onsets) - set(recon_onsets))[:15]
for l in miss:
    r = next(x for x in rows if x['line'] == l)
    print(f'    L{l}: Drive={r["Drive"]:.5f} SnareE={r["SnareE"]:.3f}')
