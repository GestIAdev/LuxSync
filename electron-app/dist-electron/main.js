"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const electron = require("electron");
const path = require("path");
const events = require("events");
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
class SeleneLux extends events.EventEmitter {
  constructor(config) {
    super();
    __publicField(this, "initialized", false);
    __publicField(this, "running", false);
    __publicField(this, "mode", "flow");
    __publicField(this, "colorEngine");
    __publicField(this, "movementEngine");
    __publicField(this, "beatDetector");
    __publicField(this, "currentPalette", "fuego");
    __publicField(this, "currentPattern", null);
    __publicField(this, "consciousness");
    __publicField(this, "lastColors", null);
    __publicField(this, "lastMovement", null);
    __publicField(this, "lastBeat", null);
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
    console.info("[SeleneLux] Initialized");
    this.emit("ready");
  }
  processAudioFrame(metrics, deltaTime) {
    this.frameCount++;
    this.emit("audio-frame", metrics);
    const beatState = this.beatDetector.process(metrics);
    this.lastBeat = beatState;
    const colors = this.colorEngine.generate(metrics, beatState, this.currentPattern);
    this.lastColors = colors;
    this.colorEngine.updateTransition(deltaTime);
    const movement = this.movementEngine.calculate(metrics, beatState, deltaTime);
    this.lastMovement = movement;
    if (beatState.onBeat) {
      this.consciousness.totalExperiences++;
    }
    this.decisionCount++;
    return this.getState();
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
      }
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
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, "../public/icon.png"),
    show: false
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
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
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
    var _a, _b, _c, _d, _e;
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
        useRealAudio ? "LIVE" : "SIM"
      );
    }
    mainWindow.webContents.send("lux:update-state", state);
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
electron.ipcMain.handle("lux:set-movement", (_event, pattern) => {
  if (!selene) return { success: false, error: "Selene not initialized" };
  selene.setMovementPattern(pattern);
  return { success: true, pattern };
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
console.log("LuxSync Main Process Started");
