/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║         CALIBRATION RUNNER - THE TRUTH EXTRACTOR              ║
 * ║                                                               ║
 * ║  "Feed synthetic signals. Record what the brain sees."        ║
 * ║                                                               ║
 * ║  No assertions. No expectations. Just cold, hard telemetry.   ║
 * ╚═══════════════════════════════════════════════════════════════╝
 *
 * WAVE 670.5 - THE SELENE LAB
 *
 * This runner feeds synthetic signals through the entire
 * Selene pipeline and records every internal metric.
 */
import { SignalGenerator } from './SignalGenerator';
// ============================================================
// CALIBRATION RUNNER
// ============================================================
export class CalibrationRunner {
    constructor(config = {}, snapshotInterval = 10) {
        this.signalGenerator = new SignalGenerator(config);
        this.snapshotInterval = snapshotInterval;
    }
    /**
     * Run calibration on a single signal
     */
    runSignal(signal, brain) {
        brain.reset();
        const snapshots = [];
        let bufferIndex = 0;
        let samplePosition = 0;
        // Process each buffer
        for (const buffer of signal.buffers) {
            brain.processBuffer(buffer);
            // Take snapshot at intervals
            if (bufferIndex % this.snapshotInterval === 0) {
                const metrics = brain.getMetrics();
                snapshots.push({
                    timestamp: samplePosition,
                    bufferIndex,
                    ...metrics
                });
            }
            bufferIndex++;
            samplePosition += buffer.length;
        }
        // Compute statistics
        return this.computeReport(signal, snapshots);
    }
    /**
     * Run calibration on all standard signals
     */
    runAllSignals(brain) {
        const signals = this.signalGenerator.generateAllStandardSignals();
        const reports = [];
        for (const signal of signals) {
            console.log(`[CalibrationRunner] Processing: ${signal.name}`);
            const report = this.runSignal(signal, brain);
            reports.push(report);
        }
        return this.generateCalibrationReport(reports, signals[0].config);
    }
    /**
     * Compute statistics from snapshots
     */
    computeReport(signal, snapshots) {
        const stats = {
            energy: this.computeStats(snapshots.map(s => s.normalizedEnergy)),
            harshness: this.computeStats(snapshots.map(s => s.harshness)),
            bassEnergy: this.computeStats(snapshots.map(s => s.bassEnergy)),
            midEnergy: this.computeStats(snapshots.map(s => s.midEnergy)),
            highEnergy: this.computeStats(snapshots.map(s => s.highEnergy)),
            spectralFlatness: this.computeStats(snapshots.map(s => s.spectralFlatness)),
            energyZScore: this.computeStats(snapshots.map(s => s.energyZScore))
        };
        // Find peak moments
        const maxEnergySnapshot = this.findMax(snapshots, s => s.normalizedEnergy);
        const maxHarshnessSnapshot = this.findMax(snapshots, s => s.harshness);
        const maxZScoreSnapshot = this.findMax(snapshots, s => Math.abs(s.energyZScore));
        const maxBassSnapshot = this.findMax(snapshots, s => s.bassEnergy);
        // Count detections
        const kickCount = snapshots.filter(s => s.kickDetected).length;
        const snareCount = snapshots.filter(s => s.snareDetected).length;
        const dropBridgeTriggers = snapshots.filter(s => s.dropBridgeTriggered).length;
        const fuzzyStrikes = snapshots.filter(s => s.fuzzyAction === 'strike' || s.fuzzyAction === 'force_strike').length;
        const fuzzyHolds = snapshots.filter(s => s.fuzzyAction === 'hold').length;
        // Section distribution
        const sectionCounts = {};
        for (const snapshot of snapshots) {
            sectionCounts[snapshot.sectionType] = (sectionCounts[snapshot.sectionType] || 0) + 1;
        }
        const totalSnapshots = snapshots.length;
        const sectionDistribution = {};
        for (const [section, count] of Object.entries(sectionCounts)) {
            sectionDistribution[section] = count / totalSnapshots;
        }
        return {
            signalName: signal.name,
            description: signal.description,
            duration: signal.config.duration,
            sampleRate: signal.config.sampleRate,
            buffersProcessed: signal.buffers.length,
            stats,
            peaks: {
                maxEnergy: maxEnergySnapshot,
                maxHarshness: maxHarshnessSnapshot,
                maxZScore: maxZScoreSnapshot,
                maxBass: maxBassSnapshot
            },
            detections: {
                kickCount,
                snareCount,
                dropBridgeTriggers,
                fuzzyStrikes,
                fuzzyHolds
            },
            sectionDistribution,
            snapshots
        };
    }
    /**
     * Compute statistical summary
     */
    computeStats(values) {
        if (values.length === 0) {
            return { min: 0, max: 0, avg: 0, stdDev: 0, p10: 0, p50: 0, p90: 0 };
        }
        const sorted = [...values].sort((a, b) => a - b);
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
        const stdDev = Math.sqrt(variance);
        return {
            min: sorted[0],
            max: sorted[sorted.length - 1],
            avg,
            stdDev,
            p10: sorted[Math.floor(values.length * 0.1)],
            p50: sorted[Math.floor(values.length * 0.5)],
            p90: sorted[Math.floor(values.length * 0.9)]
        };
    }
    /**
     * Find snapshot with maximum value
     */
    findMax(snapshots, getter) {
        let maxSnapshot = snapshots[0];
        let maxValue = getter(maxSnapshot);
        for (const snapshot of snapshots) {
            const value = getter(snapshot);
            if (value > maxValue) {
                maxValue = value;
                maxSnapshot = snapshot;
            }
        }
        return maxSnapshot;
    }
    /**
     * Generate cross-signal analysis report
     */
    generateCalibrationReport(reports, config) {
        // Find specific signals
        const silence = reports.find(r => r.signalName === 'SILENCE');
        const techno = reports.find(r => r.signalName.includes('TECHNO_KICK'));
        const whiteNoise = reports.find(r => r.signalName === 'WHITE_NOISE');
        const drop = reports.find(r => r.signalName === 'THE_DROP');
        const recommendations = [];
        // Analyze silence baseline
        const silenceBaseline = silence?.stats.energy.avg ?? 0;
        if (silenceBaseline > 0.05) {
            recommendations.push({
                parameter: 'SILENCE_THRESHOLD',
                currentValue: 0.01,
                suggestedValue: silenceBaseline * 1.5,
                reasoning: `Silence produces ${silenceBaseline.toFixed(3)} energy. Threshold should be above this.`
            });
        }
        // Analyze Z-Score from drop
        const dropMaxZScore = drop?.stats.energyZScore.max ?? 0;
        if (dropMaxZScore < 3.0) {
            recommendations.push({
                parameter: 'EPIC_ZSCORE_THRESHOLD',
                currentValue: 3.0,
                suggestedValue: dropMaxZScore * 0.85,
                reasoning: `"The Drop" only reaches Z-Score of ${dropMaxZScore.toFixed(2)}. Threshold should be lower to detect epic moments.`
            });
        }
        // Harshness comparison
        const technoHarshness = techno?.stats.harshness.avg ?? 0;
        const whiteNoiseHarshness = whiteNoise?.stats.harshness.avg ?? 0;
        if (whiteNoiseHarshness < technoHarshness * 1.5) {
            recommendations.push({
                parameter: 'HARSHNESS_DETECTION',
                currentValue: 0.5,
                suggestedValue: (technoHarshness + whiteNoiseHarshness) / 2,
                reasoning: `White noise (${whiteNoiseHarshness.toFixed(2)}) should be much harsher than techno (${technoHarshness.toFixed(2)}). Check harshness algorithm.`
            });
        }
        return {
            timestamp: new Date().toISOString(),
            config,
            signals: reports,
            analysis: {
                silenceBaseline,
                technoMaxEnergy: techno?.stats.energy.max ?? 0,
                dropMaxZScore,
                whiteNoiseHarshness,
                technoHarshness,
                recommendations
            }
        };
    }
}
