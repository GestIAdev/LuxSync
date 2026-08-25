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
 *
 * 🌿 WAVE 7583: ECO-MODE — when `isPerformanceMode` is true, the heavy
 * `<AudioSpectrumTitan>` (60 fps RAF, 1,920 style mutations/sec, 64
 * compositor layers) is swapped out for `<EcoSpectrum>` (5 Hz throttled
 * subscription, ~5 style mutations/sec, 0 layers). The swap is a sibling
 * mount, not a conditional inside AudioSpectrumTitan — the heavy component
 * is never in the React tree in Eco-Mode, so its RAF loop, Zustand
 * subscriptions, and useEffect cleanups never run (audit §3.7.5).
 */

import React, { memo } from 'react'
import { AudioSpectrumTitan } from './AudioSpectrumTitan'
import { ChromaticCoreComplete } from './ChromaticCoreComplete'
import { ContextMatrixExpanded } from './ContextMatrixExpanded'
import { OmniMatrixTelemetry } from './OmniMatrixTelemetry'
import { EcoSpectrum } from './EcoSpectrum' // 🌿 WAVE 7583: Eco-Mode fallback
import { EcoChromaticCore } from './EcoChromaticCore' // 🌿 WAVE 7584: Eco-Mode fallback
import { usePerformanceStore, selectIsPerformanceMode } from '../../../stores/performanceStore'
import './SensoryView.css'

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const SensoryView: React.FC = memo(() => {
  // 🌿 WAVE 7583: single primitive selector — stable reference, no object
  // allocation (blueprint §2.3 consumption rule).
  const isPerformanceMode = usePerformanceStore(selectIsPerformanceMode)

  return (
    <div className="sensory-view">
      {/* Main content area: Audio + Chromatic */}
      <div className="sensory-view__main">
        {/* Left: Audio Spectrum (70% width)
            🌿 WAVE 7583: Eco swap — mount EcoSpectrum OR AudioSpectrumTitan,
            never both. The unmounted one's RAF/subscriptions never run. */}
        <div className="sensory-view__audio">
          {isPerformanceMode ? <EcoSpectrum /> : <AudioSpectrumTitan />}
        </div>

        {/* Right: Chromatic Core (30% width)
            🌿 WAVE 7584: Eco swap — kills the conic-gradient re-raster. */}
        <div className="sensory-view__chromatic">
          {isPerformanceMode ? <EcoChromaticCore /> : <ChromaticCoreComplete />}
        </div>
      </div>

      {/* WAVE 3403: Omni Matrix Telemetry strip */}
      <div className="sensory-view__telemetry">
        <OmniMatrixTelemetry />
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
