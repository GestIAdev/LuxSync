# WAVE 316 - COSMIC TWILIGHT EXECUTION PLAN

**Date:** 2026-01-06  
**Status:** 🟡 IN PROGRESS  
**Author:** PunkOpus  
**Approver:** Radwulf  

---

## 🎯 OBJECTIVE

Replace **ChillStereoPhysics** (breathing pulse) with **ChillCosmicPhysics** (organic reactivity).

**Problem:** Current Chill physics is a $2 Chinese lamp (3 zones breathing in sync, music ignored).  
**Solution:** "Cosmic Twilight" - reactive to djembes/pads/movers like Techno but slower & luminous.

---

## 📋 EXECUTION STEPS

### ✅ Step 1: Create ChillCosmicPhysics.ts
**File:** `electron-app/src/hal/physics/ChillCosmicPhysics.ts`  
**Status:** ✅ DONE

**Features:**
- ✅ Bass hit detection → Front PARs +20% pulse (300ms)
- ✅ Pad detection → Back PARs cross-fade (8 sec)
- ✅ Movers independent drift (20 sec cycle, contrafase)
- ✅ Twilight breathing (20 sec, ±5% lightness only)
- ✅ Floor 0.50 (NEVER dark, cocktail-friendly)
- ✅ Logs every 15 frames with event indicators

### 🔄 Step 2: Update SeleneLux.ts (Chill section)
**File:** `electron-app/src/core/reactivity/SeleneLux.ts`  
**Status:** 🟡 PENDING

**Changes needed:**
1. Import **ChillCosmicPhysics** instead of ChillStereoPhysics
2. Update apply() call - pass full metrics:
   ```typescript
   const result = this.chillPhysics.apply(
     inputPalette,
     {
       normalizedBass: audioMetrics.normalizedBass,
       normalizedMid: audioMetrics.normalizedMid,
       normalizedTreble: audioMetrics.normalizedTreble,
       normalizedEnergy: audioMetrics.avgNormEnergy,
     },
     elementalMods
   );
   ```
3. Extract zoneIntensities from result (4 zones now: front, back, moverL, moverR)
4. Update chillOverrides structure:
   ```typescript
   this.chillOverrides = {
     front: result.zoneIntensities.front,
     back: result.zoneIntensities.back,
     mover: (result.zoneIntensities.moverL + result.zoneIntensities.moverR) / 2, // Promedio
   };
   ```
5. Update log to show event indicators (bassHit, midHit, padActive)

### 🔄 Step 3: Test with Café de Anatolia
**Status:** 🟡 PENDING

**Expected behavior:**
- Front PARs pulse on djembe hits (bass > 0.55)
- Back PARs glow when pads present (treble > 0.30)
- Movers drift independently (stars)
- NEVER dark (floor 0.50)
- Logs show: `💥` (bass hit), `🥁` (mid hit), `🎹` (pad active)

### 🔄 Step 4: Delete old ChillStereoPhysics.ts
**Status:** 🟡 PENDING

**When:** After confirming new physics works.  
**File to delete:** `electron-app/src/hal/physics/ChillStereoPhysics.ts`

---

## 🔬 TECHNICAL COMPARISON

| Aspect | ChillStereoPhysics (OLD) | ChillCosmicPhysics (NEW) |
|--------|--------------------------|--------------------------|
| **Philosophy** | Breathing pulse (jellyfish) | Cosmic twilight (sunset) |
| **Audio reactivity** | None (sin wave only) | YES (bass/mid/treble) |
| **Front PARs** | Uniform breathing | Bass reactive pulses |
| **Back PARs** | Uniform breathing | Pad-driven cross-fade |
| **Movers** | Phase offset (useless) | Independent drift (stars) |
| **Floor** | 0.35 | 0.50 (cocktail-friendly) |
| **Frequency** | 0.2-0.5 Hz (depends on energy) | 0.05 Hz twilight + events |
| **Music matters?** | NO | YES! |

---

## 🎨 PHILOSOPHY: "COSMIC TWILIGHT"

**Concept:** Fiesta Sunset en Buenos Aires (18:00-21:00hs)  
**Atmosphere:** Cocktails, conversation, sky turning from blue → violet → indigo → starry black  
**Lighting:** Cold/oceanic colors (green-cyan-violet-indigo), never dark, subtle percussion  
**Vibe:** "Techno que se fumó un porro" - organic, slow, reactive but peaceful  

**Layers:**
1. **Twilight Breathing** (20 sec cycle, ±5% L) - el "respiro del crepúsculo"
2. **Bass Reactive** (djembes → Front PARs pulse) - percusión sutil
3. **Pad Cross-fade** (treble → Back PARs glow) - pads flotantes
4. **Star Drift** (movers independientes) - estrellas emergentes
5. **Floor luminoso** (0.50) - luz para verse las caras

---

## ✅ VERIFICATION CHECKLIST

- [ ] SeleneLux imports ChillCosmicPhysics
- [ ] apply() receives full metrics (bass/mid/treble/energy)
- [ ] zoneIntensities extracted correctly
- [ ] chillOverrides uses new structure (front/back/mover avg)
- [ ] Logs show event indicators (💥🥁🎹)
- [ ] Build successful (npm run build)
- [ ] Test with Café de Anatolia - bass pulses visible
- [ ] Test with Café de Anatolia - pads make Back glow
- [ ] Movers drift independently (not sync)
- [ ] NEVER dark (always > 0.50)
- [ ] Delete old ChillStereoPhysics.ts

---

## 📝 NOTES

**Radwulf's feedback:**
> "No creamos una IA con 50 engines internos para tener 3 zonas que se propagan como una ola cada 10 segundos. Da igual la musica que pongas, se va a ver siempre igual."

**PunkOpus response:**
> Tienes toda la razón. El breathing pulse fue una idea de mierda (WAVE 134, culpa mía). ChillLounge es rico en djembes, pads, voces, efectos - merece reactividad orgánica como Techno pero pacífico.

**Design inspiration:** Sunsets en Argentina al aire libre, cocktails, conversación, cielo estrellado emergente.

---

**Next:** Step 2 - Update SeleneLux.ts
