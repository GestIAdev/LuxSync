#!/usr/bin/env python3
"""Analyze the 3-4 synth FPs from the user's paste."""
import re

PAT = re.compile(
    r"SnareE:(?P<SnareE>[-\d.]+)\s+UnG:(?P<UnG>[-\d.]+)\s+Raw\u0394:(?P<RawD>[-\d.]+)\s+Flux:(?P<Flux>[-\d.]+)\s+WNS:(?P<WNS>[-\d.]+)\s+fBL:(?P<fBL>[-\d.]+)\s+Gate:(?P<Gate>[-\d.]+)\s+Veto:(?P<Veto>[-\d.]+)\s+BassE:(?P<BassE>[-\d.]+)\s+Bass\u0394:(?P<BassD>[-\d.]+)\s+k:(?P<k>[-\d.]+)\s+Res:(?P<Res>[-\d.]+)\s+cFx:(?P<cFx>[-\d.]+)\s+bFct:(?P<bFct>[-\d.]+)\s+sEF:(?P<sEF>[-\d.]+)\s+Drive:(?P<Drive>[-\d.]+)\s+fFloor:(?P<fFloor>[-\d.]+)\s+dynTh:(?P<dynTh>[-\d.]+)\s+sd:(?P<sd>[-\d.]+)\s+hE:(?P<hE>[-\d.]+)\s+hhDlt:(?P<hhDlt>[-\d.]+)\s+ghst:(?P<ghst>[-\d.]+)\s+gH:(?P<gH>[-\d.]+)\s+rGate:(?P<rGate>[-\d.]+)\s+gRefr:(?P<gRefr>[-\d.]+)\s+OutSnare:(?P<OutSnare>[-\d.]+)\s+OutKick:(?P<OutKick>[-\d.]+)"
)

text = """SnareE:0.544 UnG:0.507 RawΔ:0.212 Flux:0.093 WNS:0.000 fBL:0.011 Gate:0.120 Veto:0.282 BassE:0.367 BassΔ:0.014 k:0.703 Res:0.252 cFx:0.307 bFct:2.000 sEF:1.000 Drive:0.155 fFloor:0.070 dynTh:0.013 sd:0.180 hE:0.151 hhDlt:0.0861 ghst:0.0162 gH:0.214 rGate:0.29 gRefr:7 OutSnare:1.000 OutKick:0.000 [ONSET]
SnareE:0.762 UnG:0.578 RawΔ:0.436 Flux:0.194 WNS:0.192 fBL:0.018 Gate:0.120 Veto:0.721 BassE:0.583 BassΔ:-0.016 k:0.516 Res:0.282 cFx:0.351 bFct:2.000 sEF:1.000 Drive:0.198 fFloor:0.070 dynTh:0.016 sd:0.251 hE:0.280 hhDlt:0.2367 ghst:0.0321 gH:0.772 rGate:0.79 gRefr:7 OutSnare:1.000 OutKick:0.000 [ONSET]
SnareE:0.672 UnG:0.490 RawΔ:0.401 Flux:0.127 WNS:0.000 fBL:0.018 Gate:0.120 Veto:0.209 BassE:0.616 BassΔ:-0.055 k:0.376 Res:0.262 cFx:0.269 bFct:1.693 sEF:1.000 Drive:0.119 fFloor:0.070 dynTh:0.016 sd:0.169 hE:0.168 hhDlt:0.1525 ghst:0.0000 gH:1.000 rGate:1.00 gRefr:7 OutSnare:1.000 OutKick:0.000 [ONSET]
SnareE:0.357 UnG:0.570 RawΔ:0.480 Flux:0.151 WNS:0.000 fBL:0.017 Gate:0.120 Veto:0.239 BassE:0.638 BassΔ:-0.022 k:0.274 Res:0.401 cFx:0.327 bFct:1.372 sEF:0.714 Drive:0.128 fFloor:0.070 dynTh:0.017 sd:0.208 hE:0.225 hhDlt:0.2270 ghst:0.0000 gH:1.000 rGate:1.00 gRefr:7 OutSnare:1.000 OutKick:0.000 [ONSET]
SnareE:0.756 UnG:0.431 RawΔ:0.307 Flux:0.070 WNS:0.000 fBL:0.016 Gate:0.120 Veto:0.085 BassE:0.709 BassΔ:-0.026 k:0.229 Res:0.273 cFx:0.198 bFct:1.658 sEF:1.000 Drive:0.090 fFloor:0.070 dynTh:0.015 sd:0.141 hE:0.127 hhDlt:0.0882 ghst:0.0000 gH:1.000 rGate:1.00 gRefr:7 OutSnare:1.000 OutKick:0.000 [ONSET]
SnareE:0.111 UnG:0.664 RawΔ:0.413 Flux:0.310 WNS:1.000 fBL:0.027 Gate:0.120 Veto:1.000 BassE:0.461 BassΔ:-0.025 k:0.181 Res:0.590 cFx:0.322 bFct:0.100 sEF:0.532 Drive:0.010 fFloor:0.070 dynTh:0.023 sd:0.507 hE:0.662 hhDlt:0.3815 ghst:0.0000 gH:1.000 rGate:1.00 gRefr:7 OutSnare:1.000 OutKick:0.000 [ONSET]"""

rows = []
for line in text.strip().splitlines():
    m = PAT.search(line)
    if m:
        d = {k: float(v) for k, v in m.groupdict().items()}
        rows.append(d)

print(f"SYNTH FP ANALYSIS — {len(rows)} onsets, ALL synth FPs (user confirmed)")
print("="*90)

print(f"\n{'#':>2} {'SnareE':>7} {'UnG':>6} {'Res':>6} {'cFx':>6} {'bFct':>6} {'sEF':>6} {'Drive':>7} {'crackD':>7} {'ghst':>7} {'WNS':>5} {'Flux':>6} {'gH':>5} {'Veto':>5} {'hE':>6} {'path':>12}")
for i, r in enumerate(rows, 1):
    crackD = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
    bypass = r['UnG'] > 0.4 and r['Res'] > 0.3 and r['RawD'] > 0.2 and r['Flux'] > 0.15
    macd = r['Drive'] >= r['fFloor']
    if bypass and not macd:
        path = "BYPASS"
    elif macd:
        path = "MACD"
    else:
        path = "???"
    print(f"{i:>2} {r['SnareE']:>7.3f} {r['UnG']:>6.3f} {r['Res']:>6.3f} {r['cFx']:>6.3f} {r['bFct']:>6.3f} {r['sEF']:>6.3f} {r['Drive']:>7.4f} {crackD:>7.4f} {r['ghst']:>7.4f} {r['WNS']:>5.3f} {r['Flux']:>6.3f} {r['gH']:>5.3f} {r['Veto']:>5.3f} {r['hE']:>6.3f} {path:>12}")

# Compare with real snares from missedsnare.md
print(f"\n{'='*90}")
print("COMPARISON: These synth FPs vs missedsnare real snares")
print(f"{'='*90}")
real = [
    {'UnG':0.567,'Res':0.449,'WNS':1.000,'Flux':0.475,'gH':0.029,'SnareE':0.000,'Drive':0.089,'Veto':0.889,'hE':0.417,'BassE':0.675},
    {'UnG':0.481,'Res':0.362,'WNS':0.000,'Flux':0.346,'gH':0.028,'SnareE':0.000,'Drive':0.081,'Veto':0.840,'hE':0.425,'BassE':0.635},
    {'UnG':0.620,'Res':0.565,'WNS':0.354,'Flux':0.469,'gH':0.028,'SnareE':0.000,'Drive':0.091,'Veto':0.796,'hE':0.400,'BassE':0.760},
    {'UnG':0.764,'Res':0.713,'WNS':0.568,'Flux':0.396,'gH':0.027,'SnareE':0.000,'Drive':0.171,'Veto':0.814,'hE':0.483,'BassE':0.768},
    {'UnG':0.606,'Res':0.573,'WNS':0.220,'Flux':0.311,'gH':0.026,'SnareE':0.000,'Drive':0.113,'Veto':0.737,'hE':0.490,'BassE':0.710},
]

print(f"\n  {'field':>8} {'synth_avg':>10} {'real_avg':>10} {'discrim?':>10}")
fields = ['SnareE','UnG','Res','WNS','Flux','gH','Veto','hE','BassE','Drive']
for f in fields:
    synth_avg = sum(r[f] for r in rows) / len(rows)
    real_avg = sum(r[f] for r in real) / len(real)
    diff = abs(synth_avg - real_avg)
    discrim = "YES" if diff > 0.15 else "no"
    print(f"  {f:>8} {synth_avg:>10.3f} {real_avg:>10.3f} {discrim:>10}")

# Key discriminators
print(f"\n{'='*90}")
print("KEY DISCRIMINATORS (synth FP vs real snare)")
print(f"{'='*90}")
print("""
1. gH (gate health):
   - Synth FPs: 0.214-1.000 (gate ALIVE for 5/6)
   - Real snares: 0.026-0.029 (gate DEAD)
   -> When gH > 0.1, apply WNS gate to crack path

2. WNS (white noise):
   - Synth FPs: 0.000-0.192 (4/6 have WNS=0.000)
   - Real snares: 0.000-1.000 (1/5 has WNS=0.000, but gH~0)
   -> When gH > 0.1 AND WNS < 0.05, reduce crackDrive 70%

3. Flux (spectral flux):
   - Synth FPs: 0.070-0.310 (5/6 have Flux < 0.20)
   - Real snares: 0.311-0.475 (all > 0.31)
   -> When gH > 0.1 AND Flux < 0.15, could also block

4. SnareE (gated snare energy):
   - Synth FPs: 0.111-0.762 (5/6 have SnareE > 0.3)
   - Real snares: 0.000 (all dead-gate)
   -> NOT useful - alive-gate real snares would also have high SnareE
""")

# Test proposed fix: WNS soft gate on crack path when gH > 0.1
print(f"{'='*90}")
print("PROPOSED FIX: WNS soft gate on crack path (gH > 0.1 AND WNS < 0.05 -> crackDrive x 0.3)")
print(f"{'='*90}")
print(f"\n  {'#':>2} {'gH':>5} {'WNS':>5} {'Drive':>7} {'reduced':>8} {'fFloor':>7} {'blocked?':>8}")
for i, r in enumerate(rows, 1):
    crackD = r['Res'] * r['cFx'] * r['bFct'] * r['sEF']
    apply_gate = r['gH'] > 0.1 and r['WNS'] < 0.05
    reduced = crackD * 0.3 if apply_gate else crackD
    # For bypass rescue onsets, check if bypass still fires
    bypass = r['UnG'] > 0.4 and r['Res'] > 0.3 and r['RawD'] > 0.2 and r['Flux'] > 0.15
    blocked = reduced < r['fFloor'] and not bypass
    status = "BLOCKED" if blocked else "fires"
    print(f"  {i:>2} {r['gH']:>5.3f} {r['WNS']:>5.3f} {crackD:>7.4f} {reduced:>8.4f} {r['fFloor']:>7.3f} {status:>8} {'(bypass!)' if bypass else ''}")

# Check: would this fix break missedsnare real snares?
print(f"\n  missedsnare real snares (gH≈0, all dead-gate):")
for i, r in enumerate(real, 1):
    apply_gate = r['gH'] > 0.1 and r['WNS'] < 0.05
    status = "GATED" if apply_gate else "safe"
    print(f"  #{i} gH={r['gH']:.3f} WNS={r['WNS']:.3f} → {status}")
