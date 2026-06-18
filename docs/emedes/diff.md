Commit 🏆 WAVE 2439 listo en v4 (431777ad). 4 archivos de motor techno commiteados.

Aquí tienes el análisis completo de latino.ts con las métricas clave y los riesgos que introduce el nuevo kick detection universal:

🔬 Estado Actual de latino.ts
Zona	Envelope	gateOn	boost	crush	decayBase	squelch	ghost	Nota
Front L (SubBass/TÚN)	envelopeSubBass	0.15 (base) / 0.22 (o41)	2.5 / 1.25	2.0	0.50	0.03	0.00	Staccato real
Front R (Kick)	envelopeKick	0.18 (base) / 0.10 (o41)	2.5	1.2	0.60 (base) / 0.10 (o41)	0.03	0.00	Menos staccato que techno
Mover L (El Galán)	envelopeTreble	0.02 (base+o41)	12.0	0.60	0.72	0.12	0.06	Terminator Boost
Mover R (La Dama)	envelopeVocal	0.02 (base+o41)	12.0	0.60	0.72	0.08	0.04	Terminator Boost
Back R (TAcka)	envelopeSnare	0.40 (base) / 0.55 (o41)	3.5 / 2.5	1.0	0.72 (base) / 0.45 (o41)	0.03 / 0.45	0.04 / 0.01	Muy endurecido en o41
Back L (Latigazo)	envelopeHighMid	0.50 (base) / 0.55 (o41)	3.0 / 2.20	2.0	0.14 (base) / 0.10 (o41)	0.38	0.00	Guillotina snap
Cross-filters clave:

backLLowMidWeight: 0.22 (base) / 0.00 (o41)
backLMidWeight: 0.10 (base) / 0.00 (o41)
backLTrebleSub: 0.28
moverLHighMidWeight: 2.50, moverLTrebleWeight: 1.50, moverLMidWeight: 1.50
moverRTrebleSub: 0.15
bassSubtractBase: 0.25
Kick config:

kickEdgeMinInterval: 60 (vs 80 techno)
kickVetoFrames: 0 (libertad total para 3-3-2)
morphFloor: 0.45, morphCeiling: 0.65
sidechainDepth: 0.00 (exterminado)
percMidSubtract: 2.0 (base) / 4.0 (o41)
⚠️ Riesgos del Kick Universal sobre Latino
El nuevo LiquidEngineBase.ts aplica a todos los perfiles:



ts
pureBassEnergy = max(0, bands.bass - bands.lowMid * 0.40)
dynamicDelta   = 0.120 - (pureBassEnergy * 0.080)
Riesgo	Por qué pasa en latino	Impacto
1. Subtraction agresiva	El kick dembow tiene mucho cuerpo en 250-500Hz (lowMid). Restar 40% puede dejar pureBass = 0.1-0.2 cuando el bombo real está presente.	isImpact falla. Front R no dispara.
2. Delta threshold alto	El dembow es "gordo" — ataque lento, delta ~0.02-0.04 por frame. Con pureBass=0.4, threshold = 0.088.	El bombo nunca alcanza el delta. Silencio total en Front R.
3. Reload lock universal	6 frames (~300ms) sin re-evaluación. El dembow 130BPM = ~460ms entre kicks. Parece OK, pero si el primer frame falla, los siguientes 5 tampoco evalúan.	Si el primer frame del ataque no cruza delta, el bombo entero se pierde.
🎯 Recomendaciones de Refinado
Tienes dos vías:

Vía A: Perfil-izar los coeficientes del kick (mi recomendación)
Añadir kickLowMidSubtract, kickDynamicDeltaBase, kickDynamicDeltaSlope al ILiquidProfile y que LiquidEngineBase.ts los lea de p en lugar de hardcodear:



ts
// LiquidEngineBase.ts
const lowMidSubtract = p.kickLowMidSubtract ?? 0.40
const deltaBase      = p.kickDynamicDeltaBase ?? 0.120
const deltaSlope     = p.kickDynamicDeltaSlope ?? 0.080
 
const pureBassEnergy = Math.max(0, bands.bass - (bands.lowMid * lowMidSubtract))
const dynamicDelta   = deltaBase - (pureBassEnergy * deltaSlope)
Y en latino.ts:



ts
kickLowMidSubtract:     0.20,   // Menos agresivo — el dembow NECESITA lowMid
kickDynamicDeltaBase:   0.080,  // Umbral base más bajo para kicks gordos
kickDynamicDeltaSlope:  0.040,  // Menos pendiente — delta más permisivo en general
Vía B: Ajustar solo los envelopes de latino (rápido, sin tocar engine)
Si no quieres tocar ILiquidProfile + LiquidEngineBase.ts de nuevo, compensas por exceso:

Parámetro	Ajuste	Por qué
envelopeKick.gateOn	0.08 → 0.04	Bajar el gate del envelope para que capture lo que el detector universal deja pasar con baja pureBass
envelopeKick.boost	2.5 → 4.0	Compensar señal débil con más vitamina
kickVetoFrames	seguir en 0	✅ Ya correcto
Problema de Vía B: Si pureBassEnergy cae a 0, el kickSignal = 0 y el envelope no tiene NADA que procesar. No importa cuánto bajes el gate o subas el boost — 0 × boost = 0. Esta vía solo funciona si pureBass sigue siendo > 0.1 en los bombos latinos.

🔧 Mi Veredicto
La Vía A es la correcta. El kick detection ya no puede ser "one size fits all" después de la Spectral Guillotine. El bombo techno (tight, sub-100Hz, pico vertical) y el bombo dembow (gordo, 80-300Hz, ataque redondeado) tienen físicas distintas. Un perfil que sea 0.40/0.120/0.080 para techno y 0.20/0.080/0.040 para latino es la solución limpia.

¿Quieres que implemente la Vía A ahora? Es 3 líneas en ILiquidProfile.ts, 3 líneas en LiquidEngineBase.ts, y 3 coeficientes nuevos en techno.ts + latino.ts. Tarda 2 minutos.