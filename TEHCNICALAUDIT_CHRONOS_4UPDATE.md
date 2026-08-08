# TECHNICAL DUE DILIGENCE AUDIT — "CHRONOS V3 TIMECODER"

**Target IP:** LuxSync / Chronos V3 Timecoder (`electron-app/src/chronos/`)
**Acquirer:** AlphaTheta Corp / MA Lighting — Office of the CTO
**Engagement:** Pre-acquisition Technical Due Diligence (Adversarial)
**Classification:** CONFIDENTIAL — BOARD OF DIRECTORS / DEAL COMMITTEE ONLY
**Audit Basis:** Full static read of 63 TypeScript/TSX modules (~25,400 LOC), dynamic execution of the vendor's own test suite, and targeted runtime reproduction of suspected defects.

> **Methodological note.** Every claim in this document was verified by direct source inspection with file and line citation, or by executing code. Where an initial hypothesis failed verification, it was discarded and is recorded as such in §7.4. Findings that reflect genuine engineering quality are recorded with equal prominence to defects; this is an audit, not a negotiation tactic.

---

## 1. EXECUTIVE SUMMARY & BUYOUT VERDICT

### 1.1 Verdict

**CONDITIONAL PROCEED — RESTRUCTURE AS ASSET PURCHASE. DO NOT PAY FOR "PRODUCTION-READY."**

Chronos V3 is not the finished product the vendor's documentation asserts. It is a **structurally sound, genuinely sophisticated prototype at roughly 70–75% completion**, wrapped in marketing-grade source comments that materially overstate its maturity.

The engineering underneath is real and, in several places, excellent. The LTC decoder is a correct AudioWorklet-based biphase-mark implementation. The FFT is a genuine, verified radix-2 Cooley-Tukey with Blackman-Harris windowing. The clock PLL is numerically hardened against NaN/Infinity poisoning. Audio memory architecture — offloading decode to a hidden "Phantom" BrowserWindow and streaming playback via `MediaElementSource` — is a deliberate, correct solution to a problem most competitors solve badly. **This is not a codebase written by amateurs.**

But the audit surfaced a defect class that is disqualifying for a live-production lighting product, and it is not a performance nit or a missing feature. It is this:

> **The vendor cannot reliably save and re-open its own project files.**

This is not an inference. The vendor's own `LuxFileV3.test.ts` suite fails **5 of 22 tests**, and the failures are the round-trip serialization tests. We executed the suite, isolated the root cause, and reproduced it in a minimal case (§3.2). A project containing a Vibe clip with an FX clip layered over it — **the vendor's own canonical usage pattern, taken verbatim from their own test fixture** — is rejected by their loader as corrupt and returns `null`.

Compounding this: **all seven `.lux` project files shipped in the repository are legacy V2 format and are hard-rejected by the V3 loader.** The vendor's own schema documentation declares "*No existen shows V2 previos. No hay conversores*" ("There are no prior V2 shows. There are no converters."). This assertion is falsified by the contents of their own `scenes/` directory. There is no migration path, and 100% of extant project assets are unloadable (§3.1).

### 1.2 What This Means Commercially

A lighting console that loses a programmer's show file is not a product with a bug. It is a liability. In this sector the cost of a corrupt show file is not a support ticket — it is a dark stage in front of a paying audience, and it is a career-ending event for the operator who trusted the tool. GrandMA3, Hog 4, and Chamsys all treat show-file durability as a first-order safety property with multi-generation backups and verified writes. Chronos V3 currently treats it as an afterthought with an inverted threat model (§3.4).

Critically, **these are not architectural defects.** They are localized logic errors in a well-structured system. The overlap-validation bug is approximately a five-line fix. The V2 migration is a bounded, well-understood adapter. The unbounded-loop DoS is a one-line guard. **This is the central finding of the audit: the expensive part (architecture, DSP, protocol correctness) is largely done and done well; the cheap part (validation semantics, migration, guards) is unfinished.** That asymmetry is what makes this asset worth acquiring at a corrected valuation rather than walking away from.

### 1.3 Severity Ledger

| Sev | Count | Representative Finding |
|---|---|---|
| **CRITICAL** | 4 | Save/load round-trip broken (§3.2); 100% asset loss, no V2 migration (§3.1); unbounded loop OOM from malformed file (§6.1); inverted checksum threat model (§3.4) |
| **HIGH** | 6 | Non-atomic autosave (§3.5); quadratic hot-path scan (§5.2); MTC +2 frame offset absent (§4.2); unvalidated IPC boundary (§2.4) |
| **MEDIUM** | 9 | MTC frame-mixing on packet loss (§4.2); post-save audio path corruption (§3.6); per-frame gradient allocation (§5.3); no SPP support (§4.3) |
| **LOW / INFO** | 11 | Mixed-separator path bug; magic numbers; documented-but-unimplemented `audioHash` |
| **STRENGTHS** | 14 | Verified FFT; hardened PLL; Phantom decode isolation; systematic listener teardown |

### 1.4 Recommended Deal Structure

1. **Reprice against a verified remediation estimate of 9–14 engineer-weeks** for the CRITICAL and HIGH tier. This is a bounded, well-specified body of work, not open-ended research.
2. **Escrow 25–30% of consideration** against acceptance criteria: green test suite, a passing V2→V3 migration corpus, and a 72-hour continuous-playback soak with zero leaked `AudioContext` handles.
3. **Make the four CRITICAL items conditions precedent to closing.** Do not accept "on the roadmap."
4. **Retain the original authors.** The DSP and protocol layers show specific, non-obvious domain knowledge (§4.1) that is expensive to reacquire. Losing these engineers would erase much of what you are buying.
5. **Commission an independent safety review of the strobe/epilepsy path** before any commercial release under an AlphaTheta or MA Lighting brand (§7.3). The `LuxSafetyV3` structure is declared but never validated or enforced — this is a brand-liability exposure, not merely a technical one.

---

## 2. MODULE TOPOLOGY & ARCHITECTURE

### 2.1 Layer Map

The module decomposes cleanly. This is the asset's strongest dimension.

```
chronos/
├── core/         Engine, Store, Dispatcher, Recorder, .lux V3 schema/serializer/factories
├── protocols/    LTC, MTC, MIDI Clock (master+slave), Art-Net TC, ClockSourceManager
├── analysis/     GodEar offline FFT analyser + dedicated Worker
├── bridge/       ChronosInjector, ChronosIPCBridge  (render → DMX backend)
├── hooks/        React adapters (audio load, streaming playback, clocks, clip editing)
├── stores/       sessionStore (Zustand)
├── ui/           Timeline canvas, transport, inspector, arsenal, stage sim
└── utils/        bpmDerivation (shared, hardened)
```

**Assessment: STRONG.** Separation of concerns is real and enforced, not aspirational.

- **Engine vs. Dispatcher.** `ChronosEngine` owns time and resolves which clips are active. `ChronosStageDispatcher` owns *change detection* and command emission. The dispatcher holds a `prevState` (`ChronosStageDispatcher.ts:115-120`) and emits only on transition, which naturally throttles a per-frame `tick()` down to event-rate output without an explicit throttle. This is an elegant design choice.
- **Store vs. Engine.** `ChronosStore` is pure state + persistence and performs no timing work. Track/clip CRUD is consistently immutable (`_patchTrack`, `ChronosStore.ts:573-585`), producing new array identities — which the engine's index correctly exploits for cache invalidation via reference equality (§2.3).
- **Schema as a separate constitutional layer.** Splitting `LuxFileV3.ts` (types) / `.schema.ts` (runtime validation) / `.serializer.ts` (canonical I/O) / `.factories.ts` (construction) is textbook and materially better than the single-god-file pattern common in this sector.
- **Protocol polymorphism.** All clock sources implement a common `IClockSource` interface behind `ClockSourceManager`, so the engine consumes timecode without knowing its origin (`ChronosEngine.ts:999`).

### 2.2 Dual Representation — A Genuinely Good Decision

The codebase maintains a strict split between `LuxFileV3` (immutable, on-disk) and `ChronosProjectV3` (mutable runtime + ephemeral edit state), bridged by `toLuxFileV3()` / `toChronosProjectV3()` (`LuxFileV3.factories.ts:335-414`). Ephemeral state — playhead, viewport, zoom, `selectedClipIds` (a `Set`) — is structurally prevented from reaching disk.

This is the correct pattern and it is correctly implemented. It is worth noting that `selectedClipIds` being a `Set` would silently serialize to `{}` under `JSON.stringify` — the dual-representation split is precisely what prevents that class of corruption. Credit where due.

### 2.3 The Clip Index — Correct Design, Compromised Implementation

`ClipBoundaryIndex` (`ChronosEngine.ts:140-229`) is presented as a binary-search acceleration structure. The reality is more nuanced:

- The **binary search is real and correct**. `hasCrossedBoundary()` (`:210-223`) is a clean lower-bound search, correctly guards the empty-array case (`:211`), and correctly handles inclusive boundaries via the `<= lo` advance at `:221`. **No off-by-one defect found.**
- **However, the binary search is only used for cache invalidation, not for the query itself.** The actual active-clip resolution at `:191-203` is a **linear scan** over all clip entries with an early `break` once `startMs > timeMs`. Cost is O(number of clips starting before the playhead) — which at hour two of a dense show is effectively O(n).
- **Invalidation is sound but fragile.** `isStale()` (`:174-176`) uses reference equality on the tracks array. This is correct *only* while every mutation path stays immutable. `ChronosStore` honors this. `getClipById()` does **not** (§3.7).

See §5.2 for the quadratic defect this structure introduces on the cache-*hit* path.

### 2.4 Architectural Defect — The IPC Boundary Is Unvalidated

`ChronosIPCBridge.ts` is the frontier between the timeline and the physical DMX backend. It performs **existence checks only**, never domain validation:

```typescript
// ChronosIPCBridge.ts — handleFXTrigger
const fxType = command.effectId
const intensity = command.intensity ?? 1.0
const durationMs = command.durationMs
if (!fxType) { /* warn and return */ }
// ...intensity never clamped to [0,1]; durationMs never bounds-checked;
//    fxType never checked against VALID_FX_TYPES
```

`intensity` is never clamped to `[0,1]`, `durationMs` is never bounds-checked, and `fxType` is never validated against the `VALID_FX_TYPES` set that already exists in `TimelineClip.ts`. A malformed `.lux` file (which, per §3.4, can load despite a bad checksum) can therefore drive out-of-range values directly at the fixture output layer.

For a lighting product this is the wrong place to be permissive. **The boundary that touches hardware must be the strictest layer in the system, not the loosest.** A whitelist and a clamp here are trivial to add and should be a closing condition.

---

## 3. DATA INTEGRITY & I/O (`.lux` V3)

This section contains the findings that drive the valuation adjustment.

### 3.1 🔴 CRITICAL — Total Asset Loss: Every Shipped Project File Is Unloadable

The V3 loader opens with a hard gate:

```typescript
// LuxFileV3.schema.ts:244-250
if (data.$schema !== LUX_V3_SCHEMA) {
  errors.push(`Invalid $schema: expected '${LUX_V3_SCHEMA}', got '${String(data.$schema)}'`)
  return { valid: false, errors, warnings }   // immediate reject, no deep validation
}
```

We enumerated every project file in `chronos/scenes/`:

| File | Size | `$schema` | `checksum` | Format |
|---|---|---|---|---|
| `EScena1.lux` | 3.8 KB | **absent** | **absent** | V2 |
| `test1.lux` | 6.1 KB | **absent** | **absent** | V2 |
| `test2.lux` | 5.1 KB | **absent** | **absent** | V2 |
| `test3.lux` | 5.9 KB | **absent** | **absent** | V2 |
| `Untitled Project.lux` | 8.2 KB | **absent** | **absent** | V2 |
| `test1.lux.auto` | 6.1 KB | **absent** | **absent** | V2 |
| `test3.lux.auto` | 5.9 KB | **absent** | **absent** | V2 |

Their actual structure is the V2 shape — `{ meta: { version: "2.0" }, audio, timeline, library }` — with no `$schema` and no `checksum`. **Every one is rejected at line 244 before any other validation runs.**

The module header asserts the opposite:

```
* PREMISE:
*   `.lux` nace LIMPIA en V3. No existen shows V2 previos. No hay conversores.
```
— `LuxFileV3.ts:8-11`

The premise is factually incorrect within the vendor's own repository. Every extant show file is V2, and by explicit design decision no converter exists. **The vendor has architected away the migration path for 100% of its own content.**

There is a second-order finding here worth flagging to the deal committee: the discrepancy between documentation and reality in this codebase is systematic, not isolated. Source comments are written in the register of completed work ("THE INCORRUPTIBLE CORE", "Integrity is non-negotiable") for behavior that is demonstrably incomplete. **Treat all vendor documentation in this repository as unverified marketing until independently confirmed.** This has direct diligence-cost implications.

### 3.2 🔴 CRITICAL — Save → Load Round-Trip Is Broken (Vendor's Own Tests Are Red)

We executed the vendor's suite:

```
Test Files   3 failed | 7 passed  (10)
Tests        8 failed | 207 passed (215)

 ❯ src/chronos/__tests__/LuxFileV3.test.ts   (22 tests | 5 failed)
 ❯ src/chronos/__tests__/ProjectTypes.test.ts (14 tests | 2 failed)
 ❯ src/chronos/__tests__/DiamondData.test.ts  ( 5 tests | 1 failed)
```

The failures are not cosmetic. They are the data-integrity tests:

```
FAIL  LuxFileV3 — round-trip serialize/deserialize > lossless round-trip preserves all data
AssertionError: expected null not to be null   →  result.file was null

FAIL  LuxFileV3 — checksum integrity > tampering is detected on deserialize
AssertionError: expected null not to be null

FAIL  LuxFileV3 — checksum integrity > verifyLuxChecksum validates a freshly serialized file
TypeError: Cannot read properties of null (reading 'checksum')
```

**Root cause — isolated and reproduced.** We instrumented the validator against a minimal reconstruction of the vendor's own fixture (a Vibe clip spanning 0–10 000 ms with an FX clip layered at 4 000–6 000 ms on the same track — `LuxFileV3.test.ts:94-106`). Result:

```
### ERRORS: [
  "Temporal overlap on track 'trk_0ff71b7a…': clip 'clip_0d4d2b14…'
   [4000, 6000) overlaps [0, 10000)"
]
```

The culprit is the "P2.3 FIX" overlap check:

```typescript
// LuxFileV3.schema.ts:308-322
if (isFiniteNumber(clip.startMs) && isFiniteNumber(clip.endMs) && clip.startMs < clip.endMs) {
  const range: [number, number] = [clip.startMs as number, clip.endMs as number]
  for (const [prevStart, prevEnd] of ranges) {
    if (range[0] < prevEnd && prevStart < range[1]) {
      errors.push(`Temporal overlap on track '${trackId}': …`)   // HARD ERROR
      break
    }
  }
  ranges.push(range)
}
```

**The interval-overlap arithmetic itself is correct.** The defect is semantic: the check is **type-blind**. It treats a `vibe` clip and an `fx` clip as mutually exclusive occupants of a track, when the entire design intent of this product — an FX accent layered over a sustained base vibe — requires exactly that overlap. The vendor's own fixture encodes the intended pattern, and their own validator now rejects it as corruption.

**Consequence:** a user builds a show in the intended manner, saves it, and on reopening receives `"Invalid project file format"` (`ChronosStore.ts:691`) with the project discarded to `null`. **Silent, total, unrecoverable work loss.**

This is simultaneously the most serious finding in the audit and one of the cheapest to fix: the remedy is to partition ranges by clip type (or to demote same-track cross-type overlap to a warning). Estimated effort: **under half a day, plus regression tests.** The severity is in the consequence, not the complexity.

### 3.3 🟡 MEDIUM — Cycle Detection Produces False Positives on Shared References

`sortKeysDeep` (`LuxFileV3.serializer.ts:38-56`) adds every visited object to a `WeakSet` and **never removes it on exit from the recursion**:

```typescript
function sortKeysDeep(value: unknown, visited: WeakSet<object>): unknown {
  if (Array.isArray(value)) {
    if (visited.has(value)) throw new Error('Circular reference detected in sortKeysDeep (array)')
    visited.add(value)
    return value.map((v) => sortKeysDeep(v, visited))
  }
  …
}
```

This conflates *"seen anywhere previously"* with *"currently on the ancestor path."* Any **DAG** — the same object referenced from two sibling locations — is misreported as a cycle. We confirmed this empirically:

```
Is it actually circular?  JSON.stringify works: {"tracks":[{"clips":[{"id":"a","zones":["front","back"]},{"i ...
RESULT: FALSE POSITIVE -> Circular reference detected in sortKeysDeep (array)
```

The trigger is realistic: two clips sharing one `zones` array reference, or two FX clips sharing a cached `hephClip` from the same `.lfx` import. The consequence is a **thrown exception during save** — `serializeLuxV3` rejects, and in the autosave path (`ChronosStore.ts:953-955`) the failure is caught and reduced to a console error plus an `auto-save-error` event. Autosave then silently stops protecting the user for the remainder of the session.

Correct implementation requires `visited.delete(value)` on unwind (path-tracking rather than global marking). **Two-line fix.**

Note the genuine strength being undermined here: adding cycle detection at all is more diligence than most competitors show, and the canonical key-sorted stringify is a correct and thoughtful foundation for reproducible checksums. The implementation is simply wrong in one detail.

### 3.4 🔴 CRITICAL — Inverted Integrity Threat Model

The system's integrity posture is precisely backwards. Two rules interact pathologically:

**Rule 1 — a missing checksum is a fatal error:**
```typescript
// LuxFileV3.schema.ts:383-387
// P2.6 FIX: Checksum is now a HARD ERROR, not a warning.
// Tampered or unsigned files must NOT load — integrity is non-negotiable.
if (!isNonEmptyString(data.checksum)) {
  errors.push('Missing checksum (integrity cannot be verified — file may be tampered)')
}
```

**Rule 2 — a *wrong* checksum is a console warning:**
```typescript
// ChronosStore.ts:696-698
if (!des.checksumValid) {
  console.warn('[ChronosStore] ⚠️ Checksum mismatch — loading anyway')
}
```

The resulting behavior:

| Scenario | Outcome |
|---|---|
| Checksum field deleted | **Hard reject.** Refuses to load. |
| Entire payload corrupted, any non-empty checksum string retained | **Loads.** Console warning only. |

An attacker or a corrupting filesystem need only preserve *a* string in the `checksum` field. The check that actually detects corruption is advisory; the check that detects *absence of a check* is fatal. This punishes honest un-checksummed files (including every file in §3.1) while admitting genuinely corrupt ones.

**Additionally, the comment's security claim is unsound.** A bare SHA-256 over the file content, with no secret key, is an **error-detection code, not a tamper-detection mechanism**. Any actor who modifies the file simply recomputes the digest — `computeLuxChecksum` is exported and trivially callable. It is a perfectly good corruption detector and should be described as one. Claiming it defends against tampering is security theater, and if that claim ever reaches a datasheet it becomes a misrepresentation risk. Real tamper-evidence requires an HMAC with a protected key or a signature.

**Recommendation:** invert both rules. Checksum mismatch → hard error with an explicit, logged operator override. Checksum absent → warning plus migration path. Remove "tamper" language from the code and any derived documentation.

### 3.5 🟠 HIGH — Atomic Write Implemented for Manual Save, Omitted for Autosave

Manual save is correctly written atomically:

```typescript
// electron/ipc/ChronosIPCHandlers.ts:324-330
// P1.1 FIX: Atomic write — write to .tmp file first, then rename.
const tmpPath = filePath + '.tmp'
await fs.promises.writeFile(tmpPath, request.json, 'utf-8')
await fs.promises.rename(tmpPath, filePath)
```

This is the right pattern, and load is likewise guarded against OOM by an up-front size check (`:374-378`). Both are credited as strengths.

**But the autosave handler — the mechanism whose entire purpose is crash survival — writes directly, non-atomically:**

```typescript
// electron/ipc/ChronosIPCHandlers.ts:444-451
ipcMain.handle('chronos:write-auto-save', async (_event, request) => {
  …
  await fs.promises.writeFile(filePath, request.json, 'utf-8')
```

Autosave fires every 60 seconds during a live show (`ChronosStore.ts:885-895`). A crash or power loss during that write truncates the recovery file. **The safety net is the only unprotected write in the system** — it is the one file guaranteed to be mid-write when the event it protects against occurs.

Two secondary gaps in the manual path as well:

1. **No `fsync` before `rename`.** `rename()` is atomic with respect to *directory metadata*, but without an `fdatasync` on the temp file (and ideally on the directory) the rename can commit while the data blocks are still buffered. On power loss this yields a zero-length or partially-written file at the destination — the exact outcome atomicity was meant to prevent.
2. **Orphaned `.tmp` files.** If `rename` throws, the temp file is never cleaned up.

**Also absent: generational backups.** GrandMA3 and Chamsys both retain multiple prior show-file generations precisely because a single atomic write still leaves exactly one copy of irreplaceable work. For a product in this category this is table stakes, not a luxury.

### 3.6 🟡 MEDIUM — Audio Path Corrupted In-Memory After Save

`save()` rewrites the live in-memory audio path to a relative form immediately before serializing, and never restores it:

```typescript
// ChronosStore.ts:609-617
if (this.projectPath && this.project.audio) {
  const absoluteAudioPath = this.project.audio.relativePath
  const relativePath = toRelativePath(this.projectPath, absoluteAudioPath)
  this.project.audio = { ...this.project.audio, relativePath }   // mutated, never reverted
}
```

Post-save, `this.project.audio.relativePath` holds a *relative* path while the session continues to run. Any subsequent consumer of `getAudioInfo()` (`:868-875`) — audio reload, `checkFileExists`, re-analysis — receives a path that will not resolve from the process working directory. Symptom: audio spuriously reports as missing after a save, with no user action that would explain it.

The on-disk result is idempotent (a second save is harmless because the already-relative path fails the `startsWith` test and passes through), so this is a session-state defect rather than a file-corruption defect. Correct fix: derive the relative path into a local for serialization only; never mutate live state.

**Related — operator-precedence bug in `toRelativePath`:**

```typescript
// ChronosStore.ts:48
const luxDir = luxFilePath.substring(0, luxFilePath.lastIndexOf('/') + 1 || luxFilePath.lastIndexOf('\\') + 1)
```

The `||` binds inside `substring`'s second argument, selecting whichever separator search returns a truthy (non-zero) index. For pure-POSIX or pure-Windows paths this happens to work. For **mixed separators** — routine in Electron on Windows, e.g. `C:/proj\test.lux` — it takes the forward-slash index and produces a truncated, incorrect directory. The audio path then silently persists as absolute, defeating project portability. `path.dirname()` should be used.

### 3.7 🟡 MEDIUM — A Getter That Mutates Persisted State

```typescript
// ChronosStore.ts:853-863
getClipById(clipId: string): TimelineClip | undefined {
  for (const track of this.project.tracks) {
    const found = track.clips.find(c => c.id === clipId)
    if (found) {
      const clip = found as unknown as TimelineClip
      clip.trackId = clip.type === 'vibe' ? 'vibe' : track.id   // ← writes to stored object
      return clip
    }
  }
}
```

A read accessor performs an in-place write on the stored clip, injecting the runtime-only `trackId` field into an object that lives in the persisted tree. Two consequences:

1. **Index staleness.** The mutation does not change the `tracks` array identity, so `ClipBoundaryIndex.isStale()` (`ChronosEngine.ts:174-176`) cannot observe it. This is benign for `trackId` specifically, but the pattern is one refactor away from silently desynchronizing the engine's active-clip resolution from reality.
2. **The `readonly` contract is fiction.** `LuxClipV3.id` and the `LuxFileV3` field set are declared `readonly`, but the codebase routes around this with `as unknown as TimelineClip` casts. TypeScript's guarantees are being explicitly discarded at exactly the boundary where they matter most.

`timelineClipToLuxClip()` (`LuxFileV3.factories.ts:366-396`) does correctly whitelist fields on the way out, so `trackId` is stripped before disk. The disk format is safe; the in-memory invariant is not.

### 3.8 Schema Coverage Gaps

Validation depth is markedly uneven. Deep, genuinely thorough validation exists for FX clips — including recursion into `hephClip.tracks[].curve.keyframes[]` with per-keyframe `timeMs`/`value` checks (`LuxFileV3.schema.ts:129-166`) — and a cross-band length check ensures the seven tactical FFT bands match the energy array length (`:355-371`). That is careful work.

But entire top-level structures are unvalidated:

| Field | Validation |
|---|---|
| `markers` | `Array.isArray` only — **no element validation**. `timeMs`, `type`, `id` all unchecked. |
| `automationLanes` | **None whatsoever.** Not referenced in `validateLuxFileV3`. |
| `safety` | **None.** `maxStrobeFreqHz` unbounded — see §7.3. |
| `vibeBase` | **None.** `intensity` unbounded despite the `[0,1]` check enforced on clips. |
| `meta.createdAt` / `modifiedAt` | Not validated as ISO-8601; feeds `Date.parse` in recovery logic (`ChronosStore.ts:999`). |
| `audio.detectedBpm` | **Warning only** — the entry point for the DoS in §6.1. |
| `audio.audioHash` | Declared in the type as *"SHA-256 hash of the audio file (integrity check)"* — **never computed, never verified anywhere in the codebase.** A single grep across `electron-app/` returns exactly one hit: the type declaration itself. Documented capability that does not exist. |

The pattern is consistent: where the vendor implemented validation, they implemented it well. They simply stopped before finishing.

---

## 4. PROTOCOL STACK EVALUATION

**This is the strongest area of the codebase and the primary source of acquisition value.** The protocol work reflects genuine domain expertise that is difficult and expensive to reproduce.

### 4.1 LTC Decoder — Correct and Well-Architected ✅

`LTCDecoder.ts` implements SMPTE 12M linear timecode as a true **AudioWorklet** (`:76`, `class LTCDecoderProcessor extends AudioWorkletProcessor`), executing on the audio render thread. This is the correct choice; a `ScriptProcessorNode` implementation (still common in competing web-stack products) would be disqualifying.

Verified correct:

- **Biphase-mark decoding** (`:131-183`) with adaptive bit-period tracking via an IIR filter (`avgBitPeriod * 0.95 + width * 0.05`, `:169`) and a 75%-of-period slicing threshold (`:163`). Correctly distinguishes one long pulse (`0`) from two paired short pulses (`1`).
- **Bidirectional sync-word detection** — both `0x3FFD` forward and `0xBFFC` reverse (`:54-57`, `:209-227`), enabling shuttle and reverse-playback lock. This is a detail frequently omitted; its presence indicates real familiarity with the standard.
- **80-bit frame assembly** with correct BCD field offsets per SMPTE 12M, drop-frame flag at bit 10 (`:230-250`).
- **Divide-by-zero on first pulse is properly guarded.** An initial hypothesis that `:155` divides by an uninitialized `avgBitPeriod` was **investigated and disproven** — `:149-152` seeds `avgBitPeriod` immediately before the division. No defect.
- **Signal lock and loss** — ratio gate of 0.3–2.5 rejects noise (`:156`); 500 ms timeout clears the connected state.
- **Clean teardown** — `await audioContext.close()` and `workletNode.port.onmessage = null` before disconnect (`:433-459`).

**Limitation (not a defect):** frame-rate inference is partial. Only 29.97 is derived, from the drop-frame flag (`:512-520`); 24/25/30 must be user-selected rather than inferred from bit-period analysis. Acceptable for professional operation where rate is configured, but worth noting against competitors that auto-detect.

### 4.2 MTC Parser — One Real Defect, One Subtle Defect

**Verified correct:** quarter-frame nibble extraction (`:248-252`), forward/reverse sequence detection (`:254-262`), full-frame SysEx header validation `F0 7F 7F 01 01` (`:326-336`), rate-code extraction from bits 5–6 of piece 7 (`:302-304`), and BCD range validation that **drops** corrupt frames rather than displaying them (`:306-313`). The last is defensive programming of a quality rarely seen in MIDI code.

**🟠 HIGH — The mandatory +2 frame offset is absent.**

```typescript
// MTCParser.ts:315-316
this.currentTimecode = { hours, minutes, seconds, frames, frameRate }
this.currentTimeMs = smpteToMs(this.currentTimecode)   // no offset compensation
```

MTC transmits one full timecode across eight quarter-frame messages spanning **two frames** of wall time. The value encoded in those nibbles describes the instant transmission *began*. When assembly completes on piece 7, real time has advanced two frames beyond the assembled value. A conformant receiver must add two frames.

Chronos does not. **All MTC-synchronized output therefore lags the true timecode by two frames — 66.7 ms at 30 fps, 80 ms at 25 fps.**

For lighting this is not academic. An 80 ms late cue on a musical accent is plainly visible to an audience, and the error is *systematic* — it will not be caught by casual testing, only by measurement against a reference. Any operator cross-checking Chronos against a GrandMA3 on the same MTC feed will observe the discrepancy immediately. (Note: the correction is to **add** two frames — the reported position lags, it does not lead.)

**🟡 MEDIUM — Frame mixing under packet loss.** `receivedPieces` is reset **only** after a successful assembly (`:282`). If a quarter-frame is dropped, the bitmask never reaches `0xFF` at piece 7, so accumulation continues into the *next* timecode instant. The mask then completes using nibbles drawn from two different timecodes, producing a plausible-looking but wrong value — up to one frame of silent error. A sequence discontinuity is *detected* at `:255-261` but triggers no state reset. The mask should be cleared whenever the piece sequence breaks.

### 4.3 MIDI Clock — Solid Derivation, Missing Locate

**Strength — `bpmDerivation.ts` is exemplary.** Extracted as shared logic (correctly eliminating duplication between `useMIDIClock` and `MIDIClockSlave`) and comprehensively hardened:

```typescript
// bpmDerivation.ts:70-81
const avgInterval = state.beatIntervals.reduce((a, b) => a + b, 0) / state.beatIntervals.length
if (!Number.isFinite(avgInterval) || avgInterval <= 0) return null      // zero/negative/NaN
const calculatedBpm = 60000 / avgInterval
if (!Number.isFinite(calculatedBpm)) return null                        // Infinity guard
const clampedBpm = Math.max(BPM_MIN, Math.min(BPM_MAX, calculatedBpm))  // [20, 300]
```

This closes every numerical failure mode we probed: two ticks in the same millisecond, zero interval, NaN, and Infinity. The explicit `isFinite` check *before* clamping is the correct ordering — `Math.min/max` propagates `Infinity` silently, and the author evidently knew that. An 8-beat sliding window plus 0.5 BPM hysteresis suppresses jitter. **This is the single best-engineered function in the module.**

**🟠 HIGH — Song Position Pointer (`0xF2`) is entirely unimplemented.** A repository-wide search for `0xF2`, `SPP`, and `songPosition` across `chronos/` returns **zero matches**. Start/Stop/Continue are handled (`MIDIClockSlave.ts:213-233`), but without SPP the system cannot follow an external master that locates to an arbitrary bar. In practice: the DJ or MD jumps to the chorus, and Chronos resumes from the wrong position. This is a functional gap in external-sync operation, not merely a missing nicety.

### 4.4 Clock Switching and PLL — Well Hardened ✅

**PLL numerical stability is genuinely good.** `applyPLL` (`ClockSourceManager.ts:368-422`) rejects non-finite input at the boundary and falls back to last-known-good rather than poisoning filter state:

```typescript
if (!Number.isFinite(rawTime)) return this.pllSmoothedTime ?? rawTime
…
const safeDelta = Number.isFinite(rawDelta) ? rawDelta : 0
const clampedDelta = Math.max(-this.PLL_MAX_JUMP_MS, Math.min(this.PLL_MAX_JUMP_MS, safeDelta))
this.pllSmoothedTime = predicted + this.PLL_ALPHA * (target - predicted)
```

Exponential smoothing (α = 0.05) with ±5 ms jump clamping and forward extrapolation against wall clock. **We could not construct an input that permanently poisons the filter.** This directly satisfies the mandate's NaN/Infinity-propagation concern for the PLL.

**Source switching awaits teardown** before engaging a new source (`:113-147`), preventing dual-clock emission — a real race that naive implementations exhibit. Listener cleanup is systematic: every subscription is stored as a disposer and invoked on switch (`:341-366`).

**🟢 LOW — no re-entrancy guard on `setSource()`.** Two rapid calls can interleave across the `await`, allowing a second source to start before the first completes cleanup. Unlikely via UI, plausible via automation or MIDI-triggered source changes. A boolean `isSwitching` latch resolves it.

**No jam-sync / freewheel.** Forward extrapolation provides rudimentary coasting, but there is no explicit freewheel-on-dropout or jam-sync-on-reacquire. Professional timecode products provide configurable freewheel; competitive gap rather than defect.

### 4.5 Art-Net Timecode — Correct ✅

`parseArtNetTimecodePacket` (`ArtNetTimecodeReceiver.ts:102-133`) is a **pure function** — no I/O, no side effects — which is why it is also the best-tested component in the module. Validation order is correct and complete:

```typescript
if (buffer.length < 19) return null                                   // bounds FIRST
for (…) if (buffer[i] !== ARTNET_HEADER[i]) return null               // "Art-Net\0"
if (buffer[8] !== OP_TIMECODE_LO || buffer[9] !== OP_TIMECODE_HI) return null   // OpCode 0x9700
…
if (frames >= 30 || seconds >= 60 || minutes >= 60 || hours >= 24) return null  // range
if (frameRate === undefined) return null                              // rate-code map
```

**Length check precedes all indexed reads — no out-of-bounds access is reachable.** Malformed and short packets are silently dropped, correct for UDP. No findings.

### 4.6 Protocol Test Coverage — Severely Unbalanced

`Protocols.test.ts` (431 lines) covers SMPTE conversion utilities, the Art-Net parser (thoroughly, including negative cases), `MIDIClockMaster` BPM clamping, and `ClockSourceManager` switching.

**It contains no tests for MTCParser, MIDIClockSlave, or LTCDecoder.**

The three most complex, most defect-prone components in the protocol stack — the two containing the HIGH-severity defects identified above — are entirely untested. The correlation is not coincidental: the +2 offset omission and the SPP gap are exactly the class of defect a conformance test would have caught on day one.

Also untested: PLL NaN/Infinity injection, jump clamping, rapid source switching, and all permission-denial paths (MIDI access refused, microphone denied, worklet load failure).

---

## 5. PERFORMANCE & GARBAGE COLLECTION

### 5.1 React Decoupling — Correctly Solved ✅

The single most common architectural failure in browser-based timeline products — driving the playhead through React state at 60 fps — **has been correctly avoided.** A consistent `currentTimeRef` pattern is applied across the module, with imperative DOM writes on the hot path:

```typescript
// TimelineCanvas.tsx:556-562 — direct SVG attribute mutation, zero reconciliation
lineRef.current.setAttribute('x1', String(pos))
polygonRef.current.setAttribute('points', `${pos - 6},0 ${pos + 6},0 ${pos},10`)

// TransportBar.tsx:247-248 — direct textContent mutation
spanRef.current.textContent = formatTimecode(currentTimeRef.current)
```

`useFreeRunClock` implements a deliberate dual-rate scheme: the ref updates every frame for real-time consumers (injector, recorder) while React state syncs at ~20 fps for UI (`:115-120`). This is a sophisticated and correct trade-off.

`ChronosLayout.tsx:396-479` consolidates three previously independent RAF loops into one unified tick with stable dependencies (`[isPlaying]`). Good remediation of a known problem.

### 5.2 🟠 HIGH — Quadratic Linear Scan on the Per-Frame Cache-Hit Path

The `ClipBoundaryIndex` fast path — the branch taken on **every frame where no clip boundary is crossed**, i.e. the overwhelming majority of frames — contains a linear search nested inside a map:

```typescript
// ChronosEngine.ts:180-186
if (this.cachedActiveClips !== null && !this.hasCrossedBoundary(this.lastQueryTimeMs, timeMs)) {
  return this.cachedActiveClips.map(clip => ({
    clip,
    track: this.clipEntries.find(e => e.clip === clip)!.track,   // ← O(n) inside O(m)
  }))
}
```

Cost is **O(active × total)** every frame, plus a fresh array and one wrapper object per active clip per frame. For a plausible large show — 2 000 clips, 10 active — that is ~20 000 reference comparisons and 11 allocations **per frame**, or ~1.2 M comparisons and 660 allocations per second at 60 fps.

The irony is that the cache exists to *avoid* work, and the "optimized" path is asymptotically worse than the uncached one. The remedy is trivial — store the `track` alongside the clip in `cachedActiveClips`, or key a `Map<LuxClipV3, LuxTrackV3>` once at rebuild — reducing this to O(m) with zero searching.

*(Note for the record: an initial subagent assessment classified this structure as an unqualified strength. Direct inspection of the cache-hit branch contradicted that. The binary search in `hasCrossedBoundary` is genuinely correct; the surrounding code is not.)*

### 5.3 🟠 HIGH — Render Hot-Path Allocation

**Per-clip filter-and-sort inside the render pass** (`TimelineCanvas.tsx:1373-1375`):

```typescript
const nextVibeClip = clips
  .filter(c => c.type === 'vibe' && c.trackId === clip.trackId && c.startMs > clip.startMs)
  .sort((a, b) => a.startMs - b.startMs)[0]
```

Executed **for every clip, on every render**: O(n) filter plus O(n log n) sort per clip → **O(n² log n) overall**, with two array allocations per clip. At 100 vibe clips this is ~10 000 operations and 200 allocations per render. Should be a precomputed next-pointer or a binary search over a sorted array.

**Gradients reconstructed every frame** (`WaveformLayer.tsx:310, 341`): `createLinearGradient` plus `addColorStop` calls allocate a fresh `CanvasGradient` on each render despite depending only on `height`. Should be cached and invalidated on resize.

**Cumulative offset via `slice().reduce()`** (`TimelineCanvas.tsx:1340-1342`): allocates a new array per track per render to compute a running sum — should be a single precomputed prefix-sum array.

**Credit where due:** `WaveformLayer.tsx:196-207` implements a quantized colour cache specifically to avoid per-bar string construction. The author clearly understood this cost class — the mitigation was simply applied unevenly.

### 5.4 AudioContext Lifecycle — No Ghosts Found ✅

We enumerated every `AudioContext` construction. **All four have matching `close()` calls:**

| Site | Pattern | Teardown |
|---|---|---|
| `useAudioLoader.ts:118-125` | Module singleton | `closeAudioContext()` (`:133-143`) ✅ |
| `useLiveAudioInput.ts:352` | Per-session | `await close()` (`:196-202`) ✅ |
| `ChronosEngine.ts:466` | Engine-owned | `close()` in dispose (`:551-553`) ✅ |
| `LTCDecoder.ts:373` | Protocol-owned | `await close()` (`:451-457`) ✅ |

The singleton in `useAudioLoader` structurally prevents the repeated load/unload leak that would otherwise exhaust Chrome's ~6-context ceiling. Three of four sites correctly `await` closure before nulling. **No ghost contexts identified.**

**"Phantom" is not a leak** — worth stating explicitly, since the name invites suspicion. `useAudioLoaderPhantom.ts` refers to decoding audio in a **hidden BrowserWindow** (separate process), returning only lightweight JSON to the renderer. This is a deliberate and correct isolation strategy, and it is a genuine competitive strength.

### 5.5 Memory Profile — Excellent ✅

The vendor explicitly rejected the naive approach, and documented why:

```typescript
// useStreamingPlayback.ts:14-17
// WHY NOT AudioBufferSourceNode:
// - BufferSource requires decodeAudioData → loads entire file to RAM
// - 170MB MP3 = 2GB+ decoded PCM in memory
// - MediaElementSource streams, no RAM bloat
```

For a 10-minute stereo 48 kHz track:

| Representation | Footprint |
|---|---|
| Raw decoded PCM (naive) | **~230 MB** |
| Waveform peaks + RMS @ 100 sps | ~960 KB |
| Energy heatmap @ 50 ms, 5 bands | ~480 KB |
| **Chronos actual** | **~1.5 MB (≈99.3% reduction)** |

Combined with Phantom-process decode isolation, this is materially better memory engineering than the streaming-timeline norm.

### 5.6 Event Listener Hygiene — Clean ✅

Audited every `addEventListener` and observer construction across the UI and hook layers. **Every one has a matching teardown** — `window` and `document` listeners removed in `useEffect` cleanup (`ChronosLayout.tsx:562-563`, `TimelineCanvas.tsx:1272-1277`), `wheel` listener removed (`:975-976`), and both `ResizeObserver` instances disconnected (`TimelineCanvas.tsx:738-760`, `WaveformLayer.tsx:528-535`). Snap timeout cleared on unmount (`useTimelineClips.ts:120-128`). **No leaks found.** This is disciplined work.

### 5.7 RAF Loop Inventory

Seven distinct RAF loops (five active during playback, one one-shot, one in the apparently-unused `useAutoScroll`). **All cancel correctly on unmount.** Duplicate-loop risk is low but non-zero: the auto-follow loop in `TimelineCanvas.tsx:642-670` carries `dimensions.width` in its dependency array, tearing down and rebuilding on every resize frame. Should read dimensions from a ref.

The consolidation in `ChronosLayout` was the right move; it simply was not carried through to `TimelineCanvas`, which still runs two independent loops.

### 5.8 Culling

Waveform rendering culls properly — only visible samples are iterated, with a downsample cap of 200 bars and per-bar off-screen skip (`WaveformLayer.tsx:322-360`). Grid lines are culled at generation (`TimelineCanvas.tsx:155-166`).

Clip rendering **iterates all clips** and culls via early return inside the map (`:1390-1391`). Correct output, but O(n) traversal per frame regardless of viewport occupancy. With the §5.3 defect layered on top, this is the dominant frame cost in large shows.

---

## 6. CHAOS ENGINEERING (EDGE CASES)

Verified by direct source inspection and, where marked ⚙, by executing the code.

### 6.1 🔴 CRITICAL — Unbounded Loop / OOM From a Malformed Project File

A complete, exploitable chain from untrusted file content to renderer hard-lock. **Reproduced.** ⚙

**Step 1 — `Infinity` enters through JSON.** `JSON.parse` converts overflowing literals to `Infinity`:
```
JSON.parse 1e400 -> Infinity | Number.isFinite: false
```

**Step 2 — the schema permits it.** `audio.detectedBpm` failing `isFiniteNumber` produces a **warning**, not an error (`LuxFileV3.schema.ts:270-272`). The file loads.

**Step 3 — nullish coalescing does not filter it.** `??` only intercepts `null`/`undefined`; `Infinity` passes through (`LuxFileV3.factories.ts:336`).

**Step 4 — it reaches React state unvalidated.** `setBpm(audioInfo!.detectedBpm)` — `ChronosLayout.tsx:795`, `:819`, `:836`. No guard at any of the three call sites.

**Step 5 — division yields a zero step.**
```typescript
// TimelineClip.ts:475-484
export function calculateBeatGrid(bpm: number, durationMs: number): number[] {
  const msPerBeat = 60000 / bpm            // Infinity → 0
  const beats: number[] = []
  for (let t = 0; t <= durationMs; t += msPerBeat) {   // t += 0 → never advances
    beats.push(Math.round(t))                          // unbounded array growth
  }
  return beats
}
```

Reached from `useTimelineClips.ts:132` inside a `useMemo` keyed on `bpm`.

**Execution result:**
```
JSON.parse 1e400 -> Infinity | Number.isFinite: false
msPerBeat = 0
INFINITE LOOP CONFIRMED (calculateBeatGrid would OOM)
```

**Impact:** opening a single malformed `.lux` file freezes the renderer with unbounded heap growth until the process is killed. There is no recovery, no error dialog, and the UI thread is gone — during a live show this is a **complete blackout of the lighting console.**

Note this is reachable not only through malice but through ordinary file corruption or a bad third-party export. One `Number.isFinite` guard closes it.

### 6.2 Verified Edge-Case Matrix

| # | Condition | Behavior | Verdict |
|---|---|---|---|
| 1 | `detectedBpm = 1e400` (→ `Infinity`) | Unbounded loop → OOM ⚙ | 🔴 **CRITICAL** |
| 2 | `bpm = 0` | `msPerBeat = Infinity`; loop exits after one iteration ⚙ | 🟢 Degrades safely |
| 3 | `bpm = NaN` | `msPerBeat = NaN`; `t <= durationMs` false → empty grid | 🟡 Silent, no crash |
| 4 | `bpm = Infinity` in `ChronosRecorder.snapToGrid` | Guard is `bpm <= 0` only — misses `Infinity`/`NaN`; returns `NaN` (`ChronosRecorder.ts:326-342`) | 🟡 **MEDIUM** |
| 5 | MIDI: two ticks, same millisecond | `avgInterval <= 0` → `null` (`bpmDerivation.ts:74`) | ✅ **Correct** |
| 6 | MIDI: `NaN`/`Infinity` interval | Dual `isFinite` guards before and after division | ✅ **Correct** |
| 7 | BPM beyond `[20,300]` | Clamped (`bpmDerivation.ts:80`); verified by vendor test | ✅ **Correct** |
| 8 | PLL fed non-finite time | Returns last-good; state never poisoned (`ClockSourceManager.ts:384-388`) | ✅ **Correct** |
| 9 | **Overlapping clips, same track** | **Hard validation error — file rejected as corrupt** (§3.2) ⚙ | 🔴 **CRITICAL** |
| 10 | Overlapping clips at runtime (dispatcher) | `activeVibes[0]` wins by array order; no HTP/LTP merge (`ChronosStageDispatcher.ts:189`) | 🟠 **Undefined** |
| 11 | Missing `checksum` | Hard reject (`LuxFileV3.schema.ts:385`) | 🔴 **Inverted** (§3.4) |
| 12 | Wrong `checksum` | Console warning; **loads anyway** (`ChronosStore.ts:696-698`) | 🔴 **Inverted** (§3.4) |
| 13 | Circular reference in save | Throws, save aborted (`LuxFileV3.serializer.ts:41`) | ✅ Correct intent |
| 14 | **Shared (non-circular) reference** | **False-positive "circular" → save fails** ⚙ | 🟡 **MEDIUM** (§3.3) |
| 15 | `Infinity`/`NaN` in a numeric field on save | `JSON.stringify` emits `null` ⚙; caught by `isFiniteNumber` on reload | ✅ Contained |
| 16 | Malformed JSON | Structured parse error, no throw (`:130-144`) | ✅ **Correct** |
| 17 | Oversized project file | Rejected pre-read via `stat` (`ChronosIPCHandlers.ts:374-378`) | ✅ **Correct** (OOM guard) |
| 18 | Crash during autosave write | **Non-atomic — recovery file truncated** (§3.5) | 🟠 **HIGH** |
| 19 | Power loss between write and rename | No `fsync`; rename may commit ahead of data | 🟡 **MEDIUM** |
| 20 | Legacy V2 `.lux` file | Hard reject, no converter (§3.1) | 🔴 **CRITICAL** |
| 21 | Zero-duration clip | Active within hardcoded 16 ms window (`ChronosEngine.ts:195`) | 🟡 Magic number |
| 22 | All-silent audio buffer | `maxPower === 0` → early return 0 (`GodEarFFT.ts:912`) | ✅ **Correct** |
| 23 | `log(0)` in spectral flatness | Threshold gate; `-Infinity` → `exp` → 0 | 🟢 Survives implicitly |
| 24 | Non-power-of-two FFT size | Coerced via `nearestPowerOf2` (`godear-offline.worker.ts:200`) | ✅ **Correct** |
| 25 | Worker timeout / error | `terminate()` on all three paths incl. 60 s timeout (`GodEarOffline.ts:165-228`) | ✅ **Correct** |
| 26 | Art-Net short/malformed packet | Length check precedes all reads; `null` returned | ✅ **Correct** |
| 27 | MTC quarter-frame dropped | `receivedPieces` never reset → frames mixed (§4.2) | 🟡 **MEDIUM** |
| 28 | MTC corrupt BCD | Range-validated and dropped (`MTCParser.ts:307-313`) | ✅ **Correct** |
| 29 | External master sends SPP | **Ignored — not implemented** (§4.3) | 🟠 **HIGH** |
| 30 | Rapid clock-source switching | No re-entrancy latch across `await` | 🟢 **LOW** |
| 31 | Audio reload after save | Path left relative in memory → false "missing" (§3.6) | 🟡 **MEDIUM** |
| 32 | Mixed-separator path (`C:/a\b.lux`) | `toRelativePath` precedence bug → wrong dir (§3.6) | 🟡 **MEDIUM** |
| 33 | Out-of-range `intensity` via IPC | Never clamped (§2.4) | 🟠 **HIGH** |
| 34 | Duplicate clip IDs across tracks | Detected (`LuxFileV3.schema.ts:300-306`) | ✅ **Correct** |
| 35 | Heatmap band/energy length mismatch | Detected as error (`:355-371`) | ✅ **Correct** |

### 6.3 DSP Verification — Genuine, Not Claimed

Because "we implemented an FFT" is a claim frequently made and rarely true, we inspected it directly. It holds up:

- **Real radix-2 Cooley-Tukey**, bit-reversal permutation plus bottom-up DIT butterfly stages with precomputed twiddle tables (`GodEarFFT.ts:587-646`). Not a wrapper, not an O(N²) DFT in disguise.
- The source records verification against a brute-force DFT for all power-of-two sizes N = 4…4096.
- **Blackman-Harris 4-term windowing** (`:388-451`), correctly implemented, −92 dB sidelobes.
- **Transferable `Float32Array`** to the worker — zero-copy, with a defensive clone first since transfer detaches the source (`GodEarOffline.ts:211-228`).
- Onset detection is a **dual-slope energy-envelope** method with a dynamic threshold and 50 ms debounce (`godear-offline.worker.ts:598-646`) — functional and honest, though less robust than spectral-flux or complex-domain methods for polyphonic material. This is a quality ceiling, not a defect.

---

## 7. REMAINING TECHNICAL DEBT

**The mandate requires that a flawless module be acknowledged as such. This module is not flawless.** The debt below is real, specific, and — importantly — mostly bounded.

### 7.1 Blocking (Conditions Precedent to Closing)

| ID | Finding | Ref | Est. |
|---|---|---|---|
| **B-1** | Type-blind overlap validation rejects Vibe+FX layering; breaks save/load; 5 vendor tests red | §3.2 | 2–3 d |
| **B-2** | No V2→V3 migration; 100% of extant `.lux` assets unloadable | §3.1 | 1–2 wk |
| **B-3** | `calculateBeatGrid` unbounded loop → renderer OOM from malformed file | §6.1 | 0.5 d |
| **B-4** | Inverted checksum policy; remove unsupportable "tamper" claim | §3.4 | 1–2 d |
| **B-5** | Autosave write non-atomic; add `fsync`; add generational backups | §3.5 | 3–5 d |

### 7.2 High Priority (Pre-Release)

| ID | Finding | Ref | Est. |
|---|---|---|---|
| H-1 | MTC +2 frame offset absent — systematic 67–80 ms sync error | §4.2 | 1 d + conformance rig |
| H-2 | MIDI Song Position Pointer unimplemented | §4.3 | 2–3 d |
| H-3 | IPC boundary unvalidated (clamp `intensity`, whitelist `fxType`, bound `durationMs`) | §2.4 | 2 d |
| H-4 | `ClipBoundaryIndex` cache-hit path is O(active × total) per frame | §5.2 | 1 d |
| H-5 | Per-clip filter+sort in render → O(n² log n) | §5.3 | 2 d |
| H-6 | Overlapping-clip runtime behavior undefined (no HTP/LTP merge) | §6.2 #10 | 1 wk (design) |
| H-7 | Protocol conformance tests for MTC / MIDI Slave / LTC (currently zero) | §4.6 | 1–2 wk |

### 7.3 ⚠️ Safety and Brand Liability — Escalated

`LuxSafetyV3` declares `maxStrobeFreqHz` and `containsRapidFlash` (`LuxFileV3.ts:349-358`). **Neither is validated on load nor enforced at output.** The `safety` object is absent from `validateLuxFileV3` entirely (§3.8).

Photosensitive-epilepsy risk in the 3–30 Hz band is a regulated concern in live entertainment. A product shipped under an **AlphaTheta or MA Lighting** marque that declares a safety capability in its file format and does not enforce it carries exposure well beyond engineering cost. This warrants **independent safety review as a separate workstream**, not a line item in the backlog.

Related: `audioHash` is documented in the schema as an integrity check and is **never computed or verified anywhere** (single grep hit: the type declaration). Documented-but-absent capabilities in a safety-adjacent format are a compliance concern in their own right.

### 7.4 Medium / Low

- MTC frame mixing after packet loss (§4.2)
- Post-save audio path corruption + `toRelativePath` precedence bug (§3.6)
- `sortKeysDeep` false-positive cycle detection (§3.3)
- `getClipById` mutates persisted state; `readonly` bypassed via casts (§3.7)
- `markers`, `automationLanes`, `safety`, `vibeBase` unvalidated (§3.8)
- Per-frame gradient allocation; `slice().reduce()` prefix sums (§5.3)
- `snapToGrid` guards `bpm <= 0` but not `Infinity`/`NaN` (§6.2 #4)
- Auto-follow RAF rebuilds on resize (§5.7)
- 16 ms zero-duration magic number (§6.2 #21)
- No PLL re-entrancy latch (§4.4)
- Dead code: `useAutoScroll` appears unused
- `ProjectTypes.test.ts` / `DiamondData.test.ts` — 3 further failures from a default `global` track added to the empty-project factory without updating assertions

**Hypotheses investigated and rejected** (recorded for completeness and to bound future re-diligence):
- LTC divide-by-zero on first pulse — **disproven**; guarded at `LTCDecoder.ts:149-152`.
- `ClipBoundaryIndex` binary search off-by-one — **disproven**; `hasCrossedBoundary` is correct including empty-array and inclusive-boundary cases.
- Ghost `AudioContext` accumulation — **disproven**; all four sites close correctly.
- Event listener / observer leaks — **disproven**; teardown is complete throughout.
- Float precision loss over long timelines — **disproven**; JS numbers are IEEE-754 doubles; ~1 µs precision at 3 hours.

### 7.5 Debt Summary

Total blocking + high-priority remediation: **9–14 engineer-weeks**, excluding the independent safety review and any V2 migration corpus work discovered during B-2.

Two observations for the committee. First, the debt is **concentrated in validation and guard logic**, not in architecture, DSP, or protocol implementation. Nothing here requires redesign. Second, the pattern throughout is *"correct mechanism, incomplete application"* — atomic writes implemented then omitted for autosave; `isFinite` guards written beautifully in `bpmDerivation` then absent in `calculateBeatGrid`; deep validation for FX clips then none for markers. This signals a team that **knows what correct looks like** but ran out of runway before applying it uniformly. That is a far better acquisition profile than a team that does not know the difference — and it is the strongest argument for retaining the original authors (§1.4.4).

---

## 8. FINAL ACQUISITION SCORE

| Dimension | Wt | Score | Wtd | Rationale |
|---|---|---|---|---|
| **Architecture & Separation of Concerns** | 15% | 84 | 12.6 | Clean layering; dual-representation model; protocol polymorphism. Unvalidated IPC frontier. |
| **Data Integrity & I/O** | 25% | 28 | 7.0 | Round-trip broken; zero migration path; inverted checksum policy; non-atomic autosave. **Dominant risk.** |
| **Protocol Stack** | 20% | 76 | 15.2 | LTC and Art-Net correct; PLL hardened; BPM derivation exemplary. MTC offset and SPP absent; zero tests on three of five protocols. |
| **Performance & Memory** | 15% | 74 | 11.1 | React decoupling and memory architecture excellent; no context or listener leaks. Quadratic hot paths and per-frame allocation. |
| **Edge-Case Robustness** | 15% | 42 | 6.3 | Numeric guards strong where present; one reproducible OOM DoS; overlap semantics inverted. |
| **Test Coverage & Verifiability** | 10% | 38 | 3.8 | 215 tests is real investment — but **8 are red**, and the failures are the integrity tests. Core protocols untested. |
| **TOTAL** | 100% | | **56 / 100** | |

### 8.1 Interpretation

**56/100 — Category: VIABLE ASSET, MISREPRESENTED MATURITY.**

Scoring is deliberately weighted toward data integrity because in this product category a lost show file is the failure mode that ends customer relationships. Chronos V3 scores 28 there, and that single dimension costs it roughly 19 points against an otherwise respectable profile. **Absent the §3 findings, this module scores approximately 76 — a genuinely strong asset.** The gap between 56 and 76 is the price of unfinished validation work, and it is recoverable within a quarter.

What the score does *not* capture, and what the committee should weigh separately: the LTC decoder, the verified FFT, the hardened PLL, and the Phantom-process memory architecture represent specialist knowledge that is scarce and slow to rebuild. A team can be hired to write validation guards in a month. A team that knows to check `isFinite` *before* `Math.min/max` because `Infinity` survives clamping, or that a reverse LTC sync word is `0xBFFC`, is materially harder to assemble.

**Recommendation to the Board: PROCEED as a repriced asset purchase**, with the four CRITICAL items as conditions precedent, 25–30% escrow against the acceptance criteria in §1.4, an independent safety review commissioned in parallel (§7.3), and retention packages for the original protocol/DSP authors. **Do not pay a "production-ready" multiple.** The vendor's documentation describes a shipped product; the test output describes a late-stage prototype. Price the prototype.

---

## 9. COMPETITIVE EVALUATION vs. GrandMA3 AND MARKET ALTERNATIVES

### 9.1 Positioning

| | **Chronos V3** | **GrandMA3** | **Chamsys MagicQ** | **Resolume Arena** | **Ableton + DMX** |
|---|---|---|---|---|---|
| Platform | Electron / Web | Native C++ + HW | Native C++ | Native C++ | Native C++ |
| Timeline model | Clip-based, semantic zones | Cue-list + Timecode Pool | Cue stack + TC | Native NLE | Session/Arrangement |
| Timecode in | LTC, MTC, Art-Net, MIDI Clock | LTC, MTC, Art-Net, SMPTE, PSN | LTC, MTC, Art-Net | LTC, MTC, Ableton Link | Link, MTC |
| **Song Position Ptr** | ❌ **Absent** | ✅ | ✅ | ✅ | ✅ |
| **MTC frame accuracy** | ❌ **~2 frames late** | ✅ Frame-accurate | ✅ | ✅ | ✅ |
| Audio-reactive DSP | ✅ **7-band FFT, offline analysis** | ⚠️ Minimal | ⚠️ Minimal | ✅ Strong | ✅ Strong |
| Semantic "Energy Zones" | ✅ **Differentiator** | ❌ | ❌ | ❌ | ❌ |
| Show-file durability | ❌ **Broken round-trip** | ✅ Multi-gen backup | ✅ | ✅ | ✅ |
| Format migration | ❌ **None** | ✅ Multi-version | ✅ | ✅ | ✅ |
| Real-time determinism | ⚠️ RAF / GC-exposed | ✅ Hard RT | ✅ | ✅ | ✅ |
| Hardware ecosystem | ❌ None | ✅ Extensive | ✅ | ⚠️ | ⚠️ |
| Approx. entry cost | — | €€€€ | € / free viz | €€ | €€ |

### 9.2 Where Chronos Genuinely Leads

**Audio intelligence is the defensible asset.** GrandMA3 is a peerless *cue execution* platform, but it is fundamentally reactive to an operator or a timecode stream. It has no meaningful concept of musical content. Chronos ships a real offline FFT pipeline — seven tactical bands, spectral centroid and flatness, transient detection, beat grid, section segmentation — persisted directly into the show file (`LuxAnalysisV3`).

The **semantic Energy Zone** model (`silence → valley → ambient → gentle → active → intense → peak`) as a first-class routing target has no equivalent in any product in the comparison set. An operator assigning a track to `peak` rather than to a fixture group is expressing musical intent, and the engine resolves it against analysed content. **This is the acquisition thesis.** For AlphaTheta specifically — a DJ-equipment company — a lighting engine that reasons natively about musical structure is strategically aligned in a way that a conventional console is not.

Secondary genuine advantages: the Phantom-process decode architecture handles very large files without renderer pressure (a real pain point in web-stack tools), and the `.lux` V3 schema — its current validation defects notwithstanding — is a more modern, more self-describing format than the binary show files of incumbents, with a fully embedded `.lfx` V3 automation payload making projects genuinely self-contained.

### 9.3 Where Chronos Cannot Currently Compete

**1. Show-file durability.** GrandMA3 maintains multiple generations of show backups because the industry learned this lesson the hard way. Chronos currently cannot reliably reopen a file it just wrote (§3.2) and can be hard-locked by a malformed one (§6.1). Until B-1 through B-5 are closed, it is not deployable on any show where the file matters — which is every show.

**2. Timecode conformance.** The ~2-frame MTC error (§4.2) and absent SPP (§4.3) mean Chronos cannot be trusted as a slave in a professional multi-device rig. The moment it runs alongside a GrandMA3 on a shared MTC feed, the offset is visible. In this market, "close" is a synonym for "broken."

**3. Real-time determinism.** This is the structural constraint that no amount of remediation fully removes. GrandMA3 runs deterministic native code on dedicated hardware. Chronos runs JavaScript on RAF in Electron, subject to GC pauses, compositor scheduling, and OS contention. The §5 defects make this worse than it needs to be — and they are fixable — but even a perfectly optimized Electron renderer cannot offer hard real-time guarantees. **Chronos should not be positioned against GrandMA3 for arena-scale timecode-critical work.** It should be positioned where its audio intelligence dominates and hard determinism is not required: clubs, mid-size touring, DJ-integrated installations, and pre-visualization.

**4. Ecosystem.** Incumbents ship consoles, wings, nodes, training, certification, and a global rental inventory. Chronos is software with no hardware story. Under AlphaTheta this is precisely the gap an acquirer closes — which is an argument *for* the deal, provided it is priced as a component rather than a platform.

### 9.4 Strategic Read

Chronos V3 is not a GrandMA3 competitor and should not be valued as one. **It is a differentiated audio-intelligence layer that would be expensive for any incumbent to build from scratch, attached to a persistence layer that is currently unfit for production.**

The persistence layer is fixable on a one-quarter horizon by a small team. The audio-intelligence layer — the verified FFT, the seven-band tactical analysis, the Energy Zone semantic model, the Phantom isolation architecture — represents the genuinely scarce work, and it is substantially complete and correct.

**Buy the DSP and the semantic model. Discount the persistence layer to its remediation cost. Retain the engineers who wrote the protocol stack.** Position the product where musical intelligence is the differentiator, not where deterministic timecode execution is the requirement.

---

**Prepared by:** Office of the CTO — Technical Due Diligence
**Basis:** Static analysis of 63 modules (~25,400 LOC); execution of the vendor test suite (215 tests, 8 failing); targeted runtime reproduction of findings §3.2, §3.3, §6.1 and edge cases #1–#3, #15.
**Reliance:** Findings are cited to file and line at the audited commit. Claims that could not be verified were discarded and are listed in §7.4. This report is prepared for the Deal Committee and is not a warranty of fitness for any purpose.

**— END OF REPORT —**
