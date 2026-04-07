/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 WAVE 2096.1: COLOR TRANSLATOR — THE CHROMATIC RESURRECTION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Traduce intenciones artísticas (RGB) a realidades físicas (DMX).
 *
 * WAVE 1000: Original implementation (weighted RGB distance)
 * WAVE 2096.1: REWRITE — CIE L*a*b* perceptual distance, RGBW, CMY
 *
 * WHAT CHANGED:
 * - Wheel matching now uses CIE76 ΔE* (perceptually uniform) instead of
 *   weighted RGB distance with BT.601 luminance coefficients.
 * - RGBW extraction: W = min(R,G,B), then R'=R-W, G'=G-W, B'=B-W
 * - CMY subtractive mixing: C=255-R, M=255-G, Y=255-B
 * - Cache upgraded from FIFO to LRU with perceptual quantization
 *
 * COLOR SCIENCE:
 * - RGB → XYZ (sRGB D65 illuminant)
 * - XYZ → CIE L*a*b* (D65 white point)
 * - ΔE*ab = √((ΔL*)² + (Δa*)² + (Δb*)²) — CIE76
 *
 * Why CIE76 instead of CIEDE2000?
 * CIE76 is perceptually uniform enough for wheel matching with 8-14 colors.
 * CIEDE2000 adds rotation terms and is 10x more complex for marginal gain
 * at this granularity. If we ever need fine-grained continuous matching,
 * we upgrade to CIEDE2000. For now CIE76 is the correct tradeoff.
 *
 * @module hal/translation/ColorTranslator
 * @version WAVE 2096.1 — THE CHROMATIC RESURRECTION
 */
// ═══════════════════════════════════════════════════════════════════════════
// CIE COLOR SCIENCE — RGB → L*a*b* → ΔE*
// ═══════════════════════════════════════════════════════════════════════════
/**
 * sRGB inverse companding (gamma decode)
 * Converts 0-255 sRGB to linear 0-1
 */
function srgbToLinear(c) {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
/**
 * RGB → CIE XYZ (D65 illuminant, sRGB primaries)
 * Matrix from IEC 61966-2-1:1999 (sRGB standard)
 */
function rgbToXyz(rgb) {
    const r = srgbToLinear(rgb.r);
    const g = srgbToLinear(rgb.g);
    const b = srgbToLinear(rgb.b);
    return {
        X: 0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
        Y: 0.2126729 * r + 0.7151522 * g + 0.0721750 * b,
        Z: 0.0193339 * r + 0.1191920 * g + 0.9503041 * b,
    };
}
/**
 * CIE XYZ → CIE L*a*b*
 * Using D65 standard illuminant white point:
 * Xn = 0.95047, Yn = 1.00000, Zn = 1.08883
 */
function xyzToLab(xyz) {
    const Xn = 0.95047;
    const Yn = 1.00000;
    const Zn = 1.08883;
    const f = (t) => {
        const delta = 6 / 29;
        return t > delta * delta * delta
            ? Math.cbrt(t)
            : t / (3 * delta * delta) + 4 / 29;
    };
    const fx = f(xyz.X / Xn);
    const fy = f(xyz.Y / Yn);
    const fz = f(xyz.Z / Zn);
    return {
        L: 116 * fy - 16,
        a: 500 * (fx - fy),
        b: 200 * (fy - fz),
    };
}
/**
 * RGB → CIE L*a*b* (convenience function)
 */
function rgbToLab(rgb) {
    return xyzToLab(rgbToXyz(rgb));
}
/**
 * CIE76 ΔE* — Perceptual color distance
 *
 * ΔE*ab = √((ΔL*)² + (Δa*)² + (Δb*)²)
 *
 * Scale reference:
 *   0-1:   Imperceptible
 *   1-2:   Barely perceptible
 *   2-3.5: Perceptible through close observation
 *   3.5-5: Clearly distinguishable
 *   >5:    Colors are more different than similar
 *
 * Max possible ΔE* ≈ 200 (black to white in L*a*b*)
 */
function deltaE76(lab1, lab2) {
    const dL = lab1.L - lab2.L;
    const da = lab1.a - lab2.a;
    const db = lab1.b - lab2.b;
    return Math.sqrt(dL * dL + da * da + db * db);
}
// ═══════════════════════════════════════════════════════════════════════════
// RGBW & CMY CONVERSION
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🔆 WAVE 2096.1: RGB → RGBW decomposition
 *
 * Extracts the white component from an RGB color.
 * W = min(R, G, B) — the achromatic portion
 * Then subtracts white from each channel to get pure chromatic RGB.
 */
export function rgbToRgbw(rgb) {
    const w = Math.min(rgb.r, rgb.g, rgb.b);
    return {
        r: rgb.r - w,
        g: rgb.g - w,
        b: rgb.b - w,
        w,
    };
}
/**
 * 🎨 WAVE 2096.1: RGB → CMY subtractive conversion
 *
 * For fixtures with Cyan, Magenta, Yellow flags.
 * C = 255 - R, M = 255 - G, Y = 255 - B
 */
export function rgbToCmy(rgb) {
    return {
        c: 255 - rgb.r,
        m: 255 - rgb.g,
        y: 255 - rgb.b,
    };
}
/**
 * Calcula la saturación aproximada de un color
 */
function getSaturation(c) {
    const max = Math.max(c.r, c.g, c.b);
    const min = Math.min(c.r, c.g, c.b);
    if (max === 0)
        return 0;
    return (max - min) / max;
}
// ═══════════════════════════════════════════════════════════════════════════
// COLOR TRANSLATOR CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class ColorTranslator {
    constructor() {
        // Cache de traducciones (LRU)
        this.translationCache = new Map();
        // Pre-computed L*a*b* for wheel colors (cached per profile)
        this.wheelLabCache = new Map();
        // ΔE* threshold for "poor match"
        // ΔE* > 40 means colors are extremely different
        this.POOR_MATCH_THRESHOLD = 40;
        // Tamaño máximo del cache
        this.MAX_CACHE_SIZE = 512;
        // WAVE 2098: Boot silence
    }
    /**
     * 🎯 MÉTODO PRINCIPAL: Traduce un color RGB al formato físico del fixture
     *
     * WAVE 2096.1: Now supports 4 fixture types:
     *   1. RGB pass-through (LED PARs, LED wash)
     *   2. RGBW decomposition (LED RGBW fixtures)
     *   3. CMY subtractive (discharge CMY fixtures)
     *   4. Color wheel matching (beam/spot with mechanical wheel)
     */
    translate(targetRGB, profile) {
        // CASO 0: Sin perfil → pass-through
        if (!profile) {
            return { outputRGB: targetRGB, colorDistance: 0, wasTranslated: false, poorMatch: false };
        }
        // ═══════════════════════════════════════════════════════════════════
        // WAVE 2096.1: Detect color engine type
        // ═══════════════════════════════════════════════════════════════════
        const mixingType = profile.colorEngine?.mixing
            || profile.capabilities?.colorEngine
            || profile.colorEngine
            || 'rgb';
        // ─────────────────────────────────────────────────────────────────
        // CASO 1: RGBW fixture — decompose white channel
        // ─────────────────────────────────────────────────────────────────
        if (mixingType === 'rgbw') {
            const rgbw = rgbToRgbw(targetRGB);
            return {
                outputRGB: targetRGB,
                colorDistance: 0,
                wasTranslated: true,
                poorMatch: false,
                rgbw,
            };
        }
        // ─────────────────────────────────────────────────────────────────
        // CASO 2: CMY fixture — subtractive conversion
        // ─────────────────────────────────────────────────────────────────
        if (mixingType === 'cmy') {
            const cmy = rgbToCmy(targetRGB);
            return {
                outputRGB: targetRGB,
                colorDistance: 0,
                wasTranslated: true,
                poorMatch: false,
                cmy,
            };
        }
        // ─────────────────────────────────────────────────────────────────
        // CASO 3: Color wheel matching (beam/spot) — CIE L*a*b* ΔE*
        // Also handles 'hybrid' (wheel + CMY) as wheel for now.
        // ─────────────────────────────────────────────────────────────────
        // 🚑 WAVE 2058: EXTRACCIÓN SEGURA (Puente entre Forja V1 y V2)
        const isWheelEngine = mixingType === 'wheel' || mixingType === 'hybrid';
        const colorWheel = profile.capabilities?.colorWheel ||
            profile.wheels ||
            profile.colorEngine?.colorWheel;
        const hasWheelData = colorWheel && colorWheel.colors && colorWheel.colors.length > 0;
        // CASO 3a: Pure RGB (no wheel, not RGBW, not CMY) → pass-through
        if (!isWheelEngine && !hasWheelData) {
            return { outputRGB: targetRGB, colorDistance: 0, wasTranslated: false, poorMatch: false };
        }
        // CASO 3b: Is wheel but empty → Fallback to white
        // WAVE 2073: Log-once guard — no spam por frame. Solo avisa una vez por perfil.
        if (!hasWheelData) {
            if (!ColorTranslator.warnedProfiles.has(profile.id)) {
                ColorTranslator.warnedProfiles.add(profile.id);
                console.warn(`[ColorTranslator] ⚠️ Profile ${profile.id} is 'wheel' but has no colors mapped`);
            }
            return {
                outputRGB: { r: 255, g: 255, b: 255 },
                colorWheelDmx: 0,
                colorName: 'Open (Fallback)',
                colorDistance: 100,
                wasTranslated: true,
                poorMatch: true,
            };
        }
        // CASO 3c: Real wheel translation with CIE L*a*b*
        const cacheKey = this.getCacheKey(targetRGB, profile.id);
        const cached = this.translationCache.get(cacheKey);
        if (cached) {
            // LRU: move to end (delete + re-insert)
            this.translationCache.delete(cacheKey);
            this.translationCache.set(cacheKey, cached);
            return cached;
        }
        const result = this.findNearestColorLab(targetRGB, colorWheel, profile.id);
        this.cacheResult(cacheKey, result);
        return result;
    }
    /**
     *  WAVE 2096.1: Find nearest wheel color using CIE76 ΔE*
     * Pre-computes L*a*b* for all wheel colors (cached per profile).
     */
    findNearestColorLab(target, wheel, profileId) {
        // Get or compute L*a*b* for wheel colors
        let wheelLabs = this.wheelLabCache.get(profileId);
        if (!wheelLabs) {
            wheelLabs = wheel.colors.map(c => rgbToLab(c.rgb));
            this.wheelLabCache.set(profileId, wheelLabs);
        }
        const targetLab = rgbToLab(target);
        // Find the two closest colors (for half-color positioning)
        let nearestIndex = 0;
        let secondNearestIndex = -1;
        let smallestDeltaE = Infinity;
        let secondSmallestDeltaE = Infinity;
        for (let i = 0; i < wheel.colors.length; i++) {
            const dE = deltaE76(targetLab, wheelLabs[i]);
            if (dE < smallestDeltaE) {
                secondSmallestDeltaE = smallestDeltaE;
                secondNearestIndex = nearestIndex;
                smallestDeltaE = dE;
                nearestIndex = i;
            }
            else if (dE < secondSmallestDeltaE) {
                secondSmallestDeltaE = dE;
                secondNearestIndex = i;
            }
        }
        let finalColor = wheel.colors[nearestIndex];
        const poorMatch = smallestDeltaE > this.POOR_MATCH_THRESHOLD;
        // If poor match and target is low saturation → prefer white/open
        if (poorMatch && getSaturation(target) < 0.3) {
            const whiteColor = wheel.colors.find(c => c.name.toLowerCase().includes('white') || c.name.toLowerCase().includes('open'));
            if (whiteColor) {
                finalColor = whiteColor;
                smallestDeltaE = deltaE76(targetLab, rgbToLab(whiteColor.rgb));
                return {
                    outputRGB: finalColor.rgb,
                    colorWheelDmx: finalColor.dmx,
                    colorName: finalColor.name,
                    colorDistance: smallestDeltaE,
                    wasTranslated: true,
                    poorMatch: true,
                };
            }
        }
        // ─────────────────────────────────────────────────────────────────
        // WAVE 2096.2: HALF-COLOR POSITIONING (VULN-COLOR-04)
        // 
        // If the target sits between two adjacent wheel colors,
        // interpolate the DMX value for analog wheel positioning.
        // 
        // Requirements for half-color:
        //   1. Two valid colors found
        //   2. They are ADJACENT on the wheel (index difference of 1)
        //   3. The nearest match is not a perfect match (dE > 3)
        //   4. The second color is meaningfully close (dE < 60)
        //   5. Not a poor match overall
        // ─────────────────────────────────────────────────────────────────
        let interpolatedDmx = finalColor.dmx;
        let colorName = finalColor.name;
        if (secondNearestIndex >= 0 &&
            !poorMatch &&
            smallestDeltaE > 3 && // Not already a perfect match
            secondSmallestDeltaE < 60 // Second color is in the neighborhood
        ) {
            const secondColor = wheel.colors[secondNearestIndex];
            // Check adjacency: colors must be neighbors on the physical wheel
            // Adjacent = index difference of 1 (or wrap-around for first/last)
            const indexDiff = Math.abs(nearestIndex - secondNearestIndex);
            const isAdjacent = indexDiff === 1 || indexDiff === wheel.colors.length - 1;
            if (isAdjacent) {
                // Interpolation factor: how far toward secondColor (0 = at nearest, 1 = at second)
                const totalDistance = smallestDeltaE + secondSmallestDeltaE;
                const t = totalDistance > 0 ? smallestDeltaE / totalDistance : 0;
                // Interpolate DMX value between the two slots
                const dmxA = finalColor.dmx;
                const dmxB = secondColor.dmx;
                interpolatedDmx = Math.round(dmxA + (dmxB - dmxA) * t);
                // Label with both colors when meaningfully between them
                if (t > 0.15) {
                    colorName = `${finalColor.name}/${secondColor.name}`;
                }
            }
        }
        return {
            outputRGB: finalColor.rgb,
            colorWheelDmx: interpolatedDmx,
            colorName,
            colorDistance: smallestDeltaE,
            wasTranslated: true,
            poorMatch,
        };
    }
    /**
     * � WAVE 2096.1: Cache key with perceptual quantization
     * Quantizes in L*a*b* space (step=4) instead of RGB.
     */
    getCacheKey(rgb, profileId) {
        const lab = rgbToLab(rgb);
        const qL = Math.round(lab.L / 4) * 4;
        const qa = Math.round(lab.a / 4) * 4;
        const qb = Math.round(lab.b / 4) * 4;
        return `${profileId}:${qL},${qa},${qb}`;
    }
    /**
     * 💾 LRU cache storage with size limit
     */
    cacheResult(key, result) {
        if (this.translationCache.size >= this.MAX_CACHE_SIZE) {
            const firstKey = this.translationCache.keys().next().value;
            if (firstKey) {
                this.translationCache.delete(firstKey);
            }
        }
        this.translationCache.set(key, result);
    }
    /**
     * 🧹 Limpia el cache de traducciones
     */
    clearCache() {
        this.translationCache.clear();
        this.wheelLabCache.clear();
    }
    // ═══════════════════════════════════════════════════════════════════════
    // MÉTODOS DE UTILIDAD
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Obtiene todos los colores disponibles en un perfil
     */
    getAvailableColors(profile) {
        const colorWheel = profile?.capabilities?.colorWheel || profile?.wheels || profile?.colorEngine?.colorWheel;
        if (colorWheel && colorWheel.colors && colorWheel.colors.length > 0) {
            return colorWheel.colors;
        }
        return [
            { dmx: 0, name: 'Red', rgb: { r: 255, g: 0, b: 0 } },
            { dmx: 0, name: 'Green', rgb: { r: 0, g: 255, b: 0 } },
            { dmx: 0, name: 'Blue', rgb: { r: 0, g: 0, b: 255 } },
            { dmx: 0, name: 'Yellow', rgb: { r: 255, g: 255, b: 0 } },
            { dmx: 0, name: 'Cyan', rgb: { r: 0, g: 255, b: 255 } },
            { dmx: 0, name: 'Magenta', rgb: { r: 255, g: 0, b: 255 } },
            { dmx: 0, name: 'White', rgb: { r: 255, g: 255, b: 255 } },
        ];
    }
    /**
     * Debug: muestra la distancia ΔE* de un color a cada color de la rueda
     */
    debugDistances(target, profile) {
        const colors = this.getAvailableColors(profile);
        const targetLab = rgbToLab(target);
        console.log(`[ColorTranslator] 🔬 ΔE* distances from RGB(${target.r}, ${target.g}, ${target.b}) [L*=${targetLab.L.toFixed(1)} a*=${targetLab.a.toFixed(1)} b*=${targetLab.b.toFixed(1)}]:`);
        for (const color of colors) {
            const colorLab = rgbToLab(color.rgb);
            const dE = deltaE76(targetLab, colorLab);
            const bar = '█'.repeat(Math.round(dE / 2));
            console.log(`  ${color.name.padEnd(18)} DMX:${color.dmx.toString().padStart(3)} | ΔE*: ${dE.toFixed(1).padStart(6)} | ${bar}`);
        }
    }
}
// WAVE 2073: Log-once guard — evita spam por frame cuando la rueda no tiene colores mapeados
ColorTranslator.warnedProfiles = new Set();
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════
let instance = null;
export function getColorTranslator() {
    if (!instance) {
        instance = new ColorTranslator();
    }
    return instance;
}
