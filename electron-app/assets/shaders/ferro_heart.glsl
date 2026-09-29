// @euclid name    "Ferro Heart"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  fluid+field
// @euclid genome  aggression=0.70 chaos=0.40 organicity=0.80
// @euclid zone    gentle..peak
// @euclid vibes   rave+techno-club+fiesta-latina
// @euclid param   u_field float -1.0 1.0 0.0 "Field"
// @euclid param   u_gloss float -1.0 1.0 0.0 "Gloss"
// @euclid gene    G_SHARP   struct int   2    6     4    a:+0.5 o:-0.3
// @euclid gene    G_LATTICE expr   float 3.0  9.0   5.5  c:+0.4 a:+0.2
// @euclid gene    G_MOUND   expr   float 0.3  1.2   0.7  o:+0.4
// @euclid gene    G_ORBIT   expr   float 0.1  1.0   0.35 a:+0.3
// @euclid gene    G_HUE     expr   float 0.0  1.0   0.58 c:+0.3
// @euclid gene    G_SEED    expr   float 0.0  100.0 0.0
// @euclid steps   110
// Theia 2.0 · contract v2 — migrated by scripts/migrate_atoms_v2.js (WAVE 8279)

uniform float u_field;   // Regla del Cero Neutro: 0 = diseño canónico
uniform float u_gloss;

#ifndef G_SHARP
#define G_SHARP 4.0
#endif
#ifndef G_LATTICE
#define G_LATTICE 5.5
#endif
#ifndef G_MOUND
#define G_MOUND 0.7
#endif
#ifndef G_ORBIT
#define G_ORBIT 0.35
#endif
#ifndef G_HUE
#define G_HUE 0.58
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif

#define PI  3.14159265359
#define TAU 6.28318530718
#define FAR 30.0

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
float gBeats, gH, gK, gEnvK, gTower, gFlip, gRot, gGlitch;
vec2  gTilt;

// Inestabilidad de Rosensweig: el patrón de picos de un ferrofluido bajo
// campo normal es una red HEXAGONAL = suma de 3 ondas planas a 120°.
// Devuelve la "fuerza de pico" s ∈ [0,1] (1 = punta).
float spikeField(vec2 xz) {
  vec2 q = rot2(gRot) * xz;
  q += gTilt * exp(-dot(xz, xz) * gEnvK);                          // latigazo lateral (snare)
  q += 0.18 * vec2(noise3(vec3(xz * 0.7, gBeats * 0.15 + G_SEED)),
                   noise3(vec3(xz * 0.7 + 5.3, gBeats * 0.15)));   // la red ondula
  float k = gK;
  float hx = cos(k * q.x)
           + cos(k * (-0.5 * q.x + 0.8660254 * q.y))
           + cos(k * (-0.5 * q.x - 0.8660254 * q.y));              // ∈ [-1.5, 3]
  float s = clamp((hx + 1.5) / 4.5, 0.0, 1.0);
  return pow(s, G_SHARP * 1.5);
}

float heightAt(vec2 xz) {
  float r2 = dot(xz, xz);
  float env = exp(-r2 * gEnvK);                                    // el imán concentra
  float mound = G_MOUND * exp(-r2 * 0.25) + gTower * exp(-r2 * 2.5);
  float h = mound + spikeField(xz) * gH * env * gFlip;             // gFlip<0 → cráteres
  h += 0.012 * u_hihatEnergy * noise3(vec3(xz * 12.0, gBeats * 4.0));  // micro-rizado
  if (gGlitch > 0.01) h = mix(h, floor(h * 10.0) / 10.0, gGlitch);    // terrazas digitales
  return h;
}

// Estudio de softboxes rectangulares (sin aros) — el ferrofluido es un
// espejo negro: toda su belleza está en lo que refleja.
vec3 envMap(vec3 r) {
  vec3 A = palette(u_chromaHue * 0.5 + G_HUE, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  vec3 B = palette(u_chromaHue * 0.5 + G_HUE + 0.4, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  A *= A;
  B *= B;
  float top   = smoothstep(0.6, 0.95, r.y) * smoothstep(0.7, 0.2, abs(r.x));
  float sideA = exp(-abs(r.x - 0.75) * 7.0) * smoothstep(-0.05, 0.25, r.y) * smoothstep(0.85, 0.35, r.y);
  float sideB = exp(-abs(r.x + 0.75) * 7.0) * smoothstep(-0.05, 0.25, r.y) * smoothstep(0.85, 0.35, r.y);
  float floorGlow = smoothstep(0.05, -0.5, r.y);
  return vec3(0.003) + vec3(1.4) * top * (0.5 + 0.5 * u_energy)
       + A * sideA * 1.8 + B * sideB * 1.8 + A * floorGlow * 0.04;
}

void mainImage(out vec4 c, in vec2 fragCoord) {
  // ── 1. CANALES ─────────────────────────────────────────────────────
  float glitch, live, groove;
  euChannels(glitch, live, groove);
  gBeats  = u_beatTime + u_time * 0.05;
  gGlitch = glitch;
  // 🔫 WAVE 8287 · Clean Shot — el campo respira con el beat/compás;
  // la inversión de campo y la torre solo existen con clip físico vivo.
  float fx    = u_activeEffectEnergy;
  float beatP = 0.5 + 0.5 * cos(6.2831853 * u_beatPhase) * u_speed;
  float swell = sin(3.1415927 * u_barPhase) * u_speed;

  // Masa magnética — el BAJO es el campo: altura de los picos.
  gH = (0.12 + 0.55 * u_subBass + 0.35 * u_bass) * live * (1.0 + 0.4 * u_field)
     + 0.45 * u_kickPulse;                                         // bombo = picos que saltan
  gK     = G_LATTICE + 0.8 * beatP;                                // latido: red respira por beat
  gEnvK  = 0.12 + 0.3 * swell;                                     // compás: se agolpa al centro
  gTower = 0.9 * fx;                                               // disparo → torre central
  gFlip  = 1.0 - 2.0 * smoothstep(0.35, 0.9, fx);                  // DISPARO: inversión de campo
  gRot   = gBeats * TAU / 96.0;
  float ta = hash21(vec2(floor(u_beatTime * 2.0), G_SEED)) * TAU;
  gTilt  = vec2(cos(ta), sin(ta)) * 0.35 * euSnare();           // snare: latigazo del campo

  vec2 uv = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;

  // ── 2. CÁMARA — órbita lenta alrededor del corazón (obedece SPEED) ──
  float az = gBeats * G_ORBIT * TAU / 32.0;
  float camR = 6.2 - 0.8 * swell;
  vec3 ro = vec3(camR * cos(az), 3.0 - 0.5 * fx + 0.25 * sin(u_time * 0.13), camR * sin(az));
  vec3 ta3 = vec3(0.0, 0.55 + 0.3 * fx, 0.0);
  vec3 ww = normalize(ta3 - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.7 * ww);

  // ── 3. RAYMARCH de campo de alturas + refinamiento por bisección ──
  float t = 0.0;
  float tPrev = 0.0;
  bool hit = false;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    float d = p.y - heightAt(p.xz);
    if (d < 0.002 * t) { hit = true; break; }
    tPrev = t;
    t += max(d * 0.35, 0.004 * t);                                 // picos empinados → paso corto
    if (t > FAR) break;
  }
  if (hit) {
    for (int j = 0; j < 5; j++) {
      float tm = 0.5 * (tPrev + t);
      vec3 pm = ro + rd * tm;
      if (pm.y - heightAt(pm.xz) < 0.0) t = tm; else tPrev = tm;
    }
  }

  // ── 4. SHADING — espejo negro con puntas incandescentes ───────────
  vec3 col = envMap(rd) * 0.35;
  if (hit) {
    vec3 p = ro + rd * t;
    float e = 0.008 * (1.0 + 0.03 * t);
    vec3 n = normalize(vec3(heightAt(p.xz - vec2(e, 0.0)) - heightAt(p.xz + vec2(e, 0.0)),
                            2.0 * e,
                            heightAt(p.xz - vec2(0.0, e)) - heightAt(p.xz + vec2(0.0, e))));
    float ndv = clamp(dot(n, -rd), 0.0, 1.0);
    float fres = (0.05 + 0.03 * u_gloss) + 0.95 * pow(1.0 - ndv, 5.0);
    col = envMap(reflect(rd, n)) * (0.25 + 0.75 * fres) * (1.0 + 0.3 * u_gloss);
    col += vec3(0.004, 0.004, 0.006) * max(n.y, 0.0);              // albedo casi nulo

    // KICK: descarga magnética — las PUNTAS se encienden desde dentro.
    float s = spikeField(p.xz) * exp(-dot(p.xz, p.xz) * gEnvK);
    vec3 hot = palette(u_chromaHue + G_HUE + 0.15, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
    col += hot * hot * pow(s, 3.0) * (0.15 * live + 3.0 * u_kickPulse);
    // DISPARO: los cráteres invertidos exhalan luz blanca del fondo del pozo.
    col += vec3(1.2, 1.1, 1.0) * fx * smoothstep(0.2, 0.9, s) * (1.0 - gFlip) * 0.8;

    col = mix(col, envMap(rd) * 0.35, 1.0 - exp(-t * 0.03));
  }

  // ── 5. TENSIÓN + EXPOSICIÓN LINEAL ─────────────────────────────────
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum) * vec3(0.95, 1.0, 1.1), 0.5 * fx);
  if (glitch > 0.01) col = mix(col, col.gbr, 0.5 * glitch * step(0.6, hash21(vec2(floor(fragCoord.y / 4.0), floor(gBeats * 8.0)))));
  col *= euVoidGate(0.4);
  col *= 1.0 + 0.5 * u_energy;
  col *= 1.0 - 0.3 * dot(uv, uv);
  c = vec4(col, 1.0);
}
