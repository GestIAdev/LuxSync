# WAVE 2041: SIMULATOR ARCHITECTURE AUDIT 🔍

**Estado:** POST-CHRONOS PERFECTION — Preparación para Redesign Total  
**Fecha:** Diciembre 2024  
**Objetivo:** Auditoría completa de `/src/components/simulator` para equiparar calidad a Chronos/Hephaestus

---

## 📋 EXECUTIVE SUMMARY

El sistema Live View (`/components/simulator`) está **fragmentado, funcional pero desactualizado**. Después de completar Chronos Studio (WAVES 2040.33-41), esta auditoría revela:

**🔴 PROBLEMAS CRÍTICOS:**
1. **StageSimulator2 NO USA CANONICAL ZONES** - Mapeo manual hardcoded que ignora `normalizeZone()` (WAVE 2040.24)
2. **Tipos de zona contradictorios** - 2D usa `'front'|'back'|'left'|'right'|'center'`, Sistema usa 9 zonas canónicas
3. **Legacy code masivo** - Comentarios/headers desde WAVE 24-379 (estamos en WAVE 2041)
4. **3D Render quality issues** - Documentado como "oscuro y feucho" en WAVE 433

**✅ PUNTOS FUERTES:**
- **Arquitectura WAVE 436 consolidada** - Todo en `/components/simulator/` (vs 4 carpetas en WAVE 433)
- **Hybrid Rendering (WAVE 379.5)** - Geometría local (stageStore) + Estado truth (truthStore)
- **Control system limpio** - TheProgrammer accordion + GroupsPanel eliminó duplicación
- **Dual View funcional** - StageViewDual alterna 2D/3D sin crashes

**🎯 VEREDICTO:**
Sistema estable y funcional, pero **arquitectónicamente rezagado** respecto a Chronos. Necesita:
1. Migración a Canonical Zones (9 zonas semánticas)
2. Modernización de renderizado 2D/3D
3. UI polish (match Chronos aesthetic)
4. Eliminación de legacy comments/code

---

## 🗺️ ARQUITECTURA ACTUAL (POST-WAVE 436)

### Estructura de Carpetas

```
components/simulator/
├── views/                       📁 Componentes de vista principales
│   ├── StageViewDual.tsx        🎭 WAVE 700.4: Vista dual 2D/3D con StatusBar
│   ├── StageViewDual.css
│   ├── SimulateView/            📁 Renderizado 2D
│   │   ├── StageSimulator2.tsx  🎬 WAVE 436: Canvas 2D neon stage
│   │   └── index.tsx            🔥 WAVE 24.10: DMX Store integration
│   └── stage3d/                 📁 Renderizado 3D
│       ├── Stage3DCanvas.tsx    🎬 WAVE 436: R3F canvas
│       ├── fixtures/            💡 Fixture3D, MovingHead3D, ParCan3D
│       ├── environment/         🏟️ StageFloor, StageTruss
│       └── controls/            📷 Orbit controls
│
├── controls/                    📁 Paneles de control
│   ├── TheProgrammer.tsx        ⭐ WAVE 432: Control panel con tabs
│   ├── TheProgrammerContent.tsx ⭐ WAVE 432.5: Controles sin tabs (para Sidebar)
│   ├── GroupsPanel.tsx          ⭐ WAVE 432: System + User groups
│   ├── IntensitySection.tsx     💡 Dimmer control
│   ├── ColorSection.tsx         🎨 HSL picker
│   ├── PositionSection.tsx      🕹️ Pan/Tilt (WAVE 428.5)
│   ├── BeamSection.tsx          ⚡ Speed/Patterns (WAVE 428.5)
│   ├── sidebar/                 📁 Sidebar components
│   │   ├── StageSidebar.tsx     🎯 WAVE 432.5: 3 tabs (CONTROLS|GROUPS|SCENES)
│   │   ├── SceneBrowser.tsx     🎬 WAVE 32: Scene management
│   │   └── widgets/             📁 (vacío)
│   └── controls/                📁 Sub-widgets (XYPad, PatternSelector, PrecisionInputs)
│
├── widgets/                     📁 (vacío - para futura expansión)
├── engine/                      📁 (vacío - para lógica de negocio)
└── index.ts                     📦 Exports públicos
```

---

## 🎭 COMPONENTE: StageViewDual (Vista Principal)

### Estado Actual
- **Archivo:** `/components/simulator/views/StageViewDual.tsx`
- **Versión:** WAVE 700.4 (The Cockpit Redesign)
- **Líneas:** 230 (limpio y legible)
- **Responsabilidad:** Vista dual que alterna entre Canvas 2D y R3F 3D

### Características
#### ✅ Top StatusBar (Monitoring Only)
```tsx
📊 Indicadores: BPM + Energy Bar + Mood (auto-inferido de audio)
🧨 Utility Buttons: FORCE STRIKE + Debug Toggle
🔄 ViewModeSwitcher: 2D Tactical ↔ 3D Visualizer
```

#### ✅ Main Content
```tsx
- Viewport Container (switch entre StageSimulator2 o Stage3DCanvas)
- Floating Mode Indicator ("📐 TACTICAL 2D" / "🎬 VISUALIZER 3D")
- Sidebar Reopen Button (cuando está cerrado)
```

#### ✅ Sidebar (WAVE 432.5)
```tsx
StageSidebar con 3 tabs:
  - CONTROLS: TheProgrammerContent (accordion con secciones)
  - GROUPS: GroupsPanel (system + user groups)
  - SCENES: SceneBrowser (scene management)
```

### Integración con Stores
| Store | Selectores | Propósito |
|-------|-----------|-----------|
| **controlStore** | `viewMode`, `is3D`, `showDebugOverlay` | Control de vista y debug |
| **truthStore** | `sensory` (BPM, energy, mood) | Monitoring del audio |
| **selectionStore** | `selectedIds` | Sidebar badge count |
| **sceneStore** | `sceneCount` | Scenes tab badge |

### Calidad del Código
- ✅ **TypeScript:** Tipos explícitos, props interface clara
- ✅ **Modularidad:** Lazy loading de Stage3DCanvas (componente pesado)
- ✅ **React Best Practices:** useCallback, useMemo, Suspense con fallback
- ⚠️ **Legacy comments:** Header menciona WAVE 700.4 pero código es posterior (WAVE 436 consolidation)

### Issues Detectados
1. ⚠️ **BPM/Mood logic duplicada** - Comentario menciona "different from MoodController" pero no está claro si hay conflicto
2. ⚠️ **forceStrike call** - Usa `window.lux?.forceStrike` (IPC bridge) pero no valida respuesta
3. ✅ **No zone-related code** - No manipula zonas directamente (delega a renderers)

---

## 🎨 COMPONENTE: StageSimulator2 (Renderizado 2D)

### Estado Actual
- **Archivo:** `/components/simulator/views/SimulateView/StageSimulator2.tsx`
- **Versión:** WAVE 436 (header) pero con legacy desde WAVE 24
- **Líneas:** 1105 (componente masivo)
- **Responsabilidad:** Canvas 2D neon stage con cyberpunk grid

### Arquitectura
#### ✅ Hybrid Rendering (WAVE 379.5)
```tsx
GEOMETRY → stageStore (local, siempre disponible)
STATE (color/intensity) → truthStore vía calculateFixtureRenderValues()
Graceful degradation: fixtures visibles pero OFF si backend está offline
```

### 🔴 PROBLEMA CRÍTICO: ZONE MAPPING HARDCODED

#### Código Actual (Líneas 206-226)
```tsx
// ❌ NO USA normalizeZone() canónico
const backendZone = (runtimeState?.zone || fixture.zone || '').toUpperCase();
let zone: FixtureVisual['zone'] = 'center';

// Mapping manual legacy con strings hardcoded
if (backendZone.includes('MOVING_LEFT') || backendZone === 'LEFT' || backendZone.includes('CEILING-LEFT')) {
  zone = 'left';
  posLayout = zonePositions.movingLeft[i % zonePositions.movingLeft.length];
} else if (backendZone.includes('MOVING_RIGHT') || backendZone === 'RIGHT' || backendZone.includes('CEILING-RIGHT')) {
  zone = 'right';
  posLayout = zonePositions.movingRight[i % zonePositions.movingRight.length];
} else if (backendZone.includes('FRONT') || backendZone.includes('CEILING-FRONT')) {
  zone = 'front';
  posLayout = zonePositions.frontPars[i % zonePositions.frontPars.length];
} else if (backendZone.includes('BACK') || backendZone.includes('CEILING-BACK')) {
  zone = 'back';
  posLayout = zonePositions.backPars[i % zonePositions.backPars.length];
} else {
  zone = 'center';
  posLayout = zonePositions.strobes[i % zonePositions.strobes.length];
}
```

#### Comparación con Sistema Canónico (WAVE 2040.24)

| Sistema 2D (StageSimulator2) | Sistema Canónico (ShowFileV2) |
|------------------------------|-------------------------------|
| ❌ 5 zonas custom: `'front' \| 'back' \| 'left' \| 'right' \| 'center'` | ✅ 9 zonas semánticas: CanonicalZone |
| ❌ Mapping manual con `.includes()` strings | ✅ Función `normalizeZone()` determinista |
| ❌ Tipo `FixtureVisual['zone']` no compatible | ✅ Tipo `CanonicalZone` exportado y documentado |
| ❌ Ignora `normalizeZone()` existente | ✅ Normalizer acepta CUALQUIER legacy string |
| ❌ No maneja `'floor'`, `'air'`, `'ambient'` | ✅ Maneja las 9 zonas + todos los legacy |

#### Zonas Canónicas (WAVE 2040.24)
```typescript
// De ShowFileV2.ts líneas 254-264
export const CANONICAL_ZONES: readonly CanonicalZone[] = [
  'front',         // 🔴 PARs frontales (audience-facing wash)
  'back',          // 🔵 PARs traseros (counter/backlight)
  'floor',         // ⬇️ PARs de suelo (uplight)
  'movers-left',   // 🏎️ Cabezas móviles lado izquierdo
  'movers-right',  // 🏎️ Cabezas móviles lado derecho
  'center',        // ⚡ Strobes/Blinders centrales
  'air',           // ✨ Lásers/Aerials/Atmósfera
  'ambient',       // 🌫️ House lights/ambiente
  'unassigned',    // ❓ Sin asignar
] as const
```

#### Consecuencias del Desacople
1. 🔴 **Inconsistencia Semántica** - 2D no respeta las 9 zonas canónicas
2. 🔴 **Fixtures mal posicionados** - `'floor'`, `'air'`, `'ambient'` caen en `'center'` por default
3. 🔴 **Type Safety quebrado** - `FixtureVisual['zone']` no es compatible con `CanonicalZone`
4. 🔴 **Mantenimiento duplicado** - Cambios en ShowFileV2 no se reflejan en renderer 2D

### Solución Propuesta
```tsx
// ✅ CORRECTO: Usar normalizer canónico
import { normalizeZone, type CanonicalZone } from '../../../../core/stage/ShowFileV2'

interface FixtureVisual {
  id: string
  x: number
  y: number
  r: number
  g: number
  b: number
  intensity: number
  pan: number
  tilt: number
  type: 'par' | 'moving' | 'strobe' | 'laser'
  zone: CanonicalZone  // ✅ Usar tipo canónico
  // ... resto de campos
}

// En fixture processing:
const rawZone = runtimeState?.zone || fixture.zone || ''
const zone = normalizeZone(rawZone)  // ✅ Una sola línea, determinista

// Mapping de zonas canónicas a layout positions
const ZONE_TO_LAYOUT: Record<CanonicalZone, keyof typeof zonePositions> = {
  'front':         'frontPars',
  'back':          'backPars',
  'floor':         'frontPars',      // Floor uplight usa posiciones front
  'movers-left':   'movingLeft',
  'movers-right':  'movingRight',
  'center':        'strobes',
  'air':           'strobes',        // Air fixtures centrales
  'ambient':       'strobes',        // Ambient también central
  'unassigned':    'strobes',        // Default
}

const layoutKey = ZONE_TO_LAYOUT[zone]
posLayout = zonePositions[layoutKey][i % zonePositions[layoutKey].length]
```

### Otras Issues de StageSimulator2
1. ⚠️ **Componente monolítico** - 1105 líneas, debe split en sub-componentes
2. ⚠️ **Legacy comments** - Referencias a WAVE 24, 25, 30, 33, 34, 339, 379 (código estable pero headers viejos)
3. ⚠️ **ZONE_CONFIG hardcoded** (líneas 81-95) - Split stereo zones con xRange hardcoded
4. ⚠️ **Quality mode no se usa** - Estado `qualityMode` definido pero no afecta rendering
5. ⚠️ **Debug overlay parcial** - `showDebugOverlay` solo afecta algunos elementos

---

## 🎬 COMPONENTE: Stage3DCanvas (Renderizado 3D)

### Estado Actual
- **Archivo:** `/components/simulator/views/stage3d/Stage3DCanvas.tsx`
- **Versión:** WAVE 436 (header) con legacy desde WAVE 30
- **Líneas:** 320
- **Responsabilidad:** React Three Fiber canvas para visualización 3D

### Arquitectura
#### ✅ Hybrid Rendering (WAVE 379.5)
```tsx
GEOMETRY → stageStore vía selectFixtureStructure() custom selector
STATE (color/intensity) → useFixtureRender hook + transient store inside Fixture3D
Lazy Loading: Stage3DCanvas se carga con React.lazy() en StageViewDual
```

### Stack Tecnológico
- **React Three Fiber** (R3F) - Wrapper React para Three.js
- **@react-three/drei** - Helpers (OrbitControls, PerspectiveCamera, Stats)
- **Three.js** - WebGL 3D engine
- **Custom Hooks:** `useFixtureRender` para render values

### Componentes 3D
| Componente | Archivo | Responsabilidad |
|-----------|---------|-----------------|
| **Stage3DCanvas** | Stage3DCanvas.tsx | Canvas principal R3F |
| **WebGLContextHandler** | Stage3DCanvas.tsx | Manejo de context lost/restored |
| **SmartFixture3D** | Stage3DCanvas.tsx | Wrapper memoized para Fixture3D |
| **Fixture3D** | fixtures/Fixture3D.tsx | Fixture individual con physics (WAVE 378) |
| **MovingHead3D** | fixtures/MovingHead3D.tsx | Mover con beam volumétrico |
| **ParCan3D** | fixtures/ParCan3D.tsx | PAR con cone light |
| **StageFloor** | environment/StageFloor.tsx | Suelo con grid |
| **StageTruss** | environment/StageTruss.tsx | Truss estructural |

### Selector Custom (Optimización)
```tsx
// ✅ WAVE 379.5: Selector optimizado - solo re-render si cambian IDs o cantidad
const selectFixtureStructure = (state) => {
  const fixtures = state.fixtures || []
  return fixtures.map((f) => ({
    id: f?.id || `fixture-${f?.address}`,
    name: f?.name || '',
    type: f?.type || '',
    zone: f?.zone || '',  // ⚠️ ZONE aquí NO se normaliza
    address: f?.address,
  }))
}

const fixtureStructureEquals = (a, b) => {
  if (a.length !== b.length) return false
  return a.every((fixture, i) => fixture.id === b[i]?.id)
}
```

### 🟡 ZONA HANDLING EN 3D
```tsx
// ⚠️ Stage3DCanvas lee fixture.zone de stageStore SIN normalizar
// Luego generateLayout3D() aplica normalizeZone() interno:

// De layoutGenerator3D.ts líneas 198-261:
function normalizeZone(zone: string): string {
  const z = zone.toLowerCase().trim()
  if (z.includes('moving') || z.includes('mover')) return z.includes('right') ? 'mover-right' : 'mover-left'
  if (z.includes('front')) return 'front'
  if (z.includes('back')) return 'back'
  if (z.includes('floor')) return 'floor'
  if (z.includes('strobe') || z.includes('center')) return 'center'
  if (z.includes('air') || z.includes('laser')) return 'air'
  if (z.includes('ambient')) return 'ambient'
  return 'center'  // default
}
```

#### 🔴 PROBLEMA: TRES NORMALIZADORES DIFERENTES
1. **ShowFileV2.normalizeZone()** - Canónico, 9 zonas, determinista, exportado públicamente
2. **layoutGenerator3D.normalizeZone()** - Privado, similar pero NO idéntico, NO usa CANONICAL_ZONES
3. **StageSimulator2 manual mapping** - Hardcoded strings con `.includes()`

**Consecuencia:** Las 3 capas del sistema tienen lógica de zona DIVERGENTE.

### 🔴 3D RENDER QUALITY ISSUES (Histórico)

De **WAVE 433 audit** (línea 380):
```markdown
## 🎨 3D RENDERING QUALITY

**Issues Reportados:**
- "Oscuro y feucho" (WAVE 30 original implementation)
- Beams volumétricos no tan impresionantes como esperado
- Environment textures planas
- Lighting ambient muy bajo
```

**Estado Actual (No Verificado):**
- ✅ WAVE 378: Fixture physics implementado (velocity-based effects)
- ✅ WAVE 379.5: Hybrid rendering con transient store (performance fix)
- ⚠️ Calidad visual NO auditada desde WAVE 433 (200+ waves atrás)
- ❓ No hay screenshots/videos de referencia

### Issues Detectados
1. 🔴 **Zone normalizer duplicado** - layoutGenerator3D tiene su propio normalizer NO canónico
2. ⚠️ **Legacy comments** - Referencias a WAVE 30, 33, 348, 350, 378, 379
3. ⚠️ **WebGL context handling** - Comentarios advierten "NO forzar loseContext()" (crash risk)
4. ⚠️ **Fixture physics** - WAVE 378 añadió physics pero no está claro si se usa realmente
5. ❓ **Render quality** - No hay evidencia de mejoras visuales desde WAVE 433 audit

---

## 🎛️ SISTEMA DE CONTROLES

### TheProgrammer (Control Panel)

#### Estado Actual
- **Archivo:** `/components/simulator/controls/TheProgrammer.tsx`
- **Versión:** WAVE 432
- **Líneas:** ~200
- **Responsabilidad:** Panel de control con tabs CONTROLS|GROUPS

#### Secciones
| Sección | Archivo | Controles |
|---------|---------|-----------|
| **Intensity** | IntensitySection.tsx | Dimmer global + per-fixture |
| **Color** | ColorSection.tsx | HSL color picker |
| **Position** | PositionSection.tsx | Pan/Tilt XY pad (WAVE 428.5) |
| **Beam** | BeamSection.tsx | Speed/Patterns (WAVE 428.5) |

#### Integración con Stores
```tsx
controlStore.overrides   // Per-fixture manual overrides (TOP PRIORITY)
selectionStore          // Fixture selection
truthStore              // Hardware state (read-only monitoring)
```

#### Arquitectura Accordion
```tsx
// ✅ WAVE 432: Custom accordion system con lock buttons
<Accordion>
  <AccordionSection locked={section.locked} onToggleLock={...}>
    {/* Section content */}
  </AccordionSection>
</Accordion>
```

### TheProgrammerContent (Sidebar Version)

#### Estado Actual
- **Archivo:** `/components/simulator/controls/TheProgrammerContent.tsx`
- **Versión:** WAVE 432.5
- **Responsabilidad:** Versión SIN tabs para uso en StageSidebar

#### Diferencia con TheProgrammer
```tsx
TheProgrammer:        Standalone con tabs internos [CONTROLS|GROUPS]
TheProgrammerContent: Solo secciones accordion (tabs manejadas por StageSidebar)
```

### GroupsPanel

#### Estado Actual
- **Archivo:** `/components/simulator/controls/GroupsPanel.tsx`
- **Versión:** WAVE 432
- **Responsabilidad:** System groups + User groups

#### Funcionalidad
```tsx
System Groups: "All Pars", "All Movers", "Strobes", etc. (auto-generados)
User Groups:   Grupos custom creados por usuario
Actions:       Select group → Auto-switch to CONTROLS tab
```

### StageSidebar (Unified Sidebar)

#### Estado Actual
- **Archivo:** `/components/simulator/controls/sidebar/StageSidebar.tsx`
- **Versión:** WAVE 432.5
- **Líneas:** ~110
- **Responsabilidad:** Sidebar con 3 tabs unificadas

#### Tabs
```tsx
CONTROLS:  <TheProgrammerContent /> (accordion sin tabs)
GROUPS:    <GroupsPanel onSwitchToControls={...} />
SCENES:    <SceneBrowser />
```

#### Características
- ✅ **Show/Hide** (no collapse animation, instant)
- ✅ **Floating reopen button** cuando está cerrado
- ✅ **Badge counts** en tabs (selected fixtures, scene count)
- ✅ **Iconos custom** (LuxIcons: ControlsIcon, GroupIcon, ScenesIcon)

### 🟢 CALIDAD DEL CÓDIGO DE CONTROLES

**Veredicto:** Sistema de controles está en **EXCELENTE ESTADO** (post-WAVE 432.5):
- ✅ Eliminó duplicación (InspectorControls deprecado en WAVE 433)
- ✅ Arquitectura modular (secciones independientes)
- ✅ TypeScript strict
- ✅ React hooks correctos (useCallback, useMemo)
- ✅ Store integration limpia
- ✅ No zone-related bugs (delega a truthStore/controlStore)

---

## 🔗 INTEGRACIÓN CANONICAL ZONES

### Análisis de Uso

#### ✅ ShowFileV2.ts (TRUTH SOURCE)
```typescript
// WAVE 2040.24 FASE 1: Definición canónica
export type CanonicalZone = 'front' | 'back' | 'floor' | 'movers-left' | 'movers-right' | 'center' | 'air' | 'ambient' | 'unassigned'
export const CANONICAL_ZONES: readonly CanonicalZone[] = [...]
export function normalizeZone(zone: string | undefined | null): CanonicalZone {...}
```

#### ✅ stageStore.ts (USAGE)
```typescript
// Imports canónicos
import { CanonicalZone, normalizeZone } from '../core/stage/ShowFileV2'

// Uso correcto en updateFixture
updateFixture: (id, updates) => {
  if (updates.zone) {
    updates.zone = normalizeZone(updates.zone)  // ✅ Normaliza antes de guardar
  }
}
```

#### ✅ StagePersistence.ts (USAGE)
```typescript
// WAVE 2040.24: Normaliza fixtures al importar show file
const fixtures = showData.fixtures.map(f => ({
  ...f,
  zone: normalizeZone(f.zone)  // ✅ Migración automática de legacy zones
}))
```

#### ❌ StageSimulator2.tsx (BROKEN)
```tsx
// ❌ NO importa normalizeZone, NO usa CanonicalZone
interface FixtureVisual {
  zone: 'front' | 'back' | 'left' | 'right' | 'center'  // ❌ Tipo custom incompatible
}

// ❌ Mapping manual hardcoded (líneas 206-226)
const backendZone = (runtimeState?.zone || fixture.zone || '').toUpperCase()
if (backendZone.includes('MOVING_LEFT') || ...) zone = 'left'
```

#### ⚠️ layoutGenerator3D.ts (PARTIAL)
```typescript
// ⚠️ Tiene normalizeZone() propio NO canónico
function normalizeZone(zone: string): string {
  // Similar a ShowFileV2 pero NO idéntico
  // No retorna CanonicalZone, retorna string genérico
  // Mapeo ligeramente diferente
}

// ⚠️ Luego usa el valor normalizado para calcular positions
const normalizedZone = normalizeZone(fixture.zone || '')
const positionConfig = zoneConfigs[normalizedZone] || zoneConfigs.center
```

### Matriz de Compatibilidad

| Componente | Usa normalizeZone()? | Usa CanonicalZone type? | Estado |
|-----------|---------------------|------------------------|--------|
| **ShowFileV2** | ✅ Define | ✅ Define | **TRUTH SOURCE** |
| **stageStore** | ✅ Importa y usa | ✅ Importa y usa | **CORRECTO** |
| **StagePersistence** | ✅ Importa y usa | ✅ Importa y usa | **CORRECTO** |
| **StageSimulator2** | ❌ NO | ❌ NO (tipo custom) | **🔴 BROKEN** |
| **layoutGenerator3D** | ⚠️ Propio | ❌ NO (retorna string) | **🟡 PARTIAL** |
| **Stage3DCanvas** | ⚠️ Indirecto via layout | ❌ NO | **🟡 DELEGATED** |
| **Controles (TheProgrammer)** | ✅ Delega a stores | ✅ Delega a stores | **✅ CORRECTO** |

### Consecuencias del Desacople

#### 🔴 SCENARIO 1: Nuevo Fixture con zona `'floor'`
```typescript
// Backend/stageStore:
fixture.zone = 'floor'  // ✅ CanonicalZone válida

// StageSimulator2 (2D):
// ❌ No reconoce 'floor', cae en default 'center'
// Fixture de suelo aparece MAL POSICIONADO en el centro

// Stage3DCanvas (3D):
// ✅ layoutGenerator3D.normalizeZone('floor') → 'floor'
// Posicionado correctamente en suelo
```
**Resultado:** Fixture en diferentes posiciones en 2D vs 3D.

#### 🔴 SCENARIO 2: Legacy Zone `'CEILING-LEFT'`
```typescript
// ShowFileV2:
normalizeZone('CEILING-LEFT') → 'movers-left'  // ✅

// StageSimulator2:
if (backendZone.includes('CEILING-LEFT')) zone = 'left'  // ❌ 'left' no es CanonicalZone

// layoutGenerator3D:
normalizeZone('CEILING-LEFT') → 'mover-left'  // ⚠️ Similar pero NO idéntico string
```
**Resultado:** 3 sistemas con 3 valores diferentes.

#### 🔴 SCENARIO 3: Zona `'air'` (Lásers)
```typescript
// ShowFileV2:
normalizeZone('air') → 'air'  // ✅ Zona canónica

// StageSimulator2:
// ❌ No tiene case para 'air', cae en default 'center'
// Láser aparece en posición de strobe

// layoutGenerator3D:
normalizeZone('air') → 'air'  // ✅ Reconocida
```
**Resultado:** Láser mal posicionado en 2D, bien posicionado en 3D.

---

## 📊 LEGACY CODE AUDIT

### Comentarios Obsoletos

| Archivo | WAVE Header | Líneas Legacy | Código Real |
|---------|-------------|--------------|-------------|
| **StageSimulator2.tsx** | WAVE 436 | WAVE 24, 25, 30, 33, 34, 339, 379 | ✅ Funciona (no tocar logic) |
| **Stage3DCanvas.tsx** | WAVE 436 | WAVE 30, 33, 348, 350, 378, 379 | ✅ Funciona (actualizar headers) |
| **Fixture3D.tsx** | WAVE 378 | WAVE 30, 33.1, 348-378 | ✅ Funciona (actualizar headers) |
| **StageViewDual.tsx** | WAVE 700.4 | WAVE 33.3 | ✅ Actualizado (solo header viejo) |
| **SimulateView/index.tsx** | WAVE 24.10 | WAVE 24.10 (DMX Store) | 🟡 Legacy core, no tocar |

### Código Comentado

#### StageSimulator2.tsx - WAVE 339 Debug Comments
```tsx
// 🎬 WAVE 339: Get current vibe for debug overlay
const currentVibe = useTruthStore(state => state.truth.system.vibe) || 'idle'

// 🎬 WAVE 339: Debug overlay shows vibe, zoom%, speed on each fixture
const [showDebugOverlay, setShowDebugOverlay] = useState(false)
```
**Estado:** Código activo pero debug overlay parcialmente implementado.

#### Stage3DCanvas.tsx - WAVE 379.3 WebGL Warning
```tsx
// 🔥 WAVE 379.3: NO hacer nada en cleanup
// React + R3F manejan el dispose automáticamente cuando el componente se desmonta
// Forzar loseContext() causa "Zombie Renderer" crash
return () => {
  // ... cleanup WITHOUT loseContext()
}
```
**Estado:** Warning crítico preservado correctamente.

### Código Deprecado (Pendiente de Eliminar)

De **WAVE 433 audit**:
```markdown
LEGACY ELIMINADO EN WAVE 434-436:
❌ /components/programmer/ScenesPlaceholder.tsx (reemplazado por SceneBrowser)
❌ /components/views/StageViewDual/sidebar/InspectorControls.tsx (reemplazado por TheProgrammer)
❌ /components/views/StageViewDual/sidebar/ColorPicker.tsx (sub-widget legacy)
❌ /components/views/StageViewDual/sidebar/DimmerSlider.tsx (sub-widget legacy)
❌ /components/views/StageViewDual/sidebar/PanTiltControl.tsx (sub-widget legacy)
```
**Veredicto:** Legacy cleanup completado en WAVE 436 consolidation. ✅

---

## 🎯 COMPARACIÓN CON CHRONOS/HEPHAESTUS

### Chronos Studio (Referencia de Calidad)

**WAVES 2040.33-41 Achievement:**
- ✅ Arsenal carousel con chevron navigation (200px vibes, 64px pads, 8 columns)
- ✅ ContextualDataSheet V2 con hologram HUD + animated neon border
- ✅ Timeline rendering perfecto (Nuclear Option: CSS `!important` + ResizeObserver)
- ✅ Infinite Horizon fix (grid + waveform render from screen width, not logical viewport)
- ✅ Zero bugs, zero artifacts, polished UX

**Características de Calidad:**
- **ResizeObserver API** con empty dependencies (trust browser timing)
- **CSS Force Override** (`width: 100% !important`)
- **Component split** (Timeline 600 líneas → multiple sub-components)
- **Type safety** estricto (TypeScript sin `any`)
- **Modern React** (useCallback, useMemo, ref patterns)
- **Visual polish** (neon borders, animated gradients, cyberpunk aesthetic)

### Simulator (Estado Actual)

| Aspecto | Chronos Studio | Live View Simulator | Gap |
|---------|---------------|---------------------|-----|
| **Component Size** | ✅ <600 líneas | ❌ 1105 líneas (StageSimulator2) | 🔴 Refactor needed |
| **Type Safety** | ✅ Strict TS | ⚠️ Partial (custom zone types) | 🟡 Zone types broken |
| **Legacy Code** | ✅ None | ❌ Comments desde WAVE 24 | 🟡 Cosmetic |
| **Architecture** | ✅ Modular | ⚠️ Monolith (StageSimulator2) | 🟡 Split needed |
| **Visual Polish** | ✅ Neon HUD | ⚠️ Basic canvas | 🔴 UI upgrade needed |
| **Data Flow** | ✅ Single source | ⚠️ Zone mapping divergente | 🔴 Critical fix |
| **Rendering** | ✅ Browser-native APIs | ⚠️ Custom timing | 🟡 OK pero optimizable |
| **Error Handling** | ✅ Graceful degradation | ✅ Hybrid rendering (OK) | ✅ Match |

### Brecha de Calidad

#### 🔴 CRITICAL GAPS
1. **Zone System Divergente** - 3 normalizadores diferentes, tipos incompatibles
2. **Component Monolith** - StageSimulator2 con 1105 líneas debe split
3. **3D Render Quality** - No mejorado desde WAVE 433 ("oscuro y feucho")

#### 🟡 MODERATE GAPS
4. **Legacy Comments** - Headers desde WAVE 24-379 (cosmético pero confuso)
5. **Visual Polish** - Canvas básico vs Chronos neon aesthetic
6. **Debug Overlay** - Parcialmente implementado (WAVE 339)

#### ✅ STRENGTHS (Ya al nivel de Chronos)
- **Hybrid Rendering** (WAVE 379.5) - Graceful degradation igual que Chronos
- **Control System** (WAVE 432.5) - Limpio, modular, sin duplicación
- **Store Integration** - Clean separation of concerns
- **React Best Practices** - Hooks, memo, lazy loading correctos

---

## 🚨 PROBLEMAS PRIORIZADOS

### P0: CRITICAL (Bloquea redesign)
1. **[P0] Zone Normalization Divergente**
   - **Archivo:** `StageSimulator2.tsx` líneas 206-226
   - **Issue:** Hardcoded manual mapping, ignora `normalizeZone()` canónico
   - **Impact:** Fixtures mal posicionados, tipos incompatibles
   - **Fix:** Importar `normalizeZone()`, usar `CanonicalZone` type, rehacer mapping
   - **Effort:** 2-3 horas

2. **[P0] layoutGenerator3D Zone Normalizer Duplicado**
   - **Archivo:** `layoutGenerator3D.ts` líneas 198-261
   - **Issue:** Normalizer propio NO idéntico a ShowFileV2
   - **Impact:** 3D positions pueden diverger de 2D
   - **Fix:** Eliminar normalizer local, importar ShowFileV2.normalizeZone()
   - **Effort:** 1 hora

### P1: HIGH (Mejora calidad)
3. **[P1] StageSimulator2 Component Split**
   - **Archivo:** `StageSimulator2.tsx` (1105 líneas)
   - **Issue:** Monolito difícil de mantener
   - **Fix:** Split en:
     - `StageSimulator2.tsx` (container, 200 líneas)
     - `FixtureRenderer.tsx` (fixture drawing logic)
     - `GridRenderer.tsx` (background grid)
     - `HitTestManager.tsx` (mouse interaction)
   - **Effort:** 4-6 horas

4. **[P1] 3D Render Quality Audit**
   - **Archivos:** `Stage3DCanvas.tsx`, `fixtures/Fixture3D.tsx`, `environment/*`
   - **Issue:** Reportado como "oscuro y feucho" en WAVE 433, no auditado desde entonces
   - **Fix:** 
     - Audit visual completo con screenshots
     - Lighting improvements (ambient, spotlight intensity)
     - Material upgrades (PBR, reflections)
     - Volumetric beam quality
   - **Effort:** 6-8 horas (testing-heavy)

### P2: MEDIUM (Polish)
5. **[P2] Visual Polish - Match Chronos Aesthetic**
   - **Archivos:** `StageViewDual.css`, `StageSimulator2` drawing code
   - **Issue:** UI básica vs Chronos neon HUD aesthetic
   - **Fix:**
     - Neon borders en viewport
     - Animated gradients en StatusBar
     - Glow effects en fixtures seleccionados
     - Cyberpunk grid pattern
   - **Effort:** 3-4 horas

6. **[P2] Debug Overlay Completion**
   - **Archivo:** `StageSimulator2.tsx` (WAVE 339 partial)
   - **Issue:** Estado `showDebugOverlay` definido pero parcialmente usado
   - **Fix:** Implementar overlay completo con fixture info (vibe, zoom%, speed)
   - **Effort:** 2 horas

### P3: LOW (Cosmetic)
7. **[P3] Legacy Comment Cleanup**
   - **Archivos:** `StageSimulator2.tsx`, `Stage3DCanvas.tsx`, `Fixture3D.tsx`
   - **Issue:** Headers/comments desde WAVE 24-379
   - **Fix:** Actualizar headers a WAVE 2041, preservar warnings críticos
   - **Effort:** 1 hora

8. **[P3] Quality Mode Implementation**
   - **Archivo:** `StageSimulator2.tsx` línea 118
   - **Issue:** Estado `qualityMode` definido pero no usado
   - **Fix:** Implementar low/high quality rendering (menos details en low mode)
   - **Effort:** 2-3 horas

---

## 🛠️ ROADMAP PARA REDESIGN

### PHASE 1: CANONICAL ZONE MIGRATION (P0)
**Objetivo:** Unificar sistema de zonas bajo ShowFileV2 canonical

**Tasks:**
1. ✅ **Audit zone usage** (completado en esta wave)
2. 🔲 **Fix StageSimulator2.tsx**
   - Importar `normalizeZone`, `CanonicalZone`, `ZONE_LABELS`
   - Reemplazar `FixtureVisual['zone']` type por `CanonicalZone`
   - Eliminar hardcoded mapping (líneas 206-226)
   - Crear `ZONE_TO_LAYOUT` mapping canónico
   - Test con fixtures en todas las 9 zonas
3. 🔲 **Fix layoutGenerator3D.ts**
   - Eliminar `normalizeZone()` local
   - Importar ShowFileV2.normalizeZone()
   - Actualizar type annotations a `CanonicalZone`
   - Test layout positions
4. 🔲 **Integration test**
   - Fixture en cada zona canónica
   - Verificar posición 2D = 3D
   - Verificar legacy zone migration

**Deliverable:** Documento WAVE-2042-CANONICAL-ZONE-MIGRATION.md

---

### PHASE 2: COMPONENT REFACTOR (P1)
**Objetivo:** Split monolitos, modernizar arquitectura

**Tasks:**
1. 🔲 **Split StageSimulator2.tsx**
   - Extraer `FixtureRenderer` (fixture drawing)
   - Extraer `GridRenderer` (background/grid)
   - Extraer `HitTestManager` (mouse events)
   - Container < 300 líneas
2. 🔲 **3D Render Quality Audit**
   - Visual audit con screenshots
   - Lighting improvements
   - Material upgrades
   - Beam quality testing
3. 🔲 **Performance profiling**
   - Chrome DevTools Performance tab
   - Identify bottlenecks
   - Optimize heavy renders

**Deliverable:** Documento WAVE-2043-COMPONENT-REFACTOR.md

---

### PHASE 3: VISUAL POLISH (P2)
**Objetivo:** Match Chronos aesthetic quality

**Tasks:**
1. 🔲 **UI Upgrade**
   - Neon borders (StageViewDual viewport)
   - Animated gradients (StatusBar)
   - Glow effects (selected fixtures)
   - Cyberpunk grid pattern
2. 🔲 **Debug Overlay**
   - Complete implementation
   - Show fixture info (ID, zone, vibe, params)
   - Toggle with keyboard shortcut
3. 🔲 **Quality Mode**
   - Implement low/high rendering
   - FPS-based auto-switch

**Deliverable:** Screenshot comparison (before/after)

---

### PHASE 4: POLISH & CLEANUP (P3)
**Objetivo:** Eliminar legacy, documentar

**Tasks:**
1. 🔲 **Legacy cleanup**
   - Actualizar headers a WAVE 2041+
   - Preservar warnings críticos
   - Eliminar código comentado innecesario
2. 🔲 **Documentation**
   - Actualizar README con arquitectura 2041
   - Component diagrams
   - Zone system guide
3. 🔲 **Final testing**
   - E2E test suite
   - Visual regression tests
   - Performance benchmarks

**Deliverable:** Simulator v2.0 Release Notes

---

## 📖 DOCUMENTACIÓN EXISTENTE

### WAVE 433: Previous Audit (478 líneas)
- **Archivo:** `/docs/Wave_170_450/WAVE-433-SIMULATOR-ARCHITECTURE-AUDIT.md`
- **Fecha:** ~200 WAVES atrás (estamos en 2041)
- **Estado:** OBSOLETO (pre-consolidation)
- **Contenido Útil:**
  - Mapa de componentes pre-WAVE 436 (4 carpetas separadas)
  - Lista de conflicts resueltos (TheProgrammer vs InspectorControls)
  - 3D render quality notes ("oscuro y feucho")
  - Propuesta de unificación (COMPLETADA en WAVE 436)

### WAVE 30: Dual View Implementation
- **Archivo:** `/docs/tralari/WAVE-30-DUAL-VIEW-IMPLEMENTATION.md`
- **Contenido:** Diseño original del sistema dual 2D/3D
- **Estado:** Arquitectura base aún válida

### WAVE 434-436: Consolidation History
- **Contenido:** Migración de 4 carpetas → `/components/simulator/`
- **Estado:** Completado, estructura actual

### WAVE 2040.24: Canonical Zones
- **Archivo:** `/core/stage/ShowFileV2.ts` líneas 186-350
- **Contenido:** Definición de 9 zonas canónicas + normalizer
- **Estado:** TRUTH SOURCE actual

---

## 🎬 CONCLUSIÓN

### Veredicto Final

El sistema Live View (`/components/simulator`) es **funcional y estable** pero está **una generación atrás** de Chronos Studio en términos de:
1. **Arquitectura** - Zones divergentes, component monoliths
2. **Visual Quality** - UI básica, 3D render no auditado desde WAVE 433
3. **Code Hygiene** - Legacy comments, código viejo que funciona pero confunde

### Comparación Chronos vs Simulator

| Métrica | Chronos Studio | Live View Simulator | Status |
|---------|---------------|---------------------|--------|
| **Functionality** | ✅ 100% | ✅ 100% | **MATCH** |
| **Architecture** | ✅ Modular | 🟡 Partial monolith | **GAP** |
| **Type Safety** | ✅ Strict | 🟡 Zone types broken | **GAP** |
| **Visual Polish** | ✅ Neon HUD | 🟡 Basic canvas | **GAP** |
| **Data Flow** | ✅ Single source | 🔴 Zone mapping divergente | **CRITICAL** |
| **Performance** | ✅ Optimized | ✅ Hybrid rendering | **MATCH** |
| **Code Quality** | ✅ Modern | 🟡 Legacy comments | **GAP** |

### Path Forward

**Esfuerzo Total Estimado:** 20-30 horas divididas en 4 phases

**Priority:**
1. **PHASE 1** (P0) - 4 horas - **CRÍTICO** antes de cualquier feature nueva
2. **PHASE 2** (P1) - 10-14 horas - Mejora calidad significativa
3. **PHASE 3** (P2) - 5-6 horas - Visual polish
4. **PHASE 4** (P3) - 1-2 horas - Cleanup final

**Recomendación:** Ejecutar PHASE 1 (Canonical Zone Migration) **INMEDIATAMENTE** en WAVE 2042. Es bloqueante para el resto y corrige el bug crítico de fixture positioning.

---

## 📦 DELIVERABLES DE ESTA WAVE

✅ **WAVE-2041-SIMULATOR-ARCHITECTURE-AUDIT.md** (este documento)
- Arquitectura completa documentada
- Canonical zones issue identified & analyzed
- Legacy code audit
- Comparación con Chronos
- Roadmap de 4 phases
- Effort estimates

🔲 **NEXT WAVE: WAVE-2042-CANONICAL-ZONE-MIGRATION.md**
- Fix StageSimulator2 zone mapping
- Fix layoutGenerator3D normalizer
- Integration tests
- Type safety validation

---

**FIN DEL AUDIT — PunkOpus OUT ⚡**

*"El código legacy no es vergüenza - es historia. Pero la inconsistencia arquitectónica sí es un bug."*
