/**
 * ☀️ HYPERION NEON PALETTE
 * 
 * Design tokens para el lenguaje visual Hyperion.
 * Compartidos entre Canvas 2D, Three.js 3D y CSS.
 * 
 * IMPORTANTE: Estos valores se sincronizan con HyperionView.css.
 * Si cambias algo aquí, actualiza también el CSS correspondiente.
 * 
 * @module components/hyperion/shared/NeonPalette
 * @since WAVE 2042.1 (Project Hyperion — Phase 0)
 */

// ═══════════════════════════════════════════════════════════════════════════
// HYPERION DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════

export const HYPERION = {
  // ── FONDOS ─────────────────────────────────────────────────────────────
  bg: {
    /** Negro absoluto — canvas background, máximo contraste */
    void:     '#050508',
    /** Superficie base — panels, cards */
    surface:  '#0a0a12',
    /** Superficie elevada — toolbar, sidebar, modales */
    elevated: '#0f0f1a',
    /** Overlays transparentes — dropdowns, tooltips */
    overlay:  '#141420',
  },

  // ── NEON PRIMARIOS ─────────────────────────────────────────────────────
  neon: {
    /** Cyan — Selección, borders principales, acciones primarias */
    cyan:     '#00F0FF',
    /** Magenta — Hover, accents secundarios, beat pulse */
    magenta:  '#FF00E5',
    /** Gold — Warnings, BPM indicator, atención */
    gold:     '#FFD700',
    /** Green — OK, confidence alta, FPS bueno, success */
    green:    '#00FF6A',
    /** Red — Error, strike, FPS bajo, danger */
    red:      '#FF003C',
    /** Purple — Stereo division, mood indicator, special */
    purple:   '#B026FF',
  },

  // ── NEON GRADIENTES ────────────────────────────────────────────────────
  gradient: {
    /** Toolbar background — degradado vertical sutil */
    toolbar:    'linear-gradient(180deg, #0f0f1a 0%, #0a0a12 100%)',
    /** Viewport background — tint diagonal cyan/magenta */
    viewport:   'linear-gradient(135deg, rgba(0,240,255,0.03) 0%, rgba(255,0,229,0.03) 100%)',
    /** Glow effect — radial cyan diffuse */
    glow:       'radial-gradient(ellipse, rgba(0,240,255,0.15) 0%, transparent 70%)',
    /** Beat pulse — radial magenta para flash en beat */
    beatPulse:  'radial-gradient(circle, rgba(255,0,229,0.4) 0%, transparent 60%)',
  },

  // ── GRID (Canvas 2D) ───────────────────────────────────────────────────
  grid: {
    /** Líneas base — cyan fantasmal */
    line:       'rgba(0, 240, 255, 0.04)',
    /** Accent lines — cada 4 líneas, más visible */
    accent:     'rgba(0, 240, 255, 0.10)',
    /** Cross markers — en intersecciones de accent lines */
    cross:      'rgba(0, 240, 255, 0.18)',
  },

  // ── TIPOGRAFÍA ─────────────────────────────────────────────────────────
  font: {
    /** Primary — código, datos técnicos */
    primary:    "'JetBrains Mono', 'Fira Code', monospace",
    /** Display — títulos, badges, indicadores */
    display:    "'Orbitron', 'JetBrains Mono', monospace",
  },

  // ── BORDES ─────────────────────────────────────────────────────────────
  border: {
    /** Sutil — separadores internos */
    subtle:     '1px solid rgba(0, 240, 255, 0.08)',
    /** Normal — bordes estándar */
    normal:     '1px solid rgba(0, 240, 255, 0.15)',
    /** Active — estado activo/focus */
    active:     '1px solid rgba(0, 240, 255, 0.40)',
    /** Glow — borde con box-shadow */
    glow:       '0 0 12px rgba(0, 240, 255, 0.25), 0 0 4px rgba(0, 240, 255, 0.15)',
  },

  // ── SHADOWS / GLOWS ────────────────────────────────────────────────────
  glow: {
    /** Cyan glow — selección, hover */
    cyan:       '0 0 20px rgba(0, 240, 255, 0.3), 0 0 60px rgba(0, 240, 255, 0.1)',
    /** Magenta glow — beat pulse, accents */
    magenta:    '0 0 20px rgba(255, 0, 229, 0.3), 0 0 60px rgba(255, 0, 229, 0.1)',
    /** Beat glow — flash en onBeat */
    beat:       '0 0 40px rgba(255, 0, 229, 0.4)',
  },

  // ── TIMING ─────────────────────────────────────────────────────────────
  transition: {
    /** Instant — hover effects, cursor changes */
    instant:    '0.05s ease',
    /** Fast — button press, toggles */
    fast:       '0.15s ease',
    /** Normal — panel transitions */
    normal:     '0.25s ease-out',
    /** Smooth — page transitions, beat decay */
    smooth:     '0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Genera un rgba string desde un hex color con alpha.
 * 
 * @param hex — Color hex (#RRGGBB o #RGB)
 * @param alpha — Opacidad (0-1)
 * @returns rgba string
 * 
 * @example
 * hexToRgba('#00F0FF', 0.5)  // 'rgba(0, 240, 255, 0.5)'
 */
export function hexToRgba(hex: string, alpha: number): string {
  // Normalize hex
  let normalized = hex.replace('#', '')
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map(c => c + c)
      .join('')
  }
  
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Genera un glow CSS box-shadow para un color dado.
 * 
 * @param hex — Color hex
 * @param intensity — Intensidad del glow (0-1, affects alpha and spread)
 * @returns box-shadow string
 */
export function generateGlow(hex: string, intensity: number): string {
  const alpha1 = 0.3 * intensity
  const alpha2 = 0.1 * intensity
  const spread1 = Math.round(20 * intensity)
  const spread2 = Math.round(60 * intensity)
  
  return `0 0 ${spread1}px ${hexToRgba(hex, alpha1)}, 0 0 ${spread2}px ${hexToRgba(hex, alpha2)}`
}

/**
 * Calcula el color de un fixture apagado (rim color tenue).
 * 
 * @param r — Red (0-255)
 * @param g — Green (0-255)
 * @param b — Blue (0-255)
 * @returns rgba string con alpha 0.15
 */
export function getFixtureOffColor(r: number, g: number, b: number): string {
  return `rgba(${r}, ${g}, ${b}, 0.15)`
}

/**
 * Interpola un color entre cyan y magenta basado en beat intensity.
 * Usado para efectos que reaccionan al beat.
 * 
 * @param beatIntensity — Intensidad del beat (0-1, 1 = on beat)
 * @returns hex color interpolado
 */
export function getBeatColor(beatIntensity: number): string {
  // Cyan (#00F0FF) → Magenta (#FF00E5)
  const r = Math.round(255 * beatIntensity)
  const g = Math.round(240 * (1 - beatIntensity))
  const b = Math.round(255 - (255 - 229) * beatIntensity)
  
  return `rgb(${r}, ${g}, ${b})`
}
