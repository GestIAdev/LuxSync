# 🧠 BLUEPRINT: MEMORIA INMORTAL DE SELENE LUX

## 📋 Resumen Ejecutivo

| Aspecto | Decisión |
|---------|----------|
| **Plataforma** | Electron (Windows principalmente, Linux compatible) |
| **Tipo** | App de escritorio (NO web, NO cluster) |
| **Recomendación** | 🏆 **SQLite + better-sqlite3** |
| **Alternativa** | JSON files (electron-store) |
| **Descartado** | Redis, MongoDB, PostgreSQL |

---

## 🎯 El Problema

Selene Lux necesita **memoria persistente** que sobreviva:
- ✅ Reinicios de la aplicación
- ✅ Actualizaciones del software
- ✅ Crasheos inesperados
- ✅ Cambios de versión

### ¿Qué debe recordar Selene?

| Categoría | Ejemplos | Frecuencia Escritura | Tamaño Estimado |
|-----------|----------|---------------------|-----------------|
| **Patrones aprendidos** | "Drop en A minor → complementarios funcionó" | ~100/sesión | ~50KB/mes |
| **Preferencias usuario** | "Le gusta strobe suave en cumbia" | ~10/sesión | ~5KB total |
| **Estadísticas sesión** | Duración, géneros, beautyScore promedio | 1/sesión | ~1KB/sesión |
| **Calibración fixtures** | Offsets DMX, curvas de dimmer | Raro | ~10KB total |
| **Historial paletas** | Últimas 1000 paletas generadas | ~500/sesión | ~500KB/mes |

**Volumen estimado:** ~5-10MB/mes de uso intensivo

---

## 🥊 COMPARATIVA: SQLite vs JSON Files

### Caso de Uso: "Dame los patrones exitosos de reggaeton del último mes"

#### 📁 Con JSON Files (electron-store)

```typescript
// ❌ INEFICIENTE - Hay que cargar TODO en memoria
const store = new Store();
const allPatterns = store.get('patterns'); // Array de 10,000 items
const reggaetonPatterns = allPatterns
  .filter(p => p.genre === 'reggaeton')
  .filter(p => p.timestamp > oneMonthAgo)
  .filter(p => p.beautyScore > 0.8)
  .sort((a, b) => b.beautyScore - a.beautyScore)
  .slice(0, 10);

// Problemas:
// 1. Carga 10MB en RAM para filtrar 10 items
// 2. O(n) en cada filtro
// 3. Sin índices
// 4. Archivo crece infinitamente
// 5. Riesgo de corrupción si crashea durante escritura
```

#### 🗄️ Con SQLite (better-sqlite3)

```typescript
// ✅ EFICIENTE - Query optimizado con índices
const patterns = db.prepare(`
  SELECT * FROM patterns 
  WHERE genre = ? 
    AND timestamp > ? 
    AND beauty_score > 0.8
  ORDER BY beauty_score DESC
  LIMIT 10
`).all('reggaeton', oneMonthAgo);

// Ventajas:
// 1. Solo lee los 10 registros necesarios
// 2. Usa índice en (genre, timestamp)
// 3. ~0.5ms vs ~50ms del JSON
// 4. ACID: Si crashea, no se corrompe
// 5. VACUUM automático mantiene tamaño óptimo
```

---

## 📊 Benchmark Teórico

| Operación | JSON (10K records) | SQLite (10K records) | Ganador |
|-----------|-------------------|---------------------|---------|
| Buscar por género | ~45ms | ~0.3ms | 🏆 SQLite (150x) |
| Insertar 1 registro | ~120ms* | ~0.1ms | 🏆 SQLite (1200x) |
| Buscar por rango fecha | ~60ms | ~0.5ms | 🏆 SQLite (120x) |
| Tamaño en disco | ~15MB | ~8MB | 🏆 SQLite (50%) |
| Startup (cargar todo) | ~200ms | 0ms** | 🏆 SQLite |

*JSON debe reescribir todo el archivo  
**SQLite no carga nada al iniciar, queries on-demand

---

## 🏗️ Arquitectura Propuesta

### Estructura de Directorios

```
%APPDATA%/LuxSync/              (Windows)
~/.config/LuxSync/              (Linux)
├── selene-memory.db            # Base de datos SQLite
├── selene-memory.db-wal        # Write-Ahead Log (auto)
├── selene-memory.db-shm        # Shared memory (auto)
├── config.json                 # Solo config simple (electron-store)
└── backups/
    ├── selene-memory-2025-12-01.db
    └── selene-memory-2025-11-01.db
```

### Schema de Base de Datos

```sql
-- ═══════════════════════════════════════════════════════════════
-- 🎨 PALETAS GENERADAS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE palettes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,           -- Unix timestamp
  session_id TEXT NOT NULL,             -- UUID de sesión
  
  -- ADN Musical
  key TEXT,                             -- 'C', 'A', 'F#', etc.
  mode TEXT,                            -- 'major', 'minor', etc.
  energy REAL,                          -- 0.0 - 1.0
  genre TEXT,                           -- 'reggaeton', 'cumbia', etc.
  section TEXT,                         -- 'drop', 'verse', 'chorus'
  
  -- Paleta generada (HSL serializado)
  primary_h REAL,
  primary_s REAL,
  primary_l REAL,
  secondary_h REAL,
  secondary_s REAL,
  secondary_l REAL,
  accent_h REAL,
  accent_s REAL,
  accent_l REAL,
  
  -- Métricas
  color_strategy TEXT,                  -- 'complementary', 'triadic', 'analogous'
  beauty_score REAL,                    -- Calculado post-aplicación
  user_feedback INTEGER DEFAULT 0,      -- -1, 0, +1
  
  -- Índices para queries rápidas
  UNIQUE(timestamp, session_id)
);

CREATE INDEX idx_palettes_genre ON palettes(genre);
CREATE INDEX idx_palettes_key ON palettes(key);
CREATE INDEX idx_palettes_timestamp ON palettes(timestamp);
CREATE INDEX idx_palettes_beauty ON palettes(beauty_score);
CREATE INDEX idx_palettes_session ON palettes(session_id);

-- ═══════════════════════════════════════════════════════════════
-- 🎯 PATRONES APRENDIDOS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  -- Identificador del patrón
  pattern_hash TEXT UNIQUE NOT NULL,    -- Hash de (genre+key+mode+section)
  
  -- Contexto musical
  genre TEXT NOT NULL,
  key TEXT,
  mode TEXT,
  section TEXT,
  energy_range_min REAL,
  energy_range_max REAL,
  
  -- Configuración de iluminación aprendida
  preferred_strategy TEXT,              -- 'complementary', etc.
  preferred_intensity REAL,
  preferred_movement TEXT,              -- 'circular', 'figure8', etc.
  strobe_on_beat INTEGER DEFAULT 1,     -- Boolean
  
  -- Métricas de éxito
  times_used INTEGER DEFAULT 0,
  total_beauty_score REAL DEFAULT 0,
  avg_beauty_score REAL GENERATED ALWAYS AS (
    CASE WHEN times_used > 0 THEN total_beauty_score / times_used ELSE 0 END
  ) STORED,
  positive_feedback INTEGER DEFAULT 0,
  negative_feedback INTEGER DEFAULT 0,
  
  -- Tendencia
  beauty_trend TEXT DEFAULT 'stable',   -- 'rising', 'falling', 'stable'
  last_10_scores TEXT                   -- JSON array de últimos 10
);

CREATE INDEX idx_patterns_genre ON patterns(genre);
CREATE INDEX idx_patterns_beauty ON patterns(avg_beauty_score);
CREATE INDEX idx_patterns_hash ON patterns(pattern_hash);

-- ═══════════════════════════════════════════════════════════════
-- 📊 SESIONES
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                  -- UUID
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_seconds INTEGER,
  
  -- Estadísticas
  total_frames INTEGER DEFAULT 0,
  avg_beauty_score REAL,
  dominant_genre TEXT,
  dominant_mood TEXT,
  
  -- Géneros detectados (JSON)
  genre_distribution TEXT,              -- {"reggaeton": 45, "cumbia": 30, ...}
  
  -- Preferencias detectadas
  preferred_intensity REAL,
  preferred_color_temp TEXT,            -- 'warm', 'cool', 'neutral'
  
  -- Notas del usuario (opcional)
  user_notes TEXT
);

CREATE INDEX idx_sessions_date ON sessions(started_at);

-- ═══════════════════════════════════════════════════════════════
-- ⚙️ PREFERENCIAS DEL USUARIO
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,                  -- JSON para flexibilidad
  updated_at INTEGER NOT NULL
);

-- Preferencias iniciales
INSERT INTO preferences (key, value, updated_at) VALUES
  ('strobe_max_intensity', '0.8', strftime('%s', 'now')),
  ('color_saturation_boost', '1.0', strftime('%s', 'now')),
  ('movement_speed_multiplier', '1.0', strftime('%s', 'now')),
  ('auto_blackout_on_silence', 'true', strftime('%s', 'now')),
  ('favorite_genres', '["reggaeton", "cumbia"]', strftime('%s', 'now'));

-- ═══════════════════════════════════════════════════════════════
-- 🔮 SUEÑOS DE SELENE (Simulaciones guardadas)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE dreams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  
  -- Tipo de sueño
  dream_type TEXT NOT NULL,             -- 'intensity', 'palette', 'movement'
  
  -- Contexto del sueño
  context_json TEXT NOT NULL,           -- Estado completo serializado
  
  -- Resultado
  projected_beauty REAL,
  was_accepted INTEGER,                 -- Boolean
  reason TEXT,                          -- Por qué se aceptó/rechazó
  
  -- Alternativas generadas
  alternatives_json TEXT                -- Array de alternativas
);

CREATE INDEX idx_dreams_type ON dreams(dream_type);
CREATE INDEX idx_dreams_accepted ON dreams(was_accepted);

-- ═══════════════════════════════════════════════════════════════
-- 🔧 CALIBRACIÓN DE FIXTURES
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE fixture_calibration (
  fixture_id TEXT PRIMARY KEY,          -- ID único del fixture
  fixture_type TEXT NOT NULL,           -- 'par', 'moving_head', etc.
  
  -- Offsets
  pan_offset INTEGER DEFAULT 0,
  tilt_offset INTEGER DEFAULT 0,
  dimmer_curve TEXT DEFAULT 'linear',   -- 'linear', 'square', 'log'
  color_correction_json TEXT,           -- {"r": 1.0, "g": 0.95, "b": 1.05}
  
  -- Límites
  max_intensity REAL DEFAULT 1.0,
  min_intensity REAL DEFAULT 0.0,
  
  updated_at INTEGER NOT NULL
);
```

---

## 🔧 Implementación: SeleneMemoryManager

### Archivo: `learning/SeleneMemoryManager.ts`

```typescript
/**
 * SeleneMemoryManager - Memoria Inmortal de Selene Lux
 * 
 * Responsabilidades:
 * - Persistir patrones aprendidos
 * - Guardar historial de paletas
 * - Gestionar preferencias del usuario
 * - Mantener estadísticas de sesiones
 * - Backup automático
 * 
 * Tecnología: SQLite via better-sqlite3
 * 
 * @example
 * const memory = new SeleneMemoryManager();
 * 
 * // Guardar paleta generada
 * memory.savePalette(palette, context);
 * 
 * // Buscar patrones exitosos
 * const patterns = memory.findSuccessfulPatterns('reggaeton', { minBeauty: 0.8 });
 * 
 * // Obtener preferencia
 * const strobeMax = memory.getPreference('strobe_max_intensity');
 */

import Database from 'better-sqlite3';
import { app } from 'electron';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

// Tipos
interface PaletteRecord {
  timestamp: number;
  sessionId: string;
  key: string | null;
  mode: string | null;
  energy: number;
  genre: string | null;
  section: string | null;
  primary: { h: number; s: number; l: number };
  secondary: { h: number; s: number; l: number };
  accent: { h: number; s: number; l: number };
  colorStrategy: string;
  beautyScore?: number;
}

interface PatternRecord {
  genre: string;
  key: string | null;
  mode: string | null;
  section: string | null;
  energyRange: { min: number; max: number };
  preferredStrategy: string;
  preferredIntensity: number;
  preferredMovement: string;
  avgBeautyScore: number;
  timesUsed: number;
}

interface SessionStats {
  totalFrames: number;
  avgBeautyScore: number;
  dominantGenre: string;
  genreDistribution: Record<string, number>;
}

export class SeleneMemoryManager extends EventEmitter {
  private db: Database.Database;
  private currentSessionId: string;
  private dbPath: string;

  // Configuración
  private static readonly MAX_PALETTE_HISTORY = 10000;
  private static readonly BACKUP_INTERVAL_DAYS = 7;
  private static readonly WAL_CHECKPOINT_PAGES = 1000;

  constructor() {
    super();
    this.dbPath = this.getDbPath();
    this.ensureDirectoryExists();
    this.db = new Database(this.dbPath);
    this.currentSessionId = this.generateSessionId();
    
    this.initializeDatabase();
    this.startSession();
    
    console.log(`🧠 [MEMORY] Selene Memory initialized at ${this.dbPath}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // INICIALIZACIÓN
  // ═══════════════════════════════════════════════════════════════

  private getDbPath(): string {
    const userDataPath = app?.getPath?.('userData') || 
      process.env.APPDATA || 
      path.join(process.env.HOME || '', '.config');
    return path.join(userDataPath, 'LuxSync', 'selene-memory.db');
  }

  private ensureDirectoryExists(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private initializeDatabase(): void {
    // Habilitar WAL mode para mejor performance y durabilidad
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000'); // 64MB cache
    this.db.pragma('temp_store = MEMORY');
    
    // Crear tablas si no existen
    this.db.exec(SCHEMA_SQL); // El SQL definido arriba
    
    // Verificar integridad
    const integrity = this.db.pragma('integrity_check');
    if (integrity[0].integrity_check !== 'ok') {
      console.error('🚨 [MEMORY] Database integrity check failed!');
      this.emit('integrity-error', integrity);
    }
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // PALETAS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Guarda una paleta generada con su contexto musical
   */
  savePalette(palette: PaletteRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO palettes (
        timestamp, session_id, key, mode, energy, genre, section,
        primary_h, primary_s, primary_l,
        secondary_h, secondary_s, secondary_l,
        accent_h, accent_s, accent_l,
        color_strategy, beauty_score
      ) VALUES (
        @timestamp, @sessionId, @key, @mode, @energy, @genre, @section,
        @primaryH, @primaryS, @primaryL,
        @secondaryH, @secondaryS, @secondaryL,
        @accentH, @accentS, @accentL,
        @colorStrategy, @beautyScore
      )
    `);

    stmt.run({
      timestamp: palette.timestamp || Date.now(),
      sessionId: palette.sessionId || this.currentSessionId,
      key: palette.key,
      mode: palette.mode,
      energy: palette.energy,
      genre: palette.genre,
      section: palette.section,
      primaryH: palette.primary.h,
      primaryS: palette.primary.s,
      primaryL: palette.primary.l,
      secondaryH: palette.secondary.h,
      secondaryS: palette.secondary.s,
      secondaryL: palette.secondary.l,
      accentH: palette.accent.h,
      accentS: palette.accent.s,
      accentL: palette.accent.l,
      colorStrategy: palette.colorStrategy,
      beautyScore: palette.beautyScore || null,
    });

    this.emit('palette-saved', palette);
  }

  /**
   * Obtiene paletas históricas con filtros
   */
  getPalettes(filters: {
    genre?: string;
    key?: string;
    minBeauty?: number;
    since?: number;
    limit?: number;
  } = {}): PaletteRecord[] {
    let query = 'SELECT * FROM palettes WHERE 1=1';
    const params: Record<string, unknown> = {};

    if (filters.genre) {
      query += ' AND genre = @genre';
      params.genre = filters.genre;
    }
    if (filters.key) {
      query += ' AND key = @key';
      params.key = filters.key;
    }
    if (filters.minBeauty) {
      query += ' AND beauty_score >= @minBeauty';
      params.minBeauty = filters.minBeauty;
    }
    if (filters.since) {
      query += ' AND timestamp >= @since';
      params.since = filters.since;
    }

    query += ' ORDER BY timestamp DESC';
    
    if (filters.limit) {
      query += ' LIMIT @limit';
      params.limit = filters.limit;
    }

    return this.db.prepare(query).all(params) as PaletteRecord[];
  }

  // ═══════════════════════════════════════════════════════════════
  // PATRONES APRENDIDOS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Actualiza o crea un patrón aprendido
   */
  learnPattern(context: {
    genre: string;
    key?: string;
    mode?: string;
    section?: string;
    energy: number;
  }, result: {
    strategy: string;
    intensity: number;
    movement: string;
    beautyScore: number;
  }): void {
    const hash = this.generatePatternHash(context);
    
    const existing = this.db.prepare(
      'SELECT * FROM patterns WHERE pattern_hash = ?'
    ).get(hash);

    if (existing) {
      // Actualizar patrón existente
      const last10 = JSON.parse(existing.last_10_scores || '[]');
      last10.push(result.beautyScore);
      if (last10.length > 10) last10.shift();

      const trend = this.calculateTrend(last10);

      this.db.prepare(`
        UPDATE patterns SET
          updated_at = @now,
          times_used = times_used + 1,
          total_beauty_score = total_beauty_score + @beautyScore,
          last_10_scores = @last10,
          beauty_trend = @trend,
          preferred_strategy = CASE 
            WHEN @beautyScore > avg_beauty_score THEN @strategy 
            ELSE preferred_strategy 
          END,
          preferred_intensity = CASE 
            WHEN @beautyScore > avg_beauty_score THEN @intensity 
            ELSE preferred_intensity 
          END,
          preferred_movement = CASE 
            WHEN @beautyScore > avg_beauty_score THEN @movement 
            ELSE preferred_movement 
          END
        WHERE pattern_hash = @hash
      `).run({
        now: Date.now(),
        beautyScore: result.beautyScore,
        last10: JSON.stringify(last10),
        trend,
        strategy: result.strategy,
        intensity: result.intensity,
        movement: result.movement,
        hash,
      });
    } else {
      // Crear nuevo patrón
      this.db.prepare(`
        INSERT INTO patterns (
          created_at, updated_at, pattern_hash,
          genre, key, mode, section,
          energy_range_min, energy_range_max,
          preferred_strategy, preferred_intensity, preferred_movement,
          times_used, total_beauty_score, last_10_scores, beauty_trend
        ) VALUES (
          @now, @now, @hash,
          @genre, @key, @mode, @section,
          @energyMin, @energyMax,
          @strategy, @intensity, @movement,
          1, @beautyScore, @last10, 'stable'
        )
      `).run({
        now: Date.now(),
        hash,
        genre: context.genre,
        key: context.key || null,
        mode: context.mode || null,
        section: context.section || null,
        energyMin: Math.max(0, context.energy - 0.1),
        energyMax: Math.min(1, context.energy + 0.1),
        strategy: result.strategy,
        intensity: result.intensity,
        movement: result.movement,
        beautyScore: result.beautyScore,
        last10: JSON.stringify([result.beautyScore]),
      });
    }

    this.emit('pattern-learned', { context, result });
  }

  /**
   * Busca patrones exitosos para un contexto dado
   */
  findSuccessfulPatterns(genre: string, options: {
    key?: string;
    mode?: string;
    section?: string;
    minBeauty?: number;
    limit?: number;
  } = {}): PatternRecord[] {
    let query = `
      SELECT * FROM patterns 
      WHERE genre = @genre 
        AND avg_beauty_score >= @minBeauty
    `;
    const params: Record<string, unknown> = {
      genre,
      minBeauty: options.minBeauty || 0.7,
    };

    if (options.key) {
      query += ' AND (key = @key OR key IS NULL)';
      params.key = options.key;
    }
    if (options.mode) {
      query += ' AND (mode = @mode OR mode IS NULL)';
      params.mode = options.mode;
    }
    if (options.section) {
      query += ' AND (section = @section OR section IS NULL)';
      params.section = options.section;
    }

    query += ' ORDER BY avg_beauty_score DESC, times_used DESC';
    
    if (options.limit) {
      query += ' LIMIT @limit';
      params.limit = options.limit;
    }

    return this.db.prepare(query).all(params) as PatternRecord[];
  }

  /**
   * Obtiene el mejor patrón para un contexto específico
   */
  getBestPattern(context: {
    genre: string;
    key?: string;
    mode?: string;
    section?: string;
  }): PatternRecord | null {
    const patterns = this.findSuccessfulPatterns(context.genre, {
      ...context,
      limit: 1,
    });
    return patterns[0] || null;
  }

  // ═══════════════════════════════════════════════════════════════
  // PREFERENCIAS
  // ═══════════════════════════════════════════════════════════════

  getPreference<T>(key: string, defaultValue?: T): T {
    const row = this.db.prepare(
      'SELECT value FROM preferences WHERE key = ?'
    ).get(key) as { value: string } | undefined;

    if (!row) return defaultValue as T;

    try {
      return JSON.parse(row.value) as T;
    } catch {
      return row.value as unknown as T;
    }
  }

  setPreference(key: string, value: unknown): void {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    
    this.db.prepare(`
      INSERT INTO preferences (key, value, updated_at)
      VALUES (@key, @value, @now)
      ON CONFLICT(key) DO UPDATE SET
        value = @value,
        updated_at = @now
    `).run({
      key,
      value: serialized,
      now: Date.now(),
    });

    this.emit('preference-changed', { key, value });
  }

  // ═══════════════════════════════════════════════════════════════
  // SESIONES
  // ═══════════════════════════════════════════════════════════════

  private startSession(): void {
    this.db.prepare(`
      INSERT INTO sessions (id, started_at)
      VALUES (@id, @now)
    `).run({
      id: this.currentSessionId,
      now: Date.now(),
    });

    this.emit('session-started', this.currentSessionId);
  }

  endSession(stats: SessionStats): void {
    this.db.prepare(`
      UPDATE sessions SET
        ended_at = @now,
        duration_seconds = (@now - started_at) / 1000,
        total_frames = @totalFrames,
        avg_beauty_score = @avgBeauty,
        dominant_genre = @dominantGenre,
        genre_distribution = @genreDistribution
      WHERE id = @id
    `).run({
      now: Date.now(),
      totalFrames: stats.totalFrames,
      avgBeauty: stats.avgBeautyScore,
      dominantGenre: stats.dominantGenre,
      genreDistribution: JSON.stringify(stats.genreDistribution),
      id: this.currentSessionId,
    });

    this.emit('session-ended', { id: this.currentSessionId, stats });
  }

  getSessionHistory(limit = 30): Array<{
    id: string;
    startedAt: number;
    durationSeconds: number;
    avgBeautyScore: number;
    dominantGenre: string;
  }> {
    return this.db.prepare(`
      SELECT 
        id, started_at as startedAt, duration_seconds as durationSeconds,
        avg_beauty_score as avgBeautyScore, dominant_genre as dominantGenre
      FROM sessions 
      WHERE ended_at IS NOT NULL
      ORDER BY started_at DESC
      LIMIT ?
    `).all(limit) as Array<{
      id: string;
      startedAt: number;
      durationSeconds: number;
      avgBeautyScore: number;
      dominantGenre: string;
    }>;
  }

  // ═══════════════════════════════════════════════════════════════
  // INSIGHTS Y ESTADÍSTICAS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Obtiene insights para un género específico
   */
  getGenreInsights(genre: string): {
    avgBeautyScore: number;
    totalSessions: number;
    totalPalettes: number;
    preferredKeys: string[];
    preferredModes: string[];
    bestTimeOfDay: string;
    avgSessionLength: number;
  } {
    const stats = this.db.prepare(`
      SELECT 
        AVG(beauty_score) as avgBeauty,
        COUNT(*) as totalPalettes,
        COUNT(DISTINCT session_id) as totalSessions
      FROM palettes
      WHERE genre = ?
    `).get(genre) as { avgBeauty: number; totalPalettes: number; totalSessions: number };

    const topKeys = this.db.prepare(`
      SELECT key, COUNT(*) as count
      FROM palettes
      WHERE genre = ? AND key IS NOT NULL AND beauty_score > 0.7
      GROUP BY key
      ORDER BY count DESC
      LIMIT 3
    `).all(genre) as Array<{ key: string; count: number }>;

    const topModes = this.db.prepare(`
      SELECT mode, COUNT(*) as count
      FROM palettes
      WHERE genre = ? AND mode IS NOT NULL AND beauty_score > 0.7
      GROUP BY mode
      ORDER BY count DESC
      LIMIT 3
    `).all(genre) as Array<{ mode: string; count: number }>;

    // Análisis por hora del día
    const hourStats = this.db.prepare(`
      SELECT 
        CAST(strftime('%H', datetime(timestamp/1000, 'unixepoch')) AS INTEGER) as hour,
        AVG(beauty_score) as avgBeauty
      FROM palettes
      WHERE genre = ?
      GROUP BY hour
      ORDER BY avgBeauty DESC
      LIMIT 1
    `).get(genre) as { hour: number; avgBeauty: number } | undefined;

    const avgDuration = this.db.prepare(`
      SELECT AVG(duration_seconds) as avg
      FROM sessions
      WHERE dominant_genre = ?
    `).get(genre) as { avg: number } | undefined;

    return {
      avgBeautyScore: stats?.avgBeauty || 0,
      totalSessions: stats?.totalSessions || 0,
      totalPalettes: stats?.totalPalettes || 0,
      preferredKeys: topKeys.map(k => k.key),
      preferredModes: topModes.map(m => m.mode),
      bestTimeOfDay: hourStats ? this.hourToTimeOfDay(hourStats.hour) : 'unknown',
      avgSessionLength: avgDuration?.avg || 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // MANTENIMIENTO
  // ═══════════════════════════════════════════════════════════════

  /**
   * Limpia registros antiguos para mantener la base de datos optimizada
   */
  cleanup(): void {
    const threeMonthsAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
    
    // Eliminar paletas antiguas (mantener las mejores)
    this.db.prepare(`
      DELETE FROM palettes 
      WHERE timestamp < ? 
        AND beauty_score < 0.8
        AND id NOT IN (
          SELECT id FROM palettes ORDER BY beauty_score DESC LIMIT 1000
        )
    `).run(threeMonthsAgo);

    // Eliminar sueños antiguos
    this.db.prepare(`
      DELETE FROM dreams WHERE timestamp < ?
    `).run(threeMonthsAgo);

    // Optimizar base de datos
    this.db.exec('VACUUM');
    this.db.pragma('wal_checkpoint(TRUNCATE)');

    console.log('🧹 [MEMORY] Cleanup completed');
    this.emit('cleanup-completed');
  }

  /**
   * Crea un backup de la base de datos
   */
  backup(): string {
    const backupDir = path.join(path.dirname(this.dbPath), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupPath = path.join(
      backupDir,
      `selene-memory-${new Date().toISOString().split('T')[0]}.db`
    );

    this.db.exec(`VACUUM INTO '${backupPath}'`);
    
    console.log(`💾 [MEMORY] Backup created at ${backupPath}`);
    this.emit('backup-created', backupPath);
    
    return backupPath;
  }

  /**
   * Obtiene estadísticas de la base de datos
   */
  getStats(): {
    totalPalettes: number;
    totalPatterns: number;
    totalSessions: number;
    dbSizeBytes: number;
    oldestRecord: number;
  } {
    const palettes = this.db.prepare('SELECT COUNT(*) as count FROM palettes').get() as { count: number };
    const patterns = this.db.prepare('SELECT COUNT(*) as count FROM patterns').get() as { count: number };
    const sessions = this.db.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number };
    const oldest = this.db.prepare('SELECT MIN(timestamp) as oldest FROM palettes').get() as { oldest: number };

    const stats = fs.statSync(this.dbPath);

    return {
      totalPalettes: palettes.count,
      totalPatterns: patterns.count,
      totalSessions: sessions.count,
      dbSizeBytes: stats.size,
      oldestRecord: oldest.oldest || Date.now(),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS PRIVADOS
  // ═══════════════════════════════════════════════════════════════

  private generatePatternHash(context: {
    genre: string;
    key?: string;
    mode?: string;
    section?: string;
  }): string {
    return `${context.genre}-${context.key || 'any'}-${context.mode || 'any'}-${context.section || 'any'}`;
  }

  private calculateTrend(scores: number[]): 'rising' | 'falling' | 'stable' {
    if (scores.length < 3) return 'stable';
    
    const recent = scores.slice(-3);
    const older = scores.slice(0, -3);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.length > 0 
      ? older.reduce((a, b) => a + b, 0) / older.length 
      : recentAvg;
    
    const diff = recentAvg - olderAvg;
    
    if (diff > 0.1) return 'rising';
    if (diff < -0.1) return 'falling';
    return 'stable';
  }

  private hourToTimeOfDay(hour: number): string {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  // ═══════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════

  close(): void {
    this.db.close();
    console.log('🧠 [MEMORY] Database connection closed');
  }
}

// Singleton para uso global
let memoryInstance: SeleneMemoryManager | null = null;

export function getSeleneMemory(): SeleneMemoryManager {
  if (!memoryInstance) {
    memoryInstance = new SeleneMemoryManager();
  }
  return memoryInstance;
}

export function closeSeleneMemory(): void {
  if (memoryInstance) {
    memoryInstance.close();
    memoryInstance = null;
  }
}
```

---

## ⚖️ Argumentos para el Arquitecto

### "Pero JSON es más simple..."

| Argumento JSON | Contraargumento SQLite |
|----------------|----------------------|
| "Solo necesito guardar y leer" | Ahora sí, pero ¿y las queries complejas que vendrán? |
| "Es más fácil de debuggear" | SQLite tiene CLI: `sqlite3 selene-memory.db ".dump"` |
| "Menor curva de aprendizaje" | better-sqlite3 tiene API simple, casi igual a JSON |
| "Menos dependencias" | 1 dependencia vs potenciales bugs de corrupción |
| "Portable" | SQLite es UN archivo, igual de portable |

### "Redis funciona genial en Selene Dental..."

| Contexto | Selene Dental | Selene Lux |
|----------|---------------|------------|
| Tipo | App Web | App Desktop |
| Arquitectura | Cluster PM2 | Single process |
| Usuarios | Múltiples concurrentes | 1 usuario |
| Servidor | Siempre corriendo | Inicia/cierra con app |
| Persistencia | Redis + disco | Solo disco |
| Instalación | `docker-compose up` | Doble-click .exe |

**Redis requiere un servidor separado** → No es viable para distribución desktop

### El Factor "DJ a las 3AM"

```
Escenario: El DJ cierra la laptop sin avisar (se acabó la fiesta)

Con JSON:
- Última escritura quedó a medias
- Archivo corrupto
- Se pierde TODO el historial
- DJ enojado 😤

Con SQLite:
- WAL garantiza escritura atómica
- Se pierde máximo últimos ~100ms
- El resto del historial intacto
- DJ feliz 🎉
```

---

## 🎯 Propuesta de Implementación

### Fase 6 Actualizada

```markdown
## 📚 FASE 6: MEMORIA INMORTAL (SQLite)
**Tiempo estimado:** 3-4 horas  
**Reemplaza:** PatternLearner + GenrePatternLibrary

### Checklist
- [ ] **6.1** Instalar dependencias
  ```bash
  cd electron-app
  npm install better-sqlite3
  npm install -D @types/better-sqlite3
  ```

- [ ] **6.2** Crear `learning/SeleneMemoryManager.ts` (~600 líneas)
  - [ ] Schema SQL completo
  - [ ] Métodos CRUD para palettes
  - [ ] Métodos CRUD para patterns
  - [ ] Métodos para preferences
  - [ ] Métodos para sessions
  - [ ] Sistema de backup automático
  - [ ] Cleanup de datos antiguos

- [ ] **6.3** Crear `learning/index.ts` con exports

- [ ] **6.4** Tests
  - [ ] Test: Guarda y recupera paleta
  - [ ] Test: Aprende patrón nuevo
  - [ ] Test: Actualiza patrón existente
  - [ ] Test: Encuentra patrones por género
  - [ ] Test: Calcula tendencia correctamente
  - [ ] Test: Backup funciona
  - [ ] Test: Cleanup no borra datos valiosos

### Entregables
```
learning/
├── SeleneMemoryManager.ts    # ~600 líneas
├── schema.sql                # ~150 líneas (referencia)
├── index.ts                  # Exports
└── __tests__/
    └── SeleneMemoryManager.test.ts  # ~400 líneas
```
```

---

## 📝 Conclusión

| Criterio | JSON Files | SQLite | Veredicto |
|----------|-----------|--------|-----------|
| Simplicidad inicial | ✅ | ⚠️ | JSON gana |
| Escalabilidad | ❌ | ✅ | **SQLite gana** |
| Queries complejas | ❌ | ✅ | **SQLite gana** |
| Integridad datos | ❌ | ✅ | **SQLite gana** |
| Performance 10K+ | ❌ | ✅ | **SQLite gana** |
| Distribución | ✅ | ✅ | Empate |
| Backup/Restore | ⚠️ | ✅ | **SQLite gana** |

**Puntuación final:** SQLite 6 - JSON 1

### Recomendación Final

> **Para una aplicación profesional de iluminación que necesita recordar 
> patrones, aprender de sesiones pasadas, y sobrevivir 4+ horas de 
> operación continua: SQLite es la elección correcta.**

---

*Blueprint v1.0 - Diciembre 2025*  
*Para revisión del Arquitecto* 👨‍💻
