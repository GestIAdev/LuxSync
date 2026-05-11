# KINETICS-UI-BLUEPRINT.md
## ⚡ WAVE 4561 — THE KINETICS CATHEDRAL

> *"No le digas al fixture a cuántos grados girar. Dile dónde mirar."*
> *— Y ahora, dale un escenario entero para hacerlo.*

**Date:** 2026-05-05
**Author:** Cascade (Opus)
**Status:** BLUEPRINT — Approved for implementation
**Dependencies:** UI-MOVEMENT-FORENSICS.md (WAVE 4560), AETHER-SAFETY-BLUEPRINT.md (WAVE 4557)

---

## §0. THE VISION

La sidebar de TheProgrammer tiene **450px × ~600px** de espacio útil. PositionSection compite con Intensity, Color, Beam, Extras y el mecanismo de acordeón exclusivo. El resultado: radares comprimidos, faders minúsculos, patrones amontonados.

**The Kinetics Cathedral** es un panel principal que vive al mismo nivel jerárquico que el viewport 2D/3D, pero en vez de robar espacio al escenario, **reemplaza la sidebar** cuando se activa. Es una mesa de control panorámica dedicada exclusivamente al movimiento.

**Tamaño disponible:** El viewport del HyperionView ocupa `width: calc(100% - 450px)`. Cuando la Cathedral se despliega, hereda el espacio completo de la sidebar (450px) + opcionalmente se expande como overlay sobre el viewport. En modo **full-width**, la Cathedral tiene ~1400px × ~700px en un monitor 1080p.

---

## §1. ARQUITECTURA DE LAYOUT

### §1.1 Integración en HyperionView

**Ubicación:** La Cathedral NO es una nueva tab de `navigationStore`. Vive dentro de `HyperionView.tsx` como un **modo alternativo de la sidebar**. La razón: el operador necesita ver el escenario (2D/3D) mientras controla movimiento.

```
┌──────────────────────────────────────────────────────────────────────┐
│  HYPERION TOOLBAR  [2D] [3D]  ❤ 128 BPM  ⚡ 92%  [LOAD] [NEXUS]  │
├──────────────────────────────────────────────────────────────────────┤
│                              │                                       │
│   VIEWPORT (2D/3D Canvas)   │   SIDEBAR MODE:                       │
│   flex: 1                    │   ┌─ [CONTROLS] ── default ─┐        │
│                              │   │  TheProgrammer            │       │
│   Fixtures rendered here     │   │  (accordion sections)     │       │
│   with real-time beams       │   └──────────────────────────┘        │
│                              │                                       │
│                              │   ┌─ [KINETICS] ── CATHEDRAL ┐       │
│                              │   │  KineticsCathedral        │       │
│                              │   │  (full sidebar takeover)  │       │
│                              │   └──────────────────────────┘        │
│                              │                                       │
│                              │   Width: 450px (default)              │
│                              │   Width: 650px (expanded)             │
└──────────────────────────────────────────────────────────────────────┘
```

**State en `controlStore.ts`:**
```typescript
/** WAVE 4561: Sidebar mode for HyperionView */
sidebarMode: 'controls' | 'kinetics'
setSidebarMode: (mode: 'controls' | 'kinetics') => void
```

**Toggle button:** Un botón `⊕ KINETICS` en la Hyperion toolbar (junto a 2D/3D) que setea `sidebarMode: 'kinetics'`. Cuando un moving head está seleccionado, el botón pulsa con un glow cyan sutil.

### §1.2 Component Tree

```
HyperionView.tsx
├── hyperion-toolbar
│   └── [2D] [3D] ··· [⊕ KINETICS] ← nuevo toggle
├── hyperion-main-content (flex row)
│   ├── hyperion-viewport (flex: 1)
│   │   ├── TacticalCanvas
│   │   └── VisualizerCanvas
│   └── hyperion-sidebar-container (450px | 650px)
│       ├── StageSidebar         ← display: sidebarMode === 'controls'
│       └── KineticsCathedral    ← display: sidebarMode === 'kinetics'
│           ├── CathedralHeader
│           ├── OrthoRadar (hybrid top+front)
│           ├── ChaosOrderSlider
│           ├── TacticalFaders (Speed + Amplitude)
│           ├── PatternArsenal (macro grid)
│           ├── PositionReadout (PAN/TILT/HEIGHT digital)
│           └── CathedralFooter (groups quickbar + lock status)
```

### §1.3 Expanded Mode

Un botón `⟷` en el CathedralHeader permite expandir la sidebar de 450px a 650px. Esto se anima con `transition: width 0.25s ease-out` y el viewport se encoge proporcionalmente vía flexbox. Al cerrar la Cathedral (botón `✕` o click en `[CONTROLS]`), la sidebar regresa a 450px y StageSidebar retoma el control.

**CSS variable:**
```css
.hyperion-sidebar-container {
  width: var(--sidebar-width, 450px);
  transition: width 0.25s ease-out;
}
.hyperion-sidebar-container.cathedral-expanded {
  --sidebar-width: 650px;
}
```

---

## §2. THE ORTHO RADAR — Hybrid Top+Front View

### §2.1 Concepto

El corazón de la Cathedral. Un radar ortográfico que muestra el escenario en vista **top-down** (planta) con un slider vertical adosado para la **altura** (Y). El operador arrastra el target en el plano XZ y ajusta Y con el slider lateral.

```
┌─────────────────────────────────────────────────┐
│  ORTHO RADAR                           [⟷] [✕] │
├────────────────────────────────────┬────────────┤
│                                    │  ▲  6.0m   │
│        ┌───────────────────┐       │  │         │
│        │  ·  ·  ·  ·  ·   │       │  │  ← Y    │
│        │  ·  ★  ·  ★  ·   │       │  │    axis  │
│        │  ·  ·  ⊕  ·  ·   │       │  ●  2.0m   │
│        │  ·  ★  ·  ★  ·   │       │  │         │
│        │  ·  ·  ·  ·  ·   │       │  │         │
│        └───────────────────┘       │  ▼  0.0m   │
│                                    │            │
│  ★ = fixture ghost                 │  HEIGHT    │
│  ⊕ = drag target                  │  SLIDER    │
│  ─ = beam ray                      │            │
├────────────────────────────────────┴────────────┤
│  X: -2.40m  Z: +1.85m  Y: 2.00m                │
└─────────────────────────────────────────────────┘
```

### §2.2 Component: `OrthoRadar.tsx`

```typescript
interface OrthoRadarProps {
  /** Current target in world meters */
  target: Target3D
  /** Target change callback */
  onChange: (target: Target3D) => void
  /** Selected fixtures with stage positions */
  fixtures: SpatialFixtureGhost[]
  /** Stage dimensions */
  stage: StageDimensions
  /** Per-fixture IK reachability */
  reachabilityMap?: Record<string, IKResult>
  /** Per-fixture sub-targets (for beam rays) */
  subTargets?: Record<string, Target3D>
  /** Fan ghost overlay */
  fanGhosts?: Array<{ id: string; target: Target3D }>
  /** Mode: 'spatial' (XYZ with IK) or 'classic' (Pan/Tilt degrees) */
  mode: 'spatial' | 'classic'
  /** Classic mode: pan/tilt values */
  classicPan?: number
  classicTilt?: number
  onClassicChange?: (pan: number, tilt: number) => void
  /** Ghost points for classic formation */
  classicGhostPoints?: GhostPoint[]
  /** Disabled state */
  disabled?: boolean
}
```

**Comportamiento:**
- **Spatial mode:** El grid mapea coordenadas reales del escenario (metros). Fixtures aparecen como iconos estáticos. El target es un punto arrastrable con SVG rays a cada fixture.
- **Classic mode:** El grid mapea Pan (0-513°) en X y Tilt (0-256°) en Y. Misma estética radar pero con ejes en grados. Ghost points para formation.
- **Height slider:** Visible solo en Spatial mode. Rail vertical de 200px a la derecha del radar, range 0..stage.height metros.

**Rendering:**
- **Canvas 2D** inline (NO WebGL). El radar es un `<div>` con CSS grid + SVG overlay para beam rays. Posiciones calculadas con `worldToGrid()`.
- **RAF throttle** en drag (idéntico al existente en SpatialTargetPad — ~33fps).
- **Beam rays:** SVG `<line>` desde fixture ghost → sub-target (or central target). Color: `--h-neon-cyan` si reachable, `--h-neon-red` si unreachable, dashed stroke si partially occluded.

**Dimensiones:** El radar ocupa ~320×280px en modo 450px sidebar, ~420×340px en modo 650px expanded. Responsive via CSS `aspect-ratio: 4/3` + `width: 100%`.

### §2.3 The Adiabatic Detection — Auto XY vs XYZ

**Axioma:** La UI detecta automáticamente si mostrar Classic (2D pan/tilt) o Spatial (3D IK) basándose en el ADN del grupo seleccionado.

**Algoritmo en `KineticsCathedral.tsx`:**

```typescript
/**
 * WAVE 4561: Adiabatic Detection — Auto-detect radar mode
 * 
 * Regla: Si TODOS los fixtures seleccionados que son moving heads
 * tienen posición 3D válida en el stageStore (position.x, .y, .z definidas
 * y no todas cero), se activa Spatial. Si alguno falta → Classic fallback.
 *
 * Override manual: el operador puede forzar un modo con un toggle.
 */
const radarMode = useMemo((): 'spatial' | 'classic' => {
  // 1. Manual override wins
  if (manualModeOverride !== null) return manualModeOverride

  // 2. Need at least 1 moving head
  if (movingHeadIds.length === 0) return 'classic'

  // 3. Check ALL moving heads have valid stage positions
  const allHavePosition = movingHeadIds.every(id => {
    const sf = stageFixtures.find(f => f.id === id)
    if (!sf?.position) return false
    const p = sf.position
    // Valid = at least one axis is non-zero (fixture placed on stage)
    return p.x !== 0 || p.y !== 0 || p.z !== 0
  })

  return allHavePosition ? 'spatial' : 'classic'
}, [movingHeadIds, stageFixtures, manualModeOverride])
```

**Manual Override Toggle:**
```
┌──────────────────────────┐
│  [AUTO]  [DEGREES]  [3D] │  ← Mode bar bajo el radar
└──────────────────────────┘
```
- **AUTO:** Adiabatic detection (default)
- **DEGREES:** Force classic pan/tilt mode
- **3D:** Force spatial IK mode

State: `const [manualModeOverride, setManualModeOverride] = useState<'spatial' | 'classic' | null>(null)`

---

## §3. THE CHAOS ENGINE — Order/Chaos Deterministic Slider

### §3.1 Concepto

Un slider horizontal que transiciona de **ORDER** (distribución simétrica, fan lineal clásico) a **CHAOS** (distribución orgánica asimétrica).

```
┌──────────────────────────────────────────────────┐
│  ORDER ═══════════●══════════════════════ CHAOS   │
│   ▼                                        ▼     │
│  Fan simétrico              Distribute orgánico  │
│  (line/circle)              (hash-seeded jitter) │
└──────────────────────────────────────────────────┘
```

### §3.2 Axioma 0: PROHIBIDO Math.random()

**Implementación:** El caos se genera mediante un **hash determinista** usando el UUID del fixture como input. Esto garantiza que:
1. El mismo grupo + misma semilla = misma distribución
2. El patrón es reproducible entre frames y sesiones
3. No hay aleatoriedad no-determinista en el pipeline

### §3.3 Función Hash: `fixtureHash()`

**File:** `src/engine/movement/ChaosHash.ts` (NUEVO)

```typescript
/**
 * 🎲 WAVE 4561: CHAOS HASH — Deterministic fixture scatter
 *
 * Genera un valor pseudo-aleatorio 0-1 para un fixture dado una semilla.
 * Basado en FNV-1a hash del UUID del fixture + semilla temporal.
 *
 * AXIOMA 0: PROHIBIDO Math.random(). Todo es determinista y reproducible.
 */

/** FNV-1a 32-bit hash */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5   // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0  // FNV prime, force unsigned 32-bit
  }
  return hash
}

/**
 * Hash determinista para un fixture.
 *
 * @param fixtureId — UUID del fixture (e.g., "fix-abc123")
 * @param seed      — Semilla temporal (e.g., vibe epoch o manual seed)
 * @param axis      — Eje de dispersión (0=X, 1=Z) para obtener valores distintos
 * @returns Valor pseudo-aleatorio en [-1, +1]
 */
export function fixtureHash(fixtureId: string, seed: number, axis: number): number {
  const input = `${fixtureId}:${seed}:${axis}`
  const hash = fnv1a(input)
  // Map uint32 to [-1, +1]
  return (hash / 0xFFFFFFFF) * 2 - 1
}
```

### §3.4 Integración en `InverseKinematicsEngine.ts`

**Modificación de `solveGroupWithFan()`:**

```typescript
export function solveGroupWithFan(
  fixtures: IKFixtureProfile[],
  target: Target3D,
  fanMode: SpatialFanMode,
  fanAmplitude: number,
  currentPanDMXMap?: ReadonlyMap<string, number>,
  // ── WAVE 4561: Chaos Engine ──
  chaosAmount?: number,    // 0 = pure order, 1 = full chaos
  chaosSeed?: number,      // Deterministic seed
): Map<string, IKFanResult> {
  // ... existing mode logic ...

  // ── Apply chaos jitter to computed offsets ──
  if (chaosAmount && chaosAmount > 0 && chaosSeed !== undefined) {
    for (let i = 0; i < fixtures.length; i++) {
      const fid = fixtures[i].id
      const jitterX = fixtureHash(fid, chaosSeed, 0) * chaosAmount * amp * 0.5
      const jitterZ = fixtureHash(fid, chaosSeed, 1) * chaosAmount * amp * 0.5
      offsets[i] = {
        dx: offsets[i].dx + jitterX,
        dz: offsets[i].dz + jitterZ,
      }
    }
  }
  // ... continue with solve per fixture ...
}
```

**Comportamiento del slider (0..1):**
- `chaos = 0`: Offsets sin modificar. Fan simétrico puro.
- `chaos = 0.3`: Jitter leve. La formación "respira" pero mantiene forma.
- `chaos = 0.7`: Orgánico. La formación se deforma significativamente.
- `chaos = 1.0`: Máximo desorden. Cada fixture tiene offset independiente limitado a `±amp*0.5`.

### §3.5 Frontend: ChaosOrderSlider.tsx

```typescript
interface ChaosOrderSliderProps {
  value: number           // 0-1
  onChange: (chaos: number) => void
  seed: number            // Current seed
  onReseed: () => void    // Generate new seed
  disabled?: boolean
}
```

**Diseño visual:**
```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   ORDER ─────────────────●─────────────────── CHAOS          │
│   ▏▎▍▌▋▊▉█▓▒░                                ░▒▓█▉▊▋▌▍▎▏  │
│                                                              │
│   [🔄 RESEED]                                    Seed: 7A2F │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- El track del slider tiene un gradiente visual: izquierda geométrica (líneas paralelas), derecha orgánica (noise pattern).
- Botón RESEED genera un nuevo seed: `Date.now() & 0xFFFF` (16-bit, suficiente para variedad visual).
- El seed se muestra en hex (4 caracteres) para estética cyberpunk.

### §3.6 Classic Fan + Chaos (Modo Grados)

En Classic mode, el chaos se aplica al spread lineal del fan en pan:

```typescript
// En KineticsCathedral, handlePositionChange para formation mode:
const positions = selectedIds.map((id, i) => {
  const offsetIndex = i - (selectedIds.length - 1) / 2
  const baseOffset = selectedIds.length > 1
    ? offsetIndex * spread / (selectedIds.length - 1)
    : 0

  // WAVE 4561: Chaos jitter on pan spread
  const chaosJitter = chaosAmount > 0
    ? fixtureHash(id, chaosSeed, 0) * chaosAmount * spread * 0.5
    : 0

  const fixturePanNorm = Math.max(0, Math.min(1, basePanNorm + baseOffset + chaosJitter))

  return {
    fixtureId: id,
    pan: fixturePanNorm * 540,
    tilt: baseTiltNorm * 270,
  }
})
```

---

## §4. TACTICAL FADERS — Speed & Amplitude

### §4.1 Concepto

Faders verticales masivos de alta precisión. La Aduana de Aether (WAVE 4557) ya protege el hardware con velocity clamping + airbag. La UI puede enviar el rango completo 0-100%.

### §4.2 Component: `TacticalFader.tsx`

```typescript
interface TacticalFaderProps {
  label: string         // "SPEED" | "AMP"
  value: number         // 0-100
  onChange: (value: number) => void
  color: string         // CSS color for the fill
  icon?: React.ReactNode
  disabled?: boolean
  /** Show numeric input for precision */
  showInput?: boolean
}
```

**Layout en la Cathedral:**

```
┌────────┬────────┐
│ SPEED  │  AMP   │
│        │        │
│  ████  │  ████  │
│  ████  │  ████  │
│  ████  │  ████  │
│  ████  │  ██    │
│  ██    │        │
│        │        │
│  72%   │  45%   │
│ [___]  │ [___]  │
└────────┴────────┘
```

**Diseño del fader:**
- **Track:** 200px de alto × 48px de ancho (expanded: 240px × 56px)
- **Fill:** Gradiente vertical del color asignado (speed: `#FF8C00` naranja, amp: `#FF00E5` magenta)
- **Cursor:** Línea horizontal brillante con glow del color + brackets `├──┤`
- **Valor:** Readout digital debajo con font `Orbitron` 16px
- **Input:** Click en el readout abre un `<input type="number">` para entrada precisa
- **Interacción:** Drag vertical + scroll wheel (step=1 normal, step=5 con Shift)
- **RAF throttle:** Idéntico al existente (~33fps max)

### §4.3 Liberación de Safety Caps

Los faders de la Cathedral envían 0-100% sin clamp adicional en UI. La cadena de seguridad:

```
UI (0-100%) → programmerStore → ProgrammerAetherBridge (44Hz) 
  → NodeArbiter L2 → PhysicsPostProcessor 
  → AetherSafetyMiddleware (velocity clamp + airbag) → HAL
```

La Aduana (WAVE 4557) aplica KINETIC_SAFETY_CAP_VEL=400 DMX/s y per-vibe REV_LIMITS. La UI no necesita preocuparse.

---

## §5. PATTERN ARSENAL — Macro Grid

### §5.1 Layout

Grid de botones tácticos para patrones de movimiento. Más grande que el PatternSelector actual.

```
┌────────────────────────────────────────────┐
│  PATTERN ARSENAL                           │
├──────────┬──────────┬──────────┬──────────┤
│  🛑      │  ○       │  ∞       │  ↔       │
│  HOLD    │  CIRCLE  │  EIGHT   │  SWEEP   │
├──────────┼──────────┼──────────┼──────────┤
│  🌪️      │  🏓      │  🦋      │  ⚡      │
│ TORNADO  │ BOUNCE   │ BUTTERFLY│  PULSE   │
└──────────┴──────────┴──────────┴──────────┘
```

**Tamaño de botón:** 80×56px (sidebar 450px) / 100×64px (expanded 650px).
- Botón activo: background con glow del color del patrón, borde `--h-neon-cyan`
- Botón inactivo: `rgba(255,255,255,0.05)` con borde sutil
- Touch-friendly: padding generoso, `touch-action: manipulation`

### §5.2 Reutilización del PatternSelector

El `PatternSelector.tsx` existente ya tiene toda la lógica de mapeo UI→engine. La Cathedral reutiliza el mismo tipo `PatternType` y la misma función `handlePatternChange`. Solo cambia el layout visual.

**Componente:** `PatternArsenal.tsx` — wrapper visual que internamente usa los mismos handlers pero con botones más grandes en grid 4×2.

---

## §6. POSITION READOUT — Digital Dashboard

### §6.1 Componente: `PositionReadout.tsx`

Indicadores numéricos de alta precisión para la posición actual.

**Spatial mode:**
```
┌──────────────────────────────────────────┐
│  X: -2.40m    Z: +1.85m    Y: 2.00m     │
│  PAN: 187.3°  TILT: 94.7°  (IK solve)   │
└──────────────────────────────────────────┘
```

**Classic mode:**
```
┌──────────────────────────────────────────┐
│  PAN: 256°    TILT: 128°                 │
│  (0.497)      (0.502)     normalized     │
└──────────────────────────────────────────┘
```

- Font: `JetBrains Mono` 13px
- Valores actualizados via prop (no fetching own state)
- Click en un valor → editable inline input

---

## §7. CATHEDRAL FOOTER — Groups Quickbar & Lock Status

### §7.1 Groups Quickbar

Para no perder la funcionalidad de selección rápida de grupos al abandonar la sidebar:

```
┌────────────────────────────────────────────────────────────┐
│  GROUPS: [ALL] [MH] [WASH] [PAR] [FRONT] [BACK] [+]      │
│  🔒 L2 OVERRIDE: 4/8 locked    [🔓 UNLOCK ALL]           │
└────────────────────────────────────────────────────────────┘
```

**Chips horizontales** con scroll horizontal si exceden el ancho.
- Cada chip muestra `nombre (count)` con color del grupo.
- Click → `selectMultiple(fixtureIds, 'replace')` vía `selectionStore`.
- `[+]` abre modal para crear grupo desde selección actual.

### §7.2 Lock Status

**Indicador de candados Aether:**
- Lee del `programmerStore.fixtureOverrides` para contar cuántos fixtures tienen override kinetic activo.
- Icono de candado con conteo: `🔒 L2 OVERRIDE: 4/8 locked`
- Botón `UNLOCK ALL` que llama `releasePosition()` + destruye patrones.

**Indicador de Aduana:**
- Si la telemetría de AetherSafetyMiddleware reporta velocity clamps activos, mostrar un badge: `⚠️ ADUANA: velocity limited`
- Esto requiere un nuevo IPC de telemetría o lectura del hot-frame broadcast.

---

## §8. STATE ARCHITECTURE — movementStore.ts

### §8.1 Justificación

El estado de PositionSection actualmente vive en `useState` locales. Para que la Cathedral funcione:
1. El estado debe persistir al cambiar entre sidebar modes (CONTROLS ↔ KINETICS)
2. Múltiples componentes necesitan leer el mismo estado (radar, faders, readout, footer)
3. El ProgrammerAetherBridge necesita acceso al chaos seed para inyectar en IPC

### §8.2 Store: `movementStore.ts` (NUEVO)

```typescript
/**
 * 🏛️ WAVE 4561: MOVEMENT STORE — The Kinetics Cathedral State
 *
 * Centraliza todo el estado de movimiento que antes vivía en useState
 * dentro de PositionSection.tsx. Permite que la Cathedral, el sidebar
 * y el bridge compartan el mismo estado.
 */

import { create } from 'zustand'

export type RadarMode = 'spatial' | 'classic'
export type RadarModeOverride = RadarMode | null  // null = auto-detect

interface MovementState {
  // ── Radar Mode ──
  radarMode: RadarMode                // Computed: auto or forced
  radarModeOverride: RadarModeOverride // null = auto-detect
  setRadarModeOverride: (mode: RadarModeOverride) => void

  // ── Classic Position (degrees) ──
  pan: number          // 0-540°
  tilt: number         // 0-270°
  setPanTilt: (pan: number, tilt: number) => void

  // ── Spatial Target (meters) ──
  spatialTarget: Target3D
  setSpatialTarget: (target: Target3D) => void

  // ── Pattern Engine ──
  activePattern: PatternType
  patternSpeed: number    // 0-100
  patternAmplitude: number // 0-100
  setActivePattern: (pattern: PatternType) => void
  setPatternParams: (speed: number, amplitude: number) => void

  // ── Fan (Classic) ──
  fanValue: number        // -100 to 100
  setFanValue: (v: number) => void

  // ── Fan (Spatial) ──
  spatialFanMode: SpatialFanMode
  spatialFanAmplitude: number   // meters
  setSpatialFanMode: (mode: SpatialFanMode) => void
  setSpatialFanAmplitude: (amp: number) => void

  // ── Chaos Engine ──
  chaosAmount: number     // 0-1
  chaosSeed: number       // uint16
  setChaosAmount: (v: number) => void
  reseed: () => void

  // ── Reachability (IK feedback from backend) ──
  reachabilityMap: Record<string, IKResult>
  subTargets: Record<string, Target3D>
  setReachabilityData: (
    reachability: Record<string, IKResult>,
    subTargets: Record<string, Target3D>
  ) => void

  // ── Calibration ──
  isCalibrating: boolean
  setCalibrating: (v: boolean) => void

  // ── Reset ──
  resetToDefaults: () => void
}
```

### §8.3 Dirty Flags para Bridge

El `ProgrammerAetherBridge` ya maneja dirty families. El movimiento va por la familia `KINETIC`. El chaos seed y amount viajan como parámetros extra en el IPC de spatial target:

```typescript
// En ProgrammerAetherBridge._flush() o en handleSpatialTargetChange:
window.lux?.arbiter?.applySpatialTarget({
  target: movementStore.spatialTarget,
  fixtureIds: selectedIds,
  fanMode: movementStore.spatialFanMode,
  fanAmplitude: movementStore.spatialFanAmplitude,
  chaosAmount: movementStore.chaosAmount,     // WAVE 4561
  chaosSeed: movementStore.chaosSeed,         // WAVE 4561
})
```

### §8.4 Migration Path

**PositionSection.tsx** sigue funcionando — el estado se lee del `movementStore` en vez de `useState`. Ambas UIs (sidebar PositionSection y Cathedral) consumen el mismo store. Zero duplication.

```
PositionSection.tsx (sidebar)  ──┐
                                  ├── movementStore.ts ──→ programmerStore / bridge → Aether
KineticsCathedral.tsx (panel)  ──┘
```

---

## §9. PLUMBING — Event Flow & Hydration

### §9.1 Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│  KineticsCathedral.tsx                                                │
│                                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │ OrthoRadar  │  │TacticalFader│  │PatternArsenal│                 │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                  │
│         │                │                │                           │
│         ▼                ▼                ▼                           │
│  ┌──────────────────────────────────────────────┐                    │
│  │             movementStore (Zustand)            │                   │
│  │  pan, tilt, spatialTarget, activePattern,     │                   │
│  │  patternSpeed, patternAmplitude, chaosAmount, │                   │
│  │  chaosSeed, fanValue, spatialFanMode, ...     │                   │
│  └──────────────────────┬───────────────────────┘                    │
│                         │                                             │
└─────────────────────────┼─────────────────────────────────────────────┘
                          │
            ┌─────────────┴───────────────┐
            ▼                             ▼
┌──────────────────────┐    ┌──────────────────────────┐
│  programmerStore     │    │  Direct IPC (patterns +  │
│  .setPosition()      │    │  spatial target)          │
│  .setPositionPer     │    │                          │
│   Fixture()          │    │  window.lux.arbiter      │
│  dirtyFamilies:      │    │  .setManualFixturePattern│
│    KINETIC           │    │  .applySpatialTarget     │
└──────────┬───────────┘    └────────────┬─────────────┘
           │                             │
           ▼                             ▼
┌──────────────────────┐    ┌──────────────────────────┐
│ProgrammerAetherBridge│    │   AetherIPCHandlers.ts   │
│  44Hz tick           │    │   (main process)         │
│  .setManualOverrides │    │   MasterArbiter          │
└──────────┬───────────┘    └────────────┬─────────────┘
           │                             │
           └──────────────┬──────────────┘
                          ▼
              ┌──────────────────────────┐
              │     NodeArbiter L2       │
              │  (manual overrides)      │
              └──────────┬───────────────┘
                         ▼
              ┌──────────────────────────┐
              │  PhysicsPostProcessor    │
              └──────────┬───────────────┘
                         ▼
              ┌──────────────────────────┐
              │ AetherSafetyMiddleware   │
              │ (velocity clamp, airbag, │
              │  DarkSpin, output gate)  │
              └──────────┬───────────────┘
                         ▼
              ┌──────────────────────────┐
              │     HAL → DMX Output     │
              └──────────────────────────┘
```

### §9.2 Hydration on Selection Change

Cuando `selectionStore.selectedIds` cambia:

1. `KineticsCathedral` detecta el cambio via `useSelectedArray()`
2. Ejecuta **Adiabatic Detection** (§2.3) para determinar `radarMode`
3. Llama `window.lux.arbiter.getFixturesState(selectedIds)` para hidratar
4. Popula `movementStore` con los valores recibidos del backend
5. Si el backend responde `null` para algún campo → default (pan=256°, tilt=128°, pattern='none')

**Exact same pattern** que `PositionSection.tsx:158-240` pero leyendo/escribiendo del store en vez de useState.

### §9.3 Lock Visualization

El Cathedral footer lee:
```typescript
const fixtureOverrides = useProgrammerStore(s => s.fixtureOverrides)
const lockedCount = useMemo(() => {
  let count = 0
  for (const [id, ov] of fixtureOverrides) {
    if (selectedIds.includes(id) && (ov.pan !== null || ov.tilt !== null)) {
      count++
    }
  }
  return count
}, [fixtureOverrides, selectedIds])
```

---

## §10. FILE STRUCTURE

```
src/
├── components/
│   └── hyperion/
│       ├── views/
│       │   └── HyperionView.tsx            ← MODIFY: add sidebarMode toggle
│       └── kinetics/                       ← NEW FOLDER
│           ├── index.ts                    ← Barrel export
│           ├── KineticsCathedral.tsx        ← Main container (~300 lines)
│           ├── KineticsCathedral.css        ← Neon aesthetic (~400 lines)
│           ├── CathedralHeader.tsx          ← Title + expand/close buttons
│           ├── OrthoRadar.tsx              ← Hybrid radar (~500 lines)
│           ├── OrthoRadar.css              ← Grid + SVG styling
│           ├── ChaosOrderSlider.tsx        ← ORDER↔CHAOS control (~120 lines)
│           ├── TacticalFader.tsx           ← Speed/Amp faders (~180 lines)
│           ├── PatternArsenal.tsx          ← 4×2 pattern grid (~100 lines)
│           ├── PositionReadout.tsx         ← Digital readout (~80 lines)
│           └── CathedralFooter.tsx         ← Groups + locks (~150 lines)
├── stores/
│   └── movementStore.ts                    ← NEW: Centralized movement state
├── engine/
│   └── movement/
│       └── ChaosHash.ts                   ← NEW: FNV-1a deterministic hash
└── bridges/
    └── ProgrammerAetherBridge.ts           ← MODIFY: read chaosAmount/seed
```

---

## §11. IMPLEMENTATION PHASES

### Phase 0 — Foundation (pre-req)
- [ ] Create `movementStore.ts` with full interface
- [ ] Create `ChaosHash.ts` with `fixtureHash()` + `fnv1a()`
- [ ] Wire `movementStore` into existing `PositionSection.tsx` (replace useState)
- [ ] Verify: no regressions, tsc --noEmit clean

### Phase 1 — Cathedral Shell
- [ ] Create `kinetics/` folder with `KineticsCathedral.tsx` + CSS
- [ ] Add `sidebarMode` to `controlStore`
- [ ] Add `⊕ KINETICS` toggle to HyperionView toolbar
- [ ] Wire sidebar switching in `HyperionView.tsx`
- [ ] Verify: toggle switches between StageSidebar and Cathedral shell

### Phase 2 — OrthoRadar
- [ ] Build `OrthoRadar.tsx` (Spatial + Classic dual mode)
- [ ] Implement Adiabatic Detection in Cathedral
- [ ] Wire radar to `movementStore` + existing IPC paths
- [ ] Port height slider for spatial mode
- [ ] Verify: radar works in both modes, fixtures selectable

### Phase 3 — Controls
- [ ] Build `TacticalFader.tsx` (Speed + Amplitude)
- [ ] Build `PatternArsenal.tsx` (4×2 macro grid)
- [ ] Build `PositionReadout.tsx`
- [ ] Wire all to `movementStore` + pattern IPC
- [ ] Verify: patterns fire, faders control speed/amp

### Phase 4 — Chaos Engine
- [ ] Build `ChaosOrderSlider.tsx`
- [ ] Integrate `fixtureHash()` into `solveGroupWithFan()`
- [ ] Add `chaosAmount` + `chaosSeed` to `applySpatialTarget` IPC
- [ ] Integrate chaos into classic fan calculation
- [ ] Verify: ORDER→CHAOS slider produces visible scatter, deterministic

### Phase 5 — Footer & Polish
- [ ] Build `CathedralFooter.tsx` (groups quickbar + lock status)
- [ ] Add expanded mode (450px → 650px transition)
- [ ] CSS polish: neon aesthetic, responsive sizing, glow animations
- [ ] Verify: full integration, tsc --noEmit clean

---

## §12. CSS AESTHETIC — The Neon Cathedral

### §12.1 Design Tokens (inherited from HyperionView)

```css
.kinetics-cathedral {
  /* Inherit Hyperion tokens */
  --kc-bg: var(--h-bg-surface);
  --kc-bg-panel: rgba(8, 8, 16, 0.95);
  --kc-border: var(--h-border-subtle);
  --kc-text: rgba(255, 255, 255, 0.9);
  --kc-text-dim: rgba(255, 255, 255, 0.4);

  /* Cathedral-specific */
  --kc-radar-grid: rgba(0, 240, 255, 0.06);
  --kc-radar-crosshair: rgba(0, 240, 255, 0.20);
  --kc-target-color: var(--h-neon-cyan);
  --kc-ghost-color: rgba(0, 240, 255, 0.35);
  --kc-beam-reachable: var(--h-neon-cyan);
  --kc-beam-unreachable: var(--h-neon-red);
  --kc-speed-color: #FF8C00;
  --kc-amp-color: #FF00E5;
  --kc-chaos-gradient: linear-gradient(90deg, 
    var(--h-neon-cyan) 0%, 
    var(--h-neon-gold) 40%, 
    var(--h-neon-magenta) 70%, 
    var(--h-neon-red) 100%
  );

  font-family: var(--h-font-primary);
  background: var(--kc-bg);
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 240, 255, 0.15) transparent;
}
```

### §12.2 Radar Aesthetic

- **Background:** Scanline pattern (same as HyperionView) + subtle radial gradient from center
- **Grid lines:** 1m spacing in spatial, 90° spacing in classic. Color `--kc-radar-grid`
- **Crosshair:** Center cross at `--kc-radar-crosshair`
- **Target:** Pulsing circle with brackets `┌ ┐ └ ┘` + glow shadow
- **Fixture ghosts:** Small diamonds `◆` with fixture color or zone color
- **Beam rays:** SVG lines with `stroke-dasharray: 4 2` when unreachable
- **Cursor on hover:** `crosshair`

### §12.3 Fader Aesthetic

- **Track:** Dark rail with 1px `--kc-border` outline
- **Fill:** Bottom-up gradient of the assigned color with 40% opacity
- **Thumb:** Horizontal bar spanning full track width, 3px height, full color + glow
- **Value:** `Orbitron` font, color matches fader color, slight text-shadow glow

---

**End of Blueprint — WAVE 4561: THE KINETICS CATHEDRAL**

> *"La sidebar era una celda. La Cathedral es un templo."*
