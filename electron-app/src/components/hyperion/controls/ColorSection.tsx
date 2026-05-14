/**
 * 🎨 COLOR SECTION — WAVE 4726: ATOMIC WIRING
 * Color control. Lee y escribe directamente en el programmer store vía ctx.cellKey.
 */

import React, { useCallback, useRef } from 'react'
import { NodeFamily } from '../../../stores/programmer-types'
import type { CapabilityContext, CellKey, EmbeddedImpactChannelType } from '../../../stores/programmer-types'
import { useProgrammerStore } from '../../../stores/programmerStore'
import { ColorIcon } from '../../icons/LuxIcons'
import { InlineImpactRow } from './InlineImpactRow'

export interface ColorSectionProps {
  ctx: CapabilityContext<NodeFamily.COLOR>
  peerCellKeys?: readonly CellKey[]
  isExpanded: boolean
  onToggle: () => void
}

/**
 * Quick color presets (pure colors)
 */
const QUICK_COLORS = [
  { label: 'R', color: { r: 255, g: 0, b: 0 } },
  { label: 'G', color: { r: 0, g: 255, b: 0 } },
  { label: 'B', color: { r: 0, g: 0, b: 255 } },
  { label: 'W', color: { r: 255, g: 255, b: 255 } },
  { label: 'Y', color: { r: 255, g: 255, b: 0 } },
  { label: 'C', color: { r: 0, g: 255, b: 255 } },
  { label: 'M', color: { r: 255, g: 0, b: 255 } },
]

function clamp255(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clamp255(n).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return { r: 255, g: 255, b: 255 }
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  return {
    r: Number.isFinite(r) ? r : 255,
    g: Number.isFinite(g) ? g : 255,
    b: Number.isFinite(b) ? b : 255,
  }
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360
  const ss = Math.max(0, Math.min(1, s))
  const ll = Math.max(0, Math.min(1, l))

  const c = (1 - Math.abs(2 * ll - 1)) * ss
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = ll - c / 2

  let r1 = 0
  let g1 = 0
  let b1 = 0

  if (hh < 60) {
    r1 = c; g1 = x; b1 = 0
  } else if (hh < 120) {
    r1 = x; g1 = c; b1 = 0
  } else if (hh < 180) {
    r1 = 0; g1 = c; b1 = x
  } else if (hh < 240) {
    r1 = 0; g1 = x; b1 = c
  } else if (hh < 300) {
    r1 = x; g1 = 0; b1 = c
  } else {
    r1 = c; g1 = 0; b1 = x
  }

  return {
    r: clamp255((r1 + m) * 255),
    g: clamp255((g1 + m) * 255),
    b: clamp255((b1 + m) * 255),
  }
}

export const ColorSection: React.FC<ColorSectionProps> = ({ ctx, peerCellKeys, isExpanded, onToggle }) => {
  const nativePickerRef = useRef<HTMLInputElement>(null)
  const ov = useProgrammerStore(s => s.cellOverrides.get(ctx.cellKey))
  const data = ov?.payload.family === NodeFamily.COLOR ? ov.payload.data : {}

  const r = data.r !== undefined ? Math.round(data.r * 255) : null
  const g = data.g !== undefined ? Math.round(data.g * 255) : null
  const b = data.b !== undefined ? Math.round(data.b * 255) : null
  const hasOverride = data.r !== undefined || data.g !== undefined || data.b !== undefined

  const safeColor = { r: r ?? 0, g: g ?? 0, b: b ?? 0 }
  const isMixedColor = r === null || g === null || b === null

  // WAVE 4731: Hive Mind — dispatch simultáneo a todas las células del grupo
  const applyColor = useCallback((r: number, g: number, b: number) => {
    const store = useProgrammerStore.getState()
    store.setCellColor(ctx.cellKey, r, g, b)
    if (peerCellKeys) for (const k of peerCellKeys) store.setCellColor(k, r, g, b)
  }, [ctx.cellKey, peerCellKeys])

  const applyRelease = useCallback(() => {
    const store = useProgrammerStore.getState()
    store.releaseCell(ctx.cellKey)
    if (peerCellKeys) for (const k of peerCellKeys) store.releaseCell(k)
  }, [ctx.cellKey, peerCellKeys])

  const handleRGBChange = useCallback((channel: 'r' | 'g' | 'b', value: number) => {
    const newColor = { ...safeColor, [channel]: value }
    applyColor(newColor.r, newColor.g, newColor.b)
  }, [safeColor, applyColor])

  const handleQuickColorClick = useCallback((quickColor: typeof QUICK_COLORS[0]) => {
    applyColor(quickColor.color.r, quickColor.color.g, quickColor.color.b)
  }, [applyColor])

  const handleRelease = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    applyRelease()
  }, [applyRelease])

  const handleOpenNativePicker = useCallback(() => {
    nativePickerRef.current?.click()
  }, [])

  const handleNativePickerChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = hexToRgb(e.target.value)
    applyColor(parsed.r, parsed.g, parsed.b)
  }, [applyColor])

  const handleHueStripChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const hue = Number(e.target.value)
    const vivid = hslToRgb(hue, 1, 0.5)
    applyColor(vivid.r, vivid.g, vivid.b)
  }, [applyColor])

  const previewColor = `rgb(${safeColor.r}, ${safeColor.g}, ${safeColor.b})`
  const previewHex = rgbToHex(safeColor.r, safeColor.g, safeColor.b)
  
  return (
    <div className={`programmer-section color-section ${hasOverride ? 'has-override' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="section-header clickable" onClick={onToggle}>
        <h4 className="section-title">
          <span className="section-icon">{isExpanded ? '▼' : '▶'}</span>
          <ColorIcon size={18} className="title-icon" />
          COLOR
          <span className="section-node-label" style={{ color: 'var(--neon-base)' }}>: {ctx.label.toUpperCase()}</span>
        </h4>
        <div className="header-right">
          {hasOverride && (
            <button 
              className="release-btn"
              onClick={handleRelease}
              title="Release to AI control"
            >
              ↺
            </button>
          )}
        </div>
      </div>
      
      {isExpanded && (
        <>
          {/* Compact active color + infinite picker */}
          <div className="color-preview-container">
            <div className="color-preview-main">
              <button
                className="color-preview-swatch"
                onClick={handleOpenNativePicker}
                style={isMixedColor
                  ? { background: 'linear-gradient(135deg, #ff3366 0%, #ff3366 33%, #10141d 33%, #10141d 66%, #36d1ff 66%, #36d1ff 100%)' }
                  : { backgroundColor: previewColor }}
                title="Open color wheel"
                type="button"
              />
              <input
                ref={nativePickerRef}
                type="color"
                className="native-color-input"
                value={previewHex}
                onChange={handleNativePickerChange}
                aria-label="Color wheel"
              />
              <div className="color-values">
                <span>R: {r ?? '-'}</span>
                <span>G: {g ?? '-'}</span>
                <span>B: {b ?? '-'}</span>
                <span>HEX: {isMixedColor ? '-' : previewHex.toUpperCase()}</span>
              </div>
            </div>

            <div className="hue-strip-wrap floating">
              <label className="hue-strip-label">RAINBOW PALETTE</label>
              <input
                type="range"
                min={0}
                max={360}
                defaultValue={0}
                onChange={handleHueStripChange}
                className="hue-strip"
              />
            </div>
          </div>

          <div className="quick-colors">
            {QUICK_COLORS.map((qc, i) => (
              <button
                key={i}
                className="quick-color-btn"
                onClick={() => handleQuickColorClick(qc)}
                style={{
                  backgroundColor: `rgb(${qc.color.r}, ${qc.color.g}, ${qc.color.b})`,
                }}
                title={qc.label}
              >
                {qc.label}
              </button>
            ))}
          </div>

          <div className="rgb-sliders">
            <div className="rgb-slider-row">
              <label className="rgb-label red">R</label>
              <input
                type="range"
                min={0}
                max={255}
                value={safeColor.r}
                onChange={(e) => handleRGBChange('r', Number(e.target.value))}
                className="rgb-slider red"
              />
              <span className="rgb-value">{r ?? '-'}</span>
            </div>

            <div className="rgb-slider-row">
              <label className="rgb-label green">G</label>
              <input
                type="range"
                min={0}
                max={255}
                value={safeColor.g}
                onChange={(e) => handleRGBChange('g', Number(e.target.value))}
                className="rgb-slider green"
              />
              <span className="rgb-value">{g ?? '-'}</span>
            </div>

            <div className="rgb-slider-row">
              <label className="rgb-label blue">B</label>
              <input
                type="range"
                min={0}
                max={255}
                value={safeColor.b}
                onChange={(e) => handleRGBChange('b', Number(e.target.value))}
                className="rgb-slider blue"
              />
              <span className="rgb-value">{b ?? '-'}</span>
            </div>
          </div>

          {hasOverride && (
            <div className="override-badge">MANUAL</div>
          )}
        </>
      )}
    </div>
  )
}

export default ColorSection

// ─────────────────────────────────────────────────────────────────────────────
// COLOR BODY — WAVE 4734 BATCH 2
// ─────────────────────────────────────────────────────────────────────────────
//
// Rueda de color + RGB sliders + hue strip sin accordion shell.
// Si el grupo contiene canales de impacto (dimmer/strobe en cell COLOR —
// patrón Tungsten petal), se inyecta <InlineImpactRow> debajo (§7 blueprint).

export interface ColorBodyProps {
  primaryKey: CellKey
  allCellKeys: readonly CellKey[]
  /**
   * WAVE 4743: Canales de intensidad embebidos en este nodo COLOR
   * (dimmer/strobe/shutter dentro del mismo nodo físico).
   * Cuando están presentes, los InlineImpactRow se muestran aunque
   * no exista override previo — el usuario ve los faders desde el principio.
   */
  embeddedImpactChannels?: ReadonlySet<EmbeddedImpactChannelType>
}

export const ColorBody: React.FC<ColorBodyProps> = ({ primaryKey, allCellKeys, embeddedImpactChannels }) => {
  const nativePickerRef = useRef<HTMLInputElement>(null)
  const ov   = useProgrammerStore(s => s.cellOverrides.get(primaryKey))
  const data = ov?.payload.family === NodeFamily.COLOR ? ov.payload.data : {}

  const r = data.r !== undefined ? Math.round(data.r * 255) : null
  const g = data.g !== undefined ? Math.round(data.g * 255) : null
  const b = data.b !== undefined ? Math.round(data.b * 255) : null
  const hasOverride  = data.r !== undefined || data.g !== undefined || data.b !== undefined
  const safeColor    = { r: r ?? 0, g: g ?? 0, b: b ?? 0 }
  const isMixedColor = r === null || g === null || b === null
  const previewColor = `rgb(${safeColor.r}, ${safeColor.g}, ${safeColor.b})`
  const previewHex   = rgbToHex(safeColor.r, safeColor.g, safeColor.b)

  const applyColor = useCallback((nr: number, ng: number, nb: number) => {
    const store = useProgrammerStore.getState()
    for (const k of allCellKeys) store.setCellColor(k, nr, ng, nb)
  }, [allCellKeys])

  const handleRGBChange = useCallback((ch: 'r' | 'g' | 'b', value: number) => {
    const next = { ...safeColor, [ch]: value }
    applyColor(next.r, next.g, next.b)
  }, [safeColor, applyColor])

  const handleHueStrip = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vivid = hslToRgb(Number(e.target.value), 1, 0.5)
    applyColor(vivid.r, vivid.g, vivid.b)
  }, [applyColor])

  // ── Canales de intensidad embebidos en ColorCellPayload (WAVE 4734-D) ──
  // WAVE 4743 FIX: Mostrar el fader si el nodo tiene canal dimmer/strobe/shutter
  // en su definición (embeddedImpactChannels), aunque el usuario aún no lo haya
  // tocado (override = undefined). Antes del fix: la fila permanecía invisible
  // hasta la primera interacción, causando que el dimmer pareciera inexistente.
  const dimmerVal  = data.dimmer  !== undefined ? Math.round(data.dimmer  * 100)
                   : embeddedImpactChannels?.has('dimmer')  ? 0 : undefined
  const strobeVal  = data.strobe  !== undefined ? Math.round(data.strobe  * 100)
                   : embeddedImpactChannels?.has('strobe')  ? 0 : undefined
  const shutterVal = data.shutter !== undefined ? Math.round(data.shutter * 100)
                   : embeddedImpactChannels?.has('shutter') ? 0 : undefined

  return (
    <>
      {/* Swatch + native picker */}
      <div className="color-preview-container">
        <div className="color-preview-main">
          <button
            className="color-preview-swatch"
            onClick={() => nativePickerRef.current?.click()}
            style={isMixedColor
              ? { background: 'linear-gradient(135deg, #ff3366 0%, #ff3366 33%, #10141d 33%, #10141d 66%, #36d1ff 66%, #36d1ff 100%)' }
              : { backgroundColor: previewColor }
            }
            title="Open color wheel"
            type="button"
          />
          <input
            ref={nativePickerRef}
            type="color"
            className="native-color-input"
            value={previewHex}
            onChange={e => { const p = hexToRgb(e.target.value); applyColor(p.r, p.g, p.b) }}
            aria-label="Color wheel"
          />
          <div className="color-values">
            <span>R: {r ?? '-'}</span>
            <span>G: {g ?? '-'}</span>
            <span>B: {b ?? '-'}</span>
            <span>HEX: {isMixedColor ? '-' : previewHex.toUpperCase()}</span>
          </div>
        </div>

        <div className="hue-strip-wrap floating">
          <label className="hue-strip-label">RAINBOW PALETTE</label>
          <input type="range" min={0} max={360} defaultValue={0}
            onChange={handleHueStrip} className="hue-strip"
          />
        </div>
      </div>

      <div className="quick-colors">
        {QUICK_COLORS.map((qc, i) => (
          <button key={i} className="quick-color-btn"
            onClick={() => applyColor(qc.color.r, qc.color.g, qc.color.b)}
            style={{ backgroundColor: `rgb(${qc.color.r}, ${qc.color.g}, ${qc.color.b})` }}
            title={qc.label}
          >
            {qc.label}
          </button>
        ))}
      </div>

      <div className="rgb-sliders">
        {(['r', 'g', 'b'] as const).map(ch => (
          <div key={ch} className="rgb-slider-row">
            <label className={`rgb-label ${ch === 'r' ? 'red' : ch === 'g' ? 'green' : 'blue'}`}>
              {ch.toUpperCase()}
            </label>
            <input
              type="range" min={0} max={255}
              value={safeColor[ch]}
              onChange={e => handleRGBChange(ch, Number(e.target.value))}
              className={`rgb-slider ${ch === 'r' ? 'red' : ch === 'g' ? 'green' : 'blue'}`}
            />
            <span className="rgb-value">{ch === 'r' ? r : ch === 'g' ? g : b}{ch === 'r' ? (r === null ? '-' : '') : ch === 'g' ? (g === null ? '-' : '') : (b === null ? '-' : '')}</span>
          </div>
        ))}
      </div>

      {hasOverride && <div className="override-badge">MANUAL</div>}

      {/* Canales de intensidad embebidos — blueprint §7.2 / WAVE 4734-D.
          Se muestran únicamente cuando el canal existe en el payload COLOR.
          Con valor 0 el slider aparece; sin override el canal no existe => fila oculta.
          WAVE 4743.5: Contenedor aislado para dar "breathing room" y evitar overlap. */}
      {(dimmerVal !== undefined || strobeVal !== undefined || shutterVal !== undefined) && (
        <div className="inline-impact-rows-wrapper">
          {dimmerVal !== undefined && (
            <InlineImpactRow
              primaryKey={primaryKey} allCellKeys={allCellKeys}
              channel="dimmer" label="Cell Dimmer" value={dimmerVal}
            />
          )}
          {strobeVal !== undefined && (
            <InlineImpactRow
              primaryKey={primaryKey} allCellKeys={allCellKeys}
              channel="strobe" label="Cell Strobe" value={strobeVal}
            />
          )}
          {shutterVal !== undefined && (
            <InlineImpactRow
              primaryKey={primaryKey} allCellKeys={allCellKeys}
              channel="shutter" label="Cell Shutter" value={shutterVal}
            />
          )}
        </div>
      )}
    </>
  )
}
