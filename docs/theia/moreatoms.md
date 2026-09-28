Los tres átomos nuevos ya están en assets/shaders/, y los 9 del kit quedan registrados en el pack Opus: deberían salir en el deck sin tener que cargarlos a mano. Todo está en el commit e79e3f11.

Comprobaciones:

Los 19 programas (9 átomos en dos modos de genes, más la simulación de Turing) compilan con glslangValidator usando el preámbulo y el epílogo reales del motor.
tsc sin errores y la suite de Theia pasa entera: 195/195, incluido un test nuevo que comprueba cada átomo del kit.
No los he visto en pantalla en la app en marcha. Turing Cannibals depende del buffer de estado float (EXT_color_buffer_float): si la GPU del bolo no lo soporta, se verá solo el fondo oscuro.
Dos cosas que conviene saber
1. El anillo. No hay ninguna capa del motor que lo pinte encima de todo: estaba dentro de cada átomo, porque yo repetía la misma receta. Lo he quitado de los 4 míos que lo tenían y cada uno responde ahora al kick a su manera:

Sacred Bouncer: se encienden las costuras del caleidoscopio, como rayos de estrella.
Liquid Nebula: un relámpago dentro de las nubes más densas.
Morphing Core: el vacío de alrededor respira suave.
Quantum Swarm: toda la red de enlaces dispara a la vez.
Æther Serpent y Tribu Mental (los originales de Opus) siguen teniendo su anillo, porque forma parte de su diseño. Si también te cansa, se puede cambiar.

2. Un fallo que arrastraba desde la plantilla. Neon Conduit, Voxel Monolith y Liquid Nebula declaraban zonas calm/rising, que no existen para el registry. La escala válida es silence < valley < ambient < gentle < active < intense < peak. El registry los habría rechazado sin avisar y Selene no podría elegirlos nunca. Ya está corregido en los tres y en SHADER_ATOM_BASE.md. Si el otro LLM generó átomos con esa plantilla, revisa sus líneas @euclid zone.

Un vocabulario distinto para cada evento
	Kick	Tensión (tc)	Drop (u_impact)
Ferro Heart	los picos saltan y sus puntas se encienden desde dentro	el imán baja y levanta una torre central	el campo se invierte: los picos se vuelven cráteres que sueltan luz blanca
Event Horizon	salen chorros por los polos y el disco se calienta hacia el azul	la cámara cae hacia el horizonte	aumenta la masa y el cielo entero se dobla
Turing Cannibals	caen colonias nuevas y las membranas se hinchan	inanición: las células mueren y el color se apaga	esporas por todas partes y todos los núcleos se iluminan
Átomo 7 — ferro_heart.glsl
Matemática: la inestabilidad de Rosensweig. Un ferrofluido bajo un campo magnético forma picos colocados en red hexagonal, que se modela sumando 3 ondas coseno a 120°: cos(k·q·e₁)+cos(k·q·e₂)+cos(k·q·e₃). Ese valor se normaliza y se eleva a una potencia (el gen G_SHARP) para afilar las puntas. El resultado es un campo de alturas: se hace raymarch con pasos cortos, porque los picos son muy empinados, y se refina el choque con 5 pasadas de bisección. La normal sale de diferencias finitas sobre la altura. El material es un espejo negro (fresnel de Schlick), así que se ve gracias a lo que refleja: un estudio de softboxes rectangulares.

Bajo: controla la altura de los picos.
Snare: da un latigazo lateral al campo.
Hi-hat: micro-rizado de la superficie.
Glitch: convierte las alturas en terrazas digitales.
// @euclid name    "Ferro Heart"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  fluid+field
// @euclid genome  aggression=0.70 chaos=0.40 organicity=0.80
// @euclid zone    gentle..peak
// @euclid param   u_field float -1.0 1.0 0.0 "Field"
// @euclid param   u_gloss float -1.0 1.0 0.0 "Gloss"
// @euclid gene    G_SHARP   struct int   2    6     4    a:+0.5 o:-0.3
// @euclid gene    G_LATTICE expr   float 3.0  9.0   5.5  c:+0.4 a:+0.2
// @euclid gene    G_MOUND   expr   float 0.3  1.2   0.7  o:+0.4
// @euclid gene    G_ORBIT   expr   float 0.1  1.0   0.35 a:+0.3
// @euclid gene    G_HUE     expr   float 0.0  1.0   0.58 c:+0.3
// @euclid gene    G_SEED    expr   float 0.0  100.0 0.0
// @euclid steps   110
 
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
  float tc, td, glitch, live, groove;
  euChannels(tc, td, glitch, live, groove);
  gBeats  = u_beatTime + u_time * 0.05;
  gGlitch = glitch;
  float rel = u_impact;
 
  // Masa magnética — el BAJO es el campo: altura de los picos.
  gH = (0.12 + 0.55 * u_subBass + 0.35 * u_bass) * live * (1.0 + 0.4 * u_field)
     + 0.45 * u_kickPulse;                                         // bombo = picos que saltan
  gK     = G_LATTICE + 2.0 * tc;                                   // tensión: red más fina
  gEnvK  = 0.12 + 0.5 * tc;                                        // tensión: se agolpa al centro
  gTower = 1.6 * tc;                                               // el imán baja → torre central
  gFlip  = 1.0 - 2.0 * smoothstep(0.35, 0.9, rel);                 // DROP: inversión de campo
  gRot   = gBeats * TAU / 96.0;
  float ta = hash21(vec2(floor(u_beatTime * 2.0), G_SEED)) * TAU;
  gTilt  = vec2(cos(ta), sin(ta)) * 0.35 * u_snarePulse;           // snare: latigazo del campo
 
  vec2 uv = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;
 
  // ── 2. CÁMARA — órbita lenta alrededor del corazón (obedece SPEED) ──
  float az = gBeats * G_ORBIT * TAU / 32.0;
  float camR = 6.2 - 1.2 * tc;
  vec3 ro = vec3(camR * cos(az), 3.0 - 0.8 * tc + 0.25 * sin(u_time * 0.13), camR * sin(az));
  vec3 ta3 = vec3(0.0, 0.55 + 0.4 * tc, 0.0);
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
    // DROP: los cráteres invertidos exhalan luz blanca del fondo del pozo.
    col += vec3(1.2, 1.1, 1.0) * rel * smoothstep(0.2, 0.9, s) * (1.0 - gFlip) * 0.8;
 
    col = mix(col, envMap(rd) * 0.35, 1.0 - exp(-t * 0.03));
  }
 
  // ── 5. TENSIÓN + EXPOSICIÓN LINEAL ─────────────────────────────────
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum) * vec3(0.95, 1.0, 1.1), 0.5 * tc);
  if (glitch > 0.01) col = mix(col, col.gbr, 0.5 * glitch * step(0.6, hash21(vec2(floor(fragCoord.y / 4.0), floor(gBeats * 8.0)))));
  if (RHYTHMIC_VOID) col *= 0.4;
  col *= 1.0 + 0.5 * u_energy;
  col *= 1.0 - 0.3 * dot(uv, uv);
  c = vec4(col, 1.0);
}
Átomo 8 — event_horizon.glsl
Matemática: trazado de fotones alrededor de un agujero negro de Schwarzschild, con la aproximación newtoniana de la geodésica: a = −1.5·M·h²·p/r⁵, donde h = |p×v| se conserva a lo largo del rayo. Con eso salen de forma natural la esfera de fotones (r = 1.5M), el anillo de Einstein (es física, no un efecto de kick) y la imagen del disco doblada por encima y por debajo del agujero.

Disco: densidad en brazos de espiral logarítmica. Gira como un sistema kepleriano (ω ∝ r^-1.5) usando un flow-map de dos fases, para que la textura no se enrolle hasta convertirse en rayas.
Luz del disco: temperatura T ∝ r^-¾ convertida en color de cuerpo negro, y beaming Doppler g³ que hace brillar más el lado que se acerca.
Fondo: estrellas y chorros polares, doblados también por la gravedad.
Snare: una fulguración de reconexión magnética en un punto del disco.
// @euclid name    "Event Horizon"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  void+lens
// @euclid genome  aggression=0.50 chaos=0.55 organicity=0.35
// @euclid zone    ambient..peak
// @euclid param   u_mass float -1.0 1.0 0.0 "Mass"
// @euclid param   u_disk float -1.0 1.0 0.0 "Disk"
// @euclid gene    G_STARS struct int   1    3     2    c:+0.3
// @euclid gene    G_TILT  expr   float 0.05 0.6   0.18 o:+0.2
// @euclid gene    G_RIN   expr   float 2.0  3.5   2.6  a:+0.2
// @euclid gene    G_ROUT  expr   float 5.0  12.0  8.0  o:+0.3
// @euclid gene    G_SWIRL expr   float 1.0  6.0   3.0  c:+0.6
// @euclid gene    G_HUE   expr   float 0.0  1.0   0.08 c:+0.3
// @euclid gene    G_SEED  expr   float 0.0  100.0 0.0
// @euclid steps   120
 
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
  float tc, td, glitch, live, groove;
  euChannels(tc, td, glitch, live, groove);
  gBeats = u_beatTime + u_time * 0.05;
  float rel = u_impact;
 
  // Masa: el DROP es una oleada gravitatoria — el cielo entero se dobla.
  float M = clamp((1.0 + 0.25 * u_mass) * (1.0 + 0.55 * rel) + 0.25 * tc, 0.6, 1.75);
 
  vec2 fc = fragCoord;
  if (glitch > 0.01) {                                             // desgarro del espacio-tiempo
    float h = hash21(vec2(floor(fc.y / 8.0), floor(gBeats * 8.0)));
    fc.x += step(1.0 - 0.35 * glitch, h) * (h - 0.5) * u_resolution.x * 0.1 * glitch;
  }
  vec2 uv = (fc - 0.5 * u_resolution.xy) / u_resolution.y;
 
  // ── 2. CÁMARA — órbita; la TENSIÓN nos hace caer hacia el horizonte ─
  float az   = gBeats * TAU / 128.0;
  float incl = G_TILT + 0.08 * sin(u_time * 0.05);
  float D    = 15.0 - 6.0 * tc;
  vec3 ro = D * vec3(cos(incl) * cos(az), sin(incl), cos(incl) * sin(az));
  vec3 ww = normalize(-ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + (1.5 + 0.4 * tc) * ww);
 
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
        emit += vec3(0.8, 0.9, 1.2) * u_snarePulse * 5.0 * exp(-length(x.xz - flareP) * 2.5);
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
  col = mix(col, vec3(lum) * vec3(0.9, 1.0, 1.15), 0.4 * tc);
  if (glitch > 0.01) col = mix(col, col.brg, 0.5 * glitch * step(0.6, hash21(vec2(floor(fc.y / 4.0), floor(gBeats * 4.0)))));
  if (RHYTHMIC_VOID) col *= 0.4;
  col *= 1.0 + 0.5 * u_energy;
  col *= 1.0 - 0.25 * dot(uv, uv);
  c = vec4(col, 1.0);
}
Átomo 9 — turing_cannibals.glsl
Matemática: reacción-difusión de Gray-Scott, calculada de verdad frame a frame en el buffer de estado RGBA16F del motor (la "Materia Viva" de G5). Es el primer átomo que usa mainState.

Ecuaciones: U' = ∇²U − UV² + F(1−U) y V' = ½∇²V + UV² − (F+k)V, con el régimen "mitosis" (F=0.0367, k=0.0649): las células se dividen y se comen unas a otras.
Tamaño de célula: el laplaciano combina el kernel de Karl Sims a zancada 1 con otro a zancada R, donde R depende de la resolución. Así las células miden lo mismo en el preview y en el HDMI, y la mezcla sigue siendo estable.
La música cambia la química: la energía sube la alimentación, la tensión sube la mortalidad y el bajo la baja (las células se estiran en gusanos). El snare pasa una "guadaña" que mata células a lo largo de una franja.
Visual: el campo V se trata como relieve húmedo, con normales por gradiente y una luz que orbita al compás.
Límites: la simulación avanza un paso por frame y no obedece al SPEED, mientras que la luz y el visual sí. El preview y el HDMI corren simulaciones independientes, así que el patrón exacto no será idéntico en las dos pantallas.
// @euclid name    "Turing Cannibals"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  cellular+bio
// @euclid genome  aggression=0.55 chaos=0.70 organicity=1.00
// @euclid zone    gentle..peak
// @euclid param   u_hunger float -1.0 1.0 0.0 "Hunger"
// @euclid param   u_relief float -1.0 1.0 0.0 "Relief"
// @euclid gene    G_SEEDS struct int   2    6     3      a:+0.5
// @euclid gene    G_FEED  expr   float 0.030 0.045 0.0367 c:+0.4 o:+0.3
// @euclid gene    G_KILL  expr   float 0.060 0.066 0.0649 a:+0.3
// @euclid gene    G_HUE   expr   float 0.0  1.0   0.30   c:+0.3
// @euclid gene    G_SEED  expr   float 0.0  100.0 0.0
 
uniform float u_hunger;   // Regla del Cero Neutro: 0 = diseño canónico
uniform float u_relief;
 
#ifndef G_SEEDS
#define G_SEEDS 3.0
#endif
#ifndef G_FEED
#define G_FEED 0.0367
#endif
#ifndef G_KILL
#define G_KILL 0.0649
#endif
#ifndef G_HUE
#define G_HUE 0.30
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif
 
#define PI        3.14159265359
#define TAU       6.28318530718
#define SEEDS_MAX 6
 
// ── Utilidades compartidas por la simulación y el visual ───────────────
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
 
// Zancada del laplaciano ∝ resolución → el tamaño de las células es el
// MISMO en el preview (720p) y en la salida HDMI (1080p).
int strideR() {
  return int(clamp(floor(u_resolution.y / 360.0 + 0.5), 1.0, 3.0));
}
 
vec4 fetchS(ivec2 p) {
  ivec2 sz = ivec2(u_resolution.xy);
  return texelFetch(u_state, clamp(p, ivec2(0), sz - 1), 0);
}
 
// Laplaciano 3×3 de Karl Sims (0.2 aristas · 0.05 diagonales · −1 centro)
// a una zancada R dada.
vec2 lap3(ivec2 p, int R, vec2 c) {
  vec2 a = fetchS(p + ivec2(R, 0)).rg + fetchS(p - ivec2(R, 0)).rg
         + fetchS(p + ivec2(0, R)).rg + fetchS(p - ivec2(0, R)).rg;
  vec2 d = fetchS(p + ivec2(R, R)).rg + fetchS(p + ivec2(-R, R)).rg
         + fetchS(p + ivec2(R, -R)).rg + fetchS(p + ivec2(-R, -R)).rg;
  return 0.2 * a + 0.05 * d - c;
}
 
// Guadaña del snare: franja con ángulo nuevo en cada golpe.
float snareStripe(vec2 cuv) {
  float a = hash21(vec2(floor(u_beatTime * 2.0), G_SEED + 3.0)) * PI;
  return exp(-abs(dot(cuv, vec2(cos(a), sin(a)))) * 22.0);
}
 
// ═══ SIMULACIÓN — Gray-Scott sobre el ping-pong RGBA16F ═════════════════
//   r = U (sustrato)  g = V (células)  b = frente de alimentación (glow)
void mainState(out vec4 s, in vec2 fragCoord) {
  ivec2 ip = ivec2(fragCoord);
  int R = strideR();
  vec2 cuv = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;
  float cellPx = 12.0 * float(R);
 
  if (u_stateInit > 0.5) {
    // Siembra: colonias dispersas por toda la placa.
    vec2 g = floor(fragCoord / cellPx);
    vec2 f = fract(fragCoord / cellPx) - 0.5;
    float seed = step(0.86, hash21(g + G_SEED)) * step(length(f), 0.32);
    s = vec4(1.0 - 0.5 * seed, 0.25 * seed, 0.0, 1.0);
    return;
  }
 
  vec4 c0 = fetchS(ip);
  float u = c0.r;
  float v = c0.g;
  // Laplaciano híbrido: zancada 1 (acopla sub-redes) + zancada R (escala).
  vec2 lap = 0.2 * lap3(ip, 1, c0.rg) + 0.85 * lap3(ip, R, c0.rg);
 
  // La MÚSICA gobierna la química:
  //   energía/hambre → alimentación ↑ (crecen, se dividen, devoran)
  //   tensión        → muerte ↑ (inanición antes del drop)
  //   bajo           → muerte ↓ (las células se estiran en gusanos)
  float tc, td, glitch, live, groove;
  euChannels(tc, td, glitch, live, groove);
  float F = G_FEED + 0.006 * u_energy * live + 0.004 * u_hunger - 0.004 * tc;
  float k = G_KILL + 0.0035 * tc - 0.0015 * u_bass + 0.03 * u_snarePulse * snareStripe(cuv);
 
  float uvv = u * v * v;
  float du = 1.0 * lap.x - uvv + F * (1.0 - u);
  float dv = 0.5 * lap.y + uvv - (F + k) * v;
  u = clamp(u + du, 0.0, 1.0);
  v = clamp(v + dv, 0.0, 1.0);
 
  // KICK: nuevas colonias caen en la placa (sorteo por beat).
  if (u_kickPulse > 0.75) {
    for (int i = 0; i < SEEDS_MAX; i++) {
      if (float(i) >= G_SEEDS) break;
      vec2 cp = (hash22(vec2(floor(u_beatTime), float(i) + G_SEED)) - 0.5)
              * vec2(u_resolution.x / u_resolution.y, 1.0) * 0.9;
      if (length(cuv - cp) < 0.03) { u = 0.5; v = 0.25; }
    }
  }
  // DROP: esporas por todas partes — explosión demográfica.
  if (u_impact > 0.7) {
    vec2 g = floor(fragCoord / cellPx);
    vec2 f = fract(fragCoord / cellPx) - 0.5;
    if (hash21(g + floor(u_beatTime) * 7.3) > 0.9 && length(f) < 0.3) { u = 0.5; v = 0.25; }
  }
 
  float glow = max(c0.b * 0.95, clamp(dv * 60.0, 0.0, 1.0));
  s = vec4(u, v, glow, 1.0);
}
 
// ═══ VISUAL — tejido vivo con relieve húmedo ════════════════════════════
void mainImage(out vec4 c, in vec2 fragCoord) {
  float tc, td, glitch, live, groove;
  euChannels(tc, td, glitch, live, groove);
  float beats = u_beatTime + u_time * 0.05;
  float rel = u_impact;
 
  vec2 fc = fragCoord;
  if (glitch > 0.01) {
    float h = hash21(vec2(floor(fc.y / 6.0), floor(beats * 8.0)));
    fc.x += step(1.0 - 0.35 * glitch, h) * (h - 0.5) * u_resolution.x * 0.08 * glitch;
  }
  ivec2 ip = ivec2(fc);
  int R = strideR();
  vec2 cuv = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;
 
  vec4 st = fetchS(ip);
  float v = st.g;
  float grow = st.b;
  float vx = fetchS(ip + ivec2(R, 0)).g - fetchS(ip - ivec2(R, 0)).g;
  float vy = fetchS(ip + ivec2(0, R)).g - fetchS(ip - ivec2(0, R)).g;
 
  // KICK: las membranas se hinchan (el relieve late).
  float relief = (5.0 + 2.5 * u_relief) * (1.0 + 1.6 * u_kickPulse);
  vec3 n = normalize(vec3(-vx * relief, -vy * relief, 1.0));
  // Luz que orbita al compás (movimiento continuo → obedece SPEED).
  vec3 L = normalize(vec3(cos(beats * PI / 8.0), sin(beats * PI / 8.0), 0.9));
  float dif = max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 48.0);
 
  float body = smoothstep(0.08, 0.32, v);
  float membrane = smoothstep(0.05, 0.16, v) - smoothstep(0.2, 0.36, v);
  vec3 tissue = palette(G_HUE + u_chromaHue * 0.5 + v * 0.8, vec3(0.5), vec3(0.5), vec3(1.0),
                        vec3(0.0, 0.1, 0.2));
  tissue *= tissue;
  vec3 medium = palette(G_HUE + 0.5 + u_chromaHue * 0.5, vec3(0.5), vec3(0.5), vec3(1.0),
                        vec3(0.0, 0.33, 0.67));
  medium = medium * medium * (0.02 + 0.03 * u_lqAmbient);
 
  vec3 col = mix(medium, tissue * (0.2 + 0.9 * dif), body);
  col += membrane * tissue * (0.5 + 2.0 * u_kickPulse) * live;
  col += spec * 0.7 * body;
  // Frentes de alimentación: el borde que devora brilla.
  vec3 hunger = palette(u_chromaHue + G_HUE + 0.3, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  col += grow * hunger * (0.4 + 1.8 * u_energy) * live;
  // DROP: bioluminiscencia — todos los núcleos se encienden a la vez.
  vec3 comp = palette(u_chromaHue + G_HUE + 0.5, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  col += rel * 2.2 * smoothstep(0.22, 0.42, v) * comp;
  // SNARE: el filo de la guadaña deja un destello frío al pasar.
  col += u_snarePulse * snareStripe(cuv) * vec3(0.5, 0.7, 1.0) * 0.6;
  // HI-HAT: cilios chispeando en las membranas.
  col += membrane * u_hihatEnergy * step(0.8, hash21(floor(fragCoord * 0.5) + floor(beats * 8.0))) * 1.5;
 
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum) * vec3(0.9, 1.0, 1.1), 0.5 * tc);        // inanición: se apaga el color
  if (glitch > 0.01) col = mix(col, col.brg, 0.5 * glitch);
  if (RHYTHMIC_VOID) col *= 0.45;
  col *= 1.0 + 0.5 * u_energy;
  col *= 1.0 - 0.25 * dot(cuv, cuv);
  c = vec4(col, 1.0);
}
Las vibes de registro usan los ids reales de Selene (techno-club, fiesta-latina, chill-lounge, rave, pop-rock), así que Selene también podrá elegir estos átomos por su cuenta según la vibe y la zona. Que el show salga redondo y que tu jefe flipe.

