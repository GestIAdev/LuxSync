/**
 * 🧪 SELENE COLOR ENGINE - Tests
 * 
 * ⚠️ WAVE 68.5: TESTS OBSOLETOS - Basados en lógica de GÉNERO eliminada
 * 
 * Estos tests validaban la generación con MACRO_GENRES, GENRE_MAP y macroGenre.
 * WAVE 68.5 eliminó toda la lógica de género del motor de color.
 * 
 * TODO: Reescribir tests para validar matemática musical PURA:
 * - Key → Hue (círculo de quintas)
 * - Mode → Temperature bias
 * - Energy → Saturation & Lightness
 * - Syncopation → Contrast strategy
 * 
 * @deprecated WAVE 68.5
 * @version 17.2.0
 */

/* TESTS COMENTADOS - OBSOLETOS TRAS WAVE 68.5

import { describe, it, expect, beforeAll } from 'vitest';
import { 
  SeleneColorEngine,
  hslToRgb,
  paletteToRgb,
  KEY_TO_HUE,
  MACRO_GENRES,
  type ExtendedAudioAnalysis,
  type SelenePalette,
} from '../SeleneColorEngine';

describe('SeleneColorEngine', () => {
  
  // ============================================================
  // EJEMPLOS REALES DEL PROTOCOLO JSON
  // ============================================================
  
  describe('Ejemplo 1: TECHNO (Boris Brejcha, 200 BPM, A minor)', () => {
    const technoInput: ExtendedAudioAnalysis = {
      energy: 0.34,
      bpm: 200,
      bass: 0.42,
      mid: 0.11,
      treble: 0.06,
      wave8: {
        rhythm: {
          syncopation: 0.27,
          groove: 0.89,
          subdivision: 16,
          confidence: 0.92,
        },
        harmony: {
          key: 'A',
          mode: 'minor',
          mood: 'tense',
          temperature: 'cool',
          confidence: 0.78,
        },
        section: {
          type: 'drop',
          energy: 0.34,
          confidence: 0.95,
        },
        genre: {
          primary: 'techno',
          secondary: null,
          confidence: 0.89,
        },
      },
    };
    
    let palette: SelenePalette;
    
    beforeAll(() => {
      palette = SeleneColorEngine.generate(technoInput);
    });
    
    it('debe detectar macro-género ELECTRONIC_4X4', () => {
      expect(palette.meta.macroGenre).toBe('ELECTRONIC_4X4');
    });
    
    it('debe usar estrategia analogous (syncopation < 0.30)', () => {
      expect(palette.meta.strategy).toBe('analogous');
    });
    
    it('debe tener temperatura cool (A minor = índigo)', () => {
      expect(palette.meta.temperature).toBe('cool');
    });
    
    it('primary.hue debe estar en rango azul/violeta (240-270°)', () => {
      // A = 270°, minor = -15°, ELECTRONIC_4X4.tempBias = -15°
      // finalHue = 270 - 15 - 15 = 240°
      expect(palette.primary.h).toBeGreaterThanOrEqual(230);
      expect(palette.primary.h).toBeLessThanOrEqual(260);
    });
    
    it('saturation debe ser moderada (energy 0.34 → ~57%)', () => {
      // baseSat = 40 + (0.34 * 60) = 60.4%
      // + minor.sat(-10) + genre.satBoost(-10) = ~40-50%
      expect(palette.primary.s).toBeGreaterThanOrEqual(35);
      expect(palette.primary.s).toBeLessThanOrEqual(65);
    });
    
    it('lightness debe ser baja (oscuro underground)', () => {
      // baseLight = 30 + (0.34 * 50) = 47%
      // + minor.light(-10) + genre.lightBoost(-10) = ~27-40%
      expect(palette.primary.l).toBeGreaterThanOrEqual(25);
      expect(palette.primary.l).toBeLessThanOrEqual(50);
    });
    
    it('secondary debe usar rotación Fibonacci (~222.5°)', () => {
      const expectedSecondaryHue = (palette.primary.h + 222.5) % 360;
      // Tolerar ±5° por redondeos
      const diff = Math.abs(palette.secondary.h - expectedSecondaryHue);
      expect(diff < 5 || diff > 355).toBe(true);
    });
    
    it('accent debe usar analogous (+30°)', () => {
      const expectedAccentHue = (palette.primary.h + 30) % 360;
      const diff = Math.abs(palette.accent.h - expectedAccentHue);
      expect(diff < 5 || diff > 355).toBe(true);
    });
    
    it('RGB primary debe ser azul oscuro', () => {
      const rgb = hslToRgb(palette.primary);
      // Azul oscuro: R < G ≈ B, todos bajos
      expect(rgb.b).toBeGreaterThanOrEqual(rgb.r);
      expect(rgb.r).toBeLessThan(100);
    });
  });
  
  // ============================================================
  
  describe('Ejemplo 2: CUMBIA (La Pollera Colorá, 110 BPM, D major)', () => {
    const cumbiaInput: ExtendedAudioAnalysis = {
      energy: 0.68,
      bpm: 110,
      bass: 0.35,
      mid: 0.42,
      treble: 0.28,
      wave8: {
        rhythm: {
          syncopation: 0.68,
          groove: 0.76,
          subdivision: 8,
          confidence: 0.94,
        },
        harmony: {
          key: 'D',
          mode: 'major',
          mood: 'spanish_exotic',
          temperature: 'warm',
          confidence: 0.85,
        },
        section: {
          type: 'chorus',
          energy: 0.68,
          confidence: 0.96,
        },
        genre: {
          primary: 'cumbia',
          secondary: 'latin_pop',
          confidence: 0.91,
        },
      },
    };
    
    let palette: SelenePalette;
    
    beforeAll(() => {
      palette = SeleneColorEngine.generate(cumbiaInput);
    });
    
    it('debe detectar macro-género LATINO_TRADICIONAL', () => {
      expect(palette.meta.macroGenre).toBe('LATINO_TRADICIONAL');
    });
    
    it('debe usar estrategia complementary (syncopation > 0.50)', () => {
      expect(palette.meta.strategy).toBe('complementary');
    });
    
    it('debe tener temperatura warm (D major = naranja)', () => {
      expect(palette.meta.temperature).toBe('warm');
    });
    
    it('primary.hue debe estar en rango naranja/dorado (60-100°)', () => {
      // D = 60°, major = +15°, LATINO_TRADICIONAL.tempBias = +25°
      // finalHue = 60 + 15 + 25 = 100°
      expect(palette.primary.h).toBeGreaterThanOrEqual(80);
      expect(palette.primary.h).toBeLessThanOrEqual(110);
    });
    
    it('saturation debe ser MUY alta (energy 0.68 + genre boost)', () => {
      // baseSat = 40 + (0.68 * 60) = 80.8%
      // + major.sat(+10) + genre.satBoost(+20) = 100%
      expect(palette.primary.s).toBeGreaterThanOrEqual(80);
    });
    
    it('lightness debe ser alta (brillante festivo)', () => {
      // baseLight = 30 + (0.68 * 50) = 64%
      // + major.light(+10) + genre.lightBoost(+15) = ~80%
      expect(palette.primary.l).toBeGreaterThanOrEqual(55);
      expect(palette.primary.l).toBeLessThanOrEqual(80);
    });
    
    it('accent debe usar complementary (+180°)', () => {
      const expectedAccentHue = (palette.primary.h + 180) % 360;
      const diff = Math.abs(palette.accent.h - expectedAccentHue);
      expect(diff < 5 || diff > 355).toBe(true);
    });
    
    it('RGB primary debe ser naranja/amarillo cálido', () => {
      const rgb = hslToRgb(palette.primary);
      // Naranja: R > G > B
      expect(rgb.r).toBeGreaterThan(rgb.b);
      expect(rgb.g).toBeGreaterThan(rgb.b);
    });
  });
  
  // ============================================================
  // TESTS DE UTILIDADES
  // ============================================================
  
  describe('Utilidades', () => {
    
    it('hslToRgb debe convertir correctamente rojo puro', () => {
      const rgb = hslToRgb({ h: 0, s: 100, l: 50 });
      expect(rgb.r).toBe(255);
      expect(rgb.g).toBe(0);
      expect(rgb.b).toBe(0);
    });
    
    it('hslToRgb debe convertir correctamente verde puro', () => {
      const rgb = hslToRgb({ h: 120, s: 100, l: 50 });
      expect(rgb.r).toBe(0);
      expect(rgb.g).toBe(255);
      expect(rgb.b).toBe(0);
    });
    
    it('hslToRgb debe convertir correctamente azul puro', () => {
      const rgb = hslToRgb({ h: 240, s: 100, l: 50 });
      expect(rgb.r).toBe(0);
      expect(rgb.g).toBe(0);
      expect(rgb.b).toBe(255);
    });
    
    it('hslToRgb debe manejar saturación 0 (gris)', () => {
      const rgb = hslToRgb({ h: 180, s: 0, l: 50 });
      expect(rgb.r).toBe(rgb.g);
      expect(rgb.g).toBe(rgb.b);
      expect(rgb.r).toBe(128); // 50% gris
    });
    
  });
  
  // ============================================================
  // TESTS DE CONSTANTES
  // ============================================================
  
  describe('Constantes KEY_TO_HUE', () => {
    
    it('C debe mapear a 0° (rojo)', () => {
      expect(KEY_TO_HUE['C']).toBe(0);
    });
    
    it('A debe mapear a 270° (índigo)', () => {
      expect(KEY_TO_HUE['A']).toBe(270);
    });
    
    it('D debe mapear a 60° (naranja)', () => {
      expect(KEY_TO_HUE['D']).toBe(60);
    });
    
    it('F# y Gb deben ser equivalentes (180°)', () => {
      expect(KEY_TO_HUE['F#']).toBe(KEY_TO_HUE['Gb']);
    });
    
  });
  
  describe('Macro-Géneros', () => {
    
    it('debe tener 5 macro-géneros definidos', () => {
      expect(Object.keys(MACRO_GENRES)).toHaveLength(5);
    });
    
    it('ELECTRONIC_4X4 debe ser frío (tempBias negativo)', () => {
      expect(MACRO_GENRES['ELECTRONIC_4X4'].tempBias).toBeLessThan(0);
    });
    
    it('LATINO_TRADICIONAL debe ser cálido (tempBias positivo)', () => {
      expect(MACRO_GENRES['LATINO_TRADICIONAL'].tempBias).toBeGreaterThan(0);
    });
    
    it('ELECTROLATINO debe ser neutro (tempBias = 0)', () => {
      expect(MACRO_GENRES['ELECTROLATINO'].tempBias).toBe(0);
    });
    
  });
  
  // ============================================================
  // TESTS DE MÉTODOS ESTÁTICOS
  // ============================================================
  
  describe('Métodos estáticos', () => {
    
    it('mapToMacroGenre debe mapear techno → ELECTRONIC_4X4', () => {
      expect(SeleneColorEngine.mapToMacroGenre('techno')).toBe('ELECTRONIC_4X4');
    });
    
    it('mapToMacroGenre debe mapear cumbia → LATINO_TRADICIONAL', () => {
      expect(SeleneColorEngine.mapToMacroGenre('cumbia')).toBe('LATINO_TRADICIONAL');
    });
    
    it('mapToMacroGenre debe retornar ELECTROLATINO para género desconocido', () => {
      expect(SeleneColorEngine.mapToMacroGenre('random_genre_123')).toBe('ELECTROLATINO');
    });
    
    it('generateRgb debe retornar colores RGB válidos', () => {
      const result = SeleneColorEngine.generateRgb({
        energy: 0.5,
        wave8: {
          harmony: { key: 'C', mode: 'major', mood: 'happy' },
          rhythm: { syncopation: 0.3 },
          genre: { primary: 'pop' },
          section: { type: 'chorus' },
        },
      });
      
      expect(result.primary.r).toBeGreaterThanOrEqual(0);
      expect(result.primary.r).toBeLessThanOrEqual(255);
      expect(result.meta).toBeDefined();
    });
    
    it('getMacroGenres debe retornar 5 géneros', () => {
      expect(SeleneColorEngine.getMacroGenres()).toHaveLength(5);
    });
    
    it('getKeyHue debe retornar undefined para key inválida', () => {
      expect(SeleneColorEngine.getKeyHue('Z')).toBeUndefined();
    });
    
  });
  
  // ============================================================
  // EDGE CASES
  // ============================================================
  
  describe('Edge Cases', () => {
    
    it('debe manejar input mínimo (solo energy)', () => {
      const palette = SeleneColorEngine.generate({ energy: 0.5 });
      expect(palette.primary).toBeDefined();
      expect(palette.meta.macroGenre).toBe('ELECTROLATINO');
    });
    
    it('debe manejar energy fuera de rango (clamp)', () => {
      const palette1 = SeleneColorEngine.generate({ energy: -0.5 });
      const palette2 = SeleneColorEngine.generate({ energy: 1.5 });
      
      // No debe crashear, saturación/brillo deben estar en rango
      expect(palette1.primary.s).toBeGreaterThanOrEqual(0);
      expect(palette2.primary.s).toBeLessThanOrEqual(100);
    });
    
    it('debe manejar wave8 vacío gracefully', () => {
      const palette = SeleneColorEngine.generate({ 
        energy: 0.5,
        wave8: undefined,
      });
      expect(palette).toBeDefined();
      expect(palette.meta.macroGenre).toBeDefined();
    });
    
    it('debe usar top-level key si wave8.harmony.key es null', () => {
      const palette = SeleneColorEngine.generate({
        energy: 0.5,
        key: 'G',  // Top-level
        wave8: {
          harmony: { key: null, mode: 'major', mood: 'happy' },
          rhythm: { syncopation: 0.3 },
          genre: { primary: 'pop' },
          section: { type: 'verse' },
        },
      });
      
      // G = 210°, major = +15° = 225° (cyan area)
      expect(palette.primary.h).toBeGreaterThanOrEqual(200);
      expect(palette.primary.h).toBeLessThanOrEqual(240);
    });
    
  });
  
});

*/

// 🎨 WAVE 68.5: Tests nuevos para matemática musical PURA
// TODO: Implementar tests para validar:
// - KEY_TO_HUE mapping correcto
// - MODE_MODIFIERS aplicados correctamente
// - Energy → Saturation/Lightness
// - Syncopation → Strategy (analogous/triadic/complementary)
// - Sin bias de género - solo matemática
