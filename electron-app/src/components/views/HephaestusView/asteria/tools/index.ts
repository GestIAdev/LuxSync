/**
 * 🜨 WAVE 8020 — Registro de herramientas del Lienzo Táctico.
 * Importar por side-effect desde AsteriaCanvas para poblar TOOL_REGISTRY.
 *
 * @module HephaestusView/asteria/tools
 */

import { registerTool } from './ToolRegistry'
import { SelectTool } from './SelectTool'
import { LassoTool } from './LassoTool'
import { RadialTool } from './RadialTool'

registerTool(SelectTool)
registerTool(LassoTool)
registerTool(RadialTool)

export { SelectTool, LassoTool, RadialTool }
export { getTool, TOOL_REGISTRY, gesturePreview, clearGesturePreview } from './ToolRegistry'
export type { AsteriaTool, AsteriaToolContext, GesturePreview } from './ToolRegistry'
