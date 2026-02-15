/**
 * ⚙️ SETUP VIEW - CYBERPUNK EDITION v2
 * WAVE 9.6.2: Fixture Store Integration
 * 
 * FIXES:
 * - Simulation: Activación INMEDIATA sin permisos
 * - System Audio: Manejo graceful de cancelación
 * - DMX Virtual: Connected inmediato
 * - Fixtures: Usa dmxStore.fixtures como fuente única de verdad
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAudioStore } from '../../../stores/audioStore'
import { useDMXStore } from '../../../stores/dmxStore'
import { useSeleneStore } from '../../../stores/seleneStore'
import { useNavigationStore } from '../../../stores/navigationStore'
import { useTrinity } from '../../../providers/TrinityProvider'
import { useHardware } from '../../../stores/truthStore'
import './SetupView.css'

// 🚨 WAVE 14.9: FLAGS GLOBALES (sobreviven React Strict Mode)
let _hasLoadedConfig = false
let _hasScannedLibrary = false
let _hasLoadedFixtures = false

// ============================================================================
// TYPES
// ============================================================================

type SetupStep = 1 | 2 | 3 | 4
type AudioSourceType = 'none' | 'microphone' | 'system' | 'simulation'

interface FixtureLibraryItem {
  id: string
  name: string
  manufacturer: string
  channelCount: number
  type: string
  filePath: string
}

// PatchedFixture is now imported from dmxStore

// ============================================================================
// DMX DRIVERS
// ============================================================================

const DMX_DRIVERS = [
  { id: 'virtual', label: '🎮 Virtual (Demo)', description: 'Sin hardware - perfecto para testing' },
  { id: 'enttec-open', label: '🔌 Enttec Open DMX', description: 'USB DMX barato y funcional' },
  { id: 'enttec-pro', label: '⚡ Enttec DMX USB Pro', description: 'Interfaz profesional con feedback' },
  { id: 'artnet', label: '🌐 Art-Net', description: 'DMX sobre red Ethernet' },
]

// ============================================================================
// FIXTURE TYPE ICONS
// ============================================================================

const getFixtureTypeIcon = (name: string, type: string): { icon: string; className: string } => {
  const nameLower = name.toLowerCase()
  const typeLower = type.toLowerCase()
  
  if (nameLower.includes('spot') || nameLower.includes('vizi') || typeLower.includes('moving')) {
    return { icon: '🎯', className: 'moving-head' }
  }
  if (nameLower.includes('wash') || nameLower.includes('quantum')) {
    return { icon: '💧', className: 'wash' }
  }
  if (nameLower.includes('par') || nameLower.includes('flat')) {
    return { icon: '💡', className: 'par' }
  }
  if (nameLower.includes('strobe') || nameLower.includes('flash')) {
    return { icon: '⚡', className: 'strobe' }
  }
  if (nameLower.includes('laser')) {
    return { icon: '🔴', className: 'laser' }
  }
  if (nameLower.includes('beam')) {
    return { icon: '🔦', className: 'beam' }
  }
  
  return { icon: '💡', className: 'par' }
}

// ============================================================================
// COMPONENT
// ============================================================================

const SetupView: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<SetupStep>(1)
  
  // === AUDIO STATE ===
  const [audioSource, setAudioSource] = useState<AudioSourceType>('none')
  const [audioLevel, setAudioLevel] = useState(0)
  const [sensitivity, setSensitivity] = useState(50)
  const [isConnectingAudio, setIsConnectingAudio] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  
  // === DMX STATE ===
  const [selectedDMXDriver, setSelectedDMXDriver] = useState('virtual')
  const [dmxConnected, setDmxConnected] = useState(false)
  
  // === FIXTURE STATE ===
  const [fixtureLibrary, setFixtureLibrary] = useState<FixtureLibraryItem[]>([])
  // patchedFixtures now comes from dmxStore
  const [isScanning, setIsScanning] = useState(false)
  const [selectedLibraryFixture, setSelectedLibraryFixture] = useState<string | null>(null)
  const [nextDmxAddress, setNextDmxAddress] = useState(1)
  const [librarySearchTerm, setLibrarySearchTerm] = useState('')
  
  // 🔦 WAVE 11: Highlight Mode
  const [highlightIndex, setHighlightIndex] = useState<number>(-1) // -1 = ninguno
  const [isHighlighting, setIsHighlighting] = useState(false)
  
  // 🌪️ WAVE 11: DMX Watchdog Status
  const [dmxStatus, setDmxStatus] = useState<'disconnected' | 'connected' | 'reconnecting' | 'error'>('disconnected')
  const [dmxDevice, setDmxDevice] = useState<any>(null)
  
  // 🎯 WAVE 12.5: Installation Type Selector (ceiling = colgados, floor = de pie)
  const [installationType, setInstallationType] = useState<'ceiling' | 'floor'>('ceiling')
  
  // Stores
  const { bpm, bpmConfidence } = useAudioStore()
  const { 
    fixtures: patchedFixtures, 
    addFixture, 
    removeFixtureByAddress, 
    updateFixtureByAddress,  // WAVE 10.5
    clearFixtures,
    setFixtures: setPatchedFixtures,
    connect: dmxConnect,
    disconnect: dmxDisconnect
  } = useDMXStore()
  const { setActiveTab } = useNavigationStore()
  useSeleneStore()
  
  // 🌙 WAVE 25: Hardware State from Truth (real-time fixture colors/state)
  const hardwareState = useHardware() // 🛡️ WAVE 2042.12: React 19 stable hook
  
  // Create a map of dmxAddress → live fixture state for quick lookup
  const liveFixtureMap = useMemo(() => {
    const map = new Map<number, typeof hardwareState.fixtures[0]>()
    for (const fix of hardwareState.fixtures) {
      map.set(fix.dmxAddress, fix)
    }
    return map
  }, [hardwareState.fixtures])
  
  // Trinity provider
  const trinity = useTrinity()

  // 🚨 WAVE 14.9: Los flags ahora son GLOBALES (fuera del componente, sobreviven StrictMode)

  // === LOAD CONFIG ON MOUNT ===
  useEffect(() => {
    if (_hasLoadedConfig) return // 🛑 PREVENIR BUCLE (flag global)
    _hasLoadedConfig = true
    
    const loadConfig = async () => {
      if (!window.lux) return
      try {
        const result = await window.lux.getConfig()
        if (result.success && result.config) {
          const savedSource = result.config.audio?.source
          if (savedSource) {
            setAudioSource(savedSource as AudioSourceType)
            if (savedSource === 'simulation') {
              trinity.setSimulating(true)
            }
          }
          setSensitivity(result.config.audio?.sensitivity || 50)
          setSelectedDMXDriver(result.config.dmx?.driver || 'virtual')
          
          // 🎯 WAVE 12.5: Load saved installation type
          const savedInstallation = (result.config as any).installationType
          if (savedInstallation === 'ceiling' || savedInstallation === 'floor') {
            setInstallationType(savedInstallation)
            console.log(`[SetupView] 🎯 Loaded installation type: ${savedInstallation}`)
          }
        }
      } catch (err) {
        console.error('[SetupView] Error loading config:', err)
      }
    }
    loadConfig()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  // === SCAN FIXTURES ON MOUNT ===
  useEffect(() => {
    if (_hasScannedLibrary) return // 🛑 PREVENIR BUCLE (flag global)
    _hasScannedLibrary = true
    
    // Pequeño delay para evitar race conditions
    const timer = setTimeout(() => {
      scanFixtures()
    }, 100)
    
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  // === LOAD PATCHED FIXTURES ===
  useEffect(() => {
    if (_hasLoadedFixtures) return // 🛑 PREVENIR BUCLE (flag global)
    _hasLoadedFixtures = true
    
    const loadPatched = async () => {
      if (!window.lux) return
      try {
        const result = await window.lux.getPatchedFixtures()
        if (result.success) {
          setPatchedFixtures(result.fixtures)
        }
      } catch (err) {
        console.error('[SetupView] Error loading patched fixtures:', err)
      }
    }
    loadPatched()
  }, [])

  // === AUDIO LEVEL ANIMATION ===
  useEffect(() => {
    if (trinity.state.isAudioActive && trinity.audioMetrics) {
      setAudioLevel(trinity.audioMetrics.energy)
    } else if (audioSource === 'simulation') {
      // Simulación: Generar ondas sin pedir permisos
      const interval = setInterval(() => {
        const t = Date.now() / 1000
        const bass = 0.5 + 0.3 * Math.sin(t * 2.5)
        const mid = 0.4 + 0.2 * Math.sin(t * 4)
        const treble = 0.3 + 0.15 * Math.sin(t * 8)
        setAudioLevel(bass * 0.5 + mid * 0.3 + treble * 0.2)
      }, 50)
      return () => clearInterval(interval)
    }
  }, [trinity.state.isAudioActive, trinity.audioMetrics, audioSource])

  // === DMX: AUTO-CONNECT VIRTUAL ===
  useEffect(() => {
    if (selectedDMXDriver === 'virtual' && !dmxConnected) {
      // Virtual mode = SIEMPRE conectado (solo una vez)
      setDmxConnected(true)
      setDmxStatus('connected')
      dmxConnect('virtual', 'VIRTUAL')
    }
  }, [selectedDMXDriver]) // eslint-disable-line react-hooks/exhaustive-deps

  // 🌪️ WAVE 11: DMX Watchdog Status Listener
  useEffect(() => {
    if (!window.luxsync?.dmx?.onStatus) return
    
    const unsubscribe = window.luxsync.dmx.onStatus((status) => {
      console.log('[SetupView] 🌪️ DMX Status:', status)
      setDmxStatus(status.state as any)
      if (status.device) {
        setDmxDevice(status.device)
      }
      // Actualizar dmxConnected basado en el status
      if (status.state === 'connected') {
        setDmxConnected(true)
      } else if (status.state === 'disconnected' || status.state === 'error') {
        setDmxConnected(false)
      }
    })
    
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  // ============================================================================
  // AUDIO HANDLERS - WAVE 9.6.4: Use Trinity methods!
  // ============================================================================
  
  const connectAudio = useCallback(async (source: 'microphone' | 'system' | 'simulation') => {
    console.log('[SetupView] 🔊 connectAudio called with:', source)
    setAudioError(null)
    
    // ========================================
    // SIMULATION: Activación INMEDIATA
    // ========================================
    if (source === 'simulation') {
      console.log('[SetupView] 🎵 SIMULATION - Instant activation, NO permissions')
      trinity.setSimulating(true)
      setAudioSource('simulation')
      console.log('[SetupView] ✅ Simulation activated!')
      
      if (window.lux) {
        await window.lux.saveConfig({ audio: { source, sensitivity } })
      }
      return // Salir inmediato - no loading
    }
    
    // ========================================
    // SYSTEM / MICROPHONE: Use Trinity's audio capture!
    // ========================================
    setIsConnectingAudio(true)
    
    try {
      if (source === 'system') {
        console.log('[SetupView] 🖥️ Starting system audio via Trinity...')
        await trinity.startSystemAudio()
        trinity.setSimulating(false)
        setAudioSource('system')
        console.log('[SetupView] ✅ System audio CONNECTED via Trinity!')
        
      } else if (source === 'microphone') {
        console.log('[SetupView] 🎤 Starting microphone via Trinity...')
        await trinity.startMicrophone()
        trinity.setSimulating(false)
        setAudioSource('microphone')
        console.log('[SetupView] ✅ Microphone CONNECTED via Trinity!')
      }
      
      if (window.lux) {
        await window.lux.saveConfig({ audio: { source, sensitivity } })
      }
      
    } catch (err) {
      // Usuario canceló o denegó
      console.warn('[SetupView] Audio cancelled/denied:', err)
      // Fallback silencioso a simulation
      trinity.setSimulating(true)
      setAudioSource('simulation')
      setAudioError('Permiso cancelado. Usando simulación.')
    } finally {
      setIsConnectingAudio(false)
    }
  }, [sensitivity, trinity])

  // ============================================================================
  // DMX HANDLERS
  // ============================================================================
  
  const selectDMXDriver = useCallback((driverId: string) => {
    setSelectedDMXDriver(driverId)
    
    if (driverId === 'virtual') {
      // Virtual = Connected inmediato
      setDmxConnected(true)
      dmxConnect('virtual', 'VIRTUAL')
      console.log('[SetupView] 🎮 Virtual DMX - CONNECTED')
    } else {
      // Hardware real - requiere detección
      setDmxConnected(false)
      dmxDisconnect()
    }
    
    if (window.lux) {
      window.lux.saveConfig({ dmx: { driver: driverId, port: 'AUTO', universe: 1, frameRate: 40 } })
    }
  }, [dmxConnect, dmxDisconnect])

  // ============================================================================
  // FIXTURE HANDLERS
  // ============================================================================
  
  const scanFixtures = useCallback(async () => {
    if (!window.lux) return
    
    setIsScanning(true)
    try {
      const result = await window.lux.scanFixtures()
      if (result.success) {
        // DEBUG: Log fixture IDs
        console.log('[SetupView] 📦 Fixture IDs:', result.fixtures.map(f => f.id))
        setFixtureLibrary(result.fixtures)
        console.log(`[SetupView] 📦 Found ${result.fixtures.length} fixtures`)
      }
    } catch (err) {
      console.error('[SetupView] Scan error:', err)
    } finally {
      setIsScanning(false)
    }
  }, [])

  const patchFixture = useCallback(async (fixtureId: string) => {
    if (!window.lux) return
    
    try {
      const result = await window.lux.patchFixture(fixtureId, nextDmxAddress)
      if (result.success && result.fixture) {
        // Add to dmxStore - this is the single source of truth
        addFixture(result.fixture)
        const fixture = fixtureLibrary.find(f => f.id === fixtureId)
        if (fixture) {
          setNextDmxAddress(prev => prev + fixture.channelCount)
        }
        setSelectedLibraryFixture(null)
      }
    } catch (err) {
      console.error('[SetupView] Patch error:', err)
    }
  }, [nextDmxAddress, fixtureLibrary, addFixture])

  const unpatchFixture = useCallback(async (dmxAddress: number) => {
    if (!window.lux) return
    
    try {
      const result = await window.lux.unpatchFixture(dmxAddress)
      if (result.success) {
        // Remove from dmxStore - this is the single source of truth
        removeFixtureByAddress(dmxAddress)
      }
    } catch (err) {
      console.error('[SetupView] Unpatch error:', err)
    }
  }, [removeFixtureByAddress])

  // 🔬 WAVE 10.5: Forzar tipo de fixture manualmente
  const forceFixtureType = useCallback(async (dmxAddress: number, newType: string) => {
    if (!window.lux) return
    
    try {
      // Actualizar en el backend
      const result = await window.lux.forceFixtureType(dmxAddress, newType)
      if (result.success) {
        // Actualizar en el store local usando la nueva función
        updateFixtureByAddress(dmxAddress, { type: newType })
        console.log(`[SetupView] 🔧 Forced fixture @${dmxAddress} to type: ${newType}`)
      }
    } catch (err) {
      console.error('[SetupView] Force type error:', err)
    }
  }, [updateFixtureByAddress])

  // 🎯 WAVE 12.5: Selector de Montaje - Aplica preset físico a Moving Heads
  const applyInstallationType = useCallback(async (type: 'ceiling' | 'floor') => {
    setInstallationType(type)
    console.log(`[SetupView] 🎯 Installation type set to: ${type === 'ceiling' ? 'COLGADOS (Techo)' : 'DE PIE (Suelo)'}`)
    
    if (window.lux?.setInstallationType) {
      try {
        const result = await window.lux.setInstallationType(type)
        console.log('[SetupView] 🎯 Installation type applied:', result)
      } catch (err) {
        console.error('[SetupView] Installation type error:', err)
      }
    }
  }, [])

  const clearAllPatch = useCallback(async () => {
    if (!window.lux) return
    if (!confirm('¿Eliminar todos los fixtures?')) return
    
    try {
      const result = await window.lux.clearPatch()
      if (result.success) {
        // Clear from dmxStore - this is the single source of truth
        clearFixtures()
        setNextDmxAddress(1)
      }
    } catch (err) {
      console.error('[SetupView] Clear error:', err)
    }
  }, [clearFixtures])

  // 🎭 WAVE 10.6: NEW SHOW - Reset completo
  const newShow = useCallback(async () => {
    if (!window.lux) return
    if (!confirm('⚠️ NEW SHOW: ¿Borrar TODA la configuración y empezar de cero?')) return
    
    try {
      const result = await window.lux.newShow()
      if (result.success) {
        // Reset local state
        clearFixtures()
        setNextDmxAddress(1)
        setAudioSource('none')
        setCurrentStep(1)
        setDmxConnected(false)
        console.log(`[SetupView] 🎭 NEW SHOW - Cleared ${result.clearedFixtures} fixtures`)
      }
    } catch (err) {
      console.error('[SetupView] New show error:', err)
    }
  }, [clearFixtures])

  // 💾 WAVE 10.6: SAVE SHOW - Exportar configuración a JSON
  const saveShow = useCallback(async () => {
    try {
      const showData = {
        version: '1.0',
        savedAt: new Date().toISOString(),
        audio: {
          source: audioSource,
          sensitivity
        },
        dmx: {
          driver: selectedDMXDriver,
          connected: dmxConnected
        },
        fixtures: patchedFixtures.map(f => ({
          id: f.id,
          name: f.name,
          type: f.type,
          manufacturer: f.manufacturer,
          channelCount: f.channelCount,
          dmxAddress: f.dmxAddress,
          universe: f.universe,
          zone: f.zone,
          filePath: f.filePath
        }))
      }
      
      const blob = new Blob([JSON.stringify(showData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `luxsync-show-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      console.log('[SetupView] 💾 Show saved:', showData.fixtures.length, 'fixtures')
    } catch (err) {
      console.error('[SetupView] Save show error:', err)
      alert('Error guardando show: ' + err)
    }
  }, [audioSource, sensitivity, selectedDMXDriver, dmxConnected, patchedFixtures])

  // 📂 WAVE 10.6: LOAD SHOW - Importar configuración desde JSON
  const loadShow = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      
      try {
        const text = await file.text()
        const showData = JSON.parse(text)
        
        // Validar versión
        if (!showData.version || !showData.fixtures) {
          alert('Archivo de show inválido')
          return
        }
        
        // Confirmar carga
        if (!confirm(`¿Cargar show con ${showData.fixtures.length} fixtures? (${showData.savedAt})`)) {
          return
        }
        
        // Limpiar primero
        await window.lux?.clearPatch()
        clearFixtures()
        
        // Restaurar fixtures
        for (const fixture of showData.fixtures) {
          try {
            await window.lux?.patchFixture(fixture.id, fixture.dmxAddress, fixture.universe)
          } catch (err) {
            console.warn('[SetupView] Could not patch fixture:', fixture.name, err)
          }
        }
        
        // Restaurar audio config
        if (showData.audio?.source) {
          setAudioSource(showData.audio.source)
        }
        if (showData.audio?.sensitivity) {
          setSensitivity(showData.audio.sensitivity)
        }
        
        // Recargar fixtures del backend
        const result = await window.lux?.getPatchedFixtures()
        if (result?.success) {
          setPatchedFixtures(result.fixtures)
        }
        
        console.log('[SetupView] 📂 Show loaded:', showData.fixtures.length, 'fixtures')
        alert(`✅ Show cargado: ${showData.fixtures.length} fixtures`)
        
      } catch (err) {
        console.error('[SetupView] Load show error:', err)
        alert('Error cargando show: ' + err)
      }
    }
    input.click()
  }, [clearFixtures, setPatchedFixtures])

  // ============================================================================
  // 🔦 WAVE 11: HIGHLIGHT MODE HANDLERS
  // ============================================================================
  
  const highlightCurrentFixture = useCallback(async () => {
    if (patchedFixtures.length === 0 || highlightIndex < 0) return
    
    const fixture = patchedFixtures[highlightIndex]
    if (!fixture) return
    
    setIsHighlighting(true)
    
    try {
      // Detectar si es moving head por el tipo o por el número de canales
      const isMovingHead = fixture.type?.toLowerCase().includes('moving') || 
                          fixture.name?.toLowerCase().includes('spot') ||
                          fixture.name?.toLowerCase().includes('beam') ||
                          fixture.channelCount >= 8
      
      await window.luxsync?.dmx?.highlightFixture(
        fixture.dmxAddress, 
        fixture.channelCount, 
        isMovingHead
      )
      console.log(`[SetupView] 🔦 Highlighting: ${fixture.name} @ DMX ${fixture.dmxAddress}`)
    } catch (err) {
      console.error('[SetupView] Highlight error:', err)
    } finally {
      setTimeout(() => setIsHighlighting(false), 300)
    }
  }, [patchedFixtures, highlightIndex])
  
  const highlightPrev = useCallback(() => {
    if (patchedFixtures.length === 0) return
    setHighlightIndex(prev => {
      const newIndex = prev <= 0 ? patchedFixtures.length - 1 : prev - 1
      return newIndex
    })
  }, [patchedFixtures.length])
  
  const highlightNext = useCallback(() => {
    if (patchedFixtures.length === 0) return
    setHighlightIndex(prev => {
      const newIndex = prev >= patchedFixtures.length - 1 ? 0 : prev + 1
      return newIndex
    })
  }, [patchedFixtures.length])
  
  // Auto-highlight when index changes
  useEffect(() => {
    if (highlightIndex >= 0 && patchedFixtures.length > 0) {
      highlightCurrentFixture()
    }
  }, [highlightIndex]) // eslint-disable-line react-hooks/exhaustive-deps
  
  // Stop highlight (blackout)
  const stopHighlight = useCallback(async () => {
    setHighlightIndex(-1)
    try {
      await window.luxsync?.dmx?.blackout()
      console.log('[SetupView] 🌑 Highlight stopped (blackout)')
    } catch (err) {
      console.error('[SetupView] Blackout error:', err)
    }
  }, [])

  // ============================================================================
  // COMPUTED
  // ============================================================================
  
  const filteredLibrary = fixtureLibrary.filter(f => 
    f.name.toLowerCase().includes(librarySearchTerm.toLowerCase()) ||
    f.manufacturer.toLowerCase().includes(librarySearchTerm.toLowerCase())
  )

  const steps = [
    { step: 1, label: 'AUDIO', icon: '🎤' },
    { step: 2, label: 'DMX', icon: '💡' },
    { step: 3, label: 'FIXTURES', icon: '🔦' },
    { step: 4, label: 'TEST', icon: '✓' },
  ]

  // 🔒 WAVE 10.6: Solo permite avanzar si el paso actual está completo
  const nextStep = () => {
    if (isStepComplete(currentStep)) {
      setCurrentStep(prev => Math.min(4, prev + 1) as SetupStep)
    }
  }
  const prevStep = () => setCurrentStep(prev => Math.max(1, prev - 1) as SetupStep)

  // 🔒 WAVE 10.6: Solo permite ir a pasos anteriores o al actual
  const canGoToStep = (step: number): boolean => {
    // Siempre puede ir a pasos anteriores
    if (step < currentStep) return true
    // Puede ir al paso actual
    if (step === currentStep) return true
    // Solo puede avanzar si el paso anterior está completo
    if (step === currentStep + 1 && isStepComplete(currentStep)) return true
    return false
  }

  const isStepComplete = (step: number): boolean => {
    switch(step) {
      case 1: return audioSource !== 'none'
      case 2: return dmxConnected
      case 3: return patchedFixtures.length > 0
      case 4: return audioSource !== 'none' && patchedFixtures.length > 0
      default: return false
    }
  }

  const totalChannelsUsed = patchedFixtures.reduce((sum, f) => sum + f.channelCount, 0)

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="setup-view">
      {/* Header */}
      <header className="setup-header">
        <div className="setup-title">
          <h2>⚙️ SETUP</h2>
          <span className={`setup-badge ${isStepComplete(4) ? 'complete' : ''}`}>
            {isStepComplete(4) ? '✓ READY' : `STEP ${currentStep}/4`}
          </span>
        </div>
      </header>

      {/* Progress Stepper - 🔒 WAVE 10.6: Bloqueado */}
      <nav className="setup-stepper">
        {steps.map(({ step, label, icon }, index) => (
          <React.Fragment key={step}>
            <div 
              className={`stepper-step ${step <= currentStep ? 'active' : ''} ${step === currentStep ? 'current' : ''} ${isStepComplete(step) ? 'complete' : ''} ${!canGoToStep(step) ? 'locked' : ''}`}
              onClick={() => canGoToStep(step) && setCurrentStep(step as SetupStep)}
            >
              <span className="stepper-icon">{isStepComplete(step) ? '✓' : !canGoToStep(step) ? '🔒' : icon}</span>
              <span className="stepper-label">{label}</span>
            </div>
            {index < steps.length - 1 && (
              <div className={`stepper-connector ${step < currentStep ? 'filled' : ''}`} />
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Wizard */}
      <div className="setup-wizard">
        <div className="wizard-content">
          
          {/* ========== STEP 1: AUDIO ========== */}
          {currentStep === 1 && (
            <div className="wizard-step">
              <h3><span className="step-emoji">🎤</span> AUDIO INPUT SETUP</h3>
              
              {audioError && (
                <div className="error-banner warning">
                  <span>⚠️</span> {audioError}
                </div>
              )}
              
              <div className="audio-sources">
                {/* Simulation - PRIMERA OPCIÓN */}
                <button 
                  className={`source-card simulation ${audioSource === 'simulation' ? 'active' : ''}`}
                  onClick={() => connectAudio('simulation')}
                  disabled={isConnectingAudio}
                >
                  <div className="source-icon-wrapper">🎵</div>
                  <span className="source-name">Simulation</span>
                  <span className="source-desc">Demo mode - Sin permisos necesarios</span>
                  {audioSource === 'simulation' && <span className="source-check">✓</span>}
                </button>
                
                {/* System Audio */}
                <button 
                  className={`source-card system ${audioSource === 'system' ? 'active' : ''}`}
                  onClick={() => connectAudio('system')}
                  disabled={isConnectingAudio}
                >
                  <div className="source-icon-wrapper">🖥️</div>
                  <span className="source-name">System Audio</span>
                  <span className="source-desc">Spotify, YouTube, etc.</span>
                  {audioSource === 'system' && <span className="source-check">✓</span>}
                </button>
                
                {/* Microphone */}
                <button 
                  className={`source-card microphone ${audioSource === 'microphone' ? 'active' : ''}`}
                  onClick={() => connectAudio('microphone')}
                  disabled={isConnectingAudio}
                >
                  <div className="source-icon-wrapper">🎤</div>
                  <span className="source-name">Microphone</span>
                  <span className="source-desc">Entrada de línea externa</span>
                  {audioSource === 'microphone' && <span className="source-check">✓</span>}
                </button>
              </div>
              
              {isConnectingAudio && (
                <div className="connecting-status">Conectando...</div>
              )}
              
              {/* VU Meter */}
              <div className="audio-visualizer">
                <div className="visualizer-label">AUDIO LEVEL</div>
                <div className="vu-meter">
                  <div className="vu-bar" style={{ width: `${Math.min(100, audioLevel * 100)}%` }} />
                </div>
              </div>
              
              {/* Sensitivity */}
              <div className="sensitivity-row">
                <span className="sensitivity-label">Sensitivity:</span>
                <input 
                  type="range" 
                  className="sensitivity-slider"
                  min="0" max="100" 
                  value={sensitivity}
                  onChange={(e) => setSensitivity(parseInt(e.target.value))}
                />
                <span className="sensitivity-value">
                  {sensitivity < 33 ? 'LOW' : sensitivity < 66 ? 'MEDIUM' : 'HIGH'}
                </span>
              </div>
              
              {/* BPM - 🚑 RESCUE DIRECTIVE: Show REAL BPM, no mocks */}
              <div className="bpm-display">
                <span className="bpm-value">
                  {trinity.audioMetrics?.bpm ?? bpm ?? 0 > 0 
                    ? (trinity.audioMetrics?.bpm ?? bpm ?? 0).toFixed(0) 
                    : '--'}
                </span>
                <span className="bpm-label">BPM ♪</span>
                <span 
                  className="bpm-confidence" 
                  style={{ 
                    color: (bpmConfidence ?? 0) > 0.7 ? '#4ADE80' : (bpmConfidence ?? 0) > 0.4 ? '#FBBF24' : '#EF4444' 
                  }}
                >
                  Confidence: {((bpmConfidence ?? 0) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}

          {/* ========== STEP 2: DMX - WAVE 10.6 UX IMPROVEMENTS ========== */}
          {currentStep === 2 && (
            <div className="wizard-step">
              <h3><span className="step-emoji">💡</span> DMX INTERFACE</h3>
              
              {/* 🔌 WAVE 10.6: Siempre mostrar Tornado/Enttec con estado */}
              <div className="dmx-interfaces-v2">
                {/* Tornado USB - Siempre visible */}
                <div 
                  className={`dmx-card-v2 ${selectedDMXDriver === 'enttec-open' ? 'selected' : ''}`}
                  onClick={() => selectDMXDriver('enttec-open')}
                >
                  <div className="dmx-card-header">
                    <span className={`status-indicator ${dmxConnected && selectedDMXDriver === 'enttec-open' ? 'connected' : 'disconnected'}`}>
                      {dmxConnected && selectedDMXDriver === 'enttec-open' ? '🟢' : '🔴'}
                    </span>
                    <span className="dmx-card-title">🔌 Tornado / Enttec USB</span>
                  </div>
                  <p className="dmx-card-desc">Interface DMX profesional por USB</p>
                  <div className="dmx-card-actions">
                    {dmxConnected && selectedDMXDriver === 'enttec-open' ? (
                      <span className="dmx-status-text">✓ Conectado</span>
                    ) : (
                      <button className="rescan-btn" onClick={(e) => { e.stopPropagation(); selectDMXDriver('enttec-open'); }}>
                        🔄 Conectar
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Virtual - Para testing */}
                <div 
                  className={`dmx-card-v2 ${selectedDMXDriver === 'virtual' ? 'selected' : ''}`}
                  onClick={() => selectDMXDriver('virtual')}
                >
                  <div className="dmx-card-header">
                    <span className={`status-indicator ${dmxConnected && selectedDMXDriver === 'virtual' ? 'connected' : 'disconnected'}`}>
                      {dmxConnected && selectedDMXDriver === 'virtual' ? '🟢' : '⚪'}
                    </span>
                    <span className="dmx-card-title">🎮 Virtual (Demo)</span>
                  </div>
                  <p className="dmx-card-desc">Sin hardware - perfecto para testing</p>
                  <div className="dmx-card-actions">
                    {dmxConnected && selectedDMXDriver === 'virtual' ? (
                      <span className="dmx-status-text">✓ Simulación activa</span>
                    ) : (
                      <button className="rescan-btn" onClick={(e) => { e.stopPropagation(); selectDMXDriver('virtual'); }}>
                        ▶️ Activar
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Status Footer */}
              <div className={`dmx-status-bar ${dmxConnected ? 'connected' : ''}`}>
                <span className="status-dot" />
                <span>{dmxConnected ? `DMX ACTIVO: ${selectedDMXDriver?.toUpperCase()}` : 'Selecciona una interface DMX'}</span>
              </div>
            </div>
          )}

          {/* ========== STEP 3: FIXTURES - 2 COLUMN LAYOUT ========== */}
          {currentStep === 3 && (
            <div className="wizard-step fixture-section">
              <h3><span className="step-emoji">🔦</span> FIXTURE PATCH</h3>
              
              {/* 🎯 WAVE 12.5: Installation Type Selector */}
              <div className="installation-selector">
                <span className="installation-label">📐 MONTAJE DE MOVING HEADS:</span>
                <div className="installation-buttons">
                  <button 
                    className={`installation-btn ${installationType === 'ceiling' ? 'active' : ''}`}
                    onClick={() => applyInstallationType('ceiling')}
                    title="Fixtures colgados del techo - Tilt invertido"
                  >
                    <span className="installation-icon">⬇️</span>
                    <span className="installation-text">COLGADOS</span>
                    <span className="installation-sub">(Techo)</span>
                  </button>
                  <button 
                    className={`installation-btn ${installationType === 'floor' ? 'active' : ''}`}
                    onClick={() => applyInstallationType('floor')}
                    title="Fixtures en el suelo - Tilt normal"
                  >
                    <span className="installation-icon">⬆️</span>
                    <span className="installation-text">DE PIE</span>
                    <span className="installation-sub">(Suelo)</span>
                  </button>
                </div>
              </div>
              
              {/* 2-COLUMN GRID LAYOUT */}
              <div className="fixture-grid">
                {/* LEFT: Library */}
                <div className="fixture-column library-column">
                  <div className="column-header">
                    <span className="column-title">📦 LIBRARY</span>
                    <button className="scan-btn-mini" onClick={scanFixtures} disabled={isScanning}>
                      {isScanning ? '⏳' : '🔄'}
                    </button>
                  </div>
                  
                  <input 
                    type="text"
                    className="search-input"
                    placeholder="🔍 Buscar..."
                    value={librarySearchTerm}
                    onChange={(e) => setLibrarySearchTerm(e.target.value)}
                  />
                  
                  <div className="fixture-list">
                    {filteredLibrary.length === 0 ? (
                      <div className="empty-state-mini">
                        {isScanning ? '⏳ Escaneando...' : '📦 Sin fixtures'}
                      </div>
                    ) : (
                      filteredLibrary.map(fixture => {
                        const { icon, className } = getFixtureTypeIcon(fixture.name, fixture.type)
                        return (
                          <div 
                            key={fixture.id}
                            className={`fixture-card-mini ${selectedLibraryFixture === fixture.id ? 'selected' : ''}`}
                            onClick={() => setSelectedLibraryFixture(fixture.id)}
                          >
                            <div className={`fixture-icon ${className}`}>{icon}</div>
                            <div className="fixture-details">
                              <span className="fixture-name">{fixture.name}</span>
                              <span className="fixture-meta">{fixture.manufacturer} • {fixture.channelCount}ch</span>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                  
                  {/* Patch Button */}
                  {selectedLibraryFixture && (
                    <div className="patch-action">
                      <span>DMX:</span>
                      <input 
                        type="number"
                        className="dmx-input"
                        value={nextDmxAddress}
                        onChange={(e) => setNextDmxAddress(parseInt(e.target.value) || 1)}
                        min={1} max={512}
                      />
                      <button className="patch-btn" onClick={() => patchFixture(selectedLibraryFixture)}>
                        ➕ PATCH
                      </button>
                    </div>
                  )}
                </div>
                
                {/* RIGHT: Patched */}
                <div className="fixture-column patch-column">
                  <div className="column-header">
                    <span className="column-title">📋 PATCHED</span>
                    <span className="patch-stats">{patchedFixtures.length} • {totalChannelsUsed}/512ch</span>
                  </div>
                  
                  {patchedFixtures.length > 0 && (
                    <button className="clear-all-btn" onClick={clearAllPatch}>🗑️ Clear</button>
                  )}
                  
                  <div className="fixture-list">
                    {patchedFixtures.length === 0 ? (
                      <div className="empty-state-mini">
                        📋 Sin fixtures patcheados
                      </div>
                    ) : (
                      patchedFixtures.map(fixture => {
                        const { icon, className } = getFixtureTypeIcon(fixture.name, fixture.type)
                        // 🌙 WAVE 25: Get live state from Truth
                        const liveState = liveFixtureMap.get(fixture.dmxAddress)
                        const liveColor = liveState?.color || { r: 0, g: 0, b: 0, h: 0, s: 0, l: 0, hex: '#000000' }
                        const liveIntensity = liveState?.intensity ?? 0
                        
                        return (
                          <div key={`${fixture.id}_${fixture.dmxAddress}`} className="patched-card">
                            {/* 🌙 WAVE 25: Live color indicator */}
                            <div 
                              className="live-color-dot"
                              style={{
                                backgroundColor: `rgb(${liveColor.r}, ${liveColor.g}, ${liveColor.b})`,
                                opacity: liveIntensity / 100,
                                boxShadow: liveIntensity > 50 
                                  ? `0 0 8px 2px rgba(${liveColor.r}, ${liveColor.g}, ${liveColor.b}, 0.6)`
                                  : 'none'
                              }}
                              title={`Live: RGB(${liveColor.r}, ${liveColor.g}, ${liveColor.b}) @ ${liveIntensity.toFixed(0)}%`}
                            />
                            <span className="patched-addr">{fixture.dmxAddress}</span>
                            <div className={`fixture-icon ${className}`}>{icon}</div>
                            <div className="fixture-details">
                              <span className="fixture-name">{fixture.name}</span>
                              <span className="fixture-meta">{fixture.channelCount}ch • {fixture.zone || 'no-zone'}</span>
                            </div>
                            {/* WAVE 10.5: Type Override Selector */}
                            <select 
                              className="type-selector"
                              value={fixture.type}
                              onChange={(e) => forceFixtureType(fixture.dmxAddress, e.target.value)}
                              title="Cambiar tipo de fixture"
                            >
                              <option value="par">💡 PAR</option>
                              <option value="moving_head">🎯 Moving Head</option>
                              <option value="wash">🌊 Wash</option>
                              <option value="strobe">⚡ Strobe</option>
                              <option value="laser">🔴 Laser</option>
                              <option value="generic">⚙️ Generic</option>
                            </select>
                            <button className="remove-btn" onClick={() => unpatchFixture(fixture.dmxAddress)}>✕</button>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========== STEP 4: TEST ========== */}
          {currentStep === 4 && (
            <div className="wizard-step">
              <h3><span className="step-emoji">✓</span> SYSTEM TEST</h3>
              
              {/* 🌪️ WAVE 11: DMX Watchdog Status Banner */}
              <div className={`dmx-watchdog-banner ${dmxStatus}`}>
                <div className="watchdog-indicator">
                  <span className={`watchdog-dot ${dmxStatus}`} />
                  <span className="watchdog-text">
                    {dmxStatus === 'connected' && (
                      <>🟢 DMX CONNECTED {dmxDevice?.friendlyName && `- ${dmxDevice.friendlyName}`}</>
                    )}
                    {dmxStatus === 'disconnected' && (
                      <>🔴 NO SIGNAL - Check USB cable</>
                    )}
                    {dmxStatus === 'reconnecting' && (
                      <>🟡 SEARCHING USB... Reconnecting</>
                    )}
                    {dmxStatus === 'error' && (
                      <>❌ DMX ERROR - Replug device</>
                    )}
                  </span>
                </div>
                {dmxStatus === 'disconnected' && selectedDMXDriver !== 'virtual' && (
                  <button 
                    className="reconnect-btn"
                    onClick={async () => {
                      const result = await window.luxsync?.dmx?.autoConnect()
                      if (result?.success) {
                        setDmxConnected(true)
                        setDmxStatus('connected')
                      }
                    }}
                  >
                    🔄 RECONECTAR
                  </button>
                )}
              </div>
              
              <div className="test-results">
                <div className={`test-item ${audioSource !== 'none' ? 'pass' : 'fail'}`}>
                  <span className="test-icon">{audioSource !== 'none' ? '✓' : '✗'}</span>
                  <span className="test-name">Audio Input</span>
                  <span className="test-status">
                    {audioSource === 'system' ? '🖥️ System' :
                     audioSource === 'microphone' ? '🎤 Mic' :
                     audioSource === 'simulation' ? '🎵 Sim' : 'Off'}
                  </span>
                </div>
                
                <div className={`test-item ${dmxConnected ? 'pass' : 'fail'}`}>
                  <span className="test-icon">{dmxConnected ? '✓' : '✗'}</span>
                  <span className="test-name">DMX Interface</span>
                  <span className="test-status">{dmxConnected ? 'Connected' : 'Not connected'}</span>
                </div>
                
                {/* 🌙 WAVE 25: Real-time DMX Stats from Truth */}
                <div className={`test-item ${hardwareState.dmx.connected ? 'pass' : 'neutral'}`}>
                  <span className="test-icon">📡</span>
                  <span className="test-name">DMX Output</span>
                  <span className="test-status">
                    {hardwareState.dmx.connected 
                      ? `${hardwareState.dmx.frameRate.toFixed(0)} fps • ${hardwareState.fixturesActive}/${hardwareState.fixturesTotal} active`
                      : 'Waiting...'}
                  </span>
                </div>
                
                <div className={`test-item ${patchedFixtures.length > 0 ? 'pass' : 'fail'}`}>
                  <span className="test-icon">{patchedFixtures.length > 0 ? '✓' : '✗'}</span>
                  <span className="test-name">Fixtures</span>
                  <span className="test-status">
                    {patchedFixtures.length > 0 ? `${patchedFixtures.length} patched` : 'None'}
                  </span>
                </div>
              </div>
              
              {/* 🔦 WAVE 11: HIGHLIGHT MODE - Diagnóstico de Fixtures */}
              {patchedFixtures.length > 0 && (
                <div className="highlight-mode">
                  <h4>🔦 FIXTURE DIAGNOSTIC</h4>
                  <p className="highlight-hint">Test each fixture one by one. If it lights up, it's working!</p>
                  
                  <div className="highlight-controls">
                    <button 
                      className="highlight-btn prev"
                      onClick={highlightPrev}
                      disabled={patchedFixtures.length === 0}
                    >
                      ← PREV
                    </button>
                    
                    <div className={`highlight-display ${isHighlighting ? 'active' : ''} ${highlightIndex >= 0 ? 'on' : 'off'}`}>
                      {highlightIndex >= 0 && patchedFixtures[highlightIndex] ? (
                        <>
                          <span className="highlight-number">#{highlightIndex + 1}</span>
                          <span className="highlight-name">{patchedFixtures[highlightIndex].name}</span>
                          <span className="highlight-dmx">DMX {String(patchedFixtures[highlightIndex].dmxAddress).padStart(3, '0')}</span>
                        </>
                      ) : (
                        <span className="highlight-off">🌑 Press NEXT to start</span>
                      )}
                    </div>
                    
                    <button 
                      className="highlight-btn next"
                      onClick={highlightNext}
                      disabled={patchedFixtures.length === 0}
                    >
                      NEXT →
                    </button>
                  </div>
                  
                  <div className="highlight-actions">
                    <button 
                      className="highlight-action-btn test"
                      onClick={highlightCurrentFixture}
                      disabled={highlightIndex < 0}
                    >
                      🔦 TEST AGAIN
                    </button>
                    <button 
                      className="highlight-action-btn stop"
                      onClick={stopHighlight}
                      disabled={highlightIndex < 0}
                    >
                      🌑 BLACKOUT
                    </button>
                  </div>
                </div>
              )}
              
              {isStepComplete(4) ? (
                <div className="ready-banner">
                  <span className="ready-icon">🚀</span>
                  <span>SYSTEM READY - Start using LuxSync!</span>
                </div>
              ) : (
                <div className="error-banner">
                  ⚠️ Complete setup: Audio + Fixtures required
                </div>
              )}
              
              {/* 🎭 WAVE 10.6: Show Management */}
              <div className="show-management">
                <h4>💾 SHOW MANAGEMENT</h4>
                <div className="show-buttons">
                  <button className="show-btn save" onClick={saveShow}>
                    💾 GUARDAR SHOW
                  </button>
                  <button className="show-btn load" onClick={loadShow}>
                    📂 CARGAR SHOW
                  </button>
                  <button className="show-btn new" onClick={newShow}>
                    🎭 NEW SHOW
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="wizard-nav">
          <button className="nav-btn prev" onClick={prevStep} disabled={currentStep === 1}>
            ← Previous
          </button>
          
          {currentStep < 4 ? (
            <button className="nav-btn next" onClick={nextStep}>
              Next →
            </button>
          ) : (
            <button 
              className="nav-btn finish" 
              disabled={!isStepComplete(4)}
              onClick={() => {
                console.log('[SetupView] 🚀 START - Navigating to LIVE view')
                setActiveTab('live')
              }}
            >
              🚀 START
            </button>
          )}
        </div>
      </div>

      {/* Quick Status */}
      <div className="quick-status">
        <div className={`status-item ${audioSource !== 'none' ? 'ok' : 'error'}`}>
          <span className="status-dot" />
          <span className="status-label">Audio:</span>
          <span className="status-value">
            {audioSource === 'simulation' ? '🎵 Sim' :
             audioSource === 'system' ? '🖥️' :
             audioSource === 'microphone' ? '🎤' : 'Off'}
          </span>
        </div>
        
        <div className={`status-item ${dmxConnected ? 'ok' : 'error'}`}>
          <span className="status-dot" />
          <span className="status-label">DMX:</span>
          <span className="status-value">{dmxConnected ? '✓' : '✗'}</span>
        </div>
        
        <div className={`status-item ${patchedFixtures.length > 0 ? 'ok' : 'error'}`}>
          <span className="status-dot" />
          <span className="status-label">Fixtures:</span>
          <span className="status-value">{patchedFixtures.length}</span>
        </div>
      </div>
    </div>
  )
}

export default SetupView
