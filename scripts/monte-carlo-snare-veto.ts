/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 7749 — MONTE CARLO: SNARE VETO HYPERPLANE CALIBRATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Offline batch runner that processes the Architect's 28GB stem dataset
 * through GodEarFFT V3 + LiquidEngineBase to capture the 5 veto-relevant
 * metrics per frame (snare_energy, flatness, whiteNoiseScore, spectralFlux,
 * spectralCentroid) plus hybridSnare output.
 *
 * OUTPUT: monte_carlo_snare_veto.jsonl — one JSON record per audio frame,
 *         with a `label` field derived from the directory structure:
 *           stems/snare/*.wav    → label='snare'
 *           stems/vocal/*.wav    → label='vocal'
 *           stems/synth/*.wav    → label='synth'
 *           stems/bass/*.wav     → label='bass'
 *           stems/mix/*.wav      → label='mix'
 *
 * POST-PROCESSING: Run analyze_snare_veto_hyperplane.py (scikit-learn SVM)
 *                  to find the exact threshold hyperplane.
 *
 * USAGE:
 *   npx tsx scripts/monte-carlo-snare-veto.ts --stemsDir <path> --output <path>
 *
 * ZERO-ALLOC in the engine hot path. This script itself is NOT zero-alloc
 * (it's offline, not real-time) but it exercises the zero-alloc engine.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, dirname, basename, extname, resolve } from 'path'
import { fileURLToPath } from 'url'

// ─────────────────────────────────────────────────────────────────────
// CLI ARGS
// ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
let stemsDir = ''
let outputFile = ''

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--stemsDir' && args[i + 1]) stemsDir = resolve(args[i + 1])
  if (args[i] === '--output' && args[i + 1]) outputFile = resolve(args[i + 1])
}

if (!stemsDir || !outputFile) {
  console.error('Usage: npx tsx scripts/monte-carlo-snare-veto.ts --stemsDir <path> --output <path>')
  console.error('  --stemsDir  Directory containing stem subdirectories (snare/, vocal/, synth/, bass/, mix/)')
  console.error('  --output    Path for the output JSONL file')
  process.exit(1)
}

if (!existsSync(stemsDir)) {
  console.error(`Stems directory not found: ${stemsDir}`)
  process.exit(1)
}

// ─────────────────────────────────────────────────────────────────────
// WAV LOADER — Minimal PCM 16/24/32-bit + Float32 reader
// ─────────────────────────────────────────────────────────────────────

interface WavData {
  sampleRate: number
  channels: number
  samples: Float32Array  // mono-mixed if multichannel
}

function loadWav(filePath: string): WavData | null {
  const buf = readFileSync(filePath)
  if (buf.length < 44) return null

  // RIFF header
  if (buf.toString('ascii', 0, 4) !== 'RIFF') return null
  if (buf.toString('ascii', 8, 12) !== 'WAVE') return null

  let offset = 12
  let sampleRate = 44100
  let channels = 1
  let bitsPerSample = 16
  let audioData: Buffer | null = null

  while (offset < buf.length - 8) {
    const chunkId = buf.toString('ascii', offset, offset + 4)
    const chunkSize = buf.readUInt32LE(offset + 4)

    if (chunkId === 'fmt ') {
      channels = buf.readUInt16LE(offset + 10)
      sampleRate = buf.readUInt32LE(offset + 12)
      bitsPerSample = buf.readUInt16LE(offset + 22)
    } else if (chunkId === 'data') {
      audioData = buf.subarray(offset + 8, offset + 8 + chunkSize)
      break
    }

    offset += 8 + chunkSize
  }

  if (!audioData) return null

  const numSamples = Math.floor(audioData.length / (bitsPerSample / 8 * channels))
  const samples = new Float32Array(numSamples)

  for (let i = 0; i < numSamples; i++) {
    let sum = 0
    for (let ch = 0; ch < channels; ch++) {
      const byteOffset = (i * channels + ch) * (bitsPerSample / 8)
      let val: number
      if (bitsPerSample === 16) {
        val = audioData.readInt16LE(byteOffset) / 32768
      } else if (bitsPerSample === 24) {
        const b0 = audioData[byteOffset]
        const b1 = audioData[byteOffset + 1]
        const b2 = audioData[byteOffset + 2]
        val = ((b2 << 16) | (b1 << 8) | b0) / 8388608
        if (val > 1) val -= 2  // sign extend
      } else if (bitsPerSample === 32) {
        // Could be int32 or float32 — try float32 first
        val = audioData.readFloat32LE(byteOffset)
        if (Math.abs(val) > 100) {
          // It was int32
          val = audioData.readInt32LE(byteOffset) / 2147483648
        }
      } else {
        val = 0
      }
      sum += val
    }
    samples[i] = sum / channels
  }

  return { sampleRate, channels, samples }
}

// ─────────────────────────────────────────────────────────────────────
// RECURSIVE WAV FINDER
// ─────────────────────────────────────────────────────────────────────

function findWavs(dir: string): string[] {
  const results: string[] = []
  const entries = readdirSync(dir)
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      results.push(...findWavs(fullPath))
    } else if (extname(entry).toLowerCase() === '.wav') {
      results.push(fullPath)
    }
  }
  return results
}

// ─────────────────────────────────────────────────────────────────────
// LABEL EXTRACTOR — Keyword-based classification from full path.
// Searches the entire recursive path for keywords, so stems can be
// organized in any subfolder structure without needing flat dirs.
// ─────────────────────────────────────────────────────────────────────

function extractLabel(_stemsRoot: string, filePath: string): string {
  // En lugar de leer el nombre exacto de la carpeta, buscamos palabras
  // clave en la ruta completa. Esto permite estructuras recursivas arbitrarias.
  let label = 'mix' // por defecto
  const normalizedPath = filePath.toLowerCase()

  if (normalizedPath.includes('snare') || normalizedPath.includes('hat') || normalizedPath.includes('clap')) {
    label = 'snare'
  } else if (normalizedPath.includes('piano') || normalizedPath.includes('pad') || normalizedPath.includes('synth')) {
    label = 'synth'
  } else if (normalizedPath.includes('vocal') || normalizedPath.includes('choir') || normalizedPath.includes('acapella')) {
    label = 'vocal'
  } else if (normalizedPath.includes('bass') || normalizedPath.includes('808')) {
    label = 'bass'
  }

  return label
}

// ─────────────────────────────────────────────────────────────────────
// MAIN — Process all stems through the engine
// ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[WAVE 7749] Monte Carlo Snare Veto Calibration`)
  console.log(`  Stems dir: ${stemsDir}`)
  console.log(`  Output:    ${outputFile}`)

  const wavFiles = findWavs(stemsDir)
  console.log(`  Found ${wavFiles.length} WAV files`)

  if (wavFiles.length === 0) {
    console.error('No WAV files found in stems directory')
    process.exit(1)
  }

  // Ensure output directory exists
  const outDir = dirname(outputFile)
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  // Dynamic imports — avoid loading the engine if we can't find files
  const { GodEarAnalyzer } = await import('../electron-app/src/workers/GodEarFFT')
  const { LiquidEngine71 } = await import('../electron-app/src/hal/physics/LiquidEngine71')
  const { TECHNO_PROFILE } = await import('../electron-app/src/hal/physics/profiles/techno')
  const { LiquidTelemetryObserver } = await import('../electron-app/src/hal/physics/LiquidTelemetryObserver')

  const FFT_SIZE = 4096
  const SAMPLE_RATE = 44100
  const analyzer = new GodEarAnalyzer(SAMPLE_RATE, FFT_SIZE)
  const engine = new LiquidEngine71(TECHNO_PROFILE)
  const observer = new LiquidTelemetryObserver()
  observer.setEngine(engine)
  observer.setTelemetryEnabled(true)

  const frameSize = FFT_SIZE
  const hopSize = frameSize  // No overlap for calibration

  // Open output stream
  const lines: string[] = []
  let totalFrames = 0
  let filesProcessed = 0
  let filesFailed = 0

  for (const wavPath of wavFiles) {
    const label = extractLabel(stemsDir, wavPath)
    const fileName = basename(wavPath)
    process.stdout.write(`  [${filesProcessed + filesFailed + 1}/${wavFiles.length}] ${label}/${fileName} ... `)

    try {
      const wav = loadWav(wavPath)
      if (!wav) {
        console.log('SKIP (invalid WAV header)')
        filesFailed++
        continue
      }

      const deltaMs = (frameSize / wav.sampleRate) * 1000
      let frameCount = 0

      for (let i = 0; i + frameSize <= wav.samples.length; i += hopSize) {
        const frame = wav.samples.subarray(i, i + frameSize)

        // Analyze with GodEarFFT V3
        const spectrum = analyzer.analyze(frame, deltaMs)

        // Build LiquidStereoInput from spectrum
        const input: any = {
          bands: spectrum.bands,
          isRealSilence: false,
          isAGCTrap: false,
          harshness: spectrum.bands.highMid,
          flatness: spectrum.spectral.flatness,
          spectralCentroid: spectrum.spectral.centroid,
          isKick: false,
          sectionType: 'drop' as const,
          snare_energy: spectrum.rhythmic?.snare_energy,
          hh_energy: spectrum.rhythmic?.hh_energy,
          photon: spectrum.photon,
        }

        // Capture photon before engine processes
        observer.capturePhoton(input)

        // Run the engine
        const result = engine.applyBands(input)

        // Capture telemetry
        observer.capture(input, result)

        frameCount++
        totalFrames++
      }

      // Dump this stem's frames with label
      const records = observer.getBuffer()
      for (const r of records) {
        lines.push(JSON.stringify({ ...r, label, file: fileName }))
      }
      observer.flushBuffer()

      engine.reset()
      console.log(`${frameCount} frames`)
      filesProcessed++
    } catch (err) {
      console.log(`ERROR (${(err as Error).message})`)
      filesFailed++
      // Reset engine state in case of mid-file crash
      try { engine.reset() } catch {}
      try { observer.flushBuffer() } catch {}
    }
  }

  // Write all lines to JSONL
  writeFileSync(outputFile, lines.join('\n') + '\n', 'utf-8')

  console.log(`\n[DONE] ${filesProcessed} files succeeded, ${filesFailed} failed, ${totalFrames} frames, ${lines.length} records`)
  console.log(`  Output: ${outputFile}`)
  console.log(`\nNext step: Run analyze_snare_veto_hyperplane.py to find the SVM hyperplane`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
