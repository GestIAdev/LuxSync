/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 WAVE 4818 — DNA RAIL (REDESIGN)
 * Right-side 260px panel. Conectado a LfxClipInstance + GatekeeperLinter
 * + inferArchetypes (WAVE 4817 — Lote 1).
 *
 * Layout vertical:
 *  1. Archetype Loadout (pastillas)
 *  2. Genome Chamber (cubo SVG isométrico + narrativeDescription)
 *  3. ACO Sliders (con zonas bloqueadas por bias)
 *  4. Energy Thermometer (7 zonas multi-select)
 *  5. Vibe Compatibility (4 checkboxes reales)
 *  6. Linter Panel (warnings en vivo + bloqueo de save)
 *
 * Performance:
 *  - LfxClipInstance vive en useRef para evitar re-instanciar en cada render.
 *  - Todos los handlers son useCallback.
 *  - linterResult se recalcula con useMemo solo cuando cambia el estado ACO/arch.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import type { CognitiveDNA, SimulationMeta } from '../../../../core/arsenal/lfxTypes'
import {
  LfxClipInstance,
  ARCHETYPE_BIAS_MAP,
  ENERGY_ZONES,
  type UserArchetype,
  type EnergyZoneId,
  type CompatibleVibe,
  type AcoTriad,
} from '../../../../core/arsenal/LfxClipInstance'
import { validateClip, type LinterWarning } from '../../../../core/arsenal/GatekeeperLinter'
import {
  narrativeDescription,
  semanticLabel,
} from '../../../../core/arsenal/inferArchetypes'
import './DnaRail.css'

// ─── LEGACY COMPATIBILITY EXPORTS (consumed by index.tsx) ───────────────────

export const DEFAULT_COGNITIVE_DNA: CognitiveDNA = {
  genome: { aggression: 0.5, chaos: 0.5, organicity: 0.5 },
  textureAffinity: 'universal',
  compatibleVibes: [],
  validSections: [],
  energyZone: { min: 'ambient', max: 'peak' },
  aggressionRange: { min: 0, max: 1 },
  spatialBehavior: 'absolute',
  ikCompatibility: undefined,
}

export const DEFAULT_SIMULATION_META: SimulationMeta = {
  beautyWeights: { base: 0.5, energyMultiplier: 1.0, vibeBonus: 0.0 },
  gpuCost: 0.3,
  fatigueImpact: 0.06,
  minDurationMs: 1000,
  cooldownMs: 7000,
  isStrobe: false,
  isDivineCandidate: false,
  isHeavyCandidate: false,
  zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: null },
}

// ─── ARCHETYPE CATALOG UI ───────────────────────────────────────────────────

interface ArchetypeUIDef {
  id: UserArchetype
  label: string
  glyph: string
  description: string
  color: string
}

const ARCHETYPE_UI: readonly ArchetypeUIDef[] = [
  {
    id: 'strobe',
    label: 'STROBE',
    glyph: '⚡',
    description: 'High-freq flash. Aggressive & chaotic.',
    color: '#fbbf24',
  },
  {
    id: 'ambient',
    label: 'AMBIENT',
    glyph: '〰',
    description: 'Low energy drift. Organic & soft.',
    color: '#60a5fa',
  },
  {
    id: 'heavy',
    label: 'HEAVY',
    glyph: '◆',
    description: 'Dense presence. High aggression.',
    color: '#f87171',
  },
  {
    id: 'divine',
    label: 'DIVINE',
    glyph: '✦',
    description: 'Peak-only apex. Max aggression.',
    color: '#c084fc',
  },
  {
    id: 'utility',
    label: 'UTILITY',
    glyph: '◈',
    description: 'General purpose. No forced bias.',
    color: '#6ee7b7',
  },
]

// ─── VIBE UI CATALOG (real Selene vibes) ────────────────────────────────────

interface VibeUIDef {
  id: CompatibleVibe
  label: string
  disabled?: boolean
}

const VIBE_UI: readonly VibeUIDef[] = [
  { id: 'techno-dark', label: 'techno-dark' },
  { id: 'latino-organic', label: 'latino-organic' },
  { id: 'pop-rock', label: 'pop-rock', disabled: true },
  { id: 'chill-lounge', label: 'chill-lounge' },
]

// ─── GENOME CUBE SVG (unchanged from WAVE 4811) ─────────────────────────────

const CX = 60
const CY = 55
const SCALE = 35

function iso(x: number, y: number, z: number): [number, number] {
  return [
    CX + (x - z) * SCALE * 0.866,
    CY + (x + z) * SCALE * 0.5 - y * SCALE,
  ]
}

const V = {
  O:  iso(0, 0, 0),
  A:  iso(1, 0, 0),
  C:  iso(0, 1, 0),
  Or: iso(0, 0, 1),
  AC: iso(1, 1, 0),
  CO: iso(0, 1, 1),
  AO: iso(1, 0, 1),
}

const pt = (v: [number, number]) => `${v[0].toFixed(1)},${v[1].toFixed(1)}`

interface GenomeCubeProps {
  aggression: number
  chaos: number
  organicity: number
  archetype: UserArchetype
}

const GenomeCube: React.FC<GenomeCubeProps> = React.memo(
  ({ aggression, chaos, organicity, archetype }) => {
    const [dx, dy] = iso(aggression, chaos, organicity)
    const def = ARCHETYPE_UI.find(a => a.id === archetype)
    const dotColor = def?.color ?? '#ff6b2b'

    return (
      <svg
        className="dna-cube"
        viewBox="0 0 120 110"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Genome cube"
      >
        <defs>
          <radialGradient id={`dot-glow-${archetype}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={dotColor} stopOpacity="0.9" />
            <stop offset="60%"  stopColor={dotColor} stopOpacity="0.4" />
            <stop offset="100%" stopColor={dotColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        <g stroke="rgba(255,107,43,0.12)" strokeWidth="0.8" fill="none" strokeDasharray="2,2">
          <line x1={pt(V.AO)[0]} y1={pt(V.AO)[1]} x2={pt(V.A)[0]} y2={pt(V.A)[1]} />
          <line x1={pt(V.AO)[0]} y1={pt(V.AO)[1]} x2={pt(V.Or)[0]} y2={pt(V.Or)[1]} />
        </g>

        <polygon points={`${pt(V.C)} ${pt(V.AC)} ${pt(V.O)} ${pt(V.CO)}`}
          fill="rgba(255,107,43,0.04)" stroke="rgba(255,107,43,0.22)" strokeWidth="0.8" />
        <polygon points={`${pt(V.O)} ${pt(V.AC)} ${pt(V.A)} ${pt(V.AO)}`}
          fill="rgba(255,107,43,0.03)" stroke="rgba(255,107,43,0.18)" strokeWidth="0.8" />
        <polygon points={`${pt(V.O)} ${pt(V.CO)} ${pt(V.Or)} ${pt(V.AO)}`}
          fill="rgba(255,107,43,0.03)" stroke="rgba(255,107,43,0.18)" strokeWidth="0.8" />

        <g stroke="rgba(255,107,43,0.30)" strokeWidth="0.8" strokeDasharray="3,2">
          <line x1={pt(V.O)[0]} y1={pt(V.O)[1]} x2={pt(V.A)[0]}  y2={pt(V.A)[1]} />
          <line x1={pt(V.O)[0]} y1={pt(V.O)[1]} x2={pt(V.C)[0]}  y2={pt(V.C)[1]} />
          <line x1={pt(V.O)[0]} y1={pt(V.O)[1]} x2={pt(V.Or)[0]} y2={pt(V.Or)[1]} />
        </g>

        <text x={V.A[0] + 4}   y={V.A[1] + 3}  className="dna-cube__label">A</text>
        <text x={V.C[0] - 6}   y={V.C[1] - 4}  className="dna-cube__label">C</text>
        <text x={V.Or[0] - 12} y={V.Or[1] + 3} className="dna-cube__label">O</text>

        {[V.C, V.A, V.Or, V.AC, V.CO, V.AO].map(([vx, vy], i) => (
          <circle key={i} cx={vx} cy={vy} r="1.5" fill="rgba(255,107,43,0.35)" />
        ))}

        <circle cx={dx} cy={dy} r="10" fill={`url(#dot-glow-${archetype})`} />
        <circle cx={dx} cy={dy} r="4"  fill={dotColor} className="dna-cube__dot" />
        <circle cx={dx} cy={dy} r="2"  fill="#fff" opacity="0.8" />
      </svg>
    )
  },
)

// ─── LOCAL STATE SHAPE ───────────────────────────────────────────────────────

interface DnaFormState {
  archetype: UserArchetype
  aco: AcoTriad
  zones: EnergyZoneId[]
  vibes: CompatibleVibe[]
  maxStrobeFreqHz: number
}

function buildInstance(state: DnaFormState, clipId: string): LfxClipInstance {
  const inst = new LfxClipInstance({
    id: clipId,
    userArchetype: state.archetype,
    acoTriad: state.aco,
    energyZones: state.zones,
    compatibleVibes: state.vibes,
    maxStrobeFreqHz: state.maxStrobeFreqHz,
  })
  return inst
}

// ─── SEVERITY HELPERS ───────────────────────────────────────────────────────

const SEV_COLOR: Record<string, string> = {
  info: '#60a5fa',
  warning: '#fbbf24',
  error: '#f87171',
  critical: '#ef4444',
}

const SEV_ICON: Record<string, string> = {
  info: 'ℹ',
  warning: '⚠',
  error: '✗',
  critical: '✗',
}

// ─── PROPS ──────────────────────────────────────────────────────────────────

interface DnaRailProps {
  dna: CognitiveDNA | undefined
  simMeta: SimulationMeta | undefined
  onDnaChange: (dna: CognitiveDNA) => void
  onSimMetaChange: (meta: SimulationMeta) => void
  onEnableDna: () => void
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export const DnaRail: React.FC<DnaRailProps> = ({
  dna,
  onDnaChange,
  onEnableDna,
}) => {
  // Stable clip id for the session (re-mounts = new id, but that's fine)
  const clipIdRef = useRef(crypto.randomUUID())

  // ── Local form state (drives UI + LfxClipInstance derivation) ──
  const [form, setForm] = useState<DnaFormState>(() => {
    if (!dna) return {
      archetype: 'utility',
      aco: { aggression: 0.5, chaos: 0.5, organicity: 0.5 },
      zones: ['ambient', 'gentle', 'active'],
      vibes: [],
      maxStrobeFreqHz: 0,
    }
    return {
      archetype: 'utility',
      aco: { ...dna.genome },
      zones: (() => {
        const lo = ENERGY_ZONES.indexOf(dna.energyZone.min)
        const hi = ENERGY_ZONES.indexOf(dna.energyZone.max)
        return ENERGY_ZONES.slice(
          Math.max(0, lo),
          Math.min(ENERGY_ZONES.length, hi + 1),
        ) as EnergyZoneId[]
      })(),
      vibes: [],
      maxStrobeFreqHz: 0,
    }
  })

  // ── Derive LfxClipInstance + lint on every form change ──
  const instance = useMemo(
    () => buildInstance(form, clipIdRef.current),
    [form],
  )

  const lintResult = useMemo(() => validateClip(instance), [instance])

  // ── Derive narrative text ──
  const narrative = useMemo(
    () => narrativeDescription(form.aco),
    [form.aco],
  )

  // ── ACO bias bounds for current archetype (for slider shading) ──
  const bias = useMemo(() => ARCHETYPE_BIAS_MAP[form.archetype], [form.archetype])

  // ── Propagate to parent whenever form changes ──
  useEffect(() => {
    if (!dna) return
    const reality = instance.toCognitiveDNA()
    onDnaChange({
      genome: { ...reality.genome },
      textureAffinity: reality.textureAffinity,
      compatibleVibes: [...reality.compatibleVibes],
      validSections: dna.validSections,
      energyZone: { ...reality.energyZone },
      aggressionRange: { ...reality.aggressionRange },
      spatialBehavior: reality.spatialBehavior,
      ikCompatibility: dna.ikCompatibility,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance])

  // ── Handlers ──

  const handleArchetype = useCallback((arch: UserArchetype) => {
    setForm(prev => {
      const next = { ...prev, archetype: arch }
      // Apply bias zones immediately when switching archetype
      const biasDef = ARCHETYPE_BIAS_MAP[arch]
      const filtered = prev.zones.filter(z =>
        !biasDef.allowedZones || biasDef.allowedZones.includes(z),
      )
      next.zones = filtered.length > 0 ? filtered : [...biasDef.defaultZones]
      // Also auto-set strobe flag
      if (arch === 'strobe' && next.maxStrobeFreqHz === 0) {
        next.maxStrobeFreqHz = 10
      }
      if (arch !== 'strobe') {
        next.maxStrobeFreqHz = 0
      }
      return next
    })
  }, [])

  const handleAco = useCallback((axis: keyof AcoTriad) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value)
      setForm(prev => ({
        ...prev,
        aco: { ...prev.aco, [axis]: val },
      }))
    }, [])

  const handleZoneToggle = useCallback((zone: EnergyZoneId) => {
    setForm(prev => {
      const allowed = ARCHETYPE_BIAS_MAP[prev.archetype].allowedZones
      if (allowed && !allowed.includes(zone)) return prev  // blocked by bias
      const has = prev.zones.includes(zone)
      const next = has
        ? prev.zones.filter(z => z !== zone)
        : [...prev.zones, zone]
      return { ...prev, zones: next.length > 0 ? next : prev.zones }
    })
  }, [])

  const handleVibeToggle = useCallback((vibe: CompatibleVibe) => {
    setForm(prev => {
      const has = prev.vibes.includes(vibe)
      return {
        ...prev,
        vibes: has ? prev.vibes.filter(v => v !== vibe) : [...prev.vibes, vibe],
      }
    })
  }, [])

  const handleStrobeHz = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(0, Math.min(30, parseFloat(e.target.value) || 0))
    setForm(prev => ({ ...prev, maxStrobeFreqHz: val }))
  }, [])

  // ── No DNA — CTA ──
  if (!dna) {
    return (
      <aside className="dna-rail">
        <div className="dna-rail__header">
          <span className="dna-rail__title">🧬 COGNITIVE DNA</span>
        </div>
        <div className="dna-rail__empty">
          <span className="dna-rail__empty-icon">🧬</span>
          <p className="dna-rail__empty-text">
            This clip has no Cognitive DNA yet. Enable it to make the clip visible to Selene IA.
          </p>
          <button className="dna-rail__enable-btn" onClick={onEnableDna} type="button">
            + ENABLE DNA
          </button>
          <p className="dna-rail__empty-hint">
            Legacy clips (v1.x) stay fully functional — DNA is additive.
          </p>
        </div>
      </aside>
    )
  }

  const canSave = lintResult.canSave

  return (
    <aside className="dna-rail">
      {/* ── HEADER ── */}
      <div className="dna-rail__header">
        <span className="dna-rail__title">🧬 COGNITIVE DNA</span>
        {lintResult.summary.critical > 0 && (
          <span className="dna-rail__header-badge dna-rail__header-badge--critical">
            {lintResult.summary.critical} ✗
          </span>
        )}
        {lintResult.summary.error > 0 && lintResult.summary.critical === 0 && (
          <span className="dna-rail__header-badge dna-rail__header-badge--error">
            {lintResult.summary.error} ✗
          </span>
        )}
        {canSave && lintResult.summary.warning > 0 && (
          <span className="dna-rail__header-badge dna-rail__header-badge--warn">
            {lintResult.summary.warning} ⚠
          </span>
        )}
      </div>

      <div className="dna-rail__body">

        {/* ══ SECTION 1: ARCHETYPE LOADOUT ══ */}
        <section className="dna-rail__section">
          <div className="dna-rail__section-label">ARCHETYPE</div>
          <div className="dna-rail__archetype-grid">
            {ARCHETYPE_UI.map(arch => (
              <button
                key={arch.id}
                type="button"
                className={`dna-rail__arch-card ${form.archetype === arch.id ? 'dna-rail__arch-card--active' : ''}`}
                style={{ '--arch-color': arch.color } as React.CSSProperties}
                onClick={() => handleArchetype(arch.id)}
                title={arch.description}
              >
                <span className="dna-rail__arch-glyph">{arch.glyph}</span>
                <span className="dna-rail__arch-label">{arch.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ══ SECTION 2: GENOME CHAMBER ══ */}
        <section className="dna-rail__section">
          <div className="dna-rail__section-label">GENOME</div>
          <div className="dna-rail__cube-wrap">
            <GenomeCube
              aggression={form.aco.aggression}
              chaos={form.aco.chaos}
              organicity={form.aco.organicity}
              archetype={form.archetype}
            />
          </div>
          <p className="dna-rail__narrative">{narrative}</p>
        </section>

        {/* ══ SECTION 3: ACO SLIDERS ══ */}
        <section className="dna-rail__section">
          <div className="dna-rail__section-label">ACO MATRIX</div>
          <div className="dna-rail__genome-sliders">
            {(['aggression', 'chaos', 'organicity'] as const).map(axis => {
              const min = (bias as Record<string, number | undefined>)[`${axis}Min`] ?? 0
              const max = (bias as Record<string, number | undefined>)[`${axis}Max`] ?? 1
              const isLocked = min === max
              const label = semanticLabel(axis, form.aco[axis])
              return (
                <div key={axis} className="dna-rail__genome-row">
                  <span className="dna-rail__genome-axis">{axis[0].toUpperCase()}</span>
                  <div className="dna-rail__slider-wrap">
                    {/* Locked region overlay */}
                    {(min > 0 || max < 1) && (
                      <div
                        className="dna-rail__slider-locked"
                        style={{
                          left: `${min * 100}%`,
                          width: `${(max - min) * 100}%`,
                        }}
                      />
                    )}
                    <input
                      type="range"
                      className={`dna-rail__genome-slider ${isLocked ? 'dna-rail__genome-slider--locked' : ''}`}
                      min={0} max={1} step={0.01}
                      value={form.aco[axis]}
                      onChange={handleAco(axis)}
                      disabled={isLocked}
                    />
                  </div>
                  <div className="dna-rail__genome-right">
                    <span className="dna-rail__genome-val">{form.aco[axis].toFixed(2)}</span>
                    <span className="dna-rail__genome-label">{label}</span>
                  </div>
                </div>
              )
            })}
          </div>
          {/* Strobe Hz input — only visible when archetype=strobe */}
          {form.archetype === 'strobe' && (
            <div className="dna-rail__strobe-row">
              <span className="dna-rail__sim-label">HZ</span>
              <input
                type="number"
                className="dna-rail__strobe-input"
                min={1} max={30} step={0.5}
                value={form.maxStrobeFreqHz}
                onChange={handleStrobeHz}
              />
              <span className="dna-rail__genome-val">/ 25 max</span>
            </div>
          )}
        </section>

        {/* ══ SECTION 4: ENERGY THERMOMETER ══ */}
        <section className="dna-rail__section">
          <div className="dna-rail__section-label">ENERGY ZONES</div>
          <div className="dna-rail__thermometer">
            {ENERGY_ZONES.map(zone => {
              const allowed = !bias.allowedZones || bias.allowedZones.includes(zone)
              const active = form.zones.includes(zone)
              return (
                <button
                  key={zone}
                  type="button"
                  className={[
                    'dna-rail__zone-seg',
                    active ? 'dna-rail__zone-seg--active' : '',
                    !allowed ? 'dna-rail__zone-seg--blocked' : '',
                  ].join(' ')}
                  onClick={() => handleZoneToggle(zone)}
                  disabled={!allowed}
                  title={allowed ? zone : `Blocked by ${form.archetype} bias`}
                >
                  {zone.slice(0, 3).toUpperCase()}
                </button>
              )
            })}
          </div>
          <p className="dna-rail__zone-desc">
            {form.zones.length > 0
              ? `Active in: ${form.zones.join(', ')}`
              : 'No zones selected'}
          </p>
        </section>

        {/* ══ SECTION 5: VIBE COMPATIBILITY ══ */}
        <section className="dna-rail__section">
          <div className="dna-rail__section-label">VIBES</div>
          <div className="dna-rail__vibes">
            {VIBE_UI.map(v => (
              <label
                key={v.id}
                className={[
                  'dna-rail__vibe-row',
                  v.disabled ? 'dna-rail__vibe-row--disabled' : '',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  className="dna-rail__vibe-check"
                  checked={form.vibes.includes(v.id)}
                  disabled={v.disabled}
                  onChange={() => !v.disabled && handleVibeToggle(v.id)}
                />
                <span className="dna-rail__vibe-label">{v.label}</span>
                {v.disabled && <span className="dna-rail__vibe-soon">soon</span>}
              </label>
            ))}
          </div>
        </section>

        {/* ══ SECTION 6: GATEKEEPER LINTER ══ */}
        {lintResult.warnings.length > 0 && (
          <section className="dna-rail__section dna-rail__section--linter">
            <div className="dna-rail__section-label">GATEKEEPER</div>
            <div className="dna-rail__linter-list">
              {lintResult.warnings.map(w => (
                <LinterCard key={w.id} warning={w} />
              ))}
            </div>
          </section>
        )}

        {canSave && lintResult.warnings.length === 0 && (
          <section className="dna-rail__section">
            <div className="dna-rail__linter-ok">
              ✅ Selene will love this.
            </div>
          </section>
        )}

      </div>

      {/* ── FOOTER: save status strip ── */}
      <div className={`dna-rail__footer ${canSave ? '' : 'dna-rail__footer--blocked'}`}>
        {canSave ? (
          <span className="dna-rail__footer-text">Ready to export</span>
        ) : (
          <span className="dna-rail__footer-text dna-rail__footer-text--blocked">
            ✗ Fix {lintResult.summary.critical + lintResult.summary.error} issue
            {lintResult.summary.critical + lintResult.summary.error > 1 ? 's' : ''} to save
          </span>
        )}
      </div>
    </aside>
  )
}

// ─── LINTER CARD (sub-component) ────────────────────────────────────────────

const LinterCard: React.FC<{ warning: LinterWarning }> = React.memo(({ warning }) => {
  const [expanded, setExpanded] = useState(false)
  const color = SEV_COLOR[warning.severity] ?? '#fff'
  const icon = SEV_ICON[warning.severity] ?? '•'

  return (
    <div
      className="dna-rail__linter-card"
      style={{ '--linter-color': color } as React.CSSProperties}
      onClick={() => setExpanded(e => !e)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpanded(v => !v) }}
    >
      <div className="dna-rail__linter-card-header">
        <span className="dna-rail__linter-icon">{icon}</span>
        <span className="dna-rail__linter-title">{warning.title}</span>
        <span className="dna-rail__linter-chevron">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="dna-rail__linter-card-body">
          <p className="dna-rail__linter-msg">{warning.message}</p>
          <p className="dna-rail__linter-engine">
            Engine: {warning.seleneCorrelation.engine} · {warning.seleneCorrelation.rule}
            {warning.seleneCorrelation.threshold != null
              ? ` (threshold: ${warning.seleneCorrelation.threshold})`
              : ''}
          </p>
        </div>
      )}
    </div>
  )
})
