# WAVE 7019 — HephRadar Gap Analysis & Phase Engine Integration Blueprint

**Fecha:** 2026-06-26
**Auditor:** Cascade (Audio-Visual Industrial Designer & Math Auditor)
**Archivos inspeccionados:**
- `src/components/views/HephaestusView/HephRadar.tsx` (renderer Canvas 2D, 451 líneas)
- `src/components/views/HephaestusView/useHephPreview.ts` (motor de preview, 556 líneas)
- `src/components/views/HephaestusView/tabs/LabTab.tsx` (consumidor, 190 líneas)
- `src/core/hephaestus/CurveEvaluator.ts` (evaluador de curvas)
- `src/core/hephaestus/phase/PhaseConfigPro.ts` (motor de fase, 167 líneas)
- `src/components/views/HephaestusView/HephaestusView.css` (estilos radar, líneas 1816-1905)

---

## 1. Radiografía del Motor de Preview (`useHephPreview.ts` + `HephRadar.tsx`)

### 1.1 Arquitectura de datos

El radar se alimenta de un pipeline de 3 etapas:

```
Clip V3 (Zustand) → CurveEvaluator → evaluateClipFrame() → PreviewFixtureState[] → HephRadar (Canvas 2D)
                                              ↑
                                    resolvePro() (PhaseDistributor)
```

### 1.2 `PreviewFixtureState` — El contrato de datos del radar

| Campo | Tipo | Rango | Origen | Descripción |
|---|---|---|---|---|
| `zone` | `EffectZone \| 'all'` | enum | `resolveZoneTags()` | Zona espacial del fixture |
| `fixtureId` | `string` | — | `stageStore` o fallback | ID real del fixture o virtual |
| `label` | `string` | — | `rf.name[:6]` | Etiqueta corta para display |
| `radarX` | `number` | `[0, 1]` | distribución horizontal | Posición X normalizada en el radar |
| `radarY` | `number` | `[0, 1]` | `ZONE_RADAR_POSITIONS[zone].y` | Posición Y normalizada en el radar |
| `dimmer` | `number` | `[0, 255]` | `scaleToDMX('intensity', raw)` | Intensidad DMX |
| `r`, `g`, `b` | `number` | `[0, 255]` | `hslToRgb()` | Color RGB resultante |
| `pan`, `panFine` | `number` | `[0, 255]` | `scaleToDMX16(raw)` | Pan DMX 16-bit |
| `tilt`, `tiltFine` | `number` | `[0, 255]` | `scaleToDMX16(raw)` | Tilt DMX 16-bit |
| `white` | `number` | `[0, 255]` | `scaleToDMX('white', raw)` | Canal blanco |
| `amber` | `number` | `[0, 255]` | `scaleToDMX('amber', raw)` | Canal ámbar |
| `strobe` | `number` | `[0, 255]` | `scaleToDMX('strobe', raw)` | Strobe DMX |
| `zoom` | `number` | `[0, 255]` | `scaleToDMX('zoom', raw)` | Zoom óptico |
| `focus` | `number` | `[0, 255]` | `scaleToDMX('focus', raw)` | Focus óptico |

### 1.3 `HephPreviewState` — Estado del hook

| Campo | Tipo | Descripción |
|---|---|---|
| `playheadMs` | `number` | Posición temporal actual en ms |
| `progress` | `number` | Progreso normalizado `[0, 1]` |
| `isPlaying` | `boolean` | ¿Está reproduciendo? |
| `fixtures` | `PreviewFixtureState[]` | Array de fixtures resueltos para este frame |
| `frameCount` | `number` | Contador de frames (debug) |

### 1.4 Pipeline de resolución (`resolveFixtures`)

```
1. zones = clip.spatialZones
2. IF zones.includes('all') → 1 fixture center, sin phase
3. IF zones.length === 0 → fallback 1 fixture center
4. resolveZoneTags(zones, stageFixtures) → fixtureIds reales
5. IF no match → virtual dots per zone
6. IF 1 fixture → sin phase, posición por zone
7. IF N fixtures → resolvePro(fixtureIds, phaseConfig, durationMs)
8. FOR each fixture:
   a. phaseOffset = phaseByFixture.get(id)
   b. offsetTime = max(0, timeMs - phaseOffset)
   c. evaluateClipFrame(clip, evaluator, offsetTime)
   d. radarX = MARGIN + (i / (N-1)) * usableWidth  ← distribución horizontal uniforme
   e. radarY = ZONE_RADAR_POSITIONS[zone].y ?? 0.5
```

### 1.5 Renderer Canvas 2D (`HephRadar.tsx`)

| Función | Líneas | Descripción |
|---|---|---|
| `drawGrid()` | 42-83 | Grid 8×8 + crosshair centrado + scanlines CRT |
| `drawFixtureDot()` | 85-191 | Por fixture: base (anclaje físico) → beam (base→target) → glow → core dot → inner spot → label |
| `drawReadouts()` | 193-265 | 4 esquinas: PAN/TILT (TL), RGB (TR), DIM/WHT/AMB/STR (BL), ZM/FC/Time (BR) |
| `drawProgressBar()` | 283-307 | Barra inferior 3px con glow en playhead |
| `handleCanvasClick()` | 400-413 | Click en zona inferior 12px → seek |

**Render loop:** `useEffect` disparado por cambio de `preview` state (no es rAF continuo dentro del componente — el rAF vive en `useHephPreview`).

---

## 2. El Abismo: Bugs, Gaps y Código Roto

### 2.1 ❌ BUGS CONFIRMADOS

| Bug | Severidad | Archivo:Línea | Descripción |
|---|---|---|---|
| **Render loop no continuo** | **Crítica** | `HephRadar.tsx:334-378` | El `useEffect` se dispara solo cuando `preview` cambia. Pero el canvas se redimensiona una sola vez — no hay rAF interno. Si `preview.isPlaying` es false y el usuario redimensiona la ventana, el canvas queda en tamaño stale. El `ResizeObserver` (línea 385) dispara un `Event('resize')` que **nadie escucha**. |
| **Strobe simulación rota en pausa** | **Alta** | `HephRadar.tsx:107-108` | `strobeGate` usa `Date.now()` — cuando está en pausa, el strobe sigue parpadeando porque el tiempo real avanza aunque el clip esté pausado. Debería usar `preview.playheadMs` o un contador de frames. |
| **Readouts solo del primer fixture** | **Alta** | `HephRadar.tsx:372-373` | `drawReadouts(ctx, fixtures[0], ...)` — con N fixtures, solo se muestran los valores del fixture #0. No hay selector de fixture activo para inspeccionar individualmente. |
| **`setClip` shim en LabTab no usa `mutate`** | **Alta** | `LabTab.tsx:66-71` | El `setClip` de LabTab todavía usa `useHephaestusEditorStore.setState()` directo, sin `mutate()`. Los cambios de DNA y spatialBehavior desde LabTab **no entran al historial de undo/redo**. |
| **DPR scaling acumulativo** | **Media** | `HephRadar.tsx:349-354` | `ctx.scale(dpr, dpr)` se llama en cada render del `useEffect`. Si el effect se re-ejecuta sin recrear el contexto (que es el caso), el scale se acumula: 2x → 4x → 8x... El canvas se degrada visualmente tras múltiples updates. |
| **Sin limpieza de canvas entre frames** | **Media** | `HephRadar.tsx:356-358` | `ctx.fillStyle = BG_COLOR; ctx.fillRect(0, 0, w, h)` limpia el canvas, pero el `ctx.scale(dpr,dpr)` previo hace que el fillRect no cubra todo el canvas físico (cubre solo `w×h` en espacio CSS, pero el canvas físico es `w*dpr × h*dpr`). Con scale acumulativo, quedan residuos visuales. |

### 2.2 ⚠️ GAPS DE UX

| Gap | Severidad | Descripción |
|---|---|---|
| **Sin visualización de fase** | **Alta** | El radar muestra dots individuales pero NO visualiza la onda de fase. No hay líneas conectando fixtures en secuencia temporal. No hay indicación de qué fixture va adelantado/atrasado. |
| **Sin selección de fixture** | **Alta** | No se puede clickar un dot para seleccionarlo e inspeccionar sus valores. Los readouts están hardcoded al fixture[0]. |
| **Sin trail/ghost** | **Media** | No hay estela del movimiento de pan/tilt. MA3 muestra el trail del beam en su simulator. |
| **Sin indicador de spread temporal** | **Media** | No se visualiza cuánto se separan los fixtures en tiempo. Un indicador "0→360°" con marcas por fixture sería esencial. |
| **Layout horizontal plano** | **Media** | Todos los fixtures se distribuyen en X uniformemente. La posición Y se toma del zone pero no refleja la posición física real del stage. No hay vista top-down real. |
| **Sin grid de beats** | **Baja** | No hay marcas de beat grid sincronizadas con BPM. El radar es puramente espacial, no temporal. |
| **Transport minimalista** | **Baja** | Solo Play/Pause/Stop. No hay scrubbing visual (la barra de progreso es click-to-seek pero no drag). No hay loop A/B. |

### 2.3 CÓDIGO LEGACY / DEAD CODE

| Elemento | Archivo:Línea | Diagnóstico |
|---|---|---|
| `radarX`/`radarY` en `evaluateClipFrame()` | `useHephPreview.ts:256-265` | La función retorna `radarX: 0.5, radarY: 0.5` hardcoded. Estos valores se sobreescriben en `resolveFixtures` pero la función base retorna valores inútiles. |
| `ZONE_RADAR_POSITIONS` | `useHephPreview.ts:101-134` | Mapeo manual zone→posición. Funcional pero frágil — si se añaden zonas nuevas, hay que actualizar este diccionario. Debería leerse del ShowFile. |
| `findPhaseConfig()` | `useHephPreview.ts:152-157` | Busca el primer track con `phaseConfig.spreadDeg > 0`. Pero el radar debería poder visualizar la fase de cualquier track, no solo el primero. Con múltiples tracks phaseados, solo se visualiza uno. |

---

## 3. Blueprint de Integración: HephRadar × Phase Engine Eurorack

### 3.1 Visión arquitectónica

El radar debe evolucionar de "preview pasivo de dots" a **simulador espacial interactivo** que refleje en tiempo real los cambios del Phase Engine Eurorack. Cuando el usuario gira el knob de Spread en el bastidor izquierdo, el radar debe mostrar la onda propagándose. Cuando ajusta Wings, debe ver los ciclos adicionales. Cuando toca Shuffle, debe ver la permutación reordenar los dots.

### 3.2 Árbol JSX del LabTab refactorizado

```jsx
<div className="heph-lab-workspace" style={{ display: 'flex', flex: 1 }}>
  
  {/* ═══ IZQUIERDA: Phase Rack Eurorack (340px) — WAVE 7019 ═══ */}
  <aside className="heph-lab-sidebar" style={{ width: '340px', flexShrink: 0 }}>
    <PhaseRack>  {/* reemplaza PhaseControls */}
      <PresetStrip />
      <WaveShaperModule>
        <WavePreview />  {/* SVG mini-onda: symmetry+wings+direction */}
        <Knob label="SPREAD" size="lg" />
        <SymmetryToggles />
        <Knob label="WINGS" size="md" />
        <DirectionSwitch />
      </WaveShaperModule>
      <BlockMatrixModule>
        <Knob label="BLOCKS" size="md" />
        <BlockGrid />  {/* LEDs coloreados por grupo */}
      </BlockMatrixModule>
      <ChaosEngineModule>
        <ShuffleSlider />
        <PermutationViz />  {/* barras: orden resultante */}
        <Knob label="SEED" size="sm" />
        <DiceButton />
      </ChaosEngineModule>
      <SpatialBehaviorModule collapsible />
    </PhaseRack>
  </aside>

  {/* ═══ CENTRO: HephRadar V2 (flex:1) — Refactor ═══ */}
  <div className="heph-lab-stage" style={{ flex: 1, minWidth: 0 }}>
    <HephRadarV2
      preview={preview}
      phaseConfig={activePhaseConfig}  {/* NUEVO: pasa phase config al radar */}
      fixturePhases={fixturePhases}    {/* NUEVO: offsets resueltos por resolvePro */}
      selectedFixtureId={selectedFixtureId}
      onSelectFixture={setSelectedFixtureId}
      showPhaseWave={true}  {/* toggle: mostrar onda de fase superpuesta */}
      showTrails={true}     {/* toggle: estela de pan/tilt */}
      showBeatGrid={true}   {/* toggle: grid de beats BPM */}
    />
  </div>

  {/* ═══ DERECHA: DNA Rail (310px) — sin cambios ═══ */}
  <aside className="heph-lab-dna-rail" style={{ width: '310px', flexShrink: 0 }}>
    <DnaRail ... />
  </aside>
</div>
```

### 3.3 HephRadar V2 — Nuevas capas de renderizado

El renderer Canvas 2D actual tiene 4 capas estáticas. V2 añade 4 capas dinámicas:

```
Layer 0: BG_COLOR (fondo)
Layer 1: drawGrid() — grid + crosshair + scanlines [EXISTENTE]
Layer 2: drawBeatGrid() — marcas de beat BPM [NUEVO]
Layer 3: drawPhaseWave() — onda de fase superpuesta [NUEVO]
Layer 4: drawTrails() — estelas de pan/tilt [NUEVO]
Layer 5: drawFixtureDot() — dots + beams [EXISTENTE, refactor]
Layer 6: drawPhaseConnectors() — líneas entre fixtures en orden de fase [NUEVO]
Layer 7: drawReadouts() — valores numéricos [EXISTENTE, refactor: fixture seleccionado]
Layer 8: drawProgressBar() — barra temporal [EXISTENTE]
```

### 3.4 Desglose de capas nuevas

#### Capa 2: `drawBeatGrid(ctx, w, h, bpm, playheadMs, durationMs)`

```typescript
// Marcas verticales cada beat, sincronizadas con BPM
// Beat actual destacado en naranja neon
// Sub-beats en gris tenue
const beatsPerSec = bpm / 60
const totalBeats = beatsPerSec * (durationMs / 1000)
const beatSpacing = w / totalBeats
for (let i = 0; i < totalBeats; i++) {
  const x = i * beatSpacing
  const isCurrent = Math.abs(x - (playheadMs / durationMs) * w) < beatSpacing / 2
  ctx.strokeStyle = isCurrent ? 'rgba(255, 107, 43, 0.3)' : 'rgba(255, 255, 255, 0.04)'
  ctx.lineWidth = isCurrent ? 1.5 : 0.5
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
}
```

#### Capa 3: `drawPhaseWave(ctx, w, h, fixturePhases, durationMs)`

```typescript
// Onda sinusoidal que conecta todos los fixtures
// Muestra visualmente cómo se propaga la fase
// Color: gradiente naranja→cian para indicar dirección temporal
ctx.beginPath()
for (let i = 0; i < fixturePhases.length; i++) {
  const fp = fixturePhases[i]
  const x = (i / (fixturePhases.length - 1)) * w
  const y = h * 0.5 + Math.sin((fp.phaseOffsetMs / durationMs) * Math.PI * 2) * h * 0.15
  if (i === 0) ctx.moveTo(x, y) else ctx.lineTo(x, y)
}
ctx.strokeStyle = 'rgba(255, 107, 43, 0.25)'
ctx.lineWidth = 2
ctx.stroke()
```

#### Capa 4: `drawTrails(ctx, fixture, w, h)`

```typescript
// Buffer circular de últimas N posiciones (pan, tilt)
// Dibujar como polilínea con alpha decreciente
// Solo para fixtures con movement (pan/tilt cambian)
for (let i = 0; i < trail.length - 1; i++) {
  const alpha = (i / trail.length) * 0.3
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
  ctx.beginPath()
  ctx.moveTo(trail[i].x, trail[i].y)
  ctx.lineTo(trail[i+1].x, trail[i+1].y)
  ctx.stroke()
}
```

#### Capa 6: `drawPhaseConnectors(ctx, w, h, fixturePhases, fixtures)`

```typescript
// Ordenar fixtures por phaseOffsetMs
// Dibujar arcos curvos entre fixtures consecutivos en tiempo de fase
// Indica visualmente el orden de propagación (chase direction)
const sorted = [...fixturePhases].sort((a, b) => a.phaseOffsetMs - b.phaseOffsetMs)
for (let i = 0; i < sorted.length - 1; i++) {
  const from = fixtures.find(f => f.fixtureId === sorted[i].fixtureId)
  const to = fixtures.find(f => f.fixtureId === sorted[i+1].fixtureId)
  if (!from || !to) continue
  // Curva bezier desde from.radarX*w,from.radarY*h hasta to.radarX*w,to.radarY*h
  ctx.beginPath()
  ctx.moveTo(from.radarX * w, from.radarY * h)
  ctx.quadraticCurveTo(
    (from.radarX + to.radarX) * w * 0.5,
    Math.min(from.radarY, to.radarY) * h - 20,  // arco hacia arriba
    to.radarX * w, to.radarY * h
  )
  ctx.strokeStyle = 'rgba(100, 200, 255, 0.15)'
  ctx.lineWidth = 1
  ctx.stroke()
  // Flecha pequeña en el punto medio
}
```

### 3.5 Fix del render loop (bug crítico)

```typescript
// ANTES (roto):
useEffect(() => {
  // se ejecuta solo cuando preview cambia
  // ctx.scale(dpr, dpr) se acumula
}, [preview, durationMs])

// DESPUÉS (correcto):
const renderRef = useRef<number>(0)

useEffect(() => {
  const render = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Reset transform antes de escalar (fix acumulación DPR)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    
    // ... todo el drawing ...
    
    if (preview.isPlaying) {
      renderRef.current = requestAnimationFrame(render)
    }
  }
  render()
  return () => cancelAnimationFrame(renderRef.current)
}, [preview, durationMs, /* nuevos props */])
```

### 3.6 Fix del strobe gate (bug alto)

```typescript
// ANTES (roto): usa Date.now() — strobe parpadea en pausa
const strobeGate = fixture.strobe > 0
  ? (Math.sin(Date.now() * (fixture.strobe / 255) * 0.06) > 0 ? 1 : 0.1)
  : 1

// DESPUÉS (correcto): usa frameCount del preview
const strobeGate = fixture.strobe > 0
  ? (Math.sin(preview.frameCount * (fixture.strobe / 255) * 0.3) > 0 ? 1 : 0.1)
  : 1
```

### 3.7 Fix del setClip shim en LabTab

```typescript
// ANTES (roto): no entra al historial
const setClip = useCallback((updater) => {
  const nextClip = updater(useHephaestusEditorStore.getState().clip)
  useHephaestusEditorStore.setState({ clip: nextClip, isDirty: true })
}, [])

// DESPUÉS (correcto): usa mutate()
const setClip = useCallback((updater) => {
  const { mutate, clip } = useHephaestusEditorStore.getState()
  if (!clip) return
  mutate('Edit clip', (draft) => {
    Object.assign(draft, updater(draft as HephAutomationClipV3))
  })
}, [])
```

### 3.8 Integración datos: PhaseConfig → Radar

**Flujo actual:**
```
LabTab → useHephPreview(clip, stageFixtures) → preview.fixtures → HephRadar
```

**Flujo propuesto:**
```
LabTab → useHephPreview(clip, stageFixtures) → { preview, fixturePhases } → HephRadarV2
                    ↓
         resolvePro() expuesto como dato adicional
```

**Cambio en `useHephPreview`:** Exponer `fixturePhases` además de `fixtures`:

```typescript
export interface HephPreviewState {
  playheadMs: number
  progress: number
  isPlaying: boolean
  fixtures: PreviewFixtureState[]
  fixturePhases: FixturePhase[]  // NUEVO
  frameCount: number
}
```

En `resolveFixtures()`, guardar el resultado de `resolvePro()` en el estado:

```typescript
// Dentro de resolveFixtures, después de resolvePro():
if (fixturePhases) {
  // Ya tenemos los phases — exponerlos
}
// Guardar en el return o en un ref paralelo
```

### 3.9 Selector de fixture activo

```typescript
// HephRadarV2 props adicionales
interface HephRadarV2Props extends HephRadarProps {
  selectedFixtureId?: string | null
  onSelectFixture?: (id: string | null) => void
  phaseConfig?: PhaseConfigPro | null
  fixturePhases?: FixturePhase[]
  showPhaseWave?: boolean
  showTrails?: boolean
  showBeatGrid?: boolean
}

// Click en canvas → hit-test contra dots
const handleCanvasClick = (e: React.MouseEvent) => {
  const rect = canvas.getBoundingClientRect()
  const cx = e.clientX - rect.left
  const cy = e.clientY - rect.top
  
  // Hit-test: buscar dot más cercano dentro de radio
  for (const f of preview.fixtures) {
    const fx = f.radarX * rect.width
    const fy = f.radarY * rect.height
    const dist = Math.hypot(cx - fx, cy - fy)
    if (dist < DOT_RADIUS_MULTI + 4) {
      onSelectFixture?.(f.fixtureId)
      return
    }
  }
  // Click en zona inferior → seek (comportamiento existente)
  if (cy >= rect.height - 12) {
    onSeek((cx / rect.width) * durationMs)
  }
  onSelectFixture?.(null)  // deselect
}
```

### 3.10 Readouts dinámicos (fixture seleccionado)

```typescript
// ANTES: siempre fixtures[0]
drawReadouts(ctx, fixtures[0], w, h, ...)

// DESPUÉS: fixture seleccionado o fixtures[0]
const readoutFixture = fixtures.find(f => f.fixtureId === selectedFixtureId) ?? fixtures[0]
drawReadouts(ctx, readoutFixture, w, h, ...)

// Highlight visual del fixture seleccionado:
if (f.fixtureId === selectedFixtureId) {
  ctx.strokeStyle = 'rgba(255, 107, 43, 0.8)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, radius + 4, 0, Math.PI * 2)
  ctx.stroke()
}
```

---

## 4. Resumen de acciones requeridas

| Prioridad | Acción | Archivo | Esfuerzo |
|---|---|---|---|
| **P0** | Fix render loop + DPR acumulativo | `HephRadar.tsx` | 30 min |
| **P0** | Fix strobe gate (Date.now → frameCount) | `HephRadar.tsx` | 5 min |
| **P0** | Fix setClip shim en LabTab (usar mutate) | `LabTab.tsx` | 5 min |
| **P1** | Exponer `fixturePhases` desde `useHephPreview` | `useHephPreview.ts` | 20 min |
| **P1** | Selector de fixture activo (click en dot) | `HephRadar.tsx` | 30 min |
| **P1** | Readouts dinámicos (fixture seleccionado) | `HephRadar.tsx` | 10 min |
| **P2** | Capa `drawPhaseWave()` — onda superpuesta | `HephRadar.tsx` | 40 min |
| **P2** | Capa `drawPhaseConnectors()` — arcos entre fixtures | `HephRadar.tsx` | 30 min |
| **P2** | Capa `drawBeatGrid()` — grid BPM | `HephRadar.tsx` | 20 min |
| **P3** | Capa `drawTrails()` — estelas pan/tilt | `HephRadar.tsx` | 45 min |
| **P3** | Múltiples tracks phaseados (no solo el primero) | `useHephPreview.ts` | 30 min |

**Total estimado:** ~4.5 horas para implementar P0+P1+P2.
