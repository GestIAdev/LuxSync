# ⚒️ WAVE 2043: OPERATION VULCAN — EXECUTION REPORT

**Fecha**: 2026-02-16  
**Operador**: PunkOpus  
**Estado**: ✅ FASE 1 COMPLETA (Undo/Redo + Multi-Selection)

---

## 🎯 OBJETIVO

Eliminar las dos debilidades críticas #1 y #2 identificadas en la auditoría técnica de Hephaestus:

1. **#1 NO UNDO/REDO** → Implementado via `useTemporalStore`
2. **#2 NO MULTI-SELECTION** → Implementado via Rubber Band + Shift+Click + Batch Move

---

## 📁 ARCHIVOS CREADOS

| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `useTemporalStore.ts` | ~220 | Hook de Undo/Redo con snapshot stack |

## 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `CurveEditor.tsx` | +onDragStart, +selectedIndices, +onMultiSelect, +rubber-band DragState, +Shift+Click, +SVG rubber band rect |
| `index.tsx` | +useTemporalStore integration, +snapshot en todas las acciones destructivas, +selectedIndices state, +batch move, +Ctrl+Z/Ctrl+Shift+Z handler, +undo/redo buttons en header |
| `HephaestusView.css` | +estilos para botones temporal (undo/redo) |

---

## ⚒️ FASE 1A: UNDO/REDO — `useTemporalStore`

### Arquitectura

```
useTemporalStore(initialClip)
  ├── state.clip              → HephAutomationClip actual
  ├── state.canUndo/canRedo   → Flags derivados
  ├── state.undoDepth/redoDepth → Para UI
  ├── actions.setClip         → Mutación sin snapshot (drag continuo)
  ├── actions.snapshot()      → Captura estado ANTES de acción destructiva
  ├── actions.undo()          → Pop undo stack, push current a redo
  ├── actions.redo()          → Pop redo stack, push current a undo
  ├── actions.clearHistory()  → Reset stacks
  └── actions.resetWithClip() → Nuevo clip + reset stacks
```

### Decisiones de diseño

- **NO es Zustand middleware** — Es un hook standalone. El clip state de Hephaestus no usa Zustand (usa `useState`), así que crear un store Zustand solo para undo/redo sería overhead innecesario.
- **`structuredClone`** para deep copy — Soporta `Map<>` nativamente en Electron ≥ 17. Cero serialización manual.
- **Stack limit: 50** — Suficiente para un flujo de edición normal. El oldest se descarta con `shift()`.
- **Redo se invalida** al hacer una nueva acción (rama muerta, estándar de industria).
- **Refs para stacks** — `useRef<HephAutomationClip[]>` para evitar re-renders en cada push. Un counter `forceRender` se dispara solo cuando cambian `canUndo/canRedo`.

### Puntos de snapshot

Cada acción destructiva captura snapshot ANTES de mutar:

| Acción | Mecanismo |
|--------|-----------|
| Add keyframe | `updateCurveWithSnapshot()` |
| Delete keyframe | `updateCurveWithSnapshot()` |
| Change interpolation | `updateCurveWithSnapshot()` |
| Apply template | `updateCurveWithSnapshot()` |
| Apply bezier preset | `updateCurveWithSnapshot()` |
| Change curve mode | `updateCurveWithSnapshot()` |
| Add/Remove parameter | `temporalActions.snapshot()` antes de `setClip()` |
| Change name/duration | `temporalActions.snapshot()` dentro del commit |
| Change zones | `temporalActions.snapshot()` antes de `setClip()` |
| **Drag keyframe** | `onDragStart()` en mouseDown (snapshot una vez, NO en cada mouseMove) |
| **Drag bezier handle** | `onDragStart()` en mouseDown |
| Load clip / New clip | `resetWithClip()` — limpia historial, nuevo baseline |

### Keyboard shortcuts

| Shortcut | Acción |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+Y` | Redo (Windows convention) |

### UI

Dos botones `↩` / `↪` en el header bar, antes de NEW/SAVE. Estado disabled visual cuando stack vacío. Tooltip muestra profundidad del stack.

---

## ⚒️ FASE 1B: MULTI-SELECTION

### Mecanismos de selección

| Gesto | Efecto |
|-------|--------|
| Click en KF | Selección singular (limpia multi-select) |
| Shift+Click en KF | Toggle en el Set de selección |
| Rubber Band (drag en background) | Selecciona todos los KF dentro del rectángulo |
| Click en background vacío | Deselecciona todo |

### Arquitectura

```
index.tsx state:
  selectedKeyframeIdx: number | null     → Compatibilidad con Toolbar (single KF)
  selectedIndices: Set<number>           → Multi-selection set

CurveEditor props:
  selectedKeyframeIdx   → Single selection (legacy compat)
  selectedIndices       → Multi-selection set
  onMultiSelect         → Callback para actualizar el Set

isSelected = selectedKeyframeIdx === i || selectedIndices.has(i)
```

### Rubber Band

- **Inicio**: Left-click en background (`.heph-curve-bg`)
- **Render**: `<rect>` SVG azul semitransparente con borde dashed
- **Resolución**: En mouseUp, se calculan todos los KF cuyas coordenadas (toX, toY) caen dentro del rectángulo
- **Threshold**: 4px mínimo para considerarse drag vs click
- **Color**: `rgba(59, 130, 246, 0.12)` fill + `rgba(59, 130, 246, 0.6)` stroke

### Batch Move

Cuando `selectedIndices.size > 1` y el KF draggeado está en el set:
1. Se calcula el **delta** (timeMs + value) desde la posición original
2. Se aplica ese delta a TODOS los KF en el set
3. Se respetan los rangos min/max de la curva
4. Se re-ordena por timeMs al final (invariante de HephCurve)

Para color curves, el delta se calcula en espacio normalizado (hue 0-1) y se preservan S/L del original.

---

## 🔍 VERIFICACIÓN

- ✅ 0 errores TypeScript en `useTemporalStore.ts`
- ✅ 0 errores TypeScript en `CurveEditor.tsx`
- ✅ 0 errores TypeScript en `index.tsx`
- ✅ 0 errores CSS en `HephaestusView.css`
- ✅ Backward compatible (selectedKeyframeIdx + Toolbar siguen funcionando)
- ✅ No se usó Math.random(), no hay mocks, no hay simulaciones
- ✅ No hay dependencias nuevas

---

## 🩹 WAVE 2043.2: OPERATION ADHESIVE SQUAD — HOTFIXES

**Fecha**: 2026-02-16  
**Estado**: ✅ COMPLETO

### BUG #1: Rubber Band Invisible

**Síntoma**: El rubber band no arrancaba al hacer click en el background.

**Causa raíz**: `handleBackgroundMouseDown` filtraba por `classList.contains('heph-curve-bg')`. El `<rect>` del grid dots (fill="url(#heph-grid-dots)") se renderiza ENCIMA del background rect que tiene esa clase. Los clicks caían en el grid rect que NO tiene la clase → condición nunca se cumplía → rubber band nunca iniciaba.

**Fix**: Eliminé el filtro por className. Es innecesario porque los keyframes y handles ya hacen `e.stopPropagation()` — si un mouseDown llega al SVG, por definición ES espacio vacío. Añadí `rubberBandJustEndedRef` para suprimir el `onClick` que se dispara después del `mouseUp` del rubber band (evita que deseleccione lo que el rubber band acaba de seleccionar).

### BUG #2: Batch Move Roto

**Síntoma**: Al arrastrar un keyframe en multi-selección, los demás apenas se movían.

**Causa raíz**: Delta calculado desde estado MUTADO. CurveEditor enviaba `onKeyframeMove(index, absoluteTimeMs, absoluteValue)` → en `handleKeyframeMove`, el batch path hacía `deltaTimeMs = timeMs - existing.timeMs`. Pero `existing.timeMs` ya estaba mutado del frame anterior (porque `updateCurve` ya había cambiado el clip state) → delta ≈ 0 → drift exponencial.

**Fix arquitectónico** (NO un parche):

1. **`batchOriginRef`** en `index.tsx` — ref que captura las posiciones ORIGINALES de todos los keyframes seleccionados al inicio del drag
2. **`handleDragStartWithSnapshot()`** — reemplaza `temporalActions.snapshot` como `onDragStart`. Hace el snapshot temporal Y guarda las posiciones originales en el ref
3. **`onBatchKeyframeMove(deltaTimeMs, deltaValue)`** — nuevo prop REQUIRED en CurveEditor. Cuando hay multi-selección activa, CurveEditor envía DELTAS relativos al origen del drag, NO posiciones absolutas
4. **`handleBatchKeyframeMove()`** en `index.tsx` — aplica los deltas a las posiciones originales del `batchOriginRef`, no al estado mutado

**Flujo correcto**: drag start → snapshot originales → cada frame de mousemove calcula delta desde origen → delta se aplica a originales → resultado determinista siempre. Sin drift, sin acumulación de error.

---

## 🚑 WAVE 2043.3: OPERATION STICKY FINGERS

**Fecha**: 2026-02-16  
**Estado**: ✅ COMPLETO

### BUG #3: Click sobre Selección Destruye Multi-Select

**Síntoma**: Selecciono 3 keyframes con rubber band → clickeo uno para arrastrarlo → la selección se reduce a solo ese keyframe → batch move no funciona.

**Causa raíz**: `handleKeyframeMouseDown` SIEMPRE llamaba `onKeyframeSelect(index)` en mouseDown (excepto para Shift+Click y Right-Click). Esto ejecutaba `setSelectedIndices(new Set([index]))` en `handleKeyframeSelect`, destruyendo la multi-selección ANTES de que empezara el drag.

**Fix**: Modificar `handleKeyframeMouseDown` para ser más inteligente:

```tsx
const isClickingSelectedGroup = selectedIndices.size > 1 && selectedIndices.has(index)
if (!isClickingSelectedGroup) {
  onKeyframeSelect(index)  // Solo actualizar si NO clickeamos un miembro del grupo
}
```

**Lógica**: Si hago click en un keyframe que YA está en la multi-selección, asumo que quiero moverlos a todos — NO cambiar la selección. Solo actualizo la selección si clickeo un keyframe que NO es parte del grupo actual.

**Resultado**: "Formación militar" — selecciono 3 puntos, arrastro uno, los 3 se mueven en formación manteniendo sus distancias relativas.

---

## 🔍 VERIFICACIÓN FINAL

- ✅ 0 errores TypeScript en todos los archivos modificados
- ✅ Rubber band funciona (BUG #1 fix verificado)
- ✅ Batch move correcto sin drift (BUG #2 fix verificado)
- ✅ Click sobre grupo no destruye selección (BUG #3 fix verificado)
- ✅ Backward compatible
- ✅ No se usó Math.random(), no hay mocks, no hay simulaciones
- ✅ No hay dependencias nuevas

---

## 📋 PENDIENTES PARA SIGUIENTES WAVES

| # | Feature | Prioridad |
|---|---------|-----------|
| 3 | Copy/Paste keyframes | Alta |
| 4 | Delete de multi-selection (Delete key borra todos los seleccionados) | Alta |
| 5 | Snap-to-grid | Media |
| 6 | Keyboard nudge (←→ mueve KF seleccionados ±10ms) | Media |
| 7 | Batch interpolation change (seleccionar varios → cambiar interpolación) | Media |

---

---

## 🚀 WAVE 2043.4: OPERATION LIGHTSPEED

**Fecha**: 2026-02-16  
**Estado**: ✅ COMPLETO

Dos misiones para convertir edición manual en edición asistida de alta velocidad.

### 📋 MISIÓN 1: OPERATION COPYCAT (Clipboard Intelligence)

**Objetivo**: Copiar "formas", no posiciones absolutas. Permite duplicar estructuras rítmicas.

**Implementación**:

1. **`clipboardRef`** — Ref que almacena keyframes con tiempos RELATIVOS (normalizados a t=0)
2. **`handleCopyKeyframes()`** (Ctrl+C):
   - Filtra keyframes por `selectedIndices`
   - Ordena por tiempo ascendente
   - Normaliza: `relativeTimeMs = kf.timeMs - firstKeyframe.timeMs`
   - Preserva: value, interpolation, bezierHandles
3. **`handlePasteKeyframes()`** (Ctrl+V):
   - Lee `clipboardRef`
   - Usa `playheadMs` como baseTime
   - Inserta: `newTimeMs = baseTime + relativeTimeMs`
   - **Smart Select**: Auto-selecciona los keyframes pegados para workflow de "estampado"

**Workflow habilitado**: 
```
Seleccionar 3 KFs → Ctrl+C → Mover playhead → Ctrl+V → Arrastrar → Ctrl+V → Arrastrar...
```

**Undo compatible**: Snapshot se toma antes de paste.

### 🧲 MISIÓN 2: OPERATION MAGNETO (Magnetic Snap-to-Grid)

**Objetivo**: Precisión matemática al alinear keyframes a beats sin esfuerzo.

**Implementación**:

1. **Props añadidos a CurveEditor**:
   - `snapEnabled?: boolean` (default: true)
   - `beatDivisions?: number` (default: 8 = corcheas, 4 = negras)

2. **`beatGridLinesMs`** — useMemo que divide `durationMs / beatDivisions`

3. **`findNearestBeatGrid(timeMs)`** — Callback que encuentra la línea más cercana

4. **Lógica de imán en drag handler**:
   ```tsx
   if (snapEnabled && !e.shiftKey) {
     const nearest = findNearestBeatGrid(newTimeMs)
     const threshold = Math.min(visibleDurationMs * 0.02, 50)  // 2% o 50ms
     if (nearest.distance < threshold) {
       newTimeMs = nearest.timeMs  // ¡CLACK!
     }
   }
   ```

5. **Visual feedback**:
   - Líneas de beat grid tenues (dashed, rgba(255,107,43,0.12))
   - Línea de snap brillante cuando hace "clack" (rgba(255,107,43,0.9) + glow)

6. **Shift Override**: Mantener SHIFT desactiva el imán para micro-ajustes analógicos.

**Estado visual**:
- `isSnapping: boolean` — true mientras el keyframe está "pegado" al grid
- `snapLineX: number | null` — coordenada X de la línea de snap activa

---

## 🔍 VERIFICACIÓN WAVE 2043.4

- ✅ 0 errores TypeScript en todos los archivos modificados
- ✅ Clipboard copia tiempos relativos (formas, no absolutos)
- ✅ Paste usa playheadMs como base
- ✅ Smart Select auto-selecciona keyframes pegados
- ✅ Beat grid visual con líneas dashed
- ✅ Snap magnético funciona (threshold 2% o 50ms)
- ✅ Shift desactiva snap para micro-ajustes
- ✅ Línea brillante cuando hace snap
- ✅ Undo compatible (snapshot antes de paste)

---

*OPERATION VULCAN — Forged in the fires of Mount Code.*

---

## ⚒️ WAVE 2043.5: OPERATION UNSTUCK — Playhead Scrubbing + Context Menus

**Fecha**: 2026-02-16  
**Operador**: PunkOpus  
**Estado**: ✅ COMPLETA

### 🎯 OBJETIVO
El playhead estaba congelado en t=0. Implementar scrubbing interactivo + context menus inteligentes.

### 📋 PRIORIDAD 0: PLAYHEAD SCRUBBING

**Problema**: `playheadMs` se inicializaba en `useState(0)` pero no existía NINGÚN mecanismo para actualizarlo. El usuario no podía mover el playhead.

**Solución Arquitectónica**:

1. **Nuevo DragState `'scrub'`** — el playhead drag es un tipo de drag de primera clase, no un hack.
2. **Ruler Area interactiva** — `<rect>` transparente sobre la zona del ruler (0 a PADDING.top) con `cursor: col-resize`.
3. **`handleRulerMouseDown`** — click izquierdo en el ruler calcula `fromX(pt.x)` → timeMs y llama `onScrub(timeMs)`. Inicia drag tipo `'scrub'`.
4. **Drag continuo** — en el `handleMouseMove` del useEffect global, si `drag.type === 'scrub'`, se actualiza el playhead en tiempo real.
5. **Prop `onScrub?: (timeMs: number) => void`** — callback puro, CurveEditor no muta estado del padre.
6. **index.tsx**: `onScrub={setPlayheadMs}` — directo, limpio, sin intermediarios.
7. **Playhead SVG** ahora tiene `pointerEvents="none"` para no interferir con el ruler clickeable.

**Archivos**: `CurveEditor.tsx`, `index.tsx`

### 📋 PRIORIDAD 1: CONTEXT MENUS INTELIGENTES

**Problema**: Solo existía context menu para keyframes (interpolación, audio binding, delete). No había Copy en el menú, ni Paste Here en el background.

**Solución Arquitectónica**:

1. **`ContextMenuState` extendida** — nuevo campo `menuType: 'keyframe' | 'background'` y `clickTimeMs?: number`.
2. **`handleContextMenu` inteligente** — right-click en plot area abre background menu con `clickTimeMs` calculado desde la posición X del click.
3. **`BackgroundContextMenu`** (nuevo componente) — muestra "📋 Paste Here (Xms)" con el tiempo exacto del click. Deshabilitado si clipboard está vacío.
4. **`KeyframeContextMenu` ampliado** — nuevo prop `onCopy?: () => void`, añade botón "📋 Copy Selection" al menú de keyframe.
5. **`handlePasteAtTime(timeMs: number)`** (nuevo handler en index.tsx) — misma lógica que `handlePasteKeyframes` pero usa la posición del click en vez de playheadMs. También mueve el playhead a la posición del paste.
6. **Props nuevos en CurveEditor**: `onCopyKeyframes`, `onPasteAtTime`, `hasClipboard`.

**Archivos**: `CurveEditor.tsx`, `index.tsx`, `KeyframeContextMenu.tsx`

### 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `CurveEditor.tsx` | +Props (onScrub, onCopyKeyframes, onPasteAtTime, hasClipboard). DragState 'scrub'. handleRulerMouseDown. handleContextMenu inteligente. Ruler rect. Background context menu. |
| `index.tsx` | +handlePasteAtTime. Props al CurveEditor (onScrub, onCopy, onPaste, hasClipboard). |
| `KeyframeContextMenu.tsx` | +onCopy prop. +BackgroundContextMenu componente. |

### 🔍 VERIFICACIÓN WAVE 2043.5

- ✅ 0 errores TypeScript en los 3 archivos
- ✅ Scrub click en ruler → playhead se mueve al tiempo exacto
- ✅ Scrub drag continuo → playhead sigue el cursor en tiempo real
- ✅ Right-click en keyframe → menú con Delete + Copy + Interpolation + Audio
- ✅ Right-click en background → menú "Paste Here (Xms)"
- ✅ Paste Here usa coordenada X del click, NO playheadMs
- ✅ Clipboard vacío → Paste Here deshabilitado (visual feedback)
- ✅ Playhead SVG no bloquea clicks (pointerEvents: none)
- ✅ Undo compatible (snapshot antes de paste)

---

*OPERATION UNSTUCK — The playhead is free.*

---

## 🧲 WAVE 2043.6: OPERATION METRONOME — El Grid Musical

**Fecha**: 2026-02-16  
**Operador**: PunkOpus  
**Estado**: ✅ COMPLETA

### 🎯 OBJETIVO
El grid vertical pintaba líneas cada 1000ms (o intervalos "nice" arbitrarios). Esto NO sirve para música. Un clip de Hephaestus es una unidad musical (loop). Las líneas deben ser rítmicas.

### 🔥 PROBLEMA IDENTIFICADO
- `generateTimeGridLines()` calculaba intervalos basados en rango visible / 12, eligiendo de `[100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000]` ms.
- Para un clip de 2000ms, pintaba líneas cada 200ms → SIN RELACIÓN CON EL RITMO.
- El beat grid de WAVE 2043.4 era un overlay encima del time grid, redundante y confuso visualmente.

### ⚒️ SOLUCIÓN ARQUITECTÓNICA

**ELIMINADO**: `generateTimeGridLines()` y `timeGridLines` useMemo. Código muerto, eliminado sin piedad.

**REEMPLAZADO**: Grid vertical ahora es 100% musical con DOS niveles de jerarquía:

#### Nivel 1 — PRIMARIAS (Negras / Beats)
- `beatGridPrimary = durationMs / (beatDivisions / 2)` → Para default 8 = **4 líneas** (25%, 50%, 75%)
- Estilo: solid, `rgba(255,255,255,0.10)`, con label de tiempo
- Excluye t=0 y t=durationMs (son los bordes del clip)

#### Nivel 2 — SECUNDARIAS (Corcheas / Subdivisions)
- `beatGridSecondary` = todas las líneas de `beatDivisions` que NO son primarias
- Estilo: dashed (`4 4`), `rgba(255,255,255,0.05)`, sin labels
- No duplica las líneas primarias (filtrado exacto)

#### Snap unificado
- `beatGridLinesMs = [...primary, ...secondary].sort()` → snap magnético atrae a TODAS las divisiones
- Threshold: `min(visibleDurationMs * 2%, 50ms)` — sin cambios

#### The Wall (Clamp estricto)
- Drag keyframe: `Math.max(0, Math.min(newTimeMs, durationMs))` ✅
- Double-click add: `Math.max(0, Math.min(fromX(pt.x), durationMs))` ✅
- Scrub: `Math.max(0, Math.min(fromX(pt.x), durationMs))` ✅
- **Ningún keyframe puede existir fuera de [0, durationMs].**

### 📊 EJEMPLO CONCRETO (durationMs = 2000, beatDivisions = 8)

```
Grid Musical:

t=0    250    500    750   1000   1250   1500   1750   2000
│      ╎      │      ╎      │      ╎      │      ╎      │
│      ╎      │      ╎      │      ╎      │      ╎      │
CLIP   sub    BEAT   sub    BEAT   sub    BEAT   sub    CLIP
START                                                    END

│ = PRIMARY (beat, solid line, label)
╎ = SECONDARY (subdivision, dashed, no label)

Snap targets: 0, 250, 500, 750, 1000, 1250, 1500, 1750, 2000
```

### 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `CurveEditor.tsx` | -`generateTimeGridLines` (eliminada). -`timeGridLines` useMemo (eliminado). +`beatGridPrimary` useMemo. +`beatGridSecondary` useMemo. `beatGridLinesMs` = primary+secondary combinado. SVG render reemplazado: time grid → musical grid 2 niveles. |

### 🔍 VERIFICACIÓN WAVE 2043.6

- ✅ 0 errores TypeScript
- ✅ Grid vertical 100% musical (sin líneas cada 1000ms)
- ✅ Negras visibles (solid, con label)
- ✅ Corcheas sutiles (dashed, sin label)
- ✅ No hay duplicación de líneas (secondary excluye primary)
- ✅ Snap magnético funciona en TODAS las divisiones
- ✅ Clamp hermético en [0, durationMs] — The Wall
- ✅ `beatDivisions` prop sigue siendo configurable (4=negras only, 8=corcheas, 16=semicorcheas)
- ✅ Código muerto eliminado (`generateTimeGridLines`, `timeGridLines`)

---

*OPERATION METRONOME — The grid now speaks music, not milliseconds.*

---

## 🎼 WAVE 2043.7: OPERATION SHEET MUSIC — Visual Hierarchy

**Fecha**: 2026-02-16  
**Operador**: PunkOpus  
**Estado**: ✅ COMPLETA

### 🎯 OBJETIVO
El grid magnético funciona perfectamente, pero la UI **RULER** sigue mostrando tiempo en milisegundos/segundos (`0s`, `0.5s`, `1.0s`). Esto rompe la inmersión de "Edición Musical". Un clip de Hephaestus es un **loop musical**, no un cronómetro de laboratorio.

### 🔥 PROBLEMA IDENTIFICADO
- Labels del ruler: `formatTimeLabel(t)` → `"0ms"`, `"500ms"`, `"1.0s"`
- Para un músico, esto es ruido cognitivo. Quieren ver **beats**, no milisegundos.
- Jerarquía visual débil: líneas primarias (beats) y secundarias (subdivisions) tenían opacidades muy similares (0.10 vs 0.05).

### ⚒️ SOLUCIÓN ARQUITECTÓNICA

#### 1. Notación Musical en Labels

**ELIMINADO**: `formatTimeLabel(t)` del renderizado (función preservada por si acaso).

**NUEVO**: `formatMusicalLabel(beatIndex: number)` → devuelve `"1"`, `"2"`, `"3"`, `"4"`

**Asunción**: El clip completo = **1 BAR en 4/4** (estándar para loops de música electrónica).
- 4 beats por bar
- Cada beat = `durationMs / 4`
- Labels se alinean EXACTAMENTE con las líneas del grid primario

**Ejemplo** (durationMs = 2000ms, beatDivisions = 8):
```
Grid Visual:

0ms        500ms       1000ms      1500ms      2000ms
│          ╎   │   ╎   │   ╎   │   ╎   │
CLIP       1           2           3           4        CLIP
START                                                   END

Labels: "1" en 500ms, "2" en 1000ms, "3" en 1500ms
```

#### 2. Jerarquía Visual Reforzada

**PRIMARIAS (Beats)**:
- Antes: `stroke="rgba(255,255,255,0.10)"`, `strokeWidth="1"`
- **Ahora**: `stroke="rgba(255,255,255,0.20)"`, `strokeWidth="1"` — **2x más visible**
- Labels: `fill="rgba(255,255,255,0.35)"`, `fontSize="11"`, `fontWeight="500"` — **más brillantes y bold**

**SECUNDARIAS (Subdivisions)**:
- Antes: `stroke="rgba(255,255,255,0.05)"`, `strokeWidth="1"`
- **Ahora**: `stroke="rgba(255,255,255,0.05)"`, `strokeWidth="0.5"` — **más sutiles**
- Sin labels (solo líneas dashed)

**Contraste visual**: Primary/Secondary opacity ratio = **4:1** (antes era 2:1). La jerarquía ahora es obvia.

### 📊 COMPARATIVA VISUAL

```
ANTES (WAVE 2043.6):
Grid: rgba(255,255,255,0.10) ---- rgba(255,255,255,0.05)
      │                ╎          │                ╎
      500ms            750ms      1000ms           1250ms
      
      Contraste débil, todo parece igual

AHORA (WAVE 2043.7):
Grid: rgba(255,255,255,0.20) ---- rgba(255,255,255,0.05)
      │                ╎          │                ╎
      1                           2
      
      Beats destacan claramente, subdivisions son guías sutiles
      Notación musical familiar para DJs/Producers
```

### 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `CurveEditor.tsx` | +`formatMusicalLabel(beatIndex)`. Primary grid: opacity 0.10→0.20, label text opacity 0.25→0.35, fontSize 10→11, fontWeight 500. Secondary grid: strokeWidth 1→0.5. Labels usan `formatMusicalLabel(i)` en vez de `formatTimeLabel(t)`. |

### 🔍 VERIFICACIÓN WAVE 2043.7

- ✅ 0 errores TypeScript
- ✅ Ruler labels muestran beats (1, 2, 3, 4), NO milisegundos
- ✅ Labels alineados EXACTAMENTE con líneas del grid primario
- ✅ Beats 2x más visibles (opacity 0.20 vs 0.10)
- ✅ Subdivisions más sutiles (strokeWidth 0.5 vs 1)
- ✅ Jerarquía visual clara: 4:1 contrast ratio
- ✅ Estética inspirada en Ableton Live/FL Studio
- ✅ `formatTimeLabel` preservada (por si se necesita en tooltips)

---

*OPERATION SHEET MUSIC — Your ears hear beats. Now your eyes do too.*

---

## 🧠 WAVE 2043.8: OPERATION TOTAL RECALL — Viewport Persistence

**Fecha**: 2026-02-16  
**Operador**: PunkOpus  
**Estado**: ✅ COMPLETA

### 🎯 OBJETIVO
El usuario está ajustando un detalle en el segundo 45. Cambia de **Pan** a **Tilt** para ajustar la otra coordenada... y el editor **SALTA al segundo 0** con zoom reseteado. Esto **rompe el Flow State**.

**Solución**: El viewport (zoom + scrollX) debe **persistir** entre cambios de canal.

### 🔥 PROBLEMA IDENTIFICADO
- Al cambiar de parámetro (`activeParam`), CurveEditor se desmonta/remonta.
- El viewport local (`useState<Viewport>`) se pierde.
- El usuario **PIERDE contexto visual** → frustración.
- Imposible alinear verticalmente keyframes de Pan con keyframes de Tilt.

### ⚒️ SOLUCIÓN ARQUITECTÓNICA

#### 1. Viewport State en `useTemporalStore`

**NUEVO**: Añadido `ViewportState` al store temporal:

```typescript
export interface ViewportState {
  zoom: number      // 1.0 = 100%, 2.0 = 200%
  scrollX: number   // Posición horizontal en px
}

export interface TemporalState {
  clip: HephAutomationClip
  canUndo: boolean
  canRedo: boolean
  undoDepth: number
  redoDepth: number
  viewport: ViewportState  // ⚡ NUEVO
}

export interface TemporalActions {
  setClip: ...
  snapshot: ...
  undo: ...
  redo: ...
  clearHistory: ...
  resetWithClip: ...
  setViewport: (viewport: Partial<ViewportState>) => void  // ⚡ NUEVO
}
```

**Decisión clave**: Viewport **NO** se guarda en undo/redo history. Es UI state, no document state.

**Implementación**:
```typescript
const [viewport, setViewportInternal] = useState<ViewportState>({
  zoom: 1.0,
  scrollX: 0,
})

const setViewport = useCallback((partial: Partial<ViewportState>) => {
  setViewportInternal(prev => ({ ...prev, ...partial }))
}, [])
```

#### 2. CurveEditor Persistence Props

**NUEVAS PROPS**:
```typescript
interface CurveEditorProps {
  // ... props existentes
  
  /** ⚒️ WAVE 2043.8: Initial viewport from persistence layer */
  initialViewport?: { zoom: number; scrollX: number }
  
  /** ⚒️ WAVE 2043.8: Save viewport on unmount/channel change */
  onViewportChange?: (viewport: { zoom: number; scrollX: number }) => void
}
```

#### 3. Restauración de Viewport (Mount)

**useEffect** que ejecuta **UNA VEZ** cuando dimensions están listas:

```typescript
const viewportRestoredRef = useRef(false)

useEffect(() => {
  if (!initialViewport || viewportRestoredRef.current || dimensions.width === 0) return
  
  // Convertir scrollX (px) → panOffsetMs (ms)
  // panOffsetMs = scrollX * (durationMs / width)
  const restoredPanOffsetMs = (initialViewport.scrollX * durationMs) / dimensions.width
  
  setViewport({
    zoom: initialViewport.zoom,
    panOffsetMs: Math.max(0, restoredPanOffsetMs),
  })
  
  viewportRestoredRef.current = true
}, [initialViewport, dimensions.width, durationMs])
```

**Por qué `scrollX` en vez de `panOffsetMs`**:  
`scrollX` (px) es **independiente del canvas width**. Permite restaurar viewport incluso si el canvas resize ocurrió.

#### 4. Guardado de Viewport (Unmount)

**useEffect cleanup** que ejecuta al desmontar o cambiar canal:

```typescript
useEffect(() => {
  return () => {
    if (onViewportChange) {
      // Convertir panOffsetMs (ms) → scrollX (px)
      // scrollX = panOffsetMs * (width / durationMs)
      const scrollX = (viewport.panOffsetMs * dimensions.width) / durationMs
      onViewportChange({ zoom: viewport.zoom, scrollX })
    }
  }
}, [viewport, dimensions.width, durationMs, onViewportChange])
```

**Trigger**: Se ejecuta cuando `curve.paramId` cambia (componente se desmonta).

#### 5. Conexión en HephaestusView

```tsx
<CurveEditor
  // ... props existentes
  initialViewport={temporal.viewport}
  onViewportChange={temporalActions.setViewport}
/>
```

### 📊 FLUJO COMPLETO

```
CASO DE USO: Usuario ajusta Pan en segundo 45, zoom 2x, luego cambia a Tilt

1. Usuario en Pan, scrollX = 800px, zoom = 2.0
   └─> CurveEditor viewport local: { panOffsetMs: ~1500, zoom: 2.0 }

2. Usuario cambia activeParam: 'pan' → 'tilt'
   └─> CurveEditor unmount cleanup ejecuta:
       └─> onViewportChange({ zoom: 2.0, scrollX: 800 })
       └─> useTemporalStore.setViewport({ zoom: 2.0, scrollX: 800 })

3. CurveEditor (Tilt) monta con initialViewport = { zoom: 2.0, scrollX: 800 }
   └─> Restauration useEffect ejecuta:
       └─> panOffsetMs = (800 * durationMs) / width
       └─> setViewport({ zoom: 2.0, panOffsetMs })

4. RESULTADO: Usuario sigue en segundo 45, zoom 2x, en canal Tilt
   └─> PUEDE COMPARAR VISUALMENTE Pan vs Tilt keyframes
```

### 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `useTemporalStore.ts` | +`ViewportState` interface. +`viewport` state (no guardado en undo/redo). +`setViewport()` action. |
| `CurveEditor.tsx` | +`initialViewport` + `onViewportChange` props. +`viewportRestoredRef` para one-time restore. +useEffect restauración (mount). +useEffect guardado (cleanup/unmount). |
| `index.tsx` | Pasa `initialViewport={temporal.viewport}` + `onViewportChange={temporalActions.setViewport}` a CurveEditor. |

### 🔍 VERIFICACIÓN WAVE 2043.8

- ✅ 0 errores TypeScript
- ✅ Viewport persiste entre cambios de canal (Pan → Tilt → Color)
- ✅ Zoom level se mantiene
- ✅ Scroll position se mantiene (alineación vertical)
- ✅ Restauración ocurre UNA VEZ (no en cada render)
- ✅ Guardado ocurre en cleanup (unmount + channel change)
- ✅ Viewport NO afecta undo/redo history (UI state separado)
- ✅ Conversión scrollX ↔ panOffsetMs precisa (sin drift)

### 🎨 EXPERIENCIA FINAL

Un producer está ajustando un **Pan sweep** en el drop (segundo 45, zoom 3x para precisión). Quiere que el **Tilt** se mueva **sincronizado** con Pan (mismo timing, diferente eje).

**ANTES (WAVE 2043.7)**:  
Cambia de Pan a Tilt → editor salta al inicio, zoom 1x → tiene que navegar de vuelta al segundo 45 → pierde el contexto visual → no puede comparar fácilmente.

**AHORA (WAVE 2043.8)**:  
Cambia de Pan a Tilt → **mismo viewport exacto** → ve ambos canales en la **misma posición temporal** → alinea keyframes verticalmente → workflow fluido.

---

*OPERATION TOTAL RECALL — The Forge Never Forgets.*

---

## 🧹 WAVE 2043.9: OPERATION CLEAN SWEEP & HUMILIATION

**Fecha**: 2026-02-16  
**Operador**: PunkOpus  
**Estado**: ✅ COMPLETA

### 🎯 OBJETIVO
Dos misiones críticas para pulir la UX de Hephaestus:

1. **ZOMBIE KILLER**: Arreglar lógica corrupta en zone selector (ALL + specific zones = estado imposible)
2. **CLONING PROTOCOL**: Implementar SAVE AS para crear variantes sin destruir el original

### 🧟 MISIÓN 1: ZOMBIE KILLER — Zone Logic Fix

#### 🔥 PROBLEMA IDENTIFICADO
El selector de zonas permitía **estados corruptos** como `['all', 'all-left', 'front']`.

**Lógica incorrecta**: ALL puede convivir con otras zonas → **IMPOSIBLE LÓGICAMENTE**.

**Si eres TODO, no eres una parte. Si eres una parte, no eres TODO.**

#### ⚒️ SOLUCIÓN ARQUITECTÓNICA

**Regla 1**: Si clicas ALL → borra TODO lo demás, queda solo `['all']`.

**Regla 2**: Si clicas cualquier zona específica (ej: `all-left`) → **mata ALL automáticamente**.

**Edge case**: Si deseleccionas la última zona → queda `[]` (clip "muted", sin target).

**Implementación** (`SmartZoneSelector.tsx`):

```typescript
const toggleZone = (zoneId: EffectZone) => {
  if (disabled) return

  // ⚒️ WAVE 2043.9: ALL is exclusive
  if (zoneId === 'all') {
    // Clicking ALL → clear everything else, set to ['all']
    onZonesChange(['all'])
    return
  }

  // Clicking any other zone → KILL 'all' automatically
  let next = selectedZones.filter(z => z !== 'all')

  // Toggle the zone
  if (next.includes(zoneId)) {
    next = next.filter(z => z !== zoneId)
  } else {
    next = [...next, zoneId]
  }

  // Edge case: if user deselects the last zone, leave empty (muted clip)
  onZonesChange(next)
}
```

#### 🔍 CASOS DE PRUEBA

| Estado inicial | Acción | Estado final |
|---------------|--------|-------------|
| `['all']` | Click `all-left` | `['all-left']` (ALL killed) |
| `['all-left']` | Click `all` | `['all']` (left killed) |
| `['all-left', 'front']` | Click `all` | `['all']` (both killed) |
| `['all']` | Click `all` | `['all']` (no change) |
| `['all-left']` | Click `all-left` | `[]` (empty, muted) |

### 💾 MISIÓN 2: CLONING PROTOCOL — SAVE AS

#### 🔥 PROBLEMA IDENTIFICADO
No hay forma de crear **variantes** de un clip sin sobrescribir el original.

**Use case**: Tengo "Rainbow Sweep.lfx". Quiero hacer "Rainbow Sweep Fast.lfx" y "Rainbow Sweep Slow.lfx", pero editando el original lo pierdo.

#### ⚒️ SOLUCIÓN ARQUITECTÓNICA

**UI**: Botón `📑 SAVE AS...` al lado de `💾 SAVE` en header.

**Lógica** (`handleSaveAs` in `index.tsx`):

```typescript
const handleSaveAs = useCallback(async () => {
  // 1. Deep clone current clip
  const clonedClip = structuredClone(clip)
  
  // 2. Generate NEW UUID (VITAL — prevents overwriting original)
  clonedClip.id = crypto.randomUUID()
  
  // 3. Add "(Copy)" suffix to name
  clonedClip.name = `${clip.name} (Copy)`
  
  // 4. Save new file
  const serialized = serializeHephClip(clonedClip)
  const result = await window.luxsync.hephaestus.save(serialized)
  
  // 5. Switch editor to point to NEW clip (not original)
  temporalActions.resetWithClip(clonedClip)
  setIsDirty(false)
  
  // 6. Refresh library to show new clone
  await loadLibrary()
}, [clip, temporalActions, loadLibrary])
```

**Garantías**:
- ✅ Nuevo UUID → nunca sobrescribe el original
- ✅ Nombre con sufijo " (Copy)" → diferenciable visualmente
- ✅ Editor switch → continúas editando el CLONE, no el original
- ✅ Library refresh → nuevo clip aparece inmediatamente

#### 📊 WORKFLOW COMPLETO

```
Usuario edita "My Effect.lfx"
  ├─ Hace cambios experimentales
  ├─ Click "SAVE AS..."
  │
  └─> Sistema:
      ├─ Clone: structuredClone(clip)
      ├─ Nuevo ID: crypto.randomUUID()
      ├─ Nombre: "My Effect (Copy)"
      ├─ Guarda archivo nuevo
      └─> Editor apunta a "My Effect (Copy)"
  
Resultado:
  - "My Effect.lfx" → INTACTO (original preservado)
  - "My Effect (Copy).lfx" → NUEVO archivo con cambios
  - Editor trabaja en el COPY, no en el original
```

### 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `SmartZoneSelector.tsx` | Fix `toggleZone` logic: ALL exclusivo, auto-kill cuando se selecciona otra zona. |
| `index.tsx` | +`handleSaveAs()` function. +Botón "SAVE AS..." en header. structuredClone + crypto.randomUUID() + nombre con sufijo. |

### 🔍 VERIFICACIÓN WAVE 2043.9

- ✅ 0 errores TypeScript
- ✅ Zone logic fix: ALL es exclusivo, mutuamente excluyente
- ✅ Clicar ALL borra todas las zonas específicas
- ✅ Clicar zona específica mata ALL automáticamente
- ✅ SAVE AS crea nuevo UUID
- ✅ SAVE AS añade " (Copy)" al nombre
- ✅ Editor switch a clone después de SAVE AS
- ✅ Library refresh muestra nuevo archivo
- ✅ Original no se sobrescribe NUNCA

---

*OPERATION CLEAN SWEEP & HUMILIATION — Zombies exterminated. Clones perfected.*
