/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌊 CHILL STEREO PHYSICS: TWIN TIDES (WAVE 1053)
 * ═══════════════════════════════════════════════════════════════════════════
 * OBJETIVO: Separación Estéreo REAL y ROBUSTA para Pares y Movers.
 * * ESTRATEGIA "SOLID STATE":
 * 1. 🕒 TIEMPO ABSOLUTO: Date.now() es el único reloj. Cero drift, cero sync.
 * 2. 🧬 ADN DIVIDIDO:
 * - IZQUIERDA usa primos (23s, 29s).
 * - DERECHA usa primos (19s, 31s).
 * - Matemáticamente imposible que se sincronicen.
 * 3. 🔊 BYPASS VMM: Coordenadas directas para Movers.
 */
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
export const calculateChillStereo = (time, // Ignorado, usamos reloj atómico
energy, // 0-1
air, isKick) => {
    // 1. RELOJ ATÓMICO
    const now = Date.now();
    // Factor de "Vida": La energía añade un poco de brillo base, pero no toca el tiempo
    const ambience = 0.05 + (energy * 0.15);
    // ═══════════════════════════════════════════════════════════════════════
    // 2. LEFT HEMISPHERE (Océano Pacífico - Lento y Profundo)
    // ═══════════════════════════════════════════════════════════════════════
    // Ciclos: 23 segundos (Principal) + 13 segundos (Detalle)
    // Wave principal (-1 a 1)
    const oscL = Math.sin(now / 3659) + (Math.sin(now / 2069) * 0.3);
    // FRONT LEFT: Mapeo suave (0.2 a 0.9)
    const frontL = 0.55 + (oscL * 0.35);
    // BACK LEFT: Eco retardado (Phase shift pi/2) + Oscilación propia lenta
    // Esto crea profundidad: El fondo respira después del frente
    const backL = 0.45 + (Math.sin((now / 3659) - 1.5) * 0.3) + (Math.sin(now / 5000) * 0.1);
    // ═══════════════════════════════════════════════════════════════════════
    // 3. RIGHT HEMISPHERE (Océano Atlántico - Nervioso y Activo)
    // ═══════════════════════════════════════════════════════════════════════
    // Ciclos: 19 segundos (Principal) + 17 segundos (Detalle)
    // Divisores DIFERENTES a la izquierda. Nunca coincidirán.
    // Wave principal
    const oscR = Math.cos(now / 3023) + (Math.sin(now / 2707) * 0.3);
    // FRONT RIGHT
    const frontR = 0.55 + (oscR * 0.35);
    // BACK RIGHT: Eco retardado distinto
    const backR = 0.45 + (Math.cos((now / 3023) - 2.0) * 0.3) + (Math.sin(now / 4500) * 0.1);
    // ═══════════════════════════════════════════════════════════════════════
    // 4. MOVERS (Searchlights Desacoplados)
    // ═══════════════════════════════════════════════════════════════════════
    // Mantienen la lógica que ya te funcionó (Totalmente asimétricos)
    // Pan L: Barrido muy lento (~29s)
    const panL = 0.5 + Math.sin(now / 4603) * 0.45;
    // Tilt L: Respiración vertical (~11s)
    const tiltL = 0.6 + Math.cos(now / 1753) * 0.25;
    // Pan R: Barrido medio (~23s) - Phase offset enorme
    const panR = 0.5 + Math.sin((now / 3659) + 100) * 0.45;
    // Tilt R: Respiración vertical (~7s)
    const tiltR = 0.6 + Math.cos((now / 1117) + 50) * 0.25;
    // Intensidad Movers: Respiración independiente del suelo
    const intL = 0.3 + (Math.sin(now / 2500) * 0.5 + 0.5) * 0.6;
    const intR = 0.3 + (Math.sin((now / 3100) + 2) * 0.5 + 0.5) * 0.6;
    // ═══════════════════════════════════════════════════════════════════════
    // 5. OUTPUT ASSEMBLY
    // ═══════════════════════════════════════════════════════════════════════
    // "Ducking" muy sutil en el bombo para dar sensación de aire
    const kickDip = isKick ? 0.15 : 0;
    return {
        frontL: clamp(frontL + ambience - kickDip, 0, 1),
        frontR: clamp(frontR + ambience - kickDip, 0, 1),
        // Back no hace ducking, sube un poco para compensar (Push-Pull dinámico)
        backL: clamp(backL + ambience + (kickDip * 0.3), 0, 1),
        backR: clamp(backR + ambience + (kickDip * 0.3), 0, 1),
        // Mechanics Bypass Object (Para WAVE 1052 Arbiter)
        moverL: {
            intensity: clamp(intL, 0, 1),
            pan: panL,
            tilt: tiltL
        },
        moverR: {
            intensity: clamp(intR, 0, 1),
            pan: panR,
            tilt: tiltR
        },
        airIntensity: clamp(energy * 0.25, 0, 0.4),
        // Debug visual para verificar asimetría
        debug: `TwinTides 🌊 L:${frontL.toFixed(2)} R:${frontR.toFixed(2)}`
    };
};
// Stubs para compatibilidad con código legacy que intente llamar a esto
export const resetDeepFieldState = () => { };
export const getDeepFieldState = () => ({});
