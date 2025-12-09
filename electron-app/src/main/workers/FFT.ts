/**
 * 🧮 WAVE 15: FFT MATEMÁTICO PURO - Cooley-Tukey Radix-2
 * 
 * Implementación de Fast Fourier Transform para análisis espectral REAL.
 * Sin librerías externas, sin simulaciones, matemática pura.
 * 
 * Para uso profesional en eventos de élite con iluminación y sonido.
 * 
 * @author GitHub Copilot (Claude) para GestIAdev
 * @version Wave 15 - "MATH IS TRUTH"
 */

// ============================================
// TIPOS
// ============================================

export interface ComplexNumber {
  real: number;
  imag: number;
}

export interface FFTResult {
  /** Magnitudes de cada bin de frecuencia (0 a N/2) */
  magnitudes: Float32Array;
  /** Frecuencia de cada bin en Hz */
  frequencies: Float32Array;
  /** Energía total del espectro */
  totalEnergy: number;
}

export interface BandEnergy {
  /** Energía en graves (20-250 Hz) */
  bass: number;
  /** Energía en medios-bajos (250-500 Hz) */
  lowMid: number;
  /** Energía en medios (500-2000 Hz) */
  mid: number;
  /** Energía en medios-altos (2000-4000 Hz) */
  highMid: number;
  /** Energía en agudos (4000-20000 Hz) */
  treble: number;
  /** Energía sub-bass (20-60 Hz) - importante para kicks */
  subBass: number;
  /** Frecuencia dominante en Hz */
  dominantFrequency: number;
  /** Centroide espectral (brillo tonal) */
  spectralCentroid: number;
}

// ============================================
// CONSTANTES DE FRECUENCIA (Hz)
// ============================================

const FREQ_BANDS = {
  SUB_BASS: { min: 20, max: 60 },      // Kicks profundos
  BASS: { min: 60, max: 250 },         // Graves
  LOW_MID: { min: 250, max: 500 },     // Medios-bajos
  MID: { min: 500, max: 2000 },        // Medios (voz, instrumentos)
  HIGH_MID: { min: 2000, max: 4000 },  // Medios-altos (presencia)
  TREBLE: { min: 4000, max: 20000 },   // Agudos (brillo, hi-hats)
} as const;

/**
 * COMPENSACIÓN DE RUIDO ROSA (Pink Noise Compensation)
 * 
 * La música real sigue un perfil de "ruido rosa" donde la energía
 * decrece aproximadamente 3 dB por octava a frecuencias más altas.
 * 
 * WAVE 15.5: Factores iniciales (causaban saturación mid=1.0)
 * WAVE 15.6: Factores recalibrados para evitar saturación
 * 
 * Objetivo: Señales de ~0.3-0.5 RawRMS deben dar bandas en rango 0.3-0.7
 */
const PINK_NOISE_COMPENSATION = {
  SUB_BASS: 12,    // Era 15 - Mucha energía natural
  BASS: 15,        // Era 20 - Base de referencia (reducido)
  LOW_MID: 25,     // Era 40 - Boost moderado
  MID: 35,         // Era 70 - REDUCIDO para evitar saturación
  HIGH_MID: 60,    // Era 120 - Reducido a la mitad
  TREBLE: 100,     // Era 200 - Reducido a la mitad
} as const;

// ============================================
// FFT IMPLEMENTATION - COOLEY-TUKEY RADIX-2
// ============================================

/**
 * Calcula la FFT de un buffer de audio usando Cooley-Tukey Radix-2.
 * 
 * La entrada DEBE tener longitud potencia de 2 (512, 1024, 2048, 4096).
 * Si no lo es, se trunca a la potencia de 2 más cercana inferior.
 * 
 * @param buffer - Buffer de muestras en tiempo (Float32Array)
 * @param sampleRate - Frecuencia de muestreo en Hz (ej: 44100)
 * @returns Resultado FFT con magnitudes y frecuencias
 */
export function computeFFT(buffer: Float32Array, sampleRate: number): FFTResult {
  // Encontrar potencia de 2 más cercana (inferior o igual)
  const n = nearestPowerOf2(buffer.length);
  
  // Copiar y aplicar ventana de Hanning para reducir spectral leakage
  const windowed = applyHanningWindow(buffer.slice(0, n));
  
  // Preparar arrays complejos (in-place)
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  
  // Copiar datos con bit-reversal ordering
  for (let i = 0; i < n; i++) {
    const j = bitReverse(i, Math.log2(n));
    real[j] = windowed[i];
    imag[j] = 0;
  }
  
  // === COOLEY-TUKEY BUTTERFLY ===
  // Iterativo (no recursivo) para mejor rendimiento
  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2;
    const step = n / size;
    
    for (let i = 0; i < n; i += size) {
      for (let j = 0; j < halfSize; j++) {
        // Twiddle factor: W_n^k = e^(-2πik/n)
        const angle = -2 * Math.PI * j * step / n;
        const twiddleReal = Math.cos(angle);
        const twiddleImag = Math.sin(angle);
        
        const idx1 = i + j;
        const idx2 = i + j + halfSize;
        
        // Butterfly operation
        const t_real = real[idx2] * twiddleReal - imag[idx2] * twiddleImag;
        const t_imag = real[idx2] * twiddleImag + imag[idx2] * twiddleReal;
        
        real[idx2] = real[idx1] - t_real;
        imag[idx2] = imag[idx1] - t_imag;
        real[idx1] = real[idx1] + t_real;
        imag[idx1] = imag[idx1] + t_imag;
      }
    }
  }
  
  // === CALCULAR MAGNITUDES ===
  // Solo necesitamos la primera mitad (Nyquist)
  const numBins = n / 2;
  const magnitudes = new Float32Array(numBins);
  const frequencies = new Float32Array(numBins);
  const binWidth = sampleRate / n;
  
  let totalEnergy = 0;
  
  for (let i = 0; i < numBins; i++) {
    // Magnitud = sqrt(real² + imag²)
    const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
    // Normalizar por N
    magnitudes[i] = mag / n;
    frequencies[i] = i * binWidth;
    totalEnergy += magnitudes[i] * magnitudes[i];
  }
  
  return {
    magnitudes,
    frequencies,
    totalEnergy: Math.sqrt(totalEnergy),
  };
}

/**
 * Calcula la energía en bandas de frecuencia específicas.
 * 
 * Esta es la función que Selene usará para entender la música:
 * - Bass para kicks y graves
 * - Mid para melodías y voces
 * - Treble para hi-hats y brillo
 * 
 * @param fftResult - Resultado de computeFFT()
 * @param sampleRate - Frecuencia de muestreo
 */
export function computeBandEnergies(fftResult: FFTResult, sampleRate: number): BandEnergy {
  const { magnitudes, frequencies } = fftResult;
  const numBins = magnitudes.length;
  const binWidth = sampleRate / (numBins * 2);
  
  // Acumuladores por banda
  let subBassEnergy = 0, subBassCount = 0;
  let bassEnergy = 0, bassCount = 0;
  let lowMidEnergy = 0, lowMidCount = 0;
  let midEnergy = 0, midCount = 0;
  let highMidEnergy = 0, highMidCount = 0;
  let trebleEnergy = 0, trebleCount = 0;
  
  // Para frecuencia dominante y centroide
  let maxMag = 0;
  let dominantBin = 0;
  let weightedFreqSum = 0;
  let totalMag = 0;
  
  for (let i = 0; i < numBins; i++) {
    const freq = frequencies[i];
    const mag = magnitudes[i];
    const magSquared = mag * mag; // Energía = magnitud²
    
    // Tracking de pico
    if (mag > maxMag) {
      maxMag = mag;
      dominantBin = i;
    }
    
    // Para centroide espectral
    weightedFreqSum += freq * mag;
    totalMag += mag;
    
    // Clasificar en bandas
    if (freq >= FREQ_BANDS.SUB_BASS.min && freq < FREQ_BANDS.SUB_BASS.max) {
      subBassEnergy += magSquared;
      subBassCount++;
    }
    if (freq >= FREQ_BANDS.BASS.min && freq < FREQ_BANDS.BASS.max) {
      bassEnergy += magSquared;
      bassCount++;
    }
    if (freq >= FREQ_BANDS.LOW_MID.min && freq < FREQ_BANDS.LOW_MID.max) {
      lowMidEnergy += magSquared;
      lowMidCount++;
    }
    if (freq >= FREQ_BANDS.MID.min && freq < FREQ_BANDS.MID.max) {
      midEnergy += magSquared;
      midCount++;
    }
    if (freq >= FREQ_BANDS.HIGH_MID.min && freq < FREQ_BANDS.HIGH_MID.max) {
      highMidEnergy += magSquared;
      highMidCount++;
    }
    if (freq >= FREQ_BANDS.TREBLE.min && freq <= FREQ_BANDS.TREBLE.max) {
      trebleEnergy += magSquared;
      trebleCount++;
    }
  }
  
  // Normalizar por número de bins (RMS-like) y escalar a 0-1
  // Wave 15.4: Ahora usa PINK_NOISE_COMPENSATION por banda
  const normalize = (energy: number, count: number, scaleFactor: number = 20): number => {
    if (count === 0) return 0;
    const rms = Math.sqrt(energy / count);
    // Escalar usando factor específico por banda (compensación ruido rosa)
    return Math.min(1, rms * scaleFactor);
  };
  
  return {
    subBass: normalize(subBassEnergy, subBassCount, PINK_NOISE_COMPENSATION.SUB_BASS),
    bass: normalize(bassEnergy + subBassEnergy, bassCount + subBassCount, PINK_NOISE_COMPENSATION.BASS),
    lowMid: normalize(lowMidEnergy, lowMidCount, PINK_NOISE_COMPENSATION.LOW_MID),
    mid: normalize(midEnergy, midCount, PINK_NOISE_COMPENSATION.MID),
    highMid: normalize(highMidEnergy, highMidCount, PINK_NOISE_COMPENSATION.HIGH_MID),
    treble: normalize(trebleEnergy + highMidEnergy, trebleCount + highMidCount, PINK_NOISE_COMPENSATION.TREBLE),
    dominantFrequency: frequencies[dominantBin] || 0,
    spectralCentroid: totalMag > 0 ? weightedFreqSum / totalMag : 0,
  };
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Encuentra la potencia de 2 más cercana (igual o inferior)
 */
function nearestPowerOf2(n: number): number {
  let power = 1;
  while (power * 2 <= n) {
    power *= 2;
  }
  return power;
}

/**
 * Bit-reversal para reordenamiento Cooley-Tukey
 */
function bitReverse(x: number, bits: number): number {
  let result = 0;
  for (let i = 0; i < bits; i++) {
    result = (result << 1) | (x & 1);
    x >>= 1;
  }
  return result;
}

/**
 * Aplica ventana de Hanning para reducir spectral leakage.
 * 
 * La ventana de Hanning es: w(n) = 0.5 * (1 - cos(2πn/(N-1)))
 * 
 * Esto suaviza los bordes del buffer, reduciendo artefactos
 * causados por discontinuidades en los extremos.
 */
function applyHanningWindow(buffer: Float32Array): Float32Array {
  const n = buffer.length;
  const windowed = new Float32Array(n);
  
  for (let i = 0; i < n; i++) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    windowed[i] = buffer[i] * window;
  }
  
  return windowed;
}

// ============================================
// UTILIDADES DE ANÁLISIS
// ============================================

/**
 * Detecta si hay un transiente (golpe) en la banda de frecuencia.
 * Útil para detectar kicks, snares, hi-hats.
 * 
 * @param currentEnergy - Energía actual de la banda
 * @param previousEnergy - Energía del frame anterior
 * @param threshold - Umbral de ratio (ej: 1.5 = 50% más energía)
 */
export function detectTransient(
  currentEnergy: number,
  previousEnergy: number,
  threshold: number = 1.5
): boolean {
  if (previousEnergy < 0.01) return currentEnergy > 0.1;
  return currentEnergy / previousEnergy > threshold;
}

/**
 * Calcula el "flatness" espectral (qué tan ruidosa vs tonal es la señal).
 * 
 * Valores cercanos a 1 = ruido (energía distribuida uniformemente)
 * Valores cercanos a 0 = tonal (picos claros)
 * 
 * Fórmula: media_geométrica / media_aritmética
 */
export function computeSpectralFlatness(magnitudes: Float32Array): number {
  const n = magnitudes.length;
  if (n === 0) return 0;
  
  let logSum = 0;
  let sum = 0;
  let validCount = 0;
  
  for (let i = 0; i < n; i++) {
    const mag = Math.max(magnitudes[i], 1e-10); // Evitar log(0)
    logSum += Math.log(mag);
    sum += mag;
    validCount++;
  }
  
  if (validCount === 0 || sum === 0) return 0;
  
  const geometricMean = Math.exp(logSum / validCount);
  const arithmeticMean = sum / validCount;
  
  return geometricMean / arithmeticMean;
}

/**
 * Estima la nota musical dominante a partir de la frecuencia.
 * 
 * @param frequency - Frecuencia en Hz
 * @returns Nombre de la nota (ej: "A4", "C#3")
 */
export function frequencyToNote(frequency: number): string {
  if (frequency <= 0) return 'N/A';
  
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  // A4 = 440 Hz (referencia)
  const A4 = 440;
  const semitonesFromA4 = 12 * Math.log2(frequency / A4);
  const midiNote = Math.round(69 + semitonesFromA4);
  
  const noteIndex = ((midiNote % 12) + 12) % 12;
  const octave = Math.floor(midiNote / 12) - 1;
  
  return `${noteNames[noteIndex]}${octave}`;
}

// ============================================
// CLASE WRAPPER PARA USO EN WORKER
// ============================================

/**
 * Analizador FFT con estado para uso continuo en el Worker.
 * Mantiene historial para detección de transientes y smoothing.
 */
export class FFTAnalyzer {
  private readonly sampleRate: number;
  private readonly fftSize: number;
  
  // Historial para transientes
  private prevBass: number = 0;
  private prevMid: number = 0;
  private prevTreble: number = 0;
  
  // Smoothing (EMA)
  private smoothedBass: number = 0;
  private smoothedMid: number = 0;
  private smoothedTreble: number = 0;
  private readonly smoothingFactor: number = 0.3; // 0 = no smooth, 1 = muy smooth
  
  constructor(sampleRate: number = 44100, fftSize: number = 2048) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    console.log(`[FFT] 🧮 Initialized: ${fftSize} bins, ${sampleRate}Hz sample rate`);
  }
  
  /**
   * Analiza un buffer de audio y retorna energías por banda.
   * 
   * @param buffer - Buffer de audio (Float32Array)
   * @returns Energías de bandas + información de transientes
   */
  analyze(buffer: Float32Array): BandEnergy & {
    kickDetected: boolean;
    snareDetected: boolean;
    hihatDetected: boolean;
  } {
    // Ejecutar FFT
    const fftResult = computeFFT(buffer, this.sampleRate);
    const bands = computeBandEnergies(fftResult, this.sampleRate);
    
    // Aplicar smoothing (EMA)
    this.smoothedBass = this.smoothedBass * this.smoothingFactor + bands.bass * (1 - this.smoothingFactor);
    this.smoothedMid = this.smoothedMid * this.smoothingFactor + bands.mid * (1 - this.smoothingFactor);
    this.smoothedTreble = this.smoothedTreble * this.smoothingFactor + bands.treble * (1 - this.smoothingFactor);
    
    // Detectar transientes
    const kickDetected = detectTransient(bands.subBass + bands.bass, this.prevBass, 1.8);
    const snareDetected = detectTransient(bands.mid + bands.lowMid, this.prevMid, 1.5);
    const hihatDetected = detectTransient(bands.treble, this.prevTreble, 1.4);
    
    // Actualizar historial
    this.prevBass = bands.bass;
    this.prevMid = bands.mid;
    this.prevTreble = bands.treble;
    
    return {
      ...bands,
      // Usar valores smoothed para estabilidad visual
      bass: this.smoothedBass,
      mid: this.smoothedMid,
      treble: this.smoothedTreble,
      kickDetected,
      snareDetected,
      hihatDetected,
    };
  }
  
  /**
   * Reset del estado (al cambiar de canción, etc.)
   */
  reset(): void {
    this.prevBass = 0;
    this.prevMid = 0;
    this.prevTreble = 0;
    this.smoothedBass = 0;
    this.smoothedMid = 0;
    this.smoothedTreble = 0;
  }
}
