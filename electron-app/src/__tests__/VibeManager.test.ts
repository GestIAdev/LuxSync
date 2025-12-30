/**
 * 🧪 WAVE 59: VIBE MANAGER TESTS
 * 
 * TDD - Test Driven Development
 * Estos tests DEBEN pasar antes de integrar con el sistema vivo.
 * 
 * Test Cases:
 * 1. Constraint Check: TechnoClub + festive mood → false
 * 2. Auto-Correction: FiestaLatina + 8000K → clamp to 5500K
 * 3. Dimmer Floor: ChillLounge nunca permite < 30%
 * 4. Identity: Cargar techno-club carga las reglas correctas
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VibeManager } from '../engine/vibe/VibeManager';
import {
  VIBE_TECHNO_CLUB,
  VIBE_FIESTA_LATINA,
  VIBE_CHILL_LOUNGE,
} from '../engines/context/presets';
import type { MoodType, ColorStrategy } from '../types/VibeProfile';

describe('🎛️ VibeManager', () => {
  let manager: VibeManager;

  beforeEach(() => {
    // Reset singleton before each test
    VibeManager.resetInstance();
    manager = VibeManager.getInstance();
  });

  afterEach(() => {
    VibeManager.resetInstance();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SINGLETON TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = VibeManager.getInstance();
      const instance2 = VibeManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = VibeManager.getInstance();
      VibeManager.resetInstance();
      const instance2 = VibeManager.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST CASE 1: CONSTRAINT CHECK
  // Si estoy en TechnoClub e intento pasar mood 'festive', validateMood → false
  // ═══════════════════════════════════════════════════════════════════════════

  describe('🎭 Mood Constraint Check', () => {
    it('TechnoClub should REJECT festive mood', () => {
      // Arrange
      manager.setActiveVibeImmediate('techno-club');
      
      // Act
      const isValid = manager.validateMood('festive');
      
      // Assert
      expect(isValid).toBe(false);
    });

    it('TechnoClub should REJECT playful mood', () => {
      manager.setActiveVibeImmediate('techno-club');
      expect(manager.validateMood('playful')).toBe(false);
    });

    it('TechnoClub should REJECT euphoric mood', () => {
      manager.setActiveVibeImmediate('techno-club');
      expect(manager.validateMood('euphoric')).toBe(false);
    });

    it('TechnoClub should ACCEPT dark mood', () => {
      manager.setActiveVibeImmediate('techno-club');
      expect(manager.validateMood('dark')).toBe(true);
    });

    it('TechnoClub should ACCEPT dramatic mood', () => {
      manager.setActiveVibeImmediate('techno-club');
      expect(manager.validateMood('dramatic')).toBe(true);
    });

    it('TechnoClub should ACCEPT tense mood', () => {
      manager.setActiveVibeImmediate('techno-club');
      expect(manager.validateMood('tense')).toBe(true);
    });

    it('FiestaLatina should REJECT dark mood', () => {
      manager.setActiveVibeImmediate('fiesta-latina');
      expect(manager.validateMood('dark')).toBe(false);
    });

    it('FiestaLatina should REJECT tense mood', () => {
      manager.setActiveVibeImmediate('fiesta-latina');
      expect(manager.validateMood('tense')).toBe(false);
    });

    it('FiestaLatina should ACCEPT festive mood', () => {
      manager.setActiveVibeImmediate('fiesta-latina');
      expect(manager.validateMood('festive')).toBe(true);
    });

    it('ChillLounge should REJECT aggressive mood', () => {
      manager.setActiveVibeImmediate('chill-lounge');
      expect(manager.validateMood('aggressive')).toBe(false);
    });

    it('ChillLounge should REJECT energetic mood', () => {
      manager.setActiveVibeImmediate('chill-lounge');
      expect(manager.validateMood('energetic')).toBe(false);
    });

    it('ChillLounge should ACCEPT calm mood', () => {
      manager.setActiveVibeImmediate('chill-lounge');
      expect(manager.validateMood('calm')).toBe(true);
    });

    it('ChillLounge should ACCEPT peaceful mood', () => {
      manager.setActiveVibeImmediate('chill-lounge');
      expect(manager.validateMood('peaceful')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST CASE 2: AUTO-CORRECTION
  // Si estoy en FiestaLatina (maxTemp 5500K) y pido 8000K, constrainColor → 5500K
  // ═══════════════════════════════════════════════════════════════════════════

  describe('🎨 Color Auto-Correction', () => {
    it('FiestaLatina should clamp temperature 8000K → 5500K (max)', () => {
      // Arrange
      manager.setActiveVibeImmediate('fiesta-latina');
      
      // Act
      const result = manager.constrainColor({
        temperature: 8000,  // Above max (5500)
        saturation: 0.8,
      });
      
      // Assert
      expect(result.temperature).toBe(5500);
      expect(result.wasConstrained).toBe(true);
      expect(result.constraintDetails?.temperatureClamped).toBe(true);
    });

    it('FiestaLatina should clamp temperature 1000K → 2500K (min)', () => {
      manager.setActiveVibeImmediate('fiesta-latina');
      
      const result = manager.constrainColor({
        temperature: 1000,  // Below min (2500)
        saturation: 0.8,
      });
      
      expect(result.temperature).toBe(2500);
      expect(result.wasConstrained).toBe(true);
    });

    it('FiestaLatina should clamp saturation 0.3 → 0.65 (min)', () => {
      manager.setActiveVibeImmediate('fiesta-latina');
      
      const result = manager.constrainColor({
        temperature: 3000,
        saturation: 0.3,  // Below min (0.65)
      });
      
      expect(result.saturation).toBe(0.65);
      expect(result.wasConstrained).toBe(true);
      expect(result.constraintDetails?.saturationClamped).toBe(true);
    });

    it('FiestaLatina should NOT constrain valid values', () => {
      manager.setActiveVibeImmediate('fiesta-latina');
      
      const result = manager.constrainColor({
        temperature: 4000,  // Within range
        saturation: 0.8,    // Within range
      });
      
      expect(result.temperature).toBe(4000);
      expect(result.saturation).toBe(0.8);
      expect(result.wasConstrained).toBe(false);
    });

    it('TechnoClub should clamp warm temperature 2000K → 4000K (min)', () => {
      manager.setActiveVibeImmediate('techno-club');
      
      const result = manager.constrainColor({
        temperature: 2000,  // Below min (4000 for techno)
        saturation: 0.5,
      });
      
      expect(result.temperature).toBe(4000);
    });

    it('TechnoClub should reject triadic strategy and use monochromatic', () => {
      manager.setActiveVibeImmediate('techno-club');
      
      const result = manager.constrainColor({
        temperature: 6000,
        saturation: 0.5,
        strategy: 'triadic',  // Not allowed in techno
      });
      
      expect(result.strategy).toBe('monochromatic');  // First allowed
      expect(result.wasConstrained).toBe(true);
      expect(result.constraintDetails?.strategyChanged).toBe(true);
    });

    it('ChillLounge should clamp high saturation 0.9 → 0.7 (max)', () => {
      manager.setActiveVibeImmediate('chill-lounge');
      
      const result = manager.constrainColor({
        temperature: 4000,
        saturation: 0.9,  // Above max (0.7)
      });
      
      expect(result.saturation).toBe(0.7);
    });

    it('ChillLounge should reject complementary strategy', () => {
      manager.setActiveVibeImmediate('chill-lounge');
      
      const result = manager.constrainColor({
        temperature: 4000,
        saturation: 0.5,
        strategy: 'complementary',  // Not allowed
      });
      
      expect(result.strategy).toBe('analogous');  // First allowed
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST CASE 3: DIMMER FLOOR
  // ChillLounge nunca debe permitir bajar del 30%
  // ═══════════════════════════════════════════════════════════════════════════

  describe('💡 Dimmer Floor Enforcement', () => {
    it('ChillLounge should have 30% dimmer floor', () => {
      manager.setActiveVibeImmediate('chill-lounge');
      
      const floor = manager.getDimmerFloor();
      
      expect(floor).toBe(0.30);
    });

    it('ChillLounge should clamp 0% → 30%', () => {
      manager.setActiveVibeImmediate('chill-lounge');
      
      const constrained = manager.constrainDimmer(0);
      
      expect(constrained).toBe(0.30);
    });

    it('ChillLounge should clamp 10% → 30%', () => {
      manager.setActiveVibeImmediate('chill-lounge');
      
      const constrained = manager.constrainDimmer(0.10);
      
      expect(constrained).toBe(0.30);
    });

    it('ChillLounge should clamp 25% → 30%', () => {
      manager.setActiveVibeImmediate('chill-lounge');
      
      const constrained = manager.constrainDimmer(0.25);
      
      expect(constrained).toBe(0.30);
    });

    it('ChillLounge should allow 50% unchanged', () => {
      manager.setActiveVibeImmediate('chill-lounge');
      
      const constrained = manager.constrainDimmer(0.50);
      
      expect(constrained).toBe(0.50);
    });

    it('ChillLounge should clamp 90% → 75% (ceiling)', () => {
      manager.setActiveVibeImmediate('chill-lounge');
      
      const constrained = manager.constrainDimmer(0.90);
      
      expect(constrained).toBe(0.75);  // ChillLounge ceiling
    });

    it('TechnoClub should have 5% dimmer floor', () => {
      manager.setActiveVibeImmediate('techno-club');
      
      expect(manager.getDimmerFloor()).toBe(0.05);
    });

    it('TechnoClub should allow blackout (0%)', () => {
      manager.setActiveVibeImmediate('techno-club');
      
      // TechnoClub allows blackout
      expect(manager.isBlackoutAllowed()).toBe(true);
      
      // But floor is 5%, so 0% should clamp to 5% unless explicit blackout
      const constrained = manager.constrainDimmer(0);
      expect(constrained).toBe(0);  // Blackout allowed
    });

    it('FiestaLatina should have 25% dimmer floor', () => {
      manager.setActiveVibeImmediate('fiesta-latina');
      
      expect(manager.getDimmerFloor()).toBe(0.25);
    });

    it('FiestaLatina should NOT allow blackout', () => {
      manager.setActiveVibeImmediate('fiesta-latina');
      
      expect(manager.isBlackoutAllowed()).toBe(false);
      
      // Even requesting 0%, should get floor
      const constrained = manager.constrainDimmer(0);
      expect(constrained).toBe(0.25);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST CASE 4: IDENTITY - Cargar preset techno-club carga reglas correctas
  // ═══════════════════════════════════════════════════════════════════════════

  describe('🆔 Preset Identity Verification', () => {
    it('should load techno-club with correct ID', () => {
      manager.setActiveVibeImmediate('techno-club');
      
      const vibe = manager.getActiveVibe();
      
      expect(vibe.id).toBe('techno-club');
      expect(vibe.name).toBe('Techno Club');
      expect(vibe.icon).toBe('🏭');
    });

    it('techno-club should have correct mood constraints', () => {
      manager.setActiveVibeImmediate('techno-club');
      
      const vibe = manager.getActiveVibe();
      
      // Verify allowed moods match preset
      expect(vibe.mood.allowed).toContain('dark');
      expect(vibe.mood.allowed).toContain('dramatic');
      expect(vibe.mood.allowed).toContain('tense');
      expect(vibe.mood.allowed).not.toContain('festive');
      expect(vibe.mood.allowed).not.toContain('playful');
      expect(vibe.mood.fallback).toBe('dark');
    });

    it('techno-club should have correct color constraints', () => {
      manager.setActiveVibeImmediate('techno-club');
      
      const vibe = manager.getActiveVibe();
      
      expect(vibe.color.temperature.min).toBe(4000);
      expect(vibe.color.temperature.max).toBe(9000);
      expect(vibe.color.strategies).toContain('monochromatic');
      expect(vibe.color.strategies).not.toContain('triadic');
    });

    it('techno-club should have correct dimmer constraints', () => {
      manager.setActiveVibeImmediate('techno-club');
      
      const vibe = manager.getActiveVibe();
      
      expect(vibe.dimmer.floor).toBe(0.05);
      expect(vibe.dimmer.ceiling).toBe(1.0);
      expect(vibe.dimmer.allowBlackout).toBe(true);
    });

    it('fiesta-latina should have correct constraints', () => {
      manager.setActiveVibeImmediate('fiesta-latina');
      
      const vibe = manager.getActiveVibe();
      
      expect(vibe.id).toBe('fiesta-latina');
      expect(vibe.mood.allowed).toContain('festive');
      expect(vibe.mood.allowed).not.toContain('dark');
      expect(vibe.color.temperature.min).toBe(2500);
      expect(vibe.color.temperature.max).toBe(5500);
      expect(vibe.dimmer.allowBlackout).toBe(false);
    });

    it('chill-lounge should have correct constraints', () => {
      manager.setActiveVibeImmediate('chill-lounge');
      
      const vibe = manager.getActiveVibe();
      
      expect(vibe.id).toBe('chill-lounge');
      expect(vibe.mood.allowed).toContain('calm');
      expect(vibe.mood.allowed).toContain('peaceful');
      expect(vibe.mood.allowed).not.toContain('energetic');
      expect(vibe.dimmer.floor).toBe(0.30);
      expect(vibe.effects.maxStrobeRate).toBe(0);  // No strobe
    });

    it('pop-rock should be default vibe', () => {
      // Fresh manager without explicit vibe set
      const vibe = manager.getActiveVibe();
      
      expect(vibe.id).toBe('pop-rock');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VIBE SWITCHING TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('🔄 Vibe Switching', () => {
    it('should switch vibe correctly', () => {
      manager.setActiveVibeImmediate('techno-club');
      expect(manager.getActiveVibe().id).toBe('techno-club');
      
      manager.setActiveVibeImmediate('fiesta-latina');
      expect(manager.getActiveVibe().id).toBe('fiesta-latina');
    });

    it('should reject invalid vibe ID', () => {
      const result = manager.setActiveVibeImmediate('invalid-vibe' as any);
      
      expect(result).toBe(false);
    });

    it('should start transition when using setActiveVibe', () => {
      manager.setActiveVibeImmediate('techno-club');
      
      const changed = manager.setActiveVibe('fiesta-latina', 0);
      
      expect(changed).toBe(true);
      expect(manager.isTransitioning()).toBe(true);
    });

    it('should complete transition after duration', () => {
      manager.setActiveVibeImmediate('techno-club');
      manager.setActiveVibe('fiesta-latina', 0);
      
      // Simulate 180 frames (default transition duration)
      manager.updateTransition(180);
      
      expect(manager.isTransitioning()).toBe(false);
      expect(manager.getActiveVibe().id).toBe('fiesta-latina');
    });

    it('should return false when setting same vibe', () => {
      manager.setActiveVibeImmediate('techno-club');
      
      const result = manager.setActiveVibe('techno-club');
      
      expect(result).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MOOD CONSTRAINT WITH SUGGESTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('🎭 Mood Constraint with Suggestion', () => {
    it('should suggest alternative for prohibited mood', () => {
      manager.setActiveVibeImmediate('techno-club');
      
      const validation = manager.getMoodValidation('festive');
      
      expect(validation.isValid).toBe(false);
      expect(validation.suggestedAlternative).toBeDefined();
      // festive proxies: playful, euphoric, energetic
      // TechnoClub allows: dark, dramatic, tense, calm, energetic
      // Expected suggestion: energetic (in both lists)
      expect(validation.suggestedAlternative).toBe('energetic');
    });

    it('constrainMood should return constrained mood', () => {
      manager.setActiveVibeImmediate('techno-club');
      
      const constrained = manager.constrainMood('festive');
      
      // Should return closest allowed (energetic) or fallback (dark)
      expect(['energetic', 'dark']).toContain(constrained);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DROP CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('⚡ Drop Constraints', () => {
    it('ChillLounge should have very low drop sensitivity', () => {
      manager.setActiveVibeImmediate('chill-lounge');
      
      const constraints = manager.getDropConstraints();
      
      expect(constraints.sensitivity).toBe(0.2);
      expect(constraints.timing.cooldownFrames).toBe(600);  // 10s
    });

    it('FiestaLatina should have high drop sensitivity', () => {
      manager.setActiveVibeImmediate('fiesta-latina');
      
      const constraints = manager.getDropConstraints();
      
      expect(constraints.sensitivity).toBe(0.8);
      expect(constraints.allowMicroDrops).toBe(true);
    });

    it('should respect cooldown in isDropAllowed', () => {
      manager.setActiveVibeImmediate('techno-club');
      
      // Cooldown is 240 frames (4s)
      // Just after drop, should not allow
      const allowed = manager.isDropAllowed(0.9, 0.5, 100);  // Only 100 frames since last
      
      expect(allowed).toBe(false);
    });

    it('should allow drop after cooldown', () => {
      manager.setActiveVibeImmediate('techno-club');
      
      // Energy spike: current 0.9, smoothed 0.5 → delta 0.4
      // Threshold: 0.18 * 0.6 = 0.108
      // 0.4 > 0.108 → should allow
      const allowed = manager.isDropAllowed(0.9, 0.5, 500);  // After cooldown
      
      expect(allowed).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECTS CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('✨ Effects Constraints', () => {
    it('ChillLounge should NOT allow strobe', () => {
      manager.setActiveVibeImmediate('chill-lounge');
      
      expect(manager.isEffectAllowed('strobe')).toBe(false);
      expect(manager.getMaxStrobeRate()).toBe(0);
    });

    it('TechnoClub should allow strobe at max 12Hz', () => {
      manager.setActiveVibeImmediate('techno-club');
      
      expect(manager.isEffectAllowed('strobe')).toBe(true);
      expect(manager.getMaxStrobeRate()).toBe(12);
    });

    it('ChillLounge should only allow fog', () => {
      manager.setActiveVibeImmediate('chill-lounge');
      
      expect(manager.isEffectAllowed('fog')).toBe(true);
      expect(manager.isEffectAllowed('laser')).toBe(false);
      expect(manager.isEffectAllowed('beam')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DEBUG INFO
  // ═══════════════════════════════════════════════════════════════════════════

  describe('🔍 Debug Info', () => {
    it('should provide accurate debug info', () => {
      manager.setActiveVibeImmediate('techno-club');
      
      const debug = manager.getDebugInfo();
      
      expect(debug.activeVibe).toBe('techno-club');
      expect(debug.isTransitioning).toBe(false);
      expect(debug.constraints.allowedMoods).toEqual(VIBE_TECHNO_CLUB.mood.allowed);
      expect(debug.constraints.dimmerFloor).toBe(0.05);
    });
  });
});
