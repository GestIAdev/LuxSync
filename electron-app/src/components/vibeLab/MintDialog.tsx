/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏦 MintDialog.tsx — Modal de exportación/finalización
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Modal para confirmar el mint del vibe: nombre, autor, descripción,
 * accent color, icon, tags. Al confirmar, llama a `mint()` del store.
 *
 * @module components/vibeLab/MintDialog
 * @version FASE 4.2
 */

import React, { memo, useState, useCallback, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { useVibeLabStore } from '../../stores/vibeLabStore'
import './mint-dialog.css'

interface MintDialogProps {
  isOpen: boolean
  onClose: () => void
}

const ACCENT_PRESETS = [
  '#00e5ff', '#ff2fd0', '#ffb020', '#00ff88', '#ff5555',
  '#a855f7', '#3b82f6', '#f97316',
]

const ICON_PRESETS = ['🧬', '🌌', '⚡', '🌊', '🔥', '💎', '🌙', '🎨']

export const MintDialog: React.FC<MintDialogProps> = memo(({ isOpen, onClose }) => {
  const draft = useVibeLabStore((s) => s.draft)
  const setMeta = useVibeLabStore((s) => s.setMeta)
  const mint = useVibeLabStore((s) => s.mint)

  const [name, setName] = useState('')
  const [author, setAuthor] = useState('')
  const [description, setDescription] = useState('')
  const [accent, setAccent] = useState('#00e5ff')
  const [icon, setIcon] = useState('🧬')
  const [tagsInput, setTagsInput] = useState('')
  const [minting, setMinting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync from draft meta when dialog opens
  useEffect(() => {
    if (isOpen && draft?.meta) {
      setName(draft.meta.name ?? '')
      setAuthor(draft.meta.author ?? '')
      setDescription(draft.meta.description ?? '')
      setAccent(draft.meta.accentHex ?? '#00e5ff')
      setIcon(draft.meta.icon ?? '🧬')
      setTagsInput((draft.meta.tags ?? []).join(', '))
    }
  }, [isOpen, draft])

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setName(e.target.value)
      setMeta({ name: e.target.value })
    },
    [setMeta],
  )

  const handleAuthorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setAuthor(e.target.value)
      setMeta({ author: e.target.value })
    },
    [setMeta],
  )

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(e.target.value)
      setMeta({ description: e.target.value })
    },
    [setMeta],
  )

  const handleAccentChange = useCallback(
    (color: string) => {
      setAccent(color)
      setMeta({ accentHex: color })
    },
    [setMeta],
  )

  const handleIconChange = useCallback(
    (emoji: string) => {
      setIcon(emoji)
      setMeta({ icon: emoji })
    },
    [setMeta],
  )

  const handleTagsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      setTagsInput(raw)
      const tags = raw
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
      setMeta({ tags })
    },
    [setMeta],
  )

  const handleMint = useCallback(async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setMinting(true)
    setError(null)
    const result = await mint()
    setMinting(false)
    if (result.ok) {
      onClose()
    } else {
      setError(result.error ?? 'Mint failed')
    }
  }, [name, mint, onClose])

  if (!isOpen) return null

  return (
    <div className="mint-dialog-overlay" onClick={onClose}>
      <div className="mint-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="mint-dialog-header">
          <Sparkles size={16} />
          <h2>Mint Vibe</h2>
        </div>

        <div className="mint-dialog-body">
          <label className="mint-dialog-field">
            <span className="mint-dialog-label">Name</span>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="Dubstep Cathedral"
              maxLength={60}
            />
          </label>

          <label className="mint-dialog-field">
            <span className="mint-dialog-label">Author</span>
            <input
              type="text"
              value={author}
              onChange={handleAuthorChange}
              placeholder="Your name"
              maxLength={40}
            />
          </label>

          <label className="mint-dialog-field">
            <span className="mint-dialog-label">Description</span>
            <textarea
              value={description}
              onChange={handleDescriptionChange}
              placeholder="A dark, cavernous dubstep vibe with strobing accents..."
              rows={3}
              maxLength={200}
            />
          </label>

          <label className="mint-dialog-field">
            <span className="mint-dialog-label">Tags (comma-separated)</span>
            <input
              type="text"
              value={tagsInput}
              onChange={handleTagsChange}
              placeholder="dubstep, heavy, club"
              maxLength={100}
            />
          </label>

          <div className="mint-dialog-field">
            <span className="mint-dialog-label">Icon</span>
            <div className="mint-dialog-icon-row">
              {ICON_PRESETS.map((emoji) => (
                <button
                  key={emoji}
                  className={`mint-dialog-icon-swatch ${icon === emoji ? 'selected' : ''}`}
                  onClick={() => handleIconChange(emoji)}
                  type="button"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="mint-dialog-field">
            <span className="mint-dialog-label">Accent Color</span>
            <div className="mint-dialog-accent-row">
              {ACCENT_PRESETS.map((color) => (
                <button
                  key={color}
                  className={`mint-dialog-accent-swatch ${accent === color ? 'selected' : ''}`}
                  style={{ background: color }}
                  onClick={() => handleAccentChange(color)}
                  type="button"
                />
              ))}
            </div>
          </div>

          {error && <p className="mint-dialog-error">{error}</p>}
        </div>

        <div className="mint-dialog-actions">
          <button onClick={onClose} type="button" disabled={minting}>Cancel</button>
          <button onClick={handleMint} type="button" disabled={minting || !name.trim()}>
            {minting ? 'Minting...' : 'Mint .luxvibe'}
          </button>
        </div>
      </div>
    </div>
  )
})

MintDialog.displayName = 'MintDialog'
