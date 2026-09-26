// @euclid name    "Æther Serpent"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  ether
// @euclid genome  aggression=0.40 chaos=0.55 organicity=0.90
// @euclid zone    ambient..peak
// @euclid param   u_warpBoost    float -1.0 1.0 0.0 "Warp"
// @euclid param   u_densityBoost float -1.0 1.0 0.0 "Density"
// @euclid gene    G_SYM        struct int   3    9     5    a:+0.3 c:+0.2 o:-0.4
// @euclid gene    G_WARP       expr   float 0.4  2.2   1.25 a:+0.2 c:+0.8 o:+0.3
// @euclid gene    G_HUE_SPREAD expr   float 0.05 0.6   0.30 c:+0.6 o:+0.2
// @euclid gene    G_SEED       expr   float 0.0  100.0 0.0
// @euclid steps   56

uniform float u_warpBoost;     // Regla del Cero Neutro: 0 = diseño canónico
uniform float u_densityBoost;

// ── Genes (el Genome Expander inyecta #define antes del cuerpo) ────────
#ifndef G_SYM
#define G_SYM 5.0
#endif
#ifndef G_WARP
#define G_WARP 1.25
#endif
#ifndef G_HUE_SPREAD
#define G_HUE_SPREAD 0.30
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif

#define PI  3.14159265359
#define TAU 6.28318530718

// ── Canales sinestésicos (una evaluación por píxel en mainImage) ───────
float gBeats, gCamZ, gRadius, gWarp, gOct, gHurst, gTwist, gDensity, gLive;

// Hash 3D→1D sin senos (estable en highp, Hoskins).
float h13(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

// Value noise trilineal C1 en [-1,1].
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = h13(i);
  float n100 = h13(i + vec3(1.0, 0.0, 0.0));
  float n010 = h13(i + vec3(0.0, 1.0, 0.0));
  float n110 = h13(i + vec3(1.0, 0.0, 0.0));
  float n001 = h13(i + vec3(0.0, 0.0, 1.0));
  float n101 = h13(i + vec3(1.0, 0.0, 1.0));
  float n011 = h13(i + vec3(0.0, 1.0, 1.0));
  float n111 = h13(i + vec3(1.0, 0.0, 1.0));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z) * 2.0 - 1.0;
}

// fBm con octavas FRACCIONALES — u_morphFactor añade detalle sin "pops".
// H = persistencia (exponente de Hurst): la rugosidad del fluido.
float fbm(vec3 p, float octaves, float H) {
  float amp = 0.5, sum = 0.0, norm = 0.0;
  for (int i = 0; i < 6; i++) {
    float w = clamp(octaves - float(i), 0.0, 1.0);
    sum  += amp * w * vnoise(p);
    norm += amp * w;
    p = p * 2.02 + vec3(1.7, -3.1, 2.3);
    amp *= H;
  }
  return sum / max(norm, 1e-4);
}

// Espina dorsal de la serpiente: curva de Lissajous 3D en z.
vec2 serpent(float z) {
  return vec2(sin(z * 0.23 + G_SEED) * 1.4 + sin(z * 0.11 + 1.3) * 0.8,
              cos(z * 0.19 + G_SEED * 1.7));
}

// Densidad σ(x): cáscara de túnel × fBm sobre dominio deformado + anillos
// de choque. `fil` devuelve el valor de filamento y `ang` el ángulo polar
// (para el anillo armónico del chromagrama).
float density(vec3 p, out float fil, out float ang) {
  vec3 q = p;
  q.xy -= serpent(q.z);
  // Torsión: base lenta en rejilla de 16 beats + tensión de Cassandra.
  q.xy *= rot2(q.z * gTwist + gBeats * TAU / 16.0);
  float r = length(q.xy);
  ang = atan(q.y, q.x);
  // Pliegue polar de orden G_SYM — simetría diédrica del mandala.
  float seg = TAU / G_SYM;
  float a = abs(mod(ang, seg) - 0.5 * seg);
  q.xy = vec2(cos(a), sin(a)) * r;
  // Domain warping analítico en 2 capas — la viscosidad del éter.
  vec3 w = q;
  w += gWarp * sin(w.zxy * 0.8 + vec3(gBeats * 0.50, gBeats * 0.37, gBeats * 0.29));
  w += gWarp * 0.5 * sin(w.yzx * 1.7 - gBeats * 0.23);
  fil = fbm(w * 0.9, gOct, gHurst);
  // Pared blanda: su grosor es la atmósfera ambient de Omniliquid.
  float wall  = 0.9 + 0.6 * u_lqAmbient;
  float shell = 1.0 - smoothstep(0.0, wall, abs(r - gRadius + fil * 0.8));
  // Anillo de choque: cada KICK lanza uno que vuela hacia el fondo.
  float ringZ = gCamZ + 1.5 + (1.0 - u_kickPulse) * 14.0;
  float ring  = u_kickPulse * exp(-abs(p.z - ringZ) * 3.0) * exp(-abs(r - gRadius) * 1.5);
  return max(shell * (0.55 + 0.45 * fil), 0.0) * gDensity + 2.0 * ring;
}

void mainImage(out vec4 c, in vec2 fragCoord) {
  // ── 1. CANALES (§3.1 — euChannels del preámbulo: Ley de Uniformidad G6)
  float tc, td, glitch, live, groove;
  euChannels(tc, td, glitch, live, groove);
  gLive  = live;
  gBeats = u_beatTime + u_time * 0.05;        // Ley de Integración: reloj del host
  gCamZ  = gBeats * 1.1 + u_time * 0.35;
  float rel = u_impact;

  gRadius  = 2.3 + 0.5 * u_subBass * gLive - 1.1 * tc + 1.6 * rel + 0.8 * td;
  gWarp    = G_WARP * max(0.35 + 0.9 * u_bass + 0.4 * u_warpBoost, 0.05) * (1.0 + tc);
  gOct     = mix(2.0, 5.0, u_morphFactor);                       // complejidad ← Omniliquid
  gHurst   = clamp(mix(0.42, 0.68, u_flatness) + 0.15 * u_harshness, 0.3, 0.8);
  gTwist   = 0.06 + 0.7 * tc;
  gDensity = max(0.6 + 0.8 * u_energy + 0.5 * u_densityBoost, 0.05) * (1.0 - 0.7 * td) * gLive;

  // ── 2. GLITCH DIGITAL (régimen discreto, solo con APOCALYPSE) ───────
  vec2 fc = fragCoord;
  if (glitch > 0.01) {
    float band = floor(fc.y / u_resolution.y * 24.0);
    float h = hash21(vec2(band, floor(gBeats * 4.0)));   // re-sorteo cada semicorchea
    fc.x += step(1.0 - 0.35 * glitch, h) * (h - 0.5) * u_resolution.x * 0.18 * glitch;
  }
  vec2 uv = (fc - 0.5 * u_resolution.xy) / u_resolution.y;
  uv *= rot2(0.25 * sin(gBeats * TAU / 32.0));           // roll en rejilla de 8 compases

  // ── 3. CÁMARA — la tensión estrecha el FOV, el impacto lo abre ─────
  vec3 ro = vec3(serpent(gCamZ), gCamZ);
  vec3 ta = vec3(serpent(gCamZ + 2.5), gCamZ + 2.5);
  vec3 fw = normalize(ta - ro);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  float focal = 1.1 + 0.9 * tc - 0.5 * rel;
  vec3 rd = normalize(uv.x * rt + uv.y * up + focal * fw);

  // ── 4. INTEGRAL DE EMISIÓN-ABSORCIÓN (Beer-Lambert, front-to-back) ──
  vec3  col     = vec3(0.0);
  float trans   = 1.0;
  float t       = 0.2;
  float hueBase = u_chromaHue + 0.5 * rel;                     // impacto → complementario
  float sat     = 0.5 * (0.35 + 0.65 * u_saturation);
  vec3  phase   = vec3(0.0, 0.33, 0.67) + 0.15 * u_brightnessSpec;  // centroide → temperatura
  for (int i = 0; i < MAX_STEPS; i++) {
    float dt = 0.09 + t * 0.012;
    vec3 p = ro + rd * t;
    float fil, ang;
    float sigma = density(p, fil, ang);
    if (sigma > 0.002) {
      float alpha = 1.0 - exp(-sigma * dt * 2.4);
      int   pitch = int(mod(floor((ang + PI) / TAU * 12.0), 12.0));
      float harm  = 0.35 + 1.4 * u_chroma(pitch);              // anillo armónico
      vec3 e = palette(hueBase + G_HUE_SPREAD * fil + 0.015 * p.z,
                       vec3(0.5), vec3(sat), vec3(1.0), phase);
      e *= harm * (0.6 + 1.6 * fil * fil);
      if (u_hihatEnergy > 0.05) {
        e += u_hihatEnergy * 2.0 * (1.0 + u_ultraAir)
           * smoothstep(0.55, 0.8, vnoise(p * 9.0 + gBeats));  // chispas granulares
      }
      col   += trans * alpha * e;
      trans *= 1.0 - alpha;
      if (trans < 0.01) break;
    }
    t += dt;
  }
  // Fondo: la transmitancia restante ve la niebla de suelo de Omniliquid.
  col += trans * palette(hueBase + 0.5, vec3(0.02), vec3(0.03), vec3(1.0),
                         vec3(0.1, 0.2, 0.3)) * (0.3 + u_lqFloor);

  // ── 5. CONSERVACIÓN DE LA TENSIÓN — color ───────────────────────────
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum), 0.65 * tc);                        // la tensión drena el color
  col += rel * 0.35 * palette(hueBase, vec3(0.5), vec3(0.5), vec3(1.0), phase)
       * exp(-3.0 * length(uv));                               // estallido LOCAL, no full-field
  if (ACID) col *= 0.75 + 0.25 * sin(vec3(0.0, 2.1, 4.2) + length(uv) * 18.0 - gBeats * PI);

  // ── 6. TONEMAP + VIÑETA (el epílogo aplica masters, limitador y sRGB) ──
  col = 1.0 - exp(-col * (1.0 + 0.6 * u_energy));
  col *= 1.0 - 0.35 * dot(uv, uv);
  c = vec4(col, 1.0);
}
