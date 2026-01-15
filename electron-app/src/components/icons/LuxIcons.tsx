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
}
