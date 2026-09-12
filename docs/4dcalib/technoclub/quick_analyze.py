#!/usr/bin/env python3
"""Quick combined analyzer for thebussinesstiesto.md"""
import re, os
from collections import defaultdict

RE_AUDIT = re.compile(r'\[FINESSE_AUDIT\]\s+(.*)')
RE_KV = re.compile(r'(\w+):(-?[\d.]+)')
RE_FLAGS = re.compile(r'\[(ONSET|KICK)\]')

def parse_line(line):
    m = RE_AUDIT.search(line)
    if not m: return None
    payload = m.group(1)
    kvs = {}
    for km in RE_KV.finditer(payload):
        try: kvs[km.group(1)] = float(km.group(2))
        except: pass
    flags = set(f.group(1) for f in RE_FLAGS.finditer(payload))
    return kvs, flags

filepath = r'C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\technoclub\thebussinesstiesto.md'
frames = []
with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
    for lineno, line in enumerate(f, 1):
        parsed = parse_line(line)
        if parsed:
            kvs, flags = parsed
            frames.append((lineno, kvs, flags))

onsets = []
misses = []
for i, (lineno, kvs, flags) in enumerate(frames):
    if 'ONSET' in flags:
        onsets.append({'idx': i, 'line': lineno, 'kvs': kvs, 'flags': flags})
    else:
        ung = kvs.get('UnG', 0)
        drive = kvs.get('Drive', 0)
        fFloor = kvs.get('fFloor', 0)
        if ung > 0.6 and drive < fFloor:
            misses.append({'idx': i, 'line': lineno, 'kvs': kvs, 'flags': flags})

print(f'Total frames: {len(frames)}')
print(f'Total onsets: {len(onsets)}')
print(f'Miss candidates (UnG>0.6, Drive<fFloor): {len(misses)}')
print()

# Onset gaps
print('ONSET SEQUENCE:')
for i, o in enumerate(onsets):
    if i == 0:
        gap = 0
        musical = 'START'
    else:
        gap = o['idx'] - onsets[i-1]['idx']
        if 38 <= gap <= 50: musical = 'BEAT 2-4'
        elif 80 <= gap <= 96: musical = 'FULL BAR'
        elif 18 <= gap <= 26: musical = '8th NOTE'
        elif 8 <= gap <= 14: musical = '16th NOTE'
        elif gap < 8: musical = 'DOUBLE!'
        else: musical = f'gap={gap}'
    k = o['kvs']
    kick = '[KICK]' if 'KICK' in o['flags'] else ''
    print(f'  L{o["line"]:5d} f={o["idx"]:4d} gap={gap:3d} {musical:>10} '
          f'Drive={k.get("Drive",0):.4f} UnG={k.get("UnG",0):.3f} '
          f'Res={k.get("Res",0):.3f} cFx={k.get("cFx",0):.3f} '
          f'bFct={k.get("bFct",0):.3f} WNS={k.get("WNS",0):.3f} '
          f'Flux={k.get("Flux",0):.3f} Veto={k.get("Veto",0):.3f} {kick}')

print()
print('GAP DISTRIBUTION:')
gap_types = defaultdict(int)
for i in range(1, len(onsets)):
    gap = onsets[i]['idx'] - onsets[i-1]['idx']
    if 38 <= gap <= 50: gap_types['BEAT 2-4'] += 1
    elif 80 <= gap <= 96: gap_types['FULL BAR'] += 1
    elif 18 <= gap <= 26: gap_types['8th NOTE'] += 1
    elif 8 <= gap <= 14: gap_types['16th NOTE'] += 1
    elif gap < 8: gap_types['DOUBLE!'] += 1
    else: gap_types[f'OTHER({gap})'] += 1
for k,v in sorted(gap_types.items(), key=lambda x:-x[1]):
    print(f'  {k:20s} {v:3d}')

print()
print(f'MISSED SNARES ({len(misses)} candidates):')
for m in misses[:40]:
    k = m['kvs']
    cause = ''
    if int(k.get('gRefr',0)) > 0: cause = 'REFRACTORY'
    elif k.get('Drive',0) < k.get('fFloor',0): cause = 'MACD_FLOOR'
    elif k.get('Veto',0) > 0.5: cause = 'VETO'
    kick = '[KICK]' if 'KICK' in m['flags'] else ''
    print(f'  L{m["line"]:5d} UnG={k.get("UnG",0):.3f} Drive={k.get("Drive",0):.4f} '
          f'fFloor={k.get("fFloor",0):.3f} gRefr={int(k.get("gRefr",0))} '
          f'Veto={k.get("Veto",0):.3f} Res={k.get("Res",0):.3f} '
          f'cFx={k.get("cFx",0):.3f} bFct={k.get("bFct",0):.3f} '
          f'WNS={k.get("WNS",0):.3f} Flux={k.get("Flux",0):.3f} {cause} {kick}')
