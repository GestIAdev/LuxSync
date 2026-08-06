/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔬 DiagnosticsRail.tsx — Rail inferior: avisos + A/B toggle
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Muestra:
 *   - Contador de mutaciones
 *   - ResolveDiagnostic warnings/errors del store
 *   - Botón A/B que alterna entre base y mutación
 *
 * @module components/vibeLab/DiagnosticsRail
 * @version FASE 4.2
 */

import React, { memo, useCallback } from 'react'
import { AlertTriangle, AlertCircle, GitCompare } from 'lucide-react'
import {
  useVibeLabStore,
  useMutationCount,
  useDiagnostics,
  useAbMode,
  useIsDirty,
} from '../../stores/vibeLabStore'
import './diagnostics-rail.css'

export const DiagnosticsRail: React.FC = memo(() => {
  const mutationCount = useMutationCount()
  const diagnostics = useDiagnostics()
  const abMode = useAbMode()
  const isDirty = useIsDirty()
  const setAbMode = useVibeLabStore((s) => s.setAbMode)

  const handleToggleAb = useCallback(() => {
    setAbMode(abMode === 'mutation' ? 'base' : 'mutation')
  }, [abMode, setAbMode])

  const warnings = diagnostics.filter((d) => d.severity === 'warn')
  const errors = diagnostics.filter((d) => d.severity === 'error')

  return (
    <footer className="diagnostics-rail">
      {/* ── Left: mutation count + dirty indicator ───────────────────── */}
      <div className="diagnostics-rail-left">
        <span className="dr-mutation-count">
          {mutationCount} {mutationCount === 1 ? 'mutation' : 'mutations'}
        </span>
        {isDirty && <span className="dr-dirty-badge" title="Unsaved changes">unsaved</span>}
      </div>

      {/* ── Center: diagnostics ──────────────────────────────────────── */}
      <div className="diagnostics-rail-center">
        {errors.length > 0 && (
          <span className="dr-diagnostic-group error" title={errors.map((d) => d.message).join('\n')}>
            <AlertCircle size={11} />
            {errors.length} {errors.length === 1 ? 'error' : 'errors'}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="dr-diagnostic-group warn" title={warnings.map((d) => d.message).join('\n')}>
            <AlertTriangle size={11} />
            {warnings.length} {warnings.length === 1 ? 'warning' : 'warnings'}
          </span>
        )}
        {errors.length === 0 && warnings.length === 0 && (
          <span className="dr-diagnostic-ok">all clear</span>
        )}
      </div>

      {/* ── Right: A/B toggle ────────────────────────────────────────── */}
      <div className="diagnostics-rail-right">
        <button
          className={`dr-ab-button ${abMode === 'base' ? 'active-base' : 'active-mutation'}`}
          onClick={handleToggleAb}
          type="button"
          title="Toggle A/B: compare base DNA vs mutation"
        >
          <GitCompare size={12} />
          <span className="dr-ab-label">A/B</span>
          <span className="dr-ab-mode">{abMode === 'base' ? 'BASE' : 'MUT'}</span>
        </button>
      </div>
    </footer>
  )
})

DiagnosticsRail.displayName = 'DiagnosticsRail'
