/**
 * 📱 SIDEBAR - Commander Navigation Panel
 * WAVE 9: Logo + Navigation Tabs + Status Panel
 */

import React from 'react'
import { useNavigationStore, TABS, TabId } from '../../stores/navigationStore'
import { useAudioStore } from '../../stores/audioStore'
import { useDMXStore } from '../../stores/dmxStore'
import { useSeleneStore } from '../../stores/seleneStore'
import './Sidebar.css'

const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab } = useNavigationStore()
  const { bpm, isConnected: audioConnected, level } = useAudioStore()
  const { isConnected: dmxConnected } = useDMXStore()
  const { brainConnected, currentMode } = useSeleneStore()

  return (
    <aside className="sidebar">
      {/* Logo Area */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <span className="logo-moon">🌙</span>
          <span className="logo-stars">✨</span>
        </div>
        <h1 className="logo-text">LUXSYNC</h1>
        <span className="logo-version">v2.0</span>
      </div>

      {/* Navigation Tabs */}
      <nav className="sidebar-nav">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={`${tab.description} (${tab.shortcut})`}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Divider */}
      <div className="sidebar-divider" />

      {/* Status Panel */}
      <div className="status-panel">
        <h3 className="status-title">STATUS</h3>
        
        {/* BPM Display */}
        <div className="status-item">
          <div className="status-item-row">
            <span className="status-icon">♪</span>
            <span className="status-value">{bpm.toFixed(0)} BPM</span>
          </div>
          <div className="mini-bar">
            <div 
              className="mini-bar-fill bpm-pulse" 
              style={{ width: `${Math.min(100, (bpm / 180) * 100)}%` }}
            />
          </div>
        </div>

        {/* Audio Level */}
        <div className="status-item">
          <div className="status-item-row">
            <span className="status-icon">🎤</span>
            <span className="status-value">{level.toFixed(0)} dB</span>
          </div>
          <div className="mini-bar">
            <div 
              className="mini-bar-fill audio-level" 
              style={{ width: `${Math.max(0, ((level + 60) / 60) * 100)}%` }}
            />
          </div>
        </div>

        {/* DMX Status */}
        <div className="status-item">
          <div className="status-item-row">
            <span className={`status-dot ${dmxConnected ? 'connected' : 'disconnected'}`}>◉</span>
            <span className="status-label">
              {dmxConnected ? 'DMX OK' : 'DMX Disconnected'}
            </span>
          </div>
        </div>

        {/* Selene Status */}
        <div className="status-item">
          <div className="status-item-row">
            <span className="status-icon">🌙</span>
            <span className={`status-value ${brainConnected ? 'active' : 'inactive'}`}>
              {brainConnected ? (currentMode === 'intelligent' ? 'Intelligent' : 'Active') : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <span className="footer-text">WAVE 9</span>
      </div>
    </aside>
  )
}

export default Sidebar
