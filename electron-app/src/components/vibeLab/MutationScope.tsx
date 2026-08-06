/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📡 MutationScope.tsx — Panel derecho con 3 canvas de telemetría
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hospeda los 3 canvas apilados: RigMonitor, PaletteStrip, OrbitTrail.
 * Los canvas leen del telemetryBus vía rAF — este componente NO re-renderiza
 * a 60 Hz, sólo monta los canvas una vez.
 *
 * @module components/vibeLab/MutationScope
 * @version FASE 4.1
 */

import React, { memo } from 'react'
import { RigMonitorCanvas } from './scope/RigMonitorCanvas'
import { PaletteStripCanvas } from './scope/PaletteStripCanvas'
import { OrbitTrailCanvas } from './scope/OrbitTrailCanvas'
import { useLivePreview } from '../../stores/vibeLabStore'
import './mutation-scope.css'

export const MutationScope: React.FC = memo(() => {
  const livePreview = useLivePreview()

  return (
    <aside className="mutation-scope">
      <div className="mutation-scope-header">
        <span className="mutation-scope-title">MUTATION SCOPE</span>
        <span className={`mutation-scope-status ${livePreview ? 'live' : 'idle'}`}>
          {livePreview ? '● LIVE' : '○ IDLE'}
        </span>
      </div>
      <div className="mutation-scope-canvases">
        <RigMonitorCanvas size={180} />
        <PaletteStripCanvas width={220} height={56} />
        <OrbitTrailCanvas size={180} />
      </div>
    </aside>
  )
})

MutationScope.displayName = 'MutationScope'
