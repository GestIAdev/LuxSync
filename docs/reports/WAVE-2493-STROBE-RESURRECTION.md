# WAVE 2493 — STROBE RESURRECTION

**Fecha**: 2026-04-11  
**Compilación**: ✅ `npx tsc --noEmit` → 0 errores

---

## 🔍 DIAGNÓSTICO DEL LOG (debugefectos.md)

### BPM (WAVE 2492 partial fix)
- Confidence sube a 0.685→0.700 (antes permanentemente 0.000) ✅
- Pero bpmBuf sigue dominado por 161 para un track de 121 BPM
- DROP_HOLD_TIME fix confirmado: duración 4081ms ✅

### Efectos
- Más variedad: seismic_snap, gatling_raid, acid_sweep (3 diferentes) ✅
- StrobeStorm disparó via DIVINE (Z=4.12σ) → un solo flash largo ❌
- IndustrialStrobe: nunca apareció ❌
- CoreMeltdown: nunca apareció ❌
- SurgicalStrike: "basura de 350ms" ❌

### FPS
- PHANTOM dt=52-55ms → ~18-19 FPS backend (main loop)
- Frontend (HyperionView): TransientStore bypass es CORRECTO y NECESARIO
- El TransientStore (WAVE 348) NO es el problema — es lo que mantiene el visor 3D fluido a 60fps
- Los 18-19 FPS son del processFrame() del backend tardando >40ms

---

## 🔧 FIXES APLICADOS

### FIX 1: StrobeStorm — Frame-Guaranteed Strobe
**Archivo**: `src/core/effects/library/fiestalatina/StrobeStorm.ts`

**Bug**: A 14Hz el ciclo ON dura 35ms, pero con frames de 40-55ms, `isFlashOn` toggled ON→OFF dentro de un solo `update()` call. `getOutput()` nunca veía el flash ON. Mismo patrón que el bug de GatlingRaid (WAVE 2492).

**Root cause**: `strobePhase += deltaMs / msPerCycle` avanzaba ~77% del ciclo por frame. La comparación `strobePhase < 0.5` podía pasar de 0.3 → 0.8 en un solo frame, saltando todo el estado ON.

**Fix**: 
- `strobePhase` ahora acumula ms (no ratio 0-1) dentro del half-cycle actual
- Toggle via `while (strobePhase >= halfCycleMs)` — consume half-cycles completos
- Flag `flashDirty` garantiza que cada toggle se emite al menos 1 frame
- `dimmerOverride` = triggerIntensity SIEMPRE (el canal DMX de strobe maneja el parpadeo real via `strobeRate`)
- El toggle ON/OFF solo afecta `intensity` (visual del simulador)

### FIX 2: CoreMeltdown — Accumulator Strobe Toggle
**Archivo**: `src/core/effects/library/techno/CoreMeltdown.ts`

**Bug**: Mismo frame-skip. `this.elapsedMs - this.lastStrobeToggle >= halfPeriod` podía saltar toggles cuando deltaMs > halfPeriod (35ms).

**Fix**:
- Reemplazado `lastStrobeToggle` con `strobeAccumulator` 
- `while (strobeAccumulator >= halfPeriod)` consume todos los half-cycles que caben en el delta
- Color magenta↔blanco sigue alternando correctamente en transiciones ON

### FIX 3: SurgicalStrike — Duration + Strobe Fix
**Archivo**: `src/core/effects/library/techno/SurgicalStrike.ts`

**Cambios**:
- `durationMs`: 350ms → **600ms** (el color wheel necesita tiempo para cambiar posición)
- Strobe toggle: mismo fix de accumulator que CoreMeltdown
- Añadido `strobeRate` al output (antes no enviaba — el hardware no sabía que había strobe)
- Start con `strobeOn = true` (primer frame siempre visible)

### FIX 4: IndustrialStrobe — Zone Demotion
**Archivo**: `src/core/effects/EffectManager.ts`

**Bug**: IndustrialStrobe estaba en zona `peak` (0.90-1.00 energía). En hard techno típico la energía pico smoothed es 0.84-0.85. Nunca alcanzaba el umbral para ser candidato.

**Fix**: `industrial_strobe` movido de `'peak'` a `'intense'` (0.75-0.90) en `EFFECT_ZONE_MAP`. Ahora es candidato en la zona energética donde realmente ocurren los drops de hard techno.

> `core_meltdown` se mantiene en `peak` — LA BESTIA es rara, y así debe ser.

---

## 📊 FPS — ACLARACIÓN ARQUITECTÓNICA

El "bypass de React" (Zustand → TransientStore, WAVE 348) NO es el problema del FPS. Al contrario:

| Capa | FPS | Mecanismo |
|------|-----|-----------|
| Backend processFrame() | 25 target, ~18-19 real | setInterval(40ms) + STAMPEDE GUARD |
| IPC broadcast | 12.5 fps | frameCount % 2 throttle |
| TransientStore | 12.5 fps | mutable ref, zero React cost |
| Zustand truthStore | ~2-5 fps | throttle cada 6to frame IPC |
| Three.js useFrame() | 60 fps | lee TransientStore directo + interpolación |
| Canvas 2D tactical | 30 fps | requestAnimationFrame + getTransientTruth() |

**El visor 3D renderiza a 60fps con datos de 12.5fps + suavizado exponencial (VISUAL_SMOOTH=0.35)**. Eso es correcto y fluido.

Los 18-19 FPS del PHANTOM dt indican que `processFrame()` async tarda >40ms, causando que STAMPEDE GUARD (WAVE 2211) skip frames. La causa principal es la cadena Brain→Engine→HAL pesada + console.log spam por frame.

**Recomendación para siguiente WAVE**: Auditar los ~65 console.log en TitanOrchestrator (24) + TitanEngine (33) + SeleneTitanConscious (8). Cada console.log en Electron cuesta ~1-3ms. Eliminar los per-frame logs podría recuperar 10-20ms/frame.

---

## 🧬 PATRÓN DEL BUG (EL ENEMIGO INVISIBLE)

El bug "strobe por software invisible" afectaba a **4 efectos** (GatlingRaid ya fue arreglado en WAVE 2492):

```
14Hz → half-cycle = 35ms
Frame time = 40-55ms
35ms < 40ms → el flash ON cabe ENTERO dentro de 1 frame
→ update() avanza strobePhase de 0.3 → 0.8
→ getOutput() lee isFlashOn = false (phase > 0.5)
→ FLASH INVISIBLE
```

**La regla de oro**: Nunca simular strobe vía toggle de dimmer en software cuando frame_time > half_cycle_time. Usar `strobeRate` DMX y dejar que el hardware parpadee.

---

## ✅ RESUMEN

| Efecto | Antes | Después |
|--------|-------|---------|
| StrobeStorm | Un solo flash largo | Strobe real via strobeRate + toggle frame-guaranteed |
| CoreMeltdown | Nunca dispara + strobe invisible | Accumulator toggle + sigue en peak |
| SurgicalStrike | 350ms basura | 600ms + strobeRate + accumulator toggle |
| IndustrialStrobe | Nunca dispara (zona peak) | Zona intense (0.75-0.90) — El Martillo cae |
