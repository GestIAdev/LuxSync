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

import React, { useState, useCallback, useEffect, useReducer, DragEvent, Suspense, type ReactNode } from 'react'
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
import { compileForgeState } from '../../../core/forge/compileForgeState'
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
  ChevronDown,
  ChevronUp,
  Trash2,
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
import { FixturePreview3D } from '../../shared/PhysicsTuner/FixturePreview3D'
import { PhysicsTuner } from '../../shared/PhysicsTuner/PhysicsTuner'
import { WheelSmithEmbedded } from './WheelSmithEmbedded'
import { UniversalAssetBrowser } from '../../shared/AssetBrowser'
import type { LibraryAsset } from '../../../stores/assetAdapters'
import { 
  PhysicsProfile, 
  DEFAULT_PHYSICS_PROFILES,
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
import { ForgeModeSwitcher, SimpleModeLockBanner, isSimpleCompatible, type ForgeEditMode } from './canvas/ForgeModeSwitcher'
// WAVE 1117: Recovered CSS from deleted modal (contains PhysicsTuner styles)
import './FixtureForge.css'
import './FixtureForgeEmbedded.css'  // Standalone styles for embedded mode

// â”€â”€ WAVE 4548.8b: NODE GRAPH UI (lazy-loaded â€” solo se carga en /forge) â”€â”€
const ForgeCanvasLayout = React.lazy(() => import('./canvas/ForgeCanvasLayout'))
const NodePalette = React.lazy(() => import('./canvas/NodePalette'))
const NodeCanvas = React.lazy(() => import('./canvas/NodeCanvas'))

// â”€â”€ WAVE 4548.10: Pack as Ingenio modal â”€â”€
import { PackIngenioModal } from './canvas/PackIngenioModal'

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

interface FunctionDef {
  type: ChannelType
  label: string
  color: string
  icon: ReactNode
  is16bit?: boolean
}

const FUNCTION_PALETTE: Record<string, FunctionDef[]> = {
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
function getChannelCategory(type: ChannelType): string {
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
function getCategoryColor(category: string): string {
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
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // STATE
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  const [fixture, setFixture] = useState<FixtureDefinition>(FixtureFactory.createEmpty())

  // â”€â”€ WAVE 4732-A: Forge Hybrid Builder State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [forgeState, forgeDispatch] = useReducer(forgeReducer, undefined, makeInitialForgeState)

  const [physics, setPhysics] = useState<PhysicsProfile>(DEFAULT_PHYSICS_PROFILES['stepper-quality'])
  const [totalChannels, setTotalChannels] = useState<number>(8)
  const [activeTab, setActiveTab] = useState<ForgeTabId>('library')  // WAVE 1112: Start at library
  const [forgeEditMode, setForgeEditMode] = useState<ForgeEditMode>('simple') // WAVE 4548.8c

  // WAVE 4548.8c: read the current forge graph to gate Simple Mode
  const forgeGraph = useForgeGraphStore(s => s.graph)
  const simpleModeCompatible = isSimpleCompatible(forgeGraph)
  const [colorEngine, setColorEngine] = useState<ColorEngineType>('rgb')
  const [wheelColors, setWheelColors] = useState<WheelColor[]>([])
  
  // ðŸ”§ WAVE 2100: Configurable wheel motor speed
  const [wheelMinChangeTimeMs, setWheelMinChangeTimeMs] = useState<number>(500)
  
  // WAVE 1112: Current editing source tracking
  const [editingSource, setEditingSource] = useState<'system' | 'user' | 'new'>('new')
  const [originalFixtureId, setOriginalFixtureId] = useState<string | null>(null)
  
  // Preview controls
  const [showPreview, setShowPreview] = useState(true)
  const [previewPan, setPreviewPan] = useState(127)
  const [previewTilt, setPreviewTilt] = useState(127)
  const [previewDimmer, setPreviewDimmer] = useState(200)
  const [previewColor, setPreviewColor] = useState({ r: 255, g: 255, b: 255 })
  const [isStressTesting, setIsStressTesting] = useState(false)
  
  // UI state
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)
  const [validationMessage, setValidationMessage] = useState('')
  const [isFormValid, setIsFormValid] = useState(false)
  const [expandedFoundry, setExpandedFoundry] = useState<string | null>('POSITION')
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  // ðŸ”¥ WAVE 4718: Ignition Dependencies â€” Ã­ndice de canal cuyo panel estÃ¡ desplegado.
  const [expandedIgnitionIdx, setExpandedIgnitionIdx] = useState<number | null>(null)

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
    setFixture(def)
    hydrateForgeGraph(def)
    setTotalChannels(def.channels.length)

    // â”€â”€ WAVE 4732-A: Hydrate the Hybrid Builder State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    forgeDispatch({ type: 'HYDRATE_FROM_FIXTURE', fixture: def })

    // Load color engine from capabilities
    if (def.capabilities?.colorEngine) {
      setColorEngine(def.capabilities.colorEngine)
    }

    // Load wheel colors from wheels or capabilities.colorWheel
    if (def.wheels?.colors) {
      setWheelColors(def.wheels.colors)
    } else if (def.capabilities?.colorWheel?.colors) {
      setWheelColors(def.capabilities.colorWheel.colors)
    } else {
      setWheelColors([])
    }
    
    // ðŸ”§ WAVE 2100: Load minChangeTimeMs from colorWheel config
    const savedMinChangeTimeMs = def.capabilities?.colorWheel?.minChangeTimeMs
    if (savedMinChangeTimeMs && savedMinChangeTimeMs > 0) {
      setWheelMinChangeTimeMs(savedMinChangeTimeMs)
    } else {
      setWheelMinChangeTimeMs(500) // Industry default
    }
    
    // Load physics if available - WAVE 1116.3 FIX: Use ACTUAL saved values
    if (def.physics) {
      // Use the physics object directly from JSON, not a default profile
      console.log(`[ForgeEmbedded] ðŸ“¦ Loading physics from JSON:`, def.physics)
      
      // Map old motor types to valid MotorType
      const rawMotorType = def.physics.motorType || 'stepper-quality'
      const validMotorTypes: MotorType[] = ['servo-pro', 'stepper-quality', 'stepper-cheap', 'unknown']
      const motorType: MotorType = validMotorTypes.includes(rawMotorType as MotorType) 
        ? (rawMotorType as MotorType) 
        : 'stepper-quality'
      
      setPhysics({
        motorType,
        maxAcceleration: def.physics.maxAcceleration ?? 2000,
        maxVelocity: def.physics.maxVelocity ?? 500,
        safetyCap: Boolean(def.physics.safetyCap ?? true),
        orientation: def.physics.orientation || 'floor',
        invertPan: def.physics.invertPan ?? false,
        invertTilt: def.physics.invertTilt ?? false,
        swapPanTilt: def.physics.swapPanTilt ?? false,
        homePosition: def.physics.homePosition || { pan: 127, tilt: 127 },
        tiltLimits: def.physics.tiltLimits || { min: 0, max: 270 },
      })
    }
  }, [hydrateForgeGraph])

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // VALIDATION
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  useEffect(() => {
    const hasName = !!fixture.name?.trim()
    const hasChannels = fixture.channels.some(ch => ch.type !== 'unknown')
    
    if (!hasName) {
      setValidationMessage('âš ï¸ Model name required')
      setIsFormValid(false)
    } else if (!hasChannels) {
      setValidationMessage('âš ï¸ At least one channel function required')
      setIsFormValid(false)
    } else {
      setValidationMessage('âœ“ Ready to save')
      setIsFormValid(true)
    }
  }, [fixture])

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // CHANNEL MANAGEMENT
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  // Generate empty channels when totalChannels changes
  useEffect(() => {
    setFixture(prev => {
      const currentCount = prev.channels.length
      if (currentCount === totalChannels) return prev
      
      if (currentCount < totalChannels) {
        // Add new empty channels
        const newChannels: FixtureChannel[] = Array.from({ length: totalChannels - currentCount }, (_, i) => ({
          index: currentCount + i,
          name: '',
          type: 'unknown' as ChannelType,
          defaultValue: 0,
          is16bit: false
        }))
        return { ...prev, channels: [...prev.channels, ...newChannels] }
      } else {
        // Remove extra channels
        return { ...prev, channels: prev.channels.slice(0, totalChannels) }
      }
    })
  }, [totalChannels])

  // Drag handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, funcType: ChannelType, funcLabel: string) => {
    e.dataTransfer.setData('channelType', funcType)
    e.dataTransfer.setData('channelLabel', funcLabel)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>, slotIndex: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverSlot(slotIndex)
  }

  const handleDragLeave = () => {
    setDragOverSlot(null)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>, slotIndex: number) => {
    e.preventDefault()
    const channelType = e.dataTransfer.getData('channelType') as ChannelType
    const channelLabel = e.dataTransfer.getData('channelLabel')
    
    setFixture(prev => {
      const newChannels = [...prev.channels]
      newChannels[slotIndex] = {
        ...newChannels[slotIndex],
        type: channelType,
        name: channelLabel,
        defaultValue: getSmartDefaultValue(channelType),
        is16bit: channelType.includes('fine')
      }
      return { ...prev, channels: newChannels }
    })
    
    setDragOverSlot(null)
  }

  const clearChannel = (index: number) => {
    setFixture(prev => {
      const newChannels = [...prev.channels]
      newChannels[index] = {
        index,
        name: '',
        type: 'unknown' as ChannelType,
        defaultValue: 0,
        is16bit: false
      }
      return { ...prev, channels: newChannels }
    })
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ”¥ WAVE 4718: IGNITION DEPENDENCIES â€” handlers
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  /** Inmutablemente reemplaza el array `ignitionDeps` del canal `idx`. */
  const updateChannelIgnitionDeps = useCallback((idx: number, deps: IgnitionDependency[]) => {
    setFixture(prev => {
      const newChannels = [...prev.channels]
      const current = newChannels[idx]
      if (!current) return prev
      // Si el array queda vacÃ­o, eliminar la propiedad para mantener
      // el JSON limpio en perfiles sin dependencias.
      if (deps.length === 0) {
        const { ignitionDeps: _omit, ...rest } = current
        newChannels[idx] = rest
      } else {
        newChannels[idx] = { ...current, ignitionDeps: deps }
      }
      return { ...prev, channels: newChannels }
    })
  }, [])

  const addIgnitionDep = useCallback((idx: number, dep: IgnitionDependency) => {
    setFixture(prev => {
      const current = prev.channels[idx]
      if (!current) return prev
      const existing = current.ignitionDeps ?? []
      const newDeps: IgnitionDependency[] = [...existing, dep]
      const newChannels = [...prev.channels]
      newChannels[idx] = { ...current, ignitionDeps: newDeps }
      return { ...prev, channels: newChannels }
    })
  }, [])

  const removeIgnitionDep = useCallback((idx: number, depIndex: number) => {
    setFixture(prev => {
      const current = prev.channels[idx]
      if (!current || !current.ignitionDeps) return prev
      const newDeps = current.ignitionDeps.filter((_, i) => i !== depIndex)
      const newChannels = [...prev.channels]
      if (newDeps.length === 0) {
        const { ignitionDeps: _omit, ...rest } = current
        newChannels[idx] = rest
      } else {
        newChannels[idx] = { ...current, ignitionDeps: newDeps }
      }
      return { ...prev, channels: newChannels }
    })
  }, [])

  const updateIgnitionDep = useCallback((idx: number, depIndex: number, patch: Partial<IgnitionDependency>) => {
    setFixture(prev => {
      const current = prev.channels[idx]
      if (!current || !current.ignitionDeps) return prev
      const newDeps = current.ignitionDeps.map((d, i) =>
        i === depIndex ? { ...d, ...patch } : d
      )
      const newChannels = [...prev.channels]
      newChannels[idx] = { ...current, ignitionDeps: newDeps }
      return { ...prev, channels: newChannels }
    })
  }, [])

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // HANDLERS - WAVE 1112: Save to Library
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  /**
   * Build the complete FixtureDefinition with wheels included
   */
  const buildCompleteFixture = useCallback((sourceFixture?: FixtureDefinition): FixtureDefinition => {
    const fixtureForBuild = sourceFixture ?? fixture

    const fixtureWithGraph = fixtureForBuild as FixtureDefinition & {
      nodeGraph?: typeof forgeGraph
    }
    const hasPersistedNodeGraph = !!fixtureWithGraph.nodeGraph
    const hasGraphTopology = !!forgeGraph && (forgeGraph.nodes.length > 0 || forgeGraph.edges.length > 0)
    const shouldPersistNodeGraph = hasPersistedNodeGraph || forgeGraphDirty || hasGraphTopology

    // WAVE 4548.8e: Snapshot deep-cloned graph to preserve config fidelity
    const graphSnapshot = shouldPersistNodeGraph && forgeGraph
      ? deepClone(forgeGraph)
      : (hasPersistedNodeGraph ? deepClone(fixtureWithGraph.nodeGraph) : undefined)

    // WAVE 4683: Prefer current editor channels unless nodeGraph is actively authoritative.
    const currentChannels = fixtureForBuild.channels
    const graphChannels = shouldPersistNodeGraph && graphSnapshot
      ? NodeGraphBuilder.toChannels(graphSnapshot)
      : null
    const syncedChannels = (forgeGraphDirty || hasGraphTopology) && graphChannels
      ? graphChannels
      : currentChannels

    const hasRed = syncedChannels.some(ch => ch.type === 'red')
    const hasGreen = syncedChannels.some(ch => ch.type === 'green')
    const hasBlue = syncedChannels.some(ch => ch.type === 'blue')
    const hasRgbColorMixing = hasRed && hasGreen && hasBlue

    const builtFixture = {
      ...fixtureForBuild,
      channels: syncedChannels,
      // WAVE 1116.4: Include PHYSICS at root level for JSON export!
      // ðŸ›¡ï¸ WAVE 2093.2 (CW-AUDIT-4): invertPan/Tilt frozen to false in physics.
      // The actual invert values live in fixture.calibration (set by CalibrationView).
      physics: {
        motorType: physics.motorType as any,  // Cast needed: ShowFileV2 vs FixtureDefinition types differ
        maxAcceleration: physics.maxAcceleration,
        maxVelocity: physics.maxVelocity,
        safetyCap: physics.safetyCap,
        orientation: physics.orientation,
        invertPan: false,   // ðŸ›¡ï¸ CW-AUDIT-4: Frozen â€” calibration is master
        invertTilt: false,  // ðŸ›¡ï¸ CW-AUDIT-4: Frozen â€” calibration is master
        swapPanTilt: physics.swapPanTilt,
        homePosition: { ...physics.homePosition },
        tiltLimits: { ...physics.tiltLimits },
      },
      // WAVE 1112: Include wheels at root level for JSON export
      wheels: wheelColors.length > 0 ? { colors: wheelColors } : undefined,
      // Also keep in capabilities for HAL compatibility
      capabilities: {
        ...fixtureForBuild.capabilities,
        colorEngine,
        colorWheel: wheelColors.length > 0 ? {
          colors: wheelColors,
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

    // â”€â”€ WAVE 4732-C: Si hay cÃ©lulas Aether definidas, el compilador
    //    genera el nodeGraph sobreescribiendo cualquier grafo previo.
    //    Las cÃ©lulas son la fuente de verdad cuando existen.
    if (forgeState.cells.length > 0) {
      const compileResult = compileForgeState(forgeState)
      if (compileResult.ok) {
        builtFixture.nodeGraph = compileResult.fixture.nodeGraph
        // Propagar canales resueltos (ignitionDeps con targetChannelIndex)
        builtFixture.channels = compileResult.fixture.channels as FixtureChannel[]
        if (compileResult.warnings.length > 0) {
          console.warn('[Forge 4732-C] Compile warnings:', compileResult.warnings)
        }
      } else {
        console.error('[Forge 4732-C] Blocking compile errors:', compileResult.errors)
        // Blocking errors will surface to the user in 4732-E (toast layer).
        // Por ahora, no abortamos el save â€” el grafo anterior prevalece.
      }
    }

    return builtFixture
  }, [fixture, physics, wheelColors, colorEngine, wheelMinChangeTimeMs, forgeGraph, forgeGraphDirty, forgeState])
  
  const handleSave = useCallback(async () => {
    if (!isFormValid) return
    
    const currentChannels = deepClone(fixture.channels)
    const fixtureSnapshot: FixtureDefinition = {
      ...fixture,
      channels: currentChannels,
    }

    const completeFixture = deepClone(buildCompleteFixture(fixtureSnapshot))
    
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
        setFixture(clonedFixture)
        setEditingSource('user')
        setOriginalFixtureId(clonedFixture.id)
        setSaveMessage('âœ… Saved as User Copy (System fixtures are read-only)')
        setTimeout(() => setSaveMessage(null), 3000)
        
        // ðŸ”¥ WAVE 2183.5: Reconcile using the CLONED fixture (with new user ID)
        // AND pass previousProfileId so stage fixtures pointing to the old system
        // ID get their profileId migrated to the new user ID.
        reconcileFixturesWithProfile(clonedFixture, previousProfileId)
      } else {
        setSaveMessage(`âŒ Save failed: ${result.error}`)
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
        setSaveMessage('âœ… Updated in User Library')
        setTimeout(() => setSaveMessage(null), 3000)
        
        // ðŸ”¥ WAVE 2183.5: Reconcile with the updatedFixture (correct ID)
        reconcileFixturesWithProfile(updatedFixture)
      } else {
        setSaveMessage(`âŒ Update failed: ${result.error}`)
        setTimeout(() => setSaveMessage(null), 5000)
      }
    } else {
      // New fixture: Generate new ID
      if (!completeFixture.id || !completeFixture.id.startsWith('user-')) {
        completeFixture.id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }
      
      const result = await saveUserFixture(completeFixture)
      if (result.success) {
        setEditingSource('user')
        setOriginalFixtureId(completeFixture.id)
        setSaveMessage('âœ… Saved to User Library')
        setTimeout(() => setSaveMessage(null), 3000)
        
        // ðŸ”¥ WAVE 2183.5: Reconcile for new fixtures too (in case they match by ID)
        reconcileFixturesWithProfile(completeFixture)
      } else {
        setSaveMessage(`âŒ Save failed: ${result.error}`)
        setTimeout(() => setSaveMessage(null), 5000)
      }
    }
    
    console.log('[ForgeEmbedded] ðŸ”¨ Saved fixture:', completeFixture.name, '| ID:', completeFixture.id)
    
    // Also call the prop callback for any external handlers
    onSave(completeFixture, physics)
  }, [fixture, fixture.channels, physics, isFormValid, onSave, buildCompleteFixture, editingSource, originalFixtureId, saveUserFixture, reconcileFixturesWithProfile])

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
    setFixture(emptyFixture)
    hydrateForgeGraph(emptyFixture)
    setTotalChannels(8)
    setWheelColors([])
    setColorEngine('rgb')
    setPhysics(DEFAULT_PHYSICS_PROFILES['stepper-quality'])
    setEditingSource('new')
    setOriginalFixtureId(null)
    setActiveTab('general')
  }, [hydrateForgeGraph])

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RENDER
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  return (
    <div className="forge-embedded">
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {/* HEADER - WAVE 1112: Shows editing source */}
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
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
        
        <div className="forge-actions">
          {saveMessage && (
            <span className="save-message">{saveMessage}</span>
          )}
          <span className={`validation-status ${isFormValid ? 'valid' : 'invalid'}`}>
            {validationMessage}
          </span>
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
                    value={fixture.manufacturer || ''}
                    onChange={(e) => setFixture(prev => ({ ...prev, manufacturer: e.target.value }))}
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
                      value={fixture.name || ''}
                      onChange={(e) => setFixture(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div className="cockpit-input-group" style={{ width: '70px' }}>
                    <label>CHs</label>
                    <input
                      type="number"
                      min="1"
                      max="512"
                      value={totalChannels}
                      onChange={(e) => {
                        const val = parseInt(e.target.value)
                        if (!isNaN(val)) setTotalChannels(Math.min(512, Math.max(1, val)))
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
                    className={`type-selector-btn ${fixture.type === typeConfig.value ? 'active' : ''}`}
                    style={{ '--type-color': typeConfig.color } as React.CSSProperties}
                    onClick={() => setFixture(prev => ({ ...prev, type: typeConfig.value }))}
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
                const caps = deriveCapabilitiesUnified(fixture)
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
                    className={`type-selector-btn ${colorEngine === engineConfig.value ? 'active' : ''}`}
                    style={{ '--type-color': '#f59e0b' } as React.CSSProperties}
                    onClick={() => setColorEngine(engineConfig.value)}
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
                    <span className="engine-value">{fixture.physics?.motorType?.toUpperCase() || 'â€”'}</span>
                  </div>
                  <div className="engine-badge" title="Max Acceleration (Â°/sÂ²)">
                    <span className="engine-icon">âš¡</span>
                    <span className="engine-label">ACCEL</span>
                    <span className="engine-value">{fixture.physics?.maxAcceleration || 'â€”'}</span>
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
                <span className="ribbon-count">{fixture.channels.length} channels</span>
              </div>
              
              <div className="dmx-ribbon-track">
                {fixture.channels.map((channel, idx) => {
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
                {fixture.channels.length === 0 && (
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
          <div className="forge-channels-layout">
            {/* Function Palette - Left Sidebar */}
            <aside className="function-foundry">
              <h3>Drag Functions</h3>
              {Object.entries(FUNCTION_PALETTE).map(([category, functions]) => (
                <div key={category} className="function-category">
                  <div 
                    className="category-header"
                    onClick={() => setExpandedFoundry(expandedFoundry === category ? null : category)}
                  >
                    <span>{category}</span>
                    {expandedFoundry === category ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                  {expandedFoundry === category && (
                    <div className="function-list">
                      {functions.map(func => (
                        <div
                          key={func.type}
                          className="function-chip"
                          draggable
                          onDragStart={(e) => handleDragStart(e, func.type, func.label)}
                          style={{ '--func-color': func.color } as React.CSSProperties}
                        >
                          <span className="func-icon">{func.icon}</span>
                          <span className="func-label">{func.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </aside>
            
            {/* Channel Rack - Center */}
            <div className="channel-rack">
              <div className="rack-header">
                <span>Channel</span>
                <span>Function</span>
                <span style={{ fontSize: '10px', color: '#22d3ee', textAlign: 'center' }}>MIN</span>
                <span>Default</span>
                <span></span>
              </div>
              {fixture.channels.map((channel, idx) => {
                const category = getChannelCategory(channel.type)
                const categoryColor = getCategoryColor(category)
                // ðŸ”¥ WAVE 4718: Disponibilidad de canales target para el selector
                const availableTargetTypes = fixture.channels
                  .filter(ch => ch.type !== 'unknown' && ch.type !== channel.type)
                  .map(ch => ch.type)
                  // dedupe preservando orden
                  .filter((t, i, arr) => arr.indexOf(t) === i)
                const depsCount = channel.ignitionDeps?.length ?? 0
                const isIgnitionExpanded = expandedIgnitionIdx === idx
                return (
                  <React.Fragment key={idx}>
                  <div 
                    className={`channel-slot ${channel.type !== 'unknown' ? 'assigned' : ''} ${dragOverSlot === idx ? 'drag-over' : ''} ${category ? `category-${category}` : ''}`}
                    style={categoryColor ? { 
                      '--slot-category-color': categoryColor 
                    } as React.CSSProperties : undefined}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, idx)}
                  >
                    <span className="channel-number">{idx + 1}</span>
                    <div className="channel-function">
                      {channel.type !== 'unknown' ? (
                        // ðŸ”¥ WAVE 2084.3: Phantom channels get an editable name input
                        (() => {
                          const isEditable = ['custom', 'macro', 'rotation', 'speed', 'control'].includes(channel.type)
                          return isEditable ? (
                            <input
                              type="text"
                              className="channel-name-input"
                              placeholder={channel.type.toUpperCase()}
                              value={channel.name || ''}
                              onChange={(e) => {
                                setFixture(prev => {
                                  const newChannels = [...prev.channels]
                                  newChannels[idx] = { ...newChannels[idx], name: e.target.value }
                                  return { ...prev, channels: newChannels }
                                })
                              }}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                background: 'rgba(0,0,0,0.2)',
                                border: `1px solid ${categoryColor ? categoryColor + '55' : 'rgba(255,255,255,0.12)'}`,
                                color: categoryColor || 'inherit',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                width: '120px',
                                fontFamily: 'inherit',
                                fontSize: '11px',
                                outline: 'none',
                              }}
                            />
                          ) : (
                            <span className="channel-name">{channel.name || channel.type}</span>
                          )
                        })()
                      ) : (
                        <span className="channel-empty">Drop function here</span>
                      )}
                    </div>
                    {/* ï¿½ï¸ NUEVA COLUMNA REAL: MIN VALUE (Solo para dimmer por ahora) */}
                    {channel.type === 'dimmer' ? (
                      <input
                        type="number"
                        className="channel-default"
                        min={0}
                        max={255}
                        title="Dead Zone: Minimum activation value"
                        value={fixture.capabilities?.dimmerMin ?? 0}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(255, parseInt(e.target.value) || 0))
                          setFixture(prev => ({
                            ...prev,
                            capabilities: { ...prev.capabilities, dimmerMin: val }
                          }))
                        }}
                      />
                    ) : (
                      /* Placeholder vacÃ­o para mantener el Grid intacto en los demÃ¡s canales */
                      <div className="channel-min-placeholder"></div>
                    )}

                    {/* ðŸŽ¯ COLUMNA DEFAULT ORIGINAL */}
                    <input
                      type="number"
                      className="channel-default"
                      min={0}
                      max={255}
                      value={channel.defaultValue || 0}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(255, parseInt(e.target.value) || 0))
                        setFixture(prev => {
                          const newChannels = [...prev.channels]
                          newChannels[idx] = { ...newChannels[idx], defaultValue: val }
                          return { ...prev, channels: newChannels }
                        })
                      }}
                    />
                    {channel.type !== 'unknown' && (
                      <>
                        {/* ðŸ”¥ WAVE 4718: IGNITION DEPS toggle button */}
                        <button
                          className={`channel-ignition-btn ${depsCount > 0 ? 'has-deps' : ''} ${isIgnitionExpanded ? 'expanded' : ''}`}
                          onClick={() => setExpandedIgnitionIdx(isIgnitionExpanded ? null : idx)}
                          title={depsCount > 0
                            ? `Ignition Dependencies (${depsCount})`
                            : 'Add Ignition Dependency'}
                          style={{
                            background: depsCount > 0 ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                            border: `1px solid ${depsCount > 0 ? 'rgba(245, 158, 11, 0.6)' : 'rgba(255,255,255,0.12)'}`,
                            color: depsCount > 0 ? '#f59e0b' : 'rgba(255,255,255,0.5)',
                            borderRadius: '4px',
                            padding: '4px 6px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '10px',
                            fontFamily: 'inherit',
                          }}
                        >
                          <Zap size={12} />
                          {depsCount > 0 && <span>{depsCount}</span>}
                        </button>
                        <button
                          className="channel-clear"
                          onClick={() => clearChannel(idx)}
                          title="Clear channel"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>

                  {/* ðŸ”¥ WAVE 4718: IGNITION DEPS panel (full-width row beneath the slot) */}
                  {isIgnitionExpanded && channel.type !== 'unknown' && (
                    <div
                      className="ignition-deps-panel"
                      style={{
                        gridColumn: '1 / -1',
                        background: 'rgba(245, 158, 11, 0.05)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        margin: '2px 0 6px 0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#f59e0b',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                      }}>
                        <Zap size={12} />
                        <span>IGNITION DEPENDENCIES</span>
                        <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400, fontSize: '10px' }}>
                          â€” channel "{channel.name || channel.type}" requires:
                        </span>
                      </div>

                      {(channel.ignitionDeps ?? []).length === 0 && (
                        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontStyle: 'italic' }}>
                          No dependencies yet. This channel emits with no prerequisites.
                        </div>
                      )}

                      {(channel.ignitionDeps ?? []).map((dep, depIdx) => (
                        <div
                          key={depIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'rgba(0,0,0,0.25)',
                            border: '1px solid rgba(245, 158, 11, 0.2)',
                            borderRadius: '4px',
                            padding: '6px 8px',
                          }}
                        >
                          <span style={{ color: '#f59e0b', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>
                            âš¡
                          </span>
                          <select
                            value={dep.channelType}
                            onChange={(e) => updateIgnitionDep(idx, depIdx, { channelType: e.target.value as ChannelType })}
                            style={{
                              background: 'rgba(0,0,0,0.4)',
                              border: '1px solid rgba(255,255,255,0.15)',
                              color: '#fff',
                              padding: '4px 6px',
                              borderRadius: '3px',
                              fontFamily: 'inherit',
                              fontSize: '11px',
                              minWidth: '120px',
                            }}
                          >
                            {/* Si el target actual no estÃ¡ en la lista (ej. canal renombrado), inyectarlo */}
                            {!availableTargetTypes.includes(dep.channelType) && (
                              <option value={dep.channelType}>{dep.channelType} (missing)</option>
                            )}
                            {availableTargetTypes.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>â†’</span>
                          <input
                            type="number"
                            min={0}
                            max={255}
                            value={dep.requiredValue}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(255, parseInt(e.target.value) || 0))
                              updateIgnitionDep(idx, depIdx, { requiredValue: val })
                            }}
                            style={{
                              background: 'rgba(0,0,0,0.4)',
                              border: '1px solid rgba(255,255,255,0.15)',
                              color: '#fff',
                              padding: '4px 6px',
                              borderRadius: '3px',
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '11px',
                              width: '60px',
                              textAlign: 'center',
                            }}
                          />
                          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px' }}>DMX</span>
                          <button
                            onClick={() => removeIgnitionDep(idx, depIdx)}
                            title="Remove dependency"
                            style={{
                              marginLeft: 'auto',
                              background: 'transparent',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#ef4444',
                              borderRadius: '3px',
                              padding: '3px 5px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                          >
                            <XIcon size={12} />
                          </button>
                        </div>
                      ))}

                      <button
                        onClick={() => {
                          // Default: primer target disponible que no estÃ© ya usado
                          const used = new Set((channel.ignitionDeps ?? []).map(d => d.channelType))
                          const firstFree = availableTargetTypes.find(t => !used.has(t)) ?? availableTargetTypes[0]
                          if (!firstFree) return
                          // Default requiredValue: 255 para shutter, 0 para otros (heurÃ­stica segura)
                          const requiredValue = firstFree === 'shutter' ? 255 : 255
                          addIgnitionDep(idx, { channelType: firstFree, requiredValue })
                        }}
                        disabled={availableTargetTypes.length === 0}
                        title={availableTargetTypes.length === 0
                          ? 'No other channels to depend on'
                          : 'Add a new ignition dependency'}
                        style={{
                          alignSelf: 'flex-start',
                          background: 'rgba(245, 158, 11, 0.15)',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          color: '#f59e0b',
                          borderRadius: '4px',
                          padding: '6px 10px',
                          cursor: availableTargetTypes.length === 0 ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          opacity: availableTargetTypes.length === 0 ? 0.4 : 1,
                        }}
                      >
                        <Plus size={12} />
                        <span>Add Dependency</span>
                      </button>
                    </div>
                  )}
                  </React.Fragment>
                )
              })}
            </div>
            
            {/* Preview - Right */}
            {showPreview && (
              <div className="rack-preview">
                <Suspense fallback={<div className="preview-loading">Loading...</div>}>
                  <FixturePreview3D
                    fixtureType={fixture.type || 'Moving Head'}
                    pan={previewPan}
                    tilt={previewTilt}
                    dimmer={previewDimmer}
                    color={previewColor}
                    strobeActive={false}
                    showBeam={true}
                    isStressTesting={isStressTesting}
                  />
                </Suspense>
              </div>
            )}

            {/* WAVE 4548.14: Read-only overlay (fuera del flujo del grid) */}
            {!isSimpleCompatible(forgeGraph) && (
              <div className="forge-channels-overlay" role="alert" aria-live="polite">
                <SimpleModeLockBanner
                  onJumpToCanvas={() => {
                    setForgeEditMode('advanced')
                    setActiveTab('nodegraph')
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* NODE GRAPH TAB â€” WAVE 4548.8b / 4548.10 */}
        {activeTab === 'nodegraph' && (
          <NodeGraphTab />
        )}

        {/* WHEELSMITH TAB - WAVE 1111 */}
        {activeTab === 'wheelsmith' && (
          <div className="forge-wheelsmith-panel">
            <WheelSmithEmbedded
              colors={wheelColors}
              onColorsChange={setWheelColors}
              hasColorWheelChannel={fixture.channels.some(ch => ch.type === 'color_wheel')}
              onNavigateToRack={() => setActiveTab('channels')}
              fixtureId={originalFixtureId}
              channelIndex={fixture.channels.findIndex(ch => ch.type === 'color_wheel')}
              minChangeTimeMs={wheelMinChangeTimeMs}
              onMinChangeTimeMsChange={setWheelMinChangeTimeMs}
            />
          </div>
        )}

        {/* PHYSICS ENGINE TAB */}
        {activeTab === 'physics' && (
          <div className="forge-physics-panel">
            <PhysicsTuner
              physics={physics}
              onChange={setPhysics}
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
                {JSON.stringify(fixture, null, 2)}
              </pre>
            </div>
            <div className="export-actions">
              <button className="export-btn json" onClick={handleExportJSON}>
                <Download size={20} />
                <span>Download JSON</span>
              </button>
              <button className="export-btn copy" onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(fixture, null, 2))
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
                      {ch.name || <span style={{ color: '#475569', fontStyle: 'italic' }}>â€”</span>}
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
                        <span style={{ color: '#fbbf24', fontSize: '11px' }}>
                          âš¡ {ch.ignitionDeps!.length}
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

function getSmartDefaultValue(type: ChannelType): number {
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
        <span style={{ fontSize: '10px', fontWeight: 700, color: neon, letterSpacing: '0.1em' }}>
          {String(cell.family)}
        </span>
        <span style={{ flex: 1, color: '#e2e8f0', fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cell.label}
        </span>
        <button
          onClick={() => forgeDispatch({ type: 'CELL_DELETE', cellId: cell.cellId })}
          title="Delete cell"
          style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
        >
          <XIcon size={12} />
        </button>
      </div>

      {/* ID + zona */}
      <div style={{ padding: '4px 10px', borderBottom: '1px solid #1e293b' }}>
        <span style={{ color: '#334155', fontFamily: 'monospace', fontSize: '10px' }}>
          {cell.cellId}
        </span>
        {cell.aetherZone && (
          <span style={{ color: '#7dd3fc', fontSize: '10px', marginLeft: '8px' }}>
            zone: {cell.aetherZone}
          </span>
        )}
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
