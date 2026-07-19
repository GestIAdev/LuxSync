import React from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// AxisPolarityToggles — switches for panInvert / tiltInvert.
// Physical inversion at the machine level, not visual.
// ═══════════════════════════════════════════════════════════════════════════

interface AxisPolarityTogglesProps {
  panInvert: boolean
  tiltInvert: boolean
  onPanInvertChange: (value: boolean) => void
  onTiltInvertChange: (value: boolean) => void
}

export const AxisPolarityToggles: React.FC<AxisPolarityTogglesProps> = ({
  panInvert,
  tiltInvert,
  onPanInvertChange,
  onTiltInvertChange,
}) => {
  return (
    <div className="cal-polarity-toggles">
      <div className="cal-section-label">Axis Polarity</div>
      <div className="cal-polarity-row">
        <span className="cal-polarity-label">Pan Invert</span>
        <button
          className={`cal-toggle ${panInvert ? 'cal-toggle--active' : ''}`}
          onClick={() => onPanInvertChange(!panInvert)}
          aria-label="Toggle Pan Invert"
        >
          <span className="cal-toggle-knob" />
        </button>
      </div>
      <div className="cal-polarity-row">
        <span className="cal-polarity-label">Tilt Invert</span>
        <button
          className={`cal-toggle ${tiltInvert ? 'cal-toggle--active' : ''}`}
          onClick={() => onTiltInvertChange(!tiltInvert)}
          aria-label="Toggle Tilt Invert"
        >
          <span className="cal-toggle-knob" />
        </button>
      </div>
    </div>
  )
}

export default AxisPolarityToggles
