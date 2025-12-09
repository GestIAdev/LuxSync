/**
 * 🎯 MOVEMENT CONTROL - FILL SCREEN MODE
 * Visualizador de partículas grande + controles compactos
 * 
 * WAVE 3: Connected to window.lux.setMovement() for Selene integration
 * 
 * ✅ PATTERNS MATCH 1:1 - No translation needed!
 * UI: lissajous, circle, wave, figure8, scan, random
 * Engine: lissajous, circle, wave, figure8, scan, random, static
 */

import { useLuxSyncStore, MovementPattern } from '../stores/luxsyncStore'
import { useEffect, useRef, useCallback } from 'react'

// Map UI patterns to Selene MovementPatternId
const PATTERN_TO_SELENE: Record<MovementPattern, string> = {
  lissajous: 'lissajous',
  circle: 'circle',
  wave: 'wave',
  figure8: 'figure8',
  scan: 'scan',
  random: 'random',
}

const PATTERNS: { id: MovementPattern; icon: string; name: string }[] = [
  { id: 'lissajous', icon: '∞', name: 'Lissajous' },
  { id: 'circle', icon: '○', name: 'Circle' },
  { id: 'wave', icon: '∿', name: 'Wave' },
  { id: 'figure8', icon: '8', name: 'Figure 8' },
  { id: 'scan', icon: '⟷', name: 'Scan' },
  { id: 'random', icon: '✦', name: 'Random' },
]

export default function MovementControl() {
  const { movement, setMovementPattern, setMovementSpeed, setMovementRange } = useLuxSyncStore()
  
  // 🔗 WAVE 3: Send movement changes to Selene via IPC
  const sendToSelene = useCallback((pattern: string, speed: number, range: number) => {
    if (typeof window !== 'undefined' && window.lux?.setMovement) {
      window.lux.setMovement({
        pattern: pattern as any,
        speed,
        intensity: range, // range maps to intensity
      })
      console.log('[MovementControl] 🎯 Sent to Selene:', { pattern, speed, range })
    }
  }, [])

  // Handle pattern change
  const handlePatternChange = useCallback((patternId: MovementPattern) => {
    setMovementPattern(patternId)
    sendToSelene(PATTERN_TO_SELENE[patternId], movement.speed, movement.range)
  }, [setMovementPattern, sendToSelene, movement.speed, movement.range])

  // Handle speed change
  const handleSpeedChange = useCallback((speed: number) => {
    setMovementSpeed(speed)
    sendToSelene(PATTERN_TO_SELENE[movement.pattern], speed, movement.range)
  }, [setMovementSpeed, sendToSelene, movement.pattern, movement.range])

  // Handle range change
  const handleRangeChange = useCallback((range: number) => {
    setMovementRange(range)
    sendToSelene(PATTERN_TO_SELENE[movement.pattern], movement.speed, range)
  }, [setMovementRange, sendToSelene, movement.pattern, movement.speed])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Visualizador de partículas animado
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let time = 0
    const particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = []

    // Crear partículas
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 3 + 1,
        alpha: Math.random() * 0.5 + 0.3,
      })
    }

    const animate = () => {
      const { width, height } = canvas
      ctx.fillStyle = 'rgba(10, 10, 15, 0.15)'
      ctx.fillRect(0, 0, width, height)

      time += 0.02 * movement.speed

      // Centro del patrón
      const centerX = width / 2
      const centerY = height / 2
      const radius = Math.min(width, height) * 0.35 * movement.range

      // Calcular posición del "cabezal" según el patrón
      let headX = centerX
      let headY = centerY

      switch (movement.pattern) {
        case 'lissajous':
          headX = centerX + Math.sin(time * 2) * radius
          headY = centerY + Math.sin(time * 3) * radius * 0.7
          break
        case 'circle':
          headX = centerX + Math.cos(time) * radius
          headY = centerY + Math.sin(time) * radius
          break
        case 'wave':
          headX = centerX + Math.sin(time * 2) * radius
          headY = centerY + Math.sin(time * 4) * radius * 0.3
          break
        case 'figure8':
          headX = centerX + Math.sin(time) * radius
          headY = centerY + Math.sin(time * 2) * radius * 0.5
          break
        case 'scan':
          headX = centerX + Math.sin(time) * radius
          headY = centerY
          break
        case 'random':
          headX = centerX + (Math.sin(time * 1.3) + Math.sin(time * 2.7)) * radius * 0.5
          headY = centerY + (Math.cos(time * 1.7) + Math.cos(time * 2.3)) * radius * 0.5
          break
      }

      // Dibujar trail del cabezal
      const gradient = ctx.createRadialGradient(headX, headY, 0, headX, headY, 30)
      gradient.addColorStop(0, 'rgba(0, 255, 136, 0.8)')
      gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.4)')
      gradient.addColorStop(1, 'transparent')
      
      ctx.beginPath()
      ctx.arc(headX, headY, 30, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

      // Cabezal principal
      ctx.beginPath()
      ctx.arc(headX, headY, 8, 0, Math.PI * 2)
      ctx.fillStyle = '#00ff88'
      ctx.shadowColor = '#00ff88'
      ctx.shadowBlur = 20
      ctx.fill()
      ctx.shadowBlur = 0

      // Actualizar y dibujar partículas
      particles.forEach((p) => {
        // Atraer hacia el cabezal
        const dx = headX - p.x
        const dy = headY - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        
        if (dist > 20) {
          p.vx += (dx / dist) * 0.1
          p.vy += (dy / dist) * 0.1
        }

        p.vx *= 0.98
        p.vy *= 0.98

        p.x += p.vx
        p.y += p.vy

        // Wrap around
        if (p.x < 0) p.x = width
        if (p.x > width) p.x = 0
        if (p.y < 0) p.y = height
        if (p.y > height) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(139, 92, 246, ${p.alpha})`
        ctx.fill()
      })

      // Grid de fondo sutil
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'
      ctx.lineWidth = 1
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      animationId = requestAnimationFrame(animate)
    }

    // Resize handler
    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    animate()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
    }
  }, [movement.pattern, movement.speed, movement.range])

  return (
    <div className="movement-control">
      <h2 className="section-title">MOVEMENT CONTROL</h2>

      <div className="movement-panel">
        {/* Visualizador GRANDE - protagonista */}
        <div className="visualizer-container">
          <canvas ref={canvasRef} className="movement-canvas" />
          <div className="pattern-label">
            {PATTERNS.find(p => p.id === movement.pattern)?.icon} {movement.pattern.toUpperCase()}
          </div>
        </div>

        {/* Controles abajo */}
        <div className="movement-controls">
          {/* Selectores de patrón */}
          <div className="pattern-grid">
            {PATTERNS.map(({ id, icon, name }) => (
              <button
                key={id}
                className={`pattern-btn ${movement.pattern === id ? 'active' : ''}`}
                onClick={() => handlePatternChange(id)}
                title={name}
              >
                <span className="pattern-icon">{icon}</span>
              </button>
            ))}
          </div>

          {/* Sliders */}
          <div className="sliders-row">
            <div className="slider-group">
              <span className="slider-label">⚡ Speed</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={movement.speed}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                className="control-slider"
              />
              <span className="slider-value">{Math.round(movement.speed * 100)}%</span>
            </div>

            <div className="slider-group">
              <span className="slider-label">↔ Range</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={movement.range}
                onChange={(e) => handleRangeChange(parseFloat(e.target.value))}
                className="control-slider"
              />
              <span className="slider-value">{Math.round(movement.range * 100)}%</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .movement-control {
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
          height: 100%;
          max-height: 100%;
          overflow: hidden;
        }

        .section-title {
          font-family: var(--font-display);
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-secondary);
          letter-spacing: 0.1em;
          margin: 0;
          flex-shrink: 0;
        }

        .movement-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          overflow: hidden;
          min-height: 0;
          max-height: 100%;
        }

        /* Visualizador GRANDE */
        .visualizer-container {
          flex: 1;
          position: relative;
          min-height: 120px;
          max-height: 200px;
        }

        .movement-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }

        .pattern-label {
          position: absolute;
          top: var(--space-sm);
          left: var(--space-sm);
          font-family: var(--font-display);
          font-size: 0.7rem;
          color: var(--accent-primary);
          background: rgba(0, 0, 0, 0.6);
          padding: var(--space-xs) var(--space-sm);
          border-radius: var(--radius-sm);
          letter-spacing: 0.1em;
        }

        /* Controles compactos abajo */
        .movement-controls {
          flex: 0 0 auto;
          padding: var(--space-sm);
          background: var(--bg-deep);
          border-top: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
        }

        .pattern-grid {
          display: flex;
          gap: var(--space-xs);
          justify-content: center;
        }

        .pattern-btn {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-surface);
          border: 2px solid transparent;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .pattern-btn:hover {
          border-color: var(--border-active);
          background: var(--bg-elevated);
        }

        .pattern-btn.active {
          border-color: var(--accent-primary);
          background: var(--accent-primary-glow);
        }

        .pattern-icon {
          font-size: 1.2rem;
          color: var(--text-primary);
        }

        .pattern-btn.active .pattern-icon {
          color: var(--accent-primary);
          text-shadow: 0 0 10px var(--accent-primary);
        }

        .sliders-row {
          display: flex;
          gap: var(--space-md);
        }

        .slider-group {
          flex: 1;
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .slider-label {
          font-size: 0.65rem;
          color: var(--text-muted);
          white-space: nowrap;
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
          background: linear-gradient(to right, var(--bg-elevated) 0%, var(--accent-secondary-glow, rgba(139, 92, 246, 0.3)) 100%);
          border-radius: 4px;
        }

        .control-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--accent-secondary);
          cursor: pointer;
          box-shadow: 0 0 15px var(--accent-secondary), 0 2px 4px rgba(0,0,0,0.5);
          margin-top: -5px;
          border: 2px solid var(--bg-deepest);
        }

        .control-slider::-moz-range-track {
          height: 8px;
          background: linear-gradient(to right, var(--bg-elevated) 0%, rgba(139, 92, 246, 0.3) 100%);
          border-radius: 4px;
        }

        .control-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--accent-secondary);
          cursor: pointer;
          box-shadow: 0 0 15px var(--accent-secondary);
          border: 2px solid var(--bg-deepest);
        }

        .slider-value {
          font-family: var(--font-mono);
          font-size: 0.65rem;
          color: var(--accent-secondary);
          width: 35px;
          text-align: right;
        }
      `}</style>
    </div>
  )
}
