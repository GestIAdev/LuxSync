#!/usr/bin/env python3
"""
Monte Carlo -- Stage 3: Faithful re-implementation of the snare onset chain.

Replays LiquidEngineBase's snare pipeline over recorded telemetry so that
candidate parameter sets can be evaluated offline.

WHAT IS INVARIANT (taken straight from the log, unaffected by the params
we tune): Res, cFx, sEF, WNS, Flux, hhDlt, sd, gH, rGate, fBL, UnG, SnareE,
hE, RawD, dynTh.

WHAT IS RECOMPUTED (depends on the params we tune): bodyFactor clamp,
crackDrive, trebleGhost (ghost refractory changes), snareDrive, MACD EMAs,
floor EMA, refractory counters, bypass rescue, density path, veto factor.

Reference: LiquidEngineBase.ts lines 960-1500 (onset) and 1719-1795 (veto).
"""

# ---- Engine constants (LiquidEngineBase.ts) --------------------------------
A_FAST         = 1.00   # p.snareMomentumAlphaFast  (techno.ts:277)
A_SLOW         = 0.05   # p.snareMomentumAlphaSlow  (techno.ts:278)
RESET_TH       = 0.15   # p.snareMomentumResetThreshold
RESET_RATIO    = 0.70   # p.snareMomentumResetRatio
SILENCE_FRAMES = 8      # SILENCE_RESET_FRAMES
FLOOR_EMA_A    = 0.15   # snareFloorEma alpha


class Params:
    """Tunable coefficient vector."""
    __slots__ = ('floor', 'floor_min', 'bfct_floor', 's_refr', 'g_refr',
                 'wns_floor', 'wns_knee', 'flat_floor', 'flat_knee',
                 'flux_floor', 'flux_knee', 'crack_wns_th', 'crack_flux_th',
                 'crack_atten')

    def __init__(self, floor=0.045, floor_min=0.002, bfct_floor=0.300,
                 s_refr=4, g_refr=4,
                 wns_floor=0.10, wns_knee=0.25,
                 flat_floor=0.10, flat_knee=0.10,
                 flux_floor=0.05, flux_knee=0.25,
                 crack_wns_th=0.05, crack_flux_th=0.25, crack_atten=0.30):
        self.floor = floor; self.floor_min = floor_min
        self.bfct_floor = bfct_floor
        self.s_refr = s_refr; self.g_refr = g_refr
        self.wns_floor = wns_floor; self.wns_knee = wns_knee
        self.flat_floor = flat_floor; self.flat_knee = flat_knee
        self.flux_floor = flux_floor; self.flux_knee = flux_knee
        self.crack_wns_th = crack_wns_th
        self.crack_flux_th = crack_flux_th
        self.crack_atten = crack_atten

    def as_dict(self):
        return {s: getattr(self, s) for s in self.__slots__}


# Parameters in force when the corpus was captured (WAVE 7774).
CAPTURE = Params()


def _gate(v, floor, knee):
    if v < floor:
        return 0.0
    if knee <= floor:
        return 1.0
    if v < knee:
        return (v - floor) / (knee - floor)
    return 1.0


def recover_flatness(frames, p=CAPTURE):
    """
    `flatness` is never logged, but the combined veto factor is:
        Veto = (flatGate + wnsGate + fluxGate) / 3
    Since WNS and Flux are logged we can invert for flatGate, then map that
    back through the capture-time knee to an implied flatness. Frames whose
    gate saturates give only a bound, which is all the veto needs anyway.
    """
    for f in frames:
        wg = _gate(f.get('WNS', 0), p.wns_floor, p.wns_knee)
        fg = _gate(f.get('Flux', 0), p.flux_floor, p.flux_knee)
        flat_gate = 3.0 * f.get('Veto', 0) - wg - fg
        flat_gate = max(0.0, min(1.0, flat_gate))
        f['_flatGate'] = flat_gate
        if p.flat_knee > p.flat_floor:
            f['_flatness'] = p.flat_floor + flat_gate * (p.flat_knee - p.flat_floor)
        else:
            # floor == knee: hard step. gate=0 -> below floor, gate=1 -> above.
            f['_flatness'] = p.flat_floor * (0.5 if flat_gate < 0.5 else 1.5)
    return frames


def simulate(frames, p):
    """
    Replay the onset chain. Returns a per-frame list of dicts with the
    recomputed drive, floor, onset flag and post-veto output gain.
    """
    ema_fast = ema_slow = prev_mom = 0.0
    floor_ema = p.floor
    s_refr = g_refr = 0
    silence = 0
    out = []

    for f in frames:
        res   = f.get('Res', 0.0)
        cfx   = f.get('cFx', 0.0)
        sef   = f.get('sEF', 0.0)
        gh    = f.get('gH', 0.0)
        sd    = f.get('sd', 0.0)
        wns   = f.get('WNS', 0.0)
        flux  = f.get('Flux', 0.0)
        hh    = f.get('hhDlt', 0.0)
        rgate = f.get('rGate', 1.0)
        fbl   = f.get('fBL', 0.0)
        ung   = f.get('UnG', 0.0)
        sne   = f.get('SnareE', 0.0)
        he    = f.get('hE', 0.0)
        rawd  = f.get('Raw\u0394', 0.0)
        dynth = f.get('dynTh', 0.0)

        # -- crack path (LiquidEngineBase.ts:1178-1195) ----------------------
        bfct = max(p.bfct_floor, f.get('bFct', 1.0))
        crack = res * cfx * bfct * sef
        if gh > 0.1 and wns < p.crack_wns_th and flux < p.crack_flux_th:
            crack *= p.crack_atten

        # -- ghost path (LiquidEngineBase.ts:1279-1281) ----------------------
        ghost_res_gate = 0.3 + 0.7 * max(0.0, min(1.0, (res - 0.05) / 0.15))
        ghost_raw = hh * sef * (1.0 - sd) * rgate * (1.0 - gh) * ghost_res_gate
        if g_refr > 0:
            g_refr -= 1
            ghost = 0.0
        else:
            ghost = ghost_raw

        drive = max(crack, ghost)

        # -- MACD (LiquidEngineBase.ts:1286-1294) ----------------------------
        ema_fast += A_FAST * (drive - ema_fast)
        ema_slow += A_SLOW * (drive - ema_slow)
        momentum = ema_fast - ema_slow
        crossover = momentum > dynth and prev_mom <= dynth

        # -- dynamic floor (LiquidEngineBase.ts:1312-1331) -------------------
        relax = max(0.0, fbl - 0.04) * 4.0 * (1.0 - gh)
        raw_floor = max(p.floor_min, p.floor - relax)
        if ema_slow < 0.01 and fbl < 0.03:
            floor_ema = p.floor
        else:
            floor_ema = floor_ema * (1.0 - FLOOR_EMA_A) + raw_floor * FLOOR_EMA_A
        floor = floor_ema

        # -- onset decision (LiquidEngineBase.ts:1344-1434) ------------------
        onset = False
        path = ''
        if s_refr > 0:
            s_refr -= 1
        else:
            onset = crossover and drive >= floor
            if onset:
                path = 'MACD'
            bypass_flux_th = 0.08 if gh < 0.1 else 0.20
            if (not onset and ung > 0.4 and res > 0.3 and rawd > 0.2
                    and flux > bypass_flux_th
                    and not (sne < 0.2 and he > 0.5)):
                onset = True
                path = 'BYPASS'
            if (not onset and fbl > 0.09 and gh < 0.05
                    and ung > 0.45 and drive >= floor):
                onset = True
                path = 'DENSITY'
                s_refr = 2
                g_refr = p.g_refr
            elif onset:
                s_refr = p.s_refr
                g_refr = p.g_refr

        # -- hybrid reset (LiquidEngineBase.ts:1457-1464) --------------------
        if onset and momentum > RESET_TH:
            ema_slow += RESET_RATIO * (ema_fast - ema_slow)
            momentum = ema_fast - ema_slow
        prev_mom = momentum

        # -- silence reset (LiquidEngineBase.ts:1480-1490) -------------------
        if ema_slow > 0.10 and drive < 0.01:
            silence += 1
            if silence >= SILENCE_FRAMES:
                ema_fast = ema_slow = prev_mom = 0.0
                silence = 0
        else:
            silence = 0

        # -- tonality veto -> output gain (LiquidEngineBase.ts:1732-1776) ----
        wg = _gate(wns, p.wns_floor, p.wns_knee)
        fg = _gate(flux, p.flux_floor, p.flux_knee)
        flatness = f.get('_flatness', 0.35)
        ftg = _gate(flatness, p.flat_floor, p.flat_knee)
        veto = (ftg + wg + fg) / 3.0
        gain = 1.0 if veto > 0.15 else veto / 0.15

        out.append({'drive': drive, 'floor': floor, 'onset': onset,
                    'path': path, 'veto': veto, 'gain': gain,
                    'momentum': momentum})
    return out


# ---------------------------------------------------------------------------
if __name__ == '__main__':
    import os, sys, statistics as st
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from _mc_parse import parse_file, DIR

    print("=" * 104)
    print("SIMULATOR VALIDATION -- replay at capture params, compare vs. logged truth")
    print("=" * 104)
    print(f"{'file':<26}{'frames':>7}{'ghost_r2':>10}{'drive_r2':>10}"
          f"{'floor_mae':>11}{'ons_log':>9}{'ons_sim':>9}{'match':>8}{'F1':>7}")
    print("-" * 104)

    tot = [0, 0, 0, 0]
    for fn in sorted(x for x in os.listdir(DIR) if x.endswith('.md')):
        fr = parse_file(os.path.join(DIR, fn))
        if not fr:
            continue
        recover_flatness(fr)
        sim = simulate(fr, CAPTURE)

        # ghost reconstruction check (only where ghost was not suppressed)
        gp, gl = [], []
        for f, s in zip(fr, sim):
            if f.get('gRefr', 0) == 0 and f.get('ghst', 0) > 1e-6:
                res = f.get('Res', 0)
                grg = 0.3 + 0.7 * max(0.0, min(1.0, (res - 0.05) / 0.15))
                gp.append(f.get('hhDlt', 0) * f.get('sEF', 0) *
                          (1 - f.get('sd', 0)) * f.get('rGate', 1) *
                          (1 - f.get('gH', 0)) * grg)
                gl.append(f.get('ghst', 0))

        def r2(pred, obs):
            if len(obs) < 3:
                return float('nan')
            mo = sum(obs) / len(obs)
            ss = sum((o - mo) ** 2 for o in obs)
            sr = sum((p_ - o) ** 2 for p_, o in zip(pred, obs))
            return 1 - sr / ss if ss > 1e-12 else float('nan')

        dp = [s['drive'] for s in sim]
        dl = [f.get('Drive', 0) for f in fr]
        fmae = sum(abs(s['floor'] - f.get('fFloor', 0))
                   for s, f in zip(sim, fr)) / len(fr)

        log_on = [i for i, f in enumerate(fr) if f['_onset']]
        sim_on = [i for i, s in enumerate(sim) if s['onset']]
        sset = set(sim_on)
        matched = sum(1 for i in log_on
                      if any((i + d) in sset for d in (0, -1, 1, -2, 2)))
        prec = matched / len(sim_on) if sim_on else 0
        rec = matched / len(log_on) if log_on else 0
        f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0
        tot[0] += matched; tot[1] += len(log_on); tot[2] += len(sim_on); tot[3] += len(fr)

        print(f"{fn:<26}{len(fr):>7}{r2(gp,gl):>10.3f}{r2(dp,dl):>10.3f}"
              f"{fmae:>11.4f}{len(log_on):>9}{len(sim_on):>9}"
              f"{matched:>8}{f1:>7.3f}")

    print("-" * 104)
    P = tot[0] / tot[2] if tot[2] else 0
    R = tot[0] / tot[1] if tot[1] else 0
    print(f"GLOBAL  frames={tot[3]}  logged={tot[1]}  simulated={tot[2]}  "
          f"matched={tot[0]}  precision={P:.3f}  recall={R:.3f}  "
          f"F1={2*P*R/(P+R) if P+R else 0:.3f}")
