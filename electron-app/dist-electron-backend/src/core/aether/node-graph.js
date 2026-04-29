/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  AETHER MATRIX — NODE GRAPH CONTRACTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.1: El contrato de la Matriz — el World del ECS pragmático.
 *
 * El NodeGraph es el registro central de todos los nodos activos.
 * Es el corazón del Motor Agnóstico: almacena nodos en dense arrays
 * por familia, mantiene índices de búsqueda multi-criterio, y expone
 * vistas tipadas para que cada System itere solo los nodos de su dominio.
 *
 * DISEÑO DATA-ORIENTED:
 * - Dense arrays por familia → iteración cache-friendly.
 * - Slot stability → NodeId estable tras patch, sin reordenamiento.
 * - Zero-alloc views → getView() retorna wrapper ligero, sin copia.
 * - Multi-index → búsqueda O(1) por zona, rol, device, o tipo.
 *
 * INMUTABILIDAD DURANTE FRAME:
 * El NodeGraph solo se modifica en eventos de patch (registerDevice,
 * unregisterDevice). Durante el frame loop de 44Hz, la estructura
 * del grafo es inmutable — solo los estados internos de los nodos
 * (Float64Array) se mutan in-place.
 *
 * @module core/aether/node-graph
 * @version WAVE 3505.1
 */
export {};
