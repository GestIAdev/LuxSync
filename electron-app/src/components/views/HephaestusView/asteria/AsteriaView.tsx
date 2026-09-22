/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 ASTERIA VIEW — WAVE 8020: EL TACTO (SELECCIÓN + PROTOCOLO POKE)
 *
 * Layout interno del Pixel Mapper (blueprint §Arquitectura):
 *
 *   ┌──────────┬──────────────────────────────┬────────────────┐
 *   │ TOOLBOX  │      TACTICAL CANVAS         │  GESTURE STACK │
 *   │ (56px)   │      <AsteriaCanvas />       │  (260px)       │
 *   └──────────┴──────────────────────────────┴────────────────┘
 *
 * WAVE 8020:
 *   - Toolbox con Select (V) · Lasso (L) · Radial (R) + kill-switch POKE.
 *   - useAsteriaTouch montado: hover ∪ selección → CalibrationBus →
 *     L3++ real. Heartbeat 400 ms, fade-out 180 ms, Esc libera.
 *   - El rail muestra atlas + conteo de selección + badge POKE ACTIVO.
 *
 * `preview`/`temporalActions` entran por contrato con la shell — la
 * TimeBar / AUDITION llegan en waves posteriores.
 *
 * @module HephaestusView/asteria/AsteriaView
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useEffect } from 'react'
import type { HephPreviewReturn } from '../useHephPreview'
import type { TemporalActions } from '../types/HephaestusShared'
import { AsteriaCanvas } from './canvas/AsteriaCanvas'
import { useNodeAtlas } from './canvas/useNodeAtlas'
import { useAsteriaTouch } from './preview/useAsteriaTouch'
import { useAsteriaCompiler } from './compiler/useAsteriaCompiler'
import { useAsteriaStore, type AsteriaToolId } from './store/useAsteriaStore'
import { getTool } from './tools/ToolRegistry'
import './tools' // side-effect: puebla TOOL_REGISTRY

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export interface AsteriaViewProps {
  /** Preview a 44 Hz del clip en edición — AUDITION/scrub (WAVE posterior). */
  preview: HephPreviewReturn
  /** Undo/redo y transporte temporal compartido con Forge/Lab. */
  temporalActions: TemporalActions
}

const TOOL_ORDER: readonly AsteriaToolId[] = ['select', 'lasso', 'radial']

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const AsteriaView: React.FC<AsteriaViewProps> = (_props) => {
  const { atlas, loading, error } = useNodeAtlas()
  useAsteriaTouch()
  useAsteriaCompiler()

  const activeToolId = useAsteriaStore((s) => s.activeToolId)
  const setActiveTool = useAsteriaStore((s) => s.setActiveTool)
  const pokeEnabled = useAsteriaStore((s) => s.pokeEnabled)
  const setPokeEnabled = useAsteriaStore((s) => s.setPokeEnabled)
  const selectionCount = useAsteriaStore((s) => s.selectionNodeIds.size)
  const hoverCount = useAsteriaStore((s) => s.hoverNodeIds.size)
  const touchLive = selectionCount + hoverCount
  const stack = useAsteriaStore((s) => s.project.stack)
  const compileReport = useAsteriaStore((s) => s.lastCompileReport)

  // ── Hotkeys de herramientas: V / L / R ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return
      const key = e.key.toLowerCase()
      for (const id of TOOL_ORDER) {
        const tool = getTool(id)
        if (tool?.hotkey === key) {
          setActiveTool(id)
          return
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setActiveTool])

  return (
    <div className="asteria-view">
      {/* ── TOOLBOX ── */}
      <div className="asteria-toolbox" aria-label="Asteria tools">
        {TOOL_ORDER.map((id) => {
          const tool = getTool(id)
          if (!tool) return null
          const active = activeToolId === id
          return (
            <button
              key={id}
              type="button"
              className={`asteria-tool-btn ${active ? 'active' : ''}`}
              title={`${tool.label} (${tool.hotkey.toUpperCase()})`}
              onClick={() => setActiveTool(id)}
            >
              <span className="asteria-tool-btn__icon">{tool.icon}</span>
            </button>
          )
        })}
        <div className="asteria-toolbox__spacer" />
        <button
          type="button"
          className={`asteria-tool-btn asteria-tool-btn--poke ${pokeEnabled ? 'active' : ''}`}
          title={`POKE ${pokeEnabled ? 'ON' : 'OFF'} — tacto físico por L3++ (kill-switch)`}
          onClick={() => setPokeEnabled(!pokeEnabled)}
        >
          <span className="asteria-tool-btn__icon">⚡</span>
        </button>
      </div>

      {/* ── LIENZO TÁCTICO ── */}
      <AsteriaCanvas />

      {/* ── RAIL: atlas + selección + badge POKE ── */}
      <div className="asteria-side-rail" aria-label="Gesture stack">
        <div className="asteria-rail__section">
          <div className="asteria-rail__title">NODE ATLAS</div>
          {loading && <div className="asteria-rail__muted">cargando topología…</div>}
          {!loading && error && (
            <div className="asteria-rail__error">{error}</div>
          )}
          {!loading && !error && atlas && (
            <>
              <div className="asteria-rail__stat">
                {atlas.entries.length} nodos
              </div>
              <div className="asteria-rail__muted">
                {atlas.entries.filter((e) => e.position).length} con posición
              </div>
            </>
          )}
          {!loading && !error && !atlas && (
            <div className="asteria-rail__muted">sin datos del grafo</div>
          )}
        </div>

        <div className="asteria-rail__section">
          <div className="asteria-rail__title">SELECCIÓN</div>
          <div className="asteria-rail__stat">{selectionCount} nodos</div>
        </div>

        {/* 🜨 WAVE 8030-P7: Gesture Stack + HUD de compilación Λ */}
        <div className="asteria-rail__section">
          <div className="asteria-rail__title">GESTURE STACK</div>
          {[...stack].reverse().map((g) => (
            <div key={g.id} className="asteria-rail__muted">
              {g.kind.toUpperCase()} · {g.id}
            </div>
          ))}
        </div>

        <div className="asteria-rail__section">
          <div className="asteria-rail__title">COMPILE Λ</div>
          {compileReport ? (
            <>
              <div className="asteria-rail__stat">
                {(compileReport.bytes / 1024).toFixed(1)} KB ·{' '}
                {compileReport.trackIds.length} pista(s)
              </div>
              <div className="asteria-rail__muted">
                {compileReport.devicesTargeted} fixtures ·{' '}
                {compileReport.overrideCount} offsets ·{' '}
                {compileReport.strategy}
              </div>
              {compileReport.warnings.map((w) => (
                <div key={w} className="asteria-rail__error">
                  ⚠ {w}
                </div>
              ))}
            </>
          ) : (
            <div className="asteria-rail__muted">sin compilar</div>
          )}
        </div>

        {touchLive > 0 && pokeEnabled && (
          <div className="asteria-poke-badge">⚡ POKE ACTIVO · {touchLive} nodos</div>
        )}
      </div>
    </div>
  )
}
