#!/usr/bin/env python3
"""Analyze Opus build10 — quantify recovery + diagnose misses."""
import re
from pathlib import Path

PAT = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+Raw\u0394:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+Bass\u0394:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+fFloor:(?P<fFloor>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+rGate:(?P<rGate>[-\d.]+)\s+gRefr:(?P<gRefr>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)"
)

rows = []
text = Path(r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\oppusbuild10.md").read_text(encoding="utf-8", errors="replace")
for line in text.splitlines():
    if "[FINESSE_AUDIT]" not in line: continue
    m = PAT.search(line)
    if not m: continue
    d = {k: float(v) for k, v in m.groupdict().items()}
    d['onset'] = '[ONSET]' in line
    rows.append(d)

print(f"OPUS BUILD 10 - {len(rows)} frames")
print("="*80)

onsets = [r for r in rows if r['onset']]
print(f"Onsets: {len(onsets)} ({len(onsets)/len(rows)*44:.1f}/s @ 44fps)")
print(f"Duration: {len(rows)/44:.1f}s")

# sEF recovery
sef_vals = [r['sEF'] for r in rows]
print(f"\nsEF: min={min(sef_vals):.3f} max={max(sef_vals):.3f} mean={sum(sef_vals)/len(sef_vals):.3f}")
print(f"  Was 0.050 stuck, now: {sum(1 for v in sef_vals if v > 0.15)}/{len(rows)} frames above 0.15")

# Drive recovery
drive_vals = [r['Drive'] for r in rows]
print(f"\nDrive: min={min(drive_vals):.3f} max={max(drive_vals):.3f} mean={sum(drive_vals)/len(drive_vals):.4f}")
print(f"  Frames with Drive > 0.005: {sum(1 for v in drive_vals if v > 0.005)}/{len(rows)}")
print(f"  Frames with Drive > 0.01:  {sum(1 for v in drive_vals if v > 0.01)}/{len(rows)}")

# Miss analysis: frames with high Drive potential but no onset
print("\n" + "="*80)
print("MISS ANALYSIS - frames with Res > 0.10 AND cFx > 0.15 but NO onset")
print("="*80)
misses = [r for r in rows if not r['onset'] and r['Res'] > 0.10 and r['cFx'] > 0.15]
print(f"Potential misses: {len(misses)}")
print(f"\n  {'idx':>5} {'Res':>6} {'cFx':>6} {'bFct':>6} {'sEF':>6} {'Drive':>7} {'fFloor':>7} {'gRefr':>6} {'ghst':>7} {'hhDlt':>7} | reason")
for i, r in enumerate(rows):
    if not r['onset'] and r['Res'] > 0.10 and r['cFx'] > 0.15:
        reason = ""
        if r['gRefr'] > 0:
            reason = f"BLOCKED by ghost refractory ({r['gRefr']:.0f} frames left)"
        elif r['Drive'] < r['fFloor']:
            reason = f"Drive < fFloor ({r['Drive']:.4f} < {r['fFloor']:.4f})"
        else:
            reason = "MACD crossover didn't fire (momentum)"
        print(f"  {i:>5} {r['Res']:>6.3f} {r['cFx']:>6.3f} {r['bFct']:>6.3f} {r['sEF']:>6.3f} {r['Drive']:>7.4f} {r['fFloor']:>7.4f} {r['gRefr']:>6.0f} {r['ghst']:>7.4f} {r['hhDlt']:>7.4f} | {reason}")

# Ghost refractory impact
print("\n" + "="*80)
print("GHOST REFRACTORY IMPACT")
print("="*80)
refr_blocked = [r for r in rows if r['gRefr'] > 0 and r['Res'] > 0.08 and r['cFx'] > 0.10]
print(f"Frames blocked by gRefr with real snare potential: {len(refr_blocked)}")
if len(refr_blocked) > 0:
    print(f"  These frames have Res={sum(r['Res'] for r in refr_blocked)/len(refr_blocked):.3f} avg, cFx={sum(r['cFx'] for r in refr_blocked)/len(refr_blocked):.3f} avg")
    print(f"  At 120 BPM 16th rolls = 125ms = ~5.5 frames between snares")
    print(f"  Ghost refractory = 10 frames = ~227ms = BLOCKS every other roll snare!")

# Onset spacing
print("\n" + "="*80)
print("ONSET SPACING")
print("="*80)
onset_indices = [i for i, r in enumerate(rows) if r['onset']]
if len(onset_indices) > 1:
    spacings = [onset_indices[i+1] - onset_indices[i] for i in range(len(onset_indices)-1)]
    print(f"  Spacings (frames): {spacings}")
    print(f"  Min spacing: {min(spacings)} frames ({min(spacings)*22.7:.0f}ms)")
    print(f"  Max spacing: {max(spacings)} frames ({max(spacings)*22.7:.0f}ms)")
    print(f"  Mean spacing: {sum(spacings)/len(spacings):.1f} frames")
    print(f"  Spacings < 10 frames (would be blocked by gRefr=10): {sum(1 for s in spacings if s < 10)}")
