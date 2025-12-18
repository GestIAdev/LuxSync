/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🕹️ MOVEMENT RADAR - WAVE 33.3: Kinetic Control Widget
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Un widget interactivo que muestra y controla el movimiento de los fixtures:
 * 
 * VISUAL:
 * - Grid polar de fondo (círculos concéntricos + líneas radiales)
 * - Punto central arrastrable (basePan/baseTilt)
 * - Estela animada mostrando el patrón de movimiento actual
 * 
 * CONTROLES:
 * - Slider vertical derecha: SIZE (amplitud del movimiento)
 * - Slider horizontal abajo: SPEED (velocidad del patrón)
 * - Selector de patrón: Circle, Eight, Sweep
 * 
 * @module components/views/StageViewDual/sidebar/widgets/MovementRadar
 * @version 33.3.0
 */

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useControlStore, FlowPattern } from '../../../../../stores/controlStore'
import './MovementRadar.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

// Movement patterns align with FlowPattern from controlStore
export type MovementPattern = 'circle' | 'eight' | 'sweep' | 'static'

interface RadarPoint {
  x: number  // -1 to 1 (normalized)
  y: number  // -1 to 1 (normalized)
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const PATTERNS: { id: MovementPattern; label: string; icon: string }[] = [
  { id: 'circle', label: 'Circle', icon: '○' },
  { id: 'eight', label: 'Eight', icon: '∞' },
  { id: 'sweep', label: 'Sweep', icon: '↔' },
]

const TRAIL_LENGTH = 30
const ANIMATION_INTERVAL = 50 // ms

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export interface MovementRadarProps {
  className?: string
}

export const MovementRadar: React.FC<MovementRadarProps> = ({
  className = '',
}) => {
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>(0)
  const phaseRef = useRef<number>(0)
  
  // Local State
  const [basePosition, setBasePosition] = useState<RadarPoint>({ x: 0, y: 0 })
  const [pattern, setPattern] = useState<MovementPattern>('circle')
  const [size, setSize] = useState(0.5) // 0-1
  const [speed, setSpeed] = useState(0.5) // 0-1
  const [isDragging, setIsDragging] = useState(false)
  const [trail, setTrail] = useState<RadarPoint[]>([])
  
  // 🔌 WAVE 33.4: Connect to controlStore
  const setFlowParams = useControlStore(state => state.setFlowParams)
  
  // ═══════════════════════════════════════════════════════════════════════
  // PATTERN CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  const calculatePatternPoint = useCallback((phase: number): RadarPoint => {
    const amplitude = size * 0.8 // Max 80% of radius
    
    switch (pattern) {
      case 'circle':
        return {
          x: basePosition.x + Math.cos(phase) * amplitude,
          y: basePosition.y + Math.sin(phase) * amplitude,
        }
      
      case 'eight':
        return {
          x: basePosition.x + Math.sin(phase) * amplitude,
          y: basePosition.y + Math.sin(phase * 2) * amplitude * 0.5,
        }
      
      case 'sweep':
        return {
          x: basePosition.x + Math.sin(phase) * amplitude,
          y: basePosition.y,
        }
      
      default:
        return basePosition
    }
  }, [basePosition, pattern, size])
  
  // ═══════════════════════════════════════════════════════════════════════
  // CANVAS DRAWING
  // ═══════════════════════════════════════════════════════════════════════
  
  const drawRadar = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const { width, height } = canvas
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) / 2 - 10
    
    // Clear
    ctx.clearRect(0, 0, width, height)
    
    // ─── POLAR GRID ───────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)'
    ctx.lineWidth = 1
    
    // Concentric circles
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath()
      ctx.arc(centerX, centerY, (radius / 4) * i, 0, Math.PI * 2)
      ctx.stroke()
    }
    
    // Radial lines (every 45°)
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.lineTo(
        centerX + Math.cos(angle) * radius,
        centerY + Math.sin(angle) * radius
      )
      ctx.stroke()
    }
    
    // ─── TRAIL ────────────────────────────────────────────────────────────
    if (trail.length > 1) {
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(255, 0, 255, 0.6)'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      
      const firstPoint = trail[0]
      ctx.moveTo(
        centerX + firstPoint.x * radius,
        centerY + firstPoint.y * radius
      )
      
      for (let i = 1; i < trail.length; i++) {
        const point = trail[i]
        const alpha = i / trail.length
        ctx.strokeStyle = `rgba(255, 0, 255, ${alpha * 0.8})`
        ctx.lineTo(
          centerX + point.x * radius,
          centerY + point.y * radius
        )
      }
      ctx.stroke()
      
      // Glow effect on last point
      const lastPoint = trail[trail.length - 1]
      const glowX = centerX + lastPoint.x * radius
      const glowY = centerY + lastPoint.y * radius
      
      const gradient = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, 12)
      gradient.addColorStop(0, 'rgba(255, 0, 255, 0.8)')
      gradient.addColorStop(1, 'rgba(255, 0, 255, 0)')
      
      ctx.beginPath()
      ctx.fillStyle = gradient
      ctx.arc(glowX, glowY, 12, 0, Math.PI * 2)
      ctx.fill()
    }
    
    // ─── BASE POINT (Draggable) ───────────────────────────────────────────
    const baseX = centerX + basePosition.x * radius
    const baseY = centerY + basePosition.y * radius
    
    // Outer ring
    ctx.beginPath()
    ctx.strokeStyle = isDragging ? '#00ffff' : 'rgba(0, 255, 255, 0.6)'
    ctx.lineWidth = 2
    ctx.arc(baseX, baseY, 14, 0, Math.PI * 2)
    ctx.stroke()
    
    // Inner fill
    ctx.beginPath()
    ctx.fillStyle = isDragging ? 'rgba(0, 255, 255, 0.4)' : 'rgba(0, 255, 255, 0.2)'
    ctx.arc(baseX, baseY, 12, 0, Math.PI * 2)
    ctx.fill()
    
    // Center dot
    ctx.beginPath()
    ctx.fillStyle = '#00ffff'
    ctx.arc(baseX, baseY, 4, 0, Math.PI * 2)
    ctx.fill()
    
    // ─── CROSSHAIR AT CENTER ──────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    
    ctx.beginPath()
    ctx.moveTo(centerX - 20, centerY)
    ctx.lineTo(centerX + 20, centerY)
    ctx.moveTo(centerX, centerY - 20)
    ctx.lineTo(centerX, centerY + 20)
    ctx.stroke()
    
    ctx.setLineDash([])
    
  }, [basePosition, trail, isDragging])
  
  // ═══════════════════════════════════════════════════════════════════════
  // ANIMATION LOOP
  // ═══════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const animate = () => {
      // Update phase based on speed
      phaseRef.current += (speed * 0.15) // Speed factor
      
      // Calculate current point on pattern
      const currentPoint = calculatePatternPoint(phaseRef.current)
      
      // Update trail
      setTrail(prev => {
        const newTrail = [...prev, currentPoint]
        if (newTrail.length > TRAIL_LENGTH) {
          newTrail.shift()
        }
        return newTrail
      })
    }
    
    const intervalId = setInterval(animate, ANIMATION_INTERVAL)
    return () => clearInterval(intervalId)
  }, [calculatePatternPoint, speed])
  
  // Redraw on state changes
  useEffect(() => {
    drawRadar()
  }, [drawRadar, trail])
  
  // ═══════════════════════════════════════════════════════════════════════
  // MOUSE HANDLERS (Drag base point)
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Use rect dimensions (CSS size) not canvas.width/height (internal resolution)
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const radius = Math.min(rect.width, rect.height) / 2 - 10
    
    const baseX = centerX + basePosition.x * radius
    const baseY = centerY + basePosition.y * radius
    
    // Check if clicked on base point
    const dx = x - baseX
    const dy = y - baseY
    if (Math.sqrt(dx * dx + dy * dy) < 20) {
      setIsDragging(true)
    }
  }, [basePosition])
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Use rect dimensions (CSS size) not canvas.width/height (internal resolution)
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const radius = Math.min(rect.width, rect.height) / 2 - 10
    
    // Convert to normalized coordinates (-1 to 1)
    let nx = (x - centerX) / radius
    let ny = (y - centerY) / radius
    
    // Clamp to circle
    const dist = Math.sqrt(nx * nx + ny * ny)
    if (dist > 0.9) {
      nx = (nx / dist) * 0.9
      ny = (ny / dist) * 0.9
    }
    
    setBasePosition({ x: nx, y: ny })
    
    // 🔌 WAVE 33.4: Update controlStore with normalized pan/tilt (0-1 range)
    const normalizedPan = (nx + 1) / 2   // Convert -1..1 to 0..1
    const normalizedTilt = (ny + 1) / 2  // Convert -1..1 to 0..1
    setFlowParams({ basePan: normalizedPan, baseTilt: normalizedTilt })
  }, [isDragging, setFlowParams])
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])
  
  // ═══════════════════════════════════════════════════════════════════════
  // RESIZE HANDLER
  // ═══════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    
    const updateSize = () => {
      const size = Math.min(container.clientWidth, container.clientWidth) // Square
      canvas.width = size
      canvas.height = size
      drawRadar()
    }
    
    updateSize()
    
    const resizeObserver = new ResizeObserver(updateSize)
    resizeObserver.observe(container)
    
    return () => resizeObserver.disconnect()
  }, [drawRadar])
  
  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  
  return (
    <div className={`movement-radar ${className}`}>
      {/* HEADER */}
      <div className="radar-header">
        <span className="radar-title">🕹️ Movement Radar</span>
      </div>
      
      {/* MAIN CONTENT: Radar + Size Slider */}
      <div className="radar-content">
        {/* RADAR CANVAS */}
        <div className="radar-canvas-container" ref={containerRef}>
          <canvas
            ref={canvasRef}
            className="radar-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
        
        {/* SIZE SLIDER (Vertical, Right) */}
        <div className="radar-size-slider">
          <span className="slider-label">SIZE</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={size}
            onChange={(e) => {
              const newSize = parseFloat(e.target.value)
              setSize(newSize)
              setFlowParams({ size: newSize })
            }}
            className="vertical-slider"
          />
          <span className="slider-value">{Math.round(size * 100)}%</span>
        </div>
      </div>
      
      {/* SPEED SLIDER (Horizontal, Bottom) */}
      <div className="radar-speed-slider">
        <span className="slider-label">SPEED</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={speed}
          onChange={(e) => {
            const newSpeed = parseFloat(e.target.value)
            setSpeed(newSpeed)
            // Speed mapped to 0-100 for FlowParams
            setFlowParams({ speed: Math.round(newSpeed * 100) })
          }}
          className="horizontal-slider"
        />
        <span className="slider-value">{Math.round(speed * 100)}%</span>
      </div>
      
      {/* PATTERN SELECTOR */}
      <div className="radar-pattern-selector">
        {PATTERNS.map(p => (
          <button
            key={p.id}
            className={`pattern-btn ${pattern === p.id ? 'active' : ''}`}
            onClick={() => {
              setPattern(p.id)
              // Map MovementPattern to FlowPattern for store
              const flowPattern = p.id === 'circle' ? 'circle' 
                : p.id === 'eight' ? 'eight'
                : p.id === 'sweep' ? 'wave'
                : 'static'
              setFlowParams({ pattern: flowPattern as any })
            }}
            title={p.label}
          >
            <span className="pattern-icon">{p.icon}</span>
            <span className="pattern-label">{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default MovementRadar
