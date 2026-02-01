/**
 *  WHALE SONG - Canto de Ballena en TWILIGHT (3000-6000m)
 * WAVE 1070.6: CHROMATIC RENAISSANCE
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 8000,
    peakIntensity: 0.80,
    whaleWidth: 0.45,
};
const TWILIGHT_COLORS = [
    { h: 240 / 360, s: 0.75, l: 0.35 },
    { h: 260 / 360, s: 0.70, l: 0.40 },
    { h: 220 / 360, s: 0.80, l: 0.30 },
    { h: 250 / 360, s: 0.65, l: 0.45 },
];
export class WhaleSong extends BaseEffect {
    constructor(config) {
        super('whale_song');
        this.effectType = 'whale_song';
        this.name = 'Whale Song';
        this.category = 'physical';
        this.priority = 72;
        this.mixBus = 'htp';
        this.direction = 'LtoR';
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    trigger(triggerConfig) {
        super.trigger(triggerConfig);
        this.direction = Date.now() % 2 === 0 ? 'LtoR' : 'RtoL';
        console.log(`[WhaleSong] TRIGGERED! Direction=${this.direction}`);
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
        if (progress < 0.15) {
            envelope = (progress / 0.15) ** 2;
        }
        else if (progress < 0.85) {
            envelope = 1.0;
        }
        else {
            envelope = ((1 - ((progress - 0.85) / 0.15)) ** 2);
        }
        let whaleCenter = progress * 1.4 - 0.2;
        if (this.direction === 'RtoL') {
            whaleCenter = 1 - whaleCenter;
        }
        const breathCycle = Math.sin(progress * Math.PI * 3) * 0.15 + 0.85;
        const zonePositions = {
            frontL: 0.0, backL: 0.15, movers_left: 0.35,
            movers_right: 0.65, backR: 0.85, frontR: 1.0,
        };
        const getZoneIntensity = (zonePos) => {
            const distance = Math.abs(zonePos - whaleCenter);
            if (distance > this.config.whaleWidth)
                return 0;
            const normalized = distance / this.config.whaleWidth;
            return Math.exp(-normalized * normalized * 2.5) * breathCycle;
        };
        const getZoneColor = (zonePos) => {
            const relativePos = zonePos - whaleCenter + this.config.whaleWidth;
            const normalizedPos = relativePos / (this.config.whaleWidth * 2);
            const colorIndex = Math.floor(normalizedPos * TWILIGHT_COLORS.length) % TWILIGHT_COLORS.length;
            const safeIndex = Math.max(0, Math.min(colorIndex, TWILIGHT_COLORS.length - 1));
            return TWILIGHT_COLORS[safeIndex];
        };
        const whalePan = (whaleCenter - 0.5) * 60;
        const whaleTilt = Math.sin(progress * Math.PI * 2) * 10 - 15;
        const output = {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: ['frontL', 'frontR', 'backL', 'backR', 'movers_left', 'movers_right'],
            intensity: this.triggerIntensity * envelope * this.config.peakIntensity,
            zoneOverrides: {},
        };
        output.zoneOverrides['frontL'] = { dimmer: getZoneIntensity(zonePositions.frontL) * envelope * this.config.peakIntensity, color: getZoneColor(zonePositions.frontL), blendMode: 'max' };
        output.zoneOverrides['frontR'] = { dimmer: getZoneIntensity(zonePositions.frontR) * envelope * this.config.peakIntensity, color: getZoneColor(zonePositions.frontR), blendMode: 'max' };
        output.zoneOverrides['backL'] = { dimmer: getZoneIntensity(zonePositions.backL) * envelope * this.config.peakIntensity * 0.80, color: getZoneColor(zonePositions.backL), blendMode: 'max' };
        output.zoneOverrides['backR'] = { dimmer: getZoneIntensity(zonePositions.backR) * envelope * this.config.peakIntensity * 0.80, color: getZoneColor(zonePositions.backR), blendMode: 'max' };
        output.zoneOverrides['movers_left'] = { dimmer: getZoneIntensity(zonePositions.movers_left) * envelope * this.config.peakIntensity * 0.85, color: getZoneColor(zonePositions.movers_left), blendMode: 'max', movement: { pan: whalePan - 15, tilt: whaleTilt } };
        output.zoneOverrides['movers_right'] = { dimmer: getZoneIntensity(zonePositions.movers_right) * envelope * this.config.peakIntensity * 0.85, color: getZoneColor(zonePositions.movers_right), blendMode: 'max', movement: { pan: whalePan + 15, tilt: whaleTilt + 5 } };
        return output;
    }
    isFinished() { return this.phase === 'finished'; }
    abort() { this.phase = 'finished'; }
}
