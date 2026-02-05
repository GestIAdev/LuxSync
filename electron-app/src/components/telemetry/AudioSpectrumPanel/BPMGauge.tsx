/**
 * 💓 BPM GAUGE - WAVE 1167
 * Gauge circular de BPM con arco de confidence
 */

import React from 'react'

export interface BPMGaugeProps {
  bpm: number
  confidence: number
  onBeat: boolean
  beatPhase: number
}

/**
 * 💓 Gauge circular mostrando BPM y confidence
 */
export const BPMGauge: React.FC<BPMGaugeProps> = ({ 
  bpm, 
  confidence, 
  onBeat,
  beatPhase 
}) => {
  // Calcular el arco de confidence (0-100% del círculo)
  const circumference = 2 * Math.PI * 28 // radio 28
  const confidenceOffset = circumference - (confidence * circumference)
  
  // Formatear BPM (sin decimales si es entero)
  const displayBPM = Math.round(bpm)
  const confidencePercent = Math.round(confidence * 100)

  return (
    <div className={`bpm-gauge ${onBeat ? 'bpm-gauge--on-beat' : ''}`}>
      {/* SVG Circular */}
      <svg 
        className="bpm-gauge__circle" 
        width="72" 
        height="72" 
        viewBox="0 0 72 72"
      >
        {/* Track de fondo */}
        <circle
          className="bpm-gauge__track"
          cx="36"
          cy="36"
          r="28"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="4"
        />
        {/* Arco de confidence */}
        <circle
          className="bpm-gauge__fill"
          cx="36"
          cy="36"
          r="28"
          fill="none"
          stroke="var(--accent-primary)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={confidenceOffset}
          style={{
            filter: onBeat ? 'drop-shadow(0 0 8px var(--accent-primary))' : 'none',
            transition: 'stroke-dashoffset 0.3s ease'
          }}
        />
        {/* Indicador de fase de beat */}
        <circle
          cx={36 + 24 * Math.cos((beatPhase * 2 * Math.PI) - Math.PI / 2)}
          cy={36 + 24 * Math.sin((beatPhase * 2 * Math.PI) - Math.PI / 2)}
          r="3"
          fill={onBeat ? '#22c55e' : 'rgba(255,255,255,0.3)'}
          style={{ transition: 'fill 0.1s ease' }}
        />
      </svg>

      {/* Valor central */}
      <div className="bpm-gauge__value">
        <span className="bpm-gauge__number">{displayBPM}</span>
        <span className="bpm-gauge__label">BPM</span>
      </div>

      {/* Confidence a la derecha */}
      <div className="bpm-gauge__confidence">
        <div className="bpm-gauge__confidence-bar">
          <div 
            className="bpm-gauge__confidence-fill"
            style={{ width: `${confidencePercent}%` }}
          />
        </div>
        <span className="bpm-gauge__confidence-value">{confidencePercent}%</span>
      </div>
    </div>
  )
}

export default BPMGauge
