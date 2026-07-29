/**
 * 🩻 GOD EAR OFFLINE CALIBRATOR
 * WAVE 8004 — Processes .wav samples through GodEarAnalyzer and extracts
 * peak telemetry values for statistical calibration across genres.
 *
 * Usage:
 *   npx ts-node scripts/GodEarCalibrator.ts --dir ./samples/test
 *   npx ts-node scripts/GodEarCalibrator.ts --dir ./samples/test --out ./calibration_results.json
 *
 * Dependency:
 *   npm i -D node-wav
 *
 * Output:
 *   JSON file mapping { "filename.wav": { peaks } }
 */

import * as fs from 'fs';
import * as path from 'path';
import { GodEarAnalyzer, GodEarTelemetry } from '../src/workers/GodEarFFT.ts';

// ─── Dual Logger (console + file) ────────────────────────────────────────────
const LOG_PATH = path.join(process.cwd(), 'calibrator_log.txt');
const logLines: string[] = [];
function log(msg: string): void {
  console.log(msg);
  logLines.push(msg);
  fs.writeFileSync(LOG_PATH, logLines.join('\n'));
}
function logError(msg: string): void {
  console.error(msg);
  logLines.push(msg);
  fs.writeFileSync(LOG_PATH, logLines.join('\n'));
}

// ─── WAV Decoding ───────────────────────────────────────────────────────────
// Minimal WAV parser: reads 16/24/32-bit PCM or Float32, downmixes to mono.
// Avoids external dependency on node-wav for maximum portability.

interface WavData {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  samples: Float32Array; // mono
}

function decodeWav(filePath: string): WavData {
  const buf = fs.readFileSync(filePath);

  // RIFF header
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error(`Not a RIFF file: ${filePath}`);
  if (buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`Not a WAVE file: ${filePath}`);

  let offset = 12;
  let fmtChunk: { sampleRate: number; channels: number; bitsPerSample: number; audioFormat: number } | null = null;
  let dataOffset = 0;
  let dataLength = 0;

  while (offset < buf.length - 8) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (chunkId === 'fmt ') {
      const audioFormat = buf.readUInt16LE(chunkStart);
      const channels = buf.readUInt16LE(chunkStart + 2);
      const sampleRate = buf.readUInt32LE(chunkStart + 4);
      const bitsPerSample = buf.readUInt16LE(chunkStart + 14);
      fmtChunk = { audioFormat, channels, sampleRate, bitsPerSample };
    } else if (chunkId === 'data') {
      dataOffset = chunkStart;
      dataLength = chunkSize;
    }

    offset = chunkStart + chunkSize + (chunkSize % 2); // pad to even
  }

  if (!fmtChunk) throw new Error(`Missing fmt chunk: ${filePath}`);
  if (dataOffset === 0) throw new Error(`Missing data chunk: ${filePath}`);

  const { sampleRate, channels, bitsPerSample, audioFormat } = fmtChunk;
  const bytesPerSample = bitsPerSample / 8;
  const totalFrames = Math.floor(dataLength / (bytesPerSample * channels));
  const mono = new Float32Array(totalFrames);

  for (let i = 0; i < totalFrames; i++) {
    let sum = 0;
    for (let ch = 0; ch < channels; ch++) {
      const sampleOffset = dataOffset + (i * channels + ch) * bytesPerSample;
      let sample = 0;
      if (audioFormat === 3) {
        // IEEE Float32
        sample = buf.readFloatLE(sampleOffset);
      } else if (bitsPerSample === 16) {
        sample = buf.readInt16LE(sampleOffset) / 32768;
      } else if (bitsPerSample === 24) {
        const b0 = buf.readUInt8(sampleOffset);
        const b1 = buf.readUInt8(sampleOffset + 1);
        const b2 = buf.readInt8(sampleOffset + 2);
        sample = ((b2 << 16) | (b1 << 8) | b0) / 8388608;
      } else if (bitsPerSample === 32) {
        sample = buf.readInt32LE(sampleOffset) / 2147483648;
      }
      sum += sample;
    }
    mono[i] = sum / channels;
  }

  return { sampleRate, channels, bitsPerSample, samples: mono };
}

// ─── Peak Aggregator ────────────────────────────────────────────────────────

interface PeakResult {
  scaledKick: number;
  scaledHighs: number;
  transientDensity: number;
  spectralFluxV3: number;
  strobeDrive: number;
  strobeDriveRaw: number;
  chromaFlux: number;
  flatness: number;
  whiteNoiseScore: number;
}

function processFile(
  analyzer: GodEarAnalyzer,
  wav: WavData,
  fftSize: number
): PeakResult {
  const peaks: PeakResult = {
    scaledKick: 0,
    scaledHighs: 0,
    transientDensity: 0,
    spectralFluxV3: 0,
    strobeDrive: 0,
    strobeDriveRaw: 0,
    chromaFlux: 0,
    flatness: 0,
    whiteNoiseScore: 0,
  };

  // Zero-padding: if samples < fftSize, pad with silence to reach exactly fftSize.
  // Critical for ultra-short samples (hi-hats, snares) that are shorter than one chunk.
  let samples = wav.samples;
  if (samples.length < fftSize) {
    const padded = new Float32Array(fftSize);
    padded.set(samples);
    // remaining bytes are already 0 (silence)
    samples = padded;
  }

  const totalChunks = Math.floor(samples.length / fftSize);

  // Audio-domain frame time — NOT wall-clock. One chunk of `fftSize` samples at
  // `sampleRate` represents this many milliseconds of real audio. Required so
  // time-based metrics (transientDensity sliding window) are measured against
  // the audio timeline instead of CPU speed.
  const audioDeltaMs = (fftSize / wav.sampleRate) * 1000;

  for (let chunk = 0; chunk < totalChunks; chunk++) {
    const start = chunk * fftSize;
    const buffer = samples.subarray(start, start + fftSize);

    analyzer.analyze(buffer, audioDeltaMs);
    const t = analyzer.getTelemetry();
    if (!t) continue;

    if (t.levels.scaledKick > peaks.scaledKick) peaks.scaledKick = t.levels.scaledKick;
    if (t.levels.scaledHighs > peaks.scaledHighs) peaks.scaledHighs = t.levels.scaledHighs;
    if (t.metrics.transientDensity > peaks.transientDensity) peaks.transientDensity = t.metrics.transientDensity;
    if (t.metrics.spectralFluxV3 > peaks.spectralFluxV3) peaks.spectralFluxV3 = t.metrics.spectralFluxV3;
    if (t.strobe.drive > peaks.strobeDrive) peaks.strobeDrive = t.strobe.drive;
    if (t.strobe.driveRaw > peaks.strobeDriveRaw) peaks.strobeDriveRaw = t.strobe.driveRaw;
    if (t.chroma.chromaFlux > peaks.chromaFlux) peaks.chromaFlux = t.chroma.chromaFlux;
    if (t.metrics.flatness > peaks.flatness) peaks.flatness = t.metrics.flatness;
    if (t.metrics.whiteNoiseScore > peaks.whiteNoiseScore) peaks.whiteNoiseScore = t.metrics.whiteNoiseScore;
  }

  return peaks;
}

// ─── CLI Entry Point ────────────────────────────────────────────────────────

function parseArgs(): { dir: string; out: string; batch: boolean; outDir: string } {
  const args = process.argv.slice(2);
  let dir = './samples/test';
  let out = './calibration_results.json';
  let batch = false;
  let outDir = './calibration';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && args[i + 1]) dir = args[i + 1];
    if (args[i] === '--out' && args[i + 1]) out = args[i + 1];
    if (args[i] === '--batch') batch = true;
    if (args[i] === '--outDir' && args[i + 1]) outDir = args[i + 1];
  }

  return { dir, out, batch, outDir };
}

async function processDirectory(
  analyzer: GodEarAnalyzer,
  dir: string,
  outFile: string,
  fftSize: number
): Promise<void> {
  if (!fs.existsSync(dir)) {
    logError(`[CALIBRATOR] ❌ Directory not found: ${dir}`);
    return;
  }

  const wavFiles = fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.wav'))
    .sort();

  if (wavFiles.length === 0) {
    logError(`[CALIBRATOR] ❌ No .wav files found in ${dir}`);
    return;
  }

  log(`[CALIBRATOR] Found ${wavFiles.length} .wav file(s) in ${path.basename(dir)}`);

  const results: Record<string, PeakResult> = {};

  for (const file of wavFiles) {
    const filePath = path.join(dir, file);
    try {
      const wav = decodeWav(filePath);
      const peaks = processFile(analyzer, wav, fftSize);
      results[file] = peaks;
      log(
        `[CALIBRATOR] ✅ ${file} | ${wav.samples.length} samples | ` +
        `kick=${peaks.scaledKick.toFixed(4)} ` +
        `highs=${peaks.scaledHighs.toFixed(4)} ` +
        `td=${peaks.transientDensity.toFixed(4)} ` +
        `flux=${peaks.spectralFluxV3.toFixed(4)} ` +
        `drive=${peaks.strobeDrive.toFixed(4)} ` +
        `dRaw=${peaks.strobeDriveRaw.toFixed(4)} ` +
        `cFlux=${peaks.chromaFlux.toFixed(4)} ` +
        `flat=${peaks.flatness.toFixed(4)} ` +
        `wns=${peaks.whiteNoiseScore.toFixed(4)}`
      );
    } catch (err) {
      log(`[CALIBRATOR] ❌ ${file}: ${(err as Error).message}`);
    }

    analyzer.reset();
  }

  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  log(`[CALIBRATOR] ✅ Results written to ${outFile}`);
  log('');
}

async function main() {
  const { dir, out, batch, outDir } = parseArgs();
  const fftSize = 4096;

  // Ensure output directory exists
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  log('');
  log('═══════════════════════════════════════════════════════════════');
  log('        🩻 GOD EAR OFFLINE CALIBRATOR - WAVE 8005 🩻         ');
  log('═══════════════════════════════════════════════════════════════');
  log(`  Input dir : ${dir}`);
  log(`  Output    : ${out}`);
  log(`  FFT size  : ${fftSize}`);
  log(`  Batch mode: ${batch ? 'YES' : 'NO'}`);
  log('');

  const analyzer = new GodEarAnalyzer(44100, fftSize);
  analyzer.setDebugMode(true);
  log(`[CALIBRATOR] Analyzer: ${analyzer.getInfo()}`);
  log(`[CALIBRATOR] Debug mode: ACTIVE`);
  log(`[CALIBRATOR] Zero-padding: ENABLED (samples < ${fftSize} padded with silence)`);
  log('');

  if (batch) {
    // Batch mode: iterate all subdirectories in the given dir.
    // JSON naming: parentDir_subDir.json (e.g. Hi_Hats_Acoustic.json)
    // Supports nested subdirs: walks recursively and names with full relative path.
    const parentName = path.basename(dir).replace(/\s+/g, '_');
    const subdirs = fs.readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort();

    if (subdirs.length === 0) {
      logError(`[CALIBRATOR] ❌ No subdirectories found in ${dir}`);
      process.exit(1);
    }

    log(`[CALIBRATOR] Batch: ${subdirs.length} subdirectories to process`);
    log(`[CALIBRATOR] Output dir: ${outDir}\n`);

    let processed = 0;
    for (const subdir of subdirs) {
      const subdirPath = path.join(dir, subdir);
      const cleanSub = subdir.replace(/\s+/g, '_');
      const outFile = path.join(outDir, `${parentName}_${cleanSub}.json`);
      log(`[CALIBRATOR] ═══ Processing: ${parentName}/${cleanSub} → ${path.basename(outFile)} ═══`);
      await processDirectory(analyzer, subdirPath, outFile, fftSize);
      processed++;
    }

    log(`\n[CALIBRATOR] ✅ Batch complete. ${processed} JSON files generated in ${outDir}/`);
  } else {
    // Single directory mode
    const finalOut = path.join(outDir, out);
    await processDirectory(analyzer, dir, finalOut, fftSize);
  }

  log(`[CALIBRATOR] Log written to ${LOG_PATH}`);
  log('');
}

main().catch(err => {
  logError(`[CALIBRATOR] Fatal error: ${err}`);
  process.exit(1);
});
