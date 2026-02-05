/**
 * 📜 LOG ENTRY COMPONENT - WAVE 1167
 * Renderiza una entrada de log individual con timestamp relativo
 */

import { memo, useMemo } from 'react'
import { 
  BrainNeuralIcon,
  DreamCloudIcon,
  ShieldCheckIcon,
  LightningStrikeIcon,
  SpectrumBarsIcon,
  BPMHeartIcon,
  DropImpactIcon,
  SectionFlowIcon,
  PaletteChromaticIcon,
  StreamLogIcon,
} from '../../icons/LuxIcons'
import type { LogEntry as LogEntryType } from '../../../stores/logStore'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface LogEntryProps {
  entry: LogEntryType
  now: number // Current timestamp for relative time
}

export type LogCategory = 
  | 'brain' 
  | 'dream' 
  | 'ethics' 
  | 'strike' 
  | 'effect' 
  | 'color' 
  | 'beat' 
  | 'drop' 
  | 'section'
  | 'system'
  | 'dmx'
  | 'error'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

interface CategoryConfig {
  icon: React.ComponentType<{ size?: number; color?: string }>
  color: string
  label: string
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  // Consciousness
  brain: { icon: BrainNeuralIcon, color: 'var(--cat-brain)', label: 'BRAIN' },
  dream: { icon: DreamCloudIcon, color: 'var(--cat-dream)', label: 'DREAM' },
  ethics: { icon: ShieldCheckIcon, color: 'var(--cat-ethics)', label: 'ETHICS' },
  strike: { icon: LightningStrikeIcon, color: 'var(--cat-strike)', label: 'STRIKE' },
  hunt: { icon: LightningStrikeIcon, color: 'var(--cat-strike)', label: 'HUNT' },
  
  // Audio/Music
  beat: { icon: BPMHeartIcon, color: 'var(--cat-beat)', label: 'BEAT' },
  drop: { icon: DropImpactIcon, color: 'var(--cat-drop)', label: 'DROP' },
  section: { icon: SectionFlowIcon, color: 'var(--cat-section)', label: 'SECTION' },
  music: { icon: BPMHeartIcon, color: 'var(--cat-beat)', label: 'MUSIC' },
  genre: { icon: SectionFlowIcon, color: 'var(--cat-section)', label: 'GENRE' },
  
  // Visual
  effect: { icon: SpectrumBarsIcon, color: 'var(--cat-effect)', label: 'EFFECT' },
  color: { icon: PaletteChromaticIcon, color: 'var(--cat-color)', label: 'COLOR' },
  visual: { icon: PaletteChromaticIcon, color: 'var(--cat-color)', label: 'VISUAL' },
  
  // System
  system: { icon: StreamLogIcon, color: 'var(--cat-system)', label: 'SYSTEM' },
  mode: { icon: StreamLogIcon, color: 'var(--cat-system)', label: 'MODE' },
  info: { icon: StreamLogIcon, color: 'var(--cat-system)', label: 'INFO' },
  dmx: { icon: StreamLogIcon, color: 'var(--cat-dmx)', label: 'DMX' },
  error: { icon: StreamLogIcon, color: 'var(--cat-error)', label: 'ERROR' },
}

// Fallback for unknown categories
const DEFAULT_CONFIG: CategoryConfig = {
  icon: StreamLogIcon,
  color: 'var(--text-muted)',
  label: 'LOG',
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Formatea timestamp a tiempo relativo
 */
function formatRelativeTime(timestamp: number, now: number): string {
  const diff = now - timestamp
  
  if (diff < 1000) return 'now'
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return `${Math.floor(diff / 86400000)}d`
}

/**
 * Formatea timestamp absoluto (para tooltip)
 */
function formatAbsoluteTime(timestamp: number): string {
  const date = new Date(timestamp)
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  const s = date.getSeconds().toString().padStart(2, '0')
  const ms = date.getMilliseconds().toString().padStart(3, '0')
  return `${h}:${m}:${s}.${ms}`
}

/**
 * Normaliza categoría a lowercase
 */
function normalizeCategory(category: string): string {
  return category.toLowerCase().replace(/[^a-z]/g, '')
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const LogEntry = memo(({ entry, now }: LogEntryProps) => {
  const normalizedCategory = normalizeCategory(entry.category)
  const config = CATEGORY_CONFIG[normalizedCategory] || DEFAULT_CONFIG
  const IconComponent = config.icon
  
  const relativeTime = useMemo(
    () => formatRelativeTime(entry.timestamp, now),
    [entry.timestamp, now]
  )
  
  const absoluteTime = useMemo(
    () => formatAbsoluteTime(entry.timestamp),
    [entry.timestamp]
  )
  
  return (
    <div 
      className={`log-entry log-entry--${normalizedCategory}`}
      title={absoluteTime}
    >
      {/* Timestamp */}
      <span className="log-entry__time">{relativeTime}</span>
      
      {/* Category Icon + Label */}
      <span className="log-entry__category" style={{ color: config.color }}>
        <IconComponent size={12} color={config.color} />
        <span>{config.label}</span>
      </span>
      
      {/* Message */}
      <span className="log-entry__message">{entry.message}</span>
    </div>
  )
})

LogEntry.displayName = 'LogEntry'
