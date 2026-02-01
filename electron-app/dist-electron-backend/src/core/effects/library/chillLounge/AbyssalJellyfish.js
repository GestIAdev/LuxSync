/**
 *  ABYSSAL JELLYFISH - Medusa Bioluminiscente en MIDNIGHT (6000+m)
 * WAVE 1070.6: CHROMATIC RENAISSANCE
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 12000,
    peakIntensity: 0.95,
    moverIntensity: 0.80,
    colorRotationMs: 3000,
};
const BIOLUMINESCENT_PALETTE = {
    leftColors: [
        { h: 300 / 360, s: 0.95, l: 0.42 },
        { h: 285 / 360, s: 0.90, l: 0.38 },
        { h: 270 / 360, s: 0.85, l: 0.45 },
        { h: 315 / 360, s: 0.88, l: 0.40 },
    ],
    rightColors: [
        { h: 165 / 360, s: 0.95, l: 0.50 },
        { h: 180 / 360, s: 0.90, l: 0.45 },
        { h: 195 / 360, s: 0.85, l: 0.52 },
        { h: 150 / 360, s: 0.88, l: 0.48 },
    ],
};
export class AbyssalJellyfish extends BaseEffect {
    constructor(config) {
        super('abyssal_jellyfish');
        this.effectType = 'abyssal_jellyfish';
        this.name = 'Abyssal Jellyfish';
        this.category = 'physical';
        this.priority = 65;
        this.mixBus = 'htp';
        this.colorIndex = 0;
        this.lastColorRotation = 0;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    trigger(triggerConfig) {
        super.trigger(triggerConfig);
        this.colorIndex = 0;
        this.lastColorRotation = Date.now();
        console.log(`[AbyssalJellyfish] TRIGGERED! 6-ZONE STEREO BIOLUMINESCENCE`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        const now = Date.now();
        if (now - this.lastColorRotation > this.config.colorRotationMs) {
            this.colorIndex = (this.colorIndex + 1) % BIOLUMINESCENT_PALETTE.leftColors.length;
            this.lastColorRotation = now;
        }
        if (this.elapsedMs >= this.config.durationMs) {
            this.phase = 'finished';
        }
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const progress = this.elapsedMs / this.config.durationMs;
        let envelope;
        if (progress < 0.10) {
            envelope = progress / 0.10;
        }
        else if (progress < 0.85) {
            envelope = 1.0;
        }
        else {
            envelope = 1 - ((progress - 0.85) / 0.15);
        }
        const pulsePhase = progress * Math.PI * 8;
        const pulse = (Math.sin(pulsePhase) + 1) / 2 * 0.25 + 0.75;
        const leftColor = BIOLUMINESCENT_PALETTE.leftColors[this.colorIndex];
        const rightColor = BIOLUMINESCENT_PALETTE.rightColors[this.colorIndex];
        const waveOffset = Math.sin(progress * Math.PI * 4) * 0.15;
        const frontIntensity = (0.9 + waveOffset) * pulse;
        const backIntensity = (0.75 - waveOffset) * pulse;
        const driftPan = Math.sin(progress * Math.PI * 2) * 20;
        const driftTilt = Math.cos(progress * Math.PI * 3) * 15;
        const output = {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: ['frontL', 'frontR', 'backL', 'backR', 'movers_left', 'movers_right'],
            intensity: this.triggerIntensity * envelope * this.config.peakIntensity,
            zoneOverrides: {},
        };
        output.zoneOverrides['frontL'] = { dimmer: frontIntensity * envelope * this.config.peakIntensity, color: leftColor, blendMode: 'max' };
        output.zoneOverrides['frontR'] = { dimmer: frontIntensity * envelope * this.config.peakIntensity, color: rightColor, blendMode: 'max' };
        output.zoneOverrides['backL'] = { dimmer: backIntensity * envelope * this.config.peakIntensity, color: leftColor, blendMode: 'max' };
        output.zoneOverrides['backR'] = { dimmer: backIntensity * envelope * this.config.peakIntensity, color: rightColor, blendMode: 'max' };
        output.zoneOverrides['movers_left'] = { dimmer: pulse * envelope * this.config.moverIntensity, color: leftColor, blendMode: 'max', movement: { pan: driftPan - 30, tilt: driftTilt - 10 } };
        output.zoneOverrides['movers_right'] = { dimmer: pulse * envelope * this.config.moverIntensity, color: rightColor, blendMode: 'max', movement: { pan: driftPan + 30, tilt: driftTilt + 5 } };
        return output;
    }
    isFinished() { return this.phase === 'finished'; }
    abort() { this.phase = 'finished'; }
}
