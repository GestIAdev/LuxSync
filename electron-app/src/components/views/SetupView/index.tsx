/**
 * SETUP VIEW - COMMAND CENTER
 * WAVE 26 Phase 1: Dashboard Hibrido Architecture
 * 
 * NEW ARCHITECTURE:
 * - SetupStatusBar: Immutable header with VU, Show, DMX status
 * - SetupTabsNavigation: DEVICES | PATCH | LIBRARY
 * - Tab Content: DevicesTab, PatchTab, LibraryTab
 * 
 * OLD WIZARD ELIMINATED
 * Legacy code preserved in: index.legacy.tsx
 */

import React from 'react'
import { useSetupStore } from '../../../stores/setupStore'
import { SetupLayout } from './SetupLayout'
import { DevicesTab, PatchTab, LibraryTab } from './tabs'
import './SetupView.css'

const SetupView: React.FC = () => {
  const activeTab = useSetupStore((s) => s.activeTab)

  return (
    <SetupLayout>
      {activeTab === 'devices' && <DevicesTab />}
      {activeTab === 'patch' && <PatchTab />}
      {activeTab === 'library' && <LibraryTab />}
    </SetupLayout>
  )
}

export default SetupView
