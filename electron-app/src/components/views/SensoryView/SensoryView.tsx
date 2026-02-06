/**
 * 🎛️ SENSORY VIEW - WAVE 1193: THE GREAT DIVIDE
 * 
 * "Lo que Selene SIENTE"
 * 
 * Vista completa dedicada a los inputs sensoriales:
 * - Audio Spectrum Titan (expandido, 32 bandas visuales)
 * - Chromatic Core Complete (rueda de color, acordes, temperatura)
 * - Context Matrix Expanded (8 slots con sparklines)
 * 
 * Layout: 70/30 columnas + footer de contexto
 */

import React, { memo } from 'react'
import { AudioSpectrumTitan } from './AudioSpectrumTitan'
import { ChromaticCoreComplete } from './ChromaticCoreComplete'
import { ContextMatrixExpanded } from './ContextMatrixExpanded'
import './SensoryView.css'

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const SensoryView: React.FC = memo(() => {
  return (
    <div className="sensory-view">
      {/* Main content area: Audio + Chromatic */}
      <div className="sensory-view__main">
        {/* Left: Audio Spectrum Titan (70% width) */}
        <div className="sensory-view__audio">
          <AudioSpectrumTitan />
        </div>
        
        {/* Right: Chromatic Core Complete (30% width) */}
        <div className="sensory-view__chromatic">
          <ChromaticCoreComplete />
        </div>
      </div>
      
      {/* Footer: Context Matrix Expanded */}
      <div className="sensory-view__context">
        <ContextMatrixExpanded />
      </div>
    </div>
  )
})

SensoryView.displayName = 'SensoryView'

export default SensoryView
