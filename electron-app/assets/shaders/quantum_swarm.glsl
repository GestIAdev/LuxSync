// @euclid name    "Quantum Swarm"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  swarm+cellular
// @euclid genome  aggression=0.75 chaos=0.90 organicity=0.45
// @euclid zone    gentle..peak
// @euclid vibes   techno-club+rave
// @euclid param   u_links  float -1.0 1.0 0.0 "Links"
// @euclid param   u_trails float -1.0 1.0 0.0 "Trails"
// @euclid gene    G_LAYERS struct int   1    3     2    c:+0.4
// @euclid gene    G_DENS   expr   float 3.0  12.0  6.0  c:+0.5 a:+0.2
// @euclid gene    G_LINK   expr   float 0.6  1.6   1.1  o:+0.4
// @euclid gene    G_JITTER expr   float 0.0  1.0   0.35 a:+0.6 c:+0.5
// @euclid gene    G_HUE    expr   float 0.0  1.0   0.35 c:+0.3
// @euclid gene    G_SEED   expr   float 0.0  100.0 0.0
// Theia 2.0 · contract v2 — migrated by scripts/migrate_atoms_v2.js (WAVE 8279)

uniform float u_links;    // Regla del Cero Neutro: 0 = diseño canónico
uniform float u_trails;

#ifndef G_LAYERS
#define G_LAYERS 2.0
#endif
#ifndef G_DENS
#define G_DENS 6.0
#endif
#ifndef G_LINK
#define G_LINK 1.1
#endif
#ifndef G_JITTER
#define G_JITTER 0.35
#endif
#ifndef G_HUE
#define G_HUE 0.35
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif

#define PI         3.14159265359
#define TAU        6.28318530718
#define LAYERS_MAX 3

// ── Theia 2.0 · capa reactiva v2 (inyectado por migrate_atoms_v2) ──
// Vacío rítmico v2: rampa suave sobre u_rhythmicVoid (el flag binario
// RHYTHMIC_VOID era ≥0.75 — mismo centro, sin salto de fotograma).
float euVoidAmt() { return smoothstep(0.6, 0.9, u_rhythmicVoid); }
// Atenuación del vacío + rebote ∝ a lo que duró (u_voidRelease, §2.3).
float euVoidGate(float k) { return mix(1.0, k, euVoidAmt()) * (1.0 + 0.6 * u_voidRelease); }
// Caja v2: manda la caja MACD verdadera; el pulso legado se atenúa con
// la presencia vocal (su fuente de falsos positivos). Sin página B viva
// (u_vocalIsolation = 0) el pulso legado queda intacto.
float euSnare() { return max(u_snareTruePulse, u_snarePulse * (1.0 - 0.7 * u_vocalIsolation)); }

// ── Canales globales (una evaluación por píxel) ─────────────────────────
float gBeats, gGlitch, gLinkGain, gBeatP;

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// Posición de la luciérnaga de la celda `id` (en [0,1]² local).
vec2 fireflyPos(vec2 id, float layer) {
  vec2 h = hash22(id + layer * 31.7 + G_SEED);
  // Órbita continua (obedece SPEED).
  vec2 o = 0.5 + 0.36 * sin(gBeats * (0.5 + h * 1.5) * PI * 0.5 + h * TAU);
  // Nervio: temblor cuantizado a 24 Hz que el hi-hat amplifica.
  vec2 j = hash22(id + floor(u_time * 24.0) + layer) - 0.5;
  o += j * G_JITTER * (0.08 + 0.5 * u_hihatEnergy);
  // Glitch: teletransporte — saltos discretos a otra posición de la celda.
  if (gGlitch > 0.01) {
    float q = floor(gBeats * 4.0);
    float tp = step(1.0 - 0.6 * gGlitch, hash21(id + q + layer));
    o = mix(o, hash22(id + q + 7.7), tp);
  }
  return clamp(o, 0.02, 0.98);
}

float segDist(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

vec3 swarmLayer(vec2 uv, float layer) {
  vec2 x  = uv * (G_DENS * (1.0 + 0.7 * layer)) + layer * 17.3;
  vec2 ip = floor(x);
  vec2 fp = fract(x);

  vec2  pts[9];
  float d1 = 8.0;
  float d2 = 8.0;
  vec2  p0 = vec2(0.0);
  vec2  id0 = ip;
  int k = 0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 r = g + fireflyPos(ip + g, layer) - fp;
      pts[k] = r;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; p0 = r; id0 = ip + g; }
      else if (d < d2) { d2 = d; }
      k++;
    }
  }

  float h0 = hash21(id0 + layer * 5.1);
  vec3 hue = palette(G_HUE + u_chromaHue * 0.4 + h0 * 0.25, vec3(0.5), vec3(0.5),
                     vec3(1.0), vec3(0.0, 0.33, 0.67));
  // Cada luciérnaga canta una clase de altura del cromagrama.
  float sing = 0.35 + 1.4 * u_chroma(floor(h0 * 12.0));

  // Sinapsis: enlaces desde la luciérnaga más cercana a sus vecinas.
  float link = 0.0;
  float lmax = G_LINK * (1.0 - 0.35 * gBeatP);
  for (int m = 0; m < 9; m++) {
    vec2 pk = pts[m];
    float L = length(pk - p0);
    if (L < 1e-3 || L > lmax) continue;
    float hs;
    float sd = segDist(vec2(0.0), p0, pk, hs);
    float fade = 1.0 - L / lmax;
    // Paquetes de datos corriendo por el enlace (reloj → SPEED).
    float pulse = exp(-abs(fract(hs - gBeats * 1.5 + hash21(pk + p0)) - 0.5) * 18.0);
    link += exp(-sd * 55.0) * fade * fade * (0.25 + 0.9 * pulse);
  }

  float dd  = sqrt(d1);
  float fly = 0.0022 / (dd * dd + 0.0022);                           // núcleo + halo
  float membrane = 1.0 - smoothstep(0.0, 0.05, sqrt(d2) - dd);      // pared celular

  // Snare: celdas que se encienden por dentro (sorteo por golpe).
  float fill = step(0.82, hash21(id0 + floor(u_beatTime * 2.0))) * euSnare();

  vec3 col = hue * fly * sing * (1.0 + 2.5 * u_kickPulse);
  col += hue * hue * link * gLinkGain;
  col += hue * membrane * 0.05;
  col += hue * fill * 0.35 * (1.0 - smoothstep(0.0, 0.6, dd));
  return col;
}

vec3 swarm(vec2 suv) {
  vec3 col = vec3(0.0);
  for (int l = 0; l < LAYERS_MAX; l++) {
    if (float(l) >= G_LAYERS) break;
    col += swarmLayer(suv, float(l)) / (1.0 + 0.8 * float(l));      // parallax: capas lejanas tenues
  }
  return col;
}

void mainImage(out vec4 c, in vec2 fragCoord) {
  // ── 1. CANALES ─────────────────────────────────────────────────────
  float glitch, live, groove;
  euChannels(glitch, live, groove);
  gBeats   = u_beatTime + u_time * 0.05;
  gGlitch  = glitch;
  // 🔫 WAVE 8287 · Clean Shot — condensación basal por beat/compás; el
  // colapso de la red solo con clip físico vivo (fx).
  float fx    = u_activeEffectEnergy;
  gBeatP      = 0.5 + 0.5 * cos(6.2831853 * u_beatPhase) * u_speed;
  float swell = sin(3.1415927 * u_barPhase) * u_speed;
  // Kick: descarga sináptica — toda la red de enlaces dispara a la vez.
  gLinkGain = (0.6 + 0.4 * u_links) * (1.0 + 3.0 * fx + 0.8 * euSnare() + 2.0 * u_kickPulse);

  vec2 uv = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;
  float r = length(uv);

  // ── 2. DINÁMICA DEL ENJAMBRE — dominio radial ─────────────────────
  // Beat/compás: el enjambre se condensa y enrosca con el pulso musical.
  // Bombo: estalla hacia fuera (transitorio — golpea a cualquier SPEED).
  float contract = 1.0 + 0.8 * gBeatP + 1.4 * fx;
  float burst    = 1.0 + 1.5 * u_kickPulse + 0.35 * u_bass * live;
  vec2 suv = uv * contract / burst;
  suv = rot2(gBeats * TAU / 64.0 + 0.8 * gBeatP * r + 0.3 * swell) * suv;

  // ── 3. RENDER — con separación RGB cuántica bajo glitch ───────────
  vec3 col;
  if (glitch > 0.01) {
    vec2 off = vec2(0.012 + 0.03 * glitch, 0.0) * (hash21(vec2(floor(gBeats * 8.0), G_SEED)) - 0.3);
    col = vec3(swarm(suv + off).r, swarm(suv).g, swarm(suv - off).b);
  } else {
    col = swarm(suv);
  }
  col *= live;

  // ── 4. TRANSITORIOS GLOBALES ──────────────────────────────────────
  vec3 comp = palette(u_chromaHue + 0.5, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  col += comp * fx * 0.6 * exp(-r * 3.0);
  col += comp * comp * 0.03 * (0.3 + u_subBass) / (r + 0.08) * live;     // núcleo gravitatorio

  // ── 5. TENSIÓN + EXPOSICIÓN LINEAL ─────────────────────────────────
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum) * vec3(0.95, 1.0, 1.15), 0.45 * fx);
  col *= euVoidGate(0.4);
  col *= 1.0 + 0.6 * u_energy;
  col *= 1.0 - 0.25 * dot(uv, uv);

  // ── 6. MEMORIA — estelas de las luciérnagas (deriva con el estallido)
  if (u_hasPrev > 0.5) {
    vec2 st = fragCoord / u_resolution.xy - 0.5;
    st *= 0.994 - 0.02 * u_kickPulse + 0.01 * fx;                   // estalla fuera · implosiona
    vec3 prev = texture(u_prevFrame, st + 0.5).rgb;
    prev *= prev;                                                   // sRGB → lineal (aprox. γ2)
    float persist = clamp(0.78 + 0.12 * u_trails - 0.3 * glitch, 0.0, 0.93);
    col = max(col, prev * persist);
  }
  c = vec4(col, 1.0);
}
