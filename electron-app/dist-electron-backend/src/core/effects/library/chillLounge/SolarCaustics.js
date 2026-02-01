/**
 *  SOLAR CAUSTICS - Rayos de Sol en SHALLOWS (0-1000m)
 * WAVE 1070.6: CHROMATIC RENAISSANCE
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 5000,
    peakIntensity: 0.85,
    patternSpeed: 1.0,
    rayCount: 4,
};
const SOLAR_COLORS = [
    { h: 45 / 360, s: 0.90, l: 0.65 },
    { h: 35 / 360, s: 0.85, l: 0.60 },
    { h: 55 / 360, s: 0.70, l: 0.70 },
    { h: 30 / 360, s: 0.95, l: 0.55 },
];
export class SolarCaustics extends BaseEffect {
    constructor(config) {
        super('solar_caustics');
        this.effectType = 'solar_caustics';
        this.name = 'Solar Caustics';
        this.category = 'physical';
        this.priority = 75;
        this.mixBus = 'htp';
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    trigger(triggerConfig) {
        super.trigger(triggerConfig);
        console.log(`[SolarCaustics] TRIGGERED! Duration=${this.config.durationMs}ms`);
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
        const now = Date.now();
        const speed = this.config.patternSpeed;
        let envelope;
        if (progress < 0.10) {
            envelope = progress / 0.10;
        }
        else if (progress < 0.75) {
            envelope = 1.0;
        }
        else {
            envelope = 1 - ((progress - 0.75) / 0.25);
        }
        envelope = envelope * envelope * (3 - 2 * envelope);
        const zonePositions = {
            frontL: { x: 0.0, y: 0.0 }, frontR: { x: 1.0, y: 0.0 },
            backL: { x: 0.0, y: 1.0 }, backR: { x: 1.0, y: 1.0 },
            movers_left: { x: 0.25, y: 0.5 }, movers_right: { x: 0.75, y: 0.5 },
        };
        const getCausticIntensity = (x, y) => {
            let intensity = 0;
            for (let i = 0; i < this.config.rayCount; i++) {
                const rayAngle = (i * Math.PI * 2) / this.config.rayCount;
                const rayFreq = 1800 + i * 400;
                const rayX = Math.sin(rayAngle) * 0.5;
                const rayY = Math.cos(rayAngle) * 0.5;
                const rayPos = (now * speed) / rayFreq;
                const distToRay = Math.sin(rayPos + x * rayX * 10 + y * rayY * 10);
                const ripple = Math.sin(rayPos * 0.7 + (x + y) * 5);
                intensity += Math.max(0, (distToRay + ripple * 0.4) / 1.4);
            }
            return intensity / this.config.rayCount;
        };
        const getZoneColor = (x, y) => {
            const colorPhase = (now / 2000 + x * 2 + y) % (SOLAR_COLORS.length);
            const colorIndex = Math.floor(colorPhase);
            const nextIndex = (colorIndex + 1) % SOLAR_COLORS.length;
            const blend = colorPhase - colorIndex;
            const c1 = SOLAR_COLORS[colorIndex];
            const c2 = SOLAR_COLORS[nextIndex];
            return { h: c1.h + (c2.h - c1.h) * blend, s: c1.s + (c2.s - c1.s) * blend, l: c1.l + (c2.l - c1.l) * blend };
        };
        const basePan = Math.sin(now / 4000) * 30;
        const baseTilt = Math.cos(now / 3500) * 15 - 25;
        const output = {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: ['frontL', 'frontR', 'backL', 'backR', 'movers_left', 'movers_right'],
            intensity: this.triggerIntensity * envelope * this.config.peakIntensity,
            zoneOverrides: {},
        };
        const flPos = zonePositions.frontL;
        output.zoneOverrides['frontL'] = { dimmer: getCausticIntensity(flPos.x, flPos.y) * envelope * this.config.peakIntensity, color: getZoneColor(flPos.x, flPos.y), blendMode: 'max' };
        const frPos = zonePositions.frontR;
        output.zoneOverrides['frontR'] = { dimmer: getCausticIntensity(frPos.x, frPos.y) * envelope * this.config.peakIntensity, color: getZoneColor(frPos.x, frPos.y), blendMode: 'max' };
        const blPos = zonePositions.backL;
        output.zoneOverrides['backL'] = { dimmer: getCausticIntensity(blPos.x, blPos.y) * envelope * this.config.peakIntensity * 0.75, color: getZoneColor(blPos.x, blPos.y), blendMode: 'max' };
        const brPos = zonePositions.backR;
        output.zoneOverrides['backR'] = { dimmer: getCausticIntensity(brPos.x, brPos.y) * envelope * this.config.peakIntensity * 0.75, color: getZoneColor(brPos.x, brPos.y), blendMode: 'max' };
        const mlPos = zonePositions.movers_left;
        output.zoneOverrides['movers_left'] = { dimmer: getCausticIntensity(mlPos.x, mlPos.y) * envelope * this.config.peakIntensity * 0.90, color: getZoneColor(mlPos.x, mlPos.y), blendMode: 'max', movement: { pan: basePan - 20, tilt: baseTilt } };
        const mrPos = zonePositions.movers_right;
        output.zoneOverrides['movers_right'] = { dimmer: getCausticIntensity(mrPos.x, mrPos.y) * envelope * this.config.peakIntensity * 0.90, color: getZoneColor(mrPos.x, mrPos.y), blendMode: 'max', movement: { pan: basePan + 20, tilt: baseTilt + Math.sin(now / 2000) * 5 } };
        return output;
    }
    isFinished() { return this.phase === 'finished'; }
    abort() { this.phase = 'finished'; }
}
