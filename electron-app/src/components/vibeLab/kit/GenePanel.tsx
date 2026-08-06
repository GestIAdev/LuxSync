/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📦 GenePanel.tsx — Collapsible accordion wrapper
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sección colapsable que envuelve los controles de un panel del genoma.
 * Usa framer-motion para la animación de colapso. No renderiza los hijos
 * si está cerrado (optimización: 282 controles no se montan todos a la vez).
 *
 * Props: id, title, icon, accent, tier, mutatedCount, children.
 *
 * @module components/vibeLab/kit/GenePanel
 * @version FASE 2 — The Instrument Kit
 */

import React, { memo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import type { GenePanelProps } from './types'
import { MutationBadge } from './MutationBadge'
import './kit-variables.css'
import './gene-panel.css'

export const GenePanel: React.FC<GenePanelProps> = memo(({
  id,
  title,
  icon,
  accent,
  tier,
  mutatedCount,
  isExpanded,
  onToggle,
  children,
}) => {
  const handleToggle = useCallback(() => {
    onToggle()
  }, [onToggle])

  return (
    <div
      className={`gene-panel ${isExpanded ? 'expanded' : 'collapsed'} tier-${tier}`}
      data-panel-id={id}
      style={{ '--vl-accent': accent } as React.CSSProperties}
    >
      <button
        className="gene-panel-header"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-controls={`gene-panel-content-${id}`}
        type="button"
      >
        <div className="gene-panel-header-left">
          <span className="gene-panel-icon">{icon}</span>
          <span className="gene-panel-title">{title}</span>
          {tier === 'raw' && <span className="gene-panel-raw-tag">RAW</span>}
        </div>
        <div className="gene-panel-header-right">
          {mutatedCount > 0 && <MutationBadge count={mutatedCount} accent={accent} />}
          <motion.span
            className="gene-panel-chevron"
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={14} />
          </motion.span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            className="gene-panel-content"
            id={`gene-panel-content-${id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="gene-panel-content-inner">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

GenePanel.displayName = 'GenePanel'
