/**
 * 🛡️ ETHICS CARD - WAVE 1168/1172
 * "The Guardian" - Estado de seguridad visual con checks reales
 * 
 * WAVE 1172: COMPRESSION & SENSITIVITY
 * Layout: Micro-grid 4x2 con Status Bits compactos
 * Items: STR, INT, COL, BAS, HAR, OVR, PAT (7 métricas)
 * Logic: Safe=verde, Warning=amarillo, Critical=rojo parpadeante
 */

import React from 'react'
import { ShieldCheckIcon } from '../../icons/LuxIcons'

export interface EthicsCardProps {
  /** Flags éticos activos (los que están en warning/critical) */
  ethicsFlags: string[]
  /** ¿Energy Override activo? (physics veto) */
  energyOverrideActive: boolean
  /** Flags críticos (parpadeo rojo) - opcional */
  criticalFlags?: string[]
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔮 WAVE 1172: STATUS BITS - Códigos de 3 letras ultra-compactos
// ═══════════════════════════════════════════════════════════════════════════
const STATUS_BITS = [
  { id: 'strobe_risk', code: 'STR', tooltip: 'Strobe Safety' },
  { id: 'intensity_abuse', code: 'INT', tooltip: 'Intensity Limit' },
  { id: 'color_chaos', code: 'COL', tooltip: 'Color Balance' },
  { id: 'bass_flooding', code: 'BAS', tooltip: 'Bass Flood' },
  { id: 'harshness', code: 'HAR', tooltip: 'Harshness Guard' },
  { id: 'overdrive', code: 'OVR', tooltip: 'Overdrive Limit' },
  { id: 'pattern_chaos', code: 'PAT', tooltip: 'Pattern Stability' },
] as const

type StatusBitState = 'safe' | 'warning' | 'critical'

/**
 * 🛡️ Micro-grid Ethics Card con Status Bits compactos
 */
export const EthicsCard: React.FC<EthicsCardProps> = ({
  ethicsFlags,
  energyOverrideActive,
  criticalFlags = []
}) => {
  // Convertir flags a Sets para lookup rápido
  const warningSet = new Set(ethicsFlags.map(f => f.toLowerCase().replace(/[_\s]/g, '')))
  const criticalSet = new Set(criticalFlags.map(f => f.toLowerCase().replace(/[_\s]/g, '')))
  
  // Determinar estado de cada bit
  const getBitState = (id: string): StatusBitState => {
    const normalizedId = id.toLowerCase().replace(/[_\s]/g, '')
    if (criticalSet.has(normalizedId)) return 'critical'
    if (warningSet.has(normalizedId)) return 'warning'
    return 'safe'
  }
  
  // Contar estados
  const warningCount = ethicsFlags.length
  const criticalCount = criticalFlags.length
  const allSafe = warningCount === 0 && criticalCount === 0 && !energyOverrideActive
  
  // Generar mensaje de estado global
  const getGlobalStatus = (): { icon: string; text: string; className: string } => {
    if (criticalCount > 0) {
      return { 
        icon: '🚨', 
        text: `CRITICAL: ${criticalFlags.join(', ').toUpperCase()}`,
        className: 'ethics-status--critical'
      }
    }
    if (energyOverrideActive) {
      return { 
        icon: '⚡', 
        text: 'ENERGY OVERRIDE ACTIVE',
        className: 'ethics-status--override'
      }
    }
    if (warningCount > 0) {
      return { 
        icon: '⚠️', 
        text: `LIMITING: ${ethicsFlags.slice(0, 2).join(', ').toUpperCase()}`,
        className: 'ethics-status--warning'
      }
    }
    return { 
      icon: '✅', 
      text: 'ALL SYSTEMS NOMINAL',
      className: 'ethics-status--safe'
    }
  }
  
  const globalStatus = getGlobalStatus()

  return (
    <div className={`consciousness-card ethics-card ${allSafe ? 'ethics-card--safe' : 'ethics-card--active'}`}>
      <div className="consciousness-card__header">
        <ShieldCheckIcon size={14} color="var(--cat-ethics)" />
        <span>ETHICS</span>
      </div>

      <div className="consciousness-card__body">
        {/* 🔮 WAVE 1172: Micro-grid 4x2 de Status Bits */}
        <div className="ethics-bits">
          {STATUS_BITS.map(bit => {
            const state = getBitState(bit.id)
            return (
              <div 
                key={bit.id}
                className={`ethics-bit ethics-bit--${state}`}
                title={bit.tooltip}
              >
                <span className="ethics-bit__code">{bit.code}</span>
              </div>
            )
          })}
        </div>

        {/* 🔮 WAVE 1172: Footer con estado global */}
        <div className={`ethics-status ${globalStatus.className}`}>
          <span className="ethics-status__icon">{globalStatus.icon}</span>
          <span className="ethics-status__text">{globalStatus.text}</span>
        </div>
      </div>
    </div>
  )
}

export default EthicsCard
