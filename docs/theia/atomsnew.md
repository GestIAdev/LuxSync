Ahora los compilo con el preámbulo/epílogo reales del motor y los valido con `glslangValidator` (ES 3.00), tanto con fallback `#ifndef` como con genes expr inyectados como `u_gene[k]`:

Salida silenciosa = compilación limpia. Confirmo que el validador realmente detecta errores (control negativo) y limpio los temporales:

Los tres átomos compilan sin errores. Los monté con el preámbulo y el epílogo reales del motor (`ShaderAssembler`) y los validé con `glslangValidator` (GLSL ES 3.00) en dos modos: con los valores por defecto de los genes y con los genes `expr` inyectados como `u_gene[k]`. Una prueba con un error metido a propósito confirmó que el validador sí los detecta. No los he probado todavía en la app en marcha, así que conviene verlos en pantalla antes del show. Los archivos están en `.tmp_genome/` y no se han añadido a `assets/shaders/`.

Una desviación deliberada en Liquid Nebula: ni `live` ni `tc` multiplican el reloj, porque eso haría saltar la fase de golpe cuando cambian. Se suman a la fase (así la subida acelera la turbulencia sin tirones) y `live` controla la fuerza del warp, que es lo que hace que respire.

**Átomo 1 — Neon Conduit**: túnel poligonal infinito hecho con raymarching. La cámara avanza con el beat, un frente de luz sale disparado hacia el fondo con cada kick y el canal `glitch` retuerce, desplaza y separa en RGB el espacio cuando la música se pone agresiva.

```glsl
// @euclid name    "Neon Conduit"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  tunnel+lattice
// @euclid genome  aggression=0.85 chaos=0.45 organicity=0.15
// @euclid zone    rising..peak
// @euclid param   u_glow  float -1.0 1.0 0.0 "Glow"
// @euclid param   u_twist float -1.0 1.0 0.0 "Twist"
// @euclid gene    G_SIDES struct int   4    8     6    a:+0.3 c:+0.2 o:-0.3
// @euclid gene    G_RIB   expr   float 0.6  3.0   1.4  a:+0.4 o:-0.2
// @euclid gene    G_VEL   expr   float 0.5  3.0   1.6  a:+0.6
// @euclid gene    G_HUE   expr   float 0.0  1.0   0.55 c:+0.3
// @euclid gene    G_SEED  expr   float 0.0  100.0 0.0
// @euclid steps   64

uniform float u_glow;    // Regla del Cero Neutro: 0 = diseño canónico
uniform float u_twist;

#ifndef G_SIDES
#define G_SIDES 6.0
#endif
#ifndef G_RIB
#define G_RIB 1.4
#endif
#ifndef G_VEL
#define G_VEL 1.6
#endif
#ifndef G_HUE
#define G_HUE 0.55
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif

#define PI     3.14159265359
#define TAU    6.28318530718
#define TUBE_R 2.0
#define FAR    40.0

// ── Canales globales (una evaluación por píxel) ─────────────────────────
float gBeats, gGlitch, gTwist, gKickZ;

// Distancia a un n-gono regular de apotema r (negativa dentro).
float sdNgon(vec2 p, float n, float r) {
  float seg = TAU / n;
  float a = mod(atan(p.y, p.x) + 0.5 * seg, seg) - 0.5 * seg;
  return length(p) * cos(a) - r;
}

// Espacio del túnel: torsión continua (reloj) + desgarro (glitch).
vec3 warpTunnel(vec3 p) {
  float tw = gTwist * p.z + gGlitch * 0.9 * sin(p.z * 1.7 + gBeats * PI);
  p.xy = rot2(tw) * p.xy;
  // Glitch rompe la simetría: cizalla por bloques discretos de z.
  float blk = floor(p.z * 1.5);
  p.x += gGlitch * 0.45 * (hash21(vec2(blk, G_SEED)) - 0.5);
  return p;
}

// d = distancia a la escena; rib = distancia a las costillas emisivas.
float mapScene(vec3 p, out float rib) {
  p = warpTunnel(p);
  float wall = -sdNgon(p.xy, G_SIDES, TUBE_R);            // interior del tubo
  float zr = mod(p.z, G_RIB) - 0.5 * G_RIB;
  rib = max(abs(zr) - 0.05, -sdNgon(p.xy, G_SIDES, TUBE_R - 0.22));
  return min(wall, rib);
}

void mainImage(out vec4 c, in vec2 fragCoord) {
  // ── 1. CANALES ─────────────────────────────────────────────────────
  float tc, td, glitch, live, groove;
  euChannels(tc, td, glitch, live, groove);
  gGlitch = glitch;
  gBeats  = u_beatTime + u_time * 0.05;
  gTwist  = 0.035 + 0.05 * u_twist + 0.06 * tc;
  float rel = u_impact;

  // Scanline tear (glitch agresivo) antes de construir el rayo.
  vec2 fc = fragCoord;
  if (glitch > 0.01) {
    float h = hash21(vec2(floor(fc.y / 6.0), floor(gBeats * 8.0)));
    fc.x += step(1.0 - 0.4 * glitch, h) * (h - 0.5) * u_resolution.x * 0.2 * glitch;
  }
  vec2 uv = (fc - 0.5 * u_resolution.xy) / u_resolution.y;

  // ── 2. CÁMARA — avanza con el reloj musical (obedece SPEED) ─────────
  float camZ = gBeats * G_VEL;
  vec3 ro = vec3(0.0, 0.0, camZ);
  float fov = 1.25 - 0.45 * tc + 0.25 * rel;                // tensión = teleobjetivo
  vec3 rd = normalize(vec3(uv, fov));
  rd.xy = rot2(0.15 * sin(gBeats * PI * 0.125)) * rd.xy;    // alabeo lento

  // Frente de onda del kick: nace delante de la cámara y viaja al fondo.
  gKickZ = camZ + 1.5 + (1.0 - u_kickPulse) * 16.0;

  // ── 3. RAYMARCH con acumulación de neón ───────────────────────────
  float t = 0.05;
  float rib = 1.0;
  vec3 glow = vec3(0.0);
  bool hit = false;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    float d = mapScene(p, rib);
    // Emisión volumétrica de las costillas — color por profundidad.
    vec3 neon = palette(G_HUE + u_chromaHue * 0.25 + p.z * 0.015,
                        vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.1, 0.2));
    neon *= neon;                                           // saturación lineal
    float wave = exp(-abs(p.z - gKickZ) * 1.2);
    float emit = (0.35 + 0.25 * u_glow) * (0.4 + 1.8 * u_kickPulse * wave + 0.6 * u_bass);
    glow += neon * emit * 0.006 / (0.004 + rib * rib) * exp(-t * 0.07);
    if (d < 0.0015 * t) { hit = true; break; }
    t += d * 0.85;
    if (t > FAR) break;
  }

  // ── 4. PARED — costuras de las aristas del polígono ────────────────
  vec3 col = vec3(0.0);
  if (hit) {
    vec3 p = warpTunnel(ro + rd * t);
    float seg = TAU / G_SIDES;
    float a = mod(atan(p.y, p.x) + 0.5 * seg, seg) - 0.5 * seg;
    float seam = exp(-abs(abs(a) - 0.5 * seg) * 60.0);      // arista del n-gono
    float lane = exp(-abs(fract(p.z * 0.5 - gBeats * 0.5) - 0.5) * 24.0);
    vec3 seamCol = palette(G_HUE + 0.5 + u_chromaHue * 0.25,
                           vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
    col += seamCol * seam * (0.6 + 2.5 * u_kickPulse) * live;
    col += seamCol * lane * seam * u_hihatEnergy * 3.0;     // luces de pista hi-hat
    col += vec3(0.015, 0.02, 0.03) * (0.5 + u_lqFloor);     // pared base (casi negra)
    col *= exp(-t * 0.06);                                  // niebla
  }
  col += glow;

  // ── 5. TRANSITORIOS — tiempo real ─────────────────────────────────
  // Snare: barrido horizontal blanco.
  col += u_snarePulse * 0.5 * exp(-abs(uv.y - (0.5 - u_snarePulse)) * 18.0) * vec3(0.9, 0.95, 1.0);
  // Impact: estallido complementario en el punto de fuga.
  col += rel * 1.2 * palette(u_chromaHue + 0.5, vec3(0.5), vec3(0.5), vec3(1.0),
                             vec3(0.0, 0.33, 0.67)) * exp(-length(uv) * 4.0);
  // Glitch: aberración cromática por separación de canales.
  if (glitch > 0.01) col = mix(col, col.brg, 0.5 * glitch * step(0.5, hash21(fc * 0.01 + gBeats)));

  // ── 6. CONSERVACIÓN DE LA TENSIÓN + EXPOSICIÓN LINEAL ──────────────
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum), 0.5 * tc);
  if (RHYTHMIC_VOID) col *= 0.35;
  col *= (1.0 + 0.7 * u_energy) * live;
  col *= 1.0 - 0.3 * dot(uv, uv);
  c = vec4(col, 1.0);
}
```

**Átomo 2 — Sacred Bouncer**: caleidoscopio con KIFS 2D que se estira y se aplasta con el kick y abre su escala con el bajo. Los filamentos y las "joyas" de los nodos se tiñen según `u_chromaHue`, y el impacto trae un halo del color complementario.

```glsl
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
  float a = atan(uv.y, uv.x) + dir * (beats * TAU / 32.0) + u_snarePulse * 0.25;
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
  // Anillo de choque del kick desde el centro.
  col += u_kickPulse * 0.9 * exp(-abs(r - (0.9 - 0.7 * u_kickPulse)) * 22.0)
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
  if (RHYTHMIC_VOID) col *= 0.4;
  col *= 1.0 + 0.6 * u_energy;
  col *= 1.0 - 0.3 * dot(uv, uv);
  c = vec4(col, 1.0);
}
```

**Átomo 3 — Liquid Nebula**: plasma hecho con doble domain warping FBM, sin bordes duros. Evoluciona despacio sobre `u_time`, la subida acelera la turbulencia y los kicks llegan como ondas de presión suaves, con estela líquida del frame anterior.

```glsl
// @euclid name    "Liquid Nebula"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  ether+fluid
// @euclid genome  aggression=0.15 chaos=0.50 organicity=0.95
// @euclid zone    calm..rising
// @euclid param   u_viscosity float -1.0 1.0 0.0 "Viscosity"
// @euclid param   u_trails    float -1.0 1.0 0.0 "Trails"
// @euclid gene    G_OCT    struct int   3    6     5    c:+0.4 o:+0.3
// @euclid gene    G_WARP   expr   float 1.0  6.0   3.5  c:+0.6 o:+0.4
// @euclid gene    G_SCALE  expr   float 0.8  3.0   1.6  a:+0.2
// @euclid gene    G_FLOW   expr   float 0.02 0.3   0.08 a:+0.4 o:-0.2
// @euclid gene    G_HUE    expr   float 0.0  1.0   0.62 c:+0.3
// @euclid gene    G_SEED   expr   float 0.0  100.0 0.0

uniform float u_viscosity;   // Regla del Cero Neutro: 0 = diseño canónico
uniform float u_trails;

#ifndef G_OCT
#define G_OCT 5.0
#endif
#ifndef G_WARP
#define G_WARP 3.5
#endif
#ifndef G_SCALE
#define G_SCALE 1.6
#endif
#ifndef G_FLOW
#define G_FLOW 0.08
#endif
#ifndef G_HUE
#define G_HUE 0.62
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif

#define PI      3.14159265359
#define TAU     6.28318530718
#define OCT_MAX 6

// FBM de value-noise — octavas rotadas para matar artefactos de retícula.
float fbm(vec3 p) {
  float acc = 0.0;
  float amp = 0.5;
  for (int i = 0; i < OCT_MAX; i++) {
    if (float(i) >= G_OCT) break;
    acc += amp * noise3(p);
    p.xy = rot2(0.6) * p.xy;
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    amp *= 0.5;
  }
  return acc;
}

void mainImage(out vec4 c, in vec2 fragCoord) {
  // ── 1. CANALES ─────────────────────────────────────────────────────
  float tc, td, glitch, live, groove;
  euChannels(tc, td, glitch, live, groove);
  float rel = u_impact;

  vec2 uv = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;
  vec2 p  = uv * G_SCALE + G_SEED;

  // ── 2. RELOJ DEL FLUIDO — evolución sedosa sobre u_time (obedece SPEED)
  // Ley de Integración: `live` y `tc` NO multiplican el reloj (saltaría la
  // fase cuando cambian); se SUMAN a la fase → aceleración real durante la
  // subida, sin saltos. `live` respira la amplitud del warp.
  float flow = u_time * G_FLOW * (1.0 - 0.5 * u_viscosity) + 0.02 * u_beatTime;
  float t    = flow + 1.2 * tc + 0.6 * td;
  float turb = G_WARP * (0.55 + 0.45 * live) * (1.0 + 0.9 * tc + 0.3 * u_bass);

  // ── 3. DOMAIN WARPING DOBLE (IQ) — plasma sin bordes ──────────────
  vec2 q = vec2(fbm(vec3(p, t)),
                fbm(vec3(p + vec2(5.2, 1.3), t * 1.1)));
  vec2 r = vec2(fbm(vec3(p + turb * q + vec2(1.7, 9.2), t * 1.3)),
                fbm(vec3(p + turb * q + vec2(8.3, 2.8), t * 0.9)));
  float f = fbm(vec3(p + turb * r, t * 0.7));
  f = 0.5 + 0.5 * f;                                          // → ~[0,1]

  // ── 4. COLOR — capas de gas teñidas por la tonalidad de la pista ───
  float hue = G_HUE + 0.35 * u_chromaHue;
  vec3 deep  = palette(hue,        vec3(0.20), vec3(0.20), vec3(1.0), vec3(0.00, 0.15, 0.30));
  vec3 gas   = palette(hue + 0.18, vec3(0.50), vec3(0.50), vec3(1.0), vec3(0.00, 0.33, 0.67));
  vec3 plasm = palette(hue + 0.45, vec3(0.55), vec3(0.45), vec3(1.0), vec3(0.10, 0.20, 0.30));
  vec3 col = deep * 0.15;
  col = mix(col, gas * gas,   smoothstep(0.25, 0.85, f));
  col = mix(col, plasm,       smoothstep(0.0, 1.4, length(q)) * 0.6);
  col += gas * smoothstep(0.55, 1.0, r.x) * 0.6;              // filamentos luminosos
  col *= f * f * 1.6;                                         // densidad → luz

  // Brillo del núcleo: el sub-bass lo hace respirar, suave y difuso.
  col += plasm * 0.12 * (0.3 + u_subBass) * exp(-2.2 * length(uv)) * live;

  // ── 5. TRANSITORIOS — ondas suaves, sin bordes duros ──────────────
  // Kick: onda de presión que ilumina las zonas densas (bloom del gas).
  float ring = exp(-abs(length(uv) - (0.15 + 0.9 * (1.0 - u_kickPulse))) * 5.0);
  col += gas * u_kickPulse * ring * f * 0.9;
  // Impact: marea de luz complementaria desde el centro.
  col += rel * 0.7 * palette(hue + 0.5, vec3(0.5), vec3(0.5), vec3(1.0),
                             vec3(0.0, 0.33, 0.67)) * exp(-1.8 * length(uv)) * f;
  // Hi-hat / aire: polvo estelar suave (gaussiano, no píxel duro).
  vec2 cell = floor(uv * 60.0);
  float star = step(0.985, hash21(cell + G_SEED));
  vec2 sp = fract(uv * 60.0) - 0.5;
  col += star * exp(-dot(sp, sp) * 40.0) * (0.15 + 1.5 * u_hihatEnergy + 0.5 * u_ultraAir)
       * vec3(0.9, 0.95, 1.0);

  // ── 6. TENSIÓN + EXPOSICIÓN LINEAL ─────────────────────────────────
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum) * vec3(0.95, 1.0, 1.1), 0.4 * tc); // la subida blanquea
  if (RHYTHMIC_VOID) col *= 0.5;
  col *= (1.0 + 0.5 * u_energy) * (0.45 + 0.55 * live);
  col *= 1.0 - 0.25 * dot(uv, uv);

  // ── 7. MEMORIA — estela líquida con deriva centrífuga ─────────────
  if (u_hasPrev > 0.5) {
    vec2 st = fragCoord / u_resolution.xy - 0.5;
    st *= 0.996;
    st += 0.0015 * vec2(noise3(vec3(st * 4.0, t)), noise3(vec3(st * 4.0 + 3.1, t)));
    vec3 prev = texture(u_prevFrame, st + 0.5).rgb;
    prev *= prev;                                             // sRGB → lineal (aprox. γ2)
    float persist = clamp(0.80 + 0.12 * u_trails, 0.0, 0.94);
    col = max(col, prev * persist);
  }
  c = vec4(col, 1.0);
}
```