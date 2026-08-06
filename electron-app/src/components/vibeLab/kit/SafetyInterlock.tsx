/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ SafetyInterlock.tsx — SHIELDED ⇄ RAW toggle
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Toggle físico de dos posiciones: SHIELDED (modo básico, ~65 params) ⇄
 * RAW REACTOR (modo avanzado, ~282 params). La primera vez que se pasa a
 * RAW, muestra un modal de confirmación ("estás manipulando la gravedad
 * de los fotones").
 *
 * @module components/vibeLab/kit/SafetyInterlock
 * @version FASE 2 — The Instrument Kit
 */

import React, { memo, useCallback, useState, useEffect } from 'react'
import { Shield, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import type { SafetyInterlockProps } from './types'
import './kit-variables.css'
import './safety-interlock.css'

export const SafetyInterlock: React.FC<SafetyInterlockProps> = memo(({
  mode,
  onChange,
  onConfirmRaw,
}) => {
  const [showConfirm, setShowConfirm] = useState(false)
  const [hasConfirmedRaw, setHasConfirmedRaw] = useState(false)

  // Reset confirmation flag when switching back to shielded
  useEffect(() => {
    if (mode === 'shielded') {
      setHasConfirmedRaw(false)
    }
  }, [mode])

  const handleToggle = useCallback(() => {
    if (mode === 'shielded') {
      // Going to RAW — need confirmation the first time
      if (!hasConfirmedRaw) {
        setShowConfirm(true)
        return
      }
      onChange('raw')
    } else {
      // Going back to SHIELDED — no confirmation needed
      onChange('shielded')
    }
  }, [mode, hasConfirmedRaw, onChange])

  const handleConfirm = useCallback(() => {
    setShowConfirm(false)
    setHasConfirmedRaw(true)
    onChange('raw')
    onConfirmRaw?.()
  }, [onChange, onConfirmRaw])

  const handleCancel = useCallback(() => {
    setShowConfirm(false)
  }, [])

  const isRaw = mode === 'raw'

  return (
    <>
      <div className={`safety-interlock ${mode}`}>
        <button
          className={`safety-interlock-toggle ${isRaw ? 'raw' : 'shielded'}`}
          onClick={handleToggle}
          type="button"
          role="switch"
          aria-checked={isRaw}
          aria-label="Safety interlock: Shielded vs Raw"
        >
          <div className="safety-interlock-labels">
            <span className={`safety-interlock-label ${!isRaw ? 'active' : ''}`}>
              <Shield size={12} />
              SHIELDED
            </span>
            <span className={`safety-interlock-label ${isRaw ? 'active' : ''}`}>
              <Zap size={12} />
              RAW
            </span>
          </div>
          <motion.div
            className="safety-interlock-knob"
            animate={{ x: isRaw ? 60 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      {/* ── Modal de confirmación ─────────────────────────────────────── */}
      {showConfirm && (
        <div className="safety-interlock-modal-overlay" onClick={handleCancel}>
          <div className="safety-interlock-modal" onClick={(e) => e.stopPropagation()}>
            <div className="safety-interlock-modal-icon">
              <Zap size={32} />
            </div>
            <h3 className="safety-interlock-modal-title">RAW REACTOR</h3>
            <p className="safety-interlock-modal-body">
              Estás a punto de manipular la gravedad de los fotones.
              <br />
              Se revelarán los ~282 parámetros del motor, incluidos cross-filters,
              squelch anti-autotune, safe-harbor phases y calibración IK.
              <br />
              <strong>Es posible romper la física.</strong>
            </p>
            <div className="safety-interlock-modal-actions">
              <button className="safety-interlock-modal-cancel" onClick={handleCancel} type="button">
                Cancelar
              </button>
              <button className="safety-interlock-modal-confirm" onClick={handleConfirm} type="button">
                Entiendo, activar RAW
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
})

SafetyInterlock.displayName = 'SafetyInterlock'
