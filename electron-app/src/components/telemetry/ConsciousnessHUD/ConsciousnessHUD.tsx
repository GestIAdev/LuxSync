/**
 * 🧠 CONSCIOUSNESS HUD - WAVE 1167
 * HUD completo de los 4 motores cognitivos de Selene
 * 
 * Reemplaza al legacy HuntMonitor (WAVE 550)
 * 
 * Sub-componentes:
 * - AIStateCard: Estado de caza (sleeping/stalking/evaluating/striking/learning)
 * - DreamForgeCard: Qué está "imaginando" Selene
 * - EthicsCard: Estado de seguridad visual
 * - PredictionCard: Predicciones activas
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

      {/* Body - 2x2 Grid of cards */}
      <div className="consciousness-hud__grid">
        {/* AI State */}
        <AIStateCard 
          huntState={ai?.huntState ?? 'sleeping'}
          confidence={ai?.confidence ?? 0}
          beautyScore={ai?.beautyScore ?? 0}
          beautyTrend={ai?.beautyTrend ?? 'stable'}
          reasoning={ai?.reasoning ?? null}
        />

        {/* Dream Forge */}
        <DreamForgeCard 
          isActive={cognitive.dream?.isActive ?? false}
          currentType={cognitive.dream?.currentType ?? 'palette'}
          currentThought={cognitive.dream?.currentThought ?? ''}
          projectedBeauty={cognitive.dream?.projectedBeauty ?? 0}
          lastRecommendation={cognitive.dream?.lastRecommendation ?? 'skip'}
        />

        {/* Ethics */}
        <EthicsCard 
          biasesDetected={ai?.biasesDetected ?? []}
          energyOverrideActive={ai?.energyOverrideActive ?? false}
        />

        {/* Prediction */}
        <PredictionCard 
          prediction={ai?.prediction ?? null}
          probability={ai?.predictionProbability ?? 0}
          timeMs={ai?.predictionTimeMs ?? 0}
        />
      </div>
    </div>
  )
}

export default ConsciousnessHUD
