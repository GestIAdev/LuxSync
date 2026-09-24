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
 * TARGET incluye DIM (intensity) — sin dimmer en el campo, el slider
 * sería una promesa vacía.
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
import { GHOST_RGB } from './model/gestureGhost'
import { measureGlyphLegibility } from './model/glyphRaster'
import { isAsteriaTrack } from './compiler/AsteriaCompiler'
import { SYNTH_SHAPES } from './compiler/synth/SynthSpec'
import type { SynthShape } from './compiler/synth/SynthSpec'

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
    s.project.targetParams.includes('intensity'),
  )
  const atlas = useAsteriaStore((s) => s.nodeAtlas)

  if (!gesture) {
    return (
      <div className="asteria-rail__section">
        <div className="asteria-rail__title">INSPECTOR</div>
        <div className="asteria-rail__muted">
          selecciona una capa del stack para editar sus parámetros
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
            title="Velocidad del frente — delay = distancia / speed"
            onChange={(v) => patch({ speedMps: v })}
          />
          <NumRow
            label="FALLOFF" unit=" m" min={0} max={20} step={0.25}
            value={gesture.falloffM ?? 0} disabled={ro}
            title="Atenúa gain con la distancia — 0 = sin falloff"
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
            title="Ancho del pincel — nodos a ≤ radiusM del trazo"
            onChange={(v) => patch({ radiusM: v })}
          />
          <NumRow
            label="T·SCALE" unit="×" min={0.25} max={4} step={0.05}
            value={gesture.timeScale ?? 1} disabled={ro}
            title="Escala temporal — >1 estira el chase, <1 lo comprime"
            onChange={(v) => patch({ timeScale: v })}
          />
          <CheckRow
            label="INVERT — el final del trazo dispara primero"
            checked={gesture.invert === true} disabled={ro}
            onChange={(v) => patch({ invert: v || undefined })}
          />
          <CheckRow
            label="REALTIME — tempo del arrastre (off = arc-length)"
            checked={gesture.captureRealTime} disabled={ro}
            onChange={(v) => patch({ captureRealTime: v })}
          />
          <div className="asteria-rail__muted">
            {gesture.stroke.length} pts ·{' '}
            {gesture.stroke.length > 0
              ? `${gesture.stroke[gesture.stroke.length - 1].tMs} ms capturados`
              : 'trazo vacío'}
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
            title="Alto del texto en metros (7 filas de la fuente 5×7)"
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
            label="ANTIALIAS — cobertura bilinear (off = muestreo duro)"
            checked={gesture.antialias} disabled={ro}
            onChange={(v) => patch({ antialias: v })}
          />
          <CheckRow
            label="INVERT — el texto bloquea la luz (negro sobre blanco)"
            checked={gesture.invert === true} disabled={ro}
            onChange={(v) => patch({ invert: v || undefined })}
          />
          <CheckRow
            label="THRESHOLD — meseta dura {0,1}"
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
            label="SHUFFLE — hash PhaseConfigPro (paridad Phase Canvas)"
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
            title="Tamaño del grano en metros"
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
          {gesture.entries.length} entries — edición celular vía Cell
          Surgeon (✜ doble clic sobre el fixture)
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
              ? 'El glifo barre en canal DELAY — gain no aplica'
              : 'Gain estampado por esta capa sobre los nodos cubiertos'
          }
          onChange={(v) => patch({ gain: v / 100 })}
        />
      )}

      {/* 🜨 WAVE 8184 (M2): STRATEGY — controles de proyecto al pie
          del inspector (alcanzables con o sin gesto seleccionado) */}
      <StrategyRows />
    </div>
  )
}

/**
 * 🜨 WAVE 8184 (M2): STRATEGY — sub-panel global del proyecto.
 * LUT SOURCE: la curva que los tracks ast_* reutilizan.
 *   'preset' → el compilador sintetiza el pulso Λ (Auto-Synth).
 *   'ride'   → clona la curva de una pista Forge existente: el ast_*
 *             emite SOLO phaseOverrides sobre esa forma de onda exacta
 *             (la pista madre jamás se sobreescribe — §8.2).
 */
const StrategyRows: React.FC = () => {
  const lutSource = useAsteriaStore((s) => s.project.lutSource)
  const setLutSource = useAsteriaStore((s) => s.setLutSource)
  const defaultSynth = useAsteriaStore((s) => s.project.defaultSynth)
  const setDefaultSynth = useAsteriaStore((s) => s.setDefaultSynth)
  const strategy = useAsteriaStore((s) => s.project.strategy)
  const setStrategy = useAsteriaStore((s) => s.setStrategy)
  const driftReadOnly = useAsteriaStore((s) => s.driftReadOnly)
  // Pistas Forge candidatas a Ride — las ast_* nunca se ofrecen
  // (hacer ride de una curva sintética sería ruido recursivo).
  // Selector = referencia estable del array; el filter va en useMemo —
  // un .filter() dentro del selector devuelve array nuevo en cada
  // getSnapshot → bucle infinito de useSyncExternalStore.
  const clipTracks = useHephaestusEditorStore((s) => s.clip.tracks)
  const forgeTracks = React.useMemo(
    () => clipTracks.filter((t) => !isAsteriaTrack(t.id)),
    [clipTracks],
  )

  const value = lutSource.kind === 'ride' ? lutSource.trackId : ''
  const rideMissing =
    lutSource.kind === 'ride' &&
    !forgeTracks.some((t) => t.id === lutSource.trackId)

  return (
    <>
      <div className="asteria-insp__divider" />
      <div className="asteria-rail__title asteria-insp__strategy">
        STRATEGY
      </div>
      <label className="asteria-insp__row" title="Estrategia de compilación del campo — AUTO elige por el árbol; Λ una pista+offsets; COHORT cubos por gain; MCC-CELL pista por celda; MCC-DEVICE cohortes + aislamiento quirúrgico cell=nodeId en las que derraman (COHORT_ZONE_SPILL)">
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
      <label className="asteria-insp__row" title="Fuente de la forma de onda de los tracks ast_* — Auto-Synth sintetiza el pulso Λ; Ride clona una curva de Forge y emite solo los retardos (phaseOverrides)">
        <span className="asteria-insp__label">LUT SRC</span>
        <select
          className="asteria-insp__select"
          value={value}
          disabled={driftReadOnly}
          onChange={(e) => {
            const v = e.target.value
            setLutSource(
              v === ''
                ? { kind: 'preset', name: 'default' }
                : { kind: 'ride', trackId: v },
            )
          }}
        >
          <option value="">AUTO-SYNTH Λ</option>
          {forgeTracks.map((t) => (
            <option key={t.id} value={t.id}>
              RIDE → {t.paramId.toUpperCase()} · {t.id}
            </option>
          ))}
          {/* La fuente ride persistida puede haber desaparecido del clip
              (pista Forge borrada) — la opción fantasma deja ver el
              estado real en lugar de fingir Auto-Synth */}
          {rideMissing && (
            <option value={value}>
              ⚠ {lutSource.kind === 'ride' ? lutSource.trackId : ''} (pista perdida)
            </option>
          )}
        </select>
      </label>
      {rideMissing && (
        <div className="asteria-rail__warn">
          ⚠ RIDE_SOURCE_MISSING — el compilador cae al pulso Λ
        </div>
      )}
      {/* 🜨 WAVE 8191: SHAPE — la forma de onda sintetizada, provisional
          a nivel de proyecto (baja a por-capa en la WAVE 8195). Solo
          tiene sentido con LUT SRC = AUTO-SYNTH; con Ride la curva
          la dicta la pista Forge clonada. */}
      {lutSource.kind === 'preset' && (
        <label className="asteria-insp__row" title="Forma de onda que el compilador sintetiza como curva base de los tracks ast_* — PULSE es el trapezoide Λ clásico; LASER es un pulso ultra-estrecho de flancos duros (la línea de luz que barre el rig con un gesto Wave)">
          <span className="asteria-insp__label">SHAPE</span>
          <select
            className="asteria-insp__select"
            value={defaultSynth?.shape ?? 'pulse'}
            disabled={driftReadOnly}
            onChange={(e) =>
              setDefaultSynth({ shape: e.target.value as SynthShape })
            }
          >
            {SYNTH_SHAPES.map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
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
        {leg.nodesPerMeter.toFixed(1)} nodos/m · {leg.rowsResolved}/7 filas ·{' '}
        {leg.colsResolved} cols
      </div>
      {!leg.legible && (
        <div className="asteria-rail__warn">
          ⚠ Resolución subóptima — el texto compila igualmente
        </div>
      )}
    </>
  )
}

export default GestureInspector
