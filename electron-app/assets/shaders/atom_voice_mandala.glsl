// @euclid name    "Voice Mandala"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  kaleido+ether
// @euclid genome  aggression=0.30 chaos=0.45 organicity=0.90
// @euclid zone    valley..intense
// @euclid param   u_order  float -1.0 1.0 0.0 "Order"
// @euclid param   u_throat float -1.0 1.0 0.0 "Throat"
// @euclid gene    G_FOLD   struct int   4    9     6    c:+0.3 o:+0.3
// @euclid gene    G_WARP   expr   float 0.10 0.45  0.26 c:+0.7 o:-0.2
// @euclid gene    G_RINGS  expr   float 10.0 22.0  14.0 o:+0.4
// @euclid gene    G_BREATH expr   float 0.8  2.6   1.7  o:+0.5
// @euclid gene    G_HUE    expr   float 0.0  1.0   0.12 c:+0.2
// @euclid gene    G_SEED   expr   float 0.0  100.0 0.0
// Theia 2.0 · contract v2 — WAVE 8279 · D1 "La Voz Interior"
//
// Sin voz, el átomo es un campo caótico de fBm con domain warping. Cuando
// entra una voz pura el caos se ORDENA: el warp se relaja, la simetría se
// multiplica y aparece una garganta — anillos estacionarios que respiran
// con la fase PROPIA de la voz (u_vocalTime avanza solo mientras hay voz:
// si calla, la geometría se congela en lugar de saltar).

uniform float u_order;    // Regla del Cero Neutro: 0 = diseño canónico
uniform float u_throat;

#ifndef G_FOLD
#define G_FOLD 6.0
#endif
#ifndef G_WARP
#define G_WARP 0.26
#endif
#ifndef G_RINGS
#define G_RINGS 14.0
#endif
#ifndef G_BREATH
#define G_BREATH 1.7
#endif
#ifndef G_HUE
#define G_HUE 0.12
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif

#define PI   3.14159265359
#define TAU  6.28318530718
#define LUMA vec3(0.2126, 0.7152, 0.0722)

// Caos de fondo — lo que la voz viene a ordenar (4 octavas, ~[-1,1]).
float fbm(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * noise3(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}

// Mandala de n pliegues ENTEROS: pétalos espejados + anillos armónicos.
// af ∈ [0,1] = 0 en el eje del pétalo, 1 en la costura del espejo.
float mandala(float a, float r, float n, float k, float vt) {
  float seg = TAU / n;
  float af = abs(mod(a, seg) - 0.5 * seg) / (0.5 * seg);
  float rings = 0.5 + 0.5 * cos(r * k - vt * 3.0 + af * 2.0);
  float petal = smoothstep(0.95, 0.15, af + 0.35 * sin(r * k * 0.5 - vt * 2.0));
  return rings * (0.3 + 0.7 * petal);
}

void mainImage(out vec4 c, in vec2 fragCoord) {
  // ── 1. CANALES ─────────────────────────────────────────────────────
  float tc, td, glitch, live, groove;
  euChannels(tc, td, glitch, live, groove);
  float beats = u_beatTime + u_time * 0.05;
  float rel   = u_impact;

  // Voz = peso convexo de euTimbre × presencia sostenida (una sílaba
  // suelta no basta para ordenar el universo).
  // 🔬 WAVE 8283 — remapeo AGRESIVO: smoothstep(0.10→0.35) sobre T.x.
  // Con euTimbre lineal (WAVE 8282) una voz real en mezcla masterizada
  // aporta ~0.30 — el umbral viejo la dejaba a medio gas (65% de caos
  // residual). Ahora T.x≈0.30 → orden total, warp = 0. El sustain sigue
  // de gate: el pico aislado no basta, la frase sostenida sí.
  vec4  T     = euTimbre();
  float voice = clamp(smoothstep(0.10, 0.35, T.x) * (0.55 + 0.45 * u_vocalSustain) * (1.0 + 0.5 * u_order), 0.0, 1.0);
  float order = smoothstep(0.05, 0.6, voice);
  float vt    = u_vocalTime * G_BREATH;                 // ∫voz·dt — Ley 1

  vec2 uv = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;
  uv *= 1.0 + 0.3 * tc - 0.2 * td;                      // tensión contrae · breakdown abre

  // ── 2. LA VOZ ORDENA — el warp se relaja con la presencia vocal ────
  float wa = (1.0 - order) * G_WARP * (0.6 + 0.4 * live);
  vec2 q = uv + wa * vec2(fbm(vec3(uv * 3.0, beats * 0.2 + G_SEED)),
                          fbm(vec3(uv * 3.0 + 7.1, beats * 0.2)));
  float r = length(q);
  float a = atan(q.y, q.x);

  // Capa CAOS: nebulosa de fBm con filamentos (lo que había antes de la voz).
  float n  = fbm(vec3(q * 2.4, beats * 0.12 + G_SEED));
  float fil = 1.0 - abs(fbm(vec3(q * 5.0 + n, beats * 0.2)));
  vec3 chaosHue = palette(u_chromaHue + 0.35 * n + G_HUE, vec3(0.5), vec3(0.5),
                          vec3(1.0), vec3(0.0, 0.33, 0.67));
  vec3 chaos = chaosHue * (0.18 * smoothstep(-0.3, 0.7, n) + 0.35 * fil * fil * fil * fil);
  chaos *= 0.4 + 0.6 * u_energy;

  // Capa MANDALA: la simetría se duplica con la voz — mezcla entre dos
  // pliegues ENTEROS (sin costura en a=±π durante la transición).
  float foldF = mix(G_FOLD, G_FOLD * 2.0, order);
  float f0 = floor(foldF);
  float spin = a + beats * TAU / 64.0;
  float k  = mix(G_RINGS, G_RINGS * 3.0, u_melodicity);   // más melodía → más armónicos
  float mand = mix(mandala(spin, r, f0, k, vt), mandala(spin, r, f0 + 1.0, k, vt), foldF - f0);

  // Garganta: el anillo principal respira con la frase.
  float throatR = 0.28 + 0.04 * sin(vt) + 0.06 * u_throat;
  float throat  = exp(-9.0 * abs(r - throatR));

  vec3 vox = palette(u_chromaHue + G_HUE + 0.08 * sin(vt), vec3(0.5), vec3(0.5),
                     vec3(1.0), vec3(0.0, 0.15, 0.3));

  // ── 3. COMPOSICIÓN — el fondo cede el color a la voz ───────────────
  vec3 col = chaos;
  col = mix(col, vec3(dot(col, LUMA)), 0.5 * order);
  col *= 1.0 - 0.55 * order;
  col += order * (throat * 1.4 + mand * 0.55 * exp(-1.4 * r)) * vox;
  col += order * mand * throat * 0.8 * vox * vox;          // nudos: pétalo × garganta
  col += u_vocalOnset * 0.5 * throat * vox;                // entrada de frase: bloom lento
  col += u_vocalOnset * 0.15 * vox * exp(-3.0 * r);

  // ── 4. TRANSITORIOS — golpean el caos, respetan la voz ─────────────
  float hitMask = 1.0 - 0.7 * order;
  col += u_kickPulse * 0.45 * hitMask * exp(-abs(r - 0.55 - 0.1 * u_kickPulse) * 10.0) * chaosHue;
  col += u_snareTruePulse * 0.35 * hitMask * fil * fil * vec3(0.8, 0.9, 1.0);
  col += rel * 0.4 * palette(u_chromaHue + 0.5, vec3(0.5), vec3(0.5), vec3(1.0),
                             vec3(0.0, 0.33, 0.67)) * exp(-2.5 * r);
  col += step(0.992 - 0.02 * u_ultraAir, hash21(floor(fragCoord * 0.5) + floor(beats * 4.0)))
       * u_hihatEnergy * hitMask * vec3(1.2);
  if (glitch > 0.01) {
    float h = hash21(vec2(floor(fragCoord.y / 6.0), floor(beats * 8.0)));
    col = mix(col, col.bgr, step(1.0 - 0.3 * glitch, h) * glitch);
  }

  // ── 5. TENSIÓN + VACÍO (v2: rampa suave + rebote ∝ al vacío) ───────
  float lum = dot(col, LUMA);
  col = mix(col, vec3(lum) * vec3(1.05, 0.95, 1.1), 0.45 * tc);
  col *= mix(1.0, 0.4, smoothstep(0.6, 0.9, u_rhythmicVoid));
  col *= 1.0 + 0.6 * u_voidRelease;

  // ── 6. MEMORIA — la voz deja eco (estela más larga cuanto más canta) ─
  if (u_hasPrev > 0.5) {
    vec2 f = fragCoord / u_resolution.xy;
    vec3 prev = texture(u_prevFrame, f).rgb;
    prev *= prev;                                          // sRGB → lineal (aprox. γ2)
    float persist = clamp(0.55 + 0.35 * order - 0.25 * glitch, 0.0, 0.92);
    col = max(col, prev * persist);
  }

  // ── 7. EXPOSICIÓN LINEAL — el epílogo posee ACES + sRGB ────────────
  col *= (1.0 + 0.5 * u_energy) * (0.5 + 0.5 * live);
  col *= 1.0 - 0.3 * dot(uv, uv);
  c = vec4(col, 1.0);
}
