/**
 * ⚓ WAVE 51: KEY STABILIZER - "El Ancla"
 *
 * PROBLEMA: El color base (HUE) cambia frenéticamente porque harmony.key
 *           cambia con cada acorde de paso.
 *
 * SOLUCIÓN: Implementar inercia estadística con buffer circular y locking.
 *
 * REGLAS:
 * 1. Mantener buffer de últimos 5-8 segundos de detecciones de Key
 * 2. Calcular MODA (key más frecuente) = StableKey
 * 3. Para cambiar StableKey, la nueva key debe dominar 3+ segundos
 * 4. El cambio de Key es RARO - solo en modulaciones reales o cambio de track
 *
 * RESULTADO: Canción en Do Mayor → sala ROJA todo el tiempo,
 *            aunque suenen acordes de Fa (Verde) o Sol (Azul).
 *
 * @author GitHub Copilot (Claude) para GestIAdev
 * @version WAVE 51 - "Key Stabilization"
 */
/**
 * ⚓ WAVE 51: KEY STABILIZER
 *
 * Estabiliza la detección de Key musical para evitar cambios frenéticos de color.
 * Usa buffer circular, votación ponderada y locking temporal.
 */
export class KeyStabilizer {
    constructor(config = {}) {
        // Buffer circular de detecciones
        this.keyBuffer = [];
        this.bufferIndex = 0;
        // Estado de estabilización
        this.stableKey = null;
        this.candidateKey = null;
        this.candidateFrames = 0; // Frames que la candidata ha sido dominante
        // Métricas
        this.frameCount = 0;
        this.lastLogFrame = 0;
        this.keyChanges = 0;
        this.config = { ...KeyStabilizer.DEFAULT_CONFIG, ...config };
        // Inicializar buffer vacío
        this.keyBuffer = new Array(this.config.bufferSize).fill({ key: null, weight: 0 });
        // 🧹 WAVE 63: Log init comentado - solo vibes importan
        // console.log(`[KeyStabilizer] ⚓ Initialized: buffer=${this.config.bufferSize} frames (~${(this.config.bufferSize / 60).toFixed(1)}s), locking=${this.config.lockingFrames} frames (~${(this.config.lockingFrames / 60).toFixed(1)}s)`);
    }
    /**
     * ⚓ PROCESO PRINCIPAL
     *
     * Recibe la Key detectada en cada frame y retorna la Key estabilizada.
     */
    update(input) {
        this.frameCount++;
        // === PASO 1: Calcular peso del voto ===
        let weight = 1.0;
        // Ignorar detecciones con baja confianza
        if (input.confidence < this.config.minConfidence) {
            weight = 0;
        }
        // Ponderar por energía si está habilitado
        if (this.config.useEnergyWeighting && weight > 0) {
            weight = Math.pow(Math.max(0.1, input.energy), this.config.energyPower);
        }
        // === PASO 2: Añadir al buffer circular ===
        this.keyBuffer[this.bufferIndex] = {
            key: input.key,
            weight: weight,
        };
        this.bufferIndex = (this.bufferIndex + 1) % this.config.bufferSize;
        // === PASO 3: Calcular MODA (key más votada) ===
        const votes = this.calculateVotes();
        const { dominantKey, dominantVotes, totalVotes } = this.findDominantKey(votes);
        // === PASO 4: Lógica de LOCKING ===
        const dominanceRatio = totalVotes > 0 ? dominantVotes / totalVotes : 0;
        const isDominant = dominanceRatio >= this.config.dominanceThreshold;
        let isChanging = false;
        let changeProgress = 0;
        if (isDominant && dominantKey !== null) {
            if (dominantKey === this.stableKey) {
                // La key dominante es la actual - resetear candidatura
                this.candidateKey = null;
                this.candidateFrames = 0;
            }
            else if (dominantKey === this.candidateKey) {
                // La candidata sigue siendo dominante - incrementar contador
                this.candidateFrames++;
                isChanging = true;
                changeProgress = this.candidateFrames / this.config.lockingFrames;
                // ¿Ya pasó el umbral de locking?
                if (this.candidateFrames >= this.config.lockingFrames) {
                    // ¡CAMBIO DE KEY!
                    const oldKey = this.stableKey;
                    this.stableKey = dominantKey;
                    this.candidateKey = null;
                    this.candidateFrames = 0;
                    this.keyChanges++;
                    // Log solo cambios de key (evento raro)
                    console.log(`[KeyStabilizer] 🎵 KEY CHANGE: ${oldKey ?? 'NULL'} → ${this.stableKey} (after ${this.config.lockingFrames} frames, ${this.keyChanges} total changes)`);
                }
            }
            else {
                // Nueva candidata diferente - empezar de cero
                this.candidateKey = dominantKey;
                this.candidateFrames = 1;
                isChanging = true;
                changeProgress = 1 / this.config.lockingFrames;
            }
        }
        else {
            // No hay key dominante clara - no hay candidata
            // Pero NO reseteamos inmediatamente para evitar flickering
            if (this.candidateFrames > 0) {
                this.candidateFrames = Math.max(0, this.candidateFrames - 1);
                isChanging = this.candidateFrames > 0;
                changeProgress = this.candidateFrames / this.config.lockingFrames;
            }
        }
        // === PASO 5: Primera key estable ===
        // Si no hay key estable todavía, usar la dominante directamente
        if (this.stableKey === null && dominantKey !== null && isDominant) {
            this.stableKey = dominantKey;
            console.log(`[KeyStabilizer] 🎵 Initial key detected: ${this.stableKey}`);
        }
        // === PASO 6: Log periódico ===
        // 🧹 WAVE 63: Comentado - solo vibes importan
        // if (this.frameCount - this.lastLogFrame > 300) {  // Cada 5 segundos
        //   const topKeys = Object.entries(votes)
        //     .sort(([, a], [, b]) => b - a)
        //     .slice(0, 3)
        //     .map(([k, v]) => `${k}:${(v / totalVotes * 100).toFixed(0)}%`)
        //     .join(', ');
        //   
        //   console.log(`[KeyStabilizer] ⚓ Stable=${this.stableKey ?? '?'} Candidate=${this.candidateKey ?? '-'} Progress=${(changeProgress * 100).toFixed(0)}% Votes=[${topKeys}]`);
        //   this.lastLogFrame = this.frameCount;
        // }
        return {
            stableKey: this.stableKey,
            instantKey: input.key,
            confidence: dominanceRatio,
            isChanging,
            changeProgress,
            candidateKey: this.candidateKey,
            voteDistribution: votes,
        };
    }
    /**
     * Calcula los votos ponderados por key
     */
    calculateVotes() {
        const votes = {};
        for (const entry of this.keyBuffer) {
            if (entry.key !== null && entry.weight > 0) {
                votes[entry.key] = (votes[entry.key] || 0) + entry.weight;
            }
        }
        return votes;
    }
    /**
     * Encuentra la key con más votos
     */
    findDominantKey(votes) {
        let dominantKey = null;
        let dominantVotes = 0;
        let totalVotes = 0;
        for (const [key, weight] of Object.entries(votes)) {
            totalVotes += weight;
            if (weight > dominantVotes) {
                dominantKey = key;
                dominantVotes = weight;
            }
        }
        return { dominantKey, dominantVotes, totalVotes };
    }
    /**
     * 🧹 HARD RESET - Para nueva canción
     */
    reset() {
        this.keyBuffer = new Array(this.config.bufferSize).fill({ key: null, weight: 0 });
        this.bufferIndex = 0;
        this.stableKey = null;
        this.candidateKey = null;
        this.candidateFrames = 0;
        this.frameCount = 0;
        this.lastLogFrame = 0;
        // NO reseteamos keyChanges para mantener estadísticas de sesión
        console.log('[KeyStabilizer] 🧹 RESET: Buffer cleared for new song');
    }
    /**
     * Obtiene la key estable actual sin actualizar
     */
    getStableKey() {
        return this.stableKey;
    }
    /**
     * Obtiene estadísticas para debug
     */
    getStats() {
        const nonNullEntries = this.keyBuffer.filter(e => e.key !== null).length;
        return {
            stableKey: this.stableKey,
            candidateKey: this.candidateKey,
            candidateProgress: this.candidateFrames / this.config.lockingFrames,
            totalKeyChanges: this.keyChanges,
            bufferFullness: nonNullEntries / this.config.bufferSize,
        };
    }
}
// Default config
// 🔌 WAVE 65: Valores originales para estabilidad
// 🔌 WAVE 66.5: Aumentados para máxima estabilidad cromática
// 📊 WAVE 287: RELAXED STABILIZATION - Balance entre estabilidad y reactividad
// 🎨 WAVE 1183: CHROMATIC SANITY - 30s mínimo entre cambios de paleta
//    El locking de 3s creaba "estroboscopia cromática" (cambios cada 10s).
//    Nuevo balance: 10s buffer, 30s locking, 50% dominancia
//    Cambios de key solo en modulaciones reales o cambio de track.
//    Nadie cambia la paleta cada 10 segundos en una discoteca.
KeyStabilizer.DEFAULT_CONFIG = {
    bufferSize: 600, // 🎨 WAVE 1183: 10 segundos @ 60fps (era 300 = 5s)
    lockingFrames: 1800, // 🎨 WAVE 1183: 30 segundos para cambiar (era 180 = 3s)
    dominanceThreshold: 0.50, // 🎨 WAVE 1183: 50% de votos (era 40%) - más consenso
    minConfidence: 0.35, // Ignorar detecciones con confianza < 35%
    useEnergyWeighting: true, // Votos ponderados por energía
    energyPower: 1.5, // energia^1.5
};
// Export para uso en workers
export default KeyStabilizer;
