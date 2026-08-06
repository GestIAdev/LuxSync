/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⬢ MutationBadge.tsx — Hexagonal badge with mutation counter
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Badge hexagonal con clip-path que muestra el número de genes mutados
 * dentro de un panel o del documento entero. Usa framer-motion para la
 * animación de aparición del contador.
 *
 * @module components/vibeLab/kit/MutationBadge
 * @version FASE 2 — The Instrument Kit
 */

import React, { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { MutationBadgeProps } from './types'
import './kit-variables.css'
import './mutation-badge.css'

export const MutationBadge: React.FC<MutationBadgeProps> = memo(({
  count,
  accent,
}) => {
  if (count <= 0) return null

  return (
    <motion.div
      className="mutation-badge"
      style={{ '--vl-accent': accent ?? 'var(--vl-accent)' } as React.CSSProperties}
      initial={{ scale: 0, rotate: -30 }}
      animate={{ scale: 1, rotate: 0 }}
      exit={{ scale: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      title={`${count} ${count === 1 ? 'gen mutado' : 'genes mutados'}`}
    >
      <svg className="mutation-badge-hex" viewBox="0 0 24 24" width="20" height="20">
        <polygon
          points="12,2 22,7 22,17 12,22 2,17 2,7"
          fill="var(--vl-accent)"
          stroke="var(--vl-accent)"
          strokeWidth="1"
          opacity="0.2"
        />
        <polygon
          points="12,2 22,7 22,17 12,22 2,17 2,7"
          fill="none"
          stroke="var(--vl-accent)"
          strokeWidth="1.5"
        />
      </svg>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={count}
          className="mutation-badge-count"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15 }}
        >
          {count}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  )
})

MutationBadge.displayName = 'MutationBadge'
