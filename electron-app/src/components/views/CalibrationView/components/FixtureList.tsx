/**
 * 📋 FIXTURE LIST - WAVE 425
 * Lista de fixtures calibrables (moving heads)
 * 
 * Shows all fixtures that can be calibrated with selection state
 */

import React from 'react'
import './FixtureList.css'

interface Fixture {
  id: string
  name?: string
  type?: string
  address?: number
}

export interface FixtureListProps {
  fixtures: Fixture[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export const FixtureList: React.FC<FixtureListProps> = ({
  fixtures,
  selectedId,
  onSelect,
}) => {
  /**
   * Get fixture icon based on type
   */
  const getFixtureIcon = (type?: string): string => {
    const t = (type || '').toLowerCase()
    if (t.includes('spot')) return '🔦'
    if (t.includes('beam')) return '⚡'
    if (t.includes('wash')) return '🌊'
    if (t.includes('moving')) return '🎯'
    return '💡'
  }
  
  /**
   * Format fixture type for display
   */
  const formatType = (type?: string): string => {
    if (!type) return 'Unknown'
    return type
      .replace(/-/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toUpperCase()
  }
  
  return (
    <div className="fixture-list-panel">
      <div className="panel-header">
        <span className="header-icon">📋</span>
        <h3>FIXTURES</h3>
        <span className="header-badge">{fixtures.length}</span>
      </div>
      
      <div className="fixture-list">
        {fixtures.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🔍</span>
            <p>No calibratable fixtures found</p>
            <p className="empty-hint">Add moving heads to your stage</p>
          </div>
        ) : (
          fixtures.map((fixture) => (
            <button
              key={fixture.id}
              className={`fixture-item ${selectedId === fixture.id ? 'selected' : ''}`}
              onClick={() => onSelect(fixture.id)}
            >
              <span className="fixture-icon">{getFixtureIcon(fixture.type)}</span>
              <div className="fixture-info">
                <span className="fixture-name">{fixture.name || fixture.id}</span>
                <span className="fixture-type">{formatType(fixture.type)}</span>
              </div>
              <span className="fixture-address">
                {fixture.address !== undefined ? `CH ${fixture.address}` : '—'}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default FixtureList
