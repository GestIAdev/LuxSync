/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌌 CHILL STEREO PHYSICS: THE ABYSSAL CHRONICLES (WAVE 1060)
 * ═══════════════════════════════════════════════════════════════════════════
 * "Cuanto más profundo vas, más extraña es la luz."
 * * SISTEMA DE PROFUNDIDAD DINÁMICA:
 * 1. ⚛️ RELOJ ISOTÓPICO: Ciclo base de ~45 min basado en Date.now().
 * 2. 🩻 GOD EAR MODULATION:
 * - Centroid alto (>2000Hz) -> Flotabilidad positiva (hacia superficie).
 * - Centroid bajo (<500Hz) -> Presión negativa (hacia el fondo).
 * 3. 🎨 COLOR SYNTHESIS: Genera HSL nativo basado en la profundidad.
 * 4. 🪼 BIOLUMINISCENCIA: Reactiva a UltraAir (16-22kHz).
 */
// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
// Configuración de las zonas de profundidad (Metros virtuales)
const ZONES = {
    SHALLOWS: { min: 0, max: 200, hue: 160, speed: 1.5, label: '🌿' }, // Verde Agua
    OPEN_OCEAN: { min: 200, max: 1000, hue: 200, speed: 1.0, label: '🐬' }, // Cian/Azul
    TWILIGHT: { min: 1000, max: 4000, hue: 250, speed: 0.6, label: '🐋' }, // Índigo
    MIDNIGHT: { min: 4000, max: 11000, hue: 290, speed: 0.3, label: '🪼' } // UV/Magenta
};
// Estado persistente mínimo (para suavizado de profundidad)
let currentDepth = 500; // Empezamos en Open Ocean
export const calculateChillStereo = (time, energy, air, isKick, godEar = {} // Recibimos telemetría completa
) => {
    const now = Date.now() / 1000; // Segundos absolutos
    // ═══════════════════════════════════════════════════════════════════════
    // 1. CÁLCULO DE PROFUNDIDAD (La Narrativa)
    // ═══════════════════════════════════════════════════════════════════════
    // A. El Ciclo de Marea (Reloj de 45 minutos)
    // Oscila entre 0m y 8000m lentamente
    const tideCycle = 45 * 60; // 45 min en segundos
    const tidePhase = (now % tideCycle) / tideCycle; // 0.0 a 1.0
    const baseDepth = 4000 * (1 + Math.sin(tidePhase * Math.PI * 2)); // 0 a 8000m
    // B. Modulación Espectral (God Ear) - La "Flotabilidad"
    // Centroid alto (voces, hihats) nos sube. Bajos profundos nos hunden.
    const centroid = godEar.centroid || 1000;
    const buoyancy = (centroid - 800) * -2; // -2m por cada Hz arriba de 800
    // Integración suave (Lerp) para evitar saltos bruscos
    const targetDepth = clamp(baseDepth + buoyancy, 0, 10000);
    currentDepth = currentDepth * 0.99 + targetDepth * 0.01; // Inercia hidrodinámica
    // Determinar Zona Actual
    let zone = 'OPEN_OCEAN';
    let zoneConfig = ZONES.OPEN_OCEAN;
    if (currentDepth < ZONES.SHALLOWS.max) {
        zone = 'SHALLOWS';
        zoneConfig = ZONES.SHALLOWS;
    }
    else if (currentDepth < ZONES.OPEN_OCEAN.max) {
        zone = 'OPEN_OCEAN';
        zoneConfig = ZONES.OPEN_OCEAN;
    }
    else if (currentDepth < ZONES.TWILIGHT.max) {
        zone = 'TWILIGHT';
        zoneConfig = ZONES.TWILIGHT;
    }
    else {
        zone = 'MIDNIGHT';
        zoneConfig = ZONES.MIDNIGHT;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // 2. SÍNTESIS DE COLOR (Cromatografía de Presión)
    // ═══════════════════════════════════════════════════════════════════════
    // El color base depende de la profundidad exacta, no solo de la zona (gradiente)
    // Mapeamos 0-10000m a un rango de HUE (150 - 320)
    // 0m = 150 (Verde) -> 10000m = 300 (Magenta)
    const depthHue = 150 + (Math.min(currentDepth, 8000) / 8000) * 150;
    // Variación "Bioluminiscente": Ondulación lenta del matiz
    const hueDrift = Math.sin(now * 0.1) * 10;
    const finalHue = depthHue + hueDrift;
    // Saturación y Luz bajan con la profundidad (más oscuro y monocromático abajo)
    const saturation = clamp(100 - (currentDepth / 500), 60, 100);
    const lightness = clamp(60 - (currentDepth / 300), 20, 60); // Nunca negro total
    // ═══════════════════════════════════════════════════════════════════════
    // 3. FÍSICA DE FLUIDOS (Adaptativa)
    // ═══════════════════════════════════════════════════════════════════════
    // Velocidad del agua depende de la zona (rápida arriba, estática abajo)
    const flowSpeed = zoneConfig.speed * (1 + energy * 0.5);
    const t = now * flowSpeed;
    // -- TWIN TIDES ENGINE (Solid State) --
    // Left Hemisphere
    const oscL = Math.sin(t / 3.6) + (Math.sin(t / 2.0) * 0.2);
    const frontL = 0.5 + (oscL * 0.4);
    const backL = 0.4 + (Math.sin((t / 3.6) - 1.8) * 0.3);
    // Right Hemisphere (Desfasado)
    const oscR = Math.cos(t / 3.0) + (Math.sin(t / 2.7) * 0.2);
    const frontR = 0.5 + (oscR * 0.4);
    const backR = 0.4 + (Math.cos((t / 3.0) - 2.2) * 0.3);
    // ═══════════════════════════════════════════════════════════════════════
    // 4. MOVERS & PLANKTON (Los Habitantes)
    // ═══════════════════════════════════════════════════════════════════════
    // Plankton: Reactivo a UltraAir (16-22kHz)
    // Si estamos profundos (TWILIGHT/MIDNIGHT), el plankton brilla más
    const planktonSensitivity = currentDepth > 1000 ? 50 : 10;
    const planktonFlash = (godEar.ultraAir || 0) * planktonSensitivity;
    // Movers: "Searchlights"
    // En superficie barren rápido. En fondo son casi estáticos.
    const moverPanL = 0.5 + Math.sin(now / (40 / zoneConfig.speed)) * 0.45;
    const moverPanR = 0.5 + Math.sin((now / (35 / zoneConfig.speed)) + 100) * 0.45;
    // Intensidad Movers + Plankton flash
    const moverIntL = clamp(0.3 + (Math.sin(now * 0.2) * 0.3) + planktonFlash, 0, 1);
    const moverIntR = clamp(0.3 + (Math.sin(now * 0.23 + 2) * 0.3) + planktonFlash, 0, 1);
    // ═══════════════════════════════════════════════════════════════════════
    // 5. SALIDA
    // ═══════════════════════════════════════════════════════════════════════
    return {
        frontL: clamp(frontL, 0, 1),
        frontR: clamp(frontR, 0, 1),
        backL: clamp(backL, 0, 1),
        backR: clamp(backR, 0, 1),
        moverL: { intensity: moverIntL, pan: moverPanL, tilt: 0.6 + Math.cos(now * 0.1) * 0.2 },
        moverR: { intensity: moverIntR, pan: moverPanR, tilt: 0.6 + Math.cos(now * 0.11) * 0.2 },
        // Inyectamos el COLOR CALCULADO para que el Arbiter lo use
        colorOverride: { h: finalHue / 360, s: saturation / 100, l: lightness / 100 },
        airIntensity: clamp(energy * 0.2 + planktonFlash, 0, 0.5),
        debug: `${zoneConfig.label} ${currentDepth.toFixed(0)}m | H:${finalHue.toFixed(0)}° | UA:${(godEar.ultraAir || 0).toFixed(3)}`
    };
};
// Stubs legacy
export const resetDeepFieldState = () => { };
export const getDeepFieldState = () => ({});
