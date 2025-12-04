/**
 * 🎨 PROCEDURAL PALETTE GENERATOR - TESTS
 * ========================================
 * Tests para el generador de paletas cromáticas procedurales
 * 
 * CASOS CRÍTICOS:
 * - Círculo de Quintas → Hue correcto
 * - Modos → Temperatura emocional correcta
 * - Energía → Estrategia de color correcta
 * - Sincopación → Saturación del secundario
 * 
 * @test ProceduralPaletteGenerator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ProceduralPaletteGenerator,
  createProceduralPaletteGenerator,
  hslToRgb,
  hslToHex,
  CONSTANTS,
  SelenePalette,
  HSLColor,
} from '../ProceduralPaletteGenerator';

describe('🎨 ProceduralPaletteGenerator', () => {
  let generator: ProceduralPaletteGenerator;

  beforeEach(() => {
    generator = new ProceduralPaletteGenerator();
  });

  // ==========================================================
  // INSTANCIACIÓN
  // ==========================================================

  describe('Instanciación', () => {
    it('se instancia correctamente', () => {
      expect(generator).toBeInstanceOf(ProceduralPaletteGenerator);
    });

    it('factory function funciona', () => {
      const gen = createProceduralPaletteGenerator();
      expect(gen).toBeInstanceOf(ProceduralPaletteGenerator);
    });

    it('inicia con contador en 0', () => {
      expect(generator.getGenerationCount()).toBe(0);
    });

    it('no tiene paleta inicial', () => {
      expect(generator.getLastPalette()).toBeNull();
    });
  });

  // ==========================================================
  // CÍRCULO DE QUINTAS CROMÁTICO
  // ==========================================================

  describe('Círculo de Quintas Cromático', () => {
    it('C (Do) → Rojo (~0-15°)', () => {
      const hue = generator.keyToHue('C');
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThanOrEqual(15);
    });

    it('D (Re) → Naranja (~60°)', () => {
      const hue = generator.keyToHue('D');
      expect(hue).toBe(60);
    });

    it('E (Mi) → Amarillo (~120°)', () => {
      const hue = generator.keyToHue('E');
      expect(hue).toBe(120);
    });

    it('G (Sol) → Cyan (~210°)', () => {
      const hue = generator.keyToHue('G');
      expect(hue).toBe(210);
    });

    it('A (La) → Índigo (~270°)', () => {
      const hue = generator.keyToHue('A');
      expect(hue).toBe(270);
    });

    it('F# (Fa#) → Verde (~180°)', () => {
      const hue = generator.keyToHue('F#');
      expect(hue).toBe(180);
    });

    it('Bb → Violeta (~300°)', () => {
      const hue = generator.keyToHue('Bb');
      expect(hue).toBe(300);
    });

    it('key null → hue basado en tiempo', () => {
      const hue = generator.keyToHue(null);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    });
  });

  // ==========================================================
  // MODIFICADORES DE MODO
  // ==========================================================

  describe('Modificadores de Modo', () => {
    it('major → saturación positiva', () => {
      const modifier = generator.getModeModifier('major');
      expect(modifier.saturationDelta).toBeGreaterThan(0);
    });

    it('minor → saturación negativa', () => {
      const modifier = generator.getModeModifier('minor');
      expect(modifier.saturationDelta).toBeLessThan(0);
    });

    it('lydian → máximo brillo (soñador)', () => {
      const modifier = generator.getModeModifier('lydian');
      expect(modifier.lightnessDelta).toBeGreaterThanOrEqual(15);
    });

    it('locrian → mínimo brillo (oscuro)', () => {
      const modifier = generator.getModeModifier('locrian');
      expect(modifier.lightnessDelta).toBeLessThan(0);
    });

    it('phrygian → hue shift negativo (español/tenso)', () => {
      const modifier = generator.getModeModifier('phrygian');
      expect(modifier.hueDelta).toBeLessThan(0);
    });

    it('modo desconocido → usar major por defecto', () => {
      const modifier = generator.getModeModifier('unknown_mode');
      const majorModifier = generator.getModeModifier('major');
      expect(modifier).toEqual(majorModifier);
    });
  });

  // ==========================================================
  // ESTRATEGIA DE COLOR SECUNDARIO
  // ==========================================================

  describe('Estrategia de Color (Energía)', () => {
    it('baja energía (< 0.3) → análogos', () => {
      const strategy = generator.calculateColorStrategy(0.2);
      expect(strategy).toBe('analogous');
    });

    it('energía media (0.3-0.6) → triádicos', () => {
      const strategy = generator.calculateColorStrategy(0.5);
      expect(strategy).toBe('triadic');
    });

    it('alta energía (> 0.6) → complementarios', () => {
      const strategy = generator.calculateColorStrategy(0.8);
      expect(strategy).toBe('complementary');
    });

    it('energía en límite inferior → análogos', () => {
      const strategy = generator.calculateColorStrategy(0.0);
      expect(strategy).toBe('analogous');
    });

    it('energía en límite superior → complementarios', () => {
      const strategy = generator.calculateColorStrategy(1.0);
      expect(strategy).toBe('complementary');
    });
  });

  // ==========================================================
  // GENERACIÓN DE PALETA COMPLETA
  // ==========================================================

  describe('Generación de Paleta', () => {
    it('genera paleta con 5 colores', () => {
      const palette = generator.generatePalette({ key: 'C', mode: 'major' });
      
      expect(palette.primary).toBeDefined();
      expect(palette.secondary).toBeDefined();
      expect(palette.accent).toBeDefined();
      expect(palette.ambient).toBeDefined();
      expect(palette.contrast).toBeDefined();
    });

    it('genera paleta con metadata', () => {
      const palette = generator.generatePalette({ key: 'A', mode: 'minor' });
      
      expect(palette.metadata).toBeDefined();
      expect(palette.metadata.generatedAt).toBeGreaterThan(0);
      expect(palette.metadata.musicalDNA).toBeDefined();
      expect(palette.metadata.confidence).toBeGreaterThanOrEqual(0);
      expect(palette.metadata.transitionSpeed).toBeGreaterThan(0);
    });

    it('colores están en rango válido HSL', () => {
      const palette = generator.generatePalette();
      
      const validateHSL = (color: HSLColor) => {
        expect(color.h).toBeGreaterThanOrEqual(0);
        expect(color.h).toBeLessThan(360);
        expect(color.s).toBeGreaterThanOrEqual(0);
        expect(color.s).toBeLessThanOrEqual(100);
        expect(color.l).toBeGreaterThanOrEqual(0);
        expect(color.l).toBeLessThanOrEqual(100);
      };
      
      validateHSL(palette.primary);
      validateHSL(palette.secondary);
      validateHSL(palette.accent);
      validateHSL(palette.ambient);
      validateHSL(palette.contrast);
    });

    it('accent es complementario del primary', () => {
      const palette = generator.generatePalette({ key: 'C', mode: 'major' });
      
      // Complementario = 180° de diferencia (±15° de tolerancia por modificadores)
      const hueDiff = Math.abs(palette.accent.h - palette.primary.h);
      const normalizedDiff = hueDiff > 180 ? 360 - hueDiff : hueDiff;
      
      expect(normalizedDiff).toBeGreaterThan(150);
      expect(normalizedDiff).toBeLessThan(210);
    });

    it('ambient es desaturado', () => {
      const palette = generator.generatePalette();
      
      expect(palette.ambient.s).toBeLessThan(palette.primary.s);
    });

    it('contrast es muy oscuro', () => {
      const palette = generator.generatePalette();
      
      expect(palette.contrast.l).toBeLessThan(20);
    });
  });

  // ==========================================================
  // CASOS PRÁCTICOS - CUMBIA VS REGGAETON
  // ==========================================================

  describe('Casos Prácticos', () => {
    it('Cumbia en G Mayor → paleta cálida', () => {
      const palette = generator.generatePalette({
        key: 'G',
        mode: 'major',
        energy: 0.55, // Energía media (< 0.6 para triadic)
        syncopation: 0.5,
      });
      
      // G = 210° (Cyan), Major shift +15° → ~225°
      // Con energía media (< 0.6), debe tener colores equilibrados (triadic)
      expect(palette.metadata.colorStrategy).toBe('triadic');
      expect(palette.primary.h).toBeGreaterThan(200);
      expect(palette.primary.h).toBeLessThan(250);
    });

    it('Cumbia en E Menor → paleta fría/melancólica', () => {
      const palette = generator.generatePalette({
        key: 'E',
        mode: 'minor',
        energy: 0.5,
        syncopation: 0.5,
      });
      
      // E = 120° (Amarillo), Minor shift -15° → ~105°
      // Minor = saturación reducida, brillo reducido
      expect(palette.primary.s).toBeLessThan(70);
      expect(palette.primary.l).toBeLessThan(50);
    });

    it('Reggaeton en A Menor (Bad Bunny) → índigo + complementarios', () => {
      const palette = generator.generatePalette({
        key: 'A',
        mode: 'minor',
        energy: 0.85,
        syncopation: 0.7,
      });
      
      // A = 270° (Índigo), alta energía = complementarios
      expect(palette.metadata.colorStrategy).toBe('complementary');
      expect(palette.primary.h).toBeGreaterThan(240);
      expect(palette.primary.h).toBeLessThan(290);
    });

    it('Techno en F# Menor → verde industrial', () => {
      const palette = generator.generatePalette({
        key: 'F#',
        mode: 'minor',
        energy: 0.75,
        syncopation: 0.1,  // Techno = baja sincopación
      });
      
      // F# = 180° (Verde), alta energía pero baja sincopación
      expect(palette.primary.h).toBeGreaterThan(150);
      expect(palette.primary.h).toBeLessThan(200);
      // Baja sincopación = secondary menos saturado
      expect(palette.secondary.s).toBeLessThan(90);
    });

    it('Pop en C Mayor → rojo vibrante', () => {
      const palette = generator.generatePalette({
        key: 'C',
        mode: 'major',
        energy: 0.7,
        syncopation: 0.4,
      });
      
      // C = 0° (Rojo), Major = saturado y brillante
      expect(palette.primary.h).toBeLessThan(30);
      expect(palette.primary.s).toBeGreaterThan(70);
    });
  });

  // ==========================================================
  // VARIACIONES POR SECCIÓN
  // ==========================================================

  describe('Variaciones por Sección', () => {
    let basePalette: SelenePalette;

    beforeEach(() => {
      basePalette = generator.generatePalette({ key: 'C', mode: 'major' });
    });

    it('intro → más oscuro', () => {
      const varied = generator.applySectionVariation(basePalette, 'intro');
      expect(varied.primary.l).toBeLessThan(basePalette.primary.l);
    });

    it('chorus → más brillante', () => {
      const varied = generator.applySectionVariation(basePalette, 'chorus');
      expect(varied.primary.l).toBeGreaterThan(basePalette.primary.l);
    });

    it('drop → máximo brillo', () => {
      const varied = generator.applySectionVariation(basePalette, 'drop');
      expect(varied.primary.l).toBeGreaterThan(basePalette.primary.l);
      expect(varied.secondary.l).toBeGreaterThan(basePalette.secondary.l);
    });

    it('outro → ambiente alto', () => {
      const varied = generator.applySectionVariation(basePalette, 'outro');
      // Ambient presence 0.8 = casi sin reducción
      expect(varied.ambient.l).toBeGreaterThan(0);
    });

    it('sección desconocida → sin cambios extremos', () => {
      const varied = generator.applySectionVariation(basePalette, 'unknown');
      // Diferencia mínima
      expect(Math.abs(varied.primary.l - basePalette.primary.l)).toBeLessThan(10);
    });
  });

  // ==========================================================
  // VELOCIDAD DE TRANSICIÓN
  // ==========================================================

  describe('Velocidad de Transición', () => {
    it('baja energía → transición lenta (~2000ms)', () => {
      const palette = generator.generatePalette({ energy: 0.1 });
      expect(palette.metadata.transitionSpeed).toBeGreaterThan(1500);
    });

    it('alta energía → transición rápida (~300ms)', () => {
      const palette = generator.generatePalette({ energy: 0.95 });
      expect(palette.metadata.transitionSpeed).toBeLessThan(500);
    });

    it('energía media → transición moderada', () => {
      const palette = generator.generatePalette({ energy: 0.5 });
      expect(palette.metadata.transitionSpeed).toBeGreaterThan(800);
      expect(palette.metadata.transitionSpeed).toBeLessThan(1500);
    });
  });

  // ==========================================================
  // CONVERSIÓN DE COLORES
  // ==========================================================

  describe('Conversión de Colores', () => {
    it('hslToRgb - rojo puro', () => {
      const rgb = hslToRgb({ h: 0, s: 100, l: 50 });
      expect(rgb.r).toBe(255);
      expect(rgb.g).toBe(0);
      expect(rgb.b).toBe(0);
    });

    it('hslToRgb - verde puro', () => {
      const rgb = hslToRgb({ h: 120, s: 100, l: 50 });
      expect(rgb.r).toBe(0);
      expect(rgb.g).toBe(255);
      expect(rgb.b).toBe(0);
    });

    it('hslToRgb - azul puro', () => {
      const rgb = hslToRgb({ h: 240, s: 100, l: 50 });
      expect(rgb.r).toBe(0);
      expect(rgb.g).toBe(0);
      expect(rgb.b).toBe(255);
    });

    it('hslToRgb - blanco', () => {
      const rgb = hslToRgb({ h: 0, s: 0, l: 100 });
      expect(rgb.r).toBe(255);
      expect(rgb.g).toBe(255);
      expect(rgb.b).toBe(255);
    });

    it('hslToRgb - negro', () => {
      const rgb = hslToRgb({ h: 0, s: 0, l: 0 });
      expect(rgb.r).toBe(0);
      expect(rgb.g).toBe(0);
      expect(rgb.b).toBe(0);
    });

    it('hslToHex - formato correcto', () => {
      const hex = hslToHex({ h: 0, s: 100, l: 50 });
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(hex.toLowerCase()).toBe('#ff0000');
    });

    it('paletteToHex - todas las claves', () => {
      const palette = generator.generatePalette();
      const hexPalette = generator.paletteToHex(palette);
      
      expect(hexPalette.primary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(hexPalette.secondary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(hexPalette.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(hexPalette.ambient).toMatch(/^#[0-9a-f]{6}$/i);
      expect(hexPalette.contrast).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  // ==========================================================
  // EVENTOS
  // ==========================================================

  describe('Eventos', () => {
    it('emite palette-generated al generar', () => {
      let emitted = false;
      generator.on('palette-generated', () => { emitted = true; });
      
      generator.generatePalette();
      
      expect(emitted).toBe(true);
    });

    it('emite palette-variation al aplicar sección', () => {
      let emitted = false;
      generator.on('palette-variation', () => { emitted = true; });
      
      const palette = generator.generatePalette();
      generator.applySectionVariation(palette, 'chorus');
      
      expect(emitted).toBe(true);
    });
  });

  // ==========================================================
  // ESTADÍSTICAS
  // ==========================================================

  describe('Estadísticas', () => {
    it('contador incrementa con cada generación', () => {
      expect(generator.getGenerationCount()).toBe(0);
      
      generator.generatePalette();
      expect(generator.getGenerationCount()).toBe(1);
      
      generator.generatePalette();
      expect(generator.getGenerationCount()).toBe(2);
    });

    it('getLastPalette retorna última paleta', () => {
      generator.generatePalette({ key: 'C' });
      generator.generatePalette({ key: 'A' });
      
      const last = generator.getLastPalette();
      expect(last?.metadata.musicalDNA.key).toBe('A');
    });

    it('reset limpia estado', () => {
      generator.generatePalette();
      generator.generatePalette();
      
      generator.reset();
      
      expect(generator.getGenerationCount()).toBe(0);
      expect(generator.getLastPalette()).toBeNull();
    });

    it('getStats retorna información correcta', () => {
      generator.generatePalette({ energy: 0.8 });
      
      const stats = generator.getStats();
      
      expect(stats.generationCount).toBe(1);
      expect(stats.lastPaletteAge).toBeGreaterThanOrEqual(0);
      expect(stats.lastStrategy).toBe('complementary');
    });
  });

  // ==========================================================
  // CONSTANTES EXPORTADAS
  // ==========================================================

  describe('Constantes', () => {
    it('KEY_TO_HUE tiene 12 notas naturales + alteraciones', () => {
      const keys = Object.keys(CONSTANTS.KEY_TO_HUE);
      expect(keys.length).toBeGreaterThanOrEqual(12);
    });

    it('MODE_MODIFIERS tiene modos principales', () => {
      const modes = Object.keys(CONSTANTS.MODE_MODIFIERS);
      expect(modes).toContain('major');
      expect(modes).toContain('minor');
      expect(modes).toContain('dorian');
      expect(modes).toContain('phrygian');
    });

    it('SECTION_VARIATIONS tiene secciones principales', () => {
      const sections = Object.keys(CONSTANTS.SECTION_VARIATIONS);
      expect(sections).toContain('intro');
      expect(sections).toContain('verse');
      expect(sections).toContain('chorus');
      expect(sections).toContain('drop');
      expect(sections).toContain('outro');
    });
  });
});
