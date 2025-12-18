/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 HUD ICONS - WAVE 35.1: Custom SVG Iconography
 * Cyberpunk/Sci-Fi style - thin strokes, angular, military HUD aesthetic
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react'

interface IconProps {
  size?: number
  className?: string
}

/**
 * 🎵 Audio Waveform Icon - Spectrum analyzer style
 */
export const IconAudioWave: React.FC<IconProps> = ({ size = 24, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={className}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Spectrum bars */}
    <path d="M3 16V8" stroke="currentColor" />
    <path d="M7 18V6" stroke="currentColor" />
    <path d="M11 20V4" stroke="currentColor" />
    <path d="M15 17V7" stroke="currentColor" />
    <path d="M19 14V10" stroke="currentColor" />
    {/* Corner brackets - HUD style */}
    <path d="M1 5V2H4" stroke="currentColor" opacity="0.4" />
    <path d="M23 5V2H20" stroke="currentColor" opacity="0.4" />
    <path d="M1 19V22H4" stroke="currentColor" opacity="0.4" />
    <path d="M23 19V22H20" stroke="currentColor" opacity="0.4" />
  </svg>
)

/**
 * 🧠 Neural Network / AI Brain Icon
 */
export const IconNeuralBrain: React.FC<IconProps> = ({ size = 24, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={className}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Neural nodes */}
    <circle cx="12" cy="6" r="2" stroke="currentColor" />
    <circle cx="6" cy="12" r="2" stroke="currentColor" />
    <circle cx="18" cy="12" r="2" stroke="currentColor" />
    <circle cx="8" cy="18" r="2" stroke="currentColor" />
    <circle cx="16" cy="18" r="2" stroke="currentColor" />
    {/* Neural connections */}
    <path d="M12 8V10M12 10L8 12M12 10L16 12" stroke="currentColor" opacity="0.6" />
    <path d="M7 14L8 16M17 14L16 16" stroke="currentColor" opacity="0.6" />
    <path d="M10 18H14" stroke="currentColor" opacity="0.6" />
    {/* Core glow */}
    <circle cx="12" cy="12" r="1" stroke="currentColor" fill="currentColor" opacity="0.5" />
  </svg>
)

/**
 * ❤️ BPM Pulse / Heartbeat Icon
 */
export const IconBpmPulse: React.FC<IconProps> = ({ size = 24, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={className}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Pulse line */}
    <path 
      d="M2 12H6L8 8L10 16L12 10L14 14L16 12H22" 
      stroke="currentColor" 
    />
    {/* Corner markers */}
    <path d="M1 8V4H5" stroke="currentColor" opacity="0.3" />
    <path d="M23 8V4H19" stroke="currentColor" opacity="0.3" />
    <path d="M1 16V20H5" stroke="currentColor" opacity="0.3" />
    <path d="M23 16V20H19" stroke="currentColor" opacity="0.3" />
  </svg>
)

/**
 * ⚡ DMX / Lightning Bolt Icon
 */
export const IconDmxBolt: React.FC<IconProps> = ({ size = 24, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={className}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Lightning bolt */}
    <path 
      d="M13 2L4 14H11L10 22L20 10H13L13 2Z" 
      stroke="currentColor"
    />
    {/* Data points */}
    <circle cx="4" cy="6" r="1" stroke="currentColor" opacity="0.4" />
    <circle cx="20" cy="18" r="1" stroke="currentColor" opacity="0.4" />
  </svg>
)

/**
 * 💡 Fixture / Stage Light Icon
 */
export const IconFixture: React.FC<IconProps> = ({ size = 24, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={className}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Light head */}
    <path d="M8 4H16L18 10H6L8 4Z" stroke="currentColor" />
    {/* Mount */}
    <path d="M11 10V14H13V10" stroke="currentColor" />
    <path d="M9 14H15V16H9V14Z" stroke="currentColor" />
    {/* Light beams */}
    <path d="M7 18L5 22" stroke="currentColor" opacity="0.4" />
    <path d="M12 18V22" stroke="currentColor" opacity="0.4" />
    <path d="M17 18L19 22" stroke="currentColor" opacity="0.4" />
  </svg>
)

/**
 * 📊 FPS / Performance Gauge Icon
 */
export const IconFpsGauge: React.FC<IconProps> = ({ size = 24, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={className}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Gauge arc */}
    <path 
      d="M4 18C4 14.6863 4 12 4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12C20 12 20 14.6863 20 18" 
      stroke="currentColor" 
    />
    {/* Needle */}
    <path d="M12 12L16 8" stroke="currentColor" />
    <circle cx="12" cy="12" r="2" stroke="currentColor" />
    {/* Tick marks */}
    <path d="M6 10L7 11" stroke="currentColor" opacity="0.4" />
    <path d="M12 6V7" stroke="currentColor" opacity="0.4" />
    <path d="M18 10L17 11" stroke="currentColor" opacity="0.4" />
    {/* Base */}
    <path d="M6 20H18" stroke="currentColor" opacity="0.5" />
  </svg>
)

/**
 * 📶 Audio Level / Signal Icon
 */
export const IconAudioLevel: React.FC<IconProps> = ({ size = 24, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={className}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Level bars */}
    <path d="M4 18V14" stroke="currentColor" />
    <path d="M8 18V10" stroke="currentColor" />
    <path d="M12 18V6" stroke="currentColor" />
    <path d="M16 18V8" stroke="currentColor" />
    <path d="M20 18V12" stroke="currentColor" />
    {/* Peak indicator */}
    <circle cx="12" cy="4" r="1" stroke="currentColor" fill="currentColor" opacity="0.6" />
    {/* Base line */}
    <path d="M2 20H22" stroke="currentColor" opacity="0.3" />
  </svg>
)

/**
 * 🕐 Uptime / Clock Icon
 */
export const IconUptime: React.FC<IconProps> = ({ size = 24, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={className}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Outer ring */}
    <circle cx="12" cy="12" r="9" stroke="currentColor" />
    {/* Clock hands */}
    <path d="M12 7V12L15 14" stroke="currentColor" />
    {/* Inner markers */}
    <path d="M12 4V5" stroke="currentColor" opacity="0.5" />
    <path d="M12 19V20" stroke="currentColor" opacity="0.5" />
    <path d="M4 12H5" stroke="currentColor" opacity="0.5" />
    <path d="M19 12H20" stroke="currentColor" opacity="0.5" />
    {/* Corner accents */}
    <path d="M5 5L6 6" stroke="currentColor" opacity="0.3" />
    <path d="M19 5L18 6" stroke="currentColor" opacity="0.3" />
  </svg>
)

/**
 * 🔌 Connection / Plug Icon
 */
export const IconConnection: React.FC<IconProps> = ({ size = 24, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={className}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Plug prongs */}
    <path d="M8 3V7" stroke="currentColor" />
    <path d="M16 3V7" stroke="currentColor" />
    {/* Body */}
    <path d="M6 7H18V12C18 15.3137 15.3137 18 12 18C8.68629 18 6 15.3137 6 12V7Z" stroke="currentColor" />
    {/* Cord */}
    <path d="M12 18V21" stroke="currentColor" />
    {/* Power indicator */}
    <circle cx="12" cy="12" r="2" stroke="currentColor" opacity="0.6" />
  </svg>
)

export default {
  IconAudioWave,
  IconNeuralBrain,
  IconBpmPulse,
  IconDmxBolt,
  IconFixture,
  IconFpsGauge,
  IconAudioLevel,
  IconUptime,
  IconConnection
}
