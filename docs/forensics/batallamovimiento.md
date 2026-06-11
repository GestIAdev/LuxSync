AUDITORÍA FORENSE — WAVE 6019.5 POST-MORTEM
0. Leyenda del flujo de datos (para seguir el diagnóstico)


UI botón patrón → PatternArsenal.onClick('none')
                  → movementStore.activePattern = 'none'
                  → KineticsBridge._flushPattern('release')
                  → IPC: setManualPattern({ pattern: 'release' })
                  → AetherIPCHandlers:
                      1. aetherKineticEngine.removeNodes()   → borra _nodeConfigs + _motorKineticOverrides
                      2. arbiter.clearManualOverride()        → captura snapshot en _releaseStates
                      3. vibeMovementManager.setManualPattern(null) → VMM scheduler retoma control
                  → NodeArbiter.arbitrate():
                      1. _applyRelativeOffsetFusion()         → L0 (KineticAdapter) emite pan_offset/tilt_offset
                      2. _applyReleaseFades()                → intenta blend snapshot manual → L0
                  → NodeResolver.resolve():
                      _writeNode() → _writeNodeIK (espacial) o ruta clásica (pan/tilt)
PROBLEMA 1: ¿Qué corrompe el paso desde L2 a L0? (VMM clásico)
TRAMPA A — El Release Fade contradice al patrón L0 recién nacido
Ubicación: NodeArbiter.ts:1309-1320 (fix aplicado, pero con consecuencia no prevista)

Cuando se hace release, clearManualOverride captura un snapshot con pan/tilt (ahora normalizados por el fix anterior). El snapshot contiene la última posición física del foco bajo control manual (ej. pan=0.72, tilt=0.35).

Durante los siguientes ~200ms, _applyReleaseFades ejecuta:



NodeArbiter.ts:1316
let blended = releaseValue * fadeWeight + l0Value * (1.0 - fadeWeight)
Pero l0Value no es el valor "de reposo" al que debería degradarse. Es el valor que KineticAdapter + _applyRelativeOffsetFusion acaban de computar para el patrón automático L0 en este mismo frame (ej. pan=0.31, tilt=0.62 — completamente diferente geometría).

El fade interpola entre la última posición manual y una posición aleatoria del patrón automático. Durante 200ms el foco es tirado entre dos puntos distintos del espacio. Eso es el "enloquecen" — no es un NaN, es un blend entre dos intenciones incompatibles.

¿Por qué no se notaba antes? Antes del fix WAVE 6019.5, el mapeo era 'none' → 'hold'. Fix C migraba motor→manual, congelando el foco en la última posición. El release fade corría pero l0Value era undefined → se saltaba. El foco se quedaba congelado. Al separar 'release' como purga destructiva, ahora L0 retoma inmediatamente y el fade se ejecuta contra un patrón activo.

TRAMPA B — El scheduler del VMM cambia de patrón bruscamente al liberar
Ubicación: VibeMovementManager.ts:757-761 + scheduler sceneBeatsElapsed

Cuando setManualPattern(null) se invoca en la ruta 'release':



VibeMovementManager.ts:757-761
setManualPattern(pattern: string | null): void {
  if (pattern === null || pattern === 'static') {
    this.manualPatternOverride = null
    console.log(`[CHOREO] Pattern → AI control (Selene)`)
    return
  }
}
El scheduler interno del VMM (sceneBeatsElapsed) nunca se detuvo mientras el patrón manual estaba activo. Cuando manualPatternOverride pasa a null, el scheduler evalúa:



typescript
// Pseudocódigo del scheduler (líneas ~936-948 aprox)
if (manualPatternOverride === null && sceneBeatsElapsed >= phraseDuration) {
  // Cambiar al siguiente patrón inmediatamente
}
Si el usuario ha tenido un patrón manual activo durante más de phraseDuration beats (ej. 64 beats = ~32 segundos a 120 BPM), el scheduler cambia de patrón instantáneamente en el primer frame post-release. El foco salta de la geometría manual (ej. 'circle') a la nueva geometría del scheduler (ej. 'scan_x' o 'darkspin') sin crossfade ni safe-harbor.

Veredicto: El "enloquecen" es una doble colisión:

Frame 1-N (200ms): Release Fade tira el foco entre posición manual y posición L0 aleatoria.
Frame N+1: El scheduler VMM puede cambiar de patrón bruscamente si sceneBeatsElapsed superó phraseDuration.
PROBLEMA 2: ¿Qué sigue ocurriendo con los movers centrales? (Espacial)
TRAMPA C — El gate L2 supremacy no reconoce targets espaciales manuales
Ubicación: KineticAdapter.ts:210-214



KineticAdapter.ts:210-214
if (
  aetherKineticEngine.hasNode(node.nodeId) ||
  (arbiter && arbiter.getMotorKineticOverride(`${fixtureId}:kinetic`) !== undefined)
) {
  return // L2 SUPREMACY
}
Este gate silencia L0 solo cuando hay un patrón oscilatorio manual (hasNode) o un motor override. Pero en modo espacial, el usuario no activa un patrón oscilatorio — inyecta targetX/targetY/targetZ en _manualOverrides del Arbiter.

Resultado: En modo espacial, KineticAdapter nunca se calla. Continúa emitiendo pan_offset/tilt_offset (patrón automático sinusoidal) cada frame. El Arbiter recibe:

L2: targetX/targetY/targetZ → van al resolver vía _writeNodeIK
L0: pan_offset/tilt_offset → _applyRelativeOffsetFusion los suma a base 0.5
Los focos ejecutan ambas rutas simultáneamente: apuntan al target espacial MÁS oscilan con el patrón automático centrado en 0.5. Eso explica por qué los focos se comportan erráticamente en espacial.

¿Por qué los CENTRALES se desincronizan?
Ubicación: KineticAdapter.ts:247-257 (Fix D — zona neutral)



KineticAdapter.ts:247-257
const posX = node.physicalPosition?.x ?? node.position?.x
let lrPhaseOffset = 0
if (posX !== undefined && Number.isFinite(posX)) {
  if (posX > 0.5) {
    lrPhaseOffset = Math.PI
  }
  // |x| ≤ 0.5 → 0 (zona neutral)
}
Los fixtures centrales (|x| ≤ 0.5) reciben phaseOffset = 0. Los laterales derechos (x > 0.5) reciben phaseOffset = π. En la ruta clásica pura, esto crea contrapunto simétrico (uno va a la izquierda, otro a la derecha).

Pero en espacial, cada foco tiene un target espacial diferente (definido por el usuario en el radar 3D). Además, el patrón automático L0 se superpone. El foco central (phase 0) sigue su target espacial MÁS el patrón automático en fase 0. El foco lateral (phase π) sigue SU target espacial MÁS el patrón automático en fase π (dirección opuesta). La combinación de targets espaciales diferentes + fases opuestas del patrón automático produce que los focos apunten en direcciones aparentemente desincronizadas.

Cuando se hace release espacial:

targetX/targetY/targetZ se borran.
Los focos caen al patrón automático puro.
Centrales (phase 0) y laterales (phase π) se mueven en contrapunto.
El usuario interpreta esto como "los centrales se desincronizaron".
Veredicto: Los fixes para ceiling (A, B, C, D) SÍ están aplicados, pero solo en la ruta clásica. En espacial, el problema no es la orientación del ceiling — es que L0 nunca se silencia, permitiendo que el patrón automático se superponga a los targets espaciales manuales.

RESUMEN FORENSE
Síntoma	Causa raíz real	Ubicación	¿Fix anterior afectó?
Focos "enloquecen" al soltar patrón clásico	Doble colisión: (1) Release Fade interpola posición manual contra patrón L0 activo (geometrías incompatibles). (2) VMM scheduler cambia de patrón bruscamente al liberar manual override si sceneBeatsElapsed >= phraseDuration.	NodeArbiter._applyReleaseFades:1316, VibeMovementManager.setManualPattern:760	Sí — separar 'release' de 'hold' expuso el fade a un L0 activo
Movers centrales desincronizados en espacial	Gate L2 supremacy incompleto: KineticAdapter no detecta targets espaciales manuales (targetX/Y/Z), sigue emitiendo offsets L0 que se suman al IK. Fix D (neutral zone) funciona, pero la superposición L0+L2 enmascara el efecto.	KineticAdapter.ts:210-214	No — Fix D es correcto para clásico, pero irrelevante para espacial
Nota arquitectónica: El sistema asume implícitamente que "modo espacial" y "modo clásico" son mutuamente excluyentes a nivel de UI. Pero en el backend, KineticAdapter no tiene visibilidad de si el usuario está en modo espacial. Solo ve si hay motor L2 activo. La solución arquitectónica correcta sería que el gate L2 supremacy también verifique la presencia de targetX/targetY/targetZ en _manualOverrides del Arbiter.

Estado: Auditoría completa. Cero modificaciones realizadas.