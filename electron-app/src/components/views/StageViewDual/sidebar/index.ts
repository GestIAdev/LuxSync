/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📋 SIDEBAR INDEX - WAVE 429: CSS INJECTION FIX
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
import './InspectorControls.css'
import './SceneBrowser.css'
import './PaletteControlMini.css'
import './controls.css'

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

// Main Container
export { StageSidebar } from './StageSidebar'
export type { StageSidebarProps } from './StageSidebar'

// Individual Controls
export { ColorPicker } from './ColorPicker'
export type { ColorPickerProps } from './ColorPicker'

export { DimmerSlider } from './DimmerSlider'
export type { DimmerSliderProps } from './DimmerSlider'

export { PanTiltControl } from './PanTiltControl'
export type { PanTiltControlProps } from './PanTiltControl'

// Control Panels
export { InspectorControls } from './InspectorControls'
export type { InspectorControlsProps } from './InspectorControls'

// WAVE 32: Scene Browser
export { SceneBrowser } from './SceneBrowser'
export type { SceneBrowserProps } from './SceneBrowser'

// WAVE 33.2: Palette Control
export { PaletteControlMini } from './PaletteControlMini'
export type { PaletteControlMiniProps } from './PaletteControlMini'
