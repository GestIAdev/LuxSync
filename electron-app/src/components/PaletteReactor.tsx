/**
 * 🎨 PALETTE REACTOR - FILL SCREEN MODE
 * Botones que crecen para llenar el espacio disponible
 * 
 * Wave 3: Conectado con Selene Lux Core via window.lux
 * 
 * FIX Trinity: Los botones ahora envían strings canónicos al ColorEngine
 * UI usa inglés (fire/ice) → Engine usa español (fuego/hielo)
 */

import { useLuxSyncStore, PALETTES, PaletteId } from '../stores/luxsyncStore'
import { useSeleneColor } from '../hooks'

// IDs canónicos que espera el ColorEngine (español)
type LivingPaletteId = 'fuego' | 'hielo' | 'selva' | 'neon'

const PALETTE_IDS: PaletteId[] = ['fire', 'ice', 'jungle', 'neon']

// 🔗 MAPEO UI → ENGINE (inglés → español)
// El ColorEngine usa nombres en español para las fórmulas matemáticas
const PALETTE_ENGINE_MAP: Record<PaletteId, LivingPaletteId> = {
  fire: 'fuego',    // Algoritmo de rojos/naranjas dinámicos
  ice: 'hielo',     // Algoritmo de azules/cyans con mínimo 25%
  jungle: 'selva',  // Algoritmo de verdes/dorados tropicales  
  neon: 'neon',     // Algoritmo de magentas/cyans cyberpunk
}

export default function PaletteReactor() {
  const { 
    activePalette, 
    colors, 
    setActivePalette, 
    setColorSaturation, 
    setColorIntensity 
  } = useLuxSyncStore()

  // Color actual de Selene para preview
  const seleneColor = useSeleneColor()

  // Handler que actualiza UI y envía a Selene
  const handlePaletteClick = (id: PaletteId) => {
    setActivePalette(id)
    
    // Enviar a Selene Lux Core - AHORA CON STRING CANÓNICO
    if (window.lux) {
      const enginePaletteId = PALETTE_ENGINE_MAP[id]
      window.lux.setPalette(enginePaletteId)
      console.log(`[PaletteReactor] 🎨 Sent palette "${enginePaletteId}" to ColorEngine (UI: ${id})`)
    }
  }
  
  // 🎨 WAVE 13.6: STATE OF TRUTH - Controlar multiplicadores globales en el Backend
  const handleSaturationChange = (value: number) => {
    setColorSaturation(value) // Update UI
    if (window.lux?.setGlobalColorParams) {
      window.lux.setGlobalColorParams({ saturation: value })
        .then(result => {
          if (result.success) {
            console.log(`[PaletteReactor] 🎨 Global Saturation: ${(value * 100).toFixed(0)}%`)
          }
        })
        .catch(err => console.error('[PaletteReactor] ❌ Failed to set saturation:', err))
    }
  }
  
  const handleIntensityChange = (value: number) => {
    setColorIntensity(value) // Update UI
    if (window.lux?.setGlobalColorParams) {
      window.lux.setGlobalColorParams({ intensity: value })
        .then(result => {
          if (result.success) {
            console.log(`[PaletteReactor] 💡 Global Intensity: ${(value * 100).toFixed(0)}%`)
          }
        })
        .catch(err => console.error('[PaletteReactor] ❌ Failed to set intensity:', err))
    }
  }

  return (
    <div className="palette-reactor">
      <h2 className="section-title">
        PALETTE REACTOR
        {/* Preview del color actual de Selene */}
        <span 
          className="selene-color-preview"
          style={{ 
            background: `rgb(${seleneColor.r}, ${seleneColor.g}, ${seleneColor.b})`,
            boxShadow: `0 0 10px rgb(${seleneColor.r}, ${seleneColor.g}, ${seleneColor.b})`
          }}
        />
      </h2>

      {/* Panel que crece - flex: 1 */}
      <div className="palette-panel">
        {/* Grid de Paletas - CRECEN verticalmente */}
        <div className="palette-grid">
          {PALETTE_IDS.map((id) => {
            const palette = PALETTES[id]
            const isActive = activePalette === id
            
            return (
              <button
                key={id}
                className={`palette-btn ${isActive ? 'active' : ''}`}
                onClick={() => handlePaletteClick(id)}
              >
                {/* Preview de colores - ocupa todo el botón */}
                <div className="palette-colors">
                  {palette.colors.map((color, i) => (
                    <div 
                      key={i} 
                      className="color-band" 
                      style={{ background: color }} 
                    />
                  ))}
                </div>
                
                {/* Info overlay */}
                <div className="palette-info">
                  <span className="palette-emoji">{palette.emoji}</span>
                  <span className="palette-name">{palette.name}</span>
                </div>

                {/* Active indicator */}
                {isActive && <div className="active-glow" />}
              </button>
            )
          })}
        </div>

        {/* Controles de Saturación e Intensidad */}
        <div className="color-controls">
          <div className="control-row">
            <span className="label-icon">🎨</span>
            <span className="label-text">Saturation</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={colors.saturation}
              onChange={(e) => handleSaturationChange(parseFloat(e.target.value))}
              className="control-slider"
            />
            <span className="slider-value">{Math.round(colors.saturation * 100)}%</span>
          </div>

          <div className="control-row">
            <span className="label-icon">💡</span>
            <span className="label-text">Intensity</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={colors.intensity}
              onChange={(e) => handleIntensityChange(parseFloat(e.target.value))}
              className="control-slider"
            />
            <span className="slider-value">{Math.round(colors.intensity * 100)}%</span>
          </div>
        </div>
      </div>

      <style>{`
        .palette-reactor {
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
          flex: 1;
          min-height: 0;
        }

        .section-title {
          font-family: var(--font-display);
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-secondary);
          letter-spacing: 0.1em;
          margin: 0;
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .selene-color-preview {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          transition: all 0.1s ease;
        }

        .palette-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: var(--space-sm);
          min-height: 0;
        }

        /* Grid 4 columnas - CRECE */
        .palette-grid {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--space-sm);
          min-height: 80px;
        }

        /* Botones que llenan todo */
        .palette-btn {
          position: relative;
          display: flex;
          flex-direction: column;
          background: var(--bg-deep);
          border: 3px solid transparent;
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all 0.2s ease;
          overflow: hidden;
          min-height: 100%;
        }

        .palette-btn:hover {
          border-color: var(--border-active);
          transform: scale(1.02);
        }

        .palette-btn.active {
          border-color: var(--accent-primary);
          box-shadow: 0 0 20px var(--accent-primary-glow);
        }

        /* Colores ocupan TODO el botón */
        .palette-colors {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          z-index: 1;
        }

        .color-band {
          flex: 1;
          min-height: 20px;
          transition: all 0.3s ease;
        }

        .palette-btn:hover .color-band {
          filter: brightness(1.2);
        }

        /* Info overlay en la parte inferior */
        .palette-info {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: var(--space-sm);
          background: linear-gradient(transparent 0%, rgba(0,0,0,0.95) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-xs);
          z-index: 2;
        }

        .palette-emoji {
          font-size: 1rem;
        }

        .palette-name {
          font-family: var(--font-display);
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--text-primary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .active-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at center, var(--accent-primary-glow) 0%, transparent 70%);
          pointer-events: none;
          animation: glow-pulse 2s ease-in-out infinite;
        }

        @keyframes glow-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }

        /* Controles - fijos abajo */
        .color-controls {
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
          padding-top: var(--space-sm);
          border-top: 1px solid var(--border-subtle);
        }

        .control-row {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .label-icon {
          font-size: 0.875rem;
          width: 20px;
        }

        .label-text {
          font-size: 0.65rem;
          color: var(--text-muted);
          width: 60px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .control-slider {
          flex: 1;
          height: 8px;
          -webkit-appearance: none;
          appearance: none;
          background: linear-gradient(to right, var(--bg-deep) 0%, var(--border-subtle) 100%);
          border-radius: 4px;
          outline: none;
          border: 1px solid var(--border-subtle);
        }

        .control-slider::-webkit-slider-runnable-track {
          height: 8px;
          background: linear-gradient(to right, var(--bg-elevated) 0%, var(--accent-primary-glow) 100%);
          border-radius: 4px;
        }

        .control-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--accent-primary);
          cursor: pointer;
          box-shadow: 0 0 15px var(--accent-primary), 0 2px 4px rgba(0,0,0,0.5);
          margin-top: -5px;
          border: 2px solid var(--bg-deepest);
        }

        .control-slider::-moz-range-track {
          height: 8px;
          background: linear-gradient(to right, var(--bg-elevated) 0%, var(--accent-primary-glow) 100%);
          border-radius: 4px;
        }

        .control-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--accent-primary);
          cursor: pointer;
          box-shadow: 0 0 15px var(--accent-primary);
          border: 2px solid var(--bg-deepest);
        }

        .slider-value {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: var(--accent-primary);
          width: 40px;
          text-align: right;
        }
      `}</style>
    </div>
  )
}
