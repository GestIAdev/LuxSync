/**
 * 🛡️ ETHICS CARD - WAVE 1168/1172/1184/1185
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
 * 
 * 🪲 WAVE 1185: ENGLISH & UNSTUCK
 * - Cambió de setTimeout a Timestamps para evitar race conditions
 * - Limpieza periódica con setInterval cada 500ms
 */

import React, { useEffect, useMemo, useState, useRef } from 'react'
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
// 🔮 WAVE 1184/1187: STATUS BITS - Mapping de flags backend a códigos UI
// 🎯 WAVE 1187: Added PAT (pattern_abuse) - 7 tags total for 4x2 grid
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
  // 🎯 WAVE 1187: RESCUED PAT TAG
  { 
    id: 'pattern_abuse', 
    aliases: ['pattern_abuse', 'pattern', 'monotony', 'repetition'],
    code: 'PAT', 
    tooltip: 'Pattern Abuse - Anti-monotonía',
    isCritical: false
  },
] as const

type StatusBitState = 'safe' | 'warning' | 'critical'

// 🔮 WAVE 1184/1185: Latch duration and cleanup interval
const LATCH_DURATION_MS = 2000
const CLEANUP_INTERVAL_MS = 500

/**
 * 🛡️ Micro-grid Ethics Card con Status Bits compactos
 * WAVE 1185: Sistema de timestamps sin race conditions
 * WAVE 1188: ZOMBIE KILLER - Desacoplado props del interval
 */
export const EthicsCard: React.FC<EthicsCardProps> = ({
  ethicsFlags,
  energyOverrideActive,
  criticalFlags = []
}) => {
  // 🪲 WAVE 1185/1187: Timestamps - Map<flag, lastSeenTimestamp>
  const [latchedFlags, setLatchedFlags] = useState<Record<string, number>>({})
  
  // 🧟 WAVE 1188: ZOMBIE KILLER - Decouple props from interval
  const latestPropsRef = useRef({ ethicsFlags, energyOverrideActive })
  
  // 1. Sync effect: actualizar ref cada vez que cambian los props
  useEffect(() => {
    latestPropsRef.current = { ethicsFlags, energyOverrideActive }
    
    // Actualizar timestamps de flags activos
    const now = Date.now()
    setLatchedFlags(prev => {
      const updated = { ...prev }
      
      // Marcar timestamp de flags activos actuales
      for (const flag of ethicsFlags) {
        const normalized = flag.toLowerCase().replace(/[_\s]/g, '')
        updated[normalized] = now
      }
      
      // Si energy_override está activo, también
      if (energyOverrideActive) {
        updated['energyoverride'] = now
      }
      
      return updated
    })
  }, [ethicsFlags, energyOverrideActive])
  
  // 2. � WAVE 1188: ZOMBIE KILLER - Cleanup effect con [] dependencies
  // El interval corre ININTERRUMPIDAMENTE cada 250ms
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      
      setLatchedFlags(prev => {
        // Leer props frescos desde la ref (no desde closure)
        const { ethicsFlags: currentFlags, energyOverrideActive: currentOvr } = latestPropsRef.current
        
        const currentActiveSet = new Set([
          ...currentFlags.map(f => f.toLowerCase().replace(/[_\s]/g, '')),
          ...(currentOvr ? ['energyoverride'] : [])
        ])
        
        const cleaned: Record<string, number> = {}
        let hasChanges = false
        
        for (const [flag, timestamp] of Object.entries(prev)) {
          const age = now - timestamp
          const isCurrentlyActive = currentActiveSet.has(flag)
          
          // � WAVE 1188: BORRADO A LA FUERZA si NO activo Y expirado
          const shouldKeep = isCurrentlyActive || age < LATCH_DURATION_MS
          
          if (shouldKeep) {
            cleaned[flag] = timestamp
          } else {
            hasChanges = true
            console.log(`[EthicsCard 🛡️] ZOMBIE KILLED: ${flag} (age=${age}ms, active=${isCurrentlyActive})`)
          }
        }
        
        // Solo actualizar si hubo cambios (evitar re-renders innecesarios)
        return hasChanges ? cleaned : prev
      })
    }, CLEANUP_INTERVAL_MS)
    
    return () => clearInterval(interval)
  }, [])  // 🧟 WAVE 1188: Empty deps - interval runs forever
  
  // Flags a mostrar = todos los que están en el latch (activos + recientes)
  const displayFlags = useMemo(() => new Set(Object.keys(latchedFlags)), [latchedFlags])
  
  // Set de flags actualmente activos (no solo latched)
  const currentActiveSet = useMemo(() => new Set([
    ...ethicsFlags.map(f => f.toLowerCase().replace(/[_\s]/g, '')),
    ...(energyOverrideActive ? ['energyoverride'] : [])
  ]), [ethicsFlags, energyOverrideActive])
  
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
  
  // 🪲 WAVE 1185: Helper para saber si un bit es latched (no current)
  // Ahora usa currentActiveSet que ya calculamos arriba
  const isBitLatched = (bit: typeof STATUS_BITS[number]): boolean => {
    return bit.aliases.some(alias => {
      const normalized = alias.toLowerCase().replace(/[_\s]/g, '')
      // Está en latchedFlags (lo vimos recientemente) pero NO está activo ahora
      return (normalized in latchedFlags) && !currentActiveSet.has(normalized)
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
