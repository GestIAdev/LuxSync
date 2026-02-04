# 🔧 BLUEPRINT: CALIBRATION LAB - WAVE 1135
## "El Taller del Francotirador" 2.0

**Status:** 📋 PENDING APPROVAL  
**Author:** PunkOpus  
**Date:** 2026-02-03  
**Priority:** HIGH  

---

## 📊 AUDITORÍA DEL ESTADO ACTUAL

### 🗂️ Estructura de Archivos

```
CalibrationView/
├── index.tsx           (251 líneas - Vista principal)
├── CalibrationView.css (207 líneas - Estilos)
└── components/
    ├── index.ts        (Exports)
    ├── FixtureList.tsx (89 líneas - Lista de fixtures)
    ├── FixtureList.css
    ├── RadarXY.tsx     (210 líneas - Control Pan/Tilt)
    ├── RadarXY.css
    ├── TestPanel.tsx   (360 líneas - Panel de pruebas DMX)
    ├── TestPanel.css
    ├── OffsetPanel.tsx (182 líneas - Ajustes de offset)
    └── OffsetPanel.css
```

---

## 🐛 BUGS Y PROBLEMAS IDENTIFICADOS

### 1. 🔴 FIXTURE LIST NO MUESTRA FIXTURES

**Síntoma:** La lista está vacía cuando hay fixtures en el show.

**Causa:** 
```tsx
// CalibrationView/index.tsx línea 48-54
const fixtures = useMemo(() => {
  return hardware?.fixtures || []  // ← Lee de truthStore.hardware
}, [hardware?.fixtures])

const calibratableFixtures = useMemo(() => {
  return fixtures.filter((f) => {
    const type = (f.type || '').toLowerCase()
    return type.includes('moving') || type.includes('spot')...
  })
}, [fixtures])
```

**Problema:** `hardware?.fixtures` viene del **truthStore** (SeleneTruth runtime), pero las fixtures **REALES** están en **stageStore** (FixtureV2[] del show file).

**Solución:** Usar `useStageStore(state => state.fixtures)` en lugar de `hardware?.fixtures`.

---

### 2. 🟡 RADAR vs PAD - Switch Inconsistente

**Síntoma:** Sin arrancar muestra PadXY, al arrancar muestra RadarXY.

**Análisis:**
- **XYPad** (Sniper Mode): Para 1 fixture seleccionado
- **RadarXY** (Formation Mode): Para 2+ fixtures

**Problema:** CalibrationView usa su **propio RadarXY** (componente local), no el sistema inteligente de `PositionSection.tsx` que hace el switch automático.

**Causa Real:** El estado inicial de selección puede estar vacío al arrancar, mostrando comportamiento inconsistente.

---

### 3. 🟡 ICONOS GENÉRICOS

**Ubicación:** `FixtureList.tsx` líneas 31-38

```tsx
const getFixtureIcon = (type?: string): string => {
  const t = (type || '').toLowerCase()
  if (t.includes('spot')) return '🔦'  // ❌ Emoji genérico
  if (t.includes('beam')) return '⚡'  // ❌ Emoji genérico
  if (t.includes('wash')) return '🌊'  // ❌ Emoji genérico
  if (t.includes('moving')) return '🎯'
  return '💡'
}
```

**Solución:** Usar iconos custom de `LuxIcons.tsx` o crear nuevos.

---

### 4. 🟡 LAYOUT DESPERDIGADO

**Estado Actual:**
```
┌─────────────────────────────────────────────────────────────┐
│ HEADER (título genérico con emoji)                          │
├────────────┬─────────────────────────────┬──────────────────┤
│            │                             │                  │
│ Fixture    │       RADAR XY              │   Test Panel     │
│ List       │   (mucho espacio vacío)     │   (comprimido)   │
│            │                             │                  │
│ ────────── │                             │                  │
│ Offset     │                             │                  │
│ Panel      │   [Toggle Button]           │                  │
│            │                             │                  │
└────────────┴─────────────────────────────┴──────────────────┘
```

**Problemas:**
- Mucho espacio vacío en el centro
- Test Panel comprimido a la derecha
- Sin cohesión visual entre paneles
- No hay jerarquía visual clara

---

## 🎨 PROPUESTA DE REDISEÑO: "CALIBRATION LAB"

### Filosofía de Diseño

> **"El laboratorio del cirujano de luz"**  
> Un espacio clínico pero cálido, donde cada herramienta tiene su lugar exacto.
> Cyberpunk industrial como Forge y StageConstructor, pero con acento CYAN (calibración) en lugar de ORANGE (forja).

---

### 🏗️ NUEVO LAYOUT: DUAL-ZONE ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ═══ CALIBRATION LAB ═══  [fixture: EL-1140 #1]  ▣ DMX: 001  ⟳ ARMED        │
├──────────────────────────────────────────┬──────────────────────────────────┤
│                                          │                                  │
│   ┌────────────────────────────────┐     │   ┌─ FIXTURE RACK ─────────────┐ │
│   │                                │     │   │ ⬤ EL-1140 #1      CH 001   │ │
│   │                                │     │   │ ○ EL-1140 #2      CH 021   │ │
│   │       🎯 TARGETING RADAR       │     │   │ ○ Par LED #1      CH 041   │ │
│   │                                │     │   │ ○ Par LED #2      CH 051   │ │
│   │         (Pan/Tilt XY)          │     │   └─────────────────────────────┘ │
│   │                                │     │                                  │
│   │                                │     │   ┌─ DMX SCANNER ──────────────┐ │
│   └────────────────────────────────┘     │   │ CH: [▼ 01: Pan       ][===]│ │
│                                          │   │ VAL: [127]    ████████░░░░ │ │
│   ┌─ QUICK POSITION ────────────────┐    │   │                            │ │
│   │ [⬆] [↗] [→] [↘] [⬇] [↙] [←] [↖] │    │   │ PRESETS:                   │ │
│   │         [⊙ CENTER]              │    │   │ [Dimmer] [Strobe] [Gobo]   │ │
│   └─────────────────────────────────┘    │   │ [Color]  [Speed]  [Prism]  │ │
│                                          │   └────────────────────────────┘ │
│   ┌─ POSITION DATA ─────────────────┐    │                                  │
│   │ PAN:  270° / 540° max  [▓▓▓░░]  │    │   ┌─ OFFSET CONFIG ────────────┐ │
│   │ TILT: 135° / 270° max  [▓▓▓▓░]  │    │   │ Pan Offset:  [-180° ─ +180°]│
│   │ Speed: FAST ███░░░░░░ SLOW      │    │   │ Tilt Offset: [-90° ─ +90°] │ │
│   └─────────────────────────────────┘    │   │ [✓ Pan Invert] [✓ Tilt Inv]│ │
│                                          │   │ [RESET] [SAVE TO FIXTURE]  │ │
├──────────────────────────────────────────┴──────────────────────────────────┤
│ [🔲 BLACKOUT] [⚡ STROBE TEST] [🎨 COLOR TEST] [⚙️ GOBO TEST] [⏹ EXIT CAL] │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 🎯 ZONAS FUNCIONALES

#### ZONE A: TARGETING BAY (Izquierda - 60%)

**Propósito:** Control de posición visual e intuitivo.

**Componentes:**

1. **TARGETING RADAR** (Centro)
   - Versión mejorada de RadarXY
   - Grid concéntrico con ángulos marcados (0°, 90°, 180°, 270°)
   - Crosshair animado con trail de movimiento
   - Click & drag para posicionar
   - Double-click para centrar
   - Scroll para zoom (precisión)

2. **QUICK POSITION** (Debajo del radar)
   - 8 botones direccionales + CENTER
   - Iconos custom SVG (flechas estilizadas)
   - Hotkeys: WASD + QEZC para diagonales
   - Movimiento por pasos configurables (1°, 5°, 15°, 45°)

3. **POSITION DATA** (Panel inferior)
   - Barras de progreso visuales (no solo números)
   - Pan: 0-540° con indicador de zona segura (95%)
   - Tilt: 0-270° con indicador de zona segura
   - Speed slider horizontal

---

#### ZONE B: TOOL RACK (Derecha - 40%)

**Propósito:** Selección, testing y configuración.

**Componentes:**

1. **FIXTURE RACK** (Arriba)
   - Lista compacta de fixtures calibrables
   - Iconos custom por tipo (MovingHead, Par, Wash, Strobe)
   - Estado visual: ⬤ Seleccionado, ○ Disponible, ⊘ Offline
   - Chip de dirección DMX
   - Click para seleccionar

2. **DMX SCANNER** (Centro)
   - Dropdown de canales con nombre y tipo
   - Slider horizontal grande
   - Valor numérico editable
   - Presets de canales comunes (botones quick-access)
   - Visual feedback del valor actual

3. **OFFSET CONFIG** (Abajo)
   - Sliders de offset con range visual
   - Toggles de inversión con estado claro
   - Botones de acción: Reset, Save

---

#### ZONE C: ACTION BAR (Footer)

**Propósito:** Acciones globales de test.

**Diseño:** Barra horizontal estilo CommandDeck

```
[🔲 BLACKOUT] [⚡ STROBE] [🎨 COLOR] [⚙️ GOBO] [💡 FULL ON] [⏹ EXIT]
```

- Botones con estado visual (activo/inactivo)
- Toggle behavior (click again to off)
- Keyboard shortcuts visibles

---

### 🎨 DESIGN TOKENS

#### Colores (Paleta Calibration)

```css
/* Base (heredado de Forge) */
--cal-bg-primary: #0a0a0f;
--cal-bg-secondary: #0f0f13;
--cal-bg-panel: #12121a;
--cal-border: rgba(255, 255, 255, 0.08);

/* Accent (Cyan para Calibration) */
--cal-accent: #22d3ee;
--cal-accent-dim: rgba(34, 211, 238, 0.2);
--cal-accent-glow: rgba(34, 211, 238, 0.4);

/* Secondary (Orange para acciones peligrosas/activas) */
--cal-active: #f97316;
--cal-active-dim: rgba(249, 115, 22, 0.2);

/* State */
--cal-success: #10b981;
--cal-warning: #fbbf24;
--cal-danger: #ef4444;

/* Text */
--cal-text-primary: #ffffff;
--cal-text-secondary: #a1a1aa;
--cal-text-muted: #52525b;
```

#### Tipografía

```css
/* Headers */
font-family: 'JetBrains Mono', monospace;
letter-spacing: 2px;
text-transform: uppercase;

/* Values */
font-family: 'JetBrains Mono', monospace;
font-variant-numeric: tabular-nums;

/* Labels */
font-size: 10px;
font-weight: 600;
letter-spacing: 1px;
```

---

### 🖼️ ICONOS CUSTOM REQUERIDOS

| Icono | Uso | Descripción |
|-------|-----|-------------|
| `MovingHeadIcon` | Fixture list | Cabeza móvil estilizada |
| `ParCanIcon` | Fixture list | Par LED circular |
| `WashIcon` | Fixture list | Wash con haz difuso |
| `StrobeIcon` | Test button | Rayo/flash |
| `GoboIcon` | Test button | Rueda de gobo |
| `ColorWheelIcon` | Test button | Rueda de color |
| `CenterTargetIcon` | Quick position | Crosshair centro |
| `ArrowUpIcon` | Quick position | Flecha arriba (no genérica) |
| `ArrowDiagonalIcon` | Quick position | Flecha diagonal |
| `RadarGridIcon` | Header | Grid de radar |
| `OffsetIcon` | Offset panel | Ajuste fino |
| `ScannerIcon` | DMX Scanner | Onda/scan |

---

### 🔗 INTEGRACIONES REQUERIDAS

#### 1. Fixture Source Fix

```tsx
// ANTES (roto)
const hardware = useTruthStore(selectHardware)
const fixtures = hardware?.fixtures || []

// DESPUÉS (correcto)
const stageFixtures = useStageStore(state => state.fixtures)
const fixtures = stageFixtures.filter(f => f.type?.toLowerCase().includes('moving'))
```

#### 2. Output Gate Integration (WAVE 1132)

```tsx
// Al entrar a Calibration, forzar ARMED si está LIVE
useEffect(() => {
  // Safety: Don't allow LIVE mode while calibrating
  const wasLive = masterArbiter.isOutputEnabled()
  if (wasLive) {
    window.lux?.arbiter?.setOutputEnabled(false)
    console.log('[CalibrationLab] 🛡️ Forced ARMED state for safety')
  }
  
  return () => {
    // Optionally restore on exit
  }
}, [])
```

#### 3. Calibration Priority Layer

El MasterArbiter ya tiene Layer 2 (Manual), pero Calibration debería tener **prioridad absoluta** durante la sesión.

```tsx
// Propuesta: Layer -1 (CALIBRATION) o flag especial
masterArbiter.enterCalibrationMode(fixtureId)  // Ya existe en el código
```

---

### 📁 NUEVA ESTRUCTURA DE ARCHIVOS

```
CalibrationView/
├── index.tsx                    # Vista principal refactorizada
├── CalibrationView.css          # Estilos principales
├── components/
│   ├── index.ts                 # Barrel exports
│   ├── TargetingRadar/          # 🎯 Radar mejorado
│   │   ├── TargetingRadar.tsx
│   │   ├── TargetingRadar.css
│   │   └── QuickPosition.tsx    # Botones direccionales
│   ├── FixtureRack/             # 📋 Lista de fixtures
│   │   ├── FixtureRack.tsx
│   │   └── FixtureRack.css
│   ├── DMXScanner/              # 🔬 Scanner de canales
│   │   ├── DMXScanner.tsx
│   │   └── DMXScanner.css
│   ├── OffsetConfig/            # ⚙️ Config de offsets
│   │   ├── OffsetConfig.tsx
│   │   └── OffsetConfig.css
│   └── ActionBar/               # 🎬 Barra de acciones
│       ├── ActionBar.tsx
│       └── ActionBar.css
└── hooks/
    └── useCalibration.ts        # Hook maestro
```

---

### ⌨️ KEYBOARD SHORTCUTS

| Key | Action |
|-----|--------|
| `W` / `↑` | Tilt Up |
| `S` / `↓` | Tilt Down |
| `A` / `←` | Pan Left |
| `D` / `→` | Pan Right |
| `Q` | Pan Left + Tilt Up |
| `E` | Pan Right + Tilt Up |
| `Z` | Pan Left + Tilt Down |
| `C` | Pan Right + Tilt Down |
| `Space` | Center |
| `B` | Blackout Toggle |
| `F` | Full On (Dimmer 100%) |
| `1-9` | Select Fixture 1-9 |
| `Tab` | Next Fixture |
| `Shift+Tab` | Previous Fixture |
| `Esc` | Exit Calibration Mode |

---

### 🚀 FASES DE IMPLEMENTACIÓN

#### FASE 1: Foundation (4h)
- [ ] Fix FixtureList source (stageStore)
- [ ] Crear nuevo layout grid
- [ ] Migrar componentes existentes al nuevo layout
- [ ] Aplicar estilos base (dark neon)

#### FASE 2: Components (6h)
- [ ] Crear TargetingRadar mejorado
- [ ] Crear QuickPosition con botones direccionales
- [ ] Rediseñar DMXScanner
- [ ] Rediseñar FixtureRack
- [ ] Crear ActionBar

#### FASE 3: Integration (3h)
- [ ] Hook useCalibration
- [ ] Integración con Output Gate
- [ ] Keyboard shortcuts
- [ ] Calibration priority en Arbiter

#### FASE 4: Polish (2h)
- [ ] Iconos custom
- [ ] Animaciones y transiciones
- [ ] Responsive adjustments
- [ ] Testing final

**Total estimado: ~15h de trabajo**

---

### ✅ CRITERIOS DE ACEPTACIÓN

1. **Fixture List** muestra todas las fixtures del show
2. **Radar** responde instantáneamente al drag
3. **DMX Scanner** permite testear cualquier canal
4. **Output Gate** respetado (no DMX físico sin GO)
5. **UI consistente** con Forge y StageConstructor
6. **Sin emojis genéricos** - todos los iconos son custom
7. **Keyboard navigation** funcional
8. **Responsive** en ventanas de 1280px+

---

## 🎭 MOCKUP VISUAL (ASCII Art Enhanced)

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  ⬡ CALIBRATION LAB                         EL-1140 #1 ◉  DMX:001  ⟳ ARMED    ║
╠═══════════════════════════════════════════════╤═══════════════════════════════╣
║                                               │  ┌─ FIXTURE RACK ───────────┐ ║
║    ╭──────────────────────────────────╮       │  │                          │ ║
║    │             ╱╲                   │       │  │  ◉ EL-1140 #1    DMX 001 │ ║
║    │            ╱  ╲                  │       │  │  ○ EL-1140 #2    DMX 021 │ ║
║    │     ──────╱    ╲──────          │       │  │  ○ Par LED Front DMX 041 │ ║
║    │          ╱  ⊕   ╲               │       │  │  ○ Par LED Back  DMX 051 │ ║
║    │         ╱        ╲              │       │  │                          │ ║
║    │     ───╱──────────╲───          │       │  └──────────────────────────┘ ║
║    │       ╱            ╲            │       │                               ║
║    │      ╱              ╲           │       │  ┌─ DMX SCANNER ────────────┐ ║
║    │   ──╱────────────────╲──        │       │  │                          │ ║
║    │    ╱                  ╲         │       │  │  Channel: [Pan        ▼] │ ║
║    │   ╱                    ╲        │       │  │                          │ ║
║    ╰──────────────────────────────────╯       │  │  ████████████░░░░░  185 │ ║
║                                               │  │                          │ ║
║    ┌─ QUICK POSITION ──────────────────┐      │  │  [Dim][Strb][Gobo][Clr] │ ║
║    │  [↖] [↑] [↗]                      │      │  │                          │ ║
║    │  [←] [⊙] [→]     Step: [5°  ▼]    │      │  └──────────────────────────┘ ║
║    │  [↙] [↓] [↘]                      │      │                               ║
║    └───────────────────────────────────┘      │  ┌─ OFFSET CONFIG ─────────┐ ║
║                                               │  │                          │ ║
║    ┌─ POSITION DATA ───────────────────┐      │  │  Pan:  [────●────] +0°  │ ║
║    │  PAN   185° ████████████░░░ 540°  │      │  │  Tilt: [────●────] +0°  │ ║
║    │  TILT  127° ██████████░░░░░ 270°  │      │  │                          │ ║
║    │  SPEED [FAST ████░░░░░░░░ SLOW]   │      │  │  [Pan ↔] [Tilt ↕]       │ ║
║    └───────────────────────────────────┘      │  │                          │ ║
║                                               │  │  [RESET]  [SAVE]        │ ║
║                                               │  └──────────────────────────┘ ║
╠═══════════════════════════════════════════════╧═══════════════════════════════╣
║  [⬛ BLACKOUT]  [⚡ STROBE]  [🎨 COLOR]  [⚙ GOBO]  [💡 FULL]  [⏹ EXIT CAL]   ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## 📝 NOTAS FINALES

Este rediseño convierte CalibrationView de un "panel de emergencia" a un **laboratorio profesional de calibración**. 

El objetivo es que un técnico de iluminación se sienta **en casa**: herramientas familiares, layout intuitivo, feedback visual constante.

**La prioridad durante calibración es REAL**: si el usuario está en CalibrationView, el sistema debe entender que está haciendo trabajo de precisión y darle control total sobre el hardware.

---

*PunkOpus - "Cada fotón en su lugar. Cada grado medido."* 🎯

---

**PENDIENTE APROBACIÓN DEL ARQUITECTO** ✋
