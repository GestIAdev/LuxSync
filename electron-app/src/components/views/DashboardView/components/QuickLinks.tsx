/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🚀 QUICK LINKS - WAVE 424: Dashboard Navigation Cards
 * Cards para acceso rápido a los otros Stages
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react'
import { useNavigationStore } from '../../../../stores/navigationStore'
import { IconLiveStage, IconCalibration, IconLuxCore } from '../../../layout/NavigationIcons'
import './QuickLinks.css'

interface QuickLinkCardProps {
  title: string
  description: string
  icon: React.ReactNode
  color: string
  onClick: () => void
}

const QuickLinkCard: React.FC<QuickLinkCardProps> = ({ 
  title, 
  description, 
  icon, 
  color,
  onClick 
}) => (
  <button 
    className="quick-link-card"
    onClick={onClick}
    style={{ '--card-color': color } as React.CSSProperties}
  >
    <div className="quick-link-icon">
      {icon}
    </div>
    <div className="quick-link-content">
      <h3 className="quick-link-title">{title}</h3>
      <p className="quick-link-desc">{description}</p>
    </div>
    <div className="quick-link-arrow">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 12H19M19 12L12 5M19 12L12 19" />
      </svg>
    </div>
    <div className="quick-link-glow" />
  </button>
)

export const QuickLinks: React.FC = () => {
  const { setActiveTab } = useNavigationStore()

  return (
    <div className="quick-links-container">
      <div className="quick-links-header">
        <span className="quick-links-label">QUICK ACCESS</span>
        <div className="quick-links-divider" />
      </div>
      
      <div className="quick-links-grid">
        <QuickLinkCard
          title="LIVE SHOW"
          description="Start the performance"
          icon={<IconLiveStage size={28} />}
          color="#ff00ff"
          onClick={() => setActiveTab('live')}
        />
        
        <QuickLinkCard
          title="CALIBRATE"
          description="Align fixtures before show"
          icon={<IconCalibration size={28} />}
          color="#22d3ee"
          onClick={() => setActiveTab('calibration')}
        />
        
        <QuickLinkCard
          title="LUX CORE"
          description="Monitor Selene AI"
          icon={<IconLuxCore size={28} />}
          color="#f59e0b"
          onClick={() => setActiveTab('core')}
        />
      </div>
    </div>
  )
}

export default QuickLinks
