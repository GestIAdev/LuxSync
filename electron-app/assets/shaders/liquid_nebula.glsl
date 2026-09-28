// @euclid name    "Liquid Nebula"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  ether+fluid
// @euclid genome  aggression=0.15 chaos=0.50 organicity=0.95
// @euclid zone    valley..active
// @euclid param   u_viscosity float -1.0 1.0 0.0 "Viscosity"
// @euclid param   u_trails    float -1.0 1.0 0.0 "Trails"
// @euclid gene    G_OCT    struct int   3    6     5    c:+0.4 o:+0.3
// @euclid gene    G_WARP   expr   float 1.0  6.0   3.5  c:+0.6 o:+0.4
// @euclid gene    G_SCALE  expr   float 0.8  3.0   1.6  a:+0.2
// @euclid gene    G_FLOW   expr   float 0.02 0.3   0.08 a:+0.4 o:-0.2
// @euclid gene    G_HUE    expr   float 0.0  1.0   0.62 c:+0.3
// @euclid gene    G_SEED   expr   float 0.0  100.0 0.0
// Theia 2.0 · contract v2 — migrated by scripts/migrate_atoms_v2.js (WAVE 8279)

uniform float u_viscosity;   // Regla del Cero Neutro: 0 = diseño canónico
uniform float u_trails;

#ifndef G_OCT
#define G_OCT 5.0
#endif
#ifndef G_WARP
#define G_WARP 3.5
#endif
#ifndef G_SCALE
#define G_SCALE 1.6
#endif
#ifndef G_FLOW
#define G_FLOW 0.08
#endif
#ifndef G_HUE
#define G_HUE 0.62
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif

#define PI      3.14159265359
#define TAU     6.28318530718
#define OCT_MAX 6

// ── Theia 2.0 · capa reactiva v2 (inyectado por migrate_atoms_v2) ──
// Vacío rítmico v2: rampa suave sobre u_rhythmicVoid (el flag binario
// RHYTHMIC_VOID era ≥0.75 — mismo centro, sin salto de fotograma).
float euVoidAmt() { return smoothstep(0.6, 0.9, u_rhythmicVoid); }
// Atenuación del vacío + rebote ∝ a lo que duró (u_voidRelease, §2.3).
float euVoidGate(float k) { return mix(1.0, k, euVoidAmt()) * (1.0 + 0.6 * u_voidRelease); }

// FBM de value-noise — octavas rotadas para matar artefactos de retícula.
float fbm(vec3 p) {
  float acc = 0.0;
  float amp = 0.5;
  for (int i = 0; i < OCT_MAX; i++) {
    if (float(i) >= G_OCT) break;
    acc += amp * noise3(p);
    p.xy = rot2(0.6) * p.xy;
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    amp *= 0.5;
  }
  return acc;
}

void mainImage(out vec4 c, in vec2 fragCoord) {
  // ── 1. CANALES ─────────────────────────────────────────────────────
  float tc, td, glitch, live, groove;
  euChannels(tc, td, glitch, live, groove);
  float rel = u_impact;

  vec2 uv = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;
  vec2 p  = uv * G_SCALE + G_SEED;

  // ── 2. RELOJ DEL FLUIDO — evolución sedosa sobre u_time (obedece SPEED)
  // Ley de Integración: `live` y `tc` NO multiplican el reloj (saltaría la
  // fase cuando cambian); se SUMAN a la fase → aceleración real durante la
  // subida, sin saltos. `live` respira la amplitud del warp.
  float flow = u_time * G_FLOW * (1.0 - 0.5 * u_viscosity) + 0.02 * u_beatTime;
  float t    = flow + 1.2 * tc + 0.6 * td;
  float turb = G_WARP * (0.55 + 0.45 * live) * (1.0 + 0.9 * tc + 0.3 * u_bass);

  // ── 3. DOMAIN WARPING DOBLE (IQ) — plasma sin bordes ──────────────
  vec2 q = vec2(fbm(vec3(p, t)),
                fbm(vec3(p + vec2(5.2, 1.3), t * 1.1)));
  vec2 r = vec2(fbm(vec3(p + turb * q + vec2(1.7, 9.2), t * 1.3)),
                fbm(vec3(p + turb * q + vec2(8.3, 2.8), t * 0.9)));
  float f = fbm(vec3(p + turb * r, t * 0.7));
  f = 0.5 + 0.5 * f;                                          // → ~[0,1]

  // ── 4. COLOR — capas de gas teñidas por la tonalidad de la pista ───
  float hue = G_HUE + 0.35 * u_chromaHue;
  vec3 deep  = palette(hue,        vec3(0.20), vec3(0.20), vec3(1.0), vec3(0.00, 0.15, 0.30));
  vec3 gas   = palette(hue + 0.18, vec3(0.50), vec3(0.50), vec3(1.0), vec3(0.00, 0.33, 0.67));
  vec3 plasm = palette(hue + 0.45, vec3(0.55), vec3(0.45), vec3(1.0), vec3(0.10, 0.20, 0.30));
  vec3 col = deep * 0.15;
  col = mix(col, gas * gas,   smoothstep(0.25, 0.85, f));
  col = mix(col, plasm,       smoothstep(0.0, 1.4, length(q)) * 0.6);
  col += gas * smoothstep(0.55, 1.0, r.x) * 0.6;              // filamentos luminosos
  col *= f * f * 1.6;                                         // densidad → luz

  // Brillo del núcleo: el sub-bass lo hace respirar, suave y difuso.
  col += plasm * 0.12 * (0.3 + u_subBass) * exp(-2.2 * length(uv)) * live;

  // ── 5. TRANSITORIOS — ondas suaves, sin bordes duros ──────────────
  // Kick: relámpago interno — solo las nubes más densas se iluminan.
  col += gas * u_kickPulse * smoothstep(0.55, 0.95, f) * 1.1;
  // Impact: marea de luz complementaria desde el centro.
  col += rel * 0.7 * palette(hue + 0.5, vec3(0.5), vec3(0.5), vec3(1.0),
                             vec3(0.0, 0.33, 0.67)) * exp(-1.8 * length(uv)) * f;
  // Hi-hat / aire: polvo estelar suave (gaussiano, no píxel duro).
  vec2 cell = floor(uv * 60.0);
  float star = step(0.985, hash21(cell + G_SEED));
  vec2 sp = fract(uv * 60.0) - 0.5;
  col += star * exp(-dot(sp, sp) * 40.0) * (0.15 + 1.5 * u_hihatEnergy + 0.5 * u_ultraAir)
       * vec3(0.9, 0.95, 1.0);

  // ── 6. TENSIÓN + EXPOSICIÓN LINEAL ─────────────────────────────────
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum) * vec3(0.95, 1.0, 1.1), 0.4 * tc); // la subida blanquea
  col *= euVoidGate(0.5);
  col *= (1.0 + 0.5 * u_energy) * (0.45 + 0.55 * live);
  col *= 1.0 - 0.25 * dot(uv, uv);

  // ── 7. MEMORIA — estela líquida con deriva centrífuga ─────────────
  if (u_hasPrev > 0.5) {
    vec2 st = fragCoord / u_resolution.xy - 0.5;
    st *= 0.996;
    st += 0.0015 * vec2(noise3(vec3(st * 4.0, t)), noise3(vec3(st * 4.0 + 3.1, t)));
    vec3 prev = texture(u_prevFrame, st + 0.5).rgb;
    prev *= prev;                                             // sRGB → lineal (aprox. γ2)
    float persist = clamp(0.80 + 0.12 * u_trails, 0.0, 0.94);
    col = max(col, prev * persist);
  }
  c = vec4(col, 1.0);
}