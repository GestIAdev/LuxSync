# 🎛️ WAVE 58: THE VIBE ENGINE - PART 2
## Architecture Blueprint: VibeManager, Integration & Legacy Removal

**Autor:** Claude (Opus) - Master Punk Architect Mode  
**Fecha:** 2025-12-21  
**Estado:** 📐 BLUEPRINT - Pre-Implementation  
**Filosofía:** RESTRINGIR, NO FORZAR

---

## 4. 🏗️ ARQUITECTURA DEL VIBEMANAGER

### 4.1 Diagrama de Flujo General

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            VIBE ENGINE ARCHITECTURE                          │
└──────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   UI DASHBOARD  │
                              │   (Selector)    │
                              └────────┬────────┘
                                       │ setActiveVibe('techno-club')
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              VIBE MANAGER                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  Active Vibe    │  │  Transition     │  │  Constraint Validator       │  │
│  │  Profile        │  │  Interpolator   │  │  (Gatekeeper)               │  │
│  │                 │  │                 │  │                             │  │
│  │  currentVibe    │  │  source →target │  │  validate(decision) → bool  │  │
│  │  previousVibe   │  │  progress: 0-1  │  │  constrain(value) → bounded │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
│                                                                              │
│  getConstrainedMood(raw: MoodType): MoodType                                │
│  getConstrainedStrategy(raw: ColorStrategy): ColorStrategy                  │
│  getConstrainedDimmer(raw: number): number                                  │
│  isDropAllowed(energy: number, timeSinceLastDrop: number): boolean         │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                       ┌───────────────┼───────────────┐
                       ▼               ▼               ▼
              ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
              │ MoodArbiter │  │ Strategy    │  │ Energy      │
              │             │  │ Arbiter     │  │ Stabilizer  │
              │ CONSULTA    │  │ CONSULTA    │  │ CONSULTA    │
              │ constraints │  │ constraints │  │ drop rules  │
              └─────────────┘  └─────────────┘  └─────────────┘
                       │               │               │
                       └───────────────┼───────────────┘
                                       ▼
                              ┌─────────────────┐
                              │   SeleneLux     │
                              │  getBroadcast() │
                              └─────────────────┘
```

### 4.2 VibeManager Class

```typescript
/**
 * 🎛️ VIBE MANAGER
 * 
 * Singleton que gestiona el Vibe activo y provee restricciones a todos los Arbiters.
 * NO TOMA DECISIONES - Solo RESTRINGE el espacio de decisiones.
 * 
 * Patrón: Service Locator + Bounded Context Provider
 */
export class VibeManager {
  private static instance: VibeManager;
  
  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════
  private currentVibe: VibeProfile;
  private previousVibe: VibeProfile | null = null;
  private transitionProgress: number = 1.0;  // 1.0 = fully transitioned
  private transitionDurationFrames: number = 180;  // 3 seconds default
  private transitionStartFrame: number = 0;
  
  // Presets registry
  private readonly vibeRegistry: Map<VibeId, VibeProfile> = new Map([
    ['techno-club', VIBE_TECHNO_CLUB],
    ['fiesta-latina', VIBE_FIESTA_LATINA],
    ['pop-rock', VIBE_POP_ROCK],
    ['chill-lounge', VIBE_CHILL_LOUNGE],
  ]);
  
  private constructor() {
    // Default vibe
    this.currentVibe = VIBE_POP_ROCK;  // Most balanced default
  }
  
  public static getInstance(): VibeManager {
    if (!VibeManager.instance) {
      VibeManager.instance = new VibeManager();
    }
    return VibeManager.instance;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API - VIBE SWITCHING
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Cambia el Vibe activo con transición suave.
   * La transición interpola constraints gradualmente.
   */
  public setActiveVibe(vibeId: VibeId, frameCount: number): void {
    const newVibe = this.vibeRegistry.get(vibeId);
    if (!newVibe || newVibe.id === this.currentVibe.id) return;
    
    this.previousVibe = this.currentVibe;
    this.currentVibe = newVibe;
    this.transitionProgress = 0.0;
    this.transitionStartFrame = frameCount;
    
    console.log(`[VibeManager] Transitioning: ${this.previousVibe.id} → ${newVibe.id}`);
  }
  
  /**
   * Cambio instantáneo sin transición (para emergencias o inicio).
   */
  public setActiveVibeImmediate(vibeId: VibeId): void {
    const newVibe = this.vibeRegistry.get(vibeId);
    if (!newVibe) return;
    
    this.currentVibe = newVibe;
    this.previousVibe = null;
    this.transitionProgress = 1.0;
  }
  
  /**
   * Actualizar progreso de transición (llamar cada frame).
   */
  public updateTransition(frameCount: number): void {
    if (this.transitionProgress >= 1.0) return;
    
    const elapsed = frameCount - this.transitionStartFrame;
    this.transitionProgress = Math.min(1.0, elapsed / this.transitionDurationFrames);
    
    if (this.transitionProgress >= 1.0) {
      this.previousVibe = null;  // Cleanup
      console.log(`[VibeManager] Transition complete: ${this.currentVibe.id}`);
    }
  }
  
  public getActiveVibe(): VibeProfile {
    return this.currentVibe;
  }
  
  public isTransitioning(): boolean {
    return this.transitionProgress < 1.0;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // CONSTRAINT METHODS - For Arbiters
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * 🎭 MOOD CONSTRAINT
   * 
   * Si el mood detectado no está permitido, devuelve el fallback.
   * Durante transición, interpola entre allowedMoods de ambos vibes.
   */
  public getConstrainedMood(detectedMood: MoodType): MoodType {
    const profile = this.getEffectiveProfile();
    
    if (profile.mood.allowed.includes(detectedMood)) {
      return detectedMood;
    }
    
    // Mood no permitido → buscar el más cercano permitido
    const closestAllowed = this.findClosestMood(detectedMood, profile.mood.allowed);
    return closestAllowed || profile.mood.fallback;
  }
  
  /**
   * 🎨 COLOR STRATEGY CONSTRAINT
   */
  public getConstrainedStrategy(detectedStrategy: ColorStrategy): ColorStrategy {
    const profile = this.getEffectiveProfile();
    
    if (profile.color.strategies.includes(detectedStrategy)) {
      return detectedStrategy;
    }
    
    // Strategy no permitida → usar la primera permitida
    return profile.color.strategies[0];
  }
  
  /**
   * 🌡️ TEMPERATURE CONSTRAINT
   * Clamp al rango permitido.
   */
  public getConstrainedTemperature(rawKelvin: number): number {
    const profile = this.getEffectiveProfile();
    return Math.max(
      profile.color.temperature.min,
      Math.min(profile.color.temperature.max, rawKelvin)
    );
  }
  
  /**
   * 🎚️ SATURATION CONSTRAINT
   */
  public getConstrainedSaturation(rawSaturation: number): number {
    const profile = this.getEffectiveProfile();
    return Math.max(
      profile.color.saturation.min,
      Math.min(profile.color.saturation.max, rawSaturation)
    );
  }
  
  /**
   * 💡 DIMMER CONSTRAINT
   * Aplica floor, ceiling y blackout rules.
   */
  public getConstrainedDimmer(rawDimmer: number): number {
    const profile = this.getEffectiveProfile();
    
    // Blackout check
    if (rawDimmer < 0.01 && !profile.dimmer.allowBlackout) {
      return profile.dimmer.floor;
    }
    
    return Math.max(
      profile.dimmer.floor,
      Math.min(profile.dimmer.ceiling, rawDimmer)
    );
  }
  
  /**
   * ⚡ DROP ALLOWED CHECK
   */
  public isDropAllowed(
    currentEnergy: number,
    smoothedEnergy: number,
    framesSinceLastDrop: number
  ): boolean {
    const profile = this.getEffectiveProfile();
    
    // Cooldown check
    if (framesSinceLastDrop < profile.drop.timing.cooldownFrames) {
      return false;
    }
    
    // Energy threshold check
    const energyDelta = currentEnergy - smoothedEnergy;
    if (energyDelta < profile.drop.energyThreshold * profile.drop.sensitivity) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 🏃 MOVEMENT CONSTRAINT
   */
  public getConstrainedMovement(pattern: MovementPattern, speed: number): {
    pattern: MovementPattern;
    speed: number;
  } {
    const profile = this.getEffectiveProfile();
    
    const constrainedPattern = profile.movement.allowedPatterns.includes(pattern)
      ? pattern
      : profile.movement.allowedPatterns[0];
    
    const constrainedSpeed = Math.max(
      profile.movement.speedRange.min,
      Math.min(profile.movement.speedRange.max, speed)
    );
    
    return { pattern: constrainedPattern, speed: constrainedSpeed };
  }
  
  /**
   * ✨ EFFECT CONSTRAINT
   */
  public isEffectAllowed(effect: EffectType, intensity?: number): boolean {
    const profile = this.getEffectiveProfile();
    
    if (!profile.effects.allowed.includes(effect)) {
      return false;
    }
    
    if (intensity && intensity > profile.effects.maxIntensity) {
      return false;
    }
    
    return true;
  }
  
  /**
   * ⚡ STROBE RATE CONSTRAINT
   */
  public getMaxStrobeRate(): number {
    return this.getEffectiveProfile().effects.maxStrobeRate;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // INTERNAL HELPERS
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Obtiene el perfil efectivo, interpolando si hay transición.
   */
  private getEffectiveProfile(): VibeProfile {
    if (!this.previousVibe || this.transitionProgress >= 1.0) {
      return this.currentVibe;
    }
    
    // Durante transición, usamos el perfil más restrictivo
    // para evitar glitches visuales
    return this.mergeProfiles(
      this.previousVibe,
      this.currentVibe,
      this.transitionProgress
    );
  }
  
  /**
   * Merge profiles durante transición.
   * Usa el más restrictivo para valores numéricos.
   */
  private mergeProfiles(
    from: VibeProfile,
    to: VibeProfile,
    t: number
  ): VibeProfile {
    // Para transición, retornamos el target si estamos >50%
    // Esto evita estados intermedios extraños
    if (t > 0.5) return to;
    return from;
    
    // NOTA: Una implementación más sofisticada podría interpolar
    // valores numéricos (floor, ceiling, thresholds) pero los
    // arrays (allowedMoods) requieren lógica de merge más compleja.
  }
  
  /**
   * Encuentra el mood más cercano de un array permitido.
   * Basado en espacio conceptual de moods.
   */
  private findClosestMood(target: MoodType, allowed: MoodType[]): MoodType | null {
    // Mood proximity map (heurística)
    const moodProximity: Record<MoodType, MoodType[]> = {
      'peaceful': ['calm', 'dreamy', 'playful'],
      'calm': ['peaceful', 'dreamy', 'playful'],
      'dreamy': ['calm', 'peaceful', 'playful'],
      'playful': ['festive', 'euphoric', 'energetic', 'calm'],
      'festive': ['playful', 'euphoric', 'energetic'],
      'euphoric': ['festive', 'playful', 'energetic', 'dramatic'],
      'dark': ['dramatic', 'tense', 'calm'],
      'dramatic': ['dark', 'tense', 'energetic', 'euphoric'],
      'aggressive': ['dramatic', 'tense', 'energetic', 'dark'],
      'energetic': ['dramatic', 'euphoric', 'festive', 'playful'],
      'tense': ['dramatic', 'dark', 'energetic', 'aggressive'],
    };
    
    const proxies = moodProximity[target] || [];
    for (const proxy of proxies) {
      if (allowed.includes(proxy)) {
        return proxy;
      }
    }
    
    return null;  // No match found
  }
  
  // ═══════════════════════════════════════════════════════════════
  // DEBUG / OBSERVABILITY
  // ═══════════════════════════════════════════════════════════════
  
  public getDebugInfo(): object {
    return {
      activeVibe: this.currentVibe.id,
      previousVibe: this.previousVibe?.id ?? null,
      transitionProgress: this.transitionProgress,
      isTransitioning: this.isTransitioning(),
      constraints: {
        allowedMoods: this.currentVibe.mood.allowed,
        dimmerFloor: this.currentVibe.dimmer.floor,
        dropSensitivity: this.currentVibe.drop.sensitivity,
      },
    };
  }
}
```

---

## 5. 🔌 INTEGRACIÓN CON ARBITERS

### 5.1 Modificación de MoodArbiter

```typescript
// En electron-app/src/selene/workers/gamma/arbiters/MoodArbiter.ts

import { VibeManager } from '../vibe/VibeManager';

export class MoodArbiter {
  private vibeManager = VibeManager.getInstance();
  
  /**
   * ANTES (sin Vibe):
   *   return this.analyzeMood(audioData);
   * 
   * DESPUÉS (con Vibe):
   *   const rawMood = this.analyzeMood(audioData);
   *   return this.vibeManager.getConstrainedMood(rawMood);
   */
  public arbitrate(audioData: AudioAnalysis): MoodDecision {
    // 1. Análisis crudo del audio
    const rawMood = this.analyzeMoodFromAudio(audioData);
    
    // 2. 🎛️ CONSTRAINT: Aplicar restricciones del Vibe
    const constrainedMood = this.vibeManager.getConstrainedMood(rawMood);
    
    // 3. Confidence: reducir si fue restringido
    const wasConstrained = rawMood !== constrainedMood;
    const confidencePenalty = wasConstrained ? 0.15 : 0;
    
    return {
      mood: constrainedMood,
      confidence: Math.max(0.1, this.calculateConfidence() - confidencePenalty),
      wasConstrained,
      originalMood: wasConstrained ? rawMood : undefined,
    };
  }
}
```

### 5.2 Modificación de StrategyArbiter

```typescript
// En electron-app/src/selene/workers/gamma/arbiters/StrategyArbiter.ts

import { VibeManager } from '../vibe/VibeManager';

export class StrategyArbiter {
  private vibeManager = VibeManager.getInstance();
  
  public arbitrate(harmonyData: HarmonyAnalysis, mood: MoodDecision): StrategyDecision {
    // 1. Análisis de estrategia basado en armonía
    const rawStrategy = this.analyzeStrategy(harmonyData, mood);
    
    // 2. 🎛️ CONSTRAINT: Aplicar restricciones del Vibe
    const constrainedStrategy = this.vibeManager.getConstrainedStrategy(rawStrategy);
    
    // 3. Temperatura constrained
    const rawTemperature = this.calculateTemperature(harmonyData);
    const constrainedTemperature = this.vibeManager.getConstrainedTemperature(rawTemperature);
    
    // 4. Saturación constrained
    const rawSaturation = this.calculateSaturation(mood);
    const constrainedSaturation = this.vibeManager.getConstrainedSaturation(rawSaturation);
    
    return {
      strategy: constrainedStrategy,
      temperature: constrainedTemperature,
      saturation: constrainedSaturation,
      wasConstrained: rawStrategy !== constrainedStrategy,
    };
  }
}
```

### 5.3 Modificación de EnergyStabilizer

```typescript
// En electron-app/src/selene/workers/gamma/stabilizers/EnergyStabilizer.ts

import { VibeManager } from '../vibe/VibeManager';

export class EnergyStabilizer {
  private vibeManager = VibeManager.getInstance();
  private framesSinceLastDrop = 9999;
  
  public process(rawEnergy: number, smoothedEnergy: number): EnergyState {
    this.framesSinceLastDrop++;
    
    // 🎛️ CONSTRAINT: Verificar si drop está permitido
    const dropAllowed = this.vibeManager.isDropAllowed(
      rawEnergy,
      smoothedEnergy,
      this.framesSinceLastDrop
    );
    
    if (dropAllowed && this.detectDropConditions(rawEnergy, smoothedEnergy)) {
      this.framesSinceLastDrop = 0;
      return this.enterDropState();
    }
    
    return this.calculateNormalState(rawEnergy);
  }
  
  private enterDropState(): EnergyState {
    const profile = this.vibeManager.getActiveVibe();
    
    return {
      isDropActive: true,
      attackCurve: profile.drop.curves.attack,
      maxSustain: profile.drop.timing.maxSustain,
      releaseFrames: profile.drop.timing.releaseFrames,
    };
  }
}
```

### 5.4 Inyección en mind.ts

```typescript
// En electron-app/src/selene/workers/gamma/mind.ts

import { VibeManager } from './vibe/VibeManager';

const vibeManager = VibeManager.getInstance();

// Update transition cada frame
onmessage = (event: MessageEvent<BetaBroadcast>) => {
  const beta = event.data;
  
  // 1. Actualizar transición de Vibe (si hay alguna)
  vibeManager.updateTransition(beta.frameCount);
  
  // 2. Pipeline normal con constraints automáticos
  const moodDecision = moodArbiter.arbitrate(beta);
  const strategyDecision = strategyArbiter.arbitrate(beta, moodDecision);
  const energyState = energyStabilizer.process(beta.energy, beta.smoothedEnergy);
  
  // 3. Broadcast incluye debug info de Vibe
  postMessage({
    ...buildGammaBroadcast(moodDecision, strategyDecision, energyState),
    vibeDebug: vibeManager.getDebugInfo(),
  });
};
```

---

## 6. 🔄 TRANSICIONES SUAVES (Smooth Interpolation)

### 6.1 Problema

Cuando el DJ cambia de Vibe en caliente (ej: TechnoClub → FiestaLatina), los constraints cambian bruscamente:
- Dimmer floor: 5% → 25%
- Allowed moods: [dark, tense] → [festive, playful]
- Temperature: cold → warm

Esto puede causar **saltos visuales** (glitches).

### 6.2 Solución: Transition Interpolator

```typescript
/**
 * 🔄 TRANSITION INTERPOLATOR
 * 
 * Interpola valores numéricos durante transición de Vibe.
 * Para valores categóricos (moods, strategies), usa crossfade.
 */
export class TransitionInterpolator {
  /**
   * Interpola valores numéricos (dimmer, saturation, temperature).
   */
  static interpolateNumber(from: number, to: number, t: number): number {
    // Easing: ease-in-out para suavidad
    const eased = t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2;
    
    return from + (to - from) * eased;
  }
  
  /**
   * Para dimmer: transición especial que NUNCA baja del máximo de ambos floors.
   * Evita blackouts accidentales durante transición.
   */
  static interpolateDimmerFloor(from: number, to: number, t: number): number {
    const safeFloor = Math.max(from, to);  // Usar el más alto durante transición
    const targetFloor = this.interpolateNumber(from, to, t);
    
    // Hasta 70% de la transición, usar safe floor
    if (t < 0.7) {
      return safeFloor;
    }
    
    // Último 30%, interpolar hacia target
    const localT = (t - 0.7) / 0.3;
    return this.interpolateNumber(safeFloor, targetFloor, localT);
  }
  
  /**
   * Para moods: durante transición, permitir UNIÓN de ambos sets.
   */
  static getMergedAllowedMoods(
    fromProfile: VibeProfile,
    toProfile: VibeProfile,
    t: number
  ): MoodType[] {
    if (t < 0.3) {
      // Primero 30%: solo moods del from
      return fromProfile.mood.allowed;
    } else if (t < 0.7) {
      // 30-70%: unión de ambos (máxima flexibilidad)
      return [...new Set([...fromProfile.mood.allowed, ...toProfile.mood.allowed])];
    } else {
      // Último 30%: solo moods del to
      return toProfile.mood.allowed;
    }
  }
}
```

### 6.3 Diagrama de Transición

```
Tiempo:  0% ─────────────────────────────────────────────────────→ 100%
         │                                                        │
         │◄─── Phase 1 ───►│◄────── Phase 2 ──────►│◄─ Phase 3 ─►│
         │    (30%)        │       (40%)           │   (30%)     │
         │                 │                       │             │
Moods:   │  [FROM only]    │   [FROM ∪ TO]        │  [TO only]  │
         │                 │                       │             │
Dimmer:  │  [max(F,T)]    │   [max(F,T)]         │  [interp→T] │
         │                 │                       │             │
Temp:    │  [eased interpolation across full transition]        │
```

---

## 7. 🗑️ PLAN DE LIMPIEZA (Legacy Removal)

### 7.1 Archivos a ELIMINAR

```
electron-app/src/selene/
├── workers/
│   └── gamma/
│       ├── classifiers/
│       │   ├── GenreClassifier.ts       ❌ DELETE
│       │   ├── SimpleBinaryBias.ts      ❌ DELETE
│       │   └── GenreVoter.ts            ❌ DELETE (si existe)
│       │
│       └── analyzers/
│           └── DembowDetector.ts        ❌ DELETE (sin contexto BPM, inútil)
```

### 7.2 Referencias a LIMPIAR

```typescript
// BUSCAR Y ELIMINAR todas las referencias a:

// En mind.ts:
- import { GenreClassifier } from './classifiers/GenreClassifier';
- import { SimpleBinaryBias } from './classifiers/SimpleBinaryBias';
- const genreClassifier = new GenreClassifier();
- const genre = genreClassifier.classify(...);

// En SeleneProtocol.ts:
- genre: string;                    // REMOVE field
- genreConfidence: number;          // REMOVE field
- isLatino: boolean;                // REMOVE field

// En SeleneLux.ts (getBroadcast):
- const genre = gamma?.genre;       // REMOVE
- if (genre === 'latino') { ... }   // REMOVE special case logic

// En cualquier archivo:
- LATINO_TRADITIONAL
- LATINO_URBAN  
- ELECTRONIC_MAIN
- isLatino
- genreWeight
```

### 7.3 Código a REEMPLAZAR

```typescript
// ANTES (en varios lugares):
if (genre === 'latino') {
  strategy = 'triadic';
  temperature = 3000;
}

// DESPUÉS:
// ❌ ELIMINAR - El VibeManager ya restringe esto automáticamente
// El DJ selecciona FiestaLatina → constraints ya aplicados
```

### 7.4 Checklist de Limpieza

| Archivo | Acción | Estado |
|---------|--------|--------|
| `GenreClassifier.ts` | DELETE | ⬜ |
| `SimpleBinaryBias.ts` | DELETE | ⬜ |
| `DembowDetector.ts` | DELETE | ⬜ |
| `mind.ts` | Remove imports/instances | ⬜ |
| `SeleneProtocol.ts` | Remove genre fields | ⬜ |
| `SeleneLux.ts` | Remove genre conditionals | ⬜ |
| `WorkerProtocol.ts` | Remove genre from debug | ⬜ |

---

## 8. 🖥️ UI/UX DASHBOARD

### 8.1 Propuesta Visual

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SELENE COMMAND CENTER                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────── VIBE SELECTOR ───────────────────┐               │
│  │                                                      │               │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │   │   🏭    │  │   🎉    │  │   🎸    │  │   🍸    │           │
│  │   │  TECHNO │  │ LATINA  │  │ POP ROCK│  │  CHILL  │           │
│  │   │  CLUB   │  │ FIESTA  │  │         │  │ LOUNGE  │           │
│  │   │ ▪▪▪▪▪▪  │  │ ▪▪▪▪▪▪  │  │ ▪▪▪▪▪▪  │  │ ▪▪▪▪▪▪  │           │
│  │   │[ACTIVE] │  │         │  │         │  │         │           │
│  │   └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│  │                                                      │               │
│  │   Transition: ████████░░ 80%    Mood: dark          │               │
│  │                                                      │               │
│  └──────────────────────────────────────────────────────┘               │
│                                                                         │
│  ┌─────────────── ACTIVE CONSTRAINTS ──────────────────┐               │
│  │                                                      │               │
│  │   Allowed Moods: [dark] [dramatic] [tense] [calm]   │               │
│  │   Temperature:   ████████░░░░░░░░  4000K-9000K      │               │
│  │   Saturation:    ███░░░░░░░░░░░░░  0.30-0.85        │               │
│  │   Dimmer Floor:  █░░░░░░░░░░░░░░░  5%               │               │
│  │   Drop Cooldown: ████████████░░░░  4.0s             │               │
│  │                                                      │               │
│  └──────────────────────────────────────────────────────┘               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Implementación React (Esquema)

```typescript
// electron-app/src/components/VibeSelector.tsx

interface VibeSelectorProps {
  currentVibe: VibeId;
  isTransitioning: boolean;
  transitionProgress: number;
  onVibeChange: (vibeId: VibeId) => void;
}

export const VibeSelector: React.FC<VibeSelectorProps> = ({
  currentVibe,
  isTransitioning,
  transitionProgress,
  onVibeChange,
}) => {
  const vibes: Array<{ id: VibeId; icon: string; label: string }> = [
    { id: 'techno-club', icon: '🏭', label: 'TECHNO\nCLUB' },
    { id: 'fiesta-latina', icon: '🎉', label: 'LATINA\nFIESTA' },
    { id: 'pop-rock', icon: '🎸', label: 'POP\nROCK' },
    { id: 'chill-lounge', icon: '🍸', label: 'CHILL\nLOUNGE' },
  ];
  
  return (
    <div className="vibe-selector">
      <h3>VIBE SELECTOR</h3>
      
      <div className="vibe-buttons">
        {vibes.map(vibe => (
          <button
            key={vibe.id}
            className={`vibe-button ${currentVibe === vibe.id ? 'active' : ''}`}
            onClick={() => onVibeChange(vibe.id)}
            disabled={isTransitioning}
          >
            <span className="vibe-icon">{vibe.icon}</span>
            <span className="vibe-label">{vibe.label}</span>
            {currentVibe === vibe.id && (
              <span className="active-indicator">[ACTIVE]</span>
            )}
          </button>
        ))}
      </div>
      
      {isTransitioning && (
        <div className="transition-bar">
          <span>Transition:</span>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${transitionProgress * 100}%` }}
            />
          </div>
          <span>{Math.round(transitionProgress * 100)}%</span>
        </div>
      )}
    </div>
  );
};
```

### 8.3 IPC Communication

```typescript
// Main Process ↔ Renderer communication

// electron-app/electron/ipc/vibeHandlers.ts
ipcMain.handle('vibe:set', async (_, vibeId: VibeId) => {
  // Enviar al worker de Selene
  seleneWorker.postMessage({ type: 'SET_VIBE', vibeId });
  return { success: true };
});

ipcMain.handle('vibe:get-current', async () => {
  return vibeManager.getDebugInfo();
});

// Frontend hook
// electron-app/src/hooks/useVibe.ts
export function useVibe() {
  const [vibe, setVibe] = useState<VibeId>('pop-rock');
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const changeVibe = async (newVibe: VibeId) => {
    await window.electron.invoke('vibe:set', newVibe);
    setVibe(newVibe);
    setIsTransitioning(true);
  };
  
  useEffect(() => {
    // Subscribe to vibe updates from Selene
    const unsub = window.electron.on('vibe:updated', (data) => {
      setIsTransitioning(data.isTransitioning);
    });
    return unsub;
  }, []);
  
  return { vibe, isTransitioning, changeVibe };
}
```

---

## 9. 📋 IMPLEMENTATION ROADMAP

### Phase 1: Core (WAVE 59)
1. Crear `VibeProfile` interface
2. Crear 4 presets const
3. Implementar `VibeManager` singleton
4. Tests unitarios de constraints

### Phase 2: Integration (WAVE 60)
1. Modificar `MoodArbiter` → consulta VibeManager
2. Modificar `StrategyArbiter` → consulta VibeManager
3. Modificar `EnergyStabilizer` → consulta VibeManager
4. Inyectar en `mind.ts`

### Phase 3: Cleanup (WAVE 61)
1. DELETE `GenreClassifier.ts`
2. DELETE `SimpleBinaryBias.ts`
3. REMOVE all genre references
4. Update protocols

### Phase 4: UI (WAVE 62)
1. Crear `VibeSelector` component
2. IPC handlers
3. Integrar en Command Center

### Phase 5: Polish (WAVE 63)
1. Transition interpolation refinement
2. Per-vibe tuning basado en testing real
3. Documentación usuario final

---

## 10. ✅ SUCCESS CRITERIA

| Criterio | Métrica |
|----------|---------|
| **Zero Genre Bugs** | Nunca más "LATINO" en techno |
| **Constraint Enforcement** | 100% de outputs dentro de bounds |
| **Smooth Transitions** | <50ms glitch durante cambio de vibe |
| **UI Responsiveness** | <100ms desde click hasta feedback visual |
| **Code Reduction** | -500 LOC (removal of classifiers) |
| **Cognitive Load** | DJ solo elige 1 de 4 opciones |

---

## 11. 🎯 FILOSOFÍA FINAL

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   "No predecimos el género. No adivinamos el mood.             │
│    El DJ nos dice el CONTEXTO, nosotros operamos               │
│    DENTRO de ese contexto con precisión industrial."           │
│                                                                 │
│   RESTRINGIR, NO FORZAR.                                       │
│   BOUNDED CONTEXTS, NOT STATIC VALUES.                         │
│   PROFESSIONAL PRODUCT, NOT AMATEUR HEURISTICS.                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

**END OF BLUEPRINT - WAVE 58: THE VIBE ENGINE**

*Documento listo para revisión e implementación.*  
*Siguiente paso: Aprobación → WAVE 59 (Implementation Phase 1)*
