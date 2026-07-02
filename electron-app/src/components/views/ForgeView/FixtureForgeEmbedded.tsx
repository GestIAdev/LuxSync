/**
 * 
 * FIXTURE FORGE EMBEDDED - WAVE 1112: FUNCTIONAL CLOSURE & LIBRARY MANAGER
 * "The Blacksmith's Workshop" - Full-screen Fixture Editor (no modal overlay)
 * 
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
 * WAVE 1121: COLOR ENGINE SELECTOR RESTORED
 * - Added COLOR ENGINE selector grid below FIXTURE CLASS
 * - CSS override in FixtureForgeEmbedded.css with !important
 * 
 * @module components/views/ForgeView/FixtureForgeEmbedded
 * @version 1121.0.0
 */

import React, { useState, useCallback, useEffect, useReducer, useRef, type ReactNode } from 'react'

//WAVE 4732-A: Forge Hybrid Builder State

import {
  forgeReducer,
  makeInitialForgeState,
  drainForgeWarnings,
  type IForgeBuilderState,
  type ForgeAction,
} from '../../../core/forge/forgeBuilderState'

// WAVE 4732-C: Compilador 

import { compileForgeState, resolveChannelDeps } from '../../../core/forge/compileForgeState'
import './FixtureForgeEmbedded.css'
import { 
  Server, 
  Factory, 
  Save, 
  Download,
  Share2,
  Eye,
  EyeOff,
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
  MotorType,
  DEFAULT_PHYSICS_PROFILES
} from '../../../core/stage/ShowFileV2'
import { FixtureDefinition, ChannelType, FixtureChannel, ColorEngineType, WheelColor, FixtureType, IgnitionDependency } from '../../../types/FixtureDefinition'
import { NodeGraphBuilder } from '../../../core/forge/NodeGraphBuilder'
import { translateOflFixture } from '../../../core/forge/oflTranslator'
import { UploadIcon } from '../../icons/LuxIcons'
import { FixtureFactory } from '../../../utils/FixtureFactory'
import ForgeGeneralTab from './tabs/ForgeGeneralTab'
export { getChannelCategory, getCategoryColor } from './tabs/ForgeGeneralTab'
import { useStageStore } from '../../../stores/stageStore'
import { useShallow } from 'zustand/react/shallow'
import { useLibraryStore, selectFixtureForge } from '../../../stores/libraryStore'
import { useNavigationStore, selectFixtureForgeNav } from '../../../stores/navigationStore'
import { useForgeGraphStore } from '../../../stores/forgeGraphStore'

// WAVE 1117: Recovered CSS from deleted modal (contains PhysicsTuner styles)

import './FixtureForge.css'
import './FixtureForgeEmbedded.css'  // Standalone styles for embedded mode

import ForgeChannelRackTab from './tabs/ForgeChannelRackTab'
import NodeGraphTab from './tabs/nodegraph/NodeGraphTab'
import ForgeAetherCellsTab from './tabs/ForgeAetherCellsTab'

// 
// TYPES - WAVE 1112: Added 'library' tab
// 

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

// 
// CONSTANTS - English labels (WAVE 1112: LIBRARY tab added)
// 

const TAB_CONFIG: { id: ForgeTabId; label: string; icon: React.ReactNode }[] = [
  { id: 'library',    label: 'LIBRARY',       icon: <BookOpen size={16} /> },
  { id: 'general',    label: 'GENERAL',       icon: <Settings size={16} /> },
  { id: 'channels',   label: 'CHANNEL RACK',  icon: <Server size={16} /> },
  { id: 'aether',     label: 'AETHER CELLS',  icon: <Cpu size={16} /> },
  { id: 'wheelsmith', label: 'WHEELSMITH',    icon: <Palette size={16} /> },
  { id: 'physics',    label: 'PHYSICS ENGINE',icon: <Cog size={16} /> },
  { id: 'nodegraph',  label: 'NODE GRAPH',    icon: <Share2 size={16} /> },
  { id: 'dmx-layout', label: 'DMX LAYOUT',    icon: <Zap size={16} /> },
  { id: 'export',     label: 'EXPORT',        icon: <Download size={16} /> },
]

// 
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

    // WAVE 7122.3: Pro-Graph Reconciliation — merge instead of overwrite.
    // Preserve graph-extended properties (aetherNodeId, aetherZone, cellLabel,
    // profileMeta, etc.) that only exist in the manually-edited node graph.
    // Only sync basic channel properties from the rack.
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
          : cfg.ignitionDeps,
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

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

// 
// COMPONENT
// 

export const FixtureForgeEmbedded: React.FC<FixtureForgeEmbeddedProps> = ({
  onSave,
  editingFixture,
  existingDefinition
}) => {

  // 
  // STORES - WAVE 1113: Updated to async library store
  // WAVE 2042.13.9: useShallow for stable references
  // 
  
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
  
  // 
  // STATE
  // 
  
  const fixtureRef = useRef<FixtureDefinition>(FixtureFactory.createEmpty())

  //  WAVE 4732-A: Forge Hybrid Builder State 

  const [forgeState, forgeDispatch] = useReducer(forgeReducer, undefined, makeInitialForgeState)

  const channels     = forgeState.channels
  const cells        = forgeState.cells
  const dmxGovernors = forgeState.dmxGovernors
  const physics      = forgeState.physics
  const wheels       = forgeState.wheels
  const [activeTab, setActiveTab] = useState<ForgeTabId>('library')  // WAVE 1112: Start at library

  const forgeGraph = useForgeGraphStore(s => s.graph)
  
 
  
  // WAVE 1112: Current editing source tracking

  const [editingSource, setEditingSource] = useState<'system' | 'user' | 'new'>('new')
  const [originalFixtureId, setOriginalFixtureId] = useState<string | null>(null)
  
  // Physics stress testing toggle

  const [isStressTesting, setIsStressTesting] = useState(false)
  
  // UI state

  const [validationMessage, setValidationMessage] = useState('')
  const [isFormValid, setIsFormValid] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleOflFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const rawJson = JSON.parse(event.target?.result as string)
        const translatedFixture = translateOflFixture(rawJson)

        forgeDispatch({ type: 'HYDRATE_FROM_FIXTURE', fixture: translatedFixture })
        setActiveTab('channels')

        console.log(`[OFL Ingesta ⚡] Genoma '${translatedFixture.name}' traducido e hidratado con éxito.`)
      } catch (err) {
        console.error('[OFL Ingesta ❌] Fallo al traducir el genoma OFL:', err)
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }
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


  // 
  // WAVE 1113: Load library from disk on mount
  // 
  
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

  const handleTabClick = useCallback((tabId: ForgeTabId) => {
    setActiveTab(tabId)
  }, [])

  // 
  // WAVE 1112: Load fixture into editor
  // 
  
  const loadFixtureIntoEditor = useCallback((def: FixtureDefinition) => {

    // WAVE 4831 DIAG: detectar llamadas inesperadas post-save

    console.trace('[Forge 4831] 📥 loadFixtureIntoEditor called for:', def.name)
    fixtureRef.current = def
    hydrateForgeGraph(def)
    forgeDispatch({ type: 'HYDRATE_FROM_FIXTURE', fixture: def })
  }, [hydrateForgeGraph, forgeDispatch])

  // 
  // VALIDATION
  // 
  
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

  // 
  // HANDLERS - WAVE 1112: Save to Library
  // 
  
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
      dmxGovernors: state.dmxGovernors.length > 0 ? [...state.dmxGovernors] : baseFixture.dmxGovernors ?? [],
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
    } else if (state.cells.length > 0) {
      // WAVE 7122.4: Single compilation — only use compileForgeState as fallback
      // when there's no live/persisted graph to sync. This eliminates the double
      // compilation that overwrote manually-edited graphs with auto-generated ones.
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
    
    // WAVE 2183.5: Track the PREVIOUS profileId for reconciliation migration
    // When systemâ†’user clone happens, fixtures in the show still point to the old system ID.

    let previousProfileId: string | undefined
    
    // WAVE 1114 FIX: Handle system vs user vs new correctly

    if (editingSource === 'system') {

      //  WAVE 2183.5: Capture the system profileId BEFORE cloning

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
        
        //  WAVE 2183.5: Reconcile using the CLONED fixture (with new user ID)
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
  
  // 
  // WAVE 1112: Library Tab Handlers
  // 
  
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

  // 
  // RENDER
  // 
  
  // WAVE 4732.2: Status badge computation
  const _saveError = saveMessage?.startsWith('Save failed') || saveMessage?.startsWith('Update failed')
  const badgeClass: 'saved' | 'error' | 'ready' | 'invalid' = _saveError ? 'error' : saveMessage ? 'saved' : isFormValid ? 'ready' : 'invalid'
  const badgeIcon = (badgeClass === 'error' || badgeClass === 'invalid') ? <AlertTriangle size={11} /> : <Check size={11} />
  const badgeText = saveMessage ?? validationMessage

  const hasValidChannels = channels.some(c => c.type !== 'unknown')
  const hasValidCells = cells.length > 0

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
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleOflFileChange}
            style={{ display: 'none' }}
          />
          <button
            className="forge-action-btn btn-import-ofl"
            onClick={() => fileInputRef.current?.click()}
            title="Ingestar genoma comunitario de Open Fixture Library"
          >
            <UploadIcon size={18} className="icon-cyan" />
            <span>Import OFL</span>
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
      
 
      {/* TABS - WAVE 1112: Added LIBRARY tab */}

      <nav className="forge-tabs embedded">
        {TAB_CONFIG.map(tab => {
          const isDisabled =
            (tab.id === 'aether' && !hasValidChannels) ||
            (tab.id === 'nodegraph' && !hasValidCells)
          return (
            <button
              key={tab.id}
              className={`forge-tab ${activeTab === tab.id ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
              onClick={() => handleTabClick(tab.id)}
              disabled={isDisabled}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>


      {/* MAIN CONTENT */}
      
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
          <ForgeGeneralTab
            meta={forgeState.meta}
            wheels={forgeState.wheels}
            physics={forgeState.physics}
            channels={channels}
            dispatch={forgeDispatch}
            buildCompleteFixture={buildCompleteFixture}
          />
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
            dmxGovernors={forgeState.dmxGovernors}
          />
        )}

        {/* NODE GRAPH TAB  WAVE 4548.8b / 4548.10 */}
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
              physics={(physics ?? DEFAULT_PHYSICS_PROFILES['unknown']) as any}
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

        {/* WAVE 4732-A: DMX LAYOUT TAB 
            Renderiza `forgeState.channels` la tabla de canales con tipos,
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

        {/*  WAVE 4732-A: AETHER CELLS TAB 
            Renderiza `forgeState.cells`  las cajas de cÃ©lulas Aether.
            El DnD (4732-D) y el compilador (4732-E) llegan en fases siguientes.
            Scaffolding base: split screen Unassigned | Cells. */}
        {activeTab === 'aether' && (
          <ForgeAetherCellsTab
            cells={cells}
            channels={channels}
            dispatch={forgeDispatch}
          />
        )}
      </div>
    </div>
  )
}

// HELPERS


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


export default FixtureForgeEmbedded