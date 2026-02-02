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
import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
// ═══════════════════════════════════════════════════════════════════════════
// SELENE MEMORY MANAGER
// ═══════════════════════════════════════════════════════════════════════════
export class SeleneMemoryManager {
    constructor(config = {}) {
        this.db = null;
        this.currentSessionId = null;
        this.isInitialized = false;
        // Prepared statements (cache para rendimiento)
        this.statements = {};
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
    getDefaultDbPath() {
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
    async initialize() {
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
        }
        catch (error) {
            console.error('[SeleneMemory] ❌ Initialization failed:', error);
            throw error;
        }
    }
    /**
     * Crea el schema de la base de datos
     */
    createSchema() {
        if (!this.db)
            throw new Error('Database not connected');
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
    prepareStatements() {
        if (!this.db)
            return;
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
    savePalette(palette) {
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
        return result.lastInsertRowid;
    }
    /**
     * Obtiene paletas recientes
     */
    getRecentPalettes(limit = 100) {
        if (!this.db)
            return [];
        const rows = this.db.prepare(`
      SELECT * FROM palettes 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(limit);
        return rows.map(row => this.rowToPaletteRecord(row));
    }
    /**
     * Obtiene paletas por género
     */
    getPalettesByGenre(genre, limit = 50) {
        if (!this.db)
            return [];
        const rows = this.db.prepare(`
      SELECT * FROM palettes 
      WHERE genre = ?
      ORDER BY beauty_score DESC, timestamp DESC 
      LIMIT ?
    `).all(genre, limit);
        return rows.map(row => this.rowToPaletteRecord(row));
    }
    /**
     * Actualiza el beauty score de una paleta
     */
    updatePaletteBeauty(paletteId, beautyScore) {
        if (!this.db)
            return;
        this.db.prepare(`
      UPDATE palettes SET beauty_score = ? WHERE id = ?
    `).run(beautyScore, paletteId);
    }
    /**
     * Registra feedback del usuario
     */
    recordUserFeedback(paletteId, feedback) {
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
    rowToPaletteRecord(row) {
        return {
            sessionId: row.session_id,
            musicalDna: {
                key: row.key,
                mode: row.mode,
                energy: row.energy,
                syncopation: row.syncopation,
                genre: row.genre,
                section: row.section,
                confidence: row.confidence,
            },
            colors: {
                primary: { h: row.primary_h, s: row.primary_s, l: row.primary_l },
                secondary: { h: row.secondary_h, s: row.secondary_s, l: row.secondary_l },
                accent: { h: row.accent_h, s: row.accent_s, l: row.accent_l },
                ambient: row.ambient_h ? { h: row.ambient_h, s: row.ambient_s, l: row.ambient_l } : undefined,
                contrast: row.contrast_h ? { h: row.contrast_h, s: row.contrast_s, l: row.contrast_l } : undefined,
            },
            colorStrategy: row.color_strategy,
            transitionSpeed: row.transition_speed,
            beautyScore: row.beauty_score,
            userFeedback: row.user_feedback,
        };
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // PATRONES APRENDIDOS
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Genera un hash único para un patrón
     */
    generatePatternHash(genre, key, mode, section) {
        return `${genre}:${key ?? '*'}:${mode ?? '*'}:${section ?? '*'}`;
    }
    /**
     * Aprende de una paleta exitosa
     */
    learnPattern(genre, key, mode, section, beautyScore, settings) {
        // 🧠 WAVE 10: Skip gracefully if DB not available
        if (!this.db)
            return;
        const hash = this.generatePatternHash(genre, key, mode, section);
        const now = Date.now();
        // Buscar patrón existente
        const existing = this.statements.getPattern?.get(hash);
        if (existing) {
            // Actualizar patrón existente
            const timesUsed = existing.times_used + 1;
            const totalBeauty = existing.total_beauty_score + beautyScore;
            // Actualizar últimos 10 scores
            let last10 = [];
            if (existing.last_10_scores) {
                try {
                    last10 = JSON.parse(existing.last_10_scores);
                }
                catch { /* ignore */ }
            }
            last10.push(beautyScore);
            if (last10.length > 10)
                last10.shift();
            // Calcular tendencia
            let trend = 'stable';
            if (last10.length >= 5) {
                const firstHalf = last10.slice(0, Math.floor(last10.length / 2));
                const secondHalf = last10.slice(Math.floor(last10.length / 2));
                const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
                const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
                if (secondAvg > firstAvg + 0.05)
                    trend = 'rising';
                else if (secondAvg < firstAvg - 0.05)
                    trend = 'falling';
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
      `).run(now, timesUsed, totalBeauty, JSON.stringify(last10), trend, settings.strategy ?? null, settings.hueBase ?? null, settings.saturation ?? null, settings.intensity ?? null, settings.movement ?? null, hash);
        }
        else {
            // Crear nuevo patrón
            this.db.prepare(`
        INSERT INTO patterns (
          created_at, updated_at, pattern_hash, genre, key, mode, section,
          preferred_strategy, preferred_hue_base, preferred_saturation,
          preferred_intensity, preferred_movement, strobe_on_beat, strobe_intensity,
          times_used, total_beauty_score, last_10_scores, beauty_trend
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'stable')
      `).run(now, now, hash, genre, key ?? null, mode ?? null, section ?? null, settings.strategy ?? null, settings.hueBase ?? null, settings.saturation ?? null, settings.intensity ?? null, settings.movement ?? null, settings.strobeOnBeat !== false ? 1 : 0, settings.strobeIntensity ?? 0.5, beautyScore, JSON.stringify([beautyScore]));
        }
    }
    /**
     * Encuentra patrones exitosos para un contexto
     */
    findSuccessfulPatterns(genre, key, section, minTimesUsed = 3) {
        if (!this.db)
            return [];
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
    `).all(genre, key, key, section, section, minTimesUsed);
        return rows.map(row => this.rowToLearnedPattern(row));
    }
    /**
     * Obtiene el mejor patrón para un contexto
     */
    getBestPattern(genre, key, section) {
        // 🧠 WAVE 10: Return null gracefully if DB not available
        if (!this.db || !this.statements.getBestPattern) {
            return null;
        }
        const row = this.statements.getBestPattern.get(genre, key, section);
        return row ? this.rowToLearnedPattern(row) : null;
    }
    /**
     * Registra feedback positivo/negativo en un patrón
     */
    recordPatternFeedback(patternHash, positive) {
        // 🧠 WAVE 10: Skip gracefully if DB not available
        if (!this.db)
            return;
        const column = positive ? 'positive_feedback' : 'negative_feedback';
        this.db.prepare(`
      UPDATE patterns SET ${column} = ${column} + 1, updated_at = ?
      WHERE pattern_hash = ?
    `).run(Date.now(), patternHash);
    }
    /**
     * Convierte una fila de la DB a LearnedPattern
     */
    rowToLearnedPattern(row) {
        return {
            id: row.id,
            patternHash: row.pattern_hash,
            genre: row.genre,
            key: row.key,
            mode: row.mode,
            section: row.section,
            energyRange: {
                min: row.energy_range_min ?? 0,
                max: row.energy_range_max ?? 1,
            },
            preferredStrategy: row.preferred_strategy,
            preferredHueBase: row.preferred_hue_base,
            preferredSaturation: row.preferred_saturation,
            preferredIntensity: row.preferred_intensity,
            preferredMovement: row.preferred_movement,
            strobeOnBeat: Boolean(row.strobe_on_beat),
            strobeIntensity: row.strobe_intensity ?? 0.5,
            timesUsed: row.times_used ?? 0,
            avgBeautyScore: row.avg_beauty ?? 0,
            positiveFeedback: row.positive_feedback ?? 0,
            negativeFeedback: row.negative_feedback ?? 0,
            beautyTrend: row.beauty_trend ?? 'stable',
        };
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // SESIONES
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Inicia una nueva sesión
     */
    startSession(appVersion) {
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
    endSession(stats) {
        if (!this.db || !this.currentSessionId)
            return;
        const startedAt = this.db.prepare(`
      SELECT started_at FROM sessions WHERE id = ?
    `).get(this.currentSessionId);
        if (!startedAt)
            return;
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
    getCurrentSessionId() {
        return this.currentSessionId;
    }
    /**
     * Genera un ID único de sesión
     */
    generateSessionId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 10);
        return `ses_${timestamp}_${random}`;
    }
    /**
     * Obtiene sesiones recientes
     */
    getRecentSessions(limit = 30) {
        if (!this.db)
            return [];
        const rows = this.db.prepare(`
      SELECT * FROM sessions 
      WHERE ended_at IS NOT NULL
      ORDER BY started_at DESC 
      LIMIT ?
    `).all(limit);
        return rows.map(row => ({
            id: row.id,
            startedAt: row.started_at,
            endedAt: row.ended_at,
            durationSeconds: row.duration_seconds,
            totalFrames: row.total_frames ?? 0,
            totalPalettes: row.total_palettes ?? 0,
            avgBeautyScore: row.avg_beauty_score,
            maxBeautyScore: row.max_beauty_score,
            minBeautyScore: row.min_beauty_score,
            dominantGenre: row.dominant_genre,
            dominantMood: row.dominant_mood,
            genreDistribution: row.genre_distribution ? JSON.parse(row.genre_distribution) : undefined,
            avgEnergy: row.avg_energy,
            preferredIntensity: row.preferred_intensity,
            preferredColorTemp: row.preferred_color_temp,
            appVersion: row.app_version,
            osPlatform: row.os_platform,
            userNotes: row.user_notes,
        }));
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // PREFERENCIAS
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Obtiene una preferencia
     */
    getPreference(key, defaultValue) {
        if (!this.db || !this.statements.getPreference) {
            return defaultValue;
        }
        const row = this.statements.getPreference.get(key);
        if (!row)
            return defaultValue;
        try {
            return JSON.parse(row.value);
        }
        catch {
            return row.value;
        }
    }
    /**
     * Guarda una preferencia
     */
    setPreference(key, value, category = 'general') {
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
    getPreferencesByCategory(category) {
        if (!this.db)
            return {};
        const rows = this.db.prepare(`
      SELECT key, value FROM preferences WHERE category = ?
    `).all(category);
        const result = {};
        for (const row of rows) {
            try {
                result[row.key] = JSON.parse(row.value);
            }
            catch {
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
    saveDream(dream) {
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
        return result.lastInsertRowid;
    }
    /**
     * Obtiene estadísticas de sueños
     */
    getDreamStats() {
        if (!this.db) {
            return { total: 0, accepted: 0, acceptanceRate: 0, avgProjectedBeauty: 0, byType: {} };
        }
        const total = this.db.prepare(`SELECT COUNT(*) as count FROM dreams`).get();
        const accepted = this.db.prepare(`SELECT COUNT(*) as count FROM dreams WHERE was_accepted = 1`).get();
        const avgBeauty = this.db.prepare(`SELECT AVG(projected_beauty) as avg FROM dreams`).get();
        const byTypeRows = this.db.prepare(`
      SELECT 
        dream_type,
        COUNT(*) as count,
        SUM(was_accepted) as accepted
      FROM dreams
      GROUP BY dream_type
    `).all();
        const byType = {};
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
    saveFixtureCalibration(calibration) {
        if (!this.db)
            return;
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
    getFixtureCalibration(fixtureId) {
        if (!this.db)
            return null;
        const row = this.db.prepare(`
      SELECT * FROM fixture_calibration WHERE fixture_id = ?
    `).get(fixtureId);
        if (!row)
            return null;
        return {
            fixtureId: row.fixture_id,
            fixtureName: row.fixture_name,
            fixtureType: row.fixture_type,
            panOffset: row.pan_offset,
            tiltOffset: row.tilt_offset,
            panInvert: Boolean(row.pan_invert),
            tiltInvert: Boolean(row.tilt_invert),
            dimmerCurve: row.dimmer_curve,
            dimmerMin: row.dimmer_min,
            dimmerMax: row.dimmer_max,
            colorTempOffset: row.color_temp_offset,
            colorCorrection: {
                r: row.color_correction_r,
                g: row.color_correction_g,
                b: row.color_correction_b,
            },
            maxIntensity: row.max_intensity,
            minIntensity: row.min_intensity,
            maxStrobeRate: row.max_strobe_rate,
            dmxUniverse: row.dmx_universe,
            dmxAddress: row.dmx_address,
            notes: row.notes,
        };
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // MANTENIMIENTO Y UTILIDADES
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Limpia datos antiguos
     */
    cleanup(daysToKeep = 90) {
        if (!this.db)
            return { palettesDeleted: 0, dreamsDeleted: 0 };
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
    async backup(backupPath) {
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
    getStats() {
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
        const palettes = this.db.prepare(`SELECT COUNT(*) as count FROM palettes`).get();
        const patterns = this.db.prepare(`SELECT COUNT(*) as count FROM patterns`).get();
        const sessions = this.db.prepare(`SELECT COUNT(*) as count FROM sessions`).get();
        const dreams = this.db.prepare(`SELECT COUNT(*) as count FROM dreams`).get();
        const oldest = this.db.prepare(`SELECT MIN(timestamp) as oldest FROM palettes`).get();
        // Tamaño del archivo
        let dbSizeBytes = 0;
        try {
            const stats = fs.statSync(this.config.dbPath);
            dbSizeBytes = stats.size;
        }
        catch { /* ignore */ }
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
    close() {
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
                }
                catch (error) {
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
    isReady() {
        return this.isInitialized && this.db !== null;
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════
let instance = null;
/**
 * Obtiene la instancia singleton del Memory Manager
 */
export function getMemoryManager(config) {
    if (!instance) {
        instance = new SeleneMemoryManager(config);
    }
    return instance;
}
/**
 * Resetea la instancia singleton (para pruebas)
 */
export function resetMemoryManager() {
    if (instance) {
        instance.close();
        instance = null;
    }
}
export default SeleneMemoryManager;
