⚙️ FASE 2: THE STAGE MANAGER (Adiós Dashboard)
Objetivo: Configurar el show SIN salir de Chronos.

El Botón "RIG":

Añadir un botón en el toolbar superior.

Abre un Modal Gigante (Overlay) sobre el simulador.

Contenido: Tu lista de fixtures, patching rápido y posición.

Cambias la posición de un foco -> Cierras el modal -> Se actualiza el simulador al instante.

Swarm Patching UI:

Implementar esa maravilla que describiste en el documento de ventas. "Añadir 20 Beams en arco". Click. Hecho.

🎹 FASE 3: THE TIMELINE LOGIC (Limpieza UX)
Objetivo: Que los tracks y controles tengan sentido.

Tracks FX (El Concepto):

Preguntas: ¿Para qué sirven?

Respuesta: CAPAS (Layers).

FX 1: Base (ej. Movimiento suave).

FX 2: Overlay (ej. Estrobos rítmicos).

FX 3: Detalles (ej. Blinders puntuales).

Acción: Renombrar visualmente o darles colores distintos para entender la jerarquía. El TitanOrchestrator ya mezcla estas capas. Hagámoslo visual.

Snap vs Quantize:

Tienes razón. Son redundantes.

Snap: Es magnético (al arrastrar).

Quantize: Es destructivo (al grabar en vivo, corrige tus errores de dedo).

Solución: Unificar en un menú "Grid Settings". (1/4, 1/8, 1/16). Si activas "Record Quantize", el Snap se activa solo.

Waveform Cyberpunk:

Cambiar esos colores tristes.

Bajos: Rojo oscuro / Ember.

Agudos: Cyan brillante.

Hacer que la onda brille (CSS drop-shadow).