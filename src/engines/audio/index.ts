/**
 * 🎵 AUDIO ENGINE - INDEX
 * 
 * Análisis de audio en tiempo real para LuxSync
 * Integra: AudioCapture + BeatDetector + FFTAnalyzer
 */

import { AudioCapture, AudioBuffer } from './AudioCapture.js';
import { BeatDetector, BeatEvent } from './BeatDetector.js';
import { FFTAnalyzer, FrequencyBands } from './FFTAnalyzer.js';

export interface AudioFrame {
  timestamp: number;        // Unix timestamp (ms)
  
  // Frequency analysis (FFT)
  bass: number;             // 0-1 (20-250 Hz)
  mid: number;              // 0-1 (250-4000 Hz)
  treble: number;           // 0-1 (4000-20000 Hz)
  
  // Beat detection
  beat: boolean;            // True si hay beat en este frame
  beatStrength: number;     // 0-1 (fuerza del beat)
  
  // Tempo tracking
  bpm: number;              // Beats per minute (estimado)
  bpmConfidence: number;    // 0-1 (confianza en el BPM)
  
  // RMS (volumen general)
  rms: number;              // 0-1 (Root Mean Square)
  
  // Spectral features (optional)
  spectralCentroid?: number;
  spectralRolloff?: number;
  zcr?: number;             // Zero Crossing Rate
}

export class AudioEngine {
  private audioCapture: AudioCapture;
  private beatDetector: BeatDetector;
  private fftAnalyzer: FFTAnalyzer | null = null;
  
  private currentFrame: AudioFrame;
  private isRunning: boolean = false;

  constructor() {
    this.audioCapture = new AudioCapture({
      sampleRate: 44100,
      bufferSize: 2048,
      channels: 1,
    });

    this.beatDetector = new BeatDetector({
      threshold: 0.3,
      minBeatInterval: 250,
      adaptiveThreshold: true,
    });

    // Frame inicial
    this.currentFrame = {
      timestamp: Date.now(),
      bass: 0,
      mid: 0,
      treble: 0,
      beat: false,
      beatStrength: 0,
      bpm: 0,
      bpmConfidence: 0,
      rms: 0,
    };
  }

  async initialize(): Promise<void> {
    console.log('🎵 [AudioEngine] Inicializando...');

    try {
      // Inicializar captura de audio
      await this.audioCapture.initialize();

      // Obtener analyser node para FFT
      const analyserNode = this.audioCapture.getAnalyserNode();
      if (!analyserNode) {
        throw new Error('No se pudo obtener AnalyserNode');
      }

      // Inicializar FFT analyzer
      this.fftAnalyzer = new FFTAnalyzer(analyserNode, {
        fftSize: 2048,
        smoothingTimeConstant: 0.8,
      });

      // Escuchar eventos de audio
      this.audioCapture.on('audio', (buffer: AudioBuffer) => {
        this.processAudioBuffer(buffer);
      });

      this.isRunning = true;
      console.log('✅ [AudioEngine] Listo - Capturando audio');

    } catch (error) {
      console.error('❌ [AudioEngine] Error en inicialización:', error);
      throw error;
    }
  }

  /**
   * Procesa cada buffer de audio entrante
   */
  private processAudioBuffer(buffer: AudioBuffer): void {
    if (!this.fftAnalyzer || !this.isRunning) return;

    // 1. Análisis FFT (bandas de frecuencia)
    const bands: FrequencyBands | null = this.fftAnalyzer.analyze();
    if (!bands) return;

    // 2. Detección de beats
    const beatEvent: BeatEvent | null = this.beatDetector.detect(
      buffer.samples,
      buffer.timestamp
    );

    // 3. Actualizar frame actual
    this.currentFrame = {
      timestamp: buffer.timestamp,
      bass: bands.bass,
      mid: bands.mid,
      treble: bands.treble,
      beat: beatEvent !== null,
      beatStrength: beatEvent?.strength || 0,
      bpm: beatEvent?.bpm || this.beatDetector.getBPM(),
      bpmConfidence: beatEvent?.confidence || 0,
      rms: bands.rms,
    };

    // Log de beats (solo para debug en desarrollo)
    if (beatEvent && process.env.DEBUG_BEATS === 'true') {
      console.log(`🥁 BEAT! Strength: ${beatEvent.strength.toFixed(2)} | BPM: ${beatEvent.bpm || 0}`);
    }
  }

  /**
   * Obtiene el frame de audio más reciente
   */
  async getFrame(): Promise<AudioFrame> {
    return { ...this.currentFrame }; // Copiar para evitar mutación
  }

  /**
   * Ajusta la sensibilidad del detector de beats
   */
  setBeatSensitivity(threshold: number): void {
    this.beatDetector.setThreshold(threshold);
    console.log(`🎛️  [AudioEngine] Sensibilidad de beat ajustada a ${threshold}`);
  }

  /**
   * Obtiene estadísticas del motor de audio
   */
  getStats() {
    return {
      ...this.beatDetector.getStats(),
      currentFrame: this.currentFrame,
    };
  }

  /**
   * Pausa el procesamiento de audio
   */
  pause(): void {
    this.audioCapture.pause();
    this.isRunning = false;
    console.log('⏸️  [AudioEngine] Pausado');
  }

  /**
   * Reanuda el procesamiento de audio
   */
  resume(): void {
    this.audioCapture.resume();
    this.isRunning = true;
    console.log('▶️  [AudioEngine] Reanudado');
  }

  async close(): Promise<void> {
    this.isRunning = false;
    await this.audioCapture.close();
    this.beatDetector.reset();
    console.log('🛑 [AudioEngine] Cerrado');
  }
}
