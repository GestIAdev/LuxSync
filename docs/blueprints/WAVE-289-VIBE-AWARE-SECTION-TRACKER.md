# WAVE 289: VIBE-AWARE SECTION TRACKER 🎯

## EL DIAGNÓSTICO DEL PUNK GENIO

**Fecha:** 2 Enero 2026  
**Arquitecto:** Radwulf  
**Ejecutor:** PunkOpus  
**Status:** 🔵 BLUEPRINT - Pending Approval

---

## 📋 MISIÓN 1: CADENA DE MANDO DEL SECTION TRACKER

### 1.1 TOPOLOGÍA DEL FLUJO DE DATOS

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ARCHITECTURE AUDIT                                    │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌─────────────────┐
     │    UI / IPC     │  🎛️ Usuario selecciona Vibe (techno, latino, rock)
     │  setActiveVibe  │
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐
     │  TitanEngine    │  ⚡ Tiene acceso a VibeManager.getActiveVibe()
     │   (Main Loop)   │  ✅ VIBE ESTÁ AQUÍ
     └────────┬────────┘
              │ update(context, audio)
              ▼
     ┌─────────────────┐
     │MusicalContext-  │  🧠 Llama a SectionTracker.track()
     │     Engine      │  ❌ NO RECIBE vibeContext
     └────────┬────────┘
              │ track(rhythm, harmony, simpleAudio)
              ▼
     ┌─────────────────────────────────────────────────────────────────┐
     │                    SECTION TRACKER                              │
     │  ════════════════════════════════════════════════════════════   │
     │                                                                  │
     │  🔴 PROBLEMA: USA CONSTANTES GLOBALES                           │
     │                                                                  │
     │  ┌──────────────────────────────────────────────────────────┐   │
     │  │  maxDropDuration: 30000      ← Techno OK, Latino MAL     │   │
     │  │  dropEnergyKillThreshold: 0.6 ← Universal, no adaptativo │   │
     │  │  dynamicRatio: 1.4 / 1.15    ← Hardcoded, no genre-aware │   │
     │  │  energyChangeThreshold: 0.25 ← Same for cumbia & techno  │   │
     │  └──────────────────────────────────────────────────────────┘   │
     │                                                                  │
     │  RESULTADO: DROPs eternos en Latino, falsos positivos en Rock  │
     └─────────────────────────────────────────────────────────────────┘
```

### 1.2 PUNTO CRÍTICO DE INYECCIÓN

```typescript
// 📍 UBICACIÓN: MusicalContextEngine.ts:263
this.cachedSection = this.sectionTracker.track(
  rhythm,
  this.cachedHarmony!,
  simpleAudio
  // ❌ NO HAY vibeContext AQUÍ
);
```

**¿Tiene MusicalContextEngine acceso al Vibe?**

| Componente | ¿Tiene VibeManager? | ¿Puede inyectar? |
|------------|---------------------|------------------|
| TitanEngine | ✅ SÍ (`this.vibeManager`) | ❌ No llama a SectionTracker |
| MusicalContextEngine | ❌ NO | 🔧 NECESITA INYECCIÓN |
| SectionTracker | ❌ NO | 🎯 DESTINO |

### 1.3 ESTRATEGIA DE INYECCIÓN

**Opción A: Pasar vibeContext como parámetro (ELEGIDA)**
```
TitanEngine → MusicalContextEngine.process(audio, vibeId) 
            → SectionTracker.track(..., vibeContext)
```

**Opción B: Singleton VibeManager en SectionTracker**
```
SectionTracker importa VibeManager.getInstance()
```
**Rechazada:** Viola principio de inyección de dependencias, dificulta testing.

---

## 📐 MISIÓN 2: BLUEPRINT "VIBE-AWARE TRACKING"

### 2.1 NUEVA INTERFAZ: VibeSectionProfile

```typescript
/**
 * 🎯 WAVE 289: Perfil de detección de secciones por género musical
 * 
 * Cada Vibe tiene características distintas para detectar drops/builds/breakdowns:
 * - TECHNO: Drops largos y brutales (30s), energía sostenida, bass is king
 * - LATINO: Drops cortos y punchy (12s), variación constante, mid-bass manda
 * - ROCK: Estructuras de verso-estribillo, no hay "drops" tradicionales
 * - CHILL: Casi no hay drops, todo es breakdown suave
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
   */
  frequencyWeights: {
    bass: number;   // Sub-bass y kick
    midBass: number; // 80-250Hz (bombo, bajo melódico)
    mid: number;    // 250-2kHz (voces, guitarras)
    treble: number; // 2kHz+ (hi-hats, brillos)
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
```

### 2.2 PERFILES PRECONFIGURADOS

```typescript
/**
 * 🔥 WAVE 289: Biblioteca de perfiles de sección por Vibe
 */
export const VIBE_SECTION_PROFILES: Record<string, VibeSectionProfile> = {
  
  // ════════════════════════════════════════════════════════════════
  // 🎧 TECHNO / TECH-HOUSE / MINIMAL
  // ════════════════════════════════════════════════════════════════
  'techno': {
    dropEnergyRatio: 1.40,
    maxDropDuration: 30000,        // 30 segundos
    dropAbsoluteThreshold: 0.75,
    dropCooldown: 15000,           // 15 segundos
    
    buildupDeltaThreshold: 0.03,
    minBuildupDuration: 4000,
    
    breakdownEnergyThreshold: 0.35,
    minBreakdownDuration: 2000,
    
    frequencyWeights: {
      bass: 0.50,      // El kick es REY
      midBass: 0.25,   // Bassline
      mid: 0.15,       // Synths secundarios
      treble: 0.10,    // Hi-hats para groove
    },
    
    // Techno: SIEMPRE buildup antes de drop
    transitionOverrides: {
      'verse': ['pre_chorus', 'buildup'],  // NO direct to drop
      'breakdown': ['buildup'],            // Recovery siempre via buildup
    }
  },
  
  // ════════════════════════════════════════════════════════════════
  // 🌴 LATINO (Reggaetón, Dembow, Cumbia, Bachata)
  // ════════════════════════════════════════════════════════════════
  'latino': {
    dropEnergyRatio: 1.20,         // Más sensible
    maxDropDuration: 12000,        // 12 segundos máximo
    dropAbsoluteThreshold: 0.70,
    dropCooldown: 6000,            // 6 segundos
    
    buildupDeltaThreshold: 0.05,
    minBuildupDuration: 2000,      // Builds rápidos
    
    breakdownEnergyThreshold: 0.45, // Nunca baja mucho
    minBreakdownDuration: 1500,
    
    frequencyWeights: {
      bass: 0.30,      // Kick importante pero no dominante
      midBass: 0.40,   // DEMBOW VIVE AQUÍ (bajo + tumbao)
      mid: 0.20,       // Voces
      treble: 0.10,    // Bongós, shakers
    },
    
    // Latino: Transiciones más libres
    transitionOverrides: {
      'verse': ['chorus', 'drop', 'buildup'],  // Drop directo permitido
      'breakdown': ['drop', 'buildup'],        // Puede explotar directamente
    }
  },
  
  // ════════════════════════════════════════════════════════════════
  // 🎸 ROCK (Hard Rock, Metal, Indie)
  // ════════════════════════════════════════════════════════════════
  'rock': {
    dropEnergyRatio: 1.50,         // Necesita explosión real
    maxDropDuration: 8000,         // 8 segundos (estribillo)
    dropAbsoluteThreshold: 0.80,
    dropCooldown: 20000,           // 20 segundos
    
    buildupDeltaThreshold: 0.04,
    minBuildupDuration: 3000,
    
    breakdownEnergyThreshold: 0.40,
    minBreakdownDuration: 3000,
    
    frequencyWeights: {
      bass: 0.25,      // Bass guitar
      midBass: 0.25,   // Punch de guitarra
      mid: 0.40,       // GUITARRAS SON REINAS
      treble: 0.10,    // Crash de platillos
    },
    
    // Rock: Estructura tradicional
    transitionOverrides: {
      'verse': ['pre_chorus', 'chorus'],     // Verso → Pre-chorus → Chorus
      'chorus': ['verse', 'bridge', 'outro'], // No vuelve a buildup
    }
  },
  
  // ════════════════════════════════════════════════════════════════
  // 🌙 CHILL (Ambient, Lo-Fi, Jazz)
  // ════════════════════════════════════════════════════════════════
  'chill': {
    dropEnergyRatio: 2.00,         // Casi imposible de alcanzar
    maxDropDuration: 5000,         // Si hay, es brevísimo
    dropAbsoluteThreshold: 0.85,
    dropCooldown: 30000,           // 30 segundos de paz
    
    buildupDeltaThreshold: 0.02,   // Muy sensible
    minBuildupDuration: 5000,
    
    breakdownEnergyThreshold: 0.50, // "Normal" es bajo
    minBreakdownDuration: 4000,
    
    frequencyWeights: {
      bass: 0.20,
      midBass: 0.25,
      mid: 0.35,       // Melodías suaves
      treble: 0.20,    // Shimmer, reverbs
    },
    
    // Chill: Flujo orgánico
    transitionOverrides: {
      'verse': ['verse', 'breakdown', 'outro'],  // Loops infinitos permitidos
      'breakdown': ['verse', 'outro'],           // Sin drops
    }
  },
  
  // ════════════════════════════════════════════════════════════════
  // 🛑 IDLE (Sistema en espera)
  // ════════════════════════════════════════════════════════════════
  'idle': {
    dropEnergyRatio: 10.0,         // Imposible
    maxDropDuration: 1000,
    dropAbsoluteThreshold: 0.99,
    dropCooldown: 60000,
    
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

// Alias para compatibilidad
VIBE_SECTION_PROFILES['techno-club'] = VIBE_SECTION_PROFILES['techno'];
VIBE_SECTION_PROFILES['fiesta-latina'] = VIBE_SECTION_PROFILES['latino'];
VIBE_SECTION_PROFILES['rock-concert'] = VIBE_SECTION_PROFILES['rock'];
VIBE_SECTION_PROFILES['ambient'] = VIBE_SECTION_PROFILES['chill'];
```

### 2.3 NUEVA FIRMA DE `track()`

```typescript
// 📍 UBICACIÓN: SectionTracker.ts:~330
// ANTES:
track(
  rhythm: RhythmAnalysis,
  harmony: HarmonyAnalysis | null,
  audio: { energy: number; bass: number; mid: number; treble: number },
  forceAnalysis?: boolean
): SectionAnalysis

// DESPUÉS (WAVE 289):
track(
  rhythm: RhythmAnalysis,
  harmony: HarmonyAnalysis | null,
  audio: { energy: number; bass: number; mid: number; treble: number },
  vibeContext?: VibeContextForSection,  // 🆕 NUEVO PARÁMETRO
  forceAnalysis?: boolean
): SectionAnalysis

// Tipo auxiliar para evitar dependencia circular
interface VibeContextForSection {
  vibeId: string;  // 'techno', 'latino', 'rock', 'chill', 'idle'
  profile?: VibeSectionProfile;  // Override opcional del perfil
}
```

### 2.4 FLUJO DE INYECCIÓN PROPUESTO

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     WAVE 289: INJECTION FLOW                                │
└────────────────────────────────────────────────────────────────────────────┘

PASO 1: TitanEngine ya tiene vibeId
╔═══════════════════════════════════════════════════════════════════════════╗
║  TitanEngine.update(context, audio) {                                      ║
║    const vibeProfile = this.vibeManager.getActiveVibe();                   ║
║    const vibeId = vibeProfile.id;  // ✅ DISPONIBLE                        ║
║    ...                                                                     ║
║  }                                                                         ║
╚═══════════════════════════════════════════════════════════════════════════╝
              │
              │ PROBLEMA: MusicalContextEngine.process() se llama
              │ desde SeleneMusicalBrain o directamente
              ▼

PASO 2: OPCIONES DE INYECCIÓN

┌─────────────────────────────────────────────────────────────────────────┐
│ OPCIÓN A: Modificar MusicalContextEngine.process(audio, vibeId)         │
│ PRO: Limpio, claro                                                      │
│ CON: Requiere cambiar llamadas en SeleneMusicalBrain                    │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ OPCIÓN B: MusicalContextEngine tiene su propia referencia a VibeManager │
│ PRO: No cambia firmas existentes                                        │
│ CON: Acoplamiento (pero ya existe en TitanEngine)                       │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ OPCIÓN C: Setter en MusicalContextEngine.setVibeContext(vibeId)         │
│ PRO: Mínimo cambio, TitanEngine llama antes del loop                    │
│ CON: Estado mutable (pero es el patrón actual de LuxSync)               │
└─────────────────────────────────────────────────────────────────────────┘

🎯 RECOMENDACIÓN: OPCIÓN C (Setter) - Mínimo impacto, máxima compatibilidad
```

---

## 🔧 MODIFICACIONES PROPUESTAS

### 3.1 SectionTrackerConfig Extendido

```typescript
// ANTES:
const DEFAULT_CONFIG: SectionTrackerConfig = {
  throttleMs: 500,
  energyHistorySize: 20,
  energyChangeThreshold: 0.25,
  minSectionDuration: 8000,
  maxDropDuration: 30000,  // ❌ HARDCODED
  dropCooldownTime: 5000,
  dropEnergyKillThreshold: 0.6,
};

// DESPUÉS:
const DEFAULT_CONFIG: SectionTrackerConfig = {
  throttleMs: 500,
  energyHistorySize: 20,
  minSectionDuration: 8000,
  // 🔥 WAVE 289: Los valores de drop/buildup/breakdown 
  // ahora vienen del VibeSectionProfile activo
  fallbackProfile: VIBE_SECTION_PROFILES['techno'],  // Default si no hay vibe
};
```

### 3.2 Nuevo Método: `setVibeProfile()`

```typescript
/**
 * 🔥 WAVE 289: Establecer perfil de sección basado en Vibe
 * Llamado por MusicalContextEngine cuando cambia el vibe
 */
public setVibeProfile(vibeId: string): void {
  const profile = VIBE_SECTION_PROFILES[vibeId] 
    || VIBE_SECTION_PROFILES['techno'];
  
  this.activeProfile = profile;
  
  // Log del cambio
  console.log(`[SectionTracker] 🎯 Profile changed: ${vibeId}`);
  console.log(`[SectionTracker]    maxDrop: ${profile.maxDropDuration}ms`);
  console.log(`[SectionTracker]    dropRatio: ${profile.dropEnergyRatio}`);
}
```

### 3.3 Refactorización de detectSection()

```typescript
private detectSection(
  intensity: number,
  trend: 'rising' | 'falling' | 'stable',
  rhythm: RhythmAnalysis,
  audio: AudioSimple
): SectionType {
  const profile = this.activeProfile;  // 🆕 Usar perfil activo
  
  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 289: DYNAMIC THRESHOLDS FROM PROFILE
  // ═══════════════════════════════════════════════════════════════════════
  
  // Calcular energía ponderada según el perfil del género
  const weightedEnergy = 
    audio.bass * profile.frequencyWeights.bass +
    audio.mid * profile.frequencyWeights.mid +
    audio.treble * profile.frequencyWeights.treble;
  
  // DETECCIÓN DE DROP (usando umbrales del perfil)
  const ratio = this.instantEnergy / (this.avgEnergy + 0.01);
  
  if (ratio > profile.dropEnergyRatio && 
      weightedEnergy > profile.dropAbsoluteThreshold) {
    // Verificar cooldown específico del género
    if (!this.isDropCooldown && !this.forceDropExit) {
      this.addVote('drop', 2.5);
    }
  }
  
  // DETECCIÓN DE BUILDUP (usando delta del perfil)
  if (delta > profile.buildupDeltaThreshold) {
    this.addVote('buildup', 0.8);
  }
  
  // DETECCIÓN DE BREAKDOWN (usando umbral del perfil)
  if (weightedEnergy < profile.breakdownEnergyThreshold) {
    this.addVote('breakdown', 0.7);
  }
  
  // ... resto de la lógica
}
```

---

## 📊 COMPARATIVA DE COMPORTAMIENTO

### 4.1 ANTES vs DESPUÉS

| Escenario | ANTES (WAVE 88) | DESPUÉS (WAVE 289) |
|-----------|-----------------|---------------------|
| DROP en Techno (128bpm) | ✅ Detecta bien (30s) | ✅ Mantiene (30s) |
| DROP en Latino (105bpm) | ❌ DROP ETERNO | ✅ Kill a 12s |
| Buildup en Rock | ❌ Falso positivo constante | ✅ Solo con delta > 0.04 |
| Breakdown en Chill | ❌ Siempre en "breakdown" | ✅ threshold 0.50 respetado |
| Transición verse→drop Latino | ❌ Bloqueada por matriz | ✅ Permitida por override |

### 4.2 MÉTRICAS ESPERADAS

```
📈 MEJORA ESPERADA:
- Falsos positivos DROP: -70% (especialmente en Latino)
- Tiempo promedio en DROP Latino: 12s (antes: 30s+)
- Precisión de transiciones: +40%
- "Flicker" entre secciones: -60%
```

---

## 📁 ARCHIVOS A MODIFICAR

| Archivo | Cambio | Impacto |
|---------|--------|---------|
| `SectionTracker.ts` | Añadir VibeSectionProfile, setVibeProfile(), refactorizar detectSection() | 🔴 ALTO |
| `MusicalContextEngine.ts` | Añadir setVibeContext(), pasar a SectionTracker | 🟡 MEDIO |
| `TitanEngine.ts` | Llamar engine.setVibeContext() cuando cambia vibe | 🟢 BAJO |
| `types.ts` | Añadir interfaces VibeSectionProfile, VibeContextForSection | 🟢 BAJO |

---

## 🛡️ CRITERIOS DE ACEPTACIÓN

1. **Latino DROP Test**: Reproducir "Pepas" de Farruko → DROP no debe superar 12 segundos
2. **Techno DROP Test**: Reproducir Brejcha → DROP puede durar hasta 30 segundos
3. **No Regression**: Tests existentes de SectionTracker deben pasar
4. **Transición Libre**: Latino: verse → drop sin pasar por buildup
5. **Performance**: Sin impacto medible en latencia (< 0.1ms extra por frame)

---

## 🎯 SIGUIENTE PASO

Una vez aprobado este blueprint:

1. **WAVE 289.1**: Implementar VibeSectionProfile y perfiles
2. **WAVE 289.2**: Refactorizar SectionTracker.detectSection()
3. **WAVE 289.3**: Conectar flujo MusicalContextEngine → SectionTracker
4. **WAVE 289.4**: Testing con playlist mixta (Techno/Latino/Rock)

---

*"El SectionTracker era ciego al género. Ahora ve en colores."*

**— PunkOpus, 2 Enero 2026** 🏴‍☠️
