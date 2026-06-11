FORENSIC EXTRACTION — CERO MODIFICACIONES
TAREA 1: NodeArbiter.ts
1A — clearManualOverride (líneas 359-389)


NodeArbiter.ts:359-389
clearManualOverride(nodeId: NodeId, _releaseMs?: number): void {
    const channels = this._manualOverrides.get(nodeId)
    if (channels) {
      // Capturar snapshot para el fade de retorno
      const snapshot: Record<string, number> = {}
      const durationByChannel: Record<string, number> = {}
      for (const key in channels) {
        const v = (channels as Record<string, number>)[key]
        if (typeof v === 'number' && Number.isFinite(v)) {
          snapshot[key] = v
          durationByChannel[key] = SLOW_RELEASE_CHANNELS.has(key) ? RELEASE_MS_SLOW : RELEASE_MS_FAST
        }
      }
      if (Object.keys(snapshot).length > 0) {
        this._releaseStates.set(nodeId, {
          channels: snapshot,
          startedAtMs: performance.now(),
          durationByChannel,
        })
      }
    }
    this._manualOverrides.delete(nodeId)
    // WAVE 4984 Paso 2: NO borrar _motorKineticOverrides aquí.
  }
Qué borra: _manualOverrides.delete(nodeId) — solo el mapa de overrides manuales.
Qué NO borra: _motorKineticOverrides (explícitamente preservado, línea 381-388).
Efecto colateral: Captura un snapshot en _releaseStates para el fade ease-out (200ms fast, 1000ms slow).

1B — _applyRelativeOffsetFusion (líneas 758-922)


NodeArbiter.ts:758-922
private _applyRelativeOffsetFusion(): void {
    const amp = this._relativeOffsetAmplitude
    const ampPan  = amp * RELATIVE_OFFSET_SCALE_PAN
    const ampTilt = amp * RELATIVE_OFFSET_SCALE_TILT
    // ...
    for (const [nodeId, record] of this._result) {
      const panOffset  = record['pan_offset']
      const tiltOffset = record['tilt_offset']
      // ...
      const motor  = this._motorKineticOverrides.get(nodeId)
      const manual = this._manualOverrides.get(nodeId)
 
      const motorPan   = motor  ? motor['pan_base']  : undefined
      const motorTilt  = motor  ? motor['tilt_base'] : undefined
      const manualPan  = manual ? manual['pan_base']  : undefined
      const manualTilt = manual ? manual['tilt_base'] : undefined
 
      const hasMotorPan  = isFiniteChannelValue(motorPan)
      const hasMotorTilt = isFiniteChannelValue(motorTilt)
      const hasManualPan  = isFiniteChannelValue(manualPan)
      const hasManualTilt = isFiniteChannelValue(manualTilt)
      const hasBasePan  = hasMotorPan  || hasManualPan
      const hasBaseTilt = hasMotorTilt || hasManualTilt
 
      // Skip nodos sin base ni offset — no son cinéticos en este frame.
      if (!hasBasePan && !hasBaseTilt && !hasPanOffset && !hasTiltOffset) {
        continue                                    // ← LÍNEA 804: PUNTO CRÍTICO
      }
 
      // WAVE 4933.2: L2 ABSOLUTE SUPREMACY
      const manualAbsPan  = manual ? manual['pan']  : undefined
      const manualAbsTilt = manual ? manual['tilt'] : undefined
      const hasAbsoluteManualLock =
        (isFiniteChannelValue(manualAbsPan)  && !hasManualPan)  ||
        (isFiniteChannelValue(manualAbsTilt) && !hasManualTilt)
      if (hasAbsoluteManualLock) continue
 
      // WAVE 4934 M1: HOLD STATE DETECTION
      const isHoldState = (hasManualPan || hasManualTilt) && !hasMotorPan && !hasMotorTilt
      if (isHoldState) {                            // ← LÍNEA 847: HOLD FREEZE
        if (hasManualPan && !isFiniteChannelValue(manualAbsPan)) record['pan'] = manualPan as number
        if (hasManualTilt && !isFiniteChannelValue(manualAbsTilt)) record['tilt'] = manualTilt as number
        continue
      }
 
      // Resolver base con prioridad motor > manual > 0.5 (centro neutro).
      const basePan  = hasMotorPan  ? (motorPan  as number)
                     : hasManualPan ? (manualPan as number)
                     : 0.5
      const baseTilt = hasMotorTilt  ? (motorTilt  as number)
                     : hasManualTilt ? (manualTilt as number)
                     : 0.5
 
      const distScale = this._spatialDistanceScales.get(nodeId) ?? 1.0
 
      // ── Gimbal Lock fade sobre pan_offset ────────────
      let gimbalFactor = 1
      if (hasBaseTilt) {
        const tiltDist = baseTilt - GIMBAL_TILT_CENTER       // 0.5
        const tiltDistAbs = tiltDist < 0 ? -tiltDist : tiltDist
        gimbalFactor = tiltDistAbs >= GIMBAL_TILT_FADE_HALFWIDTH  // 10/255
          ? 1
          : tiltDistAbs / GIMBAL_TILT_FADE_HALFWIDTH         // ← ÚNICA DIVISIÓN
      }
 
      // ── Fusión aditiva — WAVE 4980: LTP SUPPRESSION ────
      if (hasBasePan || hasPanOffset) {
        const ox = (!hasBasePan && hasPanOffset) ? (panOffset as number) : 0  // ← LÍNEA 884
        let final = basePan + ox * ampPan * distScale * gimbalFactor
        if (final < 0) final = 0
        else if (final > 1) final = 1
        record['pan'] = final
      }
      if (hasBaseTilt || hasTiltOffset) {
        const oy = (!hasBaseTilt && hasTiltOffset) ? (tiltOffset as number) : 0
        let final = baseTilt + oy * ampTilt * distScale
        if (final < TILT_ARBITER_MIN) final = TILT_ARBITER_MIN    // 0.15
        else if (final > TILT_ARBITER_MAX) final = TILT_ARBITER_MAX  // 0.85
        record['tilt'] = final
      }
    }
  }
Hallazgos clave:

No hay Math.atan2.
No hay división por X, targetX, o coordenada física. La única división es tiltDistAbs / GIMBAL_TILT_FADE_HALFWIDTH (línea 875), que es tiltDistAbs / (10/255) — una división por constante, inofensiva.
Línea 884: const ox = (!hasBasePan && hasPanOffset) ? (panOffset as number) : 0 — si L2 tiene base, el offset L0 se anula completamente.
Línea 804: Si no hay base (ni motor ni manual) Y no hay offset L0 → continue (skip total del nodo). Este es el punto de colapso tras unlock.
1C — _applyReleaseFades (líneas 1279-1316) — LA TRANSICIÓN


NodeArbiter.ts:1279-1316
private _applyReleaseFades(): void {
    const now = performance.now()
    for (const [nodeId, rel] of this._releaseStates) {
      let record = this._result.get(nodeId)
 
      let fadeCompleted = true
      for (const key in rel.channels) {
        const duration = rel.durationByChannel[key] ?? RELEASE_MS_FAST
        const elapsed  = now - rel.startedAtMs
        if (elapsed < duration) fadeCompleted = false
        const t = elapsed >= duration ? 1.0 : elapsed / duration
        // Ease-out cúbico
        const fadeWeight = 1.0 - t * t * t
        if (fadeWeight <= 0) continue
 
        const releaseValue = rel.channels[key]
        if (!record) continue                          // ← LÍNEA 1298: SIN RECORD = SIN BLEND
        const l0Value = record[key]
        if (l0Value !== undefined && Number.isFinite(l0Value)) {
          let blended = releaseValue * fadeWeight + l0Value * (1.0 - fadeWeight)
          if (key === 'tilt') blended = Math.max(TILT_ARBITER_MIN, Math.min(blended, TILT_ARBITER_MAX))
          record[key] = blended
        }
        // Si l0Value es undefined → NO se hace nada. El valor de fusión persiste.
      }
 
      if (fadeCompleted) {
        this._releaseStates.delete(nodeId)
      }
    }
  }
⚠️ PUNTO CRÍTICO — La trampa de transición:

Cuando clearManualOverride captura el snapshot, las keys son pan_base y tilt_base (lo que estaba en _manualOverrides). Pero L0 nunca escribe pan_base ni tilt_base — L0 escribe pan, tilt, pan_offset, tilt_offset. Por tanto:

l0Value = record['pan_base'] → siempre undefined
l0Value = record['tilt_base'] → siempre undefined
El blend nunca se ejecuta para canales cinéticos.
El fade corre 200-1000ms sin hacer nada útil para pan/tilt.
Cuando fadeCompleted = true, se borra de _releaseStates y el nodo queda huérfano.
TAREA 2: AetherIPCHandlers.ts — Handler del Handoff


AetherIPCHandlers.ts:419-477
// ═══════════════════════════════════════════════════════════════
// WAVE 6019.5 — HANDOFF L2→L0: SEPARACIÓN RELEASE vs HOLD
// ═══════════════════════════════════════════════════════════════
if (pattern === 'release' || pattern === 'idle' || pattern === null) {
  const removeNodeIds = fixtureIds.map(id => `${id}:kinetic`)
  aetherKineticEngine.removeNodes(removeNodeIds, arbiter)   // borra _motorKineticOverrides
  for (const id of fixtureIds) {
    arbiter.clearManualOverride(`${id}:kinetic`)              // borra _manualOverrides + crea _releaseStates
  }
  if (!aetherKineticEngine.isActive()) {
    vibeMovementManager.setManualPattern(null)                // des-silencia VMM L0
    vibeMovementManager.setManualSpeed(null)
    vibeMovementManager.setManualAmplitude(null)
    vibeMovementManager.setKineticFanOffsets({})
  }
  return { success: true }
}
 
if (pattern === 'hold' || pattern === 'static') {
  const removeNodeIds = fixtureIds.map(id => `${id}:kinetic`)
 
  // Fix C: Migrar motor→manual para freeze
  let motorStateMigrated = false
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
  // ...
  return { success: true }
}
DIAGNÓSTICO — Dónde el código detecta la transición "manualOverrides pasó de tener datos a estar vacío"
El sistema tiene dos mecanismos que intentan manejar esta transición, y ambos fallan para canales cinéticos:

Mecanismo	Ubicación	Qué hace	Por qué falla para kinetic
Release Fade	_applyReleaseFades:1279-1316	Interpola snapshot → L0 con ease-out cúbico	Las keys del snapshot son pan_base/tilt_base, pero L0 escribe pan/tilt/pan_offset/tilt_offset. l0Value siempre es undefined → blend saltado.
Fusion skip	_applyRelativeOffsetFusion:804	Si no hay base ni offset → continue	Tras unlock, motor y manual están vacíos. Si L0 aún no emitió offset (el VMM tarda 1+ frames en arrancar), el nodo se saltea completamente. _result no tiene entrada para ese nodo.
Consecuencia en cadena:

'release' → removeNodes() borra _motorKineticOverrides
clearManualOverride() borra _manualOverrides y crea snapshot en _releaseStates con keys pan_base/tilt_base
Frame N: _applyRelativeOffsetFusion — sin motor, sin manual, sin offset L0 → continue (línea 804). El nodo no existe en _result.
Frame N: _applyReleaseFades — record = undefined → continue (línea 1298). Blend saltado.
El resolver no recibe pan/tilt para ese nodo → comportamiento indefinido (último valor conocido, o default del resolver).
Cuando L0 finalmente emite (1-2 frames después), el nodo salta bruscamente a la posición L0.