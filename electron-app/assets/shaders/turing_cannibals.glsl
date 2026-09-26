// @euclid name    "Turing Cannibals"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  cellular+bio
// @euclid genome  aggression=0.55 chaos=0.70 organicity=1.00
// @euclid zone    gentle..peak
// @euclid param   u_hunger float -1.0 1.0 0.0 "Hunger"
// @euclid param   u_relief float -1.0 1.0 0.0 "Relief"
// @euclid gene    G_SEEDS struct int   2    6     3      a:+0.5
// @euclid gene    G_FEED  expr   float 0.030 0.045 0.0367 c:+0.4 o:+0.3
// @euclid gene    G_KILL  expr   float 0.060 0.066 0.0649 a:+0.3
// @euclid gene    G_HUE   expr   float 0.0  1.0   0.30   c:+0.3
// @euclid gene    G_SEED  expr   float 0.0  100.0 0.0

uniform float u_hunger;   // Regla del Cero Neutro: 0 = diseño canónico
uniform float u_relief;

#ifndef G_SEEDS
#define G_SEEDS 3.0
#endif
#ifndef G_FEED
#define G_FEED 0.0367
#endif
#ifndef G_KILL
#define G_KILL 0.0649
#endif
#ifndef G_HUE
#define G_HUE 0.30
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif

#define PI        3.14159265359
#define TAU       6.28318530718
#define SEEDS_MAX 6

// ── Utilidades compartidas por la simulación y el visual ───────────────
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// Zancada del laplaciano ∝ resolución → el tamaño de las células es el
// MISMO en el preview (720p) y en la salida HDMI (1080p).
int strideR() {
  return int(clamp(floor(u_resolution.y / 360.0 + 0.5), 1.0, 3.0));
}

vec4 fetchS(ivec2 p) {
  ivec2 sz = ivec2(u_resolution.xy);
  return texelFetch(u_state, clamp(p, ivec2(0), sz - 1), 0);
}

// Laplaciano 3×3 de Karl Sims (0.2 aristas · 0.05 diagonales · −1 centro)
// a una zancada R dada.
vec2 lap3(ivec2 p, int R, vec2 c) {
  vec2 a = fetchS(p + ivec2(R, 0)).rg + fetchS(p - ivec2(R, 0)).rg
         + fetchS(p + ivec2(0, R)).rg + fetchS(p - ivec2(0, R)).rg;
  vec2 d = fetchS(p + ivec2(R, R)).rg + fetchS(p + ivec2(-R, R)).rg
         + fetchS(p + ivec2(R, -R)).rg + fetchS(p + ivec2(-R, -R)).rg;
  return 0.2 * a + 0.05 * d - c;
}

// Guadaña del snare: franja con ángulo nuevo en cada golpe.
float snareStripe(vec2 cuv) {
  float a = hash21(vec2(floor(u_beatTime * 2.0), G_SEED + 3.0)) * PI;
  return exp(-abs(dot(cuv, vec2(cos(a), sin(a)))) * 22.0);
}

// ═══ SIMULACIÓN — Gray-Scott sobre el ping-pong RGBA16F ═════════════════
//   r = U (sustrato)  g = V (células)  b = frente de alimentación (glow)
void mainState(out vec4 s, in vec2 fragCoord) {
  ivec2 ip = ivec2(fragCoord);
  int R = strideR();
  vec2 cuv = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;
  float cellPx = 12.0 * float(R);

  if (u_stateInit > 0.5) {
    // Siembra: colonias dispersas por toda la placa.
    vec2 g = floor(fragCoord / cellPx);
    vec2 f = fract(fragCoord / cellPx) - 0.5;
    float seed = step(0.86, hash21(g + G_SEED)) * step(length(f), 0.32);
    s = vec4(1.0 - 0.5 * seed, 0.25 * seed, 0.0, 1.0);
    return;
  }

  vec4 c0 = fetchS(ip);
  float u = c0.r;
  float v = c0.g;
  // Laplaciano híbrido: zancada 1 (acopla sub-redes) + zancada R (escala).
  vec2 lap = 0.2 * lap3(ip, 1, c0.rg) + 0.85 * lap3(ip, R, c0.rg);

  // La MÚSICA gobierna la química:
  //   energía/hambre → alimentación ↑ (crecen, se dividen, devoran)
  //   tensión        → muerte ↑ (inanición antes del drop)
  //   bajo           → muerte ↓ (las células se estiran en gusanos)
  float tc, td, glitch, live, groove;
  euChannels(tc, td, glitch, live, groove);
  float F = G_FEED + 0.006 * u_energy * live + 0.004 * u_hunger - 0.004 * tc;
  float k = G_KILL + 0.0035 * tc - 0.0015 * u_bass + 0.03 * u_snarePulse * snareStripe(cuv);

  float uvv = u * v * v;
  float du = 1.0 * lap.x - uvv + F * (1.0 - u);
  float dv = 0.5 * lap.y + uvv - (F + k) * v;
  u = clamp(u + du, 0.0, 1.0);
  v = clamp(v + dv, 0.0, 1.0);

  // KICK: nuevas colonias caen en la placa (sorteo por beat).
  if (u_kickPulse > 0.75) {
    for (int i = 0; i < SEEDS_MAX; i++) {
      if (float(i) >= G_SEEDS) break;
      vec2 cp = (hash22(vec2(floor(u_beatTime), float(i) + G_SEED)) - 0.5)
              * vec2(u_resolution.x / u_resolution.y, 1.0) * 0.9;
      if (length(cuv - cp) < 0.03) { u = 0.5; v = 0.25; }
    }
  }
  // DROP: esporas por todas partes — explosión demográfica.
  if (u_impact > 0.7) {
    vec2 g = floor(fragCoord / cellPx);
    vec2 f = fract(fragCoord / cellPx) - 0.5;
    if (hash21(g + floor(u_beatTime) * 7.3) > 0.9 && length(f) < 0.3) { u = 0.5; v = 0.25; }
  }

  float glow = max(c0.b * 0.95, clamp(dv * 60.0, 0.0, 1.0));
  s = vec4(u, v, glow, 1.0);
}

// ═══ VISUAL — tejido vivo con relieve húmedo ════════════════════════════
void mainImage(out vec4 c, in vec2 fragCoord) {
  float tc, td, glitch, live, groove;
  euChannels(tc, td, glitch, live, groove);
  float beats = u_beatTime + u_time * 0.05;
  float rel = u_impact;

  vec2 fc = fragCoord;
  if (glitch > 0.01) {
    float h = hash21(vec2(floor(fc.y / 6.0), floor(beats * 8.0)));
    fc.x += step(1.0 - 0.35 * glitch, h) * (h - 0.5) * u_resolution.x * 0.08 * glitch;
  }
  ivec2 ip = ivec2(fc);
  int R = strideR();
  vec2 cuv = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;

  vec4 st = fetchS(ip);
  float v = st.g;
  float grow = st.b;
  float vx = fetchS(ip + ivec2(R, 0)).g - fetchS(ip - ivec2(R, 0)).g;
  float vy = fetchS(ip + ivec2(0, R)).g - fetchS(ip - ivec2(0, R)).g;

  // KICK: las membranas se hinchan (el relieve late).
  float relief = (5.0 + 2.5 * u_relief) * (1.0 + 1.6 * u_kickPulse);
  vec3 n = normalize(vec3(-vx * relief, -vy * relief, 1.0));
  // Luz que orbita al compás (movimiento continuo → obedece SPEED).
  vec3 L = normalize(vec3(cos(beats * PI / 8.0), sin(beats * PI / 8.0), 0.9));
  float dif = max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 48.0);

  float body = smoothstep(0.08, 0.32, v);
  float membrane = smoothstep(0.05, 0.16, v) - smoothstep(0.2, 0.36, v);
  vec3 tissue = palette(G_HUE + u_chromaHue * 0.5 + v * 0.8, vec3(0.5), vec3(0.5), vec3(1.0),
                        vec3(0.0, 0.1, 0.2));
  tissue *= tissue;
  vec3 medium = palette(G_HUE + 0.5 + u_chromaHue * 0.5, vec3(0.5), vec3(0.5), vec3(1.0),
                        vec3(0.0, 0.33, 0.67));
  medium = medium * medium * (0.02 + 0.03 * u_lqAmbient);

  vec3 col = mix(medium, tissue * (0.2 + 0.9 * dif), body);
  col += membrane * tissue * (0.5 + 2.0 * u_kickPulse) * live;
  col += spec * 0.7 * body;
  // Frentes de alimentación: el borde que devora brilla.
  vec3 hunger = palette(u_chromaHue + G_HUE + 0.3, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  col += grow * hunger * (0.4 + 1.8 * u_energy) * live;
  // DROP: bioluminiscencia — todos los núcleos se encienden a la vez.
  vec3 comp = palette(u_chromaHue + G_HUE + 0.5, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  col += rel * 2.2 * smoothstep(0.22, 0.42, v) * comp;
  // SNARE: el filo de la guadaña deja un destello frío al pasar.
  col += u_snarePulse * snareStripe(cuv) * vec3(0.5, 0.7, 1.0) * 0.6;
  // HI-HAT: cilios chispeando en las membranas.
  col += membrane * u_hihatEnergy * step(0.8, hash21(floor(fragCoord * 0.5) + floor(beats * 8.0))) * 1.5;

  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum) * vec3(0.9, 1.0, 1.1), 0.5 * tc);        // inanición: se apaga el color
  if (glitch > 0.01) col = mix(col, col.brg, 0.5 * glitch);
  if (RHYTHMIC_VOID) col *= 0.45;
  col *= 1.0 + 0.5 * u_energy;
  col *= 1.0 - 0.25 * dot(cuv, cuv);
  c = vec4(col, 1.0);
}
