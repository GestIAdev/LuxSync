// ═══════════════════════════════════════════════════════════════════════════
//  🔄 CIRCULAR BUFFER - Memoria Finita de Alto Rendimiento
// ═══════════════════════════════════════════════════════════════════════════
//  WAVE 664 - CONTEXTUAL MEMORY - PHASE 1
//  "Un buffer que olvida el pasado lejano para recordar el presente"
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Buffer circular de tamaño fijo.
 *
 * Cuando está lleno, sobrescribe los elementos más antiguos.
 * Optimizado para operaciones O(1) de inserción y lectura.
 *
 * @example
 * ```typescript
 * const buffer = new CircularBuffer<number>(5);
 * buffer.push(1, 2, 3, 4, 5);
 * buffer.push(6); // Sobrescribe el 1
 * buffer.getAll(); // [2, 3, 4, 5, 6]
 * ```
 */
export class CircularBuffer {
    constructor(capacity) {
        this.head = 0; // Índice donde escribir el siguiente elemento
        this._size = 0; // Elementos actualmente en el buffer
        if (capacity <= 0) {
            throw new Error('CircularBuffer capacity must be positive');
        }
        this.capacity = capacity;
        this.buffer = new Array(capacity);
    }
    /**
     * Añade uno o más elementos al buffer.
     * Si el buffer está lleno, sobrescribe los más antiguos.
     */
    push(...items) {
        for (const item of items) {
            this.buffer[this.head] = item;
            this.head = (this.head + 1) % this.capacity;
            if (this._size < this.capacity) {
                this._size++;
            }
        }
    }
    /**
     * Obtiene todos los elementos en orden cronológico (más antiguo primero).
     */
    getAll() {
        if (this._size === 0)
            return [];
        const result = new Array(this._size);
        const start = this._size < this.capacity ? 0 : this.head;
        for (let i = 0; i < this._size; i++) {
            result[i] = this.buffer[(start + i) % this.capacity];
        }
        return result;
    }
    /**
     * Obtiene el elemento más reciente.
     */
    getLast() {
        if (this._size === 0)
            return undefined;
        const lastIndex = (this.head - 1 + this.capacity) % this.capacity;
        return this.buffer[lastIndex];
    }
    /**
     * Obtiene los últimos N elementos (más recientes primero).
     */
    getLastN(n) {
        const count = Math.min(n, this._size);
        const result = new Array(count);
        for (let i = 0; i < count; i++) {
            const index = (this.head - 1 - i + this.capacity) % this.capacity;
            result[i] = this.buffer[index];
        }
        return result;
    }
    /**
     * Obtiene el elemento en una posición específica (0 = más antiguo).
     */
    get(index) {
        if (index < 0 || index >= this._size)
            return undefined;
        const start = this._size < this.capacity ? 0 : this.head;
        return this.buffer[(start + index) % this.capacity];
    }
    /**
     * Número de elementos actualmente en el buffer.
     */
    get size() {
        return this._size;
    }
    /**
     * Capacidad máxima del buffer.
     */
    get maxCapacity() {
        return this.capacity;
    }
    /**
     * ¿Está el buffer lleno?
     */
    get isFull() {
        return this._size === this.capacity;
    }
    /**
     * ¿Está el buffer vacío?
     */
    get isEmpty() {
        return this._size === 0;
    }
    /**
     * Limpia el buffer.
     */
    clear() {
        this.buffer = new Array(this.capacity);
        this.head = 0;
        this._size = 0;
    }
    /**
     * Itera sobre todos los elementos (más antiguo primero).
     */
    *[Symbol.iterator]() {
        const all = this.getAll();
        for (const item of all) {
            yield item;
        }
    }
}
export default CircularBuffer;
