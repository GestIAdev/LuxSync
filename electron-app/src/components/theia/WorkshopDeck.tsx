/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛠️ <WorkshopDeck /> — WAVE 4922 (Atomic Paradigm · Fase 3)
 *
 * Cola de trabajo del modo WORKSHOP. Reemplaza al stub `AuthorAssetDeck` y
 * a la difunta `TheiaTimeline` multi-cuepoint.
 *
 * Renderiza un carril horizontal con `RawClipCard`s por cada archivo `.mp4`
 * dropeado en la sesión actual. Cada card refleja su estado en el flujo:
 *
 *   queued   — pendiente de ser editado
 *   editing  — actualmente cargado en el <TheiaTrimmer> + DNA Lab
 *   exported — ya escrito a disco como átomo
 *
 * Interacción:
 *   - Click en card → carga el clip en el <TheiaTrimmer> + DNA Lab
 *     (set `draftAtom` con genoma neutro 0.5; el trim arranca a clip-full).
 *
 * El componente NO renderiza el viewport de vídeo — solo cambia el draft
 * activo. La sincronización con el orchestrator queda en el callsite padre.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useCallback, useMemo } from 'react'
import { useTheiaEditorStore } from '../../stores/useTheiaEditorStore'
import { useTheiaPackStore, type RawClip } from '../../stores/useTheiaPackStore'
import { getThetaOrchestrator } from '../../theia'
import { LuxIcon } from '../icons'

// ─── PROPS ────────────────────────────────────────────────────────────────────

export interface WorkshopDeckProps {
  /**
   * Callback opcional para que el padre dispare un `loadVideo()` en el
   * orchestrator después de activar el clip. Si no se provee, el componente
   * hace su propio `theta.loadVideo(url)`.
   */
  onClipSelected?: (clip: RawClip) => void
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

const WorkshopDeck: React.FC<WorkshopDeckProps> = ({ onClipSelected }) => {
  const rawClips = useTheiaPackStore((s) => s.rawClips)
  const updateRawClip = useTheiaPackStore((s) => s.updateRawClip)
  const draftAtomId = useTheiaEditorStore((s) => s.draftAtom?.id)

  // Sólo mostramos clips de WORKSHOP-pertinentes (queued + editing + exported).
  const visibleClips = useMemo(() => rawClips, [rawClips])

  const handleSelect = useCallback(async (clip: RawClip) => {
    // 1) Cambiar estados: el clip elegido pasa a 'editing'; los demás 'editing'
    //    vuelven a 'queued' (sólo un editing a la vez).
    for (const c of rawClips) {
      if (c.id === clip.id && c.state !== 'editing') {
        updateRawClip(c.id, { state: 'editing' })
      } else if (c.id !== clip.id && c.state === 'editing') {
        updateRawClip(c.id, { state: 'queued' })
      }
    }

    // 2) Cargar el vídeo en el orchestrator (o delegar al padre).
    if (onClipSelected) {
      onClipSelected(clip)
    } else {
      try {
        const theta = getThetaOrchestrator()
        await theta.start()
        await theta.loadVideo(clip.url)
      } catch (err) {
        console.error('[WorkshopDeck] loadVideo failed:', err)
        return
      }
    }

    // 3) Refrescar el draft (genoma neutro, trim = clip full).
    const vid = getThetaOrchestrator().getVideoElement()
    const dur = vid && Number.isFinite(vid.duration) ? vid.duration : 0
    const durMs = dur > 0 ? Math.round(dur * 1000) : clip.durationMs || 60_000
    useTheiaEditorStore.getState().newDraftFromPath(clip.filePath, durMs)
    updateRawClip(clip.id, { durationMs: durMs })
  }, [rawClips, updateRawClip, onClipSelected])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section
      className="theia-author-deck"
      data-deck="workshop"
      aria-label="Workshop raw inputs queue"
    >
      <div className="theia-author-deck__header">
        <span className="theia-author-deck__title">WORKSHOP DECK</span>
        <span className="theia-author-deck__count">
          {visibleClips.length} {visibleClips.length === 1 ? 'CLIP' : 'CLIPS'}
        </span>
        <span className="theia-author-deck__hint">
          ↑ LOAD ASSETS para añadir crudos
        </span>
      </div>

      <div className="theia-author-deck__rail" role="list">
        {visibleClips.length === 0 ? (
          <EmptyPlaceholder />
        ) : (
          visibleClips.map((clip) => (
            <RawClipCard
              key={clip.id}
              clip={clip}
              active={clip.state === 'editing' || clip.id === draftAtomId}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>
    </section>
  )
}

// ─── SUB-COMPONENT: RawClipCard ──────────────────────────────────────────────

interface RawClipCardProps {
  clip: RawClip
  active: boolean
  onSelect: (clip: RawClip) => void
}

const RawClipCard: React.FC<RawClipCardProps> = ({ clip, active, onSelect }) => {
  const stateMeta = STATE_BADGE[clip.state]
  const className = [
    'theia-asset-card',
    active ? 'is-active is-draft' : '',
    clip.state === 'exported' ? 'is-exported' : '',
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      role="listitem"
      className={className}
      title={`${clip.name}\n${clip.packId ? `Pack: ${clip.packId}\n` : ''}State: ${clip.state}`}
      onClick={() => onSelect(clip)}
      data-clip-state={clip.state}
      data-midi-bind={`theia.workshop.clip.${clip.id}`}
    >
      <header className="theia-asset-card__head">
        <LuxIcon name={stateMeta.icon} size={14} color={stateMeta.color} />
        <span className="theia-asset-card__state">{stateMeta.label}</span>
      </header>
      <span className="theia-asset-card__id">{clip.name}</span>
      <span className="theia-asset-card__cues">
        {clip.packId ? `→ ${clip.packId}` : 'no pack target'}
      </span>
    </button>
  )
}

// ─── SUB-COMPONENT: Empty placeholder ────────────────────────────────────────

const EmptyPlaceholder: React.FC = () => (
  <div className="theia-asset-card theia-asset-card--empty" role="listitem">
    <LuxIcon name="folder" size={22} />
    <span className="theia-asset-card__label">DROP RAW .MP4</span>
  </div>
)

// ─── STATIC LOOKUPS ──────────────────────────────────────────────────────────

type RawClipStateLabel = {
  label: string
  icon: 'play' | 'file' | 'save'
  color: string
}

const STATE_BADGE: Record<RawClip['state'], RawClipStateLabel> = {
  queued:   { label: 'QUEUED',   icon: 'file', color: 'rgba(168, 85, 247, 0.85)' }, // workshop magenta
  editing:  { label: 'EDITING',  icon: 'play', color: 'rgba(251, 191, 36, 0.95)' }, // draft amber
  exported: { label: 'EXPORTED', icon: 'save', color: 'rgba(34, 197, 94, 0.95)'  }, // ok green
}

export default WorkshopDeck
