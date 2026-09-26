// @euclid name    "Neon Conduit"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  tunnel+lattice
// @euclid genome  aggression=0.85 chaos=0.45 organicity=0.15
// @euclid zone    active..peak
// @euclid param   u_glow  float -1.0 1.0 0.0 "Glow"
// @euclid param   u_twist float -1.0 1.0 0.0 "Twist"
// @euclid gene    G_SIDES struct int   4    8     6    a:+0.3 c:+0.2 o:-0.3
// @euclid gene    G_RIB   expr   float 0.6  3.0   1.4  a:+0.4 o:-0.2
// @euclid gene    G_VEL   expr   float 0.5  3.0   1.6  a:+0.6
// @euclid gene    G_HUE   expr   float 0.0  1.0   0.55 c:+0.3
// @euclid gene    G_SEED  expr   float 0.0  100.0 0.0
// @euclid steps   64

uniform float u_glow;    // Regla del Cero Neutro: 0 = diseño canónico
uniform float u_twist;

#ifndef G_SIDES
#define G_SIDES 6.0
#endif
#ifndef G_RIB
#define G_RIB 1.4
#endif
#ifndef G_VEL
#define G_VEL 1.6
#endif
#ifndef G_HUE
#define G_HUE 0.55
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif

#define PI     3.14159265359
#define TAU    6.28318530718
#define TUBE_R 2.0
#define FAR    40.0

// ── Canales globales (una evaluación por píxel) ─────────────────────────
float gBeats, gGlitch, gTwist, gKickZ;

// Distancia a un n-gono regular de apotema r (negativa dentro).
float sdNgon(vec2 p, float n, float r) {
  float seg = TAU / n;
  float a = mod(atan(p.y, p.x) + 0.5 * seg, seg) - 0.5 * seg;
  return length(p) * cos(a) - r;
}

// Espacio del túnel: torsión continua (reloj) + desgarro (glitch).
vec3 warpTunnel(vec3 p) {
  float tw = gTwist * p.z + gGlitch * 0.9 * sin(p.z * 1.7 + gBeats * PI);
  p.xy = rot2(tw) * p.xy;
  // Glitch rompe la simetría: cizalla por bloques discretos de z.
  float blk = floor(p.z * 1.5);
  p.x += gGlitch * 0.45 * (hash21(vec2(blk, G_SEED)) - 0.5);
  return p;
}

// d = distancia a la escena; rib = distancia a las costillas emisivas.
float mapScene(vec3 p, out float rib) {
  p = warpTunnel(p);
  float wall = -sdNgon(p.xy, G_SIDES, TUBE_R);            // interior del tubo
  float zr = mod(p.z, G_RIB) - 0.5 * G_RIB;
  rib = max(abs(zr) - 0.05, -sdNgon(p.xy, G_SIDES, TUBE_R - 0.22));
  return min(wall, rib);
}

void mainImage(out vec4 c, in vec2 fragCoord) {
  // ── 1. CANALES ─────────────────────────────────────────────────────
  float tc, td, glitch, live, groove;
  euChannels(tc, td, glitch, live, groove);
  gGlitch = glitch;
  gBeats  = u_beatTime + u_time * 0.05;
  gTwist  = 0.035 + 0.05 * u_twist + 0.06 * tc;
  float rel = u_impact;

  // Scanline tear (glitch agresivo) antes de construir el rayo.
  vec2 fc = fragCoord;
  if (glitch > 0.01) {
    float h = hash21(vec2(floor(fc.y / 6.0), floor(gBeats * 8.0)));
    fc.x += step(1.0 - 0.4 * glitch, h) * (h - 0.5) * u_resolution.x * 0.2 * glitch;
  }
  vec2 uv = (fc - 0.5 * u_resolution.xy) / u_resolution.y;

  // ── 2. CÁMARA — avanza con el reloj musical (obedece SPEED) ─────────
  float camZ = gBeats * G_VEL;
  vec3 ro = vec3(0.0, 0.0, camZ);
  float fov = 1.25 - 0.45 * tc + 0.25 * rel;                // tensión = teleobjetivo
  vec3 rd = normalize(vec3(uv, fov));
  rd.xy = rot2(0.15 * sin(gBeats * PI * 0.125)) * rd.xy;    // alabeo lento

  // Frente de onda del kick: nace delante de la cámara y viaja al fondo.
  gKickZ = camZ + 1.5 + (1.0 - u_kickPulse) * 16.0;

  // ── 3. RAYMARCH con acumulación de neón ───────────────────────────
  float t = 0.05;
  float rib = 1.0;
  vec3 glow = vec3(0.0);
  bool hit = false;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    float d = mapScene(p, rib);
    // Emisión volumétrica de las costillas — color por profundidad.
    vec3 neon = palette(G_HUE + u_chromaHue * 0.25 + p.z * 0.015,
                        vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.1, 0.2));
    neon *= neon;                                           // saturación lineal
    float wave = exp(-abs(p.z - gKickZ) * 1.2);
    float emit = (0.35 + 0.25 * u_glow) * (0.4 + 1.8 * u_kickPulse * wave + 0.6 * u_bass);
    glow += neon * emit * 0.006 / (0.004 + rib * rib) * exp(-t * 0.07);
    if (d < 0.0015 * t) { hit = true; break; }
    t += d * 0.85;
    if (t > FAR) break;
  }

  // ── 4. PARED — costuras de las aristas del polígono ────────────────
  vec3 col = vec3(0.0);
  if (hit) {
    vec3 p = warpTunnel(ro + rd * t);
    float seg = TAU / G_SIDES;
    float a = mod(atan(p.y, p.x) + 0.5 * seg, seg) - 0.5 * seg;
    float seam = exp(-abs(abs(a) - 0.5 * seg) * 60.0);      // arista del n-gono
    float lane = exp(-abs(fract(p.z * 0.5 - gBeats * 0.5) - 0.5) * 24.0);
    vec3 seamCol = palette(G_HUE + 0.5 + u_chromaHue * 0.25,
                           vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
    col += seamCol * seam * (0.6 + 2.5 * u_kickPulse) * live;
    col += seamCol * lane * seam * u_hihatEnergy * 3.0;     // luces de pista hi-hat
    col += vec3(0.015, 0.02, 0.03) * (0.5 + u_lqFloor);     // pared base (casi negra)
    col *= exp(-t * 0.06);                                  // niebla
  }
  col += glow;

  // ── 5. TRANSITORIOS — tiempo real ─────────────────────────────────
  // Snare: barrido horizontal blanco.
  col += u_snarePulse * 0.5 * exp(-abs(uv.y - (0.5 - u_snarePulse)) * 18.0) * vec3(0.9, 0.95, 1.0);
  // Impact: estallido complementario en el punto de fuga.
  col += rel * 1.2 * palette(u_chromaHue + 0.5, vec3(0.5), vec3(0.5), vec3(1.0),
                             vec3(0.0, 0.33, 0.67)) * exp(-length(uv) * 4.0);
  // Glitch: aberración cromática por separación de canales.
  if (glitch > 0.01) col = mix(col, col.brg, 0.5 * glitch * step(0.5, hash21(fc * 0.01 + gBeats)));

  // ── 6. CONSERVACIÓN DE LA TENSIÓN + EXPOSICIÓN LINEAL ──────────────
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum), 0.5 * tc);
  if (RHYTHMIC_VOID) col *= 0.35;
  col *= (1.0 + 0.7 * u_energy) * live;
  col *= 1.0 - 0.3 * dot(uv, uv);
  c = vec4(col, 1.0);
}