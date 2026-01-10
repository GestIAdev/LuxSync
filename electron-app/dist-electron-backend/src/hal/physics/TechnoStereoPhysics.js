/**
 * WAVE 290.3: TECHNO STEREO PHYSICS
 *
 * Motor de fisicas EXCLUSIVO para el vibe TECHNO.
 *
 * DOBLE API:
 * - apply() [STATIC] -> Procesa COLORES/STROBE (compatibilidad SeleneLux)
 * - applyZones() [INSTANCE] -> Procesa ZONAS/INTENSIDADES (WAVE 290.3)
 *
 * ALMA DEL TECHNO:
 * - Movers = TREBLE (voces, melodias, efectos) con VITAMINAS
 * - Strobe = TREBLE peaks para techno puro
 * - Decay agresivo estilo katana
 * - Anti-epilepsy hysteresis (WAVE 280)
 */
import { hslToRgb } from '../../engine/color/SeleneColorEngine';
// ===========================================================================
// TECHNO STEREO PHYSICS ENGINE
// ===========================================================================
export class TechnoStereoPhysics {
    constructor() {
        // =========================================================================
        // ZONE CONSTANTS (WAVE 290.3)
        // =========================================================================
        this.TREBLE_VITAMIN = 2.2;
        this.ACTIVATION_THRESHOLD = 0.15;
        this.VISIBILITY_FLOOR = 0.18;
        this.HYSTERESIS_MARGIN = 0.06;
        this.INTENSITY_SMOOTHING = 0.4;
        this.MIN_STABLE_FRAMES = 2;
        this.STROBE_THRESHOLD = 0.85;
        this.STROBE_DURATION = 40;
        // 🔊 FRONT PARS = BASS (Bombo, el empujón)
        this.FRONT_PAR_BASE = 0.08; // Base ambiente muy baja
        this.FRONT_PAR_BASS_MULT = 0.85; // 85% respuesta a bass
        // 🥁 BACK PARS = MID (Caja/Snare, la bofetada)
        // Gate ALTO para filtrar voces - solo transientes de percusión
        this.BACK_PAR_GATE = 0.25; // Gate alto anti-karaoke
        this.BACK_PAR_MID_MULT = 1.8; // Multiplicador agresivo para caja
        // =========================================================================
        // INTERNAL STATE (Zonas)
        // =========================================================================
        this.moverIntensityBuffer = 0;
        this.moverState = false;
        this.stabilityCounter = 0;
        this.strobeActive = false;
        this.strobeStartTime = 0;
        this.frontParSmoothed = 0;
        this.backParSmoothed = 0;
        this.frontParActive = false; // Estado para histéresis anti-parpadeo
        console.log('[TechnoStereoPhysics] Initialized (WAVE 290.3)');
    }
    // =========================================================================
    // LEGACY API - STATIC (Compatibilidad SeleneLux)
    // =========================================================================
    /**
     * LEGACY: Apply Techno strobe physics to palette.
     * Detecta drops y aplica strobe magenta neon.
     */
    static apply(palette, audio, mods) {
        const thresholdMod = mods?.thresholdMultiplier ?? 1.0;
        const brightnessMod = mods?.brightnessMultiplier ?? 1.0;
        const normalizedTreble = audio.normalizedTreble ?? 0;
        const normalizedBass = audio.normalizedBass ?? 0;
        // Ratio Bass/Treble para detectar drops
        const dropRatio = normalizedBass / Math.max(0.01, normalizedTreble);
        const effectiveThreshold = this.STROBE_BASE_THRESHOLD * thresholdMod;
        // Detectar strobe
        const isStrobeActive = normalizedTreble > effectiveThreshold && dropRatio < 2.0;
        let outputPalette = { ...palette };
        if (isStrobeActive) {
            const modulatedLightness = Math.min(100, this.STROBE_LIGHTNESS * brightnessMod);
            const strobeRgb = hslToRgb({ h: this.STROBE_HUE, s: this.STROBE_SATURATION, l: modulatedLightness });
            outputPalette.accent = strobeRgb;
        }
        return {
            palette: outputPalette,
            isStrobeActive,
            debugInfo: {
                normalizedTreble,
                normalizedBass,
                dropRatio,
                effectiveThreshold,
                strobeTriggered: isStrobeActive
            }
        };
    }
    // =========================================================================
    // NEW API - INSTANCE (Zonas/Intensidades WAVE 290.3)
    // =========================================================================
    /**
     * Apply Techno zone physics.
     * Returns zone intensities and strobe state.
     */
    applyZones(input) {
        const { bass, mid, treble, isRealSilence, isAGCTrap } = input;
        if (isRealSilence || isAGCTrap) {
            return this.handleSilence();
        }
        // Front = BASS (bombo), Back = MID (caja)
        const frontParIntensity = this.calculateFrontPar(bass);
        const backParIntensity = this.calculateBackPar(mid);
        const moverResult = this.calculateMover(treble);
        const strobeResult = this.calculateStrobe(treble);
        return {
            strobeActive: strobeResult.active,
            strobeIntensity: strobeResult.intensity,
            frontParIntensity,
            backParIntensity,
            moverIntensity: moverResult.intensity,
            moverActive: moverResult.active,
            physicsApplied: 'techno'
        };
    }
    reset() {
        this.moverIntensityBuffer = 0;
        this.moverState = false;
        this.stabilityCounter = 0;
        this.strobeActive = false;
        this.strobeStartTime = 0;
        this.frontParSmoothed = 0;
        this.backParSmoothed = 0;
        this.frontParActive = false;
    }
    // =========================================================================
    // PRIVATE - Zone Calculations
    // =========================================================================
    handleSilence() {
        this.moverIntensityBuffer = 0;
        this.moverState = false;
        this.stabilityCounter = 0;
        this.strobeActive = false;
        this.frontParSmoothed *= 0.85;
        this.backParSmoothed *= 0.85;
        return {
            strobeActive: false,
            strobeIntensity: 0,
            frontParIntensity: this.frontParSmoothed,
            backParIntensity: this.backParSmoothed,
            moverIntensity: 0,
            moverActive: false,
            physicsApplied: 'techno'
        };
    }
    /**
     * Front PAR = BASS (Bombo) - EL CORAZÓN
     * Comportamiento BINARIO con HISTÉRESIS anti-parpadeo
     * Gate alto + histéresis = sin rebote cerca del umbral
     * Cap 0.80 (siempre por debajo de Back)
     */
    calculateFrontPar(bass) {
        // HISTÉRESIS: Diferentes umbrales para encender vs apagar
        // Encender: bass > 0.35 (gate alto)
        // Apagar: bass < 0.28 (margen de 0.07 para evitar rebote)
        const gateOn = 0.35;
        const gateOff = 0.28;
        if (this.frontParActive) {
            // Ya está encendido - solo apagar si baja MUCHO
            if (bass < gateOff) {
                this.frontParActive = false;
                return 0;
            }
        }
        else {
            // Está apagado - solo encender si sube lo suficiente
            if (bass < gateOn) {
                return 0;
            }
            this.frontParActive = true;
        }
        // Normalizar desde gate de encendido
        const gated = (bass - gateOn) / (1 - gateOn);
        // Curva AGRESIVA sin multiplicador
        const intensity = Math.pow(Math.max(0, gated), 0.6);
        return Math.min(0.80, Math.max(0, intensity));
    }
    /**
     * Back PAR = MID (Caja/Snare) - LA BOFETADA DE MAMÁ
     * Gate calibrado para Techno 4x4 (caja clara a ~0.35-0.50)
     * Multiplicador AGRESIVO - tiene que DOLER
     * Cap 0.95 - SIEMPRE por encima de Front
     */
    calculateBackPar(mid) {
        // Gate para Techno 4x4: caja suele estar en 0.35-0.60
        // Voces están en 0.25-0.40, así que gate en 0.32 es el sweet spot
        if (mid < 0.32) {
            return 0;
        }
        // Normalizar desde gate
        const gated = (mid - 0.32) / (1 - 0.32);
        // Multiplicador MÁS AGRESIVO 2.0 + exponente 0.65 para expandir débiles
        // mid 0.40 → gated 0.12 → 0.47 (caja suave pero visible)
        // mid 0.55 → gated 0.34 → 0.91 (PEGA)
        // mid 0.70 → gated 0.56 → 0.95 (HOSTIA, capeado)
        const intensity = Math.pow(gated, 0.65) * 2.0;
        return Math.min(0.95, Math.max(0, intensity));
    }
    calculateMover(treble) {
        const audioSignal = treble * this.TREBLE_VITAMIN;
        const prevIntensity = this.moverIntensityBuffer;
        const deactivationThreshold = Math.max(0.08, this.ACTIVATION_THRESHOLD - this.HYSTERESIS_MARGIN);
        let rawTarget = 0;
        let shouldBeOn = this.moverState;
        if (audioSignal > this.ACTIVATION_THRESHOLD) {
            shouldBeOn = true;
            rawTarget = 0.25 + (audioSignal - this.ACTIVATION_THRESHOLD) * 0.75 / (1 - this.ACTIVATION_THRESHOLD);
        }
        else if (audioSignal > deactivationThreshold && this.moverState) {
            shouldBeOn = true;
            rawTarget = prevIntensity * 0.4;
        }
        else {
            shouldBeOn = false;
            rawTarget = 0;
        }
        let finalState = this.moverState;
        if (shouldBeOn !== this.moverState) {
            // RISING INSTANTÁNEO: Si quiere encender, enciende YA (0 frames de espera)
            // APAGADO con estabilidad: Solo delay para apagar (evita parpadeo)
            if (shouldBeOn) {
                // ENCENDER = INMEDIATO (el rising que pedía Radwulf)
                finalState = true;
                this.stabilityCounter = 0;
            }
            else if (this.stabilityCounter >= this.MIN_STABLE_FRAMES) {
                // APAGAR = con delay (evita flicker)
                finalState = false;
                this.stabilityCounter = 0;
            }
            else {
                this.stabilityCounter++;
                finalState = this.moverState;
                if (this.moverState && rawTarget === 0) {
                    rawTarget = prevIntensity * 0.7;
                }
            }
        }
        else {
            this.stabilityCounter = 0;
        }
        let smoothedIntensity;
        if (rawTarget > prevIntensity) {
            // ATTACK INSTANTÁNEO - sin smooth en subida
            // El Techno es golpe seco, no fade-in
            smoothedIntensity = rawTarget;
        }
        else {
            // DECAY BRUTAL - 10% retención = cae a negro en 2-3 frames
            // Esto es lo que crea el DELTA que queremos
            smoothedIntensity = prevIntensity * 0.10 + rawTarget * 0.90;
        }
        // Floor alto para cortar limpio y llegar a NEGRO real
        const cleanedIntensity = smoothedIntensity < 0.20 ? 0 : Math.min(1, smoothedIntensity);
        this.moverIntensityBuffer = cleanedIntensity;
        this.moverState = cleanedIntensity > 0 ? finalState : false;
        return { intensity: cleanedIntensity, active: this.moverState };
    }
    calculateStrobe(treble) {
        const now = Date.now();
        if (this.strobeActive && now - this.strobeStartTime > this.STROBE_DURATION) {
            this.strobeActive = false;
        }
        if (treble > this.STROBE_THRESHOLD && !this.strobeActive) {
            this.strobeActive = true;
            this.strobeStartTime = now;
        }
        return { active: this.strobeActive, intensity: this.strobeActive ? 1.0 : 0 };
    }
}
// =========================================================================
// LEGACY CONSTANTS (Colores/Strobe - WAVE 151)
// =========================================================================
TechnoStereoPhysics.STROBE_BASE_THRESHOLD = 0.6;
TechnoStereoPhysics.STROBE_HUE = 300; // Magenta neon
TechnoStereoPhysics.STROBE_SATURATION = 100;
TechnoStereoPhysics.STROBE_LIGHTNESS = 85;
// ===========================================================================
// SINGLETON EXPORT (para zonas)
// ===========================================================================
export const technoStereoPhysics = new TechnoStereoPhysics();
