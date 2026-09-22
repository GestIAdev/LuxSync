/**
 * 🜨 WAVE 8020 + 8040B — Registro de herramientas del Lienzo Táctico.
 * Importar por side-effect desde AsteriaCanvas para poblar TOOL_REGISTRY.
 *
 * @module HephaestusView/asteria/tools
 */

import { registerTool } from './ToolRegistry'
import { SelectTool } from './SelectTool'
import { LassoTool } from './LassoTool'
import { RadialTool } from './RadialTool'
import { ChronoBrushTool } from './ChronoBrushTool'
import { CellSurgeonTool } from './CellSurgeonTool'

registerTool(SelectTool)
registerTool(LassoTool)
registerTool(RadialTool)
registerTool(ChronoBrushTool) // T3 ✎ — WAVE 8040B
registerTool(CellSurgeonTool) // T7 ✜ — WAVE 8040B

export { SelectTool, LassoTool, RadialTool, ChronoBrushTool, CellSurgeonTool }
export { getTool, TOOL_REGISTRY, gesturePreview, clearGesturePreview } from './ToolRegistry'
export type { AsteriaTool, AsteriaToolContext, GesturePreview } from './ToolRegistry'
