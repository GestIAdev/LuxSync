/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 ACCORDION - WAVE 2008: COLLAPSIBLE CATEGORY SECTIONS
 * 
 * Componente reutilizable para secciones expandibles/colapsables.
 * Usado en ArsenalPanel para organizar efectos por categoría.
 * 
 * FEATURES:
 * - Toggle con animación suave
 * - Estado persistente por sesión
 * - Indicador visual de cantidad de items
 * - Hover effects y accesibilidad
 * 
 * @module chronos/ui/common/Accordion
 * @version WAVE 2008
 */

import React, { useState, useCallback, memo, type ReactNode } from 'react'
import './Accordion.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface AccordionProps {
  /** Section title */
  title: string
  
  /** Icon emoji for the header */
  icon: string
  
  /** Header accent color */
  color: string
  
  /** Number badge (item count) */
  count?: number
  
  /** Initially expanded? */
  defaultExpanded?: boolean
  
  /** Children content to show/hide */
  children: ReactNode
  
  /** Optional class name */
  className?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const Accordion: React.FC<AccordionProps> = memo(({
  title,
  icon,
  color,
  count,
  defaultExpanded = true,
  children,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  
  const toggle = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])
  
  return (
    <div 
      className={`chronos-accordion ${isExpanded ? 'expanded' : 'collapsed'} ${className}`}
      style={{ '--accent-color': color } as React.CSSProperties}
    >
      {/* Header - clickable to toggle */}
      <button 
        className="accordion-header"
        onClick={toggle}
        aria-expanded={isExpanded}
        type="button"
      >
        <div className="accordion-header-left">
          <span className="accordion-icon">{icon}</span>
          <span className="accordion-title">{title}</span>
          {count !== undefined && (
            <span className="accordion-count">{count}</span>
          )}
        </div>
        
        <span className={`accordion-chevron ${isExpanded ? 'up' : 'down'}`}>
          ▼
        </span>
      </button>
      
      {/* Content - animated show/hide */}
      <div className="accordion-content">
        <div className="accordion-content-inner">
          {children}
        </div>
      </div>
    </div>
  )
})

Accordion.displayName = 'Accordion'

export default Accordion
