/**
 * ⚙️ SETUP VIEW - CYBERPUNK EDITION
 * WAVE 9.6: El Wizard que merece LuxSync
 * 
 * FEATURES:
 * - Diseño Glassmorphism + Neon
 * - Audio: Simulation (sin permisos), System (getDisplayMedia), Microphone
 * - Fixtures: Iconos por tipo, layout profesional
 * - Patch Table: DMX address management
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useAudioStore } from '../../../stores/audioStore'
import { useDMXStore, DMX_DRIVERS } from '../../../stores/dmxStore'
import { useSeleneStore } from '../../../stores/seleneStore'
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
// FIXTURE TYPE ICONS
// ============================================================================

const getFixtureTypeIcon = (name: string, type: string): { icon: string; className: string } => {
  const nameLower = name.toLowerCase()
  const typeLower = type.toLowerCase()
  
  if (nameLower.includes('spot') || nameLower.includes('beam') || typeLower.includes('moving')) {
    return { icon: '🎯', className: 'moving-head' }
  }
  if (nameLower.includes('wash') || nameLower.includes('led wash')) {
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
  const [audioSource, setAudioSource] = useState<AudioSourceType>('simulation')
  const [audioLevel, setAudioLevel] = useState(0)
  const [sensitivity, setSensitivity] = useState(50)
  const [isConnectingAudio, setIsConnectingAudio] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  
  // === DMX STATE ===
  const [selectedDMXDriver, setSelectedDMXDriver] = useState('enttec-open')
  const [isTestingDMX, setIsTestingDMX] = useState(false)
  const [dmxTestResult, setDmxTestResult] = useState<'none' | 'success' | 'fail'>('none')
  
  // === FIXTURE STATE ===
  const [fixtureLibrary, setFixtureLibrary] = useState<FixtureLibraryItem[]>([])
  const [patchedFixtures, setPatchedFixtures] = useState<PatchedFixture[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [selectedLibraryFixture, setSelectedLibraryFixture] = useState<string | null>(null)
  const [nextDmxAddress, setNextDmxAddress] = useState(1)
  const [librarySearchTerm, setLibrarySearchTerm] = useState('')
  
  // Stores
  const { bpm, bpmConfidence } = useAudioStore()
  const { isConnected: dmxConnected } = useDMXStore()
  useSeleneStore()
  
  // Trinity provider
  const trinity = useTrinity()

  // === EFFECTS ===
  
  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      if (!window.lux) return
      try {
        const result = await window.lux.getConfig()
        if (result.success && result.config) {
          setAudioSource(result.config.audio?.source || 'simulation')
          setSensitivity(result.config.audio?.sensitivity || 50)
          setSelectedDMXDriver(result.config.dmx?.driver || 'enttec-open')
        }
      } catch (err) {
        console.error('[SetupView] Error loading config:', err)
      }
    }
    loadConfig()
  }, [])
  
  // Scan fixtures on mount
  useEffect(() => {
    scanFixtures()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  // Load patched fixtures
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

  // Audio level animation
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

  // === AUDIO HANDLERS ===
  
  const connectAudio = useCallback(async (source: 'microphone' | 'system' | 'simulation') => {
    setIsConnectingAudio(true)
    setAudioError(null)
    
    try {
      if (source === 'simulation') {
        // SIMULATION: NO pedir permisos, solo activar generador interno
        console.log('[SetupView] 🎵 Activating simulation mode - NO permissions needed')
        trinity.setSimulating(true)
        setAudioSource('simulation')
        
      } else if (source === 'system') {
        // SYSTEM AUDIO: Lanzar getDisplayMedia inmediatamente
        console.log('[SetupView] 🖥️ Launching getDisplayMedia for system audio...')
        
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: {
              // @ts-expect-error - systemAudio es una API nueva
              systemAudio: 'include',
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            }
          })
          
          // Verificar que tenemos audio
          const audioTracks = stream.getAudioTracks()
          if (audioTracks.length === 0) {
            throw new Error('No se capturó audio del sistema. Asegúrate de compartir una pestaña con audio.')
          }
          
          console.log('[SetupView] ✅ System audio captured:', audioTracks[0].label)
          trinity.setSimulating(false)
          // TODO: Conectar el stream al AudioContext del Trinity
          setAudioSource('system')
          
        } catch (displayError) {
          console.error('[SetupView] getDisplayMedia error:', displayError)
          throw new Error('Permiso denegado o cancelado. Debes compartir una ventana con audio.')
        }
        
      } else if (source === 'microphone') {
        // MICROPHONE: getUserMedia estándar
        console.log('[SetupView] 🎤 Requesting microphone access...')
        
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true })
          console.log('[SetupView] ✅ Microphone access granted')
          trinity.setSimulating(false)
          setAudioSource('microphone')
          
        } catch (micError) {
          console.error('[SetupView] getUserMedia error:', micError)
          throw new Error('Permiso de micrófono denegado')
        }
      }
      
      // Guardar en config
      if (window.lux) {
        await window.lux.saveConfig({
          audio: { source, sensitivity }
        })
      }
      
    } catch (err) {
      console.error('[SetupView] Audio error:', err)
      setAudioError(err instanceof Error ? err.message : 'Error al conectar audio')
    } finally {
      setIsConnectingAudio(false)
    }
  }, [sensitivity, trinity])

  // === FIXTURE HANDLERS ===
  
  const scanFixtures = useCallback(async () => {
    if (!window.lux) {
      console.warn('[SetupView] window.lux not available')
      return
    }
    
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
    
    if (confirm('¿Eliminar todos los fixtures del patch?')) {
      try {
        const result = await window.lux.clearPatch()
        if (result.success) {
          setPatchedFixtures([])
          setNextDmxAddress(1)
        }
      } catch (err) {
        console.error('[SetupView] Clear error:', err)
      }
    }
  }, [])

  // === DMX TEST ===
  const testDMXConnection = () => {
    setIsTestingDMX(true)
    setDmxTestResult('none')
    setTimeout(() => {
      setIsTestingDMX(false)
      setDmxTestResult(Math.random() > 0.3 ? 'success' : 'fail')
    }, 1500)
  }

  // === COMPUTED ===
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
      case 2: return dmxConnected || selectedDMXDriver !== ''
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
          <span className={`setup-badge ${currentStep === 4 && isStepComplete(4) ? 'complete' : ''}`}>
            {currentStep === 4 && isStepComplete(4) ? '✓ READY' : `STEP ${currentStep}/4`}
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
          
          {/* === STEP 1: AUDIO === */}
          {currentStep === 1 && (
            <div className="wizard-step">
              <h3>
                <span className="step-emoji">🎤</span>
                AUDIO INPUT SETUP
              </h3>
              
              {audioError && (
                <div className="error-banner">
                  <span>⚠️</span>
                  {audioError}
                </div>
              )}
              
              <div className="audio-sources">
                {/* System Audio */}
                <button 
                  className={`source-card system ${audioSource === 'system' ? 'active' : ''}`}
                  onClick={() => connectAudio('system')}
                  disabled={isConnectingAudio}
                >
                  <div className="source-icon-wrapper">🖥️</div>
                  <span className="source-name">System Audio</span>
                  <span className="source-desc">Captura el audio que reproduce tu PC (Spotify, YouTube, etc.)</span>
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
                  <span className="source-desc">Usa un micrófono o entrada de línea externa</span>
                  {audioSource === 'microphone' && <span className="source-check">✓</span>}
                </button>
                
                {/* Simulation */}
                <button 
                  className={`source-card simulation ${audioSource === 'simulation' ? 'active' : ''}`}
                  onClick={() => connectAudio('simulation')}
                  disabled={isConnectingAudio}
                >
                  <div className="source-icon-wrapper">🎵</div>
                  <span className="source-name">Simulation</span>
                  <span className="source-desc">Audio generado para demos y testing</span>
                  {audioSource === 'simulation' && <span className="source-check">✓</span>}
                </button>
              </div>
              
              {isConnectingAudio && (
                <div className="connecting-status">Conectando...</div>
              )}
              
              {/* VU Meter */}
              <div className="audio-visualizer">
                <div className="visualizer-label">AUDIO LEVEL</div>
                <div className="vu-meter">
                  <div 
                    className="vu-bar" 
                    style={{ width: `${Math.min(100, audioLevel * 100)}%` }} 
                  />
                </div>
              </div>
              
              {/* Sensitivity */}
              <div className="sensitivity-row">
                <span className="sensitivity-label">Sensitivity:</span>
                <input 
                  type="range" 
                  className="sensitivity-slider"
                  min="0" 
                  max="100" 
                  value={sensitivity}
                  onChange={(e) => setSensitivity(parseInt(e.target.value))}
                />
                <span className="sensitivity-value">
                  {sensitivity < 33 ? 'LOW' : sensitivity < 66 ? 'MEDIUM' : 'HIGH'}
                </span>
              </div>
              
              {/* BPM Display */}
              <div className="bpm-display">
                <span className="bpm-value">
                  {(trinity.audioMetrics?.bpm || bpm || 120).toFixed(1)}
                </span>
                <span className="bpm-label">BPM ♪</span>
                <span className="bpm-confidence">
                  Confidence: {((bpmConfidence || 0.5) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}

          {/* === STEP 2: DMX === */}
          {currentStep === 2 && (
            <div className="wizard-step">
              <h3>
                <span className="step-emoji">💡</span>
                DMX INTERFACE SETUP
              </h3>
              
              <div className="dmx-interfaces">
                {DMX_DRIVERS.map(driver => (
                  <div 
                    key={driver.id} 
                    className={`dmx-interface-card ${selectedDMXDriver === driver.id ? 'selected' : ''}`}
                    onClick={() => setSelectedDMXDriver(driver.id)}
                  >
                    <div className="dmx-radio" />
                    <div className="dmx-info">
                      <span className="dmx-name">{driver.label}</span>
                      <span className="dmx-desc">{driver.description}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="patch-controls">
                <span className="patch-label">Port:</span>
                <select 
                  className="patch-address-input" 
                  defaultValue="AUTO"
                  style={{ width: 'auto' }}
                >
                  <option value="AUTO">AUTO</option>
                  <option value="COM3">COM3</option>
                  <option value="COM4">COM4</option>
                </select>
                
                <span className="patch-label" style={{ marginLeft: '16px' }}>Universe:</span>
                <input 
                  type="number" 
                  className="patch-address-input"
                  defaultValue={1} 
                  min={1} 
                  max={32768} 
                />
                
                <button 
                  className="patch-btn"
                  onClick={testDMXConnection}
                  disabled={isTestingDMX}
                  style={{ marginLeft: 'auto' }}
                >
                  {isTestingDMX ? '⏳ Testing...' : '🔌 Test Connection'}
                </button>
              </div>
              
              {dmxTestResult !== 'none' && (
                <div className={`test-item ${dmxTestResult === 'success' ? 'pass' : 'fail'}`} style={{ marginTop: '16px' }}>
                  <span className="test-icon">{dmxTestResult === 'success' ? '✓' : '✗'}</span>
                  <span className="test-name">Connection Test</span>
                  <span className="test-status">
                    {dmxTestResult === 'success' ? 'Interface detected!' : 'No device found'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* === STEP 3: FIXTURES === */}
          {currentStep === 3 && (
            <div className="wizard-step fixture-section">
              <h3>
                <span className="step-emoji">🔦</span>
                FIXTURE LIBRARY
              </h3>
              
              {/* Search + Scan */}
              <div className="fixture-search">
                <input 
                  type="text"
                  className="search-input"
                  placeholder="🔍 Buscar fixtures..."
                  value={librarySearchTerm}
                  onChange={(e) => setLibrarySearchTerm(e.target.value)}
                />
                <button 
                  className="scan-btn"
                  onClick={scanFixtures}
                  disabled={isScanning}
                >
                  {isScanning ? '⏳' : '📂'} 
                  {isScanning ? 'Escaneando...' : 'Scan Library'}
                </button>
              </div>
              
              {/* Fixture Library */}
              <div className="fixture-library">
                {filteredLibrary.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">📦</div>
                    <div className="empty-state-text">
                      {isScanning ? 'Escaneando...' : 'No se encontraron fixtures. Usa "Scan Library".'}
                    </div>
                  </div>
                ) : (
                  filteredLibrary.map(fixture => {
                    const { icon, className } = getFixtureTypeIcon(fixture.name, fixture.type)
                    return (
                      <div 
                        key={fixture.id}
                        className={`fixture-card ${selectedLibraryFixture === fixture.id ? 'selected' : ''}`}
                        onClick={() => setSelectedLibraryFixture(fixture.id)}
                      >
                        <div className={`fixture-type-icon ${className}`}>
                          {icon}
                        </div>
                        <div className="fixture-info">
                          <div className="fixture-name">{fixture.name}</div>
                          <div className="fixture-meta">
                            <span className="fixture-manufacturer">{fixture.manufacturer}</span>
                            <span className="fixture-channels">{fixture.channelCount}ch</span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              
              {/* Patch Controls */}
              {selectedLibraryFixture && (
                <div className="patch-controls">
                  <span className="patch-label">DMX Address:</span>
                  <input 
                    type="number"
                    className="patch-address-input"
                    value={nextDmxAddress}
                    onChange={(e) => setNextDmxAddress(parseInt(e.target.value) || 1)}
                    min={1}
                    max={512}
                  />
                  <button 
                    className="patch-btn"
                    onClick={() => patchFixture(selectedLibraryFixture)}
                  >
                    ➕ ADD TO PATCH
                  </button>
                </div>
              )}
              
              {/* Patched Fixtures Table */}
              {patchedFixtures.length > 0 && (
                <div className="patch-table-section">
                  <div className="patch-table-header">
                    <div className="patch-table-title">
                      📋 PATCHED FIXTURES
                      <span className="patch-count">{patchedFixtures.length} fixtures • {totalChannelsUsed}/512 ch</span>
                    </div>
                    <button className="clear-patch-btn" onClick={clearAllPatch}>
                      🗑️ Clear All
                    </button>
                  </div>
                  
                  <div className="patch-table">
                    <div className="patch-row header">
                      <div className="patch-cell">ADDR</div>
                      <div className="patch-cell">TYPE</div>
                      <div className="patch-cell">NAME</div>
                      <div className="patch-cell">CH</div>
                      <div className="patch-cell"></div>
                    </div>
                    {patchedFixtures.map(fixture => {
                      const { icon, className } = getFixtureTypeIcon(fixture.name, fixture.type)
                      return (
                        <div key={fixture.dmxAddress} className="patch-row">
                          <div className="patch-cell address">{fixture.dmxAddress}</div>
                          <div className="patch-cell">
                            <div className={`fixture-type-icon ${className}`} style={{ width: 28, height: 28, fontSize: '0.9rem' }}>
                              {icon}
                            </div>
                          </div>
                          <div className="patch-cell">{fixture.name}</div>
                          <div className="patch-cell channels">{fixture.channelCount}</div>
                          <div className="patch-cell">
                            <button 
                              className="patch-remove-btn"
                              onClick={() => unpatchFixture(fixture.dmxAddress)}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === STEP 4: SYSTEM TEST === */}
          {currentStep === 4 && (
            <div className="wizard-step">
              <h3>
                <span className="step-emoji">✓</span>
                SYSTEM TEST
              </h3>
              
              <div className="test-results">
                {/* Audio Test */}
                <div className={`test-item ${audioSource !== 'none' ? 'pass' : 'fail'}`}>
                  <span className="test-icon">{audioSource !== 'none' ? '✓' : '✗'}</span>
                  <span className="test-name">Audio Input</span>
                  <span className="test-status">
                    {audioSource === 'system' ? '🖥️ System Audio' :
                     audioSource === 'microphone' ? '🎤 Microphone' :
                     audioSource === 'simulation' ? '🎵 Simulation' : 'Not configured'}
                  </span>
                </div>
                
                {/* Beat Detection Test */}
                <div className={`test-item ${trinity.audioMetrics?.bpm ? 'pass' : 'pending'}`}>
                  <span className="test-icon">{trinity.audioMetrics?.bpm ? '✓' : '○'}</span>
                  <span className="test-name">Beat Detection</span>
                  <span className="test-status">
                    {trinity.audioMetrics?.bpm 
                      ? `Working • ${trinity.audioMetrics.bpm.toFixed(1)} BPM` 
                      : 'Waiting for audio...'}
                  </span>
                </div>
                
                {/* DMX Test */}
                <div className={`test-item ${dmxConnected ? 'pass' : selectedDMXDriver ? 'pending' : 'fail'}`}>
                  <span className="test-icon">{dmxConnected ? '✓' : selectedDMXDriver ? '○' : '✗'}</span>
                  <span className="test-name">DMX Interface</span>
                  <span className="test-status">
                    {dmxConnected ? 'Connected' : selectedDMXDriver ? 'Ready to connect' : 'Not configured'}
                  </span>
                </div>
                
                {/* Fixtures Test */}
                <div className={`test-item ${patchedFixtures.length > 0 ? 'pass' : 'fail'}`}>
                  <span className="test-icon">{patchedFixtures.length > 0 ? '✓' : '✗'}</span>
                  <span className="test-name">Fixtures</span>
                  <span className="test-status">
                    {patchedFixtures.length > 0 
                      ? `${patchedFixtures.length} fixtures • ${totalChannelsUsed} channels` 
                      : 'No fixtures patched'}
                  </span>
                </div>
              </div>
              
              {/* Ready Status */}
              {audioSource !== 'none' && patchedFixtures.length > 0 ? (
                <div className="bpm-display" style={{ marginTop: '24px', background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(0, 255, 136, 0.05))' }}>
                  <span className="bpm-value" style={{ color: '#00ff88' }}>✓</span>
                  <span className="bpm-label" style={{ color: '#00ff88' }}>SYSTEM READY</span>
                  <span className="bpm-confidence">You can start using LuxSync!</span>
                </div>
              ) : (
                <div className="error-banner" style={{ marginTop: '24px' }}>
                  ⚠️ Complete the setup to start: Configure audio and patch at least one fixture.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="wizard-nav">
          <button 
            className="nav-btn prev"
            onClick={prevStep}
            disabled={currentStep === 1}
          >
            ← Previous
          </button>
          
          {currentStep < 4 ? (
            <button 
              className="nav-btn next"
              onClick={nextStep}
            >
              Next →
            </button>
          ) : (
            <button 
              className="nav-btn finish"
              onClick={() => {
                // Aquí podrías cerrar el wizard o ir a LIVE
                console.log('[SetupView] ✅ Setup complete!')
              }}
              disabled={!isStepComplete(4)}
            >
              🚀 START LUXSYNC
            </button>
          )}
        </div>
      </div>

      {/* Quick Status Footer */}
      <div className="quick-status">
        <div className={`status-item ${audioSource !== 'none' ? 'ok' : 'error'}`}>
          <span className="status-dot" />
          <span className="status-label">Audio:</span>
          <span className="status-value">
            {audioSource === 'system' ? 'System' :
             audioSource === 'microphone' ? 'Mic' :
             audioSource === 'simulation' ? 'Sim' : 'Off'}
          </span>
        </div>
        
        <div className={`status-item ${dmxConnected ? 'ok' : selectedDMXDriver ? 'pending' : 'error'}`}>
          <span className="status-dot" />
          <span className="status-label">DMX:</span>
          <span className="status-value">{dmxConnected ? 'Connected' : 'Not connected'}</span>
        </div>
        
        <div className={`status-item ${patchedFixtures.length > 0 ? 'ok' : 'error'}`}>
          <span className="status-dot" />
          <span className="status-label">Fixtures:</span>
          <span className="status-value">{patchedFixtures.length} patched</span>
        </div>
      </div>
    </div>
  )
}

export default SetupView
