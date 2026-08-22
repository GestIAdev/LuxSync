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
 *   FIX: Replace every gradient with concentric solid-fill circles (radial)
 *   or stacked solid-fill triangles (linear). Each fillStyle='rgba(...)' +
 *   ctx.fill() is a single paint op — zero persistent C++ allocations.
 *   Visual difference is imperceptible for sub-24px fixture glows.
 *
 * @module components/hyperion/views/tactical/layers/FixtureLayer
 * @since WAVE 2042.5 (Project Hyperion — Phase 3)
 */
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
};
// ═══════════════════════════════════════════════════════════════════════════
// MATH UTILITIES
// ═══════════════════════════════════════════════════════════════════════════
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
// 🛡️ WAVE 7569: NaN SHIELD — if v is non-finite (NaN/Infinity), return outMin
// instead of propagating the poison. clamp(NaN, 0, 1) = NaN because
// Math.max(0, NaN) = NaN, so without this guard NaN flows into Math.sin/cos/tan
// and silently disables fixture drawing (ctx.lineTo(NaN,...) is a silent no-op).
const mapRange = (v, inMin, inMax, outMin, outMax) => {
    if (!Number.isFinite(v))
        return outMin;
    const t = clamp((v - inMin) / (inMax - inMin), 0, 1);
    return lerp(outMin, outMax, t);
};
const deg2rad = (d) => d * (Math.PI / 180);
// ═══════════════════════════════════════════════════════════════════════════
// INDIVIDUAL FIXTURE RENDER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Draw outer atmospheric aura (only in HQ mode, high intensity).
 *
 * 🩸 WAVE 7568: Replaced createRadialGradient with 4 concentric solid-fill
 * circles. Drawn outer→inner so smaller circles overwrite the center of
 * larger ones, creating a stepped radial fade. Zero CanvasGradient C++ allocs.
 */
function drawAura(ctx, x, y, fixture, baseRadius) {
    const { r, g, b, intensity } = fixture;
    // Only draw for bright fixtures
    if (intensity < 0.35)
        return;
    const auraRadius = baseRadius * FIXTURE_CONFIG.AURA_RADIUS * (0.8 + intensity * 0.4);
    const alpha = intensity * 0.12;
    // 4 concentric circles, outer→inner, alpha increasing toward center.
    // Matches the original gradient stops: 1.0→0, 0.6→0.15α, 0.3→0.5α, 0→α
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.04})`;
    ctx.beginPath();
    ctx.arc(x, y, auraRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.15})`;
    ctx.beginPath();
    ctx.arc(x, y, auraRadius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(x, y, auraRadius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, auraRadius * 0.12, 0, Math.PI * 2);
    ctx.fill();
}
/**
 * Draw neon halo (main glow effect).
 *
 * 🩸 WAVE 7568: Replaced 2 createRadialGradient calls with concentric
 * solid-fill circles. Outer glow = 4 circles (outer→inner, alpha rising).
 * Inner ring = 2 circles (ring effect via slightly different alpha).
 * Zero CanvasGradient C++ allocs.
 */
function drawHalo(ctx, x, y, fixture, baseRadius, beatScale) {
    const { r, g, b, intensity, type } = fixture;
    if (intensity < 0.02)
        return;
    const isPar = type === 'par' || type === 'wash';
    const glowMultiplier = isPar ? FIXTURE_CONFIG.PAR_GLOW : FIXTURE_CONFIG.MOVER_GLOW;
    // Halo radius: base + intensity + beat pulse
    const haloRadius = baseRadius * glowMultiplier * (0.6 + intensity * 0.5) * beatScale;
    const outerAlpha = isPar ? intensity * 0.40 : intensity * 0.50;
    // ── Pass 1: Diffuse outer glow — 4 concentric circles ───────────────
    // Matches original gradient: 1.0→0, 0.7→0.15α, 0.35→0.55α, 0→α
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${outerAlpha * 0.04})`;
    ctx.beginPath();
    ctx.arc(x, y, haloRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${outerAlpha * 0.15})`;
    ctx.beginPath();
    ctx.arc(x, y, haloRadius * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${outerAlpha * 0.55})`;
    ctx.beginPath();
    ctx.arc(x, y, haloRadius * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${outerAlpha})`;
    ctx.beginPath();
    ctx.arc(x, y, haloRadius * 0.12, 0, Math.PI * 2);
    ctx.fill();
    // ── Pass 2: Sharp inner ring (neon edge) — 2 circles ────────────────
    // Original gradient: 0→transparent, 0.7→innerAlpha, 1→innerAlpha*0.3
    // Simulated: a filled circle at innerAlpha, then a smaller darker one
    // on top to create the ring "hole" effect.
    const innerRadius = haloRadius * 0.35;
    const innerAlpha = intensity * 0.25;
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${innerAlpha * 0.3})`;
    ctx.beginPath();
    ctx.arc(x, y, innerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${innerAlpha})`;
    ctx.beginPath();
    ctx.arc(x, y, innerRadius * 0.75, 0, Math.PI * 2);
    ctx.fill();
}
/**
 * Draw beam projection cone (movers only).
 *
 * Double-layer "lightsaber" effect:
 * - Layer 1: Color body (full width)
 * - Layer 2: White hot core (20% width)
 *
 * 🩸 WAVE 7568: Replaced 2 createLinearGradient calls with stacked
 * solid-fill triangles. Each triangle is shorter (closer to the fixture)
 * and has higher alpha, simulating the linear fade from fixture→tip.
 * Zero CanvasGradient C++ allocs.
 */
function drawBeam(ctx, x, y, fixture, canvasHeight) {
    const { r, g, b, intensity, physicalPan, physicalTilt, zoom, focus, type } = fixture;
    // Only movers get beams
    if (type === 'par' || type === 'wash' || intensity < 0.03)
        return;
    // Pan angle: 0→ +45°, 0.5→ 0°, 1→ -45°
    // WAVE 4620-B: Invertido el signo para alinear el radar 2D con el visualizador 3D.
    // En 3D, pan=0 → yoke gira -135° → beam apunta derecha (+X) desde vista top-down.
    // En 2D era pan=0 → angle=-81° → beam apuntaba izquierda. Mirror invertido.
    // Con el mapRange invertido, pan=0 → +81° → endX = x + sin(81°)·L → beam apunta derecha.
    // WAVE 4887: FASE 1 — FIX ESPEJO ROTO.
    // El IK (ceiling): target a +X → panDeg > 0 → physicalPan > 0.5.
    // Con slope POSITIVA: physicalPan > 0.5 → panAngle > 0 → endX = x + sin(pos)·L → beam a +X (derecha). ✓
    // WAVE 4620-B usaba slope negativa alineando 2D con 3D, pero AMBOS estaban en espejo vs el IK.
    const panAngle = mapRange(physicalPan, 0, 1, -Math.PI * 0.45, Math.PI * 0.45);
    // Tilt affects throw length: parabolic (max at 0.5)
    const tiltFactor = 1 - Math.abs(physicalTilt - 0.5) * 2;
    const throwLength = canvasHeight * FIXTURE_CONFIG.BEAM_MAX_THROW * Math.max(0.15, tiltFactor);
    // Cone angle from zoom (0=tight, 255=wide)
    const coneAngleDeg = mapRange(zoom, 0, 255, FIXTURE_CONFIG.BEAM_MIN_ANGLE, FIXTURE_CONFIG.BEAM_MAX_ANGLE);
    const halfCone = deg2rad(coneAngleDeg / 2);
    // Focus affects edge alpha (0=sharp, 255=diffuse)
    const edgeSharpness = mapRange(focus, 0, 255, 0.12, 0.03);
    // Beam direction unit vector
    const dirX = Math.sin(panAngle);
    const dirY = Math.cos(panAngle);
    // Perpendicular (for cone width)
    const perpX = Math.cos(panAngle);
    const perpY = -Math.sin(panAngle);
    // Full cone half-width at the tip (used for core width calculation)
    const baseHalf = Math.tan(halfCone) * throwLength;
    // Helper: draw a triangle from (x,y) to a point at fraction `t` along the beam,
    // with cone half-width scaled by `t` (cone widens with distance).
    const bodyAlpha = intensity * 0.65;
    const drawBeamTri = (t, alpha) => {
        const endXt = x + dirX * throwLength * t;
        const endYt = y + dirY * throwLength * t;
        const halfW = Math.tan(halfCone) * throwLength * t;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(endXt - perpX * halfW, endYt - perpY * halfW);
        ctx.lineTo(endXt + perpX * halfW, endYt + perpY * halfW);
        ctx.closePath();
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fill();
    };
    // ── LAYER 1: COLOR BODY — 4 stacked triangles (longest→shortest) ──────
    // Matches original gradient stops: 1.0→edge, 0.85→0.20α, 0.5→0.55α, 0→α
    drawBeamTri(1.0, edgeSharpness);
    drawBeamTri(0.85, bodyAlpha * 0.20);
    drawBeamTri(0.50, bodyAlpha * 0.55);
    drawBeamTri(0.20, bodyAlpha);
    // ── LAYER 2: WHITE HOT CORE (20% width) — 3 stacked triangles ─────────
    const coreAlpha = intensity * 0.85;
    const coreHalf = baseHalf * 0.20;
    const drawCoreTri = (t, alpha) => {
        const endXt = x + dirX * throwLength * t;
        const endYt = y + dirY * throwLength * t;
        const halfW = coreHalf * t;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(endXt - perpX * halfW, endYt - perpY * halfW);
        ctx.lineTo(endXt + perpX * halfW, endYt + perpY * halfW);
        ctx.closePath();
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
    };
    // Matches original: 1.0→0, 0.8→0.25α, 0.4→0.65α, 0→α
    drawCoreTri(0.80, coreAlpha * 0.25);
    drawCoreTri(0.40, coreAlpha * 0.65);
    drawCoreTri(0.15, coreAlpha);
}
/**
 * Draw fixture core (solid color center).
 */
function drawCore(ctx, x, y, fixture, baseRadius, beatBoost) {
    const { r, g, b, intensity } = fixture;
    if (intensity < 0.02)
        return;
    const coreRadius = baseRadius * 0.70;
    const coreAlpha = clamp(intensity + 0.25 + beatBoost, 0, 1);
    // Solid color core
    ctx.beginPath();
    ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${coreAlpha})`;
    ctx.fill();
}
/**
 * Draw white hot center point (scales with intensity).
 */
function drawHotCenter(ctx, x, y, fixture, baseRadius) {
    const { intensity } = fixture;
    if (intensity < 0.15)
        return;
    // Size scales with intensity
    const centerRadius = baseRadius * (0.15 + intensity * 0.20);
    ctx.beginPath();
    ctx.arc(x, y, centerRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + intensity * 0.5})`;
    ctx.fill();
}
/**
 * Draw neon rim (always visible, gives identity to off fixtures).
 */
function drawNeonRim(ctx, x, y, fixture, baseRadius) {
    const { r, g, b, intensity } = fixture;
    // Rim is always visible, but brighter when lit
    const rimAlpha = intensity > 0.02 ? 0.6 + intensity * 0.4 : 0.15;
    ctx.beginPath();
    ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${rimAlpha})`;
    ctx.lineWidth = intensity > 0.02 ? 1.5 : 1;
    ctx.stroke();
}
/**
 * Draw off-state fixture (sleeping but present).
 */
function drawOffFixture(ctx, x, y, fixture, baseRadius) {
    const { r, g, b } = fixture;
    // Dark interior
    ctx.beginPath();
    ctx.arc(x, y, baseRadius * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 10, 18, 0.85)';
    ctx.fill();
    // Color rim (memory of the fixture's identity)
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.18)`;
    ctx.lineWidth = 1;
    ctx.stroke();
    // Tiny cyan dot (fixture exists but sleeping)
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 240, 255, 0.20)';
    ctx.fill();
}
// ═══════════════════════════════════════════════════════════════════════════
// MAIN FIXTURE LAYER RENDERER
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Render all fixtures with the full Neon Total pipeline.
 */
export function renderFixtureLayer(ctx, width, height, fixtures, options) {
    const { quality = 'HQ', onBeat = false, beatIntensity = 0, } = options ?? {};
    const isHQ = quality === 'HQ';
    // Calculate base radius
    const minDim = Math.min(width, height);
    const baseRadius = clamp(minDim * FIXTURE_CONFIG.BASE_RADIUS_RATIO, FIXTURE_CONFIG.MIN_RADIUS, FIXTURE_CONFIG.MAX_RADIUS);
    // ⚡ WAVE 2464: Beat reactivity — continuo (0-1), no binario
    // beatIntensity es el beatVisualEnvelope que decae a 60fps en TacticalCanvas.
    // beatScale: 1.0 (sin beat) → 1.08 (beat pleno). Suave, no flash duro.
    // beatBoost: modulado por el envelope para que el core también respire.
    const beatScale = 1.0 + (beatIntensity * (FIXTURE_CONFIG.BEAT_GLOW_SCALE - 1.0));
    const beatBoost = beatIntensity * FIXTURE_CONFIG.BEAT_CORE_BOOST;
    // ── RENDER PASS 1: BEAMS (below everything) ─────────────────────────────
    // Render beams first so halos/cores appear on top
    for (const fixture of fixtures) {
        if (fixture.intensity < 0.02)
            continue;
        const fx = fixture.x * width;
        const fy = fixture.y * height;
        drawBeam(ctx, fx, fy, fixture, height);
    }
    // ── RENDER PASS 2: AURAS (HQ only) ──────────────────────────────────────
    if (isHQ) {
        for (const fixture of fixtures) {
            if (fixture.intensity < 0.35)
                continue;
            const fx = fixture.x * width;
            const fy = fixture.y * height;
            drawAura(ctx, fx, fy, fixture, baseRadius);
        }
    }
    // ── RENDER PASS 3: HALOS ────────────────────────────────────────────────
    for (const fixture of fixtures) {
        const fx = fixture.x * width;
        const fy = fixture.y * height;
        if (fixture.intensity < 0.02) {
            // Off fixture
            drawOffFixture(ctx, fx, fy, fixture, baseRadius);
        }
        else {
            // Lit fixture: halo + core + hot center + rim
            drawHalo(ctx, fx, fy, fixture, baseRadius, beatScale);
            drawCore(ctx, fx, fy, fixture, baseRadius, beatBoost);
            drawHotCenter(ctx, fx, fy, fixture, baseRadius);
            drawNeonRim(ctx, fx, fy, fixture, baseRadius);
        }
    }
}
