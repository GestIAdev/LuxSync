/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 <DirectorControl /> — WAVE 8307 (Blueprint Ola D2 · §6.4)
 *
 * Selector del DIRECTOR en el header (PERFORM): quién decide lo siguiente.
 *
 *   [ MANUAL | ▶ PLAYLIST | SELENE ]   +   ⏸ HOLD 7.2 bars
 *
 * Tres fuentes excluyentes. Cualquier disparo manual pasa PLAYLIST/SELENE a
 * `⏸ HOLD`: el indicador muestra la cuenta atrás de la ventana de silencio
 * y, al pulsarlo, la cancela y reanuda el director original al instante.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useCallback } from 'react'
import {
  useTheiaAutopilotStore,
  type TheiaDirectorChoice,
} from '../../stores/useTheiaAutopilotStore'

const CHOICES: readonly { id: TheiaDirectorChoice; label: string; title: string }[] = [
  { id: 'manual', label: 'MANUAL', title: 'Solo el operador — sin automatización' },
  { id: 'playlist', label: '▶ PLAYLIST', title: 'Auto-Pilot mecánico sobre la playlist (SEQ/LOOP/SHUFFLE)' },
  { id: 'selene', label: 'SELENE', title: 'Selene elige del playlist según ACO, vibe y energía' },
]

const DirectorControl: React.FC = () => {
  const director = useTheiaAutopilotStore((s) => s.director)
  const resumeDirector = useTheiaAutopilotStore((s) => s.resumeDirector)
  const holdLabel = useTheiaAutopilotStore((s) => s.holdLabel)
  const setDirector = useTheiaAutopilotStore((s) => s.setDirector)
  const cancelHold = useTheiaAutopilotStore((s) => s.cancelHold)

  const isHold = director === 'hold'
  // Durante HOLD el segmento del director original queda "en espera".
  const shown = isHold ? resumeDirector : director

  const handleCancel = useCallback(() => cancelHold(), [cancelHold])

  return (
    <div className={`theia-director${isHold ? ' is-hold' : ''}`}>
      <div
        className="theia-director__seg"
        role="tablist"
        aria-label="Director"
        title="Director — quién decide la siguiente proyección"
      >
        {CHOICES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={shown === c.id}
            className={[
              'theia-director__btn',
              `is-${c.id}`,
              shown === c.id ? 'is-active' : '',
              isHold && shown === c.id ? 'is-paused' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => setDirector(c.id)}
            title={c.title}
            data-midi-bind={`theia.director.${c.id}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isHold && (
        <button
          type="button"
          className="theia-director__hold"
          onClick={handleCancel}
          title="HOLD — la automatización calla tras tu disparo manual. Click = reanudar ya"
          data-midi-bind="theia.director.resume"
        >
          ⏸ HOLD {holdLabel}
        </button>
      )}
    </div>
  )
}

export default DirectorControl
