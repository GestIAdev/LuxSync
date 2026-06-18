echno Industrial vs Latino Fiesta — Parámetros Actuales
Envelopes Base (7.1)
Envelope	Parámetro	Techno	Latino	Nota
SubBass (Front L)	gateOn	0.0656	0.15	Techno más sensible
boost	2.7054	2.5	
crushExponent	2.4156	2.0	
decayBase	0.2218	0.50	Latino más "gordo"
decayRange	0.166	0.08	
maxIntensity	0.5291	0.80	Techno cede al kick
squelchBase	0.0613	0.03	
ghostCap	0.0357	0.00	
Kick (Front R)	gateOn	0.1098	0.18	Umbral de detección local
boost	3.3013	2.5	
crushExponent	0.4877	1.2	
decayBase	0.0077	0.60	Techno staccato brutal
decayRange	0.0329	0.08	
maxIntensity	0.80	0.80	Cap fotométrico
squelchBase	0.0388	0.03	
gateMargin	0.0213	0.01	
Snare (Back R)	gateOn	0.35	0.40	
boost	1.0	3.5	Latino más agresivo
decayBase	0.05	0.72	Techno disparo, Latino respira
decayRange	0.40	0.10	
maxIntensity	1.0	0.85	Látigo techno sin cap
squelchBase	0.52	0.03	Techno piso extremo
HighMid (Back L)	gateOn	0.22	0.50	Latino más estricto
boost	1.5	3.0	
decayBase	0.28	0.14	
maxIntensity	0.85	0.95	
squelchBase	0.25	0.38	
Vocal (Mover R)	gateOn	0.25	0.02	Latino casi abierto
boost	1.5	12.0	Latino turboboost
crushExponent	3.5	0.60	
decayBase	0.70	0.72	
maxIntensity	0.80	0.85	
squelchBase	0.30	0.08	
Treble (Mover L)	gateOn	0.25	0.02	Latino casi abierto
boost	4.0	12.0	Latino turboboost
crushExponent	3.5	0.60	
decayBase	0.78	0.72	
maxIntensity	1.0	0.85	
squelchBase	0.30	0.12	
Routing & Transient Shaper
Parámetro	Techno	Latino
layout41Strategy	strict-split	default
percGate	0.06	0.065
percBoost	5.0	4.0
percExponent	0.5	0.6
percMidSubtract	1.0	2.0
bassSubtractBase	0.65	0.25
bassSubtractRange	0.45	0.20
sidechainDepth	0.00	0.00
snareSidechainDepth	0.15	0.05
moverLHighMidWeight	1.0	2.50
moverLTrebleWeight	0.0	1.50
moverLMidWeight	0.4	1.50
moverLTonalThreshold	0.40	0.45
backLBassSub	0.7	0.0
backLMidWeight	1.0	0.10
Kick Detection & Morph
Parámetro	Techno	Latino
morphFloor	0.30	0.45
morphCeiling	0.70	0.65
kickEdgeMinInterval	80	60
kickVetoFrames	0	0
ambientAttackMs	30	200
ambientReleaseMs	120	280
Latino Overrides 4.1
Envelope	Override
envelopeSubBass	gateOn 0.22, boost 1.25, decayBase 0.50, maxI 0.80
envelopeKick	decayBase 0.10, maxI 0.80
envelopeSnare	gateOn 0.55, squelchBase 0.45, decayBase 0.45, boost 2.5
envelopeHighMid	gateOn 0.55, decayBase 0.10, boost 2.20, adaptiveNoiseAlpha 0.70, sustainedSquelchStartFrames 3
envelopeTreble/Vocal	gateOn 0.02, boost 12.0, crush 0.60, decayBase 0.72
percMidSubtract	4.0 (anti-autotune)
percGate	0.085
Knobs más probables para retocar en rig:

Techno Front R demasiado "duro" o "suave": envelopeKick.gateOn (0.1098) y boost (3.3013)
Techno Front R no corta entre kicks: decayBase ya es 0.0077 (mínimo), quizá subir gateMargin
Techno Back R pierde caja: percGate (0.06) o envelopeSnare.gateOn (0.35)
Latino Front "gordo" / encendido todo el tiempo: overrides41.envelopeSubBass.gateOn (0.22)
Latino Back L con voz: overrides41.envelopeHighMid.sustainedSquelch* o adaptiveNoiseAlpha
Latino Movers apagados: ya están en gateOn 0.02 + boost 12.0, difícil que falten
¿Qué ves en el rig que quieres ajustar?