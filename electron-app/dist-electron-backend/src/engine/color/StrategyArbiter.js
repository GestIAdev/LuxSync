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
        // 🔓 WAVE 7719: BUG FIX — 30s lock was keeping engine PERPETUALLY stuck in Analogous.
        //    Initial lock reduced from 1800 (30s) to 180 (3s) so the strategy can actually
        //    respond to the music within the first few bars. Commitment reduced from 1800
        //    to 600 (10s) so changes happen often enough to be visible.
        this.strategyCommitmentFrames = 180; // WAVE 7719: 3s initial (was 30s)
        this.STRATEGY_COMMITMENT_DURATION = 600; // WAVE 7719: 10s (was 30s)
        this.lastCommittedStrategy = 'analogous';
        // Histéresis state
        // 🎆 WAVE 7757: FIX — inicializar a 'low' (coherente con stableStrategy='analogous').
        // Antes era 'mid' (que mapea a 'triadic'), creando una inconsistencia que
        // atrapaba el motor en 'analogous' para siempre porque checkHysteresis
        // veía currentZone='mid' === lastDecisionZone='mid' → nunca aprobaba cambio.
        this.lastDecisionZone = 'low';
        // Contadores
        this.frameCount = 0;
        this.totalChanges = 0;
        // 🎆 WAVE 7757: SIDEREAL CLOCK SYNC — Track del último slotIndex recibido.
        // Cuando siderealSlotIndex cambia, la estrategia se re-evalúa. Entre slots,
        // la estrategia queda congelada al valor decidido en el último cambio de slot.
        this.lastSiderealSlotIndex = undefined;
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
     *
     * 🎆 WAVE 7757: SIDEREAL CLOCK SYNC — Si se proporciona siderealSlotIndex,
     * la estrategia SOLO se re-evalúa cuando el slot avanza. Entre slots,
     * la estrategia queda congelada. Si siderealSlotIndex es undefined
     * (vibe sin reloj), se usa el commitment timer de 10s como fallback.
     */
    update(input) {
        this.frameCount++;
        // === PASO 0: Actualizar rolling average SIEMPRE ===
        const sync = Math.max(0, Math.min(1, input.syncopation));
        this.syncBuffer[this.bufferIndex] = sync;
        this.bufferIndex = (this.bufferIndex + 1) % this.config.bufferSize;
        const avgSync = this.calculateWeightedAverage();
        // === PASO 1: Detectar cambio de slot del Sidereal Clock ===
        const hasSiderealClock = input.siderealSlotIndex !== undefined;
        const slotChanged = hasSiderealClock && input.siderealSlotIndex !== this.lastSiderealSlotIndex;
        if (slotChanged) {
            this.lastSiderealSlotIndex = input.siderealSlotIndex;
        }
        // === PASO 2: Determinar si se permite re-evaluar la estrategia ===
        // 🎆 WAVE 7757:
        //   - Con Sidereal Clock: solo en cambio de slot (cada 4-6 min)
        //   - Sin Sidereal Clock: commitment timer de 10s (WAVE 7719)
        let canReevaluate;
        if (hasSiderealClock) {
            canReevaluate = slotChanged;
        }
        else {
            // Fallback: commitment timer (decrementar)
            if (this.strategyCommitmentFrames > 0) {
                this.strategyCommitmentFrames--;
            }
            const framesSinceChange = this.frameCount - this.lastChangeFrame;
            canReevaluate = !this.isLocked || framesSinceChange >= this.config.lockingFrames;
        }
        // === PASO 3: Si NO se puede re-evaluar, retornar estrategia actual ===
        if (!canReevaluate) {
            return {
                stableStrategy: this.stableStrategy,
                instantStrategy: this.syncToStrategy(avgSync),
                strategyChanged: false,
                framesSinceChange: this.frameCount - this.lastChangeFrame,
                isLocked: true,
                sectionOverride: false,
                overrideType: 'none',
                averagedSyncopation: avgSync,
                contrastLevel: this.calculateContrastLevel(this.stableStrategy, avgSync),
            };
        }
        // === PASO 4: Re-evaluar estrategia (slot cambió O commitment expiró) ===
        const instantStrategy = this.syncToStrategy(avgSync);
        const effectiveStrategy = instantStrategy;
        let strategyChanged = false;
        if (effectiveStrategy !== this.stableStrategy) {
            // Verificar histéresis (evitar oscilación en umbrales)
            const shouldChange = this.checkHysteresis(avgSync, effectiveStrategy);
            if (shouldChange) {
                const oldStrategy = this.stableStrategy;
                this.stableStrategy = effectiveStrategy;
                this.lastChangeFrame = this.frameCount;
                this.totalChanges++;
                strategyChanged = true;
                this.isLocked = true;
                // 🎆 WAVE 7757: Con Sidereal Clock, no hay commitment timer — el slot
                // es el timer. Sin clock, mantener el commitment de 10s.
                if (!hasSiderealClock) {
                    this.strategyCommitmentFrames = this.STRATEGY_COMMITMENT_DURATION;
                }
                this.lastCommittedStrategy = effectiveStrategy;
                console.log(`[StrategyArbiter] 🎨 STRATEGY SHIFT: ${oldStrategy} → ${this.stableStrategy} | avgSync=${avgSync.toFixed(2)} | slot=${input.siderealSlotIndex ?? 'no-clock'} | canReevaluate=${canReevaluate}`);
            }
        }
        // Desbloquear después de período completo (solo modo no-clock)
        if (!hasSiderealClock && this.isLocked && (this.frameCount - this.lastChangeFrame) >= this.config.lockingFrames) {
            this.isLocked = false;
        }
        // === PASO 5: Return output ===
        const contrastLevel = this.calculateContrastLevel(this.stableStrategy, avgSync);
        return {
            stableStrategy: this.stableStrategy,
            instantStrategy,
            strategyChanged,
            framesSinceChange: this.frameCount - this.lastChangeFrame,
            isLocked: this.isLocked,
            sectionOverride: false,
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
        this.lastDecisionZone = 'low'; // 🎆 WAVE 7757: coherente con stableStrategy='analogous'
        this.frameCount = 0;
        this.lastSiderealSlotIndex = undefined; // 🎆 WAVE 7757
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
// 🔓 WAVE 7719: Reduced lockingFrames from 1800 to 600 (10s) to match commitment duration.
//    30s was too long — the strategy couldn't adapt within a single song section.
StrategyArbiter.DEFAULT_CONFIG = {
    bufferSize: 900, // 15 segundos @ 60fps (rolling average)
    lockingFrames: 600, // 🎭 WAVE 7719: 10 segundos (was 30s)
    lowSyncThreshold: 0.40, // 🌴 WAVE 85: < 0.40 = ANALOGOUS (antes 0.35)
    highSyncThreshold: 0.65, // 🌴 WAVE 85: > 0.65 = COMPLEMENTARY (antes 0.55)
    hysteresisBand: 0.05, // Banda de histéresis
    dropOverrideEnergy: 0.85, // Energía para override de DROP
};
// Export para uso en workers
export default StrategyArbiter;
