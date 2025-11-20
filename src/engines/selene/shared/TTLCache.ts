/**
 * 🔧 TTL CACHE V194
 * Directiva V194: Cirugía del Panteón - Fix #3
 *
 * PROPÓSITO: Implementar cache con Time-To-Live automático
 * para prevenir acumulación infinita de datos en memoria
 */

// 🔇 PUNK FIX: Only log TTL operations if DEBUG_TTL=true

const DEBUG_TTL = process.env.DEBUG_TTL === "true";

export interface TTLCacheOptions {
  defaultTTL: number; // TTL por defecto en milisegundos
  maxSize?: number; // Tamaño máximo del cache (opcional)
  cleanupInterval?: number; // Intervalo de limpieza automática
  onExpire?: (key: string, value: any) => void; // Callback al expirar
  onEvict?: (key: string, value: any) => void; // Callback al ser expulsado
}

export interface CacheEntry<V> {
  value: V;
  expires: number;
  created: number;
  accessed: number;
  accessCount: number;
}

export interface CacheStats {
  size: number;
  maxSize: number | null;
  hits: number;
  misses: number;
  expires: number;
  evictions: number;
  hitRate: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

export class TTLCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private readonly options: Required<Omit<TTLCacheOptions, "maxSize">> & {
    maxSize: number | null;
  };
  private stats: Omit<
    CacheStats,
    "hitRate" | "size" | "oldestEntry" | "newestEntry"
  >;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly id: string;

  constructor(id: string, options: TTLCacheOptions) {
    this.id = id;
    this.options = {
      defaultTTL: options.defaultTTL,
      maxSize: options.maxSize || null,
      cleanupInterval: options.cleanupInterval || 60000, // 1 minuto por defecto
      onExpire: options.onExpire || (() => {}),
      onEvict: options.onEvict || (() => {}),
    };

    this.stats = {
      maxSize: this.options.maxSize,
      hits: 0,
      misses: 0,
      expires: 0,
      evictions: 0,
    };

    this.startCleanupTimer();

    if (DEBUG_TTL) {
      console.log(
        `💾 TTLCache[${this.id}]: Creado con TTL ${this.options.defaultTTL}ms, maxSize: ${this.options.maxSize || "unlimited"}`,
      );
    }
  }

  /**
   * Almacenar valor en cache con TTL específico o por defecto
   */
  set(key: K, _value: V, ttl?: number): void {
    const now = Date.now();
    const actualTTL = ttl !== undefined ? ttl : this.options.defaultTTL;
    const expires = now + actualTTL;

    // Si existe, limpiar entrada previa
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Verificar límite de tamaño
    if (
      this.options.maxSize !== null &&
      this.cache.size >= this.options.maxSize
    ) {
      this.evictOldestEntry();
    }

    const entry: CacheEntry<V> = {
      value: _value,
      expires,
      created: now,
      accessed: now,
      accessCount: 0,
    };

    this.cache.set(key, entry);

    if (DEBUG_TTL) {
      console.log(
        `💾 TTLCache[${this.id}]: Set ${String(key)} (expires in ${actualTTL}ms)`,
      );
    }
  }

  /**
   * Obtener valor del cache
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    const now = Date.now();

    // Verificar si ha expirado
    if (now >= entry.expires) {
      this.cache.delete(key);
      this.stats.expires++;
      this.options.onExpire(String(key), entry.value);
      this.stats.misses++;
      if (DEBUG_TTL) {
        console.log(`⏰ TTLCache[${this.id}]: ${String(key)} expiró`);
      }
      return undefined;
    }

    // Actualizar estadísticas de acceso
    entry.accessed = now;
    entry.accessCount++;
    this.stats.hits++;

    return entry.value;
  }

  /**
   * Verificar si existe una clave (sin afectar estadísticas de acceso)
   */
  has(key: K): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Verificar expiración sin actualizar accessed
    if (Date.now() >= entry.expires) {
      this.cache.delete(key);
      this.stats.expires++;
      this.options.onExpire(String(key), entry.value);
      return false;
    }

    return true;
  }

  /**
   * Eliminar entrada del cache
   */
  delete(key: K): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      if (DEBUG_TTL) {
        console.log(
          `🗑️ TTLCache[${this.id}]: ${String(key)} eliminado manualmente`,
        );
      }
      return true;
    }
    return false;
  }

  /**
   * Limpiar todo el cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    if (DEBUG_TTL) {
      console.log(
        `🧹 TTLCache[${this.id}]: Cache limpiado (${size} entradas removidas)`,
      );
    }
  }

  /**
   * Obtener todas las claves válidas (no expiradas)
   */
  keys(): K[] {
    this.cleanupExpired();
    return Array.from(this.cache.keys());
  }

  /**
   * Obtener todos los valores válidos (no expirados)
   */
  values(): V[] {
    this.cleanupExpired();
    return Array.from(this.cache.values()).map((_entry) => _entry.value);
  }

  /**
   * Obtener todas las entradas válidas como [key, value]
   */
  entries(): [K, V][] {
    this.cleanupExpired();
    return Array.from(this.cache.entries()).map(([key, entry]) => [
      key,
      entry.value,
    ]);
  }

  /**
   * Obtener el tamaño actual del cache (sin entradas expiradas)
   */
  size(): number {
    this.cleanupExpired();
    return this.cache.size;
  }

  /**
   * Verificar si el cache está vacío
   */
  isEmpty(): boolean {
    return this.size() === 0;
  }

  /**
   * Verificar si el cache está lleno
   */
  isFull(): boolean {
    if (this.options.maxSize === null) return false;
    return this.size() >= this.options.maxSize;
  }

  /**
   * Obtener tiempo restante hasta expiración (en ms)
   */
  getTTL(_key: K): number | null {
    const entry = this.cache.get(_key);
    if (!entry) return null;

    const remaining = entry.expires - Date.now();
    return remaining > 0 ? remaining : null;
  }

  /**
   * Renovar TTL de una entrada existente
   */
  refresh(key: K, ttl?: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now >= entry.expires) {
      this.cache.delete(key);
      this.stats.expires++;
      this.options.onExpire(String(key), entry.value);
      return false;
    }

    const actualTTL = ttl !== undefined ? ttl : this.options.defaultTTL;
    entry.expires = now + actualTTL;
    entry.accessed = now;

    if (DEBUG_TTL) {
      console.log(
        `🔄 TTLCache[${this.id}]: ${String(key)} TTL renovado (+${actualTTL}ms)`,
      );
    }
    return true;
  }

  /**
   * Obtener información detallada de una entrada
   */
  getEntryInfo(key: K): Omit<CacheEntry<V>, "value"> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now >= entry.expires) {
      this.cache.delete(key);
      this.stats.expires++;
      this.options.onExpire(String(key), entry.value);
      return null;
    }

    return {
      expires: entry.expires,
      created: entry.created,
      accessed: entry.accessed,
      accessCount: entry.accessCount,
    };
  }

  /**
   * Limpiar entradas expiradas
   */
  private cleanupExpired(): number {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now >= entry.expires) {
        this.cache.delete(key);
        this.stats.expires++;
        this.options.onExpire(String(key), entry.value);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      if (DEBUG_TTL) {
        console.log(
          `⏰ TTLCache[${this.id}]: ${expiredCount} entradas expiradas limpiadas`,
        );
      }
    }

    return expiredCount;
  }

  /**
   * Expulsar la entrada más antigua para hacer espacio
   */
  private evictOldestEntry(): void {
    if (this.cache.size === 0) return;

    let oldestKey: K | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (entry.created < oldestTime) {
        oldestTime = entry.created;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      const entry = this.cache.get(oldestKey)!;
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.options.onEvict(String(oldestKey), entry.value);
      if (DEBUG_TTL) {
        console.log(
          `🚪 TTLCache[${this.id}]: ${String(oldestKey)} expulsado por límite de tamaño`,
        );
      }
    }
  }

  /**
   * Iniciar timer de limpieza automática
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.options.cleanupInterval);
  }

  /**
   * Detener timer de limpieza
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Obtener estadísticas del cache
   */
  getStats(): CacheStats {
    this.cleanupExpired();

    let oldestEntry: number | null = null;
    let newestEntry: number | null = null;

    for (const entry of Array.from(this.cache.values())) {
      if (oldestEntry === null || entry.created < oldestEntry) {
        oldestEntry = entry.created;
      }
      if (newestEntry === null || entry.created > newestEntry) {
        newestEntry = entry.created;
      }
    }

    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate =
      totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      expires: this.stats.expires,
      evictions: this.stats.evictions,
      hitRate: Math.round(hitRate * 100) / 100,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Resetear estadísticas
   */
  resetStats(): void {
    this.stats = {
      maxSize: this.options.maxSize,
      hits: 0,
      misses: 0,
      expires: 0,
      evictions: 0,
    };
    if (DEBUG_TTL) {
      console.log(`📊 TTLCache[${this.id}]: Estadísticas reseteadas`);
    }
  }

  /**
   * Obtener entradas próximas a expirar
   */
  getExpiringEntries(_withinMs: number): [K, V, number][] {
    const now = Date.now();
    const threshold = now + _withinMs;
    const expiring: [K, V, number][] = [];

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (entry.expires <= threshold && entry.expires > now) {
        const timeLeft = entry.expires - now;
        expiring.push([key, entry.value, timeLeft]);
      }
    }

    return expiring.sort((_a, _b) => _a[2] - _b[2]); // Ordenar por tiempo restante
  }

  /**
   * Extender TTL de entradas que están por expirar
   */
  extendExpiringEntries(_withinMs: number, extensionMs: number): number {
    const expiring = this.getExpiringEntries(_withinMs);

    for (const [key] of expiring) {
      this.refresh(key, extensionMs);
    }

    if (expiring.length > 0) {
      if (DEBUG_TTL) {
        console.log(
          `🔄 TTLCache[${this.id}]: ${expiring.length} entradas extendidas (+${extensionMs}ms)`,
        );
      }
    }

    return expiring.length;
  }

  /**
   * Cerrar cache y limpiar recursos
   */
  close(): void {
    this.stopCleanupTimer();
    this.clear();
    if (DEBUG_TTL) {
      console.log(`🔒 TTLCache[${this.id}]: Cache cerrado`);
    }
  }

  /**
   * Representación JSON para debugging
   */
  toJSON(): any {
    return {
      id: this.id,
      options: this.options,
      stats: this.getStats(),
      sampleEntries: Array.from(this.cache.entries())
        .slice(0, 3)
        .map(([key, entry]) => ({
          key: String(key),
          created: new Date(entry.created).toISOString(),
          expires: new Date(entry.expires).toISOString(),
          accessCount: entry.accessCount,
        })),
    };
  }
}

/**
 * Factory para crear caches TTL con configuraciones predefinidas
 */
export class TTLCacheFactory {
  /**
   * Cache rápido para datos temporales (1 segundo)
   */
  static createFastCache<K, V>(_id: string): TTLCache<K, V> {
    return new TTLCache<K, V>(_id, {
      defaultTTL: 1000, // 1 segundo
      maxSize: 1000,
      cleanupInterval: 60 * 1000, // 1 minuto
    });
  }

  /**
   * Cache de sesión para datos de usuario (30 minutos)
   */
  static createSessionCache<K, V>(_id: string): TTLCache<K, V> {
    return new TTLCache<K, V>(_id, {
      defaultTTL: 30 * 60 * 1000, // 30 minutos
      maxSize: 500,
      cleanupInterval: 5 * 60 * 1000, // 5 minutos
    });
  }

  /**
   * Cache de larga duración para datos estáticos (2 horas)
   */
  static createLongCache<K, V>(_id: string): TTLCache<K, V> {
    return new TTLCache<K, V>(_id, {
      defaultTTL: 2 * 60 * 60 * 1000, // 2 horas
      maxSize: 2000,
      cleanupInterval: 10 * 60 * 1000, // 10 minutos
    });
  }

  /**
   * Cache sin límite de tamaño para casos especiales
   */
  static createUnlimitedCache<K, V>(_id: string, ttlMs: number): TTLCache<K, V> {
    return new TTLCache<K, V>(_id, {
      defaultTTL: ttlMs,
      cleanupInterval: Math.min(ttlMs / 10, 60 * 1000), // 10% del TTL o máximo 1 minuto
    });
  }
}

export default TTLCache;


