/**
 * 🔭 SIMULATE VIEW - 2D Stage Visualization
 * WAVE 436: POST-CONSOLIDATION MAINTENANCE
 * 
 * Historical Architecture (preserved comments for context):
 * - WAVE 10: CYBERPUNK CANVAS - Initial port from Demo V2
 * - WAVE 10.7: Effect Overlays (Strobe, Beam, Prism)
 * - WAVE 24.10: Truth restoration (DMX Store = Single Source of Truth)
 * 
 * Current module path: @/components/simulator/views/SimulateView
 * 
 * Features:
 * - Professional disco layout (PARs bottom, Moving Heads top/sides)
 * - Conical light beams with gradients
 * - Color halos (radial gradients)
 * - Zone indicators
 * - Real-time DMX values from Selene
 * - Effect overlays: Strobe flash, Beam closed, Prism cones
 */

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useDMXStore } from '../../../../stores/dmxStore'
import { useLuxSyncStore } from '../../../../stores/luxsyncStore'
// 🔥 WAVE 24.10: REMOVED telemetryStore import - SINGLE SOURCE OF TRUTH (DMX Store only)
import './SimulateView.css'

// ═══════════════════════════════════════════════════════════════════════════
// ZONE COLORS - Professional disco lighting zones
// ═══════════════════════════════════════════════════════════════════════════
const ZONE_COLORS: Record<string, { label: string; labelColor: string; hint: string }> = {
  FRONT_PARS: { label: '🔴 FRONT PARS', labelColor: '#FF6B6B', hint: '(Bass/Kick)' },
  BACK_PARS: { label: '🟠 BACK PARS', labelColor: '#FFA94D', hint: '(Mid/Delay)' },
  MOVING_LEFT: { label: '🟢 MOVING LEFT', labelColor: '#69DB7C', hint: '(Melody)' },
  MOVING_RIGHT: { label: '🟣 MOVING RIGHT', labelColor: '#B197FC', hint: '(Mirror)' },
  STROBES: { label: '⚡ STROBES', labelColor: '#FFE066', hint: '' },
  LASERS: { label: '🔴 LASERS', labelColor: '#FF6B6B', hint: '' },
  UNASSIGNED: { label: '⚪ UNASSIGNED', labelColor: '#6B7280', hint: '' },
}

// Get fixture type from name/type
const getFixtureDisplayType = (name: string, type: string): 'moving-head' | 'par' | 'strobe' | 'laser' | 'other' => {
  const combined = `${name} ${type}`.toLowerCase()
  if (combined.includes('beam') || combined.includes('moving') || combined.includes('spot') || combined.includes('vizi') || combined.includes('head')) {
    return 'moving-head'
  } else if (combined.includes('par') || combined.includes('wash') || combined.includes('led')) {
    return 'par'
  } else if (combined.includes('strobe')) {
    return 'strobe'
  } else if (combined.includes('laser')) {
    return 'laser'
  }
  return 'other'
}

const SimulateView: React.FC = () => {
  const dmxConnected = useDMXStore(state => state.isConnected)
  const patchedFixtures = useDMXStore(state => state.fixtures)
  // 🔥 WAVE 10 FIX: Get fixtureValues as array to force re-renders
  const fixtureValuesArray = useDMXStore(state => Array.from(state.fixtureValues.entries()))
  
  // 🔥 WAVE 24.10: REMOVED palette bypass - TRUTH RESTORATION (DMX Store = Source of Truth)
  
  // 🔥 WAVE 10.7: Get active effects for visual overlays
  const activeEffects = useLuxSyncStore(state => state.effects.active)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strobePhase = useRef(0) // For strobe animation
  
  // 🔥 WAVE 24.10: Blackout detector throttle (prevent infinite loop spam)
  const lastBlackoutWarning = useRef<Map<string, number>>(new Map())
  
  // Control states
  const [showBeams, setShowBeams] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [showHaze, setShowHaze] = useState(false)
  const [showZoneLabels, setShowZoneLabels] = useState(true)
  const [selectedFixture, setSelectedFixture] = useState<string | null>(null)
  
  // 🔥 WAVE 10.7: Check which effects are active
  const isStrobeActive = activeEffects.has('strobe')
  const isBeamActive = activeEffects.has('beam')
  const isPrismActive = activeEffects.has('prism')
  const isBlinderActive = activeEffects.has('blinder')
  const isPoliceActive = activeEffects.has('police')
  const isRainbowActive = activeEffects.has('rainbow')
  const isLaserActive = activeEffects.has('laser')
  const isSmokeActive = activeEffects.has('smoke')

  // Convert patched fixtures to renderable format with LIVE DMX values
  const renderableFixtures = useMemo(() => {
    // Convert array back to Map for fast lookup
    const fixtureValues = new Map(fixtureValuesArray)
    
    return patchedFixtures.map((f) => {
      // Get real-time DMX values for this fixture
      const liveValues = fixtureValues.get(f.dmxAddress)
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🔥 WAVE 24.10: TRUTH RESTORATION - Read ONLY from DMX Store
      // El Canvas DEBE representar la JODIDA REALIDAD de lo que sale por el USB
      // Si el backend (SeleneLux.ts) está arreglado (WAVE 24.6 NaN guards), 
      // entonces el DMX Store DEBE ser estable.
      // ═══════════════════════════════════════════════════════════════════════
      
      // Extract RGB color from DMX (channels r, g, b from FixtureValues)
      const r = liveValues?.r ?? 0
      const g = liveValues?.g ?? 0
      const b = liveValues?.b ?? 0
      const intensity = liveValues ? liveValues.dimmer / 255 : 0.3
      
      // ⚠️ WAVE 24.10: BLACKOUT DETECTOR - Anomaly detection (THROTTLED to prevent spam)
      // NOTA: Movido a useEffect separado para evitar bucle infinito en useMemo
      
      // Convert RGB to hex for canvas
      const rgbToHex = (r: number, g: number, b: number): string => {
        const toHex = (n: number) => {
          const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16)
          return hex.length === 1 ? '0' + hex : hex
        }
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`
      }
      
      const colorStr = rgbToHex(r, g, b)
      const color = { r, g, b }
      
      // Get zone from fixture (assigned by auto-zoning in main.ts)
      const zone = f.zone || 'UNASSIGNED'
      
      return {
        id: f.id,
        name: f.name,
        type: getFixtureDisplayType(f.name, f.type),
        address: f.dmxAddress,
        channels: f.channelCount,
        active: intensity > 0.05,
        color,
        colorStr,  // 🔥 Hex directo desde DMX RGB (LA VERDAD ABSOLUTA)
        intensity,
        pan: liveValues?.pan ?? 127,
        tilt: liveValues?.tilt ?? 127,
        zone,
      }
    })
  }, [patchedFixtures, fixtureValuesArray]) // 🔥 WAVE 24.10: NO palette dependency (DMX only)

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔥 WAVE 24.10: BLACKOUT DETECTOR (Throttled) - Separate useEffect
  // Detecta fixtures con dimmer > 0 pero RGB = (0,0,0) sin spamear la consola
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const THROTTLE_MS = 5000 // Solo 1 warning cada 5 segundos por fixture
    const now = Date.now()
    
    renderableFixtures.forEach((f) => {
      if (f.color.r === 0 && f.color.g === 0 && f.color.b === 0 && f.intensity > 0.1) {
        const lastWarning = lastBlackoutWarning.current.get(f.id)
        
        // Solo warn si pasaron 5+ segundos desde último warning de esta fixture
        if (!lastWarning || now - lastWarning > THROTTLE_MS) {
          console.warn(`⚠️ BLACKOUT ANÓMALO: ${f.id} (${f.name}) - Dimmer: ${(f.intensity * 100).toFixed(0)}%`)
          lastBlackoutWarning.current.set(f.id, now)
        }
      }
    })
  }, [renderableFixtures])

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎨 CYBERPUNK CANVAS RENDERING - Ported from Demo V2
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size with device pixel ratio for sharp rendering
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    
    const width = rect.width
    const height = rect.height

    let animationId: number
    let time = 0

    const draw = () => {
      time += 0.02
      strobePhase.current += 0.3 // Strobe animation
      
      // ═══ BACKGROUND ═══
      ctx.fillStyle = '#0a0a15'
      ctx.fillRect(0, 0, width, height)

      // ═══ GRID (Cyberpunk style) ═══
      if (showGrid) {
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.08)'
        ctx.lineWidth = 1
        const gridSize = 50
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

      // ═══ TITLE ═══
      ctx.fillStyle = '#00FFFF'
      ctx.font = 'bold 18px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('🎪 LUXSYNC STAGE SIMULATOR', width / 2, 28)

      // ═══ STAGE LINE ═══
      const stageY = height - 180
      ctx.strokeStyle = '#444'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(50, stageY)
      ctx.lineTo(width - 50, stageY)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#666'
      ctx.font = '10px Inter'
      ctx.fillText('─── ESCENARIO ───', width / 2, stageY - 8)

      // ═══ TRUSS (top bar for moving heads) ═══
      const trussY = 70
      ctx.fillStyle = '#333'
      ctx.fillRect(60, trussY, width - 120, 8)

      // Check if we have fixtures
      if (renderableFixtures.length === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
        ctx.font = '18px Inter'
        ctx.textAlign = 'center'
        ctx.fillText('No fixtures patched', width / 2, height / 2 - 20)
        ctx.font = '14px Inter'
        ctx.fillText('Go to SETUP → Fixtures to add some', width / 2, height / 2 + 10)
        animationId = requestAnimationFrame(draw)
        return
      }

      // ═══════════════════════════════════════════════════════════════════════
      // CALCULATE FIXTURE POSITIONS BY ZONE (Professional Disco Layout)
      // ═══════════════════════════════════════════════════════════════════════
      const centerX = width / 2
      const marginX = 80
      
      // Group fixtures by zone
      const byZone: Record<string, typeof renderableFixtures> = {}
      renderableFixtures.forEach(f => {
        if (!byZone[f.zone]) byZone[f.zone] = []
        byZone[f.zone].push(f)
      })

      // Calculate positions - Use dmxAddress as unique key (not id which can be duplicated)
      const fixturePositions: Map<number, { x: number; y: number }> = new Map()
      
      // FRONT PARS - Bottom row (facing audience)
      const frontPars = byZone['FRONT_PARS'] || []
      const frontSpacing = frontPars.length > 1 ? Math.min(120, (width - 200) / frontPars.length) : 0
      frontPars.forEach((f, i) => {
        const startX = centerX - (frontPars.length - 1) * frontSpacing / 2
        fixturePositions.set(f.address, {
          x: startX + i * frontSpacing,
          y: height - 70
        })
      })

      // BACK PARS - Middle row (behind DJ)
      const backPars = byZone['BACK_PARS'] || []
      const backSpacing = backPars.length > 1 ? Math.min(120, (width - 200) / backPars.length) : 0
      backPars.forEach((f, i) => {
        const startX = centerX - (backPars.length - 1) * backSpacing / 2
        fixturePositions.set(f.address, {
          x: startX + i * backSpacing,
          y: height - 150
        })
      })

      // MOVING LEFT - Top left
      const movingLeft = byZone['MOVING_LEFT'] || []
      const leftSpacing = movingLeft.length > 1 ? Math.min(80, 250 / movingLeft.length) : 0
      movingLeft.forEach((f, i) => {
        fixturePositions.set(f.address, {
          x: marginX + 80 + i * leftSpacing,
          y: trussY + 35 + (i % 2) * 25
        })
      })

      // MOVING RIGHT - Top right
      const movingRight = byZone['MOVING_RIGHT'] || []
      const rightSpacing = movingRight.length > 1 ? Math.min(80, 250 / movingRight.length) : 0
      movingRight.forEach((f, i) => {
        fixturePositions.set(f.address, {
          x: width - marginX - 80 - i * rightSpacing,
          y: trussY + 35 + (i % 2) * 25
        })
      })

      // STROBES - Center top
      const strobes = byZone['STROBES'] || []
      strobes.forEach((f, i) => {
        fixturePositions.set(f.address, {
          x: centerX + (i - strobes.length / 2) * 60,
          y: trussY + 35
        })
      })

      // UNASSIGNED - Spread across bottom
      const unassigned = byZone['UNASSIGNED'] || []
      unassigned.forEach((f, i) => {
        fixturePositions.set(f.address, {
          x: 100 + i * 80,
          y: height - 40
        })
      })

      // ═══ ZONE LABELS ═══
      if (showZoneLabels) {
        ctx.font = 'bold 11px Inter'
        
        if (frontPars.length > 0) {
          ctx.fillStyle = ZONE_COLORS.FRONT_PARS.labelColor
          ctx.textAlign = 'center'
          ctx.fillText(`${ZONE_COLORS.FRONT_PARS.label} ${ZONE_COLORS.FRONT_PARS.hint}`, centerX, height - 30)
        }
        
        if (backPars.length > 0) {
          ctx.fillStyle = ZONE_COLORS.BACK_PARS.labelColor
          ctx.textAlign = 'center'
          ctx.fillText(`${ZONE_COLORS.BACK_PARS.label} ${ZONE_COLORS.BACK_PARS.hint}`, centerX, height - 185)
        }
        
        if (movingLeft.length > 0) {
          ctx.fillStyle = ZONE_COLORS.MOVING_LEFT.labelColor
          ctx.textAlign = 'left'
          ctx.fillText(`${ZONE_COLORS.MOVING_LEFT.label}`, marginX + 60, trussY + 5)
        }
        
        if (movingRight.length > 0) {
          ctx.fillStyle = ZONE_COLORS.MOVING_RIGHT.labelColor
          ctx.textAlign = 'right'
          ctx.fillText(`${ZONE_COLORS.MOVING_RIGHT.label}`, width - marginX - 60, trussY + 5)
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // RENDER EACH FIXTURE (Halos, Beams, Bodies)
      // ═══════════════════════════════════════════════════════════════════════
      renderableFixtures.forEach((fixture) => {
        const pos = fixturePositions.get(fixture.address)
        if (!pos) return
        
        const { x, y } = pos
        const { color, intensity: dimmer, colorStr } = fixture
        
        // ═══ HALO/GLOW (Radial Gradient) ═══
        // Bigger for back PARs to compensate visual distance
        let glowMultiplier = 90
        if (fixture.zone === 'BACK_PARS') {
          glowMultiplier = 130
        } else if (fixture.zone.includes('MOVING')) {
          glowMultiplier = 85
        }
        
        const glowRadius = glowMultiplier * dimmer
        if (glowRadius > 5 && fixture.active) {
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius)
          gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.9)`)
          gradient.addColorStop(0.3, `rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`)
          gradient.addColorStop(0.6, `rgba(${color.r}, ${color.g}, ${color.b}, 0.2)`)
          gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`)
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(x, y, glowRadius, 0, Math.PI * 2)
          ctx.fill()
        }

        // ═══ LIGHT BEAMS (Solo para PARs - los Moving Heads se dibujan después) ═══
        if (showBeams && fixture.active && fixture.type === 'par' && dimmer > 0.15) {
          // PAR beam: Cónico hacia abajo
          const beamAngle = Math.PI / 2  // Straight down
          const beamLength = 200 * dimmer
          
          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(beamAngle)
          
          const beamWidth = 30 + dimmer * 40
          const beamEndWidth = beamWidth * 3
          
          // Beam gradient
          const beamGradient = ctx.createLinearGradient(0, 0, 0, beamLength)
          beamGradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.6)`)
          beamGradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, 0.3)`)
          beamGradient.addColorStop(1, 'transparent')
          
          // Draw cone
          ctx.beginPath()
          ctx.moveTo(-beamWidth / 2, 0)
          ctx.lineTo(-beamEndWidth / 2, beamLength)
          ctx.lineTo(beamEndWidth / 2, beamLength)
          ctx.lineTo(beamWidth / 2, 0)
          ctx.closePath()
          ctx.fillStyle = beamGradient
          ctx.fill()
          
          ctx.restore()
        }

        // ═══════════════════════════════════════════════════════════════════════
        // 🎯 WAVE 10 FIX V3: MOVING HEAD - COLOR SÓLIDO COMO LOS PARS
        // PAN = ángulo, TILT = longitud, CUERPO = COLOR MATE CLARO
        // ═══════════════════════════════════════════════════════════════════════
        
        if (fixture.type === 'moving-head') {
          const radius = 28
          
          // Valores de pan/tilt normalizados (0-1)
          const panNorm = (fixture.pan ?? 127) / 255
          const tiltNorm = (fixture.tilt ?? 127) / 255
          
          // 🪞 FIX: Determinar si es lado derecho para invertir visualmente
          const isRightSide = (fixture.zone || '').includes('RIGHT')
          
          // PAN → Ángulo horizontal (-135° a +135° = 270° total)
          let panAngle = panNorm * Math.PI * 1.5 - Math.PI * 0.75
          
          // 🪞 FIX ESPEJO VISUAL: Si es RIGHT, invertir el ángulo horizontalmente
          if (isRightSide) {
            panAngle = Math.PI - panAngle // Espejo horizontal
          }
          
          // TILT → Longitud del beam (parábola: máximo en 0.5, mínimo en extremos)
          const tiltFactor = 1 - Math.pow((tiltNorm - 0.5) * 2, 2) * 0.7
          const baseLength = 80 + dimmer * 100
          const beamLength = baseLength * Math.max(0.3, tiltFactor)
          
          // Calcular punto final del beam
          const endX = x + Math.cos(panAngle) * beamLength
          const endY = y + Math.sin(panAngle) * beamLength
          
          // ═══ HAZ DE LUZ CÓNICO ═══
          if (fixture.active && dimmer > 0.05) {
            // 🔦 WAVE 10.7: BEAM effect = haz muy cerrado
            const beamWidthStart = isBeamActive ? 2 : 8
            const beamWidthEnd = isBeamActive ? 8 : (25 + dimmer * 35)
            
            // 💎 WAVE 10.7: PRISM effect = múltiples conos
            const prismCones = isPrismActive ? 3 : 1
            const prismSpread = isPrismActive ? Math.PI / 6 : 0 // 30° spread
            
            for (let cone = 0; cone < prismCones; cone++) {
              const coneOffset = isPrismActive ? (cone - 1) * prismSpread : 0
              const coneAngle = panAngle + coneOffset
              const coneEndX = x + Math.cos(coneAngle) * beamLength
              const coneEndY = y + Math.sin(coneAngle) * beamLength
              
              const perpAngle = coneAngle + Math.PI / 2
              const startLeft = { x: x + Math.cos(perpAngle) * beamWidthStart/2, y: y + Math.sin(perpAngle) * beamWidthStart/2 }
              const startRight = { x: x - Math.cos(perpAngle) * beamWidthStart/2, y: y - Math.sin(perpAngle) * beamWidthStart/2 }
              const endLeft = { x: coneEndX + Math.cos(perpAngle) * beamWidthEnd/2, y: coneEndY + Math.sin(perpAngle) * beamWidthEnd/2 }
              const endRight = { x: coneEndX - Math.cos(perpAngle) * beamWidthEnd/2, y: coneEndY - Math.sin(perpAngle) * beamWidthEnd/2 }
              
              const coneGradient = ctx.createLinearGradient(x, y, coneEndX, coneEndY)
              const alpha = (isBeamActive ? 0.9 : 0.5) + dimmer * 0.4
              
              // 💎 Prism: rainbow colors per cone
              if (isPrismActive) {
                const hue = cone === 0 ? 0 : cone === 1 ? 120 : 240 // R, G, B
                const prismColor = `hsla(${hue}, 100%, 50%, ${alpha})`
                const prismColorFade = `hsla(${hue}, 100%, 50%, 0)`
                coneGradient.addColorStop(0, prismColor)
                coneGradient.addColorStop(0.5, `hsla(${hue}, 100%, 50%, ${alpha * 0.4})`)
                coneGradient.addColorStop(1, prismColorFade)
              } else {
                coneGradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`)
                coneGradient.addColorStop(0.3, `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.7})`)
                coneGradient.addColorStop(0.7, `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.3})`)
                coneGradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`)
              }
              
              ctx.beginPath()
              ctx.moveTo(startLeft.x, startLeft.y)
              ctx.lineTo(endLeft.x, endLeft.y)
              ctx.lineTo(endRight.x, endRight.y)
              ctx.lineTo(startRight.x, startRight.y)
              ctx.closePath()
              ctx.fillStyle = coneGradient
              ctx.fill()
            }
            
            // Línea central del haz
            ctx.beginPath()
            ctx.moveTo(x, y)
            ctx.lineTo(endX, endY)
            ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${0.7 + dimmer * 0.3})`
            ctx.lineWidth = isBeamActive ? 6 + dimmer * 6 : 4 + dimmer * 4 // BEAM = thicker line
            ctx.lineCap = 'round'
            ctx.stroke()
          }
          
          // ═══ HALO EXTERIOR DIFUSO (IGUAL QUE LOS PARS) ═══
          if (fixture.active && dimmer > 0.1) {
            const haloRadius = radius * 2.5 * dimmer
            const haloGradient = ctx.createRadialGradient(x, y, radius * 0.5, x, y, haloRadius)
            haloGradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`)
            haloGradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, 0.2)`)
            haloGradient.addColorStop(1, 'transparent')
            ctx.fillStyle = haloGradient
            ctx.beginPath()
            ctx.arc(x, y, haloRadius, 0, Math.PI * 2)
            ctx.fill()
          }
          
          // ═══ ANILLO CYAN (indicador de tipo moving head) ═══
          ctx.beginPath()
          ctx.arc(x, y, radius + 4, 0, Math.PI * 2)
          ctx.strokeStyle = '#00FFFF'
          ctx.lineWidth = 2
          ctx.stroke()
          
          // ═══ CUERPO PRINCIPAL - COLOR SÓLIDO MATE (IGUAL QUE PARS) ═══
          ctx.beginPath()
          ctx.arc(x, y, radius, 0, Math.PI * 2)
          // Color SÓLIDO, no gradiente - como los PARs
          ctx.fillStyle = fixture.active && dimmer > 0.05 ? colorStr : '#222'
          ctx.fill()
          
          // Borde sutil para definición
          if (fixture.active && dimmer > 0.1) {
            ctx.beginPath()
            ctx.arc(x, y, radius, 0, Math.PI * 2)
            ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.8)`
            ctx.lineWidth = 2
            ctx.stroke()
          }
          
        } else {
          // ═══ PAR/WASH: Círculo con halo difuso ═══
          const radius = 22
          
          // Halo exterior difuso (solo si activo)
          if (fixture.active && dimmer > 0.1) {
            const haloRadius = radius * 2.5 * dimmer
            const haloGradient = ctx.createRadialGradient(x, y, radius * 0.5, x, y, haloRadius)
            haloGradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.4)`)
            haloGradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, 0.15)`)
            haloGradient.addColorStop(1, 'transparent')
            ctx.fillStyle = haloGradient
            ctx.beginPath()
            ctx.arc(x, y, haloRadius, 0, Math.PI * 2)
            ctx.fill()
          }
          
          // Cuerpo principal (círculo)
          ctx.beginPath()
          ctx.arc(x, y, radius, 0, Math.PI * 2)
          ctx.fillStyle = fixture.active ? colorStr : '#222'
          ctx.fill()
          
          // Border color by zone
          const zoneBorderColor = fixture.zone === 'FRONT_PARS' ? '#FF6B6B' :
                                 fixture.zone === 'BACK_PARS' ? '#FFA94D' :
                                 fixture.zone === 'STROBES' ? '#FFE066' : '#666'
          ctx.strokeStyle = zoneBorderColor
          ctx.lineWidth = 2
          ctx.stroke()
          
          // Inner glow
          if (dimmer > 0.1) {
            const innerGradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
            innerGradient.addColorStop(0, `rgba(255, 255, 255, ${dimmer * 0.6})`)
            innerGradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
            ctx.fillStyle = innerGradient
            ctx.beginPath()
            ctx.arc(x, y, radius, 0, Math.PI * 2)
            ctx.fill()
          }
        }

        // ═══ FIXTURE LABEL ═══
        ctx.fillStyle = '#fff'
        ctx.font = '9px Inter'
        ctx.textAlign = 'center'
        const bodyOffset = fixture.type === 'moving-head' ? 38 : 22
        const shortName = fixture.name
          .replace(/PAR\s*/i, 'P')
          .replace(/Beam\s*/i, 'B')
          .replace(/Spot\s*/i, 'S')
          .replace(/Moving\s*/i, 'M')
          .substring(0, 12)
        ctx.fillText(shortName, x, y + bodyOffset + 14)
      })

      // ═══ HAZE EFFECT ═══
      if (showHaze) {
        for (let i = 0; i < 80; i++) {
          const px = Math.random() * width
          const py = Math.random() * (height - 100) + 50
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.04})`
          ctx.fillRect(px, py, 2, 2)
        }
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // 🔥 WAVE 10.7: EFFECT OVERLAYS (Strobe, Blinder)
      // ═══════════════════════════════════════════════════════════════════════════
      
      // ⚡ STROBE FLASH (rapid white flashes)
      if (isStrobeActive) {
        const strobeOn = Math.sin(strobePhase.current * 2) > 0.3
        if (strobeOn) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
          ctx.fillRect(0, 0, width, height)
        }
      }
      
      // 💡 BLINDER (full white wash)
      if (isBlinderActive) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
        ctx.fillRect(0, 0, width, height)
      }
      
      // 🔦 BEAM indicator
      if (isBeamActive) {
        ctx.fillStyle = '#00FFFF'
        ctx.font = 'bold 14px Inter'
        ctx.textAlign = 'left'
        ctx.fillText('🔦 BEAM MODE', 12, 50)
      }
      
      // 💎 PRISM indicator
      if (isPrismActive) {
        ctx.fillStyle = '#FF00FF'
        ctx.font = 'bold 14px Inter'
        ctx.textAlign = 'left'
        ctx.fillText('💎 PRISM MODE', 12, isPrismActive && isBeamActive ? 70 : 50)
      }
      
      // 🚨 POLICE (alternating red/blue flashes)
      if (isPoliceActive) {
        const policePhase = Math.floor(strobePhase.current * 4) % 2
        if (policePhase === 0) {
          // Red flash left side
          const gradient = ctx.createLinearGradient(0, 0, width / 2, 0)
          gradient.addColorStop(0, 'rgba(255, 0, 0, 0.4)')
          gradient.addColorStop(1, 'rgba(255, 0, 0, 0)')
          ctx.fillStyle = gradient
          ctx.fillRect(0, 0, width / 2, height)
        } else {
          // Blue flash right side
          const gradient = ctx.createLinearGradient(width, 0, width / 2, 0)
          gradient.addColorStop(0, 'rgba(0, 0, 255, 0.4)')
          gradient.addColorStop(1, 'rgba(0, 0, 255, 0)')
          ctx.fillStyle = gradient
          ctx.fillRect(width / 2, 0, width / 2, height)
        }
        // Label
        ctx.fillStyle = '#FF3366'
        ctx.font = 'bold 14px Inter'
        ctx.textAlign = 'left'
        ctx.fillText('🚨 POLICE MODE', 12, 90)
      }
      
      // 🌈 RAINBOW (cycling color wash)
      if (isRainbowActive) {
        const hue = (strobePhase.current * 50) % 360
        ctx.fillStyle = `hsla(${hue}, 80%, 50%, 0.15)`
        ctx.fillRect(0, 0, width, height)
        // Prismatic border
        ctx.strokeStyle = `hsla(${hue}, 100%, 60%, 0.6)`
        ctx.lineWidth = 4
        ctx.strokeRect(2, 2, width - 4, height - 4)
        // Label
        ctx.fillStyle = `hsl(${hue}, 100%, 60%)`
        ctx.font = 'bold 14px Inter'
        ctx.textAlign = 'left'
        ctx.fillText('🌈 RAINBOW MODE', 12, isPoliceActive ? 110 : 90)
      }
      
      // 🎯 LASER (scan lines)
      if (isLaserActive) {
        const laserY = (Math.sin(strobePhase.current) * 0.4 + 0.5) * height
        const laserX = (Math.cos(strobePhase.current * 1.3) * 0.4 + 0.5) * width
        // Horizontal scan
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(0, laserY)
        ctx.lineTo(width, laserY)
        ctx.stroke()
        // Vertical scan
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)'
        ctx.beginPath()
        ctx.moveTo(laserX, 0)
        ctx.lineTo(laserX, height)
        ctx.stroke()
        // Label
        ctx.fillStyle = '#FF3366'
        ctx.font = 'bold 14px Inter'
        ctx.textAlign = 'left'
        const laserLabelY = isPoliceActive && isRainbowActive ? 130 : (isPoliceActive || isRainbowActive ? 110 : 90)
        ctx.fillText('🎯 LASER MODE', 12, laserLabelY)
      }
      
      // 💨 SMOKE/HAZE (foggy overlay)
      if (isSmokeActive) {
        // Multiple layers of haze
        for (let i = 0; i < 3; i++) {
          const yOffset = Math.sin(strobePhase.current + i) * 20
          ctx.fillStyle = `rgba(150, 150, 170, ${0.08 - i * 0.02})`
          ctx.fillRect(0, height * 0.3 + yOffset + i * 30, width, height * 0.5)
        }
        // Haze particles
        ctx.fillStyle = 'rgba(200, 200, 220, 0.1)'
        for (let i = 0; i < 30; i++) {
          const px = (Math.sin(strobePhase.current * 0.5 + i * 0.7) * 0.5 + 0.5) * width
          const py = (Math.cos(strobePhase.current * 0.3 + i * 1.1) * 0.3 + 0.5) * height
          const size = 20 + Math.sin(i) * 15
          ctx.beginPath()
          ctx.arc(px, py, size, 0, Math.PI * 2)
          ctx.fill()
        }
        // Label
        ctx.fillStyle = '#8B9DC3'
        ctx.font = 'bold 14px Inter'
        ctx.textAlign = 'right'
        ctx.fillText('💨 SMOKE ACTIVE', width - 12, 50)
      }

      // ═══ FLOOR ═══
      const floorY = height - 25
      ctx.fillStyle = '#1a1a24'
      ctx.fillRect(0, floorY, width, 25)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.strokeRect(0, floorY, width, 25)

      // ═══ STATUS BAR ═══
      ctx.fillStyle = dmxConnected ? '#10B981' : '#888'
      ctx.font = 'bold 11px Inter'
      ctx.textAlign = 'left'
      ctx.fillText(dmxConnected ? '● DMX CONNECTED' : '○ SIMULATION MODE', 12, height - 8)
      
      ctx.fillStyle = '#666'
      ctx.textAlign = 'right'
      ctx.fillText(`${renderableFixtures.length} fixtures | ${Object.keys(byZone).filter(z => (byZone[z]?.length || 0) > 0).length} zones`, width - 12, height - 8)

      animationId = requestAnimationFrame(draw)
    }

    draw()

    return () => cancelAnimationFrame(animationId)
  }, [showBeams, showGrid, showHaze, showZoneLabels, renderableFixtures, dmxConnected, isStrobeActive, isBeamActive, isPrismActive, isBlinderActive, isPoliceActive, isRainbowActive, isLaserActive, isSmokeActive])

  return (
    <div className="simulate-view">
      <header className="view-header">
        <h2 className="view-title">🔭 SIMULATE MODE</h2>
        <div className="view-status">
          <span className={`dmx-badge ${dmxConnected ? 'connected' : 'disconnected'}`}>
            {dmxConnected ? '● DMX' : '○ DMX'}
          </span>
          <span className="fixture-count">
            {patchedFixtures.length === 0 
              ? 'No fixtures' 
              : `${patchedFixtures.length} fixture${patchedFixtures.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      </header>

      <div className="simulate-content">
        {/* Stage Canvas */}
        <section className="stage-canvas">
          <canvas ref={canvasRef} className="stage-canvas-element" />
        </section>

        {/* Bottom Panel */}
        <div className="simulate-panels">
          {/* Fixture List */}
          <section className="fixture-list">
            <h3>📋 PATCHED FIXTURES ({patchedFixtures.length})</h3>
            <div className="fixture-items">
              {patchedFixtures.length === 0 ? (
                <div className="no-fixtures-message">
                  <p>No fixtures patched yet.</p>
                  <p>Go to SETUP → Fixtures to add some.</p>
                </div>
              ) : (
                renderableFixtures.map(fixture => (
                  <div 
                    key={`${fixture.id}_${fixture.address}`}
                    className={`fixture-item ${selectedFixture === fixture.id ? 'selected' : ''} ${fixture.active ? 'active' : ''}`}
                    onClick={() => setSelectedFixture(fixture.id === selectedFixture ? null : fixture.id)}
                  >
                    <span 
                      className="fixture-status"
                      style={{ color: fixture.active ? fixture.colorStr : '#444' }}
                    >
                      {fixture.active ? '◉' : '○'}
                    </span>
                    <span className="fixture-name">{fixture.name}</span>
                    <span className="fixture-zone" style={{ color: ZONE_COLORS[fixture.zone]?.labelColor || '#666', fontSize: '0.7rem' }}>
                      {fixture.zone.replace('_', ' ')}
                    </span>
                    <span className="fixture-address">[{String(fixture.address).padStart(3, '0')}]</span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Controls */}
          <section className="simulator-controls">
            <h3>⚙️ VISUALIZATION</h3>
            <div className="control-items">
              <label className="control-checkbox">
                <input 
                  type="checkbox" 
                  checked={showBeams}
                  onChange={(e) => setShowBeams(e.target.checked)}
                />
                <span>Show Light Beams</span>
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
                  checked={showZoneLabels}
                  onChange={(e) => setShowZoneLabels(e.target.checked)}
                />
                <span>Show Zone Labels</span>
              </label>
            </div>
            <div className="control-info">
              <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px' }}>💡 Auto-Zoning activo:</p>
              <ul style={{ fontSize: '0.7rem', color: '#666', listStyle: 'none', padding: 0, margin: 0 }}>
                <li><span style={{color: '#FF6B6B'}}>●</span> FRONT - Bass/Kick</li>
                <li><span style={{color: '#FFA94D'}}>●</span> BACK - Mid frequencies</li>
                <li><span style={{color: '#69DB7C'}}>●</span> LEFT/RIGHT - Melody</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default SimulateView
