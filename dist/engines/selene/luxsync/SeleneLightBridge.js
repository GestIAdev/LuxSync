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
import { NoteToColorMapper } from './NoteToColorMapper.js';
import { VisualEffects } from './effects/VisualEffects.js';
/**
 * Main bridge class
 */
export class SeleneLightBridge {
    audioAdapter;
    seleneCore;
    dmxDriver;
    visualEffects;
    running = false;
    intervalId = null;
    targetFps = 30;
    frameTime = 1000 / this.targetFps; // ~33ms
    // Statistics
    stats = {
        framesProcessed: 0,
        lastNote: 'RE',
        lastBeauty: 0.5,
        lastColor: NoteToColorMapper.mapNoteToColor('RE'),
        averageFps: 0,
        errors: 0,
        uptime: 0
    };
    startTime = 0;
    lastFrameTime = 0;
    fpsHistory = [];
    // Últimas métricas de audio capturadas (guardadas cada frame)
    lastMetrics = null;
    constructor(audioAdapter, seleneCore, dmxDriver) {
        this.audioAdapter = audioAdapter;
        this.seleneCore = seleneCore;
        this.dmxDriver = dmxDriver;
        this.visualEffects = new VisualEffects();
    }
    /**
     * Start the bridge (begin processing loop)
     */
    async start() {
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
        this.intervalId = window.setInterval(() => this.tick(), this.frameTime);
    }
    /**
     * Stop the bridge
     */
    stop() {
        if (!this.running)
            return;
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
    async tick() {
        if (!this.running)
            return;
        const frameStart = Date.now();
        try {
            // 1. Capture audio → metrics
            const metrics = await this.audioAdapter.captureMetrics();
            // Guardar las métricas para que buildScene pueda mapear por banda
            this.lastMetrics = metrics;
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
        }
        catch (error) {
            this.stats.errors++;
            console.error('❌ Bridge tick error:', error);
        }
        // Calculate actual FPS
        const frameEnd = Date.now();
        const frameDuration = frameEnd - frameStart;
        const actualFps = 1000 / Math.max(1, frameEnd - this.lastFrameTime);
        this.fpsHistory.push(actualFps);
        if (this.fpsHistory.length > 30)
            this.fpsHistory.shift();
        this.lastFrameTime = frameEnd;
        // Warn if frame took too long
        if (frameDuration > this.frameTime * 1.5) {
            console.warn(`⚠️  Slow frame: ${frameDuration}ms (target: ${this.frameTime}ms)`);
        }
    }
    /**
     * Process metrics through Selene consciousness
     */
    async processWithSelene(metrics) {
        // This is a simplified adapter - in real implementation, you'd call:
        // const result = await this.seleneCore.processSystemMetrics(metrics);
        // Ensure all values are valid numbers before calculation
        const bassLevel = isNaN(metrics.cpu) ? 0.5 : metrics.cpu;
        const midLevel = isNaN(metrics.memory) ? 0.5 : metrics.memory;
        const latency = isNaN(metrics.latency) ? 50 : metrics.latency;
        const trebleLevel = 1 - latency / 100;
        // 🌈 MAPEO COMPLETO DE 7 COLORES (Escala Cromática Musical)
        // Cada nota tiene condiciones específicas para activarse
        let note;
        if (bassLevel > 0.7 && midLevel < 0.35 && trebleLevel < 0.35) {
            // 🔴 DO (Red): Bass explosivo puro (bombos, 808s)
            note = 'DO';
        }
        else if (bassLevel > 0.5 && midLevel > 0.35 && trebleLevel < 0.4) {
            // 🟠 RE (Orange): Bass + Mid (groove, bajo con melodía)
            note = 'RE';
        }
        else if (bassLevel < 0.4 && midLevel > 0.6 && trebleLevel < 0.5) {
            // 🟡 MI (Yellow): Mid puro (guitarras, voces, piano)
            note = 'MI';
        }
        else if (midLevel > 0.5 && trebleLevel > 0.45 && bassLevel < 0.5) {
            // 🟢 FA (Green): Mid + Treble (sintetizadores, pads)
            note = 'FA';
        }
        else if (midLevel > 0.4 && trebleLevel > 0.55 && bassLevel < 0.4) {
            // 🔵 SOL (Cyan): Mid-High (transición, armonías altas)
            note = 'SOL';
        }
        else if (trebleLevel > 0.65 && midLevel < 0.45 && bassLevel < 0.35) {
            // 💙 LA (Blue): Treble dominante (hi-hats, shakers)
            note = 'LA';
        }
        else if (trebleLevel > 0.75 && bassLevel < 0.25) {
            // 💜 SI (Magenta): Treble explosivo (crashes, platillos, FX)
            note = 'SI';
        }
        else {
            // Fallback inteligente: elige por frecuencia dominante
            if (bassLevel > midLevel && bassLevel > trebleLevel) {
                note = 'DO'; // Rojo
            }
            else if (trebleLevel > bassLevel && trebleLevel > midLevel) {
                note = 'LA'; // Azul
            }
            else {
                note = 'MI'; // Amarillo (centro)
            }
        }
        // Calculate beauty with enhanced sensitivity
        const totalEnergy = bassLevel + midLevel + trebleLevel;
        let beauty = Math.pow(totalEnergy / 2.0, 0.8);
        // Amplify peaks for dramatic highs
        if (beauty > 0.7) {
            beauty = 0.7 + (beauty - 0.7) * 1.5;
        }
        // Never go fully dark (minimum 10% visibility)
        if (beauty < 0.2) {
            beauty = Math.max(0.1, beauty * 0.7);
        }
        beauty = Math.max(0, Math.min(1, beauty));
        return {
            musicalNote: note,
            beauty,
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
    buildScene(seleneOutput) {
        // Base color from main note
        const baseColor = NoteToColorMapper.mapNoteToColor(seleneOutput.musicalNote);
        const baseDimmer = NoteToColorMapper.mapBeautyToIntensity(seleneOutput.beauty);
        const fadeTime = this.extractFadeTime(seleneOutput.midiSequence);
        // Get all fixtures
        const allFixtures = this.dmxDriver.getFixtures();
        const fixtureCount = allFixtures.length;
        // Map each fixture to different frequency zones (4 groups of 2 PARs)
        const metrics = this.lastMetrics || { cpu: 0.5, memory: 0.5, latency: 50 };
        const bassLevel = isNaN(metrics.cpu) ? 0.5 : metrics.cpu;
        const midLevel = isNaN(metrics.memory) ? 0.5 : metrics.memory;
        const latencyVal = isNaN(metrics.latency) ? 50 : metrics.latency;
        const trebleLevel = 1 - latencyVal / 100;
        const fixtures = allFixtures.map((fixture, index) => {
            let fixtureColor = { ...baseColor };
            let fixtureDimmer = baseDimmer;
            if (fixtureCount === 8) {
                // Group 1 (PAR 1-2): Bajos
                if (index === 0 || index === 1) {
                    const note = this.getBassNote(bassLevel, midLevel, trebleLevel);
                    fixtureColor = NoteToColorMapper.mapNoteToColor(note);
                    fixtureDimmer = Math.max(30, baseDimmer * (0.5 + bassLevel * 0.5));
                }
                // Group 2 (PAR 3-4): Medios bajos
                else if (index === 2 || index === 3) {
                    const note = this.getMidLowNote(bassLevel, midLevel, trebleLevel);
                    fixtureColor = NoteToColorMapper.mapNoteToColor(note);
                    fixtureDimmer = Math.max(20, baseDimmer * (0.4 + midLevel * 0.6));
                }
                // Group 3 (PAR 5-6): Medios altos
                else if (index === 4 || index === 5) {
                    const note = this.getMidHighNote(bassLevel, midLevel, trebleLevel);
                    fixtureColor = NoteToColorMapper.mapNoteToColor(note);
                    fixtureDimmer = Math.max(20, baseDimmer * (0.4 + midLevel * 0.6));
                }
                // Group 4 (PAR 7-8): Agudos
                else if (index === 6 || index === 7) {
                    const note = this.getTrebleNote(bassLevel, midLevel, trebleLevel);
                    fixtureColor = NoteToColorMapper.mapNoteToColor(note);
                    fixtureDimmer = Math.max(20, baseDimmer * (0.4 + trebleLevel * 0.6));
                }
            }
            else {
                // Fallback: rainbow spread for non-8 setups
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
                    red: Math.round(fixtureColor.r),
                    green: Math.round(fixtureColor.g),
                    blue: Math.round(fixtureColor.b),
                    dimmer: Math.min(255, Math.round(fixtureDimmer))
                }
            };
        });
        // 🎨 APPLY VISUAL EFFECTS on top of frequency routing
        // This adds dynamic patterns (chase, wave, strobe, etc.)
        const audioMetrics = {
            bass: seleneOutput.beauty, // Simplified: use beauty as bass proxy
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
                    const rgb = this.hslToRgb((this.rgbToHue(fixture.channels.red, fixture.channels.green, fixture.channels.blue) + modifier.colorShift) % 360, 100, 50);
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
    rgbToHue(r, g, b) {
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
            }
            else if (max === g) {
                h = ((b - r) / d + 2) / 6;
            }
            else {
                h = ((r - g) / d + 4) / 6;
            }
        }
        return h * 360;
    }
    /**
     * Métodos privados: mapeo de nota dominante por banda
     */
    getBassNote(bass, mid, treble) {
        if (bass > 0.7 && mid < 0.35 && treble < 0.35)
            return 'DO';
        if (bass > 0.5 && mid > 0.35 && treble < 0.4)
            return 'RE';
        return 'DO';
    }
    getMidLowNote(bass, mid, treble) {
        if (mid > 0.6 && bass < 0.4 && treble < 0.5)
            return 'MI';
        if (mid > 0.5 && treble > 0.45 && bass < 0.5)
            return 'FA';
        return 'MI';
    }
    getMidHighNote(bass, mid, treble) {
        if (mid > 0.4 && treble > 0.55 && bass < 0.4)
            return 'SOL';
        if (treble > 0.65 && mid < 0.45 && bass < 0.35)
            return 'LA';
        return 'SOL';
    }
    getTrebleNote(bass, mid, treble) {
        if (treble > 0.75 && bass < 0.25)
            return 'SI';
        if (treble > 0.65)
            return 'LA';
        return 'SI';
    }
    /**
     * HSL to RGB conversion for rainbow effects
     */
    hslToRgb(h, s, l) {
        s /= 100;
        l /= 100;
        const k = (n) => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return [
            Math.round(255 * f(0)),
            Math.round(255 * f(8)),
            Math.round(255 * f(4))
        ];
    }
    /**
     * Extract fade time from MIDI sequence (Fibonacci timing)
     */
    extractFadeTime(midiSequence) {
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
    generatePoem(note, beauty) {
        const poems = {
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
    generateMidiSequence(note) {
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
    updateStats(seleneOutput, scene, frameStart) {
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
    logStatus(seleneOutput, scene) {
        console.log(`🎵 ${seleneOutput.musicalNote} | ` +
            `Beauty: ${seleneOutput.beauty.toFixed(2)} | ` +
            `Color: ${scene.color.name} (${scene.color.hex}) | ` +
            `Dimmer: ${scene.dimmer} | ` +
            `FPS: ${this.stats.averageFps.toFixed(1)}`);
    }
    /**
     * Get current statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Check if bridge is running
     */
    isRunning() {
        return this.running;
    }
    /**
     * Get current target FPS
     */
    getTargetFps() {
        return this.targetFps;
    }
    /**
     * Set target FPS (will apply on next start)
     */
    setTargetFps(fps) {
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
    setEffect(mode, speed = 0.5, intensity = 0.5) {
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
    clearEffects() {
        this.visualEffects.setEffect({ mode: 'none' });
        console.log('🎨 Effects cleared');
    }
}
//# sourceMappingURL=SeleneLightBridge.js.map