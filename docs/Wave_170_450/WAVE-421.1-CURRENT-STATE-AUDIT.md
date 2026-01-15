# WAVE 421.1: AUDITORÍA DEL ESTADO ACTUAL

**Date:** 2026-01-14  
**Status:** 📋 AUDIT COMPLETE  
**Purpose:** Inventario completo de vistas, componentes y flujos ANTES del rediseño

---

## 🗂️ INVENTARIO DE VISTAS (5 TABS)

### Estado Actual: Sidebar Navigation

```typescript
// navigationStore.ts - TABS actuales
export const TABS: TabConfig[] = [
  { id: 'live',        label: 'COMMAND',    icon: 'activity' },     // Alt+1
  { id: 'simulate',    label: 'LUX STAGE',  icon: 'monitor' },      // Alt+2
  { id: 'constructor', label: 'CONSTRUCT',  icon: 'pencil-ruler' }, // Alt+3
  { id: 'core',        label: 'LUX CORE',   icon: 'brain' },        // Alt+4
  { id: 'setup',       label: 'SETUP',      icon: 'settings' },     // Alt+5
]
```

### Mapa Visual de Tabs

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LUXSYNC SIDEBAR - 5 TABS                                                    │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐
  │ 🌙 ✨    │
  │ LUXSYNC  │
  │ v1.0     │
  ├──────────┤
  │          │
  │ 📊       │ ← TAB 1: COMMAND (DashboardView)
  │ COMMAND  │   Dashboard, Power, Vibes, Mode Switcher
  │          │
  │ 🖥️       │ ← TAB 2: LUX STAGE (SimulateView)
  │ LUX STAGE│   Simulador 2D/3D + CommandDeck + TheProgrammer
  │          │
  │ 📐       │ ← TAB 3: CONSTRUCT (StageConstructorView)
  │ CONSTRUCT│   Editor de patch, posiciones de fixtures
  │          │
  │ 🧠       │ ← TAB 4: LUX CORE (LuxCoreView)
  │ LUX CORE │   Monitorización de Selene AI, telemetría
  │          │
  │ ⚙️       │ ← TAB 5: SETUP (SetupView)
  │ SETUP    │   Configuración audio, DMX, fixtures
  │          │
  └──────────┘
```

---

## 📍 VISTA 1: COMMAND (Dashboard)

**Archivo:** `src/components/views/DashboardView/index.tsx`

### Layout Actual

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [POWER]  ⚡ COMMAND CENTER                    [MANUAL] [FLOW] [SELENE]      │
├────────────────────────────────────┬────────────────────────────────────────┤
│                                    │  ★ SELENE AI                           │
│                                    │  Confidence: 75%  Mood: PEACEFUL       │
│       🎵 AUDIO CORE                │  Section: buildup                      │
│                                    │  Awaiting system events...             │
│      [AUDIO REACTOR RING]          │                                        │
│          BPM: 193                  ├────────────────────────────────────────┤
│                                    │  🎛️ VIBE CONTEXT                       │
│                                    │  [⚡TECHNO] [🔥LATINO] [🎸ROCK] [🛋️CHILL]│
│                                    │                                        │
├────────────────────────────────────┴────────────────────────────────────────┤
│ BPM:193 | FIXTURES:10 | DMX:ONLINE | RENDER:105fps | AUDIO:18% | UPTIME:35m │
├─────────────────────────────────────────────────────────────────────────────┤
│ [STROBE] [BLINDER] [SMOKE]    GRAND MASTER: ═══════●═══ 100%    [BLACKOUT] │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Componentes Hijos

| Componente | Archivo | Propósito |
|------------|---------|-----------|
| `PowerButton` | `DashboardView/components/PowerButton.tsx` | ON/OFF del sistema |
| `ModeSwitcherSleek` | `DashboardView/components/ModeSwitcherSleek.tsx` | Selector MANUAL/FLOW/SELENE |
| `AudioReactorRing` | `DashboardView/components/AudioReactorRing.tsx` | Visualización de audio |
| `SeleneBrain` | `DashboardView/components/SeleneBrain.tsx` | Logs de Selene AI |
| `VibeSelector` | `DashboardView/components/VibeSelector.tsx` | Botones TECHNO/LATINO/ROCK/CHILL |
| `DataCards` | `DashboardView/components/DataCards.tsx` | Métricas del sistema |

### Problemas Identificados

```
🔴 PROBLEMA 1: ModeSwitcher DUPLICADO
   - Existe aquí: ModeSwitcherSleek.tsx
   - Y también en: components/ModeSwitcher/ModeSwitcher.tsx
   - Hacen lo mismo pero con diferente estilo

🔴 PROBLEMA 2: FLOW = PLACEBO
   - En ModeSwitcherSleek, 'flow' es una opción
   - Pero en el código, flow === selene (useBrain = true)
   - Usuario no sabe que son idénticos

🔴 PROBLEMA 3: VIBES están aquí pero deberían estar en LIVE SHOW
   - El usuario cambia vibe DURANTE el show, no antes
   - Dashboard debería ser setup, no control en vivo

🔴 PROBLEMA 4: CommandDeck en footer DUPLICA funcionalidad
   - Grand Master, Strobe, Blackout están aquí
   - Pero también están en LUX STAGE (SimulateView)
   - Usuario confundido: "¿Dónde controlo?"
```

---

## 📍 VISTA 2: LUX STAGE (SimulateView)

**Archivo:** `src/components/views/SimulateView/index.tsx` (873 líneas)

### Layout Actual

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                        │  │
│  │                     CANVAS 2D (Stage Visualization)                    │  │
│  │                                                                        │  │
│  │   [Fixtures renderizados con halos de color]                          │  │
│  │   [Beams conicos, zonas, grid]                                        │  │
│  │                                                                        │  │
│  │                                                                        │  │
│  │                                               ┌─────────────────────┐  │  │
│  │                                               │  THE PROGRAMMER     │  │  │
│  │                                               │  (sidebar derecho)  │  │  │
│  │                                               │  - Intensity        │  │  │
│  │                                               │  - Color            │  │  │
│  │                                               │  - Position XY      │  │  │
│  │                                               └─────────────────────┘  │  │
│  │                                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  🎛️ THE COMMAND DECK (bottom bar - 140px)                                   │
│  [Layer] | [⚡STROBE][☀️BLINDER][💨SMOKE] | GRAND MASTER | [BPM] [🚨BLACKOUT]│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Componentes Activos

| Componente | Archivo | Status |
|------------|---------|--------|
| `StageSimulator2` | `SimulateView/StageSimulator2.tsx` | ✅ ACTIVO |
| `CommandDeck` | `commandDeck/CommandDeck.tsx` | ✅ ACTIVO |
| `TheProgrammer` | `programmer/TheProgrammer.tsx` | ✅ ACTIVO |
| `InspectorControls` | `programmer/InspectorControls.tsx` | ✅ ACTIVO |

### Archivos Legacy (POSIBLE DEAD CODE)

```
SimulateView/
├── index.tsx              ← 873 líneas, mucho código viejo
├── SimulateView.css
├── SimulateViewPhysics.tsx  ← ¿Legacy?
├── StageSimulator2.tsx      ← ACTIVO (el bueno)
├── Stage3DView.tsx          ← ¿Se usa?
```

### PROBLEMA IDENTIFICADO

```
🟡 SimulateView/index.tsx tiene 873 líneas pero NO se usa directamente

Verificar: ¿Qué archivo renderiza realmente la vista?
```

---

## 📍 VISTA 3: CONSTRUCT (StageConstructor)

**Archivo:** `src/components/views/StageConstructorView.tsx`

### Propósito

Editor visual de patch:
- Drag & drop de fixtures
- Asignar posiciones (x, y)
- Agrupar fixtures por zona
- Configurar canales DMX

### Status

```
🟢 COMPLETO: Funcional para edición de patch
```

---

## 📍 VISTA 4: LUX CORE

**Archivo:** `src/components/views/LuxCoreView/index.tsx`

### Propósito

Centro de monitorización de Selene AI:
- Estado de los workers (ALPHA, BETA, GAMMA)
- Telemetría del sistema
- Logs de debug

### Status

```
🟢 COMPLETO: Para desarrollo/debug
🟡 NOTA: No necesario para usuario final
```

---

## 📍 VISTA 5: SETUP

**Archivo:** `src/components/views/SetupView.tsx`

### Propósito

Configuración técnica:
- Selección de dispositivo de audio
- Configuración ArtNet/DMX
- Importar fixtures

### Status

```
🟢 COMPLETO: Funcional
```

---

## 🎛️ COMPONENTE CLAVE: MODE SWITCHER

### Ubicaciones Actuales (DUPLICADO)

```typescript
// 1. Dashboard - ModeSwitcherSleek
// src/components/views/DashboardView/components/ModeSwitcherSleek.tsx
const MODES: ModeOption[] = [
  { id: 'manual', label: 'MANUAL', icon: '🎚️' },
  { id: 'flow',   label: 'FLOW',   icon: '🌊' },  // ← FLOW = PLACEBO
  { id: 'selene', label: 'SELENE', icon: '🌙' },
]

// 2. Standalone - ModeSwitcher
// src/components/ModeSwitcher/ModeSwitcher.tsx
type SeleneMode = 'flow' | 'selene' | 'locked'  // ← DIFERENTE TIPO!
```

### Problemas

```
🔴 DOS COMPONENTES DIFERENTES para lo mismo
🔴 TIPOS DIFERENTES: GlobalMode vs SeleneMode
🔴 'flow' existe pero no hace nada diferente a 'selene'
🔴 'manual' vs 'locked' - ¿Son lo mismo?
```

---

## 🎨 COMPONENTE CLAVE: VIBE SELECTOR

### Ubicación Actual

```typescript
// src/components/views/DashboardView/components/VibeSelector.tsx
// VIBES: techno, latino, rock, chill
```

### Problema

```
🟡 Las Vibes están en DASHBOARD pero se usan durante LIVE SHOW
🟡 El usuario tiene que volver al Dashboard para cambiar vibe
🟡 El CommandDeck tiene espacio para Vibes pero no las tiene!
```

### Propuesta (de WAVE 421)

```
Mover VibeSelector → CommandDeck (en LUX STAGE)
Dashboard solo para setup, no para control en vivo
```

---

## 🔌 COMPONENTE CLAVE: POWER BUTTON

### Ubicación

```typescript
// src/components/views/DashboardView/components/PowerButton.tsx
// + hooks/useSystemPower.ts
```

### Comportamiento Actual

```
OFF → ONLINE:
  1. Inicia TitanOrchestrator
  2. Comienza audio capture
  3. Activa DMX loop
  4. Aplica vibe actual

ONLINE → OFF:
  1. Detiene todo
  2. Blackout
  3. Libera recursos
```

### Status

```
🟢 FUNCIONA BIEN - No cambiar
```

---

## 📊 STORES RELACIONADOS

### controlStore.ts

```typescript
export type GlobalMode = 'manual' | 'flow' | 'selene' | null
// 'flow' y 'selene' ejecutan el mismo código (useBrain = true)
// 'manual' desactiva el brain pero no controla fixtures directamente
```

### seleneStore.ts

```typescript
export type SeleneMode = 'flow' | 'selene' | 'locked'
// Otro tipo diferente para lo mismo!
```

### navigationStore.ts

```typescript
export type TabId = 'live' | 'simulate' | 'constructor' | 'core' | 'setup'
// OK - No cambiar
```

---

## 🗺️ FLUJO DE USUARIO ACTUAL

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FLUJO ACTUAL (CONFUSO)                                                      │
└─────────────────────────────────────────────────────────────────────────────┘

1. Usuario abre app
   └→ Dashboard (COMMAND)

2. Usuario ve Power OFF
   └→ Click Power ON

3. Usuario quiere elegir Vibe
   └→ Dashboard tiene Vibes ✅

4. Usuario quiere ver simulador
   └→ Click en "LUX STAGE" (sidebar)
   └→ Ahora está en SimulateView

5. Usuario quiere cambiar Vibe durante show
   └→ PROBLEMA: Tiene que volver al Dashboard!
   └→ O tiene que memorizar que existe CommandDeck en footer

6. Usuario quiere seleccionar fixtures
   └→ Click en fixtures en canvas → TheProgrammer aparece ✅

7. Usuario quiere cambiar modo Manual/Selene
   └→ PROBLEMA: El selector está en Dashboard, no aquí

8. Usuario no sabe qué es "FLOW"
   └→ CONFUSIÓN: ¿Es diferente a SELENE?
   └→ RESPUESTA: No, es idéntico (placebo)
```

---

## 📋 RESUMEN DE PROBLEMAS

### 🔴 CRÍTICOS (Bloquean UX)

| # | Problema | Impacto |
|---|----------|---------|
| 1 | FLOW es placebo | Confusión de usuario |
| 2 | ModeSwitcher duplicado | Código muerto |
| 3 | Vibes en Dashboard | Usuario tiene que cambiar de vista |
| 4 | Tipos inconsistentes | GlobalMode vs SeleneMode |

### 🟡 IMPORTANTES (Fricción en UX)

| # | Problema | Impacto |
|---|----------|---------|
| 5 | No hay Calibration Mode | No puede alinear movers pre-show |
| 6 | Dashboard mezcla setup + control | Responsabilidades confusas |
| 7 | CommandDeck incompleto | Falta Vibe Selector |

### 🟢 MENORES (Nice to have)

| # | Problema | Impacto |
|---|----------|---------|
| 8 | LUX CORE innecesario para usuario | Tab de sobra |
| 9 | SimulateView.tsx con código viejo | Technical debt |

---

## 🎯 CONCLUSIÓN

El sistema funciona pero la UX es confusa:

1. **El usuario no sabe qué hacer** - Demasiados "modos" que hacen lo mismo
2. **Vibes están mal ubicadas** - Deberían estar donde se usan (Live Show)
3. **No hay Calibration** - Necesario para setup pre-show
4. **Duplicación innecesaria** - 2 ModeSwitchers, tipos incompatibles

**SIGUIENTE:** WAVE-421.2 define el rediseño y roadmap.

---

**WAVE 421.1 Status:** ✅ AUDIT COMPLETE

*"Conocer el problema es 50% de la solución."* 🔍
