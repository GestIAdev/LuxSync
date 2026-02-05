/**
 * 🎨 LUXSYNC CUSTOM ICONS - WAVE 430.10
 * SVG icons con identidad visual propia
 * Estilo: Geométrico, angular, tech, minimalista
 */

import React from 'react'

export interface IconProps {
  size?: number
  color?: string
  className?: string
}

/**
 * 💡 INTENSITY - Slider diagonal con barras de potencia
 */
export const IntensityIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M4 20L4 16M8 20L8 12M12 20L12 8M16 20L16 4M20 20L20 10" 
      stroke={color} 
      strokeWidth="2.5" 
      strokeLinecap="round"
    />
  </svg>
)

/**
 * 🎨 COLOR - Paleta de pintor con gotas RGB
 */
export const ColorIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
    <circle cx="12" cy="8" r="2" fill="#FF0040" />
    <circle cx="8" cy="14" r="2" fill="#00FF80" />
    <circle cx="16" cy="14" r="2" fill="#00A0FF" />
  </svg>
)

/**
 * 🕹️ POSITION - Cruz direccional con centro
 */
export const PositionIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M12 4V10M12 14V20M4 12H10M14 12H20" 
      stroke={color} 
      strokeWidth="2.5" 
      strokeLinecap="round"
    />
    <circle cx="12" cy="12" r="2.5" fill={color} />
  </svg>
)

/**
 * 🔦 BEAM - Cono de luz con rayos
 */
export const BeamIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M12 4L6 20M12 4L18 20M12 4L9 20M12 4L15 20" 
      stroke={color} 
      strokeWidth="1.5" 
      strokeLinecap="round"
      opacity="0.6"
    />
    <rect x="10" y="2" width="4" height="4" rx="1" fill={color} />
  </svg>
)

/**
 * ⚡ STROBE - Relámpago angular
 */
export const StrobeIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M13 2L4 13H12L11 22L20 11H12L13 2Z" 
      fill={color}
    />
  </svg>
)

/**
 * ☀️ BLINDER - Sol con rayos intensos
 */
export const BlinderIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="12" cy="12" r="4" fill={color} />
    <path 
      d="M12 2V6M12 18V22M22 12H18M6 12H2M19.78 4.22L17.66 6.34M6.34 17.66L4.22 19.78M19.78 19.78L17.66 17.66M6.34 6.34L4.22 4.22" 
      stroke={color} 
      strokeWidth="2.5" 
      strokeLinecap="round"
    />
  </svg>
)

/**
 * 💨 SMOKE - Ondas de humo
 */
export const SmokeIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M3 12C3 12 5 8 9 8C13 8 15 12 15 12M6 16C6 16 8 13 11 13C14 13 16 16 16 16M10 20C10 20 12 18 14 18C16 18 18 20 18 20" 
      stroke={color} 
      strokeWidth="2" 
      strokeLinecap="round"
    />
  </svg>
)

/**
 * 🌈 RAINBOW - Arco multicolor
 */
export const RainbowIcon: React.FC<IconProps> = ({ 
  size = 20, 
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M4 18C4 11.37 9.37 6 16 6" stroke="#FF0040" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M6 18C6 12.48 10.48 8 16 8" stroke="#FF9900" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M8 18C8 13.58 11.58 10 16 10" stroke="#FFFF00" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M10 18C10 14.69 12.69 12 16 12" stroke="#00FF80" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M12 18C12 15.79 13.79 14 16 14" stroke="#00A0FF" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
)

/**
 * 🚨 POLICE - Luz giratoria
 */
export const PoliceIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M12 4L8 12H16L12 4Z" fill="#FF0040" />
    <path d="M12 20L16 12H8L12 20Z" fill="#0080FF" />
    <circle cx="12" cy="12" r="2" fill={color} />
  </svg>
)

/**
 * 🔴 LASER - Haz láser con punto focal
 */
export const LaserIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M2 12H22" stroke={color} strokeWidth="3" strokeLinecap="round" />
    <path d="M2 12H22" stroke="#FF0040" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="20" cy="12" r="3" fill="#FF0040" opacity="0.8" />
    <circle cx="20" cy="12" r="1.5" fill="#FFFFFF" />
  </svg>
)

/**
 * 💎 PRISM - Prisma con dispersión
 */
export const PrismIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M12 4L4 20H20L12 4Z" stroke={color} strokeWidth="2" fill="none" />
    <path d="M12 4L8 12" stroke="#FF0040" strokeWidth="1.5" opacity="0.6" />
    <path d="M12 4L12 12" stroke="#00FF80" strokeWidth="1.5" opacity="0.6" />
    <path d="M12 4L16 12" stroke="#00A0FF" strokeWidth="1.5" opacity="0.6" />
  </svg>
)

/**
 * 🎯 GOBO - Rueda de patrones
 */
export const GoboIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
    <path d="M12 3V12L18 18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="12" r="3" fill="none" stroke={color} strokeWidth="1.5" />
  </svg>
)

/**
 * 🔍 FOCUS - Lentes ajustables
 */
export const FocusIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="2" strokeDasharray="4 4" />
    <circle cx="12" cy="12" r="4" stroke={color} strokeWidth="2.5" />
    <path d="M12 2V4M12 20V22M2 12H4M20 12H22" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
)

/**
 * 🔎 ZOOM - Ampliación
 */
export const ZoomIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="10" cy="10" r="7" stroke={color} strokeWidth="2" />
    <path d="M15 15L21 21" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <path d="M10 7V13M7 10H13" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
)

/**
 * 🎚️ IRIS - Diafragma ajustable
 */
export const IrisIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
    <path 
      d="M12 6L15 12L12 18L9 12Z" 
      fill={color} 
      opacity="0.3"
    />
    <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" fill="none" />
  </svg>
)

/**
 * 🎚️ MASTER INTENSITY - Fader grande con corona
 * Para el Grand Master del CommandDeck
 */
export const MasterIntensityIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Corona/Crown - representing master */}
    <path 
      d="M4 8L7 5L12 8L17 5L20 8V10H4V8Z" 
      fill={color}
      opacity="0.4"
    />
    {/* Fader track */}
    <rect x="10" y="10" width="4" height="12" rx="1" stroke={color} strokeWidth="1.5" fill="none" />
    {/* Fader knob */}
    <rect x="9" y="12" width="6" height="4" rx="1" fill={color} />
    {/* Side intensity bars */}
    <path d="M5 22V16M19 22V16" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    <path d="M5 14V12M19 14V12" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.3" />
  </svg>
)

/**
 * 👥 GROUP - Fixtures agrupados
 * Para la pestaña GROUPS de TheProgrammer
 */
export const GroupIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Three fixtures grouped */}
    <rect x="3" y="4" width="6" height="6" rx="1" stroke={color} strokeWidth="2" />
    <rect x="15" y="4" width="6" height="6" rx="1" stroke={color} strokeWidth="2" />
    <rect x="9" y="14" width="6" height="6" rx="1" stroke={color} strokeWidth="2" />
    {/* Connection lines */}
    <path d="M6 10V12L12 14M18 10V12L12 14" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
  </svg>
)

/**
 * 🎬 SCENES - Claqueta de cine / fotogramas
 * Para la pestaña de escenas
 */
export const ScenesIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Film frame */}
    <rect x="3" y="5" width="18" height="14" rx="2" stroke={color} strokeWidth="2" />
    {/* Perforations top */}
    <rect x="5" y="2" width="2" height="3" rx="0.5" fill={color} opacity="0.6" />
    <rect x="11" y="2" width="2" height="3" rx="0.5" fill={color} opacity="0.6" />
    <rect x="17" y="2" width="2" height="3" rx="0.5" fill={color} opacity="0.6" />
    {/* Perforations bottom */}
    <rect x="5" y="19" width="2" height="3" rx="0.5" fill={color} opacity="0.6" />
    <rect x="11" y="19" width="2" height="3" rx="0.5" fill={color} opacity="0.6" />
    <rect x="17" y="19" width="2" height="3" rx="0.5" fill={color} opacity="0.6" />
    {/* Play triangle */}
    <path d="M10 9L10 15L15 12L10 9Z" fill={color} />
  </svg>
)

/**
 * 🎚️ CONTROLS - Sliders/Faders
 * Para la pestaña de controles
 */
export const ControlsIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Fader tracks */}
    <rect x="4" y="3" width="3" height="18" rx="1.5" stroke={color} strokeWidth="1.5" opacity="0.4" />
    <rect x="10.5" y="3" width="3" height="18" rx="1.5" stroke={color} strokeWidth="1.5" opacity="0.4" />
    <rect x="17" y="3" width="3" height="18" rx="1.5" stroke={color} strokeWidth="1.5" opacity="0.4" />
    {/* Fader knobs at different positions */}
    <rect x="3" y="7" width="5" height="4" rx="1" fill={color} />
    <rect x="9.5" y="13" width="5" height="4" rx="1" fill={color} />
    <rect x="16" y="10" width="5" height="4" rx="1" fill={color} />
  </svg>
)

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 437: DASHBOARD LAUNCHPAD ICONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎬 PLAY CIRCLE - Launch Live Show
 */
export const PlayCircleIcon: React.FC<IconProps> = ({ 
  size = 24, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
    <path d="M10 8L16 12L10 16V8Z" fill={color} />
  </svg>
)

/**
 * 🎯 TARGET - Calibration Crosshair
 */
export const TargetIcon: React.FC<IconProps> = ({ 
  size = 24, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
    <circle cx="12" cy="12" r="5" stroke={color} strokeWidth="1.5" />
    <circle cx="12" cy="12" r="1.5" fill={color} />
    <path d="M12 2V6M12 18V22M2 12H6M18 12H22" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
)

/**
 * 🔨 HAMMER - Build/Construct
 */
export const HammerIcon: React.FC<IconProps> = ({ 
  size = 24, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M6 10L3 21L14 18L6 10Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    <path d="M14 18L21 11L13 3L6 10L14 18Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    <path d="M10 6L18 14" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
  </svg>
)

/**
 * 🌊 AUDIO WAVE - Sound Visualizer
 */
export const AudioWaveIcon: React.FC<IconProps> = ({ 
  size = 24, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M4 12V10M8 12V6M12 12V4M16 12V8M20 12V11" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <path d="M4 12V14M8 12V18M12 12V20M16 12V16M20 12V13" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
  </svg>
)

/**
 * 🔌 NETWORK - DMX/Network Connection
 */
export const NetworkIcon: React.FC<IconProps> = ({ 
  size = 24, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="12" cy="5" r="3" stroke={color} strokeWidth="2" />
    <circle cx="5" cy="19" r="3" stroke={color} strokeWidth="2" />
    <circle cx="19" cy="19" r="3" stroke={color} strokeWidth="2" />
    <path d="M12 8V11M12 11L5 16M12 11L19 16" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
)

/**
 * 💾 FILE - Show/Session File
 */
export const FileIcon: React.FC<IconProps> = ({ 
  size = 24, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M6 2H14L20 8V20C20 21.1 19.1 22 18 22H6C4.9 22 4 21.1 4 20V4C4 2.9 4.9 2 6 2Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    <path d="M14 2V8H20" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 13H16M8 17H13" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
  </svg>
)

/**
 * ⚡ BOLT - Power/Status Indicator
 */
export const BoltIcon: React.FC<IconProps> = ({ 
  size = 24, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M13 2L4 14H11L10 22L20 10H13L13 2Z" fill={color} />
  </svg>
)

/**
 * 🎛️ MIXER - Control/Settings
 */
export const MixerIcon: React.FC<IconProps> = ({ 
  size = 24, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M4 21V14M4 10V3M12 21V12M12 8V3M20 21V16M20 12V3" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <circle cx="4" cy="12" r="2" fill={color} />
    <circle cx="12" cy="10" r="2" fill={color} />
    <circle cx="20" cy="14" r="2" fill={color} />
  </svg>
)

/**
 * 💡 WAVE 1135: CALIBRATION LAB ICONS
 */

/**
 * Moving Head - Cabeza móvil con base y yoke
 */
export const MovingHeadIcon: React.FC<IconProps> = ({ 
  size = 24, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Base */}
    <rect x="7" y="19" width="10" height="3" rx="1" fill={color} />
    {/* Yoke arms */}
    <path d="M8 19V14M16 19V14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* Head */}
    <rect x="6" y="8" width="12" height="6" rx="2" fill={color} />
    {/* Lens */}
    <circle cx="12" cy="11" r="2" fill="#22d3ee" />
    {/* Light beam */}
    <path d="M10 6L8 2M14 6L16 2M12 6V2" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
  </svg>
)

/**
 * PAR Can - Tradicional PAR light
 */
export const ParCanIcon: React.FC<IconProps> = ({ 
  size = 24, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Body */}
    <path d="M6 8L4 18H20L18 8H6Z" fill={color} />
    {/* Lens ring */}
    <ellipse cx="12" cy="8" rx="6" ry="2" stroke={color} strokeWidth="2" />
    {/* Light beam */}
    <path d="M8 6L6 2M16 6L18 2M12 6V2" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    {/* Bracket */}
    <path d="M4 18V20H20V18" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
)

/**
 * Blackout - Círculo tachado
 */
export const BlackoutIcon: React.FC<IconProps> = ({ 
  size = 24, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
    <path d="M5 19L19 5" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
  </svg>
)

/**
 * Flash - Destello/relámpago
 */
export const FlashIcon: React.FC<IconProps> = ({ 
  size = 24, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M13 2L4 13H12L11 22L20 11H12L13 2Z" 
      fill={color}
    />
  </svg>
)

// ============================================
// 🧠 WAVE 1167: NEURAL COMMAND CENTER ICONS
// ============================================

/**
 * 🧠 BRAIN NEURAL - Cerebro con sinapsis activas
 * Para: ConsciousnessHUD AI State
 */
export const BrainNeuralIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Cerebro base */}
    <path 
      d="M12 4C8 4 5 7 5 11C5 13 6 15 7 16L7 19C7 20 8 21 9 21H15C16 21 17 20 17 19L17 16C18 15 19 13 19 11C19 7 16 4 12 4Z" 
      stroke={color} 
      strokeWidth="1.5" 
      fill="none"
    />
    {/* División cerebral */}
    <path d="M12 4V21" stroke={color} strokeWidth="1" opacity="0.5" />
    {/* Sinapsis izquierda */}
    <circle cx="8" cy="10" r="1.5" fill={color} opacity="0.8" />
    <circle cx="9" cy="14" r="1" fill={color} opacity="0.6" />
    {/* Sinapsis derecha */}
    <circle cx="16" cy="10" r="1.5" fill={color} opacity="0.8" />
    <circle cx="15" cy="14" r="1" fill={color} opacity="0.6" />
    {/* Conexiones */}
    <path d="M8 10L12 8L16 10" stroke={color} strokeWidth="0.75" opacity="0.4" />
  </svg>
)

/**
 * 💭 DREAM CLOUD - Nube de pensamiento con estrellas
 * Para: ConsciousnessHUD Dream Forge
 */
export const DreamCloudIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Nube soñadora */}
    <path 
      d="M6 16C4 16 2 14.5 2 12.5C2 10.5 3.5 9 5.5 9C5.5 6 8 4 11 4C14 4 16.5 6 16.5 9C18.5 9 20 10.5 20 12.5C20 14.5 18 16 16 16H6Z" 
      stroke={color} 
      strokeWidth="1.5" 
      fill="none"
    />
    {/* Estrellas de sueño */}
    <path d="M8 11L8.5 10L9 11L8.5 11.5Z" fill={color} />
    <path d="M14 11L14.5 10L15 11L14.5 11.5Z" fill={color} />
    <path d="M11 9L11.5 8L12 9L11.5 9.5Z" fill={color} />
    {/* Pensamiento flotante */}
    <circle cx="7" cy="19" r="1" fill={color} opacity="0.4" />
    <circle cx="5" cy="21" r="0.7" fill={color} opacity="0.3" />
  </svg>
)

/**
 * 🛡️ SHIELD CHECK - Escudo con verificación ética
 * Para: ConsciousnessHUD Ethics
 */
export const ShieldCheckIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Escudo */}
    <path 
      d="M12 3L4 7V12C4 16.4 7.4 20.4 12 21C16.6 20.4 20 16.4 20 12V7L12 3Z" 
      stroke={color} 
      strokeWidth="1.5" 
      fill="none"
    />
    {/* Check */}
    <path 
      d="M8 12L11 15L16 9" 
      stroke={color} 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
)

/**
 * 🐱 CAT STALK - Gata Selene en modo stalking
 * Para: AI State cuando está cazando
 */
export const CatStalkIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Cuerpo agachado */}
    <ellipse cx="10" cy="16" rx="7" ry="3" stroke={color} strokeWidth="1.5" fill="none" />
    {/* Cabeza */}
    <circle cx="18" cy="13" r="3.5" stroke={color} strokeWidth="1.5" fill="none" />
    {/* Orejas puntiagudas */}
    <path d="M15.5 10L14 7.5L16 9.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M20.5 10L22 7.5L20 9.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    {/* Ojos alertas (brillantes) */}
    <circle cx="17" cy="12.5" r="0.8" fill="#22c55e" />
    <circle cx="19" cy="12.5" r="0.8" fill="#22c55e" />
    {/* Cola ondulante */}
    <path d="M3 14Q5 10 7 14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

/**
 * ⚡ LIGHTNING STRIKE - Rayo de ejecución
 * Para: Strike/Execute actions
 */
export const LightningStrikeIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Rayo principal */}
    <path 
      d="M13 2L4 13H11L10 22L19 11H12L13 2Z" 
      fill={color}
    />
    {/* Destellos laterales */}
    <path d="M17 6L20 7L17 8" stroke={color} strokeWidth="1" opacity="0.5" />
    <path d="M7 16L4 17L7 18" stroke={color} strokeWidth="1" opacity="0.5" />
  </svg>
)

/**
 * 📊 SPECTRUM BARS - Barras de espectro de audio
 * Para: AudioSpectrumPanel header
 */
export const SpectrumBarsIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="2" y="14" width="2.5" height="6" rx="1" fill={color} opacity="0.6" />
    <rect x="6" y="10" width="2.5" height="10" rx="1" fill={color} opacity="0.7" />
    <rect x="10" y="6" width="2.5" height="14" rx="1" fill={color} opacity="0.9" />
    <rect x="14" y="8" width="2.5" height="12" rx="1" fill={color} />
    <rect x="18" y="12" width="2.5" height="8" rx="1" fill={color} opacity="0.7" />
  </svg>
)

/**
 * 〰️ WAVEFORM - Onda sinusoidal
 * Para: Audio visualization
 */
export const WaveformIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M2 12C4 12 4 6 6 6C8 6 8 18 10 18C12 18 12 4 14 4C16 4 16 20 18 20C20 20 20 12 22 12" 
      stroke={color} 
      strokeWidth="2" 
      strokeLinecap="round"
      fill="none"
    />
  </svg>
)

/**
 * 💓 BPM HEART - Corazón con pulso BPM
 * Para: BPM indicator
 */
export const BPMHeartIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Corazón */}
    <path 
      d="M12 21C12 21 4 15 4 9.5C4 6.5 6.5 4 9.5 4C11 4 12 5 12 5C12 5 13 4 14.5 4C17.5 4 20 6.5 20 9.5C20 15 12 21 12 21Z" 
      stroke={color} 
      strokeWidth="1.5" 
      fill="none"
    />
    {/* Pulso ECG */}
    <path 
      d="M6 12H9L10 9L12 15L14 11L15 12H18" 
      stroke={color} 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
)

/**
 * 💧 DROP IMPACT - Gota impactando (para drops musicales)
 * Para: Beat drop detection
 */
export const DropImpactIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Gota */}
    <path 
      d="M12 3C12 3 6 10 6 14C6 17.3 8.7 20 12 20C15.3 20 18 17.3 18 14C18 10 12 3 12 3Z" 
      fill={color}
    />
    {/* Ondas de impacto */}
    <path d="M6 21C8 19 10 19 12 19C14 19 16 19 18 21" stroke={color} strokeWidth="1" opacity="0.4" />
    <path d="M4 22C7 20 9 20 12 20C15 20 17 20 20 22" stroke={color} strokeWidth="1" opacity="0.2" />
  </svg>
)

/**
 * 🎵 MUSICAL KEY - Llave musical
 * Para: Key detection display
 */
export const MusicalKeyIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Nota musical como llave */}
    <circle cx="8" cy="18" r="3" stroke={color} strokeWidth="1.5" fill="none" />
    <path d="M11 18V6" stroke={color} strokeWidth="2" />
    <path d="M11 6C11 6 15 4 17 6C19 8 17 12 11 10" stroke={color} strokeWidth="1.5" fill="none" />
    {/* Dientes de llave */}
    <path d="M11 12H14" stroke={color} strokeWidth="1.5" />
    <path d="M11 15H13" stroke={color} strokeWidth="1.5" />
  </svg>
)

/**
 * 📈 SECTION FLOW - Flujo de secciones
 * Para: Section tracker
 */
export const SectionFlowIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Bloques de sección */}
    <rect x="2" y="8" width="4" height="8" rx="1" stroke={color} strokeWidth="1.5" fill="none" />
    <rect x="8" y="6" width="4" height="12" rx="1" stroke={color} strokeWidth="1.5" fill="none" opacity="0.8" />
    <rect x="14" y="4" width="4" height="16" rx="1" stroke={color} strokeWidth="1.5" fill="none" opacity="0.6" />
    {/* Flecha de flujo */}
    <path d="M20 12L23 12M23 12L21 10M23 12L21 14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

/**
 * ✨ VIBE AURA - Aura energética
 * Para: Vibe indicator
 */
export const VibeAuraIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Núcleo */}
    <circle cx="12" cy="12" r="4" fill={color} />
    {/* Auras concéntricas */}
    <circle cx="12" cy="12" r="6" stroke={color} strokeWidth="1" opacity="0.6" />
    <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="1" opacity="0.4" />
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1" opacity="0.2" />
    {/* Rayos de energía */}
    <path d="M12 2V4M12 20V22M2 12H4M20 12H22" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
  </svg>
)

/**
 * 🌡️ THERMO COLOR - Termómetro de temperatura de color
 * Para: Color temperature display
 */
export const ThermoColorIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Cuerpo del termómetro */}
    <path 
      d="M14 14V6C14 4.9 13.1 4 12 4C10.9 4 10 4.9 10 6V14C8.8 14.8 8 16.3 8 18C8 20.2 9.8 22 12 22C14.2 22 16 20.2 16 18C16 16.3 15.2 14.8 14 14Z" 
      stroke={color} 
      strokeWidth="1.5" 
      fill="none"
    />
    {/* Mercurio con gradiente de color */}
    <circle cx="12" cy="18" r="2" fill="#ff6b35" />
    <rect x="11" y="10" width="2" height="6" fill="#ff6b35" />
    {/* Marcas */}
    <path d="M14 8H16M14 10H15M14 12H16" stroke={color} strokeWidth="1" opacity="0.5" />
  </svg>
)

/**
 * 🔴 LIVE DOT - Punto pulsante de LIVE
 * Para: Status indicators
 */
export const LiveDotIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = '#22c55e',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Punto central */}
    <circle cx="12" cy="12" r="4" fill={color} />
    {/* Pulso animado (CSS lo animará) */}
    <circle cx="12" cy="12" r="6" stroke={color} strokeWidth="2" opacity="0.5" className="live-pulse-ring" />
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1" opacity="0.2" className="live-pulse-ring-outer" />
  </svg>
)

/**
 * ↗️ TREND UP - Tendencia ascendente
 * Para: Energy/metrics trends
 */
export const TrendUpIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = '#22c55e',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M4 16L10 10L14 14L20 8" 
      stroke={color} 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M14 8H20V14" 
      stroke={color} 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
)

/**
 * ↘️ TREND DOWN - Tendencia descendente
 * Para: Energy/metrics trends
 */
export const TrendDownIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = '#ef4444',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M4 8L10 14L14 10L20 16" 
      stroke={color} 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M14 16H20V10" 
      stroke={color} 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
)

/**
 * → TREND STABLE - Tendencia estable
 * Para: Energy/metrics trends
 */
export const TrendStableIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = '#fbbf24',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M4 12H20" 
      stroke={color} 
      strokeWidth="2.5" 
      strokeLinecap="round"
    />
    <path 
      d="M16 8L20 12L16 16" 
      stroke={color} 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
)

/**
 * 🔮 PREDICTION ORB - Orbe de predicción
 * Para: Prediction display
 */
export const PredictionOrbIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Orbe/bola de cristal */}
    <circle cx="12" cy="10" r="8" stroke={color} strokeWidth="1.5" fill="none" />
    {/* Base */}
    <path d="M8 18H16L14 16H10L8 18Z" stroke={color} strokeWidth="1.5" fill="none" />
    {/* Reflejo */}
    <path d="M8 7Q10 5 14 7" stroke={color} strokeWidth="1" opacity="0.5" />
    {/* Visión interior */}
    <circle cx="12" cy="10" r="2" fill={color} opacity="0.3" />
    <path d="M10 10L12 8L14 10L12 12Z" fill={color} opacity="0.5" />
  </svg>
)

/**
 * 🎨 PALETTE CHROMATIC - Paleta cromática
 * Para: ChromaticCorePanel header
 */
export const PaletteChromaticIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Paleta base */}
    <path 
      d="M12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22C12.8 22 13.5 21.3 13.5 20.5C13.5 20.1 13.4 19.8 13.1 19.5C12.9 19.2 12.8 18.9 12.8 18.5C12.8 17.7 13.5 17 14.3 17H16C19.3 17 22 14.3 22 11C22 6 17.5 2 12 2Z" 
      stroke={color} 
      strokeWidth="1.5" 
      fill="none"
    />
    {/* Colores */}
    <circle cx="8" cy="10" r="2" fill="#ff4444" />
    <circle cx="12" cy="7" r="2" fill="#fbbf24" />
    <circle cx="16" cy="10" r="2" fill="#22c55e" />
    <circle cx="9" cy="14" r="2" fill="#3b82f6" />
  </svg>
)

/**
 * 📜 STREAM LOG - Log en streaming
 * Para: NeuralStreamLog header
 */
export const StreamLogIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Terminal/consola */}
    <rect x="3" y="4" width="18" height="16" rx="2" stroke={color} strokeWidth="1.5" fill="none" />
    {/* Líneas de log */}
    <path d="M6 9H10" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
    <path d="M6 12H14" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    <path d="M6 15H12" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    {/* Cursor parpadeante */}
    <rect x="14" y="14" width="2" height="3" fill={color} className="cursor-blink" />
  </svg>
)

/**
 * 🧭 CONTEXT MATRIX - Matriz de contexto
 * Para: ContextMatrixPanel header
 */
export const ContextMatrixIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Grid de matriz */}
    <rect x="3" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="1.5" fill="none" />
    <rect x="14" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="1.5" fill="none" />
    <rect x="3" y="14" width="7" height="7" rx="1" stroke={color} strokeWidth="1.5" fill="none" />
    <rect x="14" y="14" width="7" height="7" rx="1" stroke={color} strokeWidth="1.5" fill="none" />
    {/* Conexiones */}
    <circle cx="6.5" cy="6.5" r="1.5" fill={color} opacity="0.6" />
    <circle cx="17.5" cy="6.5" r="1.5" fill={color} opacity="0.8" />
    <circle cx="6.5" cy="17.5" r="1.5" fill={color} opacity="0.4" />
    <circle cx="17.5" cy="17.5" r="1.5" fill={color} />
  </svg>
)

export default {
  Intensity: IntensityIcon,
  Color: ColorIcon,
  Position: PositionIcon,
  Beam: BeamIcon,
  Strobe: StrobeIcon,
  Blinder: BlinderIcon,
  Smoke: SmokeIcon,
  Rainbow: RainbowIcon,
  Police: PoliceIcon,
  Laser: LaserIcon,
  Prism: PrismIcon,
  Gobo: GoboIcon,
  Focus: FocusIcon,
  Zoom: ZoomIcon,
  Iris: IrisIcon,
  MasterIntensity: MasterIntensityIcon,
  Group: GroupIcon,
  Scenes: ScenesIcon,
  Controls: ControlsIcon,
  // WAVE 437: Dashboard icons
  PlayCircle: PlayCircleIcon,
  Target: TargetIcon,
  Hammer: HammerIcon,
  AudioWave: AudioWaveIcon,
  Network: NetworkIcon,
  File: FileIcon,
  Bolt: BoltIcon,
  Mixer: MixerIcon,
  // WAVE 1135: Calibration Lab icons
  MovingHead: MovingHeadIcon,
  ParCan: ParCanIcon,
  Blackout: BlackoutIcon,
  Flash: FlashIcon,
  // WAVE 1167: Neural Command Center icons
  BrainNeural: BrainNeuralIcon,
  DreamCloud: DreamCloudIcon,
  ShieldCheck: ShieldCheckIcon,
  CatStalk: CatStalkIcon,
  LightningStrike: LightningStrikeIcon,
  SpectrumBars: SpectrumBarsIcon,
  Waveform: WaveformIcon,
  BPMHeart: BPMHeartIcon,
  DropImpact: DropImpactIcon,
  MusicalKey: MusicalKeyIcon,
  SectionFlow: SectionFlowIcon,
  VibeAura: VibeAuraIcon,
  ThermoColor: ThermoColorIcon,
  LiveDot: LiveDotIcon,
  TrendUp: TrendUpIcon,
  TrendDown: TrendDownIcon,
  TrendStable: TrendStableIcon,
  PredictionOrb: PredictionOrbIcon,
  PaletteChromatic: PaletteChromaticIcon,
  StreamLog: StreamLogIcon,
  ContextMatrix: ContextMatrixIcon,
}
