/**
 * 🔧 LIMITED BUFFER V194
 * Directiva V194: Cirugía del Panteón - Fix #2
 *
 * PROPÓSITO: Prevenir buffer overflows implementando buffers con límite
 * máximo y rotación automática para todos los componentes Selene
 */
export class LimitedBuffer {
    buffer = [];
    options;
    stats;
    id;
    constructor(id, options) {
        this.id = id;
        this.options = {
            maxSize: options.maxSize,
            onOverflow: options.onOverflow || "rotate",
            onItemRemoved: options.onItemRemoved || (() => { }),
            compressionRatio: options.compressionRatio || 0.5,
            warningThreshold: options.warningThreshold || 0.8,
        };
        this.stats = {
            currentSize: 0,
            maxSize: this.options.maxSize,
            totalPushed: 0,
            totalRemoved: 0,
            overflowCount: 0,
            lastAccess: Date.now(),
            compressionEvents: 0,
        };
        console.log("BUFFER", `LimitedBuffer[${this.id}] created: limit=${this.options.maxSize}, overflow=${this.options.onOverflow}`);
    }
    /**
     * Añadir elemento al buffer con gestión de overflow
     */
    push(item) {
        this.stats.lastAccess = Date.now();
        this.stats.totalPushed++;
        // Verificar advertencia de límite
        if (this.buffer.length >=
            this.options.maxSize * this.options.warningThreshold) {
            console.log("BUFFER", `LimitedBuffer[${this.id}] near limit: ${this.buffer.length}/${this.options.maxSize}`);
        }
        // Gestionar overflow según estrategia
        if (this.buffer.length >= this.options.maxSize) {
            return this.handleOverflow(item);
        }
        // Añadir normalmente
        this.buffer.push(item);
        this.stats.currentSize = this.buffer.length;
        return true;
    }
    /**
     * Manejar overflow según estrategia configurada
     */
    handleOverflow(newItem) {
        this.stats.overflowCount++;
        switch (this.options.onOverflow) {
            case "rotate":
                return this.handleRotateOverflow(newItem);
            case "reject":
                return this.handleRejectOverflow(newItem);
            case "compress":
                return this.handleCompressOverflow(newItem);
            default:
                console.error("BUFFER", `Unknown overflow strategy: ${this.options.onOverflow}`, new Error(`LimitedBuffer[${this.id}] invalid overflow strategy`));
                return false;
        }
    }
    /**
     * Rotar buffer: eliminar el más antiguo, añadir el nuevo
     */
    handleRotateOverflow(_newItem) {
        const removed = this.buffer.shift();
        if (removed !== undefined) {
            this.stats.totalRemoved++;
            this.options.onItemRemoved(removed);
        }
        this.buffer.push(_newItem);
        this.stats.currentSize = this.buffer.length;
        console.log("BUFFER", `LimitedBuffer[${this.id}] rotated: overflow=${this.stats.overflowCount}`);
        return true;
    }
    /**
     * Rechazar nuevo elemento cuando está lleno
     */
    handleRejectOverflow(_newItem) {
        console.log("BUFFER", `LimitedBuffer[${this.id}] rejected: overflow=${this.stats.overflowCount}`);
        return false;
    }
    /**
     * Comprimir buffer cuando está lleno
     */
    handleCompressOverflow(_newItem) {
        const targetSize = Math.floor(this.options.maxSize * this.options.compressionRatio);
        const itemsToRemove = this.buffer.length - targetSize;
        if (itemsToRemove > 0) {
            // Remover elementos del medio (conservar inicio y final)
            const removed = this.buffer.splice(Math.floor(targetSize / 2), itemsToRemove);
            removed.forEach((_item) => {
                this.stats.totalRemoved++;
                this.options.onItemRemoved(_item);
            });
            this.stats.compressionEvents++;
            console.log("BUFFER", `LimitedBuffer[${this.id}] compressed: removed=${itemsToRemove}`);
        }
        this.buffer.push(_newItem);
        this.stats.currentSize = this.buffer.length;
        return true;
    }
    /**
     * Obtener elemento por índice
     */
    get(_index) {
        this.stats.lastAccess = Date.now();
        return this.buffer[_index];
    }
    /**
     * Obtener todos los elementos
     */
    getAll() {
        this.stats.lastAccess = Date.now();
        return Object.freeze([...this.buffer]);
    }
    /**
     * Obtener los últimos N elementos
     */
    getLast(_count) {
        this.stats.lastAccess = Date.now();
        const start = Math.max(0, this.buffer.length - _count);
        return Object.freeze(this.buffer.slice(start));
    }
    /**
     * Obtener los primeros N elementos
     */
    getFirst(_count) {
        this.stats.lastAccess = Date.now();
        return Object.freeze(this.buffer.slice(0, _count));
    }
    /**
     * Buscar elementos que cumplan condición
     */
    find(_predicate) {
        this.stats.lastAccess = Date.now();
        return this.buffer.find(_predicate);
    }
    /**
     * Filtrar elementos que cumplan condición
     */
    filter(_predicate) {
        this.stats.lastAccess = Date.now();
        return Object.freeze(this.buffer.filter(_predicate));
    }
    /**
     * Mapear elementos
     */
    map(_mapper) {
        this.stats.lastAccess = Date.now();
        return this.buffer.map(_mapper);
    }
    /**
     * Limpiar buffer completamente
     */
    clear() {
        const removedCount = this.buffer.length;
        this.buffer.forEach((_item) => this.options.onItemRemoved(_item));
        this.buffer = [];
        this.stats.currentSize = 0;
        this.stats.totalRemoved += removedCount;
        this.stats.lastAccess = Date.now();
        console.log("BUFFER", `LimitedBuffer[${this.id}] cleared: removed=${removedCount}`);
    }
    /**
     * Remover elementos que cumplan condición
     */
    removeWhere(_predicate) {
        this.stats.lastAccess = Date.now();
        let removedCount = 0;
        for (let i = this.buffer.length - 1; i >= 0; i--) {
            if (_predicate(this.buffer[i], i)) {
                const removed = this.buffer.splice(i, 1)[0];
                this.options.onItemRemoved(removed);
                this.stats.totalRemoved++;
                removedCount++;
            }
        }
        this.stats.currentSize = this.buffer.length;
        if (removedCount > 0) {
            console.log("BUFFER", `LimitedBuffer[${this.id}] removed by condition: count=${removedCount}`);
        }
        return removedCount;
    }
    /**
     * Remover elementos más antiguos que cierto tiempo
     */
    removeOlderThan(_maxAge, _getTimestamp) {
        const cutoff = Date.now() - _maxAge;
        return this.removeWhere((_item) => _getTimestamp(_item) < cutoff);
    }
    /**
     * Obtener tamaño actual
     */
    size() {
        return this.buffer.length;
    }
    /**
     * Verificar si está vacío
     */
    isEmpty() {
        return this.buffer.length === 0;
    }
    /**
     * Verificar si está lleno
     */
    isFull() {
        return this.buffer.length >= this.options.maxSize;
    }
    /**
     * Obtener porcentaje de uso
     */
    getUsagePercentage() {
        return (this.buffer.length / this.options.maxSize) * 100;
    }
    /**
     * Obtener estadísticas del buffer
     */
    getStats() {
        return {
            ...this.stats,
            currentSize: this.buffer.length,
        };
    }
    /**
     * Redimensionar el buffer (cambiar límite máximo)
     */
    resize(newMaxSize) {
        const oldMaxSize = this.options.maxSize;
        this.options.maxSize = newMaxSize;
        this.stats.maxSize = newMaxSize;
        // Si el nuevo límite es menor, comprimir
        if (newMaxSize < this.buffer.length) {
            const itemsToRemove = this.buffer.length - newMaxSize;
            const removed = this.buffer.splice(newMaxSize);
            removed.forEach((_item) => {
                this.options.onItemRemoved(_item);
                this.stats.totalRemoved++;
            });
            console.log("BUFFER", `LimitedBuffer[${this.id}] resized: ${oldMaxSize}→${newMaxSize}, removed=${itemsToRemove}`);
        }
        else {
            console.log("BUFFER", `LimitedBuffer[${this.id}] resized: ${oldMaxSize}→${newMaxSize}`);
        }
        this.stats.currentSize = this.buffer.length;
    }
    /**
     * Obtener representación JSON para debugging
     */
    toJSON() {
        return {
            id: this.id,
            options: this.options,
            stats: this.getStats(),
            sampleItems: this.buffer.slice(0, 3), // Solo primeros 3 elementos para debugging
        };
    }
}
/**
 * Factory para crear buffers con configuraciones predefinidas
 */
export class BufferFactory {
    /**
     * Buffer para logs con rotación automática
     */
    static createLogBuffer(_id, _maxSize = 100) {
        return new LimitedBuffer(_id, {
            maxSize: _maxSize,
            onOverflow: "rotate",
            warningThreshold: 0.9,
            onItemRemoved: (_item) => {
                // Los logs removidos pueden ir a archivo si se necesita
            },
        });
    }
    /**
     * Buffer para eventos con compresión
     */
    static createEventBuffer(_id, _maxSize = 100) {
        return new LimitedBuffer(_id, {
            maxSize: _maxSize,
            onOverflow: "compress",
            compressionRatio: 0.6,
            warningThreshold: 0.85,
            onItemRemoved: (_item) => {
                // Events removed silently
            },
        });
    }
    /**
     * Buffer para cache con rechazo
     */
    static createCacheBuffer(_id, _maxSize = 200) {
        return new LimitedBuffer(_id, {
            maxSize: _maxSize,
            onOverflow: "reject",
            warningThreshold: 0.95,
            onItemRemoved: (_item) => {
                // Cache items removed silently
            },
        });
    }
    /**
     * Buffer para métricas con rotación
     */
    static createMetricsBuffer(_id, _maxSize = 10000) {
        return new LimitedBuffer(_id, {
            maxSize: _maxSize,
            onOverflow: "rotate",
            warningThreshold: 0.95,
            onItemRemoved: (_item) => {
                // Las métricas pueden ser agregadas antes de ser removidas
            },
        });
    }
}
export default LimitedBuffer;
//# sourceMappingURL=LimitedBuffer.js.map