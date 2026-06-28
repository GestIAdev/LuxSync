# LuxSync · Hephaestus V3 + Selene — Especificación Técnica

**Documento:** Especificación técnica de módulo (no comercial)
**Área:** Suite LuxSync · Motor de efectos paramétricos + capa de automatización contextual
**Versión del documento:** 1.0
**Estado del módulo:** Producción. Verificado contra hardware DMX real en eventos pequeños.
**Audiencia:** Ingeniería de iluminación, integradores, evaluadores técnicos.

> **Nota de honestidad técnica.** Este documento describe lo que el código hace, no lo que nos gustaría que hiciera. Las limitaciones están listadas con el mismo detalle que las capacidades. Donde comparamos con grandMA3 (MA Lighting) lo hacemos como referencia de la mejor herramienta del mercado, no para desmerecerla. No hay hardware dedicado detrás de LuxSync: todo lo que se describe corre en software sobre una máquina de propósito general.

---

## 1. Alcance y resumen

Hephaestus V3 es el motor de **efectos de iluminación paramétricos** de LuxSync. No es un generador de presets fijos: es un evaluador de **curvas de automatización por atributo** sobre una distribución espacial de fase, almacenadas en el formato abierto `.lfx` (V3).

Cada efecto es un documento de datos: un conjunto de *tracks* (pistas), cada track porta una curva (intensidad, color, pan, tilt, etc.), un conjunto de zonas objetivo y una distribución de fase opcional. El motor evalúa estas curvas a **44 Hz** y produce valores listos para DMX.

Selene es la capa que, sin intervención humana, **selecciona y dispara** estos efectos en función del análisis del audio en tiempo real. Preferimos describirla como un **autómata programable determinista** (ver §7): dadas las mismas entradas, produce las mismas decisiones. No hay aleatoriedad oculta ni pesos entrenados de forma opaca.

Las dos piezas comparten un único núcleo de evaluación, de modo que **lo que se previsualiza en el editor es lo que se emite por DMX** (ver §5).

---

## 2. Modelo de datos: el formato `.lfx` V3

### 2.1 Estructura

Un clip `.lfx` V3 es un documento con tres espacios de nombres separados por diseño:

- **`tracks[]`** — el *qué* y el *cómo*: una lista de pistas multicelulares. Múltiples tracks pueden controlar el mismo atributo sobre distintos grupos de fixtures.
- **`spatialZones`** — el *dónde*: a qué zonas/grupos del rig se aplica cada track (resuelto a IDs de fixtures reales en runtime).
- **`cognitiveDNA`** — el *cuándo* (para Selene): metadatos que describen el carácter del efecto en un espacio normalizado (ver §7.2).

Cada track contiene:

| Campo | Descripción |
|---|---|
| `paramId` | Atributo controlado: `intensity`, `color`, `pan`, `tilt`, `zoom`, `focus`, `iris`, `gobo1/2`, `prism`, `strobe`/`strobeRate`, `white`, `amber`, `speed`, `width`, `direction` |
| `curve` | La curva de keyframes (ver §3) |
| `valueType` | `number` o `color` |
| `blendMode` | `max` · `replace` · `add` · `multiply` |
| `zones` | Tags de zona para routing espacial |
| `phaseOverrides` | Ajustes manuales de fase por fixture (ver §4.3) |
| `colorOverride` | Color constante opcional (HSL) |

### 2.2 Por qué multicelular importa

En esquemas anteriores existía una sola curva por atributo. V3 permite **N tracks por atributo**, cada uno con su propio grupo de fixtures y su propia fase. Un mismo efecto puede, por ejemplo, barrer el dimmer de los PARes frontales con una curva agresiva y, simultáneamente, mover el color de los wash traseros con una curva orgánica. Esto se resuelve por construcción, no como caso especial.

### 2.3 Determinismo y portabilidad

Los tracks se ordenan canónicamente (zona ASC → paramId ASC) para garantizar idempotencia y permitir checksums estables. El formato incluye metadatos de autoría (V3), lo que habilita compartir efectos entre usuarios: un `.lfx` es autocontenido y reproducible en cualquier rig que mapee las mismas zonas.

---

## 3. Motor de curvas — `CurveEvaluator`

El corazón matemático del módulo. Evalúa una curva de keyframes a un instante `t` en milisegundos.

### 3.1 Modos de interpolación

- **`hold`** — función escalón. El valor se mantiene constante hasta el siguiente keyframe.
- **`linear`** — interpolación lineal.
- **`bezier`** — Bézier cúbico con handles de control (modelo estilo After Effects), resuelto por un método híbrido **Newton-Raphson + bisección**: Newton para convergencia rápida, con caída a bisección cuando la derivada colapsa o el resultado se sale del intervalo. Incluye guarda de monotonía sobre los puntos de control para evitar convergencia a la rama incorrecta.

Esto da control de *easing* arbitrario por keyframe — aceleración, desaceleración, anticipación — sobre la forma de cada atributo.

### 3.2 Color

Las curvas de color interpolan en espacio **HSL** con **hue por camino más corto** (evita el barrido de arcoíris accidental entre, p. ej., 350° y 10°). La luminancia se modula por la pista de intensidad antes de convertir a RGB.

### 3.3 Rendimiento

- **Cursor cache O(1)** amortizado en reproducción secuencial; **búsqueda binaria O(log n)** en *seek*.
- **Sin asignación de memoria en el hot-path** (*zero-alloc*): buffers de resultado pre-asignados y reutilizados entre frames.
- Defensa exhaustiva contra `NaN`/valores inválidos con escritura de defaults seguros.

---

## 4. Phase Canvas — distribución de fase por fixture

Es la característica que consideramos más innovadora del módulo de cara al control creativo.

### 4.1 Concepto

En lugar de aplicar una curva idénticamente a todos los fixtures, Hephaestus asigna a cada fixture un **desfase temporal** sobre la misma curva. El resultado es un *chase* o una onda viva derivada de una única curva, distribuida espacialmente. Esto es funcionalmente equivalente, y en algunos aspectos un superconjunto, del concepto de **Phaser** de grandMA3.

### 4.2 Motor de distribución (`PhaseConfigPro`)

La distribución se controla con parámetros que replican la familia de transformaciones de selección de MA3 (MAtricks):

| Parámetro | Función |
|---|---|
| `spreadDeg` | Desfase total en **grados de ciclo** (rango [0, 1440], multi-ciclo permitido) |
| `blocks` | Cuantización por bloques |
| `wings` | Simetría en alas (mirror) |
| `symmetry` | `linear` · espejo · center-out |
| `direction` | Sentido de la distribución |
| `shuffle` + `shuffleSeed` | Aleatorización determinista (misma seed → misma distribución) |

La fase usa **wrap continuo** (`(t + offset) mod duración`), de modo que en contenido cíclico no hay fixtures congelados al arranque ni saltos en la frontera del bucle — el *chase* es continuo y sin costuras.

### 4.3 Overrides híbridos por fixture

Sobre la distribución algorítmica se pueden aplicar ajustes manuales por fixture:

- **`delta`** — sumar/restar ms al offset algorítmico.
- **`absolute`** — fijar un offset absoluto.
- **`pin`** — inmunizar un fixture frente a cambios de spread/shuffle/wings.
- **`bake`/`unbake`** — congelar la distribución algorítmica actual como overrides editables, o volver al algoritmo puro.

Este modelo *híbrido* (algoritmo + delta manual) es, hasta donde conocemos, un diferenciador frente al enfoque tradicional de "o algorítmico o manual".

---

## 5. Núcleo único de evaluación (WYSIWYG)

El editor (previsualización) y el runtime (salida DMX real) **comparten la misma función pura de evaluación** (`HephEvaluationKernel`). Esta función:

1. Evalúa todos los tracks aplicables a un fixture en el instante `t`.
2. Funde múltiples tracks del mismo atributo según su `blendMode`.
3. Resuelve color con paridad estructural respecto al árbitro de salida: tracks del mismo `paramId` se funden en orden; tracks de distinto `paramId` se mantienen separados; la resolución final sigue LTP (*last takes priority*), igual que el consolidador de nodos.

La consecuencia práctica: **la previsualización no es una simulación aproximada; es el mismo código que alimenta el hardware.** La aritmética de fusión es idéntica en ambos caminos.

---

## 6. Pipeline de salida y fusión

Los valores evaluados se emiten como *intents* a un árbitro de nodos (`NodeArbiter`) que consolida múltiples fuentes:

- **Routing espacial multicelular:** los tracks se enrutan a los nodos correctos de fixtures compuestos (p. ej., un cabezal con celdas de color/beam/wash independientes) según sus zonas.
- **Modos de fusión:** `max` (HTP), `replace` (LTP), `add`, `multiply`.
- **Capas:** la salida de efectos opera con prioridad sobre capas base, mientras que el control manual del operador mantiene la autoridad final (un *hard lock* manual no puede ser sobrescrito por la automatización).

La salida final son valores DMX (8-bit y 16-bit donde el fixture lo soporta), aplicados tras calibración, *remapping* de personalidad del fixture y *clamps* de seguridad.

---

## 7. Selene — autómata programable de disparo contextual

### 7.1 Naturaleza

Comercialmente es tentador llamarlo "IA". Técnicamente preferimos **autómata programable determinista**: Selene observa el estado musical (energía, sección, tensión, BPM, etc.), lo compara con un conjunto de reglas y descriptores, y decide qué efecto del arsenal `.lfx` disparar y cuándo. No hay caja negra entrenada; las decisiones son trazables y reproducibles.

### 7.2 Selección por descriptor (`cognitiveDNA`)

Cada `.lfx` declara su carácter en un espacio normalizado de tres ejes:

- **Aggression (A)** — de wash ambiental a strobe de asalto.
- **Chaos (C)** — de determinista/simétrico a disperso/ruidoso.
- **Organicity (O)** — de mecánico (rampas lineales) a orgánico (easing, respiración).

Selene calcula un *target* A/C/O a partir de la zona energética del momento y selecciona por **proximidad en ese espacio** (distancia euclidiana), filtrado por límites de agresividad por zona y guards de sección. Este consumo del descriptor está verificado en el pipeline de decisión (no es metadato decorativo): un mismo input musical selecciona distinto según el A/C/O declarado en el efecto.

El efecto de esto es un **arsenal extensible por el usuario**: cualquier `.lfx` que el usuario cree, con su descriptor A/C/O, entra automáticamente en el pool de candidatos de Selene. El "arsenal" crece sin tocar el código del motor.

### 7.3 Anticipación (predicción)

La capa predictiva (nombre interno: *Cassandra*) estima el tiempo hasta el próximo evento musical relevante (p. ej., un *drop*) a partir de la velocidad de energía, el tiempo en sección y un anclaje de fase de beat. Cuando la confianza es suficiente, pre-carga el efecto candidato para dispararlo en el instante exacto, con un sensor de colisión que rompe la cuenta atrás si el evento llega antes de lo previsto. La confianza es orgánica: colapsa si el BPM es inestable, sube con la estabilidad rítmica.

> Esta capa predictiva es la pieza más diferencial frente a una consola tradicional, que por doctrina es 100% manual/determinista y no anticipa nada. No la presentamos como superior a MA3 en su terreno (control manual exacto), sino como una **categoría distinta**: automatización contextual.

### 7.4 Theia (módulo asociado, congelado)

Existe un módulo construido, hoy **congelado**, llamado Theia, para control de pantallas LED con *pixel mapping*. Comparte el cerebro de Selene y el mismo contexto A/C/O, de modo que el vídeo/contenido de las pantallas puede cambiar **sincronizado y con el mismo contexto** que los efectos de iluminación. Se documenta aquí como capacidad arquitectónica existente; su estado de madurez es inferior al de Hephaestus (ver §10).

---

## 8. Disciplina de ingeniería y rendimiento

- **Cadencia fija de 44 Hz** en el motor de salida.
- **Zero-alloc en hot-paths** críticos (evaluación de curvas, fusión, render del visualizador): buffers pre-asignados para evitar presión de *garbage collector*.
- **Visualizador de fase** (oscilloscopio de la distribución) con render condicionado: a 44 Hz durante reproducción, throttle a ~12 Hz en reposo, gradientes cacheados y dimensiones observadas por `ResizeObserver` (sin *layout thrash* por frame).
- **Compilación estricta:** el módulo compila con `tsc --noEmit` sin errores en el árbol auditado.

Nota: no publicamos cifras de latencia absoluta porque dependen de la máquina y la interfaz DMX del usuario; no tenemos hardware dedicado sobre el que fijar un número honesto. Lo que sí garantizamos es la **disciplina arquitectónica** (sin asignaciones en el bucle caliente, complejidad O(1)/O(log n) en la evaluación).

---

## 9. Comparativa honesta con grandMA3

grandMA3 es la referencia del sector y, en su terreno, sigue siendo superior. Esta tabla sitúa a Hephaestus con honestidad.

| Dimensión | grandMA3 | Hephaestus V3 |
|---|---|---|
| Forma de los atributos | Steps de Phaser (Phase/Width/Attack/Decay) | Curvas Bézier cúbicas arbitrarias por keyframe — más expresivo en forma |
| Distribución espacial | Phaser + MAtricks (estándar de industria) | `PhaseConfigPro` con paridad de blocks/wings/shuffle/symmetry/direction |
| Override por fixture | En el programmer | Híbrido delta/absolute/pin + bake/unbake |
| Operación en vivo | Nativo, su razón de ser | Disparo manual vía pads/faders (otra vista) + automatización; el control en vivo es funcional pero más joven |
| Robustez / madurez | Décadas de campo | Verificado en eventos pequeños; sin el bagaje de campo de MA |
| Hardware | Consolas y nodos dedicados | **Ninguno.** Software sobre máquina genérica |
| Capa cognitiva/contextual | No existe (por doctrina) | Selene: selección por descriptor + anticipación |

Resumen honesto: **en la matemática de forma y distribución estamos a la altura; en madurez de campo, ecosistema y hardware, no.** Nuestro diferencial real es la capa de automatización contextual, que es una categoría que MA3 deliberadamente no juega.

---

## 10. Limitaciones conocidas

Las listamos sin maquillaje. Se irán corrigiendo en actualizaciones.

1. **Sin hardware dedicado.** LuxSync corre sobre máquina de propósito general. No hay procesador DSP ni nodos DMX propios. El rendimiento depende del equipo del usuario y de su interfaz DMX/Art-Net/sACN.
2. **Análisis sensorial en software.** El front-end de audio usa una **FFT radix-2** implementada en software. Es correcta y suficiente para el análisis de energía/espectro que alimenta a Selene, pero no compite con hardware de análisis dedicado en latencia o resolución.
3. **Control en vivo más joven que el motor.** El mapeo plug & play de pads/faders es funcional y se ha usado en evento real, pero su madurez es inferior a la del motor de efectos. Vive en una vista separada.
4. **Theia congelado.** El módulo de pixel mapping de LED existe y es conceptualmente potente, pero está congelado y no debe considerarse listo para producción todavía.
5. **Chronos (timecode) en V1 y obsoleto.** El módulo de timecode lleva ~3 meses sin evolucionar. No recomendado para shows que dependan de sincronía a timecode externo hasta su reescritura.
6. **Topología de fusión de dos puntos.** La previsualización funde en la app; el runtime funde en el árbitro de nodos. La *aritmética* es idéntica (paridad estructural verificada), pero son dos puntos físicos distintos de consolidación. No produce divergencia conocida hoy, pero es deuda arquitectónica a vigilar.
7. **Descriptor cognitivo a nivel de clip.** El A/C/O es por efecto completo, no por atributo. Un clip no puede declarar dos "personalidades" distintas para dimmer y color de forma independiente.

---

## 11. Interoperabilidad

- **Formato abierto `.lfx` V3:** autocontenido, con metadatos de autor, compartible entre usuarios.
- **Fixtures:** soporta perfiles de fixture con canales 8-bit y 16-bit, calibración y *remapping* de personalidad. La forja de fixtures de LuxSync (node-graph + multicell) alimenta el mismo grafo de nodos.
- **Salida:** valores DMX estándar (la capa de transporte —Art-Net/sACN/USB-DMX— depende de la configuración del usuario).

---

## 12. Conclusión técnica

Hephaestus V3 es un motor de efectos paramétricos maduro: curvas Bézier por atributo, distribución de fase por fixture con paridad MAtricks y overrides híbridos, todo sobre un núcleo de evaluación único que garantiza coincidencia entre previsualización y salida. Selene añade una capa de automatización contextual determinista que selecciona y anticipa efectos a partir de descriptores normalizados, habilitando un arsenal extensible por el propio usuario.

No reemplaza a una grandMA3 en control manual de campo ni pretende hacerlo. Ofrece, en cambio, una combinación que la consola tradicional no contempla: **un motor de forma de grado profesional acoplado a un autómata de disparo contextual**, en software, sobre hardware estándar.

Lo que está aquí descrito está verificado contra el código y probado contra DMX real. Lo que falta o es débil está en §10.

---

*LuxSync · Documento técnico. Sin humo. Las limitaciones cuentan igual que las capacidades.*
