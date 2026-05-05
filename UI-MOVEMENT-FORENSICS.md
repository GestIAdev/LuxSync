# UI-MOVEMENT-FORENSICS.md
## ⚡ WAVE 4560 — TheProgrammer UX/UI & Movement Radars Deep Audit

**Scope:** Read-only forensic analysis of frontend architecture for the extraction of PositionSection's 3 radars into a panoramic megavista, and planning for the `distribute` (randomized fan) expansion.

**Date:** 2026-05-05
**Auditor:** Cascade (WAVE 4560)

---

## §1. ANATOMÍA DEL ACORDEÓN Y ROUTING (TheProgrammer Layout)

### §1.1 Componente Principal

**File:** `src/components/hyperion/controls/TheProgrammer.tsx` (358 lines)

**Arquitectura de pestañas:**
```
┌─────────────────────────────────────────┐
│  [CONTROLS]  │  [GROUPS]               │  ← Tab nav (2 tabs)
├─────────────────────────────────────────┤
│ CONTROLS tab:                            │
│   ┌ Header (count + UNLOCK ALL)         │
│   ├ IntensitySection (accordion)        │
│   ├ ColorSection (accordion, cond)      │
│   ├ PositionSection (accordion)         │  ← THE TARGET
│   ├ BeamSection (accordion)             │
│   └ ExtrasSection (accordion)             │
│                                          │
│ GROUPS tab:                              │
│   └ GroupsPanel                          │
└─────────────────────────────────────────┘
```

**Estado de pestañas:**
```typescript
type ProgrammerTab = 'controls' | 'groups'
const [activeTab, setActiveTab] = useState<ProgrammerTab>('controls')
```

### §1.2 Mecanismo del Acordeón (Efecto Compresión)

**File:** `TheProgrammer.tsx:88-94`

```typescript
// WAVE 430.5: EXCLUSIVE ACCORDION - Only one section open at a time
const [activeSection, setActiveSection] = useState<string>('intensity')

const toggleSection = useCallback((section: string) => {
  setActiveSection(prev => prev === section ? '' : section)
}, [])
```

**Problema identificado:** El acordeón EXCLUSIVO fuerza que solo UNA sección esté abierta. Cuando PositionSection está expandida, las demás secciones (Intensity, Color, Beam, Extras) colapsan a solo sus headers (~30px cada uno). Con 5 secciones + header, PositionSection tiene ~60-70% de la altura disponible (~400-500px en un sidebar típico).

**Distribución de altura aproximada (sidebar 600px):**
- Header + badge: ~50px
- 5x collapsed section headers: ~150px (5 × 30px)
- PositionSection expanded: ~400px (crítico: insuficiente para 3 radares + controles)

**The PositionSection is the tallest component** and its internal layout (radar + fan + patterns + sliders) exceeds the available vertical space when squeezed by the accordion.

### §1.3 Inyección de PositionSection

**File:** `TheProgrammer.tsx:317-323`

```tsx
<PositionSection
  hasOverride={overrideState.position}
  isExpanded={activeSection === 'position'}
  onToggle={() => toggleSection('position')}
  onOverrideChange={handlePositionOverrideChange}  // No-op: derived from store
/>
```

**Observación crítica:** `PositionSection` NO recibe `selectedIds` directamente. Los lee internamente vía `useSelectedArray()` (selectionStore). Esto significa que:
- El componente es **auto-suficiente** en términos de selección
- Puede vivir FUERA de TheProgrammer sin perder conectividad a la selección
- La única dependencia del padre es el `isExpanded` para el acordeón

---

## §2. RADIOGRAFÍA DE LOS 3 RADARES

### §2.1 Ubicación de Archivos

| Radar | Archivo | Líneas | Rol |
|---|---|---|---|
| **XYPad** | `controls/XYPad.tsx` | 225 | Individual (Sniper Mode) |
| **RadarXY** | `controls/RadarXY.tsx` | 304 | Grupal (Formation Mode) |
| **SpatialTargetPad** | `controls/SpatialTargetPad.tsx` | 692 | Espacial 3D (IK Mode) |
| **VSlider** | `controls/ManualPatternControls.tsx` | — | Speed/Amplitude sliders |
| **PatternSelector** | `controls/PatternSelector.tsx` | 187 | Pattern buttons + params |

**Barrel export:** `controls/index.ts` — todos exportados públicamente.

### §2.2 XYPad — Sniper Mode (1 fixture)

**File:** `controls/XYPad.tsx`

**Input state (props):**
```typescript
interface XYPadProps {
  pan: number    // 0-540° physical, UI enforces 0-513° (95%)
  tilt: number   // 0-270° physical, UI enforces 0-256° (95%)
  onChange: (pan: number, tilt: number) => void
  onCenter?: () => void
  disabled?: boolean
}
```

**State source:** Viene de `PositionSection.tsx:52-53`:
```typescript
const [pan, setPan] = useState(270)    // degrees
const [tilt, setTilt] = useState(135) // degrees
```

**Wiring a backend:**
```
Drag → RAF throttle (~33fps) → onChange(pan, tilt)
  → PositionSection.handlePositionChange(safePan, safeTilt)
    → if (selectedIds.length > 1) → setPositionPerFixture(positions) [programmerStore]
    → else → setPosition(safePan, safeTilt) [programmerStore]
      → 44Hz bridge → IPC window.lux.aether.setManualOverrides()
```

**Safety clamp (frontend):** `SAFE_PAN_MAX = 513`, `SAFE_TILT_MAX = 256` (95% of physical). This is UI-level only — backend has its own airbag.

### §2.3 RadarXY — Formation Mode (2+ fixtures)

**File:** `controls/RadarXY.tsx`

**Input state (props):**
```typescript
interface RadarXYProps {
  pan: number; tilt: number           // Center of gravity
  onChange, onCenter, isCalibrating
  isGroupMode: boolean = true
  ghostPoints: GhostPoint[]          // Individual fixture positions
  fixtureCount: number
}
```

**Visual elements:**
- Concentric rings (grid)
- Crosshair + 45° diagonals
- Ghost points (`.ghost-point`) — one per selected fixture, positioned absolutely via CSS `left/top %`
- Radar cursor with bracket decorators
- Coordinate readout (PAN × TILT in degrees + normalized)
- Calibrating overlay with scanning line

**Ghost point rendering:**
```tsx
{isGroupMode && ghostPoints.map((point) => (
  <div key={point.id} className="ghost-point"
    style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}>
    <div className="ghost-dot" />
  </div>
))}
```

### §2.4 SpatialTargetPad — Spatial 3D Mode

**File:** `controls/SpatialTargetPad.tsx` (692 lines, the largest)

**Input state (props):**
```typescript
interface SpatialTargetPadProps {
  target: Target3D               // {x, y, z} in meters
  onChange: (target: Target3D) => void
  fixtures: SpatialFixtureGhost[] // For rendering static ghosts
  stage: StageDimensions         // {width, depth, height, gridSize}
  reachabilityMap?: Record<string, IKResult>
  fanMode?: SpatialFanMode         // 'converge' | 'line' | 'circle'
  onFanModeChange?: (mode) => void
  fanAmplitude?: number           // meters
  onFanAmplitudeChange?: (amp) => void
  subTargets?: Record<string, Target3D>
}
```

**Coordinate system (stage space):**
- X: -width/2 to +width/2 (left ↔ right)
- Z: -depth/2 to +depth/2 (back ↔ front)
- Y: 0 to height (floor ↔ ceiling)

**Visual elements:**
- Top-down grid (world X/Z mapped to CSS %)
- Static fixture ghosts (from `stageStore.fixtures`)
- Draggable target marker
- Vertical height slider (Y axis)
- SVG beam rays (fixture → target, with reachability color feedback)
- Fan mode buttons + amplitude slider

**Key refs for zero-render drag:**
```typescript
const targetRef = useRef<Target3D>(target)
targetRef.current = target  // keep mutable for RAF callbacks
```

### §2.5 Estado Compartido — PositionSection.tsx

**File:** `PositionSection.tsx` — Estado local completo:

```typescript
// Core position
const [pan, setPan] = useState(270)           // 0-540°
const [tilt, setTilt] = useState(135)         // 0-270°

// Pattern engine
const [activePattern, setActivePattern] = useState<PatternType>('none')
const [patternSpeed, setPatternSpeed] = useState(50)   // 0-100
const [patternSize, setPatternSize] = useState(50)    // 0-100

// Fan (linear formation spread)
const [fanValue, setFanValue] = useState(0)   // -100 to 100

// Spatial mode (3D)
const [isSpatialMode, setIsSpatialMode] = useState(false)
const [spatialTarget, setSpatialTarget] = useState<Target3D>({ x: 0, y: 2, z: 0 })
const [spatialReachability, setSpatialReachability] = useState<Record<string, IKResult>>({})
const [spatialFanMode, setSpatialFanMode] = useState<'converge' | 'line' | 'circle'>('converge')
const [spatialFanAmplitude, setSpatialFanAmplitude] = useState(0)
const [spatialSubTargets, setSpatialSubTargets] = useState<Record<string, Target3D>>({})

// Calibration
const [isCalibrating, setIsCalibrating] = useState(false)
```

**Data sources for the radars:**
1. `useSelectedArray()` → `selectedIds` (selectionStore)
2. `useHardware()` → fixture definitions (truthStore)
3. `useStageStore()` → stage dimensions + fixture positions
4. `useProgrammerStore()` → NOT directly used for radar values (values are local)

---

## §3. MATEMÁTICA DE DISPERSIÓN (Fan & GM Speed)

### §3.1 Fan Lineal (Frontend) — Formation Mode Degrees

**File:** `PositionSection.tsx:122-151` (ghostPoints useMemo) y `PositionSection.tsx:250-288` (handlePositionChange)

**Algoritmo:**
```typescript
// Base position (center of gravity) normalized 0-1
const basePanNorm = pan / 540
const baseTiltNorm = tilt / 270

// Fan spread: -100 to 100 → -0.3 to 0.3 (normalized spread)
const spread = (fanValue / 100) * 0.3

// Per-fixture offset
const offsetIndex = index - (fixtureCount - 1) / 2
const offsetX = offsetIndex * spread / Math.max(1, fixtureCount - 1)

// Final position (clamped 0-1)
const x = Math.max(0, Math.min(1, basePanNorm + offsetX))
const y = baseTiltNorm
```

**Distribución:** Lineal centrada. El fixture del medio (índice medio) no tiene offset. Los extremos se separan proporcionalmente.

**Inyección al backend:**
```typescript
useProgrammerStore.getState().setPositionPerFixture(positions)
// Where positions = Array<{fixtureId, pan: degrees, tilt: degrees}>
```

### §3.2 Fan Espacial (Backend IK) — Spatial Mode

**File:** `src/engine/movement/InverseKinematicsEngine.ts:410-459`

```typescript
export function solveGroupWithFan(
  fixtures: IKFixtureProfile[],
  target: Target3D,
  fanMode: SpatialFanMode,        // 'converge' | 'line' | 'circle'
  fanAmplitude: number,            // meters
  currentPanDMXMap?: ReadonlyMap<string, number>
): Map<string, IKFanResult>
```

**Modos:**
- `converge`: Todos apuntan al mismo target. Wrapper directo de `solveGroup()`.
- `line`: `computeLineFanOffsets()` — distribuye sub-targets en línea perpendicular al vector centroide→target.
- `circle`: `computeCircleFanOffsets()` — distribuye en circunferencia alrededor del target.

**Cálculo Circle (deterministico):**
```typescript
export function computeCircleFanOffsets(count: number, amplitude: number) {
  const radius = amplitude / 2
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count
    return { dx: Math.cos(angle) * radius, dz: Math.sin(angle) * radius }
  })
}
```

**Cálculo Line (deterministico, ordenado por fixture):**
```typescript
export function computeLineFanOffsets(fixturePositions, target, amplitude) {
  // 1. Vector centroide→target
  // 2. Perpendicular unitario
  // 3. Distribución equidistante: -amp/2 ... 0 ... +amp/2
}
```

### §3.3 Gap Identificado: No existe "Distribute" aleatorizado

**Problema:** Ambos modos (`line` y `circle`) son **determinísticos** y **ordenados por índice de fixture**. Esto significa:
- Siempre el fixture 0 está en el ángulo 0° (circle) o en el extremo izquierdo (line)
- No hay semilla de aleatorización
- No hay control de "caos" (cuánto se desordena la distribución)

**Punto de inyección para `distribute`:**

En `InverseKinematicsEngine.ts`, entre las líneas 434-443, se podría añadir un nuevo modo:
```typescript
if (fanMode === 'distribute') {
  offsets = computeDistributeOffsets(fixtures.length, amplitude, seed)
}
```

O alternativamente, un modificador que se aplique POST-cálculo de offsets:
```typescript
// Añadir jitter aleatorio a los offsets calculados
if (randomness > 0) {
  offsets = offsets.map(o => ({
    dx: o.dx + (Math.random() - 0.5) * randomness * amplitude,
    dz: o.dz + (Math.random() - 0.5) * randomness * amplitude,
  }))
}
```

### §3.4 Pattern Speed & Size — IPC Path

**File:** `PositionSection.tsx:338-357` (handlePatternParamsChange)

```typescript
const handlePatternParamsChange = useCallback(async (speed: number, size: number) => {
  setPatternSpeed(speed)
  setPatternSize(size)

  if (activePattern !== 'none' && activePattern !== 'static') {
    await window.lux?.arbiter?.setManualFixturePattern({
      fixtureIds: selectedIds,
      pattern: activePattern,
      speed: speed,
      amplitude: size,
    })
  }
}, [activePattern, selectedIds])
```

**Path completo:**
```
Slider onChange → handlePatternParamsChange(speed, size)
  → setPatternSpeed / setPatternSize (local state)
  → IPC: window.lux.arbiter.setManualFixturePattern(payload)
    → AetherIPCHandlers.ts → masterArbiter.setManualFixturePattern()
      → FixturePhysicsDriver / VibeMovementManager
```

**Nota:** Los parámetros speed/size NO pasan por programmerStore. Van directo por IPC legacy (`window.lux.arbiter`). Esto es un punto de desconexión arquitectónica — el store no conoce los patrones activos.

---

## §4. DEPENDENCIAS DE GRUPOS (Groups Tab → PositionSection)

### §4.1 Flujo de Selección

```
┌───────────────────────────────────────────────────────────────┐
│ GroupsPanel.tsx                                                │
│   ├─ System Groups (All, By Type, By Zone)                    │
│   └─ User Groups (persistent in ShowFile)                   │
│                                                                 │
│  handleGroupClick(fixtureIds)                                   │
│    → selectMultiple(fixtureIds, 'replace')   [selectionStore]  │
│    → setTimeout(() => onSwitchToControls(), 50)                 │
│                                                                 │
│  onSwitchToControls = TheProgrammer.setActiveTab('controls')  │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│ selectionStore (Zustand)                                       │
│   selectedIds: Set<string>                                      │
│                                                                 │
│   useSelectedArray() → Array.from(selectedIds)                  │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│ PositionSection.tsx                                            │
│   const selectedIds = useSelectedArray()  ← DIRECT READ         │
│   const hardware = useHardware()                               │
│   const stageFixtures = useStageStore(s => s.fixtures)       │
│                                                                 │
│   isMultiSelection = selectedIds.length > 1                   │
│   hasMovingHeads = selectedIds.some(id => type includes       │
│     'moving'|'spot'|'beam'|'wash')                            │
└───────────────────────────────────────────────────────────────┘
```

### §4.2 Auto-switch Tab

**File:** `GroupsPanel.tsx:135-141`

```typescript
const handleGroupClick = useCallback((fixtureIds: string[]) => {
  selectMultiple(fixtureIds, 'replace')
  setTimeout(() => { onSwitchToControls() }, 50)
}, [])
```

**Behavior:** Clicking a group in the GROUPS tab:
1. Replaces current selection with group members
2. After 50ms delay, switches active tab to CONTROLS
3. TheProgrammer re-renders → PositionSection receives new `selectedIds`
4. PositionSection's `useEffect` with `[JSON.stringify(selectedIds)]` triggers hydration

### §4.3 Hydration del Estado

**File:** `PositionSection.tsx:158-240`

```typescript
useEffect(() => {
  const hydrateState = async () => {
    // 1. FLUSH: si no hay selección, aplicar defaults
    // 2. HIDRATAR: pedir estado real al Arbiter vía IPC
    const result = await window.lux?.arbiter?.getFixturesState(selectedIds)
    // 3. Aplicar valores con defaults condicionales
    //    - Si backend tiene valor → usarlo
    //    - Si backend devuelve null (AI control) → default
  }
  hydrateState()
}, [JSON.stringify(selectedIds)])  // 🔑 stringify for content-change detection
```

---

## §5. EL PUENTE A AETHER (ProgrammerAetherBridge)

**File:** `src/bridges/ProgrammerAetherBridge.ts`

**Arquitectura:**
```
UI event (sync) → programmerStore (in-memory, sync) → dirty flag set
                    ↑                                    │
                    └──── consumeDirty() ←───────────────┘
                              │
                              ▼
                    44Hz tick (setInterval ~22.7ms)
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              setPayloads[]         clearNodeIds[]
                    │                   │
              window.lux.aether    window.lux.aether
           .setManualOverrides()  .clearManualOverrides()
                    │                   │
                    └───────────┬───────┘
                                ▼
                         NodeArbiter L2
                         (AetherIPCHandlers.ts)
```

**Mapping familia → nodeId label:**
```typescript
const FAMILY_LABEL: Record<ProgrammerFamily, string> = {
  IMPACT:  'impact',
  COLOR:   'color',
  KINETIC: 'kinetic',
  BEAM:    'beam',
  EXTRAS:  'atmosphere',
}
```

**Extractores:**
- `extractKinetic` → `{ pan, tilt, speed }` — NOT targetX/Y/Z!
- The SpatialTargetPad sends via `window.lux.arbiter.applySpatialTarget()` which is a SEPARATE IPC path, NOT through the bridge.

**Two parallel paths for position:**
1. **Classic/Degrees:** programmerStore → bridge → `setManualOverrides(nodeId='kinetic', {pan, tilt})`
2. **Spatial/IK:** Direct IPC `window.lux.arbiter.applySpatialTarget({target, fixtureIds, fanMode, fanAmplitude})`

---

## §6. ANÁLISIS DE EXTRACCIÓN — MEGAVISTA PANORÁMICA

### §6.1 Viabilidad Técnica

**PositionSection puede vivir independientemente:**
- ✅ Lee `selectedIds` directamente de selectionStore (no depende de TheProgrammer)
- ✅ Lee `hardware` de truthStore
- ✅ Lee `stage` de stageStore
- ✅ Las callbacks (`onChange`, etc.) son locales — no hay binding al padre
- ✅ Única dependencia del padre: `isExpanded` para CSS de acordeón
- ✅ Programmatic pattern params via direct IPC (no pasan por TheProgrammer)

**Lo que necesitaría un refactor:**
- ❌ `isExpanded`/`onToggle` — son del acordeón. La megavista siempre estaría expandida.
- ❌ `hasOverride`/`onOverrideChange` — derivado del store. Se puede calcular internamente.
- ❌ CSS classes `.position-section .expanded .collapsed` — necesitan adaptarse a layout full-height.

### §6.2 Estado que debe migrar a Zustand

Para que la megavista persista al cambiar de pestaña, el estado local de PositionSection debe salir de `useState`:

| Estado actual | Ubicación | Recomendación |
|---|---|---|
| `pan`, `tilt` | PositionSection local | Mover a programmerStore o nuevo `movementStore` |
| `activePattern`, `patternSpeed`, `patternSize` | PositionSection local | Mover a store (ahora va directo por IPC) |
| `fanValue` | PositionSection local | Mover a store |
| `isSpatialMode` | PositionSection local | Mover a store |
| `spatialTarget` | PositionSection local | Mover a store |
| `spatialFanMode`, `spatialFanAmplitude` | PositionSection local | Mover a store |
| `isCalibrating` | PositionSection local | Mover a store |


## §8. RESUMEN EJECUTIVO

### §8.1 Hallazgos Clave

| # | Hallazgo | Impacto |
|---|---|---|
| 1 | **El acordeón exclusivo comprime PositionSection** a ~60% de altura disponible | Alto — radares no caben cómodamente |
| 2 | **PositionSection es auto-suficiente** — lee selección directamente del store | Positivo — extracción viable |
| 3 | **Dos paths paralelos para posición:** programmerStore (degrees) vs direct IPC (spatial) | Medio — posible confusión en refactor |
| 4 | **Fan es deterministico y ordenado por índice** — no hay aleatorización | Baja (feature gap) — `distribute` puede añadirse |
| 5 | **Pattern params no pasan por programmerStore** — van directo por IPC legacy | Medio — inconsistencia arquitectónica |
| 6 | **Ghost points se renderizan vía CSS absolute positioning** — fácil de escalar | Positivo — no dependen del contenedor |
| 7 | **SpatialTargetPad usa refs mutables para drag** — zero re-render durante interacción | Positivo — rendimiento ya optimizado |

### §8.2 Riesgos del Refactor

| Riesgo | Mitigación |
|---|---|
| Perder estado local al cambiar de pestaña | Migrar todo el estado de PositionSection a Zustand |
| CSS `.expanded/.collapsed` coupling | Crear nuevo wrapper sin clases de acordeón |
| Hydration race condition | Mantener el `useEffect` con stringify dependency |
| Patrón de IPC dual (bridge + direct) | Unificar: spatial path también debería pasar por programmerStore |
| Touch/RAF throttle regressions | Reutilizar XYPad/RadarXY/SpatialTargetPad tal cual |


---

**End of Forensic Audit — WAVE 4560**
