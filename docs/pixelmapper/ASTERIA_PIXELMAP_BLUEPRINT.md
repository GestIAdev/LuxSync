# 🜨 ASTERIA — BLUEPRINT DEL PIXEL MAPPER INVERSO

**Ticket:** Diseño arquitectónico de la 4ª pestaña de Hephaestus — *Lienzo Táctico* + compilador `.lfx`
**Estado:** PROPUESTA DE DISEÑO. Cero código de producción modificado.
**Base verificada:** `electron-app/src` — branch `v4`
**Auditorías de entrada:** `LFX_GENERATION_AUDIT.md` · `SPATIAL_AWARENESS_AUDIT.md` · `AETHER_MATRIX_AUDIT_PT1_REVISED.md` · `AETHER_MATRIX_AUDIT_PT2.md` · `HEPHAESTUS-ENGINE-AUDIT-V1.md` · `V3_TYPE_SYSTEM_DUE_DILIGENCE.md`

> **Doctrina de este documento.** Cada afirmación sobre el comportamiento actual del sistema va con
> `archivo:línea`. Donde he encontrado que una auditoría previa describe algo que el código **no**
> hace, lo digo con la misma claridad que si fuera un hallazgo propio: §1 abre con esas correcciones,
> porque el diseño entero depende de ellas. Donde no he podido verificar, escribo **[A VERIFICAR]**.
> No hay una sola línea de este blueprint que dependa de una capacidad que no haya leído en el código.

---

## ÍNDICE

0. [TL;DR — la idea en 12 líneas](#0-tldr--la-idea-en-12-líneas)
1. [Corrección de las auditorías previas — 5 hallazgos que redefinen el problema](#1-corrección-de-las-auditorías-previas--5-hallazgos-que-redefinen-el-problema)
2. [El problema real: el `.lfx` tiene UN solo handle per-fixture](#2-el-problema-real-el-lfx-tiene-un-solo-handle-per-fixture)
3. [La invención: Vía Λ — la Curva-LUT y el Bus de Direcciones de Fase](#3-la-invención-vía-λ--la-curva-lut-y-el-bus-de-direcciones-de-fase)
4. [El problema multicelular: paradigma MCC (Máscaras de Curva Celular)](#4-el-problema-multicelular-paradigma-mcc-máscaras-de-curva-celular)
5. [Arquitectura de datos: el Gesture Stack (Photoshop para el rig)](#5-arquitectura-de-datos-el-gesture-stack-photoshop-para-el-rig)
6. [El Lienzo Táctico — `AsteriaView.tsx` y su árbol de componentes](#6-el-lienzo-táctico--asteriaviewtsx-y-su-árbol-de-componentes)
7. [Las 8 herramientas](#7-las-8-herramientas)
8. [El compilador `AsteriaCompiler`](#8-el-compilador-asteriacompiler)
9. [Feedback físico: el Protocolo Poke (tocar la UI y que el foco responda)](#9-feedback-físico-el-protocolo-poke)
10. [Presupuestos, límites y modos de fallo](#10-presupuestos-límites-y-modos-de-fallo)
11. [Δ RUNTIME — los 4 parches quirúrgicos (y por qué no violan el dogma)](#11-δ-runtime--los-4-parches-quirúrgicos)
12. [Roadmap WAVE 8000–8060 con gates de aceptación](#12-roadmap-wave-80008060)
13. [Riesgos, alternativas descartadas y decisiones abiertas](#13-riesgos-alternativas-descartadas-y-decisiones-abiertas)
14. [Apéndice: tabla de referencias verificadas](#14-apéndice-tabla-de-referencias-verificadas)

---

## 0. TL;DR — la idea en 12 líneas

1. Asteria **no es un exportador**. Es un **generador de tracks** que vive dentro del clip V3 activo.
2. El operador pinta sobre un plano XZ top-down. El resultado de pintar no son curvas: es un **campo
   escalar por nodo** — `delayMs[i]` y `gain[i]` — indexado por el **Node Atlas** (nodos, no fixtures).
3. Ese campo se compila a `HephTrack[]` con id prefijado `ast_`. Cada recompilación reemplaza solo
   los `ast_*` y deja intactas las pistas hechas a mano en Forge.
4. Como el clip resultante es un V3 normal, **el preview, el Phase Canvas, la Live Calibration y el
   guardado ya existentes funcionan gratis**. WYSIWYG por construcción, no por promesa (`HephEvaluationKernel`).
5. El descubrimiento central: el `.lfx` **solo tiene un handle per-fixture** — `phaseOverrides` — y su
   único payload es `offsetMs`. Así que el diseño **convierte la curva en una LUT y el offset en su
   dirección de lectura**. Una sola pista pinta una imagen espacial entera. Eso es la **Vía Λ**.
6. Para independencia celular real (Tungsten: pétalos, wash, golden-master) el formato ya reserva
   `HephTrack.cell` (`types.ts:459`) y el serializador ya lo preserva (`types.ts:663`). Falta que el
   runtime lo lea: **3 ediciones, ~15 líneas, cero allocaciones nuevas**.
7. La geometría celular real (pétalos radiales de 0.15 m) **solo existe en el NodeGraph del main**.
   Asteria necesita un endpoint de lectura one-shot: `lux:aether:getNodeAtlas`. Patch-time, no 44 Hz.
8. El feedback físico al tocar la UI se apoya en la carretera L3++ que ya existe
   (`TickEngine.writeCalibration`, `TickEngine.ts:251`), pero con un **Protocolo Poke** event-driven
   en lugar de un stream a 44 Hz: la implementación actual asigna memoria por frame en el main.
9. Todo el trabajo espacial ocurre en **pointer-up y en cambio de parámetro**. Nada, absolutamente
   nada, se añade al `TickEngine` ni al `NodeArbiter`. El coste en runtime de un `.lfx` de Asteria es
   idéntico al de un `.lfx` hecho a mano: la única diferencia es que tiene más keyframes.
10. El techo duro no es la CPU: es **`MAX_FILE_SIZE_BYTES = 256 KB`** (`LfxFileLoader.ts:66`). El
    compilador lleva un HUD de presupuesto y un cuantizador de cohortes para no rebasarlo.
11. El *Gesture Stack* (la pila de gestos paramétrica, no destructiva) es la fuente de verdad
    re-editable. Se persiste en `clip.asteria` — lo que exige **una línea** en `serializeHephClip`,
    que hoy es un whitelist y descartaría el campo en silencio (`types.ts:630-667`).
12. Coste total de intervención en el núcleo: **1 endpoint IPC nuevo, 4 parches de ≤6 líneas, 1 línea
    en el serializador**. Todo lo demás es UI y matemática offline.

---

## 1. Corrección de las auditorías previas — 5 hallazgos que redefinen el problema

El `LFX_GENERATION_AUDIT` es excelente en tipos y gates, pero describe la *intención* del contrato
V3 en tres puntos donde el runtime hace otra cosa. Diseñar sobre esos tres puntos produciría un
compilador que genera archivos válidos que **no hacen nada**. Los cinco hallazgos:

| # | Hallazgo | Evidencia | Impacto en Asteria |
|---|---|---|---|
| **A1** | **`phaseOverrides` está MUERTO si `spreadDeg <= 0`.** El audit (§1.2 nota 4) afirma que los overrides activan el mapa aunque `spreadDeg:0`. Falso: `_extractPhaseConfig` devuelve `null` cuando `spreadDeg <= 0` (`HephaestusRuntime.ts:1049-1051`), y el gate de `_buildResolvedTrack` es `if (phaseConfig && (...))` (`:1022`). Con `phaseConfig` nulo, `fixturePhases` queda `null` y los overrides **se descartan en silencio**. | `HephaestusRuntime.ts:1022`, `:1049-1051` | El compilador **debe** emitir `spreadDeg: 1` (no 0). Con overrides `absolute` el algoritmo es irrelevante, y 1° sobre 4000 ms = 11 ms de ruido que los `absolute` pisan de todos modos. |
| **A2** | **`selector` NO filtra targeting en la ruta V3.** El audit lo documenta como "AND-intersección fina sobre zones". El runtime V3 solo usa `t.zones` para resolver fixtures (`HephaestusRuntime.ts:969`); de `t.selector` únicamente lee `.phase` y `.phaseSpread` (`:974-977`). `parity`, `indexRange`, `stereoSide` son **código vivo en `ShowFileV2.resolveFixtureSelector` sin ningún caller en la ruta de ejecución V3**. | `HephaestusRuntime.ts:967-982` | Prohibido usar `selector` como eje de targeting en el compilador. El targeting real es: `zones` (coarse) + `phaseOverrides` (per-fixture). Nada más. |
| **A3** | **El blend map colapsa a granularidad de fixture.** `blendKey = fixtureId + ':' + paramName` (`HephaestusRuntime.ts:685`). Dos pistas con el mismo `paramId` sobre el mismo fixture se fusionan en **una sola salida**, y la segunda pista **no** propaga su `trackZones` (el camino de blend retorna antes, `:716`/`:730`). | `HephaestusRuntime.ts:685-735` | Mata de raíz la estrategia ingenua "una pista por celda". La independencia celular **exige** el Δ1 de §11. Es el hallazgo más importante de todo el documento. |
| **A4** | **El routing celular YA EXISTE, pero por zona, no por celda.** `HephaestusAetherAdapter` hace *compound fixture routing*: si un fixture tiene N nodos de la misma familia, compara `node.zoneId` contra `output.trackZones` (`:145-165`, helper en `:530-536`). Los nodos de celda reciben su `zoneId` de `cfg.aetherZone` y su sufijo de `cfg.aetherNodeId`, ambos declarados en la Forja (`NodeExtractionPipeline.ts:660-684`). | `HephaestusAetherAdapter.ts:125-188` | Hay un carril de celda ya construido y a coste cero. Pero su llave es el **vocabulario de zonas canónicas** (9 zonas, compartidas por todo el rig): sirve para "los pétalos frente al wash", no para "el pétalo izquierdo de *este* fixture". |
| **A5** | **`CalibrationSAB.ts` es infraestructura muerta — y contiene un bug de colisión total.** El camino vivo es IPC → `TickEngine.writeCalibration` (`TickEngine.ts:251`, y el comentario explícito "*L3++ Calibration — inject entries directly (no SAB)*" en `:1611`). En el SAB abandonado, el `nodeId` se empaqueta a **8 chars UTF-16 máximo** (`CalibrationSAB.ts:20`, `:61-62`, writer `:157-172`, reader `:274-281`): con ids reales como `fixture-1778098900942:impact` (`shows/6testNUEVO.v2.luxshow:138`) **todas las entradas colapsarían al literal `"fixture-"`**. Además su `publish()` se declara zero-alloc pero crea un `new Float32Array` por canal y por entrada (`:187`). | `CalibrationSAB.ts:157-190`, `TickEngine.ts:1611` | Asteria **no debe** resucitar ese SAB. Se apoya en la ruta IPC viva, con el Protocolo Poke de §9 para no heredar su coste. Recomendación separada: borrar `CalibrationSAB.ts` (F3/F4 de PT2 hicieron exactamente esto con el fixture SAB) o arreglarlo con hash FNV-1a del nodeId, simétrico a `CHANNEL_HASH_MAP`. |

**Corolario inmediato:** el "problema multicelular" que plantea el ticket es **dos problemas
distintos** que las auditorías mezclan:

```
   (a) TARGETING celular   → ¿cómo nombra un .lfx "el pétalo izquierdo"?
                             Handle disponible hoy: zoneId de celda (coarse, compartido).
                             Handle reservado y sin consumidor: HephTrack.cell.

   (b) INDEPENDENCIA de valor/fase por celda → ¿pueden dos celdas del MISMO fixture
                             leer la MISMA curva en tiempos distintos?
                             Hoy: NO. Lo impide el blendKey (A3), aguas arriba del adapter.
```

Resolver (a) sin (b) da colores por celda pero no coreografía por celda. Asteria necesita ambos.

---

## 2. El problema real: el `.lfx` tiene UN solo handle per-fixture

Inventario exhaustivo de lo que un archivo `.lfx` puede decir sobre un fixture concreto, verificado
contra `serializeHephClip` (`types.ts:630-667`, que es un **whitelist**: lo que no está ahí no
sobrevive al guardado) y contra el runtime:

| Eje | Handle | Granularidad real | ¿Vivo? |
|---|---|---|---|
| Targeting | `track.zones` | Zona (9 canónicas + `all`/`all-pars`/`all-movers`) | ✅ `HephaestusRuntime.ts:969` |
| Targeting fino | `track.selector` | — | ❌ **A2** — no filtra |
| Targeting celular | `track.cell` | Celda | ⚠️ reservado, sin consumidor (`types.ts:459`) |
| Tiempo per-fixture | `track.phaseOverrides[fixtureId].offsetMs` | **Fixture** | ✅ `PhaseOverride.ts:83-96` |
| Valor per-fixture | — | — | ❌ **no existe** |
| Escala per-track | `track.dimmerScale`, `track.colorOverride` | Track entero | ✅ |

La conclusión es incómoda y es el eje de todo el diseño:

> **El único grado de libertad per-fixture de todo el formato `.lfx` es un número: `offsetMs`.**
> Un pixel mapper necesita asignar a cada píxel un *valor*. El formato solo le deja asignar un *tiempo*.

Hay dos salidas. La convencional: multiplicar pistas (una por cohorte de valor) y pagarlo en bytes y
en zonas. La otra es invertir el problema.

---

## 3. La invención: Vía Λ — la Curva-LUT y el Bus de Direcciones de Fase

### 3.1 El truco

El runtime evalúa, para cada fixture, `valor = C((t + offsetᵢ) mod D)` (wrap continuo,
`HephaestusRuntime.ts:626`). La lectura canónica es "todos los fixtures recorren la misma curva,
desfasados". **Léelo al revés:**

> Si `t` está congelado, `offsetᵢ` **es la dirección de memoria** con la que el fixture *i* lee la
> curva. La curva deja de ser una envolvente temporal y se convierte en una **Look-Up Table**
> indexada por espacio. `C` es la paleta; `offsetᵢ` es el píxel.

```
   CURVA-LUT C(τ)                              RIG (campo de direcciones)
   1 ┤      ╭──╮      ╭──╮                     offset(P1)=0      → C(0)   = 0.0
     │     ╱    ╲    ╱    ╲                    offset(P2)=500    → C(500) = 1.0
     │    ╱      ╲  ╱      ╲                   offset(P3)=1000   → C(1000)= 0.0
   0 ┼───╯        ╲╱        ╲───►  τ           offset(P4)=1500   → C(1500)= 1.0
     0     1000    2000    3000  4000
                                                 ⇒ patrón alternado ESTÁTICO, 1 SOLA PISTA
   Al avanzar t, TODO el patrón se desplaza por el rig: la animación es gratis.
```

Una sola pista, una sola curva, `N` entradas de `phaseOverrides`: **cualquier campo escalar espacial
animado**. Barridos, ondas, vórtices, gradientes, damero, ruido — todos son el mismo objeto:
`(LUT, campo de direcciones)`.

### 3.2 Lo que Λ sí puede y lo que no

| Efecto | ¿Λ? | Por qué |
|---|---|---|
| Barrido lineal / diagonal / radial | ✅ | LUT = pulso; direcciones = distancia proyectada |
| Onda sinusoidal, doble onda, Huygens multi-emisor | ✅ | LUT = seno; direcciones = distancia al emisor más cercano |
| Chase cuantizado (N rebanadas) | ✅ | direcciones cuantizadas a K buckets |
| Ondas en color (LUT HSL) | ✅ | `valueType:'color'`, keyframes HSL, camino corto de hue ya resuelto en `CurveEvaluator` |
| Texto/glifo **en movimiento** (scroll) | ✅ | LUT = perfil del glifo por columnas |
| Texto/glifo **estático y quieto** | ⚠️ | Con `t` avanzando, el patrón se desplaza. Ver **Λ-Frozen** abajo |
| Gain per-fixture independiente del tiempo | ❌ | Requiere cohortes (Vía B, §8.3) |
| Independencia por celda | ❌ | `phaseOverrides` es fixture-granular. Requiere MCC (§4) |

**Λ-Frozen (para imágenes quietas).** En modo one-shot el runtime clampa:
`fixtureTime = min(base + offset, D)` (`HephaestusRuntime.ts:628`). Si `D` es muy grande respecto a
la vida real del disparo (p. ej. `D = 120 000 ms` para un clip que vive 4 s) y la LUT es una escalera
de mesetas, cada fixture se queda en su meseta y la imagen deriva de forma imperceptible
(4 s / 120 s = 3,3 % del recorrido). Es un truco de escalado de duración, y lo digo como lo que es:
**un truco**, no una primitiva. Condiciones para usarlo sin hacer daño:

- `loop = false` en el disparo.
- Clip **sin** `cognitiveDNA` (Selene no debe seleccionar un clip cuya duración declarada miente
  sobre su intención; ver `DynamicEffectRegistry.registerEffectV3` → sin DNA es invisible para Selene,
  documentado en `V3_TYPE_SYSTEM_DUE_DILIGENCE §1.1`).
- Aviso explícito en el HUD de Asteria: *"Λ-Frozen: imagen estática por escalado de duración —
  drift 3,3 %/disparo"*.

Para imágenes quietas que además deban vivir en el pool de Selene, el compilador usa **Vía B**
(cohortes), que no tiene ese asterisco.

### 3.3 Síntesis de la LUT

```ts
// asteria/compiler/lutSynth.ts  (offline, puro, testeable)

/**
 * Sintetiza la Curva-LUT y el bus de direcciones a partir de un campo de valores.
 *
 * ENTRADA  value[i] ∈ [0,1]  — lo que el operador pintó para el nodo i
 * SALIDA   curve (K keyframes) + offsetMs[i]
 *
 * ALGORITMO (cuantización por percentiles, no uniforme):
 *   1. Histograma de value[] en `resolution` bins (default 64).
 *   2. Bins no vacíos → niveles L₀..L_{K-1}. K ≤ 64 mantiene la curva < 5 KB.
 *   3. τ_k = k · (D / K)                         ← dirección canónica del nivel k
 *   4. keyframes = [{ timeMs: τ_k, value: L_k, interpolation: shape }]
 *        shape='hold'   → mesetas duras (damero, texto, chase)
 *        shape='linear' → rampas suaves (gradientes, ondas)
 *   5. offsetMs[i] = τ_{bin(value[i])}
 *   6. Se añade un keyframe de cierre en τ = D con value = L₀ para que el wrap sea C⁰
 *      (sin salto en la costura del bucle). Sin esto, un chase muestra un "tirón" por ciclo.
 */
export function synthesizeLambda(
  value: Float32Array, count: number, durationMs: number,
  opts: { resolution?: number; shape?: 'hold' | 'linear'; closeLoop?: boolean },
): { keyframes: HephKeyframe[]; offsetMs: Float32Array }
```

Y para el modo **animado** (el habitual), el operador no pinta un valor sino un **retardo**, y la LUT
es una forma de onda que él elige (pulso, seno, diente de sierra, o *la propia curva que ya dibujó en
Forge* — ver §8.2, "Λ-Ride"):

```
offsetMs[i] = delayMs[i]          // lo que el gesto calculó, en ms, clampado a [0, D]
curve       = forma de onda       // 3-12 keyframes, el "grano" del efecto
```

**Λ-Ride es la joya de ergonomía:** si el operador ya esculpió una curva de `intensity` en la pestaña
Forge, Asteria puede reutilizarla **tal cual** como LUT y limitarse a inyectar el campo de retardos.
El resultado: *"mi curva, pero recorriendo el escenario como una ola"*. Cero curvas nuevas, cero
sorpresas, y el Phase Canvas existente sigue siendo la vista de verdad.

### 3.4 Coste y compatibilidad de Λ

| Métrica | Valor |
|---|---|
| Pistas generadas | **1** por parámetro animado |
| Bytes | `~70 · N_fixtures` (overrides) + `~55 · K` (keyframes). 100 fixtures, K=32 → **≈ 8,5 KB** |
| Coste runtime añadido | **0**. `resolveWithOverrides` ya corre en `_buildResolvedTrack` (patch-time del disparo), O(N log N) por activación (`PhaseOverride.ts:98`) |
| Gates del loader | `zones` no vacío ✅ · `keyframes` no vacío ✅ · `vibeCompat` no vacío ✅ · sin `strobe` ⇒ G6 trivial ✅ |
| Linter `GatekeeperLinter` | Cero reglas sobre `phaseOverrides` o tamaño de curvas — pasa limpio |

---

## 4. El problema multicelular: paradigma MCC (Máscaras de Curva Celular)

### 4.1 Diagnóstico

El Tungsten se compila en la Forja a nodos disjuntos: `kinetic`, `golden-master`, `petal-l/c/r`,
`wash`, `wash-color`, `beam-color` (doctrina explícita en `NodeExtractionPipeline.ts:585-623`; el
sufijo sale de `cfg.aetherNodeId`, la zona de `cfg.aetherZone`, `:660-684`). El adapter sabe rutar a
esos nodos por zona (**A4**). Pero:

1. `phaseOverrides` está indexado por `fixtureId` → **un solo tiempo para todo el aparato**.
2. Dos pistas del mismo `paramId` sobre el mismo fixture se colapsan en el blend map → **imposible
   dar dos tiempos distintos a dos celdas** (**A3**).
3. El namespace de zonas es global: usar `zoneId` para nombrar celdas hace que "pétalo-L" signifique
   lo mismo en los 6 Tungsten del rig. Sirve para simetría, no para individualidad.

### 4.2 El paradigma: la fase vive en la geometría de la curva, no en el mapa de fases

**MCC — Máscaras de Curva Celular.** Si no puedo dar a la celda un *offset*, le doy una *curva ya
desfasada*. El desfase se hornea como **rotación cíclica de keyframes**:

```
            C(τ)                                  rot(C, d)(τ) = C((τ − d) mod D)
   1 ┤   ╭─────╮                          1 ┤              ╭─────╮
     │  ╱       ╲                           │             ╱       ╲
   0 ┼─╯         ╲────►                   0 ┼────────────╯         ╲───►
     0   1000   2000   4000                 0   1000   2000   3000   4000
        pista "petal-c"                          pista "petal-l" (d = 1000 ms → llega tarde)
```

> 🜨 WAVE 8197 — *Time Arrow Reversal*: `d` es un **retardo real** (lag). La celda
> evalúa el instante `τ−d` de la fuente — el pulso le llega `d` ms tarde. En el bus
> `phaseOverrides` (offset = avance en el runtime) el delay se emite invertido:
> `offsetMs = (D − (delay mod D)) mod D`.

Cada celda recibe **su propia pista**, con **su propia curva rotada**, apuntada con
`track.cell = '<aetherNodeId>'`. La fase per-celda se convierte en un problema de *authoring
offline* — exactamente donde el dogma zero-alloc quiere que esté.

```ts
// asteria/compiler/curveRotate.ts

/**
 * Rotación cíclica exacta de una curva sobre [0, D).
 *
 *   1. t'_j = (t_j - d) mod D  para cada keyframe
 *   2. Reordenar ASC (invariante contractual de HephCurve: timeMs ascendente)
 *   3. Cerrar la costura: el segmento que cruzaba τ=0 se parte insertando
 *      keyframes en τ=0 y τ=D con el valor INTERPOLADO por CurveEvaluator
 *      (misma función que el runtime → paridad exacta, no aproximación).
 *   4. Bézier: si el segmento partido era 'bezier', se degrada a dos segmentos
 *      'linear' SOLO en la costura (el resto conserva sus handles intactos).
 *      Razón: partir un Bézier requiere De Casteljau y re-normalizar handles;
 *      la costura es 1 de N segmentos y el error visual es sub-perceptual.
 *      [DECISIÓN ABIERTA D-2: implementar De Casteljau en P4 si se mide artefacto]
 *
 * INVARIANTE: rot(C, 0) === C, byte a byte. Property test obligatorio.
 * INVARIANTE: ∀τ, |rot(C,d)(τ) − C((τ−d) mod D)| < 1e-6. Property test obligatorio.
 */
export function rotateCurveCyclic(curve: HephCurve, delayMs: number, durationMs: number): HephCurve
```

### 4.3 Coste y jerarquía de decisión

MCC cuesta **1 pista por (celda × parámetro)**. Un Tungsten con 7 celdas y 2 params = 14 pistas.
Seis Tungsten con celdas individualizadas = 84 pistas ≈ 60 KB. Por eso MCC **no es el modo por
defecto**: es el bisturí. El compilador elige así:

```
                   ¿el gesto distingue celdas del MISMO fixture?
                            │                    │
                           NO                    SÍ
                            │                    │
         ¿hay gain per-nodo independiente         │
              del tiempo?                         │
              │           │                       │
             NO          SÍ                       │
              ▼           ▼                       ▼
         ┌────────┐  ┌──────────┐          ┌────────────┐
         │  VÍA Λ │  │  VÍA B   │          │  VÍA MCC   │
         │ 1 pista│  │ K pistas │          │ C×P pistas │
         │ 8 KB   │  │ cohortes │          │  bisturí   │
         └────────┘  └──────────┘          └────────────┘
                            requiere Δ1+Δ2+Δ3 (§11)
```

### 4.4 Alternativa sin parche de runtime (modo degradado honesto)

Si el Cónclave decide **no** tocar el runtime, MCC degrada a **MCC-Z (por clase de celda)**: las
celdas se agrupan por `aetherZone` y se anima "todos los pétalos" vs "todos los wash". Funciona hoy,
coste cero, y cubre quizá el 70 % de los casos artísticos reales (simetría, no individualidad).
Asteria debe implementar MCC-Z **primero** (P3) y MCC-Cell **después** (P5), con el mismo UI. Así el
valor llega antes que el parche, y el parche no bloquea el producto.

---

## 5. Arquitectura de datos: el Gesture Stack (Photoshop para el rig)

### 5.1 Por qué una pila y no un editor de valores

Un pixel mapper convencional guarda el resultado (una textura, un mapa de delays). Eso es un JPEG:
inmodificable sin degradar. Asteria guarda **la receta**, y renderiza el resultado en cada cambio.
Es la misma decisión que hace de `PhaseConfigPro` + `phaseOverrides` un híbrido superior al
"algorítmico o manual" (`HEPHAESTUS-ENGINE-AUDIT-V1 §3.2`) — aquí se lleva al dominio espacial.

```
  Gesture Stack (no destructivo, reordenable, paramétrico)
  ┌──────────────────────────────────────────────┬──────────┬─────────┐
  │ 4  GLYPH   "LUX" · 0.8 m · rot 0°            │  op:max  │ 🔒 gain │
  │ 3  CHRONO  stroke#3 · 38 pts · 1.2 s         │  op:min  │ delay   │
  │ 2  WAVE    emitter(-3,0) dir→ · 9 m/s        │  op:repl │ delay   │
  │ 1  BASE    all · delay 0 · gain 1            │  op:repl │ both    │
  └──────────────────────────────────────────────┴──────────┴─────────┘
             │  fieldEngine.evaluate()  (O(N·G), ~0.2 ms para N=400, G=8)
             ▼
   FieldSnapshot { delayMs: Float32Array, gain: Float32Array, mask: Uint8Array }
             │  AsteriaCompiler.compile()
             ▼
   HephTrack[]  (ids "ast_*")  →  clip.tracks  →  preview / calib / save
```

### 5.2 Tipos

```ts
// asteria/model/AsteriaProject.ts

export type FieldChannel = 'delay' | 'gain' | 'both'
export type BlendOp = 'replace' | 'min' | 'max' | 'add' | 'mul'

/** Selección: lista de NodeIds. NUNCA índices — el atlas cambia al re-patchar. */
export interface NodeMask { readonly nodeIds: readonly string[] }

export type Gesture =
  | { kind: 'base';   id: string; delayMs: number; gain: number }
  | { kind: 'wave';   id: string; mask: NodeMask; op: BlendOp
      emitter: { x: number; z: number }      // METROS, convención Crystal Box
      shape: 'point' | 'line' | 'ring'
      dirDeg?: number                         // para 'line'
      speedMps: number                        // delay = dist / speed · 1000
      falloffM?: number                       // atenúa gain con la distancia
      huygens?: readonly { x: number; z: number }[] }  // multi-emisor → min(dist)
  | { kind: 'chrono'; id: string; mask: NodeMask; op: BlendOp
      stroke: readonly { x: number; z: number; tMs: number }[]  // trazo crudo, con tiempo
      captureRealTime: boolean                // true = usa el tempo del arrastre
      radiusM: number }                       // ancho del pincel
  | { kind: 'glyph';  id: string; mask: NodeMask; op: BlendOp
      text?: string; svgPath?: string
      transform: { x: number; z: number; scaleM: number; rotDeg: number }
      channel: FieldChannel; threshold?: number; antialias: boolean }
  | { kind: 'slice';  id: string; mask: NodeMask; op: BlendOp
      axis: 'x' | 'z' | 'radius' | 'angle' | 'dmx' | 'zone'
      buckets: number; spanMs: number; symmetry: 'linear' | 'mirror' | 'center-out'
      shuffleSeed?: number }                  // MISMO hash que PhaseConfigPro → paridad
  | { kind: 'manual'; id: string
      entries: readonly { nodeId: string; delayMs?: number; gain?: number }[] }
  | { kind: 'noise';  id: string; mask: NodeMask; op: BlendOp
      seed: number; scaleM: number; amountMs: number; octaves: 1 | 2 | 3 }

export interface AsteriaProject {
  readonly version: 1
  readonly stack: readonly Gesture[]
  readonly strategy: 'auto' | 'lambda' | 'cohort' | 'mcc'
  readonly targetParams: readonly HephParamId[]   // a qué parámetros aplica el campo
  readonly lutSource: { kind: 'preset'; name: string } | { kind: 'ride'; trackId: string }
  readonly cohortBudget: number                   // K máximo (default 16)
  readonly rigFingerprint: string                 // sha1(nodeIds ordenados) → detecta drift
}
```

### 5.3 Persistencia — y la línea que falta

`clip.asteria?: AsteriaProject`. El campo es **invisible** para runtime, linter y loader (ninguno
inspecciona claves desconocidas). Pero `serializeHephClip` es un **whitelist estricto**
(`types.ts:679-700`): un campo nuevo se pierde al guardar, **en silencio**, que es el peor modo de
fallo posible. Requiere exactamente una línea:

```ts
// types.ts, dentro del return de serializeHephClip
asteria: clip.asteria ? JSON.parse(JSON.stringify(clip.asteria)) : undefined,
```

Consecuencias auditadas:
- El checksum es `sha256(JSON.stringify(clip))` (`LfxFileLoader.computeLfxChecksum`, doctrina
  LAZARUS B-4 en `V3_TYPE_SYSTEM_DUE_DILIGENCE §1.6`): incluir `asteria` es determinista y correcto.
- Tamaño: la pila son parámetros, no datos por nodo. 8 gestos ≈ 3-6 KB. Salvo el gesto `manual`,
  que sí es O(N) — se cuenta en el HUD de presupuesto.
- **Alternativa descartada:** sidecar `clip.asteria.json`. Rechazada porque desincroniza al
  compartir el `.lfx` (Genesis y el marketplace mueven un solo archivo) y porque el ecosistema ya
  eligió "archivo autocontenido" como doctrina.

**Rig Drift.** Al abrir, se compara `rigFingerprint` con el atlas actual. Si difiere: banner
*"El rig ha cambiado: 3 nodos de esta pila ya no existen, 5 nodos nuevos sin asignar"*, con acciones
`Remapear por proximidad` / `Descartar huérfanos` / `Solo lectura`. Nunca un recompile silencioso:
el audit de `LfxFileLoader` ya dejó dicho que *"un rechazo que no se comunica es indistinguible de
un bug"* (`V3_TYPE_SYSTEM_DUE_DILIGENCE §1.7`).

---

## 6. El Lienzo Táctico — `AsteriaView.tsx` y su árbol de componentes

### 6.1 Inserción en la shell (3 puntos de sutura)

`HephaestusView/index.tsx` es un shell DAW de 3 tiers y la 4ª pestaña encaja sin refactor:

| Punto | Línea actual | Cambio |
|---|---|---|
| Unión de tabs | `index.tsx:80` — `useState<'sculpt'\|'lab'\|'genesis'>` | añadir `'asteria'` |
| Botón | `index.tsx:664-683` (patrón del botón Genesis) | botón `🜨 ASTERIA`, acento `#7b5cff` |
| Host Tier 3 | `index.tsx:710-712` | `{activeTab === 'asteria' && <AsteriaTab preview={preview} temporalActions={temporalActions} />}` |

Asteria recibe el `preview` que ya se crea en `index.tsx:97` (`useHephPreview`) y la Live Calibration
ya colgada en `:98`. **No monta su propio motor de evaluación.** Esa es la garantía WYSIWYG.

### 6.2 Layout

```
┌─ TIER 1 (heredado) ── nombre · duración · SafetyStrip · SAVE · CALIB ───────────┐
├─ TIER 2 ── FORGE │ LABORATORY │ GENESIS │ 🜨 ASTERIA ───────────────────────────┤
├────────────┬──────────────────────────────────────────────┬────────────────────┤
│ TOOLBOX    │            LIENZO TÁCTICO (XZ)               │   GESTURE STACK    │
│ 56 px      │                                              │   260 px           │
│            │   ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·      │  ┌──────────────┐  │
│ ▣ select   │   ·  ◉──◉──◉  ·  ·  ·  ╱▔▔╲  ·  ·  ·  ·      │  │4 GLYPH  max  │  │
│ ⌇ lasso    │   ·  ·  ·  ·  ·  ·  ·  ╲__╱  ·  ·  ·  ·      │  │3 CHRONO min  │  │
│ ✎ chrono   │   ·  ◉  ◉  ◉  ◉  ◉  ◉  ◉  ◉  ◉  ·  ·  ·      │  │2 WAVE  repl  │  │
│ 〰 wave     │   ·  ╎ isócrona 250 ms ╎  ·  ·  ·  ·  ·      │  │1 BASE  repl  │  │
│ A glyph    │   ·  ◉  ◉  ◉  ◉  ◉  ◉  ◉  ◉  ◉  ·  ·  ·      │  └──────────────┘  │
│ ⋮ slice    │   ·  ·  ·  ·  ·  [ 🜨 Tungsten-3 ]  ·  ·      │  INSPECTOR         │
│ ✜ cell     │   ·  ·  ·  ·  ·   ◔ ◕ ◑  wash  ·  ·  ·       │  speed  9.0 m/s    │
│ ~ noise    │                                              │  falloff 4.0 m     │
│            │  [zoom 1:40] [grid 0.25] [🔥 heat] [👁 live]  │  ESTRATEGIA: Λ     │
├────────────┴──────────────────────────────────────────────┴────────────────────┤
│ SCRUB ◀━━━━━━━━●━━━━━━━━━━━━▶ 1.85 s / 4.00 s   ⏵  [🔊 AUDITION]              │
│ BUDGET  pistas 1/64 · kf 34 · overrides 42 · 9.1 KB / 256 KB  ▓▓░░░░░░░░ 3.5%  │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Árbol de archivos

```
components/views/HephaestusView/
├── index.tsx                                  [Δ 3 líneas]
├── tabs/AsteriaTab.tsx                        host: grid 56/1fr/260, atajos, drift banner
└── asteria/
    ├── AsteriaView.tsx                        orquestador: tool router + stack + inspector
    ├── canvas/
    │   ├── AsteriaCanvas.tsx                  <canvas> 2D, RAF único, capas, hit-test
    │   ├── useWorldTransform.ts               metros↔px, pan/zoom, WorldRect ← StageDimensions
    │   ├── useNodeAtlas.ts                    IPC atlas + fallback stageStore + drift
    │   ├── useSpatialIndex.ts                 grid hash 0.5 m → hit-test O(1)
    │   └── layers/
    │       ├── GridLayer.ts                   voxel 0.25 m + ejes + cota de Crystal Box
    │       ├── ZoneLayer.ts                   tintes por CanonicalZone
    │       ├── NodeLayer.ts                   glifo por NodeFamily, anillo por rol
    │       ├── FieldLayer.ts                  heatmap de delay + ISÓCRONAS (contornos)
    │       ├── GestureOverlay.ts              handles vivos del gesto seleccionado
    │       └── FeedbackLayer.ts               color REAL desde transientStore (Aether Glass)
    ├── tools/
    │   ├── ToolRegistry.ts                    contrato Tool: {id,cursor,onPointer*,commit()}
    │   ├── SelectTool.ts  LassoTool.ts  RadialTool.ts
    │   ├── ChronoBrushTool.ts  WavefrontTool.ts  GlyphTool.ts
    │   ├── SlicerTool.ts   CellSurgeonTool.ts   NoiseTool.ts
    │   └── similarity.ts                      "select by similarity" (profileId/family/zona)
    ├── model/
    │   ├── AsteriaProject.ts                  tipos (§5.2)
    │   ├── fieldEngine.ts                     stack → FieldSnapshot (typed arrays reusados)
    │   └── glyphRaster.ts                     texto/SVG → bitmap → muestreo por nodo
    ├── compiler/
    │   ├── AsteriaCompiler.ts                 estrategia + emisión de HephTrack[]
    │   ├── lutSynth.ts  curveRotate.ts  cohortQuantizer.ts
    │   └── budget.ts                          estimador de bytes exacto (JSON.stringify real)
    ├── preview/
    │   ├── useAsteriaTouch.ts                 Protocolo Poke (§9)
    │   └── CalibrationBus.ts                  ÚNICO writer L3++ del renderer (merge clip+touch)
    └── store/useAsteriaStore.ts               zustand: stack, selección, tool, estrategia, HUD
```

### 6.4 Decisiones de render (y por qué no R3F)

El repo tiene `@react-three/fiber` y un `studio3d`. Asteria usa **Canvas2D plano**, deliberadamente:

- El mapper es **top-down XZ por contrato** — es la misma proyección canónica que ya usan
  `useFixtureData.ts:192-208` y `PixelMapAetherAdapter._worldToUV` (`:417-436`). Añadir una cámara 3D
  añade ambigüedad, no información.
- Un `<canvas>` con un solo RAF y capas dibujadas en orden cuesta ~1,5 ms para 500 nodos. R3F
  montaría 500 objetos React. El Aether Glass ya empuja 44 fps de estado a `transientStore`
  (`AETHER_MATRIX_AUDIT_PT2 §2.3`): leerlo en un RAF sin re-render de React es el patrón que la
  propia auditoría bendice ("zero-alloc y zero-React-cost").
- Hit-testing sobre grid hash de 0,5 m: el voxel de 0,25 m garantiza ≤4 nodos por celda salvo
  pétalos sintéticos (anillo de 0,15 m) — que es exactamente por lo que existe el Bisturí Celular
  con su propio zoom.

**Convención de ejes, escrita una vez y respetada en todo el código:**
`+X` derecha · `+Z` hacia la audiencia → **abajo** en el lienzo · `Y` ignorada (igual que
`_worldToUV`). El JSDoc de `aether/types.ts:378` dice lo contrario sobre Z y está desalineado; el
`SPATIAL_AWARENESS_AUDIT §2.2` ya lo dictaminó. `Y` se muestra como cota numérica en el tooltip y
como tamaño del glifo (nodos altos = glifo mayor), nunca como posición.

---

## 7. Las 8 herramientas

Cada herramienta es un **generador de campo**, no un editor de valores. Todas emiten un `Gesture` en
`commit()` y todas son reeditables desde el inspector para siempre.

### T1 · SELECT (`▣`) — la base
Click, marquee rectangular, `Shift` aditivo, `Alt` sustractivo, `Ctrl+drag` selección radial con
radio en metros mostrado en vivo. Chips de filtro persistentes: `COLOR` `IMPACT` `KINETIC` `BEAM`
`ATMOSPHERE` (las 5 `NodeFamily`) × zona. **Select by Similarity** (`Ctrl+Shift+A`): selecciona todos
los nodos que comparten `profileId`, familia o sufijo de celda con la selección actual — un click
para "todos los pétalos izquierdos del rig".

### T2 · LASSO (`⌇`)
Polígono a mano alzada, test de punto-en-polígono por *crossing number*. Con `Alt`, lazo de
**corredor**: una polilínea con ancho en metros (selecciona una fila de truss torcida sin sufrir).

### T3 · CHRONO-BRUSH (`✎`) — *pintas el orden con el que se enciende*
**La herramienta insignia.** El operador arrastra sobre el lienzo y Asteria **graba el trazo con sus
timestamps reales**. Cada nodo a menos de `radiusM` del trazo recibe como retardo el tiempo en que el
puntero pasó por su vecindad.

```
   arrastre lento ═══► retardos separados ═══► chase lento
   arrastre rápido ══► retardos juntos    ═══► casi simultáneo
   trazo en espiral ═► chase en espiral (imposible de expresar con spread/wings/blocks)
```

Dos modos: `captureRealTime` (usa el tempo humano del gesto, cuantizable a 1/8, 1/16 del BPM vivo que
la shell ya inyecta en `index.tsx:140`) o `arcLength` (reparametriza el trazo a velocidad constante:
el dibujo manda, el tempo no). Post-proceso no destructivo en el inspector: `escala temporal`,
`invertir`, `suavizar`, `cuantizar a beat`.

Esto **no existe en el mercado**. MA3 te da MAtricks (blocks/wings/groups) y phasers; Resolume/
MadMapper te dan una textura de vídeo. Ninguno te deja *dibujar la secuencia temporal con la mano
sobre la planta del escenario y hornearla en un archivo estático*.

### T4 · WAVEFRONT (`〰`) — física de verdad, en metros
Coloca un emisor (punto / línea / anillo), una dirección y una **velocidad en m/s**.
`delay = distancia / velocidad`. Las **isócronas** se dibujan como contornos sobre el lienzo: el
operador *ve* el frente de onda antes de disparar nada. Modo **Huygens**: N emisores, cada nodo toma
`min(distancia)` — interferencia y frentes compuestos gratis. `falloffM` atenúa `gain` con la
distancia (ecos, profundidad).

Por qué es superior a `spreadDeg`: `PhaseConfigPro` ordena por **índice** de fixture; Wavefront ordena
por **distancia euclídea real**. Un rig asimétrico (el 100 % de los rigs reales) produce con
`spreadDeg` un barrido que no se parece a un barrido. Con Wavefront, sí.

### T5 · GLYPH STAMPER (`A`) — escribe en el rig
Texto (bitmap font 5×7 embebida, sin dependencias nuevas) o path SVG, rasterizado a un bitmap y
muestreado por nodo con el `WorldRect` del Crystal Box. Sale como `gain` (imagen estática: Vía B/
Λ-Frozen) o como `delay` (el glifo *barre* el rig: Vía Λ). `threshold` para mesetas duras;
`antialias` para gradiente. Handles de transform (posición en metros, escala, rotación) editables
para siempre. Aviso honesto en la UI: con 8 fixtures no se lee "LUX" — el HUD muestra la
**resolución efectiva** (nodos por metro) y avisa si el glifo es ilegible.

### T6 · SLICER (`⋮`) — el chase determinista
Ordena por un escalar (`x`, `z`, radio, ángulo, **dirección DMX**, zona), reparte en `buckets`
temporales sobre `spanMs`, con `symmetry` y `shuffleSeed`. **Usa el mismo hash determinista que
`PhaseConfigPro`** (`HEPHAESTUS-ENGINE-AUDIT-V1 §3.1`, etapas ①-⑥): así un diseño hecho con el Slicer
y otro con el Phase Rack son *comparables*, y un `.lfx` de Asteria es indistinguible de uno hecho a
mano en Lab. Paridad, no dialecto paralelo.

### T7 · CELL SURGEON (`✜`) — el bisturí multicelular
Doble click en un fixture compuesto → **inspector de celdas**: el aparato se expande y muestra sus
nodos reales (`golden-master`, `petal-l/c/r`, `wash`, `beam-color`) con su geometría real, incluido
el anillo sintético de pétalos de 0,15 m que **solo existe en el NodeGraph**
(`SpatialRegistrar._calculatePetalPositions`, vía `SPATIAL_AWARENESS_AUDIT §1.3`). Se arrastran
celdas individuales; se copia/pega el patrón celular a todos los fixtures del mismo perfil
("aplicar a los 6 Tungsten").

Banda de estado explícita en esta herramienta:
- **MCC-Z disponible** (sin parche): celdas agrupadas por `aetherZone`.
- **MCC-Cell requiere Δ1+Δ2+Δ3**: si los parches no están, el botón está deshabilitado con el
  tooltip *"Independencia por celda: requiere WAVE 8040. Usando agrupación por zona."* Nunca
  genera un `.lfx` que promete algo que el runtime va a colapsar.

### T8 · NOISE (`~`) — la orgánica
Ruido de valor con seed, `scaleM` (tamaño del grano en metros), `amountMs`, 1-3 octavas. Sirve para
romper la perfección mecánica: alimenta directamente el eje **Organicity** del genoma ACO
(`HEPHAESTUS-ENGINE-AUDIT-V1 §5.2`). El HUD sugiere el valor de `organicity` coherente con el ruido
aplicado, para que el DnaRail no tenga que adivinarlo.

### Extras transversales
- **HEAT (`🔥`)** — heatmap de retardos + isócronas cada 50/100/250 ms.
- **LIVE (`👁`)** — pinta el color real que están emitiendo los focos leyendo `transientStore`.
  El lienzo se convierte en un monitor del rig físico.
- **AUDITION** — al arrastrar el scrub, el clip compilado se envía por el Protocolo Poke a los focos
  reales. Scrub espacial *y* físico a la vez: se ve la ola en el escenario, a mano, fotograma a
  fotograma.

---

## 8. El compilador `AsteriaCompiler`

### 8.1 Contrato

```ts
export interface CompileInput {
  readonly atlas: NodeAtlas               // orden canónico estable (ver §9.1)
  readonly field: FieldSnapshot           // delayMs[], gain[], mask[]
  readonly clip: HephAutomationClipV3     // duración, params, curvas existentes (Λ-Ride)
  readonly project: AsteriaProject
}
export interface CompileOutput {
  readonly tracks: readonly HephTrack[]   // ids "ast_<param>_<estrategia>_<n>"
  readonly report: CompileReport          // bytes, pistas, kf, warnings, estrategia elegida
}
export function compile(input: CompileInput): CompileOutput
```

Reglas duras del emisor (cada una mapea a un gate verificado):

| Regla | Gate que satisface |
|---|---|
| `zones` nunca vacío (default `['all']`) | G5 · `LfxFileLoader.ts:327-346` |
| `curve.keyframes` nunca vacío | G5 |
| keyframes emitidos **ordenados ASC** y dentro de `range` | invariante `HephCurve` (`types.ts:323`); además hace idempotente cualquier normalización posterior **[A VERIFICAR: `HephaestusClipIndex._normalizeClipCurves`]** |
| `phaseConfig.spreadDeg = 1` siempre que haya overrides | **A1** — con 0 los overrides mueren |
| Todos los overrides en `mode:'absolute'` | determinismo: `delta` depende del algoritmo (`PhaseOverride.ts:83-96`) |
| `offsetMs` clampado a `[0, durationMs]` y redondeado a entero | clamp duro del runtime + ahorro de bytes (`777.7777777777778` → `778`) |
| Sin pista `strobe` salvo petición explícita | G6 · `LfxFileLoader.ts:381-395` |
| `vibeCompat` heredado del clip, nunca `[]` | gate estructural |
| Reemplazo **solo** de tracks con id `ast_*` | coexistencia con Forge |

### 8.2 Λ-Ride: reutilizar la curva que el operador ya esculpió

Si `project.lutSource.kind === 'ride'`, el compilador **no sintetiza curva**: toma la curva del track
indicado y emite una única pista nueva con esa curva + el bus de direcciones. La pista original queda
intacta (o se desactiva, a elección). Es la mejor relación potencia/sorpresa del diseño: el operador
esculpe en Forge como siempre, y en Asteria decide *cómo se propaga por el espacio*.

### 8.3 Vía B — cohortes (cuando hace falta gain per-nodo y una imagen quieta)

1. Cuantizar `gain[]` en `K ≤ cohortBudget` niveles (percentiles, no uniforme).
2. Por cohorte: una pista con la curva maestra **rotada** por el retardo representativo del grupo
   (`rotateCurveCyclic`) y escalada por el nivel de gain (`dimmerScale` para `intensity`, o baked en
   los valores de keyframe para el resto).
3. Targeting de la cohorte: `zones` de la cohorte ∪ overrides `absolute` para clavar a sus miembros.
   **Limitación honesta:** si la cohorte no coincide con un recorte de zonas, sus fixtures no
   targeteables reciben el valor de otra cohorte. El compilador lo detecta y emite
   `COHORT_ZONE_SPILL` en el reporte, con la lista exacta de nodos afectados. No lo esconde.

### 8.4 Presupuesto (`budget.ts`)

`JSON.stringify` del array de tracks candidato, real, no estimado. HUD siempre visible. Umbrales:
`< 40 %` verde · `40-70 %` ámbar · `> 70 %` rojo con sugerencias accionables (bajar `K`, subir el
paso de cuantización de delays, decimar keyframes, pasar de MCC-Cell a MCC-Z). Cifras de referencia
calculadas con el formato real observado en `builtins/custom/heph_1782609140553_bto9fn.lfx`:

| Escenario | Pistas | Bytes | % de 256 KB |
|---|---|---|---|
| Λ · 100 fixtures · K=32 | 1 | ≈ 8,5 KB | 3,3 % |
| Λ · 400 nodos · K=64 | 1 | ≈ 32 KB | 12,5 % |
| Cohortes · 16 × 2 params · 12 kf | 32 | ≈ 26 KB | 10 % |
| MCC-Cell · 6 Tungsten × 7 celdas × 2 params | 84 | ≈ 60 KB | 23 % |
| MCC-Cell + Λ + glifo, rig grande | ~120 | ≈ 140 KB | **55 % — ámbar** |

Hay margen. El límite práctico se alcanza antes por legibilidad del clip en Forge que por bytes.

### 8.5 Verificación del compilador (obligatoria antes de dar P4 por bueno)

1. **Property test de rotación:** `rot(C,0) === C` byte a byte; `|rot(C,d)(τ) − C((τ−d)%D)| < 1e-6`
   evaluado con el **`CurveEvaluator` de producción**, no con una reimplementación.
2. **Round-trip Λ:** para un campo aleatorio, compilar → evaluar con `evaluateFixtureParams` →
   comparar contra el campo objetivo. Error máximo ≤ 1 nivel de cuantización.
3. **Gate replay:** todo clip compilado pasa por `LfxFileLoader._parseAndValidateV3` + el
   `GatekeeperLinter` en test. Cero warnings nuevos.
4. **Test de checksum:** compilar → serializar → `computeLfxChecksum` → recargar. Debe aceptar
   (doctrina LAZARUS B-4: mismatch = error duro, y `HephaestusClipIndex.upsert` descarta el archivo).
5. **Test anti-regresión A1:** un clip con `spreadDeg: 0` + overrides debe **fallar** el test de
   round-trip. Es el canario que documenta el hallazgo en código ejecutable.
6. **Paridad preview↔runtime:** el mismo clip evaluado por `useLiveCalibration` y por
   `HephaestusRuntime` debe dar el mismo campo. Hoy **divergen** con `spreadDeg:0` (el hook usa
   `track.phaseConfig` crudo, `useLiveCalibration.ts:152-162`; el runtime pasa por
   `_extractPhaseConfig`). El test debe fijar la convergencia.

---

## 9. Feedback físico: el Protocolo Poke

### 9.1 El Node Atlas (cierra la brecha IPC del `SPATIAL_AWARENESS_AUDIT §3.4`)

```ts
// lux:aether:getNodeAtlas — ONE-SHOT, patch-time. NUNCA en el tick.
interface NodeAtlasEntry {
  nodeId: string          // "fixture-177…:petal-l"  ← el handle exacto
  deviceId: string
  cellSuffix: string      // "petal-l" | "impact" | …  ← la llave de MCC
  family: NodeFamily
  zoneId: string
  position?: { x: number; y: number; z: number }   // METROS, con offset de pétalo ya aplicado
  role: string
  customLabel?: string    // el nombre de celda puesto en la Forja (profileMeta.customLabel)
}
```

Implementación: `nodeGraph.getView(family).forEach(...)` por las 5 familias, serializado una vez.
Se re-emite en el evento `topology_changed` que `SpatialRegistrar` ya dispara tras cada batch
(`SPATIAL_AWARENESS_AUDIT §1.6`). Coste en el hot path: **cero**.

Fallback sin IPC (modo demo / renderer aislado): `stageStore.fixtures` → un nodo por fixture en el
centro, `cellSuffix` desconocido, Bisturí Celular deshabilitado. Degradación anunciada, no silenciosa.

Orden canónico del atlas: ordenado por `(deviceId, cellSuffix)` — estable, reproducible, y base del
`rigFingerprint`.

### 9.2 Poke: tocar la UI y que el foco responda

La carretera existe y es la correcta: **L3++**, la capa de mayor prioridad por debajo de Blackout
(`AETHER_MATRIX_AUDIT_PT2 §1.1-1.2`), alimentada por `window.luxsync.writeCalibration` →
`hephaestus:calibration:write` → `TickEngine.writeCalibration` (`TickEngine.ts:251`) →
`arbiter.setCalibrationIntents` (`NodeArbiter.ts:699`), con watchdog de 500 ms que limpia la capa si
el renderer se calla (`:703-706`).

Dos cosas que hay que hacer bien:

**(1) Un solo escritor.** Hoy `useLiveCalibration` es el único productor. Si Asteria escribe también,
el último IPC gana y los dos se pisan. Solución: `CalibrationBus.ts`, singleton del renderer, con dos
fuentes fusionadas por LTP (`touch` > `clip`) y **una sola publicación por frame**. `useLiveCalibration`
pasa a ser un productor de ese bus en lugar del escritor directo (refactor de ~20 líneas, sin cambio
de comportamiento observable).

**(2) Event-driven, no stream.** `TickEngine.writeCalibration` asigna un array + un objeto `values`
por entrada **en cada llamada**, en el proceso main (`TickEngine.ts:256-291`). A 44 Hz con 100
entradas son ~4 400 objetos/s de basura joven en el proceso que sostiene el frame budget de 22,7 ms.
El Poke no paga ese peaje:

```
  Protocolo Poke
  ─────────────────────────────────────────────────────────────────
  hover / selección / drag  →  set de nodos "calientes" cambia
                            →  publicar SOLO en el cambio (coalescido a 1 rAF)
  heartbeat cada 400 ms     →  mantiene vivo el watchdog de 500 ms
  release                   →  fade-out de 180 ms (6 frames) y publicar vacío
  ─────────────────────────────────────────────────────────────────
  Tasa típica: 2-8 publicaciones/s (vs 44). Reducción de ~85 % del churn.
```

**(3) Precisión celular gratis.** `TickEngine.writeCalibration` expande `fixtureId:family` a *todos*
los nodos de esa familia (`:263-286`) — perfecto para "enciende el fixture", inútil para una celda.
Pero si se le pasa un `nodeId` **real** (`fixture-177…:petal-l`), `family.toUpperCase()` no coincide
con ninguna `NodeFamily`, el bucle no encuentra nada y cae al fallback que usa el nodeId **tal cual**
(`:290`). Resultado: **el feedback celular exacto ya funciona hoy, siempre que el renderer conozca
los nodeIds reales** — que es precisamente lo que entrega el Node Atlas. No hace falta tocar nada.
(Nota de rigor: esto funciona *por el camino del fallback*. Merece un comentario en el código para
que nadie lo "arregle" sin saber que alguien depende de él.)

**Seguridad del Poke.** Es L3++: pisa absolutamente todo menos Blackout. Por tanto:
`gain` del poke limitado por el Grand Master; se respeta Blackout; badge `POKE ACTIVO` en Tier 1 con
kill-switch; `Esc` libera; desmontar la pestaña libera; nunca se envía `strobe` (el gate G6 y la
seguridad fotosensible no se tocan desde un hover de ratón).

---

## 10. Presupuestos, límites y modos de fallo

| Límite | Valor | Origen | Mitigación en Asteria |
|---|---|---|---|
| Tamaño de `.lfx` | 256 KB | `LfxFileLoader.ts:66` | HUD de presupuesto + cuantizador de cohortes |
| Handle per-fixture | solo `offsetMs` | §2 | Vía Λ |
| Granularidad de `phaseOverrides` | fixture | `PhaseOverride.ts:51` | MCC (curvas rotadas) |
| Colapso del blend map | `fixtureId:param` | `HephaestusRuntime.ts:685` | Δ1 |
| `spreadDeg` debe ser > 0 | — | **A1** | emitir `spreadDeg: 1` |
| Resolución espacial | 0,25 m (voxel) | `ShowFileV2` snap | grid del lienzo = 0,25 m; sub-voxel solo pétalos |
| Fixtures sin posición | `isPlaced === false` | `SPATIAL_AWARENESS_AUDIT §5.3` | carril "UNPLACED" lateral en el lienzo; excluidos del campo, nunca colocados en `{0,0,0}` |
| Sentinel `{0,3,0}` | heurística frágil | `§5.6` | discriminar por `placementMode`/`isPlaced`, **no** por la posición |
| `Y` ignorada en la proyección | — | `_worldToUV` | cota numérica + tamaño de glifo; olas verticales = **fuera de alcance v1** (decisión D-3) |
| Watchdog de calibración | 500 ms | `NodeArbiter.ts:703` | heartbeat de 400 ms |

**Modos de fallo diseñados** (cada uno con su mensaje al operador):
`ATLAS_UNAVAILABLE` (degrada a centros de fixture) · `RIG_DRIFT` (banner + remapeo) ·
`BUDGET_EXCEEDED` (bloquea compilación, sugiere K) · `COHORT_ZONE_SPILL` (lista de nodos) ·
`CELL_MODE_UNAVAILABLE` (Δ ausente → MCC-Z) · `GLYPH_UNREADABLE` (resolución insuficiente) ·
`LAMBDA_FROZEN_DRIFT` (avisa del % de deriva).

---

## 11. Δ RUNTIME — los 4 parches quirúrgicos

El ticket prohíbe añadir lógica espacial al `NodeArbiter` y al `TickEngine` a 44 Hz. **Ninguno de
estos parches lo hace.** No hay una sola operación aritmética nueva en el hot path; son
discriminadores de routing en bucles que ya existen y ya iteran esos mismos elementos.

### Δ1 — Discriminador de celda en el blend map `[BLOQUEANTE para MCC-Cell]`
`HephaestusRuntime._emitTrackSample:685`

```ts
// ANTES
const blendKey = fixtureId + ':' + paramName
// DESPUÉS — el sufijo se precalcula UNA VEZ en _buildResolvedTrack (patch-time):
//   track.blendSuffix = ':' + paramId + (t.cell ? '#' + t.cell : '')
const blendKey = fixtureId + track.blendSuffix
```
**Coste:** idéntico. Hoy ya se hace **una** concatenación por muestra; después se sigue haciendo
**una**. Cero allocaciones nuevas. Y desbloquea que dos celdas del mismo fixture tengan tiempos
independientes, que es la razón de ser del ticket.

### Δ2 — Propagar `cell` a la salida
`HephaestusRuntime`: `HephFixtureOutput.cell?: string` + `out.cell = track.cell` en `writeOutput`
(junto a `out.trackZones = trackZones`, `:861`). El buffer de salida está **pre-asignado y reusado**
(`:816-823`): es una asignación de campo sobre un objeto existente. Cero allocaciones.

### Δ3 — Routing por celda en el adapter
`HephaestusAetherAdapter.ingest`, dentro del bucle compuesto que ya existe (`:145-165`):

```ts
if (output.cell) {
  const sep = nodeId.lastIndexOf(':')
  if (nodeId.slice(sep + 1) !== output.cell) continue   // O(1), sin alloc
}
```
Se antepone al match por zona. Si `cell` no está presente, el comportamiento es **bit-idéntico** al
actual. Compatibilidad total hacia atrás, y activa un campo que el contrato v3.0 **ya reserva**
(`types.ts:455-459`) y el serializador **ya preserva** (`:663`): **no hay bump de schema, el linter no
lo mira, el loader no lo valida**. Es exactamente el escenario para el que se reservó el namespace —
la due diligence lo llamó "la práctica correcta para un formato con compromiso de compatibilidad"
(`V3_TYPE_SYSTEM_DUE_DILIGENCE §1.3`).

### Δ4 — `lux:aether:getNodeAtlas`
Handler IPC one-shot + push en `topology_changed`. Fuera del tick. Cierra la brecha que el
`SPATIAL_AWARENESS_AUDIT §3.4` identificó como bloqueante para cualquier mapper que corra en el
renderer.

### Δ5 (fuera del alcance de Asteria, recomendado)
`serializeHephClip` + `asteria` (1 línea, §5.3) · borrar o arreglar `CalibrationSAB.ts` (**A5**) ·
convergencia preview↔runtime de `_extractPhaseConfig` (**A1**, hoy divergen).

**Resumen de intervención en el núcleo: ~21 líneas de producción.** Todo lo demás es UI y matemática
offline. Si el Cónclave veta los parches, Asteria sigue entregando Λ + Vía B + MCC-Z, que es la mayor
parte del valor.

---

## 12. Roadmap WAVE 8000–8060

Seis fases. Cada una es **desplegable y auditables por sí sola**: ninguna deja el repo en un estado
donde la pestaña exista pero no sirva. Nada de "big bang".

---

### WAVE 8000 — *El Atlas* (fundamentos, sin UI)
**Entregables**
- `Δ4` `lux:aether:getNodeAtlas` + tipo `NodeAtlasEntry` + push en `topology_changed`.
- `useNodeAtlas.ts` con fallback a `stageStore` y detección de drift.
- `Δ5a`: una línea en `serializeHephClip` para `clip.asteria`.
- **Verificación de los 5 hallazgos de §1 reproducida como tests** — incluido el canario A1 y la
  divergencia preview↔runtime. Esto es la base de credibilidad de todo lo demás.

**Gate de aceptación**
`tsc -p tsconfig.node.json --noEmit` verde · `vitest run` verde · el atlas de un show real devuelve
los nodeIds celulares esperados del Tungsten · roundtrip de `clip.asteria` no pierde datos.

---

### WAVE 8010 — *El Lienzo* (ver, no editar)
**Entregables**
- 4ª pestaña cosida (`index.tsx`, 3 líneas) + `AsteriaTab` + `AsteriaView`.
- `AsteriaCanvas` con `GridLayer`, `ZoneLayer`, `NodeLayer`, `useWorldTransform`, `useSpatialIndex`.
- `FeedbackLayer` leyendo `transientStore` (el rig real, en vivo, en el lienzo).
- Carril UNPLACED. Tooltips con nodeId, familia, celda, zona, cota Y.

**Gate**
500 nodos a 60 fps con RAF único · cero re-renders de React durante el movimiento del ratón
(verificable con el profiler) · coherencia de proyección con `useFixtureData.ts:192-208`.

---

### WAVE 8020 — *El Tacto* (Poke + selección)
**Entregables**
- `CalibrationBus` + refactor de `useLiveCalibration` a productor.
- `useAsteriaTouch` con el Protocolo Poke (coalescido, heartbeat, fade-out, kill-switch).
- `SelectTool`, `LassoTool`, `RadialTool`, chips de familia/zona, Select by Similarity.

**Gate**
Hover sobre un nodo enciende **ese** foco (y **esa** celda en un compuesto) en < 50 ms ·
publicaciones/s medidas ≤ 10 en uso normal · `Esc`/desmontaje/Blackout liberan siempre ·
ningún conflicto con CALIB del Tier 1 activo.

> Al cerrar 8020 el producto **ya es útil**: un mapa táctico del rig con feedback físico real.
> Nada de lo que sigue es prerrequisito para que el operador le saque valor.

---

### WAVE 8030 — *La Pintura* (gestos + campo + Λ)
**Entregables**
- `fieldEngine` (typed arrays reusados) + `Gesture` + `useAsteriaStore` + panel Gesture Stack.
- `WavefrontTool` (con isócronas), `SlicerTool` (paridad de hash con `PhaseConfigPro`), `NoiseTool`.
- `lutSynth` + `AsteriaCompiler` **solo Vía Λ** + `budget.ts` + HUD.
- Recompilación debounced (150 ms) a `clip.tracks` con ids `ast_*`.

**Gate**
Round-trip Λ con error ≤ 1 nivel · gate replay del loader + linter sin warnings · checksum válido ·
un barrido pintado se ve idéntico en Asteria, en el Phase Canvas y **en el escenario** ·
presupuesto real medido con `JSON.stringify`.

---

### WAVE 8040 — *La Mano y el Bisturí* (Chrono + celdas)
**Entregables**
- `ChronoBrushTool` (captura temporal, arc-length, cuantización a BPM vivo).
- `Δ1` + `Δ2` + `Δ3` (los ~15 líneas de independencia celular).
- `CellSurgeonTool` con MCC-Z → MCC-Cell + `curveRotate` + property tests de rotación.
- `cohortQuantizer` + **Vía B** con detección de `COHORT_ZONE_SPILL`.

**Gate**
Dos pétalos del mismo Tungsten animados con 500 ms de desfase, **verificado en DMX real** ·
`rot(C,0) === C` byte a byte · sin `cell`, el output del runtime es bit-idéntico al pre-parche
(test de regresión sobre los `.lfx` builtin existentes) · 39/39 de las specs SAB siguen verdes.

---

### WAVE 8050 — *La Tipografía* (glifos + pulido)
**Entregables**
- `GlyphTool` + `glyphRaster` + bitmap font embebida + aviso de legibilidad.
- Λ-Frozen con su aviso de deriva. Λ-Ride (reutilizar la curva de Forge como LUT).
- Rig Drift con remapeo por proximidad. Biblioteca de presets de gestos. Atajos completos.

**Gate**
"LUX" legible en un rig de ≥ 24 nodos · aviso correcto por debajo del umbral ·
Λ-Ride produce una pista cuya curva es **idéntica** a la fuente (comparación estructural).

---

### WAVE 8060 — *La Convergencia* (opcional, futuro)
**Entregables (exploratorio, no comprometido)**
- Export alternativo: el campo de Asteria como fuente de canvas para `PixelMapAetherAdapter`
  (camino L3 vivo que **ya existe** — WAVE 4812). Un lienzo, dos salidas: hornear o transmitir.
- Sugerencia de genoma ACO a partir del contenido espacial (el ruido → organicity, la velocidad del
  frente → aggression) como asistente del DnaRail, nunca como sustituto.
- Interoperabilidad con Theia (`executionDomain: 'pixel'` + `pixelHints`, `lfxTypes.ts:129-155`).

**Gate**
Ninguno comprometido. Se abre solo si 8000-8050 están cerrados y medidos.

---

### Dependencias

```
8000 Atlas ──┬─► 8010 Lienzo ──► 8020 Tacto ──┬─► 8030 Pintura ──► 8040 Mano+Bisturí ──► 8050 Glifos
             │                                 │                          │
             └─────────────────────────────────┘                          └──► 8060 (opcional)
      Δ4 + tests de §1        Δ5a          CalibrationBus            Δ1+Δ2+Δ3
```

Valor acumulado: **8020** = mapa táctico con feedback real. **8030** = pixel mapper funcional
(barridos, ondas, chases espaciales horneados). **8040** = independencia celular, el diferencial.
**8050** = el efecto demo que vende el producto.

---

## 13. Riesgos, alternativas descartadas y decisiones abiertas

### Riesgos con mitigación

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Δ1 altera el blending de `.lfx` existentes | **Alta** | Sin `cell`, `blendSuffix` es idéntico a la clave actual. Test de regresión que replaya todos los builtin y compara output byte a byte |
| Explosión de pistas hace el clip inmanejable en Forge | Media | Ids `ast_*` agrupables/plegables en `ParameterLane`; el HUD avisa antes de compilar |
| El operador espera imágenes quietas y obtiene scroll (Λ) | Media | La UI nombra el modo, avisa de la deriva y ofrece Vía B como alternativa explícita |
| Poke a L3++ pisa un show en vivo | **Alta** | Badge + kill-switch + respeto de Blackout/Grand Master + liberación automática + jamás `strobe` |
| El Node Atlas no está (renderer aislado) | Baja | Degradación anunciada a centros de fixture |
| Deriva del rig invalida la pila | Media | `rigFingerprint` + banner + remapeo, nunca recompile silencioso |
| La rotación de Bézier en la costura introduce artefacto | Baja | Degradación a lineal solo en la costura; D-2 abre De Casteljau si se mide |

### Alternativas descartadas (y por qué)

- **Un `.lfx` por fixture.** Multiplica clips, rompe la atomicidad que Chronos y Selene asumen, y
  colapsa el mixBus. Descartada.
- **Nuevo tipo de track (`HephPixelTrack`).** Exige bump de schema, migrador, reglas nuevas de linter
  y toca los 5 subsistemas que el `V3_TYPE_SYSTEM_DUE_DILIGENCE` enumera. Λ + `cell` logran lo mismo
  con cero bump. Descartada.
- **Calcular el campo espacial en runtime** (pasar geometría al `.lfx` y resolver a 44 Hz).
  Viola el dogma y duplica lo que `PixelMapAetherAdapter` ya hace mejor. Descartada por doctrina.
- **Resucitar `CalibrationSAB`.** Es código muerto con un bug de colisión total (**A5**) y su
  sustituto vive. Descartada; se propone su borrado por separado.
- **`selector` como eje de targeting.** No está implementado en la ruta V3 (**A2**). Descartada
  hasta que alguien decida implementarlo — y si se implementa, Asteria gana un eje gratis.
- **Sidecar `.asteria.json`.** Desincroniza al compartir. Descartada.
- **Canvas WebGL/R3F.** Coste de complejidad no justificado para 500 puntos 2D. Descartada.

### Decisiones abiertas para el Cónclave

| # | Decisión | Recomendación |
|---|---|---|
| **D-1** | ¿Se aprueban Δ1-Δ3 (~15 líneas) para independencia celular real? | **Sí.** Sin ellos, MCC-Cell es inexpresable y el ticket queda a medias. El riesgo es acotado y cubierto por test de regresión byte a byte |
| **D-2** | ¿De Casteljau para partir Béziers en la costura de rotación? | Aplazar a P4; degradar a lineal solo en la costura y **medir** antes de complicar |
| **D-3** | ¿Eje `Y` (olas suelo→techo) en v1? | **No.** `_worldToUV` ignora Y por contrato. Se muestra como cota. Un modo "alzado XY" es candidato natural a WAVE 8070 |
| **D-4** | ¿`clip.asteria` embebido o sidecar? | **Embebido** (§5.3) |
| **D-5** | ¿Los clips de Asteria entran en el pool de Selene? | **No por defecto.** Sin `cognitiveDNA` son manual/Chronos/MIDI, que es lo correcto para contenido espacial ligado a un rig concreto. El DnaRail sigue disponible para el opt-in |
| **D-6** | ¿Se borra `CalibrationSAB.ts`? | **Sí**, simetría con F3/F4 de PT2. Fuera del alcance de Asteria; ticket propio |

---

## 14. Apéndice: tabla de referencias verificadas

| Tema | Archivo | Líneas |
|---|---|---|
| Shell de tabs de Hephaestus | `components/views/HephaestusView/index.tsx` | union:80 · barra:609-691 · host:693-713 · preview:97 · calib:98 · bpm:140 |
| Serializador whitelist (`cell` preservado) | `core/hephaestus/types.ts` | 630-667 (`cell`:663) · clip:679-700 |
| `HephTrack.cell` reservado | `core/hephaestus/types.ts` | 455-459 |
| `selector` no filtra targeting (**A2**) | `core/hephaestus/runtime/HephaestusRuntime.ts` | 967-982 (zones:969 · selector solo phase:974-977) |
| `spreadDeg <= 0` mata overrides (**A1**) | `core/hephaestus/runtime/HephaestusRuntime.ts` | gate:1022 · `_extractPhaseConfig`:1049-1051 |
| Blend map colapsa por fixture (**A3**) | `core/hephaestus/runtime/HephaestusRuntime.ts` | 685-686 · retornos de blend:716,730 |
| Wrap cíclico / clamp one-shot | `core/hephaestus/runtime/HephaestusRuntime.ts` | 626 · 628 |
| `trackZones` → salida | `core/hephaestus/runtime/HephaestusRuntime.ts` | 639 · 659 · `writeOutput`:861 · buffer pre-asignado:816-823 |
| Routing compuesto por zona (**A4**) | `core/aether/adapters/HephaestusAetherAdapter.ts` | 125-188 · helper:530-536 |
| Celdas de la Forja (`aetherNodeId`/`aetherZone`) | `core/aether/ingestion/NodeExtractionPipeline.ts` | 655-700 · doctrina:585-623 |
| `resolveWithOverrides` (absolute/delta/clamp) | `core/hephaestus/phase/PhaseOverride.ts` | 67-100 (`absolute`:83-88) · `bake`:109 |
| Calibración L3++ viva (IPC, no SAB) | `core/orchestrator/tick/TickEngine.ts` | 251-293 (fallback exacto:290) · inyección:1611-1616 |
| Watchdog de calibración | `core/aether/NodeArbiter.ts` | 699-706 |
| `CalibrationSAB` muerto + truncado a 8 chars (**A5**) | `core/aether/glass/CalibrationSAB.ts` | 20 · 61-62 · writer:157-190 · reader:274-281 |
| Bridge de calibración en preload | `electron/preload.ts` | 59-69 |
| Hook de calibración (divergencia de fase) | `components/views/HephaestusView/useLiveCalibration.ts` | 152-162 · entries:251-262 |
| Límite de tamaño de `.lfx` | `core/arsenal/LfxFileLoader.ts` | 66 · G5:327-346 · G6:381-395 |
| `FixtureSelector` (resolver sin caller V3) | `core/stage/ShowFileV2.ts` | 578-638 · `resolveFixtureSelector`:651-701 |
| API del editor store | `core/hephaestus/store/useHephaestusEditorStore.ts` | acciones:91-141 (`addTrack`:99 · `mutate`:138) |
| Ids de fixture reales (longitud) | `shows/6testNUEVO.v2.luxshow` | 23 · 138 · 253 … |

---

*Blueprint de diseño. Ninguna línea de producción modificada. Los hallazgos de §1 son verificables
por lectura directa de las referencias del §14 y deberían convertirse en tests antes de escribir la
primera línea de Asteria — un pixel mapper construido sobre las tres afirmaciones erróneas del
`LFX_GENERATION_AUDIT` generaría archivos perfectamente válidos que no encenderían un solo foco.*
