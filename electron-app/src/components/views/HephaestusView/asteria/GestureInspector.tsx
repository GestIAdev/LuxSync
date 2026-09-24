/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 GESTURE INSPECTOR — WAVE 8181: LA SUPERFICIE PARAMÉTRICA
 *
 * El bloque que el blueprint §6.2 reservó bajo el Gesture Stack y que las
 * WAVEs intermedias ocuparon con TARGET/COMPILE. Lee `selectedGestureId`
 * y renderiza controles por `kind` — todo parche va a `updateGesture`,
 * que ya coalescea ráfagas de slider a UN paso de undo (300 ms) y dispara
 * el pipeline vivo (debounce 150 ms → fieldEngine → compile → Feedback
 * Layer): el canvas refleja el cambio sin interacción adicional.
 *
 *   ┌─ INSPECTOR ──────────────────────┐
 *   │  A  GLYPH · glyph-3              │
 *   │  TEXT    [ LUX____________]      │
 *   │  CHANNEL [GAIN|DELAY]            │
 *   │  SCALE   ▓▓▓░░ 1.4 m             │
 *   │  ROT     ▓░░░░ 0°                │
 *   │  GAIN    ▓▓▓▓░ 80 %  (solo DIM)  │
 *   └──────────────────────────────────┘
 *
 * `gain` es el campo de capa añadido en 8181: para gestos delay-only lo
 * estampa uniforme sobre los nodos cubiertos; para wave/glyph/manual
 * multiplica la contribución gain propia. Solo se muestra cuando el
 * DEFAULT PAINT incluye DIM (intensity) — sin dimmer en el campo, el
 * slider sería una promesa vacía.
 *
 * @module HephaestusView/asteria/GestureInspector
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react'
import { useAsteriaStore } from './store/useAsteriaStore'
import { useHephaestusEditorStore } from '../../../../core/hephaestus/store/useHephaestusEditorStore'
import type {
  BlendOp,
  Gesture,
  SliceGesture,
} from './model/AsteriaProject'
import type { HephParamId } from '../../../../core/hephaestus/types'
import { GHOST_RGB } from './model/gestureGhost'
import { measureGlyphLegibility } from './model/glyphRaster'
import { isAsteriaTrack } from './compiler/AsteriaCompiler'
import { SYNTH_SHAPES } from './compiler/synth/SynthSpec'
import type { SynthShape, SynthSpec } from './compiler/synth/SynthSpec'
import { envelope, resolveSpec } from './compiler/synth/envelopes'
import { ASTERIA_DEFAULT_SYNTH } from './model/AsteriaProject'

// ═══════════════════════════════════════════════════════════════════════════
// PRIMITIVAS DE CONTROL — una fila = label + input + readout
// ═══════════════════════════════════════════════════════════════════════════

interface NumRowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  disabled?: boolean
  title?: string
  onChange: (v: number) => void
}

function NumRow(p: NumRowProps): React.ReactElement {
  return (
    <label className="asteria-insp__row" title={p.title}>
      <span className="asteria-insp__label">{p.label}</span>
      <input
        type="range"
        className="asteria-insp__range"
        min={p.min}
        max={p.max}
        step={p.step}
        value={p.value}
        disabled={p.disabled}
        onChange={(e) => p.onChange(Number(e.target.value))}
      />
      <span className="asteria-insp__val">
        {p.value}
        {p.unit}
      </span>
    </label>
  )
}

interface CheckRowProps {
  label: string
  checked: boolean
  disabled?: boolean
  title?: string
  onChange: (v: boolean) => void
}

function CheckRow(p: CheckRowProps): React.ReactElement {
  return (
    <label className="asteria-insp__row asteria-insp__row--check" title={p.title}>
      <input
        type="checkbox"
        checked={p.checked}
        disabled={p.disabled}
        onChange={(e) => p.onChange(e.target.checked)}
      />
      <span className="asteria-insp__label">{p.label}</span>
    </label>
  )
}

interface SegRowProps<T extends string> {
  label: string
  options: readonly T[]
  value: T
  disabled?: boolean
  onChange: (v: T) => void
}

function SegRow<T extends string>(p: SegRowProps<T>): React.ReactElement {
  return (
    <div className="asteria-insp__row">
      <span className="asteria-insp__label">{p.label}</span>
      <div className="asteria-insp__seg">
        {p.options.map((o) => (
          <button
            key={o}
            type="button"
            className={`asteria-insp__segbtn ${o === p.value ? 'active' : ''}`}
            disabled={p.disabled}
            onClick={() => p.onChange(o)}
          >
            {o.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}

const BLEND_OPS: readonly BlendOp[] = ['replace', 'add', 'min', 'max', 'mul']
const SLICE_AXES: readonly SliceGesture['axis'][] = [
  'x', 'z', 'radius', 'angle', 'dmx', 'zone',
]
const SLICE_SYMMETRIES: readonly SliceGesture['symmetry'][] = [
  'linear', 'mirror', 'center-out',
]

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const GestureInspector: React.FC = () => {
  const gesture = useAsteriaStore((s) =>
    s.project.stack.find((g) => g.id === s.selectedGestureId),
  )
  const updateGesture = useAsteriaStore((s) => s.updateGesture)
  const driftReadOnly = useAsteriaStore((s) => s.driftReadOnly)
  const dimTarget = useAsteriaStore((s) =>
    s.project.defaultPaint.params.includes('intensity'),
  )
  const atlas = useAsteriaStore((s) => s.nodeAtlas)

  if (!gesture) {
    return (
      <div className="asteria-rail__section">
        <div className="asteria-rail__title">INSPECTOR</div>
        <div className="asteria-rail__muted">
          select a stack layer to edit its parameters
        </div>
        {/* 🜨 WAVE 8184 (M2): STRATEGY es de proyecto — visible siempre */}
        <StrategyRows />
      </div>
    )
  }

  const ro = driftReadOnly
  const patch = (p: Partial<Gesture>) => updateGesture(gesture.id, p)
  const rgb = GHOST_RGB[gesture.kind]
  const maskCount =
    gesture.kind === 'base'
      ? null
      : gesture.kind === 'manual'
        ? gesture.entries.length
        : gesture.mask.nodeIds.length

  return (
    <div className="asteria-rail__section asteria-insp">
      <div className="asteria-rail__title asteria-insp__header">
        <span>INSPECTOR</span>
        <span
          className="asteria-insp__kind"
          style={{ color: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` }}
        >
          {gesture.kind.toUpperCase()}
        </span>
      </div>
      <div className="asteria-rail__muted asteria-insp__id">
        {gesture.id}
        {maskCount !== null && ` · ${maskCount}n`}
      </div>

      {/* 🜨 WAVE 8203 (M3): CARD UI — la superficie paramétrica del
          gesto en su propio panel discreto (herramientas base) */}
      <section className="asteria-card">
        <div className="asteria-card__title">GESTURE</div>

      {/* ── OP de mezcla (todos los gestos enmascarados) ── */}
      {gesture.kind !== 'base' && gesture.kind !== 'manual' && (
        <SegRow
          label="OP"
          options={BLEND_OPS}
          value={gesture.op}
          disabled={ro}
          onChange={(v) => patch({ op: v })}
        />
      )}

      {/* ── BASE ── */}
      {gesture.kind === 'base' && (
        <NumRow
          label="DELAY" unit="ms" min={0} max={4000} step={10}
          value={gesture.delayMs} disabled={ro}
          onChange={(v) => patch({ delayMs: v })}
        />
      )}

      {/* ── WAVE ── */}
      {gesture.kind === 'wave' && (
        <>
          <SegRow
            label="SHAPE"
            options={['point', 'line', 'ring'] as const}
            value={gesture.shape}
            disabled={ro}
            onChange={(v) => patch({ shape: v })}
          />
          <NumRow
            label="SPEED" unit=" m/s" min={0.5} max={40} step={0.5}
            value={gesture.speedMps} disabled={ro}
            title="Wavefront speed — delay = distance / speed"
            onChange={(v) => patch({ speedMps: v })}
          />
          <NumRow
            label="FALLOFF" unit=" m" min={0} max={20} step={0.25}
            value={gesture.falloffM ?? 0} disabled={ro}
            title="Distance-based gain attenuation — 0 = no falloff"
            onChange={(v) =>
              patch({ falloffM: v <= 0 ? undefined : v })
            }
          />
          {gesture.shape === 'line' && (
            <NumRow
              label="DIR" unit="°" min={0} max={360} step={1}
              value={gesture.dirDeg ?? 0} disabled={ro}
              onChange={(v) => patch({ dirDeg: v })}
            />
          )}
        </>
      )}

      {/* ── CHRONO — post-proceso no destructivo §T3 ── */}
      {gesture.kind === 'chrono' && (
        <>
          <NumRow
            label="RADIUS" unit=" m" min={0.05} max={2} step={0.05}
            value={gesture.radiusM} disabled={ro}
            title="Brush width — nodes within ≤ radiusM of the stroke"
            onChange={(v) => patch({ radiusM: v })}
          />
          <NumRow
            label="T·SCALE" unit="×" min={0.25} max={4} step={0.05}
            value={gesture.timeScale ?? 1} disabled={ro}
            title="Time scale — >1 stretches the chase, <1 compresses it"
            onChange={(v) => patch({ timeScale: v })}
          />
          <CheckRow
            label="Reverse direction"
            checked={gesture.invert === true} disabled={ro}
            onChange={(v) => patch({ invert: v || undefined })}
          />
          <CheckRow
            label="Capture velocity (off = arc-length)"
            checked={gesture.captureRealTime} disabled={ro}
            onChange={(v) => patch({ captureRealTime: v })}
          />
          <div className="asteria-rail__muted">
            {gesture.stroke.length} pts ·{' '}
            {gesture.stroke.length > 0
              ? `${gesture.stroke[gesture.stroke.length - 1].tMs} ms captured`
              : 'empty stroke'}
          </div>
        </>
      )}

      {/* ── GLYPH ── */}
      {gesture.kind === 'glyph' && (
        <>
          <label className="asteria-insp__row">
            <span className="asteria-insp__label">TEXT</span>
            <input
              type="text"
              className="asteria-insp__text"
              value={gesture.text ?? ''}
              disabled={ro}
              spellCheck={false}
              onChange={(e) => patch({ text: e.target.value })}
            />
          </label>
          <SegRow
            label="CHANNEL"
            options={['gain', 'delay'] as const}
            value={gesture.channel === 'both' ? 'gain' : gesture.channel}
            disabled={ro}
            onChange={(v) => patch({ channel: v })}
          />
          <NumRow
            label="SCALE" unit=" m" min={0.3} max={12} step={0.1}
            value={gesture.transform.scaleM} disabled={ro}
            title="Text height in meters (7 rows of the 5×7 font)"
            onChange={(v) =>
              patch({ transform: { ...gesture.transform, scaleM: v } })
            }
          />
          <NumRow
            label="ROT" unit="°" min={-180} max={180} step={1}
            value={gesture.transform.rotDeg} disabled={ro}
            onChange={(v) =>
              patch({ transform: { ...gesture.transform, rotDeg: v } })
            }
          />
          <CheckRow
            label="Bilinear antialiasing"
            checked={gesture.antialias} disabled={ro}
            onChange={(v) => patch({ antialias: v })}
          />
          <CheckRow
            label="Invert mask (stencil)"
            checked={gesture.invert === true} disabled={ro}
            onChange={(v) => patch({ invert: v || undefined })}
          />
          <CheckRow
            label="Hard threshold (binary)"
            checked={gesture.threshold !== undefined} disabled={ro}
            onChange={(v) =>
              patch({ threshold: v ? 0.5 : undefined })
            }
          />
          {gesture.threshold !== undefined && (
            <NumRow
              label="THR" unit="" min={0.05} max={1} step={0.05}
              value={gesture.threshold} disabled={ro}
              onChange={(v) => patch({ threshold: v })}
            />
          )}
          {/* Legibilidad — antes vivía en el rail (bloque GLYPH);
              ahora pertenece al gesto seleccionado */}
          {atlas && (
            <GlyphLegibility gesture={gesture} atlas={atlas} />
          )}
        </>
      )}

      {/* ── SLICE ── */}
      {gesture.kind === 'slice' && (
        <>
          <SegRow
            label="AXIS"
            options={SLICE_AXES}
            value={gesture.axis}
            disabled={ro}
            onChange={(v) => patch({ axis: v })}
          />
          <NumRow
            label="BUCKETS" unit="" min={1} max={32} step={1}
            value={gesture.buckets} disabled={ro}
            onChange={(v) => patch({ buckets: Math.round(v) })}
          />
          <NumRow
            label="SPAN" unit="ms" min={0} max={5000} step={50}
            value={gesture.spanMs} disabled={ro}
            onChange={(v) => patch({ spanMs: v })}
          />
          <SegRow
            label="SYMM"
            options={SLICE_SYMMETRIES}
            value={gesture.symmetry}
            disabled={ro}
            onChange={(v) => patch({ symmetry: v })}
          />
          <CheckRow
            label="Shuffle (PhaseConfigPro hash)"
            checked={gesture.shuffleSeed !== undefined} disabled={ro}
            onChange={(v) => patch({ shuffleSeed: v ? 42 : undefined })}
          />
          {gesture.shuffleSeed !== undefined && (
            <NumRow
              label="SEED" unit="" min={1} max={999} step={1}
              value={gesture.shuffleSeed} disabled={ro}
              onChange={(v) => patch({ shuffleSeed: Math.round(v) })}
            />
          )}
        </>
      )}

      {/* ── NOISE ── */}
      {gesture.kind === 'noise' && (
        <>
          <NumRow
            label="SEED" unit="" min={0} max={9999} step={1}
            value={gesture.seed} disabled={ro}
            onChange={(v) => patch({ seed: Math.round(v) })}
          />
          <NumRow
            label="SCALE" unit=" m" min={0.1} max={10} step={0.1}
            value={gesture.scaleM} disabled={ro}
            title="Grain size in meters"
            onChange={(v) => patch({ scaleM: v })}
          />
          <NumRow
            label="AMOUNT" unit="ms" min={0} max={5000} step={25}
            value={gesture.amountMs} disabled={ro}
            onChange={(v) => patch({ amountMs: v })}
          />
          <SegRow
            label="OCT"
            options={['1', '2', '3'] as const}
            value={String(gesture.octaves) as '1' | '2' | '3'}
            disabled={ro}
            onChange={(v) =>
              patch({ octaves: Number(v) as 1 | 2 | 3 })
            }
          />
        </>
      )}

      {/* ── MANUAL ── */}
      {gesture.kind === 'manual' && (
        <div className="asteria-rail__muted">
          {gesture.entries.length} entries — cellular editing via Cell
          Surgeon (✜ double-click a fixture)
        </div>
      )}

      {/* ── GAIN de capa — solo si el TARGET incluye DIM ── */}
      {dimTarget && (
        <NumRow
          label="GAIN" unit=" %" min={0} max={100} step={1}
          value={Math.round(
            (gesture.kind === 'base'
              ? gesture.gain
              : (gesture.gain ?? 1)) * 100,
          )}
          disabled={ro}
          title={
            gesture.kind === 'glyph' && gesture.channel === 'delay'
              ? 'Glyph sweeps the DELAY channel — gain does not apply'
              : 'Gain stamped by this layer over covered nodes'
          }
          onChange={(v) => patch({ gain: v / 100 })}
        />
      )}
      </section>

      {/* 🜨 WAVE 8194: PAINT — pintura por capa (Crux 2). `paint`
          undefined → hereda defaultPaint entero; con paint, cada campo
          ausente sigue heredando (Partial<LayerPaint> — §3.1). */}
      <PaintRows gesture={gesture} patch={patch} ro={ro} />

      {/* 🜨 WAVE 8184 (M2): STRATEGY — controles de proyecto al pie
          del inspector (alcanzables con o sin gesto seleccionado) */}
      <StrategyRows />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 🜨 WAVE 8194 — PAINT (por capa, Crux 2 §3.1)
// ═══════════════════════════════════════════════════════════════════════════

/** Params con canal sintetizable que la UI ofrece como chips. */
const PAINT_PARAMS: readonly HephParamId[] = [
  'intensity', 'color', 'white', 'amber', 'strobe',
  'pan', 'tilt', 'zoom', 'focus', 'iris',
]

const PaintRows: React.FC<{
  gesture: Gesture
  patch: (p: Partial<Gesture>) => void
  ro: boolean
}> = ({ gesture, patch, ro }) => {
  const defaultPaint = useAsteriaStore((s) => s.project.defaultPaint)
  const paint = gesture.paint
  const effParams = paint?.params ?? defaultPaint.params
  const effColor = paint?.color ?? defaultPaint.color
  const effOpacity = paint?.opacity ?? defaultPaint.opacity ?? 1

  const toggleParam = (p: HephParamId): void => {
    const cur = [...effParams]
    const idx = cur.indexOf(p)
    if (idx >= 0) {
      if (cur.length <= 1) return // un paint jamás queda sin params
      cur.splice(idx, 1)
    } else {
      cur.push(p)
    }
    patch({ paint: { ...(paint ?? {}), params: cur } })
  }

  return (
    <>
      <section className="asteria-card">
        <div className="asteria-card__title">PAINT</div>
      <div
        className="asteria-insp__row"
        title="Parameters painted by this layer — the scalar planes (and the color plane) receiving its geometry"
      >
        <span className="asteria-insp__label">PARAMS</span>
        <div
          className="asteria-insp__seg"
          style={{ flexWrap: 'wrap', gap: 2 }}
        >
          {PAINT_PARAMS.map((p) => (
            <button
              key={p}
              type="button"
              className={`asteria-insp__segbtn ${effParams.includes(p) ? 'active' : ''}`}
              disabled={ro}
              onClick={() => toggleParam(p)}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      {effParams.includes('color') && (
        <label
          className="asteria-insp__row"
          title="Color this layer pours into the color plane (sRGB — blending happens in linear RGB)"
        >
          <span className="asteria-insp__label">COLOR</span>
          <input
            type="color"
            className="asteria-insp__text"
            style={{ padding: 0, height: 22 }}
            value={effColor}
            disabled={ro}
            onChange={(e) =>
              patch({ paint: { ...(paint ?? {}), color: e.target.value } })
            }
          />
        </label>
      )}
      <NumRow
        label="OPACITY"
        unit=" %"
        min={0}
        max={100}
        step={1}
        value={Math.round(effOpacity * 100)}
        disabled={ro}
        title="Layer coverage over the color canvas — 0% = transparent (the node keeps Selene's base color)"
        onChange={(v) =>
          patch({ paint: { ...(paint ?? {}), opacity: v / 100 } })
        }
      />
      </section>
      {/* 🜨 WAVE 8195 (§4.5): SYNTH — la forma de onda ES de la capa.
          SOURCE: SYNTH (envelope local) o RIDE → pista Forge. */}
      <SynthRows gesture={gesture} patch={patch} ro={ro} />
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 🜨 WAVE 8195 — SYNTH por capa (Crux 3 closure, §4.5)
// ═══════════════════════════════════════════════════════════════════════════

const SynthRows: React.FC<{
  gesture: Gesture
  patch: (p: Partial<Gesture>) => void
  ro: boolean
}> = ({ gesture, patch, ro }) => {
  const defaultPaint = useAsteriaStore((s) => s.project.defaultPaint)
  const paint = gesture.paint
  const lut = paint?.lut ?? defaultPaint.lut
  const synth = resolveSpec(
    paint?.synth ?? defaultPaint.synth ?? ASTERIA_DEFAULT_SYNTH,
  )
  // Pistas Forge candidatas a Ride — las ast_* nunca se ofrecen (hacer
  // ride de una curva sintética sería ruido recursivo). El filter va en
  // useMemo: un .filter() dentro del selector devuelve array nuevo en
  // cada getSnapshot → bucle infinito de useSyncExternalStore.
  const clipTracks = useHephaestusEditorStore((s) => s.clip.tracks)
  const forgeTracks = React.useMemo(
    () => clipTracks.filter((t) => !isAsteriaTrack(t.id)),
    [clipTracks],
  )
  const riding = lut?.kind === 'ride'
  const rideMissing =
    riding && !forgeTracks.some((t) => t.id === lut.trackId)

  const setSynth = (p: Partial<SynthSpec>): void =>
    patch({
      paint: {
        ...(paint ?? {}),
        synth: {
          shape: synth.shape,
          duty: synth.duty,
          edge: synth.edge,
          ...(paint?.synth ?? {}),
          ...p,
        },
      },
    })

  return (
    <section className="asteria-card">
      <div className="asteria-card__title">SYNTH</div>
      <label
        className="asteria-insp__row"
        title="Waveform source for this layer — SYNTH synthesizes the local envelope; RIDE clones a Forge track curve and emits delays only (phaseOverrides)"
      >
        <span className="asteria-insp__label">SOURCE</span>
        <select
          className="asteria-insp__select"
          value={riding ? lut.trackId : ''}
          disabled={ro}
          onChange={(e) => {
            const v = e.target.value
            patch({
              paint: {
                ...(paint ?? {}),
                lut: v === '' ? undefined : { kind: 'ride', trackId: v },
              },
            })
          }}
        >
          <option value="">SYNTH</option>
          {forgeTracks.map((t) => (
            <option key={t.id} value={t.id}>
              RIDE → {t.paramId.toUpperCase()} · {t.id}
            </option>
          ))}
          {/* La fuente ride persistida puede haber desaparecido del clip
              (pista Forge borrada) — la opción fantasma deja ver el
              estado real en lugar de fingir SYNTH */}
          {rideMissing && riding && (
            <option value={lut.trackId}>
              ⚠ {lut.trackId} (track lost)
            </option>
          )}
        </select>
      </label>
      {rideMissing && (
        <div className="asteria-rail__warn">
          ⚠ RIDE_SOURCE_MISSING — compiler falls back to local synth
        </div>
      )}
      {!riding && (
        <>
          <div className="asteria-insp__row">
            <span className="asteria-insp__label">SHAPE</span>
            <select
              className="asteria-insp__select"
              value={synth.shape}
              disabled={ro}
              title="Waveform the compiler synthesizes as the base curve of this layer's tracks — PULSE is the classic Λ trapezoid; LASER is an ultra-narrow hard-edge pulse"
              onChange={(e) =>
                setSynth({ shape: e.target.value as SynthShape })
              }
            >
              {SYNTH_SHAPES.map((s) => (
                <option key={s} value={s}>
                  {s.toUpperCase()}
                </option>
              ))}
            </select>
            <SynthSpark spec={synth} />
          </div>
          <NumRow
            label="DUTY"
            unit=" %"
            min={1}
            max={100}
            step={1}
            value={Math.round(synth.duty * 100)}
            disabled={ro}
            title="Pulse width within the cycle — where the falling edge lands"
            onChange={(v) => setSynth({ duty: v / 100 })}
          />
          <NumRow
            label="EDGE"
            unit=" %"
            min={0}
            max={100}
            step={1}
            value={Math.round(synth.edge * 100)}
            disabled={ro}
            title="Edge hardness — 100% = ε=1 ms (hard); lower values soften hold/ε into ramps"
            onChange={(v) => setSynth({ edge: v / 100 })}
          />
        </>
      )}
    </section>
  )
}

/** 🜨 Sparkline de la envolvente (§4.5): ≤ 12 puntos SVG, puro. */
const SynthSpark: React.FC<{ spec: Required<SynthSpec> }> = ({ spec }) => {
  const pts = envelope(spec)
  // Muestreo uniforme a ≤12 puntos sobre la envolvente normalizada.
  const N = 12
  const W = 56
  const H = 20
  const sample = (t: number): number => {
    if (pts.length === 0) return 0
    let prev = pts[0]
    for (let i = 1; i < pts.length; i++) {
      const cur = pts[i]
      if (t <= cur.t || i === pts.length - 1) {
        if (prev.interp === 'hold' || cur.t === prev.t) return prev.v
        const u = (t - prev.t) / (cur.t - prev.t)
        const k =
          prev.interp === 'bezier' && prev.bz !== undefined
            ? u * u * (3 - 2 * u) // smoothstep ≈ ease-in-out
            : u
        return prev.v + (cur.v - prev.v) * k
      }
      prev = cur
    }
    return pts[pts.length - 1].v
  }
  const d = Array.from({ length: N }, (_, i) => {
    const t = i / (N - 1)
    const x = (t * W).toFixed(1)
    const y = ((1 - sample(t)) * H).toFixed(1)
    return `${i === 0 ? 'M' : 'L'}${x},${y}`
  }).join(' ')
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="asteria-insp__spark"
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * 🜨 WAVE 8195 (§4.5): STRATEGY queda reducido al sesgo del planificador.
 * La forma de onda ya NO es global — vive en PAINT → SYNTH de cada capa
 * (`paint.synth`/`paint.lut`). COMPILER solo sesga `planEmission`
 * (AUTO/Λ/COHORT/MCC), nunca selecciona waveform.
 */
const StrategyRows: React.FC = () => {
  const strategy = useAsteriaStore((s) => s.project.strategy)
  const setStrategy = useAsteriaStore((s) => s.setStrategy)
  const driftReadOnly = useAsteriaStore((s) => s.driftReadOnly)

  return (
    <section className="asteria-card">
      <div className="asteria-card__title">STRATEGY</div>
      <label className="asteria-insp__row" title="Field compilation strategy — planner bias, not waveform. AUTO picks from the tree; Λ one track+offsets; COHORT gain cubes; MCC-CELL one track per cell; MCC-DEVICE cohorts + surgical cell=nodeId isolation on spills (COHORT_ZONE_SPILL)">
        <span className="asteria-insp__label">COMPILER</span>
        <select
          className="asteria-insp__select"
          value={strategy}
          disabled={driftReadOnly}
          onChange={(e) =>
            setStrategy(e.target.value as typeof strategy)
          }
        >
          <option value="auto">AUTO</option>
          <option value="lambda">Λ · LAMBDA</option>
          <option value="cohort">COHORT</option>
          <option value="mcc">MCC · CELL</option>
          <option value="mcc-device">MCC · DEVICE</option>
        </select>
      </label>
    </section>
  )
}

/** Readout de legibilidad del glifo seleccionado (ex-bloque GLYPH del rail). */
const GlyphLegibility: React.FC<{
  gesture: Extract<Gesture, { kind: 'glyph' }>
  atlas: NonNullable<ReturnType<typeof useAsteriaStore.getState>['nodeAtlas']>
}> = ({ gesture, atlas }) => {
  const leg = measureGlyphLegibility(atlas, gesture)
  return (
    <>
      <div className="asteria-rail__muted">
        {leg.nodesPerMeter.toFixed(1)} nodes/m · {leg.rowsResolved}/7 rows ·{' '}
        {leg.colsResolved} cols
      </div>
      {!leg.legible && (
        <div className="asteria-rail__warn">
          ⚠ Suboptimal resolution — the text still compiles
        </div>
      )}
    </>
  )
}

export default GestureInspector
