import React, { useState, useCallback } from 'react'
import { useStageStore } from '../../../../stores/stageStore'
import { useSelectionStore } from '../../../../stores/selectionStore'
import { useCalibrationSession } from './useCalibrationSession'
import { CalibrationFixtureList } from './CalibrationFixtureList'
import { OffsetTrimPad } from './OffsetTrimPad'
import { AxisPolarityToggles } from './AxisPolarityToggles'
import { CalibrationTargetMini } from './CalibrationTargetMini'

// ═══════════════════════════════════════════════════════════════════════════
// CalibrationDock — contextual floating satellite panel.
// Renders only when toolMode === 'calibrate'.
// Assembles OffsetTrimPad, AxisPolarityToggles, and TargetMiniPad.
// Reads/writes calibration data (panOffset, tiltOffset, panInvert, tiltInvert)
// from/to stageStore via updateFixture, and invalidates the IK profile cache
// via AetherIPCHandlers when calibration changes.
// ═══════════════════════════════════════════════════════════════════════════

export const CalibrationDock: React.FC = () => {
  const fixtures = useStageStore(state => state.fixtures)
  const updateFixture = useStageStore(state => state.updateFixture)
  const selectedIds = useSelectionStore(state => state.selectedIds)

  // Use first selected fixture as default, or allow override from list
  const [localFixtureId, setLocalFixtureId] = useState<string | null>(null)
  const activeFixtureId = localFixtureId ?? (selectedIds.size > 0 ? Array.from(selectedIds)[0] : null)

  const getFixture = useCallback(
    (id: string) => fixtures.find(f => f.id === id),
    [fixtures],
  )

  const {
    session,
    liveCalibration,
    updateCalibration,
    setReferenceTarget,
    apply,
    revert,
    reset,
  } = useCalibrationSession(activeFixtureId, getFixture, updateFixture)

  const handleSelectFixture = useCallback((id: string) => {
    setLocalFixtureId(id)
  }, [])

  return (
    <aside className="calibration-dock">
      {/* Header */}
      <div className="calibration-dock-header">
        <span className="calibration-dock-title">Calibration Dock</span>
        {session.isDirty && <span className="calibration-dock-dirty">●</span>}
      </div>

      {/* Fixture List */}
      <CalibrationFixtureList
        selectedFixtureId={activeFixtureId}
        onSelect={handleSelectFixture}
      />

      {activeFixtureId ? (
        <>
          {/* Offset Trim Pad */}
          <div className="calibration-dock-section">
            <OffsetTrimPad
              panOffset={liveCalibration.panOffset}
              tiltOffset={liveCalibration.tiltOffset}
              onChange={(pan, tilt) => updateCalibration({ panOffset: pan, tiltOffset: tilt })}
            />
          </div>

          {/* Axis Polarity Toggles */}
          <div className="calibration-dock-section">
            <AxisPolarityToggles
              panInvert={liveCalibration.panInvert}
              tiltInvert={liveCalibration.tiltInvert}
              onPanInvertChange={v => updateCalibration({ panInvert: v })}
              onTiltInvertChange={v => updateCalibration({ tiltInvert: v })}
            />
          </div>

          {/* Target Mini Pad */}
          <div className="calibration-dock-section">
            <CalibrationTargetMini
              fixtureId={activeFixtureId}
              target={session.referenceTarget}
              onTargetChange={setReferenceTarget}
            />
          </div>

          {/* Action Buttons */}
          <div className="calibration-dock-actions">
            <button
              className="cal-btn cal-btn--apply"
              onClick={apply}
              disabled={!session.isDirty}
            >
              Apply
            </button>
            <button
              className="cal-btn cal-btn--revert"
              onClick={revert}
              disabled={!session.isDirty}
            >
              Revert
            </button>
            <button
              className="cal-btn cal-btn--reset"
              onClick={reset}
            >
              Reset
            </button>
          </div>
        </>
      ) : (
        <div className="calibration-dock-empty">
          Select a fixture to calibrate.
        </div>
      )}
    </aside>
  )
}

export default CalibrationDock
