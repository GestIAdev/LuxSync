/**
 * 🎨 PALETTE REACTOR - Selección de paletas de colores
 * Fire, Ice, Jungle, Neon + controles de saturación e intensidad
 */

import { useLuxSyncStore, PALETTES, PaletteId } from '../stores/luxsyncStore'

const PALETTE_IDS: PaletteId[] = ['fire', 'ice', 'jungle', 'neon']

export default function PaletteReactor() {
  const { 
    activePalette, 
    colors, 
    setActivePalette, 
    setColorSaturation, 
    setColorIntensity 
  } = useLuxSyncStore()

  return (
    <div className="palette-reactor">
      <div className="palette-header">
        <h2 className="palette-title">PALETTE REACTOR</h2>
        <span className="palette-subtitle">Color Engine</span>
      </div>

      <div className="palette-panel">
        {/* Paletas */}
        <div className="palette-grid">
          {PALETTE_IDS.map((id) => {
            const palette = PALETTES[id]
            const isActive = activePalette === id
            
            return (
              <button
                key={id}
                className={`palette-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActivePalette(id)}
                style={{
                  '--p-color-1': palette.colors[0],
                  '--p-color-2': palette.colors[1],
                  '--p-color-3': palette.colors[2] || palette.colors[1],
                } as React.CSSProperties}
              >
                <div className="palette-preview">
                  <div className="preview-color c1" />
                  <div className="preview-color c2" />
                  <div className="preview-color c3" />
                </div>
                <span className="palette-emoji">{palette.emoji}</span>
                <span className="palette-name">{palette.name}</span>
                {isActive && <div className="active-indicator" />}
              </button>
            )
          })}
        </div>

        {/* Preview de colores activos */}
        <div className="active-palette-preview">
          {PALETTES[activePalette].colors.map((color, i) => (
            <div 
              key={i}
              className="color-chip"
              style={{ background: color }}
            >
              <span className="color-hex">{color}</span>
            </div>
          ))}
        </div>

        {/* Controles de saturación e intensidad */}
        <div className="color-controls">
          <div className="control-row">
            <label className="control-label">
              <span className="label-icon">🎨</span>
              <span>Saturación</span>
            </label>
            <div className="slider-container">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={colors.saturation}
                onChange={(e) => setColorSaturation(parseFloat(e.target.value))}
                className="control-slider saturation"
              />
              <span className="slider-value">{Math.round(colors.saturation * 100)}%</span>
            </div>
          </div>

          <div className="control-row">
            <label className="control-label">
              <span className="label-icon">💡</span>
              <span>Intensidad</span>
            </label>
            <div className="slider-container">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={colors.intensity}
                onChange={(e) => setColorIntensity(parseFloat(e.target.value))}
                className="control-slider intensity"
              />
              <span className="slider-value">{Math.round(colors.intensity * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Quick presets */}
        <div className="quick-presets">
          <button 
            className="preset-btn"
            onClick={() => { setColorSaturation(0.5); setColorIntensity(0.3) }}
          >
            🌙 Suave
          </button>
          <button 
            className="preset-btn"
            onClick={() => { setColorSaturation(0.8); setColorIntensity(0.7) }}
          >
            ☀️ Normal
          </button>
          <button 
            className="preset-btn"
            onClick={() => { setColorSaturation(1); setColorIntensity(1) }}
          >
            🔥 Full
          </button>
        </div>
      </div>

      <style>{`
        .palette-reactor {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
        }

        .palette-header {
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
        }

        .palette-title {
          font-family: var(--font-display);
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--text-secondary);
          letter-spacing: 0.1em;
          margin: 0;
        }

        .palette-subtitle {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .palette-panel {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xl);
          padding: var(--space-lg);
          display: flex;
          flex-direction: column;
          gap: var(--space-lg);
        }

        /* Palette Grid */
        .palette-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--space-sm);
        }

        .palette-btn {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-xs);
          padding: var(--space-md);
          background: var(--bg-deep);
          border: 2px solid transparent;
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .palette-btn:hover {
          transform: translateY(-2px);
          border-color: var(--border-active);
        }

        .palette-btn.active {
          border-color: var(--p-color-1);
          box-shadow: 0 0 20px color-mix(in srgb, var(--p-color-1) 30%, transparent);
        }

        .palette-preview {
          display: flex;
          gap: 2px;
          border-radius: var(--radius-sm);
          overflow: hidden;
        }

        .preview-color {
          width: 16px;
          height: 24px;
        }

        .preview-color.c1 { background: var(--p-color-1); }
        .preview-color.c2 { background: var(--p-color-2); }
        .preview-color.c3 { background: var(--p-color-3); }

        .palette-emoji {
          font-size: 1.5rem;
        }

        .palette-name {
          font-family: var(--font-display);
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .palette-btn.active .palette-name {
          color: var(--text-primary);
        }

        .active-indicator {
          position: absolute;
          bottom: var(--space-xs);
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          background: var(--p-color-1);
          border-radius: 50%;
          box-shadow: 0 0 8px var(--p-color-1);
        }

        /* Active Palette Preview */
        .active-palette-preview {
          display: flex;
          gap: var(--space-xs);
          padding: var(--space-sm);
          background: var(--bg-deep);
          border-radius: var(--radius-md);
        }

        .color-chip {
          flex: 1;
          height: 40px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease;
        }

        .color-chip:hover {
          transform: scale(1.05);
        }

        .color-hex {
          font-family: var(--font-mono);
          font-size: 0.625rem;
          color: white;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .color-chip:hover .color-hex {
          opacity: 1;
        }

        /* Color Controls */
        .color-controls {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
        }

        .control-row {
          display: flex;
          align-items: center;
          gap: var(--space-md);
        }

        .control-label {
          display: flex;
          align-items: center;
          gap: var(--space-xs);
          min-width: 100px;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .label-icon {
          font-size: 1rem;
        }

        .slider-container {
          flex: 1;
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .control-slider {
          flex: 1;
          height: 8px;
          -webkit-appearance: none;
          appearance: none;
          background: var(--bg-deep);
          border-radius: var(--radius-full);
          outline: none;
        }

        .control-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          cursor: pointer;
          transition: transform 0.15s ease;
        }

        .control-slider.saturation::-webkit-slider-thumb {
          background: linear-gradient(135deg, #FF6B6B, #4ECDC4);
        }

        .control-slider.intensity::-webkit-slider-thumb {
          background: linear-gradient(135deg, #FBBF24, #FFFFFF);
        }

        .control-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }

        .slider-value {
          font-family: var(--font-mono);
          font-size: 0.875rem;
          color: var(--text-secondary);
          min-width: 45px;
          text-align: right;
        }

        /* Quick Presets */
        .quick-presets {
          display: flex;
          gap: var(--space-sm);
        }

        .preset-btn {
          flex: 1;
          padding: var(--space-sm) var(--space-md);
          background: var(--bg-deep);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          font-size: 0.75rem;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .preset-btn:hover {
          background: var(--bg-elevated);
          border-color: var(--border-active);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  )
}
