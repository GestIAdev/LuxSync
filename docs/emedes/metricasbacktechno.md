Métricas BACK de TECHNO
Back L — envelopeHighMid (Mid Synths / Atmósfera)
Parámetro	Valor	Nota
gateOn	0.22	Selectivo — buildups de synth no pasan
boost	1.5	Moderado, no satura
crushExponent	2.5	No-lineal — picos percusivos sí, masa no
decayBase	0.28	Cortante, no se queda pegado
decayRange	0.25	Morph sutil
maxIntensity	0.85	Headroom para groove continuo
squelchBase	0.25	Piso estricto anti-masa continua
squelchSlope	0.10	
ghostCap	0.00	Negro entre golpes
Back R — envelopeSnare (El Látigo / Percussion Slap)
Parámetro	Valor	Nota
gateOn	0.35	Aislamiento extremo — solo hits reales
boost	1.0	Cap anti-spike
crushExponent	1.0	Lineal
decayBase	0.05	Corte brutal
decayRange	0.40	Morfología líquida preservada
maxIntensity	1.0	Sin cap
squelchBase	0.52	Piso estricto — filtra ruido fino y cola de reverb
squelchSlope	0.10	
ghostCap	0.00	
Cross-Filter Back L (WAVE 3464 — Ghost Mids Reform)


ts
backLLowMidWeight: 0.0
backLMidWeight:    1.0   // MID como alimento principal
backLTrebleSub:    0.0
backLBassSub:      0.7   // Sustracción del bombo (ghost subtraction)
Transient Shaper Back R (WAVE 2408M — Schwarzenegger)


ts
percMidSubtract: 1.0    // Escudo absoluto 1:1
percGate:        0.06   // Filtra variaciones pequeñas de treble (voces)
percBoost:       5.0
percExponent:    0.5    // Raíz cuadrada, suaviza transitorio
Routing por layout
Layout	backPar	Comportamiento
4.1 strict-split (Techno)	backRight exclusivo	Solo envSnare (El Látigo). backLeft se ignora para el PAR.
4.1 default (Latino/PopRock/Chill)	max(backLeft, backRight)	Combinación de envHighMid + envSnare.
7.1	backLeft + backRight separados	Back L = envHighMid (mid synths), Back R = envSnare (percussion).
¿Qué quieres tocar primero de los backs de Techno? ¿Subir el gateOn de envelopeSnare, endurecer el squelch, o quizás ajustar el cross-filter de backLeft para purgar más kick?