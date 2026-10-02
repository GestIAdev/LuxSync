// @euclid name    "Tectonica de Kukulkan"
// @euclid author  "LuxSync · Pack Latino · Triunvirato"
// @euclid family  fluid+lattice
// @euclid genome  aggression=0.60 chaos=0.40 organicity=0.70
// @euclid zone    gentle..peak
// @euclid vibes   fiesta-latina, rave, reggaeton, dembow, fuego
// @euclid param   u_quake float -1.0 1.0 0.0 "Quake"
// @euclid gene    G_STEPS  struct int   4    9     6    a:+0.3 c:-0.2
// @euclid gene    G_FLOW   expr   float 0.3  2.0   1.0  o:+0.3
// @euclid gene    G_HEAT   expr   float 0.5  2.0   1.0  a:+0.4
// @euclid gene    G_HUE    expr   float 0.0  1.0   0.12 o:+0.2
// @euclid gene    G_SEED   expr   float 0.0  100.0 0.0
// @euclid steps   100
// Theia 2.0 · contract v2 — WAVE 8429 · Triunvirato Latino (autoría nativa v2)
//
// ── TECTÓNICA DE KUKULKÁN ───────────────────────────────────────────────────
// Heightfield de magma: fBm de 4 octavas ADVECTADO (la lava corre al
// groove), corteza basáltica con grietas incandescentes (ridged ^12) y
// cuerpo de cuerpo-negro en las cotas bajas.
//
// El truco estructural — CRISTALIZACIÓN TECTÓNICA:
//   cryst = fx (cataclismo DMX) ∪ u_voidRelease (rebote del vacío = el
//   drop) ∪ cresta·kickEnergy ∪ latido percusivo leve — solo hechos
//   físicos (Clean Shot: u_glassBreak es soberano/cognitivo, prohibido).
//   Cada celda (PYR_CELL) alza su pirámide escalonada con RETARDO propio
//   (cc = cryst·1.7 − hash·0.7, §13.4): el terreno no se levanta como un
//   bloque, entra en erupción ordenada. Al decaer cryst la pirámide se
//   hunde y su silueta se ablanda con ruido → se derrite en el magma.
//   Labios de escalón: la lava rezuma por cada peldaño (fract(u) → línea).
//
// Marcha: paso relajado + techo adaptativo; al cruzar la superficie,
// bisección ×6 — los muros verticales de los peldaños quedan nítidos.
//
// 🎭 u_vibe — LATINO/otros: piedra caliza dorada/jade, lava naranja.
//            RAVE/TECHNO: obsidiana especular, peldaños ×1.5 más finos,
//            magma de plasma cian/violeta, aristas de neón HDR.

uniform float u_quake;

#ifndef G_STEPS
#define G_STEPS 6
#endif
#ifndef G_FLOW
#define G_FLOW 1.0
#endif
#ifndef G_HEAT
#define G_HEAT 1.0
#endif
#ifndef G_HUE
#define G_HUE 0.12
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif

#define TAU      6.28318530718
#define PYR_CELL 5.0
#define PYR_H    2.4

float gCryst, gFlow, gHard, gSteps;
vec3  gSd;

float kVibe(float v) { return 1.0 - step(0.5, abs(u_vibe - v)); }
float kVoid(float k) { return mix(1.0, k, smoothstep(0.6, 0.9, u_rhythmicVoid)) * (1.0 + 0.6 * u_voidRelease); }

float kMagma(vec2 xz) {
  vec2 p = xz * 0.32 + gSd.xy;
  vec2 fl = vec2(0.35, 1.0) * gFlow;
  float h = 0.0, a = 0.55;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    h += a * noise3(vec3(p + fl * (1.0 + 0.3 * fi), gFlow * 0.15 + fi * 3.1 + gSd.z));
    p = rot2(0.7) * p * 2.03;
    a *= 0.5;
  }
  return h * 0.9;
}

// x = altura de pirámide (ya escalada por su cristalización) ·
// y = cc de la celda · z = labio de peldaño (1 en la arista)
vec3 kPyramid(vec2 xz) {
  vec2 id = floor(xz / PYR_CELL + 0.5);
  vec2 q = xz - id * PYR_CELL;
  float hs = hash21(id + gSd.xy);
  float cc = clamp(gCryst * 1.7 - hs * 0.7, 0.0, 1.0);
  cc = cc * cc * (3.0 - 2.0 * cc);
  if (cc <= 0.0) return vec3(-9.0, 0.0, 0.0);

  float halfW = PYR_CELL * (0.30 + 0.12 * hs);
  float m = max(abs(q.x), abs(q.y)) / halfW;             // norma L∞: planta cuadrada
  float u = (1.0 - m) * gSteps;
  float lvl = min(floor(u + 1.0) / gSteps, 1.0);         // escalonada
  float top = PYR_H * (0.75 + 0.5 * hs);
  float shrine = step(m, 0.16) * 0.2 * top;              // santuario en la cúspide
  float hp = m < 1.0 ? lvl * top + shrine : -1.2;
  // derretimiento: al perder cristal la silueta se ablanda y se hunde
  hp += (1.0 - cc) * 0.55 * noise3(vec3(xz * 0.9, gFlow + gSd.z));
  hp = mix(-3.0, hp, cc);
  float edge = (1.0 - smoothstep(0.0, 0.07, fract(u))) * step(m, 1.0);
  return vec3(hp, cc, edge);
}

// x = altura · y = 1 si manda la pirámide · z = labio · w = cota de magma
vec4 kHeight(vec2 xz) {
  float mg = kMagma(xz);
  vec3 py = kPyramid(xz);
  float isP = step(mg, py.x);
  return vec4(max(mg, py.x), isP * py.y, isP * py.z, mg);
}

// Cuerpo negro (lava) ↔ plasma (rave). heat 0..~1.5 → HDR lineal.
vec3 kHeatCol(float heat) {
  float h3 = heat * heat * heat;
  vec3 lava   = vec3(1.0, 0.24, 0.03) * heat * 2.6 + vec3(1.0, 0.72, 0.30) * h3 * 3.5;
  vec3 plasma = vec3(0.10, 0.55, 1.60) * heat * 2.6 + vec3(1.20, 0.30, 1.60) * h3 * 3.0;
  return mix(lava, plasma, gHard) * G_HEAT;
}

void mainImage(out vec4 c, in vec2 fragCoord) {
  float glitch, live, groove;
  euChannels(glitch, live, groove);
  vec4 tb = euTimbre();

  float beats = u_beatTime + u_time * 0.05;
  float fx = u_activeEffectEnergy;
  gSd = vec3(G_SEED * 43.1, G_SEED * -17.3, G_SEED * 99.2);

  // 🎭 topología por vibe
  gHard = max(kVibe(VIBE_RAVE), kVibe(VIBE_TECHNO));
  gSteps = float(G_STEPS) * mix(1.0, 1.5, gHard);

  // Dinámica: la lava corre con la energía integrada; el synth la espesa.
  gFlow = (beats * 0.07 + u_energyTime * 0.04) * G_FLOW * (1.0 - 0.4 * tb.y);

  // Cristalización tectónica — solo hechos físicos (Clean Shot)
  float massive = max(u_voidRelease * 1.3, 0.6 * u_crestPulse * u_kickEnergy);
  float heave = 0.18 * u_kickPulse * smoothstep(0.4, 0.9, u_percussiveness);
  gCryst = max(max(smoothstep(0.01, 0.4, fx), massive), heave);
  gCryst = clamp(gCryst * (1.0 + min(u_quake, 0.0)) + max(u_quake, 0.0), 0.0, 1.0);

  vec2 uv = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;
  float r = length(uv);
  float camZ = beats * 0.45;
  vec3 ro = vec3(0.8 * sin(beats * 0.04), 4.6 + 0.4 * u_epicness, camZ);
  vec3 fw = normalize(vec3(0.15 * sin(beats * 0.03), -0.38, 1.0));
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  vec2 su = rot2(fx * 1.1 / (r + 0.4)) * uv;              // §13.3 cizalladura 1/r
  vec3 rd = normalize(fw * 1.5 + rt * su.x + up * su.y);

  // ── Marcha del heightfield + bisección ──
  float t = 0.1, tPrev = 0.1, hitT = -1.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    float dy = p.y - kHeight(p.xz).x;
    if (dy < 0.002 * t) { hitT = t; break; }
    tPrev = t;
    t += clamp(dy * 0.4, 0.015, 0.3 + 0.03 * t);
    if (t > 48.0) break;
  }
  if (hitT > 0.0) {
    float a = tPrev, b = hitT;
    for (int k = 0; k < 6; k++) {
      float mid = 0.5 * (a + b);
      vec3 pm = ro + rd * mid;
      if (pm.y - kHeight(pm.xz).x < 0.0) b = mid; else a = mid;
    }
    hitT = b;
  }

  float hue = fract(G_HUE + u_chromaHue * 0.3);
  vec3 neon = palette(hue + 0.45, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  vec3 smoke = mix(vec3(0.030, 0.010, 0.006), vec3(0.008, 0.006, 0.030), gHard);
  vec3 skyGlow = kHeatCol(0.25) * 0.05;
  vec3 col = smoke + skyGlow * smoothstep(0.1, -0.3, rd.y);

  if (hitT > 0.0) {
    vec3 p = ro + rd * hitT;
    vec4 H = kHeight(p.xz);
    float e = 0.02;
    float hx = kHeight(p.xz + vec2(e, 0.0)).x;
    float hz = kHeight(p.xz + vec2(0.0, e)).x;
    vec3 n = normalize(vec3(H.x - hx, e, H.x - hz));
    vec3 L = normalize(vec3(-0.4, 0.7, 0.5));
    float dif = max(dot(n, L), 0.0);
    float f1 = 1.0 - max(0.0, dot(n, -rd));
    float fres = f1 * f1 * f1 * f1;

    // Magma: lo bajo está fundido; grietas ridged ^12 en la corteza.
    float heat = smoothstep(0.15, -0.55, H.w);
    float cr = 1.0 - abs(noise3(vec3(p.xz * 1.3 + vec2(0.0, gFlow * 0.8), gFlow * 0.3) + gSd));
    float cr2 = cr * cr, cr4 = cr2 * cr2;
    heat = max(heat, cr4 * cr4 * cr4 * 0.9);
    // §13.4 — el bombo inflama regiones, no el mapa entero
    float reg = hash21(floor(p.xz * 0.45) + gSd.xy);
    heat *= 1.0 + 0.9 * u_kickPulse * step(0.5, reg) + 0.6 * u_snareTruePulse * step(0.8, reg);
    heat *= 0.85 + 0.3 * tb.z;                             // percusión aviva
    vec3 crust = vec3(0.05, 0.04, 0.035) * (0.08 + dif) + kHeatCol(0.3) * 0.08 * (1.0 - n.y);
    vec3 magma = crust * (1.0 - heat) + kHeatCol(heat);

    // Pirámide cristalizada
    vec3 stone = mix(vec3(0.42, 0.34, 0.18), vec3(0.20, 0.36, 0.26), step(0.5, hash21(floor(p.xz / PYR_CELL + 0.5) + 3.1)));
    vec3 obsid = vec3(0.015);
    vec3 alb = mix(stone, obsid, gHard);
    vec3 rr = reflect(rd, n);
    float sp = max(dot(rr, L), 0.0);
    sp *= sp; sp *= sp; sp *= sp; sp *= sp;                // ^16
    vec3 pyr = alb * (0.06 + 1.1 * dif) + kHeatCol(0.4) * 0.12 * (1.0 - n.y)
             + sp * mix(0.15, 2.2, gHard) + fres * mix(vec3(0.1), neon * 0.8, gHard);
    vec3 lip = mix(kHeatCol(0.9), neon * 4.0, gHard) * H.z * (0.6 + 0.8 * u_kickPulse);
    pyr += lip * H.y;

    vec3 surf = mix(magma, pyr, step(0.001, H.y));
    float fog = exp(-hitT * 0.045);
    col = mix(col, surf, fog);
    col += kHeatCol(heat) * 0.02 * (1.0 - fog);              // el humo refleja la lava
  }

  // Ascuas — voronoi 3×3 en pantalla, suben; hi-hat/agudos las encienden
  vec2 eb = uv * 16.0 + vec2(0.0, mod(beats * 0.9, 512.0));
  vec2 eIp = floor(eb), eFp = fract(eb);
  vec3 emb = vec3(0.0);
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 cell = eIp + vec2(float(i), float(j));
    float cid = hash21(cell + gSd.yz);
    if (cid < 0.94) continue;
    vec2 off = (vec2(hash21(cell + 7.7), fract(cid * 3.7)) - 0.5) * 0.7;
    float ed = length(vec2(float(i), float(j)) + 0.5 + off - eFp);
    emb += kHeatCol(0.8) * smoothstep(0.12, 0.02, ed) * (0.4 + 0.6 * fract(cid * 11.0));
  }
  col += emb * (u_treble + u_hihatEnergy) * 0.6;

  // §13.3 — cataclismo: la tierra se vuelve blanca de calor / plasma HDR
  col = mix(col, col * vec3(1.6, 0.9, 1.4) + neon * 0.25 * fx, 0.5 * fx);

  if (glitch > 0.01) {
    float hg = hash21(vec2(floor(fragCoord.y / 6.0), floor(beats * 8.0)));
    col = mix(col, col.brg, step(1.0 - 0.35 * glitch, hg) * glitch);
  }
  col *= kVoid(0.35);
  col *= (0.8 + 0.45 * u_energy) * live;
  col *= 1.0 - 0.3 * dot(uv, uv);
  c = vec4(col, 1.0);
}
