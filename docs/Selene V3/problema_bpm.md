Diagnóstico: Inestabilidad BPM post-auditoría WAVE 7002
Datos del log
WORKER BPM (cada 60 frames ~1.4s):
Línea	BPM	Conf	PLL	sBPM (CHOREO)	Observación
10-125	87	0.04	FREEWHEEL	96-97	Worker sordo, freewheel a 97 (memoria previa)
137	94	0.69	LOCKED	—	Salto +7 BPM — tracker encuentra patrón
154	101	0.73	LOCKED	101	Salto +7 BPM — tracker recalibra
172-296	100-102	0.4-0.86	mezclado	100-102	Oscilación ±2 BPM (normal)
348	89	0.87	FREEWHEEL	89-95	Salto −12 BPM — falso half-time con conf ALTA
357	92	0.86	FREEWHEEL	92-93	Recuperación parcial
363	99	0.87	FREEWHEEL	98-99	Salto +7 BPM — tracker vuelve
371-490	99-103	0.3-0.87	mezclado	100-103	Oscilación ±3 BPM
577-624	100	0.02	FREEWHEEL	100	Worker sordo, freewheel a 100
641-658	102	0.01-0.56	FREEWHEEL	102	Freewheel extendido
Rango total: 87 a 103 BPM = 16 BPM de rango
Salto más bruto: 101 → 89 = 12 BPM en un frame (conf=0.87)
Causa raíz: 3 problemas encadenados
Problema 1: El IntervalBPMTracker produce BPM falsos con confianza alta
El 89 BPM con conf=0.87 es el smoking gun. La confianza IQR (WAVE 7002.4 W2) mide consistencia interna del buffer de 8 muestras, no corrección temporal. Si el tracker detecta 8 kicks espaciados a 89 BPM consistentemente, la confianza es alta — pero el BPM real es 100. Es un error de half-time detection: el tracker se engancha al patrón de kicks secundarios (ghost kicks del dembow) en lugar del kick principal.

Lo mismo con 87 BPM inicial: conf=0.04 significa que el buffer no tiene consistencia, pero en cuanto se estabiliza (8 kicks a 87 BPM), la confianza sube a 0.69 y el sistema lo acepta.

WAVE 7002.4 W2 (IQR confidence) es más generoso que el antiguo max-min spread. El IQR descarta outliers, pero si todos los samples están igualmente equivocados, el IQR es pequeño → confianza alta. El max-min spread antiguo habría dado confianza más baja para el mismo caso.

Problema 2: No hay smoothing temporal del BPM en TickEngine
Mirando TickEngine.ts:400-402:



typescript
if (workerBpm > 0 && workerConfidence > 0.5) {
  context.bpm = workerBpm  // ← BAM. Salto instantáneo.
No hay EMA, ni mediana, ni histeresis. Si el worker pasa de 101 a 89 en un frame, context.bpm pasa de 101 a 89 en ese mismo frame. El PLL recibe setBpm(89) y las luces saltan inmediatamente.

Problema 3: F11 (feedKick) crea PLL locks falsos
Líneas 64, 73, 102, 132 del log muestran PLL=LOCKED con conf=0.04. Esto es porque F11 alimenta timestamps de kicks al PLL sin verificar confianza. El PLL se sincroniza a la fase de los kicks reales, pero el BPM sigue siendo 87 (del worker). Así que pllLocked=true no significa que el BPM sea correctivo — solo significa que la fase está sincronizada.

Esto afecta a Cassandra: computeOrganicConfidence() usa pattern.pllLocked para boost de confianza. Si pllLocked=true con BPM=87, Cassandra confía más en sus predicciones calculadas con un BPM equivocado.

Impacto en Cassandra
Cassandra calcula estimateTimeToEvent() usando pattern.bpm. Si el BPM salta de 101 a 89:

Un evento predicho a 3000ms con BPM=101 → 3000 * (101/89) = 3404ms con BPM=89
El ETA se alarga un 13% → el pre-buffer se dispara en el momento equivocado
Las predicciones buildup_starting con timeToEvent=3000ms se vuelven imprecisas
El Sovereign Clock dispara con el timing equivocado
Por eso Cassandra "no sirve de nada" — sus cálculos son BPM-puro y el BPM cambia 12 BPM en un frame.

Lo que NO causó el problema
F6 (gate 0.2→0.5): Correcto. Con 0.2, los saltos serían peores (más valores pasan).
F2/F3 (propagar pllLocked/bpmConfidence): Correcto. Solo propagan datos, no causan inestabilidad.
F10 (estimatePllLock removal): Correcto. Solo afecta cómo Cassandra interpreta el lock, no el BPM en sí.
Lo que SÍ lo causó
Cambio	Impacto
WAVE 7002.4 W2 (IQR confidence)	Confianza más generosa → BPM falsos pasan el gate
WAVE 7002.4 W4 (tempo-change detection)	Permite saltos de BPM que el outlier rejection anterior bloqueaba
F11 (feedKick)	PLL locks falsos con conf=0.04 → Cassandra confía en BPM equivocado
Ausencia de smoothing (preexistente)	No había EMA/mediana antes, pero con el gate antiguo a 0.2 y sin IQR, menos valores pasaban
Recomendaciones (no aplicadas)
Smoothing temporal en TickEngine: EMA con α=0.15 sobre context.bpm. Un salto de 101→89 se suaviza a 101→99.15→97.8→...→89 en ~10 frames (~4s). Las luces no saltan, Cassandra tiene tiempo de re-estabilizar.
Hysteresis gate: Solo aceptar un nuevo BPM si difiere >8% del actual Y mantiene conf>0.7 por N frames consecutivos. El salto 101→89 (12% de cambio) requeriría 3-4 frames de confirmación.
No actualizar lastStableWorkerBpm inmediatamente: Solo actualizar después de que el nuevo BPM se mantenga estable por 60 frames. Así el freewheel no propaga 89 BPM.
FeedKick condicional: Solo llamar feedKick() si workerConfidence > 0.3. Esto evita PLL locks falsos con conf=0.04.
¿Quieres que proceda con alguna de estas correcciones?