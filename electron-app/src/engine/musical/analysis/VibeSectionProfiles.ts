/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 WAVE 289: VIBE-AWARE SECTION PROFILES
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * El SectionTracker era ciego al género. Usaba constantes mágicas globales
 * que funcionaban bien para Techno pero causaban DROPs eternos en Latino
 * y falsos positivos en Rock.
 * 
 * SOLUCIÓN: Cada Vibe tiene su propio perfil de detección de secciones.
 * - TECHNO: Drops largos (30s), bass es rey, buildups obligatorios
 * - LATINO: Drops cortos (12s), mid-bass manda, transiciones libres
 * - ROCK: Estructura verso-estribillo, mid frequencies dominan
 * - CHILL: Casi sin drops, todo fluye suave
 * 
 * FILOSOFÍA: "El tracker debe sentir la música, no medirla"
 * 
 * @module VibeSectionProfiles
 * @version 1.0.0 - WAVE 289
 * @authors PunkOpus, PunkGemini, Radwulf
 */

import type { SectionType } from '../types.js';

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎯 Perfil de detección de secciones por género musical
 * 
 * Cada Vibe tiene características distintas para detectar drops/builds/breakdowns.
 * Estos perfiles reemplazan las constantes mágicas globales del SectionTracker.
 */
export interface VibeSectionProfile {
  // ════════════════════════════════════════════════════════════════
  // 🎯 DETECCIÓN DE DROP
  // ════════════════════════════════════════════════════════════════
  
  /**
   * Ratio de energía instantánea/promedio para disparar DROP
   * - Techno: 1.4 (necesita explosión brutal)
   * - Latino: 1.2 (más sensible, drops pequeños pero frecuentes)
   * - Rock: 1.5 (raro, solo en breakdown→chorus épico)
   * - Chill: 2.0 (casi imposible, no hay drops)
   */
  dropEnergyRatio: number;
  
  /**
   * Duración máxima de DROP antes del kill switch automático (ms)
   * - Techno: 30000 (30s - tracks 4x4 de 128bpm)
   * - Latino: 12000 (12s - perreo rápido, variedad constante)
   * - Rock: 8000 (8s - estructura de canción tradicional)
   * - Chill: 5000 (5s - si hay drop, es fugaz)
   */
  maxDropDuration: number;
  
  /**
   * Umbral de energía absoluto para disparar DROP
   * - Techno: 0.75 (bass puro, mastering comprimido)
   * - Latino: 0.70 (más dinámico, picos más bajos)
   * - Rock: 0.80 (necesita guitarras distorsionadas FULL)
   * - Chill: 0.85 (casi nunca se alcanza)
   */
  dropAbsoluteThreshold: number;
  
  /**
   * Cooldown después de un DROP antes de permitir otro (ms)
   * - Techno: 15000 (15s - builds largos entre drops)
   * - Latino: 6000 (6s - transiciones rápidas)
   * - Rock: 20000 (20s - estructura verso/estribillo)
   * - Chill: 30000 (30s - paz máxima)
   */
  dropCooldown: number;
  
  /**
   * Umbral de energía para kill switch de DROP
   * Si la energía cae por debajo de este valor, forzar salida
   */
  dropEnergyKillThreshold: number;
  
  // ════════════════════════════════════════════════════════════════
  // 📈 DETECCIÓN DE BUILDUP
  // ════════════════════════════════════════════════════════════════
  
  /**
   * Delta de energía mínimo para detectar BUILDUP (energy rising)
   * - Techno: 0.03 (sensible, los risers son sutiles al principio)
   * - Latino: 0.05 (builds más abruptos)
   * - Rock: 0.04 (crescendos de guitarra)
   * - Chill: 0.02 (muy sensible, cualquier subida cuenta)
   */
  buildupDeltaThreshold: number;
  
  /**
   * Duración mínima de subida sostenida para confirmar BUILDUP (ms)
   * - Techno: 4000 (4s - risers largos)
   * - Latino: 2000 (2s - builds rápidos pre-dembow)
   * - Rock: 3000 (3s - crescendos)
   * - Chill: 5000 (5s - transiciones lentas)
   */
  minBuildupDuration: number;
  
  // ════════════════════════════════════════════════════════════════
  // 📉 DETECCIÓN DE BREAKDOWN
  // ════════════════════════════════════════════════════════════════
  
  /**
   * Umbral de energía baja para detectar BREAKDOWN
   * - Techno: 0.35 (silencios dramáticos)
   * - Latino: 0.45 (nunca baja mucho, siempre hay percusión)
   * - Rock: 0.40 (bridges acústicos)
   * - Chill: 0.50 (la "normalidad" es baja energía)
   */
  breakdownEnergyThreshold: number;
  
  /**
   * Tiempo sostenido en baja energía para confirmar BREAKDOWN (ms)
   * - Techno: 2000 (2s - breakdowns cortos pero impactantes)
   * - Latino: 1500 (1.5s - transiciones rápidas)
   * - Rock: 3000 (3s - bridges más largos)
   * - Chill: 4000 (4s - estados prolongados)
   */
  minBreakdownDuration: number;
  
  // ════════════════════════════════════════════════════════════════
  // 🎚️ PESOS DE FRECUENCIA
  // ════════════════════════════════════════════════════════════════
  
  /**
   * Banda de frecuencia dominante para calcular intensidad
   * Define qué frecuencias "mandan" para este género
   * 
   * - TECHNO: Bass es REY (kick 4x4)
   * - LATINO: Mid-Bass manda (dembow, tumbao, bajo melódico)
   * - ROCK: Mid domina (guitarras distorsionadas)
   * - CHILL: Balance uniforme
   */
  frequencyWeights: {
    bass: number;     // Sub-bass y kick (20-80Hz)
    midBass: number;  // 80-250Hz (bombo, bajo melódico)
    mid: number;      // 250-2kHz (voces, guitarras)
    treble: number;   // 2kHz+ (hi-hats, brillos)
  };
  
  // ════════════════════════════════════════════════════════════════
  // 🎯 TRANSICIONES PERMITIDAS (Override opcional)
  // ════════════════════════════════════════════════════════════════
  
  /**
   * Override de matriz de transiciones para este género
   * Si no se define, usa la matriz global SECTION_TRANSITIONS
   * 
   * Ejemplo Latino: verse → drop es válido (dembow directo)
   * Ejemplo Techno: verse → drop INVÁLIDO (siempre buildup primero)
   */
  transitionOverrides?: Partial<Record<SectionType, SectionType[]>>;
}

// ═══════════════════════════════════════════════════════════════════════════
// PERFILES PRECONFIGURADOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🔥 WAVE 289: Biblioteca de perfiles de sección por Vibe
 * 
 * Cada perfil está afinado para el comportamiento musical típico del género.
 * Los valores vienen de análisis empírico de tracks representativos.
 */
export const VIBE_SECTION_PROFILES: Record<string, VibeSectionProfile> = {
  
  // ════════════════════════════════════════════════════════════════
  // 🎧 TECHNO / TECH-HOUSE / MINIMAL
  // ════════════════════════════════════════════════════════════════
  // Caracterizado por:
  // - Kicks 4x4 sostenidos (128bpm típico)
  // - Builds largos con risers y filters
  // - Drops brutales de 16-32 compases
  // - Breakdowns dramáticos (silencio = tensión)
  // ════════════════════════════════════════════════════════════════
  'techno': {
    // DROP: Largo y brutal
    dropEnergyRatio: 1.40,
    maxDropDuration: 30000,        // 30 segundos
    dropAbsoluteThreshold: 0.75,
    dropCooldown: 15000,           // 15 segundos
    dropEnergyKillThreshold: 0.55,
    
    // BUILDUP: Risers largos
    buildupDeltaThreshold: 0.03,
    minBuildupDuration: 4000,
    
    // BREAKDOWN: Silencios dramáticos
    breakdownEnergyThreshold: 0.35,
    minBreakdownDuration: 2000,
    
    // FRECUENCIAS: El kick es REY
    frequencyWeights: {
      bass: 0.50,      // El kick 4x4 domina
      midBass: 0.25,   // Bassline
      mid: 0.15,       // Synths secundarios
      treble: 0.10,    // Hi-hats para groove
    },
    
    // TRANSICIONES: SIEMPRE buildup antes de drop
    transitionOverrides: {
      'verse': ['pre_chorus', 'buildup'],     // NO direct to drop
      'breakdown': ['buildup'],               // Recovery siempre via buildup
      'intro': ['verse', 'buildup'],          // Intro puede ir a buildup
    }
  },
  
  // ════════════════════════════════════════════════════════════════
  // 🌴 LATINO (Reggaetón, Dembow, Cumbia, Bachata)
  // ════════════════════════════════════════════════════════════════
  // Caracterizado por:
  // - Patrón dembow (tun-tun-ta, tun-tun-ta)
  // - Transiciones rápidas y sorpresivas
  // - Drops cortos pero intensos
  // - Nunca hay silencio total (siempre percusión)
  // ════════════════════════════════════════════════════════════════
  'latino': {
    // DROP: Corto y punchy
    dropEnergyRatio: 1.20,         // Más sensible
    maxDropDuration: 12000,        // 12 segundos máximo
    dropAbsoluteThreshold: 0.70,
    dropCooldown: 6000,            // 6 segundos
    dropEnergyKillThreshold: 0.50,
    
    // BUILDUP: Rápido
    buildupDeltaThreshold: 0.05,
    minBuildupDuration: 2000,      // Builds rápidos
    
    // BREAKDOWN: Nunca baja mucho
    breakdownEnergyThreshold: 0.45, // Latino siempre tiene percusión
    minBreakdownDuration: 1500,
    
    // FRECUENCIAS: Mid-Bass es el REY (dembow vive aquí)
    frequencyWeights: {
      bass: 0.30,      // Kick importante pero no dominante
      midBass: 0.40,   // DEMBOW VIVE AQUÍ (bajo + tumbao)
      mid: 0.20,       // Voces
      treble: 0.10,    // Bongós, shakers
    },
    
    // TRANSICIONES: Libertad total, drops sorpresa permitidos
    transitionOverrides: {
      'verse': ['chorus', 'drop', 'buildup', 'pre_chorus'],  // Drop directo ✅
      'breakdown': ['drop', 'buildup', 'verse'],             // Puede explotar
      'intro': ['verse', 'drop'],                            // Intro→Drop permitido
    }
  },
  
  // ════════════════════════════════════════════════════════════════
  // 🎸 ROCK (Hard Rock, Metal, Indie)
  // ════════════════════════════════════════════════════════════════
  // Caracterizado por:
  // - Estructura verso-estribillo tradicional
  // - Guitarras distorsionadas en el mid
  // - Bridges acústicos o melódicos
  // - "Drops" son realmente estribillos explosivos
  // ════════════════════════════════════════════════════════════════
  'rock': {
    // DROP: En realidad es CHORUS explosivo
    dropEnergyRatio: 1.50,         // Necesita explosión real
    maxDropDuration: 8000,         // 8 segundos (estribillo corto)
    dropAbsoluteThreshold: 0.80,
    dropCooldown: 20000,           // 20 segundos entre estribillos
    dropEnergyKillThreshold: 0.60,
    
    // BUILDUP: Crescendos de guitarra
    buildupDeltaThreshold: 0.04,
    minBuildupDuration: 3000,
    
    // BREAKDOWN: Bridges acústicos
    breakdownEnergyThreshold: 0.40,
    minBreakdownDuration: 3000,
    
    // FRECUENCIAS: Las guitarras son REINAS
    frequencyWeights: {
      bass: 0.25,      // Bass guitar
      midBass: 0.25,   // Punch de guitarra
      mid: 0.40,       // GUITARRAS DISTORSIONADAS
      treble: 0.10,    // Crash de platillos
    },
    
    // TRANSICIONES: Estructura tradicional
    transitionOverrides: {
      'verse': ['pre_chorus', 'chorus'],      // Verso → Pre-chorus → Chorus
      'chorus': ['verse', 'bridge', 'outro'], // No vuelve a buildup
      'bridge': ['chorus', 'outro'],          // Bridge resuelve a chorus
    }
  },
  
  // ════════════════════════════════════════════════════════════════
  // 🌙 CHILL (Ambient, Lo-Fi, Jazz, Downtempo)
  // ════════════════════════════════════════════════════════════════
  // Caracterizado por:
  // - Energía baja constante
  // - Transiciones suaves, casi imperceptibles
  // - Prácticamente sin "drops" tradicionales
  // - Todo es breakdown cómodo
  // ════════════════════════════════════════════════════════════════
  'chill': {
    // DROP: Casi imposible de alcanzar
    dropEnergyRatio: 2.00,         // Muy difícil
    maxDropDuration: 5000,         // Si hay, es brevísimo
    dropAbsoluteThreshold: 0.85,
    dropCooldown: 30000,           // 30 segundos de paz
    dropEnergyKillThreshold: 0.65,
    
    // BUILDUP: Muy sensible a cambios sutiles
    buildupDeltaThreshold: 0.02,   
    minBuildupDuration: 5000,
    
    // BREAKDOWN: El estado natural
    breakdownEnergyThreshold: 0.50, // "Normal" es bajo
    minBreakdownDuration: 4000,
    
    // FRECUENCIAS: Balance uniforme, ligero énfasis en mid
    frequencyWeights: {
      bass: 0.20,
      midBass: 0.25,
      mid: 0.35,       // Melodías suaves
      treble: 0.20,    // Shimmer, reverbs
    },
    
    // TRANSICIONES: Flujo orgánico, loops permitidos
    transitionOverrides: {
      'verse': ['verse', 'breakdown', 'outro'],  // Loops infinitos OK
      'breakdown': ['verse', 'outro'],           // Sin drops
      'intro': ['verse', 'breakdown'],           // Intro suave
    }
  },
  
  // ════════════════════════════════════════════════════════════════
  // 🛑 IDLE (Sistema en espera, sin audio)
  // ════════════════════════════════════════════════════════════════
  // Estado inicial del sistema. Imposible detectar secciones.
  // ════════════════════════════════════════════════════════════════
  'idle': {
    dropEnergyRatio: 10.0,         // Imposible
    maxDropDuration: 1000,
    dropAbsoluteThreshold: 0.99,
    dropCooldown: 60000,
    dropEnergyKillThreshold: 0.99,
    
    buildupDeltaThreshold: 1.0,    // Imposible
    minBuildupDuration: 10000,
    
    breakdownEnergyThreshold: 0.0,
    minBreakdownDuration: 0,
    
    frequencyWeights: {
      bass: 0.25,
      midBass: 0.25,
      mid: 0.25,
      treble: 0.25,
    },
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ALIASES PARA COMPATIBILIDAD CON VIBES EXISTENTES
// ═══════════════════════════════════════════════════════════════════════════

// Techno variants
VIBE_SECTION_PROFILES['techno-club'] = VIBE_SECTION_PROFILES['techno'];
VIBE_SECTION_PROFILES['techno-minimal'] = VIBE_SECTION_PROFILES['techno'];
VIBE_SECTION_PROFILES['tech-house'] = VIBE_SECTION_PROFILES['techno'];

// Latino variants
VIBE_SECTION_PROFILES['fiesta-latina'] = VIBE_SECTION_PROFILES['latino'];
VIBE_SECTION_PROFILES['reggaeton'] = VIBE_SECTION_PROFILES['latino'];
VIBE_SECTION_PROFILES['cumbia'] = VIBE_SECTION_PROFILES['latino'];
VIBE_SECTION_PROFILES['dembow'] = VIBE_SECTION_PROFILES['latino'];
VIBE_SECTION_PROFILES['bachata'] = VIBE_SECTION_PROFILES['latino'];
VIBE_SECTION_PROFILES['salsa'] = VIBE_SECTION_PROFILES['latino'];

// Rock variants
VIBE_SECTION_PROFILES['rock-concert'] = VIBE_SECTION_PROFILES['rock'];
VIBE_SECTION_PROFILES['metal'] = VIBE_SECTION_PROFILES['rock'];
VIBE_SECTION_PROFILES['indie'] = VIBE_SECTION_PROFILES['rock'];

// Chill variants
VIBE_SECTION_PROFILES['ambient'] = VIBE_SECTION_PROFILES['chill'];
VIBE_SECTION_PROFILES['lofi'] = VIBE_SECTION_PROFILES['chill'];
VIBE_SECTION_PROFILES['jazz'] = VIBE_SECTION_PROFILES['chill'];
VIBE_SECTION_PROFILES['downtempo'] = VIBE_SECTION_PROFILES['chill'];

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Obtener perfil de sección para un vibeId dado
 * Si no existe, retorna perfil de techno como fallback
 */
export function getVibeSectionProfile(vibeId: string): VibeSectionProfile {
  const normalized = vibeId.toLowerCase().replace(/[_\s]/g, '-');
  return VIBE_SECTION_PROFILES[normalized] || VIBE_SECTION_PROFILES['techno'];
}

/**
 * Verificar si una transición es válida para un vibe específico
 */
export function isValidTransition(
  vibeId: string, 
  from: SectionType, 
  to: SectionType
): boolean {
  const profile = getVibeSectionProfile(vibeId);
  
  // Si hay override específico, usarlo
  if (profile.transitionOverrides?.[from]) {
    return profile.transitionOverrides[from]!.includes(to);
  }
  
  // Si no hay override, delegar a la matriz global (en SectionTracker)
  return true; // El SectionTracker validará con SECTION_TRANSITIONS
}

/**
 * Calcular energía ponderada según el perfil del género
 */
export function calculateWeightedEnergy(
  profile: VibeSectionProfile,
  audio: { bass: number; mid: number; treble: number }
): number {
  const { frequencyWeights } = profile;
  
  // Para midBass, interpolamos entre bass y mid
  const midBass = (audio.bass + audio.mid) / 2;
  
  return (
    audio.bass * frequencyWeights.bass +
    midBass * frequencyWeights.midBass +
    audio.mid * frequencyWeights.mid +
    audio.treble * frequencyWeights.treble
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DEBUG
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Log de perfil para debug
 */
export function logVibeSectionProfile(vibeId: string): void {
  const profile = getVibeSectionProfile(vibeId);
  console.log(`[VibeSectionProfile] 🎯 ${vibeId}:`);
  console.log(`  DROP: ratio=${profile.dropEnergyRatio}, max=${profile.maxDropDuration}ms, cooldown=${profile.dropCooldown}ms`);
  console.log(`  BUILDUP: delta=${profile.buildupDeltaThreshold}, minDuration=${profile.minBuildupDuration}ms`);
  console.log(`  BREAKDOWN: threshold=${profile.breakdownEnergyThreshold}, minDuration=${profile.minBreakdownDuration}ms`);
  console.log(`  WEIGHTS: bass=${profile.frequencyWeights.bass}, midBass=${profile.frequencyWeights.midBass}, mid=${profile.frequencyWeights.mid}`);
}
