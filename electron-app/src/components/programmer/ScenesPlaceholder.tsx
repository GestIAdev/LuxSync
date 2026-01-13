/**
 * 🎬 SCENES PLACEHOLDER - WAVE 375.5
 * Coming Soon: Timecoder & Scene Recorder
 * Reserved for WAVE 380+
 * 
 * This accordion section shows a teaser for future features
 */

import React, { useState } from 'react'

export const ScenesPlaceholder: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false)
  
  return (
    <div className="programmer-section scenes-section collapsed">
      <div 
        className="section-header clickable"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h4 className="section-title">
          <span className="section-icon">{isExpanded ? '▼' : '▶'}</span>
          SCENES
        </h4>
        <span className="coming-soon-badge">SOON</span>
      </div>
      
      {isExpanded && (
        <div className="scenes-content">
          <div className="coming-soon-container">
            <div className="coming-soon-icon">🎬</div>
            <h3 className="coming-soon-title">COMING SOON</h3>
            <p className="coming-soon-text">
              Timecoder &amp; Scene Recorder
            </p>
            <p className="coming-soon-wave">WAVE 380+</p>
            <div className="coming-soon-features">
              <div className="feature-item">
                <span className="feature-icon">⏱️</span>
                <span className="feature-text">Timeline Sequencing</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">💾</span>
                <span className="feature-text">Scene Recording</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🔁</span>
                <span className="feature-text">Cue Playback</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ScenesPlaceholder
