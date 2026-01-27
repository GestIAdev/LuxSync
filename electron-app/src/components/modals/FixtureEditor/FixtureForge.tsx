/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔨 FIXTURE FORGE - WAVE 364: LA HERRERÍA
 * "El Laboratorio de Frankenstein donde creamos vida"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Editor profesional de fixtures con:
 * - Channel Mapper (Drag & Drop)
 * - Vista previa 3D en tiempo real
 * - Physics Tuner (El Seguro de Vida)
 * - Export/Import de definiciones
 * 
 * @module components/modals/FixtureEditor/FixtureForge
 * @version 364.0.0
 */

import React, { useState, useCallback, useEffect, DragEvent, Suspense } from 'react'
import { 
  X, 
  GripVertical, 
  Server, 
  Factory, 
  Save, 
  Download, 
  Upload,
  Eye,
  EyeOff,
  Sliders,
  Cpu,
  Settings,
  ChevronDown,
  ChevronUp,
  Trash2,
  Copy,
  AlertTriangle,
  Check,
  Palette  // 🎨 WAVE 1002: Color Engine Icon
} from 'lucide-react'
import { FixturePreview3D } from './FixturePreview3D'
import { PhysicsTuner } from './PhysicsTuner'
import { ColorWheelEditor } from './ColorWheelEditor' // 🎨 WAVE 1006: THE WHEELSMITH
import { 
  PhysicsProfile, 
  DEFAULT_PHYSICS_PROFILES,
  FixtureV2,
  MotorType,
  InstallationOrientation
} from '../../../core/stage/ShowFileV2'
import { FixtureDefinition, ChannelType, FixtureChannel, ColorEngineType, WheelColor, ColorWheelDefinition } from '../../../types/FixtureDefinition'
import { FixtureFactory } from '../../../utils/FixtureFactory'
import { useStageStore } from '../../../stores/stageStore'
import './FixtureForge.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface FixtureForgeProps {
  /** Is the modal open */
  isOpen: boolean
  /** Close handler */
  onClose: () => void
  /** Save handler - returns the complete fixture profile */
  onSave: (
    fixture: FixtureDefinition, 
    physics: PhysicsProfile,
    patchData?: { dmxAddress?: number; universe?: number } // 🎯 WAVE 685.6: Optional patch data
  ) => void
  /** Optional existing fixture to edit */
  editingFixture?: FixtureV2 | null
  /** Optional existing definition to load */
  existingDefinition?: FixtureDefinition | null
}

interface FunctionDef {
  type: ChannelType
  label: string
  color: string
  icon: string
  is16bit?: boolean
}

type TabId = 'channels' | 'physics' | 'export'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const FUNCTION_PALETTE: Record<string, FunctionDef[]> = {
  'INTENSITY': [
    { type: 'dimmer', label: 'Dimmer', color: '#ffffff', icon: '💡' },
    { type: 'shutter', label: 'Shutter', color: '#a0a0a0', icon: '🚪' },
    { type: 'strobe', label: 'Strobe', color: '#ffd700', icon: '⚡' },
  ],
  'COLOR': [
    { type: 'red', label: 'Red', color: '#ff0000', icon: '🔴' },
    { type: 'green', label: 'Green', color: '#00ff00', icon: '🟢' },
    { type: 'blue', label: 'Blue', color: '#0088ff', icon: '🔵' },
    { type: 'white', label: 'White', color: '#ffffff', icon: '⚪' },
    { type: 'amber', label: 'Amber', color: '#ffaa00', icon: '🟠' },
    { type: 'uv', label: 'UV', color: '#bf00ff', icon: '🟣' },
    { type: 'color_wheel', label: 'Color Wheel', color: '#ff00ff', icon: '🎨' },
  ],
  'POSITION': [
    { type: 'pan', label: 'Pan', color: '#00f3ff', icon: '↔️' },
    { type: 'pan_fine', label: 'Pan Fine', color: '#0088aa', icon: '↔' },
    { type: 'tilt', label: 'Tilt', color: '#00f3ff', icon: '↕️' },
    { type: 'tilt_fine', label: 'Tilt Fine', color: '#0088aa', icon: '↕' },
  ],
  'BEAM': [
    { type: 'gobo', label: 'Gobo', color: '#bf00ff', icon: '🕸️' },
    { type: 'prism', label: 'Prism', color: '#dd00ff', icon: '💎' },
    { type: 'focus', label: 'Focus', color: '#00ffcc', icon: '🎯' },
    { type: 'zoom', label: 'Zoom', color: '#00ffcc', icon: '🔍' },
  ],
  'CONTROL': [
    { type: 'speed', label: 'Speed', color: '#ffeb3b', icon: '⏱️' },
    { type: 'macro', label: 'Macro', color: '#00ff44', icon: '⚙️' },
    { type: 'control', label: 'Control', color: '#00ff44', icon: '🎛️' },
  ],
}

const FIXTURE_TYPES = [
  'Moving Head', 
  'Par', 
  'Wash',
  'Bar', 
  'Strobe', 
  'Spot', 
  'Laser', 
  'Blinder',
  'Scanner',
  'Other'
]

// 🔥 WAVE 1003.9: Map FXTParser types to dropdown display values
// This ensures the dropdown shows the correct option when editing from library
const TYPE_TO_DISPLAY_MAP: Record<string, string> = {
  'moving_head': 'Moving Head',
  'moving-head': 'Moving Head',
  'moving': 'Moving Head',
  'movinghead': 'Moving Head',
  'par': 'Par',
  'wash': 'Wash',
  'bar': 'Bar',
  'strobe': 'Strobe',
  'spot': 'Spot',
  'laser': 'Laser',
  'blinder': 'Blinder',
  'scanner': 'Scanner',
  'generic': 'Other',
  'other': 'Other',
}

/**
 * 🔥 WAVE 1003.9: Get display value for fixture type dropdown
 * Handles all formats: 'moving_head', 'Moving Head', 'moving', etc.
 */
function getTypeDisplayValue(type: string | undefined): string {
  if (!type) return 'Other'
  // Check if already a display value
  if (FIXTURE_TYPES.includes(type)) return type
  // Try to map from internal format
  const mapped = TYPE_TO_DISPLAY_MAP[type.toLowerCase()]
  return mapped || 'Other'
}

// 🎨 WAVE 1002: Color Engine Options
const COLOR_ENGINE_OPTIONS: { value: ColorEngineType; label: string; description: string; icon: string }[] = [
  { value: 'rgb', label: 'RGB LEDs', description: 'Red/Green/Blue mixing (PARs, Washes)', icon: '🔴🟢🔵' },
  { value: 'rgbw', label: 'RGBW LEDs', description: 'RGB + White LED', icon: '🔴🟢🔵⚪' },
  { value: 'wheel', label: 'Color Wheel', description: 'Mechanical wheel (Beams, Spots)', icon: '🎨' },
  { value: 'cmy', label: 'CMY Mixing', description: 'Cyan/Magenta/Yellow flags', icon: '🩵🩷💛' },
  { value: 'hybrid', label: 'Hybrid', description: 'Wheel + LEDs combined', icon: '🎨+🔴' },
  { value: 'none', label: 'No Color', description: 'Dimmer only (Strobes, etc)', icon: '⬜' },
]

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎨 WAVE 687.1: Smart default values for channel types
 * 
 * Returns sensible DMX default values based on channel type:
 * - Intensity channels: default to max (255) for visibility
 * - Position channels: default to center (127)
 * - Effect channels: default to off (0)
 */
function getSmartDefaultValue(type: ChannelType): number {
  switch (type) {
    // Intensity - default ON for visibility
    case 'dimmer':
      return 255  // Max brightness
    case 'shutter':
      return 255  // Open (visible)
    
    // Position - default to center
    case 'pan':
    case 'tilt':
      return 127  // Center position
    
    // Fine channels - default to 0 (no offset)
    case 'pan_fine':
    case 'tilt_fine':
      return 0
    
    // Color channels - default off (no color mixing)
    case 'red':
    case 'green':
    case 'blue':
    case 'white':
    case 'amber':
    case 'uv':
      return 0
    
    // Effects - default off
    case 'color_wheel':
    case 'gobo':
    case 'prism':
    case 'strobe':
    case 'macro':
      return 0
    
    // Optics - default to middle
    case 'focus':
    case 'zoom':
      return 128
    
    // Speed/Control - varies by fixture, default middle
    case 'speed':
    case 'control':
      return 128
    
    // Unknown - safe default
    case 'unknown':
    default:
      return 0
  }
}

/**
 * Generate deterministic ID (NO Math.random - Axioma Anti-Simulación)
 */
function generateFixtureId(name: string): string {
  const timestamp = Date.now()
  const hash = (name || 'fixture').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return `fxt-${hash}-${timestamp}`
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 390: SINGLE SOURCE OF TRUTH - buildFinalFixture
// LA ÚNICA FUNCIÓN AUTORIZADA PARA GENERAR EL JSON FINAL
// ═══════════════════════════════════════════════════════════════════════════

const TYPE_NORMALIZATION_MAP: Record<string, string> = {
  'Moving Head': 'moving',
  'moving': 'moving',
  'moving_head': 'moving',  // 🔥 WAVE 1003.6: FXTParser format
  'Par': 'par', 
  'par': 'par',
  'Strobe': 'strobe',
  'strobe': 'strobe',
  'Wash': 'moving',
  'wash': 'moving',
  'Laser': 'laser',
  'laser': 'laser',
  'Bar': 'bar',
  'bar': 'bar',
  'Spot': 'spot',
  'spot': 'spot',
  'Blinder': 'blinder',
  'blinder': 'blinder',
  'Scanner': 'scanner',
  'scanner': 'scanner',
  'Generic': 'generic',
  'generic': 'generic',
  'Other': 'generic'
}

/**
 * 🔥 WAVE 390: SINGLE SOURCE OF TRUTH
 * Esta función es la ÚNICA autorizada para construir el JSON final.
 * Llamada por handleSave Y por la vista previa JSON.
 * 
 * @param fixture - Base fixture data
 * @param physics - Physics profile
 * @param colorEngine - 🎨 WAVE 1002: Manual color engine selection (overrides auto-detection)
 * @param wheelColors - 🎨 WAVE 1006: THE WHEELSMITH color wheel configuration
 */
function buildFinalFixture(
  fixture: FixtureDefinition, 
  physics: PhysicsProfile,
  colorEngine?: ColorEngineType,
  wheelColors?: WheelColor[]
): FixtureDefinition {
  // 1. Normalizar tipo
  const normalizedType = TYPE_NORMALIZATION_MAP[fixture.type] || 'generic'
  
  // 2. Normalizar motorType - 'unknown' -> 'stepper' como default seguro
  const normalizedMotorType = (!physics.motorType || physics.motorType === 'unknown') 
    ? 'stepper' 
    : physics.motorType
  
  // 3. Construir canales limpios
  const cleanChannels = fixture.channels.map((ch, i) => ({
    index: i,
    type: ch.type || 'unknown',
    name: ch.name || undefined, // undefined se omite en JSON
    defaultValue: ch.defaultValue, // 🔥 WAVE 1008.7: Preserve undefined - let FixtureMapper handle defaults
    is16bit: ch.is16bit || false
  }))
  
  // 4. 🎨 WAVE 1002: Generate capabilities based on colorEngine (if provided) or channels
  // If colorEngine is explicitly set, use it to determine hasColorMixing/hasColorWheel
  // This allows manual override for fixtures with generic channels
  const hasColorMixingFromChannels = cleanChannels.some(ch => ['red', 'green', 'blue'].includes(ch.type))
  const hasColorWheelFromChannels = cleanChannels.some(ch => ch.type === 'color_wheel')
  
  // Determine final color flags based on colorEngine selection
  let hasColorMixing = hasColorMixingFromChannels
  let hasColorWheel = hasColorWheelFromChannels
  
  if (colorEngine) {
    // 🎨 WAVE 1002: Manual override - use colorEngine to set flags
    switch (colorEngine) {
      case 'rgb':
      case 'rgbw':
        hasColorMixing = true
        hasColorWheel = false
        break
      case 'wheel':
        hasColorMixing = false
        hasColorWheel = true
        break
      case 'cmy':
        hasColorMixing = true  // CMY is a form of color mixing
        hasColorWheel = false
        break
      case 'hybrid':
        hasColorMixing = true
        hasColorWheel = true
        break
      case 'none':
        hasColorMixing = false
        hasColorWheel = false
        break
    }
  }
  
  // 🎨 WAVE 1006: THE WHEELSMITH - Build colorWheel capability if colors exist
  const colorWheelConfig: ColorWheelDefinition | undefined = 
    wheelColors && wheelColors.length > 0 
      ? {
          colors: wheelColors,
          allowsContinuousSpin: false, // Future: could be configurable
          minChangeTimeMs: 150 // Mechanical protection default
        }
      : undefined
  
  const capabilities = {
    hasPan: cleanChannels.some(ch => ch.type === 'pan'),
    hasTilt: cleanChannels.some(ch => ch.type === 'tilt'),
    hasColorMixing,
    hasColorWheel,
    hasGobo: cleanChannels.some(ch => ch.type === 'gobo'),
    hasPrism: cleanChannels.some(ch => ch.type === 'prism'),
    hasStrobe: cleanChannels.some(ch => ch.type === 'strobe'),
    hasDimmer: cleanChannels.some(ch => ch.type === 'dimmer'),
    // 🎨 WAVE 1002: Persist the explicit color engine selection
    colorEngine: colorEngine || (hasColorWheel ? 'wheel' : hasColorMixing ? 'rgb' : 'none'),
    // 🎨 WAVE 1006: THE WHEELSMITH - Persist color wheel mapping for HAL
    colorWheel: colorWheelConfig
  }
  
  // 5. WAVE 390.5: Build complete physics object with ALL configurable fields
  const completePhysics = {
    motorType: normalizedMotorType as 'servo' | 'stepper' | 'brushless' | 'servo-pro' | 'stepper-pro',
    maxAcceleration: physics.maxAcceleration || 8.0,
    maxVelocity: physics.maxVelocity || 120,
    safetyCap: typeof physics.safetyCap === 'boolean' ? physics.safetyCap : true,
    // Installation-specific settings (also saved for fixture templates)
    orientation: physics.orientation || 'floor',
    invertPan: physics.invertPan || false,
    invertTilt: physics.invertTilt || false,
    swapPanTilt: physics.swapPanTilt || false,
    homePosition: physics.homePosition || { pan: 127, tilt: 127 },
    tiltLimits: physics.tiltLimits || { min: 0, max: 255 }
  }
  
  // 6. Retornar objeto final INMUTABLE
  return {
    id: fixture.id || generateFixtureId(fixture.name || 'Untitled'),
    name: fixture.name || 'Untitled',
    manufacturer: fixture.manufacturer || 'Generic',
    type: normalizedType,
    channels: cleanChannels as FixtureChannel[],
    physics: completePhysics,
    capabilities
  }
}

/**
 * Get category color for a channel type
 */
function getCategoryColor(type: ChannelType | undefined): string {
  if (!type || type === 'unknown') return '#333'
  const def = Object.values(FUNCTION_PALETTE).flat().find(f => f.type === type)
  return def?.color || '#333'
}

/**
 * Detect if channel is 16-bit based on naming pattern
 */
function detect16bit(type: ChannelType, prevChannel?: FixtureChannel): boolean {
  // Cast to string for comparison since TypeScript may have stale types
  const typeStr = type as string
  if (typeStr === 'pan_fine' || typeStr === 'tilt_fine') return true
  if (prevChannel && (prevChannel.type === 'pan' || prevChannel.type === 'tilt')) {
    if (typeStr === 'pan_fine' || typeStr === 'tilt_fine') return true
  }
  return false
}

/**
 * Export fixture definition to .fxt format (FreeStyler compatible)
 * WAVE 388 STEP 3: Fixed channel mapping - uses name if available, fallback to type
 * WAVE 388.5: Type normalization applied to FXT export too
 */
function exportToFXT(fixture: FixtureDefinition): string {
  // WAVE 388.5: Normalize type for FXT export
  const fxtTypeMap: Record<string, string> = {
    'Moving Head': 'moving',
    'moving': 'moving',
    'Par': 'par',
    'par': 'par',
    'Strobe': 'strobe',
    'strobe': 'strobe',
    'Wash': 'moving',
    'wash': 'moving',
    'Laser': 'laser',
    'laser': 'laser',
    'Generic': 'generic',
    'generic': 'generic'
  }
  const normalizedType = fxtTypeMap[fixture.type] || 'generic'
  
  const lines: string[] = [
    `; FXT Definition generated by LuxSync Fixture Forge`,
    `; ${new Date().toISOString()}`,
    ``,
    `[General]`,
    `Manufacturer=${fixture.manufacturer}`,
    `Name=${fixture.name}`,
    `Type=${normalizedType}`,
    `Channels=${fixture.channels.length}`,
    ``,
    `[Channels]`
  ]
  
  // WAVE 388: Use name first, fallback to type label
  fixture.channels.forEach((ch, i) => {
    // If channel has a custom name, use it; otherwise use type label
    const channelName = ch.name || (ch.type !== 'unknown' ? 
      ch.type.charAt(0).toUpperCase() + ch.type.slice(1).replace('_', ' ') : 
      'Unknown')
    lines.push(`Channel${i + 1}=${channelName}`)
  })
  
  lines.push('')
  lines.push(`[Functions]`)
  
  // WAVE 388: Enhanced type mapping
  fixture.channels.forEach((ch, i) => {
    const typeMap: Record<string, string> = {
      'dimmer': 'Dimmer',
      'dimmer_fine': 'Dimmer Fine',
      'pan': 'Pan',
      'pan_fine': 'Pan Fine',
      'tilt': 'Tilt',
      'tilt_fine': 'Tilt Fine',
      'red': 'Red',
      'green': 'Green',
      'blue': 'Blue',
      'white': 'White',
      'amber': 'Amber',
      'uv': 'UV',
      'strobe': 'Strobe',
      'shutter': 'Shutter',
      'gobo': 'Gobo',
      'gobo_rotation': 'Gobo Rotation',
      'prism': 'Prism',
      'prism_rotation': 'Prism Rotation',
      'color_wheel': 'Color',
      'zoom': 'Zoom',
      'focus': 'Focus',
      'iris': 'Iris',
      'speed': 'Speed',
      'control': 'Control',
      'macro': 'Macro'
    }
    lines.push(`Function${i + 1}=${typeMap[ch.type] || 'Unknown'}`)
  })
  
  return lines.join('\n')
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const FixtureForge: React.FC<FixtureForgeProps> = ({
  isOpen,
  onClose,
  onSave,
  editingFixture,
  existingDefinition
}) => {
  // ═══════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════
  
  const [fixture, setFixture] = useState<FixtureDefinition>(FixtureFactory.createEmpty())
  const [physics, setPhysics] = useState<PhysicsProfile>(DEFAULT_PHYSICS_PROFILES['stepper-quality'])
  const [totalChannels, setTotalChannels] = useState<number>(8)
  const [activeTab, setActiveTab] = useState<TabId>('channels')
  
  // 🎯 WAVE 685.6: DMX Address (only for stage fixtures, not library definitions)
  const [dmxAddress, setDmxAddress] = useState<number | null>(null)
  const [universe, setUniverse] = useState<number>(0)  // 🔥 WAVE 1008.5: Default to 0, not 1
  
  // 🎨 WAVE 1002: Color Engine Selection
  const [colorEngine, setColorEngine] = useState<ColorEngineType>('rgb')
  
  // 🎨 WAVE 1006: THE WHEELSMITH - Color Wheel Configuration
  const [wheelColors, setWheelColors] = useState<WheelColor[]>([])
  const [wheelEditorOpen, setWheelEditorOpen] = useState(false)
  const [wheelEditorChannelIndex, setWheelEditorChannelIndex] = useState<number | null>(null)  // 🎛️ WAVE 1006.5
  
  // Preview controls
  const [showPreview, setShowPreview] = useState(true)
  const [previewPan, setPreviewPan] = useState(127)
  const [previewTilt, setPreviewTilt] = useState(127)
  const [previewDimmer, setPreviewDimmer] = useState(200)
  const [previewColor, setPreviewColor] = useState({ r: 255, g: 255, b: 255 })
  const [previewStrobe, setPreviewStrobe] = useState(false)
  const [showBeam, setShowBeam] = useState(true)
  const [isStressTesting, setIsStressTesting] = useState(false)
  
  // UI state
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)
  const [validationMessage, setValidationMessage] = useState('')
  const [isFormValid, setIsFormValid] = useState(false)
  const [expandedFoundry, setExpandedFoundry] = useState<string | null>('POSITION')
  
  // WAVE 390.5: Flag to prevent channel regeneration on edit load
  const isLoadingExistingRef = React.useRef(false)
  
  // ═══════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════════
  
  // WAVE 390.5: Track if we already initialized to prevent re-init while open
  const hasInitializedRef = React.useRef(false)
  
  // 🎯 WAVE 685.6: Capture props ONLY when modal opens to prevent re-init on prop changes
  const initialPropsRef = React.useRef<{
    existingDefinition: FixtureDefinition | null
    editingFixture: FixtureV2 | null
  }>({ existingDefinition: null, editingFixture: null })
  
  // Initialize on open
  useEffect(() => {
    // WAVE 390.5: Only initialize when modal OPENS, not when props change while open
    if (isOpen && !hasInitializedRef.current) {
      hasInitializedRef.current = true
      // 🎯 WAVE 685.6: Capture current props
      initialPropsRef.current = { 
        existingDefinition: existingDefinition || null, 
        editingFixture: editingFixture || null 
      }
      console.log('[FixtureForge] 🔓 Modal opened, initializing...')
      
      if (existingDefinition) {
        // Edit mode - load existing definition (from library)
        // WAVE 390.5: Set flag BEFORE updating state to prevent regeneration
        isLoadingExistingRef.current = true
        
        // 🔥 WAVE 1003.9: Convert type to display format for dropdown compatibility
        const displayType = getTypeDisplayValue(existingDefinition.type)
        console.log('[FixtureForge] 🔄 Type display conversion:', existingDefinition.type, '→', displayType)
        
        setFixture({
          ...existingDefinition,
          type: displayType  // Use display format so dropdown works
        })
        setTotalChannels(existingDefinition.channels.length)
        
        // WAVE 390.5 FIX: Load physics from existing definition!
        // Merge with defaults because FixtureDefinition.physics has fewer fields than PhysicsProfile
        if (existingDefinition.physics) {
          console.log('[FixtureForge] 📝 Loading physics:', existingDefinition.physics)
          
          // Map motorType to find best matching default profile
          const baseMotorType = existingDefinition.physics.motorType?.includes('servo') 
            ? 'servo-pro' 
            : existingDefinition.physics.motorType?.includes('stepper') 
              ? 'stepper-quality' 
              : 'stepper-quality'
          const baseProfile = DEFAULT_PHYSICS_PROFILES[baseMotorType] || DEFAULT_PHYSICS_PROFILES['stepper-quality']
          
          // Merge: existing values override defaults
          // WAVE 390.5 FIX: Cargar TODOS los campos extendidos del JSON, no solo 3
          const mergedPhysics: PhysicsProfile = {
            ...baseProfile,
            motorType: (existingDefinition.physics.motorType as MotorType) || baseProfile.motorType,
            maxAcceleration: existingDefinition.physics.maxAcceleration ?? baseProfile.maxAcceleration,
            maxVelocity: existingDefinition.physics.maxVelocity ?? baseProfile.maxVelocity,
            safetyCap: typeof existingDefinition.physics.safetyCap === 'boolean' 
              ? existingDefinition.physics.safetyCap 
              : true,
            // Installation-specific settings (pueden venir del JSON o null)
            orientation: (existingDefinition.physics.orientation as InstallationOrientation) || baseProfile.orientation,
            invertPan: existingDefinition.physics.invertPan ?? baseProfile.invertPan,
            invertTilt: existingDefinition.physics.invertTilt ?? baseProfile.invertTilt,
            swapPanTilt: existingDefinition.physics.swapPanTilt ?? baseProfile.swapPanTilt,
            homePosition: existingDefinition.physics.homePosition 
              ? { ...existingDefinition.physics.homePosition } 
              : { ...baseProfile.homePosition },
            tiltLimits: existingDefinition.physics.tiltLimits 
              ? { ...existingDefinition.physics.tiltLimits } 
              : { ...baseProfile.tiltLimits }
          }
          console.log('[FixtureForge] ✅ Merged physics loaded:', mergedPhysics)
          setPhysics(mergedPhysics)
        } else {
          console.log('[FixtureForge] ⚠️ No physics in definition, using default')
          setPhysics(DEFAULT_PHYSICS_PROFILES['stepper-quality'])
        }
        
        console.log('[FixtureForge] 📝 Loaded existing definition:', existingDefinition.name, 'with', existingDefinition.channels.length, 'channels')
        
        // � WAVE 1002: Load color engine from capabilities (if exists)
        if (existingDefinition.capabilities?.colorEngine) {
          console.log('[FixtureForge] 🎨 Loading color engine:', existingDefinition.capabilities.colorEngine)
          setColorEngine(existingDefinition.capabilities.colorEngine)
        } else {
          // Auto-detect from capabilities flags (legacy support)
          const autoDetected: ColorEngineType = existingDefinition.capabilities?.hasColorWheel 
            ? (existingDefinition.capabilities?.hasColorMixing ? 'hybrid' : 'wheel')
            : existingDefinition.capabilities?.hasColorMixing 
              ? 'rgb' 
              : 'none'
          console.log('[FixtureForge] 🎨 Auto-detected color engine:', autoDetected)
          setColorEngine(autoDetected)
        }
        
        // 🎨 WAVE 1006: THE WHEELSMITH - Load color wheel configuration
        if (existingDefinition.capabilities?.colorWheel?.colors) {
          console.log('[FixtureForge] 🎨 Loading color wheel:', existingDefinition.capabilities.colorWheel.colors.length, 'colors')
          setWheelColors(existingDefinition.capabilities.colorWheel.colors)
        } else {
          setWheelColors([])
        }
        
        // �🎯 WAVE 685.6: If we also have editingFixture, load DMX from it
        if (editingFixture) {
          setDmxAddress(editingFixture.address ?? 1)
          setUniverse(editingFixture.universe ?? 0)
          console.log('[FixtureForge] 📍 Loaded DMX from stage fixture:', {
            address: editingFixture.address ?? 1,
            universe: editingFixture.universe ?? 0
          })
        }
      } else if (editingFixture) {
        // 🔥 WAVE 384.5: Create from stage fixture - NOW USES INLINE CHANNELS!
        // editingFixture.channels now contains the channel definitions thanks to WAVE 384
        const fixtureChannels: FixtureChannel[] = editingFixture.channels?.map((ch, idx) => ({
          index: ch.index ?? idx,
          name: ch.name || '',
          type: (ch.type || 'unknown') as ChannelType,
          defaultValue: 0,
          is16bit: ch.is16bit || ch.name?.toLowerCase().includes('fine') || false
        })) || []
        
        console.log(`[FixtureForge] 🔥 Loaded ${fixtureChannels.length} channels from editingFixture`)
        
        // 🔥 WAVE 1003.9: Convert type to display format
        const displayType = getTypeDisplayValue(editingFixture.type)
        console.log('[FixtureForge] 🔄 Type display conversion (stage):', editingFixture.type, '→', displayType)
        
        setFixture({
          id: editingFixture.profileId || editingFixture.id,
          name: editingFixture.model,
          manufacturer: editingFixture.manufacturer,
          type: displayType,  // Use display format
          channels: fixtureChannels
        })
        setTotalChannels(fixtureChannels.length || editingFixture.channelCount || 8)
        setPhysics(editingFixture.physics)
        
        // 🎯 WAVE 685.6: Load DMX address from stage fixture (default to 1 if missing)
        setDmxAddress(editingFixture.address ?? 1)
        setUniverse(editingFixture.universe ?? 0)
        console.log('[FixtureForge] 📍 Loaded DMX:', {
          address: editingFixture.address ?? 1,
          universe: editingFixture.universe ?? 0
        })
      } else {
        // New fixture
        setFixture(FixtureFactory.createEmpty())
        setTotalChannels(8)
        setPhysics(DEFAULT_PHYSICS_PROFILES['stepper-quality'])
      }
      
      // Reset preview
      setPreviewPan(127)
      setPreviewTilt(127)
      setPreviewDimmer(200)
      setActiveTab('channels')
    }
    
    // Reset flag when modal closes
    if (!isOpen) {
      hasInitializedRef.current = false
      isLoadingExistingRef.current = false
      // WAVE 390.5: Reset state when modal closes to prevent stale data
      setFixture(FixtureFactory.createEmpty())
      setTotalChannels(8)
      setPhysics(DEFAULT_PHYSICS_PROFILES['stepper-quality'])
      // 🎯 WAVE 685.6: Reset DMX fields
      setDmxAddress(null)
      setUniverse(0)  // 🔥 WAVE 1008.5: Default to universe 0
      // 🎨 WAVE 1002: Reset color engine
      setColorEngine('rgb')
      // 🎨 WAVE 1006: Reset wheel colors
      setWheelColors([])
      console.log('[FixtureForge] 🧹 Modal closed, state reset')
    }
  }, [isOpen]) // 🎯 WAVE 685.6: ONLY depend on isOpen to prevent re-init while modal is open
  
  // Update channels when totalChannels changes
  // WAVE 390.5: This effect ONLY runs for NEW fixtures or when user changes channel count
  // For existing definitions, channels are loaded directly in the init effect above
  useEffect(() => {
    // WAVE 390.5: Skip regeneration if we just loaded an existing definition
    if (isLoadingExistingRef.current) {
      console.log('[FixtureForge] 🛡️ WAVE 390.5: Skipping channel regeneration (loading existing)')
      // 🔥 WAVE 1003.5 FIX: Reset flag AFTER this render cycle to allow future edits
      // Use setTimeout to defer reset until after React's batched updates complete
      setTimeout(() => {
        isLoadingExistingRef.current = false
        console.log('[FixtureForge] ✅ WAVE 1003.5: Flag reset, manual edits now allowed')
      }, 0)
      return
    }
    
    // Only regenerate if we have a valid count AND we're not in edit mode
    if (totalChannels > 0 && totalChannels <= 64) {
      // 🔥 WAVE 1003.5 FIX: ALWAYS preserve existing channels when resizing
      // If we already have the exact right number with data, skip
      const hasExactMatch = fixture.channels.length === totalChannels && 
        fixture.channels.some(ch => ch.type !== 'unknown' || ch.name)
      
      if (hasExactMatch) {
        console.log('[FixtureForge] 🛡️ Channels already match count, skipping')
        return
      }
      
      // Otherwise, resize the array while PRESERVING existing channel data
      console.log(`[FixtureForge] 🔄 Resizing channels: ${fixture.channels.length} → ${totalChannels}`)
      const newChannels = FixtureFactory.generateChannels(totalChannels, fixture.channels)
      const sanitizedChannels = newChannels.map(ch =>
        ch.type ? ch : { ...ch, type: 'unknown' as ChannelType, name: '' }
      )
      setFixture(prev => ({ ...prev, channels: sanitizedChannels }))
    }
  }, [totalChannels, fixture.channels.length])
  
  // Validation
  useEffect(() => {
    const activeChannels = fixture.channels.filter(ch => ch.type !== 'unknown')
    
    if (!fixture.name || fixture.name.trim().length === 0) {
      setValidationMessage('⚠️ Introduce un nombre de modelo')
      setIsFormValid(false)
    } else if (activeChannels.length === 0) {
      setValidationMessage('⚠️ Asigna al menos una función')
      setIsFormValid(false)
    } else {
      setValidationMessage(`✅ Listo: ${activeChannels.length} canales configurados`)
      setIsFormValid(true)
    }
  }, [fixture])
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, func: FunctionDef) => {
    e.dataTransfer.setData('application/json', JSON.stringify(func))
    e.dataTransfer.effectAllowed = 'copy'
  }, [])
  
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, slotIndex: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverSlot(slotIndex)
  }, [])
  
  const handleDragLeave = useCallback(() => {
    setDragOverSlot(null)
  }, [])
  
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, slotIndex: number) => {
    e.preventDefault()
    setDragOverSlot(null)
    
    try {
      const data = e.dataTransfer.getData('application/json')
      const func: FunctionDef = JSON.parse(data)
      const prevChannel = slotIndex > 0 ? fixture.channels[slotIndex - 1] : undefined
      
      const newChannels = [...fixture.channels]
      newChannels[slotIndex] = {
        ...newChannels[slotIndex],
        type: func.type,
        name: func.label,
        // 🎨 WAVE 687.1: Smart defaults for common channel types
        defaultValue: getSmartDefaultValue(func.type),
        is16bit: detect16bit(func.type, prevChannel)
      }
      
      setFixture(prev => ({ ...prev, channels: newChannels }))
    } catch (err) {
      console.error('[FixtureForge] Drop error:', err)
    }
  }, [fixture.channels])
  
  const handleClearSlot = useCallback((slotIndex: number) => {
    const newChannels = [...fixture.channels]
    newChannels[slotIndex] = {
      ...newChannels[slotIndex],
      type: 'unknown' as ChannelType,
      name: '',
      defaultValue: 0,
      is16bit: false
    }
    setFixture(prev => ({ ...prev, channels: newChannels }))
  }, [fixture.channels])
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎛️ WAVE 1006.5: THE LIVE PROBE - DMX Test Handler
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleWheelTest = useCallback(async (dmxValue: number) => {
    // Only send DMX if we know the channel index and have a valid address
    if (wheelEditorChannelIndex === null) {
      console.log('[FixtureForge] 🎛️ LIVE PROBE: No channel index set')
      return
    }
    
    // Calculate the absolute DMX channel
    // dmxAddress is the fixture's start address (1-based), channelIndex is 0-based
    const baseAddress = dmxAddress ?? 1
    const absoluteChannel = baseAddress + wheelEditorChannelIndex
    
    console.log('[FixtureForge] 🎛️ NERVE LINK:', {
      channelIndex: wheelEditorChannelIndex,
      baseAddress,
      absoluteChannel,
      universe,
      value: dmxValue
    })
    
    // 🔥 WAVE 1008.8: USE THE SAME API AS TESTPANEL - window.lux.arbiter.setManual
    // This is the PROVEN path that works for TestPanel's color tests
    const lux = window.lux as any
    
    if (!lux) {
      console.error('[FixtureForge] 🎛️ window.lux is undefined!')
      return
    }
    
    // Get fixture ID for arbiter calls
    const fixtureId = editingFixture?.id
    if (!fixtureId) {
      console.error('[FixtureForge] 🎛️ No fixture ID available for Arbiter')
      return
    }
    
    // 🔥 WAVE 1008.8: Use Arbiter.setManual (same as TestPanel - IT WORKS!)
    if (lux?.arbiter?.setManual) {
      try {
        // Set strobe OFF first
        const strobeChannelIndex = fixture.channels.findIndex((ch: any) => ch.type === 'strobe')
        if (strobeChannelIndex >= 0) {
          console.log(`[FixtureForge] ⚡ Setting strobe = 0 via Arbiter`)
          await lux.arbiter.setManual({
            fixtureIds: [fixtureId],
            controls: { strobe: 0 },
            channels: ['strobe'],
          })
        }
        
        // Set dimmer ON
        const dimmerChannelIndex = fixture.channels.findIndex((ch: any) => ch.type === 'dimmer')
        if (dimmerChannelIndex >= 0) {
          console.log(`[FixtureForge] 🔆 Setting dimmer = 255 via Arbiter`)
          await lux.arbiter.setManual({
            fixtureIds: [fixtureId],
            controls: { dimmer: 255 },
            channels: ['dimmer'],
          })
        }
        
        // Set color wheel value
        console.log(`[FixtureForge] � Setting color_wheel = ${dmxValue} via Arbiter`)
        await lux.arbiter.setManual({
          fixtureIds: [fixtureId],
          controls: { color_wheel: dmxValue },
          channels: ['color_wheel'],
        })
        
        console.log(`[FixtureForge] ✅ Arbiter commands sent successfully`)
      } catch (err) {
        console.error('[FixtureForge] ❌ Arbiter error:', err)
      }
    } else {
      console.error('[FixtureForge] 🎛️ window.lux.arbiter.setManual not available')
    }
  }, [wheelEditorChannelIndex, dmxAddress, universe, fixture.channels])
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔥 WAVE 390: DUMB SAVE HANDLER - USES SINGLE SOURCE OF TRUTH
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleSave = useCallback(async () => {
    if (!isFormValid) return
    
    // 🔥 WAVE 390 + 1002 + 1006: Usar la función pura buildFinalFixture con colorEngine y wheelColors
    const finalFixture = buildFinalFixture(fixture, physics, colorEngine, wheelColors)
    
    console.log('[FixtureForge] 💾 WAVE 390 DUMB SAVE:', {
      id: finalFixture.id,
      name: finalFixture.name,
      type: finalFixture.type,
      channelCount: finalFixture.channels.length,
      physics: finalFixture.physics,
      colorEngine: finalFixture.capabilities?.colorEngine,  // 🎨 WAVE 1002
      colorWheelSlots: finalFixture.capabilities?.colorWheel?.colors?.length ?? 0  // 🎨 WAVE 1006
    })
    
    // Guardar en disco
    if (window.lux?.saveDefinition) {
      try {
        const result = await window.lux.saveDefinition(finalFixture)
        console.log('[FixtureForge] 💾 Save Result:', result)
        
        if (result.success) {
          console.log(`[FixtureForge] ✅ Saved to: ${result.path || result.filePath}`)
          
          // 🎯 WAVE 685.6: Include patch data if available
          console.log('[FixtureForge] 📍 Preparing patchData:', { dmxAddress, universe, isNull: dmxAddress === null })
          const patchData = dmxAddress !== null ? { dmxAddress, universe } : undefined
          console.log('[FixtureForge] 📍 Final patchData:', patchData)
          
          // Notificar al padre y cerrar
          onSave(finalFixture, physics, patchData)
          onClose()
        } else {
          console.error(`[FixtureForge] ❌ Save failed:`, result.error)
          alert('Error saving: ' + result.error)
        }
      } catch (err) {
        console.error(`[FixtureForge] ❌ Save exception:`, err)
        alert('Error saving: ' + String(err))
      }
    } else {
      console.error('[FixtureForge] ❌ window.lux.saveDefinition not available!')
      alert('Save function not available')
    }
  }, [fixture, physics, isFormValid, onSave, onClose, dmxAddress, universe, colorEngine, wheelColors]) // 🎯 WAVE 685.6 + 1002 + 1006: Add deps
  
  const handleExport = useCallback(() => {
    const fxtContent = exportToFXT(fixture)
    const blob = new Blob([fxtContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `${fixture.manufacturer || 'Generic'}_${fixture.name || 'Fixture'}.fxt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [fixture])
  
  const handleImport = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.fxt,.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      
      try {
        const text = await file.text()
        
        // Try JSON first
        if (file.name.endsWith('.json')) {
          const imported = JSON.parse(text) as FixtureDefinition
          setFixture(imported)
          setTotalChannels(imported.channels.length)
        }
        // TODO: Parse .fxt format
        
      } catch (err) {
        console.error('[FixtureForge] Import error:', err)
      }
    }
    input.click()
  }, [])
  
  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  
  if (!isOpen) return null
  
  return (
    <div className="fixture-forge-overlay">
      <div className="fixture-forge-window">
        
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* HEADER */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <header className="forge-header">
          <div className="forge-title">
            <Factory size={24} />
            <h1>FIXTURE FORGE</h1>
            <span className="forge-subtitle">La Herrería</span>
          </div>
          
          <div className="forge-metadata">
            <div className="forge-input-group">
              <label>Fabricante</label>
              <input
                type="text"
                placeholder="ADJ, Chauvet..."
                value={fixture.manufacturer || ''}
                onChange={(e) => setFixture(prev => ({ ...prev, manufacturer: e.target.value }))}
                autoFocus
              />
            </div>
            
            <div className="forge-input-group">
              <label>Modelo *</label>
              <input
                type="text"
                placeholder="Vizi Beam 5RX"
                value={fixture.name || ''}
                onChange={(e) => setFixture(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="forge-input-group small">
              <label>Canales</label>
              <input
                type="number"
                min={1}
                max={64}
                value={totalChannels}
                onChange={(e) => setTotalChannels(Math.max(1, Math.min(64, parseInt(e.target.value) || 1)))}
              />
            </div>
            
            <div className="forge-input-group">
              <label>Tipo</label>
              <select
                value={getTypeDisplayValue(fixture.type)}
                onChange={(e) => setFixture(prev => ({ ...prev, type: e.target.value }))}
              >
                {FIXTURE_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            {/* � WAVE 1002: Color Engine Selector */}
            <div className="forge-input-group color-engine-group">
              <label>
                <Palette size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                Color Engine
              </label>
              <select
                value={colorEngine}
                onChange={(e) => {
                  const newEngine = e.target.value as ColorEngineType
                  console.log('[FixtureForge] 🎨 Color engine changed:', newEngine)
                  setColorEngine(newEngine)
                }}
                className="color-engine-select"
              >
                {COLOR_ENGINE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.icon} {option.label}
                  </option>
                ))}
              </select>
              <span className="color-engine-description">
                {COLOR_ENGINE_OPTIONS.find(o => o.value === colorEngine)?.description}
              </span>
            </div>
            
            {/* �🎯 WAVE 685.6: DMX Address (only shown when editing stage fixture) */}
            {editingFixture && (
              <>
                <div className="forge-input-group small">
                  <label>DMX Canal</label>
                  <input
                    type="number"
                    min={1}
                    max={512}
                    value={dmxAddress ?? 1}
                    onChange={(e) => {
                      const newValue = Math.max(1, Math.min(512, parseInt(e.target.value) || 1))
                      console.log('[FixtureForge] 📍 DMX Canal changed:', newValue, '| Current state BEFORE update:', dmxAddress)
                      setDmxAddress(newValue)
                      // Force log the state in next tick to verify update
                      setTimeout(() => {
                        console.log('[FixtureForge] 📍 DMX state AFTER setDmxAddress:', newValue, '| Actual state should be:', newValue)
                      }, 0)
                    }}
                    title="Canal DMX inicial"
                  />
                </div>
                <div className="forge-input-group small">
                  <label>Universo</label>
                  <input
                    type="number"
                    min={1}
                    max={16}
                    value={universe}
                    onChange={(e) => setUniverse(Math.max(1, Math.min(16, parseInt(e.target.value) || 1)))}
                    title="Universo DMX"
                  />
                </div>
              </>
            )}
          </div>
          
          <button className="forge-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </header>
        
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TABS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <nav className="forge-tabs">
          <button
            className={`forge-tab ${activeTab === 'channels' ? 'active' : ''}`}
            onClick={() => setActiveTab('channels')}
          >
            <Server size={16} />
            <span>Canalizador</span>
          </button>
          <button
            className={`forge-tab ${activeTab === 'physics' ? 'active' : ''}`}
            onClick={() => setActiveTab('physics')}
          >
            <Cpu size={16} />
            <span>Física</span>
          </button>
          <button
            className={`forge-tab ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            <Download size={16} />
            <span>Export/Import</span>
          </button>
        </nav>
        
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* BODY */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <main className="forge-body">
          
          {/* LEFT: Preview 3D */}
          <section className="forge-preview-section">
            <div className="preview-header">
              <h3>
                <Eye size={16} />
                Vista Previa
              </h3>
              <button
                className={`preview-toggle ${showPreview ? '' : 'off'}`}
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
            
            {showPreview ? (
              <Suspense fallback={
                <div className="preview-loading">
                  <div className="loading-spinner" />
                  <span>Cargando 3D...</span>
                </div>
              }>
                <FixturePreview3D
                  pan={previewPan}
                  tilt={previewTilt}
                  dimmer={previewDimmer}
                  color={previewColor}
                  strobeActive={previewStrobe}
                  fixtureType={fixture.type}
                  showBeam={showBeam}
                  isStressTesting={isStressTesting}
                />
              </Suspense>
            ) : (
              <div className="preview-disabled">
                <EyeOff size={32} />
                <span>Preview desactivado</span>
              </div>
            )}
            
            {/* Preview Controls */}
            <div className="preview-controls">
              <div className="control-row">
                <label>Pan</label>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={previewPan}
                  onChange={(e) => setPreviewPan(parseInt(e.target.value))}
                />
                <span>{previewPan}</span>
              </div>
              <div className="control-row">
                <label>Tilt</label>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={previewTilt}
                  onChange={(e) => setPreviewTilt(parseInt(e.target.value))}
                />
                <span>{previewTilt}</span>
              </div>
              <div className="control-row">
                <label>Dim</label>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={previewDimmer}
                  onChange={(e) => setPreviewDimmer(parseInt(e.target.value))}
                />
                <span>{Math.round(previewDimmer / 255 * 100)}%</span>
              </div>
              <div className="control-row colors">
                <label>RGB</label>
                <input
                  type="color"
                  value={`#${previewColor.r.toString(16).padStart(2, '0')}${previewColor.g.toString(16).padStart(2, '0')}${previewColor.b.toString(16).padStart(2, '0')}`}
                  onChange={(e) => {
                    const hex = e.target.value
                    setPreviewColor({
                      r: parseInt(hex.slice(1, 3), 16),
                      g: parseInt(hex.slice(3, 5), 16),
                      b: parseInt(hex.slice(5, 7), 16)
                    })
                  }}
                />
                <button
                  className={`strobe-btn ${previewStrobe ? 'active' : ''}`}
                  onClick={() => setPreviewStrobe(!previewStrobe)}
                >
                  ⚡ Strobe
                </button>
                <button
                  className={`beam-btn ${showBeam ? 'active' : ''}`}
                  onClick={() => setShowBeam(!showBeam)}
                >
                  🔦 Beam
                </button>
              </div>
            </div>
          </section>
          
          {/* CENTER: Tab Content */}
          <section className="forge-main-content">
            
            {/* CHANNELS TAB */}
            {activeTab === 'channels' && (
              <div className="channels-tab">
                <div className="rack-section">
                  <h3>
                    <Server size={18} />
                    THE RACK - Mapa de Canales
                  </h3>
                  <div className="rack-grid">
                    {fixture.channels.map((channel, index) => {
                      // WAVE 385.5: Solo está vacío si NO tiene nombre Y es unknown
                      // Canales unknown CON nombre son datos reales, no slots vacíos
                      const isEmpty = channel.type === 'unknown' && !channel.name
                      const color = getCategoryColor(channel.type)
                      const isDragOver = dragOverSlot === index
                      
                      return (
                        <div
                          key={index}
                          className={`dmx-slot ${!isEmpty ? 'active' : ''} ${isDragOver ? 'drag-over' : ''}`}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, index)}
                          style={{ '--slot-color': color } as React.CSSProperties}
                        >
                          <div className="slot-header">
                            <span className="slot-number">CH {index + 1}</span>
                            {!isEmpty && (
                              <button
                                className="slot-clear-btn"
                                onClick={() => handleClearSlot(index)}
                                title="Clear"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                          
                          <div className={`slot-dropzone ${!isEmpty ? 'has-function' : ''}`}>
                            {/* WAVE 385.5: Mostrar ? para unknown con nombre */}
                            {isEmpty ? 'DROP' : (channel.type === 'unknown' ? '?' : channel.type?.toUpperCase())}
                          </div>
                          
                          <input
                            className="slot-name-input"
                            value={channel.name || ''}
                            placeholder={isEmpty ? 'Raw name...' : 'Nombre...'}
                            disabled={false} // WAVE 386: Always editable for debugging
                            onChange={(e) => {
                              const newChannels = [...fixture.channels]
                              newChannels[index].name = e.target.value
                              setFixture(prev => ({ ...prev, channels: newChannels }))
                            }}
                          />
                          
                          {/* 🎨 WAVE 687.1: Editable default value */}
                          <div className="slot-footer">
                            <label className="slot-default-label">
                              <span className="default-label-text">DEF:</span>
                              <input
                                type="number"
                                className="slot-default-input"
                                value={channel.defaultValue ?? 0}
                                min={0}
                                max={255}
                                onChange={(e) => {
                                  const newChannels = [...fixture.channels]
                                  newChannels[index].defaultValue = Math.max(0, Math.min(255, parseInt(e.target.value) || 0))
                                  setFixture(prev => ({ ...prev, channels: newChannels }))
                                }}
                                title="Default DMX value (0-255)"
                              />
                            </label>
                            {channel.is16bit && (
                              <span className="slot-16bit">16bit</span>
                            )}
                            {/* 🎨 WAVE 1006: THE WHEELSMITH - Config button for color_wheel channels */}
                            {channel.type === 'color_wheel' && (
                              <button
                                className="slot-wheel-config-btn"
                                onClick={() => {
                                  setWheelEditorChannelIndex(index)  // 🎛️ WAVE 1006.5: Track channel for LIVE PROBE
                                  setWheelEditorOpen(true)
                                }}
                                title={`Configurar Color Wheel (${wheelColors.length} colores)`}
                              >
                                <Settings size={12} />
                                {wheelColors.length > 0 && (
                                  <span className="wheel-count">{wheelColors.length}</span>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
            
            {/* PHYSICS TAB */}
            {activeTab === 'physics' && (
              <div className="physics-tab">
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
              <div className="export-tab">
                <div className="export-section">
                  <h3>
                    <Download size={18} />
                    Exportar Definición
                  </h3>
                  <p>Genera un archivo .fxt compatible con FreeStyler y LuxSync Library.</p>
                  <button className="export-btn" onClick={handleExport}>
                    <Download size={16} />
                    Exportar .fxt
                  </button>
                </div>
                
                <div className="import-section">
                  <h3>
                    <Upload size={18} />
                    Importar Definición
                  </h3>
                  <p>Carga una definición existente (.json o .fxt)</p>
                  <button className="import-btn" onClick={handleImport}>
                    <Upload size={16} />
                    Importar Archivo
                  </button>
                </div>
                
                <div className="preview-json">
                  <h3>Vista previa JSON (Lo que se guarda)</h3>
                  <pre>
                    {/* 🔥 WAVE 390 + 1002 + 1006: Preview uses SAME function as save - SINGLE SOURCE OF TRUTH */}
                    {JSON.stringify(buildFinalFixture(fixture, physics, colorEngine, wheelColors), null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </section>
          
          {/* RIGHT: Foundry (only on channels tab) */}
          {activeTab === 'channels' && (
            <aside className="forge-foundry">
              <div className="foundry-header">
                <h3>
                  <Factory size={18} />
                  THE FOUNDRY
                </h3>
                <span className="foundry-hint">Arrastra funciones ↔</span>
              </div>
              
              <div className="foundry-categories">
                {Object.entries(FUNCTION_PALETTE).map(([category, functions]) => (
                  <div key={category} className="foundry-category">
                    <button
                      className="category-header"
                      onClick={() => setExpandedFoundry(
                        expandedFoundry === category ? null : category
                      )}
                    >
                      <span>{category}</span>
                      {expandedFoundry === category ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                    
                    {expandedFoundry === category && (
                      <div className="category-functions">
                        {functions.map((func) => (
                          <div
                            key={func.type}
                            className="function-chip"
                            draggable
                            onDragStart={(e) => handleDragStart(e, func)}
                            style={{ '--chip-color': func.color } as React.CSSProperties}
                          >
                            <span className="chip-icon">{func.icon}</span>
                            <span className="chip-label">{func.label}</span>
                            <GripVertical size={12} className="chip-grip" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </aside>
          )}
        </main>
        
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* FOOTER */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <footer className="forge-footer">
          <span className={`validation-msg ${isFormValid ? 'valid' : 'invalid'}`}>
            {validationMessage}
          </span>
          
          <div className="footer-actions">
            <button className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="btn-save"
              onClick={handleSave}
              disabled={!isFormValid}
            >
              <Save size={18} />
              Guardar Perfil
            </button>
          </div>
        </footer>
      </div>
      
      {/* 🎨 WAVE 1006 + 1006.5: THE WHEELSMITH - Color Wheel Editor Modal with LIVE PROBE */}
      <ColorWheelEditor
        isOpen={wheelEditorOpen}
        onClose={() => {
          setWheelEditorOpen(false)
          setWheelEditorChannelIndex(null)  // 🎛️ Clear channel index on close
        }}
        onSave={(colors) => {
          setWheelColors(colors)
          setWheelEditorOpen(false)
          setWheelEditorChannelIndex(null)
          console.log('[FixtureForge] 🎨 WHEELSMITH saved:', colors.length, 'colors')
        }}
        existingColors={wheelColors}
        onTestDmx={handleWheelTest}  // 🎛️ WAVE 1006.5: THE LIVE PROBE
      />
    </div>
  )
}

export default FixtureForge
