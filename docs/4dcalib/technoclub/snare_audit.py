#!/usr/bin/env python3
"""
Forensic Snare Audit — Missed Snare Hunter
Parses FINESSE_AUDIT logs and isolates frames where percussive energy is present
but the detector failed to fire [ONSET].
"""
import re
import sys
import os
from collections import defaultdict

# ── Regex to parse FINESSE_AUDIT lines ──────────────────────────────
RE_AUDIT = re.compile(r'\[FINESSE_AUDIT\]\s+(.*)')
RE_KV = re.compile(r'(\w+):(-?[\d.]+)')
RE_FLAGS = re.compile(r'\[(ONSET|KICK)\]')

def parse_line(line):
    """Extract all key:value pairs and flags from a FINESSE_AUDIT line."""
    m = RE_AUDIT.search(line)
    if not m:
        return None
    payload = m.group(1)
    kvs = {}
    for km in RE_KV.finditer(payload):
        try:
            kvs[km.group(1)] = float(km.group(2))
        except ValueError:
            pass
    flags = set(f.group(1) for f in RE_FLAGS.finditer(payload))
    return kvs, flags

def classify_miss(kvs, flags, prev_kvs, prev_flags):
    """
    Classify why a snare was missed.
    Returns (cause, details).
    """
    if 'ONSET' in flags:
        return None, None  # Not a miss

    snare_e = kvs.get('SnareE', 0)
    ung = kvs.get('UnG', 0)
    raw_delta = kvs.get('RawΔ', 0)  # RawΔ
    drive = kvs.get('Drive', 0)
    dyn_th = kvs.get('dynTh', 0)
    f_floor = kvs.get('fFloor', 0)
    veto = kvs.get('Veto', 0)
    cfx = kvs.get('cFx', 0)
    res = kvs.get('Res', 0)
    wns = kvs.get('WNS', 0)
    flux = kvs.get('Flux', 0)
    g_refr = int(kvs.get('gRefr', 0))
    hh_dlt = kvs.get('hhDlt', 0)
    ghst = kvs.get('ghst', 0)
    g_h = kvs.get('gH', 0)
    b_fct = kvs.get('bFct', 0)
    s_ef = kvs.get('sEF', 0)
    bass_e = kvs.get('BassE', 0)
    sd = kvs.get('sd', 0)

    # ── Is this a percussive peak that should have fired? ────────────
    # Criteria: UnG spike (>0.4) OR cFx spike (>0.15) OR Res spike (>0.3)
    # AND RawΔ > 0 (rising energy = real attack, not decay)
    is_percussive = (ung > 0.4 or cfx > 0.15 or res > 0.3) and raw_delta > 0.02

    if not is_percussive:
        return None, None

    # ── Classify the block cause ────────────────────────────────────

    # 1. Refractory block (gRefr > 0 means ghost refractory active)
    if g_refr > 0:
        return "REFRACTORY", f"gRefr={g_refr} frames post-onset, Drive={drive:.4f} killed"

    # 2. MACD asphyxia: Drive < fFloor (drive below dynamic floor)
    if drive < f_floor and drive > 0:
        return "MACD_FLOOR", f"Drive={drive:.4f} < fFloor={f_floor:.4f}, dynTh={dyn_th:.4f}"

    # 3. MACD threshold: Drive >= fFloor but momentum didn't cross dynTh
    #    (we can't see momentum directly, but if Drive is decent and no onset...)
    if drive >= f_floor and drive > 0.01:
        # Check if bypass rescue should have fired
        # Bypass requires: UnG>0.4 && Res>0.3 && RawΔ>0.2 && Flux>bypassTh
        bypass_flux_th = 0.08 if g_h < 0.1 else 0.20
        bypass_qualified = (ung > 0.4 and res > 0.3 and raw_delta > 0.2 and flux > bypass_flux_th)
        if bypass_qualified:
            # Check hi-hat exclusion
            hh_excluded = (snare_e < 0.2 and kvs.get('hE', 0) > 0.5)
            if hh_excluded:
                return "HIHAT_EXCLUSION", f"hE={kvs.get('hE',0):.3f}>0.5, SnareE={snare_e:.3f}<0.2"
            return "MACD_CROSSOVER_FAIL", f"Drive={drive:.4f}>=fFloor={f_floor:.4f} but no crossover, dynTh={dyn_th:.4f}"
        else:
            # Which bypass condition failed?
            fails = []
            if ung <= 0.4: fails.append(f"UnG={ung:.3f}<=0.4")
            if res <= 0.3: fails.append(f"Res={res:.3f}<=0.3")
            if raw_delta <= 0.2: fails.append(f"RawΔ={raw_delta:.3f}<=0.2")
            if flux <= bypass_flux_th: fails.append(f"Flux={flux:.3f}<={bypass_flux_th:.2f}")
            return "BYPASS_FAIL", f"Drive={drive:.4f}, bypass fails: {', '.join(fails)}"

    # 4. Drive collapsed to ~0 despite percussive input
    if drive < 0.001:
        # Why did drive collapse?
        if res < 0.01:
            return "NLMS_RESIDUAL_ZERO", f"Res={res:.4f} (NLMS cancelled snare), k={kvs.get('k',0):.3f}, BassE={bass_e:.3f}"
        if cfx < 0.01:
            return "CRACK_FLUX_ZERO", f"cFx={cfx:.4f} (no crack-band flux), Res={res:.4f}"
        if b_fct < 0.15:
            return "BODY_FACTOR_LOW", f"bFct={b_fct:.3f} (no body resonance), Res={res:.4f}, cFx={cfx:.4f}"
        if s_ef < 0.1:
            return "SEF_COLLAPSED", f"sEF={s_ef:.4f} (gate AND factor killed), SnareE={snare_e:.3f}"
        return "DRIVE_COLLAPSE", f"Res={res:.4f} cFx={cfx:.4f} bFct={b_fct:.3f} sEF={s_ef:.4f} → Drive={drive:.6f}"

    # 5. Tonality veto killed it (veto < 0.15)
    if veto < 0.15 and drive > 0:
        return "VETO_KILL", f"Veto={veto:.4f} (<0.15), WNS={wns:.3f}, Flux={flux:.3f}, Flatness implicit"

    # 6. Density path should have fired but didn't
    fbl = kvs.get('fBL', 0)
    if fbl > 0.09 and g_h < 0.05 and ung > 0.45 and drive >= f_floor:
        return "DENSITY_PATH_MISSED", f"fBL={fbl:.3f}>0.09, gH={g_h:.3f}<0.05, UnG={ung:.3f}>0.45 — should have fired"

    # 7. Sustain choke (can't detect directly, but if prev frame had onset and this is killed)
    if prev_flags and 'ONSET' in prev_flags:
        return "SUSTAIN_CHOKE", f"Post-onset frame killed, Drive={drive:.4f}"

    return "UNKNOWN", f"Drive={drive:.4f}, fFloor={f_floor:.4f}, Veto={veto:.3f}, gRefr={g_refr}"

def analyze_file(filepath):
    """Analyze a single log file."""
    filename = os.path.basename(filepath)
    frames = []
    onsets = 0
    missed = []

    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        for lineno, line in enumerate(f, 1):
            parsed = parse_line(line)
            if parsed is None:
                continue
            kvs, flags = parsed
            frames.append((lineno, kvs, flags))
            if 'ONSET' in flags:
                onsets += 1

    # Now scan for missed snares
    prev_kvs = None
    prev_flags = None
    for lineno, kvs, flags in frames:
        cause, details = classify_miss(kvs, flags, prev_kvs, prev_flags)
        if cause:
            missed.append({
                'line': lineno,
                'cause': cause,
                'details': details,
                'SnareE': kvs.get('SnareE', 0),
                'UnG': kvs.get('UnG', 0),
                'RawΔ': kvs.get('RawΔ', 0),
                'Drive': kvs.get('Drive', 0),
                'dynTh': kvs.get('dynTh', 0),
                'fFloor': kvs.get('fFloor', 0),
                'Veto': kvs.get('Veto', 0),
                'cFx': kvs.get('cFx', 0),
                'Res': kvs.get('Res', 0),
                'WNS': kvs.get('WNS', 0),
                'Flux': kvs.get('Flux', 0),
                'gRefr': int(kvs.get('gRefr', 0)),
                'gH': kvs.get('gH', 0),
                'hE': kvs.get('hE', 0),
                'hhDlt': kvs.get('hhDlt', 0),
                'ghst': kvs.get('ghst', 0),
                'bFct': kvs.get('bFct', 0),
                'sEF': kvs.get('sEF', 0),
                'BassE': kvs.get('BassE', 0),
                'sd': kvs.get('sd', 0),
                'k': kvs.get('k', 0),
                'fBL': kvs.get('fBL', 0),
                'is_kick': 'KICK' in flags,
            })
        prev_kvs = kvs
        prev_flags = flags

    return filename, len(frames), onsets, missed

def print_report(results):
    """Print the forensic report."""
    print("=" * 100)
    print("FORENSIC SNARE AUDIT — MISSED SNARE HUNTER")
    print("=" * 100)
    print()

    for filename, total_frames, onsets, missed in results:
        print(f"{'─' * 100}")
        print(f"📁 {filename}")
        print(f"   Total FINESSE_AUDIT frames: {total_frames}")
        print(f"   [ONSET] detected: {onsets}")
        print(f"   Missed snares (percussive peak, no onset): {len(missed)}")
        print(f"   Hit rate: {onsets}/{onsets + len(missed)} = {onsets/(onsets + len(missed))*100:.1f}%" if (onsets + len(missed)) > 0 else "   Hit rate: N/A")
        print(f"{'─' * 100}")

        # ── Cause distribution ──────────────────────────────────────
        cause_counts = defaultdict(int)
        for m in missed:
            cause_counts[m['cause']] += 1

        print()
        print("   📊 CAUSE DISTRIBUTION:")
        for cause, count in sorted(cause_counts.items(), key=lambda x: -x[1]):
            pct = count / len(missed) * 100 if missed else 0
            print(f"      {cause:25s} {count:4d}  ({pct:5.1f}%)")
        print()

        # ── Refractory analysis ─────────────────────────────────────
        refr_misses = [m for m in missed if m['cause'] == 'REFRACTORY']
        if refr_misses:
            print(f"   🔒 REFRACTORY BLOCKS ({len(refr_misses)} misses):")
            refr_by_count = defaultdict(list)
            for m in refr_misses:
                refr_by_count[m['gRefr']].append(m)
            for grefr in sorted(refr_by_count.keys()):
                items = refr_by_count[grefr]
                print(f"      gRefr={grefr}: {len(items)} misses")
            # Show worst 5
            print(f"      Top 5 refractory kills:")
            for m in sorted(refr_misses, key=lambda x: -x['UnG'])[:5]:
                print(f"         L{m['line']:5d} UnG={m['UnG']:.3f} cFx={m['cFx']:.3f} Res={m['Res']:.3f} "
                      f"Drive={m['Drive']:.4f} gRefr={m['gRefr']} {'[KICK]' if m['is_kick'] else ''}")
            print()

        # ── MACD asphyxia ───────────────────────────────────────────
        macd_floor = [m for m in missed if m['cause'] == 'MACD_FLOOR']
        macd_cross = [m for m in missed if m['cause'] == 'MACD_CROSSOVER_FAIL']
        if macd_floor or macd_cross:
            print(f"   🫁 MACD ASPHYXIA ({len(macd_floor)} floor + {len(macd_cross)} crossover):")
            for m in (macd_floor + macd_cross)[:8]:
                print(f"      L{m['line']:5d} Drive={m['Drive']:.4f} fFloor={m['fFloor']:.4f} "
                      f"dynTh={m['dynTh']:.4f} UnG={m['UnG']:.3f} Res={m['Res']:.3f} cFx={m['cFx']:.3f}")
            print()

        # ── Drive collapse ──────────────────────────────────────────
        collapse = [m for m in missed if m['cause'] in (
            'NLMS_RESIDUAL_ZERO', 'CRACK_FLUX_ZERO', 'BODY_FACTOR_LOW',
            'SEF_COLLAPSED', 'DRIVE_COLLAPSE'
        )]
        if collapse:
            print(f"   💥 DRIVE COLLAPSE ({len(collapse)} misses):")
            for m in collapse[:8]:
                print(f"      L{m['line']:5d} [{m['cause']}] {m['details']}  "
                      f"UnG={m['UnG']:.3f} RawΔ={m['RawΔ']:.3f}")
            print()

        # ── Bypass fail ────────────────────────────────────────────
        bypass = [m for m in missed if m['cause'] == 'BYPASS_FAIL']
        if bypass:
            print(f"   🚫 BYPASS RESCUE FAIL ({len(bypass)} misses):")
            for m in bypass[:8]:
                print(f"      L{m['line']:5d} {m['details']}  UnG={m['UnG']:.3f} Res={m['Res']:.3f}")
            print()

        # ── Veto kills ─────────────────────────────────────────────
        veto = [m for m in missed if m['cause'] == 'VETO_KILL']
        if veto:
            print(f"   ✂️  TONALITY VETO KILLS ({len(veto)} misses):")
            for m in veto[:8]:
                print(f"      L{m['line']:5d} Veto={m['Veto']:.4f} WNS={m['WNS']:.3f} "
                      f"Flux={m['Flux']:.3f} Drive={m['Drive']:.4f}")
            print()

        # ── Kick masking ───────────────────────────────────────────
        kick_masked = [m for m in missed if m['is_kick']]
        if kick_masked:
            print(f"   🥁 KICK MASKING ({len(kick_masked)} misses with [KICK] active):")
            for m in kick_masked[:8]:
                print(f"      L{m['line']:5d} [{m['cause']}] BassE={m['BassE']:.3f} "
                      f"Veto={m['Veto']:.3f} WNS={m['WNS']:.3f} cFx={m['cFx']:.3f} "
                      f"Drive={m['Drive']:.4f} UnG={m['UnG']:.3f}")
            print()

        # ── Density path ───────────────────────────────────────────
        density = [m for m in missed if m['cause'] == 'DENSITY_PATH_MISSED']
        if density:
            print(f"   🌫️  DENSITY PATH MISSED ({len(density)} misses):")
            for m in density[:5]:
                print(f"      L{m['line']:5d} fBL={m['fBL']:.3f} gH={m['gH']:.3f} "
                      f"UnG={m['UnG']:.3f} Drive={m['Drive']:.4f}")
            print()

        # ── Hi-hat filtering (Minimal) ─────────────────────────────
        hihat = [m for m in missed if m['cause'] == 'HIHAT_EXCLUSION']
        if hihat:
            print(f"   🎩 HI-HAT EXCLUSION ({len(hihat)} misses):")
            for m in hihat[:5]:
                print(f"      L{m['line']:5d} hE={m['hE']:.3f} SnareE={m['SnareE']:.3f} "
                      f"UnG={m['UnG']:.3f}")
            print()

        # ── fFloor analysis (Minimal strictness check) ─────────────
        print(f"   📏 FLOOR ANALYSIS:")
        ffl = [m['fFloor'] for m in missed if m['fFloor'] > 0]
        if ffl:
            print(f"      fFloor range: {min(ffl):.4f} — {max(ffl):.4f}")
            strict = sum(1 for f in ffl if f >= 0.065)
            relaxed = sum(1 for f in ffl if f < 0.065)
            print(f"      Strict (≥0.065): {strict}  |  Relaxed (<0.065): {relaxed}")
        else:
            print(f"      No fFloor data in misses")
        print()

        # ── Top 15 worst misses (highest UnG with no onset) ────────
        print(f"   🔥 TOP 15 WORST MISSES (by UnG):")
        for m in sorted(missed, key=lambda x: -x['UnG'])[:15]:
            print(f"      L{m['line']:5d} [{m['cause']:20s}] "
                  f"UnG={m['UnG']:.3f} SnareE={m['SnareE']:.3f} Res={m['Res']:.3f} "
                  f"cFx={m['cFx']:.3f} Drive={m['Drive']:.4f} "
                  f"Veto={m['Veto']:.3f} gRefr={m['gRefr']} "
                  f"{'[KICK]' if m['is_kick'] else ''}")
        print()

    # ── Cross-log summary ──────────────────────────────────────────
    print(f"{'=' * 100}")
    print("CROSS-LOG SUMMARY")
    print(f"{'=' * 100}")
    total_missed = sum(len(m) for _, _, _, m in results)
    total_onsets = sum(o for _, _, o, _ in results)
    total_frames = sum(t for _, t, _, _ in results)
    print(f"Total frames: {total_frames}")
    print(f"Total onsets: {total_onsets}")
    print(f"Total missed: {total_missed}")
    print(f"Global hit rate: {total_onsets}/{total_onsets + total_missed} = "
          f"{total_onsets/(total_onsets + total_missed)*100:.1f}%"
          if (total_onsets + total_missed) > 0 else "N/A")
    print()

    all_causes = defaultdict(int)
    for _, _, _, missed in results:
        for m in missed:
            all_causes[m['cause']] += 1
    print("GLOBAL CAUSE DISTRIBUTION:")
    for cause, count in sorted(all_causes.items(), key=lambda x: -x[1]):
        pct = count / total_missed * 100 if total_missed else 0
        print(f"   {cause:25s} {count:4d}  ({pct:5.1f}%)")

if __name__ == '__main__':
    log_dir = r"C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\docs\4dcalib\technoclub"
    files = [
        os.path.join(log_dir, "minimalgravity.md"),
        os.path.join(log_dir, "techhousemultitrigger.md"),
        os.path.join(log_dir, "techhouseredoble.md"),
        os.path.join(log_dir, "tiestomissed.md"),
    ]

    results = []
    for fpath in files:
        if not os.path.exists(fpath):
            print(f"WARNING: {fpath} not found, skipping")
            continue
        results.append(analyze_file(fpath))

    print_report(results)
