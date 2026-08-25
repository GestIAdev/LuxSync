I'll investigate the three files mentioned in the directive to locate the bugs.

The paths in the directive don't match the actual codebase. Let me locate the real files and search for the actual buggy code.

Let me verify the actual state of bug 2 more thoroughly, since the code at the `lux-blackout` case already looks clean.

Before making changes, I need to verify the premise of bug 3 — that `setManualOverrides`, `setManualPattern`, and `updateKineticScalars` are actually `send` (fire-and-forget) in the preload. The directive's bug 2 description didn't match reality, so I must verify.

Confirmed: all three kinetic IPC methods use `ipcRenderer.send` (return `void`), so the `await`/`try-catch` in KineticsBridge are dead code. Now let me verify the backend handler for `lux:aether:setBlackout` to confirm bug 1's fix is safe, and double-check bug 2's actual state.

Important finding. Let me verify there are no `await` callers of these private methods, and confirm bug 2's state definitively.

I have a complete picture now. Summary of findings:

- **Bug 1 (preload.ts:1199): REAL** — `arbiter.setBlackout` uses `ipcRenderer.invoke`, but the backend source handler (`AetherIPCHandlers.ts:342`) is `ipcMain.on`, so `invoke` hangs. The sibling `aether.setBlackout` at line 1529 already uses `send`. Fix needed.
- **Bug 2 (useMidiLearn.ts): ALREADY FIXED** — the `lux-blackout` case calls `fireBlackoutToggleMidi()` (lines 99-106), which is already clean fire-and-forget with no `.then()/.catch()`. No bug exists in the source.
- **Bug 3 (KineticsBridge.ts): REAL** — all three kinetic IPC methods are `ipcRenderer.send` (returns `void`) in the preload, but `_flushClassic`/`_flushPattern` still `await` them inside `try/catch`. Dead code. Fix needed.

Let me apply the two real fixes.

Let me verify the edits and check for a typecheck command.

Edits look correct. Let me run a typecheck to verify nothing broke.

preload.ts typechecks clean. Now the renderer side (covers `KineticsBridge.ts`).

The only 2 type errors are in `useMidiLearn.ts` about `fireTungsten` (lines 338, 341) — a name I never touched and a file I did not edit, so they're pre-existing and unrelated to this directive. Let me confirm my changes are isolated via git.

Verified. The `fireTungsten` errors are pre-existing in the working tree (introduced by the previous AI's `useMidiLearn.ts` edits, a file I did not touch) — they don't appear on clean HEAD and are outside this directive's scope. My two changes typecheck clean.

## Summary

I verified the actual codebase against the directive. The directive's descriptions were partially inaccurate, so I checked the real state of each location before touching anything.

### Bug 1 — `electron-app/electron/preload.ts:1199` ✅ Fixed (real bug)

The `arbiter.setBlackout` wrapper used `ipcRenderer.invoke`, but the backend source handler is `ipcMain.on('lux:aether:setBlackout', ...)` (`AetherIPCHandlers.ts:342`), so `invoke` would hang waiting for a reply that never comes. The sibling `aether.setBlackout` at line 1529 already used `send`.

```ts
    /** Set blackout state — WAVE 4633-OMEGA: redirigido a lux:aether:setBlackout (fuente de verdad única) */
    setBlackout: (active: boolean) => ipcRenderer.send('lux:aether:setBlackout', { active }),
```

Note: this is an expression-body arrow function, so there was no explicit `return` statement to remove — changing `invoke` → `send` makes it return `void` as intended.

### Bug 2 — `src/hooks/useMidiLearn.ts` ⚠️ Already fixed (no bug exists)

The directive claims the `lux-blackout` case chains `.then()/.catch()` on `window.lux.aether.setBlackout(...)`. The actual source does **not** have this bug. The case (lines 435-443) calls `fireBlackoutToggleMidi()`, which is already clean fire-and-forget:

```ts
function fireBlackoutToggleMidi(): void {
  const currentBlackout = useEffectsStore.getState().blackout
  const targetState = !currentBlackout
  // Optimistic update — immediate visual feedback (selene:truth confirms @7Hz)
  useEffectsStore.getState().setBlackout(targetState)
  // Fire-and-forget — throttled 25ms, no .then(), no .catch()
  throttledSetBlackout(targetState)
}
```

A grep for `\.then\(|\.catch\(` across the file returns zero matches (only a comment). I made no change here, since there was nothing to fix. The directive's line numbers/description don't match the current source — likely the previous AI already applied this fix before timing out.

### Bug 3 — `src/bridges/KineticsBridge.ts` ✅ Fixed (real bug)

Confirmed in preload that `setManualOverrides`, `setManualPattern`, and `updateKineticScalars` all use `ipcRenderer.send` (return `void`). The `await`/`try-catch` blocks were dead code. Both methods are only invoked via `setTimeout` callbacks (no `await` callers), so dropping `async`/`Promise<void>` is safe.

`_flushClassic` (channel B1):
```ts
  private _flushClassic(
    pan: number,
    tilt: number,
    fanValue: number,
  ): void {
    // ...payloads built unchanged...

    // 🩸 WAVE 6040-DIAG: trace radar classic flush
    console.log(`[ZOMBIE-DIAG] _flushClassic sending ${payloads.length} payloads:`, ...)

    window.lux?.aether?.setManualOverrides(payloads)
  }
```

`_flushPattern` (channels B2, B3):
```ts
  private _flushPattern(
    activePattern: string,
    patternSpeed: number,
    patternAmplitude: number,
    fanValue: number,
  ): void {
    // ...guards + cache check unchanged...

    if (samePatternAndFixtures) {
      // WAVE 4712: pasar fixtureIds para scope per-fixture en multitrack.
      // Sin nodeIds, el engine actualizaría TODAS sus pistas activas (bleed).
      window.lux?.aether?.updateKineticScalars({
        fixtureIds,
        speed: patternSpeed,
        amplitude: patternAmplitude,
        fan: fanValue,
      })
      return
    }

    // ...cache invalidation + logs unchanged...

    window.lux?.aether?.setManualPattern({
      fixtureIds,
      pattern: enginePattern,
      speed: patternSpeed,
      amplitude: patternAmplitude,
      fan: fanValue,        // [-100, 100] — el handler IPC normaliza a [0, 1]
      anchorPan:  undefined, // WAVE 4986: sin anchor tóxico — backend resuelve
      anchorTilt: undefined, // WAVE 4986: sin anchor tóxico — backend resuelve
    })
  }
```

### Verification
- `tsc -p tsconfig.node.json --noEmit` → clean (covers `preload.ts`).
- `tsc -p tsconfig.json --noEmit` → only 2 pre-existing errors in `useMidiLearn.ts:338,341` (`Cannot find name 'fireTungsten'`), introduced by the previous AI's uncommitted edits to that file, not by my changes. They're outside this directive's scope.
- Heads-up: `dist-electron-backend/` is stale — its `AetherIPCHandlers.js` still has `ipcMain.handle('lux:aether:setBlackout')` and the compiled `preload.js` still uses `invoke`. You'll want to rebuild the backend dist so the compiled output matches the refactored source.