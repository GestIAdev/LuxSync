/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎚️ <PlaylistLane /> — WAVE 8305 (Blueprint Ola C · §6)
 *
 * Carril horizontal de la playlist manual. Vive en la fila inferior del modo
 * PERFORM (sobre el Media Browser); en DESIGN colapsa a rail.
 *
 *   - Click en tarjeta        → playAt(i) — disparo manual (ignora skip).
 *   - Drop de tile del deck   → insertItem en la posición del hueco.
 *   - Drag interno de tarjeta → reorderItems (mismo gesto, otro MIME).
 *   - ⊘ skip · 📌 pin · ✕ remove — flags del blueprint por tarjeta.
 *
 * Tarjetas: borde FÓSFORO SÓLIDO + badge `▶ LIVE` si es activeIndex;
 * borde DISCONTINUO + badge `CUE` si es cueIndex. Altura fija — el carril
 * nunca cambia el layout al saltar de estado.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useCallback, useRef, useState } from 'react'
import {
  parseTheiaAtomPayloads,
  THEIA_ATOM_MIME,
  useTheiaPlaylistStore,
  type TheiaPlaylistItem,
} from '../../stores/useTheiaPlaylistStore'
import type { TheiaPanelCollapse } from '../../stores/useTheiaUiStore'
import { LuxIcon } from '../icons'

/** MIME interno para reordenar tarjetas dentro del propio lane. */
const THEIA_PL_ITEM_MIME = 'application/x-theia-pl-item'

interface PlaylistLaneProps {
  readonly collapse: TheiaPanelCollapse
}

const PlaylistLane: React.FC<PlaylistLaneProps> = ({ collapse }) => {
  const items = useTheiaPlaylistStore((s) => s.items)
  const activeIndex = useTheiaPlaylistStore((s) => s.activeIndex)
  const cueIndex = useTheiaPlaylistStore((s) => s.cueIndex)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  /** Índice de inserción visual durante un dragover (null = fuera). */
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  /** 🌊 WAVE 8313 · M2 — vista grid (multi-fila) del lane en PERFORM. */
  const [gridView, setGridView] = useState(false)

  // ── DnD ────────────────────────────────────────────────────────────────

  /** Índice de inserción según la X del cursor vs el punto medio de cada
   *  tarjeta: antes de la primera tarjeta cuyo centro supere la X. */
  const insertionIndexFromX = useCallback((clientX: number): number => {
    const scroller = scrollRef.current
    if (!scroller) return useTheiaPlaylistStore.getState().items.length
    const cards = Array.from(
      scroller.querySelectorAll<HTMLElement>('.theia-pl-card'),
    )
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect()
      if (clientX < r.left + r.width / 2) return i
    }
    return cards.length
  }, [])

  /** 🌊 WAVE 8313 — versión 2D para la vista grid (wrap): las tarjetas van
   *  en orden visual row-major; el cursor antes del centro X dentro de su
   *  fila inserta ahí, por encima de la fila inserta antes de ella, y por
   *  debajo de todo → final. */
  const insertionIndexFromXY = useCallback(
    (clientX: number, clientY: number): number => {
      const scroller = scrollRef.current
      if (!scroller) return useTheiaPlaylistStore.getState().items.length
      const cards = Array.from(
        scroller.querySelectorAll<HTMLElement>('.theia-pl-card'),
      )
      for (let i = 0; i < cards.length; i++) {
        const r = cards[i].getBoundingClientRect()
        // Por encima de la banda de su fila → insertar antes de ella.
        if (clientY < r.top) return i
        // Dentro de la banda de su fila → manda la X vs su centro.
        if (clientY <= r.bottom && clientX < r.left + r.width / 2) return i
        // (a la derecha de su centro → la siguiente tarjeta decide;
        //  si era la última de la fila, cae a la fila siguiente)
      }
      return cards.length
    },
    [],
  )

  const insertionIndex = useCallback(
    (clientX: number, clientY: number): number =>
      gridView ? insertionIndexFromXY(clientX, clientY) : insertionIndexFromX(clientX),
    [gridView, insertionIndexFromX, insertionIndexFromXY],
  )

  const isForeignDrag = useCallback(
    (e: React.DragEvent) =>
      e.dataTransfer.types.includes(THEIA_ATOM_MIME) ||
      e.dataTransfer.types.includes(THEIA_PL_ITEM_MIME),
    [],
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!isForeignDrag(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setDropIndex(insertionIndex(e.clientX, e.clientY))
    },
    [isForeignDrag, insertionIndex],
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDropIndex(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const at = insertionIndex(e.clientX, e.clientY)
      setDropIndex(null)
      const store = useTheiaPlaylistStore.getState()

      // 1) Reorden interno: tarjeta del propio lane.
      const plItemId = e.dataTransfer.getData(THEIA_PL_ITEM_MIME)
      if (plItemId) {
        const from = store.items.findIndex((it) => it.id === plItemId)
        if (from < 0) return
        // Mover antes de `at`; si el origen precede al hueco, el destino
        // real baja 1 porque el ítem sale de la lista primero.
        const to = from < at ? at - 1 : at
        store.reorderItems(from, Math.max(0, Math.min(store.items.length - 1, to)))
        return
      }

      // 2) Átomos del Media Browser — 🌊 WAVE 8313: single tile,
      //    multi-selección o pack completo llegan como lista.
      const payloads = parseTheiaAtomPayloads(e.dataTransfer)
      if (payloads.length > 0) {
        store.insertItems(
          payloads.map((p) => ({
            atomId: p.atomId,
            genome: p.genome,
            label: p.label,
            kind: p.kind,
          })),
          at,
        )
      }
    },
    [insertionIndex],
  )

  // ── Interacciones de tarjeta ──────────────────────────────────────────

  const handleCardDragStart = useCallback(
    (e: React.DragEvent, item: TheiaPlaylistItem) => {
      e.dataTransfer.setData(THEIA_PL_ITEM_MIME, item.id)
      // El átomo también viaja en el MIME estándar → re-drop desde el lane.
      if (item.atomId) {
        e.dataTransfer.setData(
          THEIA_ATOM_MIME,
          JSON.stringify({
            atomId: item.atomId,
            label: item.label,
            kind: item.kind,
            genome: item.genome,
          }),
        )
      }
      e.dataTransfer.effectAllowed = 'move'
    },
    [],
  )

  const handleCardClick = useCallback((index: number) => {
    useTheiaPlaylistStore.getState().playAt(index)
  }, [])

  const handleRemove = useCallback((item: TheiaPlaylistItem) => {
    useTheiaPlaylistStore.getState().removeItem(item.id)
  }, [])

  const handleToggleSkip = useCallback((item: TheiaPlaylistItem) => {
    useTheiaPlaylistStore.getState().toggleSkip(item.id)
  }, [])

  const handleTogglePinned = useCallback((item: TheiaPlaylistItem) => {
    useTheiaPlaylistStore.getState().togglePinned(item.id)
  }, [])

  const handleClear = useCallback(() => {
    useTheiaPlaylistStore.getState().clearPlaylist()
  }, [])

  // ── Render ────────────────────────────────────────────────────────────

  const isRail = collapse === 'rail'
  const activeItem = activeIndex >= 0 ? items[activeIndex] : undefined
  const cueItem = cueIndex >= 0 ? items[cueIndex] : undefined

  return (
    <div
      className={`theia-playlist-lane${gridView && !isRail ? ' is-grid' : ''}`}
      data-collapse={collapse}
      data-empty={items.length === 0 || undefined}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      title="Playlist — arrastra átomos del Media Browser"
    >
      <span className="theia-playlist-lane__label">
        PLAYLIST
        {/* 🌊 WAVE 8313 · M2 — fila ⇄ grid multi-fila (oculto en rail). */}
        {!isRail && (
          <button
            type="button"
            className={`theia-playlist-lane__grid-toggle${gridView ? ' is-on' : ''}`}
            onClick={() => setGridView((v) => !v)}
            title={
              gridView
                ? 'Vista fila — scroll horizontal'
                : 'Vista grid — varias filas, ocupa más alto'
            }
            aria-pressed={gridView}
            aria-label="Alternar vista grid de la playlist"
          >
            <LuxIcon name={gridView ? 'shrink' : 'expand'} size={9} />
          </button>
        )}
      </span>

      {isRail ? (
        <span className="theia-playlist-lane__rail">
          {items.length === 0 ? (
            'EMPTY'
          ) : (
            <>
              {items.length} · ▶ {activeItem?.label ?? '—'} · CUE →{' '}
              {cueItem?.label ?? '—'}
            </>
          )}
        </span>
      ) : (
        <div
          className={`theia-pl-scroll${gridView ? ' is-grid' : ''}`}
          ref={scrollRef}
        >
          {items.length === 0 ? (
            <span className="theia-playlist-lane__hint">
              DRAG ATOMS HERE — NEXT/PREV disparan la lista (manual · Ola D = autopilot)
            </span>
          ) : (
            items.map((item, i) => (
              <React.Fragment key={item.id}>
                {dropIndex === i && (
                  <span className="theia-pl-dropmark" aria-hidden />
                )}
                <div
                  className={[
                    'theia-pl-card',
                    i === activeIndex ? 'is-live' : '',
                    i === cueIndex ? 'is-cue' : '',
                    item.flags.skip ? 'is-skip' : '',
                    item.flags.pinned ? 'is-pinned' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  draggable
                  onDragStart={(e) => handleCardDragStart(e, item)}
                  onClick={() => handleCardClick(i)}
                  data-midi-bind={`theia.playlist.item.${i + 1}`}
                  title={`${item.label}\n${item.kind === 'shader' ? 'GEN' : 'VID'}${
                    item.flags.skip ? '\nSKIP — NEXT/PREV lo saltan' : ''
                  }${item.flags.pinned ? '\nPINNED — protegido de borrado' : ''}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleCardClick(i)
                    }
                  }}
                >
                  <span className="theia-pl-card__chip">
                    {item.kind === 'shader' ? 'GEN' : 'VID'}
                  </span>
                  <span className="theia-pl-card__name">{item.label}</span>
                  {i === activeIndex && (
                    <span className="theia-pl-card__badge is-live-badge">▶ LIVE</span>
                  )}
                  {i === cueIndex && (
                    <span className="theia-pl-card__badge is-cue-badge">CUE</span>
                  )}
                  <span className="theia-pl-card__tools" aria-hidden>
                    <span
                      role="button"
                      className="theia-pl-card__tool"
                      title={item.flags.pinned ? 'Unpin' : 'Pin'}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleTogglePinned(item)
                      }}
                    >
                      {item.flags.pinned ? '📌' : '◦'}
                    </span>
                    <span
                      role="button"
                      className="theia-pl-card__tool"
                      title={item.flags.skip ? 'Unskip' : 'Skip in NEXT/PREV'}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleSkip(item)
                      }}
                    >
                      ⊘
                    </span>
                    {!item.flags.pinned && (
                      <span
                        role="button"
                        className="theia-pl-card__tool is-del"
                        title="Remove from playlist"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemove(item)
                        }}
                      >
                        <LuxIcon name="x" size={9} />
                      </span>
                    )}
                  </span>
                </div>
              </React.Fragment>
            ))
          )}
          {dropIndex === items.length && items.length > 0 && (
            <span className="theia-pl-dropmark" aria-hidden />
          )}
        </div>
      )}

      {!isRail && items.length > 0 && (
        <span className="theia-playlist-lane__meta">
          {items.length}
          <button
            type="button"
            className="theia-playlist-lane__clear"
            onClick={handleClear}
            title="Clear playlist"
          >
            <LuxIcon name="trash" size={10} />
          </button>
        </span>
      )}
    </div>
  )
}

export default PlaylistLane
