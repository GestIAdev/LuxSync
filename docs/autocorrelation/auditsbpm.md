REPORTE TÉCNICO: El Escudo sBPM — Journey of the BPM
1. El log [CHOREO] ... sBPM:NNN
Fuente: [VibeMovementManager.ts:1325-1328](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/movement/VibeMovementManager.ts:1324:0-1327:999)



typescript
console.log(
  `[CHOREO] ${vibeId} | #${this.schedulerState.patternIndex}:${patternName}...` +
  ` | scene:${sceneB}b | Pan:${panDeg} Tilt:${tiltDeg} | sBPM:${Math.round(this.smoothedBPM)} phase:${phaseDeg}°`
)
sBPM = Math.round(this.smoothedBPM). El Math.round solo afecta el display — el valor interno es float.

2. Trazado hacia atrás: this.smoothedBPM
2a. Inicialización y reset
[VibeMovementManager.ts:750-751](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/movement/VibeMovementManager.ts:749:0-750:999)



typescript
private smoothedBPM: number = 120
private readonly BPM_SMOOTH_FACTOR = 0.05  // Very slow (20 frames to converge)
Reset a 120 en línea 1481. Esto es crítico: si la sesión anterior dejó smoothedBPM=64 (por un octave-down del Oracle), y cambias de track, el EMA tarda ~20 frames en converger de 64→129. Eso explica el sBPM:64 inicial en el log de Gravity aunque el WORKER BPM=129.

2b. EMA update (hot path)
[VibeMovementManager.ts:1017-1033](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/movement/VibeMovementManager.ts:1016:0-1032:999)



typescript
const safeBPM = this.getSafeBPM(audio.bpm)   // ← CLAMP
// ...
this.smoothedBPM += (safeBPM - this.smoothedBPM) * this.BPM_SMOOTH_FACTOR  // EMA α=0.05
EMA con α=0.05 — extremadamente lento. Tiempo de convergencia τ ≈ 20 frames (~0.5s a 44fps). Para un salto 64→129: tarda ~60 frames (~1.5s) en llegar al 95%. Eso explica la rampa sBPM:64 → 122 → 129 visible en el log de Gravity.

2c. El clamp getSafeBPM
[VibeMovementManager.ts:1423-1426](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/movement/VibeMovementManager.ts:1422:0-1425:999)



typescript
private getSafeBPM(bpm: number): number {
  if (!bpm || !isFinite(bpm) || bpm <= 0) return 120
  return Math.max(60, Math.min(200, bpm))   // ← CLAMP [60, 200]
}
Clamp duro [60, 200]. No hay división por 2 aquí. Si el Oracle escupe 188, pasa como 188. Si escupe 250, se clamp a 200. Si escupe 30, se clamp a 60.

3. La "división por 2" — NO está en el path sBPM
No hay división por 2 en el path VMM. La división por 2 que observas (124→62 en Bunny) está antes del VMM — es el TempoOracle mismo que se engancha a la octava inferior.

Evidencia del log de Bunny:

Línea 88: WORKER BPM=124.26 (raw=124.26) — Oracle detecta 124 correctamente
Línea 100: WORKER BPM=125.36 (raw=125.36) conf=0.06 — conf cae a 0.06 (silencio/transición)
Línea 108: WORKER BPM=108.97 (raw=108.97) conf=0.14 — Oracle desestabilizado
Línea 116: WORKER BPM=62.53 (raw=62.53) conf=0.14 — Oracle saltó a 62 = 124/2
El raw=62.53 confirma que el Oracle mismo (pre-Kalman, pre-todo) está outputting 62. El NSDF encontró un pico a doble periodo (lag × 2) y la regla MPM lo eligió porque el pico a 124 perdió energía durante el breakdown. Esto es un problema del detector ACF, no del path sBPM.

4. El Escudo del TickEngine — Doble capa activa
El BPM pasa por dos shields antes de llegar al VMM:

Shield 1: Hysteresis Gate (líneas 394-426)
[TickEngine.ts:394-426](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/tick/TickEngine.ts:393:0-425:999)



typescript
if (workerBpm > 0 && workerConfidence > 0.5) {
  if (this._stableBpm > 0) {
    const delta = Math.abs(workerBpm - this._stableBpm) / this._stableBpm
    if (delta > TickEngine.BPM_HYSTERESIS_PCT) {  // 8%
      // Require 60 frames @ conf>0.7 within ±2 BPM tolerance
      if (Math.abs(workerBpm - this._bpmCandidate) <= 2
          && workerConfidence > 0.7) {
        this._bpmCandidateFrames++
        if (this._bpmCandidateFrames >= 60) {
          this._stableBpm = workerBpm  // accept
        } else {
          acceptedBpm = this._stableBpm  // reject, hold
        }
      } else {
        this._bpmCandidate = workerBpm  // new candidate
        acceptedBpm = this._stableBpm  // reject, hold
      }
    } else {
      this._stableBpm = workerBpm  // small change, accept
    }
  }
}
Sigue activo. Pero tiene un bug de diseño para el caso Oracle-octava-down: si el Oracle salta de 124→62 (delta = 50% > 8%), el gate lo rechaza y mantiene _stableBpm=124. PERO cuando conf cae <0.5 (como en el log de Bunny, conf=0.14), el gate entero se desactiva y entra FREEWHEEL con lastStableWorkerBpm. Si el Oracle luego reporta 62 con conf>0.5 (línea 130: conf=0.56), el gate ve 62 vs 124 → delta=50% → requiere 60 frames @ conf>0.7. Como conf=0.56 < 0.7, nunca confirma y mantiene 124. Pero el log muestra WORKER BPM=62... eso significa que el workerBpm que se loguea es el raw del worker, no el acceptedBpm post-gate. El gate está funcionando pero el log muestra el valor pre-gate.

Shield 2: EMA Smoothing (líneas 545-553)
[TickEngine.ts:545-553](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/tick/TickEngine.ts:544:0-552:999)



typescript
// 🛡️ BPM STABILIZATION SHIELD — EMA Smoothing
// α=0.15 → ~4 seconds to converge on a large step change.
if (this._smoothedBpm <= 0) {
  this._smoothedBpm = context.bpm
} else if (context.bpm > 0) {
  this._smoothedBpm = (0.15 * context.bpm) + (0.85 * this._smoothedBpm)
}
context.bpm = this._smoothedBpm  // ← OVERWRITE
Sigue activo. EMA con α=0.15, más rápido que el VMM (α=0.05). Sobreescribe context.bpm antes de pasarlo a TitanEngine/VMM. Esto significa que el VMM recibe el BPM ya suavizado por el TickEngine, y luego lo suaviza OTRA VEZ con su propio EMA. Doble suavizado.

5. Journey completo: RhythmTracker → sBPM


TempoOracle.process()
  → rawBpm (NSDF + MPM, float, e.g., 124.07)
  
RhythmTracker.process()
  → Kalman smoothing → smoothedBpm (float)
  → musicalBpm = smoothedBpm  [KILL THE POCKETS: sin fold]
  
BPMService.process()
  → bpm = track.musicalBpm (float)
  → rawBpm = track.rawBpm (float, para telemetría)
 
SensesPipeline.processFrame()
  → buildPayload({ musicalBpm: bpmOutput.bpm, rawBpm: bpmOutput.rawBpm })
  → ExtendedAudioAnalysis.bpm = musicalBpm (float)
 
Worker → IPC → TrinityBrain.handleAudioAnalysis()
  → MusicalContext.bpm = analysis.bpm (float, sin transformación)
 
TrinityBrain → emit('musical-context', context)
  → TitanOrchestrator → TickEngine
 
TickEngine (Shield 1: Hysteresis Gate)
  → workerBpm = audioPipeline.lastAudioData.workerBpm
  → if conf > 0.5: hysteresis gate (8% delta → 60f @ conf>0.7)
  → acceptedBpm = post-gate (puede ser _stableBpm si se rechaza)
  → beatDetector.setBpm(acceptedBpm)  [para el PLL]
 
TickEngine (Shield 2: EMA α=0.15)
  → _smoothedBpm = 0.15 * context.bpm + 0.85 * _smoothedBpm
  → context.bpm = _smoothedBpm  [OVERWRITE]
 
TitanEngine.update(audio, context)
  → processedContext = context (Chronos si activo)
  → movMusical.bpm = processedContext.bpm  [ya suavizado por TickEngine]
 
VibeMovementManager.generateIntent(vibeId, audio, ...)
  → safeBPM = getSafeBPM(audio.bpm)  [CLAMP 60-200]
  → smoothedBPM += (safeBPM - smoothedBPM) * 0.05  [EMA α=0.05, segundo suavizado]
  → sBPM = Math.round(smoothedBPM)  [display only]
6. Resumen de shields activos
Capa	Mecanismo	Parámetro	Estado
TempoOracle	NSDF + MPM	shortest-peak rule	Activo
RhythmTracker	Kalman filter	—	Activo
TickEngine Shield 1	Hysteresis gate	8% delta, 60f @ conf>0.7	Activo
TickEngine Shield 2	EMA	α=0.15 (~4s converge)	Activo
VMM getSafeBPM	Clamp	[60, 200]	Activo
VMM smoothedBPM	EMA	α=0.05 (~20f converge)	Activo
No hay división por 2 en ningún punto del path. La división por 2 que observas es el TempoOracle mismo cayendo a la octava inferior cuando pierde el pico fundamental (conf baja → NSDF elige el pico a doble periodo). El clamp [60, 200] del VMM es el único clamp; el TickEngine no clamp.

7. Implicaciones para la Markov Chain
Para construir un estabilizador tipo Serato/VirtualDJ, necesitas:

Octava lock en el Oracle: mantener un estado de "octava confirmada" y no permitir saltos de ×2 o ÷2 sin evidencia fuerte (conf>0.8 durante N frames). El MPM shortest-peak rule es demasiado agresivo cuando conf cae.
Eliminar el doble EMA: el TickEngine (α=0.15) + VMM (α=0.05) encadenan dos pasabajos. El VMM debería usar el BPM del TickEngine directamente, o viceversa.
El hysteresis gate del TickEngine ya protege contra octave-down (delta 50% > 8% → reject), pero solo si conf>0.5. Cuando conf cae <0.5, el gate se desactiva y el FREEWHEEL mantiene el último valor — eso es correcto. El problema es que cuando el Oracle recupera conf>0.5 pero reporta 62 (octava abajo), el gate lo rechaza correctamente, pero el workerBpm que se loguea es pre-gate, dando la impresión de que el sistema aceptó 62.
¿Quieres que proceda con alguna de estas líneas, o prefieres más telemetría primero?