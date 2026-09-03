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
 *   ✅ WAVE 7172: AHORA EMITE pan_offset/tilt_offset (offsets relativos) hacia KINETIC nodes
 *   ❌ NUNCA emite targetX/Y/Z, pan, tilt absolutos (eso es exclusivo de Hephaestus L3+)
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
// 🌊 WAVE 4832: Traducción blendMode (per-zone) → mergeStrategy (per-intent).
// 'max'     → 'HTP'  (efecto blando que tinta sin matar el brillo de L0)
// 'replace' → 'LTP'  (efecto tirano que domina la capa)
// undefined → 'LTP'  (default seguro retrocompatible)
function blendModeToMergeStrategy(blendMode) {
    return blendMode === 'max' ? 'HTP' : 'LTP';
}
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
            mergeStrategy: 'LTP',
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
            mergeStrategy: 'LTP',
        };
        /** Scratch para canales STROBE (strobe, strobeRate, shutter) */
        // ⚒️ WAVE 7749.35: DUAL-ALIAS — los perfiles de fixture declaran chDef.type
        // indistintamente como 'strobe' o 'strobeRate'. Escribir AMBOS aliases
        // garantiza que el NodeResolver encuentre el canal sin importar cómo se
        // declare en el perfil. Sin esto, los fixtures clásicos con chDef.type='strobe'
        // pierden el valor y el strobe llega a 0 (o solo a mitad por L0 physics).
        // Espejo del WAVE 4853 FIX-D del HephaestusAetherAdapter.
        this._strobeValues = { strobe: 0, strobeRate: 0, shutter: 0 };
        this._strobeScratch = {
            nodeId: '',
            values: null,
            priority: L3_PRIORITY,
            confidence: 1.0,
            source: L3_SOURCE,
            mergeStrategy: 'LTP',
        };
        // WAVE 7172: Scratch para canales KINETIC (pan_offset, tilt_offset)
        this._kineticValues = { pan_offset: 0, tilt_offset: 0 };
        this._kineticScratch = {
            nodeId: '',
            values: null,
            priority: L3_PRIORITY,
            confidence: 1.0,
            source: L3_SOURCE,
            mergeStrategy: 'LTP',
        };
        this._zoneRouter = zoneRouter;
        // Cablear values al scratch — un único wiring en construcción
        this._impactScratch.values = this._impactValues;
        this._colorScratch.values = this._colorValues;
        this._strobeScratch.values = this._strobeValues;
        this._kineticScratch.values = this._kineticValues;
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
        // ── Fase 1: Overrides globales (zona 'all') ──────────────────────────────────────
        this._processGlobalOverrides(effectOutput, composition, bus);
        // ── Fase 2: Zone overrides (zonas específicas) ────────────────────────
        if (effectOutput.zoneOverrides) {
            this._processZoneOverrides(effectOutput.zoneOverrides, composition, bus);
        }
        // ── Fase 1.5: WAVE 7172 — Movement override global (pan_offset/tilt_offset) ──
        if (effectOutput.movementOverride) {
            this._emitMovementGlobal(effectOutput.movementOverride, composition, bus);
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
        // 🌊 WAVE 4832: Los overrides globales son tiranos por construcción
        // (provienen de efectos con mixBus='global' tipo OroSolido/StrobeStorm).
        // Siempre 'LTP' → dominación L3 absoluta sobre L0/L1.
        const globalMerge = 'LTP';
        // dimmerOverride → IMPACT nodes zona 'all'
        if (output.dimmerOverride !== undefined) {
            this._emitImpact('all', clamp01(output.dimmerOverride), composition, bus, globalMerge);
        }
        // colorOverride HSL/RGB → COLOR nodes zona 'all'
        if (output.colorOverride) {
            this._emitColor('all', output.colorOverride, composition, bus);
            this._emitOmniZoneColors(output.colorOverride, composition, bus);
        }
        // whiteOverride → COLOR nodes zona 'all' (canal 'white')
        if (output.whiteOverride !== undefined) {
            this._emitWhite('all', clamp01(output.whiteOverride), composition, bus, globalMerge);
        }
        // amberOverride → COLOR nodes zona 'all' (canal 'amber')
        if (output.amberOverride !== undefined) {
            this._emitAmber('all', clamp01(output.amberOverride), composition, bus, globalMerge);
        }
        // strobeRate → IMPACT nodes zona 'all' (canal 'strobeRate' para fixtures con shutter)
        if (output.strobeRate !== undefined && output.strobeRate > 0) {
            this._emitStrobe('all', clamp01(output.strobeRate), composition, bus);
        }
    }
    /**
     * WAVE 4684: Inyección nativa de color para zonas ambientales.
     * WAVE 4812: Eliminadas derivaciones de matiz (—_deriveAmbientColor, _deriveAirColor).
     * Se envía el color base directamente — la paleta Selene ya tiene 4 roles puros
     * (primary/secondary/accent/ambient) que el ColorAdapter mapea según la zona.
     * No se necesitan transformaciones locales de hue/sat/lightness aquí.
     */
    _emitOmniZoneColors(base, composition, bus) {
        this._emitColor('ambient', base, composition, bus);
        this._emitColor('air', base, composition, bus);
    }
    /**
     * Emite los overrides específicos por zona.
     *
     * Itera el mapa zoneOverrides y traduce cada zona a sus NodeIds.
     * WAVE 7172: Ahora procesa el campo `movement` como pan_offset/tilt_offset.
     */
    _processZoneOverrides(zoneOverrides, composition, bus) {
        for (const zoneId in zoneOverrides) {
            const override = zoneOverrides[zoneId];
            const zone = zoneId;
            // 🌊 WAVE 4832: El blendMode declarado por el efecto se traduce
            // a mergeStrategy. SOLO afecta a canales de luminancia (dimmer/white/amber):
            //   'max'     → 'HTP'  (CumbiaMoon/CorazonLatino: tintan sin matar L0)
            //   'replace' → 'LTP'  (OroSolido/StrobeStorm: dominan la capa)
            // El canal de color (r/g/b) siempre se emite con 'LTP': mezclar HSL por
            // máximo de componente RGB rompe la identidad cromática del efecto.
            const luminanceMerge = blendModeToMergeStrategy(override.blendMode);
            // dimmer → IMPACT nodes de esta zona
            if (override.dimmer !== undefined) {
                this._emitImpact(zone, clamp01(override.dimmer), composition, bus, luminanceMerge);
            }
            // color HSL/RGB → COLOR nodes de esta zona (LTP forzado: ver nota arriba)
            if (override.color) {
                this._emitColor(zone, override.color, composition, bus);
            }
            // white → COLOR nodes de esta zona
            if (override.white !== undefined) {
                this._emitWhite(zone, clamp01(override.white), composition, bus, luminanceMerge);
            }
            // amber → COLOR nodes de esta zona
            if (override.amber !== undefined) {
                this._emitAmber(zone, clamp01(override.amber), composition, bus, luminanceMerge);
            }
            // strobeRate → IMPACT nodes de esta zona
            if (override.strobeRate !== undefined && override.strobeRate > 0) {
                this._emitStrobe(zone, clamp01(override.strobeRate), composition, bus);
            }
            // WAVE 7172: movement → KINETIC nodes de esta zona como pan_offset/tilt_offset
            if (override.movement) {
                this._emitMovement(zone, override.movement, composition, bus);
            }
        }
    }
    /**
     * WAVE 7172: Emite intents de movimiento (pan_offset/tilt_offset) a todos los
     * nodos KINETIC de una zona. Los valores del efecto están en [-1,+1] y se
     * emiten directamente como offsets relativos — el NodeArbiter los sumará al
     * pan_base/tilt_base vía _applyRelativeOffsetFusion.
     *
     * Si isAbsolute=true, el offset se convierte a posición absoluta [0,1] usando
     * (v + 1) / 2 y se emite como pan/tilt directo en lugar de offset.
     */
    _emitMovement(zone, movement, confidence, bus) {
        const nodeIds = this._zoneRouter.resolve(zone, NodeFamily.KINETIC);
        if (nodeIds.length === 0)
            return;
        const scratch = this._kineticScratch;
        const vals = this._kineticValues;
        // Limpiar valores residuales del frame anterior
        delete vals['pan'];
        delete vals['tilt'];
        vals['pan_offset'] = 0;
        vals['tilt_offset'] = 0;
        const isAbsolute = movement.isAbsolute === true;
        if (movement.pan !== undefined) {
            if (isAbsolute) {
                delete vals['pan_offset'];
                vals['pan'] = clamp01((movement.pan + 1) / 2);
            }
            else {
                vals['pan_offset'] = movement.pan;
            }
        }
        else {
            delete vals['pan_offset'];
            delete vals['pan'];
        }
        if (movement.tilt !== undefined) {
            if (isAbsolute) {
                delete vals['tilt_offset'];
                vals['tilt'] = clamp01((movement.tilt + 1) / 2);
            }
            else {
                vals['tilt_offset'] = movement.tilt;
            }
        }
        else {
            delete vals['tilt_offset'];
            delete vals['tilt'];
        }
        if (movement.speed !== undefined) {
            vals['speed'] = clamp01(movement.speed);
        }
        else {
            delete vals['speed'];
        }
        scratch.confidence = confidence;
        scratch.mergeStrategy = 'LTP';
        for (let i = 0; i < nodeIds.length; i++) {
            scratch.nodeId = nodeIds[i];
            bus.push(scratch);
        }
    }
    /**
     * WAVE 7172: Emite movement override global (zona 'all') a todos los nodos KINETIC.
     */
    _emitMovementGlobal(movement, confidence, bus) {
        this._emitMovement('all', movement, confidence, bus);
    }
    /**
     * WAVE 7749.46: NEUTRALIZED — el physicsModifier de Selene competía con las
     * curvas .lfx del HephaestusRuntime, pisando el strobe con valores de
     * "contención" (0.3-0.6) heredados del DROP path. Ahora el strobe viene
     * EXCLUSIVAMENTE de la curva .lfx — si el clip dice strobe=1, se dispara a 1.
     * No hay modificadores externos ni de seguridad que toquen el canal.
     */
    _processPhysicsModifier(_modifier, _consciousness, _bus) {
        // Intentionally empty — strobe is owned by the .lfx curve, not Selene.
    }
    // ── Helpers de emisión atómica ──────────────────────────────────────────
    /**
     * Emite un intent de dimmer a todos los nodos IMPACT de una zona.
     */
    _emitImpact(zone, dimmer, confidence, bus, mergeStrategy = 'LTP') {
        const nodeIds = this._zoneRouter.resolve(zone, NodeFamily.IMPACT);
        if (nodeIds.length === 0)
            return;
        const scratch = this._impactScratch;
        const vals = this._impactValues;
        vals.dimmer = dimmer;
        scratch.confidence = confidence;
        scratch.mergeStrategy = mergeStrategy;
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
        if (nodeIds.length === 0) {
            // 🔬 WAVE-4913 DIAG: silenciosa emisión a zona no resuelta
            console.log(`[SeleneAetherAdapter 🔬 NO-NODOS] zone='${zone}' → 0 COLOR nodes`);
            return;
        }
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
        // 🌊 WAVE 4832: el color SIEMPRE se emite como LTP. Mezclar componentes
        // RGB por máximo rompe la identidad cromática (rojo + plata = magenta sucio).
        scratch.mergeStrategy = 'LTP';
        // 🔬 WAVE-4913 DIAG: log cuando emitimos color L3 a una zona
        if (nodeIds.length > 0) {
            console.log(`[SeleneAetherAdapter 🎨 L3-COLOR-EMIT] zone='${zone}' nodeCount=${nodeIds.length} ` +
                `r=${r.toFixed(3)} g=${g.toFixed(3)} b=${b.toFixed(3)} conf=${confidence.toFixed(2)}`);
        }
        for (let i = 0; i < nodeIds.length; i++) {
            scratch.nodeId = nodeIds[i];
            bus.push(scratch);
        }
    }
    /**
     * Emite un intent de white a todos los nodos COLOR de una zona.
     */
    _emitWhite(zone, white, confidence, bus, mergeStrategy = 'LTP') {
        const nodeIds = this._zoneRouter.resolve(zone, NodeFamily.COLOR);
        if (nodeIds.length === 0)
            return;
        this._clearColorScratch();
        const scratch = this._colorScratch;
        const vals = this._colorValues;
        vals.white = white;
        scratch.confidence = confidence;
        scratch.mergeStrategy = mergeStrategy;
        for (let i = 0; i < nodeIds.length; i++) {
            scratch.nodeId = nodeIds[i];
            bus.push(scratch);
        }
    }
    /**
     * Emite un intent de amber a todos los nodos COLOR de una zona.
     */
    _emitAmber(zone, amber, confidence, bus, mergeStrategy = 'LTP') {
        const nodeIds = this._zoneRouter.resolve(zone, NodeFamily.COLOR);
        if (nodeIds.length === 0)
            return;
        this._clearColorScratch();
        const scratch = this._colorScratch;
        const vals = this._colorValues;
        vals.amber = amber;
        scratch.confidence = confidence;
        scratch.mergeStrategy = mergeStrategy;
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
        // ⚒️ WAVE 7749.35: DUAL-ALIAS — escribir AMBOS 'strobe' y 'strobeRate'
        // para que el NodeResolver encuentre el canal sin importar si el perfil
        // declara chDef.type='strobe' o 'strobeRate'. Sin el alias 'strobe',
        // los fixtures clásicos (Pars, 7R) no reciben el valor y el strobe
        // solo llega a mitad intensidad (por L0 physics que sí escribe ambos).
        vals.strobe = strobeRate;
        vals.strobeRate = strobeRate;
        vals.shutter = 1.0;
        scratch.confidence = confidence;
        // Strobe es siempre LTP estricto (canal STRICT_PRIORITY en el Arbiter).
        scratch.mergeStrategy = 'LTP';
        for (let i = 0; i < nodeIds.length; i++) {
            scratch.nodeId = nodeIds[i];
            bus.push(scratch);
        }
    }
}
