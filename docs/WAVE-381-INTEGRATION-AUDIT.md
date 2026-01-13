# 🔬 WAVE 381: INTEGRATION AUDIT REPORT
## "La Autopsia del Flujo de Datos"

**Fecha:** $(date +%Y-%m-%d)  
**Objetivo:** Documentar DÓNDE se pierden los metadatos y POR QUÉ el mapeo de color es plano.

---

## 📊 EXECUTIVE SUMMARY

| Issue | Status | Root Cause | Location |
|-------|--------|------------|----------|
| Monocromatismo | 🔴 CRÍTICO | Solo usa `palette.primary` para TODOS los fixtures | `MasterArbiter.getTitanValuesForFixture()` |
| Pan/Tilt UI no aparece | 🟡 PARCIAL | UI lee `hardware.fixtures` pero posible ID mismatch | `InspectorControls.tsx:58-66` |
| Capabilities perdidas | 🔴 CRÍTICO | `ArbiterFixture` interface no tiene `capabilities` | `types.ts:465-485` |
| Modo desincronizado | 🔴 CRÍTICO | `globalMode` solo existe en frontend | `controlStore` vs `MasterArbiter` |
| Movimiento no individual | 🔴 CRÍTICO | Todos movers usan mismo `centerX/centerY` | `MasterArbiter.ts:883-890` |

---

## 🩸 FLUJO DE DATOS COMPLETO

```
┌─────────────────────────────────────────────────────────────────────┐
│ FRONTEND (stageStore)                                                │
│ fixture = { id, name, type, capabilities, channels, ... }           │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │ TitanSyncBridge.tsx
                                    │ IPC: lux:arbiter:setFixtures
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ArbiterIPCHandlers.ts (line 346)                                     │
│ masterArbiter.setFixtures(fixtures)                                  │
│ titanOrchestrator.setFixtures(fixtures)                              │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌───────────────────────────────┐   ┌──────────────────────────────────┐
│ MasterArbiter.setFixtures()   │   │ TitanOrchestrator.setFixtures()  │
│ (lines 168-188)               │   │ (lines 655-680)                  │
│                               │   │                                  │
│ 🔴 STRIPS DATA:               │   │ ✅ PRESERVES DATA:               │
│ - capabilities ❌             │   │ - Passes full fixture to HAL     │
│ - hasMovementChannels ❌      │   │                                  │
│ - channels ❌                 │   │                                  │
│ - definition ❌               │   │                                  │
│                               │   │                                  │
│ Maps to ArbiterFixture:       │   │                                  │
│ { id, name, zone, type,       │   │                                  │
│   dmxAddress, universe }      │   │                                  │
└───────────────────────────────┘   └──────────────────────────────────┘
                │                                   │
                ▼                                   ▼
┌───────────────────────────────┐   ┌──────────────────────────────────┐
│ getTitanValuesForFixture()    │   │ HAL.renderFromTarget()           │
│ (lines 845-920)               │   │ (lines 715-830)                  │
│                               │   │                                  │
│ 🔴 MONOCROMATISM:             │   │ ✅ type preserved:               │
│ - Uses ONLY palette.primary   │   │ type: fixture.type || 'generic' │
│ - NO zone-based colors        │   │                                  │
│ - NO role-based colors        │   │                                  │
│                               │   │                                  │
│ 🔴 MOVEMENT:                  │   │                                  │
│ - ALL movers share:           │   │                                  │
│   • centerX (single value)    │   │                                  │
│   • centerY (single value)    │   │                                  │
└───────────────────────────────┘   └──────────────────────────────────┘
                │                                   │
                ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ BROADCAST: SeleneTruth.hardware.fixtures[]                          │
│                                                                      │
│ FixtureState = {                                                     │
│   id: "fixture-XXXX"  ✅ (WAVE 380.2 fixed)                         │
│   name: "PAR LED 1"   ✅                                             │
│   type: "par"         ⚠️ (Comes from HAL, but UI may not match ID)  │
│   zone: "front"       ✅                                             │
│   dimmer: 0-1         ✅                                             │
│   color: {r,g,b}      ✅                                             │
│   pan: 0-1            ✅                                             │
│   tilt: 0-1           ✅                                             │
│ }                                                                    │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │ IPC: lux:selene:truth
                                    │ useSeleneTruth hook
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ FRONTEND: truthStore                                                 │
│ selectHardware() → hardware.fixtures[]                               │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ InspectorControls.tsx (lines 58-66)                                  │
│                                                                      │
│ hasMovingHeads = selectedArray.some(id => {                          │
│   const fixture = fixtures.find(f => f.id === id)  ⚠️ ID MATCH?     │
│   return type.includes('moving') || 'spot' || 'beam'                 │
│ })                                                                   │
│                                                                      │
│ ❓ POTENTIAL ISSUES:                                                 │
│ 1. selectedIds come from selectionStore (clicked fixtures)           │
│ 2. fixtures come from truthStore (backend broadcast)                 │
│ 3. IF IDs don't match → fixture = undefined → no Pan/Tilt            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔴 HALLAZGO #1: MONOCROMATISMO (CRITICAL)

### Ubicación
`MasterArbiter.ts` → `getTitanValuesForFixture()` → Lines 873-879

### Código Problemático
```typescript
// Line 873-879 in MasterArbiter.ts
// Convert HSL to RGB using palette primary
const rgb = this.hslToRgb(
  intent.palette.primary.h,  // ← SOLO USA PRIMARY
  intent.palette.primary.s,
  intent.palette.primary.l * dimmer
)
```

### Por Qué Es Un Problema
- `palette.primary` se aplica a TODOS los fixtures sin excepción
- NO hay diferenciación por zona (front vs back vs movers)
- NO hay diferenciación por rol (wash vs accent vs effect)
- `palette.secondary` y `palette.accent` **NUNCA SE USAN**

### El Comentario Que Lo Confirma
```typescript
// Line 886-890 in MasterArbiter.ts
// TODO: Zone-based fixture mapping could go here
// For now, all fixtures get the same primary color
// In a real implementation, different zones could get:
// - front pars: warm wash (primary)
// - back pars: cool accent (secondary)
// - movers: dramatic (accent)
```

### Impacto Visual
```
Expectativa:  🟡 🟠 🔴 🔵 🟣   (rainbow de colores por zona)
Realidad:     🔴 🔴 🔴 🔴 🔴   (monocromo total)
```

---

## 🔴 HALLAZGO #2: CAPABILITIES PERDIDAS (CRITICAL)

### Ubicación
`types.ts` → `ArbiterFixture` interface → Lines 472-485

### Interface Actual
```typescript
export interface ArbiterFixture {
  id?: string
  name: string
  zone?: PhysicalZone
  type?: string          // ← Solo string genérico
  dmxAddress: number
  universe: number
  // ❌ NO capabilities
  // ❌ NO hasMovementChannels
  // ❌ NO channels
  // ❌ NO definition
}
```

### Datos Que Se Envían (TitanSyncBridge)
```typescript
// TitanSyncBridge.tsx line 73-82
capabilities: f.capabilities || {},   // ← SE ENVÍA
channels: f.channels || [],           // ← SE ENVÍA
hasMovementChannels: Boolean(...)     // ← SE ENVÍA
```

### Datos Que Se Reciben (MasterArbiter.setFixtures)
```typescript
// MasterArbiter.ts line 170-178
this.fixtureCache.set(f.id || f.name, {
  id: f.id,
  name: f.name,
  zone: (f.zone || 'UNASSIGNED') as PhysicalZone,
  type: f.type,
  dmxAddress: f.dmxAddress,
  universe: f.universe || 1
  // ❌ capabilities STRIPPED
  // ❌ hasMovementChannels STRIPPED
})
```

### Impacto
El Arbiter **NO PUEDE** saber qué fixtures son movers porque la información se pierde.

---

## 🔴 HALLAZGO #3: MOVIMIENTO NO INDIVIDUAL (CRITICAL)

### Ubicación
`MasterArbiter.ts` → `getTitanValuesForFixture()` → Lines 883-890

### Código Problemático
```typescript
// ALL movers get the SAME position
pan: intent.movement.centerX * 255,   // ← SHARED VALUE
tilt: intent.movement.centerY * 255,  // ← SHARED VALUE
```

### Por Qué Es Un Problema
- `intent.movement.centerX/centerY` es UN SOLO PUNTO
- TODOS los movers apuntan al mismo lugar
- NO hay offsets, NO hay patterns, NO hay individualidad

### Impacto Visual
```
Expectativa:  ↖ ↑ ↗   (movers apuntando a diferentes direcciones)
              ← · →
              ↙ ↓ ↘

Realidad:     ↗ ↗ ↗   (todos al mismo punto)
              ↗ ↗ ↗
```

---

## 🔴 HALLAZGO #4: MODO DESINCRONIZADO (CRITICAL)

### Ubicación
Frontend: `controlStore.ts` → `globalMode`  
Backend: `MasterArbiter.ts` → NO tiene concepto de modo

### Código Frontend
```typescript
// controlStore.ts
globalMode: 'selene' | 'flow' | 'manual' | 'locked'
flowParams: { ... }
```

### Código Backend
```typescript
// MasterArbiter.ts - NO HAY NADA sobre globalMode
// El arbiter no sabe si estamos en Flow, Manual, o Selene
```

### Impacto
- Si el usuario activa "Flow Mode" en UI → Backend sigue en modo normal
- Si el usuario usa "Manual Override" → Backend ignora el override
- La experiencia de control es inconsistente

---

## 🟡 HALLAZGO #5: PAN/TILT UI (PARTIAL)

### Ubicación
`InspectorControls.tsx` → Lines 58-66

### Código
```typescript
const hasMovingHeads = useMemo(() => {
  const fixtures = hardware?.fixtures || []  // ← Del truthStore
  return selectedArray.some(id => {
    const fixture = fixtures.find((f: { id: string }) => f.id === id)
    const type = fixture?.type?.toLowerCase() || ''
    return type.includes('moving') || type.includes('spot') || type.includes('beam')
  })
}, [selectedArray, hardware?.fixtures])
```

### Análisis
1. **`hardware.fixtures`** viene del broadcast vía truthStore ✅
2. **`selectedArray`** viene del selectionStore (clicks en UI) ✅
3. **ID Match**: El broadcast usa `fixture-XXXX` (WAVE 380.2 fixed) ✅

### Posible Problema Residual
El `type` puede llegar como `'generic'` si el fixture original no tenía tipo definido.

Verificación necesaria:
```typescript
// ¿Qué type tiene el fixture en stageStore?
// ¿Se propaga correctamente a TitanOrchestrator?
// ¿HAL lo preserva o lo convierte a 'generic'?
```

---

## ✅ HALLAZGOS POSITIVOS (WAVE 380 Fixes Working)

| Fix | Location | Status |
|-----|----------|--------|
| Singleton Instance | `main.ts` + `registerTitanOrchestrator()` | ✅ Working |
| ID Matching | `TitanOrchestrator.ts:437` | ✅ Using `this.fixtures[i]?.id` |
| HSL Conversion | `MasterArbiter.ts:1037` | ✅ `hNorm = h` (no division) |
| 3D Data Flow | `useFixtureRender.ts:96` | ✅ Reads from truthStore |

---

## 🏥 PLAN DE CORRECCIÓN RECOMENDADO

### PRIORIDAD 1: Color Zoning (Monocromatismo)
**Archivo:** `MasterArbiter.ts`  
**Función:** `getTitanValuesForFixture()`  
**Acción:** Implementar selección de color por zona
```typescript
// Pseudocódigo
const color = fixture.zone === 'FRONT_PARS' ? palette.primary
            : fixture.zone === 'BACK_PARS'  ? palette.secondary
            : fixture.zone.includes('MOVING') ? palette.accent
            : palette.primary
```

### PRIORIDAD 2: Capabilities en ArbiterFixture
**Archivo:** `types.ts`  
**Interface:** `ArbiterFixture`  
**Acción:** Extender interface
```typescript
export interface ArbiterFixture {
  // ... existing
  capabilities?: {
    hasColor?: boolean
    hasMovement?: boolean
    hasDimmer?: boolean
  }
  hasMovementChannels?: boolean
}
```

### PRIORIDAD 3: Movimiento Individual
**Archivo:** `MasterArbiter.ts`  
**Función:** `getTitanValuesForFixture()`  
**Acción:** Calcular offsets per-mover
```typescript
// Pseudocódigo
const moverIndex = this.getMoverIndex(fixture.id)
const offset = calculatePatternOffset(moverIndex, intent.movement.pattern)
const pan = (intent.movement.centerX + offset.x) * 255
const tilt = (intent.movement.centerY + offset.y) * 255
```

### PRIORIDAD 4: Mode Sync
**Acción:** Broadcast `globalMode` desde frontend al backend via IPC

---

## 📋 VERIFICACIÓN PENDIENTE

Para confirmar el HALLAZGO #5 sobre Pan/Tilt UI:

1. Ejecutar la aplicación
2. Seleccionar un Moving Head
3. Abrir DevTools
4. Ejecutar:
```javascript
// Verificar qué type tiene el fixture en truthStore
const hardware = window.luxDebug?.truthStore?.getState()?.truth?.hardware
hardware?.fixtures?.forEach(f => console.log(f.id, f.type))
```

Si el type es `'generic'` o vacío → El problema está en stageStore o en el sync.
Si el type es `'moving-head'` o similar → El problema está en el matching de IDs.

---

## 🎯 CONCLUSIÓN

**La raíz del problema NO es un solo bug, sino un DISEÑO INCOMPLETO:**

1. El Arbiter fue diseñado como sistema de "prioridades" pero no como renderizador completo
2. El mapeo de colores se dejó como TODO
3. La interface ArbiterFixture se simplificó demasiado
4. El concepto de "Modo" existe solo en frontend

**WAVE 382 debería enfocarse en:**
1. Color Zoning (resolver monocromatismo)
2. Capabilities propagation (resolver Pan/Tilt detection)

---

*Reporte generado: WAVE 381 - Integration Audit*  
*Arquitecto: PunkOpus*  
*"No tenemos prisa. Hacemos FULL APP o nada."*
