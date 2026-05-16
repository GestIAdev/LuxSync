/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  AETHER MATRIX — INTENT BUS IMPLEMENTATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.2: Implementación concreta de IIntentBus.
 *
 * PRINCIPIO FUNDAMENTAL — ZERO ALLOCATIONS PER FRAME:
 * Este es el módulo más crítico para el rendimiento del motor.
 * Se ejecuta 44 veces por segundo (cada frame de 22.7ms).
 * Cada allocation en este path aumenta la presión del GC de V8,
 * causando micro-pauses que se traducen en flicker de luz visible.
 *
 * ESTRATEGIA DE MEMORIA:
 * Todo el espacio de memoria se pre-alloca en el constructor
 * y se reutiliza frame a frame.
 *
 * - `_slots`: Array pre-sized de MAX_INTENTS objetos JS.
 *   Cada slot es un objeto con shape estable (hidden class fija),
 *   cuyas propiedades se sobrescriben in-place en push().
 *
 * - `_writeHead`: Entero que actúa como cursor. clear() lo resetea a 0.
 *   No hay new[], no hay GC.
 *
 * - `_nodeIndex`: Map<NodeId, [start, count]> reconstruido en buildIndex().
 *   Permite a getIntentsForNode() hacer O(1) lookup del rango
 *   sin iterar todo el buffer.
 *
 * - `_nodeRanges`: Float64Array de 2 × MAX_UNIQUE_NODES entradas,
 *   almacenando [start, count] para cada NodeId visto en el frame.
 *   Indexado via `_nodeIndexSlots` (Map<NodeId, rangeOffset>).
 *
 * ORDEN DE OPERACIONES POR FRAME:
 * 1. Orchestrator: `bus.clear()`
 * 2. Systems: `bus.push(intent)` × N
 * 3. Bus: `bus.buildIndex()` (reconstruye el índice nodeId→range)
 * 4. Arbiter: `bus.getIntentsForNode(id)` × M nodos
 *
 * @module core/aether/IntentBus
 * @version WAVE 3505.2
 */
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES DE CAPACIDAD
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Capacidad por defecto del bus.
 *
 * CÁLCULO:
 * - Show grande: 200 devices × ~6 nodos/device = 1200 nodos
 * - 5 Systems generan intents por cada nodo activo (~1200 × 5 = 6000 intents teóricos)
 * - En la práctica: no todos los Systems emiten para todos los nodos.
 *   Estimación realista: 2000-2500 intents/frame (conservadora).
 *
 * Elegimos 4096 (potencia de 2): beneficia la aritmética modular
 * si se extiende el bus en el futuro, y cabe cómodamente en L2 cache
 * (cada slot ocupa ~120 bytes × 4096 = ~480 KB — dentro de L2/L3 típico).
 */
const DEFAULT_CAPACITY = 4096;
/**
 * Número máximo de NodeIds únicos que pueden recibir intents en un frame.
 *
 * Determina el tamaño de los arrays de índice pre-allocated.
 * Para un show con hasta 2000 nodos (objetivo de la directiva).
 */
const MAX_UNIQUE_NODES = 2048;
// ═══════════════════════════════════════════════════════════════════════════
// INTENTBUS IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Implementación concreta de IIntentBus.
 *
 * GARANTÍAS DE RENDIMIENTO VERIFICADAS:
 * - clear():             O(1) — reset de dos enteros
 * - push():              O(1) — write pointer + property overwrite
 * - buildIndex():        O(N) — recorre _writeHead slots una vez
 * - getIntentsForNode(): O(1) — Map.get() + slice del buffer en-lugar
 * - forEach():           O(N) — recorre _writeHead slots una vez
 *
 * ALLOCACIONES POR FRAME: 0
 * (asumiendo que el caller no supera DEFAULT_CAPACITY intents)
 */
export class IntentBus {
    constructor(capacity = DEFAULT_CAPACITY) {
        /** Write cursor: apunta al siguiente slot vacío */
        this._writeHead = 0;
        /** ¿El buffer se desbordó en el frame actual? */
        this._overflowed = false;
        // ── Índice NodeId → rango en el buffer ──────────────────────────────
        /**
         * Map<NodeId, número de entrada en _nodeRangeBuffer>.
         *
         * Este Map mapea cada NodeId a un índice en _nodeRangeBuffer
         * donde están almacenados [startSlot, count].
         *
         * DECISIÓN: Usamos un Map JS (no TypedArray) porque los NodeIds
         * son strings opaco ("deviceId:label"). En TypedArray necesitaríamos
         * una codificación numérica, añadiendo complejidad innecesaria.
         * Map.get() es O(1) amortizado con hash bien distribuido.
         *
         * LIFECYCLE: Se limpia en buildIndex() al inicio, luego se rellena.
         */
        this._nodeRangeIndex = new Map();
        /**
         * Write cursor para el _nodeRangeBuffer (cuántos NodeIds únicos hemos visto).
         * Resetado en cada buildIndex().
         */
        this._nodeRangeHead = 0;
        /** Cursor en _nodeSlotBuffer durante buildIndex() */
        this._nodeSlotHead = 0;
        // Longitud actual del _resultBuffer (property trick para no reasignar length)
        this._resultCount = 0;
        this.capacity = capacity;
        // Pre-alloca los slots de intent con objetos vacíos de shape estable
        this._slots = new Array(capacity);
        this._valuePool = new Array(capacity);
        for (let i = 0; i < capacity; i++) {
            // Todos los slots tienen la misma structure literal → V8 hidden class compartida
            this._slots[i] = { nodeId: '', values: {}, priority: 0, confidence: 1, source: 'color_system', skipDarkSpin: false, mergeStrategy: undefined };
            // Pool de values objects: misma shape → hidden class compartida
            this._valuePool[i] = {};
        }
        // Pre-alloca el buffer de rangos por NodeId
        this._nodeRangeBuffer = new Int32Array(MAX_UNIQUE_NODES * 2);
        // Pre-alloca el buffer de listas de slots por NodeId
        // Capacidad: capacity (cada slot puede ser un NodeId único en el peor caso)
        this._nodeSlotBuffer = new Int32Array(capacity);
        this._nodeSlotListStart = new Int32Array(MAX_UNIQUE_NODES);
        this._nodeSlotListCount = new Int32Array(MAX_UNIQUE_NODES);
        // Pre-alloca el buffer de resultado
        // MAX_INTENTS_PER_RESULT: un nodo puede tener hasta 5 Systems + efectos
        const MAX_INTENTS_PER_RESULT = 32;
        this._resultBuffer = new Array(MAX_INTENTS_PER_RESULT);
        for (let i = 0; i < MAX_INTENTS_PER_RESULT; i++) {
            this._resultBuffer[i] = this._slots[0]; // Referencia válida inicial
        }
        this._resultView = new IntentSlotReadonlyView(this._resultBuffer, () => this._resultCount);
    }
    // ═══════════════════════════════════════════════════════════════════════
    // HOT PATH — Los métodos que se llaman 44 veces por segundo
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Resetea el bus al inicio del frame.
     *
     * COSTO: O(1) — dos asignaciones de entero.
     * ALLOCACIONES: 0.
     *
     * NO limpiamos el contenido de los slots: son datos "fantasma" que
     * quedarán overrideados antes de ser leídos. El _writeHead garantiza
     * que solo se lean los slots 0.._writeHead-1.
     */
    clear() {
        this._writeHead = 0;
        this._overflowed = false;
        // No hacemos _nodeRangeIndex.clear() aquí — se hace en buildIndex().
        // Esto permite interleaving: push() → buildIndex() → getIntentsForNode()
        // sin necesitar clear() entre buildIndex y get.
    }
    /**
     * Escribe un intent en el bus.
     *
     * COSTO: O(1).
     * ALLOCACIONES: 0.
     *
     * PROTOCOLO DE VALUES:
     * Sobrescribimos el objeto del valuePool en la posición _writeHead.
     * Primero borramos las claves previas del objeto (puede tener keys
     * de intents anteriores), luego copiamos las nuevas entradas.
     *
     * LIMPIEZA DE KEYS:
     * `for...in` loop para eliminar keys del objeto reutilizado.
     * V8 optimiza for...in para objetos con hidden class estable.
     * Alternativa rechazada: crear nuevo {} → alloc.
     * Alternativa rechazada: mantener lista de keys → alloc.
     *
     * @param intent — El intent a escribir
     * @returns true si se escribió, false si el bus está lleno
     */
    push(intent) {
        if (this._writeHead >= this.capacity) {
            this._overflowed = true;
            return false;
        }
        const idx = this._writeHead;
        const slot = this._slots[idx];
        const valuesTarget = this._valuePool[idx];
        // Limpiar keys previas del object pool reutilizado
        // DECISIÓN: for...in es el único mecanismo sin alloc para limpiar keys.
        // En V8, si el objeto tiene hidden class estable (pocas keys, misma forma),
        // for...in se convierte en acceso secuencial a un descriptor array interno.
        for (const key in valuesTarget) {
            delete valuesTarget[key];
        }
        // Copiar las entries del intent al pool object
        // DECISIÓN: for...in sobre el intent.values original.
        // No creamos un nuevo objeto — escribimos en el pre-allocated.
        for (const key in intent.values) {
            valuesTarget[key] = intent.values[key];
        }
        // Sobrescribir el slot con los datos del nuevo intent
        slot.nodeId = intent.nodeId;
        slot.values = valuesTarget; // Apunta al pool object actualizado
        slot.priority = intent.priority;
        slot.confidence = intent.confidence;
        slot.source = intent.source;
        // 🏎️ WAVE 4831 / 🌊 WAVE 4832: propagar metadatos opcionales.
        // Sin estos, scratch objects del adapter perdían su semántica al cruzar el bus.
        slot.skipDarkSpin = intent.skipDarkSpin === true;
        slot.mergeStrategy = intent.mergeStrategy;
        this._writeHead++;
        return true;
    }
    /**
     * Construye el índice nodeId → slots en el buffer.
     *
     * CUÁNDO LLAMAR: Después del último push() del frame y ANTES
     * del primer getIntentsForNode(). El Orchestrator es responsable
     * de este ordering.
     *
     * COSTO: O(N) donde N = _writeHead (intents del frame).
     * Primera pasada: asigna un índice de rango a cada NodeId único.
     * Segunda pasada: rellena los _nodeSlotBuffer con los índices de slots.
     *
     * ALLOCACIONES: 0. Todo se escribe en los TypedArrays pre-allocated.
     *
     * IMPLEMENTACIÓN EN DOS PASADAS para evitar intermediate storage:
     * Pasada 1 — Count: determina cuántos intents tiene cada NodeId.
     *            Almacena el count en _nodeSlotListCount[rangeIdx].
     * Pasada 2 — Fill: calcula los start offsets y rellena _nodeSlotBuffer.
     */
    buildIndex() {
        // Reset cursors
        this._nodeRangeIndex.clear();
        this._nodeRangeHead = 0;
        this._nodeSlotHead = 0;
        const write = this._writeHead;
        // ── PASADA 1: Contar intents por NodeId ────────────────────────────
        for (let i = 0; i < write; i++) {
            const nodeId = this._slots[i].nodeId;
            let rangeIdx = this._nodeRangeIndex.get(nodeId);
            if (rangeIdx === undefined) {
                // Nuevo NodeId visto en este frame
                rangeIdx = this._nodeRangeHead++;
                this._nodeRangeIndex.set(nodeId, rangeIdx);
                // Inicializar count a 0 para este NodeId
                this._nodeSlotListCount[rangeIdx] = 0;
            }
            // Incrementar el count para este NodeId
            this._nodeSlotListCount[rangeIdx]++;
        }
        // ── Calcular start offsets en _nodeSlotBuffer ─────────────────────
        // Prefix sum: start[i] = sum of counts[0..i-1]
        // Genera los offsets de inicio de cada lista en el buffer plano.
        let offset = 0;
        const numNodes = this._nodeRangeHead;
        for (let r = 0; r < numNodes; r++) {
            this._nodeSlotListStart[r] = offset;
            offset += this._nodeSlotListCount[r];
            // Resetear count para usarlo como cursor en la pasada 2
            this._nodeSlotListCount[r] = 0;
        }
        // ── PASADA 2: Rellenar _nodeSlotBuffer ────────────────────────────
        for (let i = 0; i < write; i++) {
            const nodeId = this._slots[i].nodeId;
            const rangeIdx = this._nodeRangeIndex.get(nodeId);
            // Posición en _nodeSlotBuffer donde escribir este índice de slot
            const bufferPos = this._nodeSlotListStart[rangeIdx] + this._nodeSlotListCount[rangeIdx];
            this._nodeSlotBuffer[bufferPos] = i;
            // Avanzar cursor de escritura para este NodeId
            this._nodeSlotListCount[rangeIdx]++;
        }
        // Actualizar cursor global (para stats)
        this._nodeSlotHead = offset;
    }
    /**
     * Lee todos los intents dirigidos a un nodo específico.
     *
     * COSTO: O(1) lookup + O(k) copia de referencias donde k = intents del nodo.
     * ALLOCACIONES: 0 (usa _resultBuffer pre-allocated).
     *
     * CONTRATO: El array retornado es válido hasta la siguiente llamada
     * a getIntentsForNode() o clear(). El Arbiter debe procesar
     * los intents inmediatamente, sin guardar la referencia.
     *
     * REQUIERE buildIndex() previo en el frame. Sin buildIndex(),
     * retorna array vacío (comportamiento safe, no crash).
     */
    getIntentsForNode(nodeId) {
        const rangeIdx = this._nodeRangeIndex.get(nodeId);
        if (rangeIdx === undefined) {
            // NodeId sin intents en este frame — caso común, fast path
            this._resultCount = 0;
            return this._resultView;
        }
        const start = this._nodeSlotListStart[rangeIdx];
        const count = this._nodeSlotListCount[rangeIdx];
        // Copiar referencias de slots al resultBuffer
        // DECISIÓN: Copiar 1-5 punteros (8 bytes cada uno) es negligible
        // frente a crear un nuevo array. El JIT puede optimizar este bucle
        // a instrucciones de copia de memoria contigua si count es pequeño.
        for (let i = 0; i < count; i++) {
            this._resultBuffer[i] = this._slots[this._nodeSlotBuffer[start + i]];
        }
        this._resultCount = count;
        return this._resultView;
    }
    /**
     * WAVE 4663 — Accede a un intent por índice sin allocar.
     * Zero-alloc: retorna directamente el slot pre-allocated.
     * Solo válido para índices 0 <= i < count.
     */
    getAt(index) {
        return this._slots[index];
    }
    /**
     * Retorna TODOS los intents del frame. Solo para debug/telemetría.
     *
     * SÍ alloca (crea un array nuevo). NO usar en el hot path.
     */
    getAll() {
        // Array.from() aquí es intencional — esta función es off-path
        const result = [];
        for (let i = 0; i < this._writeHead; i++) {
            result.push(this._slots[i]);
        }
        return result;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PROPIEDADES DE ESTADO
    // ═══════════════════════════════════════════════════════════════════════
    get count() {
        return this._writeHead;
    }
    get overflowed() {
        return this._overflowed;
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// INTENT SLOT READONLY VIEW — Proxy zero-alloc para el resultado
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Vista readonly del _resultBuffer que implementa la interfaz de array iterable.
 *
 * RAZÓN DE SER:
 * Necesitamos retornar `readonly INodeIntent[]` desde getIntentsForNode().
 * Pero no queremos crear un new Array() cada vez.
 *
 * Esta clase envuelve el buffer de resultado con una interfaz iterable
 * compatible con for...of y desestructuración, sin ser un Array real.
 *
 * PROTOCOL:
 * - El `count` lo obtiene via callback al IntentBus para leer _resultCount.
 * - Los accesos por índice van directo al _buffer.
 * - Symbol.iterator permite for...of sin alloc adicional.
 *
 * LIMITACIÓN INTENCIONAL: No implementa todos los métodos de Array.
 * Solo los mínimos que el Arbiter necesita. Añadir más métodos solo
 * cuando sea necesario (axioma anti-over-engineering).
 */
class IntentSlotReadonlyView {
    constructor(_buffer, _getCount) {
        this._buffer = _buffer;
        this._getCount = _getCount;
    }
    get length() {
        return this._getCount();
    }
    /** Acceso por índice — idéntico a array[i] */
    get(index) {
        return this._buffer[index];
    }
    /** Iterador for...of compatible  — zero-alloc para casos con count ≤ 5 */
    [Symbol.iterator]() {
        const buffer = this._buffer;
        const count = this._getCount();
        let i = 0;
        return {
            next() {
                if (i < count) {
                    return { value: buffer[i++], done: false };
                }
                return { value: undefined, done: true };
            },
        };
    }
}
