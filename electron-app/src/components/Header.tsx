/**
 * 🎯 HEADER - Mission Control Status Bar
 * Muestra: Vibe, Mood, BPM, Selene Status, Master Volume
 */

import { useLuxSyncStore, PALETTES } from '../stores/luxsyncStore'

const MOOD_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  peaceful: { label: 'CHILL', icon: '😌', color: '#4ECDC4' },
  energetic: { label: 'ENERGY', icon: '⚡', color: '#FF6B6B' },
  chaotic: { label: 'CHAOS', icon: '🌪️', color: '#A855F7' },
  harmonious: { label: 'FLOW', icon: '🌊', color: '#4ADE80' },
  building: { label: 'BUILD-UP', icon: '📈', color: '#FBBF24' },
  dropping: { label: 'DROP!', icon: '💥', color: '#FF1744' },
}

const MODE_LABELS: Record<string, { label: string; color: string }> = {
  flow: { label: 'FLOW', color: '#4ADE80' },
  selene: { label: 'SELENE AI', color: '#7C4DFF' },
  locked: { label: 'LOCKED', color: '#FF4444' },
}

export default function Header() {
  const { 
    activePalette, 
    selene, 
    audio, 
    masterDimmer, 
    setMasterDimmer 
  } = useLuxSyncStore()

  const palette = PALETTES[activePalette]
  const mood = MOOD_LABELS[selene.mood] || MOOD_LABELS.harmonious
  const mode = MODE_LABELS[selene.mode]

  return (
    <header className="header">
      {/* Drag area for Electron window */}
      <div className="header-drag-area titlebar-drag" />

      <div className="header-content titlebar-no-drag">
        {/* Vibe/Palette Actual */}
        <div className="header-section vibe-section">
          <div 
            className="vibe-indicator"
            style={{ 
              background: `linear-gradient(135deg, ${palette.colors[0]}, ${palette.colors[1]})` 
            }}
          />
          <div className="vibe-info">
            <span className="vibe-emoji">{palette.emoji}</span>
            <div className="vibe-text">
              <span className="vibe-name">{palette.name.toUpperCase()}</span>
              <span className="vibe-desc">{palette.description}</span>
            </div>
          </div>
        </div>

        {/* Mood Detectado */}
        <div className="header-section mood-section">
          <span className="mood-icon">{mood.icon}</span>
          <div className="mood-info">
            <span className="mood-label" style={{ color: mood.color }}>
              {mood.label}
            </span>
            <span className="mood-subtitle">Mood Detectado</span>
          </div>
        </div>

        {/* BPM */}
        <div className="header-section bpm-section">
          <span className="bpm-icon">♫</span>
          <div className="bpm-info">
            <span className="bpm-value">{audio.bpm.toFixed(1)}</span>
            <span className="bpm-label">BPM</span>
          </div>
          <div className={`sync-indicator ${audio.beatSync ? 'synced' : ''}`}>
            {audio.beatSync ? '✓' : '○'}
          </div>
        </div>

        {/* Selene Status */}
        <div className="header-section selene-section">
          <div className="selene-indicator" style={{ background: mode.color }} />
          <div className="selene-info">
            <span className="selene-mode" style={{ color: mode.color }}>
              {mode.label}
            </span>
            <span className="selene-gen">Gen {selene.generation}</span>
          </div>
          <div className={`health-dot ${selene.health > 0.7 ? 'healthy' : 'warning'}`} />
        </div>

        {/* Master Volume */}
        <div className="header-section master-section">
          <span className="master-icon">🎚️</span>
          <div className="master-control">
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
      </div>

      <style>{`
        .header {
          position: relative;
          height: 60px;
          background: linear-gradient(180deg, var(--bg-deep) 0%, var(--bg-deepest) 100%);
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
        }

        .header-drag-area {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 40px;
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: var(--space-xl);
          padding: 0 var(--space-lg);
          width: 100%;
          height: 100%;
        }

        .header-section {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          padding: var(--space-sm) var(--space-md);
          background: var(--bg-surface);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-subtle);
        }

        /* Vibe Section */
        .vibe-section {
          min-width: 200px;
        }

        .vibe-indicator {
          width: 8px;
          height: 40px;
          border-radius: var(--radius-sm);
        }

        .vibe-info {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .vibe-emoji {
          font-size: 1.5rem;
        }

        .vibe-text {
          display: flex;
          flex-direction: column;
        }

        .vibe-name {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 0.875rem;
          color: var(--text-primary);
        }

        .vibe-desc {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        /* Mood Section */
        .mood-section {
          min-width: 140px;
        }

        .mood-icon {
          font-size: 1.5rem;
        }

        .mood-info {
          display: flex;
          flex-direction: column;
        }

        .mood-label {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 0.875rem;
        }

        .mood-subtitle {
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        /* BPM Section */
        .bpm-section {
          min-width: 120px;
        }

        .bpm-icon {
          font-size: 1.25rem;
          color: var(--accent-secondary);
        }

        .bpm-info {
          display: flex;
          flex-direction: column;
        }

        .bpm-value {
          font-family: var(--font-mono);
          font-weight: 700;
          font-size: 1.125rem;
          color: var(--text-primary);
        }

        .bpm-label {
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .sync-indicator {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--bg-deep);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .sync-indicator.synced {
          background: var(--accent-success);
          color: var(--bg-deepest);
        }

        /* Selene Section */
        .selene-section {
          min-width: 140px;
        }

        .selene-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: pulse-glow 2s ease-in-out infinite;
        }

        .selene-info {
          display: flex;
          flex-direction: column;
        }

        .selene-mode {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 0.875rem;
        }

        .selene-gen {
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .health-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--accent-warning);
        }

        .health-dot.healthy {
          background: var(--accent-success);
        }

        /* Master Section */
        .master-section {
          min-width: 160px;
          margin-left: auto;
        }

        .master-icon {
          font-size: 1.25rem;
        }

        .master-control {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .master-slider {
          width: 80px;
          height: 6px;
          -webkit-appearance: none;
          appearance: none;
          background: var(--bg-deep);
          border-radius: var(--radius-full);
          outline: none;
        }

        .master-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          background: var(--accent-primary);
          border-radius: 50%;
          cursor: pointer;
          transition: transform 0.15s ease;
        }

        .master-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }

        .master-value {
          font-family: var(--font-mono);
          font-size: 0.875rem;
          color: var(--text-secondary);
          min-width: 40px;
        }
      `}</style>
    </header>
  )
}
