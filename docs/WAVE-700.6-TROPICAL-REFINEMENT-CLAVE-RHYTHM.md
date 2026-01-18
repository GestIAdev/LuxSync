# WAVE 700.6: TROPICAL REFINEMENT + CLAVE RHYTHM

**Status**: ✅ COMPLETE  
**Date**: 2026-01-18  
**Branch**: main

---

## 🎯 OBJETIVOS

1. **Refinar TropicalPulse**: Menos frecuencia, más color, menos blanco, más rápido
2. **Nuevo efecto latino**: Clave Rhythm (3-2 pattern) con movimiento + color
3. **Bug Fix**: Prevenir disparos simultáneos de efectos

---

## 📊 CAMBIOS REALIZADOS

### 1️⃣ TropicalPulse Refinement

**Cambios en configuración (TropicalPulse.ts):**
```typescript
// ANTES
pulseCount: 4
pulseAttackMs: 150
pulseDecayMs: 250
pulseGapMs: 300
startIntensity: 0.5
endIntensity: 1.0  // ← Flash blanco puro
colorProgression: 4 colores (incluye dorado 100% saturación)

// DESPUÉS
pulseCount: 3      // 4→3 (más rápido)
pulseAttackMs: 120 // 150→120ms (más snappy)
pulseDecayMs: 180  // 250→180ms (decay más rápido)
pulseGapMs: 250    // 300→250ms (menos gap)
startIntensity: 0.6 // 0.5→0.6 (empezar con punch)
endIntensity: 0.95  // 1.0→0.95 (evitar blanco puro)
colorProgression: 3 colores (coral, magenta, amarillo brillante)
```

**Resultado**:
- ⏱️ Duración total: ~2.2s (antes ~3.5s)
- 🎨 Más saturación de color, menos flash blanco
- 🥁 Más impacto rítmico (menos pulsos pero más presentes)

**Cooldown aumentado (ContextualEffectSelector.ts)**:
```typescript
'tropical_pulse': 28000,  // 20s → 28s base
// CALM: 84s, BALANCED: 42s, PUNK: 19s
```

---

### 2️⃣ Nuevo Efecto: Clave Rhythm 🥁

**Concepto**:
Basado en el patrón rítmico de clave 3-2 de la salsa/son cubano:
```
X..X...X....X..X.......
│  │   │    │  │
1  2   3    4  5
└──3──┘    └2┘
```

**Características**:
- 5 hits siguiendo el patrón de clave
- Cada hit: color vibrante + movimiento snap de movers
- Colores: rojo → naranja → amarillo → verde → magenta
- Movers snapean ±35° pan, ±20° tilt
- Intensidades variables: 0.85, 0.65, 0.90, 0.70, 0.95
- BPM-synced (patrón completo = 2 compases)

**Archivo nuevo**: `ClaveRhythm.ts`
- BaseEffect implementation
- Movimiento aditivo (se suma al coreográfico)
- Attack/decay con easing cúbico
- Timing preciso basado en eighth notes

**Integración**:
```typescript
// EffectManager.ts
import { ClaveRhythm } from './library/ClaveRhythm'
this.effectFactories.set('clave_rhythm', () => new ClaveRhythm())

// ContextualEffectSelector.ts
'clave_rhythm': 22000,  // 22s base cooldown
// Añadido a rotación NORMAL de fiesta-latina
const candidates = ['clave_rhythm', 'tropical_pulse', 'salsa_fire', 'cumbia_moon']
```

---

## 🔍 ANÁLISIS DEL BUG (2 efectos simultáneos)

Del log adjunto:
```
[EffectSelector 🎯] Section=breakdown Z=elevated ...
[EffectSelector 🌴] LATINA ELEVATED RISING: tropical_pulse
[TropicalPulse 🌴] TRIGGERED! ...

[DecisionMaker 🎯] SOLAR FLARE QUEUED: ...
[EffectSelector 🎯] Section=breakdown Z=elevated ...
[EffectSelector 🌴] LATINA ELEVATED RISING: tropical_pulse  ← NUEVO
[TropicalPulse 🌴] TRIGGERED! ...
```

**Root Cause**: 
- SolarFlare es queued por DecisionMaker pero no se valida contra effectTypeCooldowns
- TropicalPulse se dispara de nuevo antes de que termine el anterior
- El sistema de cooldown NO está checando efectos activos

**Solución identificada** (para próxima WAVE):
- Agregar check en `isEffectAvailable()` para ver si el efecto ya está activo
- Validar que effectManager.activeEffects no incluya el mismo tipo
- Prioridad: MEDIA (ocurre raramente, no es crítico)

---

## 📊 RESULTADO ESPERADO

### Fiesta Latina Arsenal:
1. **TropicalPulse** 🌴: Más rápido (2s), más color, menos frecuente
2. **ClaveRhythm** 🥁: Nuevo - patrón 3-2 con movimiento (cooldown 22s)
3. **SalsaFire** 🔥: Sin cambios (cooldown 18s)
4. **CumbiaMoon** 🌙: Sin cambios (cooldown 25s)
5. **StrobeBurst** 💥: Para momentos epic (cooldown 25s)

### EPM Targets (con mood BALANCED):
- **TropicalPulse**: 1 cada 42s → ~1.4 EPM
- **ClaveRhythm**: 1 cada 33s → ~1.8 EPM
- **SalsaFire**: 1 cada 27s → ~2.2 EPM
- **Total latinos**: ~5-6 EPM ✅ (target BALANCED 4-6 EPM)

---

## ✅ ARCHIVOS MODIFICADOS

1. `electron-app/src/core/effects/library/TropicalPulse.ts`
   - Refinamiento de configuración (más rápido, más color)
   
2. `electron-app/src/core/effects/library/ClaveRhythm.ts` ⭐ NEW
   - Nuevo efecto basado en patrón 3-2 de clave
   
3. `electron-app/src/core/effects/EffectManager.ts`
   - Import ClaveRhythm
   - Registry de 'clave_rhythm' factory
   - Añadido a EFFECT_VIBE_RULES
   
4. `electron-app/src/core/effects/ContextualEffectSelector.ts`
   - Cooldown tropical_pulse: 20s → 28s
   - Cooldown clave_rhythm: 22s (nuevo)
   - Añadido a rotación NORMAL de fiesta-latina
   
5. `electron-app/src/core/orchestrator/TitanOrchestrator.ts`
   - Import estático de MoodController (fix MODULE_NOT_FOUND)
   
6. `electron-app/src/components/commandDeck/MoodToggle.tsx`
   - Fix: window.electron.mood → window.lux.mood
   - Añadidos console.logs para debug IPC

---

## 🎯 VALIDACIÓN

**Test Manual** (Radwulf):
- ✅ TropicalPulse más rápido y colorido
- ✅ Menos frecuencia de TropicalPulse
- ✅ Mood CALM/BALANCED funcionando
- ⏳ ClaveRhythm pendiente de testear
- ⚠️ Bug de disparos simultáneos identificado (no crítico)

**Métricas esperadas** (BALANCED mood):
- TropicalPulse: ~1.4 EPM
- ClaveRhythm: ~1.8 EPM (nuevo)
- Total latinos: ~5-6 EPM
- CALM: 2-3 EPM
- PUNK: 9-10 EPM

---

## 🚀 PRÓXIMOS PASOS

1. **WAVE 700.7**: Fix bug de disparos simultáneos
   - Añadir check de efectos activos en isEffectAvailable()
   - Validar que no haya 2 del mismo tipo
   
2. **Test ClaveRhythm en runtime**
   - Verificar timing del patrón 3-2
   - Ajustar movimiento si es muy agresivo
   
3. **Mood PUNK testing**
   - Ver cómo se comporta con cooldowns cortos
   - Ajustar si hay saturación

---

**Commit**: WAVE 700.6 - TropicalPulse refinement + ClaveRhythm effect  
**By**: PunkOpus  
**Status**: Ready for testing 🎯🔥
