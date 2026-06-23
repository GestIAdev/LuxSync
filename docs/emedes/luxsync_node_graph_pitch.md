# LuxSync Node Graph: Programación Visual para Fixtures Inteligentes

## Resumen Ejecutivo para Operadores GrandMA3

**LuxSync Node Graph** es un entorno de programación visual orientado a la lógica de fixtures. En lugar de escribir expresiones matemáticas en la línea de comandos de una consola, el técnico arrastra nodos, los conecta con cables y obtiene comportamientos complejos en segundos.

La premisa es simple: **lo que en GrandMA3 requiere fórmulas, sintaxis y debugging, en LuxSync se resuelve con un gesto.**

---

## ¿Qué es el Graph Node?

El Graph Node es un canvas visual donde cada bloque representa una función y cada cable representa un flujo de datos. Los nodos se evalúan en tiempo real (hot-path a 44 Hz) y producen valores DMX que viajan directamente al Aether Node Graph de la fixture.

El sistema está dividido en cinco familias de nodos:

| Familia | Función | Ejemplos |
|---------|---------|----------|
| **Input** | Fuentes de datos | DMX input, Audio Band, Beat, BPM, Energy, Time, Constant |
| **Process** | Transformaciones de señal | LFO, Smooth, Map Range, Math, Clamp, Delay, Merge, Curve |
| **Logic** | Condicionales y gating | Threshold, Gate, Switch, AND, OR, Counter |
| **Output** | Salida física | Output DMX (dimmer, pan, tilt, color, strobe, custom) |
| **Compound** | Subgrafos reutilizables | Ingenios encapsulados |

---

## Flujo de Trabajo: De la Idea al Cable en 30 Segundos

Imagina que quieres que la velocidad de apertura de un strobe de un Big Dipper sea proporcional a la energía de la banda de 100 Hz, modulada por un LFO de sierra a 0.2 Hz.

En LuxSync el flujo es literalmente visual:

```
[Audio Energy] → [LFO saw 0.2 Hz] → [Math Multiply] → [Clamp] → [Output DMX CH9: Strobe]
```

Arrastras el nodo de Audio Energy, eliges la banda de frecuencia, pasas el cable a un LFO, luego a un Math Multiply, limitas con Clamp y conectas al Output DMX. Listo.

El mismo resultado en GrandMA3 requiere escribir una expresión matemática en su línea de comandos, conocer la sintaxis exacta, manejar rangos, escalado y condiciones de saturación. Es decir, **líneas de código versus tres clicks.**

---

## Crear, Guardar y Exportar Ingenios

Un **Ingenio** es un subgrafo de nodos encapsulado como una entidad independiente y reutilizable. Es la idea de "función" aplicada a la iluminación: entradas genéricas, salidas genéricas, implementación interna oculta.

### Crear

El usuario selecciona un grupo de nodos en el canvas, define los puertos que quiere exponer al mundo exterior y el sistema genera automáticamente un Ingenio con su propio subgrafo y mapeo de puertos.

### Guardar

El Ingenio se persiste como un archivo `.luxingenio` en JSON, con metadatos (nombre, autor, categoría, tags, número de nodos internos, fecha de creación) y puede vivir en dos librerías:

- `userData/ingenios/system/` — Ingenios de fábrica, solo lectura.
- `userData/ingenios/user/` — Ingenios creados por el usuario, editables y reutilizables.

### Exportar

Un Ingenio puede exportarse e importarse entre proyectos. Al instanciarlo dentro de un fixture, el usuario solo ve los puertos expuestos y los conecta a los canales DMX reales. La complejidad interna queda sellada.

Esto convierte un patch complejo en un asset reutilizable: un rampa de audio, un chase automatizado, un dimmer suavizado, un strobe reactivo al beat. Cualquiera los puede usar sin entender su lógica interna.

---

## Capacidades Clave

- **Programación visual sin código:** No se escribe sintaxis. Se conectan bloques.
- **Evaluación en tiempo real:** El grafo se evalúa cada frame y emite valores DMX en vivo.
- **Modularidad real:** Ingenios como unidades de lógica reutilizables entre fixtures.
- **Sincronía musical nativa:** Nodos de Audio Band, Beat, BPM y Energy integrados.
- **Matemáticas y condicionales:** LFOs, operaciones aritméticas, clamps, thresholds, gates, switches, counters.
- **Hot reload:** Cambiar un nodo, un cable o un parámetro se refleja inmediatamente en el fixture.
- **Exportación portable:** Ingenios y fixtures completos exportables a JSON.

---

## Limitaciones Actuales

- **Curva de aprendizaje inicial:** Aunque es visual, el técnico debe entender qué es una señal normalizada, qué hace un LFO y por qué un clamp evita saturar un canal DMX.
- **Feedback visual limitado:** El canvas muestra valores en los puertos, pero aún no hay un osciloscopio integrado ni un inspector de señales en tiempo real.
- **Biblioteca de Ingenios pequeña:** El sistema soporta Ingenios, pero la librería de fábrica aún es reducida. Cada usuario construye la mayoría desde cero.
- **Depuración básica:** Cuando un grafo no produce el resultado esperado, la herramienta de debug es revisar nodo por nodo. No hay breakpoints ni trazas de flujo de datos.
- **Integración con consolas externas:** LuxSync emite DMX, pero no se integra como una fixture nativa dentro de GrandMA3. El operador de GrandMA3 sigue viendo LuxSync como un dispositivo externo.

---

## Margen de Mejora

1. **Librería de Ingenios preconstruidos:** Packs por categoría (audio-reactive, movement, color, strobe, chase) para reducir aún más el tiempo de diseño.
2. **Osciloscopio visual:** Un panel flotante que muestre la curva de cualquier cable en tiempo real.
3. **Preset browser:** Guardar estados completos del grafo como presets recallables durante el show.
4. **Macro recording:** Grabar movimientos de faders o automaciones y convertirlos en nodos.
5. **Importación/exportación a GrandMA3:** Generar macros o plug-ins compatibles para que GrandMA3 pueda consumir directamente la lógica de LuxSync.
6. **Colaboración en la nube:** Repositorio compartido de Ingenios entre equipos de producción.

---

## La Comparación con GrandMA3

| Tarea | GrandMA3 | LuxSync Node Graph |
|-------|----------|---------------------|
| Rampa de audio-reactive strobe | Escribir expresión matemática | Tres cables |
| Cambiar frecuencia del modulador | Editar línea de comandos | Slider del nodo LFO |
| Reutilizar lógica en otro fixture | Copiar y pegar código, ajustar variables | Exportar e importar Ingenio |
| Probar variación rápida | Recompilar / reenviar | Desconectar y reconectar cables en vivo |
| Compartir con otro técnico | Enviar macros, explicar sintaxis | Enviar archivo `.luxingenio` |

En una consola tradicional, el 80% del tiempo se invierte en **formular, depurar y adaptar expresiones**. En LuxSync, ese tiempo se invierte en **decidir qué señales conectar**. Es por eso que el flujo de diseño se acelera un **90%** en escenas donde intervienen audio, movimiento, color y lógica condicional.

---

## Mensaje para la Productora

> "Tomás un nodo de Audio Energy, lo pasas por un LFO en onda de sierra a 0.2 Hz, lo metes en un Math Multiply, lo limitas con un Clamp y tiras el cable directo al puerto de entrada del nodo rojo Output DMX.
>
> Mirás al operador jefe de la GrandMA3 y le decís: 'Ahí tenés tu rampa. Le acabo de decir a la chapa del Big Dipper que la velocidad de apertura es matemáticamente proporcional a la energía de la banda de los 100 hercios, modulada por un oscilador de baja frecuencia. Escribime esa misma expresión matemática en la línea de comandos de tu GrandMA3 ahora mismo. Te espero sentado, tómate tu tiempo'."

Esa escena no es ciencia ficción. Es el workflow diario de LuxSync Node Graph.

---

## Conclusión

LuxSync Node Graph no reemplaza a una consola como GrandMA3. La complementa: donde GrandMA3 es la herramienta de ejecución del show, LuxSync es la fábrica de comportamientos.

Para productoras que trabajan con fixtures custom, iluminación reactiva o instalaciones generativas, LuxSync convierte horas de programación en minutos de cableado visual. Ese es el 90%.
