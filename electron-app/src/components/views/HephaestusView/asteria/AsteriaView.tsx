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
import { AsteriaTransportDrawer } from './AsteriaTransportDrawer'
import { useNodeAtlas } from './canvas/useNodeAtlas'
import { useAsteriaTouch } from './preview/useAsteriaTouch'
import { useAsteriaCompiler } from './compiler/useAsteriaCompiler'
import { useAsteriaRigDrift } from './compiler/useAsteriaRigDrift'
import { useAsteriaStore, type AsteriaToolId } from './store/useAsteriaStore'
import { getTool } from './tools/ToolRegistry'
import { GestureStackPanel } from './GestureStackPanel'
import type { HephParamId } from '../../../../core/hephaestus/types'
import {
  MCC_CELL_AVAILABLE,
  MCC_CELL_UNAVAILABLE_TOOLTIP,
} from './mccCapability'
import { measureGlyphLegibility } from './model/glyphRaster'
import {
  ASTERIA_DEFAULT_TARGET_COLOR,
  type GlyphGesture,
} from './model/AsteriaProject'
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

const TOOL_ORDER: readonly AsteriaToolId[] = [
  'select', 'lasso', 'radial', 'polygon', 'line', 'chrono', 'cell', 'glyph',
]

/**
 * 🜨 WAVE 8070 (M2): params ofrecidos en el rail — subestricto de
 * LAMBDA_SAFE_PARAMS.
 * WAVE 8080 (M1): STB desbloqueado — el gate G6 era paternalismo;
 * el operador decide si su campo pinta estrobo.
 * WAVE 8110 (M1): CLR — el compilador sintetiza LUT arcoíris y
 * hornea gain→lightness; el campo ya puede pintar color.
 */
const TARGET_PARAM_CHOICES: readonly { id: HephParamId; label: string }[] = [
  { id: 'intensity', label: 'DIM' },
  { id: 'white', label: 'WHT' },
  { id: 'amber', label: 'AMB' },
  { id: 'color', label: 'CLR' },
  { id: 'pan', label: 'PAN' },
  { id: 'tilt', label: 'TILT' },
  { id: 'zoom', label: 'ZOOM' },
  { id: 'focus', label: 'FOCUS' },
  { id: 'iris', label: 'IRIS' },
  { id: 'speed', label: 'SPD' },
  { id: 'strobe', label: 'STB' },
]

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const AsteriaView: React.FC<AsteriaViewProps> = ({ preview }) => {
  const { atlas, loading, error } = useNodeAtlas()
  useAsteriaTouch()
  useAsteriaCompiler()
  useAsteriaRigDrift() // 🜨 WAVE 8050 M3: clip.asteria → proyecto + drift

  const activeToolId = useAsteriaStore((s) => s.activeToolId)
  const setActiveTool = useAsteriaStore((s) => s.setActiveTool)
  const pokeEnabled = useAsteriaStore((s) => s.pokeEnabled)
  const setPokeEnabled = useAsteriaStore((s) => s.setPokeEnabled)
  const selectionCount = useAsteriaStore((s) => s.selectionNodeIds.size)
  const hoverCount = useAsteriaStore((s) => s.hoverNodeIds.size)
  const touchLive = selectionCount + hoverCount
  const stack = useAsteriaStore((s) => s.project.stack)
  const compileReport = useAsteriaStore((s) => s.lastCompileReport)
  const surgeonDeviceId = useAsteriaStore((s) => s.surgeonDeviceId)
  const targetParams = useAsteriaStore((s) => s.project.targetParams)
  const setTargetParams = useAsteriaStore((s) => s.setTargetParams)
  const targetColor =
    useAsteriaStore((s) => s.project.targetColor) ??
    ASTERIA_DEFAULT_TARGET_COLOR
  const setTargetColor = useAsteriaStore((s) => s.setTargetColor)
  const driftReadOnly = useAsteriaStore((s) => s.driftReadOnly)

  // 🜨 WAVE 8050 (T5): legibilidad del último gesto glyph del stack —
  // el HUD de resolución efectiva (Gate 8050: aviso honesto, jamás
  // una promesa falsa de texto legible).
  const lastGlyph = [...stack].reverse().find(
    (g): g is GlyphGesture => g.kind === 'glyph',
  )
  const glyphLegibility = lastGlyph
    ? measureGlyphLegibility(atlas, lastGlyph)
    : null

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
          // 🜨 8150-F4: el cambio de tool cancela el gesto en curso
          // (un polígono a medio cerrar no sobrevive al cambio).
          getTool(useAsteriaStore.getState().activeToolId)?.cancel?.()
          setActiveTool(id)
          return
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setActiveTool])

  // ── 🜨 WAVE 8150-F3 (M3): Undo/Redo local — el listener nace y muere
  // con la pestaña Asteria (ForgeTab tiene el suyo propio y están
  // desmontadas entre sí → sin colisión). stopPropagation por si algún
  // listener global de Hephaestus escuchara más arriba.
  const undo = useAsteriaStore((s) => s.undo)
  const redo = useAsteriaStore((s) => s.redo)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        e.stopPropagation()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      } else if (key === 'y') {
        e.preventDefault()
        e.stopPropagation()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

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
              onClick={() => {
                getTool(useAsteriaStore.getState().activeToolId)?.cancel?.()
                setActiveTool(id)
              }}
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
      <AsteriaCanvas preview={preview}>
        {/* 🜨 WAVE 8150-F2: drawer de transporte — overlay inferior del
            canvas; el scrub alimenta FeedbackLayer vía previewDataRef */}
        <AsteriaTransportDrawer preview={preview} />
      </AsteriaCanvas>

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

        {/* 🜨 WAVE 8055: panel de capas (selección/eliminar/reset) */}
        <GestureStackPanel />

        {/* 🜨 WAVE 8070 (M2): TARGET — a qué canales DMX aplica el
            campo. Toggle multi-selección; nunca vacío (el store lo
            rechaza). En solo-lectura queda congelado. */}
        <div className="asteria-rail__section">
          <div className="asteria-rail__title">TARGET</div>
          <div className="asteria-target-chips">
            {TARGET_PARAM_CHOICES.map(({ id, label }) => {
              const on = targetParams.includes(id)
              return (
                <button
                  key={id}
                  type="button"
                  className={`asteria-target-chip ${on ? 'active' : ''}`}
                  disabled={driftReadOnly}
                  title={`${id}${on ? ' — activo' : ''}`}
                  onClick={() =>
                    setTargetParams(
                      on
                        ? targetParams.filter((p) => p !== id)
                        : [...targetParams, id],
                    )
                  }
                >
                  {label}
                </button>
              )
            })}
          </div>
          {/* 🌈 WAVE 8120 (M1): con CLR activo, el operador elige el
              color exacto — el pulso hornea su H/S y modula solo L. */}
          {targetParams.includes('color') && (
            <div className="asteria-target-color">
              <input
                type="color"
                value={targetColor}
                disabled={driftReadOnly}
                onChange={(e) => setTargetColor(e.target.value)}
                title="Color del pulso — H/S constantes, el campo modula Lightness"
              />
              <span className="asteria-rail__stat asteria-target-color__hex">
                {targetColor.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* 🜨 WAVE 8040B (T7): banda de estado del Cell Surgeon — §T7
            exige MCC-Cell/MCC-Z explícito, nunca una promesa falsa. */}
        {(activeToolId === 'cell' || surgeonDeviceId !== null) && (
          <div className="asteria-rail__section">
            <div className="asteria-rail__title">CELL SURGEON</div>
            <div
              className={`asteria-rail__stat ${MCC_CELL_AVAILABLE ? '' : 'asteria-rail__muted'}`}
              title={MCC_CELL_AVAILABLE ? undefined : MCC_CELL_UNAVAILABLE_TOOLTIP}
            >
              {MCC_CELL_AVAILABLE ? 'MCC-Cell · Δ1–Δ3' : 'MCC-Z · por zona'}
            </div>
            {surgeonDeviceId ? (
              <>
                <div className="asteria-rail__muted">🔪 {surgeonDeviceId}</div>
                <div className="asteria-rail__muted">
                  {atlas?.entries.filter((e) => e.deviceId === surgeonDeviceId)
                    .length ?? 0}{' '}
                  celdas
                </div>
              </>
            ) : (
              <div className="asteria-rail__muted">
                doble clic en un fixture compuesto
              </div>
            )}
          </div>
        )}

        {/* 🜨 WAVE 8050 (T5): HUD de legibilidad del glifo — resolución
            efectiva bajo el área del texto; aviso honesto por debajo
            del umbral de la fuente 5×7. */}
        {lastGlyph && glyphLegibility && (
          <div className="asteria-rail__section">
            <div className="asteria-rail__title">GLYPH</div>
            <div className="asteria-rail__stat">
              "{lastGlyph.text ?? ''}" · {lastGlyph.channel.toUpperCase()}
            </div>
            <div className="asteria-rail__muted">
              {glyphLegibility.nodesPerMeter.toFixed(1)} nodos/m ·{' '}
              {glyphLegibility.rowsResolved}/7 filas ·{' '}
              {glyphLegibility.colsResolved} cols
            </div>
            {!glyphLegibility.legible && (
              <div className="asteria-rail__error">
                ⚠ Resolución insuficiente para texto legible
              </div>
            )}
          </div>
        )}

        <div className="asteria-rail__section">
          <div className="asteria-rail__title">COMPILE</div>
          {compileReport ? (
            <>
              <div className="asteria-rail__stat">
                {(compileReport.bytes / 1024).toFixed(1)} KB ·{' '}
                {compileReport.trackIds.length} pista(s) ·{' '}
                {compileReport.nodesCovered} nodos ·{' '}
                {compileReport.keyframeCount} kfs
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
