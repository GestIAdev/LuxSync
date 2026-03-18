/**
 * 🎸 MUSIC ENGINE PRO - API PRINCIPAL
 */
import { StyleEngine } from '../style/StyleEngine.js';
import { StructureEngine } from '../structure/StructureEngine.js';
import { HarmonyEngine } from '../harmony/HarmonyEngine.js';
import { MelodyEngine } from '../harmony/MelodyEngine.js';
import { VitalsIntegrationEngine } from '../vitals/VitalsIntegrationEngine.js';
import { Orchestrator } from '../orchestration/Orchestrator.js';
import { MIDIRenderer } from '../render/MIDIRenderer.js';
import { DrumPatternEngine } from '../rhythm/DrumPatternEngine.js';
import { SeededRandom } from '../utils/SeededRandom.js'; // 🎸 FASE 6.0 - FRENTE #A
export class MusicEnginePro {
    styleEngine;
    structureEngine;
    harmonyEngine;
    melodyEngine;
    vitalsEngine;
    orchestrator;
    renderer;
    drumEngine = null;
    // 🎸 FASE 5.9: PALETA SÓNICA DETERMINISTA
    // Creada UNA VEZ al inicio de generate(), contiene instrumentos fijos (harmony/melody)
    // y pools dinámicos (rhythm/bass) para toda la canción
    sonicPalette = null;
    // 🎸 FASE 6.0 - FRENTE #A: CAPAS MELÓDICAS MULTICAPA
    // Array de 2-4 instrumentos melódicos seleccionados una vez al inicio (AND logic)
    melodicLayers = [];
    constructor() {
        this.styleEngine = new StyleEngine();
        this.structureEngine = new StructureEngine();
        this.harmonyEngine = new HarmonyEngine();
        this.melodyEngine = new MelodyEngine(42); // Seed inicial
        this.vitalsEngine = new VitalsIntegrationEngine();
        this.orchestrator = new Orchestrator();
        this.renderer = new MIDIRenderer();
        // drumEngine se crea en generate() cuando conocemos el tempo
    }
    async generate(params, vitals) {
        const startTime = Date.now();
        // Set deterministic seed for all engines
        this.renderer.setSeed(params.seed || 42);
        // 1. Resolver modo (ModeManager) - por ahora usar entropy como default
        const mode = {
            entropyFactor: 50,
            riskThreshold: 50,
            punkProbability: 50
        };
        // 2. Resolver estilo (StyleEngine.resolveStyle)
        const resolvedStyle = this.styleEngine.resolveStyle(params, mode, vitals);
        const stylePreset = resolvedStyle.preset;
        // 3. Aplicar Vitales (VitalsIntegrationEngine.applyVitalsToStyle)
        const modifiedStyle = vitals
            ? this.vitalsEngine.applyVitalsToStyle(stylePreset, vitals)
            : stylePreset;
        // 4. Generar estructura (StructureEngine.generateStructure)
        const structure = this.structureEngine.generateStructure(params.targetDuration || params.duration || 120, modifiedStyle, params.seed, mode);
        // 🔥 BUG #25 FIX: Crear DrumPatternEngine UNA SOLA VEZ (no en cada sección)
        const tempo = modifiedStyle.musical.tempo;
        if (!this.drumEngine || this.drumEngine['tempo'] !== tempo) {
            this.drumEngine = new DrumPatternEngine(tempo, params.seed || 42);
            console.log(`🔧 [MUSIC ENGINE PRO] DrumPatternEngine created (tempo=${tempo}, seed=${params.seed || 42})`);
        }
        // 🎸 FASE 5.9: CREAR PALETA SÓNICA DETERMINISTA (UNA SOLA VEZ)
        // Decide vibe global (chill/dubchill), elige instrumentos fijos (harmony/melody),
        // y copia pools dinámicos (rhythm/bass) para toda la canción
        this.sonicPalette = this.createSonicPalette(params.seed || 42, modifiedStyle);
        // 🎸 FASE 6.0 - FRENTE #A: SELECCIONAR CAPAS MELÓDICAS MULTICAPA (UNA SOLA VEZ)
        // En lugar de 1 instrumento melódico, elegir 2-4 capas simultáneas usando pools temáticos
        const prngForLayers = new SeededRandom(params.seed || 42);
        this.melodicLayers = this.selectMelodicLayers(modifiedStyle, prngForLayers);
        console.log(`🎸 [MUSIC ENGINE PRO] Capas melódicas seleccionadas: ${this.melodicLayers.length} instrumentos`);
        // 5. Generar contenido por sección (ARQUITECTURA RADICAL: Section como SSOT)
        const allNotes = [];
        const tracks = new Map();
        // 🎨 SCHERZO SÓNICO - Fase 4.1: Rastrear selección de instrumentos por sección
        const instrumentSelections = new Map();
        instrumentSelections.set('melody', []);
        instrumentSelections.set('harmony', []);
        instrumentSelections.set('bass', []);
        instrumentSelections.set('rhythm', []);
        instrumentSelections.set('pad', []);
        for (const section of structure.sections) {
            // 🎨 SCHERZO SÓNICO - Fase 4.1: Seleccionar instrumentos dinámicamente
            // ❌ Bug #7 fix: NO seleccionar melody aquí (usa FIJO classic-sync). Se pobla después con melodicLayers.
            // const melodyInstrument = this.selectInstrumentForSection(section, 'melody', modifiedStyle)
            const harmonyInstrument = this.selectInstrumentForSection(section, 'harmony', modifiedStyle);
            const bassInstrument = this.selectInstrumentForSection(section, 'bass', modifiedStyle);
            const rhythmInstrument = this.selectInstrumentForSection(section, 'rhythm', modifiedStyle);
            const padInstrument = this.selectInstrumentForSection(section, 'pad', modifiedStyle);
            // Rastrear selecciones (necesario para construir metadata JSON después)
            // ❌ Bug #7 fix: NO push melody aquí. Se pobla después del loop con this.melodicLayers.
            // instrumentSelections.get('melody')!.push(melodyInstrument)
            instrumentSelections.get('harmony').push(harmonyInstrument);
            instrumentSelections.get('bass').push(bassInstrument);
            instrumentSelections.get('rhythm').push(rhythmInstrument);
            instrumentSelections.get('pad').push(padInstrument);
            // ✅ PASO 1: Generar Harmony PRIMERO (para calcular densidad real)
            const harmonyOptions = {
                seed: params.seed + section.index,
                section: section, // ✅ PASAR SECTION COMPLETA
                key: 0, // C major por defecto
                mode: modifiedStyle.musical.mode,
                complexity: params.complexity,
                voiceLeadingStrategy: 'smooth'
                // ❌ NO pasar tempo, totalBars - están en section
            };
            const chords = this.harmonyEngine.generateChordSequence(harmonyOptions);
            // ✅ PASO 2: Convertir chords a ResolvedChord[]
            const resolvedChords = this.convertToResolvedChords(chords, section);
            // ✅ PASO 3: Generar MÚLTIPLES Melodías (AND logic multicapa - FASE 6.0)
            const melodyLayers = [];
            let totalMelodyDensity = 0;
            for (let layerIndex = 0; layerIndex < this.melodicLayers.length; layerIndex++) {
                const layer = this.melodicLayers[layerIndex];
                const melodyOptions = {
                    seed: params.seed + section.index + layerIndex * 1000, // Seed diferente por capa
                    section: section,
                    key: 0, // C major
                    mode: modifiedStyle.musical.mode,
                    complexity: params.complexity,
                    contour: 'arched',
                    range: { min: 4, max: 6 } // Octavas 4-6 (C4-C6)
                };
                const melodyResult = this.melodyEngine.generateMelody(melodyOptions);
                const melody = melodyResult.notes;
                melodyLayers.push(melody);
                totalMelodyDensity += melody.length / section.duration;
                console.log(`  🎸 [Capa ${layerIndex + 1}/${this.melodicLayers.length}] ${layer.key}: ${melody.length} notas generadas`);
            }
            // ✅ PASO 4: Calcular TOTALLOAD REAL (basado en notas generadas + TODAS las capas)
            const harmonyDensity = chords.flat().length / section.duration;
            const totalLoad = harmonyDensity + totalMelodyDensity;
            console.log(`[MUSIC ENGINE] Section ${section.index} (${section.type}): harmonyDensity=${harmonyDensity.toFixed(2)}, totalMelodyDensity=${totalMelodyDensity.toFixed(2)} (${this.melodicLayers.length} capas), totalLoad=${totalLoad.toFixed(2)}`);
            // ✅ PASO 5: Generar capas (Orchestrator usa totalLoad REAL)
            const layers = this.orchestrator.generateLayers(section, resolvedChords, melodyLayers[0], // ✅ Pasar primera capa como referencia (Orchestrator legacy)
            modifiedStyle, params.seed + section.index, mode, totalLoad, this.drumEngine);
            // ✅ PASO 6: Recopilar TODAS las notas (incluyendo TODAS las capas melódicas)
            for (const melodyLayer of melodyLayers) {
                allNotes.push(...melodyLayer);
            }
            if (layers.harmony)
                allNotes.push(...layers.harmony);
            if (layers.bass)
                allNotes.push(...layers.bass);
            if (layers.rhythm)
                allNotes.push(...layers.rhythm);
            if (layers.pad)
                allNotes.push(...layers.pad);
            // 🔧 FASE 6.0 - FRENTE #A: Agregar TODAS las capas melódicas como tracks separados
            // En lugar de 1 track 'melody', crear 'melody1', 'melody2', 'melody3', 'melody4'
            for (let layerIndex = 0; layerIndex < melodyLayers.length; layerIndex++) {
                const trackName = layerIndex === 0 ? 'melody' : `melody${layerIndex + 1}`;
                this.addToTrack(tracks, trackName, melodyLayers[layerIndex]);
            }
            this.addToTrack(tracks, 'harmony', layers.harmony || []);
            this.addToTrack(tracks, 'bass', layers.bass || []);
            this.addToTrack(tracks, 'rhythm', layers.rhythm || []);
            if (layers.pad) {
                this.addToTrack(tracks, 'pad', layers.pad);
            }
        }
        // ✅ Bug #7 fix: Poblar instrumentSelections.get('melody') con melodicLayers (no con FIJO classic-sync)
        // Esto garantiza que la metadata JSON tenga Viola, shrill, chop-6, MAX en lugar de classic-sync x4
        instrumentSelections.set('melody', [...this.melodicLayers]);
        // Generate transition fills between sections
        for (let i = 0; i < structure.sections.length - 1; i++) {
            const currentSection = structure.sections[i];
            const nextSection = structure.sections[i + 1];
            // Generate transition fill
            const transitionFill = this.generateTransitionFill(currentSection, nextSection, [] // chords array (pasar los acordes relevantes)
            );
            allNotes.push(...transitionFill);
        }
        // 6. Generar Poesía (placeholder)
        const poetry = await this.generatePoetry(params.seed, structure);
        // 7. Orquestar y mezclar (Orchestrator.separateIntoTracks, Orchestrator.applyMixing)
        // � BUG FIX #7 (FASE 6.0b): Pasar TODOS los tracks (incluyendo melody2, melody3, melody4)
        // En lugar de pasar solo tracks.get('melody'), pasar el Map completo para preservar multicapa
        const separatedTracks = this.orchestrator.separateAllTracks(tracks, modifiedStyle);
        const mixedTracks = this.orchestrator.applyMixing(separatedTracks, modifiedStyle);
        // 8. Renderizar MIDI (MIDIRenderer.renderMultiTrack)
        const midiBuffer = this.renderer.renderMultiTrack(mixedTracks, structure, modifiedStyle);
        // 🎨 SCHERZO SÓNICO - Fase 4.1: Construir Metadata JSON
        // 🐛 BUG FIX #7 (FASE 6.0b): Generar metadata desde mixedTracks DINÁMICAMENTE
        // En FASE 6.0, melody puede tener múltiples tracks ('melody', 'melody2', 'melody3', 'melody4')
        // No podemos usar empiricalMapping hardcoded, necesitamos iterar sobre mixedTracks directamente
        const trackMetadata = [];
        let trackIndex = 0;
        for (const [trackName, notes] of Array.from(mixedTracks.entries())) {
            // Determinar trackType desde trackName
            let trackType;
            if (trackName.startsWith('melody')) {
                trackType = 'melody';
            }
            else {
                trackType = trackName; // 'harmony', 'bass', 'rhythm', 'pad'
            }
            // Buscar instrumento en instrumentSelections
            const selections = instrumentSelections.get(trackType) || [];
            if (selections.length === 0) {
                console.log(`⚠️ [MusicEnginePro] No instrument selection for track '${trackName}', skipping metadata`);
                trackIndex++;
                continue;
            }
            // Para multicapa melody, determinar índice del layer
            let selectionIndex = 0;
            if (trackName.startsWith('melody') && trackName.length > 6) {
                // 'melody2' → index 1, 'melody3' → index 2, etc.
                const layerNumber = parseInt(trackName.substring(6), 10);
                selectionIndex = layerNumber - 1;
            }
            const selection = selections[selectionIndex] || selections[0];
            // 🥁 FASE 5.2: Incluir samples map si es drumkit
            const metadataEntry = {
                empiricalIndex: trackIndex,
                trackType: trackType,
                instrumentKey: selection.key,
                instrumentType: selection.type
            };
            if (selection.type === 'drumkit' && selection.samples) {
                metadataEntry.samples = selection.samples;
                console.log(`🥁 [MusicEnginePro] Drumkit metadata: ${selection.key} con ${Object.keys(selection.samples).length} samples`);
            }
            trackMetadata.push(metadataEntry);
            console.log(`📊 [MusicEnginePro] Metadata: Track ${trackIndex} (${trackName}) → ${selection.key} (${selection.type})`);
            trackIndex++;
        }
        // 9. Construir MusicEngineOutput
        const output = {
            midi: {
                buffer: midiBuffer,
                notes: allNotes,
                tracks: Array.from(mixedTracks.values()).map((track, index) => ({
                    id: `track-${index}`,
                    name: Array.from(mixedTracks.keys())[index],
                    channel: index,
                    notes: track,
                    volume: 100
                })),
                // 🎨 SCHERZO SÓNICO - Fase 4.1: Añadir metadata JSON
                trackMetadata
            },
            poetry,
            metadata: {
                duration: structure.totalDuration,
                tempo: structure.globalTempo,
                key: 'C', // TODO: derivar de rootRange
                mode: modifiedStyle.musical.mode,
                structure: structure.sections.map(s => s.type).join('-'),
                stylePreset: params.stylePreset || 'default',
                seed: params.seed,
                timestamp: params.seed * 1000 // Timestamp determinista basado en seed
            },
            analysis: {
                complexity: params.complexity,
                intensity: vitals?.stress || 0.5,
                harmony: vitals?.harmony || 0.5,
                motifDevelopment: 'fibonacci-based',
                progressionUsed: 'I-V-vi-IV'
            }
        };
        // 10. Persistir (placeholder)
        await this.persistOutput(output);
        // 11. Reportar métricas
        await this.reportMetrics(startTime, output);
        return output;
    }
    async generateFromConsensus(result) {
        const params = this.consensusToParams(result);
        return this.generate(params);
    }
    async quickGenerate(style, duration, seed) {
        const params = {
            seed,
            beauty: 0.5,
            complexity: 0.5,
            duration,
            stylePreset: style
        };
        return this.generate(params);
    }
    consensusToParams(result) {
        // Convertir resultado de ConsensusResult a MusicGenerationParams
        // Usar timestamp + process.pid para seed determinista (Axioma Anti-Simulación)
        return {
            seed: result.seed || (Date.now() + (process.pid || 0)),
            beauty: result.beauty || 0.5,
            complexity: result.complexity || 0.5,
            duration: result.duration || 120,
            stylePreset: result.stylePreset || 'cyberpunkpreset', // 🎨 FASE 4.4 - Reparación "Gregoriano"
            mode: result.mode || 'entropy'
        };
    }
    /**
     * � FASE 5.9: CREAR PALETA SÓNICA DETERMINISTA
     *
     * Crea la paleta completa de instrumentos para la canción:
     * - Decide el VIBE global (chill vs dubchill) basado en seed
     * - Elige UN instrumento de harmony (se queda toda la canción)
     * - Elige UN instrumento de melody (se queda toda la canción)
     * - Copia los pools completos de rhythm/bass (para elegir según intensity)
     *
     * LLAMAR UNA SOLA VEZ al inicio de generate(), antes del loop de secciones.
     */
    createSonicPalette(seed, preset) {
        if (!preset.instruments) {
            console.log(`⚠️ [MusicEnginePro] Preset '${preset.id}' no tiene configuración de instrumentos. Usando fallback.`);
            return {
                vibe: 'chill',
                harmonyInstrument: { key: 'default', type: 'oneshot' },
                melodyInstrument: { key: 'default', type: 'oneshot' },
                rhythmPalette: [],
                bassPalette: []
            };
        }
        // Acceder al PRNG (ya seteado en generate())
        // ⚠️ MIDIRenderer.random es private, pero lo accedemos con bracket notation
        const prng = this.renderer['random'];
        // Validar que el PRNG esté inicializado
        if (!prng || typeof prng.next !== 'function') {
            console.error(`❌ [MusicEnginePro] PRNG no inicializado. Usando fallback con vibe 'chill'.`);
            return {
                vibe: 'chill',
                harmonyInstrument: { key: 'default', type: 'oneshot' },
                melodyInstrument: { key: 'default', type: 'oneshot' },
                rhythmPalette: preset.instruments.rhythm_chill || [],
                bassPalette: preset.instruments.bass_chill || []
            };
        }
        // 1. Decidir VIBE global (50/50 chill vs dubchill basado en seed)
        const vibe = prng.next() < 0.5 ? 'chill' : 'dubchill';
        console.log(`🎸 [MusicEnginePro] VIBE GLOBAL decidido (seed=${seed}): ${vibe}`);
        // 2. Elegir harmony (según vibe)
        const harmonyPool = vibe === 'chill'
            ? (preset.instruments.harmony_chill || [])
            : (preset.instruments.harmony_dubchill || []);
        const harmonyInstrument = harmonyPool.length > 0
            ? prng.choice(harmonyPool)
            : { key: 'default-harmony', type: 'oneshot' };
        // 3. Elegir melody (según vibe)
        const melodyPool = vibe === 'chill'
            ? (preset.instruments.melody_chill || [])
            : (preset.instruments.melody_dubchill || []);
        const melodyInstrument = melodyPool.length > 0
            ? prng.choice(melodyPool)
            : { key: 'default-melody', type: 'oneshot' };
        // 4. Copiar pools completos para rhythm/bass (según vibe)
        const rhythmPalette = vibe === 'chill'
            ? (preset.instruments.rhythm_chill || [])
            : (preset.instruments.rhythm_dubchill || []);
        const bassPalette = vibe === 'chill'
            ? (preset.instruments.bass_chill || [])
            : (preset.instruments.bass_dubchill || []);
        console.log(`🎨 [MusicEnginePro] PALETA CREADA:`);
        console.log(`  → Harmony: ${harmonyInstrument.key} (${harmonyInstrument.type})`);
        console.log(`  → Melody: ${melodyInstrument.key} (${melodyInstrument.type})`);
        console.log(`  → Rhythm pool: ${rhythmPalette.length} instrumentos`);
        console.log(`  → Bass pool: ${bassPalette.length} instrumentos`);
        return {
            vibe,
            harmonyInstrument,
            melodyInstrument,
            rhythmPalette,
            bassPalette
        };
    }
    /**
     * � FASE 6.0 - FRENTE #A: Selección Multicapa (AND logic)
     *
     * En lugar de elegir 1 solo instrumento melódico, elige 2-4 capas simultáneas
     * usando los pools temáticos (strings, plucks, vocals, leads) según estrategia del vibe.
     *
     * COMPORTAMIENTO:
     * - Chill: 2-3 capas (strings base + plucks/vocals)
     * - Dubchill: 3-4 capas (strings + plucks + vocals + leads)
     * - Selección determinista usando SeededRandom
     * - Sin repetir instrumentos en la misma canción
     *
     * @param preset - StylePreset con melodicLayerPools y layerStrategies
     * @param prng - SeededRandom para selección determinista
     * @returns Array de 2-4 InstrumentSelection (capas simultáneas)
     */
    selectMelodicLayers(preset, prng) {
        // Verificar que el preset tenga las nuevas estructuras
        if (!preset.melodicLayerPools || !preset.layerStrategies) {
            console.warn(`⚠️ [MusicEnginePro] Preset sin melodicLayerPools/layerStrategies. Usando fallback legacy.`);
            // Fallback: usar melody_chill o melody_dubchill (1 sola capa)
            const vibe = this.sonicPalette?.vibe || 'chill';
            const legacyPool = vibe === 'chill'
                ? (preset.instruments?.melody_chill || [])
                : (preset.instruments?.melody_dubchill || []);
            const legacyInstrument = legacyPool.length > 0
                ? prng.choice(legacyPool)
                : { key: 'default-melody', type: 'oneshot' };
            return [legacyInstrument];
        }
        const vibe = this.sonicPalette?.vibe || 'chill';
        const strategy = preset.layerStrategies[vibe];
        const pools = preset.melodicLayerPools;
        // Determinar cantidad de capas (minLayers a maxLayers)
        const numLayers = prng.range(strategy.minLayers, strategy.maxLayers + 1);
        console.log(`🎸 [MusicEnginePro] Seleccionando ${numLayers} capas melódicas (vibe: ${vibe})`);
        const selectedLayers = [];
        const usedPoolNames = [];
        // Seleccionar capas según weights (pools con mayor weight tienen más probabilidad)
        for (let i = 0; i < numLayers; i++) {
            // Filtrar pools no usados
            const availablePools = strategy.pools.filter(p => !usedPoolNames.includes(p));
            if (availablePools.length === 0)
                break; // No hay más pools disponibles
            // Seleccionar pool usando weights (weighted choice)
            const poolWeights = availablePools.map(p => {
                const index = strategy.pools.indexOf(p);
                return strategy.weights[index] || 0.25;
            });
            const selectedPoolName = prng.weightedChoice(availablePools, poolWeights);
            usedPoolNames.push(selectedPoolName);
            // Seleccionar instrumento del pool elegido
            const pool = pools[selectedPoolName];
            if (pool && pool.length > 0) {
                const instrument = prng.choice(pool);
                selectedLayers.push(instrument);
                console.log(`  → Capa ${i + 1}: ${instrument.key} (pool: ${selectedPoolName}, type: ${instrument.type})`);
            }
        }
        // Fallback: si no se seleccionó nada, usar default
        if (selectedLayers.length === 0) {
            console.warn(`⚠️ [MusicEnginePro] No se pudo seleccionar capas. Usando fallback.`);
            return [{ key: 'default-melody', type: 'oneshot' }];
        }
        return selectedLayers;
    }
    /**
     * �🎨 SCHERZO SÓNICO - Fase 4.1: Selección Dinámica de Instrumentos
     * 🎸 FASE 5.9: REFACTORIZADO para usar SonicPalette
     *
     * COMPORTAMIENTO:
     * - Harmony/Melody: SIEMPRE retornar el instrumento fijo de la paleta (no cambia)
     * - Rhythm/Bass: Elegir del pool según intensity de la sección (cambia dinámicamente)
     *
     * @param section - Sección actual (contiene intensity en profile)
     * @param layer - Layer musical ('melody', 'harmony', 'bass', 'rhythm', 'pad')
     * @param stylePreset - Preset de estilo con arsenal de instrumentos
     * @returns InstrumentSelection con key y type, o fallback
     */
    selectInstrumentForSection(section, layer, stylePreset) {
        // 🎸 FASE 5.9: Verificar que la paleta esté creada
        if (!this.sonicPalette) {
            console.log(`⚠️ [MusicEnginePro] sonicPalette NO CREADA. Llamar createSonicPalette() primero.`);
            return { key: 'default', type: 'oneshot' };
        }
        const intensity = section.profile?.intensity ?? 0.5;
        const sectionType = section.type;
        // � FASE 5.9: IDENTIDAD ESTÁTICA - Harmony y Melody NO CAMBIAN
        if (layer === 'harmony') {
            console.log(`🎨 [MusicEnginePro] Section '${sectionType}' (intensity=${intensity.toFixed(2)}): ${layer} → ${this.sonicPalette.harmonyInstrument.key} (FIJO)`);
            return this.sonicPalette.harmonyInstrument;
        }
        if (layer === 'melody') {
            console.log(`🎨 [MusicEnginePro] Section '${sectionType}' (intensity=${intensity.toFixed(2)}): ${layer} → ${this.sonicPalette.melodyInstrument.key} (FIJO)`);
            return this.sonicPalette.melodyInstrument;
        }
        // � FASE 5.9: ENERGÍA DINÁMICA - Rhythm y Bass CAMBIAN según intensity
        let selectionPool = [];
        if (layer === 'bass') {
            selectionPool = this.sonicPalette.bassPalette;
        }
        else if (layer === 'rhythm') {
            // 🐛 BUG FIX #4 (FASE 6.0b): Tron patterns (intensity < 0.4) usan ambient-kit-1 (con crash-long)
            // Condicion alineada con DrumPatternEngine.ts linea 707 (selectPattern)
            if (intensity < 0.4) {
                // 🐛 BUG FIX #6 (FASE 6.0c): ambient-kit-1 está en rhythm_chill, NO en rhythmPalette (dubchill)
                // Buscar directamente en preset.instruments.rhythm_chill
                const chillRhythmPool = stylePreset.instruments?.rhythm_chill || [];
                const ambientKitFromPreset = chillRhythmPool.find(inst => inst.key === 'ambient-kit-1');
                if (ambientKitFromPreset) {
                    console.log(`🎨 [MusicEnginePro] Section '${sectionType}' (intensity=${intensity.toFixed(2)}): ${layer} → ${ambientKitFromPreset.key} (FORZADO ambient-kit-1 para Tron)`);
                    return ambientKitFromPreset; // Devolver con samples incluidos
                }
                else {
                    // Fallback si no se encuentra (no debería pasar)
                    console.warn(`⚠️ [MusicEnginePro] ambient-kit-1 NOT FOUND in rhythm_chill, usando fallback`);
                    const ambientKit = {
                        key: 'drums/ambient-kit-1',
                        type: 'drumkit'
                    };
                    return ambientKit;
                }
            }
            selectionPool = this.sonicPalette.rhythmPalette;
        }
        else if (layer === 'pad') {
            // PAD: Lógica legacy (no está en paleta todavía)
            const padInstruments = stylePreset.instruments?.pad || [];
            selectionPool = padInstruments;
        }
        // ⚠️ VALIDACIÓN: Pool vacío
        if (!selectionPool || selectionPool.length === 0) {
            console.log(`⚠️ [MusicEnginePro] No hay instrumentos disponibles para layer '${layer}'. Usando fallback.`);
            return { key: 'default', type: 'oneshot' };
        }
        // � SELECCIÓN DETERMINISTA según intensity
        // Mapear intensity [0-1] a índice en el pool
        const index = Math.floor(intensity * selectionPool.length);
        const clampedIndex = Math.min(index, selectionPool.length - 1);
        const selection = selectionPool[clampedIndex];
        console.log(`🎨 [MusicEnginePro] Section '${sectionType}' (intensity=${intensity.toFixed(2)}): ${layer} → ${selection.key} (${selection.type}) [pool index ${clampedIndex}/${selectionPool.length}]`);
        return selection;
    }
    addToTrack(tracks, trackName, notes) {
        if (!tracks.has(trackName)) {
            tracks.set(trackName, []);
        }
        tracks.get(trackName).push(...notes);
    }
    /**
     * ✅ HELPER: Convertir MIDINote[][] (chords del HarmonyEngine) a ResolvedChord[]
     * Respeta section.duration y section.bars para calcular tiempos correctos
     */
    convertToResolvedChords(chords, section) {
        const secondsPerBar = section.duration / section.bars;
        return chords.map((chord, index) => {
            // Calcular startTime basado en la posición del acorde
            // Si el acorde ya tiene startTime (del HarmonyEngine), usarlo
            // Si no, calcularlo como offset dentro de la sección
            const chordStartTime = chord[0]?.startTime ?? (section.startTime + (index * secondsPerBar));
            const chordDuration = chord[0]?.duration ?? secondsPerBar;
            return {
                notes: chord.map(n => n.pitch),
                root: chord[0]?.pitch || 60,
                startTime: chordStartTime,
                duration: chordDuration
            };
        });
    }
    async generatePoetry(seed, structure) {
        // Placeholder - implementar generación de poesía
        console.log(`Generating poetry with seed ${seed} for structure with ${structure.sections.length} sections`);
        const verses = [
            `Verse 1: Generated with seed ${seed}`,
            `Verse 2: Structure has ${structure.sections.length} sections`,
            `Verse 3: Musical journey unfolds`
        ];
        return {
            verses,
            fullText: verses.join('\n'),
            theme: 'musical-journey',
            mood: 'contemplative'
        };
    }
    async persistOutput(output) {
        // Placeholder - implementar persistencia (Redis, filesystem, etc.)
        console.log(`Persisting output with ${output.midi.notes.length} notes`);
    }
    async reportMetrics(startTime, output) {
        const duration = Date.now() - startTime;
        console.log(`Generation completed in ${duration}ms`);
        console.log(`Generated ${output.midi.notes.length} notes across ${output.midi.tracks.length} tracks`);
    }
    /**
     * Generate transition fills between sections
     */
    generateTransitionFill(fromSection, toSection, chords) {
        const fillNotes = [];
        const transitionStart = fromSection.startTime + fromSection.duration - 2; // Last 2 seconds
        const transitionDuration = 2; // 2 seconds fill
        // Drum fill (snare roll)
        for (let t = 0; t < transitionDuration; t += 0.125) { // 16th notes
            fillNotes.push({
                pitch: 38, // Snare
                velocity: 60 + Math.floor(t / transitionDuration * 40), // Crescendo
                startTime: transitionStart + t,
                duration: 0.1,
                channel: 9
            });
        }
        // Cymbal crash at transition point
        fillNotes.push({
            pitch: 49, // Crash cymbal
            velocity: 100,
            startTime: fromSection.startTime + fromSection.duration,
            duration: 3.0, // Long ring
            channel: 9
        });
        return fillNotes;
    }
}
//# sourceMappingURL=MusicEnginePro.js.map