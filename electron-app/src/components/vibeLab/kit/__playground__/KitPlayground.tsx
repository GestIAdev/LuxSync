/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎮 KitPlayground.tsx — Isolated test route for all kit primitives
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Renderiza cada primitiva del kit en sus 5 estados visuales
 * (inherited, mutated, danger, sealed, locked-by-basic) con props mock.
 * Esto permite verificar visualmente todos los componentes sin conectarlos
 * al genoma real.
 *
 * @module components/vibeLab/kit/__playground__/KitPlayground
 * @version FASE 2 — The Instrument Kit
 */

import React, { useState, useCallback } from 'react'
import { Zap, Palette, Move, Activity, Thermometer, Waves, Orbit } from 'lucide-react'
import {
  GeneSlider,
  TwinGeneSlider,
  GeneToggle,
  GeneSegmented,
  GeneNumberField,
  MacroGeneDial,
  GenePanel,
  SafetyInterlock,
  MutationBadge,
} from '../index'
import type { SegmentedOption } from '../types'
import '../kit-variables.css'
import './kit-playground.css'

// ═══════════════════════════════════════════════════════════════════════════
// ACCENT COLORS (de los 3 tabs del blueprint)
// ═══════════════════════════════════════════════════════════════════════════

const ACCENT_PHYSICS = '#00e5ff'
const ACCENT_COLOR = '#ff2fd0'
const ACCENT_MOVEMENT = '#ffaa00'

// ═══════════════════════════════════════════════════════════════════════════
// MOCK STATE LABELS
// ═══════════════════════════════════════════════════════════════════════════

const STATE_LABELS = ['inherited', 'mutated', 'danger', 'sealed', 'locked-by-basic'] as const

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const KitPlayground: React.FC = () => {
  // ── Estado local para componentes interactivos ──────────────────────
  const [sliderValue, setSliderValue] = useState(4.2)
  const [twinValue, setTwinValue] = useState<[number, number]>([0.2, 0.8])
  const [toggleValue, setToggleValue] = useState(true)
  const [segmentedValue, setSegmentedValue] = useState('linear')
  const [numberValue, setNumberValue] = useState(120)
  const [macroValue, setMacroValue] = useState(0.65)
  const [interlockMode, setInterlockMode] = useState<'shielded' | 'raw'>('shielded')
  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({
    'panel-physics': true,
    'panel-color': false,
    'panel-movement': true,
  })

  const handlePanelToggle = useCallback((id: string) => {
    setExpandedPanels((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const noop = useCallback(() => {}, [])

  // ── Opciones para GeneSegmented ─────────────────────────────────────
  const segmentedOptions: SegmentedOption<string>[] = [
    { label: 'Linear', value: 'linear' },
    { label: 'Exp', value: 'exp' },
    { label: 'Log', value: 'log' },
    { label: 'Step', value: 'step' },
  ]

  return (
    <div className="kit-playground" style={{ '--vl-accent': ACCENT_PHYSICS } as React.CSSProperties}>
      <header className="kit-playground-header">
        <h1>🧬 Vibe Lab — Instrument Kit Playground</h1>
        <p>Fase 2: todas las primitivas en sus 5 estados visuales</p>
      </header>

      {/* ── SAFETY INTERLOCK ──────────────────────────────────────────── */}
      <section className="kit-playground-section">
        <h2>SafetyInterlock</h2>
        <div className="kit-playground-row">
          <SafetyInterlock mode={interlockMode} onChange={setInterlockMode} />
        </div>
      </section>

      {/* ── MUTATION BADGE ────────────────────────────────────────────── */}
      <section className="kit-playground-section">
        <h2>MutationBadge</h2>
        <div className="kit-playground-row badges">
          <MutationBadge count={1} accent={ACCENT_PHYSICS} />
          <MutationBadge count={5} accent={ACCENT_COLOR} />
          <MutationBadge count={12} accent={ACCENT_MOVEMENT} />
          <MutationBadge count={0} accent={ACCENT_PHYSICS} />
        </div>
      </section>

      {/* ── GENE SLIDER (5 estados) ───────────────────────────────────── */}
      <section className="kit-playground-section">
        <h2>GeneSlider — 5 estados</h2>
        <div className="kit-playground-grid">
          {/* inherited */}
          <div className="kit-playground-cell" data-state-label="inherited">
            <GeneSlider
              path="physics.transient.percBoost"
              label="Perc Boost"
              baseValue={3.1}
              value={3.1}
              min={0}
              max={10}
              step={0.1}
              unit=""
              isMutated={false}
              tier="safe"
              onChange={noop}
              onRevert={noop}
            />
          </div>
          {/* mutated */}
          <div className="kit-playground-cell" data-state-label="mutated">
            <GeneSlider
              path="physics.transient.percBoost"
              label="Perc Boost"
              baseValue={3.1}
              value={sliderValue}
              min={0}
              max={10}
              step={0.1}
              unit=""
              isMutated
              tier="safe"
              onChange={setSliderValue}
              onRevert={() => setSliderValue(3.1)}
            />
          </div>
          {/* danger */}
          <div className="kit-playground-cell" data-state-label="danger">
            <GeneSlider
              path="physics.transient.percBoost"
              label="Perc Boost"
              baseValue={3.1}
              value={9.5}
              min={0}
              max={10}
              step={0.1}
              unit=""
              danger={[8, 10]}
              isMutated
              isInDanger
              tier="safe"
              onChange={noop}
              onRevert={noop}
            />
          </div>
          {/* sealed */}
          <div className="kit-playground-cell" data-state-label="sealed">
            <GeneSlider
              path="movement.TILT_CEILING"
              label="Tilt Ceiling"
              baseValue={0.15}
              value={0.15}
              min={0}
              max={1}
              step={0.01}
              isMutated={false}
              isSealed
              tier="raw"
              onChange={noop}
              onRevert={noop}
            />
          </div>
          {/* locked-by-basic (hidden in shielded, shown in raw) */}
          <div className="kit-playground-cell" data-state-label="locked-by-basic">
            <GeneSlider
              path="physics.envelope.EMA_ALPHA_SLOW"
              label="EMA Alpha Slow"
              baseValue={0.05}
              value={0.05}
              min={0}
              max={1}
              step={0.001}
              isMutated={false}
              tier="raw"
              onChange={noop}
              onRevert={noop}
            />
            <span className="kit-playground-note">
              (oculto en SHIELDED — cambia a RAW para verlo)
            </span>
          </div>
        </div>
      </section>

      {/* ── TWIN GENE SLIDER ──────────────────────────────────────────── */}
      <section className="kit-playground-section">
        <h2>TwinGeneSlider — 3 estados</h2>
        <div className="kit-playground-grid">
          <div className="kit-playground-cell" data-state-label="inherited">
            <TwinGeneSlider
              path="physics.morph.range"
              label="Morph Range"
              baseValue={[0.2, 0.8]}
              value={[0.2, 0.8]}
              min={0}
              max={1}
              step={0.01}
              isMutated={false}
              tier="safe"
              onChange={noop}
              onRevert={noop}
            />
          </div>
          <div className="kit-playground-cell" data-state-label="mutated">
            <TwinGeneSlider
              path="physics.morph.range"
              label="Morph Range"
              baseValue={[0.2, 0.8]}
              value={twinValue}
              min={0}
              max={1}
              step={0.01}
              isMutated
              tier="safe"
              onChange={(v) => setTwinValue(v as [number, number])}
              onRevert={() => setTwinValue([0.2, 0.8])}
            />
          </div>
          <div className="kit-playground-cell" data-state-label="sealed">
            <TwinGeneSlider
              path="movement.optics.zoomRange"
              label="Zoom Range"
              baseValue={[50, 200]}
              value={[50, 200]}
              min={0}
              max={255}
              step={1}
              isMutated={false}
              isSealed
              tier="raw"
              onChange={noop}
              onRevert={noop}
            />
          </div>
        </div>
      </section>

      {/* ── GENE TOGGLE ───────────────────────────────────────────────── */}
      <section className="kit-playground-section">
        <h2>GeneToggle — 3 estados</h2>
        <div className="kit-playground-grid">
          <div className="kit-playground-cell" data-state-label="inherited">
            <GeneToggle
              path="physics.routing.isPureAmbient"
              label="Pure Ambient"
              baseValue={false}
              value={false}
              isMutated={false}
              tier="safe"
              onChange={noop}
              onRevert={noop}
            />
          </div>
          <div className="kit-playground-cell" data-state-label="mutated">
            <GeneToggle
              path="physics.routing.isPureAmbient"
              label="Pure Ambient"
              baseValue={false}
              value={toggleValue}
              isMutated
              tier="safe"
              onChange={setToggleValue}
              onRevert={() => setToggleValue(false)}
            />
          </div>
          <div className="kit-playground-cell" data-state-label="sealed">
            <GeneToggle
              path="physics.STROBE_MAX_HZ"
              label="Strobe Max Hz"
              baseValue={true}
              value={true}
              isMutated={false}
              isSealed
              tier="raw"
              onChange={noop}
              onRevert={noop}
            />
          </div>
        </div>
      </section>

      {/* ── GENE SEGMENTED ────────────────────────────────────────────── */}
      <section className="kit-playground-section">
        <h2>GeneSegmented — 3 estados</h2>
        <div className="kit-playground-grid">
          <div className="kit-playground-cell" data-state-label="inherited">
            <GeneSegmented
              path="physics.transient.curve"
              label="Curve Type"
              baseValue="linear"
              value="linear"
              options={segmentedOptions}
              isMutated={false}
              tier="safe"
              onChange={noop}
              onRevert={noop}
            />
          </div>
          <div className="kit-playground-cell" data-state-label="mutated">
            <GeneSegmented
              path="physics.transient.curve"
              label="Curve Type"
              baseValue="linear"
              value={segmentedValue}
              options={segmentedOptions}
              isMutated
              tier="safe"
              onChange={setSegmentedValue}
              onRevert={() => setSegmentedValue('linear')}
            />
          </div>
          <div className="kit-playground-cell" data-state-label="sealed">
            <GeneSegmented
              path="movement.ik.gimbalMode"
              label="Gimbal Mode"
              baseValue="auto"
              value="auto"
              options={[
                { label: 'Auto', value: 'auto' },
                { label: 'Manual', value: 'manual' },
                { label: 'Lock', value: 'lock' },
              ]}
              isMutated={false}
              isSealed
              tier="raw"
              onChange={noop}
              onRevert={noop}
            />
          </div>
        </div>
      </section>

      {/* ── GENE NUMBER FIELD ─────────────────────────────────────────── */}
      <section className="kit-playground-section">
        <h2>GeneNumberField — 3 estados</h2>
        <div className="kit-playground-grid">
          <div className="kit-playground-cell" data-state-label="inherited">
            <GeneNumberField
              path="physics.ambient.attackMs"
              label="Attack"
              baseValue={100}
              value={100}
              min={0}
              max={5000}
              step={1}
              unit="ms"
              precision={0}
              isMutated={false}
              tier="safe"
              onChange={noop}
              onRevert={noop}
            />
          </div>
          <div className="kit-playground-cell" data-state-label="mutated">
            <GeneNumberField
              path="physics.ambient.attackMs"
              label="Attack"
              baseValue={100}
              value={numberValue}
              min={0}
              max={5000}
              step={1}
              unit="ms"
              precision={0}
              isMutated
              tier="safe"
              onChange={setNumberValue}
              onRevert={() => setNumberValue(100)}
            />
          </div>
          <div className="kit-playground-cell" data-state-label="sealed">
            <GeneNumberField
              path="physics.KICK_COOLDOWN_MS"
              label="Kick Cooldown"
              baseValue={50}
              value={50}
              min={0}
              max={1000}
              step={1}
              unit="ms"
              isMutated={false}
              isSealed
              tier="raw"
              onChange={noop}
              onRevert={noop}
            />
          </div>
        </div>
      </section>

      {/* ── MACRO GENE DIAL ───────────────────────────────────────────── */}
      <section className="kit-playground-section">
        <h2>MacroGeneDial — 5 Macro Genes</h2>
        <div className="kit-playground-dials">
          <MacroGeneDial
            id="aggression"
            label="Aggression"
            icon="⚡"
            accentHex={ACCENT_PHYSICS}
            description="percBoost ↑, percGate ↓, decayBase ↓, snapFactor ↑, friction ↓"
            value={macroValue}
            onChange={setMacroValue}
          />
          <MacroGeneDial
            id="viscosity"
            label="Viscosity"
            icon="🌊"
            accentHex={ACCENT_PHYSICS}
            description="ambientAttackMs ↑, ambientReleaseMs ↑, friction ↑, smoothFactor ↑"
            value={0.3}
            onChange={noop}
          />
          <MacroGeneDial
            id="thermalBias"
            label="Thermal Bias"
            icon="🌡️"
            accentHex={ACCENT_COLOR}
            description="atmosphericTemp + thermalGravityStrength en curva conjunta"
            value={0.5}
            onChange={noop}
          />
          <MacroGeneDial
            id="spatialReach"
            label="Spatial Reach"
            icon="🛰️"
            accentHex={ACCENT_MOVEMENT}
            description="panScale + tiltScale + fanAmplitude"
            value={0.8}
            onChange={noop}
          />
          <MacroGeneDial
            id="nervousness"
            label="Nervousness"
            icon="📡"
            accentHex={ACCENT_MOVEMENT}
            description="cycleBeats ↓, phraseDuration ↓, globalSpeedMultiplier ↑"
            value={0.15}
            onChange={noop}
          />
        </div>
      </section>

      {/* ── GENE PANEL ────────────────────────────────────────────────── */}
      <section className="kit-playground-section">
        <h2>GenePanel — 3 paneles colapsables</h2>
        <div className="kit-playground-panels">
          <GenePanel
            id="panel-physics"
            title="Photon Physics"
            icon={<Zap size={14} />}
            accent={ACCENT_PHYSICS}
            tier="safe"
            mutatedCount={3}
            isExpanded={expandedPanels['panel-physics'] ?? true}
            onToggle={() => handlePanelToggle('panel-physics')}
          >
            <GeneSlider
              path="physics.transient.percBoost"
              label="Perc Boost"
              baseValue={3.1}
              value={5.0}
              min={0}
              max={10}
              step={0.1}
              isMutated
              tier="safe"
              onChange={noop}
              onRevert={noop}
            />
            <GeneToggle
              path="physics.routing.isPureAmbient"
              label="Pure Ambient"
              baseValue={false}
              value={true}
              isMutated
              tier="safe"
              onChange={noop}
              onRevert={noop}
            />
            <GeneNumberField
              path="physics.ambient.attackMs"
              label="Attack"
              baseValue={100}
              value={250}
              min={0}
              max={5000}
              step={1}
              unit="ms"
              isMutated
              tier="safe"
              onChange={noop}
              onRevert={noop}
            />
          </GenePanel>

          <GenePanel
            id="panel-color"
            title="Chromatic Spectrum"
            icon={<Palette size={14} />}
            accent={ACCENT_COLOR}
            tier="safe"
            mutatedCount={0}
            isExpanded={expandedPanels['panel-color'] ?? false}
            onToggle={() => handlePanelToggle('panel-color')}
          >
            <p className="kit-playground-placeholder">Panel sin mutaciones — contenido real en Fase 3</p>
          </GenePanel>

          <GenePanel
            id="panel-movement"
            title="Kinematic Engine"
            icon={<Move size={14} />}
            accent={ACCENT_MOVEMENT}
            tier="safe"
            mutatedCount={7}
            isExpanded={expandedPanels['panel-movement'] ?? true}
            onToggle={() => handlePanelToggle('panel-movement')}
          >
            <TwinGeneSlider
              path="movement.optics.zoomRange"
              label="Zoom Range"
              baseValue={[50, 200]}
              value={[30, 220]}
              min={0}
              max={255}
              step={1}
              isMutated
              tier="safe"
              onChange={noop}
              onRevert={noop}
            />
            <GeneSegmented
              path="movement.behavior.homeMode"
              label="Home Mode"
              baseValue="beat"
              value="random"
              options={[
                { label: 'Beat', value: 'beat' },
                { label: 'Random', value: 'random' },
                { label: 'Off', value: 'off' },
              ]}
              isMutated
              tier="safe"
              onChange={noop}
              onRevert={noop}
            />
          </GenePanel>
        </div>
      </section>

      <footer className="kit-playground-footer">
        <p>
          Estado del interlock: <strong>{interlockMode.toUpperCase()}</strong> —
          Los componentes `tier=raw` se ocultan en SHIELDED.
        </p>
      </footer>
    </div>
  )
}

KitPlayground.displayName = 'KitPlayground'

export default KitPlayground
