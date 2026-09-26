// @euclid name    "Voxel Monolith"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  lattice+city
// @euclid genome  aggression=0.80 chaos=0.35 organicity=0.10
// @euclid zone    active..peak
// @euclid param   u_extrude float -1.0 1.0 0.0 "Extrude"
// @euclid param   u_neon    float -1.0 1.0 0.0 "Neon"
// @euclid gene    G_WINDOWS struct int   3    9     7    o:-0.3
// @euclid gene    G_HEIGHT  expr   float 0.8  3.0   1.8  a:+0.5
// @euclid gene    G_FILL    expr   float 0.5  0.9   0.72 o:-0.3
// @euclid gene    G_JUMP    expr   float 0.1  0.8   0.35 a:+0.6 c:+0.4
// @euclid gene    G_VEL     expr   float 0.5  3.0   1.2  a:+0.4
// @euclid gene    G_HUE     expr   float 0.0  1.0   0.48 c:+0.3
// @euclid gene    G_SEED    expr   float 0.0  100.0 0.0
// @euclid steps   96

uniform float u_extrude;   // Regla del Cero Neutro: 0 = diseño canónico
uniform float u_neon;

#ifndef G_WINDOWS
#define G_WINDOWS 7.0
#endif
#ifndef G_HEIGHT
#define G_HEIGHT 1.8
#endif
#ifndef G_FILL
#define G_FILL 0.72
#endif
#ifndef G_JUMP
#define G_JUMP 0.35
#endif
#ifndef G_VEL
#define G_VEL 1.2
#endif
#ifndef G_HUE
#define G_HUE 0.48
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif

#define PI    3.14159265359
#define TAU   6.28318530718
#define FAR   48.0
#define H_MAX 4.4          // techo de extrusión: la cámara vuela a ~5.6

// ── Canales globales (una evaluación por píxel) ─────────────────────────
float gBeats, gBeatIdx, gGlitch, gLive, gExtrude;
vec2  gCamXZ;

// Onda de choque del bombo: anillo que rueda por la ciudad desde el punto
// de mira. Transitorio puro — golpea igual a cualquier SPEED.
float kickWave(float dist) {
  return u_kickPulse * exp(-abs(dist - (1.0 - u_kickPulse) * 16.0) * 0.7);
}

// Qué torres saltan en ESTE beat (sorteo nuevo en cada golpe de compás).
float jumpMask(vec2 id) {
  return step(1.0 - G_JUMP, hash21(id * 1.37 + vec2(gBeatIdx, G_SEED)));
}

float cellHeight(vec2 id) {
  float h0 = hash21(id + G_SEED);
  float h  = 0.15 + G_HEIGHT * h0 * h0 * h0;               // skyline de ley potencial
  h += jumpMask(id) * u_kickPulse * 2.0 * gExtrude;         // extrusión al bombo
  h += u_bass * 0.7 * hash21(id + 3.1) * gLive * gExtrude;  // respiración del bajo
  h += 1.2 * kickWave(length(id + 0.5 - gCamXZ)) * gExtrude;
  if (gGlitch > 0.01) {                                     // torres que teletransportan su altura
    float g = step(1.0 - 0.5 * gGlitch, hash21(id * 3.3 + floor(gBeats * 4.0)));
    h = mix(h, hash21(id + floor(gBeats * 8.0)) * G_HEIGHT * 1.5, g);
  }
  return min(h, H_MAX);
}

float sdCell(vec3 p, vec2 id, float h) {
  vec3 q = vec3(p.x - id.x - 0.5, p.y - 0.5 * h, p.z - id.y - 0.5);
  return sdBox(q, vec3(0.5 * G_FILL, 0.5 * h, 0.5 * G_FILL)) - 0.015;
}

vec3 cellNormal(vec3 p, vec2 id, float h) {
  const vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(
    sdCell(p + e.xyy, id, h) - sdCell(p - e.xyy, id, h),
    sdCell(p + e.yxy, id, h) - sdCell(p - e.yxy, id, h),
    sdCell(p + e.yyx, id, h) - sdCell(p - e.yyx, id, h)));
}

void mainImage(out vec4 c, in vec2 fragCoord) {
  // ── 1. CANALES ─────────────────────────────────────────────────────
  float tc, td, glitch, live, groove;
  euChannels(tc, td, glitch, live, groove);
  gBeats   = u_beatTime + u_time * 0.05;
  gBeatIdx = floor(u_beatTime);
  gGlitch  = glitch;
  gLive    = live;
  gExtrude = 1.0 + 0.6 * u_extrude;
  float rel = u_impact;

  vec2 fc = fragCoord;
  if (glitch > 0.01) {
    float h = hash21(vec2(floor(fc.y / 5.0), floor(gBeats * 8.0)));
    fc.x += step(1.0 - 0.35 * glitch, h) * (h - 0.5) * u_resolution.x * 0.15 * glitch;
  }
  vec2 uv = (fc - 0.5 * u_resolution.xy) / u_resolution.y;

  // ── 2. CÁMARA — vuelo rasante sobre la placa base (obedece SPEED) ───
  float camZ = gBeats * G_VEL;
  vec3 ro = vec3(1.6 * sin(gBeats * PI / 32.0),
                 5.6 - 1.0 * tc + 0.3 * sin(u_time * 0.21),   // la tensión hace picar
                 camZ);
  gCamXZ = ro.xz + vec2(0.0, 9.0);                            // punto de mira en el suelo
  vec3 rd = normalize(vec3(uv, 1.35 - 0.3 * tc + 0.2 * rel));
  rd.yz = rot2(-0.55 - 0.12 * tc) * rd.yz;                    // cabeceo hacia la ciudad
  float bank = 0.1 * sin(gBeats * PI / 16.0);
  rd.xy = rot2(bank) * rd.xy;
  rd.xz = rot2(bank * 0.8) * rd.xz;

  // ── 3. RAYMARCH por celdas — el paso nunca cruza a la celda vecina ─
  vec2 rs = vec2(rd.x >= 0.0 ? 1.0 : -1.0, rd.z >= 0.0 ? 1.0 : -1.0);
  vec2 ra = rs * max(abs(rd.xz), vec2(1e-4));
  float t = 0.0;
  vec2  hid = vec2(0.0);
  float hh = 0.0;
  bool  hit = false;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    vec2 id = floor(p.xz);
    float h = cellHeight(id);
    float ds = min(sdCell(p, id, h), p.y);
    if (ds < 0.0015 + 0.001 * t) { hit = true; hid = id; hh = h; break; }
    vec2 tb = (rs * 0.5 - (fract(p.xz) - 0.5)) / ra;          // distancia al borde de celda
    t += min(ds, min(tb.x, tb.y) + 0.01);
    if (t > FAR || (p.y > 6.5 && rd.y > 0.0)) break;
  }

  // ── 4. SHADING ────────────────────────────────────────────────────
  vec3 neonA = palette(G_HUE + u_chromaHue * 0.3, vec3(0.5), vec3(0.5), vec3(1.0),
                       vec3(0.0, 0.33, 0.67));
  vec3 fogCol = neonA * neonA * 0.05;
  vec3 col = mix(fogCol, vec3(0.0), clamp(rd.y * 2.5 + 0.2, 0.0, 1.0));  // cielo

  if (hit) {
    vec3 p = ro + rd * t;
    bool ground = p.y < sdCell(p, hid, hh);
    if (ground) {
      // Placa base: buses de cobre en las calles + paquetes de datos.
      vec2 f = fract(p.xz) - 0.5;
      float bus = exp(-abs(abs(f.x) - 0.5) * 90.0) + exp(-abs(abs(f.y) - 0.5) * 90.0);
      float lane = hash21(vec2(floor(p.x), G_SEED));
      float pk = exp(-abs(fract(p.z * 0.25 - u_beatTime * 0.5 + lane) - 0.5) * 30.0);
      float wave = kickWave(length(p.xz - gCamXZ));
      col = vec3(0.008, 0.01, 0.014)
          + neonA * neonA * bus * (0.2 + 0.8 * pk + 3.0 * wave) * live;
    } else {
      vec3 n = cellNormal(p, hid, hh);
      vec3 lp = p - vec3(hid.x + 0.5, 0.0, hid.y + 0.5);
      float dif = max(dot(n, normalize(vec3(0.4, 0.8, -0.3))), 0.0);
      col = vec3(0.022, 0.026, 0.034) * (0.35 + dif);           // metal oscuro

      vec3 neon = palette(G_HUE + 0.12 * hh + u_chromaHue * 0.3, vec3(0.5), vec3(0.5),
                          vec3(1.0), vec3(0.0, 0.1, 0.2));
      neon *= neon;                                             // saturación lineal
      float top  = step(0.5, n.y);
      float half_ = 0.5 * G_FILL;
      float edge = max(abs(lp.x), abs(lp.z)) / half_;
      float rim  = top * exp(-(1.0 - edge) * 30.0);             // aro superior
      float side = abs(n.x) > 0.5 ? abs(lp.z) : abs(lp.x);
      float corner = (1.0 - top) * exp(-(1.0 - side / half_) * 25.0);
      float band = (1.0 - top) * exp(-(hh - p.y) * 18.0);       // cornisa
      float jump = jumpMask(hid);
      float emit = (0.5 + 0.3 * u_neon)
                 * (0.35 + 3.5 * u_kickPulse * jump + 1.8 * kickWave(length(hid + 0.5 - gCamXZ)));
      col += neon * (rim + 0.6 * corner + 0.9 * band) * emit * live;

      // Ventanas: se encienden con el hi-hat.
      vec2 fuv = vec2(abs(n.x) > 0.5 ? lp.z : lp.x, p.y);
      vec2 wg = fuv * vec2(G_WINDOWS, 5.0);
      float win = step(0.35, fract(wg.x)) * step(0.4, fract(wg.y)) * (1.0 - top);
      float lit = step(0.72 - 0.35 * u_hihatEnergy, hash21(floor(wg) + hid * 13.7));
      col += win * lit * vec3(1.0, 0.72, 0.42) * 0.22 * live;

      // Grietas: fallas del monolito que el snare ilumina desde dentro.
      float cr = abs(noise3(p * vec3(3.0, 5.0, 3.0) + vec3(hid * 7.1, G_SEED)));
      float crack = exp(-cr * 45.0);
      col += crack * (u_snarePulse * 3.5 + 0.08 * u_spectralFlux) * vec3(0.7, 0.9, 1.0);
    }
    col = mix(col, fogCol, 1.0 - exp(-t * 0.045));
  }

  // ── 5. TRANSITORIOS GLOBALES ──────────────────────────────────────
  // Impact: relámpago complementario sobre el horizonte.
  col += rel * 1.4 * palette(u_chromaHue + 0.5, vec3(0.5), vec3(0.5), vec3(1.0),
                             vec3(0.0, 0.33, 0.67)) * exp(-abs(rd.y + 0.05) * 10.0);
  if (glitch > 0.01) col = mix(col, col.gbr, 0.6 * glitch * step(0.6, hash21(vec2(floor(fc.y / 3.0), gBeatIdx))));

  // ── 6. TENSIÓN + EXPOSICIÓN LINEAL ─────────────────────────────────
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum), 0.5 * tc);
  if (RHYTHMIC_VOID) col *= 0.35;
  col *= 1.0 + 0.6 * u_energy;
  col *= 1.0 - 0.3 * dot(uv, uv);
  c = vec4(col, 1.0);
}
