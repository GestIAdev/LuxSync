/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📋 SIDEBAR INDEX - WAVE 435: LEGACY PURGE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ARQUITECTURA:
 * El barrel export es responsable de cargar TODO lo que el módulo expone,
 * incluyendo los estilos. Esto garantiza que cuando se hace lazy import
 * de este módulo, TODOS los CSS se cargan correctamente.
 * 
 * SIN ESTO: Vite hace tree-shaking del CSS como side-effect y no lo carga.
 * CON ESTO: El CSS se incluye explícitamente en el bundle del módulo.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// CSS IMPORTS - CRITICAL: Must be imported here for lazy-loaded modules
// ═══════════════════════════════════════════════════════════════════════════
import './StageSidebar.css'
import './SceneBrowser.css'
import './controls.css'

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT EXPORTS - WAVE 435: LEGACY PURGE COMPLETE
// ═══════════════════════════════════════════════════════════════════════════

// Main Container
export { StageSidebar } from './StageSidebar'

// Scene Management
export { SceneBrowser } from './SceneBrowser'
export type { SceneBrowserProps } from './SceneBrowser'

// 🗑️ WAVE 435: LEGACY REMOVED
// The following components were deprecated and deleted:
// - InspectorControls.tsx (replaced by TheProgrammerContent)
// - ColorPicker.tsx (replaced by ColorSection)
// - DimmerSlider.tsx (replaced by IntensitySection)
// - PanTiltControl.tsx (replaced by PositionSection)
// - PaletteControlMini.tsx (functionality in ColorSection)

export type { StageSidebarProps } from './StageSidebar'
