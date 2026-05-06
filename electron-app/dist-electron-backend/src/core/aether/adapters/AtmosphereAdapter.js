/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💨 AETHER MATRIX — ATMOSPHERE ADAPTER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3516.4: THE ELEMENTAL BRIDGE
 *
 * RESPONSABILIDAD (SINGLE):
 * Conectar el FrameContext con nodos ATMOSPHERE (fog, haze, fan, spark, pyro).
 * Genera intents de nivel y velocidad con tres puertas de seguridad (Gates)
 * que protegen el hardware y evitan activaciones peligrosas o excesivas.
 *
 * ─── SAFETY ARCHITECTURE (Blueprint §3.5) ────────────────────────────────
 *
 * GATE 1 — COOLDOWN GLOBAL ENTRE DISPAROS
 *   Toda máquina de smoke/spark/pyro requiere un tiempo de cooldown entre
 *   activaciones. Valor por tipo:
 *     fog:   5 000 ms — El motor necesita reheatear el fluido
 *     haze:  2 000 ms — Densidad continua, cooldown corto
 *     spark: 8 000 ms — Seguridad eléctrica y mecánica
 *     pyro:  30 000 ms — Interlock de seguridad de vida
 *     fan:   0 ms     — Mecánico continuo, sin cooldown requerido
 *
 * GATE 2 — LÍMITE DE 180s CONTINUOS PARA FOG
 *   Una máquina de humo que funciona más de 180s seguidos puede sobrecalentarse
 *   y dañar el elemento calefactor. Si totalActiveMs supera este límite,
 *   el adapter FUERZA nivel 0 independientemente de lo que diga el audio.
 *   El contador se resetea cuando el nivel baja naturalmente a 0.
 *
 * GATE 3 — UMBRAL DE ENERGÍA + SECCIÓN PARA SPARK
 *   Las chispas son un efecto de IMPACTO máximo. Solo se disparan si:
 *     a) audio.energy > SPARK_ENERGY_THRESHOLD (0.80)
 *     b) musical.section === 'drop'
 *     c) La Gate 1 está libre (cooldown expirado)
 *   Si alguna condición falla, nivel = 0.
 *
 * ─── LÓGICA POR TIPO ─────────────────────────────────────────────────────
 *
 *   'fog':   level = sectionIntensity × vibe.intensity, modulado por drop
 *   'haze':  level = 0.3 + vibe.intensity × 0.4 (base constante baja)
 *   'fan':   speed = audio.energy × vibe.movementSpeed
 *   'spark': level = 1.0 (on/off puro) — gated por Gate 1 + Gate 3
 *   'pyro':  level = 1.0 (on/off puro) — gated por Gate 1 (30s cooldown)
 *   'custom': level = vibe.intensity (pass-through)
 *
 * ZERO-ALLOC @ 44Hz:
 * - _intentScratch: inyectado por BaseSystem, mutado in-place
 * - _lastActivationMs: Map pre-allocado, sin new en hot-path
 * - _continuousActiveMs: Map pre-allocado para tracking de tiempo continuo
 * - _fogStartMs: Map para inicio de activación continua de fog
 * - Variables locales primitivas — viven en stack
 *
 * @module core/aether/adapters/AtmosphereAdapter
 * @version WAVE 3516.4 — ELEMENTAL BRIDGE
 */
import { NodeFamily } from '../types';
import { BaseSystem } from '../systems';
// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const INTENT_PRIORITY = 10;
const ATMOS_SOURCE = 'atmosphere-adapter';
// Gate 1: Cooldowns por tipo (ms)
const COOLDOWN_FOG_MS = 5000;
const COOLDOWN_HAZE_MS = 2000;
const COOLDOWN_SPARK_MS = 8000;
const COOLDOWN_PYRO_MS = 30000;
const COOLDOWN_FAN_MS = 0;
// Gate 2: Límite máximo de activación continua para fog
const FOG_MAX_CONTINUOUS_MS = 180000; // 3 minutos
// Gate 3: Umbral de energía y sección para chispas (spark)
const SPARK_ENERGY_THRESHOLD = 0.80;
const SPARK_REQUIRED_SECTION = 'drop';
// Nivel base de haze (ambiente continuo)
const HAZE_BASE_LEVEL = 0.30;
const HAZE_VIBE_SCALE = 0.40;
// ─────────────────────────────────────────────────────────────────────────────
// ATMOSPHERE ADAPTER
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Adapter para nodos ATMOSPHERE (fog, haze, fan, spark, pyro).
 * Implementa tres puertas de seguridad críticas para proteger el hardware
 * y garantizar la integridad del espectáculo.
 *
 * WAVE 3516.4: THE ELEMENTAL BRIDGE
 */
export class AtmosphereAdapter extends BaseSystem {
    constructor() {
        super();
        this.name = 'AtmosphereAdapter';
        this.family = NodeFamily.ATMOSPHERE;
        this.source = ATMOS_SOURCE;
        // ── Gate 1: Cooldown tracking ──────────────────────────────────────────
        /**
         * Timestamp del último DISPARO (activación desde nivel 0 → nivel > 0) por nodo.
         * Pre-allocado. Nunca se crea un Map nuevo en hot-path.
         */
        this._lastActivationMs = new Map();
        // ── Gate 2: Continuous fog tracking ───────────────────────────────────
        /**
         * Timestamp de cuando empezó la activación continua actual para nodos fog.
         * 0 = no activo actualmente.
         */
        this._fogStartMs = new Map();
        /**
         * Flag que indica si un nodo fog está en cooldown forzado por Gate 2.
         * Se resetea cuando el nivel natural cae a 0 durante suficiente tiempo.
         */
        this._fogOverheatCooldown = new Map();
        /**
         * Nivel del frame anterior por nodo — para detectar flanco de activación.
         * Necesario para Gate 1: disparar cooldown solo en el inicio, no en cada frame.
         */
        this._prevLevel = new Map();
        this._intentScratch.priority = INTENT_PRIORITY;
        this._intentScratch.source = ATMOS_SOURCE;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // HOT PATH — 44 Hz
    // ─────────────────────────────────────────────────────────────────────────
    process(view, context, bus) {
        const { audio, musical, vibe, nowMs } = context;
        const section = musical.section;
        const sectionIntensity = musical.sectionIntensity;
        const energy = audio.energy;
        view.forEach((node) => {
            // ── Limpiar valores stale del nodo anterior (zero-alloc)
            this._valuesDict['level'] = undefined;
            this._valuesDict['speed'] = undefined;
            const nodeId = node.nodeId;
            const atmosType = node.atmosType;
            // Inicializar estado si es la primera vez que vemos este nodo
            if (!this._lastActivationMs.has(nodeId)) {
                this._lastActivationMs.set(nodeId, 0);
                this._prevLevel.set(nodeId, 0);
            }
            // ── Calcular nivel candidato (antes de gates) ──────────────────────
            let candidateLevel = 0;
            switch (atmosType) {
                case 'fog': {
                    // Humo: intensidad de sección + boost en drop
                    const dropBoost = section === 'drop' ? 0.30 : 0.0;
                    candidateLevel = BaseSystem.clamp01(sectionIntensity * vibe.intensity + dropBoost);
                    break;
                }
                case 'haze': {
                    // Haze: nivel base constante bajo, modulado por vibe.intensity
                    candidateLevel = BaseSystem.clamp01(HAZE_BASE_LEVEL + vibe.intensity * HAZE_VIBE_SCALE);
                    break;
                }
                case 'fan': {
                    // Ventilador: velocidad directamente por energía × movementSpeed
                    // No necesita gates — mecánico continuo
                    const fanSpeed = BaseSystem.clamp01(energy * vibe.movementSpeed);
                    this._intentScratch.nodeId = nodeId;
                    this._valuesDict['speed'] = fanSpeed;
                    this._intentScratch.confidence = energy;
                    bus.push(this._intentScratch);
                    // Fan no usa el flujo de gates — salida temprana
                    this._prevLevel.set(nodeId, fanSpeed);
                    return;
                }
                case 'spark': {
                    // Gate 3: SOLO en drop + energy > threshold
                    const passesGate3 = (section === SPARK_REQUIRED_SECTION) && (energy > SPARK_ENERGY_THRESHOLD);
                    candidateLevel = passesGate3 ? 1.0 : 0.0;
                    break;
                }
                case 'pyro': {
                    // Pyro: on automático solo en drop con energía máxima
                    // Gate 1 (30s cooldown) es el interlock principal
                    candidateLevel = (section === 'drop' && energy > 0.90) ? 1.0 : 0.0;
                    break;
                }
                case 'custom': {
                    // Pass-through: simplemente vibe.intensity
                    candidateLevel = vibe.intensity;
                    break;
                }
                default: {
                    candidateLevel = 0;
                    break;
                }
            }
            // ── GATE 1: Cooldown entre disparos ───────────────────────────────
            const prevLevel = this._prevLevel.get(nodeId);
            const lastActMs = this._lastActivationMs.get(nodeId);
            const cooldownMs = this._getCooldownMs(atmosType);
            const cooldownPassed = (nowMs - lastActMs) >= cooldownMs;
            // Detectar flanco de activación (transición 0 → >0)
            const isActivating = (prevLevel === 0) && (candidateLevel > 0);
            if (isActivating && !cooldownPassed) {
                // Gate 1 BLOQUEADA — cooldown no expirado
                candidateLevel = 0;
            }
            else if (isActivating && cooldownPassed) {
                // Gate 1 ABIERTA — registrar nueva activación
                this._lastActivationMs.set(nodeId, nowMs);
            }
            // ── GATE 2: Límite de tiempo continuo para fog ────────────────────
            if (atmosType === 'fog') {
                // Inicializar fog tracking si necesario
                if (!this._fogStartMs.has(nodeId)) {
                    this._fogStartMs.set(nodeId, 0);
                    this._fogOverheatCooldown.set(nodeId, false);
                }
                const fogStart = this._fogStartMs.get(nodeId);
                const isOverheatCdown = this._fogOverheatCooldown.get(nodeId);
                if (isOverheatCdown) {
                    // Estamos en cooldown por sobrecalentamiento — forzar nivel 0
                    candidateLevel = 0;
                    // Reset de overheat si el candidato ya sería 0 naturalmente
                    // (es decir, la sección terminó y la energía bajó)
                    if (prevLevel === 0) {
                        this._fogOverheatCooldown.set(nodeId, false);
                        this._fogStartMs.set(nodeId, 0);
                    }
                }
                else if (candidateLevel > 0) {
                    if (fogStart === 0) {
                        // Inicio de nueva activación continua
                        this._fogStartMs.set(nodeId, nowMs);
                    }
                    else {
                        const continuousMs = nowMs - fogStart;
                        if (continuousMs >= FOG_MAX_CONTINUOUS_MS) {
                            // Gate 2 ACTIVADA — sobrecalentamiento
                            candidateLevel = 0;
                            this._fogOverheatCooldown.set(nodeId, true);
                            this._fogStartMs.set(nodeId, 0);
                        }
                    }
                }
                else {
                    // Nivel 0 — resetear contador de tiempo continuo
                    this._fogStartMs.set(nodeId, 0);
                }
            }
            // ── Emitir intent con nivel final ─────────────────────────────────
            this._intentScratch.nodeId = nodeId;
            this._valuesDict['level'] = candidateLevel;
            this._intentScratch.confidence = BaseSystem.clamp01(energy);
            bus.push(this._intentScratch);
            // Guardar nivel para detección de flanco en el próximo frame
            this._prevLevel.set(nodeId, candidateLevel);
        });
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PURE HELPER — sin allocs
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Retorna el cooldown en ms para cada tipo de dispositivo atmosférico.
     * Puro, determinista, sin allocs.
     */
    _getCooldownMs(type) {
        switch (type) {
            case 'fog': return COOLDOWN_FOG_MS;
            case 'haze': return COOLDOWN_HAZE_MS;
            case 'spark': return COOLDOWN_SPARK_MS;
            case 'pyro': return COOLDOWN_PYRO_MS;
            case 'fan': return COOLDOWN_FAN_MS;
            default: return 0;
        }
    }
}
