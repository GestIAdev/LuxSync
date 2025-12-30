-- ═══════════════════════════════════════════════════════════════════════════
-- 🧠 SELENE LUX - MEMORIA INMORTAL
-- Base de datos SQLite para persistencia de patrones y aprendizaje
-- ═══════════════════════════════════════════════════════════════════════════

-- Habilitar foreign keys
PRAGMA foreign_keys = ON;

-- ═══════════════════════════════════════════════════════════════════════════
-- 🎨 PALETAS GENERADAS
-- Historial de todas las paletas generadas por ProceduralPaletteGenerator
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS palettes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,           -- Unix timestamp (ms)
  session_id TEXT NOT NULL,             -- UUID de sesión
  
  -- ADN Musical (input del generador)
  key TEXT,                             -- 'C', 'A', 'F#', etc. (nullable si desconocido)
  mode TEXT,                            -- 'major', 'minor', 'dorian', etc.
  energy REAL NOT NULL,                 -- 0.0 - 1.0
  syncopation REAL DEFAULT 0,           -- 0.0 - 1.0
  genre TEXT,                           -- 'reggaeton', 'cumbia', etc.
  section TEXT,                         -- 'drop', 'verse', 'chorus', etc.
  
  -- Colores HSL de la paleta generada
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
  
  -- Metadata
  color_strategy TEXT NOT NULL,         -- 'complementary', 'triadic', 'analogous'
  transition_speed INTEGER,             -- ms recomendados para transición
  confidence REAL DEFAULT 0.5,          -- Confianza del análisis musical
  
  -- Métricas de rendimiento (actualizadas post-aplicación)
  beauty_score REAL,                    -- 0.0 - 1.0 (calculado por DreamForge)
  user_feedback INTEGER DEFAULT 0,      -- -1 (malo), 0 (neutral), +1 (bueno)
  
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_palettes_timestamp ON palettes(timestamp);
CREATE INDEX IF NOT EXISTS idx_palettes_session ON palettes(session_id);
CREATE INDEX IF NOT EXISTS idx_palettes_genre ON palettes(genre);
CREATE INDEX IF NOT EXISTS idx_palettes_key ON palettes(key);
CREATE INDEX IF NOT EXISTS idx_palettes_beauty ON palettes(beauty_score);
CREATE INDEX IF NOT EXISTS idx_palettes_genre_key ON palettes(genre, key);

-- ═══════════════════════════════════════════════════════════════════════════
-- 🎯 PATRONES APRENDIDOS
-- Conocimiento acumulado de qué funciona para cada contexto musical
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  -- Hash único del patrón (genre-key-mode-section)
  pattern_hash TEXT UNIQUE NOT NULL,
  
  -- Contexto musical
  genre TEXT NOT NULL,
  key TEXT,                             -- Nullable = aplica a cualquier key
  mode TEXT,                            -- Nullable = aplica a cualquier modo
  section TEXT,                         -- Nullable = aplica a cualquier sección
  energy_range_min REAL DEFAULT 0,
  energy_range_max REAL DEFAULT 1,
  
  -- Configuración de iluminación preferida (aprendida)
  preferred_strategy TEXT,              -- 'complementary', 'triadic', 'analogous'
  preferred_hue_base REAL,              -- Hue base que mejor funciona
  preferred_saturation REAL,            -- Saturación preferida
  preferred_intensity REAL,             -- Intensidad base preferida
  preferred_movement TEXT,              -- 'circular', 'figure8', 'random', 'none'
  strobe_on_beat INTEGER DEFAULT 1,     -- Boolean: usar strobe en beat
  strobe_intensity REAL DEFAULT 0.5,    -- Intensidad del strobe
  
  -- Métricas de éxito
  times_used INTEGER DEFAULT 0,
  total_beauty_score REAL DEFAULT 0,
  positive_feedback INTEGER DEFAULT 0,
  negative_feedback INTEGER DEFAULT 0,
  
  -- Tendencia (calculada)
  beauty_trend TEXT DEFAULT 'stable',   -- 'rising', 'falling', 'stable'
  last_10_scores TEXT,                  -- JSON array: [0.8, 0.75, 0.9, ...]
  
  -- Columna calculada para avg
  avg_beauty_score REAL GENERATED ALWAYS AS (
    CASE WHEN times_used > 0 THEN total_beauty_score / times_used ELSE 0 END
  ) STORED
);

-- Índices para búsqueda de patrones
CREATE INDEX IF NOT EXISTS idx_patterns_hash ON patterns(pattern_hash);
CREATE INDEX IF NOT EXISTS idx_patterns_genre ON patterns(genre);
CREATE INDEX IF NOT EXISTS idx_patterns_beauty ON patterns(avg_beauty_score);
CREATE INDEX IF NOT EXISTS idx_patterns_used ON patterns(times_used);
CREATE INDEX IF NOT EXISTS idx_patterns_genre_section ON patterns(genre, section);

-- ═══════════════════════════════════════════════════════════════════════════
-- 📊 SESIONES
-- Registro de cada sesión de uso de LuxSync
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                  -- UUID generado al iniciar
  started_at INTEGER NOT NULL,          -- Unix timestamp (ms)
  ended_at INTEGER,                     -- Null si sesión activa
  duration_seconds INTEGER,             -- Calculado al cerrar
  
  -- Estadísticas de la sesión
  total_frames INTEGER DEFAULT 0,
  total_palettes INTEGER DEFAULT 0,
  avg_beauty_score REAL,
  max_beauty_score REAL,
  min_beauty_score REAL,
  
  -- Géneros y contexto
  dominant_genre TEXT,                  -- Género más frecuente
  dominant_mood TEXT,                   -- Mood más frecuente
  genre_distribution TEXT,              -- JSON: {"reggaeton": 45, "cumbia": 30}
  
  -- Preferencias detectadas en esta sesión
  avg_energy REAL,
  preferred_intensity REAL,
  preferred_color_temp TEXT,            -- 'warm', 'cool', 'neutral'
  
  -- Metadata
  app_version TEXT,
  os_platform TEXT,
  user_notes TEXT                       -- Notas opcionales del usuario
);

CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_genre ON sessions(dominant_genre);

-- ═══════════════════════════════════════════════════════════════════════════
-- ⚙️ PREFERENCIAS DEL USUARIO
-- Key-value store para configuración persistente
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,                  -- JSON serializado para flexibilidad
  category TEXT DEFAULT 'general',      -- Categoría para agrupar
  updated_at INTEGER NOT NULL
);

-- Valores por defecto
INSERT OR IGNORE INTO preferences (key, value, category, updated_at) VALUES
  ('strobe_max_intensity', '0.8', 'effects', strftime('%s', 'now') * 1000),
  ('strobe_enabled', 'true', 'effects', strftime('%s', 'now') * 1000),
  ('color_saturation_boost', '1.0', 'colors', strftime('%s', 'now') * 1000),
  ('movement_speed_multiplier', '1.0', 'movement', strftime('%s', 'now') * 1000),
  ('auto_blackout_on_silence', 'true', 'behavior', strftime('%s', 'now') * 1000),
  ('min_confidence_for_intelligent', '0.5', 'behavior', strftime('%s', 'now') * 1000),
  ('favorite_genres', '[]', 'user', strftime('%s', 'now') * 1000),
  ('ui_theme', '"dark"', 'ui', strftime('%s', 'now') * 1000);

-- ═══════════════════════════════════════════════════════════════════════════
-- 🔮 SUEÑOS DE SELENE
-- Simulaciones ejecutadas por DreamForgeEngine
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS dreams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  session_id TEXT,
  
  -- Tipo de sueño simulado
  dream_type TEXT NOT NULL,             -- 'intensity', 'palette', 'movement', 'mood', 'full_scene'
  
  -- Estado antes de la simulación
  context_json TEXT NOT NULL,           -- JSON del estado completo
  
  -- Propuesta del sueño
  proposed_change_json TEXT NOT NULL,   -- JSON de los cambios propuestos
  
  -- Resultado de la evaluación
  projected_beauty REAL NOT NULL,       -- Belleza proyectada (0-1)
  beauty_delta REAL,                    -- Diferencia vs estado actual
  was_accepted INTEGER NOT NULL,        -- 0 = rechazado, 1 = aceptado
  rejection_reason TEXT,                -- Si rechazado, por qué
  
  -- Alternativas generadas (si el sueño fue rechazado)
  alternatives_json TEXT,               -- JSON array de alternativas
  
  -- Tiempo de ejecución
  execution_time_ms REAL,
  
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_dreams_timestamp ON dreams(timestamp);
CREATE INDEX IF NOT EXISTS idx_dreams_type ON dreams(dream_type);
CREATE INDEX IF NOT EXISTS idx_dreams_accepted ON dreams(was_accepted);
CREATE INDEX IF NOT EXISTS idx_dreams_session ON dreams(session_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 🔧 CALIBRACIÓN DE FIXTURES
-- Ajustes específicos por fixture físico
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fixture_calibration (
  fixture_id TEXT PRIMARY KEY,          -- ID único del fixture
  fixture_name TEXT,                    -- Nombre descriptivo
  fixture_type TEXT NOT NULL,           -- 'par', 'moving_head', 'strobe', etc.
  
  -- Offsets de posición (para moving heads)
  pan_offset INTEGER DEFAULT 0,         -- -127 a +127
  tilt_offset INTEGER DEFAULT 0,        -- -127 a +127
  pan_invert INTEGER DEFAULT 0,         -- Boolean
  tilt_invert INTEGER DEFAULT 0,        -- Boolean
  
  -- Curva de dimmer
  dimmer_curve TEXT DEFAULT 'linear',   -- 'linear', 'square', 'log', 'scurve'
  dimmer_min INTEGER DEFAULT 0,         -- Mínimo valor DMX
  dimmer_max INTEGER DEFAULT 255,       -- Máximo valor DMX
  
  -- Corrección de color
  color_temp_offset INTEGER DEFAULT 0,  -- Ajuste de temperatura (-100 a +100)
  color_correction_r REAL DEFAULT 1.0,  -- Multiplicador R
  color_correction_g REAL DEFAULT 1.0,  -- Multiplicador G
  color_correction_b REAL DEFAULT 1.0,  -- Multiplicador B
  
  -- Límites de seguridad
  max_intensity REAL DEFAULT 1.0,
  min_intensity REAL DEFAULT 0.0,
  max_strobe_rate INTEGER DEFAULT 25,   -- Hz máximo
  
  -- Metadata
  dmx_universe INTEGER,
  dmx_address INTEGER,
  notes TEXT,
  updated_at INTEGER NOT NULL
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 🧠 PREY RECOGNITION - Patrones de "presa" identificados por HuntOrchestrator
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS prey_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  -- Identificador del patrón
  pattern_signature TEXT UNIQUE NOT NULL,  -- Hash de características
  
  -- Características del patrón (métricas del frame)
  energy_min REAL,
  energy_max REAL,
  bass_level_min REAL,
  bass_level_max REAL,
  beat_strength_min REAL,
  beat_strength_max REAL,
  section_type TEXT,
  genre TEXT,
  
  -- Resultado óptimo descubierto
  optimal_intensity REAL,
  optimal_color_hue REAL,
  optimal_movement TEXT,
  optimal_strobe_rate REAL,
  
  -- Métricas de éxito
  times_hunted INTEGER DEFAULT 0,
  total_beauty_score REAL DEFAULT 0,
  success_rate REAL DEFAULT 0,          -- Strikes exitosos / total
  
  -- Contexto de descubrimiento
  discovered_in_session TEXT,
  discovered_genre TEXT
);

CREATE INDEX IF NOT EXISTS idx_prey_signature ON prey_patterns(pattern_signature);
CREATE INDEX IF NOT EXISTS idx_prey_genre ON prey_patterns(genre);
CREATE INDEX IF NOT EXISTS idx_prey_success ON prey_patterns(success_rate);

-- ═══════════════════════════════════════════════════════════════════════════
-- 📈 MÉTRICAS DE RENDIMIENTO
-- Para análisis y debugging
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS performance_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  session_id TEXT,
  
  -- Tiempos de ejecución (ms)
  rhythm_analysis_ms REAL,
  harmony_analysis_ms REAL,
  genre_classification_ms REAL,
  palette_generation_ms REAL,
  context_process_ms REAL,
  total_frame_ms REAL,
  
  -- Estado del sistema
  cpu_usage REAL,
  memory_mb REAL,
  active_fixtures INTEGER,
  
  -- Contexto
  mode TEXT,                            -- 'intelligent' o 'reactive'
  confidence REAL,
  
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_perf_session ON performance_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_perf_timestamp ON performance_metrics(timestamp);

-- ═══════════════════════════════════════════════════════════════════════════
-- 🗑️ VISTAS ÚTILES
-- ═══════════════════════════════════════════════════════════════════════════

-- Vista de patrones más exitosos
CREATE VIEW IF NOT EXISTS v_top_patterns AS
SELECT 
  p.*,
  (positive_feedback - negative_feedback) as net_feedback
FROM patterns p
WHERE times_used >= 5
ORDER BY avg_beauty_score DESC, times_used DESC
LIMIT 100;

-- Vista de estadísticas por género
CREATE VIEW IF NOT EXISTS v_genre_stats AS
SELECT 
  genre,
  COUNT(*) as total_palettes,
  AVG(beauty_score) as avg_beauty,
  MAX(beauty_score) as max_beauty,
  COUNT(DISTINCT session_id) as sessions_count
FROM palettes
WHERE genre IS NOT NULL
GROUP BY genre
ORDER BY total_palettes DESC;

-- Vista de sesiones recientes
CREATE VIEW IF NOT EXISTS v_recent_sessions AS
SELECT 
  s.*,
  (SELECT COUNT(*) FROM palettes WHERE session_id = s.id) as palette_count,
  (SELECT COUNT(*) FROM dreams WHERE session_id = s.id) as dream_count
FROM sessions s
WHERE s.ended_at IS NOT NULL
ORDER BY s.started_at DESC
LIMIT 30;

-- ═══════════════════════════════════════════════════════════════════════════
-- 🔧 TRIGGERS PARA MANTENIMIENTO
-- ═══════════════════════════════════════════════════════════════════════════

-- Trigger para actualizar updated_at en patterns
CREATE TRIGGER IF NOT EXISTS trg_patterns_updated_at
AFTER UPDATE ON patterns
BEGIN
  UPDATE patterns SET updated_at = strftime('%s', 'now') * 1000
  WHERE id = NEW.id;
END;

-- Trigger para actualizar updated_at en preferences
CREATE TRIGGER IF NOT EXISTS trg_preferences_updated_at
AFTER UPDATE ON preferences
BEGIN
  UPDATE preferences SET updated_at = strftime('%s', 'now') * 1000
  WHERE key = NEW.key;
END;
