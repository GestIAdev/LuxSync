/**
 * ⚙️ SETUP VIEW - CYBERPUNK EDITION v2
 * WAVE 9.6.1: UX Fixes
 * 
 * FIXES:
 * - Simulation: Activación INMEDIATA sin permisos
 * - System Audio: Manejo graceful de cancelación
 * - DMX Virtual: Connected inmediato
 * - Fixtures: Layout 2 columnas con scroll independiente
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useAudioStore } from '../../../stores/audioStore'
import { useDMXStore } from '../../../stores/dmxStore'
import { useSeleneStore } from '../../../stores/seleneStore'
import { useNavigationStore } from '../../../stores/navigationStore'
import { useTrinity } from '../../../providers/TrinityProvider'
import './SetupView.css'

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

interface PatchedFixture extends FixtureLibraryItem {
  dmxAddress: number
  universe: number
}

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
  const [patchedFixtures, setPatchedFixtures] = useState<PatchedFixture[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [selectedLibraryFixture, setSelectedLibraryFixture] = useState<string | null>(null)
  const [nextDmxAddress, setNextDmxAddress] = useState(1)
  const [librarySearchTerm, setLibrarySearchTerm] = useState('')
  
  // Stores
  const { bpm, bpmConfidence } = useAudioStore()
  const dmxStore = useDMXStore()
  const { setActiveTab } = useNavigationStore()
  useSeleneStore()
  
  // Trinity provider
  const trinity = useTrinity()

  // === LOAD CONFIG ON MOUNT ===
  useEffect(() => {
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
    scanFixtures()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  // === LOAD PATCHED FIXTURES ===
  useEffect(() => {
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
      dmxStore.connect('virtual', 'VIRTUAL')
    }
  }, [selectedDMXDriver]) // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================================
  // AUDIO HANDLERS - FIXED
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
    // SYSTEM / MICROPHONE: Requieren permisos
    // ========================================
    setIsConnectingAudio(true)
    
    try {
      if (source === 'system') {
        console.log('[SetupView] 🖥️ Requesting system audio via Electron...')
        
        // En Electron, usamos desktopCapturer para capturar audio del sistema
        // Primero obtenemos las fuentes disponibles
        let sources: Array<{ id: string; name: string }> = []
        
        if (window.luxsync?.audio?.getDesktopSources) {
          sources = await window.luxsync.audio.getDesktopSources()
          console.log('[SetupView] 📺 Desktop sources:', sources.length)
        }
        
        if (sources.length === 0) {
          // Fallback: intentar con getDisplayMedia del navegador
          if (navigator.mediaDevices.getDisplayMedia) {
            try {
              const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: {
                  // @ts-expect-error - systemAudio es experimental
                  systemAudio: 'include',
                  echoCancellation: false,
                  noiseSuppression: false,
                  autoGainControl: false
                }
              })
              
              const audioTracks = stream.getAudioTracks()
              if (audioTracks.length > 0) {
                console.log('[SetupView] ✅ System audio via getDisplayMedia OK')
                trinity.setSimulating(false)
                setAudioSource('system')
                if (window.lux) {
                  await window.lux.saveConfig({ audio: { source, sensitivity } })
                }
                setIsConnectingAudio(false)
                return
              }
              stream.getTracks().forEach(t => t.stop())
            } catch (displayError) {
              console.warn('[SetupView] getDisplayMedia failed:', displayError)
            }
          }
          
          // Si todo falla, usar simulación
          console.warn('[SetupView] ⚠️ No system audio sources - using simulation')
          trinity.setSimulating(true)
          setAudioSource('simulation')
        } else {
          // Usar la primera fuente (pantalla entera o ventana)
          const screenSource = sources.find(s => s.name.includes('Entire Screen') || s.name.includes('Screen')) || sources[0]
          
          try {
            // Crear stream con la fuente de Electron
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                // @ts-expect-error - chromeMediaSource es de Electron
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: screenSource.id
                }
              },
              video: {
                // @ts-expect-error - chromeMediaSource es de Electron
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: screenSource.id,
                  minWidth: 1,
                  maxWidth: 1,
                  minHeight: 1,
                  maxHeight: 1
                }
              }
            })
            
            const audioTracks = stream.getAudioTracks()
            // Detener video track inmediatamente
            stream.getVideoTracks().forEach(t => t.stop())
            
            if (audioTracks.length > 0) {
              console.log('[SetupView] ✅ System audio via Electron OK:', audioTracks[0].label)
              trinity.setSimulating(false)
              setAudioSource('system')
            } else {
              console.warn('[SetupView] ⚠️ No audio tracks - using simulation')
              trinity.setSimulating(true)
              setAudioSource('simulation')
            }
          } catch (captureError) {
            console.warn('[SetupView] ⚠️ Electron capture failed:', captureError)
            trinity.setSimulating(true)
            setAudioSource('simulation')
          }
        }
        
      } else if (source === 'microphone') {
        console.log('[SetupView] 🎤 Requesting microphone...')
        await navigator.mediaDevices.getUserMedia({ audio: true })
        console.log('[SetupView] ✅ Microphone OK')
        trinity.setSimulating(false)
        setAudioSource('microphone')
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
      dmxStore.connect('virtual', 'VIRTUAL')
      console.log('[SetupView] 🎮 Virtual DMX - CONNECTED')
    } else {
      // Hardware real - requiere detección
      setDmxConnected(false)
      dmxStore.disconnect()
    }
    
    if (window.lux) {
      window.lux.saveConfig({ dmx: { driver: driverId, port: 'AUTO', universe: 1, frameRate: 40 } })
    }
  }, [dmxStore])

  // ============================================================================
  // FIXTURE HANDLERS
  // ============================================================================
  
  const scanFixtures = useCallback(async () => {
    if (!window.lux) return
    
    setIsScanning(true)
    try {
      const result = await window.lux.scanFixtures()
      if (result.success) {
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
        setPatchedFixtures(prev => [...prev, result.fixture!])
        const fixture = fixtureLibrary.find(f => f.id === fixtureId)
        if (fixture) {
          setNextDmxAddress(prev => prev + fixture.channelCount)
        }
        setSelectedLibraryFixture(null)
      }
    } catch (err) {
      console.error('[SetupView] Patch error:', err)
    }
  }, [nextDmxAddress, fixtureLibrary])

  const unpatchFixture = useCallback(async (dmxAddress: number) => {
    if (!window.lux) return
    
    try {
      const result = await window.lux.unpatchFixture(dmxAddress)
      if (result.success) {
        setPatchedFixtures(prev => prev.filter(f => f.dmxAddress !== dmxAddress))
      }
    } catch (err) {
      console.error('[SetupView] Unpatch error:', err)
    }
  }, [])

  const clearAllPatch = useCallback(async () => {
    if (!window.lux) return
    if (!confirm('¿Eliminar todos los fixtures?')) return
    
    try {
      const result = await window.lux.clearPatch()
      if (result.success) {
        setPatchedFixtures([])
        setNextDmxAddress(1)
      }
    } catch (err) {
      console.error('[SetupView] Clear error:', err)
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

  const nextStep = () => setCurrentStep(prev => Math.min(4, prev + 1) as SetupStep)
  const prevStep = () => setCurrentStep(prev => Math.max(1, prev - 1) as SetupStep)

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

      {/* Progress Stepper */}
      <nav className="setup-stepper">
        {steps.map(({ step, label, icon }, index) => (
          <React.Fragment key={step}>
            <div 
              className={`stepper-step ${step <= currentStep ? 'active' : ''} ${step === currentStep ? 'current' : ''} ${isStepComplete(step) ? 'complete' : ''}`}
              onClick={() => setCurrentStep(step as SetupStep)}
            >
              <span className="stepper-icon">{isStepComplete(step) ? '✓' : icon}</span>
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
              
              {/* BPM */}
              <div className="bpm-display">
                <span className="bpm-value">{(trinity.audioMetrics?.bpm || bpm || 120).toFixed(1)}</span>
                <span className="bpm-label">BPM ♪</span>
                <span className="bpm-confidence">Confidence: {((bpmConfidence || 0.5) * 100).toFixed(0)}%</span>
              </div>
            </div>
          )}

          {/* ========== STEP 2: DMX ========== */}
          {currentStep === 2 && (
            <div className="wizard-step">
              <h3><span className="step-emoji">💡</span> DMX INTERFACE</h3>
              
              <div className="dmx-interfaces">
                {DMX_DRIVERS.map(driver => (
                  <div 
                    key={driver.id} 
                    className={`dmx-interface-card ${selectedDMXDriver === driver.id ? 'selected' : ''}`}
                    onClick={() => selectDMXDriver(driver.id)}
                  >
                    <div className="dmx-radio" />
                    <div className="dmx-info">
                      <span className="dmx-name">{driver.label}</span>
                      <span className="dmx-desc">{driver.description}</span>
                    </div>
                    {selectedDMXDriver === driver.id && dmxConnected && (
                      <span className="dmx-status connected">✓ Connected</span>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Status */}
              <div className={`dmx-connection-status ${dmxConnected ? 'connected' : ''}`}>
                <span className="status-dot" />
                <span>{dmxConnected ? 'DMX CONNECTED' : 'DMX NOT CONNECTED'}</span>
              </div>
            </div>
          )}

          {/* ========== STEP 3: FIXTURES - 2 COLUMN LAYOUT ========== */}
          {currentStep === 3 && (
            <div className="wizard-step fixture-section">
              <h3><span className="step-emoji">🔦</span> FIXTURE PATCH</h3>
              
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
                      filteredLibrary.map((fixture, index) => {
                        const { icon, className } = getFixtureTypeIcon(fixture.name, fixture.type)
                        // Use index as fallback for duplicate IDs
                        const uniqueKey = `${fixture.id}-${index}`
                        return (
                          <div 
                            key={uniqueKey}
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
                        return (
                          <div key={fixture.dmxAddress} className="patched-card">
                            <span className="patched-addr">{fixture.dmxAddress}</span>
                            <div className={`fixture-icon ${className}`}>{icon}</div>
                            <div className="fixture-details">
                              <span className="fixture-name">{fixture.name}</span>
                              <span className="fixture-meta">{fixture.channelCount}ch</span>
                            </div>
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
                
                <div className={`test-item ${patchedFixtures.length > 0 ? 'pass' : 'fail'}`}>
                  <span className="test-icon">{patchedFixtures.length > 0 ? '✓' : '✗'}</span>
                  <span className="test-name">Fixtures</span>
                  <span className="test-status">
                    {patchedFixtures.length > 0 ? `${patchedFixtures.length} patched` : 'None'}
                  </span>
                </div>
              </div>
              
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
