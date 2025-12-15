/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  StageSimulator2.tsx - WAVE 25 Canvas 2.0                                 ║
 * ║  "THE NEON STAGE" - La Verdad Visualizada                                 ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║  Este canvas consume SOLO truthStore - la única fuente de verdad          ║
 * ║  Motor híbrido: LOW (retro) vs HIGH (neon volumétrico)                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useTruthStore, selectHardware, selectPalette, selectBeat } from '../../stores/truthStore';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type QualityMode = 'low' | 'high';

interface FixtureVisual {
  id: string;
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  intensity: number;
  pan: number;
  tilt: number;
  type: 'par' | 'moving' | 'strobe' | 'laser';
  zone: 'front' | 'back' | 'left' | 'right' | 'center';
}

interface ZoneLayout {
  label: string;
  y: number;
  fixtures: FixtureVisual[];
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const STAGE_COLORS = {
  background: '#0a0a0f',
  grid: '#1a1a2e',
  gridAccent: '#16213e',
  truss: '#2d2d44',
  stageLine: '#ff00ff',
  labelText: '#888899',
} as const;

const ZONE_CONFIG = {
  FRONT_PARS: { y: 0.85, label: 'FRONT PARS' },
  BACK_PARS: { y: 0.55, label: 'BACK PARS' },
  MOVING_LEFT: { y: 0.28, label: 'MOVING L' },   // 🌟 WAVE 25.6: 0.25→0.28 (más cerca)
  MOVING_RIGHT: { y: 0.28, label: 'MOVING R' },  // 🌟 WAVE 25.6: 0.25→0.28 (más cerca)
  STROBES: { y: 0.40, label: 'STROBES' },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const StageSimulator2: React.FC = () => {
  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  
  // Quality mode state
  const [qualityMode, setQualityMode] = useState<QualityMode>('high');
  const [showFPS, setShowFPS] = useState(false);
  const [fps, setFps] = useState(0);
  
  // TRUTH - la única fuente
  const hardware = useTruthStore(selectHardware);
  const palette = useTruthStore(selectPalette);
  const beat = useTruthStore(selectBeat);
  
  // ═════════════════════════════════════════════════════════════════════════
  // FIXTURE PROCESSING - Transformar fixtures del backend a visuales
  // ═════════════════════════════════════════════════════════════════════════
  
  const fixtures = useMemo((): FixtureVisual[] => {
    // 🌙 WAVE 25.5: fixtures ahora viene como array desde el backend
    const fixtureArray = hardware?.fixtures || [];
    if (!Array.isArray(fixtureArray)) return [];
    
    return fixtureArray.map((fixture) => {
      if (!fixture) return null;
      
      // 🔗 Usar zona del backend directamente (viene de auto-zoning)
      const backendZone = (fixture.zone || '').toUpperCase();
      let zone: FixtureVisual['zone'] = 'center';
      let type: FixtureVisual['type'] = 'par';
      
      // Mapear zonas del backend a zonas del canvas
      if (backendZone.includes('MOVING_LEFT') || backendZone.includes('LEFT')) {
        zone = 'left';
        type = 'moving';
      } else if (backendZone.includes('MOVING_RIGHT') || backendZone.includes('RIGHT')) {
        zone = 'right';
        type = 'moving';
      } else if (backendZone.includes('FRONT')) {
        zone = 'front';
        type = 'par';
      } else if (backendZone.includes('BACK')) {
        zone = 'back';
        type = 'par';
      } else if (backendZone.includes('STROBE')) {
        zone = 'center';
        type = 'strobe';
      }
      
      // Override tipo por el tipo del fixture si está disponible
      const fixtureType = (fixture.type || '').toLowerCase();
      if (fixtureType.includes('moving') || fixtureType.includes('spot') || fixtureType.includes('beam')) {
        type = 'moving';
      } else if (fixtureType.includes('strobe')) {
        type = 'strobe';
      } else if (fixtureType.includes('laser')) {
        type = 'laser';
      }
      
      // Extraer valores RGB e intensidad
      const color = fixture.color || { r: 0, g: 0, b: 0, h: 0, s: 0, l: 0, hex: '#000000' };
      const intensity = fixture.intensity ?? 1;
      const pan = fixture.pan ?? 0.5;
      const tilt = fixture.tilt ?? 0.5;
      
      return {
        id: fixture.id || `fixture-${fixture.dmxAddress}`,
        x: 0,
        y: 0,
        r: Math.round(color.r * intensity),
        g: Math.round(color.g * intensity),
        b: Math.round(color.b * intensity),
        intensity,
        pan,
        tilt,
        type,
        zone,
      };
    }).filter(Boolean) as FixtureVisual[];
  }, [hardware?.fixtures]);
  
  // ═════════════════════════════════════════════════════════════════════════
  // RENDER ENGINE
  // ═════════════════════════════════════════════════════════════════════════
  
  const render = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    // FPS calculation
    const delta = timestamp - lastFrameRef.current;
    if (delta > 0) setFps(Math.round(1000 / delta));
    lastFrameRef.current = timestamp;
    
    const W = canvas.width;
    const H = canvas.height;
    
    // ═══════════════════════════════════════════════════════════════════════
    // CLEAR & BACKGROUND
    // ═══════════════════════════════════════════════════════════════════════
    
    ctx.fillStyle = STAGE_COLORS.background;
    ctx.fillRect(0, 0, W, H);
    
    // ═══════════════════════════════════════════════════════════════════════
    // GRID (solo HIGH mode)
    // ═══════════════════════════════════════════════════════════════════════
    
    if (qualityMode === 'high') {
      ctx.strokeStyle = STAGE_COLORS.grid;
      ctx.lineWidth = 0.5;
      const gridSize = 40;
      
      for (let x = 0; x <= W; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y <= H; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // STAGE LINE
    // ═══════════════════════════════════════════════════════════════════════
    
    const stageY = H * 0.92;
    ctx.strokeStyle = STAGE_COLORS.stageLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W * 0.1, stageY);
    ctx.lineTo(W * 0.9, stageY);
    ctx.stroke();
    
    // Glow en HIGH mode
    if (qualityMode === 'high') {
      ctx.shadowColor = STAGE_COLORS.stageLine;
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // TRUSS
    // ═══════════════════════════════════════════════════════════════════════
    
    const trussY = H * 0.15;
    ctx.strokeStyle = STAGE_COLORS.truss;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(W * 0.05, trussY);
    ctx.lineTo(W * 0.95, trussY);
    ctx.stroke();
    
    // ═══════════════════════════════════════════════════════════════════════
    // FIXTURES - El corazón del render
    // ═══════════════════════════════════════════════════════════════════════
    
    // Agrupar por zona para posicionamiento
    const frontPars = fixtures.filter(f => f.zone === 'front');
    const backPars = fixtures.filter(f => f.zone === 'back');
    const movingLeft = fixtures.filter(f => f.zone === 'left');
    const movingRight = fixtures.filter(f => f.zone === 'right');
    const centerFixtures = fixtures.filter(f => f.zone === 'center');
    
    // Función para distribuir X en una zona
    const distributeX = (count: number, index: number, startX: number, endX: number): number => {
      if (count <= 1) return (startX + endX) / 2;
      return startX + ((endX - startX) * index) / (count - 1);
    };
    
    // ─────────────────────────────────────────────────────────────────────────
    // RENDER FIXTURE FUNCTION
    // ─────────────────────────────────────────────────────────────────────────
    
    const renderFixture = (fixture: FixtureVisual, x: number, y: number) => {
      const { r, g, b, intensity, pan, tilt, type } = fixture;
      
      // Skip si está apagado
      if (r + g + b < 10 && intensity < 0.05) return;
      
      const color = `rgb(${r}, ${g}, ${b})`;
      const colorAlpha = `rgba(${r}, ${g}, ${b}, ${intensity * 0.8})`;
      
      // ═══════════════════════════════════════════════════════════════════
      // HIGH QUALITY MODE - Volumétrico con gradientes
      // ═══════════════════════════════════════════════════════════════════
      
      if (qualityMode === 'high') {
        ctx.globalCompositeOperation = 'lighter';
        
        // 🌟 WAVE 25.6: Núcleo blanco sólido PRIMERO (garantiza visibilidad)
        const whiteCoreRadius = type === 'moving' ? 6 : 8;
        ctx.beginPath();
        ctx.arc(x, y, whiteCoreRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * intensity})`;
        ctx.fill();
        
        // HALO EXTERIOR (glow atmosférico) - 🌟 WAVE 25.6: Aumentado
        const haloRadius = type === 'moving' 
          ? 50 + intensity * 40  // Moving: más grande
          : 50 + intensity * 35; // PARs
        const haloGradient = ctx.createRadialGradient(x, y, 0, x, y, haloRadius);
        haloGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.6)`);
        haloGradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.3)`);
        haloGradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.1)`);
        haloGradient.addColorStop(1, 'transparent');
        
        ctx.beginPath();
        ctx.arc(x, y, haloRadius, 0, Math.PI * 2);
        ctx.fillStyle = haloGradient;
        ctx.fill();
        
        // NÚCLEO BRILLANTE DE COLOR - 🌟 WAVE 25.6: Doble tamaño
        const coreRadius = type === 'moving'
          ? 12 + intensity * 8  // Moving: 12 base (antes 6)
          : 16 + intensity * 10; // PARs: 16 base (antes 8)
        const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, coreRadius);
        coreGradient.addColorStop(0, '#ffffff');
        coreGradient.addColorStop(0.3, color);
        coreGradient.addColorStop(1, colorAlpha);
        
        ctx.beginPath();
        ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
        ctx.fillStyle = coreGradient;
        ctx.fill();
        
        // BEAM para moving heads - 🌟 WAVE 25.6: Boost de opacidad
        if (type === 'moving' && intensity > 0.1) {
          const beamAngle = (pan - 0.5) * Math.PI * 0.6; // ±54°
          const beamLength = 100 + tilt * 200;
          const beamWidth = 15 + intensity * 15;
          
          const endX = x + Math.sin(beamAngle) * beamLength;
          const endY = y + Math.cos(beamAngle) * beamLength;
          
          // Beam cónico
          ctx.beginPath();
          ctx.moveTo(x - 5, y);
          ctx.lineTo(endX - beamWidth, endY);
          ctx.lineTo(endX + beamWidth, endY);
          ctx.lineTo(x + 5, y);
          ctx.closePath();
          
          const beamGradient = ctx.createLinearGradient(x, y, endX, endY);
          beamGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.6)`); // 0.5→0.6
          beamGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.3)`); // 0.2→0.3
          beamGradient.addColorStop(1, 'transparent');
          
          ctx.fillStyle = beamGradient;
          ctx.fill();
        }
        
        // STROBE FLASH
        if (type === 'strobe' && intensity > 0.8) {
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 50;
          ctx.beginPath();
          ctx.arc(x, y, 15, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        
        ctx.globalCompositeOperation = 'source-over';
        
      // ═══════════════════════════════════════════════════════════════════
      // LOW QUALITY MODE - Retro, máximo FPS
      // ═══════════════════════════════════════════════════════════════════
      
      } else {
        // Círculo sólido simple - 🌟 WAVE 25.6: Tamaño aumentado
        const radius = type === 'moving'
          ? 12 + intensity * 10  // Moving: más grande
          : 16 + intensity * 12; // PARs: más grande
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        // Borde blanco para visibilidad
        ctx.strokeStyle = `rgba(255, 255, 255, ${intensity * 0.5})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Beam simple para moving heads (solo línea)
        if (type === 'moving' && intensity > 0.2) {
          const angle = (pan - 0.5) * Math.PI * 0.6;
          const length = 80 + tilt * 120;
          
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(
            x + Math.sin(angle) * length,
            y + Math.cos(angle) * length
          );
          ctx.strokeStyle = colorAlpha;
          ctx.lineWidth = 4;
          ctx.stroke();
        }
      }
    };
    
    // ─────────────────────────────────────────────────────────────────────────
    // RENDER EACH ZONE
    // ─────────────────────────────────────────────────────────────────────────
    
    // FRONT PARS
    frontPars.forEach((f, i) => {
      const x = distributeX(frontPars.length, i, W * 0.15, W * 0.85);
      const y = H * ZONE_CONFIG.FRONT_PARS.y;
      renderFixture(f, x, y);
    });
    
    // BACK PARS
    backPars.forEach((f, i) => {
      const x = distributeX(backPars.length, i, W * 0.2, W * 0.8);
      const y = H * ZONE_CONFIG.BACK_PARS.y;
      renderFixture(f, x, y);
    });
    
    // MOVING LEFT
    movingLeft.forEach((f, i) => {
      const x = W * 0.12;
      const y = distributeX(movingLeft.length, i, H * 0.2, H * 0.4);
      renderFixture(f, x, y);
    });
    
    // MOVING RIGHT
    movingRight.forEach((f, i) => {
      const x = W * 0.88;
      const y = distributeX(movingRight.length, i, H * 0.2, H * 0.4);
      renderFixture(f, x, y);
    });
    
    // CENTER (strobes, lasers, etc)
    centerFixtures.forEach((f, i) => {
      const x = distributeX(centerFixtures.length, i, W * 0.3, W * 0.7);
      const y = H * ZONE_CONFIG.STROBES.y;
      renderFixture(f, x, y);
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // ZONE LABELS - 🌟 WAVE 25.6: Ajustadas para no tapar fixtures grandes
    // ═══════════════════════════════════════════════════════════════════════
    
    if (qualityMode === 'high') {
      ctx.fillStyle = STAGE_COLORS.labelText;
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      
      ctx.fillText('MOVING L', W * 0.02, H * ZONE_CONFIG.MOVING_LEFT.y - 15); // +10px arriba
      ctx.textAlign = 'right';
      ctx.fillText('MOVING R', W * 0.98, H * ZONE_CONFIG.MOVING_RIGHT.y - 15); // +10px arriba
      ctx.textAlign = 'center';
      ctx.fillText('BACK PARS', W * 0.5, H * ZONE_CONFIG.BACK_PARS.y - 35); // +5px arriba
      ctx.fillText('FRONT PARS', W * 0.5, H * ZONE_CONFIG.FRONT_PARS.y + 30); // +5px abajo
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // BEAT PULSE (visual feedback del beat)
    // ═══════════════════════════════════════════════════════════════════════
    
    if (beat?.confidence && qualityMode === 'high') {
      const pulse = beat.confidence;
      if (pulse > 0.5) {
        ctx.strokeStyle = `rgba(255, 0, 255, ${(pulse - 0.5) * 0.5})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(5, 5, W - 10, H - 10);
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // HUD OVERLAY
    // ═══════════════════════════════════════════════════════════════════════
    
    // Quality badge
    ctx.fillStyle = qualityMode === 'high' ? '#00ff88' : '#ffaa00';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(qualityMode.toUpperCase(), 10, 20);
    
    // FPS counter
    if (showFPS) {
      ctx.fillStyle = fps > 50 ? '#00ff00' : fps > 30 ? '#ffff00' : '#ff0000';
      ctx.fillText(`${fps} FPS`, 10, 35);
    }
    
    // Fixture count
    ctx.fillStyle = '#666677';
    ctx.fillText(`${fixtures.length} fixtures`, 10, H - 10);
    
    // Palette preview (esquina superior derecha)
    if (palette && qualityMode === 'high') {
      const previewSize = 12;
      const startX = W - 80;
      
      ctx.fillStyle = '#333344';
      ctx.fillRect(startX - 5, 5, 75, 20);
      
      if (palette.primary) {
        ctx.fillStyle = palette.primary.hex || '#ff00ff';
        ctx.fillRect(startX, 8, previewSize, previewSize);
      }
      if (palette.secondary) {
        ctx.fillStyle = palette.secondary.hex || '#00ffff';
        ctx.fillRect(startX + 18, 8, previewSize, previewSize);
      }
      if (palette.accent) {
        ctx.fillStyle = palette.accent.hex || '#ffff00';
        ctx.fillRect(startX + 36, 8, previewSize, previewSize);
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // LOOP
    // ═══════════════════════════════════════════════════════════════════════
    
    animationRef.current = requestAnimationFrame(render);
  }, [qualityMode, fixtures, showFPS, palette, beat]);
  
  // ═════════════════════════════════════════════════════════════════════════
  // RESIZE HANDLER
  // ═════════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // ═════════════════════════════════════════════════════════════════════════
  // ANIMATION LOOP
  // ═════════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, [render]);
  
  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════
  
  return (
    <div 
      ref={containerRef}
      className="stage-simulator-2"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '400px',
        background: STAGE_COLORS.background,
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      />
      
      {/* CONTROLS OVERLAY */}
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          right: 10,
          display: 'flex',
          gap: '8px',
          zIndex: 10,
        }}
      >
        <button
          onClick={() => setQualityMode(q => q === 'high' ? 'low' : 'high')}
          style={{
            padding: '6px 12px',
            background: qualityMode === 'high' ? '#00ff8855' : '#ffaa0055',
            border: `1px solid ${qualityMode === 'high' ? '#00ff88' : '#ffaa00'}`,
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '11px',
            fontFamily: 'monospace',
          }}
        >
          {qualityMode === 'high' ? '✨ HIGH' : '⚡ LOW'}
        </button>
        
        <button
          onClick={() => setShowFPS(f => !f)}
          style={{
            padding: '6px 12px',
            background: showFPS ? '#ffffff22' : 'transparent',
            border: '1px solid #444',
            borderRadius: '4px',
            color: '#888',
            cursor: 'pointer',
            fontSize: '11px',
            fontFamily: 'monospace',
          }}
        >
          FPS
        </button>
      </div>
    </div>
  );
};

export default StageSimulator2;
