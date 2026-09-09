#!/usr/bin/env python3
"""Analyze anyma log — kick/snare ratio should be 1:1 (four-on-the-floor)."""
import re
from pathlib import Path

PAT = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+Raw\u0394:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+Bass\u0394:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+fFloor:(?P<fFloor>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+rGate:(?P<rGate>[-\d.]+)\s+gRefr:(?P<gRefr>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)"
)

rows = []
text = Path(r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm\aanymafinalboss.md").read_text(encoding="utf-8", errors="replace")
for line in text.splitlines():
    if "[FINESSE_AUDIT]" not in line: continue
    m = PAT.search(line)
    if not m: continue
    d = {k: float(v) for k, v in m.groupdict().items()}
    d['onset'] = '[ONSET]' in line
    d['kick'] = '[KICK]' in line
    rows.append(d)

onsets = [i for i, r in enumerate(rows) if r['onset']]
kicks = [i for i, r in enumerate(rows) if r['kick']]
print(f"ANYMA FINAL BOSS - {len(rows)} frames")
print(f"  Snares (ONSET): {len(onsets)}")
print(f"  Kicks (KICK):   {len(kicks)}")
print(f"  Ratio kick/snare: {len(kicks)/max(len(onsets),1):.1f}:1  (expected 1:1)")
print(f"  Missed snares (approx): {len(kicks) - len(onsets)}")
print("="*80)

# Show all onsets
print("\nALL SNARE ONSETS:")
for n, idx in enumerate(onsets, 1):
    r = rows[idx]
    crackD = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
    print(f"  #{n:2d} frame {idx:3d}: SnareE={r['SnareE']:.3f} UnG={r['UnG']:.3f} "
          f"Res={r['Res']:.3f} cFx={r['cFx']:.3f} bFct={r['bFct']:.3f} "
          f"Drive={r['Drive']:.4f} crackD={crackD:.4f} "
          f"Flux={r['Flux']:.3f} WNS={r['WNS']:.3f} "
          f"gH={r['gH']:.3f} Veto={r['Veto']:.3f}")

# Show all kicks
print(f"\nALL KICKS (first 20):")
for n, idx in enumerate(kicks[:20], 1):
    r = rows[idx]
    print(f"  #{n:2d} frame {idx:3d}: BassE={r['BassE']:.3f} BassD={r['BassD']:.3f} "
          f"OutKick={r['OutKick']:.3f}")

# Spacings between onsets
if len(onsets) > 1:
    spacings = [onsets[i+1] - onsets[i] for i in range(len(onsets)-1)]
    print(f"\nSnare spacings: {spacings}")
    # At 44fps, 1 beat at 128 BPM = 44*60/128 = 20.6 frames
    # 1:1 kick-snare means snare every 2 beats = 41 frames
    print(f"  Expected spacing (2 beats @128bpm @44fps): ~41 frames")

# Find MISSED snares: frames between kicks where there's strong snare signature
# but no onset. In 1:1 pattern, snare should be ~20 frames after each kick
print("\n" + "="*80)
print("MISSED SNARES — strong snare signature (UnG>0.3 AND Res>0.2) but no onset")
print("="*80)
misses = []
for i, r in enumerate(rows):
    if r['onset']: continue
    if r['UnG'] > 0.3 and r['Res'] > 0.2 and r['RawD'] > 0.15:
        prev_onset = max((o for o in onsets if o < i), default=-1)
        next_onset = min((o for o in onsets if o > i), default=-1)
        gap_prev = i - prev_onset if prev_onset >= 0 else -1
        gap_next = next_onset - i if next_onset >= 0 else -1
        crackD = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
        # Check why it was missed
        bypass = r['UnG'] > 0.4 and r['Res'] > 0.3 and r['RawD'] > 0.2 and r['Flux'] > 0.20 and not (r['SnareE'] < 0.2 and r['hE'] > 0.5)
        wns_gate = r['gH'] > 0.1 and r['WNS'] < 0.05
        misses.append(i)
        print(f"  frame {i:3d}: SnareE={r['SnareE']:.3f} UnG={r['UnG']:.3f} "
              f"Res={r['Res']:.3f} RawD={r['RawD']:.3f} "
              f"Drive={r['Drive']:.4f} crackD={crackD:.4f} "
              f"Flux={r['Flux']:.3f} WNS={r['WNS']:.3f} "
              f"gH={r['gH']:.3f} gRefr={r['gRefr']:.0f} "
              f"gap_prev={gap_prev} gap_next={gap_next} "
              f"bypass={bypass} wns_gate={wns_gate}")

print(f"\nTotal missed snare candidates: {len(misses)}")

# Key question: what does a successful Anyma snare look like vs a missed one?
print("\n" + "="*80)
print("ANYMA SNARE PROFILE (successful onsets)")
print("="*80)
if onsets:
    fields = ['SnareE','UnG','Res','cFx','bFct','sEF','Drive','Flux','WNS','gH','Veto','hE','BassE']
    print(f"  {'field':>8} {'min':>8} {'avg':>8} {'max':>8}")
    for f in fields:
        vals = [rows[i][f] for i in onsets]
        print(f"  {f:>8} {min(vals):>8.3f} {sum(vals)/len(vals):>8.3f} {max(vals):>8.3f}")

# What characterizes Anyma? 100% synthetic, gH=1.0 always, WNS=0 always
print("\n" + "="*80)
print("ANYMA CHARACTERISTICS vs OTHER TRACKS")
print("="*80)
print(f"  gH:  ALL {min(rows[i]['gH'] for i in onsets):.3f}-{max(rows[i]['gH'] for i in onsets):.3f} (always alive)")
print(f"  WNS: ALL {min(rows[i]['WNS'] for i in onsets):.3f}-{max(rows[i]['WNS'] for i in onsets):.3f} (zero white noise!)")
print(f"  SnareE: {min(rows[i]['SnareE'] for i in onsets):.3f}-{max(rows[i]['SnareE'] for i in onsets):.3f} (gate sees it)")
print()
print("  PROBLEM: WNS=0.000 on ALL Anyma onsets!")
print("  The WNS soft gate (gH>0.1 AND WNS<0.05 -> crackDrive*0.3)")
print("  is KILLING real Anyma snares because they're synthetic (no noise)!")
print()
print("  But Anyma snares that DID fire: they have high Flux (0.341-0.393)")
print("  and high SnareE (0.186-0.733) — the MACD crossover still works")
print("  for strong ones. The MISSED ones have lower Drive/Flux.")

# Check if WNS gate is blocking any of the missed candidates
print("\n" + "="*80)
print("WNS GATE IMPACT ON MISSED SNARES")
print("="*80)
for i in misses:
    r = rows[i]
    crackD_raw = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
    crackD_gated = crackD_raw * 0.3 if (r['gH'] > 0.1 and r['WNS'] < 0.05) else crackD_raw
    print(f"  frame {i}: crackD_raw={crackD_raw:.4f} crackD_gated={crackD_gated:.4f} "
          f"fFloor={r['fFloor']:.3f} "
          f"raw>{r['fFloor']:.0f}={crackD_raw > r['fFloor']} "
          f"gated>{r['fFloor']:.0f}={crackD_gated > r['fFloor']}")
