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
}
