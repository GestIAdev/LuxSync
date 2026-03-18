# 🕰️ Chronos — El Timecoder que no Necesita Consola de 70.000€

**Documento:** Ficha de producto — Chronos, Motor de Sincronización Temporal  
**Audiencia:** DJs, técnicos de iluminación, salas, estudios, promotores  
**Versión:** Beta 1.0 — Marzo 2026

---

## El contexto que necesitas antes de leer esto

Existe un referente absoluto en la industria del control de iluminación profesional para sincronización temporal: el **grandMA3** de MA Lighting. Consolas que arrancan en los 15.000€ y llegan fácilmente a los 70.000€ con el hardware que necesitan para funcionar al nivel que prometen. Son excelentes. Y son el estándar de los festivales más grandes del mundo, las giras de los artistas más grandes del planeta.

Cuando diseñamos Chronos, le pedimos a nuestro auditor técnico que lo evaluara usando el grandMA3 como **barra de referencia**. No porque seamos ingenuos — sabemos perfectamente que no vendemos lo mismo, ni al mismo precio, ni para el mismo tipo de instalación. Lo hicimos porque si algo está cerca de ese nivel en software, nos interesa saber cuánto.

El resultado fue **85 sobre 100 usando el grandMA3 como nota de corte.**

Este documento te explica qué significa eso en términos prácticos, qué hace Chronos realmente bien, y dónde están sus límites honestos.

---

## ¿Qué es Chronos?

Chronos es el módulo de sincronización temporal de LuxSync. Responde a una pregunta fundamental del espectáculo en directo:

**¿Cómo haces que las luces y la música vayan perfectamente al compás — siempre, sin importar de dónde venga el clock?**

Puede recibir tiempo de cuatro fuentes distintas:

| Fuente | ¿Qué es? | ¿Cuándo se usa? |
|---|---|---|
| 🔊 **LTC / SMPTE** | Señal de timecode en audio (el mismo que usan los estudios de cine y televisión) | Giras con playback de audio pre-grabado, shows con video sincronizado |
| 🎹 **MTC (MIDI Timecode)** | Timecode por cable MIDI | Integración con DAWs (Ableton, Logic, Cubase), módulos de hardware |
| 🌐 **Art-Net Timecode** | Timecode por red UDP/Ethernet | Rigs grandes con múltiples ordenadores, festivales con red de datos |
| 🥁 **MIDI Clock** | El "metrónomo" del mundo MIDI | Sintetizadores, drum machines, cajas de ritmos |

Y si no hay señal externa de ningún tipo, Chronos genera su propio reloj interno usando el AudioContext del hardware de sonido — la misma fuente que usa Ableton Live. Preciso, estable, sin drift significativo.

**Un clic en el TacticalHub** — el panel central de control — y cambias de una fuente a otra en tiempo real, sin interrumpir el show.

---

## Lo que hace que Chronos sea diferente

### El Timeline Reactivo — una categoría nueva

Aquí es donde Chronos diverge radicalmente de todo lo que existe en el mercado.

grandMA3, Resolume, ShowCAD — todos operan con lo que llamaremos **timeline determinista**: programas el efecto en el minuto 2:34, a las 2:34 se ejecuta. Exacto, predecible, repetible. Perfecto para tours con un setlist fijo que suena igual cada noche.

Chronos tiene eso. Y además tiene algo que ningún otro tiene: el **modo Whisper**.

En modo Whisper, el timeline de Chronos no *dicta* lo que hace la iluminación — lo *sugiere*. Por debajo sigue corriendo Selene IA, analizando el audio en tiempo real. El timeline aporta el contexto temporal (estamos en el minuto 2:34 del show, en la sección de buildup), y Selene usa ese contexto para tomar mejores decisiones reactivas.

El resultado: **un show que tiene la estructura de un show programado, pero la vida de un show en tiempo real.**

Esto no existe en ningún competidor del mercado. grandMA3 es determinista por diseño — es su virtud y su límite simultáneamente.

---

### El análisis de audio en la timeline — 7 bandas con filtros de grado profesional

Chronos incluye análisis de audio offline del track que estés usando como referencia temporal. No es un visualizador de forma de onda bonito — es el mismo motor FFT que usa el análisis en tiempo real de LuxSync, aplicado a tus archivos de audio.

7 bandas de frecuencia separadas con filtros Linkwitz-Riley de 4º orden (24 dB/oct) — el tipo de crossover que encuentras en sistemas de sonido profesionales, no el Butterworth simple que usa Avolites o las 3 bandas sin filtro de Resolume.

Eso significa que cuando colocas un efecto en la timeline, puedes vincularlo a lo que pasa en el sub-bass, en los medios, en los agudos. Con precisión quirúrgica.

> **Referencia:** Resolume Arena 7 tiene análisis de audio con 3 bandas sin crossovers. grandMA3 no tiene análisis de audio nativo en su timeline. **Ninguno tiene esto.**

---

### El protocolo implementado desde cero — cero dependencias de terceros

Todo el stack de protocolo (LTC, MTC, Art-Net, MIDI Clock) está escrito línea a línea en TypeScript sobre las APIs estándar de Chromium y Node.js. No hay librerías externas de terceros.

Eso tiene consecuencias prácticas:
- **Cero riesgo de licencia.** El código es nuestro.
- **Control total del comportamiento.** Podemos corregir, adaptar y extender.
- **Sin cajas negras.** Si algo falla, sabemos exactamente dónde.

El decoder LTC, por ejemplo, implementa decodificación bi-phase mark con filtrado IIR adaptativo, detección del sync word según el estándar SMPTE 12M §3.2, y extracción BCD correcta de los 8 campos de timecode. Todo verificado contra el estándar.

---

### Rendimiento que no da sorpresas

Antes de la versión actual, Chronos tenía un problema de rendimiento: buscar los clips activos en un timeline grande requería escanear la lista completa cada frame (60 veces por segundo). Con un show grande, eso empezaba a notarse.

Se implementó un índice de límites de clips (`ClipBoundaryIndex`) con búsqueda binaria. El resultado:

| Operación | Antes | Después |
|---|---|---|
| Buscar clips activos (show pequeño) | O(N) — escaneo completo | O(1) — cache hit |
| Buscar clips activos (show grande, 200+ clips) | O(N) — lento | O(log N) — instant |
| Ordenar automation lanes | 1.200 arrays temporales/segundo en GC | 0 — eliminado del hot path |

En un show de 3 horas con cientos de clips, el tiempo de CPU dedicado a Chronos por frame es **~0.13ms de 16.67ms disponibles**. El 99% del tiempo de frame está libre para renderizar la interfaz, enviar DMX, y correr Selene IA.

---

## La curva de aprendizaje — esto sí importa

grandMA3 es una herramienta extraordinaria. También tiene una curva de aprendizaje que se mide en semanas de formación, certificaciones oficiales, y manuales técnicos de cientos de páginas. No es una crítica — es el precio natural de esa profundidad.

Chronos está diseñado para que en menos de un día estés operándolo sin limitaciones. No porque sea simple — tiene todo el protocolo stack que acabas de leer — sino porque está diseñado pensando en el operador que trabaja solo o en equipos pequeños.

El **TacticalHub** centraliza todo el control de sincronización en un único panel: selector de fuente de clock, display de timecode en tiempo real, selector de entrada de audio para LTC, selector de puerto MIDI, estado de Art-Net, control del MIDI Clock Master. Todo visible, todo accesible, sin navegar por niveles de menú.

---

## Lo que Chronos no tiene (todavía) — sin letra pequeña

Porque prometimos honestidad y la mantenemos:

**Comparado con grandMA3:**

- **Precisión de reloj:** grandMA3 usa RTOS con resolución de 100 microsegundos y cristal sincronizado por NTP. Chronos usa AudioContext (la misma fuente que Ableton Live) con resolución de ~16ms. Para DMX — que actualiza a 22ms — es más que suficiente. Para control de audio sample-accurate, no.

- **LTC avanzado:** grandMA3 detecta reproducción en reversa y a velocidades variables (shuttle, rewind). Chronos decodifica LTC en reproducción normal hacia adelante. Para la mayoría de usos en espectáculo en directo, esto no es limitación. En producción de broadcast de alto nivel, sí lo es.

- **Undo ilimitado:** El sistema de deshacer en el recorder actualmente es de un nivel. grandMA3 tiene 100+ niveles. Esto está en el roadmap próximo.

- **Tracks fijas:** Chronos tiene 7 tracks. grandMA3 tiene tracks ilimitadas. Para shows de complejidad media-alta, 7 tracks es suficiente. Para producciones masivas con decenas de universos, es una limitación real.

- **MIDI Clock a BPM alto:** Por encima de 160 BPM, el jitter del MIDI Clock Master sube a ~6ms. Para techno y EDM en el rango habitual (120-145 BPM), funciona perfectamente. Para géneros más rápidos usando Chronos como master de hardware externo, hay que tenerlo en cuenta.

---

## ¿Para quién es Chronos?

**Para el DJ o artista que trabaja con backing tracks** y quiere que su iluminación esté sincronizada fotograma a fotograma con la música, sin necesitar una consola de 30.000€ y un técnico dedicado.

**Para la sala o el club** que quiere shows pre-programados que se adaptan dinámicamente a la energía de la noche — no un loop predeterminado que suena igual a las 12 que a las 4 de la madrugada.

**Para el técnico en giras medianas** que necesita sincronización por MTC o LTC con el sistema de audio, integración con su DAW, y un sistema que pueda aprender y operar en un día, no en un mes de formación.

**Para festivales y eventos con infraestructura de red** que ya tienen Art-Net desplegado y quieren conectar LuxSync a ese ecosistema sin fricciones.

**Para quien no es grandMA3** — y lo sabe, y no lo necesita.

---

## Incluido en LuxSync Suite

Chronos no se vende por separado. Viene integrado en la suite completa de LuxSync, junto con el análisis de audio en tiempo real, Selene IA, el motor de efectos, y la arquitectura DMX completa.

La misma inteligencia de Selene que opera en tiempo real, con la capacidad de Chronos de estructurar y programar el show cuando lo necesitas. Modo reactivo cuando quieres vida. Modo programado cuando necesitas precisión. Modo híbrido cuando quieres los dos a la vez.

Eso sí es nuevo.

---

## Beta Testing — Descarga Disponible Ahora

La beta completa de LuxSync, con Chronos incluido, está disponible a través de **MG Music & Light**.

**[→ Descarga en mgmusicandlight.com]**

---

*LuxSync — Developed by GestIAdev*  
*"No estamos construyendo un timeline. Estamos construyendo una categoría."*
