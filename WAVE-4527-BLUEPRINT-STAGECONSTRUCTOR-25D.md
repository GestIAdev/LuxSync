# WAVE 4527 — THE 2.5D CONSTRUCTOR BLUEPRINT

> **Blueprint de Migración: StageGrid3D → StageConstructor 2.5D Top-Down**
> Estado: DISEÑO UI/UX — PROHIBIDO ESCRIBIR CÓDIGO HASTA APROBACIÓN
> Propuesta base: Propuesta 2 ("Canvas 2.5D Relativo") de `WAVE-4523.2-SPATIAL-UX-BRAINSTORMING.md`
> Autores: Lead UI/UX Architect (PunkOpus) + Radwulf

---

## 0. AUDITORÍA DEL ESTADO ACTUAL

### 0.1 Componentes involucrados

| Archivo | Líneas | Responsabilidad | Destino |
|---|---|---|---|
| `StageGrid3D.tsx` | 1607 | Canvas R3F completo: PerspectiveCamera, OrbitControls, Grid, Fixture3D, TransformGizmo, ZoneOverlay, ContextMenu, BoxSelect, D&D | **REFACTORIZAR** completo |
| `ZoneOverlay.tsx` | 356 | Renderiza zonas de color en el suelo + helpers `getZoneAtPosition()` | **ELIMINAR** render, **PRESERVAR** helpers como utility |
| `StageConstructorView.tsx` | 1084 | Layout 3 columnas, ConstructorContext, sidebar library, properties panel | **EXTENDER** con nuevos controles 2.5D |
| `stageStore.ts` | 1063 | Zustand store: fixtures, groups, stage dimensions, persistence | **EXTENDER** con estado de capas |
| `ShowFileV2.ts` | 1268 | Tipos: StageDimensions, StageVisuals, FixtureV2, Position3D | **EXTENDER** con HeightLayer[] |

### 0.2 Problemas del diseño actual

| # | Problema | Impacto |
|---|----------|---------|
| P1 | **PerspectiveCamera con OrbitControls** → el técnico no sabe dónde está realmente un foco en el aire. La perspectiva distorsiona las distancias. | Posicionamiento impreciso |
| P2 | **ZoneOverlay** → rectángulos de color en el suelo añaden ruido visual. No son útiles para un plano técnico. | Sobrecarga cognitiva |
| P3 | **Grid de 1m con secciones de 5m** → demasiado grueso para posicionamiento IK (necesita ±25cm). | Baja precisión de snap |
| P4 | **Y=0 por defecto** → no hay concepto de "capa de altura". El fixture se pone en el suelo y luego se sube manualmente con el context menu (3 opciones fijas: 0m, 1.5m, 3.5m). | Workflow lento para altura |
| P5 | **TransformGizmo showY={false}** → ya se ocultó el eje Y, pero sin alternativa visual de altura. El fixture "flota" sin referencia visual al suelo. | Desorientación espacial |
| P6 | **normalizeZone auto-calcula** zona por posición+tipo → el usuario no elige. | Control insuficiente |

---

## 1. VISIÓN DE DISEÑO: "EL PLANO TÉCNICO"

### 1.1 Filosofía

El StageConstructor 2.5D es un **plano de planta arquitectónico** (floor plan), no un visor 3D. La metáfora es un blueprints de AutoCAD: líneas finas, grid preciso, etiquetas técnicas, cero decoración.

La altura se representa con **líneas de caída** (drop lines) — verticales que conectan el fixture con su proyección en el suelo — y con **capas de altura** (layers) que el técnico selecciona antes de colocar un foco.

### 1.2 Paleta visual

```
Fondo:                #0a0a12 (casi negro, ligeramente azul)
Grid principal (1m):  #1a1a2e (apenas visible)
Grid fino (0.25m):    #12121f (sutilísimo, solo visible en zoom)
Grid grueso (5m):     #2a2a44 (secciones de referencia)
Stage outline:        #22d3ee @ 40% (cyan, el borde del escenario)
Drop lines:           #ffffff @ 15% (blanco fantasma)
Fixture (normal):     Color por tipo (existente)
Fixture (selected):   #22d3ee (cyan, existente)
Layer badge:          Color de la capa activa
Coordinate labels:    #ffffff @ 30% (gris sutil)
```

### 1.3 Referencia visual (ASCII art del resultado)

```
┌──────────────────────────────────────────────────────────────────┐
│ 🔧 STAGE 2.5D ─── W: [═══════●═══] 12m  L: [═══●═════] 8m     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  -6m          -3m           0            3m           6m         │
│   ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  -4m    │
│   ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·         │
│   ·  ·  ◇──┤  ·  ·  ◇──┤  ·  ·  ◇──┤  ·  ·  ◇──┤  ·  -2m    │
│   ·  ·  ╎  ·  ·  ·  ╎  ·  ·  ·  ╎  ·  ·  ·  ╎  ·  ·         │
│   ·  ·  +  ·  ·  ·  +  ·  ·  ·  +  ·  ·  ·  +  ·  ·   0m     │
│   ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·         │
│   ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  +2m    │
│   ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·         │
│   ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  +4m    │
│                                                                  │
│   ◇ = fixture (top-down)       ╎ = drop line (height)           │
│   + = proyección en suelo      ┤ = label: "MH-01 [5.0m]"       │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  [CAPA] ● Truss High (5.0m)  ○ Truss Low (3.0m)  ○ Floor (0m) │
│         [═════════●═══════] 5.0m                                 │
│  [☐ Grid 3D]  [☐ Drop Lines]  [🧲 Snap 0.25m]                  │
└──────────────────────────────────────────────────────────────────┘
```

**Leyenda:**
- `◇` = Fixture visto desde arriba (icono 2D por tipo)
- `╎` = Drop line: línea vertical que baja desde el fixture hasta el suelo
- `+` = Proyección en el suelo (X,Z del fixture, dibujada como un + tenue)
- `┤` = Etiqueta: nombre + altura entre corchetes
- Sliders de sala en el header (Ancho / Largo)
- Selector de capa en el footer (radio buttons + slider de altura)
- Toggles de visualización en el footer

---

## 2. ARQUITECTURA DE COMPONENTES

### 2.1 Árbol de componentes (nuevo)

```
StageConstructorView.tsx
├── FixtureLibrarySidebar          (existente — sin cambios)
├── StageCanvas25D                  ← NUEVO (reemplaza StageGrid3D)
│   ├── <Canvas>                    (React Three Fiber)
│   │   ├── OrthoCamera25D         ← NUEVO (OrthographicCamera top-down bloqueada)
│   │   ├── GridFloor25D           ← NUEVO (grid fino 0.25m + grueso 1m + secciones 5m)
│   │   ├── StageOutline           ← NUEVO (borde del escenario reactivo a sliders)
│   │   ├── DropLineGroup          ← NUEVO (líneas de caída per-fixture)
│   │   ├── VolumetricGrid         ← NUEVO (malla 3D togglable)
│   │   ├── FixtureSprite25D[]     ← NUEVO (sprites top-down por tipo)
│   │   ├── TransformGizmo25D      ← ADAPTADO (snap 0.25m, XZ only)
│   │   ├── CameraBridge           (existente — adaptado)
│   │   └── WebGLContextHandler    (existente — sin cambios)
│   ├── BoxSelectionOverlay         (existente — adaptado)
│   ├── ContextMenu25D              ← NUEVO (incluye zona manual + offsets)
│   └── ToolbarOverlay25D           ← NUEVO (sliders + toggles inline)
├── StageControlPanel               ← NUEVO (panel lateral: sliders sala + capas)
│   ├── DimensionSliders            ← NUEVO (Ancho, Largo en metros)
│   ├── HeightLayerManager          ← NUEVO (capas + slider de altura)
│   └── VisualizationToggles        ← NUEVO (Grid 3D, Drop Lines, Snap)
└── PropertiesContent               (existente — extendido con offset XYZ)
```

### 2.2 Componentes eliminados

| Componente | Motivo |
|---|---|
| `ZoneOverlay` (render) | Extirpado del canvas. Los planos de color mueren. |
| `PerspectiveCamera` | Reemplazado por `OrthographicCamera` bloqueada en top-down. |
| `OrbitControls` completo | Reemplazado por pan 2D + zoom (sin rotación). |
| `normalizeZone()` auto-call en drop | Zona ya no se auto-calcula. Se asigna manualmente. |
| `Environment` / `fog` | Innecesario en vista técnica ortográfica. |
| `directionalLight` x2 | Ortho no necesita iluminación direccional. |

### 2.3 Componentes preservados (refactorizados)

| Componente | Adaptación |
|---|---|
| `CameraBridge` | Sigue exponiendo la cámara para D&D raycasting. |
| `WebGLContextHandler` | Sin cambios. |
| `BoxSelect` | Funciona igual en ortho (la proyección 3D→2D es más predecible). |
| `Fixture3D` | Se convierte en `FixtureSprite25D` — vista top-down con icono 2D. |
| `TransformGizmo` | Se adapta: snap a 0.25m, `showY={false}` se mantiene. |
| `ContextMenu` | Se extiende con "Asignar Zona" y "Offsets XYZ". |

---

## 3. LA CÁMARA ORTOGRÁFICA

### 3.1 Setup

```typescript
// OrthoCamera25D — cámara bloqueada en top-down
<OrthographicCamera
  makeDefault
  position={[0, 100, 0]}       // Mirando hacia abajo desde Y=100
  zoom={60}                     // ~60px por metro (ajustable)
  near={0.1}
  far={200}
  rotation={[-Math.PI / 2, 0, 0]}  // Mirar directamente al suelo
/>
```

### 3.2 Controles de navegación

Reemplazar `OrbitControls` por un control custom de pan+zoom:

| Acción | Gesto |
|---|---|
| **Pan** | Click derecho + arrastrar / Scroll medio + arrastrar |
| **Zoom** | Rueda del ratón (modifica `camera.zoom`) |
| **Rotación** | **BLOQUEADA** — no hay rotación. Es un plano técnico. |

Implementación: usar `MapControls` de Drei (que es `OrbitControls` con `enableRotate={false}` y `screenSpacePanning={true}`).

```typescript
<MapControls
  enableRotate={false}
  screenSpacePanning={true}
  minZoom={10}     // ~10px/m = zoom-out máximo
  maxZoom={200}    // ~200px/m = zoom-in para ajuste fino
  dampingFactor={0.1}
  mouseButtons={{
    LEFT: undefined,      // Left = selección
    MIDDLE: THREE.MOUSE.PAN,
    RIGHT: THREE.MOUSE.PAN,
  }}
/>
```

### 3.3 Coordenadas en pantalla

Con `OrthographicCamera` top-down (Y→up = out of screen):
- **Screen X** = World X (metros, izquierda/derecha)
- **Screen Y** = World Z (metros, arriba/abajo = fondo/frente del escenario)
- **World Y** = Altura (metros, hacia el techo — no visible directamente, representado por drop lines)

Orientación del plano:
```
     Z- (BACK — fondo del escenario)
      ↑
      │
X- ←──┼──→ X+ 
      │
      ↓
     Z+ (FRONT — audiencia)
```

---

## 4. EL GRID: PRECISIÓN DE 0.25m

### 4.1 Estructura de capas de grid

```typescript
// GridFloor25D — tres capas de grid superpuestas
const GridFloor25D: React.FC<{ width: number; depth: number }> = ({ width, depth }) => (
  <group>
    {/* Capa 1: Grid fino 0.25m — visible solo en zoom alto */}
    <gridHelper
      args={[maxDim, maxDim * 4]}  // cellSize = 0.25m
      material-color="#12121f"
      material-opacity={0.3}
      material-transparent
    />

    {/* Capa 2: Grid medio 1m — siempre visible */}
    <gridHelper
      args={[maxDim, maxDim]}      // cellSize = 1m
      material-color="#1a1a2e"
      material-opacity={0.5}
      material-transparent
    />

    {/* Capa 3: Grid grueso 5m — secciones de referencia */}
    <gridHelper
      args={[maxDim, maxDim / 5]}  // cellSize = 5m
      material-color="#2a2a44"
      material-opacity={0.7}
      material-transparent
    />
  </group>
)
```

**Nota**: El grid fino (0.25m) se oculta automáticamente cuando `camera.zoom < 40` para evitar moiré visual. Se controla vía `useFrame()` leyendo el zoom actual.

### 4.2 Snap a 0.25m

El `TransformControls` ya acepta `translationSnap`. Cambiar el default:

```typescript
// Antes:  snapDistance = 0.5  (50cm)
// Ahora:  snapDistance = 0.25 (25cm)
const SNAP_DISTANCE_M = 0.25
```

### 4.3 Coordenadas de referencia (ruler labels)

Etiquetas de metros en los bordes del grid:

```
// Ejemplo: cada 1m en el eje X, un label "-6m", "-5m", ..., "6m"
// Implementado con <Text> de @react-three/drei, posicionadas en los bordes
```

Visibles cuando zoom > 30. Se calculan dinámicamente desde las dimensiones del stage.

---

## 5. SLIDERS DE SALA

### 5.1 Ubicación

En el nuevo componente `StageControlPanel` (panel lateral derecho, debajo del properties panel — o como sección colapsable en el toolbar superior del canvas).

**Decisión de diseño**: Sliders en una **barra horizontal** sobre el canvas (header del viewport). Esto evita desplazar el panel lateral y mantiene los controles cerca del plano.

### 5.2 Rango y resolución

| Slider | Rango | Step | Default | Label |
|---|---|---|---|---|
| Ancho (Width) | 4m – 30m | 0.5m | 12m | `W: 12.0m` |
| Largo (Depth) | 4m – 30m | 0.5m | 8m | `L: 8.0m` |

### 5.3 Reactividad

Cambiar el slider modifica `stageStore.stage.width` / `stageStore.stage.depth` en tiempo real. Los componentes que leen estas dimensiones se re-renderizan:
- `StageOutline` (borde del escenario)
- `GridFloor25D` (tamaño del grid)
- D&D clamping (límites de drop)

### 5.4 Persistencia

`StageDimensions` ya existe en `ShowFileV2.ts` con `width`, `depth`, `height`, `gridSize`. Los sliders escriben directamente ahí via `stageStore.updateStageDimensions()`.

---

## 6. LÍNEAS DE CAÍDA (DROP LINES)

### 6.1 Concepto

Si un fixture está en `position = {x: 3, y: 5, z: -2}`, el técnico ve:

1. El **icono del fixture** en la posición `(x: 3, z: -2)` del plano top-down.
2. Una **línea vertical** (drop line) que baja desde el fixture hasta `y=0`.
3. Un **marcador en el suelo** (cross/circle) en `(x: 3, y: 0, z: -2)`.

Esto le dice al técnico: "este foco está directamente encima de este punto, a 5 metros de altura".

### 6.2 Implementación visual

```typescript
// DropLine — para UN fixture
const DropLine: React.FC<{ fixture: FixtureV2 }> = ({ fixture }) => {
  const { x, y, z } = fixture.position
  if (y <= 0.1) return null  // No dibujar si está en el suelo

  return (
    <group>
      {/* Línea vertical: fixture → suelo */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={new Float32Array([x, y, z, x, 0, z])}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineDashedMaterial
          color="#ffffff"
          opacity={0.15}
          transparent
          dashSize={0.2}
          gapSize={0.1}
        />
      </line>

      {/* Marcador en el suelo: cruz */}
      <group position={[x, 0.02, z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.08, 0.12, 16]} />
          <meshBasicMaterial color="#ffffff" opacity={0.2} transparent />
        </mesh>
      </group>

      {/* Label de altura junto al fixture */}
      <Html position={[x + 0.3, y, z]} center>
        <span style={{ color: '#fff', opacity: 0.4, fontSize: 10 }}>
          {y.toFixed(1)}m
        </span>
      </Html>
    </group>
  )
}
```

### 6.3 Toggle de visibilidad

Toggle en la barra inferior: `[☐ Drop Lines]`. Estado en `ConstructorContext.showDropLines: boolean` (default: `true`).

---

## 7. MALLA VOLUMÉTRICA (GRID 3D)

### 7.1 Concepto

Un toggle que activa una **malla de cubos transparentes** que divide el espacio en volúmenes de 1m³. Esto ayuda al técnico a "ver" la altura cuando lo necesite — pero no es el estado default (añade complejidad visual).

### 7.2 Implementación

```typescript
// VolumetricGrid — malla 3D de líneas
const VolumetricGrid: React.FC<{
  width: number
  depth: number
  height: number
  visible: boolean
}> = ({ width, depth, height, visible }) => {
  if (!visible) return null

  // Dibujar planos horizontales cada 1m de altura
  const planes = []
  for (let y = 1; y <= height; y++) {
    planes.push(
      <gridHelper
        key={`vol-${y}`}
        args={[Math.max(width, depth), Math.max(width, depth)]}
        position={[0, y, 0]}
        material-color="#1a1a2e"
        material-opacity={0.08}
        material-transparent
      />
    )
  }

  // Dibujar líneas verticales en las esquinas del stage
  const verticalLines = [
    [-width/2, -depth/2],
    [width/2, -depth/2],
    [-width/2, depth/2],
    [width/2, depth/2],
  ]

  return <group>{planes}{/* ... vertical edges ... */}</group>
}
```

### 7.3 Toggle

Toggle en la barra inferior: `[☐ Grid 3D]`. Estado en `ConstructorContext.showVolumetricGrid: boolean` (default: `false`).

**Nota importante**: En cámara ortográfica top-down, los planos horizontales del grid volumétrico se ven como líneas superpuestas al grid del suelo (misma proyección). Las líneas verticales son **puntos** (proyección de una línea perpendicular a la pantalla = un punto). Por tanto, el grid volumétrico es más útil si el usuario tiene una tecla de "tilt temporal" que inclina la cámara ~15° para ver la profundidad. Esto se puede implementar como un hold de tecla (`Shift` → tilt 15° temporalmente), pero es una extensión futura.

**Alternativa más práctica**: En lugar de una malla 3D real, mostrar **barras de altura** (height bars) al lado de cada fixture — una barrita vertical proporcional a Y que sale del icono del fixture. Esto da la misma información sin salir del plano 2D.

```
  ▌ MH-01 [5.0m]     ← barra de altura + label
  ◇                    ← icono fixture
  +                    ← proyección suelo
```

**Decisión**: Implementar AMBAS opciones — grid volumétrico (toggle) y height bars (siempre visibles cuando Y > 0). Las barras son la visualización primaria; el grid 3D es para usuarios avanzados.

---

## 8. CAPAS DE ALTURA (HEIGHT LAYERS)

### 8.1 Modelo de datos

```typescript
// Nuevo en ShowFileV2.ts
interface HeightLayer {
  id: string
  name: string           // "Floor", "Truss Low", "Truss High", "Ceiling"
  height: number          // metros (0, 3, 5, 8)
  color: string           // color visual para badges y barras
  isDefault: boolean      // una sola capa es la activa por defecto
}

// Defaults:
const DEFAULT_HEIGHT_LAYERS: HeightLayer[] = [
  { id: 'floor',      name: 'Floor',      height: 0,   color: '#22c55e', isDefault: false },
  { id: 'truss-low',  name: 'Truss Low',  height: 3,   color: '#eab308', isDefault: false },
  { id: 'truss-high', name: 'Truss High', height: 5,   color: '#ef4444', isDefault: true  },
  { id: 'ceiling',    name: 'Ceiling',     height: 8,   color: '#a855f7', isDefault: false },
]
```

### 8.2 Selector de capa activa

En la barra inferior del canvas (o en el `StageControlPanel`):

```
[LAYER] ● Truss High (5.0m)  ○ Truss Low (3.0m)  ○ Floor (0m)  ○ Ceiling (8m)
         [═════════●═══════] 5.0m    ← slider de altura de la capa seleccionada
```

- **Radio buttons**: seleccionan la capa activa.
- **Slider de altura**: modifica la altura de la capa seleccionada (rango: 0m – 15m, step: 0.25m).
- **Color dot**: cada capa tiene un color. Los fixtures en esa capa muestran un badge de ese color.

### 8.3 Comportamiento de drop

Cuando el técnico arrastra un fixture desde la library al canvas:

1. El fixture se crea con `position.y = activeLayer.height`.
2. Se asigna `fixture.layerId = activeLayer.id` (nuevo campo en `FixtureV2`).
3. El label del fixture muestra `[5.0m]` junto al nombre.
4. La barra de altura y la drop line se dibujan automáticamente.

### 8.4 Cambiar capa de un fixture existente

- **Context Menu** → "Mover a capa" → submenu con las capas disponibles.
- **Multi-selección** → "Mover a capa" aplica a todos los seleccionados.
- El fixture hereda la `height` de la nueva capa.

### 8.5 Filtrado visual por capa

Toggle opcional: "Mostrar solo capa activa". Cuando está activado, los fixtures de otras capas se muestran en gris con 30% de opacidad. Útil cuando hay muchos fixtures apilados en el mismo X,Z pero en capas diferentes.

---

## 9. OFFSETS MANUALES (PRECISIÓN FINAL)

### 9.1 Acceso

**Doble click** en un fixture → abre un panel flotante (popover/modal mini) con inputs numéricos:

```
┌──────────────────────────────┐
│ 📐 OFFSET — MH-01            │
│                              │
│  X: [  3.25 ] m              │
│  Y: [  5.00 ] m              │
│  Z: [ -2.50 ] m              │
│                              │
│  [Aplicar]  [Cancelar]       │
└──────────────────────────────┘
```

### 9.2 Inputs numéricos

- Campos `<input type="number">` con step=0.01 (precisión de 1cm).
- Pre-populated con la posición actual del fixture.
- Al cambiar un valor, el fixture se mueve en el canvas en tiempo real (preview).
- "Aplicar" confirma; "Cancelar" revierte al estado anterior.

### 9.3 Acceso alternativo

También accesible desde:
- **Context Menu** → "Posición exacta..."
- **Properties Panel** (sidebar derecha) → Sección "Position" ya existente, extendida con inputs editables.

---

## 10. EXTIRPACIÓN DEL ZONEOVERLAY

### 10.1 Lo que MUERE

- `<ZoneOverlay>` ya no se renderiza en el canvas.
- Los rectángulos de color en el suelo se eliminan.
- Los labels de zona en el suelo se eliminan.
- La función `normalizeZone()` ya no se llama automáticamente en `handlePositionChangeWithZone()`.
- La función `getZoneAtPosition()` ya no se llama automáticamente en `TransformGizmo` on drag end.

### 10.2 Lo que SOBREVIVE (como utility)

- `getZoneAtPosition()` → se mantiene como helper exportado. Puede usarse en otros contextos.
- `getZoneColor()`, `getZoneName()` → se mantienen como helpers para UI (badges de zona en el properties panel).
- `ZONE_DEFINITIONS` → se mantiene como data source para el selector de zona manual.

### 10.3 Asignación manual de zona

En el **Context Menu** (click derecho sobre fixture seleccionado):

```
┌──────────────────────────────┐
│ 🪜 ALTURA                    │
│   → Floor (0m)               │
│   → Truss Low (3m)           │
│   → Truss High (5m)          │
│   → Ceiling (8m)             │
│──────────────────────────────│
│ 🗺️ ZONA                     │  ← NUEVO
│   → FRONT                    │
│   → BACK                     │
│   → CENTER                   │
│   → MOVERS-LEFT              │
│   → MOVERS-RIGHT             │
│   → FLOOR                    │
│   → AIR                      │
│──────────────────────────────│
│ 🔄 FLIP                      │
│   → L/R                      │
│   → F/B                      │
│──────────────────────────────│
│ 📐 Posición exacta...        │  ← NUEVO (abre offset panel)
│ ✏️ Edit                      │
│ 🗑️ Delete                    │
└──────────────────────────────┘
```

El fixture almacena `zone` directamente en el store. No hay auto-cálculo.

**Exception**: Al hacer drop de un fixture nuevo, si no se ha asignado zona, se puede sugerir una basada en posición (usando `getZoneAtPosition()`) pero se muestra como **sugerencia editable**, no como asignación automática silenciosa.

---

## 11. FIXTURE SPRITE 2.5D

### 11.1 Representación top-down

En vista ortográfica top-down, los fixtures se ven desde arriba. Las geometrías 3D actuales (cone, cylinder, box, sphere) no tienen sentido. Se reemplazan por **sprites 2D** (planos horizontales con iconos):

| Tipo | Icono top-down | Color |
|---|---|---|
| `moving-head` | Círculo con flecha (indicando dirección) | Purple `#a855f7` |
| `par` | Círculo sólido | Green `#4ade80` |
| `wash` | Círculo sólido (ligeramente más grande) | Blue `#3b82f6` |
| `strobe` | Cuadrado | Red `#ef4444` |
| `blinder` | Cuadrado (más grande) | Amber `#fbbf24` |
| `laser` | Diamante (rombo) | Orange `#f97316` |
| `bar` | Rectángulo horizontal | White `#e2e8f0` |
| default | Círculo pequeño | Gray `#6b7280` |

Implementación: `<mesh rotation={[-Math.PI/2, 0, 0]}>` con `<circleGeometry>` / `<planeGeometry>` + `<meshBasicMaterial>`. Sin iluminación (materiales basic/unlit).

### 11.2 Tamaño visual

Tamaño fijo en metros mundo (no en píxeles). Un fixture ocupa ~0.4m de diámetro en el plano. Esto se mantiene constante independientemente del zoom — lo que cambia es cuántos píxeles ocupa en pantalla.

### 11.3 Label siempre visible

A diferencia del diseño actual (label solo en hover/select), en el plano técnico los labels se muestran **siempre** (toggle con `showFixtureNames` existente en `StageVisuals`):

```
MH-01 [5.0m]     ← nombre + altura
  ◇               ← icono
```

Fuente: 9px monospace, color según capa, opacidad 0.7.

---

## 12. ESTADO: EXTENSIONES AL STORE

### 12.1 Nuevos campos en `stageStore`

```typescript
// Nuevos campos en StageStoreState:
interface StageStoreState {
  // ... existentes ...

  /** Height layers for 2.5D positioning */
  heightLayers: HeightLayer[]

  /** Currently active layer ID */
  activeLayerId: string
}

// Nuevas acciones:
interface StageStoreActions {
  // ... existentes ...

  /** Update stage dimensions (width, depth) */
  updateStageDimensions: (dims: Partial<StageDimensions>) => void

  /** Set active height layer */
  setActiveLayer: (layerId: string) => void

  /** Update height layer */
  updateHeightLayer: (layerId: string, updates: Partial<HeightLayer>) => void

  /** Add custom height layer */
  addHeightLayer: (name: string, height: number) => void

  /** Remove height layer */
  removeHeightLayer: (layerId: string) => void
}
```

### 12.2 Nuevo campo en `FixtureV2`

```typescript
// En ShowFileV2.ts — FixtureV2:
interface FixtureV2 {
  // ... existentes ...

  /** Height layer ID (for 2.5D layer management) */
  layerId?: string
}
```

### 12.3 Extensiones al `ConstructorContext`

```typescript
interface ConstructorContextType {
  // ... existentes ...

  // 2.5D controls
  showDropLines: boolean
  setShowDropLines: (show: boolean) => void

  showVolumetricGrid: boolean
  setShowVolumetricGrid: (show: boolean) => void

  showOnlyActiveLayer: boolean
  setShowOnlyActiveLayer: (show: boolean) => void
}
```

### 12.4 Persistencia

`HeightLayer[]` se persiste en el ShowFile vía un nuevo campo `heightLayers` en `ShowFileV2`. Migration: si el campo no existe al cargar, se inicializa con `DEFAULT_HEIGHT_LAYERS`.

---

## 13. SERIALIZACIÓN Y MIGRACIÓN

### 13.1 ShowFileV2 — Nuevo campo

```typescript
interface ShowFileV2 {
  // ... existentes ...

  /** 2.5D height layers (WAVE 4527) */
  heightLayers?: HeightLayer[]
}
```

### 13.2 Migración automática

Al cargar un ShowFile sin `heightLayers`, el `stageStore.loadShowFile()` lo inicializa:

```typescript
if (!showFile.heightLayers) {
  showFile.heightLayers = DEFAULT_HEIGHT_LAYERS
}
```

Los fixtures existentes sin `layerId` se asignan a la capa más cercana a su `position.y`:

```typescript
for (const fixture of showFile.fixtures) {
  if (!fixture.layerId) {
    fixture.layerId = findClosestLayer(fixture.position.y, showFile.heightLayers).id
  }
}
```

---

## 14. INTERACCIÓN DETALLADA: D&D FIXTURE

### 14.1 Flujo completo (nuevo)

```
1. Técnico selecciona capa activa: "Truss High (5.0m)"
2. Arrastra fixture desde library sidebar al canvas
3. El cursor muestra ghost con badge de color de la capa
4. Al soltar:
   a. Raycaster intersecta con plano y=0 (suelo) → obtiene (x, z)
   b. El fixture se crea con position = { x, y: 5.0, z }
   c. Se asigna layerId = 'truss-high'
   d. Se sugiere zona basada en posición (pero editable)
   e. Aparece la drop line (5m de línea punteada al suelo)
   f. Aparece la barra de altura y el label "[5.0m]"
5. El técnico puede mover el fixture en XZ con drag/gizmo (snap 0.25m)
6. La altura permanece fija a la capa — solo cambia con context menu o offset panel
```

### 14.2 Multi-drop

Arrastrar + mantener `Alt` → drop múltiple (cada click suelta un fixture en la posición del cursor sin cerrar el modo de drop). Útil para colocar 8 PARs en fila.

---

## 15. DIAGRAMA DE FLUJO DE DATOS

```mermaid
flowchart TD
    A[Usuario arrastra fixture] --> B{Capa activa?}
    B --> C[activeLayer.height = Y]
    
    A --> D[Raycast → plano Y=0]
    D --> E[worldX, worldZ]
    
    C --> F[position = {x: worldX, y: height, z: worldZ}]
    E --> F
    
    F --> G[stageStore.addFixture]
    G --> H[Canvas re-render]
    
    H --> I[FixtureSprite25D @ worldX, worldZ]
    H --> J[DropLine: y=height → y=0]
    H --> K[HeightBar + Label]
    
    L[Context Menu → Zona] --> M[stageStore.setFixtureZone]
    M --> H
    
    N[Slider Ancho/Largo] --> O[stageStore.updateStageDimensions]
    O --> P[StageOutline resize]
    O --> Q[GridFloor25D resize]
    
    R[Slider Altura capa] --> S[stageStore.updateHeightLayer]
    S --> T[Fixtures en esa capa → position.y update]
    T --> H
```

---

## 16. PLAN DE EJECUCIÓN

| Paso | Descripción | Complejidad | Dependencias |
|---|---|---|---|
| **E1** | Añadir `HeightLayer[]`, `activeLayerId` al store + `layerId` a `FixtureV2` | 🟢 Bajo | Ninguna |
| **E2** | Crear `OrthoCamera25D` + `MapControls` (reemplazar PerspectiveCamera + OrbitControls) | 🟢 Bajo | Ninguna |
| **E3** | Crear `GridFloor25D` con 3 capas (0.25m, 1m, 5m) + auto-hide del grid fino por zoom | 🟡 Medio | E2 |
| **E4** | Crear `StageOutline` reactivo a `stage.width` / `stage.depth` | 🟢 Bajo | E1 |
| **E5** | Crear `FixtureSprite25D` — iconos 2D por tipo, labels siempre visibles | 🟡 Medio | E2 |
| **E6** | Crear `DropLine` + `HeightBar` per-fixture | 🟡 Medio | E5 |
| **E7** | Crear `DimensionSliders` (Ancho, Largo) en header del canvas | 🟢 Bajo | E4 |
| **E8** | Crear `HeightLayerManager` (radio buttons + slider) en footer del canvas | 🟡 Medio | E1 |
| **E9** | Adaptar `TransformGizmo` para snap 0.25m + XZ only (ya parcialmente hecho) | 🟢 Bajo | E2 |
| **E10** | Eliminar `<ZoneOverlay>` del render tree | 🟢 Trivial | Ninguna |
| **E11** | Extender `ContextMenu` con "Asignar Zona" submenu + "Mover a Capa" submenu | 🟡 Medio | E1, E10 |
| **E12** | Crear panel de offsets XYZ (doble click / context menu "Posición exacta") | 🟡 Medio | E5 |
| **E13** | Crear `VolumetricGrid` (toggle Grid 3D) | 🟢 Bajo | E2, E7 |
| **E14** | Adaptar D&D para asignar `layerId` + `position.y` automáticamente | 🟡 Medio | E1, E8 |
| **E15** | Adaptar `BoxSelect` para ortho (debería funcionar sin cambios) | 🟢 Bajo | E2 |
| **E16** | Eliminar `Environment`, `fog`, luces direccionales (innecesarios en ortho) | 🟢 Trivial | E2 |
| **E17** | Crear `VisualizationToggles` (Drop Lines, Grid 3D, Only Active Layer) | 🟢 Bajo | E6, E13 |
| **E18** | Migración automática de ShowFile: inicializar `heightLayers` si no existe | 🟢 Bajo | E1 |
| **E19** | Coordenate rulers (labels de metros en los bordes del grid) | 🟢 Bajo | E3 |

### Orden sugerido de implementación

```
Fase 1 — Cimientos:          E1 → E2 → E3 → E4 → E16
Fase 2 — Fixtures:           E5 → E6 → E9 → E15
Fase 3 — Controles:          E7 → E8 → E14 → E17
Fase 4 — Interacción:        E10 → E11 → E12
Fase 5 — Polish:             E13 → E18 → E19
```

---

## 17. DECISIONES ARQUITECTÓNICAS

| # | Decisión | Alternativa rechazada | Razón |
|---|----------|-----------------------|-------|
| D1 | `OrthographicCamera` bloqueada top-down | `PerspectiveCamera` con ángulo fijo | Ortho elimina toda distorsión. Un metro en pantalla = un metro en mundo, sin importar la posición. |
| D2 | `MapControls` (pan+zoom, sin rotación) | `OrbitControls` con polar angle fijo | `MapControls` de Drei es exactamente la semántica que necesitamos: pan 2D + zoom. |
| D3 | Grid de 0.25m como resolución de snap | 0.5m (actual) o 0.1m | 0.25m = 25cm es la precisión estándar de rigging. 0.1m sería sobre-ingeniería. 0.5m es demasiado impreciso para IK. |
| D4 | Drop lines (líneas de caída) | Sombras proyectadas | Las sombras requieren iluminación direccional (que eliminamos). Las drop lines son explícitas y técnicas. |
| D5 | Height bars (barras de altura) | Solo drop lines | Las barras de altura dan feedback visual inmediato sin necesidad de interpretar la longitud de una línea punteada. |
| D6 | Capas de altura predefinidas + customizables | Solo slider continuo de Y | Las capas son la metáfora más rápida: "pon esto en el truss alto" es más rápido que "pon esto a 5.23m". El slider permite ajuste fino. |
| D7 | Zona manual por context menu | Auto-cálculo por posición (actual) | El técnico SABE en qué zona está cada foco. El auto-cálculo comete errores con fixtures edge-case (strobe en lateral = ¿CENTER o FLOOR?). Control manual = zero ambiguity. |
| D8 | Sprites 2D (planos horizontales) | Geometrías 3D vistas desde arriba | En ortho top-down, un cono se ve como un punto. Un sprite 2D tiene forma legible y controlable. |
| D9 | Labels siempre visibles | Labels solo en hover (actual) | En un plano técnico, la información debe ser visible sin interacción. El técnico necesita leer nombre+altura de un vistazo. |
| D10 | `VolumetricGrid` como toggle avanzado | Siempre visible | La malla 3D en ortho top-down se colapsa visualmente. Solo es útil con tilt temporal o para usuarios que entienden la proyección. |

---

## 18. RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Moiré visual del grid 0.25m en zoom bajo | 🟡 Media | Auto-hide: `visible = camera.zoom > 40` |
| D&D raycast falla con ortho camera | 🟢 Baja | `Raycaster.setFromCamera()` funciona con ortho. Confirmado en Three.js docs. |
| Fixtures apilados en mismo XZ (capas distintas) difíciles de seleccionar | 🟡 Media | "Solo capa activa" toggle + opacity reducida para fixtures de otras capas. |
| `MapControls` no disponible en la versión de Drei actual | 🟢 Baja | `MapControls` existe en Drei ≥ 9.x. Fallback: `OrbitControls` con `enableRotate={false}` + `screenSpacePanning={true}`. |
| Labels de texto `<Html>` de Drei causan re-render excesivo | 🟡 Media | Usar `<Text>` de Drei (rendered en WebGL, no DOM) para labels. Solo usar `<Html>` para popups interactivos. |
| Migración de ShowFile rompe ficheros existentes | 🟢 Baja | `heightLayers` es opcional. `layerId` es opcional. Fixtures sin estos campos funcionan con defaults. |
| Grid fino (0.25m) degrada performance con grids enormes (30m×30m) | 🟡 Media | Limitar el grid fino a un viewport visible (frustum culling). O usar shader-based grid en vez de `gridHelper`. |

---

## 19. EXTENSIONES FUTURAS (NO IMPLEMENTAR AHORA)

| Feature | Descripción |
|---|---|
| **Tilt temporal** | Hold `Shift` → la cámara se inclina 15° para ver la profundidad momentáneamente. |
| **Truss visual** | Dibujar barras de truss entre fixtures de la misma capa que están alineados en X o Z. |
| **Perfiles de sala (.lsroom)** | Propuesta 5 del brainstorming — serializar layout + dimensiones. |
| **Calibración por apuntado** | Propuesta 1/4 del brainstorming — feedback de Pan/Tilt para calcular Y real. |
| **Ruler tool** | Click + drag para medir distancia entre dos puntos en metros. |
| **Fixture duplication** | `Ctrl+D` duplica el fixture seleccionado con offset de 0.5m en X. |
| **Alignment tools** | Alinear fixtures seleccionados en fila (X constante) o columna (Z constante). |

---

*Documento generado bajo directiva WAVE 4527 — THE 2.5D CONSTRUCTOR*
*Blueprint completado. Sin código escrito. Listo para aprobación del Cónclave.*
