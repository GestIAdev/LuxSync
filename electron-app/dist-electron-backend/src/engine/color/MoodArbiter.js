/**
 * 🎭 WAVE 53: MOOD ARBITER - "The Emotion"
 *
 * PROBLEMA: harmony.mode (Major/Minor) y harmony.mood cambian
 *           demasiado rápido, causando fluctuaciones térmicas
 *           visuales (Cálido ↔ Frío) que rompen la inmersión.
 *
 * SOLUCIÓN: Estabilizador emocional con histéresis lenta (5-10s)
 *           que mapea estados musicales a 3 meta-emociones:
 *           - BRIGHT (Major, Lydian, Happy, Energetic)
 *           - DARK (Minor, Locrian, Phrygian, Sad, Tense)
 *           - NEUTRAL (Dorian, Mixolydian, Calm, Peaceful)
 *
 * EFECTO VISUAL:
 * - Techno oscuro (Minor) → Sala fría/seria sostenida
 * - Un sintetizador brillante momentáneo NO cambia todo a BRIGHT
 * - Los cambios de temperatura son deliberados y lentos
 *
 * @author GitHub Copilot (Claude) para GestIAdev
 * @version WAVE 53 - "The Emotion"
 */
/**
 * 🎭 WAVE 53: MOOD ARBITER
 *
 * Estabiliza el estado emocional para evitar fluctuaciones térmicas
 * en la iluminación.
 */
export class MoodArbiter {
    constructor(config = {}) {
        // Buffer circular de votos
        this.voteBuffer = [];
        this.bufferIndex = 0;
        // Estado estable
        this.stableEmotion = 'NEUTRAL';
        this.lastChangeFrame = 0;
        this.isLocked = false;
        // Contadores
        this.frameCount = 0;
        this.totalChanges = 0;
        this.lastLogFrame = 0;
        // Callbacks para reset
        this.onResetCallbacks = [];
        this.config = { ...MoodArbiter.DEFAULT_CONFIG, ...config };
        // Inicializar buffer
        this.voteBuffer = new Array(this.config.bufferSize).fill(null);
        // 🧹 WAVE 63: Log init comentado - solo vibes importan
        // console.log(`[MoodArbiter] 🎭 Initialized: buffer=${this.config.bufferSize} frames (~${(this.config.bufferSize / 60).toFixed(1)}s), locking=${this.config.lockingFrames} frames (~${(this.config.lockingFrames / 60).toFixed(1)}s)`);
    }
    /**
     * 🎭 PROCESO PRINCIPAL
     *
     * Recibe modo y mood, retorna meta-emoción estabilizada.
     */
    update(input) {
        this.frameCount++;
        // === PASO 1: Mapear input a meta-emoción instantánea ===
        const instantEmotion = this.mapToMetaEmotion(input.mode, input.mood);
        // === PASO 2: Calcular peso del voto ===
        let weight = 1.0;
        if (this.config.useEnergyWeighting) {
            // Más energía = más peso (rango 0.5 - 1.5)
            weight *= 0.5 + input.energy;
        }
        // Bonus por confidence alta
        if (input.confidence > 0.7) {
            weight *= this.config.confidenceBonus;
        }
        // === PASO 3: Añadir voto al buffer ===
        this.voteBuffer[this.bufferIndex] = {
            emotion: instantEmotion,
            weight,
            timestamp: this.frameCount,
        };
        this.bufferIndex = (this.bufferIndex + 1) % this.config.bufferSize;
        // === PASO 4: Contar votos ponderados ===
        const votes = { bright: 0, dark: 0, neutral: 0 };
        let totalWeight = 0;
        for (const vote of this.voteBuffer) {
            if (vote === null)
                continue;
            totalWeight += vote.weight;
            switch (vote.emotion) {
                case 'BRIGHT':
                    votes.bright += vote.weight;
                    break;
                case 'DARK':
                    votes.dark += vote.weight;
                    break;
                case 'NEUTRAL':
                    votes.neutral += vote.weight;
                    break;
            }
        }
        // === PASO 5: Calcular dominancia ===
        const brightDominance = totalWeight > 0 ? votes.bright / totalWeight : 0;
        const darkDominance = totalWeight > 0 ? votes.dark / totalWeight : 0;
        const neutralDominance = totalWeight > 0 ? votes.neutral / totalWeight : 0;
        // Encontrar el dominante
        let dominantEmotion = this.stableEmotion;
        let maxDominance = 0;
        if (brightDominance > maxDominance) {
            maxDominance = brightDominance;
            dominantEmotion = 'BRIGHT';
        }
        if (darkDominance > maxDominance) {
            maxDominance = darkDominance;
            dominantEmotion = 'DARK';
        }
        if (neutralDominance > maxDominance) {
            maxDominance = neutralDominance;
            dominantEmotion = 'NEUTRAL';
        }
        // === PASO 6: Aplicar histéresis ===
        let emotionChanged = false;
        const framesSinceChange = this.frameCount - this.lastChangeFrame;
        // ¿Hay suficiente dominancia Y ha pasado suficiente tiempo?
        if (dominantEmotion !== this.stableEmotion &&
            maxDominance >= this.config.dominanceThreshold &&
            framesSinceChange >= this.config.lockingFrames) {
            // ¡Cambio de emoción!
            const oldEmotion = this.stableEmotion;
            this.stableEmotion = dominantEmotion;
            this.lastChangeFrame = this.frameCount;
            this.totalChanges++;
            emotionChanged = true;
            this.isLocked = true;
            console.log(`[MoodArbiter] 🎭 EMOTION SHIFT: ${oldEmotion} → ${this.stableEmotion} (dominance=${(maxDominance * 100).toFixed(1)}%, after ${(framesSinceChange / 60).toFixed(1)}s)`);
        }
        // Desbloquear después de período de locking
        if (this.isLocked && framesSinceChange >= this.config.lockingFrames / 2) {
            this.isLocked = false;
        }
        // === PASO 7: Calcular temperatura termica ===
        // BRIGHT = 1.0 (calido), DARK = 0.0 (frio), NEUTRAL = 0.5
        // WAVE 55: Aplicar Zodiac Affinity (Virgo Easter Egg)
        const thermalTemperature = this.calculateThermalTemperature(votes, totalWeight, input.key);
        // WAVE 55.1: Calcular Zodiac Affinity info para debug
        const earthKeys = ['C', 'F', 'G']; // Tauro, Virgo, Capricornio
        const keyUpper = input.key?.toUpperCase() || null;
        const isEarthSign = keyUpper ? earthKeys.includes(keyUpper) : false;
        const zodiacAffinity = {
            key: keyUpper,
            isEarthSign,
            boost: isEarthSign ? 0.10 : 0,
        };
        // === PASO 8: Log periodico ===
        // 🧹 WAVE 63: Comentado - solo vibes importan
        // if (this.frameCount - this.lastLogFrame > 300) {  // Cada 5 segundos
        //   console.log(`[MoodArbiter] 🎭 Stable=${this.stableEmotion} Instant=${instantEmotion} Dom=${(maxDominance * 100).toFixed(0)}% Temp=${thermalTemperature.toFixed(2)} Votes(B/D/N)=${votes.bright.toFixed(0)}/${votes.dark.toFixed(0)}/${votes.neutral.toFixed(0)}${zodiacAffinity.isEarthSign ? ` ♍ Zodiac=${zodiacAffinity.key}` : ''}`);
        //   this.lastLogFrame = this.frameCount;
        // }
        return {
            stableEmotion: this.stableEmotion,
            instantEmotion,
            emotionChanged,
            framesSinceChange,
            isLocked: this.isLocked,
            dominance: maxDominance,
            thermalTemperature,
            votes,
            zodiacAffinity,
        };
    }
    /**
     * Mapea modo y mood a una meta-emoción
     */
    mapToMetaEmotion(mode, mood) {
        // Prioridad: mood > mode (el mood es más expresivo)
        if (mood) {
            const moodLower = mood.toLowerCase();
            const mappedMood = MoodArbiter.MOOD_MAP[moodLower];
            if (mappedMood)
                return mappedMood;
        }
        if (mode) {
            const modeLower = mode.toLowerCase();
            const mappedMode = MoodArbiter.MODE_MAP[modeLower];
            if (mappedMode)
                return mappedMode;
        }
        // Fallback
        return 'NEUTRAL';
    }
    /**
     * Calcula temperatura térmica continua (0-1)
     * Permite transiciones más suaves que estados discretos
     *
     * WAVE 55: Zodiac Affinity Easter Egg
     * - Si la Key es TIERRA (C/Tauro, F/Virgo, G/Capricornio): +10% brightness
     * - Sutil, pero se siente bien (dedicado al usuario Virgo ♍)
     *
     * WAVE 66.5: Ahora retorna temperatura en KELVIN (2000-10000K)
     * - 0 normalized → 2000K (muy cálido/oscuro)
     * - 0.5 normalized → 6000K (neutral)
     * - 1 normalized → 10000K (muy frío/brillante)
     */
    calculateThermalTemperature(votes, totalWeight, key) {
        if (totalWeight === 0)
            return 4500; // 🔥 WAVE 66.5: Default neutral en Kelvin
        // BRIGHT contribuye +1, DARK contribuye -1, NEUTRAL contribuye 0
        // Resultado normalizado a 0-1
        const rawTemp = (votes.bright - votes.dark) / totalWeight;
        // Mapear de [-1, 1] a [0, 1]
        let temperature = (rawTemp + 1) / 2;
        // 🌍 WAVE 55: Zodiac Affinity (Virgo Easter Egg)
        // Keys de TIERRA obtienen boost de brillo +10%
        const earthKeys = ['C', 'F', 'G']; // Tauro, Virgo, Capricornio
        if (key && earthKeys.includes(key.toUpperCase())) {
            temperature = Math.min(1.0, temperature + 0.10);
        }
        // 🔥 WAVE 66.5: Convertir a Kelvin (2000K-10000K)
        // 0.0 → 2000K (cálido/dark), 0.5 → 6000K (neutral), 1.0 → 10000K (frío/bright)
        // Invertido: BRIGHT es más frío (azul), DARK es más cálido (naranja)
        // Para UX intuitivo: BRIGHT = cálido festivo = 3000K, DARK = frío = 7000K
        // Así que invertimos: 0 (dark) → 7000K, 1 (bright) → 3000K
        const kelvin = 7000 - (temperature * 4000); // Rango: 3000K-7000K
        return Math.round(kelvin);
    }
    /**
     * Registra callback para reset
     */
    onReset(callback) {
        this.onResetCallbacks.push(callback);
    }
    /**
     * 🧹 HARD RESET manual (entre canciones)
     */
    reset() {
        this.voteBuffer = new Array(this.config.bufferSize).fill(null);
        this.bufferIndex = 0;
        this.stableEmotion = 'NEUTRAL';
        this.lastChangeFrame = 0;
        this.isLocked = false;
        this.frameCount = 0;
        this.lastLogFrame = 0;
        console.log('[MoodArbiter] 🧹 RESET: Emotion state cleared');
        // Notificar callbacks
        for (const callback of this.onResetCallbacks) {
            try {
                callback();
            }
            catch (e) {
                console.error('[MoodArbiter] Callback error:', e);
            }
        }
    }
    /**
     * Obtiene el estado emocional actual sin actualizar
     */
    getStableEmotion() {
        return this.stableEmotion;
    }
    /**
     * Obtiene estadísticas para debug
     */
    getStats() {
        const nonNullEntries = this.voteBuffer.filter(v => v !== null).length;
        return {
            stableEmotion: this.stableEmotion,
            totalChanges: this.totalChanges,
            framesSinceChange: this.frameCount - this.lastChangeFrame,
            bufferFullness: nonNullEntries / this.config.bufferSize,
        };
    }
    /**
     * Convierte meta-emoción a modificador de temperatura para SeleneColorEngine
     * BRIGHT → +15° hue shift (más cálido)
     * DARK → -15° hue shift (más frío)
     * NEUTRAL → 0°
     */
    static emotionToHueShift(emotion) {
        switch (emotion) {
            case 'BRIGHT': return 15;
            case 'DARK': return -15;
            case 'NEUTRAL': return 0;
        }
    }
    /**
     * Convierte meta-emoción a modificador de saturación
     * BRIGHT → +10% (más vibrante)
     * DARK → -5% (más sombrío)
     * NEUTRAL → 0%
     */
    static emotionToSaturationShift(emotion) {
        switch (emotion) {
            case 'BRIGHT': return 10;
            case 'DARK': return -5;
            case 'NEUTRAL': return 0;
        }
    }
}
// Mapeo de modos a meta-emociones
MoodArbiter.MODE_MAP = {
    // BRIGHT - Modos mayores/brillantes
    'major': 'BRIGHT',
    'lydian': 'BRIGHT',
    'ionian': 'BRIGHT',
    // DARK - Modos menores/oscuros
    'minor': 'DARK',
    'aeolian': 'DARK',
    'phrygian': 'DARK',
    'locrian': 'DARK',
    'harmonic_minor': 'DARK',
    'melodic_minor': 'DARK',
    // NEUTRAL - Modos ambiguos/mixtos
    'dorian': 'NEUTRAL',
    'mixolydian': 'NEUTRAL',
    'pentatonic': 'NEUTRAL',
    'blues': 'NEUTRAL',
};
// Mapeo de moods a meta-emociones
MoodArbiter.MOOD_MAP = {
    // BRIGHT
    'happy': 'BRIGHT',
    'energetic': 'BRIGHT',
    'euphoric': 'BRIGHT',
    'playful': 'BRIGHT',
    'bluesy': 'BRIGHT', // Blues tiene energía positiva
    'spanish_exotic': 'BRIGHT', // Flamenco es intenso pero cálido
    // DARK
    'sad': 'DARK',
    'tense': 'DARK',
    'dark': 'DARK',
    'dramatic': 'DARK',
    'melancholic': 'DARK',
    'aggressive': 'DARK',
    // NEUTRAL
    'calm': 'NEUTRAL',
    'peaceful': 'NEUTRAL',
    'dreamy': 'NEUTRAL',
    'jazzy': 'NEUTRAL',
    'chill': 'NEUTRAL',
    'neutral': 'NEUTRAL',
};
// Default config
MoodArbiter.DEFAULT_CONFIG = {
    bufferSize: 600, // 10 segundos @ 60fps
    lockingFrames: 300, // 5 segundos para confirmar cambio
    dominanceThreshold: 0.60, // 60% de dominancia requerida
    useEnergyWeighting: true,
    confidenceBonus: 1.5,
};
// Export para uso en workers
export default MoodArbiter;
