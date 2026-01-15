# WAVE 421: USER FLOW & MODE ARCHITECTURE REDESIGN

**Date:** 2026-01-14  
**Status:** ✅ BLUEPRINT COMPLETO  
**Author:** PunkOpus + Radwulf  
**Purpose:** Clarificar modos, vistas, y flujo de usuario ANTES de escribir código

---

## 📚 DOCUMENTOS RELACIONADOS

Este WAVE se dividió en documentos especializados:

| Documento | Propósito |
|-----------|-----------|
| **WAVE-421.1-CURRENT-STATE-AUDIT.md** | Inventario del estado actual |
| **WAVE-421.2-OFFICIAL-BLUEPRINT.md** | Blueprint oficial + Roadmap |

---

---

## 🎯 EL PROBLEMA

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ESTADO ACTUAL = CAOS CONCEPTUAL                                             │
└─────────────────────────────────────────────────────────────────────────────┘

❓ ¿Para qué sirve "Modo Manual" si tocar un control ya activa Layer 2?
❓ ¿Qué es "Modo Flow"? (Código idéntico a Selene)
❓ ¿Cómo se relacionan Dashboard → SimulateView?
❓ ¿Cuándo usar Calibration? ¿Es un modo global o por-fixture?
❓ ¿Qué hace el botón ON/OFF de la app?
❓ ¿Las Vibes son del usuario o de Selene?
```

**Síntomas de diseño confuso:**
- Múltiples selectores de modo (Dashboard + ?)
- Modo Manual existe pero no se usa
- Flow es placebo
- No hay workflow claro para setup → show → teardown

---

## 🧩 MENTAL MODEL PROPUESTO

### Principio Fundamental: **STAGES vs MODES**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGES = Dónde estás en el workflow (Usuario)                               │
│  MODES = Quién controla (Sistema de capas)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

No confundir:
- **Stage** = Dashboard (setup), Calibration (pre-show), Live Show (performance)
- **Mode** = Selene AI, Manual Override, Blackout (estados del MasterArbiter)

---

## 📍 PROPUESTA: 3 STAGES DEL USUARIO

### STAGE 1: 🏠 DASHBOARD (Command Center)
**Estado:** OFF o IDLE  
**Localización:** DashboardView  
**Propósito:** Configuración, preparación, monitoreo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🏠 DASHBOARD VIEW - COMMAND CENTER                                          │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────────┐
  │  [⚡ POWER: OFF]                                                │
  │                                                                │
  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    │
  │  │ 📊 PATCH     │    │ 🎨 PALETTES  │    │ 🎬 SCENES    │    │
  │  │ 12 fixtures  │    │ 4 active     │    │ 8 saved      │    │
  │  └──────────────┘    └──────────────┘    └──────────────┘    │
  │                                                                │
  │  QUICK START:                                                  │
  │  ┌────────────────────────────────────────────────────────┐   │
  │  │ [🎯 CALIBRATE SHOW]  → Pre-show fixture alignment     │   │
  │  │ [🎭 START LIVE SHOW] → Go to performance mode         │   │
  │  │ [⚙️ STAGE CONSTRUCTOR] → Build/edit patch            │   │
  │  └────────────────────────────────────────────────────────┘   │
  │                                                                │
  │  SYSTEM STATUS:                                                │
  │  • Brain: Connected ✅                                         │
  │  • Audio: No signal (waiting)                                  │
  │  • DMX: Ready (ArtNet 10.0.0.1)                                │
  │                                                                │
  └────────────────────────────────────────────────────────────────┘
```

**Qué hace el botón POWER:**
```
OFF → IDLE:
  1. Inicia TitanOrchestrator (vibe='idle', blackout=true)
  2. No genera luz (dimmer=0 para todo)
  3. Permite navegar a Calibration o Live Show
  4. Audio capture activo pero ignorado

IDLE → OFF:
  1. Detiene loop DMX
  2. Desconecta audio
  3. Limpia overrides
```

**Acciones disponibles:**
- ✅ Ver estado del sistema
- ✅ Editar patch (Stage Constructor)
- ✅ Gestionar paletas/scenes
- ✅ Iniciar Calibration
- ✅ Iniciar Live Show
- ❌ NO controla fixtures directamente

---

### STAGE 2: 🎯 CALIBRATION (Pre-Show Setup)
**Estado:** CALIBRATION_MODE  
**Localización:** SimulateView (2D/3D)  
**Propósito:** Ajustar offsets de fixtures antes del show

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🎯 CALIBRATION MODE                                                         │
└─────────────────────────────────────────────────────────────────────────────┘

  [← BACK TO DASHBOARD]          CALIBRATION MODE ACTIVE          [SAVE & EXIT]
  
  ┌────────────────────────────────────────────────────────────────┐
  │  SIMULATE VIEW (2D)                                            │
  │                                                                │
  │      [Movers displayed at 50% white for visibility]           │
  │                                                                │
  │  ┌──────────────────────────────────────────────────────┐     │
  │  │ CALIBRATION PANEL (sidebar)                          │     │
  │  │                                                       │     │
  │  │  Selected: Mover #1 (Beam 2R)                        │     │
  │  │                                                       │     │
  │  │  Pan Offset:  [-30°]═══●═══[+30°]  = +12°           │     │
  │  │  Tilt Offset: [-30°]══●════[+30°]  = -8°            │     │
  │  │                                                       │     │
  │  │  [GO HOME]  [SWEEP PAN]  [SWEEP TILT]                │     │
  │  │                                                       │     │
  │  │  ☑ Invert Pan    ☐ Invert Tilt                       │     │
  │  │                                                       │     │
  │  │  Color Test:                                          │     │
  │  │  [🔴 RED]  [🟢 GREEN]  [🔵 BLUE]  [⚪ WHITE]        │     │
  │  │                                                       │     │
  │  └───────────────────────────────────────────────────────┘     │
  └────────────────────────────────────────────────────────────────┘
```

**Comportamiento del sistema:**
```
MasterArbiter State:
- Layer 4 (Blackout): OFF
- Layer 3 (Effects): OFF
- Layer 2 (Manual): ACTIVE (calibration overrides)
- Layer 1 (Consciousness): OFF
- Layer 0 (Titan AI): vibe='idle' (no movement generation)

Frontend:
- SimulateView visible
- CommandDeck: HIDDEN (no distractions)
- TheProgrammer: REPLACED by CalibrationPanel
- Mode Switcher: HIDDEN (locked in CALIBRATION)

Audio:
- Capture running but ignored
- No vibe changes allowed
- Brain in standby
```

**Workflow:**
```
1. Click fixture en simulador
2. Adjust Pan/Tilt offsets con sliders
3. Test con botones (Home, Sweep, Colors)
4. Repeat para cada fixture
5. SAVE → Persiste offsets en ShowFileV2
6. EXIT → Vuelve a Dashboard o Live Show
```

**Persistencia:**
```typescript
// ShowFileV2.fixtures[].calibration
{
  panOffset: 12,      // degrees
  tiltOffset: -8,     // degrees
  invertPan: false,
  invertTilt: false,
  lastCalibrated: 1705245600000  // timestamp
}
```

---

### STAGE 3: 🎭 LIVE SHOW (Performance)
**Estado:** PERFORMANCE_MODE  
**Localización:** SimulateView (2D/3D)  
**Propósito:** Show en vivo con control AI + manual

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🎭 LIVE SHOW MODE                                                           │
└─────────────────────────────────────────────────────────────────────────────┘

  [🔙 DASHBOARD]    LIVE SHOW    [AI: ACTIVE]    [BPM: 128]    [⚡ ENERGY: 73%]
  
  ┌────────────────────────────────────────────────────────────────┐
  │  SIMULATE VIEW (2D/3D)                                         │
  │                                                                │
  │  [Fixtures reacting to music in real-time]                    │
  │                                                                │
  │  SIDEBAR (collapsible):                                        │
  │  ┌──────────────────────────────────────────────────────┐     │
  │  │ THE PROGRAMMER                                       │     │
  │  │ (Only visible when fixtures selected)                │     │
  │  │                                                       │     │
  │  │  2 Fixtures Selected                                 │     │
  │  │                                                       │     │
  │  │  💡 Intensity  [════●════] 80%  [🔓]                │     │
  │  │  🎨 Color      RGB sliders       [🔓]                │     │
  │  │  🕹️ Position  XY Pad            [🔓]                │     │
  │  │                                                       │     │
  │  └───────────────────────────────────────────────────────┘     │
  │                                                                │
  │  COMMAND DECK (bottom bar):                                    │
  │  ┌──────────────────────────────────────────────────────┐     │
  │  │ [⚡ STROBE] [💡 BLINDER] [💨 SMOKE]                  │     │
  │  │                                                       │     │
  │  │ GRAND MASTER: [════════●══] 90%                       │     │
  │  │                                                       │     │
  │  │ VIBE: [TECHNO] [CHILL] [ROCK] [FIESTA]               │     │
  │  └───────────────────────────────────────────────────────┘     │
  └────────────────────────────────────────────────────────────────┘
```

**Comportamiento del sistema:**
```
MasterArbiter State:
- Layer 4 (Blackout): Toggeable via CommandDeck
- Layer 3 (Effects): Strobe/Blinder/Smoke via CommandDeck
- Layer 2 (Manual): DYNAMIC (se activa al tocar fixture)
- Layer 1 (Consciousness): OFF (no implementado aún)
- Layer 0 (Titan AI): ACTIVE (reacting to music)

Frontend:
- SimulateView visible
- CommandDeck: VISIBLE (quick actions + grand master)
- TheProgrammer: CONDITIONAL (solo si hay selección)
- Mode Switcher: HIDDEN (modo implícito = AI + Manual coexisten)

Audio:
- Capture activo
- Brain analiza → MusicalContext
- TitanEngine genera LightingIntent
- Vibe puede cambiar dinámicamente (o manual via CommandDeck)
```

**Interacción con fixtures:**
```
Tocar fixture en simulador:
  → TheProgrammer aparece
  → Sliders ajustan valores
  → window.lux.arbiter.setManual() → Layer 2 override
  → Fixture responde INMEDIATAMENTE
  → AI sigue controlando el resto

Soltar fixture (Release button):
  → window.lux.arbiter.clearManual()
  → Crossfade suave de vuelta a AI (500ms)
  → Fixture vuelve a reactividad musical
```

---

## 🎛️ PROPUESTA: ELIMINACIÓN DE "MODO MANUAL"

### El Problema

```
CONFUSIÓN ACTUAL:

  Modo Manual (selector) ≠ Manual Override (Layer 2)
  
  Usuario piensa:
  "Si activo Modo Manual, puedo controlar fixtures"
  
  Realidad:
  "Modo Manual" solo desactiva Selene AI globalmente.
  Pero para controlar fixtures, necesitas seleccionarlas de todos modos.
  
  → REDUNDANTE Y CONFUSO
```

### La Solución: **IMPLICIT MODE**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  NO HAY "MODO MANUAL" GLOBAL - HAY OVERRIDES POR-FIXTURE                    │
└─────────────────────────────────────────────────────────────────────────────┘

  Estado por defecto en Live Show:
  • Selene AI controla TODO
  • Audio → Brain → TitanEngine → MasterArbiter → Fixtures
  
  Cuando tocas un fixture:
  • ESE fixture entra en Manual Override (Layer 2)
  • El RESTO sigue con AI
  • No necesitas cambiar "modo" global
  
  Cuando sueltas el fixture:
  • Crossfade suave de vuelta a AI
  • No hay modo "stuck" manual
  
  Si quieres TODO manual:
  • Ctrl+A (select all) → Todos los fixtures seleccionados
  • Ajustas valores → Todos en Layer 2
  • Pero sigues pudiendo soltar individualmente
```

**Ventajas:**
- ✅ No hay confusión "Modo Manual vs Override"
- ✅ Workflow natural: Toca → Ajusta → Suelta
- ✅ Granularidad: Puedes tener 3 fixtures manuales, 9 en AI
- ✅ No necesitas "cambiar de modo" mentalmente

---

## 🎨 PROPUESTA: VIBES = USER CONSTRAINTS

### Problema Actual

```
¿Quién decide la Vibe?
• ¿El usuario (selector manual)?
• ¿Selene AI (detección automática)?
• ¿Ambos? (conflicto)
```

### Solución: **VIBE COMO CONSTRAINT, NO MODO**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  VIBE = Preset de constraints para Selene AI                                │
└─────────────────────────────────────────────────────────────────────────────┘

  El usuario dice:
  "Hoy es un show de TECHNO"
  
  Sistema interpreta:
  • Movement: Rápido, preciso, mecánico
  • Color: Monocromático, contraste alto
  • Reactivity: Beats fuertes (kick/snare)
  • Effects: Strobe probable, poca suavidad
  
  Selene AI opera DENTRO de esos constraints:
  • Sigue detectando BPM, energy, secciones
  • Pero respeta la "vibra" que el usuario eligió
  • No cambia a Chill automáticamente aunque la música baje
```

**En CommandDeck:**
```
┌────────────────────────────────────────────────────────────┐
│ VIBE CONSTRAINT (User Choice)                              │
│                                                            │
│  [TECHNO] [CHILL] [ROCK] [FIESTA] [AUTO]                  │
│     ●                                                      │
│                                                            │
│  AUTO = Selene cambia vibe según música (experimental)    │
│  Manual = Usuario elige y se mantiene                     │
└────────────────────────────────────────────────────────────┘
```

---

## 🗺️ USER JOURNEY MAP

### Escenario: Setup de Show en Discoteca

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  18:00 - LLEGADA AL VENUE                                                    │
└─────────────────────────────────────────────────────────────────────────────┘

1. Abrir LuxSync
   └→ Dashboard View
   
2. Verificar Patch
   └→ Stage Constructor
   └→ 12 fixtures detectados ✅
   
3. [⚡ POWER: ON]
   └→ Sistema en IDLE (blackout)
   └→ DMX activo pero dimmer=0
   
4. Click [🎯 CALIBRATE SHOW]
   └→ STAGE 2: Calibration Mode
   └→ SimulateView + CalibrationPanel
   
5. Para cada mover:
   └→ Click fixture
   └→ Ajustar Pan/Tilt offset
   └→ Test colors (White, Red, Blue)
   └→ Save
   
6. [SAVE & EXIT CALIBRATION]
   └→ Offsets persisten en ShowFileV2
   └→ Vuelve a Dashboard

┌─────────────────────────────────────────────────────────────────────────────┐
│  23:00 - INICIO DEL SHOW                                                     │
└─────────────────────────────────────────────────────────────────────────────┘

7. Click [🎭 START LIVE SHOW]
   └→ STAGE 3: Performance Mode
   └→ SimulateView + CommandDeck
   └→ Selene AI activo
   └→ Audio capture ON
   
8. Elegir Vibe del show
   └→ Click [TECHNO] en CommandDeck
   └→ Constraints aplicados
   
9. Durante el show:
   
   • Música suena → Fixtures reaccionan automáticamente ✅
   
   • Quiero ajustar Mover #3:
     └→ Click Mover #3 en simulador
     └→ TheProgrammer aparece
     └→ Ajustar Position (XY Pad)
     └→ Fixture obedece inmediatamente
     └→ Resto sigue con AI
     └→ Click [🔓 Release] → Mover vuelve a AI
   
   • Quiero strobe en drop:
     └→ Click [⚡ STROBE] en CommandDeck
     └→ Strobe se activa (Layer 3 > Layer 0)
     └→ Click de nuevo para desactivar
   
   • DJ cambia a ambient track:
     └→ Click [CHILL] vibe
     └→ Movimiento se suaviza
     └→ Colores más cálidos
   
   • Emergencia (fire alarm):
     └→ Click [🚨 BLACKOUT]
     └→ TODO a dimmer=0 instantáneo
     └→ Layer 4 = highest priority

┌─────────────────────────────────────────────────────────────────────────────┐
│  03:00 - FIN DEL SHOW                                                        │
└─────────────────────────────────────────────────────────────────────────────┘

10. Click [🔙 DASHBOARD]
    └→ Vuelve a Command Center
    └→ Audio capture sigue activo (idle)
    
11. [⚡ POWER: OFF]
    └→ Detiene sistema
    └→ Blackout
    └→ Cierra app
```

---

## 📐 ARQUITECTURA PROPUESTA: STATE MACHINE

```typescript
/**
 * Application Stage (User Journey)
 */
type AppStage = 
  | 'dashboard'      // Command Center, system OFF or IDLE
  | 'calibration'    // Pre-show fixture alignment
  | 'performance'    // Live show with AI + manual

/**
 * System Power State
 */
type PowerState =
  | 'off'            // System not running
  | 'idle'           // System ON but blackout (vibe='idle')
  | 'active'         // System ON and generating output

/**
 * NO MÁS "MODE GLOBAL" - Solo estados del Arbiter por-fixture
 */
interface ArbiterState {
  blackout: boolean                           // Layer 4
  activeEffects: EffectType[]                // Layer 3
  manualOverrides: Map<string, ManualState>  // Layer 2
  // No hay "modo" global - AI siempre activo si no hay override
}

/**
 * Vibe = Constraint preset, no modo
 */
type VibeConstraint = 'techno' | 'chill' | 'rock' | 'fiesta' | 'auto'
```

---

## 🎨 PROPUESTA: UI REORGANIZATION

### Dashboard View (Command Center)
```typescript
// Dashboard.tsx
- Power toggle (OFF/IDLE)
- System status cards (Patch, Palettes, Scenes)
- Quick actions:
  [🎯 CALIBRATE SHOW]
  [🎭 START LIVE SHOW]
  [⚙️ STAGE CONSTRUCTOR]
```

### Calibration Mode (Pre-Show)
```typescript
// CalibrationView.tsx (new)
- SimulateView (2D/3D)
- CalibrationPanel (sidebar):
  - Fixture selector
  - Pan/Tilt offset sliders
  - Test buttons (Home, Sweep, Colors)
  - Invert checkboxes
  - Save button
- NO CommandDeck
- NO TheProgrammer
- NO Mode Switcher
```

### Performance Mode (Live Show)
```typescript
// PerformanceView.tsx (enhanced SimulateView)
- SimulateView (2D/3D)
- CommandDeck (bottom bar):
  - Effect buttons (Strobe, Blinder, Smoke)
  - Grand Master slider
  - Vibe constraint selector
  - Blackout emergency
- TheProgrammer (conditional sidebar):
  - Only visible when fixtures selected
  - Intensity, Color, Position sections
  - Release button per section
- NO Mode Switcher (implicit mode)
```

---

## 🔧 MIGRATION PLAN

### Phase 1: Cleanup (1 hora)
- ❌ Delete `ModeSwitcher.tsx`
- ❌ Remove `GlobalMode` type
- ❌ Remove `SeleneMode` type
- ❌ Remove all "flow" references

### Phase 2: Stage System (2 horas)
- ✅ Create `AppStage` type
- ✅ Create `useAppStage` hook
- ✅ Update routing based on stage

### Phase 3: Calibration Mode (4 horas)
- ✅ Create `CalibrationPanel.tsx`
- ✅ Integrate with MasterArbiter
- ✅ Persist offsets in ShowFileV2

### Phase 4: Dashboard Redesign (3 horas)
- ✅ Power toggle logic
- ✅ Quick action buttons
- ✅ Status cards

### Phase 5: Vibe as Constraint (2 horas)
- ✅ Update TitanEngine to respect vibe constraint
- ✅ Add Vibe selector to CommandDeck
- ✅ Document vibe → constraint mapping

---

## 📊 DECISION MATRIX

| Pregunta | Respuesta |
|----------|-----------|
| ¿Modo Manual existe? | **NO** - Solo overrides por-fixture (Layer 2) |
| ¿Modo Flow existe? | **NO** - Era placebo, eliminar |
| ¿Cómo controlo fixtures? | Seleccionar en simulador → TheProgrammer aparece |
| ¿Cómo vuelvo a AI? | Click Release button → Crossfade automático |
| ¿Qué es Vibe? | Preset de constraints, no modo |
| ¿Puedo cambiar Vibe mid-show? | **SÍ** - Click botón en CommandDeck |
| ¿Qué hace botón Power? | OFF ↔ IDLE (blackout pero sistema activo) |
| ¿Cuándo uso Calibration? | Pre-show, ajustar offsets de fixtures |
| ¿Calibration persiste? | **SÍ** - Guardado en ShowFileV2 |

---

## 🎯 NEXT STEPS

### Para TI (Arquitecto):
1. **Review este documento** - ¿Tiene sentido el mental model?
2. **Ajustar conceptos** si algo no encaja con tu visión
3. **Aprobar diseño** antes de que yo escriba código

### Para MÍ (Ejecutor):
1. Esperar tu feedback
2. Si apruebas → Crear WAVEs específicos:
   - WAVE 422: Mode Cleanup (kill Flow, ModeSwitcher)
   - WAVE 423: Stage System (AppStage state machine)
   - WAVE 424: Calibration Mode (full implementation)
   - WAVE 425: Dashboard Redesign

---

**WAVE 421 Status:** 🧠 AWAITING ARCHITECT REVIEW

*"Diseñar antes de codear = menos regresiones después."* 🔧
