/**
 * ☀️ HYPERION — Fixture Layer
 *
 * EL CORAZÓN DEL RENDERIZADO.
 * Cada fixture es una invocación de luz: Aura → Halo → Beam → Core → Rim.
 *
 * Pipeline de renderizado (por fixture, en orden Z):
 * 1. OUTER AURA — Scatter atmosférico ultra-difuso (solo HQ + intensity > 0.3)
 * 2. NEON HALO — Glow principal con color del fixture
 * 3. BEAM CONE — Proyección triangular para movers (pan/tilt/zoom)
 * 4. COLOR CORE — Centro sólido con el color del fixture
 * 5. WHITE HOT CENTER — Punto central blanco (escala con intensity)
 * 6. NEON RIM — Anillo fino siempre visible (identidad del fixture apagado)
 *
 * 🩸 WAVE 7568: OILPAN OOM EXTERMINATION — ALL CanvasGradient allocations
 *   purged from the hot loop. createRadialGradient/createLinearGradient
 *   allocate a CanvasGradient C++ object in Oilpan's CppHeap PER CALL.
 *   With 200 fixtures × 5 gradients × 60fps = 60,000 CanvasGradient +
 *   ~240,000 addColorStop C++ objects/second. The Oilpan GC cannot keep
 *   up → CppHeap fills → "Large allocation" OOM crash.
 *
 * 🎨 WAVE 7571: BEAUTIFUL RADAR — Sprite Cache Restoration.
 *   Replaced the WAVE 7568 concentric-circle hack with pre-rendered
 *   OffscreenCanvas sprites cached by color string. The radial gradients
 *   are created ONCE per unique color (lazy init), then stamped via
 *   drawImage() at 60fps — zero CanvasGradient C++ allocs in the hot loop.
 *   Visual quality is back to the original cyberpunk aesthetic, with the
 *   Oilpan safety of WAVE 7568. The GPU (RTX 3060) handles drawImage
 *   scaling trivially.
 *
 * @module components/hyperion/views/tactical/layers/FixtureLayer
 * @since WAVE 2042.5 (Project Hyperion — Phase 3)
 */

import type { TacticalFixture, QualityMode } from '../../tactical/types'
import { HYPERION } from '../../../shared/NeonPalette'

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE VISUAL CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export const FIXTURE_CONFIG = {
  // ── Size ────────────────────────────────────────────────────────────────
  /** Base fixture radius (fraction of canvas min dimension) */
  BASE_RADIUS_RATIO: 0.022,
  /** Minimum radius in pixels */
  MIN_RADIUS: 8,
  /** Maximum radius in pixels */
  MAX_RADIUS: 24,

  // ── Glow Multipliers ────────────────────────────────────────────────────
  /** Glow radius multiplier for moving heads (beam is their "light") */
  MOVER_GLOW: 3.5,
  /** Glow radius multiplier for PARs (diffuse wash) */
  PAR_GLOW: 5.0,
  /** Outer aura radius multiplier (atmospheric scatter) */
  AURA_RADIUS: 8.0,

  // ── Beam Projection ─────────────────────────────────────────────────────
  /** Maximum beam throw (fraction of canvas height) */
  BEAM_MAX_THROW: 0.42,
  /** Minimum beam cone angle in degrees (tight beam, zoom=0) */
  BEAM_MIN_ANGLE: 5,
  /** Maximum beam cone angle in degrees (wide wash, zoom=255) */
  BEAM_MAX_ANGLE: 55,

  // ── Beat Reactivity ─────────────────────────────────────────────────────
  /** Glow scale boost on beat (1.0 = no boost) */
  BEAT_GLOW_SCALE: 1.08,
  /** Core brightness boost on beat */
  BEAT_CORE_BOOST: 0.15,
} as const

// ═══════════════════════════════════════════════════════════════════════════
// MATH UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v))

// 🛡️ WAVE 7569: NaN SHIELD — if v is non-finite (NaN/Infinity), return outMin
// instead of propagating the poison. clamp(NaN, 0, 1) = NaN because
// Math.max(0, NaN) = NaN, so without this guard NaN flows into Math.sin/cos/tan
// and silently disables fixture drawing (ctx.lineTo(NaN,...) is a silent no-op).
const mapRange = (v: number, inMin: number, inMax: number, outMin: number, outMax: number): number => {
  if (!Number.isFinite(v)) return outMin
  const t = clamp((v - inMin) / (inMax - inMin), 0, 1)
  return lerp(outMin, outMax, t)
}

const deg2rad = (d: number): number => d * (Math.PI / 180)

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 WAVE 7571: SPRITE CACHE — Zero-Alloc Gradient Restoration
// ═══════════════════════════════════════════════════════════════════════════
//
// Pre-rendered OffscreenCanvas sprites keyed by CSS color string.
// The radial/linear gradients are created ONCE per unique color (lazy init),
// then stamped via drawImage() at 60fps. Zero CanvasGradient C++ allocs
// in the hot loop — the Oilpan GC never sees a gradient object.
//
// Sprite sizes:
//   GLOW_SPRITE_SIZE = 128  (aura + halo — radial, square)
//   BEAM_SPRITE_W    = 64   (beam body — linear, narrow)
//   BEAM_SPRITE_H    = 256  (beam body — linear, tall)
//
// Safety valve: if cache exceeds 150 entries (unlikely with discrete
// palettes), clear it to prevent unbounded growth from color fades.

const GLOW_SPRITE_SIZE = 128
const BEAM_SPRITE_W = 64
const BEAM_SPRITE_H = 256
const SPRITE_CACHE_LIMIT = 150

const glowSpriteCache = new Map<string, OffscreenCanvas>()
const beamSpriteCache = new Map<string, OffscreenCanvas>()

/**
 * Build a radial gradient glow sprite (white-hot center → color → transparent edge).
 * Cached per color string. Used for both aura and halo (scaled differently).
 */
function getGlowSprite(r: number, g: number, b: number): OffscreenCanvas {
  const colorKey = `rgb(${r},${g},${b})`
  const cached = glowSpriteCache.get(colorKey)
  if (cached) return cached

  // Safety valve: clear if too many unique colors (color fades etc.)
  // 🛡️ WAVE 7713: Call .close() on evicted sprites to release GPU memory
  // immediately instead of waiting for GC (OffscreenCanvas holds GPU textures).
  if (glowSpriteCache.size >= SPRITE_CACHE_LIMIT) {
    for (const sprite of glowSpriteCache.values()) {
      try { (sprite as any).close() } catch {}
    }
    glowSpriteCache.clear()
  }

  const sprite = new OffscreenCanvas(GLOW_SPRITE_SIZE, GLOW_SPRITE_SIZE)
  const sctx = sprite.getContext('2d')!
  const cx = GLOW_SPRITE_SIZE / 2
  const cy = GLOW_SPRITE_SIZE / 2
  const grad = sctx.createRadialGradient(cx, cy, 0, cx, cy, cx)
  // White-hot center → solid color → transparent edge
  grad.addColorStop(0.0, `rgba(255, 255, 255, 1.0)`)
  grad.addColorStop(0.15, `rgba(${r}, ${g}, ${b}, 0.9)`)
  grad.addColorStop(0.40, `rgba(${r}, ${g}, ${b}, 0.4)`)
  grad.addColorStop(0.70, `rgba(${r}, ${g}, ${b}, 0.10)`)
  grad.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0)`)
  sctx.fillStyle = grad
  sctx.fillRect(0, 0, GLOW_SPRITE_SIZE, GLOW_SPRITE_SIZE)

  glowSpriteCache.set(colorKey, sprite)
  return sprite
}

/**
 * Build a linear gradient beam sprite (bright at top → transparent at bottom).
 * Cached per color string. Stamped and rotated/scaled for beam cones.
 */
function getBeamSprite(r: number, g: number, b: number): OffscreenCanvas {
  const colorKey = `rgb(${r},${g},${b})`
  const cached = beamSpriteCache.get(colorKey)
  if (cached) return cached

  if (beamSpriteCache.size >= SPRITE_CACHE_LIMIT) {
    // 🛡️ WAVE 7713: Close evicted sprites to release GPU memory immediately.
    for (const sprite of beamSpriteCache.values()) {
      try { (sprite as any).close() } catch {}
    }
    beamSpriteCache.clear()
  }

  const sprite = new OffscreenCanvas(BEAM_SPRITE_W, BEAM_SPRITE_H)
  const sctx = sprite.getContext('2d')!
  const grad = sctx.createLinearGradient(0, 0, 0, BEAM_SPRITE_H)
  // Bright at top (fixture source) → transparent at bottom (beam tip)
  grad.addColorStop(0.0, `rgba(${r}, ${g}, ${b}, 1.0)`)
  grad.addColorStop(0.15, `rgba(${r}, ${g}, ${b}, 0.85)`)
  grad.addColorStop(0.50, `rgba(${r}, ${g}, ${b}, 0.40)`)
  grad.addColorStop(0.85, `rgba(${r}, ${g}, ${b}, 0.08)`)
  grad.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0)`)
  sctx.fillStyle = grad
  sctx.fillRect(0, 0, BEAM_SPRITE_W, BEAM_SPRITE_H)

  beamSpriteCache.set(colorKey, sprite)
  return sprite
}

// ═══════════════════════════════════════════════════════════════════════════
// INDIVIDUAL FIXTURE RENDER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Draw outer atmospheric aura (only in HQ mode, high intensity).
 *
 * 🎨 WAVE 7571: Uses pre-rendered glow sprite (cached per color).
 * drawImage stamps the radial gradient texture — zero CanvasGradient allocs.
 */
function drawAura(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  fixture: TacticalFixture,
  baseRadius: number
): void {
  const { r, g, b, intensity } = fixture

  // Only draw for bright fixtures
  if (intensity < 0.35) return

  const auraRadius = baseRadius * FIXTURE_CONFIG.AURA_RADIUS * (0.8 + intensity * 0.4)
  const alpha = intensity * 0.12

  // Stamp the cached glow sprite, scaled to aura diameter
  const sprite = getGlowSprite(r, g, b)
  const prevAlpha = ctx.globalAlpha
  ctx.globalAlpha = alpha
  ctx.drawImage(sprite, x - auraRadius, y - auraRadius, auraRadius * 2, auraRadius * 2)
  ctx.globalAlpha = prevAlpha
}

/**
 * Draw neon halo (main glow effect).
 *
 * 🎨 WAVE 7571: Uses pre-rendered glow sprite (cached per color).
 * Two passes: outer diffuse glow + inner sharp ring, both via drawImage.
 */
function drawHalo(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  fixture: TacticalFixture,
  baseRadius: number,
  beatScale: number
): void {
  const { r, g, b, intensity, type } = fixture

  if (intensity < 0.02) return

  const isPar = type === 'par' || type === 'wash'
  const glowMultiplier = isPar ? FIXTURE_CONFIG.PAR_GLOW : FIXTURE_CONFIG.MOVER_GLOW

  // Halo radius: base + intensity + beat pulse
  const haloRadius = baseRadius * glowMultiplier * (0.6 + intensity * 0.5) * beatScale
  const outerAlpha = isPar ? intensity * 0.40 : intensity * 0.50

  const sprite = getGlowSprite(r, g, b)
  const prevAlpha = ctx.globalAlpha

  // ── Pass 1: Diffuse outer glow ──────────────────────────────────────
  ctx.globalAlpha = outerAlpha
  ctx.drawImage(sprite, x - haloRadius, y - haloRadius, haloRadius * 2, haloRadius * 2)

  // ── Pass 2: Sharp inner ring (neon edge) ────────────────────────────
  const innerRadius = haloRadius * 0.35
  const innerAlpha = intensity * 0.25
  ctx.globalAlpha = innerAlpha
  ctx.drawImage(sprite, x - innerRadius, y - innerRadius, innerRadius * 2, innerRadius * 2)

  ctx.globalAlpha = prevAlpha
}

/**
 * Draw beam projection cone (movers only).
 *
 * Double-layer "lightsaber" effect:
 * - Layer 1: Color body (full width)
 * - Layer 2: White hot core (20% width)
 *
 * 🎨 WAVE 7571: Uses pre-rendered beam sprite (cached per color) clipped
 * to a cone path. drawImage stamps the linear gradient texture — zero
 * CanvasGradient allocs in the hot loop.
 */
function drawBeam(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  fixture: TacticalFixture,
  canvasHeight: number
): void {
  const { r, g, b, intensity, physicalPan, physicalTilt, zoom, focus, type } = fixture

  // Only movers get beams
  if (type === 'par' || type === 'wash' || intensity < 0.03) return

  // Pan angle: 0→ +45°, 0.5→ 0°, 1→ -45°
  const panAngle = mapRange(physicalPan, 0, 1, -Math.PI * 0.45, Math.PI * 0.45)

  // Tilt affects throw length: parabolic (max at 0.5)
  const tiltFactor = 1 - Math.abs(physicalTilt - 0.5) * 2
  const throwLength = canvasHeight * FIXTURE_CONFIG.BEAM_MAX_THROW * Math.max(0.15, tiltFactor)

  // Cone angle from zoom (0=tight, 255=wide)
  const coneAngleDeg = mapRange(zoom, 0, 255, FIXTURE_CONFIG.BEAM_MIN_ANGLE, FIXTURE_CONFIG.BEAM_MAX_ANGLE)
  const halfCone = deg2rad(coneAngleDeg / 2)

  // Focus affects edge alpha (0=sharp, 255=diffuse)
  const edgeSharpness = mapRange(focus, 0, 255, 0.12, 0.03)

  // Beam direction unit vector
  const dirX = Math.sin(panAngle)
  const dirY = Math.cos(panAngle)

  // Perpendicular (for cone width)
  const perpX = Math.cos(panAngle)
  const perpY = -Math.sin(panAngle)

  // Full cone half-width at the tip
  const baseHalf = Math.tan(halfCone) * throwLength

  // ── LAYER 1: COLOR BODY — clip cone + drawImage beam sprite ──────────
  const bodyAlpha = intensity * 0.65
  const sprite = getBeamSprite(r, g, b)
  const prevAlpha = ctx.globalAlpha

  ctx.save()
  // Clip to the full cone triangle
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + dirX * throwLength - perpX * baseHalf, y + dirY * throwLength - perpY * baseHalf)
  ctx.lineTo(x + dirX * throwLength + perpX * baseHalf, y + dirY * throwLength + perpY * baseHalf)
  ctx.closePath()
  ctx.clip()
  // Stamp the beam sprite: stretch to throw length × 2× cone width
  // Position so the top of the sprite (bright end) is at the fixture (x, y)
  ctx.globalAlpha = bodyAlpha
  ctx.translate(x, y)
  ctx.rotate(panAngle)
  // After rotation, draw the sprite downward from origin
  // Width = 2 × baseHalf (covers full cone), Height = throwLength
  ctx.drawImage(sprite, -baseHalf, 0, baseHalf * 2, throwLength)
  ctx.restore()

  // ── LAYER 2: WHITE HOT CORE (20% width) — same technique, white sprite ──
  const coreAlpha = intensity * 0.85
  const coreHalf = baseHalf * 0.20
  const coreSprite = getBeamSprite(255, 255, 255)

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + dirX * throwLength - perpX * coreHalf, y + dirY * throwLength - perpY * coreHalf)
  ctx.lineTo(x + dirX * throwLength + perpX * coreHalf, y + dirY * throwLength + perpY * coreHalf)
  ctx.closePath()
  ctx.clip()
  ctx.globalAlpha = coreAlpha
  ctx.translate(x, y)
  ctx.rotate(panAngle)
  ctx.drawImage(coreSprite, -coreHalf, 0, coreHalf * 2, throwLength)
  ctx.restore()

  ctx.globalAlpha = prevAlpha
}

/**
 * Draw fixture core (solid color center).
 */
function drawCore(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  fixture: TacticalFixture,
  baseRadius: number,
  beatBoost: number
): void {
  const { r, g, b, intensity } = fixture

  if (intensity < 0.02) return

  const coreRadius = baseRadius * 0.70
  const coreAlpha = clamp(intensity + 0.25 + beatBoost, 0, 1)

  // Solid color core
  ctx.beginPath()
  ctx.arc(x, y, coreRadius, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${coreAlpha})`
  ctx.fill()
}

/**
 * Draw white hot center point (scales with intensity).
 */
function drawHotCenter(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  fixture: TacticalFixture,
  baseRadius: number
): void {
  const { intensity } = fixture

  if (intensity < 0.15) return

  // Size scales with intensity
  const centerRadius = baseRadius * (0.15 + intensity * 0.20)

  ctx.beginPath()
  ctx.arc(x, y, centerRadius, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + intensity * 0.5})`
  ctx.fill()
}

/**
 * Draw neon rim (always visible, gives identity to off fixtures).
 */
function drawNeonRim(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  fixture: TacticalFixture,
  baseRadius: number
): void {
  const { r, g, b, intensity } = fixture

  // Rim is always visible, but brighter when lit
  const rimAlpha = intensity > 0.02 ? 0.6 + intensity * 0.4 : 0.15

  ctx.beginPath()
  ctx.arc(x, y, baseRadius, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${rimAlpha})`
  ctx.lineWidth = intensity > 0.02 ? 1.5 : 1
  ctx.stroke()
}

/**
 * Draw off-state fixture (sleeping but present).
 */
function drawOffFixture(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  fixture: TacticalFixture,
  baseRadius: number
): void {
  const { r, g, b } = fixture

  // Dark interior
  ctx.beginPath()
  ctx.arc(x, y, baseRadius * 0.85, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(10, 10, 18, 0.85)'
  ctx.fill()

  // Color rim (memory of the fixture's identity)
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.18)`
  ctx.lineWidth = 1
  ctx.stroke()

  // Tiny cyan dot (fixture exists but sleeping)
  ctx.beginPath()
  ctx.arc(x, y, 2, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0, 240, 255, 0.20)'
  ctx.fill()
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FIXTURE LAYER RENDERER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Render all fixtures with the full Neon Total pipeline.
 */
export function renderFixtureLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fixtures: TacticalFixture[],
  options?: {
    /** Quality mode */
    quality?: QualityMode
    /** Is currently on beat? (for pulse effects) */
    onBeat?: boolean
    /** Beat intensity (0-1) */
    beatIntensity?: number
  }
): void {
  const {
    quality = 'HQ',
    onBeat = false,
    beatIntensity = 0,
  } = options ?? {}

  const isHQ = quality === 'HQ'

  // Calculate base radius
  const minDim = Math.min(width, height)
  const baseRadius = clamp(
    minDim * FIXTURE_CONFIG.BASE_RADIUS_RATIO,
    FIXTURE_CONFIG.MIN_RADIUS,
    FIXTURE_CONFIG.MAX_RADIUS
  )

  // ⚡ WAVE 2464: Beat reactivity — continuo (0-1), no binario
  // beatIntensity es el beatVisualEnvelope que decae a 60fps en TacticalCanvas.
  // beatScale: 1.0 (sin beat) → 1.08 (beat pleno). Suave, no flash duro.
  // beatBoost: modulado por el envelope para que el core también respire.
  const beatScale = 1.0 + (beatIntensity * (FIXTURE_CONFIG.BEAT_GLOW_SCALE - 1.0))
  const beatBoost = beatIntensity * FIXTURE_CONFIG.BEAT_CORE_BOOST

  // ── RENDER PASS 1: BEAMS (below everything) ─────────────────────────────
  // Render beams first so halos/cores appear on top
  
  for (const fixture of fixtures) {
    if (fixture.intensity < 0.02) continue
    const fx = fixture.x * width
    const fy = fixture.y * height
    drawBeam(ctx, fx, fy, fixture, height)
  }

  // ── RENDER PASS 2: AURAS (HQ only) ──────────────────────────────────────
  
  if (isHQ) {
    for (const fixture of fixtures) {
      if (fixture.intensity < 0.35) continue
      const fx = fixture.x * width
      const fy = fixture.y * height
      drawAura(ctx, fx, fy, fixture, baseRadius)
    }
  }

  // ── RENDER PASS 3: HALOS ────────────────────────────────────────────────
  
  for (const fixture of fixtures) {
    const fx = fixture.x * width
    const fy = fixture.y * height

    if (fixture.intensity < 0.02) {
      // Off fixture
      drawOffFixture(ctx, fx, fy, fixture, baseRadius)
    } else {
      // Lit fixture: halo + core + hot center + rim
      drawHalo(ctx, fx, fy, fixture, baseRadius, beatScale)
      drawCore(ctx, fx, fy, fixture, baseRadius, beatBoost)
      drawHotCenter(ctx, fx, fy, fixture, baseRadius)
      drawNeonRim(ctx, fx, fy, fixture, baseRadius)
    }
  }
}
