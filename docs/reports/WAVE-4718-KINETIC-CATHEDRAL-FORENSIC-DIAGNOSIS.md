// ── 4b. GATE L2-SUPREMACY
if (aetherKineticEngine.hasNode(node.nodeId)) {
  return   // ← nodo bajo control manual: skip L0 total
}# WAVE 4718 - DIAGNOSTIC REPORT: KINETIC CATHEDRAL AND L2 ROUTING

**Status:** 🔴 FORENSIC ONLY
**Mode:** Read-only diagnosis, no code corrections included
**Prepared for:** Arquitecto del sistema
**Date:** 2026-05-11
**Scope:** Kinetic Cathedral, L0/L2 routing, manual radar, pattern arbitration, scalar propagation

---

## Executive Summary

The three reported symptoms share one structural truth: the current kinetic stack does not have a single authoritative control surface. L0 procedural motion, L2 manual radar, and the VMM choreography path are all active at the same time, and the system combines them instead of isolating them.

### Symptoms analyzed

1. Radar moves all fixtures, not only the selected ones.
2. Manual pattern is ignored in favor of AI / Choreo L0 motion.
3. Speed, Amplitude, and Fan sliders appear to do nothing.

### Root cause summary

- `KineticsBridge` flushes kinetic state from the current selection, but its subscription is driven by movement fields, not by selection changes. When selection changes without a kinetic field change, the bridge does not resend the engine configuration. See [KineticsBridge.ts](../electron-app/src/bridges/KineticsBridge.ts#L141) and [KineticsBridge.ts](../electron-app/src/bridges/KineticsBridge.ts#L346).
- `AetherKineticEngine` writes `pan_base` / `tilt_base` into L2 for the node list it already holds, and the engine anchors itself from the previous L2 manual override. That means the engine can keep writing to stale fixture sets and can also contaminate its own anchor frame to frame. See [AetherKineticEngine.ts](../electron-app/src/core/aether/AetherKineticEngine.ts#L242) and [AetherKineticEngine.ts](../electron-app/src/core/aether/AetherKineticEngine.ts#L379).
- `vibeMovementManager.setManualPattern(null)` does not silence L0. It only clears the manual override flag and returns control to the AI choreography path. The VMM still computes a pattern through `selectPattern()`, which falls through to the vibe pattern list and returns the active procedural pattern such as `figure8`. See [VibeMovementManager.ts](../electron-app/src/engine/movement/VibeMovementManager.ts#L649) and [VibeMovementManager.ts](../electron-app/src/engine/movement/VibeMovementManager.ts#L1024).
- The L0 kinetic adapter processes every KINETIC node in the graph, without selection filtering. See [KineticAdapter.ts](../electron-app/src/core/aether/adapters/KineticAdapter.ts#L164).
- `updateKineticScalars` only updates the native kinetic engine. It does not suppress the L0 VMM path, so the visible effect is easily dominated by the procedural pattern. See [AetherIPCHandlers.ts](../electron-app/src/core/aether/AetherIPCHandlers.ts#L379).
- The arbiter does additive orbit math: `pan_base` is combined with the current L0 `pan` value. That means L2 and L0 are not mutually exclusive. See [NodeArbiter.ts](../electron-app/src/core/aether/NodeArbiter.ts#L332).

---

## Architecture Trace

```text
UI selection / programmer controls
  -> KineticsBridge
  -> ipcMain handlers
  -> AetherKineticEngine / NodeArbiter L2
  -> TitanOrchestrator kinetic adapter
  -> VibeMovementManager generateIntent()
  -> KineticAdapter emits L0 pan / tilt for every KINETIC node
  -> NodeArbiter combines L0 + L2
```

The important observation is that L0 is not a passive background layer. It is an active motion generator. When L2 writes a manual radar, L0 continues to perturb the final output. When the AI pattern is left active, the result is not override, but addition.

---

## Symptom 1: Radar moves all fixtures

### Diagnosis

This is a stale-target and stale-anchor problem at the same time.

`KineticsBridge` only resends the pattern payload when the subscribed movement fields change. The pattern subscription is watching `activePattern`, `patternSpeed`, `patternAmplitude`, and `fanValue`, but not the selection state itself. The bridge captures `selectedIds` only when a flush happens. If the operator changes selection while keeping the same pattern and sliders, the bridge does not automatically resynchronize the kinetic engine with the new selection. See [KineticsBridge.ts](../electron-app/src/bridges/KineticsBridge.ts#L141) and [KineticsBridge.ts](../electron-app/src/bridges/KineticsBridge.ts#L352).

`AetherKineticEngine.tick()` then keeps iterating its own configured `nodeIds`. Those IDs are whatever the last `setManualKinetics()` call stored. If the list is stale, the radar is effectively still written to the previous fixtures. See [AetherKineticEngine.ts](../electron-app/src/core/aether/AetherKineticEngine.ts#L242) and [AetherKineticEngine.ts](../electron-app/src/core/aether/AetherKineticEngine.ts#L379).

The second layer of the bug is that the engine reads its own previous L2 values as the anchor. The code explicitly pulls the current `pan_base` / `tilt_base` from the arbiter before computing the next frame. That means the engine is not anchoring from an immutable external base; it is anchoring from the last override state. The anchor therefore drifts if the output is not perfectly centered. See [AetherKineticEngine.ts](../electron-app/src/core/aether/AetherKineticEngine.ts#L379).

### Forensic conclusion

The radar is not truly “moving all fixtures” by itself. The actual failure is that the selected subset and the engine’s active node list are allowed to diverge, and the engine writes a self-referential anchor that preserves and amplifies the drift.

---

## Symptom 2: Manual pattern is ignored

### Diagnosis

The backend assumes that clearing the manual pattern means clearing the L0 motion source. That assumption is false.

`AetherIPCHandlers` calls `vibeMovementManager.setManualPattern(null)` before routing the manual kinetic packet. The handler treats that call as a silence mechanism for the VMM. See [AetherIPCHandlers.ts](../electron-app/src/core/aether/AetherIPCHandlers.ts#L379).

But `setManualPattern(null)` only clears the manual override field. It explicitly returns control to AI / Selene mode. The VMM does not stop producing a pattern; it simply stops forcing a hand-picked one. See [VibeMovementManager.ts](../electron-app/src/engine/movement/VibeMovementManager.ts#L649).

Then `selectPattern()` falls through to the configured pattern list for the active vibe. With `manualPatternOverride === null`, the function returns the vibe pattern sequence, such as `figure8` for `fiesta-latina`. See [VibeMovementManager.ts](../electron-app/src/engine/movement/VibeMovementManager.ts#L1024).

The kinetic adapter then emits L0 motion for every KINETIC node in the graph. There is no selection gate in that adapter. Its hot path iterates all nodes and calls `generateIntent()` per node. See [KineticAdapter.ts](../electron-app/src/core/aether/adapters/KineticAdapter.ts#L164).

The arbiter does not replace L0 with L2. It blends them. The L0 `pan` is added to the manual `pan_base` orbit. That means the visible result can be dominated by the AI pattern even when the manual pattern is technically active at L2. See [NodeArbiter.ts](../electron-app/src/core/aether/NodeArbiter.ts#L332).

### Forensic conclusion

The system is not ignoring the manual pattern in the strict sense. The manual pattern is being superimposed on top of an active L0 choreography source that was never actually disabled.

---

## Symptom 3: Speed, Amplitude, and Fan do nothing

### Diagnosis

The scalars are being written, but the visible result is masked by the active L0 choreography path.

`updateKineticScalars` does reach the native engine and updates the scalar values without resetting phase. That part is functioning as designed. See [AetherIPCHandlers.ts](../electron-app/src/core/aether/AetherIPCHandlers.ts#L379) and [AetherKineticEngine.ts](../electron-app/src/core/aether/AetherKineticEngine.ts#L292).

However, the native engine is only one part of the final motion stack. The VMM L0 adapter is still generating its own full-pattern pan / tilt output. Because the arbiter adds L0 motion to the L2 base, changes in engine speed or amplitude can become visually insignificant compared with the pattern emitted by the VMM. See [KineticAdapter.ts](../electron-app/src/core/aether/adapters/KineticAdapter.ts#L164) and [NodeArbiter.ts](../electron-app/src/core/aether/NodeArbiter.ts#L332).

The fan slider has the same problem at a different layer. The adapter applies phase offsets per node, while the native engine also maintains its own fan logic. That produces two independent fan domains, which the operator sees as either duplication or no clear response at all.

### Forensic conclusion

The sliders are not dead. They are routed into a kinetic subsystem that is no longer the only authority over motion, so their effect is diluted by a concurrent procedural path.

---

## Evidence Map

| Finding | Source | Exact signal |
|---|---|---|
| Pattern flush watches movement state, not selection | [KineticsBridge.ts](../electron-app/src/bridges/KineticsBridge.ts#L141) | Subscription is driven by `activePattern`, `patternSpeed`, `patternAmplitude`, `fanValue` |
| Pattern flush uses current selection only at flush time | [KineticsBridge.ts](../electron-app/src/bridges/KineticsBridge.ts#L346) | `getSelectedIds()` is sampled only when `_flushPattern()` runs |
| Native engine stores node list and updates scalars | [AetherKineticEngine.ts](../electron-app/src/core/aether/AetherKineticEngine.ts#L242) | `setManualKinetics()` owns the engine configuration |
| Native engine reads prior manual override as anchor | [AetherKineticEngine.ts](../electron-app/src/core/aether/AetherKineticEngine.ts#L379) | `arbiter.getManualOverride(nodeId)` used as current anchor |
| IPC scalar update only touches native engine | [AetherIPCHandlers.ts](../electron-app/src/core/aether/AetherIPCHandlers.ts#L379) | `lux:aether:updateKineticScalars` updates the engine only |
| Manual pattern clear returns control to AI | [VibeMovementManager.ts](../electron-app/src/engine/movement/VibeMovementManager.ts#L649) | `setManualPattern(null)` clears override, not the whole L0 source |
| Pattern selection falls through to vibe list | [VibeMovementManager.ts](../electron-app/src/engine/movement/VibeMovementManager.ts#L1024) | `selectPattern()` returns the configured vibe pattern list |
| L0 adapter iterates all KINETIC nodes | [KineticAdapter.ts](../electron-app/src/core/aether/adapters/KineticAdapter.ts#L164) | no selection filter in the hot path |
| Arbiter adds orbit to L0 motion | [NodeArbiter.ts](../electron-app/src/core/aether/NodeArbiter.ts#L332) | `pan_base` and L0 `pan` are combined |

---

## Severity Assessment

### Critical

1. L0 is not silenced when manual pattern mode is engaged.
2. L2 and L0 are combined additively, not isolated.
3. Selection changes do not reliably rebind the native kinetic engine.

### Major

4. The engine uses its own prior override as a new anchor, which creates drift risk.
5. The UI can present scalar changes as inert because the active L0 pattern masks them.

### Structural

6. The kinetic architecture currently has more than one source of motion truth.
7. The operator does not have a clean contract between manual radar, procedural choreography, and native scalar control.

---

## Final Diagnosis

The three reported symptoms are not three independent bugs. They are three expressions of one architectural condition:

- L0 choreography remains active when L2 manual control is introduced.
- The arbiter blends L0 and L2 instead of enforcing a single authority.
- The bridge layer does not fully resynchronize the native engine when selection changes.

In practical terms:

- The radar appears to move all fixtures because the engine configuration becomes stale and because L0 continues to move every KINETIC node.
- The manual pattern appears ignored because `setManualPattern(null)` returns the system to AI choreography rather than disabling it.
- The scalar sliders appear inert because their effect is real but visually overwhelmed by the concurrent L0 path.

This document is strictly diagnostic. No remediation steps are included.
