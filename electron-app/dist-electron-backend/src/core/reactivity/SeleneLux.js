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
import { TechnoStereoPhysics, technoStereoPhysics, // 🎸 WAVE 1011.5: UNIFIED ARCHITECTURE (Lobotomized)
rockPhysics2, // 🎸 WAVE 1011.5: Singleton instance
LatinoStereoPhysics, calculateChillStereo, laserPhysics, washerPhysics, } from '../../hal/physics';
import { isEnergyOverrideActive, } from '../protocol/ConsciousnessOutput';
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
        // � WAVE 1011: HIGH VOLTAGE ROCK - Overrides con L/R split para Movers
        this.rockOverrides = null;
        // 🆕 WAVE 315: CHILL BREATHING - Overrides de bioluminiscencia
        // 🔥 WAVE 1032.9: Agregado moverL/moverR para burbujas independientes
        // 🌊 WAVE 1035: 7-ZONE STEREO - Front/Back L/R para oscilación lateral
        // 🌌 WAVE 1044: THE DEEP FIELD - Air zone para futuro láser cósmico
        this.chillOverrides = null;
        // ═══════════════════════════════════════════════════════════════════════
        // 🔧 WAVE 1046: THE MECHANICS BYPASS - Movement coordinates from physics
        // 🌊 WAVE 1072: colorOverride REMOVED - now uses oceanicModulation
        // ═══════════════════════════════════════════════════════════════════════
        this.deepFieldMechanics = null;
        // ═══════════════════════════════════════════════════════════════════════
        // 🌊 WAVE 1070.6: THE LIVING OCEAN - Oceanic Creature Triggers
        // 🎭 WAVE 1074: MICRO-FAUNA INTEGRATION - Extended with 4 ambient fillers
        // ═══════════════════════════════════════════════════════════════════════
        this.oceanicTriggersState = null;
        // ═══════════════════════════════════════════════════════════════════════
        // 🌊 WAVE 1072: THE OCEAN TRANSLATOR - Oceanic Musical Context
        // Permite a SeleneColorEngine modular paletas basándose en profundidad
        // ═══════════════════════════════════════════════════════════════════════
        this.oceanicContextState = null;
        // ═══════════════════════════════════════════════════════════════════════
        // 🟢🎨 WAVE 1031: THE PHOTON WEAVER - Spectral Band Physics State
        // ═══════════════════════════════════════════════════════════════════════
        // 🟢 LASER: Intensidad y metadata del último frame
        this.laserResult = null;
        // 🎨 WASHER: Intensidad y metadata del último frame
        this.washerResult = null;
        this.debug = config.debug ?? false;
        // Inicializar físicas stateful
        this.latinoPhysics = new LatinoStereoPhysics();
        // 🟢 WAVE 1043.2: Chill is stateless functional
        // 🎸 WAVE 1011: RockStereoPhysics2 usa singleton (rockPhysics2)
        // ❌ BORRADO: this.rockPhysics = new RockStereoPhysics() (legacy Frankenstein)
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
            // 🔥 WAVE 1012: TECHNO NEEDS SPECTRAL DATA!
            // Sin harshness/flatness, Techno opera en modo degradado (acidMode=false, noiseMode=false)
            // Esto mata el atmosphericFloor y el Apocalypse Detection
            const zonesResult = technoStereoPhysics.applyZones({
                bass: audioMetrics.normalizedBass,
                mid: audioMetrics.normalizedMid,
                treble: audioMetrics.normalizedTreble,
                bpm: vibeContext.bpm ?? 120,
                melodyThreshold: 0.4,
                isRealSilence: audioMetrics.avgNormEnergy < 0.01,
                isAGCTrap: false,
                sectionType: vibeContext.section,
                // 🎛️ WAVE 1012: Métricas espectrales para Acid/Noise modes
                harshness: audioMetrics.harshness ?? 0.45, // Default más agresivo que Rock (Techno = duro)
                flatness: audioMetrics.spectralFlatness ?? 0.35 // Default para pads/atmos
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
            // ═══════════════════════════════════════════════════════════════════════
            // 🎸 WAVE 1011.5: UNIFIED ROCK PHYSICS (LOBOTOMIZED)
            // ═══════════════════════════════════════════════════════════════════════
            // ARQUITECTURA UNIFICADA - Sin subgéneros, modulación lineal:
            //   - Front: Low-Mid (guitar/bass fundamentals)
            //   - Back: Sub-Bass + harshness modulation (atmospheric depth)
            //   - MoverLeft: High-Mid (guitar crunch)
            //   - MoverRight: Presence (cymbal attacks, harmonics)
            // 
            // MODULADORES LINEALES:
            //   - harshness: Modula ganancia BackPar
            //   - flatness: Modula spread de Movers
            //   - centroidHz: Modula velocidad de decay
            // ═══════════════════════════════════════════════════════════════════════
            // Construir contexto para RockStereoPhysics2
            // 🔥 WAVE 1011.7: VITAMINAS PARA LOS PARS
            // Las bandas detalladas vienen muy atenuadas, usar bass/mid/treble directos
            const rockContext = {
                // Bandas tradicionales - USAR DIRECTAMENTE, sin atenuar
                bass: audioMetrics.normalizedBass,
                lowMid: audioMetrics.normalizedBass * 0.5 + audioMetrics.normalizedMid * 0.5, // Mix gordo
                mid: audioMetrics.normalizedMid,
                highMid: audioMetrics.normalizedMid * 0.6 + audioMetrics.normalizedTreble * 0.4, // Mix crujiente
                treble: audioMetrics.normalizedTreble,
                subBass: audioMetrics.normalizedBass * 0.9, // Sub-bass = casi todo el bass
                // Métricas espectrales (con fallbacks conservadores)
                harshness: audioMetrics.harshness ?? 0.35,
                spectralFlatness: audioMetrics.spectralFlatness ?? 0.40,
                spectralCentroid: audioMetrics.spectralCentroid ?? 1500,
                // 🎭 WAVE 1018: Clarity for PROG ROCK detection
                clarity: audioMetrics.clarity ?? 0.85,
                // Transientes detectados
                kickDetected: audioMetrics.kickDetected ?? false,
                snareDetected: audioMetrics.snareDetected ?? false,
                hihatDetected: audioMetrics.hihatDetected ?? false,
                bpm: vibeContext.bpm ?? 120,
            };
            // 🎸 Usar singleton de RockStereoPhysics2 (UNIFIED)
            const rockResult = rockPhysics2.applyZones(rockContext);
            // Guardar overrides con L/R split
            this.rockOverrides = {
                front: rockResult.front,
                back: rockResult.back,
                moverLeft: rockResult.moverLeft,
                moverRight: rockResult.moverRight,
                subgenre: rockResult.subgenre, // Siempre 'ROCK' ahora
            };
            // No hay cambio de paleta en Rock (usamos la entrada)
            // outputPalette permanece igual
            isFlashActive = false; // Rock no usa flash binario, usa física analógica
            physicsApplied = 'rock';
            // Debug info con el nuevo formato
            debugInfo = {
                front: rockResult.front,
                back: rockResult.back,
                moverL: rockResult.moverLeft,
                moverR: rockResult.moverRight,
                subgenre: rockResult.subgenre,
            };
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
            // � WAVE 1044: THE DEEP FIELD - Chill Lounge Generative Ecosystem
            // ═══════════════════════════════════════════════════════════════════════
            // 5 ORGANISMOS INDEPENDIENTES:
            // 1. THE BREATHING FLOOR - Ondas Fibonacci (Front/Back L/R)
            // 2. THE DRIFTING PLANKTON - Sparkles con números primos
            // 3. THE CELESTIAL MOVERS - Lissajous + Zodiac modulation
            // 4. THE TIDE SURGE - Evento raro cada 5-8 minutos
            // 5. THE CHROMATIC MIGRATION - Colores que fluyen
            // ═══════════════════════════════════════════════════════════════════════
            const now = Date.now() / 1000; // Continuous time in seconds
            // 🌊 WAVE 1070.6: Build GodEar metrics for oceanic physics
            const godEarMetrics = {
                clarity: audioMetrics.clarity ?? 0.5,
                spectralFlatness: audioMetrics.spectralFlatness ?? 0.5,
                centroid: audioMetrics.spectralCentroid ?? 800,
                // 🐟 Transient density: kick+snare+hihat + energy boost
                transientDensity: ((audioMetrics.kickDetected ? 0.4 : 0) +
                    (audioMetrics.snareDetected ? 0.35 : 0) +
                    (audioMetrics.hihatDetected ? 0.25 : 0)) *
                    (0.6 + audioMetrics.avgNormEnergy * 0.6),
                // 🐋 Bass energy: normalizedBass para whaleSong
                bassEnergy: audioMetrics.normalizedBass ?? 0,
                bass: audioMetrics.normalizedBass ?? 0,
            };
            const result = calculateChillStereo(now, audioMetrics.avgNormEnergy, // Nutriente (modula velocidad, no dispara)
            audioMetrics.normalizedTreble, // Air/Plankton probability modulator
            audioMetrics.kickDetected ?? false, // Subtle surge boost
            godEarMetrics, // 🌊 WAVE 1070: GodEar metrics for oceanic triggers
            vibeContext.bpm ?? 60 // 🩰 WAVE 1102: BPM para Elastic Time
            );
            // 🔍 LOG THE DEEP FIELD DEBUG INFO (Solo si hay cambio de profundidad >500m)
            if (result.debug.includes('[DEPTH CHANGE]')) {
                console.log(`[🌊 THE DEEP FIELD] ${result.debug}`);
            }
            // La paleta NO se modifica (respetamos TitanEngine/SeleneColorEngine)
            outputPalette = inputPalette;
            dimmerOverride = 0.75; // Chill ambiental (cocktail sunset)
            forceMovement = true; // Celestial Movers activos
            physicsApplied = 'chill'; // 🔧 CRITICAL: Must set this for AGC TRUST to apply overrides
            // Store calculated physics in overrides
            this.chillOverrides = {
                front: (result.frontL + result.frontR) / 2, // Legacy fallback
                back: (result.backL + result.backR) / 2, // Legacy fallback
                mover: (result.moverL.intensity + result.moverR.intensity) / 2, // Legacy fallback
                // 🫧 WAVE 1032.9: Independent Bubbles
                moverL: result.moverL.intensity,
                moverR: result.moverR.intensity,
                // � WAVE 1044: Full 7-Zone Stereo Ecosystem
                frontL: result.frontL,
                frontR: result.frontR,
                backL: result.backL,
                backR: result.backR,
                // 🔦 AIR zone (future lasers)
                air: result.airIntensity,
            };
            // ═══════════════════════════════════════════════════════════════════════
            // 🔧 WAVE 1046: THE MECHANICS BYPASS - Movement coordinates only
            // 🌊 WAVE 1072: colorOverride REMOVED - now uses oceanicModulation in SeleneColorEngine
            // ═══════════════════════════════════════════════════════════════════════
            this.deepFieldMechanics = {
                moverL: { pan: result.moverL.pan, tilt: result.moverL.tilt, intensity: result.moverL.intensity },
                moverR: { pan: result.moverR.pan, tilt: result.moverR.tilt, intensity: result.moverR.intensity },
                // colorOverride: DEPRECATED - ocean colors now flow through SeleneColorEngine
            };
            // ═══════════════════════════════════════════════════════════════════════
            // 🌊 WAVE 1070: THE LIVING OCEAN - Store Oceanic Triggers
            // These will be dispatched to EffectManager by TitanEngine
            // ═══════════════════════════════════════════════════════════════════════
            this.oceanicTriggersState = result.oceanicTriggers;
            // ═══════════════════════════════════════════════════════════════════════
            // 🌊 WAVE 1072: THE OCEAN TRANSLATOR - Store Oceanic Musical Context
            // This allows SeleneColorEngine to modulate palettes based on depth
            // ═══════════════════════════════════════════════════════════════════════
            this.oceanicContextState = result.oceanicContext;
            // Pass movement data for Celestial Movers
            debugInfo = {
                internalDebug: result.debug,
                panL: result.moverL.pan,
                tiltL: result.moverL.tilt,
                panR: result.moverR.pan,
                tiltR: result.moverR.tilt,
                // 🌌 Deep Field ecosystem debug
                ecosystem: 'THE_DEEP_FIELD'
            };
        } // Guardar estado
        // ═══════════════════════════════════════════════════════════════════════
        // 🟢🎨 WAVE 1031: THE PHOTON WEAVER - Spectral Band Routing
        // ═══════════════════════════════════════════════════════════════════════
        // ARQUITECTURA ESPECTRAL COMPLETA:
        // - Sub-Graves (Washers) = Sentimiento/Atmósfera (subBass 20-60Hz)
        // - Medios (Movers/PARs) = Ritmo/Baile (ya procesado por género)
        // - Ultra-Agudos (Láseres) = Detalle/Tecnología (ultraAir 16-22kHz)
        // 
        // Estos motores corren SIEMPRE, independientemente del género.
        // La física espectral es UNIVERSAL - todos los vibes tienen láseres y washers.
        // ═══════════════════════════════════════════════════════════════════════
        // 🟢 LASER PHYSICS: UltraAir (16-22kHz) → Láseres
        // Los láseres responden a las frecuencias que los humanos CASI NO OYEN
        const laserInput = {
            ultraAir: audioMetrics.ultraAir ?? 0,
            clarity: audioMetrics.clarity ?? 0.5,
            texture: audioMetrics.texture ?? 'clean',
            lowMid: audioMetrics.lowMid ?? audioMetrics.normalizedMid * 0.5,
            energy: audioMetrics.avgNormEnergy,
            bpm: vibeContext.bpm,
        };
        const laserOutput = laserPhysics.apply(laserInput);
        this.laserResult = {
            intensity: laserOutput.intensity,
            mode: laserOutput.mode,
            beamWidth: laserOutput.beamWidth,
            scanSpeed: laserOutput.scanSpeed,
            safetyTriggered: laserOutput.safetyTriggered,
        };
        // 🎨 WASHER PHYSICS: SubBass (20-60Hz) → Washers/Barras LED
        // Los washers responden donde la música se SIENTE, no se oye
        const washerInput = {
            subBass: audioMetrics.subBass ?? audioMetrics.normalizedBass * 0.8,
            texture: audioMetrics.texture ?? 'warm',
            energy: audioMetrics.avgNormEnergy,
            bass: audioMetrics.normalizedBass,
            clarity: audioMetrics.clarity,
            bpm: vibeContext.bpm,
        };
        const washerOutput = washerPhysics.apply(washerInput);
        this.washerResult = {
            intensity: washerOutput.intensity,
            mode: washerOutput.mode,
            colorTransitionSpeed: washerOutput.colorTransitionSpeed,
            impactActive: washerOutput.impactActive,
            breathingFactor: washerOutput.breathingFactor,
        };
        // Log cada 60 frames (~1 segundo) si hay actividad significativa
        if (this.frameCount % 60 === 0 && (laserOutput.intensity > 0.1 || washerOutput.intensity > 0.3)) {
            console.log(`[SeleneLux 🟢🎨 PHOTON WEAVER] ` +
                `Laser:${laserOutput.mode}(${(laserOutput.intensity * 100).toFixed(0)}%) | ` +
                `Washer:${washerOutput.mode}(${(washerOutput.intensity * 100).toFixed(0)}%) | ` +
                `Safety:${laserOutput.safetyTriggered ? '⚠️TRIGGERED' : '✅OK'}`);
        }
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
            // 🔧 WAVE 1049: NO limpiar overrides - se sobrescriben en próximo tick
            // this.latinoOverrides = null;
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
            // 🔧 WAVE 1049: NO limpiar overrides - se sobrescriben en próximo tick
            // this.technoOverrides = null;
        }
        else if (this.rockOverrides && physicsApplied === 'rock') {
            // ═══════════════════════════════════════════════════════════════════════
            // 🎸 WAVE 1011: HIGH VOLTAGE ROCK - 4 Bandas con L/R Split
            // ═══════════════════════════════════════════════════════════════════════
            // Front: Kicks + SubBass (The Pulse)
            // Back: Snares + Harsh Guitars (The Power)
            // MoverL: Body/Riffs/Wall of Sound (The Body)
            // MoverR: Solos/Platos/Shine (The Shine)
            // ═══════════════════════════════════════════════════════════════════════
            frontIntensity = Math.min(0.95, this.rockOverrides.front * brightMod);
            backIntensity = Math.min(0.95, this.rockOverrides.back);
            // Legacy fallback: promedio de L/R para compatibilidad
            moverIntensity = Math.min(1.0, (this.rockOverrides.moverLeft + this.rockOverrides.moverRight) / 2);
            // 🎸 WAVE 1011: Guardar L/R split para el output
            const rockL = this.rockOverrides.moverLeft; // The Body (riffs)
            const rockR = this.rockOverrides.moverRight; // The Shine (solos)
            // Temporal: guardar en una variable para pasar al output
            this.rockMoverSplit = { moverL: rockL, moverR: rockR };
            // 🎸 WAVE 1011: Log HIGH VOLTAGE cada 30 frames con subgénero
            if (this.frameCount % 30 === 0) {
                console.log(`[AGC TRUST 🎸HIGH VOLTAGE] Subgenre:${this.rockOverrides.subgenre.toUpperCase()} | ` +
                    `IN[B:${bass.toFixed(2)}, M:${mid.toFixed(2)}, T:${treble.toFixed(2)}] → ` +
                    `💡 OUT[F:${frontIntensity.toFixed(2)}, Bk:${backIntensity.toFixed(2)}, ML:${rockL.toFixed(2)}, MR:${rockR.toFixed(2)}]`);
            }
            // 🔧 WAVE 1049: NO limpiar overrides - se sobrescriben en próximo tick
            // this.rockOverrides = null;
        }
        else if (this.chillOverrides && physicsApplied === 'chill') {
            // ═══════════════════════════════════════════════════════════════════════
            // 🌊 WAVE 315.3: CHILL - El Techno Pacífico (Olas Desfasadas)
            // 🔥 WAVE 1032.8: BUBBLE FREEDOM - Removido ceiling 0.85 para permitir burbujas brillantes
            // 🫧 WAVE 1032.9: BUBBLE L/R SPLIT - Movers independientes como Rock/Latino
            // 🌊 WAVE 1035: 7-ZONE STEREO - Front/Back L/R split para oscilación lateral
            // ═══════════════════════════════════════════════════════════════════════
            // FILOSOFÍA: Movimiento LATERAL como el océano.
            // Front/Back/MoverL/MoverR con burbujas independientes
            // 🫧 BURBUJAS: Pueden alcanzar 1.0 gracias al bypass POST-AGC
            // 🌊 WAVE 1035: Marea cruzada - cuando FrontL sube, FrontR baja ligeramente
            // ═══════════════════════════════════════════════════════════════════════
            frontIntensity = Math.min(1.0, this.chillOverrides.front * brightMod);
            backIntensity = Math.min(1.0, this.chillOverrides.back);
            // 🫧 WAVE 1032.9: Usar moverL/moverR individuales (burbujas independientes)
            const chillL = Math.min(1.0, this.chillOverrides.moverL);
            const chillR = Math.min(1.0, this.chillOverrides.moverR);
            moverIntensity = Math.min(1.0, (chillL + chillR) / 2); // Promedio para legacy
            // 🫧 WAVE 1032.9: Guardar split L/R para incluir en zoneIntensities
            this.chillMoverSplit = {
                moverL: chillL,
                moverR: chillR
            };
            // � WAVE 1035: 7-ZONE STEREO - Front/Back L/R split
            // Extraer las nuevas zonas stereo del chillOverrides
            const chillFrontL = this.chillOverrides.frontL ?? frontIntensity;
            const chillFrontR = this.chillOverrides.frontR ?? frontIntensity;
            const chillBackL = this.chillOverrides.backL ?? backIntensity;
            const chillBackR = this.chillOverrides.backR ?? backIntensity;
            // Guardar stereo split para incluir en zoneIntensities
            this.chillStereoSplit = {
                frontL: chillFrontL,
                frontR: chillFrontR,
                backL: chillBackL,
                backR: chillBackR,
            };
            // �🆕 WAVE 315.3: Log OLAS cada 15 frames (~250ms)
            // 🫧 WAVE 1032.9: Mostrar L/R individuales
            // 🌊 WAVE 1035: Mostrar 7-zone stereo
            if (this.frameCount % 15 === 0) {
                console.log(`[AGC TRUST 🌊CHILL 7Z] FL:${chillFrontL.toFixed(2)} FR:${chillFrontR.toFixed(2)} | ` +
                    `BL:${chillBackL.toFixed(2)} BR:${chillBackR.toFixed(2)} | ` +
                    `ML:${chillL.toFixed(2)} MR:${chillR.toFixed(2)}`);
            }
            // 🔧 WAVE 1049: NO limpiar overrides aquí - se sobrescriben en próximo tick de Chill
            // Esto permite que el bloque "else if (this.chillOverrides ...)" funcione correctamente
            // this.chillOverrides = null;  ← REMOVED - was causing overrides to disappear
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
            }),
            // 🎸 WAVE 1011: HIGH VOLTAGE ROCK - Incluir L/R si vienen de Rock
            ...((this.rockMoverSplit) && {
                moverL: this.rockMoverSplit.moverL,
                moverR: this.rockMoverSplit.moverR
            }),
            // 🫧 WAVE 1032.9: BUBBLE L/R SPLIT - Incluir L/R si vienen de Chill
            ...((this.chillMoverSplit) && {
                moverL: this.chillMoverSplit.moverL,
                moverR: this.chillMoverSplit.moverR
            }),
            // 🌊 WAVE 1035: 7-ZONE STEREO - Front/Back L/R si vienen de Chill
            ...((this.chillStereoSplit) && {
                frontL: this.chillStereoSplit.frontL,
                frontR: this.chillStereoSplit.frontR,
                backL: this.chillStereoSplit.backL,
                backR: this.chillStereoSplit.backR,
            }),
            // ═══════════════════════════════════════════════════════════════════════
            // 🟢🎨 WAVE 1031: THE PHOTON WEAVER - Spectral Band Zones
            // ═══════════════════════════════════════════════════════════════════════
            // Estas intensidades vienen de los nuevos motores espectrales.
            // Son INDEPENDIENTES del género - la física espectral es universal.
            // ═══════════════════════════════════════════════════════════════════════
            laser: this.laserResult?.intensity ?? 0,
            washer: this.washerResult?.intensity ?? 0.15, // Floor mínimo para washers
        };
        // Limpiar split temporal
        delete this.technoMoverSplit;
        delete this.latinoMoverSplit; // 🎺 WAVE 1004.1
        delete this.rockMoverSplit; // 🎸 WAVE 1011
        delete this.chillMoverSplit; // 🫧 WAVE 1032.9
        delete this.chillStereoSplit; // 🌊 WAVE 1035: 7-ZONE STEREO
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
            // 🟢🎨 WAVE 1031: THE PHOTON WEAVER - Extended physics metadata
            laserPhysics: this.laserResult ? {
                mode: this.laserResult.mode,
                beamWidth: this.laserResult.beamWidth,
                scanSpeed: this.laserResult.scanSpeed,
                safetyTriggered: this.laserResult.safetyTriggered,
            } : undefined,
            washerPhysics: this.washerResult ? {
                mode: this.washerResult.mode,
                colorTransitionSpeed: this.washerResult.colorTransitionSpeed,
                impactActive: this.washerResult.impactActive,
                breathingFactor: this.washerResult.breathingFactor,
            } : undefined,
            // ═══════════════════════════════════════════════════════════════════════
            // 🔧 WAVE 1046: THE MECHANICS BYPASS - Movement only
            // 🌊 WAVE 1072: colorOverride REMOVED from mechanics
            // ═══════════════════════════════════════════════════════════════════════
            mechanics: this.deepFieldMechanics ? {
                moverL: this.deepFieldMechanics.moverL,
                moverR: this.deepFieldMechanics.moverR,
                // colorOverride: DEPRECATED in WAVE 1072 - flows through SeleneColorEngine now
                source: 'THE_DEEP_FIELD',
            } : undefined,
            // ═══════════════════════════════════════════════════════════════════════
            // 🌊 WAVE 1070: THE LIVING OCEAN - Oceanic Creature Triggers
            // ═══════════════════════════════════════════════════════════════════════
            oceanicTriggers: this.oceanicTriggersState ?? undefined,
            // ═══════════════════════════════════════════════════════════════════════
            // 🌊 WAVE 1072: THE OCEAN TRANSLATOR - Oceanic Musical Context
            // Allows SeleneColorEngine to modulate based on oceanic depth/zone
            // ═══════════════════════════════════════════════════════════════════════
            oceanicContext: this.oceanicContextState ?? undefined,
            debugInfo,
        };
        // Clear deepFieldMechanics for next frame
        this.deepFieldMechanics = null;
        // 🌊 WAVE 1073.8: NO limpiar oceanicTriggers - se sobrescriben naturalmente
        // El problema era que se limpiaban ANTES de que TitanEngine los leyera
        // this.oceanicTriggersState = null;  // ❌ COMENTADO
        // 🌊 WAVE 1072: oceanicContext NO necesita limpiarse tampoco
        // this.oceanicContextState = null;   // ❌ COMENTADO
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
