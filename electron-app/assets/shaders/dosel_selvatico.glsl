// @euclid name    "Dosel Selvatico"
// @euclid author  "GeminiPunk Architect"
// @euclid family  ether
// @euclid genome  aggression=0.30 chaos=0.60 organicity=1.00
// @euclid zone    gentle..peak
// @euclid vibes   fiesta-latina, cumbia, selva, tropical
// @euclid param   u_wind float -1.0 1.0 0.0 "Wind"
// @euclid gene    G_LAYERS struct int  2   5   4    o:+0.4
// @euclid gene    G_DENSITY expr float 0.5 3.0 1.5  c:+0.2
// @euclid gene    G_FLORA   expr float 0.0 1.0 0.1  o:+0.3
// @euclid gene    G_SEED    expr float 0.0 100.0 0.0
// @euclid steps   64
// Theia 2.0 · contract v2 — migrated by scripts/migrate_atoms_v2.js (WAVE 8279)

uniform float u_wind;

#ifndef G_LAYERS
#define G_LAYERS 4
#endif
#ifndef G_DENSITY
#define G_DENSITY 1.5
#endif
#ifndef G_FLORA
#define G_FLORA 0.1
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif

#define TAU 6.28318530718

// ── Capa reactiva v2 (faltaba en la plantilla de Gemini) ──
// Vacío rítmico con rampa suave — el flag binario cortaba el frame entero.
float euVoidAmt() { return smoothstep(0.6, 0.9, u_rhythmicVoid); }
float euVoidGate(float k) { return mix(1.0, k, euVoidAmt()) * (1.0 + 0.6 * u_voidRelease); }

// Voronoi compacto para generar la canopia de hojas
vec3 voroLeaves(vec2 p, vec2 sd) {
    vec2 n = floor(p); 
    vec2 f = fract(p);
    float md = 8.0; 
    vec2 id = vec2(0.0);
    
    for(int j=-1; j<=1; j++)
    for(int i=-1; i<=1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = vec2(hash21(n + g + sd.xy), hash21(n + g + sd.xy + 13.7));
        
        // args mod(TAU): equivalencia exacta, intermedios f32 acotados
        float sway = sin(mod(u_time * 0.5, TAU) + TAU * o.x);

        // El viento modula la AMPLITUD del balanceo, no el tiempo
        o = 0.5 + 0.4 * vec2(sway, cos(mod(u_time * 0.4, TAU) + TAU * o.y)) * (1.0 + abs(u_wind) * 1.5);
        
        vec2 r = g + o - f;
        float d = dot(r, r);
        if(d < md) { 
            md = d; 
            id = n + g; 
        }
    }
    return vec3(sqrt(md), id);
}

void mainImage(out vec4 c, in vec2 fragCoord) {
    // 1. Canales derivados[cite: 20]
    float glitch, live, groove;
    euChannels(glitch, live, groove);
    
    float beats = u_beatTime + u_time * 0.05; 
    float fx = u_activeEffectEnergy;          

    vec2 uv = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;

    // 2. Visión de Ayahuasca (Cataclismo DMX)[cite: 20]
    float warpR = length(uv);
    float warpA = atan(uv.y, uv.x);
    warpA += fx * sin(warpR * 12.0 - mod(beats * 3.0, TAU)) * 0.6;
    uv = warpR * vec2(cos(warpA), sin(warpA));
    uv *= 1.0 - fx * 0.4;

    // 3. Semilla Matemática[cite: 20]
    vec3 sd = vec3(G_SEED * 41.2, G_SEED * -19.3, G_SEED * 88.4);

    vec3 col = vec3(0.01, 0.03, 0.02); // Fondo selvático oscuro

    // 4. Capas de Canopia (Paralaje)
    float layers = float(G_LAYERS);
    for(float i = 0.0; i < 5.0; i++) { 
        if (i >= layers) break;

        float z = fract(mod(beats * 0.06 * G_DENSITY, 1024.0) - i / layers);
        float scale = mix(12.0, 0.3, z);
        float fade = smoothstep(0.0, 0.1, z) * smoothstep(1.0, 0.7, z);

        vec2 p = uv * scale;
        
        // El viento distorsiona la forma, no multiplica el tiempo
        p.x += sin(mod(beats * 0.4, TAU) + p.y * 2.0) * (0.4 + u_wind * 1.5);
        p.y += u_wind * 0.5 * sin(mod(beats * 0.3, TAU) + p.x * 1.5);

        vec3 v = voroLeaves(p, sd.xy + i * 17.3);
        float d = v.x;
        vec2 id = v.yz;

        float hueOffset = hash21(id);
        
        // Biodiversidad: Diferentes tipos de hojas usando el hash
        float patType = fract(hueOffset * 13.7);
        float noiseVal = noise3(vec3(p * 1.5, mod(beats * 0.2, 512.0))) * 1.5;
        
        float veins1 = abs(sin((d * 25.0) + noiseVal));              // Concéntricas (Palmeras)
        float veins2 = abs(sin((p.x - p.y) * 15.0 + noiseVal));      // Rayas Diagonales (Plataneras)
        float veins3 = abs(sin((p.x + p.y) * 15.0 + noiseVal));      // Rayas Opuestas
        
        float veins = mix(veins1, veins2, step(0.33, patType));
        veins = mix(veins, veins3, step(0.66, patType));

        float leafMask = smoothstep(0.45, 0.25, d);
        leafMask *= (0.5 + 0.5 * smoothstep(0.1, 0.8, veins));
        
        // Puente de color global para las hojas[cite: 20]
        float baseHue = fract(0.3 + hueOffset * 0.15 + u_chromaHue);
        vec3 leafCol = palette(baseHue + fx * 0.3,
                               vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.3, 0.7, 0.2));

        // Flora tropical
        float isFlower = step(0.85, hueOffset);
        float finalHue = fract(G_FLORA + u_chromaHue + fx * 0.6); 
        vec3 floraCol = palette(finalHue + hueOffset * 0.2,
                                vec3(0.6), vec3(0.6), vec3(1.0), vec3(0.8, 0.0, 0.2));
        
        // Latido estocástico con bombo — la fase sale del hash de la celda
        // (id.x*TAU ≡ 0 siempre: entero·2π no desfasaba nada)
        floraCol *= 1.0 + u_kickPulse * (1.5 + 1.0 * sin(mod(u_time * 5.0, TAU) + hash21(id + 31.7) * TAU));

        vec3 layerCol = mix(leafCol, floraCol, isFlower) * leafMask * fade;
        layerCol *= mix(0.1, 1.0, z);

        col = mix(col, layerCol, leafMask * fade * 0.95);
    }

    // 5. Luciérnagas — voronoi 3×3: antes se evaluaba SOLO la celda actual,
    // así que cada punto se cortaba al cruzar el borde del grid (pop duro por
    // luciérnaga). Con las 9 vecinas el dot sangra entre celdas — continuo.
    // El scroll va mod(512) para acotar los args de hash (f32).
    vec2 ffBase = uv * 25.0 + vec2(mod(beats * 0.5, 512.0), mod(beats * 1.2, 512.0));
    vec2 ffIp = floor(ffBase);
    vec2 ffFp = fract(ffBase);
    vec3 ffSum = vec3(0.0);
    for (int fj = -1; fj <= 1; fj++)
    for (int fi = -1; fi <= 1; fi++) {
        vec2 cell = ffIp + vec2(float(fi), float(fj));
        float cid = hash21(cell + sd.yz);
        if (cid < 0.93) continue;                                 // ~7% pobladas
        vec2 off = (vec2(hash21(cell), fract(cid * 3.14)) - 0.5) * 0.6;
        float fd = length(vec2(float(fi), float(fj)) + 0.5 + off - ffFp);
        float blink = smoothstep(0.0, 1.0, sin(mod(u_time * 4.0, TAU) + cid * TAU));
        ffSum += vec3(0.7, 1.0, 0.2) * smoothstep(0.16, 0.04, fd) * blink;
    }
    col += ffSum * (u_treble + u_hihatEnergy) * 4.0;

    col *= euVoidGate(0.4);

    col *= (0.7 + 0.6 * u_energy) * live; //[cite: 20]
    col *= 1.0 - 0.4 * dot(uv, uv); 

    c = vec4(col, 1.0);
}