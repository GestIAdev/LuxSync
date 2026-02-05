/**
 * 🧠 CONSCIOUSNESS HUD - WAVE 1168 "NEURAL BRIDGE"
 * HUD completo de los 4 motores cognitivos de Selene
 * 
 * Conecta el Dream Simulator, Ethics, y Prediction reales al UI.
 * 
 * Sub-componentes:
 * - AIStateCard: Estado de caza (sleeping/stalking/evaluating/striking/learning)
 * - DreamForgeCard: Resultado del Dream Simulator (ACCEPTED/REJECTED/IDLE)
 * - EthicsCard: Estado de seguridad visual con checks reales
 * - PredictionCard: Predicciones activas con countdown
 */

import React from 'react'
import { useTruthAI, useTruthCognitive } from '../../../hooks/useSeleneTruth'
import { BrainNeuralIcon, LiveDotIcon } from '../../icons/LuxIcons'
import { AIStateCard } from './AIStateCard'
import { DreamForgeCard } from './DreamForgeCard'
import { EthicsCard } from './EthicsCard'
import { PredictionCard } from './PredictionCard'
import './ConsciousnessHUD.css'

export interface ConsciousnessHUDProps {
  className?: string
}

/**
 * 🧠 HUD de consciencia - 4 paneles cognitivos
 */
export const ConsciousnessHUD: React.FC<ConsciousnessHUDProps> = ({ 
  className = '' 
}) => {
  const ai = useTruthAI()
  const cognitive = useTruthCognitive()

  // Si AI no está habilitada, mostrar estado offline
  const isOnline = ai?.enabled ?? false

  return (
    <div className={`neural-card consciousness-hud ${className}`}>
      {/* Header */}
      <div className="neural-card-header">
        <div className="neural-card-title">
          <BrainNeuralIcon size={16} color="var(--cat-brain)" />
          <span>CONSCIOUSNESS</span>
        </div>
        <div className="neural-card-status">
          <div className={`neural-live-dot ${isOnline ? '' : 'neural-live-dot--offline'}`} />
          <span>AI: {isOnline ? 'ACTIVE' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* Body - 2x2 Grid of cards - wrapped in neural-card__content for flex behavior */}
      <div className="neural-card__content">
        <div className="consciousness-hud__grid">
          {/* AI State - The Hunter (WAVE 1169: Added target) */}
          <AIStateCard 
            huntState={ai?.huntState ?? 'sleeping'}
            confidence={ai?.confidence ?? 0}
            beautyScore={ai?.beautyScore ?? 0}
            beautyTrend={ai?.beautyTrend ?? 'stable'}
            reasoning={ai?.reasoning ?? null}
            target={ai?.prediction ?? null}
          />

          {/* Dream Forge - The Simulator (WAVE 1169: Added confidence) */}
          <DreamForgeCard 
            effectName={ai?.lastDreamResult?.effectName ?? null}
            status={ai?.lastDreamResult?.status ?? 'IDLE'}
            reason={ai?.lastDreamResult?.reason ?? 'No simulation yet'}
            riskLevel={ai?.lastDreamResult?.riskLevel ?? 0}
            confidence={ai?.confidence ?? 0}
          />

          {/* Ethics - The Guardian */}
          <EthicsCard 
            ethicsFlags={ai?.ethicsFlags ?? []}
            energyOverrideActive={ai?.energyOverrideActive ?? false}
          />

          {/* Prediction - The Oracle (WAVE 1169: Added trend/zone, WAVE 1176: Added velocity) */}
          <PredictionCard 
            prediction={ai?.prediction ?? null}
            probability={ai?.predictionProbability ?? 0}
            timeMs={ai?.predictionTimeMs ?? 0}
            energyTrend={ai?.beautyTrend ?? 'stable'}
            energyZone={ai?.energyZone ?? 'calm'}
            energyVelocity={ai?.energyVelocity ?? 0}
          />
        </div>
      </div>
    </div>
  )
}

export default ConsciousnessHUD
