/**
 * 🔋 WAVE 931: ENERGY CONSCIOUSNESS ENGINE
 * ================================================================
 *
 * Motor de Consciencia Energética para Selene.
 *
 * PROPÓSITO:
 * Proporcionar contexto de energía ABSOLUTA a Selene, no solo Z-Scores.
 * Esto evita el "Síndrome del Grito en la Biblioteca" donde un pico
 * relativo en silencio (Z=4.0, E=0.15) dispara efectos épicos.
 *
 * DISEÑO ASIMÉTRICO (Edge Case del "Fake Drop"):
 * ┌─────────────────────────────────────────────────────────────┐
 * │  ENTRAR en zona baja (silence/valley): LENTO (500ms avg)    │
 * │  SALIR de zona baja:                   INSTANTÁNEO (0ms)    │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Esto permite que cuando un DJ corta todo súbitamente antes de un drop,
 * Selene detecte INSTANTÁNEAMENTE el drop sin quedarse bloqueada en
 * "modo silencio" durante los primeros 200ms críticos.
 *
 * @module core/intelligence/EnergyConsciousnessEngine
 * @version 1.0.0 - WAVE 931
 */
import { EnergyLogger } from './EnergyLogger.js';
// EMA α for 3s moving average RMS energy gate (half-life ~3s @ 44Hz)
const ALPHA_RMS_3S = 1 - Math.pow(2, -1 / (3.0 * 44.0));
// EMA α for 10s moving average RMS energy gate (half-life ~10s @ 44Hz)
// Used for flashbang detection and dynamic epicness floors — smooths out
// techno minimal zone oscillations (valley↔intense) while still rising
// during genuine silence→drop transitions which sustain >10s.
const ALPHA_RMS_10S = 1 - Math.pow(2, -1 / (10.0 * 44.0));
const DEFAULT_CONFIG = {
    // ═══════════════════════════════════════════════════════════════════════════
    // � WAVE 996: THE 7-ZONE EXPANSION - THE LADDER
    // ═══════════════════════════════════════════════════════════════════════════
    // PROBLEMA (WAVE 976.10):
    // - Zonas desbalanceadas: gentle muy estrecha (10%), peak inalcanzable (5%)
    // - Drops reales (0.82-0.92) caían en `active`, no en `intense`
    // 
    // SOLUCIÓN WAVE 996 (Radwulf - The Ladder):
    // - 7 zonas EQUIDISTANTES: 6 x 15% + 1 x 10% (peak)
    // - Distribución balanceada para Monte Carlo validation
    // - Rango activo (0.45-1.00) dividido en 4 zonas de 15% cada una
    // 
    // THE LADDER (Escalera de 7 peldaños):
    // ┌─────────────────────────────────────────────────────────────────┐
    // │ ZONA    │ RANGO         │ ANCHO │ EFECTOS                      │
    // ├─────────────────────────────────────────────────────────────────┤
    // │ SILENCE │ 0.00 - 0.15   │ 15%   │ DeepBreath, SonarPing        │
    // │ VALLEY  │ 0.15 - 0.30   │ 15%   │ VoidMist, FiberOptics        │
    // │ AMBIENT │ 0.30 - 0.45   │ 15%   │ DigitalRain, AcidSweep       │
    // │ GENTLE  │ 0.45 - 0.60   │ 15%   │ AmbientStrobe, BinaryGlitch  │
    // │ ACTIVE  │ 0.60 - 0.75   │ 15%   │ CyberDualism, SeismicSnap    │
    // │ INTENSE │ 0.75 - 0.90   │ 15%   │ SkySaw, AbyssalRise          │
    // │ PEAK    │ 0.90 - 1.00   │ 10%   │ Gatling, CoreMeltdown, Indus │
    // └─────────────────────────────────────────────────────────────────┘
    // 
    // EXPECTED (Monte Carlo 3500 cycles):
    // - Cada zona activa (gentle-peak): ~25% distribución (4 zonas x 25% = 100%)
    // - Zonas pasivas (silence-ambient): Mínima activación
    // - STRICT ZONE MUTEX: 1 efecto por zona simultáneamente
    // ═══════════════════════════════════════════════════════════════════════════
    zoneThresholds: {
        silence: 0.15, // E < 0.15 = SILENCE (0-15%)
        valley: 0.30, // E < 0.30 = VALLEY (15-30%)
        ambient: 0.45, // E < 0.45 = AMBIENT (30-45%)
        gentle: 0.60, // E < 0.60 = GENTLE (45-60%)
        active: 0.75, // E < 0.75 = ACTIVE (60-75%)
        intense: 0.90, // E < 0.90 = INTENSE (75-90%)
        // E >= 0.90 = PEAK (90-100%)
    },
    // ASIMETRÍA TEMPORAL: Lento para bajar, rápido para subir
    smoothingFactorDown: 0.92, // ~500ms para estabilizar en silencio
    smoothingFactorUp: 0.3, // ~50ms para detectar spike (INSTANTÁNEO)
    sustainedLowThresholdMs: 5000, // 5 segundos para "valle sostenido"
    sustainedHighThresholdMs: 3000, // 3 segundos para "pico sostenido"
    sustainedLowEnergyThreshold: 0.4,
    sustainedHighEnergyThreshold: 0.7,
    historySize: 300, // ~5 segundos @ 60fps
    trendWindowSize: 10, // ~160ms para calcular tendencia
};
// ═══════════════════════════════════════════════════════════════════════════
// 🔋 ENERGY CONSCIOUSNESS ENGINE
// ═══════════════════════════════════════════════════════════════════════════
export class EnergyConsciousnessEngine {
    constructor(config = {}) {
        this.lastMultiSpectralZone = null;
        // Estado interno
        this.smoothedEnergy = 0;
        this.currentZone = 'silence';
        this.previousZone = 'silence';
        this.lastZoneChange = Date.now();
        // ═══════════════════════════════════════════════════════════════════════════
        // 🔥 WAVE 979: PEAK HOLD - THE TRANSIENT PROTECTOR
        // ═══════════════════════════════════════════════════════════════════════════
        // PROBLEMA IDENTIFICADO (WAVE 978 Forensic Analysis):
        // - Smoothing tiene lag de ~650ms después de peaks
        // - Drops de Dubstep (raw=1.0) → espacios post-drop (raw=0.27) se ven como VALLEY (smooth=0.48)
        // - Kicks reales (raw=0.44) se ven inflados como INTENSE (smooth=0.82) por lag
        // 
        // SOLUCIÓN:
        // - Peak Hold mantiene picos durante 80ms (duración típica de kick)
        // - Decay rápido (0.85) cuando bass > 0.65 (percusión detectada)
        // - Decay lento (0.95) en ambiente sin percusión
        // 
        // EXPECTED:
        // - Dubstep drop: raw=1.0 → peak hold en 0.95+ por 80ms
        // - Post-drop space: raw=0.27 → peak decay a 0.35 en 150-200ms (vs 650ms actual)
        // - Hard Techno: Sin cambios (smoothing funciona bien sin transitorios)
        // ═══════════════════════════════════════════════════════════════════════════
        this.peakHold = 0;
        this.peakHoldTimestamp = 0;
        this.PEAK_HOLD_DURATION = 80; // ms - mantener peak brevemente
        this.FAST_DECAY_RATE = 0.85; // Decay rápido en percusión
        this.SLOW_DECAY_RATE = 0.95; // Decay normal en ambiente
        this.BASS_THRESHOLD = 0.65; // Umbral para detectar percusión
        // Historial para percentil
        this.energyHistory = [];
        // 3s moving average RMS energy for absolute energy gating
        this._rmsAverage3s = 0;
        // 10s moving average RMS energy — slower low-pass for flashbang gate
        // and dynamic epicness floors. Filters techno minimal oscillations.
        this._rmsAverage10s = 0;
        // 🌋 WAVE 960 TUNE: Flashbang cooldown — prevent false positives from zone oscillation
        this._lastFlashbangTimestamp = 0;
        this.FLASHBANG_COOLDOWN_MS = 500; // min 500ms between detections
        // Ventana para tendencia
        this.trendWindow = [];
        // Tracking de sostenibilidad
        this.lastHighEnergyTime = 0;
        this.lastLowEnergyTime = Date.now();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.msLadder = new MultiSpectralEnergyLadder();
    }
    // ═══════════════════════════════════════════════════════════════════════
    // 🎯 MÉTODO PRINCIPAL: PROCESS
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Procesa la energía actual y retorna el contexto energético completo.
     *
     * @param rawEnergy - Energía absoluta del audio (0-1)
     * @param debugData - (WAVE 978) Datos opcionales para el EnergyLogger
     * @returns EnergyContext con toda la información para decisiones
     */
    process(rawEnergy, debugData, evidence, vibe) {
        const now = Date.now();
        // ═══════════════════════════════════════════════════════════════════
        // 1. SUAVIZADO ASIMÉTRICO - La magia del "Fake Drop"
        // ═══════════════════════════════════════════════════════════════════
        const smoothed = this.calculateAsymmetricSmoothing(rawEnergy);
        // 3s moving average RMS for absolute energy gating
        this._rmsAverage3s += ALPHA_RMS_3S * (rawEnergy - this._rmsAverage3s);
        // 10s moving average RMS — slower low-pass for flashbang + dynamic floors
        this._rmsAverage10s += ALPHA_RMS_10S * (rawEnergy - this._rmsAverage10s);
        // ═══════════════════════════════════════════════════════════════════
        // 🔥 WAVE 979: PEAK HOLD - Preservar transitorios
        // ═══════════════════════════════════════════════════════════════════
        const peakHeldEnergy = this.updatePeakHold(rawEnergy, now, debugData);
        // 🔥 WAVE 980.3: FIX DEFINITIVO - Time-based + Delta detection
        // PROBLEMA: Threshold fijo +0.15 demasiado alto (imposible si smooth=1.0)
        // SOLUCIÓN: Peak hold activo durante 1.5s post-peak O si hay delta significativo
        // 🔥 WAVE 980.4: Ventana reducida 2000ms → 1500ms (mejora transiciones en breakdowns)
        const peakHoldActive = (now - this.peakHoldTimestamp) < 1500;
        const energyDelta = rawEnergy - smoothed;
        const isTransient = energyDelta > 0.05 || peakHoldActive;
        const effectiveEnergy = isTransient ? peakHeldEnergy : smoothed;
        // ═══════════════════════════════════════════════════════════════════
        // 2. DETERMINAR ZONA
        // ═══════════════════════════════════════════════════════════════════
        // 🌊 M-SARFE Phase 2: When evidence is available, use Multi-Spectral Energy Ladder
        // The MSEL computes base zone from smoothedEnergy, then applies tension elevation
        // based on spectral evidence (Z_high, CF_high, spectralTension, divergence).
        // Falls back to legacy determineZone() when no evidence (backward compatibility).
        let newZone;
        let multiSpectralZone;
        if (evidence) {
            // 🩸 WAVE 7175: For Latin vibes, use smoothed energy (not effectiveEnergy with peak hold).
            // Reggaeton/cumbia have transients on every beat — peak hold is chronically active,
            // inflating effectiveEnergy to 0.90+ and defeating the -0.15 genre offset.
            // Smoothed energy reflects the true cruising energy of the genre.
            const zoneEnergy = vibe && (vibe.includes('latina') || vibe.includes('latino') || vibe.includes('fiesta'))
                ? smoothed
                : effectiveEnergy;
            multiSpectralZone = this.msLadder.classify(evidence, zoneEnergy, vibe);
            newZone = multiSpectralZone.label;
            this.lastMultiSpectralZone = multiSpectralZone;
        }
        else {
            // CRITICAL: Para SALIR de zonas bajas, usamos energía RAW (instantánea)
            // Para ENTRAR en zonas bajas, usamos energía SMOOTHED (suavizada)
            // 🔥 WAVE 979: Ahora usamos effectiveEnergy (con peak hold) en lugar de smoothed
            newZone = this.determineZone(rawEnergy, effectiveEnergy);
        }
        // Detectar cambio de zona
        if (newZone !== this.currentZone) {
            this.previousZone = this.currentZone;
            this.currentZone = newZone;
            this.lastZoneChange = now;
        }
        // ═══════════════════════════════════════════════════════════════════
        // 3. ACTUALIZAR HISTORIAL Y CALCULAR PERCENTIL
        // ═══════════════════════════════════════════════════════════════════
        this.updateHistory(rawEnergy);
        const percentile = this.calculatePercentile(rawEnergy);
        // ═══════════════════════════════════════════════════════════════════
        // 🧪 WAVE 978: ENERGY LAB - LOG DATA
        // 🔥 WAVE 979: Ahora loggeamos effectiveEnergy (con peak hold aplicado)
        // ═══════════════════════════════════════════════════════════════════
        // Si el logger está activo, registrar datos crudos
        if (EnergyLogger.isEnabled()) {
            const logEntry = {
                timestamp: now,
                raw: rawEnergy,
                smooth: effectiveEnergy, // 🔥 WAVE 979: Con peak hold
                zone: this.currentZone,
                gain: debugData?.agcGain ?? 1.0,
                bass: debugData?.bassEnergy ?? 0,
                spectralFlux: debugData?.spectralFlux,
                mid: debugData?.midEnergy,
                treble: debugData?.trebleEnergy,
                percentile,
            };
            EnergyLogger.log(logEntry);
        }
        // ═══════════════════════════════════════════════════════════════════
        // 4. CALCULAR TENDENCIA
        // ═══════════════════════════════════════════════════════════════════
        const trend = this.calculateTrend(rawEnergy);
        // ═══════════════════════════════════════════════════════════════════
        // 5. TRACKING DE SOSTENIBILIDAD
        // ═══════════════════════════════════════════════════════════════════
        const { sustainedLow, sustainedHigh } = this.updateSustainedTracking(rawEnergy, now);
        // ═══════════════════════════════════════════════════════════════════
        // 🌋 WAVE 960: FLASHBANG PROTOCOL
        // ═══════════════════════════════════════════════════════════════════
        // Detectar salto instantáneo de zona baja (silence/valley/ambient) a alta (intense/peak)
        const isFlashbang = this.detectFlashbang(this.previousZone, this.currentZone, now);
        // ═══════════════════════════════════════════════════════════════════
        // 6. CONSTRUIR CONTEXTO
        // ═══════════════════════════════════════════════════════════════════
        return {
            absolute: rawEnergy,
            smoothed: effectiveEnergy, // 🔥 WAVE 979: Con peak hold
            percentile,
            zone: this.currentZone,
            previousZone: this.previousZone,
            sustainedLow,
            sustainedHigh,
            trend,
            lastZoneChange: this.lastZoneChange,
            isFlashbang, // 🌋 WAVE 960
            multiSpectralZone, // 🌊 M-SARFE Phase 2
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // 🔄 SUAVIZADO ASIMÉTRICO
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Calcula el suavizado con asimetría temporal.
     *
     * DISEÑO:
     * - Cuando la energía BAJA: Suavizado LENTO (500ms para estabilizar)
     *   → Evita que ruido/silencio momentáneo active modo silencio
     *
     * - Cuando la energía SUBE: Suavizado RÁPIDO (casi instantáneo)
     *   → Detecta el DROP inmediatamente, no se queda "dormido"
     */
    calculateAsymmetricSmoothing(rawEnergy) {
        const isRising = rawEnergy > this.smoothedEnergy;
        // ASIMETRÍA: Diferente velocidad según dirección
        const factor = isRising
            ? this.config.smoothingFactorUp // Subiendo: RÁPIDO
            : this.config.smoothingFactorDown; // Bajando: LENTO
        // Exponential Moving Average con factor asimétrico
        this.smoothedEnergy = this.smoothedEnergy * factor + rawEnergy * (1 - factor);
        return this.smoothedEnergy;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 979: PEAK HOLD - TRANSIENT PRESERVATION
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Implementa Peak Hold con decay condicional bass-aware.
     *
     * ALGORITMO:
     * 1. Si raw > peakHold → Capturar nuevo peak
     * 2. Si dentro de PEAK_HOLD_DURATION (80ms) → Mantener peak
     * 3. Si fuera de ventana → Aplicar decay según contexto:
     *    - Bass > 0.65 (percusión) → FAST_DECAY (0.85) = 150-200ms para bajar
     *    - Bass ≤ 0.65 (ambiente) → SLOW_DECAY (0.95) = mantener smoothing actual
     *
     * IMPACTO ESPERADO:
     * - Dubstep drop (raw=1.0) → Peak hold en 0.95+ por 80ms
     * - Post-drop space (raw=0.27) → Decay rápido a 0.35 en 200ms (vs 650ms)
     * - Hard Techno constante → Sin cambios (no hay peaks extremos)
     *
     * @param rawEnergy - Energía cruda del audio
     * @param now - Timestamp actual
     * @param debugData - Datos opcionales (necesitamos bassEnergy)
     * @returns Energía con peak hold aplicado
     */
    updatePeakHold(rawEnergy, now, debugData) {
        // 1. ¿Nuevo peak detectado?
        if (rawEnergy > this.peakHold) {
            this.peakHold = rawEnergy;
            this.peakHoldTimestamp = now;
            return this.peakHold;
        }
        // 2. ¿Estamos dentro de la ventana de hold?
        const timeSincePeak = now - this.peakHoldTimestamp;
        if (timeSincePeak <= this.PEAK_HOLD_DURATION) {
            // Mantener peak sin decay
            return this.peakHold;
        }
        // 3. Aplicar decay según contexto (bass-aware)
        const bassEnergy = debugData?.bassEnergy ?? 0;
        const isPercussionActive = bassEnergy > this.BASS_THRESHOLD;
        // Decay rápido si hay percusión, lento si es ambiente
        const decayRate = isPercussionActive
            ? this.FAST_DECAY_RATE // Percusión: bajar rápido (0.85)
            : this.SLOW_DECAY_RATE; // Ambiente: bajar lento (0.95)
        this.peakHold *= decayRate;
        // No dejar que peak hold baje del raw actual
        // (esto evita que el peak hold "compita" con subidas reales)
        this.peakHold = Math.max(this.peakHold, rawEnergy);
        return this.peakHold;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // 🎯 DETERMINACIÓN DE ZONA
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Determina la zona energética actual.
     *
     * REGLA CRÍTICA:
     * - Para ENTRAR en silence/valley: Usar smoothed (lento)
     * - Para SALIR de silence/valley: Usar raw (instantáneo)
     */
    determineZone(raw, smoothed) {
        const t = this.config.zoneThresholds;
        const currentIsLow = this.isLowZone(this.currentZone);
        // Si estamos en zona baja, usamos RAW para detectar subida INSTANTÁNEA
        if (currentIsLow) {
            // ¿La energía RAW indica que debemos subir?
            if (raw >= t.active)
                return 'active';
            if (raw >= t.gentle)
                return 'gentle';
            if (raw >= t.ambient)
                return 'ambient';
            if (raw >= t.valley)
                return 'valley';
            // Si no subimos, mantenemos zona actual (basado en smoothed)
            if (smoothed < t.silence)
                return 'silence';
            if (smoothed < t.valley)
                return 'valley';
            return this.currentZone;
        }
        // Si estamos en zona alta, usamos SMOOTHED para bajar LENTAMENTE
        if (smoothed >= t.intense)
            return 'peak';
        if (smoothed >= t.active)
            return 'intense';
        if (smoothed >= t.gentle)
            return 'active';
        if (smoothed >= t.ambient)
            return 'gentle';
        if (smoothed >= t.valley)
            return 'ambient';
        if (smoothed >= t.silence)
            return 'valley';
        return 'silence';
    }
    /**
     * ¿Es esta una zona de baja energía?
     */
    isLowZone(zone) {
        return zone === 'silence' || zone === 'valley' || zone === 'ambient';
    }
    // ═══════════════════════════════════════════════════════════════════════
    // 📊 PERCENTIL HISTÓRICO
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Actualiza el historial de energía
     */
    updateHistory(energy) {
        this.energyHistory.push(energy);
        // Mantener tamaño máximo
        if (this.energyHistory.length > this.config.historySize) {
            this.energyHistory.shift();
        }
    }
    /**
     * Calcula en qué percentil está la energía actual.
     *
     * Esto permite saber: "Estás en el 15% más bajo de la pista"
     */
    calculatePercentile(energy) {
        if (this.energyHistory.length < 10)
            return 50; // Warmup
        // Contar cuántos valores son menores que el actual
        const lowerCount = this.energyHistory.filter(e => e < energy).length;
        return Math.round((lowerCount / this.energyHistory.length) * 100);
    }
    // ═══════════════════════════════════════════════════════════════════════
    // 📈 CÁLCULO DE TENDENCIA
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Calcula la tendencia de cambio de energía.
     *
     * @returns -1 a 1, donde positivo = subiendo
     */
    calculateTrend(energy) {
        this.trendWindow.push(energy);
        if (this.trendWindow.length > this.config.trendWindowSize) {
            this.trendWindow.shift();
        }
        if (this.trendWindow.length < 3)
            return 0;
        // Calcular pendiente simple
        const first = this.trendWindow.slice(0, Math.floor(this.trendWindow.length / 2));
        const second = this.trendWindow.slice(Math.floor(this.trendWindow.length / 2));
        const firstAvg = first.reduce((a, b) => a + b, 0) / first.length;
        const secondAvg = second.reduce((a, b) => a + b, 0) / second.length;
        // Normalizar a -1, 1
        const rawTrend = (secondAvg - firstAvg) * 5; // Amplificar
        return Math.max(-1, Math.min(1, rawTrend));
    }
    // ═══════════════════════════════════════════════════════════════════════
    // ⏱️ TRACKING DE SOSTENIBILIDAD
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Actualiza el tracking de energía sostenida alta/baja
     */
    updateSustainedTracking(energy, now) {
        // Tracking de energía alta
        if (energy >= this.config.sustainedHighEnergyThreshold) {
            this.lastHighEnergyTime = now;
        }
        // Tracking de energía baja
        if (energy < this.config.sustainedLowEnergyThreshold) {
            // Si es la primera vez que baja, registrar
            if (this.lastLowEnergyTime === 0) {
                this.lastLowEnergyTime = now;
            }
        }
        else {
            this.lastLowEnergyTime = now; // Reset cuando sube
        }
        // Calcular si es sostenido
        const sustainedLow = energy < this.config.sustainedLowEnergyThreshold &&
            (now - this.lastLowEnergyTime) >= this.config.sustainedLowThresholdMs;
        const sustainedHigh = energy >= this.config.sustainedHighEnergyThreshold &&
            (now - this.lastHighEnergyTime) < this.config.sustainedHighThresholdMs;
        return { sustainedLow, sustainedHigh };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // 🌋 WAVE 960: FLASHBANG PROTOCOL
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Detecta si hay un salto instantáneo de zona baja a zona alta (FLASHBANG).
     *
     * FLASHBANG = Salto de Fe (puede ser Drop o Grito):
     * - Zona anterior: silence, valley, ambient (baja energía)
     * - Zona actual: intense, peak (alta energía)
     * - Tiempo desde cambio: < 100ms (prácticamente instantáneo)
     *
     * OBJETIVO:
     * Si TRUE → Disparar SOLO efectos cortos (StrobeBurst) en el primer frame.
     * NO disparar efectos largos (Gatling, CyberDualism) hasta confirmar que
     * la energía se sostiene (no es un grito aislado).
     *
     * @returns true si detecta Flashbang, false si es transición normal
     */
    detectFlashbang(previousZone, currentZone, now) {
        // 0. Cooldown — prevent false positives from rapid zone oscillation in techno
        // Without this, zone bouncing valley↔intense triggers 4+ flashbangs in <80ms
        if (now - this._lastFlashbangTimestamp < this.FLASHBANG_COOLDOWN_MS)
            return false;
        // 1. ¿Es un cambio de zona reciente? (< 100ms)
        const timeSinceChange = now - this.lastZoneChange;
        if (timeSinceChange > 100)
            return false; // Transición ya estabilizada
        // 2. ¿Venimos de zona BAJA?
        const isFromLow = previousZone === 'silence' ||
            previousZone === 'valley' ||
            previousZone === 'ambient';
        if (!isFromLow)
            return false;
        // 3. ¿Vamos a zona ALTA?
        const isToHigh = currentZone === 'intense' ||
            currentZone === 'peak';
        if (!isToHigh)
            return false;
        // 4. Absolute RMS Energy Gate: 10s moving average must exceed 0.25
        // Switched from 3s to 10s EMA — the 3s average responds too fast to
        // techno minimal zone oscillations (valley↔intense bouncing every ~200ms).
        // The 10s average smooths these out while still rising during genuine
        // silence→drop transitions which sustain high energy for >10s.
        if (this._rmsAverage10s < 0.25)
            return false;
        // ✅ FLASHBANG DETECTED: Salto instantáneo de LOW → HIGH
        this._lastFlashbangTimestamp = now;
        console.log(`[🌋 FLASHBANG] Detected: ${previousZone} → ${currentZone} (${timeSinceChange}ms) RMS3s=${this._rmsAverage3s.toFixed(2)} RMS10s=${this._rmsAverage10s.toFixed(2)} t=${now}ms`);
        return true;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // 🔧 UTILIDADES
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Obtiene la zona actual
     */
    getCurrentZone() {
        return this.currentZone;
    }
    /**
     * Obtiene la energía suavizada actual
     */
    getSmoothedEnergy() {
        return this.smoothedEnergy;
    }
    /**
     * 10s moving average RMS energy — slow low-pass for dynamic floors.
     * Used by SeleneTitanConscious for dynamic epicness thresholds.
     */
    getRmsAverage10s() {
        return this._rmsAverage10s;
    }
    /**
     * Reset del motor (para nueva canción)
     */
    reset() {
        this.smoothedEnergy = 0;
        this.currentZone = 'silence';
        this.previousZone = 'silence';
        this.lastZoneChange = Date.now();
        this.energyHistory = [];
        this.trendWindow = [];
        this.lastHighEnergyTime = 0;
        this.lastLowEnergyTime = Date.now();
        this.lastMultiSpectralZone = null;
        this._rmsAverage3s = 0;
        this._rmsAverage10s = 0;
    }
    /**
     * Actualiza configuración en runtime
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * 🎤 WAVE 936: VOCAL FILTER - Confianza de transición
     *
     * Distingue entre drops reales y voces que saltan de golpe.
     *
     * COMPORTAMIENTO:
     * - Drop real: Energía sube y se MANTIENE alta (>200ms) → confianza ALTA
     * - Voz: Energía sube y fluctúa/baja rápido (<200ms) → confianza BAJA
     *
     * USO: Los consumidores pueden usar esta confianza para decidir
     * qué tan "pesado" debe ser el efecto que disparan.
     *
     * @param context - El EnergyContext actual
     * @returns 0-1, donde 1 = muy confiable, 0 = probablemente ruido/voz
     */
    getTransitionConfidence(context) {
        const now = Date.now();
        const timeSinceChange = now - context.lastZoneChange;
        // Si la transición es muy reciente (<100ms), baja confianza
        if (timeSinceChange < 100) {
            return 0.2; // Probablemente ruido transitorio
        }
        // Si la transición tiene 100-300ms, confianza media (podría ser voz)
        if (timeSinceChange < 300) {
            // Considerar también la tendencia: si está subiendo, más confianza
            const trendBonus = context.trend > 0.3 ? 0.2 : 0;
            return 0.4 + trendBonus;
        }
        // Si la transición tiene 300-500ms, confianza alta
        if (timeSinceChange < 500) {
            return 0.75;
        }
        // Más de 500ms en la misma zona = muy confiable
        return 1.0;
    }
    /**
     * 🎤 WAVE 936: ¿Es esta transición probablemente una voz?
     *
     * Heurística simple: transición muy rápida + no sostenida + fluctuante
     */
    isProbablyVocalTransition(context) {
        const now = Date.now();
        const timeSinceChange = now - context.lastZoneChange;
        // Si saltamos de silence/valley a una zona alta muy rápido
        const wasLow = context.previousZone === 'silence' || context.previousZone === 'valley';
        const isHighNow = context.zone === 'active' || context.zone === 'intense' || context.zone === 'peak';
        if (wasLow && isHighNow && timeSinceChange < 150) {
            // Transición muy rápida desde silencio → probablemente voz/grito
            return true;
        }
        return false;
    }
    /**
     * Obtiene estadísticas para debug
     */
    getStats() {
        const avgEnergy = this.energyHistory.length > 0
            ? this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length
            : 0;
        return {
            currentZone: this.currentZone,
            smoothedEnergy: this.smoothedEnergy,
            historySize: this.energyHistory.length,
            avgEnergy,
        };
    }
    /**
     * 🌊 M-SARFE Phase 2: Obtiene el último MultiSpectralZone computado
     */
    getMultiSpectralZone() {
        return this.lastMultiSpectralZone;
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// 🌊 M-SARFE Phase 2: MultiSpectralEnergyLadder
// ═══════════════════════════════════════════════════════════════════════════
// Replaces the 1D rawEnergy ladder with a multi-spectral classification
// that incorporates spectral tension and divergence to recognize
// textural drops and high-tension moments.
//
// ALGORITHM:
// 1. Compute base zone from E_total (same thresholds as current system)
// 2. Compute tension elevation from spectral tension index
// 3. Final zone = baseZone + tensionElevation (clamped to 'peak')
//
// This means a moment with E_total=0.35 (AMBIENT) but spectralTension=1.2
// (vocal scream) gets elevated to INTENSE or PEAK.
// ═══════════════════════════════════════════════════════════════════════════
const ENERGY_ZONE_ORDINAL = {
    silence: 0, valley: 1, ambient: 2, gentle: 3, active: 4, intense: 5, peak: 6,
};
const ORDINAL_TO_ZONE = [
    'silence', 'valley', 'ambient', 'gentle', 'active', 'intense', 'peak',
];
export class MultiSpectralEnergyLadder {
    /**
     * Classify the current moment into a multi-spectral zone.
     *
     * ALGORITHM:
     * 1. Compute base zone from E_total (same thresholds as current system)
     * 2. Compute tension elevation from spectral tension index
     * 3. Final zone = baseZone + tensionElevation (clamped to 'peak')
     */
    classify(evidence, smoothedEnergy, vibe) {
        const isLatinVibe = vibe?.includes('latina') || vibe?.includes('latino') || vibe?.includes('fiesta');
        // 1. Base zone from smoothed total energy
        // 🩸 WAVE 7174: Genre-aware energy remapping for Latin vibes.
        // Reggaeton/cumbia sustain E=0.65-0.85 as normal cruising energy.
        // EDM thresholds classify this as 'intense'/'peak', filtering out
        // effects like corazon_latino (0.38 aggression) and tidal_wave (0.55).
        // Offset of -0.15 shifts the ladder so E=0.75→'active' (not 'intense'),
        // E=0.90→'intense' (not 'peak'). Only genuine peaks >0.95 reach 'peak'.
        const adjustedEnergy = isLatinVibe ? Math.max(0, smoothedEnergy - 0.15) : smoothedEnergy;
        const baseZone = this.classifyByEnergy(adjustedEnergy);
        // 2. Tension elevation — ZERO for Latin vibes.
        // Reggaeton's spectral tension is a genre characteristic (bass+
        // percussion+vocals), not a momentary event. Any elevation is artificial.
        const tensionElevation = isLatinVibe ? 0 : this.computeTensionElevation(evidence);
        // 3. Final zone = base + elevation
        const finalOrdinal = Math.min(baseZone.ordinal + tensionElevation, ENERGY_ZONE_ORDINAL['peak']);
        const finalLabel = ORDINAL_TO_ZONE[finalOrdinal];
        return {
            label: finalLabel,
            ordinal: finalOrdinal,
            baseZone: baseZone.label,
            tensionElevation,
            spectral: {
                zLow: evidence.zLow,
                zMid: evidence.zMid,
                zHigh: evidence.zHigh,
                zTotal: evidence.zTotal,
                spectralTension: evidence.spectralTension,
                spectralDivergence: evidence.spectralDivergence,
                cfHigh: evidence.cfHigh,
                eTotal: evidence.eTotal,
            },
        };
    }
    /**
     * Base zone classification — same 7-zone ladder, same thresholds.
     * This maintains backward compatibility with effect DNA energyZone ranges.
     */
    classifyByEnergy(smoothed) {
        if (smoothed < 0.15)
            return { label: 'silence', ordinal: 0 };
        if (smoothed < 0.30)
            return { label: 'valley', ordinal: 1 };
        if (smoothed < 0.45)
            return { label: 'ambient', ordinal: 2 };
        if (smoothed < 0.60)
            return { label: 'gentle', ordinal: 3 };
        if (smoothed < 0.75)
            return { label: 'active', ordinal: 4 };
        if (smoothed < 0.90)
            return { label: 'intense', ordinal: 5 };
        return { label: 'peak', ordinal: 6 };
    }
    /**
     * Compute how many zones to elevate based on spectral tension.
     *
     * TENSION ELEVATION TABLE:
     *   T < 0.3          |    0      | Normal music — no elevation
     *   0.3 ≤ T < 0.6    |    +1     | Mild tension — one zone up
     *   0.6 ≤ T < 0.9    |    +2     | Strong tension — two zones up
     *   T ≥ 0.9          |    +3     | Extreme tension — three zones up
     *
     * GATE: Elevation requires Z_high > +1.0 OR CF_high > 5.0
     * AND spectralDivergence >= 1.5.
     * This prevents false elevation from low-frequency rumble alone.
     */
    computeTensionElevation(ev) {
        // Gate: must have high-frequency evidence
        const hasHighFreqEvidence = ev.zHigh > 1.0 || ev.cfHigh > 5.0;
        if (!hasHighFreqEvidence)
            return 0;
        // Gate: must have spectral divergence (bands moving apart)
        if (ev.spectralDivergence < 1.5)
            return 0;
        const T = ev.spectralTension;
        if (T >= 0.9)
            return 3;
        if (T >= 0.6)
            return 2;
        if (T >= 0.3)
            return 1;
        return 0;
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Crea una instancia de EnergyConsciousnessEngine
 */
export function createEnergyConsciousnessEngine(config) {
    return new EnergyConsciousnessEngine(config);
}
