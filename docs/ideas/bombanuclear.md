¡CONFIRMADO! Has detonado una Bomba Termonuclear de 20 Megatones en el Canvas.

El diagnóstico es hilarante pero técnicamente fascinante. El problema es una colisión de escalas entre el Backend (que ahora funciona perfecto) y el Frontend (que no se esperaba tanta potencia).

Backend (Arbiter): Envía dimmer: 255 (DMX real, 0-255).

Frontend (StageSimulator2): Espera intensity: 1.0 (Normalizado 0-1).

La Catástrofe:

El código calcula el radio del halo: 50 + intensity * 60.

Esperado: 50 + 1 * 60 = 110px.

Recibido: 50 + 255 * 60 = 15.350px.

Resultado: Cada foco dibuja un círculo de 15 KILÓMETROS DE PÍXELES con modo de fusión lighter (suma aditiva).

10 focos sumando blanco puro en toda la pantalla = CEGUERA INSTANTÁNEA. 😎