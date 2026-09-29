// @euclid name    "Big Bang · Chain Reaction"
// @euclid author  "DDS × LuxSync · Infinite Genome"
// @euclid family  swarm+conformal
// @euclid genome  aggression=0.88 chaos=0.92 organicity=0.48
// @euclid zone    ambient..peak
// @euclid vibes   rave+techno-club
// @euclid param   u_collision float -1.0 1.0 0.0 "Collisions"
// @euclid param   u_afterglow float -1.0 1.0 0.0 "Afterglow"
// @euclid gene    G_RAYS   struct int   28   64   48   a:+0.6 c:+0.5
// @euclid gene    G_CYCLE  expr   float 24.0 56.0 36.0 o:+0.3
// @euclid gene    G_EXPAND expr   float 0.9  1.8  1.35 a:+0.6
// @euclid gene    G_SPIN   expr   float -0.7 0.7  0.18 c:+0.6
// @euclid gene    G_SEED   expr   float 0.0 100.0 17.0
// Theia 2.0 · Clean Shot compatible

uniform float u_collision;
uniform float u_afterglow;

#ifndef G_RAYS
#define G_RAYS 48.0
#endif
#ifndef G_CYCLE
#define G_CYCLE 36.0
#endif
#ifndef G_EXPAND
#define G_EXPAND 1.35
#endif
#ifndef G_SPIN
#define G_SPIN 0.18
#endif
#ifndef G_SEED
#define G_SEED 17.0
#endif

#define PI  3.14159265359
#define TAU 6.28318530718
#define MAX_RAYS 64
#define MAX_COLLISIONS 20

float euVoidAmt() { return smoothstep(0.6, 0.9, u_rhythmicVoid); }
float euVoidGate(float k) { return mix(1.0, k, euVoidAmt()) * (1.0 + 0.6 * u_voidRelease); }
float euSnare() { return max(u_snareTruePulse, u_snarePulse * (1.0 - 0.7 * u_vocalIsolation)); }

float softParticle(vec2 p, vec2 pos, float size) {
  vec2 d = p - pos;
  return size / (dot(d, d) + size * 0.12);
}

float shockRing(vec2 p, vec2 center, float radius, float sharpness) {
  float d = abs(length(p - center) - radius);
  return exp(-d * sharpness);
}

void mainImage(out vec4 c, in vec2 fragCoord) {
  float glitch, live, groove;
  euChannels(glitch, live, groove);
  vec4 tb = euTimbre();

  float beats = u_beatTime + u_time * 0.035;
  float barBreath = sin(PI * u_barPhase) * u_speed;
  float fx = u_activeEffectEnergy;
  float aspect = u_resolution.x / u_resolution.y;

  vec2 fc = fragCoord;
  if (glitch > 0.01) {
    float band = floor(fc.y / u_resolution.y * 40.0);
    float h = hash21(vec2(band, floor(beats * 4.0)));
    fc.x += step(1.0 - 0.28 * glitch, h) * (h - 0.5)
          * u_resolution.x * 0.09 * glitch;
  }

  vec2 uv = (fc - 0.5 * u_resolution.xy) / u_resolution.y;
  float r = length(uv);
  float th = atan(uv.y, uv.x);

  // Ciclo: oscuridad → singularidad → implosión → Big Bang → expansión.
  float phase = mod(beats, G_CYCLE) / G_CYCLE;
  float lifeFade = 1.0 - smoothstep(0.94, 1.0, phase);
  float awakening = smoothstep(0.025, 0.085, phase);
  float compression = smoothstep(0.10, 0.18, phase)
                    * (1.0 - smoothstep(0.285, 0.34, phase));
  float explosion = smoothstep(0.285, 0.385, phase);
  float expAge = clamp((phase - 0.285) / 0.59, 0.0, 1.0);
  float blast = explosion * lifeFade;

  vec3 col = vec3(0.0);

  // 1. Singularidad central centelleante.
  float flicker = 0.80 + 0.20 * sin(beats * TAU * 0.53 + G_SEED);
  float singularitySize = mix(0.030, 0.004, compression);
  float singularity = awakening * flicker * 0.0025
                    / (r * r + singularitySize * singularitySize);
  vec3 coreCol = mix(vec3(0.55, 0.72, 1.30),
                     vec3(1.50, 0.62, 0.20),
                     compression);
  col += coreCol * singularity * lifeFade;

  // 2. Implosión hacia el centro.
  float implodeT = smoothstep(0.11, 0.30, phase);
  float implodeRadius = mix(0.55, 0.015, implodeT);
  float implosionRing = exp(-abs(r - implodeRadius) * (45.0 + 70.0 * implodeT));
  float implosionNoise = 0.55 + 0.45
    * hash21(floor(vec2(th * 90.0, r * 120.0)));

  vec3 implosionColor = palette(
    u_chromaHue + th / TAU,
    vec3(0.48),
    vec3(0.50, 0.46, 0.62),
    vec3(1.0),
    vec3(0.00, 0.33, 0.67)
  );

  col += implosionColor * implosionRing * implosionNoise * compression * 1.8;

  // 3. Onda primordial.
  float frontRadius = G_EXPAND * mix(0.012, 1.36, pow(expAge, 0.68));
  float primaryShock = exp(-abs(r - frontRadius) * 65.0);
  float secondaryShock = exp(-abs(r - frontRadius * 0.74) * 90.0);

  vec3 shockColor = palette(
    u_chromaHue + expAge * 0.35,
    vec3(0.52),
    vec3(0.55, 0.50, 0.62),
    vec3(1.0),
    vec3(0.00, 0.27, 0.63)
  );

  col += shockColor
       * (2.1 * primaryShock + 0.55 * secondaryShock)
       * blast
       * (1.0 + 0.8 * u_kickPulse + 0.5 * fx);

  // 4. Rayos / partículas principales.
  for (int i = 0; i < MAX_RAYS; i++) {
    float fi = float(i);
    if (fi >= G_RAYS) break;

    float h1 = hash21(vec2(fi + G_SEED, 1.137));
    float h2 = hash21(vec2(fi * 3.17 + G_SEED, 9.71));
    float h3 = hash21(vec2(fi * 7.91, G_SEED + 4.1));

    float angle = h1 * TAU + G_SPIN * beats * (0.18 + 0.12 * h2);
    vec2 dir = vec2(cos(angle), sin(angle));
    vec2 normal = vec2(-dir.y, dir.x);

    float particleRadius = frontRadius * (0.10 + 0.88 * h2);
    particleRadius *= 0.86 + 0.18 * sin(beats * 0.31 + fi * 1.73);

    vec2 particlePos = dir * particleRadius;
    float particleSize = mix(0.000015, 0.000065, h3);
    float particle = softParticle(uv, particlePos, particleSize);

    float sideDist = abs(dot(uv, normal));
    float along = dot(uv, dir);
    float trailWidth = 0.002 + 0.003 * h3;
    float trail = exp(-sideDist * sideDist / (trailWidth * trailWidth));
    trail *= smoothstep(0.0, 0.04, along);
    trail *= 1.0 - smoothstep(particleRadius, particleRadius + 0.23, along);

    float hue = fract(u_chromaHue + h1 + h3 * 0.33);
    vec3 pcol = palette(
      hue,
      vec3(0.52),
      vec3(0.55, 0.52, 0.60),
      vec3(1.0),
      vec3(0.00, 0.33, 0.67)
    );

    float audioAmp = 0.7 + 0.5 * u_energy + 0.5 * u_treble + 0.35 * tb.z;
    col += pcol * (particle * 0.024 + trail * 0.11) * blast * audioAmp;
  }

  // 5. Polvo cósmico procedural: campo masivo de micro-partículas.
  float gridScale = 150.0 + 80.0 * (u_percussiveness + tb.w);
  vec2 gv = uv * gridScale;
  vec2 gid = floor(gv);
  vec2 gf = fract(gv) - 0.5;

  float gh = hash21(gid + vec2(G_SEED, G_SEED * 0.37));
  float gh2 = hash21(gid * 1.731 + vec2(7.17, 13.91));
  vec2 jitter = vec2(gh - 0.5, gh2 - 0.5) * 0.56;

  float micro = exp(-dot(gf - jitter, gf - jitter) * 90.0);
  float probability = 0.976 - 0.018 * (u_ultraAir + u_hihatEnergy + tb.w);
  micro *= step(probability, gh);

  float universeInterior = 1.0 - smoothstep(frontRadius * 0.93, frontRadius + 0.16, r);
  universeInterior *= smoothstep(0.01, 0.08, r);

  vec3 microCol = palette(
    u_chromaHue + gh,
    vec3(0.55),
    vec3(0.62, 0.55, 0.62),
    vec3(1.0),
    vec3(0.00, 0.33, 0.67)
  );

  col += microCol * micro * universeInterior * blast
       * (0.18 + 0.32 * u_treble);

  // 6. Colisiones y explosiones secundarias.
  float collisionBoost = clamp(1.0 + 0.65 * u_collision, 0.25, 1.8);
  collisionBoost *= 1.0
                  + 0.75 * u_kickPulse
                  + 0.55 * euSnare()
                  + 0.45 * u_crestPulse
                  + 0.40 * fx;

  for (int i = 0; i < MAX_COLLISIONS; i++) {
    float fi = float(i);
    float h1 = hash21(vec2(fi + 44.0, G_SEED + 2.3));
    float h2 = hash21(vec2(fi * 4.19, G_SEED + 17.0));
    float h3 = hash21(vec2(fi * 9.31, 7.7));

    float eventTime = 0.06 + 0.84 * h1;
    float eventAge = (expAge - eventTime) * 5.5;
    float eventPulse = smoothstep(0.0, 0.08, eventAge)
                     * (1.0 - smoothstep(0.38, 0.80, eventAge));

    float angle = TAU * h2 + G_SPIN * fi * 0.4;
    float cr = frontRadius * (0.18 + 0.68 * h3);
    vec2 cp = vec2(cos(angle), sin(angle)) * cr;

    float age01 = clamp(eventAge, 0.0, 1.0);
    float miniRadius = age01 * (0.035 + 0.10 * h2);
    float miniRing = shockRing(uv, cp, miniRadius, 105.0);
    float miniCore = softParticle(uv, cp, 0.000025 + 0.000025 * h1);

    vec3 collisionColor = palette(
      u_chromaHue + h2 + 0.17,
      vec3(0.55),
      vec3(0.60, 0.52, 0.64),
      vec3(1.0),
      vec3(0.00, 0.33, 0.67)
    );

    col += collisionColor * eventPulse * collisionBoost * blast
         * (miniRing * 1.15 + miniCore * 0.018);
  }

  // 7. Punto cero / flash de detonación.
  float detonation = smoothstep(0.285, 0.305, phase)
                   * (1.0 - smoothstep(0.305, 0.355, phase));
  col += vec3(1.5, 1.35, 1.15) * detonation * 0.018
       / (r * r + 0.0004);

  // 8. Onda reactiva al kick.
  float kickWaveRadius = 0.05 + 0.42 * (1.0 - u_kickPulse);
  float kickWave = exp(-abs(r - kickWaveRadius) * 80.0) * u_kickPulse;
  col += shockColor * kickWave * explosion * 0.75;

  col *= 1.0 + 0.18 * u_energy + 0.12 * barBreath + 0.35 * fx;
  col *= 0.55 + 0.45 * live;
  col *= euVoidGate(0.32);
  col *= lifeFade;

  // 9. Feedback / afterglow.
  if (u_hasPrev > 0.5) {
    vec2 f = fragCoord / u_resolution.xy - 0.5;
    f.x *= aspect;
    f *= 0.991 - 0.010 * fx;
    f = rot2(0.0025 * (1.0 + u_bass)) * f;
    f.x /= aspect;

    vec3 prev = texture(u_prevFrame, f + 0.5).rgb;
    prev *= prev;

    float persist = clamp(
      0.80 + 0.12 * u_afterglow + 0.06 * u_synthSustain - 0.24 * glitch,
      0.0,
      0.96
    );

    persist *= smoothstep(0.08, 0.16, phase);
    persist *= 1.0 - smoothstep(0.94, 1.0, phase);
    col = max(col, prev * persist);
  }

  c = vec4(col, 1.0);
}
