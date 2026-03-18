# 🎧 LuxSync — El Oído que tu Show Necesitaba

**Documento:** Ficha de producto — Capa de Análisis de Audio  
**Audiencia:** DJs, técnicos de iluminación, promotores, productores de eventos  
**Versión:** Beta 1.0 — Marzo 2026

---

## "Las luces que escuchan de verdad."

La mayoría del software de iluminación del mercado reacciona al volumen.  
LuxSync **escucha la música.**

Hay una diferencia enorme entre las dos cosas, y se nota en el dancefloor en los primeros cinco minutos.

---

## ¿Qué es la Capa Sensorial de LuxSync?

Es el motor de análisis de audio que alimenta toda la inteligencia de la suite. Corre en tiempo real, sin pre-análisis, sin pistas pre-procesadas, sin trucos. Pones el cable de línea, suena la música, y LuxSync empieza a entender lo que está pasando.

No solo detecta golpes de bombo. Entiende **qué nota suena, qué sección de la canción es, si viene un drop, qué mood tiene la progresión armónica, y cuándo va a cambiar todo eso** — con hasta 4 segundos de antelación.

---

## Lo que hace que el resto del mercado parezca de otra época

### 🥁 Detección de BPM que realmente funciona en directo

El BPM no es solo contar golpes por minuto. Un track de Boris Brejcha a 185 BPM "se siente" a 123 BPM por cómo está construido rítmicamente. LuxSync lo sabe.

Nuestro sistema **rBPM** (BPM relativo musical) analiza los patrones rítmicos reales y "pliega" el tempo al bolsillo de BPM que percibe el público. Las luces van a compás con la música tal y como la siente la gente en la pista — no como la ven los metrónomos.

Y no para ahí: una vez que LuxSync tiene el tempo, lo **predice**. Utiliza un sistema PLL (Phase-Locked Loop, la misma tecnología que los equipos de hardware dedicado de Pioneer) para anticipar el siguiente beat **23 milisegundos antes de que suene**, compensando las latencias del sistema. Las luces llegan exactas, no tarde.

> **¿Qué hace la competencia?**  
> GrandMA3 — la consola de referencia del sector — usa tap-tempo manual o clock MIDI externo. No analiza audio. Avolites Titan tiene un "audio trigger" básico de umbral fijo. SoundSwitch (Denon/inMusic) analiza offline, necesita los tracks preparados antes del show. **Ninguno predice. LuxSync predice.**

---

### 🎵 Análisis Tonal en Tiempo Real — El que nadie más tiene

LuxSync detecta la **tonalidad, la escala y el modo** de la música mientras suena.

Esto no es magia — es un chromagrama calculado directamente desde el espectro FFT, mapeando cada frecuencia a su pitch class exacto mediante temperamento igual. El resultado son 12 valores de energía que representan las notas del piano, actualizados en tiempo real.

Con eso, LuxSync sabe si la música está en Mi menor (→ oscuro, dramático), en Re mayor (→ eufórico, energético), en Frigio (→ Spanish/Exotic), en Dórico (→ Jazz, sofisticado). Ese **mood musical** se traduce directamente en paletas de color y dinámicas de movimiento en los fixtures.

También detecta **disonancia** — cuando suena un tritono (el "diabolus in musica"), LuxSync lo identifica y puede disparar efectos de tensión dramática en el momento justo.

> **¿Qué hace la competencia?**  
> GrandMA3, Avolites y ChamSys: ninguno tiene análisis tonal. Cero. SoundSwitch tiene análisis de tonalidad, pero solo offline, con ML pre-entrenado sobre el track. **En tiempo real y en vivo, LuxSync no tiene competencia directa en este punto.**

---

### 🔮 Predicción de Estructuras — PROJECT CASSANDRA

Esta es la feature que más sorprende a los técnicos cuando la ven por primera vez.

LuxSync predice **drops, buildups y breakdowns con hasta 4 segundos de antelación.**

Lo hace combinando tres fuentes de información simultáneamente:
- El historial de secciones de la canción (qué ha pasado en los últimos 30 segundos)
- Las tendencias del espectro (el brillo sube, los graves desaparecen → buildup inminente)
- Los patrones energéticos (el ratio de crestas indica que la tensión está acumulándose)

Cuando la probabilidad de un drop supera el 65%, LuxSync pre-computa el efecto óptimo y lo tiene listo en memoria. Cuando el drop llega, la ejecución es instantánea — sin lag, sin retraso perceptible.

> **Para ponerlo en contexto:** El Pioneer TORAIZ SQUID, hardware de referencia de Pioneer DJ, predice UN beat hacia adelante. LuxSync predice estructuras de 4 a 8 compases. Es una categoría diferente.

---

### 🔊 Un FFT que compite con C++ — desde JavaScript

Somos transparentes: LuxSync no usa hardware DSP dedicado. Corre en el ordenador del operador, enteramente en software.

Lo que sí hacemos es exprimir ese software al máximo:

- **Ventana Blackman-Harris 4 términos** — la misma que los sistemas de análisis profesionales de referencia. Supresión de lóbulos laterales de **-92 dB**, frente a los -31 dB de la ventana Hann que usa la mayoría del software del sector. Menos "sangrado" entre frecuencias = más precisión en la separación de instrumentos.

- **7 bandas con filtros Linkwitz-Riley 4º orden (24 dB/oct)** — el tipo de crossover que usan internamente las consolas MA Lighting para separar las bandas de energía. Sub-bass, bass, low-mid, mid, high-mid, presence, treble, cada uno con su propia dinámica y su propio set de fixtures asignados.

- **Latencia de análisis: ~0.6 ms por frame.** Con un presupuesto de 2 ms, LuxSync usa menos de un tercio del tiempo disponible. Hay margen. El sistema es estable.

- **Zero-allocation en el hot path.** El pipeline de análisis no genera basura de memoria mientras corre. Sin pausas del GC, sin micro-stutters. Los técnicos que han visto el código interno lo califican como "una proeza de ingeniería pragmática."

| Lo que mide | LuxSync | Referencia industria |
|---|---|---|
| Ventana espectral | Blackman-Harris (-92 dB) | Hann (-31 dB) — mayoría del software |
| Resolución frecuencial | ~10.77 Hz/bin | ~21.5 Hz (Avolites) / ~10.77 Hz (ChamSys) |
| Crossover | LR4 24 dB/oct | Butterworth 2º (12 dB/oct) — Avolites |
| Análisis tonal real-time | ✅ Sí | ❌ Ninguno del mercado |
| Predicción de secciones RT | ✅ Sí (2–4s horizonte) | ❌ Ninguno del mercado |
| Predicción de beat | ✅ PLL + 23ms lookahead | ❌ Reactivo (todos los demás) |
| Pre-análisis requerido | ❌ No | ✅ SoundSwitch: obligatorio |

---

## ¿Para quién es esto?

**Para el DJ que actúa solo** y quiere que sus luces respondan a lo que pincha sin tener que programar nada. LuxSync lo hace automáticamente — el chromagrama elige los colores, el rBPM elige el tempo, Selene IA elige los efectos. Tú pinchas. Las luces van solas.

**Para el técnico de iluminación** que trabaja con artistas en gira y quiere un sistema que entienda la música en lugar de uno que solo cuente golpes. Que detecte cuando la canción va a explotar y prepare la rig antes de que pase.

**Para el club o la sala** que quiere inteligencia automática de noche, pero control manual total cuando el espectáculo lo requiere. LuxSync no te quita el volante — te da un copiloto que escucha la música mejor que nadie.

**Para festivales y giras grandes:** la capa sensorial alimenta un motor de efectos y una arquitectura DMX que escala desde 1 fixture hasta rigs completos. La misma inteligencia, más potencia de salida.

---

## La honestidad como política

Porque no vendemos humo:

- **La precisión absoluta de BPM** no alcanza los ±0.01 BPM de un CDJ-3000 con DSP de hardware dedicado. En condiciones normales de directo, la diferencia es imperceptible. En análisis de laboratorio, el hardware gana. Dicho esto, ningún software del mercado tampoco lo alcanza — estamos al mismo nivel que los mejores, sin hardware dedicado.

- **El sistema requiere señal de línea directa** para funcionar al máximo nivel. Con micrófono ambiente funciona (graciosamente degradado), pero la experiencia óptima es con cable del mixer o la interfaz de audio. Lo mismo recomienda GrandMA3 en su documentación.

- **LuxSync es software para ordenador,** no hardware embebido. Eso significa que necesita una máquina dedicada para el show — lo que de todas formas es la práctica habitual en iluminación profesional.

---

## Lo que dicen los que lo han evaluado

> *"LuxSync compite en una categoría diferente. No intenta ser un DSP de hardware — intenta ser un cerebro musical autónomo que opera en tiempo real sobre audio en vivo. En esa categoría, no tiene competidor directo en el mercado de iluminación."*

> *"El concepto rBPM con plegado polirítmico es innovador y musicalmente correcto. El PLL anticipatorio con lookahead de 23ms es una feature que no existe en ningún competidor de software de iluminación en el mercado."*

> *"En inteligencia musical — detección de secciones, predicción multi-segundo de estructuras, análisis tonal real, mood mapping y chromagrama nativo — supera a todo lo que existe actualmente en el mercado de iluminación profesional."*

— *Evaluación técnica independiente, Marzo 2026*

---

## Beta Testing — Descarga Disponible

La beta de LuxSync está disponible ahora mismo a través de **MG Music & Light**.

Es una beta real — funcional, estable, probada en directo. No es un demo recortado ni una versión de marketing. Es la suite completa, con la capa sensorial descrita aquí, el motor de efectos Selene IA, el editor de escenarios y la arquitectura DMX, lista para que la pruebes en tu equipo.

**[→ Descarga en mgmusicandlight.com]**

---

*LuxSync — Developed by GestIAdev*  
*"La música tiene estructura. Ahora tu iluminación también la entiende."*
