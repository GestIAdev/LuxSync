#!/usr/bin/env python3
"""Analyze minimalcorto17 — find misses with lower thresholds."""
import re
from pathlib import Path

PAT = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+Raw\u0394:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+Bass\u0394:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+fFloor:(?P<fFloor>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+rGate:(?P<rGate>[-\d.]+)\s+gRefr:(?P<gRefr>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)"
)

rows = []
text = Path(r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\minimalcorto17.md").read_text(encoding="utf-8", errors="replace")
for line in text.splitlines():
    if "[FINESSE_AUDIT]" not in line: continue
    m = PAT.search(line)
    if not m: continue
    d = {k: float(v) for k, v in m.groupdict().items()}
    d['onset'] = '[ONSET]' in line
    rows.append(d)

onsets = [i for i, r in enumerate(rows) if r['onset']]

# Show ALL frames with UnG > 0.3, marking onsets and refractory state
print("ALL FRAMES with UnG > 0.25:")
print(f"  {'fr':>3} {'UnG':>6} {'Res':>6} {'cFx':>6} {'RawD':>6} {'Flux':>6} {'Drive':>7} {'sEF':>6} {'ghst':>7} {'gRefr':>5} {'onset':>5} {'gap':>4}")
for i, r in enumerate(rows):
    if r['UnG'] > 0.25:
        prev_onset = max((o for o in onsets if o < i), default=-1)
        gap = i - prev_onset if prev_onset >= 0 else -1
        is_onset = "ONSET" if r['onset'] else ""
        print(f"  {i:>3} {r['UnG']:>6.3f} {r['Res']:>6.3f} {r['cFx']:>6.3f} {r['RawD']:>6.3f} {r['Flux']:>6.3f} {r['Drive']:>7.4f} {r['sEF']:>6.3f} {r['ghst']:>7.4f} {r['gRefr']:>5.0f} {is_onset:>5} {gap:>4}")

# Focus on the 12-frame gap between onset #10 (frame 52) and #11 (frame 64)
print("\n" + "="*80)
print("GAP ANALYSIS: frames 53-63 (between onset #10 at 52 and #11 at 64)")
print("="*80)
for i in range(53, min(64, len(rows))):
    r = rows[i]
    crackDrive = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
    ghostUnGGate = max(0, min(1, (r['UnG'] - 0.30) / 0.20))
    print(f"  frame {i}: UnG={r['UnG']:.3f} Res={r['Res']:.3f} cFx={r['cFx']:.3f} "
          f"bFct={r['bFct']:.3f} sEF={r['sEF']:.3f} Drive={r['Drive']:.4f} "
          f"crackDrive={crackDrive:.4f} ghostUnGGate={ghostUnGGate:.2f} "
          f"ghst={r['ghst']:.4f} gRefr={r['gRefr']:.0f} "
          f"Flux={r['Flux']:.3f} RawD={r['RawD']:.3f} hhDlt={r['hhDlt']:.4f}")

# Show the full onset list with numbering
print("\n" + "="*80)
print("ONSET LIST (numbered):")
print("="*80)
for n, idx in enumerate(onsets, 1):
    r = rows[idx]
    print(f"  #{n:2d} frame {idx:3d}: UnG={r['UnG']:.3f} Res={r['Res']:.3f} "
          f"RawD={r['RawD']:.3f} Drive={r['Drive']:.4f} "
          f"Flux={r['Flux']:.3f} fFloor={r['fFloor']:.3f}")
