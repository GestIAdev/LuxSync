# ⚒️ Hephaestus — El Editor de Efectos que Diseña lo que Imaginas

**Documento:** Ficha de producto — Hephaestus, Motor de Efectos Paramétricos  
**Audiencia:** Diseñadores de iluminación, técnicos de gira, operadores de sala, artistas visuales  
**Versión:** Beta 1.0 — Marzo 2026

---

## La diferencia entre efectos y arte

Todo el software de iluminación tiene efectos. Algunos tienen más, algunos tienen menos. La pregunta que ninguno responde bien es: **¿y si el efecto que necesitas no existe?**

La respuesta habitual es: escoge el más parecido y conforma.

La respuesta de Hephaestus es: **dibújalo.**

Hephaestus es un motor de efectos paramétricos con editor de curvas Bézier. En lugar de un catálogo fijo de movimientos y transiciones predefinidas, te da las herramientas matemáticas para construir cualquier forma de onda que puedas imaginar — y las conecta directamente a tus fixtures vía DMX.

---

## Qué es una curva Bézier y por qué importa

Cuando Pixar anima una pelota que rebota, no escoge entre "rebote suave" y "rebote brusco" en un menú. Dibuja la curva de movimiento exacta que quiere en un editor gráfico, con puntos de control que definen exactamente cómo acelera y desacelera en cada fotograma.

Eso es lo que hace Hephaestus con tus fixtures.

Cada parámetro de cada fixture — intensidad, pan, tilt, zoom, color, gobo, strobe — puede tener su propia curva de comportamiento temporal, dibujada por ti con la precisión de un editor de animación profesional:

- **Handles de Bézier arrastrables** — los mismos que reconocerás si has usado After Effects, Blender o cualquier DAW moderno
- **Overshoot y bounce reales** — la curva puede salirse de los límites [0,1] para crear efectos elásticos que ningún preset puede replicar
- **Curvas físicas** — el template de "bounce" no es una aproximación artística, es amortiguamiento exponencial real: $e^{-\text{decay} \cdot t} \times |\cos(\omega t)|$
- **Interpolación Newton-Raphson** — el mismo algoritmo matemático que usa el motor de CSS de Google Chrome para las transiciones suaves. Cuatro iteraciones, error menor a 0.001. Sub-pixel.

---

## Los 10 templates — el punto de partida, no el límite

Si no quieres empezar desde cero, Hephaestus incluye 10 formas de onda matemáticamente correctas listas para usar y editar:

| Template | Descripción |
|---|---|
| 〜 **Sine** | Onda senoidal pura. Movimiento orgánico, respiración de luz. |
| △ **Triangle** | Subida y bajada lineal. Limpio, geométrico. |
| ╱ **Sawtooth** | Rampa ascendente con caída instantánea. Tensión → release. |
| □ **Square** | On/Off puro. Strobe controlado, pulso. |
| ⬛ **Pulse** | Ancho de pulso variable. Entre el square y el silencio. |
| 🏀 **Bounce** | Rebote con física real. La pelota que cae de verdad. |
| ⌒ **Ease-In-Out** | Aceleración y desaceleración suave. El movimiento humano. |
| ↗ **Ramp Up** | Escalada gradual. Buildup perfecto. |
| ↘ **Ramp Down** | Descenso gradual. Fade controlado. |
| — **Constant** | Valor fijo. Referencia y base para modulación. |

Y si ninguno es exactamente lo que necesitas, los editas. Los 10 son puntos de partida, no jaulas.

> **Para referencia:** grandMA3, la consola de referencia del sector profesional, incluye 4 formas de onda en sus Phasers: Sine, PWM, Ramp, Random. Hephaestus tiene 10 — y además curva libre. No es una crítica a grandMA3, es simplemente un paradigma diferente: ellos diseñaron para control live con encoders físicos, nosotros diseñamos para diseño visual con ratón.

---

## Phase Distribution — la magia de los efectos de grupo

Un efecto bonito en un fixture es una luz. El mismo efecto en 24 fixtures con desfase temporal calculado es un espectáculo.

Hephaestus incluye un sistema de distribución de fase que toma cualquier curva y la distribuye entre tus fixtures de forma automática:

**Linear** — el fixture 1 va primero, el último va el último. La ola clásica.

**Mirror** — los fixtures de los extremos van juntos hacia el centro. Simetría perfecta para rigs simétricos.

**Center-Out** — el centro explota primero, los extremos llegan después. El efecto "big bang" de los drops.

**Wings** — divide el rig en sub-grupos y aplica el patrón dentro de cada uno. Para rigs complejos con secciones diferenciadas.

El desfase se calcula **una sola vez cuando lanzas el efecto**, no cada fotograma. El sistema es completamente determinista: misma configuración, mismo resultado siempre.

---

## Reactivo al audio — la integración que cambia todo

Aquí es donde Hephaestus se separa definitivamente de cualquier motor de efectos paramétricos del mercado.

Los keyframes de cualquier curva pueden tener un **binding de audio**. Eso significa que el valor de ese punto en la curva no es fijo — varía en tiempo real según lo que está sonando.

Vincula la intensidad de un efecto al sub-bass. Vincula el zoom al brillo espectral. Vincula la velocidad del gobo a la energía de los medios. La curva define la *forma* del efecto, el audio define la *intensidad* en cada momento.

grandMA3 no tiene análisis de audio en sus Phasers. Ningún sistema de curvas paramétrico del mercado lo tiene. **Esta combinación — diseño de forma + reactividad al audio — es exclusiva de LuxSync.**

---

## Lo que viene: Hephaestus + Selene IA

Esta es la integración que más nos emociona del roadmap próximo.

Hoy, Selene IA tiene un catálogo de 47 efectos core que usa para tomar sus decisiones. Son buenos, están calibrados, funcionan. Pero 47 es 47.

En la próxima actualización, **cualquier efecto que diseñes en Hephaestus se puede registrar en el catálogo de Selene**. Dibujas la curva, defines su ADN (Agresión, Caos, Organicidad), y Selene lo aprende. A partir de ese momento, ese efecto personalizado entra en su proceso de decisión — si el momento musical lo pide, Selene lo dispara.

Tu estética visual, integrada en la inteligencia de la IA.

La infraestructura para esto ya existe en el código base. Es una integración planificada, no una promesa sin fundamento.

---

## La escala — de un solo fixture a rigs completos

Hephaestus escala sin fricciones:

- **Un fixture:** curva directa, control total de cada parámetro.
- **Un grupo de fixtures:** Phase Distribution automática con los modos que ya conoces.
- **Múltiples grupos independientes:** Cada clip puede tener su propia selección de fixtures y su propia configuración de fase.
- **Pan y Tilt en 16 bits:** Hephaestus envía canal coarse + canal fine a los moving heads que lo soporten. 65.536 posiciones de resolución en lugar de 256. El movimiento es suave.

---

## Honestidad: lo que Hephaestus no hace (todavía)

Porque seguimos con la misma política:

**Sin Speed Master en tiempo real.** En grandMA3, hay un encoder físico que cambia la velocidad del efecto mientras está corriendo. En Hephaestus, cambiar la velocidad requiere parar el clip y relanzarlo con nueva duración. Para shows con mucha improvisación live, esto es una limitación real. Está en el roadmap.

**Sin Phase Individual por fixture.** Hephaestus calcula el desfase algorítmicamente. grandMA3 permite asignar un offset manual a cada fixture individualmente. Para configuraciones muy específicas, esto da menos control granular.

**47 efectos en el catálogo de Selene.** Son 47 efectos cuidadosamente calibrados en el espacio 3D del ADN. No son pocos para empezar — pero sabemos que no son suficientes para todos los estilos. La integración Hephaestus→Selene que describimos arriba resolverá esto de forma permanente.

---

## ¿Para quién es Hephaestus?

**Para el diseñador de iluminación** que tiene una visión específica y no quiere conformarse con los presets de nadie. Que sabe exactamente cómo quiere que se mueva ese moving head en ese momento, y necesita las herramientas para describirlo con precisión.

**Para el artista visual** que trata la luz como un medio de expresión, no como una función de un equipo. Que quiere diseñar movimientos con la misma libertad con la que un animador diseña una transición en After Effects.

**Para el técnico de sala o gira** que quiere efectos de grupo sofisticados — olas, simetrías, center-outs — sin pasar horas programando manualmente cada fixture.

**Para quien trabaja solo**, sin un equipo de programadores detrás, y necesita un sistema que le permita crear efectos complejos y hermosos en tiempo razonable, con una curva de aprendizaje de horas, no de semanas.

---

## Incluido en LuxSync Suite

Hephaestus no se vende por separado. Forma parte de la suite completa de LuxSync junto con el análisis de audio en tiempo real, Selene IA, Chronos Timecoder, y la arquitectura DMX completa.

Los efectos que diseñas en Hephaestus se integran directamente con el resto de la suite. Chronos puede programarlos en una timeline. Selene puede aprenderlos (próximamente). El análisis de audio puede modularlos en tiempo real.

Cada módulo amplifica a los demás.

---

## Beta Testing — Descarga Disponible Ahora

La beta completa de LuxSync, con Hephaestus incluido, está disponible a través de **MG Music & Light**.

**[→ Descarga en mgmusicandlight.com]**

---

*LuxSync — Developed by GestIAdev*  
*"Newton y Bézier en la misma forja. Diseña lo que imaginas."*
