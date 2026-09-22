/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📑 SAVE AS MODAL — WAVE 8080 (M2): el operador nombra la copia
 *
 * El antiguo SAVE AS... concatenaba '(Copy)' ciegamente. Ahora abre este
 * búnker compacto: input con el nombre sugerido preseleccionado, Enter
 * confirma, Escape/overlay/cancelar abortan sin tocar nada.
 *
 * Mismo patrón que NewClipModal (WAVE 2040.28): React Portal →
 * document.body (inmune a re-renders del audio/DMX) + Input Trap
 * (stopPropagation en todos los eventos de teclado — Space escribe
 * espacios, no pausa Chronos).
 *
 * `window.prompt` NO existe en el renderer de Electron — por eso modal.
 *
 * @module views/HephaestusView/SaveAsModal
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useCallback, useEffect, useRef, memo } from 'react'
import { createPortal } from 'react-dom'

interface SaveAsModalProps {
  isOpen: boolean
  /** Nombre sugerido — `${clip.name} (Copy)` desde el caller. */
  suggestedName: string
  onClose: () => void
  /** Llamado solo con nombre válido (trim, no vacío). */
  onConfirm: (name: string) => void
}

export const SaveAsModal: React.FC<SaveAsModalProps> = memo(({
  isOpen,
  suggestedName,
  onClose,
  onConfirm,
}) => {
  const [name, setName] = useState(suggestedName)
  const nameRef = useRef<HTMLInputElement>(null)

  // Reset + autoselect del nombre sugerido cada vez que abre
  useEffect(() => {
    if (isOpen) {
      setName(suggestedName)
      requestAnimationFrame(() => {
        nameRef.current?.focus()
        nameRef.current?.select()
      })
    }
  }, [isOpen, suggestedName])

  const isValid = name.trim().length > 0

  const handleConfirm = useCallback(() => {
    if (!isValid) return
    onConfirm(name.trim())
    onClose()
  }, [isValid, name, onConfirm, onClose])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  const trapEvent = (e: React.SyntheticEvent) => {
    e.stopPropagation()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter' && isValid) {
      handleConfirm()
    }
  }

  if (!isOpen) return null

  const modalContent = (
    <div
      className="heph-bunker-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      onKeyUp={trapEvent}
      onKeyPress={trapEvent}
    >
      <div
        className="heph-bunker heph-bunker--saveas"
        role="dialog"
        aria-modal="true"
        aria-label="Save Clip As"
        onClick={trapEvent}
        onMouseDown={trapEvent}
        onPointerDown={trapEvent}
      >
        <header className="heph-bunker__header">
          <div className="heph-bunker__title">
            <span>📑 SAVE CLIP AS</span>
          </div>
          <button
            className="heph-bunker__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="heph-bunker__body" style={{ display: 'block' }}>
          <div className="heph-bunker__field">
            <label className="heph-bunker__label">NEW CLIP NAME</label>
            <input
              type="text"
              className="heph-bunker__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={trapEvent}
              onKeyUp={trapEvent}
              placeholder="My Killer Drop"
              ref={nameRef}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>

        <footer className="heph-bunker__footer">
          <button
            type="button"
            className="heph-bunker__btn heph-bunker__btn--cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="heph-bunker__btn heph-bunker__btn--create"
            onClick={handleConfirm}
            disabled={!isValid}
          >
            Save Copy
          </button>
        </footer>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
})

SaveAsModal.displayName = 'SaveAsModal'
