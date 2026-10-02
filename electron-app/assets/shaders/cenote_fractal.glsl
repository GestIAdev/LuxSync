// @euclid name    "Cenote Fractal"
// @euclid author  "LuxSync · Pack Latino · Triunvirato"
// @euclid family  fluid+crystal
// @euclid genome  aggression=0.30 chaos=0.45 organicity=0.90
// @euclid zone    valley..intense
// @euclid vibes   fiesta-latina, rave, chill, agua, cenote
// @euclid param   u_murk float -1.0 1.0 0.0 "Murk"
// @euclid gene    G_RADIUS expr   float 1.6  3.0   2.2  o:+0.2
// @euclid gene    G_BEND   expr   float 0.0  2.0   0.8  c:+0.5
// @euclid gene    G_MURK   expr   float 0.2  1.5   0.7  o:+0.4
// @euclid gene    G_SHARDS expr   float 0.0  1.0   0.6  a:+0.4 c:+0.3
// @euclid gene    G_HUE    expr   float 0.0  1.0   0.10 o:+0.2
// @euclid gene    G_SEED   expr   float 0.0  100.0 0.0
// @euclid steps   80
// Theia 2.0 · contract v2 — WAVE 8429 · Triunvirato Latino (autoría nativa v2)
//
// ── CENOTE FRACTAL ──────────────────────────────────────────────────────────
// Caverna sumergida serpenteante. Tres capas de luz:
//   1. Superficie — caliza mojada iluminada por cáusticas (ruido ridged
//      proyectado desde el techo) + falso SSS: las puntas finas de las
//      estalactitas TRANSMITEN la luz (grosor sondeado hacia dentro).
//   2. Volumen — 20 muestras jittered a lo largo del rayo: haces de los
//      tragaluces (gaussiana vertical por apertura) × cáusticas × densidad
//      fBm advectada. Transmitancia Beer-Lambert.
//   3. Espacio NO EUCLÍDEO — cada paso del rayo rota la sección alrededor
//      del eje del túnel en proporción a t (distancia a la cámara, nunca
//      p.z absoluto): la lente se curva más cuanto más lejos miras.
//
// 🎭 u_vibe — el líquido CRISTALIZA (instantáneo, como pide el blueprint):
//   LATINO/otros → agua densa dorada, roca fBm viscosa, corrientes suaves.
//   RAVE/TECHNO  → sección heptagonal dura + esquirlas KIFS (3 pliegues
//                  abs+rot = espejos rotos) + 1 rebote especular con tinte
//                  espectral por faceta (normal cuantizada) + haces con
//                  dispersión RGB. El cataclismo (fx>0.5) cristaliza también.

uniform float u_murk;

#ifndef G_RADIUS
#define G_RADIUS 2.2
#endif
#ifndef G_BEND
#define G_BEND 0.8
#endif
#ifndef G_MURK
#define G_MURK 0.7
#endif
#ifndef G_SHARDS
#define G_SHARDS 0.6
#endif
#ifndef G_HUE
#define G_HUE 0.10
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif

#define TAU      6.28318530718
#define SHARD_Z  1.8
#define OPEN_Z   7.0

float gCrystal, gFlow, gBendK, gFx;
vec3  gSd;

float cVibe(float v) { return 1.0 - step(0.5, abs(u_vibe - v)); }
float cVoid(float k) { return mix(1.0, k, smoothstep(0.6, 0.9, u_rhythmicVoid)) * (1.0 + 0.6 * u_voidRelease); }

vec2 cPath(float z) {
  return vec2(1.1 * sin(z * 0.21) + 0.4 * sin(z * 0.077), 0.7 * cos(z * 0.17));
}

float cFbm(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) {
    s += a * noise3(p);
    p = p * 2.02 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}

// Cáusticas: ruido ridged (1-|n|)^k — filamentos brillantes, sin divisiones.
float cCaustic(vec2 p, float t) {
  float a = 1.0 - abs(noise3(vec3(p, t)));
  float b = 1.0 - abs(noise3(vec3(p * 2.1 + 5.0, t * 1.3)));
  float a2 = a * a;
  float b2 = b * b, b4 = b2 * b2;
  return a2 * a2 * a2 + 0.6 * b4 * b4;           // a^6 + 0.6·b^8
}

// ── Agua libre > 0 · roca < 0 ──
float cOrganic(vec3 p, vec2 q) {
  vec3 w = p * 0.55 + gSd + vec3(0.0, -gFlow * 0.35, gFlow * 0.15);   // corriente viscosa
  float rock = cFbm(w);
  float stal = noise3(vec3(p.xz * 1.7, 0.0) + gSd) * smoothstep(0.0, 1.2, q.y);  // techo gotea
  return G_RADIUS - length(q * vec2(1.0, 1.15)) + 0.60 * rock + 0.35 * max(stal, 0.0);
}

float cCrystalMap(vec3 p, vec2 q) {
  // sección heptagonal: apotema − proyección sobre la normal del sector
  float sector = TAU / 7.0;
  float a2 = mod(atan(q.y, q.x) + 0.5 * sector, sector) - 0.5 * sector;
  float wall = G_RADIUS * 0.92 - length(q) * cos(a2);

  // esquirlas KIFS por rodaja de z — espejos rotos
  float id = floor(p.z / SHARD_Z);
  float zl = p.z - (id + 0.5) * SHARD_Z;
  vec3 s = vec3(q, zl);
  float h = hash21(vec2(id, 7.0) + gSd.xy);
  s.xy = rot2(h * TAU) * s.xy;
  s.yz = rot2((h - 0.5) * 1.2) * s.yz;
  float fs = 1.0;
  for (int k = 0; k < 3; k++) {
    s = abs(s) - vec3(0.62, 0.38, 0.22) * fs;
    s.xy = rot2(0.62) * s.xy;
    s.xz = rot2(0.41) * s.xz;
    fs *= 0.62;
  }
  float shard = sdBox(s, vec3(0.34, 0.025, 0.42) * (0.6 + 0.8 * G_SHARDS));
  shard = min(shard, 0.5 * SHARD_Z - abs(zl) + 0.05);   // cota de rodaja
  return min(wall, shard);
}

float cMap(vec3 p) {
  vec2 q = p.xy - cPath(p.z);
  return gCrystal > 0.5 ? cCrystalMap(p, q) : cOrganic(p, q);
}

// Curvatura no euclídea: rota la sección alrededor del eje según t.
vec3 cBend(vec3 p, float t) {
  vec2 c0 = cPath(p.z);
  p.xy = c0 + rot2(gBendK * t) * (p.xy - c0);
  return p;
}

// Haz de los tragaluces (escalar) + offset lateral para la dispersión.
float cShaft(vec3 p, float off, out float hz) {
  float id = floor(p.z / OPEN_Z);
  hz = hash21(vec2(id, 3.0) + gSd.xy);
  vec2 c0 = cPath(p.z);
  vec2 axis = vec2(c0.x + (hz - 0.5) * 1.6 + off, (id + 0.5) * OPEN_Z);
  vec2 dv = vec2(p.x, p.z) - axis;
  float rad = 0.55 + 0.35 * hz;
  float fall = smoothstep(-G_RADIUS, G_RADIUS, p.y - c0.y);   // más luz cerca del techo
  return exp(-dot(dv, dv) / (rad * rad)) * (0.25 + 0.75 * fall);
}

void mainImage(out vec4 c, in vec2 fragCoord) {
  float glitch, live, groove;
  euChannels(glitch, live, groove);
  vec4 tb = euTimbre();

  float beats = u_beatTime + u_time * 0.05;
  float swell = sin(3.1415927 * u_barPhase) * u_speed;
  gFx = u_activeEffectEnergy;
  gSd = vec3(G_SEED * 43.1, G_SEED * -17.3, G_SEED * 99.2);

  // 🎭 cristalización instantánea por vibe (o por cataclismo)
  float vibeHard = max(cVibe(VIBE_RAVE), cVibe(VIBE_TECHNO));
  gCrystal = max(vibeHard, step(0.5, gFx));

  // Dinámica: el synth sostenido espesa el agua (corriente más lenta y
  // pesada); los medios limpios avivan el flujo; vapor curva el espacio.
  gFlow = beats * (0.10 + 0.08 * u_cleanMid) * (1.0 - 0.35 * tb.y) + u_energyTime * 0.05;
  gBendK = G_BEND * 0.035 * (0.4 + u_vaporPressure + 0.3 * swell) * (1.0 + 3.0 * gFx);
  float murk = G_MURK * (1.0 + 0.6 * max(u_murk, -0.9)) * (0.8 + 0.5 * tb.y);

  vec2 uv = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;
  float camZ = beats * 0.55;
  vec3 ro = vec3(cPath(camZ), camZ);
  ro.y += 0.25 * sin(beats * 0.11);
  vec3 fw = normalize(vec3(cPath(camZ + 2.5) - cPath(camZ), 2.5));
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  vec3 rd = normalize(fw * (1.45 - 0.3 * u_epicness) + rt * uv.x + up * uv.y);

  // ── Marcha primaria (espacio curvo → paso conservador 0.6) ──
  float t = 0.05, hitT = -1.0;
  vec3 hp = ro;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = cBend(ro + rd * t, t);
    float d = cMap(p);
    if (d < 0.0015 * t) { hitT = t; hp = p; break; }
    t += d * 0.6;
    if (t > 26.0) break;
  }

  // Paleta: oro viscoso ↔ luz blanca espectral; puente de tonalidad global.
  float hue = fract(G_HUE + u_chromaHue * 0.35);
  vec3 tint = palette(hue, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  vec3 gold = mix(vec3(1.0, 0.70, 0.26), tint, 0.25);
  vec3 beamCol = mix(gold, vec3(0.9, 0.95, 1.0), gCrystal);
  vec3 deep = mix(vec3(0.010, 0.030, 0.024), vec3(0.004, 0.010, 0.022), gCrystal);
  vec3 L = normalize(vec3(0.2, 1.0, 0.15));

  vec3 col = deep;
  if (hitT > 0.0) {
    vec2 e = vec2(0.002, -0.002);
    vec3 n = normalize(e.xyy * cMap(hp + e.xyy) + e.yyx * cMap(hp + e.yyx) +
                       e.yxy * cMap(hp + e.yxy) + e.xxx * cMap(hp + e.xxx));
    float f1 = 1.0 - max(0.0, dot(n, -rd));
    float fres = f1 * f1 * f1 * f1 * f1;
    float ao = clamp(cMap(hp + n * 0.25) / 0.25, 0.0, 1.0);
    float caus = cCaustic(hp.xz * 0.9 + gSd.xy, gFlow * 1.3);
    float dif = max(dot(n, L), 0.0);

    if (gCrystal < 0.5) {
      // Caliza mojada + falso SSS (puntas finas transmiten el oro)
      float transl = clamp(1.0 + cMap(hp - n * 0.35) / 0.35, 0.0, 1.0);
      vec3 alb = vec3(0.16, 0.13, 0.09);
      col = alb * (0.05 + dif * (0.4 + 1.6 * caus) * beamCol) * (0.3 + 0.7 * ao)
          + transl * beamCol * (0.35 + 0.9 * u_cleanMid) * (0.6 + 0.6 * tb.y)
          + fres * 0.25 * beamCol;
    } else {
      // Espejo roto: un rebote especular, tinte espectral por faceta
      vec3 rr = reflect(rd, n);
      float tr = 0.04;
      float rh = -1.0;
      for (int k = 0; k < 28; k++) {
        float d = cMap(hp + n * 0.02 + rr * tr);
        if (d < 0.002) { rh = tr; break; }
        tr += d * 0.8;
        if (tr > 10.0) break;
      }
      float fh;
      vec3 rp = hp + rr * max(rh, 4.0);
      float rs = cShaft(rp, 0.0, fh);
      vec3 env = mix(deep * 2.0, beamCol * (0.3 + 1.2 * rs), rh < 0.0 ? 1.0 : 0.55);
      vec3 facet = palette(hash31(floor(n * 4.0) + gSd) + hue,
                           vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
      float spec = max(dot(rr, L), 0.0);
      spec *= spec; spec *= spec; spec *= spec; spec *= spec; spec *= spec; // ^32
      col = env * mix(vec3(1.0), facet, 0.65) * (0.25 + 0.9 * fres + 0.4 * ao)
          + spec * (2.5 + 4.0 * u_hihatEnergy) * facet;
    }
    col = mix(deep, col, exp(-hitT * 0.06 * murk));
  }

  // ── Volumen: haces de los tragaluces × cáusticas × densidad advectada ──
  float tEnd = hitT > 0.0 ? min(hitT, 26.0) : 26.0;
  float dt = tEnd / 20.0;
  float jit = hash21(fragCoord + gSd.xy);
  vec3 vol = vec3(0.0);
  float trans = 1.0;
  float disp = 0.14 * gCrystal;                 // dispersión RGB (solo cristal)
  for (int k = 0; k < 20; k++) {
    float ts = (float(k) + jit) * dt;
    vec3 ps = cBend(ro + rd * ts, ts);
    float dens = murk * (0.55 + 0.45 * noise3(ps * 0.4 + vec3(0.0, -gFlow * 0.5, 0.0) + gSd));
    float hz;
    float sg = cShaft(ps, 0.0, hz);
    vec3 sh = vec3(cShaft(ps, disp, hz), sg, cShaft(ps, -disp, hz));
    float caus = cCaustic(ps.xz * 0.9 + gSd.xy, gFlow * 1.3);
    // §13.4 — el bombo enciende MUCHOS tragaluces, nunca todos
    float kick = 1.0 + 1.6 * u_kickPulse * step(0.45, hz) + 1.2 * u_snareTruePulse * step(0.75, hz);
    vol += trans * beamCol * sh * (0.35 + 0.65 * caus) * kick * dens * dt;
    trans *= exp(-dens * dt * 0.09);
  }
  col = col * trans + vol * (0.55 + 0.6 * u_energy) * (1.0 + 0.8 * u_vocalOnset * tb.x);

  // §13.3 — cataclismo: la luz se rompe en cian/magenta HDR
  float fxLum = dot(vol, vec3(0.33));
  col = mix(col, col * vec3(0.4, 1.3, 1.7) + fxLum * vec3(1.6, 0.2, 1.2), 0.55 * gFx);

  if (glitch > 0.01) {
    float hg = hash21(vec2(floor(fragCoord.y / 6.0), floor(beats * 8.0)));
    col = mix(col, col.brg, step(1.0 - 0.35 * glitch, hg) * glitch);
  }
  col *= cVoid(0.4);
  col *= (0.8 + 0.4 * u_energy) * live;
  col *= 1.0 - 0.3 * dot(uv, uv);
  c = vec4(col, 1.0);
}
