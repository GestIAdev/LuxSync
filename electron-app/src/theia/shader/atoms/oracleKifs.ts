/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔮 WAVE 8230 — EUCLID ORACLE · Fase E4: ORACLE KIFS (átomo generativo)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Shader de referencia del blueprint §5: raymarcher de un fractal KIFS
 * (Kaleidoscopic Iterated Function System) — pliegues de simetría +
 * escalado iterado, cada parámetro atado a un motor:
 *
 *   u_morphFactor    → complejidad del fractal (Omniliquid)
 *   u_beatTime       → rotación global en rejilla de beats (PLL)
 *   u_kickPulse      → empuje de cámara + pulso emisivo (kick)
 *   u_beatPhase/barPhase → torsión/compresión/FOV basal (reloj BPM, §3.4)
 *   u_activeEffectEnergy → expansión radial + destello SOLO con clip
 *                          físico vivo — paridad video↔luces (WAVE 8287)
 *   u_chromaHue      → paleta desde la tonalidad (ChromaCoupler)
 *   glitch (euCh.)   → glitch de línea solo en APOCALYPSE (§3.5)
 *   u_hihatEnergy    → destellos especulares granulares
 *   u_lqAmbient/subBass → niebla que respira
 *
 * 🧬 WAVE 8237 · G6 + 🔫 WAVE 8287 · Clean Shot — los canales se toman de
 * `euChannels()` (preámbulo §3.1): tc/td fueron extirpados — la aproximación
 * cognitiva (u_approach/u_impact) ya no gobierna geometría; el movimiento
 * base vive en el reloj musical y los bursts en la envolvente del efecto.
 *
 * El cuerpo es verbatim §5 del EUCLID_ORACLE_BLUEPRINT — el ensamblador
 * E3 le inyecta preámbulo + epílogo de seguridad.
 *
 * Registrado como átomo `source.kind='shader'` (propuesta Hybrid Deck):
 * el mismo ADN de genoma/zona que un `.theia` de vídeo — Selene/Cassandra
 * no distinguen el medio.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { ITheiaAtom } from '../../../types/theiaTypes'
import { parseEuclidMeta } from '../ShaderAssembler'

export const EUCLID_PACK_ID = 'euclid-oracle'
export const ORACLE_KIFS_ATOM_ID = 'oracle_kifs'
export const ORACLE_KIFS_LABEL = 'Oracle KIFS'

/**
 * Cuerpo GLSL del artista — verbatim blueprint §5 (hello-world generativo).
 * El preámbulo ya declara: u_time, u_resolution, u_tel[] + macros,
 * u_beatTime, u_beatPhase, u_barPhase, u_kickPulse, u_activeEffectEnergy,
 * telFlag(), rot2(), palette(), hash21(), noise3(), MAX_STEPS.
 */
export const ORACLE_KIFS_SOURCE = `// @euclid name    "Oracle KIFS — Hello World Generativo"
// @euclid author  "LuxSync"
// @euclid genome  aggression=0.55 chaos=0.60 organicity=0.45
// @euclid zone    gentle..peak
// @euclid param   u_twist float 0.0 2.0 0.6 "Twist"
// @euclid steps   96

uniform float u_twist;

// ─── Canales estándar (§3.1 — euChannels, G6) + relojes Clean Shot ────
// Evaluados UNA vez por píxel en mainImage; helpers los leen vía globals.
float g_glitch, g_live, g_groove;
float g_beatP, g_swell, g_fx;   // pulso beat · respiración compás · clip físico

// ─── SDF: fractal KIFS ──────────────────────────────────────────────────
// morphFactor → profundidad armónica = profundidad geométrica.
float mapFractal(vec3 p) {
    // ORACLE: la torsión respira con el compás; el clip físico la exagera
    // (la geometría solo miente cuando las luces de verdad disparan).
    float twist = u_twist + g_swell * 0.8 + g_fx * 1.5;
    p.xy *= rot2(p.z * twist * 0.15);

    // Compresión por beat: el espacio late (muelle rítmico)...
    // ...y u_activeEffectEnergy lo libera mientras el clip físico vive.
    float squeeze = 1.0 - 0.12 * g_beatP + 0.45 * g_fx;
    p /= squeeze;

    float scale  = mix(1.75, 2.35, u_morphFactor);           // pliegue más fino con armonía
    int   iters  = 4 + int(u_morphFactor * 4.0 + 0.5);       // 4..8 iteraciones
    vec3  offset = vec3(1.0, 1.0, 1.0) * (0.9 + 0.2 * u_kickPulse);

    float k = 1.0;
    for (int i = 0; i < 8; i++) {
        if (i >= iters) break;
        p = abs(p);                                   // pliegue de simetría
        if (p.x < p.y) p.xy = p.yx;                   // pliegues kaleidoscópicos
        if (p.x < p.z) p.xz = p.zx;
        if (p.y < p.z) p.yz = p.zy;
        p.xy *= rot2(0.18 + u_beatTime * 0.0625);     // 1 vuelta cada 16 beats... escalada por pliegue
        p = p * scale - offset * (scale - 1.0);
        k *= scale;
    }
    return (length(p) - 1.2) / k * squeeze;
}

// ─── Normal (técnica del tetraedro: 4 evaluaciones) ────────────────────
vec3 calcNormal(vec3 p) {
    const vec2 e = vec2(1.0, -1.0) * 0.0008;
    return normalize(e.xyy * mapFractal(p + e.xyy) + e.yyx * mapFractal(p + e.yyx) +
                     e.yxy * mapFractal(p + e.yxy) + e.xxx * mapFractal(p + e.xxx));
}

// ─── Raymarch ──────────────────────────────────────────────────────────
float march(vec3 ro, vec3 rd, out int steps) {
    float t = 0.0;
    for (steps = 0; steps < MAX_STEPS; steps++) {     // MAX_STEPS inyectado por el governor
        float d = mapFractal(ro + rd * t);
        if (d < 0.0006 * t) return t;
        t += d * 0.9;
        if (t > 20.0) break;
    }
    return -1.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // Canales estándar §3.1 — una evaluación por píxel (G6).
    euChannels(g_glitch, g_live, g_groove);
    // 🔫 Clean Shot (WAVE 8287): reloj musical + envolvente de efecto real.
    g_beatP = 0.5 + 0.5 * cos(6.2831853 * u_beatPhase);
    g_swell = sin(3.1415927 * u_barPhase);
    g_fx    = u_activeEffectEnergy;

    vec2 uv = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;

    // Glitch APOCALYPSE: desplazamiento de línea por aspereza espectral
    if (g_glitch > 0.01) {
        uv.x += (hash21(vec2(floor(uv.y * 80.0), floor(u_time * 30.0))) - 0.5)
                * g_glitch * 0.08;
    }

    // ─── Cámara ────────────────────────────────────────────────────────
    // Órbita en rejilla de beats; kick empuja; el clip físico hace dolly-in
    // (la cámara "cae hacia" el fractal solo mientras las luces disparan).
    float orbit = u_beatTime * 0.125;
    float dist  = 5.0 - 0.6 * g_swell - 0.35 * u_kickPulse + 1.2 * g_fx;
    vec3 ro = vec3(sin(orbit) * dist, 0.6 * sin(u_time * 0.1), cos(orbit) * dist);
    vec3 ta = vec3(0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    float fov = 1.6 + 0.15 * g_swell + 0.25 * g_fx;   // túnel: respira con el compás, abre en el disparo
    vec3 rd = normalize(uv.x * uu + uv.y * vv + fov * ww);

    // ─── Paleta desde la tonalidad ─────────────────────────────────────
    // El color respira con el beat; el clip físico lo satura al máximo.
    float sat = 1.0 - 0.25 * g_beatP + 0.6 * g_fx;

    int steps;
    float t = march(ro, rd, steps);
    vec3 col = vec3(0.0);

    if (t > 0.0) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);
        vec3 l = normalize(vec3(0.6, 0.8, -0.4));
        float diff = max(dot(n, l), 0.0);
        float ao   = 1.0 - float(steps) / float(MAX_STEPS);       // AO barato por coste de march
        float spec = pow(max(dot(reflect(-l, n), -rd), 0.0), 32.0);

        vec3 base = palette(u_chromaHue + length(p) * 0.08 + u_lowMid * 0.2,
                            vec3(0.5), vec3(0.5 * sat), vec3(1.0), vec3(0.0, 0.33, 0.67));
        col  = base * (0.15 + 0.85 * diff) * ao;
        col += spec * (0.3 + 2.5 * u_hihatEnergy);                // destellos granulares
        col += base * u_kickPulse * 0.35;                         // bombo = pulso emisivo
    }

    // Niebla que respira con la zona ambient de Omniliquid
    float fog = 1.0 - exp(-0.02 * (t > 0.0 ? t * t : 400.0) * (0.6 + u_lqAmbient));
    vec3 fogCol = palette(u_chromaHue + 0.5, vec3(0.05), vec3(0.08), vec3(1.0), vec3(0.2, 0.1, 0.3));
    col = mix(col, fogCol * (0.4 + u_subBass), fog);

    // Destello radial mientras el clip físico vive (el limitador del epílogo lo mantiene seguro)
    col += g_fx * 0.6 * exp(-4.0 * length(uv));

    fragColor = vec4(col, 1.0);
}
`

/**
 * Construye el `ITheiaAtom` del Oracle KIFS — genoma/zona derivados del
 * propio header `@euclid` (el shader es su propio manifiesto, §4.2).
 */
export function buildOracleKifsAtom(): ITheiaAtom {
  const meta = parseEuclidMeta(ORACLE_KIFS_SOURCE)
  return {
    id: ORACLE_KIFS_ATOM_ID,
    packId: EUCLID_PACK_ID,
    filePath: 'euclid://oracle_kifs.glsl', // path virtual — el medio es GLSL embebido
    aggression: meta.genome.aggression ?? 0.55,
    chaos: meta.genome.chaos ?? 0.6,
    organicity: meta.genome.organicity ?? 0.45,
    energyZone: { min: 'gentle', max: 'peak' }, // meta.zone gentle..peak
    validSections: ['verse', 'buildup', 'drop', 'breakdown', 'outro'],
    trim: { startMs: 0, endMs: 8000 }, // loop infinito — trim nominal
    compatibleVibes: ['techno-club', 'techno'],
    source: { kind: 'shader', glsl: ORACLE_KIFS_SOURCE },
  }
}
