import React, { useMemo } from 'react'
import type { KeyBinding, LayerId, ModifierState } from '../keyforge/types'

export interface PaletteActionItem {
  readonly id: string
  readonly label: string
  readonly category: string
}

interface ActionPaletteProps {
  actions: readonly PaletteActionItem[]
  bindings: Readonly<Record<string, KeyBinding>>
  viewLayer: LayerId
  searchQuery: string
  pendingMappingAction: string | null
  isLearnModeActive: boolean
  onSearchQueryChange: (value: string) => void
  onLearnAction: (actionId: string) => void
}

const CATEGORY_ORDER: readonly string[] = [
  'Playback',
  'UI Navigation',
  'Overrides',
  'Selection',
  'Kinetic',
  'System Control',
  'Effects',
  'Vibes',
  'Other',
]

function formatCombo(binding: KeyBinding): string {
  const mods: Partial<ModifierState> = binding.requiredMods ?? {}
  const parts: string[] = []

  if (mods.shift) parts.push('Shift')
  if (mods.ctrl) parts.push('Control')
  if (mods.alt) parts.push('Alt')
  if (mods.meta) parts.push('Meta')
  parts.push(binding.key)

  return parts.join('+')
}

function getMappedComboForLayer(
  bindings: Readonly<Record<string, KeyBinding>>,
  viewLayer: LayerId,
  actionId: string,
): string | null {
  for (const binding of Object.values(bindings)) {
    if (binding.layer !== viewLayer) continue
    if (binding.actionId !== actionId) continue
    return formatCombo(binding)
  }

  return null
}

const ActionPalette: React.FC<ActionPaletteProps> = ({
  actions,
  bindings,
  viewLayer,
  searchQuery,
  pendingMappingAction,
  isLearnModeActive,
  onSearchQueryChange,
  onLearnAction,
}) => {
  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!normalizedQuery) return actions
    return actions.filter(action => (
      action.label.toLowerCase().includes(normalizedQuery)
      || action.id.toLowerCase().includes(normalizedQuery)
      || action.category.toLowerCase().includes(normalizedQuery)
    ))
  }, [actions, normalizedQuery])

  const grouped = useMemo(() => {
    const groups = new Map<string, PaletteActionItem[]>()
    for (const action of filtered) {
      const existing = groups.get(action.category)
      if (existing) {
        existing.push(action)
      } else {
        groups.set(action.category, [action])
      }
    }

    for (const list of groups.values()) {
      list.sort((a, b) => a.label.localeCompare(b.label))
    }

    return Array.from(groups.entries()).sort((left, right) => {
      const leftRank = CATEGORY_ORDER.indexOf(left[0])
      const rightRank = CATEGORY_ORDER.indexOf(right[0])
      const safeLeft = leftRank >= 0 ? leftRank : CATEGORY_ORDER.length
      const safeRight = rightRank >= 0 ? rightRank : CATEGORY_ORDER.length
      if (safeLeft !== safeRight) return safeLeft - safeRight
      return left[0].localeCompare(right[0])
    })
  }, [filtered])

  return (
    <aside style={{
      width: '360px',
      minWidth: '360px',
      maxHeight: '520px',
      border: '1px solid #2c3442',
      borderRadius: '8px',
      background: 'linear-gradient(180deg, #101720 0%, #0c1219 100%)',
      boxShadow: 'inset 0 0 0 1px #0f1726, 0 10px 30px rgba(0, 0, 0, 0.45)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px',
        borderBottom: '1px solid #253040',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}>
          <span style={{
            fontSize: '10px',
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
            color: '#d1d5db',
            textTransform: 'uppercase',
          }}>
            Action Palette
          </span>
          <span style={{
            fontSize: '9px',
            fontFamily: 'monospace',
            color: '#9ca3af',
            letterSpacing: '0.05em',
          }}>
            Layer: {viewLayer}
          </span>
        </div>

        <input
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Filter action..."
          spellCheck={false}
          style={{
            width: '100%',
            background: '#0b1118',
            color: '#e5e7eb',
            border: '1px solid #364152',
            borderRadius: '6px',
            fontFamily: 'monospace',
            fontSize: '10px',
            letterSpacing: '0.02em',
            padding: '6px 8px',
            outline: 'none',
          }}
        />

        {isLearnModeActive && pendingMappingAction && (
          <div style={{
            fontSize: '9px',
            fontFamily: 'monospace',
            color: '#fbbf24',
            letterSpacing: '0.06em',
            textShadow: '0 0 8px #f59e0b70',
            animation: 'kfo-pulse 0.9s ease-in-out infinite',
          }}>
            A LA ESPERA DE TECLA... {pendingMappingAction}
          </div>
        )}
      </div>

      <div style={{
        overflowY: 'auto',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        {grouped.length === 0 && (
          <div style={{
            fontSize: '10px',
            color: '#6b7280',
            fontFamily: 'monospace',
            letterSpacing: '0.04em',
          }}>
            No actions match the current filter.
          </div>
        )}

        {grouped.map(([category, list]) => (
          <section key={category} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{
              fontSize: '9px',
              fontFamily: 'monospace',
              color: '#93c5fd',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              borderBottom: '1px solid #1f2937',
              paddingBottom: '3px',
            }}>
              {category}
            </div>

            {list.map(action => {
              const mappedCombo = getMappedComboForLayer(bindings, viewLayer, action.id)
              const isArmed = pendingMappingAction === action.id && isLearnModeActive

              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => onLearnAction(action.id)}
                  style={{
                    width: '100%',
                    border: `1px solid ${isArmed ? '#f59e0b' : '#2b3644'}`,
                    borderRadius: '6px',
                    background: isArmed ? '#2a1b04' : '#121a24',
                    boxShadow: isArmed ? '0 0 10px #f59e0b50' : 'none',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{
                      fontSize: '10px',
                      color: '#e5e7eb',
                      fontFamily: 'monospace',
                      letterSpacing: '0.03em',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                    }}>
                      {action.label}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      color: '#9ca3af',
                      fontFamily: 'monospace',
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                    }}>
                      {action.id}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span style={{
                      fontSize: '8px',
                      fontFamily: 'monospace',
                      letterSpacing: '0.04em',
                      fontWeight: '600',
                      color: mappedCombo ? '#86efac' : '#fca5a5',
                      border: `1px solid ${mappedCombo ? '#0d6d47' : '#991b1b'}`,
                      background: mappedCombo ? '#052e1660' : '#450a0a60',
                      borderRadius: '999px',
                      padding: '2px 6px',
                    }}>
                      {mappedCombo ?? 'Unmapped'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onLearnAction(action.id)}
                      style={{
                        fontSize: '8px',
                        fontFamily: 'monospace',
                        letterSpacing: '0.06em',
                        fontWeight: '600',
                        color: isArmed ? '#fbbf24' : '#d1d5db',
                        background: isArmed ? '#78350f40' : '#1f2937',
                        border: `1px solid ${isArmed ? '#f59e0b' : '#374151'}`,
                        borderRadius: '4px',
                        padding: '2px 6px',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      {isArmed ? '⚡' : 'L'}
                    </button>
                  </div>
                </button>
              )
            })}
          </section>
        ))}
      </div>
    </aside>
  )
}

export default ActionPalette
