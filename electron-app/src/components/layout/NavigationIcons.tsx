/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 LUXSYNC NAVIGATION ICONS - WAVE 423
 * Custom SVG icons for Sidebar navigation
 * Style: Cyberpunk/HUD aesthetic - angular, military, high-tech
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react'

interface IconProps {
  size?: number
  className?: string
}

/**
 * ⚡ DASHBOARD / Command Center Icon
 * Military command console - angular, powerful
 */
export const IconDashboard: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={className}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Central lightning bolt */}
    <path 
      d="M13 2L4 14H11L10 22L20 10H13L13 2Z" 
      stroke="currentColor"
    />
    {/* HUD frame corners */}
    <path d="M2 4V1H5" stroke="currentColor" opacity="0.4" />
    <path d="M22 4V1H19" stroke="currentColor" opacity="0.4" />
    <path d="M2 20V23H5" stroke="currentColor" opacity="0.4" />
    <path d="M22 20V23H19" stroke="currentColor" opacity="0.4" />
  </svg>
)

/**
 * 🎭 LIVE / Performance Stage Icon
 * Stage with spotlights - showtime aesthetic
 */
export const IconLiveStage: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={className}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Stage platform */}
    <path d="M2 18H22V20H2V18Z" stroke="currentColor" />
    
    {/* Left spotlight */}
    <path d="M5 8H7L8 12H4L5 8Z" stroke="currentColor" />
    <path d="M6 12V16" stroke="currentColor" />
    <path d="M3 16L2 20" stroke="currentColor" opacity="0.4" />
    <path d="M6 16V20" stroke="currentColor" opacity="0.4" />
    <path d="M9 16L10 20" stroke="currentColor" opacity="0.4" />
    
    {/* Right spotlight */}
    <path d="M17 8H19L20 12H16L17 8Z" stroke="currentColor" />
    <path d="M18 12V16" stroke="currentColor" />
    <path d="M15 16L14 20" stroke="currentColor" opacity="0.4" />
    <path d="M18 16V20" stroke="currentColor" opacity="0.4" />
    <path d="M21 16L22 20" stroke="currentColor" opacity="0.4" />
    
    {/* Top beam cross */}
    <path d="M3 8H21" stroke="currentColor" opacity="0.3" />
    
    {/* Targeting reticle center */}
    <circle cx="12" cy="4" r="2" stroke="currentColor" />
    <path d="M12 2V3" stroke="currentColor" opacity="0.5" />
    <path d="M10 4H11" stroke="currentColor" opacity="0.5" />
    <path d="M13 4H14" stroke="currentColor" opacity="0.5" />
  </svg>
)

/**
 * 🎯 CALIBRATION / Hardware Setup Icon  
 * Targeting crosshair + precision grid
 */
export const IconCalibration: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={className}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Central targeting crosshair */}
    <circle cx="12" cy="12" r="6" stroke="currentColor" />
    <circle cx="12" cy="12" r="2" stroke="currentColor" />
    
    {/* Cross lines */}
    <path d="M12 2V6" stroke="currentColor" />
    <path d="M12 18V22" stroke="currentColor" />
    <path d="M2 12H6" stroke="currentColor" />
    <path d="M18 12H22" stroke="currentColor" />
    
    {/* Corner brackets - precision frame */}
    <path d="M4 6V4H6" stroke="currentColor" opacity="0.5" />
    <path d="M20 6V4H18" stroke="currentColor" opacity="0.5" />
    <path d="M4 18V20H6" stroke="currentColor" opacity="0.5" />
    <path d="M20 18V20H18" stroke="currentColor" opacity="0.5" />
    
    {/* Tick marks on circle */}
    <circle cx="12" cy="6" r="0.5" stroke="currentColor" fill="currentColor" opacity="0.6" />
    <circle cx="12" cy="18" r="0.5" stroke="currentColor" fill="currentColor" opacity="0.6" />
    <circle cx="6" cy="12" r="0.5" stroke="currentColor" fill="currentColor" opacity="0.6" />
    <circle cx="18" cy="12" r="0.5" stroke="currentColor" fill="currentColor" opacity="0.6" />
  </svg>
)

/**
 * 🧠 LUX CORE / AI Monitoring Icon
 * Neural network with data flow
 */
export const IconLuxCore: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={className}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Central core */}
    <circle cx="12" cy="12" r="3" stroke="currentColor" />
    <circle cx="12" cy="12" r="1" stroke="currentColor" fill="currentColor" opacity="0.6" />
    
    {/* Neural nodes - top */}
    <circle cx="12" cy="4" r="1.5" stroke="currentColor" />
    <path d="M12 5.5V9" stroke="currentColor" opacity="0.5" />
    
    {/* Neural nodes - bottom */}
    <circle cx="12" cy="20" r="1.5" stroke="currentColor" />
    <path d="M12 15V18.5" stroke="currentColor" opacity="0.5" />
    
    {/* Neural nodes - left */}
    <circle cx="4" cy="12" r="1.5" stroke="currentColor" />
    <path d="M5.5 12H9" stroke="currentColor" opacity="0.5" />
    
    {/* Neural nodes - right */}
    <circle cx="20" cy="12" r="1.5" stroke="currentColor" />
    <path d="M15 12H18.5" stroke="currentColor" opacity="0.5" />
    
    {/* Diagonal connections */}
    <circle cx="6" cy="6" r="1" stroke="currentColor" />
    <circle cx="18" cy="6" r="1" stroke="currentColor" />
    <circle cx="6" cy="18" r="1" stroke="currentColor" />
    <circle cx="18" cy="18" r="1" stroke="currentColor" />
    
    <path d="M7 7L10 10" stroke="currentColor" opacity="0.3" />
    <path d="M17 7L14 10" stroke="currentColor" opacity="0.3" />
    <path d="M7 17L10 14" stroke="currentColor" opacity="0.3" />
    <path d="M17 17L14 14" stroke="currentColor" opacity="0.3" />
  </svg>
)

export default {
  IconDashboard,
  IconLiveStage,
  IconCalibration,
  IconLuxCore
}
