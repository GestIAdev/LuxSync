/**
 * 🎯 HEADER - Mission Control Status Bar (COMPACT)
 * Muestra: Vibe, Mood, BPM, Selene Status, Master Volume
 * 
 * WAVE 3: Connected to useSeleneAudio for real-time BPM from Selene
 */

import { useLuxSyncStore, PALETTES } from '../stores/luxsyncStore'
import { useSeleneAudio } from '../hooks/useSelene'

const MOOD_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  peaceful: { label: 'CHILL', icon: '😌', color: '#4ECDC4' },
  energetic: { label: 'ENERGY', icon: '⚡', color: '#FF6B6B' },
  chaotic: { label: 'CHAOS', icon: '🌪️', color: '#A855F7' },
  harmonious: { label: 'FLOW', icon: '🌊', color: '#4ADE80' },
  building: { label: 'BUILD', icon: '📈', color: '#FBBF24' },
  dropping: { label: 'DROP!', icon: '💥', color: '#FF1744' },
}

const MODE_COLORS: Record<string, string> = {
  flow: '#4ADE80',
  selene: '#7C4DFF',
  locked: '#FF4444',
}

export default function Header() {
  const { 
    activePalette, 
    selene, 
    audio, 
    masterDimmer, 
    setMasterDimmer 
  } = useLuxSyncStore()

  // 🔗 WAVE 3: Get real-time audio from Selene (overrides store when available)
  const seleneAudio = useSeleneAudio()

  const palette = PALETTES[activePalette]
  const mood = MOOD_LABELS[selene.mood] || MOOD_LABELS.harmonious
  const modeColor = MODE_COLORS[selene.mode]

  // Use Selene BPM if available, fallback to store
  const displayBpm = seleneAudio.bpm > 0 ? seleneAudio.bpm : audio.bpm
  const isBeatSync = seleneAudio.bass > 0.7 // High bass = beat

  return (
    <header className="header">
      <div className="header-content">
        {/* Vibe/Palette Actual */}
        <div className="header-item vibe-item">
          <div 
            className="vibe-bar"
            style={{ background: `linear-gradient(90deg, ${palette.colors[0]}, ${palette.colors[1]})` }}
          />
          <span className="vibe-emoji">{palette.emoji}</span>
          <div className="vibe-text">
            <span className="vibe-name">{palette.name.toUpperCase()}</span>
          </div>
        </div>

        {/* Mood Detectado */}
        <div className="header-item mood-item">
          <span className="mood-icon">{mood.icon}</span>
          <span className="mood-label" style={{ color: mood.color }}>{mood.label}</span>
        </div>

        {/* BPM - Now uses real-time Selene data */}
        <div className="header-item bpm-item">
          <span className="bpm-icon">♫</span>
          <span className="bpm-value">{displayBpm.toFixed(1)}</span>
          <span className="bpm-unit">BPM</span>
          <div className={`sync-dot ${isBeatSync ? 'synced' : ''}`} />
        </div>

        {/* Selene Status */}
        <div className="header-item selene-item">
          <div className="selene-dot" style={{ background: modeColor }} />
          <span className="selene-mode" style={{ color: modeColor }}>
            {selene.mode.toUpperCase()}
          </span>
          <span className="selene-gen">Gen {selene.generation}</span>
        </div>

        {/* Master Volume - Con espacio para botones de ventana */}
        <div className="header-item master-item">
          <span className="master-icon">🎚️</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={masterDimmer}
            onChange={(e) => setMasterDimmer(parseFloat(e.target.value))}
            className="master-slider"
          />
          <span className="master-value">{Math.round(masterDimmer * 100)}%</span>
        </div>
      </div>

      <style>{`
        .header {
          height: 44px;
          background: linear-gradient(180deg, var(--bg-deep) 0%, var(--bg-deepest) 100%);
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          padding: 0 var(--space-md);
          padding-right: 150px; /* Espacio para botones de ventana */
          -webkit-app-region: drag;
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: var(--space-md);
          width: 100%;
          -webkit-app-region: no-drag;
        }

        .header-item {
          display: flex;
          align-items: center;
          gap: var(--space-xs);
          padding: var(--space-xs) var(--space-sm);
          background: var(--bg-surface);
          border-radius: var(--radius-md);
          border: 1px solid var(--border-subtle);
          height: 32px;
        }

        /* Vibe */
        .vibe-item {
          min-width: 140px;
        }

        .vibe-bar {
          width: 4px;
          height: 20px;
          border-radius: 2px;
        }

        .vibe-emoji {
          font-size: 1rem;
        }

        .vibe-name {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 0.7rem;
          color: var(--text-primary);
        }

        /* Mood */
        .mood-item {
          min-width: 90px;
        }

        .mood-icon {
          font-size: 1rem;
        }

        .mood-label {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 0.7rem;
        }

        /* BPM */
        .bpm-item {
          min-width: 100px;
        }

        .bpm-icon {
          font-size: 0.875rem;
          color: var(--accent-secondary);
        }

        .bpm-value {
          font-family: var(--font-mono);
          font-weight: 700;
          font-size: 0.875rem;
          color: var(--text-primary);
        }

        .bpm-unit {
          font-size: 0.6rem;
          color: var(--text-muted);
        }

        .sync-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--text-muted);
        }

        .sync-dot.synced {
          background: var(--accent-success);
          box-shadow: 0 0 6px var(--accent-success);
        }

        /* Selene */
        .selene-item {
          min-width: 100px;
        }

        .selene-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          animation: pulse-glow 2s ease-in-out infinite;
        }

        .selene-mode {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 0.7rem;
        }

        .selene-gen {
          font-size: 0.6rem;
          color: var(--text-muted);
        }

        /* Master */
        .master-item {
          margin-left: auto;
          min-width: 130px;
        }

        .master-icon {
          font-size: 0.875rem;
        }

        .master-slider {
          width: 60px;
          height: 4px;
          -webkit-appearance: none;
          appearance: none;
          background: var(--bg-deep);
          border-radius: var(--radius-full);
          outline: none;
        }

        .master-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          background: var(--accent-primary);
          border-radius: 50%;
          cursor: pointer;
        }

        .master-value {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: var(--text-secondary);
          min-width: 30px;
          text-align: right;
        }
      `}</style>
    </header>
  )
}
