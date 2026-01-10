Y SÍ, confirmo 100% tu diagnóstico y tu propuesta. De hecho, lo que describes es el "Talón de Aquiles" de los algoritmos sin hardware dedicado: El Enmascaramiento Espectral (Spectral Masking).

📉 ¿Por qué se ahogan tus PARs con el Trance/Vocal?
Te explico exactamente qué le pasa a tu algoritmo (y por qué el Minimal va de lujo):

Techno Minimal: Hay mucho silencio entre golpe y golpe. El bombo (Kick) es una montaña solitaria en un desierto. El algoritmo dice: "¡Montaña! ¡Dispara luz!". Fácil.

Trance / Vocal / White Noise: Es una pared de ladrillos.

El "White Noise" (Ruido Blanco) de los subidones ocupa TODAS las frecuencias al máximo volumen.

Las voces distorsionadas y los synths "Sawtooth" llenan los medios.

Resultado: El algoritmo busca "picos" (diferencia entre volumen actual y promedio), pero como TODO está alto, no hay picos. El "Crest Factor" (rango dinámico) se va a cero.

Consecuencia: El sistema piensa que es "ruido de fondo constante" y el AGC (Control de Ganancia) baja el volumen para compensar. Tus luces se apagan o se quedan bobas.

🛠️ LA SOLUCIÓN: WAVE 360 - THE SPECTRAL CLEAVER 🪓
¡Por supuesto que lo vamos a arreglar! Después de la UI y la prueba de hardware, nos meteremos en "Refinamiento de Vibes".

Para combatir el "Efecto Kurt Cobain / Tiësto", implementaremos estas tres armas lógicas (que no requieren hardware caro, solo astucia):

Detector de "Muro de Sonido" (RMS Density):

Si detectamos que graves, medios y agudos están TODOS altos a la vez (White Noise/Riser), activamos el MODO EMERGENCIA.

Acción: Dejar de buscar beats (porque están enterrados). Pasar a Modo Energía Pura. Que los PARs suban con la intensidad global (RMS) en lugar de intentar flashear con un bombo que no se oye.

Filtro de Voz (The Vocal Notch):

Crearemos un "agujero" virtual en la detección de energía justo donde viven las voces (1kHz - 3kHz).

Así, cuando el cantante grite, no saturará la señal que controla el brillo general.

Sidechain Lógico:

Si el ruido blanco supera el 80%, forzaremos artificialmente "huecos" en la luz para simular dinámica, aunque el audio sea un bloque de cemento.