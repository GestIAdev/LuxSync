Continuing. Now remove `librerias` from extraResources in package.json:

Now clean up the COMMIT_MSG.txt and check for other references to the old pathfinder deps:

Now check the IPCDependencies interface — `getFactoryLibPath` and `getCustomLibPath` are still declared but no longer used by the new handlers. Let me check if anything else uses them:

There's still usage at line 1131-1132 — the old `lux:delete-fixture-definition` handler. Let me check it:

This old `lux:delete-fixture-definition` handler also needs to be updated to use the single path. Let me replace it:

Now check the other old handler that uses `fxtParser` — `lux:save-fixture-definition` and `lux:scan-fixtures`:

Update `lux:save-fixture-definition` to use `getFixturesPath()`:

Now check `lux:scan-fixtures`:

The `lux:scan-fixtures` handler uses `fxtParser.scanFolder` when a custom path is passed. This is the OFL import tool path — that's acceptable per the directive (fxtParser retained for import). But when no path is passed, it returns cached library. That's fine. Let me leave this one as-is since it's the import tool pathway.

Now let me also check `fixtures:scanLibrary`:

`fixtures:scanLibrary` is also an explicit-scan tool (used by the import tool when user picks a folder). Leave it — that's the OFL importer pathway.

Now typecheck:

Typecheck clean. Now let me also check the renderer/frontend for references to `systemFixtures` to make sure the empty array doesn't break anything:

The frontend uses `systemFixtures` extensively. Since we return `systemFixtures: []` (empty array), the frontend will just see zero system fixtures and all fixtures in `userFixtures`. This is backward-compatible — the frontend code won't crash, it'll just show all fixtures as user fixtures. That's exactly the intent.

Let me verify the libraryStore handles this correctly:

The frontend merges `[...systemFixtures, ...userFixtures]` — with `systemFixtures: []`, all fixtures come from `userFixtures`. Fully backward-compatible.

Now let me verify the final state of the key files:

Now let me also clean up the `initializeVaults` function if it creates the old `factory/custom` subfolders:

Update `initializeVaults` to remove the `factory/custom` subfolder creation:

Final typecheck:

Typecheck clean. All tasks complete. Here's the summary:

---

## WAVE 7605: SCORCHED EARTH — Summary of Deleted Logic & Patched Code

### Deleted Logic (142 lines removed from main.ts, ~120 from IPCHandlers.ts)

| Deleted | What it did | Why |
|---------|------------|-----|
| **Pathfinder** (3 candidates) | Searched `resources/librerias`, `../../librerias`, `../librerias` | Replaced by single hardcoded path |
| **Factory seeding** | Copied 16 `.fxt` files to `userData/fixtures/factory/` on first boot | No factory fixtures anymore |
| **User seeding** (dev-only) | Copied `user-*.json` from `LuxSync/fixtures/` to `userData/fixtures/` | Unnecessary — userData IS the source |
| **`factoryUserDataPath`** | `userData/fixtures/factory/` subfolder | No longer created |
| **`customLibraryPath`** distinction | Was `userData/fixtures/custom/`, then `userData/fixtures/` | Now same as `factoryLibPath` — both point to `userData/fixtures/` |
| **`.fxt` parsing in scan** | `fxtParser.parseFile()` called during live library scan | `.fxt` is now import-only |
| **Factory+Custom merge** in `rescanAllLibraries()` | Scanned both paths, merged by name | Single scan, no merge needed |
| **`extraResources: librerias`** | Bundled `LuxSync/librerias/` into production builds | Ships with ZERO factory fixtures |
| **`initializeVaults` factory/custom dirs** | Created `fixtures/factory/` and `fixtures/custom/` subfolders | Only `fixtures/` is created now |
| **`getFactoryLibPath()`/`getCustomLibPath()` usage** | 4 IPC handlers used these | Replaced by `getFixturesPath()` |

### Patched Code — The Unified Handler

**`main.ts`** — 34 lines (was 176):
```ts
const fixturesPath = path.join(app.getPath('userData'), 'fixtures')
fs.mkdirSync(fixturesPath, { recursive: true })
factoryLibPath = fixturesPath  // both point to the SAME path
customLibPath = fixturesPath
fxtParser.setLibraryPath(fixturesPath)  // for OFL import tool only
await rescanAllLibraries()
```

**`IPCHandlers.ts`** — New `getFixturesPath()`:
```ts
function getFixturesPath(): string {
  return path.join(app.getPath('userData'), 'fixtures')
}
```

**`scanFixtureFolderRecursive`** — `.json` only, no `.fxt`, no `source` param:
```ts
async function scanFixtureFolderRecursive(dirPath: string): Promise<any[]>
```

**`rescanAllLibraries()`** — Single recursive scan, no merge:
```ts
const fixturesPath = customLibPath  // = factoryLibPath = userData/fixtures/
// recursive scan, .json only, skip legacy factory/custom subfolders
```

### What's Kept

| Kept | Why |
|------|-----|
| `fxtParser` module | OFL import tool — user manually imports `.fxt` → converts to `.json` |
| `fixtures:scanLibrary` / `lux:scan-fixtures` (with custom path) | Used by import tool when user picks a folder |
| `systemFixtures: []` in response | Backward-compatible — frontend merges `[...systemFixtures, ...userFixtures]` |
| `factoryLibPath` / `customLibPath` variables | Both point to same path — avoids touching all references |

### The Result

```
userData/fixtures/                    ← THE ONLY PATH (dev = prod)
├── user-1776551819488-ul7dn8822.json ← "7 grande" lives here
├── user-1770473024494-gooaf830g.json ← "EL 1140" lives here
├── moving-heads/                     ← user organizes freely
│   └── beam-2r.json
└── (no factory/, no custom/)
```

**1 path. 1 format. 0 factory fixtures. Dev = Prod.**