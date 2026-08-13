# AETHER MATRIX — ARCHITECTURAL DUE DILIGENCE, PART 1

**Scope:** `core/orchestrator/TitanOrchestrator.ts`, `core/orchestrator/tick/TickEngine.ts`, `core/aether/{capability-node,device,NodeGraph}.ts`, `core/aether/glass/*`, `core/aether/resolver/*`, Forge GraphNode surface.
**Method:** static read of production code paths. No runtime profiling was performed; all cost figures are derived analytically from allocation sites in the 44 Hz loop and are labelled as such.
**Verdict summary:** The *type-level* design is genuinely good. The *implementation of the egress path* violates the architecture's own stated dogma and will not hold 50 universes. The multicell/shared-channel claim is not supported by the data model. GraphNode is a design-time compiler UI, not a manual-control surface.

---

## 0. Executive Findings

| # | Finding | Severity | Location |
|---|---|---|---|
| F1 | 44 Hz egress path allocates ~13k objects/sec at 50 universes; violates stated zero-alloc dogma | **Critical** | `TickEngine.ts:1379-1399` |
| F2 | `BigInt` arithmetic inside the 44 Hz hot path | **Critical** | `TickEngine.ts:1386-1395`, `DmxSabHandlers.ts:48-49` |
| F3 | `dirtyMask` is computed, transported, and then ignored by the write path — the optimisation is decorative | **High** | `DmxSabHandlers.ts:30-49` |
| F4 | Two divergent, incompatible SAB writer implementations; the one in production is the untested one | **High** | `DmxSabHandlers.ts` vs `GlassMemory.ts` |
| F5 | `UNIVERSE_MASK` lo-word overflows `Int32Array` once universe ≥ 31 is patched | **High** | `DmxSabHandlers.ts:48` |
| F6 | Shared-channel invariant makes multicell governors/masters inexpressible | **High** | `capability-node.ts:69-70` |
| F7 | "Golden Nuke" hardcoded fixture hack in the universal egress loop — and it is dead code | **Medium** | `TickEngine.ts:1337-1351` |
| F8 | DMX Sniffer performs an O(fixtures) string scan 1.5×/sec and discards the result | **Medium** | `TickEngine.ts:1359-1375` |
| F9 | Governor evaluation is O(channels × governors) per device per frame, not offset-indexed | **Medium** | `DMXGovernorEvaluator.ts:62-64` |
| F10 | `readCoherent` returns a shared mutable scratch buffer and re-reads `FRAME_ID` outside the seqlock window | **Medium** | `DmxSabHandlers.ts:97-105` |
| F11 | `TickEngine` accesses ~50 dependencies through an untyped `ctx: any` god-object | **Medium** | `TickEngine.ts:36-122` |
| F12 | No arbitrated manual-control path; manual writes use a raw driver bypass that races the SAB | **High** | `IPCHandlers.ts:1784-1811` |

---

## 1. The Central Nervous System — TitanOrchestrator & TickEngine

### 1.1 Structure

`TitanOrchestrator` has been progressively decomposed (WAVE 4959–4964) into `StateManager`, `SystemLifecycleManager`, `VibeLifecycleManager`, `FixtureHydrationEngine`, `AudioPipelineManager`, `TickEngine`, etc. The decomposition is real — `TitanOrchestrator.ts` is down to ~1268 lines from a much larger monolith.

**But the decomposition is cosmetic at the seam.** `TickEngine` does not receive typed collaborators. It receives an untyped context bag:

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\tick\TickEngine.ts:36
  private ctx: any
```

followed by ~50 getters of the form `get _aetherResolver() { return this.ctx._aetherResolver }`. This is a god-object passed by reference with the type system switched off. Consequences:

- **No compile-time contract.** Renaming or removing any field on the orchestrator silently produces `undefined` in the tick loop rather than a build error. `tsc --noEmit` cannot protect this seam.
- **Every getter is a megamorphic property load** on a shape TurboFan cannot specialise, executed at 44 Hz.
- The "extraction" did not invert the dependency; it only moved the code. `TickEngine` is still structurally coupled to the full orchestrator surface.

This is the single biggest maintainability liability in the module. It is not a bottleneck in itself, but it removes all safety from the hottest code in the product.

### 1.2 The 44 Hz loop — GC pressure

Frame budget at 44 Hz is **22.7 ms**. The egress block is where the design breaks its own rules. The codebase repeats a dogma — `capability-node.ts:260` cites *"Principio 3: Zero-alloc frame path"*, `DMXGovernorEvaluator.ts:8` declares a *"CONTRATO ZERO-ALLOC"*, `TickEngine.ts:38` claims *"Pre-allocated mutable caches to eliminate .map() / {} / [] in hot path"*. The egress block violates all of it:

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\tick\TickEngine.ts:1378-1399
        // WAVE 6010 PATCH 2b: Egress SAB — escribir universo al writer en vez de HAL legacy
        const uniArr = new Uint8Array(CHANNELS_PER_UNI)
        uniArr.set(egressBuf.subarray(0, CHANNELS_PER_UNI))
        this._universeSnapshots.set(universe, uniArr)
      }

      // WAVE 6013 PATCH 2: commitFrame atómico al SAB con Universo 0 forzado
      const uniList: Uint8Array[] = []
      let dirtyMask = BigInt(0)

      const universesToProcess = new Set<number>(aetherResolver.registeredUniverses as number[])
      universesToProcess.add(0)

      for (const universe of universesToProcess) {
        const buf = this._universeSnapshots.get(universe)
        if (buf) {
          uniList[universe] = buf
          dirtyMask |= BigInt(1) << BigInt(universe)
        }
      }
      if (uniList.length > 0) {
        this.dmxWriter.commitFrame(this.frameCount, uniList, dirtyMask)
      }
```

Per-frame allocation inventory, at **U** universes:

| Site | Allocations/frame |
|---|---|
| `new Uint8Array(CHANNELS_PER_UNI)` | U (512 B each) |
| `egressBuf.subarray(...)` — view object | U |
| `BigInt(1)`, `BigInt(universe)`, `<<` result, `|=` result | ≈ 4U (heap-boxed) |
| `new Set<number>(...)` | 1 |
| `uniList: Uint8Array[] = []` | 1 |
| `commitFrame`: `BigInt(0xffffffff)`, `&`, `BigInt(32)`, `>>` | 4 |

At **U = 50**: ≈ **300 allocations/frame → ~13,200 allocations/sec**, and **50 × 512 B × 44 = 1.13 MB/s** of short-lived `Uint8Array` garbage in the young generation.

`this._universeSnapshots` is a persistent `Map<number, Uint8Array>` that *already holds a buffer per universe*. Allocating a fresh `Uint8Array` and overwriting the map entry every frame is pure waste — the correct form is allocate-on-first-sight then `existing.set(egressBuf)` in place. This is a ~5-line fix that eliminates the 1.13 MB/s entirely.

`BigInt` in a real-time loop is the more serious error. `BigInt` is an arbitrary-precision heap object; every operation allocates and cannot be escape-analysed away. `MAX_UNIVERSES = 50` fits in two `Int32`s — the mask should be two plain `number` accumulators (`maskLo`, `maskHi`), which is what the *other* implementation (`GlassMemory.ts`) already does correctly.

**Assessment:** this will not produce a hard failure at 50 universes, but it produces sustained young-gen churn that manifests as **scavenge-induced frame jitter**. For a 22.7 ms budget driving mechanical movers, non-deterministic multi-millisecond GC pauses are the failure mode that matters. The architecture does not *collapse* at 50 universes — it *stutters*, and stutter is the one artefact lighting operators cannot tolerate.

### 1.3 The dirty-mask is decorative

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\glass\DmxSabHandlers.ts:30-49
  public commitFrame(frameId: number, universes: Uint8Array[], dirtyMask: bigint): void {
    // 1. Iniciar escritura: incrementar SEQLOCK a impar
    Atomics.add(this.i32, DmxHdr.SEQLOCK, 1)

    // 2. Volcar datos binarios (zero-allocation)
    for (let u = 0; u < universes.length; u++) {
      const uBuf = universes[u]
      const offset = u * CHANNELS_PER_UNI
      if (uBuf) {
        this.u8.set(uBuf, offset)
      } else {
        // Rellenar con ceros si el universo no existe pero está en el loop
        this.u8.fill(0, offset, offset + CHANNELS_PER_UNI)
      }
    }

    // 3. Actualizar metadata del header
    this.i32[DmxHdr.FRAME_ID] = frameId
    this.i32[DmxHdr.UNIVERSE_MASK] = Number(dirtyMask & BigInt(0xffffffff))
    this.i32[DmxHdr.UNIVERSE_MASK_HI] = Number(dirtyMask >> BigInt(32))
```

Three defects in nineteen lines:

1. **`dirtyMask` never gates the data write.** The loop unconditionally writes or zero-fills every slot from `0` to `universes.length`. The mask is written to the header purely as metadata. Any consumer that trusts `UNIVERSE_MASK` to mean "changed this frame" is misled: `TickEngine` sets the bit for every universe *present in the snapshot map*, not every universe that actually changed value. Nothing in the pipeline performs change detection.

2. **Sparse holes are actively zeroed.** `uniList[universe] = buf` produces a sparse array. If universes `0` and `49` are patched, `universes.length === 50` and slots `1..48` are `undefined` → `fill(0, ...)`. Every frame the writer stamps 24.5 KB of zeros over universes it knows nothing about. Any future coexistence with a second producer writing the same SAB is impossible.

3. **`UNIVERSE_MASK` overflows `Int32`.** `dirtyMask & 0xffffffff` yields up to `4294967295`; `Int32Array` saturates/wraps that to a negative value. Once a show patches universe ≥ 31, bit 31 is set and `peekHeader().maskLo` returns a negative number. Bitwise consumers survive; any consumer treating it as a count or logging it does not. Given the module's own 50-universe claim, this bug is inside the advertised operating range.

Net effect: the SAB write is a fixed **25,600 B/frame = 1.13 MB/s** memcpy regardless of activity, and each reader performs a matching full-buffer copy (`DmxSabHandlers.ts:97`, `this.scratch.set(this.u8)`). For a 2-universe show that is ~25× more bus traffic than required.

### 1.4 Two divergent SAB implementations

There are two independent, API-incompatible writers over the same buffer:

- `core/aether/glass/DmxSabHandlers.ts` — `commitFrame(frameId, universes, dirtyMask: bigint)`, `readCoherent(lastFrameId)`. **This is what `TickEngine` imports** (`TickEngine.ts:15`).
- `core/aether/glass/GlassMemory.ts` — `commitFrame(frameId, universes, timestamp: number)`, plus `peekSeqlock()`, `peekHeader()`, `readCoherent(dest, lastFrameId)`, and correct non-BigInt `maskLo`/`maskHi` accumulation.

The third positional parameter means **`dirtyMask` in one and `timestamp` in the other**. `GlassMemory.spec.ts` exercises the second API exclusively (`writer.commitFrame(1, [u0], 1000)`, `reader.readCoherent(dest, 0)`, `writer.peekSeqlock()`). Therefore:

- The production write path is **untested**.
- The tested write path is **unused by the tick loop**.
- The test-suite green signal on Glass Memory conveys no information about the code that actually drives hardware.

This is the most dangerous class of finding in a due diligence: a passing test suite over a dead code path.

### 1.5 Seqlock correctness

The protocol itself is sound (odd = write in progress, `Atomics.add` fences either side, reader retries while `s1 !== s2`). Two residual issues:

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\glass\DmxSabHandlers.ts:97-105
      this.scratch.set(this.u8)

      s2 = Atomics.load(this.i32, DmxHdr.SEQLOCK)

      // Si el seqlock cambió durante nuestra lectura, hubo una re-escritura simultánea (tearing).
      // El do-while se repite.
    } while (s1 !== s2)

    return { frameId: this.i32[DmxHdr.FRAME_ID], data: this.scratch }
```

- `FRAME_ID` is re-read **after** the validated window closes. The returned `frameId` can belong to a newer frame than the returned `data`. Correct form is to capture `frameId` inside the window and return the captured value.
- `data: this.scratch` hands out a reference to the reader's own mutable buffer. The next `readCoherent` call mutates data the caller may still hold. Documented nowhere.
- The retry loop has **no backoff and no bound**. If a writer is interrupted mid-frame and leaves the seqlock odd (the spec file at `GlassMemory.spec.ts:339` explicitly contemplates this: *"seqlock congelado en impar (escritor interrumpido)"*), this reader spins forever burning a core. `GlassMemory`'s reader returns `null` in that case; the production one does not.

### 1.6 Race conditions

No data race was found in the SAB protocol. A genuine **write-write race** exists elsewhere — see F12 in §4.2.

---

## 2. Nodal Abstraction vs. Reality

### 2.1 What is well designed

Credit where due. `capability-node.ts` is a competent piece of domain modelling:

- **Capability-first decomposition.** `ICapabilityNode` models *a physical capability* (`COLOR`, `IMPACT`, `KINETIC`, `BEAM`, `ATMOSPHERE`), not a fixture. A fixture is explicitly demoted to *"una carcasa que agrupa N nodos"*. This is the correct axis of decomposition and it is the reason the engine can drive a dimmer and a moving head through one code path.
- **Discriminated union on `family`** (`AnyNodeData`) gives exhaustive, cast-free pattern matching in the Systems.
- **`state: Float64Array(4)`** pre-allocated for `[target, current, velocity, timestamp]` — genuine SoA-adjacent thinking.
- **`INodeConstraints`** encodes real hardware physics (`minChangeTimeMs` for mechanical wheels, `maxSpeed`, `responseType`) rather than pretending all channels are alike.
- `NodeGraph.ts` storage is competent: dense arrays per family, `_slotIndex` for O(1) swap-and-pop removal, and pre-built `byZone`/`byRole` indices per family rebuilt only at patch time. Views (`NodeView`) hold direct references to the dense arrays, so Systems iterate without copying.

The read model is designed for the hot path. This part of the architecture is sound and would scale.

### 2.2 Where the abstraction leaks

**Leak 1 — hardcoded fixture models in the universal egress loop.** The 44 Hz loop that is supposed to be hardware-agnostic contains a block named for one specific product:

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\tick\TickEngine.ts:1337-1341
        for (const [deviceId, lockInfo] of this._goldenNukeLocks) {
          if (lockInfo.universe === universe && Array.isArray(egressBuf)) {
            const base = lockInfo.dmxAddress - 1  // 0-based
            // CH2: Golden Master Dimmer → 255
            egressBuf[base + 1] = 255
```

Channel semantics (`CH2 = Golden Master`, `CH4 = Gold 1`) are hardcoded by absolute offset in the orchestrator. This is exactly the knowledge the node model exists to encapsulate, re-inlined at the last mile.

**Worse: it is dead code.** `egressBuf` is a `Uint8Array` (from `getUniverseBuffer`/`getSoftBlackoutUniverseBuffer`). `Array.isArray(new Uint8Array(512))` is **`false`** — typed arrays are not `Array` instances. The guard can never pass. This block has never executed. Someone shipped a hardcoded hardware hack into the hot loop, and it silently does nothing; whatever bug it was written to paper over is either still present or was fixed elsewhere. Either way there is no test covering it.

**Leak 2 — a diagnostic scan for a fixture by name.** In the same loop:

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\tick\TickEngine.ts:1359-1363
        if (this.frameCount % 30 === 0) {
          const tungstenFixture = (this.fixtures as Array<{ name?: string; dmxAddress?: number; address?: number }>)
            .find(f => typeof f.name === 'string' && f.name.toLowerCase().includes('tungsten'))
          if (tungstenFixture) {
            const base = (tungstenFixture.dmxAddress ?? (tungstenFixture.address ?? 1)) - 1 // 0-based
```

An O(fixtures) linear scan with a `.toLowerCase()` string allocation per fixture, executed **per universe** every 30 frames (~1.5 Hz × U), whose entire consumer body is commented out. At 50 universes and 500 fixtures that is 25,000 string allocations per second-and-a-half to compute a value that is immediately discarded. It also hardcodes a fixture *name substring* into the engine.

**Leak 3 — the type-safety escape hatch.** `ctx: any` (§1.1) and `aetherResolver.registeredUniverses as number[]` (`TickEngine.ts:1388`) — the latter is a false cast; the getter returns `IterableIterator<number>`, not `number[]`. It happens to work because `Set` accepts any iterable, but the declared type is a lie the compiler now trusts.

**Verdict:** the abstraction is well designed at the type layer and *breached at the egress layer*. The breaches are concentrated in `TickEngine`'s egress block — which is also where the GC problems are. That block is the architectural weak point of the entire module.

---

## 3. Multicell & Legacy Hardware — the load-bearing claim fails

This is where the stated capability and the data model diverge irreconcilably.

### 3.1 The invariant that forbids shared channels

`capability-node.ts` states the rule twice, as a documented invariant:

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\capability-node.ts:69-70
 * Un canal pertenece a **exactamente un nodo**. No hay canales
 * compartidos entre nodos del mismo Device.
```

and again at `capability-node.ts:210`: *"Un canal DMX pertenece a exactamente un nodo."*

Now consider the canonical hardware the module claims to support: **a multi-cell LED bar with 8 RGB cells behind one shared master dimmer and one shared strobe.** The physically correct model is 8 `COLOR` nodes plus 1 `IMPACT` node, where the master dimmer is *read* by all 8 cells and *written* by an HTP arbitration across them.

The invariant forbids this. The shared dimmer channel must be assigned to exactly one node. Therefore:

- Assign it to a 9th "master" node → the 8 cell nodes have no way to express intent on it. Per-cell dimming is lost.
- Assign it to cell 1 → cells 2–8 are hostage to cell 1's dimmer value.

There is **no HTP/LTP merge primitive at the channel level.** Arbitration happens upstream at the *node intent* level (`NodeArbiter` → `ArbitratedNodeMap`), and `NodeResolver._writeNode` writes each node's channels into the universe buffer with a direct store:

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts:648
    const baseAddr = device.dmxAddress - 1  // 1-based → 0-indexed
```

Last writer wins at the byte level. Two nodes targeting one offset silently clobber each other.

### 3.2 `ignitionDeps` is not a substitute

The mechanism offered for cross-channel dependency is `ignitionDeps`:

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\capability-node.ts:104-110
  readonly ignitionDeps?: readonly {
    readonly targetChannelType: AetherChannelType
    readonly requiredValue: number
    readonly mode: 'hold' | 'release'
    /** WAVE 4722: Offset DMX 0-based del canal master. Precedencia sobre targetChannelType. */
    readonly targetDmxOffset?: number
  }[]
```

This is a **static, unidirectional force-to-constant**: "when this channel is active, pin the target channel to `requiredValue`." It solves exactly one problem — *"the shutter must be at 255 for the dimmer to do anything"*. It cannot express `master = max(cell₁..cell₈)`, because `requiredValue` is a patch-time constant, not a function of sibling node state. Note also that the pre-computation resolves the target by linear search:

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts:672
          const target = allChannels.find(c => c.type === dep.targetChannelType)
```

`.find()` by channel *type* means a device with two dimmers resolves ambiguously to the first — hence the `targetDmxOffset` escape hatch bolted on in WAVE 4722. The mechanism is being patched toward absolute-offset addressing, i.e. away from the abstraction.

### 3.3 The Governor Engine is real, but is not a multicell solution

Unlike multicell, governors **are** wired end-to-end. `IDeviceDefinition.dmxGovernors` (`device.ts:228`) → `NodeExtractionPipeline` (`:436`) → consumed in the resolver hot path:

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts:1325-1330
      // 🏛️ DMX GOVERNOR ENGINE — evaluación declarativa de última milla. Zero-alloc.
      const _govs = device.dmxGovernors
      let finalByte = safeDmxValue

      if (_govs !== undefined && _govs.length > 0) {
        finalByte = sanitizeDmxByte(applyDMXGovernors(_govs, chDef.dmxOffset, chDef.type, rawNormalized, safeDmxValue))
```

`applyDMXGovernors` is honestly zero-allocation as advertised (sequential `for`, no closures, no spread) and the `forceByte` / `mapToRange` / `clampMin` rule vocabulary is a genuinely elegant answer to non-linear legacy hardware (the Big Dipper 7R shutter case in the docs is real and well handled).

Two criticisms:

1. **It is a value-shaping filter, not a multiplexer.** A governor rewrites *one byte* from *one channel's own* normalized intent. It has no access to sibling channels or sibling nodes. It cannot merge, cannot arbitrate, cannot implement a shared master.
2. **Lookup is O(governors) per channel per frame.** The file header claims *"Lookup O(1)"*, but that refers only to the `CHANNEL_TO_INTENT` object; the governor itself is found by linear scan:

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\DMXGovernorEvaluator.ts:62-64
  for (let gi = 0; gi < governors.length; gi++) {
    const gov = governors[gi]
    if (gov.channelIndex !== channelOffset) continue
```

Every other precomputable structure in this codebase is hoisted to patch time (`_precomputeIgnitionMap`, `_universeBuffers`, `byZone`/`byRole` indices). A `Map<dmxOffset, IDMXGovernor>` or a flat offset-indexed array frozen at patch time is the obvious and consistent fix. At 50 universes the worst case is 25,600 channel writes/frame, each scanning the device's governor list.

### 3.4 `aetherCells` — persistence without runtime semantics

`IAetherCellSnapshot` exists and round-trips through Forge (`compileForgeState.ts:532`, `forgeBuilderState.ts:818`), but the field set is `{ id, label, family, uiPosition, ... }` — the code comments it as *"Snapshot de células Aether (**layout visual** puro para persistencia 1:1)"* (`FixtureDefinition.ts:295`). Cells are a **Forge editor grouping construct**, compiled away into flat nodes. And in Hephaestus, the cell concept is explicitly a stub:

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\hephaestus\types.ts:380-382
   * Forward-compat SOLO: ID de celda dentro de un fixture multicell.
   * RESERVADO en v3.0 — Runtime no lo consume. Migrator no lo emite todavía.
   */
```

*"Runtime no lo consume"* — the codebase's own assessment.

### 3.5 Conclusion on Step 3

**The architecture is hardware-agnostic for independent channels and genuinely strong for non-linear legacy hardware via governors. It is not capable of modelling shared/multiplexed channels across cells, and no code path exists to do so.** The `cell` identity is a UI-layer and persistence-layer concept that is erased before it reaches the resolver. Any claim of first-class multicell support with shared masters is, on the current data model, unsupported.

---

## 4. GraphNode — the Manual Control question

### 4.1 It is not a manual-control canvas

`NodeGraphTab.tsx` is scoped to Forge and bound to a single `fixtureId`:

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\ForgeView\tabs\nodegraph\NodeGraphTab.tsx:26-38
const NodeGraphTab: React.FC = () => {
  // ── Store (selección granular, sin re-render innecesario) ──────────────
  const { fixtureId, nodeCount, edgeCount, isDirty, selectedCount } =
    useForgeGraphStore(
```

with `isDirty`, a save/compile step (`compileForgeState` → `buildCompleteFixture`), a preset library (`CUYO_ARSENAL`), and a "Pack as Ingenio" export. This is a **design-time fixture-profile compiler UI**. The graph it edits is compiled into `FixtureDefinition.nodeGraph` at save time and then flattened by `NodeExtractionPipeline` into `INodeChannelDef[]` at patch time.

It therefore adds **zero runtime overhead** — the criticism of "gimmicky layer adding overhead" does not apply; the graph does not exist at 44 Hz. But it also does not serve manual programmers, because it is not a live surface. It cannot be operated during a show. There are no faders, no playbacks, no cue stack, no HTP/LTP submaster model.

The React-layer engineering is competent (`useShallow` selectors, granular subscriptions, keyboard shortcuts, confirm-guarded destructive actions).

### 4.2 The real manual-control gap — F12

Manual control has **no arbitrated path into the engine**. The former one is explicitly gone; `WheelSmithEmbedded.tsx:418` records the tombstone:

> *"El antiguo `lux.arbiter.setManual` está MUERTO (masterArbiter extinto WAVE 4704)."*

What replaced it is a raw hardware bypass, documented as such:

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\IPCHandlers.ts:1781-1782
  // 🎛️ WAVE 1007: THE NERVE LINK - Direct DMX injection for calibration tools
  // GOD MODE: Bypasses HAL and TitanEngine for raw hardware access
```

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\IPCHandlers.ts:1793-1802
      if (universe === 0) {
        // Primary universe - send via USB/Serial
        if (universalDMX?.isConnected) {
          universalDMX.setChannel(clampedAddress, clampedValue)
        }
```

This writes **directly into driver channel state**, while `TickEngine` writes the SAB and drivers read the SAB (`OpenDMXStrategy.ts:332-333`: *"el loop interno lee directamente del SAB. TickEngine ya escribió en el SAB via DmxUniverseWriter.commitFrame()"*).

Two producers, one consumer, no coordination. Concretely: **any manual value set via `sendDirect` is overwritten within ≤22.7 ms by the next `commitFrame`** for any universe the Aether resolver has registered — and recall from §1.3 that `commitFrame` zero-fills even universes it has no data for. Manual control therefore either flickers or does nothing, depending on driver read ordering.

This is acceptable for its stated purpose (a momentary calibration probe in `TestPanel`/`WheelSmith`). It is not a foundation for manual programming. **The module has no submaster/playback architecture at all**, and the arbiter that could have hosted one was deleted.

### 4.3 Verdict on Step 4

Not gimmicky, not overhead — but mis-scoped relative to the question. GraphNode is a solid *fixture authoring* tool. Manual programming is an **unimplemented capability**, not a weak one, and the raw-injection stopgap actively races the engine.

---

## 5. Will it support 50 universes?

`MAX_UNIVERSES = 50` is correctly plumbed dimensionally — `DMX_SAB_BYTES = 25,664` covers 50 × 512, the 64-bit split mask has headroom for 64, and `GlassMemory.spec.ts:165-172` proves universe 49 lands at the correct offset. **The memory layout scales. The egress implementation does not.**

Ranked by what actually breaks first:

1. **GC jitter (F1/F2) — the binding constraint.** ~13,200 allocations/sec and 1.13 MB/s of young-gen garbage at U=50, from code that is trivially rewritable to zero-alloc. Symptom: intermittent scavenge pauses inside a 22.7 ms budget → visible stutter on movers. *Analytically derived; needs a heap-profile run to quantify pause distribution.*
2. **`Int32` mask overflow (F5) at universe ≥ 31.** A correctness bug that triggers *inside* the advertised range.
3. **Unconditional 25.6 KB write + full-buffer read per frame (F3).** Wasteful at all sizes; the `dirtyMask` needed to fix it is already computed and thrown away.
4. **Governor scan (F9)** — O(channels × governors); at 25,600 channel writes/frame this becomes measurable with non-trivial governor counts.
5. **Sniffer scan (F8)** — O(fixtures × universes) string allocations for a discarded result.

None of these are architectural dead ends. **Every one of them is localised to `TickEngine.ts:1318-1400` and `DmxSabHandlers.ts:30-56`** — roughly 120 lines. The type model, the graph storage, the arbiter/resolver split, and the SAB layout are all sound enough to build on.

**Bottom line:** the foundation is sound; the last 120 lines of the egress path are not, and they are the only 120 lines that run 44 times a second against every universe. The 50-universe claim is aspirational today and reachable with a bounded, well-understood refactor — not a redesign.

---

## 6. Prioritised remediation

| P | Action | Est. |
|---|---|---|
| P0 | Reuse `_universeSnapshots` buffers in place; delete `new Uint8Array` + `subarray` from the loop | ~5 lines |
| P0 | Replace `BigInt` mask with `maskLo`/`maskHi` plain numbers (mirror `GlassMemory.ts`); use `>>> 0` or split at bit 31 to avoid Int32 overflow | ~10 lines |
| P0 | Delete the Golden Nuke block (F7) — provably dead via `Array.isArray` on a `Uint8Array`; re-express as node/governor data if the behaviour is still needed | delete |
| P0 | Delete the DMX Sniffer block (F8) — body already commented out | delete |
| P1 | Consolidate `DmxSabHandlers` and `GlassMemory` into one writer/reader; retarget `GlassMemory.spec.ts` at the surviving production API | 1 file |
| P1 | Make `commitFrame` honour `dirtyMask`; iterate set bits instead of `0..length`; stop zero-filling unowned universes | ~15 lines |
| P1 | Replace `TickEngine`'s `ctx: any` with an explicit `TickContext` interface | mechanical |
| P1 | Capture `frameId` inside the seqlock window; bound the retry loop; document or eliminate the shared `scratch` return | ~10 lines |
| P2 | Precompute governors into an offset-indexed array at patch time | ~20 lines |
| P2 | Hoist `new Set(registeredUniverses)` to a persistent pre-allocated set | ~3 lines |
| P3 | **Design decision required:** introduce a channel-level merge primitive (HTP/LTP arbitration on a shared `dmxOffset`) or formally document that shared-master multicell is out of scope. The current invariant and the marketing claim cannot both stand. | design |
| P3 | **Design decision required:** manual programming needs a real submaster/playback layer feeding the `NodeArbiter`, replacing the `sendDirect` bypass that races `commitFrame`. | design |

---

## 7. Confidence & limitations

- All code findings are from direct reads of the cited lines; line references are current as of this audit.
- Allocation counts are **analytically derived from allocation sites**, not measured. A `--trace-gc` / heap-snapshot run at U=50 is required to convert F1/F2 from "will jitter" to a pause-time distribution.
- `Array.isArray(Uint8Array)` (F7) and the `Int32` mask overflow (F5) are deterministic language semantics, asserted with high confidence.
- The multicell finding (F6) rests on the documented invariant plus the absence of any channel-level merge in `_writeNode`. A grep for `governor|multiplexer|multicell|cellIndex|sharedChannel` across `src/` returns no runtime merge implementation. If such a mechanism exists outside `core/aether`, this finding should be revisited.
- `TitanOrchestrator`'s adapter-wiring and the `NodeArbiter` internals were surveyed but not audited line-by-line; reserved for Part 2 along with `IntentBus` layer precedence, `AetherSafetyMiddleware`, and the arbitration matrix.
