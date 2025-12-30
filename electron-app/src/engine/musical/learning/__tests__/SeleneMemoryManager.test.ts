/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧪 TESTS - SELENE MEMORY MANAGER
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Suite de pruebas para el sistema de persistencia SQLite.
 * Verifica ACID compliance, queries, y el "Factor DJ 3AM".
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  SeleneMemoryManager,
  getMemoryManager,
  resetMemoryManager,
  PaletteRecord,
  DreamRecord,
  FixtureCalibration,
} from '../SeleneMemoryManager';

// ═══════════════════════════════════════════════════════════════════════════
// TEST SETUP
// ═══════════════════════════════════════════════════════════════════════════

describe('SeleneMemoryManager', () => {
  let manager: SeleneMemoryManager;
  let testDbPath: string;

  beforeEach(async () => {
    // Crear un directorio temporal para cada test
    testDbPath = path.join(os.tmpdir(), `selene-test-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);
    manager = new SeleneMemoryManager({
      dbPath: testDbPath,
      enableWAL: true,
      backupOnClose: false, // Desactivar backups en tests
    });
    await manager.initialize();
  });

  afterEach(() => {
    manager.close();
    // Limpiar archivo de test
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
      // Limpiar archivos WAL también
      const walPath = testDbPath + '-wal';
      const shmPath = testDbPath + '-shm';
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
    } catch { /* ignore cleanup errors */ }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Initialization', () => {
    it('should initialize database successfully', () => {
      expect(manager.isReady()).toBe(true);
    });

    it('should create database file at specified path', () => {
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      const firstCheck = manager.isReady();
      await manager.initialize(); // Double initialization
      expect(manager.isReady()).toBe(firstCheck);
    });

    it('should close database properly', () => {
      manager.close();
      expect(manager.isReady()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PALETTE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Palettes', () => {
    const testPalette: PaletteRecord = {
      sessionId: 'test-session-123',
      musicalDna: {
        key: 'C',
        mode: 'major',
        energy: 0.75,
        syncopation: 0.4,
        genre: 'reggaeton',
        section: 'drop',
        confidence: 0.85,
      },
      colors: {
        primary: { h: 210, s: 80, l: 50 },
        secondary: { h: 30, s: 90, l: 55 },
        accent: { h: 350, s: 85, l: 45 },
        ambient: { h: 180, s: 60, l: 30 },
        contrast: { h: 60, s: 100, l: 60 },
      },
      colorStrategy: 'complementary',
      transitionSpeed: 500,
      beautyScore: 0.82,
      userFeedback: 1,
    };

    it('should save a palette and return ID', () => {
      const id = manager.savePalette(testPalette);
      expect(typeof id).toBe('number');
      expect(id).toBeGreaterThan(0);
    });

    it('should retrieve recent palettes', () => {
      // Guardar varias paletas
      manager.savePalette(testPalette);
      manager.savePalette({ ...testPalette, sessionId: 'test-2' });
      manager.savePalette({ ...testPalette, sessionId: 'test-3' });

      const recent = manager.getRecentPalettes(10);
      expect(recent).toHaveLength(3);
    });

    it('should preserve musical DNA correctly', () => {
      manager.savePalette(testPalette);
      const [retrieved] = manager.getRecentPalettes(1);

      expect(retrieved.musicalDna.key).toBe('C');
      expect(retrieved.musicalDna.mode).toBe('major');
      expect(retrieved.musicalDna.energy).toBe(0.75);
      expect(retrieved.musicalDna.genre).toBe('reggaeton');
    });

    it('should preserve color values accurately', () => {
      manager.savePalette(testPalette);
      const [retrieved] = manager.getRecentPalettes(1);

      expect(retrieved.colors.primary.h).toBe(210);
      expect(retrieved.colors.primary.s).toBe(80);
      expect(retrieved.colors.primary.l).toBe(50);
      expect(retrieved.colors.accent.h).toBe(350);
    });

    it('should handle palettes without optional colors', () => {
      const minimalPalette: PaletteRecord = {
        sessionId: 'minimal-session',
        musicalDna: { energy: 0.5 },
        colors: {
          primary: { h: 0, s: 0, l: 50 },
          secondary: { h: 120, s: 50, l: 50 },
          accent: { h: 240, s: 50, l: 50 },
        },
        colorStrategy: 'triadic',
      };

      const id = manager.savePalette(minimalPalette);
      expect(id).toBeGreaterThan(0);

      const [retrieved] = manager.getRecentPalettes(1);
      expect(retrieved.colors.ambient).toBeUndefined();
      expect(retrieved.colors.contrast).toBeUndefined();
    });

    it('should get palettes by genre', () => {
      // Guardar paletas de diferentes géneros
      manager.savePalette({ ...testPalette, musicalDna: { ...testPalette.musicalDna, genre: 'reggaeton' } });
      manager.savePalette({ ...testPalette, musicalDna: { ...testPalette.musicalDna, genre: 'cumbia' } });
      manager.savePalette({ ...testPalette, musicalDna: { ...testPalette.musicalDna, genre: 'reggaeton' } });

      const reggaetonPalettes = manager.getPalettesByGenre('reggaeton');
      expect(reggaetonPalettes).toHaveLength(2);
      expect(reggaetonPalettes.every(p => p.musicalDna.genre === 'reggaeton')).toBe(true);
    });

    it('should update beauty score', () => {
      const id = manager.savePalette(testPalette);
      manager.updatePaletteBeauty(id, 0.95);

      const [retrieved] = manager.getRecentPalettes(1);
      expect(retrieved.beautyScore).toBe(0.95);
    });

    it('should record user feedback', () => {
      const id = manager.savePalette(testPalette);
      manager.recordUserFeedback(id, -1);

      const [retrieved] = manager.getRecentPalettes(1);
      expect(retrieved.userFeedback).toBe(-1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PATTERN LEARNING TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Pattern Learning', () => {
    it('should learn a new pattern', () => {
      manager.learnPattern(
        'reggaeton',
        'C',
        'minor',
        'drop',
        0.85,
        {
          strategy: 'complementary',
          hueBase: 210,
          saturation: 0.8,
          intensity: 0.75,
          movement: 'circular',
        }
      );

      const patterns = manager.findSuccessfulPatterns('reggaeton', 'C', 'drop', 1);
      expect(patterns).toHaveLength(1);
      expect(patterns[0].genre).toBe('reggaeton');
    });

    it('should accumulate statistics when learning same pattern', () => {
      // Aprender el mismo patrón varias veces
      for (let i = 0; i < 5; i++) {
        manager.learnPattern('cumbia', 'A', 'major', 'verse', 0.7 + i * 0.05, {});
      }

      const patterns = manager.findSuccessfulPatterns('cumbia', 'A', 'verse', 1);
      expect(patterns).toHaveLength(1);
      expect(patterns[0].timesUsed).toBe(5);
      // El promedio debería ser (0.7 + 0.75 + 0.8 + 0.85 + 0.9) / 5 = 0.8
      expect(patterns[0].avgBeautyScore).toBeCloseTo(0.8, 1);
    });

    it('should get best pattern for context', () => {
      // Crear varios patrones con diferentes beauty scores
      manager.learnPattern('techno', 'D', 'minor', 'drop', 0.65, {});
      manager.learnPattern('techno', 'D', 'minor', 'drop', 0.68, {});
      manager.learnPattern('techno', 'D', 'minor', 'drop', 0.72, {});

      manager.learnPattern('techno', 'E', 'minor', 'drop', 0.90, {});
      manager.learnPattern('techno', 'E', 'minor', 'drop', 0.88, {});
      manager.learnPattern('techno', 'E', 'minor', 'drop', 0.92, {});

      const best = manager.getBestPattern('techno', 'E', 'drop');
      expect(best).not.toBeNull();
      expect(best?.avgBeautyScore).toBeGreaterThan(0.85);
    });

    it('should record positive/negative feedback on patterns', () => {
      manager.learnPattern('salsa', 'G', 'major', 'chorus', 0.75, {});

      const hash = 'salsa:G:major:chorus';
      manager.recordPatternFeedback(hash, true);
      manager.recordPatternFeedback(hash, true);
      manager.recordPatternFeedback(hash, false);

      const patterns = manager.findSuccessfulPatterns('salsa', 'G', 'chorus', 1);
      expect(patterns[0].positiveFeedback).toBe(2);
      expect(patterns[0].negativeFeedback).toBe(1);
    });

    it('should calculate beauty trend', () => {
      // Crear un patrón con beauty scores en aumento
      for (let i = 0; i < 10; i++) {
        manager.learnPattern('house', 'F', 'major', 'buildup', 0.5 + i * 0.04, {});
      }

      const patterns = manager.findSuccessfulPatterns('house', 'F', 'buildup', 1);
      expect(patterns[0].beautyTrend).toBe('rising');
    });

    it('should handle patterns without optional context', () => {
      manager.learnPattern('edm', undefined, undefined, undefined, 0.8, {});

      const patterns = manager.findSuccessfulPatterns('edm', undefined, undefined, 1);
      expect(patterns).toHaveLength(1);
      // SQLite devuelve null, no undefined, para valores faltantes
      expect(patterns[0].key).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Sessions', () => {
    it('should start a session and return ID', () => {
      const sessionId = manager.startSession('1.0.0');
      expect(sessionId).toBeTruthy();
      expect(sessionId.startsWith('ses_')).toBe(true);
    });

    it('should track current session ID', () => {
      const sessionId = manager.startSession('1.0.0');
      expect(manager.getCurrentSessionId()).toBe(sessionId);
    });

    it('should end session with stats', () => {
      const sessionId = manager.startSession('1.0.0');

      // Simular algo de actividad
      manager.savePalette({
        sessionId,
        musicalDna: { energy: 0.8 },
        colors: {
          primary: { h: 0, s: 0, l: 50 },
          secondary: { h: 120, s: 50, l: 50 },
          accent: { h: 240, s: 50, l: 50 },
        },
        colorStrategy: 'triadic',
      });

      manager.endSession({
        totalFrames: 1000,
        totalPalettes: 1,
        avgBeautyScore: 0.75,
        dominantGenre: 'reggaeton',
      });

      expect(manager.getCurrentSessionId()).toBeNull();
    });

    it('should get recent sessions', () => {
      // Crear y terminar varias sesiones
      for (let i = 0; i < 3; i++) {
        manager.startSession('1.0.0');
        manager.endSession({ totalFrames: i * 100 });
      }

      const sessions = manager.getRecentSessions(10);
      expect(sessions).toHaveLength(3);
    });

    it('should generate unique session IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const sessionId = manager.startSession('1.0.0');
        expect(ids.has(sessionId)).toBe(false);
        ids.add(sessionId);
        manager.endSession();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PREFERENCES TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Preferences', () => {
    it('should get default preferences', () => {
      const strobeEnabled = manager.getPreference('strobe_enabled', false);
      expect(strobeEnabled).toBe(true);

      const strobeMax = manager.getPreference('strobe_max_intensity', 0.5);
      expect(strobeMax).toBe(0.8);
    });

    it('should return default value if preference not found', () => {
      const unknown = manager.getPreference('nonexistent_key', 'default_value');
      expect(unknown).toBe('default_value');
    });

    it('should save and retrieve custom preference', () => {
      manager.setPreference('custom_key', { nested: { value: 42 } }, 'custom');

      const retrieved = manager.getPreference('custom_key', null);
      expect(retrieved).toEqual({ nested: { value: 42 } });
    });

    it('should update existing preference', () => {
      manager.setPreference('test_pref', 'initial');
      manager.setPreference('test_pref', 'updated');

      const value = manager.getPreference('test_pref', '');
      expect(value).toBe('updated');
    });

    it('should get preferences by category', () => {
      manager.setPreference('cat_test_1', 'value1', 'test_category');
      manager.setPreference('cat_test_2', 'value2', 'test_category');
      manager.setPreference('other_key', 'value3', 'other_category');

      const testCategoryPrefs = manager.getPreferencesByCategory('test_category');
      expect(Object.keys(testCategoryPrefs)).toHaveLength(2);
      expect(testCategoryPrefs['cat_test_1']).toBe('value1');
    });

    it('should handle various data types', () => {
      manager.setPreference('string_pref', 'hello');
      manager.setPreference('number_pref', 42.5);
      manager.setPreference('bool_pref', true);
      manager.setPreference('array_pref', [1, 2, 3]);
      manager.setPreference('object_pref', { a: 1, b: 2 });

      expect(manager.getPreference('string_pref', '')).toBe('hello');
      expect(manager.getPreference('number_pref', 0)).toBe(42.5);
      expect(manager.getPreference('bool_pref', false)).toBe(true);
      expect(manager.getPreference('array_pref', [])).toEqual([1, 2, 3]);
      expect(manager.getPreference('object_pref', {})).toEqual({ a: 1, b: 2 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DREAMS TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Dreams (DreamForge)', () => {
    const testDream: DreamRecord = {
      dreamType: 'palette',
      context: {
        currentBeauty: 0.7,
        energy: 0.8,
        genre: 'reggaeton',
      },
      proposedChange: {
        newHue: 210,
        saturationBoost: 0.1,
      },
      projectedBeauty: 0.85,
      beautyDelta: 0.15,
      wasAccepted: true,
      executionTimeMs: 5.2,
    };

    it('should save a dream', () => {
      const id = manager.saveDream(testDream);
      expect(id).toBeGreaterThan(0);
    });

    it('should save rejected dream with reason', () => {
      const rejectedDream: DreamRecord = {
        ...testDream,
        wasAccepted: false,
        rejectionReason: 'Below beauty threshold',
        alternatives: [
          { hue: 180, delta: 0.1 },
          { hue: 240, delta: 0.08 },
        ],
      };

      const id = manager.saveDream(rejectedDream);
      expect(id).toBeGreaterThan(0);
    });

    it('should get dream statistics', () => {
      // Guardar varios sueños
      manager.saveDream({ ...testDream, wasAccepted: true });
      manager.saveDream({ ...testDream, wasAccepted: true });
      manager.saveDream({ ...testDream, wasAccepted: false });
      manager.saveDream({ ...testDream, dreamType: 'intensity', wasAccepted: true });

      const stats = manager.getDreamStats();

      expect(stats.total).toBe(4);
      expect(stats.accepted).toBe(3);
      expect(stats.acceptanceRate).toBeCloseTo(0.75, 2);
      expect(stats.byType['palette'].count).toBe(3);
      expect(stats.byType['intensity'].count).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FIXTURE CALIBRATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Fixture Calibration', () => {
    const testCalibration: FixtureCalibration = {
      fixtureId: 'moving-head-1',
      fixtureName: 'Beam 2R Left',
      fixtureType: 'moving_head',
      panOffset: 15,
      tiltOffset: -10,
      panInvert: false,
      tiltInvert: true,
      dimmerCurve: 'square',
      dimmerMin: 10,
      dimmerMax: 240,
      colorTempOffset: -20,
      colorCorrection: { r: 0.95, g: 1.0, b: 1.05 },
      maxIntensity: 0.9,
      minIntensity: 0.05,
      maxStrobeRate: 20,
      dmxUniverse: 1,
      dmxAddress: 101,
      notes: 'Front left position',
    };

    it('should save fixture calibration', () => {
      manager.saveFixtureCalibration(testCalibration);
      
      const retrieved = manager.getFixtureCalibration('moving-head-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.fixtureName).toBe('Beam 2R Left');
    });

    it('should preserve all calibration values', () => {
      manager.saveFixtureCalibration(testCalibration);
      const retrieved = manager.getFixtureCalibration('moving-head-1');

      expect(retrieved?.panOffset).toBe(15);
      expect(retrieved?.tiltOffset).toBe(-10);
      expect(retrieved?.panInvert).toBe(false);
      expect(retrieved?.tiltInvert).toBe(true);
      expect(retrieved?.dimmerCurve).toBe('square');
      expect(retrieved?.colorCorrection?.r).toBe(0.95);
      expect(retrieved?.colorCorrection?.b).toBe(1.05);
    });

    it('should update existing calibration', () => {
      manager.saveFixtureCalibration(testCalibration);
      manager.saveFixtureCalibration({
        ...testCalibration,
        panOffset: 25, // Cambiado
        notes: 'Updated position',
      });

      const retrieved = manager.getFixtureCalibration('moving-head-1');
      expect(retrieved?.panOffset).toBe(25);
      expect(retrieved?.notes).toBe('Updated position');
    });

    it('should return null for non-existent fixture', () => {
      const result = manager.getFixtureCalibration('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MAINTENANCE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Maintenance', () => {
    it('should get database stats', () => {
      // Agregar algunos datos
      manager.savePalette({
        sessionId: 'test',
        musicalDna: { energy: 0.5 },
        colors: {
          primary: { h: 0, s: 0, l: 50 },
          secondary: { h: 120, s: 50, l: 50 },
          accent: { h: 240, s: 50, l: 50 },
        },
        colorStrategy: 'triadic',
      });
      manager.learnPattern('test', 'C', 'major', 'verse', 0.8, {});

      const stats = manager.getStats();

      expect(stats.totalPalettes).toBe(1);
      expect(stats.totalPatterns).toBe(1);
      expect(stats.dbSizeBytes).toBeGreaterThan(0);
    });

    it('should clean up old data', () => {
      // Agregar muchas paletas
      for (let i = 0; i < 10; i++) {
        manager.savePalette({
          sessionId: `session-${i}`,
          musicalDna: { energy: 0.5 },
          colors: {
            primary: { h: i * 36, s: 50, l: 50 },
            secondary: { h: 120, s: 50, l: 50 },
            accent: { h: 240, s: 50, l: 50 },
          },
          colorStrategy: 'triadic',
        });
      }

      const result = manager.cleanup(0); // Cleanup inmediato para tests
      expect(typeof result.palettesDeleted).toBe('number');
    });

    it('should create backup', async () => {
      const backupPath = path.join(os.tmpdir(), `selene-backup-test-${Date.now()}.db`);
      
      try {
        const resultPath = await manager.backup(backupPath);
        expect(fs.existsSync(resultPath)).toBe(true);
      } finally {
        // Cleanup
        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath);
        }
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SINGLETON TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Singleton Pattern', () => {
    afterEach(() => {
      resetMemoryManager();
    });

    it('should return same instance', () => {
      const instance1 = getMemoryManager({ dbPath: testDbPath, backupOnClose: false });
      const instance2 = getMemoryManager();
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', () => {
      const instance1 = getMemoryManager({ dbPath: testDbPath, backupOnClose: false });
      resetMemoryManager();
      const instance2 = getMemoryManager({ dbPath: testDbPath, backupOnClose: false });
      expect(instance1).not.toBe(instance2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ACID COMPLIANCE TESTS (Factor DJ 3AM)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ACID Compliance (Factor DJ 3AM)', () => {
    it('should survive abrupt close and reopen', async () => {
      // Guardar datos importantes
      manager.savePalette({
        sessionId: 'critical-session',
        musicalDna: { energy: 0.95, genre: 'reggaeton' },
        colors: {
          primary: { h: 210, s: 90, l: 50 },
          secondary: { h: 30, s: 85, l: 55 },
          accent: { h: 350, s: 80, l: 45 },
        },
        colorStrategy: 'complementary',
        beautyScore: 0.92,
      });
      manager.learnPattern('reggaeton', 'A', 'minor', 'drop', 0.92, {
        strategy: 'complementary',
        hueBase: 210,
      });

      // Simular cierre abrupto (sin endSession, sin cleanup)
      manager.close();

      // Reabrir y verificar datos
      const recoveredManager = new SeleneMemoryManager({
        dbPath: testDbPath,
        enableWAL: true,
        backupOnClose: false,
      });
      await recoveredManager.initialize();

      try {
        const palettes = recoveredManager.getRecentPalettes(10);
        expect(palettes).toHaveLength(1);
        expect(palettes[0].musicalDna.genre).toBe('reggaeton');
        expect(palettes[0].beautyScore).toBe(0.92);

        const patterns = recoveredManager.findSuccessfulPatterns('reggaeton', 'A', 'drop', 1);
        expect(patterns).toHaveLength(1);
      } finally {
        recoveredManager.close();
      }
    });

    it('should handle concurrent writes without corruption', async () => {
      // Simular múltiples escrituras rápidas (como en un show en vivo)
      const promises: Promise<void>[] = [];
      
      for (let i = 0; i < 100; i++) {
        promises.push(new Promise<void>(resolve => {
          manager.savePalette({
            sessionId: `session-${i}`,
            musicalDna: { energy: Math.random() },
            colors: {
              primary: { h: Math.random() * 360, s: 80, l: 50 },
              secondary: { h: 120, s: 50, l: 50 },
              accent: { h: 240, s: 50, l: 50 },
            },
            colorStrategy: 'triadic',
          });
          resolve();
        }));
      }

      await Promise.all(promises);

      const stats = manager.getStats();
      expect(stats.totalPalettes).toBe(100);
    });

    it('should maintain data integrity after power loss simulation', async () => {
      // Iniciar sesión y agregar datos
      const sessionId = manager.startSession('1.0.0');
      
      for (let i = 0; i < 50; i++) {
        manager.savePalette({
          sessionId,
          musicalDna: { energy: 0.5 + i * 0.01 },
          colors: {
            primary: { h: i * 7.2, s: 80, l: 50 },
            secondary: { h: 120, s: 50, l: 50 },
            accent: { h: 240, s: 50, l: 50 },
          },
          colorStrategy: 'analogous',
        });
      }

      // NO llamar endSession - simular corte de energía
      manager.close();

      // Recuperar
      const recovered = new SeleneMemoryManager({
        dbPath: testDbPath,
        enableWAL: true,
        backupOnClose: false,
      });
      await recovered.initialize();

      try {
        const palettes = recovered.getRecentPalettes(100);
        expect(palettes.length).toBe(50);
        
        // Verificar integridad de los colores
        for (const palette of palettes) {
          expect(palette.colors.primary.h).toBeGreaterThanOrEqual(0);
          expect(palette.colors.primary.h).toBeLessThanOrEqual(360);
        }
      } finally {
        recovered.close();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PERFORMANCE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Performance', () => {
    it('should handle high-volume palette inserts', () => {
      const startTime = Date.now();
      const count = 1000;

      for (let i = 0; i < count; i++) {
        manager.savePalette({
          sessionId: `perf-session-${i % 10}`,
          musicalDna: { energy: Math.random(), genre: 'test' },
          colors: {
            primary: { h: Math.random() * 360, s: 80, l: 50 },
            secondary: { h: 120, s: 50, l: 50 },
            accent: { h: 240, s: 50, l: 50 },
          },
          colorStrategy: 'triadic',
        });
      }

      const elapsed = Date.now() - startTime;
      const insertsPerSecond = (count / elapsed) * 1000;

      // Should achieve at least 500 inserts/second
      expect(insertsPerSecond).toBeGreaterThan(500);
      console.log(`Performance: ${insertsPerSecond.toFixed(0)} inserts/sec`);
    });

    it('should query patterns efficiently', () => {
      // Setup: Crear muchos patrones
      const genres = ['reggaeton', 'cumbia', 'salsa', 'merengue', 'techno'];
      const keys = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
      const sections = ['intro', 'verse', 'chorus', 'drop', 'outro'];

      for (const genre of genres) {
        for (const key of keys) {
          for (const section of sections) {
            manager.learnPattern(genre, key, 'minor', section, Math.random(), {});
            manager.learnPattern(genre, key, 'minor', section, Math.random(), {});
            manager.learnPattern(genre, key, 'minor', section, Math.random(), {});
          }
        }
      }

      // Benchmark queries
      const startTime = Date.now();
      const queryCount = 100;

      for (let i = 0; i < queryCount; i++) {
        const genre = genres[i % genres.length];
        const key = keys[i % keys.length];
        const section = sections[i % sections.length];
        manager.getBestPattern(genre, key, section);
      }

      const elapsed = Date.now() - startTime;
      const queriesPerSecond = (queryCount / elapsed) * 1000;

      // Should achieve at least 1000 queries/second
      expect(queriesPerSecond).toBeGreaterThan(1000);
      console.log(`Query Performance: ${queriesPerSecond.toFixed(0)} queries/sec`);
    });
  });
});
