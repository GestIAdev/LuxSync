---
title: "WAVE 935: ENERGY NORMALIZATION AUDIT"
subtitle: "Forensic hunt for ancient energy values breaking the system"
date: "2026-01-21"
status: "IN PROGRESS"
---

# 🔍 WAVE 935: ENERGY NORMALIZATION AUDIT

## 🚨 PROBLEMA DETECTADO

Radwulf detectó que varios módulos **siguen usando energía sin normalizar** (antigua, pre-AGC), causando:

1. **TitanEngine logs con valores antiguos** → Confusión en debugging
2. **CHOREO (VibeMovementManager) con energía antigua** → Movimiento jodido
3. **Transiciones erráticas de zona energética** → valley ↔ ambient con valores raros

## 📋 EVIDENCIA

### Log 1: TitanEngine usando energía antigua
```
[TitanEngine] 🎨 Palette: P=#340bda S=#04ae42 | Energy=0.17 | Master=0.17
[TitanEngine] Frame 240: { vibe: 'techno-club', energy: '0.17', intensity: '0.17' }
```

### Log 2: CHOREO usando energía antigua
```
[🎭 CHOREO] Bar:13 | Phrase:1 | Pattern:skySearch | Energy:0.00 | BeatCount:0
[🚗 GEARBOX] ✅ FULL THROTTLE | BPM:60 | Pattern:skySearch(4x) | 100% amplitude
```

### Log 3: Transiciones erráticas
```
[SeleneTitanConscious 🔋] Zone transition: valley → ambient (E=0.39)
[FUZZY 🔮] PREPARE | E=0.32 Z=-2.3σ
[🎭 CHOREO] Pattern:sweep | Energy:0.23
[SeleneTitanConscious 🔋] Zone transition: ambient → valley (E=0.22)
```

## 🏗️ ARQUITECTURA DEL PROBLEMA

```
                    ┌─────────────────────────┐
                    │   AGC NORMALIZER        │
                    │   (Nuevo sistema)       │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │   context.energy        │
                    │   (Normalizado 0-1)     │
                    └───────────┬─────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ▼               ▼               ▼
        ┌────────────┐  ┌────────────┐  ┌────────────┐
        │ TitanEngine│  │   CHOREO   │  │   Selene   │
        │   ❌ OLD   │  │   ❌ OLD   │  │   ✅ NEW   │
        │audio.energy│  │audio.energy│  │context.ener│
        └────────────┘  └────────────┘  └────────────┘
             │               │               │
             └───────────────┴───────────────┘
                             │
                             ▼
                    ❌ CONFLICT & CHAOS
```

## 🔧 FIXES APLICADOS

### Fix 1: TitanEngine Logging (DONE ✅)

**Archivo**: `engine/TitanEngine.ts`

**Líneas afectadas**: 677, 687

**Antes**:
```typescript
console.log(`[TitanEngine] Energy=${audio.energy.toFixed(2)}`)
this.state.previousEnergy = audio.energy
```

**Después**:
```typescript
// 🔋 WAVE 935: Usar context.energy (normalizado)
console.log(`[TitanEngine] Energy=${context.energy.toFixed(2)}`)
this.state.previousEnergy = context.energy
```

### Fix 2: VibeMovementManager (PENDING 🔴)

**Archivo**: `engine/movement/VibeMovementManager.ts`

**Problema**: 
- Línea 494: Usa `audio.energy` en logging
- Línea 500: Usa `audio.energy < 0.05` para home position
- Línea 462: `this.energyHistory.push(audio.energy)` - historial con valores antiguos

**Solución propuesta**:
```typescript
// Opción A: Pasar context.energy como parámetro adicional
generateIntent(
  vibeId: string,
  audio: AudioContext,
  normalizedEnergy: number,  // ← NUEVO
  ...
)

// Opción B: Añadir normalizedEnergy al AudioContext
interface AudioContext {
  energy: number,  // ← OLD (sin AGC)
  normalizedEnergy?: number,  // ← NEW (con AGC)
  ...
}
```

### Fix 3: Zone Transition Jitter (PENDING 🔴)

**Problema**: Transiciones `valley ↔ ambient` muy rápidas sugieren que:
1. La energía tiene jitter (no está suavizada)
2. Los thresholds están mal calibrados
3. El timing asimétrico no está funcionando

**Diagnóstico necesario**:
```typescript
// Añadir logging detallado en EnergyConsciousnessEngine
console.log(`[EnergyConsciousness 🔋] Raw:${energy.toFixed(2)} Smoothed:${smoothed.toFixed(2)} Zone:${zone} Frames:${framesInZone}`)
```

## 📊 PROPAGACIÓN DE ENERGÍA (FLUJO CORRECTO)

```
1. RAW AUDIO BUFFER
   └─> FFT Analysis
       └─> Gamma Worker
           └─> energy: 0.XX (raw, sin AGC)

2. AGC NORMALIZATION (Trinity or Backend)
   └─> normalizedEnergy: 0-1 (con AGC)
       └─> context.energy (MusicalContext)

3. ENERGY CONSCIOUSNESS ENGINE
   └─> energyContext.zone
   └─> energyContext.smoothed
   └─> energyContext.absolute

4. CONSUMERS (deben usar context.energy)
   ├─> TitanEngine ✅ FIXED
   ├─> VibeMovementManager ❌ PENDING
   ├─> SeleneTitanConscious ✅ OK
   └─> EffectSelector ✅ OK
```

## 🎯 PLAN DE ACCIÓN

### Fase 1: Propagación de context.energy ✅ STARTED

- [x] Fix TitanEngine logging (líneas 677, 687)
- [ ] Fix VibeMovementManager
  - [ ] Logging línea 494
  - [ ] Umbral línea 500
  - [ ] History línea 462
- [ ] Verificar otros módulos con grep

### Fase 2: AudioContext Unification 🔴 TODO

Decidir:
- **Opción A**: Mantener `audio.energy` como legacy, añadir `audio.normalizedEnergy`
- **Opción B**: Reemplazar `audio.energy` por normalizado EVERYWHERE (breaking change)

### Fase 3: Zone Jitter Fix 🔴 TODO

- [ ] Añadir logging detallado en EnergyConsciousnessEngine
- [ ] Capturar secuencia de transiciones durante 30s
- [ ] Analizar thresholds y smoothing
- [ ] Ajustar SMOOTHING_FACTOR si necesario

### Fase 4: Testing & Validation 🔴 TODO

- [ ] Test con track techno (60 BPM sustained)
- [ ] Verificar que CHOREO use valores consistentes
- [ ] Verificar que TitanEngine logs sean coherentes
- [ ] Verificar que zone transitions sean estables

## 🧪 TEST CASES

### Test 1: Logging Consistency

**Input**: Track techno 60 BPM, energía sostenida 0.6

**Expected**:
```
[TitanEngine] Energy=0.60
[🎭 CHOREO] Energy:0.60
[SeleneTitanConscious 🔋] Zone: active (E=0.60)
```

**Current** (BROKEN):
```
[TitanEngine] Energy=0.17  ← OLD
[🎭 CHOREO] Energy:0.00    ← OLD/JITTER
[SeleneTitanConscious 🔋] Zone: active (E=0.60)  ← OK
```

### Test 2: Zone Stability

**Input**: Energía estable 0.35 por 10 segundos

**Expected**: Zone = `ambient` (threshold 0.30-0.45), sin cambios

**Current** (BROKEN):
```
valley → ambient → valley → ambient (jitter)
```

## 📝 NEXT STEPS

1. ✅ **DONE**: Fix TitanEngine.calculateMovement() línea 1183 - usar `context.energy`
2. ✅ **DONE**: VibeMovementManager recibe energía normalizada vía VMMContext
3. **Pending**: Test con track real - verificar que thresholds funcionan
4. **Pending**: System-wide grep para encontrar otros usos de `audio.energy`
5. **Future**: Deprecar completamente `audio.energy` legacy

---

## 🔧 IMPLEMENTATION DETAILS

### Fix #3: VMMContext Construction (ROOT CAUSE)

**File**: `engine/TitanEngine.ts`  
**Line**: 1183  
**Change**: Usar `context.energy` (normalizado) en lugar de `audio.energy`

**Before**:
```typescript
const vmmContext: VMMContext = {
  energy: audio.energy,  // ← OLD VALUE
  bass: audio.bass,
  // ...
}
```

**After**:
```typescript
const vmmContext: VMMContext = {
  energy: context.energy,  // 🔋 WAVE 935: Normalizado con AGC
  bass: audio.bass,
  // ...
}
```

**Impact**: Este cambio **propaga la energía normalizada** a:
- VibeMovementManager.generateIntent() (línea 494 logging)
- VibeMovementManager threshold check (línea 500)
- VibeMovementManager.energyHistory (línea 462)

**Result**: Con este único cambio, **toda la cadena CHOREO/GEARBOX** ahora usa energía normalizada. Los 3 problemas en VibeMovementManager se resuelven automáticamente.

---

**Status**: ✅ FIXED  
**Priority**: HIGH  
**Blocking**: Movement system, Logging clarity  
**Assigned**: PunkOpus  
**Review**: Radwulf - TEST CON TRACK REAL
