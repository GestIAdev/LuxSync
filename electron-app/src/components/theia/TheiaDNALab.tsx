/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 THEIA DNA LAB — WAVE 4910.3 / 4910.6
 * Panel lateral derecho del laboratorio genético.
 *
 * Foco dual:
 *  - Sin cue seleccionado → edita globalDNA del asset completo.
 *  - Con cue seleccionado → edita el dna de ese CuePoint específico.
 *
 * Conectado exclusivamente a useTheiaEditorStore. Sin estado local opaco.
 * WAVE 4910.6: botón EXPORT .THEIA con IPC nativo + fallback Blob.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useCallback } from 'react'
import { useTheiaEditorStore, clearAutosave } from '../../stores/useTheiaEditorStore'
import type { DraftGenome } from '../../stores/useTheiaEditorStore'
import './TheiaDNALab.css'

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const ENERGY_ZONES = [
  'silence', 'valley', 'ambient', 'gentle', 'active', 'intense', 'peak',
] as const

type EnergyZoneValue = typeof ENERGY_ZONES[number]

const GENOME_PARAMS: Array<{
  key: keyof DraftGenome
  label: string
  color: string
  bindSuffix: string
}> = [
  { key: 'aggression', label: 'AGRESIÓN',   color: '#ef4444', bindSuffix: 'aggression' },
  { key: 'chaos',      label: 'CAOS',        color: '#a855f7', bindSuffix: 'chaos'      },
  { key: 'organicity', label: 'ORGANICIDAD', color: '#22c55e', bindSuffix: 'organicity' },
]

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const TheiaDNALab: React.FC = () => {
  const draftAsset      = useTheiaEditorStore((s) => s.draftAsset)
  const selectedCueId   = useTheiaEditorStore((s) => s.selectedCueId)
  const isDirty         = useTheiaEditorStore((s) => s.isDirty)
  const updateGlobalDNA = useTheiaEditorStore((s) => s.updateGlobalDNA)
  const updateCuePoint  = useTheiaEditorStore((s) => s.updateCuePoint)
  const markClean       = useTheiaEditorStore((s) => s.markClean)

  // Resolución del foco activo
  const selectedCue = draftAsset?.cuePoints.find((cp) => cp.id === selectedCueId) ?? null
  const activeDNA: DraftGenome = selectedCue
    ? selectedCue.dna
    : (draftAsset?.globalDNA ?? { aggression: 0.5, chaos: 0.5, organicity: 0.5 })
  const activeEnergyZone = selectedCue?.energyZone ?? { min: 'silence', max: 'peak' }

  // ─── Export handler ───────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    if (!draftAsset) return

    // ── PRE-EXPORT VALIDATION ─────────────────────────────────────────────
    const cues = draftAsset.cuePoints

    // 1) Exactamente un default: true
    const defaultCount = cues.filter((cp) => cp.default).length
    if (defaultCount !== 1) {
      alert(
        `⚠️ EXPORT BLOQUEADO\n\n` +
        `El asset debe tener exactamente 1 cuepoint marcado como default.\n` +
        `Actual: ${defaultCount} (${defaultCount === 0 ? 'ninguno' : 'varios'}).\n\n` +
        `Corrígelo en la Timeline antes de exportar.`,
      )
      return
    }

    // 2) Sin solapamientos temporales
    const sorted = [...cues].sort((a, b) => a.startMs - b.startMs)
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].endMs > sorted[i + 1].startMs) {
        alert(
          `⚠️ EXPORT BLOQUEADO\n\n` +
          `Solapamiento detectado entre:\n` +
          `  "${sorted[i].name}"  (endMs ${sorted[i].endMs}ms)\n` +
          `  "${sorted[i + 1].name}"  (startMs ${sorted[i + 1].startMs}ms)\n\n` +
          `Ajusta los cuepoints en la Timeline antes de exportar.`,
        )
        return
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    // Limpieza: quitar flags internos de sesión antes de serializar
    const clean = {
      ...draftAsset,
      cuePoints: draftAsset.cuePoints.map(({ isNew: _isNew, ...cp }) => cp),
    }
    const suggestedName = `${draftAsset.id}.theia`

    // Intenta IPC nativo (Save As dialog) si el bridge está disponible
    type ExportFn = (asset: unknown, name: string) => Promise<{
      success: boolean; filePath?: string; cancelled?: boolean; error?: string
    }>
    const exportFn = (
      window as unknown as { lux?: { theia?: { exportAsset?: ExportFn } } }
    ).lux?.theia?.exportAsset

    if (exportFn) {
      const res = await exportFn(clean, suggestedName)
      if (res.success) {
        markClean()
        clearAutosave(draftAsset.id)
      } else if (!res.cancelled) {
        console.error('[DNALab] Export IPC failed:', res.error)
      }
    } else {
      // Fallback renderer: Blob → anchor download
      const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = suggestedName
      a.click()
      URL.revokeObjectURL(url)
      markClean()
    }
  }, [draftAsset, markClean])

  // ─── Handlers genome ──────────────────────────────────────────────────────

  const handleGenomeChange = useCallback(
    (key: keyof DraftGenome, value: number) => {
      if (selectedCue) {
        updateCuePoint(selectedCue.id, { dna: { ...selectedCue.dna, [key]: value } })
      } else {
        updateGlobalDNA({ [key]: value })
      }
    },
    [selectedCue, updateCuePoint, updateGlobalDNA]
  )

  // ─── Handlers energy zone ─────────────────────────────────────────────────

  const handleZoneChange = useCallback(
    (edge: 'min' | 'max', value: EnergyZoneValue) => {
      if (!selectedCue) return
      const current = selectedCue.energyZone
      const minIdx = ENERGY_ZONES.indexOf(current.min as EnergyZoneValue)
      const maxIdx = ENERGY_ZONES.indexOf(current.max as EnergyZoneValue)
      const newIdx = ENERGY_ZONES.indexOf(value)

      if (edge === 'min' && newIdx > maxIdx) return
      if (edge === 'max' && newIdx < minIdx) return

      updateCuePoint(selectedCue.id, {
        energyZone: { ...current, [edge]: value },
      })
    },
    [selectedCue, updateCuePoint]
  )

  // ─── Render ───────────────────────────────────────────────────────────────

  const isDraftEmpty = !draftAsset

  return (
    <aside
      className={`dna-lab${isDraftEmpty ? ' dna-lab--empty' : ''}`}
      aria-label="DNA Lab"
    >
      {/* ── Botón EXPORT ── */}
      <button
        className={`dna-lab__export-btn${isDirty ? ' is-dirty' : ''}`}
        onClick={handleExport}
        disabled={isDraftEmpty}
        title={isDirty ? 'Cambios sin guardar — exportar .theia' : 'Exportar asset como .theia'}
        data-midi-bind="theia.author.export"
      >
        <span className="dna-lab__export-icon">💾</span>
        <span className="dna-lab__export-label">EXPORT .THEIA</span>
        {isDirty && <span className="dna-lab__export-dirty">●</span>}
      </button>

      {/* ── Header de foco ── */}
      <header className="dna-lab__header">
        <span className="dna-lab__icon">🧬</span>
        <div className="dna-lab__title-block">
          <span className="dna-lab__label">DNA LAB</span>
          <span className="dna-lab__focus">
            {isDraftEmpty
              ? '— sin draft —'
              : selectedCue
                ? `CUE: ${selectedCue.name}`
                : 'GLOBAL DNA'}
          </span>
        </div>
        {selectedCue?.default && (
          <span className="dna-lab__badge dna-lab__badge--default" title="Cuepoint por defecto">★</span>
        )}
        {selectedCue?.isDivineCandidate && (
          <span className="dna-lab__badge dna-lab__badge--divine" title="Divine candidate">⚡</span>
        )}
      </header>

      {/* ── Genome sliders ── */}
      <section className="dna-lab__section">
        <h3 className="dna-lab__section-title">GENOMA</h3>
        <div className="dna-lab__sliders">
          {GENOME_PARAMS.map(({ key, label, color, bindSuffix }) => {
            const val = activeDNA[key]
            const pct = val * 100
            return (
              <div
                key={key}
                className="dna-slider"
                style={{ ['--dna-color' as string]: color }}
                data-midi-bind={`theia.author.dna.${bindSuffix}`}
              >
                <div className="dna-slider__header">
                  <span className="dna-slider__label">{label}</span>
                  <span className="dna-slider__value">{val.toFixed(2)}</span>
                </div>
                <div className="dna-slider__track">
                  <div
                    className="dna-slider__fill"
                    style={{ width: `${pct}%` }}
                  />
                  <input
                    type="range"
                    className="dna-slider__input"
                    min={0}
                    max={1}
                    step={0.01}
                    value={val}
                    disabled={isDraftEmpty}
                    onChange={(e) => handleGenomeChange(key, Number(e.target.value))}
                    aria-label={label}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Energy Zone (solo si hay cue seleccionado) ── */}
      <section className={`dna-lab__section${!selectedCue ? ' dna-lab__section--muted' : ''}`}>
        <h3 className="dna-lab__section-title">
          ENERGY ZONE
          {!selectedCue && <span className="dna-lab__hint"> — selecciona un cue</span>}
        </h3>
        <div className="dna-zone">
          <div className="dna-zone__group">
            <label className="dna-zone__label">MIN</label>
            <div className="dna-zone__tags">
              {ENERGY_ZONES.map((z) => (
                <button
                  key={`min-${z}`}
                  className={`dna-zone__tag${activeEnergyZone.min === z ? ' is-active' : ''}`}
                  disabled={!selectedCue}
                  onClick={() => handleZoneChange('min', z)}
                  data-midi-bind={`theia.author.zone.min.${z}`}
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
                  className={`dna-zone__tag${activeEnergyZone.max === z ? ' is-active' : ''}`}
                  disabled={!selectedCue}
                  onClick={() => handleZoneChange('max', z)}
                  data-midi-bind={`theia.author.zone.max.${z}`}
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
          <span className="dna-lab__empty-icon">◌</span>
          <p>Arrastra un <code>.mp4</code> al viewport<br />para comenzar a editar.</p>
        </div>
      )}
    </aside>
  )
}

export default TheiaDNALab
