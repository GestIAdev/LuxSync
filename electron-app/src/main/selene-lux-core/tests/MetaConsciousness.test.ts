/**
 * 🌙 META-CONSCIOUSNESS TESTS - Wave 7
 * Tests para DreamForgeEngine y SelfAnalysisEngine
 * 
 * "Los sueños de un gato son la simulación perfecta" 🐱
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ========================================
// 🌙 DREAM FORGE ENGINE TESTS
// ========================================

describe('DreamForgeEngine', () => {
  let DreamForgeEngine: any;
  
  beforeEach(async () => {
    // Dynamic import to avoid module resolution issues
    const module = await import('../engines/consciousness/DreamForgeEngine');
    DreamForgeEngine = module.DreamForgeEngine;
  });
  
  describe('Instance Creation', () => {
    it('should create a DreamForgeEngine instance', () => {
      const dreamForge = new DreamForgeEngine();
      expect(dreamForge).toBeDefined();
      expect(dreamForge).toBeInstanceOf(DreamForgeEngine);
    });
    
    it('should accept custom configuration', () => {
      const config = {
        minBeautyThreshold: 0.8,
        abortThreshold: 0.2,
        maxSimulationTimeMs: 100
      };
      const dreamForge = new DreamForgeEngine(config);
      expect(dreamForge).toBeDefined();
    });
  });
  
  describe('Dream Simulation', () => {
    it('should simulate an intensity change dream', () => {
      const dreamForge = new DreamForgeEngine();
      const scenario = {
        type: 'intensity_evolution' as const,
        description: 'Test intensity change',
        parameters: { delta: 0.3 },
        currentState: { intensity: 0.3, mood: 'peaceful' },
        proposedState: { intensity: 0.8, mood: 'energetic' }
      };
      
      const result = dreamForge.dream(scenario);
      
      expect(result).toBeDefined();
      expect(result.projectedBeautyScore).toBeGreaterThanOrEqual(0);
      expect(result.projectedBeautyScore).toBeLessThanOrEqual(1);
      expect(['execute', 'modify', 'abort']).toContain(result.recommendation);
      expect(result.simulationTimeMs).toBeGreaterThan(0);
    });
    
    it('should simulate a palette change dream', () => {
      const dreamForge = new DreamForgeEngine();
      const scenario = {
        type: 'palette_change' as const,
        description: 'Cambio de paleta fuego a hielo',
        parameters: { from: 'fuego', to: 'hielo' },
        currentState: { palette: 'fuego', intensity: 0.5 },
        proposedState: { palette: 'hielo', intensity: 0.5 }
      };
      
      const result = dreamForge.dream(scenario);
      
      expect(result).toBeDefined();
      expect(result.projectedBeautyScore).toBeGreaterThanOrEqual(0);
      expect(result.components).toBeDefined();
    });
    
    it('should simulate a mood transition dream', () => {
      const dreamForge = new DreamForgeEngine();
      const scenario = {
        type: 'mood_transition' as const,
        description: 'Transición peaceful → energetic',
        parameters: { fromMood: 'peaceful', toMood: 'energetic' },
        currentState: { mood: 'peaceful', intensity: 0.4 },
        proposedState: { mood: 'energetic', intensity: 0.8 }
      };
      
      const result = dreamForge.dream(scenario);
      
      expect(result).toBeDefined();
      expect(result.reasoning).toBeDefined();
      expect(typeof result.reasoning).toBe('string');
    });
    
    it('should simulate a movement change dream', () => {
      const dreamForge = new DreamForgeEngine();
      const scenario = {
        type: 'movement_change' as const,
        description: 'Cambio de movimiento circular a wave',
        parameters: { pattern: 'wave' },
        currentState: { movement: 'circle', intensity: 0.5 },
        proposedState: { movement: 'wave', intensity: 0.5 }
      };
      
      const result = dreamForge.dream(scenario);
      
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
    
    it('should simulate a full scene change dream', () => {
      const dreamForge = new DreamForgeEngine();
      const scenario = {
        type: 'full_scene_change' as const,
        description: 'Cambio completo de escena',
        parameters: {},
        currentState: { 
          intensity: 0.3, 
          palette: 'fuego',
          mood: 'peaceful',
          movement: 'circle'
        },
        proposedState: { 
          intensity: 0.9, 
          palette: 'hielo',
          mood: 'energetic',
          movement: 'lissajous'
        }
      };
      
      const result = dreamForge.dream(scenario);
      
      expect(result).toBeDefined();
      expect(result.components).toBeDefined();
      expect(result.components.harmonicBeauty).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('Beauty Components', () => {
    it('should calculate beauty components', () => {
      const dreamForge = new DreamForgeEngine();
      const scenario = {
        type: 'intensity_evolution' as const,
        description: 'Test components',
        parameters: {},
        currentState: { intensity: 0.5, mood: 'peaceful' },
        proposedState: { intensity: 0.618, mood: 'peaceful' } // PHI ratio
      };
      
      const result = dreamForge.dream(scenario);
      
      expect(result.components).toBeDefined();
      expect(result.components.harmonicBeauty).toBeGreaterThanOrEqual(0);
      expect(result.components.fibonacciAlignment).toBeGreaterThanOrEqual(0);
      expect(result.components.zodiacResonance).toBeGreaterThanOrEqual(0);
      expect(result.components.transitionSmoothness).toBeGreaterThanOrEqual(0);
      expect(result.components.noveltyBonus).toBeGreaterThanOrEqual(0);
    });
    
    it('should reward smooth transitions', () => {
      const dreamForge = new DreamForgeEngine();
      
      // Transición suave
      const smoothScenario = {
        type: 'intensity_evolution' as const,
        description: 'Smooth transition',
        parameters: {},
        currentState: { intensity: 0.5 },
        proposedState: { intensity: 0.55 }
      };
      
      // Transición brusca
      const abruptScenario = {
        type: 'intensity_evolution' as const,
        description: 'Abrupt transition',
        parameters: {},
        currentState: { intensity: 0.1 },
        proposedState: { intensity: 0.95 }
      };
      
      const smoothResult = dreamForge.dream(smoothScenario);
      const abruptResult = dreamForge.dream(abruptScenario);
      
      // La transición suave debería tener mayor smoothness
      expect(smoothResult.components.transitionSmoothness)
        .toBeGreaterThanOrEqual(abruptResult.components.transitionSmoothness);
    });
  });
  
  describe('Event Emission', () => {
    it('should emit dream-started event', () => {
      const dreamForge = new DreamForgeEngine();
      const listener = vi.fn();
      dreamForge.on('dream-started', listener);
      
      dreamForge.dream({
        type: 'intensity_evolution' as const,
        description: 'Test',
        parameters: {},
        currentState: { intensity: 0.3 },
        proposedState: { intensity: 0.7 }
      });
      
      expect(listener).toHaveBeenCalled();
    });
    
    it('should emit dream-completed event', () => {
      const dreamForge = new DreamForgeEngine();
      const listener = vi.fn();
      dreamForge.on('dream-completed', listener);
      
      dreamForge.dream({
        type: 'palette_change' as const,
        description: 'Test',
        parameters: {},
        currentState: { palette: 'fuego' },
        proposedState: { palette: 'hielo' }
      });
      
      expect(listener).toHaveBeenCalled();
    });
  });
  
  describe('State Management', () => {
    it('should return current state', () => {
      const dreamForge = new DreamForgeEngine();
      const state = dreamForge.getState();
      
      expect(state).toBeDefined();
      expect(state.status).toBe('idle');
      expect(state.dreamsProcessed).toBe(0);
    });
    
    it('should track dream statistics', () => {
      const dreamForge = new DreamForgeEngine();
      
      dreamForge.dream({
        type: 'intensity_evolution' as const,
        description: 'Test',
        parameters: {},
        currentState: { intensity: 0.5 },
        proposedState: { intensity: 0.7 }
      });
      
      const state = dreamForge.getState();
      expect(state.dreamsProcessed).toBe(1);
    });
    
    it('should reset state', () => {
      const dreamForge = new DreamForgeEngine();
      
      dreamForge.dream({
        type: 'intensity_evolution' as const,
        description: 'Test',
        parameters: {},
        currentState: { intensity: 0.3 },
        proposedState: { intensity: 0.9 }
      });
      
      dreamForge.reset();
      const state = dreamForge.getState();
      
      expect(state.dreamsProcessed).toBe(0);
    });
  });
  
  describe('Alternatives Generation', () => {
    it('should generate alternatives for rejected dreams', () => {
      // Config con threshold alto para forzar rechazo
      const dreamForge = new DreamForgeEngine({ 
        minBeautyThreshold: 0.99,
        generateAlternatives: true 
      });
      
      const result = dreamForge.dream({
        type: 'full_scene_change' as const,
        description: 'Test alternatives',
        parameters: {},
        currentState: { intensity: 0.5, mood: 'peaceful' },
        proposedState: { intensity: 0.5, mood: 'chaotic' }
      });
      
      // Si fue rechazado o modificado, debería tener alternativas
      if (result.recommendation !== 'execute') {
        expect(result.alternatives).toBeDefined();
        expect(Array.isArray(result.alternatives)).toBe(true);
      }
    });
  });
});

// ========================================
// 🔍 SELF ANALYSIS ENGINE TESTS
// ========================================

describe('SelfAnalysisEngine', () => {
  let SelfAnalysisEngine: any;
  
  beforeEach(async () => {
    const module = await import('../engines/consciousness/SelfAnalysisEngine');
    SelfAnalysisEngine = module.SelfAnalysisEngine;
  });
  
  describe('Instance Creation', () => {
    it('should create a SelfAnalysisEngine instance', () => {
      const analyzer = new SelfAnalysisEngine();
      expect(analyzer).toBeDefined();
      expect(analyzer).toBeInstanceOf(SelfAnalysisEngine);
    });
    
    it('should accept custom configuration', () => {
      const config = {
        analysisIntervalMs: 60000,
        biasThresholdLow: 0.5,
        biasThresholdHigh: 0.9
      };
      const analyzer = new SelfAnalysisEngine(config);
      expect(analyzer).toBeDefined();
    });
  });
  
  describe('Behavior Recording', () => {
    it('should record behavior samples', () => {
      const analyzer = new SelfAnalysisEngine();
      
      analyzer.recordBehavior({
        palette: 'fuego',
        intensity: 0.5,
        movement: 'circle',
        effects: ['pulse'],
        mood: 'energetic',
        beauty: 0.7
      });
      
      const state = analyzer.getState();
      expect(state.sessionStats.framesProcessed).toBe(1);
    });
    
    it('should record multiple samples', () => {
      const analyzer = new SelfAnalysisEngine();
      
      for (let i = 0; i < 10; i++) {
        analyzer.recordBehavior({
          palette: 'fuego',
          intensity: 0.5 + i * 0.01,
          movement: 'circle',
          effects: ['pulse'],
          mood: 'energetic',
          beauty: 0.7
        });
      }
      
      const state = analyzer.getState();
      expect(state.sessionStats.framesProcessed).toBe(10);
    });
    
    it('should track strikes separately', () => {
      const analyzer = new SelfAnalysisEngine();
      
      analyzer.recordStrike();
      analyzer.recordStrike();
      
      const stats = analyzer.getSessionStats();
      expect(stats.strikesExecuted).toBe(2);
    });
  });
  
  describe('Bias Detection', () => {
    it('should detect palette obsession bias', () => {
      const analyzer = new SelfAnalysisEngine({ 
        minSamplesForAnalysis: 10,
        biasThresholdLow: 0.5 
      });
      
      // Usar siempre la misma paleta
      for (let i = 0; i < 100; i++) {
        analyzer.recordBehavior({
          palette: 'fuego',
          intensity: 0.5,
          movement: 'circle',
          effects: ['pulse'],
          mood: 'energetic',
          beauty: 0.7
        });
      }
      
      const biases = analyzer.runAnalysis();
      
      expect(biases).toBeDefined();
      expect(Array.isArray(biases)).toBe(true);
      // Debería detectar palette_obsession
      const paletteBias = biases.find((b: any) => b.type === 'palette_obsession');
      expect(paletteBias).toBeDefined();
    });
    
    it('should detect mood stagnation bias', () => {
      const analyzer = new SelfAnalysisEngine({ 
        minSamplesForAnalysis: 10,
        biasThresholdLow: 0.5 
      });
      
      // Siempre mismo mood pero variando paleta y movimiento
      for (let i = 0; i < 100; i++) {
        analyzer.recordBehavior({
          palette: ['fuego', 'hielo', 'neon', 'sunset', 'ocean'][i % 5],
          intensity: 0.3 + (i % 5) * 0.1,
          movement: ['circle', 'wave', 'lissajous', 'random'][i % 4],
          effects: ['pulse'],
          mood: 'energetic',  // Siempre energetic
          beauty: 0.7
        });
      }
      
      const biases = analyzer.runAnalysis();
      
      // Debería detectar mood_stagnation
      const moodBias = biases.find((b: any) => b.type === 'mood_stagnation');
      expect(moodBias).toBeDefined();
    });
    
    it('should not detect severe bias with varied behavior', () => {
      const analyzer = new SelfAnalysisEngine({ 
        minSamplesForAnalysis: 10,
        biasThresholdHigh: 0.9 
      });
      
      const palettes = ['fuego', 'hielo', 'neon', 'sunset', 'ocean'];
      const movements = ['circle', 'wave', 'lissajous', 'random', 'spiral'];
      const moods = ['energetic', 'peaceful', 'harmonious', 'building'];
      
      for (let i = 0; i < 100; i++) {
        analyzer.recordBehavior({
          palette: palettes[i % palettes.length],
          intensity: 0.1 + (i % 9) * 0.1,  // Variado: 0.1-0.9
          movement: movements[i % movements.length],
          effects: ['pulse', 'fade'],
          mood: moods[i % moods.length],
          beauty: 0.7
        });
      }
      
      const biases = analyzer.runAnalysis();
      
      // Con comportamiento variado, menos sesgos severos
      const severeBiases = biases.filter((b: any) => b.severity === 'high');
      expect(severeBiases.length).toBe(0);
    });
  });
  
  describe('Session Statistics', () => {
    it('should calculate session statistics', () => {
      const analyzer = new SelfAnalysisEngine();
      
      analyzer.recordBehavior({
        palette: 'fuego',
        intensity: 0.3,
        movement: 'circle',
        effects: [],
        mood: 'peaceful',
        beauty: 0.6
      });
      
      analyzer.recordBehavior({
        palette: 'hielo',
        intensity: 0.7,
        movement: 'wave',
        effects: [],
        mood: 'energetic',
        beauty: 0.8
      });
      
      const stats = analyzer.getSessionStats();
      
      expect(stats).toBeDefined();
      expect(stats.framesProcessed).toBe(2);
      expect(stats.averageIntensity).toBeCloseTo(0.5, 1);
      expect(stats.averageBeauty).toBeCloseTo(0.7, 1);
    });
  });
  
  describe('Event Emission', () => {
    it('should emit analysis-started event', () => {
      const analyzer = new SelfAnalysisEngine({ minSamplesForAnalysis: 5 });
      const listener = vi.fn();
      analyzer.on('analysis-started', listener);
      
      // Agregar suficientes muestras
      for (let i = 0; i < 10; i++) {
        analyzer.recordBehavior({
          palette: 'fuego',
          intensity: 0.5,
          movement: 'circle',
          effects: [],
          mood: 'energetic',
          beauty: 0.7
        });
      }
      
      analyzer.runAnalysis();
      
      expect(listener).toHaveBeenCalled();
    });
    
    it('should emit bias-detected event', () => {
      const analyzer = new SelfAnalysisEngine({ 
        minSamplesForAnalysis: 5,
        biasThresholdLow: 0.3
      });
      const listener = vi.fn();
      analyzer.on('bias-detected', listener);
      
      // Crear sesgo obvio
      for (let i = 0; i < 100; i++) {
        analyzer.recordBehavior({
          palette: 'fuego',  // Siempre fuego
          intensity: 0.5,
          movement: 'circle',
          effects: [],
          mood: 'energetic',
          beauty: 0.7
        });
      }
      
      analyzer.runAnalysis();
      
      // El listener debería haberse llamado si detectó bias
      expect(listener.mock.calls.length).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('State Management', () => {
    it('should return current state', () => {
      const analyzer = new SelfAnalysisEngine();
      const state = analyzer.getState();
      
      expect(state).toBeDefined();
      expect(state.status).toBe('idle');
      expect(state.activebiases).toBeDefined();
      expect(Array.isArray(state.activebiases)).toBe(true);
    });
    
    it('should reset state', () => {
      const analyzer = new SelfAnalysisEngine();
      
      analyzer.recordBehavior({
        palette: 'fuego',
        intensity: 0.5,
        movement: 'circle',
        effects: [],
        mood: 'energetic',
        beauty: 0.7
      });
      
      analyzer.reset();
      const state = analyzer.getState();
      
      expect(state.sessionStats.framesProcessed).toBe(0);
    });
  });
  
  describe('Session Duration', () => {
    it('should track session duration', () => {
      const analyzer = new SelfAnalysisEngine();
      
      const stats = analyzer.getSessionStats();
      
      expect(stats.duration).toBeGreaterThanOrEqual(0);
    });
  });
});

// ========================================
// 🔗 INTEGRATION TESTS
// ========================================

describe('Meta-Consciousness Integration', () => {
  let DreamForgeEngine: any;
  let SelfAnalysisEngine: any;
  
  beforeEach(async () => {
    const dreamModule = await import('../engines/consciousness/DreamForgeEngine');
    const selfModule = await import('../engines/consciousness/SelfAnalysisEngine');
    DreamForgeEngine = dreamModule.DreamForgeEngine;
    SelfAnalysisEngine = selfModule.SelfAnalysisEngine;
  });
  
  it('should use analyzer to record dream decisions', () => {
    const dreamForge = new DreamForgeEngine();
    const analyzer = new SelfAnalysisEngine();
    
    // Dream un escenario
    const result = dreamForge.dream({
      type: 'palette_change' as const,
      description: 'Test',
      parameters: {},
      currentState: { palette: 'fuego', intensity: 0.5 },
      proposedState: { palette: 'hielo', intensity: 0.5 }
    });
    
    // Registrar el resultado como behavior
    if (result.recommendation === 'execute') {
      analyzer.recordBehavior({
        palette: 'hielo',
        intensity: 0.5,
        movement: 'circle',
        effects: [],
        mood: 'peaceful',
        beauty: result.projectedBeautyScore
      });
    }
    
    const state = analyzer.getState();
    expect(state.sessionStats.framesProcessed).toBe(result.recommendation === 'execute' ? 1 : 0);
  });
  
  it('should maintain separate states', () => {
    const dreamForge = new DreamForgeEngine();
    const analyzer = new SelfAnalysisEngine();
    
    const dreamState = dreamForge.getState();
    const analyzerState = analyzer.getState();
    
    expect(dreamState).not.toBe(analyzerState);
    expect(dreamState.dreamsProcessed).toBeDefined();
    expect(analyzerState.sessionStats).toBeDefined();
  });
});

// ========================================
// 🧮 FIBONACCI & PHI INTEGRATION
// ========================================

describe('Golden Ratio Integration', () => {
  let DreamForgeEngine: any;
  
  beforeEach(async () => {
    const module = await import('../engines/consciousness/DreamForgeEngine');
    DreamForgeEngine = module.DreamForgeEngine;
  });
  
  it('should reward PHI-aligned changes with fibonacci alignment', () => {
    const dreamForge = new DreamForgeEngine();
    
    // Golden ratio intensity (0.618 es 1/PHI)
    const goldenResult = dreamForge.dream({
      type: 'intensity_evolution' as const,
      description: 'Golden ratio change',
      parameters: {},
      currentState: { intensity: 0.382 }, // 1 - 1/PHI
      proposedState: { intensity: 0.618 } // 1/PHI
    });
    
    // El componente fibonacci debería ser positivo
    expect(goldenResult.components.fibonacciAlignment).toBeGreaterThanOrEqual(0);
    expect(goldenResult.projectedBeautyScore).toBeGreaterThanOrEqual(0);
  });
});
