/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 WAVE 2096.1: COLOR TYPES — LA FUENTE ÚNICA DE VERDAD
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * VULN-COLOR-07: HSLColor estaba definida 4 veces, RGBColor 5 veces.
 * Este módulo es ahora la ÚNICA definición canónica de los tipos de color.
 *
 * FAMILIAS DE COLOR:
 *
 *   1. HSLColor — Hue (0-360°), Saturation (0-100%), Lightness (0-100%)
 *      → Usado por SeleneColorEngine, paletas sinestésicas, todo el engine.
 *      → Es el "idioma nativo" de Selene.
 *
 *   2. RGBColor — Red (0-255), Green (0-255), Blue (0-255)
 *      → Usado en conversión de paletas, workers, frontend.
 *      → El "idioma de salida" hacia hardware.
 *
 * NOTA: LightingIntent.ts define su propio HSLColor con rangos 0-1 y campo
 * hex?. Eso es un tipo DISTINTO (IntentHSLColor) para la capa de protocolo.
 * No se unifica aquí porque el rango 0-1 es intencional para esa capa.
 *
 * NOTA: engine/types.ts define un RGBColor extendido con w?, a?, uv?.
 * Ese tipo se renombra a ExtendedRGBColor para evitar colisión.
 *
 * @module types/color
 * @version WAVE 2096.1 — VULN-COLOR-07 FIX
 */
export {};
