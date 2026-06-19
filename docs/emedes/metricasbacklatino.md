1. BACK LEFT — "El Latigazo Percusivo" (envHighMid)
Parámetros efectivos (4.1 con overrides)
Parámetro	Base	Override 4.1	Efectivo
backLLowMidWeight	0.22	0.00	0.00
backLMidWeight	0.10	0.00	0.00
backLTrebleSub	0.28	—	0.28
backLBassSub	0.0	—	0.0
gateOn	0.50	0.55	0.55
boost	3.0	2.20	2.20
decayBase	0.14	0.10	0.10
squelchBase	0.38	—	0.38
crushExponent	2.0	—	2.0
attackSlopeMin	0.02	0.03	0.03
sustainedSquelchStartFrames	—	3	3
sustainedFlatVelocityMax	—	0.007	0.007
La fórmula de entrada real (motor)


typescript
// Golden Patch DMZ (universal, aplica también a latino)
const cleanMidL = Math.max(0, bands.mid - (bands.bass * 0.55))
 
// PERO en latino 4.1, backLMidWeight = 0.00 y backLLowMidWeight = 0.00
const midSynthInput = Math.max(0,
  bands.lowMid * 0.00 + cleanMidL * 0.00 * (1.0 - vocalPenalty * 0.80)
  - bands.treble * 0.28 - bands.bass * 0.0
)
// = max(0, -treble * 0.28) = 0
Resultado: midSynthInput es 0 en todo momento. El canal Back L no recibe alimento. El envHighMid procesa silencio absoluto.

Discrepancia con la telemetría
El LiquidEngine41Telemetry.ts calcula highMidInput con la fórmula antigua (sin cleanMidL, sin vocalPenalty):



typescript
const highMidInput = Math.max(0,
  bands.lowMid * p.backLLowMidWeight + bands.mid * p.backLMidWeight
  - bands.treble * p.backLTrebleSub - bands.bass * p.backLBassSub
)
Como los pesos también son 0.00 en el perfil fusionado, el telemetry reportaría hmIn: 0.000 siempre. Pero en el log latino1.md (formato antiguo compacto) ni siquiera se exporta hmIn — solo bPar (que en strict-split es Back R, no Back L).

Veredicto Back L
Canal apagado por diseño en 4.1. Si quieres recuperar congas/palmas/claves en Back L, hay que restaurar pesos > 0.
El cleanMidL de 0.55 (Golden Patch) ahora está ahí esperando. Si restauras pesos, la DMZ suavizará el bombo en los medios.
2. BACK RIGHT — "El TAcka del Dembow" (envSnare / Transient Shaper)
Parámetros efectivos (4.1 con overrides)
Parámetro	Base	Override 4.1	Efectivo
percGate	0.065	0.085	0.085
percBoost	4.0	2.8	2.8
percExponent	0.6	1.35	1.35
percMidSubtract	2.0	4.0	4.0
gateOn	0.40	0.55	0.55
boost	3.5	2.5	2.5
decayBase	0.72	0.45	0.45
squelchBase	0.03	0.45	0.45
ghostCap	0.04	0.01	0.01
Fórmula actual en el motor (Golden Patch incluido)


typescript
const rawSpike = highMidDelta + trebleDelta
const snareSpectrum = bands.mid * ((bands.treble * 0.5) + harshness)
const rawSnareCalc = (rawSpike * snareSpectrum * 10.0) > 0.19
Luego pasa por el Transient Shaper latino:



typescript
hybridSnare = percRaw * percBoost ^ percExponent
// con protección anti-voz: percMidSubtract = 4.0 (!!)
Análisis de la telemetría real (latino1.md)
Tomando 3 frames representativos del log:



markdown
[LATINO-41] sB:0.241 mid:0.783 hMid:0.476 tr:0.327 | tDelta:0.0174 percRaw:0.069 | fPar:0.000 bPar:0.850
[LATINO-41] sB:0.139 mid:0.537 hMid:0.282 tr:0.197 | tDelta:0.0621 percRaw:0.248 | fPar:0.000 bPar:0.850
[LATINO-41] sB:0.352 mid:0.983 hMid:0.465 tr:0.175 | tDelta:0.0380 percRaw:0.152 | fPar:0.091 bPar:0.000
Frame	mid	treble	tDelta	percRaw	bPar	Diagnóstico
1	0.783	0.327	0.0174	0.069	0.850	bPar alto con percRaw muy bajo → decay del envelope (0.45 decayBase mantiene energía entre golpes)
2	0.537	0.197	0.0621	0.248	0.850	Transiente real detectado, envelope pega fuerte
3	0.983	0.175	0.0380	0.152	0.000	fPar:0.091 (front kick bajo). Back R apagado. mid altísimo (0.983) probablemente voz/sinte → percMidSubtract=4.0 anula el transiente
Observaciones clave:

bPar es puro Back R (en strict-split, backPar = backRight). No hay contribución de Back L.
Decay de 0.45 es visible — el canal permanece encendido (bPar:0.850) incluso cuando percRaw cae a 0.069. Eso genera "cola de reverb" en los PARs traseros.
percMidSubtract: 4.0 es un muro — en el frame 3, mid=0.983 genera harmonicBase ≈ 3.93. Aunque haya un transiente (tDelta=0.038), el ratio transientTop / harmonicBase probablemente no supere 0.88, así que tonalSquelch = 0 y el Back R se apaga. Esto está funcionando como anti-autotune, pero también puede estar matando cajas reales que coincidan con voz.
3. Comparativa Latino vs Techno (Back Channels)
Aspecto	Techno (actual)	Latino (actual)	Impacto
Back L input	cleanMidL * 0.85 vivo	0.00 (muerto)	Latino pierde congas/palmas en Back L
Back L gate	0.374 (aprox)	0.55	Latino mucho más estricto
Back R percMidSubtract	implícito ~1.0	4.0	Latino anula transients cuando hay voz
Back R gate	0.22 (Golden Patch)	0.55 (override)	Latino exige golpes más brutos
Back R squelch	~0.11	0.45	Latino asfixia ruido de fondo agresivamente
Back R decay	0.45 (Golden base)	0.45	Iguales
Anti-HiHat (treble*0.5)	Aplica	Aplica	Latino podría perder güira/trompeta aguda
4. Problemas Identificados para el Repaso
P1: Back L apagado en 4.1
overrides41 anula los pesos del cross-filter. Si quieres que Back L vuelva a capturar congas/claves, necesitas:

Restaurar backLLowMidWeight y backLMidWeight a valores > 0 (ej. 0.22 / 0.10 del base, o ajustados)
O re-rutar la señal de congas a otro canal (mover L ya tiene mucha carga)
P2: percMidSubtract: 4.0 puede ser excesivo
En reggaetón, la voz y la caja comparten frecuencias medias. Con mid * 4.0, cualquier caja que no sea un transiente extremadamente puro queda anulada. Esto explicaría por qué en el log bPar a veces no reacciona a golpes que "deberían" ser claros.

P3: El Golden Patch afecta latino sin adaptación
La DMZ cleanMidL (0.55) ahora resta graves de los medios para todos los perfiles. En latino, el bajo melódico/cumbia tiene mucha energía en bass. Si restauras backLMidWeight, la DMZ podría cortar demasiado.
El treble * 0.5 en snareSpectrum penaliza güiras y trompetas latinas. En techno los hi-hats son "basura"; en latino la güira es instrumento principal. ¿Queremos matarla?
5. Recomendaciones de Ajuste (propuestas)
Si quieres que le dé repaso con parches, te propongo:

Recuperar Back L (canal de congas/palmas):
Restaurar backLLowMidWeight: 0.22, backLMidWeight: 0.10 en overrides41 (o subirlos ligeramente)
Ajustar cleanMidL a un valor más suave para latino (ej. 0.35 en vez de 0.55) porque el bajo latino es melódico, no solo bombo
Suavizar Anti-Autotune en Back R:
Bajar percMidSubtract: 4.0 → 2.0 o 2.5 para dejar pasar cajas reales
O subir el ratio de tonalSquelch (actual < 0.88) a algo más permisivo para latino
Preservar güira/trompeta:
Revertir o adaptar snareSpectrum para latino: quizás bands.treble * 0.8 en vez de * 0.5, o hacer el factor dependiente del perfil
Sincronizar telemetry con el motor real (añadir cleanMidL al cálculo de highMidInput en LiquidEngine41Telemetry.ts)
