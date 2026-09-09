#!/usr/bin/env python3
"""Analyze minimalcalib19 — find synth FPs in silence."""
import re
from pathlib import Path

PAT = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+Raw\u0394:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+Bass\u0394:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+fFloor:(?P<fFloor>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+rGate:(?P<rGate>[-\d.]+)\s+gRefr:(?P<gRefr>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)"
)

rows = []
text = Path(r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\minimalcalib19.md").read_text(encoding="utf-8", errors="replace")
for line in text.splitlines():
    if "[FINESSE_AUDIT]" not in line: continue
    m = PAT.search(line)
    if not m: continue
    d = {k: float(v) for k, v in m.groupdict().items()}
    d['onset'] = '[ONSET]' in line
    rows.append(d)

onsets = [i for i, r in enumerate(rows) if r['onset']]
print(f"MINIMALCALIB19 - {len(rows)} frames, {len(onsets)} onsets")
print("="*80)

# Show all onsets
print("\nALL ONSETS:")
for n, idx in enumerate(onsets, 1):
    r = rows[idx]
    crackDrive = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
    print(f"  #{n:2d} frame {idx:3d}: UnG={r['UnG']:.3f} Res={r['Res']:.3f} "
          f"cFx={r['cFx']:.3f} bFct={r['bFct']:.3f} sEF={r['sEF']:.3f} "
          f"Drive={r['Drive']:.4f} crackD={crackDrive:.4f} "
          f"ghst={r['ghst']:.4f} RawD={r['RawD']:.3f} "
          f"Flux={r['Flux']:.3f} hhDlt={r['hhDlt']:.4f} "
          f"BassE={r['BassE']:.3f} Veto={r['Veto']:.3f} "
          f"WNS={r['WNS']:.3f}")

# Spacings
if len(onsets) > 1:
    spacings = [onsets[i+1] - onsets[i] for i in range(len(onsets)-1)]
    print(f"\nSpacings: {spacings}")

# Classify onsets: real snare vs synth FP
print("\n" + "="*80)
print("ONSET CLASSIFICATION")
print("="*80)
real_snares = []
synth_fps = []
for idx in onsets:
    r = rows[idx]
    # Real snare: Res > 0.25 AND RawD > 0.2 (strong transient)
    # Synth FP: Res < 0.25 OR RawD < 0.2 (weak/no transient)
    if r['Res'] > 0.25 and r['RawD'] > 0.2:
        real_snares.append(idx)
    else:
        synth_fps.append(idx)

print(f"\nReal snares ({len(real_snares)}):")
for idx in real_snares:
    r = rows[idx]
    print(f"  frame {idx}: UnG={r['UnG']:.3f} Res={r['Res']:.3f} "
          f"RawD={r['RawD']:.3f} Drive={r['Drive']:.4f}")

print(f"\nSynth FPs ({len(synth_fps)}):")
for idx in synth_fps:
    r = rows[idx]
    crackDrive = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
    print(f"  frame {idx}: UnG={r['UnG']:.3f} Res={r['Res']:.3f} "
          f"RawD={r['RawD']:.3f} cFx={r['cFx']:.3f} bFct={r['bFct']:.3f} "
          f"sEF={r['sEF']:.3f} Drive={r['Drive']:.4f} "
          f"crackD={crackDrive:.4f} ghst={r['ghst']:.4f} "
          f"hhDlt={r['hhDlt']:.4f} Flux={r['Flux']:.3f} "
          f"BassE={r['BassE']:.3f} Veto={r['Veto']:.3f} "
          f"WNS={r['WNS']:.3f}")

# What path triggered the synth FPs?
print("\n" + "="*80)
print("SYNTH FP PATH ANALYSIS")
print("="*80)
for idx in synth_fps:
    r = rows[idx]
    crackDrive = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
    ghostResGate = 0.3 + 0.7 * max(0, min(1, (r['Res'] - 0.05) / 0.15))
    # MACD bypass rescue: UnG>0.4 AND Res>0.3 AND RawD>0.2
    bypass_rescue = r['UnG'] > 0.4 and r['Res'] > 0.3 and r['RawD'] > 0.2
    # Ghost-driven: ghst > crackDrive
    ghost_driven = r['ghst'] > crackDrive
    # Crack-driven: crackDrive > ghst
    crack_driven = crackDrive > r['ghst']
    path = []
    if bypass_rescue: path.append("MACD_BYPASS")
    if ghost_driven: path.append("GHOST")
    if crack_driven: path.append("CRACK")
    print(f"  frame {idx}: path={'+'.join(path)} "
          f"UnG={r['UnG']:.3f} Res={r['Res']:.3f} RawD={r['RawD']:.3f} "
          f"crackD={crackDrive:.4f} ghst={r['ghst']:.4f} "
          f"ghostResGate={ghostResGate:.2f} "
          f"bypass_rescue={bypass_rescue}")

# Compare averages
print("\n" + "="*80)
print("AVERAGES: Real snares vs Synth FPs")
print("="*80)
if real_snares and synth_fps:
    fields = ['UnG', 'Res', 'cFx', 'bFct', 'sEF', 'Drive', 'ghst',
              'RawD', 'Flux', 'hhDlt', 'BassE', 'Veto', 'WNS']
    print(f"  {'field':>8} {'real':>8} {'synth':>8} {'ratio':>8}")
    for f in fields:
        real_avg = sum(rows[i][f] for i in real_snares) / len(real_snares)
        synth_avg = sum(rows[i][f] for i in synth_fps) / len(synth_fps)
        ratio = synth_avg / real_avg if real_avg > 0.001 else float('inf')
        print(f"  {f:>8} {real_avg:>8.3f} {synth_avg:>8.3f} {ratio:>8.2f}")
