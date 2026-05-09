/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧠 WAVE 4524.3 — SELENE-AETHER ADAPTER (L3 COGNITIVE BRIDGE)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Traductor entre el mundo cognitivo de Selene (efectos nominales + zonas
 * canónicas) y el mundo atómico de Aether (intenciones de canal por nodo).
 *
 * PIPELINE:
 *   CombinedEffectOutput + ConsciousnessOutput
 *     → Disassembler (campos semánticos → canales DMX normalizados 0-1)
 *       → ZoneNodeRouter (zona canónica → NodeId[])
 *         → IIntentBus.push() con priority=300, source='effect'
 *
 * REGLAS ABSOLUTAS:
 *   ❌ NUNCA emite targetX/Y/Z, pan, tilt (L3 bloqueado de movimiento)
 *   ✅ CERO new en hot-path (scratch objects pre-allocated)
 *   ✅ priority = 300 (L3 Effects range: 300-399)
 *   ✅ source = 'effect'
 *
 * SCRATCH OBJECTS:
 *   El blueprint especifica 3 familias de scratch: IMPACT, COLOR, STROBE.
 *   Cada uno tiene su propio dict de values para shapes de V8 estables.
 *   Se mutan in-place; bus.push() los captura antes de retornar.
 *
 * @module core/aether/adapters/selene-aether-adapter
 * @version WAVE 4524.3
 */
import { NodeFamily } from '../types';
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES L3
// ═══════════════════════════════════════════════════════════════════════════
/** Prioridad L3: Effects (300-399) — domina sobre L0 (10) y L1 (100) */
const L3_PRIORITY = 300;
/** Fuente de todos los intents emitidos por este adapter */
const L3_SOURCE = 'effect';
/**
 * Composición mínima para procesar el frame.
 * Por debajo de este umbral, el efecto es invisible — early return.
 */
const MIN_GLOBAL_COMPOSITION = 0.01;
/**
 * Energía máxima para físicas de modifier.
 * Por encima de 0.85, el Energy Override tiene VETO TOTAL (WAVE 450).
 */
const MAX_ENERGY_FOR_PHYSICS_MOD = 0.85;
// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Conversión HSL → RGB (inline, zero-alloc)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Clamp de 0 a 1 — inline, sin función extra.
 */
function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}
/**
 * Convierte HSL (h: 0-360, s: 0-100, l: 0-100) a RGB normalizado (0-1).
 *
 * Algoritmo estándar de 6 zonas, completamente inline.
 * Zero-alloc: escribe directamente en el objeto destino pasado por referencia.
 */
function hslToRgbInto(h, s, l, out) {
    const sn = s / 100;
    const ln = l / 100;
    const c = (1 - Math.abs(2 * ln - 1)) * sn;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = ln - c / 2;
    const hi = Math.floor(h / 60) % 6;
    let r = 0;
    let g = 0;
    let b = 0;
    if (hi === 0) {
        r = c;
        g = x;
        b = 0;
    }
    else if (hi === 1) {
        r = x;
        g = c;
        b = 0;
    }
    else if (hi === 2) {
        r = 0;
        g = c;
        b = x;
    }
    else if (hi === 3) {
        r = 0;
        g = x;
        b = c;
    }
    else if (hi === 4) {
        r = x;
        g = 0;
        b = c;
    }
    else {
        r = c;
        g = 0;
        b = x;
    }
    out.r = clamp01(r + m);
    out.g = clamp01(g + m);
    out.b = clamp01(b + m);
}
/** Buffer temporal para conversiones HSL→RGB (reutilizado, zero-alloc) */
const _rgbBuffer = { r: 0, g: 0, b: 0 };
function isHslColor(color) {
    return color.isHSL === true || (typeof color.h === 'number' &&
        typeof color.s === 'number' &&
        typeof color.l === 'number');
}
// ═══════════════════════════════════════════════════════════════════════════
// SELENE AETHER ADAPTER
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Adapter L3: traduce CombinedEffectOutput + ConsciousnessOutput
 * en intents atómicos hacia el IntentBus.
 *
 * NO extiende BaseSystem porque no tiene un INodeView propio —
 * trabaja con múltiples familias a través del ZoneNodeRouter.
 *
 * Sigue el mismo patrón de scratch de BaseSystem: objetos mutables
 * pre-allocated, cast a INodeIntent solo en el push().
 */
export class SeleneAetherAdapter {
    constructor(zoneRouter) {
        // ── Scratch objects pre-allocated (ver §5.4 del blueprint) ─────────────
        /** Scratch para canales IMPACT (dimmer) */
        this._impactValues = { dimmer: 0 };
        this._impactScratch = {
            nodeId: '',
            values: null,
            priority: L3_PRIORITY,
            confidence: 1.0,
            source: L3_SOURCE,
        };
        /** Scratch para canales COLOR (aliases duales rgb + red/green/blue + white/amber) */
        this._colorValues = {
            r: 0,
            g: 0,
            b: 0,
            red: 0,
            green: 0,
            blue: 0,
            white: 0,
            amber: 0,
        };
        this._colorScratch = {
            nodeId: '',
            values: null,
            priority: L3_PRIORITY,
            confidence: 1.0,
            source: L3_SOURCE,
        };
        /** Scratch para canales STROBE (strobeRate, shutter) */
        this._strobeValues = { strobeRate: 0, shutter: 0 };
        this._strobeScratch = {
            nodeId: '',
            values: null,
            priority: L3_PRIORITY,
            confidence: 1.0,
            source: L3_SOURCE,
        };
        this._zoneRouter = zoneRouter;
        // Cablear values al scratch — un único wiring en construcción
        this._impactScratch.values = this._impactValues;
        this._colorScratch.values = this._colorValues;
        this._strobeScratch.values = this._strobeValues;
    }
    // ═════════════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═════════════════════════════════════════════════════════════════════════
    /**
     * Ingesta por frame. Traduce el output cognitivo de Selene y los efectos
     * activos en intents L3 atómicos que se empujan al IntentBus.
     *
     * ZERO-ALLOC: usa scratch objects pre-allocated sin ningún `new`.
     * BLOQUEO DE MOVIMIENTO: nunca emite targetX/Y/Z ni pan/tilt.
     *
     * @param consciousness - Output del DecisionMaker (null = no-op en physics)
     * @param effectOutput  - Output combinado del EffectManager singleton
     * @param deltaMs       - Delta time del frame (no usado en esta versión)
     * @param bus           - IntentBus donde empujar los intents L3
     */
    ingest(consciousness, effectOutput, _deltaMs, bus) {
        // ── Gate 1: Sin efectos activos → no-op ──────────────────────────────
        if (!effectOutput.hasActiveEffects) {
            return;
        }
        // ── Gate 2: Composición global mínima ────────────────────────────────
        // Si globalComposition no viene (effects legacy), asumimos opacidad total
        // para no silenciar color/zoneOverrides válidos.
        const composition = effectOutput.globalComposition ?? 1;
        if (effectOutput.globalComposition !== undefined &&
            composition < MIN_GLOBAL_COMPOSITION) {
            return;
        }
        // ── Fase 1: Overrides globales (zona 'all') ───────────────────────────
        this._processGlobalOverrides(effectOutput, composition, bus);
        // ── Fase 2: Zone overrides (zonas específicas) ────────────────────────
        if (effectOutput.zoneOverrides) {
            this._processZoneOverrides(effectOutput.zoneOverrides, composition, bus);
        }
        // ── Fase 3: Physics modifier (strobe) ─────────────────────────────────
        if (consciousness?.physicsModifier) {
            this._processPhysicsModifier(consciousness.physicsModifier, consciousness, bus);
        }
    }
    // ═════════════════════════════════════════════════════════════════════════
    // PRIVATE — HOT-PATH (zero-alloc, mutación in-place de scratch objects)
    // ═════════════════════════════════════════════════════════════════════════
    /**
     * Emite los overrides globales (aplican a la zona 'all').
     *
     * Canales que puede emitir: dimmer, white, amber, r/g/b.
     * NO emite movimiento (regla L3 estricta).
     */
    _processGlobalOverrides(output, composition, bus) {
        // dimmerOverride → IMPACT nodes zona 'all'
        if (output.dimmerOverride !== undefined) {
            this._emitImpact('all', clamp01(output.dimmerOverride), composition, bus);
        }
        // colorOverride HSL/RGB → COLOR nodes zona 'all'
        if (output.colorOverride) {
            this._emitColor('all', output.colorOverride, composition, bus);
            this._emitOmniZoneColors(output.colorOverride, composition, bus);
        }
        // whiteOverride → COLOR nodes zona 'all' (canal 'white')
        if (output.whiteOverride !== undefined) {
            this._emitWhite('all', clamp01(output.whiteOverride), composition, bus);
        }
        // amberOverride → COLOR nodes zona 'all' (canal 'amber')
        if (output.amberOverride !== undefined) {
            this._emitAmber('all', clamp01(output.amberOverride), composition, bus);
        }
        // strobeRate → IMPACT nodes zona 'all' (canal 'strobeRate' para fixtures con shutter)
        if (output.strobeRate !== undefined && output.strobeRate > 0) {
            this._emitStrobe('all', clamp01(output.strobeRate), composition, bus);
        }
    }
    /**
     * WAVE 4684: Inyección nativa de color para zonas ambientales.
     * Se emiten intents explícitos para `ambient` y `air` para que no dependan
     * del fallback de `all` y tengan carácter cromático propio.
     */
    _emitOmniZoneColors(base, composition, bus) {
        const ambColor = this._deriveAmbientColor(base);
        this._emitColor('ambient', ambColor, composition, bus);
        const airColor = this._deriveAirColor(base);
        this._emitColor('air', airColor, composition, bus);
    }
    /**
     * Derive a soft wash color for the ambient zone from the primary color.
     * Same hue, reduced saturation (×0.6) and lightness (×0.5).
     */
    _deriveAmbientColor(base) {
        if (isHslColor(base)) {
            return {
                h: base.h,
                s: Math.min(100, base.s * 0.58),
                l: Math.min(100, base.l * 0.62),
                isHSL: true,
            };
        }
        // RGB fallback: warm wash, no blackout.
        return {
            r: (base.r ?? base.red ?? 0) * 0.62,
            g: (base.g ?? base.green ?? 0) * 0.62,
            b: (base.b ?? base.blue ?? 0) * 0.62,
        };
    }
    /**
     * Derive an accent color for the air/haze zone from the primary color.
     * Hue shifted +30°, reduced saturation (×0.7) and lightness (×0.55).
     */
    _deriveAirColor(base) {
        if (isHslColor(base)) {
            return {
                h: (base.h + 22) % 360,
                s: Math.min(100, base.s * 0.72),
                l: Math.min(100, base.l * 0.66),
                isHSL: true,
            };
        }
        // RGB fallback: same color but dimmed
        return {
            r: (base.r ?? base.red ?? 0) * 0.66,
            g: (base.g ?? base.green ?? 0) * 0.66,
            b: (base.b ?? base.blue ?? 0) * 0.66,
        };
    }
    /**
     * Emite los overrides específicos por zona.
     *
     * Itera el mapa zoneOverrides y traduce cada zona a sus NodeIds.
     * DESCARTA completamente el campo `movement` de cada zona (regla L3).
     */
    _processZoneOverrides(zoneOverrides, composition, bus) {
        for (const zoneId in zoneOverrides) {
            const override = zoneOverrides[zoneId];
            const zone = zoneId;
            // blendMode/priority/metadatos viejos se ignoran: la mezcla ya la decide el Arbiter.
            void override.blendMode;
            // dimmer → IMPACT nodes de esta zona
            if (override.dimmer !== undefined) {
                this._emitImpact(zone, clamp01(override.dimmer), composition, bus);
            }
            // color HSL/RGB → COLOR nodes de esta zona
            if (override.color) {
                this._emitColor(zone, override.color, composition, bus);
            }
            // white → COLOR nodes de esta zona
            if (override.white !== undefined) {
                this._emitWhite(zone, clamp01(override.white), composition, bus);
            }
            // amber → COLOR nodes de esta zona
            if (override.amber !== undefined) {
                this._emitAmber(zone, clamp01(override.amber), composition, bus);
            }
            // strobeRate → IMPACT nodes de esta zona
            if (override.strobeRate !== undefined && override.strobeRate > 0) {
                this._emitStrobe(zone, clamp01(override.strobeRate), composition, bus);
            }
            // ❌ override.movement → DESCARTADO (Regla L3: movimiento ≡ KineticAdapter)
        }
    }
    /**
     * Emite intents de strobe/flash basados en el physicsModifier de Selene.
     *
     * Condiciones para emitir:
     *   - modifier.confidence > 0.5
     *   - energy < MAX_ENERGY_FOR_PHYSICS_MOD (0.85) → WAVE 450 Energy Override
     *
     * Emite a todos los nodos IMPACT (zona 'all').
     */
    _processPhysicsModifier(modifier, consciousness, bus) {
        // Gate: confianza mínima
        if (modifier.confidence <= 0.5) {
            return;
        }
        // Gate: WAVE 450 Energy Override — la física tiene VETO en drops/clímax
        // Leer energía del debugInfo si está disponible (sin alloc, acceso directo)
        const energy = consciousness.debugInfo?.smoothedEnergy;
        if (energy !== undefined && energy > MAX_ENERGY_FOR_PHYSICS_MOD) {
            return;
        }
        const nodeIds = this._zoneRouter.resolve('all', NodeFamily.IMPACT);
        if (nodeIds.length === 0) {
            return;
        }
        // strobeIntensity → canal strobeRate
        const strobeRate = modifier.strobeIntensity !== undefined
            ? clamp01(modifier.strobeIntensity)
            : 0;
        // flashIntensity → shutter: abierto si > 0.5, cerrado si ≤ 0.5
        const shutter = modifier.flashIntensity !== undefined
            ? (modifier.flashIntensity > 0.5 ? 1.0 : 0.0)
            : 0;
        const scratch = this._strobeScratch;
        const vals = this._strobeValues;
        vals.strobeRate = strobeRate;
        vals.shutter = shutter;
        scratch.confidence = modifier.confidence;
        for (let i = 0; i < nodeIds.length; i++) {
            scratch.nodeId = nodeIds[i];
            bus.push(scratch);
        }
    }
    // ── Helpers de emisión atómica ──────────────────────────────────────────
    /**
     * Emite un intent de dimmer a todos los nodos IMPACT de una zona.
     */
    _emitImpact(zone, dimmer, confidence, bus) {
        const nodeIds = this._zoneRouter.resolve(zone, NodeFamily.IMPACT);
        if (nodeIds.length === 0)
            return;
        const scratch = this._impactScratch;
        const vals = this._impactValues;
        vals.dimmer = dimmer;
        scratch.confidence = confidence;
        for (let i = 0; i < nodeIds.length; i++) {
            scratch.nodeId = nodeIds[i];
            bus.push(scratch);
        }
    }
    /** Limpia keys residuales del color scratch para evitar contaminación cruzada */
    _clearColorScratch() {
        const v = this._colorValues;
        delete v['r'];
        delete v['g'];
        delete v['b'];
        delete v['red'];
        delete v['green'];
        delete v['blue'];
        delete v['white'];
        delete v['amber'];
    }
    /**
     * Emite un intent de color RGB a todos los nodos COLOR de una zona.
     */
    _emitColor(zone, color, confidence, bus) {
        const nodeIds = this._zoneRouter.resolve(zone, NodeFamily.COLOR);
        if (nodeIds.length === 0)
            return;
        if (isHslColor(color)) {
            hslToRgbInto(color.h, color.s, color.l, _rgbBuffer);
            color = _rgbBuffer;
        }
        this._clearColorScratch();
        const scratch = this._colorScratch;
        const vals = this._colorValues;
        const r = color.red ?? color.r ?? 0;
        const g = color.green ?? color.g ?? 0;
        const b = color.blue ?? color.b ?? 0;
        // Compat dual: algunos paths consumen r/g/b y otros red/green/blue.
        vals.r = r;
        vals.g = g;
        vals.b = b;
        vals.red = r;
        vals.green = g;
        vals.blue = b;
        scratch.confidence = confidence;
        for (let i = 0; i < nodeIds.length; i++) {
            scratch.nodeId = nodeIds[i];
            bus.push(scratch);
        }
    }
    /**
     * Emite un intent de white a todos los nodos COLOR de una zona.
     */
    _emitWhite(zone, white, confidence, bus) {
        const nodeIds = this._zoneRouter.resolve(zone, NodeFamily.COLOR);
        if (nodeIds.length === 0)
            return;
        this._clearColorScratch();
        const scratch = this._colorScratch;
        const vals = this._colorValues;
        vals.white = white;
        scratch.confidence = confidence;
        for (let i = 0; i < nodeIds.length; i++) {
            scratch.nodeId = nodeIds[i];
            bus.push(scratch);
        }
    }
    /**
     * Emite un intent de amber a todos los nodos COLOR de una zona.
     */
    _emitAmber(zone, amber, confidence, bus) {
        const nodeIds = this._zoneRouter.resolve(zone, NodeFamily.COLOR);
        if (nodeIds.length === 0)
            return;
        this._clearColorScratch();
        const scratch = this._colorScratch;
        const vals = this._colorValues;
        vals.amber = amber;
        scratch.confidence = confidence;
        for (let i = 0; i < nodeIds.length; i++) {
            scratch.nodeId = nodeIds[i];
            bus.push(scratch);
        }
    }
    /**
     * Emite un intent de strobeRate a todos los nodos IMPACT de una zona.
     * Usado cuando CombinedEffectOutput trae strobeRate > 0 (PASO 3 WAVE 4664).
     */
    _emitStrobe(zone, strobeRate, confidence, bus) {
        const nodeIds = this._zoneRouter.resolve(zone, NodeFamily.IMPACT);
        if (nodeIds.length === 0)
            return;
        const scratch = this._strobeScratch;
        const vals = this._strobeValues;
        vals.strobeRate = strobeRate;
        vals.shutter = 1.0;
        scratch.confidence = confidence;
        for (let i = 0; i < nodeIds.length; i++) {
            scratch.nodeId = nodeIds[i];
            bus.push(scratch);
        }
    }
}
