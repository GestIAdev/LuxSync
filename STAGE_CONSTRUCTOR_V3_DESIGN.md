# STAGE CONSTRUCTOR V3 — "OBSIDIAN STUDIO" (WAVE 7179)

**Directiva:** Rediseño conceptual integral de los lienzos 2D/3D del Stage Constructor.
**Base técnica:** `UNIFIED_IKVMM_BLUEPRINT.md` (P1–P4: MountTransform SSOT, placementMode, Single-Solve, Calibration Dock).
**Filosofía:** *De prototipo neón a instrumento de precisión.* Elegancia oscura de motor 3D profesional. La interfaz respira: el canvas es el protagonista, todo lo demás flota, aparece cuando se necesita y desaparece cuando no.

---

## 0. Manifiesto Visual

> **"El escenario vacío ya es hermoso antes de encender el primer foco."**

Tres principios rectores:

1. **Oscuridad materializada** — no negro plano (#000), sino un mundo con materia: superficies mate que absorben luz, reflejos apagados, atmósfera con densidad. El operador trabaja *dentro* de un estudio, no frente a un diagrama.
2. **Información latente** — cotas, elevaciones, zonas y rangos existen siempre, pero se revelan por proximidad, hover o contexto de herramienta. Cero ruido permanente.
3. **Una sola familia cromática** — el "Obsidian Palette" (§1) gobierna 2D, 3D y HUD. Cambiar de vista nunca debe sentirse como cambiar de aplicación.

---

## 1. Obsidian Palette — Sistema Cromático Unificado

| Token | Hex | Uso |
|---|---|---|
| `--obs-void` | `#0B0D12` | Fondo absoluto (cielo 3D, fuera-de-plano 2D) |
| `--obs-floor` | `#14171F` | Suelo del estudio / papel del blueprint |
| `--obs-surface` | `#1B1F2A` | Paneles HUD, trusses, geometría estructural |
| `--obs-line` | `#2A3040` | Rejillas, tramas, líneas de cota en reposo |
| `--obs-ink` | `#8B94A8` | Texto secundario, simbología pasiva |
| `--obs-bright` | `#E4E9F2` | Texto primario, valores numéricos |
| `--obs-accent` | `#5EEAD4` | Cian-menta desaturado: selección, snap activo, cotas en foco |
| `--obs-amber` | `#F5B04D` | Estados de calibración / warning / elevación en edición |
| `--obs-magenta` | `#E455A0` | Overrides manuales, conflictos, unreachable IK |
| `--obs-ghost` | `rgba(94,234,212,0.12)` | Fantasmas, previews, halos de drop |

**Regla:** el neón saturado (`#00F0FF` actual) queda RESERVADO para los haces de luz de los fixtures — la única "luz de verdad" del estudio. La UI nunca compite en saturación con el show.

---

## 2. Lienzo 3D — "STUDIO MODE"

### 2.1 El entorno: de wireframe a black-box theater

Abandonamos la caja de alambre. El nuevo entorno es un **estudio de ensayo físico**:

| Elemento | Diseño | Implementación R3F |
|---|---|---|
| **Suelo** | Plano mate `--obs-floor` con **reflejo especular al 6–8%** (los fixtures y haces se insinúan invertidos, como en un escenario encerado). Rejilla de voxels (0.25m) grabada como *micro-surco*, no como línea luminosa: visible solo en ángulos rasantes y bajo el cursor. | `MeshReflectorMaterial` (drei) con `mirror={0.07}`, `blur={[400,100]}`, `resolution=512` (LQ-safe). Rejilla como shader de suelo (`fragmentShader` con `fwidth`), NO `gridHelper`. |
| **Atmósfera** | **Niebla volumétrica de bajísima densidad** que da caída a la luz y separa planos de profundidad. El fondo se disuelve al vacío sin horizonte duro. | `<fog attach="fog" args={['#0B0D12', 12, 45]} />` + partículas de polvo suspendido (`Points`, 300 sprites, drift lento) solo en HQ. |
| **Límites (Crystal Box)** | Las paredes desaparecen. En su lugar: **aristas de contención** — 12 segmentos de arista con gradiente que se enciende solo cuando un fixture arrastrado se acerca a <0.5m del límite (feedback de clamp). | `Line2` (drei) con opacidad animada por distancia al drag activo. |
| **Cielo técnico** | Sin skybox. Gradiente radial sutilísimo `--obs-void` → negro puro cenital, con una "luz de trabajo" fría direccional (como los fluorescentes de servicio de un teatro apagado). | `Environment` custom mínimo + 1 `directionalLight` fría (intensity 0.35) + `ambientLight` 0.15. |

### 2.2 Estructuras físicas snapeables: el Rigging Kit

Nuevo sistema de **geometría estructural** — el operador ya no cuelga focos "del aire":

```
Rigging Kit (drag & drop desde HUD):
├── Truss recto (secciones de 2m/3m, sección triangular 30cm)
├── Truss curvo (arco 90°, radio 2m)
├── Tótem / Torre (1.5m / 2.5m, base lastrada)
├── Pipa frontal / trasera (barra simple)
└── Puente (goalpost: 2 torres + truss superior)
```

**Diseño material:** aluminio anodizado oscuro (`--obs-surface`, metalness 0.85, roughness 0.4). Geometría *low-poly instanciada* — cada sección de truss es una `InstancedMesh` de cordones + diagonales (≤200 tris por sección).

**Mecánica de snap magnético:**
- Al arrastrar un fixture cerca de un truss (<0.4m), aparecen **puntos de anclaje** (discos `--obs-accent` de 6cm) cada 0.5m a lo largo del cordón inferior.
- El fixture "imanta" al punto más cercano con una animación de asentamiento (spring 120ms) y **hereda automáticamente**: `position.y` del truss, `orientation: 'ceiling'` (o `'totem'` en torres), y una referencia `rigId` para mover el truss con todos sus fixtures colgados.
- Snap al suelo → `orientation: 'floor'` (comportamiento actual preservado).

Esto convierte la inferencia de orientación (hoy un default ciego) en una **consecuencia física natural** — sinergia directa con `MountTransform` SSOT del blueprint.

### 2.3 Fixtures en reposo: presencia sin ruido

- Cuerpo del fixture en materiales del estudio (no glow). La **lente** es el único punto con emisión tenue (2%) — un "piloto de standby".
- **Selección:** en vez del anillo plano actual, un *rim-light* cian que recorre la silueta (shader fresnel) + peana de selección proyectada en el suelo.
- **Unplaced (ghost):** los fixtures `placementMode: 'unplaced'` se renderizan como **holografía de vidrio** (transmisión 0.9, sin sombra, flotando en su posición de zone-layout) — invitación visual a "materializarlos" colocándolos.

### 2.4 Calibration Beam Ghost — integración orgánica

Al entrar en tool mode `'calibrate'` el estudio entra en **"modo servicio"**:

1. La luz de trabajo baja al 40% y la niebla sube levemente — el ambiente le dice al operador "estamos calibrando".
2. **Rayo ideal (verde quirúrgico `#7DF2A8`):** línea láser de 1px con leve bloom, del pivote del fixture al `referenceTarget`. Termina en una **retícula de diana** proyectada en el suelo (2 círculos concéntricos + cruz, shader decal).
3. **Cono real (ámbar `--obs-amber`):** el haz físico actual del hardware, renderizado con el pipeline existente pero tintado ámbar durante la sesión.
4. **La calibración ES la convergencia visual:** cuando `|ideal - real| < 0.5°`, ambos se funden en blanco puro y la diana emite un pulso de confirmación. Cero números necesarios para el ajuste grueso; el `OffsetTrimPad` del HUD muestra los grados exactos para el fino.
5. Los demás fixtures se atenúan a 15% de opacidad — foco total en el instrumento en calibración.

---

## 3. Lienzo 2D — "BLUEPRINT MODE"

### 3.1 De mapa de colores a plano técnico

El canvas 2D se reimagina como un **plano CAD nocturno** — el plano que un jefe técnico imprimiría, pero vivo:

| Capa (z-order) | Contenido | Estilo |
|---|---|---|
| 0 — Papel | Fondo `--obs-floor` con textura de grano sutilísima (2% noise) | El "papel carbón" del blueprint |
| 1 — Rejilla | Doble trama: fina cada 0.25m (voxel, opacidad 4%), maestra cada 1m (opacidad 10%) con cruces `+` en intersecciones cada 5m | Líneas hairline `--obs-line` |
| 2 — Arquitectura | Borde del escenario con **doble línea técnica** + achurado exterior (hatching 45°) marcando "fuera de sala". Boca del escenario, línea de proscenio | Convención CAD real |
| 3 — Zonas | **YA NO bloques sólidos.** Cada zona canónica es un contorno de **línea discontinua** con su nombre en tipografía técnica condensada (mayúsculas, tracking amplio, 9px) en la esquina interior. Relleno: trama de puntos al 3% solo en hover/asignación | Como habitaciones en un plano de arquitecto |
| 4 — Cotas | Líneas de cota (dimension lines) con flechas de arquitecto y valor en metros, **solo visibles**: al arrastrar (distancia al borde y a fixtures vecinos, en vivo) o con la tecla `D` (toggle "modo medición") | `--obs-ink`, valor activo en `--obs-accent` |
| 5 — Fixtures | Simbología profesional (§3.2) | — |
| 6 — HUD contextual | Chips de elevación, halos de drop, lazo de selección | — |

### 3.2 Simbología de iluminación profesional

Sustituimos los triángulos genéricos por una **librería de símbolos** inspirada en la notación USITT/plot de iluminación:

```
◐  Moving Head (spot):  círculo con cuña de orientación — la cuña marca el
                        yaw base; un arco fino punteado dibuja el panRange real
▭  Wash / PAR:          rectángulo con hachurado interior según haz (beam/flood)
◇  Strobe/Blinder:      rombo con doble borde
✳  Laser:               asterisco técnico en caja
─▬─ Truss (planta):     doble línea con marcas de sección cada 2m; los fixtures
                        colgados se dibujan SOBRE la línea con tick de anclaje
```

- Trazo `--obs-bright` a 1px, relleno transparente. El **color del fixture es un anillo delgado** exterior (su color actual de DMX en vivo, si hay show corriendo) — el plano queda técnico pero respira estado real.
- Etiqueta compacta bajo el símbolo: `MH-07 · U1.121` (nombre + universo.dirección) en 8px, visible desde zoom ≥ 60%.
- `unreachable` en modo target: el símbolo parpadea el anillo en `--obs-magenta`.

### 3.3 Elevación Interactiva — el eje Y sin ensuciar el top-down

El problema: representar Y en una vista cenital sin saturar. Solución de tres niveles, **todos latentes**:

**Nivel 1 — Percepción pasiva (siempre activa, coste visual ~cero):**
- **Sombra de altura:** cada fixture proyecta bajo su símbolo un halo difuso cuyo desenfoque y separación codifican elevación — a más altura, halo más amplio y desplazado (como una sombra real con luz cenital). Lectura preconsciente: "ese foco está alto".
- Los fixtures a nivel de suelo (`floor`, y<0.3m) no tienen halo — asientan directo en el papel.

**Nivel 2 — Lectura precisa (hover):**
- Al pasar el cursor: un **flag de cota vertical** minimalista — línea guía de 16px hacia el noreste del símbolo terminada en chip `▲ 4.25m`. Desaparece a los 400ms de salir. Estilo idéntico a las cotas de la capa 4: es parte del lenguaje del plano, no un tooltip genérico.

**Nivel 3 — Edición (interacción directa, sin panel):**
- **Scroll sobre el símbolo** (o drag vertical con `Alt`): ajusta `position.y` en pasos de voxel (0.25m). Durante el ajuste:
  - El chip de cota se fija y entra en `--obs-amber` (estado de edición).
  - Aparece un **perfil lateral fantasma** en el margen derecho del plano: silueta en corte del escenario (suelo + altura de sala) con un marcador mostrando la posición del fixture en Y y las alturas de trusses cercanos como líneas de referencia. Se desvanece al soltar.
  - El anillo de alcance del haz (proyección del cono a y=0 según `tiltRange`) se redibuja en vivo — el operador VE cómo su cobertura crece/encoge con la altura.
- Escribe vía `setFixtureElevation()` (blueprint P2) — snap + clamp al Crystal Box garantizados por el store.

**Resultado:** el plano en reposo es limpio como un blueprint impreso; toda la dimensión Y vive en la interacción.

### 3.4 Drag & drop: fricción cero preservada

- El drop mantiene el pipeline actual (`placeFixture2D`), pero el feedback sube de nivel: al arrastrar sobre el plano, el símbolo fantasma va acompañado de **cotas vivas** a los dos bordes más cercanos y una línea de alineación (`--obs-accent` punteada) cuando queda a <0.1m del eje de otro fixture — alineado con un imán suave estilo Figma.
- Zona receptora en hover de drop: su contorno discontinuo se vuelve continuo + trama de puntos al 8%. Nada de flashes de color sólido.

---

## 4. Filosofía UI "Breathing Space" — El HUD

### 4.1 Principio: cero muros, todo satélites

Desaparecen la `FixtureLibrarySidebar` monolítica y el panel de propiedades fijo. El canvas ocupa el **100% del viewport**. Alrededor orbitan cuatro satélites flotantes:

```
┌──────────────────────────────────────────────────────────────┐
│ ◈ Command Strip (top-center, flotante, 40px)                 │
│   [2D/3D] [Select|Move|Rig|Calibrate|Measure] [Snap ⚙] [👁]  │
│                                                              │
│                                                              │
│   ┌─────┐                                        ┌─────────┐ │
│   │ ◧   │           C A N V A S                  │ ⌖ Inspec-│ │
│   │Dock │         (100% viewport)                │  tor     │ │
│   │Rail │                                        │ (contex- │ │
│   └─────┘                                        │  tual)   │ │
│                                                  └─────────┘ │
│                                                              │
│ ◇ Status Ribbon (bottom, 24px, texto puro)                   │
│   x:2.50 y:4.25 z:-1.75 │ 24 fixtures · 3 rigs │ snap 0.25m │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Los cuatro satélites

**◈ Command Strip** (superior centro) — la única pieza siempre visible. Cápsula de vidrio oscuro (`backdrop-filter: blur(12px)`, fondo `--obs-surface` al 75%) con: toggle 2D/3D (transición cinematográfica §4.4), herramientas como iconos-modo, y ajustes de snap/visibilidad en popovers.

**◧ Dock Rail — la librería que respira** (izquierda). Un raíl de 48px con iconos por categoría (Moving/PAR/Strobe/Laser/**Rigging**/Ingenios). Comportamientos:
- *Hover en icono* → despliega un **flyout** de 280px con las cards de esa categoría (nombre, fabricante, mini-render, tags). Se retrae al iniciar el drag — durante el arrastre **solo existe el canvas**.
- *Pin opcional*: doble click ancla el flyout para sesiones de patch intensivo. Aún anclado, es flotante con margen — nunca toca los bordes del viewport.
- Búsqueda: `Ctrl+K` abre un **command palette** central (estilo Spotlight) que busca fixtures, rigs y acciones — la forma más rápida de patchear sin tocar el ratón dos veces.

**⌖ Inspector Contextual** (derecha) — NO existe hasta que hay selección. Aparece como tarjeta flotante (320px, spring 150ms desde el borde) cuyo contenido es 100% contextual:
- Fixture seleccionado → identidad, posición XYZ editable, orientación (con mini-gizmo 3D), calibración resumida, zona.
- Truss seleccionado → longitud, altura, fixtures colgados (lista con jump-to).
- Multi-selección → operaciones de grupo (alinear, distribuir, elevar en bloque).
- Tool `'calibrate'` → se transforma en el **Calibration Dock** del blueprint P4 (`OffsetTrimPad`, toggles de polaridad, target mini-pad). *El dock deja de ser una columna fija: es este mismo satélite en modo calibración.*
- `Esc` o click en vacío → se desvanece. El canvas vuelve a respirar.

**◇ Status Ribbon** (inferior) — una línea de texto monoespaciado, sin caja: coordenadas del cursor en metros, conteo de patch, estado de snap, y mensajes efímeros ("MH-07 anclado a Truss-A · y=4.00m"). Es el susurro del sistema.

### 4.3 Menú radial contextual

Click derecho sobre cualquier entidad → **menú radial** de 6–8 acciones (iconos en anillo, etiqueta al hover): Duplicar / Elevar / Orientación / Calibrar / Zona / Eliminar. Ejecuta sin desplazar la vista ni abrir paneles. En 2D y 3D con idéntico diseño — memoria muscular única.

### 4.4 La transición 2D↔3D: el gesto firma

El toggle no es un swap de componentes con parpadeo. Es **la cámara contando la historia**:
- 3D→2D: la cámara orbital asciende y se endereza a cenital puro (600ms ease-in-out); simultáneamente los materiales se desaturan a línea técnica (crossfade de opacidad entre el render 3D y el SVG alineado por la misma proyección). El estudio "se convierte" en su plano.
- 2D→3D: inverso — el papel gana volumen y la cámara desciende a la vista de trabajo.
- Implementación: ambos lienzos comparten el mismo frame de coordenadas (metros); durante la transición se renderizan superpuestos con la cámara R3F interpolando a proyección ortográfica top-down. Coste: solo durante los 600ms.

---

## 5. Árbol de Componentes (React / R3F)

```
StageConstructorV3/
├── ConstructorShell.tsx                  # layout raíz, viewMode + toolMode (context)
│
├── hud/                                  # ── satélites DOM (fuera del canvas) ──
│   ├── CommandStrip.tsx                  # cápsula superior: vista, tools, snap, visibilidad
│   ├── DockRail.tsx                      # raíl librería 48px
│   │   ├── DockFlyout.tsx                # panel categoría (hover/pin)
│   │   └── FixtureCard.tsx               # card draggable (fixture | rig section)
│   ├── ContextInspector.tsx              # satélite derecho contextual
│   │   ├── FixtureInspector.tsx          # identidad + posición + orientación
│   │   ├── RigInspector.tsx              # truss/tótem + colgados
│   │   ├── MultiInspector.tsx            # align / distribute / elevate group
│   │   └── CalibrationPanel.tsx          # modo calibrate (P4): OffsetTrimPad,
│   │                                     #   AxisPolarityToggles, TargetMiniPad
│   ├── RadialMenu.tsx                    # menú radial contextual (portal, 2D y 3D)
│   ├── CommandPalette.tsx                # Ctrl+K: buscar/patchear/accionar
│   └── StatusRibbon.tsx                  # línea inferior de estado
│
├── studio3d/                             # ── STUDIO MODE (R3F) ──
│   ├── StudioCanvas.tsx                  # <Canvas> + fog + tone mapping + quality gate
│   ├── environment/
│   │   ├── StudioFloor.tsx               # MeshReflectorMaterial + grid shader
│   │   ├── StudioAtmosphere.tsx          # fog + dust Points (HQ only)
│   │   ├── CrystalEdges.tsx              # aristas de contención reactivas al drag
│   │   └── ServiceLighting.tsx           # work-light rig; dimmea en modo calibrate
│   ├── rigging/
│   │   ├── RigSystem.tsx                 # estado de rigs, snap-points, herencia rigId
│   │   ├── TrussSection.tsx              # InstancedMesh cordones+diagonales
│   │   ├── TotemTower.tsx
│   │   └── AnchorPoints.tsx              # discos magnéticos (visibles en drag)
│   ├── fixtures/
│   │   ├── FixtureBody3D.tsx             # cuerpo mate + lente standby + rim-light selección
│   │   ├── FixtureGhost3D.tsx            # holograma unplaced (vidrio)
│   │   └── SelectionFootprint.tsx        # peana proyectada al suelo
│   ├── calibration/
│   │   ├── CalibrationBeamGhost.tsx      # rayo ideal verde + diana decal en suelo
│   │   ├── ConvergencePulse.tsx          # feedback de alineación (<0.5°)
│   │   └── ServiceModeDirector.tsx       # orquesta dimming + atenuación de no-focos
│   └── interaction/
│       ├── DragDropController3D.tsx      # raycast drop + magnetismo a anchors
│       └── TransformGizmo.tsx            # TransformControls con estética obsidian
│
├── blueprint2d/                          # ── BLUEPRINT MODE (SVG en capas) ──
│   ├── BlueprintCanvas.tsx               # viewport SVG, zoom/pan, frame en metros
│   ├── layers/
│   │   ├── PaperLayer.tsx                # fondo + grano
│   │   ├── GridLayer.tsx                 # doble trama + cruces
│   │   ├── ArchitectureLayer.tsx         # borde escenario + hatching + proscenio
│   │   ├── ZoneLayer.tsx                 # contornos discontinuos + labels técnicos
│   │   ├── DimensionLayer.tsx            # cotas vivas (drag / tecla D)
│   │   ├── SymbolLayer.tsx               # simbología USITT + anillos de estado
│   │   └── RigPlanLayer.tsx              # trusses en planta con ticks de anclaje
│   ├── elevation/
│   │   ├── ElevationShadow.tsx           # halo difuso por altura (nivel 1)
│   │   ├── ElevationFlag.tsx             # cota hover ▲4.25m (nivel 2)
│   │   ├── ElevationScrubber.tsx         # scroll/Alt-drag → setFixtureElevation (nivel 3)
│   │   └── SectionProfileGhost.tsx       # corte lateral efímero durante edición
│   └── interaction/
│       ├── DragDropController2D.tsx      # drop + cotas vivas + imanes de alineación
│       └── CoverageRing.tsx              # proyección del haz a y=0 según tilt/altura
│
└── transition/
    ├── ViewTransitionDirector.tsx        # coreografía cámara 600ms 2D↔3D
    └── ProjectionLerp.ts                 # perspectiva → ortográfica cenital (puro)
```

### Notas de arquitectura

- **Estado:** todo sigue en `stageStore` / `ConstructorContext` — este árbol es piel, no cerebro. `RigSystem` añade una colección `rigs[]` al `stageStore` (id, tipo, transform, secciones) y los fixtures ganan `rigId?: string` (P2-compatible).
- **Presupuesto de rendimiento 3D:** reflector a 512px, trusses instanciados, dust solo HQ, calibración monta/desmonta con el tool mode. El quality gate existente (LQ/HQ) gobierna todo lo atmosférico.
- **El HUD es DOM, no R3F:** los satélites viven sobre el canvas con `pointer-events` quirúrgicos — el canvas nunca pierde el foco de interacción por culpa de un panel.
- **`CalibrationPanel` reutiliza los componentes del blueprint P4** (`OffsetTrimPad`, `AxisPolarityToggles`) — solo cambia su contenedor: de columna fija a satélite contextual.

---

## 6. Microinteracciones firma (el 1% que se siente premium)

| Momento | Detalle |
|---|---|
| Drop de fixture (3D) | El fixture cae los últimos 10cm con física suave y emite un **anillo de polvo** en el suelo (1 shockwave sutil, 300ms) |
| Snap a truss | *Clack* visual: el anchor point pulsa y el fixture asienta con overshoot de spring del 4% |
| Elevación 2D (scroll) | El halo de sombra crece en vivo con el scroll — la altura "se siente" antes de leer el número |
| Calibración convergida | Rayo ideal y cono real funden a blanco + pulso en diana + el chip del OffsetTrimPad sella los grados en `--obs-accent` |
| Hover en zona (2D) | El contorno discontinuo "camina" (dash-offset animado lentísimo) — el plano está vivo sin moverse |
| Selección múltiple | Lazo con relleno `--obs-ghost` y borde que se solidifica al cerrar |

---

## 7. Resumen de Alineación con el Blueprint Técnico

| Concepto V3 | Pilar del blueprint que lo habilita |
|---|---|
| Snap a truss hereda orientación/altura | P1 `MountTransform` SSOT + P2 `placementMode` |
| Elevación interactiva 2D (scroll + perfil fantasma) | P2 `setFixtureElevation()` + clamp Crystal Box |
| Anillo de cobertura del haz en 2D | Motor IK puro (proyección determinista, sin Three.js) |
| Beam Ghost + convergencia visual | P4 Calibration Dock + telemetría de reachability del Single-Solve (P3) |
| Fixtures ghost unplaced en 3D | P2 tri-estado — invitación a materializar |
| Inspector contextual en modo calibrate | P4 — el dock deja de ser columna y se vuelve satélite |
