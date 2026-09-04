import re, statistics
from collections import Counter

def parse_log(path):
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    pat = re.compile(
        r'\[FINESSE_AUDIT\] SnareE:([\d.]+) UnG:([\d.]+) Raw\u0394:([\d.-]+) Flux:([\d.]+) '
        r'WNS:([\d.]+) fBL:([\d.]+) Gate:([\d.]+) Veto:([\d.]+) BassE:([\d.]+) '
        r'Bass\u0394:([\d.-]+) k:([\d.]+) Res:([\d.]+) cFx:([\d.]+) '
        r'bFct:([\d.]+) Drive:([\d.]+) OutSnare:([\d.]+) OutKick:([\d.]+)(.*)'
    )
    rows = []
    for i, line in enumerate(lines):
        m = pat.search(line.strip())
        if m:
            rows.append({
                'line': i+1,
                'SnareE': float(m.group(1)), 'UnG': float(m.group(2)),
                'Flux': float(m.group(4)), 'WNS': float(m.group(5)),
                'Veto': float(m.group(8)), 'BassE': float(m.group(9)),
                'Res': float(m.group(12)), 'cFx': float(m.group(13)),
                'bFct': float(m.group(14)), 'Drive': float(m.group(15)),
                'tags': m.group(18).strip(),
            })
    return rows

def deep_analyze(name, path):
    rows = parse_log(path)
    onsets = [r for r in rows if '[ONSET]' in r['tags']]

    # Compute crackFocus = cFx / (Flux + eps)
    eps = 0.001
    for r in rows:
        r['crackFocus'] = r['cFx'] / (r['Flux'] + eps)
        # Proposed noiseFactor = clamp(1 - WNS*2, 0.05, 1.0)
        r['noiseFactor'] = max(0.05, min(1.0, 1.0 - r['WNS'] * 2.0))
        # Proposed combined: bFct * crackFocus * noiseFactor
        r['combined'] = r['bFct'] * r['crackFocus'] * r['noiseFactor']
        # bFct * crackFocus only
        r['bFct_cF'] = r['bFct'] * r['crackFocus']

    real = [r for r in onsets if r['SnareE'] > 0.3]
    fp   = [r for r in onsets if r['SnareE'] < 0.1]
    partial = [r for r in onsets if 0.1 <= r['SnareE'] <= 0.3]

    print(f'\n{"="*70}')
    print(f'  {name} — DEEP ANALYSIS')
    print(f'{"="*70}')

    # ── crackFocus separability ──
    print(f'\n  === crackFocus = cFx / (Flux + eps) ===')
    for label, group in [('REAL (>0.3)', real), ('PARTIAL', partial), ('FP (<0.1)', fp)]:
        if group:
            vals = [r['crackFocus'] for r in group]
            print(f'  {label:12s}: median={statistics.median(vals):.3f} mean={statistics.mean(vals):.3f} range=[{min(vals):.3f}-{max(vals):.3f}]')

    if real and fp:
        ratio = statistics.median([r['crackFocus'] for r in real]) / max(statistics.median([r['crackFocus'] for r in fp]), 1e-6)
        print(f'  Separability: {ratio:.2f}x')

    # ── noiseFactor separability ──
    print(f'\n  === noiseFactor = clamp(1 - WNS*2, 0.05, 1.0) ===')
    for label, group in [('REAL (>0.3)', real), ('PARTIAL', partial), ('FP (<0.1)', fp)]:
        if group:
            vals = [r['noiseFactor'] for r in group]
            print(f'  {label:12s}: median={statistics.median(vals):.3f} mean={statistics.mean(vals):.3f} range=[{min(vals):.3f}-{max(vals):.3f}]')

    if real and fp:
        ratio = statistics.median([r['noiseFactor'] for r in real]) / max(statistics.median([r['noiseFactor'] for r in fp]), 1e-6)
        print(f'  Separability: {ratio:.2f}x')

    # ── Combined: bFct * crackFocus * noiseFactor ──
    print(f'\n  === COMBINED: bFct * crackFocus * noiseFactor ===')
    for label, group in [('REAL (>0.3)', real), ('PARTIAL', partial), ('FP (<0.1)', fp)]:
        if group:
            vals = [r['combined'] for r in group]
            print(f'  {label:12s}: median={statistics.median(vals):.3f} mean={statistics.mean(vals):.3f} range=[{min(vals):.3f}-{max(vals):.3f}]')

    if real and fp:
        ratio = statistics.median([r['combined'] for r in real]) / max(statistics.median([r['combined'] for r in fp]), 1e-6)
        print(f'  Separability: {ratio:.2f}x')

    # ── bFct * crackFocus only (no noiseFactor) ──
    print(f'\n  === bFct * crackFocus (no noiseFactor) ===')
    for label, group in [('REAL (>0.3)', real), ('PARTIAL', partial), ('FP (<0.1)', fp)]:
        if group:
            vals = [r['bFct_cF'] for r in group]
            print(f'  {label:12s}: median={statistics.median(vals):.3f} mean={statistics.mean(vals):.3f} range=[{min(vals):.3f}-{max(vals):.3f}]')

    if real and fp:
        ratio = statistics.median([r['bFct_cF'] for r in real]) / max(statistics.median([r['bFct_cF'] for r in fp]), 1e-6)
        print(f'  Separability: {ratio:.2f}x')

    # ── Split FPs by WNS ──
    print(f'\n  === FP split by WNS ===')
    fp_wns_high = [r for r in fp if r['WNS'] > 0.1]
    fp_wns_clean = [r for r in fp if r['WNS'] < 0.01]

    for label, group in [('FP WNS>0.1 (synth)', fp_wns_high), ('FP WNS<0.01 (clean)', fp_wns_clean)]:
        if group:
            print(f'\n  {label} ({len(group)} cases):')
            for key in ['crackFocus', 'bFct', 'combined', 'bFct_cF', 'noiseFactor', 'cFx', 'Flux', 'Res', 'Drive']:
                vals = [r[key] for r in group]
                print(f'    {key:12s}: median={statistics.median(vals):.4f}')

    # Compare WNS-clean FP vs WNS-clean REAL
    real_wns_clean = [r for r in real if r['WNS'] < 0.01]
    print(f'\n  === WNS-CLEAN: FP vs REAL (the hard cases) ===')
    print(f'  FP clean:   {len(fp_wns_clean)} cases')
    print(f'  Real clean: {len(real_wns_clean)} cases')
    if fp_wns_clean and real_wns_clean:
        for key in ['crackFocus', 'bFct', 'combined', 'bFct_cF', 'cFx', 'Flux', 'Res', 'UnG', 'Drive', 'SnareE']:
            fp_vals = [r[key] for r in fp_wns_clean]
            real_vals = [r[key] for r in real_wns_clean]
            ratio = statistics.median(real_vals) / max(statistics.median(fp_vals), 1e-6)
            print(f'    {key:12s}: real={statistics.median(real_vals):.4f} fp={statistics.median(fp_vals):.4f} ratio={ratio:.2f}x')

    # ── Simulated Drive with combined factor ──
    print(f'\n  === SIMULATED Drive with combined factor ===')
    print(f'  Current Drive = Res * cFx * bFct')
    print(f'  Proposed Drive = Res * cFx * bFct * crackFocus * noiseFactor')
    print(f'  Proposed Drive2 = Res * cFx * (bFct * crackFocus * noiseFactor)')

    # What threshold would kill FPs but keep reals?
    current_drives_real = [r['Drive'] for r in real]
    current_drives_fp = [r['Drive'] for r in fp]

    # Simulated drives
    for r in rows:
        r['simDrive'] = r['Res'] * r['cFx'] * r['combined']
        r['simDrive2'] = r['Res'] * r['cFx'] * r['bFct_cF']  # without noiseFactor

    sim_real = [r['simDrive'] for r in real]
    sim_fp   = [r['simDrive'] for r in fp]
    sim2_real = [r['simDrive2'] for r in real]
    sim2_fp   = [r['simDrive2'] for r in fp]

    print(f'\n  Current Drive:')
    print(f'    REAL: median={statistics.median(current_drives_real):.4f} min={min(current_drives_real):.4f}')
    print(f'    FP:   median={statistics.median(current_drives_fp):.4f} max={max(current_drives_fp):.4f}')
    if real and fp:
        sep = statistics.median(current_drives_real) / max(statistics.median(current_drives_fp), 1e-6)
        print(f'    Separability: {sep:.2f}x')

    print(f'\n  Simulated Drive (with crackFocus + noiseFactor):')
    print(f'    REAL: median={statistics.median(sim_real):.4f} min={min(sim_real):.4f}')
    print(f'    FP:   median={statistics.median(sim_fp):.4f} max={max(sim_fp):.4f}')
    if real and fp:
        sep = statistics.median(sim_real) / max(statistics.median(sim_fp), 1e-6)
        print(f'    Separability: {sep:.2f}x')

    print(f'\n  Simulated Drive2 (with crackFocus only, no noiseFactor):')
    print(f'    REAL: median={statistics.median(sim2_real):.4f} min={min(sim2_real):.4f}')
    print(f'    FP:   median={statistics.median(sim2_fp):.4f} max={max(sim2_fp):.4f}')
    if real and fp:
        sep = statistics.median(sim2_real) / max(statistics.median(sim2_fp), 1e-6)
        print(f'    Separability: {sep:.2f}x')

    # ── Threshold analysis: what threshold kills FPs? ──
    print(f'\n  === Threshold analysis ===')
    for label, drives_real, drives_fp in [
        ('Current', current_drives_real, current_drives_fp),
        ('Sim (cF+nF)', sim_real, sim_fp),
        ('Sim2 (cF only)', sim2_real, sim2_fp),
    ]:
        # Find threshold that kills 90% of FPs
        for thresh in [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.10, 0.15]:
            fp_killed = sum(1 for d in drives_fp if d < thresh)
            real_kept = sum(1 for d in drives_real if d >= thresh)
            pct_fp = 100 * fp_killed / max(len(drives_fp), 1)
            pct_real = 100 * real_kept / max(len(drives_real), 1)
            if pct_fp >= 80:
                print(f'  {label:14s} thresh={thresh:.3f}: FP killed={pct_fp:.0f}% REAL kept={pct_real:.0f}%')
                break
        else:
            print(f'  {label:14s} no threshold kills 80%+ FPs (max at thresh=0.15: FP={100*sum(1 for d in drives_fp if d < 0.15)/max(len(drives_fp),1):.0f}% REAL={100*sum(1 for d in drives_real if d >= 0.15)/max(len(drives_real),1):.0f}%)')

deep_analyze('BREJCHAVERSE 5', r'docs/4dcalib/nmls/brejchaverse5.md')
deep_analyze('MINIMAL SYNTH', r'docs/4dcalib/nmls/minimalsynth.md')
