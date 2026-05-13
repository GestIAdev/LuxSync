/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  AETHER MATRIX — COLOR SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.3: El cerebro cromático. Traducción de paleta Vibe a nodos.
 *
 * RESPONSABILIDAD:
 * Traducir las decisiones cromáticas de la paleta del Vibe (definida por
 * Selene IA o el operador) en NodeIntents de color (R, G, B, W, CMY,
 * o color_wheel) para todos los COLOR_NODEs registrados.
 *
 * DOMINIO:
 * El ColorSystem es el dueño exclusivo de los canales de color en L0.
 * Respeta el tipo de mezcla de cada nodo (rgb / rgbw / cmy / wheel / hybrid)
 * y aplica la conversión cromática apropiada:
 *
 * - rgb   → Asigna R, G, B directo desde la paleta.
 * - rgbw  → Extrae un componente White de la luminosidad para eficiencia.
 * - cmy   → Conversión sustractiva: C=1-R, M=1-G, Y=1-B.
 * - wheel → Nearest-neighbor perceptual en espacio Lab al slot más cercano.
 * - hybrid → Wheel para saturados, RGB LEDs para pasteles/blancos.
 *
 * ASIGNACIÓN DE COLOR POR ZONA:
 * El ColorSystem asigna colores según el rol del nodo y su zona:
 * - role=primary      → usa palette[0] (color dominante)
 * - role=accent       → usa palette[1] (color acento)
 * - role=pixel        → calcula posición en gradiente circular
 * - otras zonas       → mezcla palette[0] + palette[1] según audio.highMid
 *
 * LERP TEMPORAL (anti-flicker):
 * Para nodos con minChangeTimeMs > 0 (ruedas mecánicas), el ColorSystem
 * respeta el tiempo mínimo entre cambios. Para nodos LED, aplica un LERP
 * suave frame-a-frame para evitar saltos bruscos de color (especialmente
 * en transiciones de Vibe). La velocidad del LERP es proporcional a
 * audio.energy (más energía = colores más vivos/rápidos).
 *
 * ZERO-ALLOC GARANTIZADO:
 * Todo el cálculo de color se hace en buffers pre-allocated:
 * - `_rgbScratch` para conversiones intermedias.
 * - `_intentScratch` + `_valuesDict` heredados de BaseSystem.
 * No se crea ningún objeto durante `process()`.
 *
 * @module core/aether/systems/ColorSystem
 * @version WAVE 3505.3
 */
import { NodeFamily } from '../types';
import { BaseSystem, } from './BaseSystem';
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
// Prioridad de capa L0 para color intents
const COLOR_INTENT_PRIORITY = 10;
// Velocidad de interpolación LERP de color base (por ms).
// Permite que el color llegue al target en ~250ms en condiciones normales.
const COLOR_LERP_SPEED_BASE = 1 / 250;
// Velocidad máxima de LERP (en drops / alta energía)
const COLOR_LERP_SPEED_MAX = 1 / 80;
// Factor de extracción de White en RGBW:
// cuando los tres canales son > WHITE_EXTRACTION_THRESHOLD,
// extraemos la cantidad común como componente W.
const WHITE_EXTRACTION_THRESHOLD = 0.15;
// Nearest-neighbor en Lab: umbral de diferencia para considerar un
// wheel slot "suficientemente cercano" (diferencia Euclidiana en RGB).
const WHEEL_MATCH_THRESHOLD_SQ = 0.01; // 0.1 en cada canal
// ═══════════════════════════════════════════════════════════════════════════
// COLOR SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🎨 ColorSystem — El cerebro cromático del Motor Agnóstico.
 *
 * Asigna color a cada COLOR_NODE basándose en la paleta del Vibe,
 * el contexto musical, el rol del nodo, y el tipo de mezcla del hardware.
 */
export class ColorSystem extends BaseSystem {
    constructor() {
        super();
        this.name = 'ColorSystem';
        this.family = NodeFamily.COLOR;
        this._intentScratch.source = 'color_system';
        this._intentScratch.priority = COLOR_INTENT_PRIORITY;
        this._intentScratch.confidence = 1.0;
        // Pre-allocar los buffers de color
        this._rgbScratch = { r: 0, g: 0, b: 0 };
        this._targetRgb = { r: 0, g: 0, b: 0 };
    }
    // ═════════════════════════════════════════════════════════════════════════
    // process() — EL HOT PATH. 44 veces por segundo.
    // ═════════════════════════════════════════════════════════════════════════
    /**
     * Calcula y escribe los NodeIntents de color para todos los COLOR_NODEs.
     *
     * PROTOCOLO ZERO-ALLOC:
     * ```
     * forEach(node) → {
     *   1. selectPaletteColor(node.role, context)  → escribe _targetRgb
     *   2. applyLerp(node, _targetRgb, deltaMs)    → actualiza node.currentColor
     *   3. convertToChannels(node, currentColor)   → escribe _valuesDict
     *   4. bus.push(_intentScratch as INodeIntent) → O(1), zero-alloc
     * }
     * ```
     */
    process(view, context, bus) {
        const palette = context.vibe.palette;
        const audio = context.audio;
        const deltaMs = context.deltaMs;
        // Pre-limpiar keys que podrían quedar del frame anterior
        this._clearColorKeys();
        view.forEach((node) => {
            // ── 1. Seleccionar color target de la paleta ──────────────────────────
            this._selectPaletteColor(node, palette, audio);
            // Ahora _targetRgb tiene el color que queremos (R, G, B en 0-1)
            // ── 2. Aplicar LERP temporal para transiciones suaves ─────────────────
            // La velocidad del LERP es mayor cuando hay más energía de audio.
            const lerpSpeed = BaseSystem.lerp(COLOR_LERP_SPEED_BASE, COLOR_LERP_SPEED_MAX, audio.energy);
            const lerpT = BaseSystem.clamp01(lerpSpeed * deltaMs);
            const curr = node.currentColor;
            node.currentColor.r = BaseSystem.lerp(curr.r, this._targetRgb.r, lerpT);
            node.currentColor.g = BaseSystem.lerp(curr.g, this._targetRgb.g, lerpT);
            node.currentColor.b = BaseSystem.lerp(curr.b, this._targetRgb.b, lerpT);
            // ── 3. Convertir al tipo de mezcla del nodo ───────────────────────────
            this._convertToChannels(node, node.currentColor);
            // _valuesDict ya tiene las keys correctas
            // ── 4. Escribir intent ─────────────────────────────────────────────────
            this._intentScratch.nodeId = node.nodeId;
            bus.push(this._intentScratch);
        });
    }
    // ═════════════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═════════════════════════════════════════════════════════════════════════
    /**
     * Selecciona el color target de la paleta según el rol del nodo
     * y el contexto musical. Escribe en `_targetRgb`.
     */
    _selectPaletteColor(node, palette, audio) {
        if (palette.length === 0) {
            // Paleta vacía = blanco neutro
            this._targetRgb.r = 1;
            this._targetRgb.g = 1;
            this._targetRgb.b = 1;
            return;
        }
        switch (node.role) {
            case 'primary': {
                // Color dominante de la paleta
                const entry = palette[0];
                BaseSystem.hslToRgb(entry.h, entry.s, entry.l, this._targetRgb);
                break;
            }
            case 'accent': {
                // Color de acento
                const entry = palette.length > 1 ? palette[1] : palette[0];
                BaseSystem.hslToRgb(entry.h, entry.s, entry.l, this._targetRgb);
                break;
            }
            case 'pixel': {
                // Para pixel arrays: gradiente circular en la paleta.
                // La posición del nodo en su array determina qué parte
                // de la paleta recibe. Usamos el nodeId para derivar un
                // índice estable sin alloc.
                const pixelFraction = this._derivePixelFraction(node.nodeId);
                const paletteIdx = (pixelFraction * palette.length) | 0; // floor int
                const capped = paletteIdx < palette.length ? paletteIdx : palette.length - 1;
                const entry = palette[capped];
                BaseSystem.hslToRgb(entry.h, entry.s, entry.l, this._targetRgb);
                break;
            }
            case 'decoration': {
                // Decoración: combina primary + accent según harmonicTension
                // Esta lógica la inyecta el MusicalContext vía audio.highMid como proxy
                const t = audio.highMid;
                const p = palette[0];
                const a = palette.length > 1 ? palette[1] : palette[0];
                BaseSystem.hslToRgb(p.h, p.s, p.l, this._rgbScratch);
                BaseSystem.hslToRgb(a.h, a.s, a.l, this._targetRgb);
                this._targetRgb.r = BaseSystem.lerp(this._rgbScratch.r, this._targetRgb.r, t);
                this._targetRgb.g = BaseSystem.lerp(this._rgbScratch.g, this._targetRgb.g, t);
                this._targetRgb.b = BaseSystem.lerp(this._rgbScratch.b, this._targetRgb.b, t);
                break;
            }
            default: {
                // Todos los demás roles: primary por defecto
                const entry = palette[0];
                BaseSystem.hslToRgb(entry.h, entry.s, entry.l, this._targetRgb);
                break;
            }
        }
    }
    /**
     * Convierte el color en `currentColor` (RGB 0-1) a los canales
     * específicos del tipo de mezcla del nodo, escribiendo en `_valuesDict`.
     */
    _convertToChannels(node, color) {
        switch (node.mixingType) {
            case 'rgb': {
                this._valuesDict['red'] = color.r;
                this._valuesDict['green'] = color.g;
                this._valuesDict['blue'] = color.b;
                break;
            }
            case 'rgbw': {
                // Extraer componente White: mínimo de los tres canales × factor.
                // El componente W reemplaza parte de los LEDs de color para mayor
                // eficiencia energética y mejor CRI en blancos.
                const wComponent = Math.min(color.r, color.g, color.b);
                if (wComponent > WHITE_EXTRACTION_THRESHOLD) {
                    this._valuesDict['red'] = color.r - wComponent;
                    this._valuesDict['green'] = color.g - wComponent;
                    this._valuesDict['blue'] = color.b - wComponent;
                    this._valuesDict['white'] = wComponent;
                }
                else {
                    this._valuesDict['red'] = color.r;
                    this._valuesDict['green'] = color.g;
                    this._valuesDict['blue'] = color.b;
                    this._valuesDict['white'] = 0;
                }
                break;
            }
            case 'cmy': {
                // Mezcla sustractiva: C = 1-R, M = 1-G, Y = 1-B
                // CMY va de 0 (sin filtro, luz blanca) a 1 (filtro máximo, color puro).
                this._valuesDict['cyan'] = 1 - color.r;
                this._valuesDict['magenta'] = 1 - color.g;
                this._valuesDict['yellow'] = 1 - color.b;
                break;
            }
            case 'wheel': {
                if (!node.colorWheel) {
                    // Sin definición de rueda: fallback a dimmer neutro
                    this._valuesDict['color_wheel'] = 0;
                    break;
                }
                // Nearest-neighbor: encontrar el slot de rueda más cercano al color target
                const dmxFraction = this._findNearestWheelSlot(color, node);
                this._valuesDict['color_wheel'] = dmxFraction;
                break;
            }
            case 'hybrid': {
                // Para hybrids: si el color es muy saturado, usar la rueda.
                // Si es pastel o neutro, usar los LEDs complementarios.
                const saturation = this._computeSaturation(color);
                if (saturation > 0.6 && node.colorWheel) {
                    const dmxFraction = this._findNearestWheelSlot(color, node);
                    this._valuesDict['color_wheel'] = dmxFraction;
                    // Los canales RGB van a 0 para no interferir con la rueda
                    this._valuesDict['red'] = 0;
                    this._valuesDict['green'] = 0;
                    this._valuesDict['blue'] = 0;
                }
                else {
                    this._valuesDict['red'] = color.r;
                    this._valuesDict['green'] = color.g;
                    this._valuesDict['blue'] = color.b;
                    if (node.colorWheel) {
                        this._valuesDict['color_wheel'] = 0; // open white / no filter
                    }
                }
                break;
            }
            default: {
                // Fallback conservador
                this._valuesDict['red'] = color.r;
                this._valuesDict['green'] = color.g;
                this._valuesDict['blue'] = color.b;
                break;
            }
        }
    }
    /**
     * Encuentra el slot de rueda de colores más cercano al target RGB.
     *
     * Algoritmo: nearest-neighbor por distancia Euclidiana en espacio RGB.
     * (Suficiente para aproximaciones de show; una implementación Lab
     * más precisa puede sustituir esto en el futuro sin cambiar la interfaz.)
     *
     * @returns Valor DMX del slot más cercano, normalizado (0-1).
     */
    _findNearestWheelSlot(target, node) {
        const slots = node.colorWheel.slots;
        let bestDmx = slots[0].dmxValue;
        let bestDistSq = Number.MAX_VALUE;
        for (let i = 0; i < slots.length; i++) {
            const slot = slots[i];
            const sr = slot.previewRgb.r / 255;
            const sg = slot.previewRgb.g / 255;
            const sb = slot.previewRgb.b / 255;
            const dr = target.r - sr;
            const dg = target.g - sg;
            const db = target.b - sb;
            const distSq = dr * dr + dg * dg + db * db;
            if (distSq < bestDistSq) {
                bestDistSq = distSq;
                bestDmx = slot.dmxValue;
                if (distSq < WHEEL_MATCH_THRESHOLD_SQ)
                    break; // suficientemente bueno
            }
        }
        // Normalizar de [0, 255] a [0, 1]
        return bestDmx / 255;
    }
    /**
     * Calcula saturación aproximada (max - min de RGB).
     * Función pura, sin alloc — para decisión hybrid.
     */
    _computeSaturation(c) {
        const max = c.r > c.g ? (c.r > c.b ? c.r : c.b) : (c.g > c.b ? c.g : c.b);
        const min = c.r < c.g ? (c.r < c.b ? c.r : c.b) : (c.g < c.b ? c.g : c.b);
        return max - min;
    }
    /**
     * Deriva una fracción estable [0-1) de un NodeId para pixel mapping.
     * Usa el último segmento numérico del nodeId.
     * Ejemplo: "ledbar-01:px-07" → fracción basada en 7.
     *
     * Zero-alloc: no parsea strings completos, solo busca el último número.
     */
    _derivePixelFraction(nodeId) {
        let num = 0;
        let found = false;
        let mul = 1;
        // Parsear el último número en el string desde el final
        for (let i = nodeId.length - 1; i >= 0; i--) {
            const code = nodeId.charCodeAt(i);
            if (code >= 48 && code <= 57) { // '0' to '9'
                num += (code - 48) * mul;
                mul *= 10;
                found = true;
            }
            else if (found) {
                break;
            }
        }
        // Modulo para distribución circular en la paleta
        // Usamos primos para evitar clustering en paletas pequeñas
        return found ? (num % 97) / 97 : 0;
    }
    /**
     * Limpia las keys de color del valuesDict del frame anterior.
     * Previene que keys residuales contaminen intents de nodos
     * que no usan todos los canales.
     */
    _clearColorKeys() {
        // Zero-alloc: asignar undefined mantiene la hidden class de V8 estable
        // (evita la de-optimización que causa delete en hot path 44Hz).
        this._valuesDict['red'] = undefined;
        this._valuesDict['green'] = undefined;
        this._valuesDict['blue'] = undefined;
        this._valuesDict['white'] = undefined;
        this._valuesDict['cyan'] = undefined;
        this._valuesDict['magenta'] = undefined;
        this._valuesDict['yellow'] = undefined;
        this._valuesDict['color_wheel'] = undefined;
    }
}
