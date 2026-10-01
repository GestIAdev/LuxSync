// @euclid name    "Dembow Solar Corona"
// @euclid author  "LuxSync · Pack Latino"
// @euclid family  plasma+conformal
// @euclid genome  aggression=0.80 chaos=0.50 organicity=1.00
// @euclid zone    active..peak
// @euclid vibes   fiesta-latina, reggaeton, fuego, sun, dembow
// @euclid param   u_flare  float -1.0 1.0 0.0 "Flare"
// @euclid param   u_heat   float -1.0 1.0 0.0 "Heat"
// @euclid gene    G_BOIL    expr float 0.1 3.0 1.0 o:+0.4 c:+0.2
// @euclid gene    G_FLAME   expr float 0.1 3.0 1.0 a:+0.5 o:+0.2
// @euclid gene    G_SEED    expr float 0.0 100.0 0.0
// @euclid gene    G_OCT     struct int  3   6   3  o:+0.4
// Theia 2.0 · contract v2 — migrated by scripts/migrate_atoms_v2.js (WAVE 8279)

uniform float u_flare;   // Regla del Cero Neutro: 0 = diseño canónico
uniform float u_heat;

#ifndef G_BOIL
#define G_BOIL 1.0
#endif
#ifndef G_FLAME
#define G_FLAME 1.0
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif
#ifndef G_OCT
#define G_OCT 3
#endif

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const vec3 C_BG = vec3(0.006, 0.002, 0.012);   // espacio: violeta casi negro

float euVoidAmt() { return smoothstep(0.6, 0.9, u_rhythmicVoid); }
float euVoidGate(float k) { return mix(1.0, k, euVoidAmt()) * (1.0 + 0.6 * u_voidRelease); }

// ── Ruido ───────────────────────────────────────────────────────────
// Cresta: 1-|2n-1| convierte el valor-noise en líneas afiladas; al
// cuadrado se estrechan en filamentos.
float ridge(float n) { n = 1.0 - abs(2.0 * n - 1.0); return n * n; }

// Turbulencia multifractal (ridged, Musgrave): cada octava se pondera por
// la cresta anterior → el detalle fino nace SOBRE los filamentos, no en
// los valles. Rotación entre octavas contra el retículo del value-noise.
float ridgeFbm(vec3 q) {
  mat2  R = rot2(0.61);
  float a = 0.5, s = 0.0, nm = 0.0, w = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= int(G_OCT)) break;
    float r = ridge(noise3(q));
    s  += a * r * w;
    nm += a;
    w   = clamp(r * 1.7, 0.0, 1.0);
    q.xy = R * q.xy * 2.07;
    q.z  = q.z * 1.63 + 1.7;
    a *= 0.52;
  }
  return s / nm;
}

// Curva de cuerpo negro estilizada (LINEAL): frío → rojo casi negro,
// medio → naranja, caliente → amarillo, cresta → blanco puro (HDR; ACES
// hace el rolloff). Contraste agresivo: r ∝ x², g ∝ x³, b ∝ x⁵.
vec3 fireRamp(float x) {
  x = clamp(x, 0.0, 1.8);
  float x2 = x * x;
  return vec3(1.30 * x2, 0.95 * x2 * x, 0.80 * x2 * x2 * x);
}

void mainImage(out vec4 c, in vec2 fragCoord) {
  // ── 1. CANALES + RELOJES ───────────────────────────────────────────
  float glitch, live, groove;
  euChannels(glitch, live, groove);
  float fx     = u_activeEffectEnergy;                   // 🔫 trigger DMX físico (§8.1)
  float k      = smoothstep(0.02, 0.50, fx);             // colapso 0..1
  float swell  = sin(3.1415927 * u_barPhase) * u_speed;
  float beatP  = 0.5 + 0.5 * cos(6.2831853 * u_beatPhase) * u_speed;
  float gBeats = u_beatTime + u_time * 0.05;
  float bass   = u_bass, kick = u_kickPulse;

  // 🌱 8406-C — semilla del genoma: vector de desplazamiento del dominio
  // FBM aplicado a las tres capas (superficie/corona/disco) → cada mutante
  // `core#seed` es una estrella topológicamente única.
  vec3 SD = vec3(G_SEED * 43.1, G_SEED * -17.3, G_SEED * 99.2);

  // Ebullición pesada (lava/miel). 🧬 8418-C — Ley 1 de verdad:
  //   t = ∫0.060·G_BOIL·(0.65 + 0.55·mid + 0.25·energy) dt
  // como combinación lineal de integrales host (u_midTime/u_energyTime):
  // las bandas modulan la VELOCIDAD del reloj sin tocar jamás su fase — el
  // kick ya no teletransporta la rotación en proporción al tiempo acumulado.
  // El colapso (k) suma un offset acotado, no un multiplicador.
  float t  = 0.045 * G_BOIL
           * (0.65 * u_time + 0.55 * u_midTime + 0.25 * u_energyTime)
           + k * 7.0;
  float tc = gBeats * 0.070 * G_FLAME;

  // Destello de frase (sin u_impact, 8287): arranque de u_barPhase, cegado
  // por u_blend durante el X-FADE (paridad HOTFIX 8312).
  float barDown = exp(-7.0 * u_barPhase) * u_speed * groove;
  float xf      = smoothstep(0.97, 1.0, u_blend);
  float hit     = clamp(max(barDown, u_crestPulse), 0.0, 1.0) * xf * live;

  vec2 p = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;

  // ── 2. SQUASH & STRETCH DEL GRAVE (lo que ya funcionaba) ───────────
  float sq = 0.05 * bass + 0.035 * kick;
  vec2  sp = vec2(p.x / (1.0 + sq), p.y / (1.0 - 0.7 * sq));
  float R  = 0.320 * (1.0 + 0.030 * swell + 0.085 * bass);
  float r  = length(sp);
  vec2  dir = sp / max(r, 1e-4);

  // ── 2.5 EARLY CULL — fuera del alcance no hay fuego que calcular ───
  // reach base sin la máscara prom (su máximo es x3.2); 3×reach ≈ alpha 5%
  // (cola invisible). +8% de margen por el squash. Solo con cataclismo el
  // disco llega a los bordes — ahí NO se culea.
  float reachMax = (0.055 + 0.10 * bass + 0.06 * kick) * G_FLAME
                 * (1.0 + max(u_flare, -0.9)) * 3.2;
  float cutR     = (R + reachMax * 3.0 + 0.10) * 1.10;
  vec3  col      = C_BG;

  if (r < cutR) {

  // ── 3. FOTOSFERA — esfera 3D con granulación ───────────────────────
  // Normal de una esfera real → el ruido se curva con la superficie y la
  // rotación lenta la hace girar como un cuerpo, no como un plano.
  float rr   = r / R;
  float z    = sqrt(max(1.0 - rr * rr, 0.0));
  vec3  nrm  = vec3(sp / R, z);
  nrm.xz     = rot2(mod(t * 0.35, 6.2831853)) * nrm.xz;
  float gran = ridgeFbm(nrm * 7.5 + vec3(0.0, 0.0, t) + SD);         // celdas + filamentos
  float fine = noise3(nrm * 34.0 + vec3(t * 2.0) + SD);              // granito fino
  float spot = smoothstep(0.62, 0.80, noise3(nrm * 2.2 + vec3(9.0, 3.0, t * 0.4) + SD));  // manchas
  float limb = 0.30 + 0.70 * sqrt(z);                                // oscurecimiento al limbo
  // Idle = lava densa: pow(gran,1.5) hunde los valles térmicos a casi negro
  // y deja solo las crestas en naranja. Sin música el techo es ~0.55 (naranja).
  float lava  = pow(gran, 1.5);
  float heatS = (0.30 + 0.65 * lava + 0.10 * fine) * limb * (1.0 - 0.65 * spot);
  // Dembow pulse: la emisión multiplica por la percusión. El bombo lleva la
  // superficie a blanco/oro; el grave sostenido pesa 0.65 para que un bajo
  // continuo no deje el sol permanentemente quemado.
  float pulse = max(kick, 0.65 * bass);
  heatS *= (0.6 + 1.8 * pulse) * (1.0 - 0.9 * k);                    // el núcleo colapsa

  // Espículas del borde: crestas finas que rompen la silueta (nada de gelatina).
  float spic = ridgeFbm(vec3(dir * 9.0, t * 1.4 + 20.0) + SD);
  float d    = r - R - 0.022 * spic;
  float body = smoothstep(0.006, -0.006, d);

  // ── 4. CORONA — turbulencia polar eyectada ─────────────────────────
  // Coordenadas polares sin costura: dirección (xy) + altura h. La fase
  // radial (h·k − tc) VIAJA hacia fuera: el fuego sale despedido.
  float h  = max(r - R, 0.0);
  vec2  wq = dir + 0.45 * vec2(noise3(vec3(dir * 2.3, h * 3.0 - tc) + SD) - 0.5,
                               noise3(vec3(dir * 2.3 + 7.1, h * 3.0 - tc) + SD) - 0.5);
  float fil = ridgeFbm(vec3(wq * 3.4, h * 6.0 - tc * 1.6) + SD);

  // Protuberancias gigantes: una máscara lenta alarga el alcance en
  // sectores concretos (las llamaradas grandes no son uniformes).
  float prom  = smoothstep(0.50, 0.82, noise3(vec3(dir * 1.4, t * 0.5 + 40.0) + SD));
  float reach = reachMax / 3.2 * (1.0 + 2.2 * prom);
  float alpha = exp(-h / max(reach, 0.01));                          // desvanecido radial
  float heatC = fil * fil * 1.5 * alpha * (0.7 + 0.8 * pulse)
              + 0.45 * exp(-h * 45.0)                                // cromosfera pegada al limbo
              + hit * 0.55 * fil * alpha;                            // downbeat → blanco
  heatC *= 1.0 - k;

  // ── 5. COMPOSICIÓN DEL SOL (col ya arranca en C_BG) ────────────────
  col += fireRamp(heatC) * (1.0 - body);
  col  = mix(col, fireRamp(heatS), body);

  } // ── early cull: del corte en adelante solo existe el cataclismo ──

  // ── 6. COLAPSO: agujero negro de acreción ──────────────────────────
  // (fuera del cull — el disco barre los bordes de la pantalla)
  if (k > 0.01) {
    float Rh = R * 0.85;                                    // horizonte
    // Disco inclinado (elipse) con rotación diferencial kepleriana: la
    // parte interna gira mucho más rápido → cizalla violenta del plasma.
    vec2  dq  = vec2(sp.x, sp.y * 3.2);
    float dr  = length(dq);
    // mod sobre el numerador con periodo TAU·d ≡ mod(ángulo, TAU) — idéntico
    // en matemática exacta pero con intermedios acotados (f32 seguro).
    float ang = mod(gBeats * 0.72, 6.2831853 * (dr + 0.06)) / (dr + 0.06);
    vec2  rq  = rot2(ang) * dq;
    // Motion blur matemático: el FBM varía LENTO sobre el plano rotado
    // (rq·2.2 → arcos largos a lo largo del giro) y RÁPIDO con el radio
    // (dr·18 → vetas finas). Un segundo tap retrasado en el giro promedia la
    // estela: gas girando a velocidad relativista, no partículas sueltas.
    float dN  = ridgeFbm(vec3(rq * 2.2, dr * 18.0 - t * 3.0 + 60.0) + SD);
    dN = 0.5 * (dN + ridgeFbm(vec3(rot2(-0.22) * rq * 2.2, dr * 18.0 - t * 3.0 + 60.0) + SD));
    // Caída suave (3.0) + arranque más externo: el disco barre hasta los
    // bordes de la pantalla — cataclismo cegador, no solo geométrico.
    float band = smoothstep(Rh * 0.80, Rh * 1.20, dr) * exp(-(dr - Rh) * 3.0);
    float dop  = 1.0 - 0.55 * dq.x / max(dr, 1e-3);         // lado que se acerca brilla más

    // Paleta cálida ultra-energética: violeta profundo → magenta → oro.
    // Temperatura = densidad del gas, más caliente cerca del horizonte.
    float temp = clamp(dN * (1.25 - 0.9 * (dr - Rh)), 0.0, 1.0);
    vec3  dcol = mix(vec3(0.10, 0.00, 0.22), vec3(1.00, 0.04, 0.42), smoothstep(0.05, 0.50, temp));
    dcol       = mix(dcol, vec3(1.40, 0.82, 0.22), smoothstep(0.45, 0.95, temp));
    vec3  disk = dcol * band * (0.35 + 1.9 * dN) * dop * 3.4;

    // Horizonte difuso: el vacío se come la luz en gradiente, y un
    // magenta/rojo muy oscuro sangra hacia dentro (nada de disco recortado).
    float hole  = smoothstep(Rh * 1.12, Rh * 0.55, r);
    vec3  bleed = vec3(0.20, 0.008, 0.07) * exp(-max(Rh - r, 0.0) / (0.35 * Rh));
    // Z-index suave: la mitad frontal del disco (Y inclinada < 0) cubre el
    // hueco con un fundido, no con una línea horizontal.
    float front = smoothstep(0.14, -0.14, dq.y);
    float photon = exp(-abs(r - Rh * 1.04) * 90.0);         // anillo de fotones
    float lensed = exp(-abs(r - Rh * 1.22) * 30.0) * (0.4 + 0.8 * ridgeFbm(vec3(dir * 5.0, t * 2.0) + SD));

    vec3 bh = mix(C_BG, bleed, hole)
            + disk * mix(1.0 - hole, 1.0, front)
            + (vec3(1.30, 0.80, 0.40) * photon * 2.0
             + vec3(1.00, 0.20, 0.55) * lensed * 0.9) * (1.0 - hole);
    col = mix(col, bh, k);
  }

  col = mix(col, col.brg * 1.25, clamp(glitch, 0.0, 1.0) * 0.30);   // APOCALYPSE

  // ── 7. EXPOSICIÓN LINEAL ───────────────────────────────────────────
  col *= 1.0 + 0.10 * beatP + 0.20 * u_energy;
  col *= 1.0 + max(u_heat, -0.9) * 0.35;
  col *= euVoidGate(0.55);
  col *= 1.0 - 0.15 * dot(p, p);
  c = vec4(col, 1.0);
}
