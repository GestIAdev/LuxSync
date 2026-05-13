/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 AETHER MATRIX — COLOR ADAPTER (Capa L1)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4522.3: THE COLOR-AETHER BRIDGE (Fase A)
 * WAVE 4775: Restricción espacial del Mood — PAR-only color.
 *
 * RESPONSABILIDAD (SINGLE):
 * Consumir la paleta RGB de SeleneLuxOutput (fuente musical canónica) y
 * traducirla en NodeIntents r, g, b normalizados (0-1) para nodos COLOR
 * en la Capa L1 (priority = 10) del IIntentBus.
 *
 * CONTRATO L1:
 *   - Solo emite canales r, g, b. NUNCA dimmer, brightness, shutter ni CMY.
 *   - Fuente de color: IColorIngress.paletteRgb (RGB 0-255 de SeleneLux).
 *   - Mapeo zona → rol: selectColorRoleFromZone() (via zoneUtils).
 *   - Normalización: r255 / 255, clampeado a [0, 1].
 *
 * RESTRICCIÓN ESPACIAL DEL MOOD (WAVE 4775):
 *   Las variaciones de color dictadas por el Mood (paleta musical rápida)
 *   SOLO se ruteaban a fixtures PAR (front, back, floor, ambient).
 *   Los movers (fixtures con nodo KINETIC) mantienen el color base
 *   constitucional o los overrides explícitos de L3 (Drops), aislándolos
 *   del caos emocional rápido de L0.
 *   API: setMoverNodeIds(nodeIds) — llamar en patch time desde TitanOrchestrator.
 *
 * INVARIANTES DE DISEÑO:
 *   - Zero allocations en hot path (todas las estructuras pre-allocated).
 *   - Sin traducción a CMY, colorWheel ni hardware — eso es NodeResolver.
 *   - Sin dependencia del LiquidEngine — ese es L0 (LiquidAetherAdapter).
 *   - Sin Math.random() ni heurísticas — determinista por frame.
 *
 * INTERACCIÓN CON L0:
 *   L0 (LiquidAetherAdapter) emite 'brightness' como modulación energética.
 *   L1 (este adapter) emite r, g, b como paleta musical.
 *   NodeArbiter los combina: brightness vía LTP × nodo, r/g/b vía LTP L1.
 *
 * @module core/aether/adapters/ColorAdapter
 * @version WAVE 4775
 */
import { NodeFamily } from '../types';
import { BaseSystem } from '../systems';
import { selectColorRoleFromZone, normalizeZoneId } from './zoneUtils';
// ─────────────────────────────────────────────────────────────────────────────
// HUE SHIFT — WAVE 4701 M3
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Rota el matiz de un color RGB por `hueDeg` grados (0-360).
 * Si la saturación resultante cae por debajo del umbral, se fuerza al máximo
 * para evitar colores sucios/marrones (regla de oro).
 *
 * Zero-alloc: escribe el resultado en `out` en lugar de retornar un nuevo objeto.
 * Llamar con un buffer pre-allocated para garantizar cero asignaciones en hot path.
 */
function hueShiftRgb(r, g, b, hueDeg, out, minSaturation = 0.6) {
    // RGB [0,1] → HSL
    const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
    const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r)
            h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g)
            h = ((b - r) / d + 2) / 6;
        else
            h = ((r - g) / d + 4) / 6;
    }
    // Aplicar rotación de matiz
    h = (h + hueDeg / 360) % 1;
    if (h < 0)
        h += 1;
    // Forzar saturación mínima si el color es sucio
    if (s < minSaturation && (max - min) > 0.05)
        s = 1.0;
    // HSL → RGB — escribir directamente en out (zero-alloc)
    if (s === 0) {
        out.r = l;
        out.g = l;
        out.b = l;
        return;
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (t) => {
        if (t < 0)
            t += 1;
        if (t > 1)
            t -= 1;
        if (t < 1 / 6)
            return p + (q - p) * 6 * t;
        if (t < 1 / 2)
            return q;
        if (t < 2 / 3)
            return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    out.r = hue2rgb(h + 1 / 3);
    out.g = hue2rgb(h);
    out.b = hue2rgb(h - 1 / 3);
}
/** Desplazamiento de matiz (grados) aplicado a nodos COLOR en zona 'air'. */
const AIR_ZONE_HUE_OFFSET_DEG = 60;
// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
/** Capa L1 — tinte cromático musical. Domina sobre L0 en r/g/b. */
const INTENT_PRIORITY = 10;
const COLOR_SOURCE = 'color-adapter-l1';
/**
 * Paleta de fallback (negro seguro) usada hasta que el orquestador
 * llame a setIngress() por primera vez (arranque en frío, extremadamente raro).
 */
const _FALLBACK_PALETTE = {
    primary: { r: 0, g: 0, b: 0 },
    secondary: { r: 0, g: 0, b: 0 },
    accent: { r: 0, g: 0, b: 0 },
    ambient: { r: 0, g: 0, b: 0 },
};
// ─────────────────────────────────────────────────────────────────────────────
// COLOR ADAPTER
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Adapter L1 para nodos COLOR (wash LED, PARs tintados).
 *
 * En cada frame recibe la paleta RGB de SeleneLux via `setIngress()` antes
 * de llamar a `process()`. Clasifica cada nodo COLOR en un rol
 * (primary/secondary/accent/ambient) según su zona espacial. El color RGB
 * del rol correspondiente se normaliza y se emite como intent al IIntentBus.
 *
 * WAVE 4522.3: Reescrito desde sistema basado en LiquidEngine + paleta HSL
 * hacia ingesta directa de SeleneLuxOutput.palette (RGB 0-255).
 *
 * PATRÓN DE INGESTA:
 *   Antes de process(), el orquestador llama:
 *     colorAdapter.setIngress(engine.getLastColorPalette())
 *   Esto mantiene el contrato IAetherSystem sin modificar la firma base.
 */
export class ColorAdapter extends BaseSystem {
    constructor() {
        super();
        this.name = 'ColorAdapter';
        this.family = NodeFamily.COLOR;
        this.source = COLOR_SOURCE;
        // Paleta activa del frame actual — actualizada via setIngress() antes de process()
        this._ingress = _FALLBACK_PALETTE;
        // Buffer pre-allocated para hueShiftRgb — zero-alloc en hot path
        this._hueShiftOut = { r: 0, g: 0, b: 0 };
        /**
         * WAVE 4775: Set de nodeIds que pertenecen a movers (fixtures con KINETIC).
         * Calculado en patch time via setMoverNodeIds(); costo 0 en hot path.
         * Si un nodeId COLOR está aquí, el adapter L0 NO emite color Mood para él.
         * Los movers reciben color solo desde L3 (Effects/Drops) o paleta constitucional.
         */
        this._moverColorNodeIds = new Set();
        // Pre-allocar los canales cromáticos en el scratch — zero-alloc hot path
        this._valuesDict['r'] = 0;
        this._valuesDict['g'] = 0;
        this._valuesDict['b'] = 0;
    }
    /**
     * Actualiza la paleta cromática para el próximo frame.
     * Llamar antes de process() en el hot path del orquestador.
     *
     * @param palette - Paleta RGB 0-255 de SeleneLuxOutput
     */
    setIngress(palette) {
        this._ingress = palette;
    }
    /**
     * WAVE 4775: Registra los nodeIds COLOR que pertenecen a movers.
     * Llamar en patch time (registerAetherDevice) desde TitanOrchestrator.
     * Costo en hot path: O(1) Set.has() por nodo.
     *
     * @param nodeIds - Array de nodeIds COLOR de movers (ej: 'fix-mh-01:color')
     */
    setMoverNodeIds(nodeIds) {
        this._moverColorNodeIds.clear();
        for (let i = 0; i < nodeIds.length; i++) {
            this._moverColorNodeIds.add(nodeIds[i]);
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // HOT-PATH — 44Hz / 60Hz
    // ─────────────────────────────────────────────────────────────────────────
    process(nodes, _context, bus) {
        const ingress = this._ingress;
        // ── 1. Preparar invariantes del scratch para este frame
        this._intentScratch.priority = INTENT_PRIORITY;
        this._intentScratch.source = COLOR_SOURCE;
        // ── 2. Iterar nodos COLOR — determinar rol, normalizar, empujar intent
        nodes.forEach((node, _index) => {
            // WAVE 4775: RESTRICCIÓN ESPACIAL DEL MOOD.
            // Los movers NO reciben color del Mood (paleta musical rápida L0).
            // Su color proviene exclusivamente de L3 (Effects/Drops) o paleta constitucional.
            // Esto aísla a los movers del caos emocional de L0 en cada beat.
            if (this._moverColorNodeIds.size > 0 && this._moverColorNodeIds.has(node.nodeId)) {
                return;
            }
            const role = selectColorRoleFromZone(node.zoneId ?? '');
            const rgb = ingress[role];
            // Normalización RGB 0-255 → 0.0-1.0, clampeada
            let rNorm = rgb.r < 0 ? 0 : rgb.r > 255 ? 1 : rgb.r / 255;
            let gNorm = rgb.g < 0 ? 0 : rgb.g > 255 ? 1 : rgb.g / 255;
            let bNorm = rgb.b < 0 ? 0 : rgb.b > 255 ? 1 : rgb.b / 255;
            // 🌊 WAVE 4701 M3: Desplazamiento cromático para zona 'air' (beam Tungsten).
            // 60° de rotación de matiz sobre el color ambient de Selene.
            // Saturación mínima 60% para evitar colores marrones/sucios.
            if (normalizeZoneId(node.zoneId ?? '') === 'air') {
                hueShiftRgb(rNorm, gNorm, bNorm, AIR_ZONE_HUE_OFFSET_DEG, this._hueShiftOut, 0.6);
                rNorm = this._hueShiftOut.r;
                gNorm = this._hueShiftOut.g;
                bNorm = this._hueShiftOut.b;
            }
            // Limpiar stale values de frames anteriores antes de asignar
            // (previene ghost channels si el adaptador cambia de familia de canales)
            this._valuesDict['r'] = undefined;
            this._valuesDict['g'] = undefined;
            this._valuesDict['b'] = undefined;
            this._valuesDict['r'] = rNorm;
            this._valuesDict['g'] = gNorm;
            this._valuesDict['b'] = bNorm;
            this._intentScratch.nodeId = node.nodeId;
            this._intentScratch.confidence = 1.0;
            bus.push(this._intentScratch);
        });
    }
}
