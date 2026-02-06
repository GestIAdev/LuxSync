/**
 * 🚀 LAUNCHPAD - WAVE 1199: 5 COMPACT CARDS
 * "Stage Access Panel" — Rapid navigation to every stage
 * 
 * Layout: 2-column grid, ~80px cards
 * Cards: LIVE STAGE (primary/span2), NEURAL COMMAND, SHOW CONSTRUCTOR,
 *        FIXTURE FORGE, CALIBRATION
 * 
 * 0 iconos genéricos. Solo LuxIcons custom.
 * Color: Cyberpunk Cyan (#22d3ee) unified.
 */

import React, { useCallback } from 'react'
import { useNavigationStore } from '../../../../stores/navigationStore'
import { 
  PlayCircleIcon, 
  BrainNeuralIcon, 
  HammerIcon, 
  MovingHeadIcon, 
  TargetIcon 
} from '../../../icons/LuxIcons'
import './Launchpad.css'

interface LaunchCardProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  isPrimary?: boolean
  onClick: () => void
}

const LaunchCard: React.FC<LaunchCardProps> = ({
  title,
  subtitle,
  icon,
  isPrimary = false,
  onClick
}) => (
  <button
    className={`launch-card ${isPrimary ? 'primary' : ''}`}
    onClick={onClick}
  >
    <div className="launch-icon">
      {icon}
    </div>
    <div className="launch-content">
      <h3 className="launch-title">{title}</h3>
      <p className="launch-subtitle">{subtitle}</p>
    </div>
    <div className="launch-arrow">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M5 12H19M19 12L12 5M19 12L12 19" />
      </svg>
    </div>
    <div className="launch-glow" />
  </button>
)

export const Launchpad: React.FC = () => {
  const { setActiveTab } = useNavigationStore()
  
  const handleLive = useCallback(() => setActiveTab('live'), [setActiveTab])
  const handleNeural = useCallback(() => setActiveTab('core'), [setActiveTab])
  const handleConstruct = useCallback(() => setActiveTab('constructor'), [setActiveTab])
  const handleForge = useCallback(() => setActiveTab('forge'), [setActiveTab])
  const handleCalibrate = useCallback(() => setActiveTab('calibration'), [setActiveTab])
  
  return (
    <div className="launchpad">
      <div className="launchpad-header">
        <span className="launchpad-label">LAUNCHPAD</span>
      </div>
      
      <div className="launchpad-grid">
        {/* LIVE STAGE — Primary, spans full width */}
        <LaunchCard
          title="LIVE STAGE"
          subtitle="Launch the performance"
          icon={<PlayCircleIcon size={28} color="#22d3ee" />}
          isPrimary={true}
          onClick={handleLive}
        />
        
        {/* NEURAL COMMAND */}
        <LaunchCard
          title="NEURAL COMMAND"
          subtitle="AI consciousness"
          icon={<BrainNeuralIcon size={24} color="#22d3ee" />}
          onClick={handleNeural}
        />
        
        {/* SHOW CONSTRUCTOR */}
        <LaunchCard
          title="CONSTRUCTOR"
          subtitle="Build your rig"
          icon={<HammerIcon size={24} color="#22d3ee" />}
          onClick={handleConstruct}
        />
        
        {/* FIXTURE FORGE */}
        <LaunchCard
          title="FIXTURE FORGE"
          subtitle="Define fixtures"
          icon={<MovingHeadIcon size={24} color="#22d3ee" />}
          onClick={handleForge}
        />
        
        {/* CALIBRATION */}
        <LaunchCard
          title="CALIBRATION"
          subtitle="Align hardware"
          icon={<TargetIcon size={24} color="#22d3ee" />}
          onClick={handleCalibrate}
        />
      </div>
    </div>
  )
}

export default Launchpad
