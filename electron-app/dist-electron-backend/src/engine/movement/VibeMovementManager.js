/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 VIBE MOVEMENT MANAGER - WAVE 345: THE CHOREOGRAPHER BLUEPRINT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * RESPONSABILIDAD ÚNICA: Generación de patrones de movimiento
 *
 * WAVE 345 UPGRADES:
 * - FASE 1: Patrones calculan FULL RANGE (-1 a +1), amplitud se aplica AL FINAL
 * - FASE 2: Librería de patrones por género (Techno, Latino, Rock, Chill)
 * - FASE 3: Cerebro de decisión híbrido (energy + barCount)
 *
 * ARQUITECTURA:
 *
 *   TitanEngine (ORQUESTADOR)
 *        │
 *        │  "Dame movimiento para Latino con energy 0.7, bar 12"
 *        ▼
 *   VibeMovementManager (COREÓGRAFO)
 *        │
 *        │  1. Selecciona patrón según vibe + energy + phrase
 *        │  2. Calcula FULL RANGE (-1, +1)
 *        │  3. Escala por amplitud del vibe
 *        │  4. Retorna: { x: -0.7, y: 0.4 }
 *        ▼
 *   FixturePhysicsDriver (FÍSICO)
 *
 * @layer ENGINE/MOVEMENT
 * @version WAVE 345 - The Choreographer Blueprint
 */
// ═══════════════════════════════════════════════════════════════════════════
// 🎨 VIBE CONFIGURATIONS - WAVE 345
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Cada vibe tiene:
 * - amplitudeScale: Techno=1.0 (full), Chill=0.3 (sutil)
 * - baseFrequency: Velocidad de los patrones
 * - patterns: Lista de patrones que puede usar (varía con phrase)
 */
const VIBE_CONFIG = {
    // 🎛️ TECHNO: Robótico, lineal, agresivo
    'techno-club': {
        amplitudeScale: 1.0, // FULL RANGE - sin reducir
        baseFrequency: 0.25, // Moderado-rápido
        patterns: ['sweep', 'skySearch', 'botStabs'],
        homeOnSilence: false,
    },
    // 💃 LATINO: Curvas, caderas, fluido
    'fiesta-latina': {
        amplitudeScale: 0.85, // Amplio pero no agresivo
        baseFrequency: 0.15, // Suave, sensual
        patterns: ['figure8', 'circle', 'snake'],
        homeOnSilence: false,
    },
    // 🎸 ROCK: Impacto, gravedad, poder
    'pop-rock': {
        amplitudeScale: 0.75, // Movimiento con peso
        baseFrequency: 0.2, // Moderado
        patterns: ['blinder', 'vShape', 'wave'],
        homeOnSilence: true,
    },
    // 🍸 CHILL: Fluido, ambiente, sutil
    'chill-lounge': {
        amplitudeScale: 0.35, // MUY sutil
        baseFrequency: 0.05, // Ultra lento
        patterns: ['ocean', 'drift', 'nebula'],
        homeOnSilence: true,
    },
    // 💤 IDLE: Respiración mínima
    'idle': {
        amplitudeScale: 0.1,
        baseFrequency: 0.08,
        patterns: ['static'],
        homeOnSilence: true,
    },
};
const PATTERNS = {
    // ═══════════════════════════════════════════════════════════════════════
    // 🎛️ TECHNO PATTERNS (Robótico / Lineal)
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * SWEEP: Barrido horizontal completo
     * Pan oscila full range, Tilt fijo (mínimo movimiento con bass)
     */
    sweep: (t, phase, audio) => ({
        x: Math.sin(phase), // FULL RANGE -1 a +1
        y: -0.2 + audio.bass * 0.15, // Ligero movimiento con bass
    }),
    /**
     * SKY SEARCH: Pan gira lento, Tilt barre arriba (busca el cielo)
     * Como si buscara aviones
     */
    skySearch: (t, phase, audio) => ({
        x: Math.sin(phase * 0.5), // Pan lento
        y: -Math.abs(Math.sin(phase)), // Tilt hacia ARRIBA (negativo)
    }),
    /**
     * BOT STABS: Posiciones cuantizadas, cambia cada 4 beats
     * Usa números primos para parecer random pero ser determinista
     */
    botStabs: (t, phase, audio) => {
        // Cuantizar el tiempo a grupos de ~1 segundo (simula 4 beats @ 120bpm)
        const quantizedT = Math.floor(t * 0.5) * 2;
        // Posiciones pseudo-random deterministas
        const x = Math.sin(quantizedT * 1.618); // Golden ratio
        const y = Math.cos(quantizedT * 2.236) * 0.6; // √5
        return { x, y };
    },
    /**
     * MIRROR: Base para efecto puertas del infierno
     * HAL invierte L/R, aquí solo generamos la oscilación base
     */
    mirror: (t, phase, audio) => ({
        x: Math.sin(phase), // FULL RANGE
        y: Math.sin(phase * 2) * 0.4 - Math.pow(audio.bass, 2) * 0.3,
    }),
    // ═══════════════════════════════════════════════════════════════════════
    // 💃 LATINO PATTERNS (Curvas / Caderas)
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * FIGURE8: Lissajous clásico (1:2 ratio)
     * Las caderas de la cumbia
     */
    figure8: (t, phase, audio) => ({
        x: Math.sin(phase), // FULL RANGE
        y: Math.sin(phase * 2) * 0.6, // Doble frecuencia
    }),
    /**
     * CIRCLE: Rotación perfecta
     * Elegante, sensual
     */
    circle: (t, phase, audio) => ({
        x: Math.sin(phase), // FULL RANGE
        y: Math.cos(phase) * 0.7, // Casi círculo (elipse suave)
    }),
    /**
     * SNAKE: Onda sinusoidal con desfase entre fixtures
     * El famoso "snake effect"
     */
    snake: (t, phase, audio, index = 0, total = 1) => {
        const fixturePhase = (index / Math.max(total, 1)) * Math.PI * 2;
        return {
            x: Math.sin(phase + fixturePhase) * 0.7,
            y: Math.sin(phase * 0.5 + fixturePhase) * 0.5,
        };
    },
    // ═══════════════════════════════════════════════════════════════════════
    // 🎸 ROCK PATTERNS (Impacto / Gravedad)
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * BLINDER: Tilt baja de golpe, sube lento
     * El clásico "punch al público"
     */
    blinder: (t, phase, audio) => {
        // Usar sin^3 para curva agresiva (baja rápido, sube lento)
        const tiltCurve = -Math.pow(Math.abs(Math.sin(phase)), 3);
        return {
            x: Math.sin(phase * 0.3) * 0.3, // Pan casi estático
            y: tiltCurve, // FULL RANGE hacia abajo
        };
    },
    /**
     * V-SHAPE: Fixtures forman V apuntando al centro
     * Pares izquierda, impares derecha
     */
    vShape: (t, phase, audio, index = 0, total = 1) => {
        const isLeft = index % 2 === 0;
        const spread = Math.sin(phase * 0.2) * 0.3 + 0.6; // 0.3 a 0.9
        return {
            x: isLeft ? -spread : spread, // Separación L/R
            y: -0.3 + audio.bass * 0.2, // Miran al frente
        };
    },
    /**
     * WAVE: Ondulación lateral (Pink Floyd style)
     */
    wave: (t, phase, audio) => ({
        x: Math.sin(phase), // FULL RANGE horizontal
        y: Math.sin(phase * 0.5) * 0.4, // Vertical más lento
    }),
    /**
     * CHAOS: Perlin-like noise para drops extremos
     * Usa múltiples senos con frecuencias irracionales
     */
    chaos: (t, phase, audio) => {
        // Sumar múltiples ondas con frecuencias irracionales
        const x = Math.sin(t * 1.618) * 0.5 +
            Math.sin(t * 2.718) * 0.3 +
            Math.sin(t * 3.14159) * 0.2;
        const y = Math.cos(t * 1.414) * 0.4 +
            Math.cos(t * 2.236) * 0.3 +
            Math.cos(t * 1.732) * 0.3;
        return { x, y };
    },
    // ═══════════════════════════════════════════════════════════════════════
    // 🍸 CHILL PATTERNS (Fluido / Ambiente)
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * OCEAN: Olas de mar ultra lentas
     */
    ocean: (t, phase, audio) => ({
        x: Math.sin(phase * 0.3) * 0.4, // Pan casi estático
        y: Math.sin(phase), // Tilt como olas
    }),
    /**
     * DRIFT: Movimiento browniano muy lento (polvo flotando)
     */
    drift: (t, phase, audio) => {
        // Múltiples frecuencias muy bajas para parecer random
        const x = Math.sin(t * 0.1) * 0.4 + Math.sin(t * 0.17) * 0.3;
        const y = Math.cos(t * 0.13) * 0.3 + Math.cos(t * 0.19) * 0.2;
        return { x, y };
    },
    /**
     * NEBULA: Respiración zen, movimiento mínimo
     */
    nebula: (t, phase, audio) => ({
        x: Math.sin(phase * 0.5) * 0.2,
        y: Math.sin(phase) * 0.3,
    }),
    // ═══════════════════════════════════════════════════════════════════════
    // 💤 UTILITY PATTERNS
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * STATIC: Respiración zen mínima
     */
    static: (t, phase, audio) => ({
        x: 0,
        y: Math.sin(phase) * 0.1 + audio.bass * 0.15,
    }),
    /**
     * CHASE: Persecución láser rápida
     */
    chase: (t, phase, audio) => ({
        x: Math.sin(phase * 2), // FULL RANGE, doble velocidad
        y: audio.bass * 0.2 - 0.1,
    }),
    /**
     * PULSE: Hacia centro en cada beat
     */
    pulse: (t, phase, audio) => {
        const beatDecay = Math.pow(1 - audio.beatPhase, 3);
        return {
            x: 0,
            y: -beatDecay * 0.8, // FULL RANGE en Y
        };
    },
};
// ═══════════════════════════════════════════════════════════════════════════
// 🧠 VIBE MOVEMENT MANAGER - MAIN CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class VibeMovementManager {
    constructor() {
        this.time = 0;
        this.lastUpdate = Date.now();
        this.frameCount = 0;
        this.barCount = 0;
        this.lastBeatCount = 0;
        // WAVE 346: AGC-style dynamic threshold
        this.energyHistory = [];
        this.ENERGY_HISTORY_SIZE = 120; // ~2 segundos @ 60fps
        this.averageEnergy = 0.5; // Default inicial
    }
    /**
     * 🎯 GENERA INTENT DE MOVIMIENTO
     *
     * WAVE 345 FLOW:
     * 1. Seleccionar patrón según (vibe + energy + phrase)
     * 2. Calcular posición FULL RANGE
     * 3. Escalar por amplitudeScale del vibe
     * 4. Retornar
     */
    generateIntent(vibeId, audio, fixtureIndex = 0, totalFixtures = 1) {
        // Actualizar tiempo interno
        const now = Date.now();
        const deltaTime = (now - this.lastUpdate) / 1000;
        this.lastUpdate = now;
        this.time += deltaTime;
        this.frameCount++;
        // ═══════════════════════════════════════════════════════════════════════
        // WAVE 346: AGC-STYLE DYNAMIC THRESHOLD
        // Mantener historial de energía para umbral adaptativo
        // ═══════════════════════════════════════════════════════════════════════
        this.energyHistory.push(audio.energy);
        if (this.energyHistory.length > this.ENERGY_HISTORY_SIZE) {
            this.energyHistory.shift(); // Mantener solo los últimos N frames
        }
        // Calcular promedio móvil
        if (this.energyHistory.length > 0) {
            const sum = this.energyHistory.reduce((a, b) => a + b, 0);
            this.averageEnergy = sum / this.energyHistory.length;
        }
        // Actualizar contador de compases (beats / 4)
        const beatCount = audio.beatCount || 0;
        if (beatCount !== this.lastBeatCount) {
            if (beatCount % 4 === 0) {
                this.barCount++;
            }
            this.lastBeatCount = beatCount;
        }
        // Obtener configuración del vibe
        const config = VIBE_CONFIG[vibeId] || VIBE_CONFIG['idle'];
        // === FASE 3: CEREBRO DE DECISIÓN ===
        const patternName = this.selectPattern(vibeId, config, audio, this.barCount);
        // Si hay muy poca energía, home position
        if (audio.energy < 0.05 && config.homeOnSilence) {
            return {
                x: 0,
                y: 0,
                pattern: 'home',
                speed: 0,
                amplitude: 0,
                _frequency: 0,
                _phrase: Math.floor(this.barCount / 8),
            };
        }
        // === FASE 2: CALCULAR PATRÓN (FULL RANGE) ===
        const phase = Math.PI * 2 * config.baseFrequency * this.time;
        const patternFn = PATTERNS[patternName] || PATTERNS['static'];
        const rawPosition = patternFn(this.time, phase, audio, fixtureIndex, totalFixtures);
        // === FASE 1: ESCALAR POR AMPLITUDE DEL VIBE ===
        const energyBoost = 1.0 + audio.energy * 0.2; // Hasta +20% con energía máxima
        const vibeScale = config.amplitudeScale * energyBoost;
        // ═══════════════════════════════════════════════════════════════════════
        // 🚗 WAVE 347.8: THE GEARBOX - Dynamic Amplitude Scaling
        // 
        // En lugar de pedir velocidades absurdas que destruyen el hardware,
        // reducimos automáticamente la amplitud para que el motor SIEMPRE
        // llegue a tiempo al beat.
        // 
        // Física: Velocidad = Distancia / Tiempo
        // - Tiempo: Lo marca la música (BPM). NO SE TOCA.
        // - Velocidad: La limita el motor (Hardware). NO SE TOCA.
        // - Distancia: ¡Esta es la variable que ajustamos!
        // 
        // Es como un bajista tocando rápido: si la canción es muy rápida,
        // no mueve el brazo entero, mueve solo la muñeca.
        // ═══════════════════════════════════════════════════════════════════════
        // Hardware speed limit (DMX units per second)
        // EL-1140 y movers chinos baratos: ~200-300 DMX/s realista
        // Movers de gama alta: ~400-600 DMX/s
        const HARDWARE_MAX_SPEED = 250; // DMX/s - conservador para EL-1140
        // 🛡️ WAVE 348: NaN/Infinity SAFETY GUARD
        // Si BPM es 0, undefined, null, NaN → CRASH
        // Fallback: 120 BPM (tempo estándar)
        const safeBPM = (audio.bpm && audio.bpm > 0 && isFinite(audio.bpm))
            ? Math.max(60, audio.bpm) // Min 60 BPM
            : 120; // Fallback seguro
        const secondsPerBeat = 60 / safeBPM;
        // 🛡️ Validar que secondsPerBeat está en rango cuerdo (0.1s - 10s)
        // 600 BPM (muy rápido) = 0.1s | 6 BPM (ridículo lento) = 10s
        if (!isFinite(secondsPerBeat) || secondsPerBeat <= 0 || secondsPerBeat > 10) {
            console.error(`[🚗 GEARBOX] ❌ Invalid secondsPerBeat: ${secondsPerBeat} (bpm=${audio.bpm})`);
            // Emergency brake: Devolver intent vacío
            const emptyIntent = {
                pattern: patternName,
                x: 0,
                y: 0,
                speed: 0,
                amplitude: 0,
            };
            return emptyIntent;
        }
        // Distancia máxima que el motor puede recorrer en un beat
        const maxTravelPerBeat = HARDWARE_MAX_SPEED * secondsPerBeat;
        // Distancia que el patrón quiere recorrer (full DMX range * scale)
        // Un sweep completo = 255 DMX (0 a 255), pero ida y vuelta = 255 * 2 = 510
        // Sin embargo, para un HALF cycle (solo ida O vuelta), usamos 255
        const requestedTravel = 255 * vibeScale;
        // THE GEARBOX: Factor de reducción automática
        // Si requestedTravel > maxTravelPerBeat, reducimos la amplitud
        const gearboxFactor = Math.min(1.0, maxTravelPerBeat / requestedTravel);
        // Escala final = vibeScale * gearbox
        const finalScale = vibeScale * gearboxFactor;
        // Log del gearbox cada ~2 segundos (solo si está reduciendo)
        if (this.frameCount % 60 === 0 && gearboxFactor < 0.95) {
            console.log(`[🚗 GEARBOX] BPM:${safeBPM} | Requested:${requestedTravel.toFixed(0)} DMX | Budget:${maxTravelPerBeat.toFixed(0)} DMX | Factor:${gearboxFactor.toFixed(2)} (${(gearboxFactor * 100).toFixed(0)}% amplitude)`);
        }
        const position = {
            x: rawPosition.x * finalScale,
            y: rawPosition.y * finalScale,
        };
        // Clamp a [-1, +1] por seguridad
        position.x = Math.max(-1, Math.min(1, position.x));
        position.y = Math.max(-1, Math.min(1, position.y));
        // Log cada ~500ms para debug
        // WAVE 346: Incluir umbral dinámico y avgEnergy
        if (this.frameCount % 30 === 0) {
            const panDeg = Math.round(position.x * 270);
            const tiltDeg = Math.round(position.y * 135);
            const threshold = Math.max(0.05, this.averageEnergy * 0.5);
            console.log(`[🎯 VMM] ${vibeId} | ${patternName} | phrase:${Math.floor(this.barCount / 8)} | E:${audio.energy.toFixed(2)} (avg:${this.averageEnergy.toFixed(2)} thr:${threshold.toFixed(2)}) | Pan:${panDeg}° Tilt:${tiltDeg}°`);
        }
        return {
            x: position.x,
            y: position.y,
            pattern: patternName,
            speed: config.baseFrequency,
            amplitude: finalScale,
            _frequency: config.baseFrequency,
            _phrase: Math.floor(this.barCount / 8),
        };
    }
    /**
     * 🧠 SELECCIÓN DINÁMICA DE PATRÓN
     *
     * Lógica híbrida:
     * 1. VETO por energía baja → patrón calmado (WAVE 346: umbral dinámico)
     * 2. SELECCIÓN por phrase (cada 8 compases)
     */
    selectPattern(vibeId, config, audio, barCount) {
        const phrase = Math.floor(barCount / 8); // Cambia cada 8 compases
        const patterns = config.patterns;
        // Si no hay patrones, fallback
        if (patterns.length === 0)
            return 'static';
        // ═══════════════════════════════════════════════════════════════════════
        // WAVE 346: DYNAMIC ENERGY THRESHOLD (AGC-style)
        // En lugar de 0.3 fijo, usamos 50% del promedio histórico
        // ═══════════════════════════════════════════════════════════════════════
        const dynamicThreshold = this.averageEnergy * 0.5;
        const effectiveThreshold = Math.max(0.05, dynamicThreshold); // Nunca menos de 5%
        // === VETO POR ENERGÍA BAJA (con umbral adaptativo) ===
        if (audio.energy < effectiveThreshold) {
            // Forzar patrón más calmado (último del array por convención)
            switch (vibeId) {
                case 'techno-club':
                    return 'skySearch'; // Busca cielo, no agresivo
                case 'fiesta-latina':
                    return 'snake'; // Suave ondulación
                case 'pop-rock':
                    return 'wave'; // Ondas relajadas
                case 'chill-lounge':
                    return 'drift'; // Ultra sutil
                default:
                    return patterns[patterns.length - 1];
            }
        }
        // === SELECCIÓN DINÁMICA POR PHRASE ===
        // Rotar entre patrones disponibles cada 8 compases
        const patternIndex = phrase % patterns.length;
        return patterns[patternIndex];
    }
    /**
     * 📊 Obtener configuración de vibe
     */
    getVibeConfig(vibeId) {
        return VIBE_CONFIG[vibeId] || VIBE_CONFIG['idle'];
    }
    /**
     * 📚 Obtener todos los patrones disponibles
     */
    getAvailablePatterns() {
        return Object.keys(PATTERNS);
    }
    /**
     * 🔄 Reset del tiempo interno
     */
    resetTime() {
        this.time = 0;
        this.lastUpdate = Date.now();
        this.barCount = 0;
        this.lastBeatCount = 0;
        // WAVE 346: Reset energy history
        this.energyHistory = [];
        this.averageEnergy = 0.5;
    }
    /**
     * ⏱️ Obtener tiempo actual
     */
    getTime() {
        return this.time;
    }
    /**
     * 🎼 Obtener compás actual
     */
    getBarCount() {
        return this.barCount;
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════
export const vibeMovementManager = new VibeMovementManager();
export default vibeMovementManager;
