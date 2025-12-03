/**
 * 🕹️ MOVEMENT CONTROL - Control de patrones de movimiento
 * Pattern selector + Speed, Range sliders con locks
 */

import { useLuxSyncStore, MovementPattern } from '../stores/luxsyncStore'

const PATTERNS: { id: MovementPattern; label: string; icon: string; description: string }[] = [
  { id: 'lissajous', label: 'Lissajous', icon: '∞', description: 'Curvas orgánicas' },
  { id: 'circle', label: 'Circle', icon: '○', description: 'Movimiento circular' },
  { id: 'wave', label: 'Wave', icon: '〰️', description: 'Olas suaves' },
  { id: 'figure8', label: 'Figure 8', icon: '8', description: 'Forma de ocho' },
  { id: 'scan', label: 'Scan', icon: '↔️', description: 'Barrido lineal' },
  { id: 'random', label: 'Random', icon: '🎲', description: 'Impredecible' },
]

export default function MovementControl() {
  const { 
    movement, 
    setMovementPattern, 
    setMovementSpeed, 
    setMovementRange, 
    toggleMovementLock 
  } = useLuxSyncStore()

  const currentPattern = PATTERNS.find((p) => p.id === movement.pattern) || PATTERNS[0]

  return (
    <div className="movement-control">
      <div className="movement-header">
        <h2 className="movement-title">MOVEMENT CONTROL</h2>
        <span className="movement-subtitle">Motion Engine</span>
      </div>

      <div className="movement-panel">
        {/* Pattern Selector */}
        <div className="pattern-section">
          <label className="section-label">Pattern</label>
          <div className="pattern-selector">
            <button 
              className="pattern-dropdown"
              disabled={movement.locked.pattern}
            >
              <span className="pattern-icon">{currentPattern.icon}</span>
              <span className="pattern-name">{currentPattern.label}</span>
              <span className="dropdown-arrow">▼</span>
            </button>
            
            <div className="pattern-options">
              {PATTERNS.map((pattern) => (
                <button
                  key={pattern.id}
                  className={`pattern-option ${movement.pattern === pattern.id ? 'active' : ''}`}
                  onClick={() => setMovementPattern(pattern.id)}
                  disabled={movement.locked.pattern}
                >
                  <span className="option-icon">{pattern.icon}</span>
                  <div className="option-info">
                    <span className="option-name">{pattern.label}</span>
                    <span className="option-desc">{pattern.description}</span>
                  </div>
                </button>
              ))}
            </div>
            
            <button 
              className={`lock-btn ${movement.locked.pattern ? 'locked' : ''}`}
              onClick={() => toggleMovementLock('pattern')}
            >
              {movement.locked.pattern ? '🔒' : '🔓'}
            </button>
          </div>
        </div>

        {/* Speed Slider */}
        <div className="slider-section">
          <div className="slider-header">
            <label className="section-label">
              <span className="label-icon">⚡</span>
              Speed
            </label>
            <button 
              className={`lock-btn ${movement.locked.speed ? 'locked' : ''}`}
              onClick={() => toggleMovementLock('speed')}
            >
              {movement.locked.speed ? '🔒' : '🔓'}
            </button>
          </div>
          <div className="slider-row">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={movement.speed}
              onChange={(e) => setMovementSpeed(parseFloat(e.target.value))}
              className={`motion-slider ${movement.locked.speed ? 'locked' : ''}`}
              disabled={movement.locked.speed}
            />
            <span className="slider-value">{Math.round(movement.speed * 100)}%</span>
          </div>
          <div className="slider-visual">
            <div 
              className="visual-fill speed"
              style={{ width: `${movement.speed * 100}%` }}
            />
          </div>
        </div>

        {/* Range Slider */}
        <div className="slider-section">
          <div className="slider-header">
            <label className="section-label">
              <span className="label-icon">↔️</span>
              Range
            </label>
            <button 
              className={`lock-btn ${movement.locked.range ? 'locked' : ''}`}
              onClick={() => toggleMovementLock('range')}
            >
              {movement.locked.range ? '🔒' : '🔓'}
            </button>
          </div>
          <div className="slider-row">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={movement.range}
              onChange={(e) => setMovementRange(parseFloat(e.target.value))}
              className={`motion-slider ${movement.locked.range ? 'locked' : ''}`}
              disabled={movement.locked.range}
            />
            <span className="slider-value">{Math.round(movement.range * 100)}%</span>
          </div>
          <div className="slider-visual">
            <div 
              className="visual-fill range"
              style={{ width: `${movement.range * 100}%` }}
            />
          </div>
        </div>

        {/* Visual Preview */}
        <div className="motion-preview">
          <div className="preview-dot" style={{
            animation: `${movement.pattern}-motion ${2 - movement.speed}s ease-in-out infinite`,
            '--range': movement.range,
          } as React.CSSProperties} />
        </div>
      </div>

      <style>{`
        .movement-control {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
        }

        .movement-header {
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
        }

        .movement-title {
          font-family: var(--font-display);
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--text-secondary);
          letter-spacing: 0.1em;
          margin: 0;
        }

        .movement-subtitle {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .movement-panel {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xl);
          padding: var(--space-lg);
          display: flex;
          flex-direction: column;
          gap: var(--space-lg);
        }

        .section-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          gap: var(--space-xs);
        }

        .label-icon {
          font-size: 0.875rem;
        }

        /* Pattern Selector */
        .pattern-section {
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
        }

        .pattern-selector {
          position: relative;
          display: flex;
          gap: var(--space-sm);
        }

        .pattern-dropdown {
          flex: 1;
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          padding: var(--space-md);
          background: var(--bg-deep);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .pattern-dropdown:hover:not(:disabled) {
          border-color: var(--border-active);
        }

        .pattern-dropdown:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pattern-icon {
          font-size: 1.25rem;
          width: 24px;
          text-align: center;
        }

        .pattern-name {
          flex: 1;
          text-align: left;
          font-weight: 500;
          color: var(--text-primary);
        }

        .dropdown-arrow {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .pattern-options {
          display: none;
          position: absolute;
          top: 100%;
          left: 0;
          right: 40px;
          margin-top: var(--space-xs);
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          overflow: hidden;
          z-index: 10;
          box-shadow: var(--shadow-lg);
        }

        .pattern-selector:focus-within .pattern-options {
          display: block;
        }

        .pattern-option {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          width: 100%;
          padding: var(--space-sm) var(--space-md);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .pattern-option:hover {
          background: var(--bg-surface);
        }

        .pattern-option.active {
          background: var(--bg-deep);
        }

        .option-icon {
          font-size: 1rem;
          width: 24px;
          text-align: center;
        }

        .option-info {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .option-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-primary);
        }

        .option-desc {
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .lock-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-deep);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.2s ease;
        }

        .lock-btn:hover {
          background: var(--bg-elevated);
        }

        .lock-btn.locked {
          background: color-mix(in srgb, var(--accent-danger) 20%, transparent);
          border-color: var(--accent-danger);
        }

        /* Sliders */
        .slider-section {
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
        }

        .slider-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .slider-row {
          display: flex;
          align-items: center;
          gap: var(--space-md);
        }

        .motion-slider {
          flex: 1;
          height: 8px;
          -webkit-appearance: none;
          appearance: none;
          background: var(--bg-deep);
          border-radius: var(--radius-full);
          outline: none;
        }

        .motion-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          background: var(--accent-secondary);
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .motion-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }

        .motion-slider.locked::-webkit-slider-thumb {
          background: var(--text-muted);
          cursor: not-allowed;
        }

        .slider-value {
          font-family: var(--font-mono);
          font-size: 0.875rem;
          color: var(--text-secondary);
          min-width: 45px;
          text-align: right;
        }

        .slider-visual {
          height: 4px;
          background: var(--bg-deep);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .visual-fill {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width 0.3s ease;
        }

        .visual-fill.speed {
          background: linear-gradient(90deg, var(--accent-secondary), var(--accent-warning));
        }

        .visual-fill.range {
          background: linear-gradient(90deg, var(--accent-primary), var(--accent-success));
        }

        /* Motion Preview */
        .motion-preview {
          height: 60px;
          background: var(--bg-deep);
          border-radius: var(--radius-md);
          position: relative;
          overflow: hidden;
        }

        .preview-dot {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 12px;
          height: 12px;
          background: var(--accent-primary);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 10px var(--accent-primary);
        }

        @keyframes lissajous-motion {
          0%, 100% { transform: translate(calc(-50% + calc(40px * var(--range))), calc(-50% + calc(20px * var(--range)))); }
          25% { transform: translate(calc(-50% - calc(40px * var(--range))), calc(-50% - calc(20px * var(--range)))); }
          50% { transform: translate(calc(-50% + calc(40px * var(--range))), calc(-50% - calc(20px * var(--range)))); }
          75% { transform: translate(calc(-50% - calc(40px * var(--range))), calc(-50% + calc(20px * var(--range)))); }
        }

        @keyframes circle-motion {
          0% { transform: translate(calc(-50% + calc(30px * var(--range))), -50%); }
          25% { transform: translate(-50%, calc(-50% + calc(20px * var(--range)))); }
          50% { transform: translate(calc(-50% - calc(30px * var(--range))), -50%); }
          75% { transform: translate(-50%, calc(-50% - calc(20px * var(--range)))); }
          100% { transform: translate(calc(-50% + calc(30px * var(--range))), -50%); }
        }

        @keyframes wave-motion {
          0%, 100% { transform: translate(calc(-50% - calc(40px * var(--range))), -50%); }
          25% { transform: translate(calc(-50% - calc(20px * var(--range))), calc(-50% - calc(15px * var(--range)))); }
          50% { transform: translate(-50%, -50%); }
          75% { transform: translate(calc(-50% + calc(20px * var(--range))), calc(-50% + calc(15px * var(--range)))); }
        }

        @keyframes figure8-motion {
          0%, 100% { transform: translate(-50%, calc(-50% - calc(15px * var(--range)))); }
          25% { transform: translate(calc(-50% + calc(30px * var(--range))), -50%); }
          50% { transform: translate(-50%, calc(-50% + calc(15px * var(--range)))); }
          75% { transform: translate(calc(-50% - calc(30px * var(--range))), -50%); }
        }

        @keyframes scan-motion {
          0%, 100% { transform: translate(calc(-50% - calc(50px * var(--range))), -50%); }
          50% { transform: translate(calc(-50% + calc(50px * var(--range))), -50%); }
        }

        @keyframes random-motion {
          0% { transform: translate(-50%, -50%); }
          20% { transform: translate(calc(-50% + calc(30px * var(--range))), calc(-50% - calc(15px * var(--range)))); }
          40% { transform: translate(calc(-50% - calc(20px * var(--range))), calc(-50% + calc(10px * var(--range)))); }
          60% { transform: translate(calc(-50% + calc(10px * var(--range))), calc(-50% + calc(20px * var(--range)))); }
          80% { transform: translate(calc(-50% - calc(35px * var(--range))), calc(-50% - calc(5px * var(--range)))); }
          100% { transform: translate(-50%, -50%); }
        }
      `}</style>
    </div>
  )
}
