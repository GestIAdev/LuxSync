ANÁLISIS FORENSE: El Jitter del Snare en Minimal Techno
1. El hallazgo decisivo
Parseé los 470 frames de imposiblesnare.md y comparé SnareE en cada [ONSET] contra el frame anterior:

Cantidad
Onsets con snare_energy subiendo	12
Onsets con snare_energy bajando	49
El 80% de los disparos ocurren mientras la energía del snare está cayendo. No son snares. Son re-disparos sobre la cola de decay del snare anterior.

2. Por qué pasa: RawΔ miente, el EMA no
Medí la tasa de decay natural de snare_energy en los 298 frames sin onset:



ratio medio = 0.9323    max = 0.951    (n=298)
Es un exponencial casi perfecto, con varianza mínima. La banda del snare decae de forma completamente predecible.

Pero raw_snare_delta viene de la señal cruda pre-EMA, que en minimal techno oscila con la textura (micro-transients de synths, percusión de fondo, ruido). Así que RawΔ sigue dando picos positivos > 0.12 encima de una envolvente que está bajando.

Ejemplo textual del log — un snare real y sus tres fantasmas:

idx	SnareE	RawΔ	¿Qué pasa?
10	0.720	0.494	Snare REAL (salta de 0.028)
17	0.439	0.385	[ONSET] — pero SnareE bajó de 0.528
22	0.343	0.239	[ONSET] — pero SnareE bajó de 0.364
El detector actual pregunta "¿hubo un pico en la señal cruda?". La pregunta correcta es "¿está subiendo la energía de la banda?".

3. La refactorización: cruce de momentum de doble EMA
Sin if/else, sin flags _snareReArmed, sin cooldowns. Dos EMAs y un cruce de umbral:



emaFast ← emaFast + αF·(SnareE − emaFast)      αF = 0.50   (τ ≈ 45 ms)
emaSlow ← emaSlow + αS·(SnareE − emaSlow)      αS = 0.05   (τ ≈ 450 ms)
 
momentum = emaFast − emaSlow
 
onset = (momentum > θ) ∧ (momentumPrev ≤ θ)     θ = 0.04
Es un MACD. emaFast persigue la señal, emaSlow es la línea base inercial. Cuando pega un snare, emaFast se despega hacia arriba → momentum cruza θ. Durante el decay, emaFast cae por debajo de emaSlow → momentum se vuelve negativo → el detector se re-arma solo.

Por qué esto mata el jitter por construcción
Trazado real del snare del idx 10:

idx	SnareE	emaFast	emaSlow	momentum	Actual	EMA
9	0.028	0.030	0.015	0.0151	—	—
10	0.720	0.375	0.050	0.3249	ONSET	ONSET ✓
12	0.636	0.581	0.109	0.4719	—	—
17	0.439	0.494	0.205	0.2885	ONSET ✗	(ya arriba de θ, no cruza)
22	0.343	0.365	0.245	0.1199	ONSET ✗	(ya arriba de θ, no cruza)
29	0.236	0.250	0.254	−0.0038	—	re-armado
El cruce de umbral es un evento topológico: solo puede ocurrir una vez por subida de energía. El anti-retrigger no es una regla añadida, es una propiedad de la ecuación.

Los hi-hats desaparecen gratis
En frontdisaster.md los 34 hi-hats falsos tenían SnareE = 0.000. Si SnareE = 0, ambos EMAs quedan en 0, momentum = 0, nunca cruza. No hace falta el parche bassDelta > 0.005 ni el wns gate ni el SnareE > 0.10 floor — la matemática los excluye sola.

4. Simulación sobre todos los logs
Log	Frames	Actual	EMA-momentum	Reducción
imposiblesnare.md	470	61	19	3.2x
imposiblesnare2.md	231	25	8	3.1x
minimalonfire.md	515	72	25	2.9x
frontdisaster.md	613	50	5	10x
reguetonperfectsnare.md	454	49	20	2.4x
La reducción de 3.2x en minimal techno coincide exactamente con tu diagnóstico de "densidad 3X".

Robustez: barrí αF ∈ [0.35, 1.0] × αS ∈ [0.03, 0.12] × θ ∈ [0.02, 0.08] → el resultado se mueve entre 18 y 20 onsets. El detector no es sensible al tuning, lo cual es lo que uno quiere de una heurística física.

Los 12 onsets con energía subiendo están todos capturados. Los 7 adicionales son subidas genuinas que el test de ratio simple no veía.

5. Donde debo ser honesto
Medí la coherencia rítmica contra la rejilla de beats (21.5 frames @ 123 BPM):

n	Espaciado medio	Error vs beat-grid
Actual	61	7.6 frames	0.302
EMA-momentum	19	23.6 frames	0.314
Esto NO produce un metrónomo. El error contra la rejilla es prácticamente el mismo. Lo que arregla es la densidad (de 2.8 hits/beat a 1.1 hits/beat) y elimina el re-disparo en cola. Si el patrón real es off-beat 16ths irregular, el espaciado seguirá siendo irregular — pero será el irregular de la música, no ruido.

No puedo prometerte metrónomo sin acceso al BPM/fase del PLL, que el motor no recibe. Eso sería otra conversación.

Tonality Veto: de los 19 onsets, 3 tienen Veto < 0.15 y quedarían atenuados al ~59% de brillo. No los mata. Aceptable, pero es un efecto secundario a vigilar.

6. Implementación propuesta (profile-gated)
Regueton también baja 2.4x, y tú dices que está perfecto — por eso esto va exclusivamente en techno.ts.

ILiquidProfile.ts — tres campos opcionales:



typescript
/** WAVE 7749.65: EMA MOMENTUM SNARE DETECTOR. When defined, replaces the
 *  entire 5-path onset cascade with a dual-EMA crossover. Absent = legacy. */
readonly snareMomentumThreshold?: number
readonly snareMomentumAlphaFast?: number   // default 0.50
readonly snareMomentumAlphaSlow?: number   // default 0.05
LiquidEngineBase.ts — el bloque de detección pasa a:



typescript
let rawOnset = false
const momoTh = p.snareMomentumThreshold
if (momoTh !== undefined) {
  // TECHNO: pure-math momentum crossover. Self-limiting, no TCT flags.
  this._snareEmaFast += (p.snareMomentumAlphaFast ?? 0.50) * (snareEnergy - this._snareEmaFast)
  this._snareEmaSlow += (p.snareMomentumAlphaSlow ?? 0.05) * (snareEnergy - this._snareEmaSlow)
  const momentum = this._snareEmaFast - this._snareEmaSlow
  rawOnset = momentum > momoTh && this._snarePrevMomentum <= momoTh
  this._snarePrevMomentum = momentum
} else if (rawSnareDelta > finalSnareThreshold && spectralFlux > dynamicFluxGate && ...) {
  // LEGACY CASCADE — untouched, latino unaffected
}
techno.ts: snareMomentumThreshold: 0.04 latino.ts: sin tocar.

El detector de kick no se toca. Sin ducking, sin sidechain. Tres campos nuevos, un bloque if, y la cascada legacy intacta para latino.

¿Luz verde? Si sale mal, revertir es quitar una línea de techno.ts.