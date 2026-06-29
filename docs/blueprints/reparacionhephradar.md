┌──────────────────────────────────────────────────────────────────────────────────┐
 │ NIVEL 1: EL CEREBRO ESPACIAL (useHephPreview.ts)                                 │
 │ 1. Inyectar 16 focos virtuales por defecto si la zona es [ ALL ].                │
 │ 2. Crear un Ring Buffer (memoria circular) O(1) de los últimos 60 fotogramas.  │
 │ 3. Almacenar el PhaseOffsetMs real calculado por las matemáticas de la V3.       │
 └────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │ (Exponiendo datos cuánticos)
                                          ▼
 ┌──────────────────────────────────────────────────────────────────────────────────┐
 │ NIVEL 2: EL CANAL DE COMUNICACIÓN (LabTab.tsx)                                   │
 │ 1. Elevar el estado selectedFixtureId al padre para gobernar toda la vista.      │
 │ 2. Recibir la telemetría real y pasársela al chasis Eurorack izquierdo.          │
 │ 3. Forzar lectura canónica de focos físicos del stageStore en cada renderizado.  │
 └────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │ (Paso de props balístico)
                                          ▼
 ┌──────────────────────────────────────────────────────────────────────────────────┐
 │ NIVEL 3: EL HUD DE COMBATE (HephRadar.tsx & PhaseControls.tsx)                  │
 │ 1. Extirpar el cuadro de telemetría de albañil incrustado en el Canvas.          │
 │ 2. Enchufar la telemetría militar en la placa inferior izquierda del Eurorack.   │
 │ 3. Dibujar el Triple Osciloscopio Superior (Vectorial / Matrix LED / Permutación)│
 └──────────────────────────────────────────────────────────────────────────────────┘

 ---------------------

 WAVE 7024 (La Memoria y la Matriz): Reescribir useHephPreview.ts. Curar la amnesia inyectando el Ring Buffer de 60 frames, conectar el flag del estrobo y obligar al sistema a expandir [ ALL ] a una rejilla de 16 focos virtuales para que nunca más veamos un punto solitario.

WAVE 7025 (El Puente de Telemetría): Entrar a LabTab.tsx. Elevar la selección de foco, extirpar el overlay de albañil del lienzo y mandarle los números cuánticos reales al bastidor izquierdo.

WAVE 7026 (El Triple Osciloscopio): Coronar el Canvas del radar pintando las tres ondas de frecuencia superiores prometidas en el Blueprint.

