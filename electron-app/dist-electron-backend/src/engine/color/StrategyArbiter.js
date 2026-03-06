/**
 * 🎨 WAVE 54: STRATEGY ARBITER - "The Contrast"
 *
 * PROBLEMA: La estrategia de color (Análogo vs Complementario)
 *           cambia demasiado rápido con la síncopa instantánea,
 *           rompi      if (this.currentOverride !== 'breakdown') {
        console.log(`[StrategyArbiter] 🛡️ BREAKDOWN OVERRIDE: Forcing ANALOGOUS for visual relaxation`);
        this.currentOverride = 'breakdown';
        this.overrideStartFrame = this.frameCount;
        this.dropState = 'IDLE';  // 🎢 Reset DROP state machine
      }
    }
    // 📉 WAVE 55: BREAKDOWN RELATIVO (energía baja respecto al promedio)
    else if (input.isRelativeBreakdown) {
      sectionOverride = true;
      overrideType = 'breakdown';
      effectiveStrategy = 'analogous';
      
      if (this.currentOverride !== 'breakdown') {
        console.log(`[StrategyArbiter] 📉 RELATIVE BREAKDOWN: Energy dip detected, forcing ANALOGOUS`);
        this.currentOverride = 'breakdown';
        this.overrideStartFrame = this.frameCount;
        this.dropState = 'IDLE';  // 🎢 Reset DROP state machine
      }
    }isual.
 *
 * SOLUCIÓN: Rolling average de síncopa (10-15 segundos) con
 *           histéresis y overrides de sección.
 *
 * REGLAS DE DECISIÓN:
 * - LOW SYNC (< 0.35): ANALOGOUS (Techno/House) - Colores vecinos, orden
 * - HIGH SYNC (> 0.55): COMPLEMENTARY (Latino/Breakbeat) - Colores opuestos, caos
 * - MID SYNC: TRIADIC / SPLIT-COMPLEMENTARY
 *
 * OVERRIDES DE SECCIÓN:
 * - BREAKDOWN: Forzar ANALOGOUS (parones = relajación visual)
 * - DROP: Permitir saltar bloqueo si energía extrema (impacto)
 *
 * EFECTO VISUAL:
 * - Techno → Siempre "ordenado" (paletas suaves)
 * - Latino/Dubstep → "Vibrante" (alto contraste)
 * - Breakdowns → Siempre relajan la vista
 *
 * @author GitHub Copilot (Claude) para GestIAdev
 * @version WAVE 54 - "The Contrast"
 */
/**
 * 🎨 WAVE 54: STRATEGY ARBITER
 *
 * Estabiliza la estrategia de color basándose en el estilo rítmico
 * general, no en picos momentáneos de síncopa.
 */
export class StrategyArbiter {
    constructor(config = {}) {
        // Buffer circular para rolling average
        this.syncBuffer = [];
        this.bufferIndex = 0;
        // Estado estable
        this.stableStrategy = 'analogous';
        this.lastChangeFrame = 0;
        this.isLocked = false;
        // 🔒 WAVE 74 + WAVE 1208.5 + WAVE 1208.6: STRATEGY COMMITMENT TIMER
        // Una vez elegida una estrategia, nos comprometemos por N frames
        // 🎯 WAVE 1208.5: CHROMATIC SYNCHRONIZATION - Igualado a KeyStabilizer (30 segundos)
        //    KeyStabilizer mantiene el HUE BASE por 30s → StrategyArbiter debe mantener ACENTOS por 30s
        //    La paleta completa (base + secundarios) se comporta como UNIDAD CROMÁTICA
        // 🔒 WAVE 1208.6: ULTRA-LOCK - NO overrides por sección/drop/breakdown
        //    Solo cambios naturales basados en síncopa promediada (rolling 15s)
        // 🐛 WAVE 1209.2: FIX - Inicializar en DURATION en lugar de 0 para que empiece bloqueado
        this.strategyCommitmentFrames = 1800; // Empieza bloqueado por 30s
        this.STRATEGY_COMMITMENT_DURATION = 1800; // 30 segundos @ 60fps (sync con KeyStabilizer)
        this.lastCommittedStrategy = 'analogous';
        // Histéresis state
        this.lastDecisionZone = 'mid';
        // Contadores
        this.frameCount = 0;
        this.totalChanges = 0;
        // Callbacks para reset
        this.onResetCallbacks = [];
        this.config = { ...StrategyArbiter.DEFAULT_CONFIG, ...config };
        // Inicializar buffer con valores neutros
        this.syncBuffer = new Array(this.config.bufferSize).fill(0.45);
        // WAVE 2098: Boot silence
    }
    /**
     * 🎨 PROCESO PRINCIPAL
     *
     * Recibe síncopa y sección, retorna estrategia estabilizada.
     */
    update(input) {
        this.frameCount++;
        // � WAVE 1209 DEBUG: Log SIEMPRE para confirmar que se ejecuta
        if (this.frameCount % 600 === 0) { // Cada 10 segundos
            console.log(`[StrategyArbiter] 🔄 Running... frame=${this.frameCount} | current=${this.stableStrategy} | commitment=${this.strategyCommitmentFrames}`);
        }
        // �🔒 WAVE 1208.6: Decrementar strategy commitment timer
        if (this.strategyCommitmentFrames > 0) {
            this.strategyCommitmentFrames--;
        }
        // 🔒 WAVE 1208.6: ULTRA-LOCK MODE
        // NO BREAKS POR SECCIÓN/DROP/BREAKDOWN - Solo cambios naturales por síncopa
        // Las secciones duran milisegundos y son ruidosas (no tenemos section tracker potente)
        // Los drops ocurren 20 veces por canción (saturación de cambios)
        // SOLO permitimos cambios cuando el commitment expira naturalmente (30 segundos)
        if (this.strategyCommitmentFrames > 0) {
            // 🐛 WAVE 1209 DEBUG: Log cada 5s para diagnosticar
            if (this.frameCount % 300 === 0) {
                console.log(`[StrategyArbiter] 🔒 LOCKED: ${this.lastCommittedStrategy} | Remaining: ${this.strategyCommitmentFrames} frames (${(this.strategyCommitmentFrames / 60).toFixed(1)}s)`);
            }
            // Actualizar rolling average aunque estemos comprometidos
            const sync = Math.max(0, Math.min(1, input.syncopation));
            this.syncBuffer[this.bufferIndex] = sync;
            this.bufferIndex = (this.bufferIndex + 1) % this.config.bufferSize;
            const avgSync = this.calculateWeightedAverage();
            // MANTENER estrategia comprometida - NO EXCEPCIONES
            return {
                stableStrategy: this.lastCommittedStrategy,
                instantStrategy: this.lastCommittedStrategy,
                strategyChanged: false,
                framesSinceChange: this.frameCount - this.lastChangeFrame,
                isLocked: true,
                sectionOverride: false, // 🔒 WAVE 1208.6: NO overrides
                overrideType: 'none',
                averagedSyncopation: avgSync,
                contrastLevel: this.calculateContrastLevel(this.lastCommittedStrategy, avgSync),
            };
        }
        // === PASO 1: Actualizar rolling average ===
        const sync = Math.max(0, Math.min(1, input.syncopation));
        this.syncBuffer[this.bufferIndex] = sync;
        this.bufferIndex = (this.bufferIndex + 1) % this.config.bufferSize;
        // Calcular promedio ponderado (más peso a valores recientes)
        const avgSync = this.calculateWeightedAverage();
        // === PASO 2: Determinar estrategia instantánea basada en SÍNCOPA ===
        const instantStrategy = this.syncToStrategy(avgSync);
        // 🔒 WAVE 1208.6: NO SECTION/DROP/BREAKDOWN OVERRIDES
        // Estrategia basada SOLO en síncopa promediada (rolling 15s)
        // Sin eventos externos ruidosos que fuercen cambios
        const effectiveStrategy = instantStrategy;
        // === PASO 3: Aplicar histéresis y bloqueo ===
        let strategyChanged = false;
        const framesSinceChange = this.frameCount - this.lastChangeFrame;
        // 🔒 WAVE 1208.6: ULTRA-SIMPLE GATE - Solo cambiar si NO estamos bloqueados
        // No hay excepciones por DROP/BREAKDOWN/SECCIÓN
        const canChange = !this.isLocked || framesSinceChange >= this.config.lockingFrames;
        if (canChange && effectiveStrategy !== this.stableStrategy) {
            // Verificar histéresis (evitar oscilación en umbrales)
            const shouldChange = this.checkHysteresis(avgSync, effectiveStrategy);
            if (shouldChange) {
                const oldStrategy = this.stableStrategy;
                this.stableStrategy = effectiveStrategy;
                this.lastChangeFrame = this.frameCount;
                this.totalChanges++;
                strategyChanged = true;
                this.isLocked = true;
                // 🔒 WAVE 74: Iniciar commitment timer cuando cambia la estrategia
                // Esto evita que el interpolador resetee constantemente su destino
                this.strategyCommitmentFrames = this.STRATEGY_COMMITMENT_DURATION;
                this.lastCommittedStrategy = effectiveStrategy;
                // 🐛 WAVE 1209 DEBUG: Log detallado de cambios
                console.log(`[StrategyArbiter] 🎨 STRATEGY SHIFT: ${oldStrategy} → ${this.stableStrategy} | avgSync=${avgSync.toFixed(2)} | commitment=${this.strategyCommitmentFrames} frames (30s) | canChange=${canChange} | isLocked=${this.isLocked} | framesSinceChange=${framesSinceChange}`);
            }
        }
        // Desbloquear después de período completo
        if (this.isLocked && framesSinceChange >= this.config.lockingFrames) {
            this.isLocked = false;
        }
        // === PASO 4: Calcular nivel de contraste ===
        // 0 = muy suave (analogous puro), 1 = extremo (complementary puro)
        const contrastLevel = this.calculateContrastLevel(this.stableStrategy, avgSync);
        // === PASO 5: Return output ===
        return {
            stableStrategy: this.stableStrategy,
            instantStrategy,
            strategyChanged,
            framesSinceChange,
            isLocked: this.isLocked,
            sectionOverride: false, // 🔒 WAVE 1208.6: NO overrides
            overrideType: 'none',
            averagedSyncopation: avgSync,
            contrastLevel,
        };
    }
    /**
     * Calcula rolling average ponderado (más peso a valores recientes)
     */
    calculateWeightedAverage() {
        let weightedSum = 0;
        let totalWeight = 0;
        for (let i = 0; i < this.config.bufferSize; i++) {
            // Calcular edad del sample (0 = más reciente)
            const age = (this.bufferIndex - i - 1 + this.config.bufferSize) % this.config.bufferSize;
            // Peso exponencial decreciente con la edad
            // Recientes tienen más peso, pero todo contribuye
            const weight = Math.exp(-age / (this.config.bufferSize / 3));
            weightedSum += this.syncBuffer[i] * weight;
            totalWeight += weight;
        }
        return totalWeight > 0 ? weightedSum / totalWeight : 0.45;
    }
    /**
     * Convierte síncopa promediada a estrategia
     * 🌴 WAVE 85: Simplificado - Eliminado split-complementary
     * - 0.00-0.40: Analogous (Orden/Intro/Breakdown)
     * - 0.40-0.65: Triadic (Zona de baile principal)
     * - 0.65-1.00: Complementary (Drops/Caos)
     */
    syncToStrategy(avgSync) {
        if (avgSync < this.config.lowSyncThreshold) {
            return 'analogous';
        }
        else if (avgSync > this.config.highSyncThreshold) {
            return 'complementary';
        }
        else {
            // 🌴 WAVE 85: Toda la zona media es TRIADIC
            // Eliminamos split-complementary para dar protagonismo al juego de 3-4 colores
            return 'triadic';
        }
    }
    /**
     * Verifica histéresis para evitar oscilación en umbrales
     */
    checkHysteresis(avgSync, targetStrategy) {
        const hysteresis = this.config.hysteresisBand;
        // Determinar zona actual con histéresis
        let currentZone;
        if (avgSync < this.config.lowSyncThreshold - hysteresis) {
            currentZone = 'low';
        }
        else if (avgSync > this.config.highSyncThreshold + hysteresis) {
            currentZone = 'high';
        }
        else if (avgSync > this.config.lowSyncThreshold + hysteresis &&
            avgSync < this.config.highSyncThreshold - hysteresis) {
            currentZone = 'mid';
        }
        else {
            // En banda de histéresis, mantener zona anterior
            currentZone = this.lastDecisionZone;
        }
        // Solo cambiar si realmente salimos de la banda
        if (currentZone !== this.lastDecisionZone) {
            this.lastDecisionZone = currentZone;
            return true;
        }
        return false;
    }
    /**
     * Calcula nivel de contraste (0-1) basado en estrategia y síncopa
     */
    calculateContrastLevel(strategy, avgSync) {
        // Base level por estrategia
        const baseLevel = {
            'analogous': 0.2,
            'triadic': 0.5,
            'split-complementary': 0.7,
            'complementary': 0.9,
        };
        const base = baseLevel[strategy];
        // Modular ligeramente con síncopa actual
        const syncModifier = (avgSync - 0.45) * 0.2;
        return Math.max(0, Math.min(1, base + syncModifier));
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
        this.syncBuffer = new Array(this.config.bufferSize).fill(0.45);
        this.bufferIndex = 0;
        this.stableStrategy = 'analogous'; // Default seguro
        this.lastChangeFrame = 0;
        this.isLocked = false;
        this.lastDecisionZone = 'mid';
        this.frameCount = 0;
        console.log('[StrategyArbiter] 🧹 RESET: Strategy state cleared');
        // Notificar callbacks
        for (const callback of this.onResetCallbacks) {
            try {
                callback();
            }
            catch (e) {
                console.error('[StrategyArbiter] Callback error:', e);
            }
        }
    }
    /**
     * Obtiene la estrategia estable actual sin actualizar
     */
    getStableStrategy() {
        return this.stableStrategy;
    }
    /**
     * Obtiene estadísticas para debug
     */
    getStats() {
        return {
            stableStrategy: this.stableStrategy,
            totalChanges: this.totalChanges,
            framesSinceChange: this.frameCount - this.lastChangeFrame,
            averagedSyncopation: this.calculateWeightedAverage(),
            isLocked: this.isLocked,
        };
    }
    /**
     * Mapea estrategia a rotación de hue para secondary color
     * (Para uso en SeleneColorEngine si necesario)
     */
    static strategyToHueRotation(strategy) {
        switch (strategy) {
            case 'analogous': return 30; // ±30° del primario
            case 'triadic': return 120; // 120° (triángulo)
            case 'split-complementary': return 150; // 150° (casi opuesto)
            case 'complementary': return 180; // 180° (opuesto)
        }
    }
    /**
     * Mapea estrategia a nombre legible para UI
     */
    static strategyToDisplayName(strategy) {
        switch (strategy) {
            case 'analogous': return 'Análogo (Suave)';
            case 'triadic': return 'Triádico (Equilibrado)';
            case 'split-complementary': return 'Split-Complementario (Vibrante)';
            case 'complementary': return 'Complementario (Impacto)';
        }
    }
}
// Default config
// 🌴 WAVE 85: TROPICAL MIRROR - Expandir zona Triadic para baile latino
// 🎭 WAVE 1208.5: CHROMATIC SYNCHRONIZATION - Igualado a KeyStabilizer (30s)
StrategyArbiter.DEFAULT_CONFIG = {
    bufferSize: 900, // 15 segundos @ 60fps (rolling average)
    lockingFrames: 1800, // 🎭 WAVE 1208.5: 30 segundos (sync con KeyStabilizer)
    lowSyncThreshold: 0.40, // 🌴 WAVE 85: < 0.40 = ANALOGOUS (antes 0.35)
    highSyncThreshold: 0.65, // 🌴 WAVE 85: > 0.65 = COMPLEMENTARY (antes 0.55)
    hysteresisBand: 0.05, // Banda de histéresis
    dropOverrideEnergy: 0.85, // Energía para override de DROP
};
// Export para uso en workers
export default StrategyArbiter;
