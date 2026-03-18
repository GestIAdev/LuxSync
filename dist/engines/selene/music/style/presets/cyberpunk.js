/**
 * 🎸 PRESET: CYBERPUNK AMBIENT
 * Atmósfera oscura y espaciosa con texturas sintéticas. Blade Runner meets Ghost in the Shell.
 */
// 🎸 FASE 5.9: ARSENAL COMPLETO DE INSTRUMENTOS - PALETA SÓNICA DETERMINISTA
// 8 pools separados: harmony/melody/rhythm/bass × chill/dubchill
export const CYBERPUNK_INSTRUMENTS = {
    // ==================== IDENTIDAD ESTÁTICA ====================
    // Elegidos UNA VEZ al inicio, se quedan toda la canción
    // HARMONY CHILL: Texturas armónicas suaves, etéreas
    harmony_chill: [
        // Strings ambientales (111 samples normalizados)
        { key: 'strings/cello', type: 'multisample', samples: {
                33: 'strings/cello-a1.wav', 34: 'strings/cello-bb1.wav', 35: 'strings/cello-b1.wav',
                36: 'strings/cello-c2.wav', 37: 'strings/cello-db2.wav', 38: 'strings/cello-d2.wav',
                39: 'strings/cello-eb2.wav', 40: 'strings/cello-e2.wav', 41: 'strings/cello-f2.wav',
                42: 'strings/cello-gb2.wav', 43: 'strings/cello-g2.wav', 44: 'strings/cello-ab2.wav',
                45: 'strings/cello-a2.wav', 46: 'strings/cello-bb2.wav', 47: 'strings/cello-b2.wav',
                48: 'strings/cello-c3.wav', 49: 'strings/cello-db3.wav', 50: 'strings/cello-d3.wav',
                51: 'strings/cello-eb3.wav', 52: 'strings/cello-e3.wav', 53: 'strings/cello-f3.wav',
                54: 'strings/cello-gb3.wav', 55: 'strings/cello-g3.wav', 56: 'strings/cello-ab3.wav',
                57: 'strings/cello-a3.wav', 58: 'strings/cello-bb3.wav', 59: 'strings/cello-b3.wav',
                60: 'strings/cello-c4.wav'
            } },
        { key: 'strings/piano', type: 'multisample', samples: {
                48: 'strings/piano-c3.wav', 49: 'strings/piano-db3.wav', 50: 'strings/piano-d3.wav',
                51: 'strings/piano-eb3.wav', 52: 'strings/piano-e3.wav', 53: 'strings/piano-f3.wav',
                54: 'strings/piano-gb3.wav', 55: 'strings/piano-g3.wav', 56: 'strings/piano-ab3.wav',
                57: 'strings/piano-a3.wav', 58: 'strings/piano-bb3.wav', 59: 'strings/piano-b3.wav',
                60: 'strings/piano-c4.wav', 61: 'strings/piano-db4.wav', 62: 'strings/piano-d4.wav',
                63: 'strings/piano-eb4.wav', 64: 'strings/piano-e4.wav', 65: 'strings/piano-f4.wav',
                66: 'strings/piano-gb4.wav', 67: 'strings/piano-g4.wav', 68: 'strings/piano-ab4.wav',
                69: 'strings/piano-a4.wav', 70: 'strings/piano-bb4.wav', 71: 'strings/piano-b4.wav',
                72: 'strings/piano-c5.wav'
            } },
        { key: 'strings/violin', type: 'multisample', samples: {
                55: 'strings/violin-g3.wav', 56: 'strings/violin-ab3.wav', 57: 'strings/violin-a3.wav',
                58: 'strings/violin-bb3.wav', 59: 'strings/violin-b3.wav', 60: 'strings/violin-c4.wav',
                61: 'strings/violin-db4.wav', 62: 'strings/violin-d4.wav', 63: 'strings/violin-eb4.wav',
                64: 'strings/violin-e4.wav', 65: 'strings/violin-f4.wav', 66: 'strings/violin-gb4.wav',
                67: 'strings/violin-g4.wav', 68: 'strings/violin-ab4.wav', 69: 'strings/violin-a4.wav',
                70: 'strings/violin-bb4.wav', 71: 'strings/violin-b4.wav', 72: 'strings/violin-c5.wav',
                73: 'strings/violin-db5.wav', 74: 'strings/violin-d5.wav', 75: 'strings/violin-eb5.wav',
                76: 'strings/violin-e5.wav', 77: 'strings/violin-f5.wav', 78: 'strings/violin-gb5.wav',
                79: 'strings/violin-g5.wav', 80: 'strings/violin-ab5.wav', 81: 'strings/violin-a5.wav'
            } },
        { key: 'pads/padcatedral', type: 'multisample' },
        { key: 'pads/padnubes', type: 'multisample' }
    ],
    // HARMONY DUBCHILL: Texturas oscuras, densas, tensión armónica
    harmony_dubchill: [
        { key: 'strings/trombone', type: 'multisample', samples: {
                34: 'strings/trombone-bb1.wav', 35: 'strings/trombone-b1.wav', 36: 'strings/trombone-c2.wav',
                37: 'strings/trombone-db2.wav', 38: 'strings/trombone-d2.wav', 39: 'strings/trombone-eb2.wav',
                40: 'strings/trombone-e2.wav', 41: 'strings/trombone-f2.wav', 42: 'strings/trombone-gb2.wav',
                43: 'strings/trombone-g2.wav', 44: 'strings/trombone-ab2.wav', 45: 'strings/trombone-a2.wav',
                46: 'strings/trombone-bb2.wav', 47: 'strings/trombone-b2.wav', 48: 'strings/trombone-c3.wav',
                49: 'strings/trombone-db3.wav', 50: 'strings/trombone-d3.wav', 51: 'strings/trombone-eb3.wav',
                52: 'strings/trombone-e3.wav', 53: 'strings/trombone-f3.wav'
            } },
        { key: 'strings/horn', type: 'multisample', samples: {
                34: 'strings/horn-bb1.wav', 35: 'strings/horn-b1.wav', 36: 'strings/horn-c2.wav',
                37: 'strings/horn-db2.wav', 38: 'strings/horn-d2.wav', 39: 'strings/horn-eb2.wav',
                40: 'strings/horn-e2.wav', 41: 'strings/horn-f2.wav', 42: 'strings/horn-gb2.wav',
                43: 'strings/horn-g2.wav', 44: 'strings/horn-ab2.wav', 45: 'strings/horn-a2.wav',
                46: 'strings/horn-bb2.wav', 47: 'strings/horn-b2.wav', 48: 'strings/horn-c3.wav',
                49: 'strings/horn-db3.wav', 50: 'strings/horn-d3.wav', 51: 'strings/horn-eb3.wav',
                52: 'strings/horn-e3.wav', 53: 'strings/horn-f3.wav', 54: 'strings/horn-gb3.wav',
                55: 'strings/horn-g3.wav', 56: 'strings/horn-ab3.wav', 57: 'strings/horn-a3.wav',
                58: 'strings/horn-bb3.wav', 59: 'strings/horn-b3.wav', 60: 'strings/horn-c4.wav',
                61: 'strings/horn-db4.wav', 62: 'strings/horn-d4.wav', 63: 'strings/horn-eb4.wav',
                64: 'strings/horn-e4.wav', 65: 'strings/horn-f4.wav', 66: 'strings/horn-gb4.wav',
                67: 'strings/horn-g4.wav', 68: 'strings/horn-ab4.wav', 69: 'strings/horn-a4.wav',
                70: 'strings/horn-bb4.wav', 71: 'strings/horn-b4.wav', 72: 'strings/horn-c5.wav'
            } },
        { key: 'pads/padcolosso', type: 'multisample' },
        { key: 'pads/padglitch', type: 'multisample' }
    ],
    // MELODY CHILL: Leads suaves, plucks etéreos
    melody_chill: [
        { key: 'melody/pluck/MAX', type: 'multisample' },
        { key: 'melody/sax', type: 'multisample', samples: {
                46: 'strings/sax-bb2.wav', 47: 'strings/sax-b2.wav', 48: 'strings/sax-c3.wav',
                49: 'strings/sax-db3.wav', 50: 'strings/sax-d3.wav', 51: 'strings/sax-eb3.wav',
                52: 'strings/sax-e3.wav', 53: 'strings/sax-f3.wav', 54: 'strings/sax-gb3.wav',
                55: 'strings/sax-g3.wav', 56: 'strings/sax-ab3.wav', 57: 'strings/sax-a3.wav',
                58: 'strings/sax-bb3.wav', 59: 'strings/sax-b3.wav', 60: 'strings/sax-c4.wav',
                61: 'strings/sax-db4.wav', 62: 'strings/sax-d4.wav', 63: 'strings/sax-eb4.wav',
                64: 'strings/sax-e4.wav', 65: 'strings/sax-f4.wav', 66: 'strings/sax-gb4.wav',
                67: 'strings/sax-g4.wav', 68: 'strings/sax-ab4.wav', 69: 'strings/sax-a4.wav',
                70: 'strings/sax-bb4.wav', 71: 'strings/sax-b4.wav', 72: 'strings/sax-c5.wav'
            } },
        { key: 'melody/lead/dreamy1', type: 'multisample' },
        { key: 'melody/lead/dreamy2', type: 'multisample' }
    ],
    // MELODY DUBCHILL: Leads agresivos, synths distorsionados
    melody_dubchill: [
        { key: 'melody/lead/agressive1', type: 'multisample' },
        { key: 'melody/lead/agressive2', type: 'multisample' },
        { key: 'melody/lead/agressive3', type: 'multisample' },
        { key: 'strings/trumpet', type: 'multisample', samples: {
                55: 'strings/trumpet-g3.wav', 56: 'strings/trumpet-ab3.wav', 57: 'strings/trumpet-a3.wav',
                58: 'strings/trumpet-bb3.wav', 59: 'strings/trumpet-b3.wav', 60: 'strings/trumpet-c4.wav',
                61: 'strings/trumpet-db4.wav', 62: 'strings/trumpet-d4.wav', 63: 'strings/trumpet-eb4.wav',
                64: 'strings/trumpet-e4.wav', 65: 'strings/trumpet-f4.wav', 66: 'strings/trumpet-gb4.wav',
                67: 'strings/trumpet-g4.wav', 68: 'strings/trumpet-ab4.wav', 69: 'strings/trumpet-a4.wav',
                70: 'strings/trumpet-bb4.wav', 71: 'strings/trumpet-b4.wav', 72: 'strings/trumpet-c5.wav',
                73: 'strings/trumpet-db5.wav', 74: 'strings/trumpet-d5.wav', 75: 'strings/trumpet-eb5.wav',
                76: 'strings/trumpet-e5.wav', 77: 'strings/trumpet-f5.wav', 78: 'strings/trumpet-gb5.wav'
            } }
    ],
    // ==================== ENERGÍA DINÁMICA ====================
    // Cambian según intensity de cada sección
    // BASS CHILL: Sub-bass sutiles, fundamento tranquilo
    bass_chill: [
        { key: 'bass/subbass1', type: 'multisample' },
        { key: 'bass/subbass2', type: 'multisample' },
        { key: 'strings/contrabass', type: 'multisample', samples: {
                28: 'strings/contrabass-e1.wav', 29: 'strings/contrabass-f1.wav', 30: 'strings/contrabass-gb1.wav',
                31: 'strings/contrabass-g1.wav', 32: 'strings/contrabass-ab1.wav', 33: 'strings/contrabass-a1.wav',
                34: 'strings/contrabass-bb1.wav', 35: 'strings/contrabass-b1.wav', 36: 'strings/contrabass-c2.wav',
                37: 'strings/contrabass-db2.wav', 38: 'strings/contrabass-d2.wav', 39: 'strings/contrabass-eb2.wav',
                40: 'strings/contrabass-e2.wav', 41: 'strings/contrabass-f2.wav', 42: 'strings/contrabass-gb2.wav',
                43: 'strings/contrabass-g2.wav'
            } }
    ],
    // BASS DUBCHILL: Synth-bass agresivos, rugidos distorsionados
    bass_dubchill: [
        { key: 'bass/bassdistorted', type: 'multisample' },
        { key: 'bass/bassgrunge', type: 'multisample' },
        { key: 'bass/bassphaser', type: 'multisample' }
    ],
    // RHYTHM CHILL: Soft kicks, hats delicados
    rhythm_chill: [
        { key: 'drumkit-chill-1', type: 'drumkit', samples: {
                36: 'rhythm/soft-kick1.wav',
                38: 'rhythm/snare-reverb.wav',
                42: 'rhythm/closed-hat.wav',
                46: 'rhythm/open-hat.wav'
            } },
        { key: 'drumkit-chill-2', type: 'drumkit', samples: {
                36: 'rhythm/soft-kick2.wav',
                38: 'rhythm/snare-reverb.wav',
                42: 'rhythm/closed-hat.wav',
                46: 'rhythm/open-hat.wav',
                49: 'rhythm/crash.wav'
            } }
    ],
    // RHYTHM DUBCHILL: Hard kicks, glitches agresivos
    rhythm_dubchill: [
        { key: 'drumkit-dubchill-1', type: 'drumkit', samples: {
                36: 'rhythm/hard-kick1.wav',
                38: 'rhythm/snare-agressive.wav',
                42: 'rhythm/closed-hat.wav',
                46: 'rhythm/open-hat.wav',
                49: 'rhythm/crash.wav'
            } },
        { key: 'drumkit-dubchill-2', type: 'drumkit', samples: {
                36: 'rhythm/hard-kick2.wav',
                38: 'rhythm/snare-glitch.wav',
                42: 'rhythm/closed-hat.wav',
                46: 'rhythm/open-hat.wav',
                49: 'rhythm/crash.wav'
            } }
    ],
    // LEGACY: Pad independiente (mantener para retrocompatibilidad)
    pad: [
        { key: 'pads/padcatedral', type: 'multisample' },
        { key: 'pads/padcolosso', type: 'multisample' }
    ]
};
export const CYBERPUNK_AMBIENT = {
    id: 'cyberpunk-ambient',
    name: 'Cyberpunk Ambient',
    description: 'Atmósfera oscura y espaciosa con texturas sintéticas. Blade Runner meets Ghost in the Shell.',
    tags: ['ambient', 'dark', 'electronic', 'atmospheric', 'slow'],
    musical: {
        mode: 'phrygian', // Escala oscura, misteriosa
        tempo: 70, // Lento, atmosférico
        timeSignature: [4, 4],
        rootRange: [36, 48], // Registro grave (C2-C3)
        harmonic: {
            progressionType: 'modal',
            chordComplexity: 'extended', // 9nas, 11vas
            density: 0.25, // Acordes largos, sostenidos
            inversionProbability: 0.7, // Inversiones frecuentes
            dissonanceLevel: 0.6, // Tensión moderada-alta
            modulationStrategy: 'modal' // Cambios modales sutiles
        },
        melodic: {
            range: [1, 3], // 3 octavas
            contourPreference: 'wave', // Ondulante
            noteDensity: 0.3, // Espaciado
            restProbability: 0.4, // Muchos silencios
            ornamentation: 'minimal',
            motifRepetition: 0.7 // Repetitivo (hipnótico)
        },
        rhythmic: {
            baseDivision: 8,
            complexity: 'simple',
            swing: 0,
            syncopation: 0.2,
            layerDensity: 2 // Minimal percusión
        }
    },
    layers: {
        // 🎚️ BUG #31 FIX: BALANCED MIX VELOCITIES (0-1 scale, converted to MIDI 0-127)
        // TARGET MIX: Melody (protagonist) > Bass/Harmony (support) > Drums (groove) > Pad (atmosphere)
        melody: {
            enabled: true,
            octave: 5,
            velocity: 0.55, // 70 MIDI = Protagonist (was 40 → too quiet)
            velocityVariation: 0.15, // ±19 MIDI variation
            articulation: 'legato',
            noteDuration: 2.0, // Notas largas
            mixWeight: 0.6
        },
        harmony: {
            enabled: true,
            octave: 3,
            velocity: 0.32, // 41 MIDI = Support, doesn't dominate (was 30*127=3810!)
            velocityVariation: 0.08, // ±10 MIDI variation
            articulation: 'legato',
            noteDuration: 1.0, // ✅ BUG #23 FIX: Sigue chord duration (was 4.0 → 17s órgano)
            mixWeight: 0.8
        },
        bass: {
            enabled: true,
            octave: 2,
            velocity: 0.43, // 55 MIDI = Foundation (was 35 → too quiet)
            velocityVariation: 0.12, // ±15 MIDI variation
            articulation: 'normal',
            noteDuration: 0.8, // ✅ BUG #23 FIX: Más corto que acorde (was 3.0 → 13s órgano)
            mixWeight: 0.5
        },
        rhythm: {
            enabled: true,
            octave: 0, // No aplica para drums
            velocity: 0.47, // 60 MIDI = Cyberpunk needs PUNCH (kicks/snares audible)
            velocityVariation: 0.12, // ±15 MIDI variation for dynamics
            articulation: 'staccato',
            noteDuration: 0.5,
            mixWeight: 0.3 // Increased from 0.2 (drums more present)
        },
        pad: {
            enabled: true,
            octave: 4,
            velocity: 0.30, // ✅ BUG #31 FIX: 38 MIDI = Subtle but AUDIBLE (was 0.14 → 17 inaudible)
            velocityVariation: 0.04, // ±5 MIDI variation
            articulation: 'legato',
            noteDuration: 8.0, // Drones
            mixWeight: 0.4
        },
        lead: false
    },
    // 🎸 FASE 5.9: Vincular arsenal de instrumentos
    instruments: CYBERPUNK_INSTRUMENTS,
    texture: {
        density: 'sparse',
        verticalSpacing: 0.8, // Amplio
        activeLayersRange: [2, 3],
        transparency: 0.6 // Mucho espacio
    },
    temporal: {
        tempoEvolution: 'static',
        tempoVariation: 0.05,
        intensityArc: 'wave', // Sube y baja suavemente
        fadeIn: 4.0,
        fadeOut: 6.0,
        loopable: true
    }
};
//# sourceMappingURL=cyberpunk.js.map