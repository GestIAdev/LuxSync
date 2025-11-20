/**
 * 🎮 DMX SIMULATOR DRIVER
 * 
 * Visual browser-based DMX simulator (no hardware needed)
 * Perfect for demos, testing, and development
 * 
 * Features:
 * - Real-time fixture visualization
 * - Color preview with intensity
 * - Stats panel (FPS, scenes, timing)
 * - Works completely offline
 * - Portable (pen drive ready!)
 * 
 * @date 2025-11-20
 * @author LuxSync Team
 */

import type { DMXDriver, DMXScene, FixtureDefinition, FixtureState } from '../SeleneLightBridge.js';

export interface SimulatorConfig {
  canvasId?: string;        // HTML canvas ID (default: 'dmx-simulator')
  width?: number;           // Canvas width (default: 1200)
  height?: number;          // Canvas height (default: 600)
  fixtureCount?: number;    // Number of virtual fixtures (default: 8)
  fixtureSize?: number;     // Fixture circle radius (default: 60)
  showStats?: boolean;      // Show stats panel (default: true)
  showLabels?: boolean;     // Show fixture labels (default: true)
  fadeSmoothing?: number;   // Fade smoothing factor 0-1 (default: 0.7)
}

export interface SimulatorStats {
  scenesApplied: number;
  lastUpdateTime: number;
  averageFadeTime: number;
  currentScene: DMXScene | null;
  isConnected: boolean;
}

/**
 * Virtual fixture for simulation
 */
interface VirtualFixture {
  id: string;
  name: string;
  x: number;              // Canvas X position
  y: number;              // Canvas Y position
  currentColor: { r: number; g: number; b: number };
  targetColor: { r: number; g: number; b: number };
  currentDimmer: number;  // 0-255
  targetDimmer: number;   // 0-255
  definition: FixtureDefinition;
}

/**
 * DMX Simulator Driver
 */
export class SimulatorDriver implements DMXDriver {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private config: Required<SimulatorConfig>;
  private fixtures: VirtualFixture[] = [];
  private stats: SimulatorStats;
  private animationFrameId: number | null = null;
  private connected: boolean = false;

  constructor(config: SimulatorConfig = {}) {
    // Default configuration
    this.config = {
      canvasId: config.canvasId || 'dmx-simulator',
      width: config.width || 1200,
      height: config.height || 600,
      fixtureCount: config.fixtureCount || 8,
      fixtureSize: config.fixtureSize || 60,
      showStats: config.showStats !== undefined ? config.showStats : true,
      showLabels: config.showLabels !== undefined ? config.showLabels : true,
      fadeSmoothing: config.fadeSmoothing || 0.7
    };

    this.stats = {
      scenesApplied: 0,
      lastUpdateTime: 0,
      averageFadeTime: 500,
      currentScene: null,
      isConnected: false
    };
  }

  /**
   * Initialize the simulator (find or create canvas)
   */
  async initialize(): Promise<void> {
    // Try to find existing canvas
    this.canvas = document.getElementById(this.config.canvasId) as HTMLCanvasElement;

    // Create canvas if not found
    if (!this.canvas) {
      console.log('🎨 Creating simulator canvas...');
      this.canvas = document.createElement('canvas');
      this.canvas.id = this.config.canvasId;
      this.canvas.width = this.config.width;
      this.canvas.height = this.config.height;
      this.canvas.style.border = '2px solid #333';
      this.canvas.style.borderRadius = '8px';
      this.canvas.style.backgroundColor = '#000';
      this.canvas.style.display = 'block';
      this.canvas.style.margin = '20px auto';
      document.body.appendChild(this.canvas);
    }

    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('❌ Failed to get canvas 2D context');
    }

    // Create virtual fixtures
    this.createVirtualFixtures();

    // Start rendering loop
    this.startRenderLoop();

    this.connected = true;
    this.stats.isConnected = true;

    console.log(`🎮 Simulator initialized: ${this.fixtures.length} fixtures`);
  }

  /**
   * Create virtual fixtures in a nice layout
   */
  private createVirtualFixtures(): void {
    const count = this.config.fixtureCount;
    const padding = 100;
    const usableWidth = this.config.width - padding * 2;
    const usableHeight = this.config.height - padding * 2;

    // Arrange in a grid
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const spacingX = usableWidth / (cols - 1 || 1);
    const spacingY = usableHeight / (rows - 1 || 1);

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = padding + col * spacingX;
      const y = padding + row * spacingY;

      this.fixtures.push({
        id: `fixture_${i + 1}`,
        name: `PAR ${i + 1}`,
        x,
        y,
        currentColor: { r: 0, g: 0, b: 0 },
        targetColor: { r: 0, g: 0, b: 0 },
        currentDimmer: 0,
        targetDimmer: 0,
        definition: {
          id: `fixture_${i + 1}`,
          name: `PAR ${i + 1}`,
          type: 'PAR',
          universe: 1,
          startChannel: i * 4 + 1,
          channelCount: 4
        }
      });
    }
  }

  /**
   * Apply DMX scene to virtual fixtures
   */
  async applyScene(scene: DMXScene): Promise<void> {
    if (!this.connected) {
      console.warn('⚠️  Simulator not connected');
      return;
    }

    // Update stats
    this.stats.scenesApplied++;
    this.stats.lastUpdateTime = Date.now();
    this.stats.currentScene = scene;
    this.stats.averageFadeTime = scene.fadeTime;

    // Apply scene to all fixtures
    for (const fixture of this.fixtures) {
      const fixtureState = scene.fixtures.find(f => f.id === fixture.id);
      
      if (fixtureState) {
        // Set target colors (will be smoothly interpolated in render loop)
        fixture.targetColor = {
          r: fixtureState.channels.red,
          g: fixtureState.channels.green,
          b: fixtureState.channels.blue
        };
        fixture.targetDimmer = fixtureState.channels.dimmer;
      }
    }
  }

  /**
   * Get fixture definitions
   */
  getFixtures(): FixtureDefinition[] {
    return this.fixtures.map(f => f.definition);
  }

  /**
   * Check if simulator is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Start the render loop (smooth animations)
   */
  private startRenderLoop(): void {
    const render = () => {
      this.render();
      this.animationFrameId = window.requestAnimationFrame(render);
    };
    render();
  }

  /**
   * Stop the render loop
   */
  private stopRenderLoop(): void {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Main render function (called every frame)
   */
  private render(): void {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const smoothing = this.config.fadeSmoothing;

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.config.width, this.config.height);

    // Draw title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🎮 LuxSync DMX Simulator', this.config.width / 2, 40);

    // Draw subtitle
    ctx.font = '14px Arial';
    ctx.fillStyle = '#888';
    ctx.fillText('Selene Consciousness → Audio Reactive Lighting', this.config.width / 2, 65);

    // Update and draw each fixture
    for (const fixture of this.fixtures) {
      // Smooth color interpolation (lerp)
      fixture.currentColor.r += (fixture.targetColor.r - fixture.currentColor.r) * (1 - smoothing);
      fixture.currentColor.g += (fixture.targetColor.g - fixture.currentColor.g) * (1 - smoothing);
      fixture.currentColor.b += (fixture.targetColor.b - fixture.currentColor.b) * (1 - smoothing);
      fixture.currentDimmer += (fixture.targetDimmer - fixture.currentDimmer) * (1 - smoothing);

      // Apply dimmer to color
      const r = Math.round(fixture.currentColor.r * (fixture.currentDimmer / 255));
      const g = Math.round(fixture.currentColor.g * (fixture.currentDimmer / 255));
      const b = Math.round(fixture.currentColor.b * (fixture.currentDimmer / 255));

      // Draw fixture glow (outer)
      const gradient = ctx.createRadialGradient(
        fixture.x, fixture.y, 0,
        fixture.x, fixture.y, this.config.fixtureSize * 1.5
      );
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.8)`);
      gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.4)`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(fixture.x, fixture.y, this.config.fixtureSize * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Draw fixture body (inner circle)
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.beginPath();
      ctx.arc(fixture.x, fixture.y, this.config.fixtureSize, 0, Math.PI * 2);
      ctx.fill();

      // Draw fixture border
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(fixture.x, fixture.y, this.config.fixtureSize, 0, Math.PI * 2);
      ctx.stroke();

      // Draw fixture label
      if (this.config.showLabels) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(fixture.name, fixture.x, fixture.y + 5);
        
        // Draw DMX address
        ctx.font = '10px monospace';
        ctx.fillStyle = '#aaa';
        ctx.fillText(
          `${fixture.definition.universe}.${fixture.definition.startChannel}`,
          fixture.x,
          fixture.y + 20
        );
      }
    }

    // Draw stats panel
    if (this.config.showStats) {
      this.drawStatsPanel(ctx);
    }
  }

  /**
   * Draw statistics panel
   */
  private drawStatsPanel(ctx: CanvasRenderingContext2D): void {
    const panelX = 10;
    const panelY = this.config.height - 140;
    const panelWidth = 350;
    const panelHeight = 130;

    // Panel background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    // Stats text
    ctx.fillStyle = '#0f0';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';

    const scene = this.stats.currentScene;
    const lines = [
      `📊 STATS`,
      `Scenes Applied: ${this.stats.scenesApplied}`,
      `Fixtures: ${this.fixtures.length}`,
      `Current Note: ${scene?.id.includes('scene') ? 'Processing...' : 'N/A'}`,
      `Fade Time: ${this.stats.averageFadeTime}ms`,
      `Color: ${scene ? `rgb(${scene.color.r},${scene.color.g},${scene.color.b})` : 'N/A'}`,
      `Dimmer: ${scene?.dimmer || 0} / 255`,
    ];

    lines.forEach((line, i) => {
      ctx.fillText(line, panelX + 10, panelY + 20 + i * 18);
    });
  }

  /**
   * Get current statistics
   */
  getStats(): SimulatorStats {
    return { ...this.stats };
  }

  /**
   * Disconnect simulator
   */
  disconnect(): void {
    this.stopRenderLoop();
    this.connected = false;
    this.stats.isConnected = false;
    console.log('🛑 Simulator disconnected');
  }

  /**
   * Clear all fixtures (blackout)
   */
  blackout(): void {
    for (const fixture of this.fixtures) {
      fixture.targetColor = { r: 0, g: 0, b: 0 };
      fixture.targetDimmer = 0;
    }
    console.log('⚫ Blackout applied');
  }

  /**
   * Test pattern (RGB cycle)
   */
  async testPattern(): Promise<void> {
    console.log('🌈 Running test pattern...');
    
    const colors = [
      { r: 255, g: 0, b: 0 },    // Red
      { r: 0, g: 255, b: 0 },    // Green
      { r: 0, g: 0, b: 255 },    // Blue
      { r: 255, g: 255, b: 0 },  // Yellow
      { r: 255, g: 0, b: 255 },  // Magenta
      { r: 0, g: 255, b: 255 },  // Cyan
      { r: 255, g: 255, b: 255 } // White
    ];

    for (const color of colors) {
      await this.applyScene({
        id: `test_${Date.now()}`,
        timestamp: Date.now(),
        color: { ...color, name: 'test', hex: '#000000' },
        dimmer: 255,
        fadeTime: 300,
        fixtures: this.fixtures.map(f => ({
          id: f.id,
          universe: f.definition.universe,
          startChannel: f.definition.startChannel,
          channels: { 
            red: color.r,
            green: color.g,
            blue: color.b,
            dimmer: 255 
          }
        }))
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.blackout();
    console.log('✅ Test pattern complete');
  }
}
