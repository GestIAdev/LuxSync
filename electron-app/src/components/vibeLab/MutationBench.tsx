/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 MutationBench.tsx — Dynamic tab host
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hospeda el tab activo del genoma. Delega a PhysicsBench / ColorBench /
 * MovementBench según `activeTab`.
 *
 * @module components/vibeLab/MutationBench
 * @version FASE 3
 */

import React, { memo, useMemo } from 'react'
import { GenomeTabs } from './GenomeTabs'
import { PhysicsBench } from './tabs/PhysicsBench'
import { ColorBench } from './tabs/ColorBench'
import { MovementBench } from './tabs/MovementBench'
import { useActiveTab, useInterlock } from '../../stores/vibeLabStore'
import type { GenomeTab } from '../../stores/vibeLabStore'

// Accent color per tab (matches blueprint §1.5)
const TAB_ACCENTS: Record<GenomeTab, string> = {
  physics: '#00e5ff',
  color: '#ff2fd0',
  movement: '#ffb020',
}

export const MutationBench: React.FC = memo(() => {
  const activeTab = useActiveTab()
  const interlock = useInterlock()

  const accent = TAB_ACCENTS[activeTab]

  const bench = useMemo(() => {
    switch (activeTab) {
      case 'physics':
        return <PhysicsBench interlock={interlock} />
      case 'color':
        return <ColorBench interlock={interlock} />
      case 'movement':
        return <MovementBench interlock={interlock} />
      default:
        return null
    }
  }, [activeTab, interlock])

  return (
    <div
      className="vibe-lab-bench"
      style={{ '--vl-accent': accent } as React.CSSProperties}
    >
      <GenomeTabs />
      <div className="vibe-lab-bench-content">
        {bench}
      </div>
    </div>
  )
})

MutationBench.displayName = 'MutationBench'
