/**
 * 🌙 WAVE 274: SELENE LUX - THE NERVOUS SYSTEM
 * ============================================================================
 *
 * Sistema Nervioso de LuxSync. Recibe órdenes de TitanEngine y las traduce
 * a impulsos físicos específicos por género (StereoPhysics).
 *
 * RESPONSABILIDAD ÚNICA:
 * - Recibir updateFromTitan() con paleta base + vibe + elementalMods
 * - Despachar a los micromotores físicos (Techno, Rock, Latino, Chill)
 * - Devolver la paleta procesada con reactividad aplicada
 *
 * FILOSOFÍA:
 * - NO conoce audio directamente (lo recibe de TitanEngine)
 * - NO genera colores (los recibe ya calculados)
 * - SOLO aplica física de reactividad según el género
 *
 * 📜 WAVE 450 ENMIENDA: ENERGY OVERRIDE
 * Si energy > 0.85, los modificadores de consciencia son IGNORADOS.
 * La física tiene VETO TOTAL en los drops/clímax.
 * "En los drops, la física manda. En los valles, Selene piensa."
 *
 * @layer CORE (Sistema Nervioso)
 * @version WAVE 450 - Consciousness Integration
 */
// ═══════════════════════════════════════════════════════════════════════════
// IMPORTS
// ═══════════════════════════════════════════════════════════════════════════
import { TechnoStereoPhysics, technoStereoPhysics, RockStereoPhysics, LatinoStereoPhysics, ChillStereoPhysics } from '../../hal/physics';
import { isEnergyOverrideActive, } from '../../engine/consciousness/ConsciousnessOutput';
// ═══════════════════════════════════════════════════════════════════════════
// SELENE LUX CLASS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🌙 SELENE LUX - Sistema Nervioso de Iluminación
 *
 * Transforma paletas estáticas en paletas reactivas aplicando
 * física de género (strobes, flashes, solar flares, breathing).
 */
export class SeleneLux {
    constructor(config = {}) {
        this.frameCount = 0;
        this.lastStrobeActive = false;
        this.lastForceMovement = false;
        // 🆕 WAVE 288.1: Throttling de logs para latino
        this.lastLatinoLogTime = 0; // Timestamp último log
        this.lastLatinoFlavor = null; // Último flavor loguado
        this.LOG_THROTTLE_MS = 2000; // 2 segundos mínimo entre logs
        // 🆕 WAVE 288.7: Overrides de intensidad calculados por motor Latino
        this.latinoOverrides = null;
        // 🆕 WAVE 290.3: Overrides de intensidad calculados por motor Techno
        this.technoOverrides = null;
        // 🆕 WAVE 301: ANALOG ROCK - Overrides de voltaje analógico
        this.rockOverrides = null;
        // 🆕 WAVE 315: CHILL BREATHING - Overrides de bioluminiscencia
        this.chillOverrides = null;
        this.debug = config.debug ?? false;
        // Inicializar físicas stateful
        this.latinoPhysics = new LatinoStereoPhysics();
        this.chillPhysics = new ChillStereoPhysics();
        this.rockPhysics = new RockStereoPhysics(); // 🆕 WAVE 298: Rock zone physics
        // Output por defecto
        this.lastOutput = {
            palette: {
                primary: { r: 128, g: 64, b: 64 },
                secondary: { r: 100, g: 50, b: 50 },
                ambient: { r: 80, g: 40, b: 40 },
                accent: { r: 150, g: 75, b: 75 },
            },
            // 🎚️ WAVE 275: Zone intensities por defecto
            zoneIntensities: {
                front: 0,
                back: 0,
                mover: 0,
            },
            isStrobeActive: false,
            isFlashActive: false,
            isSolarFlare: false,
            dimmerOverride: null,
            forceMovement: false,
            physicsApplied: 'none',
            energyOverrideActive: false, // 🧠 WAVE 450
        };
        console.log('[SeleneLux] 🌙 Nervous System initialized (WAVE 450 + Consciousness Integration)');
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // API PÚBLICA
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * 🧠 Recibe actualización desde TitanEngine y aplica física reactiva
     *
     * @param vibeContext - Contexto del vibe activo
     * @param basePalette - Paleta calculada por SeleneColorEngine
     * @param audioMetrics - Métricas de audio normalizadas
     * @param elementalMods - Modificadores zodiacales (WAVE 273)
     */
    updateFromTitan(vibeContext, basePalette, audioMetrics, elementalMods) {
        this.frameCount++;
        // Convertir ColorPalette a RGB interno
        const inputPalette = this.colorPaletteToRgb(basePalette);
        // Detectar género del vibe
        const vibeNormalized = vibeContext.activeVibe.toLowerCase();
        // Reset estado
        let isStrobeActive = false;
        let isFlashActive = false;
        let isSolarFlare = false;
        let dimmerOverride = null;
        let forceMovement = false;
        let physicsApplied = 'none';
        let outputPalette = { ...inputPalette };
        let debugInfo = {};
        // ─────────────────────────────────────────────────────────────────────
        // PHYSICS DISPATCH POR GÉNERO
        // ─────────────────────────────────────────────────────────────────────
        if (vibeNormalized.includes('techno') || vibeNormalized.includes('electro')) {
            // ⚡ TECHNO: Industrial Strobe Physics
            // 1. API Legacy para colores/strobe
            const result = TechnoStereoPhysics.apply(inputPalette, {
                normalizedTreble: audioMetrics.normalizedTreble,
                normalizedBass: audioMetrics.normalizedBass,
            }, elementalMods);
            outputPalette.accent = result.palette.accent;
            isStrobeActive = result.isStrobeActive;
            physicsApplied = 'techno';
            debugInfo = result.debugInfo;
            // 2. WAVE 290.3: Nueva API para zonas/intensidades
            const zonesResult = technoStereoPhysics.applyZones({
                bass: audioMetrics.normalizedBass,
                mid: audioMetrics.normalizedMid,
                treble: audioMetrics.normalizedTreble,
                bpm: vibeContext.bpm ?? 120,
                melodyThreshold: 0.4,
                isRealSilence: audioMetrics.avgNormEnergy < 0.01,
                isAGCTrap: false,
                sectionType: vibeContext.section
            });
            // Guardar overrides para usar después
            // 🧪 WAVE 908: Guardar L/R separados para THE DUEL
            this.technoOverrides = {
                front: zonesResult.frontParIntensity,
                back: zonesResult.backParIntensity,
                mover: zonesResult.moverIntensity, // Legacy fallback
                moverL: zonesResult.moverIntensityL, // Split L (Mid-dominant)
                moverR: zonesResult.moverIntensityR // Split R (Treble-dominant)
            };
            if (this.debug && isStrobeActive) {
                console.log('[SeleneLux] ⚡ TECHNO PHYSICS | Strobe ACTIVE');
            }
        }
        else if (vibeNormalized.includes('rock') || vibeNormalized.includes('pop')) {
            // 🎸 ROCK: Snare Crack + Kick Punch
            // WAVE 304: Simple zone processing (nuevo sistema de ganancias analógicas)
            this.rockOverrides = this.rockPhysics.applyZones({
                bass: audioMetrics.normalizedBass,
                mid: audioMetrics.normalizedMid,
                treble: audioMetrics.normalizedTreble,
            }, vibeContext.bpm ?? 120);
            // No hay cambio de paleta en Rock (usamos la entrada)
            // outputPalette permanece igual
            isFlashActive = false; // Rock no usa flash, usa voltajes analógicos
            physicsApplied = 'rock';
            debugInfo = { front: this.rockOverrides.front, back: this.rockOverrides.back, mover: this.rockOverrides.mover };
        }
        else if (vibeNormalized.includes('latin') ||
            vibeNormalized.includes('fiesta') ||
            vibeNormalized.includes('reggae') ||
            vibeNormalized.includes('cumbia') ||
            vibeNormalized.includes('salsa') ||
            vibeNormalized.includes('bachata')) {
            // ☀️ LATINO: Solar Flare + Machine Gun Blackout + White Puncture
            const result = this.latinoPhysics.apply(inputPalette, {
                normalizedBass: audioMetrics.normalizedBass,
                normalizedMid: audioMetrics.normalizedMid, // 🆕 WAVE 288.7: Añadir mid para movers
                normalizedEnergy: audioMetrics.avgNormEnergy,
                normalizedHigh: audioMetrics.normalizedTreble, // 🆕 WAVE 288.7: Añadir treble (aunque no se usa)
                sectionType: vibeContext.section, // 🆕 WAVE 290: Sección para White Puncture
            }, vibeContext.bpm, elementalMods);
            outputPalette.primary = result.palette.primary;
            outputPalette.accent = result.palette.accent;
            isSolarFlare = result.isSolarFlare;
            forceMovement = result.forceMovement;
            if (result.dimmerOverride !== null) {
                dimmerOverride = result.dimmerOverride;
            }
            physicsApplied = 'latino';
            debugInfo = { flavor: result.flavor, ...result.debugInfo };
            // 🆕 WAVE 288.7: Guardar overrides del motor Latino para usar en AGC TRUST
            // 🎺 WAVE 1004.1: Incluir L/R split para movers
            this.latinoOverrides = {
                front: result.frontParIntensity,
                back: result.backParIntensity,
                mover: result.moverIntensity,
                moverL: result.moverIntensityL, // 🎺 WAVE 1004.1: El Galán (Mid)
                moverR: result.moverIntensityR, // 🎺 WAVE 1004.1: La Dama (Treble)
            };
            // 🆕 WAVE 288.1: Log THROTTLED - Solo cuando cambia flavor O cada 2s
            if (this.debug && isSolarFlare) {
                const now = Date.now();
                const timeSinceLastLog = now - this.lastLatinoLogTime;
                const flavorChanged = result.flavor !== this.lastLatinoFlavor;
                // 🧹 WAVE 671.5: Silenced legacy Latino physics spam
                // if (flavorChanged || timeSinceLastLog >= this.LOG_THROTTLE_MS) {
                //   console.log(`[SeleneLux] ☀️ LATINO PHYSICS | Solar Flare ACTIVE | Flavor:${result.flavor}`);
                //   this.lastLatinoLogTime = now;
                //   this.lastLatinoFlavor = result.flavor;
                // }
            }
        }
        else if (vibeNormalized.includes('chill') ||
            vibeNormalized.includes('ambient') ||
            vibeNormalized.includes('lounge') ||
            vibeNormalized.includes('jazz') ||
            vibeNormalized.includes('classical')) {
            // ═══════════════════════════════════════════════════════════════════════
            // 🌊✨ WAVE 316: COSMIC TWILIGHT - Sunset Argentino con Cocktails
            // ═══════════════════════════════════════════════════════════════════════
            // FILOSOFÍA: "Techno que se fumó un porro"
            // - Bass hits (djembes) → Front PARs pulse (+20%, 300ms decay)
            // - Pads sustained (treble) → Back PARs cross-fade glow (8 sec)
            // - Movers drift independientes (estrellas contrafase, 20 sec)
            // - Twilight breathing (20 sec, ±5% lightness, floor 0.50 SIEMPRE)
            // - Colores fríos/oceánicos: verde agua → violeta → índigo
            // - CERO oscuridad (cocktail-friendly), CERO velocidad, TODO orgánico
            // ═══════════════════════════════════════════════════════════════════════
            // 🕐 WAVE 318: Pasamos BPM para gravedad temporal
            const result = this.chillPhysics.apply(inputPalette, {
                normalizedBass: audioMetrics.normalizedBass,
                normalizedMid: audioMetrics.normalizedMid,
                normalizedTreble: audioMetrics.normalizedTreble,
                normalizedEnergy: audioMetrics.avgNormEnergy,
            }, elementalMods, vibeContext.bpm // 🆕 BPM para Chronos physics
            );
            outputPalette = result.palette;
            dimmerOverride = 0.70; // Chill siempre luminoso (cocktail party)
            physicsApplied = 'chill';
            debugInfo = result.debugInfo;
            // Extraer intensidades por zona (4 zonas → 3 overrides)
            const moverAvg = (result.zoneIntensities.moverL + result.zoneIntensities.moverR) / 2;
            this.chillOverrides = {
                front: result.zoneIntensities.front,
                back: result.zoneIntensities.back,
                mover: moverAvg,
            };
            // WAVE 316.1: Log eliminado de SeleneLux (ya lo hace ChillStereoPhysics internamente)
        } // Guardar estado
        this.lastStrobeActive = isStrobeActive;
        this.lastForceMovement = forceMovement;
        // ═══════════════════════════════════════════════════════════════════════
        // 👓 WAVE 288.7: AGC TRUST DEMOCRÁTICO
        // ═══════════════════════════════════════════════════════════════════════
        // Si un motor físico (Latino) tiene overrides calculados, los respetamos.
        // Si no hay overrides, usamos la lógica por defecto (Techno/Rock/Chill).
        // ESTO EVITA QUE EL ROUTER SOBRESCRIBA LO QUE EL MOTOR CALCULÓ.
        // ═══════════════════════════════════════════════════════════════════════
        const brightMod = elementalMods?.brightnessMultiplier ?? 1.0;
        const bass = audioMetrics.normalizedBass;
        const mid = audioMetrics.normalizedMid;
        const treble = audioMetrics.normalizedTreble;
        let frontIntensity;
        let backIntensity;
        let moverIntensity;
        // 🎺 WAVE 288.7: ¿Tenemos overrides de Latino?
        if (this.latinoOverrides && physicsApplied === 'latino') {
            // DEMOCRACIA: El motor Latino calculó sus intensidades. Respétalas.
            frontIntensity = Math.min(0.95, this.latinoOverrides.front * brightMod);
            backIntensity = Math.min(0.95, this.latinoOverrides.back);
            moverIntensity = Math.min(1.0, this.latinoOverrides.mover); // Legacy fallback
            // 🎺 WAVE 1004.1: LATINO STEREO SPLIT - Si tenemos L/R separados, preparar para el output
            const latinoL = this.latinoOverrides.moverL ?? moverIntensity; // El Galán (Mid)
            const latinoR = this.latinoOverrides.moverR ?? moverIntensity; // La Dama (Treble)
            // Temporal: guardar en una variable para pasar al output
            this.latinoMoverSplit = { moverL: latinoL, moverR: latinoR };
            // Limpiar overrides para el próximo frame
            this.latinoOverrides = null;
        }
        else if (this.technoOverrides && physicsApplied === 'techno') {
            // ⚡ WAVE 290.3 + WAVE 908: El motor Techno calculó sus intensidades. Respétalas.
            // 🧪 WAVE 908: THE DUEL - Guardar L/R separados
            frontIntensity = Math.min(0.95, this.technoOverrides.front * brightMod);
            backIntensity = Math.min(0.95, this.technoOverrides.back);
            moverIntensity = Math.min(1.0, this.technoOverrides.mover); // Legacy fallback
            // 🧪 WAVE 908: Si tenemos L/R separados, preparar para el output
            const technoL = this.technoOverrides.moverL ?? moverIntensity;
            const technoR = this.technoOverrides.moverR ?? moverIntensity;
            // Temporal: guardar en una variable para pasar al output
            this.technoMoverSplit = { moverL: technoL, moverR: technoR };
            // Limpiar overrides para el próximo frame
            this.technoOverrides = null;
        }
        else if (this.rockOverrides && physicsApplied === 'rock') {
            // 🎸 WAVE 298: El motor Rock calculó sus intensidades. Respétalas.
            // MOVERS escuchan MID (guitarra), no treble!
            frontIntensity = Math.min(0.95, this.rockOverrides.front * brightMod);
            backIntensity = Math.min(0.95, this.rockOverrides.back);
            moverIntensity = Math.min(1.0, this.rockOverrides.mover);
            // WAVE 301: Log ANALOG cada 30 frames - voltaje/carga/fuerza
            if (this.frameCount % 30 === 0 && this.rockOverrides.debug) {
                const fv = this.rockOverrides.debug.frontVoltage.toFixed(2);
                const bc = this.rockOverrides.debug.backCharge.toFixed(2);
                const mf = this.rockOverrides.debug.moverForce.toFixed(2);
                console.log(`[AGC TRUST 🎸ANALOG] IN[B:${bass.toFixed(2)}, M:${mid.toFixed(2)}, T:${treble.toFixed(2)}] -> ⚡ VOLTS[Filament:${fv}, Spark:${bc}, Force:${mf}] -> 💡 OUT[F:${frontIntensity.toFixed(2)}, B:${backIntensity.toFixed(2)}, M:${moverIntensity.toFixed(2)}]`);
            }
            // Limpiar overrides para el próximo frame
            this.rockOverrides = null;
        }
        else if (this.chillOverrides && physicsApplied === 'chill') {
            // ═══════════════════════════════════════════════════════════════════════
            // 🌊 WAVE 315.3: CHILL - El Techno Pacífico (Olas Desfasadas)
            // ═══════════════════════════════════════════════════════════════════════
            // FILOSOFÍA: Movimiento LATERAL como el océano.
            // Front/Back/Mover tienen fases diferentes (0°/120°/240°)
            // Las intensidades YA vienen calculadas con floor de 0.35
            // ═══════════════════════════════════════════════════════════════════════
            frontIntensity = Math.min(0.85, this.chillOverrides.front * brightMod);
            backIntensity = Math.min(0.85, this.chillOverrides.back);
            moverIntensity = Math.min(0.85, this.chillOverrides.mover);
            // 🆕 WAVE 315.3: Log OLAS cada 15 frames (~250ms)
            if (this.frameCount % 15 === 0) {
                console.log(`[AGC TRUST 🌊CHILL] IN[F:${this.chillOverrides.front.toFixed(2)}, B:${this.chillOverrides.back.toFixed(2)}, M:${this.chillOverrides.mover.toFixed(2)}] → ` +
                    `💡 OUT[Front:${frontIntensity.toFixed(2)}, Back:${backIntensity.toFixed(2)}, Mover:${moverIntensity.toFixed(2)}] (×brightMod:${brightMod.toFixed(2)})`);
            }
            // Limpiar overrides para el próximo frame
            this.chillOverrides = null;
        }
        else {
            // LÓGICA POR DEFECTO: Techno/Rock/Chill (treble en movers, etc.)
            // 1. FRONT PARS (Bass - El Empujón)
            const isTechno = vibeContext.activeVibe.toLowerCase().includes('techno');
            const frontCeiling = isTechno ? 0.80 : 0.95;
            const compressedBass = Math.pow(bass, 1.2);
            frontIntensity = Math.min(frontCeiling, compressedBass * brightMod);
            // 2. BACK PARS (Mid/Snare - La Bofetada)
            const backRaw = Math.pow(mid, 1.5) * 1.8;
            const backGateThreshold = isTechno ? 0.10 : 0.06;
            const backGated = backRaw < backGateThreshold ? 0 : backRaw;
            backIntensity = Math.min(0.95, backGated);
            // 3. MOVERS (Treble - El Alma) - Solo para Techno/Rock
            moverIntensity = Math.min(1.0, Math.pow(treble, 2) * 1.8);
        }
        const zoneIntensities = {
            front: frontIntensity,
            back: backIntensity,
            mover: moverIntensity,
            // 🧪 WAVE 908: THE DUEL - Incluir L/R si vienen de Techno
            ...((this.technoMoverSplit) && {
                moverL: this.technoMoverSplit.moverL,
                moverR: this.technoMoverSplit.moverR
            }),
            // 🎺 WAVE 1004.1: LATINO STEREO - Incluir L/R si vienen de Latino
            ...((this.latinoMoverSplit) && {
                moverL: this.latinoMoverSplit.moverL,
                moverR: this.latinoMoverSplit.moverR
            })
        };
        // Limpiar split temporal
        delete this.technoMoverSplit;
        delete this.latinoMoverSplit; // 🎺 WAVE 1004.1
        // 🧹 WAVE 671.5: Silenced AGC TRUST spam (every 1s)
        // 👓 WAVE 276: Log AGC TRUST cada 30 frames (~1 segundo)
        // WAVE 300: Rock tiene su propio log con transientes (arriba)
        // WAVE 315: Chill tiene su propio log con breathing (arriba)
        // if (this.frameCount % 30 === 0 && physicsApplied !== 'rock' && physicsApplied !== 'chill') {
        //   const source = physicsApplied === 'latino' ? '🌴LATINO' : 
        //                  physicsApplied === 'techno' ? '⚡TECHNO' : '📡DEFAULT';
        //   console.log(`[AGC TRUST ${source}] IN[${bass.toFixed(2)}, ${mid.toFixed(2)}, ${treble.toFixed(2)}] -> 💡 OUT[Front:${frontIntensity.toFixed(2)}, Back:${backIntensity.toFixed(2)}, Mover:${moverIntensity.toFixed(2)}]`);
        // }
        // 🧠 WAVE 450: Detectar si Energy Override está activo
        const energyOverrideActive = isEnergyOverrideActive(audioMetrics.avgNormEnergy);
        this.lastOutput = {
            palette: outputPalette,
            zoneIntensities,
            isStrobeActive,
            isFlashActive,
            isSolarFlare,
            dimmerOverride,
            forceMovement,
            physicsApplied,
            energyOverrideActive,
            debugInfo,
        };
        return this.lastOutput;
    }
    /**
     * Obtiene el último estado calculado
     */
    getLastOutput() {
        return this.lastOutput;
    }
    /**
     * Estado del strobe para UI
     */
    isStrobeActive() {
        return this.lastStrobeActive;
    }
    /**
     * Estado del movimiento forzado (Latino)
     */
    isForceMovement() {
        return this.lastForceMovement;
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // MÉTODOS AUXILIARES
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Convierte ColorPalette (con HSL/hex) a RGB interno
     */
    colorPaletteToRgb(palette) {
        return {
            primary: this.hslToRgb(palette.primary.h, palette.primary.s, palette.primary.l),
            secondary: this.hslToRgb(palette.secondary.h, palette.secondary.s, palette.secondary.l),
            ambient: this.hslToRgb(palette.ambient.h, palette.ambient.s, palette.ambient.l),
            accent: this.hslToRgb(palette.accent.h, palette.accent.s, palette.accent.l),
        };
    }
    /**
     * HSL (0-1) → RGB (0-255)
     */
    hslToRgb(h, s, l) {
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        }
        else {
            const hue2rgb = (p, q, t) => {
                if (t < 0)
                    t += 1;
                if (t > 1)
                    t -= 1;
                if (t < 1 / 6)
                    return p + (q - p) * 6 * t;
                if (t < 1 / 2)
                    return q;
                if (t < 2 / 3)
                    return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255),
        };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════
let instance = null;
/**
 * Obtiene la instancia singleton de SeleneLux
 */
export function getSeleneLux(config) {
    if (!instance) {
        instance = new SeleneLux(config);
    }
    return instance;
}
/**
 * Reset para testing
 */
export function resetSeleneLux() {
    instance = null;
}
