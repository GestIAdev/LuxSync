/**
 * 🚀 LAUNCHPAD - WAVE 1200: COLOR-CODED CARDS
 * "Stage Access Panel" — Rapid navigation to every stage
 * 
 * Layout: 2-column grid, ~80px cards
 * Cards: LIVE STAGE (cyan), NEURAL COMMAND (purple), SHOW CONSTRUCTOR (orange),
 *        FIXTURE FORGE (yellow), CALIBRATION (blue)
 * 
 * 0 iconos genéricos. Solo LuxIcons custom.
 * Each card has its identity color!
 */

import React, { useCallback } from 'react'
import { useNavigationStore } from '../../../../stores/navigationStore'
import { 
  PlayCircleIcon, 
  BrainNeuralIcon, 
  HammerIcon, 
  MovingHeadIcon, 
  TargetIcon,
  BoltIcon 
} from '../../../icons/LuxIcons'
import './Launchpad.css'

// WAVE 1200: Color palette per card
const CARD_COLORS = {
  live: '#22d3ee',       // Cyberpunk Cyan
  neural: '#a855f7',     // Purple
  construct: '#f97316',  // Orange
  forge: '#fbbf24',      // Yellow/Gold
  calibrate: '#3b82f6',  // Blue
} as const

interface LaunchCardProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  colorClass: string
  isPrimary?: boolean
  onClick: () => void
}

const LaunchCard: React.FC<LaunchCardProps> = ({
  title,
  subtitle,
  icon,
  colorClass,
  isPrimary = false,
  onClick
}) => (
  <button
    className={`launch-card ${isPrimary ? 'primary' : ''} ${colorClass}`}
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
      {/* WAVE 1206: ICONIC HIERARCHY - Purple BoltIcon */}
      <div className="launchpad-header">
        <BoltIcon size={16} color="#a855f7" />
        <span className="launchpad-label">LAUNCHPAD</span>
      </div>
      
      <div className="launchpad-grid">
        {/* LIVE STAGE — Primary, cyan */}
        <LaunchCard
          title="LIVE STAGE"
          subtitle="Launch the performance"
          icon={<PlayCircleIcon size={28} color={CARD_COLORS.live} />}
          colorClass="card-live"
          isPrimary={true}
          onClick={handleLive}
        />
        
        {/* NEURAL COMMAND — Purple */}
        <LaunchCard
          title="NEURAL COMMAND"
          subtitle="AI consciousness"
          icon={<BrainNeuralIcon size={24} color={CARD_COLORS.neural} />}
          colorClass="card-neural"
          onClick={handleNeural}
        />
        
        {/* SHOW CONSTRUCTOR — Orange */}
        <LaunchCard
          title="CONSTRUCTOR"
          subtitle="Build your rig"
          icon={<HammerIcon size={24} color={CARD_COLORS.construct} />}
          colorClass="card-construct"
          onClick={handleConstruct}
        />
        
        {/* FIXTURE FORGE — Yellow */}
        <LaunchCard
          title="FIXTURE FORGE"
          subtitle="Define fixtures"
          icon={<MovingHeadIcon size={24} color={CARD_COLORS.forge} />}
          colorClass="card-forge"
          onClick={handleForge}
        />
        
        {/* CALIBRATION — Blue */}
        <LaunchCard
          title="CALIBRATION"
          subtitle="Align hardware"
          icon={<TargetIcon size={24} color={CARD_COLORS.calibrate} />}
          colorClass="card-calibrate"
          onClick={handleCalibrate}
        />
      </div>
    </div>
  )
}

export default Launchpad
