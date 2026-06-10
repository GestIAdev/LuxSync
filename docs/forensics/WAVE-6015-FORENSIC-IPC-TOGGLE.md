# 🔬 FORENSIC AUDIT — IPC Ghosts & DMX Toggle Chain

**Wave:** 6015  
**Date:** 2026-06-09  
**Auditor:** Forensic Engine (Read-Only)  
**Targets:** IPC broadcast pipeline, DMX output toggle chain  
**Status:** ✅ Complete

---

## Executive Summary

Two findings:

1. **IPC spam persists** because `main.ts:606-675` sends BOTH `selene:truth` AND `lux:state-update` from the same callback at ~7Hz. The `BroadcastManager` class (extracted in WAVE 4961) is **dead code** — never instantiated. The actual broadcast logic remains inline in `TickEngine.tick()`.

2. **The DMX output toggle chain IS electrically connected** — `AetherIPCHandlers` → `TitanOrchestrator.setOutputEnabled()` → `TickEngine` reads `_outputEnabled` each frame → `AetherSafetyMiddleware`. However, `TitanOrchestrator.setOutputEnabled()` at line 1030-1033 **only mutates the variable** — it does NOT force a resync or invalidate any cached state in `AetherSafetyMiddleware` or `NodeResolver`. The safety middleware reads the value on the next frame via `TickEngine.tick()`, so there is a **1-frame latency** but no broken chain.

---

## 🔍 TARGET 1: IPC Ghosts — The Dual-Channel Storm

### The Callback Registration (`main.ts`)

**`electron/main.ts:606-675`** — `setBroadcastCallback` sends TWO IPC messages from ONE callback:

```typescript
titanOrchestrator.setBroadcastCallback((truth) => {
    // ...
    mainWindow.webContents.send('selene:truth', truth)       // line 610
    // ...
    const stateUpdate = { /* projection from truth */ }
    mainWindow.webContents.send('lux:state-update', stateUpdate)  // line 669
})
```

**`electron/main.ts:680-689`** — `setHotFrameCallback` sends a third channel:

```typescript
titanOrchestrator.setHotFrameCallback((hotFrame) => {
    mainWindow.webContents.send('selene:hot-frame', hotFrame)  // line 684
})
```

### Where Callbacks Are Stored (`TitanOrchestrator.ts`)

**`TitanOrchestrator.ts:529`** — Raw callback field:
```typescript
private onBroadcast: ((truth: any) => void) | null = null
```

**`TitanOrchestrator.ts:535`** — Hot-frame callback field:
```typescript
private onHotFrame: ((hotFrame: any) => void) | null = null
```

**`TitanOrchestrator.ts:945-947`** — Setter stores directly (NOT delegating to `TacticalLogManager`):
```typescript
setBroadcastCallback(callback: (truth: any) => void): void {
    this.onBroadcast = callback
}
```

**`TitanOrchestrator.ts:955-957`** — Same pattern for hot-frame:
```typescript
setHotFrameCallback(callback: (hotFrame: any) => void): void {
    this.onHotFrame = callback
}
```

### Where Callbacks Are Invoked (`TickEngine.ts`)

**`TickEngine.ts:1022`** — `emitHotFrame()` is called every tick (44Hz):
```typescript
this._aetherUIProjector.project(fixtureStates, ...)
emitHotFrame()   // <-- local lambda, NOT BroadcastManager.emitHotFrame
```

**`TickEngine.ts:1159`** — Full truth broadcast at ~7Hz:
```typescript
if (this.onBroadcast && shouldBroadcastFullTruth) {
    // Build SeleneTruth inline (lines 1160-1390+) ...
    this.onBroadcast(truth)  // triggers main.ts callback → dual IPC send
}
```

### 🚨 Critical Discovery: `BroadcastManager` is Dead Code

`BroadcastManager.ts` was extracted in WAVE 4961 with `emitHotFrame()` and `emitFullTruth()` methods, but:

- **`grep_search` for `new BroadcastManager` across the entire `src/` tree returns ZERO results**
- The class is never instantiated
- `TickEngine` does NOT use it — all broadcast logic remains inline in `TickEngine.tick()`
- `BroadcastManager` reads callbacks from `TacticalLogManager` (lines 80, 140), but `TitanOrchestrator` stores callbacks directly on `this.onBroadcast`/`this.onHotFrame` — NOT in `TacticalLogManager`

**Result:** Two parallel callback storage systems exist, and the one actually wired (`TitanOrchestrator.onBroadcast`) is the one that fires the dual IPC.

### IPC Message Rate Summary

| Channel | Frequency | Payload | Subscribed by |
|---------|-----------|---------|---------------|
| `selene:truth` | ~7Hz | Full SeleneTruth (large) | `useSeleneTruth.ts` |
| `lux:state-update` | ~7Hz | Projected SeleneStateUpdate | `TrinityProvider.tsx` |
| `selene:hot-frame` | 44Hz | Fixture dynamic data | `useSeleneTruth.ts` |

**Total: ~58 IPC messages/sec to the renderer.**

---

## 🔍 TARGET 2: The DMX Toggle Chain — Connected but Fragile

### Step 1: IPC Handler (`AetherIPCHandlers.ts`)

**`AetherIPCHandlers.ts:297-309`** — Listens for `lux:aether:setOutputEnabled`:

```typescript
ipcMain.handle(
    'lux:aether:setOutputEnabled',
    (_event, { enabled }: { enabled: boolean }) => {
        const orchestrator = getTitanOrchestrator()
        orchestrator.setOutputEnabled(!!enabled)
        return { success: true, outputEnabled: orchestrator.isOutputEnabled() }
    }
)
```

✅ Handler exists and calls `setOutputEnabled`.

### Step 2: Orchestrator Setter (`TitanOrchestrator.ts`)

**`TitanOrchestrator.ts:1030-1033`** — Mutates the canonical variable:

```typescript
setOutputEnabled(enabled: boolean): void {
    const nextEnabled = !!enabled
    this._outputEnabled = nextEnabled
}
```

⚠️ **Only sets the variable.** Does NOT call `aetherSafety.setOutputEnabled()`, does NOT invalidate any cache, does NOT force a frame.

### Step 3: Tick Engine Reads Each Frame (`TickEngine.ts`)

**`TickEngine.ts:980`** — Reads `_outputEnabled` and pushes to safety middleware:

```typescript
aetherSafety.setOutputEnabled(this._outputEnabled)
```

This happens **every frame** (44Hz). So the safety middleware gets the updated value on the **next tick** after `setOutputEnabled()` is called.

### Step 4: Safety Middleware Applies Gate (`AetherSafetyMiddleware.ts`)

**`AetherSafetyMiddleware.ts:71`** — Internal state:
```typescript
private _outputEnabled = true
```

**`AetherSafetyMiddleware.ts:127`** — Setter:
```typescript
setOutputEnabled(enabled: boolean): void { this._outputEnabled = enabled }
```

**`AetherSafetyMiddleware.ts:151-166`** — Gate logic:
```typescript
applyOutputGate(arbitrated: Map<NodeId, Record<string, number>>): void {
    if (this._outputEnabled) return    // ← EARLY EXIT when enabled (gate OPEN)
    // ... blocks non-manual nodes ...
}
```

### Step 5: Post-Resolution Egress (`TickEngine.ts`)

**`TickEngine.ts:1058-1059`** — Also reads `_outputEnabled` for HAL:
```typescript
const outputEnabled = this._outputEnabled
this.hal.setAetherOutputGateState(outputEnabled, blackoutActive)
```

### Chain Integrity Assessment

| Link | Status | Notes |
|------|--------|-------|
| UI → IPC | ✅ | `lux:aether:setOutputEnabled` handler registered |
| IPC → Orchestrator | ✅ | `setOutputEnabled(!!enabled)` called |
| Orchestrator setter | ⚠️ | Only mutates `this._outputEnabled`, no side effects |
| Orchestrator → TickEngine | ✅ | `this._outputEnabled` read every frame via context getter |
| TickEngine → Safety | ✅ | `aetherSafety.setOutputEnabled(this._outputEnabled)` at line 980 |
| Safety gate | ✅ | `applyOutputGate` early-returns when enabled |
| TickEngine → HAL | ✅ | `hal.setAetherOutputGateState(outputEnabled, ...)` at line 1059 |

**The chain is electrically complete.** If the toggle doesn't work, the break is likely in the **frontend** — either:
- The UI button is not calling `window.lux.aether.setOutputEnabled()`
- The preload API is not exposing `lux:aether:setOutputEnabled`
- The `CommandDeck.tsx` button is wired to `controlStore.setOutputEnabled()` (frontend-only Zustand) instead of the IPC call

---

## 🎯 Exact Lines of Interest

| File | Line(s) | Finding |
|------|---------|---------|
| `electron/main.ts` | 606-675 | Dual IPC send: `selene:truth` + `lux:state-update` from same callback |
| `electron/main.ts` | 610 | `webContents.send('selene:truth', truth)` |
| `electron/main.ts` | 669 | `webContents.send('lux:state-update', stateUpdate)` |
| `electron/main.ts` | 680-689 | `setHotFrameCallback` → `selene:hot-frame` at 44Hz |
| `TitanOrchestrator.ts` | 529 | `private onBroadcast` — raw callback field |
| `TitanOrchestrator.ts` | 535 | `private onHotFrame` — raw callback field |
| `TitanOrchestrator.ts` | 945-947 | `setBroadcastCallback` — stores directly, NOT via TacticalLogManager |
| `TitanOrchestrator.ts` | 955-957 | `setHotFrameCallback` — same pattern |
| `TickEngine.ts` | 1022 | `emitHotFrame()` — local lambda, called every tick |
| `TickEngine.ts` | 1159 | `this.onBroadcast` check + inline truth build |
| `BroadcastManager.ts` | 1-315 | **DEAD CODE** — never instantiated (`new BroadcastManager` returns 0 results) |
| `AetherIPCHandlers.ts` | 297-309 | IPC handler `lux:aether:setOutputEnabled` |
| `TitanOrchestrator.ts` | 1030-1033 | `setOutputEnabled` — only mutates variable |
| `TitanOrchestrator.ts` | 556-557 | `private _outputEnabled = true` — starts open |
| `TickEngine.ts` | 980 | `aetherSafety.setOutputEnabled(this._outputEnabled)` — per-frame sync |
| `AetherSafetyMiddleware.ts` | 71 | `private _outputEnabled = true` — starts open |
| `AetherSafetyMiddleware.ts` | 127 | `setOutputEnabled(enabled)` — simple setter |
| `AetherSafetyMiddleware.ts` | 151-166 | `applyOutputGate` — early return when enabled |
| `TickEngine.ts` | 1058-1059 | `hal.setAetherOutputGateState(outputEnabled, ...)` — HAL gate |

---

## 📋 Summary

| Question | Answer |
|----------|--------|
| **Why is IPC still spamming?** | `main.ts:606-675` sends `selene:truth` + `lux:state-update` from same callback. `BroadcastManager` is dead code — the inline logic in `TickEngine` was never migrated. |
| **Is the DMX toggle chain broken?** | **No.** The backend chain is complete from IPC → Orchestrator → TickEngine → Safety → HAL. If the toggle doesn't work, investigate the frontend button wiring. |
| **Where should the fix go?** | Remove `lux:state-update` send from `main.ts:616-669`. The `selene:truth` channel already carries all data. Wire `BroadcastManager` into `TickEngine` or delete it. |
