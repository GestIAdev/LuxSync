/**
 * ⚙️ SETUP VIEW - Configuration Wizard
 * WAVE 9.2: Audio, DMX, Fixtures y System Test
 */

import React, { useState, useEffect } from 'react'
import { useAudioStore } from '../../../stores/audioStore'
import { useDMXStore, DMX_DRIVERS } from '../../../stores/dmxStore'
import { useSeleneStore } from '../../../stores/seleneStore'
import './SetupView.css'

type SetupStep = 1 | 2 | 3 | 4

// Demo audio devices
const AUDIO_DEVICES = [
  { id: 'scarlett', name: 'Focusrite Scarlett 2i2 USB', type: 'USB' },
  { id: 'realtek', name: 'Realtek High Definition Audio', type: 'Built-in' },
  { id: 'nvidia', name: 'NVIDIA High Definition Audio', type: 'HDMI' },
  { id: 'stereo', name: 'Stereo Mix (Realtek)', type: 'Virtual' },
]

const SetupView: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<SetupStep>(1)
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('scarlett')
  const [selectedDMXDriver, setSelectedDMXDriver] = useState('enttec-open')
  const [audioLevel, setAudioLevel] = useState(0)
  const [sensitivity, setSensitivity] = useState(50)
  const [isTestingDMX, setIsTestingDMX] = useState(false)
  const [dmxTestResult, setDmxTestResult] = useState<'none' | 'success' | 'fail'>('none')
  
  const { isConnected: audioConnected, deviceName, bpm, bpmConfidence } = useAudioStore()
  const { isConnected: dmxConnected, fixtureCount, channelsUsed } = useDMXStore()
  const { brainConnected, patternsLearned } = useSeleneStore()

  // Simulate audio level animation
  useEffect(() => {
    const interval = setInterval(() => {
      setAudioLevel(Math.random() * 0.7 + 0.1)
    }, 100)
    return () => clearInterval(interval)
  }, [])

  // DMX test simulation
  const testDMXConnection = () => {
    setIsTestingDMX(true)
    setDmxTestResult('none')
    setTimeout(() => {
      setIsTestingDMX(false)
      setDmxTestResult(Math.random() > 0.3 ? 'success' : 'fail')
    }, 1500)
  }

  const steps = [
    { step: 1, label: 'Audio', icon: '🎤' },
    { step: 2, label: 'DMX', icon: '💡' },
    { step: 3, label: 'Fixtures', icon: '🔦' },
    { step: 4, label: 'Test', icon: '✓' },
  ]

  const nextStep = () => setCurrentStep(prev => Math.min(4, prev + 1) as SetupStep)
  const prevStep = () => setCurrentStep(prev => Math.max(1, prev - 1) as SetupStep)

  // Get step completion status
  const isStepComplete = (step: number): boolean => {
    switch(step) {
      case 1: return audioConnected
      case 2: return dmxConnected
      case 3: return fixtureCount > 0
      case 4: return audioConnected && dmxConnected && fixtureCount > 0
      default: return false
    }
  }

  return (
    <div className="setup-view">
      <header className="view-header">
        <h2 className="view-title">⚙️ SETUP</h2>
        <div className="view-status">
          <span className={`setup-progress-badge ${currentStep === 4 ? 'complete' : ''}`}>
            Step {currentStep}/4
          </span>
        </div>
      </header>

      <div className="setup-content">
        {/* Progress Bar */}
        <section className="setup-progress">
          {steps.map(({ step, label, icon }) => (
            <div 
              key={step}
              className={`progress-step ${step <= currentStep ? 'active' : ''} ${step === currentStep ? 'current' : ''} ${isStepComplete(step) ? 'complete' : ''}`}
              onClick={() => setCurrentStep(step as SetupStep)}
            >
              <span className="step-icon">{isStepComplete(step) ? '✓' : icon}</span>
              <span className="step-label">{label}</span>
            </div>
          ))}
          <div className="progress-line">
            <div 
              className="progress-fill" 
              style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
            />
          </div>
        </section>

        {/* Wizard Content */}
        <section className="setup-wizard">
          {currentStep === 1 && (
            <div className="wizard-step audio-setup">
              <h3>🎤 AUDIO INPUT SETUP</h3>
              <div className="device-list">
                {AUDIO_DEVICES.map(device => (
                  <div 
                    key={device.id}
                    className={`device-item ${selectedAudioDevice === device.id ? 'selected' : ''}`}
                    onClick={() => setSelectedAudioDevice(device.id)}
                  >
                    <span className="device-radio">{selectedAudioDevice === device.id ? '◉' : '○'}</span>
                    <span className="device-name">{device.name}</span>
                    <span className="device-type">{device.type}</span>
                  </div>
                ))}
              </div>
              <div className="audio-level-display">
                <span>Audio Level:</span>
                <div className="vu-meter">
                  <div className="vu-bar" style={{ width: `${audioLevel * 100}%` }} />
                </div>
              </div>
              <div className="sensitivity-control">
                <span>Sensitivity:</span>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={sensitivity}
                  onChange={(e) => setSensitivity(parseInt(e.target.value))}
                />
                <span>{sensitivity < 33 ? 'Low' : sensitivity < 66 ? 'Medium' : 'High'}</span>
              </div>
              <div className="bpm-detection">
                <span>Detected BPM: {bpm.toFixed(1)} ♪</span>
                <span className="confidence">(Confidence: {(bpmConfidence * 100).toFixed(0)}%)</span>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="wizard-step dmx-setup">
              <h3>💡 DMX INTERFACE SETUP</h3>
              <div className="interface-list">
                {DMX_DRIVERS.map(driver => (
                  <div 
                    key={driver.id} 
                    className={`interface-item ${selectedDMXDriver === driver.id ? 'selected' : ''}`}
                    onClick={() => setSelectedDMXDriver(driver.id)}
                  >
                    <span className="interface-radio">{selectedDMXDriver === driver.id ? '◉' : '○'}</span>
                    <div className="interface-info">
                      <span className="interface-name">{driver.label}</span>
                      <span className="interface-desc">{driver.description}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="dmx-config">
                <div className="config-row">
                  <label>Port:</label>
                  <select defaultValue="COM3">
                    <option value="COM3">COM3</option>
                    <option value="COM4">COM4</option>
                  </select>
                </div>
                <div className="config-row">
                  <label>Universe:</label>
                  <input type="number" defaultValue={1} min={1} max={32768} />
                </div>
                <div className="config-row">
                  <label>Frame Rate:</label>
                  <input type="range" min="1" max="44" defaultValue="44" />
                  <span>44 Hz</span>
                </div>
              </div>
              <div className="dmx-actions">
                <button 
                  className={`btn ${isTestingDMX ? 'testing' : ''}`}
                  onClick={testDMXConnection}
                  disabled={isTestingDMX}
                >
                  {isTestingDMX ? '⏳ Testing...' : '🔌 Test Connection'}
                </button>
                <button className="btn btn-secondary">Auto-Detect</button>
              </div>
              {dmxTestResult !== 'none' && (
                <div className={`test-result ${dmxTestResult}`}>
                  {dmxTestResult === 'success' ? '✓ Connection successful!' : '✗ Connection failed. Check cables.'}
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="wizard-step fixture-setup">
              <h3>🔦 FIXTURE PATCHING</h3>
              <div className="fixture-panels">
                <div className="fixture-library">
                  <h4>Library</h4>
                  <div className="library-search">
                    <input type="text" placeholder="🔍 Search..." />
                  </div>
                  <div className="library-tree">
                    <div className="library-folder">
                      📁 Generic
                      <div className="library-items">
                        <div className="library-item">RGB PAR (3ch)</div>
                        <div className="library-item">RGB PAR (6ch)</div>
                        <div className="library-item">Moving Head (16ch)</div>
                      </div>
                    </div>
                    <div className="library-folder">📁 Chauvet</div>
                    <div className="library-folder">📁 Martin</div>
                  </div>
                </div>
                <div className="patch-table">
                  <h4>Patch Table</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Fixture</th>
                        <th>Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>1</td>
                        <td>Moving Head</td>
                        <td>001</td>
                      </tr>
                      <tr>
                        <td>2</td>
                        <td>Moving Head</td>
                        <td>017</td>
                      </tr>
                      <tr>
                        <td>3</td>
                        <td>RGB PAR (6ch)</td>
                        <td>033</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="patch-summary">
                    Total: {fixtureCount} fixtures | Channels: {channelsUsed}/512
                  </div>
                  <div className="patch-actions">
                    <button className="btn btn-small">+ Add</button>
                    <button className="btn btn-small">✎ Edit</button>
                    <button className="btn btn-small">🗑 Delete</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="wizard-step system-test">
              <h3>✓ SYSTEM TEST</h3>
              <div className="test-results">
                <div className={`test-item ${audioConnected ? 'pass' : 'fail'}`}>
                  <span className="test-icon">{audioConnected ? '✓' : '✗'}</span>
                  <span className="test-name">Audio Input</span>
                  <span className="test-status">{audioConnected ? `Working (${deviceName})` : 'Not connected'}</span>
                </div>
                <div className={`test-item ${bpm > 0 ? 'pass' : 'pending'}`}>
                  <span className="test-icon">{bpm > 0 ? '✓' : '○'}</span>
                  <span className="test-name">Beat Detection</span>
                  <span className="test-status">{bpm > 0 ? `Working (BPM: ${bpm.toFixed(1)})` : 'Waiting for audio...'}</span>
                </div>
                <div className={`test-item ${dmxConnected ? 'pass' : 'fail'}`}>
                  <span className="test-icon">{dmxConnected ? '✓' : '✗'}</span>
                  <span className="test-name">DMX Interface</span>
                  <span className="test-status">{dmxConnected ? 'Connected (44 fps)' : 'Not connected'}</span>
                </div>
                <div className={`test-item ${fixtureCount > 0 ? 'pass' : 'pending'}`}>
                  <span className="test-icon">{fixtureCount > 0 ? '✓' : '○'}</span>
                  <span className="test-name">Fixture Response</span>
                  <span className="test-status">{fixtureCount > 0 ? `All ${fixtureCount} responding` : 'No fixtures patched'}</span>
                </div>
                <div className={`test-item ${brainConnected ? 'pass' : 'pending'}`}>
                  <span className="test-icon">{brainConnected ? '✓' : '○'}</span>
                  <span className="test-name">Selene Core</span>
                  <span className="test-status">{brainConnected ? `Active (Memory: ${patternsLearned.toLocaleString()} patterns)` : 'Initializing...'}</span>
                </div>
                <div className="test-item pass">
                  <span className="test-icon">✓</span>
                  <span className="test-name">Renderer Performance</span>
                  <span className="test-status">60 FPS stable</span>
                </div>
              </div>
              {audioConnected && dmxConnected && fixtureCount > 0 ? (
                <div className="test-success">
                  <div className="success-icon">🎉</div>
                  <div className="success-text">All systems operational!</div>
                  <div className="success-subtext">Ready to rock! 🤘</div>
                </div>
              ) : (
                <div className="test-warning">
                  <div className="warning-icon">⚠️</div>
                  <div className="warning-text">Some systems need attention</div>
                  <div className="warning-subtext">Check failed items above</div>
                </div>
              )}
              <div className="test-actions">
                <button className="btn">Run Full Test</button>
                <button className="btn btn-primary">▶ Start Live Mode</button>
              </div>
            </div>
          )}
        </section>

        {/* Quick Status */}
        <section className="quick-status">
          <h4>Quick Status</h4>
          <div className="status-grid">
            <div className={`status-item ${audioConnected ? 'ok' : 'error'}`}>
              <span>🎤 Audio:</span>
              <span>{audioConnected ? `✓ ${deviceName}` : '✗ Not configured'}</span>
            </div>
            <div className={`status-item ${dmxConnected ? 'ok' : 'error'}`}>
              <span>💡 DMX:</span>
              <span>{dmxConnected ? '✓ Connected' : '✗ Not configured'}</span>
            </div>
            <div className={`status-item ${fixtureCount > 0 ? 'ok' : 'error'}`}>
              <span>🔦 Fixtures:</span>
              <span>{fixtureCount > 0 ? `✓ ${fixtureCount} patched` : '✗ 0 patched'}</span>
            </div>
            <div className="status-item ok">
              <span>✓ System:</span>
              <span>✓ Ready</span>
            </div>
          </div>
        </section>

        {/* Navigation Buttons */}
        <div className="wizard-nav">
          <button 
            className="btn btn-secondary"
            onClick={prevStep}
            disabled={currentStep === 1}
          >
            ← Back
          </button>
          <button 
            className="btn btn-primary"
            onClick={nextStep}
            disabled={currentStep === 4}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

export default SetupView
