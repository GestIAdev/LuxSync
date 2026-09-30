// @euclid name    "Marea Caribeña"
// @euclid author  "LuxSync · Pack Latino"
// @euclid family  ether+fluid
// @euclid genome  aggression=0.20 chaos=0.30 organicity=1.00
// @euclid zone    valley..active
// @euclid vibes   fiesta-latina, cumbia, chill, mar, agua
// @euclid param   u_tide  float -1.0 1.0 0.0 "Tide"
// @euclid param   u_glow  float -1.0 1.0 0.0 "Glow"
// @euclid gene    G_FLOW   expr   float 0.1  2.5  1.0  o:+0.4
// @euclid gene    G_SCALE  expr   float 0.6  2.2  1.0  o:+0.3
// @euclid gene    G_SHARP  expr   float 4.0  14.0 8.0  c:+0.3
// @euclid gene    G_BIO    expr   float 0.0  2.5  1.0  o:+0.4
// @euclid gene    G_SWIRL  expr   float 0.3  3.0  1.0  c:+0.5 a:+0.3
// @euclid gene    G_LAYERS struct int   2    4    3    o:+0.3
// Theia 2.0 · contract v2 — migrated by scripts/migrate_atoms_v2.js (WAVE 8279)

uniform float u_tide;    // Regla del Cero Neutro: 0 = diseño canónico
uniform float u_glow;

#ifndef G_FLOW
#define G_FLOW 1.0
#endif
#ifndef G_SCALE
#define G_SCALE 1.0
#endif
#ifndef G_SHARP
#define G_SHARP 8.0
#endif
#ifndef G_BIO
#define G_BIO 1.0
#endif
#ifndef G_SWIRL
#define G_SWIRL 1.0
#endif
#ifndef G_LAYERS
#define G_LAYERS 3
#endif

#define TAU 6.28318530718

// ── Paleta caribeña (espacio LINEAL — el epílogo posee ACES + sRGB) ──
const vec3 C_DEEP    = vec3(0.00, 0.30, 0.40);   // turquesa denso (fondo)
const vec3 C_SHALLOW = vec3(0.02, 0.50, 0.54);   // agua baja esmeralda
const vec3 C_CREST   = vec3(0.10, 0.92, 0.78);   // cian brillante de cresta
const vec3 C_BIO_A   = vec3(1.00, 0.45, 0.10);   // ámbar bioluminiscente
const vec3 C_BIO_M   = vec3(0.85, 0.22, 0.55);   // magenta suave bioluminiscente
const vec3 C_STORM   = vec3(0.00, 0.85, 1.10);   // cian eléctrico (cataclismo)

// Vacío rítmico v2: rampa suave sobre u_rhythmicVoid + rebote (u_voidRelease).
float euVoidAmt() { return smoothstep(0.6, 0.9, u_rhythmicVoid); }
float euVoidGate(float k) { return mix(1.0, k, euVoidAmt()) * (1.0 + 0.6 * u_voidRelease); }

// ── Voronoi de puntos nadadores ─────────────────────────────────────
// Cada feature point orbita lentamente dentro de su celda (reloj `t` ya
// gobernado por SPEED vía u_beatTime → se congela solo). Devuelve
// (F1, F2, cellHash) — F2-F1 = distancia al borde de la red.
vec3 voroSwim(vec2 p, float t, float jit) {
  vec2 g = floor(p), f = fract(p);
  float F1 = 8.0, F2 = 8.0, id = 0.0;
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y));
    vec2 h = vec2(hash21(g + o), hash21(g + o + vec2(19.19, 7.77)));
    vec2 pt = o + 0.5 + jit * 0.42 * vec2(
      sin(t * 1.15 + TAU * h.x),
      cos(t * 0.95 + TAU * h.y));
    vec2 dv = pt - f;
    float d2 = dot(dv, dv);
    if (d2 < F1) { F2 = F1; F1 = d2; id = h.x + 0.37 * h.y; }
    else if (d2 < F2) { F2 = d2; }
  }
  return vec3(sqrt(F1), sqrt(F2), id);
}

// ────────────────────────────────────────────────────────────────────
void mainImage(out vec4 c, in vec2 fragCoord) {
  vec2 st = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;
  float glitch, live, groove;
  euChannels(glitch, live, groove);
  float k = u_activeEffectEnergy;

  // Relojes gobernados: u_beatTime/u_time ya llevan el fader SPEED dentro —
  // a SPEED=0 la corriente se congela sola, sin u_speed extra (§3).
  float t  = u_beatTime * 0.055 * G_FLOW * (1.0 + 3.0 * k); // corriente
  float t2 = u_beatTime * 0.021 * G_FLOW;                   // marejada lenta

  // ── Flujo sinuoso: el agua se MECE, nunca golpea ──
  float tideAmp = 1.0 + 0.45 * u_tide;
  vec2 w = st;
  w += 0.055 * tideAmp * vec2(
    sin(1.8 * st.y + t * 0.9),
    sin(2.1 * st.x - t * 0.7));
  w += 0.10 * tideAmp * vec2(
    noise3(vec3(st * 0.8, t * 0.8)),
    noise3(vec3(st * 0.8 + vec2(9.17, 4.41), t * 0.8)));
  // swing del groove: la corriente respira con la seguridad del pulso
  w += 0.05 * groove * vec2(
    noise3(vec3(st * 0.5, t * 1.4 + 3.0)),
    noise3(vec3(st * 0.5 + vec2(6.3, 1.9), t * 1.4)));
  // vaivén de compás — fase CRUDA → la desviación obedece SPEED (§3.1)
  w.y += 0.02 * sin(TAU * u_barPhase) * u_speed * tideAmp;

  // ── CATACLISMO DMX: el mar plácido se convierte en REMOLINO ──
  float r0 = length(st);
  if (k > 0.001) {
    // Cizalla diferencial 1/r: el eje gira mucho más rápido que el borde —
    // vórtice de gas, no rotación rígida. + estiramiento radial del caudal.
    w = rot2(k * G_SWIRL * 0.9 / (r0 + 0.22)) * w;
    w *= 1.0 + k * 0.30 * r0;
  }

  // ── Red acuática: Voronoi refractado en capas de paralaje ──
  // La tormenta desgaja las celdas (jit sube) y la red se filtra por capas.
  float jit = 0.55 + 0.85 * k;
  float cs = 0.0, edge = 0.0, wsum = 0.0;
  float bioF1 = 8.0, bioId = 0.0;
  vec2 wp = w;
  for (int i = 0; i < 4; i++) {
    if (i >= int(G_LAYERS)) break;
    float fi = float(i);
    vec3 v = voroSwim(wp * (3.6 * G_SCALE) + fi * vec2(17.31, 9.77),
                      t + fi * 0.73, jit);
    cs   += pow(clamp(1.0 - v.x, 0.0, 1.0), G_SHARP * (1.0 + 0.35 * fi))
          / (1.0 + 0.6 * fi);
    edge += (1.0 - smoothstep(0.0, 0.10 + 0.04 * k, v.y - v.x))
          / (1.0 + fi);
    if (i == 0) { bioF1 = v.x; bioId = v.z; }
    wsum += 1.0;
    wp = rot2(0.62) * wp * 1.23;   // paralaje entre estratos de luz
  }
  cs /= wsum;
  edge /= wsum;

  // ── Cuerpo de agua: profundidad → turquesa → esmeralda ──
  float swell = 0.5 + 0.5 * noise3(vec3(st * 0.45, t2));
  swell += 0.22 * u_bass;                       // el bajo hincha la marea
  vec3 col = mix(C_DEEP * 0.42, C_DEEP, clamp(swell, 0.0, 1.0));
  col = mix(col, C_SHALLOW, 0.35 * smoothstep(0.35, 0.9, swell));

  // Caústica refractada → crestas de luz cian (el vacío rítmico la calma).
  float ca = clamp(cs, 0.0, 1.0) * euVoidGate(0.40);
  col = mix(col, C_CREST, ca * 0.75);
  col += vec3(0.75, 0.95, 0.90) * pow(ca, 3.0) * 0.55;   // filos especulares

  // ── BIOLUMINISCENCIA de downbeat ──
  // Las intersecciones de la red (bordes F2≈F1) y el plancton en el centro
  // de cada celda emiten ámbar/magenta suave EXACTAMENTE al caer el compás:
  // método compliant §3 — envolvente exp(-k·fase) gobernada por u_speed.
  float pulse = exp(-4.0 * u_barPhase) * u_speed;
  float plankton = exp(-bioF1 * bioF1 * 22.0);          // puntos de luz vivos
  float bioAmt = (0.65 * plankton + 0.35 * clamp(edge, 0.0, 1.0))
               * pulse * G_BIO * (1.0 + 0.6 * u_glow);
  vec3 bioCol = mix(C_BIO_A, C_BIO_M, step(0.5, fract(bioId * 7.31)));
  col += bioCol * bioAmt;
  // brasa de percusión: el plancton también titila con el bombo (suave)
  col += bioCol * plankton * u_kickPulse * 0.22 * G_BIO;

  // ── Cataclismo: saturación a cian eléctrico radiactivo ──
  if (k > 0.001) {
    col += C_STORM * k * (0.35 + 0.65 * ca) * 0.9;
    col = mix(col, col * vec3(0.40, 1.15, 1.35), k * 0.55);
  }

  // Exposición musical suave + viñeta de profundidad (vista cenital).
  col *= (0.85 + 0.45 * u_energy) * (0.75 + 0.35 * live);
  col *= 1.0 - 0.25 * smoothstep(0.55, 1.25, r0);

  c = vec4(col, 1.0);
}
