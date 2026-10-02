// @euclid name    "Quipu Cuantico"
// @euclid author  "LuxSync · Pack Latino · Triunvirato"
// @euclid family  ether+lattice
// @euclid genome  aggression=0.45 chaos=0.55 organicity=0.85
// @euclid zone    gentle..peak
// @euclid vibes   fiesta-latina, rave, cumbia, selva, tribal
// @euclid param   u_glow float -1.0 1.0 0.0 "Glow"
// @euclid gene    G_BRAID  expr   float 0.25 0.85  0.55 o:+0.3
// @euclid gene    G_TWIST  expr   float 0.2  2.5   1.0  c:+0.4 a:+0.2
// @euclid gene    G_GOO    expr   float 0.0  1.0   0.6  o:+0.5
// @euclid gene    G_HUE    expr   float 0.0  1.0   0.30 o:+0.2
// @euclid gene    G_SEED   expr   float 0.0  100.0 0.0
// @euclid steps   88
// Theia 2.0 · contract v2 — WAVE 8429 · Triunvirato Latino (autoría nativa v2)
//
// ── QUIPU CUÁNTICO ──────────────────────────────────────────────────────────
// Bosque de cuerdas quipu (nudos incas) en dominio repetido XY. Cada celda
// contiene una TRENZA DE 3 CABOS — parametrización clásica de trenza:
//   c_j(u) = R·( sin 2π(u+j/3) , ½·sin 4π(u+j/3) ),  u = z/L + twist
// La fase usa fract(z/L) → anclada al mundo y acotada en f32 (sin látigo).
// Los NUDOS viven en z discreto (cada KNOT_L) y se hinchan al bombo con
// gate por hash(celda, nudo, cabo) — el kick enciende muchos, nunca todos.
//
// 🎭 u_vibe — bifurcación TOPOLÓGICA (no dinámica):
//   LATINO/otros → lianas: sección circular, smooth-union pegajoso (smin),
//                  ondulación fBm, falso SSS que respira con los medios.
//   RAVE/TECHNO  → la matemática se rompe: trayectoria zigzag lineal a
//                  trozos (onda triangular), sección CHEBYSHEV (fibra
//                  cuadrada), unión dura, nudos OCTAÉDRICOS (norma L1).
// El cataclismo DMX (fx) fuerza la rotura también en LATINO.

uniform float u_glow;

#ifndef G_BRAID
#define G_BRAID 0.55
#endif
#ifndef G_TWIST
#define G_TWIST 1.0
#endif
#ifndef G_GOO
#define G_GOO 0.6
#endif
#ifndef G_HUE
#define G_HUE 0.30
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif

#define TAU     6.28318530718
#define CELL    3.2
#define BRAID_L 6.0
#define KNOT_L  1.5

float gHard, gTwist, gBreath, gGoo, gFx, gRad;
vec3  gSd;

float qVibe(float v) { return 1.0 - step(0.5, abs(u_vibe - v)); }
float qVoid(float k) { return mix(1.0, k, smoothstep(0.6, 0.9, u_rhythmicVoid)) * (1.0 + 0.6 * u_voidRelease); }
float qTri(float x)  { return abs(fract(x) * 2.0 - 1.0) * 2.0 - 1.0; }

// Paleta: lianas bioluminiscentes (jade/oro/turquesa) ↔ neón láser.
vec3 qPal(float t) {
  vec3 org = palette(t, vec3(0.40, 0.50, 0.30), vec3(0.45, 0.50, 0.40),
                        vec3(1.0, 1.0, 1.0), vec3(0.05, 0.25, 0.55));
  vec3 las = palette(t, vec3(0.50, 0.50, 0.50), vec3(0.50, 0.50, 0.50),
                        vec3(2.0, 1.0, 0.0), vec3(0.50, 0.20, 0.25));
  return mix(org, las, gHard);
}

// Centro del cabo j (0..2) a profundidad de mundo z.
vec2 qStrand(float z, float j, float cid) {
  float u = fract(z / BRAID_L + cid) + j / 3.0 + gTwist;          // fase en vueltas
  vec2 soft = vec2(sin(TAU * u), 0.5 * sin(2.0 * TAU * u));       // figura-8 orgánica
  vec2 hard = vec2(qTri(u - 0.25), 0.5 * qTri(2.0 * u - 0.25));   // zigzag tensor
  return mix(soft, hard, gHard) * G_BRAID;
}

// x = distancia · y = id de cabo (color) · z = 1 si el punto más cercano es nudo
vec3 qMap(vec3 p) {
  vec2 cell = floor(p.xy / CELL + 0.5);
  vec2 q = p.xy - CELL * cell;
  float cid = hash21(cell + gSd.xy);
  float kz = floor(p.z / KNOT_L);
  float zz = p.z - (kz + 0.5) * KNOT_L;

  float acc = 1e3, best = 1e3, sid = 0.0, knot = 0.0;
  float kGoo = 0.05 + 0.30 * gGoo;
  for (int i = 0; i < 3; i++) {
    float j = float(i);
    vec2 v = q - qStrand(p.z, j, cid);
    // pegajosidad orgánica: la liana ondula (anula en modo tensor)
    float wob = (1.0 - gHard) * 0.045 *
                noise3(vec3(v * 3.0 + gSd.xy, p.z * 0.9 + j * 7.0 + gSd.z));
    float sec = mix(length(v), max(abs(v.x), abs(v.y)), gHard);   // L2 ↔ Chebyshev
    float ds = sec - gRad + wob;

    // nudo quipu estocástico: hash por (celda, nudo, cabo)
    float h = hash31(vec3(cell + gSd.xy, kz * 3.0 + j));
    float kick = u_kickPulse * step(0.5, h) * (0.4 + 0.6 * fract(h * 17.0));
    float kr = gRad * (1.5 + 2.4 * kick + 0.9 * u_snareTruePulse * step(0.8, h));
    vec3 kv = vec3(v, zz);
    float dk = mix(length(kv), (abs(kv.x) + abs(kv.y) + abs(kv.z)) * 0.57735, gHard) - kr;

    float dj = min(ds, dk);
    acc = mix(smin(acc, dj, kGoo), min(acc, dj), gHard);
    if (dj < best) { best = dj; sid = cid * 3.0 + j; knot = step(dk, ds); }
  }
  // Cota de dominio: los cabos viven a ≤1.4 del centro → nunca sobrepasar
  // el borde de celda más el margen hasta la cuerda vecina.
  float edge = 0.5 * CELL - max(abs(q.x), abs(q.y));
  return vec3(min(acc, edge + 0.2), sid, knot);
}

void mainImage(out vec4 c, in vec2 fragCoord) {
  float glitch, live, groove;
  euChannels(glitch, live, groove);
  vec4 tb = euTimbre();

  float beats = u_beatTime + u_time * 0.05;
  float swell = sin(3.1415927 * u_barPhase) * u_speed;
  gFx = u_activeEffectEnergy;

  // 🎭 Topología por vibe; el cataclismo también rompe la matemática.
  float vibeHard = max(qVibe(VIBE_RAVE), qVibe(VIBE_TECHNO));
  gHard = max(vibeHard, smoothstep(0.35, 1.0, gFx));
  gSd = vec3(G_SEED * 43.1, G_SEED * -17.3, G_SEED * 99.2);

  // Dinámica (LiquidEngineBase): medios = respiración, synth = viscosidad,
  // voz = grosor, hi-hat = vibración del láser.
  gBreath = clamp(0.65 * u_cleanMid + 0.35 * u_mid, 0.0, 1.0) *
            (0.75 + 0.25 * sin(u_midTime * 2.3));
  gGoo = G_GOO * (0.6 + 0.8 * tb.y);
  gRad = mix(0.11 + 0.07 * gBreath + 0.03 * tb.x, 0.03 + 0.012 * u_hihatEnergy, gHard);
  gTwist = beats * 0.12 * G_TWIST * (1.0 + 3.0 * gFx) + 0.15 * swell;
  // mod 1536 = múltiplo de BRAID_L y KNOT_L → wrap sin costura geométrica
  float camZ = mod(beats * 0.85, 1536.0);

  vec2 uv = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;
  float r = length(uv);
  vec3 ro = vec3(0.35 * sin(beats * 0.07), 0.25 * cos(beats * 0.05), camZ);
  vec3 rd = normalize(vec3(uv, 1.5 - 0.35 * u_epicness));
  rd.xy = rot2(0.12 * swell + beats * 0.015) * rd.xy;     // roll lento (anti-náusea)
  rd.xy = rot2(gFx * 1.4 / (r + 0.35)) * rd.xy;            // §13.3 cizalladura 1/r

  // ── Marcha con brillo volumétrico acumulado (bioluz / haz láser) ──
  float t = 0.05;
  vec3 glow = vec3(0.0);
  vec3 hit = vec3(-1.0, 0.0, 0.0);
  float kGlow = mix(14.0, 38.0, gHard);
  float wGlow = 0.016 + 0.030 * gHard;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    vec3 m = qMap(p);
    vec3 sc = qPal(fract(G_HUE + u_chromaHue + fract(m.y * 0.1371) * 0.35));
    glow += sc * exp(-max(m.x, 0.0) * kGlow) * wGlow;
    if (m.x < 0.0015 * t) { hit = vec3(t, m.y, m.z); break; }
    t += m.x * 0.72;
    if (t > 34.0) break;
  }

  vec3 bg = mix(vec3(0.004, 0.012, 0.010), vec3(0.006, 0.002, 0.014), gHard);
  vec3 col = bg;
  float fres = 0.0;
  if (hit.x > 0.0) {
    vec3 p = ro + rd * hit.x;
    vec2 e = vec2(0.0015, -0.0015);
    vec3 n = normalize(e.xyy * qMap(p + e.xyy).x + e.yyx * qMap(p + e.yyx).x +
                       e.yxy * qMap(p + e.yxy).x + e.xxx * qMap(p + e.xxx).x);
    vec3 sc = qPal(fract(G_HUE + u_chromaHue + fract(hit.y * 0.1371) * 0.35));
    float f1 = 1.0 - max(0.0, dot(n, -rd));
    fres = f1 * f1 * f1;
    // Falso SSS: grosor sondeado hacia dentro (d<0 en el interior)
    float thick = clamp(-qMap(p - n * 0.12).x / 0.12, 0.0, 1.0);
    vec3 organic = sc * (0.22 + 1.7 * gBreath * (1.0 - thick) + 0.7 * u_vocalOnset * tb.x)
                 + sc * fres * 1.3;
    vec3 laser = mix(sc, vec3(1.0), 0.55) *
                 (2.2 + 2.5 * u_hihatEnergy + 1.5 * u_snareTruePulse);
    vec3 surf = mix(organic, laser, gHard);
    surf *= 1.0 + 1.2 * hit.z;                                // nudos: cuentas brillantes
    col = mix(bg, surf, exp(-0.075 * hit.x));
  }
  col += glow * (0.7 + 0.8 * u_energy) * (1.0 + max(u_glow, -0.9));

  // §13.3 — cataclismo: HDR cian/magenta, el bosque se vuelve fibra óptica
  vec3 shock = vec3(dot(col, vec3(0.33))) * vec3(0.3, 1.4, 1.8) + glow.zxy * 1.5
             + vec3(1.4, 0.1, 0.9) * fres;
  col = mix(col, shock, 0.6 * gFx);

  if (glitch > 0.01) {
    float hg = hash21(vec2(floor(fragCoord.y / 6.0), floor(beats * 8.0)));
    col = mix(col, col.gbr, step(1.0 - 0.35 * glitch, hg) * glitch);
  }
  col *= qVoid(0.35);
  col *= (0.75 + 0.5 * u_energy) * live;
  col *= 1.0 - 0.3 * dot(uv, uv);
  c = vec4(col, 1.0);
}
