# 🔌 WAVE 1211: THE DMX NEXUS - BLUEPRINT DE REDISEÑO TOTAL

```
═══════════════════════════════════════════════════════════════════════════════
██████╗ ███╗   ███╗██╗  ██╗    ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
██╔══██╗████╗ ████║╚██╗██╔╝    ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██║  ██║██╔████╔██║ ╚███╔╝     ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║  ██║██║╚██╔╝██║ ██╔██╗     ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██████╔╝██║ ╚═╝ ██║██╔╝ ██╗    ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝    ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝
═══════════════════════════════════════════════════════════════════════════════
```

**DE:** PunkOpus (Frontend/UX Architect)  
**PARA:** Radwulf & El Arquitecto  
**FECHA:** 6 de Febrero de 2026  
**ESTADO:** BLUEPRINT PARA EVALUACIÓN  

---

## 📖 ÍNDICE

1. [Visión & Filosofía](#1--visión--filosofía)
2. [Diagnóstico del Sistema Actual](#2--diagnóstico-del-sistema-actual)
3. [Arquitectura Propuesta](#3--arquitectura-propuesta)
4. [Layout & Diseño Visual](#4--layout--diseño-visual)
5. [Componentes Principales](#5--componentes-principales)
6. [Sistema de Estilos CSS](#6--sistema-de-estilos-css)
7. [Lógica de Negocio](#7--lógica-de-negocio)
8. [Integración HAL](#8--integración-hal)
9. [Plan de Implementación](#9--plan-de-implementación)

---

## 1. 🎯 VISIÓN & FILOSOFÍA

### El Problema Fundamental

El patcheo DMX tradicional es una **tarea de lista**: abres una tabla, escribes números, rezas para no pisar canales. Es **administrativo**, **aburrido** y **propenso a errores**.

### La Transformación Radical

**THE DMX NEXUS** convierte el patcheo en una **operación táctica espacial**:

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│    ANTES: "Fixture 3 está en canal 45... creo"                       │
│                                                                      │
│    AHORA: *Click en el mapa* → *Flash físico* → "Confirmado,         │
│           es el de la izquierda" → *Assign canal 45*                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Mantra de Diseño

```
"SELECT VISUAL → CONFIRM PHYSICAL → ASSIGN DIGITAL"
```

**Tres pasos. Cero errores. Máxima confianza.**

---

## 2. 🔍 DIAGNÓSTICO DEL SISTEMA ACTUAL

### ✅ Lo Que Funciona

| Elemento | Estado | Notas |
|----------|--------|-------|
| Renderizado Canvas | ✅ OK | Funcional pero básico |
| Selección por click | ✅ OK | Single-select operativo |
| Detección colisiones | ✅ OK | Lógica correcta |
| Zoom básico | ✅ OK | Funcional |

### ❌ Lo Que Falta (Y Es Crítico)

| Carencia | Impacto | Prioridad |
|----------|---------|-----------|
| **Multi-selección** | No puedes parchear 8 focos en batch (1, 11, 21...) | 🔴 CRÍTICO |
| **Universe Bar** | No ves dónde hay "huecos" libres | 🔴 CRÍTICO |
| **Flash/Locate REAL** | Solo console.log, no HAL injection | 🔴 CRÍTICO |
| **Profile Swap** | No puedes cambiar de 10ch a 14ch mode | 🟡 ALTO |
| **Tooltips** | Sin feedback visual en hover | 🟡 ALTO |
| **Consistencia CSS** | Estilos inline, no usa Design System | 🟡 ALTO |
| **Drag & Drop** | No puedes mover fixtures en el mapa | 🟢 MEDIO |
| **Keyboard shortcuts** | Nada de teclas rápidas | 🟢 MEDIO |

### 💀 Deuda Técnica Detectada

```tsx
// PROBLEMA 1: Estilos inline mezclados con lógica
const s = {
  container: { display: 'flex', width: '100%', ... } // 👎 No reutilizable
}

// PROBLEMA 2: Magic numbers everywhere
const size = 10 * zoom;  // ¿Qué es 10? ¿De dónde sale?

// PROBLEMA 3: Mock de DMX
// sendDmxFrame({ [selectedFixture.address]: 255 }); // Comentado = inexistente
```

---

## 3. 🏗️ ARQUITECTURA PROPUESTA

### Estructura de Archivos

```
electron-app/src/components/views/VisualPatcher/
├── VisualPatcher.tsx           # Componente principal (orquestador)
├── VisualPatcher.css           # Estilos completos (nuevo)
├── components/
│   ├── StageMap/
│   │   ├── StageMap.tsx        # Canvas interactivo
│   │   ├── StageMap.css
│   │   ├── FixtureRenderer.ts  # Lógica de renderizado por tipo
│   │   └── HitDetection.ts     # Algoritmos de click/hover
│   ├── InspectorPanel/
│   │   ├── InspectorPanel.tsx  # Panel derecho completo
│   │   ├── InspectorPanel.css
│   │   ├── IdentityCard.tsx    # Nombre, icono, ID
│   │   ├── DMXMatrixInput.tsx  # Universe + Address + Profile
│   │   └── ActionButtons.tsx   # Flash, Test, Clear
│   └── UniverseBar/
│       ├── UniverseBar.tsx     # Barra de ocupación 512ch
│       └── UniverseBar.css
├── hooks/
│   ├── useSelectionManager.ts  # Multi-select, shift-click, ctrl-click
│   ├── useCollisionEngine.ts   # Detección de colisiones en tiempo real
│   ├── useDMXInjector.ts       # Flash/Locate via HAL
│   └── useCanvasInteraction.ts # Pan, zoom, drag
└── constants/
    ├── fixtureShapes.ts        # Definiciones de formas por tipo
    └── patcherConfig.ts        # Tamaños, colores, thresholds
```

### Flujo de Datos

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ StageStore  │───▶│ VisualPatcher│───▶│  StageMap   │
│ (fixtures)  │    │ (orquestador)│    │  (canvas)   │
└─────────────┘    └──────┬──────┘    └─────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌───────────────┐ ┌─────────────┐ ┌───────────────┐
│ InspectorPanel│ │ UniverseBar │ │ HAL/DMXOutput │
│ (edición)     │ │ (visual)    │ │ (flash real)  │
└───────────────┘ └─────────────┘ └───────────────┘
```

---

## 4. 📐 LAYOUT & DISEÑO VISUAL

### Wireframe ASCII Definitivo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔌 THE DMX NEXUS                              [Show: UNTITLED*] [💾 SAVE]   │
├───────────────────────────────────────────┬─────────────────────────────────┤
│                                           │                                 │
│           S T A G E   M A P               │       I N S P E C T O R         │
│              (70% width)                  │         (30% width)             │
│                                           │                                 │
│   ┌─────────────────────────────────┐     │  ┌───────────────────────────┐  │
│   │        [ BACK TRUSS ]           │     │  │  ▼ SELECTED UNIT          │  │
│   │     △   △   △   △   △   △       │     │  │  ━━━━━━━━━━━━━━━━━━━━━━   │  │
│   │    12  24  36  48  60  72       │     │  │  🔦 Beam 7R #3            │  │
│   │                                 │     │  │  ID: fix_b3_left          │  │
│   │        [ MID TRUSS ]            │     │  │  Type: moving-head        │  │
│   │     ◉   ◉   ◉   ◉               │     │  │  Zone: Back Left          │  │
│   │    84  96 108 120               │     │  └───────────────────────────┘  │
│   │                                 │     │                                 │
│   │        [ FRONT TRUSS ]          │     │  ┌───────────────────────────┐  │
│   │     ●   ●   ●   ●   ●           │     │  │  ▼ DMX ADDRESSING         │  │
│   │        🟢                       │     │  │  ━━━━━━━━━━━━━━━━━━━━━━   │  │
│   │       /│\  ← SELECTED           │     │  │                           │  │
│   │                                 │     │  │  UNIVERSE    ADDRESS      │  │
│   │   [ FLOOR / FX ]                │     │  │  ┌─────┐    ┌───────┐     │  │
│   │     ◇   ◇   ◇   ◇               │     │  │  │  1  │    │  033  │     │  │
│   │    132 144 156 168              │     │  │  └─────┘    └───────┘     │  │
│   └─────────────────────────────────┘     │  │                           │  │
│                                           │  │  PROFILE                  │  │
│   ┌─ LEGEND ──────────────────────────┐   │  │  ┌─────────────────────┐  │  │
│   │ ○ Unpatched  ● Patched            │   │  │  │ 14ch Extended Mode ▼│  │  │
│   │ 🔴 Collision 🟢 Selected          │   │  │  └─────────────────────┘  │  │
│   │ △ Moving Head ◉ Wash ◇ Strobe     │   │  │                           │  │
│   └───────────────────────────────────┘   │  │  ⚠️ COLLISION DETECTED   │  │
│                                           │  │  Overlaps with Spot #4    │  │
│   [−] [+] ZOOM: 120%        [⟲] RESET     │  │  Channels 35-45           │  │
│                                           │  └───────────────────────────┘  │
│                                           │                                 │
│                                           │  ┌───────────────────────────┐  │
│                                           │  │  ▼ ACTIONS                │  │
│                                           │  │  ━━━━━━━━━━━━━━━━━━━━━━   │  │
│                                           │  │                           │  │
│                                           │  │  ┌─────────────────────┐  │  │
│                                           │  │  │  ⚡ LOCATE / FLASH  │  │  │
│                                           │  │  │   (Hold to Strobe)  │  │  │
│                                           │  │  └─────────────────────┘  │  │
│                                           │  │                           │  │
│                                           │  │  [🧪 TEST ALL CH] [🗑️]   │  │
│                                           │  └───────────────────────────┘  │
├───────────────────────────────────────────┴─────────────────────────────────┤
│  ▼ UNIVERSE 1 ALLOCATION                                          [1▼][2][3]│
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  [████████░░░░░░████████████░░░░░░░░░░░████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░] │
│   1    32    64    96   128   160   192   224   256   288   320...     512  │
│   ▲         ▲                ▲                                              │
│  Beam     Wash            Strobe          [ FREE: 387 channels ]            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Proporciones Exactas

| Zona | Porcentaje | Min Width | Max Width |
|------|------------|-----------|-----------|
| Stage Map | 70% | 600px | ∞ |
| Inspector | 30% | 320px | 400px |
| Universe Bar | 100% | - | 80px height |
| Toolbar | 100% | - | 52px height |

---

## 5. 🧩 COMPONENTES PRINCIPALES

### A. STAGE MAP (Canvas Interactivo)

#### Especificación Visual

```tsx
interface StageMapConfig {
  // Grid
  gridSize: 50,           // Pixels entre líneas (a zoom 1.0)
  gridColor: 'rgba(34, 211, 238, 0.05)',  // Cyan muy sutil
  gridColorMajor: 'rgba(34, 211, 238, 0.1)',  // Cada 4 líneas
  
  // Fixtures
  fixtureBaseSize: 12,    // Tamaño base en pixels
  
  // Selection
  selectionGlow: 'rgba(34, 211, 238, 0.6)',
  selectionGlowRadius: 20,
  
  // Collision
  collisionColor: '#ef4444',
  collisionPulseSpeed: 800,  // ms para un ciclo completo
}
```

#### Formas por Tipo de Fixture

```tsx
const FIXTURE_SHAPES: Record<FixtureType, ShapeDefinition> = {
  'moving-head': {
    shape: 'triangle',
    icon: '△',
    rotatable: true,   // Indica orientación pan/tilt
  },
  'wash': {
    shape: 'circle',
    icon: '◉',
    filled: true,
  },
  'par': {
    shape: 'circle',
    icon: '○',
    filled: false,
  },
  'spot': {
    shape: 'hexagon',
    icon: '⬡',
    filled: true,
  },
  'strobe': {
    shape: 'diamond',
    icon: '◇',
    filled: false,
    pulsing: true,   // Efecto visual de "strobe"
  },
  'laser': {
    shape: 'rectangle-thin',
    icon: '═',
    aspectRatio: 4,
  },
  'blinder': {
    shape: 'square',
    icon: '■',
    filled: true,
  },
  'bar': {
    shape: 'rectangle',
    icon: '▬',
    aspectRatio: 3,
  },
  'generic': {
    shape: 'circle',
    icon: '●',
    filled: true,
  }
}
```

#### Estados Visuales

| Estado | Border | Fill | Glow | Animación |
|--------|--------|------|------|-----------|
| **Unpatched** | `#475569` | `transparent` | none | none |
| **Patched OK** | `#22d3ee` | `rgba(34, 211, 238, 0.2)` | subtle cyan | none |
| **Selected** | `#22d3ee` | `rgba(34, 211, 238, 0.4)` | strong cyan (20px) | none |
| **Collision** | `#ef4444` | `rgba(239, 68, 68, 0.3)` | red pulse | pulse 0.8s |
| **Flashing** | `#f59e0b` | `#fbbf24` | orange intense | strobe 100ms |
| **Hover** | `#94a3b8` | current + 10% opacity | subtle | scale 1.05 |

#### Interacciones

```tsx
interface MapInteractions {
  // Selection
  click: 'select-single',
  ctrlClick: 'toggle-selection',      // Multi-select
  shiftClick: 'select-range',         // Selecciona todos entre A y B
  
  // Navigation
  scroll: 'zoom',
  middleMouseDrag: 'pan',
  rightClickDrag: 'pan',
  
  // Editing
  doubleClic: 'open-quick-patch',     // Mini-modal de edición rápida
  
  // Feedback
  hover: 'show-tooltip',
  hoverDelay: 300,  // ms antes de mostrar tooltip
}
```

---

### B. INSPECTOR PANEL

#### Secciones

```tsx
interface InspectorSections {
  identity: {
    name: string,
    id: string,
    type: FixtureType,
    zone: string,
    icon: ReactNode,
  },
  
  addressing: {
    universe: 1 | 2 | 3 | 4,
    address: number,  // 1-512
    profile: ChannelMode,
    channelCount: number,  // Calculado del profile
    range: [number, number],  // [start, end]
  },
  
  collision: {
    hasCollision: boolean,
    conflictsWith: Fixture[],
    overlapRange: [number, number],
  },
  
  actions: {
    flash: () => void,
    testAllChannels: () => void,
    clearPatch: () => void,
  }
}
```

#### Multi-Selection Mode

Cuando hay **múltiples fixtures seleccionadas**, el Inspector cambia:

```
┌───────────────────────────────────┐
│  ▼ MULTI-SELECT MODE              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                   │
│  🎯 4 FIXTURES SELECTED           │
│                                   │
│  Types: 3x Moving Head, 1x Wash   │
│                                   │
│  ┌─────────────────────────────┐  │
│  │  BATCH ADDRESSING           │  │
│  │                             │  │
│  │  Start: [001]  Step: [010]  │  │
│  │                             │  │
│  │  Preview:                   │  │
│  │  #1 → Ch 001                │  │
│  │  #2 → Ch 011                │  │
│  │  #3 → Ch 021                │  │
│  │  #4 → Ch 031                │  │
│  │                             │  │
│  │  [✓ APPLY TO ALL]           │  │
│  └─────────────────────────────┘  │
│                                   │
│  ┌───────────────────────────┐    │
│  │  ⚡ FLASH ALL SELECTED    │    │
│  │     (Sequential Strobe)   │    │
│  └───────────────────────────┘    │
└───────────────────────────────────┘
```

---

### C. UNIVERSE BAR

#### Especificación

```tsx
interface UniverseBarProps {
  universe: 1 | 2 | 3 | 4,
  totalChannels: 512,
  fixtures: Fixture[],
  selectedFixture: Fixture | null,
}

interface ChannelBlock {
  start: number,
  end: number,
  fixture: Fixture,
  state: 'normal' | 'selected' | 'collision',
}
```

#### Visualización

```
Channel 1                                                    Channel 512
    ▼                                                              ▼
    [███████████░░░░░░░████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░]
    |← Beam →|         |← Wash Bank →|
    
    Colors:
    ███ = Occupied (var(--accent-secondary) at 50%)
    ░░░ = Free (var(--bg-elevated))
    ███ = Selected fixture (var(--accent-secondary) at 100% + glow)
    ███ = Collision (var(--accent-danger) pulsing)
```

#### Interacciones

- **Hover sobre bloque**: Tooltip con nombre de fixture y rango
- **Click en bloque**: Selecciona esa fixture en el mapa
- **Click en espacio vacío**: Muestra "Free: Ch X to Y"

---

### D. ⚡ THE LOCATE BUTTON (Killer Feature)

#### Comportamiento Detallado

```tsx
interface LocateButtonBehavior {
  // Trigger
  trigger: 'mousedown',
  release: 'mouseup | mouseleave',
  
  // DMX Injection
  dmxValues: {
    dimmer: 255,
    shutter: 'open',  // O strobe lento si available
    color: {
      r: 255, g: 0, b: 255,  // MAGENTA para destacar
    },
    pan: 'center',   // Si es moving head
    tilt: 'center',
  },
  
  // Priority
  priority: 'OVERRIDE',  // Bypass total del motor de efectos
  
  // Feedback
  buttonState: {
    idle: 'Pulsing subtle animation',
    active: 'Full brightness, scale 0.98',
  },
  
  // Safety
  autoRelease: 5000,  // Max 5 segundos de flash
}
```

#### Integración HAL

```tsx
// Hook: useDMXInjector.ts
interface DMXInjector {
  // Inyecta valores de alta prioridad que sobrescriben el show
  injectFlash: (fixture: Fixture, values: DMXFrame) => void,
  
  // Libera el control, vuelve al show normal
  releaseFlash: (fixture: Fixture) => void,
  
  // Estado
  isFlashing: boolean,
  flashingFixtureId: string | null,
}
```

---

## 6. 🎨 SISTEMA DE ESTILOS CSS

### Variables Heredadas de `globals.css`

```css
/* ═══════════════════════════════════════════════════════════════════════════
   VISUAL PATCHER - CSS CUSTOM PROPERTIES
   Extiende el Design System de LuxSync
   ═══════════════════════════════════════════════════════════════════════════ */

.visual-patcher {
  /* Backgrounds - Heredados */
  --patcher-bg: var(--bg-deepest);           /* #0a0a0f */
  --patcher-surface: var(--bg-surface);       /* #1a1a24 */
  --patcher-elevated: var(--bg-elevated);     /* #222230 */
  
  /* Accent - El CYAN como protagonista */
  --patcher-accent: var(--accent-secondary);  /* #00E5FF - Cyan */
  --patcher-accent-dim: rgba(0, 229, 255, 0.3);
  --patcher-accent-glow: var(--glow-cyan);
  
  /* States */
  --patcher-success: var(--accent-success);   /* #4ADE80 */
  --patcher-warning: var(--accent-warning);   /* #FBBF24 */
  --patcher-danger: var(--accent-danger);     /* #FF4444 */
  
  /* Grid Canvas */
  --patcher-grid-line: rgba(34, 211, 238, 0.04);
  --patcher-grid-line-major: rgba(34, 211, 238, 0.08);
  
  /* Fixtures */
  --patcher-fixture-unpatched: #475569;
  --patcher-fixture-patched: var(--patcher-accent);
  --patcher-fixture-selected-fill: rgba(34, 211, 238, 0.25);
  --patcher-fixture-collision: var(--patcher-danger);
  
  /* Typography */
  --patcher-font-display: var(--font-display);  /* Orbitron */
  --patcher-font-mono: var(--font-mono);        /* JetBrains Mono */
}
```

### Estructura CSS del Componente

```css
/* ═══════════════════════════════════════════════════════════════════════════
   VISUAL PATCHER - MAIN STYLES
   WAVE 1211: THE DMX NEXUS
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────────────────────
   LAYOUT PRINCIPAL
   ───────────────────────────────────────────────────────────────────────────── */

.visual-patcher {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--patcher-bg);
  overflow: hidden;
  font-family: var(--patcher-font-mono);
}

.visual-patcher__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  min-height: 52px;
  padding: 0 var(--space-md);
  background: linear-gradient(180deg, #12121a 0%, #0d0d12 100%);
  border-bottom: 1px solid rgba(34, 211, 238, 0.15);
}

.visual-patcher__content {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: var(--space-md);
  padding: var(--space-md);
}

/* ─────────────────────────────────────────────────────────────────────────────
   STAGE MAP
   ───────────────────────────────────────────────────────────────────────────── */

.visual-patcher__map {
  flex: 7;
  min-width: 600px;
  position: relative;
  background: radial-gradient(
    circle at 50% 50%,
    rgba(26, 26, 46, 1) 0%,
    rgba(10, 10, 15, 1) 100%
  );
  border-radius: var(--radius-lg);
  border: 1px solid rgba(34, 211, 238, 0.1);
  overflow: hidden;
}

.visual-patcher__canvas {
  width: 100%;
  height: 100%;
  cursor: crosshair;
}

/* ─────────────────────────────────────────────────────────────────────────────
   INSPECTOR PANEL
   ───────────────────────────────────────────────────────────────────────────── */

.visual-patcher__inspector {
  flex: 3;
  min-width: 320px;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  background: rgba(18, 18, 26, 0.8);
  backdrop-filter: blur(12px);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(34, 211, 238, 0.15);
  padding: var(--space-md);
}

/* ─────────────────────────────────────────────────────────────────────────────
   UNIVERSE BAR
   ───────────────────────────────────────────────────────────────────────────── */

.visual-patcher__universe-bar {
  height: 80px;
  min-height: 80px;
  background: var(--patcher-surface);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(34, 211, 238, 0.1);
  margin: 0 var(--space-md) var(--space-md);
  padding: var(--space-sm) var(--space-md);
}

/* ─────────────────────────────────────────────────────────────────────────────
   CARDS & SECTIONS
   ───────────────────────────────────────────────────────────────────────────── */

.patcher-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.patcher-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid rgba(34, 211, 238, 0.1);
}

.patcher-card__title {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--patcher-accent);
}

/* ─────────────────────────────────────────────────────────────────────────────
   INPUTS
   ───────────────────────────────────────────────────────────────────────────── */

.patcher-input {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(71, 85, 105, 0.5);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  color: var(--text-primary);
  font-family: var(--patcher-font-mono);
  font-size: 18px;
  font-weight: 600;
  text-align: center;
  transition: all var(--transition-fast);
}

.patcher-input:focus {
  outline: none;
  border-color: var(--patcher-accent);
  box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.2);
}

.patcher-input--collision {
  border-color: var(--patcher-danger);
  animation: collision-pulse 0.8s ease-in-out infinite;
}

/* ─────────────────────────────────────────────────────────────────────────────
   BUTTONS
   ───────────────────────────────────────────────────────────────────────────── */

.patcher-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-lg);
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--patcher-font-mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.patcher-btn--flash {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #000;
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.3);
}

.patcher-btn--flash:hover {
  transform: translateY(-1px);
  box-shadow: 0 0 30px rgba(245, 158, 11, 0.5);
}

.patcher-btn--flash:active,
.patcher-btn--flash.is-flashing {
  transform: scale(0.98);
  filter: brightness(1.3);
  box-shadow: 0 0 40px rgba(245, 158, 11, 0.8);
}

/* ─────────────────────────────────────────────────────────────────────────────
   COLLISION WARNING
   ───────────────────────────────────────────────────────────────────────────── */

.patcher-collision-alert {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: var(--radius-sm);
  color: #fca5a5;
  font-size: 11px;
  animation: collision-pulse 0.8s ease-in-out infinite;
}

@keyframes collision-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* ─────────────────────────────────────────────────────────────────────────────
   LEGEND
   ───────────────────────────────────────────────────────────────────────────── */

.patcher-legend {
  position: absolute;
  bottom: var(--space-md);
  left: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  background: rgba(10, 10, 15, 0.9);
  backdrop-filter: blur(8px);
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 10px;
  color: var(--text-secondary);
}

.patcher-legend__item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

/* ─────────────────────────────────────────────────────────────────────────────
   ZOOM CONTROLS
   ───────────────────────────────────────────────────────────────────────────── */

.patcher-zoom-controls {
  position: absolute;
  bottom: var(--space-md);
  right: var(--space-md);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs);
  background: rgba(10, 10, 15, 0.9);
  backdrop-filter: blur(8px);
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.patcher-zoom-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.patcher-zoom-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--patcher-accent);
}

.patcher-zoom-label {
  padding: 0 var(--space-sm);
  font-size: 11px;
  font-weight: 600;
  color: var(--patcher-accent);
  min-width: 50px;
  text-align: center;
}

/* ─────────────────────────────────────────────────────────────────────────────
   RESPONSIVE
   ───────────────────────────────────────────────────────────────────────────── */

@media (max-width: 1200px) {
  .visual-patcher__content {
    flex-direction: column;
  }
  
  .visual-patcher__map {
    min-width: 0;
    flex: 1;
  }
  
  .visual-patcher__inspector {
    max-width: none;
    min-width: 0;
    flex-direction: row;
    flex-wrap: wrap;
    max-height: 200px;
    overflow-y: auto;
  }
}
```

---

## 7. 🧠 LÓGICA DE NEGOCIO

### A. Collision Engine

```tsx
// hooks/useCollisionEngine.ts

interface CollisionResult {
  hasCollision: boolean;
  conflicts: ConflictInfo[];
}

interface ConflictInfo {
  fixtureA: Fixture;
  fixtureB: Fixture;
  overlapStart: number;
  overlapEnd: number;
  universe: number;
}

/**
 * Motor de detección de colisiones DMX
 * Ejecuta en tiempo real cada vez que cambia un address
 */
export function useCollisionEngine(fixtures: Fixture[]): CollisionResult {
  return useMemo(() => {
    const conflicts: ConflictInfo[] = [];
    
    // Agrupar por universo
    const byUniverse = groupBy(fixtures, f => f.universe || 1);
    
    Object.entries(byUniverse).forEach(([uni, uniFixtures]) => {
      // Comparar todos contra todos (O(n²), optimizable con interval tree)
      for (let i = 0; i < uniFixtures.length; i++) {
        for (let j = i + 1; j < uniFixtures.length; j++) {
          const a = uniFixtures[i];
          const b = uniFixtures[j];
          
          const aStart = a.address;
          const aEnd = a.address + getChannelCount(a) - 1;
          const bStart = b.address;
          const bEnd = b.address + getChannelCount(b) - 1;
          
          // Detectar overlap
          if (aStart <= bEnd && aEnd >= bStart) {
            conflicts.push({
              fixtureA: a,
              fixtureB: b,
              overlapStart: Math.max(aStart, bStart),
              overlapEnd: Math.min(aEnd, bEnd),
              universe: parseInt(uni),
            });
          }
        }
      }
    });
    
    return {
      hasCollision: conflicts.length > 0,
      conflicts,
    };
  }, [fixtures]);
}
```

### B. Selection Manager

```tsx
// hooks/useSelectionManager.ts

interface SelectionState {
  selectedIds: Set<string>;
  lastSelectedId: string | null;
}

interface SelectionActions {
  selectSingle: (id: string) => void;
  toggleSelection: (id: string) => void;  // Ctrl+Click
  selectRange: (id: string) => void;       // Shift+Click
  selectAll: () => void;
  clearSelection: () => void;
}

export function useSelectionManager(fixtures: Fixture[]): [SelectionState, SelectionActions] {
  const [state, setState] = useState<SelectionState>({
    selectedIds: new Set(),
    lastSelectedId: null,
  });
  
  const actions: SelectionActions = {
    selectSingle: (id) => {
      setState({
        selectedIds: new Set([id]),
        lastSelectedId: id,
      });
    },
    
    toggleSelection: (id) => {
      setState(prev => {
        const newSet = new Set(prev.selectedIds);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return {
          selectedIds: newSet,
          lastSelectedId: id,
        };
      });
    },
    
    selectRange: (id) => {
      // Selecciona todas las fixtures entre lastSelectedId y id
      // Basado en posición en el mapa o índice en array
      setState(prev => {
        if (!prev.lastSelectedId) {
          return { selectedIds: new Set([id]), lastSelectedId: id };
        }
        
        const startIdx = fixtures.findIndex(f => f.id === prev.lastSelectedId);
        const endIdx = fixtures.findIndex(f => f.id === id);
        const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        
        const rangeIds = fixtures.slice(from, to + 1).map(f => f.id);
        return {
          selectedIds: new Set([...prev.selectedIds, ...rangeIds]),
          lastSelectedId: id,
        };
      });
    },
    
    selectAll: () => {
      setState({
        selectedIds: new Set(fixtures.map(f => f.id)),
        lastSelectedId: null,
      });
    },
    
    clearSelection: () => {
      setState({
        selectedIds: new Set(),
        lastSelectedId: null,
      });
    },
  };
  
  return [state, actions];
}
```

### C. Batch Addressing

```tsx
// utils/batchAddressing.ts

interface BatchAddressConfig {
  startAddress: number;
  step: number;  // Incremento entre fixtures
  universe: number;
}

/**
 * Genera addresses secuenciales para un grupo de fixtures
 * Ejemplo: start=1, step=10 → [1, 11, 21, 31...]
 */
export function generateBatchAddresses(
  fixtureIds: string[],
  config: BatchAddressConfig,
  fixtures: Fixture[]
): Map<string, Partial<Fixture>> {
  const updates = new Map<string, Partial<Fixture>>();
  
  fixtureIds.forEach((id, index) => {
    const address = config.startAddress + (index * config.step);
    
    // Validar rango 1-512
    if (address >= 1 && address <= 512) {
      updates.set(id, {
        address,
        universe: config.universe,
      });
    }
  });
  
  return updates;
}
```

---

## 8. 🔧 INTEGRACIÓN HAL

### Flash Injection Protocol

```tsx
// hooks/useDMXInjector.ts

interface DMXInjectorConfig {
  // Valores de flash por defecto
  defaultFlashValues: {
    dimmer: 255,
    shutter: 255,  // Open
    colorR: 255,
    colorG: 0,
    colorB: 255,   // Magenta
  },
  
  // Safety
  maxFlashDuration: 5000,  // ms
  
  // Channel mapping (genérico, puede variar por profile)
  channelMap: {
    dimmer: 0,    // Offset desde address base
    shutter: 1,
    colorR: 2,
    colorG: 3,
    colorB: 4,
  },
}

export function useDMXInjector() {
  const { injectHighPriorityFrame, clearHighPriorityFrame } = useHAL();
  const [isFlashing, setIsFlashing] = useState(false);
  const flashTimeoutRef = useRef<NodeJS.Timeout>();
  
  const flash = useCallback((fixture: Fixture) => {
    // Construir frame DMX
    const frame: DMXFrame = {};
    const baseAddr = fixture.address;
    
    // Mapear valores según el profile de la fixture
    const profile = fixture.channelMode;
    if (profile?.dimmerChannel !== undefined) {
      frame[baseAddr + profile.dimmerChannel] = 255;
    }
    if (profile?.shutterChannel !== undefined) {
      frame[baseAddr + profile.shutterChannel] = 255;
    }
    // ... más canales según profile
    
    // Inyectar con alta prioridad
    injectHighPriorityFrame(frame);
    setIsFlashing(true);
    
    // Safety timeout
    flashTimeoutRef.current = setTimeout(() => {
      release(fixture);
    }, 5000);
  }, []);
  
  const release = useCallback((fixture: Fixture) => {
    clearHighPriorityFrame();
    setIsFlashing(false);
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
    }
  }, []);
  
  return { flash, release, isFlashing };
}
```

---

## 9. 📋 PLAN DE IMPLEMENTACIÓN

### Fases

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: FOUNDATION (2-3 días)                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ □ Migrar estilos inline a VisualPatcher.css                                 │
│ □ Implementar estructura de archivos propuesta                              │
│ □ Crear hooks: useCollisionEngine, useSelectionManager                      │
│ □ Refactorizar Canvas con FixtureRenderer.ts                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: CORE FEATURES (3-4 días)                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ □ Multi-selección (Ctrl+Click, Shift+Click)                                 │
│ □ Inspector Panel completo con DMXMatrixInput                               │
│ □ Collision warnings visuales                                               │
│ □ Profile selector dropdown                                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: UNIVERSE BAR (1-2 días)                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ □ Implementar UniverseBar.tsx                                               │
│ □ Visualización de ocupación de canales                                     │
│ □ Click-to-select desde la barra                                            │
│ □ Multi-universe tabs                                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: HAL INTEGRATION (2-3 días)                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ □ Crear useDMXInjector.ts                                                   │
│ □ Implementar Flash/Locate REAL via HAL                                     │
│ □ Test con hardware físico                                                  │
│ □ Safety timeouts y error handling                                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: POLISH (1-2 días)                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ □ Tooltips y hover effects                                                  │
│ □ Keyboard shortcuts (Ctrl+A, Delete, Arrow keys)                           │
│ □ Batch addressing UI                                                       │
│ □ Responsive adaptations                                                    │
│ □ Performance optimization (requestAnimationFrame, debounce)                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Timeline Estimado

| Fase | Días | Prioridad |
|------|------|-----------|
| Phase 1: Foundation | 2-3 | 🔴 CRÍTICO |
| Phase 2: Core Features | 3-4 | 🔴 CRÍTICO |
| Phase 3: Universe Bar | 1-2 | 🟡 ALTO |
| Phase 4: HAL Integration | 2-3 | 🔴 CRÍTICO |
| Phase 5: Polish | 1-2 | 🟢 MEDIO |
| **TOTAL** | **9-14 días** | - |

---

## 🔥 CONCLUSIÓN

El Visual Patcher actual es **funcional pero primitivo**. Esta transformación lo convierte en **THE DMX NEXUS**: una herramienta de parcheo visual, táctica y con feedback físico real.

**Lo que ganamos:**
- ✅ Multi-selección para batch operations
- ✅ Universe Bar para visualizar espacio libre
- ✅ Flash REAL via HAL (no más console.log)
- ✅ Consistencia visual con el Design System LuxSync
- ✅ Colisiones detectadas en tiempo real con feedback visual
- ✅ Profiles swappables

**El mantra final:**

```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   "SELECT VISUAL → CONFIRM PHYSICAL → ASSIGN DIGITAL"        ║
║                                                               ║
║   Tres pasos. Cero errores. Máxima confianza.                 ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

---

**Firmado:** PunkOpus 🎸  
**Wave:** 1211  
**Status:** BLUEPRINT READY FOR ARCHITECT REVIEW

---

*"El código debe ser limpio, elegante, eficiente y sostenible."* — Axioma Perfection First
