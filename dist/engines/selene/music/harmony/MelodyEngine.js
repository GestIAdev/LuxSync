/**
 * 🎵 MELODY ENGINE
 * Motor de melodía para generar líneas melódicas
 */
import { SeededRandom } from '../utils/SeededRandom.js';
/**
 * Motor de melodía principal
 */
export class MelodyEngine {
    random;
    constructor(seed = 42) {
        this.random = new SeededRandom(seed);
    }
    /**
     * Generar melodía completa con selección dinámica de instrumento
     * 🎸 FRENTE #5.2: SELECCIÓN DINÁMICA (Cerebro)
     *
     * ARQUITECTURA:
     * - Devuelve { notes, instrumentKey } (no solo notas)
     * - instrumentKey seleccionado basado en section.type + intensity
     *
     * IMPROVISACIÓN:
     * - chorus + intensity > 0.8 → synth-lead/pulse-buzz-lead (láser cyberpunk)
     * - intro/outro atmospheric → vocal-chops/angelicalvoice (etéreo)
     * - verse/pre-chorus moderado → electric-piano/MED (suave, orgánico)
     * - bridge/buildup → synth-lead/pulse-buzz-lead (drama, tensión)
     *
     * @param options Opciones de generación
     * @returns { notes, instrumentKey }
     */
    generateMelody(options) {
        const { section, key, mode, complexity, contour, range, seed } = options;
        // ✅ USAR section.duration, section.tempo DIRECTAMENTE
        const duration = section.duration;
        const tempo = section.profile?.tempoMultiplier
            ? (section.profile.tempoMultiplier * 120) // TODO: Obtener tempo base de StylePreset
            : 120; // Fallback
        // 🔥 DETERMINISMO: Re-inicializar random con el seed proporcionado
        this.random = new SeededRandom(seed);
        // 🎸 FRENTE #5.2: SELECCIÓN DINÁMICA DE INSTRUMENTO
        const instrumentKey = this.selectInstrument(section);
        console.log(`🎸 [MELODY ENGINE] Section '${section.type}' (intensity=${section.profile?.intensity?.toFixed(2) || 0.5}) → Instrumento: ${instrumentKey}`);
        // Generar motivo base
        const motif = this.generateMotif(key, mode, complexity, tempo, section);
        // Aplicar transformaciones según complejidad
        const transformedMotif = this.applyTransformations(motif, complexity);
        // Desarrollar motivo en frase completa
        const phrase = this.developPhrase(transformedMotif, duration, tempo, contour);
        // Aplicar contorno melódico
        const contouredPhrase = this.applyContour(phrase, contour, range);
        // ✅ AJUSTAR startTime para incluir offset de sección
        const melody = contouredPhrase.map(note => ({
            ...note,
            startTime: note.startTime + section.startTime
        }));
        // ✅ VALIDACIÓN: Asegurar que no excedemos section.duration
        const sectionEnd = section.startTime + section.duration;
        const lastNote = melody[melody.length - 1];
        if (lastNote && (lastNote.startTime + lastNote.duration) > sectionEnd) {
            const excess = (lastNote.startTime + lastNote.duration) - sectionEnd;
            console.warn(`[MELODY DEBUG] Last note exceeds section end by ${excess.toFixed(2)}s, truncating`);
            lastNote.duration = Math.max(0.1, lastNote.duration - excess);
        }
        // 🔍 DEBUG: Log first 5 notes después de contour
        console.log(`[MELODY DEBUG] Section ${section.index}: Generated ${melody.length} notes, duration: ${duration.toFixed(2)}s`);
        melody.slice(0, 5).forEach((note, i) => {
            console.log(`  [${i}] pitch=${note.pitch}, startTime=${note.startTime.toFixed(3)}s, duration=${note.duration.toFixed(3)}s`);
        });
        // 🎸 FRENTE #5.2: Devolver notas + instrumentKey
        return {
            notes: melody,
            instrumentKey
        };
    }
    /**
     * 🎨 IMPROVISACIÓN: Selección de instrumento basada en section.type + intensity
     *
     * Estrategia (Cyberpunk-Ambient):
     * - HIGH INTENSITY (chorus, climax): synth-lead/pulse-buzz-lead (láser cortante)
     * - ATMOSPHERIC (intro, outro): vocal-chops/angelicalvoice (etéreo, espacial)
     * - MODERATE (verse, pre-chorus): electric-piano/MED (orgánico, suave)
     * - TENSION (bridge, buildup): synth-lead/pulse-buzz-lead (drama)
     */
    selectInstrument(section) {
        const intensity = section.profile?.intensity ?? 0.5;
        const sectionType = section.type;
        // 🔥 IMPROVISACIÓN: 3 categorías de instrumentos
        // 1. SYNTH-LEAD: High intensity, drama, tensión
        if (intensity > 0.8 || sectionType === 'chorus' || sectionType === 'drop' || sectionType === 'buildup') {
            return 'synth-lead/pulse-buzz-lead'; // Láser cyberpunk
        }
        // 2. VOCAL-CHOPS: Atmospheric, etéreo
        if (sectionType === 'intro' || sectionType === 'outro' || sectionType === 'interlude') {
            return 'vocal-chops/angelicalvoice'; // Etéreo, espacial
        }
        // 3. ELECTRIC-PIANO: Moderate, orgánico, safe
        // verse, pre-chorus, bridge (intensity < 0.8)
        return 'electric-piano/MED'; // Suave, orgánico
    }
    /**
     * Generar motivo melódico base
     * ✅ BUG #25 FIX RADICAL (ARQUITECTO-33A): FRASES CANTABLES
     * - Escalas restrictivas (pentatónicas para cyberpunk)
     * - Saltos máximos de 5 semitonos (4ta justa)
     * - Motivos de 3-4 notas (memor

ables)
     */
    generateMotif(key, mode, complexity, tempo, section) {
        const intensity = section.profile?.intensity ?? 0.5;
        const sectionType = section.type;
        // 🔥 ARQUITECTO-33A: Motivos más cortos (3-4 notas, no 4-8)
        const motifLength = complexity > 0.7 ? 4 : 3;
        const motif = [];
        // 🎨 FRENTE #5.5: Selección de escala dinámica basada en intensidad
        let scale;
        let MAX_MELODIC_INTERVAL;
        if (intensity > 0.8 || sectionType === 'chorus' || sectionType === 'drop' || sectionType === 'bridge') {
            // 🔥 DIATÓNICA (7 notas): Tensión, drama, chorus explosivo
            scale = this.getDiatonicScale(key, mode);
            MAX_MELODIC_INTERVAL = 12; // Hasta 8va (salto dramático)
            console.log(`🎵 [MELODY MOTIF] DIATÓNICA (intensity=${intensity.toFixed(2)}, section=${sectionType}) → max salto: 8va`);
        }
        else if (intensity >= 0.5 && intensity <= 0.8) {
            // 🎶 PENTATÓNICA + 5ta: Moderado, pre-chorus, buildup
            scale = this.getRestrictiveScale(key, mode);
            MAX_MELODIC_INTERVAL = 7; // Hasta 5ta (salto moderado)
            console.log(`🎵 [MELODY MOTIF] PENTATÓNICA (intensity=${intensity.toFixed(2)}, section=${sectionType}) → max salto: 5ta`);
        }
        else {
            // 🎹 PENTATÓNICA: Safe, cantable, verse/intro tranquilo
            scale = this.getRestrictiveScale(key, mode);
            MAX_MELODIC_INTERVAL = 5; // Max 4ta (salto conservador)
            console.log(`🎵 [MELODY MOTIF] PENTATÓNICA CONSERVADORA (intensity=${intensity.toFixed(2)}, section=${sectionType}) → max salto: 4ta`);
        }
        let currentTime = 0;
        let previousPitch = this.random.choice(scale) + (4 * 12); // Octava 4
        for (let i = 0; i < motifLength; i++) {
            // 🎨 FRENTE #5.5: SILENCIOS (Rests) entre frases
            // 20% probabilidad de silencio en lugar de nota (excepto primera nota)
            if (i > 0 && this.random.next() < 0.2) {
                const restDuration = this.getFibonacciDuration(i, motifLength, sectionType);
                console.log(`🎵 [MELODY MOTIF] Silencio (rest) insertado: ${restDuration.toFixed(2)}s`);
                currentTime += restDuration;
                continue; // Saltar generación de nota
            }
            // Generar pitch con restricción de salto
            let pitch;
            let attempts = 0;
            do {
                pitch = this.random.choice(scale) + (4 * 12); // Octava 4
                attempts++;
                // 🎨 FRENTE #5.5: SALTOS DRAMÁTICOS en momentos de alta intensidad
                // Si intensity > 0.8 y es el último pitch (climax del motivo), permitir salto dramático
                const isClimax = (i === motifLength - 1) && (intensity > 0.8);
                if (isClimax && attempts < 3) {
                    // Forzar salto dramático (6ta, 7ma, 8va)
                    const dramaticIntervals = [9, 10, 11, 12]; // 6ta mayor, 7ma menor, 7ma mayor, 8va
                    const interval = this.random.choice(dramaticIntervals);
                    pitch = previousPitch + (this.random.next() > 0.5 ? interval : -interval);
                    console.log(`🎵 [MELODY MOTIF] SALTO DRAMÁTICO: ${interval} semitonos (climax)`);
                    break;
                }
                if (attempts > 10) {
                    // Fallback: usar pitch anterior ± 2 semitonos
                    pitch = previousPitch + this.random.choice([-2, -1, 0, 1, 2]);
                    break;
                }
            } while (Math.abs(pitch - previousPitch) > MAX_MELODIC_INTERVAL);
            const durationSeconds = this.getFibonacciDuration(i, motifLength, sectionType);
            // Calculate velocity with musical intelligence
            const baseVelocity = 80;
            const contourVelocity = this.calculateDynamicVelocity(i, motifLength);
            const accentVelocity = (i % 4 === 0) ? 15 : 0; // Accent downbeats
            const microVariation = this.random.nextInt(-5, 5);
            const velocity = Math.min(127, Math.max(40, baseVelocity + contourVelocity + accentVelocity + microVariation));
            motif.push({
                pitch,
                velocity,
                startTime: currentTime,
                duration: durationSeconds
            });
            previousPitch = pitch; // Actualizar para siguiente nota
            currentTime += durationSeconds;
        }
        return motif;
    }
    /**
     * 🎨 FRENTE #5.5: Obtener escala DIATÓNICA completa (7 notas)
     * Usado en chorus/bridge para crear tensión y drama
     */
    getDiatonicScale(key, mode) {
        const scales = {
            'major': [0, 2, 4, 5, 7, 9, 11], // Diatónica mayor (7 notas)
            'minor': [0, 2, 3, 5, 7, 8, 10], // Diatónica menor natural (7 notas)
            'dorian': [0, 2, 3, 5, 7, 9, 10], // Dorian completo (7 notas)
            'phrygian': [0, 1, 3, 5, 7, 8, 10], // Phrygian completo (7 notas)
            'lydian': [0, 2, 4, 6, 7, 9, 11], // Lydian completo (7 notas, 4ta aumentada)
            'mixolydian': [0, 2, 4, 5, 7, 9, 10], // Mixolydian completo (7 notas)
            'pentatonic': [0, 2, 4, 7, 9], // Fallback pentatónica
            'blues': [0, 3, 5, 6, 7, 10] // Blues (6 notas)
        };
        const intervals = scales[mode] || scales['major'];
        return intervals.map(interval => key + interval);
    }
    /**
     * 🔥 ARQUITECTO-33A: Escalas RESTRICTIVAS (pentatónicas y blues)
     * Solo 5 notas por escala (vs 7 notas en escalas mayores/menores)
     * Resultado: Saltos más pequeños, frases más cantables
     */
    getRestrictiveScale(key, mode) {
        // 🔥 FORZAR PENTATÓNICA PARA CYBERPUNK (más restrictiva)
        const scales = {
            'major': [0, 2, 4, 7, 9], // Pentatónica mayor (5 notas)
            'minor': [0, 3, 5, 7, 10], // Pentatónica menor (5 notas)
            'dorian': [0, 2, 3, 7, 9], // Pentatónica dorian (5 notas)
            'phrygian': [0, 1, 5, 7, 10], // Pentatónica phrygian (5 notas)
            'lydian': [0, 2, 4, 7, 9], // Pentatónica mayor (más brillante)
            'mixolydian': [0, 2, 4, 7, 9], // Pentatónica mayor (blues-rock)
            'pentatonic': [0, 2, 4, 7, 9], // Pentatónica mayor
            'blues': [0, 3, 5, 6, 7, 10] // Blues (6 notas, incluye blue note)
        };
        const intervals = scales[mode] || scales['pentatonic'];
        return intervals.map(interval => key + interval);
    }
    /**
     * Obtener duración basada en secuencia Fibonacci
     * 🔧 CIRUGÍA P0: Mapeo robusto de sectionType → durationPool
     */
    getFibonacciDuration(position, totalLength, context = 'verse') {
        // 🔧 MAPEO ROBUSTO: Convertir cualquier sectionType a un pool válido
        const contextNormalized = this.normalizeSectionContext(context);
        // Context-aware duration pools
        const durationPools = {
            intro: [1.0, 1.5, 2.0, 3.0], // Notas largas, espaciadas
            verse: [0.5, 0.75, 1.0, 1.5], // Variedad moderada
            climax: [0.25, 0.5, 0.75, 1.0], // Notas más rápidas
            outro: [1.5, 2.0, 3.0, 4.0] // Muy largas, decayendo
        };
        const durations = durationPools[contextNormalized];
        // Use Fibonacci for organic variation within context
        const fib = [1, 1, 2, 3, 5, 8];
        const fibIndex = position % fib.length;
        const durationIndex = fib[fibIndex] % durations.length;
        // Add micro-variation (±10%) for humanization
        const baseDuration = durations[durationIndex];
        const microVariation = 1 + (this.random.next() * 0.2 - 0.1); // Usa SeededRandom
        return baseDuration * microVariation;
    }
    /**
     * 🔧 CIRUGÍA P0: Normalizar sectionType a un durationPool válido
     * Mapea cualquier SectionType a uno de los 4 pools disponibles
     */
    normalizeSectionContext(sectionType) {
        // Mapeo exhaustivo de TODOS los SectionType posibles
        switch (sectionType.toLowerCase()) {
            case 'intro':
            case 'interlude':
            case 'ambient':
                return 'intro';
            case 'verse':
            case 'pre-chorus':
            case 'post-chorus':
                return 'verse';
            case 'chorus':
            case 'drop':
            case 'buildup':
            case 'bridge':
            case 'climax':
                return 'climax';
            case 'outro':
            case 'breakdown':
            case 'fade':
                return 'outro';
            default:
                // Fallback seguro: verse (duración moderada)
                console.warn(`⚠️ [MELODY ENGINE] SectionType desconocido: "${sectionType}" → Fallback a 'verse'`);
                return 'verse';
        }
    }
    /**
     * Calculate dynamic velocity based on melodic contour
     * Higher notes = louder (natural tendency)
     * Creates musical phrasing
     */
    calculateDynamicVelocity(position, totalLength) {
        const progress = position / (totalLength - 1);
        // Crescendo to middle, diminuendo after
        if (progress < 0.5) {
            return progress * 40; // +0 to +20
        }
        else {
            return (1 - progress) * 40; // +20 to +0
        }
    }
    /**
     * Aplicar transformaciones al motivo
     */
    applyTransformations(motif, complexity) {
        let transformed = [...motif];
        if (complexity > 0.3) {
            transformed = this.applyRetrograde(transformed);
        }
        if (complexity > 0.5) {
            transformed = this.applyInversion(transformed);
        }
        if (complexity > 0.7) {
            transformed = this.applyAugmentation(transformed);
        }
        return transformed;
    }
    /**
     * Desarrollo del motivo en frase completa
     * ✅ BUG #25 FIX RADICAL (ARQUITECTO-33A): MOTIVOS REPETIDOS + SWING
     * - Repite motivo base 70% del tiempo (coherencia)
     * - Solo transforma 30% del tiempo (variación sutil)
     * - Añade swing timing (off-beats desplazados 8-12ms)
     */
    developPhrase(motif, duration, tempo, contour) {
        const phrase = [];
        const motifDurationSeconds = motif.reduce((sum, note) => sum + note.duration, 0);
        const repetitions = Math.ceil(duration / motifDurationSeconds);
        // 🔥 ARQUITECTO-33A: Swing parameters (como DrumPatternEngine)
        const swingAmount = 0.08; // 8% swing (sutil pero audible)
        const beatDuration = (60 / tempo); // Segundos por beat
        let currentTime = 0;
        for (let i = 0; i < repetitions; i++) {
            // 🔥 ARQUITECTO-33A: REPETIR MOTIVO BASE 70% del tiempo (coherencia)
            // Solo transformar 30% del tiempo (variación sutil, no caos)
            const shouldTransform = this.random.next() < 0.3; // 30% chance de transformación
            const transformedMotif = shouldTransform
                ? this.transformMotifForRepetition(motif, i, contour)
                : motif; // ← ¡REPETIR SIN TRANSFORMAR!
            // Ajustar startTime de cada nota + SWING
            for (const note of transformedMotif) {
                let noteStartTime = currentTime + note.startTime;
                // 🎭 ARQUITECTO-33A: SWING (desplazar off-beats como DrumPatternEngine)
                // Detectar si la nota cae en off-beat (aproximadamente)
                const beatPosition = (noteStartTime % beatDuration) / beatDuration;
                const isOffBeat = beatPosition > 0.4 && beatPosition < 0.6; // Rango 0.4-0.6 = off-beat
                if (isOffBeat) {
                    // Añadir swing delay (8% del beat)
                    noteStartTime += swingAmount * beatDuration;
                }
                phrase.push({
                    ...note,
                    startTime: noteStartTime
                });
            }
            currentTime += motifDurationSeconds;
        }
        // Filtrar notas que excedan duration
        return phrase.filter(note => note.startTime < duration);
    }
    /**
     * Transformar motivo para repetición
     * ✅ BUG #25 FIX RADICAL (ARQUITECTO-33A): TRANSFORMACIONES SUTILES
     * Solo usa transposition (±2-5 semitonos) para variación orgánica
     * NO usa retrograde/inversion (demasiado abstracto para melodías cantables)
     */
    transformMotifForRepetition(motif, repetition, contour) {
        if (repetition === 0)
            return motif; // Primera repetición sin transformación
        // 🔥 ARQUITECTO-33A: Solo TRANSPOSITION (variación orgánica)
        // Transposiciones sutiles: ±2, ±3, ±5 semitonos (intervalos musicales)
        const musicalIntervals = [-5, -3, -2, 2, 3, 5]; // 4ta desc, 3ra desc, 2da desc, 2da asc, 3ra asc, 4ta asc
        const interval = this.random.choice(musicalIntervals);
        return this.applyTransposition(motif, interval);
    }
    /**
     * Aplicar transformación específica al motivo
     */
    applyMotifTransformation(motif, transformation) {
        switch (transformation) {
            case 'retrograde':
                return this.applyRetrograde(motif);
            case 'inversion':
                return this.applyInversion(motif);
            case 'augmentation':
                return this.applyAugmentation(motif);
            case 'diminution':
                return this.applyDiminution(motif);
            case 'transposition':
                return this.applyTransposition(motif, this.random.nextInt(-7, 7));
            case 'rhythmDisplacement':
                return this.applyRhythmDisplacement(motif);
            case 'fragmentation':
                return this.applyFragmentation(motif);
            default:
                return motif;
        }
    }
    /**
     * Retrograde: invertir orden de notas
     */
    applyRetrograde(motif) {
        const reversed = [...motif].reverse();
        let currentTime = 0;
        return reversed.map(note => {
            const retrogradeNote = {
                ...note,
                startTime: currentTime
            };
            currentTime += note.duration;
            return retrogradeNote;
        });
    }
    /**
     * Inversion: invertir intervalos
     */
    applyInversion(motif) {
        if (motif.length === 0)
            return motif;
        const pivot = motif[0].pitch;
        return motif.map(note => ({
            ...note,
            pitch: pivot - (note.pitch - pivot)
        }));
    }
    /**
     * Augmentation: alargar duraciones
     */
    applyAugmentation(motif) {
        let currentTime = 0;
        return motif.map(note => {
            const augmentedNote = {
                ...note,
                startTime: currentTime,
                duration: note.duration * 2
            };
            currentTime += augmentedNote.duration;
            return augmentedNote;
        });
    }
    /**
     * Diminution: acortar duraciones
     */
    applyDiminution(motif) {
        let currentTime = 0;
        return motif.map(note => {
            const diminishedNote = {
                ...note,
                startTime: currentTime,
                duration: Math.max(0.125, note.duration / 2) // Mínimo 0.125 segundos
            };
            currentTime += diminishedNote.duration;
            return diminishedNote;
        });
    }
    /**
     * Transposition: transponer por semitonos
     */
    applyTransposition(motif, semitones) {
        return motif.map(note => ({
            ...note,
            pitch: note.pitch + semitones
        }));
    }
    /**
     * Rhythm displacement: desplazar ritmos
     */
    applyRhythmDisplacement(motif) {
        const displaced = [];
        let timeOffset = 0;
        for (let i = 0; i < motif.length; i++) {
            const note = motif[i];
            const nextNote = motif[(i + 1) % motif.length];
            const displacement = (nextNote.startTime - note.startTime) * 0.25; // 25% displacement
            displaced.push({
                ...note,
                startTime: note.startTime + timeOffset
            });
            timeOffset += displacement;
        }
        return displaced;
    }
    /**
     * Fragmentation: dividir notas en fragmentos
     */
    applyFragmentation(motif) {
        const fragmented = [];
        for (const note of motif) {
            // Dividir cada nota en 2-3 fragmentos
            const fragments = this.random.nextInt(2, 4);
            const fragmentDuration = note.duration / fragments;
            for (let i = 0; i < fragments; i++) {
                fragmented.push({
                    ...note,
                    startTime: note.startTime + (i * fragmentDuration),
                    duration: fragmentDuration,
                    velocity: note.velocity - 10 // Más suave
                });
            }
        }
        return fragmented;
    }
    /**
     * Aplicar contorno melódico
     */
    applyContour(phrase, contour, range) {
        const contouredPhrase = [...phrase];
        const totalNotes = contouredPhrase.length;
        for (let i = 0; i < totalNotes; i++) {
            const progress = i / (totalNotes - 1); // 0 to 1
            const targetOctave = this.calculateContourShift(contour, progress, range);
            // Extraer nota (0-11) y reemplazar octava
            const noteClass = contouredPhrase[i].pitch % 12;
            contouredPhrase[i].pitch = noteClass + (targetOctave * 12);
        }
        return contouredPhrase;
    }
    /**
     * Calcular shift de octava según contorno
     */
    calculateContourShift(contour, progress, range) {
        const { min, max } = range;
        let shift = 0;
        switch (contour) {
            case 'ascending':
                shift = min + (progress * (max - min));
                break;
            case 'descending':
                shift = max - (progress * (max - min));
                break;
            case 'arched':
                // Asymmetric arch (golden ratio peak at ~0.618)
                const peakPosition = 0.618; // Golden ratio for natural climax
                const ascent = progress < peakPosition;
                const phase = ascent ? progress / peakPosition : (1 - progress) / (1 - peakPosition);
                // Ease-in-out curve (more natural than linear)
                const easedPhase = phase < 0.5
                    ? 2 * phase * phase
                    : 1 - Math.pow(-2 * phase + 2, 2) / 2;
                shift = ascent
                    ? min + easedPhase * (max - min)
                    : min + easedPhase * (max - min);
                break;
            case 'valley':
                shift = progress < 0.5
                    ? max - (progress * 2 * (max - min))
                    : min + ((progress - 0.5) * 2 * (max - min));
                break;
            case 'wave':
                // Multiple waves with controlled amplitude
                const waveFrequency = 3; // 3 ciclos completos
                const waveAmplitude = 0.6; // Solo 60% del rango (evita extremos)
                const centerOctave = (min + max) / 2;
                shift = centerOctave + Math.sin(progress * Math.PI * 2 * waveFrequency) * (max - min) * waveAmplitude;
                break;
            case 'static':
            default:
                shift = (min + max) / 2;
                break;
        }
        return Math.round(shift);
    }
}
//# sourceMappingURL=MelodyEngine.js.map