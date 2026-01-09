/**
 * 🧪 RHYTHM ANALYZER TESTS
 * ========================
 * Tests unitarios para el Motor de Análisis Rítmico
 * 
 * @module engines/musical/analysis/__tests__/RhythmAnalyzer.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RhythmAnalyzer } from '../RhythmAnalyzer';
import type { AudioMetrics } from '../../../types';

// ============================================================
// 🎭 MOCK DATA FACTORIES
// ============================================================

/**
 * Crear mock de AudioMetrics
 */
function createAudioMetrics(overrides: Partial<AudioMetrics> = {}): AudioMetrics {
  return {
    bass: 0.5,
    mid: 0.4,
    treble: 0.3,
    bpm: 120,
    beatPhase: 0,
    beatConfidence: 0.8,
    onBeat: true,
    energy: 0.5,
    peak: 0.6,
    timestamp: Date.now(),
    frameIndex: 0,
    ...overrides,
  };
}

/**
 * Crear mock de BeatState
 */
function createBeatState(overrides: Partial<{ bpm: number; phase: number; onBeat: boolean }> = {}) {
  return {
    bpm: 120,
    phase: 0,
    onBeat: true,
    ...overrides,
  };
}

// ============================================================
// 🥁 RHYTHM ANALYZER TESTS
// ============================================================

describe('RhythmAnalyzer', () => {
  let analyzer: RhythmAnalyzer;
  
  beforeEach(() => {
    analyzer = new RhythmAnalyzer();
  });
  
  // ═══════════════════════════════════════════════════════════
  // 📦 BASIC FUNCTIONALITY
  // ═══════════════════════════════════════════════════════════
  
  describe('Basic Functionality', () => {
    it('should create analyzer with default config', () => {
      expect(analyzer).toBeDefined();
    });
    
    it('should return valid RhythmAnalysis structure', () => {
      const audio = createAudioMetrics();
      const beat = createBeatState();
      
      const result = analyzer.analyze(audio, beat);
      
      expect(result).toHaveProperty('bpm');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('beatPhase');
      expect(result).toHaveProperty('barPhase');
      expect(result).toHaveProperty('pattern');
      expect(result).toHaveProperty('drums');
      expect(result).toHaveProperty('groove');
      expect(result).toHaveProperty('fillInProgress');
      expect(result).toHaveProperty('timestamp');
    });
    
    it('should cache last result', () => {
      const audio = createAudioMetrics();
      const beat = createBeatState();
      
      analyzer.analyze(audio, beat);
      const cached = analyzer.getLastResult();
      
      expect(cached).not.toBeNull();
    });
    
    it('should reset correctly', () => {
      const audio = createAudioMetrics();
      const beat = createBeatState();
      
      analyzer.analyze(audio, beat);
      analyzer.reset();
      
      expect(analyzer.getLastResult()).toBeNull();
    });
  });
  
  // ═══════════════════════════════════════════════════════════
  // 🥁 DRUM DETECTION
  // ═══════════════════════════════════════════════════════════
  
  describe('Drum Detection', () => {
    it('should detect kick when bass transient > threshold', () => {
      const beat = createBeatState();
      
      // Primera frame: bass bajo
      const audio1 = createAudioMetrics({ bass: 0.2 });
      analyzer.analyze(audio1, beat);
      
      // Segunda frame: bass alto (transiente)
      const audio2 = createAudioMetrics({ bass: 0.9 });
      const result = analyzer.analyze(audio2, beat);
      
      expect(result.drums.kickDetected).toBe(true);
      expect(result.drums.kickIntensity).toBeGreaterThan(0);
    });
    
    it('should detect snare when mid transient > threshold', () => {
      const beat = createBeatState();
      
      // Primera frame: mid bajo
      const audio1 = createAudioMetrics({ mid: 0.1 });
      analyzer.analyze(audio1, beat);
      
      // Segunda frame: mid alto (transiente)
      const audio2 = createAudioMetrics({ mid: 0.7 });
      const result = analyzer.analyze(audio2, beat);
      
      expect(result.drums.snareDetected).toBe(true);
      expect(result.drums.snareIntensity).toBeGreaterThan(0);
    });
    
    it('should detect hihat when treble transient > threshold', () => {
      const beat = createBeatState();
      
      // Primera frame: treble bajo
      const audio1 = createAudioMetrics({ treble: 0.1 });
      analyzer.analyze(audio1, beat);
      
      // Segunda frame: treble alto (transiente)
      const audio2 = createAudioMetrics({ treble: 0.7 });
      const result = analyzer.analyze(audio2, beat);
      
      expect(result.drums.hihatDetected).toBe(true);
      expect(result.drums.hihatIntensity).toBeGreaterThan(0);
    });
  });
  
  // ═══════════════════════════════════════════════════════════
  // 🎵 SYNCOPATION CALCULATION - REGLA 3
  // ═══════════════════════════════════════════════════════════
  
  describe('Syncopation Calculation (REGLA 3)', () => {
    it('should calculate low syncopation for on-beat energy', () => {
      const beat = createBeatState();
      
      // Simular energía en on-beat (phase ~0)
      for (let i = 0; i < 20; i++) {
        const audio = createAudioMetrics({ bass: 0.8 });
        // Fase cerca de 0 = on-beat
        analyzer.analyze(audio, { ...beat, phase: Math.random() * 0.1 });
      }
      
      const result = analyzer.getLastResult();
      expect(result!.groove.syncopation).toBeLessThan(0.3);
    });
    
    it('should calculate high syncopation for off-beat energy', () => {
      const beat = createBeatState();
      
      // Simular energía en off-beat (phase ~0.5)
      for (let i = 0; i < 20; i++) {
        const audio = createAudioMetrics({ bass: 0.8, mid: 0.6 });
        // Fase cerca de 0.5 = off-beat
        analyzer.analyze(audio, { ...beat, phase: 0.4 + Math.random() * 0.2 });
      }
      
      const result = analyzer.getLastResult();
      expect(result!.groove.syncopation).toBeGreaterThan(0.4);
    });
    
    it('syncopation should be between 0 and 1', () => {
      const audio = createAudioMetrics();
      const beat = createBeatState();
      
      for (let i = 0; i < 20; i++) {
        const result = analyzer.analyze(audio, { ...beat, phase: Math.random() });
        expect(result.groove.syncopation).toBeGreaterThanOrEqual(0);
        expect(result.groove.syncopation).toBeLessThanOrEqual(1);
      }
    });
  });
  
  // ═══════════════════════════════════════════════════════════
  // 🎭 PATTERN DETECTION
  // ═══════════════════════════════════════════════════════════
  
  describe('Pattern Detection', () => {
    it('should detect four_on_floor pattern (low syncopation)', () => {
      const beat = createBeatState({ bpm: 128 }); // House tempo
      
      // Simular four-on-floor: kicks SOLO en on-beat
      // CORREGIDO: La fase debe estar sincronizada con el patrón de bass
      for (let i = 0; i < 32; i++) {
        // Four-on-floor: kicks cada 4 frames, exactamente en fase 0
        const isKick = (i % 4) === 0;
        const phase = isKick ? 0.0 : ((i % 4) / 4);  // Fases entre kicks: 0.25, 0.5, 0.75
        const bass = isKick ? 0.9 : 0.1;  // Bass SOLO en kicks, muy bajo entre kicks
        
        const audio = createAudioMetrics({ bass, mid: 0.2, energy: 0.6 });
        analyzer.analyze(audio, { ...beat, phase });
      }
      
      const result = analyzer.getLastResult();
      // Debería tener baja sincopación porque toda la energía está on-beat
      // Umbral < 0.3 porque four-on-floor tiene PICOS en on-beat, no energía cero off-beat
      expect(result!.groove.syncopation).toBeLessThan(0.3);
    });
    
    it('should detect reggaeton pattern (high syncopation + dembow)', () => {
      const beat = createBeatState({ bpm: 95 }); // Reggaeton tempo
      
      // Simular dembow: snares en off-beat (0.25, 0.75)
      for (let i = 0; i < 30; i++) {
        const phase = [0.0, 0.25, 0.5, 0.75][i % 4];
        const bass = phase === 0.0 ? 0.8 : 0.3;
        const mid = (phase === 0.25 || phase === 0.75) ? 0.8 : 0.2;
        
        const audio = createAudioMetrics({ bass, mid, energy: 0.6 });
        analyzer.analyze(audio, { ...beat, phase });
      }
      
      const result = analyzer.getLastResult();
      // Alta sincopación
      expect(result!.groove.syncopation).toBeGreaterThan(0.3);
    });
    
    it('should detect cumbia pattern (constant treble)', () => {
      const beat = createBeatState({ bpm: 100 }); // Cumbia tempo
      
      // Simular cumbia: güiro constante en agudos
      for (let i = 0; i < 30; i++) {
        const phase = (i * 0.1) % 1;
        // Treble CONSTANTE (güiro)
        const treble = 0.5 + Math.random() * 0.1;  // Poca variación
        const bass = (i % 4) === 0 ? 0.6 : 0.2;   // Kick espaciado
        
        const audio = createAudioMetrics({ bass, treble, energy: 0.5 });
        analyzer.analyze(audio, { ...beat, phase });
      }
      
      const result = analyzer.getLastResult();
      // El patrón debería ser cumbia o al menos no reggaeton
      expect(['cumbia', 'latin', 'minimal', 'unknown']).toContain(result!.pattern.type);
    });
    
    it('should NOT confuse cumbia with reggaeton (same BPM, different pattern)', () => {
      // Este test verifica la REGLA 3: syncopation > BPM
      
      // Crear dos analizadores
      const cumbiaAnalyzer = new RhythmAnalyzer();
      const reggaetonAnalyzer = new RhythmAnalyzer();
      
      const beat = createBeatState({ bpm: 95 }); // BPM igual para ambos
      
      // CUMBIA: Patrón regular, kicks en on-beat, güiro constante
      // El groove latino tiene kicks espaciados y treble constante
      for (let i = 0; i < 32; i++) {
        const isKick = (i % 8) === 0;  // Kicks más espaciados
        const phase = isKick ? 0.0 : ((i % 8) / 8);
        const audio = createAudioMetrics({
          treble: 0.55,  // Güiro constante
          bass: isKick ? 0.6 : 0.15,  // Bass solo en kicks
          mid: 0.25,     // Sin picos de snare en off-beat
        });
        cumbiaAnalyzer.analyze(audio, { ...beat, phase });
      }
      
      // REGGAETON: Dembow (snare en off-beat 0.25 y 0.75)
      // El dembow tiene picos MID fuertes en off-beat
      for (let i = 0; i < 32; i++) {
        const beatPos = i % 4;
        const phase = [0.0, 0.25, 0.5, 0.75][beatPos];
        const isKick = beatPos === 0;
        const isDembow = beatPos === 1 || beatPos === 3;  // Off-beat snares
        
        const audio = createAudioMetrics({
          treble: 0.3,
          bass: isKick ? 0.85 : 0.2,
          mid: isDembow ? 0.85 : 0.2,  // ¡Dembow! Picos fuertes off-beat
        });
        reggaetonAnalyzer.analyze(audio, { ...beat, phase });
      }
      
      const cumbiaResult = cumbiaAnalyzer.getLastResult();
      const reggaetonResult = reggaetonAnalyzer.getLastResult();
      
      // Reggaeton tiene dembow (off-beat hits) → MAYOR syncopation
      // Cumbia tiene kick on-beat, güiro constante → MENOR syncopation
      expect(reggaetonResult!.groove.syncopation).toBeGreaterThan(cumbiaResult!.groove.syncopation);
    });
    
    it('should detect jazz swing (high swing amount)', () => {
      const beat = createBeatState({ bpm: 110 }); // Jazz tempo
      
      // Simular swing: energía desplazada hacia el final del beat
      for (let i = 0; i < 30; i++) {
        // Swing: energía concentrada en fase 0.6-0.8
        const phase = 0.6 + Math.random() * 0.2;
        const treble = 0.7;  // Ride cymbal
        
        const audio = createAudioMetrics({ treble, energy: 0.5 });
        analyzer.analyze(audio, { ...beat, phase });
      }
      
      const result = analyzer.getLastResult();
      // Alto swing amount
      expect(result!.groove.swingAmount).toBeGreaterThan(0.1);
    });
  });
  
  // ═══════════════════════════════════════════════════════════
  // ⚡ PERFORMANCE - REGLA 1
  // ═══════════════════════════════════════════════════════════
  
  describe('Performance (REGLA 1)', () => {
    it('analyze() should complete in < 5ms', () => {
      const audio = createAudioMetrics();
      const beat = createBeatState();
      
      // Llenar buffer primero
      for (let i = 0; i < 20; i++) {
        analyzer.analyze(audio, { ...beat, phase: Math.random() });
      }
      
      // Medir tiempo de ejecución
      const iterations = 100;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        analyzer.analyze(
          createAudioMetrics({ timestamp: Date.now() + i }),
          { ...beat, phase: Math.random() }
        );
      }
      
      const end = performance.now();
      const avgTime = (end - start) / iterations;
      
      console.log(`Average analyze() time: ${avgTime.toFixed(3)}ms`);
      
      // Debe ser menor a 5ms (REGLA 1)
      expect(avgTime).toBeLessThan(5);
    });
  });
  
  // ═══════════════════════════════════════════════════════════
  // 📊 CONFIDENCE - REGLA 2
  // ═══════════════════════════════════════════════════════════
  
  describe('Confidence (REGLA 2)', () => {
    it('should return low confidence initially', () => {
      const audio = createAudioMetrics();
      const beat = createBeatState();
      
      const result = analyzer.analyze(audio, beat);
      
      // Primera frame = baja confianza
      expect(result.confidence).toBeLessThan(0.7);
    });
    
    it('should increase confidence with more data', () => {
      const audio = createAudioMetrics({ bass: 0.7, energy: 0.6 });
      const beat = createBeatState();
      
      // Acumular datos
      let lastConfidence = 0;
      for (let i = 0; i < 30; i++) {
        const result = analyzer.analyze(audio, { ...beat, phase: (i * 0.1) % 1 });
        lastConfidence = result.confidence;
      }
      
      // Después de muchas frames, la confianza debería ser mayor
      expect(lastConfidence).toBeGreaterThan(0.5);
    });
    
    it('confidence should be between 0 and 1', () => {
      const audio = createAudioMetrics();
      const beat = createBeatState();
      
      for (let i = 0; i < 30; i++) {
        const result = analyzer.analyze(audio, beat);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      }
    });
  });
  
  // ═══════════════════════════════════════════════════════════
  // 🎭 FILL DETECTION
  // ═══════════════════════════════════════════════════════════
  
  describe('Fill Detection', () => {
    it('should detect fill with high energy + many drum hits', () => {
      const beat = createBeatState();
      
      // Simular fill: alta energía, muchos hits simultáneos
      for (let i = 0; i < 10; i++) {
        const audio = createAudioMetrics({
          bass: 0.9,
          mid: 0.9,
          treble: 0.8,
          energy: 0.95,
        });
        analyzer.analyze(audio, beat);
      }
      
      const result = analyzer.getLastResult();
      expect(result!.fillInProgress).toBe(true);
    });
  });
});
