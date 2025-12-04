/**
 * 🌈 MUSIC TO LIGHT MAPPER - TESTS
 * ==================================
 * Tests para el mapeador de música a parámetros de iluminación
 * 
 * CASOS CRÍTICOS:
 * - Mapeo inteligente con paleta + contexto
 * - Modo fallback reactivo (REGLA 2)
 * - Efectos especiales (beat, drop)
 * 
 * @test MusicToLightMapper
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MusicToLightMapper,
  createMusicToLightMapper,
  LightingSuggestion,
  AudioFeatures,
  MusicContext,
  MAPPING_CONSTANTS,
} from '../MusicToLightMapper';
import {
  ProceduralPaletteGenerator,
  SelenePalette,
} from '../ProceduralPaletteGenerator';

describe('🌈 MusicToLightMapper', () => {
  let mapper: MusicToLightMapper;
  let paletteGenerator: ProceduralPaletteGenerator;
  let testPalette: SelenePalette;

  beforeEach(() => {
    mapper = new MusicToLightMapper();
    paletteGenerator = new ProceduralPaletteGenerator();
    testPalette = paletteGenerator.generatePalette({
      key: 'A',
      mode: 'minor',
      energy: 0.7,
      syncopation: 0.6,
    });
  });

  // ==========================================================
  // INSTANCIACIÓN
  // ==========================================================

  describe('Instanciación', () => {
    it('se instancia correctamente', () => {
      expect(mapper).toBeInstanceOf(MusicToLightMapper);
    });

    it('factory function funciona', () => {
      const m = createMusicToLightMapper();
      expect(m).toBeInstanceOf(MusicToLightMapper);
    });

    it('inicia con contador en 0', () => {
      expect(mapper.getSuggestionCount()).toBe(0);
    });

    it('no tiene sugerencia inicial', () => {
      expect(mapper.getLastSuggestion()).toBeNull();
    });
  });

  // ==========================================================
  // MAPEO INTELIGENTE
  // ==========================================================

  describe('Mapeo Inteligente', () => {
    const context: MusicContext = {
      section: 'chorus',
      mood: 'euphoric',
      energy: 0.8,
      syncopation: 0.6,
      beatPhase: 0.5,
      fillInProgress: false,
    };

    it('genera sugerencia con todos los fixtures', () => {
      const suggestion = mapper.map(testPalette, context);
      
      expect(suggestion.fixtures).toBeDefined();
      expect(suggestion.fixtures.par).toBeDefined();
      expect(suggestion.fixtures.moving_head).toBeDefined();
      expect(suggestion.fixtures.strobe).toBeDefined();
      expect(suggestion.fixtures.bar).toBeDefined();
      expect(suggestion.fixtures.wash).toBeDefined();
      expect(suggestion.fixtures.spot).toBeDefined();
      expect(suggestion.fixtures.blinder).toBeDefined();
      expect(suggestion.fixtures.laser).toBeDefined();
    });

    it('modo es intelligent', () => {
      const suggestion = mapper.map(testPalette, context);
      expect(suggestion.mode).toBe('intelligent');
    });

    it('confianza viene de la paleta', () => {
      const suggestion = mapper.map(testPalette, context);
      expect(suggestion.confidence).toBe(testPalette.metadata.confidence);
    });

    it('colores RGB están en rango válido', () => {
      const suggestion = mapper.map(testPalette, context);
      
      const validateRGB = (color: { r: number; g: number; b: number }) => {
        expect(color.r).toBeGreaterThanOrEqual(0);
        expect(color.r).toBeLessThanOrEqual(255);
        expect(color.g).toBeGreaterThanOrEqual(0);
        expect(color.g).toBeLessThanOrEqual(255);
        expect(color.b).toBeGreaterThanOrEqual(0);
        expect(color.b).toBeLessThanOrEqual(255);
      };
      
      Object.values(suggestion.fixtures).forEach(fixture => {
        validateRGB(fixture.color);
      });
    });

    it('intensidad varía según sección', () => {
      const chorusSuggestion = mapper.map(testPalette, { ...context, section: 'chorus' });
      const verseSuggestion = mapper.map(testPalette, { ...context, section: 'verse' });
      
      // Chorus debe ser más intenso que verse
      expect(chorusSuggestion.fixtures.par.intensity)
        .toBeGreaterThan(verseSuggestion.fixtures.par.intensity);
    });

    it('movimiento varía según mood', () => {
      const euphoricSuggestion = mapper.map(testPalette, { ...context, mood: 'euphoric' });
      const chillSuggestion = mapper.map(testPalette, { ...context, mood: 'chill' });
      
      // Euphoric = circle movement, Chill = static
      expect(euphoricSuggestion.fixtures.moving_head.movement).toBe('circle');
      expect(chillSuggestion.fixtures.moving_head.movement).toBe('static');
    });
  });

  // ==========================================================
  // MODO FALLBACK (REGLA 2)
  // ==========================================================

  describe('Modo Fallback - REGLA 2', () => {
    const audioFeatures: AudioFeatures = {
      bass: 0.8,
      mid: 0.5,
      treble: 0.6,
      energy: 0.7,
      beatDetected: false,
      bpm: 128,
    };

    it('genera sugerencia en modo reactivo', () => {
      const suggestion = mapper.mapFallback(audioFeatures);
      expect(suggestion.mode).toBe('reactive');
    });

    it('confianza es baja en modo reactivo', () => {
      const suggestion = mapper.mapFallback(audioFeatures);
      expect(suggestion.confidence).toBeLessThan(0.5);
    });

    it('bass alto → PAR más intenso', () => {
      const highBass = mapper.mapFallback({ ...audioFeatures, bass: 0.9 });
      const lowBass = mapper.mapFallback({ ...audioFeatures, bass: 0.2 });
      
      expect(highBass.fixtures.par.dimmer).toBeGreaterThan(lowBass.fixtures.par.dimmer);
    });

    it('beat detectado → strobe activo', () => {
      const withBeat = mapper.mapFallback({ ...audioFeatures, beatDetected: true });
      const withoutBeat = mapper.mapFallback({ ...audioFeatures, beatDetected: false });
      
      expect(withBeat.fixtures.strobe.strobe).toBeGreaterThan(0);
      expect(withoutBeat.fixtures.strobe.strobe).toBe(0);
    });

    it('alta energía + beat → blinder activo', () => {
      const suggestion = mapper.mapFallback({
        ...audioFeatures,
        energy: 0.9,
        beatDetected: true,
      });
      
      expect(suggestion.fixtures.blinder.intensity).toBe(255);
    });

    it('baja energía → blinder inactivo', () => {
      const suggestion = mapper.mapFallback({
        ...audioFeatures,
        energy: 0.5,
        beatDetected: true,
      });
      
      expect(suggestion.fixtures.blinder.intensity).toBe(0);
    });
  });

  // ==========================================================
  // EFECTOS ESPECIALES
  // ==========================================================

  describe('Efectos Especiales', () => {
    it('generateBeatEffect genera flash', () => {
      const effect = mapper.generateBeatEffect(testPalette);
      
      expect(effect.strobe).toBeGreaterThan(0);
      expect(effect.intensity).toBeGreaterThan(200);
    });

    it('generateBeatEffect respeta intensidad', () => {
      const fullEffect = mapper.generateBeatEffect(testPalette, 1.0);
      const halfEffect = mapper.generateBeatEffect(testPalette, 0.5);
      
      expect(fullEffect.intensity).toBeGreaterThan(halfEffect.intensity);
    });

    it('generateDropEffect afecta múltiples fixtures', () => {
      const effects = mapper.generateDropEffect(testPalette);
      
      expect(effects.strobe).toBeDefined();
      expect(effects.blinder).toBeDefined();
      expect(effects.moving_head).toBeDefined();
    });

    it('generateDropEffect → strobe a máximo', () => {
      const effects = mapper.generateDropEffect(testPalette);
      expect(effects.strobe.strobe).toBe(255);
    });

    it('generateDropEffect → moving_head chase', () => {
      const effects = mapper.generateDropEffect(testPalette);
      expect(effects.moving_head.movement).toBe('chase');
      expect(effects.moving_head.movementSpeed).toBe(255);
    });
  });

  // ==========================================================
  // EVENTOS
  // ==========================================================

  describe('Eventos', () => {
    it('emite suggestion en map()', () => {
      let emittedMode: string | null = null;
      mapper.on('suggestion', (s: LightingSuggestion) => { emittedMode = s.mode; });
      
      const context: MusicContext = {
        section: 'verse',
        mood: 'neutral',
        energy: 0.5,
        syncopation: 0.3,
        beatPhase: 0.5,
        fillInProgress: false,
      };
      
      mapper.map(testPalette, context);
      
      expect(emittedMode).not.toBeNull();
      expect(emittedMode).toBe('intelligent');
    });

    it('emite suggestion en mapFallback()', () => {
      let emittedMode: string | null = null;
      mapper.on('suggestion', (s: LightingSuggestion) => { emittedMode = s.mode; });
      
      mapper.mapFallback({
        bass: 0.5,
        mid: 0.5,
        treble: 0.5,
        energy: 0.5,
        beatDetected: false,
        bpm: 120,
      });
      
      expect(emittedMode).not.toBeNull();
      expect(emittedMode).toBe('reactive');
    });

    it('emite beat-effect', () => {
      let emitted = false;
      mapper.on('beat-effect', () => { emitted = true; });
      
      mapper.generateBeatEffect(testPalette);
      
      expect(emitted).toBe(true);
    });

    it('emite drop-effect', () => {
      let emitted = false;
      mapper.on('drop-effect', () => { emitted = true; });
      
      mapper.generateDropEffect(testPalette);
      
      expect(emitted).toBe(true);
    });
  });

  // ==========================================================
  // SECCIONES Y MOOD
  // ==========================================================

  describe('Mapeo de Secciones', () => {
    const baseContext: MusicContext = {
      section: 'verse',
      mood: 'neutral',
      energy: 0.5,
      syncopation: 0.3,
      beatPhase: 0.5,
      fillInProgress: false,
    };

    it('drop → máxima intensidad', () => {
      const dropSuggestion = mapper.map(testPalette, { ...baseContext, section: 'drop' });
      expect(dropSuggestion.fixtures.par.intensity).toBe(255);
    });

    it('intro → baja intensidad', () => {
      const introSuggestion = mapper.map(testPalette, { ...baseContext, section: 'intro' });
      expect(introSuggestion.fixtures.par.intensity).toBeLessThan(100);
    });

    it('strobe activo solo en drop o fill', () => {
      const verseSuggestion = mapper.map(testPalette, { ...baseContext, section: 'verse' });
      const dropSuggestion = mapper.map(testPalette, { ...baseContext, section: 'drop' });
      const fillSuggestion = mapper.map(testPalette, { ...baseContext, fillInProgress: true });
      
      expect(verseSuggestion.fixtures.strobe.strobe).toBe(0);
      expect(dropSuggestion.fixtures.strobe.strobe).toBeGreaterThan(0);
      expect(fillSuggestion.fixtures.strobe.strobe).toBeGreaterThan(0);
    });
  });

  describe('Mapeo de Mood', () => {
    const baseContext: MusicContext = {
      section: 'chorus',
      mood: 'neutral',
      energy: 0.6,
      syncopation: 0.4,
      beatPhase: 0.5,
      fillInProgress: false,
    };

    it('euphoric → movimiento circular', () => {
      const suggestion = mapper.map(testPalette, { ...baseContext, mood: 'euphoric' });
      expect(suggestion.fixtures.moving_head.movement).toBe('circle');
    });

    it('aggressive → movimiento aleatorio', () => {
      const suggestion = mapper.map(testPalette, { ...baseContext, mood: 'aggressive' });
      expect(suggestion.fixtures.moving_head.movement).toBe('random');
    });

    it('chill → sin movimiento', () => {
      const suggestion = mapper.map(testPalette, { ...baseContext, mood: 'chill' });
      expect(suggestion.fixtures.moving_head.movement).toBe('static');
    });

    it('groovy → figura de 8', () => {
      const suggestion = mapper.map(testPalette, { ...baseContext, mood: 'groovy' });
      expect(suggestion.fixtures.moving_head.movement).toBe('figure_eight');
    });
  });

  // ==========================================================
  // ESTADÍSTICAS
  // ==========================================================

  describe('Estadísticas', () => {
    it('contador incrementa', () => {
      const context: MusicContext = {
        section: 'verse',
        mood: 'neutral',
        energy: 0.5,
        syncopation: 0.3,
        beatPhase: 0.5,
        fillInProgress: false,
      };
      
      expect(mapper.getSuggestionCount()).toBe(0);
      
      mapper.map(testPalette, context);
      expect(mapper.getSuggestionCount()).toBe(1);
      
      mapper.mapFallback({ bass: 0.5, mid: 0.5, treble: 0.5, energy: 0.5, beatDetected: false, bpm: 120 });
      expect(mapper.getSuggestionCount()).toBe(2);
    });

    it('getLastSuggestion retorna última', () => {
      const context: MusicContext = {
        section: 'chorus',
        mood: 'euphoric',
        energy: 0.8,
        syncopation: 0.6,
        beatPhase: 0.5,
        fillInProgress: false,
      };
      
      mapper.map(testPalette, context);
      
      const last = mapper.getLastSuggestion();
      expect(last?.mode).toBe('intelligent');
    });

    it('reset limpia estado', () => {
      const context: MusicContext = {
        section: 'verse',
        mood: 'neutral',
        energy: 0.5,
        syncopation: 0.3,
        beatPhase: 0.5,
        fillInProgress: false,
      };
      
      mapper.map(testPalette, context);
      mapper.map(testPalette, context);
      
      mapper.reset();
      
      expect(mapper.getSuggestionCount()).toBe(0);
      expect(mapper.getLastSuggestion()).toBeNull();
    });

    it('getStats retorna información correcta', () => {
      const context: MusicContext = {
        section: 'chorus',
        mood: 'euphoric',
        energy: 0.8,
        syncopation: 0.6,
        beatPhase: 0.5,
        fillInProgress: false,
      };
      
      mapper.map(testPalette, context);
      
      const stats = mapper.getStats();
      
      expect(stats.suggestionCount).toBe(1);
      expect(stats.lastSuggestionAge).toBeGreaterThanOrEqual(0);
      expect(stats.lastMode).toBe('intelligent');
    });
  });

  // ==========================================================
  // CONSTANTES EXPORTADAS
  // ==========================================================

  describe('Constantes', () => {
    it('SECTION_TO_INTENSITY tiene secciones principales', () => {
      expect(MAPPING_CONSTANTS.SECTION_TO_INTENSITY.intro).toBeDefined();
      expect(MAPPING_CONSTANTS.SECTION_TO_INTENSITY.chorus).toBeDefined();
      expect(MAPPING_CONSTANTS.SECTION_TO_INTENSITY.drop).toBeDefined();
    });

    it('MOOD_TO_MOVEMENT_TYPE tiene moods principales', () => {
      expect(MAPPING_CONSTANTS.MOOD_TO_MOVEMENT_TYPE.euphoric).toBeDefined();
      expect(MAPPING_CONSTANTS.MOOD_TO_MOVEMENT_TYPE.chill).toBeDefined();
      expect(MAPPING_CONSTANTS.MOOD_TO_MOVEMENT_TYPE.aggressive).toBeDefined();
    });

    it('drop tiene intensidad máxima', () => {
      expect(MAPPING_CONSTANTS.SECTION_TO_INTENSITY.drop).toBe(255);
    });
  });
});
