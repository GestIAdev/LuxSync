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
 * 🩸 WAVE 7761.5 (Multi-RGB Fase 5): GEOMETRÍA VECTORIAL POR TIPO + LRU.
 *   - fan → hélice de 3 aspas (ambient/air/strobe desagregados)
 *   - moving → diamante direccional (rota con physicalPan)
 *   - laser → barra direccional con núcleo blanco
 *   - default → círculo clásico con borde de contraste mejorado
 *   Todos los sprites: fillStyle sólido (SIN gradientes), cache LRU
 *   estricto (evictLRU reemplaza el vaciado total — el vaciado con 3
 *   sub-zonas mutando era la aritmética exacta del OOM de WAVE 7568),
 *   y las nuevas caches registradas en disposeFixtureLayerSprites().
 *
 * 🩸 WAVE 7761.5.1 (Fase 5.1): REFINAMIENTO VISUAL.
 *   - Chasis apagado: drawOffFixture despacha por tipo a sprites OFF
 *     (getOffHelixSprite/getOffDiamondSprite/getOffLaserSprite). Relleno
 *     oscuro rgba(20,20,25,0.8) + trazo visible rgba(255,255,255,0.3) —
 *     el contraste vive en el OFF, no en el ON.
 *   - Estado encendido: SIN strokes. Color puro sin bordes — cuando hay
 *     luz, el halo aporta el contraste, no el borde.
 *   - Hélice rediseñada: firma (hubColor, bladesColor). Núcleo = Air,
 *     aspas = Ambient. Diferencia el motor del ventilador de las aspas.
 *   - Diamante/laser OFF rotados por physicalPan (coherencia direccional).
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
const GLOW_SPRITE_SIZE = 128;
const BEAM_SPRITE_W = 64;
const BEAM_SPRITE_H = 256;
// 🩸 WAVE 7761.5 (Multi-RGB Fase 5): raised 64 → 192. Con 3 sub-zonas RGB
// por fan mutando independientemente (RaveX: dientes de sierra a 44Hz), las
// claves únicas por frame se triplican. 64 era el mundo de 1 color/fixture.
// Memoria acotada: 192 × 128×128×4B ≈ 12.6 MB peor caso por cache — aceptable
// frente al OOM que causaba el vaciado total (ver evictLRU).
const SPRITE_CACHE_LIMIT = 192;
// 🩸 WAVE 7761.5: cuantización 8 → 16. Triplicar los orígenes de color exige
// colapsar más agresivo los fades: 256 → ~16 niveles/canal. Indistinguible
// a profundidad de 8 bits en vista táctica; mantiene las claves únicas bajo
// control sin sacrificar el LRU.
const COLOR_QUANT_STEP = 16;
// ── WAVE 7761.5: geometría vectorial por tipo (Zero-Alloc, sin gradientes) ──
const HELIX_SPRITE_SIZE = 96; // fan: 3 aspas (ambient/air/strobe)
// 🩸 WAVE 7761.5.1: 64 → 80 para alojar vértices +38.5% (rr = c-4 = 36).
// El diamante ahora ocupa área visual similar al círculo de un PAR.
const DIAMOND_SPRITE_SIZE = 80; // mover: rombo direccional
const LASER_SPRITE_W = 96; // laser: barra direccional
const LASER_SPRITE_H = 32;
const glowSpriteCache = new Map();
const beamSpriteCache = new Map();
const helixSpriteCache = new Map();
const diamondSpriteCache = new Map();
const laserBarSpriteCache = new Map();
// 🩸 WAVE 7761.5.1: sprites OFF — singletons color-independent (relleno oscuro
// uniforme). No necesitan LRU: hay exactamente uno por tipo. Se cierran en
// disposeFixtureLayerSprites como los demás.
let offHelixSprite = null;
let offDiamondSprite = null;
let offLaserSprite = null;
/**
 * 🩸 WAVE 7761.5: LRU TOUCH — on cache hit, refresh insertion order
 * (Map preserva orden de inserción = orden de uso). Convierte la política
 * FIFO en LRU estricto: lo más recientemente usado sobrevive a la eviction.
 * Coste: delete+set por hit — trivial para V8 (~60k ops/s peor caso).
 */
function cacheGet(cache, key) {
    const cached = cache.get(key);
    if (cached) {
        cache.delete(key);
        cache.set(key, cached);
    }
    return cached;
}
/**
 * 🩸 WAVE 7761.5: EVICCIÓN LRU ESTRICTA — reemplaza el vaciado total de
 * WAVE 7749.25. El vaciado completo (`for…close(); clear()`) era la
 * aritmética exacta del OOM de Oilpan (WAVE 7568): con >64 claves únicas
 * por frame (3 sub-zonas mutando), el cache se vaciaba CADA frame y cada
 * drawImage volvía a exigir new OffscreenCanvas + createRadialGradient +
 * 5 addColorStop. LRU: evicta solo los más viejos hasta bajar del límite;
 * los calientes (colores dominantes del show) nunca se re-rasterizan.
 * 🛡️ WAVE 7713: .close() libera la textura GPU sincrónamente.
 */
function evictLRU(cache) {
    while (cache.size >= SPRITE_CACHE_LIMIT) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined)
            break;
        const sprite = cache.get(oldest);
        cache.delete(oldest);
        try {
            sprite.close();
        }
        catch { }
    }
}
/**
 * 🩸 WAVE 7749.25: Quantize RGB to the nearest COLOR_QUANT_STEP boundary.
 * Reduces unique sprite keys during color fades (256 → ~32 per channel),
 * preventing the sprite cache from churning through transient colors.
 */
function quantizeColor(r, g, b) {
    return {
        r: Math.round(r / COLOR_QUANT_STEP) * COLOR_QUANT_STEP,
        g: Math.round(g / COLOR_QUANT_STEP) * COLOR_QUANT_STEP,
        b: Math.round(b / COLOR_QUANT_STEP) * COLOR_QUANT_STEP,
    };
}
/**
 * Build a radial gradient glow sprite (white-hot center → color → transparent edge).
 * Cached per color string. Used for both aura and halo (scaled differently).
 */
function getGlowSprite(r, g, b) {
    // 🩸 WAVE 7749.25: Quantize color so fades collapse into fewer cache keys.
    const q = quantizeColor(r, g, b);
    const colorKey = `rgb(${q.r},${q.g},${q.b})`;
    const cached = cacheGet(glowSpriteCache, colorKey);
    if (cached)
        return cached;
    // 🩸 WAVE 7761.5: LRU estricto — evicta los más viejos, NO vaciado total.
    evictLRU(glowSpriteCache);
    const sprite = new OffscreenCanvas(GLOW_SPRITE_SIZE, GLOW_SPRITE_SIZE);
    const sctx = sprite.getContext('2d');
    const cx = GLOW_SPRITE_SIZE / 2;
    const cy = GLOW_SPRITE_SIZE / 2;
    const grad = sctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
    // White-hot center → solid color → transparent edge
    grad.addColorStop(0.0, `rgba(255, 255, 255, 1.0)`);
    grad.addColorStop(0.15, `rgba(${q.r}, ${q.g}, ${q.b}, 0.9)`);
    grad.addColorStop(0.40, `rgba(${q.r}, ${q.g}, ${q.b}, 0.4)`);
    grad.addColorStop(0.70, `rgba(${q.r}, ${q.g}, ${q.b}, 0.10)`);
    grad.addColorStop(1.0, `rgba(${q.r}, ${q.g}, ${q.b}, 0)`);
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, GLOW_SPRITE_SIZE, GLOW_SPRITE_SIZE);
    glowSpriteCache.set(colorKey, sprite);
    return sprite;
}
/**
 * Build a linear gradient beam sprite (bright at top → transparent at bottom).
 * Cached per color string. Stamped and rotated/scaled for beam cones.
 */
function getBeamSprite(r, g, b) {
    // 🩸 WAVE 7749.25: Quantize color so fades collapse into fewer cache keys.
    const q = quantizeColor(r, g, b);
    const colorKey = `rgb(${q.r},${q.g},${q.b})`;
    const cached = cacheGet(beamSpriteCache, colorKey);
    if (cached)
        return cached;
    // 🩸 WAVE 7761.5: LRU estricto — evicta los más viejos, NO vaciado total.
    evictLRU(beamSpriteCache);
    const sprite = new OffscreenCanvas(BEAM_SPRITE_W, BEAM_SPRITE_H);
    const sctx = sprite.getContext('2d');
    const grad = sctx.createLinearGradient(0, 0, 0, BEAM_SPRITE_H);
    // Bright at top (fixture source) → transparent at bottom (beam tip)
    grad.addColorStop(0.0, `rgba(${q.r}, ${q.g}, ${q.b}, 1.0)`);
    grad.addColorStop(0.15, `rgba(${q.r}, ${q.g}, ${q.b}, 0.85)`);
    grad.addColorStop(0.50, `rgba(${q.r}, ${q.g}, ${q.b}, 0.40)`);
    grad.addColorStop(0.85, `rgba(${q.r}, ${q.g}, ${q.b}, 0.08)`);
    grad.addColorStop(1.0, `rgba(${q.r}, ${q.g}, ${q.b}, 0)`);
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, BEAM_SPRITE_W, BEAM_SPRITE_H);
    beamSpriteCache.set(colorKey, sprite);
    return sprite;
}
// ═══════════════════════════════════════════════════════════════════════════
// 🩸 WAVE 7761.5 (Multi-RGB Fase 5): GEOMETRÍA VECTORIAL POR TIPO
//
// Primitivas pre-renderizadas en OffscreenCanvas, SIN createRadialGradient ni
// createLinearGradient — solo fillStyle sólido + strokeStyle. El cache por
// color cuantizado mantiene el contrato Oilpan-cero-allocs del hot loop
// (WAVE 7568/7571): los paths se rasterizan UNA vez por combinación de color
// y se estampan con drawImage a 60fps.
//
// REGLA DE CONTRASTE: toda geometría sólida lleva contorno blanco 0.4 para
// no perderse en el fondo oscuro del canvas (rgba(255,255,255,0.4), 1.5px).
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🩸 WAVE 7761.6.1 (Fase 6.1): Fallback legacy protegido.
 *
 * NO hace fallback per-channel a Master RGB. TickEngine resetea las sub-zonas
 * a 0 cada frame, asi que 0 significa "Negro" (canal apagado), no "usa master".
 *
 * El fallback SOLO activa cuando las TRES sub-zonas (Ambient, Air, Strobe)
 * estan exactamente a 0 PERO el Master RGB es > 0. Esto protege a los fixtures
 * legacy que no usan celdas Aether (su master es la unica fuente de color).
 *
 * @param allZero true si las tres sub-zonas estan a 0 (precomputado por el caller)
 * @param masterValor el valor del canal maestro (r, g o b)
 */
function zoneColorOrFallback(zoneV, allZero, masterV) {
    if (!allZero) {
        // Al menos una sub-zona tiene color → usar el valor crudo de la sub-zona
        // (0 = negro legitimo, no fallback)
        return (zoneV !== undefined && Number.isFinite(zoneV)) ? zoneV : 0;
    }
    // Todas las sub-zonas a 0 → fallback a master SOLO si master > 0 (legacy)
    return masterV > 0 ? masterV : 0;
}
/**
 * HÉLICE DE 3 ASPAS (fan — ej. Tungsten). Núcleo central (hub) relleno con
 * hubColor, 3 aspas a su alrededor rellenas con bladesColor. Gaps de 15%
 * entre aspas para el look mecánico de ventilador.
 *
 * 🩸 WAVE 7761.5.1: firma cambiada de (3 colores) a (hub, blades). El
 * Tungsten no tiene 3 sub-zonas de color distinto — tiene un núcleo (air)
 * y aspas (ambient). Sin strokes: cuando hay luz, color puro sin bordes.
 */
function getHelixSprite(hubR, hubG, hubB, bladeR, bladeG, bladeB) {
    const qh = quantizeColor(hubR, hubG, hubB);
    const qb = quantizeColor(bladeR, bladeG, bladeB);
    const key = `h|${qh.r},${qh.g},${qh.b}|${qb.r},${qb.g},${qb.b}`;
    const cached = cacheGet(helixSpriteCache, key);
    if (cached)
        return cached;
    evictLRU(helixSpriteCache);
    const sprite = new OffscreenCanvas(HELIX_SPRITE_SIZE, HELIX_SPRITE_SIZE);
    const sctx = sprite.getContext('2d');
    const c = HELIX_SPRITE_SIZE / 2;
    const radius = c - 6;
    const bladeSpan = (Math.PI * 2 / 3) * 0.85; // 102° por aspa, 18° de gap
    const bladeColor = `rgb(${qb.r}, ${qb.g}, ${qb.b})`;
    // 🩸 WAVE 7761.5.4: aspas primero, hub después y 100% opaco.
    // El hub se pinta encima para que el núcleo sea visible incluso si
    // las aspas están apagadas (color 0). Sin gradientes ni transparencias.
    for (let i = 0; i < 3; i++) {
        const start = (Math.PI * 2 / 3) * i - Math.PI / 2;
        sctx.beginPath();
        sctx.moveTo(c, c);
        sctx.arc(c, c, radius, start, start + bladeSpan);
        sctx.closePath();
        sctx.fillStyle = bladeColor;
        sctx.fill();
    }
    // Hub central (núcleo) — pinta encima de las aspas, alpha = 1.0 explícito.
    sctx.globalAlpha = 1;
    sctx.beginPath();
    sctx.arc(c, c, radius * 0.32, 0, Math.PI * 2);
    sctx.fillStyle = `rgb(${qh.r}, ${qh.g}, ${qh.b})`;
    sctx.fill();
    helixSpriteCache.set(key, sprite);
    return sprite;
}
/**
 * DIAMANTE DIRECCIONAL (mover). Rombo sólido con borde. Se estampa rotado
 * por physicalPan en drawDiamondFixture — apunta hacia donde mira el beam.
 */
function getDiamondSprite(r, g, b) {
    const q = quantizeColor(r, g, b);
    const key = `d|${q.r},${q.g},${q.b}`;
    const cached = cacheGet(diamondSpriteCache, key);
    if (cached)
        return cached;
    evictLRU(diamondSpriteCache);
    const sprite = new OffscreenCanvas(DIAMOND_SPRITE_SIZE, DIAMOND_SPRITE_SIZE);
    const sctx = sprite.getContext('2d');
    const c = DIAMOND_SPRITE_SIZE / 2;
    // 🩸 WAVE 7761.5.1: rr = c-4 = 36 (era c-6 = 26 con sprite 64). Vértices
    // +38.5% para que el diamante ocupe área visual similar al círculo PAR.
    const rr = c - 4;
    sctx.beginPath();
    sctx.moveTo(c, c - rr); // punta superior (dirección del beam)
    sctx.lineTo(c + rr * 0.7, c); // derecha
    sctx.lineTo(c, c + rr); // inferior
    sctx.lineTo(c - rr * 0.7, c); // izquierda
    sctx.closePath();
    sctx.fillStyle = `rgb(${q.r}, ${q.g}, ${q.b})`;
    sctx.fill();
    // 🩸 WAVE 7761.5.1: sin stroke cuando hay luz — color puro sin bordes.
    diamondSpriteCache.set(key, sprite);
    return sprite;
}
/**
 * BARRA LÁSER (laser). Rectángulo grueso redondeado con núcleo central
 * blanco brillante — la firma visual del láser. Se estampa rotada por
 * physicalPan en drawLaserFixture.
 */
function getLaserBarSprite(r, g, b) {
    const q = quantizeColor(r, g, b);
    const key = `l|${q.r},${q.g},${q.b}`;
    const cached = cacheGet(laserBarSpriteCache, key);
    if (cached)
        return cached;
    evictLRU(laserBarSpriteCache);
    const sprite = new OffscreenCanvas(LASER_SPRITE_W, LASER_SPRITE_H);
    const sctx = sprite.getContext('2d');
    const pad = 5;
    const barH = LASER_SPRITE_H - pad * 2;
    sctx.beginPath();
    sctx.roundRect(pad, pad, LASER_SPRITE_W - pad * 2, barH, barH / 2);
    sctx.fillStyle = `rgb(${q.r}, ${q.g}, ${q.b})`;
    sctx.fill();
    // 🩸 WAVE 7761.5.1: sin stroke exterior cuando hay luz — color puro.
    // Núcleo central blanco — el "haz" del láser (esto es firma visual, no borde)
    sctx.beginPath();
    sctx.moveTo(pad * 2, LASER_SPRITE_H / 2);
    sctx.lineTo(LASER_SPRITE_W - pad * 2, LASER_SPRITE_H / 2);
    sctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    sctx.lineWidth = 2;
    sctx.lineCap = 'round';
    sctx.stroke();
    laserBarSpriteCache.set(key, sprite);
    return sprite;
}
// ═══════════════════════════════════════════════════════════════════════════
// 🩸 WAVE 7761.5.1: SPRITES OFF — chasis apagados por tipo.
// Relleno muy oscuro rgba(20,20,25,0.8) + trazo visible rgba(255,255,255,0.3)
// 1.5px para que no se pierdan en el fondo oscuro del canvas. Singletons: no
// dependen del color (siempre oscuros), así que no hay cache por color.
// ═══════════════════════════════════════════════════════════════════════════
const OFF_FILL = 'rgba(20, 20, 25, 0.8)';
const OFF_STROKE = 'rgba(255, 255, 255, 0.3)';
const OFF_LINE_WIDTH = 1.5;
function getOffHelixSprite() {
    if (offHelixSprite)
        return offHelixSprite;
    const sprite = new OffscreenCanvas(HELIX_SPRITE_SIZE, HELIX_SPRITE_SIZE);
    const sctx = sprite.getContext('2d');
    const c = HELIX_SPRITE_SIZE / 2;
    const radius = c - 6;
    const bladeSpan = (Math.PI * 2 / 3) * 0.85;
    for (let i = 0; i < 3; i++) {
        const start = (Math.PI * 2 / 3) * i - Math.PI / 2;
        sctx.beginPath();
        sctx.moveTo(c, c);
        sctx.arc(c, c, radius, start, start + bladeSpan);
        sctx.closePath();
        sctx.fillStyle = OFF_FILL;
        sctx.fill();
        sctx.strokeStyle = OFF_STROKE;
        sctx.lineWidth = OFF_LINE_WIDTH;
        sctx.stroke();
    }
    sctx.beginPath();
    sctx.arc(c, c, radius * 0.32, 0, Math.PI * 2);
    sctx.fillStyle = OFF_FILL;
    sctx.fill();
    sctx.strokeStyle = OFF_STROKE;
    sctx.lineWidth = OFF_LINE_WIDTH;
    sctx.stroke();
    offHelixSprite = sprite;
    return sprite;
}
function getOffDiamondSprite() {
    if (offDiamondSprite)
        return offDiamondSprite;
    const sprite = new OffscreenCanvas(DIAMOND_SPRITE_SIZE, DIAMOND_SPRITE_SIZE);
    const sctx = sprite.getContext('2d');
    const c = DIAMOND_SPRITE_SIZE / 2;
    // 🩸 WAVE 7761.5.1: mismos vértices +38.5% que el sprite encendido.
    const rr = c - 4;
    sctx.beginPath();
    sctx.moveTo(c, c - rr);
    sctx.lineTo(c + rr * 0.7, c);
    sctx.lineTo(c, c + rr);
    sctx.lineTo(c - rr * 0.7, c);
    sctx.closePath();
    sctx.fillStyle = OFF_FILL;
    sctx.fill();
    sctx.strokeStyle = OFF_STROKE;
    sctx.lineWidth = OFF_LINE_WIDTH;
    sctx.stroke();
    offDiamondSprite = sprite;
    return sprite;
}
function getOffLaserSprite() {
    if (offLaserSprite)
        return offLaserSprite;
    const sprite = new OffscreenCanvas(LASER_SPRITE_W, LASER_SPRITE_H);
    const sctx = sprite.getContext('2d');
    const pad = 5;
    const barH = LASER_SPRITE_H - pad * 2;
    sctx.beginPath();
    sctx.roundRect(pad, pad, LASER_SPRITE_W - pad * 2, barH, barH / 2);
    sctx.fillStyle = OFF_FILL;
    sctx.fill();
    sctx.strokeStyle = OFF_STROKE;
    sctx.lineWidth = OFF_LINE_WIDTH;
    sctx.stroke();
    offLaserSprite = sprite;
    return sprite;
}
// ═══════════════════════════════════════════════════════════════════════════
// 🩸 WAVE 7749.25: SPRITE CACHE TEARDOWN — release GPU/CPU memory on SHUTDOWN.
// Called from the render worker's SHUTDOWN handler so orphaned workers (HMR)
// don't leak OffscreenCanvas sprite textures. Each sprite holds a GPU texture;
// .close() releases it synchronously instead of waiting for GC.
// ═══════════════════════════════════════════════════════════════════════════
export function disposeFixtureLayerSprites() {
    for (const sprite of glowSpriteCache.values()) {
        try {
            sprite.close();
        }
        catch { }
    }
    glowSpriteCache.clear();
    for (const sprite of beamSpriteCache.values()) {
        try {
            sprite.close();
        }
        catch { }
    }
    beamSpriteCache.clear();
    // 🩸 WAVE 7761.5: geometría vectorial por tipo — mismos registros de teardown.
    for (const sprite of helixSpriteCache.values()) {
        try {
            sprite.close();
        }
        catch { }
    }
    helixSpriteCache.clear();
    for (const sprite of diamondSpriteCache.values()) {
        try {
            sprite.close();
        }
        catch { }
    }
    diamondSpriteCache.clear();
    for (const sprite of laserBarSpriteCache.values()) {
        try {
            sprite.close();
        }
        catch { }
    }
    laserBarSpriteCache.clear();
    // 🩸 WAVE 7761.5.1: sprites OFF singletons — mismo teardown.
    if (offHelixSprite) {
        try {
            offHelixSprite.close();
        }
        catch { }
        offHelixSprite = null;
    }
    if (offDiamondSprite) {
        try {
            offDiamondSprite.close();
        }
        catch { }
        offDiamondSprite = null;
    }
    if (offLaserSprite) {
        try {
            offLaserSprite.close();
        }
        catch { }
        offLaserSprite = null;
    }
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
function drawAura(ctx, x, y, fixture, baseRadius) {
    const { r, g, b, intensity } = fixture;
    // Only draw for bright fixtures
    if (intensity < 0.35)
        return;
    const auraRadius = baseRadius * FIXTURE_CONFIG.AURA_RADIUS * (0.8 + intensity * 0.4);
    const alpha = intensity * 0.12;
    // Stamp the cached glow sprite, scaled to aura diameter
    const sprite = getGlowSprite(r, g, b);
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - auraRadius, y - auraRadius, auraRadius * 2, auraRadius * 2);
    ctx.globalAlpha = prevAlpha;
}
/**
 * Draw neon halo (main glow effect).
 *
 * 🎨 WAVE 7571: Uses pre-rendered glow sprite (cached per color).
 * Two passes: outer diffuse glow + inner sharp ring, both via drawImage.
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
    const sprite = getGlowSprite(r, g, b);
    const prevAlpha = ctx.globalAlpha;
    // ── Pass 1: Diffuse outer glow ──────────────────────────────────────
    ctx.globalAlpha = outerAlpha;
    ctx.drawImage(sprite, x - haloRadius, y - haloRadius, haloRadius * 2, haloRadius * 2);
    // ── Pass 2: Sharp inner ring (neon edge) ────────────────────────────
    const innerRadius = haloRadius * 0.35;
    const innerAlpha = intensity * 0.25;
    ctx.globalAlpha = innerAlpha;
    ctx.drawImage(sprite, x - innerRadius, y - innerRadius, innerRadius * 2, innerRadius * 2);
    ctx.globalAlpha = prevAlpha;
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
function drawBeam(ctx, x, y, fixture, canvasHeight) {
    const { r, g, b, intensity, physicalPan, physicalTilt, zoom, focus, type } = fixture;
    // Only movers get beams. Fans (Tungsten) son atmosféricos — no proyectan
    // cono direccional (WAVE 7761.5).
    if (type === 'par' || type === 'wash' || type === 'fan' || intensity < 0.03)
        return;
    // Pan angle: 0→ +45°, 0.5→ 0°, 1→ -45°
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
    // Full cone half-width at the tip
    const baseHalf = Math.tan(halfCone) * throwLength;
    // ── LAYER 1: COLOR BODY — clip cone + drawImage beam sprite ──────────
    const bodyAlpha = intensity * 0.65;
    const sprite = getBeamSprite(r, g, b);
    const prevAlpha = ctx.globalAlpha;
    ctx.save();
    // Clip to the full cone triangle
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dirX * throwLength - perpX * baseHalf, y + dirY * throwLength - perpY * baseHalf);
    ctx.lineTo(x + dirX * throwLength + perpX * baseHalf, y + dirY * throwLength + perpY * baseHalf);
    ctx.closePath();
    ctx.clip();
    // Stamp the beam sprite: stretch to throw length × 2× cone width
    // Position so the top of the sprite (bright end) is at the fixture (x, y)
    ctx.globalAlpha = bodyAlpha;
    ctx.translate(x, y);
    ctx.rotate(panAngle);
    // After rotation, draw the sprite downward from origin
    // Width = 2 × baseHalf (covers full cone), Height = throwLength
    ctx.drawImage(sprite, -baseHalf, 0, baseHalf * 2, throwLength);
    ctx.restore();
    // ── LAYER 2: WHITE HOT CORE (20% width) — same technique, white sprite ──
    const coreAlpha = intensity * 0.85;
    const coreHalf = baseHalf * 0.20;
    const coreSprite = getBeamSprite(255, 255, 255);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dirX * throwLength - perpX * coreHalf, y + dirY * throwLength - perpY * coreHalf);
    ctx.lineTo(x + dirX * throwLength + perpX * coreHalf, y + dirY * throwLength + perpY * coreHalf);
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = coreAlpha;
    ctx.translate(x, y);
    ctx.rotate(panAngle);
    ctx.drawImage(coreSprite, -coreHalf, 0, coreHalf * 2, throwLength);
    ctx.restore();
    ctx.globalAlpha = prevAlpha;
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
    // 🩸 WAVE 7761.5.1: sin stroke cuando hay luz — color puro sin bordes.
    // El contraste lo aporta el halo (drawHalo) alrededor, no el borde.
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
 * 🩸 WAVE 7761.5.1: switch por tipo — estampa el sprite OFF correspondiente
 * en lugar del círculo genérico aburrido. El diamante se rota por physicalPan
 * para apuntar en la misma dirección que el beam cuando se encienda.
 */
function drawOffFixture(ctx, x, y, fixture, baseRadius, frameTime) {
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = 1;
    switch (fixture.type) {
        case 'fan': {
            const sprite = getOffHelixSprite();
            const size = baseRadius * 2.8;
            // 🩸 WAVE 7761.6.2: WYSIWYG absoluto — el chasis apagado también gira
            // con el control manual del usuario. Misma matemática que drawHelixFixture:
            // speed = (rotation - 128) / 127, angle = speed * (frameTime / 150).
            const speed = ((fixture.rotation ?? 128) - 128) / 127;
            const angle = speed * (frameTime / 150);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
            ctx.restore();
            break;
        }
        case 'moving': {
            const sprite = getOffDiamondSprite();
            // 🩸 WAVE 7761.5.1: stamp 2.0 → 2.4 (paridad con el diamante encendido).
            const size = baseRadius * 2.4;
            const panAngle = mapRange(fixture.physicalPan, 0, 1, -Math.PI * 0.45, Math.PI * 0.45);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(panAngle);
            ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
            ctx.restore();
            break;
        }
        case 'laser': {
            const sprite = getOffLaserSprite();
            const w = baseRadius * 3.4;
            const h = baseRadius * 1.1;
            const panAngle = mapRange(fixture.physicalPan, 0, 1, -Math.PI * 0.45, Math.PI * 0.45);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(panAngle);
            ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
            ctx.restore();
            break;
        }
        default: {
            // par / wash / strobe / unknown — círculo oscuro con borde de contraste
            ctx.beginPath();
            ctx.arc(x, y, baseRadius * 0.85, 0, Math.PI * 2);
            ctx.fillStyle = OFF_FILL;
            ctx.fill();
            ctx.strokeStyle = OFF_STROKE;
            ctx.lineWidth = OFF_LINE_WIDTH;
            ctx.stroke();
        }
    }
    // Tiny cyan dot (fixture exists but sleeping) — común a todos los tipos
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 240, 255, 0.20)';
    ctx.fill();
    ctx.globalAlpha = prevAlpha;
}
// ═══════════════════════════════════════════════════════════════════════════
// 🩸 WAVE 7761.5 (Multi-RGB Fase 5): TYPE-DISPATCHED VECTOR DRAW FUNCTIONS
// Sustituyen a drawCore + drawNeonRim cuando el tipo tiene geometría propia.
// Todas estampan sprites cacheados con drawImage — zero-alloc en el hot loop.
// ═══════════════════════════════════════════════════════════════════════════
/**
 * FAN — hélice de 3 aspas. Hub = sub-zona Air, aspas = sub-zona Ambient.
 * La separación núcleo/aspa diferencia visualmente el motor del ventilador
 * de las aspas que giran.
 * 🩸 WAVE 7761.5.1: firma cambiada a (hub, blades).
 * 🩸 WAVE 7761.6.1 (Fase 6.1): fallback legacy protegido — solo usa Master
 * RGB si las TRES sub-zonas estan a 0 Y master > 0. Rotación continua
 * (velocidad, no ángulo absoluto) usando timestamp del frame.
 */
function drawHelixFixture(ctx, x, y, fixture, baseRadius, beatBoost, frameTime) {
    const { r, g, b, intensity } = fixture;
    if (intensity < 0.02)
        return;
    // 🩸 WAVE 7761.6.1: Fallback legacy protegido.
    // TickEngine resetea las sub-zonas a 0 cada frame → 0 = negro legitimo.
    // Solo hacemos fallback a Master RGB si TODAS las sub-zonas estan a 0
    // Y el Master RGB es > 0 (fixture legacy sin celdas Aether).
    const allZonesZero = (fixture.rAmbient ?? 0) === 0 && (fixture.gAmbient ?? 0) === 0 && (fixture.bAmbient ?? 0) === 0 &&
        (fixture.rAir ?? 0) === 0 && (fixture.gAir ?? 0) === 0 && (fixture.bAir ?? 0) === 0 &&
        (fixture.rStrobe ?? 0) === 0 && (fixture.gStrobe ?? 0) === 0 && (fixture.bStrobe ?? 0) === 0;
    // Hub = Air (núcleo del ventilador), aspas = Ambient (lo que gira)
    const hubR = zoneColorOrFallback(fixture.rAir, allZonesZero, r);
    const hubG = zoneColorOrFallback(fixture.gAir, allZonesZero, g);
    const hubB = zoneColorOrFallback(fixture.bAir, allZonesZero, b);
    const bladeR = zoneColorOrFallback(fixture.rAmbient, allZonesZero, r);
    const bladeG = zoneColorOrFallback(fixture.gAmbient, allZonesZero, g);
    const bladeB = zoneColorOrFallback(fixture.bAmbient, allZonesZero, b);
    const sprite = getHelixSprite(hubR, hubG, hubB, bladeR, bladeG, bladeB);
    const size = baseRadius * 2.8;
    const alpha = clamp(intensity + 0.25 + beatBoost, 0, 1);
    // 🩸 WAVE 7761.6.1 (Fase 6.1): Rotación CONTINUA (velocidad, no ángulo).
    // rotation es 0-255 DMX (128 = stop). La desviación respecto al centro
    // determina la velocidad y dirección del giro continuo.
    // speed > 0 = CW, speed < 0 = CCW, speed = 0 = parado.
    // angle = speed * (timeValue / 150) — acumulación temporal continua.
    const rotValue = fixture.rotation ?? 128;
    const speed = (rotValue - 128) / 127; // [-1, 1]: -1=max CCW, 0=stop, +1=max CW
    const angle = speed * (frameTime / 150);
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    ctx.restore();
    ctx.globalAlpha = prevAlpha;
}
/**
 * MOVER — diamante direccional. Rotado por physicalPan: la punta superior
 * apunta hacia donde mira el beam cone (drawBeam sigue dibujando el cono).
 */
function drawDiamondFixture(ctx, x, y, fixture, baseRadius, beatBoost) {
    const { r, g, b, intensity, physicalPan } = fixture;
    if (intensity < 0.02)
        return;
    const sprite = getDiamondSprite(r, g, b);
    // 🩸 WAVE 7761.5.1: stamp 2.0 → 2.4. Combinado con vértices +38.5% en
    // el sprite, el diamante alcanza área on-canvas ≈ círculo PAR (1.63·br²
    // vs 1.54·br²). Solo vértices no basta: rr/sprite ≤ 0.5 (clipping).
    const size = baseRadius * 2.4;
    const alpha = clamp(intensity + 0.25 + beatBoost, 0, 1);
    const panAngle = mapRange(physicalPan, 0, 1, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(panAngle);
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    ctx.restore();
}
/**
 * LASER — barra direccional con núcleo blanco. Rotada por physicalPan
 * (misma convención de ángulo que el beam cone).
 */
function drawLaserFixture(ctx, x, y, fixture, baseRadius, beatBoost) {
    const { r, g, b, intensity, physicalPan } = fixture;
    if (intensity < 0.02)
        return;
    const sprite = getLaserBarSprite(r, g, b);
    const w = baseRadius * 3.4;
    const h = baseRadius * 1.1;
    const alpha = clamp(intensity + 0.25 + beatBoost, 0, 1);
    const panAngle = mapRange(physicalPan, 0, 1, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(panAngle);
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
    ctx.restore();
}
// ═══════════════════════════════════════════════════════════════════════════
// MAIN FIXTURE LAYER RENDERER
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Render all fixtures with the full Neon Total pipeline.
 */
export function renderFixtureLayer(ctx, width, height, fixtures, options) {
    const { quality = 'HQ', onBeat = false, beatIntensity = 0, frameTime = 0, } = options ?? {};
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
        // 🩸 WAVE 7761.6.2: Despertar por color — la UI se enciende si hay dimmer
        // O si hay color en las sub-zonas (air, ambient, strobe). El Beam central
        // puede iluminarse con su color puro sin depender del dimmer del Washer.
        const isLit = fixture.intensity > 0.02 ||
            (fixture.rAir ?? 0) > 0 || (fixture.gAir ?? 0) > 0 || (fixture.bAir ?? 0) > 0 ||
            (fixture.rAmbient ?? 0) > 0 || (fixture.gAmbient ?? 0) > 0 || (fixture.bAmbient ?? 0) > 0 ||
            (fixture.rStrobe ?? 0) > 0 || (fixture.gStrobe ?? 0) > 0 || (fixture.bStrobe ?? 0) > 0;
        if (!isLit) {
            // Off fixture
            drawOffFixture(ctx, fx, fy, fixture, baseRadius, frameTime);
        }
        else {
            // Lit fixture: halo + geometría por tipo + hot center
            drawHalo(ctx, fx, fy, fixture, baseRadius, beatScale);
            // 🩸 WAVE 7761.5 (Multi-RGB Fase 5): despacho de geometría vectorial
            // por tipo. Reemplaza drawCore + drawNeonRim cuando el tipo tiene
            // primitiva propia; default conserva el comportamiento circular
            // clásico (con el borde de contraste mejorado).
            switch (fixture.type) {
                case 'fan':
                    drawHelixFixture(ctx, fx, fy, fixture, baseRadius, beatBoost, frameTime);
                    break;
                case 'moving':
                    drawDiamondFixture(ctx, fx, fy, fixture, baseRadius, beatBoost);
                    break;
                case 'laser':
                    drawLaserFixture(ctx, fx, fy, fixture, baseRadius, beatBoost);
                    break;
                default:
                    drawCore(ctx, fx, fy, fixture, baseRadius, beatBoost);
                    drawNeonRim(ctx, fx, fy, fixture, baseRadius);
            }
            // 🩸 WAVE 7761.5.3: hot center solo para fixtures sin geometría propia.
            // fan/moving/laser tienen su propia firma visual (hélice/diamante/barra)
            // — el punto blanco genérico tapa el color real del hub del Tungsten.
            if (fixture.type !== 'fan' && fixture.type !== 'moving' && fixture.type !== 'laser') {
                drawHotCenter(ctx, fx, fy, fixture, baseRadius);
            }
        }
    }
}
