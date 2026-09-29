// @euclid name    "Event Horizon"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  void+lens
// @euclid genome  aggression=0.50 chaos=0.55 organicity=0.35
// @euclid zone    ambient..peak
// @euclid vibes   chill-lounge+techno-club
// @euclid param   u_mass float -1.0 1.0 0.0 "Mass"
// @euclid param   u_disk float -1.0 1.0 0.0 "Disk"
// @euclid gene    G_STARS struct int   1    3     2    c:+0.3
// @euclid gene    G_TILT  expr   float 0.18 0.6   0.18 o:+0.2
// @euclid gene    G_RIN   expr   float 2.0  3.5   2.6  a:+0.2
// @euclid gene    G_ROUT  expr   float 5.0  12.0  8.0  o:+0.3
// @euclid gene    G_SWIRL expr   float 1.0  6.0   3.0  c:+0.6
// @euclid gene    G_HUE   expr   float 0.0  1.0   0.08 c:+0.3
// @euclid gene    G_SEED  expr   float 0.0  100.0 0.0
// @euclid steps   120
// Theia 2.0 · contract v2 — migrated by scripts/migrate_atoms_v2.js (WAVE 8279)

uniform float u_mass;   // Regla del Cero Neutro: 0 = diseño canónico
uniform float u_disk;

#ifndef G_STARS
#define G_STARS 2.0
#endif
#ifndef G_TILT
#define G_TILT 0.18
#endif
#ifndef G_RIN
#define G_RIN 2.6
#endif
#ifndef G_ROUT
#define G_ROUT 8.0
#endif
#ifndef G_SWIRL
#define G_SWIRL 3.0
#endif
#ifndef G_HUE
#define G_HUE 0.08
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif

#define PI       3.14159265359
#define TAU      6.28318530718
#define ESCAPE_R 22.0
#define FLOW_P   8.0         // periodo del flow-map del disco (beats)

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

float gBeats;

// Cuerpo negro aproximado: 0 rojo frío → 1 blanco → >1 azul caliente.
vec3 blackbody(float t) {
  vec3 c = vec3(1.0, 0.32, 0.05) * smoothstep(0.0, 0.35, t);
  c = mix(c, vec3(1.0, 0.78, 0.52), smoothstep(0.3, 0.8, t));
  return mix(c, vec3(0.7, 0.82, 1.0), smoothstep(0.85, 1.4, t));
}

// Textura del disco: brazos en espiral logarítmica, periódica en el ángulo.
float diskNoise(float rr, float a) {
  a += G_SWIRL * log(rr);
  vec3 q = vec3(rr * 1.6, cos(a) * 2.2, sin(a) * 2.2) + G_SEED;
  return 0.65 * noise3(q) + 0.35 * noise3(q * 2.3 + 4.1);
}

vec3 starfield(vec3 d) {
  vec3 col = vec3(0.0);
  for (int l = 0; l < 3; l++) {
    if (float(l) >= G_STARS) break;
    float sc = 55.0 + 75.0 * float(l);
    vec3 q = d * sc;
    vec3 f = fract(q) - 0.5;
    float h = hash31(floor(q) + float(l) * 13.1 + G_SEED);
    float tw = 1.0 + 1.5 * u_hihatEnergy * step(0.5, fract(h * 91.0 + floor(gBeats * 8.0) * 0.37));
    col += step(0.965, h) * exp(-dot(f, f) * 30.0) * (h - 0.965) * 30.0 * tw
         * mix(vec3(1.0, 0.8, 0.6), vec3(0.6, 0.75, 1.0), fract(h * 37.0));
  }
  float neb = smoothstep(0.2, 0.9, noise3(d * 2.5 + G_SEED) * 0.5 + 0.5)
            * exp(-abs(d.y + 0.25 * d.x) * 4.0);
  vec3 nc = palette(u_chromaHue + G_HUE + 0.6, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  return col + nc * nc * neb * 0.1;
}

void mainImage(out vec4 c, in vec2 fragCoord) {
  // ── 1. CANALES ─────────────────────────────────────────────────────
  float glitch, live, groove;
  euChannels(glitch, live, groove);
  gBeats = u_beatTime + u_time * 0.05;
  // 🔫 WAVE 8287 · Clean Shot — el colapso SOLO existe mientras un clip
  // físico corre en Hephaestus; la órbita basal respira con el compás.
  float fx    = u_activeEffectEnergy;
  // 🌊 WAVE 8290 — el oleaje de compás obedece el fader SPEED (W8290 §M2.3).
  float swell = sin(3.1415927 * u_barPhase) * u_speed;

  // Masa: el DISPARO de efecto es una oleada gravitatoria — el cielo
  // entero se dobla durante los ms exactos del clip DMX. Sin fuego real,
  // la masa es la nominal → el disco de acreción siempre visible.
  float M = clamp((1.0 + 0.25 * u_mass) * (1.0 + 0.55 * fx), 0.6, 1.75);

  vec2 fc = fragCoord;
  if (glitch > 0.01) {                                             // desgarro del espacio-tiempo
    float h = hash21(vec2(floor(fc.y / 8.0), floor(gBeats * 8.0)));
    fc.x += step(1.0 - 0.35 * glitch, h) * (h - 0.5) * u_resolution.x * 0.1 * glitch;
  }
  vec2 uv = (fc - 0.5 * u_resolution.xy) / u_resolution.y;

  // ── 2. CÁMARA — órbita; el DISPARO nos hace caer hacia el horizonte ─
  float az   = gBeats * TAU / 128.0;
  float incl = G_TILT + 0.08 * sin(u_time * 0.05);
  float D    = 15.0 - 1.5 * swell - 4.5 * fx;
  vec3 ro = D * vec3(cos(incl) * cos(az), sin(incl), cos(incl) * sin(az));
  vec3 ww = normalize(-ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + (1.5 + 0.4 * fx) * ww);

  // ── 3. GEODÉSICAS — fotón en Schwarzschild (aprox. newtoniana) ────
  // a = −1.5·M·h²·p / r⁵ con h = |p×v| conservado: reproduce la esfera de
  // fotones (r=1.5M), el anillo de Einstein y la imagen secundaria del
  // disco doblada por encima y por debajo del agujero.
  vec3 p = ro;
  vec3 v = rd;
  vec3 hv = cross(p, v);
  float h2 = dot(hv, hv);
  vec3 col = vec3(0.0);
  float trans = 1.0;
  float jet = 0.0;
  bool absorbed = false;

  // Disco: flow-map de dos fases → rotación kepleriana sin enrollarse jamás.
  float T  = gBeats / FLOW_P;
  float fa = fract(T);
  float fb = fract(T + 0.5);
  float wa = 1.0 - abs(2.0 * fa - 1.0);
  float flareA = hash21(vec2(floor(u_beatTime * 2.0), G_SEED)) * TAU;
  float flareR = mix(G_RIN + 0.5, G_ROUT - 1.0, hash21(vec2(floor(u_beatTime * 2.0), 7.7)));
  vec2  flareP = flareR * vec2(cos(flareA), sin(flareA));
  vec3  tint = palette(u_chromaHue + G_HUE, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));

  for (int i = 0; i < MAX_STEPS; i++) {
    float r2 = dot(p, p);
    float r = sqrt(r2);
    if (r < M) { absorbed = true; break; }
    float dt = clamp(0.09 * r, 0.03, 1.3);
    vec3 pPrev = p;
    v += (-1.5 * M * h2 * p / (r2 * r2 * r)) * dt;
    p += v * dt;

    // Chorros relativistas por el eje polar — hélice que avanza al compás.
    float axial = length(p.xz);
    float helix = 0.6 + 0.4 * sin(p.y * 3.0 - gBeats * TAU + atan(p.z, p.x) * 2.0);
    jet += exp(-axial * 7.0) * smoothstep(1.2, 3.5, abs(p.y)) * exp(-abs(p.y) * 0.12) * helix * dt;

    // Cruce del plano del disco.
    if (pPrev.y * p.y < 0.0 && trans > 0.01) {
      vec3 x = mix(pPrev, p, pPrev.y / (pPrev.y - p.y));
      float rr = length(x.xz);
      if (rr > G_RIN && rr < G_ROUT) {
        float ang = atan(x.z, x.x) + gBeats * 0.04;
        float omega = 2.0 * pow(rr, -1.5) * FLOW_P;
        float n = mix(diskNoise(rr, ang + omega * fb + 1.7), diskNoise(rr, ang + omega * fa), wa);
        float dens = clamp(0.55 + 0.9 * n, 0.0, 1.0);
        dens *= smoothstep(G_RIN, G_RIN + 0.4, rr) * smoothstep(G_ROUT, G_ROUT - 2.5, rr);
        // Temperatura T ∝ r^-¾; el KICK calienta el disco (vira a azul).
        float temp = pow(G_RIN / rr, 0.75) * (1.0 + 0.55 * u_kickPulse);
        // Beaming Doppler: el lado que se acerca brilla más (g³).
        vec3 vel = normalize(vec3(-x.z, 0.0, x.x));
        float beta = clamp(0.75 / sqrt(rr), 0.0, 0.6);
        float g = max(1.0 + beta * dot(vel, -normalize(v)), 0.05);
        vec3 emit = blackbody(temp * g) * mix(vec3(1.0), tint * 2.0, 0.3);
        emit *= dens * temp * temp * g * g * g * (2.2 + 0.8 * u_disk) * (0.6 + 0.4 * live);
        // SNARE: fulguración de reconexión magnética en un punto del disco.
        emit += vec3(0.8, 0.9, 1.2) * euSnare() * 5.0 * exp(-length(x.xz - flareP) * 2.5);
        float a = clamp(dens * 0.85, 0.0, 0.95);
        col += trans * a * emit;
        trans *= 1.0 - a;
      }
    }
    if (r > ESCAPE_R && dot(p, v) > 0.0) break;
  }

  if (!absorbed) col += trans * starfield(normalize(v));
  vec3 jc = palette(u_chromaHue + G_HUE + 0.55, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  col += jc * jc * jet * (0.12 + 2.8 * u_kickPulse + 0.8 * u_bass * live);   // KICK: chorros

  // ── 4. TENSIÓN + EXPOSICIÓN LINEAL ─────────────────────────────────
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum) * vec3(0.9, 1.0, 1.15), 0.4 * fx);
  if (glitch > 0.01) col = mix(col, col.brg, 0.5 * glitch * step(0.6, hash21(vec2(floor(fc.y / 4.0), floor(gBeats * 4.0)))));
  col *= euVoidGate(0.4);
  col *= 1.0 + 0.5 * u_energy;
  col *= 1.0 - 0.25 * dot(uv, uv);
  c = vec4(col, 1.0);
}
