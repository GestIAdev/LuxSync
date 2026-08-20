/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌊 WAVE 7564: THE UNDULATING GRID — Beat Grid View Model
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Turns the analyser's variable-tempo output into culled, viewport-ready grid
 * marks for the timeline canvas.
 *
 * ── The problem this solves ──────────────────────────────────────────────
 * WAVE 7563 gave the pipeline an Ellis DP beat tracker: `beatGrid.beats` is a
 * measured, non-uniform `TimeMs[]` that breathes with the music. The canvas,
 * however, still synthesised its own grid from the scalar BPM
 * (`t += 60000/bpm`), so a track that ritardandos or gets pitch-ridden showed
 * a rigid grid drifting steadily out of phase with its own waveform. The data
 * was variable; the view was rigid.
 *
 * ── Why a shared module ──────────────────────────────────────────────────
 * Three independent render sites in `TimelineCanvas.tsx` each grew their own
 * copy of the `t += msPerBeat` loop (the global grid memo, the BARS ruler, and
 * the per-track feedback grid). Wiring the beats array into three duplicated
 * loops would have tripled the surface area of the next bug. They now share
 * one model.
 *
 * ── Culling strategy ─────────────────────────────────────────────────────
 * A uniform grid can be indexed arithmetically: `firstBar = start / msPerBar`.
 * A measured array cannot — the marks are irregular, so finding the visible
 * window means searching. `sliceVisibleMarks` binary-searches the lower bound
 * (O(log n)) and walks forward only across genuinely visible marks. The full
 * mark list is built ONCE per analysis (`buildGridMarks`) and memoised; the
 * per-frame cost is the slice alone.
 *
 * ── Infinite horizon ─────────────────────────────────────────────────────
 * The canvas deliberately draws grid beyond the end of the audio so clips can
 * be placed there (WAVE 2040.40). Measured beats necessarily stop at the last
 * detected onset, so past that point `sliceVisibleMarks` extrapolates at the
 * final measured interval and flags those marks `synthetic: true`. Callers
 * render them at reduced opacity — the distinction between "this beat was
 * measured" and "this beat is a ruler" is real and the UI should not lie
 * about it.
 *
 * @module chronos/ui/timeline/beatGridModel
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalised beat grid, decoupled from its origin.
 *
 * Two sources feed this: a freshly-analysed `AnalysisData.beatGrid`
 * (`BeatGridData`) and a project loaded from disk (`LuxAnalysisV3`). They
 * carry the same information under different field names, so the canvas
 * consumes this shape and neither source leaks into the view layer.
 */
export interface TimelineBeatGrid {
  /** Measured beat timestamps (ms), ascending. */
  beats: readonly number[]
  /** Measured bar starts (ms), a subset of `beats`. May be empty. */
  downbeats: readonly number[]
  /** Detected metre: 4 (4/4) or 3 (3/4). */
  timeSignature: number
  /**
   * True when `beats` came from the Ellis DP tracker. False when the analyser
   * fell back to a uniform grid, which is worth surfacing because the two
   * carry very different trust levels.
   */
  variable: boolean
}

/** One vertical line on the timeline. */
export interface GridMark {
  /** Position in ms. */
  timeMs: number
  /** True when this mark starts a bar. */
  isBar: boolean
  /** 1-indexed bar number. 0 for pickup beats before the first downbeat. */
  barNum: number
  /** 1-indexed position within the bar. */
  beatNum: number
  /**
   * True when extrapolated past the last measured beat (infinite horizon).
   * Rendered dimmer — it is a ruler, not an observation.
   */
  synthetic: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTION
// ═══════════════════════════════════════════════════════════════════════════

/** Tolerance (ms) for matching a beat against a downbeat timestamp. */
const DOWNBEAT_EPSILON = 1e-6

/**
 * Builds the complete mark list for a track, assigning bar and beat numbers.
 *
 * Call once per analysis and memoise — the result depends only on the grid,
 * not on the viewport. A 3-minute track yields ~400 marks, so the array is
 * small enough to hold whole and slice per frame.
 *
 * ── Bar numbering ────────────────────────────────────────────────────────
 * Bars are numbered from the FIRST DETECTED DOWNBEAT, not from beat 0. Any
 * beats preceding it form a pickup (anacrusis) and are numbered bar 0. This
 * is the musically correct reading and it is only possible because WAVE 7563
 * detects downbeats instead of assuming beat 0 starts a bar.
 *
 * When `downbeats` is empty (metre undetectable) the numbering falls back to
 * modulo arithmetic from beat 0 — the old behaviour, applied honestly as a
 * fallback rather than as the primary path.
 */
export function buildGridMarks(grid: TimelineBeatGrid): GridMark[] {
  const { beats, downbeats } = grid
  const meter = grid.timeSignature > 0 ? grid.timeSignature : 4
  const marks: GridMark[] = new Array(beats.length)

  if (downbeats.length === 0) {
    // No downbeat information — number by modulo from the first beat.
    for (let i = 0; i < beats.length; i++) {
      const pos = i % meter
      marks[i] = {
        timeMs: beats[i],
        isBar: pos === 0,
        barNum: Math.floor(i / meter) + 1,
        beatNum: pos + 1,
        synthetic: false,
      }
    }
    return marks
  }

  // Two-pointer merge. Both arrays are ascending and `downbeats` holds the
  // exact same double values that were copied out of `beats`, so an epsilon
  // match is exact in practice and robust to a JSON round-trip.
  let d = 0
  let barNum = 0
  let beatNum = 0

  for (let i = 0; i < beats.length; i++) {
    const t = beats[i]
    const isBar = d < downbeats.length && Math.abs(t - downbeats[d]) < DOWNBEAT_EPSILON

    if (isBar) {
      d++
      barNum++
      beatNum = 1
    } else {
      // Pickup beats before the first downbeat stay in bar 0.
      beatNum = beatNum + 1
      if (barNum === 0 && beatNum > meter) beatNum = 1
    }

    marks[i] = { timeMs: t, isBar, barNum, beatNum, synthetic: false }
  }

  return marks
}

// ═══════════════════════════════════════════════════════════════════════════
// CULLING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Index of the first mark at or after `timeMs`. Standard binary search;
 * returns `marks.length` when every mark precedes the target.
 */
export function lowerBound(marks: readonly GridMark[], timeMs: number): number {
  let lo = 0
  let hi = marks.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (marks[mid].timeMs < timeMs) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * Generates a uniform grid across `[startMs, endMs]` from a scalar BPM.
 *
 * The fallback path, used when no analysis exists yet (the user has loaded
 * audio but the phantom worker has not finished) and to extrapolate the
 * infinite horizon past the final measured beat.
 *
 * @param barOffset Bars already elapsed, so extrapolated numbering continues
 *                  from the measured region instead of restarting at 1.
 */
export function buildUniformMarks(
  bpm: number,
  startMs: number,
  endMs: number,
  timeSignature: number,
  synthetic: boolean,
  barOffset = 0,
): GridMark[] {
  const out: GridMark[] = []
  const safeBpm = bpm > 0 ? bpm : 120
  const meter = timeSignature > 0 ? timeSignature : 4
  const msPerBeat = 60000 / safeBpm
  if (!Number.isFinite(msPerBeat) || msPerBeat <= 0) return out

  // Guard against a pathological zoom-out asking for a million lines.
  const maxMarks = 4096
  const firstIdx = Math.max(0, Math.floor(startMs / msPerBeat))
  const lastIdx = Math.ceil(endMs / msPerBeat)

  for (let i = firstIdx; i <= lastIdx && out.length < maxMarks; i++) {
    const pos = i % meter
    out.push({
      timeMs: i * msPerBeat,
      isBar: pos === 0,
      barNum: Math.floor(i / meter) + 1 + barOffset,
      beatNum: pos + 1,
      synthetic,
    })
  }
  return out
}

/**
 * Returns the marks visible in `[startMs, endMs]`, extrapolating past the
 * final measured beat so the infinite horizon keeps working.
 *
 * @param marks        Full measured mark list from `buildGridMarks`.
 * @param fallbackBpm  Scalar BPM, used when `marks` is empty and to size the
 *                     extrapolated tail if only one mark exists.
 */
export function sliceVisibleMarks(
  marks: readonly GridMark[],
  startMs: number,
  endMs: number,
  fallbackBpm: number,
  timeSignature: number,
): GridMark[] {
  const meter = timeSignature > 0 ? timeSignature : 4

  // No measured grid at all — synthesise the whole visible span.
  if (marks.length === 0) {
    return buildUniformMarks(fallbackBpm, startMs, endMs, meter, true)
  }

  const out: GridMark[] = []

  // ── Measured region: binary-search the lower bound, then walk forward ──
  const lo = lowerBound(marks, startMs)
  for (let i = lo; i < marks.length; i++) {
    const m = marks[i]
    if (m.timeMs > endMs) break
    out.push(m)
  }

  // ── Extrapolated tail (infinite horizon) ──────────────────────────────
  const last = marks[marks.length - 1]
  if (endMs > last.timeMs) {
    // Continue at the FINAL measured interval, not the track average — the
    // tempo at the end of the track is the best estimate for what comes
    // after it.
    const interval = marks.length >= 2
      ? last.timeMs - marks[marks.length - 2].timeMs
      : 60000 / (fallbackBpm > 0 ? fallbackBpm : 120)

    if (Number.isFinite(interval) && interval > 0) {
      let barNum = last.barNum
      let beatNum = last.beatNum
      let t = last.timeMs + interval
      let guard = 4096

      while (t <= endMs && guard-- > 0) {
        beatNum++
        let isBar = false
        if (beatNum > meter) {
          beatNum = 1
          barNum++
          isBar = true
        }
        if (t >= startMs) {
          out.push({ timeMs: t, isBar, barNum, beatNum, synthetic: true })
        }
        t += interval
      }
    }
  }

  return out
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE NORMALISATION
// ═══════════════════════════════════════════════════════════════════════════

/** Shape of a freshly-analysed grid (`AnalysisData.beatGrid`). */
interface FreshBeatGridLike {
  beats?: number[]
  downbeats?: number[]
  timeSignature?: number
  variableTempo?: boolean
}

/** Shape of a persisted grid (`LuxAnalysisV3`). */
interface PersistedAnalysisLike {
  beatGrid?: readonly number[]
  downbeatGrid?: readonly number[]
  timeSignature?: number
  variableTempo?: boolean
}

/**
 * Normalises a freshly-analysed beat grid. Returns null when there is no
 * usable beat array, so the caller falls back to the uniform grid.
 */
export function fromAnalysisData(
  grid: FreshBeatGridLike | null | undefined,
): TimelineBeatGrid | null {
  if (!grid?.beats || grid.beats.length < 2) return null
  return {
    beats: grid.beats,
    downbeats: grid.downbeats ?? [],
    timeSignature: grid.timeSignature ?? 4,
    variable: grid.variableTempo ?? false,
  }
}

/**
 * Normalises a beat grid persisted in a `.lux` project.
 *
 * This path matters more than it looks: loading a project sets
 * `analysisData = null` by design (the analysis is embedded, so the phantom
 * worker is deliberately skipped). Without this the undulating grid would
 * appear on first analysis and then silently vanish the moment the user saved
 * and reopened their work.
 */
export function fromPersistedAnalysis(
  analysis: PersistedAnalysisLike | null | undefined,
): TimelineBeatGrid | null {
  if (!analysis?.beatGrid || analysis.beatGrid.length < 2) return null
  return {
    beats: analysis.beatGrid,
    downbeats: analysis.downbeatGrid ?? [],
    timeSignature: analysis.timeSignature ?? 4,
    variable: analysis.variableTempo ?? false,
  }
}
