WAVE 5023 — AUDITORÍA FORENSE: EL FANTASMA DEL EJE CERO
DIAGNÓSTICO RAÍZ ENCONTRADO
No es una regresión del parche WAVE 4990/5022. El problema está en la transición de estado del PhysicsPostProcessor cuando un nodo pasa de ruta espacial 3D (IK/L2) a ruta clásica pan/tilt (L0).

HALLAZGO 1: Estado pan/tilt "zombie" en el PhysicsPostProcessor
Archivo: @c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\PhysicsPostProcessor.ts:390-393



typescript
entry['targetX'] = state[SLOT_X3D_POS]
entry['targetY'] = state[SLOT_Y3D_POS]
entry['targetZ'] = state[SLOT_Z3D_POS]
return  // nodo espacial procesado — skip flujo legacy pan/tilt
Cuando un nodo opera en modo espacial (tiene targetX), el PhysicsPostProcessor ejecuta el bloque 3D y hace return — nunca toca state[SLOT_PAN_POS] ni state[SLOT_TILT_POS]. Estos slots se congelan con el valor que tenían la última vez que el nodo estuvo en ruta clásica, que puede ser de hace minutos.

HALLAZGO 2: El "salto mortal" en el primer frame post-unlock
Archivo: @c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\PhysicsPostProcessor.ts:396-398



typescript
// Leer target del ArbitratedNodeMap
this._panTarget  = entry['pan']  ?? 0.5
this._tiltTarget = entry['tilt'] ?? 0.5
Cuando se hace Unlock y targetX desaparece del arbitrated map, el nodo cae al flujo clásico. El state[SLOT_PAN_POS] contiene un valor zombie antiguo (digamos, 0.2 de hace 3 minutos). Pero el VMM acaba de emitir entry['pan'] = 0.5 (centro).

En modo snap (snapFactor = 0.8):



delta = 0.8 * (0.5 - 0.2) = 0.24
En un solo frame, el pan salta 0.24 unidades normalizadas ≈ 130° físicos. Eso es el latigazo.

HALLAZGO 3: El _motorKineticOverrides sobrevive al Unlock individual
Archivo: @c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\NodeArbiter.ts:359-389



typescript
clearManualOverride(nodeId: NodeId, _releaseMs?: number): void {
    // ... captura snapshot para release fade ...
    this._manualOverrides.delete(nodeId)
    // WAVE 4984 Paso 2: NO borrar _motorKineticOverrides aquí.
    // WAVE 4935 M2 lo hacía como "Ghost Anchor fix", pero causa amnesia IK:
    // ...
    // Regla de Oro: _motorKineticOverrides SOLO se limpia desde clearMotorKineticOverride,
    // que es llamado exclusivamente por releaseSpatialTarget (botón Unlock del operador)
}
El clearManualOverride individual (llamado por ProgrammerAetherBridge cuando sueltas un fixture) no borra _motorKineticOverrides. Pero clearAllManualOverrides() (Unlock All global) sí borra todo.

Si el operador hace Unlock individual, el target espacial sigue vivo en _motorKineticOverrides, manteniendo el nodo en modo 3D. Si hace Unlock All, se borra el target espacial y el nodo cae a clásico... directo al salto mortal del Hallazgo 2.

HALLAZGO 4: El currentPosition del nodo no se sincroniza con el estado del PhysicsPostProcessor
Archivo: @c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts:1233-1236



typescript
node.currentPosition.pan  = safePan  / 255
node.currentPosition.tilt = safeTilt / 255
El NodeResolver sí mantiene node.currentPosition.pan/tilt actualizado en cada frame (tanto en ruta IK como clásica). Pero el PhysicsPostProcessor nunca lee estos valores. Cuando el nodo transiciona de 3D a clásico, el PhysicsPostProcessor no "sabe" dónde está físicamente el foco — usa su state[SLOT_PAN_POS] zombie.

HALLAZGO 5: La ruta clásica del VMM puede emitir pan/tilt arbitrarios
Archivo: @c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\systems\KineticSystem.ts (y KineticAdapter.ts)

Cuando el foco pasa a L0 automático, el KineticSystem o KineticAdapter genera un intent basado en el VMM (VibeMovementManager). La posición inicial de ese intent no deriva de node.currentPosition.pan/tilt. Parte del phaseOffset del beat, que puede estar en cualquier parte del ciclo (ej. 0.5 para centro, o 0.0 para extremo).

Esto significa que aunque el PhysicsPostProcessor tuviera la posición correcta, el VMM puede pedir ir a 0.0 cuando el foco está en 0.8. El snapFactor = 0.8 multiplica ese delta, produciendo velocidad extrema.

CADENA CAUSAL COMPLETA


1. Operador mueve foco central con IK (L2) → modo 3D activo
2. PhysicsPostProcessor.state[panPos/tiltPos] se congela en valor antiguo
   (el bloque 3D hace return sin tocarlos)
3. Operador hace Unlock → clearManualOverride o clearAllManualOverrides
4a. Si Unlock individual: _motorKineticOverrides sobrevive → targetX sigue
    → nodo sigue en 3D → NO hay problema inmediato, pero el target espacial
    está "huérfano" (nadie lo actualiza) → foco se queda apuntando al último target
4b. Si Unlock All: _motorKineticOverrides borrado → targetX desaparece
    → PhysicsPostProcessor cae a flujo clásico
    → state[panPos] = valor zombie (antiguo)
    → VMM emite entry['pan'] = 0.5 (o cualquier valor según beat phase)
    → delta = snapFactor * (0.5 - zombie) → enorme
    → latigazo de pan/tilt → foco desfasado o en horizontal
SÍNTOMAS EXPLICADOS
Síntoma reportado	Causa raíz
"Latigazo cinético (velocidad extrema)"	snapFactor * (targetVMM - stateZombie) produce delta enorme en 1 frame
"Terminan desfasados"	El state zombie era un valor antiguo arbitrario; el VMM apunta a otro
"O en horizontal"	Si el zombie era tilt ≈ 0.5 y el VMM pide tilt ≈ 0 (hacia arriba), el delta horizontal colapsa el foco
"Recurrente, regresión de parche previo"	El parche anterior (WAVE 4990) arregló la singularidad, pero NO arregló la transición de estado
DOS VECTORES DE REPARACIÓN (para discutir con el arquitecto)
Vector A — Sincronización de estado (PhysicsPostProcessor): Cuando un nodo detecta transición 3D → clásico, copiar node.currentPosition.pan/tilt a state[SLOT_PAN_POS/TILT_POS] antes de calcular el primer delta.

Vector B — Inicialización coherente del VMM (KineticSystem/KineticAdapter): Cuando un nodo pasa de L2 a L0, el primer intent del VMM debe partir de la posición actual del foco, no del phaseOffset del beat. Esto requiere que el VMM lea node.currentPosition como semilla inicial.

¿Confirmo el análisis o hay algún fragmento que quieras que profundice antes de abordar el fix?