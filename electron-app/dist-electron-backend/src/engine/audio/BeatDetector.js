/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💓 WAVE 1022: THE PACEMAKER - BEAT DETECTOR v2.0
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * DIAGNÓSTICO DEL CÓDIGO ANTERIOR:
 * - Promedio simple de todos los intervalos → contaminación por sub-divisiones
 * - Media móvil 80/20 por frame → esquizofrenia BPM (120→180→80 en 3 frames)
 * - Cero histéresis → cambios de BPM cada frame
 * - Cero clustering → fills de batería = caos
 *
 * SOLUCIÓN: THE PACEMAKER
 *
 * A. 🧹 SMART INTERVAL SELECTOR (Clustering)
 *    - Agrupa intervalos similares (±25ms)
 *    - Usa el CLUSTER DOMINANTE (Moda), NO el promedio
 *    - Ignora sub-divisiones (intervalos < 55% del dominante) si son minoría
 *
 * B. ⚓ HYSTERESIS ANCHOR (Estabilidad)
 *    - candidateBpm: lo que calculamos este frame
 *    - stableBpm: lo que USAMOS para las luces
 *    - Solo cambia stableBpm si candidateBpm persiste ±2.5 BPM durante 45 frames (~1.5s)
 *    - Excepción: primeros 16 beats → cambios rápidos permitidos (warm-up)
 *
 * C. 🔒 OCTAVE PROTECTION (Anti-multiplicación)
 *    - Si BPM salta a 2x, 0.5x, 1.5x, o 0.66x → mantiene el actual
 *    - Solo acepta cambio de octava si confidence > 0.85 durante 90 frames (~3s)
 *
 * Resultado: BPM clavado como ROCA aunque el baterista se vuelva loco.
 *
 * @author PunkOpus
 * @wave 1022
 */
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS - THE PACEMAKER TUNING
// ═══════════════════════════════════════════════════════════════════════════
/** Tolerancia para agrupar intervalos similares (ms) */
const CLUSTER_TOLERANCE_MS = 25;
/** Frames mínimos para aceptar cambio de BPM */
const HYSTERESIS_FRAMES = 45; // ~1.5 segundos @ 30fps
/** BPM delta máximo para considerar "estable" */
const BPM_STABILITY_DELTA = 2.5;
/** Beats iniciales con warm-up (cambios rápidos permitidos) */
const WARMUP_BEATS = 16;
/** Confidence mínima para lock de octava */
const OCTAVE_LOCK_CONFIDENCE = 0.85;
/** Frames mínimos para aceptar cambio de octava */
const OCTAVE_CHANGE_FRAMES = 90; // ~3 segundos @ 30fps
/** Intervalo mínimo válido (ms) - 200bpm max */
const MIN_INTERVAL_MS = 300;
/** Intervalo máximo válido (ms) - 40bpm min */
const MAX_INTERVAL_MS = 1500;
/** Ratio para detectar sub-división (beat → half-beat) */
const SUBDIVISION_RATIO = 0.55; // Si interval < 55% del dominante, es sub-división
// ═══════════════════════════════════════════════════════════════════════════
// THE PACEMAKER
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 💓 BeatDetector v2.0 - THE PACEMAKER
 *
 * Detecta y trackea el ritmo del audio con estabilidad de hospital.
 */
export class BeatDetector {
    constructor(config) {
        this.peakHistory = [];
        this.maxPeakHistory = 64;
        // Transient detection thresholds
        this.kickThreshold = 0.65;
        this.snareThreshold = 0.55;
        this.hihatThreshold = 0.45;
        // Previous frame values (for transient detection)
        this.prevBass = 0;
        this.prevMid = 0;
        this.prevTreble = 0;
        // 💓 WAVE 1022: THE PACEMAKER STATE
        this.candidateBpm = 120; // BPM que estamos "probando"
        this.candidateFrames = 0; // Frames que el candidato ha sido estable
        this.octaveChangeFrames = 0; // Frames intentando cambio de octava
        this.lastDominantInterval = 500; // Último intervalo dominante detectado
        this.minBpm = config.minBpm || 60;
        this.maxBpm = config.maxBpm || 200;
        this.state = this.createInitialState();
    }
    /**
     * Estado inicial
     */
    createInitialState() {
        return {
            bpm: 120,
            confidence: 0.5,
            phase: 0,
            onBeat: false,
            beatCount: 0,
            lastBeatTime: 0,
            kickDetected: false,
            snareDetected: false,
            hihatDetected: false,
            // WAVE 1022
            rawBpm: 120,
            isLocked: false,
            lockFrames: 0,
        };
    }
    /**
     * 🎯 Procesar frame de audio
     */
    process(metrics) {
        const now = metrics.timestamp;
        // 1. Detectar transientes (cambios bruscos de energía)
        const bassTransient = metrics.bass - this.prevBass;
        const midTransient = metrics.mid - this.prevMid;
        const trebleTransient = metrics.treble - this.prevTreble;
        // 2. Detectar instrumentos
        this.state.kickDetected = bassTransient > this.kickThreshold && metrics.bass > 0.45;
        this.state.snareDetected = midTransient > this.snareThreshold && metrics.mid > 0.35;
        this.state.hihatDetected = trebleTransient > this.hihatThreshold && metrics.treble > 0.25;
        // 3. Registrar picos para análisis de BPM (solo kicks significativos)
        if (this.state.kickDetected || (bassTransient > 0.35 && metrics.bass > 0.55)) {
            this.recordPeak(now, metrics.energy, 'kick');
        }
        // 4. 💓 THE PACEMAKER: Calcular BPM con clustering + histéresis
        this.updateBpmWithPacemaker(now);
        // 5. Actualizar fase del beat
        this.updatePhase(now);
        // 6. Detectar si estamos "en el beat"
        this.state.onBeat = this.state.phase < 0.12 || this.state.phase > 0.88;
        // 7. Guardar valores anteriores
        this.prevBass = metrics.bass;
        this.prevMid = metrics.mid;
        this.prevTreble = metrics.treble;
        return { ...this.state };
    }
    /**
     * Registrar un pico detectado
     */
    recordPeak(time, energy, type) {
        // Anti-spam: No registrar si el último peak fue hace menos de 80ms
        const lastPeak = this.peakHistory[this.peakHistory.length - 1];
        if (lastPeak && (time - lastPeak.time) < 80) {
            return;
        }
        this.peakHistory.push({ time, energy, type });
        // Mantener historial limitado
        if (this.peakHistory.length > this.maxPeakHistory) {
            this.peakHistory.shift();
        }
        // Actualizar contador de beats
        if (type === 'kick') {
            this.state.beatCount++;
            this.state.lastBeatTime = time;
        }
    }
    /**
     * 💓 WAVE 1022: THE PACEMAKER - BPM con clustering + histéresis
     */
    updateBpmWithPacemaker(now) {
        // Necesitamos suficientes kicks para analizar
        const kicks = this.peakHistory.filter(p => p.type === 'kick');
        if (kicks.length < 6)
            return;
        // ═══════════════════════════════════════════════════════════════════════
        // PASO 1: Calcular todos los intervalos válidos
        // ═══════════════════════════════════════════════════════════════════════
        const intervals = [];
        for (let i = 1; i < kicks.length; i++) {
            const interval = kicks[i].time - kicks[i - 1].time;
            if (interval >= MIN_INTERVAL_MS && interval <= MAX_INTERVAL_MS) {
                intervals.push(interval);
            }
        }
        if (intervals.length < 4)
            return;
        // ═══════════════════════════════════════════════════════════════════════
        // PASO 2: 🧹 CLUSTERING - Agrupar intervalos similares
        // ═══════════════════════════════════════════════════════════════════════
        const clusters = this.clusterIntervals(intervals);
        if (clusters.length === 0)
            return;
        // ═══════════════════════════════════════════════════════════════════════
        // PASO 3: Encontrar el CLUSTER DOMINANTE (Moda, no promedio)
        // ═══════════════════════════════════════════════════════════════════════
        const dominantCluster = this.findDominantCluster(clusters);
        if (!dominantCluster)
            return;
        // Guardar para referencia
        this.lastDominantInterval = dominantCluster.centerMs;
        // BPM crudo (sin filtrar)
        const rawBpm = dominantCluster.bpm;
        this.state.rawBpm = rawBpm;
        // ═══════════════════════════════════════════════════════════════════════
        // PASO 4: 🔒 OCTAVE PROTECTION - Detectar saltos de octava falsos
        // ═══════════════════════════════════════════════════════════════════════
        const currentBpm = this.state.bpm;
        const isOctaveJump = this.isOctaveJump(rawBpm, currentBpm);
        if (isOctaveJump && this.state.beatCount > WARMUP_BEATS) {
            // Incrementar contador de frames intentando cambiar octava
            this.octaveChangeFrames++;
            // Solo aceptar cambio de octava si:
            // - Llevamos MUCHOS frames intentándolo
            // - La confianza es MUY alta
            if (this.octaveChangeFrames < OCTAVE_CHANGE_FRAMES ||
                this.state.confidence < OCTAVE_LOCK_CONFIDENCE) {
                // RECHAZAR cambio de octava - mantener BPM actual
                return;
            }
            // Si llegamos aquí, el cambio de octava es legítimo (muy raro)
        }
        else {
            // Reset contador de octava si no es salto
            this.octaveChangeFrames = 0;
        }
        // ═══════════════════════════════════════════════════════════════════════
        // PASO 5: ⚓ HYSTERESIS - Solo cambiar si el candidato persiste
        // ═══════════════════════════════════════════════════════════════════════
        const bpmDelta = Math.abs(rawBpm - this.candidateBpm);
        if (bpmDelta <= BPM_STABILITY_DELTA) {
            // BPM es similar al candidato anterior → incrementar estabilidad
            this.candidateFrames++;
            // Refinar el candidato con media móvil suave
            this.candidateBpm = this.candidateBpm * 0.92 + rawBpm * 0.08;
        }
        else {
            // BPM cambió significativamente → nuevo candidato
            this.candidateBpm = rawBpm;
            this.candidateFrames = 0;
        }
        // ═══════════════════════════════════════════════════════════════════════
        // PASO 6: Aplicar cambio SOLO si es estable
        // ═══════════════════════════════════════════════════════════════════════
        const isWarmup = this.state.beatCount < WARMUP_BEATS;
        const requiredFrames = isWarmup ? 8 : HYSTERESIS_FRAMES;
        if (this.candidateFrames >= requiredFrames) {
            // ¡El candidato es estable! Aplicar cambio
            this.state.bpm = Math.round(this.candidateBpm * 10) / 10; // 1 decimal
            this.state.isLocked = true;
            this.state.lockFrames++;
        }
        else {
            this.state.isLocked = false;
            this.state.lockFrames = 0;
        }
        // ═══════════════════════════════════════════════════════════════════════
        // PASO 7: Calcular confianza basada en consistencia del cluster dominante
        // ═══════════════════════════════════════════════════════════════════════
        this.state.confidence = this.calculateConfidence(dominantCluster, clusters);
    }
    /**
     * 🧹 Agrupar intervalos similares en clusters
     */
    clusterIntervals(intervals) {
        if (intervals.length === 0)
            return [];
        // Ordenar intervalos
        const sorted = [...intervals].sort((a, b) => a - b);
        const clusters = [];
        let currentCluster = null;
        for (const interval of sorted) {
            if (!currentCluster) {
                // Primer cluster
                currentCluster = {
                    centerMs: interval,
                    count: 1,
                    intervals: [interval],
                    bpm: 60000 / interval,
                };
            }
            else if (Math.abs(interval - currentCluster.centerMs) <= CLUSTER_TOLERANCE_MS) {
                // Agregar al cluster actual
                currentCluster.intervals.push(interval);
                currentCluster.count++;
                // Recalcular centro como promedio del cluster
                currentCluster.centerMs = currentCluster.intervals.reduce((a, b) => a + b, 0) / currentCluster.count;
                currentCluster.bpm = 60000 / currentCluster.centerMs;
            }
            else {
                // Nuevo cluster
                clusters.push(currentCluster);
                currentCluster = {
                    centerMs: interval,
                    count: 1,
                    intervals: [interval],
                    bpm: 60000 / interval,
                };
            }
        }
        // No olvidar el último cluster
        if (currentCluster) {
            clusters.push(currentCluster);
        }
        return clusters;
    }
    /**
     * 🎯 Encontrar el cluster dominante (Moda)
     *
     * Prioriza:
     * 1. El cluster con más intervalos
     * 2. Si hay empate, el que está más cerca del BPM actual (estabilidad)
     * 3. Ignora clusters de sub-división si hay uno de beat completo
     */
    findDominantCluster(clusters) {
        if (clusters.length === 0)
            return null;
        if (clusters.length === 1)
            return clusters[0];
        // Ordenar por cantidad (más intervalos primero)
        const sorted = [...clusters].sort((a, b) => b.count - a.count);
        // El más grande
        const largest = sorted[0];
        // Verificar si hay otros clusters significativos
        const significant = sorted.filter(c => c.count >= largest.count * 0.6);
        if (significant.length === 1) {
            return largest;
        }
        // Si hay múltiples clusters significativos, priorizar el más cercano al BPM actual
        // (estabilidad temporal)
        const currentBpm = this.state.bpm;
        let best = largest;
        let bestDistance = Math.abs(largest.bpm - currentBpm);
        for (const cluster of significant) {
            const distance = Math.abs(cluster.bpm - currentBpm);
            // Si está más cerca del BPM actual Y no es una sub-división obvia
            if (distance < bestDistance) {
                // Verificar que no sea sub-división del largest
                const ratio = cluster.centerMs / largest.centerMs;
                const isSubdivision = ratio < SUBDIVISION_RATIO || (ratio > 1.8 && ratio < 2.2);
                if (!isSubdivision) {
                    best = cluster;
                    bestDistance = distance;
                }
            }
        }
        return best;
    }
    /**
     * 🔒 Detectar si el cambio de BPM es un salto de octava (falso positivo)
     */
    isOctaveJump(newBpm, currentBpm) {
        if (currentBpm === 0)
            return false;
        const ratio = newBpm / currentBpm;
        // Ratios peligrosos: 2x, 0.5x, 1.5x, 0.66x
        const dangerousRatios = [
            { min: 1.85, max: 2.15 }, // Doble
            { min: 0.45, max: 0.55 }, // Mitad
            { min: 1.45, max: 1.55 }, // 1.5x
            { min: 0.65, max: 0.70 }, // 2/3
        ];
        for (const range of dangerousRatios) {
            if (ratio >= range.min && ratio <= range.max) {
                return true;
            }
        }
        return false;
    }
    /**
     * 📊 Calcular confianza basada en consistencia
     */
    calculateConfidence(dominant, allClusters) {
        // Base: qué porcentaje de intervalos están en el cluster dominante
        const totalIntervals = allClusters.reduce((sum, c) => sum + c.count, 0);
        const dominantRatio = dominant.count / totalIntervals;
        // Varianza dentro del cluster dominante
        const mean = dominant.centerMs;
        const variance = dominant.intervals.reduce((sum, i) => sum + Math.pow(i - mean, 2), 0) / dominant.count;
        const stdDev = Math.sqrt(variance);
        const consistencyScore = Math.max(0, 1 - (stdDev / mean) * 2);
        // Combinar scores
        const confidence = (dominantRatio * 0.6) + (consistencyScore * 0.4);
        // Clamp 0-1
        return Math.max(0, Math.min(1, confidence));
    }
    /**
     * Actualizar fase del beat (0-1)
     */
    updatePhase(now) {
        const beatDuration = 60000 / this.state.bpm;
        const timeSinceLastBeat = now - this.state.lastBeatTime;
        // Calcular fase (0-1)
        this.state.phase = (timeSinceLastBeat % beatDuration) / beatDuration;
    }
    /**
     * Forzar BPM manualmente (para sync externo o usuario)
     */
    setBpm(bpm) {
        if (bpm >= this.minBpm && bpm <= this.maxBpm) {
            this.state.bpm = bpm;
            this.candidateBpm = bpm;
            this.candidateFrames = HYSTERESIS_FRAMES; // Forzar lock inmediato
            this.state.confidence = 1.0;
            this.state.isLocked = true;
        }
    }
    /**
     * Tap tempo - usuario marca el beat manualmente
     */
    tap(timestamp) {
        this.recordPeak(timestamp, 1.0, 'kick');
        this.updateBpmWithPacemaker(timestamp);
    }
    /**
     * Obtener estado actual
     */
    getState() {
        return { ...this.state };
    }
    /**
     * 💓 WAVE 1022: Obtener diagnóstico del Pacemaker
     */
    getDiagnostics() {
        return {
            stableBpm: this.state.bpm,
            rawBpm: this.state.rawBpm,
            candidateBpm: this.candidateBpm,
            candidateFrames: this.candidateFrames,
            isLocked: this.state.isLocked,
            confidence: this.state.confidence,
            octaveChangeFrames: this.octaveChangeFrames,
            lastInterval: this.lastDominantInterval,
        };
    }
    /**
     * Reset detector
     */
    reset() {
        this.peakHistory = [];
        this.candidateBpm = 120;
        this.candidateFrames = 0;
        this.octaveChangeFrames = 0;
        this.lastDominantInterval = 500;
        this.prevBass = 0;
        this.prevMid = 0;
        this.prevTreble = 0;
        this.state = this.createInitialState();
    }
}
