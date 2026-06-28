# ⚒️ TECHNICAL DUE DILIGENCE REPORT — HEPHAESTUS V3

**Clasificación:** CONFIDENCIAL — Comité de Adquisiciones AlphaTheta
**Auditor:** PunkOpus — Chief DSP Auditor & Acquisition Veteran
**División:** Pioneer DJ / AlphaTheta — Advanced Signal Processing Group
**Producto:** LuxSync — Hephaestus V3 (Motor de Efectos Paramétricos · Área 2 de 7)
**Benchmark:** grandMA3 Phaser / MAtricks (MA Lighting)
**Fecha:** 27 de Junio de 2026
**Base de código:** WAVE 7024–7029 (activo)
**Auditoría previa:** `HEPHAESTUS-ENGINE-AUDIT.md` (11 Mar 2026 — Pioneer Score 86.5) — *obsoleta, usada solo como mapa anatómico.*

> **NOTA DE ALCANCE (corrección de premisa):** El equipo de LuxSync declara explícitamente que Hephaestus V3 es una herramienta de trabajo **en frío** (preshow / pre-programación), NO un controlador de performance en vivo. Esta auditoría **deja de penalizar la ausencia de Speed Master / control live como defecto** y reencuadra la comparación: ya no evaluamos "¿reemplaza a una consola en el escenario?", sino "¿es la mejor mesa de diseño de efectos de la industria?". El benchmark MA3 se mantiene, pero el eje de comparación se desplaza de *operación* a *autoría*.

---

## 0. RESUMEN EJECUTIVO

Hace tres meses dije que Hephaestus era un Tesla con Autopilot frente al Ferrari manual de MA3. El equipo escuchó, pero hizo algo más interesante que añadir un volante: **reconstruyó el chasis.** Hephaestus V3 ya no es "un editor de curvas con distribución de fase". Es una arquitectura multicelular (`tracks[]`) con un motor de fase de clase MAtricks (`PhaseConfigPro`), un genoma cognitivo que lo conecta a una IA arrangeadora (Selene / Diamond V3), y un visualizador a 44 Hz que es, francamente, el más bonito que he auditado en siete áreas.

**El salto es real.** Tres de las cuatro carencias estructurales que señalé en marzo están cerradas:

| Hallazgo Marzo 2026 | Estado V3 |
|---|---|
| Bomba latente "una curva por paramId" (§4.1) | ✅ **ELIMINADA** — esquema `tracks[]` multicelular |
| Wings sin offset / fase pobre vs MA3 | ✅ **SUPERADA** — `PhaseConfigPro`: Blocks, Shuffle determinista, Wings como frecuencia espacial, spread multi-ciclo |
| Modelo de fase invertido (offset sumado) | ✅ **CORREGIDO** (WAVE 4859) — offset restado, wave genuina MA3 |
| `hslToRgb` asignaba objeto por frame | ✅ **CORREGIDO** (WAVE 4830/4995) — slots RGB pre-alocados |

**Pero el pecado capital sigue ahí.** El guard de NaN en el path numérico —el hallazgo P1 más serio de marzo— **NO se ha corregido en tres meses.** `getValue()` y `scaleToDMX()` siguen propagando `NaN` silenciosamente. Lo cubre un cinturón de seguridad río abajo (NodeResolver), pero el motor **sigue sin defenderse a sí mismo**. Que un P1 trivial de una línea sobreviva tres ciclos de reconstrucción es un dato cultural, no técnico.

Y la reconstrucción introdujo **una grieta nueva**: el motor de *preview* colapsa la arquitectura multicelular a semántica v2.1, rompiendo el WYSIWYG en el escenario exacto donde V3 presume su ventaja.

**Pioneer Score V3: 89.4 / 100 — ACQUISITION-WORTHY (a un decimal de EXCEPTIONAL).**

---

## 1. ANÁLISIS DE ARQUITECTURA

### 1.1 El cambio tectónico: `curves: Map` → `tracks: HephTrack[]`

El corazón de V3 (`core/hephaestus/types.ts` · `HephAutomationClipV3`) sustituye el `Map<HephParamId, HephCurve>` plano por un array de pistas:

```
HephAutomationClipV3
  └── tracks: HephTrack[]          ← N pistas, MÚLTIPLES por paramId
        ├── paramId                ← 'color', 'pan', 'intensity'...
        ├── curve: HephCurve       ← keyframes + bezier
        ├── zones: ZoneTarget[]    ← ruteo espacial POR PISTA
        ├── phaseConfig?           ← distribución de fase POR PISTA
        └── blendMode              ← HTP / replace / add / multiply
```

**Veredicto: arquitectónicamente correcto y maduro.** En marzo señalé una "bomba de relojería latente": dos curvas de color en el mismo clip se pisaban porque el `Map` sólo admitía una entrada por `paramId`. V3 la desactiva **por construcción**. Cada pista lleva su propio `CurveEvaluator` con cursor cache aislado (`HephaestusRuntime._buildResolvedTrack`), de modo que dos pistas `color` apuntando a dos zonas distintas (ej. `air` en cian, `floor` en magenta) coexisten sin colisión. **Esto es exactamente el modelo de "Layers" de MA3 — y está bien ejecutado.**

El ruteo espacial es honesto: `_buildResolvedTracks` resuelve `track.zones` vía `resolveZoneTags` con AND-intersección, y si la intersección queda vacía **la pista calla** (sin fallback global enmascarado). Es la decisión correcta — el silencio explícito es mejor que el sangrado implícito.

### 1.2 El motor matemático: `CurveEvaluator.ts` (sin cambios sustanciales)

El núcleo Newton-Raphson + cursor cache O(1) amortizado + binary search O(log n) **se mantiene intacto desde marzo.** Sigue siendo sólido:

- Newton-Raphson 4 iteraciones, guard contra derivada cero, clamp de estabilidad, endpoints exactos. ✅
- Zero-allocation genuina en el hot path (buffers `_hslResult`, `_snapshotCache` pre-alocados). ✅
- `lerpHue` shortest-path para color circular. ✅

**Lo que NO se tocó (deuda heredada de marzo, todavía abierta):**

1. ❌ **NaN guard numérico ausente.** `CurveEvaluator.getValue()` (línea ~171) retorna `kf.value as number` e interpola sin un solo `Number.isFinite()`. `HephUtils.scaleToDMX()` hace `Math.max(0, Math.min(1, NaN)) === NaN → Math.round(NaN*255) === NaN`. El path de color tiene `isValidHSL()`; el numérico **sigue desnudo, tres meses después.** Mitigado río abajo por el `safeDmxValue` del NodeResolver, pero el motor emite basura y delega su limpieza. Inaceptable para un P1 de una línea.
2. ⚠️ Newton sin early-exit por convergencia ni fallback a bisección ni guard de monotonía en handles cruzados (`cx1 > cx2`). Cosmético, riesgo bajo, pero sigue en la lista desde marzo.
3. ⚠️ El cursor forward sigue usando el path lineal en saltos grandes hacia adelante en lugar de binary search. Irrelevante en playback, ineficiente en seek.

### 1.3 `PhaseConfigPro` — la joya de V3

Aquí es donde el equipo se ganó el sueldo. `core/hephaestus/phase/PhaseConfigPro.ts` es un módulo puro (cero React/Zustand) que implementa distribución de fase de grado militar. La cadena de transformación en `computeOffsetPro()` es elegante:

```
índice → ① BLOCKING (cuantización entera, "columnas" MAtricks)
       → ② SHUFFLE (hash determinista seed → caos reproducible)
       → ③ NORMALIZE [0,1]
       → ④ SYMMETRY (linear / mirror / center-out)
       → ⑤ WINGS (frecuencia espacial: fract(s · wings))
       → ⑥ DIRECTION (fwd / rev)
       → ⑦ SPREAD→TIME (grados de ciclo → ms, multi-ciclo hasta 1440°)
```

**Esto cierra el gap con MAtricks que abrí en marzo:**

- **Blocks** = el "Block/Group" de MAtricks: N fixtures consecutivas comparten fase exacta (efecto escalera/columnas). ✅ Antes inexistente.
- **Shuffle + Seed** = el equivalente del "Phaser Shuffle/Random" de MA3, pero **determinista y reproducible** (hash01 con semilla). Un show renderiza idéntico siempre. ✅ Antes inexistente.
- **Wings como frecuencia espacial continua** (`fract(s · wings)`) en vez de subdivisión dura. Más expresivo que el wings de marzo. ✅
- **Spread en grados multi-ciclo** (0–1440°) = el último fixture puede arrancar hasta 4 ciclos después. ✅
- **Modelo temporal corregido** (WAVE 4859): `localElapsedMs = max(0, clipTime − offset)`. El offset ahora representa *cuánto tarda en arrancar* la fixture — wave genuina, no fase simultánea. **Esto era un bug visual real en marzo y está corregido.** ✅

La función es `static`, pura, ordena el output ASC por offset (preserva la localidad temporal del cursor cache). **Arquitectónicamente impecable.** Es, sin exagerar, la mejor pieza de código de las dos áreas que he auditado.

**Lo que falta vs MAtricks:** Individual Phase manual per-fixture (override de un valor por cabeza) sigue siendo algorítmico, no editable a mano. En una herramienta de diseño esto es menos grave que en vivo, pero un programador de MA3 lo echará de menos para asimetrías intencionales.

### 1.4 Capa de presentación: ForgeTab / LabTab / DnaRail

La refactorización 3-tier (WAVE 7008) separó la shell de los workspaces: `ForgeTab` (escultura de curvas, ~1600 LOC) y `LabTab` (radar + DNA + phase rack). Separación de responsabilidades correcta. `PhaseControls.tsx` (chasis Eurorack) expone `PhaseConfigPro` con cuatro faceplates neón — UX coherente y el mapeo de cada control a su concepto MAtricks es directo y honesto (incluso etiqueta "MAtricks Column Grouping" en el módulo Block).

**Code smells de presentación:**
- `phaseConfig?: any` en `QuantumSpectrometer` y `drawSpectrumField`. Erosión de tipos en el componente estrella. Inaceptable en una base que presume "código nativo, 0 dependencias".
- Estilos inline masivos en JSX (objetos `React.CSSProperties` recreados). La mayoría son consts de módulo, pero hay varios literales por render.

---

## 2. PIPELINE DE DATOS Y SIMBIOSIS IA

### 2.1 El formato `.lfx v3.0` y la dualidad de carga

El `LfxFileLoader` mantiene **dos rutas de parseo coexistentes**: `_parseAndValidate` (v2.1, esquema plano `curves{}`) y `_parseAndValidateV3` (`tracks[]` nativo). Es una transición pragmática, pero con dos observaciones:

1. ⚠️ **Gate G2 (checksum SHA-256) DESACTIVADO** (`WAVE 5020.5 — G2 BYPASSED`). El bloque de verificación de integridad está comentado "hasta producción". Hoy, un `.lfx` corrupto o manipulado entra sin validación de hash. **Para una suite que presume seguridad declarativa, un gate de integridad apagado es un hallazgo de auditoría.** Debe re-armarse antes de cualquier release.
2. El esquema v2.1 sigue vivo como deprecated. Deuda de migración aceptable mientras exista la librería heredada, pero es superficie de ataque y mantenimiento doble.

### 2.2 Cognitive DNA — el diferenciador que MA3 no tiene

Aquí está la tesis de adquisición. Cada clip puede portar un bloque `cognitiveDNA` (`lfxTypes.ts`):

```
CognitiveDNA
  ├── genome: { aggression, chaos, organicity }   ← cubo unitario A/C/O
  ├── textureAffinity                              ← afinidad de textura
  ├── compatibleVibes[]                            ← géneros/moods
  ├── validSections[]                              ← drop/build/breakdown
  ├── energyZone: EnergyZoneRange
  ├── spatialBehavior                              ← static/absolute/relative/spatial
  └── simulationMeta (beauty, gpuCost, fatigue, zScoreGuards)
```

Esto convierte un efecto de "una animación" en **un organismo con metadatos semánticos que una IA puede razonar.** El flujo `SeleneHephBridge.route()` es la columna vertebral:

```
Selene DecisionMaker → ConsciousnessEffectDecision
   → SeleneHephBridge.route(decision, context)
       ├─ HIT  → DynamicEffectRegistry encuentra .lfx compatible por DNA
       │         → filtro espacial (silencia pan/tilt si hay IK target activo)
       │         → playHook → HephaestusRuntime.play()
       └─ MISS → { kind: 'legacy' } (retrocompat estricta, no toca el pipeline viejo)
```

**Análisis competitivo:** grandMA3 **no tiene nada remotamente parecido.** Un Phaser de MA3 es determinista y manual por filosofía — el diseñador elige cada parámetro. Hephaestus añade una capa de *arrangement automático*: Selene mira la música (vía la Capa Sensorial, Área 1 = 88.8) y selecciona del "Infinite Arsenal" el `.lfx` cuyo genoma encaja con el momento musical. **Es la diferencia entre un sampler y un sampler con un arrangeador de IA.** Para Pioneer/AlphaTheta —cuya filosofía es democratizar la performance profesional— esto es estratégicamente más valioso que igualar a MA3 feature por feature.

**Crítica honesta a la simbiosis:**
- El acoplamiento es limpio (el bridge nunca toca el NodeArbiter; delega en `HephaestusAetherAdapter`). Buen diseño Open/Closed. ✅
- Pero el "arsenal infinito" es **tan bueno como el corpus de `.lfx` etiquetados.** El genoma A/C/O es subjetivo: ¿quién calibra que `aggression: 0.7` significa lo mismo en dos clips de autores distintos? Sin un calibrador normativo, la IA elige sobre etiquetas inconsistentes. El gate G3 valida rango [0,1] pero **no semántica.** Es el riesgo clásico de un sistema de recomendación: garbage genome in, garbage arrangement out.
- `simulationMeta.isStrobe` se conecta al canal strobe en preview (WAVE 7024) pero la coherencia strobe-declarado-vs-curva (G6) es un proxy débil ("intensity tiene ≥4 keyframes"). No mide frecuencia real.

### 2.3 La grieta nueva: el preview traiciona la arquitectura multicelular

**Este es mi hallazgo más importante de V3.** `useHephPreview.ts` es un motor de evaluación independiente (bypassa TitanOrchestrator, corre en el renderer). Para construir el evaluador hace:

```ts
function tracksToCurveMap(tracks) {
  for (const t of tracks)
    if (!map.has(t.paramId)) map.set(t.paramId, t.curve)  // ⚠️ COLAPSA
}
```

**El preview se queda con la PRIMERA pista de cada `paramId` y descarta el resto.** Es decir: el motor de runtime (`HephaestusRuntime`) evalúa correctamente las N pistas multicelulares, pero **el visualizador que el diseñador mira mientras trabaja colapsa el clip a semántica v2.1.** 

Consecuencia: un clip con dos pistas `color` (cian en `air`, magenta en `floor`) —el caso de uso bandera de V3— **se previsualiza con un solo color.** El WYSIWYG está roto exactamente donde V3 presume su ventaja arquitectónica. El diseñador autoriza a ciegas y descubre la verdad sólo al ejecutar en el runtime real. Para una herramienta de **diseño en frío**, romper el WYSIWYG es casi peor que romper el runtime. **P1.**

### 2.4 Doble RAF y presión de estado en React

`useHephPreview` corre un `requestAnimationFrame` **sin throttle a 44 Hz** (uncapped ~60fps) y hace `setState({... history: [...hist]})` **cada frame** — spread de array nuevo + reconciliación completa de React 60×/s. En paralelo, `QuantumSpectrometer` corre su **propio** RAF a 44 Hz leyendo `previewRef`. Hay **dos loops**: uno empuja datos por el árbol React a 60fps, otro pinta canvas a 44fps.

El canvas está bien aislado (lee por refs, deps `[]`, sin re-suscripción — patrón correcto). Pero el `setState` a 60fps del hook fuerza re-render de **todos** los consumidores (LabTab, DnaRail, HUD) cada frame. Es trabajo redundante: el dato ya viaja por ref al canvas; empujarlo *también* por estado React es un coste de CPU/GC gratuito. **Recomendación: throttle del hook a 44 Hz y mover la telemetría de alta frecuencia fuera del estado React (a un ref + suscripción puntual para los displays numéricos).**

---

## 3. CHAOS ENGINEERING & EDGE CASES

Repetí la batería de marzo contra V3 y añadí casos nuevos para la superficie multicelular.

### 3.1 NaN / Infinity en keyframe numérico — ❌ FALLA (persistente)
`value: NaN` → `getValue()` propaga → `scaleToDMX` propaga → buffer de output con `NaN`. En el QuantumSpectrometer, `f.dimmer/255 = NaN` → `y = NaN` → Catmull-Rom produce muestras `NaN` → el segmento desaparece silenciosamente (canvas ignora NaN). **No crashea, pero el motor emite veneno.** Sólo el NodeResolver río abajo lo neutraliza. **Sigue sin guard en origen tres meses después.**

### 3.2 Dos pistas mismo `paramId`, misma zona — ⚠️ DEPENDE
El runtime emite ambas por separado; la fusión real ocurre en el NodeArbiter (L3 dominance + LTP). El `blendMode` declarado por el autor **no se aplica en el runtime** (es forward-compat, "se conserva para cuando se introduzca blending real per-paramId"). Es decir: hoy el autor puede declarar `blendMode: 'add'` y **el runtime lo ignora** — gana el último write LTP. Gap entre la promesa del esquema y la ejecución. Honesto en los comentarios, pero el usuario no lo sabe.

### 3.3 Zona inexistente en una pista — ✅ CORRECTO
`resolveZoneTags` retorna vacío → la pista calla. Silencio honesto, sin sangrado. Aprobado.

### 3.4 Handles Bézier cruzados (`cx1 > cx2`) — ⚠️ SIN GUARD (persistente)
Newton-Raphson puede converger a la rama equivocada → glitch visual. No crashea. Sin validación de monotonía en UI ni motor. Igual que marzo.

### 3.5 Curva con 1000 keyframes — ⚠️ RUNTIME OK, EDITOR DEGRADA
El runtime sigue O(1) amortizado. El `CurveEditor` SVG sigue sin virtualización. El `QuantumSpectrometer` (canvas) **es inmune** al número de keyframes (sólo dibuja N nodos de fixtures, no keyframes) — mejora colateral del nuevo visualizador.

### 3.6 Strobe a frecuencia insegura — ⚠️ DECLARATIVO
El cap de 18 Hz (ISO 23539) que existía en `HephParameterOverlay` ya no gobierna el path principal V3. La seguridad strobe es ahora **declarativa** (`SafetyDeclaration.maxStrobeFreqHz`, política USER ≤ 25 Hz en `LfxFileLoader`). El `QuantumSpectrometer.strobeGate` mapea 0-255 → 1-25 Hz **sólo para visualización**, y a 44fps el Nyquist es 22 Hz → un strobe declarado a 25 Hz aliasa en el visualizador (cosmético). Pero el valor DMX real va crudo a la fixture: **la seguridad depende de que el gate G6 y la política USER no estén bypasseados.** Con G2 ya apagado, recomiendo auditar que G6 nunca se desactive.

### 3.7 GC en el visualizador a 44 Hz — ⚠️ INCONSISTENTE
`computeNodePositions` (`fixtures.map → N objetos + array`) y `drawAriadneThread` (`pts[]` + `samples[]` de N×16) **asignan por frame.** El núcleo del motor es zero-alloc religioso; el visualizador no. Para un rig de 50 fixtures: ~850 objetos/frame × 44 = ~37k objetos/s de basura en el renderer. Aceptable para preview, pero contradice la disciplina del core. Además `ctx.shadowBlur` por nodo por frame es caro en Canvas2D — degradará con rigs grandes (>100 fixtures).

### 3.8 Diagnóstico hardcodeado en producción — ❌ CODE SMELL
`_buildResolvedTracks` contiene un bloque de diagnóstico con un fixture ID literal:
```ts
const hasTungsten = fixtureIds.some(id => id === 'fixture-1781916704143')
if (hasTungsten) console.log(...)
```
Un ID de fixture específico de un escenario de desarrollo, hardcodeado en el path de resolución del runtime. Debe salir antes de release.

---

## 4. COMPARATIVA DIRECTA vs grandMA3 PHASER / MAtricks

Reencuadrada al eje correcto: **autoría/diseño**, no operación live.

| Capacidad | Hephaestus V3 | grandMA3 Phaser/MAtricks | Veredicto |
|---|---|---|---|
| **Curva libre editable** | Bézier cúbica, handles, overshoot/bounce | Formas paramétricas fijas | **Hephaestus >> MA3** |
| **Multicelular (N curvas/param, ruteo por zona)** | ✅ `tracks[]` con zones por pista | ✅ Layers/Parts | **Paridad** |
| **Phase: Blocks/Grouping** | ✅ `blocks` (cuantización entera) | ✅ MAtricks Blocks | **Paridad** |
| **Phase: Shuffle/Random** | ✅ determinista con seed (reproducible) | ✅ Shuffle (random) | **Hephaestus ≥ MA3** (reproducibilidad) |
| **Phase: Wings** | ✅ frecuencia espacial continua | ✅ Wings | **Paridad** |
| **Phase: spread multi-ciclo** | ✅ 0–1440° | ✅ Phase 0–N | **Paridad** |
| **Individual Phase (override manual per-fixture)** | ❌ algorítmico | ✅ editable por cabeza | **MA3 > Hephaestus** |
| **`blendMode` per-track ejecutado** | ⚠️ declarado pero ignorado en runtime (LTP) | ✅ HTP/LTP real | **MA3 > Hephaestus** |
| **Audio-reactividad nativa** | ✅ `audioBinding` + Capa Sensorial | ❌ (MIDI/DMX in externo) | **Hephaestus >> MA3** |
| **IA de arrangement (genoma cognitivo)** | ✅ Selene / Diamond V3 / Infinite Arsenal | ❌ inexistente | **Hephaestus >> MA3** |
| **Visualizador integrado WYSIWYG** | ⚠️ bello pero colapsa multicelular | ✅ 3D viz + fixture sheet fiel | **MA3 > Hephaestus** (fidelidad) |
| **Zero-alloc / GC safety (core)** | ✅ genuino | N/A (C++, sin GC) | N/A |
| **Integridad de archivo (checksum)** | ❌ G2 bypasseado | ✅ showfile validado | **MA3 > Hephaestus** |
| **Operación live (Speed Master, encoders)** | ❌ (fuera de alcance por diseño) | ✅ | *No aplica — herramienta en frío* |
| **Precio** | Incluido en suite LuxSync | €50k–150k (consola) | **Hephaestus ∞×** |

**Lectura del comité:** En el terreno que el equipo eligió pelear —**diseño de efectos en frío**— Hephaestus V3 **ya no es complementario a MA3: es competitivo, y en dos ejes lo supera con claridad** (curva libre + IA de arrangement). MA3 conserva ventaja en tres puntos de *rigor profesional*: Individual Phase manual, ejecución real de blend modes, y fidelidad de previsualización. Dos de esos tres son bugs/deuda, no límites arquitectónicos. El tercero (Individual Phase) es una feature de un día.

---

## 5. VEREDICTO DE ADQUISICIÓN Y PIONEER SCORE

### 5.1 Desglose de puntuación

| Categoría | Peso | Puntuación | Ponderado |
|---|---|---|---|
| Arquitectura multicelular (`tracks[]`) | 15% | 94 | 14.10 |
| Motor de fase `PhaseConfigPro` (vs MAtricks) | 18% | 95 | 17.10 |
| Matemática de curvas (Newton/Bézier, zero-alloc) | 12% | 90 | 10.80 |
| Simbiosis IA (Cognitive DNA / Selene / Diamond V3) | 18% | 91 | 16.38 |
| Pipeline de datos & `.lfx v3.0` | 8% | 78 | 6.24 |
| Quantum Spectrometer & UX de autoría | 10% | 84 | 8.40 |
| Fidelidad WYSIWYG (preview ↔ runtime) | 8% | 62 | 4.96 |
| Chaos resilience & defensa interna | 6% | 72 | 4.32 |
| Cobertura de tests & documentación | 5% | 90 | 4.50 |

### PIONEER SCORE V3: **89.4 / 100 — ACQUISITION-WORTHY**

*(Marzo 2026: 86.5 → Junio 2026: 89.4 · **+2.9**)*

| Rango | Calificación |
|---|---|
| 90–100 | **EXCEPTIONAL** — compite con hardware dedicado. Adquisición inmediata. |
| **80–89** | **ACQUISITION-WORTHY** — sólido con deficiencias corregibles. Recomendado con condiciones. |
| 70–79 | PROMISING |
| <70 | requiere inversión profunda |

### 5.2 Por qué 89.4 y no 90+

El motor merece el umbral EXCEPTIONAL por arquitectura y por la simbiosis IA. **Se queda a 0.6 puntos por dos razones, ambas auto-infligidas y ambas baratas de arreglar:**

1. **El NaN guard sigue abierto tres meses después.** Es un P1 de una línea. Que sobreviva a una reconstrucción completa indica que el path numérico nunca recibió la ingeniería defensiva del path de color. **No cruzo a un equipo a EXCEPTIONAL mientras su motor dependa de un guardia río abajo para no emitir veneno.**
2. **El preview rompe el WYSIWYG multicelular.** V3 construyó una arquitectura de N-curvas-por-param y luego la herramienta de visualización la colapsa a 1. Es la ventaja bandera, invisible en la mesa de diseño.

### 5.3 Condiciones de adquisición (P0/P1 obligatorios pre-cierre)

**🔴 BLOQUEANTES (P0):**
1. **Re-armar Gate G2 (checksum).** Un validador de integridad apagado en producción es inaceptable para una suite de seguridad declarativa. (`LfxFileLoader._parseAndValidateV3`)
2. **NaN guard en origen.** `Number.isFinite()` en `CurveEvaluator.getValue()` y/o `scaleToDMX()`. Una línea. Tres meses de retraso.

**🟡 CRÍTICOS (P1):**
3. **Reparar WYSIWYG multicelular.** `tracksToCurveMap` debe alimentar al preview con la misma lógica N-track del runtime, o el `QuantumSpectrometer` debe consumir directamente el output del `HephaestusRuntime` en vez de un evaluador paralelo divergente.
4. **Throttle `useHephPreview` a 44 Hz** y sacar la telemetría de alta frecuencia del estado React (eliminar el doble RAF + reconciliación 60fps).
5. **Ejecutar `blendMode` per-track** en el runtime, o eliminar el campo del esquema hasta que se implemente (no prometer en el formato lo que el motor ignora).
6. **Limpiar diagnóstico hardcodeado** (`fixture-1781916704143`) y tipar `phaseConfig: any` en el componente estrella.

**🟢 MENORES (P2):** Individual Phase manual per-fixture; bisección/early-exit en Newton; guard de monotonía de handles; zero-alloc en el visualizador; virtualización del `CurveEditor` SVG; calibrador normativo del genoma A/C/O.

### 5.4 Recomendación al CEO

**RECOMIENDO LA ADQUISICIÓN, condicionada al cierre de los dos P0 antes del cierre del trato.**

Hephaestus V3 es la primera área de las dos auditadas que **supera a grandMA3 en su propio terreno** — no en operación (nunca fue el objetivo), sino en **autoría de efectos y arrangement inteligente.** El `PhaseConfigPro` es código de clase mundial: si me lo presentaran sin contexto, asumiría que salió de un equipo de DSP veterano, no de un proyecto TypeScript. La simbiosis con Selene vía Diamond V3 es el foso defensivo real frente a MA Lighting: **MA3 no tiene IA, y no la tendrá pronto porque su filosofía es el control manual determinista.** AlphaTheta compraría aquí no un clon de MA3, sino la categoría que MA3 decidió no construir.

Lo que me frena de un entusiasmo sin reservas es **cultural, no técnico**: un P1 trivial que sobrevive tres meses y un WYSIWYG roto en la feature estrella sugieren que el equipo construye features brillantes más rápido de lo que cierra deuda. Eso es manejable con un gate de calidad contractual. La ingeniería de fondo es de las mejores que he visto defendiendo el dinero de esta compañía.

**Hephaestus es ahora un DAW de iluminación con un arrangeador de IA. MA3 es un Ferrari manual sin radio. Para el cliente de AlphaTheta, el primero vende más unidades. Continuar due diligence en Área 3.**

---

*PunkOpus — Pioneer DJ / AlphaTheta — Advanced Signal Processing Group*
*"En marzo dije que Newton y Bézier caminaban juntos en esta forja. En junio caminan, y traen una IA de la mano. Pero el motor sigue sin ponerse el casco: un NaN suelto y un espejo roto. Arréglenlo, y cruzan a los 90."*
*27 Jun 2026*

---

**DISCLAIMER:** Informe basado exclusivamente en revisión de código fuente (WAVE 7024–7029) y la auditoría previa de Marzo 2026. No se ejecutaron benchmarks en hardware DMX real ni pruebas de usabilidad con operadores profesionales de MA3. Se recomienda complementar con una sesión de stress-test del runtime multicelular con rig físico de ≥50 fixtures antes del cierre.
