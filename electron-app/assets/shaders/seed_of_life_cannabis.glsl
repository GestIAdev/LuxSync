// @euclid name    "Seed of Life · Cannabis Tree"
// @euclid author  "DDS × LuxSync · Infinite Genome"
// @euclid family  swarm+conformal
// @euclid genome  aggression=0.32 chaos=0.38 organicity=0.98
// @euclid zone    ambient..peak
// @euclid vibes   chill-lounge+ambient
// @euclid param   u_leafGlow float -1.0 1.0 0.0 "Leaf Glow"
// @euclid param   u_geometry float -1.0 1.0 0.0 "Sacred Geometry"
// @euclid gene    G_BRANCH struct int   3    6     5    o:+0.8
// @euclid gene    G_CYCLE  expr   float 32.0 80.0  48.0 o:+0.8
// @euclid gene    G_SWAY   expr   float 0.02 0.18  0.07 o:+0.6
// @euclid gene    G_WIDTH  expr   float 0.75 1.25  1.00 o:+0.5
// @euclid gene    G_SEED   expr   float 0.0  100.0 31.0
// Theia 2.0 · Clean Shot compatible

uniform float u_leafGlow;
uniform float u_geometry;

#ifndef G_BRANCH
#define G_BRANCH 5.0
#endif
#ifndef G_CYCLE
#define G_CYCLE 48.0
#endif
#ifndef G_SWAY
#define G_SWAY 0.07
#endif
#ifndef G_WIDTH
#define G_WIDTH 1.0
#endif
#ifndef G_SEED
#define G_SEED 31.0
#endif

#define PI  3.14159265359
#define TAU 6.28318530718
#define MAX_BRANCH 6

float euVoidAmt() { return smoothstep(0.6, 0.9, u_rhythmicVoid); }
float euVoidGate(float k) { return mix(1.0, k, euVoidAmt()) * (1.0 + 0.6 * u_voidRelease); }
float euSnare() { return max(u_snareTruePulse, u_snarePulse * (1.0 - 0.7 * u_vocalIsolation)); }

float sdSegment2D(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.000001), 0.0, 1.0);
  return length(pa - ba * h);
}

float branchGlow(vec2 p, vec2 a, vec2 b, float width) {
  float d = sdSegment2D(p, a, b);
  return exp(-d * d / max(width * width, 0.000001));
}

float cannabisLeaf(vec2 p, float scale, float rotation, float reveal) {
  p = rot2(-rotation) * p;
  float leaf = 0.0;

  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float off = fi - 3.0;
    float angle = PI * 0.5 + off * 0.275;

    vec2 dir = vec2(cos(angle), sin(angle));
    vec2 side = vec2(-dir.y, dir.x);
    vec2 q = vec2(dot(p, side), dot(p, dir));

    float len = scale * (1.0 - 0.085 * abs(off));
    float wid = scale * (0.145 - 0.012 * abs(off));
    float t = clamp(q.y / max(len, 0.001), 0.0, 1.0);

    float profile = pow(max(sin(PI * t), 0.0), 0.68);
    float serration = 1.0 + 0.16 * sin(t * PI * 16.0 + abs(off) * 0.7);
    float bodyWidth = wid * profile * serration;

    float sideMask = 1.0 - smoothstep(bodyWidth, bodyWidth + 0.006, abs(q.x));
    float bottomGate = smoothstep(-0.012, 0.018, q.y);
    float topGate = 1.0 - smoothstep(len - 0.025, len + 0.008, q.y);
    float vein = exp(-abs(q.x) * 280.0);

    leaf += sideMask * bottomGate * topGate * (0.76 + 0.24 * vein);
  }

  leaf += branchGlow(
    p,
    vec2(0.0, -scale * 0.11),
    vec2(0.0,  scale * 0.08),
    scale * 0.026
  ) * 0.45;

  return leaf * reveal;
}

float circleGlow(vec2 p, vec2 center, float radius) {
  float d = abs(length(p - center) - radius);
  return exp(-d * 190.0);
}

void mainImage(out vec4 c, in vec2 fragCoord) {
  float glitch, live, groove;
  euChannels(glitch, live, groove);
  vec4 tb = euTimbre();

  float beats = u_beatTime + u_time * 0.025;
  float fx = u_activeEffectEnergy;
  float barBreath = sin(PI * u_barPhase) * u_speed;

  vec2 fc = fragCoord;
  if (glitch > 0.01) {
    float band = floor(fc.y / u_resolution.y * 28.0);
    float h = hash21(vec2(band, floor(beats * 4.0)));
    fc.x += step(1.0 - 0.32 * glitch, h) * (h - 0.5)
          * u_resolution.x * 0.055 * glitch;
  }

  vec2 uv = (fc - 0.5 * u_resolution.xy) / u_resolution.y;
  uv.x /= G_WIDTH;

  // Ciclo: oscuridad → semilla → raíces → tronco → ramas → árbol maduro.
  float phase = mod(beats, G_CYCLE) / G_CYCLE;
  float fadeOut = 1.0 - smoothstep(0.94, 1.0, phase);
  float seedAwake = smoothstep(0.025, 0.09, phase);
  float rootGrow = smoothstep(0.12, 0.37, phase);
  float trunkGrow = smoothstep(0.20, 0.54, phase);
  float canopyGrow = smoothstep(0.42, 0.76, phase);
  float sacredReveal = smoothstep(0.68, 0.84, phase);
  float maturity = smoothstep(0.72, 0.88, phase);

  vec3 col = vec3(0.0);

  // 1. Semilla.
  vec2 seedPos = vec2(0.0);
  vec2 sp = uv - seedPos;
  float seedDistance = length(vec2(sp.x * 1.65, sp.y));
  float seedCore = 0.0018 / (seedDistance * seedDistance + 0.0015);
  float seedBody = exp(-abs(seedDistance - 0.038) * 115.0);
  float seedVisibility = seedAwake * (1.0 - 0.62 * canopyGrow);

  vec3 seedColor = mix(
    vec3(1.20, 0.52, 0.09),
    vec3(0.30, 1.15, 0.24),
    trunkGrow
  );

  col += seedColor * (seedCore * 0.12 + seedBody * 0.65) * seedVisibility;
  col += vec3(0.65, 1.10, 0.28) * seedCore * 0.025
       * u_subBass * seedVisibility;

  // 2. Raíces.
  float roots = 0.0;

  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float h = hash21(vec2(fi + G_SEED, 3.17));
    float side = mod(fi, 2.0) < 1.0 ? -1.0 : 1.0;

    float depth = (0.22 + 0.055 * fi) * rootGrow;
    float spread = side * (0.09 + 0.035 * fi + 0.06 * h) * rootGrow;

    vec2 a = seedPos;
    vec2 middle = vec2(spread * 0.48, -depth * 0.48);
    vec2 end = vec2(spread, -depth);

    middle.x += side * 0.035 * sin(beats * 0.23 + fi);

    roots += branchGlow(uv, a, middle, 0.008);
    roots += branchGlow(uv, middle, end, 0.005) * 0.75;

    vec2 rootBranch = middle + vec2(
      side * (0.055 + 0.02 * h) * rootGrow,
      -0.06 * rootGrow
    );

    roots += branchGlow(uv, middle, rootBranch, 0.0035) * 0.55;
  }

  vec3 rootColor = mix(
    vec3(0.42, 0.18, 0.035),
    vec3(0.45, 0.92, 0.12),
    0.28 + 0.42 * u_subBass
  );

  col += rootColor * roots * rootGrow * (0.45 + 0.55 * live);

  // 3. Tronco.
  float sway = G_SWAY
             * (0.45 + 0.35 * u_mid + 0.20 * u_synthSustain)
             * sin(beats * TAU / 16.0 + G_SEED);

  vec2 trunkBase = seedPos;
  vec2 trunkMid1 = vec2( sway * 0.18, 0.18 * trunkGrow);
  vec2 trunkMid2 = vec2(-sway * 0.12, 0.39 * trunkGrow);
  vec2 trunkTop  = vec2( sway * 0.26, 0.66 * trunkGrow);

  float trunk = 0.0;
  trunk += branchGlow(uv, trunkBase, trunkMid1, 0.017);
  trunk += branchGlow(uv, trunkMid1, trunkMid2, 0.014);
  trunk += branchGlow(uv, trunkMid2, trunkTop, 0.010);

  float sap = branchGlow(uv, trunkBase, trunkTop, 0.004);

  vec3 trunkColor = vec3(0.23, 0.52, 0.08);
  vec3 sapColor = vec3(0.52, 1.18, 0.19);

  col += trunkColor * trunk * trunkGrow * 0.85;
  col += sapColor * sap * trunkGrow
       * (0.15 + 0.20 * u_energy + 0.16 * barBreath);

  // 4. Ramas y copa.
  float branches = 0.0;
  float leaves = 0.0;

  for (int i = 0; i < MAX_BRANCH; i++) {
    float fi = float(i);
    if (fi >= G_BRANCH) break;

    float level = (fi + 1.0) / (G_BRANCH + 1.0);
    float branchReveal = smoothstep(
      0.34 + 0.055 * fi,
      0.48 + 0.055 * fi,
      phase
    );

    float originY = 0.10 + level * 0.47;
    vec2 origin = vec2(sway * level * 0.20, originY * trunkGrow);
    float branchLength = (0.30 - 0.020 * fi) * branchReveal;

    for (int j = 0; j < 2; j++) {
      float side = j == 0 ? -1.0 : 1.0;
      float h = hash21(vec2(fi * 5.31 + float(j), G_SEED));

      vec2 middle = origin + vec2(
        side * branchLength * 0.52,
        branchLength * (0.12 + 0.10 * h)
      );

      vec2 tip = origin + vec2(
        side * branchLength,
        branchLength * (0.22 + 0.11 * h)
      );

      tip.x += side * G_SWAY * 0.22
             * sin(beats * 0.41 + fi * 1.7 + float(j));

      branches += branchGlow(uv, origin, middle, 0.008) * branchReveal;
      branches += branchGlow(uv, middle, tip, 0.006) * branchReveal;

      leaves += cannabisLeaf(
        uv - tip,
        0.112 + 0.018 * h,
        side * (0.18 + 0.12 * fi),
        canopyGrow * branchReveal
      );

      vec2 smallLeafPos = mix(middle, tip, 0.48);
      leaves += cannabisLeaf(
        uv - smallLeafPos,
        0.073 + 0.010 * h,
        side * (0.48 + 0.07 * fi),
        canopyGrow * branchReveal
      ) * 0.78;
    }
  }

  leaves += cannabisLeaf(
    uv - trunkTop,
    0.165,
    sway * 0.7,
    canopyGrow
  ) * 1.18;

  leaves += cannabisLeaf(
    uv - vec2(-0.085, 0.49),
    0.105,
    -0.32,
    canopyGrow
  );

  leaves += cannabisLeaf(
    uv - vec2(0.085, 0.49),
    0.105,
    0.32,
    canopyGrow
  );

  vec3 branchColor = vec3(0.20, 0.66, 0.095);
  col += branchColor * branches * (0.52 + 0.48 * live);

  vec3 leafGreen = vec3(0.055, 0.76, 0.13);
  vec3 leafHighlight = mix(
    vec3(0.28, 1.05, 0.16),
    vec3(1.05, 0.64, 0.12),
    0.28 + 0.22 * u_chromaFlux
  );

  float leafBoost = clamp(1.0 + 0.55 * u_leafGlow, 0.35, 1.7);

  col += leafGreen * leaves * 0.62 * leafBoost;
  col += leafHighlight * leaves
       * (0.08 + 0.20 * u_treble + 0.12 * u_ultraAir + 0.12 * u_vocalSustain)
       * leafBoost;

  // 5. Flor de la Vida detrás del árbol.
  vec2 geoCenter = vec2(0.0, 0.29);
  float geoRadius = 0.176 * (0.93 + 0.07 * maturity);

  float sacred = circleGlow(uv, geoCenter, geoRadius);

  for (int i = 0; i < 6; i++) {
    float a = TAU * float(i) / 6.0;
    vec2 cp = geoCenter + geoRadius * vec2(cos(a), sin(a));
    sacred += circleGlow(uv, cp, geoRadius);
  }

  sacred += circleGlow(uv, geoCenter, geoRadius * 2.03) * 0.75;
  sacred += circleGlow(uv, geoCenter, geoRadius * 2.48) * 0.28;

  float geometryBoost = clamp(1.0 + 0.65 * u_geometry, 0.25, 1.8);

  vec3 sacredColor = mix(
    vec3(0.26, 0.93, 0.18),
    vec3(1.15, 0.72, 0.16),
    0.42 + 0.18 * sin(beats * 0.12)
  );

  col += sacredColor * sacred * sacredReveal * geometryBoost
       * (0.15 + 0.14 * u_energy + 0.11 * u_synthSustain + 0.16 * fx);

  // 6. Polen / partículas de vida.
  vec2 pv = (uv - geoCenter) * 115.0;
  vec2 pid = floor(pv);
  vec2 pf = fract(pv) - 0.5;

  float ph = hash21(pid + vec2(G_SEED, 7.91));
  float ph2 = hash21(pid * 1.71 + vec2(3.2, 19.4));
  vec2 po = vec2(ph - 0.5, ph2 - 0.5) * 0.55;

  float pollen = exp(-dot(pf - po, pf - po) * 95.0);
  pollen *= step(0.982 - 0.018 * u_ultraAir, ph);

  vec2 canopyP = (uv - vec2(0.0, 0.45)) * vec2(2.3, 2.0);
  float canopyArea = exp(-dot(canopyP, canopyP) * 2.5);

  col += vec3(0.55, 1.05, 0.28) * pollen * canopyArea * canopyGrow
       * (0.08 + 0.32 * u_hihatEnergy);

  // 7. Ondas desde la semilla.
  float kickRadius = 0.03 + 0.34 * (1.0 - u_kickPulse);
  float kickRing = exp(-abs(length(uv - seedPos) - kickRadius) * 90.0)
                 * u_kickPulse;

  col += vec3(0.25, 0.95, 0.12) * kickRing * (0.20 + 0.50 * rootGrow);
  col += vec3(0.65, 1.15, 0.32) * branches * euSnare() * 0.12;
  col += sacredColor * sacred * fx * 0.28;

  // 8. Vida / respiración.
  col *= 0.52 + 0.48 * live;
  col *= 1.0 + 0.18 * u_energy + 0.10 * barBreath + 0.20 * maturity;
  col *= euVoidGate(0.38);
  col *= fadeOut;

  c = vec4(col, 1.0);
}
