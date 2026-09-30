// @euclid name    "MG Latino Fluid"
// @euclid author  "LuxSync · Pack Latino"
// @euclid family  ether+fluid
// @euclid genome  aggression=0.50 chaos=0.30 organicity=0.90
// @euclid zone    gentle..peak
// @euclid vibes   fiesta-latina, reggaeton, cumbia, warm-groove
// @euclid tex0    logo-mg
// @euclid param   u_liquid float -1.0 1.0 0.0 "Liquid"
// @euclid param   u_aura   float -1.0 1.0 0.0 "Aura"
// @euclid gene    G_FREQ    expr float 0.6 1.8 1.0 c:+0.3 o:+0.2
// @euclid gene    G_ELASTIC expr float 0.4 2.0 1.0 a:+0.5
// @euclid gene    G_WARM    expr float 0.0 1.0 0.5 o:+0.3
// Theia 2.0 · contract v2 — migrated by scripts/migrate_atoms_v2.js (WAVE 8279)

uniform float u_liquid;   // Regla del Cero Neutro: 0 = diseño canónico
uniform float u_aura;

#ifndef G_FREQ
#define G_FREQ 1.0
#endif
#ifndef G_ELASTIC
#define G_ELASTIC 1.0
#endif
#ifndef G_WARM
#define G_WARM 0.5
#endif

#define PI         3.14159265359
#define TAU        6.28318530718
#define LOGO_SCALE 0.80          // alto del cuadro del logo / alto de pantalla

const vec3 LUMA        = vec3(0.2126, 0.7152, 0.0722);
// Paleta cálida — valores en espacio LINEAL (el epílogo posee sRGB).
const vec3 C_MAGENTA   = vec3(0.30, 0.000, 0.160);   // magenta profundo
const vec3 C_HOTMAG    = vec3(0.80, 0.020, 0.320);   // magenta encendido (halo lejano)
const vec3 C_ORANGE    = vec3(1.00, 0.160, 0.004);
const vec3 C_GOLD      = vec3(1.00, 0.520, 0.020);
const vec3 C_GOLDPURE  = vec3(1.00, 0.620, 0.015);   // fogonazo: dorado saturado, sin blanco

// Vacío rítmico v2: rampa suave sobre u_rhythmicVoid + rebote (u_voidRelease).
float euVoidAmt() { return smoothstep(0.6, 0.9, u_rhythmicVoid); }
float euVoidGate(float k) { return mix(1.0, k, euVoidAmt()) * (1.0 + 0.6 * u_voidRelease); }

// Tap del logo (u_tex0: RGBA8 premultiplicada, color sRGB codificado).
//  · bias = LOD extra → blur casi gratis por mipmap (glow / rim / sombra).
//  · bias < 0.5 → máscara dura al cuadro del logo (cero manchas por clamp);
//    bias ≥ 0.5 → el halo se desvanece suave FUERA del cuadro (sin cantos).
//  · sin textura (u_hasTex0 = 0: cargando o fallo) cae a un disco cálido
//    procedural — el átomo nunca se queda en negro.
vec4 logoTap(vec2 tuv, float bias) {
  vec4 t = texture(u_tex0, tuv, bias);
  float outside = length(max(abs(tuv - 0.5) - 0.5, 0.0));
  float fade = bias < 0.5 ? step(outside, 0.0) : exp(-40.0 * outside * outside);
  t *= fade;
  float s = 0.006 + 0.030 * bias;
  float a = 1.0 - smoothstep(0.30 - s, 0.30 + s, length(tuv - 0.5));
  vec4 proc = vec4(vec3(0.85, 0.36, 0.09) * a, a);
  return mix(proc, t, step(0.5, u_hasTex0));
}

void mainImage(out vec4 c, in vec2 fragCoord) {
  // ── 1. CANALES + RELOJES ───────────────────────────────────────────
  float glitch, live, groove;
  euChannels(glitch, live, groove);
  float fx     = u_activeEffectEnergy;                       // 🔫 clip físico vivo
  float beatP  = 0.5 + 0.5 * cos(6.2831853 * u_beatPhase) * u_speed;
  float swell  = sin(3.1415927 * u_barPhase) * u_speed;
  float gBeats = u_beatTime + u_time * 0.05;                 // ~95% beat, 5% deriva

  vec2  p   = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;
  vec2  luv = p / LOGO_SCALE + 0.5;                          // cuadro del logo 0..1

  // ── 2. RESPUESTA ELÁSTICA — el grave deforma, el kick lo devuelve ──
  // amp = latido base + cuerpo del grave + golpe (u_kickPulse decae en ¼ de
  // beat → el logo vuelve rápido a su forma). kPh avanza mientras el pulso
  // decae: la onda "viaja" y se apaga como el anillo de un reflejo en agua.
  float kick = u_kickPulse;
  float bass = u_bass;
  float amp  = (0.006 + 0.020 * bass + 0.026 * kick * G_ELASTIC)
             * (0.55 + 0.45 * live) * (1.0 + 1.2 * fx) * (1.0 + max(u_liquid, -0.9));
  float kPh  = 7.0 * (1.0 - kick);

  vec2 w;
  w.x = sin(luv.y *  6.5 * G_FREQ + gBeats * 1.5708 + kPh)
      + 0.55 * sin(luv.y * 13.0 * G_FREQ - gBeats * 2.3562 + 1.7 - 0.5 * kPh);
  w.y = sin(luv.x *  5.5 * G_FREQ - gBeats * 1.2566 + 0.9)
      + 0.55 * sin(luv.x * 11.5 * G_FREQ + gBeats * 1.8850 + 0.7 * kPh);
  // Rizo fino de superficie con los medios + desgarro digital (APOCALYPSE).
  vec2 d = amp * w
         + 0.005 * u_mid * vec2(sin(luv.y * 29.0 + gBeats * 5.1),
                                sin(luv.x * 31.0 - gBeats * 4.3));
  d.x += glitch * 0.03 * (hash21(vec2(floor(luv.y * 24.0), floor(gBeats * 4.0))) - 0.5);

  // Squash & stretch: el golpe ensancha y aplasta (volumen ~constante) y el
  // cuerpo respira con el grave/compás — nada de escala rígida.
  float sq = 0.06 * kick * G_ELASTIC;
  float br = 1.0 + 0.035 * bass + 0.020 * swell;
  vec2  cc = luv - 0.5;
  cc.x /= (1.0 + sq) * br;
  cc.y /= (1.0 - 0.7 * sq) * br;
  vec2 duv = cc + 0.5 + d;

  // ── 3. LECTURA DEL LOGO + AURA (todo sobre el UV deformado) ────────
  vec4  logo = logoTap(duv, 0.0);
  float a0   = logo.a;
  // Linealizar el color (premultiplicado en sRGB codificado): γ2, sin pow.
  vec3  s    = logo.rgb / max(a0, 1e-4);
  vec3  lg   = s * s * a0;

  vec2  up  = vec2(0.0, -0.035);                 // muestrear más abajo → el halo SUBE (calor)
  float aG1 = logoTap(duv + up * 0.5, 2.5).a;    // halo cercano (dorado)
  float aG2 = logoTap(duv + up,       4.0).a;    // halo medio (naranja)
  float aG3 = logoTap(duv + up * 1.6, 5.5).a;    // halo lejano (magenta)
  float aB  = logoTap(duv,            1.5).a;    // alfa difuminado → borde
  float aSh = logoTap(duv + vec2(-0.018, 0.028), 3.0).a;   // sombra de contacto (abajo-derecha)

  // ── 4. FONDO — plasma cálido: magenta profundo → naranja → oro ─────
  vec2  q  = p * (1.7 + 0.3 * swell);
  float tp = gBeats * 0.12;
  float n1 = noise3(vec3(q, tp));
  float n2 = noise3(vec3(q * 2.1 + 3.0 * n1 + 4.7, tp * 1.4));
  float f  = 0.5 + 0.5 * sin(TAU * (0.55 * n1 + 0.45 * n2) + gBeats * 0.5236 + 2.0 * bass);
  f = clamp(f + 0.20 * bass + 0.15 * kick, 0.0, 1.0);

  float warm = clamp(G_WARM, 0.0, 1.0);
  vec3 bg = mix(C_MAGENTA, C_ORANGE, smoothstep(0.10, 0.60, f));
  bg      = mix(bg, C_GOLD, smoothstep(0.75 - 0.30 * warm, 1.00 - 0.10 * warm, f));
  bg     += C_ORANGE * fx * 0.35;                              // el disparo calienta el plasma

  float auraGain = 1.0 + max(u_aura, -0.9);
  float expo     = (0.22 + 0.45 * u_energy + 0.55 * bass + 0.45 * kick) * auraGain;
  bg *= (0.25 + 0.90 * exp(-2.2 * dot(p, p))) * expo;

  // Glow: el logo irradia calor sobre el fondo (halo dorado → naranja → magenta).
  vec3  glow     = C_GOLD * (0.70 * aG1) + C_ORANGE * (0.90 * aG2) + C_HOTMAG * (1.10 * aG3);
  float glowGain = (0.55 + 0.95 * bass + 0.60 * kick + 0.35 * u_energy)
                 * (0.5 + 0.5 * live) * auraGain;
  vec3 back = bg + glow * glowGain;
  back *= 1.0 - 0.40 * aSh * (1.0 - a0);                       // sombra de contacto

  // ── 5. GRADING CÁLIDO DEL LOGO ─────────────────────────────────────
  lg *= vec3(1.06, 0.97, 0.86);
  float ll = dot(lg, LUMA);
  lg = mix(vec3(ll), lg, 1.22 + 0.35 * bass);                  // saturación viva
  lg *= 1.0 + 0.12 * beatP + 0.25 * kick;                      // latido propio
  // Destello diagonal (un barrido por 4 compases) que sigue la deformación.
  float sd    = dot(duv - 0.5, vec2(0.7071));
  float sw    = -0.75 + 1.5 * fract(gBeats * 0.0625);
  float sheen = exp(-80.0 * (sd - sw) * (sd - sw));
  lg += vec3(1.0, 0.60, 0.10) * (0.40 * sheen) * a0;

  vec3 col = back * (1.0 - a0) + lg;                           // logo premultiplicado

  // ── 6. FOGONAZO EN BORDES — sin u_impact (prohibido en átomos, 8287) ──
  // Downbeat = arranque de u_barPhase (exp decae en ~⅕ de compás), o cresta
  // real. Cegado por u_blend: durante un X-FADE (u_blend<1) el flash no
  // existe — misma garantía que el ducking de u_impact del HOTFIX 8312.
  float barDown = exp(-7.0 * u_barPhase) * u_speed * groove;
  float xf      = smoothstep(0.97, 1.0, u_blend);
  float hit     = clamp(max(barDown, u_crestPulse), 0.0, 1.0) * xf * live;
  float rim     = clamp(2.5 * abs(a0 - aB), 0.0, 1.0);
  // Empuje hacia el AMARILLO/DORADO puro (cae el azul → nunca vira a blanco).
  col  = mix(col, col * vec3(1.35, 1.0, 0.45), hit * rim);
  col += C_GOLDPURE * (1.15 * hit * rim);
  float lc = dot(col, LUMA);
  col = mix(vec3(lc), col, 1.0 + 0.5 * hit);                   // subida de saturación

  // ── 7. EXPOSICIÓN LINEAL ───────────────────────────────────────────
  col *= euVoidGate(0.6);
  col *= 1.0 - 0.30 * dot(p, p);
  c = vec4(col, 1.0);
}
