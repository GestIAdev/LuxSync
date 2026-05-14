⚡ DIRECTIVA DE EJECUCIÓN FINAL: WAVE 4800 — BATCH 3 (The Grand Finale & Scaling)
Contexto: El Batch 2 fue un éxito estructural, pero el KeyForgeOverlay es visualmente demasiado pequeño (parece un widget menor en lugar de un Command Wing). Además, necesitamos cablear las familias de acciones finales (cue-, ui-, kf-).
Objetivo: Escalar masivamente el HUD holográfico y conectar el control de shows y ventanas al Cortex.

Ejecutor (Sonnet), aplica estos fixes visuales y finaliza el cableado lógico:

🔍 TARGET 1: EL REESCALADO MASIVO (KeyForgeOverlay.tsx)
El Problema: El teclado virtual se ve minúsculo en la pantalla. Las teclas apenas son legibles.

La Solución: 1. Cambia las clases del contenedor principal para que ocupe gran parte de la pantalla (ej. w-[80vw] max-w-6xl o similar).
2. Aumenta el tamaño base de las teclas (height, width, font-size). Tienen que parecer botones arcade de neón, no teclas de un portátil de 11 pulgadas.
3. Asegúrate de que el contenedor siga estando centrado y flotando sin desplazar el resto de la interfaz.

⏯️ TARGET 2: EL CONTROL DEL SHOW (cue-*)
Acción: En el KeyActionDispatcher (o donde corresponda), implementa la conexión para la familia cue-.

Lógica: Mapea acciones como cue-play, cue-pause, cue-next (Go!), cue-prev hacia tu Playback Store o sistema de secuencias principal.

🪟 TARGET 3: NAVEGACIÓN TÁCTICA (ui-*)
Acción: Implementa la familia ui- para abrir/cerrar vistas.

Lógica: Conecta comandos como ui-toggle-forge, ui-toggle-zen, ui-toggle-3d para que el operador pueda saltar entre el Programmer, la Catedral (3D) y La Forja usando atajos de teclado sin tocar el ratón.

🏟️ TARGET 4: EXPANSIÓN DEL LOADOUT
Acción: Actualiza el stadiumLoadout.ts para incluir estas nuevas joyas.

Sugerencias (bajo modificadores como Alt o Ctrl):

Flecha Derecha / AvPág → cue-next (Go)

Flecha Izquierda / RePág → cue-prev

Teclas F (F2, F3, F4) → alternar vistas (ui-toggle-*)

Entregable: Un teclado holográfico imponente y legible que ahora no solo controla los focos, sino que dirige el flujo del show y la interfaz del software entero.