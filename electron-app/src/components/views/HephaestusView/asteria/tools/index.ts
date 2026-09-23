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
import { GlyphTool } from './GlyphTool'
import { PolygonTool } from './PolygonTool'
import { LineTool } from './LineTool'

registerTool(SelectTool)
registerTool(LassoTool)
registerTool(RadialTool)
registerTool(PolygonTool)     // ⬠ — WAVE 8150-F4
registerTool(LineTool)        // ╱ — WAVE 8150-F4
registerTool(ChronoBrushTool) // T3 ✎ — WAVE 8040B
registerTool(CellSurgeonTool) // T7 ✜ — WAVE 8040B
registerTool(GlyphTool)       // T5 A — WAVE 8050

export { SelectTool, LassoTool, RadialTool, ChronoBrushTool, CellSurgeonTool, GlyphTool, PolygonTool, LineTool }
export { getTool, TOOL_REGISTRY, gesturePreview, clearGesturePreview } from './ToolRegistry'
export type { AsteriaTool, AsteriaToolContext, GesturePreview } from './ToolRegistry'
