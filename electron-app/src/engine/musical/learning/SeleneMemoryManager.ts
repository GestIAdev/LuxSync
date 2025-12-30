/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧠 SELENE MEMORY MANAGER - MEMORIA INMORTAL
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Sistema de persistencia SQLite para el aprendizaje de Selene Lux.
 * Sobrevive reinicios, crashes, y el paso del tiempo.
 * 
 * "El Factor DJ 3AM": Las transacciones ACID garantizan que nunca se pierda
 * conocimiento, ni siquiera si el DJ cierra la laptop abruptamente.
 * 
 * @module SeleneMemoryManager
 * @version 1.0.0
 */

import Database, { Database as DatabaseType } from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { HSLColor } from '../mapping/ProceduralPaletteGenerator';

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS E INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ADN Musical - Input del generador de paletas
 */
export interface MusicalDNA {
  key?: string;
  mode?: string;
  energy: number;
  syncopation?: number;
  genre?: string;
  section?: string;
  confidence?: number;
}

/**
 * Paleta de colores para persistir
 */
export interface PaletteRecord {
  sessionId: string;
  musicalDna: MusicalDNA;
  colors: {
    primary: HSLColor;
    secondary: HSLColor;
    accent: HSLColor;
    ambient?: HSLColor;
    contrast?: HSLColor;
  };
  colorStrategy: string;
  transitionSpeed?: number;
  beautyScore?: number;
  userFeedback?: -1 | 0 | 1;
}

/**
 * Patrón aprendido
 */
export interface LearnedPattern {
  id: number;
  patternHash: string;
  genre: string;
  key?: string;
  mode?: string;
  section?: string;
  energyRange: { min: number; max: number };
  preferredStrategy?: string;
  preferredHueBase?: number;
  preferredSaturation?: number;
  preferredIntensity?: number;
  preferredMovement?: string;
  strobeOnBeat: boolean;
  strobeIntensity: number;
  timesUsed: number;
  avgBeautyScore: number;
  positiveFeedback: number;
  negativeFeedback: number;
  beautyTrend: 'rising' | 'falling' | 'stable';
}

/**
 * Sesión de uso
 */
export interface SessionRecord {
  id: string;
  startedAt: number;
  endedAt?: number;
  durationSeconds?: number;
  totalFrames: number;
  totalPalettes: number;
  avgBeautyScore?: number;
  maxBeautyScore?: number;
  minBeautyScore?: number;
  dominantGenre?: string;
  dominantMood?: string;
  genreDistribution?: Record<string, number>;
  avgEnergy?: number;
  preferredIntensity?: number;
  preferredColorTemp?: 'warm' | 'cool' | 'neutral';
  appVersion?: string;
  osPlatform?: string;
  userNotes?: string;
}

/**
 * Sueño de DreamForge
 */
export interface DreamRecord {
  sessionId?: string;
  dreamType: 'intensity' | 'palette' | 'movement' | 'mood' | 'full_scene';
  context: Record<string, unknown>;
  proposedChange: Record<string, unknown>;
  projectedBeauty: number;
  beautyDelta?: number;
  wasAccepted: boolean;
  rejectionReason?: string;
  alternatives?: Record<string, unknown>[];
  executionTimeMs?: number;
}

/**
 * Calibración de fixture
 */
export interface FixtureCalibration {
  fixtureId: string;
  fixtureName?: string;
  fixtureType: string;
  panOffset?: number;
  tiltOffset?: number;
  panInvert?: boolean;
  tiltInvert?: boolean;
  dimmerCurve?: 'linear' | 'square' | 'log' | 'scurve';
  dimmerMin?: number;
  dimmerMax?: number;
  colorTempOffset?: number;
  colorCorrection?: { r: number; g: number; b: number };
  maxIntensity?: number;
  minIntensity?: number;
  maxStrobeRate?: number;
  dmxUniverse?: number;
  dmxAddress?: number;
  notes?: string;
}

/**
 * Configuración del Memory Manager
 */
export interface MemoryManagerConfig {
  dbPath?: string;
  enableWAL?: boolean;
  maxPalettesHistory?: number;
  maxDreamsHistory?: number;
  backupOnClose?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// SELENE MEMORY MANAGER
// ═══════════════════════════════════════════════════════════════════════════

export class SeleneMemoryManager {
  private db: DatabaseType | null = null;
  private config: Required<MemoryManagerConfig>;
  private currentSessionId: string | null = null;
  private isInitialized = false;

  // Prepared statements (cache para rendimiento)
  private statements: {
    insertPalette?: Database.Statement;
    insertPattern?: Database.Statement;
    updatePattern?: Database.Statement;
    getPattern?: Database.Statement;
    getBestPattern?: Database.Statement;
    insertSession?: Database.Statement;
    updateSession?: Database.Statement;
    insertDream?: Database.Statement;
    getPreference?: Database.Statement;
    setPreference?: Database.Statement;
  } = {};

  constructor(config: MemoryManagerConfig = {}) {
    this.config = {
      dbPath: config.dbPath ?? this.getDefaultDbPath(),
      enableWAL: config.enableWAL ?? true,
      maxPalettesHistory: config.maxPalettesHistory ?? 100000,
      maxDreamsHistory: config.maxDreamsHistory ?? 50000,
      backupOnClose: config.backupOnClose ?? true,
    };
  }

  /**
   * Obtiene la ruta por defecto de la base de datos
   */
  private getDefaultDbPath(): string {
    // En entorno de Electron
    if (typeof app !== 'undefined' && app.getPath) {
      const userDataPath = app.getPath('userData');
      return path.join(userDataPath, 'selene-memory.db');
    }
    // En entorno de pruebas o Node puro
    return path.join(process.cwd(), 'selene-memory.db');
  }

  /**
   * Inicializa la base de datos
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Asegurar que el directorio existe
      const dbDir = path.dirname(this.config.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Crear conexión
      this.db = new Database(this.config.dbPath);

      // Configurar para rendimiento
      if (this.config.enableWAL) {
        this.db.pragma('journal_mode = WAL');
      }
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = -64000'); // 64MB cache
      this.db.pragma('temp_store = MEMORY');
      this.db.pragma('foreign_keys = ON');

      // Crear schema
      this.createSchema();

      // Preparar statements
      this.prepareStatements();

      this.isInitialized = true;
      console.log(`[SeleneMemory] ✅ Initialized at: ${this.config.dbPath}`);
    } catch (error) {
      console.error('[SeleneMemory] ❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Crea el schema de la base de datos
   */
  private createSchema(): void {
    if (!this.db) throw new Error('Database not connected');

    // Crear tablas principales
    this.db.exec(`
      -- Paletas
      CREATE TABLE IF NOT EXISTS palettes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        key TEXT,
        mode TEXT,
        energy REAL NOT NULL,
        syncopation REAL DEFAULT 0,
        genre TEXT,
        section TEXT,
        primary_h REAL NOT NULL,
        primary_s REAL NOT NULL,
        primary_l REAL NOT NULL,
        secondary_h REAL NOT NULL,
        secondary_s REAL NOT NULL,
        secondary_l REAL NOT NULL,
        accent_h REAL NOT NULL,
        accent_s REAL NOT NULL,
        accent_l REAL NOT NULL,
        ambient_h REAL,
        ambient_s REAL,
        ambient_l REAL,
        contrast_h REAL,
        contrast_s REAL,
        contrast_l REAL,
        color_strategy TEXT NOT NULL,
        transition_speed INTEGER,
        confidence REAL DEFAULT 0.5,
        beauty_score REAL,
        user_feedback INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      -- Patrones
      CREATE TABLE IF NOT EXISTS patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        pattern_hash TEXT UNIQUE NOT NULL,
        genre TEXT NOT NULL,
        key TEXT,
        mode TEXT,
        section TEXT,
        energy_range_min REAL DEFAULT 0,
        energy_range_max REAL DEFAULT 1,
        preferred_strategy TEXT,
        preferred_hue_base REAL,
        preferred_saturation REAL,
        preferred_intensity REAL,
        preferred_movement TEXT,
        strobe_on_beat INTEGER DEFAULT 1,
        strobe_intensity REAL DEFAULT 0.5,
        times_used INTEGER DEFAULT 0,
        total_beauty_score REAL DEFAULT 0,
        positive_feedback INTEGER DEFAULT 0,
        negative_feedback INTEGER DEFAULT 0,
        beauty_trend TEXT DEFAULT 'stable',
        last_10_scores TEXT
      );

      -- Sesiones
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        duration_seconds INTEGER,
        total_frames INTEGER DEFAULT 0,
        total_palettes INTEGER DEFAULT 0,
        avg_beauty_score REAL,
        max_beauty_score REAL,
        min_beauty_score REAL,
        dominant_genre TEXT,
        dominant_mood TEXT,
        genre_distribution TEXT,
        avg_energy REAL,
        preferred_intensity REAL,
        preferred_color_temp TEXT,
        app_version TEXT,
        os_platform TEXT,
        user_notes TEXT
      );

      -- Preferencias
      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        updated_at INTEGER NOT NULL
      );

      -- Sueños
      CREATE TABLE IF NOT EXISTS dreams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        session_id TEXT,
        dream_type TEXT NOT NULL,
        context_json TEXT NOT NULL,
        proposed_change_json TEXT NOT NULL,
        projected_beauty REAL NOT NULL,
        beauty_delta REAL,
        was_accepted INTEGER NOT NULL,
        rejection_reason TEXT,
        alternatives_json TEXT,
        execution_time_ms REAL
      );

      -- Calibración de fixtures
      CREATE TABLE IF NOT EXISTS fixture_calibration (
        fixture_id TEXT PRIMARY KEY,
        fixture_name TEXT,
        fixture_type TEXT NOT NULL,
        pan_offset INTEGER DEFAULT 0,
        tilt_offset INTEGER DEFAULT 0,
        pan_invert INTEGER DEFAULT 0,
        tilt_invert INTEGER DEFAULT 0,
        dimmer_curve TEXT DEFAULT 'linear',
        dimmer_min INTEGER DEFAULT 0,
        dimmer_max INTEGER DEFAULT 255,
        color_temp_offset INTEGER DEFAULT 0,
        color_correction_r REAL DEFAULT 1.0,
        color_correction_g REAL DEFAULT 1.0,
        color_correction_b REAL DEFAULT 1.0,
        max_intensity REAL DEFAULT 1.0,
        min_intensity REAL DEFAULT 0.0,
        max_strobe_rate INTEGER DEFAULT 25,
        dmx_universe INTEGER,
        dmx_address INTEGER,
        notes TEXT,
        updated_at INTEGER NOT NULL
      );

      -- Índices
      CREATE INDEX IF NOT EXISTS idx_palettes_session ON palettes(session_id);
      CREATE INDEX IF NOT EXISTS idx_palettes_genre ON palettes(genre);
      CREATE INDEX IF NOT EXISTS idx_palettes_beauty ON palettes(beauty_score);
      CREATE INDEX IF NOT EXISTS idx_patterns_hash ON patterns(pattern_hash);
      CREATE INDEX IF NOT EXISTS idx_patterns_genre ON patterns(genre);
      CREATE INDEX IF NOT EXISTS idx_dreams_session ON dreams(session_id);

      -- Preferencias por defecto
      INSERT OR IGNORE INTO preferences (key, value, category, updated_at) VALUES
        ('strobe_max_intensity', '0.8', 'effects', strftime('%s', 'now') * 1000),
        ('strobe_enabled', 'true', 'effects', strftime('%s', 'now') * 1000),
        ('color_saturation_boost', '1.0', 'colors', strftime('%s', 'now') * 1000),
        ('movement_speed_multiplier', '1.0', 'movement', strftime('%s', 'now') * 1000),
        ('auto_blackout_on_silence', 'true', 'behavior', strftime('%s', 'now') * 1000);
    `);
  }

  /**
   * Prepara los statements SQL para mejor rendimiento
   */
  private prepareStatements(): void {
    if (!this.db) return;

    this.statements.insertPalette = this.db.prepare(`
      INSERT INTO palettes (
        timestamp, session_id, key, mode, energy, syncopation, genre, section,
        primary_h, primary_s, primary_l, secondary_h, secondary_s, secondary_l,
        accent_h, accent_s, accent_l, ambient_h, ambient_s, ambient_l,
        contrast_h, contrast_s, contrast_l, color_strategy, transition_speed,
        confidence, beauty_score, user_feedback
      ) VALUES (
        @timestamp, @sessionId, @key, @mode, @energy, @syncopation, @genre, @section,
        @primaryH, @primaryS, @primaryL, @secondaryH, @secondaryS, @secondaryL,
        @accentH, @accentS, @accentL, @ambientH, @ambientS, @ambientL,
        @contrastH, @contrastS, @contrastL, @colorStrategy, @transitionSpeed,
        @confidence, @beautyScore, @userFeedback
      )
    `);

    this.statements.getPattern = this.db.prepare(`
      SELECT * FROM patterns WHERE pattern_hash = ?
    `);

    this.statements.getBestPattern = this.db.prepare(`
      SELECT *,
        (total_beauty_score / NULLIF(times_used, 0)) as avg_beauty
      FROM patterns 
      WHERE genre = ? 
        AND (key IS NULL OR key = ?)
        AND (section IS NULL OR section = ?)
        AND times_used >= 3
      ORDER BY avg_beauty DESC
      LIMIT 1
    `);

    this.statements.insertSession = this.db.prepare(`
      INSERT INTO sessions (id, started_at, app_version, os_platform)
      VALUES (@id, @startedAt, @appVersion, @osPlatform)
    `);

    this.statements.updateSession = this.db.prepare(`
      UPDATE sessions SET
        ended_at = @endedAt,
        duration_seconds = @durationSeconds,
        total_frames = @totalFrames,
        total_palettes = @totalPalettes,
        avg_beauty_score = @avgBeautyScore,
        max_beauty_score = @maxBeautyScore,
        min_beauty_score = @minBeautyScore,
        dominant_genre = @dominantGenre,
        genre_distribution = @genreDistribution,
        avg_energy = @avgEnergy
      WHERE id = @id
    `);

    this.statements.insertDream = this.db.prepare(`
      INSERT INTO dreams (
        timestamp, session_id, dream_type, context_json, proposed_change_json,
        projected_beauty, beauty_delta, was_accepted, rejection_reason,
        alternatives_json, execution_time_ms
      ) VALUES (
        @timestamp, @sessionId, @dreamType, @contextJson, @proposedChangeJson,
        @projectedBeauty, @beautyDelta, @wasAccepted, @rejectionReason,
        @alternativesJson, @executionTimeMs
      )
    `);

    this.statements.getPreference = this.db.prepare(`
      SELECT value FROM preferences WHERE key = ?
    `);

    this.statements.setPreference = this.db.prepare(`
      INSERT INTO preferences (key, value, category, updated_at)
      VALUES (@key, @value, @category, @updatedAt)
      ON CONFLICT(key) DO UPDATE SET
        value = @value,
        updated_at = @updatedAt
    `);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PALETAS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Guarda una paleta generada
   */
  savePalette(palette: PaletteRecord): number {
    if (!this.db || !this.statements.insertPalette) {
      throw new Error('Database not initialized');
    }

    const result = this.statements.insertPalette.run({
      timestamp: Date.now(),
      sessionId: palette.sessionId,
      key: palette.musicalDna.key ?? null,
      mode: palette.musicalDna.mode ?? null,
      energy: palette.musicalDna.energy,
      syncopation: palette.musicalDna.syncopation ?? 0,
      genre: palette.musicalDna.genre ?? null,
      section: palette.musicalDna.section ?? null,
      primaryH: palette.colors.primary.h,
      primaryS: palette.colors.primary.s,
      primaryL: palette.colors.primary.l,
      secondaryH: palette.colors.secondary.h,
      secondaryS: palette.colors.secondary.s,
      secondaryL: palette.colors.secondary.l,
      accentH: palette.colors.accent.h,
      accentS: palette.colors.accent.s,
      accentL: palette.colors.accent.l,
      ambientH: palette.colors.ambient?.h ?? null,
      ambientS: palette.colors.ambient?.s ?? null,
      ambientL: palette.colors.ambient?.l ?? null,
      contrastH: palette.colors.contrast?.h ?? null,
      contrastS: palette.colors.contrast?.s ?? null,
      contrastL: palette.colors.contrast?.l ?? null,
      colorStrategy: palette.colorStrategy,
      transitionSpeed: palette.transitionSpeed ?? null,
      confidence: palette.musicalDna.confidence ?? 0.5,
      beautyScore: palette.beautyScore ?? null,
      userFeedback: palette.userFeedback ?? 0,
    });

    return result.lastInsertRowid as number;
  }

  /**
   * Obtiene paletas recientes
   */
  getRecentPalettes(limit = 100): PaletteRecord[] {
    if (!this.db) return [];

    const rows = this.db.prepare(`
      SELECT * FROM palettes 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(limit) as Record<string, unknown>[];

    return rows.map(row => this.rowToPaletteRecord(row));
  }

  /**
   * Obtiene paletas por género
   */
  getPalettesByGenre(genre: string, limit = 50): PaletteRecord[] {
    if (!this.db) return [];

    const rows = this.db.prepare(`
      SELECT * FROM palettes 
      WHERE genre = ?
      ORDER BY beauty_score DESC, timestamp DESC 
      LIMIT ?
    `).all(genre, limit) as Record<string, unknown>[];

    return rows.map(row => this.rowToPaletteRecord(row));
  }

  /**
   * Actualiza el beauty score de una paleta
   */
  updatePaletteBeauty(paletteId: number, beautyScore: number): void {
    if (!this.db) return;

    this.db.prepare(`
      UPDATE palettes SET beauty_score = ? WHERE id = ?
    `).run(beautyScore, paletteId);
  }

  /**
   * Registra feedback del usuario
   */
  recordUserFeedback(paletteId: number, feedback: -1 | 0 | 1): void {
    if (!this.db) {
      console.log('[SeleneMemory] ⚠️ No DB, skipping user feedback');
      return;
    }

    this.db.prepare(`
      UPDATE palettes SET user_feedback = ? WHERE id = ?
    `).run(feedback, paletteId);
  }

  /**
   * Convierte una fila de la DB a PaletteRecord
   */
  private rowToPaletteRecord(row: Record<string, unknown>): PaletteRecord {
    return {
      sessionId: row.session_id as string,
      musicalDna: {
        key: row.key as string | undefined,
        mode: row.mode as string | undefined,
        energy: row.energy as number,
        syncopation: row.syncopation as number | undefined,
        genre: row.genre as string | undefined,
        section: row.section as string | undefined,
        confidence: row.confidence as number | undefined,
      },
      colors: {
        primary: { h: row.primary_h as number, s: row.primary_s as number, l: row.primary_l as number },
        secondary: { h: row.secondary_h as number, s: row.secondary_s as number, l: row.secondary_l as number },
        accent: { h: row.accent_h as number, s: row.accent_s as number, l: row.accent_l as number },
        ambient: row.ambient_h ? { h: row.ambient_h as number, s: row.ambient_s as number, l: row.ambient_l as number } : undefined,
        contrast: row.contrast_h ? { h: row.contrast_h as number, s: row.contrast_s as number, l: row.contrast_l as number } : undefined,
      },
      colorStrategy: row.color_strategy as string,
      transitionSpeed: row.transition_speed as number | undefined,
      beautyScore: row.beauty_score as number | undefined,
      userFeedback: row.user_feedback as -1 | 0 | 1 | undefined,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PATRONES APRENDIDOS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Genera un hash único para un patrón
   */
  private generatePatternHash(genre: string, key?: string, mode?: string, section?: string): string {
    return `${genre}:${key ?? '*'}:${mode ?? '*'}:${section ?? '*'}`;
  }

  /**
   * Aprende de una paleta exitosa
   */
  learnPattern(
    genre: string,
    key: string | undefined,
    mode: string | undefined,
    section: string | undefined,
    beautyScore: number,
    settings: {
      strategy?: string;
      hueBase?: number;
      saturation?: number;
      intensity?: number;
      movement?: string;
      strobeOnBeat?: boolean;
      strobeIntensity?: number;
    }
  ): void {
    // 🧠 WAVE 10: Skip gracefully if DB not available
    if (!this.db) return;

    const hash = this.generatePatternHash(genre, key, mode, section);
    const now = Date.now();

    // Buscar patrón existente
    const existing = this.statements.getPattern?.get(hash) as Record<string, unknown> | undefined;

    if (existing) {
      // Actualizar patrón existente
      const timesUsed = (existing.times_used as number) + 1;
      const totalBeauty = (existing.total_beauty_score as number) + beautyScore;
      
      // Actualizar últimos 10 scores
      let last10: number[] = [];
      if (existing.last_10_scores) {
        try {
          last10 = JSON.parse(existing.last_10_scores as string);
        } catch { /* ignore */ }
      }
      last10.push(beautyScore);
      if (last10.length > 10) last10.shift();

      // Calcular tendencia
      let trend: 'rising' | 'falling' | 'stable' = 'stable';
      if (last10.length >= 5) {
        const firstHalf = last10.slice(0, Math.floor(last10.length / 2));
        const secondHalf = last10.slice(Math.floor(last10.length / 2));
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        if (secondAvg > firstAvg + 0.05) trend = 'rising';
        else if (secondAvg < firstAvg - 0.05) trend = 'falling';
      }

      this.db.prepare(`
        UPDATE patterns SET
          updated_at = ?,
          times_used = ?,
          total_beauty_score = ?,
          last_10_scores = ?,
          beauty_trend = ?,
          preferred_strategy = COALESCE(?, preferred_strategy),
          preferred_hue_base = COALESCE(?, preferred_hue_base),
          preferred_saturation = COALESCE(?, preferred_saturation),
          preferred_intensity = COALESCE(?, preferred_intensity),
          preferred_movement = COALESCE(?, preferred_movement)
        WHERE pattern_hash = ?
      `).run(
        now,
        timesUsed,
        totalBeauty,
        JSON.stringify(last10),
        trend,
        settings.strategy ?? null,
        settings.hueBase ?? null,
        settings.saturation ?? null,
        settings.intensity ?? null,
        settings.movement ?? null,
        hash
      );
    } else {
      // Crear nuevo patrón
      this.db.prepare(`
        INSERT INTO patterns (
          created_at, updated_at, pattern_hash, genre, key, mode, section,
          preferred_strategy, preferred_hue_base, preferred_saturation,
          preferred_intensity, preferred_movement, strobe_on_beat, strobe_intensity,
          times_used, total_beauty_score, last_10_scores, beauty_trend
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'stable')
      `).run(
        now, now, hash, genre, key ?? null, mode ?? null, section ?? null,
        settings.strategy ?? null,
        settings.hueBase ?? null,
        settings.saturation ?? null,
        settings.intensity ?? null,
        settings.movement ?? null,
        settings.strobeOnBeat !== false ? 1 : 0,
        settings.strobeIntensity ?? 0.5,
        beautyScore,
        JSON.stringify([beautyScore])
      );
    }
  }

  /**
   * Encuentra patrones exitosos para un contexto
   */
  findSuccessfulPatterns(
    genre: string,
    key?: string,
    section?: string,
    minTimesUsed = 3
  ): LearnedPattern[] {
    if (!this.db) return [];

    const rows = this.db.prepare(`
      SELECT *,
        (total_beauty_score / NULLIF(times_used, 0)) as avg_beauty
      FROM patterns 
      WHERE genre = ? 
        AND (key IS NULL OR key = ? OR ? IS NULL)
        AND (section IS NULL OR section = ? OR ? IS NULL)
        AND times_used >= ?
      ORDER BY avg_beauty DESC
      LIMIT 10
    `).all(genre, key, key, section, section, minTimesUsed) as Record<string, unknown>[];

    return rows.map(row => this.rowToLearnedPattern(row));
  }

  /**
   * Obtiene el mejor patrón para un contexto
   */
  getBestPattern(genre: string, key?: string, section?: string): LearnedPattern | null {
    // 🧠 WAVE 10: Return null gracefully if DB not available
    if (!this.db || !this.statements.getBestPattern) {
      return null;
    }

    const row = this.statements.getBestPattern.get(genre, key, section) as Record<string, unknown> | undefined;
    return row ? this.rowToLearnedPattern(row) : null;
  }

  /**
   * Registra feedback positivo/negativo en un patrón
   */
  recordPatternFeedback(patternHash: string, positive: boolean): void {
    // 🧠 WAVE 10: Skip gracefully if DB not available
    if (!this.db) return;

    const column = positive ? 'positive_feedback' : 'negative_feedback';
    this.db.prepare(`
      UPDATE patterns SET ${column} = ${column} + 1, updated_at = ?
      WHERE pattern_hash = ?
    `).run(Date.now(), patternHash);
  }

  /**
   * Convierte una fila de la DB a LearnedPattern
   */
  private rowToLearnedPattern(row: Record<string, unknown>): LearnedPattern {
    return {
      id: row.id as number,
      patternHash: row.pattern_hash as string,
      genre: row.genre as string,
      key: row.key as string | undefined,
      mode: row.mode as string | undefined,
      section: row.section as string | undefined,
      energyRange: {
        min: (row.energy_range_min as number) ?? 0,
        max: (row.energy_range_max as number) ?? 1,
      },
      preferredStrategy: row.preferred_strategy as string | undefined,
      preferredHueBase: row.preferred_hue_base as number | undefined,
      preferredSaturation: row.preferred_saturation as number | undefined,
      preferredIntensity: row.preferred_intensity as number | undefined,
      preferredMovement: row.preferred_movement as string | undefined,
      strobeOnBeat: Boolean(row.strobe_on_beat),
      strobeIntensity: (row.strobe_intensity as number) ?? 0.5,
      timesUsed: (row.times_used as number) ?? 0,
      avgBeautyScore: (row.avg_beauty as number) ?? 0,
      positiveFeedback: (row.positive_feedback as number) ?? 0,
      negativeFeedback: (row.negative_feedback as number) ?? 0,
      beautyTrend: (row.beauty_trend as 'rising' | 'falling' | 'stable') ?? 'stable',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SESIONES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Inicia una nueva sesión
   */
  startSession(appVersion?: string): string {
    // 🧠 WAVE 10: Return fake session if DB not available
    if (!this.db || !this.statements.insertSession) {
      const fakeSessionId = `no-db-${Date.now()}`;
      this.currentSessionId = fakeSessionId;
      return fakeSessionId;
    }

    const sessionId = this.generateSessionId();
    
    this.statements.insertSession.run({
      id: sessionId,
      startedAt: Date.now(),
      appVersion: appVersion ?? '1.0.0',
      osPlatform: process.platform,
    });

    this.currentSessionId = sessionId;
    return sessionId;
  }

  /**
   * Finaliza la sesión actual
   */
  endSession(stats?: Partial<SessionRecord>): void {
    if (!this.db || !this.currentSessionId) return;

    const startedAt = this.db.prepare(`
      SELECT started_at FROM sessions WHERE id = ?
    `).get(this.currentSessionId) as { started_at: number } | undefined;

    if (!startedAt) return;

    const now = Date.now();
    const durationSeconds = Math.floor((now - startedAt.started_at) / 1000);

    this.statements.updateSession?.run({
      id: this.currentSessionId,
      endedAt: now,
      durationSeconds,
      totalFrames: stats?.totalFrames ?? 0,
      totalPalettes: stats?.totalPalettes ?? 0,
      avgBeautyScore: stats?.avgBeautyScore ?? null,
      maxBeautyScore: stats?.maxBeautyScore ?? null,
      minBeautyScore: stats?.minBeautyScore ?? null,
      dominantGenre: stats?.dominantGenre ?? null,
      genreDistribution: stats?.genreDistribution ? JSON.stringify(stats.genreDistribution) : null,
      avgEnergy: stats?.avgEnergy ?? null,
    });

    this.currentSessionId = null;
  }

  /**
   * Obtiene la sesión actual
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Genera un ID único de sesión
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `ses_${timestamp}_${random}`;
  }

  /**
   * Obtiene sesiones recientes
   */
  getRecentSessions(limit = 30): SessionRecord[] {
    if (!this.db) return [];

    const rows = this.db.prepare(`
      SELECT * FROM sessions 
      WHERE ended_at IS NOT NULL
      ORDER BY started_at DESC 
      LIMIT ?
    `).all(limit) as Record<string, unknown>[];

    return rows.map(row => ({
      id: row.id as string,
      startedAt: row.started_at as number,
      endedAt: row.ended_at as number | undefined,
      durationSeconds: row.duration_seconds as number | undefined,
      totalFrames: (row.total_frames as number) ?? 0,
      totalPalettes: (row.total_palettes as number) ?? 0,
      avgBeautyScore: row.avg_beauty_score as number | undefined,
      maxBeautyScore: row.max_beauty_score as number | undefined,
      minBeautyScore: row.min_beauty_score as number | undefined,
      dominantGenre: row.dominant_genre as string | undefined,
      dominantMood: row.dominant_mood as string | undefined,
      genreDistribution: row.genre_distribution ? JSON.parse(row.genre_distribution as string) : undefined,
      avgEnergy: row.avg_energy as number | undefined,
      preferredIntensity: row.preferred_intensity as number | undefined,
      preferredColorTemp: row.preferred_color_temp as 'warm' | 'cool' | 'neutral' | undefined,
      appVersion: row.app_version as string | undefined,
      osPlatform: row.os_platform as string | undefined,
      userNotes: row.user_notes as string | undefined,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PREFERENCIAS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Obtiene una preferencia
   */
  getPreference<T>(key: string, defaultValue: T): T {
    if (!this.db || !this.statements.getPreference) {
      return defaultValue;
    }

    const row = this.statements.getPreference.get(key) as { value: string } | undefined;
    if (!row) return defaultValue;

    try {
      return JSON.parse(row.value) as T;
    } catch {
      return row.value as unknown as T;
    }
  }

  /**
   * Guarda una preferencia
   */
  setPreference<T>(key: string, value: T, category = 'general'): void {
    if (!this.db || !this.statements.setPreference) {
      throw new Error('Database not initialized');
    }

    this.statements.setPreference.run({
      key,
      value: JSON.stringify(value),
      category,
      updatedAt: Date.now(),
    });
  }

  /**
   * Obtiene todas las preferencias de una categoría
   */
  getPreferencesByCategory(category: string): Record<string, unknown> {
    if (!this.db) return {};

    const rows = this.db.prepare(`
      SELECT key, value FROM preferences WHERE category = ?
    `).all(category) as { key: string; value: string }[];

    const result: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        result[row.key] = JSON.parse(row.value);
      } catch {
        result[row.key] = row.value;
      }
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUEÑOS (DREAMFORGE)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Guarda un sueño (simulación de DreamForge)
   */
  saveDream(dream: DreamRecord): number {
    if (!this.db || !this.statements.insertDream) {
      console.log('[SeleneMemory] ⚠️ No DB, skipping dream save');
      return -1;
    }

    const result = this.statements.insertDream.run({
      timestamp: Date.now(),
      sessionId: dream.sessionId ?? this.currentSessionId,
      dreamType: dream.dreamType,
      contextJson: JSON.stringify(dream.context),
      proposedChangeJson: JSON.stringify(dream.proposedChange),
      projectedBeauty: dream.projectedBeauty,
      beautyDelta: dream.beautyDelta ?? null,
      wasAccepted: dream.wasAccepted ? 1 : 0,
      rejectionReason: dream.rejectionReason ?? null,
      alternativesJson: dream.alternatives ? JSON.stringify(dream.alternatives) : null,
      executionTimeMs: dream.executionTimeMs ?? null,
    });

    return result.lastInsertRowid as number;
  }

  /**
   * Obtiene estadísticas de sueños
   */
  getDreamStats(): {
    total: number;
    accepted: number;
    acceptanceRate: number;
    avgProjectedBeauty: number;
    byType: Record<string, { count: number; acceptanceRate: number }>;
  } {
    if (!this.db) {
      return { total: 0, accepted: 0, acceptanceRate: 0, avgProjectedBeauty: 0, byType: {} };
    }

    const total = this.db.prepare(`SELECT COUNT(*) as count FROM dreams`).get() as { count: number };
    const accepted = this.db.prepare(`SELECT COUNT(*) as count FROM dreams WHERE was_accepted = 1`).get() as { count: number };
    const avgBeauty = this.db.prepare(`SELECT AVG(projected_beauty) as avg FROM dreams`).get() as { avg: number };

    const byTypeRows = this.db.prepare(`
      SELECT 
        dream_type,
        COUNT(*) as count,
        SUM(was_accepted) as accepted
      FROM dreams
      GROUP BY dream_type
    `).all() as { dream_type: string; count: number; accepted: number }[];

    const byType: Record<string, { count: number; acceptanceRate: number }> = {};
    for (const row of byTypeRows) {
      byType[row.dream_type] = {
        count: row.count,
        acceptanceRate: row.count > 0 ? row.accepted / row.count : 0,
      };
    }

    return {
      total: total.count,
      accepted: accepted.count,
      acceptanceRate: total.count > 0 ? accepted.count / total.count : 0,
      avgProjectedBeauty: avgBeauty.avg ?? 0,
      byType,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CALIBRACIÓN DE FIXTURES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Guarda o actualiza calibración de un fixture
   */
  saveFixtureCalibration(calibration: FixtureCalibration): void {
    if (!this.db) return;

    this.db.prepare(`
      INSERT INTO fixture_calibration (
        fixture_id, fixture_name, fixture_type, pan_offset, tilt_offset,
        pan_invert, tilt_invert, dimmer_curve, dimmer_min, dimmer_max,
        color_temp_offset, color_correction_r, color_correction_g, color_correction_b,
        max_intensity, min_intensity, max_strobe_rate, dmx_universe, dmx_address,
        notes, updated_at
      ) VALUES (
        @fixtureId, @fixtureName, @fixtureType, @panOffset, @tiltOffset,
        @panInvert, @tiltInvert, @dimmerCurve, @dimmerMin, @dimmerMax,
        @colorTempOffset, @colorCorrectionR, @colorCorrectionG, @colorCorrectionB,
        @maxIntensity, @minIntensity, @maxStrobeRate, @dmxUniverse, @dmxAddress,
        @notes, @updatedAt
      )
      ON CONFLICT(fixture_id) DO UPDATE SET
        fixture_name = @fixtureName,
        fixture_type = @fixtureType,
        pan_offset = @panOffset,
        tilt_offset = @tiltOffset,
        pan_invert = @panInvert,
        tilt_invert = @tiltInvert,
        dimmer_curve = @dimmerCurve,
        dimmer_min = @dimmerMin,
        dimmer_max = @dimmerMax,
        color_temp_offset = @colorTempOffset,
        color_correction_r = @colorCorrectionR,
        color_correction_g = @colorCorrectionG,
        color_correction_b = @colorCorrectionB,
        max_intensity = @maxIntensity,
        min_intensity = @minIntensity,
        max_strobe_rate = @maxStrobeRate,
        dmx_universe = @dmxUniverse,
        dmx_address = @dmxAddress,
        notes = @notes,
        updated_at = @updatedAt
    `).run({
      fixtureId: calibration.fixtureId,
      fixtureName: calibration.fixtureName ?? null,
      fixtureType: calibration.fixtureType,
      panOffset: calibration.panOffset ?? 0,
      tiltOffset: calibration.tiltOffset ?? 0,
      panInvert: calibration.panInvert ? 1 : 0,
      tiltInvert: calibration.tiltInvert ? 1 : 0,
      dimmerCurve: calibration.dimmerCurve ?? 'linear',
      dimmerMin: calibration.dimmerMin ?? 0,
      dimmerMax: calibration.dimmerMax ?? 255,
      colorTempOffset: calibration.colorTempOffset ?? 0,
      colorCorrectionR: calibration.colorCorrection?.r ?? 1.0,
      colorCorrectionG: calibration.colorCorrection?.g ?? 1.0,
      colorCorrectionB: calibration.colorCorrection?.b ?? 1.0,
      maxIntensity: calibration.maxIntensity ?? 1.0,
      minIntensity: calibration.minIntensity ?? 0.0,
      maxStrobeRate: calibration.maxStrobeRate ?? 25,
      dmxUniverse: calibration.dmxUniverse ?? null,
      dmxAddress: calibration.dmxAddress ?? null,
      notes: calibration.notes ?? null,
      updatedAt: Date.now(),
    });
  }

  /**
   * Obtiene calibración de un fixture
   */
  getFixtureCalibration(fixtureId: string): FixtureCalibration | null {
    if (!this.db) return null;

    const row = this.db.prepare(`
      SELECT * FROM fixture_calibration WHERE fixture_id = ?
    `).get(fixtureId) as Record<string, unknown> | undefined;

    if (!row) return null;

    return {
      fixtureId: row.fixture_id as string,
      fixtureName: row.fixture_name as string | undefined,
      fixtureType: row.fixture_type as string,
      panOffset: row.pan_offset as number,
      tiltOffset: row.tilt_offset as number,
      panInvert: Boolean(row.pan_invert),
      tiltInvert: Boolean(row.tilt_invert),
      dimmerCurve: row.dimmer_curve as 'linear' | 'square' | 'log' | 'scurve',
      dimmerMin: row.dimmer_min as number,
      dimmerMax: row.dimmer_max as number,
      colorTempOffset: row.color_temp_offset as number,
      colorCorrection: {
        r: row.color_correction_r as number,
        g: row.color_correction_g as number,
        b: row.color_correction_b as number,
      },
      maxIntensity: row.max_intensity as number,
      minIntensity: row.min_intensity as number,
      maxStrobeRate: row.max_strobe_rate as number,
      dmxUniverse: row.dmx_universe as number | undefined,
      dmxAddress: row.dmx_address as number | undefined,
      notes: row.notes as string | undefined,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MANTENIMIENTO Y UTILIDADES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Limpia datos antiguos
   */
  cleanup(daysToKeep = 90): { palettesDeleted: number; dreamsDeleted: number } {
    if (!this.db) return { palettesDeleted: 0, dreamsDeleted: 0 };

    const cutoffMs = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    // Mantener solo las paletas más recientes
    const palettesResult = this.db.prepare(`
      DELETE FROM palettes 
      WHERE id NOT IN (
        SELECT id FROM palettes ORDER BY timestamp DESC LIMIT ?
      )
      AND timestamp < ?
    `).run(this.config.maxPalettesHistory, cutoffMs);

    // Limpiar sueños antiguos
    const dreamsResult = this.db.prepare(`
      DELETE FROM dreams 
      WHERE id NOT IN (
        SELECT id FROM dreams ORDER BY timestamp DESC LIMIT ?
      )
      AND timestamp < ?
    `).run(this.config.maxDreamsHistory, cutoffMs);

    // VACUUM para recuperar espacio
    this.db.exec('VACUUM');

    return {
      palettesDeleted: palettesResult.changes,
      dreamsDeleted: dreamsResult.changes,
    };
  }

  /**
   * Crea un backup de la base de datos
   */
  async backup(backupPath?: string): Promise<string> {
    if (!this.db) {
      console.log('[SeleneMemory] ⚠️ No DB, skipping backup');
      return '';
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const finalPath = backupPath ?? this.config.dbPath.replace('.db', `-backup-${timestamp}.db`);

    await this.db.backup(finalPath);
    return finalPath;
  }

  /**
   * Obtiene estadísticas generales
   */
  getStats(): {
    totalPalettes: number;
    totalPatterns: number;
    totalSessions: number;
    totalDreams: number;
    dbSizeBytes: number;
    oldestData: number | null;
  } {
    if (!this.db) {
      console.log('[SeleneMemory] ⚠️ No DB, returning empty stats');
      return {
        totalPalettes: 0,
        totalPatterns: 0,
        totalSessions: 0,
        totalDreams: 0,
        dbSizeBytes: 0,
        oldestData: null,
      };
    }

    const palettes = this.db.prepare(`SELECT COUNT(*) as count FROM palettes`).get() as { count: number };
    const patterns = this.db.prepare(`SELECT COUNT(*) as count FROM patterns`).get() as { count: number };
    const sessions = this.db.prepare(`SELECT COUNT(*) as count FROM sessions`).get() as { count: number };
    const dreams = this.db.prepare(`SELECT COUNT(*) as count FROM dreams`).get() as { count: number };
    const oldest = this.db.prepare(`SELECT MIN(timestamp) as oldest FROM palettes`).get() as { oldest: number | null };

    // Tamaño del archivo
    let dbSizeBytes = 0;
    try {
      const stats = fs.statSync(this.config.dbPath);
      dbSizeBytes = stats.size;
    } catch { /* ignore */ }

    return {
      totalPalettes: palettes.count,
      totalPatterns: patterns.count,
      totalSessions: sessions.count,
      totalDreams: dreams.count,
      dbSizeBytes,
      oldestData: oldest.oldest,
    };
  }

  /**
   * Cierra la conexión a la base de datos
   */
  close(): void {
    if (this.db) {
      // Terminar sesión si está activa
      if (this.currentSessionId) {
        this.endSession();
      }

      // Backup opcional
      if (this.config.backupOnClose) {
        // Backup síncrono al cerrar
        try {
          const backupPath = this.config.dbPath.replace('.db', '-autosave.db');
          this.db.exec(`VACUUM INTO '${backupPath}'`);
        } catch (error) {
          console.warn('[SeleneMemory] Backup on close failed:', error);
        }
      }

      this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log('[SeleneMemory] 🔒 Database closed');
    }
  }

  /**
   * Verifica si está inicializado
   */
  isReady(): boolean {
    return this.isInitialized && this.db !== null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════

let instance: SeleneMemoryManager | null = null;

/**
 * Obtiene la instancia singleton del Memory Manager
 */
export function getMemoryManager(config?: MemoryManagerConfig): SeleneMemoryManager {
  if (!instance) {
    instance = new SeleneMemoryManager(config);
  }
  return instance;
}

/**
 * Resetea la instancia singleton (para pruebas)
 */
export function resetMemoryManager(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}

export default SeleneMemoryManager;
