"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const electron = require("electron");
const path$1 = require("path");
const events = require("events");
const fs$1 = require("fs");
const require$$2 = require("util");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path$1);
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs$1);
class ColorEngine {
  constructor(config) {
    __publicField(this, "activePalette", "fuego");
    __publicField(this, "transitionProgress", 1);
    __publicField(this, "transitionDuration");
    __publicField(this, "targetPalette", null);
    __publicField(this, "entropyState", {
      timeSeed: 0,
      audioSeed: 0
    });
    __publicField(this, "personality", {
      creativity: 0.7,
      energy: 0.5
    });
    __publicField(this, "PALETTES", {
      fuego: { name: "Fuego" },
      hielo: { name: "Hielo", minIntensity: 0.25 },
      selva: { name: "Selva" },
      neon: { name: "Neon" },
      default: { name: "Default", redirect: "fuego" }
    });
    __publicField(this, "moodToTemperature", {
      peaceful: 0.3,
      energetic: 0.8,
      chaotic: 0.5,
      harmonious: 0.5,
      building: 0.6,
      dropping: 0.7
    });
    __publicField(this, "elementToColor", {
      fire: { r: 255, g: 68, b: 68 },
      water: { r: 68, g: 200, b: 255 },
      earth: { r: 139, g: 90, b: 43 },
      air: { r: 200, g: 200, b: 255 }
    });
    this.transitionDuration = config.transitionTime || 500;
  }
  getLivingColor(paletteName, intensity, zoneType = "wash", side = "left") {
    var _a;
    const creativityBoost = 0.5 + this.personality.creativity * 0.5;
    const driftSpeed = 15e3 / creativityBoost;
    const timeDrift = Date.now() / driftSpeed % 1;
    let resolvedPalette = paletteName;
    const palette = this.PALETTES[paletteName];
    if (palette && palette.redirect) {
      resolvedPalette = palette.redirect;
    }
    if (!palette) resolvedPalette = "fuego";
    const frameSeed = Date.now() + intensity * 1e3 + (side === "right" ? 500 : 0);
    const entropy = this.getSystemEntropy(frameSeed);
    let h = 0, s = 100, l = 50;
    switch (resolvedPalette) {
      case "fuego": {
        const baseDrift = Math.sin(timeDrift * Math.PI * 2) * 25;
        let baseHue = 5 + baseDrift + intensity * 20;
        if (zoneType === "spot" && side === "left") {
          if (intensity > 0.6) {
            baseHue = entropy > 0.5 ? 50 : 330;
          }
        }
        h = baseHue;
        const normH = (h % 360 + 360) % 360;
        if (normH > 55 && normH < 280) h = 20;
        s = 90 + intensity * 10;
        l = 25 + intensity * 40;
        if (zoneType === "spot" && side === "right" && intensity > 0.7) {
          h = 280;
          s = 85;
          l = 50;
        }
        break;
      }
      case "hielo": {
        const minIntensity = ((_a = this.PALETTES.hielo) == null ? void 0 : _a.minIntensity) || 0.25;
        intensity = Math.max(intensity, minIntensity);
        h = 200 + timeDrift * 20 + intensity * 10;
        s = 90 - intensity * 20;
        l = 40 + intensity * 45;
        if (zoneType === "spot" && side === "right" && intensity > 0.5) {
          h = 330;
          s = 80;
          l = 55 + intensity * 15;
        }
        if (zoneType === "wash" && intensity > 0.6 && entropy > 0.7) {
          h = 170 + entropy * 20;
          s = 70;
        }
        break;
      }
      case "selva": {
        h = 140 - intensity * 95 + timeDrift * 10;
        if (h < 60) {
          l = 45 + intensity * 30;
        } else {
          l = 30 + intensity * 25;
        }
        s = 80 + intensity * 20;
        if (zoneType === "spot" && intensity > 0.75) {
          h = 320 + entropy * 30;
          s = 90;
          l = 50;
        }
        break;
      }
      case "neon": {
        if (intensity < 0.3) return { r: 0, g: 0, b: 0 };
        const cycle = Math.floor(Date.now() / 1e4) % 4;
        const colorPairs = [
          { primary: 120, secondary: 280 },
          { primary: 310, secondary: 180 },
          { primary: 270, secondary: 110 },
          { primary: 220, secondary: 250 }
        ];
        const pair = colorPairs[cycle];
        const isSecondary = side === "right" || zoneType === "spot" ? entropy > 0.3 : entropy > 0.7;
        h = isSecondary ? pair.secondary : pair.primary;
        s = 100;
        l = 50 + intensity * 15;
        if (intensity > 0.95) l = 100;
        break;
      }
      default:
        h = 20;
        s = 90;
        l = 50;
    }
    if (side === "back") {
      h = (h - 15 + 360) % 360;
    }
    h = (h % 360 + 360) % 360;
    s = Math.max(0, Math.min(100, s));
    l = Math.max(0, Math.min(100, l));
    return this.hslToRgb(h / 360, s / 100, l / 100);
  }
  getSystemEntropy(seedOffset = 0) {
    const time = Date.now();
    const audioNoise = this.personality.energy * 1e3 % 1;
    const combinedSeed = time * 1e-3 + audioNoise * 100 + seedOffset * 7.3;
    const entropy = (Math.sin(combinedSeed) + Math.cos(combinedSeed * 0.7) + 2) / 4;
    this.entropyState.timeSeed = time % 1e5 / 1e5;
    this.entropyState.audioSeed = audioNoise;
    return Math.max(0, Math.min(1, entropy));
  }
  hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p2, q2, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p2 + (q2 - p2) * 6 * t;
        if (t < 1 / 2) return q2;
        if (t < 2 / 3) return p2 + (q2 - p2) * (2 / 3 - t) * 6;
        return p2;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }
  generate(metrics, beatState, _pattern) {
    this.personality.energy = metrics.energy;
    const intensity = metrics.energy * 0.7 + metrics.bass * 0.3;
    const primary = this.getLivingColor(this.activePalette, intensity, "wash", "front");
    const secondary = this.getLivingColor(this.activePalette, intensity, "wash", "back");
    const accent = this.getLivingColor(this.activePalette, intensity, "spot", "left");
    const ambient = this.getLivingColor(this.activePalette, intensity, "spot", "right");
    const beatBoost = beatState.onBeat ? 1.15 : 1;
    return {
      primary: this.boostColor(primary, beatBoost),
      secondary: this.boostColor(secondary, beatBoost * 0.9),
      accent: this.boostColor(accent, beatBoost),
      ambient: this.boostColor(ambient, beatBoost * 0.8),
      intensity: Math.min(1, intensity * beatBoost),
      saturation: 0.9
    };
  }
  boostColor(color, factor) {
    return {
      r: Math.min(255, Math.round(color.r * factor)),
      g: Math.min(255, Math.round(color.g * factor)),
      b: Math.min(255, Math.round(color.b * factor))
    };
  }
  calculateZoneColors(intensity) {
    return {
      front: this.getLivingColor(this.activePalette, intensity, "wash", "front"),
      back: this.getLivingColor(this.activePalette, intensity, "wash", "back"),
      movingLeft: this.getLivingColor(this.activePalette, intensity, "spot", "left"),
      movingRight: this.getLivingColor(this.activePalette, intensity, "spot", "right")
    };
  }
  setPalette(palette) {
    if (this.activePalette === palette) return;
    this.targetPalette = palette;
    this.transitionProgress = 0;
  }
  setPaletteImmediate(palette) {
    this.activePalette = palette;
    this.targetPalette = null;
    this.transitionProgress = 1;
  }
  updateTransition(deltaTime) {
    if (this.transitionProgress < 1 && this.targetPalette) {
      this.transitionProgress += deltaTime / this.transitionDuration;
      if (this.transitionProgress >= 1) {
        this.transitionProgress = 1;
        this.activePalette = this.targetPalette;
        this.targetPalette = null;
      }
    }
  }
  getCurrentPalette() {
    return this.activePalette;
  }
  getPaletteState() {
    return {
      id: this.activePalette,
      colors: this.getPaletteHexColors(),
      saturation: 0.9,
      intensity: 1,
      temperature: this.getPaletteTemperature()
    };
  }
  getPaletteHexColors() {
    const colors = this.calculateZoneColors(0.7);
    return [
      this.rgbToHex(colors.front),
      this.rgbToHex(colors.back),
      this.rgbToHex(colors.movingLeft),
      this.rgbToHex(colors.movingRight)
    ];
  }
  getPaletteTemperature() {
    switch (this.activePalette) {
      case "fuego":
        return 0.85;
      case "hielo":
        return 0.2;
      case "selva":
        return 0.5;
      case "neon":
        return 0.5;
      default:
        return 0.5;
    }
  }
  rgbToHex(color) {
    return "#" + [color.r, color.g, color.b].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  }
  getMoodTemperature(mood) {
    return this.moodToTemperature[mood] ?? 0.5;
  }
  getElementColor(element) {
    return { ...this.elementToColor[element] };
  }
}
class MovementEngine {
  constructor(config) {
    __publicField(this, "state");
    __publicField(this, "time", 0);
    __publicField(this, "phase", 0);
    __publicField(this, "entropyState", { timeSeed: 0, audioSeed: 0 });
    __publicField(this, "audioEnergy", 0.5);
    __publicField(this, "patterns", {
      circle: { freqX: 1, freqY: 1, phaseShift: Math.PI / 2, amplitude: 0.8 },
      infinity: { freqX: 2, freqY: 1, phaseShift: 0, amplitude: 0.7 },
      sweep: { freqX: 1, freqY: 0.1, phaseShift: 0, amplitude: 0.9 },
      cloud: { freqX: 1.3, freqY: 1.7, phaseShift: Math.PI / 4, amplitude: 0.5 },
      waves: { freqX: 1, freqY: 2, phaseShift: Math.PI / 3, amplitude: 0.6 },
      static: { freqX: 0, freqY: 0, phaseShift: 0, amplitude: 0 }
    });
    __publicField(this, "moodPatternMap", {
      peaceful: "cloud",
      energetic: "sweep",
      chaotic: "infinity",
      harmonious: "circle",
      building: "waves",
      dropping: "sweep"
    });
    __publicField(this, "smoothing");
    this.smoothing = config.movementSmoothing || 0.8;
    this.state = {
      pattern: "lissajous",
      speed: 0.5,
      range: 0.8,
      phase: 0,
      syncToBpm: true,
      mirrorMode: false
    };
  }
  /**
   * TICK - Actualiza movimiento para todos los fixtures
   * Migrado de selene-movement-engine.js tick()
   */
  tick(audioData, deltaTime, fixtureIds) {
    this.audioEnergy = audioData.energy;
    this.time += deltaTime * 1e-3 * this.state.speed;
    const results = [];
    const patternName = this.state.pattern === "lissajous" ? "circle" : this.state.pattern;
    const patternConfig = this.patterns[patternName] || this.patterns.circle;
    for (let i = 0; i < fixtureIds.length; i++) {
      const fixtureId = fixtureIds[i];
      const phaseOffset = i / fixtureIds.length * Math.PI * 2;
      const pos = this.calculateLissajous(
        this.time,
        patternConfig,
        phaseOffset,
        audioData
      );
      results.push({
        fixtureId,
        x: pos.x,
        y: pos.y,
        intensity: this.calculateIntensity(audioData, i, fixtureIds.length)
      });
    }
    return results;
  }
  /**
   * Calcula posicion Lissajous
   */
  calculateLissajous(t, config, phaseOffset, audioData) {
    const energyMod = 0.8 + audioData.energy * 0.4;
    const bassMod = 1 + audioData.bass * 0.2;
    const x = Math.sin(t * config.freqX * bassMod + phaseOffset) * config.amplitude * energyMod;
    const y = Math.sin(t * config.freqY * bassMod + config.phaseShift + phaseOffset) * config.amplitude * energyMod;
    return {
      x: (x + 1) / 2,
      y: (y + 1) / 2
    };
  }
  /**
   * Calcula intensidad por fixture
   */
  calculateIntensity(audioData, fixtureIndex, totalFixtures) {
    const baseIntensity = audioData.energy * 0.7 + audioData.bass * 0.3;
    const waveOffset = Math.sin(this.time * 2 + fixtureIndex / totalFixtures * Math.PI * 2);
    const waveIntensity = baseIntensity + waveOffset * 0.15;
    return Math.max(0, Math.min(1, waveIntensity));
  }
  /**
   * Calcula posicion para un solo fixture
   */
  calculate(metrics, beatState, deltaTime = 16) {
    const speedMultiplier = this.state.syncToBpm ? beatState.bpm / 120 : 1;
    this.time += deltaTime / 1e3 * this.state.speed * speedMultiplier;
    if (this.state.syncToBpm) {
      this.phase = beatState.phase * Math.PI * 2;
    } else {
      this.phase = this.time * Math.PI * 2;
    }
    let pan = 0.5;
    let tilt = 0.5;
    const patternName = this.state.pattern === "lissajous" ? "circle" : this.state.pattern;
    const config = this.patterns[patternName] || this.patterns.circle;
    if (config.amplitude > 0) {
      pan = 0.5 + Math.sin(this.phase * config.freqX) * 0.5 * this.state.range;
      tilt = 0.5 + Math.sin(this.phase * config.freqY + config.phaseShift) * 0.5 * this.state.range;
    }
    const energyRange = this.state.range * (0.7 + metrics.energy * 0.3);
    pan = 0.5 + (pan - 0.5) * (energyRange / this.state.range);
    tilt = 0.5 + (tilt - 0.5) * (energyRange / this.state.range);
    if (beatState.onBeat && metrics.bass > 0.6) {
      const entropy = this.getSystemEntropy(Date.now());
      const beatBoost = 0.1 * metrics.bass;
      pan = Math.max(0, Math.min(1, pan + (entropy - 0.5) * beatBoost));
      tilt = Math.max(0, Math.min(1, tilt + (entropy - 0.5) * beatBoost));
    }
    pan = Math.max(0, Math.min(1, pan));
    tilt = Math.max(0, Math.min(1, tilt));
    return {
      pan,
      tilt,
      speed: this.state.speed * speedMultiplier,
      pattern: this.state.pattern
    };
  }
  /**
   * Entropia determinista (sin Math.random)
   */
  getSystemEntropy(seedOffset = 0) {
    const time = Date.now();
    const audioNoise = this.audioEnergy * 1e3 % 1;
    const combinedSeed = time * 1e-3 + audioNoise * 100 + seedOffset * 7.3;
    const entropy = (Math.sin(combinedSeed) + Math.cos(combinedSeed * 0.7) + 2) / 4;
    this.entropyState.timeSeed = time % 1e5 / 1e5;
    this.entropyState.audioSeed = audioNoise;
    return Math.max(0, Math.min(1, entropy));
  }
  setPattern(pattern) {
    this.state.pattern = pattern;
  }
  setPatternFromMood(mood) {
    const pattern = this.moodPatternMap[mood];
    if (pattern && pattern in this.patterns) {
      this.state.pattern = pattern;
    }
  }
  setSpeed(speed) {
    this.state.speed = Math.max(0, Math.min(1, speed));
  }
  setRange(range) {
    this.state.range = Math.max(0, Math.min(1, range));
  }
  setSyncToBpm(sync) {
    this.state.syncToBpm = sync;
  }
  setMirrorMode(mirror) {
    this.state.mirrorMode = mirror;
  }
  getState() {
    return { ...this.state };
  }
  calculateMirrored(metrics, beatState, fixtureIndex, totalFixtures) {
    const base = this.calculate(metrics, beatState);
    if (!this.state.mirrorMode) return base;
    const isEven = fixtureIndex % 2 === 0;
    return {
      ...base,
      pan: isEven ? base.pan : 1 - base.pan
    };
  }
  triggerEvent(eventType, intensity = 1) {
    switch (eventType) {
      case "drop":
        this.state.speed = Math.min(1, this.state.speed * 1.5);
        this.state.range = Math.min(1, this.state.range * 1.2);
        break;
      case "build":
        this.state.speed = Math.min(1, this.state.speed * 1.1 * intensity);
        break;
      case "break":
        this.state.speed = this.state.speed * 0.5;
        this.state.range = this.state.range * 0.7;
        break;
    }
  }
}
class BeatDetector {
  constructor(config) {
    __publicField(this, "state");
    __publicField(this, "peakHistory", []);
    __publicField(this, "maxPeakHistory", 50);
    // Configuración
    __publicField(this, "minBpm");
    __publicField(this, "maxBpm");
    // Umbrales de detección
    __publicField(this, "kickThreshold", 0.7);
    __publicField(this, "snareThreshold", 0.6);
    __publicField(this, "hihatThreshold", 0.5);
    // Energía previa para detección de transientes
    __publicField(this, "prevBass", 0);
    __publicField(this, "prevMid", 0);
    __publicField(this, "prevTreble", 0);
    this.minBpm = config.minBpm || 60;
    this.maxBpm = config.maxBpm || 180;
    this.state = {
      bpm: 120,
      // Default BPM
      confidence: 0.5,
      phase: 0,
      onBeat: false,
      beatCount: 0,
      lastBeatTime: 0,
      kickDetected: false,
      snareDetected: false,
      hihatDetected: false
    };
  }
  /**
   * Procesar frame de audio
   */
  process(metrics) {
    const now = metrics.timestamp;
    const bassTransient = metrics.bass - this.prevBass;
    const midTransient = metrics.mid - this.prevMid;
    const trebleTransient = metrics.treble - this.prevTreble;
    this.state.kickDetected = bassTransient > this.kickThreshold && metrics.bass > 0.5;
    this.state.snareDetected = midTransient > this.snareThreshold && metrics.mid > 0.4;
    this.state.hihatDetected = trebleTransient > this.hihatThreshold && metrics.treble > 0.3;
    if (this.state.kickDetected || bassTransient > 0.3 && metrics.bass > 0.6) {
      this.recordPeak(now, metrics.energy, "kick");
    }
    this.updateBpm(now);
    this.updatePhase(now);
    this.state.onBeat = this.state.phase < 0.1 || this.state.phase > 0.9;
    this.prevBass = metrics.bass;
    this.prevMid = metrics.mid;
    this.prevTreble = metrics.treble;
    return { ...this.state };
  }
  /**
   * Registrar un pico detectado
   */
  recordPeak(time, energy, type) {
    this.peakHistory.push({ time, energy, type });
    if (this.peakHistory.length > this.maxPeakHistory) {
      this.peakHistory.shift();
    }
    if (type === "kick") {
      this.state.beatCount++;
      this.state.lastBeatTime = time;
    }
  }
  /**
   * Calcular BPM desde historial de picos
   */
  updateBpm(now) {
    const kicks = this.peakHistory.filter((p) => p.type === "kick");
    if (kicks.length < 4) return;
    const intervals = [];
    for (let i = 1; i < kicks.length; i++) {
      const interval = kicks[i].time - kicks[i - 1].time;
      if (interval > 200 && interval < 2e3) {
        intervals.push(interval);
      }
    }
    if (intervals.length < 3) return;
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const calculatedBpm = 6e4 / avgInterval;
    if (calculatedBpm >= this.minBpm && calculatedBpm <= this.maxBpm) {
      this.state.bpm = this.state.bpm * 0.8 + calculatedBpm * 0.2;
      const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      this.state.confidence = Math.max(0, 1 - stdDev / avgInterval);
    }
  }
  /**
   * Actualizar fase del beat (0-1)
   */
  updatePhase(now) {
    const beatDuration = 6e4 / this.state.bpm;
    const timeSinceLastBeat = now - this.state.lastBeatTime;
    this.state.phase = timeSinceLastBeat % beatDuration / beatDuration;
  }
  /**
   * Forzar BPM manualmente (para sync externo)
   */
  setBpm(bpm) {
    if (bpm >= this.minBpm && bpm <= this.maxBpm) {
      this.state.bpm = bpm;
      this.state.confidence = 1;
    }
  }
  /**
   * Tap tempo - usuario marca el beat manualmente
   */
  tap(timestamp) {
    this.recordPeak(timestamp, 1, "kick");
    this.updateBpm(timestamp);
  }
  /**
   * Obtener estado actual
   */
  getState() {
    return { ...this.state };
  }
  /**
   * Reset detector
   */
  reset() {
    this.peakHistory = [];
    this.state = {
      bpm: 120,
      confidence: 0.5,
      phase: 0,
      onBeat: false,
      beatCount: 0,
      lastBeatTime: 0,
      kickDetected: false,
      snareDetected: false,
      hihatDetected: false
    };
  }
}
const DEFAULT_MUSICAL_ENGINE_CONFIG = {
  mainThreadInterval: 30,
  workerThreadInterval: 500,
  confidenceThreshold: 0.5,
  warmupTime: 5e3,
  learningEnabled: true,
  predictionsEnabled: true
};
const DEFAULT_CONFIG$5 = {
  bufferSize: 16,
  kickThreshold: 0.6,
  snareThreshold: 0.5,
  hihatThreshold: 0.4,
  fillThreshold: 0.8,
  minFillInterval: 2e3
};
class CircularBuffer {
  constructor(size) {
    __publicField(this, "buffer");
    __publicField(this, "writeIndex", 0);
    __publicField(this, "count", 0);
    this.size = size;
    this.buffer = new Array(size);
  }
  push(item) {
    this.buffer[this.writeIndex] = item;
    this.writeIndex = (this.writeIndex + 1) % this.size;
    if (this.count < this.size) this.count++;
  }
  getAll() {
    if (this.count < this.size) {
      return this.buffer.slice(0, this.count);
    }
    return [
      ...this.buffer.slice(this.writeIndex),
      ...this.buffer.slice(0, this.writeIndex)
    ];
  }
  isFull() {
    return this.count >= this.size;
  }
  clear() {
    this.writeIndex = 0;
    this.count = 0;
  }
}
class RhythmAnalyzer {
  constructor(config = {}) {
    __publicField(this, "config");
    __publicField(this, "energyBuffer");
    // Estado previo para detección de transientes
    __publicField(this, "prevBass", 0);
    __publicField(this, "prevMid", 0);
    __publicField(this, "prevTreble", 0);
    // Historial para detección de patrones
    __publicField(this, "kickHistory", []);
    // Fases donde se detectó kick
    __publicField(this, "snareHistory", []);
    // Fases donde se detectó snare
    __publicField(this, "hihatHistory", []);
    // Fases donde se detectó hihat
    __publicField(this, "historySize", 32);
    // Estado de fill
    __publicField(this, "lastFillTime", 0);
    __publicField(this, "consecutiveHighEnergy", 0);
    // Cache del último resultado
    __publicField(this, "cachedResult", null);
    this.config = { ...DEFAULT_CONFIG$5, ...config };
    this.energyBuffer = new CircularBuffer(this.config.bufferSize);
  }
  // ============================================================
  // 🎯 MÉTODO PRINCIPAL: analyze()
  // ============================================================
  /**
   * 🎯 Analizar frame de audio
   * 
   * ⚠️ REGLA 1: Este método debe ser LIGERO (< 5ms)
   * Se ejecuta en Main Thread a 30ms de frecuencia
   * 
   * @param audio - Métricas de audio del frame actual
   * @param beat - Estado del beat (bpm, phase, etc.)
   * @returns Análisis rítmico completo
   */
  analyze(audio, beat) {
    const now = audio.timestamp;
    const drums = this.detectDrums(audio);
    this.energyBuffer.push({
      phase: beat.phase,
      bass: audio.bass,
      mid: audio.mid,
      treble: audio.treble,
      total: audio.energy,
      timestamp: now
    });
    if (drums.kickDetected) this.recordHit(this.kickHistory, beat.phase);
    if (drums.snareDetected) this.recordHit(this.snareHistory, beat.phase);
    if (drums.hihatDetected) this.recordHit(this.hihatHistory, beat.phase);
    const groove = this.calculateGroove(beat.phase);
    const pattern = this.detectPatternType(audio, drums, groove, beat.bpm);
    const fillInProgress = this.detectFill(audio, drums, now);
    const confidence = this.calculateConfidence(groove, drums);
    this.prevBass = audio.bass;
    this.prevMid = audio.mid;
    this.prevTreble = audio.treble;
    const result = {
      bpm: beat.bpm,
      confidence,
      beatPhase: beat.phase,
      barPhase: beat.phase * 4 % 1,
      // Asumiendo 4/4
      pattern: {
        type: pattern.type,
        confidence: pattern.confidence
      },
      drums,
      groove,
      fillInProgress,
      timestamp: now
    };
    this.cachedResult = result;
    return result;
  }
  // ============================================================
  // 🥁 DETECCIÓN DE DRUMS
  // ============================================================
  /**
   * Detectar kicks, snares y hihats
   */
  detectDrums(audio) {
    const bassTransient = Math.max(0, audio.bass - this.prevBass);
    const midTransient = Math.max(0, audio.mid - this.prevMid);
    const trebleTransient = Math.max(0, audio.treble - this.prevTreble);
    const kickDetected = bassTransient > this.config.kickThreshold && audio.bass > 0.5;
    const snareDetected = midTransient > this.config.snareThreshold && audio.mid > 0.4;
    const hihatDetected = trebleTransient > this.config.hihatThreshold && audio.treble > 0.3;
    const crashDetected = audio.treble > 0.8 && audio.bass > 0.6 && trebleTransient > 0.5;
    return {
      kickDetected,
      kickIntensity: kickDetected ? audio.bass : 0,
      snareDetected,
      snareIntensity: snareDetected ? audio.mid : 0,
      hihatDetected,
      hihatIntensity: hihatDetected ? audio.treble : 0,
      crashDetected,
      fillDetected: false
      // Se actualiza en detectFill()
    };
  }
  // ============================================================
  // 🎵 CÁLCULO DE SINCOPACIÓN - EL ARMA SECRETA
  // ============================================================
  /**
   * 🎯 Calcular groove (sincopación, swing, complejidad)
   * 
   * MATEMÁTICA DE SINCOPACIÓN - FÓRMULA FINAL:
   * - Dividir el beat en ON-BEAT (fase 0.0-0.15, 0.85-1.0) y OFF-BEAT (0.15-0.85)
   * - Medir qué % de la energía TOTAL está en off-beat
   * - PERO ponderar por la INTENSIDAD de los picos off-beat
   * 
   * CLAVE: Four-on-floor tiene picos SOLO en on-beat
   *        Reggaeton tiene picos FUERTES en off-beat (dembow)
   * 
   * FÓRMULA: syncopation = (peakOffBeat / maxPeak) * (offBeatEnergy / totalEnergy)
   * 
   * UMBRALES (de types.ts):
   * - < 0.15: Straight/Four-on-floor (Techno, House)
   * - 0.15-0.4: Moderado (Pop, Rock)
   * - > 0.4: Alto (Reggaeton, Funk)
   */
  calculateGroove(_currentPhase) {
    const frames = this.energyBuffer.getAll();
    if (frames.length < 4) {
      return {
        syncopation: 0.2,
        // Neutral
        swingAmount: 0,
        complexity: "low",
        humanization: 0.05
      };
    }
    let onBeatEnergy = 0;
    let offBeatEnergy = 0;
    let peakOnBeat = 0;
    let peakOffBeat = 0;
    for (const frame of frames) {
      const energy = frame.bass + frame.mid * 0.5;
      const isOnBeat = frame.phase < 0.15 || frame.phase > 0.85;
      if (isOnBeat) {
        onBeatEnergy += energy;
        peakOnBeat = Math.max(peakOnBeat, energy);
      } else {
        offBeatEnergy += energy;
        peakOffBeat = Math.max(peakOffBeat, energy);
      }
    }
    const totalEnergy = onBeatEnergy + offBeatEnergy;
    const offBeatRatio = totalEnergy > 0 ? offBeatEnergy / totalEnergy : 0.5;
    const peakDominance = peakOnBeat > 0.01 ? Math.min(1, peakOffBeat / peakOnBeat) : peakOffBeat > 0.3 ? 1 : 0.5;
    const syncopation = peakDominance * 0.7 + offBeatRatio * 0.3;
    let earlyOffBeatEnergy = 0;
    let lateOffBeatEnergy = 0;
    for (const frame of frames) {
      if (frame.phase > 0.2 && frame.phase < 0.4) {
        earlyOffBeatEnergy += frame.total;
      } else if (frame.phase > 0.6 && frame.phase < 0.8) {
        lateOffBeatEnergy += frame.total;
      }
    }
    const totalOffBeat = earlyOffBeatEnergy + lateOffBeatEnergy;
    const swingAmount = totalOffBeat > 0.01 ? lateOffBeatEnergy / totalOffBeat - 0.5 : 0;
    const normalizedSwing = Math.max(0, Math.min(1, swingAmount * 2));
    const phaseVariance = this.calculatePhaseVariance();
    const hitDensity = (this.kickHistory.length + this.snareHistory.length + this.hihatHistory.length) / Math.max(1, this.historySize);
    let complexity;
    if (phaseVariance > 0.3 || hitDensity > 0.5) {
      complexity = "high";
    } else if (phaseVariance > 0.15 || hitDensity > 0.3) {
      complexity = "medium";
    } else {
      complexity = "low";
    }
    const humanization = this.calculateHumanization();
    return {
      syncopation: Math.max(0, Math.min(1, syncopation)),
      swingAmount: normalizedSwing,
      complexity,
      humanization
    };
  }
  /**
   * Calcular varianza de fases de hits
   */
  calculatePhaseVariance() {
    const allPhases = [...this.kickHistory, ...this.snareHistory];
    if (allPhases.length < 3) return 0;
    const mean = allPhases.reduce((a, b) => a + b, 0) / allPhases.length;
    const variance = allPhases.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / allPhases.length;
    return Math.sqrt(variance);
  }
  /**
   * Calcular humanización (variación de timing)
   */
  calculateHumanization() {
    if (this.kickHistory.length < 4) return 0.05;
    let totalDeviation = 0;
    for (const phase of this.kickHistory) {
      const distTo0 = Math.min(phase, 1 - phase);
      const distTo05 = Math.abs(phase - 0.5);
      totalDeviation += Math.min(distTo0, distTo05);
    }
    const avgDeviation = totalDeviation / this.kickHistory.length;
    return Math.min(0.15, avgDeviation * 2);
  }
  // ============================================================
  // 🎭 DETECCIÓN DE PATRONES
  // ============================================================
  /**
   * 🎭 Detectar tipo de patrón rítmico
   * 
   * ⚠️ REGLA 3: Priorizar SYNCOPATION sobre BPM
   * 
   * Orden de detección:
   * 1. Sincopación → Reggaeton (>0.4) vs Techno (<0.15)
   * 2. Constancia de treble → Cumbia (güiro constante)
   * 3. Swing → Jazz (>0.15)
   * 4. BPM → Solo para desempatar
   */
  detectPatternType(audio, _drums, groove, bpm) {
    if (groove.syncopation > 0.4 && this.hasDembowPattern()) {
      const bpmMatch = bpm >= 85 && bpm <= 100 ? 1 : 0.7;
      const bassMatch = audio.bass > 0.6 ? 1 : 0.8;
      return {
        type: "reggaeton",
        confidence: Math.min(0.95, groove.syncopation * 0.4 + bpmMatch * 0.3 + bassMatch * 0.3)
      };
    }
    if (this.hasConstantHighPercussion(audio) && !this.hasDembowPattern()) {
      const bpmMatch = bpm >= 85 && bpm <= 115 ? 1 : 0.6;
      const trebleConstancy = this.calculateTrebleConstancy();
      if (trebleConstancy > 0.6) {
        return {
          type: "cumbia",
          confidence: Math.min(0.9, trebleConstancy * 0.5 + bpmMatch * 0.3 + 0.2)
        };
      }
    }
    if (groove.syncopation < 0.15 && groove.swingAmount < 0.1) {
      const hasRegularKick = this.hasRegularKickPattern();
      if (hasRegularKick) {
        return {
          type: "four_on_floor",
          confidence: Math.min(0.9, (1 - groove.syncopation) * 0.5 + 0.4)
        };
      }
    }
    if (groove.swingAmount > 0.15 && groove.complexity === "high") {
      return {
        type: "jazz_swing",
        confidence: Math.min(0.85, groove.swingAmount * 0.4 + 0.45)
      };
    }
    if (this.hasHalfTimeSnare() && audio.bass > 0.7 && groove.complexity === "low") {
      return {
        type: "half_time",
        confidence: 0.75
      };
    }
    if (groove.syncopation > 0.5 && groove.complexity === "high" && bpm > 150) {
      return {
        type: "breakbeat",
        confidence: 0.75
      };
    }
    if (groove.syncopation >= 0.15 && groove.syncopation <= 0.35 && this.hasRockPattern()) {
      return {
        type: "rock_standard",
        confidence: 0.7
      };
    }
    if (groove.syncopation > 0.35 && groove.complexity === "medium") {
      return {
        type: "latin",
        confidence: 0.6
      };
    }
    if (audio.energy < 0.3 && this.kickHistory.length < 4) {
      return {
        type: "minimal",
        confidence: 0.5
      };
    }
    return {
      type: "unknown",
      confidence: 0.3
    };
  }
  // ============================================================
  // 🔍 HELPERS DE DETECCIÓN DE PATRONES
  // ============================================================
  /**
   * Detectar patrón Dembow (Reggaeton)
   * 
   * El Dembow tiene un patrón característico:
   * - Kick fuerte en beat 1
   * - Snare/Rim en ~1.75 (off-beat del 2)
   * - Otro Snare/Rim en ~2.75 (off-beat del 3)
   * 
   * "Tum... pa-Tum... pa" 
   */
  hasDembowPattern() {
    if (this.snareHistory.length < 4) return false;
    let dembowHits = 0;
    for (const phase of this.snareHistory.slice(-8)) {
      if (phase > 0.2 && phase < 0.35 || phase > 0.7 && phase < 0.85) {
        dembowHits++;
      }
    }
    return dembowHits / Math.min(8, this.snareHistory.length) > 0.5;
  }
  /**
   * 🇦🇷 Detectar percusión alta constante (Güiro de Cumbia)
   * 
   * El "Caballito" de la cumbia:
   * - Güiro/Shaker SIEMPRE presente
   * - Treble alto y CONSTANTE
   * - Micro-variaciones de volumen (pero siempre ahí)
   */
  hasConstantHighPercussion(audio) {
    if (audio.treble < 0.4) return false;
    const frames = this.energyBuffer.getAll();
    if (frames.length < 8) return false;
    let treblePresent = 0;
    for (const frame of frames) {
      if (frame.treble > 0.35) treblePresent++;
    }
    return treblePresent / frames.length > 0.7;
  }
  /**
   * Calcular constancia del treble (para Cumbia)
   */
  calculateTrebleConstancy() {
    const frames = this.energyBuffer.getAll();
    if (frames.length < 4) return 0;
    const trebles = frames.map((f) => f.treble);
    const mean = trebles.reduce((a, b) => a + b, 0) / trebles.length;
    const variance = trebles.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / trebles.length;
    const constancy = mean > 0.3 ? 1 - Math.min(1, variance * 10) : 0;
    return constancy;
  }
  /**
   * Detectar kick regular (Four-on-floor)
   */
  hasRegularKickPattern() {
    if (this.kickHistory.length < 4) return false;
    let onBeatKicks = 0;
    for (const phase of this.kickHistory.slice(-8)) {
      if (phase < 0.15 || phase > 0.85) {
        onBeatKicks++;
      }
    }
    return onBeatKicks / Math.min(8, this.kickHistory.length) > 0.7;
  }
  /**
   * Detectar half-time snare (beat 3 en lugar de 2)
   */
  hasHalfTimeSnare() {
    if (this.snareHistory.length < 4) return false;
    let halfTimeHits = 0;
    for (const phase of this.snareHistory.slice(-8)) {
      if (phase > 0.45 && phase < 0.55) {
        halfTimeHits++;
      }
    }
    return halfTimeHits / Math.min(8, this.snareHistory.length) > 0.5;
  }
  /**
   * Detectar patrón de rock (snare en 2 y 4)
   */
  hasRockPattern() {
    if (this.snareHistory.length < 4) return false;
    let rockHits = 0;
    for (const phase of this.snareHistory.slice(-8)) {
      if (phase > 0.2 && phase < 0.3 || phase > 0.7 && phase < 0.8) {
        rockHits++;
      }
    }
    return rockHits / Math.min(8, this.snareHistory.length) > 0.5;
  }
  // ============================================================
  // 🎭 DETECCIÓN DE FILLS
  // ============================================================
  /**
   * Detectar fill en progreso
   * 
   * Un fill se caracteriza por:
   * - Alta densidad de hits
   * - Variación rápida de intensidad
   * - Duración corta (típicamente 1-2 beats)
   * - O energía sostenida muy alta (builds en EDM)
   */
  detectFill(audio, drums, now) {
    if (now - this.lastFillTime < this.config.minFillInterval) {
      if (this.consecutiveHighEnergy > 3) return true;
    }
    const highEnergy = audio.energy > this.config.fillThreshold;
    const manyHits = (drums.kickDetected ? 1 : 0) + (drums.snareDetected ? 1 : 0) + (drums.hihatDetected ? 1 : 0) >= 2;
    const extremeEnergy = audio.energy > 0.85 && audio.bass > 0.7 && audio.mid > 0.7;
    if (highEnergy && manyHits || extremeEnergy) {
      this.consecutiveHighEnergy++;
      if (this.consecutiveHighEnergy >= 4) {
        this.lastFillTime = now;
        return true;
      }
    } else {
      this.consecutiveHighEnergy = Math.max(0, this.consecutiveHighEnergy - 1);
    }
    return false;
  }
  // ============================================================
  // 📊 CÁLCULO DE CONFIANZA
  // ============================================================
  /**
   * Calcular confianza general del análisis
   * 
   * ⚠️ REGLA 2: Confianza < 0.5 → usar modo reactivo
   */
  calculateConfidence(groove, drums) {
    let confidence = 0.3;
    if (this.energyBuffer.isFull()) {
      confidence += 0.2;
    }
    if (this.kickHistory.length >= 8) {
      confidence += 0.15;
    }
    if (groove.syncopation < 0.15 || groove.syncopation > 0.35) {
      confidence += 0.15;
    }
    if (drums.kickDetected || drums.snareDetected) {
      confidence += 0.1;
    }
    if (groove.complexity !== "low") {
      confidence += 0.1;
    }
    return Math.min(0.95, confidence);
  }
  // ============================================================
  // 🔧 UTILIDADES
  // ============================================================
  /**
   * Registrar hit en historial
   */
  recordHit(history, phase) {
    history.push(phase);
    if (history.length > this.historySize) {
      history.shift();
    }
  }
  /**
   * Obtener último resultado cacheado
   */
  getLastResult() {
    return this.cachedResult;
  }
  /**
   * Reset del analizador
   */
  reset() {
    this.energyBuffer.clear();
    this.kickHistory = [];
    this.snareHistory = [];
    this.hihatHistory = [];
    this.prevBass = 0;
    this.prevMid = 0;
    this.prevTreble = 0;
    this.lastFillTime = 0;
    this.consecutiveHighEnergy = 0;
    this.cachedResult = null;
  }
}
const SCALE_INTERVALS = {
  // === MODOS DIATÓNICOS (7 notas) ===
  major: [0, 2, 4, 5, 7, 9, 11],
  // Ionian - Feliz, brillante
  minor: [0, 2, 3, 5, 7, 8, 10],
  // Aeolian - Triste, melancólico
  dorian: [0, 2, 3, 5, 7, 9, 10],
  // Jazzy, sofisticado
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  // Spanish, exótico, tenso
  lydian: [0, 2, 4, 6, 7, 9, 11],
  // Dreamy, etéreo, #4
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  // Bluesy, rock, b7
  locrian: [0, 1, 3, 5, 6, 8, 10],
  // Muy tenso, b2 b5
  // === ESCALAS MELÓDICAS (7 notas) ===
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  // Dramático, #7
  melodic_minor: [0, 2, 3, 5, 7, 9, 11],
  // Jazz avanzado
  // === PENTATÓNICAS (5 notas) ===
  pentatonic_major: [0, 2, 4, 7, 9],
  // Simple, folk, universal
  pentatonic_minor: [0, 3, 5, 7, 10],
  // Blues, rock
  // === ESPECIALES ===
  blues: [0, 3, 5, 6, 7, 10],
  // Blues con blue note (b5)
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  // Todas
};
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const DEFAULT_CONFIG$4 = {
  noteThreshold: 0.15,
  scalesToCheck: void 0
  // Todas
};
class ScaleIdentifier {
  constructor(config = {}) {
    __publicField(this, "config");
    this.config = { ...DEFAULT_CONFIG$4, ...config };
  }
  // ============================================================
  // 📊 MÉTODOS PÚBLICOS
  // ============================================================
  /**
   * Identificar escala a partir de un chromagrama
   * 
   * @param chroma Array de 12 valores (0-1) representando energía de cada pitch class
   * @returns ScaleMatch con la escala más probable
   */
  identifyScale(chroma) {
    if (chroma.length !== 12) {
      throw new Error(`ScaleIdentifier: chromagrama debe tener 12 elementos, recibió ${chroma.length}`);
    }
    const presentNotes = this.detectPresentNotes(chroma);
    if (presentNotes.length === 0) {
      return {
        scale: "chromatic",
        root: 0,
        rootName: "C",
        confidence: 0,
        matchedNotes: 0,
        totalNotes: 12
      };
    }
    let bestMatch = null;
    const scalesToCheck = this.config.scalesToCheck || Object.keys(SCALE_INTERVALS);
    for (let root = 0; root < 12; root++) {
      for (const scale of scalesToCheck) {
        const match = this.calculateMatch(root, scale, presentNotes, chroma);
        if (!bestMatch || match.confidence > bestMatch.confidence) {
          bestMatch = match;
        }
      }
    }
    return bestMatch;
  }
  /**
   * Obtener notas de una escala dada una raíz
   * 
   * @param root Raíz (0-11)
   * @param scale Escala a usar
   * @returns Array de pitch classes (0-11)
   */
  getScaleNotes(root, scale) {
    const intervals = SCALE_INTERVALS[scale];
    return intervals.map((interval) => (root + interval) % 12);
  }
  /**
   * Verificar si una nota pertenece a una escala
   * 
   * @param pitch Pitch (cualquier octava, se normaliza a 0-11)
   * @param root Raíz de la escala (0-11)
   * @param scale Escala a verificar
   * @returns true si la nota está en la escala
   */
  isInScale(pitch, root, scale) {
    const pitchClass = (pitch % 12 + 12) % 12;
    const scaleNotes = this.getScaleNotes(root, scale);
    return scaleNotes.includes(pitchClass);
  }
  /**
   * Convertir pitch class a nombre de nota
   */
  pitchToName(pitch) {
    return NOTE_NAMES[(pitch % 12 + 12) % 12];
  }
  /**
   * Convertir nombre de nota a pitch class
   */
  nameToPitch(name) {
    const index = NOTE_NAMES.indexOf(name.toUpperCase());
    return index >= 0 ? index : 0;
  }
  // ============================================================
  // 🔧 MÉTODOS PRIVADOS
  // ============================================================
  /**
   * Detectar qué notas están presentes en el chromagrama
   */
  detectPresentNotes(chroma) {
    const present = [];
    const threshold = this.config.noteThreshold;
    for (let i = 0; i < 12; i++) {
      if (chroma[i] > threshold) {
        present.push(i);
      }
    }
    return present;
  }
  /**
   * Calcular match score para una combinación raíz + escala
   * 
   * ALGORITMO MEJORADO:
   * 1. La raíz debe tener alta energía (50% del score)
   * 2. Las notas características de la escala deben estar presentes
   * 3. Las notas fuera de la escala penalizan
   * 
   * Notas características:
   * - Major vs Minor: La 3ra (Major = 4 semitonos, Minor = 3 semitonos)
   * - Phrygian: La 2da bemol (1 semitono)
   * - Dorian: La 6ta mayor (9 semitonos)
   * - Lydian: La 4ta aumentada (6 semitonos)
   * - Mixolydian: La 7ma menor (10 semitonos)
   */
  calculateMatch(root, scale, presentNotes, chroma) {
    const scaleNotes = this.getScaleNotes(root, scale);
    const scaleNoteSet = new Set(scaleNotes);
    let inScaleEnergy = 0;
    let outScaleEnergy = 0;
    let matchedNotes = 0;
    for (const note of presentNotes) {
      if (scaleNoteSet.has(note)) {
        matchedNotes++;
        inScaleEnergy += chroma[note];
      } else {
        outScaleEnergy += chroma[note];
      }
    }
    const totalEnergy = inScaleEnergy + outScaleEnergy;
    const energyRatio = totalEnergy > 0 ? inScaleEnergy / totalEnergy : 0;
    const noteRatio = presentNotes.length > 0 ? matchedNotes / presentNotes.length : 0;
    const maxChromaEnergy = Math.max(...chroma);
    const rootEnergy = chroma[root];
    const rootDominance = maxChromaEnergy > 0 ? rootEnergy / maxChromaEnergy : 0;
    const characteristicBonus = this.calculateCharacteristicBonus(root, scale, chroma);
    const sizePenalty = scaleNotes.length > 8 ? 0.2 : 0;
    const confidence = Math.min(1, Math.max(
      0,
      noteRatio * 0.35 + energyRatio * 0.25 + rootDominance * 0.25 + characteristicBonus * 0.15 - sizePenalty
    ));
    return {
      scale,
      root,
      rootName: this.pitchToName(root),
      confidence,
      matchedNotes,
      totalNotes: scaleNotes.length
    };
  }
  /**
   * Calcular bonus por notas características de la escala
   * Estas notas diferencian escalas que comparten muchas notas
   */
  calculateCharacteristicBonus(root, scale, chroma) {
    const characteristicIntervals = {
      major: [4, 11],
      // 3ra mayor (4), 7ma mayor (11)
      minor: [3, 10],
      // 3ra menor (3), 7ma menor (10)
      dorian: [3, 9],
      // 3ra menor (3), 6ta mayor (9)
      phrygian: [1, 3],
      // 2da menor (1), 3ra menor (3)
      lydian: [4, 6],
      // 3ra mayor (4), 4ta aumentada (6)
      mixolydian: [4, 10],
      // 3ra mayor (4), 7ma menor (10)
      locrian: [1, 6],
      // 2da menor (1), 5ta disminuida (6)
      harmonic_minor: [3, 11],
      // 3ra menor (3), 7ma mayor (11)
      melodic_minor: [3, 9, 11],
      // 3ra menor, 6ta mayor, 7ma mayor
      pentatonic_major: [4, 9],
      // 3ra mayor (4), 6ta mayor (9)
      pentatonic_minor: [3, 10],
      // 3ra menor (3), 7ma menor (10)
      blues: [3, 6],
      // 3ra menor (3), blue note (6)
      chromatic: []
      // Ninguna característica
    };
    const intervals = characteristicIntervals[scale];
    if (intervals.length === 0) return 0;
    let characteristicEnergy = 0;
    const threshold = this.config.noteThreshold;
    for (const interval of intervals) {
      const pitchClass = (root + interval) % 12;
      if (chroma[pitchClass] > threshold) {
        characteristicEnergy += chroma[pitchClass];
      }
    }
    return characteristicEnergy / intervals.length;
  }
}
function createScaleIdentifier(config) {
  return new ScaleIdentifier(config);
}
new ScaleIdentifier();
const MODE_TO_MOOD = {
  // === MODOS FELICES (Cálidos) ===
  major: "happy",
  // Brillante, alegre → Naranjas, amarillos
  lydian: "dreamy",
  // Etéreo, flotante → Púrpuras, azul claro
  mixolydian: "bluesy",
  // Rock, blues feliz → Naranjas cálidos
  // === MODOS TRISTES (Fríos) ===
  minor: "sad",
  // Melancólico → Azules profundos
  dorian: "jazzy",
  // Sofisticado, jazz → Azules jazz, morados
  harmonic_minor: "tense",
  // Dramático → Rojos oscuros
  melodic_minor: "jazzy",
  // Jazz avanzado → Morados
  // === MODOS TENSOS/EXÓTICOS (Especiales) ===
  phrygian: "spanish_exotic",
  // Spanish, flamenco → Rojos, negros
  locrian: "tense",
  // Muy inestable → Rojos, strobes
  // === PENTATÓNICAS (Universales) ===
  pentatonic_major: "universal",
  // Folk, simple → Colores naturales
  pentatonic_minor: "bluesy",
  // Blues rock → Azul oscuro
  // === ESPECIALES ===
  blues: "bluesy",
  // Blues → Azul profundo
  chromatic: "tense"
  // Atonal → Caótico, strobes
};
const MOOD_TEMPERATURE = {
  happy: "warm",
  // Naranjas, amarillos
  dreamy: "cool",
  // Púrpuras suaves
  bluesy: "warm",
  // Naranjas rock
  sad: "cool",
  // Azules profundos
  jazzy: "cool",
  // Azules sofisticados
  spanish_exotic: "warm",
  // Rojos flamenco
  tense: "neutral",
  // Puede ser cualquiera, intenso
  universal: "neutral"
  // Adaptable
};
const DISSONANT_INTERVALS = [1, 2, 6, 10, 11];
const TRITONE_INTERVAL = 6;
const DEFAULT_CONFIG$3 = {
  throttleMs: 500,
  // REGLA 1: Throttled, no cada 30ms
  minConfidence: 0.3,
  detectDissonance: true,
  historySize: 5
};
class HarmonyDetector extends events.EventEmitter {
  constructor(config = {}) {
    super();
    __publicField(this, "config");
    __publicField(this, "scaleIdentifier");
    // Estado interno
    __publicField(this, "lastAnalysis", null);
    __publicField(this, "lastAnalysisTime", 0);
    __publicField(this, "history", []);
    // Cache de chromagrama para smoothing
    __publicField(this, "chromaHistory", []);
    this.config = { ...DEFAULT_CONFIG$3, ...config };
    this.scaleIdentifier = createScaleIdentifier();
  }
  // ============================================================
  // 📊 MÉTODO PRINCIPAL - ANALYZE
  // ============================================================
  /**
   * Analizar armonía del audio
   * 
   * ⚠️ THROTTLED: Solo ejecuta si ha pasado suficiente tiempo
   * ⚠️ REGLA 2: Siempre retorna confidence
   * 
   * @param audio AudioAnalysis del frame actual
   * @param forceAnalysis Forzar análisis ignorando throttle (para tests)
   * @returns HarmonyAnalysis con key, mode, mood, chord y confidence
   */
  analyze(audio, forceAnalysis = false) {
    var _a;
    const now = Date.now();
    if (!forceAnalysis && this.lastAnalysis && now - this.lastAnalysisTime < this.config.throttleMs) {
      return this.lastAnalysis;
    }
    const audioEnergy = this.calculateRawAudioEnergy(audio);
    if (audioEnergy < 0.05) {
      return this.createEmptyAnalysis(now);
    }
    const chromaAnalysis = this.extractChromagrama(audio);
    if (chromaAnalysis.totalEnergy < 0.1) {
      return this.createEmptyAnalysis(now);
    }
    const scaleMatch = this.scaleIdentifier.identifyScale(chromaAnalysis.chroma);
    const mood = MODE_TO_MOOD[scaleMatch.scale];
    const chord = this.estimateChord(chromaAnalysis);
    let dissonance = null;
    if (this.config.detectDissonance) {
      dissonance = this.detectDissonance(chromaAnalysis);
    }
    const analysis = {
      key: scaleMatch.rootName,
      mode: {
        scale: scaleMatch.scale,
        confidence: scaleMatch.confidence,
        mood
      },
      currentChord: chord,
      confidence: this.calculateOverallConfidence(scaleMatch, chord, chromaAnalysis),
      timestamp: now
    };
    this.updateHistory(analysis);
    this.lastAnalysis = analysis;
    this.lastAnalysisTime = now;
    this.emit("harmony", analysis);
    if (dissonance == null ? void 0 : dissonance.suggestTension) {
      this.emit("tension", dissonance);
    }
    if (this.history.length > 1) {
      const prevKey = (_a = this.history[this.history.length - 2]) == null ? void 0 : _a.key;
      if (prevKey && prevKey !== analysis.key && analysis.confidence > 0.6) {
        this.emit("key-change", { from: prevKey, to: analysis.key, confidence: analysis.confidence });
      }
    }
    return analysis;
  }
  // ============================================================
  // 🎵 DETECCIÓN DE TONALIDAD (KEY)
  // ============================================================
  /**
   * Detectar tonalidad principal
   * Usa el historial para estabilizar la detección
   */
  detectKey(audio) {
    const chroma = this.extractChromagrama(audio);
    const match = this.scaleIdentifier.identifyScale(chroma.chroma);
    return {
      key: match.rootName,
      confidence: match.confidence
    };
  }
  // ============================================================
  // 🎭 DETECCIÓN DE MODO/MOOD
  // ============================================================
  /**
   * Detectar modo y mapear a mood emocional
   */
  detectMode(audio) {
    const chroma = this.extractChromagrama(audio);
    const match = this.scaleIdentifier.identifyScale(chroma.chroma);
    const mood = MODE_TO_MOOD[match.scale];
    const temperature = MOOD_TEMPERATURE[mood];
    return {
      scale: match.scale,
      mood,
      confidence: match.confidence,
      temperature
    };
  }
  // ============================================================
  // 🎸 ESTIMACIÓN DE ACORDES
  // ============================================================
  /**
   * Estimar el acorde actual basado en el chromagrama
   * 
   * Algoritmo simplificado:
   * 1. Encontrar las 3-4 notas más fuertes
   * 2. Determinar la raíz (nota más grave con energía significativa)
   * 3. Analizar intervalos para determinar quality
   */
  estimateChord(chromaAnalysis) {
    const { chroma } = chromaAnalysis;
    const noteEnergies = chroma.map((energy, pitch) => ({ pitch, energy })).filter((n) => n.energy > 0.2).sort((a, b) => b.energy - a.energy).slice(0, 4);
    if (noteEnergies.length < 2) {
      return { root: null, quality: null, confidence: 0 };
    }
    const root = noteEnergies[0].pitch;
    const rootName = NOTE_NAMES[root];
    const intervals = noteEnergies.slice(1).map((n) => {
      let interval = n.pitch - root;
      if (interval < 0) interval += 12;
      return interval;
    });
    const quality = this.determineChordQuality(intervals);
    const confidence = this.calculateChordConfidence(noteEnergies);
    return { root: rootName, quality, confidence };
  }
  /**
   * Determinar la calidad del acorde basado en intervalos
   */
  determineChordQuality(intervals) {
    const hasInterval = (target) => intervals.includes(target);
    if (hasInterval(4) && hasInterval(7)) return "major";
    if (hasInterval(3) && hasInterval(7)) return "minor";
    if (hasInterval(3) && hasInterval(6)) return "diminished";
    if (hasInterval(4) && hasInterval(8)) return "augmented";
    if (!hasInterval(3) && !hasInterval(4) && hasInterval(5)) return "suspended";
    if (!hasInterval(3) && !hasInterval(4) && hasInterval(2)) return "suspended";
    return null;
  }
  /**
   * Calcular confianza del acorde
   */
  calculateChordConfidence(noteEnergies) {
    if (noteEnergies.length < 3) return 0.3;
    const topEnergy = noteEnergies.slice(0, 3).reduce((sum, n) => sum + n.energy, 0);
    const avgEnergy = topEnergy / 3;
    return Math.min(1, avgEnergy * 1.5);
  }
  // ============================================================
  // 😈 DETECCIÓN DE DISONANCIA
  // ============================================================
  /**
   * Detectar disonancia en el audio
   * 
   * La disonancia indica TENSIÓN musical
   * Útil para preparar efectos de strobe o colores rojos
   */
  detectDissonance(chromaAnalysis) {
    const { chroma } = chromaAnalysis;
    const presentNotes = chroma.map((energy, pitch) => ({ pitch, energy })).filter((n) => n.energy > 0.2);
    let dissonanceScore = 0;
    const detectedDissonance = [];
    let hasTritone = false;
    for (let i = 0; i < presentNotes.length; i++) {
      for (let j = i + 1; j < presentNotes.length; j++) {
        let interval = Math.abs(presentNotes[j].pitch - presentNotes[i].pitch);
        if (interval > 6) interval = 12 - interval;
        if (DISSONANT_INTERVALS.includes(interval)) {
          const weight = (presentNotes[i].energy + presentNotes[j].energy) / 2;
          dissonanceScore += weight;
          detectedDissonance.push(interval);
          if (interval === TRITONE_INTERVAL) {
            hasTritone = true;
            dissonanceScore += weight * 0.5;
          }
        }
      }
    }
    const normalizedDissonance = Math.min(1, dissonanceScore / 2);
    return {
      level: normalizedDissonance,
      hasTritone,
      disonantIntervals: [...new Set(detectedDissonance)],
      suggestTension: normalizedDissonance > 0.5 || hasTritone
    };
  }
  // ============================================================
  // 🔧 MÉTODOS AUXILIARES
  // ============================================================
  /**
   * Extraer chromagrama del audio
   * Convierte el espectro FFT a 12 pitch classes
   */
  extractChromagrama(audio) {
    const chroma = new Array(12).fill(0);
    if (audio.rawFFT && audio.rawFFT.length > 0) {
      this.fftToChroma(audio.rawFFT, chroma);
    } else {
      this.spectrumToChroma(audio.spectrum, chroma);
    }
    const maxEnergy = Math.max(...chroma, 1e-3);
    const normalizedChroma = chroma.map((e) => e / maxEnergy);
    let dominantPitch = 0;
    let maxVal = 0;
    for (let i = 0; i < 12; i++) {
      if (normalizedChroma[i] > maxVal) {
        maxVal = normalizedChroma[i];
        dominantPitch = i;
      }
    }
    this.chromaHistory.push(normalizedChroma);
    if (this.chromaHistory.length > this.config.historySize) {
      this.chromaHistory.shift();
    }
    const smoothedChroma = this.averageChroma();
    return {
      chroma: smoothedChroma,
      dominantPitch,
      totalEnergy: normalizedChroma.reduce((sum, e) => sum + e, 0)
    };
  }
  /**
   * Convertir FFT real a chromagrama
   * 
   * Algoritmo:
   * - Mapear cada bin del FFT a su pitch class correspondiente
   * - Acumular energía por pitch class
   */
  fftToChroma(fft, chroma) {
    const sampleRate = 44100;
    const binSize = sampleRate / (fft.length * 2);
    for (let i = 1; i < fft.length / 2; i++) {
      const frequency = i * binSize;
      if (frequency < 27.5 || frequency > 4186) continue;
      const midiNote = 12 * Math.log2(frequency / 440) + 69;
      if (midiNote >= 0 && midiNote < 128) {
        const pitchClass = Math.round(midiNote) % 12;
        const energy = Math.abs(fft[i]);
        chroma[pitchClass] += energy;
      }
    }
  }
  /**
   * Aproximar chromagrama desde bandas de frecuencia
   * Menos preciso pero funciona sin FFT raw
   */
  spectrumToChroma(spectrum, chroma) {
    const { bass, lowMid, mid, highMid, treble } = spectrum;
    chroma[0] += bass * 0.5;
    chroma[4] += bass * 0.3;
    chroma[7] += bass * 0.2;
    chroma[2] += lowMid * 0.3;
    chroma[5] += lowMid * 0.3;
    chroma[9] += lowMid * 0.3;
    for (let i = 0; i < 12; i++) {
      chroma[i] += mid * 0.1;
    }
    chroma[0] += highMid * 0.2;
    chroma[4] += highMid * 0.15;
    chroma[7] += highMid * 0.15;
    chroma[11] += treble * 0.1;
  }
  /**
   * Promediar chromagramas del historial para smoothing
   */
  averageChroma() {
    if (this.chromaHistory.length === 0) {
      return new Array(12).fill(0);
    }
    const avg = new Array(12).fill(0);
    for (const chroma of this.chromaHistory) {
      for (let i = 0; i < 12; i++) {
        avg[i] += chroma[i];
      }
    }
    const count = this.chromaHistory.length;
    return avg.map((v) => v / count);
  }
  /**
   * Calcular confianza general del análisis
   */
  calculateOverallConfidence(scaleMatch, chord, chromaAnalysis) {
    const scaleConfidence = scaleMatch.confidence;
    const chordConfidence = chord.confidence;
    const energyConfidence = Math.min(1, chromaAnalysis.totalEnergy / 6);
    return scaleConfidence * 0.4 + chordConfidence * 0.3 + energyConfidence * 0.3;
  }
  /**
   * Calcular energía raw del audio (antes de normalización)
   * Útil para detectar silencio
   */
  calculateRawAudioEnergy(audio) {
    const { spectrum, energy } = audio;
    if (energy && typeof energy.current === "number") {
      return energy.current;
    }
    const { bass, lowMid, mid, highMid, treble } = spectrum;
    return (bass + lowMid + mid + highMid + treble) / 5;
  }
  /**
   * Crear análisis vacío para cuando no hay señal
   */
  createEmptyAnalysis(timestamp) {
    return {
      key: null,
      mode: {
        scale: "chromatic",
        confidence: 0,
        mood: "universal"
      },
      currentChord: {
        root: null,
        quality: null,
        confidence: 0
      },
      confidence: 0,
      timestamp
    };
  }
  /**
   * Actualizar historial de análisis
   */
  updateHistory(analysis) {
    this.history.push(analysis);
    if (this.history.length > this.config.historySize) {
      this.history.shift();
    }
  }
  // ============================================================
  // 📤 GETTERS Y UTILIDADES
  // ============================================================
  /**
   * Obtener último análisis (del caché)
   */
  getLastAnalysis() {
    return this.lastAnalysis;
  }
  /**
   * Obtener historial de análisis
   */
  getHistory() {
    return [...this.history];
  }
  /**
   * Obtener temperatura de color sugerida para el mood actual
   */
  getSuggestedTemperature() {
    if (!this.lastAnalysis) return "neutral";
    return MOOD_TEMPERATURE[this.lastAnalysis.mode.mood];
  }
  /**
   * Resetear estado interno
   */
  reset() {
    this.lastAnalysis = null;
    this.lastAnalysisTime = 0;
    this.history = [];
    this.chromaHistory = [];
  }
  /**
   * Actualizar configuración
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
  }
}
function createHarmonyDetector(config) {
  return new HarmonyDetector(config);
}
new HarmonyDetector();
const SECTION_PROFILES = {
  intro: {
    energyRange: [0.1, 0.4],
    typicalDuration: [8, 32],
    characteristics: ["low_energy", "building", "sparse"]
  },
  verse: {
    energyRange: [0.3, 0.6],
    typicalDuration: [16, 64],
    characteristics: ["moderate_energy", "steady", "melodic"]
  },
  pre_chorus: {
    energyRange: [0.5, 0.7],
    typicalDuration: [8, 16],
    characteristics: ["rising_energy", "anticipation"]
  },
  chorus: {
    energyRange: [0.6, 0.9],
    typicalDuration: [16, 32],
    characteristics: ["high_energy", "full_instrumentation"]
  },
  bridge: {
    energyRange: [0.4, 0.6],
    typicalDuration: [8, 16],
    characteristics: ["different_texture", "contrast"]
  },
  buildup: {
    energyRange: [0.5, 0.95],
    typicalDuration: [8, 32],
    characteristics: ["rising_energy", "tension", "snare_roll", "filter_sweep"]
  },
  drop: {
    energyRange: [0.8, 1],
    typicalDuration: [16, 64],
    characteristics: ["peak_energy", "bass_heavy", "full_impact"]
  },
  breakdown: {
    energyRange: [0.2, 0.5],
    typicalDuration: [8, 32],
    characteristics: ["low_energy", "stripped_back", "atmospheric"]
  },
  outro: {
    energyRange: [0.1, 0.4],
    typicalDuration: [8, 32],
    characteristics: ["falling_energy", "fading", "sparse"]
  },
  unknown: {
    energyRange: [0, 1],
    typicalDuration: [4, 120],
    characteristics: []
  }
};
const SECTION_TRANSITIONS = {
  intro: [
    { to: "verse", probability: 0.5 },
    { to: "buildup", probability: 0.3 },
    { to: "drop", probability: 0.2 }
  ],
  verse: [
    { to: "pre_chorus", probability: 0.4 },
    { to: "chorus", probability: 0.3 },
    { to: "buildup", probability: 0.2 },
    { to: "bridge", probability: 0.1 }
  ],
  pre_chorus: [
    { to: "chorus", probability: 0.7 },
    { to: "buildup", probability: 0.2 },
    { to: "drop", probability: 0.1 }
  ],
  chorus: [
    { to: "verse", probability: 0.3 },
    { to: "breakdown", probability: 0.25 },
    { to: "bridge", probability: 0.2 },
    { to: "buildup", probability: 0.15 },
    { to: "outro", probability: 0.1 }
  ],
  bridge: [
    { to: "chorus", probability: 0.5 },
    { to: "buildup", probability: 0.3 },
    { to: "breakdown", probability: 0.2 }
  ],
  buildup: [
    { to: "drop", probability: 0.8 },
    { to: "chorus", probability: 0.15 },
    { to: "breakdown", probability: 0.05 }
  ],
  drop: [
    { to: "breakdown", probability: 0.4 },
    { to: "buildup", probability: 0.3 },
    { to: "verse", probability: 0.15 },
    { to: "outro", probability: 0.15 }
  ],
  breakdown: [
    { to: "buildup", probability: 0.5 },
    { to: "verse", probability: 0.25 },
    { to: "drop", probability: 0.15 },
    { to: "outro", probability: 0.1 }
  ],
  outro: [
    { to: "unknown", probability: 1 }
    // Fin de canción
  ],
  unknown: [
    { to: "intro", probability: 0.5 },
    { to: "verse", probability: 0.3 },
    { to: "drop", probability: 0.2 }
  ]
};
const DEFAULT_CONFIG$2 = {
  throttleMs: 500,
  // REGLA 1: Throttled
  energyHistorySize: 20,
  // ~10 segundos de historial
  energyChangeThreshold: 0.25,
  // Cambio del 25% = transición
  minSectionDuration: 4e3
  // Mínimo 4 segundos por sección
};
class SectionTracker extends events.EventEmitter {
  constructor(config = {}) {
    super();
    __publicField(this, "config");
    // Estado interno
    __publicField(this, "currentSection", "unknown");
    __publicField(this, "sectionStartTime", 0);
    __publicField(this, "lastAnalysisTime", 0);
    __publicField(this, "cachedAnalysis", null);
    // Historial de energía para detectar trends
    __publicField(this, "energyHistory", []);
    // Contadores para estabilizar detección
    __publicField(this, "sectionVotes", /* @__PURE__ */ new Map());
    __publicField(this, "consecutiveSection", 0);
    this.config = { ...DEFAULT_CONFIG$2, ...config };
  }
  // ============================================================
  // 📊 MÉTODO PRINCIPAL - TRACK
  // ============================================================
  /**
   * Analizar y trackear sección actual
   * 
   * ⚠️ THROTTLED: Solo ejecuta si ha pasado suficiente tiempo
   * ⚠️ REGLA 2: Siempre retorna confidence
   * 
   * @param rhythm Análisis rítmico del frame actual
   * @param harmony Análisis armónico (puede ser null si no está disponible)
   * @param audio Métricas de audio del frame actual
   * @param forceAnalysis Forzar análisis ignorando throttle (para tests)
   */
  track(rhythm, _harmony, audio, forceAnalysis = false) {
    const now = Date.now();
    if (!forceAnalysis && this.cachedAnalysis && now - this.lastAnalysisTime < this.config.throttleMs) {
      return this.cachedAnalysis;
    }
    this.updateEnergyHistory(audio, now);
    const intensity = this.calculateIntensity(audio, rhythm);
    const trend = this.detectEnergyTrend();
    const detectedSection = this.detectSection(intensity, trend, rhythm, audio);
    this.handleSectionChange(detectedSection, now);
    const prediction = this.predictNextSection(trend, rhythm);
    const confidence = this.calculateConfidence(rhythm);
    const analysis = {
      current: {
        type: this.currentSection,
        confidence: this.calculateSectionConfidence(),
        startedAt: this.sectionStartTime,
        duration: now - this.sectionStartTime
      },
      predicted: prediction,
      intensity,
      intensityTrend: trend,
      confidence,
      timestamp: now
    };
    this.cachedAnalysis = analysis;
    this.lastAnalysisTime = now;
    this.emit("section", analysis);
    return analysis;
  }
  // ============================================================
  // 🔋 CÁLCULO DE ENERGÍA E INTENSIDAD
  // ============================================================
  /**
   * Actualizar historial de energía
   */
  updateEnergyHistory(audio, timestamp) {
    const frame = {
      energy: audio.energy,
      bass: audio.bass,
      intensity: audio.bass * 0.4 + audio.mid * 0.3 + audio.energy * 0.3,
      timestamp
    };
    this.energyHistory.push(frame);
    while (this.energyHistory.length > this.config.energyHistorySize) {
      this.energyHistory.shift();
    }
  }
  /**
   * Calcular intensidad actual (0-1)
   * 
   * Combina:
   * - Energía del audio (40%)
   * - Bass (30%)
   * - Actividad de drums (30%)
   */
  calculateIntensity(audio, rhythm) {
    const audioIntensity = audio.energy;
    const bassIntensity = audio.bass;
    const drumActivity = (rhythm.drums.kickDetected ? rhythm.drums.kickIntensity : 0) * 0.4 + (rhythm.drums.snareDetected ? rhythm.drums.snareIntensity : 0) * 0.3 + (rhythm.drums.hihatDetected ? rhythm.drums.hihatIntensity : 0) * 0.3;
    return Math.min(1, audioIntensity * 0.4 + bassIntensity * 0.3 + drumActivity * 0.3);
  }
  /**
   * Detectar tendencia de energía
   * 
   * Analiza el historial para determinar si la energía está:
   * - rising: Subiendo (típico de buildup)
   * - falling: Bajando (típico de breakdown/outro)
   * - stable: Estable
   */
  detectEnergyTrend() {
    if (this.energyHistory.length < 4) {
      return "stable";
    }
    const midPoint = Math.floor(this.energyHistory.length / 2);
    const firstHalf = this.energyHistory.slice(0, midPoint);
    const secondHalf = this.energyHistory.slice(midPoint);
    const avgFirst = firstHalf.reduce((sum, f) => sum + f.intensity, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, f) => sum + f.intensity, 0) / secondHalf.length;
    const change = avgSecond - avgFirst;
    const threshold = this.config.energyChangeThreshold / 4;
    if (change > threshold) {
      return "rising";
    } else if (change < -threshold) {
      return "falling";
    }
    return "stable";
  }
  // ============================================================
  // 🎯 DETECCIÓN DE SECCIÓN
  // ============================================================
  /**
   * Detectar tipo de sección actual
   * 
   * Algoritmo:
   * 1. Analizar nivel de intensidad
   * 2. Analizar trend de energía
   * 3. Analizar características de drums
   * 4. Votar por sección más probable
   */
  detectSection(intensity, trend, rhythm, audio) {
    this.sectionVotes.clear();
    if (intensity > 0.75 && audio.bass > 0.7 && rhythm.drums.kickDetected) {
      this.addVote("drop", 0.8);
    }
    if (trend === "rising" && intensity > 0.4 && intensity < 0.9) {
      this.addVote("buildup", 0.7);
      if (rhythm.fillInProgress) {
        this.addVote("buildup", 0.2);
      }
    }
    if (intensity < 0.4 && trend === "falling") {
      this.addVote("breakdown", 0.6);
    }
    if (intensity >= 0.3 && intensity <= 0.6 && trend === "stable") {
      this.addVote("verse", 0.5);
    }
    if (intensity > 0.6 && intensity < 0.85 && trend === "stable") {
      this.addVote("chorus", 0.6);
    }
    if (intensity < 0.35 && this.currentSection === "unknown") {
      this.addVote("intro", 0.7);
    }
    if (intensity < 0.35 && trend === "falling" && (this.currentSection === "drop" || this.currentSection === "chorus")) {
      this.addVote("outro", 0.5);
    }
    return this.getMostVotedSection();
  }
  /**
   * Añadir voto para una sección
   */
  addVote(section, weight) {
    const current = this.sectionVotes.get(section) || 0;
    this.sectionVotes.set(section, current + weight);
  }
  /**
   * Obtener sección con más votos
   */
  getMostVotedSection() {
    let maxVotes = 0;
    let winner = this.currentSection;
    for (const [section, votes] of this.sectionVotes) {
      if (votes > maxVotes) {
        maxVotes = votes;
        winner = section;
      }
    }
    return winner;
  }
  /**
   * Manejar cambio de sección
   */
  handleSectionChange(detected, now) {
    if (detected !== this.currentSection) {
      const duration = now - this.sectionStartTime;
      if (duration >= this.config.minSectionDuration || this.currentSection === "unknown") {
        const oldSection = this.currentSection;
        this.currentSection = detected;
        this.sectionStartTime = now;
        this.consecutiveSection = 1;
        this.emit("section-change", {
          from: oldSection,
          to: detected,
          timestamp: now
        });
      }
    } else {
      this.consecutiveSection++;
    }
  }
  // ============================================================
  // 🔮 PREDICCIÓN DE SIGUIENTE SECCIÓN
  // ============================================================
  /**
   * Predecir la siguiente sección
   * 
   * Basado en:
   * 1. Transiciones típicas desde sección actual
   * 2. Trend de energía actual
   * 3. Señales de transición (fills, etc.)
   */
  predictNextSection(trend, rhythm) {
    const transitions = SECTION_TRANSITIONS[this.currentSection];
    if (!transitions || transitions.length === 0) {
      return null;
    }
    const adjusted = transitions.map((t) => {
      let probability = t.probability;
      if (trend === "rising") {
        if (t.to === "buildup" || t.to === "drop") {
          probability *= 1.5;
        }
        if (t.to === "breakdown" || t.to === "outro") {
          probability *= 0.5;
        }
      }
      if (trend === "falling") {
        if (t.to === "breakdown" || t.to === "outro") {
          probability *= 1.5;
        }
        if (t.to === "buildup" || t.to === "drop") {
          probability *= 0.5;
        }
      }
      if (rhythm.fillInProgress) {
        if (t.to === "drop" || t.to === "chorus") {
          probability *= 1.3;
        }
      }
      return { ...t, probability: Math.min(1, probability) };
    });
    const total = adjusted.reduce((sum, t) => sum + t.probability, 0);
    const normalized = adjusted.map((t) => ({
      ...t,
      probability: t.probability / total
    }));
    const best = normalized.reduce(
      (a, b) => a.probability > b.probability ? a : b
    );
    const sectionDuration = Date.now() - this.sectionStartTime;
    const profile = SECTION_PROFILES[this.currentSection];
    const avgDuration = (profile.typicalDuration[0] + profile.typicalDuration[1]) / 2 * 1e3;
    const estimatedIn = Math.max(1e3, avgDuration - sectionDuration);
    return {
      type: best.to,
      probability: best.probability,
      estimatedIn
    };
  }
  // ============================================================
  // 📊 CÁLCULO DE CONFIANZA
  // ============================================================
  /**
   * Calcular confianza de la sección actual
   */
  calculateSectionConfidence() {
    const duration = Date.now() - this.sectionStartTime;
    const durationFactor = Math.min(1, duration / 1e4);
    const voteConfidence = Math.min(1, this.consecutiveSection / 10);
    return durationFactor * 0.5 + voteConfidence * 0.5;
  }
  /**
   * Calcular confianza general del análisis
   * 
   * ⚠️ REGLA 2: Si < 0.5, el orquestador usará fallback
   */
  calculateConfidence(rhythm) {
    const historyFactor = Math.min(1, this.energyHistory.length / 10);
    const rhythmFactor = rhythm.confidence;
    const stabilityFactor = this.calculateSectionConfidence();
    return historyFactor * 0.3 + rhythmFactor * 0.4 + stabilityFactor * 0.3;
  }
  // ============================================================
  // 📤 GETTERS Y UTILIDADES
  // ============================================================
  /**
   * Obtener último análisis (caché)
   */
  getLastAnalysis() {
    return this.cachedAnalysis;
  }
  /**
   * Obtener sección actual
   */
  getCurrentSection() {
    return this.currentSection;
  }
  /**
   * Verificar si estamos en buildup (útil para preparar el drop)
   */
  isBuildup() {
    return this.currentSection === "buildup";
  }
  /**
   * Verificar si estamos en drop (máxima energía)
   */
  isDrop() {
    return this.currentSection === "drop";
  }
  /**
   * Reset del tracker
   */
  reset() {
    this.currentSection = "unknown";
    this.sectionStartTime = 0;
    this.lastAnalysisTime = 0;
    this.cachedAnalysis = null;
    this.energyHistory = [];
    this.sectionVotes.clear();
    this.consecutiveSection = 0;
  }
}
function createSectionTracker(config) {
  return new SectionTracker(config);
}
new SectionTracker();
const GENRE_RULES = [
  // CUMBIA: Güiro (treble) + BPM medio + sincopación media
  {
    genre: "cumbia",
    bpmRange: { min: 85, max: 115, ideal: 95 },
    syncopationRange: { min: 0.2, max: 0.45 },
    trebleDensityRange: { min: 0.4, max: 0.9 },
    priorityBonus: 0.1
    // Bonus por treble característico
  },
  // REGGAETON: Dembow + BPM específico + sincopación alta
  {
    genre: "reggaeton",
    bpmRange: { min: 88, max: 102, ideal: 95 },
    syncopationRange: { min: 0.35, max: 0.7 },
    requiresDembow: true,
    priorityBonus: 0.15
    // El dembow es muy distintivo
  },
  // TECHNO: Four-on-floor + BPM alto + sincopación muy baja
  {
    genre: "techno",
    bpmRange: { min: 125, max: 150, ideal: 135 },
    syncopationRange: { min: 0, max: 0.15 },
    requiresFourOnFloor: true,
    priorityBonus: 0.1
  },
  // HOUSE: Four-on-floor + BPM medio + sincopación moderada
  {
    genre: "house",
    bpmRange: { min: 118, max: 132, ideal: 125 },
    syncopationRange: { min: 0.1, max: 0.35 },
    requiresFourOnFloor: true
  },
  // TRAP: BPM lento + 808s + hi-hats rápidos
  {
    genre: "trap",
    bpmRange: { min: 60, max: 90, ideal: 75 },
    syncopationRange: { min: 0.3, max: 0.6 },
    requires808: true,
    trebleDensityRange: { min: 0.5, max: 1 },
    priorityBonus: 0.1
  },
  // DRUM AND BASS: BPM muy alto + sincopación alta
  {
    genre: "drum_and_bass",
    bpmRange: { min: 160, max: 180, ideal: 174 },
    syncopationRange: { min: 0.4, max: 0.8 }
  },
  // LATIN POP: BPM variable + sincopación media + sin patrones extremos
  {
    genre: "latin_pop",
    bpmRange: { min: 90, max: 130, ideal: 110 },
    syncopationRange: { min: 0.15, max: 0.4 }
  },
  // AMBIENT: BPM bajo o variable + sincopación muy baja
  {
    genre: "ambient",
    bpmRange: { min: 60, max: 120, ideal: 90 },
    syncopationRange: { min: 0, max: 0.1 }
  }
];
const SUBGENRE_RULES = {
  cumbia: {
    happy: "cumbia_santafesina",
    energetic: "cumbia_villera",
    melancholic: "cumbia_colombiana",
    default: "cumbia_villera"
  },
  reggaeton: {
    energetic: "reggaeton_clasico",
    dark: "dembow",
    default: "reggaeton_moderno"
  },
  techno: {
    dark: "techno_dark",
    melancholic: "techno_melodic",
    default: "techno_dark"
  },
  house: {
    happy: "progressive_house",
    melancholic: "deep_house",
    energetic: "tech_house",
    default: "deep_house"
  },
  trap: {
    dark: "trap_808",
    melancholic: "latin_trap",
    default: "latin_trap"
  },
  latin_pop: { default: "none" },
  drum_and_bass: { default: "none" },
  ambient: { default: "none" },
  unknown: { default: "none" }
};
const GENRE_MOOD_MAP = {
  cumbia: "fiesta",
  reggaeton: "fiesta",
  techno: "hipnotico",
  house: "relajado",
  trap: "oscuro",
  drum_and_bass: "energetico",
  latin_pop: "relajado",
  ambient: "melancolico",
  unknown: "neutral"
};
const DEFAULT_CONFIG$1 = {
  throttleMs: 200,
  minConfidence: 0.3,
  bpmWeight: 0.3,
  syncopationWeight: 0.25,
  patternWeight: 0.3,
  trebleWeight: 0.15
};
class GenreClassifier {
  constructor(config = {}) {
    __publicField(this, "config");
    __publicField(this, "cachedAnalysis", null);
    __publicField(this, "lastAnalysisTime", 0);
    // Historial para suavizado
    __publicField(this, "genreHistory", []);
    __publicField(this, "historySize", 8);
    this.config = { ...DEFAULT_CONFIG$1, ...config };
  }
  // ═══════════════════════════════════════════════════════════════════════════
  // API PÚBLICA
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * 🎭 CLASSIFY - Punto de entrada principal
   * 
   * Analiza el frame actual y clasifica el género musical.
   * 
   * ⚠️ THROTTLED: Solo ejecuta análisis completo cada 200ms
   * ⚠️ REGLA 2: Siempre retorna confidence
   * 
   * @param rhythm Análisis rítmico del frame
   * @param harmony Análisis armónico (puede ser null)
   * @param audio Métricas de audio
   * @param forceAnalysis Ignorar throttle (para tests)
   */
  classify(rhythm, harmony, audio, forceAnalysis = false) {
    const now = Date.now();
    if (!forceAnalysis && this.cachedAnalysis && now - this.lastAnalysisTime < this.config.throttleMs) {
      return this.cachedAnalysis;
    }
    const features = this.extractFeatures(rhythm, audio);
    const scores = this.calculateGenreScores(features);
    const { genre, confidence } = this.selectWinningGenre(scores, features);
    const subgenre = this.determineSubgenre(genre, harmony);
    const mood = this.determineMood(genre, harmony);
    this.updateHistory(genre);
    const analysis = {
      genre,
      subgenre,
      confidence,
      scores,
      features,
      mood
    };
    this.cachedAnalysis = analysis;
    this.lastAnalysisTime = now;
    return analysis;
  }
  /**
   * Obtiene el género más común del historial reciente
   * Útil para estabilidad en la clasificación
   */
  getDominantGenre() {
    if (this.genreHistory.length === 0) return "unknown";
    const counts = /* @__PURE__ */ new Map();
    for (const g of this.genreHistory) {
      counts.set(g, (counts.get(g) || 0) + 1);
    }
    let maxCount = 0;
    let dominant = "unknown";
    for (const [genre, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        dominant = genre;
      }
    }
    return dominant;
  }
  /**
   * Reset del estado interno
   */
  reset() {
    this.cachedAnalysis = null;
    this.lastAnalysisTime = 0;
    this.genreHistory = [];
  }
  // ═══════════════════════════════════════════════════════════════════════════
  // EXTRACCIÓN DE CARACTERÍSTICAS
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * Extrae las características relevantes para clasificación
   */
  extractFeatures(rhythm, audio) {
    const bpm = rhythm.bpm;
    const syncopation = rhythm.groove.syncopation;
    const hasFourOnFloor = this.detectFourOnFloor(rhythm);
    const hasDembow = this.detectDembow(rhythm, bpm);
    const totalSpectrum = audio.bass + audio.mid + audio.treble + 1e-3;
    const trebleDensity = audio.treble / totalSpectrum;
    const has808Bass = audio.bass > 0.6 && audio.mid < audio.bass * 0.5;
    return {
      bpm,
      syncopation,
      hasFourOnFloor,
      hasDembow,
      trebleDensity,
      has808Bass,
      avgEnergy: audio.energy
    };
  }
  /**
   * Detecta patrón four-on-floor (kick en cada beat)
   * Característico de techno, house
   */
  detectFourOnFloor(rhythm) {
    const groove = rhythm.groove;
    return groove.syncopation < 0.2 && rhythm.drums.kickIntensity > 0.5 && rhythm.confidence > 0.5;
  }
  /**
   * Detecta patrón dembow (reggaeton)
   * El dembow tiene kick + snare en patrón específico 3+3+2
   */
  detectDembow(rhythm, bpm) {
    if (bpm < 85 || bpm > 105) return false;
    const groove = rhythm.groove;
    return groove.syncopation > 0.45 && groove.syncopation < 0.75 && rhythm.drums.snareIntensity > 0.6;
  }
  // ═══════════════════════════════════════════════════════════════════════════
  // CÁLCULO DE SCORES
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * Calcula el score para cada género basado en las características
   */
  calculateGenreScores(features) {
    const scores = {
      cumbia: 0,
      reggaeton: 0,
      techno: 0,
      house: 0,
      trap: 0,
      drum_and_bass: 0,
      latin_pop: 0,
      ambient: 0,
      unknown: 0.1
      // Base score para unknown
    };
    for (const rule of GENRE_RULES) {
      scores[rule.genre] = this.calculateRuleScore(rule, features);
    }
    return scores;
  }
  /**
   * Calcula el score para una regla específica
   */
  calculateRuleScore(rule, features) {
    let score = 0;
    let totalWeight = 0;
    const bpmScore = this.calculateBpmScore(
      features.bpm,
      rule.bpmRange.min,
      rule.bpmRange.max,
      rule.bpmRange.ideal
    );
    score += bpmScore * this.config.bpmWeight;
    totalWeight += this.config.bpmWeight;
    const syncScore = this.calculateRangeScore(
      features.syncopation,
      rule.syncopationRange.min,
      rule.syncopationRange.max
    );
    score += syncScore * this.config.syncopationWeight;
    totalWeight += this.config.syncopationWeight;
    let patternScore = 0.5;
    if (rule.requiresFourOnFloor !== void 0) {
      patternScore = rule.requiresFourOnFloor === features.hasFourOnFloor ? 1 : 0;
    }
    if (rule.requiresDembow !== void 0) {
      patternScore = rule.requiresDembow === features.hasDembow ? 1 : 0;
    }
    score += patternScore * this.config.patternWeight;
    totalWeight += this.config.patternWeight;
    let trebleScore = 0.5;
    if (rule.trebleDensityRange) {
      trebleScore = this.calculateRangeScore(
        features.trebleDensity,
        rule.trebleDensityRange.min,
        rule.trebleDensityRange.max
      );
    }
    score += trebleScore * this.config.trebleWeight;
    totalWeight += this.config.trebleWeight;
    if (rule.requires808 !== void 0) {
      if (rule.requires808 !== features.has808Bass) {
        score *= 0.5;
      }
    }
    const normalizedScore = totalWeight > 0 ? score / totalWeight : 0;
    const bonus = rule.priorityBonus || 0;
    return normalizedScore > 0.4 ? Math.min(1, normalizedScore + bonus) : normalizedScore;
  }
  /**
   * Calcula score de BPM con preferencia por el ideal
   */
  calculateBpmScore(bpm, min, max, ideal) {
    if (bpm < min - 10 || bpm > max + 10) return 0;
    if (bpm < min || bpm > max) {
      const distance = bpm < min ? min - bpm : bpm - max;
      return Math.max(0, 0.5 - distance / 20);
    }
    const distanceToIdeal = Math.abs(bpm - ideal);
    const maxDistance = Math.max(ideal - min, max - ideal);
    return 1 - distanceToIdeal / maxDistance * 0.5;
  }
  /**
   * Calcula score para un valor dentro de un rango
   */
  calculateRangeScore(value, min, max) {
    if (value < min || value > max) {
      const distance = value < min ? min - value : value - max;
      return Math.max(0, 1 - distance * 2);
    }
    const center = (min + max) / 2;
    const halfRange = (max - min) / 2;
    const distanceToCenter = Math.abs(value - center);
    return 1 - distanceToCenter / halfRange * 0.3;
  }
  // ═══════════════════════════════════════════════════════════════════════════
  // SELECCIÓN Y DETERMINACIÓN
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * Selecciona el género ganador basado en scores
   */
  selectWinningGenre(scores, features) {
    let maxScore = 0;
    let winningGenre = "unknown";
    for (const [genre, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        winningGenre = genre;
      }
    }
    const dominantGenre = this.getDominantGenre();
    if (dominantGenre !== "unknown" && dominantGenre !== winningGenre && scores[dominantGenre] > maxScore * 0.85) {
      winningGenre = dominantGenre;
      maxScore = scores[dominantGenre];
    }
    const sortedScores = Object.values(scores).sort((a, b) => b - a);
    const scoreDiff = sortedScores[0] - (sortedScores[1] || 0);
    let confidence = maxScore * (0.5 + scoreDiff);
    if (features.hasFourOnFloor && (winningGenre === "techno" || winningGenre === "house")) {
      confidence += 0.1;
    }
    if (features.hasDembow && winningGenre === "reggaeton") {
      confidence += 0.15;
    }
    if (maxScore < this.config.minConfidence) {
      return { genre: "unknown", confidence: maxScore };
    }
    return {
      genre: winningGenre,
      confidence: Math.min(1, confidence)
    };
  }
  /**
   * Determina el subgénero basado en características armónicas
   */
  determineSubgenre(genre, harmony) {
    var _a;
    const subgenreRules = SUBGENRE_RULES[genre];
    if (!subgenreRules) return "none";
    if (!harmony || !((_a = harmony.mode) == null ? void 0 : _a.mood)) {
      return subgenreRules["default"] || "none";
    }
    const mood = harmony.mode.mood.toLowerCase();
    if (subgenreRules[mood]) {
      return subgenreRules[mood];
    }
    return subgenreRules["default"] || "none";
  }
  /**
   * Determina el mood basado en género y armonía
   */
  determineMood(genre, harmony) {
    var _a;
    const baseMood = GENRE_MOOD_MAP[genre];
    if ((_a = harmony == null ? void 0 : harmony.mode) == null ? void 0 : _a.mood) {
      const harmonyMood = harmony.mode.mood.toLowerCase();
      if (harmonyMood.includes("dark") || harmonyMood.includes("tense")) {
        return "oscuro";
      }
      if (harmonyMood.includes("sad") || harmonyMood.includes("melan")) {
        return "melancolico";
      }
      if (harmonyMood.includes("happy") || harmonyMood.includes("bright")) {
        if (genre === "techno" || genre === "house") {
          return "energetico";
        }
        return "fiesta";
      }
    }
    return baseMood;
  }
  /**
   * Actualiza el historial de géneros
   */
  updateHistory(genre) {
    this.genreHistory.push(genre);
    while (this.genreHistory.length > this.historySize) {
      this.genreHistory.shift();
    }
  }
}
const DEFAULT_CONFIG = {
  historySize: 8,
  minProbabilityThreshold: 0.6,
  referenceBpm: 120,
  dropAnticipationBars: 2,
  enableTransitionPrediction: true,
  enableFillPrediction: true
};
const PROGRESSION_PATTERNS = [
  // Buildup prolongado → Drop inminente
  {
    pattern: ["buildup", "buildup"],
    nextProbable: "drop",
    probability: 0.9,
    predictionType: "drop_incoming"
  },
  {
    pattern: ["verse", "pre_chorus"],
    nextProbable: "chorus",
    probability: 0.85,
    predictionType: "transition_beat"
  },
  {
    pattern: ["chorus", "chorus"],
    nextProbable: "verse",
    probability: 0.7,
    predictionType: "transition_beat"
  },
  {
    pattern: ["chorus", "verse"],
    nextProbable: "bridge",
    probability: 0.6,
    predictionType: "transition_beat"
  },
  {
    pattern: ["drop", "drop"],
    nextProbable: "breakdown",
    probability: 0.75,
    predictionType: "breakdown_imminent"
  },
  {
    pattern: ["breakdown"],
    nextProbable: "buildup",
    probability: 0.8,
    predictionType: "buildup_starting"
  },
  {
    pattern: ["intro"],
    nextProbable: "verse",
    probability: 0.85,
    predictionType: "transition_beat"
  },
  {
    pattern: ["verse", "verse"],
    nextProbable: "pre_chorus",
    probability: 0.65,
    predictionType: "transition_beat"
  }
];
const PREDICTION_ACTIONS = {
  drop_incoming: {
    preAction: {
      type: "prepare",
      effect: "intensity_ramp",
      intensity: 0.8,
      duration: 2e3,
      timing: -2e3
    },
    mainAction: {
      type: "execute",
      effect: "flash",
      intensity: 1,
      duration: 200,
      timing: 0
    },
    postAction: {
      type: "recover",
      effect: "strobe",
      intensity: 0.9,
      duration: 4e3,
      timing: 200
    }
  },
  buildup_starting: {
    preAction: {
      type: "prepare",
      effect: "color_shift",
      intensity: 0.5,
      duration: 500,
      timing: -500
    },
    mainAction: {
      type: "execute",
      effect: "intensity_ramp",
      intensity: 0.7,
      duration: 8e3,
      timing: 0
    }
  },
  breakdown_imminent: {
    preAction: {
      type: "prepare",
      effect: "breathe",
      intensity: 0.4,
      duration: 1e3,
      timing: -1e3
    },
    mainAction: {
      type: "execute",
      effect: "breathe",
      intensity: 0.3,
      duration: 4e3,
      timing: 0
    }
  },
  transition_beat: {
    mainAction: {
      type: "execute",
      effect: "pulse",
      intensity: 0.6,
      duration: 500,
      timing: 0
    }
  },
  fill_expected: {
    mainAction: {
      type: "execute",
      effect: "flash",
      intensity: 0.7,
      duration: 300,
      timing: 0
    }
  },
  key_change: {
    preAction: {
      type: "prepare",
      effect: "color_shift",
      intensity: 0.6,
      duration: 1e3,
      timing: -500
    },
    mainAction: {
      type: "execute",
      effect: "color_shift",
      intensity: 0.8,
      duration: 2e3,
      timing: 0
    }
  }
};
class PredictionMatrix extends events.EventEmitter {
  constructor(config = {}) {
    super();
    __publicField(this, "config");
    __publicField(this, "sectionHistory", []);
    __publicField(this, "lastPrediction", null);
    __publicField(this, "lastAnalysisTime", 0);
    __publicField(this, "cachedResult", null);
    __publicField(this, "fillHistory", []);
    // Performance tracking
    __publicField(this, "analysisCount", 0);
    __publicField(this, "totalAnalysisTime", 0);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  // ============================================================
  // 🎯 MÉTODO PRINCIPAL: GENERATE
  // ============================================================
  /**
   * Genera predicciones basadas en el contexto musical actual
   * 
   * ⚠️ REGLA 1: Throttled 500ms
   * 
   * @param rhythm - Análisis rítmico actual
   * @param section - Análisis de sección actual
   * @param forceAnalysis - Forzar análisis (ignorar throttle)
   * @returns Predicción extendida con acciones sugeridas
   */
  generate(rhythm, section, forceAnalysis = false) {
    const startTime = performance.now();
    const now = Date.now();
    if (!forceAnalysis && now - this.lastAnalysisTime < 500 && this.cachedResult) {
      return this.cachedResult;
    }
    this.lastAnalysisTime = now;
    this.updateSectionHistory(section);
    if (rhythm.fillInProgress) {
      this.fillHistory.push(now);
      if (this.fillHistory.length > 10) {
        this.fillHistory.shift();
      }
    }
    const prediction = this.analyzePatterns(rhythm, section);
    if (prediction) {
      this.cachedResult = prediction;
      this.lastPrediction = prediction;
      this.emit("prediction", prediction);
    }
    const elapsed = performance.now() - startTime;
    this.totalAnalysisTime += elapsed;
    this.analysisCount++;
    return prediction;
  }
  // ============================================================
  // 🔍 ANÁLISIS DE PATRONES
  // ============================================================
  /**
   * Analiza el historial de secciones para detectar patrones
   */
  analyzePatterns(rhythm, section) {
    const predictions = [];
    const sectionPrediction = this.predictFromSectionPattern(section);
    if (sectionPrediction) {
      predictions.push(sectionPrediction);
    }
    const dropPrediction = this.predictDrop(section, rhythm);
    if (dropPrediction) {
      predictions.push(dropPrediction);
    }
    if (this.config.enableFillPrediction) {
      const fillPrediction = this.predictFromFills(rhythm, section);
      if (fillPrediction) {
        predictions.push(fillPrediction);
      }
    }
    if (predictions.length === 0) {
      return null;
    }
    predictions.sort((a, b) => b.probability - a.probability);
    const bestPrediction = predictions[0];
    if (bestPrediction.probability < this.config.minProbabilityThreshold) {
      return null;
    }
    return bestPrediction;
  }
  /**
   * Predice basándose en patrones de sección conocidos
   */
  predictFromSectionPattern(section) {
    if (this.sectionHistory.length < 1) {
      return null;
    }
    const recentSections = this.sectionHistory.slice(-3).map((s) => s.type);
    for (const pattern of PROGRESSION_PATTERNS) {
      if (this.matchesPattern(recentSections, pattern.pattern)) {
        const bpm = this.getEstimatedBpm();
        const beatsPerBar = 4;
        const msPerBar = 6e4 / bpm * beatsPerBar;
        const barsUntilTransition = 4;
        const timeUntil = msPerBar * barsUntilTransition;
        const beatsUntil = beatsPerBar * barsUntilTransition;
        return {
          type: pattern.predictionType,
          probability: pattern.probability * section.confidence,
          timeUntil,
          beatsUntil,
          timestamp: Date.now(),
          actions: this.getActionsForPrediction(pattern.predictionType),
          reasoning: `Pattern detected: ${pattern.pattern.join(" → ")} suggests ${pattern.nextProbable}`
        };
      }
    }
    return null;
  }
  /**
   * Predicción específica de DROP
   * 
   * CRÍTICO: 8 compases de buildup → Drop con 90% probabilidad
   */
  predictDrop(section, rhythm) {
    if (section.current.type !== "buildup") {
      return null;
    }
    const buildupDuration = Date.now() - section.current.startedAt;
    const bpm = rhythm.bpm || this.config.referenceBpm;
    const msPerBar = 6e4 / bpm * 4;
    const barsInBuildup = buildupDuration / msPerBar;
    const isIntensityRising = section.intensityTrend === "rising";
    const isLongEnough = barsInBuildup >= this.config.dropAnticipationBars;
    if (isIntensityRising && isLongEnough) {
      const durationFactor = Math.min(barsInBuildup / 8, 1);
      const baseProbability = 0.7;
      const probability = baseProbability + durationFactor * 0.25;
      const barsUntilDrop = Math.max(1, 8 - Math.floor(barsInBuildup));
      const timeUntil = barsUntilDrop * msPerBar;
      const beatsUntil = barsUntilDrop * 4;
      return {
        type: "drop_incoming",
        probability: Math.min(probability, 0.95),
        timeUntil,
        beatsUntil,
        timestamp: Date.now(),
        actions: PREDICTION_ACTIONS.drop_incoming,
        reasoning: `Buildup duration: ${barsInBuildup.toFixed(1)} bars, intensity ${section.intensityTrend}`
      };
    }
    return null;
  }
  /**
   * Predice transición basada en fills de batería
   */
  predictFromFills(rhythm, section) {
    if (rhythm.fillInProgress) {
      const bpm = rhythm.bpm || this.config.referenceBpm;
      const msPerBeat = 6e4 / bpm;
      return {
        type: "fill_expected",
        probability: 0.75,
        timeUntil: msPerBeat * 2,
        // Típicamente 2 beats de fill
        beatsUntil: 2,
        timestamp: Date.now(),
        actions: PREDICTION_ACTIONS.fill_expected,
        reasoning: "Fill detected, transition likely on next beat"
      };
    }
    if (this.fillHistory.length >= 2) {
      const now = Date.now();
      const recentFills = this.fillHistory.filter((t) => now - t < 3e4);
      if (recentFills.length >= 2) {
        const intervals = [];
        for (let i = 1; i < recentFills.length; i++) {
          intervals.push(recentFills[i] - recentFills[i - 1]);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const lastFillTime = recentFills[recentFills.length - 1];
        const timeSinceLastFill = now - lastFillTime;
        if (timeSinceLastFill > avgInterval * 0.7 && timeSinceLastFill < avgInterval * 1.3) {
          const timeUntilNextFill = avgInterval - timeSinceLastFill;
          if (timeUntilNextFill > 0 && timeUntilNextFill < 5e3) {
            return {
              type: "fill_expected",
              probability: 0.65,
              timeUntil: timeUntilNextFill,
              beatsUntil: Math.round(timeUntilNextFill / (6e4 / (rhythm.bpm || 120))),
              timestamp: now,
              actions: PREDICTION_ACTIONS.fill_expected,
              reasoning: `Fill pattern detected, avg interval: ${(avgInterval / 1e3).toFixed(1)}s`
            };
          }
        }
      }
    }
    return null;
  }
  /**
   * Predice transiciones entre secciones
   */
  predictTransition(currentSection) {
    if (currentSection.predicted && currentSection.predicted.probability > 0.6) {
      const bpm = this.getEstimatedBpm();
      const beatsUntil = Math.round(currentSection.predicted.estimatedIn / (6e4 / bpm));
      return {
        type: "transition_beat",
        probability: currentSection.predicted.probability,
        timeUntil: currentSection.predicted.estimatedIn,
        beatsUntil,
        timestamp: Date.now(),
        actions: PREDICTION_ACTIONS.transition_beat,
        reasoning: `Section predictor: ${currentSection.current.type} → ${currentSection.predicted.type}`
      };
    }
    return null;
  }
  // ============================================================
  // 🛠️ UTILIDADES
  // ============================================================
  /**
   * Actualiza el historial de secciones
   */
  updateSectionHistory(section) {
    const lastEntry = this.sectionHistory[this.sectionHistory.length - 1];
    if (!lastEntry || lastEntry.type !== section.current.type) {
      if (lastEntry) {
        lastEntry.duration = section.current.startedAt - lastEntry.timestamp;
      }
      this.sectionHistory.push({
        type: section.current.type,
        duration: 0,
        energy: section.intensity,
        timestamp: section.current.startedAt
      });
      while (this.sectionHistory.length > this.config.historySize) {
        this.sectionHistory.shift();
      }
      this.emit("section-change", {
        from: (lastEntry == null ? void 0 : lastEntry.type) || "unknown",
        to: section.current.type,
        timestamp: Date.now()
      });
    } else {
      lastEntry.energy = (lastEntry.energy + section.intensity) / 2;
    }
  }
  /**
   * Verifica si las secciones recientes coinciden con un patrón
   */
  matchesPattern(recent, pattern) {
    if (recent.length < pattern.length) {
      return false;
    }
    const recentSlice = recent.slice(-pattern.length);
    return pattern.every((type, i) => recentSlice[i] === type);
  }
  /**
   * Obtiene acciones para un tipo de predicción
   */
  getActionsForPrediction(type) {
    return PREDICTION_ACTIONS[type] || PREDICTION_ACTIONS.transition_beat;
  }
  /**
   * Estima el BPM actual basado en el historial
   */
  getEstimatedBpm() {
    return this.config.referenceBpm;
  }
  // ============================================================
  // 📊 MÉTRICAS Y DEBUG
  // ============================================================
  /**
   * Obtiene estadísticas de rendimiento
   */
  getPerformanceStats() {
    return {
      analysisCount: this.analysisCount,
      averageAnalysisTime: this.analysisCount > 0 ? this.totalAnalysisTime / this.analysisCount : 0,
      historySize: this.sectionHistory.length,
      lastPrediction: this.lastPrediction
    };
  }
  /**
   * Obtiene el historial de secciones (para debug)
   */
  getSectionHistory() {
    return [...this.sectionHistory];
  }
  /**
   * Resetea el estado del motor
   */
  reset() {
    this.sectionHistory = [];
    this.lastPrediction = null;
    this.cachedResult = null;
    this.fillHistory = [];
    this.analysisCount = 0;
    this.totalAnalysisTime = 0;
    this.emit("reset");
  }
  /**
   * Actualiza la configuración
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
    this.emit("config-updated", this.config);
  }
}
function createPredictionMatrix(config) {
  return new PredictionMatrix(config);
}
const DEFAULT_ENGINE_CONFIG = {
  ...DEFAULT_MUSICAL_ENGINE_CONFIG,
  enableReactiveFallback: true,
  rhythmConfidenceWeight: 0.35,
  // Ritmo es MUY confiable
  harmonyConfidenceWeight: 0.2,
  // Armonía tarda más en converger
  genreConfidenceWeight: 0.25,
  // Género es importante
  sectionConfidenceWeight: 0.2,
  // Sección es útil
  modeHysteresis: 0.05
  // 5% de histéresis para evitar flip-flop
};
const GENRE_TO_PALETTE = {
  cumbia: "fuego",
  reggaeton: "neon",
  techno: "cyber",
  house: "rainbow",
  latin_pop: "tropical",
  trap: "dark",
  drum_and_bass: "energy",
  ambient: "ocean",
  edm: "electric",
  trance: "aurora",
  dubstep: "glitch",
  pop: "candy",
  rock: "fire",
  indie: "sunset",
  alternative: "forest",
  hip_hop: "urban",
  r_and_b: "velvet",
  jazz: "smoky",
  classical: "elegant",
  salsa: "salsa",
  bachata: "romance",
  unknown: "default"
};
const MOOD_TO_MOVEMENT = {
  euphoric: "burst",
  melancholic: "wave",
  aggressive: "slash",
  chill: "breathe",
  groovy: "figure8",
  epic: "sweep",
  intimate: "pulse",
  party: "random",
  neutral: "circular"
};
class MusicalContextEngine extends events.EventEmitter {
  constructor(config = {}) {
    super();
    // Analizadores
    __publicField(this, "rhythmAnalyzer");
    __publicField(this, "harmonyDetector");
    __publicField(this, "sectionTracker");
    __publicField(this, "genreClassifier");
    __publicField(this, "predictionMatrix");
    // Estado
    __publicField(this, "config");
    __publicField(this, "currentMode", "reactive");
    __publicField(this, "overallConfidence", 0);
    __publicField(this, "lastContext", null);
    __publicField(this, "lastResult", null);
    // Throttling para análisis pesado
    __publicField(this, "lastHeavyAnalysisTime", 0);
    __publicField(this, "cachedHarmony", null);
    __publicField(this, "cachedSection", null);
    __publicField(this, "cachedGenre", null);
    // Warmup tracking
    __publicField(this, "startTime", Date.now());
    __publicField(this, "processCount", 0);
    // Performance tracking
    __publicField(this, "totalProcessTime", 0);
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
    this.rhythmAnalyzer = new RhythmAnalyzer();
    this.harmonyDetector = createHarmonyDetector();
    this.sectionTracker = createSectionTracker();
    this.genreClassifier = new GenreClassifier();
    this.predictionMatrix = createPredictionMatrix();
    this.setupEventListeners();
  }
  // ============================================================
  // 🎯 MÉTODO PRINCIPAL: PROCESS
  // ============================================================
  /**
   * Procesa el audio y retorna el resultado apropiado
   * 
   * ⚠️ REGLA 2 IMPLEMENTADA:
   * - Si confidence < 0.5 → fallbackReactiveMode()
   * - Si confidence >= 0.5 → intelligentMode()
   * 
   * @param audio - Análisis de audio del BeatDetector/FFTAnalyzer
   * @returns Resultado reactivo o inteligente según confianza
   */
  process(audio) {
    var _a;
    const startTime = performance.now();
    const now = Date.now();
    this.processCount++;
    const audioMetrics = this.audioToMetrics(audio);
    const beatState = {
      bpm: audio.beat.bpm,
      phase: audio.beat.beatPhase,
      onBeat: audio.beat.detected
    };
    const rhythm = this.rhythmAnalyzer.analyze(audioMetrics, beatState);
    const shouldDoHeavyAnalysis = now - this.lastHeavyAnalysisTime >= this.config.workerThreadInterval;
    const simpleAudio = {
      energy: ((_a = audio.energy) == null ? void 0 : _a.current) ?? 0.5,
      bass: audio.spectrum.bass,
      mid: audio.spectrum.mid,
      treble: audio.spectrum.treble
    };
    if (shouldDoHeavyAnalysis) {
      this.lastHeavyAnalysisTime = now;
      this.cachedHarmony = this.harmonyDetector.analyze(audio);
      this.cachedSection = this.sectionTracker.track(
        rhythm,
        this.cachedHarmony,
        simpleAudio
      );
      const genreResult = this.genreClassifier.classify(
        rhythm,
        this.cachedHarmony,
        simpleAudio
      );
      this.cachedGenre = {
        primary: genreResult.genre,
        confidence: genreResult.confidence,
        secondary: genreResult.subgenre !== "none" ? genreResult.genre : void 0,
        characteristics: this.extractCharacteristics(genreResult),
        timestamp: now
      };
    }
    this.overallConfidence = this.calculateOverallConfidence(
      rhythm,
      this.cachedHarmony,
      this.cachedSection,
      this.cachedGenre
    );
    const previousMode = this.currentMode;
    const newMode = this.decideMode(this.overallConfidence);
    if (newMode !== previousMode && newMode !== "transitioning") {
      this.currentMode = newMode;
      this.emit("mode-change", {
        from: previousMode,
        to: newMode,
        confidence: this.overallConfidence,
        timestamp: now
      });
    }
    let result;
    if (this.currentMode === "reactive" || !this.hasValidAnalysis()) {
      result = this.fallbackReactiveMode(audio);
    } else {
      result = this.intelligentMode(
        rhythm,
        this.cachedHarmony,
        this.cachedSection,
        this.cachedGenre,
        audio
      );
    }
    const elapsed = performance.now() - startTime;
    this.totalProcessTime += elapsed;
    this.lastResult = result;
    this.emit("result", result);
    return result;
  }
  // ============================================================
  // ❄️ MODO REACTIVO (REGLA 2 - FALLBACK)
  // ============================================================
  /**
   * 🔥 MODO REACTIVO (V17 Style)
   * 
   * Cuando confidence < 0.5, NO esperamos al análisis de género.
   * Simplemente mapeamos directo:
   * - Bass → Pulso (intensidad de graves)
   * - Treble → Shimmer (brillo/parpadeo)
   * - Beat → Flash (flash en cada golpe)
   * 
   * Esto garantiza que SIEMPRE hay reacción visual,
   * incluso en los primeros segundos de la canción.
   * 
   * @param audio - Análisis de audio actual
   * @returns ReactiveResult con mapeo directo
   */
  fallbackReactiveMode(audio) {
    const now = Date.now();
    const pulse = Math.pow(audio.spectrum.bass, 0.8);
    const shimmer = audio.spectrum.treble * 0.7 + // Treble → Shimmer
    audio.spectrum.highMid * 0.3;
    const flash = audio.beat.detected;
    const intensity = audio.spectrum.bass * 0.4 + audio.spectrum.mid * 0.3 + audio.spectrum.treble * 0.3;
    const result = {
      mode: "reactive",
      pulse: Math.min(1, pulse),
      shimmer: Math.min(1, shimmer),
      flash,
      intensity: Math.min(1, intensity),
      timestamp: now
    };
    this.emit("reactive-update", result);
    return result;
  }
  // ============================================================
  // 🎭 MODO INTELIGENTE
  // ============================================================
  /**
   * 🧠 MODO INTELIGENTE
   * 
   * Cuando confidence >= 0.5, usamos toda la inteligencia:
   * - Género detectado → Paleta de colores
   * - Mood sintetizado → Patrón de movimiento
   * - Sección → Intensidad base
   * - Predicciones → Anticipación de cambios
   * 
   * @returns IntelligentResult con contexto completo
   */
  intelligentMode(rhythm, harmony, section, genre, audio) {
    const now = Date.now();
    const mood = this.synthesizeMood(harmony, section, genre);
    const energy = this.calculateEnergy(rhythm, section, audio);
    const context = {
      rhythm,
      harmony,
      section,
      genre,
      mood,
      energy,
      confidence: this.overallConfidence,
      timestamp: now
    };
    const prediction = this.predictionMatrix.generate(rhythm, section);
    const suggestedPalette = GENRE_TO_PALETTE[genre.primary] || "default";
    const suggestedMovement = MOOD_TO_MOVEMENT[mood] || "circular";
    this.lastContext = context;
    this.emit("context", context);
    if (prediction) {
      this.emit("prediction", prediction);
    }
    return {
      mode: "intelligent",
      context,
      prediction,
      suggestedPalette,
      suggestedMovement,
      timestamp: now
    };
  }
  // ============================================================
  // 🎭 SÍNTESIS DE MOOD
  // ============================================================
  /**
   * Sintetiza el mood combinando armonía, sección y género
   * 
   * Prioridad:
   * 1. Sección (drop = euphoric, breakdown = chill)
   * 2. Armonía (mood detectado)
   * 3. Género (características típicas)
   */
  synthesizeMood(harmony, section, genre) {
    var _a;
    const sectionMood = this.getSectionMood(section.current.type);
    if (sectionMood !== "neutral") {
      return sectionMood;
    }
    const harmonicMood = ((_a = harmony.mode) == null ? void 0 : _a.mood) || "universal";
    const harmonicSynthMood = this.mapHarmonicToSynthesized(harmonicMood);
    if (genre.primary === "reggaeton" || genre.primary === "cumbia") {
      return section.intensity > 0.7 ? "party" : "groovy";
    }
    if (genre.primary === "ambient") {
      return "chill";
    }
    if (genre.primary === "drum_and_bass" || genre.primary === "dubstep") {
      return section.intensity > 0.6 ? "aggressive" : "groovy";
    }
    return harmonicSynthMood;
  }
  /**
   * Mapea tipo de sección a mood
   */
  getSectionMood(sectionType) {
    const mapping = {
      drop: "euphoric",
      buildup: "epic",
      breakdown: "chill",
      chorus: "party",
      verse: "groovy",
      intro: "intimate",
      outro: "melancholic"
    };
    return mapping[sectionType] || "neutral";
  }
  /**
   * Mapea mood armónico a mood sintetizado
   */
  mapHarmonicToSynthesized(harmonic) {
    const mapping = {
      happy: "euphoric",
      sad: "melancholic",
      jazzy: "groovy",
      spanish_exotic: "aggressive",
      dreamy: "chill",
      bluesy: "intimate",
      tense: "aggressive",
      universal: "neutral"
    };
    return mapping[harmonic] || "neutral";
  }
  // ============================================================
  // ⚡ CÁLCULO DE ENERGÍA
  // ============================================================
  /**
   * Calcula la energía global del momento musical
   * 
   * Combina:
   * - Intensidad de sección (40%)
   * - Energía de audio (40%)
   * - Actividad rítmica (20%)
   */
  calculateEnergy(rhythm, section, audio) {
    var _a;
    const sectionEnergy = section.intensity;
    const audioEnergy = audio.spectrum.bass * 0.4 + audio.spectrum.mid * 0.3 + audio.spectrum.treble * 0.2 + (((_a = audio.energy) == null ? void 0 : _a.current) || 0.5) * 0.1;
    const rhythmActivity = (rhythm.drums.kickDetected ? 0.3 : 0) + (rhythm.drums.snareDetected ? 0.3 : 0) + (rhythm.drums.hihatDetected ? 0.2 : 0) + (rhythm.fillInProgress ? 0.2 : 0);
    const totalEnergy = sectionEnergy * 0.4 + audioEnergy * 0.4 + rhythmActivity * 0.2;
    return Math.min(1, Math.max(0, totalEnergy));
  }
  // ============================================================
  // 📊 CÁLCULO DE CONFIANZA COMBINADA
  // ============================================================
  /**
   * Calcula la confianza combinada de todos los análisis
   * 
   * ⚠️ REGLA 2: Este valor determina si usar fallback
   * 
   * Sistema de confianza ponderada:
   * - Ritmo: 35% (muy confiable, rápido en converger)
   * - Género: 25% (importante para paleta)
   * - Armonía: 20% (tarda más en converger)
   * - Sección: 20% (útil para intensidad)
   * 
   * REGLA 3 aplicada: Si ritmo dice Techno (90%) y armonía dice Jazz (10%),
   * la confianza de ritmo domina.
   */
  calculateOverallConfidence(rhythm, harmony, section, genre) {
    const timeSinceStart = Date.now() - this.startTime;
    if (timeSinceStart < this.config.warmupTime) {
      const warmupFactor = timeSinceStart / this.config.warmupTime;
      return Math.min(0.4, warmupFactor * 0.4);
    }
    const rhythmConf = rhythm.confidence;
    const harmonyConf = (harmony == null ? void 0 : harmony.confidence) ?? 0;
    const sectionConf = (section == null ? void 0 : section.confidence) ?? 0;
    const genreConf = (genre == null ? void 0 : genre.confidence) ?? 0;
    const weightedConfidence = rhythmConf * this.config.rhythmConfidenceWeight + harmonyConf * this.config.harmonyConfidenceWeight + sectionConf * this.config.sectionConfidenceWeight + genreConf * this.config.genreConfidenceWeight;
    const analysisCoverage = [
      harmony !== null,
      section !== null,
      genre !== null
    ].filter(Boolean).length / 3;
    return weightedConfidence * (0.7 + 0.3 * analysisCoverage);
  }
  // ============================================================
  // 🔄 DECISIÓN DE MODO
  // ============================================================
  /**
   * Decide el modo de operación con histéresis
   * 
   * ⚠️ REGLA 2: El umbral es 0.5 (configurable)
   * 
   * Histéresis para evitar flip-flop:
   * - Para entrar en intelligent: confidence > threshold + hysteresis
   * - Para salir de intelligent: confidence < threshold - hysteresis
   */
  decideMode(confidence) {
    const threshold = this.config.confidenceThreshold;
    const hysteresis = this.config.modeHysteresis;
    if (this.currentMode === "reactive") {
      if (confidence >= threshold + hysteresis) {
        return "intelligent";
      }
      return "reactive";
    } else {
      if (confidence < threshold - hysteresis) {
        return "reactive";
      }
      return "intelligent";
    }
  }
  // ============================================================
  // 🛠️ UTILIDADES
  // ============================================================
  /**
   * Verifica si tenemos análisis válidos
   */
  hasValidAnalysis() {
    return this.cachedHarmony !== null && this.cachedSection !== null && this.cachedGenre !== null;
  }
  /**
   * Convierte AudioAnalysis a formato de RhythmAnalyzer
   */
  audioToMetrics(audio) {
    return {
      lowBass: audio.spectrum.bass,
      midBass: audio.spectrum.lowMid,
      lowMid: audio.spectrum.mid,
      highMid: audio.spectrum.highMid,
      treble: audio.spectrum.treble,
      spectralCentroid: 0.5,
      // Default
      beatPhase: audio.beat.beatPhase,
      bpm: audio.beat.bpm,
      beatConfidence: audio.beat.confidence
    };
  }
  /**
   * Extrae características del análisis de género
   */
  extractCharacteristics(genreResult) {
    var _a, _b, _c, _d;
    const chars = [];
    if ((_a = genreResult.features) == null ? void 0 : _a.hasDembow) chars.push("dembow");
    if ((_b = genreResult.features) == null ? void 0 : _b.hasGuiro) chars.push("caballito");
    if (((_c = genreResult.features) == null ? void 0 : _c.bpm) >= 120) chars.push("four_on_floor");
    if (((_d = genreResult.features) == null ? void 0 : _d.syncopation) > 0.4) chars.push("syncopated");
    return chars;
  }
  /**
   * Configura listeners para eventos de analizadores
   */
  setupEventListeners() {
    this.sectionTracker.on("section-change", (data) => {
      this.emit("section-change", data);
    });
    this.harmonyDetector.on("key-change", (data) => {
      this.emit("key-change", data);
    });
    this.harmonyDetector.on("tension", (data) => {
      this.emit("tension", data);
    });
    this.predictionMatrix.on("prediction", (data) => {
      this.emit("prediction", data);
    });
  }
  // ============================================================
  // 📊 API PÚBLICA
  // ============================================================
  /**
   * Obtiene el modo de operación actual
   */
  getMode() {
    return this.currentMode;
  }
  /**
   * Obtiene la confianza actual
   */
  getConfidence() {
    return this.overallConfidence;
  }
  /**
   * Obtiene el último contexto (solo válido en modo inteligente)
   */
  getLastContext() {
    return this.lastContext;
  }
  /**
   * Obtiene el último resultado
   */
  getLastResult() {
    return this.lastResult;
  }
  /**
   * Obtiene estadísticas de rendimiento
   */
  getPerformanceStats() {
    return {
      processCount: this.processCount,
      averageProcessTime: this.processCount > 0 ? this.totalProcessTime / this.processCount : 0,
      currentMode: this.currentMode,
      overallConfidence: this.overallConfidence,
      timeSinceStart: Date.now() - this.startTime
    };
  }
  /**
   * Resetea el estado del motor
   */
  reset() {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    this.currentMode = "reactive";
    this.overallConfidence = 0;
    this.lastContext = null;
    this.lastResult = null;
    this.cachedHarmony = null;
    this.cachedSection = null;
    this.cachedGenre = null;
    this.lastHeavyAnalysisTime = 0;
    this.startTime = Date.now();
    this.processCount = 0;
    this.totalProcessTime = 0;
    (_b = (_a = this.rhythmAnalyzer).reset) == null ? void 0 : _b.call(_a);
    (_d = (_c = this.harmonyDetector).reset) == null ? void 0 : _d.call(_c);
    (_f = (_e = this.sectionTracker).reset) == null ? void 0 : _f.call(_e);
    (_h = (_g = this.genreClassifier).reset) == null ? void 0 : _h.call(_g);
    this.predictionMatrix.reset();
    this.emit("reset");
  }
  /**
   * Actualiza la configuración
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
    this.emit("config-updated", this.config);
  }
  /**
   * Fuerza el modo de operación (para testing/debug)
   */
  forceMode(mode) {
    const previousMode = this.currentMode;
    this.currentMode = mode;
    if (mode !== previousMode) {
      this.emit("mode-change", {
        from: previousMode,
        to: mode,
        confidence: this.overallConfidence,
        forced: true,
        timestamp: Date.now()
      });
    }
  }
}
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var lib = { exports: {} };
function commonjsRequire(path2) {
  throw new Error('Could not dynamically require "' + path2 + '". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.');
}
var util$1 = {};
util$1.getBooleanOption = (options, key) => {
  let value = false;
  if (key in options && typeof (value = options[key]) !== "boolean") {
    throw new TypeError(`Expected the "${key}" option to be a boolean`);
  }
  return value;
};
util$1.cppdb = Symbol();
util$1.inspect = Symbol.for("nodejs.util.inspect.custom");
const descriptor = { value: "SqliteError", writable: true, enumerable: false, configurable: true };
function SqliteError$1(message, code) {
  if (new.target !== SqliteError$1) {
    return new SqliteError$1(message, code);
  }
  if (typeof code !== "string") {
    throw new TypeError("Expected second argument to be a string");
  }
  Error.call(this, message);
  descriptor.value = "" + message;
  Object.defineProperty(this, "message", descriptor);
  Error.captureStackTrace(this, SqliteError$1);
  this.code = code;
}
Object.setPrototypeOf(SqliteError$1, Error);
Object.setPrototypeOf(SqliteError$1.prototype, Error.prototype);
Object.defineProperty(SqliteError$1.prototype, "name", descriptor);
var sqliteError = SqliteError$1;
var bindings = { exports: {} };
var fileUriToPath_1;
var hasRequiredFileUriToPath;
function requireFileUriToPath() {
  if (hasRequiredFileUriToPath) return fileUriToPath_1;
  hasRequiredFileUriToPath = 1;
  var sep = path$1.sep || "/";
  fileUriToPath_1 = fileUriToPath;
  function fileUriToPath(uri) {
    if ("string" != typeof uri || uri.length <= 7 || "file://" != uri.substring(0, 7)) {
      throw new TypeError("must pass in a file:// URI to convert to a file path");
    }
    var rest = decodeURI(uri.substring(7));
    var firstSlash = rest.indexOf("/");
    var host = rest.substring(0, firstSlash);
    var path2 = rest.substring(firstSlash + 1);
    if ("localhost" == host) host = "";
    if (host) {
      host = sep + sep + host;
    }
    path2 = path2.replace(/^(.+)\|/, "$1:");
    if (sep == "\\") {
      path2 = path2.replace(/\//g, "\\");
    }
    if (/^.+\:/.test(path2)) ;
    else {
      path2 = sep + path2;
    }
    return host + path2;
  }
  return fileUriToPath_1;
}
var hasRequiredBindings;
function requireBindings() {
  if (hasRequiredBindings) return bindings.exports;
  hasRequiredBindings = 1;
  (function(module2, exports$1) {
    var fs2 = fs$1, path2 = path$1, fileURLToPath = requireFileUriToPath(), join = path2.join, dirname = path2.dirname, exists = fs2.accessSync && function(path3) {
      try {
        fs2.accessSync(path3);
      } catch (e) {
        return false;
      }
      return true;
    } || fs2.existsSync || path2.existsSync, defaults = {
      arrow: process.env.NODE_BINDINGS_ARROW || " → ",
      compiled: process.env.NODE_BINDINGS_COMPILED_DIR || "compiled",
      platform: process.platform,
      arch: process.arch,
      nodePreGyp: "node-v" + process.versions.modules + "-" + process.platform + "-" + process.arch,
      version: process.versions.node,
      bindings: "bindings.node",
      try: [
        // node-gyp's linked version in the "build" dir
        ["module_root", "build", "bindings"],
        // node-waf and gyp_addon (a.k.a node-gyp)
        ["module_root", "build", "Debug", "bindings"],
        ["module_root", "build", "Release", "bindings"],
        // Debug files, for development (legacy behavior, remove for node v0.9)
        ["module_root", "out", "Debug", "bindings"],
        ["module_root", "Debug", "bindings"],
        // Release files, but manually compiled (legacy behavior, remove for node v0.9)
        ["module_root", "out", "Release", "bindings"],
        ["module_root", "Release", "bindings"],
        // Legacy from node-waf, node <= 0.4.x
        ["module_root", "build", "default", "bindings"],
        // Production "Release" buildtype binary (meh...)
        ["module_root", "compiled", "version", "platform", "arch", "bindings"],
        // node-qbs builds
        ["module_root", "addon-build", "release", "install-root", "bindings"],
        ["module_root", "addon-build", "debug", "install-root", "bindings"],
        ["module_root", "addon-build", "default", "install-root", "bindings"],
        // node-pre-gyp path ./lib/binding/{node_abi}-{platform}-{arch}
        ["module_root", "lib", "binding", "nodePreGyp", "bindings"]
      ]
    };
    function bindings2(opts) {
      if (typeof opts == "string") {
        opts = { bindings: opts };
      } else if (!opts) {
        opts = {};
      }
      Object.keys(defaults).map(function(i2) {
        if (!(i2 in opts)) opts[i2] = defaults[i2];
      });
      if (!opts.module_root) {
        opts.module_root = exports$1.getRoot(exports$1.getFileName());
      }
      if (path2.extname(opts.bindings) != ".node") {
        opts.bindings += ".node";
      }
      var requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : commonjsRequire;
      var tries = [], i = 0, l = opts.try.length, n, b, err;
      for (; i < l; i++) {
        n = join.apply(
          null,
          opts.try[i].map(function(p) {
            return opts[p] || p;
          })
        );
        tries.push(n);
        try {
          b = opts.path ? requireFunc.resolve(n) : requireFunc(n);
          if (!opts.path) {
            b.path = n;
          }
          return b;
        } catch (e) {
          if (e.code !== "MODULE_NOT_FOUND" && e.code !== "QUALIFIED_PATH_RESOLUTION_FAILED" && !/not find/i.test(e.message)) {
            throw e;
          }
        }
      }
      err = new Error(
        "Could not locate the bindings file. Tried:\n" + tries.map(function(a) {
          return opts.arrow + a;
        }).join("\n")
      );
      err.tries = tries;
      throw err;
    }
    module2.exports = exports$1 = bindings2;
    exports$1.getFileName = function getFileName(calling_file) {
      var origPST = Error.prepareStackTrace, origSTL = Error.stackTraceLimit, dummy = {}, fileName;
      Error.stackTraceLimit = 10;
      Error.prepareStackTrace = function(e, st) {
        for (var i = 0, l = st.length; i < l; i++) {
          fileName = st[i].getFileName();
          if (fileName !== __filename) {
            if (calling_file) {
              if (fileName !== calling_file) {
                return;
              }
            } else {
              return;
            }
          }
        }
      };
      Error.captureStackTrace(dummy);
      dummy.stack;
      Error.prepareStackTrace = origPST;
      Error.stackTraceLimit = origSTL;
      var fileSchema = "file://";
      if (fileName.indexOf(fileSchema) === 0) {
        fileName = fileURLToPath(fileName);
      }
      return fileName;
    };
    exports$1.getRoot = function getRoot(file) {
      var dir = dirname(file), prev;
      while (true) {
        if (dir === ".") {
          dir = process.cwd();
        }
        if (exists(join(dir, "package.json")) || exists(join(dir, "node_modules"))) {
          return dir;
        }
        if (prev === dir) {
          throw new Error(
            'Could not find module root given file: "' + file + '". Do you have a `package.json` file? '
          );
        }
        prev = dir;
        dir = join(dir, "..");
      }
    };
  })(bindings, bindings.exports);
  return bindings.exports;
}
var wrappers$1 = {};
var hasRequiredWrappers;
function requireWrappers() {
  if (hasRequiredWrappers) return wrappers$1;
  hasRequiredWrappers = 1;
  const { cppdb } = util$1;
  wrappers$1.prepare = function prepare(sql) {
    return this[cppdb].prepare(sql, this, false);
  };
  wrappers$1.exec = function exec(sql) {
    this[cppdb].exec(sql);
    return this;
  };
  wrappers$1.close = function close() {
    this[cppdb].close();
    return this;
  };
  wrappers$1.loadExtension = function loadExtension(...args) {
    this[cppdb].loadExtension(...args);
    return this;
  };
  wrappers$1.defaultSafeIntegers = function defaultSafeIntegers(...args) {
    this[cppdb].defaultSafeIntegers(...args);
    return this;
  };
  wrappers$1.unsafeMode = function unsafeMode(...args) {
    this[cppdb].unsafeMode(...args);
    return this;
  };
  wrappers$1.getters = {
    name: {
      get: function name() {
        return this[cppdb].name;
      },
      enumerable: true
    },
    open: {
      get: function open() {
        return this[cppdb].open;
      },
      enumerable: true
    },
    inTransaction: {
      get: function inTransaction() {
        return this[cppdb].inTransaction;
      },
      enumerable: true
    },
    readonly: {
      get: function readonly() {
        return this[cppdb].readonly;
      },
      enumerable: true
    },
    memory: {
      get: function memory() {
        return this[cppdb].memory;
      },
      enumerable: true
    }
  };
  return wrappers$1;
}
var transaction;
var hasRequiredTransaction;
function requireTransaction() {
  if (hasRequiredTransaction) return transaction;
  hasRequiredTransaction = 1;
  const { cppdb } = util$1;
  const controllers = /* @__PURE__ */ new WeakMap();
  transaction = function transaction2(fn) {
    if (typeof fn !== "function") throw new TypeError("Expected first argument to be a function");
    const db = this[cppdb];
    const controller = getController(db, this);
    const { apply } = Function.prototype;
    const properties = {
      default: { value: wrapTransaction(apply, fn, db, controller.default) },
      deferred: { value: wrapTransaction(apply, fn, db, controller.deferred) },
      immediate: { value: wrapTransaction(apply, fn, db, controller.immediate) },
      exclusive: { value: wrapTransaction(apply, fn, db, controller.exclusive) },
      database: { value: this, enumerable: true }
    };
    Object.defineProperties(properties.default.value, properties);
    Object.defineProperties(properties.deferred.value, properties);
    Object.defineProperties(properties.immediate.value, properties);
    Object.defineProperties(properties.exclusive.value, properties);
    return properties.default.value;
  };
  const getController = (db, self) => {
    let controller = controllers.get(db);
    if (!controller) {
      const shared = {
        commit: db.prepare("COMMIT", self, false),
        rollback: db.prepare("ROLLBACK", self, false),
        savepoint: db.prepare("SAVEPOINT `	_bs3.	`", self, false),
        release: db.prepare("RELEASE `	_bs3.	`", self, false),
        rollbackTo: db.prepare("ROLLBACK TO `	_bs3.	`", self, false)
      };
      controllers.set(db, controller = {
        default: Object.assign({ begin: db.prepare("BEGIN", self, false) }, shared),
        deferred: Object.assign({ begin: db.prepare("BEGIN DEFERRED", self, false) }, shared),
        immediate: Object.assign({ begin: db.prepare("BEGIN IMMEDIATE", self, false) }, shared),
        exclusive: Object.assign({ begin: db.prepare("BEGIN EXCLUSIVE", self, false) }, shared)
      });
    }
    return controller;
  };
  const wrapTransaction = (apply, fn, db, { begin, commit, rollback, savepoint, release, rollbackTo }) => function sqliteTransaction() {
    let before, after, undo;
    if (db.inTransaction) {
      before = savepoint;
      after = release;
      undo = rollbackTo;
    } else {
      before = begin;
      after = commit;
      undo = rollback;
    }
    before.run();
    try {
      const result = apply.call(fn, this, arguments);
      if (result && typeof result.then === "function") {
        throw new TypeError("Transaction function cannot return a promise");
      }
      after.run();
      return result;
    } catch (ex) {
      if (db.inTransaction) {
        undo.run();
        if (undo !== rollback) after.run();
      }
      throw ex;
    }
  };
  return transaction;
}
var pragma;
var hasRequiredPragma;
function requirePragma() {
  if (hasRequiredPragma) return pragma;
  hasRequiredPragma = 1;
  const { getBooleanOption, cppdb } = util$1;
  pragma = function pragma2(source, options) {
    if (options == null) options = {};
    if (typeof source !== "string") throw new TypeError("Expected first argument to be a string");
    if (typeof options !== "object") throw new TypeError("Expected second argument to be an options object");
    const simple = getBooleanOption(options, "simple");
    const stmt = this[cppdb].prepare(`PRAGMA ${source}`, this, true);
    return simple ? stmt.pluck().get() : stmt.all();
  };
  return pragma;
}
var backup;
var hasRequiredBackup;
function requireBackup() {
  if (hasRequiredBackup) return backup;
  hasRequiredBackup = 1;
  const fs2 = fs$1;
  const path2 = path$1;
  const { promisify } = require$$2;
  const { cppdb } = util$1;
  const fsAccess = promisify(fs2.access);
  backup = async function backup2(filename, options) {
    if (options == null) options = {};
    if (typeof filename !== "string") throw new TypeError("Expected first argument to be a string");
    if (typeof options !== "object") throw new TypeError("Expected second argument to be an options object");
    filename = filename.trim();
    const attachedName = "attached" in options ? options.attached : "main";
    const handler = "progress" in options ? options.progress : null;
    if (!filename) throw new TypeError("Backup filename cannot be an empty string");
    if (filename === ":memory:") throw new TypeError('Invalid backup filename ":memory:"');
    if (typeof attachedName !== "string") throw new TypeError('Expected the "attached" option to be a string');
    if (!attachedName) throw new TypeError('The "attached" option cannot be an empty string');
    if (handler != null && typeof handler !== "function") throw new TypeError('Expected the "progress" option to be a function');
    await fsAccess(path2.dirname(filename)).catch(() => {
      throw new TypeError("Cannot save backup because the directory does not exist");
    });
    const isNewFile = await fsAccess(filename).then(() => false, () => true);
    return runBackup(this[cppdb].backup(this, attachedName, filename, isNewFile), handler || null);
  };
  const runBackup = (backup2, handler) => {
    let rate = 0;
    let useDefault = true;
    return new Promise((resolve, reject) => {
      setImmediate(function step() {
        try {
          const progress = backup2.transfer(rate);
          if (!progress.remainingPages) {
            backup2.close();
            resolve(progress);
            return;
          }
          if (useDefault) {
            useDefault = false;
            rate = 100;
          }
          if (handler) {
            const ret = handler(progress);
            if (ret !== void 0) {
              if (typeof ret === "number" && ret === ret) rate = Math.max(0, Math.min(2147483647, Math.round(ret)));
              else throw new TypeError("Expected progress callback to return a number or undefined");
            }
          }
          setImmediate(step);
        } catch (err) {
          backup2.close();
          reject(err);
        }
      });
    });
  };
  return backup;
}
var serialize;
var hasRequiredSerialize;
function requireSerialize() {
  if (hasRequiredSerialize) return serialize;
  hasRequiredSerialize = 1;
  const { cppdb } = util$1;
  serialize = function serialize2(options) {
    if (options == null) options = {};
    if (typeof options !== "object") throw new TypeError("Expected first argument to be an options object");
    const attachedName = "attached" in options ? options.attached : "main";
    if (typeof attachedName !== "string") throw new TypeError('Expected the "attached" option to be a string');
    if (!attachedName) throw new TypeError('The "attached" option cannot be an empty string');
    return this[cppdb].serialize(attachedName);
  };
  return serialize;
}
var _function;
var hasRequired_function;
function require_function() {
  if (hasRequired_function) return _function;
  hasRequired_function = 1;
  const { getBooleanOption, cppdb } = util$1;
  _function = function defineFunction(name, options, fn) {
    if (options == null) options = {};
    if (typeof options === "function") {
      fn = options;
      options = {};
    }
    if (typeof name !== "string") throw new TypeError("Expected first argument to be a string");
    if (typeof fn !== "function") throw new TypeError("Expected last argument to be a function");
    if (typeof options !== "object") throw new TypeError("Expected second argument to be an options object");
    if (!name) throw new TypeError("User-defined function name cannot be an empty string");
    const safeIntegers = "safeIntegers" in options ? +getBooleanOption(options, "safeIntegers") : 2;
    const deterministic = getBooleanOption(options, "deterministic");
    const directOnly = getBooleanOption(options, "directOnly");
    const varargs = getBooleanOption(options, "varargs");
    let argCount = -1;
    if (!varargs) {
      argCount = fn.length;
      if (!Number.isInteger(argCount) || argCount < 0) throw new TypeError("Expected function.length to be a positive integer");
      if (argCount > 100) throw new RangeError("User-defined functions cannot have more than 100 arguments");
    }
    this[cppdb].function(fn, name, argCount, safeIntegers, deterministic, directOnly);
    return this;
  };
  return _function;
}
var aggregate;
var hasRequiredAggregate;
function requireAggregate() {
  if (hasRequiredAggregate) return aggregate;
  hasRequiredAggregate = 1;
  const { getBooleanOption, cppdb } = util$1;
  aggregate = function defineAggregate(name, options) {
    if (typeof name !== "string") throw new TypeError("Expected first argument to be a string");
    if (typeof options !== "object" || options === null) throw new TypeError("Expected second argument to be an options object");
    if (!name) throw new TypeError("User-defined function name cannot be an empty string");
    const start = "start" in options ? options.start : null;
    const step = getFunctionOption(options, "step", true);
    const inverse = getFunctionOption(options, "inverse", false);
    const result = getFunctionOption(options, "result", false);
    const safeIntegers = "safeIntegers" in options ? +getBooleanOption(options, "safeIntegers") : 2;
    const deterministic = getBooleanOption(options, "deterministic");
    const directOnly = getBooleanOption(options, "directOnly");
    const varargs = getBooleanOption(options, "varargs");
    let argCount = -1;
    if (!varargs) {
      argCount = Math.max(getLength(step), inverse ? getLength(inverse) : 0);
      if (argCount > 0) argCount -= 1;
      if (argCount > 100) throw new RangeError("User-defined functions cannot have more than 100 arguments");
    }
    this[cppdb].aggregate(start, step, inverse, result, name, argCount, safeIntegers, deterministic, directOnly);
    return this;
  };
  const getFunctionOption = (options, key, required) => {
    const value = key in options ? options[key] : null;
    if (typeof value === "function") return value;
    if (value != null) throw new TypeError(`Expected the "${key}" option to be a function`);
    if (required) throw new TypeError(`Missing required option "${key}"`);
    return null;
  };
  const getLength = ({ length }) => {
    if (Number.isInteger(length) && length >= 0) return length;
    throw new TypeError("Expected function.length to be a positive integer");
  };
  return aggregate;
}
var table;
var hasRequiredTable;
function requireTable() {
  if (hasRequiredTable) return table;
  hasRequiredTable = 1;
  const { cppdb } = util$1;
  table = function defineTable(name, factory) {
    if (typeof name !== "string") throw new TypeError("Expected first argument to be a string");
    if (!name) throw new TypeError("Virtual table module name cannot be an empty string");
    let eponymous = false;
    if (typeof factory === "object" && factory !== null) {
      eponymous = true;
      factory = defer(parseTableDefinition(factory, "used", name));
    } else {
      if (typeof factory !== "function") throw new TypeError("Expected second argument to be a function or a table definition object");
      factory = wrapFactory(factory);
    }
    this[cppdb].table(factory, name, eponymous);
    return this;
  };
  function wrapFactory(factory) {
    return function virtualTableFactory(moduleName, databaseName, tableName, ...args) {
      const thisObject = {
        module: moduleName,
        database: databaseName,
        table: tableName
      };
      const def = apply.call(factory, thisObject, args);
      if (typeof def !== "object" || def === null) {
        throw new TypeError(`Virtual table module "${moduleName}" did not return a table definition object`);
      }
      return parseTableDefinition(def, "returned", moduleName);
    };
  }
  function parseTableDefinition(def, verb, moduleName) {
    if (!hasOwnProperty.call(def, "rows")) {
      throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition without a "rows" property`);
    }
    if (!hasOwnProperty.call(def, "columns")) {
      throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition without a "columns" property`);
    }
    const rows = def.rows;
    if (typeof rows !== "function" || Object.getPrototypeOf(rows) !== GeneratorFunctionPrototype) {
      throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with an invalid "rows" property (should be a generator function)`);
    }
    let columns = def.columns;
    if (!Array.isArray(columns) || !(columns = [...columns]).every((x) => typeof x === "string")) {
      throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with an invalid "columns" property (should be an array of strings)`);
    }
    if (columns.length !== new Set(columns).size) {
      throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with duplicate column names`);
    }
    if (!columns.length) {
      throw new RangeError(`Virtual table module "${moduleName}" ${verb} a table definition with zero columns`);
    }
    let parameters;
    if (hasOwnProperty.call(def, "parameters")) {
      parameters = def.parameters;
      if (!Array.isArray(parameters) || !(parameters = [...parameters]).every((x) => typeof x === "string")) {
        throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with an invalid "parameters" property (should be an array of strings)`);
      }
    } else {
      parameters = inferParameters(rows);
    }
    if (parameters.length !== new Set(parameters).size) {
      throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with duplicate parameter names`);
    }
    if (parameters.length > 32) {
      throw new RangeError(`Virtual table module "${moduleName}" ${verb} a table definition with more than the maximum number of 32 parameters`);
    }
    for (const parameter of parameters) {
      if (columns.includes(parameter)) {
        throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with column "${parameter}" which was ambiguously defined as both a column and parameter`);
      }
    }
    let safeIntegers = 2;
    if (hasOwnProperty.call(def, "safeIntegers")) {
      const bool = def.safeIntegers;
      if (typeof bool !== "boolean") {
        throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with an invalid "safeIntegers" property (should be a boolean)`);
      }
      safeIntegers = +bool;
    }
    let directOnly = false;
    if (hasOwnProperty.call(def, "directOnly")) {
      directOnly = def.directOnly;
      if (typeof directOnly !== "boolean") {
        throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with an invalid "directOnly" property (should be a boolean)`);
      }
    }
    const columnDefinitions = [
      ...parameters.map(identifier).map((str) => `${str} HIDDEN`),
      ...columns.map(identifier)
    ];
    return [
      `CREATE TABLE x(${columnDefinitions.join(", ")});`,
      wrapGenerator(rows, new Map(columns.map((x, i) => [x, parameters.length + i])), moduleName),
      parameters,
      safeIntegers,
      directOnly
    ];
  }
  function wrapGenerator(generator, columnMap, moduleName) {
    return function* virtualTable(...args) {
      const output = args.map((x) => Buffer.isBuffer(x) ? Buffer.from(x) : x);
      for (let i = 0; i < columnMap.size; ++i) {
        output.push(null);
      }
      for (const row of generator(...args)) {
        if (Array.isArray(row)) {
          extractRowArray(row, output, columnMap.size, moduleName);
          yield output;
        } else if (typeof row === "object" && row !== null) {
          extractRowObject(row, output, columnMap, moduleName);
          yield output;
        } else {
          throw new TypeError(`Virtual table module "${moduleName}" yielded something that isn't a valid row object`);
        }
      }
    };
  }
  function extractRowArray(row, output, columnCount, moduleName) {
    if (row.length !== columnCount) {
      throw new TypeError(`Virtual table module "${moduleName}" yielded a row with an incorrect number of columns`);
    }
    const offset = output.length - columnCount;
    for (let i = 0; i < columnCount; ++i) {
      output[i + offset] = row[i];
    }
  }
  function extractRowObject(row, output, columnMap, moduleName) {
    let count = 0;
    for (const key of Object.keys(row)) {
      const index = columnMap.get(key);
      if (index === void 0) {
        throw new TypeError(`Virtual table module "${moduleName}" yielded a row with an undeclared column "${key}"`);
      }
      output[index] = row[key];
      count += 1;
    }
    if (count !== columnMap.size) {
      throw new TypeError(`Virtual table module "${moduleName}" yielded a row with missing columns`);
    }
  }
  function inferParameters({ length }) {
    if (!Number.isInteger(length) || length < 0) {
      throw new TypeError("Expected function.length to be a positive integer");
    }
    const params = [];
    for (let i = 0; i < length; ++i) {
      params.push(`$${i + 1}`);
    }
    return params;
  }
  const { hasOwnProperty } = Object.prototype;
  const { apply } = Function.prototype;
  const GeneratorFunctionPrototype = Object.getPrototypeOf(function* () {
  });
  const identifier = (str) => `"${str.replace(/"/g, '""')}"`;
  const defer = (x) => () => x;
  return table;
}
var inspect;
var hasRequiredInspect;
function requireInspect() {
  if (hasRequiredInspect) return inspect;
  hasRequiredInspect = 1;
  const DatabaseInspection = function Database2() {
  };
  inspect = function inspect2(depth, opts) {
    return Object.assign(new DatabaseInspection(), this);
  };
  return inspect;
}
const fs = fs$1;
const path = path$1;
const util = util$1;
const SqliteError = sqliteError;
let DEFAULT_ADDON;
function Database$1(filenameGiven, options) {
  if (new.target == null) {
    return new Database$1(filenameGiven, options);
  }
  let buffer;
  if (Buffer.isBuffer(filenameGiven)) {
    buffer = filenameGiven;
    filenameGiven = ":memory:";
  }
  if (filenameGiven == null) filenameGiven = "";
  if (options == null) options = {};
  if (typeof filenameGiven !== "string") throw new TypeError("Expected first argument to be a string");
  if (typeof options !== "object") throw new TypeError("Expected second argument to be an options object");
  if ("readOnly" in options) throw new TypeError('Misspelled option "readOnly" should be "readonly"');
  if ("memory" in options) throw new TypeError('Option "memory" was removed in v7.0.0 (use ":memory:" filename instead)');
  const filename = filenameGiven.trim();
  const anonymous = filename === "" || filename === ":memory:";
  const readonly = util.getBooleanOption(options, "readonly");
  const fileMustExist = util.getBooleanOption(options, "fileMustExist");
  const timeout = "timeout" in options ? options.timeout : 5e3;
  const verbose = "verbose" in options ? options.verbose : null;
  const nativeBinding = "nativeBinding" in options ? options.nativeBinding : null;
  if (readonly && anonymous && !buffer) throw new TypeError("In-memory/temporary databases cannot be readonly");
  if (!Number.isInteger(timeout) || timeout < 0) throw new TypeError('Expected the "timeout" option to be a positive integer');
  if (timeout > 2147483647) throw new RangeError('Option "timeout" cannot be greater than 2147483647');
  if (verbose != null && typeof verbose !== "function") throw new TypeError('Expected the "verbose" option to be a function');
  if (nativeBinding != null && typeof nativeBinding !== "string" && typeof nativeBinding !== "object") throw new TypeError('Expected the "nativeBinding" option to be a string or addon object');
  let addon;
  if (nativeBinding == null) {
    addon = DEFAULT_ADDON || (DEFAULT_ADDON = requireBindings()("better_sqlite3.node"));
  } else if (typeof nativeBinding === "string") {
    const requireFunc = typeof __non_webpack_require__ === "function" ? __non_webpack_require__ : commonjsRequire;
    addon = requireFunc(path.resolve(nativeBinding).replace(/(\.node)?$/, ".node"));
  } else {
    addon = nativeBinding;
  }
  if (!addon.isInitialized) {
    addon.setErrorConstructor(SqliteError);
    addon.isInitialized = true;
  }
  if (!anonymous && !filename.startsWith("file:") && !fs.existsSync(path.dirname(filename))) {
    throw new TypeError("Cannot open database because the directory does not exist");
  }
  Object.defineProperties(this, {
    [util.cppdb]: { value: new addon.Database(filename, filenameGiven, anonymous, readonly, fileMustExist, timeout, verbose || null, buffer || null) },
    ...wrappers.getters
  });
}
const wrappers = requireWrappers();
Database$1.prototype.prepare = wrappers.prepare;
Database$1.prototype.transaction = requireTransaction();
Database$1.prototype.pragma = requirePragma();
Database$1.prototype.backup = requireBackup();
Database$1.prototype.serialize = requireSerialize();
Database$1.prototype.function = require_function();
Database$1.prototype.aggregate = requireAggregate();
Database$1.prototype.table = requireTable();
Database$1.prototype.loadExtension = wrappers.loadExtension;
Database$1.prototype.exec = wrappers.exec;
Database$1.prototype.close = wrappers.close;
Database$1.prototype.defaultSafeIntegers = wrappers.defaultSafeIntegers;
Database$1.prototype.unsafeMode = wrappers.unsafeMode;
Database$1.prototype[util.inspect] = requireInspect();
var database = Database$1;
lib.exports = database;
lib.exports.SqliteError = sqliteError;
var libExports = lib.exports;
const Database = /* @__PURE__ */ getDefaultExportFromCjs(libExports);
class SeleneMemoryManager {
  constructor(config = {}) {
    __publicField(this, "db", null);
    __publicField(this, "config");
    __publicField(this, "currentSessionId", null);
    __publicField(this, "isInitialized", false);
    // Prepared statements (cache para rendimiento)
    __publicField(this, "statements", {});
    this.config = {
      dbPath: config.dbPath ?? this.getDefaultDbPath(),
      enableWAL: config.enableWAL ?? true,
      maxPalettesHistory: config.maxPalettesHistory ?? 1e5,
      maxDreamsHistory: config.maxDreamsHistory ?? 5e4,
      backupOnClose: config.backupOnClose ?? true
    };
  }
  /**
   * Obtiene la ruta por defecto de la base de datos
   */
  getDefaultDbPath() {
    if (typeof electron.app !== "undefined" && electron.app.getPath) {
      const userDataPath = electron.app.getPath("userData");
      return path__namespace.join(userDataPath, "selene-memory.db");
    }
    return path__namespace.join(process.cwd(), "selene-memory.db");
  }
  /**
   * Inicializa la base de datos
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    try {
      const dbDir = path__namespace.dirname(this.config.dbPath);
      if (!fs__namespace.existsSync(dbDir)) {
        fs__namespace.mkdirSync(dbDir, { recursive: true });
      }
      this.db = new Database(this.config.dbPath);
      if (this.config.enableWAL) {
        this.db.pragma("journal_mode = WAL");
      }
      this.db.pragma("synchronous = NORMAL");
      this.db.pragma("cache_size = -64000");
      this.db.pragma("temp_store = MEMORY");
      this.db.pragma("foreign_keys = ON");
      this.createSchema();
      this.prepareStatements();
      this.isInitialized = true;
      console.log(`[SeleneMemory] ✅ Initialized at: ${this.config.dbPath}`);
    } catch (error) {
      console.error("[SeleneMemory] ❌ Initialization failed:", error);
      throw error;
    }
  }
  /**
   * Crea el schema de la base de datos
   */
  createSchema() {
    if (!this.db) throw new Error("Database not connected");
    this.db.exec(`
      -- Paletas
      CREATE TABLE IF NOT EXISTS palettes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        key TEXT,
        mode TEXT,
        energy REAL NOT NULL,
        syncopation REAL DEFAULT 0,
        genre TEXT,
        section TEXT,
        primary_h REAL NOT NULL,
        primary_s REAL NOT NULL,
        primary_l REAL NOT NULL,
        secondary_h REAL NOT NULL,
        secondary_s REAL NOT NULL,
        secondary_l REAL NOT NULL,
        accent_h REAL NOT NULL,
        accent_s REAL NOT NULL,
        accent_l REAL NOT NULL,
        ambient_h REAL,
        ambient_s REAL,
        ambient_l REAL,
        contrast_h REAL,
        contrast_s REAL,
        contrast_l REAL,
        color_strategy TEXT NOT NULL,
        transition_speed INTEGER,
        confidence REAL DEFAULT 0.5,
        beauty_score REAL,
        user_feedback INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      -- Patrones
      CREATE TABLE IF NOT EXISTS patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        pattern_hash TEXT UNIQUE NOT NULL,
        genre TEXT NOT NULL,
        key TEXT,
        mode TEXT,
        section TEXT,
        energy_range_min REAL DEFAULT 0,
        energy_range_max REAL DEFAULT 1,
        preferred_strategy TEXT,
        preferred_hue_base REAL,
        preferred_saturation REAL,
        preferred_intensity REAL,
        preferred_movement TEXT,
        strobe_on_beat INTEGER DEFAULT 1,
        strobe_intensity REAL DEFAULT 0.5,
        times_used INTEGER DEFAULT 0,
        total_beauty_score REAL DEFAULT 0,
        positive_feedback INTEGER DEFAULT 0,
        negative_feedback INTEGER DEFAULT 0,
        beauty_trend TEXT DEFAULT 'stable',
        last_10_scores TEXT
      );

      -- Sesiones
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        duration_seconds INTEGER,
        total_frames INTEGER DEFAULT 0,
        total_palettes INTEGER DEFAULT 0,
        avg_beauty_score REAL,
        max_beauty_score REAL,
        min_beauty_score REAL,
        dominant_genre TEXT,
        dominant_mood TEXT,
        genre_distribution TEXT,
        avg_energy REAL,
        preferred_intensity REAL,
        preferred_color_temp TEXT,
        app_version TEXT,
        os_platform TEXT,
        user_notes TEXT
      );

      -- Preferencias
      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        updated_at INTEGER NOT NULL
      );

      -- Sueños
      CREATE TABLE IF NOT EXISTS dreams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        session_id TEXT,
        dream_type TEXT NOT NULL,
        context_json TEXT NOT NULL,
        proposed_change_json TEXT NOT NULL,
        projected_beauty REAL NOT NULL,
        beauty_delta REAL,
        was_accepted INTEGER NOT NULL,
        rejection_reason TEXT,
        alternatives_json TEXT,
        execution_time_ms REAL
      );

      -- Calibración de fixtures
      CREATE TABLE IF NOT EXISTS fixture_calibration (
        fixture_id TEXT PRIMARY KEY,
        fixture_name TEXT,
        fixture_type TEXT NOT NULL,
        pan_offset INTEGER DEFAULT 0,
        tilt_offset INTEGER DEFAULT 0,
        pan_invert INTEGER DEFAULT 0,
        tilt_invert INTEGER DEFAULT 0,
        dimmer_curve TEXT DEFAULT 'linear',
        dimmer_min INTEGER DEFAULT 0,
        dimmer_max INTEGER DEFAULT 255,
        color_temp_offset INTEGER DEFAULT 0,
        color_correction_r REAL DEFAULT 1.0,
        color_correction_g REAL DEFAULT 1.0,
        color_correction_b REAL DEFAULT 1.0,
        max_intensity REAL DEFAULT 1.0,
        min_intensity REAL DEFAULT 0.0,
        max_strobe_rate INTEGER DEFAULT 25,
        dmx_universe INTEGER,
        dmx_address INTEGER,
        notes TEXT,
        updated_at INTEGER NOT NULL
      );

      -- Índices
      CREATE INDEX IF NOT EXISTS idx_palettes_session ON palettes(session_id);
      CREATE INDEX IF NOT EXISTS idx_palettes_genre ON palettes(genre);
      CREATE INDEX IF NOT EXISTS idx_palettes_beauty ON palettes(beauty_score);
      CREATE INDEX IF NOT EXISTS idx_patterns_hash ON patterns(pattern_hash);
      CREATE INDEX IF NOT EXISTS idx_patterns_genre ON patterns(genre);
      CREATE INDEX IF NOT EXISTS idx_dreams_session ON dreams(session_id);

      -- Preferencias por defecto
      INSERT OR IGNORE INTO preferences (key, value, category, updated_at) VALUES
        ('strobe_max_intensity', '0.8', 'effects', strftime('%s', 'now') * 1000),
        ('strobe_enabled', 'true', 'effects', strftime('%s', 'now') * 1000),
        ('color_saturation_boost', '1.0', 'colors', strftime('%s', 'now') * 1000),
        ('movement_speed_multiplier', '1.0', 'movement', strftime('%s', 'now') * 1000),
        ('auto_blackout_on_silence', 'true', 'behavior', strftime('%s', 'now') * 1000);
    `);
  }
  /**
   * Prepara los statements SQL para mejor rendimiento
   */
  prepareStatements() {
    if (!this.db) return;
    this.statements.insertPalette = this.db.prepare(`
      INSERT INTO palettes (
        timestamp, session_id, key, mode, energy, syncopation, genre, section,
        primary_h, primary_s, primary_l, secondary_h, secondary_s, secondary_l,
        accent_h, accent_s, accent_l, ambient_h, ambient_s, ambient_l,
        contrast_h, contrast_s, contrast_l, color_strategy, transition_speed,
        confidence, beauty_score, user_feedback
      ) VALUES (
        @timestamp, @sessionId, @key, @mode, @energy, @syncopation, @genre, @section,
        @primaryH, @primaryS, @primaryL, @secondaryH, @secondaryS, @secondaryL,
        @accentH, @accentS, @accentL, @ambientH, @ambientS, @ambientL,
        @contrastH, @contrastS, @contrastL, @colorStrategy, @transitionSpeed,
        @confidence, @beautyScore, @userFeedback
      )
    `);
    this.statements.getPattern = this.db.prepare(`
      SELECT * FROM patterns WHERE pattern_hash = ?
    `);
    this.statements.getBestPattern = this.db.prepare(`
      SELECT *,
        (total_beauty_score / NULLIF(times_used, 0)) as avg_beauty
      FROM patterns 
      WHERE genre = ? 
        AND (key IS NULL OR key = ?)
        AND (section IS NULL OR section = ?)
        AND times_used >= 3
      ORDER BY avg_beauty DESC
      LIMIT 1
    `);
    this.statements.insertSession = this.db.prepare(`
      INSERT INTO sessions (id, started_at, app_version, os_platform)
      VALUES (@id, @startedAt, @appVersion, @osPlatform)
    `);
    this.statements.updateSession = this.db.prepare(`
      UPDATE sessions SET
        ended_at = @endedAt,
        duration_seconds = @durationSeconds,
        total_frames = @totalFrames,
        total_palettes = @totalPalettes,
        avg_beauty_score = @avgBeautyScore,
        max_beauty_score = @maxBeautyScore,
        min_beauty_score = @minBeautyScore,
        dominant_genre = @dominantGenre,
        genre_distribution = @genreDistribution,
        avg_energy = @avgEnergy
      WHERE id = @id
    `);
    this.statements.insertDream = this.db.prepare(`
      INSERT INTO dreams (
        timestamp, session_id, dream_type, context_json, proposed_change_json,
        projected_beauty, beauty_delta, was_accepted, rejection_reason,
        alternatives_json, execution_time_ms
      ) VALUES (
        @timestamp, @sessionId, @dreamType, @contextJson, @proposedChangeJson,
        @projectedBeauty, @beautyDelta, @wasAccepted, @rejectionReason,
        @alternativesJson, @executionTimeMs
      )
    `);
    this.statements.getPreference = this.db.prepare(`
      SELECT value FROM preferences WHERE key = ?
    `);
    this.statements.setPreference = this.db.prepare(`
      INSERT INTO preferences (key, value, category, updated_at)
      VALUES (@key, @value, @category, @updatedAt)
      ON CONFLICT(key) DO UPDATE SET
        value = @value,
        updated_at = @updatedAt
    `);
  }
  // ═══════════════════════════════════════════════════════════════════════════
  // PALETAS
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * Guarda una paleta generada
   */
  savePalette(palette) {
    var _a, _b, _c, _d, _e, _f;
    if (!this.db || !this.statements.insertPalette) {
      throw new Error("Database not initialized");
    }
    const result = this.statements.insertPalette.run({
      timestamp: Date.now(),
      sessionId: palette.sessionId,
      key: palette.musicalDna.key ?? null,
      mode: palette.musicalDna.mode ?? null,
      energy: palette.musicalDna.energy,
      syncopation: palette.musicalDna.syncopation ?? 0,
      genre: palette.musicalDna.genre ?? null,
      section: palette.musicalDna.section ?? null,
      primaryH: palette.colors.primary.h,
      primaryS: palette.colors.primary.s,
      primaryL: palette.colors.primary.l,
      secondaryH: palette.colors.secondary.h,
      secondaryS: palette.colors.secondary.s,
      secondaryL: palette.colors.secondary.l,
      accentH: palette.colors.accent.h,
      accentS: palette.colors.accent.s,
      accentL: palette.colors.accent.l,
      ambientH: ((_a = palette.colors.ambient) == null ? void 0 : _a.h) ?? null,
      ambientS: ((_b = palette.colors.ambient) == null ? void 0 : _b.s) ?? null,
      ambientL: ((_c = palette.colors.ambient) == null ? void 0 : _c.l) ?? null,
      contrastH: ((_d = palette.colors.contrast) == null ? void 0 : _d.h) ?? null,
      contrastS: ((_e = palette.colors.contrast) == null ? void 0 : _e.s) ?? null,
      contrastL: ((_f = palette.colors.contrast) == null ? void 0 : _f.l) ?? null,
      colorStrategy: palette.colorStrategy,
      transitionSpeed: palette.transitionSpeed ?? null,
      confidence: palette.musicalDna.confidence ?? 0.5,
      beautyScore: palette.beautyScore ?? null,
      userFeedback: palette.userFeedback ?? 0
    });
    return result.lastInsertRowid;
  }
  /**
   * Obtiene paletas recientes
   */
  getRecentPalettes(limit = 100) {
    if (!this.db) throw new Error("Database not initialized");
    const rows = this.db.prepare(`
      SELECT * FROM palettes 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(limit);
    return rows.map((row) => this.rowToPaletteRecord(row));
  }
  /**
   * Obtiene paletas por género
   */
  getPalettesByGenre(genre, limit = 50) {
    if (!this.db) throw new Error("Database not initialized");
    const rows = this.db.prepare(`
      SELECT * FROM palettes 
      WHERE genre = ?
      ORDER BY beauty_score DESC, timestamp DESC 
      LIMIT ?
    `).all(genre, limit);
    return rows.map((row) => this.rowToPaletteRecord(row));
  }
  /**
   * Actualiza el beauty score de una paleta
   */
  updatePaletteBeauty(paletteId, beautyScore) {
    if (!this.db) throw new Error("Database not initialized");
    this.db.prepare(`
      UPDATE palettes SET beauty_score = ? WHERE id = ?
    `).run(beautyScore, paletteId);
  }
  /**
   * Registra feedback del usuario
   */
  recordUserFeedback(paletteId, feedback) {
    if (!this.db) throw new Error("Database not initialized");
    this.db.prepare(`
      UPDATE palettes SET user_feedback = ? WHERE id = ?
    `).run(feedback, paletteId);
  }
  /**
   * Convierte una fila de la DB a PaletteRecord
   */
  rowToPaletteRecord(row) {
    return {
      sessionId: row.session_id,
      musicalDna: {
        key: row.key,
        mode: row.mode,
        energy: row.energy,
        syncopation: row.syncopation,
        genre: row.genre,
        section: row.section,
        confidence: row.confidence
      },
      colors: {
        primary: { h: row.primary_h, s: row.primary_s, l: row.primary_l },
        secondary: { h: row.secondary_h, s: row.secondary_s, l: row.secondary_l },
        accent: { h: row.accent_h, s: row.accent_s, l: row.accent_l },
        ambient: row.ambient_h ? { h: row.ambient_h, s: row.ambient_s, l: row.ambient_l } : void 0,
        contrast: row.contrast_h ? { h: row.contrast_h, s: row.contrast_s, l: row.contrast_l } : void 0
      },
      colorStrategy: row.color_strategy,
      transitionSpeed: row.transition_speed,
      beautyScore: row.beauty_score,
      userFeedback: row.user_feedback
    };
  }
  // ═══════════════════════════════════════════════════════════════════════════
  // PATRONES APRENDIDOS
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * Genera un hash único para un patrón
   */
  generatePatternHash(genre, key, mode, section) {
    return `${genre}:${key ?? "*"}:${mode ?? "*"}:${section ?? "*"}`;
  }
  /**
   * Aprende de una paleta exitosa
   */
  learnPattern(genre, key, mode, section, beautyScore, settings) {
    var _a;
    if (!this.db) throw new Error("Database not initialized");
    const hash = this.generatePatternHash(genre, key, mode, section);
    const now = Date.now();
    const existing = (_a = this.statements.getPattern) == null ? void 0 : _a.get(hash);
    if (existing) {
      const timesUsed = existing.times_used + 1;
      const totalBeauty = existing.total_beauty_score + beautyScore;
      let last10 = [];
      if (existing.last_10_scores) {
        try {
          last10 = JSON.parse(existing.last_10_scores);
        } catch {
        }
      }
      last10.push(beautyScore);
      if (last10.length > 10) last10.shift();
      let trend = "stable";
      if (last10.length >= 5) {
        const firstHalf = last10.slice(0, Math.floor(last10.length / 2));
        const secondHalf = last10.slice(Math.floor(last10.length / 2));
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        if (secondAvg > firstAvg + 0.05) trend = "rising";
        else if (secondAvg < firstAvg - 0.05) trend = "falling";
      }
      this.db.prepare(`
        UPDATE patterns SET
          updated_at = ?,
          times_used = ?,
          total_beauty_score = ?,
          last_10_scores = ?,
          beauty_trend = ?,
          preferred_strategy = COALESCE(?, preferred_strategy),
          preferred_hue_base = COALESCE(?, preferred_hue_base),
          preferred_saturation = COALESCE(?, preferred_saturation),
          preferred_intensity = COALESCE(?, preferred_intensity),
          preferred_movement = COALESCE(?, preferred_movement)
        WHERE pattern_hash = ?
      `).run(
        now,
        timesUsed,
        totalBeauty,
        JSON.stringify(last10),
        trend,
        settings.strategy ?? null,
        settings.hueBase ?? null,
        settings.saturation ?? null,
        settings.intensity ?? null,
        settings.movement ?? null,
        hash
      );
    } else {
      this.db.prepare(`
        INSERT INTO patterns (
          created_at, updated_at, pattern_hash, genre, key, mode, section,
          preferred_strategy, preferred_hue_base, preferred_saturation,
          preferred_intensity, preferred_movement, strobe_on_beat, strobe_intensity,
          times_used, total_beauty_score, last_10_scores, beauty_trend
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'stable')
      `).run(
        now,
        now,
        hash,
        genre,
        key ?? null,
        mode ?? null,
        section ?? null,
        settings.strategy ?? null,
        settings.hueBase ?? null,
        settings.saturation ?? null,
        settings.intensity ?? null,
        settings.movement ?? null,
        settings.strobeOnBeat !== false ? 1 : 0,
        settings.strobeIntensity ?? 0.5,
        beautyScore,
        JSON.stringify([beautyScore])
      );
    }
  }
  /**
   * Encuentra patrones exitosos para un contexto
   */
  findSuccessfulPatterns(genre, key, section, minTimesUsed = 3) {
    if (!this.db) throw new Error("Database not initialized");
    const rows = this.db.prepare(`
      SELECT *,
        (total_beauty_score / NULLIF(times_used, 0)) as avg_beauty
      FROM patterns 
      WHERE genre = ? 
        AND (key IS NULL OR key = ? OR ? IS NULL)
        AND (section IS NULL OR section = ? OR ? IS NULL)
        AND times_used >= ?
      ORDER BY avg_beauty DESC
      LIMIT 10
    `).all(genre, key, key, section, section, minTimesUsed);
    return rows.map((row) => this.rowToLearnedPattern(row));
  }
  /**
   * Obtiene el mejor patrón para un contexto
   */
  getBestPattern(genre, key, section) {
    if (!this.db || !this.statements.getBestPattern) {
      throw new Error("Database not initialized");
    }
    const row = this.statements.getBestPattern.get(genre, key, section);
    return row ? this.rowToLearnedPattern(row) : null;
  }
  /**
   * Registra feedback positivo/negativo en un patrón
   */
  recordPatternFeedback(patternHash, positive) {
    if (!this.db) throw new Error("Database not initialized");
    const column = positive ? "positive_feedback" : "negative_feedback";
    this.db.prepare(`
      UPDATE patterns SET ${column} = ${column} + 1, updated_at = ?
      WHERE pattern_hash = ?
    `).run(Date.now(), patternHash);
  }
  /**
   * Convierte una fila de la DB a LearnedPattern
   */
  rowToLearnedPattern(row) {
    return {
      id: row.id,
      patternHash: row.pattern_hash,
      genre: row.genre,
      key: row.key,
      mode: row.mode,
      section: row.section,
      energyRange: {
        min: row.energy_range_min ?? 0,
        max: row.energy_range_max ?? 1
      },
      preferredStrategy: row.preferred_strategy,
      preferredHueBase: row.preferred_hue_base,
      preferredSaturation: row.preferred_saturation,
      preferredIntensity: row.preferred_intensity,
      preferredMovement: row.preferred_movement,
      strobeOnBeat: Boolean(row.strobe_on_beat),
      strobeIntensity: row.strobe_intensity ?? 0.5,
      timesUsed: row.times_used ?? 0,
      avgBeautyScore: row.avg_beauty ?? 0,
      positiveFeedback: row.positive_feedback ?? 0,
      negativeFeedback: row.negative_feedback ?? 0,
      beautyTrend: row.beauty_trend ?? "stable"
    };
  }
  // ═══════════════════════════════════════════════════════════════════════════
  // SESIONES
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * Inicia una nueva sesión
   */
  startSession(appVersion) {
    if (!this.db || !this.statements.insertSession) {
      throw new Error("Database not initialized");
    }
    const sessionId = this.generateSessionId();
    this.statements.insertSession.run({
      id: sessionId,
      startedAt: Date.now(),
      appVersion: appVersion ?? "1.0.0",
      osPlatform: process.platform
    });
    this.currentSessionId = sessionId;
    return sessionId;
  }
  /**
   * Finaliza la sesión actual
   */
  endSession(stats) {
    var _a;
    if (!this.db || !this.currentSessionId) return;
    const startedAt = this.db.prepare(`
      SELECT started_at FROM sessions WHERE id = ?
    `).get(this.currentSessionId);
    if (!startedAt) return;
    const now = Date.now();
    const durationSeconds = Math.floor((now - startedAt.started_at) / 1e3);
    (_a = this.statements.updateSession) == null ? void 0 : _a.run({
      id: this.currentSessionId,
      endedAt: now,
      durationSeconds,
      totalFrames: (stats == null ? void 0 : stats.totalFrames) ?? 0,
      totalPalettes: (stats == null ? void 0 : stats.totalPalettes) ?? 0,
      avgBeautyScore: (stats == null ? void 0 : stats.avgBeautyScore) ?? null,
      maxBeautyScore: (stats == null ? void 0 : stats.maxBeautyScore) ?? null,
      minBeautyScore: (stats == null ? void 0 : stats.minBeautyScore) ?? null,
      dominantGenre: (stats == null ? void 0 : stats.dominantGenre) ?? null,
      genreDistribution: (stats == null ? void 0 : stats.genreDistribution) ? JSON.stringify(stats.genreDistribution) : null,
      avgEnergy: (stats == null ? void 0 : stats.avgEnergy) ?? null
    });
    this.currentSessionId = null;
  }
  /**
   * Obtiene la sesión actual
   */
  getCurrentSessionId() {
    return this.currentSessionId;
  }
  /**
   * Genera un ID único de sesión
   */
  generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `ses_${timestamp}_${random}`;
  }
  /**
   * Obtiene sesiones recientes
   */
  getRecentSessions(limit = 30) {
    if (!this.db) throw new Error("Database not initialized");
    const rows = this.db.prepare(`
      SELECT * FROM sessions 
      WHERE ended_at IS NOT NULL
      ORDER BY started_at DESC 
      LIMIT ?
    `).all(limit);
    return rows.map((row) => ({
      id: row.id,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      durationSeconds: row.duration_seconds,
      totalFrames: row.total_frames ?? 0,
      totalPalettes: row.total_palettes ?? 0,
      avgBeautyScore: row.avg_beauty_score,
      maxBeautyScore: row.max_beauty_score,
      minBeautyScore: row.min_beauty_score,
      dominantGenre: row.dominant_genre,
      dominantMood: row.dominant_mood,
      genreDistribution: row.genre_distribution ? JSON.parse(row.genre_distribution) : void 0,
      avgEnergy: row.avg_energy,
      preferredIntensity: row.preferred_intensity,
      preferredColorTemp: row.preferred_color_temp,
      appVersion: row.app_version,
      osPlatform: row.os_platform,
      userNotes: row.user_notes
    }));
  }
  // ═══════════════════════════════════════════════════════════════════════════
  // PREFERENCIAS
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * Obtiene una preferencia
   */
  getPreference(key, defaultValue) {
    if (!this.db || !this.statements.getPreference) {
      return defaultValue;
    }
    const row = this.statements.getPreference.get(key);
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value);
    } catch {
      return row.value;
    }
  }
  /**
   * Guarda una preferencia
   */
  setPreference(key, value, category = "general") {
    if (!this.db || !this.statements.setPreference) {
      throw new Error("Database not initialized");
    }
    this.statements.setPreference.run({
      key,
      value: JSON.stringify(value),
      category,
      updatedAt: Date.now()
    });
  }
  /**
   * Obtiene todas las preferencias de una categoría
   */
  getPreferencesByCategory(category) {
    if (!this.db) throw new Error("Database not initialized");
    const rows = this.db.prepare(`
      SELECT key, value FROM preferences WHERE category = ?
    `).all(category);
    const result = {};
    for (const row of rows) {
      try {
        result[row.key] = JSON.parse(row.value);
      } catch {
        result[row.key] = row.value;
      }
    }
    return result;
  }
  // ═══════════════════════════════════════════════════════════════════════════
  // SUEÑOS (DREAMFORGE)
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * Guarda un sueño (simulación de DreamForge)
   */
  saveDream(dream) {
    if (!this.db || !this.statements.insertDream) {
      throw new Error("Database not initialized");
    }
    const result = this.statements.insertDream.run({
      timestamp: Date.now(),
      sessionId: dream.sessionId ?? this.currentSessionId,
      dreamType: dream.dreamType,
      contextJson: JSON.stringify(dream.context),
      proposedChangeJson: JSON.stringify(dream.proposedChange),
      projectedBeauty: dream.projectedBeauty,
      beautyDelta: dream.beautyDelta ?? null,
      wasAccepted: dream.wasAccepted ? 1 : 0,
      rejectionReason: dream.rejectionReason ?? null,
      alternativesJson: dream.alternatives ? JSON.stringify(dream.alternatives) : null,
      executionTimeMs: dream.executionTimeMs ?? null
    });
    return result.lastInsertRowid;
  }
  /**
   * Obtiene estadísticas de sueños
   */
  getDreamStats() {
    if (!this.db) throw new Error("Database not initialized");
    const total = this.db.prepare(`SELECT COUNT(*) as count FROM dreams`).get();
    const accepted = this.db.prepare(`SELECT COUNT(*) as count FROM dreams WHERE was_accepted = 1`).get();
    const avgBeauty = this.db.prepare(`SELECT AVG(projected_beauty) as avg FROM dreams`).get();
    const byTypeRows = this.db.prepare(`
      SELECT 
        dream_type,
        COUNT(*) as count,
        SUM(was_accepted) as accepted
      FROM dreams
      GROUP BY dream_type
    `).all();
    const byType = {};
    for (const row of byTypeRows) {
      byType[row.dream_type] = {
        count: row.count,
        acceptanceRate: row.count > 0 ? row.accepted / row.count : 0
      };
    }
    return {
      total: total.count,
      accepted: accepted.count,
      acceptanceRate: total.count > 0 ? accepted.count / total.count : 0,
      avgProjectedBeauty: avgBeauty.avg ?? 0,
      byType
    };
  }
  // ═══════════════════════════════════════════════════════════════════════════
  // CALIBRACIÓN DE FIXTURES
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * Guarda o actualiza calibración de un fixture
   */
  saveFixtureCalibration(calibration) {
    var _a, _b, _c;
    if (!this.db) throw new Error("Database not initialized");
    this.db.prepare(`
      INSERT INTO fixture_calibration (
        fixture_id, fixture_name, fixture_type, pan_offset, tilt_offset,
        pan_invert, tilt_invert, dimmer_curve, dimmer_min, dimmer_max,
        color_temp_offset, color_correction_r, color_correction_g, color_correction_b,
        max_intensity, min_intensity, max_strobe_rate, dmx_universe, dmx_address,
        notes, updated_at
      ) VALUES (
        @fixtureId, @fixtureName, @fixtureType, @panOffset, @tiltOffset,
        @panInvert, @tiltInvert, @dimmerCurve, @dimmerMin, @dimmerMax,
        @colorTempOffset, @colorCorrectionR, @colorCorrectionG, @colorCorrectionB,
        @maxIntensity, @minIntensity, @maxStrobeRate, @dmxUniverse, @dmxAddress,
        @notes, @updatedAt
      )
      ON CONFLICT(fixture_id) DO UPDATE SET
        fixture_name = @fixtureName,
        fixture_type = @fixtureType,
        pan_offset = @panOffset,
        tilt_offset = @tiltOffset,
        pan_invert = @panInvert,
        tilt_invert = @tiltInvert,
        dimmer_curve = @dimmerCurve,
        dimmer_min = @dimmerMin,
        dimmer_max = @dimmerMax,
        color_temp_offset = @colorTempOffset,
        color_correction_r = @colorCorrectionR,
        color_correction_g = @colorCorrectionG,
        color_correction_b = @colorCorrectionB,
        max_intensity = @maxIntensity,
        min_intensity = @minIntensity,
        max_strobe_rate = @maxStrobeRate,
        dmx_universe = @dmxUniverse,
        dmx_address = @dmxAddress,
        notes = @notes,
        updated_at = @updatedAt
    `).run({
      fixtureId: calibration.fixtureId,
      fixtureName: calibration.fixtureName ?? null,
      fixtureType: calibration.fixtureType,
      panOffset: calibration.panOffset ?? 0,
      tiltOffset: calibration.tiltOffset ?? 0,
      panInvert: calibration.panInvert ? 1 : 0,
      tiltInvert: calibration.tiltInvert ? 1 : 0,
      dimmerCurve: calibration.dimmerCurve ?? "linear",
      dimmerMin: calibration.dimmerMin ?? 0,
      dimmerMax: calibration.dimmerMax ?? 255,
      colorTempOffset: calibration.colorTempOffset ?? 0,
      colorCorrectionR: ((_a = calibration.colorCorrection) == null ? void 0 : _a.r) ?? 1,
      colorCorrectionG: ((_b = calibration.colorCorrection) == null ? void 0 : _b.g) ?? 1,
      colorCorrectionB: ((_c = calibration.colorCorrection) == null ? void 0 : _c.b) ?? 1,
      maxIntensity: calibration.maxIntensity ?? 1,
      minIntensity: calibration.minIntensity ?? 0,
      maxStrobeRate: calibration.maxStrobeRate ?? 25,
      dmxUniverse: calibration.dmxUniverse ?? null,
      dmxAddress: calibration.dmxAddress ?? null,
      notes: calibration.notes ?? null,
      updatedAt: Date.now()
    });
  }
  /**
   * Obtiene calibración de un fixture
   */
  getFixtureCalibration(fixtureId) {
    if (!this.db) throw new Error("Database not initialized");
    const row = this.db.prepare(`
      SELECT * FROM fixture_calibration WHERE fixture_id = ?
    `).get(fixtureId);
    if (!row) return null;
    return {
      fixtureId: row.fixture_id,
      fixtureName: row.fixture_name,
      fixtureType: row.fixture_type,
      panOffset: row.pan_offset,
      tiltOffset: row.tilt_offset,
      panInvert: Boolean(row.pan_invert),
      tiltInvert: Boolean(row.tilt_invert),
      dimmerCurve: row.dimmer_curve,
      dimmerMin: row.dimmer_min,
      dimmerMax: row.dimmer_max,
      colorTempOffset: row.color_temp_offset,
      colorCorrection: {
        r: row.color_correction_r,
        g: row.color_correction_g,
        b: row.color_correction_b
      },
      maxIntensity: row.max_intensity,
      minIntensity: row.min_intensity,
      maxStrobeRate: row.max_strobe_rate,
      dmxUniverse: row.dmx_universe,
      dmxAddress: row.dmx_address,
      notes: row.notes
    };
  }
  // ═══════════════════════════════════════════════════════════════════════════
  // MANTENIMIENTO Y UTILIDADES
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * Limpia datos antiguos
   */
  cleanup(daysToKeep = 90) {
    if (!this.db) throw new Error("Database not initialized");
    const cutoffMs = Date.now() - daysToKeep * 24 * 60 * 60 * 1e3;
    const palettesResult = this.db.prepare(`
      DELETE FROM palettes 
      WHERE id NOT IN (
        SELECT id FROM palettes ORDER BY timestamp DESC LIMIT ?
      )
      AND timestamp < ?
    `).run(this.config.maxPalettesHistory, cutoffMs);
    const dreamsResult = this.db.prepare(`
      DELETE FROM dreams 
      WHERE id NOT IN (
        SELECT id FROM dreams ORDER BY timestamp DESC LIMIT ?
      )
      AND timestamp < ?
    `).run(this.config.maxDreamsHistory, cutoffMs);
    this.db.exec("VACUUM");
    return {
      palettesDeleted: palettesResult.changes,
      dreamsDeleted: dreamsResult.changes
    };
  }
  /**
   * Crea un backup de la base de datos
   */
  async backup(backupPath) {
    if (!this.db) throw new Error("Database not initialized");
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const finalPath = backupPath ?? this.config.dbPath.replace(".db", `-backup-${timestamp}.db`);
    await this.db.backup(finalPath);
    return finalPath;
  }
  /**
   * Obtiene estadísticas generales
   */
  getStats() {
    if (!this.db) throw new Error("Database not initialized");
    const palettes = this.db.prepare(`SELECT COUNT(*) as count FROM palettes`).get();
    const patterns = this.db.prepare(`SELECT COUNT(*) as count FROM patterns`).get();
    const sessions = this.db.prepare(`SELECT COUNT(*) as count FROM sessions`).get();
    const dreams = this.db.prepare(`SELECT COUNT(*) as count FROM dreams`).get();
    const oldest = this.db.prepare(`SELECT MIN(timestamp) as oldest FROM palettes`).get();
    let dbSizeBytes = 0;
    try {
      const stats = fs__namespace.statSync(this.config.dbPath);
      dbSizeBytes = stats.size;
    } catch {
    }
    return {
      totalPalettes: palettes.count,
      totalPatterns: patterns.count,
      totalSessions: sessions.count,
      totalDreams: dreams.count,
      dbSizeBytes,
      oldestData: oldest.oldest
    };
  }
  /**
   * Cierra la conexión a la base de datos
   */
  close() {
    if (this.db) {
      if (this.currentSessionId) {
        this.endSession();
      }
      if (this.config.backupOnClose) {
        try {
          const backupPath = this.config.dbPath.replace(".db", "-autosave.db");
          this.db.exec(`VACUUM INTO '${backupPath}'`);
        } catch (error) {
          console.warn("[SeleneMemory] Backup on close failed:", error);
        }
      }
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log("[SeleneMemory] 🔒 Database closed");
    }
  }
  /**
   * Verifica si está inicializado
   */
  isReady() {
    return this.isInitialized && this.db !== null;
  }
}
let instance = null;
function getMemoryManager(config) {
  if (!instance) {
    instance = new SeleneMemoryManager(config);
  }
  return instance;
}
const KEY_TO_HUE = {
  // Naturales
  "C": 0,
  // Do - Rojo
  "D": 60,
  // Re - Naranja
  "E": 120,
  // Mi - Amarillo
  "F": 150,
  // Fa - Verde-Amarillo
  "G": 210,
  // Sol - Cyan
  "A": 270,
  // La - Índigo
  "B": 330,
  // Si - Magenta
  // Sostenidos
  "C#": 30,
  // Do# - Rojo-Naranja
  "D#": 90,
  // Re# - Amarillo-Naranja
  "F#": 180,
  // Fa# - Verde (tritono de C)
  "G#": 240,
  // Sol# - Azul
  "A#": 300,
  // La# - Violeta
  // Bemoles (equivalentes enarmónicos)
  "Db": 30,
  "Eb": 90,
  "Gb": 180,
  "Ab": 240,
  "Bb": 300
};
const MODE_MODIFIERS = {
  // Modos mayores - Cálidos y brillantes
  "major": {
    saturationDelta: 15,
    lightnessDelta: 10,
    hueDelta: 15,
    emotionalWeight: 0.8,
    description: "Alegre y brillante"
  },
  "ionian": {
    saturationDelta: 15,
    lightnessDelta: 10,
    hueDelta: 15,
    emotionalWeight: 0.8,
    description: "Alegre y brillante"
  },
  "lydian": {
    saturationDelta: 20,
    lightnessDelta: 15,
    hueDelta: 25,
    emotionalWeight: 0.7,
    description: "Etéreo y soñador"
  },
  "mixolydian": {
    saturationDelta: 10,
    lightnessDelta: 5,
    hueDelta: 10,
    emotionalWeight: 0.6,
    description: "Funky y cálido"
  },
  // Modos menores - Fríos y profundos
  "minor": {
    saturationDelta: -10,
    lightnessDelta: -15,
    hueDelta: -15,
    emotionalWeight: 0.7,
    description: "Triste y melancólico"
  },
  "aeolian": {
    saturationDelta: -10,
    lightnessDelta: -15,
    hueDelta: -15,
    emotionalWeight: 0.7,
    description: "Triste y melancólico"
  },
  "dorian": {
    saturationDelta: 5,
    lightnessDelta: 0,
    hueDelta: -5,
    emotionalWeight: 0.6,
    description: "Jazzy y sofisticado"
  },
  "phrygian": {
    saturationDelta: -5,
    lightnessDelta: -10,
    hueDelta: -20,
    emotionalWeight: 0.9,
    description: "Español y tenso"
  },
  "locrian": {
    saturationDelta: -15,
    lightnessDelta: -20,
    hueDelta: -30,
    emotionalWeight: 0.5,
    description: "Oscuro y disonante"
  },
  // Escalas especiales
  "harmonic_minor": {
    saturationDelta: -5,
    lightnessDelta: -10,
    hueDelta: -10,
    emotionalWeight: 0.8,
    description: "Dramático y exótico"
  },
  "melodic_minor": {
    saturationDelta: 0,
    lightnessDelta: -5,
    hueDelta: -5,
    emotionalWeight: 0.6,
    description: "Jazz avanzado"
  },
  "pentatonic_major": {
    saturationDelta: 10,
    lightnessDelta: 5,
    hueDelta: 10,
    emotionalWeight: 0.5,
    description: "Simple y folk"
  },
  "pentatonic_minor": {
    saturationDelta: 5,
    lightnessDelta: -5,
    hueDelta: 0,
    emotionalWeight: 0.5,
    description: "Blues y rock"
  },
  "blues": {
    saturationDelta: 5,
    lightnessDelta: -10,
    hueDelta: -10,
    emotionalWeight: 0.7,
    description: "Bluesy y soul"
  }
};
const SECTION_VARIATIONS = {
  "intro": {
    primaryLightnessShift: -20,
    secondaryLightnessShift: -15,
    accentIntensity: 0.3,
    ambientPresence: 0.7
  },
  "verse": {
    primaryLightnessShift: -10,
    secondaryLightnessShift: -5,
    accentIntensity: 0.5,
    ambientPresence: 0.5
  },
  "pre_chorus": {
    primaryLightnessShift: 0,
    secondaryLightnessShift: 5,
    accentIntensity: 0.7,
    ambientPresence: 0.4
  },
  "chorus": {
    primaryLightnessShift: 15,
    secondaryLightnessShift: 20,
    accentIntensity: 1,
    ambientPresence: 0.3
  },
  "drop": {
    primaryLightnessShift: 20,
    secondaryLightnessShift: 25,
    accentIntensity: 1,
    ambientPresence: 0.1
    // Casi sin ambiente, puro impacto
  },
  "buildup": {
    primaryLightnessShift: 5,
    secondaryLightnessShift: 10,
    accentIntensity: 0.8,
    ambientPresence: 0.3
  },
  "breakdown": {
    primaryLightnessShift: -15,
    secondaryLightnessShift: -10,
    accentIntensity: 0.4,
    ambientPresence: 0.6
  },
  "bridge": {
    primaryLightnessShift: -5,
    secondaryLightnessShift: 10,
    accentIntensity: 0.6,
    ambientPresence: 0.6
  },
  "outro": {
    primaryLightnessShift: -15,
    secondaryLightnessShift: -20,
    accentIntensity: 0.2,
    ambientPresence: 0.8
  },
  "unknown": {
    primaryLightnessShift: 0,
    secondaryLightnessShift: 0,
    accentIntensity: 0.5,
    ambientPresence: 0.5
  }
};
const DEFAULT_DNA = {
  key: "C",
  mode: "major",
  energy: 0.5,
  syncopation: 0.3,
  mood: "neutral",
  section: "unknown"
};
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function mapRange(value, inMin, inMax, outMin, outMax) {
  return (value - inMin) / (inMax - inMin) * (outMax - outMin) + outMin;
}
function normalizeHue(hue) {
  return (hue % 360 + 360) % 360;
}
function hslToRgb(hsl) {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p2, q2, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p2 + (q2 - p2) * 6 * t;
      if (t < 1 / 2) return q2;
      if (t < 2 / 3) return p2 + (q2 - p2) * (2 / 3 - t) * 6;
      return p2;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}
function hslToHex(hsl) {
  const rgb = hslToRgb(hsl);
  return `#${rgb.r.toString(16).padStart(2, "0")}${rgb.g.toString(16).padStart(2, "0")}${rgb.b.toString(16).padStart(2, "0")}`;
}
class ProceduralPaletteGenerator extends events.EventEmitter {
  constructor() {
    super();
    __publicField(this, "lastGeneratedPalette", null);
    __publicField(this, "generationCount", 0);
    console.log("🎨 [PALETTE-GENERATOR] Initialized - Selene can now paint music");
  }
  // ============================================================
  // MÉTODOS DE CONVERSIÓN KEY → HUE
  // ============================================================
  /**
   * Convierte una tonalidad musical a un ángulo HSL
   * Basado en el Círculo de Quintas Cromático
   */
  keyToHue(key) {
    if (!key) {
      return Date.now() % 36e3 / 100;
    }
    const normalizedKey = key.replace(/[0-9]/g, "").trim();
    return KEY_TO_HUE[normalizedKey] ?? 0;
  }
  /**
   * Obtiene los modificadores de modo
   */
  getModeModifier(mode) {
    const normalizedMode = mode.toLowerCase().replace(/[^a-z_]/g, "");
    return MODE_MODIFIERS[normalizedMode] ?? MODE_MODIFIERS["major"];
  }
  // ============================================================
  // ESTRATEGIA DE COLOR SECUNDARIO
  // ============================================================
  /**
   * Determina la estrategia de color secundario basada en la energía
   * 
   * - Baja energía → Análogos (suaves, armoniosos)
   * - Media energía → Triádicos (equilibrados)
   * - Alta energía → Complementarios (impactantes)
   */
  calculateColorStrategy(energy) {
    if (energy < 0.3) {
      return "analogous";
    } else if (energy < 0.6) {
      return "triadic";
    } else {
      return "complementary";
    }
  }
  /**
   * Calcula el hue del color secundario
   */
  calculateSecondaryHue(baseHue, energy, syncopation) {
    const strategy = this.calculateColorStrategy(energy);
    let separation;
    switch (strategy) {
      case "analogous":
        separation = 30;
        break;
      case "triadic":
        separation = 120;
        break;
      case "complementary":
        separation = 180;
        break;
    }
    const direction = syncopation > 0.5 ? 1 : -1;
    return normalizeHue(baseHue + separation * direction);
  }
  /**
   * Calcula la saturación del color secundario
   * Alta sincopación = más saturación (más "punch" visual)
   */
  calculateSecondarySaturation(baseSaturation, syncopation) {
    const saturationBoost = syncopation * 30;
    return clamp(baseSaturation + saturationBoost, 20, 100);
  }
  // ============================================================
  // GENERACIÓN DE PALETA PRINCIPAL
  // ============================================================
  /**
   * 🎨 GENERA UNA PALETA COMPLETA
   * 
   * Este es el método principal que convierte ADN musical en colores.
   * 
   * @param dna - ADN musical (key, mode, energy, syncopation, section)
   * @returns SelenePalette - Paleta de 5 colores + metadata
   */
  generatePalette(dna = {}) {
    const fullDNA = { ...DEFAULT_DNA, ...dna };
    const baseHue = this.keyToHue(fullDNA.key);
    const modeModifier = this.getModeModifier(fullDNA.mode);
    const colorStrategy = this.calculateColorStrategy(fullDNA.energy);
    const primaryHue = normalizeHue(baseHue + modeModifier.hueDelta);
    const primary = {
      h: primaryHue,
      s: clamp(70 + modeModifier.saturationDelta, 20, 100),
      l: clamp(50 + modeModifier.lightnessDelta, 20, 80)
    };
    const secondaryHue = this.calculateSecondaryHue(
      primary.h,
      fullDNA.energy,
      fullDNA.syncopation
    );
    const secondary = {
      h: secondaryHue,
      s: this.calculateSecondarySaturation(primary.s, fullDNA.syncopation),
      l: clamp(
        primary.l + (fullDNA.energy > 0.5 ? 10 : -10),
        20,
        85
      )
    };
    const accent = {
      h: normalizeHue(primary.h + 180),
      s: clamp(primary.s + 20, 20, 100),
      l: clamp(primary.l + 20, 20, 90)
    };
    const ambient = {
      h: primary.h,
      s: clamp(primary.s - 40, 10, 40),
      l: clamp(primary.l - 25, 10, 30)
    };
    const contrast = {
      h: normalizeHue(primary.h + 30),
      s: 30,
      l: 10
    };
    const transitionSpeed = Math.round(
      mapRange(fullDNA.energy, 0, 1, 2e3, 300)
    );
    const confidence = this.calculatePaletteConfidence(fullDNA);
    const description = this.generateDescription(fullDNA, modeModifier);
    const palette = {
      primary,
      secondary,
      accent,
      ambient,
      contrast,
      metadata: {
        generatedAt: Date.now(),
        musicalDNA: fullDNA,
        confidence,
        transitionSpeed,
        colorStrategy,
        description
      }
    };
    this.lastGeneratedPalette = palette;
    this.generationCount++;
    this.emit("palette-generated", palette);
    console.log(`🎨 [PALETTE] Generated: ${description} (confidence: ${(confidence * 100).toFixed(0)}%)`);
    return palette;
  }
  /**
   * Calcula la confianza de la paleta basada en el DNA
   */
  calculatePaletteConfidence(dna) {
    let confidence = 0.5;
    if (dna.key) {
      confidence += 0.2;
    }
    if (dna.mode !== "major" && dna.mode !== "unknown") {
      confidence += 0.1;
    }
    if (dna.section !== "unknown") {
      confidence += 0.1;
    }
    if (dna.energy < 0.2 || dna.energy > 0.8) {
      confidence += 0.1;
    }
    return clamp(confidence, 0, 1);
  }
  /**
   * Genera una descripción legible de la paleta
   */
  generateDescription(dna, modifier) {
    const keyName = dna.key || "Unknown";
    const modeName = dna.mode.charAt(0).toUpperCase() + dna.mode.slice(1);
    const energyDesc = dna.energy < 0.3 ? "Baja energía" : dna.energy < 0.6 ? "Energía media" : "Alta energía";
    return `${keyName} ${modeName} (${modifier.description}) - ${energyDesc}`;
  }
  // ============================================================
  // VARIACIONES POR SECCIÓN
  // ============================================================
  /**
   * Aplica variaciones de sección a una paleta existente
   * 
   * Esto permite variar la intensidad sin cambiar los colores base.
   */
  applySectionVariation(palette, section) {
    const variation = SECTION_VARIATIONS[section] ?? SECTION_VARIATIONS["unknown"];
    const variedPalette = {
      primary: {
        ...palette.primary,
        l: clamp(
          palette.primary.l + variation.primaryLightnessShift,
          10,
          95
        )
      },
      secondary: {
        ...palette.secondary,
        l: clamp(
          palette.secondary.l + variation.secondaryLightnessShift,
          10,
          95
        )
      },
      accent: {
        ...palette.accent,
        s: clamp(palette.accent.s * variation.accentIntensity, 10, 100)
      },
      ambient: {
        ...palette.ambient,
        l: clamp(palette.ambient.l * (1 + (variation.ambientPresence - 0.5)), 5, 40)
      },
      contrast: palette.contrast,
      // Contraste no varía
      metadata: {
        ...palette.metadata,
        musicalDNA: {
          ...palette.metadata.musicalDNA,
          section
        }
      }
    };
    this.emit("palette-variation", { section, palette: variedPalette });
    return variedPalette;
  }
  // ============================================================
  // MÉTODOS DE UTILIDAD
  // ============================================================
  /**
   * Obtiene la última paleta generada
   */
  getLastPalette() {
    return this.lastGeneratedPalette;
  }
  /**
   * Obtiene el número de paletas generadas
   */
  getGenerationCount() {
    return this.generationCount;
  }
  /**
   * Convierte toda la paleta a formato hex
   */
  paletteToHex(palette) {
    return {
      primary: hslToHex(palette.primary),
      secondary: hslToHex(palette.secondary),
      accent: hslToHex(palette.accent),
      ambient: hslToHex(palette.ambient),
      contrast: hslToHex(palette.contrast)
    };
  }
  /**
   * Convierte toda la paleta a formato RGB
   */
  paletteToRgb(palette) {
    return {
      primary: hslToRgb(palette.primary),
      secondary: hslToRgb(palette.secondary),
      accent: hslToRgb(palette.accent),
      ambient: hslToRgb(palette.ambient),
      contrast: hslToRgb(palette.contrast)
    };
  }
  /**
   * Reset del estado interno
   */
  reset() {
    this.lastGeneratedPalette = null;
    this.generationCount = 0;
    console.log("🎨 [PALETTE-GENERATOR] Reset");
  }
  /**
   * Obtiene estadísticas
   */
  getStats() {
    return {
      generationCount: this.generationCount,
      lastPaletteAge: this.lastGeneratedPalette ? Date.now() - this.lastGeneratedPalette.metadata.generatedAt : null,
      lastStrategy: this.lastGeneratedPalette ? this.lastGeneratedPalette.metadata.colorStrategy : null
    };
  }
}
const SECTION_TO_INTENSITY = {
  "intro": 80,
  "verse": 120,
  "pre_chorus": 160,
  "chorus": 220,
  "drop": 255,
  "buildup": 180,
  "breakdown": 100,
  "bridge": 140,
  "outro": 60,
  "unknown": 128
};
const MOOD_TO_MOVEMENT_SPEED = {
  "euphoric": 200,
  "aggressive": 220,
  "party": 180,
  "groovy": 150,
  "epic": 160,
  "chill": 60,
  "melancholic": 40,
  "intimate": 30,
  "neutral": 100
};
const MOOD_TO_MOVEMENT_TYPE = {
  "euphoric": "circle",
  "aggressive": "random",
  "party": "chase",
  "groovy": "figure_eight",
  "epic": "slow_pan",
  "chill": "static",
  "melancholic": "slow_tilt",
  "intimate": "static",
  "neutral": "slow_pan"
};
const FIXTURE_BASE_INTENSITY = {
  "par": 1,
  "moving_head": 0.9,
  "strobe": 0,
  // Solo en beats/drops
  "bar": 0.8,
  "wash": 0.7,
  "spot": 0.85,
  "blinder": 0,
  // Solo en momentos de impacto
  "laser": 0.6
};
const FIXTURE_TO_PALETTE_COLOR = {
  "par": "primary",
  "moving_head": "secondary",
  "strobe": "accent",
  "bar": "primary",
  "wash": "ambient",
  "spot": "secondary",
  "blinder": "accent",
  "laser": "contrast"
};
class MusicToLightMapper extends events.EventEmitter {
  constructor() {
    super();
    __publicField(this, "lastSuggestion", null);
    __publicField(this, "suggestionCount", 0);
    console.log("🌈 [LIGHT-MAPPER] Initialized - Ready to translate music to light");
  }
  // ============================================================
  // MÉTODO PRINCIPAL
  // ============================================================
  /**
   * 🌈 MAPEA MÚSICA A LUCES
   * 
   * Método principal que genera sugerencias de iluminación.
   * 
   * @param palette - Paleta de colores de Selene
   * @param context - Contexto musical actual
   * @returns LightingSuggestion - Parámetros para todos los fixtures
   */
  map(palette, context) {
    const suggestion = {
      timestamp: Date.now(),
      fixtures: this.generateAllFixtureParams(palette, context),
      mode: "intelligent",
      confidence: palette.metadata.confidence,
      description: this.generateDescription(palette, context)
    };
    this.lastSuggestion = suggestion;
    this.suggestionCount++;
    this.emit("suggestion", suggestion);
    return suggestion;
  }
  /**
   * ⚠️ MODO FALLBACK - REGLA 2
   * 
   * Mapeo reactivo cuando no hay suficiente confianza en el análisis.
   * Reacciona directamente al audio sin contexto musical.
   */
  mapFallback(audio) {
    const reactiveParams = this.generateReactiveParams(audio);
    const suggestion = {
      timestamp: Date.now(),
      fixtures: reactiveParams,
      mode: "reactive",
      confidence: 0.3,
      // Baja confianza en modo reactivo
      description: "Modo Reactivo - Bass→Pulso, Treble→Shimmer, Beat→Flash"
    };
    this.lastSuggestion = suggestion;
    this.suggestionCount++;
    this.emit("suggestion", suggestion);
    return suggestion;
  }
  // ============================================================
  // GENERACIÓN DE PARÁMETROS
  // ============================================================
  /**
   * Genera parámetros para todos los tipos de fixture
   */
  generateAllFixtureParams(palette, context) {
    const fixtureTypes = [
      "par",
      "moving_head",
      "strobe",
      "bar",
      "wash",
      "spot",
      "blinder",
      "laser"
    ];
    const result = {};
    for (const fixtureType of fixtureTypes) {
      result[fixtureType] = this.generateFixtureParams(fixtureType, palette, context);
    }
    return result;
  }
  /**
   * Genera parámetros para un tipo de fixture específico
   */
  generateFixtureParams(fixtureType, palette, context) {
    const paletteKey = FIXTURE_TO_PALETTE_COLOR[fixtureType];
    const hslColor = palette[paletteKey];
    const rgbColor = hslToRgb(hslColor);
    const sectionIntensity = SECTION_TO_INTENSITY[context.section] ?? 128;
    const fixtureMultiplier = FIXTURE_BASE_INTENSITY[fixtureType];
    const intensity = Math.round(sectionIntensity * fixtureMultiplier);
    const dimmer = Math.round(
      intensity * (0.5 + context.energy * 0.5)
    );
    let strobe = 0;
    if (fixtureType === "strobe" || fixtureType === "blinder") {
      if (context.section === "drop" || context.fillInProgress) {
        strobe = Math.round(150 + context.energy * 100);
      }
    }
    const movement = MOOD_TO_MOVEMENT_TYPE[context.mood] ?? "static";
    const movementSpeed = MOOD_TO_MOVEMENT_SPEED[context.mood] ?? 100;
    const goboSpeed = Math.round(50 + context.syncopation * 150);
    return {
      color: rgbColor,
      intensity,
      dimmer,
      strobe,
      goboSpeed,
      movement,
      movementSpeed: Math.round(movementSpeed * (0.7 + context.energy * 0.3))
    };
  }
  /**
   * Genera parámetros reactivos (modo fallback)
   * V17 Style: Bass→Pulso, Treble→Shimmer, Beat→Flash
   */
  generateReactiveParams(audio) {
    const bassColor = {
      r: Math.round(200 + audio.bass * 55),
      g: Math.round(50 * (1 - audio.bass)),
      b: Math.round(100 + audio.bass * 100)
    };
    const trebleColor = {
      r: Math.round(100 + audio.treble * 100),
      g: Math.round(150 + audio.treble * 105),
      b: Math.round(200 + audio.treble * 55)
    };
    const midColor = {
      r: Math.round(150 + audio.mid * 50),
      g: Math.round(100 + audio.mid * 100),
      b: Math.round(50 + audio.mid * 50)
    };
    const baseIntensity = Math.round(100 + audio.energy * 155);
    const beatStrobe = audio.beatDetected ? 200 : 0;
    return {
      "par": {
        color: bassColor,
        intensity: baseIntensity,
        dimmer: Math.round(baseIntensity * audio.bass),
        strobe: 0,
        goboSpeed: 0,
        movement: "static",
        movementSpeed: 0
      },
      "moving_head": {
        color: midColor,
        intensity: Math.round(baseIntensity * 0.9),
        dimmer: Math.round(baseIntensity * audio.mid),
        strobe: 0,
        goboSpeed: Math.round((audio.syncopation ?? 0.3) * 100),
        movement: audio.energy > 0.6 ? "chase" : "slow_pan",
        movementSpeed: Math.round(50 + audio.energy * 150)
      },
      "strobe": {
        color: { r: 255, g: 255, b: 255 },
        intensity: beatStrobe,
        dimmer: beatStrobe,
        strobe: audio.beatDetected ? 255 : 0,
        goboSpeed: 0,
        movement: "static",
        movementSpeed: 0
      },
      "bar": {
        color: trebleColor,
        intensity: Math.round(baseIntensity * 0.8),
        dimmer: Math.round(baseIntensity * audio.treble),
        strobe: 0,
        goboSpeed: 0,
        movement: "static",
        movementSpeed: 0
      },
      "wash": {
        color: bassColor,
        intensity: Math.round(baseIntensity * 0.6),
        dimmer: Math.round(baseIntensity * 0.5),
        strobe: 0,
        goboSpeed: 0,
        movement: "static",
        movementSpeed: 0
      },
      "spot": {
        color: midColor,
        intensity: Math.round(baseIntensity * 0.85),
        dimmer: Math.round(baseIntensity * audio.mid),
        strobe: 0,
        goboSpeed: Math.round((audio.syncopation ?? 0.3) * 80),
        movement: "sync_beat",
        movementSpeed: Math.round(100 + audio.energy * 100)
      },
      "blinder": {
        color: { r: 255, g: 255, b: 255 },
        intensity: audio.beatDetected && audio.energy > 0.8 ? 255 : 0,
        dimmer: audio.beatDetected && audio.energy > 0.8 ? 255 : 0,
        strobe: 0,
        goboSpeed: 0,
        movement: "static",
        movementSpeed: 0
      },
      "laser": {
        color: trebleColor,
        intensity: Math.round(baseIntensity * 0.6),
        dimmer: Math.round(baseIntensity * audio.treble * 0.6),
        strobe: 0,
        goboSpeed: Math.round(50 + audio.bpm / 2),
        movement: audio.energy > 0.5 ? "random" : "slow_pan",
        movementSpeed: Math.round(audio.bpm / 2)
      }
    };
  }
  // ============================================================
  // EFECTOS ESPECIALES
  // ============================================================
  /**
   * Genera efecto de beat (flash en el beat)
   */
  generateBeatEffect(palette, intensity = 1) {
    const accentRgb = hslToRgb(palette.accent);
    const params = {
      color: accentRgb,
      intensity: Math.round(255 * intensity),
      dimmer: Math.round(255 * intensity),
      strobe: 200,
      goboSpeed: 0,
      movement: "static",
      movementSpeed: 0
    };
    this.emit("beat-effect", { fixture: "strobe", params });
    return params;
  }
  /**
   * Genera efecto de drop (impacto máximo)
   */
  generateDropEffect(palette) {
    const accentRgb = hslToRgb(palette.accent);
    const secondaryRgb = hslToRgb(palette.secondary);
    const effects = {
      strobe: {
        color: { r: 255, g: 255, b: 255 },
        intensity: 255,
        dimmer: 255,
        strobe: 255,
        goboSpeed: 0,
        movement: "static",
        movementSpeed: 0
      },
      blinder: {
        color: accentRgb,
        intensity: 255,
        dimmer: 255,
        strobe: 0,
        goboSpeed: 0,
        movement: "static",
        movementSpeed: 0
      },
      moving_head: {
        color: secondaryRgb,
        intensity: 255,
        dimmer: 255,
        strobe: 0,
        goboSpeed: 255,
        movement: "chase",
        movementSpeed: 255
      }
    };
    this.emit("drop-effect", { fixtures: effects });
    return effects;
  }
  // ============================================================
  // UTILIDADES
  // ============================================================
  /**
   * Genera descripción legible de la sugerencia
   */
  generateDescription(palette, context) {
    return `${palette.metadata.description} | ${context.section} | ${context.mood}`;
  }
  /**
   * Obtiene la última sugerencia
   */
  getLastSuggestion() {
    return this.lastSuggestion;
  }
  /**
   * Obtiene el contador de sugerencias
   */
  getSuggestionCount() {
    return this.suggestionCount;
  }
  /**
   * Reset del estado
   */
  reset() {
    this.lastSuggestion = null;
    this.suggestionCount = 0;
    console.log("🌈 [LIGHT-MAPPER] Reset");
  }
  /**
   * Obtiene estadísticas
   */
  getStats() {
    var _a;
    return {
      suggestionCount: this.suggestionCount,
      lastSuggestionAge: this.lastSuggestion ? Date.now() - this.lastSuggestion.timestamp : null,
      lastMode: ((_a = this.lastSuggestion) == null ? void 0 : _a.mode) ?? null
    };
  }
}
class SeleneMusicalBrain extends events.EventEmitter {
  constructor(config = {}) {
    super();
    // Sub-sistemas
    __publicField(this, "contextEngine");
    __publicField(this, "memory");
    __publicField(this, "paletteGenerator");
    __publicField(this, "lightMapper");
    // Estado
    __publicField(this, "config");
    __publicField(this, "currentSessionId", null);
    __publicField(this, "isInitialized", false);
    __publicField(this, "frameCount", 0);
    __publicField(this, "lastOutput", null);
    // Estadísticas de sesión
    __publicField(this, "sessionStats", {
      framesProcessed: 0,
      palettesFromMemory: 0,
      palettesGenerated: 0,
      patternsLearned: 0,
      totalBeautyScore: 0,
      maxBeautyScore: 0,
      minBeautyScore: 1
    });
    // Cache para evitar re-consultas
    __publicField(this, "patternCache", /* @__PURE__ */ new Map());
    this.config = {
      memoryConfidenceThreshold: 0.6,
      learningThreshold: 0.7,
      minPatternUsage: 3,
      debug: false,
      autoLearn: true,
      dbPath: config.dbPath,
      ...config
    };
    this.contextEngine = new MusicalContextEngine();
    this.memory = getMemoryManager({ dbPath: this.config.dbPath });
    this.paletteGenerator = new ProceduralPaletteGenerator();
    this.lightMapper = new MusicToLightMapper();
    this.setupEventListeners();
  }
  /**
   * Configura listeners de eventos internos
   */
  setupEventListeners() {
    this.contextEngine.on("mode-change", (data) => {
      this.emit("mode-change", data);
      if (this.config.debug) {
        console.log(`[Brain] Mode change: ${data.from} → ${data.to}`);
      }
    });
    this.contextEngine.on("prediction", (prediction) => {
      this.emit("prediction", prediction);
    });
    this.contextEngine.on("section-change", (data) => {
      this.emit("section-change", data);
      this.patternCache.clear();
    });
    this.paletteGenerator.on("palette-generated", (data) => {
      this.emit("palette-generated", data);
    });
  }
  /**
   * Inicializa el cerebro
   */
  async initialize() {
    if (this.isInitialized) return;
    const startTime = Date.now();
    try {
      await this.memory.initialize();
      this.currentSessionId = this.memory.startSession("1.0.0");
      this.isInitialized = true;
      const elapsed = Date.now() - startTime;
      console.log(`[Brain] 🧠 Initialized in ${elapsed}ms. Session: ${this.currentSessionId}`);
      this.emit("initialized", { sessionId: this.currentSessionId, elapsed });
    } catch (error) {
      console.error("[Brain] ❌ Initialization failed:", error);
      throw error;
    }
  }
  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * 🎯 PROCESO PRINCIPAL - El latido del corazón de Selene
   * ═══════════════════════════════════════════════════════════════════════════
   */
  process(audio) {
    if (!this.isInitialized) {
      throw new Error("Brain not initialized. Call initialize() first.");
    }
    const startTime = performance.now();
    const timestamp = Date.now();
    this.frameCount++;
    const perfMetrics = {
      totalMs: 0,
      contextMs: 0,
      memoryMs: 0,
      paletteMs: 0,
      mappingMs: 0
    };
    const contextStart = performance.now();
    const contextResult = this.contextEngine.process(audio);
    perfMetrics.contextMs = performance.now() - contextStart;
    let output;
    if (contextResult.mode === "reactive") {
      output = this.processReactiveMode(
        contextResult,
        audio,
        timestamp,
        perfMetrics
      );
    } else {
      output = this.processIntelligentMode(
        contextResult,
        timestamp,
        perfMetrics
      );
    }
    perfMetrics.totalMs = performance.now() - startTime;
    output.performance = perfMetrics;
    this.updateSessionStats(output);
    this.lastOutput = output;
    this.emit("output", output);
    if (this.config.debug && this.frameCount % 30 === 0) {
      console.log(`[Brain] Frame ${this.frameCount}: ${output.mode} mode, source: ${output.paletteSource}, beauty: ${output.estimatedBeauty.toFixed(2)}, ${perfMetrics.totalMs.toFixed(1)}ms`);
    }
    return output;
  }
  /**
   * Procesa en modo reactivo (sin análisis musical completo)
   */
  processReactiveMode(_result, audio, timestamp, perf) {
    const mappingStart = performance.now();
    const audioFeatures = {
      bass: audio.spectrum.bass,
      mid: audio.spectrum.mid,
      treble: audio.spectrum.treble,
      energy: audio.energy.current,
      beatDetected: audio.beat.detected,
      bpm: audio.beat.bpm
    };
    const lighting = this.lightMapper.mapFallback(audioFeatures);
    perf.mappingMs = performance.now() - mappingStart;
    const energy = audio.energy.current;
    const palette = this.generateFallbackPalette(energy);
    return {
      timestamp,
      sessionId: this.currentSessionId,
      mode: "reactive",
      confidence: 0.3,
      // Baja confianza en modo reactivo
      palette: {
        ...palette,
        strategy: "reactive"
      },
      lighting,
      paletteSource: "fallback",
      estimatedBeauty: 0.5,
      // Neutral en modo reactivo
      performance: perf
    };
  }
  /**
   * Procesa en modo inteligente (con análisis completo + memoria)
   */
  processIntelligentMode(result, timestamp, perf) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q;
    const context = result.context;
    const memoryStart = performance.now();
    const pattern = this.consultMemory(context);
    perf.memoryMs = performance.now() - memoryStart;
    let palette;
    let paletteSource;
    let patternId;
    let estimatedBeauty;
    if (pattern && pattern.timesUsed >= this.config.minPatternUsage) {
      const paletteStart = performance.now();
      palette = this.applyLearnedPattern(pattern, context);
      perf.paletteMs = performance.now() - paletteStart;
      paletteSource = "memory";
      patternId = pattern.patternHash;
      estimatedBeauty = pattern.avgBeautyScore;
      this.sessionStats.palettesFromMemory++;
      if (this.config.debug) {
        console.log(`[Brain] 📚 Recalled pattern: ${patternId}, avgBeauty: ${estimatedBeauty.toFixed(2)}, used: ${pattern.timesUsed}x`);
      }
    } else {
      const paletteStart = performance.now();
      const modeScale = ((_b = (_a = context.harmony) == null ? void 0 : _a.mode) == null ? void 0 : _b.scale) ?? "major";
      const sectionType = ((_d = (_c = context.section) == null ? void 0 : _c.current) == null ? void 0 : _d.type) ?? "unknown";
      const syncopation = ((_f = (_e = context.rhythm) == null ? void 0 : _e.groove) == null ? void 0 : _f.syncopation) ?? 0.5;
      const musicalDNA = {
        key: ((_g = context.harmony) == null ? void 0 : _g.key) ?? null,
        mode: modeScale,
        energy: context.energy,
        syncopation,
        mood: context.mood,
        section: sectionType
      };
      const generatedPalette = this.paletteGenerator.generatePalette(musicalDNA);
      perf.paletteMs = performance.now() - paletteStart;
      palette = {
        primary: generatedPalette.primary,
        secondary: generatedPalette.secondary,
        accent: generatedPalette.accent,
        ambient: generatedPalette.ambient,
        contrast: generatedPalette.contrast,
        strategy: generatedPalette.metadata.colorStrategy
      };
      paletteSource = "procedural";
      estimatedBeauty = 0.6;
      this.sessionStats.palettesGenerated++;
    }
    const mappingStart = performance.now();
    const musicContext = {
      section: ((_i = (_h = context.section) == null ? void 0 : _h.current) == null ? void 0 : _i.type) ?? "unknown",
      mood: context.mood,
      energy: context.energy,
      syncopation: ((_k = (_j = context.rhythm) == null ? void 0 : _j.groove) == null ? void 0 : _k.syncopation) ?? 0.5,
      beatPhase: ((_l = context.rhythm) == null ? void 0 : _l.beatPhase) ?? 0,
      fillInProgress: ((_m = context.rhythm) == null ? void 0 : _m.fillInProgress) ?? false
    };
    const lighting = this.lightMapper.map(
      {
        primary: palette.primary,
        secondary: palette.secondary,
        accent: palette.accent,
        ambient: palette.ambient || palette.secondary,
        contrast: palette.contrast || palette.accent,
        metadata: {
          generatedAt: timestamp,
          musicalDNA: {
            key: ((_n = context.harmony) == null ? void 0 : _n.key) ?? null,
            mode: ((_p = (_o = context.harmony) == null ? void 0 : _o.mode) == null ? void 0 : _p.scale) ?? "major",
            energy: context.energy,
            syncopation: musicContext.syncopation,
            mood: context.mood,
            section: musicContext.section
          },
          confidence: context.confidence,
          transitionSpeed: 300,
          colorStrategy: palette.strategy,
          description: `Generated for ${((_q = context.genre) == null ? void 0 : _q.primary) ?? "unknown"} in ${musicContext.section}`
        }
      },
      musicContext
    );
    perf.mappingMs = performance.now() - mappingStart;
    const calculatedBeauty = this.calculateBeautyScore(palette, context);
    const finalBeauty = paletteSource === "memory" ? estimatedBeauty * 0.7 + calculatedBeauty * 0.3 : calculatedBeauty;
    if (this.config.autoLearn && paletteSource === "procedural" && finalBeauty >= this.config.learningThreshold) {
      this.learnFromSuccess(context, palette, finalBeauty);
    }
    return {
      timestamp,
      sessionId: this.currentSessionId,
      mode: "intelligent",
      confidence: context.confidence,
      palette,
      lighting,
      context,
      paletteSource,
      patternId,
      estimatedBeauty: finalBeauty,
      performance: perf
    };
  }
  /**
   * Consulta la memoria buscando un patrón exitoso para el contexto actual
   */
  consultMemory(context) {
    var _a, _b, _c, _d;
    const genre = (_a = context.genre) == null ? void 0 : _a.primary;
    if (!genre) return null;
    const key = ((_b = context.harmony) == null ? void 0 : _b.key) ?? void 0;
    const section = ((_d = (_c = context.section) == null ? void 0 : _c.current) == null ? void 0 : _d.type) ?? void 0;
    const cacheKey = `${genre}:${key ?? "*"}:${section ?? "*"}`;
    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey) ?? null;
    }
    const pattern = this.memory.getBestPattern(genre, key, section);
    this.patternCache.set(cacheKey, pattern);
    if (this.patternCache.size > 100) {
      const firstKey = this.patternCache.keys().next().value;
      if (firstKey) this.patternCache.delete(firstKey);
    }
    return pattern;
  }
  /**
   * Aplica un patrón aprendido para generar la paleta
   */
  applyLearnedPattern(pattern, context) {
    const baseHue = pattern.preferredHueBase ?? 210;
    const saturation = pattern.preferredSaturation ?? 0.8;
    const intensity = pattern.preferredIntensity ?? 0.7;
    const strategy = pattern.preferredStrategy ?? "triadic";
    const primary = {
      h: baseHue,
      s: saturation * 100,
      l: 50 + (intensity - 0.5) * 20
    };
    let secondaryHue;
    switch (strategy) {
      case "complementary":
        secondaryHue = (baseHue + 180) % 360;
        break;
      case "triadic":
        secondaryHue = (baseHue + 120) % 360;
        break;
      case "analogous":
        secondaryHue = (baseHue + 30) % 360;
        break;
      default:
        secondaryHue = (baseHue + 60) % 360;
    }
    const secondary = {
      h: secondaryHue,
      s: saturation * 90,
      l: 55
    };
    const accent = {
      h: (baseHue + (strategy === "complementary" ? 180 : 240)) % 360,
      s: saturation * 100,
      l: 45 + context.energy * 10
    };
    return {
      primary,
      secondary,
      accent,
      strategy
    };
  }
  /**
   * Aprende de un resultado exitoso
   */
  learnFromSuccess(context, palette, beautyScore) {
    var _a, _b, _c, _d, _e, _f;
    const genre = (_a = context.genre) == null ? void 0 : _a.primary;
    if (!genre) return;
    const key = ((_b = context.harmony) == null ? void 0 : _b.key) ?? void 0;
    const mode = (_d = (_c = context.harmony) == null ? void 0 : _c.mode) == null ? void 0 : _d.scale;
    const section = ((_f = (_e = context.section) == null ? void 0 : _e.current) == null ? void 0 : _f.type) ?? void 0;
    const hueBase = palette.primary.h;
    const saturation = palette.primary.s / 100;
    const intensity = (palette.primary.l - 30) / 40;
    this.memory.learnPattern(
      genre,
      key,
      mode,
      section,
      beautyScore,
      {
        strategy: palette.strategy,
        hueBase,
        saturation,
        intensity,
        movement: context.mood
      }
    );
    this.sessionStats.patternsLearned++;
    const cacheKey = `${genre}:${key ?? "*"}:${section ?? "*"}`;
    this.patternCache.delete(cacheKey);
    if (this.config.debug) {
      console.log(`[Brain] 📝 Learned pattern: ${genre}/${key}/${section}, beauty: ${beautyScore.toFixed(2)}`);
    }
    this.emit("pattern-learned", {
      genre,
      key,
      section,
      beautyScore,
      palette
    });
  }
  /**
   * Calcula un beauty score basado en armonía de colores y contexto
   */
  calculateBeautyScore(palette, context) {
    var _a;
    let score = 0.5;
    const hueDiff = Math.abs(palette.primary.h - palette.secondary.h);
    const normalizedDiff = Math.min(hueDiff, 360 - hueDiff) / 180;
    score += normalizedDiff * 0.15;
    const intensityMatch = 1 - Math.abs(
      context.energy - palette.primary.l / 100
    );
    score += intensityMatch * 0.15;
    const genreExpectsSaturated = ["reggaeton", "techno", "house", "edm"].includes(
      ((_a = context.genre) == null ? void 0 : _a.primary) ?? ""
    );
    const saturationMatch = genreExpectsSaturated ? palette.primary.s / 100 : 1 - palette.primary.s / 200;
    score += saturationMatch * 0.1;
    const hasAmbient = palette.ambient !== void 0;
    const hasContrast = palette.contrast !== void 0;
    score += (hasAmbient ? 0.05 : 0) + (hasContrast ? 0.05 : 0);
    return Math.max(0, Math.min(1, score));
  }
  /**
   * Genera paleta de fallback basada solo en energía
   */
  generateFallbackPalette(energy) {
    const hue = energy * 60;
    return {
      primary: { h: hue, s: 70 + energy * 20, l: 50 },
      secondary: { h: (hue + 180) % 360, s: 60, l: 50 },
      accent: { h: (hue + 60) % 360, s: 80, l: 45 }
    };
  }
  /**
   * Actualiza estadísticas de la sesión
   */
  updateSessionStats(output) {
    this.sessionStats.framesProcessed++;
    this.sessionStats.totalBeautyScore += output.estimatedBeauty;
    this.sessionStats.maxBeautyScore = Math.max(
      this.sessionStats.maxBeautyScore,
      output.estimatedBeauty
    );
    this.sessionStats.minBeautyScore = Math.min(
      this.sessionStats.minBeautyScore,
      output.estimatedBeauty
    );
  }
  /**
   * Registra feedback del usuario
   */
  recordFeedback(feedback) {
    if (!this.isInitialized) return;
    if (feedback.paletteId) {
      this.memory.recordUserFeedback(feedback.paletteId, feedback.rating);
    }
    if (feedback.patternHash) {
      this.memory.recordPatternFeedback(
        feedback.patternHash,
        feedback.rating > 0
      );
    }
    this.emit("feedback-recorded", feedback);
  }
  /**
   * Obtiene estadísticas de la sesión actual
   */
  getSessionStats() {
    const avgBeauty = this.sessionStats.framesProcessed > 0 ? this.sessionStats.totalBeautyScore / this.sessionStats.framesProcessed : 0;
    const memoryPercent = this.sessionStats.framesProcessed > 0 ? this.sessionStats.palettesFromMemory / this.sessionStats.framesProcessed * 100 : 0;
    return {
      ...this.sessionStats,
      avgBeautyScore: avgBeauty,
      memoryUsagePercent: memoryPercent
    };
  }
  /**
   * Obtiene estadísticas de la memoria
   */
  getMemoryStats() {
    return this.memory.getStats();
  }
  /**
   * Obtiene el último output
   */
  getLastOutput() {
    return this.lastOutput;
  }
  /**
   * Obtiene el modo actual
   */
  getCurrentMode() {
    return this.contextEngine.getMode();
  }
  /**
   * Actualiza configuración en runtime
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.emit("config-updated", this.config);
  }
  /**
   * Resetea el cerebro (útil para tests)
   */
  reset() {
    this.contextEngine.reset();
    this.patternCache.clear();
    this.frameCount = 0;
    this.lastOutput = null;
    this.sessionStats = {
      framesProcessed: 0,
      palettesFromMemory: 0,
      palettesGenerated: 0,
      patternsLearned: 0,
      totalBeautyScore: 0,
      maxBeautyScore: 0,
      minBeautyScore: 1
    };
    this.emit("reset");
  }
  /**
   * Cierra el cerebro y guarda estado
   */
  async shutdown() {
    if (!this.isInitialized) return;
    const stats = this.getSessionStats();
    this.memory.endSession({
      totalFrames: stats.framesProcessed,
      totalPalettes: stats.palettesFromMemory + stats.palettesGenerated,
      avgBeautyScore: stats.avgBeautyScore,
      maxBeautyScore: stats.maxBeautyScore,
      minBeautyScore: stats.minBeautyScore
    });
    this.memory.close();
    this.isInitialized = false;
    this.currentSessionId = null;
    console.log("[Brain] 🔒 Shutdown complete. Session stats:", stats);
    this.emit("shutdown", stats);
  }
  /**
   * Verifica si está inicializado
   */
  isReady() {
    return this.isInitialized;
  }
}
let brainInstance = null;
function getMusicalBrain(config) {
  if (!brainInstance) {
    brainInstance = new SeleneMusicalBrain(config);
  }
  return brainInstance;
}
class SeleneLux extends events.EventEmitter {
  constructor(config) {
    super();
    __publicField(this, "initialized", false);
    __publicField(this, "running", false);
    __publicField(this, "mode", "flow");
    // Legacy engines (para compatibilidad gradual)
    __publicField(this, "colorEngine");
    __publicField(this, "movementEngine");
    __publicField(this, "beatDetector");
    // 🧠 WAVE-8: El Cerebro Musical
    __publicField(this, "brain");
    __publicField(this, "useBrain", true);
    // Flag para activar/desactivar el Brain
    __publicField(this, "brainInitialized", false);
    __publicField(this, "currentPalette", "fuego");
    __publicField(this, "currentPattern", null);
    __publicField(this, "consciousness");
    __publicField(this, "lastColors", null);
    __publicField(this, "lastMovement", null);
    __publicField(this, "lastBeat", null);
    __publicField(this, "lastBrainOutput", null);
    __publicField(this, "frameCount", 0);
    __publicField(this, "decisionCount", 0);
    __publicField(this, "startTime", 0);
    this.colorEngine = new ColorEngine({
      transitionTime: config.visual.transitionTime,
      colorSmoothing: config.visual.colorSmoothing,
      movementSmoothing: config.visual.movementSmoothing
    });
    this.movementEngine = new MovementEngine({
      transitionTime: config.visual.transitionTime,
      colorSmoothing: config.visual.colorSmoothing,
      movementSmoothing: config.visual.movementSmoothing
    });
    this.beatDetector = new BeatDetector({
      sampleRate: 44100,
      fftSize: config.audio.fftSize,
      smoothingTimeConstant: config.audio.smoothing,
      minBpm: 60,
      maxBpm: 180
    });
    this.brain = getMusicalBrain(config.brain);
    this.setupBrainEventListeners();
    this.consciousness = {
      generation: 1,
      status: "awakening",
      totalExperiences: 0,
      totalPatternsDiscovered: 0,
      currentMood: "peaceful",
      lastInsight: "Selene Lux despertando...",
      beautyScore: 0.5,
      lineage: ["Genesis"]
    };
    this.initialized = true;
    this.running = true;
    this.startTime = Date.now();
    this.consciousness.status = "learning";
    console.info("[SeleneLux] Initialized (WAVE-8 Brain Active)");
    this.emit("ready");
  }
  /**
   * 🧠 Configura listeners de eventos del Brain
   */
  setupBrainEventListeners() {
    this.brain.on("output", (output) => {
      this.emit("brain-output", output);
    });
    this.brain.on("pattern-learned", (data) => {
      var _a;
      this.consciousness.totalPatternsDiscovered++;
      this.consciousness.lastInsight = `Aprendí un nuevo patrón: ${(_a = data.patternHash) == null ? void 0 : _a.slice(0, 8)}`;
      this.emit("pattern-learned", data);
    });
    this.brain.on("mode-change", (data) => {
      this.emit("brain-mode-change", data);
    });
    this.brain.on("section-change", (data) => {
      this.emit("section-change", data);
    });
  }
  /**
   * 🧠 Inicializa el Brain (debe llamarse antes de procesar)
   */
  async initializeBrain(_dbPath) {
    if (this.brainInitialized) return;
    await this.brain.initialize();
    this.brainInitialized = true;
    this.consciousness.status = "wise";
    this.consciousness.lastInsight = "Cerebro Musical conectado. Memoria activa.";
    console.info("[SeleneLux] 🧠 Brain initialized with memory");
    this.emit("brain-ready");
  }
  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * 🎯 PROCESO PRINCIPAL - Audio → Brain → Hardware
   * ═══════════════════════════════════════════════════════════════════════════
   */
  processAudioFrame(metrics, deltaTime) {
    this.frameCount++;
    this.emit("audio-frame", metrics);
    const beatState = this.beatDetector.process(metrics);
    this.lastBeat = beatState;
    if (this.useBrain && this.brainInitialized) {
      const audioAnalysis = this.convertToAudioAnalysis(metrics, beatState);
      const brainOutput = this.brain.process(audioAnalysis);
      this.lastBrainOutput = brainOutput;
      this.lastColors = this.brainOutputToColors(brainOutput);
      this.lastMovement = this.brainOutputToMovement(brainOutput, deltaTime);
      this.consciousness.beautyScore = brainOutput.estimatedBeauty;
      this.consciousness.totalExperiences++;
      if (brainOutput.mode === "intelligent" && brainOutput.paletteSource === "memory") {
        this.decisionCount++;
      }
    } else {
      const colors = this.colorEngine.generate(metrics, beatState, this.currentPattern);
      this.lastColors = colors;
      this.colorEngine.updateTransition(deltaTime);
      const movement = this.movementEngine.calculate(metrics, beatState, deltaTime);
      this.lastMovement = movement;
      if (beatState.onBeat) {
        this.consciousness.totalExperiences++;
      }
      this.decisionCount++;
    }
    return this.getState();
  }
  /**
   * 🔄 Convierte AudioMetrics a AudioAnalysis (formato del Brain)
   */
  convertToAudioAnalysis(metrics, beat) {
    return {
      timestamp: metrics.timestamp,
      spectrum: {
        bass: metrics.bass,
        lowMid: (metrics.bass + metrics.mid) / 2,
        mid: metrics.mid,
        highMid: (metrics.mid + metrics.treble) / 2,
        treble: metrics.treble
      },
      energy: {
        current: metrics.energy,
        average: metrics.energy,
        variance: Math.abs(metrics.energy - metrics.peak) * 0.5,
        trend: "stable",
        peakRecent: metrics.peak
      },
      beat: {
        detected: beat.onBeat,
        bpm: beat.bpm,
        confidence: beat.confidence,
        beatPhase: beat.phase,
        timeSinceLastBeat: Date.now() - beat.lastBeatTime
      },
      transients: {
        bass: beat.kickDetected ? 1 : 0,
        mid: beat.snareDetected ? 0.5 : 0,
        treble: beat.hihatDetected ? 0.3 : 0
      }
    };
  }
  /**
   * 🎨 Convierte BrainOutput a ColorOutput (para hardware)
   */
  brainOutputToColors(output) {
    const { palette, lighting } = output;
    const primaryRGB = this.hslToRgb(palette.primary);
    const secondaryRGB = this.hslToRgb(palette.secondary);
    const accentRGB = this.hslToRgb(palette.accent);
    const ambientRGB = palette.ambient ? this.hslToRgb(palette.ambient) : { r: 100, g: 100, b: 100 };
    const movingHeadParams = lighting.fixtures["moving_head"];
    const avgIntensity = movingHeadParams ? movingHeadParams.intensity / 255 : 0.5;
    return {
      primary: primaryRGB,
      secondary: secondaryRGB,
      accent: accentRGB,
      ambient: ambientRGB,
      intensity: avgIntensity,
      saturation: palette.primary.s / 100
      // Normalizar a 0-1
    };
  }
  /**
   * 🔄 Convierte HSL a RGB
   */
  hslToRgb(hsl) {
    const h = hsl.h / 360;
    const s = hsl.s / 100;
    const l = hsl.l / 100;
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p2, q2, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p2 + (q2 - p2) * 6 * t;
        if (t < 1 / 2) return q2;
        if (t < 2 / 3) return p2 + (q2 - p2) * (2 / 3 - t) * 6;
        return p2;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }
  /**
   * 🎯 Convierte BrainOutput a MovementOutput
   */
  brainOutputToMovement(output, _deltaTime) {
    const { lighting } = output;
    const movingHeadParams = lighting.fixtures["moving_head"];
    const movementTypeMap = {
      "circle": "circle",
      "figure_eight": "figure8",
      "random": "random",
      "sync_beat": "lissajous",
      "chase": "lissajous",
      "static": "lissajous",
      "slow_pan": "lissajous",
      "slow_tilt": "lissajous"
    };
    const movementType = (movingHeadParams == null ? void 0 : movingHeadParams.movement) || "static";
    const pattern = movementTypeMap[movementType] || "lissajous";
    const speed = (movingHeadParams == null ? void 0 : movingHeadParams.movementSpeed) ? movingHeadParams.movementSpeed / 255 : 0.5;
    return {
      pan: (movingHeadParams == null ? void 0 : movingHeadParams.pan) ? movingHeadParams.pan / 255 : 0.5,
      tilt: (movingHeadParams == null ? void 0 : movingHeadParams.tilt) ? movingHeadParams.tilt / 255 : 0.5,
      speed,
      pattern
    };
  }
  /**
   * 🎛️ Activa/desactiva el uso del Brain
   */
  setUseBrain(enabled) {
    this.useBrain = enabled;
    console.info(`[SeleneLux] Brain ${enabled ? "ENABLED" : "DISABLED"}`);
    this.emit("brain-toggle", enabled);
  }
  /**
   * 📊 Obtiene estadísticas del Brain
   */
  getBrainStats() {
    if (!this.brainInitialized) return null;
    return {
      session: this.brain.getSessionStats(),
      memory: this.brain.getMemoryStats()
    };
  }
  setPalette(palette) {
    this.currentPalette = palette;
    this.colorEngine.setPalette(palette);
    console.info(`[SeleneLux] Palette changed to: ${palette}`);
  }
  setMovementPattern(pattern) {
    this.movementEngine.setPattern(pattern);
    console.info(`[SeleneLux] Movement pattern changed to: ${pattern}`);
  }
  setMode(mode) {
    this.mode = mode;
    console.info(`[SeleneLux] Mode changed to: ${mode}`);
  }
  getState() {
    var _a, _b;
    const defaultBeat = {
      bpm: 120,
      confidence: 0,
      phase: 0,
      onBeat: false,
      beatCount: 0,
      lastBeatTime: 0,
      kickDetected: false,
      snareDetected: false,
      hihatDetected: false
    };
    return {
      mode: this.mode,
      palette: this.currentPalette,
      colors: this.lastColors || {
        primary: { r: 255, g: 0, b: 0 },
        secondary: { r: 200, g: 50, b: 0 },
        accent: { r: 255, g: 100, b: 0 },
        ambient: { r: 150, g: 0, b: 50 },
        intensity: 0.5,
        saturation: 0.9
      },
      movement: this.lastMovement || {
        pan: 0.5,
        tilt: 0.5,
        speed: 0.5,
        pattern: "lissajous"
      },
      beat: this.lastBeat || defaultBeat,
      consciousness: { ...this.consciousness },
      stats: {
        frames: this.frameCount,
        decisions: this.decisionCount,
        uptime: Date.now() - this.startTime
      },
      // 🧠 WAVE-8: Estado del Brain
      brainOutput: this.lastBrainOutput,
      brainMode: (_a = this.lastBrainOutput) == null ? void 0 : _a.mode,
      paletteSource: ((_b = this.lastBrainOutput) == null ? void 0 : _b.paletteSource) || "legacy"
    };
  }
  tickMovement(audioData, deltaTime, fixtureIds) {
    return this.movementEngine.tick(audioData, deltaTime, fixtureIds);
  }
  isInitialized() {
    return this.initialized;
  }
  isRunning() {
    return this.running;
  }
  start() {
    this.running = true;
    console.info("[SeleneLux] Started");
  }
  stop() {
    this.running = false;
    console.info("[SeleneLux] Stopped");
  }
  /**
   * 🔒 Cierra limpiamente Selene (incluyendo el Brain)
   */
  async shutdown() {
    this.running = false;
    if (this.brainInitialized) {
      await this.brain.shutdown();
      this.brainInitialized = false;
      console.info("[SeleneLux] 🧠 Brain shutdown complete");
    }
    console.info("[SeleneLux] Shutdown complete");
    this.emit("shutdown");
  }
}
let mainWindow = null;
let selene = null;
let mainLoopInterval = null;
let lastFrameTime = Date.now();
const isDev = process.env.NODE_ENV === "development" || !electron.app.isPackaged;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 720,
    backgroundColor: "#0a0a0f",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0a0a0f",
      symbolColor: "#7C4DFF",
      height: 40
    },
    webPreferences: {
      preload: path$1.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      // WAVE 9.6.2: Permisos para audio del sistema
      backgroundThrottling: false
    },
    icon: path$1.join(__dirname, "../public/icon.png"),
    show: false
  });
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ["media", "mediaKeySystem", "audioCapture", "display-capture"];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow == null ? void 0 : mainWindow.show();
    if (isDev) {
      mainWindow == null ? void 0 : mainWindow.webContents.openDevTools();
    }
  });
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path$1.join(__dirname, "../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
electron.app.whenReady().then(() => {
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.ipcMain.handle("app:getVersion", () => {
  return electron.app.getVersion();
});
electron.ipcMain.handle("dmx:getStatus", () => {
  return { connected: false, interface: "none" };
});
electron.ipcMain.handle("audio:getDevices", async () => {
  return [];
});
electron.ipcMain.handle("audio:getDesktopSources", async () => {
  try {
    const sources = await electron.desktopCapturer.getSources({
      types: ["window", "screen"],
      thumbnailSize: { width: 0, height: 0 }
    });
    console.log("[Main] Desktop sources found:", sources.length);
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      displayId: s.display_id
    }));
  } catch (err) {
    console.error("[Main] Failed to get desktop sources:", err);
    return [];
  }
});
function initSelene() {
  selene = new SeleneLux({
    audio: {
      device: "default",
      sensitivity: 0.7,
      noiseGate: 0.05,
      fftSize: 2048,
      smoothing: 0.8
    },
    visual: {
      transitionTime: 300,
      colorSmoothing: 0.85,
      movementSmoothing: 0.8,
      effectIntensity: 1
    },
    dmx: {
      universe: 1,
      driver: "virtual",
      frameRate: 40
    }
  });
  console.log("Selene LUX initialized");
}
let currentAudioData = {
  bass: 0.3,
  mid: 0.3,
  treble: 0.3,
  energy: 0.3,
  bpm: 120,
  onBeat: false
};
function startMainLoop() {
  if (mainLoopInterval) return;
  let frameIndex = 0;
  mainLoopInterval = setInterval(() => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
    if (!selene || !mainWindow) return;
    const now = Date.now();
    const deltaTime = now - lastFrameTime;
    lastFrameTime = now;
    const useRealAudio = currentAudioData.energy > 0.05;
    const audioInput = useRealAudio ? currentAudioData : {
      bass: 0.3 + Math.sin(now * 2e-3) * 0.1,
      mid: 0.3 + Math.sin(now * 3e-3) * 0.1,
      treble: 0.3 + Math.sin(now * 5e-3) * 0.1,
      energy: 0.3 + Math.sin(now * 1e-3) * 0.1,
      bpm: 120,
      onBeat: Math.sin(now * 8e-3) > 0.95
    };
    frameIndex++;
    const state = selene.processAudioFrame({
      bass: audioInput.bass,
      mid: audioInput.mid,
      treble: audioInput.treble,
      energy: audioInput.energy,
      bpm: audioInput.bpm,
      beatPhase: now % (6e4 / audioInput.bpm) / (6e4 / audioInput.bpm),
      beatConfidence: useRealAudio ? 0.8 : 0.5,
      onBeat: audioInput.onBeat,
      peak: audioInput.energy * 1.2,
      timestamp: now,
      frameIndex
    }, deltaTime);
    if (Math.random() < 0.033) {
      const c = state.colors;
      console.log(
        "[DMX] 🎨 RGB:",
        c.primary.r.toFixed(0),
        c.primary.g.toFixed(0),
        c.primary.b.toFixed(0),
        "| 🎯 Pos:",
        ((_b = (_a = state.movement) == null ? void 0 : _a.pan) == null ? void 0 : _b.toFixed(2)) || 0,
        ((_d = (_c = state.movement) == null ? void 0 : _c.tilt) == null ? void 0 : _d.toFixed(2)) || 0,
        "| 🥁 Beat:",
        ((_e = state.beat) == null ? void 0 : _e.onBeat) ? "HIT" : "---",
        "| 🎵 Audio:",
        useRealAudio ? "LIVE" : "SIM",
        "| 🧠 Mode:",
        state.brainMode || "legacy"
      );
    }
    const uiState = {
      colors: state.colors ? {
        primary: state.colors.primary,
        secondary: state.colors.secondary,
        accent: state.colors.accent
      } : void 0,
      movement: state.movement ? {
        pan: state.movement.pan,
        tilt: state.movement.tilt,
        pattern: state.movement.pattern,
        speed: state.movement.speed
      } : void 0,
      beat: state.beat ? {
        bpm: state.beat.bpm,
        onBeat: state.beat.onBeat,
        beatPhase: state.beat.phase,
        confidence: state.beat.confidence
      } : void 0,
      brain: {
        mode: state.brainMode || "reactive",
        confidence: ((_f = state.brainOutput) == null ? void 0 : _f.confidence) || 0.5,
        beautyScore: ((_g = state.consciousness) == null ? void 0 : _g.beautyScore) || 0.5,
        energy: audioInput.energy,
        mood: ((_i = (_h = state.brainOutput) == null ? void 0 : _h.context) == null ? void 0 : _i.mood) || "neutral",
        section: ((_m = (_l = (_k = (_j = state.brainOutput) == null ? void 0 : _j.context) == null ? void 0 : _k.section) == null ? void 0 : _l.current) == null ? void 0 : _m.type) || "unknown"
      },
      palette: {
        name: String(state.palette),
        source: state.paletteSource || "legacy"
      },
      frameId: ((_n = state.stats) == null ? void 0 : _n.frames) || frameIndex,
      timestamp: now
    };
    mainWindow.webContents.send("lux:state-update", uiState);
  }, 30);
  console.log("Selene main loop started (30ms) - DMX output active");
}
function stopMainLoop() {
  if (mainLoopInterval) {
    clearInterval(mainLoopInterval);
    mainLoopInterval = null;
  }
}
electron.ipcMain.handle("lux:set-palette", (_event, palette) => {
  if (!selene) return { success: false, error: "Selene not initialized" };
  selene.setPalette(palette);
  return { success: true, palette };
});
electron.ipcMain.handle("lux:set-movement", (_event, config) => {
  if (!selene) return { success: false, error: "Selene not initialized" };
  if (config.pattern) {
    selene.setMovementPattern(config.pattern);
  }
  console.log("[Main] 🎯 Movement config:", config);
  return { success: true, config };
});
electron.ipcMain.handle("lux:get-state", () => {
  if (!selene) return null;
  return selene.getState();
});
electron.ipcMain.handle("lux:start", () => {
  initSelene();
  startMainLoop();
  return { success: true };
});
electron.ipcMain.handle("lux:stop", () => {
  stopMainLoop();
  selene = null;
  return { success: true };
});
electron.ipcMain.handle("lux:audio-frame", (_event, audioData) => {
  currentAudioData = {
    bass: audioData.bass,
    mid: audioData.mid,
    treble: audioData.treble,
    energy: audioData.energy,
    bpm: audioData.bpm || 120,
    onBeat: audioData.bass > 0.7
    // High bass = beat hit
  };
  return { success: true };
});
let fixtureLibrary = [];
let patchedFixtures = [];
function parseFXTFile(filePath) {
  var _a;
  try {
    const content = fs$1.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/);
    const manufacturer = ((_a = lines[0]) == null ? void 0 : _a.trim()) || "Unknown";
    let name = path$1.basename(filePath, ".fxt");
    let channelCount = 0;
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const line = lines[i].trim();
      if (/^\d+$/.test(line) && parseInt(line) > 0 && parseInt(line) <= 512) {
        channelCount = parseInt(line);
      }
      if (line.length > 3 && !line.includes('"') && !line.includes(".") && !line.includes("\\")) {
        if (i > 2 && i < 10) {
          name = line;
        }
      }
    }
    const nameLower = name.toLowerCase();
    let type = "generic";
    if (nameLower.includes("moving") || nameLower.includes("beam") || nameLower.includes("spot")) {
      type = "moving_head";
    } else if (nameLower.includes("par") || nameLower.includes("led")) {
      type = "par";
    } else if (nameLower.includes("strobe")) {
      type = "strobe";
    } else if (nameLower.includes("wash")) {
      type = "wash";
    }
    const normalizedPath = filePath.replace(/\\/g, "/").toLowerCase();
    const id = Buffer.from(normalizedPath).toString("base64").replace(/[+/=]/g, "_").slice(0, 32);
    return {
      id,
      name,
      manufacturer,
      channelCount: channelCount || 1,
      type,
      filePath
    };
  } catch (err) {
    console.error(`Error parsing ${filePath}:`, err);
    return null;
  }
}
electron.ipcMain.handle("lux:scan-fixtures", async (_event, customPath) => {
  try {
    const defaultPaths = [
      path$1.join(electron.app.getPath("userData"), "fixtures"),
      path$1.join(__dirname, "../../fixtures"),
      path$1.join(__dirname, "../../../fixtures"),
      path$1.join(__dirname, "../../librerias"),
      path$1.join(__dirname, "../../../librerias")
    ];
    const searchPaths = customPath ? [customPath, ...defaultPaths] : defaultPaths;
    const foundFixtures = [];
    const seenFilenames = /* @__PURE__ */ new Set();
    for (const searchPath of searchPaths) {
      if (!fs$1.existsSync(searchPath)) continue;
      const files = fs$1.readdirSync(searchPath);
      for (const file of files) {
        if (file.toLowerCase().endsWith(".fxt")) {
          const filenameKey = file.toLowerCase();
          if (seenFilenames.has(filenameKey)) continue;
          seenFilenames.add(filenameKey);
          const fullPath = path$1.join(searchPath, file);
          const fixture = parseFXTFile(fullPath);
          if (fixture) {
            foundFixtures.push(fixture);
          }
        }
      }
    }
    fixtureLibrary = foundFixtures;
    console.log(`[Fixtures] 📦 Found ${foundFixtures.length} fixtures`);
    return {
      success: true,
      fixtures: foundFixtures,
      searchPaths: searchPaths.filter((p) => fs$1.existsSync(p))
    };
  } catch (err) {
    console.error("[Fixtures] Scan error:", err);
    return { success: false, error: String(err), fixtures: [] };
  }
});
electron.ipcMain.handle("lux:get-fixture-library", () => {
  return { success: true, fixtures: fixtureLibrary };
});
electron.ipcMain.handle("lux:get-patched-fixtures", () => {
  return { success: true, fixtures: patchedFixtures };
});
electron.ipcMain.handle("lux:patch-fixture", (_event, data) => {
  const libraryFixture = fixtureLibrary.find((f) => f.id === data.fixtureId);
  if (!libraryFixture) {
    return { success: false, error: "Fixture not found in library" };
  }
  const patched = {
    ...libraryFixture,
    dmxAddress: data.dmxAddress,
    universe: data.universe || 1
  };
  patchedFixtures.push(patched);
  console.log(`[Fixtures] ✅ Patched ${libraryFixture.name} at DMX ${data.dmxAddress}`);
  return { success: true, fixture: patched, totalPatched: patchedFixtures.length };
});
electron.ipcMain.handle("lux:unpatch-fixture", (_event, dmxAddress) => {
  const index = patchedFixtures.findIndex((f) => f.dmxAddress === dmxAddress);
  if (index === -1) {
    return { success: false, error: "Fixture not found at that address" };
  }
  const removed = patchedFixtures.splice(index, 1)[0];
  console.log(`[Fixtures] 🗑️ Unpatched ${removed.name} from DMX ${dmxAddress}`);
  return { success: true, removed, totalPatched: patchedFixtures.length };
});
electron.ipcMain.handle("lux:clear-patch", () => {
  const count = patchedFixtures.length;
  patchedFixtures = [];
  console.log(`[Fixtures] 🧹 Cleared ${count} fixtures from patch`);
  return { success: true, cleared: count };
});
const CONFIG_FILE = path$1.join(electron.app.getPath("userData"), "luxsync-config.json");
function getDefaultConfig() {
  return {
    audio: {
      source: "simulation",
      sensitivity: 50
    },
    dmx: {
      driver: "enttec-open",
      port: "COM3",
      universe: 1,
      frameRate: 44
    },
    fixtures: [],
    ui: {
      theme: "dark",
      showAdvanced: false
    }
  };
}
function loadConfig() {
  try {
    if (fs$1.existsSync(CONFIG_FILE)) {
      const data = fs$1.readFileSync(CONFIG_FILE, "utf-8");
      const config = JSON.parse(data);
      patchedFixtures = config.fixtures || [];
      return config;
    }
  } catch (err) {
    console.error("[Config] Error loading config:", err);
  }
  return getDefaultConfig();
}
function saveConfig(config) {
  try {
    const currentConfig = loadConfig();
    const newConfig = { ...currentConfig, ...config, fixtures: patchedFixtures };
    fs$1.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
    console.log("[Config] 💾 Config saved");
    return true;
  } catch (err) {
    console.error("[Config] Error saving config:", err);
    return false;
  }
}
electron.ipcMain.handle("lux:get-config", () => {
  return { success: true, config: loadConfig() };
});
electron.ipcMain.handle("lux:save-config", (_event, config) => {
  const success = saveConfig(config);
  return { success };
});
electron.ipcMain.handle("lux:reset-config", () => {
  try {
    if (fs$1.existsSync(CONFIG_FILE)) {
      fs$1.unlinkSync(CONFIG_FILE);
    }
    patchedFixtures = [];
    return { success: true, config: getDefaultConfig() };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});
loadConfig();
console.log("LuxSync Main Process Started");
