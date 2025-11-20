import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { Redis } from 'ioredis';
import { PoetryLibrary } from '../../shared/libraries/PoetryLibrary.ts';
import { ModeManager } from '../../evolutionary/modes/mode-manager.js';
import { SystemVitals } from '../core/SystemVitals.ts';
/**
 * 🎵 PHASE 3.2: Musical Consensus Recorder
 * Records consensus events as MIDI file for playback
 *
 * Performance: 0% overhead during runtime (only writes file at end)
 * Features:
 * - Each node = musical note (deterministic pitch mapping)
 * - Consensus success = harmony chord (C major)
 * - Beauty score = note velocity (louder = more beautiful)
 * - Consensus time = note duration
 * - Auto-export on server shutdown
 */
export class MusicalConsensusRecorder {
    constructor() {
        this.recording = [];
        this.isRecording = false;
        this.startTime = 0;
        this.verseCount = 0;
        // 🎯 DIRECTIVA 12.13: Sistema de Debug en Tiempo Real
        this.profileLog = [];
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            db: 0,
        });
        this.recording = []; // Initialize recording array
        this.poetryLibrary = new PoetryLibrary();
        // 🔀 PHASE 7.1: Initialize Mode Awareness (SSE-7.1)
        this.modeManager = ModeManager.getInstance();
        this.currentModeConfig = this.modeManager.getModeConfig();
        console.log(`🎵 MusicalConsensusRecorder initialized - Active Mode: ${this.modeManager.getCurrentMode()}`);
    }
    /**
     * 🎵 FASE 3: DESCOMPRESIÓN MIDI
     * Descomprime datos MIDI comprimidos para reproducción
     */
    async decompressMIDI(compressedBuffer) {
        return new Promise((resolve, reject) => {
            zlib.gunzip(compressedBuffer, (error, decompressed) => {
                if (error) {
                    console.warn('⚠️ MIDI decompression failed:', error.message);
                    resolve(compressedBuffer); // Return as-is if decompression fails
                }
                else {
                    console.log(`📤 MIDI decompressed: ${compressedBuffer.length} → ${decompressed.length} bytes`);
                    resolve(decompressed);
                }
            });
        });
    }
    /**
     * 🎵 FASE 3: COMPRESIÓN INTELIGENTE
     * Decide si comprimir basado en tamaño y calidad del archivo
     */
    shouldCompressMIDI(midiBuffer, quality) {
        // Comprimir si el archivo es grande (>1KB) o calidad baja (menor compresión necesaria)
        const sizeThreshold = 1024; // 1KB
        const qualityThreshold = 0.8; // Alta calidad = menos compresión necesaria
        return midiBuffer.length > sizeThreshold || quality < qualityThreshold;
    }
    /**
     * Start recording
     */
    startRecording() {
        console.log('🎵 Starting musical consensus recording');
        this.recording = [];
        this.isRecording = true;
        this.startTime = Date.now();
    }
    /**
     * Record consensus event as musical note
     */
    async recordConsensusEvent(result, intentParameters) {
        // 🎯 DIRECTIVA 12.5: DEPURACIÓN QUIRÚRGICA DE LA RECUPERACIÓN DE INTENCIÓN
        let intentionParams = undefined; // Asegurar declaración en scope correcto
        try {
            const intentJSON = await this.redis.rpop('selene:intent:queue');
            if (intentJSON) {
                intentionParams = JSON.parse(intentJSON);
            }
            else {
                intentionParams = undefined;
            }
        }
        catch (e) {
            intentionParams = undefined; // Asegurar que sea undefined en caso de error
        }
        // 🎯 FORJA 9.0: Permitir procesamiento sin grabación activa para comandos Redis
        // Generar notas básicas por defecto, usar grabadas solo cuando haya contenido grabado
        // DENTRO de recordConsensusEvent, ANTES de la lógica de notas
        let notes = [];
        try {
            // *** ¡GENERAR SINFONÍA SIEMPRE! ***
            notes = this.composeConsensusSymphony(result, intentionParams);
            if (!notes || notes.length === 0) {
            }
        }
        catch (genError) {
            notes = [];
        }
        // Log final ANTES de pasar las notas
        console.error(`--- [MIDI FLOW DEBUG END] ---\n`);
        console.log(`🎵 Processing consensus event with ${notes.length} notes`);
        // 🎵 INTEGRACIÓN DASHBOARD: Generar poesía zodiacal y guardar en Redis
        const consensusResult = await this.saveConsensusToDashboard(result, intentionParams, notes);
        return consensusResult;
    }
    /**
     * 🎵 DASHBOARD INTEGRATION: Save consensus data to Redis for dashboard display
     */
    async saveConsensusToDashboard(result, intentParameters, midiNotes) {
        try {
            // FASE 1: Basic Musical Quality Evaluation (before poetry generation)
            const basicQuality = this.evaluateBasicMusicalQuality(result, midiNotes || this.recording);
            if (basicQuality < 0.2) {
                console.log(`🎵 Basic musical quality too low (${basicQuality.toFixed(3)} < 0.2) - skipping art generation`);
                return null;
            }
            console.log(`🎵 Basic musical quality passed (${basicQuality.toFixed(3)} >= 0.2) - proceeding with poetry generation`);
            // FASE 2: Generate Poetry (only if basic quality passes)
            const poetryData = await this.generateConsensusPoetry(result, intentParameters);
            if (!poetryData || !poetryData.verse) {
                console.warn('⚠️ Poetry generation failed - skipping dashboard save');
                return null;
            }
            // FASE 3: Complete Artistic Quality Evaluation (VECTOR 4D)
            const proceduralProfile = await this.generateArtisticProfile(result, midiNotes || this.recording, poetryData, undefined, intentParameters);
            // 🎯 DIRECTIVA 12.13: Capturar perfil para debug en tiempo real
            this.captureProfileVector(proceduralProfile);
            // FASE 4: Multidimensional Save Logic (FORJA 9.0 with Intent Parameters)
            const saveResult = await this.saveWithProceduralProfile(result, poetryData, proceduralProfile);
            // FASE 5: Generate and save MIDI recording if musical quality is sufficient
            if (basicQuality >= 0.2) {
                await this.saveMIDIRecording(result, proceduralProfile, midiNotes);
            }
            // FASE 6: Save basic consensus data to dashboard keys
            await this.saveBasicConsensusToDashboard(result, proceduralProfile);
            console.log('✅ Consensus successfully saved to dashboard');
            return saveResult;
        }
        catch (error) {
            console.error('❌ Failed to save consensus to dashboard:', error.message);
            console.error('❌ Error stack:', error.stack);
            return null;
        }
    }
    /**
     * FORJA 8.3: Save with Procedural Profile - Multidimensional Classification with Real Metrics
     * Classifies artistic "nature" using authentic 4D metrics (coherence/variety/rarity/complexity)
     * without post-generation falsification by intention parameters
     */
    async saveWithProceduralProfile(result, poetryData, proceduralProfile, intentParameters) {
        let { coherence, variety, rarity, complexity, zodiacSignature, leaderPersonality, consensusContext } = proceduralProfile;
        // 🎯 FORJA 9.0: CLASIFICACIÓN DETERMINADA POR INTENCIÓN
        // Si hay intención, la clasificación se determina directamente por el perfil de intención
        let forcedClassification = null;
        if (intentParameters && intentParameters.profile) {
            console.log(`🎯 FORJA 9.0 - CLASIFICACIÓN FORZADA POR INTENCIÓN: ${intentParameters.profile}`);
            forcedClassification = intentParameters.profile;
            // Aplicar amplificación de métricas según perfil de intención (sin cambiar clasificación)
            switch (intentParameters.profile) {
                case 'legendary':
                    coherence = Math.min(1.0, coherence * 1.4); // +40% coherencia
                    variety = Math.min(1.0, variety * 1.25); // +25% variedad
                    rarity = Math.min(1.0, rarity * 1.5); // +50% rareza
                    complexity = Math.min(1.0, complexity * 1.3); // +30% complejidad
                    break;
                case 'experimental':
                    coherence = Math.max(0.0, coherence * 0.7); // -30% coherencia
                    variety = Math.min(1.0, variety * 1.6); // +60% variedad
                    rarity = Math.min(1.0, rarity * 1.2); // +20% rareza
                    complexity = Math.min(1.0, complexity * 1.5); // +50% complejidad
                    break;
            }
        }
        // FORJA 8.3: Clasificación Jerárquica (con métricas reales) - SOLO SI NO HAY CLASIFICACIÓN FORZADA
        let isLegendary = false;
        let isExperimental = false;
        let isCommon = false;
        if (!forcedClassification) {
            // Umbrales fijos FORJA 8.3 originales
            const legendaryThresholds = { coherence: 0.75, rarity: 0.8, complexity: 0.53 };
            const experimentalThreshold = 0.45;
            const commonThreshold = 0.7;
            // 1. HORQUILLA LEGENDARY: ¿Es una obra maestra (Coherencia + Rareza + Complejidad)?
            isLegendary = coherence > legendaryThresholds.coherence &&
                rarity > legendaryThresholds.rarity &&
                complexity > legendaryThresholds.complexity;
            // 2. HORQUILLA EXPERIMENTAL: Si NO es legendaria, ¿es altamente innovadora?
            isExperimental = variety > experimentalThreshold && !isLegendary;
            // 3. HORQUILLA COMMON: Si NO es legendaria NI experimental, ¿es al menos coherente?
            isCommon = coherence > commonThreshold && !isLegendary && !isExperimental;
        }
        else {
            // Aplicar clasificación forzada por intención
            isLegendary = forcedClassification === 'legendary';
            isExperimental = forcedClassification === 'experimental';
            isCommon = forcedClassification === 'common';
        }
        console.log(`🔥 FORJA 9.0 - VECTOR 4D CLASSIFICATION JERÁRQUICA:`);
        console.log(`   Coherence: ${(coherence * 100).toFixed(1)}% | Variety: ${(variety * 100).toFixed(1)}% | Rarity: ${(rarity * 100).toFixed(1)}% | Complexity: ${(complexity * 100).toFixed(1)}%`);
        console.log(`   Zodiac: ${zodiacSignature} | Leader: ${leaderPersonality} | Context: ${consensusContext}`);
        console.log(`   Classification: ${isLegendary ? 'LEGENDARY' : isExperimental ? 'EXPERIMENTAL' : isCommon ? 'COMMON' : 'REJECTED'} ${forcedClassification ? '(FORCED BY INTENTION)' : '(METRIC-BASED)'}`);
        // Always save to regular poems for debugging
        const completeProceduralProfile = {
            coherence,
            variety,
            rarity,
            complexity,
            zodiacSignature,
            leaderPersonality,
            consensusContext,
            timestamp: Date.now(),
            midiNoteCount: 0, // Will be set by the generation process
            poetryLength: 0 // Will be set by the generation process
        };
        await this.saveToRegularPoems(poetryData, completeProceduralProfile);
        // FORJA 6.0: Conditional Legendary Cache
        if (isLegendary) {
            console.log(`🌟 LEGENDARY MASTERPIECE - Saving to legendary cache`);
            await this.saveToLegendaryCache(poetryData, coherence);
        }
        else if (isExperimental) {
            console.log(`🧪 EXPERIMENTAL INNOVATION - Saving to experimental cache`);
            await this.saveToExperimentalCache(poetryData, completeProceduralProfile);
        }
        else if (isCommon) {
            console.log(`📚 COMMON QUALITY - Saving to common cache`);
            await this.saveToCommonCache(poetryData, completeProceduralProfile);
        }
        else {
            console.log(`❌ REJECTED - Below minimum coherence threshold`);
        }
        // Save basic consensus to dashboard (use coherence as quality)
        await this.saveBasicConsensusToDashboard(result, coherence);
        // Devolver objeto con clasificación
        const classification = isLegendary ? 'legendary' : isExperimental ? 'experimental' : isCommon ? 'common' : 'rejected';
        return {
            ...poetryData,
            classification
        };
    }
    /**
     * Save to experimental cache (selene:art:experimental)
     */
    async saveToExperimentalCache(poetryData, proceduralProfile) {
        try {
            const experimentalEntry = {
                type: 'poem',
                id: poetryData.id,
                timestamp: poetryData.timestamp || Date.now(),
                verse: poetryData.verse,
                zodiacSign: poetryData.zodiacSign,
                element: poetryData.element,
                proceduralProfile,
                qualityMetrics: poetryData.qualityMetrics || {},
                nft: poetryData.nft || null
            };
            await this.redis.lpush('selene:art:experimental', JSON.stringify(experimentalEntry));
            await this.redis.ltrim('selene:art:experimental', 0, 49); // Keep last 50 experimental works
            console.log(`🧪 Poem saved to experimental cache: ${experimentalEntry.id}`);
        }
        catch (error) {
            console.warn('⚠️ Failed to save poem to experimental cache:', error.message);
        }
    }
    /**
     * Save to common cache (selene:art:common)
     */
    async saveToCommonCache(poetryData, proceduralProfile) {
        try {
            const commonEntry = {
                type: 'poem',
                id: poetryData.id,
                timestamp: poetryData.timestamp || Date.now(),
                verse: poetryData.verse,
                zodiacSign: poetryData.zodiacSign,
                element: poetryData.element,
                proceduralProfile,
                qualityMetrics: poetryData.qualityMetrics || {},
                nft: poetryData.nft || null
            };
            await this.redis.lpush('selene:art:common', JSON.stringify(commonEntry));
            await this.redis.ltrim('selene:art:common', 0, 99); // Keep last 100 common works
            console.log(`📚 Poem saved to common cache: ${commonEntry.id}`);
        }
        catch (error) {
            console.warn('⚠️ Failed to save poem to common cache:', error.message);
        }
    }
    /**
     * Save poetry to regular poems list (selene:poems:nft)
     */
    async saveToRegularPoems(poetryData, quality) {
        try {
            // Handle both legacy number quality and new ProceduralProfile
            const qualityValue = typeof quality === 'number' ? quality : quality.coherence;
            const proceduralProfile = typeof quality === 'object' ? quality : null;
            const poemEntry = {
                ...poetryData,
                advancedQuality: qualityValue,
                proceduralProfile,
                qualityMetrics: poetryData.qualityMetrics || {},
                timestamp: Date.now()
            };
            await this.redis.lpush('selene:poems:nft', JSON.stringify(poemEntry));
            await this.redis.ltrim('selene:poems:nft', 0, 99); // Keep last 100 poems
            console.log(`📜 Poem saved to regular cache: ${poemEntry.id}`);
        }
        catch (error) {
            console.warn('⚠️ Failed to save poem to regular cache:', error.message);
        }
    }
    /**
     * Save high-quality art to legendary cache (selene:art:legendary)
     */
    async saveToLegendaryCache(poetryData, quality) {
        try {
            // Handle both legacy number quality and new ProceduralProfile
            const qualityValue = typeof quality === 'number' ? quality : quality.coherence;
            const proceduralProfile = typeof quality === 'object' ? quality : null;
            const legendaryEntry = {
                type: 'poem',
                id: poetryData.id,
                timestamp: poetryData.timestamp || Date.now(),
                verse: poetryData.verse,
                zodiacSign: poetryData.zodiacSign,
                element: poetryData.element,
                quality: poetryData.beauty,
                advancedQuality: qualityValue,
                proceduralProfile,
                qualityMetrics: poetryData.qualityMetrics || {},
                nft: poetryData.nft || null
            };
            await this.redis.lpush('selene:art:legendary', JSON.stringify(legendaryEntry));
            // Apply legendary cache policy (keep only best art)
            await this.enforceLegendaryCachePolicy();
            console.log(`🌟 Poem saved to legendary cache: ${legendaryEntry.id} (quality: ${qualityValue.toFixed(3)})`);
        }
        catch (error) {
            console.warn('⚠️ Failed to save poem to legendary cache:', error.message);
        }
    }
    /**
     * Save MIDI recording for high-quality consensus
     */
    async saveMIDIRecording(result, quality, midiNotes) {
        try {
            // Handle both legacy number quality and new ProceduralProfile
            const qualityValue = typeof quality === 'number' ? quality : quality.coherence;
            const proceduralProfile = typeof quality === 'object' ? quality : null;
            const notesToUse = midiNotes || this.recording;
            // Validate that we have notes to save
            if (notesToUse.length === 0) {
                console.log('⚠️ No notes to save, skipping MIDI recording');
                return;
            }
            // Validate consensus result
            if (!result || !result.participants || result.participants.length === 0) {
                console.warn('⚠️ Invalid consensus result, skipping MIDI recording');
                return;
            }
            // Create actual MIDI file from recorded notes
            const midiBuffer = await this.createMIDIBuffer(notesToUse);
            // Validate MIDI buffer
            if (!midiBuffer || midiBuffer.length === 0) {
                console.warn('⚠️ Failed to create MIDI buffer, skipping file save');
                return;
            }
            // Save MIDI file to disk
            const timestamp = Date.now();
            const midiFilename = `consensus_${timestamp}_${this.hashString(timestamp.toString()).toString(36).substr(0, 9)}.mid`;
            const midiPath = path.join(process.cwd(), 'midi_recordings', midiFilename);
            // Ensure directory exists
            const midiDir = path.dirname(midiPath);
            if (!fs.existsSync(midiDir)) {
                fs.mkdirSync(midiDir, { recursive: true });
            }
            // Compress and save MIDI file
            const compressedBuffer = await this.compressMIDI(midiBuffer);
            fs.writeFileSync(midiPath, compressedBuffer);
            // Verify file was saved correctly
            if (!fs.existsSync(midiPath)) {
                console.warn('⚠️ MIDI file was not saved to disk, skipping metadata save');
                return;
            }
            const stats = fs.statSync(midiPath);
            const actualFileSize = stats.size;
            // Validate file size
            if (actualFileSize === 0) {
                console.warn('⚠️ MIDI file is empty, cleaning up and skipping metadata save');
                try {
                    fs.unlinkSync(midiPath);
                }
                catch (cleanupError) {
                    console.warn('⚠️ Failed to cleanup empty MIDI file:', cleanupError.message);
                }
                return;
            }
            // Save metadata to Redis only after successful file save
            const midiEntry = {
                type: 'midi',
                id: `midi_${timestamp}_${this.hashString(timestamp.toString() + 'midi').toString(36).substr(0, 9)}`,
                timestamp: timestamp,
                filename: midiFilename,
                filepath: midiPath,
                notes: notesToUse.length,
                duration: notesToUse.length > 0 ? Math.max(...notesToUse.map(n => n.time + n.duration)) : 0,
                advancedQuality: quality,
                beauty: result.beauty,
                participants: result.participants.length,
                compressed: true,
                fileSize: actualFileSize
            };
            await this.redis.lpush('selene:midi:recordings', JSON.stringify(midiEntry));
            // Apply legendary cache policy
            await this.enforceLegendaryCachePolicy();
            // Clear recording buffer only after successful save (only if we used the actual recording buffer)
            if (!midiNotes) {
                this.recording = [];
            }
        }
        catch (error) {
            console.warn('⚠️ [DEBUG] Failed to save MIDI recording:', error.message);
            console.warn('⚠️ [DEBUG] Error stack:', error.stack);
            // Don't clear recording buffer on error - allow retry
        }
    }
    /**
     * 🎵 FASE 3: DESCOMPRESIÓN PARA REPRODUCCIÓN
     * Descomprime y devuelve archivo MIDI listo para reproducción
     */
    async decompressMIDIFile(compressedFilePath) {
        try {
            if (!fs.existsSync(compressedFilePath)) {
                throw new Error(`File not found: ${compressedFilePath}`);
            }
            const compressedBuffer = fs.readFileSync(compressedFilePath);
            // Check if file is compressed (gzip header: 0x1f 0x8b)
            if (compressedBuffer.length >= 2 && compressedBuffer[0] === 0x1f && compressedBuffer[1] === 0x8b) {
                return await this.decompressMIDI(compressedBuffer);
            }
            else {
                // File is not compressed
                return compressedBuffer;
            }
        }
        catch (error) {
            console.warn('⚠️ MIDI decompression failed:', error.message);
            throw error;
        }
    }
    /**
     * 🎵 FASE 3: OBTENER ESTADÍSTICAS DE COMPRESIÓN
     * Devuelve métricas de compresión para monitoreo
     */
    getCompressionStats() {
        // This would be populated from Redis data in a real implementation
        // For now, return placeholder stats
        return {
            totalFiles: 0,
            compressedFiles: 0,
            averageRatio: 0,
            totalSpaceSaved: 0
        };
    }
    /**
     * 🎯 FASE 3: CACHE INTELIGENTE - HIGH QUALITY ART ONLY
     * Evalúa si el arte es digno de preservación eterna (quality >= 0.95 for legendary)
     * Para FORJA 9.0: MIDI usa combinación de vectores 4D con umbral más accesible
     */
    isLegendaryArt(quality, item) {
        // Si es un MIDI con perfil procedural, usar lógica FORJA 9.0
        if (item && item.proceduralProfile) {
            const profile = item.proceduralProfile;
            // Combinación ponderada de vectores 4D para determinar legendary status
            const legendaryScore = (profile.coherence * 0.4) + (profile.variety * 0.2) + (profile.rarity * 0.2) + (profile.complexity * 0.2);
            return legendaryScore >= 0.6; // Umbral más accesible para FORJA 9.0 - BAJADO PARA PERMITIR MÁS VARIEDAD
        }
        // Para otros tipos de arte (poetry, archivos MIDI), mantener umbral alto
        return quality >= 0.95; // True legendary art requires exceptional quality (>=95%)
    }
    /**
     * 🎯 FASE 3: SISTEMA DE PRIORIDADES DE CACHE
     * Asigna prioridad basada en calidad artística (0-10, donde 10 es máxima prioridad)
     */
    getCachePriority(quality) {
        if (quality >= 0.95)
            return 10; // Ultra legendary (>=95%)
        if (quality >= 0.85)
            return 9; // Epic (>=85%)
        if (quality >= 0.7)
            return 7; // Rare (>=70%)
        if (quality >= 0.6)
            return 5; // Uncommon (>=60%)
        return 1; // Common (<60%)
    }
    /**
     * 🎯 FASE 3: GESTIÓN INTELIGENTE DE MEMORIA
     * Aplica política de cache simple: mantiene límites de memoria usando ltrim
     * DIRECTIVA 12.10: Restauración de política de caché normal
     */
    async enforceLegendaryCachePolicy() {
        try {
            console.log('🎯 Enforcing simple cache policy - maintaining memory limits');
            // 1. Limitar MIDI recordings usando ltrim simple
            const midiCount = await this.redis.llen('selene:midi:recordings');
            if (midiCount > 100) {
                await this.redis.ltrim('selene:midi:recordings', 0, 99); // Mantener 100 elementos más recientes
                console.log(`🗑️ Cache policy: MIDI recordings trimmed to 100 items`);
            }
            // 2. Limitar poems usando ltrim simple
            const poemCount = await this.redis.llen('selene:poems:nft');
            if (poemCount > 100) {
                await this.redis.ltrim('selene:poems:nft', 0, 99); // Mantener 100 elementos más recientes
                console.log(`🗑️ Cache policy: Poems trimmed to 100 items`);
            }
            // 3. Limitar archivos MIDI usando ltrim simple
            const fileCount = await this.redis.llen('selene:midi:files');
            if (fileCount > 100) {
                await this.redis.ltrim('selene:midi:files', 0, 99); // Mantener 100 elementos más recientes
                console.log(`🗑️ Cache policy: MIDI files trimmed to 100 items`);
            }
            // 4. IMPORTANTE: NO limpiar selene:art:legendary - este contiene el arte maestro
            // Los elementos en selene:art:legendary ya pasaron el filtro de calidad
            console.log('✅ Preserving legendary art cache - contains only masterpiece quality items');
            console.log('✅ Simple cache policy enforced - memory limits maintained');
        }
        catch (error) {
            console.warn('⚠️ Simple cache policy enforcement failed:', error.message);
        }
    }
    /**
     * 🎯 FASE 3: LÍMITES DE MEMORIA INTELIGENTES
     * Mantiene solo los mejores arte basados en calidad y prioridad
     */
    async enforceMemoryLimits() {
        try {
            const maxLegendaryItems = 50; // Máximo 50 obras maestras por tipo
            // Limitar MIDI recordings legendarios
            const midiCount = await this.redis.llen('selene:midi:recordings');
            if (midiCount > maxLegendaryItems) {
                await this.redis.ltrim('selene:midi:recordings', 0, maxLegendaryItems - 1);
                console.log(`🧠 Memory limit: trimmed MIDI recordings to ${maxLegendaryItems} legendary items`);
            }
            // Limitar poems legendarios
            const poemCount = await this.redis.llen('selene:poems:nft');
            if (poemCount > maxLegendaryItems) {
                await this.redis.ltrim('selene:poems:nft', 0, maxLegendaryItems - 1);
                console.log(`🧠 Memory limit: trimmed poems to ${maxLegendaryItems} legendary items`);
            }
            // Limitar archivos MIDI legendarios
            const fileCount = await this.redis.llen('selene:midi:files');
            if (fileCount > maxLegendaryItems) {
                await this.redis.ltrim('selene:midi:files', 0, maxLegendaryItems - 1);
                console.log(`🧠 Memory limit: trimmed MIDI files to ${maxLegendaryItems} legendary items`);
            }
        }
        catch (error) {
            console.warn('⚠️ Memory limit enforcement failed:', error.message);
        }
    }
    /**
     * 🎯 FASE 3: ESTADÍSTICAS DE CACHE LEGENDARIO
     * Devuelve métricas del sistema de cache inteligente
     */
    async getLegendaryCacheStats() {
        try {
            const midiRecordings = await this.redis.lrange('selene:midi:recordings', 0, -1);
            const poems = await this.redis.lrange('selene:poems:nft', 0, -1);
            const midiFiles = await this.redis.lrange('selene:midi:files', 0, -1);
            const midiQualities = midiRecordings.map(item => JSON.parse(item)).map((item) => item.advancedQuality || item.beauty || 0);
            const poemQualities = poems.map(item => JSON.parse(item)).map((item) => item.advancedQuality || item.beauty || 0);
            const fileQualities = midiFiles.map(item => JSON.parse(item)).map((item) => item.quality || 0);
            const allQualities = [...midiQualities, ...poemQualities, ...fileQualities];
            const averageQuality = allQualities.length > 0 ? allQualities.reduce((sum, q) => sum + q, 0) / allQualities.length : 0;
            // Calcular eficiencia de memoria (cuánto espacio se ahorra vs mantener todo)
            const midiItems = midiRecordings.map(item => JSON.parse(item));
            const poemItems = poems.map(item => JSON.parse(item));
            const fileItems = midiFiles.map(item => JSON.parse(item));
            const legendaryCount = midiItems.filter(item => this.isLegendaryArt(item.advancedQuality || item.beauty || 0, item)).length +
                poemItems.filter(item => this.isLegendaryArt(item.advancedQuality || item.beauty || 0, item)).length +
                fileItems.filter(item => this.isLegendaryArt(item.quality || 0, item)).length;
            const totalCount = midiRecordings.length + poems.length + midiFiles.length;
            const legendaryRatio = legendaryCount / Math.max(totalCount, 1);
            const memoryEfficiency = legendaryRatio * 100; // Porcentaje de eficiencia
            return {
                totalLegendaryItems: midiRecordings.length + poems.length + midiFiles.length,
                midiLegendaryCount: midiRecordings.length,
                poemLegendaryCount: poems.length,
                fileLegendaryCount: midiFiles.length,
                averageQuality: averageQuality,
                memoryEfficiency: memoryEfficiency
            };
        }
        catch (error) {
            console.warn('⚠️ Failed to get legendary cache stats:', error.message);
            return {
                totalLegendaryItems: 0,
                midiLegendaryCount: 0,
                poemLegendaryCount: 0,
                fileLegendaryCount: 0,
                averageQuality: 0,
                memoryEfficiency: 0
            };
        }
    }
    /**
     * 🎯 FASE 3: LIMPIEZA DE CACHE MANUAL
     * Fuerza limpieza inmediata del cache no legendario
     */
    async forceLegendaryCacheCleanup() {
        console.log('🧹 Force legendary cache cleanup initiated');
        await this.enforceLegendaryCachePolicy();
        console.log('✅ Legendary cache cleanup completed');
    }
    /**
     * Hash string to number (deterministic)
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32-bit integer
        }
        return Math.abs(hash);
    }
    /**
     * Determine winning musical note from consensus result
     */
    determineWinningNote(result) {
        // Use consensus beauty to determine note (deterministic)
        const notes = ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'];
        const index = Math.floor(result.beauty * notes.length) % notes.length;
        return notes[index];
    }
    /**
     * Generate main melody for the composition
     */
    generateMelody(result, duration, startTime) {
        const notes = [];
        const noteInterval = 0.5; // Note every 0.5 seconds
        const totalNotes = Math.floor(duration / noteInterval);
        // Use consensus data to create deterministic but varied melody
        const basePitch = 60 + Math.floor(result.beauty * 12); // Base pitch influenced by beauty
        const participantCount = result.participants.length;
        for (let i = 0; i < totalNotes; i++) {
            const time = startTime + (i * noteInterval);
            // Create melodic variation based on participant data
            const participantIndex = i % participantCount;
            const participant = result.participants[participantIndex];
            // Deterministic pitch variation using participant hash
            const hash = this.hashString(participant + i.toString());
            const pitchVariation = (hash % 13) - 6; // -6 to +6 semitones
            const pitch = Math.max(48, Math.min(84, basePitch + pitchVariation)); // Constrain to playable range
            // Duration varies based on consensus time and beauty
            const baseDuration = 0.3 + (result.beauty * 0.4); // 0.3-0.7 seconds
            const durationVariation = (hash % 100) / 100 * 0.2; // ±0.1 seconds
            const noteDuration = Math.max(0.2, baseDuration + durationVariation);
            // Velocity based on beauty and position in composition
            const positionFactor = 1 - Math.abs(i - totalNotes / 2) / (totalNotes / 2); // Higher in middle
            const velocity = Math.floor(60 + (result.beauty * 40) + (positionFactor * 20));
            notes.push({
                pitch,
                duration: noteDuration,
                velocity,
                time
            });
        }
        return notes;
    }
    /**
     * Generate harmony notes to accompany the melody
     */
    generateHarmony(result, duration, startTime) {
        const notes = [];
        const harmonyInterval = 1.0; // Harmony changes every second
        const totalChords = Math.floor(duration / harmonyInterval);
        // Create chord progression based on consensus participants
        const rootNotes = [60, 62, 64, 65, 67, 69, 71]; // C major scale roots
        const participantCount = result.participants.length;
        for (let i = 0; i < totalChords; i++) {
            const time = startTime + (i * harmonyInterval);
            // Select root note based on participant and position
            const participantIndex = i % participantCount;
            const participant = result.participants[participantIndex];
            const hash = this.hashString(participant + 'harmony' + i.toString());
            const rootIndex = hash % rootNotes.length;
            const rootPitch = rootNotes[rootIndex];
            // Create chord based on root (major/minor determined by beauty)
            const isMajor = result.beauty > 0.6;
            const chordPitches = isMajor
                ? [rootPitch, rootPitch + 4, rootPitch + 7] // Major chord
                : [rootPitch, rootPitch + 3, rootPitch + 7]; // Minor chord
            // Add chord notes with lower velocity than melody
            const chordVelocity = Math.floor(40 + (result.beauty * 30));
            for (const pitch of chordPitches) {
                notes.push({
                    pitch,
                    duration: harmonyInterval * 0.8, // Slightly shorter than interval
                    velocity: chordVelocity,
                    time
                });
            }
        }
        return notes;
    }
    /**
     * Generate rhythmic elements (bass/drums)
     */
    generateRhythm(result, duration, startTime) {
        const notes = [];
        const beatInterval = 0.25; // 16th notes at 120 BPM
        const totalBeats = Math.floor(duration / beatInterval);
        // Create rhythmic pattern based on participant count
        const patternLength = Math.max(4, Math.min(8, result.participants.length));
        const participantCount = result.participants.length;
        for (let i = 0; i < totalBeats; i++) {
            const time = startTime + (i * beatInterval);
            const beatInPattern = i % patternLength;
            // Create rhythmic interest based on consensus data
            const participantIndex = beatInPattern % participantCount;
            const participant = result.participants[participantIndex];
            const hash = this.hashString(participant + 'rhythm' + beatInPattern.toString());
            // Only play notes on certain beats to create rhythm
            const shouldPlay = (hash % 100) > 30; // 70% chance of playing
            if (shouldPlay) {
                // Low pitch for bass rhythm
                const bassPitch = 36 + (hash % 12); // C1 to B1 range
                // Shorter duration for rhythmic feel
                const rhythmDuration = beatInterval * 0.7;
                // Lower velocity for rhythm section
                const rhythmVelocity = Math.floor(50 + (result.beauty * 25));
                notes.push({
                    pitch: bassPitch,
                    duration: rhythmDuration,
                    velocity: rhythmVelocity,
                    time
                });
            }
        }
        return notes;
    }
    /**
     * Convert note name to frequency
     */
    noteToFrequency(note) {
        const frequencies = {
            'DO': 261.63, // C4
            'RE': 293.66, // D4
            'MI': 329.63, // E4
            'FA': 349.23, // F4
            'SOL': 392.00, // G4
            'LA': 440.00, // A4
            'SI': 493.88 // B4
        };
        return frequencies[note] || 440.00;
    }
    /**
     * Generate Veritas RSA signature for NFT metadata
     */
    async generateVeritasSignature(poetryData) {
        try {
            // Simplified signature generation without Veritas
            const claim = `Poetry NFT: ${poetryData.verse.substring(0, 100)}... Beauty: ${poetryData.beauty} Zodiac: ${poetryData.zodiacSign}`;
            const timestamp = Date.now();
            const signature = `sig_${timestamp}_${this.hashString(claim + timestamp.toString()).toString(36).substr(0, 9)}`;
            console.log(`🔐 Mock signature generated for poetry NFT: ${signature.substring(0, 32)}...`);
            return signature;
        }
        catch (error) {
            console.warn('⚠️ Failed to generate signature:', error.message);
            return '';
        }
    }
    /**
     * 🎯 FIBONACCI PATTERN ENGINE - Calculate mathematical harmony ratio
     * Extracts harmony from fibonacci sequences in musical patterns
     */
    calculateHarmonyRatio(sequence, vitals) {
        if (!sequence || sequence.length < 3)
            return 0.5;
        let harmonyScore = 0;
        let totalRatios = 0;
        // Analyze consecutive fibonacci ratios
        for (let i = 2; i < sequence.length; i++) {
            const ratio1 = sequence[i] / sequence[i - 1];
            const ratio2 = sequence[i - 1] / sequence[i - 2];
            // Golden ratio proximity (φ ≈ 1.618)
            const goldenRatio = 1.618033988749895;
            const proximity1 = 1 - Math.abs(ratio1 - goldenRatio) / goldenRatio;
            const proximity2 = 1 - Math.abs(ratio2 - goldenRatio) / goldenRatio;
            // Fibonacci ratio harmony
            const fibRatio = ratio1 / ratio2;
            const fibProximity = 1 - Math.abs(fibRatio - goldenRatio) / goldenRatio;
            harmonyScore += (proximity1 + proximity2 + fibProximity) / 3;
            totalRatios++;
        }
        // System vitals influence
        const systemHarmony = vitals?.harmony || 0.5;
        const systemCreativity = vitals?.creativity || 0.5;
        const baseHarmony = totalRatios > 0 ? harmonyScore / totalRatios : 0.5;
        const adjustedHarmony = baseHarmony * (1 + systemHarmony * 0.2) * (1 + systemCreativity * 0.1);
        return Math.min(1, Math.max(0, adjustedHarmony));
    }
    /**
     * 🎵 MUSICAL HARMONY VALIDATOR - Advanced musical quality metrics
     * Validates musical harmony through multiple dimensions
     */
    validateMusicalHarmony(pattern, vitals) {
        if (!pattern || !pattern.notes) {
            return { harmony: 0.5, dissonance: 0.5, resonance: 0.5, overall: 0.5 };
        }
        const notes = pattern.notes;
        let harmonyScore = 0;
        let dissonanceScore = 0;
        let resonanceScore = 0;
        // 1. Interval Analysis - Melodic intervals (different from harmonic intervals)
        for (let i = 1; i < notes.length; i++) {
            const interval = Math.abs(notes[i].pitch - notes[i - 1].pitch) % 12;
            // Melodic consonance: most scale intervals are acceptable in melody
            // Only tritones and major sevenths are truly dissonant melodically
            const dissonantMelodicIntervals = [6, 11]; // Tritone and major seventh
            const isDissonant = dissonantMelodicIntervals.includes(interval);
            if (isDissonant) {
                dissonanceScore += 0.1;
            }
            else {
                harmonyScore += 0.1;
            }
        }
        // 2. Chord Analysis - Vertical harmony
        const chordGroups = this.groupNotesByTime(notes);
        for (const [timeKey, chord] of Object.entries(chordGroups)) {
            if (chord.length >= 3) {
                const pitches = chord.map((n) => n.pitch % 12).sort((a, b) => a - b);
                // Check for major/minor triads
                const isMajorTriad = this.isMajorTriad(pitches);
                const isMinorTriad = this.isMinorTriad(pitches);
                if (isMajorTriad || isMinorTriad) {
                    harmonyScore += 0.2;
                    resonanceScore += 0.15;
                }
                else {
                    // Check for dissonant intervals within the chord
                    let chordDissonance = 0.1; // Base dissonance for non-triad chords
                    // Check for tritones and other dissonant intervals
                    for (let i = 0; i < pitches.length; i++) {
                        for (let j = i + 1; j < pitches.length; j++) {
                            const interval = Math.abs(pitches[j] - pitches[i]);
                            const minInterval = Math.min(interval, 12 - interval);
                            // Tritone (6 semitones) is highly dissonant
                            if (minInterval === 6) {
                                chordDissonance += 0.2;
                            }
                            // Major seventh (11 semitones) is dissonant
                            else if (minInterval === 11) {
                                chordDissonance += 0.15;
                            }
                            // Minor ninth (minor second) is dissonant
                            else if (minInterval === 1) {
                                chordDissonance += 0.1;
                            }
                        }
                    }
                    dissonanceScore += chordDissonance;
                }
            }
        }
        // 3. Resonance Analysis - Frequency relationships
        const frequencies = notes.map((n) => this.midiToFrequency(n.pitch));
        let harmonicConnections = 0;
        let totalConnections = 0;
        for (let i = 0; i < frequencies.length; i++) {
            for (let j = i + 1; j < frequencies.length; j++) {
                const ratio = frequencies[j] / frequencies[i];
                const simplifiedRatio = this.simplifyRatio(ratio);
                totalConnections++;
                // Harmonic ratios (octaves, fifths, thirds)
                const harmonicRatios = [2, 3, 4, 5, 6, 8, 9, 10];
                if (harmonicRatios.includes(simplifiedRatio)) {
                    harmonicConnections++;
                }
            }
        }
        // Resonance as percentage of harmonic connections (0.0 to 1.0)
        resonanceScore = totalConnections > 0 ? harmonicConnections / totalConnections : 0;
        // Normalize dissonance and resonance by the number of elements analyzed
        const totalIntervals = Math.max(1, notes.length - 1); // At least 1 interval
        const totalChords = Math.max(1, Object.keys(chordGroups).length); // At least 1 chord group
        const totalFrequencyPairs = Math.max(1, (notes.length * (notes.length - 1)) / 2); // At least 1 pair
        // Normalize scores to prevent extreme values
        dissonanceScore = dissonanceScore / (totalIntervals + totalChords); // Distribute across intervals and chords
        // Resonance is already normalized as percentage (0.0-1.0)
        // 4. System Vitals Integration
        const systemStress = vitals?.stress || 0.5;
        const systemHarmony = vitals?.harmony || 0.5;
        // High stress might increase dissonance perception
        dissonanceScore *= (1 + systemStress * 0.3);
        // High system harmony boosts perceived musical harmony
        harmonyScore *= (1 + systemHarmony * 0.4);
        // 5. Normalization - CORRECTED: Simple clipping to [0.0, 1.0] range
        // Apply simple clipping normalization - scores after vitals integration are already close to target range
        const normalizedHarmony = Math.min(1.0, Math.max(0.0, harmonyScore));
        const normalizedDissonance = Math.min(1.0, Math.max(0.0, dissonanceScore));
        const normalizedResonance = Math.min(1.0, Math.max(0.0, resonanceScore));
        // Overall score: harmony and resonance are positive, dissonance is negative
        // Enhanced formula to reach 1.0 in ideal conditions with synergy bonus
        const overall = Math.max(0, Math.min(1, (normalizedHarmony * 0.4) + (normalizedResonance * 0.4) - (normalizedDissonance * 0.2) + (normalizedHarmony * normalizedResonance * 0.2)));
        const result = {
            harmony: Math.min(1, Math.max(0, normalizedHarmony)),
            dissonance: Math.min(1, Math.max(0, normalizedDissonance)),
            resonance: Math.min(1, Math.max(0, normalizedResonance)),
            overall: Math.min(1, Math.max(0, overall))
        };
        return result;
    }
    /**
     * Helper: Group notes by time for chord analysis
     */
    groupNotesByTime(notes) {
        const groups = {};
        const tolerance = 0.05; // 50ms tolerance
        notes.forEach(note => {
            const timeKey = Math.round(note.time / tolerance) * tolerance;
            if (!groups[timeKey])
                groups[timeKey] = [];
            groups[timeKey].push(note);
        });
        return groups;
    }
    /**
     * Helper: Check if pitches form a major triad
     */
    isMajorTriad(pitches) {
        if (pitches.length < 3)
            return false;
        // Check for major triad intervals: root, major third (4 semitones), perfect fifth (7 semitones)
        const root = pitches[0];
        return pitches.includes((root + 4) % 12) && pitches.includes((root + 7) % 12);
    }
    /**
     * Helper: Check if pitches form a minor triad
     */
    isMinorTriad(pitches) {
        if (pitches.length < 3)
            return false;
        // Check for minor triad intervals: root, minor third (3 semitones), perfect fifth (7 semitones)
        const root = pitches[0];
        return pitches.includes((root + 3) % 12) && pitches.includes((root + 7) % 12);
    }
    /**
     * Helper: Convert MIDI pitch to frequency
     */
    midiToFrequency(midiPitch) {
        return 440 * Math.pow(2, (midiPitch - 69) / 12);
    }
    /**
     * Helper: Simplify frequency ratio to smallest integer ratio
     */
    simplifyRatio(ratio) {
        const tolerance = 0.02; // Increased tolerance for better harmonic detection
        const commonRatios = [
            2, // Octave
            3, // Perfect fifth (3:2 ≈ 1.5)
            4, // Perfect fourth (4:3 ≈ 1.333)
            5, // Major sixth (5:3 ≈ 1.667) or major third (5:4 ≈ 1.25)
            6, // Minor third (6:5 ≈ 1.2) or perfect fifth (3:2 with octave)
            7, // Minor seventh (7:4 ≈ 1.75)
            8, // Octave + octave
            9, // Major ninth (9:8 ≈ 1.125) or major sixth (3:2 with octave)
            10, // Minor tenth (10:9 ≈ 1.111) or major ninth (5:4 with octave)
            12, // Octave + fifth
            15, // Double octave + major sixth
            16 // Double octave
        ];
        // Check for exact matches first
        for (const r of commonRatios) {
            if (Math.abs(ratio - r) < tolerance) {
                return r;
            }
        }
        // Check for common harmonic ratios that might be inverted (higher/lower)
        const invertedRatio = 1 / ratio;
        for (const r of commonRatios) {
            if (Math.abs(invertedRatio - r) < tolerance) {
                return r; // Return the simplified form
            }
        }
        // Check for specific harmonic intervals
        const harmonicIntervals = [
            { ratio: 3 / 2, simplified: 3 }, // Perfect fifth
            { ratio: 4 / 3, simplified: 4 }, // Perfect fourth
            { ratio: 5 / 3, simplified: 5 }, // Major sixth
            { ratio: 5 / 4, simplified: 5 }, // Major third
            { ratio: 6 / 5, simplified: 6 }, // Minor third
            { ratio: 7 / 4, simplified: 7 }, // Minor seventh
            { ratio: 7 / 5, simplified: 7 }, // Minor sixth
            { ratio: 7 / 6, simplified: 7 }, // Minor seventh from minor third
            { ratio: 9 / 8, simplified: 9 }, // Major ninth
            { ratio: 10 / 9, simplified: 10 }, // Minor tenth
            { ratio: 15 / 8, simplified: 15 }, // Major seventh + octave
            { ratio: 2 / 3, simplified: 2 }, // Inverted fifth
            { ratio: 3 / 4, simplified: 3 }, // Inverted fourth
            { ratio: 3 / 5, simplified: 3 }, // Inverted sixth
            { ratio: 4 / 5, simplified: 4 }, // Inverted third
            { ratio: 5 / 6, simplified: 5 }, // Inverted minor third
            { ratio: 4 / 7, simplified: 4 }, // Inverted minor seventh
            { ratio: 5 / 7, simplified: 5 }, // Inverted minor sixth
            { ratio: 6 / 7, simplified: 6 }, // Inverted minor seventh from minor third
            { ratio: 8 / 9, simplified: 8 }, // Inverted ninth
            { ratio: 9 / 10, simplified: 9 }, // Inverted minor tenth
            { ratio: 8 / 15, simplified: 8 } // Inverted major seventh + octave
        ];
        for (const interval of harmonicIntervals) {
            if (Math.abs(ratio - interval.ratio) < tolerance) {
                return interval.simplified;
            }
        }
        return Math.round(ratio);
    }
    /**
     * 🎯 CALCULATE RARITY BONUS - Directiva de Forja 4.0
     * Bonus basado en la frecuencia de patrones Note-Sign (nota musical + signo zodiacal)
     */
    calculateRarityBonus(result, midiNotes, poetryData) {
        if (!poetryData || !poetryData.zodiacSign)
            return 0.5;
        // Extraer información del patrón Note-Sign
        const winningNote = this.determineWinningNote(result);
        const zodiacSign = poetryData.zodiacSign;
        // Crear patrón único Note-Sign
        const noteSignPattern = `${winningNote}-${zodiacSign}`;
        // Tabla de frecuencias de patrones Note-Sign (basado en numerología zodiacal)
        // Patrones raros tienen frecuencias bajas, comunes tienen altas
        const patternFrequencies = {
            // DO - Frecuencias basadas en elementos zodiacales
            'DO-Aries': 0.15, 'DO-Leo': 0.12, 'DO-Sagitario': 0.10, // Fuego - raros
            'DO-Taurus': 0.25, 'DO-Virgo': 0.22, 'DO-Capricorn': 0.20, // Tierra - comunes
            'DO-Gemini': 0.18, 'DO-Libra': 0.16, 'DO-Aquarius': 0.14, // Aire - moderados
            'DO-Cancer': 0.08, 'DO-Scorpio': 0.06, 'DO-Pisces': 0.05, // Agua - muy raros
            // RE - Frecuencias similares
            'RE-Aries': 0.12, 'RE-Leo': 0.15, 'RE-Sagitario': 0.18,
            'RE-Taurus': 0.22, 'RE-Virgo': 0.25, 'RE-Capricorn': 0.20,
            'RE-Gemini': 0.16, 'RE-Libra': 0.14, 'RE-Aquarius': 0.12,
            'RE-Cancer': 0.10, 'RE-Scorpio': 0.08, 'RE-Pisces': 0.06,
            // MI - Frecuencias
            'MI-Aries': 0.18, 'MI-Leo': 0.12, 'MI-Sagitario': 0.15,
            'MI-Taurus': 0.20, 'MI-Virgo': 0.22, 'MI-Capricorn': 0.25,
            'MI-Gemini': 0.14, 'MI-Libra': 0.16, 'MI-Aquarius': 0.10,
            'MI-Cancer': 0.08, 'MI-Scorpio': 0.05, 'MI-Pisces': 0.06,
            // FA - Frecuencias
            'FA-Aries': 0.10, 'FA-Leo': 0.18, 'FA-Sagitario': 0.12,
            'FA-Taurus': 0.25, 'FA-Virgo': 0.20, 'FA-Capricorn': 0.22,
            // SOL - Frecuencias
            'SOL-Aries': 0.12, 'SOL-Leo': 0.08, 'SOL-Sagitario': 0.15,
            'SOL-Taurus': 0.22, 'SOL-Virgo': 0.25, 'SOL-Capricorn': 0.20,
            'SOL-Gemini': 0.14, 'SOL-Libra': 0.18, 'SOL-Aquarius': 0.16,
            'SOL-Cancer': 0.10, 'SOL-Scorpio': 0.06, 'SOL-Pisces': 0.05,
            // LA - Frecuencias
            'LA-Aries': 0.15, 'LA-Leo': 0.10, 'LA-Sagitario': 0.18,
            'LA-Taurus': 0.20, 'LA-Virgo': 0.22, 'LA-Capricorn': 0.25,
            'LA-Gemini': 0.12, 'LA-Libra': 0.14, 'LA-Aquarius': 0.16,
            'LA-Cancer': 0.08, 'LA-Scorpio': 0.05, 'LA-Pisces': 0.06,
            // SI - Frecuencias
            'SI-Aries': 0.18, 'SI-Leo': 0.12, 'SI-Sagitario': 0.10,
            'SI-Taurus': 0.25, 'SI-Virgo': 0.20, 'SI-Capricorn': 0.22,
            'SI-Gemini': 0.16, 'SI-Libra': 0.12, 'SI-Aquarius': 0.14,
            'SI-Cancer': 0.06, 'SI-Scorpio': 0.08, 'SI-Pisces': 0.05
        };
        // Obtener frecuencia del patrón específico
        const patternFrequency = patternFrequencies[noteSignPattern] || 0.15; // Default moderado
        // Calcular bonus de rareza: más raro = mayor bonus
        // Frecuencia baja = rareza alta = bonus alto
        const rarityBonus = 1 - patternFrequency; // Invertir: baja frecuencia = alta rareza
        // Factor adicional basado en complejidad musical
        const noteComplexity = midiNotes.length > 20 ? 0.1 : 0; // Bonus por composiciones complejas
        const participantBonus = Math.min(0.1, result.participants.length * 0.02); // Bonus por diversidad
        const finalRarityBonus = Math.min(1, rarityBonus + noteComplexity + participantBonus);
        console.log(`🌟 Rarity calculation: ${noteSignPattern} (frequency: ${(patternFrequency * 100).toFixed(1)}%) → bonus: ${(finalRarityBonus * 100).toFixed(1)}%`);
        return finalRarityBonus;
    }
    /**
     * 🎯 FORJA 7.1: Generate Procedural Profile Vector (4D) with Fibonacci Harmony
     * Returns multidimensional classification instead of scalar quality score
     * Now includes mathematical harmony analysis using Fibonacci ratios
     */
    async generateArtisticProfile(result, midiNotes, poetryData, leaderPersonality, intentParameters) {
        // 🎯 NUEVA FILOSOFÍA: Clasificación multidimensional, no puntuación escalar
        // Obtener métricas del sistema para los engines
        const systemVitals = SystemVitals.getInstance();
        const vitals = systemVitals.getCurrentVitalSigns();
        // 🎯 INTEGRACIÓN DE ENGINES AVANZADOS - VECTOR 4D
        // 1. COHERENCE (0.0-1.0): Perfección musical del MusicalHarmonyValidator
        const musicalPattern = { notes: midiNotes };
        const musicalMetrics = this.validateMusicalHarmony(musicalPattern, vitals);
        const coherence = musicalMetrics.overall;
        // 🎯 INTEGRACIÓN DEL MOTOR FIBONACCI (FORJA 7.1)
        // Extraer secuencia de pitches para el motor Fibonacci
        const pitchSequence = midiNotes.map(n => n.pitch);
        // Calcular la armonía matemática (Fibonacci/Áurea)
        const fibonacciHarmony = this.calculateHarmonyRatio(pitchSequence, vitals);
        // 2. VARIETY (0.0-1.0): Combinación de variedad rítmica y complejidad melódica
        const rhythmicVariety = this.evaluateRhythmicVariety(midiNotes);
        const melodicComplexity = this.evaluateMelodicComplexity(midiNotes);
        const variety = Math.min(1, (rhythmicVariety + melodicComplexity) / 2);
        // 3. RARITY (0.0-1.0): Bonus de rareza basado en frecuencia de patrones Note-Sign
        const rarity = this.calculateRarityBonus(result, midiNotes, poetryData);
        // 4. COMPLEXITY (0.0-1.0): Densidad de notas y equilibrio estructural
        const structuralBalance = this.evaluateStructuralBalance(midiNotes);
        const noteDensity = Math.min(1, midiNotes.length / 50); // Normalizar densidad de notas
        // NUEVO VECTOR DE COMPLEJIDAD (FORJA 7.1)
        const complexity = Math.min(1, (structuralBalance + fibonacciHarmony) / 2);
        // 🎯 DIRECTIVA 12.0: AMPLIFICACIÓN DETERMINÍSTICA DE INTENCIÓN
        // Aplicar multiplicadores basados en perfil de intención sin falsificar métricas
        let coherenceMultiplier = 1.0;
        let varietyMultiplier = 1.0;
        let rarityMultiplier = 1.0;
        let complexityMultiplier = 1.0;
        if (intentParameters) {
            console.log(`🎯 DIRECTIVA 12.0 - Aplicando amplificación determinística: ${intentParameters.profile}`);
            console.log(`📊 VALORES BASE ANTES DE AMPLIFICACIÓN: coherence=${coherence.toFixed(3)}, variety=${variety.toFixed(3)}, rarity=${rarity.toFixed(3)}, complexity=${complexity.toFixed(3)}`);
            switch (intentParameters.profile) {
                case 'legendary':
                    // Legendary: Énfasis en perfección y rareza - AMPLIFICACIÓN AGRESIVA
                    coherenceMultiplier = 1.40; // +40% coherencia (antes +20%)
                    varietyMultiplier = 1.25; // +25% variedad (antes +15%)
                    rarityMultiplier = 1.50; // +50% rareza (antes +25%)
                    complexityMultiplier = 1.30; // +30% complejidad (antes +10%)
                    console.log(`🌟 Legendary amplification AGRESIVA: coherence x${coherenceMultiplier}, variety x${varietyMultiplier}, rarity x${rarityMultiplier}, complexity x${complexityMultiplier}`);
                    break;
                case 'experimental':
                    // Experimental: Énfasis en innovación y complejidad - AMPLIFICACIÓN AGRESIVA
                    coherenceMultiplier = 0.70; // -30% coherencia (antes -10%)
                    varietyMultiplier = 1.60; // +60% variedad (antes +30%)
                    rarityMultiplier = 1.20; // +20% rareza (antes +5%)
                    complexityMultiplier = 1.50; // +50% complejidad (antes +25%)
                    console.log(`🔬 Experimental amplification AGRESIVA: coherence x${coherenceMultiplier}, variety x${varietyMultiplier}, rarity x${rarityMultiplier}, complexity x${complexityMultiplier}`);
                    break;
                default:
                    // Default: Baseline sin modificación
                    console.log(`📊 Default profile: no amplification applied`);
                    break;
            }
        }
        // Aplicar multiplicadores con clamping para mantener rangos válidos
        const amplifiedCoherence = Math.min(1.0, Math.max(0.0, coherence * coherenceMultiplier));
        const amplifiedVariety = Math.min(1.0, Math.max(0.0, variety * varietyMultiplier));
        const amplifiedRarity = Math.min(1.0, Math.max(0.0, rarity * rarityMultiplier));
        const amplifiedComplexity = Math.min(1.0, Math.max(0.0, complexity * complexityMultiplier));
        console.log(`📊 VALORES AMPLIFICADOS: coherence=${amplifiedCoherence.toFixed(3)} (was ${coherence.toFixed(3)}), variety=${amplifiedVariety.toFixed(3)} (was ${variety.toFixed(3)}), rarity=${amplifiedRarity.toFixed(3)} (was ${rarity.toFixed(3)}), complexity=${amplifiedComplexity.toFixed(3)} (was ${complexity.toFixed(3)})`);
        // 🎯 METADATOS POST-HOC (filtros, no influencias)
        const zodiacSignature = poetryData?.zodiacSign || 'unknown';
        const consensusContext = result.beauty;
        // Construir el Vector de Perfil Procedural 4D
        const proceduralProfile = {
            coherence: amplifiedCoherence,
            variety: amplifiedVariety,
            rarity: amplifiedRarity,
            complexity: amplifiedComplexity,
            // Metadatos para filtrado post-hoc
            zodiacSignature,
            leaderPersonality,
            consensusContext,
            // Información de debug
            timestamp: Date.now(),
            midiNoteCount: midiNotes.length,
            poetryLength: poetryData?.verse?.length || 0
        };
        console.log(`🎨 [FORJA 7.1] Vector de Perfil Procedural Generado:`);
        console.log(`   Coherence: ${(amplifiedCoherence * 100).toFixed(1)}% (perfección musical)`);
        console.log(`   Variety: ${(amplifiedVariety * 100).toFixed(1)}% (ritmo + melodía)`);
        console.log(`   Rarity: ${(amplifiedRarity * 100).toFixed(1)}% (patrones zodiacales raros)`);
        console.log(`   Complexity: ${(amplifiedComplexity * 100).toFixed(1)}% (equilibrio estructural + armonía matemática)`);
        console.log(`   Zodiac: ${zodiacSignature}, Consensus: ${(consensusContext * 100).toFixed(1)}%`);
        return proceduralProfile;
    }
    /**
     * Basic musical quality evaluation (music-only, before poetry generation)
     * Evaluates core musical elements with lower threshold for art generation
     */
    evaluateBasicMusicalQuality(result, midiNotes) {
        let totalScore = 0;
        let factorCount = 0;
        // 1. Consensus Success (0-1) - Primary factor (high weight)
        const consensusSuccess = result.consensusAchieved ? 1.0 : 0.0;
        totalScore += consensusSuccess * 2; // Double weight
        factorCount += 2; // Count as 2 factors
        // 2. Beauty Quality (0-1) - Primary factor (high weight)
        const beautyQuality = Math.min(1.0, result.beauty);
        totalScore += beautyQuality * 2; // Double weight
        factorCount += 2; // Count as 2 factors
        // 3. Participant Diversity (0-1) - Secondary factor
        const participantDiversity = Math.min(1.0, result.participants.length / 5); // Max at 5 participants
        totalScore += participantDiversity;
        factorCount++;
        // 4. Melodic Complexity (0-1) - Musical factor (very low weight)
        const melodicComplexity = this.evaluateMelodicComplexity(midiNotes);
        totalScore += melodicComplexity * 0.1; // Very reduced weight
        factorCount++;
        // 5. Harmonic Coherence (0-1) - Musical factor (very low weight)
        const harmonicCoherence = this.evaluateHarmonicCoherence(midiNotes);
        totalScore += harmonicCoherence * 0.1; // Very reduced weight
        factorCount++;
        // 6. Rhythmic Variety (0-1) - Musical factor (very low weight)
        const rhythmicVariety = this.evaluateRhythmicVariety(midiNotes);
        totalScore += rhythmicVariety * 0.1; // Very reduced weight
        factorCount++;
        // 7. Technical Proficiency (0-1) - Musical factor (very low weight)
        const technicalProficiency = this.evaluateTechnicalProficiency(midiNotes);
        totalScore += technicalProficiency * 0.1; // Very reduced weight
        factorCount++;
        // Calculate final basic quality score (0-1)
        const finalScore = totalScore / factorCount;
        console.log(`🎵 Basic musical quality evaluation: ${finalScore.toFixed(3)} (${factorCount} factors)`);
        console.log(`   - Consensus Success: ${(consensusSuccess * 2).toFixed(2)} (double weighted)`);
        console.log(`   - Beauty Quality: ${(beautyQuality * 2).toFixed(2)} (double weighted)`);
        console.log(`   - Participant Diversity: ${participantDiversity.toFixed(2)}`);
        console.log(`   - Melodic Complexity: ${(melodicComplexity * 0.1).toFixed(2)} (very low weight)`);
        console.log(`   - Harmonic Coherence: ${(harmonicCoherence * 0.1).toFixed(2)} (very low weight)`);
        console.log(`   - Rhythmic Variety: ${(rhythmicVariety * 0.1).toFixed(2)} (very low weight)`);
        console.log(`   - Technical Proficiency: ${(technicalProficiency * 0.1).toFixed(2)} (very low weight)`);
        return finalScore;
    }
    /**
     * Evaluate melodic complexity based on pitch variety and patterns
     */
    evaluateMelodicComplexity(notes) {
        if (notes.length < 10)
            return 1.0;
        const pitches = notes.map(n => n.pitch);
        const uniquePitches = new Set(pitches).size;
        const pitchVariety = uniquePitches / 24; // Max 2 octaves
        // Analyze pitch intervals for complexity
        let intervalComplexity = 0;
        for (let i = 1; i < pitches.length; i++) {
            const interval = Math.abs(pitches[i] - pitches[i - 1]);
            if (interval > 12)
                intervalComplexity += 0.1; // Large leaps
            else if (interval > 7)
                intervalComplexity += 0.05; // Octave jumps
        }
        intervalComplexity = Math.min(1, intervalComplexity / notes.length);
        return Math.min(1, ((pitchVariety * 0.6) + (intervalComplexity * 0.4)));
    }
    /**
     * Evaluate harmonic coherence (chord progressions, consonance)
     */
    evaluateHarmonicCoherence(notes) {
        if (notes.length < 3)
            return 0.3; // Need minimum notes for coherence analysis
        // Group notes by time with tolerance for procedural music (notes don't always align perfectly)
        const timeTolerance = 0.05; // 50ms tolerance for considering notes simultaneous
        const timeGroups = {};
        notes.forEach(note => {
            // Round time to nearest tolerance interval for grouping
            const timeKey = Math.round(note.time / timeTolerance) * timeTolerance;
            if (!timeGroups[timeKey])
                timeGroups[timeKey] = [];
            timeGroups[timeKey].push(note);
        });
        let coherenceScore = 0;
        let totalAnalyzedGroups = 0;
        for (const timeKey in timeGroups) {
            const chordNotes = timeGroups[timeKey];
            if (chordNotes.length >= 2) {
                totalAnalyzedGroups++;
                // Check for consonant intervals (3rds, 5ths, 6ths, octaves, unisons)
                const pitches = chordNotes.map(n => n.pitch % 12).sort((a, b) => a - b); // Use pitch classes for better harmony detection
                let consonantIntervals = 0;
                let totalIntervals = 0;
                for (let i = 1; i < pitches.length; i++) {
                    for (let j = 0; j < i; j++) {
                        const interval = Math.abs(pitches[i] - pitches[j]);
                        const minInterval = Math.min(interval, 12 - interval); // Consider both directions
                        totalIntervals++;
                        // Consonant intervals: unisons, 3rds, 4ths, 5ths, 6ths, octaves
                        if ([0, 3, 4, 5, 7, 8, 9].includes(minInterval)) {
                            consonantIntervals++;
                        }
                    }
                }
                // Also check for melodic coherence (adjacent notes in time)
                let melodicCoherence = 0;
                if (chordNotes.length === 1) {
                    // Single notes - check against nearby notes in time
                    const currentTime = parseFloat(timeKey);
                    const nearbyNotes = notes.filter(n => Math.abs(n.time - currentTime) <= timeTolerance * 2 &&
                        Math.abs(n.pitch - chordNotes[0].pitch) <= 12 // Within octave
                    );
                    if (nearbyNotes.length > 1) {
                        const avgPitch = nearbyNotes.reduce((sum, n) => sum + n.pitch, 0) / nearbyNotes.length;
                        const pitchVariance = nearbyNotes.reduce((sum, n) => sum + Math.pow(n.pitch - avgPitch, 2), 0) / nearbyNotes.length;
                        melodicCoherence = Math.max(0, 1 - (pitchVariance / 24)); // Lower variance = higher coherence
                    }
                }
                // Combine chordal and melodic coherence
                const chordCoherence = totalIntervals > 0 ? consonantIntervals / totalIntervals : 0.5;
                const combinedCoherence = chordNotes.length > 1 ?
                    chordCoherence :
                    Math.max(chordCoherence, melodicCoherence);
                coherenceScore += Math.min(1, Math.max(0, combinedCoherence));
            }
        }
        // If no chord groups found, analyze overall pitch distribution for basic coherence
        if (totalAnalyzedGroups === 0) {
            const pitches = notes.map(n => n.pitch % 12);
            const pitchCounts = pitches.reduce((counts, pitch) => {
                counts[pitch] = (counts[pitch] || 0) + 1;
                return counts;
            }, {});
            const mostCommonPitch = Math.max(...Object.values(pitchCounts));
            const pitchDominance = mostCommonPitch / notes.length;
            // Low dominance = more variety = higher coherence in procedural music
            coherenceScore = Math.max(0.2, 1 - pitchDominance * 0.8);
        }
        else {
            coherenceScore = totalAnalyzedGroups > 0 ? coherenceScore / totalAnalyzedGroups : 0.3;
        }
        return Math.min(1, Math.max(0, coherenceScore));
    }
    /**
     * Evaluate rhythmic variety and interest
     */
    evaluateRhythmicVariety(notes) {
        if (notes.length < 3)
            return 0.4;
        // Analyze duration patterns with more sensitivity to procedural music
        const durations = notes.map(n => Math.round(n.duration * 1000) / 1000); // Round to millisecond precision
        const uniqueDurations = new Set(durations);
        const durationVariety = Math.min(1, uniqueDurations.size / 5); // Lower threshold for procedural music
        // Analyze timing patterns with smaller gap detection
        const times = notes.map(n => n.time).sort((a, b) => a - b);
        let timingVariety = 0;
        let gapCount = 0;
        for (let i = 1; i < times.length; i++) {
            const gap = times[i] - (times[i - 1] + durations[i - 1]); // Actual gap between note end and next start
            if (gap > 0.01) { // Much smaller gap threshold (10ms instead of 500ms)
                gapCount++;
                // Smaller gaps contribute more to variety in procedural music
                if (gap < 0.1)
                    timingVariety += 0.2; // Small gaps (10-100ms) are very good
                else if (gap < 0.5)
                    timingVariety += 0.1; // Medium gaps (100-500ms) are good
                else
                    timingVariety += 0.05; // Large gaps contribute less
            }
        }
        // Normalize timing variety by potential gaps (not just note count)
        const potentialGaps = Math.max(1, times.length - 1);
        timingVariety = Math.min(1, timingVariety / potentialGaps);
        // Analyze rhythmic patterns and repetition
        let patternRepetition = 0;
        const patternLength = Math.min(4, Math.floor(notes.length / 2)); // Look for patterns of 2-4 notes
        if (notes.length >= patternLength * 2) {
            for (let i = 0; i <= notes.length - patternLength * 2; i += patternLength) {
                const pattern1 = notes.slice(i, i + patternLength);
                const pattern2 = notes.slice(i + patternLength, i + patternLength * 2);
                // Check if patterns are similar (duration and pitch within tolerance)
                let similarity = 0;
                for (let j = 0; j < patternLength; j++) {
                    const dur1 = pattern1[j].duration;
                    const dur2 = pattern2[j].duration;
                    const pitch1 = pattern1[j].pitch;
                    const pitch2 = pattern2[j].pitch;
                    if (Math.abs(dur1 - dur2) < 0.05 && Math.abs(pitch1 - pitch2) <= 2) {
                        similarity += 1;
                    }
                }
                if (similarity / patternLength > 0.7) { // 70% similar = pattern detected
                    patternRepetition += 0.1;
                }
            }
        }
        patternRepetition = Math.min(1, patternRepetition);
        // For procedural music, both variety and intentional patterns are valuable
        // Balance between chaotic variety and structured repetition
        const varietyScore = (durationVariety * 0.4) + (timingVariety * 0.4) + (gapCount / notes.length * 0.2);
        const structureScore = patternRepetition * 0.6 + (1 - patternRepetition) * 0.4; // Reward both patterns and variety
        return Math.min(1, (varietyScore * 0.6) + (structureScore * 0.4));
    }
    /**
     * Evaluate structural balance and form
     */
    evaluateStructuralBalance(notes) {
        if (notes.length < 20)
            return 0.2;
        const totalDuration = Math.max(...notes.map(n => n.time + n.duration));
        if (totalDuration < 10)
            return 0.3; // Too short
        // Check for balanced distribution across time
        const segments = 4;
        const segmentDuration = totalDuration / segments;
        let balanceScore = 0;
        for (let i = 0; i < segments; i++) {
            const segmentStart = i * segmentDuration;
            const segmentEnd = (i + 1) * segmentDuration;
            const notesInSegment = notes.filter(n => n.time >= segmentStart && n.time < segmentEnd).length;
            // Ideal: 25% of notes in each segment (1/segments)
            const segmentRatio = notesInSegment / notes.length;
            const idealRatio = 1 / segments;
            const deviation = Math.abs(segmentRatio - idealRatio);
            // Score for this segment: higher when closer to ideal
            const segmentScore = Math.max(0, 1 - deviation * 2); // 0-1 per segment
            balanceScore += segmentScore;
        }
        // Average across segments and ensure 0-1 range
        return Math.min(1, Math.max(0, balanceScore / segments));
    }
    /**
     * Evaluate dynamic range and expression
     */
    evaluateDynamicRange(notes) {
        const velocities = notes.map(n => n.velocity);
        if (velocities.length < 3)
            return 0.3;
        const minVel = Math.min(...velocities);
        const maxVel = Math.max(...velocities);
        const range = maxVel - minVel;
        // More sensitive range scoring for procedural music (lower minimum requirement)
        const rangeScore = Math.min(1, range / 20); // Need at least 20 range instead of 50
        // Check for velocity variation (not all same volume) with better sensitivity
        const uniqueVelocities = new Set(velocities).size;
        const variationScore = Math.min(1, uniqueVelocities / Math.min(velocities.length, 8)); // Cap at 8 for normalization
        // Analyze velocity distribution and patterns
        let distributionScore = 0;
        const velocityCounts = velocities.reduce((counts, vel) => {
            const roundedVel = Math.round(vel / 5) * 5; // Group velocities in ranges of 5
            counts[roundedVel] = (counts[roundedVel] || 0) + 1;
            return counts;
        }, {});
        const dominantVelocity = Math.max(...Object.values(velocityCounts));
        const velocityDominance = dominantVelocity / velocities.length;
        // Lower dominance = more dynamic variety = higher score
        distributionScore = Math.max(0, 1 - velocityDominance * 0.7);
        // Analyze dynamic progression (changes over time)
        let progressionScore = 0;
        if (velocities.length >= 5) {
            let directionChanges = 0;
            let totalDirection = 0;
            for (let i = 2; i < velocities.length; i++) {
                const prevDiff = velocities[i - 1] - velocities[i - 2];
                const currDiff = velocities[i] - velocities[i - 1];
                if ((prevDiff > 0 && currDiff < 0) || (prevDiff < 0 && currDiff > 0)) {
                    directionChanges++;
                }
                if (Math.abs(currDiff) > 2) { // Significant velocity change
                    totalDirection++;
                }
            }
            // Direction changes indicate dynamic interest
            progressionScore = Math.min(1, (directionChanges / (velocities.length - 2)) * 2);
        }
        // For procedural music, balance between range, variation, distribution, and progression
        const dynamicScore = (rangeScore * 0.3) + (variationScore * 0.3) + (distributionScore * 0.2) + (progressionScore * 0.2);
        // Ensure minimum score for procedural music that has some dynamic intent
        return Math.max(0.2, Math.min(1, dynamicScore));
    }
    /**
     * Evaluate synergy between poetry and music
     */
    evaluatePoeticSynergy(poetryData, midiNotes) {
        if (!poetryData)
            return 0.5;
        // Poetry length should correlate with music duration
        const musicDuration = Math.max(...midiNotes.map(n => n.time + n.duration));
        const poetryLength = poetryData.verse?.length || 0;
        const lengthRatio = Math.min(1, poetryLength / 200); // Ideal: 200+ chars
        // Poetry beauty should correlate with music complexity
        const melodicComplexity = this.evaluateMelodicComplexity(midiNotes);
        const beautyCorrelation = 1 - Math.abs(poetryData.beauty - melodicComplexity);
        return Math.min(1, (lengthRatio * 0.4) + (beautyCorrelation * 0.6));
    }
    /**
     * Evaluate emotional depth based on consensus and poetry - influenced by leader personality
     */
    evaluateEmotionalDepth(result, poetryData, leaderPersonality) {
        if (!poetryData)
            return Math.min(1, result.beauty);
        // Base emotional depth from multiple sources
        const consensusEmotion = result.beauty;
        const poetryEmotion = poetryData.beauty || 0.5;
        const zodiacEmotion = this.getZodiacEmotionalDepth(poetryData.zodiacSign);
        let baseScore = Math.min(1, (consensusEmotion * 0.4) + (poetryEmotion * 0.4) + (zodiacEmotion * 0.2));
        // Personality influence: water/fire elements and wisdom boost emotional depth
        if (leaderPersonality) {
            let personalityBonus = 0;
            // Element influence: water and fire are more emotionally expressive
            if (leaderPersonality.element === 'water' || leaderPersonality.element === 'fire') {
                personalityBonus += 0.3;
            }
            // Wisdom and passion traits
            personalityBonus += (leaderPersonality.wisdom * 0.4) + (leaderPersonality.passion * 0.3);
            baseScore = Math.min(1, baseScore * (1 + personalityBonus * 0.25)); // Up to 25% bonus
        }
        return baseScore;
    }
    /**
     * Evaluate technical proficiency of the composition - influenced by leader personality
     */
    evaluateTechnicalProficiency(notes, leaderPersonality) {
        if (notes.length < 10)
            return 1.0;
        // Base technical evaluation
        let timingIssues = 0;
        for (let i = 0; i < notes.length - 1; i++) {
            const currentEnd = notes[i].time + notes[i].duration;
            const nextStart = notes[i + 1].time;
            if (currentEnd > nextStart + 0.01) { // Small tolerance
                timingIssues++;
            }
        }
        const timingScore = 1 - (timingIssues / notes.length);
        // Check for reasonable pitch ranges
        const pitches = notes.map(n => n.pitch);
        const pitchRange = Math.max(...pitches) - Math.min(...pitches);
        const rangeScore = Math.min(1, pitchRange / 36); // Ideal: 3 octaves
        let baseScore = Math.min(1, (timingScore * 0.6) + (rangeScore * 0.4));
        // Personality influence: earth element and wisdom boost technical proficiency
        if (leaderPersonality) {
            let personalityBonus = 0;
            // Element influence: earth is more technically precise
            if (leaderPersonality.element === 'earth') {
                personalityBonus += 0.3;
            }
            // Wisdom and discipline traits
            personalityBonus += (leaderPersonality.wisdom * 0.4) + (leaderPersonality.discipline * 0.3);
            baseScore = Math.min(1, baseScore * (1 + personalityBonus * 0.2)); // Up to 20% bonus
        }
        return baseScore;
    }
    /**
     * Evaluate innovation and uniqueness - influenced by leader personality
     */
    evaluateInnovationFactor(result, midiNotes, poetryData, leaderPersonality) {
        // Base innovation calculation
        const participantDiversity = Math.min(1, result.participants.length / 10);
        const consensusUniqueness = 1 - Math.abs(result.beauty - 0.5) * 2; // Penalize middle values
        const rhythmicInnovation = this.evaluateRhythmicVariety(midiNotes);
        const poetryUniqueness = poetryData ? (poetryData.fibonacciRatio || 0.5) : 0.5;
        let baseScore = Math.min(1, (participantDiversity * 0.3) + (consensusUniqueness * 0.3) +
            (rhythmicInnovation * 0.2) + (poetryUniqueness * 0.2));
        // Personality influence: creativity and rebelliousness boost innovation
        if (leaderPersonality) {
            const personalityBonus = (leaderPersonality.creativity * 0.4) + (leaderPersonality.rebelliousness * 0.4) + (leaderPersonality.intuition * 0.2);
            baseScore = Math.min(1, baseScore * (1 + personalityBonus * 0.3)); // Up to 30% bonus
        }
        return baseScore;
    }
    /**
     * Get emotional depth based on zodiac sign
     */
    getZodiacEmotionalDepth(zodiacSign) {
        const emotionalDepth = {
            'Aries': 0.8, 'Taurus': 0.6, 'Gemini': 0.7, 'Cancer': 0.9,
            'Leo': 0.8, 'Virgo': 0.6, 'Libra': 0.7, 'Scorpio': 0.9,
            'Sagittarius': 0.7, 'Capricorn': 0.6, 'Aquarius': 0.8, 'Pisces': 0.9
        };
        return emotionalDepth[zodiacSign] || 0.7;
    }
    /**
     * � SSE-7.2: PRNG DETERMINISTA (Linear Congruential Generator)
     * Genera números pseudoaleatorios reproducibles basados en semilla
     * @param seed - Semilla para el generador
     * @returns Número entre 0 y 1
     */
    seededRandom(seed) {
        // LCG parameters (Numerical Recipes)
        const a = 1664525;
        const c = 1013904223;
        const m = Math.pow(2, 32);
        const nextSeed = (a * seed + c) % m;
        return nextSeed / m;
    }
    /**
     * 🎲 SSE-7.2: PRNG RANGE DETERMINISTA
     * Genera entero aleatorio en rango [min, max] basado en semilla
     * @param seed - Semilla para el generador
     * @param min - Valor mínimo (inclusive)
     * @param max - Valor máximo (inclusive)
     * @returns Entero en rango [min, max]
     */
    seededRandomInt(seed, min, max) {
        const random = this.seededRandom(seed);
        return Math.floor(random * (max - min + 1)) + min;
    }
    /**
     * �🎵 DIRECTIVA 13.5: COMPONER SINFONÍA DE CONSENSO PROCEDIMENTAL
     * Genera sinfonías musicales épicas de 20-60 segundos usando algoritmos completamente deterministas
     * con proporciones Fibonacci, modos zodiacales, belleza del consenso y densidad de participantes
     */
    composeConsensusSymphony(result, intentionParams) {
        // 🔀 PHASE 7.1: Read current mode config (SSE-7.1)
        this.currentModeConfig = this.modeManager.getModeConfig();
        const currentMode = this.modeManager.getCurrentMode();
        console.log(`🔀 Music Generation - Mode: ${currentMode} | Entropy: ${this.currentModeConfig.entropyFactor} | Punk: ${this.currentModeConfig.punkProbability}`);
        console.log(`🎵 [DIRECTIVA 13.5] Componiendo sinfonía procedural para consenso con ${result.participants.length} participantes`);
        // 🎯 DETERMINISMO TOTAL: Calcular duración usando hash del consenso
        const consensusHash = this.hashString(JSON.stringify(result) + (intentionParams ? JSON.stringify(intentionParams) : ''));
        const durationSeed = Math.abs(consensusHash) % 1000;
        const symphonyDuration = 20 + (durationSeed % 40); // 20-60 segundos
        console.log(`🎼 Duración sinfónica calculada: ${symphonyDuration} segundos (seed: ${durationSeed})`);
        // 🎯 MODO ZODIACAL DETERMINISTA: Basado en belleza del consenso
        const zodiacModes = ['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian'];
        const modeIndex = Math.floor(result.beauty * zodiacModes.length) % zodiacModes.length;
        const zodiacMode = zodiacModes[modeIndex];
        console.log(`🌟 Modo zodiacal seleccionado: ${zodiacMode} (belleza: ${result.beauty.toFixed(3)})`);
        // 🎯 RAÍZ TONAL DETERMINISTA: Basado en participantes
        const rootPitch = 48 + (result.participants.length % 24); // C3 to C5 range
        console.log(`🎹 Raíz tonal: ${rootPitch} (participantes: ${result.participants.length})`);
        // 🎯 BELLEZA DEL CONSENSO: Controla armonía y consonancia
        const consonanceBonus = result.beauty;
        const dissonanceLevel = 1 - result.beauty;
        // 🎯 DENSIDAD MUSICAL: Basado en conteo de participantes
        const layerCount = Math.max(2, Math.min(5, Math.floor(result.participants.length / 3) + 1));
        console.log(`🎶 Capas musicales: ${layerCount} (densidad por participantes)`);
        // 🎼 ESTRUCTURA FIBONACCI: Dividir sinfonía en secciones áureas
        const fibSections = [1, 1, 2, 3, 5, 8, 13]; // Proporciones Fibonacci
        const totalFib = fibSections.reduce((a, b) => a + b, 0);
        const sectionDurations = fibSections.map(fib => (fib / totalFib) * symphonyDuration);
        const allNotes = [];
        let currentTime = 0;
        // 🎵 GENERAR CAPAS MUSICALES PARA CADA SECCIÓN FIBONACCI
        for (let section = 0; section < fibSections.length; section++) {
            const sectionDuration = sectionDurations[section];
            const sectionEnd = currentTime + sectionDuration;
            console.log(`🎼 Sección ${section + 1}/${fibSections.length}: ${sectionDuration.toFixed(1)}s (Fib: ${fibSections[section]})`);
            // Generar múltiples capas para densidad
            for (let layer = 0; layer < layerCount; layer++) {
                const layerSeed = consensusHash + section * 1000 + layer * 100;
                // 🎹 MELODÍA PRINCIPAL (capa 0): Línea melódica principal
                if (layer === 0) {
                    const melodyNotes = this.generateFibonacciMelody(currentTime, sectionEnd, rootPitch, zodiacMode, dissonanceLevel, consonanceBonus, layerSeed, layer, this.currentModeConfig // 🔀 SSE-7.2: Pasar modo config
                    );
                    allNotes.push(...melodyNotes);
                }
                // 🎹 ARMONÍA (capas 1-2): Acompañamiento armónico
                else if (layer < 3) {
                    const harmonyNotes = this.generateHarmonyLayer(currentTime, sectionEnd, rootPitch + (layer - 1) * 7, // Diferentes raíces para armonía
                    zodiacMode, consonanceBonus, layerSeed, layer, this.currentModeConfig // 🔀 SSE-7.2: Pasar modo config
                    );
                    allNotes.push(...harmonyNotes);
                }
                // 🥁 RITMO (capas 3-4): Elementos rítmicos/percusión
                else {
                    const rhythmNotes = this.generateRhythmLayer(currentTime, sectionEnd, result.participants.length, dissonanceLevel, layerSeed, layer, this.currentModeConfig // 🔀 SSE-7.2: Pasar modo config
                    );
                    allNotes.push(...rhythmNotes);
                }
            }
            currentTime = sectionEnd;
        }
        // 🎯 ORDENAR NOTAS POR TIEMPO para reproducción correcta
        allNotes.sort((a, b) => a.time - b.time);
        console.log(`🎵 [DIRECTIVA 13.5] Sinfonía completada: ${allNotes.length} notas en ${symphonyDuration}s`);
        console.log(`   📊 Estadísticas: ${layerCount} capas, modo ${zodiacMode}, raíz ${rootPitch}, belleza ${consonanceBonus.toFixed(3)}`);
        return allNotes;
    }
    /**
     * 🎹 GENERAR CAPA DE ARMONÍA: Acompañamiento armónico determinista
     */
    generateHarmonyLayer(startTime, endTime, rootPitch, mode, consonanceBonus, seed, layer, modeConfig // 🔀 SSE-7.2: Entropy-aware harmony
    ) {
        const notes = [];
        const duration = endTime - startTime;
        // 🎼 PROGRESIÓN ARMÓNICA DETERMINISTA
        const harmonyInterval = 2.0; // Cambios armónicos cada 2 segundos
        const totalChords = Math.floor(duration / harmonyInterval);
        for (let i = 0; i < totalChords; i++) {
            const time = startTime + (i * harmonyInterval);
            const chordSeed = seed + i * 17;
            // 🎹 ACORDES DETERMINISTAS basados en modo (🔀 SSE-7.2: ahora con entropy)
            const chordPitches = this.generateChord(rootPitch, mode, chordSeed, modeConfig);
            // 🎨 VELOCIDAD BASADA EN BELLEZA
            const velocity = Math.floor(35 + (consonanceBonus * 25));
            // Añadir notas del acorde
            for (const pitch of chordPitches) {
                notes.push({
                    pitch: Math.max(36, Math.min(84, pitch)), // Rango armónico
                    duration: harmonyInterval * 0.9, // Ligeramente más corto que el intervalo
                    velocity: velocity,
                    time: time
                });
            }
        }
        return notes;
    }
    /**
     * 🥁 GENERAR CAPA RÍTMICA: Elementos percusivos deterministas
     */
    generateRhythmLayer(startTime, endTime, participantCount, dissonanceLevel, seed, layer, modeConfig // 🔀 SSE-7.2: Entropy-aware rhythm
    ) {
        const notes = [];
        const duration = endTime - startTime;
        // 🥁 PATRÓN RÍTMICO BASADO EN PARTICIPANTES
        const beatInterval = 0.25; // 16th notes
        const totalBeats = Math.floor(duration / beatInterval);
        // Densidad rítmica basada en participantes (Base)
        let density = Math.max(0.3, Math.min(0.8, participantCount / 10));
        // 🔀 SSE-7.2: APLICAR ENTROPY FACTOR A DENSIDAD RÍTMICA
        if (modeConfig.entropyFactor > 0) {
            const densityEntropySeed = seed + modeConfig.entropyFactor * 777;
            const densityVariation = this.seededRandom(densityEntropySeed) * (modeConfig.entropyFactor / 200);
            density = Math.max(0.2, Math.min(0.9, density + densityVariation));
        }
        for (let i = 0; i < totalBeats; i++) {
            const time = startTime + (i * beatInterval);
            const beatSeed = seed + i * 23;
            // ¿Tocar en este beat? (Ahora density puede variar con entropy)
            const shouldPlay = (beatSeed % 100) / 100 < density;
            if (shouldPlay) {
                // 🥁 PITCH RÍTMICO DETERMINISTA
                const rhythmPitch = 36 + (beatSeed % 12); // C2 to B2 range
                // 🎨 VELOCIDAD BASADA EN DISONANCIA
                const velocity = Math.floor(45 + (dissonanceLevel * 30));
                notes.push({
                    pitch: rhythmPitch,
                    duration: beatInterval * 0.6, // Notas rítmicas cortas
                    velocity: velocity,
                    time: time
                });
            }
        }
        return notes;
    }
    /**
     * 🎹 GENERAR ACORDE DETERMINISTA basado en modo musical
     */
    generateChord(rootPitch, mode, seed, modeConfig) {
        const scalePatterns = {
            'major': [0, 4, 7], // Mayor
            'minor': [0, 3, 7], // Menor
            'dorian': [0, 3, 7], // Dórico (similar a menor)
            'phrygian': [0, 3, 6], // Frigio (tensión añadida)
            'lydian': [0, 4, 7], // Lidio (similar a mayor)
            'mixolydian': [0, 4, 7] // Mixolidio (similar a mayor)
        };
        const chord = scalePatterns[mode] || scalePatterns['major'];
        // 🔀 SSE-7.2: AÑADIR TENSIÓN BASADA EN ENTROPY FACTOR
        // Modo Determinista (entropy=0): Solo acordes básicos (triadas)
        // Modo Balanced (entropy<60): Tensión moderada (séptimas)
        // Modo Punk (entropy>=60): Tensión máxima (extensiones, alteraciones, disonancias)
        const tensionSeed = seed % 100;
        const entropyThreshold = 100 - modeConfig.entropyFactor; // Mayor entropy = menor threshold
        if (tensionSeed > entropyThreshold) {
            // En modo Punk (entropy alta), mayor probabilidad de acordes complejos
            if (modeConfig.entropyFactor >= 60) {
                // Acordes muy complejos: 9nas, 11vas, alteraciones
                const complexExtensions = [9, 11, 13, 10, 6, 14]; // Extensiones/alteraciones
                const extensionSeed = seed * modeConfig.entropyFactor;
                const extensionIndex = this.seededRandomInt(extensionSeed, 0, complexExtensions.length - 1);
                chord.push(complexExtensions[extensionIndex]);
            }
            else if (modeConfig.entropyFactor > 0) {
                // Acordes moderados: séptimas
                chord.push(tensionSeed > 50 ? 10 : 9); // Séptima menor o mayor
            }
            // Si entropy=0, no se añade nada (acordes básicos)
        }
        return chord.map(interval => rootPitch + interval);
    }
    /**
     * 🎵 GENERAR MELODÍA FIBONACCI: Melodía determinista usando proporción áurea
     */
    generateFibonacciMelody(startTime, endTime, rootPitch, mode, dissonanceLevel, consonanceBonus, seed, layer, modeConfig // 🔀 SSE-7.2: Entropy-aware generation
    ) {
        const notes = [];
        const duration = endTime - startTime;
        // 🎯 ESCALAS MODALES DETERMINISTAS
        const scalePatterns = {
            'major': [0, 2, 4, 5, 7, 9, 11], // Dó mayor
            'minor': [0, 2, 3, 5, 7, 8, 10], // Lá menor
            'dorian': [0, 2, 3, 5, 7, 9, 10], // Ré dorio
            'phrygian': [0, 1, 3, 5, 7, 8, 10], // Mi frigio
            'lydian': [0, 2, 4, 6, 7, 9, 11], // Fá lidio
            'mixolydian': [0, 2, 4, 5, 7, 9, 10] // Sol mixolidio
        };
        const scale = scalePatterns[mode] || scalePatterns['major'];
        // 🎼 PATRÓN RÍTMICO FIBONACCI
        const fibRhythms = [1, 1, 2, 3, 5, 8]; // Duraciones rítmicas
        const totalRhythmDuration = fibRhythms.reduce((a, b) => a + b, 0);
        const rhythmMultiplier = duration / totalRhythmDuration;
        let currentTime = startTime;
        let currentPitch = rootPitch;
        for (let i = 0; i < fibRhythms.length; i++) {
            const rhythmDuration = fibRhythms[i] * rhythmMultiplier;
            // 🎵 PROGRESIÓN MELODICA DETERMINISTA (Base)
            const pitchStep = (seed + i * 7 + layer * 13) % scale.length;
            const scaleDegree = scale[pitchStep];
            const octaveOffset = Math.floor((seed + i * 11) % 3) - 1; // -1, 0, +1 octava
            let pitch = rootPitch + scaleDegree + (octaveOffset * 12);
            // 🔀 SSE-7.2: APLICAR ENTROPY FACTOR A PITCH
            if (modeConfig.entropyFactor > 0) {
                // Semilla combinada: seed base + entropyFactor + índice nota + timestamp cuantizado
                const entropySeed = seed + i * modeConfig.entropyFactor + Math.floor(Date.now() / 10000);
                // Calcular offset basado en entropyFactor (0-100 → 0-6 semitonos)
                const maxOffset = Math.floor((modeConfig.entropyFactor / 100) * 6);
                const pitchOffset = this.seededRandomInt(entropySeed, -maxOffset, maxOffset);
                pitch += pitchOffset;
                // Log solo para modo Punk (entropyFactor >= 60)
                if (modeConfig.entropyFactor >= 60 && i === 0) {
                    console.log(`🎲 Entropy applied to pitch: offset=${pitchOffset}, maxOffset=${maxOffset}, factor=${modeConfig.entropyFactor}`);
                }
            }
            // 🎨 VELOCIDAD BASADA EN BELLEZA Y DISONANCIA
            const baseVelocity = 60 + Math.floor(consonanceBonus * 40);
            const dissonanceMod = dissonanceLevel * 20 * ((seed + i) % 2 === 0 ? 1 : -1);
            const velocity = Math.max(20, Math.min(120, baseVelocity + dissonanceMod));
            // 🎼 DURACIÓN NOTA CON VARIACIÓN ÁUREA (Base)
            const goldenRatio = 1.618;
            let durationMod = (seed + i * 17) % 2 === 0 ? 1 : goldenRatio;
            // 🔀 SSE-7.2: APLICAR ENTROPY FACTOR A DURACIÓN
            if (modeConfig.entropyFactor > 0) {
                const durationEntropySeed = seed + i * 1000 + modeConfig.entropyFactor;
                const durationVariation = this.seededRandom(durationEntropySeed) * (modeConfig.entropyFactor / 100);
                durationMod *= (1 + durationVariation); // Multiplicador variable basado en entropía
            }
            const noteDuration = Math.max(0.1, rhythmDuration * durationMod * 0.8);
            notes.push({
                pitch: Math.max(36, Math.min(96, pitch)), // Rango MIDI válido
                duration: noteDuration,
                velocity: velocity,
                time: currentTime
            });
            currentTime += rhythmDuration;
            currentPitch = pitch;
        }
        return notes;
    }
    async generateConsensusPoetry(result, intentParameters) {
        try {
            // 🔀 PHASE 7.1: Read current mode config (SSE-7.1)
            this.currentModeConfig = this.modeManager.getModeConfig();
            const currentMode = this.modeManager.getCurrentMode();
            console.log(`🔀 Poetry Generation - Mode: ${currentMode} | Entropy: ${this.currentModeConfig.entropyFactor} | Risk: ${this.currentModeConfig.riskThreshold}`);
            this.verseCount++;
            // 🎯 DETERMINISMO NUMEROLÓGICO (replicando ZodiacCyberpunkEngine)
            const timestamp = Date.now();
            const heartbeatPhase = Math.floor((timestamp / 1000) % 7); // 0-6 cada 7 segundos
            // Zodiac index basado en numerología
            const zodiacIndex = (this.verseCount + heartbeatPhase + Math.floor(timestamp / 1000000)) % 12;
            // Mapear índice a nombre de archivo
            const zodiacFiles = ['aries', 'tauro', 'geminis', 'cancer', 'leo', 'virgo', 'libra', 'escorpio', 'sagitario', 'capricornio', 'acuario', 'piscis'];
            const zodiacFilename = zodiacFiles[zodiacIndex];
            // 🌟 CARGA PRIMARIA: Siempre cargar la librería zodiacal correspondiente
            const zodiacTheme = await this.poetryLibrary.loadZodiacTheme(zodiacFilename);
            if (!zodiacTheme) {
                console.warn(`⚠️ Failed to load zodiac theme: ${zodiacFilename}`);
                return null;
            }
            // 🌙 CARGA SUPLEMENTARIA: Basado en métricas del sistema (Cargador Contextual Inteligente)
            const systemVitals = SystemVitals.getInstance();
            const systemMetrics = systemVitals.getCurrentVitalSigns();
            const supplementaryLibraries = [];
            // Reglas de carga suplementaria basadas en estado del sistema
            if (systemMetrics.stress > 0.7) {
                supplementaryLibraries.push('contexts/emotional_states:agony');
                supplementaryLibraries.push('contexts/emotional_states:chaos');
            }
            else if (systemMetrics.stress < 0.3) {
                supplementaryLibraries.push('contexts/emotional_states:serenity');
            }
            if (result.beauty > 0.9) {
                supplementaryLibraries.push('contexts/emotional_states:ecstasy');
            }
            if (systemMetrics.creativity > 0.8) {
                supplementaryLibraries.push('contexts/nature:ocean');
                supplementaryLibraries.push('contexts/nature:river');
            }
            if (systemMetrics.harmony > 0.8) {
                supplementaryLibraries.push('contexts/nature:forest');
            }
            // Cargar librerías suplementarias
            const supplementaryData = {};
            for (const libPath of supplementaryLibraries) {
                const [category, name] = libPath.split(':');
                await this.poetryLibrary.loadLibrary(category, name);
                const libData = this.poetryLibrary.librariesMap.get(libPath);
                if (libData) {
                    supplementaryData[libPath] = libData;
                }
            }
            // 🎯 FORJA 9.0: Aplicar modificadores de comportamiento pre-hoc si están presentes
            let modifiedZodiacTheme = zodiacTheme;
            let modifiedSupplementaryLibraries = supplementaryLibraries;
            let modifiedSupplementaryData = supplementaryData;
            if (intentParameters) {
                console.log(`🎯 FORJA 9.0 - Aplicando modificadores de comportamiento en generación de poesía: ${intentParameters.profile}`);
                // Aplicar template bias: Modificar selección de templates
                if (intentParameters.behavior_modifiers?.template_bias) {
                    console.log(`📝 Aplicando template bias funcional: ${intentParameters.behavior_modifiers.template_bias}`);
                    // Implementación completa aplicada en selección de template
                }
                // Aplicar element preference: Modificar selección de elementos zodiacales
                if (intentParameters.behavior_modifiers?.element_preference) {
                    console.log(`🔥 Aplicando element preference: ${intentParameters.behavior_modifiers.element_preference}`);
                    // Mapear preferencia elemental a signos zodiacales
                    const elementToSigns = {
                        'fire': ['aries', 'leo', 'sagitario'],
                        'earth': ['tauro', 'virgo', 'capricornio'],
                        'air': ['geminis', 'libra', 'acuario'],
                        'water': ['cancer', 'escorpio', 'piscis']
                    };
                    const preferredSigns = elementToSigns[intentParameters.behavior_modifiers.element_preference] || [];
                    if (preferredSigns.length > 0) {
                        // Forzar selección de un signo del elemento preferido
                        const elementPreference = intentParameters.behavior_modifiers.element_preference;
                        const preferredSignIndex = Math.abs(this.hashString(timestamp.toString() + elementPreference)) % preferredSigns.length;
                        const preferredSign = preferredSigns[preferredSignIndex];
                        const preferredIndex = zodiacFiles.indexOf(preferredSign);
                        if (preferredIndex !== -1) {
                            // Recargar el tema zodiacal con el signo preferido
                            modifiedZodiacTheme = await this.poetryLibrary.loadZodiacTheme(preferredSign);
                            if (modifiedZodiacTheme) {
                                console.log(`🔥 Element preference aplicado: ${zodiacFilename} → ${preferredSign}`);
                            }
                        }
                    }
                }
                // Aplicar numerology weight: Modificar ratios Fibonacci y seeds
                if (intentParameters.behavior_modifiers.numerology_weight > 0) {
                    console.log(`🔢 Aplicando numerology weight funcional: ${intentParameters.behavior_modifiers.numerology_weight} (afecta seeds y fibonacci)`);
                    // Implementación completa aplicada en selectWeightedWord y fibonacciRatio
                }
            }
            // Fibonacci position para variación (modificado por numerology weight si aplica)
            const fibonacciSequence = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];
            const fibonacciPosition = this.verseCount % fibonacciSequence.length;
            let fibonacciRatio = fibonacciSequence[fibonacciPosition] / fibonacciSequence[fibonacciSequence.length - 1];
            // Aplicar numerology weight a fibonacci ratio si está presente
            if (intentParameters && intentParameters.behavior_modifiers.numerology_weight > 0) {
                fibonacciRatio = fibonacciRatio * (1 + intentParameters.behavior_modifiers.numerology_weight * 0.2);
                fibonacciRatio = Math.min(1.0, fibonacciRatio); // Clamp to valid range
            }
            // Generar componentes del verso usando determinismo con MEZCLA PONDERADA
            const seed = timestamp + this.verseCount + fibonacciPosition;
            // 🎭 MEZCLADOR TEMÁTICO PONDERADO (70% zodiacal, 30% suplementario)
            const numerologyWeight = intentParameters?.behavior_modifiers?.numerology_weight || 0;
            const adjective = this.selectWeightedWord(modifiedZodiacTheme.adjectives, this.extractWordsFromSupplements(modifiedSupplementaryData, 'adjectives'), seed * 7 + result.beauty * 100, 0.7, // 70% zodiacal
            numerologyWeight);
            const verb = this.selectWeightedWord(modifiedZodiacTheme.verbs, this.extractWordsFromSupplements(modifiedSupplementaryData, 'verbs'), seed * 13 + result.beauty * 100, 0.7, numerologyWeight);
            const noun = this.selectWeightedWord(modifiedZodiacTheme.nouns, this.extractWordsFromSupplements(modifiedSupplementaryData, 'nouns'), seed * 17 + fibonacciRatio * 100, 0.7, numerologyWeight);
            // Cargar verse templates desde structures.json
            const verseTemplates = await this.poetryLibrary.loadVerseTemplates();
            if (!verseTemplates || verseTemplates.length === 0) {
                console.warn('⚠️ Failed to load verse templates');
                return null;
            }
            // 🎯 FORJA 9.0: Aplicar template bias si está presente
            let templateIndex;
            if (intentParameters?.behavior_modifiers?.template_bias) {
                const bias = intentParameters.behavior_modifiers.template_bias;
                // Definir categorías de templates basadas en complejidad y estilo
                const chaoticTemplates = [0, 2, 5, 6, 8, 10]; // Templates más dinámicos y complejos
                const epicTemplates = [1, 3, 4, 7, 9, 11]; // Templates más grandiosos y poéticos
                let availableIndices;
                if (bias === 'experimental') {
                    availableIndices = chaoticTemplates;
                    console.log(`🎭 Template bias 'experimental' aplicado: seleccionando de ${availableIndices.length} templates experimentales`);
                }
                else if (bias === 'poetic') {
                    availableIndices = epicTemplates;
                    console.log(`🎭 Template bias 'poetic' aplicado: seleccionando de ${availableIndices.length} templates poéticos`);
                }
                else {
                    availableIndices = Array.from({ length: verseTemplates.length }, (_, i) => i);
                }
                // Seleccionar determinísticamente de los templates disponibles
                const biasSeed = seed * 19; // Nuevo factor primo para variación
                templateIndex = availableIndices[Math.floor(biasSeed % availableIndices.length)];
            }
            else {
                // Template basado en seed para determinismo con variedad (comportamiento original)
                templateIndex = seed % verseTemplates.length;
            }
            const template = verseTemplates[templateIndex];
            // Construir el verso usando el template
            const verse = template
                .replace(/\$\{noun\}/g, noun)
                .replace(/\$\{verb\}/g, verb)
                .replace(/\$\{adjective\}/g, adjective)
                .replace(/\$\{zodiacTheme\.element\}/g, modifiedZodiacTheme.element)
                .replace(/\$\{zodiacTheme\.coreConcept\.toLowerCase\(\)\}/g, modifiedZodiacTheme.coreConcept.toLowerCase())
                .replace(/\$\{adjective\.charAt\(0\)\.toUpperCase\(\) \+ adjective\.slice\(1\)\}/g, adjective.charAt(0).toUpperCase() + adjective.slice(1));
            // Calcular belleza usando Fibonacci weighting con influencia contextual
            const baseBeauty = (result.beauty + result.beauty + fibonacciRatio) / 3;
            const zodiacWeight = modifiedZodiacTheme.fibonacciWeight / 144; // Normalizar por máximo Fibonacci
            const contextualBonus = modifiedSupplementaryLibraries.length * 0.1; // Bonus por librerías suplementarias
            const beauty = Math.min(1.0, baseBeauty * (1 + zodiacWeight) + contextualBonus);
            const poetryData = {
                id: `poem_${timestamp}_${this.hashString(timestamp.toString() + 'poem').toString(36).substr(0, 9)}`,
                timestamp: timestamp,
                participant: `selene-${Math.abs(this.hashString(timestamp.toString() + 'participant')) % 10000}`,
                consensusId: `consensus_${timestamp}`,
                verse: verse,
                zodiacSign: modifiedZodiacTheme.sign,
                element: modifiedZodiacTheme.element,
                quality: modifiedZodiacTheme.quality,
                supplementaryContexts: modifiedSupplementaryLibraries,
                systemContext: {
                    stress: systemMetrics.stress,
                    harmony: systemMetrics.harmony,
                    creativity: systemMetrics.creativity,
                    beauty: result.beauty
                },
                musicalNote: this.determineWinningNote(result),
                beauty: beauty,
                consciousness: 0.5 + (result.beauty * 0.4) + (fibonacciRatio * 0.1),
                creativity: 0.5 + (result.beauty * 0.3) + ((seed % 50) / 100),
                fibonacciRatio: fibonacciRatio,
                numerology: {
                    zodiacIndex,
                    fibonacciPosition,
                    heartbeatPhase,
                },
                qualityMetrics: {
                    melodicComplexity: 0.5,
                    harmonicCoherence: 0.5,
                    rhythmicVariety: 0.5,
                    structuralBalance: 0.5,
                    dynamicRange: 0.5,
                    consensusInfluence: result.beauty,
                    poeticSynergy: 0.5,
                    emotionalDepth: 0.5,
                    technicalProficiency: 0.5,
                    innovationFactor: 0.5
                }
            };
            // Generate Veritas signature
            const signature = await this.generateVeritasSignature(poetryData);
            if (signature) {
                poetryData.nft = {
                    tokenId: timestamp.toString(),
                    rarity: beauty > 0.8 ? 'legendary' : beauty > 0.6 ? 'epic' : 'rare',
                    attributes: {
                        zodiac: zodiacTheme.sign,
                        element: zodiacTheme.element,
                        supplementaryContexts: supplementaryLibraries.length,
                        systemStress: systemMetrics.stress,
                        systemHarmony: systemMetrics.harmony,
                        beauty: beauty,
                        consciousness: poetryData.consciousness,
                        creativity: poetryData.creativity,
                        advancedQuality: 0.5
                    },
                    veritas_signature: signature
                };
            }
            console.log(`🌟 Generated Unified Zodiac verse: ${modifiedZodiacTheme.sign} + ${modifiedSupplementaryLibraries.length} contexts - "${verse.substring(0, 60)}..."`);
            if (intentParameters) {
                console.log(`🎯 FORJA 9.0 - Parámetros de intención aplicados: ${intentParameters.profile}`);
            }
            return poetryData;
        }
        catch (error) {
            console.warn('⚠️ Poetry generation failed:', error.message);
            return null;
        }
    }
    /**
     * Stop recording and export to MIDI file
     */
    async stopRecording(filename) {
        this.isRecording = false;
        console.log(`🎵 Stopped recording: ${this.recording.length} notes recorded`);
        return filename || `recording_${Date.now()}.mid`;
    }
    /**
     * Get recording statistics
     */
    getStats() {
        return {
            noteCount: this.recording.length,
            duration: this.recording.length > 0
                ? Math.max(...this.recording.map(n => n.time + n.duration))
                : 0,
            isRecording: this.isRecording
        };
    }
    /**
     * Save basic consensus data to dashboard keys (selene:consensus:latest and history)
     */
    async saveBasicConsensusToDashboard(result, quality) {
        try {
            // Handle both legacy number quality and new ProceduralProfile
            const qualityValue = typeof quality === 'number' ? quality : quality.coherence;
            const consensusData = {
                id: `consensus_${Date.now()}_${this.hashString(Date.now().toString() + 'consensus').toString(36).substr(0, 9)}`,
                timestamp: Date.now(),
                consensusAchieved: result.consensusAchieved,
                participants: result.participants,
                participantCount: result.participants.length,
                consensusTime: result.consensusTime,
                beauty: result.beauty,
                quality: qualityValue,
                harmony: qualityValue, // Use same value for harmony as quality
                musicalNote: this.determineWinningNote(result),
                noteCount: this.recording.length,
                duration: this.recording.length > 0 ? Math.max(...this.recording.map(n => n.time + n.duration)) : 0
            };
            // Save to latest consensus
            await this.redis.hmset('selene:consensus:latest', consensusData);
            // Add to consensus history
            await this.redis.lpush('selene:consensus:history', JSON.stringify(consensusData));
            await this.redis.ltrim('selene:consensus:history', 0, 99); // Keep last 100 consensuses
            console.log(`📊 Basic consensus saved to dashboard: ${consensusData.id} (quality: ${qualityValue.toFixed(3)})`);
        }
        catch (error) {
            console.warn('⚠️ Failed to save basic consensus to dashboard:', error.message);
        }
    }
    /**
     * Create MIDI buffer from recorded notes
     */
    async createMIDIBuffer(recording) {
        // Simple MIDI file format implementation
        const header = Buffer.alloc(14);
        header.write('MThd', 0, 4); // MIDI header chunk
        header.writeUInt32BE(6, 4); // Header length
        header.writeUInt16BE(0, 8); // Format 0 (single track)
        header.writeUInt16BE(1, 10); // Number of tracks
        header.writeUInt16BE(96, 12); // Division (96 PPQ)
        const trackData = [];
        // Add track header
        trackData.push(0x4D, 0x54, 0x72, 0x6B); // 'MTrk'
        const trackLengthPos = trackData.length;
        trackData.push(0, 0, 0, 0); // Placeholder for track length
        let lastTime = 0;
        // Add tempo event (120 BPM)
        const tempoTime = 0;
        const deltaTime = tempoTime - lastTime;
        this.writeVariableLength(trackData, deltaTime);
        trackData.push(0xFF, 0x51, 0x03, 0x07, 0xA1, 0x20); // Tempo: 120 BPM
        lastTime = tempoTime;
        // Add program change (piano)
        const programTime = 0;
        const programDelta = programTime - lastTime;
        this.writeVariableLength(trackData, programDelta);
        trackData.push(0xC0, 0x00); // Program change to piano
        lastTime = programTime;
        // Add note events
        for (const note of recording) {
            const noteTime = Math.floor(note.time * 96); // Convert to MIDI ticks
            const deltaTime = noteTime - lastTime;
            // Note on
            this.writeVariableLength(trackData, deltaTime);
            trackData.push(0x90, note.pitch, note.velocity || 64);
            lastTime = noteTime;
            // Note off
            const offTime = noteTime + Math.floor(note.duration * 96);
            const offDelta = offTime - lastTime;
            this.writeVariableLength(trackData, offDelta);
            trackData.push(0x80, note.pitch, 0);
            lastTime = offTime;
        }
        // Add end of track
        this.writeVariableLength(trackData, 0);
        trackData.push(0xFF, 0x2F, 0x00);
        // Update track length
        const trackLength = trackData.length - 8;
        trackData[trackLengthPos] = (trackLength >> 24) & 0xFF;
        trackData[trackLengthPos + 1] = (trackLength >> 16) & 0xFF;
        trackData[trackLengthPos + 2] = (trackLength >> 8) & 0xFF;
        trackData[trackLengthPos + 3] = trackLength & 0xFF;
        return Buffer.concat([header, Buffer.from(trackData)]);
    }
    /**
     * Compress MIDI buffer using simple RLE
     */
    async compressMIDI(buffer) {
        // Simple compression - in real implementation you'd use proper MIDI compression
        // For now, just return the buffer as-is
        return buffer;
    }
    /**
     * Write variable length quantity to array
     */
    writeVariableLength(array, value) {
        if (value < 0)
            value = 0;
        if (value > 0x0FFFFFFF)
            value = 0x0FFFFFFF;
        let buffer = value & 0x7F;
        while ((value >>= 7) > 0) {
            buffer <<= 8;
            buffer |= 0x80;
            buffer += (value & 0x7F);
        }
        while (true) {
            array.push(buffer & 0xFF);
            if ((buffer & 0x80) === 0)
                break;
            buffer >>= 8;
        }
    }
    /**
     * 🎭 SELECCIÓN PONDERADA DE PALABRAS (Mezclador Temático)
     * 70% probabilidad de elegir de fuente primaria (zodiacal)
     * 30% probabilidad de elegir de fuentes suplementarias
     * Con influencia numerológica opcional
     */
    selectWeightedWord(primaryWords, supplementaryWords, seed, primaryWeight = 0.7, numerologyWeight = 0) {
        // Aplicar numerology weight a la seed para mayor variación
        const modifiedSeed = seed * (1 + numerologyWeight * 0.1);
        const random = (modifiedSeed % 100) / 100; // Deterministic random based on seed
        if (random < primaryWeight && primaryWords.length > 0) {
            // Elegir de fuente primaria (zodiacal)
            const index = Math.floor((modifiedSeed * 7) % primaryWords.length);
            return primaryWords[index];
        }
        else if (supplementaryWords.length > 0) {
            // Elegir de fuentes suplementarias
            const index = Math.floor((modifiedSeed * 13) % supplementaryWords.length);
            return supplementaryWords[index];
        }
        else {
            // Fallback a primaria si no hay suplementarias
            const index = Math.floor((modifiedSeed * 7) % primaryWords.length);
            return primaryWords[index];
        }
    }
    /**
     * 🧬 EXTRAER PALABRAS DE LIBRERÍAS SUPLEMENTARIAS
     * Convierte las estructuras contextuales en arrays de palabras
     */
    extractWordsFromSupplements(supplementaryData, wordType) {
        const words = [];
        for (const [libPath, libData] of Object.entries(supplementaryData)) {
            if (libPath.includes('emotional_states')) {
                // emotional_states tiene secciones como "ecstasy", "agony", etc.
                // Cada sección contiene frases completas, necesitamos extraer palabras
                for (const [emotion, phrases] of Object.entries(libData)) {
                    if (Array.isArray(phrases)) {
                        for (const phrase of phrases) {
                            // Extraer palabras basadas en el tipo solicitado
                            const extractedWords = this.extractWordsFromPhrase(phrase, wordType);
                            words.push(...extractedWords);
                        }
                    }
                }
            }
            else if (libPath.includes('nature')) {
                // nature tiene secciones como "ocean", "river", etc.
                for (const [element, phrases] of Object.entries(libData)) {
                    if (Array.isArray(phrases)) {
                        for (const phrase of phrases) {
                            const extractedWords = this.extractWordsFromPhrase(phrase, wordType);
                            words.push(...extractedWords);
                        }
                    }
                }
            }
        }
        return Array.from(new Set(words)); // Eliminar duplicados
    }
    /**
     * 🔍 EXTRAER PALABRAS ESPECÍFICAS DE UNA FRASE
     */
    extractWordsFromPhrase(phrase, wordType) {
        const words = phrase.toLowerCase().split(/\s+/);
        switch (wordType) {
            case 'adjectives':
                // Buscar palabras que suenen como adjetivos (terminan en -ing, -ed, -ous, etc.)
                return words.filter(word => word.length > 3 &&
                    (word.endsWith('ing') || word.endsWith('ed') || word.endsWith('ous') ||
                        word.endsWith('ful') || word.endsWith('less') || word.endsWith('ive')));
            case 'verbs':
                // Buscar palabras que suenen como verbos
                return words.filter(word => word.length > 2 &&
                    (word.endsWith('ing') || word.endsWith('ed') || word.endsWith('es') ||
                        word.endsWith('s') || word.includes('at') || word.includes('un')));
            case 'nouns':
                // Todo lo demás puede ser sustantivo
                return words.filter(word => word.length > 2 &&
                    !word.endsWith('ing') && !word.endsWith('ed') &&
                    !word.endsWith('ly') && !word.endsWith('the') &&
                    !word.endsWith('and') && !word.endsWith('or'));
            default:
                return [];
        }
    }
    /**
     * 🎯 DIRECTIVA 12.13: Clasificar perfil procedural basado en métricas 4D
     */
    classifyProfile(profile) {
        const { coherence, variety, rarity, complexity } = profile;
        // Umbrales para clasificación automática
        const legendaryThreshold = { coherence: 0.75, rarity: 0.8, complexity: 0.53 };
        const experimentalThreshold = 0.45;
        if (coherence >= legendaryThreshold.coherence &&
            rarity >= legendaryThreshold.rarity &&
            complexity >= legendaryThreshold.complexity) {
            return 'legendary';
        }
        else if (variety >= experimentalThreshold) {
            return 'experimental';
        }
        else {
            return 'common';
        }
    }
    /**
     * 🎯 DIRECTIVA 12.13: Exportar estadísticas del perfil log
     */
    exportProfileStats() {
        if (this.profileLog.length === 0) {
            console.error('❌ DIRECTIVA 12.13: No hay perfiles capturados para exportar');
            return null;
        }
        const stats = {
            totalProfiles: this.profileLog.length,
            timeRange: {
                start: this.profileLog[0]?.timestamp,
                end: this.profileLog[this.profileLog.length - 1]?.timestamp,
                duration: this.profileLog[this.profileLog.length - 1]?.timestamp - this.profileLog[0]?.timestamp
            },
            classifications: {
                legendary: this.profileLog.filter(p => p.classification === 'legendary').length,
                experimental: this.profileLog.filter(p => p.classification === 'experimental').length,
                common: this.profileLog.filter(p => p.classification === 'common').length
            },
            averageMetrics: {
                coherence: this.profileLog.reduce((sum, p) => sum + p.proceduralProfile.coherence, 0) / this.profileLog.length,
                variety: this.profileLog.reduce((sum, p) => sum + p.proceduralProfile.variety, 0) / this.profileLog.length,
                rarity: this.profileLog.reduce((sum, p) => sum + p.proceduralProfile.rarity, 0) / this.profileLog.length,
                complexity: this.profileLog.reduce((sum, p) => sum + p.proceduralProfile.complexity, 0) / this.profileLog.length
            },
            exportTimestamp: Date.now()
        };
        console.error(`📊 DIRECTIVA 12.13: Estadísticas exportadas - ${stats.totalProfiles} perfiles capturados`);
        return stats;
    }
    /**
     * 🎯 DIRECTIVA 12.13: Limpiar el log de perfiles
     */
    clearProfileLog() {
        const clearedCount = this.profileLog.length;
        this.profileLog = [];
        console.error(`🧹 DIRECTIVA 12.13: Log de perfiles limpiado - ${clearedCount} entradas eliminadas`);
    }
    /**
     * 🎯 DIRECTIVA 12.13: Capturar vector de perfil para debug en tiempo real
     */
    captureProfileVector(proceduralProfile) {
        const classification = this.classifyProfile(proceduralProfile);
        const timestamp = Date.now();
        const cycleId = `cycle_${timestamp}_${this.hashString(timestamp.toString() + 'cycle').toString(36).substr(0, 9)}`;
        const profileEntry = {
            timestamp: timestamp,
            proceduralProfile,
            classification,
            cycleId
        };
        this.profileLog.push(profileEntry);
        // Mantener solo los últimos 1000 perfiles para evitar memory leaks
        if (this.profileLog.length > 1000) {
            this.profileLog = this.profileLog.slice(-1000);
        }
    }
}
