# LAUNCHER ARCHITECTURE CONTEXT — WAVE 7579

**Purpose:** This document provides the next LLM (Opus) with a complete, focused picture of LuxSync's current Electron boot sequence, IPC bridge, persistence layer, and Zustand state management. It is a handoff brief for designing a pre-boot "Vanguard Launcher" window — a lightweight hardware/performance probe that runs BEFORE the main 1920×1080 BrowserWindow loads.

**Scope:** `electron-app/electron/main.ts`, `electron-app/electron/preload.ts`, `electron-app/src/core/config/ConfigManagerV2.ts`, `electron-app/src/core/stage/StagePersistence.ts`, `electron-app/src/stores/`. No Launcher code is written here.

---

## SECTION 1 — Boot Sequence (`electron/main.ts`)

### 1.1 Entry point

The app boots through a single `app.whenReady().then(async () => { ... })` chain at line 1164. There is no separate launcher or pre-boot window. The sequence is strictly serial:

```
app.whenReady()
  ├── [PACKAGED ONLY] License validation (Obsidian Vault, bytenode .jsc)
  │     └── If invalid → createActivationWindow() (separate BrowserWindow, not the main app)
  │     └── If valid → continue
  ├── await initTitan()          ← line 1446 — registers ALL IPC handlers + initializes backend
  ├── session.defaultSession.webRequest.onHeadersReceived (COOP/COEP for SharedArrayBuffer)
  ├── createWindow()             ← line 1467 — creates the main BrowserWindow
  ├── setupTheiaWindowManager()  ← line 1472 — secondary output window
  └── app.on('activate', ...)    ← line 1484 — macOS re-create window
```

### 1.2 `initTitan()` — the backend initialization (line 562)

This runs BEFORE `createWindow()`. It registers all IPC handlers so the renderer can call them immediately on load:

```typescript
async function initTitan(): Promise<void> {
  await stagePersistence.init()          // StagePersistence (show files)
  setupStageIPCHandlers(() => mainWindow)
  setupKeyForgeIPCHandlers(() => mainWindow)
  registerVibeLabIPCHandlers()
  regraftCustomVibesOnBoot()             // async, not awaited
  setupHephIPCHandlers()                 // Hephaestus file I/O
  setupGenesisIPCHandlers()              // Genesis Engine
  getGenesisVault().initialize()
  igniteGenesisEngine()                  // async, not awaited
  // ... Aether, Arsenal, Chronos, Playback IPC handlers ...
  setupIPCHandlers(deps)                 // The 61+ core IPC handlers (config, DMX, audio, selene, etc.)
}
```

**Key insight for the Launcher:** `initTitan()` is heavy — it initializes the full backend (DMX drivers, audio workers, effects engine, Genesis engine). The Launcher should NOT trigger `initTitan()`; it should run in its own lightweight BrowserWindow with a minimal preload that only exposes config read/write + hardware probe IPCs.

### 1.3 `createWindow()` — the main BrowserWindow (line 433)

```typescript
function createWindow(): void {
  const iconExt = process.platform === 'darwin' ? 'icns' : process.platform === 'linux' ? 'png' : 'ico'
  const appIcon = path.join(__dirname, `../build/icon.${iconExt}`)

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    frame: false,           // Custom title bar (TitleBar.tsx component)
    title: 'LuxSync',
    icon: appIcon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,   // Critical: audio/DMX timers must not be throttled
    },
  })

  // Permission handlers: midi, midiSysex, media, mediaKeySystem, geolocation
  mainWindow.webContents.session.setPermissionCheckHandler(...)
  mainWindow.webContents.session.setPermissionRequestHandler(...)
  mainWindow.webContents.session.setDisplayMediaRequestHandler(...)  // desktopCapturer for system audio

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (isDev) mainWindow?.webContents.openDevTools()
    // F12 toggles DevTools in any environment
  })

  // Load URL
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')        // Vite dev server
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))  // Production build
  }

  mainWindow.on('closed', () => {
    rendererAlive = false
    mainWindow = null
    doShutdown()   // Full backend shutdown tied to main window close
  })
}
```

**Key parameters for the Launcher:**
- `frame: false` — the app uses a custom React title bar (`TitleBar.tsx`). The Launcher can use `frame: true` for simplicity since it is a system-level dialog, OR `frame: false` with its own minimal title bar for brand consistency.
- `width: 1920, height: 1080` — the main window. The Launcher should be smaller (e.g., 800×600 or 1024×700).
- `backgroundThrottling: false` — critical for the main app (audio/DMX timers). The Launcher can use the default `true` since it has no real-time timers.
- `preload: path.join(__dirname, 'preload.js')` — the Launcher needs a SEPARATE preload (e.g., `launcherPreload.js`) that only exposes config + hardware probe APIs, not the full `window.luxsync` / `window.lux` API surface.
- `isDev` detection: `process.env.NODE_ENV === 'development' || !app.isPackaged` (line 108). The Launcher should use the same detection for dev/prod URL loading.

### 1.4 Global state in main.ts

```typescript
let mainWindow: BrowserWindow | null = null          // line 97
let rendererAlive: boolean = false                    // line 102 — broadcast liveness flag
let effectsEngine: EffectsEngine | null = null        // line 103
let titanOrchestrator: TitanOrchestrator | null = null // line 104
export const glassPoolManager = new BufferPoolManager() // line 105 — Aether Glass SAB pool
const fixturePhysicsDriver = new FixturePhysicsDriver() // line 107
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged  // line 108
let currentLicenseTier: 'DJ_FOUNDER' | 'FULL_SUITE' = 'FULL_SUITE'       // line 246
```

The `rendererAlive` flag (WAVE 7567) is critical: it prevents infinite "Render frame was disposed" error floods when the renderer crashes. All tick-driven broadcast callbacks check this before calling `.send()`. The Launcher's window should have its own liveness flag if it receives IPC events.

### 1.5 Window control IPC handlers (line 1562)

The custom title bar communicates via these IPC channels:

| IPC Channel | Type | Handler |
|---|---|---|
| `window:minimize` | `invoke` | `mainWindow?.minimize()` |
| `window:maximize` | `invoke` | toggle maximize/unmaximize |
| `window:close` | `invoke` | `mainWindow?.close()` |
| `window:isMaximized` | `invoke` | returns `boolean` |
| `window:drag:start` | `send` | manual drag start (WAVE 7568 Windows bug workaround) |
| `window:drag:move` | `send` | manual drag move |
| `window:drag:end` | `send` | manual drag end |
| `window:drag:doubleClick` | `invoke` | toggle maximize |
| `window:maximized` | main→renderer event | notifies renderer of maximize state changes |

The Launcher can reuse these handlers if it uses a frameless window, or skip them entirely if it uses a native frame.

---

## SECTION 2 — IPC Bridge (`electron/preload.ts`)

### 2.1 contextBridge exposure

The preload exposes FOUR separate API surfaces to the renderer via `contextBridge.exposeInMainWorld` (line 1944):

```typescript
contextBridge.exposeInMainWorld('luxsync', api)        // line 1944 — main API (DMX, audio, selene, controls, chronos, etc.)
contextBridge.exposeInMainWorld('lux', luxApi)          // line 1945 — Selene Lux Core bridge (license, fixtures, config, arbiter, stage)
contextBridge.exposeInMainWorld('electron', electronAPI)// line 1946 — raw ipcRenderer passthrough (for event subscriptions)
contextBridge.exposeInMainWorld('luxDebug', luxDebug)   // line 1947 — test utilities (constructor verification, profiler)
```

In the renderer, these are accessed as:
- `window.luxsync` — the primary API (DMX, audio, ArtNet, MIDI, overrides, selene, controls, chronos)
- `window.lux` — the secondary API (license tier, fixtures, config, stage, arbiter, theia)
- `window.electron.ipcRenderer` — raw `invoke`/`on`/`removeListener` for custom event subscriptions
- `window.luxDebug` — test/profiling utilities

### 2.2 IPC patterns

Two distinct patterns are used throughout the preload:

**Pattern 1: `ipcRenderer.invoke` (request/response)**
Used for all command-style calls that expect a return value:
```typescript
getVersion: () => ipcRenderer.invoke('app:getVersion'),
getConfig: () => ipcRenderer.invoke('lux:get-config'),
saveConfig: (config: Record<string, any>) => ipcRenderer.invoke('lux:save-config', config),
dmx: {
  getStatus: () => ipcRenderer.invoke('dmx:getStatus'),
  connect: (portPath: string) => ipcRenderer.invoke('dmx:connect', portPath),
  // ...
}
```

**Pattern 2: `ipcRenderer.send` (fire-and-forget)**
Used for high-frequency or one-way messages where no response is needed:
```typescript
initCalibration: (): void => {
  ipcRenderer.send('hephaestus:calibration:init')
},
midiMaster: {
  start: (fromZero: boolean) => ipcRenderer.send('midi-master:start', { fromZero }),
  stop: () => ipcRenderer.send('midi-master:stop'),
  // ...
}
```

**Pattern 3: Event subscription (main→renderer push)**
Used for backend-driven updates. Returns an unsubscribe function:
```typescript
onStatus: (callback: (status: {...}) => void) => {
  const handler = (_: Electron.IpcRendererEvent, status: any) => callback(status)
  ipcRenderer.on('dmx:status', handler)
  return () => ipcRenderer.removeListener('dmx:status', handler)
}
```

**Pattern 4: MessageChannel transfer (high-performance)**
Used for the Aether Glass SAB (SharedArrayBuffer) pipeline — a `MessageChannelMain` is created in main, `port2` is transferred to the renderer via `postMessage` with a Transferrable list:
```typescript
// In main.ts did-finish-load handler (line 507):
const { port1, port2 } = new MessageChannelMain()
glassPoolManager.attach(port1)
mainWindow.webContents.postMessage('glass:port', null, [port2])
```
The Launcher does NOT need this pattern — it has no real-time data pipeline.

### 2.3 The `window.lux` config API (line 1113)

This is the API the Launcher will use to read/write performance settings:

```typescript
// In preload.ts, inside luxApi object:
getConfig: () =>
  ipcRenderer.invoke('lux:get-config'),

saveConfig: (config: Record<string, any>) =>
  ipcRenderer.invoke('lux:save-config', config),

resetConfig: () =>
  ipcRenderer.invoke('lux:reset-config'),
```

**Handler in `IPCHandlers.ts` (line 660):**
```typescript
ipcMain.handle('lux:save-config', async (_event, config: Record<string, unknown>) => {
  if (configManager?.saveConfig) {
    await configManager.saveConfig(config)
    return { success: true }
  }
  return { success: false, error: 'ConfigManager not available' }
})
```

**Note:** The `lux:get-config` handler is referenced in the preload but was NOT found in `IPCHandlers.ts`. It may be registered in a different file or may be missing (the `getConfig` call may fail silently). The Launcher should verify this handler exists or add it.

### 2.4 The `electronAPI` raw passthrough (line 1929)

For event subscriptions that don't fit the typed API, the preload exposes a raw `ipcRenderer`:

```typescript
const electronAPI = {
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => {
      return ipcRenderer.invoke(channel, ...args)
    },
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => {
      ipcRenderer.on(channel, listener)
    },
    removeListener: (channel: string, listener: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, listener)
    },
  },
}
```

The Launcher's preload should NOT expose this — it is a security surface that allows arbitrary IPC channel access. The Launcher preload should only expose the specific config + probe APIs it needs.

### 2.5 Glass preload (line 9)

```typescript
import './glassPreload'
```

This imports a separate preload script that sets up the Aether Glass SAB communication. The Launcher does NOT need this — it has no real-time data pipeline.

---

## SECTION 3 — Persistence / Config

### 3.1 ConfigManagerV2 (`src/core/config/ConfigManagerV2.ts`)

This is the APP-LEVEL preferences manager. It stores everything EXCEPT fixtures (which live in ShowFileV2 via StagePersistence).

**File location:**
```typescript
const userDataPath = app.getPath('userData')
this.configPath = path.join(userDataPath, 'luxsync-config.json')
```
On Windows: `C:\Users\<user>\AppData\Roaming\LuxSync\luxsync-config.json`

**Schema (`LuxSyncPreferencesV2`):**
```typescript
export interface LuxSyncPreferencesV2 {
  version: '2.0.0'
  lastSaved: string                    // ISO timestamp

  // SHOW RESTORATION
  lastOpenedShowPath: string | null    // Auto-load on startup

  // GLOBAL PREFERENCES
  dmx: DMXInterfaceConfig              // driver, port, universe, frameRate
  audio: AudioInputConfig              // source, deviceId, sensitivity, inputGain
  seleneMode: 'idle' | 'reactive' | 'autonomous' | 'choreography'
  installationType: 'ceiling' | 'floor' | 'totem'
  ui: UIPreferences                    // lastView, showBeams, showGrid, showZoneLabels, theme

  // MIGRATION FLAGS
  v1MigrationComplete: boolean
  localStorageScenesMigrated: boolean
}
```

**Where the `isPerformanceMode` flag should go:** Add a new field to `LuxSyncPreferencesV2`:
```typescript
// PROPOSED ADDITION:
performanceMode: 'auto' | 'eco' | 'hq'    // 'auto' = detected at boot by Launcher
hardwareProfile?: {
  cpuCores: number
  deviceMemory: number          // navigator.deviceMemory (GB)
  hasGpuAcceleration: boolean   // OffscreenCanvas + getContext('2d') probe result
  detectedAt: string            // ISO timestamp of last probe
}
```

This keeps the flag in the same persistent config file, loaded at boot by `configManager.load()` and readable by the Launcher via `window.lux.getConfig()`.

**Save methods:**
- `saveAsync()` — atomic write (temp file → rename), non-blocking. **Use this for Launcher saves.**
- `save()` — sync write, ONLY for app shutdown and migration.
- `saveDebounced(delayMs = 1000)` — debounced async save, for frequent updates.
- `forceSave()` — cancels debounce + sync save, for app close.

**Singleton export:**
```typescript
export const configManager = new ConfigManagerV2()
export default configManager
```

The `configManager` is constructed at module load time. The `configPath` is resolved in the constructor using `app.getPath('userData')`. The Launcher can import and use this singleton directly in the main process — no IPC needed if the Launcher runs in main. If the Launcher is a BrowserWindow, it should use the IPC bridge (`lux:save-config` / `lux:get-config`).

### 3.2 StagePersistence (`src/core/stage/StagePersistence.ts`)

This handles SHOW files (`.luxshow`), not app preferences. It is irrelevant to the Launcher — the Launcher only needs app-level config (performance mode, hardware profile). Listed here for completeness:

- Show files are stored in `userData/shows/` as `.luxshow` JSON files
- Atomic writes (temp file → rename)
- Schema validation via `validateShowFile` / `validateShowFileDeep`
- Auto-migration from V1 format
- Singleton: `export const stagePersistence = new StagePersistence()`
- Initialized in `initTitan()` via `await stagePersistence.init()`

### 3.3 Other persistence layers

| Module | Path | What it stores |
|---|---|---|
| `VibeLabPersistence` | `userData/vibes/*.luxvibe` | Custom vibe definitions |
| `KeyForgeIPCHandlers` | `userData/keyforge/*.luxkey` | Key mapping loadouts |
| `GenesisVaultService` | `userData/genesis/` | Geological/scene vault data |
| `LfxFileLoader` | Arsenal `.lfx` files | Dynamic effect definitions |

None of these are needed by the Launcher.

---

## SECTION 4 — Global State (Zustand)

### 4.1 Store inventory

The app has **30+ Zustand stores** in `electron-app/src/stores/`. The key ones:

| Store | File | Purpose |
|---|---|---|
| `useLuxSyncStore` | `luxsyncStore.ts` | Main UI state: selene mode, palette, movement, effects, blackout, audio, master dimmer |
| `useSetupStore` | `setupStore.ts` | Device config: audio source, DMX driver/port, detected devices, scan status |
| `useStageStore` | `stageStore.ts` | Show file state: fixtures, scenes, groups, zones |
| `useTransientStore` | `transientStore.ts` | High-frequency transient data: audio spectrum, beat, truth system (22 Hz updates) |
| `useTruthStore` | `truthStore.ts` | Selene AI truth: consciousness, prediction, ethics, palette |
| `useNavigationStore` | `navigationStore.ts` | Active view/tab routing |
| `useAudioStore` | `audioStore.ts` | Audio input gain, device selection |
| `useDmxStore` | `dmxStore.ts` | DMX connection state, frame data |
| `useSelectionStore` | `selectionStore.ts` | Fixture selection, hover, lasso state |
| `useKeyMapStore` | `keyMapStore.ts` | Key mapping state |

### 4.2 Store pattern

All stores use the same pattern — `create` from `zustand`, no middleware:

```typescript
import { create } from 'zustand'

export interface SetupState {
  // State fields
  audioSource: 'microphone' | 'system' | 'simulation' | 'off' | null
  // Setters
  setAudioSource: (source: ...) => void
  // Reset
  reset: () => void
}

export const useSetupStore = create<SetupState>((set) => ({
  audioSource: null,
  setAudioSource: (source) => set({ audioSource: source }),
  reset: () => set(initialState),
}))
```

**No `persist` middleware is used.** Zustand stores are in-memory only; persistence is handled by `ConfigManagerV2` (main process) via IPC. The renderer calls `window.lux.saveConfig(config)` which triggers `configManager.saveAsync()` in main.

### 4.3 Where to inject `isPerformanceMode`

**Recommendation: Create a new `usePerformanceStore.ts`** rather than adding to an existing store. Rationale:

1. **Separation of concerns.** The performance mode is a boot-time decision that affects which components mount. It does not belong in `useLuxSyncStore` (UI state) or `useSetupStore` (device config).
2. **Single responsibility.** The store has exactly one boolean + one hardware profile object. It is the simplest store in the app.
3. **No persistence needed in the store.** The flag is persisted by `ConfigManagerV2` in the main process. The store is hydrated from config on app load.

**Proposed store:**
```typescript
// electron-app/src/stores/performanceStore.ts
import { create } from 'zustand'

export type PerformanceMode = 'auto' | 'eco' | 'hq'

export interface HardwareProfile {
  cpuCores: number
  deviceMemory: number          // GB
  hasGpuAcceleration: boolean
  detectedAt: string            // ISO timestamp
}

interface PerformanceState {
  mode: PerformanceMode
  isPerformanceMode: boolean    // derived: mode === 'eco'
  hardwareProfile: HardwareProfile | null
  setMode: (mode: PerformanceMode) => void
  setHardwareProfile: (profile: HardwareProfile) => void
  hydrateFromConfig: (config: { performanceMode?: PerformanceMode; hardwareProfile?: HardwareProfile }) => void
}

export const usePerformanceStore = create<PerformanceState>((set, get) => ({
  mode: 'auto',
  isPerformanceMode: false,
  hardwareProfile: null,
  setMode: (mode) => set({ mode, isPerformanceMode: mode === 'eco' }),
  setHardwareProfile: (profile) => set({ hardwareProfile: profile }),
  hydrateFromConfig: (config) => {
    const mode = config.performanceMode ?? 'auto'
    set({
      mode,
      isPerformanceMode: mode === 'eco',
      hardwareProfile: config.hardwareProfile ?? null,
    })
  },
}))
```

**Hydration flow:**
1. Launcher window probes hardware → saves `performanceMode` + `hardwareProfile` to `luxsync-config.json` via `window.lux.saveConfig()`.
2. Launcher closes → main app window loads.
3. On app mount (e.g., in `App.tsx` or `MainLayout.tsx`), call `window.lux.getConfig()` → extract `performanceMode` + `hardwareProfile` → call `usePerformanceStore.getState().hydrateFromConfig(config)`.
4. All Eco-Mode component swaps (Section 3.7 of the performance audit) subscribe to `usePerformanceStore((s) => s.isPerformanceMode)`.

### 4.4 The `useDevicePersistence` hook pattern (reference)

The existing `useDevicePersistence` hook (`hooks/useDevicePersistence.ts`) shows the exact pattern for hydrating renderer state from backend config at boot:

```typescript
export function useDevicePersistence() {
  // ...
  useEffect(() => {
    if (_hasInitialized || isInitializing.current) return
    const initialize = async () => {
      isInitializing.current = true
      _hasInitialized = true
      try {
        if (window.lux?.getConfig) {
          const config = await window.lux.getConfig()
          // Hydrate stores from config
          await Promise.all([
            restoreAudio(config),
            restoreDMX(config),
          ])
        }
      } catch (err) {
        console.error('[DevicePersistence] Initialization failed:', err)
      } finally {
        isInitializing.current = false
      }
    }
    initialize()
  }, [])
}
```

The performance store hydration should follow the same pattern — a `usePerformanceHydration` hook that runs once on app mount, calls `window.lux.getConfig()`, and hydrates the store. The `_hasInitialized` flag prevents double-init in React Strict Mode.

---

## SECTION 5 — Launcher Integration Points (summary for Opus)

### 5.1 Where to insert the Launcher in the boot sequence

**Current:**
```
app.whenReady() → initTitan() → createWindow() → main app loads
```

**Proposed:**
```
app.whenReady()
  → createLauncherWindow()          ← NEW: lightweight BrowserWindow with launcherPreload.js
  → Launcher probes hardware         ← navigator.hardwareConcurrency, deviceMemory, OffscreenCanvas probe
  → User selects mode (Auto/Eco/HQ)  ← OR auto-detect with no user interaction
  → Launcher saves to config         ← window.lux.saveConfig({ performanceMode, hardwareProfile })
  → Launcher closes
  → initTitan()                      ← existing backend init
  → createWindow()                   ← existing main window
  → main app loads + hydrates performanceStore from config
```

### 5.2 What the Launcher needs

| Need | Source | Notes |
|---|---|---|
| Config read/write | `ConfigManagerV2` via `lux:get-config` / `lux:save-config` IPC | The `lux:get-config` handler may be missing — verify or add it |
| Hardware probe | `navigator.hardwareConcurrency`, `navigator.deviceMemory`, `OffscreenCanvas` capability test | Runs in the Launcher's renderer process |
| Window creation | `new BrowserWindow({ ... })` in main.ts | Separate from `createWindow()` — smaller, may use native frame |
| Preload | New `launcherPreload.ts` | Minimal — only config + probe APIs, NOT the full `window.luxsync` surface |
| Dev/prod URL | Same `isDev` detection | `http://localhost:5173/launcher.html` (dev) or `dist/launcher.html` (prod) |

### 5.3 What the Launcher does NOT need

- `initTitan()` — no backend initialization
- `glassPreload` — no Aether Glass SAB pipeline
- `window.luxsync` API — no DMX, audio, selene, controls
- `window.electron.ipcRenderer` raw passthrough — security surface
- `StagePersistence` — no show file loading
- Any Zustand store — the Launcher is a standalone config dialog

### 5.4 Critical constraints

1. **`backgroundThrottling: false`** must remain on the MAIN window. The Launcher can use default `true`.
2. **COOP/COEP headers** (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`) are set on `session.defaultSession.webRequest.onHeadersReceived` (line 1457). This affects ALL windows in the default session. The Launcher will inherit these headers — this is fine (it doesn't need cross-origin resources), but the Launcher's HTML must be served from the same origin.
3. **`app.isPackaged`** is the trusted dev/prod detection (line 108, 1171). Do NOT use `NODE_ENV` for security decisions.
4. **The `rendererAlive` flag** (line 102) is global. If the Launcher and main window coexist briefly, ensure the flag tracks the correct window. Safest approach: Launcher closes completely before `createWindow()` runs.
5. **License validation** (line 1171) runs BEFORE `initTitan()` and `createWindow()`. The Launcher should run AFTER license validation (so licensed users see the Launcher) or BEFORE it (so unlicensed users never see the Launcher). Recommendation: after — the Launcher is a licensed-user feature.

### 5.5 Config schema addition (for Opus to implement)

Add to `LuxSyncPreferencesV2` in `ConfigManagerV2.ts`:

```typescript
// WAVE 7579: Vanguard Launcher — performance mode + hardware profile
performanceMode: 'auto' | 'eco' | 'hq'
hardwareProfile?: {
  cpuCores: number
  deviceMemory: number
  hasGpuAcceleration: boolean
  detectedAt: string
}
```

And add to `DEFAULT_CONFIG_V2`:

```typescript
performanceMode: 'auto',
// hardwareProfile omitted — set by Launcher on first run
```

The `configManager.load()` method already merges loaded config with defaults via spread (`{ ...DEFAULT_CONFIG_V2, ...loadedV2 }`), so old configs without `performanceMode` will automatically get the default `'auto'` value.

---

## APPENDIX — Key file paths

| File | Path | Purpose |
|---|---|---|
| Main process | `electron-app/electron/main.ts` | Boot sequence, window creation, IPC handlers |
| Preload | `electron-app/electron/preload.ts` | contextBridge, IPC exposure |
| Glass preload | `electron-app/electron/glassPreload.ts` | Aether Glass SAB setup (not needed by Launcher) |
| Config manager | `electron-app/src/core/config/ConfigManagerV2.ts` | App preferences persistence |
| Stage persistence | `electron-app/src/core/stage/StagePersistence.ts` | Show file persistence (not needed by Launcher) |
| IPC handlers | `electron-app/src/core/orchestrator/IPCHandlers.ts` | 61+ core IPC handlers |
| LuxSync store | `electron-app/src/stores/luxsyncStore.ts` | Main UI state |
| Setup store | `electron-app/src/stores/setupStore.ts` | Device config state |
| Device persistence hook | `electron-app/src/hooks/useDevicePersistence.ts` | Boot hydration pattern reference |
| Stores directory | `electron-app/src/stores/` | All 30+ Zustand stores |

**Config file location (runtime):** `app.getPath('userData')/luxsync-config.json`
- Windows: `C:\Users\<user>\AppData\Roaming\LuxSync\luxsync-config.json`
- macOS: `~/Library/Application Support/LuxSync/luxsync-config.json`
- Linux: `~/.config/LuxSync/luxsync-config.json`
