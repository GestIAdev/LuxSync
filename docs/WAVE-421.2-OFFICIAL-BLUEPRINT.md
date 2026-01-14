# WAVE 421.2: BLUEPRINT OFICIAL - UI ARCHITECTURE REDESIGN

**Date:** 2026-01-14  
**Status:** 🚀 PHASE 0-1 COMPLETE | Phase 2 PENDING  
**Prerequisite:** WAVE-421.1 (Audit) ✅  
**Reference:** WAVE-375-COMMAND-DECK-BLUEPRINT-v2.md  
**Approved by:** El Arquitecto & Dirección General

**Progress:**
- ✅ Phase 0: Preparation (SVG audit, widget location)
- ✅ Phase 1: WAVE 422 - Mode Termination (5 files deleted, 4 files modified)
- ⏳ Phase 2: WAVE 423 - Stage System (NEXT)
- ⏳ Phase 3: WAVE 424 - Dashboard Simplify
- ⏳ Phase 4: WAVE 425 - Calibration Mode
- ⏳ Phase 5: WAVE 426 - Vibe Migration
- ⏳ Phase 6: WAVE 427 - Integration Test

---

## 🎖️ DIRECTIVAS DEL ARQUITECTO (Modificaciones Tácticas)

| Directiva | Decisión |
|-----------|----------|
| Estructura | **3 STAGES ONLY**: Dashboard, Live, Calibration |
| LUX CORE | **MANTENER VISIBLE** como herramienta auxiliar (es bonita) |
| Calibration | **VISTA COMPLETA** (no modal) con RadarXY + TargetingSystem |
| Command Deck | Prioridad: GrandMaster > Vibes > Blackout > Status |
| Iconos | **PROHIBIDO Lucide genéricos** - Usar SVGs existentes |
| Flow Mode | **ELIMINAR** todas las referencias |
| Manual Mode | **ELIMINAR** botones explícitos - Sistema Auto-Override |

---

## 🎯 VISIÓN FINAL

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LUXSYNC: UNA APP, TRES STAGES, CERO CONFUSIÓN                              │
└─────────────────────────────────────────────────────────────────────────────┘

  El usuario siempre sabe:
  ✅ DÓNDE está (Dashboard / Calibration / Live Show)
  ✅ QUIÉN controla (AI / Manual Override por fixture)
  ✅ QUÉ VIBE está activa (constraint del show)
  
  El usuario NUNCA ve:
  ❌ "Modo Flow" (eliminado - era placebo)
  ❌ "Modo Manual global" (eliminado - implicit overrides)
  ❌ Selectores duplicados (un lugar para cada cosa)
```

---

## 📐 ARQUITECTURA DE VISTAS: APROBADA

### Estructura Final: 3 STAGES + 1 TOOL

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LUXSYNC: 3 STAGES PRINCIPALES                                               │
└─────────────────────────────────────────────────────────────────────────────┘

  STAGE 1: 🏠 DASHBOARD (Gestión de Sesión)
           └→ Power ON/OFF del sistema
           └→ Show Load / Project Management
           └→ Quick links a Live y Calibration
           └→ System Status overview

  STAGE 2: 🎭 LIVE (Performance Hub)
           └→ Simulador 2D/3D Canvas
           └→ Command Deck (bottom bar)
           └→ TheProgrammer (sidebar contextual)
           └→ Vibe Selector integrado en Deck

  STAGE 3: 🎯 CALIBRATION (Hardware Setup)
           └→ VISTA COMPLETA (no modal)
           └→ RadarXY widget (RECUPERAR del código base)
           └→ TargetingSystem widget (RECUPERAR del código base)
           └→ Pan/Tilt offset sliders
           └→ Color test buttons

  TOOL: 🧠 LUX CORE (Auxiliary - Visible)
        └→ Monitorización de Selene AI
        └→ Telemetría de workers
        └→ Tab secundario, NO oculto (es bonita)
        └→ No bloqueante para el workflow

┌─────────────────────────────────────────────────────────────────────────────┐
│  ELIMINADO DEL PARADIGMA ANTERIOR:                                           │
│  ❌ CONSTRUCT tab → Merge into CALIBRATION/SETUP                             │
│  ❌ SETUP tab → Merge into DASHBOARD                                         │
│  ❌ "Modo Flow" → ELIMINADO (placebo)                                        │
│  ❌ "Modo Manual" botón → ELIMINADO (Auto-Override implícito)               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ NUEVO DISEÑO DE SIDEBAR (Aprobado)

### Estructura Visual Final

```
┌──────────┐
│ 🌙 ✨    │
│ LUXSYNC  │
│ v1.0     │
├──────────┤
│          │
│ ⚡       │ ← STAGE 1: DASHBOARD
│ COMMAND  │   (Gestión de Sesión / Show Load)
│          │
│──────────│ ← Divider: STAGES
│          │
│ �       │ ← STAGE 2: LIVE  
│ LIVE     │   (Simulador + Deck + Programmer)
│          │
│ �       │ ← STAGE 3: CALIBRATION
│ CALIBRATE│   (Hardware Setup con RadarXY)
│          │
│──────────│ ← Divider: TOOLS
│          │
│ 🧠       │ ← TOOL: LUX CORE (VISIBLE - es bonita)
│ LUX CORE │   (Monitorización Selene AI)
│          │
└──────────┘

NOTA: 
- LUX CORE se MANTIENE visible (directiva del Arquitecto)
- CONSTRUCT se absorbe en CALIBRATION
- SETUP se absorbe en DASHBOARD
```

### Nueva Definición de Tabs

```typescript
// navigationStore.ts - ESTRUCTURA APROBADA

export type StageId = 'dashboard' | 'live' | 'calibration'
export type ToolId = 'core'  // LUX CORE es el único tool visible
export type TabId = StageId | ToolId

export interface TabConfig {
  id: TabId
  label: string
  icon: string          // Referencia a SVG existente
  customIcon?: boolean  // true = usar SVG custom, no Lucide
  type: 'stage' | 'tool'
  shortcut: string
  description: string
}

export const TABS: TabConfig[] = [
  // === STAGES (3 principales) ===
  {
    id: 'dashboard',
    label: 'COMMAND',
    icon: 'bolt',           // SVG existente (IconDmxBolt)
    customIcon: true,
    type: 'stage',
    shortcut: 'Alt+1',
    description: 'Command Center - Session & Show Management',
  },
  {
    id: 'live',
    label: 'LIVE',
    icon: 'stage',          // SVG existente (monitor/stage icon)
    customIcon: true,
    type: 'stage',
    shortcut: 'Alt+2',
    description: 'Live Performance - Simulator & Control',
  },
  {
    id: 'calibration',
    label: 'CALIBRATE',
    icon: 'target',         // SVG existente o crear
    customIcon: true,
    type: 'stage',
    shortcut: 'Alt+3',
    description: 'Hardware Setup - Fixture Alignment',
  },
  
  // === TOOL (auxiliar visible) ===
  {
    id: 'core',
    label: 'LUX CORE',
    icon: 'brain',          // SVG existente (IconNeuralBrain)
    customIcon: true,
    type: 'tool',
    shortcut: 'Alt+4',
    description: 'Selene AI Monitoring & Telemetry',
  },
]
```

### 🎨 DIRECTIVA DE ICONOS

```
⚠️ PROHIBIDO: Lucide/FontAwesome genéricos para elementos clave

✅ USAR: SVGs existentes en el codebase:
  - IconDmxBolt (Dashboard/Command)
  - IconNeuralBrain (LUX CORE)
  - IconAudioWave (Audio status)
  - Vibe icons (Zap, Flame, Mic2, Sofa) → Mantener los actuales
  
📍 LOCALIZACIÓN de SVGs existentes:
  - DashboardView/components/HudIcons.tsx
  - VibeSelector.tsx (icon map)
  - Otros componentes a auditar
```

---

## 🏠 STAGE 1: COMMAND CENTER (Rediseño)

### Propósito

Centro de control y status del sistema. **NO para control en vivo**, solo para:
- Encender/apagar sistema
- Ver estado general
- Acceder a otros stages

### Layout Propuesto

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚡ COMMAND CENTER                                        [🔴 SYSTEM: OFF]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │                    🔌 POWER CONTROL                                   │   │
│  │                                                                       │   │
│  │         ┌─────────────────────────────────────────────┐              │   │
│  │         │                                              │              │   │
│  │         │              [⚡ POWER ON]                   │              │   │
│  │         │                                              │              │   │
│  │         │      Click to start LuxSync system          │              │   │
│  │         │                                              │              │   │
│  │         └─────────────────────────────────────────────┘              │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   🎯 CALIBRATE  │    │   🎭 LIVE SHOW  │    │  📐 CONSTRUCT   │         │
│  │                 │    │                 │    │                 │         │
│  │  Align fixtures │    │ Start the show  │    │  Edit patch     │         │
│  │  before show    │    │ with music      │    │                 │         │
│  │                 │    │                 │    │                 │         │
│  │   [GO →]        │    │   [GO →]        │    │   [GO →]        │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  SYSTEM STATUS                                                       │    │
│  │  • Audio:   🟢 Ready (WasAPI)                                        │    │
│  │  • DMX:     🟢 Connected (ArtNet 10.0.0.1)                          │    │
│  │  • Fixtures: 10 patched                                              │    │
│  │  • Show:    concert-2026.lux                                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Lo que SE ELIMINA del Dashboard

| Componente | Destino | Razón |
|------------|---------|-------|
| `ModeSwitcherSleek` | 💀 ELIMINAR | Ya no hay modos globales |
| `VibeSelector` | → CommandDeck (Live) | Se usa durante show, no antes |
| `AudioReactorRing` | → Live Show (mini) | Pertenece al contexto de show |
| `SeleneBrain` | → LUX CORE (opcional) | No relevante para usuario final |

### Lo que SE MANTIENE en Dashboard

| Componente | Razón |
|------------|-------|
| `PowerButton` | Encender/apagar sistema |
| `DataCards` (simplificado) | Status del sistema |
| Quick links | Navegación a otros stages |

---

## 🎯 STAGE 2: CALIBRATION MODE (Vista Completa)

### Propósito

Ajustar fixtures ANTES del show - **VISTA COMPLETA, NO MODAL**:
- Offset de pan/tilt para movers mal colgados
- Test de colores (verificar que RGB funciona)
- Sweep de posiciones (verificar rango de movimiento)
- **RadarXY widget** (RECUPERAR del código base)
- **TargetingSystem widget** (RECUPERAR del código base)

### Layout Aprobado

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🎯 CALIBRATION MODE                    [← DASHBOARD]  [SAVE & GO LIVE →]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────┬───────────────────┬───────────────────┐   │
│  │                               │                   │                   │   │
│  │   STAGE SIMULATOR (2D)       │    RADAR XY       │  CALIBRATION      │   │
│  │                               │    WIDGET         │  PANEL            │   │
│  │   [Fixtures at 50% white]    │                   │                   │   │
│  │                               │  ┌───────────┐   │  Selected:        │   │
│  │      ○ ○ ○ ○ ○ (Movers)      │  │     ◉     │   │  Mover #1         │   │
│  │                               │  │   ╱   ╲   │   │  (Beam 2R)        │   │
│  │      □ □ □ □ □ (PARs)        │  │  ◯  ✕  ◯  │   │                   │   │
│  │                               │  │   ╲   ╱   │   │  ────────────     │   │
│  │   [Click to select]          │  │     ◉     │   │                   │   │
│  │                               │  └───────────┘   │  Pan Offset:      │   │
│  │                               │                   │  [-30°]══●═[+30°] │   │
│  │                               │  Center of       │  = +12°           │   │
│  │                               │  Gravity: (0.5,0.5)                  │   │
│  │                               │                   │  Tilt Offset:     │   │
│  │                               ├───────────────────┤  [-30°]═●══[+30°] │   │
│  │                               │                   │  = -8°            │   │
│  │                               │   TARGETING       │                   │   │
│  │                               │   SYSTEM          │  ────────────     │   │
│  │                               │                   │                   │   │
│  │                               │  ┌───────────┐   │  [🏠 GO HOME]     │   │
│  │                               │  │ ╭───────╮ │   │  [↔️ SWEEP PAN]   │   │
│  │                               │  │ │ ◎ ─►  │ │   │  [↕️ SWEEP TILT]  │   │
│  │                               │  │ ╰───────╯ │   │                   │   │
│  │                               │  └───────────┘   │  ────────────     │   │
│  │                               │                   │                   │   │
│  │                               │  Target Pos:     │  Color Test:      │   │
│  │                               │  Pan: 127        │  [🔴][🟢][🔵][⚪] │   │
│  │                               │  Tilt: 64        │                   │   │
│  │                               │                   │  ☑ Invert Pan     │   │
│  │                               │                   │  ☐ Invert Tilt    │   │
│  │                               │                   │                   │   │
│  └──────────────────────────────┴───────────────────┴───────────────────┘   │
│                                                                              │
│  [Fixture List] ○ Mover1  ● Mover2 (selected)  ○ Mover3  □ PAR1  □ PAR2...  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Widgets a RECUPERAR del Código Base

```typescript
// 🔍 TAREA: Localizar estos widgets existentes

// 1. RADAR XY
// Probables ubicaciones:
// - src/components/programmer/RadarXY.tsx
// - src/components/shared/RadarXY.tsx
// - src/components/stage3d/RadarXY.tsx

// 2. TARGETING SYSTEM
// Probables ubicaciones:
// - src/components/programmer/TargetingSystem.tsx
// - src/components/programmer/PositionSection.tsx (puede contener)
// - src/components/shared/TargetingSystem.tsx

// ACCIÓN: Buscar en codebase y reconectar
```

### Comportamiento del Sistema en Calibration

```typescript
// Estado del MasterArbiter durante CALIBRATION
{
  // Layer 4 (Blackout): OFF - Queremos ver luz
  blackout: false,
  
  // Layer 3 (Effects): OFF - Sin strobe ni nada
  activeEffects: [],
  
  // Layer 2 (Manual): ACTIVE - El CalibrationPanel controla
  manualOverrides: new Map([
    // Fixture seleccionado con valores de test
    ['mover-1', { dimmer: 0.5, r: 255, g: 255, b: 255 }]
  ]),
  
  // Layer 1 (Consciousness): OFF
  // Layer 0 (Titan AI): OFF - No queremos que la IA mueva nada
  
  // MODO ESPECIAL:
  calibrationMode: true  // Desactiva AI completamente
}
```

### Persistencia de Calibración

```typescript
// ShowFileV2.ts - NUEVO CAMPO
interface FixtureDefinition {
  id: string
  name: string
  type: string
  // ... existing ...
  
  // 🆕 CALIBRATION DATA
  calibration?: {
    panOffset: number       // -180 to +180 degrees
    tiltOffset: number      // -90 to +90 degrees
    invertPan: boolean
    invertTilt: boolean
    lastCalibrated: number  // timestamp
  }
}
```

### Componentes de Calibration

```typescript
// src/components/calibration/CalibrationView.tsx (NUEVO)

import { RadarXY } from '../programmer/RadarXY'           // RECUPERAR
import { TargetingSystem } from '../programmer/TargetingSystem'  // RECUPERAR
import { CalibrationPanel } from './CalibrationPanel'
import { StageSimulator2 } from '../views/SimulateView/StageSimulator2'

export const CalibrationView: React.FC = () => {
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null)
  
  return (
    <div className="calibration-view">
      <header className="calibration-header">
        <button onClick={goToDashboard}>← DASHBOARD</button>
        <h1>🎯 CALIBRATION MODE</h1>
        <button onClick={saveAndGoLive}>SAVE & GO LIVE →</button>
      </header>
      
      <main className="calibration-layout">
        {/* Left: Stage Preview */}
        <section className="calibration-stage">
          <StageSimulator2 
            mode="calibration"
            onFixtureSelect={setSelectedFixtureId}
          />
        </section>
        
        {/* Center: Radar & Targeting */}
        <section className="calibration-widgets">
          <RadarXY fixtureId={selectedFixtureId} />
          <TargetingSystem fixtureId={selectedFixtureId} />
        </section>
        
        {/* Right: Controls */}
        <section className="calibration-panel">
          <CalibrationPanel 
            fixtureId={selectedFixtureId}
            onSave={handleSave}
          />
        </section>
      </main>
      
      <footer className="calibration-fixture-list">
        <FixtureSelector onSelect={setSelectedFixtureId} />
      </footer>
    </div>
  )
}
```

---

## 🎭 STAGE 3: LIVE SHOW (Performance Hub)

### Propósito

El **ÚNICO** lugar para controlar el show en vivo:
- Visualización del escenario (Canvas 2D/3D)
- Control de fixtures (TheProgrammer)
- Quick actions (Strobe, Blinder, Smoke)
- Vibe Selector integrado en Command Deck
- Grand Master

### Layout Aprobado

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🎭 LIVE SHOW                     [🔙 DASHBOARD]    [BPM: 128]    [⚡ 73%]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────┬──────────────────┐   │
│  │                                                    │                  │   │
│  │           STAGE SIMULATOR (2D/3D Canvas)          │  THE PROGRAMMER  │   │
│  │                                                    │  (Solo cuando    │   │
│  │   [Fixtures reacting to music in real-time]       │   hay selección) │   │
│  │                                                    │                  │   │
│  │       ◉ ◉ ◉ ◉ ◉    (Moving Heads - dancing)      │  2 Selected      │   │
│  │                                                    │                  │   │
│  │       ▣ ▣ ▣ ▣ ▣    (PARs - pulsing colors)       │  💡 Intensity    │   │
│  │                                                    │  [════●════] 80% │   │
│  │                                                    │  [🔓 Release]    │   │
│  │   [Click to select = AUTO-OVERRIDE activado]      │                  │   │
│  │   [No hay botón "Manual" - Es implícito]          │  🎨 Color        │   │
│  │                                                    │  [R][G][B] sliders│   │
│  │                                                    │  [🔓 Release]    │   │
│  │                                                    │                  │   │
│  │                                                    │  🕹️ Position    │   │
│  │                                                    │  [XY Pad]        │   │
│  │                                                    │  [🔓 Release]    │   │
│  │                                                    │                  │   │
│  │                                                    │  ──────────────  │   │
│  │                                                    │  [🔓 RELEASE ALL]│   │
│  │                                                    │                  │   │
│  └───────────────────────────────────────────────────┴──────────────────┘   │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  🎛️ THE COMMAND DECK (140px) - Diseño Minimalista Cyberpunk                 │
│                                                                              │
│  PRIORIDAD DE ESPACIO: GrandMaster > Vibes > Blackout > Status              │
│                                                                              │
│  ┌──────────────────┬─────────────────────────┬──────────┬────────────────┐ │
│  │   GRAND MASTER   │      VIBE SELECTOR      │ BLACKOUT │     STATUS     │ │
│  │                  │                         │          │                │ │
│  │  ┌────────────┐  │ [⚡] [🔥] [🎸] [�️]     │    ■     │  BPM: 128     │ │
│  │  │████████░░░░│  │ TECH LAT  ROCK CHILL   │ BLACKOUT │  ████████░ 72% │ │
│  │  └────────────┘  │                         │  SPACE   │                │ │
│  │     90%          │  Active: TECHNO ⚡      │          │  🟢 ONLINE    │ │
│  └──────────────────┴─────────────────────────┴──────────┴────────────────┘ │
│                                                                              │
│  [⚡ STROBE: 1]  [☀️ BLINDER: 2]  [💨 SMOKE: 3]  [KILL ALL OVERRIDES: ESC] │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Command Deck - Layout con Prioridades del Arquitecto

```typescript
// commandDeck/CommandDeck.tsx - LAYOUT APROBADO

export const CommandDeck: React.FC = () => {
  return (
    <footer className="command-deck cyberpunk-minimal">
      {/* PRIORIDAD 1: GRAND MASTER (Lo más importante) */}
      <div className="deck-section deck-master">
        <GrandMasterSlider />
      </div>
      
      {/* PRIORIDAD 2: VIBE SELECTOR (El corazón del show) */}
      <div className="deck-section deck-vibe">
        <VibeSelectorCompact />  {/* 🆕 MOVIDO AQUÍ */}
      </div>
      
      {/* PRIORIDAD 3: BLACKOUT (Emergencia) */}
      <div className="deck-section deck-emergency">
        <BlackoutButton />
      </div>
      
      {/* PRIORIDAD 4: STATUS (Info secundaria) */}
      <div className="deck-section deck-status">
        <StatusBar />
      </div>
      
      {/* BOTTOM ROW: Quick Actions */}
      <div className="deck-section deck-actions">
        <QuickActions />
        <div className="deck-separator" />
        <KillAllButton />
      </div>
    </footer>
  )
}
```

### Vibe Selector Compacto para Command Deck

```typescript
// commandDeck/VibeSelectorCompact.tsx (NUEVO)
// ⚠️ USAR SVGs EXISTENTES - NO LUCIDE GENÉRICOS

import { useSeleneVibe, VibeId } from '../../hooks/useSeleneVibe'

// Importar iconos SVG existentes del codebase
// (Auditar DashboardView/components/VibeSelector.tsx para extraer)

const VIBE_CONFIG = [
  { id: 'techno', label: 'TECH', color: 'cyan' },
  { id: 'latino', label: 'LAT',  color: 'orange' },
  { id: 'rock',   label: 'ROCK', color: 'fuchsia' },
  { id: 'chill',  label: 'CHILL', color: 'teal' },
] as const

export const VibeSelectorCompact: React.FC = () => {
  const { currentVibe, setVibe, isTransitioning } = useSeleneVibe()
  
  return (
    <div className="vibe-selector-compact">
      <div className="vibe-buttons">
        {VIBE_CONFIG.map(vibe => (
          <button
            key={vibe.id}
            className={`vibe-btn ${currentVibe === vibe.id ? 'active' : ''}`}
            onClick={() => setVibe(vibe.id as VibeId)}
            disabled={isTransitioning}
            style={{ '--vibe-color': vibe.color } as React.CSSProperties}
          >
            <VibeIcon id={vibe.id} />  {/* SVG existente */}
            <span>{vibe.label}</span>
          </button>
        ))}
      </div>
      <div className="vibe-active-label">
        Active: {currentVibe?.toUpperCase() || 'NONE'}
      </div>
    </div>
  )
}
```

---

## 💀 ELEMENTOS A ELIMINAR

### Código Muerto

| Archivo | Razón | Acción |
|---------|-------|--------|
| `ModeSwitcher/ModeSwitcher.tsx` | Duplicado | DELETE |
| `ModeSwitcher/ModeSwitcher.css` | Duplicado | DELETE |
| `DashboardView/components/ModeSwitcherSleek.tsx` | Ya no hay modos | DELETE |
| `DashboardView/components/ModeSwitcherSleek.css` | Ya no hay modos | DELETE |

### Tipos a Eliminar

```typescript
// controlStore.ts
// ELIMINAR:
export type GlobalMode = 'manual' | 'flow' | 'selene' | null

// seleneStore.ts  
// ELIMINAR:
export type SeleneMode = 'flow' | 'selene' | 'locked'

// NUEVO (si hace falta):
// No hay tipo de "modo" - El modo es implícito según el override del Arbiter
```

### Referencias a "Flow"

```bash
# Buscar y eliminar todas las referencias:
grep -r "flow" --include="*.ts" --include="*.tsx"
# Eliminar: 
# - 'flow' en arrays de modos
# - Handlers de setFlow
# - Lógica de mode === 'flow'
```

---

## 🗺️ ROADMAP DE IMPLEMENTACIÓN (APROBADO)

### FASE 0: Preparación (30 min) ✅ COMPLETE
```
✅ Crear branch: feature/wave-421-ui-redesign → SKIP (trabajamos en main)
✅ Auditar SVGs existentes en codebase
✅ Localizar RadarXY y TargetingSystem widgets → NO EXISTEN (crear en Phase 4)
✅ Backup de archivos a modificar → Git history
```

### FASE 1: Limpieza de Modos - WAVE 422 (2 horas) ✅ COMPLETE

**Objetivo:** Eliminar todo rastro de "modo" global y "flow"

```
WAVE 422: MODE TERMINATION ✅ EJECUTADO

✅ DELETE: ModeSwitcher/ModeSwitcher.tsx
✅ DELETE: ModeSwitcher/ModeSwitcher.css
✅ DELETE: ModeSwitcher/index.ts
✅ DELETE: DashboardView/components/ModeSwitcherSleek.tsx
✅ DELETE: DashboardView/components/ModeSwitcherSleek.css

✅ EDIT: controlStore.ts
  - GlobalMode actualizado: 'manual' | 'selene' | null (sin 'flow')
  - flowParams mantenido (para futuros Kinetic controls)
  - Header actualizado a WAVE 422

✅ EDIT: StageViewDual.tsx
  - MODES array: eliminado 'flow' entry
  - Labels actualizados: 'MAN' → 'OVERRIDE'

✅ EDIT: BigSwitch.tsx  
  - MODES array: eliminado 'flow' entry
  - Labels actualizados: 'LOCKED' → 'OVERRIDE'

⚠️ DEUDA TÉCNICA (Phase 3+):
  - SeleneMode duplicado en 4 stores (refactor mayor)
  - TrinityProvider.tsx flow detection (no crítico)

✅ TEST: Sin errores TypeScript
```

**Ver:** docs/WAVE-422-MODE-TERMINATION-REPORT.md

### FASE 2: Estructura 3 Stages - WAVE 423 (3 horas)

**Objetivo:** Implementar Dashboard → Live → Calibration + LUX CORE

```
WAVE 423: STAGE SYSTEM

□ EDIT: navigationStore.ts
  - Nuevo TabId: 'dashboard' | 'live' | 'calibration' | 'core'
  - Eliminar: 'simulate' | 'constructor' | 'setup'
  - Añadir: customIcon: boolean para SVGs
  
□ AUDITAR: SVGs existentes
  - DashboardView/components/HudIcons.tsx
  - Extraer: IconDmxBolt, IconNeuralBrain, etc.
  - Crear archivo centralizado: src/components/icons/LuxIcons.tsx

□ EDIT: Sidebar.tsx
  - Visual dividers entre STAGES y TOOL
  - Usar SVGs existentes (NO Lucide genéricos)
  - Orden: Dashboard → Live → Calibration | LUX CORE

□ BUSCAR: RadarXY widget
  grep -r "RadarXY" --include="*.tsx"
  - Localizar y documentar ubicación
  
□ BUSCAR: TargetingSystem widget
  grep -r "Targeting" --include="*.tsx"
  - Localizar y documentar ubicación

□ EDIT: MainLayout.tsx
  - Routing para 4 tabs (3 stages + 1 tool)
```

### FASE 3: Dashboard Simplificado - WAVE 424 (2 horas)

**Objetivo:** Dashboard = Gestión de Sesión / Show Load

```
WAVE 424: DASHBOARD SIMPLIFY

□ EDIT: DashboardView/index.tsx
  - ELIMINAR: ModeSwitcherSleek import/render
  - ELIMINAR: VibeSelector (→ mover a CommandDeck)
  - MANTENER: PowerButton (es necesario)
  - MANTENER: AudioReactorRing (es bonito, mantener pequeño)
  - MANTENER: SeleneBrain (info útil)
  - MANTENER: DataCards (status del sistema)

□ CREATE: DashboardView/components/QuickLinks.tsx
  - Card: 🎭 GO TO LIVE
  - Card: 🎯 CALIBRATE HARDWARE
  - Card: 🧠 LUX CORE (link)
  - Usar SVGs existentes para iconos

□ SIMPLIFICAR layout:
  - Power prominente
  - Quick links claros
  - Status resumido
```

### FASE 4: Calibration Mode - WAVE 425 (4 horas)

**Objetivo:** Vista completa con RadarXY y TargetingSystem

```
WAVE 425: CALIBRATION MODE

□ CREATE: src/components/calibration/CalibrationView.tsx
  - Layout: Stage + Widgets + Panel
  - Header: Back to Dashboard + Save & Go Live
  - Footer: Fixture selector list

□ CREATE: src/components/calibration/CalibrationPanel.tsx
  - Pan/Tilt offset sliders
  - Test buttons (Home, Sweep Pan, Sweep Tilt)
  - Color test (Red, Green, Blue, White)
  - Invert checkboxes
  - Save button

□ RECUPERAR: RadarXY widget
  - Importar del código existente
  - Conectar a fixture seleccionado
  - Props: fixtureId, onChange

□ RECUPERAR: TargetingSystem widget
  - Importar del código existente
  - Conectar a fixture seleccionado
  - Props: fixtureId, onPositionChange

□ EDIT: MasterArbiter.ts
  - enterCalibrationMode(): void
  - exitCalibrationMode(): void
  - isCalibrating: boolean getter
  
□ EDIT: ShowFileV2.ts
  - Añadir calibration field a FixtureDefinition
  
□ EDIT: preload.ts
  - IPC handlers para calibration mode

□ CREATE: CalibrationView.css
  - Layout grid: stage | widgets | panel
  - Estilo cyberpunk consistente
```

### FASE 5: Vibes en CommandDeck - WAVE 426 (2 horas)

**Objetivo:** Mover VibeSelector al Command Deck con prioridad

```
WAVE 426: VIBE MIGRATION

□ CREATE: commandDeck/VibeSelectorCompact.tsx
  - Diseño minimalista cyberpunk
  - USAR SVGs existentes (de DashboardView/components/VibeSelector)
  - NO Lucide genéricos
  - Labels cortos: TECH, LAT, ROCK, CHILL

□ EDIT: CommandDeck.tsx
  - Nuevo layout con prioridades:
    1. GrandMaster (más importante)
    2. VibeSelector (corazón del show)
    3. Blackout (emergencia)
    4. Status (info secundaria)
  - Quick Actions en bottom row

□ EXTRAER: Iconos de VibeSelector existente
  - DashboardView/components/VibeSelector.tsx
  - Mover SVGs a archivo centralizado
  - Reusar en VibeSelectorCompact

□ EDIT: CommandDeck.css
  - Estilos cyberpunk minimalista
  - Prioridad visual según orden
```

### FASE 6: Polish & Testing - WAVE 427 (3 horas)

**Objetivo:** Verificar todo funciona, limpiar código

```
WAVE 427: INTEGRATION TEST

□ TEST: User Journey completo
  1. Abrir app → Dashboard
  2. Power ON
  3. Go to Calibration
  4. Verificar RadarXY funciona
  5. Verificar TargetingSystem funciona
  6. Ajustar offsets de un mover
  7. Save & Go Live
  8. Cambiar vibes en CommandDeck
  9. Usar TheProgrammer (Auto-Override)
  10. Blackout emergency
  11. Volver a Dashboard
  12. Power OFF

□ VERIFICAR: Auto-Override funciona
  - Click fixture → Override activo (sin botón manual)
  - Release → Vuelve a AI
  
□ VERIFICAR: No hay referencias a 'flow'
  grep -r "flow" --include="*.ts" --include="*.tsx"
  
□ VERIFICAR: No hay botones de "Manual Mode"

□ CLEANUP:
  - Eliminar código comentado
  - Eliminar console.logs de debug
  - Verificar imports no usados
  
□ COMMIT: wave-421-ui-redesign complete
□ MERGE: to main
```

---

## ⏱️ ESTIMACIÓN TOTAL

| Fase | Wave | Duración | Dependencias |
|------|------|----------|--------------|
| 0: Preparación | - | 30 min | - |
| 1: Mode Termination | 422 | 2 h | - |
| 2: Stage System | 423 | 3 h | Fase 1 |
| 3: Dashboard Simplify | 424 | 2 h | Fase 2 |
| 4: Calibration Mode | 425 | 4 h | Fase 2, widgets localizados |
| 5: Vibe Migration | 426 | 2 h | Fase 3 |
| 6: Testing | 427 | 3 h | Todo |

**TOTAL: ~16-18 horas de trabajo**

---

## ✅ CHECKLIST APROBADO POR EL ARQUITECTO

| Item | Decisión | Status |
|------|----------|--------|
| Concepto "3 Stages" | **APROBADO** | ✅ |
| Eliminar "Modo Flow" | **APROBADO** | ✅ |
| Eliminar "Modo Manual" botón | **APROBADO** (Auto-Override) | ✅ |
| Vibes en CommandDeck | **APROBADO** | ✅ |
| Calibration como vista completa | **APROBADO** (no modal) | ✅ |
| Incluir RadarXY en Calibration | **REQUERIDO** | ✅ |
| Incluir TargetingSystem en Calibration | **REQUERIDO** | ✅ |
| LUX CORE visible | **APROBADO** (es bonita) | ✅ |
| Prohibir Lucide genéricos | **DIRECTIVA** (usar SVGs existentes) | ✅ |
| Prioridad CommandDeck | GrandMaster > Vibes > Blackout > Status | ✅ |

---

## 🎯 RESULTADO FINAL ESPERADO

Después de WAVE 422-427:

```
✅ 3 Stages claros: Dashboard → Live → Calibration
✅ LUX CORE visible como herramienta auxiliar (es bonita)
✅ No hay "modos" confusos - Sistema Auto-Override
✅ No hay referencias a "flow" en todo el codebase
✅ Vibes accesibles en CommandDeck durante show
✅ Calibration funcional con RadarXY + TargetingSystem
✅ Iconos SVG consistentes (NO Lucide genéricos para elementos clave)
✅ Dashboard limpio: Power + Quick Links + Status
✅ Código limpio sin duplicados ni dead code
✅ UX clara, profesional y CYBERPUNK
```

---

## 🚀 ÓRDENES DE BATALLA

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   BLUEPRINT APROBADO                                                         │
│   ==================                                                         │
│                                                                              │
│   El Ejecutor (PunkOpus) está en posición.                                  │
│   Armas cargadas. Targets identificados.                                    │
│                                                                              │
│   Esperando orden de inicio del Arquitecto.                                 │
│                                                                              │
│   🎯 "WAVE 422: MODE TERMINATION" listo para despliegue.                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

**WAVE 421.2 Status:** ✅ BLUEPRINT APROBADO - AWAITING EXECUTION ORDER

*"Un blueprint sólido hoy = cero regresiones mañana."* 🔧

**Firmado:**  
PunkOpus - El Ejecutor  
Aprobado por: El Arquitecto & Dirección General  
Fecha: 2026-01-14
