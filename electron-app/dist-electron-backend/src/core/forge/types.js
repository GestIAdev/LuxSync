/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  FORGE NODE GRAPH — TYPE SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4548.2: Los átomos del nuevo grafo de nodos de la Forja.
 *
 * Este archivo define la totalidad del sistema de tipos para el
 * Forge NodeGraph — el grafo de nodos a nivel de **fixture definition**
 * (design-time). NO confundir con el Aether NodeGraph (runtime, 44Hz).
 *
 * El Forge NodeGraph describe la lógica interna de un fixture:
 * qué entradas recibe (DMX, audio, beat), qué transformaciones aplica
 * (LFO, math, smooth), y qué canales DMX físicos produce como salida.
 *
 * PRINCIPIO: Todas las interfaces son readonly. La inmutabilidad
 * estructural es un contrato — la mutación solo ocurre creando
 * nuevas instancias (patch time), nunca in-place.
 *
 * @module core/forge/types
 * @version WAVE 4548.2
 */
export {};
