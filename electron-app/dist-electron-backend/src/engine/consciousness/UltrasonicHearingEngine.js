/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                      🎧 ULTRASONIC HEARING ENGINE 🎧
 *                   "El Oído que Escucha la Matemática del Sonido"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Analiza intervalos musicales entre notas consecutivas
 * y calcula la consonancia (qué tan "bien" suenan juntas)
 *
 * Basado en teoría musical:
 * - Unísono y Octava = máxima consonancia
 * - Quinta justa = alta consonancia
 * - Tritono = máxima disonancia
 *
 * Wave 4 - Despertar Felino
 * Arquitecto: Claude + PunkGrok
 */
// ============================================================================
// 🎧 ULTRASONIC HEARING ENGINE
// ============================================================================
export class UltrasonicHearingEngine {
    constructor() {
        // 🎼 Mapeo de notas a valores numéricos (semitonos desde DO)
        this.NOTE_VALUES = {
            'DO': 0,
            'RE': 2,
            'MI': 4,
            'FA': 5,
            'SOL': 7,
            'LA': 9,
            'SI': 11,
        };
        // 🎵 Consonancia de cada intervalo (basado en teoría musical)
        // 1.0 = perfectamente consonante, 0.0 = máxima disonancia
        this.INTERVAL_CONSONANCE = {
            0: { name: 'unison', consonance: 1.00, description: 'Unísono - Identidad perfecta' },
            1: { name: 'minor_second', consonance: 0.15, description: 'Segunda menor - Tensión extrema' },
            2: { name: 'major_second', consonance: 0.30, description: 'Segunda mayor - Movimiento' },
            3: { name: 'minor_third', consonance: 0.70, description: 'Tercera menor - Melancolía' },
            4: { name: 'major_third', consonance: 0.80, description: 'Tercera mayor - Alegría' },
            5: { name: 'perfect_fourth', consonance: 0.85, description: 'Cuarta justa - Suspensión' },
            6: { name: 'tritone', consonance: 0.05, description: 'Tritono - El diablo en la música' },
            7: { name: 'perfect_fifth', consonance: 0.95, description: 'Quinta justa - Poder y estabilidad' },
            8: { name: 'minor_sixth', consonance: 0.65, description: 'Sexta menor - Dulce tristeza' },
            9: { name: 'major_sixth', consonance: 0.75, description: 'Sexta mayor - Luminosidad' },
            10: { name: 'minor_seventh', consonance: 0.35, description: 'Séptima menor - Blues, jazz' },
            11: { name: 'major_seventh', consonance: 0.25, description: 'Séptima mayor - Tensión sofisticada' },
            12: { name: 'octave', consonance: 0.98, description: 'Octava - Renacimiento' },
        };
        // 🔥 Compatibilidad entre elementos zodiacales
        this.ELEMENTAL_HARMONY = {
            fire: {
                fire: 0.70, // Mismo elemento - intenso pero puede quemar
                earth: 0.40, // Fuego vs Tierra - conflicto
                air: 0.90, // Fuego + Aire = ¡EXPLOSIÓN!
                water: 0.20, // Fuego vs Agua - se apagan
            },
            earth: {
                fire: 0.40,
                earth: 0.80, // Tierra + Tierra = Estabilidad
                air: 0.50, // Tierra vs Aire - diferentes
                water: 0.85, // Tierra + Agua = Crecimiento
            },
            air: {
                fire: 0.90,
                earth: 0.50,
                air: 0.65, // Aire + Aire = Dispersión
                water: 0.70, // Aire + Agua = Nubes, cambio
            },
            water: {
                fire: 0.20,
                earth: 0.85,
                air: 0.70,
                water: 0.75, // Agua + Agua = Profundidad
            },
        };
        // 📊 Historial de intervalos para análisis de tendencias
        this.intervalHistory = [];
        this.HISTORY_SIZE = 20;
    }
    /**
     * 🎵 ANALIZA INTERVALO ENTRE DOS NOTAS
     * El corazón del engine - donde la matemática se vuelve música
     */
    analyzeInterval(currentNote, previousNote, currentElement, previousElement) {
        // 1. Calcular distancia en semitonos
        const currentValue = this.NOTE_VALUES[currentNote];
        const previousValue = this.NOTE_VALUES[previousNote];
        // Distancia absoluta (siempre positiva, dentro de una octava)
        let semitones = Math.abs(currentValue - previousValue);
        if (semitones > 6) {
            semitones = 12 - semitones; // Invertir si es más de media octava
        }
        // 2. Obtener info del intervalo
        const intervalInfo = this.INTERVAL_CONSONANCE[semitones] || this.INTERVAL_CONSONANCE[0];
        // 3. Calcular armonía elemental
        const elementalHarmony = this.ELEMENTAL_HARMONY[currentElement][previousElement];
        // 4. Calcular consonancia total (70% musical + 30% elemental)
        const totalConsonance = intervalInfo.consonance * 0.7 + elementalHarmony * 0.3;
        const analysis = {
            intervalName: intervalInfo.name,
            semitones,
            consonance: intervalInfo.consonance,
            elementalHarmony,
            totalConsonance,
            description: intervalInfo.description,
        };
        // 5. Guardar en historial
        this.intervalHistory.push(analysis);
        if (this.intervalHistory.length > this.HISTORY_SIZE) {
            this.intervalHistory.shift();
        }
        return analysis;
    }
    /**
     * 🎵 ANALIZA CONSONANCIA DESDE NOTAS EN STRING
     * Versión simplificada para uso directo
     */
    analyzeFromStrings(currentNote, previousNote, currentElement, previousElement) {
        return this.analyzeInterval(currentNote, previousNote, currentElement, previousElement);
    }
    // ============================================================================
    // ANÁLISIS DE TENDENCIAS
    // ============================================================================
    /**
     * 📈 Obtiene consonancia promedio reciente
     */
    getAverageConsonance() {
        if (this.intervalHistory.length === 0)
            return 0.5;
        const sum = this.intervalHistory.reduce((acc, i) => acc + i.totalConsonance, 0);
        return sum / this.intervalHistory.length;
    }
    /**
     * 📊 Detecta si estamos en una secuencia armónica o disonante
     */
    getHarmonicTrend() {
        const avg = this.getAverageConsonance();
        if (avg > 0.7)
            return 'harmonic';
        if (avg < 0.4)
            return 'dissonant';
        return 'neutral';
    }
    /**
     * 🎯 Obtiene el intervalo más común reciente
     */
    getDominantInterval() {
        if (this.intervalHistory.length === 0)
            return null;
        const counts = new Map();
        for (const interval of this.intervalHistory) {
            const count = (counts.get(interval.intervalName) || 0) + 1;
            counts.set(interval.intervalName, count);
        }
        let maxCount = 0;
        let dominant = null;
        counts.forEach((count, name) => {
            if (count > maxCount) {
                maxCount = count;
                dominant = name;
            }
        });
        return dominant;
    }
    /**
     * ⚡ Detecta si hubo un cambio brusco de consonancia
     */
    detectConsonanceShift() {
        if (this.intervalHistory.length < 5) {
            return { detected: false, direction: 'none', magnitude: 0 };
        }
        const recent = this.intervalHistory.slice(-5);
        const earlier = this.intervalHistory.slice(-10, -5);
        if (earlier.length === 0) {
            return { detected: false, direction: 'none', magnitude: 0 };
        }
        const recentAvg = recent.reduce((a, i) => a + i.totalConsonance, 0) / recent.length;
        const earlierAvg = earlier.reduce((a, i) => a + i.totalConsonance, 0) / earlier.length;
        const diff = recentAvg - earlierAvg;
        const magnitude = Math.abs(diff);
        if (magnitude > 0.2) {
            return {
                detected: true,
                direction: diff > 0 ? 'up' : 'down',
                magnitude,
            };
        }
        return { detected: false, direction: 'none', magnitude };
    }
    // ============================================================================
    // UTILIDADES
    // ============================================================================
    /**
     * 🔄 Reset del engine
     */
    reset() {
        this.intervalHistory = [];
    }
    /**
     * 📊 Obtener historial de intervalos
     */
    getIntervalHistory() {
        return [...this.intervalHistory];
    }
    /**
     * 🎵 Obtener último intervalo analizado
     */
    getLastInterval() {
        return this.intervalHistory[this.intervalHistory.length - 1] || null;
    }
    /**
     * 🐛 Debug info
     */
    getDebugInfo() {
        return {
            historyLength: this.intervalHistory.length,
            averageConsonance: this.getAverageConsonance(),
            harmonicTrend: this.getHarmonicTrend(),
            dominantInterval: this.getDominantInterval(),
            lastInterval: this.getLastInterval(),
        };
    }
    /**
     * 🎼 Obtener consonancia directa entre dos notas (sin elementos)
     */
    getIntervalConsonance(note1, note2) {
        const value1 = this.NOTE_VALUES[note1];
        const value2 = this.NOTE_VALUES[note2];
        let semitones = Math.abs(value1 - value2);
        if (semitones > 6)
            semitones = 12 - semitones;
        return this.INTERVAL_CONSONANCE[semitones]?.consonance || 0.5;
    }
}
// Export singleton
export const ultrasonicHearingEngine = new UltrasonicHearingEngine();
