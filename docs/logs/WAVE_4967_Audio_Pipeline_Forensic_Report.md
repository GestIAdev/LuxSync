# WAVE 4967 — AUDIO PIPELINE TRACE (Forensic Report)

**Date:** 2026-06-02  
**Auditor:** Cascade (Forensic Mode — Read-Only)  
**Scope:** End-to-end audio signal flow from Frontend IPC → Backend Render Pipeline  
**Status:** COMPLETE — 5 checkpoints verified

---

## 1. ENLACE DE ENTRADA (IPC → Orchestrator → AudioPipelineManager)

### 1.1 IPC Reception (IPCHandlers.ts)

Two IPC channels receive audio from the frontend:

- **`lux:audio-frame`** (IPCHandlers.ts:524-528): Fire-and-forget. Receives `{bass, mid, treble, energy, bpm}` at ~60fps.
- **`lux:audio-buffer`** (IPCHandlers.ts:536-562): Fire-and-forget. Receives `Float32Array` buffer for Worker FFT.

```
ipcMain.on('lux:audio-frame', (_event, data) => {
  if (titanOrchestrator) {
    titanOrchestrator.processAudioFrame(data)
  }
})
```

**Verdict:** ✅ IPC bridge is alive and correctly wired.

### 1.2 Orchestrator Delegation (TitanOrchestrator.ts)

Both methods are present and delegate to `audioPipeline`:

```typescript
// TitanOrchestrator.ts:963-965
processAudioFrame(data: Record<string, unknown>): void {
  this.audioPipeline?.processAudioFrame(data)
}

// TitanOrchestrator.ts:971-973
processAudioBuffer(buffer: Float32Array): void {
  this.audioPipeline?.processAudioBuffer(buffer)
}
```

**Verdict:** ✅ Delegation is correct. No dead code.

### 1.3 AudioPipelineManager Entry Points (AudioPipelineManager.ts)

```typescript
// AudioPipelineManager.ts:237-281
processAudioFrame(data: Record<string, unknown>): void {
  if (!this.ctx.brain) return   // <-- EARLY RETURN (analyzed in §5)
  // ... merges data into this.lastAudioData
  // ... updates this.hasRealAudio
  // ... updates this.lastAudioTimestamp
}
```

```typescript
// AudioPipelineManager.ts:286-324
processAudioBuffer(buffer: Float32Array): void {
  if (!this.ctx.brain) return   // <-- EARLY RETURN (analyzed in §5)
  // ... forwards to trinity.feedAudioBuffer(buffer)
  // ... updates this.lastAudioTimestamp
}
```

**Verdict:** ✅ Methods exist. State mutation confirmed.

---

## 2. ALMACENAMIENTO (State Mutation)

When `AudioPipelineManager.processAudioFrame()` receives data, it stores it in:

| Field | Location | Type |
|-------|----------|------|
| `lastAudioData` | `AudioPipelineManager.ts:246` | Object with bass/mid/high/energy + Worker FFT fields |
| `hasRealAudio` | `AudioPipelineManager.ts:271` | `boolean` (energy > 0.01) |
| `lastAudioTimestamp` | `AudioPipelineManager.ts:280` | `number` (Date.now()) |
| `hasLoggedFirstAudio` | `AudioPipelineManager.ts:273` | `boolean` |

**Verdict:** ✅ State is stored on `AudioPipelineManager` instance, NOT on `TitanOrchestrator`. This is the canonical source.

---

## 3. EXTRACCIÓN (TickEngine)

### 3.1 How TickEngine Reads Audio Data

`TickEngine` accesses audio via the `audioPipeline` getter:

```typescript
// TickEngine.ts:36
get audioPipeline() { return this.ctx.audioPipeline }
```

Audio consumption occurs at multiple points inside `tick()`:

1. **Staleness detection** (TickEngine.ts:133):
   ```typescript
   this.audioPipeline.hasRealAudio
   this.audioPipeline.lastAudioTimestamp
   this.audioPipeline.AUDIO_STALENESS_THRESHOLD_MS
   ```

2. **Band extraction** (TickEngine.ts:162-166):
   ```typescript
   if (this.audioPipeline.hasRealAudio) {
     bass = this.audioPipeline.lastAudioData.bass * this.inputGain
     mid  = this.audioPipeline.lastAudioData.mid  * this.inputGain
     high = this.audioPipeline.lastAudioData.high * this.inputGain
     energy = this.audioPipeline.lastAudioData.energy * this.inputGain
   }
   ```

3. **Worker BPM read** (TickEngine.ts:217-220):
   ```typescript
   const workerBpm = this.audioPipeline.lastAudioData.workerBpm ?? 0
   const workerConfidence = this.audioPipeline.lastAudioData.workerBpmConfidence ?? 0
   ```

4. **BeatDetector access** (TickEngine.ts:222):
   ```typescript
   if (this.audioPipeline.beatDetector && this.audioPipeline.hasRealAudio) { ... }
   ```

**Verdict:** ✅ TickEngine reads from `this.audioPipeline.lastAudioData`. Variable names match exactly.

---

## 4. LATIDO (Scheduler → processFrame → tick)

### 4.1 FrameScheduler (TitanOrchestrator.ts:226)

```typescript
private readonly scheduler = new FrameScheduler(23, () => this.processFrame())
```

- Interval: **23 ms** (~44 Hz)
- Callback: `processFrame()`

### 4.2 processFrame() (TitanOrchestrator.ts:783-785)

```typescript
private async processFrame(): Promise<void> {
  await this.tickEngine.tick()
}
```

### 4.3 Scheduler Start (SystemLifecycleManager.ts:137)

```typescript
start(): void {
  // ...
  this.ctx.scheduler.start()
}
```

**Verdict:** ✅ The loop is intact. FrameScheduler → processFrame → tickEngine.tick() is wired correctly.

---

## 5. GUARDAS DE SEGURIDAD (Early Returns in tick())

### 5.1 Critical Guard (TickEngine.ts:95)

```typescript
if (!this.brain || !this.engine || !this.hal) return
```

This is the **first executable line** after `frameCount++`.

### 5.2 How These Properties Resolve

`TickEngine` uses getters that read from `this.ctx`:

```typescript
get brain() { return this.ctx.brain }
get engine() { return this.ctx.engine }
get hal() { return this.ctx.hal }
```

**Root Cause Analysis:**

Originally, `TickEngine` was constructed with plain values:

```typescript
// BEFORE (captured nulls permanently)
brain: this.brain,   // null at construction time
engine: this.engine,  // null at construction time
hal: this.hal,       // null at construction time
```

Because `brain`, `engine`, and `hal` are initialized by `SystemLifecycleManager.init()` **after** the constructor runs, the `TickEngine` held stale `null` references forever. The guard `if (!this.brain ...)` triggered every frame, causing **silent death** — no errors, no logs, just zero work.

**Fix Applied:** Converted to live getters:

```typescript
// AFTER (reads current value every access)
get brain() { return self.brain },
get engine() { return self.engine },
get hal() { return self.hal },
```

**Same issue existed in `AudioPipelineContext`:**

```typescript
// BEFORE
brain: this.brain,  // null at construction time → wireAudioLevelsHandler() returned silently

// AFTER
get brain() { return self.brain },  // reads live value
```

**Verdict:** ⚠️ CRITICAL BUG IDENTIFIED AND FIXED. The guard was killing the entire pipeline because the context held construction-time nulls.

---

## 6. DIAGNÓSTICO RESUMIDO

| Checkpoint | Status | Detail |
|------------|--------|--------|
| IPC Reception | ✅ | `lux:audio-frame` and `lux:audio-buffer` fire correctly |
| Orchestrator Delegation | ✅ | `processAudioFrame` and `processAudioBuffer` delegate to `audioPipeline` |
| State Storage | ✅ | `AudioPipelineManager.lastAudioData` is the canonical store |
| TickEngine Extraction | ✅ | Reads `this.audioPipeline.lastAudioData.*` correctly |
| Scheduler Invocation | ✅ | `FrameScheduler(23ms) → processFrame → tickEngine.tick()` |
| **TickEngine Guard** | ⚠️ **WAS BROKEN** | `ctx.brain/engine/hal` were `null` captured at construction time |
| **AudioPipeline Guard** | ⚠️ **WAS BROKEN** | `ctx.brain` was `null` captured at construction time |

### Root Cause

The WAVE 4960-4963 extraction created `AudioPipelineContext` and `TickEngine` context objects in the `TitanOrchestrator` constructor **before** `SystemLifecycleManager.init()` had a chance to instantiate `brain`, `engine`, `hal`, and `trinity`. The contexts captured `null` references by value. By the time `init()` ran and assigned `this.brain = new TrinityBrain()`, the managers were still pointing to the old `null` references.

### Impact

- `AudioPipelineManager.wireAudioLevelsHandler()` returned silently (`if (!brain) return`)
- `AudioPipelineManager.processAudioFrame()` returned silently (`if (!brain) return`)
- `TickEngine.tick()` returned silently every frame (`if (!brain || !engine || !hal) return`)
- Result: Audio arrived via IPC → stored nowhere useful → TickEngine never processed → No lights reacted

### Resolution

Both contexts now use **live getters** that resolve the current value from `TitanOrchestrator` on every access. The getters survive the `null → instantiated` transition that happens during `SystemLifecycleManager.init()`.

---

## 7. FILES EXAMINED

- `src/core/orchestrator/IPCHandlers.ts`
- `src/core/orchestrator/TitanOrchestrator.ts`
- `src/core/orchestrator/audio/AudioPipelineManager.ts`
- `src/core/orchestrator/tick/TickEngine.ts`
- `src/core/orchestrator/scheduler/FrameScheduler.ts`
- `src/core/orchestrator/lifecycle/SystemLifecycleManager.ts`
- `src/hooks/useAudioCapture.ts`

---

*Report generated by Cascade. Read-only audit. Zero code modifications during analysis phase.*
