#!/usr/bin/env python3
"""Is the GodEarFFT crack-band gate ALIVE or DEAD per track?
If alive -> trust SnareE, no relaxation needed.
If dead  -> relaxation justified (Brejcha/Tiesto synthetic snares)."""
import re
import os

LOG_DIR = r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\newalgorythm"

def parse(path):
    out = []
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            if '[FINESSE_AUDIT]' not in line:
                continue
            e = {}
            for n, rx in [('SnareE', r'SnareE:([-\d.]+)'), ('sd', r'sd:([-\d.]+)'),
                          ('hE', r'hE:([-\d.]+)'), ('Res', r'Res:([-\d.]+)'),
                          ('cFx', r'cFx:([-\d.]+)'), ('bFct', r'bFct:([-\d.]+)'),
                          ('sEF', r'sEF:([-\d.]+)'), ('Drive', r'Drive:([-\d.]+)'),
                          ('dynTh', r'dynTh:([-\d.]+)')]:
                m = re.search(rx, line)
                e[n] = float(m.group(1)) if m else 0.0
            e['onset'] = '[ONSET]' in line
            out.append(e)
    return out

def run(name, audits):
    ses = [a['SnareE'] for a in audits]
    n = len(ses)
    alive = sum(1 for v in ses if v > 0.10)
    dead = sum(1 for v in ses if v < 0.01)
    # slow EMA of SnareE, alpha ~ 0.01 (~100 frames = ~2.3s @44fps)
    ema = 0.0
    emas = []
    for v in ses:
        ema += 0.01 * (v - ema)
        emas.append(ema)
    print(f"  {name:18s} SnareE mean={sum(ses)/n:.3f}  "
          f">0.10:{100*alive/n:3.0f}%  <0.01:{100*dead/n:3.0f}%  "
          f"EMA final={emas[-1]:.3f}  EMA max={max(emas):.3f}")

    # Proposed gate-health factor: how much relaxation is justified?
    # health = min(1, snareEnergyEma / 0.15)  -> 1 = gate alive, 0 = gate dead
    # relaxation should be scaled by (1 - health)
    onsets = [(i, a) for i, a in enumerate(audits) if a['onset']]
    kept = killed = 0
    for i, a in onsets:
        health = min(1.0, emas[i] / 0.15)
        treble = min(1.0, a['hE'] * 2.0)
        gate = 1.0 - a['sd']
        # relaxation now ALSO scaled by (1 - health)
        relaxed = 0.05 + 0.35 * treble * gate * (1.0 - health)
        sef = max(relaxed, min(1.0, a['SnareE'] * 2.0))
        drive = a['Res'] * a['cFx'] * a['bFct'] * sef
        if drive >= a['dynTh']:
            kept += 1
        else:
            killed += 1
    print(f"  {'':18s} -> health-scaled relaxation: {kept} keep / {killed} kill "
          f"(of {len(onsets)})")

print("GATE HEALTH per track (is SnareE usable?)")
print("=" * 78)
for name, fname in [('MINIMAL', 'minimalcalib4.md'), ('BREJCHA', 'gravitycalib4.md'),
                    ('TIESTO', 'tiestocalib4.md'), ('TECHHOUSE', 'techhouse4.md')]:
    path = os.path.join(LOG_DIR, fname)
    if os.path.exists(path):
        run(name, parse(path))
