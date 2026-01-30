/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║         CALIBRATION REPORT - THE TRUTH DOCUMENT               ║
 * ║                                                               ║
 * ║  "Numbers don't lie. Algorithms do."                          ║
 * ║                                                               ║
 * ║  Generates human-readable and machine-parseable reports       ║
 * ║  from calibration runs.                                       ║
 * ╚═══════════════════════════════════════════════════════════════╝
 *
 * WAVE 670.5 - THE SELENE LAB
 */
/**
 * Formats a calibration report as Markdown
 */
export function formatReportAsMarkdown(report) {
    const lines = [];
    lines.push('# 🔬 SELENE LAB - CALIBRATION REPORT');
    lines.push('');
    lines.push(`**Generated:** ${report.timestamp}`);
    lines.push(`**Sample Rate:** ${report.config.sampleRate} Hz`);
    lines.push(`**Buffer Size:** ${report.config.bufferSize}`);
    lines.push(`**Duration per signal:** ${report.config.duration}s`);
    lines.push('');
    // Cross-signal analysis
    lines.push('## 📊 CROSS-SIGNAL ANALYSIS');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Silence Baseline Energy | ${report.analysis.silenceBaseline.toFixed(4)} |`);
    lines.push(`| Techno Max Energy | ${report.analysis.technoMaxEnergy.toFixed(4)} |`);
    lines.push(`| Drop Max Z-Score | ${report.analysis.dropMaxZScore.toFixed(2)} |`);
    lines.push(`| White Noise Harshness | ${report.analysis.whiteNoiseHarshness.toFixed(4)} |`);
    lines.push(`| Techno Harshness | ${report.analysis.technoHarshness.toFixed(4)} |`);
    lines.push('');
    // Recommendations
    if (report.analysis.recommendations.length > 0) {
        lines.push('## ⚠️ THRESHOLD RECOMMENDATIONS');
        lines.push('');
        for (const rec of report.analysis.recommendations) {
            lines.push(`### ${rec.parameter}`);
            lines.push(`- **Current:** ${rec.currentValue}`);
            lines.push(`- **Suggested:** ${rec.suggestedValue.toFixed(4)}`);
            lines.push(`- **Reason:** ${rec.reasoning}`);
            lines.push('');
        }
    }
    // Individual signal reports
    lines.push('## 📈 SIGNAL REPORTS');
    lines.push('');
    for (const signal of report.signals) {
        lines.push(formatSignalReport(signal));
        lines.push('');
        lines.push('---');
        lines.push('');
    }
    return lines.join('\n');
}
/**
 * Format a single signal report
 */
function formatSignalReport(signal) {
    const lines = [];
    lines.push(`### 🎵 ${signal.signalName}`);
    lines.push('');
    lines.push(`*${signal.description}*`);
    lines.push('');
    lines.push(`- **Duration:** ${signal.duration}s`);
    lines.push(`- **Buffers Processed:** ${signal.buffersProcessed}`);
    lines.push('');
    // Statistics table
    lines.push('#### Statistics');
    lines.push('');
    lines.push('| Metric | Min | Max | Avg | StdDev | P50 |');
    lines.push('|--------|-----|-----|-----|--------|-----|');
    lines.push(formatStatRow('Energy', signal.stats.energy));
    lines.push(formatStatRow('Harshness', signal.stats.harshness));
    lines.push(formatStatRow('Bass', signal.stats.bassEnergy));
    lines.push(formatStatRow('Mids', signal.stats.midEnergy));
    lines.push(formatStatRow('Highs', signal.stats.highEnergy));
    lines.push(formatStatRow('Flatness', signal.stats.spectralFlatness));
    lines.push(formatStatRow('Z-Score', signal.stats.energyZScore));
    lines.push('');
    // Detection counts
    lines.push('#### Detections');
    lines.push('');
    lines.push(`- **Kicks:** ${signal.detections.kickCount}`);
    lines.push(`- **Snares:** ${signal.detections.snareCount}`);
    lines.push(`- **Drop Bridge Triggers:** ${signal.detections.dropBridgeTriggers}`);
    lines.push(`- **Fuzzy Strikes:** ${signal.detections.fuzzyStrikes}`);
    lines.push(`- **Fuzzy Holds:** ${signal.detections.fuzzyHolds}`);
    lines.push('');
    // Section distribution
    lines.push('#### Section Distribution');
    lines.push('');
    for (const [section, pct] of Object.entries(signal.sectionDistribution)) {
        const bar = '█'.repeat(Math.round(pct * 20));
        lines.push(`- **${section}:** ${(pct * 100).toFixed(1)}% ${bar}`);
    }
    // Peak moments
    lines.push('');
    lines.push('#### Peak Moments');
    lines.push('');
    lines.push(`- **Max Energy:** ${signal.peaks.maxEnergy.normalizedEnergy.toFixed(4)} @ buffer ${signal.peaks.maxEnergy.bufferIndex}`);
    lines.push(`- **Max Harshness:** ${signal.peaks.maxHarshness.harshness.toFixed(4)} @ buffer ${signal.peaks.maxHarshness.bufferIndex}`);
    lines.push(`- **Max Z-Score:** ${signal.peaks.maxZScore.energyZScore.toFixed(2)} @ buffer ${signal.peaks.maxZScore.bufferIndex}`);
    lines.push(`- **Max Bass:** ${signal.peaks.maxBass.bassEnergy.toFixed(4)} @ buffer ${signal.peaks.maxBass.bufferIndex}`);
    return lines.join('\n');
}
/**
 * Format a statistics row
 */
function formatStatRow(name, stats) {
    return `| ${name} | ${stats.min.toFixed(3)} | ${stats.max.toFixed(3)} | ${stats.avg.toFixed(3)} | ${stats.stdDev.toFixed(3)} | ${stats.p50.toFixed(3)} |`;
}
/**
 * Formats a calibration report as JSON (pretty printed)
 */
export function formatReportAsJSON(report) {
    // Create a slimmed down version without all snapshots for readability
    const slim = {
        timestamp: report.timestamp,
        config: report.config,
        analysis: report.analysis,
        signals: report.signals.map(s => ({
            name: s.signalName,
            description: s.description,
            stats: s.stats,
            peaks: {
                maxEnergy: s.peaks.maxEnergy.normalizedEnergy,
                maxEnergyBuffer: s.peaks.maxEnergy.bufferIndex,
                maxHarshness: s.peaks.maxHarshness.harshness,
                maxZScore: s.peaks.maxZScore.energyZScore,
                maxBass: s.peaks.maxBass.bassEnergy
            },
            detections: s.detections,
            sectionDistribution: s.sectionDistribution
        }))
    };
    return JSON.stringify(slim, null, 2);
}
/**
 * Formats a calibration report as a compact summary (for console)
 */
export function formatReportAsSummary(report) {
    const lines = [];
    lines.push('╔══════════════════════════════════════════════════════════════╗');
    lines.push('║            🔬 SELENE LAB - CALIBRATION SUMMARY              ║');
    lines.push('╠══════════════════════════════════════════════════════════════╣');
    for (const signal of report.signals) {
        const name = signal.signalName.padEnd(20);
        const energy = `E:${signal.stats.energy.avg.toFixed(2)}`;
        const harsh = `H:${signal.stats.harshness.avg.toFixed(2)}`;
        const zmax = `Z:${signal.stats.energyZScore.max.toFixed(1)}`;
        lines.push(`║  ${name} ${energy.padEnd(8)} ${harsh.padEnd(8)} ${zmax.padEnd(8)} ║`);
    }
    lines.push('╠══════════════════════════════════════════════════════════════╣');
    if (report.analysis.recommendations.length > 0) {
        lines.push('║  ⚠️  RECOMMENDATIONS:                                        ║');
        for (const rec of report.analysis.recommendations) {
            const text = `     ${rec.parameter}: ${rec.currentValue} → ${rec.suggestedValue.toFixed(2)}`;
            lines.push(`║${text.padEnd(62)}║`);
        }
    }
    else {
        lines.push('║  ✅ All thresholds within expected ranges                    ║');
    }
    lines.push('╚══════════════════════════════════════════════════════════════╝');
    return lines.join('\n');
}
/**
 * Generate ASCII visualization of energy over time
 */
export function generateEnergyGraph(signal, width = 60, height = 10) {
    const snapshots = signal.snapshots;
    if (snapshots.length === 0)
        return 'No data';
    const energyValues = snapshots.map(s => s.normalizedEnergy);
    const maxEnergy = Math.max(...energyValues, 0.001);
    // Downsample to fit width
    const step = Math.max(1, Math.floor(snapshots.length / width));
    const downsampled = [];
    for (let i = 0; i < width && i * step < snapshots.length; i++) {
        // Take max in each bucket
        const start = i * step;
        const end = Math.min(start + step, snapshots.length);
        let max = 0;
        for (let j = start; j < end; j++) {
            max = Math.max(max, energyValues[j]);
        }
        downsampled.push(max);
    }
    // Generate ASCII graph
    const lines = [];
    const chars = ' ▁▂▃▄▅▆▇█';
    for (let row = height - 1; row >= 0; row--) {
        const threshold = (row / height) * maxEnergy;
        let line = '│';
        for (const val of downsampled) {
            if (val >= threshold) {
                const intensity = Math.min(8, Math.floor((val / maxEnergy) * 8));
                line += chars[intensity];
            }
            else {
                line += ' ';
            }
        }
        lines.push(line);
    }
    lines.push('└' + '─'.repeat(width));
    lines.push(` ${signal.signalName} - Energy over time`);
    return lines.join('\n');
}
export default {
    formatReportAsMarkdown,
    formatReportAsJSON,
    formatReportAsSummary,
    generateEnergyGraph
};
