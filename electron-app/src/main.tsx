/**
 * 🚀 LUXSYNC - MAIN ENTRY POINT
 * WAVE 9: Commander Layout → AppCommander
 * WAVE 2097.1: Purged legacy App.tsx (267 lines of dead code)
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import AppCommander from './AppCommander'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppCommander />
  </React.StrictMode>,
)
