/**
 * 🏛️ WAVE 215: HARDWARE ABSTRACTION FACADE
 *
 * The "Grand Connector" - The single entry point to all hardware.
 *
 * COMPOSITION:
 * - PhysicsEngine: Decay, inertia, hysteresis
 * - ZoneRouter: Zone-to-fixture mapping
 * - FixtureMapper: Intent-to-DMX conversion
 * - Driver: USB/ArtNet/Mock output
 *
 * MASTER METHOD: render(intent, fixtures)
 * Orchestrates the complete pipeline:
 * 1. Router → Determine which fixtures respond
 * 2. Physics → Apply decay/inertia
 * 3. Mapper → Convert to fixture states
 * 4. Driver → Send DMX
 *
 * 🐟 WAVE 2042.20: BABEL FISH - Color Translation Layer
 * - ColorTranslator integration in renderFromTarget()
 * - Automatic RGB → ColorWheel DMX translation
 * - Profile-based detection of wheel fixtures
 * - Safety layer for debounce/strobe delegation
 *
 * @layer HAL
 * @version TITAN 2.0 + BABEL FISH
 */
import { hslToRgb, createEmptyUniverse, } from '../core/protocol';
import { PhysicsEngine } from './physics/PhysicsEngine';
import { ZoneRouter } from './mapping/ZoneRouter';
import { FixtureMapper } from './mapping/FixtureMapper';
import { MockDMXDriver } from './drivers';
// � WAVE 2042.20: BABEL FISH - Color Translation Layer
import { getColorTranslator } from './translation/ColorTranslator';
import { getProfile, getProfileByModel, needsColorTranslation } from './translation';
import { getHardwareSafetyLayer } from './translation/HardwareSafetyLayer';
// �🔧 WAVE 338: Movement Physics Driver
import { FixturePhysicsDriver } from '../engine/movement/FixturePhysicsDriver';
import { getOpticsConfig } from '../engine/movement/VibeMovementPresets';
// ═══════════════════════════════════════════════════════════════════════════
// HARDWARE ABSTRACTION CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class HardwareAbstraction {
    constructor(config = {}) {
        this.currentVibeId = 'idle';
        // � WAVE 2042.20: BABEL FISH - Color Translation Singletons
        this.colorTranslator = getColorTranslator();
        this.safetyLayer = getHardwareSafetyLayer();
        this.profileCache = new Map();
        // �🔧 WAVE 340.2: Smoothed optics state (evita saltos bruscos)
        this.smoothedZoomMod = 0;
        this.smoothedFocusMod = 0;
        // State
        this.framesRendered = 0;
        this.lastRenderTime = 0;
        this.renderTimes = [];
        this.universeBuffers = new Map();
        this.lastFixtureStates = [];
        this.lastDebugTime = 0; // WAVE 256.7: For throttled debug logging
        // 🏎️ WAVE 2074.2: Real deltaTime measurement for physics
        this.lastPhysicsFrameTime = 0;
        // Current vibe preset (for physics)
        // 🔥 WAVE 279.5: HEART vs SLAP - Filosofía de zonas
        // FRONT PARS (Bass/Heart): bom bom bom - presión en el pecho, no agresivo
        // BACK PARS (Mid/Snare): PAF! - bofetada en la cara, explosivo
        // 🎚️ WAVE 287: TECHNO BASS GATE - Subir gate para ignorar bass constante
        //    El techno tiene bass 24/7, necesitamos reaccionar solo a KICKS reales
        this.currentPreset = {
            parGate: 0.15, // 🎚️ WAVE 287: Subido (era 0.08) - ignora bass de fondo
            parGain: 2.5, // 🎚️ WAVE 287: Bajado (era 3.5) - menos saturación
            parMax: 0.78, // Heart: techo limitado (dejar espacio a backs)
            backParGate: 0.15, // Slap: ignora ruido de fondo
            backParGain: 2.8, // Slap: ganancia para rango dinámico
            backParMax: 1.0, // Slap: ¡BOFETADA COMPLETA! PAF!
            melodyThreshold: 0.10, // Movers: activan fácil con melodía
            decaySpeed: 2,
            moverDecaySpeed: 3,
        };
        // ═══════════════════════════════════════════════════════════════════════
        // 🐍 WAVE 340.1 PASO 2: PHASE OFFSET (SNAKE FORMULA)
        // Convierte soldados sincronizados en bailarines desfasados
        // ═══════════════════════════════════════════════════════════════════════
        /**
         * Configuración de phase offset por vibe
         * Cada vibe tiene su estilo de desfase
         */
        this.PHASE_CONFIGS = {
            'techno-club': { offset: Math.PI, type: 'mirror' }, // Alternado par/impar
            'fiesta-latina': { offset: Math.PI / 4, type: 'snake' }, // 45° cadena de caderas
            'pop-rock': { offset: Math.PI / 3, type: 'snake' }, // 60° wall ondulante
            'chill-lounge': { offset: Math.PI / 2, type: 'snake' }, // 90° ola de mar lenta
            'idle': { offset: 0, type: 'sync' }, // Sin movimiento
        };
        this.config = {
            driverType: config.driverType ?? 'mock',
            installationType: config.installationType ?? 'floor',
            debug: config.debug ?? true,
            externalDriver: config.externalDriver,
        };
        // Instantiate composed modules
        this.physics = new PhysicsEngine();
        this.router = new ZoneRouter();
        this.mapper = new FixtureMapper();
        // 🔧 WAVE 338: Movement Physics Driver
        this.movementPhysics = new FixturePhysicsDriver();
        this.currentOptics = getOpticsConfig('idle');
        // 🎨 WAVE 686.10: Use external driver if provided, otherwise create one
        this.driver = this.config.externalDriver ?? this.createDriver(this.config.driverType);
        // Configure mapper
        this.mapper.setInstallationType(this.config.installationType);
        // Initialize universe 1 (extract Uint8Array from DMXUniverse)
        this.universeBuffers.set(1, createEmptyUniverse(1).channels);
        console.log('[HAL] 🏛️ HardwareAbstraction initialized (WAVE 215)');
        console.log(`[HAL]    Driver: ${this.config.driverType}`);
        console.log(`[HAL]    Installation: ${this.config.installationType}`);
    }
    /**
     * 🐍 Aplica phase offset por fixture para crear efecto serpiente
     * @param baseX - Posición X base del Engine (0-1)
     * @param baseY - Posición Y base del Engine (0-1)
     * @param pattern - Patrón de movimiento activo
     * @param fixtureIndex - Índice del fixture (para calcular offset)
     * @param zone - Zona del fixture (para mirror: MOVING_LEFT vs MOVING_RIGHT)
     * @param timeSeconds - Tiempo actual en segundos
     * @param bpm - BPM actual para frecuencia
     * @param phaseType - 🔧 WAVE 350: 'linear' = bypass, 'polar' = rotar (default)
     * @returns Posición modificada con phase offset
     */
    applyPhaseOffset(baseX, baseY, pattern, fixtureIndex, zone, timeSeconds, bpm, phaseType = 'polar') {
        // 🔧 WAVE 350: LINEAR BYPASS
        // Si phaseType === 'linear', el patrón ya aplicó desfase internamente
        if (phaseType === 'linear') {
            if (fixtureIndex === 0 && this.framesRendered % 30 === 0) {
                const inPan = Math.round((baseX - 0.5) * 540);
                const inTilt = Math.round((baseY - 0.5) * 270);
                console.log(`[🔬 LINEAR BYPASS] Pan:${inPan}° Tilt:${inTilt}° | Pattern:${pattern}`);
            }
            return { x: baseX, y: baseY };
        }
        const config = this.PHASE_CONFIGS[this.currentVibeId] || { offset: 0, type: 'sync' };
        // Si es sync, devolver posición sin modificar
        if (config.type === 'sync') {
            return { x: baseX, y: baseY };
        }
        // ═══════════════════════════════════════════════════════════════════════
        // 🔧 WAVE 341.4: PHASE OFFSET CORRECTO
        // 
        // ANTES: HAL recalculaba el pattern entero (duplicando trabajo de TitanEngine)
        // AHORA: HAL solo aplica un desfase TEMPORAL al movimiento base
        // 
        // La idea es que TitanEngine calcula "dónde debería estar el mover AHORA"
        // y HAL aplica un offset de tiempo para que cada mover esté en un punto
        // DIFERENTE de la misma trayectoria (efecto snake)
        // ═══════════════════════════════════════════════════════════════════════
        // Calcular phase offset basado en fixture index
        const phaseOffset = fixtureIndex * config.offset;
        const freq = Math.max(60, bpm) / 120;
        // Amplitud desde la posición base (distancia al centro) - SIN reducir!
        const amplitudeX = baseX - 0.5; // -0.5 a +0.5 (lo que TitanEngine generó)
        const amplitudeY = baseY - 0.5;
        // Magnitud del movimiento (para preservar la amplitud original)
        const magnitude = Math.sqrt(amplitudeX * amplitudeX + amplitudeY * amplitudeY);
        // ═══════════════════════════════════════════════════════════════════════
        // 🔍 DEBUG WAVE 341.5: Log SÍNCRONO con TitanEngine (cada 30 frames)
        // ═══════════════════════════════════════════════════════════════════════
        const shouldLog = fixtureIndex === 0 && this.framesRendered % 30 === 0;
        if (shouldLog) {
            const inPan = Math.round((baseX - 0.5) * 540);
            const inTilt = Math.round((baseY - 0.5) * 270);
            console.log(`[🔬 PHASE IN] Pan:${inPan}° Tilt:${inTilt}° | Pattern:${pattern} | Mag:${magnitude.toFixed(3)}`);
        }
        // Si no hay movimiento, devolver centro
        if (magnitude < 0.01) {
            return { x: 0.5, y: 0.5 };
        }
        // Para patterns sinusoidales (wave, figure8, circle, sweep)
        // Solo aplicamos un offset TEMPORAL, no recalculamos la trayectoria
        switch (pattern) {
            // ═══════════════════════════════════════════════════════════════════
            // 🌊 WAVE, 💃 FIGURE8, 💫 CIRCLE, SWEEP: 
            // Mismo principio: desfase temporal, preservar amplitud de TitanEngine
            // ═══════════════════════════════════════════════════════════════════
            case 'wave':
            case 'figure8':
            case 'circle':
            case 'sweep':
                // En vez de recalcular el sin/cos, aplicamos el offset como rotación
                // de la posición alrededor del centro
                const angle = Math.atan2(amplitudeY, amplitudeX); // Ángulo actual
                const phaseAngle = phaseOffset; // Offset en radianes
                // Rotar la posición por el phase offset
                const newAngle = angle + phaseAngle;
                const resultX = 0.5 + Math.cos(newAngle) * magnitude;
                const resultY = 0.5 + Math.sin(newAngle) * magnitude;
                // 🔍 DEBUG WAVE 341.5: Log salida SÍNCRONO
                if (shouldLog) {
                    const outPan = Math.round((resultX - 0.5) * 540);
                    const outTilt = Math.round((resultY - 0.5) * 270);
                    console.log(`[🔬 PHASE OUT] Pan:${outPan}° Tilt:${outTilt}° | Δ=${Math.round((resultX - baseX) * 540)}° (fixture 0 should be 0)`);
                }
                return { x: resultX, y: resultY };
            // ═══════════════════════════════════════════════════════════════════
            // 🏃 CHASE: Persecución láser (offset grande)
            // ═══════════════════════════════════════════════════════════════════
            case 'chase':
                const chasePhase = fixtureIndex * (Math.PI / 2); // 90° entre fixtures
                // Para chase, sí recalculamos X pero preservamos el rango de TitanEngine
                return {
                    x: 0.5 + Math.sin(timeSeconds * Math.PI * 2 * freq * 2 + chasePhase) * Math.abs(amplitudeX),
                    y: baseY // Tilt sigue el valor base (bass)
                };
            // ═══════════════════════════════════════════════════════════════════
            // 🪞 MIRROR: Puertas del infierno techno
            // MOVING_LEFT y MOVING_RIGHT se mueven en direcciones opuestas (SOLO PAN)
            // TILT es el mismo para ambos (búsqueda + bass punch)
            // ═══════════════════════════════════════════════════════════════════
            case 'mirror':
                // Determinar si es izquierda o derecha basado en zona
                const isLeftZone = zone.includes('LEFT') || zone.includes('left');
                const isRightZone = zone.includes('RIGHT') || zone.includes('right');
                // Si no es zona de mover, usar par/impar
                let mirrorSign = 1;
                if (isLeftZone) {
                    mirrorSign = 1; // LEFT mantiene dirección original
                }
                else if (isRightZone) {
                    mirrorSign = -1; // RIGHT invierte PAN
                }
                else {
                    // Fallback: par/impar
                    mirrorSign = fixtureIndex % 2 === 0 ? 1 : -1;
                }
                // 🔍 DEBUG: Log mirror logic (once per second)
                if (fixtureIndex < 2 && this.framesRendered % 30 === 0) {
                    const finalX = 0.5 + amplitudeX * mirrorSign;
                    console.log(`[🪞 MIRROR] Fixture ${fixtureIndex} | Zone: "${zone}" | Sign=${mirrorSign} | baseX=${baseX.toFixed(3)} baseY=${baseY.toFixed(3)} → x=${finalX.toFixed(3)} y=${baseY.toFixed(3)}`);
                }
                // 🔥 WAVE 342.8: Solo invertir PAN (horizontal)
                // TILT es compartido (ambos apuntan al mismo nivel vertical)
                // Esto crea el efecto de puertas que se abren/cierran horizontalmente
                return {
                    x: 0.5 + amplitudeX * mirrorSign, // PAN invertido para espejo
                    y: baseY // TILT compartido
                };
            // ═══════════════════════════════════════════════════════════════════
            // 🧘 STATIC: Respiración con phase offset sutil
            // ═══════════════════════════════════════════════════════════════════
            case 'static':
                const breathPhase = fixtureIndex * (Math.PI / 3); // 60° offset
                return {
                    x: baseX,
                    y: 0.5 + Math.sin(timeSeconds * Math.PI * 0.2 + breathPhase) * 0.02 + amplitudeY
                };
            // ═══════════════════════════════════════════════════════════════════
            // DEFAULT: Para cualquier otro pattern, aplicar rotación de phase
            // ═══════════════════════════════════════════════════════════════════
            default:
                // Aplicar phase offset como rotación (igual que wave/figure8/circle)
                const defaultAngle = Math.atan2(amplitudeY, amplitudeX);
                const defaultPhaseAngle = phaseOffset;
                const defaultNewAngle = defaultAngle + defaultPhaseAngle;
                return {
                    x: 0.5 + Math.cos(defaultNewAngle) * magnitude,
                    y: 0.5 + Math.sin(defaultNewAngle) * magnitude
                };
        }
    }
    // ═══════════════════════════════════════════════════════════════════════
    // 👁️ WAVE 340.2: DYNAMIC OPTICS CON SMOOTHING
    // Las ópticas RESPIRAN con el movimiento - suave, sin saltos
    // ═══════════════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════════════
    // 🏎️ WAVE 2074.2: REAL DELTATIME — NO MORE HARDCODED 16ms
    //
    // Mide el tiempo real entre frames para que la física sea frame-rate
    // independent. Cap de 200ms para evitar explosiones numéricas en pausa.
    // Primer frame usa 16ms como semilla segura.
    // ═══════════════════════════════════════════════════════════════════════
    measurePhysicsDeltaTime() {
        const now = Date.now();
        if (this.lastPhysicsFrameTime === 0) {
            this.lastPhysicsFrameTime = now;
            return 16; // Primer frame: semilla segura
        }
        const dt = Math.min(200, now - this.lastPhysicsFrameTime);
        this.lastPhysicsFrameTime = now;
        return Math.max(1, dt); // Nunca 0 (protección div/0)
    }
    /**
     * 👁️ Aplica óptica dinámica basada en vibe y movimiento
     * 🔧 WAVE 340.2: Con SMOOTHING para evitar oscilaciones locas
     *
     * @param movementIntensity - Qué tan lejos está del centro (0-1)
     * @param beatPhase - Fase del beat (0-1, 0=inicio del beat)
     * @param timeSeconds - Tiempo actual para breathing
     * @returns Modificadores de zoom y focus SUAVIZADOS
     */
    applyDynamicOptics(movementIntensity, beatPhase, timeSeconds) {
        // Calcular target basado en vibe
        let targetZoomMod = 0;
        let targetFocusMod = 0;
        // Factor de smoothing por vibe (más bajo = más lento)
        // 0.02 = muy suave (20+ frames para estabilizar)
        // 0.1 = moderado (10 frames)
        // 0.3 = rápido (3-4 frames)
        let smoothFactor = 0.05; // Default: suave
        switch (this.currentVibeId) {
            // ═══════════════════════════════════════════════════════════════════
            // 🍸 CHILL: Zoom RESPIRA muy lento (20s ciclo, smooth máximo)
            // ═══════════════════════════════════════════════════════════════════
            case 'chill-lounge':
                const breathCycle = Math.sin(timeSeconds * Math.PI * 0.1); // 20s ciclo
                targetZoomMod = breathCycle * 8 + movementIntensity * 10; // Reducido: 8+10 max
                targetFocusMod = 15; // Siempre soft (nebuloso)
                smoothFactor = 0.02; // Ultra suave para chill
                break;
            // ═══════════════════════════════════════════════════════════════════
            // 🎸 ROCK: Focus PUNCH en beat (más sutil, smooth rápido)
            // ═══════════════════════════════════════════════════════════════════
            case 'pop-rock':
                if (beatPhase < 0.15) {
                    targetZoomMod = -5; // Reducido de -10
                    targetFocusMod = -25; // Reducido de -50
                }
                smoothFactor = 0.15; // Rápido para el punch
                break;
            // ═══════════════════════════════════════════════════════════════════
            // 🎛️ TECHNO: Beam pulsa suave (no epiléptico)
            // ═══════════════════════════════════════════════════════════════════
            case 'techno-club':
                const technoPhase = Math.pow(1 - beatPhase, 2);
                targetZoomMod = -10 * technoPhase; // Reducido de -20
                targetFocusMod = -5; // Reducido de -10
                smoothFactor = 0.1; // Moderado
                break;
            // ═══════════════════════════════════════════════════════════════════
            // 💃 LATINO: Zoom sigue baile (suave, orgánico)
            // ═══════════════════════════════════════════════════════════════════
            case 'fiesta-latina':
                targetZoomMod = movementIntensity * 15; // Reducido de 30
                targetFocusMod = 0;
                smoothFactor = 0.05; // Suave como caderas
                break;
            default:
                break;
        }
        // 🔧 WAVE 340.2: Aplicar smoothing (exponential moving average)
        // newValue = oldValue + (target - oldValue) * smoothFactor
        this.smoothedZoomMod += (targetZoomMod - this.smoothedZoomMod) * smoothFactor;
        this.smoothedFocusMod += (targetFocusMod - this.smoothedFocusMod) * smoothFactor;
        return {
            zoomMod: Math.round(this.smoothedZoomMod),
            focusMod: Math.round(this.smoothedFocusMod)
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // MAIN RENDER PIPELINE
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * 🎯 MASTER METHOD: Render a LightingIntent to hardware.
     *
     * This orchestrates the complete HAL pipeline:
     * 1. Calculate zone intensities using router + audio
     * 2. Apply physics (decay/inertia) to smooth values
     * 3. Map to fixture states (colors, movement)
     * 4. Apply effects and overrides
     * 5. Send to DMX driver
     *
     * @param intent - Abstract lighting intent from Engine
     * @param fixtures - Patched fixture configuration
     * @param audio - Current audio metrics for physics
     * @returns Array of final fixture states (for UI broadcast)
     */
    render(intent, fixtures, audio) {
        const startTime = performance.now();
        // Build audio input for router
        const audioInput = this.buildAudioInput(audio);
        // Process each fixture through the pipeline
        const fixtureStates = fixtures.map((fixture, fixtureIndex) => {
            const zone = (fixture.zone || 'UNASSIGNED');
            // 🔥 WAVE 290.1: Usar intent.zones como fuente de verdad
            // Mapeo: BACK_PARS→back, MOVING_LEFT→left, MOVING_RIGHT→right, FRONT_PARS→front
            // 🌊 WAVE 1035: 7-ZONE STEREO - Mapeo estéreo por posición X de fixture
            const intentZoneMap = {
                'BACK_PARS': 'back',
                'FRONT_PARS': 'front',
                'MOVING_LEFT': 'left',
                'MOVING_RIGHT': 'right',
                'AMBIENT': 'ambient',
            };
            // 🌊 WAVE 1035: 7-ZONE STEREO ROUTING
            // Si hay zonas estéreo disponibles (frontL/R, backL/R), usar posición X
            // para determinar si la fixture está a la izquierda o derecha
            const fixtureX = fixture.position?.x ?? 0; // Negativo = izquierda, Positivo = derecha
            const isLeftSide = fixtureX < 0;
            // Determinar si tenemos datos estéreo de Chill
            const hasChillStereo = intent.zones.frontL !== undefined || intent.zones.frontR !== undefined;
            let intentZoneKey;
            if (hasChillStereo) {
                // 🌊 7-ZONE MODE: Usar zonas estéreo basadas en posición X
                if (zone === 'FRONT_PARS') {
                    intentZoneKey = isLeftSide ? 'frontL' : 'frontR';
                }
                else if (zone === 'BACK_PARS') {
                    intentZoneKey = isLeftSide ? 'backL' : 'backR';
                }
                else {
                    // Movers y otras zonas usan mapeo normal
                    intentZoneKey = intentZoneMap[zone];
                }
            }
            else {
                // LEGACY MODE: Mapeo mono tradicional
                intentZoneKey = intentZoneMap[zone];
            }
            const intentZoneValue = intentZoneKey ? intent.zones[intentZoneKey] : null;
            // 1. ROUTER: Si el Intent tiene intensidad para esta zona, úsala. Si no, calcula.
            let rawIntensity;
            if (intentZoneValue && intentZoneValue.intensity !== undefined) {
                rawIntensity = intentZoneValue.intensity;
            }
            else {
                rawIntensity = this.calculateZoneIntensity(zone, audioInput);
            }
            // 2. PHYSICS: Apply decay/inertia
            const physicsKey = `${fixture.dmxAddress}-${zone}`;
            const zoneConfig = this.router.getZoneConfig(zone);
            const physicsType = zoneConfig?.physics.type || 'PAR';
            const decaySpeed = physicsType === 'MOVER'
                ? this.router.getEffectiveMoverDecay(this.currentPreset)
                : this.currentPreset.decaySpeed;
            const finalIntensity = this.physics.applyDecayWithPhysics(physicsKey, rawIntensity, decaySpeed, physicsType);
            // 3. MAPPER: Convert to fixture state
            // MovementIntent uses centerX/centerY (0-1), we map to pan/tilt
            // 🐍 WAVE 340.1 PASO 2: Apply phase offset for snake effect
            // Sin desfase = soldados marchando | Con desfase = bailarines
            const baseX = intent.movement?.centerX ?? 0.5;
            const baseY = intent.movement?.centerY ?? 0.5;
            const pattern = intent.movement?.pattern || 'static';
            // Get time for phase offset calculation
            const timeSeconds = Date.now() / 1000;
            // Use movement speed as BPM proxy (speed 0.5 = ~120 BPM)
            // TitanEngine calculates speed from actual BPM, so we reverse-engineer it
            const speedToBpm = (intent.movement?.speed || 0.5) * 240; // 0.5 → 120 BPM
            const bpm = Math.max(60, Math.min(180, speedToBpm)); // Clamp to reasonable range
            // 🔍 WAVE 347: Debug movement input
            if (fixtureIndex === 0 && this.framesRendered % 30 === 0) {
                const inputPan = Math.round((baseX - 0.5) * 540);
                const inputTilt = Math.round((baseY - 0.5) * 270);
                console.log(`[🔍 HAL INPUT] baseX:${baseX.toFixed(3)} baseY:${baseY.toFixed(3)} | Pan:${inputPan}° Tilt:${inputTilt}° | Amp:${intent.movement?.amplitude?.toFixed(2)}`);
            }
            // Apply phase offset based on fixture index
            // Uses this.currentVibeId which is set by the main render loop
            // 🔧 WAVE 350: Pass phaseType from intent
            const phaseOffsetted = this.applyPhaseOffset(baseX, baseY, pattern, fixtureIndex, zone, timeSeconds, bpm, intent.movement?.phaseType || 'polar' // WAVE 350: Default 'polar' si no especificado
            );
            // Convert {x, y} to {pan, tilt} for MovementState
            const movement = {
                pan: phaseOffsetted.x,
                tilt: phaseOffsetted.y,
            };
            return this.mapper.mapFixture(fixture, intent, finalIntensity, movement);
        });
        // 4. EFFECTS: Apply global effects and manual overrides
        const finalStates = this.mapper.applyEffectsAndOverrides(fixtureStates, Date.now());
        // ═══════════════════════════════════════════════════════════════════════
        // 🎛️ WAVE 339.6: INJECT PHYSICS STATE INTO FIXTURE STATES
        // This adds the interpolated (physical) positions from the physics driver
        // So the frontend can visualize actual movement, not just targets
        // Uses REAL fixture IDs (from library) not synthetic ones
        // 👁️ WAVE 340.1 PASO 3: Also apply dynamic optics here
        // ═══════════════════════════════════════════════════════════════════════
        // Get timing info for dynamic optics
        const opticsTimeSeconds = Date.now() / 1000;
        // Beat phase approximation from movement speed
        const movementSpeed = intent.movement?.speed || 0.5;
        const approxBpm = movementSpeed * 240;
        const beatDuration = 60 / Math.max(60, approxBpm); // seconds per beat
        const beatPhase = (opticsTimeSeconds % beatDuration) / beatDuration; // 0-1
        // 🏎️ WAVE 2074.2: Measure real deltaTime ONCE per frame (not per fixture)
        const physicsDt = this.measurePhysicsDeltaTime();
        const statesWithPhysics = finalStates.map((state, index) => {
            // 🔥 WAVE 339.6: Use real fixture ID from the fixtures array
            // This matches the ID registered in setFixtures() → registerMover()
            const fixture = fixtures[index];
            const fixtureId = fixture?.id || `fallback_mover_${index}`;
            // Only apply physics to moving fixtures
            const isMovingFixture = state.zone.includes('MOVING') ||
                state.type?.toLowerCase().includes('moving') ||
                state.type?.toLowerCase().includes('spot') ||
                state.type?.toLowerCase().includes('beam') ||
                fixture?.hasMovementChannels;
            // 👁️ WAVE 340.1 PASO 3: Calculate movement intensity for dynamic optics
            // How far from center (0.5, 0.5) is this fixture?
            const panNorm = state.pan / 255; // 0-1
            const tiltNorm = state.tilt / 255; // 0-1
            const movementIntensity = Math.sqrt(Math.pow(panNorm - 0.5, 2) + Math.pow(tiltNorm - 0.5, 2)) * 2; // 0-1 (max at corners)
            // Apply dynamic optics (breathing zoom, focus punch, etc.)
            const opticsMod = this.applyDynamicOptics(movementIntensity, beatPhase, opticsTimeSeconds);
            // Calculate final zoom/focus with dynamic modifications
            const finalZoom = Math.max(0, Math.min(255, state.zoom + opticsMod.zoomMod));
            const finalFocus = Math.max(0, Math.min(255, state.focus + opticsMod.focusMod));
            if (isMovingFixture) {
                // 🧠 WAVE 2061: INYECCIÓN DE PERFIL FÍSICO
                // Le pasamos el JSON de la Forja al motor de físicas para que respete los límites
                const profile = this.getFixtureProfileCached(fixture);
                const physicsData = profile?.physics || profile?.physicsProfile;
                if (physicsData) {
                    this.movementPhysics.updatePhysicsProfile(fixtureId, physicsData);
                }
                // ═══════════════════════════════════════════════════════════════════════
                // 🔧 WAVE 340.6 + 2074.2: DIRECT DMX INTERPOLATION
                // TitanEngine already generates target positions in DMX space (0-255)
                // We pass them DIRECTLY to physics without double-conversion
                // 🏎️ WAVE 2074.2: Using real measured deltaTime instead of hardcoded 16ms
                // ═══════════════════════════════════════════════════════════════════════
                // Run physics simulation with DMX target directly (no abstract conversion!)
                this.movementPhysics.translateDMX(fixtureId, state.pan, state.tilt, physicsDt);
                // Get interpolated state
                const physicsState = this.movementPhysics.getPhysicsState(fixtureId);
                return {
                    ...state,
                    zoom: finalZoom, // 👁️ Dynamic optics
                    focus: finalFocus, // 👁️ Dynamic optics
                    physicalPan: physicsState.physicalPan,
                    physicalTilt: physicsState.physicalTilt,
                    panVelocity: physicsState.panVelocity,
                    tiltVelocity: physicsState.tiltVelocity,
                };
            }
            // Non-moving fixtures: physical = target (but still apply optics)
            return {
                ...state,
                zoom: finalZoom, // 👁️ Dynamic optics
                focus: finalFocus, // 👁️ Dynamic optics
                physicalPan: state.pan,
                physicalTilt: state.tilt,
                panVelocity: 0,
                tiltVelocity: 0,
            };
        });
        // ═══════════════════════════════════════════════════════════════════════
        // 🔍 WAVE 340.4: HAL DEBUG LOGGING para calibración
        // Log cada ~500ms (30 frames), compacto para ver movimiento real
        // ═══════════════════════════════════════════════════════════════════════
        if (this.framesRendered % 30 === 0) {
            // Encontrar primer mover para debug
            const movers = statesWithPhysics.filter(s => s.zone.includes('MOVING') || s.type?.toLowerCase().includes('moving'));
            if (movers.length > 0) {
                const m = movers[0];
                const panDeg = Math.round(((m.pan / 255) - 0.5) * 540);
                const tiltDeg = Math.round(((m.tilt / 255) - 0.5) * 270);
                const physPanDeg = Math.round(((m.physicalPan / 255) - 0.5) * 540);
                const physTiltDeg = Math.round(((m.physicalTilt / 255) - 0.5) * 270);
                console.log(`[👁️ HAL] ${this.currentVibeId} | Target:${panDeg}°/${tiltDeg}° → Phys:${physPanDeg}°/${physTiltDeg}° | Z:${m.zoom} F:${m.focus}`);
            }
        }
        // 5. DRIVER: Send to hardware
        this.sendToDriver(statesWithPhysics);
        // Update stats
        this.framesRendered++;
        this.lastRenderTime = performance.now() - startTime;
        this.renderTimes.push(this.lastRenderTime);
        if (this.renderTimes.length > 100)
            this.renderTimes.shift();
        // Store for UI broadcast
        this.lastFixtureStates = statesWithPhysics;
        // Debug logging (1% sample rate)
        if (this.config.debug && Math.random() < 0.01) {
            const activeCount = statesWithPhysics.filter(f => f.dimmer > 0).length;
            console.log(`[HAL] 🔧 Render #${this.framesRendered} | ` +
                `Active: ${activeCount}/${statesWithPhysics.length} | ` +
                `Time: ${this.lastRenderTime.toFixed(2)}ms`);
        }
        return statesWithPhysics;
    }
    /**
     * Simplified render for STUB/demo mode (uses intent directly).
     */
    renderSimple(intent) {
        this.framesRendered++;
        const primaryRGB = hslToRgb(intent.palette.primary);
        const intensity = (intent.masterIntensity * 100).toFixed(0);
        const zoneCount = Object.keys(intent.zones).length;
        console.log(`[HAL] 🔧 Render #${this.framesRendered} | ` +
            `Intensity: ${intensity}% | ` +
            `RGB(${primaryRGB.r},${primaryRGB.g},${primaryRGB.b}) | ` +
            `Zones: ${zoneCount}`);
    }
    // ═══════════════════════════════════════════════════════════════════════
    // 🎭 WAVE 374: RENDER FROM ARBITRATED TARGET
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * 🎭 WAVE 374: Render from MasterArbiter's FinalLightingTarget
     *
     * This method accepts pre-arbitrated lighting values from MasterArbiter.
     * The arbiter has already merged:
     * - Layer 0: AI intent from TitanEngine
     * - Layer 1: Consciousness (CORE 3)
     * - Layer 2: Manual overrides
     * - Layer 3: Effects (strobe, flash)
     * - Layer 4: Blackout
     *
     * HAL's responsibility now is ONLY:
     * - Apply physics (movement interpolation)
     * - Apply dynamic optics
     * - Send to DMX driver
     *
     * @param target - Pre-arbitrated lighting target from MasterArbiter
     * @param fixtures - Patched fixture configuration
     * @param audio - Current audio metrics for physics
     * @returns Array of final fixture states (for UI broadcast)
     */
    renderFromTarget(target, fixtures, audio) {
        const startTime = performance.now();
        // 🚫 BLACKOUT CHECK (arbiter already handled dimmer=0, but we can short-circuit)
        if (target.globalEffects.blackoutActive) {
            const blackoutStates = fixtures.map(fixture => ({
                name: fixture.name,
                type: fixture.type || 'generic',
                zone: (fixture.zone || 'UNASSIGNED'),
                dmxAddress: fixture.dmxAddress,
                universe: fixture.universe ?? 0, // 🔥 WAVE 1219: ArtNet 0-indexed
                dimmer: 0,
                r: 0,
                g: 0,
                b: 0,
                pan: 128,
                tilt: 128,
                zoom: 128,
                focus: 128,
                physicalPan: 128,
                physicalTilt: 128,
                panVelocity: 0,
                tiltVelocity: 0,
            }));
            this.sendToDriver(blackoutStates);
            this.framesRendered++;
            this.lastFixtureStates = blackoutStates;
            return blackoutStates;
        }
        // Map arbitrated targets to fixture states
        const fixtureStates = fixtures.map((fixture, index) => {
            const fixtureId = fixture.id || fixture.name;
            const zone = (fixture.zone || 'UNASSIGNED');
            // 🎨 WAVE 686.11: Normalize DMX address (ShowFileV2 uses "address", legacy uses "dmxAddress")
            const dmxAddress = fixture.dmxAddress || fixture.address;
            // 🎨 WAVE 687: Get channel definitions for dynamic mapping
            const channels = fixture.channels || [];
            // Find this fixture's target from arbiter output
            const fixtureTarget = target.fixtures.find(t => t.fixtureId === fixtureId);
            if (fixtureTarget) {
                // Use arbitrated values directly
                const baseState = {
                    name: fixture.name,
                    type: fixture.type || 'generic',
                    zone,
                    dmxAddress, // 🎨 WAVE 686.11: Use normalized address
                    universe: fixture.universe ?? 0, // 🔥 WAVE 1219: ArtNet 0-indexed
                    dimmer: fixtureTarget.dimmer,
                    r: fixtureTarget.color.r,
                    g: fixtureTarget.color.g,
                    b: fixtureTarget.color.b,
                    pan: fixtureTarget.pan,
                    tilt: fixtureTarget.tilt,
                    zoom: fixtureTarget.zoom,
                    focus: fixtureTarget.focus,
                    // 🔥 WAVE 1008.4: Movement speed from arbiter
                    speed: fixtureTarget.speed,
                    // 🎨 WAVE 1008.6: Color wheel position from arbiter (THE WHEELSMITH)
                    colorWheel: fixtureTarget.color_wheel,
                    // 🎨 WAVE 687: Include channel definitions for dynamic DMX mapping
                    channels,
                    // 🎨 WAVE 687: Default values for additional controls
                    shutter: 255, // Open by default
                    gobo: 0,
                    prism: 0,
                    strobe: 0,
                    // 🔥 WAVE 2084: PHANTOM PANEL — Canales extra desde el Arbiter
                    phantomChannels: fixtureTarget.phantomChannels,
                };
                // 🐟 WAVE 2042.20: BABEL FISH - Translate RGB to Color Wheel if needed
                // This is the KEY integration point: if fixture has color wheel profile,
                // convert the RGB values from Selene/Arbiter to the nearest wheel color DMX
                const translatedState = this.translateColorToWheel(baseState, fixture, fixtureTarget.color_wheel);
                return translatedState;
            }
            // Fallback: fixture not in arbiter output (shouldn't happen)
            return {
                name: fixture.name,
                type: fixture.type || 'generic',
                zone,
                dmxAddress, // 🎨 WAVE 686.11: Use normalized address
                universe: fixture.universe || 0,
                dimmer: 0,
                r: 0,
                g: 0,
                b: 0,
                pan: 128,
                tilt: 128,
                zoom: 128,
                focus: 128,
                // 🔥 WAVE 1008.4: Fast movement by default
                speed: 0,
                // 🎨 WAVE 1008.6: Color wheel off by default
                colorWheel: 0,
                // 🎨 WAVE 687: Include channel definitions for dynamic DMX mapping
                channels,
                shutter: 255,
                gobo: 0,
                prism: 0,
                strobe: 0,
            };
        });
        // Apply physics and dynamic optics (same as render())
        const opticsTimeSeconds = Date.now() / 1000;
        const beatDuration = 0.5; // Default 120 BPM
        const beatPhase = (opticsTimeSeconds % beatDuration) / beatDuration;
        // 🏎️ WAVE 2074.2: Measure real deltaTime ONCE per frame (not per fixture)
        const physicsDt = this.measurePhysicsDeltaTime();
        const statesWithPhysics = fixtureStates.map((state, index) => {
            const fixture = fixtures[index];
            const fixtureId = fixture?.id || `fallback_mover_${index}`;
            const isMovingFixture = state.zone.includes('MOVING') ||
                state.type?.toLowerCase().includes('moving') ||
                state.type?.toLowerCase().includes('spot') ||
                state.type?.toLowerCase().includes('beam') ||
                fixture?.hasMovementChannels;
            // Calculate movement intensity for optics
            const panNorm = state.pan / 255;
            const tiltNorm = state.tilt / 255;
            const movementIntensity = Math.sqrt(Math.pow(panNorm - 0.5, 2) + Math.pow(tiltNorm - 0.5, 2)) * 2;
            // Apply dynamic optics
            const opticsMod = this.applyDynamicOptics(movementIntensity, beatPhase, opticsTimeSeconds);
            const finalZoom = Math.max(0, Math.min(255, state.zoom + opticsMod.zoomMod));
            const finalFocus = Math.max(0, Math.min(255, state.focus + opticsMod.focusMod));
            if (isMovingFixture) {
                // 🧠 WAVE 2061: INYECCIÓN DE PERFIL FÍSICO
                // Le pasamos el JSON de la Forja al motor de físicas para que respete los límites
                const profile = this.getFixtureProfileCached(fixture);
                const physicsData = profile?.physics || profile?.physicsProfile;
                if (physicsData) {
                    this.movementPhysics.updatePhysicsProfile(fixtureId, physicsData);
                }
                // 🏎️ WAVE 2074.2: Apply physics interpolation with real deltaTime
                this.movementPhysics.translateDMX(fixtureId, state.pan, state.tilt, physicsDt);
                const physicsState = this.movementPhysics.getPhysicsState(fixtureId);
                return {
                    ...state,
                    zoom: finalZoom,
                    focus: finalFocus,
                    physicalPan: physicsState.physicalPan,
                    physicalTilt: physicsState.physicalTilt,
                    panVelocity: physicsState.panVelocity,
                    tiltVelocity: physicsState.tiltVelocity,
                };
            }
            return {
                ...state,
                zoom: finalZoom,
                focus: finalFocus,
                physicalPan: state.pan,
                physicalTilt: state.tilt,
                panVelocity: 0,
                tiltVelocity: 0,
            };
        });
        // Send to hardware
        this.sendToDriver(statesWithPhysics);
        // Update stats
        this.framesRendered++;
        this.lastRenderTime = performance.now() - startTime;
        this.renderTimes.push(this.lastRenderTime);
        if (this.renderTimes.length > 100)
            this.renderTimes.shift();
        this.lastFixtureStates = statesWithPhysics;
        // Debug logging (every ~1 second)
        if (this.framesRendered % 30 === 0) {
            const movers = statesWithPhysics.filter(s => s.zone.includes('MOVING'));
            if (movers.length > 0) {
                const m = movers[0];
                const panDeg = Math.round(((m.pan / 255) - 0.5) * 540);
                const tiltDeg = Math.round(((m.tilt / 255) - 0.5) * 270);
                console.log(`[🎭 HAL ARBITER] ${this.currentVibeId} | Pan:${panDeg}° Tilt:${tiltDeg}° | Blackout:${target.globalEffects.blackoutActive}`);
            }
        }
        return statesWithPhysics;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // 🐟 WAVE 2042.20: BABEL FISH - COLOR TRANSLATION LAYER
    // Translates RGB commands to Color Wheel DMX for fixtures that need it
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * 🐟 BABEL FISH: Get or create fixture profile (cached)
     */
    getFixtureProfileCached(fixture) {
        const cacheKey = fixture.profileId || fixture.name || fixture.id || 'unknown';
        // Si ya lo procesamos, devolverlo de la caché silenciosamente (ADIÓS SPAM)
        if (this.profileCache.has(cacheKey)) {
            return this.profileCache.get(cacheKey);
        }
        let profile = null;
        // 1. JSON inyectado en vivo desde la Forja
        if (fixture.capabilities || fixture.wheels || fixture.colorEngine || fixture.physics) {
            profile = fixture;
        }
        // 2. Búsqueda por ID formal
        else if (fixture.profileId) {
            profile = getProfile(fixture.profileId) ?? null;
        }
        // 3. Heurística por nombre (Salvavidas)
        else if (fixture.name) {
            profile = getProfileByModel(fixture.name) ?? null;
        }
        // Guardar en caché para no volver a calcularlo ni printearlo en el próximo frame
        this.profileCache.set(cacheKey, profile);
        return profile;
    }
    /**
     * 🐟 BABEL FISH: Translate RGB to Color Wheel DMX if fixture needs it
     * @returns Modified state with colorWheel set (or original state if no translation needed)
     */
    translateColorToWheel(state, fixture, existingColorWheel) {
        // If already has a manual color_wheel override, don't translate
        if (existingColorWheel > 0) {
            return state;
        }
        // Get fixture profile
        const profile = this.getFixtureProfileCached(fixture);
        if (!profile) {
            return state; // No profile = assume RGB fixture, pass-through
        }
        // Check if fixture needs color translation (has color wheel)
        if (!needsColorTranslation(profile)) {
            return state; // RGB/CMY fixture, no translation needed
        }
        // 🐟 TRANSLATE RGB → COLOR WHEEL DMX
        const targetRGB = { r: state.r, g: state.g, b: state.b };
        const translation = this.colorTranslator.translate(targetRGB, profile);
        // If not translated (shouldn't happen if needsColorTranslation=true), pass-through
        if (!translation.wasTranslated) {
            return state;
        }
        // Apply safety filter (debounce, latch, strobe delegation)
        const fixtureId = fixture.id || fixture.name || `fixture-${state.dmxAddress}`;
        const safetyResult = this.safetyLayer.filter(fixtureId, translation.colorWheelDmx ?? 0, profile, state.dimmer);
        // Debug logging (throttled - every ~2 seconds per fixture)
        const now = Date.now();
        if (now - this.lastDebugTime > 2000) {
            this.lastDebugTime = now;
            console.log(`[🐟 BABEL FISH] ${fixture.name}: RGB(${state.r},${state.g},${state.b}) → ${translation.colorName} (DMX ${safetyResult.finalColorDmx})${safetyResult.wasBlocked ? ' [BLOCKED]' : ''}`);
        }
        // Return translated state
        return {
            ...state,
            // 🎨 Replace RGB with translated color's actual RGB (for UI consistency)
            r: translation.outputRGB.r,
            g: translation.outputRGB.g,
            b: translation.outputRGB.b,
            // 🎨 Set color wheel DMX value (THE KEY!)
            colorWheel: safetyResult.finalColorDmx,
            // 🛡️ Handle strobe delegation (if color is changing too fast)
            strobe: safetyResult.delegateToStrobe ? safetyResult.suggestedShutter : state.strobe,
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // ZONE INTENSITY CALCULATION
    // ═══════════════════════════════════════════════════════════════════════
    calculateZoneIntensity(zone, audio) {
        switch (zone) {
            case 'FRONT_PARS':
                return this.router.calculateFrontParIntensity(audio, this.currentPreset);
            case 'BACK_PARS':
                return this.router.calculateBackParIntensity(audio, this.currentPreset);
            case 'MOVING_LEFT':
            case 'MOVING_RIGHT': {
                // Use mover calculation from physics engine
                const hystKey = `${zone}-hyst`;
                const wasOn = this.physics.getMoverHysteresisState(hystKey);
                const result = this.physics.calculateMoverTarget({
                    moverKey: hystKey, // 🔧 WAVE 280: Unique key for state buffer
                    presetName: 'Default', // Would come from VibeManager
                    melodyThreshold: this.currentPreset.melodyThreshold,
                    rawMid: audio.rawMid,
                    rawBass: audio.rawBass,
                    rawTreble: audio.rawTreble,
                    moverState: wasOn,
                    isRealSilence: audio.isRealSilence,
                    isAGCTrap: audio.isAGCTrap,
                });
                // WAVE 256.7: Debug log for movers - every 2 seconds
                if (Date.now() - this.lastDebugTime > 2000 && zone === 'MOVING_LEFT') {
                    console.log(`[HAL MOVER] ${zone}: mid=${audio.rawMid.toFixed(2)}, treble=${audio.rawTreble.toFixed(2)}, bass=${audio.rawBass.toFixed(2)} → intensity=${result.intensity.toFixed(2)}, state=${result.newState}`);
                    this.lastDebugTime = Date.now();
                }
                this.physics.setMoverHysteresisState(hystKey, result.newState);
                return result.intensity;
            }
            case 'STROBES':
                // Strobes only on beat with high bass
                return (audio.bassPulse > 0.8) ? 1.0 : 0;
            // 🌊 WAVE 2020.1: AIR ZONE FALLBACK
            // Hereda comportamiento de MOVING_RIGHT (treble-driven) con decay acelerado
            // Futuro: Conectar a God Ear ultraAir band (16k-22kHz)
            case 'AIR': {
                const hystKey = `${zone}-hyst`;
                const wasOn = this.physics.getMoverHysteresisState(hystKey);
                const result = this.physics.calculateMoverTarget({
                    moverKey: hystKey,
                    presetName: 'Default',
                    melodyThreshold: this.currentPreset.melodyThreshold,
                    rawMid: audio.rawMid,
                    rawBass: audio.rawBass,
                    rawTreble: audio.rawTreble,
                    moverState: wasOn,
                    isRealSilence: audio.isRealSilence,
                    isAGCTrap: audio.isAGCTrap,
                });
                // Aplicar decay acelerado para respuesta rápida (cymbal wash)
                return result.intensity * 0.8;
            }
            // 🌊 WAVE 2020.1: CENTER ZONE FALLBACK
            // Hereda comportamiento de STROBES (beat-driven)
            case 'CENTER':
                return (audio.bassPulse > 0.8) ? 1.0 : 0;
            default:
                return audio.melodySignal * 0.5;
        }
    }
    buildAudioInput(audio) {
        // WAVE 256.5: Calculate derived values with REDUCED thresholds for better reactivity
        // Previous bassFloor=0.5 was killing most audio signal
        const bassFloor = 0.15; // Was 0.5 - now much more sensitive
        const bassPulse = Math.max(0, audio.rawBass - bassFloor); // Was bassFloor * 0.6
        const treblePulse = Math.max(0, audio.rawTreble - 0.05); // Was 0.15
        const melodySignal = Math.max(audio.rawMid * 1.2, audio.rawTreble); // Boosted mid
        const isMelodyDominant = audio.rawMid + audio.rawTreble > audio.rawBass * 1.5;
        return {
            rawBass: audio.rawBass,
            rawMid: audio.rawMid,
            rawTreble: audio.rawTreble,
            bassPulse,
            treblePulse,
            melodySignal,
            isRealSilence: audio.isRealSilence,
            isAGCTrap: audio.isAGCTrap,
            isMelodyDominant,
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // DRIVER MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════
    createDriver(type) {
        switch (type) {
            case 'mock':
                // WAVE 252: Silent mock driver
                return new MockDMXDriver({ debug: false });
            case 'usb':
                // For now, fall back to silent mock
                // Real USB driver would be: return new USBDMXDriverAdapter()
                return new MockDMXDriver({ debug: false });
            case 'artnet':
                // For now, fall back to silent mock
                return new MockDMXDriver({ debug: false });
            default:
                // WAVE 252: Default to silent mock (no spam)
                return new MockDMXDriver({ debug: false });
        }
    }
    // ═══════════════════════════════════════════════════════════════════════
    // 🎛️ DMX OUTPUT CONTROL
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * ⚒️ WAVE 2030.22g: Public method to send already-processed fixture states
     * Used by TitanOrchestrator after applying Hephaestus parameter overlays
     */
    sendStates(states) {
        this.sendToDriver(states);
    }
    sendToDriver(states) {
        // 🧟 WAVE 1208: ZOMBIE KILLER - NO auto-connect!
        // If driver is not connected, silently drop packets.
        // User MUST manually start ArtNet/USB from Dashboard.
        // This respects "Manual First" doctrine: hardware = explicit human action.
        if (!this.driver.isConnected) {
            // 🔥 WAVE 1219: Debug - driver not connected
            if (this.framesRendered % 100 === 0) {
                console.warn(`[HAL] ⚠️ Driver not connected, dropping frames`);
            }
            return;
        }
        // ⚒️ WAVE 2030.22g: Debug white values before DMX conversion
        const withWhite = states.filter(s => s.white !== undefined && s.white > 0);
        if (withWhite.length > 0) {
            const first = withWhite[0];
            console.log(`[HAL] 🔆 WHITE PRE-DMX: ${first.name} → white=${first.white}, dimmer=${first.dimmer}`);
        }
        // Convert states to DMX packets
        const packets = this.mapper.statesToDMXPackets(states);
        // Debug output silenced - Wave 2042.29
        // (was spamming console every frame)
        // 🔥 WAVE 2020.2b: MULTI-UNIVERSE PARALLEL DISPATCH
        // Feed all packets to driver (buffering by universe internally)
        for (const packet of packets) {
            this.driver.send(packet);
        }
        // 🔥 WAVE 2020.2b: Use sendAll() for parallel UDP dispatch if available
        // This is the key optimization for 50+ universes
        if (this.driver.sendAll) {
            // Fire and forget - we don't await because render loop is sync
            // sendAll internally handles the Promise
            void this.driver.sendAll();
        }
        // NOTE: Drivers that support sendAll() should buffer in send() and flush in sendAll()
        // Drivers without sendAll() will send immediately in send() (legacy behavior)
    }
    /**
     * Connect to DMX hardware.
     */
    async connect() {
        console.log(`[HAL] 🔌 Connecting to ${this.config.driverType} driver...`);
        return await this.driver.connect();
    }
    /**
     * Disconnect from hardware.
     */
    async disconnect() {
        console.log('[HAL] 🔌 Disconnecting...');
        await this.driver.close();
    }
    /**
     * Switch to a different driver type.
     */
    async switchDriver(type) {
        console.log(`[HAL] 🔄 Switching driver to: ${type}`);
        // Close existing driver
        await this.driver.close();
        // Create new driver
        this.driver = this.createDriver(type);
        this.config.driverType = type;
        // Connect new driver
        return await this.driver.connect();
    }
    // ═══════════════════════════════════════════════════════════════════════
    // STATE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Update vibe preset for physics calculations.
     */
    setVibePreset(preset) {
        this.currentPreset = preset;
    }
    /**
     * 🔧 WAVE 338: Set active vibe for movement physics + optics
     * This updates both the intensity physics (router) and movement physics (driver)
     */
    setVibe(vibeId) {
        if (this.currentVibeId === vibeId)
            return;
        this.currentVibeId = vibeId;
        // Update movement physics (pan/tilt acceleration, velocity, friction)
        this.movementPhysics.setVibe(vibeId);
        // Update optics defaults (zoom, focus)
        this.currentOptics = getOpticsConfig(vibeId);
        // 🔍 WAVE 338.2: Pass optics to FixtureMapper
        this.mapper.setCurrentOptics({
            zoom: this.currentOptics.zoomDefault,
            focus: this.currentOptics.focusDefault,
        });
        console.log(`[HAL] 🎛️ WAVE 338: Vibe "${vibeId}" - Zoom:${this.currentOptics.zoomDefault} Focus:${this.currentOptics.focusDefault}`);
    }
    /**
     * Get current vibe ID
     */
    getCurrentVibe() {
        return this.currentVibeId;
    }
    /**
     * Get current optics configuration
     */
    getCurrentOptics() {
        return this.currentOptics;
    }
    /**
     * 🔧 WAVE 338: Register a mover fixture with the physics driver
     */
    registerMover(fixtureId, installationType = 'ceiling') {
        this.movementPhysics.registerFixture(fixtureId, { installationType });
        console.log(`[HAL] 🔧 Registered mover "${fixtureId}" (${installationType})`);
    }
    /**
     * 🔧 WAVE 338: Translate abstract position to DMX for a mover
     * @param fixtureId - Fixture identifier
     * @param x - Abstract X position (-1 to +1)
     * @param y - Abstract Y position (-1 to +1)
     * @param deltaTime - Time since last frame in ms
     */
    translateMovement(fixtureId, x, y, deltaTime = 16) {
        return this.movementPhysics.translate({ fixtureId, x, y }, deltaTime);
    }
    /**
     * Set blackout mode.
     */
    setBlackout(active) {
        this.mapper.setBlackout(active);
        if (active) {
            this.driver.blackout();
        }
    }
    /**
     * Set manual override for a fixture.
     */
    setManualOverride(fixtureId, override) {
        this.mapper.setManualOverride(fixtureId, override);
    }
    /**
     * Clear all manual overrides.
     */
    clearOverrides() {
        this.mapper.clearAllOverrides();
    }
    /**
     * Set effect active state.
     */
    setEffect(effect, active) {
        this.mapper.setEffect(effect, active);
    }
    /**
     * Reset all physics state (for mode changes).
     */
    resetPhysics() {
        this.physics.reset();
    }
    // ═══════════════════════════════════════════════════════════════════════
    // STATUS & MONITORING
    // ═══════════════════════════════════════════════════════════════════════
    getStatus() {
        const avgRenderTime = this.renderTimes.length > 0
            ? this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length
            : 0;
        return {
            isConnected: this.driver.isConnected,
            driverType: this.config.driverType,
            framesRendered: this.framesRendered,
            fixturesActive: this.lastFixtureStates.filter(f => f.dimmer > 0).length,
            avgRenderTime,
            lastRenderTime: this.lastRenderTime,
        };
    }
    getLastFixtureStates() {
        return this.lastFixtureStates;
    }
    get isConnected() {
        return this.driver.isConnected;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════════════════
    async destroy() {
        console.log('[HAL] 🛑 Destroying HardwareAbstraction...');
        this.physics.destroy();
        this.router.destroy();
        this.mapper.destroy();
        await this.driver.close();
        this.universeBuffers.clear();
        this.lastFixtureStates = [];
        console.log('[HAL] ✅ Destroyed');
    }
}
// Export singleton for easy use
export const hardwareAbstraction = new HardwareAbstraction();
