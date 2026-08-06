/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 VibeLabView.tsx — Root container for the Custom Vibe Creator
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Layout de §1.2 del blueprint:
 *
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │  HelixBar (DNA donor, nombre, interlock, acciones)          │
 *  ├──────────────────────────────────┬──────────────────────────┤
 *  │  MutationBench (tabs + paneles)  │  MutationScope (canvas)  │
 *  ├──────────────────────────────────┴──────────────────────────┤
 *  │  DiagnosticsRail (mut count, warnings, A/B toggle)          │
 *  └─────────────────────────────────────────────────────────────┘
 *
 * GenomeVault y MintDialog se montan como overlays bajo demanda.
 *
 * @module components/vibeLab/VibeLabView
 * @version FASE 4 — Scope + Diagnostics + Persistence
 */

import React, { useEffect, useState } from 'react'
import { HelixBar } from './HelixBar'
import { MutationBench } from './MutationBench'
import { MutationScope } from './MutationScope'
import { DiagnosticsRail } from './DiagnosticsRail'
import { GenomeVault } from './GenomeVault'
import { MintDialog } from './MintDialog'
import { useVibeLabStore } from '../../stores/vibeLabStore'
import './vibe-lab-view.css'

export const VibeLabView: React.FC = () => {
  const draft = useVibeLabStore((s) => s.draft)
  const beginSession = useVibeLabStore((s) => s.beginSession)
  const [mintOpen, setMintOpen] = useState(false)
  const [vaultOpen, setVaultOpen] = useState(false)

  // Auto-iniciar sesión con techno-club si no hay draft
  useEffect(() => {
    if (!draft) {
      beginSession('techno-club' as never, 'Untitled Vibe')
    }
  }, [draft, beginSession])

  // Escuchar eventos globales para abrir overlays
  useEffect(() => {
    const openMint = () => setMintOpen(true)
    const toggleVault = () => setVaultOpen((v) => !v)
    window.addEventListener('vibeLab:openMint', openMint)
    window.addEventListener('vibeLab:toggleVault', toggleVault)
    return () => {
      window.removeEventListener('vibeLab:openMint', openMint)
      window.removeEventListener('vibeLab:toggleVault', toggleVault)
    }
  }, [])

  return (
    <div className="vibe-lab-view">
      <HelixBar />
      <div className="vibe-lab-body">
        <MutationBench />
        <MutationScope />
      </div>
      <DiagnosticsRail />
      {vaultOpen && (
        <div className="vibe-lab-vault-drawer" onClick={(e) => e.stopPropagation()}>
          <div className="vibe-lab-vault-drawer-header">
            <span>GENOME VAULT</span>
            <button onClick={() => setVaultOpen(false)} type="button">✕</button>
          </div>
          <GenomeVault />
        </div>
      )}
      <MintDialog isOpen={mintOpen} onClose={() => setMintOpen(false)} />
    </div>
  )
}

VibeLabView.displayName = 'VibeLabView'

export default VibeLabView
