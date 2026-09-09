#!/usr/bin/env python3
"""Show context around the 2 misses (frames 182 and 217)."""
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

# Show context around frame 182 (miss) and frame 217 (miss)
# Also show context around frame 148 (onset) and 252 (onset) for comparison
for label, center in [("ONSET #3 (frame 148)", 148), ("MISS (frame 182)", 182), ("MISS (frame 217)", 217), ("ONSET #4 (frame 252)", 252)]:
    print(f"\n{'='*80}")
    print(f"{label}")
    print(f"{'='*80}")
    start = max(0, center - 5)
    end = min(len(rows), center + 8)
    print(f"  {'fr':>3} {'UnG':>6} {'Res':>6} {'Drive':>7} {'ghst':>7} {'dynTh':>6} {'fFloor':>6} {'sd':>6} {'gRefr':>5} {'OutSnare':>8} {'onset':>5}")
    for i in range(start, end):
        r = rows[i]
        is_onset = "ONSET" if r['onset'] else ""
        marker = " <<<" if i == center else ""
        print(f"  {i:>3} {r['UnG']:>6.3f} {r['Res']:>6.3f} {r['Drive']:>7.4f} {r['ghst']:>7.4f} {r['dynTh']:>6.4f} {r['fFloor']:>6.3f} {r['sd']:>6.3f} {r['gRefr']:>5.0f} {r['OutSnare']:>8.3f} {is_onset:>5}{marker}")

# Key comparison: what do successful onsets have that misses don't?
print(f"\n{'='*80}")
print("COMPARISON: Successful onsets vs Misses")
print(f"{'='*80}")
onset_frames = [78, 112, 148, 252, 287]
miss_frames = [182, 217]
print(f"  {'frame':>5} {'type':>6} {'UnG':>6} {'Res':>6} {'cFx':>6} {'bFct':>6} {'sEF':>6} {'Drive':>7} {'ghst':>7} {'dynTh':>6} {'sd':>6} {'Flux':>6} {'RawD':>6} {'hhDlt':>7}")
for f in onset_frames:
    r = rows[f]
    print(f"  {f:>5} {'ONSET':>6} {r['UnG']:>6.3f} {r['Res']:>6.3f} {r['cFx']:>6.3f} {r['bFct']:>6.3f} {r['sEF']:>6.3f} {r['Drive']:>7.4f} {r['ghst']:>7.4f} {r['dynTh']:>6.4f} {r['sd']:>6.3f} {r['Flux']:>6.3f} {r['RawD']:>6.3f} {r['hhDlt']:>7.4f}")
for f in miss_frames:
    r = rows[f]
    print(f"  {f:>5} {'MISS':>6} {r['UnG']:>6.3f} {r['Res']:>6.3f} {r['cFx']:>6.3f} {r['bFct']:>6.3f} {r['sEF']:>6.3f} {r['Drive']:>7.4f} {r['ghst']:>7.4f} {r['dynTh']:>6.4f} {r['sd']:>6.3f} {r['Flux']:>6.3f} {r['RawD']:>6.3f} {r['hhDlt']:>7.4f}")
