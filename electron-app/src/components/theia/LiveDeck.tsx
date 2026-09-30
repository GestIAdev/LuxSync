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
 * 🎛️ WAVE 8239 · U1 — Drag & Drop fallback: dropear ficheros del media
 * pool (`.mp4 .webm .mkv .mov .avi .theia .glsl`) sobre el deck los ingesta
 * por la misma vía que el botón LOAD ASSETS.
 *
 * El LiveDeck es *read-only* respecto al filesystem: los packs y átomos
 * llegan ya consolidados desde `useTheiaPackStore`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isSupportedMediaFile, useTheiaPackStore } from '../../stores/useTheiaPackStore'
import {
  atomDragPayload,
  packDragPayloads,
  THEIA_ATOM_MIME,
} from '../../stores/useTheiaPlaylistStore'
import { useTheiaAutopilotStore } from '../../stores/useTheiaAutopilotStore'
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
  const armedAtomId     = useTheiaPackStore((s) => s.armedAtomId)
  const activeAtomId    = useTheiaPackStore((s) => s.activeAtomId)
  const setArmedAtom    = useTheiaPackStore((s) => s.setArmedAtom)
  const setActiveAtom   = useTheiaPackStore((s) => s.setActiveAtom)
  const setLivePack     = useTheiaPackStore((s) => s.setLivePack)
  const setExpandedPack = useTheiaPackStore((s) => s.setExpandedPack)
  const removePack      = useTheiaPackStore((s) => s.removePack)
  const libraryScanning = useTheiaPackStore((s) => s.libraryScanning)
  const [isDragOver, setIsDragOver] = useState(false)
  // 🌊 WAVE 8255 — accordion: la fila de Pack Slots puede plegarse para
  // ceder todo el vertical a la grilla de átomos.
  const [slotsCollapsed, setSlotsCollapsed] = useState(false)
  // 🖥️ WAVE 8264 — accordion 2: la grilla de átomos también se pliega. Con
  // 11+ tiles la expansión se comía el vertical del Viewport; un click en la
  // cabecera del pack expandido la oculta y el deck se encoge a su título.
  const [atomsCollapsed, setAtomsCollapsed] = useState(false)
  // 🌊 WAVE 8313 — multi-selección del Media Browser: `selOrder` guarda el
  // orden de selección (click order para Ctrl, orden visual para Shift);
  // `anchorRef` es el extremo fijo del rango de Shift+Click.
  const [selOrder, setSelOrder] = useState<string[]>([])
  const anchorRef = useRef<string | null>(null)
  // Cambiar de pack expandido → la selección anterior ya no es visible.
  useEffect(() => {
    setSelOrder([])
    anchorRef.current = null
  }, [expandedPackId])

  // 🩸 WAVE 8294 — verdad absoluta del deck: el átomo vivo llega del
  // perf-report del motor (~1 Hz, `activeShader` = genActiveId real), no
  // del intent. Mutantes `core#seed` se normalizan al id canónico; cuando
  // el shader activo es 'builtin' (átomo de vídeo) la verdad la lleva
  // `getCurrentAtomId()` del orchestrator.
  useEffect(() => {
    const theta = getThetaOrchestrator()
    const syncFromEngine = () => {
      const sid = theta.getActiveShaderId()
      setActiveAtom(
        sid && sid !== 'builtin'
          ? sid.split('#')[0]
          : theta.getCurrentAtomId(),
      )
    }
    const offPerf = theta.onPerfReport((p) => {
      if (p.activeShader === undefined) return
      setActiveAtom(
        p.activeShader !== 'builtin'
          ? p.activeShader.split('#')[0]
          : theta.getCurrentAtomId(),
      )
    })
    syncFromEngine()
    return offPerf
  }, [setActiveAtom])

  // 🌊 WAVE 8299 — hidrata la librería de disco al montar el deck.
  // Sin file watchers nativos, el rescan es manual (botón ↻) + este boot-scan.
  useEffect(() => {
    void useTheiaPackStore.getState().loadLibraryFromDisk()
  }, [])

  const handleRescan = useCallback(() => {
    void useTheiaPackStore.getState().loadLibraryFromDisk()
  }, [])

  const packs = useMemo(() => Array.from(packsMap.values()), [packsMap])
  const expandedPack = expandedPackId ? packsMap.get(expandedPackId) ?? null : null
  const livePack = livePackId ? packsMap.get(livePackId) ?? null : null
  const activePack = expandedPack ?? livePack
  const activePackName = activePack
    ? (activePack.manifest?.displayName ?? activePack.id)
    : null

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSlotClick = useCallback((packId: string) => {
    // Click sencillo = toggle expandir/colapsar.
    setExpandedPack(expandedPackId === packId ? null : packId)
  }, [expandedPackId, setExpandedPack])

  const handleSlotDoubleClick = useCallback((packId: string) => {
    setLivePack(packId === livePackId ? null : packId)
  }, [livePackId, setLivePack])

  const handleDeletePack = useCallback((packId: string) => {
    removePack(packId)
  }, [removePack])

  // 🌊 WAVE 8302 · M3 — CRUD de mutaciones: baja de un átomo `core#seed`
  // de la sesión (pack + registry + bookkeeping del GenomePool).
  const handleDeleteAtom = useCallback((atom: ITheiaAtom) => {
    useTheiaPackStore.getState().removeAtom(atom.id)
  }, [])

  const handleAtomTrigger = useCallback(async (atom: ITheiaAtom) => {
    // 🖐 WAVE 8307 — regla de oro: el click humano manda; el Director calla.
    useTheiaAutopilotStore.getState().takeOver()
    const theta = getThetaOrchestrator()
    try {
      await theta.playAtom({
        atomId: atom.id,
        startMs: atom.trim.startMs,
        crossfadeMs: FORCE_TRIGGER_CROSSFADE_MS,
        reason: `manual:force-trigger|atom=${atom.id}`,
      })
      // 🖥️ WAVE 8268 — STRICT LIVE GATE: si el motor está apagado o a
      // medio boot el intent quedó ARMADO (pendingPlayIntent) — el tile
      // brilla en standby hasta que LIVE lo dispare. Si está corriendo,
      // desarma lo que hubiera (la pantalla ya muestra el átomo).
      const st = theta.getStatus()
      setArmedAtom(st.isRunning && st.isReady ? null : atom.id)
    } catch (err) {
      console.error('[LiveDeck] playAtom failed:', err)
    }
  }, [setArmedAtom])

  // 🌊 WAVE 8313 — click de tile con modificadores: Shift=rango desde el
  // ancla, Ctrl/Cmd=toggle individual, click limpio = dispara + selecciona
  // solo ese. Los clicks con modificador NO disparan (seleccionar no debe
  // encender un átomo en pantalla).
  const handleTileClick = useCallback(
    (atom: ITheiaAtom, e: React.MouseEvent) => {
      if (!expandedPack) return
      const ids = expandedPack.atoms.map((a) => a.id)
      if (e.shiftKey) {
        const anchor = anchorRef.current ?? atom.id
        const ia = ids.indexOf(anchor)
        const ib = ids.indexOf(atom.id)
        if (ia >= 0 && ib >= 0) {
          const [lo, hi] = ia <= ib ? [ia, ib] : [ib, ia]
          setSelOrder(ids.slice(lo, hi + 1))
        } else {
          setSelOrder([atom.id])
          anchorRef.current = atom.id
        }
        return
      }
      if (e.ctrlKey || e.metaKey) {
        anchorRef.current = atom.id
        setSelOrder((prev) =>
          prev.includes(atom.id)
            ? prev.filter((id) => id !== atom.id)
            : [...prev, atom.id],
        )
        return
      }
      // Click limpio: dispara el átomo y colapsa la selección a él.
      setSelOrder([atom.id])
      anchorRef.current = atom.id
      void handleAtomTrigger(atom)
    },
    [expandedPack, handleAtomTrigger],
  )

  /** Payload DnD del tile: si arrastra un ítem de la selección múltiple,
   *  viaja el array completo (en orden de selección); si no, va solo. */
  const handleTileDragStart = useCallback(
    (e: React.DragEvent, atom: ITheiaAtom) => {
      const inSel = selOrder.includes(atom.id)
      const items =
        inSel && selOrder.length > 1 && expandedPack
          ? selOrder
              .map((id) => expandedPack.atoms.find((a) => a.id === id))
              .filter((a): a is ITheiaAtom => !!a)
              .map(atomDragPayload)
          : [atomDragPayload(atom)]
      if (!inSel) {
        // Arrastrar un no-seleccionado lo convierte en la selección (std OS).
        setSelOrder([atom.id])
        anchorRef.current = atom.id
      }
      e.dataTransfer.setData(
        THEIA_ATOM_MIME,
        JSON.stringify(items.length > 1 ? { items } : items[0]),
      )
      e.dataTransfer.effectAllowed = 'copy'
    },
    [selOrder, expandedPack],
  )

  // ── 🎛️ WAVE 8239 · U1 — Drag & Drop fallback (misma vía que LOAD ASSETS) ──

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // dragleave también salta al entrar en hijos — solo apaga si sale del deck.
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      isSupportedMediaFile(f.name),
    )
    if (files.length === 0) {
      console.warn('[LiveDeck] drop ignorado — extensiones no soportadas')
      return
    }
    void useTheiaPackStore.getState().ingestFiles(files)
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section
      className={`theia-live-deck${isDragOver ? ' is-dragover' : ''}${slotsCollapsed ? ' is-slots-collapsed' : ''}`}
      data-deck="live"
      aria-label="Live pack deck"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="theia-live-deck__header">
        <button
          type="button"
          className="theia-live-deck__collapse"
          onClick={() => setSlotsCollapsed((c) => !c)}
          aria-expanded={!slotsCollapsed}
          title={slotsCollapsed ? 'Expand pack slots' : 'Collapse pack slots — more room for atoms'}
        >
          <LuxIcon name={slotsCollapsed ? 'chevron-down' : 'chevron-up'} size={11} />
        </button>
        <span className="theia-live-deck__title">DECK · PACK SLOTS</span>
        {slotsCollapsed && activePackName && (
          <span className="theia-live-deck__active-name" title={activePackName}>
            ▸ <span className={expandedPack ? '' : 'is-live'}>{activePackName}</span>
          </span>
        )}
        <span className="theia-live-deck__count">
          {packs.length} {packs.length === 1 ? 'PACK' : 'PACKS'}
        </span>
        {/* 🌊 WAVE 8299 — rescan manual de userData/theia/packs/ */}
        <button
          type="button"
          className="theia-live-deck__rescan"
          onClick={handleRescan}
          disabled={libraryScanning}
          title="Rescan library — userData/theia/packs/"
          aria-label="Rescan library"
        >
          <LuxIcon name="repeat" size={11} />
        </button>
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
              onDelete={handleDeletePack}
            />
          ))
        )}
      </div>

      {/* ─── Expansión: grilla de Atom Tiles ─── */}
      {expandedPack && (
        <div
          className={`theia-live-deck__expansion${atomsCollapsed ? ' is-atoms-collapsed' : ''}`}
          data-pack-id={expandedPack.id}
          aria-label={`Atoms of pack ${expandedPack.id}`}
        >
          {/* 🖥️ WAVE 8264 — cabecera-clickable: colapsa la grilla de átomos
              y devuelve el vertical al Viewport (mismo accordion que SLOTS) */}
          <button
            type="button"
            className="theia-live-deck__expansion-head"
            onClick={() => setAtomsCollapsed((c) => !c)}
            aria-expanded={!atomsCollapsed}
            title={atomsCollapsed
              ? 'Expand atom grid'
              : 'Collapse atom grid — more room for the viewport'}
          >
            <span className="theia-live-deck__expansion-group">
              <LuxIcon name={atomsCollapsed ? 'chevron-down' : 'chevron-up'} size={11} />
              <span className="theia-live-deck__expansion-label">
                {expandedPack.manifest?.displayName ?? expandedPack.id}
              </span>
            </span>
            {selOrder.length > 1 && (
              <span
                className="theia-live-deck__selcount"
                title="Multi-selección — arrastra cualquiera para insertarlos todos"
              >
                {selOrder.length} SEL
              </span>
            )}
            <span className="theia-live-deck__expansion-count">
              {expandedPack.atoms.length} ATOM{expandedPack.atoms.length === 1 ? '' : 'S'}
            </span>
          </button>

          {!atomsCollapsed && (expandedPack.atoms.length === 0 ? (
            <div className="theia-live-deck__expansion-empty">
              <LuxIcon name="folder" size={18} />
              <span>Pack vacío — dropea media aquí o usa LOAD ASSETS.</span>
            </div>
          ) : (
            <div className="theia-live-deck__tile-grid">
              {expandedPack.atoms.map((atom) => (
                <AtomTile
                  key={atom.id}
                  atom={atom}
                  accent={expandedPack.manifest?.accentColor}
                  isArmed={atom.id === armedAtomId}
                  isActive={atom.id === activeAtomId}
                  isSelected={selOrder.includes(atom.id)}
                  onTileClick={handleTileClick}
                  onTileDragStart={handleTileDragStart}
                  onDelete={handleDeleteAtom}
                />
              ))}
            </div>
          ))}
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
  onDelete: (packId: string) => void
}

const PackSlot: React.FC<PackSlotProps> = ({ pack, isLive, isExpanded, onClick, onDoubleClick, onDelete }) => {
  const className = [
    'theia-pack-slot',
    isLive ? 'is-live' : '',
    isExpanded ? 'is-expanded' : '',
    pack.pending ? 'is-pending' : '',
  ].filter(Boolean).join(' ')

  const accent = pack.manifest?.accentColor

  // 🌊 WAVE 8252 — arm-confirm: el botón invisible (opacity:0 salvo hover)
  // borraba packs por clicks accidentales sobre el slot. Ahora el primer
  // click ARMA (rojo + tooltip "click again"), el segundo confirma, y se
  // desarma solo a los 2.5s.
  const [armed, setArmed] = useState(false)
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (armTimerRef.current) clearTimeout(armTimerRef.current)
  }, [])

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!armed) {
      setArmed(true)
      if (armTimerRef.current) clearTimeout(armTimerRef.current)
      armTimerRef.current = setTimeout(() => setArmed(false), 2500)
      return
    }
    if (armTimerRef.current) clearTimeout(armTimerRef.current)
    setArmed(false)
    onDelete(pack.id)
  }

  // 🌊 WAVE 8313 — el slot es origen DnD masivo: arrastrar el pack a la
  // playlist inserta TODOS sus átomos en el orden de manifest.atomOrder.
  const handlePackDragStart = (e: React.DragEvent) => {
    const items = packDragPayloads(pack)
    if (items.length === 0) return // pack vacío → no arrastra nada
    e.dataTransfer.setData(
      THEIA_ATOM_MIME,
      JSON.stringify(items.length > 1 ? { items } : items[0]),
    )
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={pack.atoms.length > 0}
      onDragStart={handlePackDragStart}
      className={className}
      style={accent ? { ['--pack-accent' as string]: accent } : undefined}
      onClick={() => onClick(pack.id)}
      onDoubleClick={() => onDoubleClick(pack.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(pack.id) }}
      data-midi-bind={`theia.live.pack.${pack.id}`}
      title={pack.pending
        ? `${pack.id} (pending export)\nClick: expand · Double-click: set ●live`
        : `${pack.id}\n${pack.atoms.length} atoms\nClick: expand · Double-click: set ●live · Drag → playlist`
      }
    >
      <button
        type="button"
        className={`theia-pack-slot__delete${armed ? ' is-armed' : ''}`}
        title={armed ? 'Click again to CONFIRM removal' : 'Remove pack from memory'}
        onClick={handleDeleteClick}
        onDoubleClick={(e) => e.stopPropagation()}
        aria-label={`Remove pack ${pack.id}`}
        aria-pressed={armed}
      >
        <LuxIcon name="trash" size={11} />
      </button>
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
    </div>
  )
}

// ─── SUB-COMPONENT: AtomTile ────────────────────────────────────────────────

interface AtomTileProps {
  atom: ITheiaAtom
  accent?: string
  /** 🖥️ WAVE 8268 — intent armado (motor OFF): standby hasta LIVE. */
  isArmed?: boolean
  /** 🩸 WAVE 8294 — átomo realmente vivo en GPU (perf-report → store). */
  isActive?: boolean
  /** 🌊 WAVE 8313 — miembro de la multi-selección del browser. */
  isSelected?: boolean
  /** 🌊 WAVE 8313 — click con modificadores lo decide el padre
   *  (Shift=rango / Ctrl=toggle / limpio=trigger+select). */
  onTileClick: (atom: ITheiaAtom, e: React.MouseEvent) => void
  /** 🌊 WAVE 8313 — el payload (single o array) lo construye el padre. */
  onTileDragStart: (e: React.DragEvent, atom: ITheiaAtom) => void
  /** 🌊 WAVE 8302 · M3 — baja de mutaciones de la sesión. */
  onDelete?: (atom: ITheiaAtom) => void
}

const AtomTile: React.FC<AtomTileProps> = ({ atom, accent, isArmed, isActive, isSelected, onTileClick, onTileDragStart, onDelete }) => {
  const isShader = atom.source?.kind === 'shader'
  // 🌊 WAVE 8302 · M3 — mutación = id dinámico `core#seed` (spawnGenomeVariant).
  const isMutation = atom.id.includes('#')
  const durMs = atom.trim.endMs - atom.trim.startMs
  // 🎛️ U1 — duración honesta: los shader atoms loopean (∞); un vídeo sin
  // metadata medida aún muestra '—' en lugar de una cifra inventada.
  const durLabel = isShader ? '∞' : durMs > 0 ? `${Math.round(durMs / 1000)}s` : '—'
  const kindLabel = isShader ? 'GEN' : 'VID'

  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => onTileDragStart(e, atom)}
      className={`theia-atom-tile${isShader ? ' is-shader' : ''}${isArmed ? ' is-armed' : ''}${isActive ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}`}
      style={accent ? { ['--atom-accent' as string]: accent } : undefined}
      onClick={(e) => onTileClick(atom, e)}
      data-midi-bind={`theia.live.atom.${atom.packId}.${atom.id}`}
      title={`${atom.id}\n${kindLabel} · A${atom.aggression.toFixed(2)} · C${atom.chaos.toFixed(2)} · O${atom.organicity.toFixed(2)}\nzone ${atom.energyZone.min}→${atom.energyZone.max}${isArmed ? '\nARMED — fires on LIVE' : ''}`}
    >
      <span className="theia-atom-tile__thumb" aria-hidden>
        <LuxIcon name={isShader ? 'dna' : 'play'} size={20} />
      </span>
      <span className="theia-atom-tile__kind">{kindLabel}</span>
      <span className="theia-atom-tile__name">{atom.id}</span>
      <span className="theia-atom-tile__meta">
        {durLabel} · A{atom.aggression.toFixed(1)}/C{atom.chaos.toFixed(1)}/O{atom.organicity.toFixed(1)}
      </span>
      {isMutation && onDelete && (
        <span
          role="button"
          className="theia-atom-tile__delete"
          title={`Delete mutation ${atom.id}`}
          aria-label={`Delete mutation ${atom.id}`}
          onClick={(e) => {
            e.stopPropagation()
            onDelete(atom)
          }}
        >
          <LuxIcon name="x" size={10} />
        </span>
      )}
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
    <span className="theia-pack-slot__count">LOAD ASSETS o dropea media aquí</span>
  </div>
)

export default LiveDeck
