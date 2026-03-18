/**
 * 🎛️ WAVE 338: VIBE MOVEMENT PRESETS
 *
 * Define física de movimiento + óptica por vibe.
 * El FixturePhysicsDriver lee estos presets y ajusta su comportamiento.
 *
 * FILOSOFÍA:
 * - Cada vibe tiene su "personalidad física"
 * - Techno = Rápido, seco, preciso
 * - Latino = Fluido, orgánico, bailarín
 * - Rock = Reactivo, dramático, wall of light
 * - Chill = Glacial, nebuloso, meditativo
 *
 * @layer ENGINE/MOVEMENT
 * @version WAVE 338 - Core 2 Kickoff
 */
// ═══════════════════════════════════════════════════════════════════════════
// PRESETS POR VIBE
// ═══════════════════════════════════════════════════════════════════════════
export const MOVEMENT_PRESETS = {
    // ───────────────────────────────────────────────────────────────
    // 🎛️ TECHNO: Velocidad máxima, Aceleración agresiva, Beam cerrado
    // "Los demonios de neón en el bunker noruego"
    // 🔧 WAVE 350.5: maxAcceleration 1500 → 2000 (safety bump para botStabs)
    // 🔧 WAVE 2088.4: CALIBRACIÓN REAL — basada en hardware real (Sharpy ~257°/s = 121 DMX/s)
    //    ANTES: revLimitPan=3600 (7624°/s = 25× un Sharpy real), snapFactor=1.0 (sin damping)
    //    Log probaba velocidades de 7624°/s reales. Epilepsia pura.
    //    AHORA: REV_LIMIT calibrado a mover pro real. snapFactor<1.0 para damping.
    //    Referencia: Clay Paky Sharpy Pan=540°/2.1s=257°/s, Robe Robin=300°/s
    // ───────────────────────────────────────────────────────────────
    'techno-club': {
        physics: {
            maxAcceleration: 2000, // 🔧 Arranques agresivos pero seguros (era 1500)
            maxVelocity: 600, // Muy rápido
            friction: 0.08, // 🔥 WAVE 2213: Bajísima — industrial robótico sin escalonado (era 0.05 snap)
            arrivalThreshold: 0.5, // Precisión alta
            physicsMode: 'classic', // 🔥 WAVE 2213: Exorcismo del snap — trayectorias sinusoidales continuas
            // ═══════════════════════════════════════════════════════════════════
            // 🔧 WAVE 2088.8: THE SHAPE RESURRECTION
            // WAVE 2088.4 bajó snapFactor a 0.35 y revLimit a 140 para evitar epilepsia.
            // Pero eso fue con Hermite (ya eliminado en 2088.7). Ahora los targets
            // son lineales puros y el PhysicsDriver es el ÚNICO filtro.
            // Con snap=0.35 + revLimit=140: el mover NUNCA alcanza el target.
            // Un square se convierte en blob, un scan en balanceo tímido.
            //
            // CALIBRACIÓN: Para que un scan_x de período 16 beats a 120 BPM
            // cubra ~200 DMX de rango en ~2s de semi-ciclo, necesitamos:
            //   - snapFactor=0.85 → el mover alcanza 85% del delta por frame
            //   - revLimit=400 → 6.67 DMX/frame → 200 DMX en 30 frames (0.5s)
            // Esto da patrones DEFINIDOS sin epilepsia (el revLimit protege).
            // ═══════════════════════════════════════════════════════════════════
            snapFactor: 0.85, // 🔧 WAVE 2088.8: Respuesta agresiva — los patrones deben DIBUJARSE
            revLimitPanPerSec: 400, // 🔧 WAVE 2088.8: ~848°/s — rápido pero acotado. 6.67 DMX/frame@60fps
            revLimitTiltPerSec: 280, // 🔧 WAVE 2088.8: ~297°/s — tilt siempre más lento
        },
        optics: {
            zoomDefault: 30, // Beam cerrado (láser)
            zoomRange: { min: 0, max: 80 },
            focusDefault: 20, // Foco nítido (corte limpio)
            focusRange: { min: 0, max: 50 },
        },
        behavior: {
            homeOnSilence: false, // Mantener posición en breakdown
            syncToBeat: true, // Sincronizar con kick
            allowRandomPos: false, // Patrones predecibles
            smoothFactor: 0.1, // Movimiento seco
        },
    },
    // ───────────────────────────────────────────────────────────────
    // 💃 LATINO: Fluido, Circular, Orgánico
    // "La cumbia tiene swing, los movers también"
    // 🔧 WAVE 340.5: Aceleración alta para seguir caderas
    // 🔧 WAVE 2088.4: CALIBRACIÓN REAL — figure8 suave necesita seguir curva sin lag
    //    Referencia: 750 DMX/s era ~1588°/s. Un figure8 a 120bpm con período 8 beats
    //    necesita ~50 DMX/s pico. Le damos 85 DMX/s (~180°/s) para headroom.
    // ───────────────────────────────────────────────────────────────
    'fiesta-latina': {
        physics: {
            maxAcceleration: 1200, // 🔧 Subido: Seguir caderas rápido
            maxVelocity: 350, // 🔧 Subido: Más swing
            friction: 0.15, // 🔥 WAVE 2213: Fluido orgánico (era 0.20 snap)
            arrivalThreshold: 2.0, // Permite overshoot elegante
            physicsMode: 'classic', // 🔥 WAVE 2213: Exorcismo del snap — curvas sin escalera
            // ═══════════════════════════════════════════════════════════════════
            // 🔧 WAVE 2088.8: THE SHAPE RESURRECTION
            // Latino dibuja figure8, wave_y — curvas que necesitan que el mover
            // SIGA la trayectoria con precisión. Con snap=0.45 + revLimit=85,
            // un figure8 de período 16 beats se convertía en una elipse aplastada
            // porque el mover nunca alcanzaba los extremos del Lissajous.
            //
            // snap=0.70 → sigue la curva con 70% de fidelidad por frame
            // revLimit=250 → 4.17 DMX/frame → suficiente para las curvas suaves
            // ═══════════════════════════════════════════════════════════════════
            snapFactor: 0.70, // 🔧 WAVE 2088.8: Fiel a las curvas, con suavidad orgánica residual
            revLimitPanPerSec: 250, // 🔧 WAVE 2088.8: ~530°/s — headroom para figure8 a alta energía
            revLimitTiltPerSec: 180, // 🔧 WAVE 2088.8: ~191°/s — tilt curvo suave
        },
        optics: {
            zoomDefault: 150, // Zoom medio (spot suave)
            zoomRange: { min: 80, max: 200 },
            focusDefault: 100, // Foco medio
            focusRange: { min: 50, max: 180 },
        },
        behavior: {
            homeOnSilence: false, // Continuar bailando
            syncToBeat: true, // Sincronizar con clave
            allowRandomPos: true, // Movimientos orgánicos
            smoothFactor: 0.5, // Movimiento suave
        },
    },
    // ───────────────────────────────────────────────────────────────
    // 🎸 ROCK: Reactivo, Posiciones fijas, Wall of Light
    // "El muro de luz que golpea con la guitarra"
    // 🔧 WAVE 340.5: Aceleración alta para punch
    // 🔧 WAVE 2088.4: CALIBRACIÓN REAL — golpes dramáticos pero creíbles
    //    Rock necesita movimientos con peso, como un headbang — no teleporting.
    //    Referencia: mover de gama media (~200°/s pan = 94 DMX/s)
    // ───────────────────────────────────────────────────────────────
    'pop-rock': {
        physics: {
            maxAcceleration: 1100, // 🔧 Subido: Golpes reactivos duros
            maxVelocity: 450, // 🔧 Subido: Rápido en golpes
            friction: 0.20, // 🔥 WAVE 2213: Peso con punch (era 0.30 snap)
            arrivalThreshold: 1.0, // Precisión normal
            physicsMode: 'classic', // 🔥 WAVE 2213: Exorcismo del snap — arcos con gravitas
            // ═══════════════════════════════════════════════════════════════════
            // 🔧 WAVE 2088.8: THE SHAPE RESURRECTION
            // Rock usa circle_big, cancan, dual_sweep. Con snap=0.30 + revLimit=95
            // un circle_big de 16 beats se convertía en un temblor amorfo.
            // Los movers de estadio necesitan dibujar ARCOS visibles.
            //
            // snap=0.65 → el mover persigue con PESO (más lento que techno)
            // revLimit=300 → 5 DMX/frame → arcos grandes con gravitas
            // ═══════════════════════════════════════════════════════════════════
            snapFactor: 0.65, // 🔧 WAVE 2088.8: Golpes con peso visible — más lento que techno
            revLimitPanPerSec: 300, // 🔧 WAVE 2088.8: ~636°/s — arcos dramáticos de estadio
            revLimitTiltPerSec: 200, // 🔧 WAVE 2088.8: ~212°/s — tilt con gravitas
        },
        optics: {
            zoomDefault: 220, // Zoom abierto (wash)
            zoomRange: { min: 150, max: 255 },
            focusDefault: 180, // Foco suave (difuso)
            focusRange: { min: 100, max: 255 },
        },
        behavior: {
            homeOnSilence: true, // Volver a home en breakdown
            syncToBeat: false, // Reaccionar a energía, no beat
            allowRandomPos: false, // Posiciones de stage fijas
            smoothFactor: 0.2, // Algo de suavizado
        },
    },
    // ───────────────────────────────────────────────────────────────
    // 🍸 CHILL: Glacial, Nebulosa, Meditativo
    // "Flotando en el sunset con cocktail en mano"
    // ───────────────────────────────────────────────────────────────
    'chill-lounge': {
        physics: {
            maxAcceleration: 100, // Ultra lento
            maxVelocity: 50, // Velocidad glacial
            friction: 0.80, // Máxima fricción (slew rate limit)
            arrivalThreshold: 3.0, // Permite mucho overshoot
            physicsMode: 'classic', // 🏎️ WAVE 2074.2: Inercia glacial, navega suavemente
            snapFactor: 0.0, // 🏎️ WAVE 2074.3: No aplica en classic mode (ignorado)
            revLimitPanPerSec: 80, // 🔧 WAVE 2088.8: ~170°/s — Chill pero con movimiento VISIBLE
            //    Antes=30 → drift/sway eran imperceptibles
            revLimitTiltPerSec: 55, // 🔧 WAVE 2088.8: ~58°/s — tilt orgánico visible
        },
        optics: {
            zoomDefault: 255, // Zoom máximo (wash total)
            zoomRange: { min: 200, max: 255 },
            focusDefault: 255, // Desenfocado (nebulosa)
            focusRange: { min: 200, max: 255 },
        },
        behavior: {
            homeOnSilence: false, // Flotar eternamente
            syncToBeat: false, // Movimiento libre
            allowRandomPos: true, // Deriva orgánica
            smoothFactor: 0.9, // Ultra suave
        },
    },
    // ───────────────────────────────────────────────────────────────
    // 💤 IDLE: Estático, Neutral
    // "Esperando que el DJ arranque"
    // ───────────────────────────────────────────────────────────────
    'idle': {
        physics: {
            maxAcceleration: 200,
            maxVelocity: 100,
            friction: 0.50,
            arrivalThreshold: 1.0,
            physicsMode: 'classic', // 🏎️ WAVE 2074.2: Idle = sin prisa, física suave
            snapFactor: 0.0, // 🏎️ WAVE 2074.3: No aplica en classic mode (ignorado)
            revLimitPanPerSec: 120, // 🔧 WAVE 2088.8: ~254°/s — idle visible, no congelado
            revLimitTiltPerSec: 80, // 🔧 WAVE 2088.8: ~85°/s — tilt suave en idle
        },
        optics: {
            zoomDefault: 127, // Zoom neutro
            zoomRange: { min: 0, max: 255 },
            focusDefault: 127, // Foco neutro
            focusRange: { min: 0, max: 255 },
        },
        behavior: {
            homeOnSilence: true,
            syncToBeat: false,
            allowRandomPos: false,
            smoothFactor: 0.3,
        },
    },
};
// ═══════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Obtener preset de movimiento por vibe ID
 */
export function getMovementPreset(vibeId) {
    const preset = MOVEMENT_PRESETS[vibeId];
    // 🚨 WAVE 2040.3: EL CHIVATO - Detect fallback to idle
    if (!preset) {
        console.warn(`[VibeMovementPresets] ⚠️ ERROR 404: Preset for vibeId="${vibeId}" NOT FOUND!\n` +
            `   ├─ Available presets: ${Object.keys(MOVEMENT_PRESETS).join(', ')}\n` +
            `   └─ Falling back to 'idle' preset (MOVERS WILL FREEZE)`);
        return MOVEMENT_PRESETS['idle'];
    }
    return preset;
}
/**
 * Obtener solo la física por vibe ID
 */
export function getMovementPhysics(vibeId) {
    return getMovementPreset(vibeId).physics;
}
/**
 * Obtener solo la óptica por vibe ID
 */
export function getOpticsConfig(vibeId) {
    return getMovementPreset(vibeId).optics;
}
/**
 * Obtener solo el comportamiento por vibe ID
 */
export function getMovementBehavior(vibeId) {
    return getMovementPreset(vibeId).behavior;
}
/**
 * Lista de vibes disponibles con presets
 */
export function getAvailableVibeIds() {
    return Object.keys(MOVEMENT_PRESETS);
}
