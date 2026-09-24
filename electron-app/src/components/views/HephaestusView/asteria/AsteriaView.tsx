/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 ASTERIA VIEW — WAVE 8020: EL TACTO (SELECCIÓN + PROTOCOLO POKE)
 *
 * Layout interno del Pixel Mapper (blueprint §Arquitectura):
 *
 *   ┌──────────────────────────────────────┬────────────────┐
 *   │  TACTICAL CANVAS <AsteriaCanvas />   │  STACK + INSP. │
 *   │  + TOOLBOX flotante (HUD, left 12px) │  (380px)       │
 *   └──────────────────────────────────────┴────────────────┘
 *
 * WAVE 8020:
 *   - Toolbox con Select (V) · Lasso (L) · Radial (R) + kill-switch POKE.
 *   - useAsteriaTouch montado: hover ∪ selección → CalibrationBus →
 *     L3++ real. Heartbeat 400 ms, fade-out 180 ms, Esc libera.
 *   - Badge POKE ACTIVE al pie del rail.
 *
 * WAVE 8202:
 *   - La telemetría NODE ATLAS / SELECCIÓN sale del rail y vive en el
 *     HUDOverlay flotante sobre el canvas (`300 nodes · 0 selected`).
 *   - El bloque DEFAULT PAINT muere: los gestos son autónomos (paint +
 *     synth propios) — el rail queda STACK → CELL SURGEON → INSPECTOR.
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
import { GestureInspector } from './GestureInspector'
import { HUDOverlay } from './HUDOverlay'
import { CompileLogDock } from './CompileLogDock'
import LuxIcon, { type LuxIconName } from '../../../icons/LuxIcon'
import {
  MCC_CELL_AVAILABLE,
  MCC_CELL_UNAVAILABLE_TOOLTIP,
} from './mccCapability'
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
  // Selección / geometría libre
  'select', 'lasso', 'radial', 'polygon', 'line',
  // Generadores de campo (WAVE 8182 — el arsenal completo del §7)
  'wavefront', 'chrono', 'glyph', 'slicer', 'noise',
  // Cirugía celular
  'cell',
]

/**
 * 🜨 WAVE 8204 (M1): LUXICONS STRICT MODE — cada tool mapea al SVG
 * custom más cercano de la librería interna (trazos gruesos, cero
 * glyphs unicode / librerías genéricas).
 */
const TOOL_ICON: Record<AsteriaToolId, LuxIconName> = {
  select: 'cursor',
  lasso: 'lasso',
  radial: 'radial',
  polygon: 'polygon',
  line: 'line',
  wavefront: 'wavefront',
  chrono: 'chrono',
  glyph: 'glyph',
  slicer: 'slicer',
  noise: 'noise',
  cell: 'surgeon',
}

/**
 * 🜨 WAVE 8204 (M3): familias cromáticas — el estado activo del botón
 * tiñe con el color de su familia (modificadores acero, generadores
 * espaciales cian, temporales magenta, especiales ácido/tóxico).
 */
type AsteriaToolFamily = 'mod' | 'spatial' | 'temporal' | 'special' | 'toxic'

const TOOL_FAMILY: Record<AsteriaToolId, AsteriaToolFamily> = {
  // Modificadores / selección — blanco táctico / gris acero
  select: 'mod',
  lasso: 'mod',
  radial: 'mod',
  polygon: 'mod',
  line: 'mod',
  // Generadores espaciales — geometría estricta, cian láser
  wavefront: 'spatial',
  slicer: 'spatial',
  // Generadores temporales — orgánico / tiempo humano, magenta
  chrono: 'temporal',
  noise: 'temporal',
  // Especiales — amarillo ácido / verde tóxico
  glyph: 'special',
  cell: 'toxic',
}

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
  const heatEnabled = useAsteriaStore((s) => s.heatEnabled)
  const setHeatEnabled = useAsteriaStore((s) => s.setHeatEnabled)
  const selectionCount = useAsteriaStore((s) => s.selectionNodeIds.size)
  const hoverCount = useAsteriaStore((s) => s.hoverNodeIds.size)
  const touchLive = selectionCount + hoverCount
  const surgeonDeviceId = useAsteriaStore((s) => s.surgeonDeviceId)

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
      {/* ── LIENZO TÁCTICO ── */}
      <AsteriaCanvas preview={preview}>
        {/* 🜨 WAVE 8204 (M5): THE SHELL — toolbox como HUD flotante
            sobre el grid espacial (absoluto, blur, fuera del flujo
            del grid). Cada botón lleva su familia cromática en
            data-family y su LuxIcon; tooltips `Label [ K ]`. */}
        <div className="asteria-toolbox" aria-label="Asteria tools">
          {TOOL_ORDER.map((id) => {
            const tool = getTool(id)
            if (!tool) return null
            const active = activeToolId === id
            return (
              <button
                key={id}
                type="button"
                data-family={TOOL_FAMILY[id]}
                className={`asteria-tool-btn ${active ? 'active' : ''}`}
                title={`${tool.label} [ ${tool.hotkey.toUpperCase()} ]`}
                onClick={() => {
                  getTool(useAsteriaStore.getState().activeToolId)?.cancel?.()
                  setActiveTool(id)
                }}
              >
                <span className="asteria-tool-btn__icon">
                  <LuxIcon name={TOOL_ICON[id]} size={22} color="currentColor" />
                </span>
              </button>
            )
          })}
          <div className="asteria-toolbox__divider" />
          <button
            type="button"
            data-family="special"
            className={`asteria-tool-btn ${heatEnabled ? 'active' : ''}`}
            title={`HEAT ${heatEnabled ? 'ON' : 'OFF'} — delay heatmap + 250/100 ms isochrones (FieldLayer)`}
            aria-pressed={heatEnabled}
            onClick={() => setHeatEnabled(!heatEnabled)}
          >
            <span className="asteria-tool-btn__icon">
              <LuxIcon name="heat" size={22} color="currentColor" />
            </span>
          </button>
          <button
            type="button"
            data-family="toxic"
            className={`asteria-tool-btn ${pokeEnabled ? 'active' : ''}`}
            title={`POKE ${pokeEnabled ? 'ON' : 'OFF'} — physical touch via L3++ (kill-switch)`}
            aria-pressed={pokeEnabled}
            onClick={() => setPokeEnabled(!pokeEnabled)}
          >
            <span className="asteria-tool-btn__icon">
              <LuxIcon name="poke" size={22} color="currentColor" />
            </span>
          </button>
        </div>

        {/* 🜨 WAVE 8202 (M1): HUD de telemetría — atlas + selección en
            badge flotante top-left; libera el rail para stack/inspector */}
        <HUDOverlay loading={loading} error={error} />
        {/* 🜨 WAVE 8150-F2: drawer de transporte — overlay inferior del
            canvas; el scrub alimenta FeedbackLayer vía previewDataRef */}
        <AsteriaTransportDrawer preview={preview} />
      </AsteriaCanvas>

      {/* ── RAIL: stack + inspector + badge POKE ── */}
      <div className="asteria-side-rail" aria-label="Gesture stack">
        {/* 🜨 WAVE 8055: panel de capas (selección/eliminar/reset) */}
        <GestureStackPanel />

        {/* 🜨 WAVE 8040B (T7): banda de estado del Cell Surgeon — §T7
            exige MCC-Cell/MCC-Z explícito, nunca una promesa falsa. */}
        {(activeToolId === 'cell' || surgeonDeviceId !== null) && (
          <div className="asteria-rail__section">
            <div className="asteria-rail__title">CELL SURGEON</div>
            <div
              className={`asteria-rail__stat ${MCC_CELL_AVAILABLE ? '' : 'asteria-rail__muted'}`}
              title={MCC_CELL_AVAILABLE ? undefined : MCC_CELL_UNAVAILABLE_TOOLTIP}
            >
              {MCC_CELL_AVAILABLE ? 'MCC-Cell · Δ1–Δ3' : 'MCC-Z · per zone'}
            </div>
            {surgeonDeviceId ? (
              <>
                <div className="asteria-rail__muted">🔪 {surgeonDeviceId}</div>
                <div className="asteria-rail__muted">
                  {atlas?.entries.filter((e) => e.deviceId === surgeonDeviceId)
                    .length ?? 0}{' '}
                  cells
                </div>
              </>
            ) : (
              <div className="asteria-rail__muted">
                double-click a compound fixture
              </div>
            )}
          </div>
        )}

        {/* 🜨 WAVE 8181 (M1): el espacio liberado por COMPILE/GLYPH
            queda reservado al INSPECTOR — edición paramétrica no
            destructiva del gesto seleccionado (blueprint §6.2). La
            legibilidad del glyph vive ahora dentro del inspector; los
            datos de compilación migraron al HUD BUDGET del transporte. */}
        <GestureInspector />

        {touchLive > 0 && pokeEnabled && (
          <div className="asteria-poke-badge">⚡ POKE ACTIVE · {touchLive} nodes</div>
        )}

        {/* 🜨 WAVE 8203 (M2): logger en cuarentena — mini-terminal
            acoplada al fondo del rail; el canvas ya no se tapa. Los
            warnings del compilador viven aquí, no en el transporte. */}
        <CompileLogDock />
      </div>
    </div>
  )
}
