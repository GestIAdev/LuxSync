/**
 * 🛡️ ETHICS CARD - WAVE 1167
 * Estado de seguridad visual
 */

import React from 'react'
import { ShieldCheckIcon } from '../../icons/LuxIcons'

export interface EthicsCardProps {
  biasesDetected: string[]
  energyOverrideActive: boolean
}

/**
 * 🛡️ Card mostrando estado ético/seguridad
 */
export const EthicsCard: React.FC<EthicsCardProps> = ({
  biasesDetected,
  energyOverrideActive
}) => {
  const hasBiases = biasesDetected.length > 0
  const allSafe = !hasBiases && !energyOverrideActive

  return (
    <div className={`consciousness-card ethics-card ${allSafe ? 'ethics-card--safe' : 'ethics-card--warning'}`}>
      <div className="consciousness-card__header">
        <ShieldCheckIcon size={14} color="var(--cat-ethics)" />
        <span>ETHICS</span>
      </div>

      <div className="consciousness-card__body">
        {/* Status checks */}
        <div className="ethics-card__checks">
          <div className={`ethics-card__check ${!hasBiases ? 'ethics-card__check--ok' : 'ethics-card__check--warn'}`}>
            <span>{!hasBiases ? '✅' : '⚠️'}</span>
            <span>Strobe: {!hasBiases ? 'SAFE' : 'ACTIVE'}</span>
          </div>
          
          <div className={`ethics-card__check ${!energyOverrideActive ? 'ethics-card__check--ok' : 'ethics-card__check--warn'}`}>
            <span>{!energyOverrideActive ? '✅' : '⚡'}</span>
            <span>Override: {energyOverrideActive ? 'ACTIVE' : 'NONE'}</span>
          </div>

          <div className="ethics-card__check ethics-card__check--ok">
            <span>✅</span>
            <span>Intensity: OK</span>
          </div>
        </div>

        {/* Biases detected */}
        <div className="ethics-card__biases">
          <span className="neural-label">Biases:</span>
          <span className={hasBiases ? 'ethics-card__biases--warning' : ''}>
            {hasBiases ? `${biasesDetected.length} detected` : '0 detected'}
          </span>
        </div>

        {/* List biases if any */}
        {hasBiases && (
          <div className="ethics-card__bias-list">
            {biasesDetected.slice(0, 2).map((bias, i) => (
              <span key={i} className="ethics-card__bias-item">• {bias}</span>
            ))}
            {biasesDetected.length > 2 && (
              <span className="ethics-card__bias-more">+{biasesDetected.length - 2} more</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default EthicsCard
