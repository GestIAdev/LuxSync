# WAVE 377: SYNAPTIC BRIDGE & CALIBRATION UI

**Date:** 2026-01-13  
**Status:** ✅ COMPLETE  
**Objective:** Connect the nervous system between Frontend and Backend

---

## 🎯 MISSION

The system had a brain (Arbiter) and body (UI), but the nervous system was severed. This wave:

1. **TitanSyncBridge** - Auto-sync `stageStore` → Backend when fixtures change
2. **Calibration Button** - UI control for entering calibration mode on movers
3. **IPC Handlers** - Backend support for calibration + fixture sync

---

## 📦 FILES CREATED

### `src/core/sync/TitanSyncBridge.tsx`
**Purpose:** Invisible React component that watches `stageStore.fixtures` and syncs to backend.

**Architecture:**
- Uses Zustand's `subscribeWithSelector` to watch `fixtures` array
- Debounces changes (500ms) to prevent IPC flooding when dragging
- Generates hash of fixtures to detect actual content changes
- Sends `lux:arbiter:setFixtures` to backend MasterArbiter

**Usage:**
```tsx
// In App.tsx
<TitanSyncBridge />  // Invisible, mounts once
```

### `src/core/sync/index.ts`
Module export for sync components.

---

## 📦 FILES MODIFIED

### `src/core/arbiter/ArbiterIPCHandlers.ts`
**Added handlers:**
- `lux:arbiter:enterCalibrationMode` - Enter calibration mode for fixture
- `lux:arbiter:exitCalibrationMode` - Exit calibration with smooth crossfade
- `lux:arbiter:isCalibrating` - Check if fixture is in calibration mode
- `lux:arbiter:setFixtures` - Sync fixtures from frontend (TitanSyncBridge)

### `electron/preload.ts`
**Added to `arbiter` object:**
```typescript
arbiter: {
  // ... existing
  enterCalibrationMode: (fixtureId: string) => ...
  exitCalibrationMode: (fixtureId: string) => ...
  isCalibrating: (fixtureId: string) => ...
}
```

### `src/components/programmer/PositionSection.tsx`
**Added:**
- `isCalibrating` state
- `handleCalibrationToggle` callback
- 🎯 Calibrate button with pulsing animation when active
- Patterns disabled during calibration mode
- Calibration badge overlay

### `src/components/programmer/TheProgrammer.css`
**Added styles:**
- `.programmer-section.calibrating` - Red pulsing border
- `.calibrate-btn` - Target icon button
- `.calibrate-btn.active` - Blinking red state
- `.calibration-badge` - Mode indicator
- `@keyframes calibration-pulse` - Section animation
- `@keyframes calibrate-blink` - Button blink

### `src/App.tsx`
**Added:**
- Import `TitanSyncBridge`
- Mount `<TitanSyncBridge />` in render (invisible)

### `docs/WAVE-372.5-ARBITER-BLUEPRINT.md`
**Updated checklist:**
- Phase 3 items marked complete
- Added WAVE 377 references

---

## 🔌 DATA FLOW

```
┌─────────────────┐
│   stageStore    │ ← User adds/moves/removes fixtures
│   (Frontend)    │
└────────┬────────┘
         │ useEffect + debounce (500ms)
         ▼
┌─────────────────┐
│ TitanSyncBridge │ ← Invisible component
│   (Frontend)    │
└────────┬────────┘
         │ IPC: lux:arbiter:setFixtures
         ▼
┌─────────────────┐
│  MasterArbiter  │ ← setFixtures() updates internal map
│   (Backend)     │
└────────┬────────┘
         │ arbitrate() uses fixtures for calculations
         ▼
┌─────────────────┐
│      HAL        │ → DMX Output
└─────────────────┘
```

---

## 🎯 CALIBRATION FLOW

```
User clicks 🎯 button
       │
       ▼
enterCalibrationMode(fixtureId)
       │
       ▼
┌─────────────────────────────┐
│ MasterArbiter sets override │
│ source: 'calibration'       │
│ priority: 200 (high)        │
│ channels: ['pan', 'tilt']   │
└─────────────────────────────┘
       │
       ▼
User adjusts XY Pad
       │
       ▼
setManual() updates position
       │
       ▼
User clicks 🎯 again (exit)
       │
       ▼
exitCalibrationMode(fixtureId)
       │
       ▼
┌─────────────────────────────┐
│ 1s crossfade back to AI     │
│ releaseManualOverride()     │
└─────────────────────────────┘
```

---

## 🖼️ UI APPEARANCE

### Normal State
```
┌──────────────────────────────────────┐
│ 🕹️ POSITION                     [🎯] │  ← Gray target button
├──────────────────────────────────────┤
│        ┌─────────┐                   │
│        │  XY Pad │                   │
│        └─────────┘                   │
│ [Static] [Circle] [Eight] [Sweep]    │
│ Pan: 270°   Tilt: 135°              │
└──────────────────────────────────────┘
```

### Calibrating State
```
╔══════════════════════════════════════╗  ← Red pulsing border
║ 🕹️ POSITION 🎯 CALIBRATING    [🎯*] ║  ← Blinking button
╠══════════════════════════════════════╣
║        ┌─────────┐                   ║
║        │  XY Pad │                   ║
║        └─────────┘                   ║
║                                      ║  ← Patterns hidden
║ Pan: 270°   Tilt: 135°              ║
║              [🎯 CALIBRATION MODE]   ║  ← Badge
╚══════════════════════════════════════╝
```

---

## ✅ BUILD STATUS

```
✓ 2143 modules transformed
✓ Built in 8.01s
✓ Electron builder complete
```

---

## 🔗 CONNECTIONS

- **Depends on:** WAVE 375 (Arbiter UI), WAVE 376 (Arbiter Brain)
- **Enables:** Real-time stage sync, calibration workflow
- **Next:** WAVE 378 (TBD)

---

**WAVE 377 Status:** ✅ COMPLETE

*"El sistema nervioso conecta cerebro y cuerpo. Ahora el organismo respira."* 🌉
