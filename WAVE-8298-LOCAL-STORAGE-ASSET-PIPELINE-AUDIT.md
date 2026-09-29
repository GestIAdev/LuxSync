# 🌊 WAVE 8298-RECON — Local Storage & Asset Pipeline Audit (Read-Only)

> Forensic map of LuxSync's local-asset architecture ahead of moving Theia from
> the static `opusLibrary.ts` registry to a dynamic local library manager.
> **No code was modified.** All paths relative to `electron-app/` unless noted.

---

## TL;DR

- **No glob library anywhere.** Every scan is hand-rolled `fs.readdir` /
  `fs.readdirSync` with `{ withFileTypes: true }`. The canonical recursive
  template is `LfxFileLoader._loadDirectoryRecursive` (arsenal `.lfx`) —
  async, fail-silent, recurses into every subfolder.
- **Three scanner flavors exist**: recursive (arsenal `.lfx`, fixtures `.json`),
  flat (`vibes/*.luxvibe`, `ingenios/*.luxingenio`, `FXTParser.scanFolder`), and
  dialog-driven single-file (`chronos:save/load-project` `.lux`,
  `lux:theia:exportAsset` `.theia`).
- **Zero file watchers.** No `chokidar`, `fs.watch`, or `fs.watchFile` in
  `src/`, `electron/`, or `package.json`. The only change-notification is the
  in-memory `HephaestusClipIndex.onDidChange` observer (fires on app-driven
  upsert/remove, *not* on external filesystem edits).
- **Theia already has both UI loaders** (`LOAD ASSETS` loose-files + `LOAD
  PACK` `webkitdirectory`), but they are **pure renderer-side `File` ingestion
  — session memory only, zero disk persistence, zero IPC**. Nothing the user
  loads today survives a restart.
- **The disk model is already half-specified**: `ITheiaPackManifest`
  (`pack.theiapack.json`) and `ITheiaPack.rootPath` exist in
  `src/types/theiaTypes.ts` but have **zero consumers** — dead spec waiting
  for this wave.

---

## Mission 1 — Current Backend File Manager

### 1.1 `userData` layout (existing conventions)

| Root | Contents | Scan depth | Writer |
|---|---|---|---|
| `userData/arsenal/` | `**/*.lfx` (v3 JSON clips) organized freely by subfolder (`arsenal/techno/`, `arsenal/latin/`…, WAVE 2524) | **recursive** | `HephFileIO.saveClip`, `genesisIpc`, `KeyForgeIPCHandlers` |
| `userData/fixtures/` | `**/*.json` fixture defs (`.fxt` ignored in live scan, WAVE 7605) | **recursive** | fixture library IPC |
| `userData/ingenios/system/` + `user/` | `*.luxingenio` (factory read-only / user writable) | flat | Ingenio IPC |
| `userData/vibes/` | `*.luxvibe` custom vibes | flat | `VibeLabPersistence` (atomic tmp+rename write) |
| `userData/LuxSync_Telemetry/` | `liquid_*.jsonl` | flat | `LiquidTelemetryRecorder` |
| `userData/luxsync-config.json`, `selene-genesis.db` | singleton files | — | `ConfigManagerV2`, `GenesisVaultService` |
| **`.lux` shows** | arbitrary path via **native Save/Open dialog** — *no* folder root | n/a | `ChronosIPCHandlers` (`chronos:save-project`, `chronos:load-project`) |

Pattern: assets the user *collects* live in a dedicated `userData/<domain>/`
folder scanned at boot/on-demand; assets the user *authors as documents* go
through `dialog.showSaveDialog/showOpenDialog`.

### 1.2 The scanners (exact signatures)

**① `LfxFileLoader._loadDirectoryRecursive`** — the one to mirror
`src/core/arsenal/LfxFileLoader.ts:216`

```ts
private async _loadDirectoryRecursive(
  dirPath: string, source: EffectSource,
): Promise<LoadReport>   // { scanned, accepted, rejected, errors, entries[] }
```

- `await fs.readdir(dirPath, { withFileTypes: true })` — **async** (non-blocking).
- `dirent.isDirectory()` → recurse; `dirent.name.toLowerCase().endsWith('.lfx')`
  → `loadFile()` → `HephaestusClipIndex.upsert` (RAM index + SHA-256 G2 gate)
  → `DynamicEffectRegistry.registerEffectV3`.
- **Fail-silent policy** (WAVE 2483): malformed file → `console.warn` + reject,
  loader never crashes. `MAX_FILE_SIZE_BYTES = 256KB` per file.
- Missing root → silent skip (`fsSync.existsSync` guard).
- Boot chain (`electron/main.ts` ~L749-919): arsenal dir → builtin bootstrap
  (`.builtin-manifest.json` diff-copy into `userData/arsenal/` on first run)
  → `new LfxFileLoader(getDynamicEffectRegistry()).loadAll([{absolutePath, source:'user'}])`.

**② `scanFixtureFolderRecursive`** — the IPC-facing twin
`src/core/orchestrator/IPCHandlers.ts:1215`

```ts
async function scanFixtureFolderRecursive(dirPath: string): Promise<any[]>
```

- `fs.readdirSync(dirPath, { withFileTypes: true })` — **sync** (blocks main;
  flagged historically, WAVE 7555 only fixed FXTParser).
- Recurses all subdirs **except literal `factory`/`custom`** (WAVE 7604c:
  "user organizes freely", legacy split dirs skipped).
- `.json` → `readFileSync` + `JSON.parse`; corrupt → `console.warn` skip.
  Returns `[{...fixture, filePath}]`.
- Root: `getFixturesPath()` → `path.join(app.getPath('userData'), 'fixtures')`.
- `rescanAllLibraries()` (`electron/main.ts:341`) is an **inline duplicate**
  with the same semantics — the boot-time variant.

**③ `FXTParser.scanFolder`** — flat, OFL import tool only
`src/core/library/FXTParser.ts:575`

```ts
async scanFolder(folderPath: string): Promise<ParsedFixture[]>
```

- `fs.promises.readdir` (no dirents) → **flat, no recursion**. `.fxt`/`.json`,
  `Promise.all` parallel parse. Never called by the live library scan (WAVE 7605).

**④ `scanIngeniFolder(folderPath, source)`** — flat
`src/core/orchestrator/IPCHandlers.ts:~1393` — `.luxingenio`, returns
`{...parsed, _source, _filePath}`. Feeds the `ingenios/system|user` two-tier.

**⑤ `HephaestusClipIndex`** — the in-memory index pattern
`src/core/hephaestus/HephaestusClipIndex.ts:104`

`upsert(filePath, source)` (reads+parses+caches), `getById`, `getByPath`,
`getAllMetadata` (drives `heph:list` → metadata-only payload), `remove`,
`clear`, **`onDidChange(cb): unsubscribe`** — observer fired on
upsert/remove/clear. Wired in `main.ts:966` to broadcast registry changes.

### 1.3 Main → Renderer transport

All channels are `ipcMain.handle` + `ipcRenderer.invoke` exposed through
`contextBridge` (`electron/preload.ts` → `window.lux.*`). Push events use
`safeWebSend(win, channel, payload)` / `webContents.send`.

| Channel | Direction | Payload shape |
|---|---|---|
| `lux:library:list-all` | invoke | `{ success, systemFixtures: [], userFixtures: Fixture[] }` — full parsed JSON + injected `filePath` |
| `lux:scan-fixtures` | invoke | `{ success, fixtures }` (cached lib if no path arg) |
| `fixtures:scanLibrary` | invoke | `{ success, fixtures }` (via `fxtParser.scanFolder`) |
| `heph:list` | invoke | `HephClipMetadata[]` — **metadata only** (no clip body; index-backed O(1)) |
| `heph:load` | invoke | full clip object by id-or-path |
| `heph:getPath` | invoke | arsenal root string |
| `chronos:save/load-project` | invoke | `{ success, json, path }` / `{ success, filePath }` (native dialogs) |
| `lux:theia:exportAsset` | invoke | `{ success, filePath }` — Save As dialog → `fs.promises.writeFile` (`.theia`) |
| `lux:fixtures-loaded` | **push** | patched-fixture array on every mutation |
| `theia:telemetry-port` / `theia:video-port` | **MessagePort** | binary ports (hot telemetry / video frames) — existing precedent for high-volume channels |

**Path-safety precedent** (`lux:delete-fixture-definition`, IPCHandlers.ts:1163):
`normalizedId.startsWith(path.normalize(fixturesPath))` — root-containment
check before honoring an absolute path from the renderer.

### 1.4 Shows vs fixtures vs arsenal — reuse verdict

They do **not** share one scanner; each domain has its own wrapper:

- `.lfx` arsenal → `LfxFileLoader` (async, gated, indexed)
- `.json` fixtures → `scanFixtureFolderRecursive` + `rescanAllLibraries` (sync duplicates)
- `.lux` shows → dialog-based, no scan
- `.luxvibe` / `.luxingenio` → flat dedicated scans

**Best reuse candidate for Theia**: the `_loadDirectoryRecursive` *idiom*
(async dirents, extension filter, per-file try/catch, recurse-everything,
fail-silent report). The fixture scanner is sync and injects a legacy
dirname blocklist — don't clone that part.

---

## Mission 2 — Theia Packs pipeline (design, NOT implemented)

### 2.1 What the UI already does (the "par de loaders" PD confirms this)

`src/components/views/TheiaEngineView/index.tsx:356-391`:

- **LOAD ASSETS** (`fileInputRef`): `<input type=file multiple
  accept=".mp4,.webm,.mkv,.mov,.avi,.theia,.glsl">` → loose files.
- **LOAD PACK** (`packInputRef`): same input + injected `webkitdirectory` →
  whole folder; `webkitRelativePath` first segment becomes `packId`.

Both funnel into `useTheiaPackStore.ingestFiles(files)` (`src/stores/
useTheiaPackStore.ts:325`): `File` objects → `file.text()` →
`parseEuclidMeta` → `buildGlslAtom` (`source.kind:'shader'`, GLSL embedded in
the atom, `filePath` = symbolic `file://name`) / `.theia` JSON schema check /
video blob URLs. **Session-memory only** — `ITheiaPack.pending=true`,
`rootPath=''`. Restart = gone.

### 2.2 Proposed `userData` layout (consistent with conventions)

```
userData/theia/
├── packs/
│   ├── <packId>/                  ← one folder = one Pack (arsenal-style)
│   │   ├── pack.theiapack.json    ← optional manifest (type already defined)
│   │   ├── <atomId>.glsl
│   │   ├── <atomId>.theia
│   │   └── media/…                ← nested subfolders allowed (WAVE 2524 rule)
│   └── …
└── loose/                          ← standalone .glsl not in a pack
    └── *.glsl
```

Optional two-tier (mirrors `ingenios/system|user`): `packs/factory/` seeded
with the 13 Opus atoms + `packs/user/` writable. If Opus atoms stay as `?raw`
bundled imports, a single `packs/` root suffices.

### 2.3 Mapping the existing recursive scan onto `.glsl`

Using the `_loadDirectoryRecursive` idiom on `userData/theia/`:

- **Filter**: `dirent.name.toLowerCase().endsWith('.glsl' || '.theia')`;
  skip `pack.theiapack.json`, hidden dotfiles, non-file dirents.
- **Grouping**: each immediate child dir of `packs/` = one `ITheiaPack`
  (`packId` = dirname, `rootPath` = absolute path). Deeper nesting folds into
  the owning pack (like arsenal's vibe subfolders). Files in `loose/` →
  virtual pack or `pending`-style atoms with `packId` derived from a loose
  bucket (e.g. `Loose`/`_library`).
- **Manifest**: if `pack.theiapack.json` present at pack root → parse
  `ITheiaPackManifest` (`displayName`, `accentColor`, `atomOrder`); absent →
  zero-conf Pack (per the existing type comment).
- **Metadata vs content**: two viable transports —
  1. *Eager* (arsenal-style): scan returns `{packId, atoms:[{fileName,
     relPath, glsl}]}`, GLSL text inline (~10-30KB each is trivial over IPC).
     Renderer calls the existing `buildGlslAtom(fileName, glsl, packId)` +
     `upsertPack` — **zero new parsing logic needed**, `parseEuclidMeta`
     already runs renderer-side.
  2. *Lazy* (heph-style): scan returns metadata only (`heph:list` pattern),
     atoms hydrated per file via a `theia:read-atom` invoke — needed only if
     libraries grow large or video previews enter the tree.
- **New IPC needed** (none exists for this today): propose
  `theia:library:scan` → pack tree; optional `theia:library:readFile`
  (root-boundary-checked path → text); push `theia:library-changed` for the
  gallery refresh (mirrors `lux:fixtures-loaded`).

### 2.4 Safety constraints (precedents already in repo)

| Risk | Existing precedent to copy |
|---|---|
| Path traversal | `lux:delete-fixture-definition` root-containment check |
| File size | `LfxFileLoader.MAX_FILE_SIZE_BYTES` (256KB); `.lux` 50MB cap |
| Malformed payload | WAVE 2483 fail-silent: warn + reject, never crash |
| Extension case | `.toLowerCase().endsWith()` (LfxFileLoader) |
| Missing root | `existsSync` guard + `mkdirSync(recursive)` auto-create |
| Duplicate atom ids | `glsl_<basename>` collisions across packs — needs packId prefixing or last-write-wins dedup rule |
| Absent `@euclid` meta | `buildGlslAtom` already defaults neutral genome — no parser failure path |
| Write atomics | `VibeLabPersistence` tmp+rename pattern |

---

## Mission 3 — Hot reload / watchers

**Verdict: no reusable watcher exists.**

- `chokidar`: not in `package.json`, not imported anywhere.
- `fs.watch` / `fs.watchFile`: zero references in `src/` and `electron/`.
- `HephaestusClipIndex.onDidChange` (HephaestusClipIndex.ts:115) is the
  closest mechanism — an **in-memory** observer, fires only on app-driven
  `upsert`/`remove`/`clear`. External filesystem edits are invisible until
  the next explicit rescan.
- Renderer refresh model today: pull on demand (`lux:library:list-all`,
  `heph:list`) or push after app-driven mutations (`lux:fixtures-loaded`).

**Design note (future wave)**: a `chokidar` watch on `userData/theia/packs/`
with debounced coalescing → rescan → `safeWebSend('theia:library-changed',
tree)` would slot into the existing push convention. Until then, an explicit
"rescan" invoke at view-mount and/or post-import matches current behavior.

---

## Reuse map — what Theia inherits verbatim vs. adapts

| Piece | Reuse? | Notes |
|---|---|---|
| `_loadDirectoryRecursive` idiom | ✅ pattern | async dirents + fail-silent + recurse-all |
| `HephaestusClipIndex` index+`onDidChange` | ✅ pattern | RAM index + change broadcast for gallery refresh |
| `buildGlslAtom` / `ingestFiles` | ✅ direct | already renderer-side text→atom; disk path only feeds it text+packId |
| `ITheiaPackManifest` / `rootPath` / `pending` | ✅ direct | dead spec, ready to activate |
| `TheiaFileLoader` (`.theia` gates A1-A5) | ⚠️ partial | takes strings, no fs; `_normalize` predates `source.kind` — check field parity before reuse |
| `scanFixtureFolderRecursive` (sync, `factory/custom` blocklist) | ❌ semantics only | sync-in-main + legacy skips — not to be cloned |
| `FXTParser.scanFolder` | ❌ | flat, OFL-specific |
| File watcher | ❌ none exists | must be designed (chokidar candidate) |
| `.lux` dialog pipeline | ➖ unrelated | single-file documents, not libraries |
| `?raw` Opus imports | keep for builtins | `opusLibrary.ts` stays as factory seed or fallback |

---

*Audit performed read-only. No source files modified.*
