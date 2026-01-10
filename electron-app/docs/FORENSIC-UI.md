# 🔬 FORENSIC-UI: AUDITORÍA FORENSE DE INTERFAZ Y CONTROLES

**Fecha**: Enero 10, 2026  
**Operación**: GRANDMA KILLER  
**Auditor**: PunkOpus  
**Estado**: CÓDIGO ROJO - LIMPIO PERO HEREDADO

---

## 📊 RESUMEN EJECUTIVO

La UI de LuxSync está **sorprendentemente bien estructurada** para lo esperado. No es el caos de "pantalón hippie remendado" que temíamos. Sin embargo, hay **oportunidades claras de mejora** y algunos **restos arqueológicos** del modo Flow antiguo.

### Veredicto General:
- **60% RECUPERABLE** - Arquitectura sólida
- **25% REFACTORIZABLE** - Lógica buena pero dispersa
- **15% TIERRA QUEMADA** - Código muerto/duplicado

---

## 1. 🏪 STORES ZUSTAND (La Fuente de Verdad)

### Mapa de Stores (16 total):

| Store | Propósito | Estado | Veredicto |
|-------|-----------|--------|-----------|
| `selectionStore.ts` | Selección de fixtures (multi-select, range) | ✅ EXCELENTE | **CONSERVAR** |
| `overrideStore.ts` | Valores manuales por fixture (color, pan/tilt, dimmer) | ✅ EXCELENTE | **CONSERVAR** |
| `controlStore.ts` | Modo global (Manual/Flow/Selene), viewMode (2D/3D) | ✅ SÓLIDO | **CONSERVAR** |
| `truthStore.ts` | Single Source of Truth (backend → frontend) | ✅ CRÍTICO | **CONSERVAR** |
| `transientStore.ts` | Datos transitorios de renderizado (physics) | ✅ SÓLIDO | **CONSERVAR** |
| `effectsStore.ts` | Efectos rápidos (Strobe, Blackout, etc.) | ✅ FUNCIONAL | **CONSERVAR** |
| `vibeStore.ts` | Gestión de Vibes activos | ✅ FUNCIONAL | **CONSERVAR** |
| `navigationStore.ts` | Tabs y navegación principal | ✅ SIMPLE | **CONSERVAR** |
| `sceneStore.ts` | Escenas/Cues (snapshot de overrides) | ⚠️ LEGACY | **REFACTORIZAR** |
| `seleneStore.ts` | Estado de Selene AI | ⚠️ LEGACY | **REVISAR** |
| `audioStore.ts` | Métricas de audio | ⚠️ DUPLICADO | Fusionar con truthStore |
| `dmxStore.ts` | Configuración DMX | ✅ FUNCIONAL | **CONSERVAR** |
| `setupStore.ts` | Configuración inicial | ✅ FUNCIONAL | **CONSERVAR** |
| `logStore.ts` | Logs de sistema | ✅ SIMPLE | **CONSERVAR** |
| `luxsyncStore.ts` | Estado general de la app | ⚠️ LEGACY | **REVISAR** |

### 🔑 Stores Críticos (El Cerebro de la UI):

```
┌─────────────────────────────────────────────────────────────────┐
│                        truthStore                               │
│        (Backend → Frontend: SINGLE SOURCE OF TRUTH)             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ selectionStore  │ │  overrideStore  │ │  controlStore   │
│ (Qué está       │ │ (Valores        │ │ (Modo global:   │
│  seleccionado)  │ │  manuales)      │ │  man/flow/ai)   │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             ▼
               ┌─────────────────────────┐
               │   useFixtureRender()    │
               │  (Hook de renderizado)  │
               └─────────────────────────┘
```

---

## 2. 🎯 MOTOR DE SELECCIÓN (selectionStore.ts)

### Estado: ✅ EXCELENTE

**Ubicación**: `src/stores/selectionStore.ts` (316 líneas)

**Funcionalidades Implementadas**:
- ✅ `selectedIds: Set<string>` - Multi-selección nativa
- ✅ `hoveredId: string | null` - Hover tracking
- ✅ `lastSelectedId` - Para Shift+Click range
- ✅ `SelectionMode: 'replace' | 'add' | 'remove' | 'toggle'`
- ✅ `selectRange()` - Shift+Click range selection
- ✅ `toggleSelection()` - Ctrl+Click toggle
- ✅ `selectMultiple()` - Box selection ready
- ✅ `invertSelection()` - Inversión de selección

**Integración con Fixture3D.tsx**:
```typescript
// Fixture3D.tsx línea 189-207
const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
  if (nativeEvent.shiftKey && lastSelectedId) {
    selectRange(lastSelectedId, id, allFixtureIds)  // ✅ Range
  } else if (nativeEvent.ctrlKey || nativeEvent.metaKey) {
    toggleSelection(id)  // ✅ Toggle
  } else {
    select(id, 'replace')  // ✅ Replace
  }
})
```

### 🔴 Problema Detectado: NO HAY GRUPOS

El concepto de "Grupos" (ej: "Truss Izquierda", "Moving Heads") **NO EXISTE** en el código.
Los fixtures solo tienen `id` individual. Para grupos tendríamos que:

1. Añadir `groups: Map<string, string[]>` al selectionStore
2. O usar un `groupStore.ts` separado
3. Implementar `selectGroup(groupId)` action

### Veredicto: **CONSERVAR** - Bien implementado, añadir grupos

---

## 3. 🔧 FLUJO DE CONTROL (Manual vs IA)

### Arquitectura Actual (JERARQUÍA DE PRIORIDAD):

```
┌────────────────────────────────────────────────────────────────┐
│  PRIORIDAD 1: PER-FIXTURE OVERRIDE (TOP - Siempre gana)       │
│  Fuente: overrideStore                                         │
│  Activa cuando: Usuario toca Inspector (color, pan/tilt, etc.) │
└─────────────────────────┬──────────────────────────────────────┘
                          │ (si no hay override)
                          ▼
┌────────────────────────────────────────────────────────────────┐
│  PRIORIDAD 2: FLOW MODE (Color & Movement Override)           │
│  Fuente: controlStore.flowParams                               │
│  Activa cuando: globalMode === 'flow'                          │
└─────────────────────────┬──────────────────────────────────────┘
                          │ (si no está en flow)
                          ▼
┌────────────────────────────────────────────────────────────────┐
│  PRIORIDAD 3: SELENE AI (BASE - Backend Control)              │
│  Fuente: truthStore (datos del backend via IPC)                │
│  Activa cuando: globalMode === 'selene' o null                 │
└────────────────────────────────────────────────────────────────┘
```

### Ubicación del Merge Logic: `useFixtureRender.ts`

```typescript
// useFixtureRender.ts línea 28-180
export function calculateFixtureRenderValues(
  truthData,      // Base: Selene AI
  globalMode,     // Manual/Flow/Selene
  flowParams,     // Flow patterns
  fixtureOverride, // Manual overrides
  overrideMask,   // Qué canales están lockeados
) {
  // 1. Start with truthData (Selene AI)
  let color = truthData?.color
  let pan = truthData?.pan
  
  // 2. Apply Flow if globalMode === 'flow' AND no override
  if (globalMode === 'flow' && !overrideMask?.position) {
    const movement = calculateMovement(flowParams)
    pan = movement.pan
  }
  
  // 3. Apply Override if exists (TOP PRIORITY)
  if (overrideMask?.position && fixtureOverride?.pan !== undefined) {
    pan = fixtureOverride.pan / 540
  }
}
```

### ¿Override Manager?

**SÍ EXISTE**: `overrideStore.ts` con:
- `ChannelMask`: `{ color, dimmer, position, optics }` - Define qué está "bloqueado"
- `setOverride()` - Aplica override con máscara
- `clearOverride()` - Libera control a Selene

### 🟡 Problema Menor:
No hay **indicación visual clara** de qué canales están en override.
El usuario no sabe si Selene está siendo ignorada para color pero no para pan/tilt.

### Veredicto: **CONSERVAR** - Arquitectura limpia, mejorar feedback visual

---

## 4. 📐 ANATOMÍA DE LA SIDEBAR

### Estructura de Componentes:

```
src/components/
├── layout/
│   └── Sidebar.tsx           ← NAVEGACIÓN PRINCIPAL (tabs: Live, Setup, Core)
│
└── views/
    └── StageViewDual/
        └── sidebar/
            ├── StageSidebar.tsx       ← WRAPPER contextual
            ├── GlobalControls.tsx     ← Cuando NO hay selección
            ├── InspectorControls.tsx  ← Cuando HAY selección
            ├── ColorPicker.tsx        ← HSL color wheel
            ├── DimmerSlider.tsx       ← Slider 0-100%
            ├── PanTiltControl.tsx     ← XY Pad para movimiento
            ├── PaletteControlMini.tsx ← Living Palettes (Fuego, Hielo, etc.)
            └── widgets/
                └── MovementRadar.tsx  ← Kinetic Radar (Flow patterns)
```

### Análisis por Componente:

#### `Sidebar.tsx` (Navegación Principal)
- **Estado**: ✅ LIMPIO
- **Función**: Solo tabs de navegación (Live, Setup, Simulate, Core)
- **Líneas**: 73 líneas
- **Veredicto**: **CONSERVAR**

#### `GlobalControls.tsx` (Sin Selección)
- **Estado**: ✅ LIMPIO
- **Muestra**: Palette picker, AI toggle, Release All
- **Líneas**: 98 líneas
- **Problema**: MovementRadar (Flow mode) podría confundir con Selene activo
- **Veredicto**: **REFACTORIZAR** - Esconder Radar si globalMode !== 'flow'

#### `InspectorControls.tsx` (Con Selección)
- **Estado**: ⚠️ FUNCIONAL PERO HARDCODEADO
- **Muestra**: ColorPicker, Dimmer, Pan/Tilt (si hay movers)
- **Líneas**: 327 líneas
- **Problemas**:
  1. Detecta "moving heads" por string matching (`type.includes('moving')`) - Frágil
  2. Pattern selector (circle, figure8) mezcla Flow patterns con Selene - CONFUSO
  3. No muestra capabilities reales del fixture (channels DMX)
- **Veredicto**: **REFACTORIZAR** - Leer capabilities de truthStore

#### `ColorPicker.tsx`
- **Estado**: ✅ FUNCIONAL
- **Tipo**: HSL wheel
- **Veredicto**: **CONSERVAR**

#### `PanTiltControl.tsx`
- **Estado**: ✅ FUNCIONAL
- **Tipo**: XY Pad con constraints de fixture
- **Veredicto**: **CONSERVAR**

### 🔴 CÓDIGO MUERTO DE FLOW MODE:

En `InspectorControls.tsx` líneas 55-60:
```typescript
// 🔄 WAVE 153.13: Estado para patrón de movimiento
const [movementPattern, setMovementPattern] = useState<MovementPatternType>('static')
const [patternAmplitude, setPatternAmplitude] = useState(50) // 0-100%
const [patternSpeed, setPatternSpeed] = useState(50) // 0-100%
```

Esto es **FLOW MODE LEGACY** mezclado con Inspector. Debería estar en GlobalControls, no aquí.

### Veredicto Sidebar: **70% CONSERVAR, 30% REFACTORIZAR**

---

## 5. ⌨️ INPUTS Y TECLADO

### Sistema Actual: `KeyboardProvider.tsx`

**Ubicación**: `src/providers/KeyboardProvider.tsx` (107 líneas)

**Shortcuts Implementados**:
| Tecla | Acción | Estado |
|-------|--------|--------|
| `Space` | Blackout Toggle | ✅ FUNCIONA |
| `1-6` | Effects Toggle (Strobe, Blinder, etc.) | ✅ FUNCIONA |
| `Tab` | Next Tab | ✅ FUNCIONA |
| `Shift+Tab` | Previous Tab | ✅ FUNCIONA |
| `Escape` | Release Blackout | ✅ FUNCIONA |

### 🔴 SHORTCUTS FALTANTES (Críticos para Pro):

| Tecla | Acción Esperada | Estado |
|-------|-----------------|--------|
| `A` | Select All Fixtures | ❌ NO EXISTE |
| `D` | Deselect All | ❌ NO EXISTE |
| `G` | Group Selection | ❌ NO EXISTE |
| `Delete` | Clear Overrides | ❌ NO EXISTE |
| `←→↑↓` | Nudge Pan/Tilt | ❌ NO EXISTE |
| `+/-` | Nudge Dimmer | ❌ NO EXISTE |
| `0-9` | Quick Select Fixture | ❌ NO EXISTE |
| `F1-F12` | Load Scene/Cue | ❌ NO EXISTE |

### Timecoder:
**NO EXISTE** en el código. El usuario mencionó "Timecoder" pero no hay implementación.
Sería un sistema de:
1. Recibir SMPTE/MTC timecode
2. Sincronizar cues/escenas con timecode

### Veredicto Teclado: **FUNCIONAL pero BÁSICO** - Necesita expansión

---

## 6. 🎯 PUNTOS DE DOLOR

### 🔴 Críticos (Deben arreglarse):

1. **NO HAY GRUPOS** - Imposible controlar "Truss Izquierda" como unidad
2. **Capabilities Hardcodeadas** - Inspector no lee channels reales del fixture
3. **Confusión Flow/Selene** - MovementRadar aparece aunque Selene esté activo
4. **Sin Feedback de Override** - Usuario no sabe qué canales controla él vs la IA

### 🟡 Medios (Deberían mejorarse):

5. **Shortcuts Básicos** - Faltan atajos profesionales (nudge, quick select)
6. **Pattern Selector en Inspector** - Mezcla Flow patterns con control manual
7. **audioStore Duplicado** - Debería fusionarse con truthStore

### 🟢 Menores (Nice to have):

8. **Timecoder** - No existe (futuro feature)
9. **Touch Support** - No optimizado para tablets

---

## 7. 📋 COMPONENTES: CONSERVAR vs TIERRA QUEMADA

### ✅ CONSERVAR (Recuperables):

| Componente | Razón |
|------------|-------|
| `selectionStore.ts` | Excelente arquitectura |
| `overrideStore.ts` | Lógica de merge limpia |
| `controlStore.ts` | Estados globales bien definidos |
| `truthStore.ts` | Single Source of Truth |
| `useFixtureRender.ts` | Hook de prioridad bien implementado |
| `Sidebar.tsx` | Navegación simple |
| `ColorPicker.tsx` | Funcional |
| `PanTiltControl.tsx` | Funcional |
| `DimmerSlider.tsx` | Funcional |
| `KeyboardProvider.tsx` | Base sólida para expandir |

### ⚠️ REFACTORIZAR:

| Componente | Cambios Necesarios |
|------------|-------------------|
| `InspectorControls.tsx` | Leer capabilities dinámicas, quitar patterns |
| `GlobalControls.tsx` | Esconder Radar si no está en Flow |
| `sceneStore.ts` | Simplificar API |
| `MovementRadar.tsx` | Solo visible en Flow mode |

### 🔥 TIERRA QUEMADA:

| Componente | Razón |
|------------|-------|
| Pattern logic en InspectorControls | Pertenece a Flow mode, no a Inspector |
| String matching para fixture types | Usar capabilities del profile |
| audioStore duplicado | Fusionar con truthStore |
| Código WAVE 153.13 en Inspector | Es Flow mode legacy |

---

## 8. 🗺️ ROADMAP UX SUGERIDO

### Fase 1: LIMPIEZA
1. Eliminar pattern logic de InspectorControls
2. Mover MovementRadar al Flow mode panel
3. Fusionar audioStore → truthStore

### Fase 2: GRUPOS
1. Crear `groupStore.ts`
2. UI para crear/editar grupos
3. Atajos de teclado para grupos (G = group, 1-9 = select group)

### Fase 3: CONTEXTUALIDAD RADICAL
1. Inspector lee capabilities del fixture profile
2. Solo muestra controles relevantes (si es par, no pan/tilt)
3. Feedback visual de canales en override vs AI

### Fase 4: PRO SHORTCUTS
1. Nudge controls (←→↑↓ para pan/tilt, +/- para dimmer)
2. Quick select (0-9 para fixture)
3. Quick save/load scenes (F1-F12)

### Fase 5: POLISH
1. Tooltips con shortcuts
2. Touch optimization
3. Animations para feedback inmediato

---

## 🎬 CONCLUSIÓN

La UI de LuxSync **NO ES UN DESASTRE**. Es un sistema coherente con arquitectura sólida de Zustand stores. Los problemas principales son:

1. **Confusión conceptual** entre Flow mode y Selene (patrones en Inspector)
2. **Hardcoding** en lugar de leer capabilities del fixture
3. **Falta de Grupos** (feature crítico para uso profesional)
4. **Shortcuts básicos** (solo blackout y effects)

Con las refactorizaciones sugeridas, podemos tener una UI **cyberpunk 90s moderna** sin reescribir todo.

---

*"La mejor UX no es la más bonita, es la que desaparece para dejar fluir la creatividad."*  
— PunkOpus, Operación GRANDMA KILLER

