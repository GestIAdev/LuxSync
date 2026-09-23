# 🜨 ASTERIA — CRUX RESOLUTION BLUEPRINT (WAVE 8188)

**Autor:** Chief Architect (Opus) · **Entrada:** `ASTERIA_ARCHITECTURAL_CRUX.md` (WAVE 8187),
`COHORT_FORENSIC_AUDIT.md` (WAVE 8185), `ASTERIA_PIXELMAP_BLUEPRINT.md` (origen).
**Baseline de código:** commit `a2ad8705` + doc `5a713ccf`.
**Naturaleza:** documento de diseño. Cero código modificado. Todas las rutas relativas a
`electron-app/src/components/views/HephaestusView/` salvo indicación.

---

## 0. Veredicto y dogmas

Las tres cruces no son tres bugs: son **un único error de modelado** visto desde tres ángulos.

> Asteria colapsa **tres dimensiones ortogonales** — *qué parámetro*, *qué valor/color* y *qué forma
> de onda* — en constantes globales de proyecto, y luego aplica **una sola decisión de routing**
> (cohorte aislada sí/no) a todas a la vez.

- Crux 1 = el routing no es por parámetro → producto cartesiano ciego.
- Crux 2 = el valor (color) no es por capa → el campo no tiene eje de color.
- Crux 3 = la forma no es por capa → un único trapezoide global.

La resolución introduce **una sola abstracción nueva que las tres comparten**: el **Plan de Emisión**
— `Σ (plano de parámetro × clase de valor) → Ruta`. Cada parámetro recibe su propio plano de campo,
su propia partición y su propia ruta. El multiplicador deja de ser ciego porque deja de ser global.

### Dogmas inviolables (heredados, verificados)

| Dogma | Cómo se respeta |
|---|---|
| **Runtime intocable** (`HephaestusRuntime.ts`, `TickEngine.ts`, `HephaestusAetherAdapter.ts`) | Todo lo que aquí se diseña emite **exclusivamente** campos que el runtime ya consume y que `serializeHephClip` ya whitelistea: `zones`, `cell`, `curve`, `phaseConfig`, `phaseOverrides`, `blendMode`, `colorOverride` (runtime:715–731, types:711). Cero líneas nuevas en el hot path. |
| **Zero-Alloc a 44 Hz** | Aplica al tick. El compilador es patch-time (curveRotate.ts:13–14 lo documenta). |
| **Zero-Alloc en el RAF del lienzo** | El `fieldEngine` evalúa en buffers preasignados; los planos nuevos se asignan **solo** cuando cambia el conjunto de parámetros activos (evento de edición), nunca por frame. |
| **256 KB por `.lfx`** | `report.bytes = JSON.stringify(tracks).length` (AsteriaCompiler.ts:515) sigue siendo la verdad. Se añaden gates de test con escenarios de referencia (§5). |
| **`ast_*` read-only** | Se **mantiene**. El bloqueo es correcto; lo que faltaba era un lugar donde editar la *fuente*. Ese lugar es el Inspector (§4). |

---

## 1. Hallazgos de soporte que habilitan el diseño

Verificados en código antes de diseñar — el diseño no depende de ninguna suposición.

| # | Hecho | Evidencia | Uso |
|---|---|---|---|
| H1 | Una curva de **1 keyframe** es constante válida (G5: `keyframes.length ≥ 1`) y `rotateCurveCyclic` la devuelve por referencia | `types.ts:323` invariante "Mínimo 1 keyframe (valor constante)"; `curveRotate.ts:59` | Pistas estáticas de ~250 B |
| H2 | `colorOverride` es consumido por runtime **y** preview | `HephaestusRuntime.ts:715–724`, `HephEvaluationKernel.ts:62` | Alternativa equivalente a H1 para color |
| H3 | El blend key es `fixtureId + ':' + paramId (+ '#' + cell)` | runtime:711 (Δ1) | Pistas de `color` e `intensity` **nunca** colisionan entre sí → el routing puede decidirse **por parámetro, independientemente** |
| H4 | `cell` = nodeId completo enruta color igual que intensidad | adapter `_nodeCellMatches` rama `d===0` (WAVE 8185) | Surgical por clase de color |
| H5 | El runtime multiplica `L` del color por la intensidad del clip, no por la pista de `intensity` de Asteria | runtime:732 | El pulso de luminancia puede vivir **solo** en `intensity` sin perder nada |
| H6 | El blueprint original ya prometía LUT "pulso, seno, diente de sierra" elegibles | `ASTERIA_PIXELMAP_BLUEPRINT.md` §3.3 (líneas 210–216) | Crux 3 no es feature nueva — es deuda de P4 |
| H7 | `interpolation: 'hold'` + `'bezier'` con handles existen en `HephKeyframe` | `types.ts:62, 268–302` | Flancos duros (square/laser/saw) y seno sin muestreo |

---

## 2. SOLUCIÓN CRUX 1 — Desacoplamiento de Parámetros (Plan de Emisión)

### 2.1 Diagnóstico en una línea

`emitCohortTracks` calcula **una** partición (cohortes de gain) y **un** flag `isolated` por
cohorte, y los aplica a **todos** los params (AsteriaCompiler.ts:750–756). El color hereda la
cardinalidad quirúrgica de la intensidad aunque su valor sea idéntico en los 150 nodos.

### 2.2 El nuevo contrato: `emitTargetParams` → `planEmission`

`emitTargetParams(project, warnings): HephParamId[]` (543) se **sustituye** por:

```ts
// asteria/compiler/emissionPlan.ts  (nuevo, puro, offline)

/** Firma espacio-temporal de UN plano de parámetro sobre sus nodos cubiertos. */
export type PlaneSignature =
  | 'uniform-static'    // mismo valor constante en todos los nodos      → 1 pista
  | 'palette-static'    // K valores constantes distintos, sin tiempo    → K clases
  | 'uniform-animated'  // misma forma+gain, solo varía el delay         → Vía Λ (1 pista + bus)
  | 'graded-animated'   // gain/forma varían por nodo                    → cohortes
  | 'cellular'          // distingue celdas del MISMO fixture            → MCC-Cell

export interface ValueClass {
  readonly key: string                 // hash determinista (valor cuantizado + synthKey)
  readonly nodeIdx: Uint32Array        // índices de atlas (orden canónico)
  readonly curve: HephCurve            // curva ya materializada (sin rotar)
  readonly delayMs?: number            // representativo (cohortes) — undefined en Λ/estático
}

export type Route =
  | { kind: 'zoned';    zones: readonly ZoneTarget[] }                 // cobertura limpia
  | { kind: 'lambda';   zones: readonly ZoneTarget[]; overrides: PhaseOverrideMap }
  | { kind: 'surgical'; cells: readonly string[] }                     // cell = nodeId

export interface ParamPlan {
  readonly param: HephParamId
  readonly signature: PlaneSignature
  readonly classes: readonly { cls: ValueClass; route: Route }[]
}

export function planEmission(
  planes: FieldPlanes,             // §3 — un plano por param activo
  atlas: NodeAtlas,
  project: AsteriaProject,
  D: number,
  warnings: string[],
): ParamPlan[]
```

El bucle de compilación deja de ser `for param → for cohort → for node` con un flag compartido y
pasa a ser un **intérprete de planes**:

```ts
// AsteriaCompiler.ts — sustituye las ramas cohort/mcc/mcc-device/λ (422–470)
const plans = planEmission(planes, atlas, project, D, warnings)
for (const plan of plans) {
  for (const { cls, route } of plan.classes) emitRoute(plan.param, cls, route, D, tracks)
}
```

`emitRoute` es la **única** función que empuja `HephTrack`s. Sus tres ramas reutilizan código ya
probado: `zoned` = pista de cohorte (780–788), `lambda` = pista Λ (455–464), `surgical` = pista
MCC-Device (765–772). Nada se inventa en la capa de emisión; lo nuevo es **quién decide**.

### 2.3 El clasificador de firma (por plano, independiente)

```
classify(plane p):
  N = nodos con mask_p = 1
  si la forma materializada de p es constante en t (1 kf, o synth 'hold', o regla §2.4):
      clases = groupBy(valorCuantizado_p)            // color: RGB8 · número: 1/255
      → |clases| = 1 ? 'uniform-static' : 'palette-static'
  si p distingue celdas del mismo deviceId:          // regla vigente del árbol §4.3
      → 'cellular'
  si gain_p y synthKey_p son uniformes en N:
      → 'uniform-animated'
  → 'graded-animated'   (cuantizador de cohortes SOBRE ESTE PLANO, no uno compartido)
```

Y el **resolvedor de ruta** — la pieza que mata el multiplicador ciego — se aplica a **cada clase
por separado**:

```
route(clase C del param p):
  devs   = deviceIds(C.nodeIdx)
  cover  = minimalZoneCover(devs)                    // ya existe (cohort zones)
  spill  = fixtures(cover) \ devs                    // mismo cálculo que COHORT_ZONE_SPILL
  spill = ∅            → 'zoned'  (o 'lambda' si la firma es uniform-animated)
  spill ≠ ∅ y p ∉ familia enrutable → 'zoned' + warning (hoy igual, paramNodeFamily=null)
  spill ≠ ∅            → 'surgical' (una pista por nodo de C con cell = nodeId)
```

La cardinalidad de salida pasa a ser:

```
tracks = Σ_p Σ_{C ∈ clases(p)} ( route(C) = surgical ? |C| : 1 )
```

en lugar de la actual `|params| × |nodos aislados|`. El coste quirúrgico solo se paga **en el
parámetro y la clase que lo necesitan**.

### 2.4 Regla de Propiedad de Luminancia (el caso DIM + CLR)

Hoy `synthesizeColorLut` pinta el pulso en `L` (lutSynth.ts:143–149) **y** `intensity` pinta el
mismo pulso: la envolvente está duplicada. Por H5 la luminancia final del color ya se multiplica por
el dimmer del fixture. Regla:

> **Si `intensity` pertenece a los params de la capa, esa capa emite su color con `L` constante
> (forma `hold`, 1 keyframe). La envolvente temporal pertenece a `intensity`. Si la capa no
> incluye `intensity`, el color conserva la envolvente (comportamiento actual).**

Consecuencia directa: en el escenario de la auditoría el plano `color` clasifica como
`uniform-static` → **1 pista**, mientras `intensity` sigue en `graded-animated` con sus N pistas
quirúrgicas si la partición derrama.

### 2.5 Política de inundación del color estático

Una pista estática `zoned` colorea también los fixtures de `spill` si se usa una cobertura que los
incluye. Eso **no** es inocuo: el clip reclama el color de esos fixtures mientras suena.
`project.colorFlood: 'contain' | 'allow'` (default `'contain'`):

- `'contain'`: si `spill ≠ ∅`, la clase va a `surgical` — pero **constantes** (H1: ~250–320 B por
  pista frente a ~600–760 B de una curva rotada).
- `'allow'`: se acepta la inundación y se emite warning `COLOR_FLOOD n fixture(s)`.

### 2.6 Palancas de higiene numérica (sin cambio semántico)

Parte del peso por pista es ruido de coma flotante (`0.6000000000000001`). En `emitRoute`:
`timeMs` entero (ya lo es en Λ, §8.1 del blueprint), valores numéricos a 4 decimales, HSL a 1
decimal. Aplicado **después** de `bakeGainIntoCurve`. Error ≤ 1/10 000 — por debajo de la
resolución DMX de 16 bits en la práctica.

### 2.7 Presupuesto — escenario de la auditoría (estimación; el gate de §5 fija la cifra real)

Modelo de coste por pista (JSON medido a mano sobre el formato emitido): cabecera ≈ 250 B,
keyframe numérico ≈ 50 B, keyframe HSL ≈ 70 B; una curva de 5 kf rotada llega a ≤ 7 kf.

| Escenario 150 fixtures, DIM+CLR, cohortes con spill | Pistas | Bytes aprox. | % 256 KB |
|---|---|---|---|
| **Hoy** (MCC-Device, multiplicador ciego) | 300 | 150×600 + 150×760 ≈ **204 KB** | **~80 % 🔴** (antes de metadata/Forge) |
| Plan: color `uniform-static` zoned + intensity surgical | 151 | 90 KB + 0,3 KB | **~35 % 🟡** |
| Plan: color `contain` surgical constante + intensity surgical | 300 | 90 KB + 150×300 ≈ 135 KB | ~53 % 🟡 |
| Plan: gain uniforme → intensity `uniform-animated` (Λ) + color estático | 2 | ≈ 11 KB | ~4 % 🟢 |

---

## 3. SOLUCIÓN CRUX 2 — Target por Capa (Paradigma Photoshop real)

### 3.1 Nuevo modelo de datos

La pintura de una capa se separa de su geometría. Mixin común a los 7 kinds:

```ts
// asteria/model/AsteriaProject.ts

/** Qué pinta una capa — ortogonal a CÓMO la capa reparte tiempo/gain en el espacio. */
export interface LayerPaint {
  /** Planos de salida que esta capa escribe. */
  readonly params: readonly HephParamId[]
  /** Color de la capa, '#rrggbb'. Solo relevante si params incluye 'color'. */
  readonly color?: string
  /** Opacidad de la capa en los planos de VALOR (color) — [0,1], default 1. */
  readonly opacity?: number
  /** Forma de onda local de la capa (Crux 3). undefined → project.defaultPaint.synth. */
  readonly synth?: SynthSpec
  /** Λ-Ride por capa (Crux 3). undefined → synth. */
  readonly lut?: LutSource
}

interface GestureCommon {
  /** undefined = HEREDA project.defaultPaint (compatibilidad total). */
  readonly paint?: Partial<LayerPaint>
}

export type Gesture =
  | (BaseGesture   & GestureCommon)
  | (WaveGesture   & GestureCommon)
  | …                                        // los 7 kinds

export interface AsteriaProject extends AsteriaProjectEnvelope {
  readonly version: 2
  readonly stack: readonly Gesture[]
  readonly strategy: CompileStrategy
  /** Sustituye a targetParams / targetColor / lutSource. */
  readonly defaultPaint: LayerPaint
  readonly colorFlood: 'contain' | 'allow'   // §2.5
  readonly colorBudget: number               // K máx. de clases de color (default 16)
  readonly cohortBudget: number
  readonly nodePositions?: …
}
```

**Resolución efectiva:** `effectivePaint(g) = { ...project.defaultPaint, ...g.paint }` — una
función pura, llamada una vez por gesto por `evaluate()` (sin alocar: el engine copia los campos a
un struct escalar reutilizado).

**Separación de conceptos que el modelo actual mezcla:**

| Campo | Pregunta que responde | Dominio |
|---|---|---|
| `gesture.channel` (`delay`/`gain`/`both`) | ¿Qué **eje del campo** escribe la geometría? | tiempo / amplitud |
| `paint.params` | ¿En qué **planos de salida** (parámetros DMX) aterriza? | intensity / color / pan… |
| `paint.color`, `paint.opacity` | ¿Qué **valor** deposita en los planos de valor? | HSL |
| `paint.synth` / `paint.lut` | ¿Con qué **forma** se reproduce en el tiempo? | envolvente |

### 3.2 Migración v1 → v2 (sin pérdidas, sin sorpresa)

```ts
function migrateV1toV2(p: AsteriaProjectV1): AsteriaProject {
  return {
    ...p, version: 2,
    defaultPaint: {
      params: p.targetParams,
      color: p.targetColor ?? ASTERIA_DEFAULT_TARGET_COLOR,
      lut: p.lutSource.kind === 'ride' ? p.lutSource : undefined,
      synth: { shape: 'pulse' },            // ≡ synthesizeLambdaPulse actual
    },
    colorFlood: 'allow',                    // v1 no contenía → preservar salida idéntica
    colorBudget: 16,
  }
}
```

Ningún gesto recibe `paint` → todos heredan → **la compilación de un proyecto migrado debe ser
byte a byte idéntica a la de v1** con `strategy` explícita (gate G-MIG en §5). La migración vive
donde ya vive la carga del proyecto (`clip.asteria` al hidratar el store) y es idempotente.

### 3.3 El `fieldEngine` multi-plano

`FieldSnapshot` (fieldEngine.ts:68–77) pasa de un campo escalar único a un **conjunto de planos**:

```ts
export interface ScalarPlane {           // intensity, pan, tilt, zoom…
  readonly delayMs: Float32Array         // N
  readonly gain: Float32Array            // N
  readonly mask: Uint8Array              // N
  readonly owner: Uint16Array            // N — índice de la capa dominante (Crux 3)
}
export interface ColorPlane extends ScalarPlane {
  readonly rgb: Float32Array             // 3N, RGB LINEAL (no sRGB) — mezcla física de luz
  readonly alpha: Float32Array           // N, cobertura acumulada
}
export interface FieldPlanes {
  readonly count: number
  readonly scalar: ReadonlyMap<HephParamId, ScalarPlane>
  readonly color: ColorPlane | null
}
```

**Asignación:** `engine.ensurePlanes(activeParams)` — `activeParams = ∪ effectivePaint(g).params`.
Solo reasigna si el conjunto cambió (acción de store: añadir/editar paint), nunca en `evaluate()`.
Memoria: 150 nodos × (4+4+1+2 B) ≈ 1,6 KB por plano escalar; color +16 B/nodo. Irrelevante.

**Arquitectura interna: kernel geométrico + compositor.** Hoy cada `applyX` escribe directo en los
buffers únicos. Se parte en dos etapas con un **scratch preasignado**:

```
para cada gesto g (orden de pila):
  1. KERNEL(g)  → scratch { claim: Uint8, d: Float32, g: Float32, cov: Float32 }   (geometría pura)
                  — los applyWave/applyGlyph/applySlice… actuales, sin tocar su matemática,
                    re-dirigidos al scratch en vez de al campo
  2. P = effectivePaint(g)
  3. para cada plano escalar p ∈ P.params:  blendInto(p, scratch, g.op, g.channel)   // (existente)
  4. si 'color' ∈ P.params:                 compositeColor(colorPlane, scratch, P, g.op)
  5. owner_p[i] = g.index donde claim[i] y cov[i] ≥ 0.5   (capa dominante por plano)
```

El kernel se ejecuta **una vez** por gesto aunque la capa escriba en 3 planos. Coste
`O(N·G·(1 + P_g))`, idéntico en órdenes al actual para `P_g = 1`.

### 3.4 Álgebra de composición de color

Espacio de trabajo: **RGB lineal** (la luz de los focos se suma físicamente en lineal, no en sRGB).
Conversión sRGB→lineal **una vez por gesto** (3 floats en un scratch `Float32Array(3·G)` que solo
crece si crece la pila). Sea `C_L` el color lineal de la capa, `a_i = cov_i · opacity` su alfa en el
nodo *i*, y `C_i` el color acumulado:

| `BlendOp` de la capa | Semántica Photoshop | Fórmula por canal |
|---|---|---|
| `replace` | Normal | `C_i ← C_i·(1−a_i) + C_L·a_i` |
| `add` | Linear Dodge (suma de luz) | `C_i ← min(1, C_i + C_L·a_i)` |
| `max` | Lighten | `C_i ← max(C_i, C_L·a_i)` |
| `min` | Darken | `C_i ← min(C_i, lerp(1, C_L, a_i))` |
| `mul` | Multiply | `C_i ← C_i · lerp(1, C_L, a_i)` |

`alpha_i ← a_i + alpha_i·(1−a_i)` (over estándar). Nodos con `alpha_i = 0` quedan **fuera del
plano de color** (`mask = 0`) — no emiten color y el fixture conserva el suyo: el "lienzo
transparente" para color, simétrico al "lienzo negro" de la capa BASE para intensidad (WAVE 8184).

**Prueba de que resuelve la singularidad.** Con dos capas L₁ (C₁ sobre A) y L₂ (C₂ sobre B, `replace`):
- `i ∈ A\B` → `C_i = C₁`; `i ∈ B\A` → `C_i = C₂`; `i ∈ A∩B` → `C_i = C₁(1−a₂) + C₂a₂`.

El codominio del campo pasa de `ℝ²×{0,1}` a `ℝ²×{0,1} × [0,1]³×[0,1]` — el eje de color que la
auditoría demostró inexistente ahora existe, y la información C₁/C₂ sobrevive a `evaluate()`.

### 3.5 Del plano de color al compilador

El compilador convierte `rgb` lineal → sRGB → HSL por nodo, y **cuantiza a clases**:

1. Dedupe exacto tras redondear a RGB8 (una pila con 3 colores planos da 3 clases, sin error).
2. Si `|clases| > colorBudget`: median-cut en **OKLab** (perceptualmente uniforme) hasta
   `colorBudget`; warning `COLOR_QUANTIZED k→K ΔE_max`.
3. Cada clase → `ValueClass` con curva `hold` de 1 kf (H1), o con envolvente si la capa dueña no
   incluye `intensity` (§2.4) — entonces el plano de color es `*-animated` y entra por cohortes/Λ
   exactamente como la intensidad.
4. `planEmission` enruta cada clase (§2.3). Un bloque de color que coincide con zonas → 1 pista.

### 3.6 UI — pintura por capa

- **Inspector → nueva sección `PAINT`** (encima de los controles por kind): chips de params
  (`DIM · CLR · PAN · TILT…`), swatch de color, slider `OPACITY`, y un toggle **`INHERIT`** que
  borra `g.paint` (vuelve a heredar). Escritura vía `updateGesture(id, { paint })` existente
  (coalescido, undoable).
- **Panel TARGET actual** → se renombra `DEFAULT PAINT` y edita `project.defaultPaint`
  (`setDefaultPaint`, sustituye `setTargetParams/Color/LutSource`, useAsteriaStore.ts:578–591).
- **GestureStackPanel**: cada fila muestra un punto de color y los chips de params efectivos;
  cursiva cuando heredan.
- **Lienzo**: el `NodeLayer` tiñe cada nodo con el sRGB del plano de color (1 lookup por nodo
  sobre una LUT de strings `rgba` cuantizada a 4096 colores precomputada una vez — mismo patrón
  zero-alloc que la heat LUT del FieldLayer, WAVE 8182).
- El slider `GAIN` del inspector deja de depender de "TARGET incluye DIM" global y pasa a depender
  de `effectivePaint(g).params`.

---

## 4. SOLUCIÓN CRUX 3 — Arsenal de Síntesis Local

### 4.1 Principio

> El bloqueo de `ast_*` es correcto y se queda. Lo que se añade es **un sintetizador en la fuente**:
> la forma de onda se convierte en un **parámetro de la capa**, editable en el Inspector,
> y la pista generada es su render determinista.

Forge deja de ser necesario para cambiar la forma; Λ-Ride sigue existiendo (ahora por capa vía
`paint.lut`) para quien quiera esculpir a mano.

### 4.2 Vocabulario: de 2 funciones fijas a una tabla de envolventes

`lutSynth.ts` se reestructura en tres capas:

```ts
// asteria/compiler/synth/SynthSpec.ts
export type SynthShape =
  | 'pulse'      // trapezoide actual (default — compat v1)
  | 'triangle'   // rampa simétrica
  | 'ramp-up'    // diente de sierra ascendente, caída dura
  | 'ramp-down'  // diente de sierra descendente, subida dura
  | 'square'     // on/off duro
  | 'sine'       // campana bezier
  | 'laser'      // pulso ultra-estrecho de flancos duros — la "línea de luz"
  | 'hold'       // constante (estático — alimenta 'uniform/palette-static')

export interface SynthSpec {
  readonly shape: SynthShape
  /** Fracción de D ocupada por la parte activa. Default por forma (tabla §4.3). */
  readonly duty?: number          // (0, 1]
  /** Dureza de flancos 0 = suave (linear/bezier), 1 = duro (hold). Default por forma. */
  readonly edge?: number          // [0, 1]
  /** Suelo y techo normalizados — la envolvente se remapea a [floor, ceil]. */
  readonly floor?: number         // default 0
  readonly ceil?: number          // default 1
}
```

```ts
// asteria/compiler/synth/envelopes.ts — PURO, sin HephParamId, sin D
export interface EnvPoint { t: number; v: number; interp: HephInterpolation; bz?: [number,number,number,number] }
/** Envolvente normalizada t∈[0,1], v∈[0,1]. Tabla estática, memoizada por specKey. */
export function envelope(spec: SynthSpec): readonly EnvPoint[]
export function specKey(spec: SynthSpec): string     // 'tri:0.4:0:0:1' — clave de partición
```

```ts
// asteria/compiler/synth/materialize.ts — el ÚNICO punto que conoce params y D
export function materialize(
  env: readonly EnvPoint[], param: HephParamId, D: number,
  color?: HSL,                    // valueType 'color' → v modula L (regla §2.4 decide si aplica)
): HephCurve
```

`synthesizeLambdaPulse(param, D)` ≡ `materialize(envelope({shape:'pulse'}), param, D)` y
`synthesizeColorLut(D, hex)` ≡ `materialize(envelope({shape:'pulse'}), 'color', D, hexToHsl(hex))`.
Se conservan como wrappers → los 247 tests existentes siguen verdes sin editar sus aserciones
(gate G-SYN-COMPAT).

### 4.3 Recetas de keyframes (mínimas, sin muestreo)

`w = duty`, tiempos en fracción de D (ε = 1 ms absoluto). Todas terminan en `t=1` con el valor de
`t=0` (cierre C⁰ del blueprint §3.3-6); `square` es la única cuya discontinuidad en el wrap es
**intencional** (su flanco de subida *es* el wrap), y el gate G-SYN-SHAPE la exime explícitamente.

| Forma | duty def. | Keyframes (t:v interp) | kf |
|---|---|---|---|
| pulse | 0.42 | `0:0 lin · 0.19w:1 lin · 0.67w:1 lin · w:0 lin · 1:0` (≡ 8/28/42 %) | 5 |
| triangle | 0.5 | `0:0 lin · w/2:1 lin · w:0 lin · 1:0` | 4 |
| ramp-up | 0.5 | `0:0 lin · w:1 hold · w+ε:0 lin · 1:0` (ε = 1 ms) | 4 |
| ramp-down | 0.5 | `0:0 lin · ε:1 lin · w:0 lin · 1:0` (subida dura de 1 ms, caída lineal) | 4 |
| square | 0.5 | `0:1 hold · w:0 hold · 1:0` | 3 |
| sine | 1.0 | `0:0 bz[.42,0,.58,1] · w/2:1 bz[.42,0,.58,1] · w:0 lin · 1:0` | 4 |
| laser | 0.04 | `0:0 hold · ε:1 hold · w:0 hold · 1:0` (edge=1) · con edge<1 los `hold` → `lin` | 4 |
| hold | — | `0:1` | 1 |

`edge` interpola la receta: los flancos marcados `hold` se sustituyen por `linear` con ancho
`(1−edge)·w·0.25`. Todas las recetas pasan por `rotateCurveCyclic` sin cambio: `hold`/`linear` son
exactas en sub-segmentos y `bezier` degrada solo en la costura (curveRotate.ts:31–33, D-2 ya
aceptada).

**El "láser espacial" sin Forge:** `WaveGesture` (`shape:'line'`, dirección) + `paint.synth =
{ shape: 'laser', duty: 0.03 }`. El campo de delays del wave convierte el pulso de 3 % de D en una
**línea de luz de ancho `0.03·D·speedMps` metros** barriendo el rig. Con `speed=10 m/s` y
`D=2000 ms` → línea de 0,6 m. Es la primera vez que la *forma espacial* y la *forma temporal* se
diseñan juntas en el mismo gesto.

### 4.4 Cómo reciben la forma COHORT y MCC

Hoy la forma entra por un único embudo global: `baseCurveFor(param)` (AsteriaCompiler.ts:401–414).
Se sustituye por:

```ts
const baseCurveFor = (param: HephParamId, owner: number): HephCurve
  // owner = índice de capa dominante del nodo en el plano `param` (plane.owner[i], §3.3)
  // P = effectivePaint(stack[owner])
  // P.lut ride válido → cloneCurve(ride)   (Λ-Ride por capa)
  // si no            → materialize(envelope(P.synth), param, D, colorDeLaClase)
  // memoizado por (param, specKey | rideId, colorKey) — 1 materialización por combinación, no por nodo
```

**La forma se convierte en clave de partición.** En `classify` (§2.3), las clases de un plano se
forman primero por `specKey(owner.synth)` y **después** por gain/delay:

```
graded-animated(p):  partición = groupBy(specKey) ∘ quantizeGainCohorts   (por grupo de forma)
uniform-animated(p): exige un único specKey en el plano; si hay varios →
                     un 'uniform-animated' POR grupo de forma, cada uno enrutado (§2.3)
```

Esto es necesario y no opcional: dos pistas Λ del mismo `param` con formas distintas y
`zones:['all']` colisionarían en el blend map (H3 → misma clave) — exactamente el spill de 8185.
El resolvedor de ruta lo evita por construcción: cada grupo de forma tiene su cobertura y, si
derrama, va quirúrgico. Se **reutiliza** el mecanismo MCC-Device de WAVE 8186 en lugar de
duplicarlo.

Consecuencia: `rotateCurveCyclic` + `bakeGainIntoCurve` siguen siendo las únicas transformaciones
por nodo/cohorte — pero ahora operan sobre una curva **elegida por la capa**, no sobre la constante
global.

### 4.5 UI — el sintetizador en el Inspector

Sección `SYNTH` dentro de `PAINT` (§3.6):

- `<select>` SHAPE (8 formas) + `DUTY` slider + `EDGE` slider (+ `FLOOR/CEIL` plegados).
- **Sparkline** de la envolvente (SVG de ≤ 12 puntos derivado de `envelope(spec)` memoizado) — el
  operador ve la forma sin abrir Forge.
- `SOURCE`: `SYNTH` | `RIDE → pista Forge` (mueve el selector LUT SRC de WAVE 8184 del panel
  STRATEGY al nivel de capa; en `DEFAULT PAINT` sigue existiendo como default de proyecto).
- El tooltip del 🔒 en `ParameterLane.tsx:263` gana la ruta de edición real:
  *"…Edita la forma en Asteria → capa ‹id› → SYNTH, o duplícala para una copia independiente."*
  (el compilador ya conoce el owner de cada pista: se añade `ast_<param>_<route>_<layerId>_<n>` al
  esquema de ids, `isAsteriaTrack` intacto porque solo mira el prefijo).

### 4.6 Validación del operador — la trampa desmontada

| Antes (8187) | Después |
|---|---|
| Pista generada ineditable **y** forma fija global | Pista generada ineditable, **forma editable en su capa** |
| Forma distinta → esculpir en Forge + ride global único | Forma distinta → `SHAPE` en el Inspector, por capa |
| Láser espacial imposible sin Forge | Wave + `laser` en un solo gesto |
| Detach = salir de Asteria | Detach sigue existiendo, ya no es la única salida |

---

## 5. Gates de verificación (obligatorios por wave)

| Gate | Contenido | Umbral |
|---|---|---|
| **G-MIG** | `compile(v1) ≡ compile(migrateV1toV2(v1))` para todos los fixtures de test existentes, estrategia explícita | deepEqual de `tracks` |
| **G-BUDGET-150** | Atlas sintético 150 fixtures × {IMPACT, COLOR}, DIM+CLR, gain variable con spill forzado | `report.bytes` ≤ 40 % de 256 KB con `colorFlood:'allow'`; ≤ 60 % con `'contain'`; hoy (baseline) se registra para comparación |
| **G-PLAN-DECOUPLE** | Mismo escenario: nº pistas `color` = 1 (allow) mientras nº pistas `intensity` = nodos aislados | exacto |
| **G-COLOR-RT** | Dos capas C₁/C₂ solapadas: compilar → evaluar cada nodo con `CurveEvaluator` de producción en t=0 → comparar con §3.4 | ΔE_OKLab ≤ 1 con dedupe exacto |
| **G-COLOR-TRANSPARENT** | Nodo sin capa de color → ninguna pista `color` lo alcanza (ni zoned con spill en `contain`) | exacto |
| **G-SYN-SHAPE** | Para cada forma × duty ∈ {0.03, 0.5, 1}: kf ASC, dentro de `range`, cierre C⁰, nº kf según tabla §4.3 | exacto |
| **G-SYN-ROT** | Property test de rotación (blueprint §8.5-1) extendido a las 8 formas | `< 1e-6` salvo costuras bezier (D-2) |
| **G-SYN-COMPAT** | `synthesizeLambdaPulse`/`synthesizeColorLut` wrappers → mismas curvas byte a byte | deepEqual |
| **G-SHAPE-ISOLATION** | Dos capas mismo param, formas distintas, masks que cruzan zonas → cero pares (fixture, param) alcanzados por dos pistas sin `cell` | exacto |
| **G-ZERO-ALLOC-RAF** | `evaluate()` ×1000 sin cambio de paint: cero cambios de identidad de buffers de planos | identidad referencial |
| **G-RUNTIME-VETO** | `git diff --stat` de la wave no contiene `core/hephaestus/runtime/`, `core/orchestrator/tick/`, ni el adapter | vacío |

---

## 6. Roadmap de ejecución

Orden elegido por **riesgo creciente y valor inmediato**: el presupuesto es la emergencia, el
sintetizador es puro y aislado, el modelo multi-plano es el cambio profundo.

| Wave | Nombre | Alcance | Gates |
|---|---|---|---|
| **8190** | *The Emission Planner* | `emissionPlan.ts` (classify + route + emitRoute) operando sobre el campo **único actual** tratado como "un plano por param" (todos comparten delay/gain, pero cada uno clasifica y enruta por separado). Regla de luminancia §2.4, `colorFlood`, higiene numérica. **Resuelve Crux 1 sin tocar el modelo.** | G-BUDGET-150, G-PLAN-DECOUPLE, suite actual verde |
| **8191** | *The Synth Arsenal* | `synth/` (SynthSpec, envelopes, materialize), wrappers de compat, `project.defaultSynth` provisional + selector SHAPE global en STRATEGY. **Resuelve Crux 3 a nivel de proyecto.** | G-SYN-SHAPE, G-SYN-ROT, G-SYN-COMPAT |
| **8192** | *Paint Migration* | Modelo v2 (`LayerPaint`, `defaultPaint`, migrador), store (`setDefaultPaint`, paint vía `updateGesture`), sin cambio de engine todavía (paint heredado por todos). | G-MIG |
| **8193** | *The Multi-Plane Field* | `fieldEngine` kernel+compositor, planos escalares, `owner`, `ensurePlanes`; `planEmission` consume planos reales; params por capa operativos. | G-ZERO-ALLOC-RAF, G-SHAPE-ISOLATION |
| **8194** | *The Color Compositor* | Plano de color lineal, álgebra §3.4, cuantización OKLab, tinte en NodeLayer, UI `PAINT` completa. **Resuelve Crux 2.** | G-COLOR-RT, G-COLOR-TRANSPARENT |
| **8195** | *Local Synth per Layer* | `paint.synth`/`paint.lut` por capa, partición por `specKey`, sección SYNTH en el Inspector con sparkline, ids con `layerId`, tooltip del 🔒. **Cierra Crux 3.** | G-SHAPE-ISOLATION, G-BUDGET-150 repetido |

Cada wave cierra con: suite Asteria completa + `typecheck` app+node + **G-RUNTIME-VETO**.

---

## 7. Riesgos y decisiones abiertas

| Riesgo / decisión | Posición del Arquitecto |
|---|---|
| **R1** — Los fixtures de `spill` con `colorFlood:'allow'` pierden su color de Selene mientras suena el clip | Default `'contain'` en proyectos nuevos; `'allow'` solo en migrados (preserva salida v1). Warning con conteo siempre. |
| **R2** — Mezcla lineal vs expectativa sRGB del operador (un 50 % rojo+azul lineal se ve más brillante que en Photoshop sRGB) | Lineal es la física de la luz real; el swatch del Inspector muestra el resultado ya convertido. **Decisión abierta D-C1:** exponer toggle `sRGB blend` si el operador lo reclama. |
| **R3** — Muchas formas × muchas clases de color × spill → vuelve la explosión | El HUD BUDGET sigue siendo la verdad; `planEmission` reporta el desglose `param × clase × ruta` en los warnings para que el operador vea **qué capa** cuesta. **D-C2:** gate duro `BUDGET_EXCEEDED` que bloquee compilación > 100 % (blueprint §10 ya lo preveía). |
| **R4** — `owner` por umbral de cobertura 0.5 en bordes antialias de glifo | Aceptable: la forma es discreta por naturaleza; el gain sigue siendo continuo. |
| **R5** — `ramp-up/laser` con ε = 1 ms en clips muy largos | ε se expresa en ms absolutos, no en fracción de D — el flanco es siempre de 1 ms. |
| **D-C3** — ¿`pan/tilt` necesitan síntesis propia (seno para figuras de movimiento)? | Fuera de alcance: el vocabulario ya lo cubre (`sine` con `floor/ceil`), pero la semántica cinemática (figuras en 8, círculos con fase pan↔tilt de 90°) merece su propio blueprint. |
| **D-C4** — ¿Mover `strategy` también a nivel de capa? | **No.** La estrategia es una decisión de *emisión*, no de *pintura*; el Plan de Emisión ya decide por (param × clase). `strategy` queda como sesgo global (forzar Λ/cohort/mcc) para el planificador. |

---

## 8. Resumen para ejecución

1. **Crux 1:** `emitTargetParams` muere; nace `planEmission`. Cada parámetro se **clasifica** y cada
   clase se **enruta** por separado. El color estático es 1 pista; la intensidad paga lo suyo.
2. **Crux 2:** `targetParams/targetColor` migran a `LayerPaint` por gesto (con herencia de
   `defaultPaint`). El `fieldEngine` pasa a multi-plano con un plano de color en RGB lineal y un
   álgebra de mezcla por `BlendOp`. El campo gana el eje de color que no tenía.
3. **Crux 3:** `lutSynth` se convierte en una tabla de 8 envolventes + un materializador. La forma
   es parámetro de capa, clave de partición del compilador, y se edita en el Inspector. `ast_*`
   sigue bloqueada — ahora con una fuente editable detrás.

Todo ello **sin una sola línea en el runtime**, sin alocación en el tick ni en el RAF, y con
gates de test que fijan el presupuesto de 256 KB como cifra medida, no estimada.
