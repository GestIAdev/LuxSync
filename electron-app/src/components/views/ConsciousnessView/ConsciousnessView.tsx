/**
 * 🧠 CONSCIOUSNESS VIEW - WAVE 1194: CONSCIOUSNESS UNLEASHED
 * 
 * "Lo que Selene PIENSA"
 * 
 * Vista completa dedicada a los procesos cognitivos:
 * - Oracle Hybrid (La Joya de la Corona - predicción estable)
 * - Ethics Council Expanded (Los 3 votantes visibles)
 * - AI State Titan (El Cazador con stats completas)
 * - Dream Forge Complete (Historia de sueños)
 * 
 * Layout: CSS Grid 2x2 (50% × 50% cada panel)
 */

import React, { memo } from 'react'
import { useTruthAI } from '../../../hooks/useSeleneTruth'
import { OracleHybrid } from './OracleHybrid'
import { EthicsCouncilExpanded } from './EthicsCouncilExpanded'
import { AIStateTitan } from './AIStateTitan'
import { DreamForgeComplete } from './DreamForgeComplete'
import './ConsciousnessView.css'

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const ConsciousnessView: React.FC = memo(() => {
  const ai = useTruthAI()
  
  return (
    <div className="consciousness-view">
      {/* Top Row */}
      <div className="consciousness-view__row">
        {/* 🔮 ORACLE HYBRID - La Joya de la Corona */}
        <div className="consciousness-view__panel consciousness-view__panel--oracle">
          <OracleHybrid 
            prediction={ai?.prediction ?? null}
            probability={ai?.predictionProbability ?? 0}
            energyTrend={ai?.beautyTrend ?? 'stable'}
            energyZone={ai?.energyZone ?? 'calm'}
            energyVelocity={ai?.energyVelocity ?? 0}
            energyValue={ai?.beautyScore ?? 0.5}
          />
        </div>
        
        {/* ⚖️ ETHICS COUNCIL - Los 3 Votantes */}
        <div className="consciousness-view__panel consciousness-view__panel--ethics">
          <EthicsCouncilExpanded 
            ethicsFlags={ai?.ethicsFlags ?? []}
            energyOverrideActive={ai?.energyOverrideActive ?? false}
            beautyScore={ai?.beautyScore ?? 0.5}
            confidence={ai?.confidence ?? 0}
            councilVotes={ai?.councilVotes ?? {
              beauty: { vote: 'abstain', confidence: 0, reason: 'Offline' },
              energy: { vote: 'abstain', confidence: 0, reason: 'Offline' },
              calm: { vote: 'abstain', confidence: 0, reason: 'Offline' }
            }}
            consensusScore={ai?.consensusScore ?? 0.33}
          />
        </div>
      </div>
      
      {/* Bottom Row */}
      <div className="consciousness-view__row">
        {/* 🐱 AI STATE TITAN - El Cazador Expandido */}
        <div className="consciousness-view__panel consciousness-view__panel--ai">
          <AIStateTitan 
            huntState={ai?.huntState ?? 'sleeping'}
            confidence={ai?.confidence ?? 0}
            beautyScore={ai?.beautyScore ?? 0}
            beautyTrend={ai?.beautyTrend ?? 'stable'}
            reasoning={ai?.reasoning ?? null}
            huntStats={ai?.huntStats ?? { duration: 0, targetsAcquired: 0, successRate: 0 }}
          />
        </div>
        
        {/* 🎨 DREAM FORGE COMPLETE - El Historial */}
        <div className="consciousness-view__panel consciousness-view__panel--dream">
          <DreamForgeComplete 
            effectName={ai?.lastDreamResult?.effectName ?? null}
            status={ai?.lastDreamResult?.status ?? 'IDLE'}
            reason={ai?.lastDreamResult?.reason ?? 'Waiting for consciousness...'}
            riskLevel={ai?.lastDreamResult?.riskLevel ?? 0}
            confidence={ai?.confidence ?? 0}
            dreamHistory={ai?.dreamHistory ?? []}
          />
        </div>
      </div>
    </div>
  )
})

ConsciousnessView.displayName = 'ConsciousnessView'

export default ConsciousnessView
