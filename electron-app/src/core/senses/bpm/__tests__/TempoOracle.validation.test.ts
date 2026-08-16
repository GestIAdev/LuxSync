/**
 * TEMPO ORACLE — Blueprint §9 Validation Protocol
 *
 * These are the acceptance tests the blueprint demands before the Oracle is
 * trusted in production. They are deliberately strict: the whole point of the
 * transplant is sub-frame precision, so anything looser than ±1 BPM would
 * fail to distinguish the Oracle from the tracker it replaced.
 *
 * @see docs/technical_audits/AUTOCORRELATION_BLUEPRINT.md §9
 */

import { describe, expect, it } from 'vitest';
import { TempoOracle } from '../TempoOracle';

/** Nominal ODF frame rate: 4096-sample hop @44.1 kHz. */
const ODF_RATE = 21.53;
const FRAME_MS = 1000 / ODF_RATE;

/**
 * Drive the Oracle with a synthetic click train.
 *
 * @param bpm        True tempo of the click train.
 * @param seconds    Duration to simulate.
 * @param jitterMs   Uniform ± timing noise applied to each click.
 * @param dropout    Probability that a click is deleted entirely.
 * @param rng        Deterministic PRNG in [0,1).
 */
function runClickTrain(
  bpm: number,
  seconds: number,
  jitterMs = 0,
  dropout = 0,
  rng: () => number = () => 0.5
): TempoOracle {
  const oracle = new TempoOracle();
  const beatMs = 60000 / bpm;
  const totalFrames = Math.floor((seconds * 1000) / FRAME_MS);

  let nextBeatMs = beatMs;
  let firedForBeat = -1;
  let beatIndex = 0;

  for (let f = 0; f < totalFrames; f++) {
    const tMs = f * FRAME_MS;
    let needle = 0.0;

    // A click lands on the first frame at or after its (jittered) beat time.
    const jitter = jitterMs > 0 ? (rng() * 2 - 1) * jitterMs : 0;
    if (tMs >= nextBeatMs + jitter && firedForBeat !== beatIndex) {
      firedForBeat = beatIndex;
      const dropped = dropout > 0 && rng() < dropout;
      // Amplitude varies 3:1 to exercise the √ compression.
      if (!dropped) needle = 0.04 + rng() * 0.08;
      beatIndex++;
      nextBeatMs += beatMs;
    }

    oracle.process(needle, tMs);
  }
  return oracle;
}

/** Deterministic xorshift32 — reproducible failures, no test flake. */
function makeRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

describe('TempoOracle — §9.1 clean metronome sweep', () => {
  // The decisive test. Integer lags at this frame rate only permit a coarse
  // BPM grid; anything better than ~±1 BPM can ONLY come from the parabolic
  // interpolation, which is exactly the mechanism that kills the legacy
  // ±4 BPM quantization.
  for (const bpm of [90, 100, 110, 120, 124, 128, 132, 140, 150, 160, 174]) {
    it(`locks ${bpm} BPM within ±1`, () => {
      const oracle = runClickTrain(bpm, 30);
      expect(oracle.isCalibrated).toBe(true);
      expect(oracle.confidence).toBeGreaterThan(0.05);
      expect(Math.abs(oracle.bpm - bpm)).toBeLessThan(1.0);
    });
  }

  it('beats the integer-lag grid it is built on', () => {
    // 128 BPM @21.53 Hz → τ = 10.09 frames. The neighbouring integer lags are
    // 10 (129.2 BPM) and 11 (117.4 BPM). If the Oracle were merely picking the
    // best integer lag, the error would be ≥1.1 BPM. It must do better.
    const oracle = runClickTrain(128, 30);
    const integerLagError = Math.abs(129.18 - 128);
    expect(Math.abs(oracle.bpm - 128)).toBeLessThan(integerLagError);
  });
});

describe('TempoOracle — §9.2 jittered metronome', () => {
  it('holds ±1 BPM under ±15 ms timing noise', () => {
    const oracle = runClickTrain(128, 40, 15, 0, makeRng(0xc0ffee));
    expect(Math.abs(oracle.bpm - 128)).toBeLessThan(1.0);
  });
});

describe('TempoOracle — §9.3 dropout torture', () => {
  it('survives 30% missing kicks with no octave flip', () => {
    const oracle = runClickTrain(128, 40, 0, 0.3, makeRng(0x1234));
    // A missed kick doubles an interval — fatal for the legacy tracker, a
    // single term out of hundreds for the Oracle.
    expect(Math.abs(oracle.bpm - 128)).toBeLessThan(1.5);
  });
});

describe('TempoOracle — §9.4 half-time trap', () => {
  it('locks the pulse, not the half-time image, on a sparse 2-and-4 pattern', () => {
    // Strong beats on 1 and 3, weak ghosts on 2 and 4. A naive ACF peak-pick
    // locks the half-time image; the harmonic ladder must resolve the pulse.
    const oracle = new TempoOracle();
    const bpm = 128;
    const beatMs = 60000 / bpm;
    const totalFrames = Math.floor(40000 / FRAME_MS);
    let nextBeatMs = beatMs;
    let firedForBeat = -1;
    let beatIndex = 0;

    for (let f = 0; f < totalFrames; f++) {
      const tMs = f * FRAME_MS;
      let needle = 0.0;
      if (tMs >= nextBeatMs && firedForBeat !== beatIndex) {
        firedForBeat = beatIndex;
        needle = beatIndex % 2 === 0 ? 0.10 : 0.035; // strong / weak alternation
        beatIndex++;
        nextBeatMs += beatMs;
      }
      oracle.process(needle, tMs);
    }

    // Must not settle on 64 BPM (the half-time image).
    expect(Math.abs(oracle.bpm - 64)).toBeGreaterThan(8);
    expect(Math.abs(oracle.bpm - bpm)).toBeLessThan(2.0);
  });
});

describe('TempoOracle — behavioural guards', () => {
  it('reports zero confidence on silence and never emits NaN', () => {
    const oracle = new TempoOracle();
    for (let f = 0; f < 600; f++) oracle.process(0, f * FRAME_MS);
    expect(Number.isFinite(oracle.bpm)).toBe(true);
    expect(Number.isFinite(oracle.confidence)).toBe(true);
    expect(oracle.confidence).toBeLessThan(0.05);
  });

  it('never emits NaN when fed hostile input', () => {
    const oracle = new TempoOracle();
    const rng = makeRng(0xbadf00d);
    for (let f = 0; f < 800; f++) {
      // Negative values must be clamped by the √ guard, not become NaN.
      oracle.process(rng() < 0.5 ? -1 : rng() * 0.5, f * FRAME_MS);
    }
    expect(Number.isNaN(oracle.bpm)).toBe(false);
    expect(Number.isNaN(oracle.confidence)).toBe(false);
    expect(oracle.confidence).toBeGreaterThanOrEqual(0);
    expect(oracle.confidence).toBeLessThanOrEqual(1);
  });

  it('self-calibrates the ODF rate from deterministic timestamps', () => {
    const oracle = runClickTrain(128, 10);
    expect(oracle.frameRate).toBeCloseTo(ODF_RATE, 1);
  });

  it('follows a tempo change via the challenger escape hatch', () => {
    const oracle = new TempoOracle();
    const emit = (bpm: number, seconds: number, t0: number): number => {
      const beatMs = 60000 / bpm;
      const frames = Math.floor((seconds * 1000) / FRAME_MS);
      let nextBeatMs = beatMs;
      let firedForBeat = -1;
      let beatIndex = 0;
      for (let f = 0; f < frames; f++) {
        const local = f * FRAME_MS;
        let needle = 0.0;
        if (local >= nextBeatMs && firedForBeat !== beatIndex) {
          firedForBeat = beatIndex;
          needle = 0.08;
          beatIndex++;
          nextBeatMs += beatMs;
        }
        oracle.process(needle, t0 + local);
      }
      return t0 + frames * FRAME_MS;
    };

    const t1 = emit(128, 30, 0);
    expect(Math.abs(oracle.bpm - 128)).toBeLessThan(1.5);
    emit(100, 40, t1);
    // The Gaussian prior resists, but a persistent challenger must win.
    expect(Math.abs(oracle.bpm - 100)).toBeLessThan(2.0);
  });

  it('reset() restores a virgin state', () => {
    const oracle = runClickTrain(128, 20);
    expect(oracle.bpm).toBeGreaterThan(0);
    oracle.reset();
    expect(oracle.bpm).toBe(0);
    expect(oracle.confidence).toBe(0);
  });
});
