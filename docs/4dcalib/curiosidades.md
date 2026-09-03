Esto es ORO PURO! Mira lo que nos dice el snare acústico pelado:

HALLAZGO 1: WNS = 0.000 en el onset de TODOS los snares acústicos


SnareE:0.909 RawΔ:0.616 WNS:0.000 → ONSET ✅
SnareE:1.000 RawΔ:0.764 WNS:0.000 → ONSET ✅
SnareE:1.000 RawΔ:0.533 WNS:0.000 → ONSET ✅
SnareE:1.000 RawΔ:0.967 WNS:0.000 → ONSET ✅
SnareE:0.863 RawΔ:0.662 WNS:0.000 → ONSET ✅
WNS = 0.000 en el frame de onset. Pero mira lo que pasa 1-2 frames DESPUÉS:



Frame +1: SnareE:0.946 WNS:0.169  (wires empezando a vibrar)
Frame +2: SnareE:0.909 WNS:0.715  (wires en pleno rattle)
Frame +3: SnareE:0.870 WNS:0.562  (rattle decay)
WNS no mide el crack — mide el rattle de los cables del snare. El crack es un impulso instantáneo que el detector WNS no alcanza a capturar. Los cables vibran 1-2 frames DESPUÉS.

Esto significa que Path 3 (WNS > 0.50) NUNCA atraparía un snare acústico en el onset frame. Path 3 solo funciona para claps electrónicos (djtiesto) donde el ruido sintetizado es simultáneo al onset.

HALLAZGO 2: Doble-fuego Snare+Kick
6 de 17 snares dispararon [ONSET] [KICK] simultáneo:



SnareE:1.000 RawΔ:0.533 BassE:0.385 BassΔ:0.166 → ONSET + KICK ⚠️
SnareE:1.000 RawΔ:0.637 BassE:0.353 BassΔ:0.160 → ONSET + KICK ⚠️
SnareE:1.000 RawΔ:0.967 BassE:0.345 BassΔ:0.148 → ONSET + KICK ⚠️
SnareE:1.000 RawΔ:0.530 BassE:0.391 BassΔ:0.141 → ONSET + KICK ⚠️
El snare es tan potente que sangra al bass band (BassE 0.31-0.39, BassΔ +0.12-0.18) y el kick detector lo roba. Pero un kick real tiene BassE > 0.80. Estos snares tienen BassE < 0.40. El kick detector está disparando con un tercio de la energía de bass que un kick real.

HALLAZGO 3: La firma universal del snare acústico
Métrica	Snare acústico	Kick real	Clap electrónico
SnareE	0.85-1.0	0.00-0.25	0.00
WNS (onset)	0.000	0.000	0.96-1.0
WNS (tail)	0.5-1.0	0.000	0.4-0.6
BassE	0.14-0.40	0.80-0.96	0.60-0.68
RawΔ	0.34-0.97	0.05-0.20	0.32-0.40
CONCLUSIÓN ESTRATÉGICA
SnareE es el rey, no WNS. WNS es un detector de rattle, no de crack. Funciona para electrónica pero es inútil para acústica.

Dos cambios de estrategia:

SnareE-veto sobre Kick: Cuando SnareE > 0.80, suprimir el output de kick. Ningún kick real produce SnareE > 0.80. Esto elimina los 6 doble-fuegos.
Replantear Path 3: Path 3 usa WNS como discriminador principal, pero WNS = 0.000 en snares acústicos. Para acústica, SnareE ya los atrapa via clause 1a (>0.45). Path 3 solo aporta valor en electrónica donde SnareE = 0.

-----------------------------------

¡Ahora veo el desastre completo! Esto es fascinante. Te lo explico:

ANÁLISIS: minimaldisaster.md
Los 3 desastres distintos que están pasando
DESASTRE 1: Kick fires on snare tail (el más grave y más común)

Mira esta secuencia — L45 es un snare onset legítimo, pero mira los 6 frames siguientes:



L45:  SnareE:0.848 RawΔ:0.903 → ONSET ✅ (snare real)
L47:  SnareE:0.797 BassE:0.890 → KICK ❌ (esto es el TAIL del snare!)
L48:  SnareE:0.749 BassE:0.945 → KICK ❌ (sigue el tail)
L49:  SnareE:0.704 BassE:0.930 → KICK ❌ (sigue el tail)
L50:  SnareE:0.704 BassE:0.934 → KICK ❌ (sigue el tail)
L51:  SnareE:0.662 BassE:0.848 → KICK ❌ (sigue el tail)
L52:  SnareE:0.622 BassE:0.747 → KICK ❌ (sigue el tail)
El kick detector está disparando sobre el tail del snare. El snare tiene SnareE 0.62-0.80 (evidentemente snare) pero como el bass bleed mantiene BassE > 0.85, el kick detector lo roba.

Lo mismo pasa al principio del log:



L1:  SnareE:0.702 BassE:0.962 → KICK ❌ (tail de snare previo)
L3:  SnareE:0.660 BassE:0.976 → KICK ❌
L4:  SnareE:0.620 BassE:0.894 → KICK ❌
L5:  SnareE:0.583 BassE:0.755 → KICK ❌
L6:  SnareE:0.548 BassE:0.675 → KICK ❌
DESASTRE 2: Doble-fuego ONSET+KICK



L8:  SnareE:0.484 RawΔ:0.133 Flux:0.374 BassE:0.735 → ONSET + KICK ⚠️
L54: SnareE:0.517 RawΔ:0.079 Flux:0.280 BassE:0.754 → ONSET + KICK ⚠️
El snare dispara correctamente, pero el kick también dispara porque BassE 0.73-0.75 está por encima del threshold de kick. El snare tiene bass bleed.

DESASTRE 3: TCT lockout bloqueando snare real



L173: RawΔ:0.436 Flux:0.350 WNS:0.866 → ONSET ✅
L174-177: tail (RawΔ negativo)
L178: RawΔ:0.390 Flux:0.135 WNS:0.000 → OutSnare:0.007 ❌ MISS!
RawΔ 0.390 es enorme — debería disparar. Pero está 5 frames después del onset de L173. El TCT lockout (_snareReArmed = false) lo bloquea.

¿Por qué djtiesto funciona y minimal no?
Métrica	djtiesto (funciona)	minimal (desastre)
Snare SnareE	0.000 (puro ruido sintetizado)	0.000-0.850 (mixto: samples + síntesis)
Kick RawΔ	0.05-0.20 (kick suave)	0.15-0.43 (kick con click agresivo)
Kick Flux	0.01-0.05 (limpio)	0.03-0.19 (click genera Flux)
BassE en snare	0.60-0.68 (bajo)	0.59-0.95 (bass bleed masivo)
Separación snare/kick	WNS y Flux separan limpio	RawΔ y Flux se solapan
En djtiesto, los kicks son limpios (puro sub-bass, sin click). En minimal, los kicks tienen un click/transient agresivo que produce RawΔ 0.15-0.43 y Flux 0.03-0.19. Esto se solapa con snares suaves.

La conexión con el snare acústico
¡Sí se puede aplicar! El insight del snare acústico fue:

SnareE es el rey. SnareE > 0.80 = snare con certeza física.

En minimal techno, los snares híbridos (L8, L23, L45, L54) tienen SnareE 0.18-0.85. Los kicks NUNCA tienen SnareE > 0.25 (incluso con click, el crack-band está ausente).

El problema raíz es que el kick detector NO mira SnareE. Solo mira BassE y RawΔ. Cuando un snare tiene bass bleed (BassE 0.73-0.95), el kick detector lo roba.

Posibles soluciones (sin implementar todavía)
Solución A: SnareE-veto sobre Kick (la más limpia)



IF SnareE > 0.45 → suppress kick output
Elimina Desastre 1 (tail): SnareE 0.62-0.80 en tails → kick suprimido ✅
Elimina Desastre 2 (doble-fuego): SnareE 0.48-0.52 en onset → kick suprimido ✅
No afecta kicks reales: SnareE 0.000-0.25 → kick sigue disparando ✅
Riesgo: ¿hay kicks con SnareE > 0.45? En los logs que hemos visto, no. Pero habría que verificar con más tracks.
Solución B: BassE-adaptive snare threshold



IF BassE > 0.85 → require SnareE > 0.25 OR WNS > 0.30 for snare onset
IF BassE < 0.75 → relax snare threshold (current behavior)
Esto reconoce que en minimal, BassE alto = zona de kick, y exige más evidencia de snare.
Más complejo pero más conservador.
Solución C: TCT lockout adaptativo



IF RawΔ > 0.30 AND _snareImpulse < 0.30 → force re-arm (override TCT)
Elimina Desastre 3 (L178): RawΔ 0.390 fuerza re-arm ✅
Riesgo: podría permitir doble-fuego si dos snares están muy juntos.
Solución D: Snare-tail kick suppression (temporal)



IF snareOnsetThisFrame → suppress kick for next N frames
Elimina Desastre 1 (tail): después de un onset, kick se silencia por N frames.
Simple pero podría perder kicks reales que vienen inmediatamente después de un snare.
Mi recomendación
Solución A (SnareE-veto) es la más limpia y universal. Aplica el insight del snare acústico directamente: SnareE es el discriminador físico. Un kick real no produce crack-band. Si SnareE > 0.45, hay snare content, y el kick debe callarse.

Es la misma lógica que proponíamos para el snare acústico, pero ahora vemos que aplica igual a electrónica: el problema no es detectar snares, es que el kick detector no sabe cuándo callarse.

¿Qué te parece? ¿Quieres que profundice en alguna de las soluciones antes de implementar?







