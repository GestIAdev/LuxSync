#!/usr/bin/env python3
"""Analyze missedsnare.md — dead-gate track, synth false positives + misses."""
import re
from pathlib import Path

PAT = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+Raw\u0394:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+Bass\u0394:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+fFloor:(?P<fFloor>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+rGate:(?P<rGate>[-\d.]+)\s+gRefr:(?P<gRefr>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)"
)

rows = []
text = Path(r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\missedsnare.md").read_text(encoding="utf-8", errors="replace")
for line in text.splitlines():
    if "[FINESSE_AUDIT]" not in line: continue
    m = PAT.search(line)
    if not m: continue
    d = {k: float(v) for k, v in m.groupdict().items()}
    d['onset'] = '[ONSET]' in line
    rows.append(d)

onsets = [i for i, r in enumerate(rows) if r['onset']]
print(f"MISSEDSNARE - {len(rows)} frames, {len(onsets)} onsets ({len(onsets)/len(rows)*44:.1f}/s)")
print(f"gH range: {min(r['gH'] for r in rows):.3f}-{max(r['gH'] for r in rows):.3f}")
print(f"fFloor: {rows[0]['fFloor']:.3f} (all same?)")
print("="*80)

# All onsets
print("\nALL ONSETS:")
print(f"  {'idx':>4} {'UnG':>6} {'Res':>6} {'cFx':>6} {'bFct':>6} {'sEF':>6} {'Drive':>7} {'hhDlt':>7} {'Flux':>6} {'RawD':>6} {'BassE':>6} {'Veto':>6} {'gRefr':>5}")
for idx in onsets:
    r = rows[idx]
    print(f"  {idx:>4} {r['UnG']:>6.3f} {r['Res']:>6.3f} {r['cFx']:>6.3f} {r['bFct']:>6.3f} {r['sEF']:>6.3f} {r['Drive']:>7.4f} {r['hhDlt']:>7.4f} {r['Flux']:>6.3f} {r['RawD']:>6.3f} {r['BassE']:>6.3f} {r['Veto']:>6.3f} {r['gRefr']:>5.0f}")

# Spacings
if len(onsets) > 1:
    spacings = [onsets[i+1] - onsets[i] for i in range(len(onsets)-1)]
    print(f"\nSpacings: {spacings}")
    print(f"  min={min(spacings)} max={max(spacings)} mean={sum(spacings)/len(spacings):.1f}")

# MISSES: high UnG + high Res but no onset
print("\n" + "="*80)
print("POTENTIAL MISSES (UnG>0.4 AND Res>0.2 AND no onset AND gRefr=0)")
print("="*80)
for i, r in enumerate(rows):
    if r['onset']: continue
    if r['UnG'] > 0.4 and r['Res'] > 0.2 and r['gRefr'] == 0:
        crackDrive = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
        print(f"  frame {i}: UnG={r['UnG']:.3f} Res={r['Res']:.3f} cFx={r['cFx']:.3f} "
              f"bFct={r['bFct']:.3f} sEF={r['sEF']:.3f} Drive={r['Drive']:.4f} "
              f"crackDrive={crackDrive:.4f} Flux={r['Flux']:.3f} RawD={r['RawD']:.3f} "
              f"hhDlt={r['hhDlt']:.4f} BassE={r['BassE']:.3f}")

# MISSES blocked by refractory
print("\n" + "="*80)
print("MISSES BLOCKED BY REFRACTORY (UnG>0.4 AND Res>0.2 AND gRefr>0)")
print("="*80)
for i, r in enumerate(rows):
    if r['onset']: continue
    if r['UnG'] > 0.4 and r['Res'] > 0.2 and r['gRefr'] > 0:
        print(f"  frame {i}: UnG={r['UnG']:.3f} Res={r['Res']:.3f} Drive={r['Drive']:.4f} "
              f"gRefr={r['gRefr']:.0f} Flux={r['Flux']:.3f}")

# SYNTH FALSE POSITIVES: onsets with low Res/cFx (likely synth not snare)
print("\n" + "="*80)
print("POTENTIAL SYNTH FALSE POSITIVES (onsets with Res<0.25 AND cFx<0.20)")
print("="*80)
synth_fps = []
for idx in onsets:
    r = rows[idx]
    if r['Res'] < 0.25 and r['cFx'] < 0.20:
        synth_fps.append(idx)
        print(f"  frame {idx}: UnG={r['UnG']:.3f} Res={r['Res']:.3f} cFx={r['cFx']:.3f} "
              f"Drive={r['Drive']:.4f} hhDlt={r['hhDlt']:.4f} Flux={r['Flux']:.3f} "
              f"BassE={r['BassE']:.3f} Veto={r['Veto']:.3f}")

print(f"\n  Potential synth FPs: {len(synth_fps)} out of {len(onsets)} onsets")

# What differentiates snare onsets from synth FPs?
print("\n" + "="*80)
print("SNARE vs SYNTH comparison")
print("="*80)
real_snares = [idx for idx in onsets if rows[idx]['Res'] >= 0.25 or rows[idx]['cFx'] >= 0.20]
if real_snares and synth_fps:
    print(f"  Real snares ({len(real_snares)}):")
    for k in ['UnG', 'Res', 'cFx', 'Flux', 'RawD', 'hhDlt', 'BassE', 'Veto', 'Drive']:
        vals = [rows[i][k] for i in real_snares]
        print(f"    {k}: {min(vals):.3f}-{max(vals):.3f} (mean={sum(vals)/len(vals):.3f})")
    print(f"  Synth FPs ({len(synth_fps)}):")
    for k in ['UnG', 'Res', 'cFx', 'Flux', 'RawD', 'hhDlt', 'BassE', 'Veto', 'Drive']:
        vals = [rows[i][k] for i in synth_fps]
        print(f"    {k}: {min(vals):.3f}-{max(vals):.3f} (mean={sum(vals)/len(vals):.3f})")
