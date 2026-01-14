/**
 * 🧪 TEST PANEL - WAVE 425
 * Panel de pruebas de hardware
 * 
 * Quick actions para probar funciones del fixture:
 * - Test Color (full white)
 * - Test Strobe
 * - Test Gobo
 * - Blackout
 */

import React, { useCallback, useState } from 'react'
import './TestPanel.css'

export interface TestPanelProps {
  fixtureId: string | null
  disabled?: boolean
}

type TestType = 'color' | 'strobe' | 'gobo' | null

export const TestPanel: React.FC<TestPanelProps> = ({
  fixtureId,
  disabled = false,
}) => {
  const [activeTest, setActiveTest] = useState<TestType>(null)
  
  /**
   * Execute test action
   */
  const handleTest = useCallback(async (testType: TestType) => {
    if (!fixtureId || disabled) return
    
    // Toggle test off if same button pressed
    if (activeTest === testType) {
      setActiveTest(null)
      await handleBlackout()
      return
    }
    
    setActiveTest(testType)
    
    try {
      const controls: Record<string, number> = {}
      
      switch (testType) {
        case 'color':
          // Full white
          controls.dimmer = 65535
          controls.red = 65535
          controls.green = 65535
          controls.blue = 65535
          controls.white = 65535
          break
          
        case 'strobe':
          // Strobe effect
          controls.dimmer = 65535
          controls.strobe = 50000
          controls.white = 65535
          break
          
        case 'gobo':
          // Test gobo (usually gobo 1)
          controls.dimmer = 65535
          controls.gobo = 10000
          controls.white = 65535
          break
      }
      
      await window.lux?.arbiter?.setManual({
        fixtureIds: [fixtureId],
        controls,
        channels: Object.keys(controls),
        source: 'calibration_test',
      })
      
      console.log(`[TestPanel] 🧪 ${testType?.toUpperCase()} test on ${fixtureId}`)
    } catch (err) {
      console.error('[TestPanel] Test error:', err)
    }
  }, [fixtureId, disabled, activeTest])
  
  /**
   * Blackout - all off
   */
  const handleBlackout = useCallback(async () => {
    if (!fixtureId) return
    
    setActiveTest(null)
    
    try {
      await window.lux?.arbiter?.clearManual({
        fixtureIds: [fixtureId],
        channels: ['dimmer', 'red', 'green', 'blue', 'white', 'strobe', 'gobo'],
      })
      console.log(`[TestPanel] ⬛ Blackout on ${fixtureId}`)
    } catch (err) {
      console.error('[TestPanel] Blackout error:', err)
    }
  }, [fixtureId])
  
  /**
   * Reset fixture to default state
   */
  const handleReset = useCallback(async () => {
    if (!fixtureId) return
    
    setActiveTest(null)
    
    try {
      // Clear all manual overrides
      await window.lux?.arbiter?.clearManual({
        fixtureIds: [fixtureId],
        channels: ['all'],
      })
      console.log(`[TestPanel] 🔄 Reset ${fixtureId}`)
    } catch (err) {
      console.error('[TestPanel] Reset error:', err)
    }
  }, [fixtureId])
  
  return (
    <div className={`test-panel ${disabled ? 'disabled' : ''}`}>
      <div className="panel-header">
        <span className="header-icon">🧪</span>
        <h3>TEST PANEL</h3>
      </div>
      
      <div className="test-grid">
        {/* Test buttons */}
        <button
          className={`test-btn color ${activeTest === 'color' ? 'active' : ''}`}
          onClick={() => handleTest('color')}
          disabled={disabled}
          title="Test full white"
        >
          <span className="btn-icon">💡</span>
          <span className="btn-label">COLOR</span>
        </button>
        
        <button
          className={`test-btn strobe ${activeTest === 'strobe' ? 'active' : ''}`}
          onClick={() => handleTest('strobe')}
          disabled={disabled}
          title="Test strobe"
        >
          <span className="btn-icon">⚡</span>
          <span className="btn-label">STROBE</span>
        </button>
        
        <button
          className={`test-btn gobo ${activeTest === 'gobo' ? 'active' : ''}`}
          onClick={() => handleTest('gobo')}
          disabled={disabled}
          title="Test gobo"
        >
          <span className="btn-icon">🔘</span>
          <span className="btn-label">GOBO</span>
        </button>
        
        <button
          className="test-btn blackout"
          onClick={handleBlackout}
          disabled={disabled}
          title="All off"
        >
          <span className="btn-icon">⬛</span>
          <span className="btn-label">BLACKOUT</span>
        </button>
      </div>
      
      {/* Reset button */}
      <div className="test-actions">
        <button
          className="reset-btn"
          onClick={handleReset}
          disabled={disabled}
          title="Reset fixture to AI control"
        >
          🔄 RESET TO AI
        </button>
      </div>
      
      {/* Status */}
      {activeTest && (
        <div className="test-status">
          <span className="status-dot" />
          <span className="status-text">Testing {activeTest.toUpperCase()}</span>
        </div>
      )}
    </div>
  )
}

export default TestPanel
