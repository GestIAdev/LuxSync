🎛️ PLAN MAESTRO DE CALIBRACIÓN: "AFINANDO A LA DIOSA"
Vamos a dividir la calibración en 3 capas, de abajo hacia arriba (del instinto a la razón).

🟢 FASE 1: EL INSTINTO (Modo Flow / Reactivo)
El seguro de vida. Si la IA falla, esto tiene que verse bien sí o sí.

Gate de Silencio (Silence Threshold):

Objetivo: Que el Blackout sea absoluto cuando para la música.

Ajuste: Calibrar UMBRAL_SILENCIO en selene-integration.js. Si está muy alto, cortará en las bajadas suaves (feo). Si está muy bajo, parpadeará con el ruido de fondo (sucio).

Prueba: Poner un tema con parones secos (tipo Dubstep o cortes de DJ) y verificar que los focos cortan a negro total en <300ms.

Sensibilidad al Beat (Kick Detection):

Objetivo: Que los Front Pars (rojos) golpeen exactamente con el bombo.

Ajuste: En BeatDetector / RhythmAnalyzer, ajustar el transientThreshold.

Prueba: Techno a 130BPM. Si pierde golpes o parpadea a destiempo, subir la sensibilidad.

🔵 FASE 2: LOS SENTIDOS (Percepción Musical)
Aquí es donde Selene demuestra que oye música, no ruido.

El "Test de la Cumbia" (Sincopación):

Objetivo: Diferenciar Cumbia (Güiro + Ritmo roto) de Reggaeton (Dembow).

Ajuste: En GenreClassifier y RhythmAnalyzer.

Calibrar trebleDensity (para detectar el rascado del güiro).

Calibrar el umbral de syncopation (>0.4 es Reggaeton, <0.2 es Techno, intermedio es Cumbia/Pop).

Meta: Que la UI diga "Género: Cumbia" y active la paleta FUEGO automáticamente.

Detector de Emoción (Major vs Minor):

Objetivo: Que la luz cambie de temperatura.

Ajuste: En HarmonyDetector. Verificar que una canción triste (Menor) baja la saturación o cambia a tonos fríos (Azul/Violeta) en la paleta Fuego.

🟣 FASE 3: LA MENTE (Cognición y Comportamiento)
El ajuste fino de la personalidad.

Paciencia del Depredador (Stalking):

Objetivo: Evitar cambios esquizofrénicos.

Ajuste: En StalkingEngine.

minStalkingCycles: ¿Cuántos compases espera antes de cambiar de género? (Ahora son 5-10). Si es muy lento, el público se aburre. Si es muy rápido, marea.

Recomendación: Bajarlo un poco para fiestas dinámicas (3-6 ciclos).

Creatividad Procedural (ColorEngine):

Objetivo: Evitar los "Marrones Caca" y los "Grisáceos".

Ajuste: En ProceduralPaletteGenerator y ColorEngine.ts.

Saturación Mínima: Forzar que nunca baje del 80% en modos vivos (Fuego/Neon).

Luminosidad Mínima: Asegurar que el "Oro" tenga L > 60% para no verse ocre.

Límites Físicos (Physics Driver):

Objetivo: No romper los motores.

Ajuste: En FixturePhysicsDriver.

maxAcceleration: ¿Se ven los movimientos "gomosos"? Subir aceleración. ¿Se ven "a saltos"? Bajarla.

Safety Box: Verificar que tiltMin impide que los focos apunten al techo (o al suelo, según montaje).