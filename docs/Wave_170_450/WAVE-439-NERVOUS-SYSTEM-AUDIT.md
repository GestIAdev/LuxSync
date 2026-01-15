# WAVE 439 - NERVOUS SYSTEM AUDIT

**Status**: ✅ COMPLETE  
**Agent**: PunkOpus  
**Date**: 2026-01-15  
**Objective**: Complete audit of Frontend ↔ Backend control pipeline wiring

---

## 🎯 MISSION

After WAVE 438.1 fixed the IPC listener initialization bug, we discovered potential type mismatches in the control pipeline. This audit maps:

1. All UI controls → IPC calls → Backend handlers
2. Type mismatches (frontend sending wrong keys/ranges)
3. Value range overflows (16-bit vs 8-bit)
4. Complete data flow for all control types

---

## 🔍 BACKEND EXPECTATIONS (Ground Truth)

### ArbiterIPCHandlers.ts

```typescript
// Handler signature (line 129)
ipcMain.handle('lux:arbiter:setManual', async (_, { fixtureIds, controls, channels }) => {
  // fixtureIds: string[]
  // controls: Record<string, number>  // 0-255 range (8-bit DMX)
  // channels: string[]                 // ChannelType[]
  // NOTE: Backend does NOT accept 'source' parameter
})
```

### types.ts - ManualControls Interface

```typescript
interface ManualControls {
  dimmer?: number       // 0-255
  red?: number          // 0-255  (NOT 'r')
  green?: number        // 0-255  (NOT 'g')
  blue?: number         // 0-255  (NOT 'b')
  white?: number        // 0-255
  pan?: number          // 0-255  (NOT 0-65535!)
  tilt?: number         // 0-255  (NOT 0-65535!)
  zoom?: number         // 0-255
  focus?: number        // 0-255
  gobo?: number         // 0-255
  prism?: number        // 0-255
}
```

**CRITICAL**: Backend expects ALL values in **0-255 range** (8-bit DMX byte values)

---

## 🔌 FRONTEND CONTROLS AUDIT

### 1️⃣ PROGRAMMER CONTROLS (TheProgrammerContent.tsx)

#### ✅ IntensitySection - CONVERSION OK

**Interface:**
- Receives: `value: number` (0-100)
- Emits: `onChange(value: number)` (0-100)

**Handler (line 105):**
```typescript
controls: { dimmer: Math.round(value * 2.55) },  // ✅ CORRECT: 0-100 → 0-255
source: 'ui_programmer',  // ⚠️ EXTRA PARAMETER (ignored by backend)
```

**Status**: ✅ Math is correct, ⚠️ has extra `source` param

---

#### 🔴 ColorSection - CRITICAL: WRONG KEYS

**Handler (line 134):**
```typescript
controls: { r, g, b },  // ❌ WRONG KEYS
channels: ['red', 'green', 'blue'],  // ✅ Channels are correct
source: 'ui_programmer',  // ⚠️ EXTRA PARAMETER
```

**Bug**: 
- Frontend sends: `{ r: 255, g: 128, b: 64 }`
- Backend expects: `{ red: 255, green: 128, blue: 64 }`
- Channels say `['red', 'green', 'blue']` but controls use `{r, g, b}`

**Impact**: Color control is **100% NON-FUNCTIONAL** - backend receives undefined values

---

#### 🔴 PositionSection - CRITICAL: 16-BIT OVERFLOW

**XYPad/RadarXY components** (controls/XYPad.tsx, controls/RadarXY.tsx):
```typescript
// ✅ These are CLEAN - they emit degrees:
const newPan = Math.round(x * 540)   // 0-540°
const newTilt = Math.round(y * 270)  // 0-270°
onChange(newPan, newTilt)
```

**PositionSection Handler (line 119):**
```typescript
controls: {
  pan: Math.round((newPan / 540) * 65535),   // ❌ 16-bit: 0-65535
  tilt: Math.round((newTilt / 270) * 65535), // ❌ 16-bit: 0-65535
},
source: 'ui_programmer',  // ⚠️ EXTRA PARAMETER
```

**Bug**: 
- Frontend sends: 0-65535 (16-bit range)
- Backend expects: 0-255 (8-bit DMX range)
- **Overflow factor**: 256x too large!

**Impact**: Position values cause **erratic moving head behavior** - values wrap around

**Occurrences**: This bug appears in **4 handlers**:
1. `handlePositionChange` (line 119) - Direct XY control
2. `handlePatternChange` (line 158) - Circle/Eight/Sweep patterns
3. `handleFanChange` (line 214) - Formation fan spread (loop with individual fixture calls)
4. Ghost point calculations (all use same 65535 multiplier)

---

#### ✅ BeamSection - VALUES OK

**Handler (line 90):**
```typescript
controls: values,  // ✅ CORRECT: Sliders already output 0-255
source: 'ui_programmer',  // ⚠️ EXTRA PARAMETER
```

**Status**: ✅ Values are correct, ⚠️ has extra `source` param

---

### 2️⃣ CALIBRATION VIEW (CalibrationView/)

#### 🔴 CalibrationView/index.tsx - 16-BIT OVERFLOW

**RadarXY component** (CalibrationView/components/RadarXY.tsx):
```typescript
// ✅ CLEAN - emits degrees:
const newPan = Math.round(x * 540)   // 0-540°
const newTilt = Math.round(y * 270)  // 0-270°
onChange(newPan, newTilt)
```

**Handler (line 77):**
```typescript
controls: {
  pan: Math.round((newPan / 540) * 65535),   // ❌ 16-bit overflow
  tilt: Math.round((newTilt / 270) * 65535), // ❌ 16-bit overflow
},
source: 'calibration_view',  // ⚠️ EXTRA PARAMETER
```

**Impact**: Calibration sends **256x oversized values** → calibration is useless

---

#### 🔴 CalibrationView/TestPanel.tsx - TOTAL OVERFLOW DISASTER

**Handler (line 71):**
```typescript
// ALL VALUES IN 16-BIT RANGE:
controls.dimmer = 65535      // ❌ Backend expects 0-255
controls.red = 65535         // ❌ Backend expects 0-255
controls.green = 65535       // ❌ Backend expects 0-255
controls.blue = 65535        // ❌ Backend expects 0-255
controls.white = 65535       // ❌ Backend expects 0-255
controls.strobe = 50000      // ❌ Backend expects 0-255
controls.gobo = 10000        // ❌ Backend expects 0-255

source: 'calibration_test',  // ⚠️ EXTRA PARAMETER
```

**Impact**: **ALL fixture tests completely broken** - values overflow, wrap, or saturate

---

## 📋 COMPLETE BUG INVENTORY

### 🔴 CRITICAL BUGS (System Non-Functional)

| # | File | Line | Bug | Impact |
|---|------|------|-----|--------|
| 1 | TheProgrammerContent.tsx | 134 | `{r,g,b}` instead of `{red,green,blue}` | **Color control 100% broken** |
| 2 | TheProgrammerContent.tsx | 119 | `pan/tilt * 65535` instead of `* 255` | **Moving heads erratic** |
| 3 | TheProgrammerContent.tsx | 158 | `pan/tilt * 65535` (pattern mode) | **Patterns broken** |
| 4 | TheProgrammerContent.tsx | 214 | `pan/tilt * 65535` (fan mode) | **Formations broken** |
| 5 | CalibrationView/index.tsx | 77 | `pan/tilt * 65535` | **Calibration useless** |
| 6 | CalibrationView/TestPanel.tsx | 50-67 | All values 16-bit (65535, 50000, 10000) | **Fixture tests broken** |

### ⚠️ MINOR ISSUES (Ignored but Dirty)

| # | Files | Issue | Impact |
|---|-------|-------|--------|
| 7 | All control handlers | `source: 'ui_programmer'` etc. | Ignored by backend, shows spec drift |

---

## 🩺 SURGICAL FIXES REQUIRED

### Fix 1: Color Keys - TheProgrammerContent.tsx

**Location**: Line 134-141

```diff
  await window.lux?.arbiter?.setManual({
    fixtureIds: selectedIds,
-   controls: { r, g, b },
+   controls: { red: r, green: g, blue: b },
    channels: ['red', 'green', 'blue'],
-   source: 'ui_programmer',
  })
```

---

### Fix 2: Position Range - TheProgrammerContent.tsx (3 locations)

**Location 1**: `handlePositionChange` (line 119-126)
```diff
  controls: {
-   pan: Math.round((newPan / 540) * 65535),
-   tilt: Math.round((newTilt / 270) * 65535),
+   pan: Math.round((newPan / 540) * 255),
+   tilt: Math.round((newTilt / 270) * 255),
  },
  channels: ['pan', 'tilt'],
- source: 'ui_programmer',
```

**Location 2**: `handlePatternChange` (line 158-166)
```diff
  controls: {
-   pan: Math.round((pan / 540) * 65535),
-   tilt: Math.round((tilt / 270) * 65535),
+   pan: Math.round((pan / 540) * 255),
+   tilt: Math.round((tilt / 270) * 255),
    // Pattern params...
  },
  channels: ['pan', 'tilt'],
- source: 'ui_programmer',
```

**Location 3**: `handleFanChange` (line 214-220)
```diff
  controls: {
-   pan: Math.round((fixturePan / 540) * 65535),
-   tilt: Math.round((fixtureTilt / 270) * 65535),
+   pan: Math.round((fixturePan / 540) * 255),
+   tilt: Math.round((fixtureTilt / 270) * 255),
  },
  channels: ['pan', 'tilt'],
- source: 'ui_programmer',
```

---

### Fix 3: Calibration Position - CalibrationView/index.tsx

**Location**: Line 77-82

```diff
  controls: {
-   pan: Math.round((newPan / 540) * 65535),
-   tilt: Math.round((newTilt / 270) * 65535),
+   pan: Math.round((newPan / 540) * 255),
+   tilt: Math.round((newTilt / 270) * 255),
  },
  channels: ['pan', 'tilt'],
- source: 'calibration_view',
```

---

### Fix 4: Test Panel Values - CalibrationView/TestPanel.tsx

**Location**: Line 50-67

```diff
  switch (testType) {
    case 'dimmer':
-     controls.dimmer = 65535
+     controls.dimmer = 255
      break
      
    case 'white':
-     controls.dimmer = 65535
-     controls.red = 65535
-     controls.green = 65535
-     controls.blue = 65535
-     controls.white = 65535
+     controls.dimmer = 255
+     controls.red = 255
+     controls.green = 255
+     controls.blue = 255
+     controls.white = 255
      break
      
    case 'strobe':
-     controls.dimmer = 65535
-     controls.strobe = 50000
-     controls.white = 65535
+     controls.dimmer = 255
+     controls.strobe = 195    // ~76% of 255
+     controls.white = 255
      break
      
    case 'gobo':
-     controls.dimmer = 65535
-     controls.gobo = 10000
-     controls.white = 65535
+     controls.dimmer = 255
+     controls.gobo = 39       // ~15% of 255
+     controls.white = 255
      break
  }
  
  await window.lux?.arbiter?.setManual({
    fixtureIds: [fixtureId],
    controls,
    channels: Object.keys(controls),
-   source: 'calibration_test',
  })
```

---

## 📊 FINAL AUDIT TABLE

| Component | File | Frontend Sends | Backend Expects | Status |
|-----------|------|---------------|-----------------|--------|
| **Intensity** | TheProgrammerContent | `dimmer: 0-255` ✅ | `dimmer: 0-255` | ✅ OK + extra param |
| **Color** | TheProgrammerContent | `{r,g,b}` ❌ | `{red,green,blue}` | 🔴 **BROKEN** |
| **Position (XY)** | TheProgrammerContent | `pan/tilt: 0-65535` ❌ | `pan/tilt: 0-255` | 🔴 **BROKEN** |
| **Position (Pattern)** | TheProgrammerContent | `pan/tilt: 0-65535` ❌ | `pan/tilt: 0-255` | 🔴 **BROKEN** |
| **Position (Fan)** | TheProgrammerContent | `pan/tilt: 0-65535` ❌ | `pan/tilt: 0-255` | 🔴 **BROKEN** |
| **Beam** | TheProgrammerContent | `0-255` ✅ | `0-255` | ✅ OK + extra param |
| **Calibration XY** | CalibrationView/index | `pan/tilt: 0-65535` ❌ | `pan/tilt: 0-255` | 🔴 **BROKEN** |
| **Test Panel** | CalibrationView/TestPanel | All `0-65535` ❌ | All `0-255` | 🔴 **BROKEN** |
| **XYPad** | controls/XYPad | Emits degrees ✅ | N/A (presentational) | ✅ CLEAN |
| **RadarXY (Prog)** | controls/RadarXY | Emits degrees ✅ | N/A (presentational) | ✅ CLEAN |
| **RadarXY (Cal)** | CalibrationView/RadarXY | Emits degrees ✅ | N/A (presentational) | ✅ CLEAN |

---

## 🔥 DAMAGE ASSESSMENT

### Working ✅
- Dimmer control (intensity)
- Beam controls (gobo, prism, focus, zoom, iris)
- XYPad/RadarXY UI components (presentational layer)

### Completely Broken 🔴
- **Color control** (wrong keys → undefined values)
- **All position control** (256x overflow → wraparound/saturation)
- **Pattern movement** (circle, eight, sweep)
- **Formation fan spread** (multi-fixture positioning)
- **Calibration mode** (position overflow)
- **All fixture tests** (dimmer, white, strobe, gobo tests)

### Severity
**6 critical bugs** affecting **~80% of control functionality**

---

## ⚡ NEXT WAVE

**WAVE 439.5 - PIPELINE SURGERY**  
Apply all 4 fixes to restore full control system functionality

---

**End of Audit Report**  
**Architect Review**: ⏳ PENDING
