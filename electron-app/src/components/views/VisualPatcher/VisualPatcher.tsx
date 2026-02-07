/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔌 THE DMX NEXUS - VISUAL PATCHER
 * WAVE 1211: OPERATION FIRST LIGHT
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * "SELECT VISUAL → CONFIRM PHYSICAL → ASSIGN DIGITAL"
 * 
 * Features:
 * - 🎯 FIXTURE_SHAPES: Visual differentiation by type
 * - ⚡ FLASH REAL: HAL injection via dmx.highlightFixture()
 * - 📊 UNIVERSE BAR: Channel allocation visualization
 * 
 * @wave 1211
 * @codename "OPERATION FIRST LIGHT"
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useStageStore } from '../../../stores/stageStore';
import type { FixtureV2 } from '../../../core/stage/ShowFileV2';

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 FIXTURE SHAPE DEFINITIONS
// "Tactical Map Visual Language"
// ═══════════════════════════════════════════════════════════════════════════

type FixtureShapeType = 'triangle' | 'circle' | 'diamond' | 'rectangle' | 'square' | 'hexagon';

interface FixtureShapeConfig {
  shape: FixtureShapeType;
  icon: string;
  filled: boolean;
  pulsing?: boolean;
}

const FIXTURE_SHAPES: Record<string, FixtureShapeConfig> = {
  'moving-head': { shape: 'triangle', icon: '△', filled: true },
  'scanner':     { shape: 'triangle', icon: '▷', filled: false },
  'wash':        { shape: 'circle',   icon: '◉', filled: true },
  'par':         { shape: 'circle',   icon: '○', filled: false },
  'spot':        { shape: 'hexagon',  icon: '⬡', filled: true },
  'strobe':      { shape: 'diamond',  icon: '◇', filled: false, pulsing: true },
  'laser':       { shape: 'rectangle', icon: '═', filled: true },
  'blinder':     { shape: 'square',   icon: '■', filled: true },
  'bar':         { shape: 'rectangle', icon: '▬', filled: false },
  'effect':      { shape: 'diamond',  icon: '✦', filled: true },
  'generic':     { shape: 'circle',   icon: '●', filled: true },
};

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 WAVE 1217: CUSTOM ICONOGRAPHY (Cyberpunk Set)
// Stroke fino, elegancia técnica, neon glow on hover
// ═══════════════════════════════════════════════════════════════════════════

const IconFloppy = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="bevel">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const IconFlash = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="bevel">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const IconWand = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="bevel">
    <path d="M15 4V2" />
    <path d="M15 16v-2" />
    <path d="M8 9h2" />
    <path d="M20 9h2" />
    <path d="M17.8 11.8L19 13" />
    <path d="M15 9h0" />
    <path d="M17.8 6.2L19 5" />
    <path d="M3 21l9-9" />
    <path d="M12.2 6.2L11 5" />
  </svg>
);

const IconClear = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="bevel">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconMinus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconReset = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="bevel">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

// 🔌 DMX Nexus Icon (Plug/Connection)
const IconDmxNexus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="bevel">
    <path d="M12 2v4" />
    <path d="M12 18v4" />
    <path d="M4.93 4.93l2.83 2.83" />
    <path d="M16.24 16.24l2.83 2.83" />
    <path d="M2 12h4" />
    <path d="M18 12h4" />
    <path d="M4.93 19.07l2.83-2.83" />
    <path d="M16.24 7.76l2.83-2.83" />
    <circle cx="12" cy="12" r="4" />
  </svg>
);

// 🐝 Swarm Icon (Grid/Network)
const IconSwarm = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="bevel">
    <circle cx="5" cy="5" r="2" />
    <circle cx="19" cy="5" r="2" />
    <circle cx="5" cy="19" r="2" />
    <circle cx="19" cy="19" r="2" />
    <circle cx="12" cy="12" r="2" />
    <path d="M5 7v10" />
    <path d="M19 7v10" />
    <path d="M7 5h10" />
    <path d="M7 19h10" />
    <path d="M7 7l3 3" />
    <path d="M17 7l-3 3" />
    <path d="M7 17l3-3" />
    <path d="M17 17l-3-3" />
  </svg>
);

// 🪄 Magic Wand Icon (for Batch Patching)
const IconMagicWand = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="bevel">
    <path d="M3 21l10-10" />
    <path d="M13 11l2-2" />
    <path d="M19 3l2 2" />
    <path d="M18 8l2-2" />
    <path d="M16 6l2 2" />
    <path d="M10 5V3" />
    <path d="M5 10H3" />
    <path d="M7 7L5 5" />
  </svg>
);

// ✓ Checkmark Icon (for Save Feedback)
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 CYBERPUNK GLASS DESIGN SYSTEM
// Coherente con globals.css
// ═══════════════════════════════════════════════════════════════════════════

const COLORS = {
  bg: {
    deepest: '#0a0a0f',
    surface: '#1a1a24',
    elevated: '#222230',
  },
  accent: {
    cyan: '#22d3ee',
    cyanDim: 'rgba(34, 211, 238, 0.3)',
    cyanGlow: 'rgba(34, 211, 238, 0.6)',
    purple: '#7C4DFF',
  },
  state: {
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#ef4444',
    dangerDim: 'rgba(239, 68, 68, 0.3)',
  },
  text: {
    primary: '#f8fafc',
    secondary: '#94a3b8',
    muted: '#64748b',
  },
  fixture: {
    unpatched: '#475569',
    patched: '#22d3ee',
    selected: '#22d3ee',
    collision: '#ef4444',
    flashing: '#f59e0b',
  }
};

const s = {
  // Layout
  container: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    width: '100%',
    height: '100%',
    background: COLORS.bg.deepest,
    color: COLORS.text.primary,
    fontFamily: '"JetBrains Mono", monospace',
    overflow: 'hidden',
  },
  content: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    gap: '16px',
    padding: '16px',
  },
  // Map
  map: {
    flex: 7,
    minWidth: '400px',
    position: 'relative' as 'relative',
    background: `radial-gradient(circle at 50% 50%, ${COLORS.bg.surface} 0%, ${COLORS.bg.deepest} 100%)`,
    borderRadius: '12px',
    border: `1px solid ${COLORS.accent.cyanDim}`,
    overflow: 'hidden',
    cursor: 'crosshair',
  },
  // Sidebar - 🔮 NEON GLASS (WAVE 1215)
  sidebar: {
    flex: 3,
    minWidth: '300px',
    maxWidth: '360px',
    display: 'flex',
    flexDirection: 'column' as 'column',
    gap: '12px',
    background: 'rgba(12, 12, 18, 0.85)',
    backdropFilter: 'blur(16px)',
    borderRadius: '12px',
    border: '1px solid rgba(34, 211, 238, 0.15)',
    padding: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  },
  // Universe Bar
  universeBar: {
    height: '70px',
    minHeight: '70px',
    background: COLORS.bg.surface,
    borderRadius: '12px',
    border: `1px solid ${COLORS.accent.cyanDim}`,
    margin: '0 16px 16px',
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column' as 'column',
    gap: '4px',
  },
  // Components
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '12px',
    borderBottom: `1px solid rgba(255,255,255,0.1)`,
    marginBottom: '4px',
  },
  title: {
    fontSize: '16px',
    fontWeight: 700,
    color: COLORS.accent.cyan,
    letterSpacing: '2px',
    textTransform: 'uppercase' as 'uppercase',
  },
  statusOnline: {
    fontSize: '10px',
    color: COLORS.state.success,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  card: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    padding: '12px',
  },
  cardTitle: {
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '1.5px',
    textTransform: 'uppercase' as 'uppercase',
    color: COLORS.accent.cyan,
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  label: {
    fontSize: '9px',
    textTransform: 'uppercase' as 'uppercase',
    color: COLORS.text.muted,
    letterSpacing: '0.5px',
    marginBottom: '4px',
  },
  val: {
    fontSize: '14px',
    fontWeight: 600,
    color: COLORS.text.primary,
  },
  inputRow: {
    display: 'flex',
    gap: '8px',
  },
  input: {
    background: 'rgba(0,0,0,0.5)',
    border: `1px solid ${COLORS.fixture.unpatched}`,
    color: COLORS.accent.cyan,
    padding: '10px',
    borderRadius: '6px',
    width: '100%',
    fontSize: '18px',
    fontWeight: 600,
    fontFamily: 'inherit',
    textAlign: 'center' as 'center',
    outline: 'none',
    transition: 'all 0.15s ease',
  },
  btn: {
    padding: '14px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 700,
    textTransform: 'uppercase' as 'uppercase',
    fontSize: '12px',
    letterSpacing: '1px',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  btnFlash: {
    background: `linear-gradient(135deg, ${COLORS.state.warning} 0%, #d97706 100%)`,
    color: '#000',
    boxShadow: '0 0 20px rgba(245, 158, 11, 0.3)',
  },
  btnFlashActive: {
    transform: 'scale(0.98)',
    filter: 'brightness(1.3)',
    boxShadow: '0 0 40px rgba(245, 158, 11, 0.8)',
  },
  warning: {
    background: COLORS.state.dangerDim,
    border: `1px solid ${COLORS.state.danger}`,
    color: '#fca5a5',
    padding: '10px',
    borderRadius: '6px',
    fontSize: '11px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    animation: 'pulse-danger 0.8s ease-in-out infinite',
  },
  legend: {
    position: 'absolute' as 'absolute',
    bottom: '16px',
    left: '16px',
    display: 'flex',
    flexDirection: 'column' as 'column',
    gap: '4px',
    padding: '10px 14px',
    background: 'rgba(10, 10, 15, 0.9)',
    backdropFilter: 'blur(8px)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.08)',
    fontSize: '10px',
    color: COLORS.text.secondary,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  zoomControls: {
    position: 'absolute' as 'absolute',
    bottom: '16px',
    right: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px',
    background: 'rgba(10, 10, 15, 0.9)',
    backdropFilter: 'blur(8px)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  zoomBtn: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    borderRadius: '4px',
    color: COLORS.text.secondary,
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'all 0.15s ease',
  },
  zoomLabel: {
    padding: '0 8px',
    fontSize: '11px',
    fontWeight: 600,
    color: COLORS.accent.cyan,
    minWidth: '50px',
    textAlign: 'center' as 'center',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: COLORS.text.muted,
    textAlign: 'center' as 'center',
    fontSize: '12px',
    letterSpacing: '0.5px',
  },
  // 🔮 WAVE 1215: NEON GLASS POLISH
  // VFD-Style Inputs (Vacuum Fluorescent Display)
  inputVFD: {
    background: 'rgba(0, 0, 0, 0.6)',
    border: '1px solid #334155',
    color: '#22d3ee',
    padding: '10px',
    borderRadius: '6px',
    width: '100%',
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: '"JetBrains Mono", monospace',
    textAlign: 'center' as 'center',
    outline: 'none',
    transition: 'all 0.15s ease',
    textShadow: '0 0 8px rgba(34, 211, 238, 0.5)',
    letterSpacing: '2px',
  },
  // Swarm Header - Clean & Bold
  swarmHeader: {
    background: 'linear-gradient(135deg, rgba(124, 77, 255, 0.08) 0%, rgba(34, 211, 238, 0.05) 100%)',
    border: '1px solid rgba(124, 77, 255, 0.3)',
    backdropFilter: 'blur(10px)',
    borderRadius: '8px',
    padding: '16px',
  },
  swarmLabel: {
    fontSize: '9px',
    fontWeight: 600,
    color: COLORS.accent.purple,
    letterSpacing: '2px',
    textTransform: 'uppercase' as 'uppercase',
    marginBottom: '4px',
  },
  swarmCount: {
    fontSize: '28px',
    fontWeight: 700,
    color: COLORS.text.primary,
    fontFamily: '"Orbitron", sans-serif',
    letterSpacing: '3px',
  },
  // Preview Table - Data Stream Style
  previewRow: {
    fontSize: '11px',
    fontFamily: '"JetBrains Mono", monospace',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 6px',
    borderRadius: '2px',
  },
  previewRowEven: {
    background: 'rgba(255, 255, 255, 0.02)',
  },
  previewId: {
    color: '#64748b',
    fontSize: '10px',
    minWidth: '28px',
  },
  previewName: {
    color: '#e2e8f0',
    flex: 1,
    textAlign: 'left' as 'left',
    marginLeft: '8px',
  },
  previewChannel: {
    color: '#22d3ee',
    fontWeight: 600,
    textShadow: '0 0 6px rgba(34, 211, 238, 0.4)',
  },
  // Buttons - Gradient Power
  btnAutoPatch: {
    background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)',
    color: '#fff',
    boxShadow: '0 0 20px rgba(124, 77, 255, 0.3)',
  },
  btnFlashGradient: {
    background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
    color: '#000',
    boxShadow: '0 0 20px rgba(245, 158, 11, 0.3)',
  },
  // Ghost Button (SAVE)
  btnGhost: {
    background: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: COLORS.text.secondary,
    padding: '6px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    transition: 'all 0.2s ease',
  },
  // Glass Card
  cardGlass: {
    background: 'rgba(255, 255, 255, 0.02)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    padding: '12px',
  },
  // 🎨 WAVE 1217: ICON BUTTON STYLES
  // Buttons with SVG icons - Neon glow on hover
  btnIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
  },
  btnClear: {
    background: 'transparent',
    border: '1px solid #334155',
    color: '#64748b',
    marginTop: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'all 0.2s ease',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 🔌 VISUAL PATCHER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const VisualPatcher: React.FC = () => {
  // --- 🧠 STORE ---
  // 🎯 WAVE 1218: Connected saveShow for persistence!
  const { fixtures, updateFixture, saveShow } = useStageStore();
  
  // --- 📊 STATE ---
  // 🐝 WAVE 1213: Multi-selection support (THE SWARM CONTROL)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1.2);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isFlashing, setIsFlashing] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  
  // 🐝 BATCH PATCHING STATE
  const [batchStartAddress, setBatchStartAddress] = useState(1);
  const [batchOffset, setBatchOffset] = useState(16);
  
  // 💾 WAVE 1218: Save feedback state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- 🎯 DERIVED ---
  // Single selection (for backwards compat & single-edit mode)
  const selectedFixture = useMemo(() => 
    selectedIds.length === 1 ? fixtures.find(f => f.id === selectedIds[0]) : null, 
    [fixtures, selectedIds]
  );
  
  // All selected fixtures (for batch operations)
  const selectedFixtures = useMemo(() => 
    selectedIds.map(id => fixtures.find(f => f.id === id)).filter((f): f is FixtureV2 => f !== undefined),
    [fixtures, selectedIds]
  );
  
  // Selection mode
  const selectionMode: 'none' | 'single' | 'multi' = 
    selectedIds.length === 0 ? 'none' : 
    selectedIds.length === 1 ? 'single' : 'multi';

  // --- 💥 COLLISION ENGINE ---
  const getChannelCount = useCallback((fixture: FixtureV2): number => {
    return fixture.channelCount || fixture.channels?.length || 10;
  }, []);

  const checkCollision = useCallback((target: FixtureV2): { hasCollision: boolean; conflicts: FixtureV2[] } => {
    const start = target.address;
    const end = start + getChannelCount(target) - 1;
    const targetUni = target.universe || 0;
    
    const conflicts = fixtures.filter(f => {
      if (f.id === target.id) return false;
      if ((f.universe || 0) !== targetUni) return false;
      
      const fStart = f.address;
      const fEnd = fStart + getChannelCount(f) - 1;
      return (start <= fEnd && end >= fStart);
    });
    
    return { hasCollision: conflicts.length > 0, conflicts };
  }, [fixtures, getChannelCount]);

  const collisionInfo = useMemo(() => 
    selectedFixture ? checkCollision(selectedFixture) : { hasCollision: false, conflicts: [] },
    [selectedFixture, checkCollision]
  );

  // --- 📊 UNIVERSE BAR DATA ---
  const universeData = useMemo(() => {
    const blocks: Array<{ start: number; end: number; fixture: FixtureV2; isSelected: boolean; hasCollision: boolean }> = [];
    
    fixtures.forEach(f => {
      if ((f.universe || 0) !== 0) return; // Solo universe 1 por ahora
      const start = f.address;
      const end = start + getChannelCount(f) - 1;
      const { hasCollision } = checkCollision(f);
      
      blocks.push({
        start,
        end,
        fixture: f,
        isSelected: selectedIds.includes(f.id),
        hasCollision,
      });
    });
    
    // Ordenar por start
    blocks.sort((a, b) => a.start - b.start);
    
    // Calcular canales libres
    let usedChannels = 0;
    blocks.forEach(b => {
      usedChannels += (b.end - b.start + 1);
    });
    
    return { blocks, freeChannels: 512 - usedChannels };
  }, [fixtures, selectedIds, checkCollision, getChannelCount]);

  // --- ⚡ FLASH HANDLER (HAL REAL!) ---
  // 🐝 WAVE 1213: Supports multi-flash (THE SWARM STROBE)
  const handleFlash = useCallback(async (active: boolean) => {
    setIsFlashing(active);
    
    if (selectedFixtures.length === 0) return;
    
    // Clear any pending timeout
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }
    
    try {
      if (active) {
        // 🔥 HAL INJECTION - FLASH ALL SELECTED FIXTURES!
        for (const fixture of selectedFixtures) {
          const isMovingHead = fixture.type === 'moving-head';
          await window.luxsync?.dmx?.highlightFixture(
            fixture.address,
            getChannelCount(fixture),
            isMovingHead
          );
        }
        
        // Safety timeout: auto-release after 5 seconds
        flashTimeoutRef.current = setTimeout(() => {
          handleFlash(false);
        }, 5000);
        
        const names = selectedFixtures.map(f => f.name).join(', ');
        console.log(`🔥 FLASH ON [${selectedFixtures.length}x]: ${names}`);
      } else {
        // Blackout all
        await window.luxsync?.dmx?.blackout();
        console.log(`🔕 FLASH OFF`);
      }
    } catch (err) {
      console.error('Flash error:', err);
      setIsFlashing(false);
    }
  }, [selectedFixtures, getChannelCount]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }
    };
  }, []);

  // --- 🎨 CANVAS RENDER ---
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    // Resize to parent
    const parent = cvs.parentElement;
    if (parent) {
      cvs.width = parent.clientWidth;
      cvs.height = parent.clientHeight;
    }

    const cx = cvs.width / 2 + pan.x;
    const cy = cvs.height / 2 + pan.y;

    // Clear
    ctx.clearRect(0, 0, cvs.width, cvs.height);

    // Draw Grid
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.04)';
    ctx.lineWidth = 1;
    const gridSize = 50 * zoom;
    
    ctx.beginPath();
    for (let i = 0; i < cvs.width; i += gridSize) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i, cvs.height);
    }
    for (let i = 0; i < cvs.height; i += gridSize) {
      ctx.moveTo(0, i);
      ctx.lineTo(cvs.width, i);
    }
    ctx.stroke();
    
    // Major grid lines (cada 4)
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.08)';
    ctx.beginPath();
    for (let i = 0; i < cvs.width; i += gridSize * 4) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i, cvs.height);
    }
    for (let i = 0; i < cvs.height; i += gridSize * 4) {
      ctx.moveTo(0, i);
      ctx.lineTo(cvs.width, i);
    }
    ctx.stroke();

    // --- 🐍 SNAKE LINE (connects selected fixtures in order) ---
    if (selectedIds.length > 1) {
      const selectedPositions = selectedIds
        .map(id => fixtures.find(f => f.id === id))
        .filter((f): f is FixtureV2 => f !== undefined)
        .map(f => ({
          x: cx + (f.position.x * 50 * zoom),
          z: cy + (f.position.z * 50 * zoom),
        }));
      
      if (selectedPositions.length > 1) {
        ctx.strokeStyle = COLORS.accent.purple;
        ctx.lineWidth = 2 * zoom;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(selectedPositions[0].x, selectedPositions[0].z);
        for (let i = 1; i < selectedPositions.length; i++) {
          ctx.lineTo(selectedPositions[i].x, selectedPositions[i].z);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw order numbers
        selectedPositions.forEach((pos, idx) => {
          ctx.fillStyle = COLORS.accent.purple;
          ctx.font = `bold ${12 * zoom}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.fillText((idx + 1).toString(), pos.x + (15 * zoom), pos.z - (15 * zoom));
        });
      }
    }

    // --- 🎯 DRAW FIXTURES ---
    fixtures.forEach(f => {
      const x = cx + (f.position.x * 50 * zoom);
      const z = cy + (f.position.z * 50 * zoom);
      
      const isSel = selectedIds.includes(f.id);
      const isHov = f.id === hoveredId;
      const { hasCollision: isCol } = checkCollision(f);
      const isPatched = f.address > 0;
      const size = (isSel || isHov ? 14 : 12) * zoom;
      
      // Get shape config
      const shapeConfig = FIXTURE_SHAPES[f.type] || FIXTURE_SHAPES['generic'];
      
      // Determine colors
      let fillColor: string;
      let strokeColor: string;
      let glowColor: string | null = null;
      
      if (isCol) {
        fillColor = COLORS.state.dangerDim;
        strokeColor = COLORS.state.danger;
        glowColor = COLORS.state.danger;
      } else if (isSel) {
        fillColor = COLORS.accent.cyanDim;
        strokeColor = COLORS.accent.cyan;
        glowColor = COLORS.accent.cyanGlow;
      } else if (isHov) {
        fillColor = 'rgba(148, 163, 184, 0.2)';
        strokeColor = '#94a3b8';
      } else if (isPatched) {
        fillColor = shapeConfig.filled ? 'rgba(34, 211, 238, 0.15)' : 'transparent';
        strokeColor = COLORS.fixture.patched;
      } else {
        fillColor = 'transparent';
        strokeColor = COLORS.fixture.unpatched;
      }

      // Apply glow
      if (glowColor) {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 20;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2 * zoom;
      
      // --- DRAW SHAPE ---
      ctx.beginPath();
      
      switch (shapeConfig.shape) {
        case 'triangle': // Moving heads
          ctx.moveTo(x, z - size);
          ctx.lineTo(x + size * 0.866, z + size * 0.5);
          ctx.lineTo(x - size * 0.866, z + size * 0.5);
          ctx.closePath();
          break;
        
        case 'circle': // Wash, Par
          ctx.arc(x, z, size, 0, Math.PI * 2);
          break;

        case 'diamond': // Strobe, Effect
          ctx.moveTo(x, z - size);
          ctx.lineTo(x + size, z);
          ctx.lineTo(x, z + size);
          ctx.lineTo(x - size, z);
          ctx.closePath();
          break;

        case 'rectangle': // Laser, Bar
          ctx.rect(x - size * 1.5, z - size * 0.4, size * 3, size * 0.8);
          break;

        case 'square': // Blinder
          ctx.rect(x - size, z - size, size * 2, size * 2);
          break;

        case 'hexagon': // Spot
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 2;
            const hx = x + size * Math.cos(angle);
            const hz = z + size * Math.sin(angle);
            if (i === 0) ctx.moveTo(hx, hz);
            else ctx.lineTo(hx, hz);
          }
          ctx.closePath();
          break;

        default:
          ctx.arc(x, z, size, 0, Math.PI * 2);
      }
      
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // --- LABEL ---
      if (isSel || isHov || zoom > 1.3) {
        ctx.fillStyle = COLORS.text.primary;
        ctx.font = `${10 * zoom}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(f.address.toString(), x, z + size + (12 * zoom));
        
        // Show name on selection
        if (isSel) {
          ctx.font = `${8 * zoom}px "JetBrains Mono", monospace`;
          ctx.fillStyle = COLORS.text.secondary;
          ctx.fillText(f.name.slice(0, 15), x, z - size - (6 * zoom));
        }
      }
    });

  }, [fixtures, selectedIds, hoveredId, zoom, pan, checkCollision]);

  // --- 🎮 MOUSE HANDLERS ---
  // 🐝 WAVE 1213: Multi-select with Ctrl+Click
  const handleMapClick = useCallback((e: React.MouseEvent) => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    
    const rect = cvs.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = cvs.width / 2 + pan.x;
    const cy = cvs.height / 2 + pan.y;

    // Hit test
    const hit = fixtures.find(f => {
      const fx = cx + (f.position.x * 50 * zoom);
      const fz = cy + (f.position.z * 50 * zoom);
      const dist = Math.sqrt(Math.pow(mx - fx, 2) + Math.pow(my - fz, 2));
      return dist < (18 * zoom);
    });

    if (!hit) {
      // Click on empty space: clear selection (unless Ctrl is held)
      if (!e.ctrlKey && !e.metaKey) {
        setSelectedIds([]);
      }
      return;
    }

    // 🐝 MULTI-SELECT LOGIC
    if (e.ctrlKey || e.metaKey) {
      // Toggle selection
      setSelectedIds(prev => {
        if (prev.includes(hit.id)) {
          // Remove from selection
          return prev.filter(id => id !== hit.id);
        } else {
          // Add to selection (maintain order)
          return [...prev, hit.id];
        }
      });
    } else {
      // Single select (replace selection)
      setSelectedIds([hit.id]);
    }
  }, [fixtures, zoom, pan]);

  const handleMapMouseMove = useCallback((e: React.MouseEvent) => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    
    const rect = cvs.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = cvs.width / 2 + pan.x;
    const cy = cvs.height / 2 + pan.y;

    const hit = fixtures.find(f => {
      const fx = cx + (f.position.x * 50 * zoom);
      const fz = cy + (f.position.z * 50 * zoom);
      const dist = Math.sqrt(Math.pow(mx - fx, 2) + Math.pow(my - fz, 2));
      return dist < (18 * zoom);
    });

    setHoveredId(hit ? hit.id : null);
  }, [fixtures, zoom, pan]);

  // --- 🎚️ ADDRESS CHANGE (Single) ---
  const handleAddressChange = useCallback((value: string) => {
    if (!selectedFixture) return;
    const addr = parseInt(value);
    if (!isNaN(addr) && addr >= 1 && addr <= 512) {
      updateFixture(selectedFixture.id, { address: addr });
    }
  }, [selectedFixture, updateFixture]);

  // --- � BATCH PATCHING HANDLER ---
  const handleBatchPatch = useCallback(() => {
    if (selectedIds.length < 2) return;
    
    console.log(`🐝 BATCH PATCHING: ${selectedIds.length} fixtures, start=${batchStartAddress}, offset=${batchOffset}`);
    
    selectedIds.forEach((id, index) => {
      const newAddress = batchStartAddress + (index * batchOffset);
      // Clamp to valid DMX range
      if (newAddress >= 1 && newAddress <= 512) {
        updateFixture(id, { address: newAddress });
        const fixture = fixtures.find(f => f.id === id);
        console.log(`  → ${fixture?.name || id}: Ch ${newAddress}`);
      }
    });
  }, [selectedIds, batchStartAddress, batchOffset, updateFixture, fixtures]);

  // --- 🗑️ CLEAR SELECTION ---
  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  // --- �🖼️ RENDER ---
  return (
    <div style={s.container}>
      {/* MAIN CONTENT */}
      <div style={s.content}>
        {/* STAGE MAP */}
        <div style={s.map}>
          <canvas 
            ref={canvasRef} 
            onClick={handleMapClick}
            onMouseMove={handleMapMouseMove}
            onMouseLeave={() => setHoveredId(null)}
            style={{ width: '100%', height: '100%' }} 
          />
          
          {/* LEGEND */}
          <div style={s.legend}>
            <div style={s.legendItem}>
              <span style={{ color: COLORS.fixture.patched }}>△</span> Moving Head
            </div>
            <div style={s.legendItem}>
              <span style={{ color: COLORS.fixture.patched }}>○</span> Par / Wash
            </div>
            <div style={s.legendItem}>
              <span style={{ color: COLORS.fixture.patched }}>◇</span> Strobe
            </div>
            <div style={s.legendItem}>
              <span style={{ color: COLORS.fixture.patched }}>═</span> Laser / Bar
            </div>
            <div style={s.legendItem}>
              <span style={{ color: COLORS.state.danger }}>●</span> Collision
            </div>
            <div style={s.legendItem}>
              <span style={{ color: COLORS.accent.cyan }}>●</span> Selected
            </div>
            <div style={{ ...s.legendItem, marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px' }}>
              <span style={{ color: COLORS.accent.purple }}>⌘</span> Ctrl+Click = Multi
            </div>
          </div>

          {/* ZOOM CONTROLS - 🎨 WAVE 1217: SVG Icons */}
          <div style={s.zoomControls}>
            <button 
              style={s.zoomBtn} 
              onClick={() => setZoom(z => Math.max(0.5, z * 0.9))}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = COLORS.accent.cyan;
                e.currentTarget.style.filter = 'drop-shadow(0 0 5px currentColor)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = COLORS.text.secondary;
                e.currentTarget.style.filter = 'none';
              }}
              title="Zoom Out"
            ><IconMinus /></button>
            <span style={s.zoomLabel}>{Math.round(zoom * 100)}%</span>
            <button 
              style={s.zoomBtn} 
              onClick={() => setZoom(z => Math.min(3, z * 1.1))}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = COLORS.accent.cyan;
                e.currentTarget.style.filter = 'drop-shadow(0 0 5px currentColor)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = COLORS.text.secondary;
                e.currentTarget.style.filter = 'none';
              }}
              title="Zoom In"
            ><IconPlus /></button>
            <button 
              style={{ ...s.zoomBtn, marginLeft: '4px' }} 
              onClick={() => { setZoom(1.2); setPan({ x: 0, y: 0 }); }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = COLORS.accent.cyan;
                e.currentTarget.style.filter = 'drop-shadow(0 0 5px currentColor)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = COLORS.text.secondary;
                e.currentTarget.style.filter = 'none';
              }}
              title="Reset view"
            ><IconReset /></button>
          </div>
        </div>

        {/* INSPECTOR PANEL - INTELLIGENT MODE */}
        <div style={s.sidebar}>
          <div style={s.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={s.title}>🔌 DMX NEXUS</div>
              <div style={s.statusOnline}>
                <span style={{ fontSize: '8px' }}>●</span> ONLINE
              </div>
            </div>
            {/* 💾 SAVE BUTTON - 🎨 WAVE 1217: Icon with Glow */}
            <button 
              style={s.btnGhost}
              onClick={() => {
                console.log('💾 SAVE SHOW triggered');
                // TODO: Connect to actual save function
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = COLORS.accent.cyan;
                e.currentTarget.style.color = COLORS.accent.cyan;
                e.currentTarget.style.filter = 'drop-shadow(0 0 6px rgba(34, 211, 238, 0.6))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.color = COLORS.text.secondary;
                e.currentTarget.style.filter = 'none';
              }}
              title="Save Show"
            >
              <IconFloppy />
              <span>SAVE</span>
            </button>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              🧠 INSPECTOR MODES: NONE / SINGLE / MULTI
              ═══════════════════════════════════════════════════════════════════ */}
          
          {selectionMode === 'none' && (
            /* CASE A: No selection */
            <div style={s.emptyState}>
              <div>
                <div style={{ fontSize: '24px', marginBottom: '12px' }}>🎯</div>
                SELECT FIXTURES<br/>ON THE MAP
                <div style={{ marginTop: '12px', fontSize: '10px', color: COLORS.text.muted }}>
                  Ctrl+Click for multi-select
                </div>
              </div>
            </div>
          )}

          {selectionMode === 'single' && selectedFixture && (
            /* CASE B: Single selection - Original edit panel */
            <>
              {/* 🔮 IDENTITY CARD - Glass Style (WAVE 1215) */}
              <div style={s.cardGlass}>
                <div style={s.cardTitle}>
                  <span>{FIXTURE_SHAPES[selectedFixture.type]?.icon || '●'}</span>
                  SELECTED UNIT
                </div>
                <div style={s.val}>{selectedFixture.name}</div>
                <div style={{ fontSize: '11px', color: COLORS.text.muted, marginTop: '4px' }}>
                  {selectedFixture.type.toUpperCase()} • {selectedFixture.model || 'Generic'}
                </div>
                <div style={{ fontSize: '9px', color: COLORS.text.muted, fontFamily: 'monospace' }}>
                  ID: {selectedFixture.id}
                </div>
              </div>

              {/* 🔮 DMX ADDRESSING - Glass + VFD Style (WAVE 1215) */}
              <div style={s.cardGlass}>
                <div style={s.cardTitle}>⚙️ DMX ADDRESSING</div>
                
                {collisionInfo.hasCollision && (
                  <div style={s.warning}>
                    <span>⚠️</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>COLLISION DETECTED</div>
                      <div style={{ fontSize: '10px', marginTop: '2px' }}>
                        Overlaps with: {collisionInfo.conflicts.map(c => c.name).join(', ')}
                      </div>
                    </div>
                  </div>
                )}
                
                <div style={s.inputRow}>
                  <div style={{ flex: 1 }}>
                    <div style={s.label}>UNIVERSE</div>
                    <input 
                      style={{ 
                        ...s.inputVFD, 
                        color: COLORS.text.muted,
                        textShadow: 'none',
                        cursor: 'not-allowed',
                      }} 
                      value={(selectedFixture.universe || 0) + 1} 
                      readOnly 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={s.label}>ADDRESS</div>
                    <input 
                      type="number"
                      min={1}
                      max={512}
                      style={{ 
                        ...s.inputVFD, 
                        borderColor: collisionInfo.hasCollision ? COLORS.state.danger : '#334155',
                        boxShadow: collisionInfo.hasCollision 
                          ? `0 0 12px ${COLORS.state.dangerDim}` 
                          : 'none'
                      }} 
                      value={selectedFixture.address}
                      onChange={(e) => handleAddressChange(e.target.value)}
                      onFocus={(e) => {
                        if (!collisionInfo.hasCollision) {
                          e.currentTarget.style.borderColor = '#22d3ee';
                          e.currentTarget.style.boxShadow = '0 0 12px rgba(34, 211, 238, 0.3)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!collisionInfo.hasCollision) {
                          e.currentTarget.style.borderColor = '#334155';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                      }}
                    />
                  </div>
                </div>
                
                <div style={{ marginTop: '8px' }}>
                  <div style={s.label}>CHANNEL FOOTPRINT</div>
                  <div style={{ fontSize: '12px', color: COLORS.text.secondary, fontFamily: '"JetBrains Mono", monospace' }}>
                    <span style={{ color: '#22d3ee', textShadow: '0 0 6px rgba(34, 211, 238, 0.3)' }}>
                      Ch {String(selectedFixture.address).padStart(3, '0')}
                    </span>
                    <span style={{ color: COLORS.text.muted, margin: '0 6px' }}>→</span>
                    <span style={{ color: '#22d3ee', textShadow: '0 0 6px rgba(34, 211, 238, 0.3)' }}>
                      {String(selectedFixture.address + getChannelCount(selectedFixture) - 1).padStart(3, '0')}
                    </span>
                    <span style={{ color: COLORS.text.muted, marginLeft: '8px', fontSize: '10px' }}>
                      ({getChannelCount(selectedFixture)} ch)
                    </span>
                  </div>
                </div>
              </div>

              {/* 🎨 WAVE 1217: FLASH BUTTON with Icon */}
              <button 
                style={{ 
                  ...s.btn, 
                  ...s.btnFlashGradient, 
                  ...s.btnIcon,
                  marginTop: 'auto',
                  ...(isFlashing ? s.btnFlashActive : {})
                }}
                onMouseDown={() => handleFlash(true)}
                onMouseUp={() => handleFlash(false)}
                onMouseLeave={() => isFlashing && handleFlash(false)}
                onMouseEnter={(e) => {
                  if (!isFlashing) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 0 30px rgba(245, 158, 11, 0.5)';
                    e.currentTarget.style.filter = 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.6))';
                  }
                }}
              >
                <IconFlash />
                <span>{isFlashing ? 'FIRING...' : 'FLASH'}</span>
              </button>
              <div style={{ fontSize: '9px', color: COLORS.text.muted, textAlign: 'center' }}>
                Hold to strobe • Auto-off after 5s
              </div>
            </>
          )}

          {selectionMode === 'multi' && (
            /* CASE C: Multi-selection - BATCH PATCHING PANEL 🐝 */
            <>
              {/* 🔮 SWARM HEADER - Clean & Bold (WAVE 1215) */}
              <div style={s.swarmHeader}>
                <div style={s.swarmLabel}>
                  <span style={{ fontSize: '12px', marginRight: '6px' }}>🐝</span>
                  SWARM MODE
                </div>
                <div style={s.swarmCount}>
                  {selectedIds.length} <span style={{ fontSize: '14px', color: COLORS.text.secondary, fontFamily: '"JetBrains Mono", monospace' }}>UNITS</span>
                </div>
              </div>

              {/* 🔮 BATCH ADDRESSING - VFD STYLE (WAVE 1215) */}
              <div style={s.cardGlass}>
                <div style={s.cardTitle}>🪄 BATCH PATCHING</div>
                
                <div style={s.inputRow}>
                  <div style={{ flex: 1 }}>
                    <div style={s.label}>START ADDRESS</div>
                    <input 
                      type="number"
                      min={1}
                      max={512}
                      style={s.inputVFD}
                      value={batchStartAddress}
                      onChange={(e) => setBatchStartAddress(Math.max(1, Math.min(512, parseInt(e.target.value) || 1)))}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#22d3ee';
                        e.currentTarget.style.boxShadow = '0 0 12px rgba(34, 211, 238, 0.3)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#334155';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={s.label}>OFFSET / GAP</div>
                    <input 
                      type="number"
                      min={1}
                      max={100}
                      style={s.inputVFD}
                      value={batchOffset}
                      onChange={(e) => setBatchOffset(Math.max(1, parseInt(e.target.value) || 1))}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#22d3ee';
                        e.currentTarget.style.boxShadow = '0 0 12px rgba(34, 211, 238, 0.3)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#334155';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>

                {/* 🔮 PREVIEW - DATA STREAM STYLE (WAVE 1215) */}
                <div style={{ marginTop: '12px' }}>
                  <div style={s.label}>PREVIEW ASSIGNMENT</div>
                  <div style={{ 
                    background: 'rgba(0, 0, 0, 0.4)', 
                    borderRadius: '4px', 
                    padding: '6px',
                    maxHeight: '110px',
                    overflowY: 'auto',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}>
                    {selectedIds.map((id, idx) => {
                      const fixture = fixtures.find(f => f.id === id);
                      const newAddr = batchStartAddress + (idx * batchOffset);
                      const isValid = newAddr >= 1 && newAddr <= 512;
                      return (
                        <div 
                          key={id} 
                          style={{ 
                            ...s.previewRow,
                            ...(idx % 2 === 0 ? s.previewRowEven : {}),
                          }}
                        >
                          <span style={s.previewId}>#{idx + 1}</span>
                          <span style={s.previewName}>{fixture?.name?.slice(0, 14) || 'Unknown'}</span>
                          <span style={{ 
                            ...s.previewChannel, 
                            color: isValid ? '#22d3ee' : COLORS.state.danger,
                            textShadow: isValid ? '0 0 6px rgba(34, 211, 238, 0.4)' : 'none',
                          }}>
                            Ch {String(newAddr).padStart(3, '0')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 🎨 WAVE 1217: AUTO-PATCH BUTTON with Icon */}
                <button 
                  style={{ 
                    ...s.btn, 
                    ...s.btnAutoPatch,
                    ...s.btnIcon,
                    marginTop: '12px',
                  }}
                  onClick={handleBatchPatch}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 0 30px rgba(124, 77, 255, 0.5)';
                    e.currentTarget.style.filter = 'drop-shadow(0 0 8px rgba(124, 77, 255, 0.6))';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 0 20px rgba(124, 77, 255, 0.3)';
                    e.currentTarget.style.filter = 'none';
                  }}
                >
                  <IconWand />
                  <span>AUTO-PATCH</span>
                </button>
              </div>

              {/* 🎨 WAVE 1217: SWARM FLASH BUTTON with Icon */}
              <button 
                style={{ 
                  ...s.btn, 
                  ...s.btnFlashGradient, 
                  ...s.btnIcon,
                  marginTop: 'auto',
                  ...(isFlashing ? s.btnFlashActive : {})
                }}
                onMouseDown={() => handleFlash(true)}
                onMouseUp={() => handleFlash(false)}
                onMouseLeave={() => isFlashing && handleFlash(false)}
                onMouseEnter={(e) => {
                  if (!isFlashing) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 0 30px rgba(245, 158, 11, 0.5)';
                    e.currentTarget.style.filter = 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.6))';
                  }
                }}
              >
                <IconFlash />
                <span>{isFlashing ? `FIRING ${selectedIds.length}x...` : `FLASH ALL`}</span>
              </button>

              {/* 🎨 WAVE 1217: CLEAR BUTTON with Icon */}
              <button 
                style={{ 
                  ...s.btn, 
                  ...s.btnClear,
                }}
                onClick={handleClearSelection}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = COLORS.state.danger;
                  e.currentTarget.style.color = COLORS.state.danger;
                  e.currentTarget.style.filter = 'drop-shadow(0 0 5px rgba(239, 68, 68, 0.5))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#334155';
                  e.currentTarget.style.color = '#64748b';
                  e.currentTarget.style.filter = 'none';
                }}
              >
                <IconClear />
                <span>CLEAR</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* UNIVERSE BAR */}
      <div style={s.universeBar}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '4px'
        }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: COLORS.accent.cyan, letterSpacing: '1px' }}>
            📊 UNIVERSE 1 ALLOCATION
          </div>
          <div style={{ fontSize: '10px', color: COLORS.state.success }}>
            FREE: {universeData.freeChannels} ch
          </div>
        </div>
        
        {/* Channel visualization bar */}
        <div style={{
          flex: 1,
          background: COLORS.bg.elevated,
          borderRadius: '4px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Render blocks */}
          {universeData.blocks.map((block, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${((block.start - 1) / 512) * 100}%`,
                width: `${((block.end - block.start + 1) / 512) * 100}%`,
                top: '2px',
                bottom: '2px',
                background: block.hasCollision 
                  ? COLORS.state.danger 
                  : block.isSelected 
                    ? COLORS.accent.cyan 
                    : COLORS.accent.cyanDim,
                borderRadius: '2px',
                opacity: block.isSelected ? 1 : 0.7,
                cursor: 'pointer',
                transition: 'opacity 0.15s ease',
              }}
              onClick={() => setSelectedIds([block.fixture.id])}
              title={`${block.fixture.name}: Ch ${block.start}-${block.end}`}
            />
          ))}
        </div>
        
        {/* Channel markers */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          fontSize: '8px',
          color: COLORS.text.muted,
          marginTop: '2px',
        }}>
          <span>1</span>
          <span>128</span>
          <span>256</span>
          <span>384</span>
          <span>512</span>
        </div>
      </div>
    </div>
  );
};

export default VisualPatcher;