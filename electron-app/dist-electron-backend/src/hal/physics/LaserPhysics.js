/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🟢 WAVE 1031: LASER PHYSICS - "LA CIRUGÍA DE LUZ"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FILOSOFÍA: Los láseres no son luces. Son PROYECTILES.
 * No tienen inercia, tienen velocidad de escaneo.
 * Responden a las frecuencias que los humanos CASI NO OYEN.
 *
 * SOURCE MAPPING:
 * - Input Principal: spectral.bands.ultraAir (16-22kHz)
 *   → Los láseres son lo ÚNICO visualmente tan rápido como esas frecuencias
 * - Input Secundario: spectral.clarity
 *   → Si clarity > 0.9: Haz fino y preciso
 *   → Si clarity < 0.5: Haz caótico o ensanchado
 *
 * COMPORTAMIENTOS BASE:
 * - LIQUID_SKY (Clean/Warm): Ondulación horizontal sobre el público (Trance, Épico)
 * - SPARKLE_RAIN (Harsh/Noisy): Puntos aleatorios a alta velocidad (Techno Industrial)
 *
 * 👁️🚫 PROTOCOLO DE SEGURIDAD: RETINA GUARD
 * - horizonLimit: Línea de ojos del público
 * - NUNCA permitir que Pan/Tilt cruce esa línea
 * - Audience Clipping INVIOLABLE
 *
 * @module hal/physics/LaserPhysics
 * @version WAVE 1031 - THE PHOTON WEAVER
 */
// ═══════════════════════════════════════════════════════════════════════════
// 🟢 LASER PHYSICS ENGINE
// ═══════════════════════════════════════════════════════════════════════════
export class LaserPhysics {
    constructor(safetyConfig) {
        // ═══════════════════════════════════════════════════════════════════════
        // CONSTANTES - TUNING PERFECTO
        // ═══════════════════════════════════════════════════════════════════════
        /** Umbral mínimo de ultraAir para activar el láser */
        this.ULTRA_AIR_GATE = 0.15;
        /** Umbral de clarity para modo PRECISION vs CHAOS */
        this.CLARITY_PRECISION_THRESHOLD = 0.7;
        /** Velocidad base de ondulación para LIQUID_SKY (radianes por frame) */
        this.LIQUID_SKY_WAVE_SPEED = 0.02;
        /** Multiplicador de velocidad para SPARKLE_RAIN */
        this.SPARKLE_RAIN_SPEED_MULT = 3.0;
        /** Decay de intensidad (frames para llegar a 0) */
        this.INTENSITY_DECAY = 0.85;
        // ═══════════════════════════════════════════════════════════════════════
        // 👁️🚫 RETINA GUARD - CONSTANTES DE SEGURIDAD INVIOLABLES
        // ═══════════════════════════════════════════════════════════════════════
        this.DEFAULT_SAFETY = {
            horizonLimit: 0.3, // Por defecto: 30% encima de los ojos
            exclusionZone: 0.2, // 20% de margen de seguridad
            maxIntensityNearHorizon: 0.3 // Max 30% cerca del horizonte
        };
        // ═══════════════════════════════════════════════════════════════════════
        // ESTADO INTERNO
        // ═══════════════════════════════════════════════════════════════════════
        this.lastIntensity = 0;
        this.wavePhase = 0;
        this.frameCount = 0;
        this.safetyConfig = { ...this.DEFAULT_SAFETY, ...safetyConfig };
        // WAVE 2098: Boot silence
    }
    // ═══════════════════════════════════════════════════════════════════════
    // API PÚBLICA
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * 🟢 Procesa el input espectral y genera física para láser
     */
    apply(input) {
        this.frameCount++;
        const { ultraAir, clarity, texture, lowMid, energy } = input;
        // ─────────────────────────────────────────────────────────────────────
        // 1. GATE: Si no hay señal ultraAir, el láser DUERME
        // ─────────────────────────────────────────────────────────────────────
        if (ultraAir < this.ULTRA_AIR_GATE) {
            // Decay gradual de la última intensidad
            this.lastIntensity *= this.INTENSITY_DECAY;
            if (this.lastIntensity < 0.01) {
                this.lastIntensity = 0;
            }
            return this.buildStandbyResult(ultraAir, clarity, texture);
        }
        // ─────────────────────────────────────────────────────────────────────
        // 2. DETERMINAR MODO SEGÚN TEXTURA
        // ─────────────────────────────────────────────────────────────────────
        const mode = this.determineMode(texture, clarity);
        // ─────────────────────────────────────────────────────────────────────
        // 3. CALCULAR INTENSIDAD BASE
        // ─────────────────────────────────────────────────────────────────────
        // UltraAir es la fuente principal, con boost de energía general
        const rawIntensity = ultraAir * (0.7 + energy * 0.3);
        // Smoothing para evitar parpadeo (más agresivo que movers)
        this.lastIntensity = this.lastIntensity * 0.4 + rawIntensity * 0.6;
        // ─────────────────────────────────────────────────────────────────────
        // 4. CALCULAR BEAM WIDTH SEGÚN CLARITY
        // ─────────────────────────────────────────────────────────────────────
        // Clarity alta = haz fino y preciso
        // Clarity baja = haz ensanchado/caótico
        const beamWidth = 1.0 - (clarity * 0.8); // 0.2 (limpio) a 1.0 (ruidoso)
        // ─────────────────────────────────────────────────────────────────────
        // 5. CALCULAR SCAN SPEED SEGÚN MODO
        // ─────────────────────────────────────────────────────────────────────
        let scanSpeed;
        let waveOffset;
        if (mode === 'liquid_sky') {
            // LIQUID_SKY: Ondulación suave modulada por LowMid
            scanSpeed = 0.2 + lowMid * 0.3; // 0.2-0.5 (lento, orgánico)
            // Actualizar fase de onda
            this.wavePhase += this.LIQUID_SKY_WAVE_SPEED * (1 + lowMid);
            waveOffset = Math.sin(this.wavePhase) * 0.3; // ±30% de ondulación
        }
        else {
            // SPARKLE_RAIN: Velocidad alta, pseudo-aleatorio basado en ultraAir
            scanSpeed = 0.6 + ultraAir * 0.4; // 0.6-1.0 (rápido, agresivo)
            // "Aleatorio" determinista basado en frame y ultraAir
            // 🚫 NO usamos Math.random() - AXIOMA ANTI-SIMULACIÓN
            const pseudoRandom = Math.sin(this.frameCount * 7.3 + ultraAir * 1000) * 0.5 + 0.5;
            waveOffset = (pseudoRandom - 0.5) * 0.8; // ±40% de variación
        }
        // ─────────────────────────────────────────────────────────────────────
        // 6. 👁️🚫 RETINA GUARD - AUDIENCE CLIPPING
        // ─────────────────────────────────────────────────────────────────────
        const { safeIntensity, safeHorizon, safetyTriggered } = this.applyRetinaGuard(this.lastIntensity, waveOffset);
        // ─────────────────────────────────────────────────────────────────────
        // 7. CONSTRUIR RESULTADO
        // ─────────────────────────────────────────────────────────────────────
        return {
            intensity: safeIntensity,
            beamWidth,
            scanSpeed,
            mode,
            horizonPosition: safeHorizon,
            waveOffset,
            safetyTriggered,
            debugInfo: {
                rawUltraAir: ultraAir,
                rawClarity: clarity,
                textureDetected: texture,
                modeReason: mode === 'liquid_sky'
                    ? 'Clean/Warm texture → Ondulación horizontal'
                    : 'Harsh/Noisy texture → Puntos a alta velocidad'
            }
        };
    }
    /**
     * Actualiza la configuración de seguridad
     */
    updateSafety(config) {
        this.safetyConfig = { ...this.safetyConfig, ...config };
        console.log(`[LaserPhysics] 👁️🚫 RETINA GUARD actualizado: horizonLimit=${this.safetyConfig.horizonLimit}`);
    }
    // ═══════════════════════════════════════════════════════════════════════
    // MÉTODOS PRIVADOS
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Determina el modo de comportamiento según textura y clarity
     */
    determineMode(texture, clarity) {
        // LIQUID_SKY: Sonido limpio o cálido (Trance, Progressive, Épico)
        if (texture === 'clean' || texture === 'warm') {
            return 'liquid_sky';
        }
        // SPARKLE_RAIN: Sonido harsh o ruidoso (Techno Industrial, Glitch)
        if (texture === 'harsh' || texture === 'noisy') {
            return 'sparkle_rain';
        }
        // Fallback basado en clarity
        return clarity > this.CLARITY_PRECISION_THRESHOLD ? 'liquid_sky' : 'sparkle_rain';
    }
    /**
     * 👁️🚫 RETINA GUARD: Protección absoluta de la línea de ojos
     *
     * REGLA INVIOLABLE: El láser NUNCA puede cruzar la línea del horizonte
     * hacia la zona del público. Sin importar lo que diga el efecto.
     */
    applyRetinaGuard(intensity, waveOffset) {
        const { horizonLimit, exclusionZone, maxIntensityNearHorizon } = this.safetyConfig;
        // Calcular posición vertical efectiva (0 = suelo, 1 = techo)
        // waveOffset va de -1 a +1, lo mapeamos a posición vertical
        const verticalPosition = 0.5 + waveOffset * 0.5; // 0 a 1
        // Calcular distancia a la línea de ojos (horizonLimit)
        // horizonLimit está en -1 a +1, lo convertimos a 0-1
        const eyeLineNormalized = (horizonLimit + 1) / 2;
        const distanceToEyeLine = Math.abs(verticalPosition - eyeLineNormalized);
        let safeIntensity = intensity;
        let safetyTriggered = false;
        // ─────────────────────────────────────────────────────────────────────
        // ZONA DE EXCLUSIÓN: Si estamos MUY cerca de la línea de ojos
        // ─────────────────────────────────────────────────────────────────────
        if (distanceToEyeLine < exclusionZone) {
            // Atenuar intensidad exponencialmente
            const attenuation = Math.pow(distanceToEyeLine / exclusionZone, 2);
            safeIntensity = intensity * attenuation * maxIntensityNearHorizon;
            safetyTriggered = true;
        }
        // ─────────────────────────────────────────────────────────────────────
        // CLIP ABSOLUTO: Si el láser intenta ir POR DEBAJO de la línea de ojos
        // hacia el público (verticalPosition < eyeLineNormalized - margin)
        // ─────────────────────────────────────────────────────────────────────
        if (verticalPosition < eyeLineNormalized - 0.1) {
            // KILL absoluto - el láser NO puede apuntar al público
            safeIntensity = 0;
            safetyTriggered = true;
        }
        // Horizonte seguro: siempre por encima de la línea de ojos
        const safeHorizon = Math.max(eyeLineNormalized + 0.1, verticalPosition);
        return { safeIntensity, safeHorizon, safetyTriggered };
    }
    /**
     * Construye resultado cuando el láser está en standby
     */
    buildStandbyResult(ultraAir, clarity, texture) {
        return {
            intensity: this.lastIntensity,
            beamWidth: 0.5,
            scanSpeed: 0,
            mode: 'standby',
            horizonPosition: 0.8, // Apuntando al techo cuando está en standby
            waveOffset: 0,
            safetyTriggered: false,
            debugInfo: {
                rawUltraAir: ultraAir,
                rawClarity: clarity,
                textureDetected: texture,
                modeReason: `UltraAir (${ultraAir.toFixed(2)}) below gate (${this.ULTRA_AIR_GATE})`
            }
        };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════
export const laserPhysics = new LaserPhysics();
