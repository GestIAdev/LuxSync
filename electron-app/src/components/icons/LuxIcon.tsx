/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 <LuxIcon name="..." /> — WAVE 4921 (Atomic Paradigm · Fase 2)
 *
 * Wrapper polimórfico sobre la librería custom `LuxIcons.tsx`. Existe para
 * dar un punto de uso *declarativo* (string name) sobre la API de componentes
 * nombrados (PlayIcon, SaveIcon, …) que ya vive en `LuxIcons.tsx`.
 *
 *   <LuxIcon name="play" size={18} />
 *   <LuxIcon name="trim" />
 *   <LuxIcon name="dna" color="#a855f7" />
 *
 * Filosofía:
 *   - Premium-first: SIN Lucide, SIN emojis. Solo SVGs custom.
 *   - Type-safe: `name` está restringido al union `LuxIconName`.
 *   - Tree-shake friendly: el switch importa los componentes ya cargados.
 *   - Forward-compatible: añadir un alias = una línea en `ICON_MAP`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react'
import type { IconProps } from './LuxIcons'
import {
  // Transport / playback
  PlayIcon,
  PauseIcon,
  StopIcon,
  PlayCircleIcon,
  // Workshop
  ScenesIcon,
  BrainNeuralIcon,
  // File / asset I/O
  SaveIcon,
  FileIcon,
  FolderIcon,
  TrashIcon,
  // UI affordances
  PlusIcon,
  XIcon,
  // Telemetry / state
  BoltIcon,
  TargetIcon,
  AudioWaveIcon,
  NetworkIcon,
  MixerIcon,
  // Effects (puedes ampliar el mapa libremente)
  StrobeIcon,
  LaserIcon,
  PrismIcon,
  // Asteria toolbox (WAVE 8204 — Luxicons Strict Mode)
  FocusIcon,
  LoopIcon,
  TrendUpIcon,
  WaveFxIcon,
  ClockIcon,
  TagIcon,
  SpectrumBarsIcon,
  ZoomIcon,
  ThermoColorIcon,
  ZapIcon,
} from './LuxIcons'

// ─── REGISTRO DE NOMBRES ──────────────────────────────────────────────────────

/**
 * Mapeo `slug → componente`. Las claves siguen kebab-case para alinearse con
 * convenciones CSS / data-attributes y son fáciles de propagar a docs/MIDI bindings.
 */
const ICON_MAP = {
  // Transport
  play:           PlayIcon,
  pause:          PauseIcon,
  stop:           StopIcon,
  'play-circle':  PlayCircleIcon,

  // Workshop / DNA
  trim:           ScenesIcon,       // proxy semántico: clappa = recorte
  dna:            BrainNeuralIcon,
  brain:          BrainNeuralIcon,
  target:         TargetIcon,

  // File I/O
  save:           SaveIcon,
  export:         SaveIcon,
  file:           FileIcon,
  folder:         FolderIcon,
  'folder-open':  FolderIcon,
  load:           FolderIcon,
  trash:          TrashIcon,
  delete:         TrashIcon,

  // UI affordances
  plus:           PlusIcon,
  add:            PlusIcon,
  x:              XIcon,
  close:          XIcon,

  // Telemetry
  bolt:           BoltIcon,
  power:          BoltIcon,
  wave:           AudioWaveIcon,
  audio:          AudioWaveIcon,
  network:        NetworkIcon,
  mixer:          MixerIcon,

  // Effects shortcuts
  strobe:         StrobeIcon,
  laser:          LaserIcon,
  prism:          PrismIcon,

  // ── Asteria toolbox (WAVE 8204) — slugs por semántica de herramienta ──
  cursor:         FocusIcon,          // select: crosshair de adquisición
  lasso:          LoopIcon,           // lazo cerrado
  radial:         TargetIcon,         // anillos concéntricos
  polygon:        PrismIcon,          // polígono angular
  line:           TrendUpIcon,        // segmento diagonal
  wavefront:      WaveFxIcon,         // frentes de onda paralelos
  chrono:         ClockIcon,          // tiempo / brush temporal
  glyph:          TagIcon,            // sello de texto
  text:           TagIcon,
  slicer:         SpectrumBarsIcon,   // cortes verticales
  noise:          AudioWaveIcon,      // campo de ruido (barras caóticas)
  surgeon:        ZoomIcon,           // bisturí celular = inspección
  cell:           ZoomIcon,
  heat:           ThermoColorIcon,    // mapa térmico
  thermo:         ThermoColorIcon,
  poke:           ZapIcon,            // descarga física L3++
  zap:            ZapIcon,
} as const

export type LuxIconName = keyof typeof ICON_MAP

// ─── PROPS ────────────────────────────────────────────────────────────────────

export interface LuxIconProps extends IconProps {
  /** Slug del icono (kebab-case). */
  name: LuxIconName
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

/**
 * Resolver runtime ligero. Si el `name` no existe en el mapa (caso imposible
 * bajo el typing), renderiza null para no romper el árbol.
 */
const LuxIcon: React.FC<LuxIconProps> = ({ name, ...iconProps }) => {
  const Component = ICON_MAP[name]
  if (!Component) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[LuxIcon] Unknown name '${name}' — render skipped`)
    }
    return null
  }
  return <Component {...iconProps} />
}

export default LuxIcon
