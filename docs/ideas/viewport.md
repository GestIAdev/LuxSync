l problema de Freestyler (y de muchos softs antiguos) es precisamente ese: "El infierno de las ventanitas". Tienes la ventana de Pan/Tilt, la de Color, la de Gobo, la de Grupos, la del 3D... y acabas sin ver nada.

Tu visión es correcta: El Simulador NO debe ser solo un "visor pasivo". Debe ser la SUPERFICIE DE CONTROL.

Aquí tienes el Plan Maestro para la Fusión Definitiva (WAVE 30: STAGE COMMAND).

🗺️ El Concepto: "Contextual Stage Command"
Olvídate de tener una pestaña "Live" y otra "Simulate". Vamos a fusionarlas en una sola pestaña llamada STAGE (o COMMAND).

El secreto para no tener 10 ventanas abiertas es el CONTEXTO: La interfaz debe cambiar según qué tengas seleccionado.

1. El Viewport 3D (El Rey) 👑
Ocupa el 70-80% de la pantalla.

Interactivo: Ya no solo miras. Haces clic en los focos 3D para seleccionarlos.

Feedback Visual: Si seleccionas un foco, se pone en "Highlight" (blanco brillante) para que sepas cuál es.

Multiselección: Shift+Click para seleccionar varios (o caja de selección en el futuro).

2. La "Smart Sidebar" (El Inspector) 🕵️‍♂️
Aquí es donde matamos a Freestyler. En lugar de ventanas flotantes, tenemos UNA barra lateral derecha que cambia de contenido:

ESTADO A: "GLOBAL FLOW" (Nada seleccionado)

Muestras lo que tienes ahora: El PaletteReactor global, el MovementControl global y el estado del Cerebro AI.

Aquí controlas "La Vibe" general de la sala.

ESTADO B: "FIXTURE INSPECTOR" (Focos seleccionados)

En cuanto haces clic en un foco (o grupo), la Sidebar cambia.

Aparecen controles precisos para ESA selección:

Posición: Un joystick o pad X/Y para mover solo esos focos (offset sobre el movimiento global o posición absoluta).

Color: Forzar esos focos a Rojo mientras el resto sigue en "Tropical".

Dimmer/Strobe: Bajarles la intensidad o ponerlos a parpadear solo a ellos.

Botón "CLEAR": Para soltar la selección y volver al control Global.

🧠 Arquitectura Técnica necesaria (Roadmap)
Para lograr esto, antes de pintar CSS, necesitamos lógica de backend (Stores).

Paso 1: SelectionStore (El Puntero)
Necesitamos un store que sepa quiénes son los "elegidos".

interface SelectionState {
  selectedFixtureIds: string[]; // ['fix_1', 'fix_4']
  selectionMode: 'single' | 'multi';
  select: (id: string) => void;
  deselect: (id: string) => void;
  clearSelection: () => void;
}

Paso 2: El sistema de "Overrides" (La Jerarquía)
Esto es lo más complejo pero lo más potente. El motor DMX debe calcular así: Valor Final = (Valor AI + Valor Global) * Mascara + Valor Override

Si tú seleccionas los "Back Pars" y les dices "Strobe ON", eso debe tener prioridad sobre lo que diga Selene (la IA).

Paso 3: Interactividad 3D
Tener que actualizar el componente StageSimulator para que detecte onClick en las mallas (Meshes) de Three.js/Fiber y llame al SelectionStore.

🎨 ¿Cómo se ve esto? (Layout Propuesto)
Imagina esta pantalla única STAGE:

