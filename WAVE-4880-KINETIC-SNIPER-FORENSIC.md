# WAVE 4880 — THE KINETIC SNIPER
## Auditoria forense matematica y aislamiento arquitectonico (read-only)

Fecha: 2026-05-17
Alcance: diagnosticar por que falla el apuntado real a cantantes en la ruta spatial/IK y verificar si la inyeccion manual L2 esta aislada frente a L0.

---

## 1) Veredicto ejecutivo

Resultado principal:
- El problema NO parece estar en una formula trigonometrica aislada tipo atan2 mal puesta.
- El fallo dominante es de datos de perfil IK y de contexto dinamico faltante (orientacion/rangos/current pan), lo que deriva en geometria correcta sobre un modelo fisico equivocado.

Impacto directo en "kinetic sniper":
1. El solver calcula con defaults (ceiling, 540/270) en rutas donde deberia usar metadatos reales por fixture.
2. En la ruta IPC spatial legacy se desactiva shortest-path al pasar currentPanMap = null.
3. Resultado visible: apuntado inconsistente, inversiones aparentes en montajes no-ceiling y giros largos no musicales en cruces.

---

## 2) Hallazgos forenses (ordenados por severidad)

### H-1 (Critico): shortest-path/anti-flip neutralizado en la ruta spatial IPC

Evidencia:
- El solver solo aplica anti-flip si currentPanDMX no es null:
  - electron-app/src/engine/movement/InverseKinematicsEngine.ts:237
  - electron-app/src/engine/movement/InverseKinematicsEngine.ts:238
- applySpatialTarget llama solveGroupWithFan con currentPanDMXMap = null:
  - electron-app/src/core/aether/AetherIPCHandlers.ts:621
  - electron-app/src/core/aether/AetherIPCHandlers.ts:625
  - electron-app/src/core/aether/AetherIPCHandlers.ts:626

Diagnostico:
- En cruces de hemisferio de pan, el solver no tiene referencia de posicion actual y no puede elegir la rama angular mas corta de forma mecanicamente suave.
- Esto produce trayectorias "largas" o contraintuitivas en escena real.

---

### H-2 (Critico): mismatch de rangos mecanicos en applySpatialTarget (f.panRangeDeg/f.tiltRangeDeg)

Evidencia:
- applySpatialTarget usa f.panRangeDeg/f.tiltRangeDeg al construir profile:
  - electron-app/src/core/aether/AetherIPCHandlers.ts:611
  - electron-app/src/core/aether/AetherIPCHandlers.ts:612
- En el schema FixtureV2 inspeccionado no existen esos campos root-level; si existen orientacion/calibration/channels:
  - electron-app/src/core/stage/ShowFileV2.ts:669
  - electron-app/src/core/stage/ShowFileV2.ts:722
  - electron-app/src/core/stage/ShowFileV2.ts:758

Diagnostico:
- Si panRangeDeg/tiltRangeDeg no llegan en runtime, buildProfile cae a defaults 540/270.
- Fixtures reales con rangos diferentes quedan mal proyectados en DMX aunque la trigonometria sea correcta.

---

### H-3 (Alta): ruta targetX/Y/Z por NodeResolver opera mayormente con perfil IK incompleto

Evidencia:
- NodeResolver toma defaults cuando ikOrientation/ikLimits no existen:
  - electron-app/src/core/aether/resolver/NodeResolver.ts:1319
  - electron-app/src/core/aether/resolver/NodeResolver.ts:1320
  - electron-app/src/core/aether/resolver/NodeResolver.ts:1328
  - electron-app/src/core/aether/resolver/NodeResolver.ts:1339
  - electron-app/src/core/aether/resolver/NodeResolver.ts:1340
- Nodo kinetico generado en ingestion sin setear ikOrientation/ikLimits/ikCalibration explicitos:
  - electron-app/src/core/aether/ingestion/NodeExtractionPipeline.ts:977
  - electron-app/src/core/aether/ingestion/NodeExtractionPipeline.ts:1016
  - electron-app/src/core/aether/ingestion/NodeExtractionPipeline.ts:1021

Diagnostico:
- La ruta IK basada en targetX/Y/Z puede terminar resolviendo como ceiling 540/270 por omision.
- En montajes floor/wall/truss personalizados, eso equivale a eje fisico equivocado aunque la math sea "limpia".

---

### H-4 (Media): SpatialTargetPad esta actualmente en cuarentena de montaje

Evidencia:
- Componente importado pero render bloqueado por guard constante:
  - electron-app/src/components/hyperion/kinetics/KinRadarViewport.tsx:33
  - electron-app/src/components/hyperion/kinetics/KinRadarViewport.tsx:306
  - electron-app/src/components/hyperion/kinetics/KinRadarViewport.tsx:307

Diagnostico:
- La auditoria de "pipeline SpatialTargetPad activo" no coincide con el estado actual: la UI pad esta deshabilitada en ese viewport.
- El sistema spatial puede estar entrando por otros carriles (programmerStore/bridge), no por ese montaje concreto.

---

### H-5 (Media): aislamiento de carriles spatial existe, pero depende de flags de override coherentes

Evidencia:
- KinRadarViewport al mover target marca manual override y emite targetX/Y/Z al programmer:
  - electron-app/src/components/hyperion/kinetics/KinRadarViewport.tsx:232
  - electron-app/src/components/hyperion/kinetics/KinRadarViewport.tsx:233
- KineticsBridge evita flush spatial legacy si todos los fixtures ya estan en manual override:
  - electron-app/src/bridges/KineticsBridge.ts:250
  - electron-app/src/bridges/KineticsBridge.ts:265
- programmerStore guarda targetX/Y/Z en metros directos:
  - electron-app/src/stores/programmerStore.ts:828
  - electron-app/src/stores/programmerStore.ts:837
  - electron-app/src/stores/programmerStore.ts:838
  - electron-app/src/stores/programmerStore.ts:839

Diagnostico:
- La arquitectura SI intenta evitar doble escritura (legacy spatial IPC vs programmer targetX/Y/Z).
- Si el set de manualOverrideFixtureIds no refleja exactamente la seleccion activa, puede reaparecer competencia de carriles.

---

## 3) Validacion de trigonometria pura (pedido del auditor)

### 3.1 Vector base y angulos

Evidencia:
- Vector fixture->target y transform local:
  - electron-app/src/engine/movement/InverseKinematicsEngine.ts:197
  - electron-app/src/engine/movement/InverseKinematicsEngine.ts:525
- Pan/Tilt calculados con atan2:
  - electron-app/src/engine/movement/InverseKinematicsEngine.ts:217
  - electron-app/src/engine/movement/InverseKinematicsEngine.ts:220

Lectura forense:
- La pareja atan2(local.x, local.z) y atan2(-local.y, horizontalDist) es internamente coherente con su frame local declarado.
- No se detecta aqui una inversion trigonometrica obvia de libro (tipo eje cruzado por error de funcion).

### 3.2 Orientacion de montaje

Evidencia:
- Presets de montaje en solver:
  - electron-app/src/engine/movement/InverseKinematicsEngine.ts:158
  - electron-app/src/engine/movement/InverseKinematicsEngine.ts:159
  - electron-app/src/engine/movement/InverseKinematicsEngine.ts:160
  - electron-app/src/engine/movement/InverseKinematicsEngine.ts:163
- Uso de orientacion default en NodeResolver cuando falta metadata:
  - electron-app/src/core/aether/resolver/NodeResolver.ts:1319

Lectura forense:
- El modelo de orientacion existe y es razonable.
- El fallo aparece cuando esa orientacion no llega correctamente al perfil de nodo/ruta usada.

### 3.3 Traduccion grados->DMX y rangos reales

Evidencia:
- Mapeo angular a DMX dentro de solve:
  - electron-app/src/engine/movement/InverseKinematicsEngine.ts:229
  - electron-app/src/engine/movement/InverseKinematicsEngine.ts:230
- Rango mecanico por defecto 540/270:
  - electron-app/src/engine/movement/InverseKinematicsEngine.ts:122
  - electron-app/src/engine/movement/InverseKinematicsEngine.ts:123

Lectura forense:
- Formula correcta en abstracto.
- Error practico: si panRange/tiltRange no corresponden al fixture real, todo el mapeo queda sesgado.

### 3.4 Flip-state / shortest-path

Evidencia:
- Anti-flip implementado:
  - electron-app/src/engine/movement/InverseKinematicsEngine.ts:237
  - electron-app/src/engine/movement/InverseKinematicsEngine.ts:575
- En NodeResolver IK si hay currentPanDMX:
  - electron-app/src/core/aether/resolver/NodeResolver.ts:1202
  - electron-app/src/core/aether/resolver/NodeResolver.ts:1204
- En applySpatialTarget legacy se pasa null:
  - electron-app/src/core/aether/AetherIPCHandlers.ts:626

Lectura forense:
- Algoritmo existe, pero no se utiliza en todas las rutas.
- El comportamiento "a veces gira largo" queda explicado sin inventar bugs trig nuevos.

---

## 4) Aislamiento arquitectonico L2 override vs L0 movement

Veredicto: aislamiento mayormente correcto a nivel de arbitraje por canal/nodo.

Evidencia:
- Mapa L2 manual dedicado:
  - electron-app/src/core/aether/NodeArbiter.ts:132
- Smart Gate bloquea escritura L0/L1 en canales tocados por L2:
  - electron-app/src/core/aether/NodeArbiter.ts:700
  - electron-app/src/core/aether/NodeArbiter.ts:733
- applySpatialTarget inyecta pan_base/tilt_base en L2 manual:
  - electron-app/src/core/aether/AetherIPCHandlers.ts:634

Observacion:
- El aislamiento depende de que el mismo carril sea consistente por frame. Si se mezclan rutas (legacy spatial + programmer targetXYZ) sin sincronizar flags de override, aparece competencia operacional, no matematica.

---

## 5) Causa raiz compuesta del fallo de apuntado a cantantes

Causa raiz primaria:
1. Perfil IK incompleto o defaulteado en rutas productivas (orientacion/rango no reales).
2. Anti-flip inutilizado en ruta applySpatialTarget por falta de currentPan.

Causa secundaria:
3. Estado actual del UI pad en cuarentena en KinRadarViewport puede ocultar la ruta realmente activa y confundir diagnostico operacional.

---

## 6) Checklist de confirmacion solicitada

- Trig mapping dx/dy/dz + atan2/asin/acos:
  - OK en estructura base (sin evidencia de bug trig elemental).
  - Falla percibida proviene de perfil/rango/orientacion/contexto.

- Inversion por orientacion de instalacion:
  - Modelo existe.
  - Riesgo alto de no aplicarse en todos los carriles por metadata faltante/default.

- Traduccion DMX vs rango real pan/tilt:
  - Formula correcta.
  - Riesgo critico de usar 540/270 por omision en fixtures con rango distinto.

- Flip-state shortest-path:
  - Implementado.
  - Desactivado en una ruta clave (applySpatialTarget).

- Aislamiento L2 override vs L0:
  - Confirmado por Smart Gate y manual overrides.
  - Riesgo operativo solo si hay doble carril sin sincronizacion de override flags.

---

## 7) Estado de esta directiva

- Se cumplio la condicion de auditoria read-only.
- No se aplicaron cambios de codigo funcional.
- Entregable forense generado en .md.

-----------------------------------------------------
-----------------------------------------------------
-----------------------------------------------------
------------------------------------------------------
------------------------------------------------------
---------------------------------------------------

REVISION UPDATE BY OPUS :

WAVE 4880 — Revisión de la Auditoría Forense
He verificado evidencia por evidencia contra el código fuente. Resumen ejecutivo: la auditoría es correcta en estructura pero subestima un punto y prioriza mal otro. Riguroso por hallazgo:

1. Confirmaciones (auditoría correcta)
H-2 — CONFIRMADO + agravado
f.panRangeDeg y f.tiltRangeDeg no existen como campos root-level. grep_search sobre ShowFileV2.ts devuelve cero resultados para esos identificadores. Las únicas declaraciones viven en:

@/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/movement/InverseKinematicsEngine.ts:55-56 (interface MechanicalLimits)
Tests internos.
@/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/AetherIPCHandlers.ts:611-612 los lee desde f (orchestrator fixture) → undefined → buildProfile cae a defaults 540/270 siempre en esa ruta. Severidad: CRÍTICA.

H-3 — CONFIRMADO (la verdadera causa raíz)
@/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/ingestion/NodeExtractionPipeline.ts:1000-1021 muestra _buildKineticNode retornando un objeto sin ikOrientation, ikLimits ni ikCalibration (son propiedades readonly opcionales declaradas en @/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/capability-node.ts:377-392).

Resultado: _getOrBuildIKProfile (NodeResolver.ts:1319-1340) consume DEFAULT_IK_ORIENTATION + lim?.panRangeDeg = undefined + node.ikCalibration ?? { panOffset:0, tiltOffset:0, ... }. Cualquier fixture floor / wall / truss-back / con calibración real apunta como si fuera ceiling 540/270 limpio.

H-5 / Aislamiento L2 — CONFIRMADO
@/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/bridges/KineticsBridge.ts:250 y :265 saltan el flush legacy si todos los IDs están en manualOverrideFixtureIds. KinRadarViewport.handleTargetChange marca el override antes de emitir (KinRadarViewport.tsx:231-233). Aislamiento operativo correcto.

2. Reescrituras necesarias
H-1 — REPRIORIZADO: latente, NO activo
La auditoría lo marca Crítico y lo coloca como causa-1. Es un bug real, pero inerte en el flujo Sniper actual:

El sniper sólo se dispara desde SpatialTargetPad o KinRadarViewport.handleTargetChange, que siempre marca manual-override antes de emitir.
El KineticsBridge (que es el único que invocaría la ruta legacy applySpatialTarget) está gateado por manualOverrideFixtureIds.every(...) y se salta.
La ruta productiva real es: programmerStore.setSpatialPosition(t) → bridge programmer-aether → targetX/Y/Z por canal → NodeResolver._writeNodeIK → solve(profile, ..., currentPanDMX = node.currentPosition.pan * 255) (NodeResolver.ts:1202-1204).
currentPanDMX sí se pasa en la ruta productiva. Anti-flip está activo. H-1 debe degradarse a "latente / dead-code / limpiar", no causa raíz.

H-4 — CONFIRMADO pero significa otra cosa
KinRadarViewport.tsx:306 {false && (<SpatialTargetPad ... />)} confirma cuarentena. Pero la auditoría lo lista como Media; en realidad redefine el modelo mental del bug: el SpatialTargetPad no es el carril activo del sniper. El carril vivo hoy es:

1 mover → XYPad clásico (DMX directo, no IK).
N movers → RadarXY clásico (DMX directo, no IK).
IK target XYZ sólo entra cuando programmerStore.setSpatialPosition se llama externamente (efectos, scenes), no desde el operador con el pad.
El sniper "manual a cantantes" según la directiva no tiene UI activa — está bypaseado. Esto es un hallazgo arquitectónico que la auditoría diagnostica pero no enfatiza.

3. Hallazgo NUEVO que la auditoría descartó incorrectamente
H-6 (NUEVO, Crítico) — Inversión de signo en rotateToLocalFrame
La sección 3.1 afirma: "la pareja atan2(local.x, local.z) y atan2(-local.y, horizontalDist) es internamente coherente con su frame local declarado. No se detecta inversion trigonometrica obvia". Esto es incorrecto según test trigonométrico trivial:

Caso de prueba 1 — Fixture floor en (0,0,0) (lente apunta +Y), target (0, 5, 0) directamente arriba:

@/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/movement/InverseKinematicsEngine.ts:158-160

typescript
'floor': { pitch: 90, yaw: 0 }
Aplicando rotateToLocalFrame(0, 5, 0, π/2, 0, 0):

cy=1, sy=0 → (x1,y1,z1) = (0, 5, 0)
cp = cos(-π/2) = 0, sp = sin(-π/2) = -1
y2 = 5·0 - 0·(-1) = 0
z2 = 5·(-1) + 0·0 = **-5**
Resultado: local = (0, 0, -5). horizontalDist = 5, NO entra en gimbal-lock (epsilon=0.001).

panDeg = atan2(0, -5) = **180°** para un target alineado con la lente.
tiltDeg = atan2(0, 5) = 0°.
Caso de prueba 2 — Fixture ceiling en (0, 4, 0) (lente apunta -Y), target (0, 1.5, 0) directamente debajo: dy = -2.5, dz=0. Mount pitch = -90.

cp = cos(90°) = 0, sp = sin(90°) = 1
z2 = (-2.5)·1 + 0·0 = **-2.5**
Local.z negativo otra vez. El frame declarado en el header dice local +Z = frente del fixture (lente). Para los dos presets más usados, el resultado entrega el target detrás de la lente cuando físicamente está delante. panDeg cae en ±180° cuando debería ser 0° (centro mecánico) o gimbal-lock.

Por qué la auditoría lo pasó: revisó coherencia interna (atan2 entre local.x y local.z), no coherencia entre el resultado de rotateToLocalFrame y la convención de frame declarada en el header. Los tests existentes en InverseKinematicsEngine.test.ts y node-resolver-ik.test.ts posiblemente validan contra outputs precomputados con la misma convención invertida — se autocontienen.

Por qué empíricamente "parece funcionar para algunos ceiling": la inversión queda parcialmente compensada cuando se combina panInvert / tiltInvert por defaults false y la comparación contra currentPanDMX empuja todo a un corolario cercano. Pero floor / wall (signos diferentes en pitch, yaw) destapan el desfase.

Sospecha concreta: el bug está en uno de tres lugares, en orden de probabilidad:

La rotación en rotateToLocalFrame aplica inversa por separado pitch/yaw/roll, pero el orden conjugado debe ser R(roll)·R(pitch)·R(yaw) con sus inversas en orden inverso R(-yaw)·R(-pitch)·R(-roll) aplicado al vector — el código lo hace así, pero los signos de los términos y2/z2 corresponden a R(+pitch) aplicado a un vec ya rotado por R(-yaw), lo que es la inversa de R(yaw)·R(pitch), no de R(pitch)·R(yaw). Si el ensamblado del fixture es Yaw-then-Pitch (orden Euler YX), se necesita la inversa en orden XY.
MOUNT_ANGLES['ceiling'].pitch = -90 puede no corresponder a la convención de signo right-handed asumida por la matriz; podría requerir +90 o invertir el signo en sp.
panDeg = atan2(local.x, local.z) asume local.z+ = frente; debería ser atan2(local.x, -local.z) si la transformación entrega local.z- = frente.
Recomendación pre-fix: añadir 4 tests "trivial geometry" antes de tocar nada:

floor + target arriba → pan ≈ 0° (o gimbal) y tilt ≈ 0°
ceiling + target directo debajo → pan ≈ 0° (o gimbal) y tilt ≈ 0°
ceiling + target adelante (+Z) → tilt ≈ -90° (o el signo correcto que mande a tope superior)
wall-left + target a la derecha (+X) → pan ≈ 0° y tilt ≈ 0°
Si alguno falla, el bug trig está confirmado y ahí hay que cirugía.

4. Causa raíz reescrita
Capa	Causa	Severidad	Estado en auditoría original
Datos (NodeExtractionPipeline + ShowFileV2)	Nodos KINETIC nunca cargan ikOrientation/ikLimits/ikCalibration; el solver usa defaults ceiling 540/270 sin offsets ni inversiones reales	Crítica	✅ H-3 (correcto)
Datos (AetherIPCHandlers legacy)	f.panRangeDeg no existe en schema → defaults	Latente	⚠️ H-2 sobrevalorado: la ruta no se ejecuta en sniper activo
Trigonometría (rotateToLocalFrame)	Signo invertido en eje Z local → panDeg = ±180° para casos canónicos	Crítica, no detectada	❌ Sección 3.1 lo descartó
Anti-flip (legacy applySpatialTarget)	currentPanDMXMap = null → no hay shortest-path	Latente	⚠️ H-1 sobrevalorado; ruta inerte
Carril UI	SpatialTargetPad está en {false &&} quarantine → no hay manera de invocar el sniper desde UI	Bloqueante	⚠️ H-4 minimizado (es Crítico arquitectónicamente)
Aislamiento L2/L0	Smart Gate + manual override correcto	OK	✅ Sección 4 correcta
5. Veredicto sobre la directiva
Confirmadas: H-2, H-3, H-5 y aislamiento L2 (sección 4).
Reescritas: H-1 (latente, no causa-raíz) y H-4 (Crítico arquitectónico, no Media).
Refutada: la sección 3.1 ("trig OK"). Hay un test trivial (floor + target arriba) que produce pan = 180° cuando debería ser 0° o gimbal. Antes de tocar perfiles IK conviene auditar rotateToLocalFrame y los signos de MOUNT_ANGLES con tests geométricos triviales — si la math base está rota, completar el perfil IK sólo cambiará el sabor del fallo.
Orden de fix sugerido cuando autorices código:

Tests triviales de geometría → confirmar/refutar H-6.
Si H-6 cae: parchear rotateToLocalFrame o MOUNT_ANGLES (cambio de 1-3 líneas).
Cargar ikOrientation/ikLimits/ikCalibration reales en _buildKineticNode (H-3).
Eliminar la ruta legacy applySpatialTarget o su currentPanDMXMap = null (H-1, limpieza).
Decidir si reactivar SpatialTargetPad (H-4) — fuera de scope matemático.
