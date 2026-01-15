/**
 * 🚀 LAUNCHPAD - WAVE 437
 * "Stage Access Panel"
 * 
 * Large clickable cards for quick navigation to main stages
 * 
 * Layout: 3 Big Cards in row
 * - LIVE SHOW (primary, largest)
 * - CALIBRATE
 * - CONSTRUCT
 */

import React, { useCallback } from 'react'
import { useNavigationStore } from '../../../../stores/navigationStore'
import { PlayCircleIcon, TargetIcon, HammerIcon } from '../../../icons/LuxIcons'
import './Launchpad.css'

interface LaunchCardProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  color: string
  glowColor: string
  isPrimary?: boolean
  onClick: () => void
}

const LaunchCard: React.FC<LaunchCardProps> = ({
  title,
  subtitle,
  icon,
  color,
  glowColor,
  isPrimary = false,
  onClick
}) => (
  <button
    className={`launch-card ${isPrimary ? 'primary' : ''}`}
    onClick={onClick}
    style={{ 
      '--card-color': color,
      '--card-glow': glowColor 
    } as React.CSSProperties}
  >
    <div className="launch-icon">
      {icon}
    </div>
    <div className="launch-content">
      <h3 className="launch-title">{title}</h3>
      <p className="launch-subtitle">{subtitle}</p>
    </div>
    <div className="launch-arrow">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M5 12H19M19 12L12 5M19 12L12 19" />
      </svg>
    </div>
    
    {/* Glow effects */}
    <div className="launch-glow" />
    <div className="launch-border-glow" />
  </button>
)

export const Launchpad: React.FC = () => {
  const { setActiveTab } = useNavigationStore()
  
  const handleLive = useCallback(() => {
    setActiveTab('live')
  }, [setActiveTab])
  
  const handleCalibrate = useCallback(() => {
    setActiveTab('calibration')
  }, [setActiveTab])
  
  const handleConstruct = useCallback(() => {
    setActiveTab('constructor')
  }, [setActiveTab])
  
  return (
    <div className="launchpad">
      <div className="launchpad-header">
        <span className="launchpad-icon">🚀</span>
        <span className="launchpad-label">LAUNCHPAD</span>
      </div>
      
      <div className="launchpad-grid">
        {/* LIVE SHOW - Primary/Largest */}
        <LaunchCard
          title="LIVE SHOW"
          subtitle="Start the performance"
          icon={<PlayCircleIcon size={36} />}
          color="#ff00ff"
          glowColor="rgba(255, 0, 255, 0.3)"
          isPrimary={true}
          onClick={handleLive}
        />
        
        {/* CALIBRATE */}
        <LaunchCard
          title="CALIBRATE"
          subtitle="Align fixtures"
          icon={<TargetIcon size={32} />}
          color="#00ffff"
          glowColor="rgba(0, 255, 255, 0.3)"
          onClick={handleCalibrate}
        />
        
        {/* CONSTRUCT */}
        <LaunchCard
          title="CONSTRUCT"
          subtitle="Build your rig"
          icon={<HammerIcon size={32} />}
          color="#f59e0b"
          glowColor="rgba(245, 158, 11, 0.3)"
          onClick={handleConstruct}
        />
      </div>
    </div>
  )
}

export default Launchpad
