import { LivingPaletteId } from '../stores/controlStore'

export interface PaletteConfig {
  id: LivingPaletteId
  name: string
  icon: string
  gradient: string
  description: string
  // Representative color for instant feedback
  primaryColor: { r: number, g: number, b: number }
}

export const PALETTES: PaletteConfig[] = [
  {
    id: 'fuego',
    name: 'Fuego',
    icon: '🔥',
    gradient: 'linear-gradient(135deg, #ff4444 0%, #ff8800 50%, #ffcc00 100%)',
    description: 'Latino Heat - Rojos/naranjas cálidos',
    primaryColor: { r: 255, g: 68, b: 0 } // Orange/Red
  },
  {
    id: 'hielo',
    name: 'Hielo',
    icon: '❄️',
    gradient: 'linear-gradient(135deg, #4488ff 0%, #00ddff 50%, #ff88cc 100%)',
    description: 'Arctic Dreams - Azules con aurora',
    primaryColor: { r: 0, g: 221, b: 255 } // Cyan
  },
  {
    id: 'selva',
    name: 'Selva',
    icon: '🌴',
    gradient: 'linear-gradient(135deg, #00cc66 0%, #00ff88 50%, #ff00ff 100%)',
    description: 'Tropical Storm - Verdes vibrantes',
    primaryColor: { r: 0, g: 255, b: 136 } // Green
  },
  {
    id: 'neon',
    name: 'Neon',
    icon: '⚡',
    gradient: 'linear-gradient(135deg, #ff00ff 0%, #00ffff 50%, #00ff00 100%)',
    description: 'Cyberpunk - Ciclo de neón',
    primaryColor: { r: 255, g: 0, b: 255 } // Magenta
  },
]
