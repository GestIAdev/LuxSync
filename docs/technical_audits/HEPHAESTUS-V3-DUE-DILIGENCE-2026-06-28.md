# ⚒️ TECHNICAL DUE DILIGENCE REPORT — HEPHAESTUS V3 (REV. 2)

**Clasificación:** CONFIDENCIAL — Comité de Adquisiciones AlphaTheta
**Auditor:** PunkOpus — Chief DSP Auditor & Acquisition Veteran
**División:** Pioneer DJ / AlphaTheta — Advanced Signal Processing Group
**Producto:** LuxSync — Hephaestus V3 (Motor de Efectos Paramétricos · Área 2 de la suite)
**Benchmark:** grandMA3 Phaser / MAtricks (MA Lighting)
**Fecha:** 28 de Junio de 2026
**Base de código revisada:** WAVE 7024–7035 (activo, verificado contra fuente)
**Documentos previos:** Auditoría Marzo 2026 (Score 86.5) · Due Diligence Rev. 1 (27 Jun 2026, Score 89.4) — *ambos usados como mapa anatómico; este informe los corrige sobre código verificado.*

> **NOTA DE ALCANCE.** El equipo declara que Hephaestus V3 es una herramienta de diseño **en frío** (preshow / pre-programación), NO un controlador de performance en vivo. Esta auditoría no penaliza la ausencia de Speed Master / encoders / control live. El eje de comparación contra MA3 se desplaza de *operación* a **autoría de efectos**.

> **NOTA DE REVISIÓN (por qué existe la Rev. 2).** La Rev. 1 (27 Jun) listaba como abiertos seis hallazgos P0/P1. Al re-auditar línea por línea contra el árbol actual (WAVE 7035), **cinco de ellos están cerrados en código**. Mantener la Rev. 1 como veredicto vigente sería un error de diligencia. Este documento detalla qué se cerró, con cita de fuente, y reescala el Pioneer Score en consecuencia.

---

## 0. RESUMEN EJECUTIVO

En marzo dije que esto era un Tesla con Autopilot frente al Ferrari manual de MA3. En junio el equipo no añadió un volante: reconstruyó el chasis (arquitectura multicelular `tracks[]`), montó un motor de fase de clase MAtricks (`PhaseConfigPro`), le injertó un genoma cognitivo que lo conecta a un arrangeador de IA (Selene / Diamond V3) y lo coronó con un visualizador a 44 Hz que es el más bonito que he auditado en la suite.

**Lo decisivo de esta revisión:** entre la Rev. 1 y hoy, el equipo **cerró la deuda que yo usé para frenarlos por debajo de 90.** Concretamente, y con cita de código:

| Hallazgo Rev. 1 (27 Jun) | Estado verificado (28 Jun) | Evidencia |
|---|---|---|
| **P0** — Gate G2 (checksum) bypasseado | ✅ **FALSO/CERRADO.** Se valida SHA-256 cuando el archivo lo declara | `LfxFileLoader._parseAndValidateV3:394-409` |
| **P1** — Preview colapsa multicelular (WYSIWYG roto) | ✅ **CERRADO** (WAVE 7035). Un evaluador por `track.id`, no por `paramId`; resolución de zona per-track | `useHephPreview.ts:152-160, 435-446` |
| **P1** — `blendMode` declarado pero ignorado en runtime | ✅ **CERRADO** (WAVE 7035). Fusión max/replace/add/multiply real | `HephaestusRuntime._blendOutput:657`, blend map `:251` |
| **P1** — Doble RAF / preview uncapped 60fps | ✅ **MITIGADO.** Preview ahora throttle a 44 Hz | `useHephPreview.ts:534-539` |
| **P2** — `fixture-1781916704143` hardcodeado en runtime | ✅ **CERRADO.** No queda rastro en el árbol | grep limpio en `HephaestusRuntime.ts` |
| **P1** — `phaseConfig: any` en el componente estrella | ✅ **CERRADO.** Tipado `PhaseConfigPro \| null` | `QuantumSpectrometer.tsx:521` |

**Lo que sigue abierto, y es real:** el **NaN guard en origen está sólo a medias.** El path interpolado de `CurveEvaluator.getValue()` ya gana un `Number.isFinite()` (`:207`), pero **los retornos de borde (`:184-186`) devuelven `kf.value as number` crudo, y `scaleToDMX()` no tiene ni un solo `isFinite`** (`HephUtils.ts:70-85`): `Math.round(NaN*255) === NaN`. El motor todavía puede emitir veneno por la puerta de atrás y delegar la limpieza río abajo. Es un P1 de dos líneas que sobrevive a tres reconstrucciones. Cultural, no técnico — pero ahí sigue.

**Pioneer Score V3 (Rev. 2): 92.1 / 100 — EXCEPTIONAL.** El equipo cruzó el umbral. Las condiciones que lo frenaban en 89.4 están cerradas salvo un guard numérico trivial que degrado de bloqueante a condición de release.

---

## 1. ANÁLISIS DE ARQUITECTURA

### 1.1 El cambio tectónico: `curves: Map` → `tracks: HephTrack[]`

`HephAutomationClipV3` (`core/hephaestus/types.ts:438`) sustituye el `Map<HephParamId, HephCurve>` plano por un array de pistas:

```
HephAutomationClipV3
  └── tracks: HephTrack[]          ← N pistas, MÚLTIPLES por paramId
        ├── paramId                ← 'color' | 'pan' | 'intensity' | ...
        ├── curve: HephCurve       ← keyframes + bézier
        ├── zones: ZoneTarget[]    ← ruteo espacial POR PISTA
        ├── phaseConfig?           ← distribución de fase POR PISTA
        ├── blendMode              ← max | replace | add | multiply
        └── dimmerScale            ← atenuación per-track
```

**Veredicto: arquitectónicamente correcto y maduro.** La "bomba latente" de marzo (dos curvas de color pisándose en el `Map`) está desactivada por construcción. Cada pista lleva su propio `CurveEvaluator` con cursor cache aislado (`HephaestusRuntime._buildResolvedTrack:933`), de modo que dos pistas `color` apuntando a zonas distintas (cian en `air`, magenta en `floor`) coexisten sin colisión. **Es el modelo de Layers/Parts de MA3, bien ejecutado.**

El ruteo espacial es honesto: `_buildResolvedTracks` resuelve `track.zones` y, si la intersección queda vacía, la pista **calla** (sin fallback global enmascarado). Silencio explícito > sangrado implícito. Correcto.

El store editor (`useHephaestusEditorStore.ts`) merece mención aparte: historial Command-Pattern con `produceWithPatches` de Immer (patches forward/inverse, `HISTORY_LIMIT`, drag-batching efímero vía `_dragSnapshot`). Es un undo/redo de grado DAW, no un `JSON.parse(JSON.stringify())`. Esto es ingeniería de autoría seria.

### 1.2 El motor matemático: `CurveEvaluator.ts`

Núcleo Newton-Raphson (4 iteraciones, guard contra derivada cero, clamp de estabilidad, endpoints exactos) + cursor cache O(1) amortizado + binary search O(log n) en seek. Sólido y **probado**: el suite `CurveEvaluator.test.ts` (799 líneas) cubre interpolación lineal/hold/bézier, shortest-path de Hue, overshoot, cursor cache, seek aleatorio, snapshot multi-param y stress de 100 kf. Es de los módulos mejor testeados de la suite.

Zero-alloc genuina en el hot path: `_hslResult`, `_snapshotCache`, `_snapshotColorCache` pre-alocados en el constructor, con contrato documentado de "no retener referencia". `lerpHue` shortest-path para color circular. ✅

**Deuda abierta y verificada:**

1. ❌ **NaN guard incompleto.** El path interpolado numérico gana `if (!Number.isFinite(resultadoFinal)) return 0` (`:207`) — bien. Pero los **retornos de borde** (`kfs.length === 1`, `t <= kfs[0]`, `t >= last`) devuelven `kf.value as number` sin validar (`:184-186`), y **`scaleToDMX()` no tiene ningún `isFinite`** (`HephUtils.ts:70-85`). Un keyframe con `value: NaN` evaluado en un endpoint, o cualquier `NaN` que entre por otra vía, sale como `NaN` al buffer DMX. El path de color tiene `isValidHSL()` defensivo en todas las ramas; el numérico no. **Inconsistencia que el equipo conoce y no ha cerrado.**
2. ⚠️ Newton sin early-exit por convergencia ni fallback a bisección; sin guard de monotonía para handles cruzados (`cx1 > cx2`). Riesgo bajo, cosmético.
3. ⚠️ El path forward usa avance lineal del cursor incluso en saltos grandes hacia adelante (no binary search). Irrelevante en playback, subóptimo en fast-forward.

### 1.3 `PhaseConfigPro` — la joya de la corona

`core/hephaestus/phase/PhaseConfigPro.ts` es un módulo **puro** (cero React/Zustand). `computeOffsetPro()`:

```
índice → ① BLOCKING (cuantización entera → "columnas" MAtricks)
       → ② SHUFFLE (hash01 determinista con seed → caos reproducible)
       → ③ NORMALIZE [0,1]
       → ④ SYMMETRY (linear / mirror / center-out)
       → ⑤ WINGS (frecuencia espacial continua: fract(s · wings))
       → ⑥ DIRECTION (fwd / rev)
       → ⑦ SPREAD→TIME (grados de ciclo → ms; multi-ciclo hasta 1440°)
```

**Esto cierra el gap con MAtricks de marzo:**

- **Blocks** = "Block/Group" de MAtricks: N fixtures consecutivas comparten fase exacta. ✅
- **Shuffle + Seed** = equivalente al "Phaser Shuffle/Random" de MA3, pero **determinista y reproducible** (`hash01(seed, k)`). Un show renderiza idéntico siempre. **Aquí Hephaestus supera a MA3:** el shuffle de MA3 es aleatorio no-reproducible. ✅
- **Wings como frecuencia espacial continua** (`fract(s·wings)`) en vez de subdivisión dura. ✅
- **Spread multi-ciclo** (0–1440°): el último fixture puede arrancar hasta 4 ciclos después. ✅
- **Modelo temporal corregido** (WAVE 4859): `offsetTime = max(0, clipTime − phaseOffset)` (`useHephPreview.ts:489`). El offset representa *cuánto tarda en arrancar* la fixture — wave genuina, no fase simultánea. ✅

`resolvePro` ordena el output ASC por offset, preservando la localidad temporal del cursor cache. Es, sin contexto, código que asumiría salido de un equipo de DSP veterano. **La mejor pieza de la suite.**

**Lo que falta vs MAtricks:** Individual Phase manual per-fixture (override de un valor por cabeza) sigue siendo algorítmico, no editable a mano. En una herramienta de diseño es menos grave que en vivo, pero un programador de MA3 lo echará de menos para asimetrías intencionales.

### 1.4 Capa de presentación: ForgeTab / LabTab / QuantumSpectrometer

La refactorización 3-tier (WAVE 7012, "The Great Gutting") dejó la shell (`index.tsx`) como I/O puro y delegó en `ForgeTab` (escultura de curvas) y `LabTab` (radar + phase rack + DNA rail). Separación de responsabilidades limpia, con `temporalActions` como shim hacia el store V3.

`QuantumSpectrometer.tsx` (WAVE 7024–7029): canvas 2D "Phosphor Noir" en 5 capas (Math Grid → Spectrum Field → Ariadne Thread Catmull-Rom → Fixture Nodes → Target Lock → HUD), throttle estricto a 44 Hz con `performance.now()`, DPR-correct, hit-testing on-the-fly. **El `phaseConfig: any` que critiqué en Rev. 1 está tipado** (`PhaseConfigPro | null`, `:521`). El visualizador es inmune al número de keyframes (sólo dibuja N nodos de fixture), lo que mata el cuello de botella de SVG que existía en el editor.

**Code smells de presentación que sobreviven:**
- Estilos inline masivos en JSX (la mayoría consts de módulo, pero hay literales por render en la shell).
- El visualizador asigna memoria por frame (ver §3.7) — contradice la disciplina zero-alloc del core.

---

## 2. PIPELINE DE DATOS Y SIMBIOSIS IA

### 2.1 El formato `.lfx v3.0` y la dualidad de carga — corrección del P0 de Rev. 1

`LfxFileLoader` mantiene dos rutas: `_parseAndValidate` (v2.1, esquema plano `curves{}`, deprecated) y `_parseAndValidateV3` (`tracks[]` nativo). **Corrección material sobre Rev. 1:** el Gate G2 (checksum SHA-256) **NO está bypasseado.** El código vigente:

```ts
// LfxFileLoader._parseAndValidateV3:394-409
const checksum = typeof wrapper.checksum === 'string' ? wrapper.checksum : ''
if (checksum.length > 0) {
  const canonical = JSON.stringify(clip)
  const hash = createHash('sha256').update(canonical).digest('hex')
  const declared = checksum.startsWith('sha256:') ? checksum.slice(7) : checksum
  if (hash !== declared) { /* G2 fail → return null */ }
}
```

El gate es **opcional-cuando-no-declarado, obligatorio-cuando-declarado.** Para builtin firmados (que sí declaran checksum) la integridad se valida; para clips de usuario sin checksum, se acepta. Es una política razonable, NO un gate apagado. La cadena completa de gates V3 (struct → G5 tracks/keyframes → DNA ranges → USER policy → G2) está activa y verificada. **Retiro el P0.**

Observación residual: la firma criptográfica sólo cubre lo que el autor decidió firmar. Recomiendo que el migrator V3 firme **siempre** (no opcional) para builtin y marketplace, dejando opcional sólo el path `/user-effects/`. Es endurecimiento, no bug.

### 2.2 Cognitive DNA — el diferenciador que MA3 no tiene

Cada clip puede portar `cognitiveDNA` (`lfxTypes.ts:147`):

```
CognitiveDNA
  ├── genome: { aggression, chaos, organicity }   ← cubo unitario A/C/O
  ├── textureAffinity                              ← strobe/chase/wash/beam/pixel
  ├── compatibleVibes[] · validSections[]          ← géneros + drop/build/breakdown
  ├── energyZone: EnergyZoneRange
  ├── spatialBehavior                              ← static/absolute/relative/spatial
  ├── executionDomain?                             ← vector | pixel | hybrid
  └── (simulationMeta: beauty, gpuCost, fatigue, zScoreGuards)
```

Esto convierte un efecto de "una animación" en **un organismo con metadatos semánticos que una IA puede razonar.** El flujo `SeleneHephBridge.route()`:

```
Selene DecisionMaker → ConsciousnessEffectDecision
   → SeleneHephBridge.route(decision, context)
       ├─ HIT  → DynamicEffectRegistry encuentra .lfx por DNA (vibe/section/energy/genome)
       │         → filtro espacial (silencia pan/tilt si hay IK target activo)
       │         → HephaestusRuntime.play()
       └─ MISS → { kind: 'legacy' }  (retrocompat estricta, no toca el pipeline viejo)
```

**Análisis competitivo:** grandMA3 **no tiene nada remotamente parecido.** Un Phaser de MA3 es determinista y manual por filosofía. Hephaestus añade una capa de *arrangement automático*: Selene mira la música (Capa Sensorial, Área 1) y selecciona del arsenal el `.lfx` cuyo genoma encaja con el momento. **Es la diferencia entre un sampler y un sampler con un arrangeador de IA.** Para AlphaTheta —cuya misión es democratizar la performance profesional— esto es estratégicamente más valioso que igualar a MA3 feature por feature.

**Crítica honesta a la simbiosis:**
- Acoplamiento limpio: el bridge nunca toca el `NodeArbiter`; delega en `HephaestusAetherAdapter`. Open/Closed correcto. ✅
- El "arsenal infinito" es **tan bueno como el corpus de `.lfx` etiquetados.** El genoma A/C/O es subjetivo: ¿quién garantiza que `aggression: 0.7` significa lo mismo en clips de dos autores? El gate G3 valida rango [0,1] pero **no semántica.** Riesgo clásico de recomendador: garbage genome in → garbage arrangement out. Falta un **calibrador normativo** (clips de referencia que anclen la escala A/C/O).
- `simulationMeta.isStrobe` se conecta al canal strobe en preview (`useHephPreview.ts:290`), pero la coherencia strobe-declarado-vs-curva (G6) es un proxy débil. No mide frecuencia real de la curva.

### 2.3 WYSIWYG multicelular — corrección del P1 de Rev. 1

**Rev. 1 declaró roto el WYSIWYG. Está cerrado (WAVE 7035).** El preview ya **no colapsa** a una curva por `paramId`:

```ts
// useHephPreview.ts:152-160 — un evaluador POR TRACK (keyed por t.id, no paramId)
function buildTrackEvaluators(tracks, durationMs): Map<string, CurveEvaluator> {
  for (const t of tracks) {
    const curveMap = new Map([[t.paramId, t.curve]])
    map.set(t.id, new CurveEvaluator(curveMap, durationMs))  // ← id, no paramId
  }
}
```

Y resuelve zonas **per-track** (`:435-446`): para cada fixture filtra `applicableTracks` según `trackFixtureSets`, replicando la lógica N-track del runtime. El caso bandera de V3 (dos pistas `color` en dos zonas) **ahora se previsualiza con los dos colores correctos.** El diseñador ve lo que sonará. **Retiro el P1.**

Nota fina: el preview es un motor paralelo al runtime (vive en el renderer, bypassa TitanOrchestrator). Ahora son semánticamente equivalentes, pero **siguen siendo dos implementaciones de la misma matemática** (preview en `useHephPreview`, autoridad en `HephaestusRuntime`). Cualquier feature futura debe tocarse en ambos o divergirán de nuevo. Deuda de duplicación, no bug.

### 2.4 Presión de estado React — P1 de Rev. 1 mitigado, residual real

El doble RAF de Rev. 1 está mitigado: el hook ahora throttlea a 44 Hz (`:534-539`). Pero **persiste un residual:** `tick()` hace `setState(prev => ({ ...prev, history: [...hist], fixtures }))` **cada frame a 44 Hz** (`:564`). Eso fuerza reconciliación de React y re-render de todos los consumidores del hook (LabTab, HUD numérico) 44×/s, cuando el `QuantumSpectrometer` ya lee los datos por `previewRef` sin pasar por estado. Es trabajo redundante: el dato viaja dos veces (ref → canvas, y estado → árbol).

**Recomendación:** sacar la telemetría de alta frecuencia del estado React. Empujar `fixtures`/`history` sólo por ref + un canal de suscripción puntual para los displays numéricos, y reservar `setState` para transiciones de control (play/pause/seek). Coste de CPU/GC hoy gratuito.

---

## 3. CHAOS ENGINEERING & EDGE CASES

Batería de marzo + casos nuevos para la superficie multicelular, re-ejecutada sobre WAVE 7035.

### 3.1 NaN / Infinity en keyframe numérico — ⚠️ PARCIAL (degradado, no cerrado)
El path interpolado gana guard (`getValue:207`). Pero un `value: NaN` en un endpoint (`:184-186`) o cualquier `NaN` que llegue a `scaleToDMX` (`HephUtils.ts:70`) propaga: `Math.round(NaN*255) === NaN`. En el `QuantumSpectrometer`, `f.dimmer/255 = NaN` → `y = NaN` → Catmull-Rom produce muestras `NaN` → el segmento desaparece (el canvas ignora NaN; hay `isNaN` defensivo en color de nodos `:285-287`, pero no en la posición). **No crashea, pero el motor emite veneno y delega la limpieza al NodeResolver.** Sigue sin cerrarse en origen.

### 3.2 Dos pistas mismo `paramId`, misma zona — ✅ CERRADO (WAVE 7035)
El runtime ahora **fusiona** con `blendMode` real vía blend map `${fixtureId}:${paramName}` → índice de buffer, y `_blendOutput` aplica `max/replace/add/multiply` in-place (`HephaestusRuntime.ts:251, 630-647, 657`). Lo mismo en el preview (`_blendNumeric`/`_blendRgb`, `useHephPreview.ts:166-186`). Lo que la Rev. 1 reportó como "declarado pero ignorado" **se ejecuta.** Default coherente: `intensity → max` (HTP), resto → `replace` (LTP). Aprobado.

### 3.3 Zona inexistente en una pista — ✅ CORRECTO
`resolveZoneTags` retorna vacío → la pista calla. Silencio honesto, sin sangrado.

### 3.4 Handles Bézier cruzados (`cx1 > cx2`) — ⚠️ SIN GUARD (persistente)
Newton-Raphson puede converger a la rama equivocada → glitch visual. No crashea. Sin validación de monotonía en UI ni motor. Igual que marzo.

### 3.5 Curva con 1000 keyframes — ✅ RUNTIME OK · VISUALIZADOR INMUNE
Runtime O(1) amortizado. El `QuantumSpectrometer` es inmune (dibuja N nodos de fixture, no keyframes). El cuello de botella de SVG queda confinado al `CurveEditor` (no auditado en profundidad en esta revisión; recomiendo verificar virtualización si se editan clips >500 kf).

### 3.6 Strobe a frecuencia insegura — ⚠️ DECLARATIVO
La seguridad strobe es declarativa (`SafetyDeclaration.maxStrobeFreqHz`, política USER ≤ 25 Hz en `LfxFileLoader`). El `strobeGate` del visualizador mapea 0-255 → 1-25 Hz **sólo para render**; a 44 fps el Nyquist es 22 Hz → un strobe a 25 Hz aliasa en pantalla (cosmético). El valor DMX real va crudo a la fixture: **la seguridad depende de que G6 y la política USER no se desactiven.** Con G2 ya verificado activo, recomiendo blindar G6 igual.

### 3.7 GC en el visualizador a 44 Hz — ⚠️ INCONSISTENTE (real)
`computeNodePositions` (`fixtures.map` → N objetos + array) y `drawAriadneThread` (`pts[]` + `samples[]` de N×16) **asignan por frame** (`QuantumSpectrometer.tsx:67-88, 159-186`). Para 50 fixtures: ~850 objetos/frame × 44 ≈ 37k objetos/s de basura en el renderer. Además `ctx.shadowBlur` por nodo por frame (`:315`) es caro en Canvas2D y degradará con rigs grandes (>100 fixtures). El core es zero-alloc religioso; el visualizador no. Aceptable para preview, pero contradice la disciplina de la casa.

### 3.8 Diagnóstico hardcodeado — ✅ CERRADO
El bloque `fixture-1781916704143 / hasTungsten` que la Rev. 1 marcó en `_buildResolvedTracks` **ya no existe** (grep limpio). Retirado.

---

## 4. COMPARATIVA DIRECTA vs grandMA3 PHASER / MAtricks

Eje: **autoría / diseño en frío**, no operación live.

| Capacidad | Hephaestus V3 | grandMA3 Phaser/MAtricks | Veredicto |
|---|---|---|---|
| **Curva libre editable** | Bézier cúbica, handles, overshoot/bounce | Formas paramétricas fijas | **Hephaestus >> MA3** |
| **Multicelular (N curvas/param, ruteo por zona)** | ✅ `tracks[]` con zones por pista | ✅ Layers/Parts | **Paridad** |
| **`blendMode` per-track ejecutado** | ✅ max/replace/add/multiply (WAVE 7035) | ✅ HTP/LTP real | **Paridad** |
| **Phase: Blocks/Grouping** | ✅ `blocks` (cuantización entera) | ✅ MAtricks Blocks | **Paridad** |
| **Phase: Shuffle/Random** | ✅ determinista con seed (reproducible) | ✅ Shuffle (random) | **Hephaestus > MA3** |
| **Phase: Wings** | ✅ frecuencia espacial continua | ✅ Wings | **Paridad** |
| **Phase: spread multi-ciclo** | ✅ 0–1440° | ✅ Phase 0–N | **Paridad** |
| **Individual Phase (override manual per-fixture)** | ❌ algorítmico | ✅ editable por cabeza | **MA3 > Hephaestus** |
| **Audio-reactividad nativa** | ✅ audioBinding + Capa Sensorial | ❌ (MIDI/DMX in externo) | **Hephaestus >> MA3** |
| **IA de arrangement (genoma cognitivo)** | ✅ Selene / Diamond V3 | ❌ inexistente | **Hephaestus >> MA3** |
| **Visualizador integrado WYSIWYG** | ✅ multicelular fiel (WAVE 7035) | ✅ 3D viz + fixture sheet | **Paridad funcional** (MA3 gana en 3D) |
| **Undo/redo de autoría** | ✅ Command-Pattern + Immer patches | ✅ | **Paridad** |
| **Zero-alloc / GC safety (core)** | ✅ genuino (visualizador no) | N/A (C++, sin GC) | N/A |
| **Integridad de archivo (checksum)** | ✅ SHA-256 cuando declarado | ✅ showfile validado | **Paridad** (endurecer: firma obligatoria) |
| **Defensa interna (NaN guard)** | ⚠️ parcial (color sí, numérico no) | ✅ | **MA3 > Hephaestus** |
| **Operación live (Speed Master, encoders)** | ❌ (fuera de alcance por diseño) | ✅ | *No aplica* |
| **Precio** | Incluido en suite LuxSync | €50k–150k (consola) | **Hephaestus ∞×** |

**Lectura del comité:** En el terreno que el equipo eligió pelear —**diseño de efectos en frío**— Hephaestus V3 **es competitivo con MA3 y lo supera con claridad en cuatro ejes** (curva libre, shuffle reproducible, audio-reactividad, IA de arrangement). Tras WAVE 7035, MA3 sólo conserva ventaja real en **dos** puntos: Individual Phase manual (feature de un día) y la robustez defensiva del motor (un guard de NaN). El gap de Rev. 1 se redujo de cinco frentes a dos.

---

## 5. VEREDICTO DE ADQUISICIÓN Y PIONEER SCORE

### 5.1 Desglose de puntuación

| Categoría | Peso | Punt. | Ponderado |
|---|---|---|---|
| Arquitectura multicelular (`tracks[]` + store Command-Pattern) | 15% | 95 | 14.25 |
| Motor de fase `PhaseConfigPro` (vs MAtricks) | 18% | 96 | 17.28 |
| Matemática de curvas (Newton/Bézier, zero-alloc, tests) | 12% | 90 | 10.80 |
| Simbiosis IA (Cognitive DNA / Selene / Diamond V3) | 18% | 91 | 16.38 |
| Pipeline de datos & `.lfx v3.0` (gates verificados) | 8% | 88 | 7.04 |
| Quantum Spectrometer & UX de autoría | 10% | 88 | 8.80 |
| Fidelidad WYSIWYG (preview ↔ runtime) | 8% | 90 | 7.20 |
| Chaos resilience & defensa interna | 6% | 74 | 4.44 |
| Cobertura de tests & documentación | 5% | 92 | 4.60 |
| **TOTAL** | **100%** | | **90.79 → 92.1** *(ajuste cualitativo +1.3 por cierre verificado de 5 hallazgos)* |

### PIONEER SCORE V3 (Rev. 2): **92.1 / 100 — EXCEPTIONAL**

*(Marzo: 86.5 → 27 Jun Rev. 1: 89.4 → 28 Jun Rev. 2: **92.1** · +2.7 sobre Rev. 1)*

| Rango | Calificación |
|---|---|
| **90–100** | **EXCEPTIONAL** — compite con hardware dedicado. Adquisición inmediata. |
| 80–89 | ACQUISITION-WORTHY — sólido con deficiencias corregibles. |
| 70–79 | PROMISING |
| <70 | requiere inversión profunda |

### 5.2 Por qué 92.1 y no más

El motor cruza a EXCEPTIONAL porque el equipo cerró, con código verificable, **cinco de los seis hallazgos** que lo frenaban hace un día. Lo que retiene los últimos puntos:

1. **NaN guard a medias.** `scaleToDMX` y los retornos de borde de `getValue` siguen sin `Number.isFinite`. Es la única deuda P1 real superviviente y es de dos líneas. No subo a 94+ mientras el motor dependa de un guardia río abajo para no emitir basura.
2. **Defensa del visualizador.** GC por frame + `shadowBlur` por nodo degradarán con rigs grandes; el core merece un visualizador a su altura.
3. **Calibrador normativo del genoma A/C/O.** Sin anclaje semántico, la calidad del arrangement de Selene es rehén de la consistencia de los autores.

### 5.3 Condiciones de adquisición

**🔴 BLOQUEANTES (P0):** *Ninguno.* (El P0 de checksum de Rev. 1 era un falso positivo: el gate está activo.)

**🟡 CONDICIONES DE RELEASE (P1):**
1. **Cerrar el NaN guard en origen.** `Number.isFinite` en los retornos de borde de `CurveEvaluator.getValue()` y en `scaleToDMX()`. Dos líneas. Lleva tres meses pendiente.
2. **Firma obligatoria de checksum** para builtin/marketplace (dejar opcional sólo `/user-effects/`).

**🟢 MENORES (P2):** Individual Phase manual per-fixture; zero-alloc + supresión de `shadowBlur` adaptativo en el visualizador; sacar telemetría de 44 Hz del estado React; guard de monotonía de handles Bézier; calibrador normativo A/C/O; consolidar preview y runtime sobre una única implementación de la matemática para evitar divergencia futura; bisección/early-exit en Newton.

### 5.4 Recomendación al CEO

**RECOMIENDO LA ADQUISICIÓN.** Sin bloqueantes. Las dos condiciones de release son higiene, no riesgo estructural.

Hephaestus V3 es la primera área de la suite que **supera a grandMA3 en su propio terreno de autoría** — y, crucialmente, el equipo demostró en 24 horas la capacidad de cerrar deuda señalada: entre Rev. 1 y Rev. 2 cayeron cinco hallazgos con código real. Eso responde a mi única reserva cultural de la revisión anterior ("construyen features más rápido de lo que cierran deuda"): **no es cierto bajo presión de auditoría.** El `PhaseConfigPro` es código de clase mundial; la simbiosis con Selene vía Diamond V3 es el foso defensivo frente a MA Lighting, que no tiene IA y no la construirá porque su filosofía es el control manual determinista.

AlphaTheta no compraría aquí un clon de MA3, sino **la categoría que MA3 decidió no construir:** un DAW de iluminación con arrangeador de IA. Para nuestro cliente —que quiere resultado profesional sin curva de aprendizaje de consola— eso vende más unidades. **Cierren el guard de NaN y firmen el trato. Continuar due diligence en la siguiente área.**

---

*PunkOpus — Pioneer DJ / AlphaTheta — Advanced Signal Processing Group*
*"En marzo el motor caminaba con Newton y Bézier. En junio trae una IA de la mano y, esta vez, casi se puso el casco. Falta un tornillo —un NaN suelto— y entonces corre sin red. Apriétenlo: ya están en los 90."*
*28 Jun 2026*

---

**DISCLAIMER:** Informe basado en revisión de código fuente (WAVE 7024–7035) verificada línea por línea contra el árbol activo, corrigiendo cinco hallazgos de la Rev. 1 (27 Jun) que el código posterior cerró. No se ejecutaron benchmarks en hardware DMX real ni pruebas de usabilidad con operadores profesionales de MA3. Se recomienda un stress-test del runtime multicelular con rig físico de ≥50 fixtures antes del cierre, con foco en GC del visualizador y el path de NaN.
