Diagnóstico: Pérdida de Señal bL (Back-Left)
Resumen Ejecutivo
El canal bL no está muerto — enciende durante breakdowns y transiciones de synth. Pero durante las barras de kick (que son ~70% del set techno), la señal mid es estructuralmente demasiado baja para cruzar la doble barrera del envelope: gate + squelch. La remoción del dmzFactor mejoró el bL_in (ahora es más alto que antes), pero no fue suficiente para compensar la naturaleza espectral del techno.

Causa 1: backLLowMidWeight = 0.0 — La banda lowMid está completamente excluida
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hal/physics/profiles/techno.ts:165



backLLowMidWeight: 0.0,   // WAVE 2430: original no usaba lowMid
La fórmula actual (post-dmzFactor) es:



bL_in = max(0, bands.lowMid * 0.0 + bands.mid * 0.85 * (1 - vocalPenalty*0.8) - 0 - 0)
      = max(0, bands.mid * 0.85)
Solo mid * 0.85 alimenta bL. La banda lowMid — que en techno lleva cuerpo de synths, pads y bass harmonics — contribuye cero. Si lowMid tuviera peso (ej. 0.3-0.5), bL_in ganaría 0.03-0.10 adicionales en barras de kick, suficiente para cruzar el gate en muchos casos.

Evidence del log: mid durante kicks = 0.05-0.18. Con 0.85 weight → bL_in = 0.04-0.15. Gate = 0.155. Justo por debajo del gate.

Causa 2: Doble barrera — Gate (0.155) + Squelch (0.15-0.18) requieren bL_in > ~0.168
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hal/physics/LiquidEnvelope.ts:331-356

El envelope tiene dos umbrales consecutivos:

Gate check (stage 8): signal > dynamicGate (0.155) → genera kickPower
Ignition squelch (stage 9): kickPower > squelch (0.15-0.18)
El squelch con squelchBase=0.25, squelchSlope=0.10:

morph=0.85 → squelch = 0.25 - 0.085 = 0.165
morph=1.0 → squelch = 0.25 - 0.10 = 0.150
Para que kickPower > 0.165, necesitamos rawPower > 0.165, lo que requiere:



(signal - 0.155) / requiredJump > 0.165
signal > 0.155 + 0.165 * 0.08 ≈ 0.168
Muchos valores de bL_in viven en 0.15-0.17: cruzan el gate pero no generan suficiente kickPower para vencer el squelch.

Ejemplo del log (línea 12): bL_in:0.156, bL_gate:0.155, bL_sq:0.173, bL_pow:0.012, bL_ign:0 — cruzó el gate pero kickPower=0.012 << squelch=0.173.

Causa 3: velocity >= attackSlopeMin (default 0) — Requiere flanco ascendente estricto
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hal/physics/LiquidEnvelope.ts:305



typescript
const attackSlopeMin = c.attackSlopeMin ?? 0
El perfil envelopeHighMid no define attackSlopeMin, así que defaults a 0. La condición en stage 8 es:



typescript
if (gateCondition && signal > dynamicGate && isAttacking && signal > 0.15 && velocity >= attackSlopeMin)
Esto significa velocity >= 0 — la señal debe estar subiendo o plana. Si bL_in está bajando (aunque esté sobre el gate), no genera kickPower.

Ejemplo del log:

Línea 14: bL_in:0.199 (subiendo de 0.156) → velocity=+0.043 → bL_ign:1 ✓
Línea 15: bL_in:0.182 (bajando de 0.199) → velocity=-0.017 → bL_ign:0 ✗
En techno, mid oscila en meseta (no en picos abruptos). Muchos frames tienen velocity ≈ 0 o ligeramente negativa, fallando este check.

Causa 4: El kick mata el mid espectralmente
Durante isK:1, bass domina (0.9-1.0) y mid colapsa a 0.05-0.15. Esto es física acústica del techno, no un bug del motor:

Pattern consistente en el log (líneas 4-10, todas isK:1):

Línea	bass	mid	bL_in	bL_ign
4	1.000	0.176	0.150	0
5	1.000	0.176	0.150	0
7	1.000	0.135	0.115	0
8	1.000	0.104	0.088	0
9	1.000	0.088	0.075	0
10	0.914	0.068	0.058	0
El 70%+ del log son barras de kick donde bL_in < 0.155.

Causa 5: ghostCap = 0.0 — Sin brillo residual entre ignitions
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hal/physics/profiles/techno.ts:122



ghostCap: 0.00,        // WAVE 3492: 0.05->0.00 — negro entre golpes
Cuando bL no ignita, el ghostPower path (stage 8, línea 340-346) genera 0 porque ghostCap=0.0. La única luz visible es el decay tail de ignitions anteriores (outBL muestra 0.3-0.8 pero decayendo). Esto crea la ilusión de que "hay luz" pero en realidad es solo el eco de un ignition previo decayendo, no nueva actividad.

Causa 6: Los breakdowns prueban que el envelope funciona
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/docs/Selene V3/logscalib/sinback.md:680-729

Durante brk:1, morph:1.0, bass baja a 0.5-0.7 y mid sube a 0.3-0.45:

Línea	bass	mid	bL_in	bL_ign	outBL
690	0.666	0.452	0.384	1	1.000
691	0.668	0.463	0.393	1	1.000
710	0.628	0.314	0.267	1	1.000
715	0.647	0.347	0.295	1	1.000
El envelope funciona perfectamente cuando hay señal. El problema es que en techno non-breakdown, la señal simplemente no existe en la banda mid.

Potenciales Soluciones para Discutir
Activar backLLowMidWeight (0.0 → 0.3-0.5) — Sumaría lowMid a bL_in, dándole 0.03-0.10 extra en barras de kick. Es el cambio de perfil más limpio.
Bajar squelchBase (0.25 → 0.15-0.18) — Reduciría la barrera de ignition. Actualmente el squelch es casi tan alto como el gate, creando una zona muerta entre 0.155 y 0.168 donde la señal cruza el gate pero no ignita.
Definir attackSlopeMin negativo (ej. -0.01) — Permitiría que señales ligeramente descendientes sigan generando kickPower. Útil para techno donde mid oscila en meseta.
Subir backLMidWeight (0.85 → 1.0-1.2) — Más gain en la entrada. Simple pero puede generar falsos positivos en secciones silentes.
Restaurar un ghostCap pequeño (0.0 → 0.02-0.03) — No resuelve la falta de ignitions pero daría un brillo base que el operador percibe como "back activo" en lugar de oscuridad total.


Feedback submitted