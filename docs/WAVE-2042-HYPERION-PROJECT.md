# ☀️ PROJECT HYPERION — WAVE 2042: THE REBIRTH OF LIVE VIEW

**Codename:** HYPERION (Titán del Sol — El que da luz)  
**Status:** BLUEPRINT — Planos de Rediseño Total  
**Precedente:** WAVE-2041 Simulator Architecture Audit  
**Objetivo:** Elevar Live View a la calidad de Chronos Studio y Hephaestus  
**Filosofía:** *"No simulamos luz. La invocamos."*

---

## 📋 EXECUTIVE SUMMARY

Project Hyperion es el rediseño completo del módulo Live View de LuxSync. Actualmente llamado "Simulator", este módulo pasa a ser **Hyperion** — la interfaz principal donde el lighting designer dirige el show en vivo en modo manual y donde se reproducen las escenas programadas en Chronos (Timecoder).

**Hyperion es la CARTA DE PRESENTACIÓN de LuxSync.** Es lo primero que ve el cliente. Cada píxel cuenta.

### Alcance del Rediseño

| Componente | Acción | Prioridad |
|-----------|--------|-----------|
| **Canonical Zones** | 🔴 REWRITE — Unificar bajo ShowFileV2 | P0 |
| **GroupsPanel** | 🔴 FIX — Migrar a CanonicalZone colors | P0 |
| **HUD Táctico** | 🟢 NEW — Tooltip flotante por fixture | P1 |
| **StageSimulator2 (2D)** | 🟡 REFACTOR — Split + Neon Total | P1 |
| **Fixture3D + Stage3DCanvas (3D)** | 🟡 REFACTOR — Quaternion LERP + Neon | P1 |
| **layoutGenerator3D** | 🔴 REWRITE — Usar ShowFileV2.normalizeZone | P0 |
| **StageViewDual** | 🟡 UPGRADE — CSS Hyperion + Toolbar v2 | P2 |
| **Timecoder Dock** | 🟢 NEW — Espacio para playback de scenes | P3 |
| **TheCommander (controles)** | ✅ NO TOCAR — Están perfectos | — |

### Lo que NO se toca
- ✅ **TheProgrammerContent** — Controles accordion (Intensity, Color, Position, Beam)
- ✅ **StageSidebar** — 3 tabs (CONTROLS | GROUPS | SCENES) 
- ✅ **SceneBrowser** — Scene management
- ✅ **selectionStore** — Lógica de selección (click, shift+click, ctrl+click)
- ✅ **overrideStore** — Per-fixture manual overrides

---

## 🏗️ ARQUITECTURA HYPERION

### Nueva Estructura de Carpetas

```
components/simulator/                   → Renombrar internamente a "hyperion"
├── index.ts                            📦 Re-exports (backward compatible)
│
├── views/                              📁 VISTAS PRINCIPALES
│   ├── HyperionView.tsx                🌞 NEW: Container principal (reemplaza StageViewDual)
│   ├── HyperionView.css                🎨 NEW: CSS Hyperion Design System
│   │
│   ├── tactical/                       📁 RENDERIZADO 2D (TACTICAL VIEW)
│   │   ├── TacticalCanvas.tsx          🎬 NEW: Container canvas (orquestador)
│   │   ├── layers/                     📁 Capas de renderizado (separación de concerns)
│   │   │   ├── GridLayer.ts            🔲 Cyberpunk grid + truss + stage line
│   │   │   ├── FixtureLayer.ts         💡 Fixture rendering (halos, beams, cores)
│   │   │   ├── ZoneLayer.ts            🗺️ Zone labels + stereo division
│   │   │   ├── HUDLayer.ts             📊 FPS, quality badge, palette preview
│   │   │   └── SelectionLayer.ts       ✨ Selection rings, hover rings, lasso
│   │   ├── FixtureTooltip.tsx          🏷️ NEW: HUD Táctico floating popup
│   │   ├── HitTestEngine.ts            🎯 Mouse interaction (click, hover, drag)
│   │   └── TacticalCanvas.css          🎨 Neon styling
│   │
│   └── visualizer/                     📁 RENDERIZADO 3D (VISUALIZER)
│       ├── VisualizerCanvas.tsx         🎬 REFACTOR: R3F canvas (reemplaza Stage3DCanvas)
│       ├── VisualizerCanvas.css         🎨 Neon styling
│       ├── fixtures/                    📁 Fixtures 3D
│       │   ├── HyperionFixture3D.tsx    💡 REFACTOR: Quaternion LERP, neon materials
│       │   ├── MovingHead3D.tsx         🏎️ KEEP: Moving head geometry
│       │   ├── ParCan3D.tsx             💡 KEEP: PAR geometry
│       │   └── index.ts
│       ├── environment/                 📁 Escenario 3D
│       │   ├── NeonFloor.tsx            🌊 NEW: Floor con neon grid reactivo
│       │   ├── HyperionTruss.tsx        🏗️ REFACTOR: Truss con glow
│       │   ├── AtmosphericFog.tsx       🌫️ NEW: Haze volumétrico
│       │   └── index.ts
│       └── postprocessing/              📁 NEW: Post-processing pipeline
│           ├── NeonBloom.tsx            ✨ Bloom selectivo por intensidad
│           ├── ChromaticShift.tsx       🌈 Aberración cromática sutil en beat
│           └── index.ts
│
├── controls/                           📁 SIN CAMBIOS (TheCommander)
│   ├── TheProgrammer.tsx               ✅ NO TOCAR
│   ├── TheProgrammerContent.tsx         ✅ NO TOCAR
│   ├── GroupsPanel.tsx                  🔴 FIX: Migrar zone colors a Canonical
│   ├── IntensitySection.tsx             ✅ NO TOCAR
│   ├── ColorSection.tsx                 ✅ NO TOCAR
│   ├── PositionSection.tsx              ✅ NO TOCAR
│   ├── BeamSection.tsx                  ✅ NO TOCAR
│   ├── sidebar/                         📁 SIN CAMBIOS
│   │   ├── StageSidebar.tsx             ✅ NO TOCAR
│   │   ├── SceneBrowser.tsx             ✅ NO TOCAR
│   │   └── widgets/
│   └── controls/                        📁 SIN CAMBIOS (XYPad, etc)
│
├── shared/                             📁 NEW: Utilidades compartidas 2D/3D
│   ├── ZoneLayoutEngine.ts             🗺️ NEW: Motor de posicionamiento canónico
│   ├── FixtureDataResolver.ts          🔌 NEW: Hybrid rendering data pipeline
│   ├── NeonPalette.ts                  🎨 NEW: Design tokens Hyperion
│   └── types.ts                        📝 NEW: Tipos unificados
│
├── widgets/                            📁 FUTURA EXPANSIÓN
│   └── TimecoderDock.tsx               ⏯️ PLACEHOLDER: Chronos scene playback
│
└── engine/                             📁 FUTURA EXPANSIÓN
    └── (vacío — para lógica de negocio futura)
```

---

## 🎯 PHASE 0: CANONICAL ZONE UNIFICATION

**Prioridad:** P0 — BLOQUEANTE  
**Esfuerzo:** 3-4 horas  
**Objetivo:** Un solo normalizador. Un solo tipo. Una sola verdad.

### 0.1 — ZoneLayoutEngine.ts (NEW)

Motor centralizado que traduce `CanonicalZone` a posiciones de layout tanto para 2D como 3D.

```typescript
/**
 * ☀️ HYPERION — Zone Layout Engine
 * 
 * SINGLE SOURCE OF TRUTH para posicionamiento de fixtures por zona.
 * Usa CanonicalZone de ShowFileV2.ts — los 9 valores canónicos.
 * Alimenta tanto TacticalCanvas (2D) como VisualizerCanvas (3D).
 */
import { normalizeZone, type CanonicalZone, CANONICAL_ZONES } from '../../core/stage/ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// 2D LAYOUT — Posiciones relativas al canvas (0-1 normalized)
// ═══════════════════════════════════════════════════════════════════════════

export interface ZoneLayout2D {
  /** Posición Y relativa (0 = top, 1 = bottom) */
  y: number
  /** Rango X para distribución horizontal [min, max] (0-1) */
  xRange: [number, number]
  /** ¿Es una columna vertical? (movers laterales) */
  vertical?: boolean
  /** Posición X fija (para zonas laterales) */
  fixedX?: number
  /** Label para display */
  label: string
  /** Stereo split config */
  stereo?: {
    leftRange: [number, number]
    rightRange: [number, number]
  }
}

/**
 * Layout 2D para cada zona canónica.
 * Stereo split automático para front/back.
 */
export const ZONE_LAYOUT_2D: Record<CanonicalZone, ZoneLayout2D> = {
  'front': {
    y: 0.85,
    xRange: [0.08, 0.92],
    label: 'FRONT',
    stereo: {
      leftRange: [0.08, 0.42],
      rightRange: [0.58, 0.92],
    },
  },
  'back': {
    y: 0.55,
    xRange: [0.12, 0.88],
    label: 'BACK',
    stereo: {
      leftRange: [0.12, 0.42],
      rightRange: [0.58, 0.88],
    },
  },
  'floor': {
    y: 0.92,
    xRange: [0.15, 0.85],
    label: 'FLOOR',
    stereo: {
      leftRange: [0.15, 0.42],
      rightRange: [0.58, 0.85],
    },
  },
  'movers-left': {
    y: 0.28,
    xRange: [0.12, 0.12],
    label: 'MOVER Ⓛ',
    vertical: true,
    fixedX: 0.12,
  },
  'movers-right': {
    y: 0.28,
    xRange: [0.88, 0.88],
    label: 'MOVER Ⓡ',
    vertical: true,
    fixedX: 0.88,
  },
  'center': {
    y: 0.40,
    xRange: [0.35, 0.65],
    label: 'CENTER',
  },
  'air': {
    y: 0.18,
    xRange: [0.30, 0.70],
    label: 'AIR',
  },
  'ambient': {
    y: 0.08,
    xRange: [0.05, 0.95],
    label: 'AMBIENT',
  },
  'unassigned': {
    y: 0.70,
    xRange: [0.25, 0.75],
    label: 'UNASSIGNED',
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// 3D LAYOUT — Posiciones en metros (espacio real del escenario)
// ═══════════════════════════════════════════════════════════════════════════

export interface ZoneLayout3D {
  /** Altura Y (factor de height: 0=suelo, 1=truss) */
  heightFactor: number
  /** Profundidad Z (factor: -1=fondo, 1=frente) */
  depthFactor: number
  /** Rango X para distribución (factor de halfWidth) */
  xRange: [number, number]
  /** Pitch por defecto en grados (negativo = apunta abajo) */
  defaultPitch: number
  /** ¿Distribuir verticalmente? */
  vertical?: boolean
  /** Posición X fija (factor de halfWidth) */
  fixedX?: number
}

export const ZONE_LAYOUT_3D: Record<CanonicalZone, ZoneLayout3D> = {
  'front': {
    heightFactor: 0.30,
    depthFactor: 0.80,
    xRange: [-0.70, 0.70],
    defaultPitch: -30,
  },
  'back': {
    heightFactor: 0.85,
    depthFactor: -0.60,
    xRange: [-0.60, 0.60],
    defaultPitch: -45,
  },
  'floor': {
    heightFactor: 0.05,
    depthFactor: 0.60,
    xRange: [-0.65, 0.65],
    defaultPitch: 80,     // Apunta hacia arriba (uplight)
  },
  'movers-left': {
    heightFactor: 0.70,
    depthFactor: 0.00,
    xRange: [-0.85, -0.85],
    defaultPitch: -20,
    vertical: true,
    fixedX: -0.85,
  },
  'movers-right': {
    heightFactor: 0.70,
    depthFactor: 0.00,
    xRange: [0.85, 0.85],
    defaultPitch: -20,
    vertical: true,
    fixedX: 0.85,
  },
  'center': {
    heightFactor: 0.90,
    depthFactor: -0.30,
    xRange: [-0.30, 0.30],
    defaultPitch: -60,
  },
  'air': {
    heightFactor: 0.60,
    depthFactor: -0.50,
    xRange: [-0.20, 0.20],
    defaultPitch: 0,      // Horizontal (lásers, aerials)
  },
  'ambient': {
    heightFactor: 0.95,
    depthFactor: 0.50,
    xRange: [-0.90, 0.90],
    defaultPitch: -90,    // Directamente hacia abajo
  },
  'unassigned': {
    heightFactor: 0.50,
    depthFactor: 0.00,
    xRange: [-0.50, 0.50],
    defaultPitch: -30,
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Resuelve la zona canónica de un fixture (acepta CUALQUIER input legacy) */
export function resolveFixtureZone(zone: string | undefined | null): CanonicalZone {
  return normalizeZone(zone)
}

/** Distribuye N fixtures uniformemente en un rango */
export function distributeInRange(
  index: number, 
  total: number, 
  min: number, 
  max: number
): number {
  if (total <= 1) return (min + max) / 2
  return min + ((max - min) * index) / (total - 1)
}

/** Agrupa fixtures por zona canónica */
export function groupByCanonicalZone<T extends { zone?: string }>(
  fixtures: T[]
): Map<CanonicalZone, T[]> {
  const groups = new Map<CanonicalZone, T[]>()
  
  for (const zone of CANONICAL_ZONES) {
    groups.set(zone, [])
  }
  
  for (const fixture of fixtures) {
    const canonical = normalizeZone(fixture.zone)
    groups.get(canonical)!.push(fixture)
  }
  
  return groups
}
```

### 0.2 — Eliminar layoutGenerator3D.normalizeZone() (KILL)

**Archivo:** `utils/layoutGenerator3D.ts`  
**Acción:** Eliminar la función `normalizeZone()` local (líneas 198-220) e importar `normalizeZone` de ShowFileV2. Cambiar `ZONE_DEFINITIONS` para usar `CanonicalZone` como key.

### 0.3 — Fix StageSimulator2 Zone Mapping (KILL HARDCODE)

**Archivo:** `views/SimulateView/StageSimulator2.tsx`  
**Acción:** Eliminar el bloque de mapping hardcoded (líneas 206-226) y reemplazar con:

```typescript
import { normalizeZone, type CanonicalZone } from '../../../../core/stage/ShowFileV2'

// En FixtureVisual type:
zone: CanonicalZone  // ← Reemplaza 'front' | 'back' | 'left' | 'right' | 'center'

// En fixture processing:
const zone = normalizeZone(runtimeState?.zone || fixture.zone)
```

### 0.4 — Fix GroupsPanel Zone Colors (CRITICAL)

**Archivo:** `controls/GroupsPanel.tsx`

**Problema Detectado:** El `ZONE_COLORS` en GroupsPanel usa **legacy zone names** como keys:

```typescript
// ❌ ACTUAL — Legacy names que ya NO se usan
const ZONE_COLORS: Record<string, string> = {
  'ceiling-front': '#FFDD00',
  'ceiling-back': '#A855F7',
  'ceiling-left': '#00FFFF',
  'ceiling-right': '#FF6B6B',
  'ceiling-center': '#4ADE80',
  'stage-left': '#00FFFF',
  'stage-right': '#FF6B6B',
  'floor-front': '#FFDD00',
  'floor-back': '#A855F7',
  'truss-1': '#F97316',
  'truss-2': '#06B6D4',
  'truss-3': '#EC4899',
  'unassigned': '#666666',
}
```

**Consecuencia:** Desde que `stageStore` normaliza zones a canónicas (WAVE 2040.24), **NINGÚN fixture tiene zone `'ceiling-front'` o `'stage-left'`** en runtime. Todos son `'front'`, `'movers-left'`, etc. Las zonas llegan al GroupsPanel como canónicas pero los colores están mapeados a legacy names → **todos los system groups por zona aparecen con color `#888888` (fallback)**.

**Fix:**
```typescript
// ✅ HYPERION — Canonical zone colors
import { type CanonicalZone, ZONE_LABELS } from '../../../core/stage/ShowFileV2'

const ZONE_COLORS: Record<CanonicalZone, string> = {
  'front':         '#FF6B35',   // Naranja cálido (wash audience)
  'back':          '#A855F7',   // Púrpura (counterlight drama)
  'floor':         '#22D3EE',   // Cyan floor (uplight frío)
  'movers-left':   '#3B82F6',   // Azul eléctrico
  'movers-right':  '#F43F5E',   // Rosa eléctrico
  'center':        '#FACC15',   // Amarillo blinder
  'air':           '#10B981',   // Verde laser
  'ambient':       '#94A3B8',   // Gris plateado (house)
  'unassigned':    '#475569',   // Gris oscuro
}
```

---

## 🎨 PHASE 1: NEON TOTAL — EL LENGUAJE VISUAL HYPERION

**Prioridad:** P1  
**Esfuerzo:** 6-8 horas  
**Objetivo:** Un sistema de diseño visual cohesivo que grite "2026".

### 1.1 — Design System: NeonPalette.ts

Tokens de diseño compartidos entre 2D canvas, 3D renderer y CSS.

```typescript
/**
 * ☀️ HYPERION NEON PALETTE
 * Design tokens para el lenguaje visual Hyperion.
 * Compartidos entre Canvas 2D, Three.js 3D y CSS.
 */

export const HYPERION = {
  // ── FONDOS ─────────────────────────────────────────────────────────
  bg: {
    void:     '#050508',    // Negro absoluto (canvas background)
    surface:  '#0a0a12',    // Superficie base (panels)
    elevated: '#0f0f1a',    // Superficie elevada (toolbar, sidebar)
    overlay:  '#141420',    // Overlays y modales
  },

  // ── NEON PRIMARIOS ─────────────────────────────────────────────────
  neon: {
    cyan:     '#00F0FF',    // Selección, borders principales
    magenta:  '#FF00E5',    // Hover, accents secundarios
    gold:     '#FFD700',    // Warnings, BPM indicator
    green:    '#00FF6A',    // OK, confidence alta, FPS bueno
    red:      '#FF003C',    // Error, strike, FPS bajo
    purple:   '#B026FF',    // Stereo division, mood
  },

  // ── NEON GRADIENTES ────────────────────────────────────────────────
  gradient: {
    toolbar:    'linear-gradient(180deg, #0f0f1a 0%, #0a0a12 100%)',
    viewport:   'linear-gradient(135deg, rgba(0,240,255,0.03) 0%, rgba(255,0,229,0.03) 100%)',
    glow:       'radial-gradient(ellipse, rgba(0,240,255,0.15) 0%, transparent 70%)',
    beatPulse:  'radial-gradient(circle, rgba(255,0,229,0.4) 0%, transparent 60%)',
  },

  // ── GRID ───────────────────────────────────────────────────────────
  grid: {
    line:       'rgba(0, 240, 255, 0.06)',   // Líneas base
    accent:     'rgba(0, 240, 255, 0.12)',   // Cada 4 líneas
    cross:      'rgba(0, 240, 255, 0.20)',   // Cruces centrales
  },

  // ── TIPOGRAFÍA ─────────────────────────────────────────────────────
  font: {
    primary:    "'JetBrains Mono', 'Fira Code', monospace",
    display:    "'Orbitron', 'JetBrains Mono', monospace",
  },

  // ── BORDES ─────────────────────────────────────────────────────────
  border: {
    subtle:     '1px solid rgba(0, 240, 255, 0.08)',
    normal:     '1px solid rgba(0, 240, 255, 0.15)',
    active:     '1px solid rgba(0, 240, 255, 0.40)',
    glow:       '0 0 12px rgba(0, 240, 255, 0.25), 0 0 4px rgba(0, 240, 255, 0.15)',
  },

  // ── SHADOWS / GLOWS ────────────────────────────────────────────────
  glow: {
    cyan:       '0 0 20px rgba(0, 240, 255, 0.3), 0 0 60px rgba(0, 240, 255, 0.1)',
    magenta:    '0 0 20px rgba(255, 0, 229, 0.3), 0 0 60px rgba(255, 0, 229, 0.1)',
    fixture:    '0 0 30px rgba(VAR, VAR, VAR, 0.5)',  // Dinámico por fixture color
    beat:       '0 0 40px rgba(255, 0, 229, 0.4)',
  },

  // ── TIMING ─────────────────────────────────────────────────────────
  transition: {
    instant:    '0.05s ease',
    fast:       '0.15s ease',
    normal:     '0.25s ease-out',
    smooth:     '0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const
```

### 1.2 — HyperionView.css: CSS que grita 2026

```css
/**
 * ☀️ HYPERION VIEW — THE NEON REBIRTH
 * CSS inspirado en Chronos/Hephaestus pero con identidad propia.
 */

/* ═══════════════════════════════════════════════════════════════════════
 * CONTAINER PRINCIPAL
 * ═══════════════════════════════════════════════════════════════════════ */

.hyperion-view {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #050508;
  overflow: hidden;
  position: relative;
  /* Scanline sutil — CRT nostalgia */
  background-image: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 240, 255, 0.008) 2px,
    rgba(0, 240, 255, 0.008) 4px
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * TOOLBAR — Command Strip
 * ═══════════════════════════════════════════════════════════════════════ */

.hyperion-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 16px;
  background: linear-gradient(180deg, #0f0f1a 0%, #0a0a12 100%);
  border-bottom: 1px solid rgba(0, 240, 255, 0.12);
  flex-shrink: 0;
  z-index: 10;
  /* Glow inferior sutil */
  box-shadow: 0 2px 20px rgba(0, 240, 255, 0.05);
}

/* ═══════════════════════════════════════════════════════════════════════
 * VIEWPORT — El escenario
 * ═══════════════════════════════════════════════════════════════════════ */

.hyperion-viewport {
  flex: 1;
  position: relative;
  min-height: 0;
  overflow: hidden;
  /* Borde neon animado exterior */
  border: 1px solid rgba(0, 240, 255, 0.08);
  /* Inner glow — respira con el beat */
  box-shadow: 
    inset 0 0 60px rgba(0, 240, 255, 0.03),
    inset 0 0 120px rgba(255, 0, 229, 0.02);
}

.hyperion-viewport::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  /* Corner accents — esquinas iluminadas */
  background:
    linear-gradient(135deg, rgba(0,240,255,0.15) 0%, transparent 5%) top left,
    linear-gradient(225deg, rgba(0,240,255,0.15) 0%, transparent 5%) top right,
    linear-gradient(315deg, rgba(255,0,229,0.10) 0%, transparent 5%) bottom left,
    linear-gradient(45deg,  rgba(255,0,229,0.10) 0%, transparent 5%) bottom right;
  background-repeat: no-repeat;
  background-size: 80px 80px;
}

/* ═══════════════════════════════════════════════════════════════════════
 * BEAT PULSE — El viewport respira con la música
 * ═══════════════════════════════════════════════════════════════════════ */

.hyperion-viewport.on-beat {
  box-shadow:
    inset 0 0 80px rgba(255, 0, 229, 0.08),
    inset 0 0 160px rgba(0, 240, 255, 0.04),
    0 0 30px rgba(255, 0, 229, 0.05);
  transition: box-shadow 0.05s ease;
}

.hyperion-viewport:not(.on-beat) {
  transition: box-shadow 0.4s ease-out;
}

/* ═══════════════════════════════════════════════════════════════════════
 * MODE INDICATOR — Floating badge con personalidad
 * ═══════════════════════════════════════════════════════════════════════ */

.hyperion-mode-badge {
  position: absolute;
  bottom: 12px;
  left: 12px;
  padding: 5px 14px;
  background: rgba(5, 5, 8, 0.85);
  border: 1px solid rgba(0, 240, 255, 0.25);
  border-radius: 3px;
  color: #00F0FF;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  pointer-events: none;
  z-index: 5;
  backdrop-filter: blur(8px);
  box-shadow: 0 0 15px rgba(0, 240, 255, 0.1);
}

/* ═══════════════════════════════════════════════════════════════════════
 * ANIMATED NEON BORDER — Chronos-inspired
 * ═══════════════════════════════════════════════════════════════════════ */

@keyframes hyperion-border-flow {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.hyperion-viewport-border {
  position: absolute;
  inset: -1px;
  pointer-events: none;
  z-index: 3;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(
    90deg, 
    rgba(0,240,255,0.0) 0%,
    rgba(0,240,255,0.3) 25%,
    rgba(255,0,229,0.3) 50%,
    rgba(0,240,255,0.3) 75%,
    rgba(0,240,255,0.0) 100%
  );
  background-size: 200% 100%;
  animation: hyperion-border-flow 8s linear infinite;
  -webkit-mask: 
    linear-gradient(#fff 0 0) content-box, 
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}
```

### 1.3 — TacticalCanvas: Grid Layer Neon

El grid del modo 2D pasa de líneas grises opacas a un **cyberpunk grid** con cruces en las intersecciones y accent lines cada 4 columnas:

```typescript
// GridLayer.ts — Hyperion Neon Grid

export function renderGrid(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const gridSize = 40

  // Base grid lines — cyan fantasmal
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)'
  ctx.lineWidth = 0.5

  for (let x = 0; x <= W; x += gridSize) {
    const isAccent = x % (gridSize * 4) === 0
    ctx.strokeStyle = isAccent ? 'rgba(0, 240, 255, 0.10)' : 'rgba(0, 240, 255, 0.04)'
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }

  for (let y = 0; y <= H; y += gridSize) {
    const isAccent = y % (gridSize * 4) === 0
    ctx.strokeStyle = isAccent ? 'rgba(0, 240, 255, 0.10)' : 'rgba(0, 240, 255, 0.04)'
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }

  // Cross markers en intersecciones de accent lines
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)'
  ctx.lineWidth = 1
  const crossSize = 4

  for (let x = 0; x <= W; x += gridSize * 4) {
    for (let y = 0; y <= H; y += gridSize * 4) {
      ctx.beginPath()
      ctx.moveTo(x - crossSize, y)
      ctx.lineTo(x + crossSize, y)
      ctx.moveTo(x, y - crossSize)
      ctx.lineTo(x, y + crossSize)
      ctx.stroke()
    }
  }
}
```

---

## 🏷️ PHASE 2: HUD TÁCTICO — FIXTURE TOOLTIP

**Prioridad:** P1  
**Esfuerzo:** 3-4 horas  
**Objetivo:** Al hacer hover sobre un fixture → pop-up flotante con datos reales.

### 2.1 — FixtureTooltip.tsx

Componente React superpuesto sobre el canvas. Se posiciona relativo al fixture con coordenadas del HitTestEngine.

```tsx
/**
 * ☀️ HYPERION — Fixture Tactical Tooltip
 * 
 * Pop-up flotante que aparece al hover sobre un fixture.
 * Datos 100% reales de truthStore + stageStore.
 * Estética: HUD de caza militar + neon cyberpunk.
 */

interface FixtureTooltipProps {
  fixtureId: string
  position: { x: number; y: number }  // Coordenadas CSS del fixture
  visible: boolean
}

// Layout del tooltip:
//
//  ┌─────────────────────────────────┐
//  │ 🔴 PAR #101         FRONT Ⓛ    │  ← Header: Type + ID + Zone
//  ├─────────────────────────────────┤
//  │ DIM  ████████████████░░  78%    │  ← Barra de intensidad
//  │ RGB  (255, 32, 180)    ■       │  ← Color + swatch
//  │ PAN  127°   TILT  -34°         │  ← Position (solo movers)
//  │ ZOOM  Wash 65%   FOCUS  Sharp  │  ← Optics (solo movers)
//  │ DMX  @089                       │  ← Dirección DMX
//  └─────────────────────────────────┘
//
// Comportamiento:
// - Aparece 150ms después del hover (debounce para no molestar)
// - Se posiciona ARRIBA del fixture (o ABAJO si no cabe)
// - Desaparece inmediatamente al salir
// - NO bloquea clicks (pointer-events: none)
// - Anchura fija 260px, altura dinámica
```

### 2.2 — CSS del Tooltip

```css
.fixture-tooltip {
  position: absolute;
  pointer-events: none;
  z-index: 100;
  width: 260px;
  background: rgba(5, 5, 10, 0.92);
  border: 1px solid rgba(0, 240, 255, 0.30);
  border-radius: 4px;
  padding: 10px 14px;
  font-family: 'JetBrains Mono', monospace;
  backdrop-filter: blur(12px);
  box-shadow: 
    0 0 20px rgba(0, 240, 255, 0.12),
    0 4px 30px rgba(0, 0, 0, 0.6);
  
  /* Entrada suave */
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fixture-tooltip.visible {
  opacity: 1;
  transform: translateY(0);
}

.tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(0, 240, 255, 0.12);
  margin-bottom: 8px;
}

.tooltip-fixture-name {
  font-size: 12px;
  font-weight: 700;
  color: #00F0FF;
  letter-spacing: 0.5px;
}

.tooltip-zone-badge {
  font-size: 9px;
  padding: 2px 8px;
  border-radius: 2px;
  background: rgba(0, 240, 255, 0.10);
  border: 1px solid rgba(0, 240, 255, 0.20);
  color: var(--zone-color, #00F0FF);
  font-weight: 600;
  letter-spacing: 0.5px;
}

.tooltip-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 11px;
}

.tooltip-label {
  color: rgba(255, 255, 255, 0.45);
  font-weight: 600;
  min-width: 38px;
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.5px;
}

.tooltip-value {
  color: #E0E0E8;
  font-weight: 500;
}

/* Barra de intensidad mini */
.tooltip-dim-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.tooltip-dim-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.1s ease;
  /* Color dinámico del fixture */
  background: var(--fixture-color, #00F0FF);
  box-shadow: 0 0 8px var(--fixture-color, #00F0FF);
}

/* Swatch de color */
.tooltip-color-swatch {
  width: 14px;
  height: 14px;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 0 8px var(--fixture-color, #000);
}
```

---

## 🎬 PHASE 3: TACTICAL CANVAS REFACTOR (2D)

**Prioridad:** P1  
**Esfuerzo:** 6-8 horas  
**Objetivo:** Split del monolito StageSimulator2 en capas modulares con estética neon.

### 3.1 — Arquitectura de Capas

El renderizado 2D pasa de un monolito de 1105 líneas a un sistema de capas independientes:

```
TacticalCanvas.tsx (orchestrator, ~200 líneas)
│
├── useCanvasSetup()     → Resize, DPR, animation loop
├── useFixtureData()     → Hybrid rendering pipeline (truth + stage stores)
├── useHitTest()         → Mouse interaction engine
│
│   Render Pipeline (cada frame, en orden):
│
├── 1. GridLayer.render()         → Background grid + truss + stage line
├── 2. ZoneLayer.render()         → Zone labels + stereo center line
├── 3. FixtureLayer.render()      → All fixtures (halos, beams, cores)
├── 4. SelectionLayer.render()    → Selection/hover rings
├── 5. HUDLayer.render()          → FPS, quality, palette, fixture count
│
└── FixtureTooltip (React overlay) → Hover popup con datos reales
```

### 3.2 — FixtureLayer: Neon Total

El renderizado de fixtures evoluciona del "glow básico" al **Neon Total**:

**Antes (WAVE 436):**
- Halo radial simple con 4 color stops
- Core blanco con gradiente
- Beam cónico con gradiente linear

**Después (Hyperion):**
```
FIXTURE RENDER PIPELINE (por fixture):
│
├── 1. OUTER AURA (nuevo)
│     Radial gradient ultra-difuso, R=120px+
│     Simula scatter atmosférico
│     Solo en HIGH quality, intensity > 0.3
│
├── 2. NEON HALO (mejorado)
│     Radial gradient con color stops más aggressive
│     Doble pase: primer pase diffuse, segundo pase sharp inner ring
│     Respira con beat (radius ±5% en onBeat)
│
├── 3. BEAM CONE (mejorado, solo movers)
│     Trapezoid con width controlado por ZOOM
│     Edge sharpness controlada por FOCUS
│     NUEVO: Light spill lateral (secondary rays a ±15°)
│     NUEVO: Dust particles effect (puntos random en el beam)
│
├── 4. COLOR CORE (mejorado)
│     Más sólido, saturación boosted
│     Neon ring exterior alrededor del core
│
├── 5. WHITE HOT CENTER
│     Punto central blanco brillante
│     Scale = f(intensity) — más intenso = más grande
│
└── 6. NEON RIM (nuevo)
      Anillo fino de 1px en el color del fixture
      Siempre visible (incluso con intensity=0)
      Da identidad visual al fixture apagado
```

### 3.3 — Fixture Apagado: Identidad Visual

**Antes:** Círculo gris `#222222` sin personalidad.  
**Después:**

```typescript
// Fixture OFF pero con identidad
if (isCompletelyOff) {
  // Anillo fino del color del fixture (memoria)
  ctx.beginPath()
  ctx.arc(x, y, baseRadius, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.15)`  // Color tenue
  ctx.lineWidth = 1
  ctx.stroke()

  // Interior oscuro con leve hint
  ctx.fillStyle = 'rgba(10, 10, 18, 0.8)'
  ctx.fill()

  // Dot central mínimo (fixture exists but sleeping)
  ctx.beginPath()
  ctx.arc(x, y, 2, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0, 240, 255, 0.15)'
  ctx.fill()
}
```

---

## 🌐 PHASE 4: VISUALIZER CANVAS REFACTOR (3D)

**Prioridad:** P1  
**Esfuerzo:** 8-10 horas  
**Objetivo:** Render 3D profesional con Quaternion LERP, neon materials, y escalabilidad.

### 4.1 — Gimbal Lock Fix: Quaternion LERP

**Problema actual:** Fixture3D usa Euler angles directos para Pan/Tilt:
```typescript
// ❌ ACTUAL — Euler angles → GIMBAL LOCK en posiciones extremas
yokeRef.current.rotation.y = visualPanAngle.current   // PAN
headRef.current.rotation.x = visualTiltAngle.current   // TILT
```

**Gimbal Lock ocurre cuando:** Tilt = ±90° → el eje de Pan y Tilt se alinean → se pierde un grado de libertad → el fixture "salta" visualmente.

**Fix con Quaternion SLERP:**

```typescript
// ✅ HYPERION — Quaternion interpolation (NO gimbal lock)
import * as THREE from 'three'

// En HyperionFixture3D.tsx:

// Refs para quaternion targets
const targetYokeQuat = useRef(new THREE.Quaternion())
const currentYokeQuat = useRef(new THREE.Quaternion())
const targetHeadQuat = useRef(new THREE.Quaternion())
const currentHeadQuat = useRef(new THREE.Quaternion())

// Ejes de rotación constantes
const PAN_AXIS = new THREE.Vector3(0, 1, 0)   // Y-axis for PAN
const TILT_AXIS = new THREE.Vector3(1, 0, 0)  // X-axis for TILT

useFrame((_, delta) => {
  // ... (read transient data)

  // Calculate target quaternions from angles
  const targetPanAngle = (livePan - 0.5) * Math.PI * 2.0
  const targetTiltAngle = -(liveTilt - 0.5) * Math.PI * 1.0

  targetYokeQuat.current.setFromAxisAngle(PAN_AXIS, targetPanAngle)
  targetHeadQuat.current.setFromAxisAngle(TILT_AXIS, targetTiltAngle)

  // SLERP interpolation — smooth, no gimbal lock
  // Speed factor: higher = faster convergence
  const speed = 8.0  // Adjustable: 4 = slow/cinematic, 12 = snappy
  const t = 1 - Math.exp(-speed * delta)  // Exponential decay (frame-independent)

  currentYokeQuat.current.slerp(targetYokeQuat.current, t)
  currentHeadQuat.current.slerp(targetHeadQuat.current, t)

  // Apply quaternions (NOT euler angles)
  if (yokeRef.current) {
    yokeRef.current.quaternion.copy(currentYokeQuat.current)
  }
  if (headRef.current) {
    headRef.current.quaternion.copy(currentHeadQuat.current)
  }
})
```

**Beneficios:**
1. ✅ **Zero gimbal lock** — Quaternions no sufren este problema
2. ✅ **Frame-independent SLERP** — `1 - Math.exp(-speed * delta)` funciona igual a 30fps o 144fps
3. ✅ **Shortest path rotation** — SLERP siempre toma la ruta más corta
4. ✅ **Eliminados:** Speed limiter manual, soft landing, teleport detection (SLERP lo hace todo)

### 4.2 — Neon Materials (3D)

**Problema actual:** Fixtures 3D usan `meshStandardMaterial` gris → oscuro y sin vida.

**Solución Hyperion:**

```typescript
// ✅ HYPERION — Emissive neon materials

// Moving Head Base — Dark metal con edge glow
<meshStandardMaterial
  color="#0a0a14"
  metalness={0.9}
  roughness={0.1}
  emissive={selected ? '#00F0FF' : '#0a0a14'}
  emissiveIntensity={selected ? 0.3 : 0}
/>

// Moving Head Yoke Arms — Neon edge
<meshStandardMaterial
  color="#12122a"
  metalness={0.85}
  roughness={0.15}
  emissive="#00F0FF"
  emissiveIntensity={0.05}  // Siempre visible, tenue
/>

// Light Lens — Color del fixture con emission
<meshStandardMaterial
  color={threeColor}
  emissive={threeColor}
  emissiveIntensity={intensity * 2.0}
  transparent
  opacity={0.3 + intensity * 0.7}
  toneMapped={false}  // Permite HDR brightness
/>
```

### 4.3 — NeonFloor: Grid Reactivo

El suelo del escenario 3D pasa de plano gris a **grid neon reactivo al beat:**

```typescript
// NeonFloor.tsx — Suelo con grid que pulsa

// Shader grid que brilla con el beat
const NeonFloorMaterial = shaderMaterial(
  {
    uBeatIntensity: 0,
    uColor1: new THREE.Color('#00F0FF'),
    uColor2: new THREE.Color('#FF00E5'),
    uGridSize: 1.0,
    uTime: 0,
  },
  // Vertex: pass UV
  vertexShader,
  // Fragment: grid lines con glow que pulsa en onBeat
  fragmentShader
)

// El floor reacciona al beat via truthStore
// uBeatIntensity se interpola suavemente: 1.0 en onBeat → 0.0 decay
```

### 4.4 — Post-Processing: Bloom Selectivo

```typescript
// NeonBloom.tsx — Bloom solo en fixtures encendidos

import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing'

<EffectComposer>
  {/* Bloom selectivo — solo objetos con emissive > threshold */}
  <Bloom
    intensity={0.8}
    luminanceThreshold={0.6}    // Solo los más brillantes
    luminanceSmoothing={0.3}
    radius={0.4}
  />

  {/* Aberración cromática sutil — pulsa con beat */}
  <ChromaticAberration
    offset={[beatPulse * 0.001, beatPulse * 0.0005]}
    radialModulation
    modulationOffset={0.5}
  />
</EffectComposer>
```

**⚠️ RIESGO CRÍTICO — Performance del Bloom:**

El post-processing con Bloom + Aberración Cromática es **muy costoso en GPU**, especialmente en laptops de 16GB RAM con GPU integrada (como la tuya, Radwulf).

**SOLUCIÓN OBLIGATORIA:**

```typescript
// HyperionView.tsx — Quality Toggle VISIBLE en toolbar

const [qualityMode, setQualityMode] = useState<'HQ' | 'LQ'>('HQ')

// En VisualizerCanvas.tsx:
// Solo renderizar EffectComposer si qualityMode === 'HQ'

{qualityMode === 'HQ' ? (
  <EffectComposer>
    <Bloom {...bloomConfig} />
    <ChromaticAberration {...caConfig} />
  </EffectComposer>
) : null}
```

**UI del Toggle:**

```tsx
// En HyperionToolbar.tsx
<button 
  className={`quality-toggle ${qualityMode}`}
  onClick={() => setQualityMode(q => q === 'HQ' ? 'LQ' : 'HQ')}
>
  {qualityMode === 'HQ' ? '✨ HQ' : '⚡ LQ'}
</button>
```

**CSS:**
```css
.quality-toggle {
  padding: 4px 12px;
  border-radius: 3px;
  border: 1px solid rgba(0, 240, 255, 0.2);
  background: rgba(10, 10, 18, 0.8);
  color: #00F0FF;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quality-toggle.HQ {
  background: rgba(0, 240, 255, 0.1);
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.15);
}

.quality-toggle.LQ {
  background: rgba(255, 215, 0, 0.1);
  border-color: rgba(255, 215, 0, 0.3);
  color: #FFD700;
}
```

**Comportamiento:**
- **HQ Mode:** Bloom + ChromaticAberration activados → hermoso pero costoso
- **LQ Mode:** Post-processing desactivado → recupera 25-30fps en laptops patata
- **Toggle visible** en toolbar principal (no escondido en settings)
- **Persistencia:** Guardar preferencia en `localStorage` → recordar entre sesiones

### 4.5 — Escalabilidad: Instanced Rendering

Para manejar **cientos de fixtures** sin caída de framerate:

```typescript
// VisualizerCanvas.tsx — Instanced rendering para PARs

// En lugar de 50 componentes <ParCan3D /> separados:
// UNA SOLA INSTANCIA con 50 transforms

<instancedMesh ref={parInstancesRef} args={[null, null, maxParCount]}>
  <cylinderGeometry args={[0.15, 0.2, 0.12, 8]} />
  <meshStandardMaterial
    color="#1a1a2e"
    metalness={0.8}
    roughness={0.2}
  />
</instancedMesh>

// En useFrame: actualizar matrices de cada instancia
// O(1) draw calls para TODOS los PARs del mismo tipo
// Resultado: 200 PARs = 1 draw call (vs 200 draw calls antes)
```

**Beneficio de escalabilidad:**

| Fixture Count | Antes (individual meshes) | Hyperion (instanced) |
|--------------|--------------------------|---------------------|
| 20 fixtures  | 20 draw calls, ~60fps     | 3 draw calls, ~60fps |
| 100 fixtures | 100 draw calls, ~35fps    | 5 draw calls, ~60fps |
| 500 fixtures | 500 draw calls, ~12fps    | 8 draw calls, ~55fps |

**⚠️ RIESGO CRÍTICO — Selección Individual con Instanced Meshes:**

`InstancedMesh` es performant pero **complica el raycasting** — cuando haces click en el 3D, Three.js devuelve:
```
{
  instanceId: 45,       // ← Índice de la instancia (0-199)
  object: InstancedMesh // ← NO es el fixture individual
}
```

**Problema:** Necesitamos traducir `instanceId: 45` → `Fixture ID: 104` para la selección.

**SOLUCIÓN OBLIGATORIA:**

```typescript
// VisualizerCanvas.tsx — Instanced Hit Test Engine

// Mantener un mapa: instanceIndex → fixtureId
const instanceToFixtureMap = useRef<Map<number, string>>(new Map())

// Al construir las instancias:
parFixtures.forEach((fixture, index) => {
  instanceToFixtureMap.current.set(index, fixture.id)
  
  // Set transform matrix para la instancia
  const matrix = new THREE.Matrix4()
  matrix.setPosition(fixture.position.x, fixture.position.y, fixture.position.z)
  parInstancesRef.current.setMatrixAt(index, matrix)
})

// En el event handler de onClick (usando R3F raycaster):
const handleClick = (event) => {
  if (event.instanceId !== undefined) {
    // Es un InstancedMesh → traducir
    const fixtureId = instanceToFixtureMap.current.get(event.instanceId)
    if (fixtureId) {
      // Trigger selección con el ID real del fixture
      selectionStore.toggleFixture(fixtureId, event.shiftKey, event.ctrlKey)
    }
  } else {
    // Es un mesh individual (MovingHead3D) → usar .userData.fixtureId
    const fixtureId = event.object.userData?.fixtureId
    if (fixtureId) {
      selectionStore.toggleFixture(fixtureId, event.shiftKey, event.ctrlKey)
    }
  }
}
```

**Comportamiento Garantizado:**
- ✅ Click en PAR instanced → selecciona fixture correcto
- ✅ Shift+Click en PAR instanced → añade a selección
- ✅ Ctrl+Click en PAR instanced → toggle individual
- ✅ Hover sobre PAR instanced → muestra tooltip con ID correcto
- ✅ Hybrid system: PARs instanced, MovingHeads individuales (más complejos)

**Testing Checklist:**
- [ ] Click selecciona fixture correcto (verificar ID en TheProgrammer)
- [ ] Shift+Click multi-selección funciona
- [ ] Hover tooltip muestra ID correcto
- [ ] Selection rings aparecen en el fixture clickeado
- [ ] Group select (lasso) funciona con fixtures instanced

---

## ⏯️ PHASE 5: TIMECODER DOCK

**Prioridad:** P3  
**Esfuerzo:** 4-5 horas  
**Objetivo:** Espacio reservado para reproducir scenes de Chronos en Live View.

### 5.1 — Concepto

El Timecoder Dock es un panel inferior (estilo mini-player) que aparece cuando hay un show cargado. Permite:

```
┌─────────────────────────────────────────────────────────────────┐
│ ☀️ HYPERION                                                      │
│ ┌─── TOOLBAR ──────────────────────────────────────────────────┐│
│ │ [2D/3D] │ ❤ 128 BPM │ ⚡ 73% │ 😌 CHILL │      [⚡] [🔧] ││
│ └──────────────────────────────────────────────────────────────┘│
│ ┌─────────────────────────────────┬────────────────────────────┐│
│ │                                 │ CONTROLS | GROUPS | SCENES ││
│ │         VIEWPORT                │ ┌────────────────────────┐ ││
│ │         (2D / 3D)               │ │                        │ ││
│ │                                 │ │  TheProgrammerContent   │ ││
│ │                                 │ │  (sin cambios)          │ ││
│ │                                 │ │                        │ ││
│ │                                 │ └────────────────────────┘ ││
│ └─────────────────────────────────┴────────────────────────────┘│
│ ┌─── TIMECODER DOCK ───────────────────────────────────────────┐│
│ │ ⏮ ▶ ⏭ │ 🎬 Scene: "Intro Build" │ ▓▓▓▓▓▓░░░░░░░░ 2:34 │ ││
│ └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 — Implementación (Placeholder)

```tsx
// TimecoderDock.tsx — Placeholder para WAVE futura
//
// Este componente se conectará a Chronos Scene Engine:
// - Cargar escenas desde ChronosProject
// - Controles: Play/Pause/Next/Prev
// - Timeline mini (progress bar)
// - Nombre de la escena activa
// - Tiempo transcurrido / total
//
// Para WAVE 2042: Solo reservamos el espacio visual.
// La integración real con Chronos viene en una wave posterior.
```

---

## 🔧 PHASE 6: INTEGRATION & CLEANUP

**Prioridad:** P2-P3  
**Esfuerzo:** 3-4 horas  
**Objetivo:** Conectar todo, limpiar legacy, validar TypeScript.

### 6.1 — Backward Compatibility

```typescript
// simulator/index.ts — Exports retrocompatibles
// Los imports existentes siguen funcionando

export { HyperionView as StageViewDual } from './views/HyperionView'
export { TacticalCanvas as StageSimulator2 } from './views/tactical/TacticalCanvas'
export { VisualizerCanvas as Stage3DCanvas } from './views/visualizer/VisualizerCanvas'
// ... rest of existing exports unchanged
```

### 6.2 — Legacy Comment Purge

Todos los archivos actualizados pierden sus comentarios WAVE 24-436 y reciben el header Hyperion:

```typescript
/**
 * ☀️ HYPERION — [Component Name]
 * [One-line description]
 *
 * @module components/simulator/[path]
 * @since WAVE 2042 (Project Hyperion)
 */
```

### 6.3 — TypeScript Strict Validation

```bash
# Validar que todo compila sin errores
npx tsc --noEmit

# Verificar que NO hay 'any' nuevo
grep -r ": any" src/components/simulator/ --include="*.tsx" --include="*.ts"
```

---

## 📊 EFFORT MATRIX

| Phase | Nombre | Prioridad | Horas Est. | Dependencias |
|-------|--------|-----------|-----------|--------------|
| **0** | Canonical Zone Unification | P0 | 3-4h | Ninguna |
| **1** | Neon Total Design System | P1 | 3-4h | Phase 0 |
| **2** | HUD Táctico (Tooltip) | P1 | 3-4h | Phase 0 |
| **3** | Tactical Canvas Refactor (2D) | P1 | 6-8h | Phase 0, 1 |
| **4** | Visualizer Canvas Refactor (3D) | P1 | 8-10h | Phase 0, 1 |
| **5** | Timecoder Dock | P3 | 4-5h | Phase 3 |
| **6** | Integration & Cleanup | P2 | 3-4h | All above |
|       | **TOTAL** | | **30-39h** | |

### Orden de Ejecución Recomendado

```
WAVE 2042.1  → Phase 0: Canonical Zone Unification (P0, bloqueante)
WAVE 2042.2  → Phase 1: NeonPalette + CSS Hyperion (design system)
WAVE 2042.3  → Phase 2: HUD Táctico (FixtureTooltip)
WAVE 2042.4  → Phase 3: TacticalCanvas split + neon rendering (2D)
WAVE 2042.5  → Phase 4a: Quaternion SLERP + Neon Materials (3D)
WAVE 2042.6  → Phase 4b: NeonFloor + PostProcessing + Instancing (3D)
WAVE 2042.7  → Phase 5: Timecoder Dock (placeholder)
WAVE 2042.8  → Phase 6: Integration, cleanup, validation
```

---

## 🎯 CRITERIOS DE ÉXITO

### Visual
- [ ] Grid cyberpunk con cruces en intersecciones
- [ ] Fixtures apagados tienen identidad visual (rim color tenue)
- [ ] Fixtures encendidos brillan con Neon Total (aura + halo + core + rim)
- [ ] Beat pulse visible en el viewport border
- [ ] HUD tooltip con datos reales al hover
- [ ] 3D: Bloom en fixtures brillantes
- [ ] 3D: Floor grid reactivo al beat
- [ ] 3D: Materials con emissive neon
- [ ] Animated border flow (estilo Chronos)

### Arquitectura
- [ ] UN SOLO normalizador de zones (`ShowFileV2.normalizeZone()`)
- [ ] `CanonicalZone` type en TODOS los componentes
- [ ] GroupsPanel zone colors migrados a canonical
- [ ] StageSimulator2 split en 5 layers (< 200 líneas c/u)
- [ ] Fixture3D usa Quaternion SLERP (zero gimbal lock)
- [ ] layoutGenerator3D sin normalizer local
- [ ] ZoneLayoutEngine.ts como single source para posiciones

### Performance
- [ ] 60fps con 50 fixtures (2D)
- [ ] 60fps con 50 fixtures (3D)
- [ ] 45fps+ con 200 fixtures (3D instanced)
- [ ] Tooltip sin jank (requestAnimationFrame debounce)

### Compatibilidad
- [ ] TheCommander (controles) funciona sin cambios
- [ ] StageSidebar (3 tabs) funciona sin cambios
- [ ] Selection system (click, shift, ctrl) funciona sin cambios
- [ ] Hybrid rendering (stageStore + truthStore) preservado
- [ ] Imports existentes siguen funcionando (backward compat exports)

---

## 🧬 DEPENDENCIAS TÉCNICAS

### Paquetes Existentes (ya instalados)
- `three` — Motor 3D
- `@react-three/fiber` — React wrapper para Three.js
- `@react-three/drei` — Helpers (OrbitControls, etc.)

### Paquetes Nuevos Requeridos
- `@react-three/postprocessing` — Bloom, ChromaticAberration
  - Dependency: `postprocessing` (peer dep)

### Consideraciones de Performance (16GB RAM)
- Post-processing activado SOLO en modo 3D
- Bloom con `mipmapBlur` (más eficiente que standard blur)
- Instanced rendering para fixtures > 50
- Canvas 2D: `requestAnimationFrame` con frame skip si FPS < 30
- DPR cap: `Math.min(window.devicePixelRatio, 1.5)` — no gastar GPU en DPR 2+

---

## 🎬 CONCLUSIÓN

### El Antes y El Después

| Aspecto | Simulator (WAVE 436) | HYPERION (WAVE 2042) |
|---------|---------------------|---------------------|
| **Nombre** | "Simulator" (genérico) | **HYPERION** (identidad) |
| **Zonas** | 3 normalizadores divergentes | 1 normalizer canónico |
| **2D Render** | 1105 líneas monolito | 5 layers modulares (~200 c/u) |
| **3D Rotation** | Euler angles (gimbal lock) | Quaternion SLERP (perfecto) |
| **3D Materials** | meshStandard gris | Emissive neon + PBR |
| **3D Scale** | ~50 fixtures max | 500+ fixtures (instanced) |
| **Grid** | Líneas grises | Cyberpunk neon con cruces |
| **Fixtures OFF** | Círculo gris sin alma | Rim color + sleeping dot |
| **Hover** | Cursor pointer (sin info) | HUD Táctico flotante |
| **Beat Reaction** | Border flash simple | Viewport breathe + 3D floor pulse |
| **CSS** | Funcional WAVE 33 | Design System 2026 |
| **Timecoder** | No existe | Dock placeholder listo |
| **Groups** | Legacy zone colors (broken) | Canonical zone colors |

### Hyperion No Es Un Update

Hyperion es una **declaración de intenciones**. Cuando el cliente abra LuxSync y vea el Live View, tiene que sentir que está mirando el cockpit de una nave espacial diseñada para controlar luz.

No estamos competiendo con MA2 o GrandMA3. Estamos creando una categoría nueva: **el DAW de la luz**, y Hyperion es su pantalla principal.

---

**FIN DEL BLUEPRINT — PunkOpus OUT ☀️**

*"La luz no se simula. Se invoca. Y Hyperion es el ritual."*
