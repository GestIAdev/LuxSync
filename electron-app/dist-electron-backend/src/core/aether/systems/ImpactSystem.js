/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  AETHER MATRIX — IMPACT SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.3: El cerebro de la física lumínica reactiva al audio.
 *
 * RESPONSABILIDAD:
 * Traducir los transitorios del DSP (golpes, drops, energía espectral)
 * en NodeIntents de intensidad (dimmer + shutter) para todos los
 * IMPACT_NODEs registrados en el NodeGraph.
 *
 * DOMINIO:
 * El ImpactSystem es el dueño exclusivo del canal `dimmer` y `shutter`
 * en la capa L0 (System intents). Responde a:
 * - Kicks y sub-bass (role: percussion)
 * - Respiración de medios (role: breath)
 * - Acentos de agudos (role: accent)
 * - Relleno ambiental (role: ambient)
 *
 * FÍSICA REACTIVA — LA CURVA EXPONENCIAL:
 * Los nodos de percusión usan una curva exponencial con exponent=2.5:
 * ```
 * input=0.30  →  output=0.027  (casi nada, silencio relativo)
 * input=0.50  →  output=0.177  (presencia tenue)
 * input=0.70  →  output=0.408  (presencia real)
 * input=0.85  →  output=0.614  (impacto visible)
 * input=0.95  →  output=0.857  (golpe brutal)
 * input=1.00  →  output=1.000  (whiteout total)
 * ```
 * Sensación: silencio casi absoluto entre golpes, latigazo instantáneo
 * cuando el kick impacta.
 *
 * LA MATRIZ DE BANDAS × ROLES:
 * Cada rol tiene una distribución de pesos por banda de frecuencia.
 * Los pesos por defecto están aquí; el VibeProfile puede overridearlos.
 *
 *  Band        | percussion | breath | accent | ambient
 * -------------|------------|--------|--------|--------
 *  subBass     |    0.80    |  0.10  |  0.00  |  0.10
 *  bass        |    0.60    |  0.20  |  0.05  |  0.15
 *  mid         |    0.10    |  0.70  |  0.10  |  0.10
 *  highMid     |    0.05    |  0.15  |  0.70  |  0.10
 *  presence    |    0.00    |  0.10  |  0.80  |  0.10
 *  air         |    0.00    |  0.05  |  0.60  |  0.35
 *  energy      |    0.20    |  0.30  |  0.20  |  0.30
 *
 * ENVELOPE DECAY:
 * El envolvente de cada nodo tiene ataque instantáneo (el nuevo valor
 * del audio siempre puede subir inmediatamente) y decay configurado
 * por el tipo de respuesta:
 * - percussion: decay rápido (la intensidad cae si el bass baja)
 * - breath:     decay suave (breathing persistente)
 * - accent:     decay muy rápido (strobes afilados)
 * - ambient:    decay lentísimo (fondo que persiste)
 *
 * @module core/aether/systems/ImpactSystem
 * @version WAVE 3505.3
 */
import { NodeFamily } from '../types';
import { BaseSystem, } from './BaseSystem';
// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT BAND MIX MATRICES
// Cada rol tiene su firma espectral por defecto.
// Estos objetos son singleton — se crean una vez, son readonly,
// y el hot path solo los lee. Zero-alloc.
// ═══════════════════════════════════════════════════════════════════════════
const DEFAULT_BAND_MIX_PERCUSSION = Object.freeze({
    subBass: 0.80,
    bass: 0.60,
    mid: 0.10,
    highMid: 0.05,
    presence: 0.00,
    air: 0.00,
    energy: 0.20,
});
const DEFAULT_BAND_MIX_BREATH = Object.freeze({
    subBass: 0.10,
    bass: 0.20,
    mid: 0.70,
    highMid: 0.15,
    presence: 0.10,
    air: 0.05,
    energy: 0.30,
});
const DEFAULT_BAND_MIX_ACCENT = Object.freeze({
    subBass: 0.00,
    bass: 0.05,
    mid: 0.10,
    highMid: 0.70,
    presence: 0.80,
    air: 0.60,
    energy: 0.20,
});
const DEFAULT_BAND_MIX_AMBIENT = Object.freeze({
    subBass: 0.10,
    bass: 0.15,
    mid: 0.10,
    highMid: 0.10,
    presence: 0.10,
    air: 0.35,
    energy: 0.30,
});
const DEFAULT_BAND_MIX_PRIMARY = Object.freeze({
    subBass: 0.20,
    bass: 0.30,
    mid: 0.25,
    highMid: 0.10,
    presence: 0.05,
    air: 0.00,
    energy: 0.40,
});
// Decay rates por rol (fracción de reducción por ms)
// Estos valores producen caídas en milisegundos reales:
// - percussion: 300ms desde peak a cero
// - breath:     1200ms (generoso, orgánico)
// - accent:     150ms (rápido, stacatto)
// - ambient:    3000ms (persiste)
// - primary:    600ms
const DECAY_RATE_PERCUSSION = 1 / 300;
const DECAY_RATE_BREATH = 1 / 1200;
const DECAY_RATE_ACCENT = 1 / 150;
const DECAY_RATE_AMBIENT = 1 / 3000;
const DECAY_RATE_PRIMARY = 1 / 600;
// Valor mínimo (floor) que mantienen los nodos de ambient/breath
// en silencio — para que no colapsen a cero total.
const FLOOR_BREATH = 0.05;
const FLOOR_AMBIENT = 0.08;
const FLOOR_PRIMARY = 0.03;
// Prioridad de capa L0 para impact intents
const IMPACT_INTENT_PRIORITY = 10;
// ═══════════════════════════════════════════════════════════════════════════
// IMPACT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ⚡ ImpactSystem — Física lumínica reactiva al audio.
 *
 * Itera sobre todos los IMPACT_NODEs del NodeGraph y genera un
 * NodeIntent de dimmer para cada uno, calculado a partir de:
 * 1. Las bandas de audio del frame actual.
 * 2. Los pesos de mezcla por rol (BandMixWeights, configurados por Vibe).
 * 3. La curva de transferencia del nodo (exponential/logarithmic/etc.).
 * 4. El estado del envolvente del nodo (decay entre frames).
 *
 * ZERO-ALLOC GARANTIZADO:
 * - `_intentScratch` heredado de BaseSystem — mutado in-place.
 * - `_valuesDict` heredado — mismo objeto reutilizado.
 * - No se crea ningún objeto nuevo durante `process()`.
 * - El envolvente se escribe directamente en `node.envelopeState`.
 */
export class ImpactSystem extends BaseSystem {
    constructor() {
        super();
        this.name = 'ImpactSystem';
        this.family = NodeFamily.IMPACT;
        // Establecer el source del scratch intent una sola vez
        this._intentScratch.source = 'impact_system';
        this._intentScratch.priority = IMPACT_INTENT_PRIORITY;
        this._intentScratch.confidence = 1.0;
    }
    // ═════════════════════════════════════════════════════════════════════════
    // process() — EL HOT PATH. 44 veces por segundo.
    // ═════════════════════════════════════════════════════════════════════════
    /**
     * Calcula y escribe los NodeIntents de intensidad para todos los
     * IMPACT_NODEs en el IntentBus.
     *
     * PROTOCOLO ZERO-ALLOC:
     * ```
     * forEach(node) → {
     *   1. computeBandMix(audio, node.bandMix)      → raw energy (número)
     *   2. applyTransferCurve(raw, node.transferCurve) → shaped value
     *   3. applyEnvelopeDecay(node, shaped, deltaMs)  → envelopeValue
     *   4. applyFloor(envelopeValue, node.role)       → final dimmer
     *   5. write _intentScratch.nodeId, values.dimmer
     *   6. bus.push(_intentScratch as INodeIntent)    → O(1), zero-alloc
     * }
     * ```
     *
     * @param view     — Vista de todos los IMPACT_NODEs activos
     * @param context  — Contexto del frame (audio + musical + vibe)
     * @param bus      — El IntentBus donde escribir los intents
     */
    process(view, context, bus) {
        const audio = context.audio;
        const deltaMs = context.deltaMs;
        const vibe = context.vibe;
        // Limpiar el dict de values del frame anterior.
        // El único key que usa ImpactSystem es 'dimmer' (y opcionalmente 'shutter').
        // Establecemos un valor por defecto para asegurar que existe la key.
        this._valuesDict['dimmer'] = 0;
        view.forEach((node) => {
            // ── 1. Seleccionar los pesos de banda para este nodo ─────────────────
            // Si el Vibe tiene un override para el rol de este nodo, usarlo.
            // Si no, usar la matriz por defecto del rol.
            const weights = this._resolveBandMix(node.role, vibe);
            // ── 2. Mezcla ponderada de bandas → energía bruta [0, 1] ─────────────
            const rawEnergy = BaseSystem.computeBandMix(audio, weights);
            // ── 3. Aplicar curva de transferencia del nodo ────────────────────────
            const shapedValue = this._applyNodeCurve(rawEnergy, node);
            // ── 4. Envolvente con decay suave ─────────────────────────────────────
            // El envolvente permite: ataque instantáneo (si el nuevo valor es mayor)
            // y decay controlado por rol (si el nuevo valor es menor).
            const envelopeValue = this._stepEnvelope(node, shapedValue, deltaMs);
            // ── 5. Floor por rol (los ambient no colapsan a 0 total) ──────────────
            const dimmer = this._applyFloor(envelopeValue, node.role);
            // ── 6. Aplicar Grand Master del Vibe ──────────────────────────────────
            // El vibe.intensity es un multiplicador global base.
            // El Grand Master real del Arbiter lo aplica post-arbitraje.
            const finalDimmer = BaseSystem.clamp01(dimmer * context.vibe.intensity);
            // ── 7. Escribir intent en el scratch pre-allocated ────────────────────
            // INVARIANTE: este objeto es siempre el mismo. No se crea nada nuevo.
            this._intentScratch.nodeId = node.nodeId;
            this._valuesDict['dimmer'] = finalDimmer;
            // Algunos nodos de acento pueden controlar también el shutter
            // para strobes musicales (cuando hay transiente fuerte)
            if (node.role === 'accent' && audio.hasTransient && audio.transientStrength > 0.7) {
                this._valuesDict['shutter'] = 1.0;
            }
            else {
                // Eliminar la key 'shutter' si no aplica para evitar que
                // el Arbiter la procese innecesariamente.
                // delete de una key conocida es O(1) y V8 lo optimiza bien.
                if ('shutter' in this._valuesDict) {
                    delete this._valuesDict['shutter'];
                }
            }
            // ── 8. Push al bus ────────────────────────────────────────────────────
            // bus.push copia valores antes de retornar → safe reutilizar el scratch.
            bus.push(this._intentScratch);
        });
    }
    // ═════════════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS — Lógica pura, solo usada en el hot path
    // ═════════════════════════════════════════════════════════════════════════
    /**
     * Resuelve los BandMixWeights para un nodo según su rol y el Vibe activo.
     *
     * Si el Vibe tiene un override para ese rol, lo usa (parcial — solo los
     * campos presentes en el override reemplazan los defaults).
     * Si no hay override, retorna el singleton de defaults.
     *
     * Zero-alloc: no crea objetos nuevos si no hay override activo.
     * Si hay override, el VibeProfile ya lo pre-construyó; solo leemos.
     */
    _resolveBandMix(role, vibe) {
        if (vibe.bandMatrixOverride) {
            const override = vibe.bandMatrixOverride[role];
            if (override) {
                // El override ya fue construido por el VibeProfile en patch time.
                // Aquí solo leemos — zero-alloc en hot path.
                // El override es un Partial<BandMixWeights>; para los campos ausentes
                // usamos el default del rol. Hacemos el merge en patch time (ver VibeProfile),
                // no aquí. Aquí asumimos que si hay override, YA está completo.
                return override;
            }
        }
        return this._getDefaultBandMix(role);
    }
    /** Retorna los BandMixWeights singleton para un rol estándar. */
    _getDefaultBandMix(role) {
        switch (role) {
            case 'percussion': return DEFAULT_BAND_MIX_PERCUSSION;
            case 'breath': return DEFAULT_BAND_MIX_BREATH;
            case 'accent': return DEFAULT_BAND_MIX_ACCENT;
            case 'ambient': return DEFAULT_BAND_MIX_AMBIENT;
            default: return DEFAULT_BAND_MIX_PRIMARY;
        }
    }
    /**
     * Aplica la curva de transferencia configurada en el nodo.
     * Usa las funciones estáticas de BaseSystem — sin alloc.
     */
    _applyNodeCurve(value, node) {
        const curve = node.transferCurve;
        switch (curve.type) {
            case 'exponential':
                return BaseSystem.applyExponential(value, curve.exponent ?? 2.5, curve.noiseGate ?? 0);
            case 'logarithmic':
                return BaseSystem.applyLogarithmic(value);
            case 'scurve':
                return BaseSystem.applySCurve(value);
            case 'gamma':
                return BaseSystem.applyGamma(value, curve.gamma ?? 2.2);
            case 'linear':
            default:
                return BaseSystem.applyLinear(value);
        }
    }
    /**
     * Avanza el envolvente del nodo un deltaMs.
     *
     * ATAQUE: si el shapedValue es mayor que el envolvente actual,
     * el envolvente salta instantáneamente (para que el kick se sienta).
     *
     * DECAY: si el shapedValue es menor, el envolvente cae según la
     * tasa de decay del rol (lineal en el tiempo).
     *
     * El estado se escribe directamente en `node.envelopeState` —
     * mutación in-place, zero-alloc.
     *
     * NOTA: EnvelopeState tiene campos readonly en el contrato.
     * Aquí necesitamos mutarlos — usamos cast forzado ya que este
     * System ES el propietario legítimo del estado del nodo.
     */
    _stepEnvelope(node, shapedValue, deltaMs) {
        const env = node.envelopeState;
        const current = env.current;
        if (shapedValue >= current) {
            // Ataque instantáneo
            ;
            env.current = shapedValue;
            env.velocity = 0;
            return shapedValue;
        }
        // Decay según rol
        const decayRate = this._getDecayRate(node.role);
        const decayed = current - decayRate * deltaMs;
        const next = decayed < shapedValue ? shapedValue : decayed;
        env.current = next;
        env.velocity = (next - current) / (deltaMs || 1);
        return next;
    }
    /** Retorna la tasa de decay (por ms) para un rol. */
    _getDecayRate(role) {
        switch (role) {
            case 'percussion': return DECAY_RATE_PERCUSSION;
            case 'breath': return DECAY_RATE_BREATH;
            case 'accent': return DECAY_RATE_ACCENT;
            case 'ambient': return DECAY_RATE_AMBIENT;
            default: return DECAY_RATE_PRIMARY;
        }
    }
    /**
     * Aplica el floor mínimo de intensidad por rol.
     * Breath y ambient no colapsan a cero total — mantienen
     * una presencia mínima que les da vida incluso en silencio.
     */
    _applyFloor(value, role) {
        switch (role) {
            case 'breath':
                return value < FLOOR_BREATH ? FLOOR_BREATH : value;
            case 'ambient':
                return value < FLOOR_AMBIENT ? FLOOR_AMBIENT : value;
            case 'primary':
                return value < FLOOR_PRIMARY ? FLOOR_PRIMARY : value;
            default:
                return value;
        }
    }
}
