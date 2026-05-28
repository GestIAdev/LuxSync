/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 THEIA DNA LAB — WAVE 4921 (Atomic Paradigm · Fase 1)
 * Panel lateral derecho del WORKSHOP. Edición DIRECTA del genoma del átomo.
 *
 * Refactor desde WAVE 4910.3:
 *  - Adiós a la dualidad cue/global. Un átomo = un genoma. Único foco.
 *  - Adiós al botón "SET DEFAULT" (no aplica al modelo atómico).
 *  - Adiós a los emojis y badges de cuepoint.
 *  - Iconografía 100% LuxIcons (premium).
 *
 * Conectado exclusivamente a useTheiaEditorStore. Sin estado local opaco.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useCallback } from 'react'
import { useTheiaEditorStore, clearAutosave } from '../../stores/useTheiaEditorStore'
import type { DraftGenome } from '../../stores/useTheiaEditorStore'
import { useTheiaPackStore } from '../../stores/useTheiaPackStore'
import type { EnergyZone } from '../../types/theiaTypes'
import {
  BrainNeuralIcon,   // 🧬 DNA / cognición
  SaveIcon,          // 💾 Export
  BoltIcon,          // ⚡ Divine candidate badge
} from '../icons/LuxIcons'
import './TheiaDNALab.css'

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const ENERGY_ZONES: readonly EnergyZone[] = [
  'silence', 'valley', 'ambient', 'gentle', 'active', 'intense', 'peak',
]

const GENOME_PARAMS: Array<{
  key: keyof DraftGenome
  label: string
  color: string
  bindSuffix: string
}> = [
  { key: 'aggression', label: 'AGGRESSION', color: '#ef4444', bindSuffix: 'aggression' },
  { key: 'chaos',      label: 'CHAOS',      color: '#a855f7', bindSuffix: 'chaos'      },
  { key: 'organicity', label: 'ORGANICITY', color: '#22c55e', bindSuffix: 'organicity' },
]

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const TheiaDNALab: React.FC = () => {
  const draftAtom        = useTheiaEditorStore((s) => s.draftAtom)
  const isDirty          = useTheiaEditorStore((s) => s.isDirty)
  const updateGenome     = useTheiaEditorStore((s) => s.updateGenome)
  const updateEnergyZone = useTheiaEditorStore((s) => s.updateEnergyZone)
  const markClean        = useTheiaEditorStore((s) => s.markClean)

  // ─── Export handler ───────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    if (!draftAtom) return

    // ── Validación atómica (gates A1..A5 del blueprint WAVE 4920) ─────────
    if (draftAtom.trim.endMs <= draftAtom.trim.startMs + 250) {
      alert(
        'EXPORT BLOCKED\n\n' +
        'Trim duration must be >= 250 ms.\n' +
        `Current: ${draftAtom.trim.endMs - draftAtom.trim.startMs} ms.\n\n` +
        'Adjust the IN / OUT handles in the Trimmer.',
      )
      return
    }

    const suggestedName = `${draftAtom.id}.theia`

    type ExportFn = (atom: unknown, name: string) => Promise<{
      success: boolean; filePath?: string; cancelled?: boolean; error?: string
    }>
    const exportFn = (
      window as unknown as { lux?: { theia?: { exportAsset?: ExportFn } } }
    ).lux?.theia?.exportAsset

    if (exportFn) {
      const res = await exportFn(draftAtom, suggestedName)
      if (res.success) {
        markClean()
        clearAutosave(draftAtom.id)
        if (draftAtom.rawClipId) {
          useTheiaPackStore.getState().updateRawClip(draftAtom.rawClipId, { state: 'exported' })
        }
      } else if (!res.cancelled) {
        console.error('[DNALab] Export IPC failed:', res.error)
      }
    } else {
      const blob = new Blob([JSON.stringify(draftAtom, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = suggestedName
      a.click()
      URL.revokeObjectURL(url)
      markClean()
      if (draftAtom.rawClipId) {
        useTheiaPackStore.getState().updateRawClip(draftAtom.rawClipId, { state: 'exported' })
      }
    }
  }, [draftAtom, markClean])

  // ─── Handlers genome ──────────────────────────────────────────────────────

  const handleGenomeChange = useCallback(
    (key: keyof DraftGenome, value: number) => {
      updateGenome({ [key]: value })
    },
    [updateGenome],
  )

  // ─── Handlers energy zone ─────────────────────────────────────────────────

  const handleZoneChange = useCallback(
    (edge: 'min' | 'max', value: EnergyZone) => {
      updateEnergyZone(edge, value)
    },
    [updateEnergyZone],
  )

  // ─── Render ───────────────────────────────────────────────────────────────

  const isDraftEmpty = !draftAtom
  const activeGenome: DraftGenome = draftAtom
    ? { aggression: draftAtom.aggression, chaos: draftAtom.chaos, organicity: draftAtom.organicity }
    : { aggression: 0.5, chaos: 0.5, organicity: 0.5 }
  const activeZone = draftAtom?.energyZone ?? { min: 'silence' as EnergyZone, max: 'peak' as EnergyZone }

  return (
    <aside
      className={`dna-lab${isDraftEmpty ? ' dna-lab--empty' : ''}`}
      aria-label="DNA Lab"
    >
      {/* ── EXPORT button ── */}
      <button
        className={`dna-lab__export-btn${isDirty ? ' is-dirty' : ''}`}
        onClick={handleExport}
        disabled={isDraftEmpty}
        title={isDirty ? 'Unsaved changes — export atom' : 'Export atom as .theia'}
        data-midi-bind="theia.workshop.export"
      >
        <SaveIcon size={16} className="dna-lab__export-icon" />
        <span className="dna-lab__export-label">EXPORT ATOM</span>
        {isDirty && <span className="dna-lab__export-dirty" aria-hidden="true" />}
      </button>

      {/* ── Header ── */}
      <header className="dna-lab__header">
        <BrainNeuralIcon size={20} className="dna-lab__icon" />
        <div className="dna-lab__title-block">
          <span className="dna-lab__label">DNA LAB</span>
          <span className="dna-lab__focus">
            {isDraftEmpty ? 'no atom loaded' : draftAtom!.id}
          </span>
        </div>
        {draftAtom?.isDivineCandidate && (
          <span className="dna-lab__badge dna-lab__badge--divine" title="Divine candidate">
            <BoltIcon size={14} />
          </span>
        )}
      </header>

      {/* ── Genome sliders ── */}
      <section className="dna-lab__section">
        <h3 className="dna-lab__section-title">GENOME</h3>
        <div className="dna-lab__sliders">
          {GENOME_PARAMS.map(({ key, label, color, bindSuffix }) => {
            const val = activeGenome[key]
            const pct = val * 100
            return (
              <div
                key={key}
                className="dna-slider"
                style={{ ['--dna-color' as string]: color }}
                data-midi-bind={`theia.workshop.genome.${bindSuffix}`}
              >
                <div className="dna-slider__header">
                  <span className="dna-slider__label">{label}</span>
                  <span className="dna-slider__value">{val.toFixed(2)}</span>
                </div>
                <div className="dna-slider__track">
                  <div className="dna-slider__fill" style={{ width: `${pct}%` }} />
                  <input
                    type="range"
                    className="dna-slider__input"
                    min={0}
                    max={1}
                    step={0.01}
                    value={val}
                    disabled={isDraftEmpty}
                    onChange={(e) => handleGenomeChange(key, Number(e.target.value))}
                    onDoubleClick={() => handleGenomeChange(key, 0.5)}
                    aria-label={label}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Energy Zone ── */}
      <section className={`dna-lab__section${isDraftEmpty ? ' dna-lab__section--muted' : ''}`}>
        <h3 className="dna-lab__section-title">ENERGY ZONE</h3>
        <div className="dna-zone">
          <div className="dna-zone__group">
            <label className="dna-zone__label">MIN</label>
            <div className="dna-zone__tags">
              {ENERGY_ZONES.map((z) => (
                <button
                  key={`min-${z}`}
                  className={`dna-zone__tag${activeZone.min === z ? ' is-active' : ''}`}
                  disabled={isDraftEmpty}
                  onClick={() => handleZoneChange('min', z)}
                  data-midi-bind={`theia.workshop.zone.min.${z}`}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>
          <div className="dna-zone__group">
            <label className="dna-zone__label">MAX</label>
            <div className="dna-zone__tags">
              {ENERGY_ZONES.map((z) => (
                <button
                  key={`max-${z}`}
                  className={`dna-zone__tag${activeZone.max === z ? ' is-active' : ''}`}
                  disabled={isDraftEmpty}
                  onClick={() => handleZoneChange('max', z)}
                  data-midi-bind={`theia.workshop.zone.max.${z}`}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Empty state ── */}
      {isDraftEmpty && (
        <div className="dna-lab__empty-state">
          <BrainNeuralIcon size={28} className="dna-lab__empty-icon" />
          <p>Drop an <code>.mp4</code> into the viewport<br />to begin authoring an atom.</p>
        </div>
      )}
    </aside>
  )
}

export default TheiaDNALab
