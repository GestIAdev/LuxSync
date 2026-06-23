# Auditoría: Hephaestus Phase Distributor y su Ecosistema de Curvas

## Resumen Ejecutivo

**Hephaestus** es el motor de automatización paramétrica de LuxSync. Su objetivo es convertir archivos `.lfx` (efectos con curvas de automatización) en valores DMX en tiempo real. Dentro de este motor, el **Phase Distributor** es la pieza que calcula cuándo arranca cada fixture dentro de un efecto, generando olas, cascadas, simetrías y wings sin escribir una sola línea de código.

La combinación de **curvas Bézier** + **distribución de fase** + **ADN cognitivo** es lo que permite que un técnico diseñe un efecto complejo en minutos, mientras que en GrandMA3 el mismo resultado requiere horas de programación de fórmulas, phaser y timing.

---

## 1. ¿Qué es el Phase Distributor?

`PhaseDistributor.ts` es una clase **stateless** y pura. Recibe:

- `fixtureIds[]`: lista de fixtures objetivo (ya resuelta por el selector)
- `config: PhaseConfig`: spread, simetría, wings, dirección
- `durationMs`: duración total del clip

Y retorna un array `FixturePhase[]` ordenado por `phaseOffsetMs` ascendente. Ese offset representa **cuánto tarda cada fixture en comenzar su propia copia del efecto**.

### Fórmulas centrales

```
spreadMs = durationMs × config.spread
```

| Simetría | Comportamiento | Fórmula |
|----------|----------------|---------|
| **Linear** | Escalera uniforme | `offset[i] = i × (spreadMs / (N-1))` |
| **Mirror** | Pliegue desde los extremos al centro | `mirrorIdx × (spreadMs / (halfN-1))` |
| **Center-Out** | Expansión desde el centro | `(distanciaAlCentro / maxDist) × spreadMs` |

Además soporta:
- **Wings**: divide el array en subgrupos (`wingSize = ceil(N/wings)`) y aplica la simetría dentro de cada wing.
- **Direction**: `1` (forward) o `-1` (reverse), que invierte el offset para cambiar la dirección de propagación.

### Diseño clave

1. **Pura función**: mismos inputs → mismos outputs. Determinista y testeable.
2. **Pre-calculable**: `resolve()` se llama una sola vez al activar el clip, no en cada frame.
3. **Ordenado por `phaseOffsetMs` ASC**: esto es crítico para que el `CurveEvaluator` mantenga su cursor cache en O(1) amortizado durante el playback.

---

## 2. Integración con el Curve Editor y CurveEvaluator

### Curve Editor (UI)

El editor de curvas es un canvas SVG nativo donde el usuario crea keyframes, arrastra puntos y ajusta handles Bézier. Cada keyframe define:

- `timeMs`: posición en el tiempo
- `value`: valor numérico o color HSL
- `interpolation`: `hold`, `linear` o `bezier`
- `bezierHandles`: `[cx1, cy1, cx2, cy2]` para curvas cúbicas

### CurveEvaluator (runtime)

Es el motor matemático que evalúa las curvas en cada frame. Características:

- **Cursor cache**: cada parámetro mantiene un índice al segmento activo. En playback normal solo avanza 0 o 1 posiciones → O(1) amortizado.
- **Búsqueda binaria**: en seek/scrub hacia atrás, usa binary search → O(log n).
- **Bézier cúbico**: resuelve la curva paramétrica con 4 iteraciones de Newton-Raphson para obtener Y dado X.
- **Interpolación HSL**: el hue se interpola por shortest-path (350° → 10° cruza por 0°).
- **Zero-allocation**: usa buffers pre-alocados para snapshots y colores, evitando GC en el hot-path de 44 Hz.

### Punto de unión: `tickActive()`

En `HephaestusRuntime.ts`, el método `tickActive()` decide por cada pista:

- Si la pista tiene `fixturePhases` → evalúa la curva con `localElapsedMs = max(0, clipTime - phaseOffsetMs)` para cada fixture.
- Si no tiene fase → evalúa con el tiempo global del clip para todos los fixtures de la pista.

Esto significa que **la misma curva se evalúa múltiples veces con tiempos distintos**, uno por fixture. El resultado es una wave genuina: fixture 0 dispara primero, fixture 1 un poco después, etc.

---

## 3. La Simbiosis: Phase Distribution + Hephaestus

La magia surge de combinar tres capas:

```
Curve Editor (diseño)
        ↓
CurveEvaluator (matemática pura)
        ↓
PhaseDistributor (espaciado temporal entre fixtures)
        ↓
HephaestusRuntime (ejecución en caliente)
        ↓
NodeArbiter / Aether (DMX a fixtures)
```

### Ejemplo concreto: wave de dimmer

Diseñas una curva de intensidad que sube de 0 a 1 en 500 ms y baja en 500 ms. Luego configuras:

- Spread: `1.0` (la última fixture empieza un ciclo completo después que la primera)
- Symmetry: `linear`
- Wings: `2`
- Direction: `forward`

Resultado: dos grupos de fixtures ejecutan la misma curva escalonada, creando una wave visual que recorre el rig.

En GrandMA3, esto equivalente a construir un **Phaser** con varios steps, formas y timing. En LuxSync es: una curva + cuatro sliders.

---

## 4. El ADN Cognitivo: `.lfx` y Selene IA

Cada clip `.lfx` puede llevar un bloque `CognitiveDNA` y `SimulationMeta`. Es la "tarjeta de presentación" del efecto para la inteligencia artificial y para el operador.

### CognitiveDNA

```ts
interface CognitiveDNA {
  genome: { aggression, chaos, organicity }   // Cubo ACO 0-1
  textureAffinity: 'clean' | 'dirty' | 'universal'
  compatibleVibes: string[]                    // Vibes musicales compatibles
  validSections: string[]                      // Secciones del show donde aplica
  energyZone: { min: EnergyZone, max: EnergyZone }
  aggressionRange: { min, max }
  spatialBehavior: 'static' | 'relative_offset' | 'absolute' | 'spatial'
  ikCompatibility?: { respectsTarget, orbitAmplitude, fallbackOnNoTarget }
  executionDomain?: 'vector' | 'pixel' | 'hybrid'
  pixelHints?: { mappingSpace, resolution, blend, alphaToDimmer, ... }
}
```

### SimulationMeta

Metadata para el simulador de belleza y costo:

- `beautyWeights`: pesos estéticos base
- `gpuCost`: costo de render
- `fatigueImpact`: fatiga visual
- `minDurationMs`, `cooldownMs`
- `isStrobe`, `isDivineCandidate`, `isHeavyCandidate`
- `zScoreGuards`: guardas de energía mínima

### ¿Por qué es un "arsenal infinito"?

Selene IA lee el ADN para decidir, en tiempo real, qué efecto encaja con la música, la energía de la sala y la sección del show. En lugar de tener 50 efectos hardcodeados, el sistema tiene:

- **Curvas infinitas**: cualquier parámetro puede ser automatizado.
- **Phases infinitas**: cualquier distribución de fase puede modificarse.
- **ADN infinito**: cualquier combinación de ACO + vibe + zona energética puede generar un nuevo efecto candidato.

El ADN convierte un efecto en una **entidad buscable, filtrable y matching-able** por la IA.

---

## 5. Limitaciones Actuales

### PhaseDistributor

- **Solo 3 simetrías**: linear, mirror, center-out. No hay random, sine, index-based pattern, ni custom curve.
- **Phase es estático**: se calcula al inicio del clip y no se puede animar durante la ejecución.
- **Solo offset temporal**: no hay offset de valor (amplitude scaling per fixture) ni phase espacial (distancia 3D entre fixtures).
- **Wings simple**: `wingSize = ceil(N/wings)`. No soporta wings de tamaño desigual ni reglas de boundary.
- **No hay editor visual**: la fase se configura con sliders numéricos. No hay preview de la wave sobre el curve editor.
- **No es audio-reactiva**: el spread no se modula por el RMS o bandas de frecuencia.
- **No hay easing por fixture**: cada fixture usa la misma curva con el mismo easing; no se puede suavizar la entrada/salida de la wave.

### CurveEditor / CurveEvaluator

- **Curva por parámetro**: aunque V3 permite múltiples tracks con el mismo paramId en zonas distintas, el editor aún puede sentirse limitado para editar relaciones complejas entre parámetros.
- **Bézier sin presets accesibles**: existen presets en código (`BEZIER_PRESETS`), pero la UI podría exponerlos mejor.
- **No hay curvas de fase**: no se puede dibujar cómo evoluciona la fase dentro del clip.
- **No hay editor de relaciones**: no se puede decir "el color sigue al dimmer con un retardo de 200 ms" directamente desde el editor.
- **Audio binding básico**: un keyframe puede estar ligado a audio, pero no hay un módulo de audio-analysis visual integrado en el editor.

### ADN / Selene

- **ADN estático**: el ADN no se muta ni evoluciona. Cada efecto es fijo salvo que el usuario lo edite.
- **No hay generación procedural**: Selene selecciona de un arsenal existente, pero no genera nuevas curvas o fases automáticamente.
- **Matching limitado**: la IA usa el ADN, pero no hay feedback loop de "este efecto funcionó bien aquí, úsalo de nuevo".

---

## 6. Hoja de Ruta para Versionar a Profesional

### Phase Distribution 2.0

1. **Nuevas simetrías**:
   - `sine`: offset basado en una onda senoidal sobre el índice.
   - `random`: offsets aleatorios pero deterministas (seed-based).
   - `index-pattern`: fórmula custom `offset = f(index, N)`.
   - `spatial`: offset proporcional a la distancia entre fixtures en el stage.

2. **Phase animada**:
   - Permitir que `spread`, `wings` y `direction` evolucionen a lo largo del clip.
   - Curva de fase como primer ciudadano del editor.

3. **Audio-reactive phase**:
   - Modulación del spread por banda de frecuencia.
   - Threshold-driven phase (la wave solo se activa en picos de energía).

4. **Editor visual de fase**:
   - Overlay sobre el CurveEditor que muestre la línea de tiempo escalonada por fixture.
   - Preview en tiempo real: seleccionar un fixture y ver su curva local.
   - Templates GrandMA3-style: "chase", "wave", "cascade", "breath".

5. **Per-fixture easing**:
   - Aplicar easing a la entrada/salida de la wave (fade-in de la fase).
   - Amplitude scaling por fixture para acentuar centros o extremos.

### Curve Editor Profesional

1. **Multi-curve view**: ver y editar varias curvas en el mismo canvas con ejes Y diferentes.
2. **Bezier presets UI**: botones de `ease-in`, `overshoot`, `bounce`, `snap`.
3. **Relaciones entre curvas**: retardo, seguimiento, suma, multiplicación.
4. **Audio waveform overlay**: visualizar el análisis de audio para sincronizar keyframes.
5. **Live preview**: reproducir el clip en un visor virtual mientras se edita.

### ADN / Selene Profesional

1. **Mutación procedural**: Selene puede generar variantes de ADN y proponer nuevos efectos.
2. **Feedback loop**: registro de qué efectos funcionaron en qué momentos para mejorar el matching.
3. **Pack system**: packs de ADN por género musical (techno, rock, pop, ambient).
4. **Spatial DNA**: integración con el mapa 3D del stage para phase espacial automática.

---

## 7. La Comparación con GrandMA3

| Capacidad | GrandMA3 | LuxSync Hephaestus |
|-----------|----------|---------------------|
| Curvas de automatización | Phaser / formulas MA | Editor Bézier visual + curve evaluator |
| Distribución de fase | Phaser con steps y timing | PhaseDistributor con simetrías + wings |
| Wave entre fixtures | Construir phaser manualmente | Sliders: spread, symmetry, wings, direction |
| Curvas de color | Formulas RGB/CMY | Interpolación HSL con shortest-path hue |
| Audio-reactive | Plugins externos / MA macros | Audio binding nativo en keyframes |
| Efectos reutilizables | Macros / Presets | Archivos `.lfx` + ADN cognitivo |
| Selección IA | No tiene | Selene lee ADN y propone efectos en tiempo real |

### El 100% de aceleración

En GrandMA3, el cuello de botella es la **traducción mental**: el técnico imagina una wave, luego debe traducirla a steps, timing, phaser y fórmulas. Cada cambio requiere reprogramar.

En LuxSync, el cuello de botella es la **intención**: el técnico dibuja la curva y elige la distribución. La matemática se genera automáticamente. Iterar es instantáneo.

Ese cambio de "traducir a fórmulas" a "expresar visualmente" es donde se gana el 100% de velocidad.

---

## 8. Conclusión

Hephaestus Phase Distributor es un buen punto de partida: puro, rápido, determinista y bien integrado con el CurveEvaluator. Pero es **funcionalmente básico**. Para competir con profesionales de GrandMA3 y productoras de alto nivel, necesitamos:

- Más modos de fase (sine, random, spatial, custom).
- Fase animada y audio-reactiva.
- Editor visual de fase integrado con el CurveEditor.
- ADN procedural y feedback loop de Selene.
- Multi-curve editing y relaciones entre parámetros.

La base está. La arquitectura soporta la escala. Lo que sigue es **rellenar el espacio de diseño** para que el técnico nunca tenga que escribir una expresión matemática en una línea de comandos.
