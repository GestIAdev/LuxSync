// @euclid name    "Morphing Core"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  ether+metal
// @euclid genome  aggression=0.55 chaos=0.60 organicity=0.70
// @euclid zone    gentle..peak
// @euclid param   u_melt   float -1.0 1.0 0.0 "Melt"
// @euclid param   u_spikes float -1.0 1.0 0.0 "Spikes"
// @euclid gene    G_OCT   struct int   1    3     2    c:+0.5 o:+0.2
// @euclid gene    G_MORPH expr   float 0.0  1.0   0.35 c:+0.3 o:+0.3
// @euclid gene    G_FREQ  expr   float 1.0  4.0   2.2  c:+0.6
// @euclid gene    G_IRID  expr   float 0.5  3.0   1.4  o:+0.4
// @euclid gene    G_SPIN  expr   float 0.2  2.0   0.7  a:+0.4
// @euclid gene    G_SEED  expr   float 0.0  100.0 0.0
// @euclid steps   80
// Theia 2.0 · contract v2 — migrated by scripts/migrate_atoms_v2.js (WAVE 8279)

uniform float u_melt;     // Regla del Cero Neutro: 0 = diseño canónico
uniform float u_spikes;

#ifndef G_OCT
#define G_OCT 2.0
#endif
#ifndef G_MORPH
#define G_MORPH 0.35
#endif
#ifndef G_FREQ
#define G_FREQ 2.2
#endif
#ifndef G_IRID
#define G_IRID 1.4
#endif
#ifndef G_SPIN
#define G_SPIN 0.7
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif

#define PI      3.14159265359
#define TAU     6.28318530718
#define BOUND_R 2.7

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
float gAmp, gSpike, gMelt, gPhase, gMorph, gRotY, gRotZ;

vec3 toLocal(vec3 p) {
  p.xz = rot2(gRotY) * p.xz;
  p.xy = rot2(gRotZ) * p.xy;
  return p;
}

// Ruido de ebullición (octavas por gen struct).
float boil(vec3 q) {
  float n = noise3(q);
  if (G_OCT > 1.5) n += 0.5 * noise3(q * 2.1 + 3.7);
  if (G_OCT > 2.5) n += 0.25 * noise3(q * 4.3 + 7.1);
  return n;
}

// Pinchos: ruido ridged afilado — crestas finas que emergen con el impacto.
float ridge(vec3 p) {
  float r = 1.0 - abs(noise3(p * (G_FREQ * 1.7) + vec3(gPhase * 0.5, G_SEED, 0.0)));
  r *= r;
  return r * r;
}

float mapCore(vec3 p) {
  p = toLocal(p);
  float sph = length(p) - 1.25;
  float tor = sdTorus(p, vec2(1.15, 0.42));
  float d = mix(sph, tor, gMorph);
  d -= gAmp * boil(p * G_FREQ + vec3(0.0, gPhase, G_SEED));   // la superficie hierve
  d -= gSpike * ridge(p);                                      // erizado
  // Derretido: la mitad inferior gotea hacia abajo.
  float drip = smoothstep(0.1, -1.3, p.y) * (0.5 + 0.5 * noise3(vec3(p.xz * 4.0, gPhase)));
  d -= gMelt * drip * 0.6;
  return d;
}

vec3 calcNormal(vec3 p) {
  const vec2 e = vec2(1.0, -1.0) * 0.0015;
  return normalize(e.xyy * mapCore(p + e.xyy) + e.yyx * mapCore(p + e.yyx) +
                   e.yxy * mapCore(p + e.yxy) + e.xxx * mapCore(p + e.xxx));
}

// Estudio procedural para los reflejos del metal.
vec3 envMap(vec3 r) {
  vec3 hue = palette(u_chromaHue + 0.2, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  float strip1 = exp(-abs(r.y - 0.55) * 14.0);                        // softbox cenital
  float strip2 = exp(-abs(r.x + 0.75) * 9.0) * smoothstep(-0.2, 0.4, r.z);
  return vec3(0.008) + hue * hue * 0.35 * smoothstep(-0.3, 0.7, r.y)
       + vec3(1.6) * strip1 + hue * 1.2 * strip2;
}

void mainImage(out vec4 c, in vec2 fragCoord) {
  // ── 1. CANALES ─────────────────────────────────────────────────────
  float glitch, live, groove;
  euChannels(glitch, live, groove);
  float beats = u_beatTime + u_time * 0.05;
  // 🔫 WAVE 8287 · Clean Shot — la fusión extrema escala con la VIDA del
  // clip físico (fxAge): el núcleo se derrite solo mientras el disparo
  // corre en las luces, no por una predicción que "se acerca".
  float fx    = u_activeEffectEnergy;
  float fxAge = u_activeEffectAge;
  float beatP = 0.5 + 0.5 * cos(6.2831853 * u_beatPhase);

  // Relojes (obedecen SPEED): rotación lenta + ebullición continua.
  gRotY  = beats * TAU / 64.0 * G_SPIN;
  gRotZ  = 0.35 * sin(u_time * 0.07 * G_SPIN);
  gPhase = beats * 0.3;
  gMorph = clamp(G_MORPH + 0.25 * sin(beats * PI / 32.0), 0.0, 1.0);

  // Transitorios (tiempo real): amplitudes de la deformación.
  gAmp   = max(0.0, (0.08 + 0.38 * u_kickPulse + 0.22 * fx + 0.10 * u_bass) * live);
  gSpike = max(0.0, 0.03 + 0.45 * fx + 0.22 * euSnare() + 0.12 * beatP + 0.2 * u_spikes);
  gMelt  = max(0.0, 0.3 * u_melt + 0.7 * fx * fxAge);

  vec2 fc = fragCoord;
  if (glitch > 0.01) {
    float h = hash21(vec2(floor(fc.y / 7.0), floor(beats * 8.0)));
    fc.x += step(1.0 - 0.35 * glitch, h) * (h - 0.5) * u_resolution.x * 0.12 * glitch;
  }
  vec2 uv = (fc - 0.5 * u_resolution.xy) / u_resolution.y;

  // ── 2. CÁMARA ─────────────────────────────────────────────────────
  float camD = 4.6 - 0.6 * fx + 0.4 * u_kickPulse;               // el disparo acerca
  vec3 ro = vec3(0.0, 0.25, -camD);
  vec3 rd = normalize(vec3(uv, 1.5));

  // ── 3. RAYMARCH acotado por esfera envolvente ─────────────────────
  vec3 col = vec3(0.0);
  float b = dot(ro, rd);
  float disc = b * b - (dot(ro, ro) - BOUND_R * BOUND_R);
  float glow = 0.0;
  bool hit = false;
  float t = 0.0;
  if (disc > 0.0) {
    float sq = sqrt(disc);
    t = max(-b - sq, 0.0);
    float tExit = -b + sq;
    for (int i = 0; i < MAX_STEPS; i++) {
      vec3 p = ro + rd * t;
      float d = mapCore(p);
      glow += exp(-max(d, 0.0) * 7.0) * 0.012;                     // corona volumétrica
      if (d < 0.001) { hit = true; break; }
      t += d * 0.55;                                               // Lipschitz del ruido
      if (t > tExit) break;
    }
  }

  // Fondo: vacío con halo del color de la nota.
  vec3 halo = palette(u_chromaHue + 0.5, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  float r = length(uv);
  col = halo * halo * 0.04 * exp(-r * 1.5) * (0.5 + u_lqAmbient);
  col += halo * halo * u_kickPulse * 0.25 * exp(-r * 2.0);        // el vacío respira con el kick

  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    vec3 lp = toLocal(p);
    float ndv = clamp(dot(n, -rd), 0.0, 1.0);

    // Metal iridiscente: película fina — el tono rota con ángulo y nota.
    vec3 film = palette(u_chromaHue + G_IRID * ndv + 0.15 * n.y, vec3(0.5), vec3(0.5),
                        vec3(1.0), vec3(0.0, 0.33, 0.67));
    float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
    float dif = max(dot(n, normalize(vec3(-0.5, 0.8, -0.4))), 0.0);
    col = film * envMap(reflect(rd, n)) * (0.35 + 0.65 * fres) + film * dif * 0.12;

    // Magma: las cavidades brillan al rojo con bombo e impacto.
    float heat = smoothstep(0.15, 0.8, boil(lp * G_FREQ + vec3(0.0, gPhase, G_SEED)));
    col += heat * (u_kickPulse * 0.9 + fx * 1.4) * vec3(2.4, 0.65, 0.15);
    // Puntas de los pinchos: incandescencia blanca con el disparo.
    col += smoothstep(0.55, 0.95, ridge(lp)) * (fx * 2.5 + euSnare() * 0.8) * vec3(1.0, 0.95, 0.9);
    // Destellos del hi-hat sobre el metal.
    col += step(0.993 - 0.02 * u_ultraAir, hash21(floor(fc * 0.5) + floor(beats * 6.0)))
         * u_hihatEnergy * fres * vec3(2.0);
  }
  col += glow * halo * (0.25 + 1.6 * u_kickPulse + 0.8 * fx);

  // ── 4. TRANSITORIOS GLOBALES ──────────────────────────────────────
  col += fx * 0.5 * halo * exp(-r * 3.0);
  if (glitch > 0.01) col = mix(col, col.brg, 0.5 * glitch * step(0.55, hash21(vec2(floor(fc.y / 4.0), floor(beats * 4.0)))));

  // ── 5. TENSIÓN + EXPOSICIÓN LINEAL ─────────────────────────────────
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum), 0.45 * fx);
  if (ACID) col *= 0.75 + 0.25 * sin(vec3(0.0, 2.1, 4.2) + r * 14.0 - beats * PI);
  col *= euVoidGate(0.4);
  col *= (1.0 + 0.6 * u_energy) * (0.5 + 0.5 * live);
  col *= 1.0 - 0.3 * dot(uv, uv);
  c = vec4(col, 1.0);
}
