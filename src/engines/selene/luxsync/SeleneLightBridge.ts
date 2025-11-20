/**
 * 🌉 SELENE LIGHT BRIDGE
 * 
 * Main integration component that connects:
 * Audio Input → Selene Core → DMX Output
 * 
 * Flow (30 FPS):
 * 1. Capture audio frame (FFT)
 * 2. Convert to Selene metrics
 * 3. Process through Selene consciousness
 * 4. Map musical note → RGB color
 * 5. Apply beauty → intensity
 * 6. Send to DMX fixtures
 * 
 * @date 2025-11-20
 * @author LuxSync Integration Team
 */

import { AudioToMetricsAdapter, SystemMetrics } from './AudioToMetricsAdapter.js';
import { NoteToColorMapper, RGB, MusicalNote } from './NoteToColorMapper.js';
import { VisualEffects, EffectMode } from './effects/VisualEffects.js';
import type { SeleneConsciousness } from '../consciousness/SeleneConsciousness.js';

/**
 * Selene's output structure
 */
export interface SeleneOutput {
  musicalNote: MusicalNote;
  beauty: number;           // 0.0-1.0
  poem?: string;           // Celebration poem (decorative)
  midiSequence?: MidiNote[]; // For Fibonacci timing
  entropyMode?: 'DETERMINISTIC' | 'BALANCED' | 'CHAOTIC';
  timestamp: number;
}

export interface MidiNote {
  note: MusicalNote;
  duration: number;  // milliseconds
  velocity: number;  // 0-127
}

/**
 * DMX Scene to apply to fixtures
 */
export interface DMXScene {
  id: string;
  timestamp: number;
  color: RGB;
  dimmer: number;        // 0-255
  fadeTime: number;      // milliseconds (from Fibonacci)
  fixtures: FixtureState[];
}

export interface FixtureState {
  id: string;
  universe: number;      // DMX universe (1-N)
  startChannel: number;  // 1-512
  channels: {
    red: number;         // 0-255
    green: number;       // 0-255
    blue: number;        // 0-255
    dimmer: number;      // 0-255
  };
}

/**
 * DMX Driver interface (abstract)
 */
export interface DMXDriver {
  applyScene(scene: DMXScene): Promise<void>;
  getFixtures(): FixtureDefinition[];
  isConnected(): boolean;
}

export interface FixtureDefinition {
  id: string;
  name: string;
  type: 'PAR' | 'MOVING_HEAD' | 'STROBE' | 'WASH';
  universe: number;
  startChannel: number;
  channelCount: number;
}

/**
 * Bridge statistics for monitoring
 */
export interface BridgeStats {
  framesProcessed: number;
  lastNote: MusicalNote;
  lastBeauty: number;
  lastColor: RGB;
  averageFps: number;
  errors: number;
  uptime: number; // milliseconds
}

/**
 * Main bridge class
 */
export class SeleneLightBridge {
  private audioAdapter: AudioToMetricsAdapter;
  private seleneCore: SeleneConsciousness;
  private dmxDriver: DMXDriver;
  private visualEffects: VisualEffects;
  
  private running: boolean = false;
  private intervalId: number | null = null;
  private targetFps: number = 30;
  private frameTime: number = 1000 / this.targetFps; // ~33ms
  
  // Statistics
  private stats: BridgeStats = {
    framesProcessed: 0,
    lastNote: 'RE',
    lastBeauty: 0.5,
    lastColor: NoteToColorMapper.mapNoteToColor('RE'),
    averageFps: 0,
    errors: 0,
    uptime: 0
  };
  
  private startTime: number = 0;
  private lastFrameTime: number = 0;
  private fpsHistory: number[] = [];

  constructor(
    audioAdapter: AudioToMetricsAdapter,
    seleneCore: SeleneConsciousness,
    dmxDriver: DMXDriver
  ) {
    this.audioAdapter = audioAdapter;
    this.seleneCore = seleneCore;
    this.dmxDriver = dmxDriver;
    this.visualEffects = new VisualEffects();
  }

  /**
   * Start the bridge (begin processing loop)
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn('⚠️  Bridge already running');
      return;
    }

    // Initialize audio adapter if needed
    if (!this.audioAdapter.isReady()) {
      console.log('🎤 Initializing audio adapter...');
      await this.audioAdapter.initialize();
    }

    // Check DMX connection
    if (!this.dmxDriver.isConnected()) {
      console.warn('⚠️  DMX driver not connected, running in simulation mode');
    }

    this.running = true;
    this.startTime = Date.now();
    this.lastFrameTime = Date.now();

    console.log(`🌉 Bridge started (${this.targetFps} FPS)`);
    console.log(`   Fixtures: ${this.dmxDriver.getFixtures().length}`);
    console.log(`   Audio: ${this.audioAdapter.isReady() ? 'Ready' : 'Not Ready'}`);
    console.log(`   DMX: ${this.dmxDriver.isConnected() ? 'Connected' : 'Simulated'}`);

    // Start processing loop
    this.intervalId = window.setInterval(
      () => this.tick(),
      this.frameTime
    );
  }

  /**
   * Stop the bridge
   */
  stop(): void {
    if (!this.running) return;

    this.running = false;
    
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('🛑 Bridge stopped');
    console.log(`   Total frames: ${this.stats.framesProcessed}`);
    console.log(`   Uptime: ${(this.stats.uptime / 1000).toFixed(1)}s`);
    console.log(`   Average FPS: ${this.stats.averageFps.toFixed(1)}`);
    console.log(`   Errors: ${this.stats.errors}`);
  }

  /**
   * Main processing loop (called every ~33ms for 30 FPS)
   */
  private async tick(): Promise<void> {
    if (!this.running) return;

    const frameStart = Date.now();

    try {
      // 1. Capture audio → metrics
      const metrics = await this.audioAdapter.captureMetrics();

      // 2. Process with Selene Core
      const seleneOutput = await this.processWithSelene(metrics);

      // 3. Build DMX scene
      const scene = this.buildScene(seleneOutput);

      // 4. Apply to fixtures
      await this.dmxDriver.applyScene(scene);

      // 5. Update statistics
      this.updateStats(seleneOutput, scene, frameStart);

      // 6. Log (throttled - only every 30 frames = ~1 second)
      if (this.stats.framesProcessed % 30 === 0) {
        this.logStatus(seleneOutput, scene);
      }

    } catch (error) {
      this.stats.errors++;
      console.error('❌ Bridge tick error:', error);
    }

    // Calculate actual FPS
    const frameEnd = Date.now();
    const frameDuration = frameEnd - frameStart;
    const actualFps = 1000 / Math.max(1, frameEnd - this.lastFrameTime);
    this.fpsHistory.push(actualFps);
    if (this.fpsHistory.length > 30) this.fpsHistory.shift();
    this.lastFrameTime = frameEnd;

    // Warn if frame took too long
    if (frameDuration > this.frameTime * 1.5) {
      console.warn(`⚠️  Slow frame: ${frameDuration}ms (target: ${this.frameTime}ms)`);
    }
  }

  /**
   * Process metrics through Selene consciousness
   */
  private async processWithSelene(metrics: SystemMetrics): Promise<SeleneOutput> {
    // This is a simplified adapter - in real implementation, you'd call:
    // const result = await this.seleneCore.processSystemMetrics(metrics);
    
    // For now, we'll create a stub that demonstrates the flow
    // TODO: Implement actual Selene integration
    
    // Determine dominant note based on metrics
    let note: MusicalNote;
    if (metrics.cpu > 0.6) {
      note = 'DO'; // Bass heavy → Red
    } else if (metrics.latency < 30) {
      note = 'MI'; // Treble heavy (low latency) → Yellow
    } else {
      note = 'RE'; // Balanced → Orange
    }

    // Calculate beauty (simplified)
    // Ensure all values are valid numbers before calculation
    const cpu = isNaN(metrics.cpu) ? 0.5 : metrics.cpu;
    const memory = isNaN(metrics.memory) ? 0.5 : metrics.memory;
    const latency = isNaN(metrics.latency) ? 50 : metrics.latency;
    
    const beauty = (cpu * 0.4 + memory * 0.3 + (1 - latency / 100) * 0.3);

    return {
      musicalNote: note,
      beauty: Math.max(0, Math.min(1, beauty)),
      poem: this.generatePoem(note, beauty),
      midiSequence: this.generateMidiSequence(note),
      entropyMode: 'BALANCED',
      timestamp: Date.now()
    };
  }

  /**
   * Build DMX scene from Selene output
   * NOW WITH FIXTURE-SPECIFIC ROUTING! 🌈
   * Each fixture responds to different frequency ranges
   */
  private buildScene(seleneOutput: SeleneOutput): DMXScene {
    // Base color from main note
    const baseColor = NoteToColorMapper.mapNoteToColor(seleneOutput.musicalNote);
    const baseDimmer = NoteToColorMapper.mapBeautyToIntensity(seleneOutput.beauty);
    const fadeTime = this.extractFadeTime(seleneOutput.midiSequence);

    // Get all fixtures
    const allFixtures = this.dmxDriver.getFixtures();
    const fixtureCount = allFixtures.length;

    // Map each fixture to different frequency zones
    const fixtures = allFixtures.map((fixture, index) => {
      let fixtureColor = { ...baseColor };
      let fixtureDimmer = baseDimmer;

      // FREQUENCY ZONE ROUTING (8 fixtures = 8 frequency zones)
      // This creates visual variety and shows different audio components
      if (fixtureCount === 8) {
        // Zone 1-2: Pure BASS (Red zone)
        if (index === 0 || index === 1) {
          fixtureColor = NoteToColorMapper.mapNoteToColor('DO'); // Red
          fixtureDimmer = Math.max(30, baseDimmer * 1.2); // More intensity for bass
        }
        // Zone 3-4: LOW-MID (Orange-Yellow zone)
        else if (index === 2 || index === 3) {
          fixtureColor = NoteToColorMapper.mapNoteToColor('RE'); // Orange
          fixtureDimmer = Math.max(20, baseDimmer * 0.9);
        }
        // Zone 5-6: MID-HIGH (Green-Cyan zone)
        else if (index === 4 || index === 5) {
          fixtureColor = NoteToColorMapper.mapNoteToColor('SOL'); // Cyan
          fixtureDimmer = Math.max(20, baseDimmer * 1.0);
        }
        // Zone 7-8: TREBLE (Blue-Magenta zone)
        else if (index === 6 || index === 7) {
          fixtureColor = NoteToColorMapper.mapNoteToColor('LA'); // Blue
          fixtureDimmer = Math.max(20, baseDimmer * 0.8);
        }
      }
      // For other fixture counts, use rainbow spread
      else {
        const hue = (index / fixtureCount) * 360;
        const rgb = this.hslToRgb(hue, 100, 50);
        fixtureColor = { 
          r: rgb[0], 
          g: rgb[1], 
          b: rgb[2],
          name: 'rainbow',
          hex: `#${rgb[0].toString(16).padStart(2, '0')}${rgb[1].toString(16).padStart(2, '0')}${rgb[2].toString(16).padStart(2, '0')}`
        };
        fixtureDimmer = Math.max(30, baseDimmer);
      }

      return {
        id: fixture.id,
        universe: fixture.universe,
        startChannel: fixture.startChannel,
        channels: {
          red: fixtureColor.r,
          green: fixtureColor.g,
          blue: fixtureColor.b,
          dimmer: Math.min(255, fixtureDimmer)
        }
      };
    });

    // 🎨 APPLY VISUAL EFFECTS on top of frequency routing
    // This adds dynamic patterns (chase, wave, strobe, etc.)
    const audioMetrics = {
      bass: seleneOutput.beauty,  // Simplified: use beauty as bass proxy
      mid: seleneOutput.beauty * 0.8,
      treble: seleneOutput.beauty * 0.6
    };
    const effectModifiers = this.visualEffects.applyEffect(fixtureCount, audioMetrics);

    // Apply effect modifiers to fixtures
    fixtures.forEach((fixture, index) => {
      const modifier = effectModifiers[index];
      if (modifier) {
        // Multiply dimmer by effect modifier
        fixture.channels.dimmer = Math.min(255, fixture.channels.dimmer * modifier.dimmerMultiplier);
        
        // Apply color shift if present (for wave effect)
        if (modifier.colorShift !== undefined) {
          const rgb = this.hslToRgb(
            (this.rgbToHue(fixture.channels.red, fixture.channels.green, fixture.channels.blue) + modifier.colorShift) % 360,
            100,
            50
          );
          fixture.channels.red = rgb[0];
          fixture.channels.green = rgb[1];
          fixture.channels.blue = rgb[2];
        }
      }
    });

    return {
      id: `scene_${Date.now()}`,
      timestamp: Date.now(),
      color: baseColor,
      dimmer: baseDimmer,
      fadeTime,
      fixtures
    };
  }

  /**
   * RGB to Hue (for color shifting)
   */
  private rgbToHue(r: number, g: number, b: number): number {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    
    if (max !== min) {
      const d = max - min;
      if (max === r) {
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      } else if (max === g) {
        h = ((b - r) / d + 2) / 6;
      } else {
        h = ((r - g) / d + 4) / 6;
      }
    }
    
    return h * 360;
  }

  /**
   * HSL to RGB conversion for rainbow effects
   */
  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [
      Math.round(255 * f(0)),
      Math.round(255 * f(8)),
      Math.round(255 * f(4))
    ];
  }

  /**
   * Extract fade time from MIDI sequence (Fibonacci timing)
   */
  private extractFadeTime(midiSequence?: MidiNote[]): number {
    if (!midiSequence || midiSequence.length === 0) {
      return 500; // Default 500ms
    }

    // Use first note's duration (Fibonacci-based)
    const firstNote = midiSequence[0];
    return Math.max(100, Math.min(2000, firstNote.duration || 500));
  }

  /**
   * Generate a simple celebration poem (decorative)
   */
  private generatePoem(note: MusicalNote, beauty: number): string {
    const poems: Record<MusicalNote, string[]> = {
      'DO': [
        'In crimson waves the bass does flow',
        'Deep rhythms make the darkness glow',
        'Fire dances, energy ascending'
      ],
      'RE': [
        'Balanced harmony in orange light',
        'Between the depths and heights we ride',
        'Warmth embraces the dancing night'
      ],
      'MI': [
        'Yellow brilliance, clarity profound',
        'Treble frequencies all around',
        'In luminous heights, wisdom found'
      ],
      'FA': ['Verdant meadows of sound'],
      'SOL': ['Cyan waves of higher realms'],
      'LA': ['Azure depths of tranquility'],
      'SI': ['Magenta mysteries revealed']
    };

    const options = poems[note] || poems['RE'];
    const index = Math.floor(beauty * options.length);
    return options[Math.min(index, options.length - 1)];
  }

  /**
   * Generate MIDI sequence (Fibonacci timing stub)
   */
  private generateMidiSequence(note: MusicalNote): MidiNote[] {
    // Fibonacci sequence: 1, 1, 2, 3, 5, 8, 13...
    const fibonacciMs = [500, 500, 1000, 1500, 2500];
    
    return fibonacciMs.map((duration, i) => ({
      note: note,
      duration: duration,
      velocity: Math.floor(80 + i * 5) // Crescendo
    }));
  }

  /**
   * Update statistics
   */
  private updateStats(
    seleneOutput: SeleneOutput,
    scene: DMXScene,
    frameStart: number
  ): void {
    this.stats.framesProcessed++;
    this.stats.lastNote = seleneOutput.musicalNote;
    this.stats.lastBeauty = seleneOutput.beauty;
    this.stats.lastColor = scene.color;
    this.stats.uptime = Date.now() - this.startTime;
    
    // Calculate average FPS
    if (this.fpsHistory.length > 0) {
      const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
      this.stats.averageFps = sum / this.fpsHistory.length;
    }
  }

  /**
   * Log current status (throttled)
   */
  private logStatus(seleneOutput: SeleneOutput, scene: DMXScene): void {
    console.log(
      `🎵 ${seleneOutput.musicalNote} | ` +
      `Beauty: ${seleneOutput.beauty.toFixed(2)} | ` +
      `Color: ${scene.color.name} (${scene.color.hex}) | ` +
      `Dimmer: ${scene.dimmer} | ` +
      `FPS: ${this.stats.averageFps.toFixed(1)}`
    );
  }

  /**
   * Get current statistics
   */
  getStats(): BridgeStats {
    return { ...this.stats };
  }

  /**
   * Check if bridge is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get current target FPS
   */
  getTargetFps(): number {
    return this.targetFps;
  }

  /**
   * Set target FPS (will apply on next start)
   */
  setTargetFps(fps: number): void {
    if (fps < 1 || fps > 60) {
      console.warn(`⚠️  Invalid FPS: ${fps}, must be 1-60`);
      return;
    }

    this.targetFps = fps;
    this.frameTime = 1000 / fps;

    // If running, restart with new FPS
    if (this.running) {
      console.log(`🔄 Restarting bridge with ${fps} FPS`);
      this.stop();
      this.start();
    }
  }

  /**
   * 🎨 Set visual effect mode
   */
  setEffect(mode: EffectMode, speed: number = 0.5, intensity: number = 0.5): void {
    this.visualEffects.setEffect({ mode, speed, intensity });
    console.log(`🎨 Effect set to: ${mode} (speed: ${speed}, intensity: ${intensity})`);
  }

  /**
   * 🎨 Get current effect
   */
  getEffect() {
    return this.visualEffects.getEffect();
  }

  /**
   * 🎨 Clear all effects (return to normal)
   */
  clearEffects(): void {
    this.visualEffects.setEffect({ mode: 'none' });
    console.log('🎨 Effects cleared');
  }
}
