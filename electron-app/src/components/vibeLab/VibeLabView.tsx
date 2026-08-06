/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 VibeLabView.tsx — Root container for the Custom Vibe Creator
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Layout de §1.2 del blueprint:
 *
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │  HelixBar (DNA donor, nombre, interlock, acciones)          │
 *  ├──────────────────────────────────┬──────────────────────────┤
 *  │  MutationBench (tabs + paneles)  │  MutationScope (Fase 4)  │
 *  │                                  │  (placeholder por ahora)  │
 *  └──────────────────────────────────┴──────────────────────────┘
 *
 * @module components/vibeLab/VibeLabView
 * @version FASE 3 — The Three Benches
 */

import React, { useEffect } from 'react'
import { HelixBar } from './HelixBar'
import { MutationBench } from './MutationBench'
import { useVibeLabStore } from '../../stores/vibeLabStore'
import './vibe-lab-view.css'

export const VibeLabView: React.FC = () => {
  const draft = useVibeLabStore((s) => s.draft)
  const beginSession = useVibeLabStore((s) => s.beginSession)

  // Auto-iniciar sesión con techno-club si no hay draft
  useEffect(() => {
    if (!draft) {
      beginSession('techno-club' as never, 'Untitled Vibe')
    }
  }, [draft, beginSession])

  return (
    <div className="vibe-lab-view">
      <HelixBar />
      <div className="vibe-lab-body">
        <MutationBench />
        {/* MutationScope placeholder — Fase 4 */}
        <aside className="vibe-lab-scope-placeholder">
          <p>Mutation Scope</p>
          <p className="vibe-lab-scope-placeholder-sub">Fase 4</p>
        </aside>
      </div>
    </div>
  )
}

VibeLabView.displayName = 'VibeLabView'

export default VibeLabView
