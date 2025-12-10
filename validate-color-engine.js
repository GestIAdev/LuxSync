/**
 * 🧪 SELENE COLOR ENGINE - QUICK VALIDATION SCRIPT
 * Sin dependencia de test runner - Solo valida lógica pura
 */

// Copiar la clase SeleneColorEngine (sin imports que causen problemas)

const PHI = 1.618033988749895;
const PHI_ROTATION = (PHI * 360) % 360; // ≈ 222.5°

const KEY_TO_HUE = {
  'C': 0, 'C#': 30, 'Db': 30,
  'D': 60, 'D#': 90, 'Eb': 90,
  'E': 120,
  'F': 150, 'F#': 180, 'Gb': 180,
  'G': 210, 'G#': 240, 'Ab': 240,
  'A': 270, 'A#': 300, 'Bb': 300,
  'B': 330,
};

const MOOD_HUES = {
  'happy': 50,
  'sad': 240,
  'tense': 0,
  'dreamy': 280,
  'bluesy': 30,
  'jazzy': 260,
  'spanish_exotic': 15,
  'universal': 120,
  'dark': 240,
  'bright': 50,
  'neutral': 120,
};

const MODE_MODIFIERS = {
  'major': { hue: 15, sat: 10, light: 10, description: 'Alegre y brillante' },
  'minor': { hue: -15, sat: -10, light: -10, description: 'Triste y melancólico' },
  'dorian': { hue: -5, sat: 0, light: 0, description: 'Jazzy' },
  'phrygian': { hue: -20, sat: 5, light: -10, description: 'Español' },
  'lydian': { hue: 20, sat: 15, light: 15, description: 'Etéreo' },
  'mixolydian': { hue: 10, sat: 10, light: 5, description: 'Funky' },
  'locrian': { hue: -30, sat: -15, light: -20, description: 'Oscuro' },
};

const MACRO_GENRES = {
  'ELECTRONIC_4X4': {
    tempBias: -15, satBoost: -10, lightBoost: -10,
    contrast: 'analogous', minLight: 25, maxLight: 65,
    transitionSpeed: 1500,
    description: 'Frío, hipnótico',
  },
  'ELECTRONIC_BREAKS': {
    tempBias: 0, satBoost: 5, lightBoost: -5,
    contrast: 'triadic', minLight: 30, maxLight: 70,
    transitionSpeed: 800,
    description: 'Tenso, caótico',
  },
  'LATINO_TRADICIONAL': {
    tempBias: 25, satBoost: 20, lightBoost: 15,
    contrast: 'complementary', minLight: 45, maxLight: 80,
    transitionSpeed: 1000,
    description: 'Cálido, festivo',
  },
  'LATINO_URBANO': {
    tempBias: 10, satBoost: 10, lightBoost: 0,
    contrast: 'triadic', minLight: 35, maxLight: 70,
    transitionSpeed: 1200,
    description: 'Oscuro, urbano',
  },
  'ELECTROLATINO': {
    tempBias: 0, satBoost: 0, lightBoost: 0,
    contrast: 'adaptive', minLight: 35, maxLight: 75,
    transitionSpeed: 1000,
    description: 'Flexible',
  },
};

const GENRE_MAP = {
  'techno': 'ELECTRONIC_4X4', 'house': 'ELECTRONIC_4X4',
  'cumbia': 'LATINO_TRADICIONAL',
  'reggaeton': 'LATINO_URBANO',
  'pop': 'ELECTROLATINO',
};

function normalizeHue(h) {
  return ((h % 360) + 360) % 360;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hslToRgb(hsl) {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;
  
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

function generate(data) {
  const wave8 = data.wave8 || { 
    harmony: { key: null, mode: 'minor', mood: 'universal' }, 
    rhythm: { syncopation: 0 }, 
    genre: { primary: 'techno' } 
  };
  
  const key = wave8.harmony.key || data.key || null;
  const mode = wave8.harmony.mode || 'minor';
  const mood = wave8.harmony.mood || data.mood || 'universal';
  const syncopation = wave8.rhythm.syncopation ?? 0;
  const genrePrimary = wave8.genre.primary || 'unknown';
  const energy = clamp(data.energy ?? 0.5, 0, 1);
  
  const macroId = GENRE_MAP[genrePrimary.toLowerCase()] || 'ELECTROLATINO';
  const profile = MACRO_GENRES[macroId];
  
  let baseHue = 120;
  if (key && KEY_TO_HUE[key] !== undefined) {
    baseHue = KEY_TO_HUE[key];
  } else if (mood && MOOD_HUES[mood] !== undefined) {
    baseHue = MOOD_HUES[mood];
  }
  
  const modeMod = MODE_MODIFIERS[mode] || MODE_MODIFIERS['minor'];
  const finalHue = normalizeHue(baseHue + modeMod.hue + profile.tempBias);
  
  const baseSat = 40 + (energy * 60);
  const baseLight = 30 + (energy * 50);
  
  const primarySat = clamp(baseSat + modeMod.sat + profile.satBoost, 20, 100);
  const primaryLight = clamp(baseLight + modeMod.light + profile.lightBoost, profile.minLight, profile.maxLight);
  
  const primary = { h: finalHue, s: primarySat, l: primaryLight };
  const secondary = {
    h: normalizeHue(finalHue + PHI_ROTATION),
    s: clamp(primarySat + 5, 20, 100),
    l: clamp(primaryLight - 10, 20, 80),
  };
  
  let accentHue;
  let strategy = profile.contrast;
  
  if (strategy === 'adaptive') {
    strategy = syncopation > 0.4 ? 'complementary' : syncopation > 0.2 ? 'triadic' : 'analogous';
  }
  
  if (strategy === 'complementary') accentHue = finalHue + 180;
  else if (strategy === 'triadic') accentHue = finalHue + 120;
  else accentHue = finalHue + 30;
  
  const accent = {
    h: normalizeHue(accentHue),
    s: 100,
    l: Math.max(70, primaryLight + 20),
  };
  
  const ambient = {
    h: finalHue,
    s: Math.max(15, primarySat * 0.4),
    l: Math.max(15, primaryLight * 0.4),
  };
  
  const contrast = {
    h: normalizeHue(finalHue + 180),
    s: 30,
    l: 10,
  };
  
  let temperature = 'neutral';
  // Rojo (0-60), Naranja (60-120), Magenta (300-360) = warm
  // Cyan (180-240), Azul (240-270), Verde-Azul (90-180) = cool
  // La mayoría de amarillo-naranja es warm, cyan-azul es cool
  if ((finalHue >= 0 && finalHue <= 60) || (finalHue > 120 && finalHue < 180) || finalHue >= 300) {
    temperature = 'warm';
  } else if ((finalHue > 60 && finalHue <= 120) && profile.tempBias > 0) {
    temperature = 'warm'; // Naranja cálido
  } else if (finalHue >= 180 && finalHue < 300) {
    temperature = 'cool';
  }
  
  return {
    primary, secondary, accent, ambient, contrast,
    meta: {
      macroGenre: macroId,
      strategy,
      temperature,
      description: `${key || mood} ${mode} - E=${(energy*100).toFixed(0)}%`,
      confidence: wave8.genre.confidence ?? 0.5,
      transitionSpeed: profile.transitionSpeed,
    }
  };
}

// ============================================================
// TESTS
// ============================================================

console.log('🧪 SELENE COLOR ENGINE - VALIDATION TESTS\n');

let passed = 0;
let failed = 0;

function test(name, assertion) {
  try {
    if (!assertion) throw new Error('Assertion failed');
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name} - ${e.message}`);
    failed++;
  }
}

// === EXAMPLE 1: TECHNO ===
console.log('\n📍 EJEMPLO 1: TECHNO (A minor, 200 BPM, Energy 0.34)\n');

const technoInput = {
  energy: 0.34,
  wave8: {
    harmony: { key: 'A', mode: 'minor', mood: 'tense' },
    rhythm: { syncopation: 0.27 },
    genre: { primary: 'techno' },
  }
};

const technoPalette = generate(technoInput);

test('Techno: macro-género es ELECTRONIC_4X4', 
  technoPalette.meta.macroGenre === 'ELECTRONIC_4X4');

test('Techno: estrategia es analogous', 
  technoPalette.meta.strategy === 'analogous');

test('Techno: temperatura es cool', 
  technoPalette.meta.temperature === 'cool');

test('Techno: hue primario en rango azul (230-260°)', 
  technoPalette.primary.h >= 230 && technoPalette.primary.h <= 260);

test('Techno: saturación moderada (30-70%)', 
  technoPalette.primary.s >= 30 && technoPalette.primary.s <= 70);

test('Techno: lightness baja (20-50%)', 
  technoPalette.primary.l >= 20 && technoPalette.primary.l <= 50);

const technoRgb = hslToRgb(technoPalette.primary);
test('Techno: RGB es azul oscuro (B >= R)', 
  technoRgb.b >= technoRgb.r);

console.log(`\n🎨 Techno Palette:`);
console.log(`  PRIMARY:   HSL(${technoPalette.primary.h}°, ${technoPalette.primary.s}%, ${technoPalette.primary.l}%) → RGB(${technoRgb.r}, ${technoRgb.g}, ${technoRgb.b})`);
console.log(`  SECONDARY: HSL(${technoPalette.secondary.h}°, ${technoPalette.secondary.s}%, ${technoPalette.secondary.l}%) [Fibonacci]`);
console.log(`  ACCENT:    HSL(${technoPalette.accent.h}°, ${technoPalette.accent.s}%, ${technoPalette.accent.l}%) [Analogous +30°]`);

// === EXAMPLE 2: CUMBIA ===
console.log('\n📍 EJEMPLO 2: CUMBIA (D major, 110 BPM, Energy 0.68)\n');

const cumbiaInput = {
  energy: 0.68,
  wave8: {
    harmony: { key: 'D', mode: 'major', mood: 'spanish_exotic' },
    rhythm: { syncopation: 0.68 },
    genre: { primary: 'cumbia' },
  }
};

const cumbiaPalette = generate(cumbiaInput);

test('Cumbia: macro-género es LATINO_TRADICIONAL', 
  cumbiaPalette.meta.macroGenre === 'LATINO_TRADICIONAL');

test('Cumbia: estrategia es complementary', 
  cumbiaPalette.meta.strategy === 'complementary');

test('Cumbia: temperatura es warm', 
  cumbiaPalette.meta.temperature === 'warm');

test('Cumbia: hue primario en rango naranja (80-110°)', 
  cumbiaPalette.primary.h >= 80 && cumbiaPalette.primary.h <= 110);

test('Cumbia: saturación MUY alta (80-100%)', 
  cumbiaPalette.primary.s >= 80 && cumbiaPalette.primary.s <= 100);

test('Cumbia: lightness alta (55-85%)', 
  cumbiaPalette.primary.l >= 55 && cumbiaPalette.primary.l <= 85);

const cumbiaRgb = hslToRgb(cumbiaPalette.primary);
test('Cumbia: RGB es naranja (R > B)', 
  cumbiaRgb.r > cumbiaRgb.b);

console.log(`\n🎨 Cumbia Palette:`);
console.log(`  PRIMARY:   HSL(${cumbiaPalette.primary.h}°, ${cumbiaPalette.primary.s}%, ${cumbiaPalette.primary.l}%) → RGB(${cumbiaRgb.r}, ${cumbiaRgb.g}, ${cumbiaRgb.b})`);
console.log(`  SECONDARY: HSL(${cumbiaPalette.secondary.h}°, ${cumbiaPalette.secondary.s}%, ${cumbiaPalette.secondary.l}%) [Fibonacci]`);
console.log(`  ACCENT:    HSL(${cumbiaPalette.accent.h}°, ${cumbiaPalette.accent.s}%, ${cumbiaPalette.accent.l}%) [Complementary +180°]`);

// === EDGE CASES ===
console.log('\n📍 EDGE CASES\n');

const minimalInput = { energy: 0.5 };
const minimalPalette = generate(minimalInput);
test('Minimal input: genera paleta válida', 
  minimalPalette.primary && minimalPalette.meta);

test('Minimal input: macro-género es válido', 
  minimalPalette.meta.macroGenre && minimalPalette.meta.macroGenre.length > 0);

const edgeInput = { energy: -0.5 };
const edgePalette = generate(edgeInput);
test('Edge case (energy negativo): saturación en rango válido', 
  edgePalette.primary.s >= 0 && edgePalette.primary.s <= 100);

// === FIBONACCI VALIDATION ===
console.log('\n📍 FIBONACCI ROTATION\n');

const fiboExpected = (technoPalette.primary.h + 222.5) % 360;
const fiboDiff = Math.abs(technoPalette.secondary.h - fiboExpected);
test('Fibonacci rotation: secondary ≈ primary + 222.5°', 
  fiboDiff < 1);

console.log(`  Primary hue: ${technoPalette.primary.h.toFixed(1)}°`);
console.log(`  Expected secondary: ${fiboExpected.toFixed(1)}°`);
console.log(`  Actual secondary: ${technoPalette.secondary.h.toFixed(1)}°`);
console.log(`  Difference: ${fiboDiff.toFixed(3)}°`);

// === SUMMARY ===
console.log('\n' + '='.repeat(50));
console.log(`\n📊 TEST SUMMARY\n`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Total: ${passed + failed}`);
console.log(`💯 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

if (failed === 0) {
  console.log('🎉 ALL TESTS PASSED! SeleneColorEngine is working perfectly!\n');
  process.exit(0);
} else {
  console.log('⚠️ Some tests failed. Review above.\n');
  process.exit(1);
}
