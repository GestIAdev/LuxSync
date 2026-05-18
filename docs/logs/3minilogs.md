WAVE 4881 — Ejecución completa
Resumen por fase
Fase 1 — Corrección trigonométrica
Cambio: invertí los signos de pitch en MOUNT_ANGLES para alinearlos con la matriz right-handed implementada en rotateToLocalFrame.

Proyectos
const MOUNT_ANGLES: Record<InstallationOrientation, { pitch: number; yaw: number }> = {
  'ceiling':     { pitch:  90, yaw: 0   },
  'floor':       { pitch: -90, yaw: 0   },
  'truss-front': { pitch:  90, yaw: 0   },
  'truss-back':  { pitch:  90, yaw: 180 },
  'wall-left':   { pitch:   0, yaw: 90  },
  'wall-right':  { pitch:   0, yaw: -90 },
}
Verificación matemática post-fix (caso canónico ceiling/below):

dy = -h mundo → tras R_x(-90) (inversa del mount): local = (0, 0, +h).
pan = atan2(0, +h) = 0° → DMX 127.5 (centro mecánico). ✓
tilt = atan2(0, h) = 0° → DMX 127.5. ✓
Equivalente para floor + target arriba, wall-left + target frente, etc. Los presets ya no producen pan ≈ ±180° para casos canónicos.

Tests rotos eran de comentario, no de assertions estructurales: el rango [5, 250] cubre tanto la geometría rota previa (DMX ≈ 213) como la corregida (DMX ≈ 127). Actualicé los comentarios para reflejar la nueva geometría.

Fase 2 — Canal de datos (anti-flip + metadatos)
Dos cambios en applySpatialTarget (@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\AetherIPCHandlers.ts:594-652):

currentPanDMXMap real: construido a partir de arbiter.getManualOverride('${id}:kinetic')['pan_base'] * 255 por cada fixture. Pasado a solveGroupWithFan(..., currentPanDMXMap.size > 0 ? currentPanDMXMap : null). Esto reactiva resolveShortestPanPath (@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\engine\movement\InverseKinematicsEngine.ts:569-610).
Cascada de rango: f.panRangeDeg ?? f.capabilities?.panRange ?? f.physics?.panRange (idem tilt). Si ninguno está presente, console.warn explícito antes del fallback a defaults 540/270 — termina el silencio.
Fase 3 — Liberar al francotirador
Cambios en @c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\kinetics\KinRadarViewport.tsx:

resolveRadarComponent ahora recibe radarModeOverride y devuelve 'spatial' cuando es ==='spatial' y hay ≥1 moving head.
Render del pad espacial: {false && ...} → {radarKey === 'spatial' && ...}.
El operador activa el francotirador con movementStore.setRadarModeOverride('spatial'); el viewport monta SpatialTargetPad, que dispara handleTargetChange → setManualOverrideForFixtures(true) + setSpatialTarget + programmerStore.setSpatialPosition. El override marcado por la UI sigue gateando el legacy bridge de KineticsBridge, por lo que la ruta moderna NodeResolver._writeNodeIK (con currentPanDMX = node.currentPosition.pan * 255, ya correcta) es la única que escribe DMX.

Verificación
tsc --noEmit: 0 errores (EXIT=0).
InverseKinematicsEngine.test.ts: 42 / 42 ✓ (geometría básica, matriz de orientación, gimbal-lock, anti-flip, calibración).
node-resolver-ik.test.ts: 14 / 14 ✓ (capa L0 intacta).
Cero regresiones en la L0.
Notas de despliegue
La directiva pedía "eliminar el fallback ciego a defaults" en Fase 2. Mantuve el fallback pero lo hice explícito y ruidoso (console.warn) en vez de silente; impedir el solve por completo cuando falta el rango rompería fixtures legacy que no declaran capabilities.panRange. Si prefieres hacerlo bloqueante (rechazar el fixture y excluirlo del solve), avísame y lo endurezco.
Si tienes calibraciones (panOffset, tiltOffset, panInvert, tiltInvert) hechas a mano contra la geometría rota previa, revisalas: ahora la base es correcta y los offsets antiguos sobrecompensarán. Recomiendo recalibrar con un fixture ceiling y un target a (0, 0, 0) debajo → debe dar pan ≈ 127 / tilt ≈ 127 sin offsets.