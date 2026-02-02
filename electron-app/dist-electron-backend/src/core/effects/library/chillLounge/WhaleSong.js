/**
 * 🐋 WHALE SONG - Canto de Ballena en TWILIGHT (3000-6000m)
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 1073: OCEANIC CALIBRATION - De "estático aburrido" a "majestuoso"
 * WAVE 1085: CHILL LOUNGE FINAL POLISH
 *   - Organic easing curves (ease-in-out cubic)
 *   - Intensity floor: 0.6 (macro-fauna)
 *   - Atmospheric bed: 18% índigo profundo (sensación de inmensidad)
 *   - EXTRA LONG TAIL fade out (la ballena desaparece en la distancia)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * CONCEPTO: Una ballena ENORME cruzando el espacio con PRESENCIA.
 * No es solo un cambio de color - es una SILUETA que se mueve.
 * El "canto" son pulsos de bioluminiscencia que viajan por su cuerpo.
 * La ballena EMERGE majestuosamente, no robóticamente.
 *
 * MECÁNICA WAVE 1073:
 * - La ballena es ANCHA (ocupa varias zonas a la vez)
 * - PULSOS DE CANTO: Ondas que viajan de cola a cabeza
 * - COLORES CAMBIANTES: Índigo/violeta que varían con el canto
 * - MOVERS: Siguen la cabeza de la ballena, MUY LENTO
 *
 * HSL FORMAT: h(0-360), s(0-100), l(0-100)
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 12000, // 🌊 WAVE 1073: 12 segundos - evento MAJESTUOSO
    peakIntensity: 0.80,
    whaleWidth: 0.55, // Ballena ancha
    songPulses: 3, // 3 cantos durante el cruce
    minIntensity: 0.60, // 🌊 WAVE 1085: Floor para macro-fauna
    atmosphericBed: 0.18, // 🌊 WAVE 1085: 18% atmósfera índigo
};
// 🐋 PALETA TWILIGHT BIOLUMINISCENTE
const TWILIGHT_COLORS = {
    // Color base de la ballena
    body: { h: 235, s: 72, l: 32 }, // Índigo profundo
    // Color del "canto" (pulso bioluminiscente)
    song: { h: 275, s: 85, l: 50 }, // Violeta brillante
    // Color de la cola (más oscuro)
    tail: { h: 250, s: 60, l: 25 }, // Azul medianoche
    // Color de la cabeza (más claro)
    head: { h: 265, s: 78, l: 42 }, // Lavanda brillante
};
export class WhaleSong extends BaseEffect {
    constructor(config) {
        super('whale_song');
        this.effectType = 'whale_song';
        this.name = 'Whale Song';
        this.category = 'physical';
        this.priority = 72;
        this.mixBus = 'global'; // 🌊 WAVE 1073: Override completo
        this.direction = 'LtoR';
        this.verticalOffset = 0;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    trigger(triggerConfig) {
        super.trigger(triggerConfig);
        this.direction = Date.now() % 2 === 0 ? 'LtoR' : 'RtoL';
        this.verticalOffset = ((Date.now() % 100) / 100) * 0.2 - 0.1;
        console.log(`[🐋 WHALE] Majestic crossing ${this.direction}, ${this.config.songPulses} songs`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        if (this.elapsedMs >= this.config.durationMs) {
            this.phase = 'finished';
        }
    }
    /**
     * 🎵 Calcula la intensidad del "canto" (pulso bioluminiscente)
     * Los cantos viajan de cola a cabeza
     */
    getSongIntensity(progress, zonePosition) {
        // Frecuencia de los cantos
        const songPhase = progress * this.config.songPulses * Math.PI * 2;
        // El canto viaja como una onda
        const waveOffset = zonePosition * Math.PI * 0.5; // Desfase por posición
        const songWave = Math.sin(songPhase + waveOffset);
        // Solo pulsos positivos (cantos reales, no "anti-cantos")
        return Math.max(0, songWave) ** 2; // Cuadrado para más punch
    }
    /**
     * 🎨 Mezcla color de cuerpo con color de canto
     */
    blendColors(bodyColor, songColor, songIntensity) {
        return {
            h: bodyColor.h + (songColor.h - bodyColor.h) * songIntensity,
            s: bodyColor.s + (songColor.s - bodyColor.s) * songIntensity * 0.5,
            l: bodyColor.l + (songColor.l - bodyColor.l) * songIntensity,
        };
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const progress = this.elapsedMs / this.config.durationMs;
        // 🌊 WAVE 1085: ORGANIC EASING - Ease-in-out cubic
        // La ballena EMERGE majestuosamente, no robóticamente
        const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
        const easedProgress = easeInOutCubic(progress);
        // 🌊 WAVE 1085: INTENSITY FLOOR - Garantizar visibilidad macro-fauna
        const effectiveIntensity = Math.max(this.triggerIntensity, this.config.minIntensity);
        // 🌊 WAVE 1085: Envelope con EXTRA LONG TAIL (ballena desaparece en la distancia)
        // Entrada: 20% (majestuosa) | Sustain: 45% | Fade out EXTRA LARGO: 35%
        let envelope;
        if (progress < 0.20) {
            envelope = easeInOutCubic(progress / 0.20); // Entrada orgánica majestuosa
        }
        else if (progress < 0.65) {
            envelope = 1.0;
        }
        else {
            // 🌊 WAVE 1085: EXTRA LONG TAIL - La ballena se desvanece lentamente
            const fadeOutProgress = (progress - 0.65) / 0.35;
            envelope = (1 - fadeOutProgress) ** 3.0; // Curva cúbica para long tail
        }
        // 🌊 WAVE 1085: ATMOSPHERIC BED - Índigo profundo que "tiñe" el tanque
        const atmosphericAmbient = this.config.atmosphericBed * envelope * effectiveIntensity;
        const atmosphericColor = { h: 240, s: 55, l: 22 }; // Índigo muy profundo
        // 🐋 Posición de la ballena con ondulación natural + EASING
        let basePosition = easedProgress * 1.2 - 0.1;
        // Ondulación S sutil (la ballena "nada") con easing
        const swimWave = Math.sin(easedProgress * Math.PI * 1.5) * 0.08;
        let whaleCenter = basePosition + swimWave + this.verticalOffset;
        if (this.direction === 'RtoL') {
            whaleCenter = 1 - whaleCenter;
        }
        // Respiración profunda (la ballena respira cada ~4 segundos)
        const breathCycle = Math.sin(easedProgress * Math.PI * 3) * 0.12 + 0.88;
        // 🌊 WAVE 1073: Zonas con partes del cuerpo de la ballena
        // La ballena tiene: COLA --- CUERPO --- CABEZA
        // Mapeo: Las zonas más alejadas del centro = cola, cercanas = cuerpo, delante = cabeza
        const zonePositions = {
            frontL: { pos: 0.0, bodyPart: this.direction === 'LtoR' ? 'head' : 'tail' },
            backL: { pos: 0.18, bodyPart: 'body' },
            movers_left: { pos: 0.35, bodyPart: 'body' },
            movers_right: { pos: 0.65, bodyPart: 'body' },
            backR: { pos: 0.82, bodyPart: 'body' },
            frontR: { pos: 1.0, bodyPart: this.direction === 'LtoR' ? 'tail' : 'head' },
        };
        // Función para calcular presencia de la ballena en una zona
        const getWhalePresence = (zonePos) => {
            const distance = Math.abs(zonePos - whaleCenter);
            if (distance > this.config.whaleWidth)
                return 0;
            const normalized = distance / this.config.whaleWidth;
            // Curva suave (ballena = masa suave, no afilada)
            return Math.exp(-normalized * normalized * 1.5) * breathCycle;
        };
        // 🐋 Movimiento de movers siguiendo la CABEZA de la ballena
        // Muy lento, muy suave, con EASING
        const headPosition = this.direction === 'LtoR'
            ? whaleCenter + this.config.whaleWidth * 0.4
            : whaleCenter - this.config.whaleWidth * 0.4;
        const moverPan = (headPosition - 0.5) * 40; // Rango reducido
        const moverTilt = Math.sin(easedProgress * Math.PI * 0.6) * 5 - 5; // Mirando ligeramente abajo
        // 🌊 WAVE 1085: Intensidad final con floor aplicado
        const finalPeakIntensity = this.config.peakIntensity * effectiveIntensity;
        const output = {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: ['frontL', 'frontR', 'backL', 'backR', 'movers_left', 'movers_right'],
            intensity: effectiveIntensity * envelope * this.config.peakIntensity,
            zoneOverrides: {},
        };
        // 🎨 Aplicar cada zona con su color de parte del cuerpo + canto + ATMOSPHERIC BED
        for (const [zoneName, zoneData] of Object.entries(zonePositions)) {
            const presence = getWhalePresence(zoneData.pos);
            // 🌊 WAVE 1085: Si no hay ballena, usar atmospheric bed en lugar de negro
            if (presence < 0.01) {
                output.zoneOverrides[zoneName] = {
                    dimmer: atmosphericAmbient, // 🌊 WAVE 1085: Atmósfera en lugar de 0
                    color: atmosphericColor,
                    blendMode: 'replace',
                };
                continue;
            }
            // Color base según parte del cuerpo
            const bodyColor = TWILIGHT_COLORS[zoneData.bodyPart];
            // Intensidad del canto en esta zona
            const songIntensity = this.getSongIntensity(easedProgress, zoneData.pos); // 🌊 WAVE 1085: easing
            // Mezclar color de cuerpo con canto
            const finalColor = this.blendColors(bodyColor, TWILIGHT_COLORS.song, songIntensity);
            // Atenuación por parte del cuerpo
            const partAttenuation = zoneData.bodyPart === 'head' ? 1.0
                : zoneData.bodyPart === 'body' ? 0.85
                    : 0.65; // Cola más tenue
            // 🌊 WAVE 1085: Math.max entre ballena y atmospheric bed
            const whaleIntensity = presence * envelope * finalPeakIntensity * partAttenuation;
            output.zoneOverrides[zoneName] = {
                dimmer: Math.max(whaleIntensity, atmosphericAmbient),
                color: whaleIntensity > atmosphericAmbient ? finalColor : atmosphericColor,
                blendMode: 'replace',
            };
        }
        // 🐋 Movers con movimiento ULTRA LENTO + EASING
        output.zoneOverrides['movers_left'] = {
            ...output.zoneOverrides['movers_left'],
            movement: {
                pan: moverPan - 12,
                tilt: moverTilt,
                isAbsolute: false,
                speed: 0.12,
            },
        };
        output.zoneOverrides['movers_right'] = {
            ...output.zoneOverrides['movers_right'],
            movement: {
                pan: moverPan + 12,
                tilt: moverTilt,
                isAbsolute: false,
                speed: 0.12,
            },
        };
        return output;
    }
    isFinished() { return this.phase === 'finished'; }
    abort() { this.phase = 'finished'; }
}
