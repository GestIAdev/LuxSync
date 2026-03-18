/**
 * 🎸 ORCHESTRATOR
 * Separa notas en tracks y aplica mixing
 */
import { SeededRandom } from '../utils/SeededRandom.js';
import { DrumPatternEngine } from '../rhythm/DrumPatternEngine.js';
/**
 * ORCHESTRATOR CLASS
 */
export class Orchestrator {
    /**
     * Generar capas adicionales
     * ✅ REFACTORIZADO: Recibe totalLoad REAL calculado por MusicEnginePro
     * 🔥 BUG #25 FIX: Recibe DrumPatternEngine reutilizable (no crear en cada sección)
     */
    generateLayers(section, chords, melody, style, seed, mode, totalLoad = 0, // ✅ RECIBIR CARGA REAL (calculada por MusicEnginePro)
    drumEngine // 🔥 BUG #25 FIX: DrumPatternEngine reutilizable (opcional para retrocompatibilidad)
    ) {
        const prng = new SeededRandom(seed + section.index * 10000);
        // Generar capa de armonía (acordes)
        const harmony = this.generateHarmonyLayer(chords, style.layers.harmony, section, prng);
        // Generar línea de bajo
        const bass = this.generateBassLayer(chords, style.layers.bass, section, prng);
        // ✅ YA NO CALCULAR harmonyDensity/padDensity aquí
        // Usar totalLoad pasado desde MusicEnginePro
        const pad = style.layers.pad ? this.generatePadLayer(chords, style.layers.pad, section, prng) : [];
        // Generar capa rítmica CONSCIENTE de la carga de otras capas
        const rhythm = this.generateRhythmLayer(chords, style.layers.rhythm, section, style.musical.tempo, prng, totalLoad, // ✅ USAR CARGA REAL
        seed, // ✅ PASAR SEED ORIGINAL para DrumPatternEngine
        drumEngine // 🔥 BUG #25 FIX: Pasar instancia reutilizable
        );
        // REGLA DE ACTIVIDAD MÍNIMA: Asegurar que al menos una capa esté siempre activa
        const layers = { harmony, bass, rhythm, pad: pad.length > 0 ? pad : undefined };
        const guaranteedLayers = this.ensureMinimumActivity(layers, section, style, prng);
        return guaranteedLayers;
    }
    /**
     * Generar capa de armonía
     * 🎭 FRENTE #4 "SCHERZO ARMÓNICO": Fraseo Coral (Océano → Respiración)
     *
     * ARQUITECTURA:
     * - Duración máxima: 3.5s (límite de pulmón humano real)
     * - Fraseo inteligente basado en section.type e intensity
     * - Staccato (corto) en verse/intro (1-2s)
     * - Sostenuto (largo) en chorus/climax (3-3.5s)
     * - Respiración entre frases (gaps de 0.3-0.5s)
     *
     * IMPROVISACIÓN:
     * - Intensity < 0.5: "Staccato Respiratorio" (1-2s, gaps 0.5s)
     * - Intensity 0.5-0.8: "Sostenuto Moderado" (2-3s, gaps 0.3s)
     * - Intensity > 0.8: "Sostenuto Dramático" (3-3.5s, overlap legato)
     */
    generateHarmonyLayer(chords, config, section, prng) {
        if (!config)
            return [];
        const notes = [];
        const totalChords = chords.length;
        const sectionEndTime = section.startTime + section.duration;
        // 🎭 SCHERZO ARMÓNICO: Duración máxima basada en intensidad
        // Pulmón humano real: 3-4 segundos de aire
        const intensity = section.profile?.intensity ?? 0.5;
        let MAX_BREATH_DURATION;
        let BREATH_GAP;
        let articulationStyle;
        // 🎨 IMPROVISACIÓN: 3 niveles de fraseo coral
        if (intensity < 0.5) {
            // STACCATO RESPIRATORIO (verso tranquilo, intro)
            MAX_BREATH_DURATION = 1.8; // Notas cortas (1-2s)
            BREATH_GAP = 0.5; // Respiración larga
            articulationStyle = 'staccato';
            console.log(`🎭 [HARMONY] Fraseo Coral: STACCATO RESPIRATORIO (intensity=${intensity.toFixed(2)})`);
        }
        else if (intensity >= 0.5 && intensity <= 0.8) {
            // SOSTENUTO MODERADO (pre-chorus, buildup)
            MAX_BREATH_DURATION = 2.8; // Notas medias (2-3s)
            BREATH_GAP = 0.3; // Respiración corta
            articulationStyle = 'sostenuto';
            console.log(`🎭 [HARMONY] Fraseo Coral: SOSTENUTO MODERADO (intensity=${intensity.toFixed(2)})`);
        }
        else {
            // SOSTENUTO DRAMÁTICO (chorus, climax)
            MAX_BREATH_DURATION = 3.5; // Notas largas (3-3.5s)
            BREATH_GAP = 0.1; // Casi sin gaps (overlap legato)
            articulationStyle = 'legato';
            console.log(`🎭 [HARMONY] Fraseo Coral: SOSTENUTO DRAMÁTICO (intensity=${intensity.toFixed(2)})`);
        }
        for (let chordIndex = 0; chordIndex < chords.length; chordIndex++) {
            const chord = chords[chordIndex];
            // Musical phrasing (crescendo/diminuendo)
            const phraseProgress = totalChords > 1
                ? chordIndex / (totalChords - 1)
                : 0.5;
            const phrasingDynamic = this.calculatePhrasingDynamic(phraseProgress, section.type);
            // 🎭 RESPIRACIÓN CORAL: Subdividir acordes largos con gaps
            // Ciclo respiratorio: MAX_BREATH_DURATION + BREATH_GAP
            const breathCycle = MAX_BREATH_DURATION + BREATH_GAP;
            const numBreaths = Math.ceil(chord.duration / breathCycle);
            for (let breathIndex = 0; breathIndex < numBreaths; breathIndex++) {
                const breathStartTime = chord.startTime + (breathIndex * breathCycle);
                // Validar que la respiración inicia dentro de la sección y del acorde
                if (breathStartTime >= sectionEndTime || breathStartTime >= chord.startTime + chord.duration) {
                    break;
                }
                // Calcular duración de esta respiración
                const timeLeftInChord = (chord.startTime + chord.duration) - breathStartTime;
                const timeLeftInSection = sectionEndTime - breathStartTime;
                let baseDuration = Math.min(MAX_BREATH_DURATION, timeLeftInChord, timeLeftInSection);
                // Aplicar articulación según estilo
                let duration = baseDuration * config.noteDuration;
                if (articulationStyle === 'staccato') {
                    duration *= 0.6; // Staccato: 60% de duración (más corto)
                }
                else if (articulationStyle === 'legato') {
                    duration *= 1.15; // Legato: 115% (overlap con siguiente)
                }
                // sostenuto: sin modificación (100%)
                // Asegurar mínimo audible (0.3s para choir)
                if (duration < 0.3) {
                    break;
                }
                for (const pitch of chord.notes) {
                    const adjustedPitch = pitch + config.octave * 12;
                    // Velocity con contexto musical
                    const baseVelocity = config.velocity * 127;
                    const variation = config.velocityVariation * 127;
                    const randomVariation = prng.next() * variation * 2 - variation;
                    let velocity = baseVelocity + phrasingDynamic + randomVariation;
                    if (isNaN(velocity) || !isFinite(velocity) || velocity < 1) {
                        velocity = 80;
                    }
                    notes.push({
                        pitch: Math.max(0, Math.min(127, adjustedPitch)),
                        velocity: Math.max(0, Math.min(127, Math.floor(velocity))),
                        startTime: breathStartTime,
                        duration, // ✅ MAX 3.5 SEGUNDOS (respiración humana)
                        channel: config.channel || 1
                    });
                }
            }
        }
        return notes;
    }
    /**
     * Generar línea de bajo
     * ✅ BUG #23 FIX (SCHERZO SONORO): Subdivide acordes largos (>3s) en notas rítmicas cortas
     * En lugar de 1 nota de 10s → genera 4 notas de 2.5s (más definición rítmica)
     */
    generateBassLayer(chords, config, section, prng) {
        if (!config)
            return [];
        const notes = [];
        const sectionEndTime = section.startTime + section.duration;
        for (const chord of chords) {
            // Bajo toca la fundamental del acorde
            // chord.root ya es MIDI absoluto (48-84), ajustar a octava de bajo
            const bassPitch = (chord.root % 12) + config.octave * 12;
            // ✅ BUG #31 FIX: Convertir velocity (0-1) a MIDI (0-127) ANTES de variación
            const baseVelocity = config.velocity * 127; // 0.43 → 55 MIDI
            const variation = prng.next() * config.velocityVariation * 127 - config.velocityVariation * 64;
            const velocity = baseVelocity + variation;
            // ✅ BUG #23 FIX (SCHERZO SONORO): Subdividir acordes largos
            // Si chord.duration > 3 segundos, subdivide en notas de ~1-2s
            const MAX_BASS_NOTE_DURATION = 2.5; // Máximo 2.5s por nota de bajo
            if (chord.duration > MAX_BASS_NOTE_DURATION) {
                // Subdividir: calcular cuántas notas necesitamos
                const numSubdivisions = Math.ceil(chord.duration / MAX_BASS_NOTE_DURATION);
                const subdivisionDuration = chord.duration / numSubdivisions;
                for (let i = 0; i < numSubdivisions; i++) {
                    const noteStartTime = chord.startTime + (i * subdivisionDuration);
                    let noteDuration = subdivisionDuration * config.noteDuration;
                    if (config.articulation === 'staccato') {
                        noteDuration *= 0.7;
                    }
                    // Validar límites
                    if (noteStartTime >= sectionEndTime)
                        break;
                    const noteEndTime = noteStartTime + noteDuration;
                    if (noteEndTime > sectionEndTime) {
                        noteDuration = Math.max(0.1, sectionEndTime - noteStartTime);
                    }
                    notes.push({
                        pitch: Math.max(0, Math.min(127, bassPitch)),
                        velocity: Math.max(0, Math.min(127, Math.floor(velocity))),
                        startTime: noteStartTime,
                        duration: noteDuration,
                        channel: config.channel || 2
                    });
                }
            }
            else {
                // Acorde corto (≤3s): generar 1 sola nota (comportamiento original)
                let duration = chord.duration * config.noteDuration;
                if (config.articulation === 'staccato') {
                    duration *= 0.7;
                }
                const noteStartTime = chord.startTime;
                let noteEndTime = noteStartTime + duration;
                // Validar límites
                if (noteStartTime >= sectionEndTime)
                    continue;
                if (noteEndTime > sectionEndTime) {
                    duration = Math.max(0.1, sectionEndTime - noteStartTime);
                }
                notes.push({
                    pitch: Math.max(0, Math.min(127, bassPitch)),
                    velocity: Math.max(0, Math.min(127, Math.floor(velocity))),
                    startTime: noteStartTime,
                    duration,
                    channel: config.channel || 2
                });
            }
        }
        return notes;
    }
    /**
     * Generar capa rítmica
     * ✅ REFACTORIZADO BUG #24: Usa DrumPatternEngine (estructurado) en vez de lógica caótica
     */
    /**
     * 🥁 Generar capa rítmica con DrumPatternEngine
     * 🔥 BUG #25 FIX: Reutiliza instancia única de DrumPatternEngine (no crear en cada sección)
     */
    generateRhythmLayer(chords, config, section, tempo, prng, totalLoad = 0, seed, // ← Seed original (necesario para DrumPatternEngine si no se pasa instancia)
    drumEngine // 🔥 BUG #25 FIX: Instancia reutilizable (opcional para retrocompatibilidad)
    ) {
        if (!config)
            return [];
        // 🔥 BUG #25 FIX: Usar instancia pasada O crear nueva (fallback)
        let engine;
        if (drumEngine) {
            engine = drumEngine; // ← REUTILIZAR INSTANCIA
        }
        else {
            // Fallback: crear nueva (solo para retrocompatibilidad)
            const drumSeed = seed ? seed + section.index * 10000 : 12345;
            engine = new DrumPatternEngine(tempo, drumSeed);
            console.warn(`⚠️  [Orchestrator] Creating new DrumPatternEngine (fallback) - BUG #25 active!`);
        }
        const baseVelocity = Math.floor(config.velocity * 127); // 0-1 → 0-127 MIDI
        // Generar patrón estructurado según sección
        const notes = engine.generateForSection(section, baseVelocity);
        return notes;
    }
    /**
     * Generar pad atmosférico
     * ✅ BUG #23 FIX RADICAL (ARQUITECTO-34A): DURACIÓN MÁXIMA ABSOLUTA DE 4 SEGUNDOS
     * No importa chord.duration - El Pad NUNCA debe exceder 4s por nota
     * Estrategia: "Respiratory Pads" (inhale 4s, exhale 4s, repeat)
     */
    generatePadLayer(chords, config, section, prng) {
        const notes = [];
        const sectionEndTime = section.startTime + section.duration;
        // 🔥 ARQUITECTO-34A: DURACIÓN MÁXIMA ABSOLUTA (no negociable)
        const MAX_PAD_DURATION = 4.0; // 4 segundos MAX (respiración musical)
        // 🐛 BUG #2 FIX (FASE 6.0): Progresión armónica en pads largos
        // En vez de repetir el mismo acorde, transponemos cada respiración (+2, +4, +7, +0)
        const transpositions = [0, 2, 4, 7, 0, -2, -4, -7]; // Intervalos mayores/menores + quinta
        for (const chord of chords) {
            // OPTIMIZACIÓN: Pad solo toca tónica y quinta (no todo el acorde)
            const root = chord.root;
            const fifth = root + 7; // Quinta del acorde
            // Notas del pad: solo tónica y quinta
            const padNotes = [root, fifth];
            // 🔥 ARQUITECTO-34A: Subdividir acordes largos en "respiraciones" de 4s
            // Si chord.duration > 4s, generar múltiples notas de 4s (con gaps pequeños)
            const numBreaths = Math.ceil(chord.duration / (MAX_PAD_DURATION + 0.5)); // +0.5s gap entre respiraciones
            const breathCycle = MAX_PAD_DURATION + 0.5; // 4s pad + 0.5s gap
            for (let breathIndex = 0; breathIndex < numBreaths; breathIndex++) {
                const breathStartTime = chord.startTime + (breathIndex * breathCycle);
                // Validar que la "respiración" inicia dentro de la sección y del acorde
                if (breathStartTime >= sectionEndTime || breathStartTime >= chord.startTime + chord.duration) {
                    break;
                }
                // Calcular duración de esta respiración (puede ser menor que 4s si es la última)
                const timeLeftInChord = (chord.startTime + chord.duration) - breathStartTime;
                const timeLeftInSection = sectionEndTime - breathStartTime;
                let breathDuration = Math.min(MAX_PAD_DURATION, timeLeftInChord, timeLeftInSection);
                // Asegurar mínimo audible (0.5s)
                if (breathDuration < 0.5) {
                    break;
                }
                // 🐛 BUG #2 FIX: Aplicar transposición cíclica para variedad armónica
                const transposition = transpositions[breathIndex % transpositions.length];
                for (const pitch of padNotes) {
                    const adjustedPitch = pitch + (config.octave - 4) * 12 + transposition; // + transposición
                    notes.push({
                        pitch: Math.max(0, Math.min(127, adjustedPitch)),
                        velocity: Math.floor(config.velocity * 127),
                        startTime: breathStartTime,
                        duration: breathDuration, // ✅ MAX 4 SEGUNDOS (respiratorio)
                        channel: config.channel || 3
                    });
                }
            }
        }
        return notes;
    }
    /**
     * Separar en tracks
     */
    separateIntoTracks(melody, layers, style) {
        const tracks = new Map();
        tracks.set('melody', melody);
        tracks.set('harmony', layers.harmony);
        tracks.set('bass', layers.bass);
        tracks.set('rhythm', layers.rhythm);
        if (layers.pad) {
            tracks.set('pad', layers.pad);
        }
        return tracks;
    }
    /**
     * 🐛 BUG FIX #7 (FASE 6.0b): Separar TODOS los tracks (incluyendo multicapa melody)
     * En FASE 6.0, melody puede tener múltiples layers ('melody', 'melody2', 'melody3', 'melody4')
     * Esta función copia TODOS los tracks directamente, preservando la separación multicapa
     */
    separateAllTracks(tracks, style) {
        // Copiar todos los tracks directamente (incluyendo melody, melody2, melody3, melody4)
        const separated = new Map();
        for (const [trackName, notes] of Array.from(tracks.entries())) {
            separated.set(trackName, notes);
        }
        return separated;
    }
    /**
     * Aplicar mixing
     * ✅ REFACTORIZADO BUG #31: NO aplicar mixWeight a velocity (ya viene en escala MIDI 0-127)
     * mixWeight causaba velocity corruption: 60 MIDI * 0.3 mixWeight = 18 MIDI (inaudible)
     */
    applyMixing(tracks, style) {
        const mixed = new Map();
        for (const [trackName, notes] of Array.from(tracks.entries())) {
            const layerConfig = this.getLayerConfig(trackName, style);
            if (!layerConfig) {
                mixed.set(trackName, notes);
                continue;
            }
            // ✅ NO APLICAR mixWeight a velocity (Bug #31 fix)
            // Las velocities ya vienen correctas en escala MIDI (0-127) desde los generators
            // mixWeight solo se usa para cálculos internos, NO para modificar velocity final
            mixed.set(trackName, notes);
        }
        return mixed;
    }
    getLayerConfig(trackName, style) {
        switch (trackName) {
            case 'melody': return style.layers.melody;
            case 'harmony': return style.layers.harmony;
            case 'bass': return style.layers.bass;
            case 'rhythm': return style.layers.rhythm;
            case 'pad': return style.layers.pad || false;
            default: return false;
        }
    }
    /**
     * Calculate dynamic shaping based on phrase position and section type
     */
    calculatePhrasingDynamic(progress, sectionType) {
        switch (sectionType) {
            case 'intro':
                // Fade in gradually
                return progress * 20; // +0 to +20
            case 'buildup':
                // Crescendo to climax
                return progress * 30; // +0 to +30
            case 'climax':
                // Stay loud, slight variations
                return 25 + Math.sin(progress * Math.PI * 4) * 5; // 20-30
            case 'breakdown':
                // Sudden drop, then gradual recovery
                return progress < 0.3 ? -20 : (progress - 0.3) * 20; // -20 to +10
            case 'outro':
                // Fade out
                return (1 - progress) * 20; // +20 to +0
            default:
                return 0;
        }
    }
    /**
     * REGLA DE ACTIVIDAD MÍNIMA: Asegurar que al menos una capa esté siempre activa
     * Previene silencios no deseados en la composición
     */
    ensureMinimumActivity(layers, section, style, prng) {
        const sectionStart = section.startTime;
        const sectionEnd = section.startTime + section.duration;
        // Recopilar todas las notas activas por tiempo
        const activeTimes = new Map();
        // Función helper para marcar tiempos activos
        const markActiveTime = (notes, channel) => {
            notes.forEach(note => {
                const start = Math.floor(note.startTime * 100) / 100; // Redondear a centésimas
                const end = Math.floor((note.startTime + note.duration) * 100) / 100;
                for (let t = start; t <= end; t += 0.01) { // Marcar cada 10ms
                    activeTimes.set(t, true);
                }
            });
        };
        // Marcar tiempos activos para cada capa
        if (layers.harmony)
            markActiveTime(layers.harmony, 1);
        if (layers.bass)
            markActiveTime(layers.bass, 2);
        if (layers.rhythm)
            markActiveTime(layers.rhythm, 9);
        if (layers.pad)
            markActiveTime(layers.pad, 3);
        // Encontrar silencios (huecos de más de 2 segundos)
        const silentPeriods = [];
        let currentSilentStart = null;
        for (let t = sectionStart; t <= sectionEnd; t += 0.01) {
            const isActive = activeTimes.get(Math.floor(t * 100) / 100) || false;
            if (!isActive && currentSilentStart === null) {
                currentSilentStart = t;
            }
            else if (isActive && currentSilentStart !== null) {
                const silentDuration = t - currentSilentStart;
                if (silentDuration >= 2.0) { // Silencio de 2+ segundos
                    silentPeriods.push({ start: currentSilentStart, end: t });
                }
                currentSilentStart = null;
            }
        }
        // Si hay silencios al final, cerrarlos
        if (currentSilentStart !== null) {
            const silentDuration = sectionEnd - currentSilentStart;
            if (silentDuration >= 2.0) {
                silentPeriods.push({ start: currentSilentStart, end: sectionEnd });
            }
        }
        // Si no hay silencios problemáticos, devolver capas originales
        if (silentPeriods.length === 0) {
            return layers;
        }
        // Rellenar silencios con actividad mínima (preferir Pad, luego Rhythm)
        const resultLayers = { ...layers };
        for (const silentPeriod of silentPeriods) {
            const duration = silentPeriod.end - silentPeriod.start;
            // Intentar agregar Pad primero (más atmosférico)
            if (style.layers.pad && style.layers.pad.enabled && (!resultLayers.pad || resultLayers.pad.length === 0)) {
                const padNotes = this.generateMinimumPadActivity(silentPeriod.start, duration, style.layers.pad, prng);
                resultLayers.pad = padNotes;
            }
            // Si no hay Pad configurado/enabled, usar Rhythm
            // ✅ BUG #24 FIX: NO añadir rhythm si DrumPatternEngine ya generó patrones
            // DrumPatternEngine genera patrones completos (31 notas), no necesita relleno
            else if (style.layers.rhythm && style.layers.rhythm.enabled && (!resultLayers.rhythm || resultLayers.rhythm.length === 0)) {
                const rhythmNotes = this.generateMinimumRhythmActivity(silentPeriod.start, duration, style.layers.rhythm, style.musical.tempo, prng);
                if (!resultLayers.rhythm)
                    resultLayers.rhythm = [];
                resultLayers.rhythm.push(...rhythmNotes);
            }
        }
        return resultLayers;
    }
    /**
     * Generar actividad mínima de Pad para rellenar silencios
     */
    generateMinimumPadActivity(startTime, duration, config, prng) {
        const notes = [];
        // Nota de dron simple (tónica de la tonalidad base, asumiendo C=60)
        const dronePitch = 60 + config.octave * 12; // C4 como base
        notes.push({
            pitch: Math.max(0, Math.min(127, dronePitch)),
            velocity: Math.floor(config.velocity * 127 * 0.3), // Muy suave
            startTime,
            duration,
            channel: config.channel || 3
        });
        return notes;
    }
    /**
     * Generar actividad mínima de Rhythm para rellenar silencios
     */
    generateMinimumRhythmActivity(startTime, duration, config, tempo, prng) {
        const notes = [];
        const secondsPerBeat = 60 / tempo;
        // Patrón rítmico mínimo: kick cada 2 beats
        let currentTime = startTime;
        const endTime = startTime + duration;
        while (currentTime < endTime) {
            // Kick suave cada 2 beats
            if (prng.next() > 0.3) { // 70% probability
                notes.push({
                    pitch: 36, // Kick
                    velocity: Math.floor(config.velocity * 127 * 0.4), // Moderadamente suave
                    startTime: currentTime,
                    duration: secondsPerBeat * 0.3,
                    channel: 9
                });
            }
            currentTime += secondsPerBeat * 2; // Cada 2 beats
        }
        return notes;
    }
}
//# sourceMappingURL=Orchestrator.js.map