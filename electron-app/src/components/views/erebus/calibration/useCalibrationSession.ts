import { useState, useCallback, useRef, useEffect } from 'react'
import type { FixtureV2 } from '../../../../core/stage/ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface CalibrationData {
  panOffset: number
  tiltOffset: number
  panInvert: boolean
  tiltInvert: boolean
}

export interface ReferenceTarget {
  x: number
  y: number
  z: number
}

export interface CalibrationSession {
  fixtureId: string | null
  referenceTarget: ReferenceTarget
  snapshot: CalibrationData | null
  isDirty: boolean
}

const DEFAULT_TARGET: ReferenceTarget = { x: 0, y: 0, z: 2 }
const DEFAULT_CALIBRATION: CalibrationData = {
  panOffset: 0,
  tiltOffset: 0,
  panInvert: false,
  tiltInvert: false,
}

function extractCalibration(fixture: FixtureV2 | null | undefined): CalibrationData {
  if (!fixture?.calibration) return { ...DEFAULT_CALIBRATION }
  return {
    panOffset: fixture.calibration.panOffset ?? 0,
    tiltOffset: fixture.calibration.tiltOffset ?? 0,
    panInvert: fixture.calibration.panInvert ?? false,
    tiltInvert: fixture.calibration.tiltInvert ?? false,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useCalibrationSession(
  fixtureId: string | null,
  getFixture: (id: string) => FixtureV2 | undefined,
  updateFixture: (id: string, updates: Partial<FixtureV2>) => void,
) {
  const [session, setSession] = useState<CalibrationSession>({
    fixtureId: null,
    referenceTarget: { ...DEFAULT_TARGET },
    snapshot: null,
    isDirty: false,
  })

  const [liveCalibration, setLiveCalibration] = useState<CalibrationData>({ ...DEFAULT_CALIBRATION })

  // Throttle timer for IK profile invalidation
  const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // When fixtureId changes, load calibration from fixture and snapshot it
  useEffect(() => {
    if (!fixtureId) {
      setSession(prev => ({ ...prev, fixtureId: null, snapshot: null, isDirty: false }))
      setLiveCalibration({ ...DEFAULT_CALIBRATION })
      return
    }

    const fixture = getFixture(fixtureId)
    const cal = extractCalibration(fixture)
    setLiveCalibration(cal)
    setSession({
      fixtureId,
      referenceTarget: { ...DEFAULT_TARGET },
      snapshot: { ...cal },
      isDirty: false,
    })
  }, [fixtureId, getFixture])

  // Update live calibration values (throttled IK invalidation)
  const updateCalibration = useCallback(
    (partial: Partial<CalibrationData>) => {
      setLiveCalibration(prev => {
        const next = { ...prev, ...partial }
        // Mark dirty by comparing with snapshot
        setSession(s => {
          if (!s.snapshot) return s
          const dirty =
            next.panOffset !== s.snapshot.panOffset ||
            next.tiltOffset !== s.snapshot.tiltOffset ||
            next.panInvert !== s.snapshot.panInvert ||
            next.tiltInvert !== s.snapshot.tiltInvert
          return { ...s, isDirty: dirty }
        })

        // Throttled IK profile invalidation — 100ms per blueprint §4.5
        if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current)
        invalidateTimerRef.current = setTimeout(() => {
          if (fixtureId) {
            const nodeId = `${fixtureId}:kinetic`
            window.lux?.aether?.invalidateIKProfile({ nodeId }).catch(() => {})
          }
        }, 100)

        return next
      })
    },
    [fixtureId],
  )

  // Update reference target
  const setReferenceTarget = useCallback((target: ReferenceTarget) => {
    setSession(prev => ({ ...prev, referenceTarget: target, isDirty: true }))
  }, [])

  // Apply: persist calibration to store
  const apply = useCallback(() => {
    if (!fixtureId) return
    updateFixture(fixtureId, {
      calibration: {
        panOffset: liveCalibration.panOffset,
        tiltOffset: liveCalibration.tiltOffset,
        panInvert: liveCalibration.panInvert,
        tiltInvert: liveCalibration.tiltInvert,
      },
    })
    // Immediate IK invalidation on apply
    const nodeId = `${fixtureId}:kinetic`
    window.lux?.aether?.invalidateIKProfile({ nodeId }).catch(() => {})
    setSession(prev => ({ ...prev, snapshot: { ...liveCalibration }, isDirty: false }))
  }, [fixtureId, liveCalibration, updateFixture])

  // Revert: restore snapshot
  const revert = useCallback(() => {
    if (!session.snapshot) return
    setLiveCalibration({ ...session.snapshot })
    setSession(prev => ({ ...prev, isDirty: false }))
    if (fixtureId) {
      const nodeId = `${fixtureId}:kinetic`
      window.lux?.aether?.invalidateIKProfile({ nodeId }).catch(() => {})
    }
  }, [session.snapshot, fixtureId])

  // Reset to zero
  const reset = useCallback(() => {
    setLiveCalibration({ ...DEFAULT_CALIBRATION })
    setSession(prev => ({ ...prev, isDirty: prev.snapshot !== null }))
    if (fixtureId) {
      const nodeId = `${fixtureId}:kinetic`
      window.lux?.aether?.invalidateIKProfile({ nodeId }).catch(() => {})
    }
  }, [fixtureId])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (invalidateTimerRef.current) {
        clearTimeout(invalidateTimerRef.current)
        invalidateTimerRef.current = null
      }
    }
  }, [])

  return {
    session,
    liveCalibration,
    updateCalibration,
    setReferenceTarget,
    apply,
    revert,
    reset,
  }
}
