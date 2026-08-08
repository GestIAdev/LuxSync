FORENSIC AUDIT REPORT
1. The Empty Panels Mystery — COLLAPSED, NOT EMPTY
Finding
The GENE_REGISTRY is not truncated. It is built programmatically at [geneRegistry.ts:264-266](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/vibeLab/geneRegistry.ts:263:0-265:999):



ts
export const GENE_REGISTRY: readonly GeneDescriptor[] = Object.entries(GENE_RANGES).map(
  ([path, range]) => buildDescriptor(path, range),
)
I verified with a test script that all 437 entries are mapped. The RAW panel counts are:

Separation Matrix: 11 genes ✓
Guillotine: 6 genes ✓
Flash Gate: 3 genes ✓
Acid/Noise/Apocalypse: 4 genes ✓
Metronome: 2 genes ✓
Compact Mirror: 123 genes ✓
The interlock is correctly set to 'raw' in the store initial state (line 191), and getGenesByPanel('separation', 'raw') returns all 11 genes.

Root Cause
The panels appear empty because all panels start COLLAPSED. The GenePanel component at [GenePanel.tsx:69-85](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/vibeLab/kit/GenePanel.tsx:68:0-84:999) only renders children when isExpanded is true:



tsx
<AnimatePresence initial={false}>
  {isExpanded && (
    <motion.div ...>
      <div className="gene-panel-content-inner">
        {children}
      </div>
    </motion.div>
  )}
</AnimatePresence>
In PhysicsBench at [PhysicsBench.tsx:120-128](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/vibeLab/tabs/PhysicsBench.tsx:119:0-127:999), the isExpanded check reads from expandedPanels.physics, which is initialized to [] (empty array) in the store at line 192:



ts
expandedPanels: { physics: [], color: [], movement: [] },
Since expandedPanels.physics.includes(panelId) returns false for ALL panels, every panel renders only its header (title + icon + chevron) with no content. The user sees panel headers like "THE SEPARATION MATRIX" but no sliders — which looks "empty" but is actually collapsed.

The user needs to click each panel header to expand it. This is by design (line 8 of GenePanel.tsx: "No renderiza los hijos si está cerrado (optimización: 282 controles no se montan todos a la vez)"), but it creates the illusion of empty panels.

2. Orbit Trail Stuck at Bottom-Left — physicalPan Fallback Hits 0, Not undefined
Finding
The dot at bottom-left corresponds to pan = -1, tilt = -1 in normalized coordinates. For (panVal - 128) / 128 = -1, the input panVal must be exactly 0.

Root Cause
The fallback chain in main.ts uses the ?? (nullish coalescing) operator:



js
const panVal = active.physicalPan ?? active.pan ?? (mvmt.centerX != null ? mvmt.centerX * 255 : 128)
The ?? operator only catches null and undefined — it does NOT catch 0. Here's what happens:

active.physicalPan — The FixtureState.physicalPan field is readonly physicalPan?: number (optional). When the physics driver hasn't been initialized for a fixture, this field is undefined. The ?? operator correctly falls through.
active.pan — The FixtureState.pan field is pan: number (NOT optional, defaults to 0). When no vibe is driving the fixtures (idle state), the target pan is 0 (DMX default). The ?? operator sees 0 (not null/undefined) and returns it, breaking the fallback chain.
The result: (0 - 128) / 128 = -1 → bottom-left corner.
Evidence
[SeleneProtocol.ts:619-622](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/protocol/SeleneProtocol.ts:618:0-621:999) — pan: number (not optional, no default → defaults to 0 in JavaScript)
[TickEngine.ts:960-961](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/tick/TickEngine.ts:959:0-960:999) — The TickEngine's cached hot-frame fixture initializes pan: 0, tilt: 0, physicalPan: 0, physicalTilt: 0
[FixturePhysicsDriver.ts:1037-1039](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/movement/FixturePhysicsDriver.ts:1036:0-1038:999) — The physics driver's getPhysicsState() defaults physicalPan to 127 when no position is cached, but this default may not propagate to the FixtureState.physicalPan field if the HAL doesn't call getPhysicsState() for idle fixtures.
The fix should use || (logical OR) instead of ?? for the active.pan fallback, since 0 is not a valid "signal present" value for the target pan when the fixture is idle.

3. Command Deck Desync — The lux:setVibe IPC Handler Does Not Exist
Finding
This is the most critical discovery. The entire vibe IPC chain is broken. The preload exposes three APIs at [preload.ts:846-860](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/preload.ts:845:0-859:999):



ts
setVibe: (vibeId: string) => ipcRenderer.invoke('lux:setVibe', vibeId),
getVibe: () => ipcRenderer.invoke('lux:get-vibe'),
onVibeChange: (callback) => {
  ipcRenderer.on('lux:vibe-changed', handler)
  ipcRenderer.on('selene:vibe-changed', handler)
  ...
}
But in the entire electron/ directory, there is:

NO ipcMain.handle('lux:setVibe', ...) — the setVibe call goes into a void
NO ipcMain.handle('lux:get-vibe', ...) — the getVibe call goes into a void
NO mainWindow.webContents.send('lux:vibe-changed', ...) — the event is never emitted
NO mainWindow.webContents.send('selene:vibe-changed', ...) — the event is never emitted
I searched all .ts files in the electron/ directory for ipcMain.handle and ipcMain.on — 52 handlers registered, none for lux:setVibe or lux:get-vibe.

Consequence
engineSync.ts calls window.lux?.setVibe?.(newKey) → ipcRenderer.invoke('lux:setVibe', ...) → NO HANDLER → Promise rejects → the engine never receives the custom vibe key. The graft registers the vibe in the 7 registries, but the engine's vibeManager.setActiveVibe() is never called.
useSeleneVibe.setVibe('pop-rock') → same thing → Promise rejects → the catch block at line 188-190 logs the error → currentVibe in vibeStore stays at 'idle' (the initial state).
useSeleneVibe initial fetch (window.lux.getVibe()) → ipcRenderer.invoke('lux:get-vibe', ...) → NO HANDLER → Promise rejects → hasFetchedInitial is set to true but currentVibe stays at 'idle'.
useSeleneVibe vibe change listener (window.lux.onVibeChange(...)) → listens for lux:vibe-changed / selene:vibe-changed events → NEVER SENT → currentVibe is never updated from backend.
The Desync Explained
The Command Deck and the Vibe Lab are both disconnected from the engine. Neither window.lux.setVibe() call actually reaches the main process. The vibeStore.currentVibe should always be 'idle' because none of the three update paths (initial fetch, vibe change event, optimistic setVibe) work.

If the user sees POP/ROCK as active in the Command Deck, it may be because:

The ipcRenderer.invoke for lux:setVibe doesn't reject immediately in some Electron versions — it may hang indefinitely, leaving isTransitioning = true but currentVibe unchanged
Or there's a stale state from a previous session where the handler existed
Or the user is seeing a visual state from a different code path (e.g., the truthStore reading consciousness.vibe.active directly, separate from vibeStore)
The Vibe Lab's engineSync.ts grafts the custom vibe into the registries correctly, but the window.lux.setVibe(bundle.key) call that's supposed to tell the engine to activate it goes nowhere. The engine never switches to the custom vibe. The Command Deck never gets notified. Both UIs show stale/disconnected state.

Summary of Root Causes
Issue	Root Cause	Location
Empty RAW panels	All panels start collapsed (expandedPanels.physics = []); GenePanel only renders children when isExpanded	vibeLabStore.ts:192, GenePanel.tsx:70
Orbit Trail at (-1,-1)	active.pan is 0 (DMX default), ?? doesn't catch 0, so (0-128)/128 = -1	main.ts:855-856, SeleneProtocol.ts:620
Command Deck desync	lux:setVibe IPC handler completely missing from main process; engine never receives vibe changes	preload.ts:846 exposes it, but no ipcMain.handle in electron/
