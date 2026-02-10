/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 STAGE PREVIEW - WAVE 2015: THE STAGE
 * Lightweight wrapper for StageSimulator2 optimized for Chronos timeline view
 * 
 * OPTIMIZATIONS:
 * - No post-processing (bloom, volumetrics disabled)
 * - Reduced fixture glow intensity
 * - Lower FPS target (30fps vs 60fps)
 * - Compact mode: no labels, no zone indicators
 * 
 * Shows real fixtures from stageStore responding to Chronos playback.
 * 
 * @module chronos/ui/stage/StagePreview
 * @version WAVE 2015
 */

import React, { useRef, useEffect, useState, useCallback, useMemo, memo } from 'react'
import { useTruthStore, selectHardware } from '../../../../stores/truthStore'
import { useStageStore } from '../../../../stores/stageStore'
import { calculateFixtureRenderValues } from '../../../../hooks/useFixtureRender'
import { useControlStore } from '../../../../stores/controlStore'
import { useOverrideStore } from '../../../../stores/overrideStore'
import './StagePreview.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface FixtureVisualLite {
  id: string
  x: number
  y: number
  r: number
  g: number
  b: number
  intensity: number
  type: 'par' | 'moving' | 'strobe' | 'laser'
  zone: 'front' | 'back' | 'left' | 'right' | 'center'
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const STAGE_COLORS = {
  background: '#0a0a0f',
  grid: 'rgba(59, 130, 246, 0.08)',
  stageLine: '#ff00ff33',
} as const

const ZONE_POSITIONS = {
  // Y positions (0 = top, 1 = bottom)
  back: 0.35,
  center: 0.50,
  front: 0.75,
  left: 0.35,
  right: 0.35,
} as const

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const StagePreview: React.FC = memo(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>(0)
  const lastFrameRef = useRef<number>(0)
  
  // Frame rate control: 30fps for preview
  const TARGET_FPS = 30
  const FRAME_INTERVAL = 1000 / TARGET_FPS
  
  // Truth Store
  const hardware = useTruthStore(selectHardware)
  
  // Stage Store (geometry)
  const stageFixtures = useStageStore(state => state.fixtures)
  
  // Control Store
  const globalMode = useControlStore(state => state.globalMode)
  const flowParams = useControlStore(state => state.flowParams)
  const activePaletteId = useControlStore(state => state.activePalette)
  const globalIntensity = useControlStore(state => state.globalIntensity)
  const globalSaturation = useControlStore(state => state.globalSaturation)
  const targetPalette = useControlStore(state => state.targetPalette)
  const transitionProgress = useControlStore(state => state.transitionProgress)
  
  // Override Store
  const overrides = useOverrideStore(state => state.overrides)
  
  // Build runtime state map
  const runtimeStateMap = useMemo(() => {
    const map = new Map<string, any>()
    const backendFixtures = hardware?.fixtures || []
    if (Array.isArray(backendFixtures)) {
      backendFixtures.forEach(f => {
        if (f?.id) map.set(f.id, f)
      })
    }
    return map
  }, [hardware?.fixtures])
  
  // Process fixtures into visual data
  const fixtures = useMemo((): FixtureVisualLite[] => {
    const fixtureArray = stageFixtures || []
    if (!Array.isArray(fixtureArray)) return []
    if (fixtureArray.length === 0) return []
    
    return fixtureArray.map((fixture, index) => {
      if (!fixture) return null
      
      const runtimeState = runtimeStateMap.get(fixture.id)
      const fixtureId = fixture.id || `fixture-${fixture.address}`
      const fixtureOverride = overrides.get(fixtureId)
      
      // Zone mapping
      const backendZone = (runtimeState?.zone || fixture.zone || '').toUpperCase()
      let zone: FixtureVisualLite['zone'] = 'center'
      let type: FixtureVisualLite['type'] = 'par'
      
      if (backendZone.includes('MOVING_LEFT') || backendZone === 'LEFT') {
        zone = 'left'
        type = 'moving'
      } else if (backendZone.includes('MOVING_RIGHT') || backendZone === 'RIGHT') {
        zone = 'right'
        type = 'moving'
      } else if (backendZone.includes('FRONT')) {
        zone = 'front'
        type = 'par'
      } else if (backendZone.includes('BACK')) {
        zone = 'back'
        type = 'par'
      } else if (backendZone.includes('STROBE')) {
        zone = 'center'
        type = 'strobe'
      }
      
      // Get render values
      const { 
        color: finalColor, 
        intensity: finalIntensity,
      } = calculateFixtureRenderValues(
        runtimeState || fixture,
        globalMode,
        flowParams,
        activePaletteId,
        globalIntensity,
        globalSaturation,
        index,
        fixtureOverride?.values,
        fixtureOverride?.mask,
        targetPalette,
        transitionProgress
      )
      
      // Normalize intensity
      const rawIntensity = finalIntensity ?? 0
      const normalizedIntensity = !Number.isFinite(rawIntensity) 
        ? 0
        : rawIntensity > 1.0 
          ? rawIntensity / 255
          : rawIntensity
      const safeIntensity = Math.max(0, Math.min(1, normalizedIntensity))
      
      return {
        id: fixtureId,
        x: 0,
        y: 0,
        r: finalColor.r,
        g: finalColor.g,
        b: finalColor.b,
        intensity: safeIntensity,
        type,
        zone,
      }
    }).filter(Boolean) as FixtureVisualLite[]
  }, [
    stageFixtures, runtimeStateMap, overrides, globalMode, flowParams,
    activePaletteId, globalIntensity, globalSaturation, targetPalette, transitionProgress
  ])
  
  // ═══════════════════════════════════════════════════════════════════════
  // RENDER LOOP
  // ═══════════════════════════════════════════════════════════════════════
  
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    
    const { width, height } = canvas
    
    // Clear
    ctx.fillStyle = STAGE_COLORS.background
    ctx.fillRect(0, 0, width, height)
    
    // Draw subtle grid
    ctx.strokeStyle = STAGE_COLORS.grid
    ctx.lineWidth = 0.5
    const gridSize = 20
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
    
    // Draw stage line (front)
    ctx.strokeStyle = STAGE_COLORS.stageLine
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, height * 0.85)
    ctx.lineTo(width, height * 0.85)
    ctx.stroke()
    
    // Group fixtures by zone for positioning
    const byZone = new Map<string, FixtureVisualLite[]>()
    fixtures.forEach(f => {
      const arr = byZone.get(f.zone) || []
      arr.push(f)
      byZone.set(f.zone, arr)
    })
    
    // Draw fixtures
    const fixtureRadius = Math.min(width, height) * 0.04
    
    byZone.forEach((zoneFixtures, zone) => {
      const yPos = ZONE_POSITIONS[zone as keyof typeof ZONE_POSITIONS] || 0.5
      const count = zoneFixtures.length
      
      zoneFixtures.forEach((fixture, i) => {
        // Distribute horizontally within zone
        let xPos: number
        if (zone === 'left') {
          xPos = 0.15
        } else if (zone === 'right') {
          xPos = 0.85
        } else {
          // Spread across width
          const margin = 0.15
          xPos = margin + ((1 - 2 * margin) * (i + 0.5) / count)
        }
        
        const x = width * xPos
        const y = height * yPos
        
        // Draw fixture
        if (fixture.intensity > 0.01) {
          const { r, g, b, intensity } = fixture
          
          // 🎭 WAVE 2015: Simplified glow (no heavy blur)
          // Outer glow
          const glowRadius = fixtureRadius * (1.5 + intensity * 1.5)
          const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius)
          glowGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${intensity * 0.6})`)
          glowGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${intensity * 0.2})`)
          glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
          
          ctx.beginPath()
          ctx.arc(x, y, glowRadius, 0, Math.PI * 2)
          ctx.fillStyle = glowGradient
          ctx.fill()
          
          // Core
          ctx.beginPath()
          ctx.arc(x, y, fixtureRadius * 0.6, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(1, intensity + 0.3)})`
          ctx.fill()
        } else {
          // Dark fixture
          ctx.beginPath()
          ctx.arc(x, y, fixtureRadius * 0.5, 0, Math.PI * 2)
          ctx.fillStyle = '#1a1a2e'
          ctx.fill()
          ctx.strokeStyle = '#2d2d44'
          ctx.lineWidth = 1
          ctx.stroke()
        }
      })
    })
  }, [fixtures])
  
  // Animation loop with frame rate limiting
  useEffect(() => {
    const animate = (timestamp: number) => {
      const elapsed = timestamp - lastFrameRef.current
      
      if (elapsed >= FRAME_INTERVAL) {
        lastFrameRef.current = timestamp - (elapsed % FRAME_INTERVAL)
        renderFrame()
      }
      
      animationRef.current = requestAnimationFrame(animate)
    }
    
    animationRef.current = requestAnimationFrame(animate)
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [renderFrame, FRAME_INTERVAL])
  
  // Handle resize
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        // Set canvas resolution (account for DPR for sharpness)
        const dpr = Math.min(window.devicePixelRatio, 2)
        canvas.width = width * dpr
        canvas.height = height * dpr
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.scale(dpr, dpr)
        }
      }
    })
    
    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])
  
  return (
    <div className="stage-preview" ref={containerRef}>
      <canvas ref={canvasRef} className="stage-preview-canvas" />
      <div className="stage-preview-badge">STAGE</div>
    </div>
  )
})

StagePreview.displayName = 'StagePreview'
