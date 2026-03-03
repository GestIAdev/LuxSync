/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚙️ PHYSICS TUNER - WAVE 364: THE FIXTURE FORGE
 * "El Seguro de Vida"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Editor visual de física de fixtures con:
 * - Selección de tipo de motor
 * - Ajuste de aceleración máxima (THE LIFE INSURANCE)
 * - Límites de tilt para seguridad
 * - Test de estrés visual
 * 
 * @module components/modals/FixtureEditor/PhysicsTuner
 * @version 364.0.0
 */

import React, { useState, useCallback, useEffect } from 'react'
import { 
  PhysicsProfile, 
  MotorType, 
  InstallationOrientation,
  DEFAULT_PHYSICS_PROFILES 
} from '../../../core/stage/ShowFileV2'
import { 
  Gauge, 
  AlertTriangle, 
  Shield, 
  Zap, 
  RotateCcw,
  Activity,
  ChevronDown,
  Info
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface PhysicsTunerProps {
  /** Current physics profile */
  physics: PhysicsProfile
  /** Callback when physics changes */
  onChange: (physics: PhysicsProfile) => void
  /** Callback to trigger stress test in preview */
  onStressTest: (active: boolean) => void
  /** Whether stress test is currently running */
  isStressTesting: boolean
}

interface RiskLevel {
  level: 'safe' | 'moderate' | 'high' | 'extreme'
  color: string
  label: string
  description: string
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const MOTOR_TYPE_INFO: Record<MotorType, {
  label: string
  description: string
  icon: string
  recommendedAccel: number
}> = {
  'servo-pro': {
    label: 'Servo Pro',
    description: 'High-end motors (Clay Paky, Robe). Fast and precise.',
    icon: '🏎️',
    recommendedAccel: 4000
  },
  'stepper-quality': {
    label: 'Stepper Quality',
    description: 'Mid-range motors (ADJ Vizi, Chauvet). Good balance.',
    icon: '🚗',
    recommendedAccel: 2500
  },
  'stepper-cheap': {
    label: 'Stepper Cheap',
    description: 'Low-cost motors (Chinese clones). Need protection.',
    icon: '🛵',
    recommendedAccel: 1500
  },
  'unknown': {
    label: 'Unknown',
    description: 'Unidentified motor. Use conservative settings.',
    icon: '❓',
    recommendedAccel: 2000
  }
}

const ORIENTATION_OPTIONS: { value: InstallationOrientation; label: string; icon: string }[] = [
  { value: 'ceiling', label: 'Ceiling (hanging)', icon: '⬇️' },
  { value: 'floor', label: 'Floor (pointing up)', icon: '⬆️' },
  { value: 'wall-left', label: 'Left Wall', icon: '➡️' },
  { value: 'wall-right', label: 'Right Wall', icon: '⬅️' },
  { value: 'truss-front', label: 'Front Truss', icon: '🎪' },
  { value: 'truss-back', label: 'Back Truss', icon: '🏗️' }
]

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate risk level based on motor type and acceleration
 */
function calculateRisk(motorType: MotorType, acceleration: number): RiskLevel {
  const recommended = MOTOR_TYPE_INFO[motorType].recommendedAccel
  const ratio = acceleration / recommended
  
  if (ratio <= 1.0) {
    return {
      level: 'safe',
      color: '#22c55e',
      label: 'SAFE',
      description: 'Acceleration within recommended limits'
    }
  } else if (ratio <= 1.3) {
    return {
      level: 'moderate',
      color: '#eab308',
      label: 'MODERATE',
      description: 'Acceleration slightly above. Monitor wear.'
    }
  } else if (ratio <= 1.6) {
    return {
      level: 'high',
      color: '#f97316',
      label: 'HIGH',
      description: '⚠️ Risk of belt slip and premature wear'
    }
  } else {
    return {
      level: 'extreme',
      color: '#ef4444',
      label: 'EXTREME',
      description: '🔥 DANGER: High probability of mechanical damage'
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const PhysicsTuner: React.FC<PhysicsTunerProps> = ({
  physics,
  onChange,
  onStressTest,
  isStressTesting
}) => {
  const [expandedSection, setExpandedSection] = useState<string | null>('motor')
  
  // Calculate current risk level
  const riskLevel = calculateRisk(physics.motorType, physics.maxAcceleration)
  
  // Handle motor type change - apply defaults
  const handleMotorTypeChange = useCallback((newType: MotorType) => {
    const defaults = DEFAULT_PHYSICS_PROFILES[newType]
    onChange({
      ...physics,
      ...defaults,
      motorType: newType
    })
  }, [physics, onChange])
  
  // Update single property
  const updatePhysics = useCallback(<K extends keyof PhysicsProfile>(
    key: K, 
    value: PhysicsProfile[K]
  ) => {
    onChange({ ...physics, [key]: value })
  }, [physics, onChange])
  
  // Stress test handler
  const handleStressTest = useCallback(() => {
    onStressTest(true)
    // Auto-stop after 3 seconds
    setTimeout(() => onStressTest(false), 3000)
  }, [onStressTest])
  
  // Reset to defaults
  const handleReset = useCallback(() => {
    onChange(DEFAULT_PHYSICS_PROFILES[physics.motorType])
  }, [physics.motorType, onChange])
  
  // Toggle section
  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section)
  }
  
  return (
    <div className="physics-tuner">
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* RISK INDICATOR BANNER */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div 
        className="risk-banner"
        style={{ 
          background: `linear-gradient(90deg, ${riskLevel.color}22, transparent)`,
          borderLeft: `4px solid ${riskLevel.color}`
        }}
      >
        <div className="risk-header">
          <Gauge size={20} style={{ color: riskLevel.color }} />
          <span className="risk-label" style={{ color: riskLevel.color }}>
            {riskLevel.label}
          </span>
          {riskLevel.level !== 'safe' && (
            <AlertTriangle size={16} style={{ color: riskLevel.color }} />
          )}
        </div>
        <p className="risk-description">{riskLevel.description}</p>
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MOTOR TYPE SECTION */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="tuner-section">
        <button 
          className="section-header"
          onClick={() => toggleSection('motor')}
        >
          <Activity size={18} />
          <span>Motor Type</span>
          <ChevronDown 
            size={16} 
            className={expandedSection === 'motor' ? 'expanded' : ''} 
          />
        </button>
        
        {expandedSection === 'motor' && (
          <div className="section-content">
            <div className="motor-grid">
              {(Object.entries(MOTOR_TYPE_INFO) as [MotorType, typeof MOTOR_TYPE_INFO[MotorType]][]).map(([type, info]) => (
                <button
                  key={type}
                  className={`motor-option ${physics.motorType === type ? 'selected' : ''}`}
                  onClick={() => handleMotorTypeChange(type)}
                >
                  <span className="motor-icon">{info.icon}</span>
                  <span className="motor-label">{info.label}</span>
                  <span className="motor-accel">≤{info.recommendedAccel}</span>
                </button>
              ))}
            </div>
            <p className="motor-description">
              <Info size={14} />
              {MOTOR_TYPE_INFO[physics.motorType].description}
            </p>
          </div>
        )}
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ACCELERATION SECTION - THE LIFE INSURANCE */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="tuner-section">
        <button 
          className="section-header"
          onClick={() => toggleSection('accel')}
        >
          <Zap size={18} />
          <span>Acceleration (Life Insurance)</span>
          <ChevronDown 
            size={16} 
            className={expandedSection === 'accel' ? 'expanded' : ''} 
          />
        </button>
        
        {expandedSection === 'accel' && (
          <div className="section-content">
            {/* Max Acceleration Slider */}
            <div className="slider-group">
              <label className="slider-label">
                Max Acceleration
                <span className="slider-value" style={{ color: riskLevel.color }}>
                  {physics.maxAcceleration}
                </span>
              </label>
              <input
                type="range"
                min={500}
                max={6000}
                step={100}
                value={physics.maxAcceleration}
                onChange={(e) => updatePhysics('maxAcceleration', parseInt(e.target.value))}
                className="accel-slider"
                style={{
                  background: `linear-gradient(to right, #22c55e 0%, ${riskLevel.color} ${(physics.maxAcceleration / 6000) * 100}%, #1a1a2e ${(physics.maxAcceleration / 6000) * 100}%)`
                }}
              />
              <div className="slider-marks">
                <span>500</span>
                <span>Rec: {MOTOR_TYPE_INFO[physics.motorType].recommendedAccel}</span>
                <span>6000</span>
              </div>
            </div>
            
            {/* Max Velocity Slider */}
            <div className="slider-group">
              <label className="slider-label">
                Max Velocity
                <span className="slider-value">{physics.maxVelocity}</span>
              </label>
              <input
                type="range"
                min={100}
                max={1200}
                step={50}
                value={physics.maxVelocity}
                onChange={(e) => updatePhysics('maxVelocity', parseInt(e.target.value))}
                className="velocity-slider"
              />
            </div>
            
            {/* Safety Cap Toggle */}
            <div className="toggle-row">
              <label className="toggle-label">
                <Shield size={16} className={physics.safetyCap ? 'active' : ''} />
                Safety Cap
              </label>
              <button
                className={`toggle-btn ${physics.safetyCap ? 'on' : 'off'}`}
                onClick={() => updatePhysics('safetyCap', !physics.safetyCap)}
              >
                {physics.safetyCap ? 'ON' : 'OFF'}
              </button>
              <span className="toggle-hint">
                {physics.safetyCap ? 'Protection active' : '⚠️ No protection'}
              </span>
            </div>
            
            {/* Stress Test Button */}
            <button
              className={`stress-test-btn ${isStressTesting ? 'testing' : ''}`}
              onClick={handleStressTest}
              disabled={isStressTesting}
            >
              <Zap size={18} />
              {isStressTesting ? 'TESTING...' : 'STRESS TEST'}
            </button>
          </div>
        )}
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ORIENTATION & LIMITS SECTION */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="tuner-section">
        <button 
          className="section-header"
          onClick={() => toggleSection('limits')}
        >
          <RotateCcw size={18} />
          <span>Orientation & Limits</span>
          <ChevronDown 
            size={16} 
            className={expandedSection === 'limits' ? 'expanded' : ''} 
          />
        </button>
        
        {expandedSection === 'limits' && (
          <div className="section-content">
            {/* Installation Orientation */}
            <div className="select-group">
              <label>Installation</label>
              <select
                value={physics.orientation}
                onChange={(e) => updatePhysics('orientation', e.target.value as InstallationOrientation)}
                className="physics-select"
              >
                {ORIENTATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Invert toggles */}
            {/* 🛡️ WAVE 2093.2 (CW-AUDIT-4): invertPan/Tilt DEPRECATED here.
                The real master is FixtureV2.calibration.panInvert/tiltInvert,
                managed by CalibrationView. Shown as read-only reference. */}
            <div className="invert-grid">
              <div className="toggle-row compact" style={{ opacity: 0.5 }}>
                <label>Invert Pan <span style={{ fontSize: '9px', color: '#94a3b8' }}>(→ Calibration)</span></label>
                <button
                  className={`toggle-btn small ${physics.invertPan ? 'on' : 'off'}`}
                  onClick={() => updatePhysics('invertPan', !physics.invertPan)}
                  title="⚠️ Deprecated: Use CalibrationView for invert settings. Changes here sync to calibration."
                >
                  {physics.invertPan ? 'YES' : 'NO'}
                </button>
              </div>
              
              <div className="toggle-row compact" style={{ opacity: 0.5 }}>
                <label>Invert Tilt <span style={{ fontSize: '9px', color: '#94a3b8' }}>(→ Calibration)</span></label>
                <button
                  className={`toggle-btn small ${physics.invertTilt ? 'on' : 'off'}`}
                  onClick={() => updatePhysics('invertTilt', !physics.invertTilt)}
                  title="⚠️ Deprecated: Use CalibrationView for invert settings. Changes here sync to calibration."
                >
                  {physics.invertTilt ? 'YES' : 'NO'}
                </button>
              </div>
              
              <div className="toggle-row compact">
                <label>Swap Pan/Tilt</label>
                <button
                  className={`toggle-btn small ${physics.swapPanTilt ? 'on' : 'off'}`}
                  onClick={() => updatePhysics('swapPanTilt', !physics.swapPanTilt)}
                >
                  {physics.swapPanTilt ? 'YES' : 'NO'}
                </button>
              </div>
            </div>
            
            {/* Tilt Limits */}
            <div className="limits-group">
              <label>Tilt Limits (avoid pointing at audience)</label>
              <div className="dual-slider">
                <div className="mini-slider">
                  <span>Min</span>
                  <input
                    type="number"
                    min={0}
                    max={127}
                    value={physics.tiltLimits.min}
                    onChange={(e) => updatePhysics('tiltLimits', {
                      ...physics.tiltLimits,
                      min: parseInt(e.target.value) || 0
                    })}
                  />
                </div>
                <div className="limits-bar">
                  <div 
                    className="limits-active"
                    style={{
                      left: `${(physics.tiltLimits.min / 255) * 100}%`,
                      width: `${((physics.tiltLimits.max - physics.tiltLimits.min) / 255) * 100}%`
                    }}
                  />
                </div>
                <div className="mini-slider">
                  <span>Max</span>
                  <input
                    type="number"
                    min={128}
                    max={255}
                    value={physics.tiltLimits.max}
                    onChange={(e) => updatePhysics('tiltLimits', {
                      ...physics.tiltLimits,
                      max: parseInt(e.target.value) || 255
                    })}
                  />
                </div>
              </div>
            </div>
            
            {/* Home Position */}
            <div className="home-position">
              <label>Home Position (Rest)</label>
              <div className="home-inputs">
                <div className="home-input">
                  <span>Pan</span>
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={physics.homePosition.pan}
                    onChange={(e) => updatePhysics('homePosition', {
                      ...physics.homePosition,
                      pan: parseInt(e.target.value) || 127
                    })}
                  />
                </div>
                <div className="home-input">
                  <span>Tilt</span>
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={physics.homePosition.tilt}
                    onChange={(e) => updatePhysics('homePosition', {
                      ...physics.homePosition,
                      tilt: parseInt(e.target.value) || 127
                    })}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Reset Button */}
      <button className="reset-btn" onClick={handleReset}>
        <RotateCcw size={14} />
        Reset to Defaults
      </button>
    </div>
  )
}

export default PhysicsTuner
