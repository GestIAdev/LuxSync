/**
 * =============================================================================
 * STAGE SIMULATOR CINEMA - WAVE 2542: TRASPLANTE INTELIGENTE
 *
 * El doble-buffer manual de 1140 lineas ha sido sacrificado en el altar.
 * Este wrapper delega TODO el rendering a TacticalCanvas - el mismo motor
 * que usa Hyperion. Mismo codigo, misma calidad, 60fps con frame budget.
 * Switch 4.1 / 7.1 para alternar layout de zonas.
 *
 * Contrato con ChronosLayout (sin cambios en el):
 *   export { StagePreview }  -  props: { visible?: boolean }
 *
 * @module chronos/ui/stage/StageSimulatorCinema
 * @version WAVE 2542
 * =============================================================================
 */

import React, { memo, useEffect, useState, useCallback } from 'react'
import { TacticalCanvas } from '../../../components/hyperion/views/tactical/TacticalCanvas'
import './StageSimulatorCinema.css'

// =============================================================================
// TYPES
// =============================================================================

export interface StagePreviewProps {
  visible?: boolean
  className?: string
}

type LiquidLayout = '4.1' | '7.1'

// =============================================================================
// COMPONENT
// =============================================================================

export const StagePreview = memo(function StagePreview({
  visible = true,
  className = '',
}: StagePreviewProps) {
  const [liquidLayout, setLiquidLayout] = useState<LiquidLayout>('4.1')

  // Sincronizar layout con el engine al montar
  useEffect(() => {
    window.lux?.setLiquidLayout('4.1')
  }, [])

  const handleLayoutToggle = useCallback(() => {
    const newMode: LiquidLayout = liquidLayout === '4.1' ? '7.1' : '4.1'
    setLiquidLayout(newMode)
    window.lux?.setLiquidLayout(newMode)
  }, [liquidLayout])

  return (
    <div
      className={[
        'stage-cinema',
        !visible ? 'stage-cinema--hidden' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {/* Controls: badge + layout toggle */}
      <div className="stage-cinema__controls">
        <span className="stage-cinema__badge">CINEMA</span>
        <button
          className="stage-cinema__layout-toggle"
          onClick={handleLayoutToggle}
          title={`Cambiar a layout ${liquidLayout === '4.1' ? '7.1' : '4.1'}`}
        >
          {liquidLayout}
        </button>
      </div>

      {/* TacticalCanvas - el corazon del rendering */}
      <TacticalCanvas
        quality="HQ"
        showGrid={false}
        showZoneLabels={false}
        className="stage-cinema__tactical"
      />
    </div>
  )
})
