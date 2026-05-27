/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️  <LiveDeck /> — WAVE 4922 (Atomic Paradigm · Fase 3)
 *
 * Carril inferior del modo LIVE. Reemplaza al difunto `AssetDeck`
 * multi-clip de WAVE 4910.
 *
 * Estructura visual (vertical, dentro del slot stage):
 *
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │  DECK · Pack Slots                                                  │
 *   │  ┌────────┬────────┬────────┬────────────┐                          │
 *   │  │▤Tiburon│CityNigh│GlassRm │ + slot     │                          │
 *   │  │● 12 at │○  6 at │○  9 at │            │                          │
 *   │  └────────┴────────┴────────┴────────────┘                          │
 *   │  ┌─[expanded: Tiburon] ────────────────────────────────────────┐    │
 *   │  │ [Atom] [Atom] [Atom] [Atom] [Atom] [Atom]                   │    │
 *   │  └─────────────────────────────────────────────────────────────┘    │
 *   └─────────────────────────────────────────────────────────────────────┘
 *
 * Interacciones:
 *   - Click slot   → expande el pack (cierra cualquier otro expandido).
 *   - Doble-click  → marca ese pack como `●live` (matcheo de Selene apunta a él).
 *   - Click Atom   → FORCE-TRIGGER manual: invoca `orchestrator.playAtom(...)`
 *                    saltándose a Selene durante el crossfade.
 *
 * El LiveDeck es *read-only* respecto al filesystem: los packs y átomos
 * llegan ya consolidados desde `useTheiaPackStore`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useCallback, useMemo } from 'react'
import { useTheiaPackStore } from '../../stores/useTheiaPackStore'
import { getThetaOrchestrator } from '../../theia'
import type { ITheiaAtom, ITheiaPack } from '../../types/theiaTypes'
import { LuxIcon } from '../icons'

// ─── CONSTANTES VISUALES ─────────────────────────────────────────────────────

/** Default crossfade para force-trigger manual (ms). Coincide con CROSSFADE_DRAMATIC. */
const FORCE_TRIGGER_CROSSFADE_MS = 80

// ─── COMPONENT ───────────────────────────────────────────────────────────────

const LiveDeck: React.FC = () => {
  const packsMap        = useTheiaPackStore((s) => s.packs)
  const livePackId      = useTheiaPackStore((s) => s.livePackId)
  const expandedPackId  = useTheiaPackStore((s) => s.expandedPackId)
  const setLivePack     = useTheiaPackStore((s) => s.setLivePack)
  const setExpandedPack = useTheiaPackStore((s) => s.setExpandedPack)

  const packs = useMemo(() => Array.from(packsMap.values()), [packsMap])
  const expandedPack = expandedPackId ? packsMap.get(expandedPackId) ?? null : null

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSlotClick = useCallback((packId: string) => {
    // Click sencillo = toggle expandir/colapsar.
    setExpandedPack(expandedPackId === packId ? null : packId)
  }, [expandedPackId, setExpandedPack])

  const handleSlotDoubleClick = useCallback((packId: string) => {
    setLivePack(packId === livePackId ? null : packId)
  }, [livePackId, setLivePack])

  const handleAtomTrigger = useCallback(async (atom: ITheiaAtom) => {
    try {
      await getThetaOrchestrator().playAtom({
        atomId: atom.id,
        startMs: atom.trim.startMs,
        crossfadeMs: FORCE_TRIGGER_CROSSFADE_MS,
        reason: `manual:force-trigger|atom=${atom.id}`,
      })
    } catch (err) {
      console.error('[LiveDeck] playAtom failed:', err)
    }
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section className="theia-live-deck" data-deck="live" aria-label="Live pack deck">
      <div className="theia-live-deck__header">
        <span className="theia-live-deck__title">DECK · PACK SLOTS</span>
        <span className="theia-live-deck__count">
          {packs.length} {packs.length === 1 ? 'PACK' : 'PACKS'}
        </span>
      </div>

      {/* ─── Fila de Pack Slots ─── */}
      <div className="theia-live-deck__slots" role="list">
        {packs.length === 0 ? (
          <EmptySlot />
        ) : (
          packs.map((pack) => (
            <PackSlot
              key={pack.id}
              pack={pack}
              isLive={pack.id === livePackId}
              isExpanded={pack.id === expandedPackId}
              onClick={handleSlotClick}
              onDoubleClick={handleSlotDoubleClick}
            />
          ))
        )}
      </div>

      {/* ─── Expansión: grilla de Atom Tiles ─── */}
      {expandedPack && (
        <div
          className="theia-live-deck__expansion"
          data-pack-id={expandedPack.id}
          aria-label={`Atoms of pack ${expandedPack.id}`}
        >
          <div className="theia-live-deck__expansion-head">
            <span className="theia-live-deck__expansion-label">
              {expandedPack.manifest?.displayName ?? expandedPack.id}
            </span>
            <span className="theia-live-deck__expansion-count">
              {expandedPack.atoms.length} ATOM{expandedPack.atoms.length === 1 ? '' : 'S'}
            </span>
          </div>

          {expandedPack.atoms.length === 0 ? (
            <div className="theia-live-deck__expansion-empty">
              <LuxIcon name="folder" size={18} />
              <span>Pack vacío — exporta un átomo en WORKSHOP.</span>
            </div>
          ) : (
            <div className="theia-live-deck__tile-grid">
              {expandedPack.atoms.map((atom) => (
                <AtomTile
                  key={atom.id}
                  atom={atom}
                  accent={expandedPack.manifest?.accentColor}
                  onTrigger={handleAtomTrigger}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ─── SUB-COMPONENT: PackSlot ─────────────────────────────────────────────────

interface PackSlotProps {
  pack: ITheiaPack
  isLive: boolean
  isExpanded: boolean
  onClick: (packId: string) => void
  onDoubleClick: (packId: string) => void
}

const PackSlot: React.FC<PackSlotProps> = ({ pack, isLive, isExpanded, onClick, onDoubleClick }) => {
  const className = [
    'theia-pack-slot',
    isLive ? 'is-live' : '',
    isExpanded ? 'is-expanded' : '',
    pack.pending ? 'is-pending' : '',
  ].filter(Boolean).join(' ')

  const accent = pack.manifest?.accentColor

  return (
    <button
      type="button"
      role="listitem"
      className={className}
      style={accent ? { ['--pack-accent' as string]: accent } : undefined}
      onClick={() => onClick(pack.id)}
      onDoubleClick={() => onDoubleClick(pack.id)}
      data-midi-bind={`theia.live.pack.${pack.id}`}
      title={pack.pending
        ? `${pack.id} (pending export)\nClick: expand · Double-click: set ●live`
        : `${pack.id}\n${pack.atoms.length} atoms\nClick: expand · Double-click: set ●live`
      }
    >
      <header className="theia-pack-slot__head">
        <span className={`theia-pack-slot__indicator ${isLive ? 'is-live' : ''}`}>
          {isLive ? '●' : '○'}
        </span>
        <span className="theia-pack-slot__name">
          {pack.manifest?.displayName ?? pack.id}
        </span>
      </header>
      <span className="theia-pack-slot__count">
        {pack.atoms.length} {pack.atoms.length === 1 ? 'atom' : 'atoms'}
      </span>
      {pack.pending && <span className="theia-pack-slot__pending">PENDING</span>}
    </button>
  )
}

// ─── SUB-COMPONENT: AtomTile ────────────────────────────────────────────────

interface AtomTileProps {
  atom: ITheiaAtom
  accent?: string
  onTrigger: (atom: ITheiaAtom) => void
}

const AtomTile: React.FC<AtomTileProps> = ({ atom, accent, onTrigger }) => {
  const durMs = atom.trim.endMs - atom.trim.startMs
  const durSec = Math.max(1, Math.round(durMs / 1000))

  return (
    <button
      type="button"
      className="theia-atom-tile"
      style={accent ? { ['--atom-accent' as string]: accent } : undefined}
      onClick={() => onTrigger(atom)}
      data-midi-bind={`theia.live.atom.${atom.packId}.${atom.id}`}
      title={`${atom.id}\nA${atom.aggression.toFixed(2)} · C${atom.chaos.toFixed(2)} · O${atom.organicity.toFixed(2)}\n${durSec}s · zone ${atom.energyZone.min}→${atom.energyZone.max}`}
    >
      <span className="theia-atom-tile__thumb" aria-hidden>
        <LuxIcon name="play" size={20} />
      </span>
      <span className="theia-atom-tile__name">{atom.id}</span>
      <span className="theia-atom-tile__meta">
        {durSec}s · A{atom.aggression.toFixed(1)}/C{atom.chaos.toFixed(1)}/O{atom.organicity.toFixed(1)}
      </span>
      <span className="theia-atom-tile__badges">
        {atom.isDivineCandidate && (
          <span className="theia-atom-tile__badge is-divine" title="Divine candidate">
            <LuxIcon name="bolt" size={11} />
          </span>
        )}
        {atom.isHeavyCandidate && (
          <span className="theia-atom-tile__badge is-heavy" title="Heavy candidate">
            <LuxIcon name="power" size={11} />
          </span>
        )}
      </span>
    </button>
  )
}

// ─── SUB-COMPONENT: Empty placeholder ────────────────────────────────────────

const EmptySlot: React.FC = () => (
  <div className="theia-pack-slot is-empty" role="listitem">
    <LuxIcon name="folder" size={22} />
    <span className="theia-pack-slot__name">NO PACKS LOADED</span>
    <span className="theia-pack-slot__count">↑ LOAD ASSETS o exporta desde WORKSHOP</span>
  </div>
)

export default LiveDeck
