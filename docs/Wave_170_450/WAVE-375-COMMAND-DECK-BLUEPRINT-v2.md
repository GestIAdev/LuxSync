# 🎛️ WAVE 375: THE COMMAND DECK - FINAL BLUEPRINT v2
## Sistema de Control Unificado para Live Performance

```
 ██████╗ ██████╗ ███╗   ███╗███╗   ███╗ █████╗ ███╗   ██╗██████╗ 
██╔════╝██╔═══██╗████╗ ████║████╗ ████║██╔══██╗████╗  ██║██╔══██╗
██║     ██║   ██║██╔████╔██║██╔████╔██║███████║██╔██╗ ██║██║  ██║
██║     ██║   ██║██║╚██╔╝██║██║╚██╔╝██║██╔══██║██║╚██╗██║██║  ██║
╚██████╗╚██████╔╝██║ ╚═╝ ██║██║ ╚═╝ ██║██║  ██║██║ ╚████║██████╔╝
 ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝ 
                    ██████╗ ███████╗ ██████╗██╗  ██╗              
                    ██╔══██╗██╔════╝██╔════╝██║ ██╔╝              
                    ██║  ██║█████╗  ██║     █████╔╝               
                    ██║  ██║██╔══╝  ██║     ██╔═██╗               
                    ██████╔╝███████╗╚██████╗██║  ██╗              
                    ╚═════╝ ╚══════╝ ╚═════╝╚═╝  ╚═╝              
```

**Fecha:** 2026-01-12  
**Prerrequisito:** WAVE 374 - MasterArbiter Integration ✅  
**Estado:** BLUEPRINT FINAL - Pendiente aprobación para ejecución

---

## 🎯 DECISIONES ARQUITECTÓNICAS CERRADAS

| Pregunta | Decisión | Razón |
|----------|----------|-------|
| Zen Mode toggle | TitleBar izquierda `[⛶]` | Acceso rápido sin perder viewport |
| Sidebar colapsado | **0px TOTAL** | Máximo espacio en live show |
| Command Deck altura | **140px** | Botones grandes para dedos gordos |
| Quick Actions en Deck | Strobe, Blinder, Smoke + Blackout | Solo efectos **GLOBALES** |
| Beam/Prism/Laser/Rainbow | → THE PROGRAMMER | Son **fixture-specific** |
| Master Dimmer | **GRAND MASTER** (todos los fixtures) | "Volumen" general de luz |
| XY Pad | **MANTENER** | Estándar oro para apuntar movers |
| Radar | Centro de gravedad + Fan grupal | Distribución de formaciones |
| Patterns (Circle, Eight) | **Arbiter genera frames** | Suavidad 60fps sin IPC lag |
| Scenes Tab | Placeholder "Coming Soon" | Reservado para Timecoder |

---

## 📐 LAYOUT GLOBAL: ZEN MODE

### Estado Normal (Sidebar visible)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [⛶] LUXSYNC - Show Name                                    [─] [□] [×]     │ 32px
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ┌────────┬──────────────────────────────────────────────────────────────┐   │
│ │        │                                                               │   │
│ │  NAV   │                      VIEWPORT                                 │   │
│ │ (64px) │                    (Stage Canvas)                             │   │
│ │        │                                                               │   │
│ │  🎵    │   ┌─────────────────────────────────────────────────────┐    │   │
│ │ Audio  │   │                                                      │    │   │
│ │        │   │                                                      │    │   │
│ │  🎚️    │   │              2D / 3D Visualization                   │    │   │
│ │ Setup  │   │                                                      │    │   │
│ │        │   │                                                      │    │   │
│ │  💾    │   │                                                      │    │   │
│ │ Scenes │   └─────────────────────────────────────────────────────┘    │   │
│ │        │                                                               │   │
│ └────────┴──────────────────────────────────────────────────────────────┘   │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                        🎛️ THE COMMAND DECK (140px)                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ZEN MODE Activado (F11 / Z)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [⛶] LUXSYNC - Show Name                                    [─] [□] [×]     │ 32px
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ┌───────────────────────────────────────────────────────────────────────┐   │
│ │                                                                        │   │
│ │                                                                        │   │
│ │                                                                        │   │
│ │                         VIEWPORT MAXIMIZADO                            │   │
│ │                                                                        │   │
│ │                     (Sidebar = 0px, TODO para el show)                 │   │
│ │                                                                        │   │
│ │                                                                        │   │
│ │                                                                        │   │
│ │                                                                        │   │
│ └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                        🎛️ THE COMMAND DECK (140px)                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Implementación:**
```typescript
// MainLayout.tsx
const [isZenMode, setIsZenMode] = useState(false)

// Keyboard shortcut
useEffect(() => {
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'F11' || e.key === 'z' || e.key === 'Z') {
      if (e.target === document.body) {
        e.preventDefault()
        setIsZenMode(prev => !prev)
      }
    }
  }
  window.addEventListener('keydown', handleKey)
  return () => window.removeEventListener('keydown', handleKey)
}, [])

// Layout
<div className="main-layout">
  {!isZenMode && <Sidebar />}  {/* 0px cuando Zen */}
  <div className="viewport-area">...</div>
</div>
```

---

## 🎛️ PARTE 1: THE COMMAND DECK (Bottom Bar - 140px)

### Layout Interno
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           THE COMMAND DECK                                   │
│                                                                              │
│  ┌─────────────┐  ┌─────────────────────────────┐  ┌────────┐  ┌──────────┐ │
│  │   LAYER     │  │      QUICK ACTIONS          │  │ STATUS │  │ BLACKOUT │ │
│  │  INDICATOR  │  │                             │  │  BAR   │  │  MASTER  │ │
│  │             │  │  [⚡]  [☀️]  [💨]            │  │        │  │          │ │
│  │  🤖 AI      │  │ STROBE BLIND SMOKE          │  │BPM:128 │  │    ■     │ │
│  │  ────────   │  │   1     2     3             │  │████░ 72│  │ BLACKOUT │ │
│  │  🎚️ MANUAL  │  │                             │  │        │  │ [SPACE]  │ │
│  │             │  │       🎚️ GRAND MASTER       │  │        │  │          │ │
│  │ [KILL ALL]  │  │  ├────────────●───────────┤ │  │        │  │          │ │
│  └─────────────┘  └─────────────────────────────┘  └────────┘  └──────────┘ │
│                                                                              │
│     ~120px            ~400px (flexible)            ~200px       ~140px      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 LAYER INDICATOR (Izquierda)
```
┌─────────────────┐
│  CONTROL SOURCE │
│  ─────────────  │
│                 │
│  ┌───────────┐  │
│  │ 🤖  AI    │ ← Iluminado cuando Layer0 manda
│  └───────────┘  │
│        │        │
│  ┌───────────┐  │
│  │ 🎚️ MANUAL │ ← Iluminado cuando hay overrides en Layer1
│  └───────────┘  │
│                 │
│  ┌───────────┐  │
│  │ KILL ALL  │ ← Libera TODOS los overrides manuales
│  │    [ESC]  │   (el botón del pánico suave)
│  └───────────┘  │
└─────────────────┘
```

**Lógica:**
```typescript
// Consultar estado del arbiter cada 100ms o via eventos
const status = await window.electron.invoke('lux:arbiter:status')

// status.activeOverrides: Map<fixtureId, Set<channel>>
const hasManualOverrides = status.activeOverrides.size > 0

// Visual:
// - AI: Glow verde cuando NO hay overrides
// - MANUAL: Glow magenta cuando SÍ hay overrides
// - Ambos pueden estar activos (AI en algunos fixtures, Manual en otros)
```

### 1.2 QUICK ACTIONS (Centro)

**Solo efectos GLOBALES que afectan toda la sala:**

```
┌────────────────────────────────────────────────────────────┐
│                      QUICK ACTIONS                          │
│                                                             │
│    ┌──────────┐   ┌──────────┐   ┌──────────┐              │
│    │    ⚡    │   │    ☀️    │   │    💨    │              │
│    │  STROBE  │   │  BLINDER │   │   SMOKE  │              │
│    │    [1]   │   │    [2]   │   │    [3]   │              │
│    └──────────┘   └──────────┘   └──────────┘              │
│                                                             │
│    ──────────────── GRAND MASTER ────────────────          │
│    0% ├────────────────────●─────────────────┤ 100%        │
│                           75%                               │
└────────────────────────────────────────────────────────────┘
```

**Especificaciones:**
- **Tamaño botones:** 60x60px mínimo
- **Feedback visual:** Glow del color del efecto cuando activo
- **Comportamiento:** Toggle (click ON, click OFF)
- **Strobe/Blinder:** Auto-off después de 3 segundos (seguridad)

**GRAND MASTER:**
- Slider horizontal grande
- Controla dimmer de TODOS los fixtures
- Si está a 0%, nada brilla (ni AI ni Manual)
- Valor por defecto: 100%

**IPC:**
```typescript
// Quick Actions
await window.electron.invoke('lux:effects:trigger', { 
  effect: 'strobe', 
  duration: 3000 
})

// Grand Master
await window.electron.invoke('lux:arbiter:setGrandMaster', { 
  value: 0.75  // 0-1
})
```

### 1.3 STATUS BAR (Centro-Derecha)

```
┌────────────────────┐
│    STATUS          │
│    ──────          │
│                    │
│   BPM: 128  ●      │ ← Punto pulsa con el beat
│                    │
│   ENERGY           │
│   ████████░░ 78%   │ ← Barra de energía de audio
│                    │
│   🔥 FIRE          │ ← Mood actual (emoji + label)
│                    │
└────────────────────┘
```

**Datos:**
- BPM: `truthStore.sensory.beat.bpm`
- Energy: `truthStore.sensory.audio.energy`
- Mood: Derivado de energy (CHILL < 0.4 < VIBE < 0.7 < FIRE)

### 1.4 BLACKOUT MASTER (Derecha - AISLADO)

```
┌──────────────────────┐
│                      │
│         ■            │  ← Icono cuadrado grande
│                      │
│      BLACKOUT        │
│                      │
│      [SPACE]         │  ← Shortcut siempre visible
│                      │
└──────────────────────┘
```

**Especificaciones:**
- **Tamaño:** 120x100px mínimo (ENORME)
- **Color idle:** Rojo oscuro (#330000)
- **Color activo:** Rojo brillante (#FF0000) con glow pulsante
- **Posición:** Extremo derecho, AISLADO del resto
- **Atajo:** SPACE (funciona SIEMPRE, en cualquier contexto)

**IPC:**
```typescript
await window.electron.invoke('lux:arbiter:blackout', true)  // ON
await window.electron.invoke('lux:arbiter:blackout', false) // OFF
```

---

## 🔧 PARTE 2: THE PROGRAMMER (Panel Derecho Contextual)

> **Aparece SOLO cuando hay fixtures seleccionados**

### Layout General
```
┌─────────────────────────────────────────┐
│  THE PROGRAMMER              [×] Close  │ ← Header con contador
│  ─────────────────────────────────────  │
│  SELECTION: 4 Movers  [SELECT ALL]      │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ ▼ INTENSITY                    [↺] ││ ← Acordeón expandible
│  │   ├────────────●───────────────┤   ││    + botón RELEASE
│  │   0%          65%            100%   ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ ▼ COLOR                        [↺] ││
│  │   [Color Picker HSV]               ││
│  │   ┌─────────────────────────────┐  ││
│  │   │      Color Wheel            │  ││
│  │   └─────────────────────────────┘  ││
│  │   PALETTES:                        ││
│  │   [🔥Fire] [❄️Ice] [🌈RGB] [🌅Sun] ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ ▼ POSITION                     [↺] ││
│  │                                     ││
│  │   ┌─────────────────────────────┐  ││
│  │   │      XY PAD (Absoluto)      │  ││
│  │   │          ●                  │  ││
│  │   │    Pan: 270°  Tilt: 45°     │  ││
│  │   └─────────────────────────────┘  ││
│  │   [CENTER]                         ││
│  │                                     ││
│  │   PATTERNS:                        ││
│  │   ○ Static  ● Circle  ○ Eight      ││
│  │   Speed: ├────●───────────────┤    ││
│  │   Size:  ├──────────●─────────┤    ││
│  │                                     ││
│  │   ──────── RADAR (Grupo) ────────  ││
│  │   ┌─────────────────────────────┐  ││
│  │   │    ·    ·    ●    ·    ·    │  ││
│  │   │       Centro + Fan          │  ││
│  │   └─────────────────────────────┘  ││
│  │   Fan: ├────────●─────────────┤    ││
│  │                                     ││
│  │   PRECISION:                       ││
│  │   Pan:  [  270  ]°                 ││
│  │   Tilt: [   45  ]°                 ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ ▼ BEAM                         [↺] ││
│  │   Gobo:  ├──●─────────────────┤ 2  ││
│  │   Prism: [ON] Rot: ├────●─────┤    ││
│  │   Focus: ├────────────●───────┤ 75%││
│  │   Zoom:  ├──────●─────────────┤ 40%││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ ▶ SCENES                           ││ ← Colapsado por defecto
│  │   "Coming Soon: Timecoder"         ││
│  └─────────────────────────────────────┘│
│                                         │
│  ─────────────────────────────────────  │
│  [🔓 RELEASE ALL]        [📌 LOCK]     │
│                                         │
└─────────────────────────────────────────┘
```

### 2.1 INTENSITY Section

```typescript
interface IntensityPayload {
  fixtureIds: number[]
  values: { dimmer: number }  // 0-255
  channels: ['dimmer']
}

// Al mover slider:
await window.electron.invoke('lux:arbiter:setManual', {
  fixtureIds: selectedFixtures,
  values: { dimmer: Math.round(sliderValue * 255) },
  channels: ['dimmer']
})

// Al hacer click en [↺] Release:
await window.electron.invoke('lux:arbiter:clearManual', {
  fixtureIds: selectedFixtures,
  channels: ['dimmer']
})
```

### 2.2 COLOR Section

**Componentes:**
1. **Color Picker HSV:** Wheel + Saturation/Value sliders
2. **Palette Buttons:** Presets rápidos

```typescript
// Al cambiar color:
await window.electron.invoke('lux:arbiter:setManual', {
  fixtureIds: selectedFixtures,
  values: { 
    red: r,      // 0-255
    green: g,    // 0-255
    blue: b,     // 0-255
    // white: w  // Si el fixture lo soporta
  },
  channels: ['red', 'green', 'blue']
})

// Palettes predefinidas:
const PALETTES = {
  fire:    { red: 255, green: 60, blue: 0 },
  ice:     { red: 0, green: 180, blue: 255 },
  rgb:     { /* cycling - pattern */ },
  sunset:  { red: 255, green: 100, blue: 50 },
}
```

### 2.3 POSITION Section (LA IMPORTANTE)

**Tres niveles de control:**

#### A) XY PAD - El Francotirador
```
┌─────────────────────────────┐
│  ·   ·   ·   ·   ·   ·   · │
│  ·   ·   ·   ·   ·   ·   · │
│  ·   ·   ·   ●   ·   ·   · │  ← Bolita arrastrable
│  ·   ·   ·   ·   ·   ·   · │
│  ·   ·   ·   ·   ·   ·   · │
└─────────────────────────────┘
   Pan: 270°     Tilt: 45°
         [CENTER]
```

**Comportamiento:**
- **1 fixture seleccionado:** Mueve ese fixture directamente
- **N fixtures seleccionados:** Mueve TODOS al mismo punto (unísono)
- Rango: Pan 0-540°, Tilt 0-270°

```typescript
// Al arrastrar:
await window.electron.invoke('lux:arbiter:setManual', {
  fixtureIds: selectedFixtures,
  values: { 
    pan: panValue,    // 0-65535 (16-bit)
    tilt: tiltValue   // 0-65535 (16-bit)
  },
  channels: ['pan', 'tilt']
})
```

#### B) PATTERNS - Movimiento Procedural
```
PATTERNS:
○ Static   ● Circle   ○ Eight   ○ Sweep

Speed: ├────────●───────────────┤ 0.5
Size:  ├──────────────●─────────┤ 0.8
```

**Implementación en Arbiter:**
```typescript
// El Arbiter EXTIENDE su Layer1 para soportar patterns
interface ManualOverride {
  values: Record<string, number>
  channels: string[]
  // NUEVO:
  pattern?: {
    type: 'circle' | 'eight' | 'sweep'
    speed: number   // 0-1
    size: number    // 0-1
    center: { pan: number, tilt: number }
  }
}

// Cuando hay pattern activo, el Arbiter calcula frame a frame:
if (override.pattern) {
  const phase = (Date.now() * override.pattern.speed) % (2 * Math.PI)
  const offset = calculatePatternOffset(override.pattern, phase)
  values.pan = override.pattern.center.pan + offset.pan
  values.tilt = override.pattern.center.tilt + offset.tilt
}
```

**IPC:**
```typescript
await window.electron.invoke('lux:arbiter:setManual', {
  fixtureIds: selectedFixtures,
  pattern: {
    type: 'circle',
    speed: 0.5,
    size: 0.8,
    center: { pan: currentPan, tilt: currentTilt }
  },
  channels: ['pan', 'tilt']
})
```

#### C) RADAR - El Comandante de Grupos
```
┌─────────────────────────────┐
│      ·         ·            │
│          ●                  │ ← Centro del grupo
│    ·           ·            │
│        ·   ·                │ ← Puntos = fixtures del grupo
└─────────────────────────────┘
   Fan: ├────────●─────────┤
         0%     60%     100%
```

**Comportamiento:**
- Mueve el "centro de gravedad" de la formación
- **Fan slider:** Expande/contrae la distribución espacial
- Los fixtures mantienen su posición RELATIVA entre sí

```typescript
// Radar mueve el centro, cada fixture calcula su offset
await window.electron.invoke('lux:arbiter:setGroupCenter', {
  fixtureIds: selectedFixtures,
  center: { pan: centerPan, tilt: centerTilt },
  fan: fanValue  // 0-1, multiplica los offsets individuales
})
```

#### D) PRECISION SLIDERS - El Cirujano
```
PRECISION:
Pan:  [  270  ]°   ← Input numérico editable
Tilt: [   45  ]°   ← Para valores exactos
```

### 2.4 BEAM Section (NUEVO)

```
┌─────────────────────────────────────┐
│ ▼ BEAM                         [↺] │
│                                     │
│   Gobo:   ├──●─────────────────┤    │
│           0  2              7       │  ← Slider con steps
│                                     │
│   Prism:  [ON]  Rotation:           │
│           ├────────●───────────┤    │
│           0%              100%      │
│                                     │
│   Focus:  ├────────────●───────┤    │
│           Near    75%      Far      │
│                                     │
│   Zoom:   ├──────●─────────────┤    │
│           Spot   40%      Flood     │
│                                     │
└─────────────────────────────────────┘
```

**Canales:**
```typescript
await window.electron.invoke('lux:arbiter:setManual', {
  fixtureIds: selectedFixtures,
  values: { 
    gobo: goboIndex * 32,        // 0-255 (8 gobos = 32 cada uno)
    prism: prismActive ? 255 : 0,
    prismRotation: rotation,     // 0-255
    focus: focusValue,           // 0-255
    zoom: zoomValue              // 0-255
  },
  channels: ['gobo', 'prism', 'prismRotation', 'focus', 'zoom']
})
```

### 2.5 SCENES Tab (Placeholder)

```
┌─────────────────────────────────────┐
│ ▶ SCENES                           │
│                                     │
│   ┌─────────────────────────────┐  │
│   │                             │  │
│   │    🎬 COMING SOON           │  │
│   │                             │  │
│   │    Timecoder & Scene        │  │
│   │    Recorder                 │  │
│   │                             │  │
│   │    WAVE 380+                │  │
│   │                             │  │
│   └─────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

---

## ⌨️ KEYBOARD SHORTCUTS

| Tecla | Acción | Contexto |
|-------|--------|----------|
| `SPACE` | Toggle Blackout | **SIEMPRE** funciona |
| `ESC` | Release All Manual | Global - pánico suave |
| `1` | Toggle Strobe | Command Deck |
| `2` | Toggle Blinder | Command Deck |
| `3` | Toggle Smoke | Command Deck |
| `F11` o `Z` | Toggle Zen Mode | Global |
| `TAB` | Siguiente sección Programmer | Cuando Programmer abierto |
| `Shift+TAB` | Sección anterior | Cuando Programmer abierto |
| `C` | Abrir/Cerrar COLOR | Quick access |
| `P` | Abrir/Cerrar POSITION | Quick access |
| `B` | Abrir/Cerrar BEAM | Quick access |

---

## 🔌 EXTENSIONES AL ARBITER

### Nuevos IPC Handlers necesarios:

```typescript
// handlers/arbiterHandlers.ts - EXTENSIONES

// 1. Grand Master (nuevo)
ipcMain.handle('lux:arbiter:setGrandMaster', async (_, { value }) => {
  masterArbiter.setGrandMaster(value)  // 0-1, multiplica TODO
})

// 2. Pattern support (extensión de setManual)
ipcMain.handle('lux:arbiter:setManual', async (_, payload) => {
  // payload puede incluir .pattern para movimiento procedural
  if (payload.pattern) {
    masterArbiter.setPatternOverride(payload.fixtureIds, payload.pattern)
  } else {
    masterArbiter.setManualOverride(payload.fixtureIds, payload.values, payload.channels)
  }
})

// 3. Group center (nuevo)
ipcMain.handle('lux:arbiter:setGroupCenter', async (_, { fixtureIds, center, fan }) => {
  masterArbiter.setGroupFormation(fixtureIds, center, fan)
})

// 4. Status extendido
ipcMain.handle('lux:arbiter:status', async () => {
  return {
    blackout: masterArbiter.isBlackout(),
    grandMaster: masterArbiter.getGrandMaster(),
    activeOverrides: masterArbiter.getActiveOverrides(),
    activePatterns: masterArbiter.getActivePatterns()
  }
})
```

### MasterArbiter - Extensiones:

```typescript
class MasterArbiter {
  private grandMaster: number = 1.0
  private patterns: Map<number, PatternConfig> = new Map()
  
  setGrandMaster(value: number) {
    this.grandMaster = Math.max(0, Math.min(1, value))
  }
  
  setPatternOverride(fixtureIds: number[], pattern: PatternConfig) {
    for (const id of fixtureIds) {
      this.patterns.set(id, pattern)
      // Los patterns también son overrides de Layer1
      this.layer1.set(id, { 
        channels: new Set(['pan', 'tilt']),
        pattern 
      })
    }
  }
  
  // En el loop de merge (60fps):
  private calculatePatternValues(fixtureId: number, phase: number): Partial<FixtureValues> {
    const pattern = this.patterns.get(fixtureId)
    if (!pattern) return {}
    
    const amplitude = pattern.size * 0.3  // 30% max swing
    let panOffset = 0, tiltOffset = 0
    
    switch (pattern.type) {
      case 'circle':
        panOffset = Math.cos(phase) * amplitude
        tiltOffset = Math.sin(phase) * amplitude
        break
      case 'eight':
        panOffset = Math.sin(phase) * amplitude
        tiltOffset = Math.sin(phase * 2) * amplitude * 0.5
        break
      case 'sweep':
        panOffset = Math.sin(phase) * amplitude
        tiltOffset = 0
        break
    }
    
    return {
      pan: pattern.center.pan + panOffset * 65535,
      tilt: pattern.center.tilt + tiltOffset * 65535
    }
  }
}
```

---

## 📋 PLAN DE EJECUCIÓN (Fases)

### **FASE 1: Layout & Zen Mode**
1. Modificar `MainLayout.tsx` - añadir estado `isZenMode`
2. Modificar `TitleBar.tsx` - añadir botón toggle `[⛶]`
3. CSS para transición suave de sidebar
4. Keyboard listener para F11/Z

### **FASE 2: Command Deck**
1. Crear `CommandDeck.tsx` (reemplaza GlobalEffectsBar)
2. Crear `LayerIndicator.tsx`
3. Crear `QuickActions.tsx` (Strobe, Blinder, Smoke)
4. Crear `StatusBar.tsx` (BPM, Energy, Mood)
5. Crear `BlackoutButton.tsx` (el grande)
6. Crear `GrandMasterSlider.tsx`
7. CSS cyberpunk con glows

### **FASE 3: The Programmer - Básico**
1. Crear `TheProgrammer.tsx` (contenedor acordeón)
2. Crear `IntensitySection.tsx`
3. Crear `ColorSection.tsx` (picker + palettes)
4. Conectar a Arbiter via IPC
5. Botones RELEASE por sección

### **FASE 4: The Programmer - Position**
1. Refactorizar `PanTiltControl.tsx` → `XYPad.tsx`
2. Crear `PatternSelector.tsx`
3. Crear `GroupRadar.tsx` (rescatar visual de MovementRadar)
4. Crear `PrecisionInputs.tsx`
5. Conectar patterns al Arbiter

### **FASE 5: The Programmer - Beam**
1. Crear `BeamSection.tsx`
2. Gobo slider con steps
3. Prism toggle + rotation
4. Focus/Zoom sliders

### **FASE 6: Arbiter Extensions**
1. Implementar `grandMaster` en MasterArbiter
2. Implementar pattern calculation loop
3. Nuevos IPC handlers
4. Tests E2E para patterns

### **FASE 7: Cleanup**
1. Eliminar archivos obsoletos (Blackout.tsx, GlobalEffectsBar.tsx, MovementRadar.tsx)
2. Eliminar dependencias de overrideStore en UI
3. Documentación actualizada

---

## 📁 ARCHIVOS FINALES

### **CREAR:**
```
src/components/
├── commandDeck/
│   ├── CommandDeck.tsx
│   ├── CommandDeck.css
│   ├── LayerIndicator.tsx
│   ├── QuickActions.tsx
│   ├── StatusBar.tsx
│   ├── BlackoutButton.tsx
│   └── GrandMasterSlider.tsx
│
├── programmer/
│   ├── TheProgrammer.tsx
│   ├── TheProgrammer.css
│   ├── sections/
│   │   ├── IntensitySection.tsx
│   │   ├── ColorSection.tsx
│   │   ├── PositionSection.tsx
│   │   ├── BeamSection.tsx
│   │   └── ScenesPlaceholder.tsx
│   └── controls/
│       ├── XYPad.tsx
│       ├── GroupRadar.tsx
│       ├── PatternSelector.tsx
│       ├── PaletteButtons.tsx
│       └── PrecisionInputs.tsx
```

### **MODIFICAR:**
```
src/components/layout/
├── MainLayout.tsx      ← Añadir isZenMode
├── TitleBar.tsx        ← Añadir toggle button
└── MainLayout.css      ← Transiciones

src/core/
└── MasterArbiter.ts    ← grandMaster + patterns

src/handlers/
└── arbiterHandlers.ts  ← Nuevos IPC
```

### **ELIMINAR:**
```
src/components/
├── Blackout.tsx                    ← Duplicado
├── layout/GlobalEffectsBar.tsx     ← Reemplazado
├── layout/GlobalEffectsBar.css     
└── views/StageViewDual/sidebar/
    ├── widgets/MovementRadar.tsx   ← Rescatado en GroupRadar
    ├── GlobalControls.tsx          ← Obsoleto
    └── PaletteControlMini.tsx      ← Integrado en ColorSection
```

---

## ✅ CRITERIOS DE ÉXITO

1. **Blackout en <50ms** desde cualquier estado
2. **Zen Mode toggle instantáneo** (sin re-render pesado)
3. **Grand Master afecta TODO** en tiempo real
4. **Patterns a 60fps** sin lag de IPC
5. **Release funciona** con crossfade suave
6. **Zero uso de overrideStore** para controles manuales
7. **Keyboard shortcuts** funcionan en cualquier contexto
8. **UI responsive** en pantallas 1920x1080 hasta 4K

---

## 🚀 LISTO PARA REVISIÓN FINAL

Radwulf, este es el blueprint definitivo. Incluye:

- ✅ Zen Mode (0px total)
- ✅ Command Deck 140px con efectos GLOBALES
- ✅ Quick Actions filtradas (Strobe, Blinder, Smoke)
- ✅ Grand Master que controla TODO
- ✅ XY Pad mantenido (el francotirador)
- ✅ Radar rescatado (el comandante de grupos)
- ✅ Patterns con cálculo en Arbiter (60fps)
- ✅ BEAM section nueva
- ✅ SCENES placeholder
- ✅ Todos los shortcuts definidos
- ✅ Plan de ejecución en 7 fases

**¿Aprobado para ejecución?** 🔥

---

*PunkOpus - El código que respira bajo las luces* 🎛️✨
