# 🎯 WAVE 34.2 - HIERARCHY ENFORCEMENT REPORT

**Fecha**: 2025-12-17  
**Objetivo**: "Override Store tiene PRIORIDAD TOP - Control individual por fixture"

---

## 📋 RESUMEN EJECUTIVO

WAVE 34.2 implementa la **jerarquía de prioridades** completa en el frontend:

```
┌─────────────────────────────────────────────────────────────────┐
│  PRIORITY HIERARCHY (TOP to BOTTOM)                            │
├─────────────────────────────────────────────────────────────────┤
│  1. 🎯 OVERRIDE STORE    → Per-fixture manual values (Inspector)│
│  2. 🎚️ FLOW/RADAR        → Global Flow Engine + Kinetic Radar   │
│  3. 🌙 SELENE AI         → Backend AI decisions (truthStore)    │
└─────────────────────────────────────────────────────────────────┘
```

**Escenario de Uso**:
> "Quiero poner el Radar a girar (todos se mueven). Luego, seleccionar UN foco y apuntarlo fijo a una esquina (Override). Ese foco debe obedecerme y quedarse quieto."

---

## ✅ CAMBIOS IMPLEMENTADOS

### 1. `useFixtureRender.ts` - Motor de Renderizado con Jerarquía

**Archivo**: `src/hooks/useFixtureRender.ts`

```typescript
// WAVE 34.2: Full Priority Hierarchy
export function calculateFixtureRenderValues(
  truthData: any,
  globalMode: GlobalMode,
  flowParams: FlowParams,
  activePaletteId: LivingPaletteId,
  globalIntensity: number,
  globalSaturation: number = 1,
  fixtureIndex: number = 0,
  fixtureOverride?: FixtureOverride,  // ← NEW
  overrideMask?: ChannelMask          // ← NEW
): FixtureRenderData
```

**Lógica de Prioridad**:
1. Primero aplica valores de FLOW/RADAR (colores vivos, patrones de movimiento)
2. Luego, si existe `fixtureOverride` con `mask.position = true`, **sobrescribe** pan/tilt
3. Si existe `mask.color = true`, **sobrescribe** RGB
4. Si existe `mask.dimmer = true`, **sobrescribe** intensidad

### 2. `StageSimulator2.tsx` - Canvas 2D con Overrides

**Archivo**: `src/components/views/SimulateView/StageSimulator2.tsx`

```typescript
// WAVE 34.2: Import Override Store
import { useOverrideStore } from '../../../stores/overrideStore';

// Read overrides Map
const overrides = useOverrideStore(state => state.overrides);

// Pass to render function
const fixtureOverride = overrides.get(fixtureId);
const { color, intensity, pan, tilt } = calculateFixtureRenderValues(
  fixture,
  globalMode,
  flowParams,
  activePaletteId,
  globalIntensity,
  globalSaturation,
  fixtureIndex,
  fixtureOverride?.values,  // ← NEW
  fixtureOverride?.mask     // ← NEW
);
```

### 3. `Stage3DCanvas.tsx` - Ya Conectado

El canvas 3D usa el **hook** `useFixtureRender()` que internamente lee del `overrideStore`:

```typescript
const SmartFixture3D = ({ layout, truthData, fixtureIndex }) => {
  const { color, intensity, pan, tilt } = useFixtureRender(truthData, layout.id, fixtureIndex)
  // El hook ya aplica la jerarquía completa
}
```

### 4. Debug Logging

Añadido console.log cuando un override está activo:

```typescript
if (fixtureOverride && overrideMask) {
  const activeOverrides: string[] = []
  if (overrideMask.color) activeOverrides.push('COLOR')
  if (overrideMask.dimmer) activeOverrides.push('DIMMER')
  if (overrideMask.position) activeOverrides.push('POSITION')
  if (activeOverrides.length > 0) {
    console.log(`🎯 [Override] Fixture ${fixtureIndex} using manual: [${activeOverrides.join(', ')}]`)
  }
}
```

---

## 🔌 FLUJO DE DATOS

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER ACTIONS                                  │
├─────────────────────────────────────────────────────────────────┤
│  Inspector Panel          Radar/Flow Controls      Selene AI    │
│        │                        │                      │        │
│        ▼                        ▼                      ▼        │
│  overrideStore            controlStore            truthStore    │
│  (per-fixture)            (global flow)           (backend AI)  │
│        │                        │                      │        │
│        └────────────┬───────────┴──────────────────────┘        │
│                     ▼                                            │
│           calculateFixtureRenderValues()                         │
│                     │                                            │
│                     ▼                                            │
│           ┌─────────────────┐                                    │
│           │ Priority Check: │                                    │
│           │ 1. Override?    │ → Yes → Use override values        │
│           │ 2. Flow?        │ → Yes → Use flow/radar values      │
│           │ 3. AI?          │ → Yes → Use truthStore values      │
│           └─────────────────┘                                    │
│                     │                                            │
│                     ▼                                            │
│        StageSimulator2 / Stage3DCanvas                           │
│              (Visual Output)                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 ESTRUCTURA DEL OVERRIDE

```typescript
interface Override {
  values: FixtureOverride;   // { pan?, tilt?, r?, g?, b?, dimmer?, ... }
  mask: ChannelMask;         // { color: bool, dimmer: bool, position: bool, optics: bool }
  timestamp: number;
  source: 'inspector' | 'scene' | 'midi' | 'osc';
  priority: number;
}

// Mask inference automático:
// Si setOverride({ pan: 180 }), automáticamente mask.position = true
```

---

## 🚧 TRABAJO DIFERIDO (WAVE 35+)

### Backend DMXMerger Sync

El backend tiene su propio DMXMerger con prioridades, pero no recibe `flowParams` del frontend. Para que el DMX real refleje los mismos patrones:

1. Crear IPC `lux:set-flow-params` para enviar flowParams al backend
2. Crear backend version de `movementGenerator.ts`
3. Sincronizar overrideStore con backend via IPC

**Nota**: El frontend ya visualiza correctamente. El backend sync es mejora futura.

---

## 🧪 CÓMO PROBAR

1. **Iniciar LuxSync** y abrir vista de simulación
2. **Activar Modo FLOW** - Todos los fixtures responden al radar
3. **Seleccionar UN fixture** en el canvas
4. **Abrir Inspector** y mover sliders de Pan/Tilt
5. **Verificar**:
   - Console muestra: `🎯 [Override] Fixture X using manual: [POSITION]`
   - El fixture seleccionado queda fijo
   - Los demás siguen girando con el radar

---

## 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useFixtureRender.ts` | Añadidos parámetros fixtureOverride y overrideMask |
| `src/components/views/SimulateView/StageSimulator2.tsx` | Import overrideStore, pasar overrides a función |
| `src/components/stage3d/Stage3DCanvas.tsx` | Ya usa hook con jerarquía |

---

## 🎯 RESULTADO

**ANTES (34.1)**: Override store existía pero no se consultaba en el render loop

**DESPUÉS (34.2)**: La jerarquía se respeta completamente:
- Override > Flow > AI
- Un fixture con override manual ignora el radar global
- Console log muestra qué canales están siendo sobreescritos

---

**WAVE 34.2 COMPLETE** ✅

*"El DJ tiene control absoluto. Cuando dice 'este foco quieto', se queda quieto."*
