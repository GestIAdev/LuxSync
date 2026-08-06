CHILL AMBIENT ENGINE — DIAGNOSTIC AUDIT
Modo: READ-ONLY forensic audit — No se modificó código. Engine: ChillAmbientEngine.ts (WAVE 6055 / 7129 — BOREAL OCEAN) Síntomas: (1) Blinking intermittent de movers, (2) Pan/Tilt congelado

0. VEREDICTO RESUMEN
Bug	Root Cause	Archivo	Línea	Severidad
Blink	Photon Strobe override (dimmerOverride=1.0) pisa el dimmer suave del chill sin guard de vibe	SeleneLux.ts	1277-1288	CRITICAL
Freeze	buildMechanicsBypassIntent dropea el campo intensity → bypass emite dimmer:0 a priority 50	MovementGenerators.ts	196-197	CRITICAL
El ChillAmbientEngine en sí es correcto — es una función pura de performance.now() que produce senoidales suaves y continuos. Los bugs están en los consumidores del frame.

1. CHILLAMBIENTENGINE — AUDIT DEL MOTOR
1.1 Arquitectura
[ChillAmbientEngine.ts](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hal/physics/ChillAmbientEngine.ts:0:0-0:0)

El motor es 100% stateless — no hereda de LiquidEngineBase, no tiene EMA, no tiene event listeners, no tiene acoplamiento a audio. Es una función pura de performance.now():



typescript
tick(): ChillAmbientFrame {
  const t = performance.now() / 1000
  // 1. Morph: sin(2πt/200) + sin(2πt/600) → [0.20, 0.80]
  // 2. La Ola: sin(t/9.55 + phaseOffset) → [0.10, 0.60] per zone
  // 3. Glaciar: sin(t/15) → pan [0.30, 0.70], cos(t/25) → tilt [0.55, 0.85]
  return { morphFactor, dimmer, frontL, frontR, backL, backR, moverL, moverR, _ts }
}
1.2 Veredicto: Audio-Coupling
El motor está perfectamente decoupled del audio. No hay:

Listeners de BPM, zScore, o energy drops
Overrides de tick() basados en audio metrics
Envelopes que reaccionen a silencio o ghost beats
Estado acumulado que pueda degradarse
El problema NO está en el motor. Está en cómo sus outputs son consumidos y sobreescritos aguas abajo.

2. BUG 1: BLINKING DIMMER — ROOT CAUSE
2.1 El Path Normal del Dimmer en Chill


ChillAmbientEngine.tick() → chillFrame.dimmer [0.20, 0.80]
  ↓
SeleneLux.ts:662 → dimmerOverride = chillFrame.dimmer
  ↓
TitanEngine.ts:1199-1200 → finalMasterIntensity = nervousOutput.dimmerOverride
  ↓
HAL → DMX (dimmer suave, marea de 200s/600s)
Esto es correcto. El dimmer debería respirar suavemente entre 0.20 y 0.80 con períodos de 200s y 600s.

2.2 El Path del Strobe que Pisa el Dimmer
[SeleneLux.ts:1273-1289](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/reactivity/SeleneLux.ts:1272:0-1288:999)



typescript
// 🌊 WAVE 8004: PHOTON STROBE
if (photon?.strobe?.active) {           // ← NO guard de isChill
  strobeOverride = { rate, duty };
  isStrobeActive = true;
  dimmerOverride = 1.0;                  // ← PISA el dimmer del chill
}
No existe ningún guard isChill en este bloque. El strobe se evalúa después del bloque chill (que setea dimmerOverride = chillFrame.dimmer), y lo sobreescribe a 1.0 si el StrobeEngine del GodEarFFT detecta transitorios.

2.3 StrobeEngine — Activación en Chill
[GodEarFFT.ts:1278-1279](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1277:0-1278:999)



typescript
private static readonly ACTIVATION_THRESHOLD = 0.38;
private static readonly DEACTIVATION_THRESH = 0.12;
private static readonly HOLD_DURATION_MS = 200;
El StrobeEngine activa cuando driveSmooth > 0.38, donde drive es una combinación ponderada de:

transientDensity × 0.40 (onset rate)
whiteNoiseScore × 0.40 (broadband noise)
spectralFlux × 0.20 (spectral change)
En chill/ambient con percusión sparse (hi-hats, brushes, rimshots):

Un hi-hat aislado puede generar transientDensity ≈ 0.30-0.50 por un frame
Combinado con whiteNoiseScore ≈ 0.10-0.20 del haze/ruido ambiente
driveRaw ≈ 0.30 × 0.40 + 0.15 × 0.40 + 0.05 × 0.20 = 0.19 — por debajo del umbral
Pero en material chill con redoblantes suaves o transitorios de brush:

2-3 onsets en ráfaga → transientDensity ≈ 0.50-0.70
driveRaw ≈ 0.60 × 0.40 + 0.15 × 0.40 + 0.08 × 0.20 = 0.32 — cerca del umbral
Con EMA attack k=0.60: driveSmooth salta a 0.19 + 0.60 × (0.32 - 0.19) = 0.27 — aún abajo
Pero con 3-4 frames de transitorios: driveSmooth converge hacia 0.32+ → supera 0.38
2.4 El Ciclo de Blinking


Frame N:   chill sine dimmer = 0.45 (suave)
Frame N+1: transient hit → driveSmooth > 0.38 → strobe ACTIVE
           dimmerOverride = 1.0  ← SNAP a full brightness
Frame N+2..N+8 (200ms hold): dimmerOverride = 1.0 (mantenido por hold latch)
Frame N+9: hold expires, drive < 0.12 → strobe INACTIVE
           dimmerOverride revierte a chillFrame.dimmer = 0.43  ← SNAP de vuelta
Frame N+10..N+M: dimmer suave hasta el próximo transient
Resultado visual: Movers flash a full brightness (1.0) por ~200ms, luego vuelven al dimmer suave del chill (~0.20-0.80). La frecuencia depende de la densidad de transitorios en el audio — semi-regular en chill con percusión sparse.

2.5 Confirmación: No hay guard de chill en el path del strobe


SeleneLux.ts:658-664  → dimmerOverride = chillFrame.dimmer  (chill path)
SeleneLux.ts:1277     → if (photon?.strobe?.active)         (NO isChill check)
SeleneLux.ts:1288     → dimmerOverride = 1.0                (OVERRIDE)
El bloque del strobe se ejecuta incondicionalmente para todos los vibes. No hay if (isChill && !photon?.strobe?.active) ni similar.

3. BUG 2: FROZEN MOVEMENT — ROOT CAUSE
3.1 El Path de Pan/Tilt en Chill


ChillAmbientEngine.tick() → chillFrame.moverL/R { pan, tilt }
  ↓
SeleneLux.ts:738 → deepFieldMechanics.moverL/R = { pan, tilt, intensity }
  ↓
SeleneLux.ts:1320 → nervousOutput.mechanics.moverL/R = { pan, tilt, intensity }
  ↓
TitanEngine.ts:1000 → buildMechanicsBypassIntent(mech.moverL, mech.moverR)
  ↓
TickEngine.ts:1120-1141 → _aetherBus.push({ pan, tilt, dimmer })  priority 50
  ↓
NodeArbiter → HAL → DMX
3.2 El Bug: buildMechanicsBypassIntent Dropea intensity
[MovementGenerators.ts:182-199](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/generators/MovementGenerators.ts:181:0-198:999)



typescript
export function buildMechanicsBypassIntent(
  mechL: { pan: number; tilt: number },  // ← Type NO incluye intensity
  mechR: { pan: number; tilt: number },  // ← Type NO incluye intensity
): ProtocolMovementIntent {
  return {
    ...
    mechanicsL: { pan: ..., tilt: ... },  // ← intensity DROPPED
    mechanicsR: { pan: ..., tilt: ... },  // ← intensity DROPPED
  }
}
El tipo del parámetro es { pan: number; tilt: number } — no incluye intensity. Pero en runtime, mechL llega como { pan, tilt, intensity } (porque viene de deepFieldMechanics que sí lo incluye). La función solo copia pan y tilt al resultado, descartando intensity.

3.3 TickEngine Lee intensity Que No Existe
[TickEngine.ts:1120-1141](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/tick/TickEngine.ts:1119:0-1140:999)



typescript
if (intent.movement?.mechanicsL && intent.movement?.mechanicsR) {
  const _mechL = intent.movement.mechanicsL   // { pan, tilt } — NO intensity
  const _mechR = intent.movement.mechanicsR   // { pan, tilt } — NO intensity
  this._aetherGraph.getView(NodeFamily.KINETIC).forEach((node: any) => {
    if (node.isContinuous) return
    const _posX = node.physicalPosition?.x ?? node.position?.x ?? 0
    const _mech = (_posX < 0) ? _mechL : _mechR
    const _dimmer = Math.max(0, Math.min(1, _mech.intensity ?? 0))  // ← ALWAYS 0
    this._aetherBus.push({
      nodeId: node.nodeId,
      values: {
        pan:  Math.max(0, Math.min(1, _mech.pan)),   // ✅ correcto
        tilt: Math.max(0, Math.min(1, _mech.tilt)),  // ✅ correcto
        dimmer: _dimmer,                              // ❌ ALWAYS 0
      },
      priority: 50,        // LTP — domina sobre L0 (priority 0)
      mergeStrategy: 'LTP',
    })
  })
}
_mech.intensity es undefined → _dimmer = 0 → el bypass emite dimmer: 0 a priority 50 para cada nodo KINETIC.

3.4 Consecuencia: Movers a Negro
Con priority: 50 y mergeStrategy: 'LTP', este intent domina sobre:

LiquidAetherAdapter (priority 0) que emite dimmer = 0.5 (neutral chill)
Cualquier otro intent L0
El dimmer final de los movers en el arbiter es 0. Los movers están apagados.

El Pan/Tilt SÍ está cambiando (los valores de chillFrame.moverL/R son senoidales suaves y se inyectan correctamente), pero como el dimmer es 0, no hay luz visible — el usuario percibe los movers como "congelados" porque no puede ver el movimiento.

3.5 Por Qué el Blink "Resucita" los Movers
Cuando el StrobeEngine activa (Bug 1):

dimmerOverride = 1.0 en SeleneLux
finalMasterIntensity = 1.0 en TitanEngine:1200
El masterIntensity se aplica como multiplicador/HTP global sobre todos los fixtures
Si el HAL aplica max(masterIntensity, perNodeDimmer) (HTP):

max(1.0, 0) = 1.0 → movers visibles por 200ms
Si el HAL aplica masterIntensity × perNodeDimmer:

1.0 × 0 = 0 → movers siguen apagados
El comportamiento observado ("blink") sugiere que el HAL usa HTP o un path alternativo que permite que el masterIntensity=1.0 del strobe supere el dimmer=0 del bypass. Esto es consistente con el blink: movers visibles durante el strobe, invisibles entre strobes.

3.6 Sospechoso Secundario: node.isContinuous
[TickEngine.ts:1123-1124](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/tick/TickEngine.ts:1122:0-1123:999)



typescript
this._aetherGraph.getView(NodeFamily.KINETIC).forEach((node: any) => {
  if (node.isContinuous) return  // ← Skip continuous nodes
Si los movers en el show file están marcados con isContinuous: true, el bypass los salta. El KineticAdapter también los salta (línea 232-234). Resultado: ningún intent de pan/tilt se emite para esos nodos → se quedan en su posición default del JSON.

Esto es un sospechoso secundario — depende de la configuración del show file. Si los movers NO están marcados como isContinuous, el bypass los alcanza y el Bug principal (dimmer=0) aplica.

4. MATRIZ DE FLUJO — TRACE COMPLETO


ChillAmbientEngine.tick()
│
├─ morphFactor [0.20, 0.80] ──→ SeleneLux:663 ──→ LiquidEngine71.morphFactorOverride
│                                                    (osciladores cromáticos)
│
├─ dimmer [0.20, 0.80] ──────→ SeleneLux:662 ──→ dimmerOverride
│                                                    │
│                                                    ▼
│                                         TitanEngine:1200
│                                         finalMasterIntensity = dimmerOverride
│                                                    │
│                                              ✅ CORRECTO
│                                                    │
│                                         SeleneLux:1288
│                                         if (photon.strobe.active)
│                                           dimmerOverride = 1.0  ❌ BLINK
│                                                    │
│                                                    ▼
│                                              DMX dimmer
│
├─ frontL/R, backL/R ───────→ SeleneLux:730-737 ──→ liquidStereoOverrides
│                                                    (La Ola zonal)
│                                              ✅ CORRECTO
│
└─ moverL/R { pan, tilt } ──→ SeleneLux:738-741 ──→ deepFieldMechanics
                                                     { pan, tilt, intensity }
                                                          │
                                                          ▼
                                               SeleneLux:1320 → nervousOutput.mechanics
                                                          │
                                                          ▼
                                               TitanEngine:1000
                                               buildMechanicsBypassIntent(mech.moverL, mech.moverR)
                                                          │
                                                   ❌ DROPS intensity
                                                          │
                                                          ▼
                                               intent.movement.mechanicsL/R
                                               { pan, tilt }  ← NO intensity
                                                          │
                                                          ▼
                                               TickEngine:1127
                                               _dimmer = _mech.intensity ?? 0
                                                          │
                                                   ❌ ALWAYS 0
                                                          │
                                                          ▼
                                               _aetherBus.push({
                                                 pan, tilt,  ✅ correcto
                                                 dimmer: 0,  ❌ BLACKOUT
                                                 priority: 50
                                               })
                                                          │
                                                          ▼
                                               NodeArbiter → HAL → DMX
                                               Pan/Tilt: cambiando (invisible)
                                               Dimmer: 0 (apagado)
5. HALLAZGOS DETALLADOS
5.1 Bug 1 — Blinking: Photon Strobe sin Guard de Chill
Aspecto	Detalle
Archivo	SeleneLux.ts
Línea	1277-1288
Condición	if (photon?.strobe?.active) — sin check de isChill
Efecto	dimmerOverride = 1.0 pisa el dimmer suave del chill
Frecuencia	Semi-regular, dependiente de transitorios en el audio chill
Duración del flash	200ms (HOLD_DURATION_MS del StrobeEngine)
StrobeEngine	GodEarFFT.ts:1252 — ACTIVATION_THRESHOLD = 0.38
Fix propuesto	Guard isChill antes del bloque strobe, o suprimir strobe en chill
5.2 Bug 2 — Freeze: buildMechanicsBypassIntent Dropea intensity
Aspecto	Detalle
Archivo	MovementGenerators.ts
Línea	182-199
Bug	Tipo del parámetro { pan, tilt } no incluye intensity
Efecto	mechanicsL/R en el intent solo tienen pan y tilt
Consecuencia	TickEngine:1127 lee _mech.intensity ?? 0 → siempre 0
Prioridad del intent	50 (LTP) — domina sobre L0 del LiquidAetherAdapter
Resultado	Movers reciben dimmer: 0 → apagados → movimiento invisible
Fix propuesto	Incluir intensity en el tipo y en el output de buildMechanicsBypassIntent
5.3 Sospechoso Secundario — node.isContinuous
Aspecto	Detalle
Archivo	TickEngine.ts
Línea	1124
Condición	if (node.isContinuous) return
Efecto	Si movers están marcados isContinuous, bypass los salta
Resultado	Ningún intent de pan/tilt → posición default del JSON
Fix propuesto	Verificar show file — movers NO deben ser isContinuous
6. POR QUÉ EL MOTOR NO ES EL CULPABLE
El ChillAmbientEngine es funcionalmente correcto:

Stateless: tick() es función pura de performance.now() — no hay estado que se degrade
Audio-decoupled: No importa nada de audio metrics, no tiene listeners, no lee BPM/energy
Salidas correctas:
morphFactor ∈ [0.20, 0.80] — senos de 200s/600s
dimmer = morphFactor — mismo rango
frontL/R, backL/R ∈ [0.10, 0.60] — ola de 240s
moverL/R.pan ∈ [0.30, 0.70] — barrido de 94s
moverL/R.tilt ∈ [0.55, 0.85] — barrido de 157s
reset() es no-op — no hay nada que resetear
Los bugs están en el pipeline de consumo, no en el motor. El motor produce los valores correctos, pero:

El strobe los pisa (Bug 1)
El bypass de movement dropea el intensity (Bug 2)
Esperando instrucciones para el fix.