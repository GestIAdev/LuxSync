// @euclid name    "Tribu Mental"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  swarm+conformal
// @euclid genome  aggression=0.60 chaos=0.75 organicity=0.65
// @euclid zone    gentle..peak
// @euclid param   u_trails float -1.0 1.0 0.0 "Trails"
// @euclid param   u_swarm  float -1.0 1.0 0.0 "Swarm"
// @euclid gene    G_FOLD   struct int   5    12    8    a:+0.4 c:+0.3
// @euclid gene    G_KNOT_A struct int   1    5     3    c:+0.7
// @euclid gene    G_KNOT_B struct int   1    4     2    c:+0.5 o:-0.2
// @euclid gene    G_PERIOD expr   float 0.6  1.4   0.9  o:+0.5 a:-0.3
// @euclid gene    G_ZOOM   expr   float 0.05 0.5   0.25 a:+0.6
// @euclid gene    G_SEED   expr   float 0.0  100.0 0.0

uniform float u_trails;   // Regla del Cero Neutro: 0 = diseño canónico
uniform float u_swarm;

#ifndef G_FOLD
#define G_FOLD 8.0
#endif
#ifndef G_KNOT_A
#define G_KNOT_A 3.0
#endif
#ifndef G_KNOT_B
#define G_KNOT_B 2.0
#endif
#ifndef G_PERIOD
#define G_PERIOD 0.9
#endif
#ifndef G_ZOOM
#define G_ZOOM 0.25
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif

#define PI        3.14159265359
#define TAU       6.28318530718
#define SWARM_MAX 24

void mainImage(out vec4 c, in vec2 fragCoord) {
  // ── 1. CANALES (§3.1 — euChannels del preámbulo: Ley de Uniformidad G6)
  float tc, td, glitch, live, groove;
  euChannels(tc, td, glitch, live, groove);
  float beats   = u_beatTime + u_time * 0.04;
  float rel     = u_impact;
  float aspect  = u_resolution.x / u_resolution.y;

  vec2 fc = fragCoord;
  if (glitch > 0.01) {
    float band = floor(fc.y / u_resolution.y * 32.0);
    float h = hash21(vec2(band, floor(beats * 4.0)));
    fc.x += step(1.0 - 0.3 * glitch, h) * (h - 0.5) * u_resolution.x * 0.12 * glitch;
  }
  vec2 uv = (fc - 0.5 * u_resolution.xy) / u_resolution.y;

  // ── 2. ESPACIO CONFORME: log-polar + zoom infinito (Droste) ─────────
  float r  = max(length(uv), 1e-4);
  float th = atan(uv.y, uv.x);
  // Ley de la Derivada: sumar tc (= a²) a la FASE acelera el zoom mientras
  // la tensión sube (velocidad extra = da²/dt) — jamás un salto.
  float zoom = beats * G_ZOOM + 0.8 * tc + 0.6 * rel;
  float lz   = log(r) - zoom;
  float ring = floor(lz / G_PERIOD);                    // profundidad del anillo
  float lw   = mod(lz, G_PERIOD) - 0.5 * G_PERIOD;      // [-P/2, P/2)
  float dir  = mod(ring, 2.0) * 2.0 - 1.0;              // contrarrotación tribal
  float spin = dir * (beats * TAU / 16.0 + 1.5 * tc) + u_snarePulse * 0.15;
  float seg  = TAU / G_FOLD;
  float ta   = abs(mod(th + spin, seg) - 0.5 * seg);    // grupo diédrico D_n
  if (glitch > 0.01) ta = mix(ta, floor(ta * 24.0) / 24.0, glitch);  // desgarro polar
  vec2 s = vec2(lw, ta);   // celda conforme: los ángulos se preservan en todo el zoom

  // ── 3. ENJAMBRE: N cargas sobre nudos de Lissajous ──────────────────
  float nLive  = mix(8.0, float(SWARM_MAX), clamp(u_morphFactor + 0.5 * u_swarm, 0.0, 1.0));
  float spread = (1.0 - 0.8 * tc) * (1.0 + 1.8 * rel) * (1.0 + 0.3 * u_kickPulse) * (1.0 + 0.6 * td);
  vec2  center = vec2(0.0, 0.25 * seg);
  vec2  ext    = vec2(0.42 * G_PERIOD, 0.25 * seg);
  float sat    = 0.5 * (0.35 + 0.65 * u_saturation);
  float pot    = 0.0;
  vec3  glow   = vec3(0.0);
  for (int i = 0; i < SWARM_MAX; i++) {
    float fi = float(i);
    float w  = clamp(nLive - fi, 0.0, 1.0);    // aparición fraccional: sin pops
    if (w <= 0.0) break;
    float ph    = fi * 2.39996323;             // ángulo áureo: reparto sin clusters
    float swing = groove * u_syncopation * 0.8 * sin(fi * 1.3 + G_SEED);
    float a     = beats * TAU / 8.0 + ph + swing;          // un ciclo cada 2 compases
    vec2  knot  = vec2(sin(G_KNOT_A * a + G_SEED), sin(G_KNOT_B * a + ph));
    vec2  dv    = s - (center + knot * ext * spread);
    int   pitch = i % 12;                                  // cada carga canta una nota
    float q     = w * (0.25 + 1.6 * u_chroma(pitch)) * (0.0009 + 0.0022 * u_energy) * live;
    float g     = q / (dot(dv, dv) + 0.00035 + 0.0015 * td);
    pot  += g;
    float hue = u_chromaHue + mod(float(pitch) * 7.0, 12.0) / 12.0;  // círculo de quintas
    glow += g * palette(hue, vec3(0.5), vec3(sat), vec3(1.0), vec3(0.0, 0.33, 0.67));
  }

  // ── 4. ISOLÍNEAS DEL POTENCIAL: tatuaje tribal que fluye con el beat ─
  float freq = ACID ? 7.0 : 3.0;                          // 303 → resonancia de contornos
  float iso  = fract(log(1.0 + pot) * freq - beats * 0.5);
  float line = 1.0 - smoothstep(0.0, 0.05 + 0.05 * u_mid, abs(iso - 0.5));
  line *= (0.2 + 0.8 * u_mid) * smoothstep(0.05, 0.6, pot);

  vec3 lineCol = palette(u_chromaHue + 0.5 + ring * 0.08, vec3(0.5), vec3(sat),
                         vec3(1.0), vec3(0.1, 0.35, 0.6));
  vec3 bg = palette(u_chromaHue + ring * 0.07, vec3(0.03), vec3(0.035), vec3(1.0),
                    vec3(0.2, 0.1, 0.3)) * (0.4 + u_lqFloor);
  // Onda de kick: nace en el borde interior del anillo y viaja hacia fuera.
  float kr = u_kickPulse * exp(-abs(lw - (0.5 - u_kickPulse) * G_PERIOD) * 60.0);
  // Hi-hats: polvo estelar granular re-sorteado cada semicorchea.
  float sp = hash21(floor(s * 140.0) + floor(beats * 8.0));

  vec3 col = bg + glow + (1.4 * line + 1.2 * kr) * lineCol;
  col += step(0.985 - 0.02 * u_ultraAir, sp) * u_hihatEnergy * vec3(1.2);
  col *= smoothstep(0.0, 0.06, r);                        // anti-alias de la singularidad
  // El ojo del mandala respira con el sub-bass.
  col += palette(u_chromaHue + 0.25, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67))
       * 0.015 / (r + 0.02) * (0.3 + u_subBass) * live;

  // ── 5. CONSERVACIÓN DE LA TENSIÓN — color ───────────────────────────
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum) * vec3(1.0, 0.95, 1.1), 0.6 * tc);
  col += rel * 0.3 * palette(u_chromaHue + 0.5, vec3(0.5), vec3(0.5), vec3(1.0),
                             vec3(0.0, 0.33, 0.67)) * exp(-2.0 * r);
  col *= 1.2;  // exposición lineal — el epílogo posee ACES + sRGB (WAVE 8256)
  if (RHYTHMIC_VOID) col *= 0.4;                          // el silencio rítmico deja eco

  // ── 6. MEMORIA: feedback conforme sobre u_prevFrame ─────────────────
  if (u_hasPrev > 0.5) {
    vec2 f = fragCoord / u_resolution.xy - 0.5;           // uv normalizado: paridad Modo A/B
    f.x *= aspect;
    f *= 0.992 - 0.03 * rel + 0.012 * tc;                 // <1 estela expansiva · >1 implosiva
    f  = rot2(0.006 * (1.0 + u_bass) * dir) * f;
    f.x /= aspect;
    vec3 prev = texture(u_prevFrame, f + 0.5).rgb;
    prev *= prev;                                         // sRGB → lineal (aprox. γ2)
    float persist = clamp(0.82 + 0.10 * u_trails + (RHYTHMIC_VOID ? 0.12 : 0.0)
                          - 0.25 * glitch, 0.0, 0.96);
    col = max(col, prev * persist);                       // max-blend: estable, sin acumulación
  }
  c = vec4(col, 1.0);
}
