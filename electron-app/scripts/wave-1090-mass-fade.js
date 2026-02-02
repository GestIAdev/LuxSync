/**
 * 🌊 WAVE 1090: OPERATION MASS FADE
 * ═══════════════════════════════════════════════════════════════════════════
 * Script automatizado para inyectar Fluid Dynamics en TODOS los efectos
 * 
 * MÉTODO: Regex-based code injection
 * AUTOR: PunkOpus (System Architect)
 * FECHA: 2026-02-02
 * ═══════════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN POR VIBE/GÉNERO
// ═══════════════════════════════════════════════════════════════════════════

const VIBE_CONFIGS = {
  techno: { fadeInMs: 0, fadeOutMs: 400, description: 'Ataque duro, salida limpia' },
  fiestalatina: { fadeInMs: 200, fadeOutMs: 600, description: 'Suave y caliente' },
  poprock: { fadeInMs: 100, fadeOutMs: 1000, description: 'Resonancia de arena' },
  chillLounge: { fadeInMs: 1000, fadeOutMs: 1000, description: 'Lento y oceánico' },
};

// ═══════════════════════════════════════════════════════════════════════════
// EFECTOS A EXCLUIR (ya tienen implementación manual o son especiales)
// ═══════════════════════════════════════════════════════════════════════════

const EXCLUDED_EFFECTS = [
  'SolarCaustics.ts',      // WAVE 1081 - Ya tiene fade manual optimizado
  'TidalWave.ts',          // Efecto especial con lógica propia
  'BaseEffect.ts',         // No es un efecto, es la clase base
  'index.ts',              // Archivo de exports
  'types.ts',              // Tipos
];

// ═══════════════════════════════════════════════════════════════════════════
// ESTADÍSTICAS
// ═══════════════════════════════════════════════════════════════════════════

const stats = {
  scanned: 0,
  modified: 0,
  skipped: 0,
  errors: [],
  details: [],
};

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES DE ANÁLISIS
// ═══════════════════════════════════════════════════════════════════════════

function detectVibe(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  for (const vibe of Object.keys(VIBE_CONFIGS)) {
    if (normalizedPath.includes(`/${vibe}/`)) {
      return vibe;
    }
  }
  return null;
}

function detectMixBus(content) {
  // Buscar mixBus = 'global' o mixBus: 'global'
  if (/mixBus\s*[=:]\s*['"]global['"]/i.test(content)) {
    return 'global';
  }
  if (/mixBus\s*[=:]\s*['"]htp['"]/i.test(content)) {
    return 'htp';
  }
  return 'htp'; // Default
}

function hasExistingFade(content) {
  return content.includes('fadeInMs') || 
         content.includes('fadeOutMs') || 
         content.includes('WAVE 1090') ||
         content.includes('globalComposition');
}

function hasConfigInterface(content) {
  return /interface\s+\w+Config\s*\{/.test(content);
}

function hasDefaultConfig(content) {
  return /const\s+DEFAULT_CONFIG\s*[=:]/i.test(content);
}

function hasGetOutput(content) {
  return /getOutput\s*\(\s*\)\s*[:{]/.test(content);
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES DE INYECCIÓN
// ═══════════════════════════════════════════════════════════════════════════

function injectInterfaceFields(content, vibe) {
  // Buscar el cierre de la interface Config y añadir los campos antes
  const interfaceRegex = /(interface\s+\w+Config\s*\{[^}]+)(})/;
  const match = content.match(interfaceRegex);
  
  if (!match) return { content, injected: false };
  
  // Verificar si ya tiene los campos
  if (match[1].includes('fadeInMs') || match[1].includes('fadeOutMs')) {
    return { content, injected: false };
  }
  
  const injection = `
  /** 🌊 WAVE 1090: Duración del fade in (ms) */
  fadeInMs: number
  /** 🌊 WAVE 1090: Duración del fade out (ms) */
  fadeOutMs: number
`;
  
  const newContent = content.replace(
    interfaceRegex,
    `$1${injection}$2`
  );
  
  return { content: newContent, injected: true };
}

function injectDefaultConfigValues(content, vibe) {
  const config = VIBE_CONFIGS[vibe];
  if (!config) return { content, injected: false };
  
  // Buscar DEFAULT_CONFIG y el cierre }
  // Patrón: buscar la última propiedad antes del } de DEFAULT_CONFIG
  const configRegex = /(const\s+DEFAULT_CONFIG[^{]*\{[^}]+?)(\s*})/;
  const match = content.match(configRegex);
  
  if (!match) return { content, injected: false };
  
  // Verificar si ya tiene los valores
  if (match[1].includes('fadeInMs') || match[1].includes('fadeOutMs')) {
    return { content, injected: false };
  }
  
  // Asegurar que la última línea tenga coma
  let configBody = match[1];
  if (!configBody.trimEnd().endsWith(',')) {
    configBody = configBody.trimEnd() + ',';
  }
  
  const injection = `
  fadeInMs: ${config.fadeInMs},        // 🌊 WAVE 1090: ${config.description}
  fadeOutMs: ${config.fadeOutMs},       // 🌊 WAVE 1090: Fluid Dynamics`;
  
  const newContent = content.replace(
    configRegex,
    `${configBody}${injection}$2`
  );
  
  return { content: newContent, injected: true };
}

function injectFadeLogicInGetOutput(content, mixBus) {
  // Buscar el inicio de getOutput después de la declaración
  // Patrón: getOutput(): ... { seguido de código
  
  const getOutputRegex = /(getOutput\s*\(\s*\)\s*:\s*\w+[^{]*\{)(\s*\n)/;
  const match = content.match(getOutputRegex);
  
  if (!match) return { content, injected: false };
  
  // Verificar si ya tiene el fade logic
  if (content.includes('fadeOpacity') || content.includes('WAVE 1090')) {
    return { content, injected: false };
  }
  
  const fadeLogic = `
    // 🌊 WAVE 1090: AUTO-INJECTED FLUID DYNAMICS
    let fadeOpacity = 1.0;
    if (this.config.fadeInMs > 0 || this.config.fadeOutMs > 0) {
      const fadeOutStart = this.config.durationMs - this.config.fadeOutMs;
      if (this.elapsedMs < this.config.fadeInMs && this.config.fadeInMs > 0) {
        fadeOpacity = (this.elapsedMs / this.config.fadeInMs) ** 1.5;
      } else if (this.elapsedMs > fadeOutStart && this.config.fadeOutMs > 0) {
        fadeOpacity = ((this.config.durationMs - this.elapsedMs) / this.config.fadeOutMs) ** 1.5;
      }
    }
`;

  const newContent = content.replace(
    getOutputRegex,
    `$1$2${fadeLogic}`
  );
  
  return { content: newContent, injected: true };
}

function injectFadeInOutput(content, mixBus) {
  if (mixBus === 'global') {
    // Para efectos globales: añadir globalComposition
    return injectGlobalComposition(content);
  } else {
    // Para efectos HTP: modificar intensity
    return injectIntensityFade(content);
  }
}

function injectGlobalComposition(content) {
  // Buscar el return { del output y añadir globalComposition
  // Patrón complejo: buscar return { ... effectId: ... }
  
  // Si ya tiene globalComposition, modificarlo para usar fadeOpacity
  if (content.includes('globalComposition:')) {
    // Reemplazar globalComposition: 1.0 por globalComposition: fadeOpacity
    if (content.includes('globalComposition: 1.0') || content.includes('globalComposition: 1')) {
      const newContent = content.replace(
        /globalComposition:\s*1(\.0)?/g,
        'globalComposition: fadeOpacity'
      );
      return { content: newContent, injected: true };
    }
    return { content, injected: false };
  }
  
  // Buscar el return del output con effectId
  const returnRegex = /(return\s*\{[^}]*effectId:\s*this\.id,?)(\s*\n)/;
  const match = content.match(returnRegex);
  
  if (!match) return { content, injected: false };
  
  // Añadir globalComposition después de effectId
  let returnPart = match[1];
  if (!returnPart.endsWith(',')) {
    returnPart += ',';
  }
  
  const newContent = content.replace(
    returnRegex,
    `${returnPart}\n      globalComposition: fadeOpacity,  // 🌊 WAVE 1090$2`
  );
  
  return { content: newContent, injected: true };
}

function injectIntensityFade(content) {
  // Para efectos HTP: buscar intensity: X y multiplicar por fadeOpacity
  // Esto es más delicado porque hay muchos patrones de intensity
  
  // Buscar patrones como: intensity: this.triggerIntensity * something
  // o intensity: baseIntensity, o intensity: value
  
  // Patrón 1: intensity: variable (sin fadeOpacity ya)
  const intensityRegex = /(\s+intensity:\s*)([^,\n]+)(,?\s*\n)/g;
  
  let modified = false;
  let newContent = content;
  
  // Solo modificar si no tiene ya fadeOpacity
  if (!content.match(/intensity:[^,\n]*fadeOpacity/)) {
    newContent = content.replace(intensityRegex, (match, prefix, value, suffix) => {
      // No modificar si ya tiene fadeOpacity
      if (value.includes('fadeOpacity')) return match;
      // No modificar si es 0 o muy simple
      if (value.trim() === '0' || value.trim() === '0.0') return match;
      
      modified = true;
      const trimmedValue = value.trim();
      // Envolver en paréntesis si es complejo
      const needsParens = trimmedValue.includes(' ') || trimmedValue.includes('*');
      const wrappedValue = needsParens ? `(${trimmedValue})` : trimmedValue;
      return `${prefix}${wrappedValue} * fadeOpacity${suffix}`;
    });
  }
  
  return { content: newContent, injected: modified };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCESAMIENTO DE ARCHIVOS
// ═══════════════════════════════════════════════════════════════════════════

function processFile(filePath) {
  const fileName = path.basename(filePath);
  
  // Verificar exclusiones
  if (EXCLUDED_EFFECTS.includes(fileName)) {
    stats.skipped++;
    stats.details.push({ file: fileName, status: 'SKIPPED', reason: 'En lista de exclusión' });
    return;
  }
  
  stats.scanned++;
  
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    stats.errors.push({ file: fileName, error: `Read error: ${err.message}` });
    return;
  }
  
  // Detectar vibe
  const vibe = detectVibe(filePath);
  if (!vibe) {
    stats.skipped++;
    stats.details.push({ file: fileName, status: 'SKIPPED', reason: 'Vibe no detectado' });
    return;
  }
  
  // Verificar si ya tiene fade implementado
  if (hasExistingFade(content)) {
    stats.skipped++;
    stats.details.push({ file: fileName, status: 'SKIPPED', reason: 'Ya tiene fade implementado' });
    return;
  }
  
  // Verificar que tiene la estructura necesaria
  if (!hasConfigInterface(content) || !hasDefaultConfig(content) || !hasGetOutput(content)) {
    stats.skipped++;
    stats.details.push({ file: fileName, status: 'SKIPPED', reason: 'Estructura incompatible' });
    return;
  }
  
  // Detectar mixBus
  const mixBus = detectMixBus(content);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INYECCIONES
  // ═══════════════════════════════════════════════════════════════════════════
  
  let currentContent = content;
  let modifications = [];
  
  // 1. Inyectar campos en interface
  const interfaceResult = injectInterfaceFields(currentContent, vibe);
  if (interfaceResult.injected) {
    currentContent = interfaceResult.content;
    modifications.push('Interface fields');
  }
  
  // 2. Inyectar valores en DEFAULT_CONFIG
  const configResult = injectDefaultConfigValues(currentContent, vibe);
  if (configResult.injected) {
    currentContent = configResult.content;
    modifications.push('DEFAULT_CONFIG values');
  }
  
  // 3. Inyectar lógica de fade en getOutput
  const logicResult = injectFadeLogicInGetOutput(currentContent, mixBus);
  if (logicResult.injected) {
    currentContent = logicResult.content;
    modifications.push('Fade logic in getOutput');
  }
  
  // 4. Inyectar fade en output (globalComposition o intensity)
  const outputResult = injectFadeInOutput(currentContent, mixBus);
  if (outputResult.injected) {
    currentContent = outputResult.content;
    modifications.push(mixBus === 'global' ? 'globalComposition' : 'intensity * fadeOpacity');
  }
  
  // Verificar si hubo cambios
  if (modifications.length === 0) {
    stats.skipped++;
    stats.details.push({ file: fileName, status: 'SKIPPED', reason: 'No se pudieron aplicar cambios' });
    return;
  }
  
  // Escribir archivo modificado
  try {
    fs.writeFileSync(filePath, currentContent, 'utf8');
    stats.modified++;
    stats.details.push({
      file: fileName,
      status: 'MODIFIED',
      vibe,
      mixBus,
      modifications,
      fadeIn: VIBE_CONFIGS[vibe].fadeInMs,
      fadeOut: VIBE_CONFIGS[vibe].fadeOutMs,
    });
  } catch (err) {
    stats.errors.push({ file: fileName, error: `Write error: ${err.message}` });
  }
}

function scanDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.backup')) {
      processFile(fullPath);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

console.log('');
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('🌊 WAVE 1090: OPERATION MASS FADE');
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('');

const libraryPath = path.join(__dirname, '..', 'src', 'core', 'effects', 'library');

if (!fs.existsSync(libraryPath)) {
  console.error('❌ ERROR: No se encontró el directorio de efectos:', libraryPath);
  process.exit(1);
}

console.log('📂 Escaneando:', libraryPath);
console.log('');

scanDirectory(libraryPath);

// ═══════════════════════════════════════════════════════════════════════════
// REPORTE
// ═══════════════════════════════════════════════════════════════════════════

console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('📊 ESTADÍSTICAS');
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log(`  Archivos escaneados: ${stats.scanned}`);
console.log(`  Archivos modificados: ${stats.modified}`);
console.log(`  Archivos omitidos: ${stats.skipped}`);
console.log(`  Errores: ${stats.errors.length}`);
console.log('');

if (stats.details.length > 0) {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('📋 DETALLES');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  
  for (const detail of stats.details) {
    if (detail.status === 'MODIFIED') {
      console.log(`  ✅ ${detail.file}`);
      console.log(`     Vibe: ${detail.vibe} | MixBus: ${detail.mixBus}`);
      console.log(`     FadeIn: ${detail.fadeIn}ms | FadeOut: ${detail.fadeOut}ms`);
      console.log(`     Cambios: ${detail.modifications.join(', ')}`);
    } else {
      console.log(`  ⏭️  ${detail.file}: ${detail.reason}`);
    }
  }
}

if (stats.errors.length > 0) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('❌ ERRORES');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  for (const err of stats.errors) {
    console.log(`  ${err.file}: ${err.error}`);
  }
}

console.log('');
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('🌊 WAVE 1090 COMPLETADA');
console.log('═══════════════════════════════════════════════════════════════════════════');
