/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 LUXSYNC NAVIGATION ICONS - WAVE 428
 * Custom SVG icons for Sidebar navigation
 * Style: Cyberpunk/HUD aesthetic - angular, military, high-tech
 * 
 * WAVE 428: Added IconConstruct + IconSetup for full 6-tab system
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

/**
 * 🔧 CONSTRUCTOR / Build Icon
 * Fixture creation - wrench + fixture light
 */
export const IconConstruct: React.FC<IconProps> = ({ size = 20, className = '' }) => (
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
    {/* Fixture body */}
    <rect x="8" y="4" width="8" height="6" rx="1" stroke="currentColor" />
    <path d="M10 10V14" stroke="currentColor" />
    <path d="M14 10V14" stroke="currentColor" />
    
    {/* Light beam */}
    <path d="M8 14L5 20" stroke="currentColor" opacity="0.4" />
    <path d="M12 14V20" stroke="currentColor" opacity="0.5" />
    <path d="M16 14L19 20" stroke="currentColor" opacity="0.4" />
    
    {/* Wrench overlay - small */}
    <circle cx="18" cy="8" r="2" stroke="currentColor" />
    <path d="M16.5 9.5L14 12" stroke="currentColor" />
    
    {/* Plus sign - add new */}
    <path d="M4 4V7" stroke="currentColor" opacity="0.6" />
    <path d="M2.5 5.5H5.5" stroke="currentColor" opacity="0.6" />
  </svg>
)

/**
 * ⚙️ SETUP / Configuration Icon
 * Audio + DMX config - gear with signals
 */
export const IconSetup: React.FC<IconProps> = ({ size = 20, className = '' }) => (
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
    {/* Central gear */}
    <circle cx="12" cy="12" r="3" stroke="currentColor" />
    <circle cx="12" cy="12" r="1" stroke="currentColor" fill="currentColor" opacity="0.5" />
    
    {/* Gear teeth */}
    <path d="M12 2V5" stroke="currentColor" />
    <path d="M12 19V22" stroke="currentColor" />
    <path d="M2 12H5" stroke="currentColor" />
    <path d="M19 12H22" stroke="currentColor" />
    <path d="M4.93 4.93L7.05 7.05" stroke="currentColor" opacity="0.6" />
    <path d="M16.95 16.95L19.07 19.07" stroke="currentColor" opacity="0.6" />
    <path d="M4.93 19.07L7.05 16.95" stroke="currentColor" opacity="0.6" />
    <path d="M16.95 7.05L19.07 4.93" stroke="currentColor" opacity="0.6" />
    
    {/* Audio wave hints */}
    <path d="M7 9C6 10 6 14 7 15" stroke="currentColor" opacity="0.4" />
    <path d="M17 9C18 10 18 14 17 15" stroke="currentColor" opacity="0.4" />
  </svg>
)

/**
 * 🔨 FORGE / Fixture Creation Icon - WAVE 1110
 * Hammer + Anvil - The Blacksmith aesthetic
 * Industrial cyberpunk styling
 */
export const IconForge: React.FC<IconProps> = ({ size = 20, className = '' }) => (
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
    {/* Hammer head */}
    <rect x="13" y="3" width="7" height="5" rx="1" stroke="currentColor" />
    <path d="M15 5H18" stroke="currentColor" opacity="0.5" />
    
    {/* Hammer handle */}
    <path d="M13 5.5L6 12.5" stroke="currentColor" strokeWidth="2" />
    
    {/* Anvil body */}
    <path d="M4 16H20L18 21H6L4 16Z" stroke="currentColor" />
    <path d="M8 16V14H16V16" stroke="currentColor" />
    
    {/* Anvil surface highlight */}
    <path d="M10 14H14" stroke="currentColor" opacity="0.6" />
    
    {/* Sparks - forging action */}
    <circle cx="9" cy="11" r="0.8" stroke="currentColor" fill="currentColor" opacity="0.7" />
    <circle cx="7" cy="9" r="0.5" stroke="currentColor" fill="currentColor" opacity="0.5" />
    <circle cx="11" cy="9" r="0.6" stroke="currentColor" fill="currentColor" opacity="0.6" />
    
    {/* Heat glow under anvil */}
    <path d="M8 21V22" stroke="currentColor" opacity="0.3" />
    <path d="M12 21V23" stroke="currentColor" opacity="0.4" />
    <path d="M16 21V22" stroke="currentColor" opacity="0.3" />
  </svg>
)

/**
 * ⏱️ CHRONOS / Timeline Editor Icon - WAVE 2004
 * Clock with timeline tracks - temporal editing aesthetic
 */
export const IconChronos: React.FC<IconProps> = ({ size = 20, className = '' }) => (
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
    {/* Central clock core */}
    <circle cx="12" cy="12" r="8" stroke="currentColor" />
    <circle cx="12" cy="12" r="2" stroke="currentColor" fill="currentColor" opacity="0.4" />
    
    {/* Clock hands - frozen at "performance time" */}
    <path d="M12 12L12 7" stroke="currentColor" strokeWidth="2" />
    <path d="M12 12L15 14" stroke="currentColor" strokeWidth="1.5" />
    
    {/* Timeline tracks emanating outward */}
    <path d="M4 5H2" stroke="currentColor" opacity="0.6" />
    <path d="M4 7H1" stroke="currentColor" opacity="0.4" />
    <path d="M4 9H2" stroke="currentColor" opacity="0.6" />
    
    <path d="M20 5H22" stroke="currentColor" opacity="0.6" />
    <path d="M20 7H23" stroke="currentColor" opacity="0.4" />
    <path d="M20 9H22" stroke="currentColor" opacity="0.6" />
    
    {/* Tick marks on clock face */}
    <path d="M12 4.5V5.5" stroke="currentColor" opacity="0.5" />
    <path d="M19 12H18" stroke="currentColor" opacity="0.5" />
    <path d="M12 18.5V19.5" stroke="currentColor" opacity="0.5" />
    <path d="M5 12H6" stroke="currentColor" opacity="0.5" />
    
    {/* Corner HUD frame - studio feel */}
    <path d="M1 2H3V4" stroke="currentColor" opacity="0.3" />
    <path d="M23 2H21V4" stroke="currentColor" opacity="0.3" />
    <path d="M1 22H3V20" stroke="currentColor" opacity="0.3" />
    <path d="M23 22H21V20" stroke="currentColor" opacity="0.3" />
  </svg>
)

/**
 * ⚒️ HEPHAESTUS / FX Curve Automation Icon - WAVE 2030.3
 * Anvil silhouette with bezier curve overlay — The God Forge
 * Industrial cyberpunk: sharp angles, neon curves, forge heat
 */
export const IconHephaestus: React.FC<IconProps> = ({ size = 20, className = '' }) => (
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
    {/* Anvil body — industrial base */}
    <path d="M4 17H20L18 21H6L4 17Z" stroke="currentColor" />
    <path d="M8 17V15H16V17" stroke="currentColor" />
    <path d="M10 15H14" stroke="currentColor" opacity="0.6" />

    {/* Bezier automation curve — the soul of Hephaestus */}
    <path
      d="M3 13C3 13 7 3 12 8C17 13 21 3 21 3"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
    />

    {/* Keyframe nodes on curve */}
    <circle cx="3" cy="13" r="1.2" stroke="currentColor" fill="currentColor" opacity="0.8" />
    <circle cx="12" cy="8" r="1.2" stroke="currentColor" fill="currentColor" opacity="0.8" />
    <circle cx="21" cy="3" r="1.2" stroke="currentColor" fill="currentColor" opacity="0.8" />

    {/* Bezier handle whiskers */}
    <path d="M3 13L7 5" stroke="currentColor" opacity="0.3" strokeWidth="1" />
    <path d="M21 3L17 11" stroke="currentColor" opacity="0.3" strokeWidth="1" />

    {/* Forge heat glow beneath anvil */}
    <path d="M9 21V22.5" stroke="currentColor" opacity="0.3" />
    <path d="M12 21V23" stroke="currentColor" opacity="0.4" />
    <path d="M15 21V22.5" stroke="currentColor" opacity="0.3" />
  </svg>
)

export default {
  IconDashboard,
  IconLiveStage,
  IconCalibration,
  IconLuxCore,
  IconConstruct,
  IconSetup,
  IconForge,
  IconChronos,      // WAVE 2004
  IconHephaestus,   // WAVE 2030.3
}
