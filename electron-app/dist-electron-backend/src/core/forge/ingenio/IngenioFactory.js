/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📦  INGENIO FACTORY — Creación de Ingenios vacíos y de sistema
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4549.1: Funciones factory para generar estructuras IIngenioDefinition
 * válidas y listas para persistir como .luxingenio.
 *
 * @module core/forge/ingenio/IngenioFactory
 * @version WAVE 4549.1
 */
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const SCHEMA_VERSION = '1.0.0';
const GENERATOR_WAVE = 'WAVE-4549.1';
// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
// Counter global — determinista, nunca usa Math.random()
let _ingenioCounter = 0;
function generateIngenioId() {
    const ts = Date.now().toString(36);
    const seq = (_ingenioCounter++).toString(36).padStart(4, '0');
    return `ingenio-${ts}-${seq}`;
}
function nowISO() {
    return new Date().toISOString();
}
// ═══════════════════════════════════════════════════════════════════════════
// EMPTY GRAPH (for brand-new Ingenios)
// ═══════════════════════════════════════════════════════════════════════════
function createEmptySubGraph() {
    return {
        version: '1.0.0',
        nodes: [],
        edges: [],
        meta: {
            createdAt: nowISO(),
            generatorWave: GENERATOR_WAVE,
            autoMigrated: false,
            dmxFootprint: 0,
        },
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════
export class IngenioFactory {
    /**
     * Creates a valid empty IIngenioDefinition ready for editing.
     *
     * @param name — Display name for the Ingenio
     * @param category — Functional category
     * @param options — Optional overrides
     * @returns A valid .luxingenio structure with zero internal logic
     */
    static createEmpty(name = 'New Ingenio', category = 'utility', options) {
        const now = nowISO();
        return {
            version: SCHEMA_VERSION,
            id: generateIngenioId(),
            name,
            author: options?.author ?? 'User',
            description: options?.description ?? '',
            tags: options?.tags ?? [],
            category,
            exposedPorts: [],
            subGraph: createEmptySubGraph(),
            portMapping: { inputs: [], outputs: [] },
            meta: {
                createdAt: now,
                updatedAt: now,
                generatorWave: GENERATOR_WAVE,
                internalNodeCount: 0,
                internalEdgeCount: 0,
            },
            icon: options?.icon,
            accentColor: options?.accentColor,
        };
    }
    /**
     * Creates an IIngenioDefinition from an existing subGraph and exposed ports.
     * Used when the user "extracts" a selection of nodes from a fixture's
     * nodeGraph into a reusable Ingenio.
     *
     * @param name — Display name
     * @param category — Functional category
     * @param subGraph — The internal logic graph
     * @param exposedPorts — The ports exposed to the outside world
     * @param portMapping — Wiring from exposed ports to internal proxy nodes
     * @param options — Optional overrides
     */
    static fromSubGraph(name, category, subGraph, exposedPorts, portMapping, options) {
        const now = nowISO();
        return {
            version: SCHEMA_VERSION,
            id: generateIngenioId(),
            name,
            author: options?.author ?? 'User',
            description: options?.description ?? '',
            tags: options?.tags ?? [],
            category,
            exposedPorts,
            subGraph,
            portMapping,
            meta: {
                createdAt: now,
                updatedAt: now,
                generatorWave: GENERATOR_WAVE,
                internalNodeCount: subGraph.nodes.length,
                internalEdgeCount: subGraph.edges.length,
            },
            icon: options?.icon,
            accentColor: options?.accentColor,
        };
    }
    /**
     * Updates the metadata timestamps and counts of an existing Ingenio.
     * Returns a new object (immutable pattern).
     */
    static refreshMeta(ingenio) {
        return {
            ...ingenio,
            meta: {
                ...ingenio.meta,
                updatedAt: nowISO(),
                internalNodeCount: ingenio.subGraph.nodes.length,
                internalEdgeCount: ingenio.subGraph.edges.length,
            },
        };
    }
}
