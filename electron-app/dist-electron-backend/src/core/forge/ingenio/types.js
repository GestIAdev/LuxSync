/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📦  INGENIO ECOSYSTEM — TYPE SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4549.1: Los átomos del sistema de Ingenios reutilizables.
 *
 * Un Ingenio es un sub-grafo de nodos encapsulado como entidad
 * independiente, reutilizable entre fixtures.
 *
 * Analogía: Un Ingenio es a un ForgeNodeGraph lo que una función
 * es a un programa — tiene entradas genéricas, salidas genéricas,
 * y una implementación interna encapsulada.
 *
 * PRINCIPIO: Un Ingenio es auto-contenido. Su subGraph NO referencia
 * ningún canal DMX concreto ni fixture específico. Toda la I/O
 * se realiza a través de ExposedPorts.
 *
 * @module core/forge/ingenio/types
 * @version WAVE 4549.1
 */
export {};
