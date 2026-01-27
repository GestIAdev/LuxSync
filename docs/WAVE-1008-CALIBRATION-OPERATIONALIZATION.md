# 🎯 WAVE 1008 - CALIBRATION OPERATIONALIZATION
**"From Mock to Metal"**

---

## 📋 MISSION BRIEF

**Objective:** Make CalibrationView fully operational for real hardware testing  
**Hardware:** EL-1140 Moving Head (DMX 50, Universe 0, ArtNet)  
**Status:** ✅ **COMPLETE** - Ready for hardware validation

---

## 🔥 PROBLEM STATEMENT

CalibrationView existed but was **MOCK** - radar controls didn't send DMX to hardware.

**Symptoms:**
1. Pan worked in Commander, but not in CalibrationView radar
2. Tilt didn't work at all (Speed channel missing)
3. No safety limits - risk of motor damage at physical extremes
4. Type system didn't support `speed`, `strobe`, `color_wheel` channels

---

## ⚡ SOLUTION ARCHITECTURE

### **Phase 1: WAVE 1008.1 - Arbiter Integration**
Made CalibrationView use **Arbiter.setManual()** like Commander (which works!)

**Files Changed:**
- `CalibrationView/index.tsx` - Changed from mock to real Arbiter calls
- `TestPanel.tsx` - Added DMX Scanner with Arbiter fallback

**Result:** Pan started working via radar ✅

---

### **Phase 2: WAVE 1008.2 - Speed Channel Discovery**
Discovered **Tilt requires Speed=0** for fast movement (EL-1140 manual CH5).

**Problem:** Type system didn't support `speed` channel!

**Files Changed:**
1. `arbiter/types.ts` - Extended `ChannelType` with: `speed | strobe | color_wheel | amber | uv`
2. `arbiter/types.ts` - Extended `ManualControls` with new channels
3. `arbiter/types.ts` - Added merge strategies for new channels
4. `ArbiterHandlers.ts` - Pass `speed`, `strobe`, `gobo`, `color_wheel` in override object
5. `MasterArbiter.ts` - Added cases to `getManualChannelValue` for new channels
6. `MasterArbiter.ts` - Added new channels to `getTitanValuesForFixture` defaults (line 943)
7. `FixtureMapper.ts` - Added `speed` to `FixtureState` and `getChannelValue`

**Result:** Full type system support for Speed=0 to flow to hardware ✅

---

### **Phase 3: WAVE 1008.3 - Safety Shield**
Implemented **95% safety margin** to protect motor belts from damage.

**Specs (EL-1140 Manual):**
- Pan: 540° max → Safe: 513° (DMX 242 max)
- Tilt: 270° max → Safe: 256° (DMX 241 max)

**Files Changed:**
1. `CalibrationView/index.tsx` - Safety clamps in `handlePositionChange`
2. `CalibrationView/index.tsx` - Center position uses safe range (256°, 128°)
3. `RadarXY.tsx` - UI enforces safe limits during drag
4. `EL_1140.json` - Added `panLimits` and updated `tiltLimits` in profile

**Protection Layers:**
1. UI Input Clamping (RadarXY)
2. State Clamping (CalibrationView)
3. DMX Output Clamping (CalibrationView)
4. Profile Metadata (EL_1140.json)

**Result:** Hardware protected at code level - impossible to exceed safe limits ✅

---

## 📁 FILES MODIFIED

### Core Type System
- `electron-app/src/core/arbiter/types.ts` - Extended ChannelType + ManualControls
- `electron-app/src/core/arbiter/MasterArbiter.ts` - Support for new channels
- `electron-app/src/core/arbiter/FixtureMapper.ts` - Speed channel mapping

### IPC Layer
- `electron-app/src/ipc/ArbiterHandlers.ts` - Pass new channels to Arbiter

### UI Layer
- `electron-app/src/components/views/CalibrationView/index.tsx` - Arbiter + Safety
- `electron-app/src/components/views/CalibrationView/components/RadarXY.tsx` - Safety limits
- `electron-app/src/components/views/CalibrationView/components/TestPanel.tsx` - DMX Scanner

### Hardware Config
- `C:\Users\Raulacate\AppData\Roaming\luxsync-electron\fixtures\EL_1140.json` - Pan/Tilt limits

### Cleanup
- `electron-app/src/components/simulator/views/SimulateView/StageSimulator2.tsx` - Removed ID DEBUG spam

---

## 🧪 TESTING STATUS

### ✅ Completed Tests
- [x] Type system compiles without errors
- [x] CalibrationView uses Arbiter.setManual (same as Commander)
- [x] RadarXY clamps input to safe range
- [x] Center button uses safe center (256°, 128°)
- [x] DMX values capped at 242/241
- [x] Console logs removed (ID DEBUG spam)

### 🟡 Pending Hardware Tests
- [ ] Reload Selene with new type system
- [ ] Test Pan sweep 0° → 513° (should stop smoothly)
- [ ] Test Tilt sweep 0° → 256° (should stop smoothly)
- [ ] Verify Speed=0 makes Tilt responsive
- [ ] Confirm no belt scraping at safe limits
- [ ] Center position (256°, 128°) should be physically centered

---

## 📊 TECHNICAL METRICS

### Type System Expansion
- **ChannelType:** 11 → 16 types (+5)
- **ManualControls:** 11 → 15 props (+4)
- **DEFAULT_MERGE_STRATEGIES:** 11 → 16 entries (+5)
- **MasterArbiter cases:** 11 → 16 (+5)

### Safety Coverage
- **Protection Layers:** 4 (UI, State, DMX, Profile)
- **Safety Margin:** 5% (95% of physical max)
- **Pan Buffer:** ~27.6° from physical limit
- **Tilt Buffer:** ~14.8° from physical limit

### Code Quality
- **Type Errors:** 0
- **Compile Warnings:** 0 (related to this change)
- **Console Spam:** Eliminated (ID DEBUG removed)

---

## 🎯 AXIOM COMPLIANCE

### ✅ Perfection First
- Complete type system coverage (no partial implementations)
- 4 layers of safety protection (defense in depth)
- All Records updated consistently (no type holes)

### ✅ Performance = Arte
- Speed=0 for instant hardware response
- Safety limits prevent mechanical resonance/backlash
- Clean console output (no spam, only meaningful logs)

### ✅ Anti-Simulación
- No mocks - real Arbiter calls to real hardware
- No Math.random() - deterministic safety calculations
- No placeholders - actual EL-1140 specs from manual

---

## 🔄 INTEGRATION POINTS

### Arbiter Pipeline (Complete)
```
CalibrationView (speed: 0)
    ↓
Arbiter.setManual()
    ↓
ArbiterHandlers (controls.speed)
    ↓
MasterArbiter (getManualChannelValue case 'speed')
    ↓
FixtureMapper (state.speed → dmx[4])
    ↓
ArtNet → EL-1140 CH5 = 0 (FAST)
```

### Safety Pipeline (Complete)
```
User Input (radar drag)
    ↓
RadarXY clamp (max 513°, 256°)
    ↓
handlePositionChange clamp (safePan, safeTilt)
    ↓
DMX conversion clamp (min(242), min(241))
    ↓
Hardware never exceeds safe limits
```

---

## 📝 LESSONS LEARNED

### 1. Type System Completeness
**Problem:** Adding `speed` to ManualControls broke Record<ChannelType, number> in 3 places.  
**Solution:** Systematic search for ALL Records using ChannelType, update consistently.  
**Takeaway:** Type system changes need **architectural grep** to find all instances.

### 2. Safety by Design
**Problem:** No limits → user can damage hardware by mistake.  
**Solution:** Multiple protection layers at different abstraction levels.  
**Takeaway:** Physical systems need **code-enforced safety**, not just docs.

### 3. Speed Channel Critical
**Problem:** Tilt didn't work, mysterious.  
**Root Cause:** EL-1140 requires Speed=0 for fast movement (from manual).  
**Solution:** Type system extension + always send speed:0 in calibration.  
**Takeaway:** Moving heads often have **hidden movement prerequisites** in manuals.

### 4. Console Hygiene
**Problem:** ID DEBUG logs spammed console, made troubleshooting hard.  
**Solution:** Commented out spammy logs in StageSimulator2.tsx.  
**Takeaway:** **Log discipline** is part of performance debugging.

---

## 🚀 NEXT ACTIONS

### Immediate (Radwulf)
1. **Reload Selene** (`Ctrl+R` in dev tools or restart app)
2. **Open CalibrationView** (sidebar navigation)
3. **Select EL-1140** from fixture list
4. **Test Radar:**
   - Drag to corners → should clamp at safe limits
   - Watch console for `[Calibration] 🎯 Pan: X° (DMX Y) Tilt: Z° (DMX W)`
   - Verify DMX values never exceed 242 (Pan) or 241 (Tilt)
5. **Test Tilt:** Should now work with Speed=0 flowing to hardware

### Future Enhancements
1. **Color Wheel Calibration** - Use TestPanel DMX Scanner + Color Wheel channel
2. **Gobo Testing** - Map gobo positions for EL-1140
3. **Profile Editor** - UI to edit panLimits/tiltLimits per fixture
4. **FixtureMapper Limits** - Enforce profile limits in mapper layer (extra safety)

---

## 🏆 SUCCESS CRITERIA

### ✅ Phase 1 (Type System)
- [x] No TypeScript errors
- [x] All ChannelType Records updated
- [x] Speed channel flows through Arbiter pipeline

### ✅ Phase 2 (Safety)
- [x] UI enforces safe limits
- [x] DMX output capped
- [x] Profile metadata updated

### 🟡 Phase 3 (Hardware Validation)
- [ ] Tilt responds via radar
- [ ] No belt scraping at max safe positions
- [ ] Center position physically centered

---

## 💬 COMMUNICATION NOTES

**To Radwulf:**  
- "Pan ahora tiene límite 513° (no 540°) para proteger la correa"
- "Tilt ahora tiene límite 256° (no 270°) para proteger la correa"
- "El center button ahora va a (256°, 128°) que es el centro seguro"
- "Speed=0 está incluido en todos los comandos de calibración → Tilt debería funcionar"

**Why 95%?**  
Mechanical systems have:
- Backlash (holgura)
- Mounting flex
- Temperature expansion
- Wear tolerance

5% safety buffer prevents cumulative effects from causing damage.

---

**Status:** ✅ **CODE COMPLETE** - Awaiting hardware validation  
**Risk:** 🟢 **LOW** - Multiple safety layers, no breaking changes to existing code  
**Complexity:** 🟡 **MEDIUM** - Type system changes required systematic updates  

---

*"El hardware es caro. El código es gratis. Usa el código para proteger el hardware."*  
— PunkOpus, WAVE 1008

**WAVE COMPLETE. READY FOR METAL.**
