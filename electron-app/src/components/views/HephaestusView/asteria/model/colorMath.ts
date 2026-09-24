/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 COLOR MATH — WAVE 8194 (Crux 2 — Phase 3, §3.4/§3.5)
 *
 * Conversiones de color para el plano de color del fieldEngine y el
 * cuantizador del compilador:
 *
 *   - sRGB (lo que edita la UI, '#rrggbb') ↔ RGB LINEAL (donde la luz
 *     se mezcla físicamente — la suma de dos focos es suma en lineal).
 *   - RGB8 ↔ HSL — el formato que viaja en los keyframes `color` del
 *     .lfx (misma aritmética que `hexToHsl` de lutSynth: h entero,
 *     s/l a 1 decimal — la higiene numérica §2.6 ya vive aquí).
 *   - OKLab (Björn Ottosson) — espacio perceptualmente uniforme para la
 *     cuantización median-cut y el gate G-COLOR-RT (ΔE euclídea).
 *
 * Funciones PURAS, patch-time. Los únicos puntos con alloc son los que
 * devuelven tuplas — el engine usa las variantes `*Into` sobre scratch.
 *
 * @module HephaestusView/asteria/model/colorMath
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { HSL } from '../../../../../core/hephaestus/types'

// ─────────────────────────────────────────────────────────────────────────────
// sRGB ↔ LINEAR (EOTF IEC 61966-2-1)
// ─────────────────────────────────────────────────────────────────────────────

/** sRGB [0,1] → lineal [0,1] (por canal). */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** Lineal [0,1] → sRGB [0,1] (por canal). */
export function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

/**
 * '#rrggbb' → RGB lineal en `out[0..2]` — UNA conversión por gesto,
 * jamás por nodo (§3.4). Hex inválido → rojo puro (fallback honesto,
 * paridad con `hexToHsl`).
 */
export function hexToLinearRgb(
  hex: string,
  out: { [index: number]: number },
): void {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const n = m ? parseInt(m[1], 16) : 0xff0000
  out[0] = srgbToLinear(((n >> 16) & 0xff) / 255)
  out[1] = srgbToLinear(((n >> 8) & 0xff) / 255)
  out[2] = srgbToLinear((n & 0xff) / 255)
}

/** RGB lineal [0,1] → sRGB8 empaquetado 0xRRGGBB (clamp incluido). */
export function linearToRgb8(r: number, g: number, b: number): number {
  const c = (v: number): number =>
    Math.round(Math.min(1, Math.max(0, linearToSrgb(v))) * 255)
  return (c(r) << 16) | (c(g) << 8) | c(b)
}

// ─────────────────────────────────────────────────────────────────────────────
// RGB8 ↔ HSL — el dominio de los keyframes `color` del .lfx
// ─────────────────────────────────────────────────────────────────────────────

/**
 * sRGB8 (0..255) → HSL {h 0..360, s/l 0..100} — MISMA aritmética y
 * redondeo que `hexToHsl` (h entero, s/l a 1 decimal) para que una clase
 * de color dedupe-rgb8 emita el mismo keyframe que el camino legacy.
 */
export function rgb8ToHsl(r8: number, g8: number, b8: number): HSL {
  const r = r8 / 255
  const g = g8 / 255
  const b = b8 / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return {
    h: Math.round(h),
    s: Math.round(s * 1000) / 10,
    l: Math.round(l * 1000) / 10,
  }
}

/** Packed 0xRRGGBB → HSL. */
export function rgb8PackedToHsl(rgb8: number): HSL {
  return rgb8ToHsl((rgb8 >> 16) & 0xff, (rgb8 >> 8) & 0xff, rgb8 & 0xff)
}

/** HSL {h°, s%, l%} → sRGB [0,1] — la inversa del keyframe (gate tests). */
export function hslToSrgb(h: number, s: number, l: number): [number, number, number] {
  const sn = Math.min(100, Math.max(0, s)) / 100
  const ln = Math.min(100, Math.max(0, l)) / 100
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const hp = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const m = ln - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (hp < 1) { r = c; g = x }
  else if (hp < 2) { r = x; g = c }
  else if (hp < 3) { g = c; b = x }
  else if (hp < 4) { g = x; b = c }
  else if (hp < 5) { r = x; b = c }
  else { r = c; b = x }
  return [r + m, g + m, b + m]
}

// ─────────────────────────────────────────────────────────────────────────────
// OKLab — espacio perceptualmente uniforme (cuantización + ΔE)
// ─────────────────────────────────────────────────────────────────────────────

/** RGB lineal [0,1] → OKLab (L,a,b) en `out[0..2]`. */
export function linearToOklabInto(
  r: number,
  g: number,
  b: number,
  out: { [index: number]: number },
): void {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
  const l3 = Math.cbrt(l)
  const m3 = Math.cbrt(m)
  const s3 = Math.cbrt(s)
  out[0] = 0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3
  out[1] = 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3
  out[2] = 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3
}

/** OKLab → RGB lineal [0,1] en `out[0..2]` (representantes de cluster). */
export function oklabToLinearInto(
  L: number,
  a: number,
  b: number,
  out: { [index: number]: number },
): void {
  const l3 = L + 0.3963377774 * a + 0.2158037573 * b
  const m3 = L - 0.1055613458 * a - 0.0638541729 * b
  const s3 = L - 0.0894841775 * a - 1.291485548 * b
  const l = l3 * l3 * l3
  const m = m3 * m3 * m3
  const s = s3 * s3 * s3
  out[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  out[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  out[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
}

/** Packed 0xRRGGBB → OKLab en `out[0..2]` (sRGB → lineal → OKLab). */
export function rgb8ToOklabInto(
  rgb8: number,
  out: { [index: number]: number },
): void {
  linearToOklabInto(
    srgbToLinear(((rgb8 >> 16) & 0xff) / 255),
    srgbToLinear(((rgb8 >> 8) & 0xff) / 255),
    srgbToLinear((rgb8 & 0xff) / 255),
    out,
  )
}

/** Distancia euclídea OKLab (ΔE) — ~0.01 ≈ 1 JND. */
export function oklabDeltaE(
  l1: number, a1: number, b1: number,
  l2: number, a2: number, b2: number,
): number {
  const dl = l1 - l2
  const da = a1 - a2
  const db = b1 - b2
  return Math.sqrt(dl * dl + da * da + db * db)
}
