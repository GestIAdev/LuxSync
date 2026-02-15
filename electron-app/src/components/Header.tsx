/**
 * 🎯 HEADER - Mission Control Status Bar (COMPACT)
 * Muestra: Vibe, Mood, BPM, Selene Status, Master Volume
 * 
 * WAVE 3: Connected to useSeleneAudio for real-time BPM from Selene
 * 🚑 RESCUE DIRECTIVE: Now shows REAL BPM from telemetry with confidence indicator
 * 🧠 WAVE 25.6: Migrado a truthStore - BPM desde sensory.beat
 * 🎨 WAVE 33.2: Mode Switcher migrado aquí desde GlobalControls
 * 🎭 WAVE 66: Mood now from cognitive.stableEmotion (BRIGHT/DARK/NEUTRAL)
 */

import { useLuxSyncStore, PALETTES, selectHeader } from '../stores/luxsyncStore'
import { useControlStore, GlobalMode } from '../stores/controlStore'
import { useTruthSensory, useTruthCognitive } from '../hooks'
import { useShallow } from 'zustand/shallow'

// 🎭 WAVE 66: StableEmotion labels (matches MoodArbiter output)
const EMOTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  BRIGHT: { label: 'BRIGHT', icon: '☀️', color: '#FFD700' },
  DARK: { label: 'DARK', icon: '🌙', color: '#7C4DFF' },
  NEUTRAL: { label: 'NEUTRAL', icon: '⚖️', color: '#888888' },
}

// Legacy mood labels (kept for fallback)
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

// 🎨 WAVE 33.2 + WAVE 427: Mode config (flow ELIMINATED - Auto-Override system)
const MODES: { id: GlobalMode; label: string; icon: string; color: string }[] = [
  { id: 'manual', label: 'MAN', icon: '🎚️', color: '#FF6B6B' },
  { id: 'selene', label: 'AI', icon: '🌙', color: '#7C4DFF' },
]

export default function Header() {
  // 🛡️ WAVE 2042.13.5: useShallow para evitar infinite loop
  const { 
    activePalette,
    seleneGeneration,
    masterDimmer, 
    setMasterDimmer 
  } = useLuxSyncStore(useShallow(selectHeader))

  // 🎨 WAVE 33.2: Control mode from controlStore
  const globalMode = useControlStore(state => state.globalMode)
  const setGlobalMode = useControlStore(state => state.setGlobalMode)

  // 🧠 WAVE 25.6: Get REAL BPM from truthStore (sensory)
  const sensory = useTruthSensory()
  
  // 🎭 WAVE 66: Get stableEmotion from truthStore (cognitive)
  const cognitive = useTruthCognitive()

  const palette = PALETTES[activePalette]
  
  // 🎭 WAVE 66: Use stableEmotion from MoodArbiter
  const stableEmotion = cognitive?.stableEmotion ?? 'NEUTRAL'
  const mood = EMOTION_LABELS[stableEmotion] ?? EMOTION_LABELS.NEUTRAL
  
  const currentModeConfig = MODES.find(m => m.id === globalMode) || MODES[0]

  // 🧠 WAVE 25.6: Use truth sensory data
  const displayBpm = sensory?.beat?.bpm ?? 0
  const bpmConfidence = sensory?.beat?.confidence ?? 0
  const isBeatSync = sensory?.beat?.onBeat ?? false
  
  // Determine BPM text color based on confidence
  const bpmColor = bpmConfidence > 0.7 ? '#4ADE80' : bpmConfidence > 0.4 ? '#FBBF24' : '#EF4444'

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

        {/* BPM - Now uses real-time telemetry data with confidence */}
        <div className="header-item bpm-item">
          <span className="bpm-icon">♫</span>
          <span className="bpm-value" style={{ color: bpmColor }}>
            {displayBpm > 0 ? displayBpm.toFixed(0) : '--'}
          </span>
          <span className="bpm-unit">BPM</span>
          <div className={`sync-dot ${isBeatSync ? 'synced' : ''}`} />
        </div>

        {/* 🎨 WAVE 33.2: Mode Switcher - Manual | Flow | Selene */}
        <div className="header-item mode-switcher">
          {MODES.map(mode => (
            <button
              key={mode.id}
              className={`mode-btn ${globalMode === mode.id ? 'active' : ''}`}
              onClick={() => setGlobalMode(mode.id)}
              style={{ 
                '--mode-color': mode.color,
                borderColor: globalMode === mode.id ? mode.color : 'transparent'
              } as React.CSSProperties}
            >
              <span className="mode-icon">{mode.icon}</span>
              <span className="mode-label">{mode.label}</span>
            </button>
          ))}
        </div>

        {/* Selene Generation indicator */}
        <div className="header-item selene-gen-item">
          <span style={{ color: currentModeConfig.color }}>●</span>
          <span className="selene-gen">Gen {seleneGeneration}</span>
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

        /* 🎨 WAVE 33.2: Mode Switcher */
        .mode-switcher {
          display: flex;
          gap: 2px;
          padding: 2px !important;
          background: var(--bg-deep);
        }

        .mode-switcher .mode-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.15s ease;
          color: var(--text-muted);
        }

        .mode-switcher .mode-btn:hover {
          background: var(--bg-surface);
          color: var(--text-primary);
        }

        .mode-switcher .mode-btn.active {
          background: rgba(var(--mode-color-rgb, 124, 77, 255), 0.2);
          color: var(--mode-color);
          border-color: var(--mode-color);
        }

        .mode-switcher .mode-icon {
          font-size: 0.75rem;
        }

        .mode-switcher .mode-label {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 0.65rem;
          letter-spacing: 0.5px;
        }

        /* Selene Gen indicator */
        .selene-gen-item {
          gap: 4px;
          min-width: 60px;
        }
      `}</style>
    </header>
  )
}
