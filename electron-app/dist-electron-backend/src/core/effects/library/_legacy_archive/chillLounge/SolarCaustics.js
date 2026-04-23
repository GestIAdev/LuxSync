/**
 * ☀️ SOLAR CAUSTICS - Rayos de Sol Descendiendo en SHALLOWS (0-1000m)
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 1073: OCEANIC CALIBRATION - Desplazamiento REAL estilo TidalWave
 * WAVE 1080: FLUID DYNAMICS - Composición Alpha para transiciones suaves
 * WAVE 1081: VOLUMETRIC SUN - Intensity Floor + Atmospheric Fill
 * WAVE 1081.2: SOLAR FLARE OPTIMIZATION - El Sol NO pierde potencia en 5m
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * CONCEPTO ARTÍSTICO:
 * Rayos de luz solar penetrando el agua desde la superficie,
 * descendiendo LENTAMENTE desde los movers (arriba) hacia el front (fondo).
 *
 * ZONAS (de arriba a abajo - DESPLAZAMIENTO VERTICAL):
 *  - MOVERS: Superficie del agua - donde entran los rayos (100% intensidad)
 *  - BACK: Zona media del agua (80% intensidad, ligeramente disperso)
 *  - FRONT: Fondo oceánico (60% intensidad, disperso y tenue)
 *
 * MECÁNICA WAVE 1073:
 * - DESPLAZAMIENTO VERTICAL: Inspirado en TidalWave pero LENTO (chill)
 * - 2 RAYOS ESTÉREO: L y R con desfase temporal
 * - CRUCE DIAGONAL: El rayo puede cruzar de L a R durante el descenso
 * - mixBus='global' + blendMode='replace': El rayo MANDA (override completo)
 * - Movimiento de movers ULTRA LENTO (protección movers chinos)
 *
 * WAVE 1080: FLUID DYNAMICS
 * - globalComposition: 0→1 al inicio (fade in), 1→0 al final (fade out)
 * - Elimina los "blackouts" bruscos al terminar
 * - El océano "sangra" a través de los rayos mientras desaparecen
 *
 * WAVE 1081: VOLUMETRIC SUN
 * - Intensity Floor: Desacoplado del trigger (minIntensity garantizado)
 * - Volumetric Fill: Relleno atmosférico dorado base (18% en todas las zonas)
 * - Resultado: Los rayos caen sobre una atmósfera dorada, no sobre negro
 *
 * HSL FORMAT: h(0-360), s(0-100), l(0-100)
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 6500, // 🌊 WAVE 1073.2: 6.5s (ajustado a rayDescentsMs + overlap)
    peakIntensity: 0.95, // 🌊 WAVE 1073.1: Subido de 0.70 a 0.95 (necesita más punch con global)
    rayOffsetMs: 1200, // 🌊 WAVE 1073.2: 1.2s desfase (más overlap visual)
    crossProbability: 0.35, // 35% de probabilidad de cruce diagonal
    rayDescentMs: 5000, // 🌊 WAVE 1073.2: 5 segundos por rayo (duración=1200+5000=6200 + margen)
    fadeInMs: 800, // 🌊 WAVE 1080: 800ms para fade in suave (azul→dorado)
    fadeOutMs: 1200, // 🌊 WAVE 1080: 1200ms para fade out más lento (dorado→azul)
    volumetricFill: 0.20, // ☀️ WAVE 1081.2: 20% de relleno atmosférico dorado (subido de 18%)
    minIntensity: 0.75, // ☀️ WAVE 1081: Intensidad mínima garantizada (independiente del trigger)
};
// ═══════════════════════════════════════════════════════════════════════════
// COLORES DE LUZ SOLAR SUBMARINA
// ═══════════════════════════════════════════════════════════════════════════
const SUNLIGHT_COLORS = {
    // En superficie: dorado brillante
    surface: { h: 48, s: 90, l: 65 },
    // En zona media: ámbar más suave
    middle: { h: 44, s: 82, l: 58 },
    // En el fondo: dorado pálido disperso
    deep: { h: 50, s: 70, l: 50 },
};
// ═══════════════════════════════════════════════════════════════════════════
// CLASE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export class SolarCaustics extends BaseEffect {
    constructor(config) {
        super('solar_caustics');
        this.effectType = 'solar_caustics';
        this.name = 'Solar Caustics';
        this.category = 'physical';
        this.priority = 68;
        this.mixBus = 'global'; // 🌊 WAVE 1073: GLOBAL = Override completo (como TidalWave)
        this.rays = [];
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * 🎬 TRIGGER - Configura los 2 rayos con sus características
     */
    trigger(triggerConfig) {
        super.trigger(triggerConfig);
        // Decidir si cada rayo cruza (basado en timestamp para determinismo)
        const now = Date.now();
        const rayLCrosses = (now % 100) < (this.config.crossProbability * 100);
        const rayRCrosses = ((now + 37) % 100) < (this.config.crossProbability * 100);
        // Configurar los 2 rayos
        this.rays = [
            {
                id: 'L',
                startMs: 0, // El rayo L empieza inmediatamente
                crosses: rayLCrosses,
                startSide: 'L', // Empieza en la izquierda
            },
            {
                id: 'R',
                startMs: this.config.rayOffsetMs, // El rayo R empieza con delay
                crosses: rayRCrosses,
                startSide: 'R', // Empieza en la derecha
            },
        ];
        const crossInfo = [
            rayLCrosses ? 'L→R' : 'L',
            rayRCrosses ? 'R→L' : 'R',
        ].join(', ');
        console.log(`[CAUSTICS ☀️] 2 rays descending: ${crossInfo}`);
    }
    /**
     * 🔄 UPDATE - Avanza el tiempo del efecto
     */
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        if (this.elapsedMs >= this.config.durationMs) {
            this.phase = 'finished';
        }
    }
    /**
     * 🌊 Calcula la profundidad de descenso de un rayo (0=superficie, 1=fondo)
     */
    getRayDepth(rayStartMs) {
        const rayElapsed = this.elapsedMs - rayStartMs;
        if (rayElapsed < 0)
            return -1; // Rayo no ha empezado
        const descent = Math.min(rayElapsed / this.config.rayDescentMs, 1);
        return descent;
    }
    /**
     * 💡 Calcula la intensidad de un rayo en una zona específica
     * Fade-in rápido, fade-out lento (dispersión en agua)
     */
    getZoneIntensity(rayDepth, zoneDepth, zoneAttenuation) {
        if (rayDepth < 0)
            return 0; // Rayo no ha empezado
        // ☀️ WAVE 1081.2: SOLAR FLARE OPTIMIZATION
        // frontWidth aumentado de 0.35 a 0.65 = haz más ancho, más tiempo en 1.0
        const frontWidth = 0.65;
        const distance = rayDepth - zoneDepth;
        let intensity;
        if (distance < -frontWidth) {
            intensity = 0;
        }
        else if (distance < 0) {
            // Fade-in rápido
            const fadeIn = 1 - Math.abs(distance) / frontWidth;
            intensity = fadeIn ** 0.8;
        }
        else if (distance < frontWidth * 2) {
            // Fade-out lento (dispersión en agua)
            const fadeOut = 1 - (distance / (frontWidth * 2));
            intensity = fadeOut ** 1.5;
        }
        else {
            intensity = 0;
        }
        return intensity * zoneAttenuation;
    }
    /**
     * 🎨 Obtiene el color para una profundidad específica
     */
    getColorForDepth(depth) {
        if (depth < 0.4) {
            const t = depth / 0.4;
            return {
                h: SUNLIGHT_COLORS.surface.h + (SUNLIGHT_COLORS.middle.h - SUNLIGHT_COLORS.surface.h) * t,
                s: SUNLIGHT_COLORS.surface.s + (SUNLIGHT_COLORS.middle.s - SUNLIGHT_COLORS.surface.s) * t,
                l: SUNLIGHT_COLORS.surface.l + (SUNLIGHT_COLORS.middle.l - SUNLIGHT_COLORS.surface.l) * t,
            };
        }
        else {
            const t = (depth - 0.4) / 0.6;
            return {
                h: SUNLIGHT_COLORS.middle.h + (SUNLIGHT_COLORS.deep.h - SUNLIGHT_COLORS.middle.h) * t,
                s: SUNLIGHT_COLORS.middle.s + (SUNLIGHT_COLORS.deep.s - SUNLIGHT_COLORS.middle.s) * t,
                l: SUNLIGHT_COLORS.middle.l + (SUNLIGHT_COLORS.deep.l - SUNLIGHT_COLORS.middle.l) * t,
            };
        }
    }
    /**
     * 📤 GET OUTPUT - Genera el frame de salida
     * 🌊 WAVE 1080: Ahora incluye globalComposition para transiciones suaves
     */
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const progress = this.elapsedMs / this.config.durationMs;
        // ═══════════════════════════════════════════════════════════════════════
        // 🌊 WAVE 1080: FLUID DYNAMICS - Calcular globalComposition (0-1)
        // Fade In: 0→1 durante los primeros fadeInMs
        // Sustain: 1.0 durante el cuerpo del efecto
        // Fade Out: 1→0 durante los últimos fadeOutMs
        // ═══════════════════════════════════════════════════════════════════════
        let globalComposition;
        const fadeOutStart = this.config.durationMs - this.config.fadeOutMs;
        if (this.elapsedMs < this.config.fadeInMs) {
            // FADE IN: 0 → 1 (suave, cuadrático)
            const fadeInProgress = this.elapsedMs / this.config.fadeInMs;
            globalComposition = fadeInProgress ** 1.5; // Ease-in suave
        }
        else if (this.elapsedMs > fadeOutStart) {
            // FADE OUT: 1 → 0 (más lento, cuadrático inverso)
            const fadeOutProgress = (this.elapsedMs - fadeOutStart) / this.config.fadeOutMs;
            globalComposition = (1 - fadeOutProgress) ** 1.5; // Ease-out suave
        }
        else {
            // SUSTAIN: 1.0 (efecto a máxima opacidad)
            globalComposition = 1.0;
        }
        // Envelope global (ya existente para intensidad)
        let globalEnvelope;
        if (progress < 0.15) {
            globalEnvelope = (progress / 0.15) ** 1.5;
        }
        else if (progress > 0.85) {
            globalEnvelope = ((1 - progress) / 0.15) ** 1.5;
        }
        else {
            globalEnvelope = 1.0;
        }
        // Profundidades y atenuaciones de las zonas
        // ☀️ WAVE 1081.2: SOLAR FLARE OPTIMIZATION - El Sol NO pierde potencia en 5m de agua
        const ZONE_DEPTHS = { movers: 0.0, back: 0.45, front: 1.0 };
        const ZONE_ATTENUATION = { movers: 1.0, back: 1.0, front: 1.0 };
        // Acumuladores de intensidad por zona
        const intensities = {
            movers_left: 0, movers_right: 0,
            backL: 0, backR: 0,
            frontL: 0, frontR: 0,
        };
        // Procesar cada rayo
        for (const ray of this.rays) {
            const rayDepth = this.getRayDepth(ray.startMs);
            if (rayDepth < 0)
                continue;
            // Determinar qué lado ilumina este rayo
            let sideAtDepth;
            if (ray.crosses) {
                if (rayDepth < 0.3) {
                    sideAtDepth = ray.startSide;
                }
                else if (rayDepth < 0.7) {
                    sideAtDepth = 'both';
                }
                else {
                    sideAtDepth = ray.startSide === 'L' ? 'R' : 'L';
                }
            }
            else {
                sideAtDepth = ray.id;
            }
            // Calcular intensidad para cada zona
            const moverInt = this.getZoneIntensity(rayDepth, ZONE_DEPTHS.movers, ZONE_ATTENUATION.movers);
            const backInt = this.getZoneIntensity(rayDepth, ZONE_DEPTHS.back, ZONE_ATTENUATION.back);
            const frontInt = this.getZoneIntensity(rayDepth, ZONE_DEPTHS.front, ZONE_ATTENUATION.front);
            // Asignar a los lados correspondientes (HTP)
            if (sideAtDepth === 'L' || sideAtDepth === 'both') {
                intensities.movers_left = Math.max(intensities.movers_left, moverInt);
                intensities.backL = Math.max(intensities.backL, backInt);
                intensities.frontL = Math.max(intensities.frontL, frontInt);
            }
            if (sideAtDepth === 'R' || sideAtDepth === 'both') {
                intensities.movers_right = Math.max(intensities.movers_right, moverInt);
                intensities.backR = Math.max(intensities.backR, backInt);
                intensities.frontR = Math.max(intensities.frontR, frontInt);
            }
        }
        // Shimmer sutil de refracción
        const shimmerL = Math.sin(progress * Math.PI * 4) * 0.08 + 0.92;
        const shimmerR = Math.sin(progress * Math.PI * 4 + 0.7) * 0.08 + 0.92;
        // Colores por profundidad
        const colorMovers = this.getColorForDepth(ZONE_DEPTHS.movers);
        const colorBack = this.getColorForDepth(ZONE_DEPTHS.back);
        const colorFront = this.getColorForDepth(ZONE_DEPTHS.front);
        // 🚨 WAVE 2690: rayPan/rayTilt movement PURGED — Selene no conduce posiciones
        // ═══════════════════════════════════════════════════════════════════════
        // ☀️ WAVE 1081: VOLUMETRIC SUN - Intensity Floor + Atmospheric Fill
        // ═══════════════════════════════════════════════════════════════════════
        // 1. INTENSITY FLOOR: Desacoplar del trigger para garantizar visibilidad
        //    Problema: trigger * dna * peak = 0.04 (invisible)
        //    Solución: Usar mínimo garantizado
        const effectiveInput = Math.max(this.triggerIntensity, this.config.minIntensity);
        const finalIntensity = globalEnvelope * this.config.peakIntensity * effectiveInput;
        // 2. VOLUMETRIC FILL: Relleno atmosférico base en todas las zonas
        //    Esto crea la "atmósfera dorada" sobre la que caen los rayos brillantes
        const volumetricAmbient = this.config.volumetricFill * globalEnvelope * effectiveInput;
        // ═══════════════════════════════════════════════════════════════════════
        // 🌊 WAVE 1080: FLUID DYNAMICS - El output ahora incluye globalComposition
        // Esto permite que TitanOrchestrator haga LERP suave entre física y efecto
        // ═══════════════════════════════════════════════════════════════════════
        const output = {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: ['frontL', 'frontR', 'backL', 'backR', 'movers-left', 'movers-right'],
            intensity: finalIntensity,
            globalComposition, // 🌊 WAVE 1080: Alpha de opacidad (0-1)
            zoneOverrides: {},
        };
        // ☀️ WAVE 1081: Aplicar volumetric fill (MAX entre rayo y ambiente)
        // Cada zona brilla por el rayo O por el ambiente dorado base
        // MOVERS: Rayos de sol — solo color/dimmer (WAVE 2690: movement PURGED)
        output.zoneOverrides['movers-left'] = {
            dimmer: Math.max(intensities.movers_left * shimmerL * finalIntensity, volumetricAmbient),
            color: colorMovers,
            blendMode: 'replace', // 🌊 WAVE 1073: REPLACE = El rayo manda
            // 🚨 WAVE 2690: movement PURGED — Selene solo pinta fotones
        };
        output.zoneOverrides['movers-right'] = {
            dimmer: Math.max(intensities.movers_right * shimmerR * finalIntensity, volumetricAmbient),
            color: colorMovers,
            blendMode: 'replace',
            // 🚨 WAVE 2690: movement PURGED
        };
        // BACK: Zona media
        output.zoneOverrides['backL'] = {
            dimmer: Math.max(intensities.backL * shimmerL * finalIntensity, volumetricAmbient),
            color: colorBack,
            blendMode: 'replace',
        };
        output.zoneOverrides['backR'] = {
            dimmer: Math.max(intensities.backR * shimmerR * finalIntensity, volumetricAmbient),
            color: colorBack,
            blendMode: 'replace',
        };
        // FRONT: Fondo oceánico
        output.zoneOverrides['frontL'] = {
            dimmer: Math.max(intensities.frontL * shimmerL * finalIntensity, volumetricAmbient),
            color: colorFront,
            blendMode: 'replace',
        };
        output.zoneOverrides['frontR'] = {
            dimmer: Math.max(intensities.frontR * shimmerR * finalIntensity, volumetricAmbient),
            color: colorFront,
            blendMode: 'replace',
        };
        return output;
    }
    isFinished() { return this.phase === 'finished'; }
    abort() { this.phase = 'finished'; }
}
