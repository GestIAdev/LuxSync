/**
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * ðŸ”¨ FIXTURE FORGE EMBEDDED - WAVE 1112: FUNCTIONAL CLOSURE & LIBRARY MANAGER
 * "The Blacksmith's Workshop" - Full-screen Fixture Editor (no modal overlay)
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * 
 * This component wraps the original FixtureForge but renders it embedded
 * in the main content area instead of as a modal overlay.
 * 
 * Key differences from modal version:
 * - No overlay backdrop
 * - No close button (navigation handled by sidebar)
 * - Full viewport width/height
 * - English labels (WAVE 1110 localization)
 * - LIBRARY tab for fixture browsing (WAVE 1112)
 * 
 * ðŸ”¥ WAVE 1121: COLOR ENGINE SELECTOR RESTORED
 * - Added COLOR ENGINE selector grid below FIXTURE CLASS
 * - CSS override in FixtureForgeEmbedded.css with !important
 * 
 * @module components/views/ForgeView/FixtureForgeEmbedded
 * @version 1121.0.0
 */

import React, { useState, useCallback, useEffect, useReducer, useRef, type ReactNode } from 'react'
// â”€â”€ WAVE 4732-A: Forge Hybrid Builder State â”€â”€
import {
  forgeReducer,
  makeInitialForgeState,
  drainForgeWarnings,
  type IForgeBuilderState,
  type ForgeAction,
  type IForgeCellBuilder,
} from '../../../core/forge/forgeBuilderState'
import { NodeFamily } from '../../../core/aether/types'
// â”€â”€ WAVE 4732-D: Drag & Drop (dnd-kit) â”€â”€
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  MouseSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
// â”€â”€ WAVE 4732-C: Compilador â”€â”€
import { canAdmit } from '../../../core/forge/cellTypeAdmittance'
import { compileForgeState, resolveChannelDeps } from '../../../core/forge/compileForgeState'
import './FixtureForgeEmbedded.css'
import { 
  GripVertical, 
  Server, 
  Factory, 
  Save, 
  Download,
  Share2,
  Upload,
  Eye,
  EyeOff,
  Sliders,
  Cpu,
  Cog,
  Settings,
  Settings2,
  Copy,
  AlertTriangle,
  Check,
  Palette,
  BookOpen,
  Lock,
  Zap,
  Plus,
  X as XIcon,
  Sun,
  Aperture,
  ArrowLeftRight,
  ArrowUpDown,
  Star,
  Triangle,
  Crosshair,
  ZoomIn,
  Timer,
  RotateCw,
  RotateCcw,
  Snowflake,
  Droplet,
  Code2,
} from 'lucide-react'
// WAVE 1117: Moved to shared components (modal folder deleted)
import { PhysicsTuner } from '../../shared/PhysicsTuner/PhysicsTuner'
import { WheelSmithEmbedded } from './WheelSmithEmbedded'
import { UniversalAssetBrowser } from '../../shared/AssetBrowser'
import type { LibraryAsset } from '../../../stores/assetAdapters'
import { 
  PhysicsProfile, 
  FixtureV2,
  MotorType
} from '../../../core/stage/ShowFileV2'
import { FixtureDefinition, ChannelType, FixtureChannel, ColorEngineType, WheelColor, FixtureType, IgnitionDependency, deriveCapabilities, deriveCapabilitiesUnified, DerivedCapabilities } from '../../../types/FixtureDefinition'
import { NodeGraphBuilder } from '../../../core/forge/NodeGraphBuilder'
import { FixtureFactory } from '../../../utils/FixtureFactory'
import { useStageStore } from '../../../stores/stageStore'
import { useShallow } from 'zustand/react/shallow'
import { useLibraryStore, selectFixtureForge } from '../../../stores/libraryStore'
import { useNavigationStore, selectFixtureForgeNav } from '../../../stores/navigationStore'
import { useForgeGraphStore } from '../../../stores/forgeGraphStore'
// WAVE 4548.8c: Inspector + Mode Switcher
import { NodeInspector } from './inspector/NodeInspector'
import { ForgeModeSwitcher, isSimpleCompatible, type ForgeEditMode } from './canvas/ForgeModeSwitcher'
// WAVE 1117: Recovered CSS from deleted modal (contains PhysicsTuner styles)
import './FixtureForge.css'
import './FixtureForgeEmbedded.css'  // Standalone styles for embedded mode

// â”€â”€ WAVE 4548.8b: NODE GRAPH UI (lazy-loaded â€” solo se carga en /forge) â”€â”€
const ForgeCanvasLayout = React.lazy(() => import('./canvas/ForgeCanvasLayout'))
const NodePalette = React.lazy(() => import('./canvas/NodePalette'))
const NodeCanvas = React.lazy(() => import('./canvas/NodeCanvas'))

// â”€â”€ WAVE 4548.10: Pack as Ingenio modal â”€â”€
import { PackIngenioModal } from './canvas/PackIngenioModal'
import ForgeChannelRackTab from './tabs/ForgeChannelRackTab'

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES - WAVE 1112: Added 'library' tab
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

type ForgeTabId = 'library' | 'general' | 'nodegraph' | 'channels' | 'wheelsmith' | 'physics' | 'export'
             | 'dmx-layout' | 'aether'

interface FixtureForgeEmbeddedProps {
  onSave: (
    fixture: FixtureDefinition, 
    physics: PhysicsProfile,
    patchData?: { dmxAddress?: number; universe?: number }
  ) => void
  editingFixture?: FixtureV2 | null
  existingDefinition?: FixtureDefinition | null
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CONSTANTS - English labels (WAVE 1112: LIBRARY tab added)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const TAB_CONFIG: { id: ForgeTabId; label: string; icon: React.ReactNode }[] = [
  { id: 'library',    label: 'LIBRARY',       icon: <BookOpen size={16} /> },
  { id: 'general',    label: 'GENERAL',       icon: <Settings size={16} /> },
  { id: 'nodegraph',  label: 'NODE GRAPH',    icon: <Share2 size={16} /> },
  { id: 'channels',   label: 'CHANNEL RACK',  icon: <Server size={16} /> },
  // â”€â”€ WAVE 4732-A: Hybrid Forge tabs â”€â”€
  { id: 'dmx-layout', label: 'DMX LAYOUT',    icon: <Zap size={16} /> },
  { id: 'aether',     label: 'AETHER CELLS',  icon: <Cpu size={16} /> },
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  { id: 'wheelsmith', label: 'WHEELSMITH',    icon: <Palette size={16} /> },
  { id: 'physics',    label: 'PHYSICS ENGINE',icon: <Cog size={16} /> },
  { id: 'export',     label: 'EXPORT',        icon: <Download size={16} /> },
]

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FUNCTION CATEGORY COLORS - WAVE 1111: THE GLOW
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const CATEGORY_COLORS: Record<string, string> = {
  INTENSITY: '#a0a0a0',   // White/Gray
  COLOR: '#ef4444',       // Red Neon
  POSITION: '#22d3ee',    // Cyan Neon
  BEAM: '#f59e0b',        // Yellow/Amber
  CONTROL: '#a855f7',     // Violet
}

function syncGraphOutputsWithChannels(graph: any, channels: FixtureChannel[]): any {
  if (!graph || !Array.isArray(graph.nodes) || channels.length === 0) return graph

  const channelByIndex = new Map<number, FixtureChannel>()
  const channelByIndexMinus1 = new Map<number, FixtureChannel>()
  for (const ch of channels) {
    channelByIndex.set(ch.index, ch)
    channelByIndexMinus1.set(ch.index - 1, ch)
  }

  const resolveChannelForOffset = (offset: number): FixtureChannel | undefined => {
    // Prefer exact 0-based match.
    const exact = channelByIndex.get(offset)
    if (exact) return exact

    // Legacy fallback for 1-based channel indexes.
    const shifted = channelByIndexMinus1.get(offset)
    if (shifted) return shifted

    // Last fallback by array position.
    return channels[offset]
  }

  const nextNodes = graph.nodes.map((node: any) => {
    const cfg = node?.config
    if (!cfg || cfg.nodeType !== 'output_dmx' || typeof cfg.dmxOffset !== 'number') {
      return node
    }

    const ch = resolveChannelForOffset(cfg.dmxOffset)
    if (!ch) return node

    return {
      ...node,
      config: {
        ...cfg,
        channelType: ch.type,
        channelName: ch.name || ch.type,
        defaultDmxValue: ch.defaultValue,
        is16bit: !!ch.is16bit,
        continuousRotation: ch.continuousRotation || undefined,
        ignitionDeps: ch.ignitionDeps && ch.ignitionDeps.length > 0
          ? ch.ignitionDeps.map((d) => ({
              channelType: d.channelType,
              requiredValue: d.requiredValue,
              targetChannelIndex: d.targetChannelIndex,
              mode: d.mode,
            }))
          : undefined,
      },
    }
  })

  return {
    ...graph,
    nodes: nextNodes,
  }
}

interface FunctionDef {
  type: ChannelType
  label: string
  color: string
  icon: ReactNode
  is16bit?: boolean
}

export const FUNCTION_PALETTE: Record<string, FunctionDef[]> = {
  'INTENSITY': [
    { type: 'dimmer',  label: 'Dimmer',  color: '#ffffff', icon: <Sun size={13} /> },
    { type: 'shutter', label: 'Shutter', color: '#a0a0a0', icon: <Aperture size={13} /> },
    { type: 'strobe',  label: 'Strobe',  color: '#ffd700', icon: <Zap size={13} /> },
  ],
  'COLOR': [
    { type: 'red',         label: 'Red',         color: '#ff0000', icon: <span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:'#ff3333', flexShrink:0 }} /> },
    { type: 'green',       label: 'Green',       color: '#00ff00', icon: <span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:'#00cc44', flexShrink:0 }} /> },
    { type: 'blue',        label: 'Blue',        color: '#0088ff', icon: <span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:'#0088ff', flexShrink:0 }} /> },
    { type: 'white',       label: 'White',       color: '#ffffff', icon: <span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:'#ffffff', border:'1px solid #555', flexShrink:0 }} /> },
    { type: 'amber',       label: 'Amber',       color: '#ffaa00', icon: <span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:'#ffaa00', flexShrink:0 }} /> },
    { type: 'uv',          label: 'UV',          color: '#bf00ff', icon: <span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:'#bf00ff', flexShrink:0 }} /> },
    { type: 'color_wheel', label: 'Color Wheel', color: '#ff00ff', icon: <Palette size={13} /> },
  ],
  'POSITION': [
    { type: 'pan',       label: 'Pan',      color: '#00f3ff', icon: <ArrowLeftRight size={13} /> },
    { type: 'pan_fine',  label: 'Pan Fine', color: '#0088aa', icon: <ArrowLeftRight size={11} /> },
    { type: 'tilt',      label: 'Tilt',     color: '#00f3ff', icon: <ArrowUpDown size={13} /> },
    { type: 'tilt_fine', label: 'Tilt Fine',color: '#0088aa', icon: <ArrowUpDown size={11} /> },
  ],
  'BEAM': [
    { type: 'gobo',  label: 'Gobo',  color: '#bf00ff', icon: <Star size={13} /> },
    { type: 'prism', label: 'Prism', color: '#dd00ff', icon: <Triangle size={13} /> },
    { type: 'focus', label: 'Focus', color: '#00ffcc', icon: <Crosshair size={13} /> },
    { type: 'zoom',  label: 'Zoom',  color: '#00ffcc', icon: <ZoomIn size={13} /> },
  ],
  'CONTROL': [
    { type: 'speed',   label: 'Speed',   color: '#ffeb3b', icon: <Timer size={13} /> },
    { type: 'macro',   label: 'Macro',   color: '#00ff44', icon: <Settings2 size={13} /> },
    { type: 'control', label: 'Control', color: '#00ff44', icon: <Settings size={13} /> },
  ],
  // WAVE 2084: INGENIOS -- Non-conventional device channels
  'INGENIOS': [
    { type: 'rotation',       label: 'Rotation',  color: '#ff6b35', icon: <RotateCw size={13} /> },
    { type: 'custom',         label: 'Custom',    color: '#b967ff', icon: <Code2 size={13} /> },
    { type: 'frost',          label: 'Frost',     color: '#88e1f2', icon: <Snowflake size={13} /> },
    { type: 'gobo_rotation',  label: 'Gobo Rot',  color: '#ffd700', icon: <RotateCw size={13} /> },
    { type: 'prism_rotation', label: 'Prism Rot', color: '#dd00ff', icon: <RotateCcw size={13} /> },
    { type: 'cyan',           label: 'Cyan',      color: '#00ffff', icon: <Droplet size={13} /> },
    { type: 'magenta',        label: 'Magenta',   color: '#ff00ff', icon: <Droplet size={13} /> },
    { type: 'yellow',         label: 'Yellow',    color: '#ffff00', icon: <Droplet size={13} /> },
  ],
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// WAVE 1120: FIXTURE TYPE CONFIG - Visual Type Selector
// "Cyberpunk Industrial" icons for each fixture class
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M8 14l-2 8M16 14l2 8M10 12v4M14 12v4"/></svg>
  },
  { 
    value: 'scanner', 
    label: 'Scanner', 
    color: '#a855f7',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="12" height="8" rx="1"/><path d="M12 12v6M8 22h8M12 18l4 4M12 18l-4 4"/></svg>
  },
  { 
    value: 'par', 
    label: 'Par', 
    color: '#ef4444',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>
  },
  { 
    value: 'bar', 
    label: 'LED Bar', 
    color: '#22c55e',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="8" width="20" height="8" rx="2"/><line x1="6" y1="10" x2="6" y2="14"/><line x1="10" y1="10" x2="10" y2="14"/><line x1="14" y1="10" x2="14" y2="14"/><line x1="18" y1="10" x2="18" y2="14"/></svg>
  },
  { 
    value: 'wash', 
    label: 'Wash', 
    color: '#3b82f6',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="10" rx="8" ry="5"/><path d="M4 10c0 6 8 10 8 10s8-4 8-10"/></svg>
  },
  { 
    value: 'strobe', 
    label: 'Strobe', 
    color: '#fbbf24',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
  },
  { 
    value: 'effect', 
    label: 'Effect', 
    color: '#ec4899',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2 7h7l-5.5 4 2 7-5.5-4-5.5 4 2-7L3 9h7z"/></svg>
  },
  { 
    value: 'laser', 
    label: 'Laser', 
    color: '#14b8a6',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h4M18 12h4M12 2v4M12 18v4"/><circle cx="12" cy="12" r="3"/><path d="M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
  },
  { 
    value: 'blinder', 
    label: 'Blinder', 
    color: '#f97316',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="8" height="12" rx="1"/><rect x="13" y="6" width="8" height="12" rx="1"/><circle cx="7" cy="12" r="2" fill="currentColor"/><circle cx="17" cy="12" r="2" fill="currentColor"/></svg>
  },
  { 
    value: 'generic', 
    label: 'Generic', 
    color: '#71717a',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/></svg>
  },
  // ðŸ”¥ WAVE 2084: INGENIOS â€” Tipos para dispositivos no convencionales
  { 
    value: 'fan', 
    label: 'Fan', 
    color: '#38bdf8',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="2"/><path d="M12 2C8 2 8 8 12 10C16 8 16 2 12 2z"/><path d="M22 12C22 8 16 8 14 12C16 16 22 16 22 12z"/><path d="M12 22C16 22 16 16 12 14C8 16 8 22 12 22z"/><path d="M2 12C2 16 8 16 10 12C8 8 2 8 2 12z"/></svg>
  },
  { 
    value: 'fog', 
    label: 'Fog/Haze', 
    color: '#94a3b8',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M3 11c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>
  },
  { 
    value: 'mirror-ball', 
    label: 'Mirror Ball', 
    color: '#c084fc',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8"/><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/><line x1="8" y1="4" x2="8" y2="20"/><line x1="16" y1="4" x2="16" y2="20"/></svg>
  },
  { 
    value: 'pyro', 
    label: 'Pyro', 
    color: '#f43f5e',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22c-4 0-7-3-7-7 0-6 7-13 7-13s7 7 7 13c0 4-3 7-7 7z"/><path d="M12 22c-2 0-3-2-3-4 0-3 3-7 3-7s3 4 3 7c0 2-1 4-3 4z"/></svg>
  },
]

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// WAVE 1120: CAPABILITY BADGES CONFIG
// Auto-generated badges based on channel analysis
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="5"/><circle cx="8" cy="16" r="5"/><circle cx="16" cy="16" r="5"/></svg> 
  },
  { 
    value: 'rgbw', 
    label: 'RGBW LEDs', 
    description: 'RGB + White LED', 
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="4"/><circle cx="16" cy="8" r="4"/><circle cx="8" cy="16" r="4"/><circle cx="16" cy="16" r="4"/></svg> 
  },
  { 
    value: 'wheel', 
    label: 'Color Wheel', 
    description: 'Mechanical wheel (Beams, Spots)', 
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M5.6 18.4L18.4 5.6"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg> 
  },
  { 
    value: 'cmy', 
    label: 'CMY Mixing', 
    description: 'Cyan/Magenta/Yellow flags', 
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="16" r="5"/><circle cx="8" cy="8" r="5"/><circle cx="16" cy="8" r="5"/></svg> 
  },
  { 
    value: 'hybrid', 
    label: 'Hybrid', 
    description: 'Wheel + LEDs combined', 
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="12" r="6"/><circle cx="18" cy="12" r="3"/><path d="M8 6v12M2 12h12"/></svg> 
  },
  { 
    value: 'none', 
    label: 'No Color', 
    description: 'Dimmer only (Strobes, etc)', 
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> 
  },
]

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HELPERS - WAVE 1111: Channel Category Detection
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Maps a ChannelType to its visual category for THE GLOW
 */
export function getChannelCategory(type: ChannelType): string {
  // Intensity category
  if (['dimmer', 'shutter', 'strobe'].includes(type)) return 'intensity'
  // Color category
  if (['red', 'green', 'blue', 'white', 'amber', 'uv', 'color_wheel', 'cyan', 'magenta', 'yellow'].includes(type)) return 'color'
  // Position category
  if (['pan', 'pan_fine', 'tilt', 'tilt_fine'].includes(type)) return 'position'
  // Beam category
  if (['gobo', 'gobo_rotation', 'prism', 'prism_rotation', 'focus', 'zoom', 'iris', 'frost'].includes(type)) return 'beam'
  // Control category
  if (['speed', 'macro', 'control', 'effect', 'reset'].includes(type)) return 'control'
  return ''
}

/**
 * Gets the color for a channel category - THE GLOW palette
 */
export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category.toUpperCase()] || ''
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// NODE GRAPH TAB â€” WAVE 4548.10
// Subcomponent aislado para que los hooks de clearGraph/selectedNodeIds no
// contaminan el Ã¡rbol de renderizado del componente padre en otras pestaÃ±as.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const NodeGraphTab: React.FC = () => {
  const selectedNodeIds  = useForgeGraphStore((s) => s.selectedNodeIds)
  const clearGraph       = useForgeGraphStore((s) => s.clearGraph)
  const [showPackModal, setShowPackModal] = React.useState(false)

  const handleClear = () => {
    if (window.confirm('Clear the canvas? This action removes all nodes and edges.')) {
      clearGraph()
    }
  }

  return (
    <div className="forge-nodegraph-panel">
      {/* Floating action bar â€” Pack + Clear */}
      <div className="forge-nodegraph-actions">
        {selectedNodeIds.size > 0 && (
          <button
            className="forge-nodegraph-btn forge-nodegraph-btn--pack"
            onClick={() => setShowPackModal(true)}
            title="Pack selection as reusable Ingenio"
          >
            Pack as Ingenio ({selectedNodeIds.size})
          </button>
        )}
        <button
          className="forge-nodegraph-btn forge-nodegraph-btn--clear"
          onClick={handleClear}
          title="Clear canvas"
        >
          Clear Canvas
        </button>
      </div>

      <React.Suspense fallback={<div className="forge-canvas-loading">Loading canvasâ€¦</div>}>
        <ForgeCanvasLayout
          palette={<NodePalette />}
          canvas={<NodeCanvas />}
          inspector={<NodeInspector />}
        />
      </React.Suspense>

      {showPackModal && (
        <PackIngenioModal onClose={() => setShowPackModal(false)} />
      )}
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export const FixtureForgeEmbedded: React.FC<FixtureForgeEmbeddedProps> = ({
  onSave,
  editingFixture,
  existingDefinition
}) => {
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // STORES - WAVE 1113: Updated to async library store
  // ðŸ›¡ï¸ WAVE 2042.13.9: useShallow for stable references
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  const { 
    saveUserFixture, 
    isSystemFixture, 
    loadFromDisk,
    getFixtureById,
  } = useLibraryStore(useShallow(selectFixtureForge))
  const { targetFixtureId, clearTargetFixture } = useNavigationStore(useShallow(selectFixtureForgeNav))
  const { reconcileFixturesWithProfile } = useStageStore()
  const loadForgeGraph = useForgeGraphStore((s) => s.loadGraph)
  const unloadForgeGraph = useForgeGraphStore((s) => s.unloadGraph)
  const forgeGraphDirty = useForgeGraphStore((s) => s.isDirty)
  const markForgeGraphClean = useForgeGraphStore((s) => s.markClean)
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // STATE
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  const fixtureRef = useRef<FixtureDefinition>(FixtureFactory.createEmpty())

  // â”€â”€ WAVE 4732-A: Forge Hybrid Builder State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [forgeState, forgeDispatch] = useReducer(forgeReducer, undefined, makeInitialForgeState)

  const channels     = forgeState.channels
  const cells        = forgeState.cells
  const dmxGovernors = forgeState.dmxGovernors
  const physics      = forgeState.physics
  const wheels       = forgeState.wheels
  const [activeTab, setActiveTab] = useState<ForgeTabId>('library')  // WAVE 1112: Start at library
  const [forgeEditMode, setForgeEditMode] = useState<ForgeEditMode>('simple') // WAVE 4548.8c

  // WAVE 4548.8c: read the current forge graph to gate Simple Mode
  const forgeGraph = useForgeGraphStore(s => s.graph)
  const simpleModeCompatible = isSimpleCompatible(forgeGraph)
  
  // ðŸ”§ WAVE 2100: Configurable wheel motor speed
  
  // WAVE 1112: Current editing source tracking
  const [editingSource, setEditingSource] = useState<'system' | 'user' | 'new'>('new')
  const [originalFixtureId, setOriginalFixtureId] = useState<string | null>(null)
  
  // Physics stress testing toggle
  const [isStressTesting, setIsStressTesting] = useState(false)
  
  // UI state
  const [validationMessage, setValidationMessage] = useState('')
  const [isFormValid, setIsFormValid] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const createBlankForgeGraph = useCallback((dmxFootprint: number) => {
    return NodeGraphBuilder.fromChannels([], {
      autoMigrated: false,
      dmxFootprint,
    })
  }, [])

  const hydrateForgeGraph = useCallback((def: FixtureDefinition) => {
    const fixtureWithGraph = def as FixtureDefinition & {
      nodeGraph?: ReturnType<typeof NodeGraphBuilder.fromChannels>
    }

    const graph = fixtureWithGraph.nodeGraph
      ? deepClone(fixtureWithGraph.nodeGraph)
      : createBlankForgeGraph(def.channels?.length ?? 0)

    loadForgeGraph(graph, def.id || 'unsaved-fixture', !fixtureWithGraph.nodeGraph)
  }, [createBlankForgeGraph, loadForgeGraph])

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // WAVE 1112: Load fixture from navigation target
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // WAVE 1113: Load library from disk on mount
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  useEffect(() => {
    console.log('[ForgeEmbedded] ðŸ“‚ Loading library from disk...')
    loadFromDisk()
  }, [loadFromDisk])
  
  useEffect(() => {
    if (targetFixtureId) {
      const targetFixture = getFixtureById(targetFixtureId)
      if (targetFixture) {
        console.log(`[ForgeEmbedded] ðŸ“– Loading fixture from navigation: ${targetFixture.name}`)
        loadFixtureIntoEditor(targetFixture)
        setEditingSource(targetFixture.source)
        setOriginalFixtureId(targetFixture.id)
        setActiveTab('general')  // Go to edit tabs
        clearTargetFixture()  // Clear the navigation target
      }
    }
  }, [targetFixtureId])

  useEffect(() => {
    return () => {
      unloadForgeGraph()
    }
  }, [unloadForgeGraph])

  // WAVE 4548.8d: Mode toggle controls real tab routing
  const handleForgeModeChange = useCallback((mode: ForgeEditMode) => {
    if (mode === 'advanced') {
      setForgeEditMode('advanced')
      setActiveTab('nodegraph')
      return
    }

    if (simpleModeCompatible) {
      setForgeEditMode('simple')
      setActiveTab('channels')
      return
    }

    // Si el grafo no es compatible con SIMPLE, mantener ADVANCED
    setForgeEditMode('advanced')
    setActiveTab('nodegraph')
  }, [simpleModeCompatible])

  // WAVE 4548.8d: Reverse sync when user clicks tabs directly
  const handleTabClick = useCallback((tabId: ForgeTabId) => {
    setActiveTab(tabId)

    if (tabId === 'nodegraph') {
      setForgeEditMode('advanced')
      return
    }

    if (tabId === 'channels' && simpleModeCompatible) {
      setForgeEditMode('simple')
    }
  }, [simpleModeCompatible])

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // WAVE 1112: Load fixture into editor
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  const loadFixtureIntoEditor = useCallback((def: FixtureDefinition) => {
    // WAVE 4831 DIAG: detectar llamadas inesperadas post-save
    console.trace('[Forge 4831] 📥 loadFixtureIntoEditor called for:', def.name)
    fixtureRef.current = def
    hydrateForgeGraph(def)
    forgeDispatch({ type: 'HYDRATE_FROM_FIXTURE', fixture: def })
  }, [hydrateForgeGraph, forgeDispatch])

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // VALIDATION
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  useEffect(() => {
    const hasName = !!forgeState.meta.name?.trim()
    const hasChannels = forgeState.channels.some(ch => ch.type !== 'unknown')
    
    if (!hasName) {
      setValidationMessage('Model name required')
      setIsFormValid(false)
    } else if (!hasChannels) {
      setValidationMessage('At least one channel function required')
      setIsFormValid(false)
    } else {
      setValidationMessage('Ready to save')
      setIsFormValid(true)
    }
  }, [forgeState.meta.name, forgeState.channels])

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // HANDLERS - WAVE 1112: Save to Library
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  /**
   * Build the complete FixtureDefinition with wheels included
   */
  const buildCompleteFixture = useCallback((state: IForgeBuilderState = forgeState): FixtureDefinition => {
    const baseFixture = fixtureRef.current
    const syncedChannels = state.channels as FixtureChannel[]
    const forgeGraphLocal = forgeGraph
    const fixtureWithGraph = baseFixture as FixtureDefinition & {
      nodeGraph?: typeof forgeGraph
    }
    const hasPersistedNodeGraph = !!fixtureWithGraph.nodeGraph
    const hasLiveGraph = !!forgeGraphLocal
    const shouldPersistNodeGraph = hasPersistedNodeGraph || hasLiveGraph

    let graphSnapshot = hasLiveGraph
      ? deepClone(forgeGraphLocal)
      : (hasPersistedNodeGraph ? deepClone(fixtureWithGraph.nodeGraph) : undefined)

    if (graphSnapshot) {
      graphSnapshot = syncGraphOutputsWithChannels(graphSnapshot, syncedChannels)
    }

    const hasRed = syncedChannels.some(ch => ch.type === 'red')
    const hasGreen = syncedChannels.some(ch => ch.type === 'green')
    const hasBlue = syncedChannels.some(ch => ch.type === 'blue')
    const hasRgbColorMixing = hasRed && hasGreen && hasBlue

    const statePhysics = state.physics
    const stateWheels = state.wheels
    const colorEngine = (stateWheels?.colorEngine ?? (state.capabilities?.colorEngine as ColorEngineType) ?? 'rgb')
    const wheelColors = stateWheels?.colors ?? []
    const wheelMinChangeTimeMs = stateWheels?.minChangeTimeMs ?? 500

    const builtFixture = {
      ...baseFixture,
      name: state.meta.name || baseFixture.name,
      manufacturer: state.meta.manufacturer || baseFixture.manufacturer,
      type: state.meta.type || baseFixture.type,
      channels: syncedChannels,
      physics: statePhysics ? {
        motorType: statePhysics.motorType as any,
        maxAcceleration: statePhysics.maxAcceleration,
        maxVelocity: statePhysics.maxVelocity,
        safetyCap: statePhysics.safetyCap,
        orientation: statePhysics.orientation,
        invertPan: false,
        invertTilt: false,
        swapPanTilt: statePhysics.swapPanTilt,
        homePosition: { ...statePhysics.homePosition },
        tiltLimits: { ...statePhysics.tiltLimits },
      } : baseFixture.physics,
      wheels: (wheelColors as WheelColor[]).length > 0 ? { colors: wheelColors as WheelColor[] } : undefined,
      capabilities: {
        ...baseFixture.capabilities,
        colorEngine,
        colorWheel: (wheelColors as WheelColor[]).length > 0 ? {
          colors: wheelColors as WheelColor[],
          allowsContinuousSpin: false,
          minChangeTimeMs: wheelMinChangeTimeMs,
        } : undefined,
        hasPan: syncedChannels.some(ch => ch.type === 'pan'),
        hasTilt: syncedChannels.some(ch => ch.type === 'tilt'),
        hasColorMixing: hasRgbColorMixing,
        hasColorWheel: syncedChannels.some(ch => ch.type === 'color_wheel'),
        hasGobo: syncedChannels.some(ch => ch.type === 'gobo'),
        hasPrism: syncedChannels.some(ch => ch.type === 'prism'),
        hasStrobe: syncedChannels.some(ch => ch.type === 'strobe'),
        hasDimmer: syncedChannels.some(ch => ch.type === 'dimmer'),
      },
    } as FixtureDefinition & { nodeGraph?: unknown }

    if (shouldPersistNodeGraph && graphSnapshot) {
      builtFixture.nodeGraph = graphSnapshot
    }

    if (state.cells.length > 0) {
      try {
        const compileResult = compileForgeState(state)
        if (compileResult.ok) {
          builtFixture.nodeGraph = compileResult.fixture.nodeGraph
          builtFixture.channels = (builtFixture.channels as FixtureChannel[]).map(ch =>
            resolveChannelDeps(ch, builtFixture.channels as FixtureChannel[])
          ) as FixtureChannel[]
          if (compileResult.warnings.length > 0) {
            console.warn('[Forge 4732-C] Compile warnings:', compileResult.warnings)
          }
        } else {
          console.error('[Forge 4732-C] Blocking compile errors:', compileResult.errors)
        }
      } catch (err) {
        console.error('[Forge buildCompleteFixture] PANIC — compileForgeState threw:', err)
      }
    }

    return builtFixture
  }, [forgeState, forgeGraph])
  
  const handleSave = useCallback(async () => {
    if (!isFormValid) return

    // WAVE 4732.3 PASO 3: Pre-check compile errors BEFORE touching the save pipeline.
    // If the forge has cells but they're invalid (empty cells, type mismatch, etc.),
    // block the save and surface the first error in the status badge.
    if (forgeState.cells.length > 0) {
      const preCheck = compileForgeState(forgeState)
      if (!preCheck.ok) {
        const firstError = preCheck.errors[0]
        setSaveMessage(`Save failed: ${firstError.message}`)
        setTimeout(() => setSaveMessage(null), 6000)
        console.error('[Forge 4732.3] Compile pre-check failed:', preCheck.errors)
        return
      }
    }
    
    const completeFixture = deepClone(buildCompleteFixture(forgeState))

    // WAVE 4831 DIAG: Trazar channels que viajan al IPC — detectar ignitionDeps stale
    console.log('[Forge 4831] 🔍 Pre-save channels:', completeFixture.channels.map((ch: any) => ({
      idx: ch.index,
      type: ch.type,
      name: ch.name,
      deps: ch.ignitionDeps?.length ?? 0,
      depDetails: ch.ignitionDeps?.map((d: any) => ({
        target: d.targetChannelIndex,
        type: d.channelType,
        value: d.requiredValue,
        mode: d.mode,
      })) ?? [],
    })))
    
    // ðŸ”¥ WAVE 2183.5: Track the PREVIOUS profileId for reconciliation migration
    // When systemâ†’user clone happens, fixtures in the show still point to the old system ID.
    let previousProfileId: string | undefined
    
    // WAVE 1114 FIX: Handle system vs user vs new correctly
    if (editingSource === 'system') {
      // ðŸ”¥ WAVE 2183.5: Capture the system profileId BEFORE cloning
      previousProfileId = completeFixture.id
      
      // System fixture: Clone with new ID + "(User Copy)" suffix
      const clonedName = `${completeFixture.name} (User Copy)`
      const clonedFixture = {
        ...completeFixture,
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: clonedName,
      }
      
      const result = await saveUserFixture(clonedFixture)
      if (result.success) {
        fixtureRef.current = clonedFixture
        forgeDispatch({ type: 'META_SET_NAME', name: clonedName })
        markForgeGraphClean()
        setEditingSource('user')
        setOriginalFixtureId(clonedFixture.id)
        setSaveMessage('Saved as User Copy')
        setTimeout(() => setSaveMessage(null), 3000)
        
        // ðŸ”¥ WAVE 2183.5: Reconcile using the CLONED fixture (with new user ID)
        // AND pass previousProfileId so stage fixtures pointing to the old system
        // ID get their profileId migrated to the new user ID.
        reconcileFixturesWithProfile(clonedFixture, previousProfileId)
      } else {
        setSaveMessage(`Save failed: ${result.error}`)
        setTimeout(() => setSaveMessage(null), 5000)
      }
    } else if (editingSource === 'user') {
      // User fixture: UPDATE with SAME ID (no duplication!)
      // Use originalFixtureId to maintain identity
      const updatedFixture = {
        ...completeFixture,
        id: originalFixtureId || completeFixture.id, // Preserve original ID
      }
      
      const result = await saveUserFixture(updatedFixture)
      if (result.success) {
        markForgeGraphClean()
        setSaveMessage("Updated in User Library")
        setTimeout(() => setSaveMessage(null), 3000)

        // WAVE 2183.5: Reconcile with the updatedFixture (correct ID)
        reconcileFixturesWithProfile(updatedFixture)
      } else {
        setSaveMessage(`Update failed: ${result.error}`)
        setTimeout(() => setSaveMessage(null), 5000)
      }
    } else {
      // New fixture: Generate new ID
      if (!completeFixture.id || !completeFixture.id.startsWith("user-")) {
        completeFixture.id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }

      const result2 = await saveUserFixture(completeFixture)
      if (result2.success) {
        markForgeGraphClean()
        setEditingSource("user")
        setOriginalFixtureId(completeFixture.id)
        setSaveMessage("Saved to User Library")
        setTimeout(() => setSaveMessage(null), 3000)

        // WAVE 2183.5: Reconcile for new fixtures too (in case they match by ID)
        reconcileFixturesWithProfile(completeFixture)
      } else {
        setSaveMessage(`Save failed: ${result2.error}`)
        setTimeout(() => setSaveMessage(null), 5000)
      }
    }
    
    console.log('[ForgeEmbedded] ðŸ”¨ Saved fixture:', completeFixture.name, '| ID:', completeFixture.id)
    
    // Also call the prop callback for any external handlers
    onSave(completeFixture, forgeState.physics as any)
  }, [forgeState, isFormValid, onSave, buildCompleteFixture, editingSource, originalFixtureId, saveUserFixture, reconcileFixturesWithProfile, markForgeGraphClean, forgeDispatch])

  const handleExportJSON = useCallback(() => {
    const completeFixture = deepClone(buildCompleteFixture())
    const blob = new Blob([JSON.stringify(completeFixture, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${completeFixture.name || 'fixture'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [buildCompleteFixture])
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // WAVE 1112: Library Tab Handlers
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  const handleSelectFromLibrary = useCallback((selectedFixture: FixtureDefinition) => {
    loadFixtureIntoEditor(selectedFixture)
    setEditingSource(isSystemFixture(selectedFixture.id) ? 'system' : 'user')
    setOriginalFixtureId(selectedFixture.id)
    setActiveTab('general')  // Go to edit mode
  }, [loadFixtureIntoEditor, isSystemFixture])
  
  const handleNewFromScratch = useCallback(() => {
    const emptyFixture = FixtureFactory.createEmpty()
    fixtureRef.current = emptyFixture
    hydrateForgeGraph(emptyFixture)
    forgeDispatch({ type: 'HYDRATE_FROM_FIXTURE', fixture: emptyFixture })
    setEditingSource('new')
    setOriginalFixtureId(null)
    setActiveTab('general')
  }, [hydrateForgeGraph, forgeDispatch])

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RENDER
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  // WAVE 4732.2: Status badge computation
  const _saveError = saveMessage?.startsWith('Save failed') || saveMessage?.startsWith('Update failed')
  const badgeClass: 'saved' | 'error' | 'ready' | 'invalid' = _saveError ? 'error' : saveMessage ? 'saved' : isFormValid ? 'ready' : 'invalid'
  const badgeIcon = (badgeClass === 'error' || badgeClass === 'invalid') ? <AlertTriangle size={11} /> : <Check size={11} />
  const badgeText = saveMessage ?? validationMessage

  return (
    <div className="forge-embedded">
      {/* HEADER - WAVE 1112/4732.2: Fixture title centered + status badge */}
      <header className="forge-header embedded">
        <div className="forge-title">
          <Factory size={24} />
          <h1>FIXTURE FORGE</h1>
          <span className="forge-subtitle">
            {editingSource === 'system' && <><Lock size={12} /> System (Read-Only)</>}
            {editingSource === 'user' && 'User Library'}
            {editingSource === 'new' && 'New Fixture'}
          </span>
        </div>

        {/* WAVE 4732.2 PASO 1: Fixture name — absolute center of header */}
        <div className="forge-fixture-name" aria-label="Editing fixture">
          <span className="forge-fixture-name__text">
            {forgeState.meta.name || 'Untitled Fixture'}
          </span>
        </div>

        <div className="forge-actions">
          {/* WAVE 4732.2 PASO 2: Status badge */}
          <div className={`forge-status-badge forge-status-badge--${badgeClass}`}>
            {badgeIcon}
            <span>{badgeText}</span>
          </div>
          <button
            className="forge-action-btn export"
            onClick={handleExportJSON}
            title="Export JSON"
          >
            <Download size={18} />
            <span>Export</span>
          </button>
          <button
            className="forge-action-btn save"
            onClick={handleSave}
            disabled={!isFormValid}
            title={editingSource === 'system' ? 'Save as Copy (System is read-only)' : 'Save Profile'}
          >
            <Save size={18} />
            <span>{editingSource === 'system' ? 'Save Copy' : 'Save'}</span>
          </button>
        </div>
      </header>
      
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {/* TABS - WAVE 1112: Added LIBRARY tab */}
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <nav className="forge-tabs embedded">
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.id}
            className={`forge-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
        {/* WAVE 4548.8c: Mode toggle â€” only visible on nodegraph / channels tabs */}
        {(activeTab === 'nodegraph' || activeTab === 'channels') && (
          <ForgeModeSwitcher
            mode={forgeEditMode}
            graph={forgeGraph}
            onModeChange={handleForgeModeChange}
          />
        )}
      </nav>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {/* MAIN CONTENT */}
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className="forge-main-content embedded">
        
        {/* LIBRARY TAB â€” WAVE 4549.2: Universal Asset Browser */}
        {activeTab === 'library' && (
          <UniversalAssetBrowser
            assetTypes={['fixture']}
            onSelect={(asset: LibraryAsset) => {
              handleSelectFromLibrary(asset._raw as import('../../../types/FixtureDefinition').FixtureDefinition)
            }}
            selectedAssetId={originalFixtureId ?? null}
            maxHeight="100%"
          />
        )}
        
        {/* GENERAL TAB - WAVE 1120: THE COCKPIT OVERHAUL */}
        {activeTab === 'general' && (
          <div className="forge-general-panel cockpit-layout">
            {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                SECTION A: IDENTITY & CLASSIFICATION (LEFT COLUMN)
                â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
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
                    value={forgeState.meta.manufacturer || ''}
                    onChange={(e) => forgeDispatch({ type: 'META_SET_MANUFACTURER', manufacturer: e.target.value })}
                  />
                </div>
                
                {/* ðŸ”¥ HOTFIX WAVE 2070.1: RestauraciÃ³n del Selector de Canales
                    El input de totalChannels se perdiÃ³ durante la migraciÃ³n al diseÃ±o Cockpit.
                    Se incrusta junto a Model Name en un flex row para no romper el layout. */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div className="cockpit-input-group" style={{ flex: 1 }}>
                    <label>Model Name *</label>
                    <input
                      type="text"
                      placeholder="Vizi Beam 5RX"
                      value={forgeState.meta.name || ''}
                      onChange={(e) => forgeDispatch({ type: 'META_SET_NAME', name: e.target.value })}
                    />
                  </div>

                  <div className="cockpit-input-group" style={{ width: '70px' }}>
                    <label>CHs</label>
                    <input
                      type="number"
                      min="1"
                      max="512"
                      value={forgeState.meta.channelCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value)
                        if (!isNaN(val)) forgeDispatch({ type: 'META_SET_CHANNEL_COUNT', channelCount: Math.min(512, Math.max(1, val)) })
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
                    className={`type-selector-btn ${forgeState.meta.type === typeConfig.value ? 'active' : ''}`}
                    style={{ '--type-color': typeConfig.color } as React.CSSProperties}
                    onClick={() => forgeDispatch({ type: 'META_SET_TYPE', fixtureType: typeConfig.value })}
                    title={typeConfig.label}
                  >
                    <span className="type-icon">{typeConfig.icon}</span>
                    <span className="type-label">{typeConfig.label}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                SECTION B: CAPABILITIES MATRIX (CENTER - AUTO-GENERATED)
                â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <div className="cockpit-capabilities">
              <div className="cockpit-section-header">
                <Sliders size={16} />
                <span>CAPABILITIES</span>
                <span className="auto-badge">AUTO</span>
              </div>
              
              {(() => {
                const caps = deriveCapabilitiesUnified(buildCompleteFixture(forgeState))
                return (
                  <div className="capabilities-matrix">
                    {CAPABILITY_BADGES.map(badge => {
                      const isActive = caps[badge.key] as boolean
                      return (
                        <div
                          key={badge.key}
                          className={`capability-badge ${isActive ? 'active' : 'inactive'}`}
                          style={{ '--cap-color': badge.color } as React.CSSProperties}
                          title={`${badge.label}: ${isActive ? 'DETECTED' : 'Not found'}`}
                        >
                          <span className="cap-icon">{badge.icon}</span>
                          <span className="cap-label">{badge.label}</span>
                          {isActive && <span className="cap-check">âœ“</span>}
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

              {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                  ðŸ”¥ WAVE 1122.3: COLOR ENGINE MUDADO AL CENTRO (Donde hay espacio)
                  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
              <div className="cockpit-section-header" style={{ marginTop: '32px' }}>
                <Palette size={16} />
                <span>COLOR ENGINE</span>
              </div>

              <div className="type-selector-grid columns-3">
                {COLOR_ENGINE_OPTIONS.map(engineConfig => (
                  <button
                    key={engineConfig.value}
                    className={`type-selector-btn ${(forgeState.wheels?.colorEngine ?? 'rgb') === engineConfig.value ? 'active' : ''}`}
                    style={{ '--type-color': '#f59e0b' } as React.CSSProperties}
                    onClick={() => forgeDispatch({ type: 'WHEELS_SET_ENGINE', engine: engineConfig.value })}
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
                    <span className="engine-icon">âš™ï¸</span>
                    <span className="engine-label">MOTOR</span>
                    <span className="engine-value">{forgeState.physics?.motorType?.toUpperCase() || 'â€”'}</span>
                  </div>
                  <div className="engine-badge" title="Max Acceleration (Â°/sÂ²)">
                    <span className="engine-icon">âš¡</span>
                    <span className="engine-label">ACCEL</span>
                    <span className="engine-value">{forgeState.physics?.maxAcceleration || 'â€”'}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                SECTION C: DMX RIBBON (BOTTOM - VISUAL FOOTPRINT)
                â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
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
        )}

        {/* CHANNEL RACK TAB */}
        {activeTab === 'channels' && (
          <ForgeChannelRackTab
            channels={channels as FixtureChannel[]}
            capabilities={forgeState.capabilities}
            dispatch={forgeDispatch}
            fixtureType={forgeState.meta.type}
            forgeGraph={forgeGraph}
            isStressTesting={isStressTesting}
            onNavigateToNodeGraph={() => setActiveTab('nodegraph')}
          />
        )}

        {/* NODE GRAPH TAB â€” WAVE 4548.8b / 4548.10 */}
        {activeTab === 'nodegraph' && (
          <NodeGraphTab />
        )}

        {/* WHEELSMITH TAB - WAVE 1111 */}
        {activeTab === 'wheelsmith' && (
          <div className="forge-wheelsmith-panel">
            <WheelSmithEmbedded
              colors={(wheels?.colors ?? []) as WheelColor[]}
              onColorsChange={(newColors) => forgeDispatch({ type: 'WHEELS_SET_COLORS', colors: newColors })}
              hasColorWheelChannel={channels.some(ch => ch.type === 'color_wheel')}
              onNavigateToRack={() => setActiveTab('channels')}
              fixtureId={originalFixtureId}
              channelIndex={channels.findIndex(ch => ch.type === 'color_wheel')}
              minChangeTimeMs={wheels?.minChangeTimeMs ?? 500}
              onMinChangeTimeMsChange={(ms) => forgeDispatch({ type: 'WHEELS_SET_MIN_CHANGE', ms })}
            />
          </div>
        )}

        {/* PHYSICS ENGINE TAB */}
        {activeTab === 'physics' && (
          <div className="forge-physics-panel">
            <PhysicsTuner
              physics={physics as any}
              onChange={(p) => forgeDispatch({ type: 'PHYSICS_SET', physics: p as any })}
              onStressTest={setIsStressTesting}
              isStressTesting={isStressTesting}
            />
          </div>
        )}

        {/* EXPORT TAB */}
        {activeTab === 'export' && (
          <div className="forge-export-panel">
            <div className="export-preview">
              <h3>JSON Preview</h3>
              <pre className="json-preview">
                {JSON.stringify(buildCompleteFixture(forgeState), null, 2)}
              </pre>
            </div>
            <div className="export-actions">
              <button className="export-btn json" onClick={handleExportJSON}>
                <Download size={20} />
                <span>Download JSON</span>
              </button>
              <button className="export-btn copy" onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(buildCompleteFixture(forgeState), null, 2))
              }}>
                <Copy size={20} />
                <span>Copy to Clipboard</span>
              </button>
            </div>
          </div>
        )}

        {/* â”€â”€ WAVE 4732-A: DMX LAYOUT TAB (mundo fÃ­sico) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            Renderiza `forgeState.channels` â€” la tabla de canales con tipos,
            defaults e ignitionDeps. El fix completo del selector de deps
            (Bug B1) llega en la fase 4732-B. */}
        {activeTab === 'dmx-layout' && (
          <div className="forge-dmx-layout-panel" style={{ padding: '16px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Zap size={16} style={{ color: '#22d3ee' }} />
              <span style={{ color: '#22d3ee', fontWeight: 700, letterSpacing: '0.1em' }}>
                DMX LAYOUT — PHYSICAL LAYOUT
              </span>
              <span style={{ color: '#64748b', fontSize: '12px' }}>
                {forgeState.channels.length} channels
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', width: '48px' }}>#</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', width: '140px' }}>Tipo</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', width: '64px' }}>Default</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', width: '80px' }}>Ignition</th>
                </tr>
              </thead>
              <tbody>
                {forgeState.channels.map((ch, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid #1e293b',
                      opacity: ch.type === 'unknown' ? 0.4 : 1,
                    }}
                  >
                    <td style={{ padding: '6px 8px', color: '#475569', fontFamily: 'monospace' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '6px 8px', color: '#e2e8f0' }}>
                        {ch.name || <span style={{ color: '#475569', fontStyle: 'italic' }}>-</span>}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        background: ch.type === 'unknown' ? '#1e293b' : '#0f172a',
                        color: ch.type === 'unknown' ? '#475569' : '#7dd3fc',
                        border: '1px solid #1e3a5f',
                      }}>
                        {ch.type}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', color: '#94a3b8', fontFamily: 'monospace', textAlign: 'right' }}>
                      {ch.defaultValue}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      {(ch.ignitionDeps?.length ?? 0) > 0 && (
                          <span style={{ color: '#fbbf24', fontSize: '11px', fontFamily: 'monospace' }}>
                            IGN x{ch.ignitionDeps!.length}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {forgeState.channels.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#475569' }}>
                      Load a fixture from LIBRARY to view channels
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* â”€â”€ WAVE 4732-A: AETHER CELLS TAB (mundo lÃ³gico) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            Renderiza `forgeState.cells` â€” las cajas de cÃ©lulas Aether.
            El DnD (4732-D) y el compilador (4732-E) llegan en fases siguientes.
            Scaffolding base: split screen Unassigned | Cells. */}
        {activeTab === 'aether' && (
          <AetherModulesPanel
            forgeState={forgeState}
            forgeDispatch={forgeDispatch}
            channels={forgeState.channels}
          />
        )}
      </div>
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HELPERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function getSmartDefaultValue(type: ChannelType): number {
  switch (type) {
    case 'dimmer': return 255
    case 'shutter': return 255
    case 'pan':
    case 'tilt': return 127
    case 'focus':
    case 'zoom': return 128
    default: return 0
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// WAVE 4732-D: AETHER MODULES PANEL â€” DnD COMPLETO
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const FAMILY_COLORS: Record<string, string> = {
  COLOR:      '#ef4444',
  IMPACT:     '#f59e0b',
  KINETIC:    '#22d3ee',
  BEAM:       '#a855f7',
  ATMOSPHERE: '#6b7280',
}

interface DragData {
  channelIdx:  number
  channelType: string
  fromCellId?: string
}

// â”€â”€ Sub-componente: Canal arrastrable â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface DraggableChannelChipProps {
  channelIdx:  number
  channelType: string
  label:       string
  fromCellId?: string
}

function DraggableChannelChip({ channelIdx, channelType, label, fromCellId }: DraggableChannelChipProps) {
  const dragData: DragData = { channelIdx, channelType, fromCellId }
  const draggableId = `ch-${channelIdx}-${fromCellId ?? 'unassigned'}`

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id:   draggableId,
    data: dragData,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:         '6px',
        padding:     '5px 8px',
        marginBottom: '3px',
        background:  isDragging ? '#1e293b' : '#0f172a',
        border:      '1px solid #1e293b',
        borderRadius: '4px',
        cursor:      isDragging ? 'grabbing' : 'grab',
        opacity:     isDragging ? 0.4 : 1,
        transform:   CSS.Translate.toString(transform),
        userSelect:  'none',
        touchAction: 'none',
      }}
    >
      <GripVertical size={10} style={{ color: '#334155', flexShrink: 0 }} />
      <span style={{ color: '#475569', fontFamily: 'monospace', fontSize: '10px', width: '28px', flexShrink: 0 }}>
        CH{channelIdx + 1}
      </span>
      <span style={{ color: '#e2e8f0', fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{
        fontSize: '10px',
        color: '#7dd3fc',
        fontFamily: 'monospace',
        background: '#0a1628',
        border: '1px solid #1e3a5f',
        borderRadius: '3px',
        padding: '1px 4px',
        flexShrink: 0,
      }}>
        {channelType}
      </span>
    </div>
  )
}

// â”€â”€ Sub-componente: CÃ©lula droppable â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface DroppableCellBoxProps {
  cell:          IForgeCellBuilder
  channels:      readonly FixtureChannel[]
  forgeDispatch: React.Dispatch<ForgeAction>
  unassigned:    readonly FixtureChannel[]
  isCompatible:  boolean | null  // null = nada arrastrÃ¡ndose
  isShaking:     boolean
}

function DroppableCellBox({
  cell, channels, forgeDispatch, unassigned, isCompatible, isShaking,
}: DroppableCellBoxProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell-${cell.cellId}` })

  const neon     = FAMILY_COLORS[String(cell.family)] ?? '#334155'
  const canDrop  = isCompatible === true
  const cantDrop = isCompatible === false

  // Borde dinÃ¡mico durante el drag
  let borderColor = `${neon}66`
  if (isOver && canDrop)  borderColor = neon
  if (isOver && cantDrop) borderColor = '#ef4444'
  if (!isOver && canDrop) borderColor = `${neon}aa`

  return (
    <div
      ref={setNodeRef}
      style={{
        width:     '220px',
        background: isOver && canDrop ? `${neon}08` : '#0f172a',
        border:    `1px solid ${borderColor}`,
        borderRadius: '6px',
        overflow:  'hidden',
        transition: 'border-color 0.12s, background 0.12s',
        animation: isShaking ? 'forge-shake 0.25s ease-in-out' : 'none',
        opacity:   isCompatible === false && !isOver ? 0.45 : 1,
      }}
    >
      {/* Cabecera */}
      <div style={{
        background:   `${neon}18`,
        borderBottom: `1px solid ${neon}44`,
        padding:      '7px 10px',
        display:      'flex',
        alignItems:   'center',
        gap:          '6px',
      }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: neon, letterSpacing: '0.1em', flexShrink: 0 }}>
          {String(cell.family)}
        </span>
        {/* WAVE 4732.3 PASO 1: Label editable por el operador */}
        <input
          type="text"
          value={cell.label}
          onChange={e => forgeDispatch({ type: 'CELL_RENAME_LABEL', cellId: cell.cellId, label: e.target.value })}
          title="Rename cell"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid transparent',
            color: '#e2e8f0',
            fontSize: '12px',
            fontWeight: 600,
            outline: 'none',
            minWidth: 0,
            fontFamily: 'inherit',
            cursor: 'text',
            padding: '0 2px',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => { e.currentTarget.style.borderBottomColor = neon }}
          onBlur={e => { e.currentTarget.style.borderBottomColor = 'transparent' }}
        />
        <button
          onClick={() => forgeDispatch({ type: 'CELL_DELETE', cellId: cell.cellId })}
          title="Delete cell"
          style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
        >
          <XIcon size={12} />
        </button>
      </div>

      {/* WAVE 4732.3 PASO 2: ID + selector de zona canónica */}
      <div style={{ padding: '4px 8px 4px 10px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ color: '#334155', fontFamily: 'monospace', fontSize: '10px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px' }}>
          {cell.cellId}
        </span>
        <select
          value={cell.aetherZone ?? ''}
          onChange={e => forgeDispatch({ type: 'CELL_SET_ZONE', cellId: cell.cellId, zone: e.target.value || undefined })}
          title="Canonical Aether zone"
          style={{
            flex: 1,
            background: '#0a0f1a',
            border: `1px solid ${cell.aetherZone ? neon + '55' : '#1e293b'}`,
            color: cell.aetherZone ? '#7dd3fc' : '#475569',
            borderRadius: '3px',
            padding: '2px 4px',
            fontSize: '10px',
            cursor: 'pointer',
            fontFamily: 'monospace',
          }}
        >
          <option value="">— zone —</option>
          <option value="ambient">ambient</option>
          <option value="air">air</option>
          <option value="floor">floor</option>
          <option value="flash">flash</option>
          <option value="front">front</option>
          <option value="back">back</option>
          <option value="movement">movement</option>
          <option value="dimmer">dimmer</option>
          <option value="unassigned">unassigned</option>
        </select>
      </div>

      {/* Canales asignados (tambiÃ©n arrastrables entre cÃ©lulas) */}
      <div style={{ padding: '6px 8px 4px', minHeight: '36px' }}>
        {cell.channelIndices.length === 0 ? (
          <span style={{
            display: 'block',
            padding: '8px 4px',
            color:   isOver && canDrop ? neon : '#334155',
            fontSize: '11px',
            fontStyle: 'italic',
            textAlign: 'center',
            transition: 'color 0.12s',
          }}>
            {isOver && canDrop ? 'Drop here' : 'Drag channels here'}
          </span>
        ) : (
          cell.channelIndices.map(idx => {
            const ch = channels[idx]
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <DraggableChannelChip
                  channelIdx={idx}
                  channelType={ch?.type ?? 'unknown'}
                  label={ch?.name || ch?.type || '?'}
                  fromCellId={cell.cellId}
                />
                <button
                  onClick={() => forgeDispatch({ type: 'CELL_DETACH_CHANNEL', cellId: cell.cellId, channelIdx: idx })}
                  title="Detach"
                  style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                >
                  <XIcon size={9} />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Selector de canal como fallback de accesibilidad */}
      {unassigned.length > 0 && (
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value=""
            onChange={e => {
              const idx = parseInt(e.target.value)
              if (!isNaN(idx)) forgeDispatch({ type: 'CELL_ATTACH_CHANNEL', cellId: cell.cellId, channelIdx: idx })
            }}
            style={{
              width: '100%',
              background: '#0a0f1a',
              border: '1px dashed #334155',
              color: '#64748b',
              borderRadius: '3px',
              padding: '3px 6px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            <option value="">+ Channel...</option>
            {unassigned
              .filter(ch => canAdmit(ch.type, cell.family).ok)
              .map(ch => (
                <option key={ch.index} value={ch.index}>
                  [CH{ch.index + 1}] {ch.name || ch.type}
                </option>
              ))}
          </select>
        </div>
      )}
    </div>
  )
}

// â”€â”€ Componente principal: AetherModulesPanel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface AetherModulesPanelProps {
  forgeState:    IForgeBuilderState
  forgeDispatch: React.Dispatch<ForgeAction>
  channels:      readonly FixtureChannel[]
}

function AetherModulesPanel({ forgeState, forgeDispatch, channels }: AetherModulesPanelProps) {
  const [activeDrag, setActiveDrag]     = useState<DragData | null>(null)
  const [rejectShake, setRejectShake]   = useState<string | null>(null)
  const [rejectMsg, setRejectMsg]       = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
  )

  const assignedIndices = new Set(forgeState.cells.flatMap(c => [...c.channelIndices]))
  const unassigned = channels.filter(ch => !assignedIndices.has(ch.index) && ch.type !== 'unknown')

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDrag(event.active.data.current as DragData)
    setRejectMsg(null)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const drag = event.active.data.current as DragData | undefined
    setActiveDrag(null)
    if (!drag || !event.over) return

    const overId = String(event.over.id)
    if (!overId.startsWith('cell-')) return

    const cellId = overId.slice(5)
    const cell   = forgeState.cells.find(c => c.cellId === cellId)
    if (!cell) return

    // Same origin cell â†’ no-op
    if (drag.fromCellId === cellId) return

    const result = canAdmit(drag.channelType as ChannelType, cell.family)
    if (!result.ok) {
      setRejectShake(cellId)
      setRejectMsg(`'${drag.channelType}' incompatible with ${String(cell.family)}: ${result.reason}`)
      setTimeout(() => setRejectShake(null), 260)
      setTimeout(() => setRejectMsg(null), 3500)
      return
    }

    if (drag.fromCellId) {
      forgeDispatch({ type: 'CELL_MOVE_CHANNEL', fromCellId: drag.fromCellId, toCellId: cellId, channelIdx: drag.channelIdx })
    } else {
      forgeDispatch({ type: 'CELL_ATTACH_CHANNEL', cellId, channelIdx: drag.channelIdx })
    }
  }, [forgeState.cells, forgeDispatch])

  const cellFamilyOptions: { label: string; family: NodeFamily }[] = [
    { label: 'IMPACT',     family: NodeFamily.IMPACT },
    { label: 'COLOR',      family: NodeFamily.COLOR },
    { label: 'KINETIC',    family: NodeFamily.KINETIC },
    { label: 'BEAM',       family: NodeFamily.BEAM },
    { label: 'ATMOSPHERE', family: NodeFamily.ATMOSPHERE },
  ]

  // Canal actualmente en vuelo â€” para render del overlay
  const activeChannel = activeDrag !== null
    ? channels[activeDrag.channelIdx]
    : null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ display: 'flex', height: '100%', fontSize: '13px', position: 'relative' }}>

        {/* â”€â”€ PANEL IZQUIERDO: Canales no asignados â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{
          width: '250px',
          flexShrink: 0,
          borderRight: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          background: '#080d18',
        }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e293b' }}>
            <span style={{ color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', fontSize: '11px' }}>
              UNASSIGNED
            </span>
            <span style={{ color: '#334155', marginLeft: '6px', fontSize: '11px' }}>({unassigned.length})</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '8px' }}>
            {unassigned.length === 0 && (
              <div style={{ color: '#334155', padding: '16px 8px', textAlign: 'center', fontSize: '11px' }}>
                {channels.length === 0 ? 'Load a fixture in the DMX Layout tab' : 'All assigned'}
              </div>
            )}
            {unassigned.map(ch => (
              <DraggableChannelChip
                key={ch.index}
                channelIdx={ch.index}
                channelType={ch.type}
                label={ch.name || ch.type}
              />
            ))}
          </div>
        </div>

        {/* â”€â”€ PANEL DERECHO: CÃ©lulas Aether â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#060a14' }}>

          {/* Toolbar de creaciÃ³n */}
          <div style={{
            padding: '8px 14px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexWrap: 'wrap',
          }}>
            <span style={{ color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', fontSize: '11px', marginRight: '4px' }}>
              + NEW CELL:
            </span>
            {cellFamilyOptions.map(opt => {
              const neon = FAMILY_COLORS[opt.family] ?? '#334155'
              return (
                <button
                  key={opt.family}
                  onClick={() => forgeDispatch({ type: 'CELL_CREATE', family: opt.family })}
                  style={{
                    background: '#0f172a',
                    border: `1px solid ${neon}`,
                    color: neon,
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  <Plus size={9} /> {opt.label}
                </button>
              )
            })}
            <span style={{ color: '#334155', fontSize: '11px', marginLeft: 'auto' }}>
              {forgeState.cells.length} cells
            </span>
          </div>

          {/* Grid de cÃ©lulas */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignContent: 'flex-start',
          }}>
            {forgeState.cells.length === 0 && (
              <div style={{ width: '100%', padding: '48px', textAlign: 'center', color: '#334155' }}>
                Create Aether modules using the buttons above,
                then drag channels onto them.
              </div>
            )}
            {forgeState.cells.map(cell => {
              const isCompatible = activeDrag
                ? canAdmit(activeDrag.channelType as ChannelType, cell.family).ok
                : null
              return (
                <DroppableCellBox
                  key={cell.cellId}
                  cell={cell}
                  channels={channels}
                  forgeDispatch={forgeDispatch}
                  unassigned={unassigned}
                  isCompatible={isCompatible}
                  isShaking={rejectShake === cell.cellId}
                />
              )
            })}
          </div>
        </div>

        {/* â”€â”€ Toast de rechazo de aduana â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {rejectMsg && (
          <div style={{
            position:   'absolute',
            bottom:     '16px',
            left:       '50%',
            transform:  'translateX(-50%)',
            background: '#1a0a0a',
            border:     '1px solid #ef4444',
            color:      '#fca5a5',
            padding:    '8px 16px',
            borderRadius: '6px',
            fontSize:   '12px',
            zIndex:     1000,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            â›” {rejectMsg}
          </div>
        )}
      </div>

      {/* â”€â”€ Overlay flotante durante el drag â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <DragOverlay dropAnimation={null}>
        {activeChannel && (
          <div style={{
            display:     'flex',
            alignItems:  'center',
            gap:         '6px',
            padding:     '5px 10px',
            background:  '#1e293b',
            border:      '1px solid #7dd3fc',
            borderRadius: '4px',
            boxShadow:   '0 4px 20px rgba(0,0,0,0.6)',
            fontSize:    '12px',
            cursor:      'grabbing',
            whiteSpace:  'nowrap',
          }}>
            <span style={{ color: '#475569', fontFamily: 'monospace', fontSize: '10px' }}>
              CH{activeChannel.index + 1}
            </span>
            <span style={{ color: '#e2e8f0' }}>
              {activeChannel.name || activeChannel.type}
            </span>
            <span style={{
              fontSize: '10px',
              color: '#7dd3fc',
              fontFamily: 'monospace',
              background: '#0a1628',
              border: '1px solid #1e3a5f',
              borderRadius: '3px',
              padding: '1px 4px',
            }}>
              {activeChannel.type}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

export default FixtureForgeEmbedded
