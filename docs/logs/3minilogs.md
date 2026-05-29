REPORTE FORENSE: WAVE 4937 — SPATIAL FALLBACK & UNLOCK PAYLOAD AUDIT
Estado: READ-ONLY | Fecha: 2026-05-29

Misión 1: Auditoría del Caos Espacial (Inverse Kinematics)
Localización
Motor: src/engine/movement/InverseKinematicsEngine.ts (solve(), líneas 203-303)
Handler: src/core/aether/AetherIPCHandlers.ts (applySpatialTarget, líneas 647-830)
Análisis Matemático (Defaults 540°/270°)
tiltDeg = Math.atan2(horizontalDist, -local.y) * RAD_TO_DEG produce valores en [0°, 180°].

El mapeo a DMX es:

typescript
tiltDMXRaw = ((tiltDeg + 135) / 270) * 255
Con tiltDeg = 180°:

tiltDMXRaw = ((180 + 135) / 270) * 255 = 1.1667 * 255 = 297.4 → Excede 255.
¿Está garantizada la salida en [0.0, 1.0]?
SÍ. solve() aplica tres capas de defensa finales (líneas 286-300):

reachable evaluado con margen de seguridad.
tiltLimits clamp (si existen).
Clamp absoluto a [0, 255] (líneas 299-300):
typescript
panDMX  = Math.max(0, Math.min(DMX_MAX, Math.round(panDMX)))
tiltDMX = Math.max(0, Math.min(DMX_MAX, Math.round(tiltDMX)))
En el handler IPC (líneas 803-804): normalización por división / 255.
Guard anti-NaN (líneas 805-811).
Veredicto: El IK engine NO emite valores fuera de [0.0, 1.0].

Causa Real del Caos Espacial
El caos no viene de rangos desbordados, sino de una colisión de mapas en el Árbitro:

applySpatialTarget escribe en _motorKineticOverrides (línea 818):
typescript
arbiter.setMotorKineticOverride(`${id}:kinetic`, { pan_base: panNorm, tilt_base: tiltNorm })
_flushClassic (con patrón activo) y setManualPattern escriben en _manualOverrides con pan_base/tilt_base.
En _applyRelativeOffsetFusion (línea 853):

typescript
const basePan = hasMotorPan ? (motorPan as number)
              : hasManualPan ? (manualPan as number)
              : 0.5
Prioridad: motor > manual > 0.5.

Si un fixture recibió Spatial Target (motor) y luego un patrón/hold (manual), la base depende de qué mapa todavía tenga datos. Alternar entre spatial y patrón genera saltos bruscos porque la fuente de pan_base cambia de mapa sin sincronización, y removeNodes() del motor NO limpia _motorKineticOverrides (salvo que clearManualOverride sea invocado explícitamente).

Misión 2: Auditoría del Veneno de Unlock (undefined Payload)
Localización
Emisor: src/bridges/KineticsBridge.ts (_flushPattern, líneas 515-587)
Handler IPC: src/core/aether/AetherIPCHandlers.ts (setManualPattern, líneas 397-538)
Ruta de Ejecución del Unlock
En la UI, cuando el operador detiene el patrón (cambia a "none" o "static"), KineticsBridge ejecuta toEnginePattern('none') → devuelve 'hold' (línea 74-76).
_flushPattern envía siempre anchorPan y anchorTilt calculados desde movementStore.pan / 540 y movementStore.tilt / 270 (líneas 565-567). Nunca envía undefined desde aquí.
El handler IPC setManualPattern recibe el payload. Al evaluar pattern === null || pattern === 'static' || pattern === 'hold' (línea 422), entra en la rama de stop/removal:
typescript
const removeNodeIds = fixtureIds.map(id => `${id}:kinetic`)
aetherKineticEngine.removeNodes(removeNodeIds, arbiter)
Retorna inmediatamente. No toca anchorPan/anchorTilt.
¿Inyecta undefined en setManualOverride?
NO. Aunque hipotéticamente llegara anchorPan: undefined, el handler lo convierte a null (línea 472):

typescript
const fallbackPan = (typeof anchorPan === 'number' && Number.isFinite(anchorPan))
  ? ...
  : null
Y luego (línea 508):

typescript
if (finalPan === null || finalTilt === null) continue
Se descarta silenciosamente; nunca llega a setManualOverride.

¿Invoca clearManualOverride al hacer Unlock?
NO. Este es el vector crítico.

Cuando el operador detiene el patrón (enviando pattern: 'hold' desde el frontend), el handler IPC llama a aetherKineticEngine.removeNodes() pero OMITE limpiar _manualOverrides del NodeArbiter.

Los canales pan_base/tilt_base que KineticsBridge._flushClassic escribió previamente en _manualOverrides permanecen congelados en la caché L2.

Consecuencia: La Trampa del Unlock Fantasma
Tras un Unlock vía stop de patrón:

_manualOverrides sigue conteniendo pan_base/tilt_base del radar.
_motorKineticOverrides fue borrado por removeNodes() (o por el fix WAVE 4935 en clearManualOverride).
_applyRelativeOffsetFusion detecta hasManualPan=true, hasMotorPan=false, hasMotorTilt=false.
Entra en HOLD state (línea 828):
typescript
const isHoldState = (hasManualPan || hasManualTilt) && !hasMotorPan && !hasMotorTilt
if (isHoldState) {
  if (hasManualPan && !isFiniteChannelValue(manualAbsPan)) record['pan'] = manualPan as number
  ...
  continue
}
El fixture se congela en el último pan_base/tilt_base del patrón.
Si el operador mueve el radar clásico (ahora sin patrón), _flushClassic envía canales pan/tilt absolutos (no pan_base), pero _manualOverrides todavía tiene los pan_base/tilt_base residuales.
El merge in-place de setManualOverride (línea 319) fusiona los nuevos pan/tilt con los viejos pan_base/tilt_base.
_applyRelativeOffsetFusion lee manualAbsPan (el nuevo valor absoluto del radar), pero el bloque HOLD ya no lo ignora si hasManualPan sigue siendo true... generando competencia entre el valor absoluto y el base congelado.
Conclusiones Forenses
Vector de Colapso	Hallazgo
IK emitiendo >1.0	NEGATIVO. solve() clampa a [0,255] y el handler divide por 255.
undefined corrompiendo caché	NEGATIVO. El handler convierte undefined a null y hace continue.
Causa real del caos	Dual-map collision. _motorKineticOverrides (spatial) y _manualOverrides (pattern) compiten por pan_base/tilt_base en _applyRelativeOffsetFusion con prioridad motor>manual.
Causa real del Unlock roto	Orphan override. pattern: 'hold' → removeNodes() NO limpia _manualOverrides. Los pan_base/tilt_base quedan congelados eternamente, bloqueando L0 y confundiendo al radar.
Vector de Propagación Identificado
Unlock defectuoso → L2 Zombie:

Operador activa patrón manual → _flushClassic escribe pan_base/tilt_base en _manualOverrides.
Operador detiene patrón (Unlock) → KineticsBridge envía pattern: 'hold'.
Handler IPC ejecuta removeNodes() pero deja _manualOverrides intacto.
_manualOverrides sigue con pan_base/tilt_base del radar anterior.
Sin motor activo, _applyRelativeOffsetFusion entra en HOLD state.
Fixture congelado. Radar clásico envía pan/tilt absolutos, pero el merge in-place los mezcla con pan_base/tilt_base zombies.
El sistema entra en un estado híbrido indeterminado que solo se resuelve con reinicio de app (clearAllManualOverrides global nunca fue invocado en este flujo).
Fin del Reporte.-

Kimi 2.6

-------------------------------------------------
-------------------------------------------------
-------------------------------------------------

nforme Forense WAVE 4937

1) Caos espacial / IK

La ruta real del cálculo está en AetherIPCHandlers.applySpatialTarget y construye perfiles con AetherIPCHandlers.ts:736 antes de llamar a AetherIPCHandlers.ts:787.
Cuando faltan panRangeDeg o tiltRangeDeg, el handler avisa y cae a defaults de industria 540°/270° en vez de abortar.
El solver IK puro está en InverseKinematicsEngine.solve. Ahí:
calcula ángulos brutos panDeg y tiltDeg,
los convierte a DMX bruto,
evalúa reachability antes del clamp,
aplica límites mecánicos,
aplica safety margin,
y hace clamp final a 0..255 antes de devolver el resultado.
Conclusión forense:
La salida final del solver no sale de [0,255].
El handler convierte luego a normalizado con panNorm = pan / 255 y tiltNorm = tilt / 255, así que la salida que termina escribiéndose en L2 queda garantizada en [0,1].
No hay evidencia en el código inspeccionado de que pan_base o tilt_base final excedan [0,1].
Matiz importante:
Sí pueden existir valores intermedios brutos fuera de rango antes del clamp, y eso marca reachable = false.
Por tanto, el “caos rotacional” no viene de que el resultado final normalizado se vaya por encima de 1, sino de la geometría/intermedio y del recorte por límites mecánicos cuando el perfil depende de defaults 540°/270°.
2) Veneno de Unlock / payload undefined

La ruta de entrada del payload L2 está en ProgrammerAetherBridge._flush y despacha dos cosas distintas:
setManualOverrides(...) cuando hay payload de escritura,
clearManualOverrides(...) cuando el snapshot sólo trae nodos a limpiar, vía AetherIPCHandlers.ts:100 y NodeArbiter.clearManualOverride.
La ruta de Unlock con patrón nulo no entra por clearManualOverrides:
El callsite relevante está en KineticsBridge._flushPattern, que llama a window.lux?.aether?.setManualPattern(...).
Ahí el payload incluye pattern, anchorPan y anchorTilt; para unlock/stop el patrón llega como null, static o hold.
En backend, el handler IPC está en AetherIPCHandlers.setManualPattern.
Si pattern === null || pattern === 'static' || pattern === 'hold', el handler:
construye removeNodeIds,
llama a AetherKineticEngine.removeNodes,
y si ya no queda motor activo, silencia VMM con setManualPattern(null), setManualSpeed(null), setManualAmplitude(null) y setKineticFanOffsets({}).
Conclusión forense:
En la ruta de Unlock con pattern: null, el handler no llama a setManualOverride con undefined ni inyecta anchorPan/anchorTilt nulos en el Árbitro.
Lo que hace es eliminar nodos cinéticos mediante removeNodes(), que sólo limpia el rastro L2-MOTOR con clearMotorKineticOverride y preserva _manualOverrides.
El único camino de limpieza de manual overrides es el explícito clearManualOverrides → clearManualOverride, no la ruta de Unlock con pattern: null.
Sobre anchorPan: undefined, anchorTilt: undefined:
En la rama activa del patrón, esos valores se convierten en fallbackPan/fallbackTilt; si no son números, quedan como null.
Si no hay radar ni IK anchor, el nodo se omite y no se escribe un payload inválido.
No hay evidencia de corrupción por undefined en setManualOverride dentro de esta ruta.
Veredicto corto

IK: la salida final que llega al árbitro está normalizada y clamped; no se observó overflow final fuera de [0,1].
Unlock: la ruta de pattern: null no mete undefined en setManualOverride; hace removeNodes() y limpia el motor cinético, no el cache manual.
GPT-5.4 mini • 0.3x