/**
 * 🔭 SIMULATE VIEW - 3D Stage Visualization
 * WAVE 9.2: Visualización del escenario y fixtures
 * Conectado al DMX Store para datos reales
 */

import React, { useState, useRef, useEffect } from 'react'
import { useDMXStore } from '../../../stores/dmxStore'
import './SimulateView.css'

// Tipos para fixtures demo
interface DemoFixture {
  id: number
  name: string
  type: 'moving-head' | 'par' | 'strobe' | 'laser'
  address: number
  channels: number
  active: boolean
  color: string
}

// Fixtures de demo (hasta que se conecte con el real)
const DEMO_FIXTURES: DemoFixture[] = [
  { id: 1, name: 'Moving Head #1', type: 'moving-head', address: 1, channels: 16, active: true, color: '#00fff0' },
  { id: 2, name: 'Moving Head #2', type: 'moving-head', address: 17, channels: 16, active: true, color: '#a855f7' },
  { id: 3, name: 'Moving Head #3', type: 'moving-head', address: 33, channels: 16, active: true, color: '#ff00ff' },
  { id: 4, name: 'Moving Head #4', type: 'moving-head', address: 49, channels: 16, active: false, color: '#00ff88' },
  { id: 5, name: 'PAR LED #1', type: 'par', address: 65, channels: 6, active: true, color: '#ff6b35' },
  { id: 6, name: 'PAR LED #2', type: 'par', address: 71, channels: 6, active: true, color: '#ffd700' },
  { id: 7, name: 'PAR LED #3', type: 'par', address: 77, channels: 6, active: true, color: '#ef4444' },
  { id: 8, name: 'PAR LED #4', type: 'par', address: 83, channels: 6, active: false, color: '#22d3ee' },
]

const SimulateView: React.FC = () => {
  const { isConnected: dmxConnected } = useDMXStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // Control states
  const [showBeams, setShowBeams] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [showHaze, setShowHaze] = useState(false)
  const [showDMX, setShowDMX] = useState(false)
  const [selectedFixture, setSelectedFixture] = useState<number | null>(null)

  // Simple canvas animation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    let animationId: number
    let time = 0

    const draw = () => {
      time += 0.02
      const { width, height } = canvas
      
      // Clear
      ctx.fillStyle = '#0a0a12'
      ctx.fillRect(0, 0, width, height)

      // Draw grid
      if (showGrid) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
        ctx.lineWidth = 1
        const gridSize = 40
        for (let x = 0; x < width; x += gridSize) {
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, height)
          ctx.stroke()
        }
        for (let y = 0; y < height; y += gridSize) {
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(width, y)
          ctx.stroke()
        }
      }

      // Draw truss
      const trussY = 60
      ctx.fillStyle = '#333'
      ctx.fillRect(40, trussY, width - 80, 8)

      // Draw fixtures and beams
      const fixtureSpacing = (width - 80) / (DEMO_FIXTURES.length + 1)
      
      DEMO_FIXTURES.forEach((fixture, i) => {
        const x = 40 + fixtureSpacing * (i + 1)
        const y = trussY + 20
        
        // Fixture dot
        ctx.beginPath()
        ctx.arc(x, y, fixture.active ? 8 : 5, 0, Math.PI * 2)
        ctx.fillStyle = fixture.active ? fixture.color : '#444'
        ctx.fill()
        
        // Glow effect
        if (fixture.active) {
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, 20)
          gradient.addColorStop(0, fixture.color + '80')
          gradient.addColorStop(1, 'transparent')
          ctx.fillStyle = gradient
          ctx.fillRect(x - 20, y - 20, 40, 40)
        }
        
        // Light beams
        if (showBeams && fixture.active && fixture.type === 'moving-head') {
          const beamAngle = Math.sin(time + i) * 0.3
          const beamLength = height - y - 60
          
          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(beamAngle)
          
          const beamGradient = ctx.createLinearGradient(0, 0, 0, beamLength)
          beamGradient.addColorStop(0, fixture.color + '60')
          beamGradient.addColorStop(1, 'transparent')
          
          ctx.beginPath()
          ctx.moveTo(-3, 0)
          ctx.lineTo(-40, beamLength)
          ctx.lineTo(40, beamLength)
          ctx.lineTo(3, 0)
          ctx.closePath()
          ctx.fillStyle = beamGradient
          ctx.fill()
          
          ctx.restore()
        }
      })

      // Floor
      const floorY = height - 40
      ctx.fillStyle = '#1a1a24'
      ctx.fillRect(0, floorY, width, 40)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.strokeRect(0, floorY, width, 40)

      // Haze effect
      if (showHaze) {
        for (let i = 0; i < 50; i++) {
          const px = Math.random() * width
          const py = Math.random() * (height - 80) + 60
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.03})`
          ctx.fillRect(px, py, 2, 2)
        }
      }

      animationId = requestAnimationFrame(draw)
    }

    draw()

    return () => cancelAnimationFrame(animationId)
  }, [showBeams, showGrid, showHaze])

  return (
    <div className="simulate-view">
      <header className="view-header">
        <h2 className="view-title">🔭 SIMULATE MODE</h2>
        <div className="view-status">
          <span className={`dmx-badge ${dmxConnected ? 'connected' : 'disconnected'}`}>
            {dmxConnected ? '● DMX' : '○ DMX'}
          </span>
          <span className="fixture-count">{DEMO_FIXTURES.length} fixtures</span>
        </div>
      </header>

      <div className="simulate-content">
        {/* Stage Canvas */}
        <section className="stage-canvas">
          <canvas ref={canvasRef} className="stage-canvas-element" />
          <div className="canvas-controls">
            <span>[Drag to rotate]</span>
            <span>[Scroll to zoom]</span>
            <span>[R to reset]</span>
          </div>
        </section>

        {/* Bottom Panel */}
        <div className="simulate-panels">
          {/* Fixture List */}
          <section className="panel fixture-list">
            <h3>📋 FIXTURES ({DEMO_FIXTURES.length})</h3>
            <div className="fixture-items">
              {DEMO_FIXTURES.map(fixture => (
                <div 
                  key={fixture.id}
                  className={`fixture-item ${selectedFixture === fixture.id ? 'selected' : ''} ${fixture.active ? 'active' : ''}`}
                  onClick={() => setSelectedFixture(fixture.id === selectedFixture ? null : fixture.id)}
                >
                  <span 
                    className="fixture-status"
                    style={{ color: fixture.active ? fixture.color : '#444' }}
                  >
                    {fixture.active ? '◉' : '○'}
                  </span>
                  <span className="fixture-name">{fixture.name}</span>
                  <span className="fixture-address">[{String(fixture.address).padStart(3, '0')}]</span>
                </div>
              ))}
            </div>
          </section>

          {/* Controls */}
          <section className="panel simulator-controls">
            <h3>⚙️ CONTROLS</h3>
            <div className="control-items">
              <label className="control-checkbox">
                <input 
                  type="checkbox" 
                  checked={showBeams}
                  onChange={(e) => setShowBeams(e.target.checked)}
                />
                <span>Show Beams</span>
              </label>
              <label className="control-checkbox">
                <input 
                  type="checkbox" 
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                />
                <span>Show Grid</span>
              </label>
              <label className="control-checkbox">
                <input 
                  type="checkbox" 
                  checked={showHaze}
                  onChange={(e) => setShowHaze(e.target.checked)}
                />
                <span>Add Haze Effect</span>
              </label>
              <label className="control-checkbox">
                <input 
                  type="checkbox" 
                  checked={showDMX}
                  onChange={(e) => setShowDMX(e.target.checked)}
                />
                <span>Show DMX Values</span>
              </label>
            </div>
            <div className="control-buttons">
              <button className="btn btn-secondary">📷 Screenshot</button>
              <button className="btn btn-secondary">📹 Record GIF</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default SimulateView
