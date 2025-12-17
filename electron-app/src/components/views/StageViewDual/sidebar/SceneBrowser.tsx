/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 SCENE BROWSER - WAVE 32: Scene Engine UI
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Panel de escenas en el sidebar:
 * - Grid de escenas guardadas
 * - Botón REC: Captura estado actual
 * - Botón PLAY: Aplica escena seleccionada
 * - Gestión de escenas (rename, delete)
 * 
 * @module components/views/StageViewDual/sidebar/SceneBrowser
 * @version 32.0.0
 */

import React, { useState, useCallback } from 'react'
import { 
  useSceneStore, 
  selectScenes, 
  selectActiveSceneId, 
  selectIsTransitioning,
  Scene 
} from '../../../../stores/sceneStore'
import './SceneBrowser.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface SceneBrowserProps {
  /** Callback cuando se selecciona una escena */
  onSceneSelect?: (sceneId: string) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// SUBCOMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

/** Card de una escena individual */
const SceneCard: React.FC<{
  scene: Scene
  isActive: boolean
  isPlaying: boolean
  onPlay: () => void
  onDelete: () => void
  onRename: (newName: string) => void
}> = ({ scene, isActive, isPlaying, onPlay, onDelete, onRename }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(scene.name)
  
  const handleDoubleClick = () => {
    setIsEditing(true)
    setEditName(scene.name)
  }
  
  const handleBlur = () => {
    setIsEditing(false)
    if (editName.trim() && editName !== scene.name) {
      onRename(editName.trim())
    }
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditName(scene.name)
    }
  }
  
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }
  
  return (
    <div 
      className={`scene-card ${isActive ? 'active' : ''} ${isPlaying ? 'playing' : ''}`}
      style={{ '--preview-color': scene.metadata.previewColor } as React.CSSProperties}
    >
      {/* Color Preview */}
      <div 
        className="scene-preview"
        style={{ backgroundColor: scene.metadata.previewColor }}
      >
        <span className="fixture-count">{scene.metadata.fixtureCount}</span>
      </div>
      
      {/* Info */}
      <div className="scene-info">
        {isEditing ? (
          <input
            type="text"
            className="scene-name-input"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <span 
            className="scene-name" 
            onDoubleClick={handleDoubleClick}
            title="Double-click to rename"
          >
            {scene.name}
          </span>
        )}
        <span className="scene-time">{formatDate(scene.createdAt)}</span>
      </div>
      
      {/* Actions */}
      <div className="scene-actions">
        <button 
          className="scene-btn play" 
          onClick={onPlay}
          title="Play scene"
          disabled={isPlaying}
        >
          {isPlaying ? '⏳' : '▶'}
        </button>
        <button 
          className="scene-btn delete" 
          onClick={onDelete}
          title="Delete scene"
        >
          🗑️
        </button>
      </div>
      
      {/* Active indicator */}
      {isActive && <div className="active-indicator" />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const SceneBrowser: React.FC<SceneBrowserProps> = ({ onSceneSelect }) => {
  const scenes = useSceneStore(selectScenes)
  const activeSceneId = useSceneStore(selectActiveSceneId)
  const isTransitioning = useSceneStore(selectIsTransitioning)
  const transition = useSceneStore(state => state.transition)
  
  const saveScene = useSceneStore(state => state.saveScene)
  const loadScene = useSceneStore(state => state.loadScene)
  const deleteScene = useSceneStore(state => state.deleteScene)
  const updateScene = useSceneStore(state => state.updateScene)
  
  const [newSceneName, setNewSceneName] = useState('')
  const [showRecDialog, setShowRecDialog] = useState(false)
  
  // ─────────────────────────────────────────────────────────────────────────
  // 🎬 REC - Save current state
  // ─────────────────────────────────────────────────────────────────────────
  const handleRec = useCallback(() => {
    setShowRecDialog(true)
    setNewSceneName(`Scene ${scenes.length + 1}`)
  }, [scenes.length])
  
  const handleSaveScene = useCallback(() => {
    if (newSceneName.trim()) {
      const sceneId = saveScene(newSceneName.trim())
      setShowRecDialog(false)
      setNewSceneName('')
      onSceneSelect?.(sceneId)
    }
  }, [newSceneName, saveScene, onSceneSelect])
  
  const handleCancelRec = useCallback(() => {
    setShowRecDialog(false)
    setNewSceneName('')
  }, [])
  
  // ─────────────────────────────────────────────────────────────────────────
  // ▶ PLAY - Load scene
  // ─────────────────────────────────────────────────────────────────────────
  const handlePlay = useCallback((sceneId: string) => {
    loadScene(sceneId)
    onSceneSelect?.(sceneId)
  }, [loadScene, onSceneSelect])
  
  // ─────────────────────────────────────────────────────────────────────────
  // 🗑️ DELETE
  // ─────────────────────────────────────────────────────────────────────────
  const handleDelete = useCallback((sceneId: string) => {
    if (confirm('¿Eliminar esta escena?')) {
      deleteScene(sceneId)
    }
  }, [deleteScene])
  
  // ─────────────────────────────────────────────────────────────────────────
  // ✏️ RENAME
  // ─────────────────────────────────────────────────────────────────────────
  const handleRename = useCallback((sceneId: string, newName: string) => {
    updateScene(sceneId, { name: newName })
  }, [updateScene])
  
  // ─────────────────────────────────────────────────────────────────────────
  // 🎨 RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="scene-browser">
      {/* Header con REC button */}
      <div className="scene-browser-header">
        <h4 className="section-title">
          <span className="title-icon">🎬</span>
          SCENES
          <span className="scene-count">{scenes.length}</span>
        </h4>
        
        <button 
          className={`rec-button ${showRecDialog ? 'recording' : ''}`}
          onClick={handleRec}
          title="Record current state as scene"
        >
          <span className="rec-dot">●</span>
          REC
        </button>
      </div>
      
      {/* Transition Progress */}
      {isTransitioning && (
        <div className="transition-bar">
          <div 
            className="transition-progress" 
            style={{ width: `${transition.progress * 100}%` }}
          />
          <span className="transition-label">
            Transitioning... {Math.round(transition.progress * 100)}%
          </span>
        </div>
      )}
      
      {/* REC Dialog */}
      {showRecDialog && (
        <div className="rec-dialog">
          <input
            type="text"
            className="rec-input"
            placeholder="Scene name..."
            value={newSceneName}
            onChange={e => setNewSceneName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSaveScene()
              if (e.key === 'Escape') handleCancelRec()
            }}
            autoFocus
          />
          <div className="rec-dialog-actions">
            <button className="dialog-btn save" onClick={handleSaveScene}>
              💾 Save
            </button>
            <button className="dialog-btn cancel" onClick={handleCancelRec}>
              ✕
            </button>
          </div>
        </div>
      )}
      
      {/* Scene Grid */}
      <div className="scene-grid">
        {scenes.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📭</span>
            <span className="empty-text">No scenes saved</span>
            <span className="empty-hint">Press REC to capture current state</span>
          </div>
        ) : (
          scenes.map(scene => (
            <SceneCard
              key={scene.id}
              scene={scene}
              isActive={scene.id === activeSceneId}
              isPlaying={isTransitioning && transition.targetSceneId === scene.id}
              onPlay={() => handlePlay(scene.id)}
              onDelete={() => handleDelete(scene.id)}
              onRename={(newName) => handleRename(scene.id, newName)}
            />
          ))
        )}
      </div>
      
      {/* Quick Actions */}
      {scenes.length > 0 && (
        <div className="scene-quick-actions">
          <button 
            className="quick-btn"
            onClick={() => loadScene(scenes[0].id, { fadeTime: 0 })}
            title="Instant load first scene"
          >
            ⚡ Quick Load
          </button>
        </div>
      )}
    </div>
  )
}

export default SceneBrowser
