WAVE 7749.12 — DIAGNÓSTICO DSP CLÍNICO (lectura independiente)
VEREDICTO INICIAL: El arquitecto tiene razón parcial, pero su diagnóstico del Veto Paradox es incorrecto para este log.
He analizado techno9.md frame a frame y cruzado con el código. El arquitecto mezcló logs (como dijiste), y su tesis central — que el vetoFactor "plummet instantáneamente" matando el decay — no se sostiene en la evidencia de techno9.md.

1. EL "SAMPLE & HOLD VETO PARADOX" — FALSO EN ESTE LOG
Evidencia:
El arquitecto afirma que spectralFlux cae a cero el frame siguiente al transiente, haciendo que vetoFactor se desplome. Los datos dicen lo contrario:

Frame	RawΔ	Veto	Out	¿Soft-knee activo?
13 (onset)	0.157	0.806	1.000	No (veto>0.15)
14 (onset)	0.157	0.857	1.000	No
15 (decay)	-0.139	0.856	0.750	No
16 (decay)	-0.139	0.877	0.563	No
17 (decay)	-0.025	0.784	0.422	No
18 (decay)	-0.033	0.757	0.316	No
19 (decay)	0.044	0.560	0.237	No
20 (decay)	-0.084	0.293	0.178	No
El vetoFactor cae gradualmente de 0.857 a 0.293 en 6 frames — NO se desploma instantáneamente. En TODOS esos frames, veto > 0.15, así que el soft-knee (vetoFactor / 0.15) nunca se activa. El output es puramente el decay del impulso (1.0, 0.75, 0.56, 0.42, 0.32, 0.24...).

Estadística global: de 670 frames con output > 0.01, 375 tienen veto ≥ 0.15 (veto transparente, no afecta el output). Solo 295 tienen veto < 0.15 (soft-knee activo), y esos son frames de cola donde el impulso YA es bajo.

Conclusión sobre el Veto:
El Sample & Hold NO es necesario. El veto ya funciona correctamente como passthrough durante el decay principal. Latchear el veto sería un cambio arquitectónico innecesario basado en un diagnóstico incorrecto. El veto no es el enemigo aquí.

2. EL ENEMIGO REAL #1: UMBRAL DE ONSET DEMASIADO BAJO
Evidencia:
167 onsets en ~25 segundos. Distribución de magnitudes:

Rango	Count	Interpretación
0.08-0.12 (borderline)	36	Hi-hat bleed, cymbal splash, ruido
0.12-0.20 (medium)	49	Snares débiles + algunos falsos
≥0.20 (strong)	82	Snares reales (con duplicados)
El umbral rawSnareDelta > 0.08 es demasiado permisivo. Cuando eliminamos el floor snare_energy > 0.05 (WAVE 7749.11), perdimos el filtro que separaba snares reales de hi-hat bleed. El 0.08 captura cualquier wiggle del crack band — incluyendo hi-hats, cymbals, y ruido de mezcla densa.

Ejemplos del log de falsos positivos claros:



RawΔ:0.082 → [ONSET]  (línea 60 — apenas supera 0.08, WNS:0.000, Flux:0.062)
RawΔ:0.089 → [ONSET]  (línea 81 — WNS:0.026, Flux:0.141)
RawΔ:0.097 → [ONSET]  (línea 97 — WNS:0.000, Flux:0.058)
Estos tienen WNS:0.000 (sin broadband HF) y Flux bajo — son hi-hats o bleed, no snares. Un snare real tiene WNS > 0.3 y Flux > 0.2 simultáneos.

Solución física (sin cooldowns):
Subir el umbral de 0.08 a 0.12. Esto elimina los 36 onsets borderline de hi-hat bleed. Los snares reales de techno tienen RawΔ de 0.15-0.40 (como se ve en los 131 onsets medium+strong). El umbral 0.12 los captura todos.

Esto NO es un cooldown — es un umbral de detección más estricto. Es física: un snare real mueve el crack band >0.12 en un frame; un hi-hat lo mueve 0.08-0.11.

3. EL ENEMIGO REAL #2: ONSETS DUPLICADOS (PROCESAMIENTO DOBLE)
Evidencia:
32 onsets consecutivos tienen el mismo RawΔ exacto. Ejemplo:



Línea 13: RawΔ:0.157, Flat:0.065, WNS:0.656, Flux:0.232 → [ONSET]
Línea 14: RawΔ:0.157, Flat:0.074, WNS:0.245, Flux:0.258 → [ONSET]
Mismo RawΔ (0.157), pero WNS y Flux diferentes. Esto indica que el mismo frame de audio está siendo procesado dos veces, con el photon actualizándose entre llamadas.

Patrón confirmado en múltiples secuencias:

Líneas 45-46: RawΔ:0.119 × 2, WNS:0.000 × 2, Flux:0.067 × 2
Líneas 82-83: RawΔ:0.285 × 2, WNS:0.856 × 2, Flux:0.309 × 2
Causa probable:
Hay un desacople de frame-rate entre el pipeline de audio (GodEarFFT, ~44Hz) y el render loop del engine líquido (posiblemente ~60Hz vía requestAnimationFrame). Cuando el render loop corre más rápido que el pipeline de audio, algunos frames reciben el mismo raw_snare_delta (cacheado del frame anterior) pero un photon actualizado (computado por separado).

Impacto:
Cada onset duplicado resetea _snareImpulse = 1.0. En lugar de decay 1.0, 0.75, 0.56, 0.42..., obtenemos 1.0, 1.0, 0.75, 0.56... — el pico se sostiene 2 frames extra. Esto no es catastrófico, pero alimenta el efecto de "demasiados disparos".

Solución física (sin cooldowns):
Retrigger guard basado en energía del impulso: Solo disparar onset si _snareImpulse < 0.5. Si el impulso del onset anterior sigue en 0.75, estamos dentro del mismo evento acústico — un nuevo delta de 0.157 es la resonancia del mismo hit, no un hit nuevo.



typescript
const rawOnset = rawSnareDelta > 0.12 && this._snareImpulse < 0.5
Esto NO es un cooldown temporal. Es un guard de物理: si la energía del impulso anterior no ha decaído por debajo del 50%, un nuevo transiente es físicamente indistinguible del evento en curso. Es como un envelope follower con retrigger threshold — estándar en DSP desde los años 80.

4. EL ENEMIGO REAL #3: DECAY EXCESIVO (confirmación del usuario)
Evidencia:
Con decayBase: 0.75 y snareImpulseDecay: 0.75, la luz decae así:

Frame	Impulso	Envelope	Output
0	1.0	1.0	1.000
1	0.75	0.75	0.750
2	0.56	0.56	0.563
3	0.42	0.42	0.422
4	0.32	0.32	0.316
5	0.24	0.24	0.237
6	0.18	0.18	0.178
7	0.13	0.13	0.133
8	0.10	0.10	0.100
La luz tarda ~9 frames = 200ms en bajar de 1.0 a 0.10. El usuario tiene razón: es techno, necesitamos contraste. Un snare techno es un latigazo, no un colchón.

Solución:
Bajar decayBase a 0.40 y snareImpulseDecay a 0.40 (como pide el usuario). Con 0.40:

Frame	Output
0	1.000
1	0.400
2	0.160
3	0.064
4	0.026
5	0.010
~120ms para bajar de 1.0 a 0.01. Contraste puro. Latigazo techno.

5. RESPUESTA A LAS PROPUESTAS DEL ARQUITECTO
Propuesta A: "Sample & Hold Veto"
Rechazada. Basada en premisa falsa (el veto no se desploma instantáneamente en techno9.md). El veto ya funciona como passthrough durante el decay. Latchearlo añadiría complejidad sin beneficio.

Propuesta B: "Leaky Integrator en la entrada"
Parcialmente relevante pero innecesario. Un leaky integrador suavizaría rawSnareDelta, pero el problema no es que el delta sea ruidoso — es que el umbral es demasiado bajo (0.08 captura hi-hats). Subir el umbral a 0.12 logra el mismo filtrado de micro-transientes sin añadir un nuevo stage de DSP.

Mi propuesta alternativa (no pedida por el arquitecto):
Retrigger guard en _snareImpulse. Esto sí es estándar DSP y resuelve los duplicados sin cooldowns temporales.

6. ESTRATEGIA MATEMÁTICA PROPUESTA (sin código)
Cambio 1: Umbral de onset más estricto


rawSnareDelta > 0.08  →  rawSnareDelta > 0.12
Filtrado físico: hi-hats mueven el crack 0.08-0.11, snares lo mueven >0.12.

Cambio 2: Retrigger guard


rawOnset = rawSnareDelta > 0.12 && this._snareImpulse < 0.5
Si el impulso anterior sigue > 50%, el nuevo transiente es parte del mismo evento acústico.

Cambio 3: Decay a 0.40


snareImpulseDecay: 0.75 → 0.40
envelopeSnare.decayBase: 0.75 → 0.40
Contraste techno: ~120ms de luz, latigazo puro.

Cambio 4 (investigación separada): Frame-rate mismatch
Los 32 onsets duplicados indican que el engine líquido procesa algunos frames de audio dos veces. Esto requiere investigación del pipeline de timing (¿requestAnimationFrame vs audio callback?), pero no bloquea los cambios 1-3.

Resumen: El arquitecto diagnosticó mal el veto. Los enemigos reales son: (1) umbral demasiado bajo que captura hi-hats, (2) procesamiento doble que duplica onsets, (3) decay excesivo. La solución es subir el umbral a 0.12, añadir un retrigger guard físico en el impulso, y bajar el decay a 0.40. Todo física, zero cooldowns temporales.

Espero confirmación para ejecutar.