/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📤 OUTPUT DMX CONFIG PANEL — WAVE 4548.8c / 8411-C
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React, { useEffect, useState } from 'react'
import type { IOutputDmxConfig } from '../../../../../core/forge/types'
import type { ConfigPanelProps } from '../configPanelRegistry'
import './ConfigPanel.css'

const CHANNEL_TYPES = [
  'dimmer', 'red', 'green', 'blue', 'white', 'amber', 'uv',
  'pan', 'pan_fine', 'tilt', 'tilt_fine',
  'shutter', 'strobe', 'zoom', 'focus', 'gobo', 'prism',
  'color_wheel', 'speed', 'macro', 'control', 'rotation', 'custom',
]

// 🌗 WAVE 8411-C: canales de mezcla electrónica — el único contexto donde
// maxVirtualDim tiene efecto (espejo de ELECTRONIC_COLOR_CHANNELS en el
// NodeResolver). 'dimmer' y 'color_wheel' quedan fuera: el cap no los toca.
const COLOR_MIX_CHANNEL_TYPES = new Set<IOutputDmxConfig['channelType']>([
  'red', 'green', 'blue', 'white', 'amber', 'uv', 'cyan', 'magenta', 'yellow',
])

// % UI (0–100) ↔ fracción JSON (0.0–1.0). 100% = sin cap → la propiedad se
// retira del config (unset = uncapped, mantiene el JSON mínimo).
// El clamp va en UNIDADES DE PORCENTAJE (0–100), no en fracción.
export const pctToDim = (pct: number): number | undefined => {
  const clamped = Math.min(100, Math.max(0, pct))
  return clamped >= 100 ? undefined : clamped / 100
}

// 🌗 WAVE 8411-E: % UI ↔ fracción JSON para el SUELO. Semántica inversa al
// cap: 0% = sin floor → propiedad retirada (el cero es el no-op natural).
export const pctToFloor = (pct: number): number | undefined => {
  const clamped = Math.min(100, Math.max(0, pct))
  return clamped <= 0 ? undefined : clamped / 100
}

// Input numérico del cap: draft local para que el usuario pueda teclear
// "39.2" sin que el valor derivado le reescriba el campo a mitad de número.
const CapPercentInput: React.FC<{
  pct: number
  onCommit: (pct: number) => void
}> = ({ pct, onCommit }) => {
  const [text, setText] = useState(String(pct))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(String(pct))
  }, [pct, focused])

  const commit = (raw: string) => {
    const v = Number(raw.replace(',', '.'))
    if (!Number.isNaN(v)) onCommit(v)
    else setText(String(pct))
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      className="cp-input"
      style={{ width: 56 }}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        setFocused(false)
        commit(e.target.value)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      onChange={(e) => setText(e.target.value)}
    />
  )
}

export const OutputDmxConfigPanel: React.FC<ConfigPanelProps<IOutputDmxConfig>> = ({
  config,
  onChange,
}) => (
  <div className="config-panel">
    <div className="cp-field">
      <label className="cp-label">Channel Type</label>
      <select
        className="cp-select"
        value={config.channelType}
        onChange={(e) =>
          onChange({ channelType: e.target.value as IOutputDmxConfig['channelType'] })
        }
      >
        {CHANNEL_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>

    <div className="cp-field">
      <label className="cp-label">DMX Offset</label>
      <input
        type="number"
        className="cp-input"
        value={config.dmxOffset}
        min={0}
        max={511}
        step={1}
        onChange={(e) => onChange({ dmxOffset: parseInt(e.target.value, 10) })}
      />
    </div>

    <div className="cp-field">
      <label className="cp-label">Default (0–255)</label>
      <input
        type="number"
        className="cp-input"
        value={config.defaultDmxValue}
        min={0}
        max={255}
        step={1}
        onChange={(e) => onChange({ defaultDmxValue: parseInt(e.target.value, 10) })}
      />
    </div>

    <div className="cp-field">
      <label className="cp-label">16-bit</label>
      <label className="cp-toggle">
        <input
          type="checkbox"
          checked={!!config.is16bit}
          onChange={(e) => onChange({ is16bit: e.target.checked })}
        />
        <span className="cp-toggle__track" />
        <span className="cp-toggle__text">{config.is16bit ? 'YES' : 'NO'}</span>
      </label>
    </div>

    {config.channelType === 'custom' && (
      <div className="cp-field">
        <label className="cp-label">Channel Name</label>
        <input
          type="text"
          className="cp-input"
          value={config.channelName ?? ''}
          maxLength={32}
          onChange={(e) => onChange({ channelName: e.target.value })}
        />
      </div>
    )}

    {/*
      🌗 WAVE 8411-C: INTENSITY CAP (HUE PRESERVED) — control nativo del
      maxVirtualDim del nodo (WAVE 8411-B). Solo canales de mezcla electrónica:
      el cap escala TODOS los canales de la celda proporcionalmente desde un
      escalar único → la colorimetría no se degrada (vs clampMax por canal).
      Se guarda como fracción 0.0–1.0 en config.maxVirtualDim; 100% retira la
      propiedad (sin cap). El backend agrupa por celda — el valor más bajo
      declarado entre sus canales gana. Si la celda tiene un canal dimmer
      físico el cap se ignora (el dimmer real gobierna).
    */}
    {COLOR_MIX_CHANNEL_TYPES.has(config.channelType) && (
      <div className="cp-field">
        <label className="cp-label">Max Virtual Dimmer</label>
        <div className="cp-row" style={{ alignItems: 'center' }}>
          <input
            type="range"
            className="cp-range"
            min={0}
            max={100}
            step={1}
            value={Math.round((config.maxVirtualDim ?? 1) * 100)}
            onChange={(e) =>
              onChange({ maxVirtualDim: pctToDim(Number(e.target.value)) })
            }
          />
          <CapPercentInput
            pct={Math.round((config.maxVirtualDim ?? 1) * 1000) / 10}
            onCommit={(pct) =>
              onChange({ maxVirtualDim: pctToDim(pct) })
            }
          />
          <span className="cp-range__value">%</span>
        </div>
        <span className="cp-label" style={{ textTransform: 'none' }}>
          Hue preserved — applies to the whole cell (lowest wins)
        </span>
      </div>
    )}

    {/*
      🌗 WAVE 8411-E: INTENSITY FLOOR — suelo del dimmer virtual. Con floor
      declarado, el dominio activo (0,1] del control se remapea a
      [floor, cap]: el travel completo cubre solo la banda visible del
      driver (deadzone clearing). 0 sigue siendo blackout. Sin floor el
      cap se comporta como ceiling puro (legacy).
    */}
    {COLOR_MIX_CHANNEL_TYPES.has(config.channelType) && (
      <div className="cp-field">
        <label className="cp-label">Min Virtual Dimmer</label>
        <div className="cp-row" style={{ alignItems: 'center' }}>
          <input
            type="range"
            className="cp-range"
            min={0}
            max={100}
            step={1}
            value={Math.round((config.minVirtualDim ?? 0) * 100)}
            onChange={(e) =>
              onChange({ minVirtualDim: pctToFloor(Number(e.target.value)) })
            }
          />
          <CapPercentInput
            pct={Math.round((config.minVirtualDim ?? 0) * 1000) / 10}
            onCommit={(pct) =>
              onChange({ minVirtualDim: pctToFloor(pct) })
            }
          />
          <span className="cp-range__value">%</span>
        </div>
        <span className="cp-label" style={{ textTransform: 'none' }}>
          Deadzone floor — remaps the range to [floor, cap] (highest wins)
        </span>
      </div>
    )}
  </div>
)
