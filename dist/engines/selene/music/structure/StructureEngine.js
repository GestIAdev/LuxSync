/**
 * 🎸 STRUCTURE ENGINE
 * Genera estructura de canción adaptada a duración y estilo
 */
import { SeededRandom } from '../utils/SeededRandom.js';
export class StructureEngine {
    /**
     * Generar estructura completa - REFACTORIZADO CON FIBONACCI
     * Usa calculateSectionDurations para duraciones variables dinámicas
     */
    generateStructure(targetDuration, style, seed, modeConfig) {
        const prng = new SeededRandom(seed);
        // Determinar forma base para guiar la generación
        const baseForm = this.selectForm(targetDuration, style, prng);
        console.log(`[STRUCTURE ENGINE] Generating structure for ${targetDuration}s target duration using Fibonacci-based sections`);
        // USAR FIBONACCI: Calcular todas las secciones con duraciones variables
        const allGeneratedSections = this.calculateSectionDurations(baseForm, targetDuration, style, prng);
        // Asignar perfiles a cada sección generada
        const profiledSections = allGeneratedSections.map(section => this.assignProfile(section, style, modeConfig, prng));
        // Generar transiciones
        const finalSections = this.generateTransitions(profiledSections, style, prng);
        // Calcular duración total real
        const totalSectionDuration = allGeneratedSections.reduce((sum, section) => sum + section.duration, 0);
        const fadeTime = style.temporal.fadeIn + style.temporal.fadeOut;
        console.log(`[STRUCTURE ENGINE] Generated ${finalSections.length} sections with variable durations, total: ${totalSectionDuration.toFixed(2)}s`);
        return {
            totalDuration: totalSectionDuration + fadeTime, // Duración real = suma de secciones + fades
            sections: finalSections,
            globalTempo: style.musical.tempo,
            timeSignature: style.musical.timeSignature,
            transitionStyle: style.temporal.loopable ? 'smooth' : 'silence'
        };
    }
    /**
     * Seleccionar forma musical según duración
     */
    selectForm(duration, style, prng) {
        // Duraciones cortas (<= 60s) - 🔥 BUG #18.B FIX: Frontera lógica corregida
        if (duration <= 60) {
            if (style.temporal.loopable) {
                // Loop simple: A-B-A o A-A-B
                return prng.next() < 0.5
                    ? ['verse', 'chorus', 'verse']
                    : ['verse', 'verse', 'chorus'];
            }
            else {
                // Pieza corta: Intro-A-Outro
                return ['intro', 'verse', 'outro'];
            }
        }
        // Duraciones medias (60-120s)
        else if (duration < 120) {
            // Forma canción clásica: Intro-Verse-Chorus-Verse-Chorus-Outro
            return ['intro', 'verse', 'chorus', 'verse', 'chorus', 'outro'];
        }
        // Duraciones largas (120-180s)
        else if (duration < 180) {
            // Forma extendida con puente
            return [
                'intro',
                'verse',
                'chorus',
                'verse',
                'chorus',
                'bridge',
                'chorus',
                'outro'
            ];
        }
        // Duraciones muy largas (180s+)
        else {
            // Forma compleja con interludios
            return [
                'intro',
                'verse',
                'pre-chorus',
                'chorus',
                'interlude',
                'verse',
                'pre-chorus',
                'chorus',
                'bridge',
                'buildup',
                'chorus',
                'outro'
            ];
        }
    }
    calculateSectionDurations(form, totalDuration, style, prng) {
        const fadeTime = style.temporal.fadeIn + style.temporal.fadeOut;
        // 🔥 BUG #18 FIX DEFINITIVO (DIRECTIVA ARQUITECTO): NO restar fadeTime para presupuesto
        // La totalDuration solicitada debe ser la base para el cálculo del presupuesto de compases musicales
        const usableDuration = totalDuration; // ✅ CORRECTO: usar totalDuration completa
        const beatsPerBar = style.musical.timeSignature[0];
        const bpm = style.musical.tempo;
        const secondsPerBar = (60 / bpm) * beatsPerBar;
        // ¡ARQUITECTURA CORRECTA Y VERIFICADA!
        // 1. Calcular Presupuesto (Redondeo NORMAL, no floor)
        const totalBarsToAssign = Math.round(usableDuration / secondsPerBar);
        let barsRemaining = totalBarsToAssign;
        const sections = [];
        let currentTime = style.temporal.fadeIn;
        // 2. Definir patrones de duración VARIABLES (Fibonacci-inspired)
        // Intro/Outro: 4 bars (cortos)
        // Verse/Pre-chorus: 8 bars (estándar)
        // Chorus: 8-12 bars (expandidos)
        // Bridge/Buildup: 6-8 bars (tensión)
        // Interlude: 4-6 bars (transición)
        const sectionBarPatterns = {
            'intro': [4, 6],
            'verse': [8, 12],
            'pre-chorus': [6, 8],
            'chorus': [8, 12, 16],
            'interlude': [4, 6, 8],
            'bridge': [8, 12],
            'buildup': [6, 8],
            'breakdown': [6, 8],
            'drop': [8, 12],
            'outro': [4, 6, 8]
        };
        for (let i = 0; i < form.length; i++) {
            const sectionType = form[i];
            let barsForThisSection = 0;
            if (i === form.length - 1) {
                // *** ÚLTIMA SECCIÓN ***
                // La última sección se queda con TODOS los compases restantes.
                barsForThisSection = Math.max(4, barsRemaining); // Mínimo 4 compases (outro decente)
            }
            else {
                // *** SECCIONES INTERMEDIAS ***
                // 🎭 DIRECTIVA 32A: Seleccionar duración del patrón Fibonacci
                const patterns = sectionBarPatterns[sectionType] || [8];
                const chosenPattern = prng.choice(patterns); // Elige variación aleatoria
                const sectionsRemaining = form.length - i; // Total restante
                // Si hay suficiente presupuesto, usar patrón Fibonacci
                if (barsRemaining >= chosenPattern + (sectionsRemaining - 1) * 4) {
                    // Hay suficiente para esta sección + mínimo 4 bars para cada restante
                    barsForThisSection = chosenPattern;
                }
                else {
                    // Presupuesto ajustado: dividir equitativamente lo restante
                    barsForThisSection = Math.max(4, Math.floor(barsRemaining / sectionsRemaining));
                }
            }
            // Restar del presupuesto
            barsRemaining -= barsForThisSection;
            // Calcular duración real y crear la sección
            const sectionDuration = barsForThisSection * secondsPerBar;
            sections.push({
                id: `${sectionType}-${i}`,
                type: sectionType,
                index: i,
                startTime: currentTime,
                duration: sectionDuration,
                bars: barsForThisSection,
                profile: null,
                transition: null
            });
            // 🔥 FASE 5.3 (SCHERZO QUIRÚRGICO): Prevenir drift de precisión flotante
            // IEEE 754 acumula errores en cada suma. Redondear a 12 decimales (picosegundos)
            currentTime += sectionDuration;
            currentTime = Math.round(currentTime * 1e12) / 1e12;
            console.log(`[STRUCTURE ENGINE] Section ${i + 1} (${sectionType}): ${barsForThisSection} bars = ${sectionDuration.toFixed(2)}s. Remaining bars: ${barsRemaining}`);
        }
        // VALIDACIÓN
        const totalSectionDuration = sections.reduce((sum, s) => sum + s.duration, 0);
        const actualTotalBars = sections.reduce((sum, s) => sum + s.bars, 0);
        console.log(`[STRUCTURE ENGINE] Budget validation: Target=${totalBarsToAssign} bars, Actual=${actualTotalBars} bars`);
        // Advertir si la matemática falló (no debería ocurrir)
        if (actualTotalBars > totalBarsToAssign) {
            console.warn(`[STRUCTURE ENGINE] ⚠️ Budget MISMATCH! Overspent budget. Expected ${totalBarsToAssign}, got ${actualTotalBars}.`);
        }
        return sections;
    }
    /**
     * Asignar perfil musical a sección
     */
    assignProfile(section, style, mode, prng) {
        const type = section.type;
        let profile;
        // Perfiles por tipo de sección
        switch (type) {
            case 'intro':
                profile = {
                    intensity: 0.3,
                    layerDensity: 0.4,
                    harmonicComplexity: 0.3,
                    melodicDensity: 0.4,
                    rhythmicDensity: 0.2,
                    tempoMultiplier: 1.0,
                    characteristics: {
                        repetitive: false,
                        motivic: true,
                        transitional: false,
                        climactic: false,
                        atmospheric: true
                    }
                };
                break;
            case 'verse':
                profile = {
                    intensity: 0.5,
                    layerDensity: 0.6,
                    harmonicComplexity: 0.5,
                    melodicDensity: 0.7,
                    rhythmicDensity: 0.6,
                    tempoMultiplier: 1.0,
                    characteristics: {
                        repetitive: true,
                        motivic: true,
                        transitional: false,
                        climactic: false,
                        atmospheric: false
                    }
                };
                break;
            case 'chorus':
                profile = {
                    intensity: 0.9,
                    layerDensity: 0.9,
                    harmonicComplexity: 0.6,
                    melodicDensity: 0.8,
                    rhythmicDensity: 0.9,
                    tempoMultiplier: 1.0,
                    characteristics: {
                        repetitive: true,
                        motivic: true,
                        transitional: false,
                        climactic: true,
                        atmospheric: false
                    }
                };
                break;
            case 'bridge':
                profile = {
                    intensity: 0.7,
                    layerDensity: 0.7,
                    harmonicComplexity: 0.8,
                    melodicDensity: 0.6,
                    rhythmicDensity: 0.5,
                    tempoMultiplier: 0.9,
                    modulation: {
                        type: 'relative',
                        targetRoot: 5 // Modular a quinta
                    },
                    characteristics: {
                        repetitive: false,
                        motivic: false,
                        transitional: true,
                        climactic: false,
                        atmospheric: false
                    }
                };
                break;
            case 'outro':
                profile = {
                    intensity: 0.4,
                    layerDensity: 0.5,
                    harmonicComplexity: 0.4,
                    melodicDensity: 0.3,
                    rhythmicDensity: 0.3,
                    tempoMultiplier: 0.95,
                    characteristics: {
                        repetitive: false,
                        motivic: true,
                        transitional: false,
                        climactic: false,
                        atmospheric: true
                    }
                };
                break;
            // ... otros tipos de sección
            default:
                profile = {
                    intensity: 0.6,
                    layerDensity: 0.6,
                    harmonicComplexity: 0.5,
                    melodicDensity: 0.6,
                    rhythmicDensity: 0.6,
                    tempoMultiplier: 1.0,
                    characteristics: {
                        repetitive: false,
                        motivic: true,
                        transitional: false,
                        climactic: false,
                        atmospheric: false
                    }
                };
        }
        // Aplicar influencia de modo
        const punkFactor = mode.punkProbability / 100;
        profile.intensity *= (1 + punkFactor * 0.3);
        profile.layerDensity *= (1 + punkFactor * 0.2);
        profile.rhythmicDensity *= (1 + punkFactor * 0.4);
        return {
            ...section,
            profile
        };
    }
    /**
     * Generar secuencia Fibonacci
     */
    generateFibonacci(length) {
        if (length === 0)
            return [];
        if (length === 1)
            return [1];
        if (length === 2)
            return [1, 1];
        const fib = [1, 1];
        for (let i = 2; i < length; i++) {
            fib.push(fib[i - 1] + fib[i - 2]);
        }
        return fib;
    }
    /**
     * Generar transiciones entre secciones
     */
    generateTransitions(sections, style, prng) {
        for (let i = 0; i < sections.length - 1; i++) {
            const current = sections[i];
            const next = sections[i + 1];
            // Determinar tipo de transición según contexto
            let transitionType = 'direct';
            if (current.type === 'verse' && next.type === 'chorus') {
                transitionType = prng.next() < 0.5 ? 'buildup' : 'direct';
            }
            else if (current.type === 'bridge' && next.type === 'chorus') {
                transitionType = 'buildup';
            }
            else if (current.type === 'chorus' && next.type === 'outro') {
                transitionType = 'fade';
            }
            else if (next.type === 'breakdown') {
                transitionType = 'breakdown';
            }
            current.transition = {
                type: transitionType,
                duration: transitionType === 'direct' ? 0 : 1.0,
                characteristics: {
                    crescendo: transitionType === 'buildup',
                    accelerando: transitionType === 'buildup' && prng.next() < 0.3,
                    fillPattern: transitionType === 'buildup' ? 'drum' : undefined
                }
            };
        }
        return sections;
    }
}
//# sourceMappingURL=StructureEngine.js.map