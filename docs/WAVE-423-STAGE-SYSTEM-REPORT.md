# 🧭 WAVE 423: STAGE SYSTEM - EXECUTION REPORT

**Fecha:** 2026-01-14  
**Arquitecto:** Radwulf  
**Ejecutor:** PunkOpus  
**Status:** ✅ **COMPLETE**

---

## 🎯 OBJETIVO

Transformar la navegación de 5 tabs dispersos a **3 Stages + 1 Tool**:
- **Dashboard** → Command Center (Session, Power)
- **Live** → Performance Hub (Simulator 2D/3D)
- **Calibration** → Hardware Setup (Constructor absorbe Setup)
- **LUX CORE** → AI Monitoring (Tool visible, "es bonita")

---

## 📐 ARQUITECTURA ANTES vs DESPUÉS

### ANTES (5 tabs confusos)
```
live → simulate → constructor → core → setup
  ↓        ↓          ↓           ↓       ↓
Dashboard Stage   Constructor  Monitor  Settings
(confuso) (ok)    (disperso)   (ok)    (perdido)
```

### DESPUÉS (3 stages + 1 tool)
```
dashboard → live → calibration → core
    ↓         ↓         ↓          ↓
 Command   Stage    Hardware   LUX CORE
 Center    Sim      Setup      (tool)
```

---

## ✏️ ARCHIVOS MODIFICADOS

### 1. `navigationStore.ts` (Core Change)

**Tipos actualizados:**
```typescript
// ANTES
type TabId = 'live' | 'simulate' | 'constructor' | 'core' | 'setup'

// DESPUÉS  
type StageId = 'dashboard' | 'live' | 'calibration'
type ToolId = 'core'
type TabId = StageId | ToolId
```

**TabConfig extendido:**
```typescript
interface TabConfig {
  id: TabId
  label: string
  icon: string
  customIcon?: boolean  // true = usar SVG custom
  type: 'stage' | 'tool'  // NUEVO: categorización
  shortcut: string
  description: string
}
```

**Initial state:** `dashboard` (antes era `live`)

### 2. `Sidebar.tsx`

**TAB_COLORS actualizado:**
```typescript
{
  'dashboard': '#00fff0',    // Cian
  'live': '#ff00ff',         // Magenta
  'calibration': '#22d3ee',  // Cyan-400
  'core': '#f59e0b',         // Naranja
}
```

**TAB_ICONS actualizado:**
- Removidos: Lucide genéricos (Zap, Monitor, Crosshair, Brain)
- Añadidos: Custom SVGs (IconDashboard, IconLiveStage, IconCalibration, IconLuxCore)

### 3. `ContentArea.tsx`

**Routing actualizado:**
```typescript
// WAVE 423: 3 Stages + 1 Tool routing
switch (renderedTab) {
  case 'dashboard': return <DashboardView />
  case 'live': return <LiveStageView />       // Era SimulateView
  case 'calibration': return <CalibrationView /> // Era StageConstructorView
  case 'core': return <LuxCoreView />
  default: return <DashboardView />
}
```

**WEBGL_VIEWS actualizado:**
```typescript
const WEBGL_VIEWS = ['live', 'calibration']  // Era ['constructor', 'simulate']
```

### 4. `NavigationIcons.tsx` ✨ NUEVO

**Custom SVG Icons - Cyberpunk HUD Aesthetic:**
- `IconDashboard` - Lightning bolt con frame militar
- `IconLiveStage` - Stage con spotlights + targeting reticle
- `IconCalibration` - Crosshair de precisión + corner brackets
- `IconLuxCore` - Neural network con data flow

Todos con:
- Stroke weight 1.8 (consistente con HudIcons.tsx)
- Corner brackets / HUD frames
- Opacity variations para depth
- currentColor para theming dinámico

---

## 🔀 MAPEO DE VISTAS

| Tab Viejo | Tab Nuevo | Vista |
|-----------|-----------|-------|
| `live` | `dashboard` | DashboardView |
| `simulate` | `live` | StageViewDual |
| `constructor` | `calibration` | StageConstructorView (temporal) |
| `core` | `core` | LuxCoreView |
| `setup` | _(absorbido)_ | _(merge en calibration)_ |

---

## ⚠️ DEUDA TÉCNICA

### ~~Para Phase 3+~~ ✅ ELIMINADO

1. ~~**Custom SVG Icons**~~ ✅ COMPLETE
   - ✅ `dashboard`: IconDashboard (custom lightning + HUD frame)
   - ✅ `live`: IconLiveStage (custom stage + spotlights)
   - ✅ `calibration`: IconCalibration (custom crosshair + precision grid)
   - ✅ `core`: IconLuxCore (custom neural network)
   
2. **CalibrationView** - Actualmente reusa StageConstructorView
   - Necesita RadarXY widget (Phase 4)
   - Necesita TargetingSystem widget (Phase 4)
   - Absorber settings de SetupView

3. **SetupView** - Ahora huérfano
   - Funcionalidad a migrar a CalibrationView
   - Archivo pendiente de eliminación

---

## ✅ VERIFICACIÓN

```bash
# Sin errores de TypeScript
- navigationStore.ts ✅
- Sidebar.tsx ✅
- ContentArea.tsx ✅
- KeyboardProvider.tsx ✅ (funciona sin cambios)
```

---

## 🔮 PRÓXIMAS PHASES

| Phase | WAVE | Descripción |
|-------|------|-------------|
| ✅ 0-1 | 422 | Mode Termination |
| ✅ 2 | 423 | Stage System ← **COMPLETE** |
| ⏳ 3 | 424 | Dashboard Simplify |
| ⏳ 4 | 425 | Calibration Mode |
| ⏳ 5 | 426 | Vibe Migration |
| ⏳ 6 | 427 | Integration Test |

---

## 📝 COMMIT INFO

```
WAVE 423: STAGE SYSTEM + Custom Navigation Icons

NAVIGATION:
- MODIFY: navigationStore.ts (5 tabs → 4 tabs)
- ADD: StageId, ToolId types
- ADD: TabConfig.type ('stage' | 'tool')
- MODIFY: Initial tab: 'live' → 'dashboard'

ROUTING:
- MODIFY: ContentArea.tsx (new view mapping)
- MODIFY: Sidebar.tsx (custom icons, new colors)

ICONS:
- CREATE: NavigationIcons.tsx (4 custom SVG icons)
- IconDashboard: Lightning bolt + military HUD frame
- IconLiveStage: Stage spotlights + targeting reticle
- IconCalibration: Precision crosshair + corner brackets
- IconLuxCore: Neural network + data flow nodes

Tab mapping:
  live → dashboard (DashboardView)
  simulate → live (StageViewDual)
  constructor → calibration (StageConstructorView)
  core → core (LuxCoreView)
  setup → absorbed into calibration

Style: Cyberpunk HUD aesthetic - angular, military, high-tech
Phase 2 COMPLETE | Next: Phase 3 (Dashboard Simplify)
```

---

*PunkOpus - Menos tabs, menos confusión, más rock* 🎸
