1. Métricas del LiquidEnvelope (Ataque / Hold / Decay / Transientes)
[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hal/physics/LiquidEnvelope.ts:164-338](cci:4://file://c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hal/physics/LiquidEnvelope.ts:163:0-337:999)

Cada banda (SubBass, Kick, Snare, HighMid, Vocal, Treble) pasa por 10 etapas deterministas:

Ataque (Velocity Gate)

isRisingAttack = velocity >= -0.005
isGraceFrame (Undertow): 1 frame de gracia si el anterior fue ataque real
attackSlopeMin: pendiente mínima configurable (ej. latino envelopeHighMid usa 0.02, envelopeVocal usa -0.05)
Hold

Kick: _kickHoldCounter = 6 (~132ms a 44Hz) — WAVE 2439.9
Snare: _snareHoldCounter = 4 (~90ms) — WAVE 6070
Strobe: strobeDuration del perfil (latino 25ms, techno 30ms)
Decay

Fórmula: decay = decayBase + decayRange × morphFactor
Intensidad se multiplica por decay cada frame (0.0–1.0)
Ejemplo latino envelopeSubBass: decayBase=0.50, decayRange=0.08 → en morph 0.8: decay=0.54 (caída rápida, staccato)
Transient Multipliers (Crush + Boost)

rawPower = (signal - dynamicGate) / requiredJump
kickPower = Math.pow(rawPower, crushExponent + 0.3*(1-morphFactor))
hit = kickPower × (1.2 + 0.8*morphFactor) × boost
Ejemplo latino envelopeVocal: boost=12.0, crushExponent=0.60 (curva cóncava que infla valores bajos)
2. Zonas Ambient, Air, Flash — Filtrado exclusivo
Ambient (@LiquidEngineBase.ts:369-376, 670-684)

Input: subBass puro (WAVE 4812 M2, antes bass×0.4+mid×0.6)
EMA: attack _ambAttackAlpha = 1000/(ms×44), release _ambReleaseAlpha
Latino: ambientAttackMs=200, ambientReleaseMs=280 → alpha attack ≈0.114, release ≈0.081
Post-proceso: _ambientCrushed = pow(EMA, 2.0), luego preGainAmbient = min(1.0, crushed × 1.35), final pow(preGainAmbient, 1.3)
Noise-gate suave: si <0.03, fade exponencial ×0.85
Air (@LiquidEngineBase.ts:386-393, 687)

Input: treble×0.6 + highMid×0.4
EMA: attack alpha=0.12 (~8 frames), release alpha=0.05 (~20 frames)
Soft-compression: 1 - exp(-signal×3)
Final: airIntensity = min(1.0, EMA × recoveryFactor × 1.4) (boost 1.4x WAVE 4826.3)
Flash (Strobe) (@LiquidEngineBase.ts:867-895)

isPureTreblePeak = treble > effectiveThreshold
isUltraAirCombo = ultraAir > 0.70 && treble > 0.60
Umbral latino: strobeThreshold=0.85, strobeNoiseDiscount=0.85 → en noiseMode umbral baja a 0.7225
Duración: 25ms (latino), 30ms (techno)
3. impact-20 — Umbrales de disparo que lo alimentan
impact-20 es el nodo IMPACT/FLASH del Tungsten (@fixtures/user-1775343513755-71zc1qeo4.json:374,432).

Constitución física:

Canal Golden dimmer (dmxOffset 2) → aetherNodeId: "impact-20", aetherZone: "flash", defaultDmxValue: 20
Canal Strobe (dmxOffset 3) → mismo nodo, con ignitionDeps: [{channelType: "dimmer", requiredValue: 255}]
Cómo se alimenta del motor:

En NodeExtractionPipeline.ts, los canales IMPACT (dimmer, strobe, shutter) se agrupan en NodeFamily.IMPACT
El nodo IMPACT lleva:
bandMix: subBass: 0.80, bass: 0.60, mid: 0.20, highMid: 0.05, treble: 0.05
transferCurve: lineal, noiseGate: 0.0
constraints: responseType: 'digital', maxValue: 255
Esto significa que el dimmer de impact-20 reacciona principalmente a subBass + bass (graves del bombo). El strobe, como depende del dimmer (ignition dep), solo se habilita cuando el dimmer llega a 255.
4. El "Efecto Güiro" (WAVE 4826.5)
@LiquidEngineBase.ts:637-643



typescript
// WAVE 4826.5 — EFECTO GÜIRO INYECTADO EN STROBE (El verdadero FLASH dorado)
// Detectar drops realistas e inyectar trebleDelta puro para flashes dorados en Tungsten
const isDrop = bands.bass < 0.35 && bands.lowMid < 0.4
if (isDrop && trebleDelta > 0.25) {
  strobeResult.active = true
  strobeResult.intensity = Math.min(1.0, strobeResult.intensity + trebleDelta * 2.0)
}
Mecánica:

Condición de "drop": bajos contenidos (bass < 0.35, lowMid < 0.4) → pasaje ligero, vocal o güiro.
Disparador: trebleDelta > 0.25 → un transitorio agudo brusco (güira raspada, siseo de voz, platillo).
Efecto: fuerza strobeResult.active = true e inyecta trebleDelta × 2.0 en la intensidad del strobe, sobrepasando el umbral normal de strobeThreshold=0.85.
Por qué se ve como "flash dorado pequeño":

El strobe del Tungsten está dentro de impact-20, que tiene defaultDmxValue: 20 en el dimmer (suele estar bajo/moderado).
Cuando el güiro dispara el strobe forzado, el strobeDuration es solo 25ms (latino) → flash breve.
Como el dimmer está en 20 (no 255), el strobe no debería ni siquiera habilitarse por ignitionDeps... a menos que el dimmer suba por el bandMix de IMPACT (subBass/bass).
Diagnóstico del comportamiento "güiro + voz":

Una voz con sibilante fuerte genera trebleDelta > 0.25.
Si esa voz tiene cuerpo en bass o subBass, el dimmer de impact-20 sube por el bandMix (subBass 0.80).
Si el dimmer llega a 255, el strobe se habilita.
Pero en un pasaje de "drop" (bass < 0.35), el dimmer NO sube tanto... salvo que haya un transitorie de voz aguda que coincida con un pico de graves.
La calibración actual puede estar causando:

Falsos positivos: voces sostenidas que generan trebleDelta repetido → strobe parpadea.
O miss: güiros reales que no rompen trebleDelta > 0.25 porque el mastering los aplastó.


---------------------------------------

TECHNO

1. Métricas LiquidEnvelope — Techno vs Latino
[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hal/physics/profiles/techno.ts](cci:4://file://c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hal/physics/profiles/techno.ts:0:0-0:0)

Banda	gateOn	boost	crushExp	decayBase	decayRange	squelchBase	vs Latino
SubBass (Océano)	0.08	2.7054	1.0	0.2218	0.166	0.0613	Decay 2× más lento que kick, pero 2× más rápido que latino (0.50)
Kick (Francotirador)	0.28	3.3013	1.0	0.0077	0.0329	0.0388	Decay ultra-rápido (latino 0.60). Corte quirúrgico entre kicks.
Snare (Látigo)	0.35	1.0	1.0	0.05	0.40	0.20	Decay staccato extremo (latino 0.72). Dura un frame y muere.
HighMid (Synths)	0.15	1.5	1.0	0.62	0.25	0.25	Más colchón que latino (0.14) — sintetizadores respiran.
Vocal (Mover R)	0.25	1.5	3.5	0.70	0.05	0.30	Bozal duro: crush 3.5 aplasta colchón (latino 0.60, boost 12).
Treble (Mover L)	0.25	4.0	3.5	0.78	0.03	0.30	Idem: solo picos afilados de arpegio pasan.
Transient Shaper (Back R):

percGate: 0.06 (latino base 0.065 / 41 0.085)
percBoost: 5.0 (latino base 4.0 / 41 2.8)
percExponent: 0.5 (raíz cuadrada — suaviza transitorio; latino 0.6 / 41 1.35)
2. Zonas Ambient, Air, Flash — Techno
@LiquidEngineBase.ts + @techno.ts

Ambient

Techno: ambientAttackMs: 30, ambientReleaseMs: 120 — WAVE 4826.5 "La Guillotina Techno"
Latino: ambientAttackMs: 200, ambientReleaseMs: 280
Alfa EMA: attack ≈ 0.758, release ≈ 0.189 (44Hz) — sube casi instantáneo, caída ~6× más rápida que latino.
Curva post-EMA: pow(EMA, 2.0) → ×1.35 → pow(..., 1.3) (misma fórmula que latino, pero la EMA cruza el umbral mucho antes y se desploma mucho más rápido).
Air

Input idéntico: treble×0.6 + highMid×0.4
EMA: attack 0.12, release 0.05 (hardcode en base — no varía por perfil).
Final: airIntensity = EMA × recoveryFactor × 1.4 (mismo boost 1.4x WAVE 4826.3).
Flash (Strobe)

Techno: strobeThreshold: 0.80, strobeDuration: 30ms, strobeNoiseDiscount: 0.80
Latino: strobeThreshold: 0.85, strobeDuration: 25ms, strobeNoiseDiscount: 0.85
En modo noiseMode, umbral baja a 0.64 (techno) vs 0.7225 (latino). Techno es más permisivo con strobe.
3. impact-20 — Alimentación en Techno
La constitución física del nodo es idéntica:

bandMix: subBass: 0.80, bass: 0.60, mid: 0.20, highMid: 0.05, treble: 0.05
transferCurve: lineal, noiseGate: 0.0
ignitionDeps: dimmer a 255 para habilitar strobe.
Pero los umbrales que lo alimentan cambian drásticamente:

Señal	Techno	Latino
SubBass pasa a frontLeft (envSubBass)	gateOn: 0.08	0.15 (base) / 0.22 (41)
Kick pasa a frontRight (envKick)	gateOn: 0.28	0.18
Bass global en impact-20 bandMix	subBass 0.80 + bass 0.60	idem
Consecuencia para impact-20:

En Techno, el subBass pasa más fácil (gateOn 0.08 vs 0.15/0.22), así que el dimmer de impact-20 sube más rápido y con menor energía de grave.
Pero el kick (frontRight) tiene gateOn 0.28 muy alto — solo golpes brutos pasan. El dimmer no se dispara por "ruido de pista".
En Latino, el subBass está más blindado (gateOn 0.22 en 41), pero el kick es más permisivo (0.18).
El strobe de impact-20 en Techno:

Dura 30ms (vs 25ms latino).
Umbral base más bajo (0.80 vs 0.85), por lo que isPureTreblePeak dispara con menos energía aguda.
4. El "Efecto Güiro" en Techno
@LiquidEngineBase.ts:637-643

El código es idéntico — es agnóstico de perfil:



typescript
const isDrop = bands.bass < 0.35 && bands.lowMid < 0.4
if (isDrop && trebleDelta > 0.25) {
  strobeResult.active = true
  strobeResult.intensity = Math.min(1.0, strobeResult.intensity + trebleDelta * 2.0)
}
Pero el contexto cambia:

Factor	Techno	Latino
strobeDuration	30ms	25ms
strobeThreshold base	0.80 (más permisivo)	0.85
strobeNoiseDiscount	0.80	0.85
envelopeVocal (Mover R)	Bozal duro (gateOn 0.25, crush 3.5)	Casi abierto (gateOn 0.02, boost 12)
Implicación:

En Techno, una voz sostenida es mucho menos probable que genere trebleDelta > 0.25 porque el entorno general tiene menos energía en medios-agudos (la voz no suele estar presente en pistas techno industriales). Si aparece, el envelopeVocal con gateOn 0.25 y crushExponent 3.5 la aplasta antes de que llegue al strobe.
En Latino, la voz es protagonista y el envelopeVocal está casi abierto (gateOn 0.02), por lo que los trebleDelta de sibilantes son más frecuentes y peligrosos.
El strobe forzado dura 5ms más en techno, pero el entorno musical hace que el falso positivo "voz+güiro" sea menos probable que en latino.
Resumen clave: Tenías razón con el release. Techno: 120ms vs Latino: 280ms. Esa diferencia se siente en el Tungsten como "cortes limpios y secos" en vez de "fundidos suaves". Además, todos los decays de envelopes en techno están diseñados para staccato quirúrgico (kick 0.0077, snare 0.05) mientras que latino permite que la luz respire (kick 0.60, snare 0.72).