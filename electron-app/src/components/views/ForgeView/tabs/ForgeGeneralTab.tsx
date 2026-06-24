/**
 * ForgeGeneralTab.tsx - Pestaña General extraída de FixtureForgeEmbedded.tsx
 */

import React, { type ReactNode } from 'react'
import { Server, Factory, Sliders, Cpu, Cog, Palette } from 'lucide-react'
import {
  type FixtureDefinition,
  type FixtureChannel,
  type ColorEngineType,
  type DerivedCapabilities,
  type ChannelType,
  type FixtureType,
  deriveCapabilitiesUnified,
} from '../../../../types/FixtureDefinition'
import {
  type IForgeBuilderState,
  type ForgeAction,
} from '../../../../core/forge/forgeBuilderState'

export interface ForgeGeneralTabProps {
  meta: IForgeBuilderState['meta']
  wheels: IForgeBuilderState['wheels']
  physics: IForgeBuilderState['physics']
  channels: readonly FixtureChannel[]
  dispatch: React.Dispatch<ForgeAction>
  buildCompleteFixture: (state?: IForgeBuilderState) => FixtureDefinition
}

interface FixtureTypeConfig {
  value: FixtureType
  label: string
  icon: ReactNode
  color: string
}

const FIXTURE_TYPES: FixtureTypeConfig[] = [
  {
    value: 'moving-head',
    label: 'Moving Head',
    color: '#22d3ee',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M8 14l-2 8M16 14l2 8M10 12v4M14 12v4"/></svg>,
  },
  {
    value: 'scanner',
    label: 'Scanner',
    color: '#a855f7',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="12" height="8" rx="1"/><path d="M12 12v6M8 22h8M12 18l4 4M12 18l-4 4"/></svg>,
  },
  {
    value: 'par',
    label: 'Par',
    color: '#ef4444',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>,
  },
  {
    value: 'bar',
    label: 'LED Bar',
    color: '#22c55e',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="8" width="20" height="8" rx="2"/><line x1="6" y1="10" x2="6" y2="14"/><line x1="10" y1="10" x2="10" y2="14"/><line x1="14" y1="10" x2="14" y2="14"/><line x1="18" y1="10" x2="18" y2="14"/></svg>,
  },
  {
    value: 'wash',
    label: 'Wash',
    color: '#3b82f6',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="10" rx="8" ry="5"/><path d="M4 10c0 6 8 10 8 10s8-4 8-10"/></svg>,
  },
  {
    value: 'strobe',
    label: 'Strobe',
    color: '#fbbf24',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  },
  {
    value: 'effect',
    label: 'Effect',
    color: '#ec4899',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2 7h7l-5.5 4 2 7-5.5-4-5.5 4 2-7L3 9h7z"/></svg>,
  },
  {
    value: 'laser',
    label: 'Laser',
    color: '#14b8a6',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h4M18 12h4M12 2v4M12 18v4"/><circle cx="12" cy="12" r="3"/><path d="M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>,
  },
  {
    value: 'blinder',
    label: 'Blinder',
    color: '#f97316',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="8" height="12" rx="1"/><rect x="13" y="6" width="8" height="12" rx="1"/><circle cx="7" cy="12" r="2" fill="currentColor"/><circle cx="17" cy="12" r="2" fill="currentColor"/></svg>,
  },
  {
    value: 'generic',
    label: 'Generic',
    color: '#71717a',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/></svg>,
  },
  {
    value: 'fan',
    label: 'Fan',
    color: '#38bdf8',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="2"/><path d="M12 2C8 2 8 8 12 10C16 8 16 2 12 2z"/><path d="M22 12C22 8 16 8 14 12C16 16 22 16 22 12z"/><path d="M12 22C16 22 16 16 12 14C8 16 8 22 12 22z"/><path d="M2 12C2 16 8 16 10 12C8 8 2 8 2 12z"/></svg>,
  },
  {
    value: 'fog',
    label: 'Fog/Haze',
    color: '#94a3b8',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M3 11c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>,
  },
  {
    value: 'mirror-ball',
    label: 'Mirror Ball',
    color: '#c084fc',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8"/><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/><line x1="8" y1="4" x2="8" y2="20"/><line x1="16" y1="4" x2="16" y2="20"/></svg>,
  },
  {
    value: 'pyro',
    label: 'Pyro',
    color: '#f43f5e',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22c-4 0-7-3-7-7 0-6 7-13 7-13s7 7 7 13c0 4-3 7-7 7z"/><path d="M12 22c-2 0-3-2-3-4 0-3 3-7 3-7s3 4 3 7c0 2-1 4-3 4z"/></svg>,
  },
]

interface CapabilityBadge {
  key: keyof DerivedCapabilities
  label: string
  icon: ReactNode
  color: string
}

const CAPABILITY_BADGES: CapabilityBadge[] = [
  { key: 'hasPanTilt', label: 'PAN/TILT', color: '#22d3ee', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v8M12 22v-8M2 12h8M22 12h-8"/><circle cx="12" cy="12" r="3"/></svg> },
  { key: 'hasColorMixing', label: 'COLOR MIX', color: '#ef4444', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="10" r="5"/><circle cx="16" cy="10" r="5"/><circle cx="12" cy="16" r="5"/></svg> },
  { key: 'hasColorWheel', label: 'WHEEL', color: '#a855f7', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="6" r="2"/><circle cx="17" cy="14" r="2"/><circle cx="7" cy="14" r="2"/></svg> },
  { key: 'hasGobos', label: 'GOBO', color: '#fbbf24', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg> },
  { key: 'hasPrism', label: 'PRISM', color: '#ec4899', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 22 20 2 20"/></svg> },
  { key: 'hasZoom', label: 'ZOOM', color: '#3b82f6', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/><path d="M8 11h6M11 8v6"/></svg> },
  { key: 'hasFocus', label: 'FOCUS', color: '#14b8a6', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="10"/></svg> },
  { key: 'hasShutter', label: 'SHUTTER', color: '#f97316', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
  { key: 'hasDimmer', label: 'DIMMER', color: '#71717a', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg> },
  { key: 'is16bit', label: '16-BIT', color: '#22c55e', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="6" width="16" height="12" rx="2"/><text x="12" y="15" fontSize="8" fill="currentColor" textAnchor="middle">16</text></svg> },
]

const COLOR_ENGINE_OPTIONS: { value: ColorEngineType; label: string; description: string; icon: ReactNode }[] = [
  {
    value: 'rgb',
    label: 'RGB LEDs',
    description: 'Red/Green/Blue mixing (PARs, Washes)',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="5"/><circle cx="8" cy="16" r="5"/><circle cx="16" cy="16" r="5"/></svg>,
  },
  {
    value: 'rgbw',
    label: 'RGBW LEDs',
    description: 'RGB + White LED',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="4"/><circle cx="16" cy="8" r="4"/><circle cx="8" cy="16" r="4"/><circle cx="16" cy="16" r="4"/></svg>,
  },
  {
    value: 'wheel',
    label: 'Color Wheel',
    description: 'Mechanical wheel (Beams, Spots)',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M5.6 18.4L18.4 5.6"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>,
  },
  {
    value: 'cmy',
    label: 'CMY Mixing',
    description: 'Cyan/Magenta/Yellow flags',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="16" r="5"/><circle cx="8" cy="8" r="5"/><circle cx="16" cy="8" r="5"/></svg>,
  },
  {
    value: 'hybrid',
    label: 'Hybrid',
    description: 'Wheel + LEDs combined',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="12" r="6"/><circle cx="18" cy="12" r="3"/><path d="M8 6v12M2 12h12"/></svg>,
  },
  {
    value: 'none',
    label: 'No Color',
    description: 'Dimmer only (Strobes, etc)',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
  },
]

const CATEGORY_COLORS: Record<string, string> = {
  INTENSITY: '#a0a0a0',
  COLOR: '#ef4444',
  POSITION: '#22d3ee',
  BEAM: '#f59e0b',
  CONTROL: '#a855f7',
}

export function getChannelCategory(type: ChannelType): string {
  if (['dimmer', 'shutter', 'strobe'].includes(type)) return 'intensity'
  if (['red', 'green', 'blue', 'white', 'amber', 'uv', 'color_wheel', 'cyan', 'magenta', 'yellow'].includes(type)) return 'color'
  if (['pan', 'pan_fine', 'tilt', 'tilt_fine'].includes(type)) return 'position'
  if (['gobo', 'gobo_rotation', 'prism', 'prism_rotation', 'focus', 'zoom', 'iris', 'frost'].includes(type)) return 'beam'
  if (['speed', 'macro', 'control', 'effect', 'reset'].includes(type)) return 'control'
  return ''
}

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category.toUpperCase()] || ''
}

export function ForgeGeneralTab({
  meta,
  wheels,
  physics,
  channels,
  dispatch,
  buildCompleteFixture,
}: ForgeGeneralTabProps): React.ReactElement {
  return (
    <div className="forge-general-panel cockpit-layout">
      {/*
          SECTION A: IDENTITY & CLASSIFICATION (LEFT COLUMN)
      */}

      <div className="cockpit-identity">
        <div className="cockpit-section-header">
          <Factory size={16} />
          <span>IDENTITY</span>
        </div>

        <div className="cockpit-form">
          <div className="cockpit-input-group">
            <label>Manufacturer</label>
            <input
              type="text"
              placeholder="ADJ, Chauvet, Martin..."
              value={meta.manufacturer || ''}
              onChange={(e) => dispatch({ type: 'META_SET_MANUFACTURER', manufacturer: e.target.value })}
            />
          </div>

          {/* HOTFIX WAVE 2070.1: Restauracion del Selector de Canales
              El input de totalChannels se perdio durante la migracion al diseño Cockpit.
              Se incrusta junto a Model Name en un flex row para no romper el layout. */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="cockpit-input-group" style={{ flex: 1 }}>
              <label>Model Name *</label>
              <input
                type="text"
                placeholder="Vizi Beam 5RX"
                value={meta.name || ''}
                onChange={(e) => dispatch({ type: 'META_SET_NAME', name: e.target.value })}
              />
            </div>

            <div className="cockpit-input-group" style={{ width: '70px' }}>
              <label>CHs</label>
              <input
                type="number"
                min="1"
                max="512"
                value={meta.channelCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value)
                  if (!isNaN(val)) dispatch({ type: 'META_SET_CHANNEL_COUNT', channelCount: Math.min(512, Math.max(1, val)) })
                }}
                style={{ textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>
          </div>
        </div>

        {/* VISUAL TYPE SELECTOR - Grid of icons */}
        <div className="cockpit-section-header" style={{ marginTop: '16px' }}>
          <Cpu size={16} />
          <span>FIXTURE CLASS</span>
        </div>

        <div className="type-selector-grid">
          {FIXTURE_TYPES.map(typeConfig => (
            <button
              key={typeConfig.value}
              className={`type-selector-btn ${meta.type === typeConfig.value ? 'active' : ''}`}
              style={{ '--type-color': typeConfig.color } as React.CSSProperties}
              onClick={() => dispatch({ type: 'META_SET_TYPE', fixtureType: typeConfig.value })}
              title={typeConfig.label}
            >
              <span className="type-icon">{typeConfig.icon}</span>
              <span className="type-label">{typeConfig.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/*
          SECTION B: CAPABILITIES MATRIX (CENTER - AUTO-GENERATED)
      */}

      <div className="cockpit-capabilities">
        <div className="cockpit-section-header">
          <Sliders size={16} />
          <span>CAPABILITIES</span>
          <span className="auto-badge">AUTO</span>
        </div>

        {(() => {
          const previewFixture = buildCompleteFixture()
          const caps = deriveCapabilitiesUnified(
            previewFixture.channels,
            previewFixture.wheels,
            previewFixture.physics,
          )
          return (
            <div className="capabilities-matrix">
              {CAPABILITY_BADGES.map(badge => {
                const isActive = caps[badge.key] as boolean
                return (
                  <div
                    key={String(badge.key)}
                    className={`capability-badge ${isActive ? 'active' : 'inactive'}`}
                    style={{ '--cap-color': badge.color } as React.CSSProperties}
                    title={`${badge.label}: ${isActive ? 'DETECTED' : 'Not found'}`}
                  >
                    <span className="cap-icon">{badge.icon}</span>
                    <span className="cap-label">{badge.label}</span>
                    {isActive && <span className="cap-check">✓</span>}
                  </div>
                )
              })}

              {/* Color mixing type indicator */}
              {caps.hasColorMixing && (
                <div className="color-mix-indicator" style={{ '--cap-color': '#ef4444' } as React.CSSProperties}>
                  <span className="mix-type">{caps.colorMixingType.toUpperCase()}</span>
                </div>
              )}
            </div>
          )
        })()}

        {/*
            WAVE 1122.3: COLOR ENGINE MUDADO AL CENTRO (Donde hay espacio)
        */}

        <div className="cockpit-section-header" style={{ marginTop: '32px' }}>
          <Palette size={16} />
          <span>COLOR ENGINE</span>
        </div>

        <div className="type-selector-grid columns-3">
          {COLOR_ENGINE_OPTIONS.map(engineConfig => (
            <button
              key={engineConfig.value}
              className={`type-selector-btn ${(wheels?.colorEngine ?? 'rgb') === engineConfig.value ? 'active' : ''}`}
              style={{ '--type-color': '#f59e0b' } as React.CSSProperties}
              onClick={() => dispatch({ type: 'WHEELS_SET_ENGINE', engine: engineConfig.value })}
              title={engineConfig.description}
            >
              <span className="type-icon">{engineConfig.icon}</span>
              <span className="type-label">{engineConfig.label}</span>
            </button>
          ))}
        </div>

        {/* ENGINE SPECS - Physics Preview (Read-only) */}
        <div className="engine-specs">
          <div className="cockpit-section-header compact">
            <Cog size={14} />
            <span>ENGINE SPECS</span>
          </div>
          <div className="engine-specs-grid">
            <div className="engine-badge" title="Motor Type">
              <span className="engine-icon">⚙️</span>
              <span className="engine-label">MOTOR</span>
              <span className="engine-value">{physics?.motorType?.toUpperCase() || '—'}</span>
            </div>
            <div className="engine-badge" title="Max Acceleration (°/s²)">
              <span className="engine-icon">⚡</span>
              <span className="engine-label">ACCEL</span>
              <span className="engine-value">{physics?.maxAcceleration || '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/*
          SECTION C: DMX RIBBON (BOTTOM - VISUAL FOOTPRINT)
      */}

      <div className="cockpit-dmx-ribbon">
        <div className="cockpit-section-header">
          <Server size={16} />
          <span>DMX RIBBON</span>
          <span className="ribbon-count">{channels.length} channels</span>
        </div>

        <div className="dmx-ribbon-track">
          {channels.map((channel, idx) => {
            const category = getChannelCategory(channel.type)
            const color = getCategoryColor(category)
            return (
              <div
                key={idx}
                className="dmx-ribbon-block"
                style={{ '--ch-color': color } as React.CSSProperties}
                title={`CH${idx + 1}: ${channel.name || channel.type}`}
              >
                <span className="block-ch">{idx + 1}</span>
                <span className="block-type">{channel.type.slice(0, 3).toUpperCase()}</span>
              </div>
            )
          })}
          {channels.length === 0 && (
            <div className="dmx-ribbon-empty">
              No channels defined — Add in Channel Rack tab
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ForgeGeneralTab
