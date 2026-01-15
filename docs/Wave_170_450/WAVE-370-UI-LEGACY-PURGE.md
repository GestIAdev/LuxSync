# WAVE 370: UI LEGACY PURGE & ENGLISH STANDARDIZATION

**Date:** 2026-01-12  
**Status:** ✅ COMPLETE  
**Codename:** "The Great Cleanup"

---

## 🎯 OBJECTIVE

Eliminate legacy Setup tabs and standardize UI in Professional English. The Stage Constructor is now the single source of truth for fixtures, patches, and scenes.

---

## 🔥 DEMOLITION REPORT

### Files DELETED (6 files)

```
src/components/views/SetupView/tabs/
├── PatchTab.tsx        ❌ DELETED (Fixture list - moved to Constructor)
├── PatchTab.css        ❌ DELETED
├── LibraryTab.tsx      ❌ DELETED (FXT viewer - moved to Constructor)
├── LibraryTab.css      ❌ DELETED
├── AddFixtureModal.tsx ❌ DELETED (Legacy version)
├── AddFixtureModal.css ❌ DELETED
```

### Files MODIFIED (6 files)

| File | Changes |
|------|---------|
| `SetupView/index.tsx` | Removed tab navigation, DevicesTab only |
| `SetupView/SetupLayout.tsx` | Eliminated SetupTabsNavigation component |
| `SetupView/SetupStatusBar.tsx` | Connected to `stageStore.showFile.name` |
| `SetupView/tabs/index.ts` | Removed PatchTab, LibraryTab, AddFixtureModal exports |
| `SetupView/tabs/AudioConfig.tsx` | Removed GainSlider, added AGC note |
| `stores/setupStore.ts` | Removed SetupTab type, tab navigation, currentShowName |

---

## 📝 DETAILED CHANGES

### 1. SetupView Simplification

**Before:**
```tsx
const SetupView: React.FC = () => {
  const activeTab = useSetupStore((s) => s.activeTab)
  return (
    <SetupLayout>
      {activeTab === 'devices' && <DevicesTab />}
      {activeTab === 'patch' && <PatchTab />}
      {activeTab === 'library' && <LibraryTab />}
    </SetupLayout>
  )
}
```

**After:**
```tsx
const SetupView: React.FC = () => {
  return (
    <SetupLayout>
      <DevicesTab />
    </SetupLayout>
  )
}
```

### 2. StatusBar Real Connection

**Before:** `useSetupStore((s) => s.currentShowName)` → "Default.json"

**After:** `useStageStore((s) => s.showFile?.name)` → Actual loaded .luxshow file

### 3. AudioConfig Cleanup

**Removed:**
- `GainSlider` component (90 lines)
- `inputGain` state from audioStore
- Manual gain persistence

**Added:**
- AGC (Auto Gain Control) indicator
- Professional English descriptions

### 4. setupStore Cleanup

**Removed:**
- `SetupTab` type
- `activeTab` state
- `setActiveTab()` action
- `currentShowName` state
- `setCurrentShowName()` action
- `selectActiveTab` selector

---

## 🌍 ENGLISH STANDARDIZATION

| Spanish | English |
|---------|---------|
| Demo sin hardware | Demo without hardware |
| Loopback del sistema | System loopback |
| Entrada de mic | Mic input |
| Permiso denegado. Usando simulación. | Permission denied. Using simulation. |

---

## ✅ VERIFICATION

```bash
npm run build  # ✅ SUCCESS
```

- No TypeScript errors
- No orphan imports
- Documentation references preserved (historical)

---

## 🏗️ ARCHITECTURE AFTER PURGE

```
SETUP VIEW (SetupView)
├── SetupStatusBar
│   ├── Mini VU Meter + "AUDIO INPUT"
│   ├── "SHOW: [stageStore.showFile.name]"  ← REAL CONNECTION
│   └── DMX Status (ONLINE/OFFLINE)
│
└── DevicesTab (DevicesTab.tsx)
    ├── AudioConfig
    │   ├── Source Selector (Simulation/System/Mic)
    │   ├── VU Meter with bands
    │   └── AGC Note (no manual gain)
    │
    └── DMXConfig
        ├── Driver Selector (USB/ArtNet/Virtual)
        └── Port Configuration


STAGE CONSTRUCTOR (StageConstructorView)
├── ConstructorToolbar (File I/O, tools)
├── StageGrid3D (3D canvas with fixtures)
├── LibrarySidebar (FXT drag source)  ← REPLACES LibraryTab
└── GroupManagerPanel (selection groups)  ← REPLACES PatchTab
```

---

## 📊 METRICS

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| SetupView tabs | 3 | 1 | -66% |
| Files in tabs/ | 11 | 5 | -55% |
| Lines in AudioConfig | 306 | 232 | -74 |
| Lines in setupStore | 172 | 136 | -36 |

**Total Lines Deleted:** ~1,500+

---

## 🔮 WHAT'S NEXT

- Stage Constructor is now the single source for:
  - Fixture patching (drag from library)
  - Group management (BoxSelect → Create Group)
  - Scene creation (future WAVE)
  
- Setup is now focused ONLY on:
  - Audio Input configuration
  - DMX Output configuration

---

**Commit:** `WAVE 370: UI Legacy Purge - Eliminated Setup tabs, standardized English`

*"Less is more. The Constructor rules all."* 🔥
