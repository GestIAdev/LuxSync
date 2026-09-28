// @euclid name    "Sacred Bouncer"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  kifs+kaleido
// @euclid genome  aggression=0.65 chaos=0.40 organicity=0.75
// @euclid zone    gentle..peak
// @euclid param   u_bounce float -1.0 1.0 0.0 "Bounce"
// @euclid param   u_bloom  float -1.0 1.0 0.0 "Bloom"
// @euclid gene    G_SYM      struct int   4    12    8    a:+0.2 c:+0.3 o:+0.2
// @euclid gene    G_ITER     struct int   4    9     6    c:+0.5
// @euclid gene    G_SCALE    expr   float 1.2  2.2   1.55 a:+0.4 c:+0.4
// @euclid gene    G_FOLD     expr   float 0.2  0.9   0.45 c:+0.6 o:-0.2
// @euclid gene    G_HUE_STEP expr   float 0.02 0.3   0.09 c:+0.4 o:+0.3
// @euclid gene    G_SEED     expr   float 0.0  100.0 0.0
// Theia 2.0 · contract v2 — migrated by scripts/migrate_atoms_v2.js (WAVE 8279)

uniform float u_bounce;   // Regla del Cero Neutro: 0 = diseño canónico
uniform float u_bloom;

#ifndef G_SYM
#define G_SYM 8.0
#endif
#ifndef G_ITER
#define G_ITER 6.0
#endif
#ifndef G_SCALE
#define G_SCALE 1.55
#endif
#ifndef G_FOLD
#define G_FOLD 0.45
#endif
#ifndef G_HUE_STEP
#define G_HUE_STEP 0.09
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif

#define PI       3.14159265359
#define TAU      6.28318530718
#define ITER_MAX 9

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

void mainImage(out vec4 c, in vec2 fragCoord) {
  // ── 1. CANALES ─────────────────────────────────────────────────────
  float tc, td, glitch, live, groove;
  euChannels(tc, td, glitch, live, groove);
  float beats = u_beatTime + u_time * 0.04;
  float rel   = u_impact;
  float dir   = mod(G_SEED, 2.0) < 1.0 ? 1.0 : -1.0;

  vec2 uv = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;

  // ── 2. EL REBOTE — transitorios en tiempo real (inmunes a SPEED) ────
  float gain  = 1.0 + 0.5 * u_bounce;
  float punch = (0.55 * u_kickPulse + 0.30 * u_bass * live) * gain;
  uv /= 1.0 + 0.55 * punch;                                  // expansión brusca
  uv.y *= 1.0 + 0.16 * u_kickPulse * gain;                   // squash & stretch
  uv.x *= 1.0 - 0.09 * u_kickPulse * gain;
  uv *= 1.0 + 0.35 * tc - 0.25 * td;                          // tensión contrae · breakdown abre

  // ── 3. CALEIDOSCOPIO — rotación continua al compás (obedece SPEED) ──
  float r = length(uv);
  float a = atan(uv.y, uv.x) + dir * (beats * TAU / 32.0) + euSnare() * 0.25;
  float seg = TAU / G_SYM;
  a = mod(a, seg);
  a = abs(a - 0.5 * seg);
  if (glitch > 0.01) a = mix(a, floor(a * 20.0) / 20.0, glitch);   // desgarro polar
  vec2 p = vec2(cos(a), sin(a)) * r;

  // Deriva orgánica: el dominio respira con ruido lento.
  p += 0.04 * live * vec2(noise3(vec3(p * 3.0, beats * 0.25 + G_SEED)),
                          noise3(vec3(p * 3.0 + 7.3, beats * 0.25)));

  // ── 4. KIFS — plegado iterado; el bajo abre la escala ──────────────
  float sc   = G_SCALE + 0.25 * u_bass + 0.35 * u_kickPulse * gain;
  float ang  = G_FOLD + 0.2 * sin(beats * PI * 0.25) + 0.4 * u_kickPulse;
  vec2  off  = vec2(0.55 + 0.1 * sin(beats * PI * 0.5), 0.32);
  vec2  q    = p * 1.7;
  float s    = 1.0;
  float trap = 1e3;
  float trapI = 0.0;
  vec3  col  = vec3(0.0);
  for (int i = 0; i < ITER_MAX; i++) {
    if (float(i) >= G_ITER) break;
    q = abs(q) - off;
    q = rot2(ang + float(i) * 0.12) * q;
    q *= sc;
    s *= sc;
    // Filamentos: distancia a los ejes del pliegue, en espacio original.
    float line = min(abs(q.x), abs(q.y)) / s;
    float width = 0.0025 * (1.0 + 2.0 * td);
    vec3 hue = palette(u_chromaHue + float(i) * G_HUE_STEP,
                       vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
    col += hue * width / (line + width) * (0.35 + 0.08 * float(i));
    float d = length(q) / s;
    if (d < trap) { trap = d; trapI = float(i); }
  }

  // Orbit trap: joyas en los nodos del fractal, pulsan con el kick.
  vec3 gem = palette(u_chromaHue + 0.33 + trapI * G_HUE_STEP,
                     vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.1, 0.2, 0.3));
  col += gem * exp(-trap * 40.0) * (0.8 + 2.4 * u_kickPulse) * (1.0 + 0.5 * u_bloom);
  col *= live;

  // ── 5. TRANSITORIOS — flash y chispas ─────────────────────────────
  // Kick: las costuras de espejo del caleidoscopio se encienden como
  // rayos de una estrella (distancia al eje de simetría más cercano).
  float seam = min(a, 0.5 * seg - a) * r;
  col += u_kickPulse * 1.1 * exp(-seam * 90.0) * smoothstep(0.02, 0.2, r) * exp(-r * 1.3)
       * palette(u_chromaHue + 0.15, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  // Impact: halo complementario (nota dominante → su opuesta).
  col += rel * 0.8 * palette(u_chromaHue + 0.5, vec3(0.5), vec3(0.5), vec3(1.0),
                             vec3(0.0, 0.33, 0.67)) * exp(-2.5 * r);
  // Hi-hat: destellos en las puntas del fractal.
  col += step(0.992 - 0.02 * u_ultraAir, hash21(floor(fragCoord * 0.5) + floor(beats * 4.0)))
       * u_hihatEnergy * exp(-trap * 10.0) * vec3(1.5);
  // Ojo central: el sub-bass lo hace latir.
  col += gem * 0.02 / (r + 0.03) * (0.3 + u_subBass) * live;

  // ── 6. TENSIÓN + EXPOSICIÓN LINEAL ─────────────────────────────────
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum) * vec3(1.05, 0.95, 1.1), 0.55 * tc);
  if (ACID) col *= 0.75 + 0.25 * sin(vec3(0.0, 2.1, 4.2) + r * 16.0 - beats * PI);
  col *= euVoidGate(0.4);
  col *= 1.0 + 0.6 * u_energy;
  col *= 1.0 - 0.3 * dot(uv, uv);
  c = vec4(col, 1.0);
}