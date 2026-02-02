/**
 * 📡 SELENE TELEMETRY COLLECTOR
 * ═══════════════════════════════════════════════════════════════════════════
 * "La Mente Transparente - Expone TODO lo que Selene piensa"
 *
 * WAVE 14: Brain Surgery & Monitoring
 *
 * Este módulo recopila TODAS las métricas internas de los engines de Selene
 * y las empaqueta en un único objeto de telemetría para enviar a la UI.
 *
 * MÉTRICAS RECOPILADAS:
 * - Audio: Bass/Mid/Treble/Energy
 * - Musical DNA: Key/Mode/Mood/Zodiac/Section/Genre/Syncopation
 * - Hunt: StalkingEngine + StrikeMomentEngine status
 * - Cosmic: ZodiacAffinity + FibonacciPattern
 * - Session: Frames/Strikes/Beauty/Health
 *
 * @module engines/telemetry/SeleneTelemetryCollector
 */
// ═══════════════════════════════════════════════════════════════════════════
// 🔧 HELPER CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const ZODIAC_SIGNS = [
    { name: 'Aries', symbol: '♈', element: 'fire', quality: 'cardinal' },
    { name: 'Taurus', symbol: '♉', element: 'earth', quality: 'fixed' },
    { name: 'Gemini', symbol: '♊', element: 'air', quality: 'mutable' },
    { name: 'Cancer', symbol: '♋', element: 'water', quality: 'cardinal' },
    { name: 'Leo', symbol: '♌', element: 'fire', quality: 'fixed' },
    { name: 'Virgo', symbol: '♍', element: 'earth', quality: 'mutable' },
    { name: 'Libra', symbol: '♎', element: 'air', quality: 'cardinal' },
    { name: 'Scorpio', symbol: '♏', element: 'water', quality: 'fixed' },
    { name: 'Sagittarius', symbol: '♐', element: 'fire', quality: 'mutable' },
    { name: 'Capricorn', symbol: '♑', element: 'earth', quality: 'cardinal' },
    { name: 'Aquarius', symbol: '♒', element: 'air', quality: 'fixed' },
    { name: 'Pisces', symbol: '♓', element: 'water', quality: 'mutable' },
];
const MODE_DESCRIPTIONS = {
    'major': 'Alegre y brillante',
    'ionian': 'Alegre y brillante',
    'minor': 'Triste y melancólico',
    'aeolian': 'Triste y melancólico',
    'dorian': 'Jazzy y sofisticado',
    'phrygian': 'Español y tenso',
    'lydian': 'Etéreo y soñador',
    'mixolydian': 'Funky y cálido',
    'locrian': 'Oscuro y disonante',
};
const PHI = 1.618033988749895;
// ═══════════════════════════════════════════════════════════════════════════
// 📡 SELENE TELEMETRY COLLECTOR CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class SeleneTelemetryCollector {
    constructor(targetFps = 20) {
        // Session tracking
        this.frameCount = 0;
        this.strikesExecuted = 0;
        this.beautySum = 0;
        this.mutationCount = 0;
        this.palettesFromMemory = 0;
        this.palettesGenerated = 0;
        this.patternsLearned = 0;
        // Throttling
        this.lastEmitTime = 0;
        // Log deduplication
        this.lastLogMessage = '';
        this.lastLogDuplicateCount = 0;
        this.pendingLogs = [];
        // Energy trend tracking
        this.energyHistory = [];
        this.energyHistorySize = 30;
        // Last known values for stability
        this.lastAudio = null;
        this.lastBrainOutput = null;
        this.lastContext = null;
        this.startTime = Date.now();
        this.minEmitInterval = 1000 / targetFps;
        console.log(`📡 [TELEMETRY] Collector initialized at ${targetFps} FPS`);
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // 🎯 MAIN COLLECTION METHOD
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Collect telemetry from current frame
     * Returns null if throttled (too soon since last emit)
     */
    collect(audio, brainOutput, inputGain = 1.0, 
    // 🔧 WAVE 24: Pasar colores reales para generar FixtureValues
    lastColors) {
        const now = Date.now();
        // Throttle check
        if (now - this.lastEmitTime < this.minEmitInterval) {
            return null;
        }
        this.lastEmitTime = now;
        this.frameCount++;
        // Store for reference
        this.lastAudio = audio;
        this.lastBrainOutput = brainOutput;
        if (brainOutput?.context) {
            this.lastContext = brainOutput.context;
        }
        // Track energy for trend
        this.trackEnergy(audio.energy.current);
        // Update session stats
        if (brainOutput) {
            this.beautySum += brainOutput.estimatedBeauty;
            if (brainOutput.paletteSource === 'memory') {
                this.palettesFromMemory++;
            }
            else if (brainOutput.paletteSource === 'procedural') {
                this.palettesGenerated++;
            }
        }
        // 📡 WAVE-14.5: Generate contextual logs
        this.generateContextualLogs(audio, brainOutput);
        // 🔧 WAVE 24: Generate FixtureValues from lastColors
        // Crea valores DMX por-fixture basados en los colores RGB reales
        const fixtureValuesData = lastColors ? this.generateFixtureValues(lastColors, audio.energy.current) : undefined;
        // Build telemetry packet
        const packet = {
            timestamp: now,
            frameId: this.frameCount,
            audio: this.collectAudio(audio, inputGain),
            dna: this.collectDNA(audio, brainOutput),
            hunt: this.collectHunt(brainOutput),
            cosmic: this.collectCosmic(audio, brainOutput),
            palette: this.collectPalette(brainOutput),
            session: this.collectSession(brainOutput),
            fixtureValues: fixtureValuesData, // 🔧 WAVE 24
            newLogEntries: this.flushPendingLogs(),
        };
        return packet;
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 AUDIO TELEMETRY
    // ═══════════════════════════════════════════════════════════════════════════
    collectAudio(audio, inputGain) {
        return {
            spectrum: {
                bass: audio.spectrum.bass,
                mid: audio.spectrum.mid,
                treble: audio.spectrum.treble,
            },
            energy: {
                current: audio.energy.current,
                peak: audio.energy.peakRecent,
                trend: this.calculateEnergyTrend(),
            },
            beat: {
                detected: audio.beat.detected,
                bpm: audio.beat.bpm,
                confidence: audio.beat.confidence,
                phase: audio.beat.beatPhase,
            },
            inputGain,
        };
    }
    trackEnergy(energy) {
        this.energyHistory.push(energy);
        if (this.energyHistory.length > this.energyHistorySize) {
            this.energyHistory.shift();
        }
    }
    calculateEnergyTrend() {
        if (this.energyHistory.length < 10)
            return 'stable';
        const recent = this.energyHistory.slice(-10);
        const older = this.energyHistory.slice(-20, -10);
        if (older.length === 0)
            return 'stable';
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        const delta = recentAvg - olderAvg;
        if (delta > 0.1)
            return 'rising';
        if (delta < -0.1)
            return 'falling';
        return 'stable';
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // 🧬 MUSICAL DNA TELEMETRY
    // ═══════════════════════════════════════════════════════════════════════════
    collectDNA(audio, brainOutput) {
        const context = brainOutput?.context;
        const zodiacElement = this.calculateZodiacElement(audio);
        const zodiacPosition = this.elementToZodiacPosition(zodiacElement);
        const zodiacSign = ZODIAC_SIGNS[zodiacPosition];
        return {
            key: context?.harmony?.key ?? null,
            mode: context?.harmony?.mode?.scale ?? 'major',
            modeDescription: MODE_DESCRIPTIONS[context?.harmony?.mode?.scale ?? 'major'] ?? 'Desconocido',
            mood: context?.mood ?? 'neutral',
            zodiac: {
                element: zodiacElement,
                position: zodiacPosition,
                sign: zodiacSign.name,
                symbol: zodiacSign.symbol,
            },
            section: {
                type: context?.section?.current?.type ?? 'unknown',
                confidence: context?.section?.confidence ?? 0,
                estimatedDuration: context?.section?.current?.duration ?? 0,
            },
            // 🔧 WAVE 14.6: Debug syncopation - queremos ver el valor REAL
            rhythm: (() => {
                const rawSync = context?.rhythm?.groove?.syncopation;
                // RESCUE DIRECTIVE: FORCE LOGGING (DISABLED)
                // console.log(`[DEBUG-SYNC] Raw Sync: ${rawSync}, Mode: ${brainOutput?.mode}, HasContext: ${!!context}`);
                // Debug: Log si syncopation es undefined (indica cable roto)
                if (rawSync === undefined && this.frameCount % 100 === 0) {
                    console.warn('[TELEMETRY] ⚠️ Syncopation UNDEFINED - context.rhythm.groove.syncopation no existe', {
                        hasContext: !!context,
                        hasRhythm: !!context?.rhythm,
                        hasGroove: !!context?.rhythm?.groove,
                        rhythmKeys: context?.rhythm ? Object.keys(context.rhythm) : 'N/A',
                    });
                }
                return {
                    bpm: audio.beat.bpm,
                    bpmConfidence: audio.beat.confidence,
                    syncopation: rawSync ?? 0, // Usar 0.0, NO 0.5 - queremos ver si llega
                };
            })(),
            genre: {
                primary: context?.genre?.primary ?? 'unknown',
                secondary: context?.genre?.secondary ?? null,
                confidence: context?.genre?.confidence ?? 0,
            },
            energy: audio.energy.current,
            energyTrend: this.calculateEnergyTrend(),
        };
    }
    calculateZodiacElement(audio) {
        const bass = audio.spectrum.bass;
        const mid = audio.spectrum.mid;
        const treble = audio.spectrum.treble;
        const total = bass + mid + treble + 0.001;
        const bassRatio = bass / total;
        const midRatio = mid / total;
        const trebleRatio = treble / total;
        const scores = {
            fire: bassRatio * 1.5,
            earth: midRatio * 0.8,
            water: midRatio * 1.2,
            air: trebleRatio * 1.0,
        };
        let maxElement = 'earth';
        let maxScore = scores.earth;
        for (const [element, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                maxElement = element;
            }
        }
        return maxElement;
    }
    elementToZodiacPosition(element) {
        // Return a fire/earth/air/water fixed sign position
        switch (element) {
            case 'fire': return 4; // Leo
            case 'earth': return 1; // Taurus
            case 'air': return 10; // Aquarius
            case 'water': return 7; // Scorpio
        }
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // 🎯 HUNT TELEMETRY
    // ═══════════════════════════════════════════════════════════════════════════
    collectHunt(_brainOutput) {
        // Note: In the future, we'll connect this to actual StalkingEngine/StrikeMomentEngine
        // For now, we derive hunt status from brain output
        const brainOutput = _brainOutput;
        // Default values (will be populated when HuntOrchestrator is connected)
        const huntTelemetry = {
            status: 'idle',
            cycleId: null,
            currentTarget: null,
            strikeConditions: {
                beauty: { current: brainOutput?.estimatedBeauty ?? 0, threshold: 0.85, met: (brainOutput?.estimatedBeauty ?? 0) >= 0.85 },
                trend: { direction: 'stable', required: 'rising', met: false },
                harmony: { consonance: 0.7, threshold: 0.7, met: true },
                health: { current: 0.8, threshold: 0.6, met: true },
                cooldown: { ready: true, timeUntilReady: 0 },
                conditionsMet: 3,
                totalConditions: 5,
                strikeScore: brainOutput?.estimatedBeauty ?? 0.5,
                allConditionsMet: false,
            },
            preyCandidates: [],
            estimatedTimeToStrike: -1,
        };
        // Derive status from brain mode
        if (brainOutput) {
            if (brainOutput.mode === 'intelligent') {
                huntTelemetry.status = 'stalking';
                if (brainOutput.estimatedBeauty > 0.8) {
                    huntTelemetry.status = 'evaluating';
                }
            }
            else {
                huntTelemetry.status = 'idle';
            }
        }
        return huntTelemetry;
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // 🔮 COSMIC TELEMETRY
    // ═══════════════════════════════════════════════════════════════════════════
    collectCosmic(audio, _brainOutput) {
        const zodiacElement = this.calculateZodiacElement(audio);
        const zodiacPosition = this.elementToZodiacPosition(zodiacElement);
        const zodiacSign = ZODIAC_SIGNS[zodiacPosition];
        // Generate Fibonacci sequence
        const fibSequence = this.generateFibonacci(10);
        const harmonyRatio = this.calculateFibonacciHarmony(fibSequence);
        // Calculate elemental affinities from audio
        const bass = audio.spectrum.bass;
        const mid = audio.spectrum.mid;
        const treble = audio.spectrum.treble;
        return {
            zodiac: {
                currentPosition: zodiacPosition,
                currentSign: zodiacSign.name,
                symbol: zodiacSign.symbol,
                element: zodiacSign.element,
                quality: zodiacSign.quality,
                creativity: 0.7 + Math.random() * 0.2,
                stability: 0.6 + Math.random() * 0.2,
                adaptability: 0.5 + Math.random() * 0.3,
                description: `El ${zodiacSign.name} resuena con ${zodiacElement}`,
            },
            fibonacci: {
                sequence: fibSequence,
                harmonyRatio,
                phi: PHI,
                musicalKey: this.deriveKeyFromFibonacci(fibSequence),
            },
            elementalAffinities: {
                fire: Math.min(1, bass * 1.5),
                earth: Math.min(1, mid * 0.9),
                water: Math.min(1, mid * 1.1),
                air: Math.min(1, treble * 1.2),
            },
        };
    }
    generateFibonacci(length) {
        const seq = [1, 1];
        for (let i = 2; i < length; i++) {
            seq.push(seq[i - 1] + seq[i - 2]);
        }
        return seq;
    }
    calculateFibonacciHarmony(sequence) {
        if (sequence.length < 2)
            return 0;
        const last = sequence[sequence.length - 1];
        const secondLast = sequence[sequence.length - 2];
        if (secondLast === 0)
            return 0;
        const ratio = last / secondLast;
        const deviation = Math.abs(ratio - PHI);
        return Math.exp(-deviation * 5);
    }
    deriveKeyFromFibonacci(sequence) {
        const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const sum = sequence.reduce((a, b) => a + b, 0);
        return keys[sum % 12];
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // 🌈 PALETTE TELEMETRY
    // ═══════════════════════════════════════════════════════════════════════════
    collectPalette(brainOutput) {
        const defaultColor = { h: 280, s: 70, l: 50, hex: '#a855f7' };
        if (!brainOutput) {
            return {
                strategy: 'procedural',
                source: 'fallback',
                colors: {
                    primary: defaultColor,
                    secondary: defaultColor,
                    accent: defaultColor,
                    ambient: defaultColor,
                    contrast: defaultColor,
                },
                dnaDerivation: {
                    keyToHue: { key: null, hue: 280 },
                    modeShift: { mode: 'major', delta: 0 },
                    zodiacPull: { element: 'earth', delta: 0 },
                    finalHue: 280,
                },
            };
        }
        const palette = brainOutput.palette;
        return {
            strategy: (palette.strategy || 'procedural'),
            source: brainOutput.paletteSource,
            colors: {
                primary: this.hslToTelemetry(palette.primary),
                secondary: this.hslToTelemetry(palette.secondary),
                accent: this.hslToTelemetry(palette.accent),
                ambient: palette.ambient ? this.hslToTelemetry(palette.ambient) : defaultColor,
                contrast: palette.contrast ? this.hslToTelemetry(palette.contrast) : defaultColor,
            },
            dnaDerivation: {
                keyToHue: { key: brainOutput.context?.harmony?.key ?? null, hue: palette.primary.h },
                modeShift: { mode: brainOutput.context?.harmony?.mode?.scale ?? 'major', delta: 0 },
                zodiacPull: { element: 'fire', delta: 0 },
                finalHue: palette.primary.h,
            },
        };
    }
    hslToTelemetry(hsl) {
        return {
            h: hsl.h,
            s: hsl.s,
            l: hsl.l,
            hex: this.hslToHex(hsl.h, hsl.s, hsl.l),
        };
    }
    hslToHex(h, s, l) {
        const sNorm = s / 100;
        const lNorm = l / 100;
        const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = lNorm - c / 2;
        let r = 0, g = 0, b = 0;
        if (h < 60) {
            r = c;
            g = x;
            b = 0;
        }
        else if (h < 120) {
            r = x;
            g = c;
            b = 0;
        }
        else if (h < 180) {
            r = 0;
            g = c;
            b = x;
        }
        else if (h < 240) {
            r = 0;
            g = x;
            b = c;
        }
        else if (h < 300) {
            r = x;
            g = 0;
            b = c;
        }
        else {
            r = c;
            g = 0;
            b = x;
        }
        const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 SESSION TELEMETRY
    // ═══════════════════════════════════════════════════════════════════════════
    collectSession(brainOutput) {
        const uptime = Date.now() - this.startTime;
        const avgBeauty = this.frameCount > 0 ? this.beautySum / this.frameCount : 0.5;
        return {
            uptime,
            framesProcessed: this.frameCount,
            strikesExecuted: this.strikesExecuted,
            averageBeauty: avgBeauty,
            mutationCount: this.mutationCount,
            healthScore: Math.min(1, 0.7 + avgBeauty * 0.3),
            palettesFromMemory: this.palettesFromMemory,
            palettesGenerated: this.palettesGenerated,
            patternsLearned: this.patternsLearned,
            brainMode: brainOutput?.mode ?? 'reactive',
            confidence: brainOutput?.confidence ?? 0,
        };
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // 📜 LOGGING SYSTEM
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * 🎭 WAVE-14.5: Generate contextual logs based on musical analysis
     * Selene "piensa en voz alta" sobre lo que detecta
     */
    generateContextualLogs(audio, brainOutput) {
        if (!brainOutput)
            return;
        const context = brainOutput.context;
        const beauty = brainOutput.estimatedBeauty;
        // 🎵 Detección de género (cada 30 frames ~1.5s)
        if (this.frameCount % 30 === 0 && context?.genre) {
            if (context.genre.confidence > 0.6) {
                this.addLog('GENRE', `🎸 Detectando ${context.genre.primary}... (${(context.genre.confidence * 100).toFixed(0)}% confianza)`, 'info', { genre: context.genre.primary, confidence: context.genre.confidence });
            }
        }
        // 🎯 Hunt status (cada 20 frames ~1s)
        if (this.frameCount % 20 === 0) {
            if (brainOutput.mode === 'intelligent') {
                if (beauty > 0.85) {
                    this.addLog('HUNT', `👁️ Acechando... Beauty Score: ${(beauty * 100).toFixed(0)}% ¡Objetivo a la vista!`, 'warning', { beauty, mode: 'intelligent' });
                }
                else if (beauty > 0.7) {
                    this.addLog('HUNT', `🔍 Evaluando patrón... (${(beauty * 100).toFixed(0)}%)`, 'info', { beauty });
                }
            }
        }
        // 🎼 Cambio de tonalidad
        if (context?.harmony?.key && context.harmony.key !== this.lastContext?.harmony?.key) {
            this.addLog('INFO', `🎹 Nueva tonalidad detectada: ${context.harmony.key} ${context.harmony.mode?.scale || ''}`, 'info', { key: context.harmony.key, mode: context.harmony.mode?.scale });
        }
        // 💎 Beauty scores altos
        if (beauty > 0.9 && this.frameCount % 10 === 0) {
            this.addLog('STRIKE', `✨ ¡BELLEZA EXCEPCIONAL! Score: ${(beauty * 100).toFixed(0)}%`, 'success', { beauty, key: context?.harmony?.key });
        }
        // 🥁 BPM detection
        if (audio.beat.detected && audio.beat.confidence > 0.8) {
            const lastBpm = this.lastAudio?.beat.bpm || 0;
            const bpmChange = Math.abs(audio.beat.bpm - lastBpm);
            if (bpmChange > 10 && this.frameCount % 40 === 0) {
                this.addLog('BPM', `🥁 BPM ajustado: ${audio.beat.bpm.toFixed(0)} (Δ${bpmChange.toFixed(0)})`, 'info', { bpm: audio.beat.bpm, change: bpmChange });
            }
        }
        // 🎵 WAVE-14.5: Syncopation tracking (LA REGLA DE HIERRO)
        const currentSync = context?.rhythm?.groove?.syncopation ?? 0;
        const lastSync = this.lastContext?.rhythm?.groove?.syncopation ?? 0;
        const syncChange = Math.abs(currentSync - lastSync);
        // Log cambios significativos de syncopation (> 0.15)
        if (syncChange > 0.15 && this.frameCount > 20) {
            const direction = currentSync > lastSync ? '📈' : '📉';
            const intensity = currentSync > 0.5 ? 'ALTO' : currentSync > 0.25 ? 'MEDIO' : 'BAJO';
            this.addLog('INFO', `${direction} Sincopación ${intensity}: ${(currentSync * 100).toFixed(0)}% (Δ${(syncChange * 100).toFixed(0)}%)`, currentSync > 0.4 ? 'warning' : 'info', { syncopation: currentSync, change: syncChange, intensity });
        }
        // Log periódico de syncopation para debugging (cada 60 frames ~3s)
        if (this.frameCount % 60 === 0 && currentSync > 0) {
            const grooveFeel = currentSync > 0.4 ? '🔥 Off-beat heavy' :
                currentSync > 0.2 ? '🎵 Groovy' : '⬜ Straight';
            this.addLog('INFO', `🎯 Groove: ${grooveFeel} (${(currentSync * 100).toFixed(0)}% sync)`, 'info', { syncopation: currentSync, feel: grooveFeel });
        }
    }
    /**
     * Add a log entry (with deduplication)
     */
    addLog(type, message, severity = 'info', data) {
        // Deduplication check
        if (message === this.lastLogMessage) {
            this.lastLogDuplicateCount++;
            // Update the last pending log's duplicate count if it exists
            const lastLog = this.pendingLogs[this.pendingLogs.length - 1];
            if (lastLog && lastLog.message === message) {
                lastLog.duplicateCount = this.lastLogDuplicateCount;
            }
            return;
        }
        // New unique message
        this.lastLogMessage = message;
        this.lastLogDuplicateCount = 1;
        const entry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
            type,
            message,
            severity,
            duplicateCount: 1,
            data,
        };
        this.pendingLogs.push(entry);
        // Keep only last 50 pending logs
        if (this.pendingLogs.length > 50) {
            this.pendingLogs = this.pendingLogs.slice(-50);
        }
    }
    flushPendingLogs() {
        const logs = [...this.pendingLogs];
        this.pendingLogs = [];
        return logs;
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // 🔧 SESSION TRACKING METHODS
    // ═══════════════════════════════════════════════════════════════════════════
    recordStrike() {
        this.strikesExecuted++;
    }
    recordMutation() {
        this.mutationCount++;
    }
    recordPatternLearned() {
        this.patternsLearned++;
    }
    reset() {
        this.frameCount = 0;
        this.startTime = Date.now();
        this.strikesExecuted = 0;
        this.beautySum = 0;
        this.mutationCount = 0;
        this.palettesFromMemory = 0;
        this.palettesGenerated = 0;
        this.patternsLearned = 0;
        this.energyHistory = [];
        this.pendingLogs = [];
        this.lastLogMessage = '';
        this.lastLogDuplicateCount = 0;
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // 🔧 WAVE 24: Generate FixtureValues for Canvas Synchronization
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Generar valores DMX por-fixture basados en colores RGB reales
     * Permite que SimulateView.tsx reciba RGB válidos (no NaN)
     *
     * Estrategia:
     * - Crear un fixture virtual por dirección DMX (1-512)
     * - Asignar colores rotativos (primary → secondary → accent → ambient)
     * - Usar intensity para controlar el dimmer
     */
    generateFixtureValues(lastColors, energy) {
        const values = [];
        // 🎨 Usar los colores que generó el Brain/ColorEngine
        const colorPalette = [
            lastColors.primary || { r: 255, g: 255, b: 255 },
            lastColors.secondary || { r: 0, g: 0, b: 0 },
            lastColors.accent || { r: 128, g: 128, b: 128 },
            lastColors.ambient || { r: 64, g: 64, b: 64 },
        ];
        // 📡 Generar valores para 16 fixtures (direcciones 1-16)
        // En una instalación real, el FixtureManager tendría esta lista
        // Pero como no tenemos acceso a él aquí, creamos fixtures virtuales
        const fixtureCount = 16;
        const dimmerValue = Math.round((lastColors.intensity ?? energy ?? 0.5) * 255);
        for (let i = 0; i < fixtureCount; i++) {
            const dmxAddress = i + 1; // 1-indexed DMX address
            const colorIndex = i % colorPalette.length;
            const color = colorPalette[colorIndex];
            // ✅ Generar FixtureValue con valores válidos (no NaN)
            values.push({
                dmxAddress,
                dimmer: Math.max(0, Math.min(255, dimmerValue)),
                r: Math.max(0, Math.min(255, Math.round(color.r))),
                g: Math.max(0, Math.min(255, Math.round(color.g))),
                b: Math.max(0, Math.min(255, Math.round(color.b))),
                pan: 128 + Math.sin(Date.now() / 1000 + i) * 20,
                tilt: 128 + Math.cos(Date.now() / 1000 + i) * 20,
            });
        }
        return values;
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// 🏭 SINGLETON FACTORY
// ═══════════════════════════════════════════════════════════════════════════
let telemetryInstance = null;
export function getTelemetryCollector(targetFps) {
    if (!telemetryInstance) {
        telemetryInstance = new SeleneTelemetryCollector(targetFps);
    }
    return telemetryInstance;
}
export function resetTelemetryCollector() {
    telemetryInstance?.reset();
}
