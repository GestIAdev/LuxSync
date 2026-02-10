/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📋 CONTEXT MENU - WAVE 2007: DEEP CONTROL
 * 
 * Custom context menu for clip operations.
 * Appears on right-click, provides quick actions.
 * 
 * @module chronos/ui/context/ContextMenu
 * @version WAVE 2007
 */

import React, { useCallback, useEffect, useRef, memo } from 'react'
import './ContextMenu.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ContextMenuItem {
  id: string
  label: string
  icon?: string
  shortcut?: string
  disabled?: boolean
  danger?: boolean
  separator?: boolean
}

export interface ContextMenuProps {
  /** Position to show menu */
  position: { x: number; y: number } | null
  
  /** Menu items */
  items: ContextMenuItem[]
  
  /** Called when item is clicked */
  onSelect: (itemId: string) => void
  
  /** Called when menu should close */
  onClose: () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIP CONTEXT MENU ITEMS
// ═══════════════════════════════════════════════════════════════════════════

export const CLIP_MENU_ITEMS: ContextMenuItem[] = [
  { id: 'duplicate', label: 'Duplicate', icon: '📋', shortcut: 'Ctrl+D' },
  { id: 'copy', label: 'Copy', icon: '📄', shortcut: 'Ctrl+C' },
  { id: 'paste', label: 'Paste', icon: '📋', shortcut: 'Ctrl+V' },
  { id: 'separator-1', label: '', separator: true },
  { id: 'split', label: 'Split at Playhead', icon: '✂️', shortcut: 'S' },
  { id: 'rename', label: 'Rename', icon: '✏️', shortcut: 'F2' },
  { id: 'separator-2', label: '', separator: true },
  { id: 'lock', label: 'Lock/Unlock', icon: '🔒' },
  { id: 'separator-3', label: '', separator: true },
  { id: 'delete', label: 'Delete', icon: '🗑️', shortcut: 'Del', danger: true },
]

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT MENU COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const ContextMenu: React.FC<ContextMenuProps> = memo(({
  position,
  items,
  onSelect,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Close on escape or click outside
  useEffect(() => {
    if (!position) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [position, onClose])
  
  // Adjust position to stay in viewport
  useEffect(() => {
    if (!position || !menuRef.current) return
    
    const menu = menuRef.current
    const rect = menu.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    let adjustedX = position.x
    let adjustedY = position.y
    
    // Prevent going off right edge
    if (position.x + rect.width > viewportWidth) {
      adjustedX = viewportWidth - rect.width - 8
    }
    
    // Prevent going off bottom edge
    if (position.y + rect.height > viewportHeight) {
      adjustedY = viewportHeight - rect.height - 8
    }
    
    menu.style.left = `${adjustedX}px`
    menu.style.top = `${adjustedY}px`
  }, [position])
  
  const handleItemClick = useCallback((item: ContextMenuItem) => {
    if (item.disabled || item.separator) return
    onSelect(item.id)
    onClose()
  }, [onSelect, onClose])
  
  if (!position) return null
  
  return (
    <div 
      ref={menuRef}
      className="context-menu"
      style={{ 
        left: position.x, 
        top: position.y,
      }}
    >
      {items.map(item => {
        if (item.separator) {
          return <div key={item.id} className="menu-separator" />
        }
        
        return (
          <button
            key={item.id}
            className={`menu-item ${item.disabled ? 'disabled' : ''} ${item.danger ? 'danger' : ''}`}
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
          >
            <span className="item-icon">{item.icon}</span>
            <span className="item-label">{item.label}</span>
            {item.shortcut && (
              <span className="item-shortcut">{item.shortcut}</span>
            )}
          </button>
        )
      })}
    </div>
  )
})

ContextMenu.displayName = 'ContextMenu'

export default ContextMenu
