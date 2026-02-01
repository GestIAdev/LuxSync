/**
 *  SCHOOL OF FISH - Banco de Peces Cruzando
 * WAVE 1070.6: CHROMATIC RENAISSANCE
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 3500,
    peakIntensity: 0.90,
    direction: 'random',
    fishCount: 7,
};
const FISH_COLORS = [
    { h: 185 / 360, s: 0.85, l: 0.60 },
    { h: 195 / 360, s: 0.70, l: 0.70 },
    { h: 170 / 360, s: 0.90, l: 0.55 },
    { h: 200 / 360, s: 0.60, l: 0.75 },
];
export class SchoolOfFish extends BaseEffect {
    constructor(config) {
        super('school_of_fish');
        this.effectType = 'school_of_fish';
        this.name = 'School of Fish';
        this.category = 'physical';
        this.priority = 70;
        this.mixBus = 'htp';
        this.actualDirection = 'LtoR';
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    trigger(triggerConfig) {
        super.trigger(triggerConfig);
        if (this.config.direction === 'random') {
            this.actualDirection = Date.now() % 2 === 0 ? 'LtoR' : 'RtoL';
        }
        else {
            this.actualDirection = this.config.direction;
        }
        console.log(`[SchoolOfFish] TRIGGERED! Direction=${this.actualDirection}`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        if (this.elapsedMs >= this.config.durationMs) {
            this.phase = 'finished';
        }
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const progress = this.elapsedMs / this.config.durationMs;
        let envelope;
        if (progress < 0.08) {
            envelope = progress / 0.08;
        }
        else if (progress < 0.80) {
            envelope = 1.0;
        }
        else {
            envelope = 1 - ((progress - 0.80) / 0.20);
        }
        let wavePosition = progress * 1.3 - 0.15;
        if (this.actualDirection === 'RtoL') {
            wavePosition = 1 - wavePosition;
        }
        const fishPhase = progress * this.config.fishCount * Math.PI * 2;
        const fishPulse = (Math.sin(fishPhase) + 1) / 2 * 0.3 + 0.7;
        const zonePositions = {
            frontL: 0.0, backL: 0.15, movers_left: 0.30,
            movers_right: 0.70, backR: 0.85, frontR: 1.0,
        };
        const waveWidth = 0.35;
        const getZoneIntensity = (zonePos) => {
            const distance = Math.abs(zonePos - wavePosition);
            if (distance > waveWidth)
                return 0;
            const normalized = distance / waveWidth;
            return Math.exp(-normalized * normalized * 3) * fishPulse;
        };
        const getZoneColor = (zonePos) => {
            const relativePos = (zonePos - wavePosition + 0.5);
            const colorIndex = Math.floor(Math.abs(relativePos * FISH_COLORS.length * 2)) % FISH_COLORS.length;
            return FISH_COLORS[colorIndex];
        };
        const basePan = (wavePosition - 0.5) * 80;
        const tiltWobble = Math.sin(progress * Math.PI * 6) * 5;
        const output = {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: ['frontL', 'frontR', 'backL', 'backR', 'movers_left', 'movers_right'],
            intensity: this.triggerIntensity * envelope * this.config.peakIntensity,
            zoneOverrides: {},
        };
        output.zoneOverrides['frontL'] = {
            dimmer: getZoneIntensity(zonePositions.frontL) * envelope * this.config.peakIntensity,
            color: getZoneColor(zonePositions.frontL),
            blendMode: 'max',
        };
        output.zoneOverrides['frontR'] = {
            dimmer: getZoneIntensity(zonePositions.frontR) * envelope * this.config.peakIntensity,
            color: getZoneColor(zonePositions.frontR),
            blendMode: 'max',
        };
        output.zoneOverrides['backL'] = {
            dimmer: getZoneIntensity(zonePositions.backL) * envelope * this.config.peakIntensity * 0.85,
            color: getZoneColor(zonePositions.backL),
            blendMode: 'max',
        };
        output.zoneOverrides['backR'] = {
            dimmer: getZoneIntensity(zonePositions.backR) * envelope * this.config.peakIntensity * 0.85,
            color: getZoneColor(zonePositions.backR),
            blendMode: 'max',
        };
        output.zoneOverrides['movers_left'] = {
            dimmer: getZoneIntensity(zonePositions.movers_left) * envelope * this.config.peakIntensity * 0.90,
            color: getZoneColor(zonePositions.movers_left),
            blendMode: 'max',
            movement: { pan: basePan - 15, tilt: tiltWobble - 10 },
        };
        output.zoneOverrides['movers_right'] = {
            dimmer: getZoneIntensity(zonePositions.movers_right) * envelope * this.config.peakIntensity * 0.90,
            color: getZoneColor(zonePositions.movers_right),
            blendMode: 'max',
            movement: { pan: basePan + 15, tilt: tiltWobble + 5 },
        };
        return output;
    }
    isFinished() { return this.phase === 'finished'; }
    abort() { this.phase = 'finished'; }
}
