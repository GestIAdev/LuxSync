# TECHNICAL AUDIT — HEPHAESTUS V3

**Auditor:** PUNKOPUS — Chief DSP Auditor & Acquisition Veteran
**Cliente interno:** AlphaTheta Corp. / Pioneer DJ — M&A Engineering Division
**Benchmark:** grandMA3 Phaser + MAtricks (MA Lighting GmbH)
**Objeto auditado:** LuxSync · Área 2 · Hephaestus V3 (motor de efectos paramétricos `.lfx` V3)
**Veredicto anterior (hace 3 meses):** 86.5 / 100 — *"Herramienta de pre-programación, no de performance."*
**Naturaleza declarada del módulo:** Trabajo en FRÍO. Preshow. No opera en vivo. *Aceptado como axioma de diseño.*

---

> **DISCLAIMER DE TONO.** Este informe defiende dinero de AlphaTheta, no el ego del equipo de LuxSync. Donde el código está bien, lo digo en una línea. Donde está mal, lo abro en canal. No esperen halagos. Esperen un cheque condicionado.

---

## 0. RESUMEN EJECUTIVO

Hephaestus V3 no es una iteración cosmética sobre V2. Es una reescritura del modelo de datos (de `Map<paramId, curva>` a `tracks[]` multicelular) y una apuesta arquitectónica real: **curvas Bézier arbitrarias por atributo + un motor de distribución de fase (`PhaseConfigPro`) que replica, función por función, la matemática de MAtricks.**

La buena noticia para AlphaTheta: en el plano **matemático puro**, Hephaestus ha alcanzado paridad —y en expresividad de forma, superioridad— frente al Phaser de grandMA3. El `CurveEvaluator` es código de grado de producción.

La mala noticia: el módulo arrastra **dos pecados estructurales** que comprometen la confianza del producto:

1. **Doble fuente de verdad en evaluación.** El preview (`useHephPreview`) y el runtime (`HephaestusRuntime`) son DOS motores distintos que evalúan el mismo `.lfx`. El WYSIWYG no está *compartido*, está *reimplementado*. Esto es deuda de divergencia garantizada.
2. **Dos motores de fase coexistiendo** (`PhaseConfigPro` en grados vs. `PhaseDistributor`/`PhaseConfig` normalizado 0-1). El runtime importa AMBOS. Esto es una bomba de relojería de WYSIWYG.

El "Quantum Spectrometer" es bello y técnicamente competente, pero comete un pecado de rendimiento de manual: **renderiza a 44 Hz aunque el preview esté en pausa.**

**Pioneer Score actualizado: 88.5 / 100.** Sube 2 puntos. Subiría a 93+ si se cierran los dos pecados estructurales. Detalle en §5.

---

## 1. ANÁLISIS DE ARQUITECTURA

### 1.1 El núcleo matemático — `CurveEvaluator.ts` ✅ EXCELENTE

`@/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/hephaestus/CurveEvaluator.ts`

Esto es lo mejor del módulo. Sin adornos:

- **Cubic Bézier vía Newton-Raphson + bisección híbrida** (`cubicBezierY`, líneas 589-666). Mantiene un bracket `[lo, hi]` y cae a bisección cuando Newton salta fuera o la derivada colapsa. Es exactamente el algoritmo de las CSS transitions de Chrome, pero blindado. 4 iteraciones, epsilon `1e-7`. Correcto.
- **Guard de monotonía** `if (cx1 > cx2) cx2 = cx1` (línea 603). Previene la convergencia a la rama equivocada. Detalle que el 90% de las implementaciones caseras olvidan.
- **Cursor cache O(1) amortizado** en playback forward, binary search O(log n) en seek (`findSegment`, `binarySearchSegment`). Diseño de hot-path serio.
- **Hue por shortest-path** (`lerpHue`, línea 686). Evita el "arcoíris accidental" 350°→10°. Profesional.
- **Zero-alloc real**: `_hslResult`, `_snapshotCache`, `_snapshotColorCache` pre-alocados, con contrato documentado de no-retención. Bien.
- **Defensa NaN exhaustiva** en cada rama (`Number.isFinite`, `isValidHSL`, `writeSafeDefault`).

**Crítica menor:** el `'hold'` retorna `0` desde `applyInterpolation` (línea 550) para que `v0 + (v1-v0)*0 = v0`. Es correcto pero frágil: depende de que el caller numérico siempre haga lerp. Para color se maneja por separado (línea 327). Funciona, pero es un acoplamiento implícito entre dos funciones. Documentadlo como invariante o unificadlo.

**Veredicto:** este archivo solo ya justifica parte de la nota. Es el corazón y late bien.

### 1.2 El pecado capital — DUALIDAD DE MOTORES DE EVALUACIÓN ❌ CRÍTICO

El runtime de producción (`HephaestusRuntime.ts`, Node/main process) y el preview de la UI (`useHephPreview.ts`, renderer) son **dos implementaciones independientes** del mismo acto: evaluar un clip `.lfx` V3 a un instante `t`.

- `useHephPreview.evaluateFixtureFrame()` (líneas 178-280) reimplementa: blend de tracks, `scaleToDMX`, modulación de luminancia por intensity, fusión RGB.
- `HephaestusRuntime` hace lo suyo y **delega la fusión real al `NodeArbiter` aguas abajo** (su propio comentario lo admite: *"el Runtime emite por separado todos los tracks; la fusión efectiva sucede aguas abajo en NodeArbiter"* — `ResolvedTrack.blendMode`, líneas 111-118).

Conclusión demoledora: **el preview fusiona en la app; el runtime NO fusiona, deja que el árbitro L3/LTP lo haga.** Por construcción, lo que el diseñador VE en el Quantum Spectrometer **no es** lo que Selene/DMX emitirá cuando dos tracks colisionen sobre el mismo nodo. El "WYSIWYG" es un *parecido*, no una *garantía*.

> En grandMA3 esto es impensable: el motor de cálculo es UNO. El programador ve el output del MISMO pipeline que sale por sACN. Hephaestus tiene un simulador y un ejecutor, y rezan por coincidir.

**Recomendación P0:** extraer un único `HephEvaluationKernel` puro (sin `fs`, sin React, sin Arbiter) que AMBOS consuman. El preview debe simular el merge del Arbiter, o el Arbiter debe exponer su lógica de fusión como función pura compartida. Ya existe `HephSharedMath.ts` (`blendNumeric`, `blendRgb`, `buildTrackEvaluators`) — está a medio camino. Terminad el trabajo: que el runtime use EXACTAMENTE esas funciones, no su propia ruta.

### 1.3 El segundo pecado — DOS MOTORES DE FASE ❌ ALTO

Coexisten:

- `phase/PhaseConfigPro.ts` (WAVE 7001) — `spreadDeg` en **grados** [0,1440], con `blocks`, `shuffle`, `shuffleSeed`, `symmetry`, `direction`, `wings`. Es el que usa el editor y el preview (`resolveWithOverrides`).
- `runtime/PhaseDistributor.ts` (WAVE 2400) — `PhaseConfig` con `spread` **normalizado 0-1**, `wings`, `symmetry`, `direction`. SIN blocks ni shuffle.

`HephaestusRuntime.ts` (líneas 44-48) importa **los dos tipos** (`PhaseConfig` y `PhaseConfigPro`). Esto significa que el motor de producción tiene ambos linajes vivos. Un clip resuelto por `PhaseDistributor` (sin shuffle/blocks) producirá una distribución DISTINTA a la que el diseñador ajustó en `PhaseConfigPro`.

**Esto es WYSIWYG roto a nivel de fase**, que es precisamente el dominio donde competís con MA3.

**Recomendación P0:** matar `PhaseDistributor.ts` y `PhaseConfig`. Una sola verdad: `PhaseConfigPro` + `resolveWithOverrides`. Migrad el runtime. El legacy normalizado es un cadáver que respira.

### 1.4 Modelo de datos V3 — `tracks[]` multicelular ✅ BUENO

`HephAutomationClipV3` (`types.ts`, líneas 447-490) es un acierto. Separar `spatialZones` (DÓNDE) de `cognitiveDNA` (CUÁNDO/CÓMO para Selene) cierra el namespace bleed que arrastraba V2. La doctrina "orden canónico zona ASC → paramId ASC para idempotencia/checksum" es disciplina de ingeniero serio.

**Pero:** `cognitiveDNA` es **a nivel de clip**, no por track. En MA3 cada atributo (dimmer/pan/tilt/color) puede tener su propio phaser y su propia personalidad. Aquí el genoma A/C/O es global al clip mientras que las curvas son multicelulares. Asimetría conceptual. Para clips compuestos (un dimmer agresivo + un color orgánico) no podéis declarar dos personalidades. Limitación de diseño, no bug.

### 1.5 Store y undo/redo — `useHephaestusEditorStore.ts` ✅ SÓLIDO con grietas

`@/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/hephaestus/store/useHephaestusEditorStore.ts`

- Zustand + Immer `produceWithPatches` para undo/redo basado en patches inversos. Correcto y eficiente (líneas 196-211). `HISTORY_LIMIT` con `shift()`. Bien.
- Drag batching (`beginDragSnapshot`/`endDragSnapshot`) evita 1 entrada de historial por cada pixel de arrastre. Bien pensado.

**Grietas:**

1. El shim `setClip` (en `index.tsx` línea 55 y `LabTab.tsx` línea 75) hace `mutate('Edit clip', draft => { const next = updater(draft); Object.assign(draft, next) })`. Pasar un updater inmutable `prev => ({...prev, x})` DENTRO de una receta Immer **derrota el structural sharing de Immer**: clonáis todo el objeto y luego Immer diffea el clon contra el draft. Los patches se inflan. Anti-patrón. Usad mutación directa del draft.
2. `temporalActions.snapshot()` es un **no-op** en V3 (líneas 65-66 de `index.tsx`) pero sigue invocándose por toda la UI ANTES de `setClip` (que YA hace snapshot vía `mutate`). Resultado: o bien es código muerto confuso, o bien generáis dobles entradas de historial. Limpiad el shim temporal. Es un fantasma de la migración.
3. `setCognitiveDNA`/`enableDNA` castean con `as unknown as CognitiveDNA` sobre un genoma parcial (líneas 419-440). Agujero de tipos. Y el default del store difiere del `DEFAULT_COGNITIVE_DNA` de `DnaRail.tsx`. **Dos defaults de DNA distintos** = inconsistencia de hidratación según por dónde entre el clip.

---

## 2. PIPELINE DE DATOS Y SIMBIOSIS IA

### 2.1 El Bridge — `SeleneHephBridge.ts` ✅ LIMPIO

`@/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/arsenal/SeleneHephBridge.ts`

Enrutamiento dual/triple path (`hephaestus` | `pixelmap` | `legacy`) impecable. Zero-alloc en los misses (`_LEGACY_*` pre-congelados con `Object.freeze`). Retrocompatibilidad estricta (un MISS no toca el pipeline legacy). Telemetría no destructiva. La regla de oro ("el bridge nunca llama a EffectManager ni al Arbiter directamente") mantiene el acoplamiento bajo. Es buena ingeniería de integración.

### 2.2 La pregunta incómoda: ¿el "arsenal infinito" es cognitivo o es un `Map.get(string)`? ⚠️ A INVESTIGAR

Aquí pongo el dedo en la llaga del marketing.

`route()` (línea 187) hace: `this._registry.getEntry(decision.effectType)`. Es decir: **la selección del efecto se hace por un string `effectType` contra un registro.** El genoma A/C/O (`FrozenGenome`), el `CognitiveDNA`, la `aggressionRange`, el `energyZone`... **no aparecen en la decisión de routing del bridge.**

Eso significa una de dos cosas:

- **(a)** El matching cognitivo real (genoma → effectType) sucede ARRIBA, en el `DecisionMaker`/`ConsciousnessOutput` de Selene, y el bridge solo ejecuta. *Plausible y correcto.*
- **(b)** El genoma es decorativo: se autoría en `DnaRail`, se serializa en el `.lfx`, pero nadie lo consume para elegir. *Catastrófico para la narrativa "arsenal infinito vía Selene".*

`GenomeCalibrator.ts` solo provee **anchors semánticos y validación** (rulers A/C/O), NO un algoritmo de matching. No encontré en la superficie auditada el consumidor que haga `genome → best effect`. **AlphaTheta no firma un cheque sobre una caja negra.**

**Recomendación P0:** demostrad con un test E2E que un cambio en el genoma A/C/O de un clip cambia la probabilidad de que Selene lo elija ante un input de audio dado. Si ese test no existe, el "Cognitive DNA" es UI bonita sobre un `switch` de strings. Si existe, exhibidlo en la due diligence.

### 2.3 Hidratación V2→V3 ⚠️

El loader discrimina por `schemaVersion: '3.0'` y cae a un adapter in-memory v2→v3. No audité el adapter en profundidad, pero el riesgo clásico está señalado: el `.lfx` es "la última versión unificada en todo el sistema" según vuestra documentación, pero el código sigue cargando v2.x. **Mientras exista el adapter, existe una segunda forma de que un clip llegue al runtime con una distribución de fase legacy** (ver §1.3). Unificación declarada ≠ unificación real.

---

## 3. CHAOS ENGINEERING & EDGE CASES

### 3.1 Quantum Spectrometer renderiza siempre, esté en pausa o no ❌ ALTO (rendimiento)

`@/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/views/HephaestusView/QuantumSpectrometer.tsx`

El RAF loop (líneas 597-686) corre incondicionalmente mientras el componente está montado. Aunque `preview.isPlaying === false`, cada ~22.7 ms se ejecuta:

- `getBoundingClientRect()` → **layout thrash por frame** (debería ser `ResizeObserver`).
- `ctx.createRadialGradient(...)` para la viñeta → **alocación de objeto gradient por frame** (líneas 649-651). Esto contradice directamente la disciplina zero-alloc del resto del módulo.
- Redibujado completo de grid + spline Catmull-Rom (16 segmentos × fixtures) + nodos + HUD.

En un preshow real, un diseñador deja esta vista abierta MINUTOS mientras piensa. Estáis quemando CPU/GPU y batería a 44 Hz para redibujar una imagen estática. **Gate obligatorio:** `if (!isPlaying && !dirty) skip render`. El `frameCounterRef` para animaciones idle (pulsos, target lock rotante) puede correr a 10-15 Hz, no a 44.

### 3.2 Buffers globales compartidos — frágil ante doble montaje ⚠️

`_nodePositions`, `_sampleX/Y`, `_nodePositionsCount` son **singletons a nivel de módulo** (líneas 61-68). Funciona porque hay UNA instancia. Pero:

- React StrictMode (dev) monta el componente dos veces → dos RAF loops escribiendo el MISMO buffer.
- El `handleCanvasMouseDown` (línea 689) llama `computeNodePositions()` que **sobrescribe el buffer que el RAF está usando**. En single-thread JS no hay data race, pero hay corrupción lógica de un frame y acoplamiento oculto entre input y render.

**Recomendación:** mover los buffers a `useRef` por instancia. El zero-alloc se conserva, la fragilidad desaparece.

### 3.3 La fase NO hace wrap continuo — diferencia conceptual vs MA3 ⚠️ IMPORTANTE

En `useHephPreview` la fase es un **offset temporal** sobre una timeline one-shot: `offsetTime = Math.max(0, timeMs - phaseOffset)` (línea 475).

Consecuencia: un fixture con `phaseOffsetMs` grande queda **congelado en `t=0`** hasta que el playhead lo alcanza. En el loop (`clipTimeMs % durationMs`, línea 532) el offset NO hace wrap modular por fixture → en la frontera del loop, los fixtures desfasados **dan un salto discontinuo** en lugar de fluir.

**grandMA3 trata la fase como un desfase de FASE sobre un ciclo que envuelve continuamente.** Su phaser no "congela" fixtures al arrancar ni salta al reciclar. Esto es, conceptualmente, la diferencia entre un *delay* y un *phase offset* real. Hephaestus implementa hoy un delay disfrazado de phaser.

**Recomendación P1:** para contenido cíclico, la fase debe ser `(timeMs + phaseOffset) % durationMs` con wrap, no un delay con clamp a 0. Esto os da el comportamiento de "chase infinito sin costuras" que es la firma del Phaser de MA.

### 3.4 `spreadDeg` sin clamp en el cálculo ⚠️ menor

`computeOffsetPro` (`PhaseConfigPro.ts` línea 98) no clampa `spreadDeg` al rango canónico [0,1440] declarado en el tipo. Confía en que la UI lo haga. La UI clampa `wings` (≤8) y `blocks` (≤16) pero el slider de spread debe verificarse. Input no confiable = defensa en el motor, no solo en la vista.

### 3.5 Diálogos nativos bloqueantes ⚠️ menor (UX)

`handleDelete` usa `confirm()` (`index.tsx` línea 256). Bloquea el hilo de render y rompe la estética del producto. En un AlphaTheta SKU eso no pasa QA visual.

---

## 4. COMPARATIVA DIRECTA vs grandMA3 PHASER

| Dimensión | grandMA3 Phaser / MAtricks | Hephaestus V3 | Ganador |
|---|---|---|---|
| **Forma de la curva** | Steps con transiciones (Phase/Width/Attack/Decay) | Bézier cúbico arbitrario por keyframe, Newton-Raphson | **Hephaestus** — más expresivo |
| **Distribución (spread)** | Phase offset % sobre selección, wrap continuo | `spreadDeg` + delay con clamp, sin wrap | **MA3** — fase real vs delay |
| **MAtricks (shuffle/blocks/wings/sym)** | Estándar de industria | Replicado 1:1 en `PhaseConfigPro` (blocks, shuffle determinista, wings, mirror/center-out, direction) | **Empate técnico** |
| **Override por fixture** | Editable en programmer | `PhaseOverride` (delta/absolute/pin, bake/unbake) — *híbrido superior* | **Hephaestus** |
| **Operación LIVE** | Nativo, es su razón de existir | NO (declarado preshow/frío) | **MA3** (fuera de competición por diseño) |
| **Rate / velocidad** | Hz / BPM-relativo, continuo | Ligado a `durationMs` del clip, no a tempo continuo | **MA3** |
| **WYSIWYG** | Un único motor de cálculo → sACN | Preview ≠ Runtime (dos motores, §1.2) | **MA3** — por goleada |
| **Personalidad por atributo** | Phaser independiente por attribute | `cognitiveDNA` global al clip | **MA3** |
| **Determinismo / reproducibilidad** | Total | Total (hash con seed, sort canónico, checksum) | **Empate** |
| **Capa cognitiva / IA** | Inexistente (filosofía 100% manual y determinista) | Selene IA + genoma A/C/O (si se consume de verdad, §2.2) | **Hephaestus** — categoría nueva |

**Síntesis honesta.** En MATEMÁTICA DE FORMA y en OVERRIDES HÍBRIDOS, Hephaestus iguala o supera a MA3. La filosofía es legítimamente distinta: MA3 es determinismo manual sagrado; Hephaestus añade una capa cognitiva (Selene) que MA3 jamás tendrá por doctrina. Eso es un **diferenciador de categoría**, no una copia.

PERO MA3 gana donde más duele a un producto que se vende como "competidor del Phaser": **un único motor de verdad (WYSIWYG garantizado) y un concepto de fase con wrap continuo.** Hephaestus tiene la matemática para ganar y la arquitectura para perder la confianza.

---

## 5. VEREDICTO DE ADQUISICIÓN Y PIONEER SCORE

### 5.1 Scorecard

| Categoría | Peso | Nota | Comentario |
|---|---|---|---|
| Núcleo matemático (`CurveEvaluator`) | 20% | 97 | Grado de producción. Newton+bisección blindado. |
| Modelo de datos V3 (`tracks[]`, namespaces) | 12% | 90 | Sólido. DNA por-clip es el techo. |
| Motor de fase (`PhaseConfigPro` + overrides) | 15% | 91 | MAtricks parity + híbrido superior. -dual engine, -no wrap. |
| Integridad de pipeline / WYSIWYG | 18% | 70 | **Talón de Aquiles.** Preview ≠ Runtime. Dos motores de fase. |
| Simbiosis IA (Selene/genoma) | 12% | 82 | Bridge limpio. Falta probar que el genoma se CONSUME. |
| Rendimiento Canvas 44 Hz | 10% | 80 | Spectrometer competente pero renderiza en pausa + alloc por frame. |
| Robustez / edge cases | 8% | 90 | Defensa NaN ejemplar. -buffers globales, -fase sin wrap. |
| UX / estructura | 5% | 84 | Limpio. -diálogos nativos, -snapshot fantasma, -FORGE/LAB split. |

### 5.2 PIONEER SCORE: **88.5 / 100**

> **Subida de +2.0 sobre el 86.5 anterior.**
> El equipo demostró que sabe construir un motor matemático de primera (`CurveEvaluator`, `PhaseConfigPro`) y una capa de integración limpia (`SeleneHephBridge`). La crítica de hace 3 meses ("solo preprogramación") se respeta como decisión de diseño consciente, no como carencia. Por eso no penalizo el "no-live".
> **No subió más por un motivo y solo uno: la falta de un único motor de verdad.** Un producto que aspira a competir con el Phaser de MA3 no puede permitirse que lo que el diseñador ve sea una *reimplementación* de lo que el hardware emite. Eso es lo que separa un 88 de un 94.

### 5.3 Recomendación de adquisición

**ADQUISICIÓN CONDICIONADA — "Acqui-hire + Earn-out técnico".**

El activo intelectual (el motor de curvas, la paridad MAtricks, el concepto Selene) **justifica la inversión.** AlphaTheta no compra un producto terminado; compra un equipo que sabe hacer DSP/matemática de iluminación de verdad y una arquitectura cognitiva que MA3 no tiene por doctrina.

**Cláusulas de earn-out (gating del pago final):**

- **P0 — Kernel único de evaluación.** Eliminar la dualidad preview/runtime (§1.2). Un solo `HephEvaluationKernel` puro consumido por ambos. *Bloqueante de firma.*
- **P0 — Motor de fase único.** Matar `PhaseDistributor`/`PhaseConfig` legacy; `PhaseConfigPro` como única verdad en el runtime (§1.3). *Bloqueante.*
- **P0 — Prueba de consumo del genoma.** Test E2E que demuestre que el `cognitiveDNA` altera la decisión de Selene (§2.2). Si no, retirar "arsenal infinito" del material de marketing.
- **P1 — Fase con wrap continuo** para contenido cíclico (§3.3).
- **P1 — Gate de render del Spectrometer** (no renderizar en pausa, eliminar `createRadialGradient` por frame, `ResizeObserver`) (§3.1).
- **P2 — Limpieza de deuda:** snapshot fantasma, doble default de DNA, buffers globales→refs, anti-patrón Immer en `setClip`.

**Cierra P0 + P1 y la nota es 93+. Entonces, y solo entonces, esto compite de verdad con un Phaser.**

---

*Fin del informe. — PUNKOPUS. Defendido el dinero. El resto es vuestro.*
