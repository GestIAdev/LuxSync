/**
 * 🚀 LUXSYNC - MAIN ENTRY POINT
 * WAVE 9: Commander Layout
 * 
 * Switch between legacy App and new AppCommander:
 * - AppCommander: New Commander Layout (WAVE 9)
 * - App: Legacy layout (pre-WAVE 9)
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
// import App from './App'  // Legacy layout - preserved for reference
import AppCommander from './AppCommander'  // WAVE 9 Commander Layout
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppCommander />
  </React.StrictMode>,
)
