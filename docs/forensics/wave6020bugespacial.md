DIAGNÓSTICO DEFINITIVO — IK Spatial Singularity: Estado Zombi Persistente
Veredicto
Ambos paths contribuyen, pero con roles diferenciados:

Path	Mecanismo	Síntoma	Severidad
Frontend (no via cellOverrides)	setManualOverride additive merge preserva targetX	"Espacial corrompe clásico"	Transitorio (~1-2 ticks)
Backend (_motorKineticOverrides orphan)	_flushSpatial debounce race re-inyecta motor override post-Unlock	"Solo restart arregla"	PERMANENTE
Path A — El Merge Aditivo (setManualOverride)
Mecanismo


Proyectos
setManualOverride(nodeId: NodeId, channels: Readonly<Record<string, number>>): void {
  const existing = this._manualOverrides.get(nodeId)
  if (existing !== undefined) {
    // Merge in-place: los canales entrantes actualizan los existentes sin borrar otros.
    const mutable = existing as Record<string, number>
    for (const key in channels) {
      mutable[key] = (channels as Record<string, number>)[key]
    }
  } else {
    this._manualOverrides.set(nodeId, channels)
  }
Es un merge puramente ADITIVO. Las keys se añaden pero nunca se eliminan individualmente. Una vez que targetX entra en el record, solo clearManualOverride (que borra la entrada ENTERA) puede eliminarlo.

Punto de amplificación — Anchor Preservation (line 572-577)


Proyectos
const prev = manual ?? {}
const anchorWrite: Record<string, number> = {}
if (resolvedAnchorPan  !== null) anchorWrite['pan_base']  = resolvedAnchorPan
if (resolvedAnchorTilt !== null) anchorWrite['tilt_base'] = resolvedAnchorTilt
if (Object.keys(anchorWrite).length > 0) {
  arbiter.setManualOverride(nodeId, { ...prev, ...anchorWrite })
Cuando se inicia un patrón ('circle', 'wave', etc.) desde modo espacial:

El handler lee prev = _manualOverrides[nodeId] — que AÚN contiene targetX del bridge anterior
Re-escribe { ...prev, ...anchorWrite } → targetX se propaga al nuevo estado
Impacto en 'hold' (WAVE 6019.4)


Proyectos
for (const nodeId of removeNodeIds) {
  const motor = arbiter.getMotorKineticOverride(nodeId)
  if (motor && Number.isFinite(motor['pan_base']) && Number.isFinite(motor['tilt_base'])) {
    arbiter.setManualOverride(nodeId, {
      pan_base: motor['pan_base'],
      tilt_base: motor['tilt_base'],
    })
    motorStateMigrated = true
  }
}
 
aetherKineticEngine.removeNodes(removeNodeIds, arbiter)
if (!motorStateMigrated && anchorPan === undefined && anchorTilt === undefined) {
  for (const id of fixtureIds) {
    arbiter.clearManualOverride(`${id}:kinetic`)
  }
}
Cuando motorStateMigrated = true:

setManualOverride MERGE {pan_base, tilt_base} SOBRE el record existente con targetX
clearManualOverride se OMITE → targetX permanece indefinidamente
Eventualmente el bridge envía clearManualOverrides (1-2 ticks después), lo que limpia. Pero durante esa ventana, NodeResolver activa la ruta IK con el target viejo.

Path B — Race Condition del Debounce Espacial (ROOT CAUSE PERMANENTE)
El Timer Huérfano


Proyectos
private _spatialFlushTimeout: ReturnType<typeof setTimeout> | null = null
 
/** Debounce en ms para agrupar cambios continuos del target 3D */
private static readonly SPATIAL_DEBOUNCE_MS = 20


Proyectos
const unsubSpatial = useMovementStore.subscribe(
  (s) => s.spatialTarget,
  (spatialTarget) => {
    const ids = getSelectedIds()
    if (ids.length === 0) return
    const { spatialFanMode, spatialFanAmplitude } = useMovementStore.getState()
    this._scheduleSpatialFlush(spatialTarget, ids, spatialFanMode, spatialFanAmplitude)
  },
Secuencia del Ataque (20ms window)


T=0ms    Usuario mueve SpatialTargetPad
         → _scheduleSpatialFlush(target, ids, ...) → timer 20ms armado
 
T=15ms   Usuario pulsa UNLOCK (KineticsCathedral.handleUnlockKinetics):
         → clearSpatialTargets(selectedIds)
         → releaseKinetics()
         → setManualPattern(null) → backend: clearManualOverride() ✓
         → clearAllMotorKineticOverrides() → backend: _motorKineticOverrides.clear() ✓
         
         ── BACKEND LIMPIO ──
 
T=20ms   Timer del debounce expira → _flushSpatial() FIRES:
         → applySpatialTarget({target, fixtureIds}) → IPC al backend
         → Backend:
             arbiter.setMotorKineticOverride('fix1:kinetic', {pan_base:X, tilt_base:Y})
             arbiter.setSpatialDistanceScale('fix1:kinetic', scale)
         
         ── _motorKineticOverrides RE-POBLADO CON ENTRADA HUÉRFANA ──
Por qué es PERMANENTE
Después del stale write en T=20ms:

aetherKineticEngine.hasNode('fix1:kinetic') = false — fue removido por removeNodes en T=15ms
arbiter.getMotorKineticOverride('fix1:kinetic') ≠ undefined — el stale write lo re-creó
KineticAdapter L2 SUPREMACY gate:
El gate evalúa getMotorKineticOverride(nodeId) !== undefined → TRUE → return (L0 silenciado permanentemente)

Arbiter offset fusion (line ~855-885 de NodeArbiter.ts):
_motorKineticOverrides tiene entry → crea record en _result
hasMotorPan = true → basePan = motor['pan_base']
Fixture LOCKED a la última posición IK calculada
Nada limpia este entry porque:
clearAllMotorKineticOverrides ya fue llamado (T=15ms, ANTES del stale write)
El engine no gestiona este nodo (fue removido)
releaseSpatialTarget IPC nunca se invoca durante Unlock normal
No existe cleanup periódico para _motorKineticOverrides
Los _motorKineticOverrides son solo in-memory → solo restart los purga
Por qué _flushSpatial no tiene guard


Proyectos
private async _flushSpatial(
  target: { x: number; y: number; z: number },
  fixtureIds: string[],
  fanMode: string,
  fanAmplitude: number,
): Promise<void> {
No hay ninguna verificación de que el modo espacial siga activo. El debounce captura el target y fixtureIds en clausura y los envía ciegamente 20ms después, sin importar que el estado haya cambiado.

PhysicsPostProcessor — Contribuyente Secundario
El PhysicsPostProcessor NO causa el leak permanente, pero amplifica el síntoma durante la ventana donde targetX existe:

Su _3dInitialized Set y los Float32Array slots (posición/velocidad 3D) NO se resetean explícitamente cuando targetX desaparece
Si targetX re-aparece brevemente (por el merge aditivo), el procesador NO teleporta — usa la posición smoothed anterior, causando un arco errático de ~8 frames hacia el nuevo target
Pero no es la causa raíz: sin targetX en el record, el procesador nunca se activa
PROPUESTA ARQUITECTÓNICA — 3 Fixes Mínimos
Fix 1: Cancelar debounce espacial en Unlock (CRÍTICO — sella Path B)
Archivo: KineticsBridge.ts

Acción: Exponer un método público cancelSpatialDebounce() que haga:



typescript
if (this._spatialFlushTimeout !== null) {
  clearTimeout(this._spatialFlushTimeout)
  this._spatialFlushTimeout = null
}
Archivo: KineticsCathedral.tsx (en handleUnlockKinetics)

Acción: Llamar KineticsBridge.cancelSpatialDebounce() ANTES de cualquier IPC de cleanup.

Fix 2: Filtrar IK_POISON_KEYS del spread prev (sella Path A amplificación)
Archivo: AetherIPCHandlers.ts (línea 572)

Acción: Reemplazar:



typescript
const prev = manual ?? {}
por:



typescript
const prev: Record<string, number> = {}
if (manual) {
  for (const key in manual) {
    if (!IK_POISON_KEYS.has(key)) prev[key] = manual[key]
  }
}
Esto asegura que targetX/Y/Z NUNCA se propagan al nuevo estado cuando se inicia un patrón.

Fix 3: Guard de modo activo en _flushSpatial (defensa en profundidad)
Archivo: KineticsBridge.ts (_flushSpatial)

Acción: Al inicio del método, verificar que el modo espacial sigue activo:



typescript
const { radarMode } = useMovementStore.getState()
if (radarMode !== 'spatial') return  // stale debounce — abort
Si el usuario ya salió del modo espacial cuando el timer expira, la llamada se aborta silenciosamente.

Fix Opcional 4: Reset explícito de _3dInitialized en PhysicsPostProcessor
Archivo: PhysicsPostProcessor.ts

Acción: Añadir un método resetSpatialState(nodeId) que elimine el nodeId de _3dInitialized y zeroeé los slots de velocidad 3D. Invocar desde clearManualOverride o releaseSpatialTarget. Esto previene arcos erráticos en el edge case donde targetX reaparece brevemente.

Resumen Ejecutivo
#	Fix	Impacto	LOC estimadas
1	cancelSpatialDebounce() en Unlock	Elimina el leak permanente	~8
2	Filtrar IK_POISON_KEYS del prev spread	Elimina corrupción transitoria spatial→pattern	~6
3	Guard radarMode !== 'spatial' en _flushSpatial	Defensa redundante contra stale debounce	~2
4	Reset _3dInitialized en PhysicsPostProcessor	Elimina arco errático residual	~12
Fix 1 + Fix 3 combinados sellan completamente Path B (el permanente). Fix 2 sella Path A. Fix 4 es polish.
