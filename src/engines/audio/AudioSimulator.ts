/**
 * AudioSimulator.ts
 * 🎵 Simulador de audio para testing sin micrófono
 * 
 * Genera beats y frecuencias sintéticas para probar
 * la sincronización de luces sin hardware de audio
 */

import { AudioFrame } from './index.js';

export class AudioSimulator {
  private startTime: number;
  private bpm: number;
  private beatInterval: number;
  private lastBeatTime: number = 0;

  constructor(bpm: number = 128) {
    this.startTime = Date.now();
    this.bpm = bpm;
    this.beatInterval = 60000 / bpm; // ms entre beats
  }

  /**
   * Genera un frame de audio sintético
   */
  async getFrame(): Promise<AudioFrame> {
    const now = Date.now();
    const elapsed = now - this.startTime;
    
    // Calcular si hay beat en este frame
    const timeSinceLastBeat = now - this.lastBeatTime;
    const shouldBeat = timeSinceLastBeat >= this.beatInterval;
    
    if (shouldBeat) {
      this.lastBeatTime = now;
    }

    // Generar frecuencias sintéticas con variación
    // Usamos funciones sinusoidales para simular música
    const time = elapsed / 1000; // segundos

    // Bass: Frecuencia baja, picos en beats
    const bassWave = Math.sin(time * 2) * 0.5 + 0.5;
    const bass = shouldBeat ? 0.9 : bassWave * 0.6;

    // Mid: Frecuencia media, más constante
    const midWave = Math.sin(time * 4 + 1) * 0.3 + 0.5;
    const mid = midWave * 0.7;

    // Treble: Frecuencia alta, rápida
    const trebleWave = Math.sin(time * 8 + 2) * 0.4 + 0.4;
    const treble = trebleWave * 0.5;

    // RMS global
    const rms = (bass + mid + treble) / 3;

    // Beat strength varía con cada beat
    const beatStrength = shouldBeat ? 0.7 + Math.random() * 0.3 : 0;

    return {
      timestamp: now,
      bass: Math.min(1, Math.max(0, bass)),
      mid: Math.min(1, Math.max(0, mid)),
      treble: Math.min(1, Math.max(0, treble)),
      beat: shouldBeat,
      beatStrength,
      bpm: this.bpm,
      bpmConfidence: 1.0,
      rms: Math.min(1, Math.max(0, rms)),
    };
  }

  /**
   * Cambia el BPM de la simulación
   */
  setBPM(bpm: number): void {
    this.bpm = bpm;
    this.beatInterval = 60000 / bpm;
  }

  /**
   * Reinicia el simulador
   */
  reset(): void {
    this.startTime = Date.now();
    this.lastBeatTime = 0;
  }
}
