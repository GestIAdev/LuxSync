// @euclid name    "Phase Mercury"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  metal+crystal
// @euclid genome  aggression=0.60 chaos=0.45 organicity=0.65
// @euclid zone    ambient..peak
// @euclid param   u_visc  float -1.0 1.0 0.0 "Viscosity"
// @euclid param   u_facet float -1.0 1.0 0.0 "Facets"
// @euclid gene    G_BLOBS  struct int   3    6     4    c:+0.4 o:+0.2
// @euclid gene    G_FACETS expr   float 2.0  6.0   3.0  a:+0.5 o:-0.4
// @euclid gene    G_WOBBLE expr   float 0.10 0.45  0.25 o:+0.6
// @euclid gene    G_ORBIT  expr   float 0.2  1.2   0.55 a:+0.3
// @euclid gene    G_HUE    expr   float 0.0  1.0   0.55 c:+0.3
// @euclid gene    G_SEED   expr   float 0.0  100.0 0.0
// @euclid steps   72
// Theia 2.0 · contract v2 — WAVE 8279 · D4 "Transición de Fase: Mercurio ↔ Cristal"
//
// El MATERIAL de la geometría cambia de estado con un único parámetro
// continuo, `visc`. Los pads sostenidos (u_synthSustain) funden la escena
// en metal líquido: uniones smin suaves, dominio que ondula con el reloj
// de energía, especular ancho, estelas largas. La percusión seca
// (u_percussiveness) la cristaliza: uniones afiladas, normales
// cuantizadas en facetas, especular de aguja, estelas cortas — y la caja
// verdadera (MACD) fractura sus filos.

uniform float u_visc;    // Regla del Cero Neutro: 0 = diseño canónico
uniform float u_facet;

#ifndef G_BLOBS
#define G_BLOBS 4.0
#endif
#ifndef G_FACETS
#define G_FACETS 3.0
#endif
#ifndef G_WOBBLE
#define G_WOBBLE 0.25
#endif
#ifndef G_ORBIT
#define G_ORBIT 0.55
#endif
#ifndef G_HUE
#define G_HUE 0.55
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif

#define PI       3.14159265359
#define TAU      6.28318530718
#define BOUND_R  2.9
#define BLOB_MAX 6
#define LUMA     vec3(0.2126, 0.7152, 0.0722)

// ── Canales globales (una evaluación por píxel) ─────────────────────────
float gBeats, gET, gVisc, gK, gRot, gAmp;

float mapPhase(vec3 p) {
  p.xz = rot2(gRot) * p.xz;
  p.xy = rot2(gRot * 0.37) * p.xy;
  // Mercurio: el dominio ondula con ∫energy·dt (Ley 1); el cristal está quieto.
  p += gVisc * G_WOBBLE * vec3(noise3(p * 0.8 + gET * 0.3),
                               noise3(p * 0.8 - gET * 0.3),
                               noise3(p * 0.8 + vec3(5.2, 1.3, 0.0) + gET * 0.2));
  // Núcleo: cubo (cristal) ↔ esfera (gota) — mezcla de dos SDF 1-Lipschitz.
  float d = mix(sdBox(p, vec3(0.62)) - 0.01, sdSphere(p, 0.8), gVisc);
  // Satélites en órbita: esquirlas giradas ↔ gotas; se funden con k(visc).
  for (int i = 0; i < BLOB_MAX; i++) {
    if (float(i) >= G_BLOBS) break;
    float fi = float(i);
    float ph = gBeats * TAU / 32.0 * G_ORBIT + fi * TAU / G_BLOBS + G_SEED;
    vec3 cp = vec3(cos(ph), 0.45 * sin(ph * 1.3 + fi), sin(ph))
            * (1.3 + 0.15 * sin(fi * 2.1 + gBeats * 0.25));
    vec3 q = p - cp;
    q.xy = rot2(ph * 1.7 + fi) * q.xy;
    q.yz = rot2(ph + fi * 0.7) * q.yz;
    float rs = 0.3 + 0.05 * sin(fi * 1.9 + G_SEED);
    d = smin(d, mix(sdBox(q, vec3(rs * 0.72)), sdSphere(q, rs), gVisc), gK);
  }
  // Rizado de la piel de mercurio (el bombo lo excita) — nulo en cristal.
  d -= gVisc * gAmp * noise3(p * 3.0 + vec3(0.0, gET, G_SEED));
  return d;
}

vec3 calcNormal(vec3 p) {
  const vec2 e = vec2(1.0, -1.0) * 0.0015;
  return normalize(e.xyy * mapPhase(p + e.xyy) + e.yyx * mapPhase(p + e.yyx) +
                   e.yxy * mapPhase(p + e.yxy) + e.xxx * mapPhase(p + e.xxx));
}

// Estudio procedural — el mercurio y el cristal viven de lo que reflejan.
vec3 envMap(vec3 r) {
  vec3 A = palette(u_chromaHue * 0.5 + G_HUE, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  vec3 B = palette(u_chromaHue * 0.5 + G_HUE + 0.45, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  A *= A;
  B *= B;
  float top   = smoothstep(0.55, 0.95, r.y) * smoothstep(0.75, 0.2, abs(r.x));
  float sideA = exp(-abs(r.x - 0.8) * 7.0) * smoothstep(-0.1, 0.3, r.y) * smoothstep(0.9, 0.4, r.y);
  float sideB = exp(-abs(r.x + 0.8) * 7.0) * smoothstep(-0.1, 0.3, r.y) * smoothstep(0.9, 0.4, r.y);
  return vec3(0.004) + vec3(1.5) * top * (0.55 + 0.45 * u_energy)
       + A * sideA * 1.7 + B * sideB * 1.7 + A * smoothstep(0.1, -0.6, r.y) * 0.05;
}

void mainImage(out vec4 c, in vec2 fragCoord) {
  // ── 1. CANALES ─────────────────────────────────────────────────────
  float glitch, live, groove;
  euChannels(glitch, live, groove);
  gBeats = u_beatTime + u_time * 0.05;
  gET    = u_energyTime;
  // 🔫 WAVE 8287 · Clean Shot — fx = clip físico vivo; swell respira al compás.
  float fx    = u_activeEffectEnergy;
  float swell = sin(3.1415927 * u_barPhase);

  // EL parámetro de fase: pads → mercurio (1), percusión seca → cristal (0).
  float visc = smoothstep(0.15, 0.75, u_synthSustain) * (1.0 - 0.8 * u_percussiveness);
  gVisc = clamp(visc + 0.35 * u_visc, 0.0, 1.0);
  gK    = mix(0.008, 0.40, gVisc);                          // cristal → mercurio
  gRot  = gBeats * TAU / 48.0;
  gAmp  = (0.04 + 0.10 * u_kickPulse + 0.05 * u_bass) * live;

  vec2 fc = fragCoord;
  if (glitch > 0.01) {
    float h = hash21(vec2(floor(fc.y / 7.0), floor(gBeats * 8.0)));
    fc.x += step(1.0 - 0.35 * glitch, h) * (h - 0.5) * u_resolution.x * 0.1 * glitch;
  }
  vec2 uv = (fc - 0.5 * u_resolution.xy) / u_resolution.y;

  // ── 2. CÁMARA — órbita lenta (obedece SPEED); el compás respira ────
  float az   = gBeats * TAU / 96.0;
  float camR = 4.6 - 0.5 * swell + 0.3 * u_kickPulse;
  vec3 ro = vec3(camR * sin(az), 0.9 + 0.3 * sin(u_time * 0.11), -camR * cos(az));
  vec3 ww = normalize(-ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.6 * ww);

  // ── 3. RAYMARCH acotado por esfera envolvente ─────────────────────
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
      float d = mapPhase(ro + rd * t);
      glow += exp(-max(d, 0.0) * 8.0) * 0.01;
      if (d < 0.001) { hit = true; break; }
      t += d * 0.6;                                        // Lipschitz del rizado
      if (t > tExit) break;
    }
  }

  vec3 bg  = envMap(rd) * 0.12;
  vec3 col = bg;
  vec3 disp = palette(u_chromaHue + G_HUE, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));

  if (hit) {
    vec3 p  = ro + rd * t;
    vec3 n0 = calcNormal(p);
    // Facetas: cuantizar la normal SOLO en estado cristalino.
    float F  = max(2.0, mix(G_FACETS * (1.0 + 0.4 * u_facet), 24.0, gVisc));
    vec3  nq = normalize(floor(n0 * F + 0.5));             // |n|=1 ⇒ nunca vec3(0)
    vec3  n  = normalize(mix(nq, n0, gVisc));
    vec3  fq = abs(fract(n0 * F + 0.5) - 0.5);             // 0.5 = frontera de faceta
    float edge = smoothstep(0.40, 0.5, max(fq.x, max(fq.y, fq.z))) * (1.0 - gVisc);

    vec3  V   = -rd;
    vec3  L   = normalize(vec3(-0.5, 0.8, -0.4));
    float ndv = clamp(dot(n, V), 0.0, 1.0);
    float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
    vec3  refl = envMap(reflect(rd, n));

    // Mercurio: espejo metálico denso. Cristal: obsidiana con dispersión
    // cromática en los ángulos rasantes.
    vec3 disp2 = palette(u_chromaHue + G_HUE + 2.0 * (1.0 - ndv), vec3(0.5), vec3(0.5),
                         vec3(1.0), vec3(0.0, 0.33, 0.67));
    vec3 metal = refl * (0.6 + 0.4 * fres) * vec3(0.95, 0.97, 1.0);
    vec3 glass = refl * fres * 0.9 + disp2 * disp2 * (1.0 - ndv) * (1.0 - ndv) * 0.5 + vec3(0.003);
    col = mix(glass, metal, gVisc);

    float spec = pow(max(dot(reflect(-L, n), V), 0.0), mix(96.0, 12.0, gVisc));
    col += spec * mix(1.6, 0.5, gVisc) * (0.6 + 0.4 * u_energy);

    // Caja verdadera (MACD): el cristal se FRACTURA por los filos de faceta.
    col += edge * (u_snareTruePulse * 2.4 + 0.12 * live) * disp2;
    // Bombo: la piel del mercurio se enciende en el fresnel al ondular.
    col += gVisc * u_kickPulse * 0.6 * fres * vec3(1.0, 0.92, 0.85);
    // Hi-hat: chispas en las aristas del cristal.
    col += step(0.99 - 0.02 * u_ultraAir, hash21(floor(fc * 0.5) + floor(gBeats * 6.0)))
         * u_hihatEnergy * (0.3 + edge) * vec3(1.6);

    col = mix(col, bg, 1.0 - exp(-t * 0.04));
  }
  col += glow * disp * (0.2 + 1.2 * u_kickPulse + 0.8 * fx) * (0.4 + 0.6 * gVisc);

  // ── 4. TRANSITORIOS GLOBALES ──────────────────────────────────────
  float r = length(uv);
  col += fx * 0.45 * palette(u_chromaHue + 0.5, vec3(0.5), vec3(0.5), vec3(1.0),
                              vec3(0.0, 0.33, 0.67)) * exp(-2.5 * r);
  if (glitch > 0.01) col = mix(col, col.gbr, 0.5 * glitch * step(0.6, hash21(vec2(floor(fc.y / 4.0), floor(gBeats * 8.0)))));

  // ── 5. TENSIÓN + VACÍO (v2: rampa suave + rebote ∝ al vacío) ───────
  float lum = dot(col, LUMA);
  col = mix(col, vec3(lum) * vec3(0.95, 1.0, 1.1), 0.45 * fx);
  col *= mix(1.0, 0.4, smoothstep(0.6, 0.9, u_rhythmicVoid));
  col *= 1.0 + 0.6 * u_voidRelease;

  // ── 6. MEMORIA — el mercurio deja estela, el cristal no ─────────────
  if (u_hasPrev > 0.5) {
    vec3 prev = texture(u_prevFrame, fragCoord / u_resolution.xy).rgb;
    prev *= prev;                                          // sRGB → lineal (aprox. γ2)
    float persist = clamp(mix(0.78, 0.94, gVisc) - 0.25 * glitch, 0.0, 0.94);
    col = max(col, prev * persist);
  }

  // ── 7. EXPOSICIÓN LINEAL — el epílogo posee ACES + sRGB ────────────
  col *= (1.0 + 0.5 * u_energy) * (0.5 + 0.5 * live);
  col *= 1.0 - 0.3 * dot(uv, uv);
  c = vec4(col, 1.0);
}
