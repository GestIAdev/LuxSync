/**
 * 🛡️ ETHICS CARD - WAVE 1168/1172/1184
 * "The Guardian" - Estado de seguridad visual con checks reales
 * 
 * WAVE 1172: COMPRESSION & SENSITIVITY
 * Layout: Micro-grid 4x2 con Status Bits compactos
 * Items: STR, INT, COL, BAS, HAR, OVR (6 métricas)
 * Logic: Safe=verde, Warning=amarillo, Critical=rojo parpadeante
 * 
 * 🔮 WAVE 1184: THE NEURAL BINDING
 * - Latch de 2s para flags visuales (ojo humano puede ver el bloqueo)
 * - Mapping correcto de flags del backend a códigos UI
 * - Colores más distintivos: Rojo si bloquea, Amarillo si limita
 */

import React, { useEffect, useRef, useState } from 'react'
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
// 🔮 WAVE 1184: STATUS BITS - Mapping de flags backend a códigos UI
// ═══════════════════════════════════════════════════════════════════════════
const STATUS_BITS = [
  { 
    id: 'strobe_risk', 
    aliases: ['strobe_risk', 'epilepsy_protection', 'strobe', 'epilepsy'],
    code: 'STR', 
    tooltip: 'Strobe Safety - Protección epilepsia',
    isCritical: true  // Rojo si activo
  },
  { 
    id: 'intensity_abuse', 
    aliases: ['intensity_abuse', 'fatigue_protection', 'intensity', 'fatigue'],
    code: 'INT', 
    tooltip: 'Intensity Limit - Fatiga visual',
    isCritical: false  // Amarillo si activo
  },
  { 
    id: 'color_chaos', 
    aliases: ['color_chaos', 'color'],
    code: 'COL', 
    tooltip: 'Color Balance - Caos cromático',
    isCritical: false
  },
  { 
    id: 'bass_flooding', 
    aliases: ['bass_flooding', 'bass', 'bass_flood'],
    code: 'BAS', 
    tooltip: 'Bass Flood - Saturación graves',
    isCritical: false
  },
  { 
    id: 'harshness', 
    aliases: ['harshness', 'harsh_override', 'harsh'],
    code: 'HAR', 
    tooltip: 'Harshness Guard - Protección auditiva',
    isCritical: false
  },
  { 
    id: 'overdrive', 
    aliases: ['overdrive', 'overdrive_abuse', 'energy_override'],
    code: 'OVR', 
    tooltip: 'Overdrive Limit - Sobrecarga sistema',
    isCritical: true
  },
] as const

type StatusBitState = 'safe' | 'warning' | 'critical'

// 🔮 WAVE 1184: Latch duration for visual persistence
const LATCH_DURATION_MS = 2000

/**
 * 🛡️ Micro-grid Ethics Card con Status Bits compactos
 * WAVE 1184: Con latches visuales de 2s para que el ojo humano vea los bloqueos
 */
export const EthicsCard: React.FC<EthicsCardProps> = ({
  ethicsFlags,
  energyOverrideActive,
  criticalFlags = []
}) => {
  // 🔮 WAVE 1184: Latch state - mantiene flags activos por 2s
  const [latchedFlags, setLatchedFlags] = useState<Set<string>>(new Set())
  const latchTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  
  // Actualizar latches cuando cambian los flags
  useEffect(() => {
    const newLatchedFlags = new Set(latchedFlags)
    
    // Agregar nuevos flags al latch
    for (const flag of ethicsFlags) {
      const normalizedFlag = flag.toLowerCase().replace(/[_\s]/g, '')
      newLatchedFlags.add(normalizedFlag)
      
      // Cancelar timer existente si hay uno
      const existingTimer = latchTimersRef.current.get(normalizedFlag)
      if (existingTimer) {
        clearTimeout(existingTimer)
      }
      
      // Crear nuevo timer para remover el flag después del latch
      const timer = setTimeout(() => {
        setLatchedFlags(prev => {
          const next = new Set(prev)
          next.delete(normalizedFlag)
          return next
        })
        latchTimersRef.current.delete(normalizedFlag)
      }, LATCH_DURATION_MS)
      
      latchTimersRef.current.set(normalizedFlag, timer)
    }
    
    // Agregar energy_override si está activo
    if (energyOverrideActive) {
      newLatchedFlags.add('energyoverride')
      
      const existingTimer = latchTimersRef.current.get('energyoverride')
      if (existingTimer) clearTimeout(existingTimer)
      
      const timer = setTimeout(() => {
        setLatchedFlags(prev => {
          const next = new Set(prev)
          next.delete('energyoverride')
          return next
        })
      }, LATCH_DURATION_MS)
      
      latchTimersRef.current.set('energyoverride', timer)
    }
    
    setLatchedFlags(newLatchedFlags)
    
    // Cleanup
    return () => {
      latchTimersRef.current.forEach(timer => clearTimeout(timer))
    }
  }, [ethicsFlags, energyOverrideActive])
  
  // Combinar flags actuales con latched para display
  const displayFlags = new Set([
    ...ethicsFlags.map(f => f.toLowerCase().replace(/[_\s]/g, '')),
    ...(energyOverrideActive ? ['energyoverride'] : []),
    ...latchedFlags
  ])
  const criticalSet = new Set(criticalFlags.map(f => f.toLowerCase().replace(/[_\s]/g, '')))
  
  // Determinar estado de cada bit usando aliases
  const getBitState = (bit: typeof STATUS_BITS[number]): StatusBitState => {
    // Verificar si algún alias coincide con los flags activos
    const isActive = bit.aliases.some(alias => {
      const normalized = alias.toLowerCase().replace(/[_\s]/g, '')
      return displayFlags.has(normalized)
    })
    
    if (!isActive) return 'safe'
    
    // Verificar si es crítico (rojo) o warning (amarillo)
    const isCritical = bit.isCritical || bit.aliases.some(alias => {
      const normalized = alias.toLowerCase().replace(/[_\s]/g, '')
      return criticalSet.has(normalized)
    })
    
    return isCritical ? 'critical' : 'warning'
  }
  
  // Contar estados
  const activeCount = displayFlags.size
  const allSafe = activeCount === 0
  
  // Generar mensaje de estado global
  const getGlobalStatus = (): { icon: string; text: string; className: string } => {
    // Verificar si hay flags críticos activos
    const criticalBits = STATUS_BITS.filter(bit => getBitState(bit) === 'critical')
    const warningBits = STATUS_BITS.filter(bit => getBitState(bit) === 'warning')
    
    if (criticalBits.length > 0) {
      const codes = criticalBits.map(b => b.code).join(', ')
      return { 
        icon: '🚨', 
        text: `BLOCKING: ${codes}`,
        className: 'ethics-status--critical'
      }
    }
    if (warningBits.length > 0) {
      const codes = warningBits.map(b => b.code).join(', ')
      return { 
        icon: '⚠️', 
        text: `LIMITING: ${codes}`,
        className: 'ethics-status--warning'
      }
    }
    return { 
      icon: '✅', 
      text: 'ALL SYSTEMS NOMINAL',
      className: 'ethics-status--safe'
    }
  }
  
  // 🔮 WAVE 1184: Helper para saber si un bit es latched (no current)
  const isBitLatched = (bit: typeof STATUS_BITS[number]): boolean => {
    // Verificar si está en latchedFlags pero NO en current flags
    const currentNormalized = new Set([
      ...ethicsFlags.map(f => f.toLowerCase().replace(/[_\s]/g, '')),
      ...(energyOverrideActive ? ['energyoverride'] : [])
    ])
    
    return bit.aliases.some(alias => {
      const normalized = alias.toLowerCase().replace(/[_\s]/g, '')
      return latchedFlags.has(normalized) && !currentNormalized.has(normalized)
    })
  }
  
  const globalStatus = getGlobalStatus()

  return (
    <div className={`consciousness-card ethics-card ${allSafe ? 'ethics-card--safe' : 'ethics-card--active'}`}>
      <div className="consciousness-card__header">
        <ShieldCheckIcon size={14} color="var(--cat-ethics)" />
        <span>ETHICS</span>
      </div>

      <div className="consciousness-card__body">
        {/* 🔮 WAVE 1184: Micro-grid 3x2 de Status Bits con latches */}
        <div className="ethics-bits">
          {STATUS_BITS.map(bit => {
            const state = getBitState(bit)
            const latched = isBitLatched(bit)
            return (
              <div 
                key={bit.id}
                className={`ethics-bit ethics-bit--${state} ${latched ? 'ethics-bit--latched' : ''}`}
                title={bit.tooltip}
              >
                <span className="ethics-bit__code">{bit.code}</span>
              </div>
            )
          })}
        </div>

        {/* 🔮 WAVE 1184: Footer con estado global */}
        <div className={`ethics-status ${globalStatus.className}`}>
          <span className="ethics-status__icon">{globalStatus.icon}</span>
          <span className="ethics-status__text">{globalStatus.text}</span>
        </div>
      </div>
    </div>
  )
}

export default EthicsCard
