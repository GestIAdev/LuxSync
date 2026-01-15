# WAVE 433: SIMULATOR ARCHITECTURE AUDIT 🔍

**Estado del Sistema de Simulación: DISPERSIÓN CRÍTICA**  
**Legacy Detectado: WAVE 24-39 (estamos en WAVE 432.5)**  
**Conflictos Activos: TheProgrammer vs InspectorControls**

---

## 📋 EXECUTIVE SUMMARY

El sistema de simulación (Stage View + 3D Renderer + Controls) está **fragmentado en 4 carpetas** con código legacy de hace **400+ WAVES**. Hay **duplicación funcional** entre `TheProgrammer` (WAVE 432) e `InspectorControls` (WAVE 30), y componentes comentados con referencias a arquitecturas antiguas.

**Problema Principal:**
- **Controles duplicados**: TheProgrammer (nuevo) vs InspectorControls (legacy)
- **Dispersión geográfica**: `/programmer`, `/stage3d`, `/views/SimulateView`, `/views/StageViewDual/sidebar`
- **Legacy sin deprecar**: Código de WAVE 24-39 conviviendo con WAVE 432.5
- **Imports cruzados**: Dependencias circulares potenciales entre vistas

---

## 🗂️ MAPA ACTUAL DE COMPONENTES

### 1. `/components/programmer` (WAVE 425-432)
**Propósito:** Panel de control para fixtures seleccionados (NUEVO, reemplazo de InspectorControls)

```
programmer/
├── TheProgrammer.tsx          ⭐ WAVE 432: Panel con tabs CONTROLS|GROUPS
├── TheProgrammerContent.tsx   ⭐ WAVE 432.5: Controles sin tabs (para StageSidebar)
├── GroupsPanel.tsx            ⭐ WAVE 432: Sistema + User groups
├── IntensitySection.tsx       ✅ Dimmer control
├── ColorSection.tsx           ✅ HSL picker
├── PositionSection.tsx        ✅ Pan/Tilt (WAVE 428.5)
├── BeamSection.tsx            ✅ Speed/Patterns (WAVE 428.5)
├── ScenesPlaceholder.tsx      ⚠️ Placeholder viejo (TODO: eliminar)
├── controls/                  📁 XYPad, PatternSelector, PrecisionInputs
├── TheProgrammer.css          🎨 Estilo cyan
└── accordion-styles.css       🎨 Accordion global
```

**Estado:** **ACTIVO** - En uso desde StageSidebar (WAVE 432.5)  
**Legacy:** `ScenesPlaceholder.tsx` (no se usa, redundante con SceneBrowser)

---

### 2. `/components/stage3d` (WAVE 30-379)
**Propósito:** Renderizado 3D con Three.js/React Three Fiber

```
stage3d/
├── Stage3DCanvas.tsx          🎬 WAVE 379.5: HYBRID RENDERING
├── Stage3DCanvas.css
├── fixtures/
│   ├── Fixture3D.tsx          💡 WAVE 33.1-378: Mover 3D con physics
│   ├── MovingHead3D.tsx       💡 WAVE 30
│   ├── ParCan3D.tsx           💡 WAVE 30
│   └── index.ts
├── environment/
│   ├── StageFloor.tsx         🏟️ WAVE 30.1
│   └── index.ts
├── controls/                  📁 Camera controls
└── index.ts
```

**Estado:** **ACTIVO** - Usado por StageViewDual en modo 3D  
**Legacy:** Referencias a WAVE 30, 33, 348, 350, 378, 379 (código actualizado pero comentarios viejos)  
**Limpieza Sugerida:** Actualizar headers de archivos con versión correcta

---

### 3. `/components/views/SimulateView` (WAVE 24-379)
**Propósito:** Renderizado 2D del stage (canvas)

```
SimulateView/
├── index.tsx                  🔥 WAVE 24.10: DMX Store integration
├── StageSimulator2.tsx        🎬 WAVE 339-379.5: HYBRID RENDERING (2D)
└── SimulateView.css
```

**Estado:** **ACTIVO** - Usado por StageViewDual en modo 2D  
**Legacy Masivo:**
- `index.tsx`: WAVE 24.10 (blackout detector, palette bypass removal)
- `StageSimulator2.tsx`: Referencias a WAVE 25.6, 30.1, 33, 34, 339, 379.5

**Notas:**
- Este código está **400 WAVES atrás** pero **FUNCIONA**
- No es seguro tocarlo sin tests de regresión

---

### 4. `/components/views/StageViewDual` (WAVE 30-432)
**Propósito:** Vista dual 2D/3D con sidebar de controles

```
StageViewDual/
├── StageViewDual.tsx          🎭 WAVE 33.3: Dual view switcher
├── StageViewDual.css
└── sidebar/
    ├── StageSidebar.tsx       ⭐ WAVE 432.5: 3 tabs CONTROLS|GROUPS|SCENES
    ├── StageSidebar.css       🎨 Cyan accent (nuevo)
    ├── InspectorControls.tsx  ⚠️ WAVE 428: ACCORDION (DUPLICADO CON TheProgrammer)
    ├── InspectorControls.css
    ├── SceneBrowser.tsx       🎬 WAVE 32: Scene management
    ├── SceneBrowser.css
    ├── ColorPicker.tsx        🎨 WAVE 30.1 (sub-widget)
    ├── DimmerSlider.tsx       💡 WAVE 30.1 (sub-widget)
    ├── PanTiltControl.tsx     🕹️ WAVE 30.1 (sub-widget)
    ├── PaletteControlMini.tsx 🎨 WAVE 33.2 (sub-widget)
    ├── controls.css
    ├── widgets/               📁 (solo index.ts, vacío)
    └── index.ts
```

**Estado:** **CONFLICTO CRÍTICO**  
**Problema:** `InspectorControls.tsx` es un **DUPLICADO FUNCIONAL** de `TheProgrammer`:

| Funcionalidad | InspectorControls | TheProgrammer |
|---------------|-------------------|---------------|
| Dimmer control | ✅ DimmerSlider | ✅ IntensitySection |
| Color picker | ✅ ColorPicker | ✅ ColorSection |
| Pan/Tilt | ✅ PanTiltControl | ✅ PositionSection |
| Beam controls | ✅ Pattern buttons | ✅ BeamSection |
| Groups | ❌ No tiene | ✅ GroupsPanel |
| Scenes | ❌ No tiene | ❌ No tiene (SceneBrowser aparte) |
| Accordion | ✅ Manual | ✅ Accordion + Lock buttons |

**Conclusión:** `InspectorControls` es **LEGACY** (WAVE 30-428), `TheProgrammer` es **ACTUAL** (WAVE 425-432).

---

## 🔥 LEGACY CODE DETECTED

### Código con WAVE < 100 (más de 300 waves atrás):

| Archivo | WAVE | Línea | Estado |
|---------|------|-------|--------|
| `SimulateView/index.tsx` | 24.10 | 18, 55, 63 | 🟡 Funciona, no tocar |
| `SimulateView/StageSimulator2.tsx` | 25.6, 30.1, 33 | 82-130 | 🟡 Funciona, no tocar |
| `InspectorControls.tsx` | 30.1, 428 | Header | 🔴 **ELIMINAR** (reemplazado) |
| `ColorPicker.tsx` | 30.1 | 2 | 🟡 Sub-widget OK |
| `DimmerSlider.tsx` | 30.1 | 2 | 🟡 Sub-widget OK |
| `PanTiltControl.tsx` | 30.1 | 2 | 🟡 Sub-widget OK |
| `SceneBrowser.tsx` | 32 | 2 | ✅ Activo en StageSidebar |
| `StageViewDual.tsx` | 33.3 | 2 | ✅ Activo (header viejo) |
| `Stage3DCanvas.tsx` | 30, 378-379.5 | Múltiples | 🟡 Funciona, actualizar headers |
| `Fixture3D.tsx` | 30, 33.1, 348-378 | Múltiples | 🟡 Funciona, actualizar headers |

**Criterio de Limpieza:**
- 🟡 **WAVE 20-40 en SimulateView**: NO TOCAR (core rendering, 400 waves de estabilidad)
- 🔴 **InspectorControls + sub-widgets**: DEPRECAR (reemplazados por TheProgrammer)
- ✅ **Headers viejos**: Actualizar comentarios a versión actual

---

## 🚨 CONFLICTOS Y DUPLICACIONES

### 1. **TheProgrammer vs InspectorControls** (CRÍTICO)

**Problema:** Dos sistemas de control con la **misma funcionalidad**:

```tsx
// LEGACY (WAVE 30-428)
StageViewDual/sidebar/InspectorControls.tsx
  ├── ColorPicker.tsx
  ├── DimmerSlider.tsx
  ├── PanTiltControl.tsx
  └── Manual accordion system

// NUEVO (WAVE 425-432)
programmer/TheProgrammer.tsx
  ├── IntensitySection.tsx
  ├── ColorSection.tsx
  ├── PositionSection.tsx
  ├── BeamSection.tsx
  └── GroupsPanel.tsx
```

**Uso Actual:**
- `InspectorControls`: **NO SE USA** (StageSidebar usa TheProgrammerContent desde WAVE 432.5)
- `TheProgrammer`: **ACTIVO** en StageSidebar tab CONTROLS

**Acción Requerida:** Deprecar `InspectorControls` y sub-widgets.

---

### 2. **Dispersión de Sub-Widgets**

**Problema:** Widgets reutilizables están en carpetas de vistas específicas:

```
❌ ACTUAL:
StageViewDual/sidebar/ColorPicker.tsx     (específico de vista)
StageViewDual/sidebar/DimmerSlider.tsx    (específico de vista)
StageViewDual/sidebar/PanTiltControl.tsx  (específico de vista)

✅ DEBERÍA SER:
programmer/controls/ColorPicker.tsx       (reutilizable)
programmer/controls/DimmerSlider.tsx      (reutilizable)
programmer/controls/PanTiltControl.tsx    (reutilizable)
```

**Nota:** Los widgets de `programmer/controls/` SÍ existen (XYPad, PatternSelector, PrecisionInputs) pero son diferentes a los de sidebar.

---

### 3. **Imports Cruzados**

```tsx
// StageViewDual importa de SimulateView (OK)
StageViewDual.tsx:
  import { StageSimulator2 } from '../SimulateView/StageSimulator2'

// StageViewDual importa de stage3d (OK)
StageViewDual.tsx:
  const Stage3DCanvas = lazy(() => import('../../stage3d/Stage3DCanvas'))

// StageSidebar importa de programmer (OK)
StageSidebar.tsx:
  import { TheProgrammerContent, GroupsPanel } from '../../../programmer'
```

**Conclusión:** No hay dependencias circulares, pero la **jerarquía es confusa**.

---

## 🎯 PROPUESTA DE UNIFICACIÓN

### **OBJETIVO: Consolidar en `/components/simulator`**

Crear una carpeta unificada con **arquitectura clara**:

```
components/
└── simulator/                    📁 TODO el sistema de simulación
    ├── views/                    📁 Vistas principales
    │   ├── StageViewDual.tsx     🎭 Vista dual 2D/3D (mover desde views/)
    │   ├── StageViewDual.css
    │   └── index.ts
    │
    ├── renderer/                 📁 Engines de renderizado
    │   ├── 2d/                   📁 Canvas 2D
    │   │   ├── StageSimulator2.tsx    (mover desde SimulateView/)
    │   │   └── SimulateView.css
    │   │
    │   └── 3d/                   📁 Three.js/R3F
    │       ├── Stage3DCanvas.tsx      (mover desde stage3d/)
    │       ├── Stage3DCanvas.css
    │       ├── fixtures/              (mover desde stage3d/)
    │       ├── environment/           (mover desde stage3d/)
    │       └── controls/              (mover desde stage3d/)
    │
    ├── controls/                 📁 Panels de control (UNIFICADO)
    │   ├── TheProgrammer.tsx          (mover desde programmer/)
    │   ├── TheProgrammerContent.tsx   (mover desde programmer/)
    │   ├── GroupsPanel.tsx            (mover desde programmer/)
    │   ├── SceneBrowser.tsx           (mover desde sidebar/)
    │   ├── sections/                  📁 Secciones accordion
    │   │   ├── IntensitySection.tsx   (mover desde programmer/)
    │   │   ├── ColorSection.tsx       (mover desde programmer/)
    │   │   ├── PositionSection.tsx    (mover desde programmer/)
    │   │   └── BeamSection.tsx        (mover desde programmer/)
    │   │
    │   ├── widgets/                   📁 Widgets reutilizables
    │   │   ├── XYPad.tsx              (mover desde programmer/controls/)
    │   │   ├── PatternSelector.tsx    (mover desde programmer/controls/)
    │   │   └── PrecisionInputs.tsx    (mover desde programmer/controls/)
    │   │
    │   └── styles/                    📁 Estilos compartidos
    │       ├── TheProgrammer.css
    │       ├── accordion-styles.css
    │       └── controls.css
    │
    ├── sidebar/                  📁 Sidebar container
    │   ├── StageSidebar.tsx           (mover desde StageViewDual/sidebar/)
    │   └── StageSidebar.css
    │
    └── deprecated/               📁 Legacy a eliminar (TEMPORAL)
        ├── InspectorControls.tsx      (DEPRECAR)
        ├── ColorPicker.tsx            (DEPRECAR - reemplazado por ColorSection)
        ├── DimmerSlider.tsx           (DEPRECAR - reemplazado por IntensitySection)
        ├── PanTiltControl.tsx         (DEPRECAR - reemplazado por PositionSection)
        ├── PaletteControlMini.tsx     (DEPRECAR - funcionalidad en ColorSection)
        └── ScenesPlaceholder.tsx      (DEPRECAR - reemplazado por SceneBrowser)
```

---

## 📝 MIGRATION PLAN

### **FASE 1: CREAR ESTRUCTURA** (WAVE 433)

1. ✅ Crear carpeta `/components/simulator`
2. ✅ Crear subcarpetas: `views/`, `renderer/`, `controls/`, `sidebar/`, `deprecated/`
3. ✅ Crear barrel exports (`index.ts`) en cada carpeta

### **FASE 2: MOVER ARCHIVOS** (WAVE 434)

**Orden de migración (sin romper imports):**

```bash
# 1. Mover stage3d → simulator/renderer/3d (NO rompe nada)
mv components/stage3d/* → components/simulator/renderer/3d/

# 2. Mover SimulateView → simulator/renderer/2d (NO rompe nada)
mv components/views/SimulateView/* → components/simulator/renderer/2d/

# 3. Mover programmer → simulator/controls (CRÍTICO: actualizar imports)
mv components/programmer/* → components/simulator/controls/

# 4. Mover StageViewDual/sidebar → simulator/sidebar
mv components/views/StageViewDual/sidebar/* → components/simulator/sidebar/

# 5. Mover StageViewDual → simulator/views
mv components/views/StageViewDual/* → components/simulator/views/

# 6. Mover legacy a deprecated
mv InspectorControls.tsx → simulator/deprecated/
mv ColorPicker.tsx → simulator/deprecated/
# ... resto de widgets legacy
```

**Archivos a actualizar (imports):**

| Archivo | Import Viejo | Import Nuevo |
|---------|--------------|--------------|
| `App.tsx` | `from './components/views/StageView'` | `from './components/simulator'` |
| `StageSidebar.tsx` | `from '../../../programmer'` | `from '../controls'` |
| `StageViewDual.tsx` | `from '../SimulateView/StageSimulator2'` | `from '../renderer/2d'` |
| `StageViewDual.tsx` | `from '../../stage3d/Stage3DCanvas'` | `from '../renderer/3d'` |

### **FASE 3: DEPRECAR LEGACY** (WAVE 435)

1. ✅ Agregar headers `@deprecated` a todos los archivos en `deprecated/`
2. ✅ Agregar console.warn() en componentes legacy
3. ✅ Documentar replacements en cada archivo
4. ⏳ Esperar 5 WAVEs para confirmar que no se usan
5. 🗑️ Eliminar carpeta `deprecated/`

### **FASE 4: LIMPIEZA DE HEADERS** (WAVE 436)

Actualizar todos los headers de archivos a versión actual:

```tsx
// ❌ ANTES:
/**
 * 💡 FIXTURE 3D - WAVE 30
 */

// ✅ DESPUÉS:
/**
 * 💡 FIXTURE 3D - WAVE 436
 * Originally created in WAVE 30, migrated to unified simulator architecture in WAVE 434
 */
```

---

## 🧪 TESTING STRATEGY

**Pre-Migration Checklist:**

1. ✅ Capture screenshots de todas las vistas (2D, 3D, sidebar)
2. ✅ Documentar todos los imports activos (grep search)
3. ✅ Backup de `/components` en branch `pre-wave-433`
4. ✅ Crear script de rollback

**Post-Migration Validation:**

1. ✅ F5 reload → No errors en console
2. ✅ Click en fixture → Selection funciona
3. ✅ Cambiar dimmer → Visual update en 2D y 3D
4. ✅ Cambiar color → Visual update en 2D y 3D
5. ✅ Pan/Tilt control → Moving heads se mueven
6. ✅ Switch 2D ↔ 3D → Sin errores
7. ✅ Crear grupo → Auto-switch a CONTROLS tab
8. ✅ Grabar escena → SceneBrowser muestra

---

## 🚫 ARCHIVOS A DEPRECAR

### **ELIMINAR después de WAVE 435:**

```
components/views/StageViewDual/sidebar/
├── InspectorControls.tsx      🗑️ REEMPLAZADO por TheProgrammer
├── InspectorControls.css      🗑️
├── ColorPicker.tsx            🗑️ REEMPLAZADO por ColorSection
├── DimmerSlider.tsx           🗑️ REEMPLAZADO por IntensitySection
├── PanTiltControl.tsx         🗑️ REEMPLAZADO por PositionSection
├── PaletteControlMini.tsx     🗑️ FUNCIONALIDAD en ColorSection
└── controls.css               🗑️

components/programmer/
└── ScenesPlaceholder.tsx      🗑️ REEMPLAZADO por SceneBrowser
```

**Razón:** Todos estos componentes son **DUPLICADOS FUNCIONALES** de la arquitectura nueva (WAVE 425-432).

---

## 📊 IMPACTO ANALYSIS

### **Riesgo de Migración:**

| Aspecto | Riesgo | Mitigación |
|---------|--------|------------|
| Romper imports | 🟡 MEDIO | Actualizar en orden correcto + barrel exports |
| Perder funcionalidad | 🟢 BAJO | TheProgrammer ya tiene todo |
| Romper 2D/3D render | 🟡 MEDIO | No tocar SimulateView/Stage3D internals |
| Conflictos de estado | 🟢 BAJO | Stores no cambian, solo componentes UI |
| Rollback necesario | 🟡 MEDIO | Branch backup + script de rollback |

### **Beneficios Esperados:**

✅ **Una sola carpeta** para todo el simulador  
✅ **Arquitectura clara**: views → renderer → controls → sidebar  
✅ **Zero duplicación** (InspectorControls eliminado)  
✅ **Imports limpios** (no más `../../../programmer`)  
✅ **Onboarding más rápido** (nuevo dev sabe dónde buscar)  

---

## 🎬 NEXT ACTIONS

### **Inmediato (WAVE 433):**

1. ✅ Crear estructura de carpetas `/components/simulator`
2. ✅ Crear barrel exports (`index.ts`)
3. ✅ Documentar plan de migración detallado
4. ✅ Crear branch `pre-wave-433` para backup

### **Siguiente (WAVE 434):**

1. Ejecutar migración de archivos en orden
2. Actualizar imports uno por uno
3. Validar con testing checklist
4. Commit: "WAVE 434: SIMULATOR UNIFICATION - Phase 1"

### **Después (WAVE 435-436):**

1. Deprecar legacy components
2. Actualizar headers de archivos
3. Eliminar carpeta `deprecated/`
4. Commit: "WAVE 435: LEGACY PURGE - Simulator Clean"

---

## 📞 CONTACT & APPROVAL

**Reporte generado:** WAVE 433  
**Autor:** PunkOpus  
**Requiere aprobación de:** Radwulf  

**Pregunta clave antes de ejecutar:**
> ¿Estás de acuerdo con eliminar `InspectorControls` y unificar todo en `/components/simulator`?

**Alternativas evaluadas:**
1. ❌ Mantener todo disperso (status quo caótico)
2. ❌ Solo deprecar InspectorControls (no resuelve dispersión)
3. ✅ **Unificación completa en `/simulator`** (RECOMENDADO)

---

## 📚 REFERENCIAS

- WAVE 432: HIVE MIND (Groups Panel)
- WAVE 432.5: UNIFIED SIDEBAR (3 tabs)
- WAVE 428: NEON POLISH (Accordion)
- WAVE 425: TheProgrammer creation
- WAVE 379.5: HYBRID RENDERING
- WAVE 30-33: Original StageView architecture

---

**END OF REPORT** 🔍
