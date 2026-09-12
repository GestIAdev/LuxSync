#!/usr/bin/env python3
"""
Monte Carlo — Stage 1: Corpus parser + topology inventory.

Parses all FINESSE_AUDIT telemetry, interleaves BPM/PLL context lines,
and reports the topology of each log so we can (a) detect which parameter
set each capture used, and (b) categorize tracks for the fitness function.
"""
import re, os, json, statistics as st
from collections import defaultdict

DIR = os.path.dirname(os.path.abspath(__file__))

RE_AUDIT = re.compile(r'\[FINESSE_AUDIT\]\s+(.*)')
RE_KV    = re.compile(r'([A-Za-z\u0394]+):(-?[\d.]+)')
RE_ONSET = re.compile(r'\[ONSET\]')
RE_KICK  = re.compile(r'\[KICK\]')
RE_BPM   = re.compile(r'BPM=([\d.]+).*?PLL=(\w+)\s+phase=([\d.]+).*?beat #(\d+)')
RE_MSST  = re.compile(r'\[MSST\].*?(\w+)\s*\u2192\s*(\w+)')

FIELDS = ['SnareE','UnG','Raw\u0394','Flux','WNS','fBL','Gate','Veto','BassE','Bass\u0394',
          'k','Res','cFx','bFct','sEF','Drive','fFloor','dynTh','sd','hE','hhDlt',
          'ghst','gH','rGate','gRefr','OutSnare','OutKick']


def parse_file(path):
    frames = []
    bpm_ctx = {'bpm': 120.0, 'pll': 'FREEWHEEL', 'phase': 0.0, 'beat': 0}
    section = 'verse'
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        for lineno, line in enumerate(f, 1):
            mb = RE_BPM.search(line)
            if mb:
                bpm_ctx = {'bpm': float(mb.group(1)), 'pll': mb.group(2),
                           'phase': float(mb.group(3)), 'beat': int(mb.group(4))}
                continue
            ms = RE_MSST.search(line)
            if ms:
                section = ms.group(2)
                continue
            ma = RE_AUDIT.search(line)
            if not ma:
                continue
            payload = ma.group(1)
            kv = {}
            for km in RE_KV.finditer(payload):
                try:
                    kv[km.group(1)] = float(km.group(2))
                except ValueError:
                    pass
            # require the core fields, else it's a truncated first line
            if 'UnG' not in kv or 'Drive' not in kv:
                continue
            kv['_line']    = lineno
            kv['_onset']   = bool(RE_ONSET.search(payload))
            kv['_kick']    = bool(RE_KICK.search(payload))
            kv['_bpm']     = bpm_ctx['bpm']
            kv['_pll']     = bpm_ctx['pll']
            kv['_section'] = section
            frames.append(kv)
    return frames


def q(vals, p):
    if not vals:
        return 0.0
    s = sorted(vals)
    i = min(len(s) - 1, max(0, int(round(p * (len(s) - 1)))))
    return s[i]


def inventory():
    files = sorted(x for x in os.listdir(DIR) if x.endswith('.md'))
    corpus = {}
    print("=" * 118)
    print("CORPUS TOPOLOGY")
    print("=" * 118)
    hdr = (f"{'file':<26}{'frm':>5}{'ons':>5}{'ons/s':>7}{'bFct_min':>9}"
           f"{'fFloor':>14}{'gH_med':>7}{'SnE_med':>8}{'UnG_med':>8}"
           f"{'WNS>0':>7}{'Flux_p90':>9}{'hE_med':>7}{'bpm':>6}")
    print(hdr)
    print("-" * 118)
    for fn in files:
        fr = parse_file(os.path.join(DIR, fn))
        if not fr:
            continue
        corpus[fn] = fr
        ons = sum(1 for f in fr if f['_onset'])
        secs = len(fr) / 44.0
        bf   = [f.get('bFct', 1) for f in fr]
        ff   = [f.get('fFloor', 0) for f in fr]
        gh   = [f.get('gH', 0) for f in fr]
        sne  = [f.get('SnareE', 0) for f in fr]
        ung  = [f.get('UnG', 0) for f in fr]
        wns  = [f.get('WNS', 0) for f in fr]
        flx  = [f.get('Flux', 0) for f in fr]
        he   = [f.get('hE', 0) for f in fr]
        bpm  = st.median([f['_bpm'] for f in fr])
        print(f"{fn:<26}{len(fr):>5}{ons:>5}{ons/secs:>7.2f}{min(bf):>9.3f}"
              f"{min(ff):>6.3f}-{max(ff):<7.3f}{st.median(gh):>7.3f}"
              f"{st.median(sne):>8.3f}{st.median(ung):>8.3f}"
              f"{100*sum(1 for w in wns if w > 0.001)/len(wns):>6.0f}%"
              f"{q(flx,0.90):>9.3f}{st.median(he):>7.3f}{bpm:>6.0f}")
    print("-" * 118)
    return corpus


if __name__ == '__main__':
    corpus = inventory()
    tot_f = sum(len(v) for v in corpus.values())
    tot_o = sum(sum(1 for f in v if f['_onset']) for v in corpus.values())
    print(f"\nTOTAL: {len(corpus)} logs | {tot_f} frames ({tot_f/44.0:.0f}s) | {tot_o} onsets")
