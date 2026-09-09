#!/usr/bin/env python3
"""Diagnose techhouse gap + opus snare loss."""
import re
from pathlib import Path

PAT = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+Raw\u0394:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+Bass\u0394:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+rGate:(?P<rGate>[-\d.]+)\s+gRefr:(?P<gRefr>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)"
)

def parse(path):
    text = Path(path).read_text(encoding="utf-8", errors="replace")
    rows = []
    for line in text.splitlines():
        if "[FINESSE_AUDIT]" not in line: continue
        m = PAT.search(line)
        if not m: continue
        d = {k: float(v) for k, v in m.groupdict().items()}
        rows.append(d)
    return rows

# ── TECHHOUSE gap analysis ──
rows = parse(r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\techhouse8.md")
print("=" * 80)
print("TECHHOUSE — GAP ANALYSIS (frames 64-249, the missing roll)")
print("=" * 80)
gap = rows[64:250] if len(rows) >= 250 else rows[64:]
print(f"Frames in gap: {len(gap)}")
if gap:
    print(f"SnareE: min={min(r['SnareE'] for r in gap):.3f} max={max(r['SnareE'] for r in gap):.3f} mean={sum(r['SnareE'] for r in gap)/len(gap):.3f}")
    print(f"UnG:    min={min(r['UnG'] for r in gap):.3f} max={max(r['UnG'] for r in gap):.3f} mean={sum(r['UnG'] for r in gap)/len(gap):.3f}")
    print(f"Flux:   min={min(r['Flux'] for r in gap):.3f} max={max(r['Flux'] for r in gap):.3f} mean={sum(r['Flux'] for r in gap)/len(gap):.3f}")
    print(f"Res:    min={min(r['Res'] for r in gap):.3f} max={max(r['Res'] for r in gap):.3f} mean={sum(r['Res'] for r in gap)/len(gap):.3f}")
    print(f"Drive:  min={min(r['Drive'] for r in gap):.3f} max={max(r['Drive'] for r in gap):.3f} mean={sum(r['Drive'] for r in gap)/len(gap):.3f}")
    print(f"ghst:   min={min(r['ghst'] for r in gap):.4f} max={max(r['ghst'] for r in gap):.4f}")
    print(f"gH:     min={min(r['gH'] for r in gap):.3f} max={max(r['gH'] for r in gap):.3f}")
    print(f"hE:     min={min(r['hE'] for r in gap):.3f} max={max(r['hE'] for r in gap):.3f}")
    print(f"hhDlt:  min={min(r['hhDlt'] for r in gap):.4f} max={max(r['hhDlt'] for r in gap):.4f}")

    # Top frames by Drive in gap
    sorted_gap = sorted(enumerate(gap), key=lambda x: x[1]['Drive'], reverse=True)
    print(f"\nTop 15 frames by Drive in gap:")
    for i, (idx, r) in enumerate(sorted_gap[:15]):
        crackD = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
        real_frame = idx + 64
        print(f"  frame={real_frame:>3} SnareE={r['SnareE']:.3f} Drive={r['Drive']:.4f} crackD={crackD:.4f} ghst={r['ghst']:.4f} Flux={r['Flux']:.3f} Res={r['Res']:.3f} UnG={r['UnG']:.3f} gH={r['gH']:.3f} gRefr={r['gRefr']:.0f}")

    # Top frames by UnG in gap (ghost activity)
    sorted_ung = sorted(enumerate(gap), key=lambda x: x[1]['UnG'], reverse=True)
    print(f"\nTop 15 frames by UnG in gap (ghost/treble activity):")
    for i, (idx, r) in enumerate(sorted_ung[:15]):
        crackD = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
        real_frame = idx + 64
        print(f"  frame={real_frame:>3} SnareE={r['SnareE']:.3f} UnG={r['UnG']:.3f} Flux={r['Flux']:.3f} Res={r['Res']:.3f} crackD={crackD:.4f} ghst={r['ghst']:.4f} Drive={r['Drive']:.4f} gH={r['gH']:.3f}")

# ── OPUS analysis ──
rows2 = parse(r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\opuspyrytdz8.md")
print("\n" + "=" * 80)
print(f"OPUS_PRYTDZ — FULL TRACK ({len(rows2)} frames)")
print("=" * 80)
print(f"SnareE: min={min(r['SnareE'] for r in rows2):.3f} max={max(r['SnareE'] for r in rows2):.3f} mean={sum(r['SnareE'] for r in rows2)/len(rows2):.3f}")
print(f"UnG:    min={min(r['UnG'] for r in rows2):.3f} max={max(r['UnG'] for r in rows2):.3f} mean={sum(r['UnG'] for r in rows2)/len(rows2):.3f}")
print(f"Flux:   min={min(r['Flux'] for r in rows2):.3f} max={max(r['Flux'] for r in rows2):.3f} mean={sum(r['Flux'] for r in rows2)/len(rows2):.3f}")
print(f"Res:    min={min(r['Res'] for r in rows2):.3f} max={max(r['Res'] for r in rows2):.3f} mean={sum(r['Res'] for r in rows2)/len(rows2):.3f}")
print(f"hE:     min={min(r['hE'] for r in rows2):.3f} max={max(r['hE'] for r in rows2):.3f} mean={sum(r['hE'] for r in rows2)/len(rows2):.3f}")
print(f"hhDlt:  min={min(r['hhDlt'] for r in rows2):.4f} max={max(r['hhDlt'] for r in rows2):.4f}")
print(f"ghst:   min={min(r['ghst'] for r in rows2):.4f} max={max(r['ghst'] for r in rows2):.4f}")

# Frames with SnareE > 0.1
snare_frames = [(i, r) for i, r in enumerate(rows2) if r['SnareE'] > 0.1]
print(f"\nFrames with SnareE > 0.1: {len(snare_frames)}/{len(rows2)}")
for idx, r in snare_frames[:20]:
    print(f"  frame={idx:>3} SnareE={r['SnareE']:.3f} UnG={r['UnG']:.3f} Flux={r['Flux']:.3f} Res={r['Res']:.3f} Drive={r['Drive']:.4f}")

# Frames with UnG > 0.3 but SnareE < 0.1
ghost_frames = [(i, r) for i, r in enumerate(rows2) if r['UnG'] > 0.3 and r['SnareE'] < 0.1]
print(f"\nFrames with UnG > 0.3 but SnareE < 0.1: {len(ghost_frames)}/{len(rows2)}")
for idx, r in ghost_frames[:20]:
    crackD = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
    print(f"  frame={idx:>3} SnareE={r['SnareE']:.3f} UnG={r['UnG']:.3f} Flux={r['Flux']:.3f} Res={r['Res']:.3f} crackD={crackD:.4f} ghst={r['ghst']:.4f} hE={r['hE']:.3f} hhDlt={r['hhDlt']:.4f} Drive={r['Drive']:.4f}")

# Distribution of SnareE
buckets = [0, 0.001, 0.01, 0.05, 0.1, 0.2, 0.5, 1.0]
print(f"\nSnareE distribution:")
for i in range(len(buckets)-1):
    c = sum(1 for r in rows2 if buckets[i] <= r['SnareE'] < buckets[i+1])
    print(f"  {buckets[i]:.3f}-{buckets[i+1]:.3f}: {c} frames ({100*c/len(rows2):.0f}%)")
