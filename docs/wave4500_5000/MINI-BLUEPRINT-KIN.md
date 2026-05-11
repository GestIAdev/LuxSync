# MINI-BLUEPRINT-KIN.md
## ⚡ WAVE 4567 — THE CATHEDRAL RESET

> *El OrthoRadar intentó ser tres cosas a la vez. No seas tres cosas. Sé el router que invoca a la cosa correcta.*

**Date:** 2026-05-05
**Author:** Cascade (Opus)
**Status:** MINI-BLUEPRINT — Reset al 90%
**Supersedes:** §2 (OrthoRadar) y §6.3 (Megavista) de KINETICS-UI-BLUEPRINT.md
**Preserves:** §3 (Chaos Engine), §4 (TacticalFaders), §5 (PatternArsenal), §8 (movementStore)

---

## DIAGNÓSTICO: ¿Por Qué Falló el OrthoRadar?

| Síntoma | Causa raíz |
|---|---|
| Pérdida de legibilidad espacial | Un solo componente de 410 líneas intenta renderizar Classic (degrees) y Spatial (meters) con lógica condicional entrelazada. Los ejes cambian de semántica según el modo. |
| Routing Individual↔Formación roto | OrthoRadar no distingue entre 1 fixture y N fixtures. No hay ghost points en Classic mode. El RadarXY original sí los tenía. |
| Context switching para seleccionar | La sidebar Cathedral no tiene mecanismo de selección de fixtures. El usuario debe salir al canvas 2D/3D para click/lasso. |
| TacticalFader preventDefault bug | `onWheel` usa `e.preventDefault()` en un handler React sintético. Chrome marca `wheel` como passive listener por defecto en React, causando `Unable to preventDefault inside passive event listener`. |
| Scroll obligatorio en sidebar | Los TacticalFaders verticales (280px) + PatternArsenal + ChaosSlider + Footer exceden la altura disponible de la sidebar. |

**Decisión:** No fusionar radares. Reutilizar `XYPad.tsx`, `RadarXY.tsx` y `SpatialTargetPad.tsx` tal cual. El nuevo código es solo **el router que los monta** y **las mejoras de layout**.

---

## §1. PILAR 1 — LA TRINIDAD DE LOS RADARES (Routing Inteligente)

### §1.1 Algoritmo del Router

El `KinRadarViewport` deja de montar `OrthoRadar` y pasa a ser un **router puro** que evalúa el estado y monta UNO de los tres componentes clásicos:

```typescript
/**
 * WAVE 4567: THE TRINITY ROUTER
 *
 * Evalúa selectedIds + radarMode + fixtureCount y monta el componente
 * clásico correcto en el Main Viewport (100% del área de lienzo).
 *
 * Tabla de verdad:
 * ┌─────────────────────────┬──────────────────────┬────────────────────────┐
 * │ Condición               │ radarMode            │ Componente montado     │
 * ├─────────────────────────┼──────────────────────┼────────────────────────┤
 * │ 0 fixtures seleccionados│ (cualquiera)         │ <EmptyState />         │
 * │ 0 moving heads          │ (cualquiera)         │ <StaticWarning />      │
 * │ 1 moving head, classic  │ 'classic'            │ <XYPad />              │
 * │ N moving heads, classic │ 'classic'            │ <RadarXY />            │
 * │ N moving heads, spatial │ 'spatial'            │ <SpatialTargetPad />   │
 * │ 1 moving head, spatial  │ 'spatial'            │ <SpatialTargetPad />   │
 * └─────────────────────────┴──────────────────────┴────────────────────────┘
 */

function resolveRadarComponent(
  movingHeadCount: number,
  radarMode: RadarMode,
): 'xypad' | 'radarxy' | 'spatial' | 'empty' | 'static-warning' {
  if (movingHeadCount === 0) return 'empty'  // o 'static-warning' si hay selección
  if (radarMode === 'spatial') return 'spatial'
  if (movingHeadCount === 1) return 'xypad'
  return 'radarxy'
}
```

**En JSX (KinRadarViewport.tsx):**

```tsx
const radarKey = resolveRadarComponent(movingHeadIds.length, radarMode)

return (
  <div className="kin-radar-viewport">
    <div className="kin-radar-viewport__header">
      <span>{RADAR_LABELS[radarKey]}</span>
      <PositionReadout mode={radarMode} pan={pan} tilt={tilt} target={spatialTarget} />
    </div>

    <div className="kin-radar-viewport__canvas">
      {radarKey === 'xypad' && (
        <XYPad
          pan={pan}
          tilt={tilt}
          onChange={handleClassicChange}
          onCenter={handleCenter}
        />
      )}
      {radarKey === 'radarxy' && (
        <RadarXY
          pan={pan}
          tilt={tilt}
          onChange={handleClassicChange}
          onCenter={handleCenter}
          isGroupMode={true}
          ghostPoints={ghostPoints}
          fixtureCount={movingHeadIds.length}
        />
      )}
      {radarKey === 'spatial' && (
        <SpatialTargetPad
          target={spatialTarget}
          onChange={handleSpatialChange}
          fixtures={spatialFixtureGhosts}
          stage={stage}
          reachabilityMap={spatialReachability}
          fanMode={spatialFanMode}
          onFanModeChange={setSpatialFanMode}
          fanAmplitude={spatialFanAmplitude}
          onFanAmplitudeChange={setSpatialFanAmplitude}
          subTargets={spatialSubTargets}
          onCenter={handleSpatialCenter}
        />
      )}
      {radarKey === 'empty' && <EmptyRadarState />}
      {radarKey === 'static-warning' && <StaticFixtureWarning />}
    </div>
  </div>
)
```

### §1.2 Escalado Visual a Pantalla Completa

**Problema:** Los 3 componentes fueron diseñados para 450px de sidebar. El Main Viewport tiene ~900-1400px de ancho.

**Solución:** Los tres componentes ya usan **CSS relative sizing**:
- `XYPad`: Container es `width: 100%`, cursor usa `left/top %`. ✅ Escala nativamente.
- `RadarXY`: Container `width: 100%`, `aspect-ratio: 2/1`, ghosts usan `left/top %`. ✅ Escala nativamente.
- `SpatialTargetPad`: Container `width: 100%`, grid `aspect-ratio: 1`, ghosts usan `left/top %`, SVG rays usan viewBox `0 0 100 100`. ✅ Escala nativamente.

**Lo que hay que corregir:**

1. **`RadarXY.css` → `max-height: 180px`** — Este cap impide que el radar crezca. **Eliminar o condicionalizar.**
2. **`SpatialTargetPad.css` → `max-height: 220px`** en `.spatial-pad-grid` — Mismo problema.
3. **Font sizes** — 8-11px son legibles a 200px pero minúsculos a 800px. Las labels necesitan escalar.

**Solución CSS: Wrapper con override de constraints:**

```css
/* ── KinRadarViewport: wrapper que libera los constraints de la sidebar ── */
.kin-radar-viewport__canvas {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  min-height: 0;            /* crucial para que flex child no desborde */
}

/* ── Override max-height caps de los radares originales ── */
.kin-radar-viewport__canvas .radar-xy {
  max-height: none;          /* KILL the 180px cap */
  aspect-ratio: 4 / 3;      /* más cuadrado para llenar viewport */
  max-width: 100%;
  max-height: 100%;          /* bounded by flex parent */
}

.kin-radar-viewport__canvas .spatial-pad-grid {
  max-height: none;          /* KILL the 220px cap */
  max-width: 100%;
  max-height: 100%;
}

/* ── Escalar fonts proporcionalmente ── */
.kin-radar-viewport__canvas .radar-labels,
.kin-radar-viewport__canvas .radar-coords,
.kin-radar-viewport__canvas .spatial-coord-axis,
.kin-radar-viewport__canvas .spatial-coord-value {
  font-size: clamp(9px, 1.2vw, 16px);
}

.kin-radar-viewport__canvas .ghost-dot {
  width: clamp(8px, 1vw, 16px);
  height: clamp(8px, 1vw, 16px);
}

.kin-radar-viewport__canvas .cursor-core {
  width: clamp(12px, 1.5vw, 24px);
  height: clamp(12px, 1.5vw, 24px);
}
```

**Principio:** No tocar los CSS originales de los componentes (sidebar sigue usándolos). Los overrides viven exclusivamente en `KinRadarViewport.css` con selectores de descendencia `.kin-radar-viewport__canvas .radar-xy`.

### §1.3 Aspect Ratio del Viewport

El Main Viewport es un rectángulo horizontal (~16:9). Los radares son cuadrados o 2:1. La solución:

```css
.kin-radar-viewport__canvas {
  /* Centra el radar en el viewport con padding uniforme */
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Cada radar se auto-contiene en su aspect-ratio natural */
.kin-radar-viewport__canvas > * {
  max-width: min(100%, 800px);   /* cap para que no sea grotescamente ancho */
  max-height: 100%;
  width: 100%;
}
```

En pantallas ultra-wide, el radar se centena a 800px max-width. En pantallas normales, usa todo el espacio.

---

## §2. PILAR 2 — LA MATRIZ DE SELECCIÓN (Zero Context Switching)

### §2.1 El Problema

Para seleccionar fixtures, el operador debe:
1. Cerrar KINETICS → volver a CONTROLS
2. Ir a la tab GROUPS en StageSidebar
3. Seleccionar un grupo → auto-switch a CONTROLS
4. Volver a activar KINETICS

**Eso son 4 clicks y 2 cambios de contexto mental.** Inaceptable en directo.

### §2.2 Solución: Dual Sub-Tab en la Sidebar Cathedral

La sidebar de KineticsCathedral (450px) se divide en 2 sub-pestañas internas:

```
┌──────────────────────────────────────────────┐
│  ⊕ KINETICS CATHEDRAL              [✕]     │
├──────────────┬───────────────────────────────┤
│  [KINETICS]  │  [FIXTURE MATRIX]            │  ← Sub-tabs
├──────────────┴───────────────────────────────┤
│                                               │
│  (contenido según sub-tab activa)            │
│                                               │
└──────────────────────────────────────────────┘
```

### §2.3 Sub-Tab KINETICS (default)

Contenido actual: ModeBar, TacticalFaders, ChaosSlider, PatternArsenal, Footer.
Sin cambios respecto a lo que ya existe en `KineticsCathedral.tsx`.

### §2.4 Sub-Tab FIXTURE MATRIX

**Componente nuevo: `FixtureMatrix.tsx`**

Un grid compacto de botones, uno por fixture del show. Permite seleccionar/deseleccionar fixtures **sin salir de la Cathedral**.

```
┌──────────────────────────────────────────────┐
│  FIXTURE MATRIX                 [ALL] [NONE] │
├──────────────────────────────────────────────┤
│  MOVING HEADS                                │
│  [MH-1] [MH-2] [MH-3] [MH-4] [MH-5] [MH-6]│
│  [MH-7] [MH-8]                              │
│                                               │
│  PAR CANS                                    │
│  [P-01] [P-02] [P-03] [P-04] [P-05] [P-06] │
│  [P-07] [P-08] [P-09] [P-10] [P-11] [P-12] │
│                                               │
│  GROUPS ──────────────────────────            │
│  [ALL MH ×8]  [FRONT ×4]  [BACK ×4]         │
│  [PARES ×6]   [IMPARES ×6] [TOP ×4]         │
└──────────────────────────────────────────────┘
```

**Interacción:**
- **Click simple** en un fixture → toggle en `selectionStore` (additive: Ctrl/Cmd click, replace: click sin modifier)
- **Click en grupo** → `selectMultiple(fixtureIds, 'replace')`
- **[ALL]** → selecciona todos los moving heads
- **[NONE]** → deselecciona todos
- Cada botón de fixture tiene 3 estados visuales:
  - **Desseleccionado:** `rgba(255,255,255,0.05)` border sutil
  - **Seleccionado (moving head):** Borde cyan + glow, fondo `rgba(0,240,255,0.15)`
  - **Seleccionado (estático):** Borde naranja atenuado, fondo `rgba(255,140,0,0.08)` + icono ⚠ (no se puede mover)

**Tamaño de botón:** `min-width: 54px`, `height: 36px`. Grid `repeat(auto-fill, minmax(54px, 1fr))`.
A 450px de sidebar caben ~7 columnas.

**Categorización automática:**
```typescript
const categories = useMemo(() => {
  const groups: Record<string, FixtureV2[]> = {}
  for (const f of allFixtures) {
    const cat = classifyFixtureType(f.type) // 'Moving Heads' | 'PAR Cans' | 'Strips' | etc.
    ;(groups[cat] ??= []).push(f)
  }
  return groups
}, [allFixtures])
```

**Datos necesarios:**
- `useStageStore(s => s.fixtures)` → todos los fixtures del show
- `useStageStore(s => s.groups)` → grupos de usuario
- `useSelectionStore()` → `selectedIds`, `selectMultiple`, `toggle`
- `useHardware()` → tipo de fixture para clasificación

### §2.5 State de la Sub-Tab

```typescript
// Dentro de KineticsCathedral.tsx
const [cathedralTab, setCathedralTab] = useState<'kinetics' | 'matrix'>('kinetics')
```

NO se persiste. Al abrir la Cathedral siempre empieza en KINETICS. La Matrix es un atajo contextual.

### §2.6 Auto-Switch Inteligente

Cuando el usuario selecciona fixtures desde la FixtureMatrix:
1. `selectionStore.selectMultiple(ids, 'replace')` se ejecuta
2. El `KinRadarViewport` detecta el cambio vía `useSelectedArray()` 
3. El Trinity Router re-evalúa y monta el componente correcto
4. La hidratación se dispara automáticamente (`useEffect` en KineticsCathedral con `selectedIds.join(',')`)

**No se hace auto-switch de sub-tab.** El usuario puede estar en la Matrix viendo los botones mientras el radar del viewport ya muestra el resultado. Las dos vistas son complementarias.

---

## §3. PILAR 3 — ERGONOMÍA Y EL BUG DE REACT

### §3.1 Layout Zero-Scroll

**Inventario de altura (sidebar 450px × ~700px disponible):**

| Componente | Altura actual | Altura nueva |
|---|---|---|
| CathedralHeader | 36px | 36px |
| Sub-tabs row | 0px | 32px (NUEVO) |
| ModeBar | 36px | 36px |
| TacticalFaders (×2 vertical) | 280px × 2 + gaps = 320px | ❌ ELIMINADOS verticales |
| ChaosSlider | ~56px | 48px |
| PatternArsenal (4×2 grid) | ~148px | ~140px |
| CathedralFooter | ~80px | ~70px |
| **TOTAL** | **~676px** (overflow!) | — |

**Problema confirmado:** 676px > 700px disponibles. Scroll obligatorio.

**Solución: Faders Horizontales.**

Los TacticalFaders dejan de ser verticales (280px alto, 72px ancho cada uno) y pasan a ser **horizontales** (100% ancho sidebar, ~44px alto cada uno). Ocupan 88px en vez de 320px. Ahorro: **232px**.

**Nuevo inventario:**

| Componente | Altura |
|---|---|
| CathedralHeader | 36px |
| Sub-tabs row | 32px |
| ModeBar | 36px |
| Fan controls (spatial, conditional) | 0-80px |
| **Fader SPEED (horizontal)** | **44px** |
| **Fader AMP (horizontal)** | **44px** |
| ChaosSlider | 48px |
| PatternArsenal (4×2) | 140px |
| CathedralFooter | 70px |
| **TOTAL** | **450px** (+ 80px si fan visible) |

**450-530px < 700px → Zero scroll.** Incluso con fan controls desplegados, cabe.

### §3.2 Componente: `HorizontalFader.tsx`

```typescript
interface HorizontalFaderProps {
  label: string
  value: number           // 0-100
  onChange: (v: number) => void
  color?: string          // CSS color for the fill
  disabled?: boolean
}
```

**Layout:**

```
┌──────────────────────────────────────────────────┐
│  SPEED   ████████████████████░░░░░░░░░░░ 72%     │  ← 44px alto, 100% ancho
├──────────────────────────────────────────────────┤
│  AMP     ██████████░░░░░░░░░░░░░░░░░░░░ 45%     │
└──────────────────────────────────────────────────┘
```

Estructura interna:

```
┌──────┬─────────────────────────────────┬──────┐
│ LABEL│ [track ████████░░░░░░░░░░░░░░] │ 72%  │
│ 48px │           flex: 1               │ 40px │
└──────┴─────────────────────────────────┴──────┘
```

- **Label:** 48px fixed-width, `font-family: Orbitron`, 10px, color del fader
- **Track:** `flex: 1`, `height: 20px`, border `--kc-border`, fill gradient left-to-right
- **Thumb:** Vertical bar `3px × 100%` del track height, color del fader + glow
- **Readout:** 40px fixed-width, derecha, valor + "%"

### §3.3 Interacción del HorizontalFader

**Mouse/Pointer:**
- Pointer Events API (`onPointerDown`, `onPointerMove`, `onPointerUp`) con `setPointerCapture`
- Sin `addEventListener` adicional — Pointer Capture maneja todo
- RAF throttle idéntico al TacticalFader actual (commitValue via `requestAnimationFrame`)

**Scroll wheel:**
- `step = 1` (normal), `step = 5` (Shift held)
- **⚠️ BUG FIX:** No usar `onWheel` de React. Usar `useRef` + `addEventListener` manual.

**Touch (táctil):**
- Pointer Events unifica mouse y touch — no se necesita handler separado
- `touch-action: none` en el CSS del track para prevenir scroll nativo

### §3.4 BUGFIX: preventDefault Inside Passive Event Listener

**El bug:**

```
[Violation] Unable to preventDefault inside passive event listener invocation.
```

**Causa:** React registra `wheel` y `touchstart` como **passive listeners** por defecto en el componente JSX. Llamar `e.preventDefault()` en un handler JSX como `onWheel={(e) => e.preventDefault()}` falla silenciosamente en Chrome.

**Solución canónica (useRef + addEventListener manual):**

```typescript
export function useNonPassiveWheel(
  ref: React.RefObject<HTMLElement>,
  handler: (e: WheelEvent) => void,
) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Registrar como NON-passive explícitamente
    el.addEventListener('wheel', handler, { passive: false })

    return () => {
      el.removeEventListener('wheel', handler)
    }
  }, [ref, handler])
}
```

**Uso en HorizontalFader:**

```typescript
const trackRef = useRef<HTMLDivElement>(null)

const handleWheel = useCallback((e: WheelEvent) => {
  e.preventDefault()    // AHORA funciona — listener es non-passive
  e.stopPropagation()
  const step = e.shiftKey ? 5 : 1
  commitValue(value + (e.deltaY < 0 ? step : -step))
}, [value, commitValue])

useNonPassiveWheel(trackRef, handleWheel)
```

**Lo mismo para touch si necesario:**

```typescript
export function useNonPassiveTouch(
  ref: React.RefObject<HTMLElement>,
  onStart: (e: TouchEvent) => void,
  onMove: (e: TouchEvent) => void,
) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    el.addEventListener('touchstart', onStart, { passive: false })
    el.addEventListener('touchmove', onMove, { passive: false })

    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
    }
  }, [ref, onStart, onMove])
}
```

**Aplicar también al TacticalFader existente** si se mantiene como opción alternativa (modo expandido).

### §3.5 CSS del HorizontalFader

```css
.h-fader {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  height: 44px;
  flex-shrink: 0;
}

.h-fader__label {
  width: 48px;
  flex-shrink: 0;
  font-family: var(--kc-font-display);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--fader-color);
  text-shadow: 0 0 6px var(--fader-color);
  text-align: right;
}

.h-fader__track {
  flex: 1;
  height: 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--kc-border);
  border-radius: 2px;
  position: relative;
  cursor: pointer;
  user-select: none;
  touch-action: none;
  overflow: hidden;
}

.h-fader__fill {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  background: linear-gradient(to right,
    color-mix(in srgb, var(--fader-color) 60%, transparent),
    var(--fader-color)
  );
  opacity: 0.4;
  pointer-events: none;
  transition: width 0.04s linear;
}

.h-fader__thumb {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--fader-color);
  box-shadow: 0 0 6px var(--fader-color);
  pointer-events: none;
}

.h-fader__readout {
  width: 40px;
  flex-shrink: 0;
  text-align: right;
  font-family: var(--kc-font-display);
  font-size: 14px;
  color: var(--fader-color);
  text-shadow: 0 0 4px var(--fader-color);
}
```

---

## §4. PILAR 4 — COMPORTAMIENTO CON SELECCIÓN MIXTA (Moving + Static)

### §4.1 El Problema

El usuario selecciona "Grupo Pares" que contiene 4 PAR cans y 2 moving heads. ¿Qué pasa?

### §4.2 Regla: Filtrado Silencioso + Feedback Visual

**Axioma:** Los radares SOLO operan sobre moving heads. Los fixtures estáticos (PAR, strip, dimmer) se ignoran para el cálculo de movimiento pero se muestran como feedback visual.

**Implementación en `KinRadarViewport`:**

```typescript
const { movingHeadIds, staticIds } = useMemo(() => {
  const fixtures = hardware?.fixtures ?? []
  const moving: string[] = []
  const statics: string[] = []

  for (const id of selectedIds) {
    const f = fixtures.find((x: { id: string }) => x.id === id)
    const t = (f?.type ?? '').toLowerCase()
    const isMoving = t.includes('moving') || t.includes('spot')
      || t.includes('beam') || t.includes('wash') || t.includes('scanner')
    if (isMoving) moving.push(id)
    else statics.push(id)
  }

  return { movingHeadIds: moving, staticIds: statics }
}, [selectedIds, hardware?.fixtures])
```

**Trinity Router usa `movingHeadIds.length`** — no `selectedIds.length`. Si hay 6 fixtures seleccionados pero solo 2 son moving heads, el router ve `count=2` → `RadarXY` (formación de 2).

### §4.3 Feedback Visual: Banner de Filtrado

Cuando `staticIds.length > 0`, mostrar un banner informativo discreto:

```
┌──────────────────────────────────────────────────────────────────┐
│  ⚠ 4 de 6 fixtures son estáticos (no se mueven)     [×]        │
│  Controlando: MH-1, MH-2                                        │
└──────────────────────────────────────────────────────────────────┘
```

**CSS:** Background `rgba(255,140,0,0.08)`, border `rgba(255,140,0,0.2)`, font 10px.
**Dismissable:** Click en `[×]` oculta el banner hasta el próximo cambio de selección.

### §4.4 Comportamiento por Radar

**XYPad (1 moving head seleccionado):**
- Controla el moving head único. Estáticos ignorados.
- Sin cambios visuales (el XYPad no muestra otros fixtures).

**RadarXY (2+ moving heads):**
- Ghost points SOLO para moving heads. Estáticos no aparecen.
- `fixtureCount` refleja solo moving heads.
- Fan spread se calcula sobre los moving heads únicamente.

**SpatialTargetPad (modo spatial):**
- Fixtures estáticos aparecen como ghosts **atenuados** (opacity 0.2, sin beam ray).
- Solo moving heads generan beam rays y participan en el IK solve.
- El prop `fixtures` ya soporta esto — `SpatialFixtureGhost` acepta cualquier fixture para rendering, y el IPC `applySpatialTarget` solo envía los `fixtureIds` de moving heads.

### §4.5 Edge Cases

| Caso | Comportamiento |
|---|---|
| 0 selected | Empty state: "Selecciona fixtures" |
| 6 PAR cans, 0 MH | Static warning: "No hay moving heads en la selección" + radar deshabilitado |
| 1 MH + 5 PAR | XYPad controla el MH. Banner: "5 estáticos ignorados" |
| 3 MH + 3 PAR, spatial | SpatialTargetPad. MH con beam rays, PAR como ghosts atenuados |
| Grupo vacío | Empty state (0 selectedIds) |

### §4.6 Opacidad del Sidebar

Cuando `movingHeadIds.length === 0` y `selectedIds.length > 0` (solo estáticos):
- Los TacticalFaders se muestran con `disabled={true}` (opacity 0.4)
- PatternArsenal disabled
- ChaosSlider disabled
- ModeBar deshabilitado (no hay modo que seleccionar)
- Footer sigue funcional (los grupos permiten cambiar la selección)

---

## §5. RESUMEN DE CAMBIOS

### §5.1 Archivos a MODIFICAR

| Archivo | Cambio |
|---|---|
| `kinetics/KinRadarViewport.tsx` | Reemplazar OrthoRadar por Trinity Router que monta XYPad/RadarXY/SpatialTargetPad |
| `kinetics/KinRadarViewport.css` | Añadir overrides de max-height + font scaling para radares en viewport |
| `kinetics/KineticsCathedral.tsx` | Añadir sub-tabs KINETICS/MATRIX + reemplazar TacticalFader vertical por HorizontalFader |
| `kinetics/KineticsCathedral.css` | Añadir estilos sub-tabs + h-fader + matrix |
| `kinetics/TacticalFader.tsx` | Aplicar fix de passive event listener (useNonPassiveWheel) |

### §5.2 Archivos NUEVOS

| Archivo | Descripción |
|---|---|
| `kinetics/HorizontalFader.tsx` | Fader horizontal de precisión (~80 líneas) |
| `kinetics/FixtureMatrix.tsx` | Grid de selección de fixtures (~150 líneas) |
| `hooks/useNonPassiveWheel.ts` | Hook para registrar wheel listener non-passive (~20 líneas) |

### §5.3 Archivos a ELIMINAR

| Archivo | Razón |
|---|---|
| `kinetics/OrthoRadar.tsx` | Reemplazado por Trinity Router. 410 líneas de deuda eliminadas. |

### §5.4 Archivos que NO SE TOCAN

| Archivo | Razón |
|---|---|
| `controls/XYPad.tsx` | Componente clásico. Funciona. Se reutiliza tal cual. |
| `controls/RadarXY.tsx` | Componente clásico. Funciona. Se reutiliza tal cual. |
| `controls/SpatialTargetPad.tsx` | Componente clásico. Funciona. Se reutiliza tal cual. |
| `controls/RadarXY.css` | No tocar — overrides van en KinRadarViewport.css. |
| `controls/SpatialTargetPad.css` | No tocar — overrides van en KinRadarViewport.css. |
| `stores/movementStore.ts` | Ya centralizado. Sin cambios. |
| `engine/movement/ChaosHash.ts` | Ya implementado. Sin cambios. |

---

## §6. PLAN DE IMPLEMENTACIÓN

### Fase 1 — Trinity Router (~2h)
- [ ] Refactorizar `KinRadarViewport.tsx`: eliminar import de OrthoRadar, importar XYPad + RadarXY + SpatialTargetPad
- [ ] Implementar `resolveRadarComponent()` y montar condicionalmente
- [ ] Calcular `movingHeadIds` / `staticIds` + banner de filtrado
- [ ] CSS overrides en `KinRadarViewport.css` (kill max-height, font scaling)
- [ ] Verificar: 3 modos visibles, escalado correcto, tsc --noEmit clean

### Fase 2 — Faders Horizontales (~1.5h)
- [ ] Crear `HorizontalFader.tsx` con Pointer Events + RAF throttle
- [ ] Crear `hooks/useNonPassiveWheel.ts`
- [ ] Integrar en `KineticsCathedral.tsx` reemplazando TacticalFader verticales
- [ ] Aplicar useNonPassiveWheel al TacticalFader existente también (bugfix)
- [ ] CSS: `.h-fader` styles en `KineticsCathedral.css`
- [ ] Verificar: faders funcionales, sin passive event warnings, zero scroll

### Fase 3 — Fixture Matrix (~1.5h)
- [ ] Crear `FixtureMatrix.tsx` con grid de botones categorizados
- [ ] Añadir sub-tabs [KINETICS | FIXTURE MATRIX] en KineticsCathedral header
- [ ] Wire: click fixture → selectionStore.toggle / selectMultiple
- [ ] Wire: click grupo → selectionStore.selectMultiple(fixtureIds, 'replace')
- [ ] CSS: estilos matrix en `KineticsCathedral.css`
- [ ] Verificar: selección funciona sin salir de Cathedral, radar actualiza

### Fase 4 — Cleanup (~30min)
- [ ] Eliminar `OrthoRadar.tsx` y su import del barrel `index.ts`
- [ ] Remover CSS huérfano de `.ortho-radar*` si solo estaba en KineticsCathedral.css
- [ ] tsc --noEmit: 0 errors
- [ ] Test manual: flujo completo (seleccionar grupo → radar monta → faders controlan → pattern dispara)

---

**End of Mini-Blueprint — WAVE 4567: THE CATHEDRAL RESET**

> *No fusiones. Routea. No reinventes. Escala. No bloquees. Filtra.*
