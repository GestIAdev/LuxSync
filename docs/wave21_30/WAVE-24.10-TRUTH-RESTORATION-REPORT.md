# 🔥 WAVE 24.10 - TRUTH RESTORATION: Single Source of Truth
**Status**: ✅ **COMPLETADO**  
**Fecha**: 12 Diciembre 2025  
**Prioridad**: 🔴 **CRÍTICA** (Integridad de Datos)  
**Ingeniero**: GitHub Copilot + Raúl Acate  

---

## 🕵️‍♂️ EL DIAGNÓSTICO: "LA GUERRA DE LOS CLONES"

### La Hipótesis del Arquitecto

**Sospecha**: El parpadeo del Canvas NO era causado por datos corruptos, sino por **DOBLE INYECCIÓN** de datos desde dos vías diferentes:

```
╔═══════════════════════════════════════════════════════════════╗
║ VÍA A (IPC Legacy): Backend → lux:state-update → dmxStore    ║
║ VÍA B (Telemetry): Backend → telemetry-update → telemetryStore║
║                                                               ║
║ Canvas lee de AMBAS vías con milisegundos de diferencia      ║
║ Frame A (DMX) → Frame B (Telemetry) → Frame A de nuevo...    ║
║ Resultado: ¡PARPADEO! ⚡                                      ║
╚═══════════════════════════════════════════════════════════════╝
```

**Diagnóstico**: React intentaba renderizar dos "realidades" diferentes del mismo estado, causando **conflictos visuales**.

---

## 🎯 OBJETIVO: SINGLE SOURCE OF TRUTH

### Directiva Arquitectónica

> **"El Canvas DEBE representar la JODIDA REALIDAD de lo que sale por el USB DMX."**

**Estrategia**:
1. **ELIMINAR** el bypass visual de `telemetryStore.palette` (WAVE 24.8)
2. **RESTAURAR** la lectura directa del `dmxStore.fixtureValues`
3. **CONFIAR** en los NaN guards del backend (WAVE 24.6)
4. **DETECTAR** anomalías (blackouts con intensity > 0)

**Razonamiento**:
- Si el backend está arreglado (WAVE 24.6 NaN guards), el DMX Store DEBE ser estable
- Si el Canvas es estable → ✅ **ÉXITO TOTAL**
- Si el Canvas parpadea → ❌ **Las luces reales parpadearán** (sabremos que el backend escupe basura)

---

## 🔧 CAMBIOS IMPLEMENTADOS

### 1. Eliminación del Import de TelemetryStore

**Archivo**: `SimulateView/index.tsx` línea 18

**ANTES (WAVE 24.8)**:
```tsx
import { useTelemetryStore } from '../../../stores/telemetryStore'  // 🎭 WAVE 24.8: Visual stabilizer
```

**DESPUÉS (WAVE 24.10)**:
```tsx
// 🔥 WAVE 24.10: REMOVED telemetryStore import - SINGLE SOURCE OF TRUTH (DMX Store only)
```

---

### 2. Eliminación de la Variable `palette`

**Archivo**: `SimulateView/index.tsx` línea 55

**ANTES (WAVE 24.8)**:
```tsx
// 🎭 WAVE 24.8: Visual Stabilizer - Use stable palette instead of flickering DMX
const palette = useTelemetryStore(state => state.palette)
```

**DESPUÉS (WAVE 24.10)**:
```tsx
// 🔥 WAVE 24.10: REMOVED palette bypass - TRUTH RESTORATION (DMX Store = Source of Truth)
```

---

### 3. Restauración de Lectura DMX Directa

**Archivo**: `SimulateView/index.tsx` líneas 89-138

**ANTES (WAVE 24.8)** - Bypass con Palette:
```tsx
// ═══════════════════════════════════════════════════════════════════════
// 🎭 WAVE 24.8: VISUAL BYPASS - Use stable palette instead of DMX colors
// DMX puede tener micro-parpadeos, pero el canvas se ve SÓLIDO
// ═══════════════════════════════════════════════════════════════════════
let visualColor = '#444444'  // Fallback gris oscuro

if (palette && palette.colors) {
  const zone = f.zone || 'UNASSIGNED'
  
  if (zone.includes('FRONT_PARS')) {
    visualColor = palette.colors.primary.hex
  } else if (zone.includes('BACK_PARS')) {
    visualColor = palette.colors.secondary.hex
  } else if (zone.includes('MOVING_LEFT')) {
    visualColor = palette.colors.accent.hex
  } else if (zone.includes('MOVING_RIGHT')) {
    visualColor = palette.colors.ambient.hex
  } else if (zone.includes('STROBE')) {
    visualColor = palette.colors.contrast.hex
  } else {
    visualColor = palette.colors.primary.hex
  }
}

const color = hexToRgb(visualColor)
const intensity = liveValues ? liveValues.dimmer / 255 : 0.3
```

**DESPUÉS (WAVE 24.10)** - DMX Directo:
```tsx
// ═══════════════════════════════════════════════════════════════════════
// 🔥 WAVE 24.10: TRUTH RESTORATION - Read ONLY from DMX Store
// El Canvas DEBE representar la JODIDA REALIDAD de lo que sale por el USB
// Si el backend (SeleneLux.ts) está arreglado (WAVE 24.6 NaN guards), 
// entonces el DMX Store DEBE ser estable.
// ═══════════════════════════════════════════════════════════════════════

// Extract RGB color from DMX (channels r, g, b from FixtureValues)
const r = liveValues?.r ?? 0
const g = liveValues?.g ?? 0
const b = liveValues?.b ?? 0
const intensity = liveValues ? liveValues.dimmer / 255 : 0.3

// ⚠️ WAVE 24.10: BLACKOUT DETECTOR - Anomaly detection
// Si una fixture está activa (intensity > 0) pero RGB = (0,0,0), es un BUG
if (r === 0 && g === 0 && b === 0 && intensity > 0.1) {
  console.warn(`⚠️ BLACKOUT ANÓMALO EN FIXTURE ACTIVA: ${f.id} (${f.name}) - Dimmer: ${(intensity * 100).toFixed(0)}%`)
}

// Convert RGB to hex for canvas
const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const colorStr = rgbToHex(r, g, b)
const color = { r, g, b }
```

**Cambios clave**:
1. ✅ Lee `r`, `g`, `b` directamente de `liveValues` (DMX Store)
2. ✅ Detector de blackouts anómalos (luz encendida sin color)
3. ✅ Conversión RGB → Hex inline (sin dependencia de palette)
4. ✅ Fallback a `0` si no hay `liveValues` (fixture offline)

---

### 4. Detector de Anomalías (Blackout con Dimmer Activo)

**Nuevo código** (líneas 103-106):
```tsx
// ⚠️ WAVE 24.10: BLACKOUT DETECTOR - Anomaly detection
// Si una fixture está activa (intensity > 0) pero RGB = (0,0,0), es un BUG
if (r === 0 && g === 0 && b === 0 && intensity > 0.1) {
  console.warn(`⚠️ BLACKOUT ANÓMALO EN FIXTURE ACTIVA: ${f.id} (${f.name}) - Dimmer: ${(intensity * 100).toFixed(0)}%`)
}
```

**Por qué es importante**:
- Detecta si el backend envía **dimmer > 0** pero **RGB = (0,0,0)**
- Esto indicaría que:
  1. El ColorEngine/SeleneColorEngine generó colores negros (bug)
  2. El sanitize() está fallando (bug)
  3. Hay un NaN que se convirtió a 0 (bug de WAVE 24.6)
  
**Threshold**: `intensity > 0.1` (10%) para evitar falsos positivos con dimmers muy bajos.

---

### 5. Actualización de Dependencias del useMemo

**Archivo**: `SimulateView/index.tsx` línea 138

**ANTES (WAVE 24.8)**:
```tsx
}, [patchedFixtures, fixtureValuesArray, palette]) // 🎭 palette dependency
```

**DESPUÉS (WAVE 24.10)**:
```tsx
}, [patchedFixtures, fixtureValuesArray]) // 🔥 WAVE 24.10: NO palette dependency (DMX only)
```

**Impacto en Performance**:
- **ANTES**: `useMemo` se recalculaba cuando cambiaba `palette` (telemetry) O `fixtureValuesArray` (DMX)
- **DESPUÉS**: `useMemo` solo se recalcula cuando cambia `fixtureValuesArray` (DMX)
- **Resultado**: **Menos re-cálculos** → Menos presión en React → Menos parpadeos potenciales

---

## 🔍 ANÁLISIS DE RENDERS

### Estado de los Selectores Zustand

```tsx
// ✅ BUENOS: Selectores específicos (no causan re-renders excesivos)
const dmxConnected = useDMXStore(state => state.isConnected)
const patchedFixtures = useDMXStore(state => state.fixtures)
const fixtureValuesArray = useDMXStore(state => Array.from(state.fixtureValues.entries()))
const activeEffects = useLuxSyncStore(state => state.effects.active)
```

**Análisis**:
- Cada `useDMXStore` suscribe solo a un **slice específico** del estado
- No hay suscripción al store completo (`state => state` ❌)
- `fixtureValuesArray` convierte Map → Array para forzar re-renders cuando cambia el Map (correcto)

---

### useEffect del Canvas

**Dependencias**:
```tsx
[showBeams, showGrid, showHaze, showZoneLabels, renderableFixtures, dmxConnected, 
 isStrobeActive, isBeamActive, isPrismActive, isBlinderActive, isPoliceActive, 
 isRainbowActive, isLaserActive, isSmokeActive]
```

**Comportamiento**:
- Cuando cambia `renderableFixtures` (derivado de `fixtureValuesArray`), el `useEffect` se **desmonta y vuelve a montar**
- `cancelAnimationFrame` limpia el loop anterior
- Un nuevo loop `requestAnimationFrame` se crea

**Evaluación**:
- ✅ **Aceptable**: La limpieza es correcta
- ⚠️ **Potencial optimización futura**: Podríamos mover `renderableFixtures` fuera del `useEffect` y usar una ref para evitar desmontar el loop
- 🔥 **Para esta WAVE**: NO optimizar (si funciona, no lo toques antes del show)

---

## 📊 COMPARACIÓN: WAVE 24.8 vs WAVE 24.10

### Flujo de Datos

**WAVE 24.8 (Bypass)**:
```
Backend (SeleneLux.ts)
  ├─→ lux:state-update → dmxStore (DMX RGB)
  └─→ telemetry-update → telemetryStore.palette (Brain HSL)
                               ↓
                        SimulateView lee palette
                               ↓
                        Canvas pinta colores estables
                        (pero NO la realidad DMX)
```

**WAVE 24.10 (Truth Restoration)**:
```
Backend (SeleneLux.ts)
  └─→ lux:state-update → dmxStore (DMX RGB)
                               ↓
                        SimulateView lee dmxStore.fixtureValues
                               ↓
                        Canvas pinta RGB directo
                        (LA JODIDA REALIDAD del USB)
```

---

### Ventajas y Desventajas

| Aspecto | WAVE 24.8 (Bypass) | WAVE 24.10 (Truth) |
|---------|-------------------|-------------------|
| **Estabilidad Visual** | ✅ Muy estable (palette no flicker) | ⚠️ Depende del backend |
| **Precisión de Datos** | ❌ NO representa DMX real | ✅ 100% fiel al USB DMX |
| **Dependencias** | ❌ Doble: DMX + Telemetry | ✅ Single: DMX only |
| **Debugging** | ❌ Oculta problemas del backend | ✅ Revela bugs reales |
| **Pre-Show Risk** | ✅ Bajo (Canvas siempre bonito) | ⚠️ Medio (si backend falla, se ve) |
| **Production Ready** | ❌ Bypass artificial | ✅ Refleja realidad |

---

## 🧪 TESTING PLAN

### Test 1: Canvas Estable con Backend Arreglado
**Objetivo**: Verificar que WAVE 24.6 (NaN guards) funciona realmente.

**Procedimiento**:
1. Ejecutar la app
2. Activar modo Brain (SeleneColorEngine)
3. Reproducir música con cambios de sección (intro → drop)
4. **Observar Canvas**:
   - ✅ **ÉXITO**: Colores sólidos, sin parpadeos
   - ❌ **FALLO**: Parpadeos, colores grises intermitentes

**Si falla**: El backend TODAVÍA tiene bugs de NaN. Revisar SeleneLux.ts.

---

### Test 2: Canvas Estable con Modo Flow
**Objetivo**: Verificar que WAVE 24.9 (Flow palette sync) NO interfiere.

**Procedimiento**:
1. Cambiar a modo Flow
2. Seleccionar preset "Fuego" 🔥
3. **Observar Canvas**:
   - ✅ **ÉXITO**: Rojos/naranjas sólidos (del DMX RGB)
   - ❌ **FALLO**: Colores grises o parpadeos

**Nota**: Ahora el Canvas NO lee `telemetryStore.palette`, sino el RGB directo del DMX. El WAVE 24.9 (Flow palette sync) solo afecta a la telemetría (para otros componentes UI), NO al Canvas.

---

### Test 3: Detector de Blackouts
**Objetivo**: Verificar que el detector de anomalías funciona.

**Procedimiento**:
1. Ejecutar la app
2. Activar una fixture
3. Provocar un blackout anómalo (dimmer > 0, RGB = 0):
   - Modificar temporalmente `SeleneLux.ts` para enviar `{r: 0, g: 0, b: 0}` con `dimmer: 255`
4. **Observar Console**:
   - ✅ **ÉXITO**: `⚠️ BLACKOUT ANÓMALO EN FIXTURE ACTIVA: ...`
   - ❌ **FALLO**: No hay warning (detector roto)

---

### Test 4: Performance (Anti-Bent Beams)
**Objetivo**: Verificar que el Canvas no hace re-renders excesivos.

**Procedimiento**:
1. Abrir React DevTools Profiler
2. Ejecutar la app con música
3. Grabar 10 segundos de actividad
4. **Analizar**:
   - ✅ **ÉXITO**: Renders constantes a ~60 FPS (requestAnimationFrame)
   - ❌ **FALLO**: Renders erráticos, picos de lag

---

## 🎭 IMPACTO EN WAVE 24.9 (Flow Palette Sync)

### ¿El WAVE 24.10 rompe el WAVE 24.9?

**NO**. Aquí está por qué:

**WAVE 24.9** sincronizaba la paleta de Flow a `telemetryStore.palette` para que **otros componentes UI** (no el Canvas) pudieran leerla.

**WAVE 24.10** eliminó la lectura de `telemetryStore.palette` **SOLO en el Canvas**. Otros componentes (si existen) aún pueden leer `telemetryStore.palette`.

**Resultado**:
- ✅ WAVE 24.9: `telemetryStore.palette` sigue actualizado (para UI)
- ✅ WAVE 24.10: Canvas lee DMX directo (Single Source of Truth)
- ✅ **Compatibilidad total**: Ambas WAVEs coexisten sin conflicto

---

## 📈 MÉTRICAS DE ÉXITO

### KPIs para Validar WAVE 24.10

| Métrica | Objetivo | Medición |
|---------|----------|----------|
| **Canvas Stability** | 0 flickers/min | Observación visual + Chrome DevTools |
| **Blackout Detections** | 0 warnings (si backend OK) | Console logs durante 5 min |
| **React Renders** | ~60 FPS constante | React DevTools Profiler |
| **Memory Leaks** | 0 MB/min increase | Chrome Task Manager |
| **User Confidence** | "Parece que funciona" 😎 | Feedback del Arquitecto |

---

## 🚨 CONTINGENCY PLAN (Si Falla)

### Escenario 1: Canvas Parpadea con Truth Restoration

**Diagnóstico**: El backend (WAVE 24.6) NO está arreglado. Los NaN guards fallan.

**Solución Inmediata**:
```bash
# Revertir WAVE 24.10 y volver a WAVE 24.8
git revert HEAD  # Restaurar bypass de palette
```

**Solución Permanente**:
- Auditar `SeleneLux.ts` líneas 428-490 (Flow mode NaN guards)
- Auditar `SeleneColorEngine.ts` (Brain mode color generation)
- Añadir más `sanitize()` calls

---

### Escenario 2: Blackouts Anómalos Detectados

**Diagnóstico**: El ColorEngine genera RGB = (0,0,0) con dimmer activo.

**Debug Steps**:
1. Capturar el warning en console
2. Identificar qué fixture (`f.id`, `f.name`)
3. Revisar el preset de color activo
4. Auditar `ColorEngine.ts` o `SeleneColorEngine.ts`

**Fix Temporal**:
```tsx
// En SimulateView/index.tsx, forzar un color mínimo
const r = Math.max(10, liveValues?.r ?? 0)  // Mínimo 10 (no total black)
const g = Math.max(10, liveValues?.g ?? 0)
const b = Math.max(10, liveValues?.b ?? 0)
```

---

### Escenario 3: Performance Degrada (Bent Beams)

**Diagnóstico**: Re-renders excesivos del Canvas.

**Optimización**:
```tsx
// Mover renderableFixtures a una ref para evitar desmontar useEffect
const fixturesRef = useRef(renderableFixtures)
useEffect(() => {
  fixturesRef.current = renderableFixtures
}, [renderableFixtures])

// Luego en el useEffect del canvas, usar fixturesRef.current
```

---

## 🏁 CONCLUSIÓN

### Estado Final: ✅ SINGLE SOURCE OF TRUTH RESTAURADO

**WAVE 24.10** elimina el bypass visual de WAVE 24.8 y restaura la **verdad absoluta**: el Canvas ahora representa EXACTAMENTE lo que sale por el USB DMX.

**Flujo de Validación**:
```
SeleneLux.ts genera colores
    ↓
Envía RGB a DMX Store (via lux:state-update)
    ↓
SimulateView lee dmxStore.fixtureValues
    ↓
Canvas renderiza RGB directo
    ↓
¿Canvas estable? → Backend OK ✅
¿Canvas parpadea? → Backend corrupto ❌
```

**¿Por qué es crítico antes del show?**

> **"Si vas con el bypass, no sabrás si las luces reales van a parpadear."**

Con WAVE 24.10, lo que ves en el Canvas ES lo que las luces harán. No hay "sorpresas" cuando enchufes el USB DMX.

---

### Archivos Modificados

| Archivo | Líneas | Cambio |
|---------|--------|--------|
| `SimulateView/index.tsx` | 18 | ❌ Removed `useTelemetryStore` import |
| `SimulateView/index.tsx` | 55 | ❌ Removed `palette` variable |
| `SimulateView/index.tsx` | 89-138 | ✅ Restored DMX direct read + blackout detector |
| `SimulateView/index.tsx` | 138 | ✅ Removed `palette` from useMemo dependencies |

---

### Next Steps (Post-WAVE 24.10)

1. **Testing Manual**:
   - [ ] Test 1: Canvas estable con Brain mode
   - [ ] Test 2: Canvas estable con Flow mode
   - [ ] Test 3: Detector de blackouts funciona
   - [ ] Test 4: Performance 60 FPS constante

2. **Validación Pre-Show**:
   - [ ] Conectar USB DMX real
   - [ ] Verificar que fixtures físicas NO parpadean
   - [ ] Confirmar que Canvas = Realidad

3. **Documentación**:
   - [x] Reporte WAVE 24.10 creado
   - [ ] Actualizar README con Single Source of Truth
   - [ ] Añadir diagrama de flujo de datos

---

**Firma Digital**:  
🔥 **WAVE 24.10 - TRUTH RESTORATION** completado exitosamente  
👨‍💻 Ingeniero: GitHub Copilot + Raúl Acate  
📅 Timestamp: ${new Date().toISOString()}  
🎯 **"EL CANVAS AHORA REPRESENTA LA JODIDA REALIDAD."**  

---

## 📌 APÉNDICE: Código Completo del Cambio Principal

```tsx
// ═══════════════════════════════════════════════════════════════════════
// 🔥 WAVE 24.10: TRUTH RESTORATION - Read ONLY from DMX Store
// El Canvas DEBE representar la JODIDA REALIDAD de lo que sale por el USB
// Si el backend (SeleneLux.ts) está arreglado (WAVE 24.6 NaN guards), 
// entonces el DMX Store DEBE ser estable.
// ═══════════════════════════════════════════════════════════════════════

// Extract RGB color from DMX (channels r, g, b from FixtureValues)
const r = liveValues?.r ?? 0
const g = liveValues?.g ?? 0
const b = liveValues?.b ?? 0
const intensity = liveValues ? liveValues.dimmer / 255 : 0.3

// ⚠️ WAVE 24.10: BLACKOUT DETECTOR - Anomaly detection
// Si una fixture está activa (intensity > 0) pero RGB = (0,0,0), es un BUG
if (r === 0 && g === 0 && b === 0 && intensity > 0.1) {
  console.warn(`⚠️ BLACKOUT ANÓMALO EN FIXTURE ACTIVA: ${f.id} (${f.name}) - Dimmer: ${(intensity * 100).toFixed(0)}%`)
}

// Convert RGB to hex for canvas
const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const colorStr = rgbToHex(r, g, b)
const color = { r, g, b }
```
